import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@vercel/kv";

// Helper to get a lazy-initialized Vercel KV client.
// This guarantees environment variables are read AFTER dotenv.config() has run, even with ES modules.
const getKvClient = () => {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    return createClient({ url, token });
  }
  return null;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Check if Vercel KV environment variables are configured
  const isKvConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

  if (isKvConfigured) {
    console.log("[Server] Vercel KV configuration detected! Using Vercel KV as primary database.");
  } else {
    console.warn("[Server] WARNING: Vercel KV not configured. Canvas state will not be persisted.");
  }

  // Use a large JSON body size limit since tldraw snapshots can contain many shapes
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API to fetch the shared communal canvas state or diagnostics
  app.get("/api/canvas-state", async (req, res) => {
    // Return connection diagnostics if requested
    if (req.query.status === "true") {
      let pingSuccess = false;
      let pingError = null;
      try {
        const client = getKvClient();
        await client.set("communal-canvas-ping", "ok");
        const val = await client.get("communal-canvas-ping");
        pingSuccess = val === "ok";
      } catch (err: any) {
        pingError = err.message || String(err);
      }
      
      return res.json({
        isKvConfigured,
        hasUrl: !!process.env.KV_REST_API_URL,
        hasToken: !!process.env.KV_REST_API_TOKEN,
        urlPrefix: process.env.KV_REST_API_URL ? process.env.KV_REST_API_URL.substring(0, 15) + "..." : null,
        pingSuccess,
        pingError,
        environment: "google-cloud-run",
      });
    }

    try {
      const client = getKvClient();
      if (!client) {
        return res.json({ status: "empty" });
      }
      const state = await client.get("canvas-state");
      res.json(state || { status: "empty" });
    } catch (error) {
      console.error("[Server] Error getting canvas state from Vercel KV:", error);
      res.status(500).json({ error: "Failed to read canvas state from KV" });
    }
  });

  // API to save the shared communal canvas state
  app.post("/api/canvas-state", async (req, res) => {
    try {
      const client = getKvClient();
      if (!client) {
        return res.json({ success: true, database: "none" });
      }
      await client.set("canvas-state", req.body);
      res.json({ success: true, database: "vercel-kv" });
    } catch (error) {
      console.error("[Server] Error saving canvas state:", error);
      res.status(500).json({ error: "Failed to persist canvas state" });
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
