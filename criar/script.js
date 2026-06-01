/* ================================================================
   DearMoment — GIFT CREATOR WIZARD
   script.js
   Arquitetura: estado global → localStorage → formulário multi-etapa
================================================================ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   1. ESTADO GLOBAL
═══════════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'DearMoment_wizard_state';
const TOTAL_STEPS = 9;
const FLOW_VERSION = 2;
const DEFAULT_PREVIEW_DURATION_SECONDS = 30;

const TEMPLATE_META = {
  stories: { label: 'Stories do Instagram', finalUrl: '../presente/index.html' },
  spotify: { label: 'Spotify',              finalUrl: '../presente.html' }
};

const state = {
  flowVersion:     FLOW_VERSION,
  currentStep:     1,
  giftType:        'amoroso',
  selectedTemplate: '',
  name1:           '',
  name2:           '',
  startDate:       '',
  city:            '',
  title:           '',
  youtubeId:       '',
  youtubeQuery:    '',
  previewUrl:      '',
  musicDuration:   0,
  songName:        '',
  artistName:      '',
  photos:          [],
  photoCaptions:   [],
  message:         '',
  capsulas:        ['', '', '', ''],
  extraPhoto:      null,
  selectedPlan:    '',
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) Object.assign(state, JSON.parse(saved));
    migrateLegacyWizardState();
  } catch (_) {}
}

function migrateLegacyWizardState() {
  const savedVersion = Number(state.flowVersion) || 0;
  const currentStep  = Number(state.currentStep) || 1;

  if (savedVersion < FLOW_VERSION) {
    if (TEMPLATE_META[state.selectedTemplate]) {
      const stepMap = { 1:1, 2:9, 3:2, 4:3, 5:4, 6:5, 7:6, 8:7, 9:8, 10:10 };
      state.currentStep = stepMap[currentStep] || currentStep;
    } else {
      state.currentStep    = currentStep;
      state.selectedTemplate = '';
    }
  }

  state.flowVersion  = FLOW_VERSION;
  state.currentStep  = Math.min(Math.max(Number(state.currentStep) || 1, 1), TOTAL_STEPS + 1);
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

/* ═══════════════════════════════════════════════════════════════
   2. DADOS — Cidades (API IBGE) e frases aleatórias
═══════════════════════════════════════════════════════════════ */
let CIDADES = [];

async function loadCidades() {
  const input = document.getElementById('cityInput');
  if (input) input.placeholder = 'Carregando cidades...';
  try {
    const res  = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
    const data = await res.json();
    CIDADES = data.map(m => `${m.nome}, ${m.microrregiao.mesorregiao.UF.sigla}`);
  } catch (_) {
    CIDADES = [
      'São Paulo, SP','Rio de Janeiro, RJ','Brasília, DF','Salvador, BA','Fortaleza, CE',
      'Belo Horizonte, MG','Manaus, AM','Curitiba, PR','Recife, PE','Porto Alegre, RS',
      'Belém, PA','Goiânia, GO','Florianópolis, SC','Natal, RN','João Pessoa, PB',
      'Maceió, AL','Aracaju, SE','Teresina, PI','Campo Grande, MS','Cuiabá, MT',
      'Porto Velho, RO','Macapá, AP','Rio Branco, AC','Palmas, TO','Vitória, ES',
    ];
  } finally {
    if (input) input.placeholder = 'Digite uma cidade...';
  }
}

const TITULOS_ALEATORIOS = [
  'Nossa história de amor 💘',
  'Para sempre ao seu lado 💞',
  'O dia em que te encontrei 😍',
  'Dois corações, uma história ❤️‍🔥',
  'Você é o meu lar 💝',
  'Juntos contra o mundo 😍',
  'Uma vida, um amor 💌',
  'Tudo que preciso é você  ❤️‍🔥',
  'Escritos no destino 💞',
  'Amor que não tem fim 🥰',
  'Nossa aventura juntos 💘',
  'A história que ainda estamos escrevendo 💌',
];

