import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const body = await req.json();

    // MP envia vários tipos de notificação; só nos interessa 'payment'
    if (body.type !== 'payment') {
      return new Response('ok', { status: 200 });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return new Response('no payment id', { status: 400 });
    }

    // Busca detalhes do pagamento na API do MercadoPago
    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const payment = await mpRes.json();

    if (payment.status !== 'approved') {
      return new Response('payment not approved', { status: 200 });
    }

    const giftId = payment.external_reference;
    if (!giftId) {
      return new Response('no external_reference', { status: 400 });
    }

    // Atualiza o presente como pago usando a service role key (disponível automaticamente)
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error } = await db
      .from('gifts')
      .update({ paid: true })
      .eq('id', giftId);

    if (error) throw error;

    return new Response('ok', { status: 200 });

  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('error', { status: 500 });
  }
});
