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
//   canvas:schema          — tldraw schema (one per canvas)
//   canvas:shape:<id>      — one key per shape / asset record
//   canvas:deleted         — Redis Set of deleted shape IDs
//   canvas:cursor:<sid>    — cursor position for a session (30 s TTL)
// ---------------------------------------------------------------------------
const SCHEMA_KEY   = "canvas:schema";
const SHAPE_PREFIX = "canvas:shape:";
const DELETED_SET  = "canvas:deleted";
const CURSOR_PREFIX = "canvas:cursor:";
const CURSOR_TTL    = 30; // seconds

const isRedisConfigured = () => !!(process.env.REDIS_URL || process.env.KV_URL);

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

  // ── GET /api/sync-state  (load shapes + cursors) ──────────────────────────
  if (req.method === "GET") {
    try {
      const client = await getRedisClient();
      if (!client) return res.status(200).json({ status: "empty" });

      const [schemaStr, shapeKeys, deletedIds, cursorKeys] = await Promise.all([
        client.get(SCHEMA_KEY),
        client.keys(SHAPE_PREFIX + "*"),
        client.sMembers(DELETED_SET),
        client.keys(CURSOR_PREFIX + "*"),
      ]);

      // shapes
      const shapes: Record<string, any> = {};
      if (shapeKeys && shapeKeys.length > 0) {
        const values: (string | null)[] = await client.mGet(shapeKeys);
        for (let i = 0; i < shapeKeys.length; i++) {
          const v = values[i];
          if (v) {
            try {
              const id = (shapeKeys[i] as string).slice(SHAPE_PREFIX.length);
              shapes[id] = JSON.parse(v);
            } catch (_) {}
          }
        }
      }

      // cursors
      const cursors: Record<string, any> = {};
      if (cursorKeys && cursorKeys.length > 0) {
        const vals: (string | null)[] = await client.mGet(cursorKeys);
        for (let i = 0; i < cursorKeys.length; i++) {
          const v = vals[i];
          if (v) {
            try {
              const sid = (cursorKeys[i] as string).slice(CURSOR_PREFIX.length);
              cursors[sid] = JSON.parse(v);
            } catch (_) {}
          }
        }
      }

      if (!schemaStr && Object.keys(shapes).length === 0) {
        return res.status(200).json({ status: "empty", cursors });
      }

      return res.status(200).json({
        schema: schemaStr ? JSON.parse(schemaStr) : null,
        shapes,
        deleted: deletedIds || [],
        cursors,
      });
    } catch (error: any) {
      console.error("[api/sync-state] GET error:", error);
      return res.status(200).json({ status: "empty", error: error.message });
    }
  }

  // ── POST /api/sync-state  (save shape diffs + cursor) ────────────────────
  if (req.method === "POST") {
    try {
      const client = await getRedisClient();
      if (!client) return res.status(200).json({ success: false, database: "none" });

      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const {
        schema,
        upserted,
        deleted,
        cursor, // { sessionId, x, y, color, tool }  — optional
      } = body as {
        schema?: any;
        upserted?: Record<string, any>;
        deleted?: string[];
        cursor?: { sessionId: string; x: number; y: number; color: string; tool: string };
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

      // Store cursor with a TTL so stale cursors auto-expire
      if (cursor && cursor.sessionId) {
        const key = CURSOR_PREFIX + cursor.sessionId;
        pipeline.set(key, JSON.stringify({
          x: cursor.x,
          y: cursor.y,
          color: cursor.color,
          tool: cursor.tool,
          ts: Date.now(),
        }));
        pipeline.expire(key, CURSOR_TTL);
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
