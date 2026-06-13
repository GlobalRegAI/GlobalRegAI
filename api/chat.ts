export const config = { runtime: 'edge' };

const GROQ_KEYS = [
  process.env.VITE_GROQ_API_KEY_1,
  process.env.VITE_GROQ_API_KEY_2,
  process.env.VITE_GROQ_API_KEY_3,
  process.env.VITE_GROQ_API_KEY,
].filter(Boolean) as string[];

let keyIdx = 0;

export default async function handler(req: Request): Promise<Response> {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  if (GROQ_KEYS.length === 0) return new Response(
    JSON.stringify({ error: 'No API keys configured' }),
    { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
  );

  const { messages, system } = await req.json();

  let lastError = '';
  for (let i = 0; i < GROQ_KEYS.length; i++) {
    const key = GROQ_KEYS[(keyIdx + i) % GROQ_KEYS.length];
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: system },
            ...messages,
          ],
          max_tokens: 2048,
          temperature: 0.2,
        }),
      });

      const data = await res.json();

      if (data.choices?.[0]?.message?.content) {
        keyIdx = (keyIdx + i + 1) % GROQ_KEYS.length;
        return new Response(
          JSON.stringify({ reply: data.choices[0].message.content }),
          { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      lastError = data.error?.message || 'No content';
      const is429 = res.status === 429 || lastError.includes('rate') || lastError.includes('limit');
      if (!is429) break;

    } catch (e: any) {
      lastError = e?.message || 'Fetch error';
    }
  }

  return new Response(
    JSON.stringify({ error: lastError }),
    { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
  );
}
