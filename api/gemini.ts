import type { VercelRequest, VercelResponse } from "@vercel/node";

const KEYS = [
  process.env.VITE_GEMINI_API_KEY_1,
  process.env.VITE_GEMINI_API_KEY_2,
  process.env.VITE_GEMINI_API_KEY_3,
  process.env.VITE_GEMINI_API_KEY_4,
  process.env.VITE_GEMINI_API_KEY_5,
  process.env.VITE_GEMINI_API_KEY,
].filter(Boolean) as string[];

let keyIndex = 0;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (KEYS.length === 0) return res.status(500).json({ error: "No API keys configured" });

  const body = req.body;
  let lastError = "";

  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[(keyIndex + i) % KEYS.length];
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await response.json();
      if (!data.error) {
        keyIndex = (keyIndex + i + 1) % KEYS.length;
        return res.status(200).json(data);
      }
      lastError = data.error?.message || "Unknown error";
      const is429 =
        lastError.includes("429") ||
        lastError.includes("RESOURCE_EXHAUSTED") ||
        lastError.includes("quota");
      if (!is429) return res.status(200).json(data);
    } catch (e: any) {
      lastError = e.message;
    }
  }
  return res.status(429).json({ error: { message: lastError } });
}