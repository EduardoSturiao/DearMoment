import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://soulmates-bice.vercel.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Vary': 'Origin',
};

const PLAN_DATA: Record<string, { title: string; price: number }> = {
  vitalicio: { title: 'DearMoment – Plano Vitalício', price: 29.90 },
  '24h':     { title: 'DearMoment – Plano 24 Horas',  price: 19.90 },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === ALLOWED_ORIGIN;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── 1. Verificar JWT do Supabase ─────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { plan, giftId, successUrl, failureUrl, pendingUrl } = body;

    // ── 2. Validar inputs ────────────────────────────────────────
    if (!['vitalicio', '24h'].includes(plan)) {
      return new Response(JSON.stringify({ error: 'Plano inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!giftId || !UUID_RE.test(giftId)) {
      return new Response(JSON.stringify({ error: 'Gift ID inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const url of [successUrl, failureUrl, pendingUrl]) {
      if (url && !isAllowedUrl(url)) {
        return new Response(JSON.stringify({ error: 'URL de retorno inválida' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Calcular preço e criar preferência no MP ──────────────
    const now = new Date();
    const promoActive = now >= new Date('2026-06-07T00:00:00') && now <= new Date('2026-06-13T23:59:59');
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
      throw new Error('Erro ao criar preferência no MercadoPago');
    }

    return new Response(JSON.stringify({
      init_point:         data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      preference_id:      data.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('create-preference error:', err);
    return new Response(JSON.stringify({ error: 'Erro ao processar pagamento' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
