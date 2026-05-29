import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLAN_DATA: Record<string, { title: string; price: number }> = {
  vitalicio: { title: 'DearMoment – Plano Vitalício', price: 29.90 },
  '24h':     { title: 'DearMoment – Plano 24 Horas',  price: 19.90 },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { plan, giftId, successUrl, failureUrl, pendingUrl } = await req.json();

    const now = new Date();
    const promoActive = now >= new Date('2026-06-07T00:00:00') && now <= new Date('2026-06-13T23:59:59');
    const discount = promoActive ? 0.8 : 1.0;

    const planData = PLAN_DATA[plan] || PLAN_DATA['vitalicio'];
    const unitPrice = Math.round(planData.price * discount * 100) / 100;

    const items: object[] = [{
      id: plan,
      title: planData.title + (promoActive ? ' – 20% OFF Dia dos Namorados' : ''),
      quantity: 1,
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
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Erro ao criar preferência no MercadoPago');
    }

    return new Response(JSON.stringify({
      init_point:         data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      preference_id:      data.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
