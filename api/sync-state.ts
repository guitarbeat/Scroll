import { createClient } from "redis";

// Reuse the Redis connection across warm serverless invocations.
let redisClient: any = null;
let isConnecting = false;

const getRedisClient = async () => {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  if (isConnecting) {
    // Basic spin wait while another invocation is establishing the connection
    while (isConnecting) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return redisClient;
  }

  const url = process.env.KV_URL;
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

const isRedisConfigured = () => !!process.env.KV_URL;

// Vercel Node.js Serverless Function.
// Handles GET (load state / diagnostics) and POST (save state) for /api/sync-state.
export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    // Return connection diagnostics if requested
    if (req.query && req.query.status === "true") {
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
        hasUrl: !!process.env.KV_URL,
        urlPrefix: process.env.KV_URL
          ? process.env.KV_URL.substring(0, 15) + "..."
          : null,
        pingSuccess,
        pingError,
        environment: "vercel",
      });
    }

    try {
      const client = await getRedisClient();
      if (!client) {
        return res.status(200).json({ status: "empty" });
      }
      const stateStr = (await client.get("canvas-state")) as string;
      if (stateStr) {
        const state = JSON.parse(stateStr);
        return res.status(200).json(state);
      }
      return res.status(200).json({ status: "empty" });
    } catch (error: any) {
      console.error("[api/sync-state] Error getting canvas state from Redis:", error);
      return res.status(200).json({ status: "empty", error: error.message });
    }
  }

  if (req.method === "POST") {
    try {
      const client = await getRedisClient();
      if (!client) {
        return res.status(200).json({ success: false, database: "none" });
      }
      // Vercel parses JSON request bodies automatically; stringify for node-redis.
      const body =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      await client.set("canvas-state", body);
      return res.status(200).json({ success: true, database: "redis" });
    } catch (error: any) {
      console.error("[api/sync-state] Error saving canvas state:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method Not Allowed" });
}
