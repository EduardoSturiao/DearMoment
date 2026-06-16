# DearMoment

Personalized digital gifts delivered via link or QR Code — built for the Brazilian market.

**Demo →** [soulmates-bice.vercel.app](https://soulmates-bice.vercel.app)

---

The user fills out a wizard: couple name, a song from iTunes, photos, a message, and picks a plan. At the end they get a unique link that opens an animated gift experience with everything they added.

Stack: vanilla HTML/CSS/JS (no framework, no build tool), Supabase for auth, database and file storage, MercadoPago Checkout Pro for payments, Edge Functions in Deno for the server-side logic, hosted on Vercel.

```
index.html              landing page
criar/                  gift creation wizard
pagamento.html          order summary + redirect to MercadoPago
presente.html           gift viewing page
meus-presentes.html     user dashboard
supabase/functions/     edge functions (payment preference, webhook)
```

A few things worth noting: the wizard state lives entirely in `localStorage` so nothing is lost between steps. Users who reach checkout without an account get an inline login/signup — no redirect, no lost state, OTP confirmation via email. The frontend never writes `paid = true`; that only happens after MercadoPago's webhook hits the edge function with a valid signature.

---

To run locally, just `npx serve .` or open any `.html` directly in the browser.

Secrets (`MP_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `MP_WEBHOOK_SECRET`) live in Supabase's secret manager and are never in the repo. The anon key in `supabase-client.js` is public by design — access control is done through RLS policies on the database.
