import Ably from "ably";

// Serverless endpoint that mints a short-lived Ably token for the browser.
// The secret API key never leaves the server; the browser gets a token that
// can only publish/subscribe — it cannot manage the account.
export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ABLY_API_KEY not configured" });
  }

  try {
    const rest = new Ably.Rest(apiKey);
    const clientId = req.query?.clientId || `anon-${Date.now()}`;
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: String(clientId),
      capability: {
        "scroll:shapes":  ["publish", "subscribe", "history"],
        "scroll:cursors": ["publish", "subscribe", "presence"],
      },
      ttl: 3_600_000, // 1 hour
    });
    return res.status(200).json(tokenRequest);
  } catch (err: any) {
    console.error("[ably-token] Error creating token request:", err);
    return res.status(500).json({ error: err.message });
  }
}
