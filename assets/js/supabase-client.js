/* ================================================================
   CLIENTE SUPABASE COMPARTILHADO
   Carregar SEMPRE depois do SDK (@supabase/supabase-js) e antes
   dos scripts de página. Expõe window.sb (cliente único).
   A sessão é persistida automaticamente em localStorage pelo SDK,
   então o login feito em login.html vale em todas as páginas.
================================================================ */
(function () {
  const SUPABASE_URL  = 'https://imiwhgrjwgydedbfdlkn.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltaXdoZ3Jqd2d5ZGVkYmZkbGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjA5NjksImV4cCI6MjA5MDg5Njk2OX0.icJRjTMGsjOa_-Nff0QExYeDA5jqoAMh5DHR1drtxCA';

  window.SUPABASE_URL = SUPABASE_URL;
  window.sb = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON)
    : null;

  if (!window.sb) {
    console.error('[SoulMates] SDK do Supabase não carregou antes de supabase-client.js');
    return;
  }
})();
