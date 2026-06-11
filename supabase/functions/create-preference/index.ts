import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Suporta múltiplos domínios via ALLOWED_ORIGINS (separados por vírgula)
// Fallback para ALLOWED_ORIGIN por retrocompatibilidade
const ALLOWED_ORIGINS: string[] = (
  Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('ALLOWED_ORIGIN') ?? 'https://soulmates-bice.vercel.app'
).split(',').map(s => s.trim()).filter(Boolean);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

const PLAN_DATA: Record<string, { title: string; price: number }> = {
  vitalicio: { title: 'DearMoment – Plano Vitalício', price: 29.90 },
  '24h':     { title: 'DearMoment – Plano 24 Horas',  price: 19.90 },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_ORIGINS.includes(parsed.origin);
  } catch {
    return false;
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  // ── 1. Verificar JWT do Supabase ─────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { plan, giftId, successUrl, failureUrl, pendingUrl } = body;

    // ── 2. Validar inputs ────────────────────────────────────────
    if (!['vitalicio', '24h'].includes(plan)) {
      return new Response(JSON.stringify({ error: 'Plano inválido' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!giftId || !UUID_RE.test(giftId)) {
      return new Response(JSON.stringify({ error: 'Gift ID inválido' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    for (const url of [successUrl, failureUrl, pendingUrl]) {
      if (url && !isAllowedUrl(url)) {
        console.error('URL de retorno inválida:', url, '| origens permitidas:', ALLOWED_ORIGINS);
        return new Response(JSON.stringify({ error: 'URL de retorno inválida' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── 3. Confirmar que o gift pertence ao usuário autenticado ──
    const { data: gift, error: giftErr } = await db
      .from('gifts')
      .select('id')
      .eq('id', giftId)
      .eq('user_id', user.id)
      .single();

    if (giftErr || !gift) {
      return new Response(JSON.stringify({ error: 'Presente não encontrado' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Calcular preço e criar preferência no MP ──────────────
    const now = new Date();
    const promoActive = now >= new Date('2026-06-01T00:00:00') && now <= new Date('2026-06-30T23:59:59');
    const discount    = promoActive ? 0.8 : 1.0;

    const planData  = PLAN_DATA[plan];
    const unitPrice = Math.round(planData.price * discount * 100) / 100;

    const items: object[] = [{
      id:         plan,
      title:      planData.title + (promoActive ? ' – 20% OFF Dia dos Namorados' : ''),
      quantity:   1,
      unit_price: unitPrice,
      currency_id: 'BRL',
    }];

    const preference = {
      items,
      external_reference: giftId,
      auto_return: 'approved',
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      notification_url: `https://imiwhgrjwgydedbfdlkn.supabase.co/functions/v1/mp-webhook`,
    };

    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(preference),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('MercadoPago preference error:', JSON.stringify(data));
      throw new Error('Erro ao criar preferência no MercadoPago');
    }

    return new Response(JSON.stringify({
      init_point:         data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      preference_id:      data.id,
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('create-preference error:', err);
    return new Response(JSON.stringify({ error: 'Erro ao processar pagamento' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
