import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use a large JSON body size limit since tldraw snapshots can contain many shapes
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const STATE_FILE = path.join(process.cwd(), "canvas-state.json");
  let canvasState: any = null;

  // Load the initial canvas state from disk on startup
  try {
    if (fs.existsSync(STATE_FILE)) {
      const fileContent = fs.readFileSync(STATE_FILE, "utf-8");
      canvasState = JSON.parse(fileContent);
      console.log("[Server] Loaded existing communal canvas state from disk");
    }
  } catch (error) {
    console.error("[Server] Error loading canvas-state.json:", error);
  }

  // API to fetch the shared communal canvas state
  app.get("/api/canvas-state", (req, res) => {
    res.json(canvasState || { status: "empty" });
  });

  // API to save the shared communal canvas state
  app.post("/api/canvas-state", (req, res) => {
    try {
      canvasState = req.body;
      fs.writeFileSync(STATE_FILE, JSON.stringify(canvasState, null, 2), "utf-8");
      res.json({ success: true });
    } catch (error) {
      console.error("[Server] Error writing canvas-state.json:", error);
      res.status(500).json({ error: "Failed to persist canvas state to disk" });
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
