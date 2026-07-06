import dotenv from "dotenv";
dotenv.config();
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Ably from "ably";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use a large JSON body size limit since tldraw snapshots can contain many shapes
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API to fetch diagnostic info about state syncing
  app.get("/api/sync-state", (req, res) => {
    res.json({
      status: "empty",
      info: "State synchronization is managed completely client-to-client via Ably History.",
      isKvConfigured: false,
    });
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
