import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Busca pública — dados da Apple sem credenciais, CORS aberto é seguro aqui
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const url   = new URL(req.url);
  const query = (url.searchParams.get('q') ?? '').trim();

  if (!query) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=8`,
    );
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('music-search error:', err);
    return new Response(JSON.stringify({ error: 'Erro ao buscar músicas' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
