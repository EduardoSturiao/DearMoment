import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const ALLOWED_ORIGINS: string[] = (
  Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('ALLOWED_ORIGIN') ?? 'https://soulmates-bice.vercel.app'
).split(',').map(s => s.trim()).filter(Boolean);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const url   = new URL(req.url);
  const query = (url.searchParams.get('q') ?? '').trim();

  if (!query) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=8`,
    );
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('music-search error:', err);
    return new Response(JSON.stringify({ error: 'Erro ao buscar músicas' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
