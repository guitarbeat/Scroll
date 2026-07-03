import { createClient } from "redis";

// Reuse the Redis connection across warm serverless invocations.
let redisClient: any = null;
let isConnecting = false;

const getRedisClient = async () => {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  if (isConnecting) {
    while (isConnecting) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return redisClient;
  }

  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!url) {
    return null;
  }

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

const isRedisConfigured = () => !!(process.env.REDIS_URL || process.env.KV_URL);

// Redis key layout:
//   canvas:schema          — the tldraw schema object (one per canvas)
//   canvas:shape:<id>      — one key per shape/asset record
//   canvas:deleted         — a Redis Set of shape IDs that have been removed
//
// This per-shape layout means concurrent saves from two users only overwrite
// the specific shapes they changed, not each other's shapes.

const SCHEMA_KEY = "canvas:schema";
const SHAPE_PREFIX = "canvas:shape:";
const DELETED_SET = "canvas:deleted";

export default async function handler(req: any, res: any) {
  // ── GET /api/sync-state?status=true  (diagnostics) ──────────────────────
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

  // ── GET /api/sync-state  (load full canvas) ──────────────────────────────
  // Returns { schema, shapes: Record<id, record>, deleted: string[] }
  // The client merges this into its local store rather than replacing it.
  if (req.method === "GET") {
    try {
      const client = await getRedisClient();
      if (!client) {
        return res.status(200).json({ status: "empty" });
      }

      // Fetch schema + all shape keys in parallel
      const [schemaStr, shapeKeys, deletedIds] = await Promise.all([
        client.get(SCHEMA_KEY),
        client.keys(SHAPE_PREFIX + "*"),
        client.sMembers(DELETED_SET),
      ]);

      if (!schemaStr && (!shapeKeys || shapeKeys.length === 0)) {
        return res.status(200).json({ status: "empty" });
      }

      const shapes: Record<string, any> = {};
      if (shapeKeys && shapeKeys.length > 0) {
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

  // ── POST /api/sync-state  (save changed shapes) ──────────────────────────
  // Body: { schema, upserted: Record<id, record>, deleted: string[] }
  // Only the changed shapes are written; other users' shapes are untouched.
  if (req.method === "POST") {
    try {
      const client = await getRedisClient();
      if (!client) {
        return res.status(200).json({ success: false, database: "none" });
      }

      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { schema, upserted, deleted } = body as {
        schema: any;
        upserted: Record<string, any>;
        deleted: string[];
      };

      const pipeline = client.multi();

      // Always keep schema up to date
      if (schema) {
        pipeline.set(SCHEMA_KEY, JSON.stringify(schema));
      }

      // Write only the shapes that changed
      if (upserted && typeof upserted === "object") {
        for (const [id, record] of Object.entries(upserted)) {
          pipeline.set(SHAPE_PREFIX + id, JSON.stringify(record));
          // Un-delete if it was previously removed
          pipeline.sRem(DELETED_SET, id);
        }
      }

      // Mark deleted shapes
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
