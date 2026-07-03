import dotenv from "dotenv";
dotenv.config();

import { kv } from "@vercel/kv";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4.5mb",
    },
  },
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
    try {
      if (isKvConfigured) {
        const state = await kv.get("canvas-state");
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
      if (isKvConfigured) {
        await kv.set("canvas-state", req.body);
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
