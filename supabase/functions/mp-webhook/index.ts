import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifica a assinatura HMAC-SHA256 enviada pelo MercadoPago.
 * Usa a Web Crypto API nativa do Deno — sem dependências externas.
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
async function verifyMPSignature(req: Request, paymentId: string, secret: string): Promise<boolean> {
  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');

  if (!xSignature || !xRequestId) return false;

  const ts = xSignature.split(',').find(p => p.startsWith('ts='))?.split('=')[1];
  const v1 = xSignature.split(',').find(p => p.startsWith('v1='))?.split('=')[1];

  if (!ts || !v1) return false;

  const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(manifest));
  const expected  = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return expected === v1;
}

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

    // ── 1. Verificar assinatura do MercadoPago ────────────────────
    const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET');
    if (webhookSecret) {
      if (!await verifyMPSignature(req, String(paymentId), webhookSecret)) {
        console.warn('Webhook: assinatura inválida', { paymentId });
        return new Response('invalid signature', { status: 401 });
      }
    } else {
      // Em desenvolvimento sem secret configurado: logar aviso mas continuar
      console.warn('MP_WEBHOOK_SECRET não configurado — verificação de assinatura desabilitada');
    }

    // ── 2. Buscar detalhes do pagamento na API do MercadoPago ─────
    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const payment = await mpRes.json();

    if (payment.status !== 'approved') {
      return new Response('payment not approved', { status: 200 });
    }

    // ── 3. Validar external_reference ────────────────────────────
    const giftId = payment.external_reference;
    if (!giftId || !UUID_RE.test(giftId)) {
      console.warn('Webhook: external_reference inválido', { giftId });
      return new Response('invalid external_reference', { status: 400 });
    }

    // ── 4. Marcar presente como pago (service role — bypassa RLS) ─
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: giftData } = await db
      .from('gifts')
      .select('user_id')
      .eq('id', giftId)
      .single();

    const { error } = await db
      .from('gifts')
      .update({ paid: true })
      .eq('id', giftId);

    if (error) throw error;

    await db.from('audit_log').insert({
      action:   'gift_paid',
      user_id:  giftData?.user_id ?? null,
      gift_id:  giftId,
      metadata: { payment_id: String(paymentId) },
    });

    return new Response('ok', { status: 200 });

  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('error', { status: 500 });
  }
});
