export const config = {
  runtime: 'edge',
};

const KEYS = [
  process.env.VITE_GEMINI_API_KEY_1,
  process.env.VITE_GEMINI_API_KEY_2,
  process.env.VITE_GEMINI_API_KEY_3,
  process.env.VITE_GEMINI_API_KEY_4,
  process.env.VITE_GEMINI_API_KEY_5,
  process.env.VITE_GEMINI_API_KEY,
].filter(Boolean) as string[];

let keyIndex = 0;

export default async function handler(req: Request): Promise<Response> {
  // CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (KEYS.length === 0) {
    return new Response(JSON.stringify({ error: { message: 'No API keys configured' } }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.text();
  let lastError = 'Unknown error';

  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[(keyIndex + i) % KEYS.length];
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }
      );
      const data = await response.json();
      if (!data.error) {
        keyIndex = (keyIndex + i + 1) % KEYS.length;
        return new Response(JSON.stringify(data), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      lastError = data.error?.message || 'Unknown error';
      const is429 =
        lastError.includes('429') ||
        lastError.includes('RESOURCE_EXHAUSTED') ||
        lastError.includes('quota');
      if (!is429) {
        return new Response(JSON.stringify(data), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (e: any) {
      lastError = e?.message || 'Fetch failed';
    }
  }

  return new Response(
    JSON.stringify({ error: { message: lastError } }),
    { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
