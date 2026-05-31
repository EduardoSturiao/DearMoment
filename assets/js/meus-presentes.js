/* ================================================================
   MEUS PRESENTES — lógica de exibição e exclusão
   Lê os presentes pagos da tabela `gifts` no Supabase, com as fotos
   embedadas via `gift_photos`. URLs públicas geradas pelo Storage.
================================================================ */

(function () {
  const BUCKET = 'gift-images';

  // Usa o cliente Supabase compartilhado (inicializado em supabase-client.js)
  const db = window.sb;

  let giftsData = [];

  async function loadGifts() {
    if (!db) return [];

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
        id:        g.id,
        name1:     g.name1,
        name2:     g.name2,
        startDate: g.start_date,
        plan:      g.plan,
        coverUrl,
        allPaths:  photos.map(p => p.storage_path),
      };
    });
  }

  function renderEmpty() {
    document.getElementById('mp-empty').style.display = 'flex';
    document.getElementById('mp-grid').style.display = 'none';
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  function renderGifts(gifts) {
    document.getElementById('mp-empty').style.display = 'none';
    const grid = document.getElementById('mp-grid');
    grid.style.display = 'grid';

    grid.innerHTML = gifts.map(gift => {
      const safeId      = escHtml(gift.id);
      const safeCover   = gift.coverUrl ? escHtml(gift.coverUrl) : '';
      const coverHtml   = safeCover
        ? `<div class="mp-card-cover"><img src="${safeCover}" alt="Foto do casal"></div>`
        : `<div class="mp-card-cover-placeholder"><i class="fa-regular fa-images"></i></div>`;

      const names = gift.name1 && gift.name2
        ? `${escHtml(gift.name1)} &amp; ${escHtml(gift.name2)}`
        : escHtml(gift.name1 || 'Homenagem sem título');

      const date = gift.startDate
        ? `Desde ${new Date(gift.startDate).toLocaleDateString('pt-BR')}`
        : '';

      const plan = gift.plan === 'vitalicio' ? 'Vitalício' : '24 Horas';

      return `
        <div class="mp-card" data-id="${safeId}">
          <a class="mp-card-inner" href="./presente.html?id=${encodeURIComponent(gift.id)}">
            ${coverHtml}
            <div class="mp-card-body">
              <div class="mp-card-names">${names}</div>
              ${date ? `<div class="mp-card-date">${escHtml(date)}</div>` : ''}
              <div class="mp-card-plan">
                <span class="mp-card-plan-badge">Plano ${escHtml(plan)}</span>
                <i class="fa-solid fa-arrow-right mp-card-arrow"></i>
              </div>
            </div>
          </a>
          <button class="mp-card-delete" data-id="${safeId}" aria-label="Excluir presente" title="Excluir presente">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;
    }).join('');
  }

  async function deleteGift(giftId, allPaths, cardEl) {
    if (!confirm('Tem certeza que deseja excluir este presente? Esta ação não pode ser desfeita.')) return;

    cardEl.style.opacity = '0.4';
    cardEl.style.pointerEvents = 'none';

    try {
      if (allPaths.length > 0) {
        await db.storage.from(BUCKET).remove(allPaths);
      }

      await db.from('gift_photos').delete().eq('gift_id', giftId);

      const { error } = await db.from('gifts').delete().eq('id', giftId);
      if (error) throw error;

      cardEl.style.opacity = '0';
      setTimeout(() => {
        cardEl.remove();
        giftsData = giftsData.filter(g => g.id !== giftId);
        if (document.querySelectorAll('.mp-card').length === 0) {
          renderEmpty();
        }
      }, 300);

    } catch (err) {
      console.error('Erro ao excluir presente:', err);
      cardEl.style.opacity = '1';
      cardEl.style.pointerEvents = '';
      alert('Erro ao excluir o presente. Tente novamente.');
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    giftsData = await loadGifts();
    if (giftsData.length === 0) {
      renderEmpty();
    } else {
      renderGifts(giftsData);
    }

    document.getElementById('mp-grid').addEventListener('click', async (e) => {
      const btn = e.target.closest('.mp-card-delete');
      if (!btn) return;
      const giftId = btn.dataset.id;
      const gift   = giftsData.find(g => g.id === giftId);
      const cardEl = btn.closest('.mp-card');
      await deleteGift(giftId, gift ? gift.allPaths : [], cardEl);
    });
  });
})();
