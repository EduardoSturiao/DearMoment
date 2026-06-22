/* ================================================================
   CLIENTE SUPABASE COMPARTILHADO
   Carregar SEMPRE depois do SDK (@supabase/supabase-js) e antes
   dos scripts de página. Expõe window.sb (cliente único).
   A sessão é persistida automaticamente em localStorage pelo SDK,
   então o login feito em login.html vale em todas as páginas.
================================================================ */
(function () {
  const SUPABASE_URL  = 'https://iudhvwqjqhotdojairek.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZGh2d3FqcWhvdGRvamFpcmVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Mzc2MzUsImV4cCI6MjA5NzExMzYzNX0.6AcPJnC8uopxl8uSgt5DY_L00h-xS4yc98EuE5b5y4w';

  window.sb = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON)
    : null;

  if (!window.sb) {
    console.error('[SoulMates] SDK do Supabase não carregou antes de supabase-client.js');
    return;
  }

  /* Auto-salva presente pendente após confirmação de e-mail */
  window.sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      const pendingId = localStorage.getItem('DearMoment_pending_gift_save');
      if (pendingId) {
        localStorage.removeItem('DearMoment_pending_gift_save');
        await window.sb.from('saved_gifts').insert({
          user_id: session.user.id,
          gift_id: pendingId,
        });
      }
    }
  });
})();
