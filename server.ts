import dotenv from "dotenv";
dotenv.config();
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "redis";
import Ably from "ably";

let redisClient: any = null;
let isConnecting = false;

const getRedisClient = async () => {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }
  
  if (isConnecting) {
    // Basic spin wait while another connection is in progress
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
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
    client.on('error', (err) => console.log('Redis Client Error', err));
    await client.connect();
    redisClient = client;
    return redisClient;
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
    return null;
  } finally {
    isConnecting = false;
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Check if Redis environment variables are configured
  const isRedisConfigured = !!(process.env.REDIS_URL || process.env.KV_URL);
  if (isRedisConfigured) {
    console.log("[Server] Redis configuration detected! Using Redis as primary database.");
  } else {
    console.warn("[Server] WARNING: Redis not configured. Canvas state will not be persisted.");
  }

  // Use a large JSON body size limit since tldraw snapshots can contain many shapes
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API to fetch the shared communal canvas state or diagnostics
  app.get("/api/sync-state", async (req, res) => {
    // Return connection diagnostics if requested
    if (req.query.status === "true") {
      let pingSuccess = false;
      let pingError = null;
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
      
      return res.json({
        isKvConfigured: isRedisConfigured,
        hasUrl: !!process.env.KV_URL,
        hasToken: true,
        urlPrefix: process.env.KV_URL ? process.env.KV_URL.substring(0, 15) + "..." : null,
        pingSuccess,
        pingError,
        environment: "google-cloud-run",
      });
    }

    try {
      const client = await getRedisClient();
      if (!client) {
        return res.json({ status: "empty" });
      }
      const stateStr = await client.get("canvas-state") as string;
      if (stateStr) {
        const state = JSON.parse(stateStr);
        res.json(state);
      } else {
        res.json({ status: "empty" });
      }
    } catch (error: any) {
      console.error("[Server] Error getting canvas state from Redis:", error);
      res.json({ status: "empty", error: error.message });
    }
  });

  // API to save the shared communal canvas state
  app.post("/api/sync-state", async (req, res) => {
    try {
      const client = await getRedisClient();
      if (!client) {
        return res.json({ success: true, database: "none" });
      }
      // Vercel KV via rest api automatically parsed json, with node-redis we need to stringify
      await client.set("canvas-state", JSON.stringify(req.body));
      res.json({ success: true, database: "redis" });
    } catch (error: any) {
      console.error("[Server] Error saving canvas state:", error);
      res.json({ success: false, error: error.message });
    }
  });

  // API to mint Ably tokens for client-side realtime features
  app.all("/api/ably-token", async (req, res) => {
    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) {
      console.warn("[Server] ABLY_API_KEY is not configured.");
      return res.status(500).json({ error: "ABLY_API_KEY not configured" });
    }

    try {
      const rest = new Ably.Rest(apiKey);
      const clientId = req.query?.clientId || req.body?.clientId || `anon-${Date.now()}`;
      const tokenRequest = await rest.auth.createTokenRequest({
        clientId: String(clientId),
        capability: {
          "scroll:shapes":  ["publish", "subscribe", "history"],
          "scroll:cursors": ["publish", "subscribe", "presence"],
        },
        ttl: 3_600_000, // 1 hour
      });
      res.json(tokenRequest);
    } catch (err: any) {
      console.error("[Server] Error creating Ably token request:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[Server] Started Vite development middleware");
  } else {
    // Serve production build static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("[Server] Serving production static files from dist/");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Scriptorium Server running on http://localhost:${PORT}`);
  });
}

startServer();
