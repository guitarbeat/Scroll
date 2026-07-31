import { createClient } from "redis";

// ---------------------------------------------------------------------------
// In-memory fallback store when Redis is disabled or fails
// ---------------------------------------------------------------------------
let memorySchema: any = null;
const memoryShapes: Record<string, any> = {};
const memoryDeleted = new Set<string>();

function updateMemoryStore(schema?: any, upserted?: Record<string, any>, deleted?: string[]) {
  if (schema) memorySchema = schema;
  if (upserted && typeof upserted === "object") {
    for (const [id, record] of Object.entries(upserted)) {
      memoryShapes[id] = record;
      memoryDeleted.delete(id);
    }
  }
  if (deleted && Array.isArray(deleted)) {
    for (const id of deleted) {
      delete memoryShapes[id];
      memoryDeleted.add(id);
    }
  }
}

function getMemoryStoreResponse() {
  if (!memorySchema && Object.keys(memoryShapes).length === 0) {
    return { status: "empty" };
  }
  return {
    schema: memorySchema,
    shapes: memoryShapes,
    deleted: Array.from(memoryDeleted),
  };
}

// ---------------------------------------------------------------------------
// Redis connection — reused across warm serverless invocations
// ---------------------------------------------------------------------------
let redisClient: any = null;
let isConnecting = false;
let isRedisDisabled = false;

function isAuthError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes("wrongpass") ||
    msg.includes("invalid username-password") ||
    msg.includes("user is disabled") ||
    msg.includes("noauth") ||
    msg.includes("auth")
  );
}

function markRedisDisabled(reason: any) {
  if (!isRedisDisabled) {
    isRedisDisabled = true;
  }
  if (redisClient) {
    try {
      redisClient.disconnect();
    } catch (_) {}
    redisClient = null;
  }
}

const getRedisClient = async () => {
  if (isRedisDisabled) return null;
  if (redisClient && redisClient.isOpen) return redisClient;

  if (isConnecting) {
    while (isConnecting) await new Promise((r) => setTimeout(r, 50));
    if (isRedisDisabled) return null;
    return redisClient;
  }

  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!url) return null;

  isConnecting = true;
  try {
    const client = createClient({
      url,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries, cause) => {
          if (isAuthError(cause) || retries >= 2) {
            return false; // Stop reconnecting immediately on auth error or repeated failures
          }
          return Math.min(retries * 200, 1000);
        },
      },
    });

    client.on("error", (err: any) => {
      markRedisDisabled(err);
    });

    await client.connect();
    redisClient = client;
    return redisClient;
  } catch (err: any) {
    markRedisDisabled(err);
    return null;
  } finally {
    isConnecting = false;
  }
};

// ---------------------------------------------------------------------------
// Key layout
//   canvas:schema        — tldraw schema (one per canvas)
//   canvas:shape:<id>    — one key per shape / asset record
//   canvas:deleted       — Redis Set of deleted shape IDs
//
// Cursors are handled entirely via Ably Presence — nothing stored in Redis.
// ---------------------------------------------------------------------------
const SCHEMA_KEY   = "canvas:schema";
const SHAPE_PREFIX = "canvas:shape:";
const DELETED_SET  = "canvas:deleted";

const isRedisConfigured = () => !!(process.env.REDIS_URL || process.env.KV_URL);

// ---------------------------------------------------------------------------
// Scan all keys matching a pattern using SCAN (non-blocking, O(1) per call).
// Safer than KEYS in production — avoids blocking the Redis server.
// ---------------------------------------------------------------------------
async function scanKeys(client: any, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const reply = await client.scan(cursor, { MATCH: pattern, COUNT: 200 });
    cursor = reply.cursor;
    keys.push(...reply.keys);
  } while (cursor !== "0");
  return keys;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req: any, res: any) {

  // ── GET ?status=true  (diagnostics) ───────────────────────────────────────
  if (req.method === "GET" && req.query?.status === "true") {
    let pingSuccess = false;
    let pingError: string | null = null;
    try {
      const client = await getRedisClient();
      if (client) {
        await client.set("communal-canvas-ping", "ok");
        const val = await client.get("communal-canvas-ping");
        pingSuccess = val === "ok";
      }
    } catch (err: any) {
      pingError = err.message || String(err);
    }
    return res.status(200).json({
      isKvConfigured: isRedisConfigured(),
      hasUrl: !!(process.env.REDIS_URL || process.env.KV_URL),
      urlPrefix: (process.env.REDIS_URL || process.env.KV_URL)
        ? (process.env.REDIS_URL || process.env.KV_URL)!.substring(0, 15) + "..."
        : null,
      pingSuccess,
      pingError,
      environment: "vercel",
    });
  }

  // ── GET /api/sync-state  (load full canvas for new joiners) ───────────────
  // Returns { schema, shapes: Record<id, record>, deleted: string[] }
  if (req.method === "GET") {
    try {
      const client = await getRedisClient();
      if (!client) {
        return res.status(200).json(getMemoryStoreResponse());
      }

      // Fetch schema, shape keys (via non-blocking SCAN), and deleted set in parallel
      const [schemaStr, shapeKeys, deletedIds] = await Promise.all([
        client.get(SCHEMA_KEY),
        scanKeys(client, SHAPE_PREFIX + "*"),
        client.sMembers(DELETED_SET),
      ]);

      if (!schemaStr && shapeKeys.length === 0) {
        return res.status(200).json(getMemoryStoreResponse());
      }

      const shapes: Record<string, any> = {};
      if (shapeKeys.length > 0) {
        const values: (string | null)[] = await client.mGet(shapeKeys);
        for (let i = 0; i < shapeKeys.length; i++) {
          const v = values[i];
          if (v) {
            try {
              const id = shapeKeys[i].slice(SHAPE_PREFIX.length);
              shapes[id] = JSON.parse(v);
            } catch (_) {}
          }
        }
      }

      const parsedSchema = schemaStr ? JSON.parse(schemaStr) : null;
      updateMemoryStore(parsedSchema, shapes, deletedIds || []);

      return res.status(200).json({
        schema: parsedSchema,
        shapes,
        deleted: deletedIds || [],
      });
    } catch (error: any) {
      markRedisDisabled(error);
      return res.status(200).json(getMemoryStoreResponse());
    }
  }

  // ── POST /api/sync-state  (persist shape diffs from a client) ─────────────
  // Body: { schema?, upserted: Record<id, record>, deleted: string[] }
  // Cursors are NOT stored here — they go through Ably Presence instead.
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { schema, upserted, deleted } = (body || {}) as {
        schema?: any;
        upserted?: Record<string, any>;
        deleted?: string[];
      };

      // Always sync to memory store
      updateMemoryStore(schema, upserted, deleted);

      const client = await getRedisClient();
      if (!client) {
        return res.status(200).json({ success: true, database: "memory" });
      }

      const pipeline = client.multi();

      if (schema) {
        pipeline.set(SCHEMA_KEY, JSON.stringify(schema));
      }

      if (upserted && typeof upserted === "object") {
        for (const [id, record] of Object.entries(upserted)) {
          pipeline.set(SHAPE_PREFIX + id, JSON.stringify(record));
          pipeline.sRem(DELETED_SET, id);
        }
      }

      if (deleted && deleted.length > 0) {
        for (const id of deleted) {
          pipeline.del(SHAPE_PREFIX + id);
          pipeline.sAdd(DELETED_SET, id);
        }
      }

      await pipeline.exec();
      return res.status(200).json({ success: true, database: "redis" });
    } catch (error: any) {
      markRedisDisabled(error);
      return res.status(200).json({ success: true, database: "memory" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
}