const MENSAGENS_ALEATORIAS = [
  'Desde o dia em que você entrou na minha vida, tudo ficou mais colorido. Obrigado(a) por ser meu maior presente.',
  'Você é a pessoa com quem quero compartilhar cada momento, cada conquista e cada derrota. Te amo mais do que as palavras conseguem expressar.',
  'Cada dia ao seu lado é um lembrete de que o amor de verdade existe. Você é minha paz, minha alegria e meu lar.',
  'Não importa o que o futuro reserve, sei que enquanto você estiver ao meu lado, tudo ficará bem. Você é minha certeza.',
  'Há momentos na vida que a gente guarda pra sempre. Conhecer você foi um desses momentos. E eu não mudaria nada.',
  'Você chegou na minha vida de mansinho e transformou tudo. Obrigado(a) por existir e por escolher estar ao meu lado.',
  'Nossa história é a minha favorita. E a melhor parte é que ela ainda está sendo escrita. Te amo hoje, amanhã e sempre.',
  'Com você aprendi que amar não é difícil quando a pessoa certa está do seu lado. Você me faz querer ser melhor todos os dias.',
];

/* ═══════════════════════════════════════════════════════════════
   3. UTILIDADES
═══════════════════════════════════════════════════════════════ */
function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeStr(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ═══════════════════════════════════════════════════════════════
   4. CONTADOR EM TEMPO REAL (step 3)
═══════════════════════════════════════════════════════════════ */
let counterInterval = null;

function calcTimeSince(dateStr) {
  const start = new Date(dateStr + 'T00:00:00');
  const now   = new Date();
  if (isNaN(start) || start > now) return null;

  let years  = now.getFullYear() - start.getFullYear();
  let months = now.getMonth()    - start.getMonth();
  let days   = now.getDate()     - start.getDate();

  if (days   < 0) { months--; days   += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (months < 0) { years--;  months += 12; }

  const totalMs = now - start;
  const hours   = Math.floor((totalMs / 3600000) % 24);
  const minutes = Math.floor((totalMs / 60000)   % 60);
  const seconds = Math.floor((totalMs / 1000)    % 60);

  return { years, months, days, hours, minutes, seconds };
}

function startCounter(dateStr) {
  stopCounter();
  if (!dateStr) return;

  function tick() {
    const t = calcTimeSince(dateStr);
    if (!t) return;
    setTextSafe('cYears',   t.years);
    setTextSafe('cMonths',  t.months);
    setTextSafe('cDays',    t.days);
    setTextSafe('cHours',   t.hours);
    setTextSafe('cMinutes', t.minutes);
    setTextSafe('cSeconds', t.seconds);
  }

  tick();
  counterInterval = setInterval(tick, 1000);
}

function stopCounter() {
  if (counterInterval) { clearInterval(counterInterval); counterInterval = null; }
}

function setTextSafe(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ═══════════════════════════════════════════════════════════════
   5. NAVEGAÇÃO ENTRE ETAPAS
═══════════════════════════════════════════════════════════════ */
function stepId(n) {
  return n <= TOTAL_STEPS ? `step-${n}` : 'step-final';
}

function hideAllSteps() {
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
}

function showStep(n) {
  hideAllSteps();
  const el = document.getElementById(stepId(n));
  if (el) el.classList.add('active');

  updateProgress(n);
  updateNavButtons(n);
  saveState();

  if (n === 3 && state.startDate) startCounter(state.startDate);
  else if (n !== 3) stopCounter();

  const navFooter = document.getElementById('navFooter');
  const isFinal   = n > TOTAL_STEPS;
  if (n === 1) {
    navFooter.style.display = 'none';
  } else {
    navFooter.style.display = '';
    navFooter.classList.remove('hidden-final');
    document.getElementById('btnNext').style.display = isFinal ? 'none' : '';
  }
}

function updateProgress(n) {
  const pct = n <= 1 ? 0 : Math.min((n - 2) / (TOTAL_STEPS - 1) * 100, 100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('stepLabel').textContent =
    n === 1 ? '' : n <= TOTAL_STEPS ? `${n - 1} / ${TOTAL_STEPS - 1}` : '✓ Concluído';
}

function updateNavButtons(n) {
  const btnNext = document.getElementById('btnNext');
  btnNext.textContent = (n === TOTAL_STEPS) ? 'Ver resultado 🎉' : 'Continuar →';
}

function validateStep(n) {
  switch (n) {
    case 2:
      if (!state.name1.trim()) { showToast('Digite o seu nome'); return false; }
      if (!state.name2.trim()) { showToast('Digite o nome do parceiro(a)'); return false; }
      break;
    case 3:
      if (!state.startDate)   { showToast('Informe a data de início'); return false; }
      if (!state.city.trim()) { showToast('Informe a cidade'); return false; }
      break;
    case 4:
      if (!state.title.trim()) { showToast('Adicione um título'); return false; }
      break;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   6. TEMPLATE HELPERS
═══════════════════════════════════════════════════════════════ */
function getFinalTemplate() {
  return TEMPLATE_META[state.selectedTemplate] ? state.selectedTemplate : 'spotify';
}

function getTemplateMeta(templateId = getFinalTemplate()) {
  return TEMPLATE_META[templateId] || TEMPLATE_META.spotify;
}

async function openFinalGift(planId) {
  state.selectedPlan = planId;
  saveState();
  localStorage.setItem('DearMoment_pending_plan', planId);

  // Checa sessão real do Supabase: logado vai pro pagamento, senão pro login
  let loggedIn = false;
  if (window.sb) {
    const { data } = await window.sb.auth.getSession();
    loggedIn = !!(data && data.session);
  }

  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.4s ease';
  setTimeout(() => {
    window.location.href = loggedIn ? '../pagamento.html' : '../login.html';
  }, 400);
}

/* Stub — mantido para não quebrar chamadas em bindInputs/setupAutocomplete/etc. */
function updatePreview() {
  if (state.startDate) startCounter(state.startDate);
}

/* ═══════════════════════════════════════════════════════════════
   7. AUTOCOMPLETE DE CIDADES
═══════════════════════════════════════════════════════════════ */
function setupAutocomplete() {
  const input    = document.getElementById('cityInput');
  const list     = document.getElementById('autocompleteList');
  let highlighted = -1;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    list.innerHTML = '';
    highlighted = -1;

    if (q.length < 2) { list.classList.add('hidden'); return; }

    const qNorm   = normalizeStr(q);
    const matches = CIDADES.filter(c => normalizeStr(c).includes(qNorm)).slice(0, 8);
    if (!matches.length) { list.classList.add('hidden'); return; }

    matches.forEach(city => {
      const li = document.createElement('li');
      li.textContent = city;
      li.addEventListener('mousedown', e => { e.preventDefault(); selectCity(city); });
      list.appendChild(li);
    });

    list.classList.remove('hidden');
  });

  input.addEventListener('keydown', e => {
    const items = list.querySelectorAll('li');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlighted = Math.min(highlighted + 1, items.length - 1);
      updateHighlight(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
      updateHighlight(items);
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      selectCity(items[highlighted].textContent);
    } else if (e.key === 'Escape') {
      list.classList.add('hidden');
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => list.classList.add('hidden'), 200);
    if (input.value.trim()) {
      state.city = input.value.trim();
      saveState();
      updatePreview();
    }
  });

  function selectCity(city) {
    input.value = city;
    state.city  = city;
    list.classList.add('hidden');
    saveState();
    updatePreview();
  }

  function updateHighlight(items) {
    items.forEach((li, i) => li.classList.toggle('highlighted', i === highlighted));
  }

  if (state.city) input.value = state.city;
}

/* ═══════════════════════════════════════════════════════════════
   8. UPLOAD DE FOTOS (Etapa 6)
═══════════════════════════════════════════════════════════════ */
function setupPhotoUpload() {
  const zone    = document.getElementById('uploadZone');
  const input   = document.getElementById('photoInput');
  const grid    = document.getElementById('photosGrid');
  const countEl = document.getElementById('photosCountNum');

  zone.addEventListener('click', () => {
    if (state.photos.length < 6) input.click();
    else showToast('Máximo de 6 fotos atingido');
  });

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handlePhotoFiles([...e.dataTransfer.files]);
  });

  input.addEventListener('change', () => {
    handlePhotoFiles([...input.files]);
    input.value = '';
  });

  async function handlePhotoFiles(files) {
    const slots = 6 - state.photos.length;
    const toAdd = files.filter(f => f.type.startsWith('image/')).slice(0, slots);
    if (!toAdd.length) return;

    for (const file of toAdd) {
      const b64 = await fileToBase64(file);
      state.photos.push(b64);
      state.photoCaptions.push('');
    }

    saveState();
    renderPhotosGrid();
    updatePreview();
  }

  function renderPhotosGrid() {
    grid.innerHTML = '';
    countEl.textContent = state.photos.length;

    if (!Array.isArray(state.photoCaptions)) state.photoCaptions = [];
    while (state.photoCaptions.length < state.photos.length) state.photoCaptions.push('');

    state.photos.forEach((src, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'photo-thumb-wrap';
      const captionVal = (state.photoCaptions[i] || '').replace(/"/g, '&quot;');
      wrap.innerHTML = `
        <div class="photo-thumb">
          <img src="${src}" alt="Foto ${i + 1}" loading="lazy" />
          <button class="btn-remove" data-index="${i}" title="Remover foto">✕</button>
        </div>
        <input class="photo-caption-input" type="text" maxlength="40" placeholder="Legenda (opcional)" value="${captionVal}" data-index="${i}" />
      `;
      wrap.querySelector('.btn-remove').addEventListener('click', e => {
        e.stopPropagation();
        removePhoto(i);
      });
      const capInput = wrap.querySelector('.photo-caption-input');
      capInput.addEventListener('input', () => { state.photoCaptions[i] = capInput.value; saveState(); });
      capInput.addEventListener('click', e => e.stopPropagation());
      grid.appendChild(wrap);
    });
  }

  function removePhoto(index) {
    state.photos.splice(index, 1);
    if (Array.isArray(state.photoCaptions)) state.photoCaptions.splice(index, 1);
    saveState();
    renderPhotosGrid();
    updatePreview();
  }

  renderPhotosGrid();
}

/* ═══════════════════════════════════════════════════════════════
   9. UPLOAD DE FOTO DE DESTAQUE (Etapa 8)
═══════════════════════════════════════════════════════════════ */
function setupExtraPhotoUpload() {
  const zone        = document.getElementById('uploadZoneExtra');
  const input       = document.getElementById('extraPhotoInput');
  const preview     = document.getElementById('extraPhotoPreview');
  const img         = document.getElementById('extraPhotoImg');
  const placeholder = document.getElementById('extraUploadPlaceholder');
  const btnRemove   = document.getElementById('btnRemoveExtra');

  zone.addEventListener('click', () => { if (!state.extraPhoto) input.click(); });

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    state.extraPhoto = await fileToBase64(file);
    saveState();
    renderExtraPhoto();
    updatePreview();
    input.value = '';
  });

  btnRemove.addEventListener('click', e => {
    e.stopPropagation();
    state.extraPhoto = null;
    saveState();
    renderExtraPhoto();
    updatePreview();
  });

  function renderExtraPhoto() {
    if (state.extraPhoto) {
      img.src = state.extraPhoto;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
    } else {
      preview.classList.add('hidden');
      placeholder.classList.remove('hidden');
    }
  }

  renderExtraPhoto();
}

/* ═══════════════════════════════════════════════════════════════
   10. BUSCA DE MÚSICA (Etapa 5)
═══════════════════════════════════════════════════════════════ */
function setupMusicSearch() {
  const searchInput     = document.getElementById('musicSearch');
  const suggestionsList = document.getElementById('musicSuggestions');

  let debounceTimer = null;
  let highlighted   = -1;

  if (state.youtubeQuery) searchInput.value = state.youtubeQuery;

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    clearTimeout(debounceTimer);
    suggestionsList.innerHTML = '';
    highlighted = -1;

    if (q.length < 2) { suggestionsList.classList.add('hidden'); return; }
    debounceTimer = setTimeout(() => fetchSuggestions(q), 400);
  });

  searchInput.addEventListener('keydown', e => {
    const items = suggestionsList.querySelectorAll('li');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlighted = Math.min(highlighted + 1, items.length - 1);
      updateHighlight(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
      updateHighlight(items);
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      items[highlighted].dispatchEvent(new MouseEvent('mousedown'));
    } else if (e.key === 'Escape') {
      suggestionsList.classList.add('hidden');
    }
  });

  searchInput.addEventListener('blur', () => {
    setTimeout(() => suggestionsList.classList.add('hidden'), 200);
  });

  /* Deezer JSONP — busca título, artista, capa e duração real da faixa */
  function jsonp(baseUrl, callbackParam = 'callback', timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const cbName = 'dzCb_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      const cleanup = () => {
        try { delete window[cbName]; } catch (_) { window[cbName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
        clearTimeout(timer);
      };
      const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, timeoutMs);
      window[cbName] = data => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error('jsonp error')); };
      script.src = baseUrl + (baseUrl.includes('?') ? '&' : '?') + callbackParam + '=' + cbName;
      document.head.appendChild(script);
    });
  }

  async function fetchSuggestions(query) {
    try {
      const data = await jsonp(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=8`
      );
      const tracks = (data.results || []).map(t => ({
        trackName:       t.trackName       || '',
        artistName:      t.artistName      || '',
        artworkUrl60:    t.artworkUrl60    || t.artworkUrl100 || '',
        previewUrl:      t.previewUrl      || '',
        trackTimeMillis: t.trackTimeMillis
      }));
      renderSuggestions(tracks);
    } catch (_) {
      suggestionsList.classList.add('hidden');
    }
  }

  function renderSuggestions(tracks) {
    suggestionsList.innerHTML = '';
    highlighted = -1;
    if (!tracks.length) { suggestionsList.classList.add('hidden'); return; }

    tracks.forEach(track => {
      const li = document.createElement('li');
      li.className = 'music-suggestion-item';

      const img = document.createElement('img');
      img.src = track.artworkUrl60 || ''; img.alt = ''; img.className = 'suggestion-art'; img.loading = 'lazy';

      const info       = document.createElement('div'); info.className = 'suggestion-info';
      const trackSpan  = document.createElement('span'); trackSpan.className = 'suggestion-track'; trackSpan.textContent = track.trackName;
      const artistSpan = document.createElement('span'); artistSpan.className = 'suggestion-artist'; artistSpan.textContent = track.artistName;

      info.appendChild(trackSpan);
      info.appendChild(artistSpan);
      li.appendChild(img);
      li.appendChild(info);

      const handleSelect = e => { e.preventDefault(); selectTrack(track); };
      li.addEventListener('mousedown', handleSelect);
      li.addEventListener('touchstart', handleSelect, { passive: false });

      suggestionsList.appendChild(li);
    });

    suggestionsList.classList.remove('hidden');

    if (window.matchMedia('(max-width: 900px)').matches) {
      requestAnimationFrame(() => {
        searchInput.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }
  }

  function selectTrack(track) {
    suggestionsList.classList.add('hidden');
    searchInput.value = `${track.trackName} — ${track.artistName}`;

    const songEl   = document.getElementById('songName');
    const artistEl = document.getElementById('artistName');
    songEl.value     = track.trackName;  state.songName   = track.trackName;
    artistEl.value   = track.artistName; state.artistName = track.artistName;

    state.youtubeQuery  = `${track.trackName} ${track.artistName}`;
    state.previewUrl    = track.previewUrl || '';
    state.musicDuration = Number.isFinite(track.trackTimeMillis)
      ? Math.round(track.trackTimeMillis / 1000)
      : DEFAULT_PREVIEW_DURATION_SECONDS;

    saveState();
    updatePreview();
  }

  function updateHighlight(items) {
    items.forEach((li, i) => li.classList.toggle('highlighted', i === highlighted));
  }
}

/* ═══════════════════════════════════════════════════════════════
   11. FAQ ACCORDION
═══════════════════════════════════════════════════════════════ */
function setupFaq() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item   = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   13. BOTÕES DE PLANO
═══════════════════════════════════════════════════════════════ */
function setupPlanButtons() {
  document.querySelectorAll('.btn-plan:not([data-plan])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const plan = btn.closest('.plan-card').classList.contains('featured') ? 'vitalicio' : '24h';
      localStorage.setItem('DearMoment_pending_plan', plan);

      // Checa sessão real do Supabase Auth
      let loggedIn = false;
      if (window.sb) {
        const { data } = await window.sb.auth.getSession();
        loggedIn = !!(data && data.session);
      }


      document.body.style.opacity = '0';
      document.body.style.transition = 'opacity 0.4s ease';
      setTimeout(() => {
        window.location.href = loggedIn ? '../pagamento.html' : '../login.html';
      }, 400);
    });
  });
}

function setupPlanSelection() {
  document.querySelectorAll('.btn-plan[data-plan]').forEach(button => {
    button.addEventListener('click', () => { openFinalGift(button.dataset.plan); });
  });

  const btnPreview = document.getElementById('btnPreviewGift');
  if (btnPreview) {
    btnPreview.addEventListener('click', () => {
      const giftId       = localStorage.getItem('DearMoment_last_gift_id');
      const templateMeta = getTemplateMeta(getFinalTemplate());
      const url = giftId
        ? `${templateMeta.finalUrl}?id=${encodeURIComponent(giftId)}`
        : templateMeta.finalUrl;
      window.location.href = url;
    });
  }

}

/* ═══════════════════════════════════════════════════════════════
   14. BIND DOS CAMPOS DE ENTRADA
═══════════════════════════════════════════════════════════════ */
function bindInputs() {
  /* Etapa 1 — boas-vindas */
  const btnWelcomeStart = document.getElementById('btnWelcomeStart');
  if (btnWelcomeStart) {
    btnWelcomeStart.addEventListener('click', navigateNext);
  }

  /* Etapa 2 — nomes */
  bindText('name1', 'name1');
  bindText('name2', 'name2');

  /* Etapa 3 — data */
  const dateInput = document.getElementById('startDate');
  if (state.startDate) dateInput.value = state.startDate;
  const handleDateChange = () => {
    state.startDate = dateInput.value;
    saveState();
    startCounter(state.startDate);
    updatePreview();
  };
  dateInput.addEventListener('input', handleDateChange);
  dateInput.addEventListener('change', handleDateChange);

  /* Etapa 4 — título */
  const titleInput = document.getElementById('titleInput');
  const titleCount = document.getElementById('titleCount');
  if (state.title) titleInput.value = state.title;
  titleInput.addEventListener('input', () => {
    state.title = titleInput.value;
    titleCount.textContent = state.title.length;
    saveState();
    updatePreview();
  });

  document.getElementById('btnRandomTitle').addEventListener('click', () => {
    const t = randomItem(TITULOS_ALEATORIOS);
    titleInput.value = t;
    state.title = t;
    titleCount.textContent = t.length;
    saveState();
    updatePreview();
    titleInput.focus();
  });

  /* Etapa 5 — nome da música e artista */
  bindText('songName',   'songName');
  bindText('artistName', 'artistName');

  /* Etapa 7 — mensagem */
  const msgText  = document.getElementById('msgText');
  const msgCount = document.getElementById('msgCount');
  if (state.message) msgText.value = state.message;
  msgText.addEventListener('input', () => {
    state.message = msgText.value;
    msgCount.textContent = state.message.length;
    saveState();
    updatePreview();
  });

  document.getElementById('btnRandomMsg').addEventListener('click', () => {
    const m = randomItem(MENSAGENS_ALEATORIAS);
    msgText.value = m;
    state.message = m;
    msgCount.textContent = m.length;
    saveState();
    updatePreview();
  });

  /* Etapa 9 — cápsulas */
  [1, 2, 3, 4].forEach(n => {
    const el    = document.getElementById(`capsula${n}`);
    const count = document.getElementById(`capsulaCount${n}`);
    if (!el) return;
    el.value = state.capsulas[n - 1] || '';
    count.textContent = el.value.length;
    el.addEventListener('input', () => {
      state.capsulas[n - 1] = el.value;
      count.textContent = el.value.length;
      saveState();
    });
  });

  restoreInputValues();
}

function bindText(inputId, stateKey) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.addEventListener('input', () => {
    state[stateKey] = el.value;
    saveState();
    updatePreview();
  });
}

function restoreInputValues() {
  const fields = {
    name1:      'name1',
    name2:      'name2',
    titleInput: 'title',
    songName:   'songName',
    artistName: 'artistName',
    msgText:    'message',
  };

  for (const [id, stateKey] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.value = state[stateKey] || '';
  }

  const titleCount = document.getElementById('titleCount');
  const msgCount   = document.getElementById('msgCount');
  if (titleCount) titleCount.textContent = (state.title || '').length;
  if (msgCount)   msgCount.textContent   = (state.message || '').length;
}

/* ═══════════════════════════════════════════════════════════════
   15. SALVAR PRESENTE CONCLUÍDO
═══════════════════════════════════════════════════════════════ */
const GIFTS_KEY = 'DearMoment_gifts';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

function saveGift() {
  const id = generateId();

  localStorage.setItem('DearMoment_last_gift_id', id);
  localStorage.setItem('DearMoment_last_gift_meta', JSON.stringify({
    id, name1: state.name1, name2: state.name2, title: state.title, template: getFinalTemplate(),
  }));

  try {
    const gifts = JSON.parse(localStorage.getItem(GIFTS_KEY) || '[]');
    const gift = {
      id,
      name1:           state.name1,
      name2:           state.name2,
      startDate:       state.startDate,
      city:            state.city,
      title:           state.title,
      selectedTemplate: getFinalTemplate(),
      youtubeId:       state.youtubeId,
      youtubeQuery:    state.youtubeQuery,
      previewUrl:      state.previewUrl,
      musicDuration:   state.musicDuration,
      songName:        state.songName,
      artistName:      state.artistName,
      photos:          state.photos.slice(),
      photoCaptions:   Array.isArray(state.photoCaptions) ? state.photoCaptions.slice() : [],
      message:         state.message,
      capsulas:        state.capsulas.slice(),
      extraPhoto:      state.extraPhoto,
      giftType:        state.giftType,
      paid:            false,
      createdAt:       new Date().toISOString(),
    };
    gifts.push(gift);
    localStorage.setItem(GIFTS_KEY, JSON.stringify(gifts));
  } catch (_) {}
}

/* ═══════════════════════════════════════════════════════════════
   16. NAVEGAÇÃO — Botões Avançar / Voltar
═══════════════════════════════════════════════════════════════ */
function navigateNext() {
  if (!validateStep(state.currentStep)) return;
  if (state.currentStep <= TOTAL_STEPS) {
    if (state.currentStep === TOTAL_STEPS) saveGift();
    state.currentStep++;
    showStep(state.currentStep);
  }
}

function navigateBack() {
  if (state.currentStep > 1) {
    state.currentStep--;
    showStep(state.currentStep);
  } else {
    showToast('Você está na primeira etapa');
  }
}

function setupNavigation() {
  document.getElementById('btnNext').addEventListener('click', navigateNext);
  document.getElementById('btnBack').addEventListener('click', navigateBack);
}

/* ═══════════════════════════════════════════════════════════════
   17. INICIALIZAÇÃO
═══════════════════════════════════════════════════════════════ */
function init() {
  loadState();
  loadCidades();
  bindInputs();
  setupAutocomplete();
  setupPhotoUpload();
  setupExtraPhotoUpload();
  setupMusicSearch();
  setupFaq();
  setupNavigation();
  setupPlanSelection();
  setupPlanButtons();

  showStep(state.currentStep);
  if (state.startDate) startCounter(state.startDate);
}

document.addEventListener('DOMContentLoaded', init);
