/* ================================================================
   MEUS PRESENTES — lógica de exibição
<<<<<<< HEAD
   Os presentes são lidos de localStorage['DearMoment_gifts'],
   um array de objetos salvos ao concluir o wizard.
================================================================ */

(function () {
  const GIFTS_KEY = 'DearMoment_gifts';
=======
   Lê os presentes pagos da tabela `gifts` no Supabase, com as fotos
   embedadas via `gift_photos`. URLs públicas geradas pelo Storage.
================================================================ */

(function () {
  const SUPABASE_URL  = 'https://imiwhgrjwgydedbfdlkn.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltaXdoZ3Jqd2d5ZGVkYmZkbGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjA5NjksImV4cCI6MjA5MDg5Njk2OX0.icJRjTMGsjOa_-Nff0QExYeDA5jqoAMh5DHR1drtxCA';
  const BUCKET = 'gift-images';
>>>>>>> 06de5011a601ae9740bc3e7d0e5a7f66eb91b4a6

  const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON) : null;

  async function loadGifts() {
    if (!db) return [];

    // Exige login — só mostra os presentes do próprio usuário
    const { data: userData } = await db.auth.getUser();
    const user = userData && userData.user;
    if (!user) {
      window.location.href = './login.html';
      return [];
    }

    const { data, error } = await db
      .from('gifts')
      .select('id, name1, name2, start_date, plan, paid, gift_photos(storage_path, is_extra, position)')
      .eq('paid', true)
      .eq('user_id', user.id);

    if (error) {
      console.error('Erro ao buscar presentes:', error);
      return [];
    }

    return data.map(g => {
      const photos = Array.isArray(g.gift_photos) ? g.gift_photos : [];
      const cover  = photos.find(p => p.is_extra) ||
                     photos.slice().sort((a, b) => a.position - b.position)[0];
      const coverUrl = cover
        ? db.storage.from(BUCKET).getPublicUrl(cover.storage_path).data.publicUrl
        : null;
      return {
        id:         g.id,
        name1:      g.name1,
        name2:      g.name2,
        startDate:  g.start_date,
        plan:       g.plan,
        coverUrl,
      };
    });
  }

  function renderEmpty() {
    document.getElementById('mp-empty').style.display = 'flex';
    document.getElementById('mp-grid').style.display = 'none';
  }

  function renderGifts(gifts) {
    document.getElementById('mp-empty').style.display = 'none';
    const grid = document.getElementById('mp-grid');
    grid.style.display = 'grid';

    grid.innerHTML = gifts.map(gift => {
      const coverHtml = gift.coverUrl
        ? `<div class="mp-card-cover"><img src="${gift.coverUrl}" alt="Foto do casal"></div>`
        : `<div class="mp-card-cover-placeholder"><i class="fa-regular fa-images"></i></div>`;

      const names = gift.name1 && gift.name2
        ? `${gift.name1} & ${gift.name2}`
        : gift.name1 || 'Homenagem sem título';

      const date = gift.startDate
        ? `Desde ${new Date(gift.startDate).toLocaleDateString('pt-BR')}`
        : '';

      const plan = gift.plan === 'vitalicio' ? 'Vitalício' : '24 Horas';

      return `
        <a class="mp-card" href="./presente.html?id=${encodeURIComponent(gift.id)}">
          ${coverHtml}
          <div class="mp-card-body">
            <div class="mp-card-names">${names}</div>
            ${date ? `<div class="mp-card-date">${date}</div>` : ''}
            <div class="mp-card-plan">
              <span class="mp-card-plan-badge">Plano ${plan}</span>
              <i class="fa-solid fa-arrow-right mp-card-arrow"></i>
            </div>
          </div>
        </a>
      `;
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const gifts = await loadGifts();
    if (gifts.length === 0) {
      renderEmpty();
    } else {
      renderGifts(gifts);
    }
  });
})();
