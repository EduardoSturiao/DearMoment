/* ================================================================
   SOULMATES — GIFT CREATOR WIZARD
   script.js
   Arquitetura: estado global → localStorage → preview reativo
================================================================ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   1. ESTADO GLOBAL
═══════════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'soulmates_wizard_state';
const TOTAL_STEPS = 8; // etapas numeradas (1–8), depois step-final

const state = {
  currentStep: 1,
  giftType:    null,   // 'amoroso' | 'amigo'
  name1:       '',
  name2:       '',
  startDate:   '',
  city:        '',
  title:       '',
  youtubeId:   '',
  songName:    '',
  artistName:  '',
  photos:      [],     // array de base64 strings (máx 6)
  message:     '',
  extraPhoto:  null,   // base64 string
};

/* Carrega estado salvo do localStorage */
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) Object.assign(state, JSON.parse(saved));
  } catch (_) { /* ignora erro de parse */ }
}

/* Persiste estado no localStorage */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* ignora limite de armazenamento */ }
}

/* ═══════════════════════════════════════════════════════════════
   2. DADOS — Cidades (API IBGE) e frases aleatórias
═══════════════════════════════════════════════════════════════ */
let CIDADES = []; // Populado via API do IBGE on load

async function loadCidades() {
  const input = document.getElementById('cityInput');
  if (input) input.placeholder = 'Carregando cidades...';
  try {
    const res  = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
    const data = await res.json();
    CIDADES = data.map(m => `${m.nome}, ${m.microrregiao.mesorregiao.UF.sigla}`);
  } catch (_) {
    // Fallback com capitais e cidades principais caso a API falhe
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

/** Mostra uma mensagem de toast rápida */
function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

/** Retorna um item aleatório de um array */
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Extrai o ID de vídeo de uma URL do YouTube */
function extractYouTubeId(url) {
  const patterns = [
    /youtu\.be\/([^#?&]+)/,
    /[?&]v=([^#?&]+)/,
    /youtube\.com\/embed\/([^#?&]+)/,
    /youtube\.com\/shorts\/([^#?&]+)/,
  ];
  for (const re of patterns) {
    const match = url.match(re);
    if (match) return match[1];
  }
  return null;
}

/** Converte arquivo em base64 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ═══════════════════════════════════════════════════════════════
   4. CONTADOR EM TEMPO REAL
═══════════════════════════════════════════════════════════════ */
let counterInterval = null;

/** Calcula diferença entre uma data e agora */
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

    // Contador da etapa 3
    setTextSafe('cYears',   t.years);
    setTextSafe('cMonths',  t.months);
    setTextSafe('cDays',    t.days);
    setTextSafe('cHours',   t.hours);
    setTextSafe('cMinutes', t.minutes);
    setTextSafe('cSeconds', t.seconds);

    // Mini-contador no preview
    setTextSafe('mcYears',  t.years);
    setTextSafe('mcMonths', t.months);
    setTextSafe('mcDays',   t.days);

    // Ano no preview
    setTextSafe('prevYear', new Date(dateStr + 'T00:00:00').getFullYear());
  }

  tick();
  counterInterval = setInterval(tick, 1000);
}

function stopCounter() {
  if (counterInterval) {
    clearInterval(counterInterval);
    counterInterval = null;
  }
}

function setTextSafe(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ═══════════════════════════════════════════════════════════════
   5. NAVEGAÇÃO ENTRE ETAPAS
═══════════════════════════════════════════════════════════════ */

/** Retorna o ID do step para o número dado */
function stepId(n) {
  return n <= TOTAL_STEPS ? `step-${n}` : 'step-final';
}

/** Esconde todas as etapas */
function hideAllSteps() {
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
}

/** Mostra a etapa indicada */
function showStep(n) {
  hideAllSteps();
  const el = document.getElementById(stepId(n));
  if (el) el.classList.add('active');

  updateProgress(n);
  updateNavButtons(n);
  saveState();

  // Inicia contador se já tiver data
  if (n === 3 && state.startDate) startCounter(state.startDate);
  else if (n !== 3) stopCounter();

  // Oculta nav-footer na etapa final
  const navFooter = document.getElementById('navFooter');
  // Na etapa final mostra só o botão "Voltar", esconde "Continuar"
  const isFinal = n > TOTAL_STEPS;
  navFooter.classList.remove('hidden-final');
  document.getElementById('btnNext').style.display = isFinal ? 'none' : '';
}

/** Atualiza barra de progresso */
function updateProgress(n) {
  const pct = Math.min((n - 1) / TOTAL_STEPS * 100, 100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('stepLabel').textContent =
    n <= TOTAL_STEPS ? `${n} / ${TOTAL_STEPS}` : '✓ Concluído';
}

/** Atualiza botões de navegação */
function updateNavButtons(n) {
  const btnNext = document.getElementById('btnNext');
  // Ambos os botões sempre visíveis; navigateBack trata o caso do step 1
  btnNext.textContent = (n === TOTAL_STEPS) ? 'Ver resultado 🎉' : 'Continuar →';
}

/** Valida a etapa atual antes de avançar */
function validateStep(n) {
  switch (n) {
    case 1:
      if (!state.giftType) { showToast('Escolha o tipo de presente ☝️'); return false; }
      break;
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
    // etapas 5–8 são opcionais (pode pular)
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   6. ATUALIZAÇÃO DO PREVIEW
═══════════════════════════════════════════════════════════════ */
function updatePreview() {
  // Nomes
  const n1 = state.name1 || 'Nome1';
  const n2 = state.name2 || 'Nome2';
  setTextSafe('prevNames', `${n1} & ${n2}`);

  // Título
  setTextSafe('prevTitle', state.title || 'Nosso presente especial');

  // Música
  setTextSafe('prevSong',   state.songName   || 'Nossa Música');
  setTextSafe('prevArtist', state.artistName || 'Artista');

  // Cidade
  setTextSafe('prevCity', state.city ? `📍 ${state.city}` : '📍 —');

  // Foto de capa (etapa 8)
  const coverImg          = document.getElementById('coverImg');
  const coverPlaceholder  = document.getElementById('coverPlaceholder');
  if (state.extraPhoto) {
    coverImg.src = state.extraPhoto;
    coverImg.classList.remove('hidden');
    coverPlaceholder.classList.add('hidden');
  } else if (state.photos.length > 0) {
    // Usa primeira foto da galeria enquanto não houver foto de destaque
    coverImg.src = state.photos[0];
    coverImg.classList.remove('hidden');
    coverPlaceholder.classList.add('hidden');
  } else {
    coverImg.classList.add('hidden');
    coverPlaceholder.classList.remove('hidden');
  }

  // Contador já é atualizado pelo intervalo (startCounter)
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

    const matches = CIDADES.filter(c => c.toLowerCase().includes(q)).slice(0, 8);
    if (!matches.length) { list.classList.add('hidden'); return; }

    matches.forEach((city, i) => {
      const li = document.createElement('li');
      li.textContent = city;
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        selectCity(city);
      });
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
    // Se o campo tiver texto mas não for uma cidade conhecida, aceita o que foi digitado
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

  // Preenche o campo se já tiver cidade no estado
  if (state.city) input.value = state.city;
}

/* ═══════════════════════════════════════════════════════════════
   8. UPLOAD DE FOTOS (Etapa 6)
═══════════════════════════════════════════════════════════════ */
function setupPhotoUpload() {
  const zone        = document.getElementById('uploadZone');
  const input       = document.getElementById('photoInput');
  const grid        = document.getElementById('photosGrid');
  const countEl     = document.getElementById('photosCountNum');

  /* Clique na zona de upload */
  zone.addEventListener('click', () => {
    if (state.photos.length < 6) input.click();
    else showToast('Máximo de 6 fotos atingido');
  });

  /* Drag & Drop */
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave',  () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handlePhotoFiles([...e.dataTransfer.files]);
  });

  /* Input file */
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
    }

    saveState();
    renderPhotosGrid();
    updatePreview();
  }

  function renderPhotosGrid() {
    grid.innerHTML = '';
    countEl.textContent = state.photos.length;

    state.photos.forEach((src, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'photo-thumb';
      thumb.innerHTML = `
        <img src="${src}" alt="Foto ${i + 1}" loading="lazy" />
        <button class="btn-remove" data-index="${i}" title="Remover foto">✕</button>
      `;
      thumb.querySelector('.btn-remove').addEventListener('click', e => {
        e.stopPropagation();
        removePhoto(i);
      });
      grid.appendChild(thumb);
    });
  }

  function removePhoto(index) {
    state.photos.splice(index, 1);
    saveState();
    renderPhotosGrid();
    updatePreview();
  }

  // Renderiza fotos já salvas
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

  zone.addEventListener('click', () => {
    if (!state.extraPhoto) input.click();
  });

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
   10. YOUTUBE (Etapa 5)
═══════════════════════════════════════════════════════════════ */
function setupYoutube() {
  const urlInput   = document.getElementById('youtubeUrl');
  const btnLoad    = document.getElementById('btnLoadYt');
  const embedWrap  = document.getElementById('ytEmbedWrap');
  const frame      = document.getElementById('ytFrame');
  const btnPlay    = document.getElementById('btnPlay');
  const overlay    = document.getElementById('ytOverlay');
  const oFrame     = document.getElementById('ytOverlayFrame');
  const btnClose   = document.getElementById('btnYtClose');

  /* Preenche o campo se já tiver URL salva */
  if (state.youtubeId) {
    renderYtEmbed(state.youtubeId);
  }

  /* Botão "Carregar" */
  btnLoad.addEventListener('click', () => {
    const id = extractYouTubeId(urlInput.value.trim());
    if (!id) { showToast('URL do YouTube inválida'); return; }
    state.youtubeId = id;
    saveState();
    renderYtEmbed(id);
    updatePreview();
  });

  /* Carrega ao colar e pressionar Enter */
  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnLoad.click();
  });

  function renderYtEmbed(id) {
    frame.src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
    embedWrap.classList.remove('hidden');
    if (state.youtubeId) urlInput.value = `https://www.youtube.com/watch?v=${id}`;
  }

  /* Botão play no preview — abre o YouTube embedded */
  btnPlay.addEventListener('click', () => {
    if (!state.youtubeId) { showToast('Adicione uma música na etapa 5 🎵'); return; }
    oFrame.src = `https://www.youtube-nocookie.com/embed/${state.youtubeId}?autoplay=1&rel=0`;
    overlay.classList.remove('hidden');
  });

  /* Fechar overlay */
  btnClose.addEventListener('click', () => {
    overlay.classList.add('hidden');
    oFrame.src = '';
  });
}

/* ═══════════════════════════════════════════════════════════════
   11. FAQ ACCORDION
═══════════════════════════════════════════════════════════════ */
function setupFaq() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   12. MOBILE PREVIEW TOGGLE
═══════════════════════════════════════════════════════════════ */
function setupMobilePreview() {
  const panel  = document.getElementById('previewPanel');
  const btn    = document.getElementById('btnTogglePreview');

  btn.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    btn.textContent = isOpen ? '✕ Fechar' : 'Ver preview';
  });

  /* Fecha o preview ao clicar fora */
  document.addEventListener('click', e => {
    if (!panel.contains(e.target) && e.target !== btn) {
      panel.classList.remove('open');
      btn.textContent = 'Ver preview';
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   13. UPGRADE BANNER
═══════════════════════════════════════════════════════════════ */
function setupUpgrade() {
  const btn = document.getElementById('btnUpgrade');
  btn.addEventListener('click', () => {
    if (btn.classList.contains('added')) {
      btn.classList.remove('added');
      btn.textContent = 'Adicionar';
      showToast('Versão Wrapped removida');
    } else {
      btn.classList.add('added');
      btn.textContent = '✓ Adicionado';
      showToast('🎁 Wrapped adicionado ao pedido!');
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   14. BIND DOS CAMPOS DE ENTRADA
      Cada campo atualiza state + preview automaticamente
═══════════════════════════════════════════════════════════════ */
function bindInputs() {

  /* Etapa 1 — cards de presente */
  document.querySelectorAll('.gift-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.gift-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.giftType = card.dataset.value;
      saveState();
      // Avança automaticamente
      setTimeout(() => navigateNext(), 350);
    });
    // Restaura seleção visual
    if (card.dataset.value === state.giftType) card.classList.add('selected');
  });

  /* Etapa 2 — nomes */
  bindText('name1', 'name1');
  bindText('name2', 'name2');

  /* Etapa 3 — data */
  const dateInput = document.getElementById('startDate');
  if (state.startDate) dateInput.value = state.startDate;
  dateInput.addEventListener('input', () => {
    state.startDate = dateInput.value;
    saveState();
    startCounter(state.startDate);
    updatePreview();
  });

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

  /* Etapa 4 — título aleatório */
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
  });

  document.getElementById('btnRandomMsg').addEventListener('click', () => {
    const m = randomItem(MENSAGENS_ALEATORIAS);
    msgText.value = m;
    state.message = m;
    msgCount.textContent = m.length;
    saveState();
  });

  /* Restaura valores dos campos de texto */
  restoreInputValues();
}

/** Vincula um input de texto ao estado */
function bindText(inputId, stateKey) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.addEventListener('input', () => {
    state[stateKey] = el.value;
    saveState();
    updatePreview();
  });
}

/** Restaura os valores dos campos a partir do estado carregado */
function restoreInputValues() {
  const fields = {
    name1:      'name1',
    name2:      'name2',
    titleInput: 'title',
    songName:   'songName',
    artistName: 'artistName',
    msgText:    'message',
    youtubeUrl: state.youtubeId ? `https://www.youtube.com/watch?v=${state.youtubeId}` : '',
  };

  for (const [id, stateKeyOrValue] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (id === 'youtubeUrl') {
      el.value = stateKeyOrValue; // já é a string direta
    } else {
      el.value = state[stateKeyOrValue] || '';
    }
  }

  // Char counts
  const titleCount = document.getElementById('titleCount');
  const msgCount   = document.getElementById('msgCount');
  if (titleCount) titleCount.textContent = (state.title || '').length;
  if (msgCount)   msgCount.textContent   = (state.message || '').length;
}

/* ═══════════════════════════════════════════════════════════════
   15. NAVEGAÇÃO — Botões Avançar / Voltar
═══════════════════════════════════════════════════════════════ */
function navigateNext() {
  if (!validateStep(state.currentStep)) return;
  if (state.currentStep <= TOTAL_STEPS) {
    state.currentStep++;
    showStep(state.currentStep);
  }
}

function navigateBack() {
  if (state.currentStep > 1) {
    state.currentStep--;
    showStep(state.currentStep);
  } else {
    // Já está na primeira etapa — oferece voltar à página inicial
    showToast('Você está na primeira etapa');
  }
}

function setupNavigation() {
  document.getElementById('btnNext').addEventListener('click', navigateNext);
  document.getElementById('btnBack').addEventListener('click', navigateBack);

  /* Atalho de teclado: Enter avança (exceto em textareas) */
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      navigateNext();
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   16. ANIMAÇÃO BARRA DO PLAYER (fake)
═══════════════════════════════════════════════════════════════ */
function animatePlayerBar() {
  const fill = document.getElementById('playerBarFill');
  let pct = 35;
  setInterval(() => {
    pct = pct >= 100 ? 0 : pct + 0.05;
    if (fill) fill.style.width = pct + '%';
  }, 50);
}

/* ═══════════════════════════════════════════════════════════════
   17. INICIALIZAÇÃO
═══════════════════════════════════════════════════════════════ */
function init() {
  loadState();
  loadCidades(); // async — popula CIDADES em background via API IBGE
  bindInputs();
  setupAutocomplete();
  setupPhotoUpload();
  setupExtraPhotoUpload();
  setupYoutube();
  setupFaq();
  setupNavigation();
  setupMobilePreview();
  setupUpgrade();
  animatePlayerBar();

  /* Restaura a etapa onde o usuário parou */
  showStep(state.currentStep);
  updatePreview();

  /* Contador se já tiver data */
  if (state.startDate) startCounter(state.startDate);
}

document.addEventListener('DOMContentLoaded', init);
