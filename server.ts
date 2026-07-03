import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
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
    console.log("[Server] Vercel KV not configured. Falling back to local disk state.");
  }

  // Use a large JSON body size limit since tldraw snapshots can contain many shapes
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const STATE_FILE = path.join(process.cwd(), "canvas-state.json");
  let canvasState: any = null;

  // Load the initial canvas state from disk on startup if not using KV
  if (!isKvConfigured) {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const fileContent = fs.readFileSync(STATE_FILE, "utf-8");
        canvasState = JSON.parse(fileContent);
        console.log("[Server] Loaded existing communal canvas state from disk");
      }
    } catch (error) {
      console.error("[Server] Error loading canvas-state.json:", error);
    }
  }

  // API to fetch the shared communal canvas state or diagnostics
  app.get("/api/canvas-state", async (req, res) => {
    // Return connection diagnostics if requested
    if (req.query.status === "true") {
      const client = getKvClient();
      let pingSuccess = false;
      let pingError = null;
      if (client) {
        try {
          await client.set("communal-canvas-ping", "ok");
          const val = await client.get("communal-canvas-ping");
          pingSuccess = val === "ok";
        } catch (err: any) {
          pingError = err.message || String(err);
        }
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
      if (client) {
        const state = await client.get("canvas-state");
        res.json(state || { status: "empty" });
      } else {
        res.json(canvasState || { status: "empty" });
      }
    } catch (error) {
      console.error("[Server] Error getting canvas state from Vercel KV:", error);
      // Fallback to in-memory/disk if KV fails in runtime
      res.json(canvasState || { status: "empty" });
    }
  });

  // API to save the shared communal canvas state
  app.post("/api/canvas-state", async (req, res) => {
    try {
      const client = getKvClient();
      if (client) {
        await client.set("canvas-state", req.body);
        res.json({ success: true, database: "vercel-kv" });
      } else {
        canvasState = req.body;
        fs.writeFileSync(STATE_FILE, JSON.stringify(canvasState, null, 2), "utf-8");
        res.json({ success: true, database: "local-file" });
      }
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
