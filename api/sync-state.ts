import { createClient } from "redis";

// ---------------------------------------------------------------------------
// Redis connection — reused across warm serverless invocations
// ---------------------------------------------------------------------------
let redisClient: any = null;
let isConnecting = false;

const getRedisClient = async () => {
  if (redisClient && redisClient.isOpen) return redisClient;

  if (isConnecting) {
    while (isConnecting) await new Promise((r) => setTimeout(r, 50));
    return redisClient;
  }

  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!url) return null;

  isConnecting = true;
  try {
    const client = createClient({ url });
    client.on("error", (err: any) => console.log("Redis Client Error", err));
    await client.connect();
    redisClient = client;
    return redisClient;
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
    redisClient = null;
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
      if (!client) return res.status(200).json({ status: "empty" });

      // Fetch schema, shape keys (via non-blocking SCAN), and deleted set in parallel
      const [schemaStr, shapeKeys, deletedIds] = await Promise.all([
        client.get(SCHEMA_KEY),
        scanKeys(client, SHAPE_PREFIX + "*"),
        client.sMembers(DELETED_SET),
      ]);

      if (!schemaStr && shapeKeys.length === 0) {
        return res.status(200).json({ status: "empty" });
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

      return res.status(200).json({
        schema: schemaStr ? JSON.parse(schemaStr) : null,
        shapes,
        deleted: deletedIds || [],
      });
    } catch (error: any) {
      console.error("[api/sync-state] GET error:", error);
      return res.status(200).json({ status: "empty", error: error.message });
    }
  }

  // ── POST /api/sync-state  (persist shape diffs from a client) ─────────────
  // Body: { schema?, upserted: Record<id, record>, deleted: string[] }
  // Cursors are NOT stored here — they go through Ably Presence instead.
  if (req.method === "POST") {
    try {
      const client = await getRedisClient();
      if (!client) return res.status(200).json({ success: false, database: "none" });

      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { schema, upserted, deleted } = body as {
        schema?: any;
        upserted?: Record<string, any>;
        deleted?: string[];
      };

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
      console.error("[api/sync-state] POST error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
}
