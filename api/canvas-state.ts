import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@vercel/kv";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4.5mb",
    },
  },
};

// Lazy/dynamic client instantiation to prevent load-time dependency on process.env
const getKvClient = () => {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    return createClient({ url, token });
  }
  return null;
};

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const isKvConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

  if (req.method === "GET") {
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
      return res.status(200).json({
        isKvConfigured,
        hasUrl: !!process.env.KV_REST_API_URL,
        hasToken: !!process.env.KV_REST_API_TOKEN,
        urlPrefix: process.env.KV_REST_API_URL ? process.env.KV_REST_API_URL.substring(0, 15) + "..." : null,
        pingSuccess,
        pingError,
        environment: "vercel",
      });
    }

    try {
      const client = getKvClient();
      if (client) {
        const state = await client.get("canvas-state");
        return res.status(200).json(state || { status: "empty" });
      } else {
        return res.status(200).json({
          status: "empty",
          error: "Vercel KV is not configured on this Vercel deployment.",
        });
      }
    } catch (error: any) {
      console.error("Vercel KV Get Error:", error);
      return res.status(500).json({ error: error.message || "Failed to load canvas state" });
    }
  }

  if (req.method === "POST") {
    try {
      const client = getKvClient();
      if (client) {
        await client.set("canvas-state", req.body);
        return res.status(200).json({ success: true, database: "vercel-kv" });
      } else {
        return res.status(200).json({
          error: "Vercel KV is not configured on this Vercel deployment.",
        });
      }
    } catch (error: any) {
      console.error("Vercel KV Set Error:", error);
      return res.status(500).json({ error: error.message || "Failed to save canvas state" });
    }
  }

  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
