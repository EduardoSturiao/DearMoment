/* ================================================================
   MEUS PRESENTES — lógica de exibição
   Os presentes são lidos de localStorage['DearMoment_gifts'],
   um array de objetos salvos ao concluir o wizard.
================================================================ */

(function () {
  const GIFTS_KEY = 'DearMoment_gifts';

  function loadGifts() {
    try {
      const raw = localStorage.getItem(GIFTS_KEY);
      return raw ? JSON.parse(raw).filter(g => g.paid) : [];
    } catch (_) {
      return [];
    }
  }

  function renderEmpty() {
    document.getElementById('mp-empty').style.display = 'flex';
    document.getElementById('mp-grid').style.display = 'none';
  }

  function renderGifts(gifts) {
    document.getElementById('mp-empty').style.display = 'none';
    const grid = document.getElementById('mp-grid');
    grid.style.display = 'grid';

    grid.innerHTML = gifts.map((gift, index) => {
      const coverHtml = gift.photos && gift.photos[0]
        ? `<div class="mp-card-cover"><img src="${gift.photos[0]}" alt="Foto do casal"></div>`
        : `<div class="mp-card-cover-placeholder"><i class="fa-regular fa-images"></i></div>`;

      const names = gift.name1 && gift.name2
        ? `${gift.name1} & ${gift.name2}`
        : gift.name1 || 'Homenagem sem título';

      const date = gift.startDate
        ? `Desde ${new Date(gift.startDate).toLocaleDateString('pt-BR')}`
        : '';

      const plan = gift.plan === 'vitalicio' ? 'Vitalício' : '24 Horas';

      return `
        <a class="mp-card" href="./criar/index.html?gift=${index}">
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

  document.addEventListener('DOMContentLoaded', () => {
    const gifts = loadGifts();
    if (gifts.length === 0) {
      renderEmpty();
    } else {
      renderGifts(gifts);
    }
  });
})();
