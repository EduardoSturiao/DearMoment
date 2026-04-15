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
const TOTAL_STEPS = 9; // etapas numeradas (1–9), depois step-final
const FLOW_VERSION = 2;
const DEFAULT_PREVIEW_DURATION_SECONDS = 30;
const STORY_PHOTO_DURATION_MS = 1500;
const STORY_BASE_SLIDE_DURATION_MS = 4200;
const STORY_TIME_SLIDE_DURATION_MS = 5200;
const STORY_MESSAGE_CHUNK_LIMIT = 110;
const STORY_OPENING_MESSAGE_CHUNK_LIMIT = 60;
const STORY_PREVIEW_INTERVAL_MS = 100;

const TEMPLATE_META = {
  stories: {
    label: 'Stories do Instagram',
    finalUrl: '../presente/index.html'
  },
  spotify: {
    label: 'Spotify',
    finalUrl: '../presente.html'
  }
};

const state = {
  flowVersion: FLOW_VERSION,
  currentStep: 1,
  giftType:    null,   // 'amoroso' | 'amigo'
  selectedTemplate: '',
  name1:       '',
  name2:       '',
  startDate:   '',
  city:        '',
  title:       '',
  youtubeId:    '',
  youtubeQuery: '',
  previewUrl:   '',
  musicDuration: 0,
  musicMoment:    0,
  musicMomentEnd: 30,
  songName:     '',
  artistName:   '',
  photos:      [],     // array de base64 strings (máx 6)
  message:     '',
  extraPhoto:  null,   // base64 string
  selectedPlan: '',
  wrappedSelected: false,
};

const previewStoryState = {
  slides: [],
  slideIndex: 0,
  galleryIndex: 0,
  timerId: null,
  frameId: null,
  liveCounterId: null,
  elapsed: 0,
  started: false,
  paused: false,
  finished: false
};

/* Carrega estado salvo do localStorage */
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) Object.assign(state, JSON.parse(saved));
    migrateLegacyWizardState();
  } catch (_) { /* ignora erro de parse */ }
}

function migrateLegacyWizardState() {
  const savedVersion = Number(state.flowVersion) || 0;
  const currentStep = Number(state.currentStep) || 1;

  if (savedVersion < FLOW_VERSION) {
    if (TEMPLATE_META[state.selectedTemplate]) {
      const stepMap = {
        1: 1,
        2: 9,
        3: 2,
        4: 3,
        5: 4,
        6: 5,
        7: 6,
        8: 7,
        9: 8,
        10: 10
      };
      state.currentStep = stepMap[currentStep] || currentStep;
    } else {
      state.currentStep = currentStep;
      state.selectedTemplate = '';
    }
  }

  state.flowVersion = FLOW_VERSION;
  state.currentStep = Math.min(Math.max(Number(state.currentStep) || 1, 1), TOTAL_STEPS + 1);
}

/* Persiste estado no localStorage */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* ignora limite de armazenamento */ }
}

function formatAudioTime(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = Math.floor(safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getMusicPreviewDuration(audioEl = document.getElementById('audioPreview')) {
  const duration = Number(audioEl?.duration);
  return Number.isFinite(duration) && duration > 0
    ? duration
    : DEFAULT_PREVIEW_DURATION_SECONDS;
}

function getSelectedTrackDuration(audioEl = document.getElementById('audioPreview')) {
  const savedDuration = Number(state.musicDuration);
  if (Number.isFinite(savedDuration) && savedDuration > 0) {
    return savedDuration;
  }

  return getMusicPreviewDuration(audioEl);
}

function getDefaultPresentMessage() {
  return state.giftType === 'amigo'
    ? 'Tem amizades que merecem um espaço só delas. Esta página foi criada para guardar os momentos, o carinho e a presença que fazem essa história ser tão especial.'
    : 'Tem histórias que merecem um espaço só delas. Esta página foi criada para guardar a música, as imagens e tudo aquilo que faz esse amor continuar vivo todos os dias.';
}

function splitTextIntoChunks(text, limit) {
  const paragraphs = String(text || '')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks = [];

  paragraphs.forEach((paragraph) => {
    if (paragraph.length <= limit) {
      chunks.push(paragraph);
      return;
    }

    const sentences = paragraph.match(/[^.!?]+[.!?]?/g) || [paragraph];
    let buffer = '';

    sentences.forEach((sentence) => {
      const next = buffer ? `${buffer} ${sentence.trim()}` : sentence.trim();

      if (next.length > limit && buffer) {
        chunks.push(buffer);
        buffer = sentence.trim();
      } else {
        buffer = next;
      }
    });

    if (buffer) chunks.push(buffer);
  });

  return chunks.length ? chunks : [getDefaultPresentMessage()];
}

function getStoryMessageDuration(text) {
  return STORY_BASE_SLIDE_DURATION_MS + Math.min(String(text || '').length * 18, 2600);
}

function getEstimatedPresentDurationSeconds() {
  const message = state.message?.trim() || getDefaultPresentMessage();
  const messageSlides = splitTextIntoChunks(message, STORY_MESSAGE_CHUNK_LIMIT);
  const [firstMessageChunk = getDefaultPresentMessage(), ...otherMessageChunks] = messageSlides;
  const [openingMessage = getDefaultPresentMessage(), ...openingOverflowChunks] = splitTextIntoChunks(firstMessageChunk, STORY_OPENING_MESSAGE_CHUNK_LIMIT);
  const remainingMessages = [...openingOverflowChunks, ...otherMessageChunks];

  let totalMs = getStoryMessageDuration(openingMessage) + 900;

  remainingMessages.forEach((messageChunk) => {
    totalMs += getStoryMessageDuration(messageChunk);
  });

  totalMs += STORY_TIME_SLIDE_DURATION_MS;

  if (state.photos.length) {
    totalMs += Math.max(state.photos.length * STORY_PHOTO_DURATION_MS, 4500);
  }

  return Math.max(1, totalMs / 1000);
}

function getMusicMomentWindowSeconds() {
  return DEFAULT_PREVIEW_DURATION_SECONDS;
}

function getMusicMomentMax(duration = getSelectedTrackDuration()) {
  return Math.max(0, duration - getMusicMomentWindowSeconds());
}

function clampMusicMoment(value, duration = getSelectedTrackDuration()) {
  const safeValue = Number(value);
  const nextValue = Number.isFinite(safeValue) ? safeValue : 0;
  return Math.min(Math.max(nextValue, 0), getMusicMomentMax(duration));
}

function syncMusicPreviewDisplay(currentTime = state.musicMoment, duration = getSelectedTrackDuration()) {
  const currentLabel = document.getElementById('fakeCurrent');
  const durationLabel = document.getElementById('fakeDuration');
  const fill = document.getElementById('playerBarFill');
  const numericDuration = Number(duration);
  const safeDuration = Number.isFinite(numericDuration) && numericDuration > 0
    ? numericDuration
    : DEFAULT_PREVIEW_DURATION_SECONDS;
  const safeCurrent = Math.min(Math.max(Number(currentTime) || 0, 0), safeDuration);

  if (currentLabel) currentLabel.textContent = formatAudioTime(safeCurrent);
  if (durationLabel) durationLabel.textContent = formatAudioTime(safeDuration);

  if (fill) {
    const progress = safeDuration > 0 ? (safeCurrent / safeDuration) * 100 : 0;
    fill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
  }
}

function getPreviewTemplate() {
  return TEMPLATE_META[state.selectedTemplate] ? state.selectedTemplate : 'spotify';
}

function getFinalTemplate() {
  return TEMPLATE_META[state.selectedTemplate] ? state.selectedTemplate : 'spotify';
}

function getTemplateMeta(templateId = getPreviewTemplate()) {
  return TEMPLATE_META[templateId] || TEMPLATE_META.spotify;
}

function getPreviewSignaturePrefix() {
  return state.giftType === 'amigo' ? 'Com carinho' : 'Com amor';
}

function getPreviewTitle() {
  if (state.title?.trim()) return state.title.trim();
  return state.giftType === 'amigo'
    ? 'Uma surpresa para celebrar uma amizade especial.'
    : 'Nosso presente especial';
}

function getPreviewMessageChunk() {
  const message = state.message?.trim() || getDefaultPresentMessage();
  return splitTextIntoChunks(message, STORY_OPENING_MESSAGE_CHUNK_LIMIT)[0];
}

function getPreviewFormattedDate() {
  if (!state.startDate) return 'um dia inesquecível';

  const date = new Date(`${state.startDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'um dia inesquecível';

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function buildPreviewData() {
  const sender = state.name1?.trim() || 'Você';
  const recipient = state.name2?.trim() || 'Pessoa especial';
  const galleryPhotos = Array.isArray(state.photos) && state.photos.length
    ? state.photos.filter(Boolean)
    : [];
  const cover = state.extraPhoto || galleryPhotos[0] || '';

  return {
    sender,
    recipient,
    names: `${sender} & ${recipient}`,
    title: getPreviewTitle(),
    message: state.message?.trim() || 'Sua mensagem especial aparecerá aqui...',
    openingMessage: getPreviewMessageChunk(),
    song: state.songName?.trim() || 'Nossa música',
    artist: state.artistName?.trim() || 'Artista',
    city: state.city?.trim() || '—',
    formattedDate: getPreviewFormattedDate(),
    cover,
    galleryPhotos,
    trackLabel: `${state.songName?.trim() || 'Nossa música'} - ${state.artistName?.trim() || 'Artista'}`,
    signature: `${getPreviewSignaturePrefix()}, ${sender}.`
  };
}

/* ═══════════════════════════════════════════════════════════════
   2. DADOS — Cidades (API IBGE) e frases aleatórias
═══════════════════════════════════════════════════════════════ */
function openFinalGift(planId) {
  state.selectedPlan = planId;
  saveState();

  const template = getFinalTemplate();
  const templateMeta = getTemplateMeta(template);

  if (template === 'spotify') {
    const giftId = localStorage.getItem('soulmates_last_gift_id');
    if (giftId) {
      window.location.href = `${templateMeta.finalUrl}?id=${encodeURIComponent(giftId)}`;
      return;
    }
  }

  window.location.href = templateMeta.finalUrl;
}

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

/** Escapa caracteres HTML para uso seguro em innerHTML */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Normaliza string removendo acentos e colocando em minúsculas */
function normalizeStr(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
   4. SLIDESHOW DE FOTOS NO MOCKUP
═══════════════════════════════════════════════════════════════ */
let slideshowInterval  = null;
let slideIndex         = 0;
let _slideshowPhotoLen = -1; // evita reiniciar o slideshow a cada updatePreview()

function startPhotoSlideshow() {
  const count = state.photos.length;

  // Só reinicia se a quantidade de fotos mudou ou o intervalo morreu
  if (count === _slideshowPhotoLen && (count <= 1 || slideshowInterval !== null)) return;
  _slideshowPhotoLen = count;

  stopPhotoSlideshow();
  const coverImg         = document.getElementById('coverImg');
  const coverPlaceholder = document.getElementById('coverPlaceholder');

  if (!count) {
    coverImg.classList.add('hidden');
    coverPlaceholder.classList.remove('hidden');
    return;
  }

  slideIndex = 0;
  coverImg.src = state.photos[0];
  coverImg.style.opacity = '1';
  coverImg.classList.remove('hidden');
  coverPlaceholder.classList.add('hidden');

  if (count > 1) {
    slideshowInterval = setInterval(() => {
      slideIndex = (slideIndex + 1) % state.photos.length;
      coverImg.style.opacity = '0';
      setTimeout(() => {
        coverImg.src = state.photos[slideIndex];
        coverImg.style.opacity = '1';
      }, 800);
    }, 3000);
  }
}

function stopPhotoSlideshow() {
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
  }
}

/* ── Hora real na status bar ─────────────────────────────────── */
function updateStatusTime() {
  const el = document.getElementById('statusTime');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/* ── Galeria de fotos no mockup ─────────────────────────────── */
function updateGalleryPreview() {
  const strip = document.getElementById('galleryStrip');
  if (!strip) return;

  strip.innerHTML = '';

  if (!state.photos.length) {
    const empty = document.createElement('div');
    empty.className = 'gallery-empty';
    empty.textContent = 'Suas fotos aparecerão aqui';
    strip.appendChild(empty);
    return;
  }

  state.photos.forEach((src, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'gallery-thumb';
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Foto ${i + 1}`;
    img.loading = 'lazy';
    thumb.appendChild(img);
    strip.appendChild(thumb);
  });
}

/* ═══════════════════════════════════════════════════════════════
   5. CONTADOR EM TEMPO REAL
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
    setTextSafe('mcHours',  t.hours);

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

  if (n !== TOTAL_STEPS && getPreviewTemplate() === 'stories') {
    resetStoriesPreviewState();
  }

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
    case 9:
      if (!state.selectedTemplate) { showToast('Escolha o template do presente ✨'); return false; }
      break;
    // etapas 5–8 são opcionais (pode pular)
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   6. ATUALIZAÇÃO DO PREVIEW
═══════════════════════════════════════════════════════════════ */
function updatePreviewTemplateUI(templateId) {
  const phoneMockup = document.getElementById('phoneMockup');
  const spotifyView = document.getElementById('spotifyPreviewView');
  const storiesView = document.getElementById('storiesPreviewView');
  const templateName = document.getElementById('previewTemplateName');

  if (phoneMockup) phoneMockup.dataset.template = templateId;
  if (spotifyView) spotifyView.classList.toggle('hidden', templateId !== 'spotify');
  if (storiesView) storiesView.classList.toggle('hidden', templateId !== 'stories');
  if (templateName) templateName.textContent = getTemplateMeta(templateId).label;
}

function renderSpotifyPreview(previewData) {
  setTextSafe('prevNames', previewData.names);
  setTextSafe('prevTitle', previewData.title);
  setTextSafe('prevSong', previewData.song);
  setTextSafe('prevArtist', previewData.artist);
  setTextSafe('prevCity', previewData.city !== '—' ? `📍 ${previewData.city}` : '📍 —');
  setTextSafe('prevMessage', state.message || 'Sua mensagem especial aparecerá aqui...');

  syncMusicPreviewDisplay(0, Math.max(1, state.musicMomentEnd - state.musicMoment));
  updateGalleryPreview();

  const msgCoverImg = document.getElementById('msgCoverImg');
  const msgCoverPlaceholder = document.getElementById('msgCoverPlaceholder');

  if (msgCoverImg) {
    if (state.extraPhoto) {
      msgCoverImg.src = state.extraPhoto;
      msgCoverImg.classList.remove('hidden');
      if (msgCoverPlaceholder) msgCoverPlaceholder.classList.add('hidden');
    } else {
      msgCoverImg.classList.add('hidden');
      if (msgCoverPlaceholder) msgCoverPlaceholder.classList.remove('hidden');
    }
  }

  if (state.startDate) {
    const date = new Date(`${state.startDate}T00:00:00`);
    setTextSafe('prevTlDate', date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }));
  } else {
    setTextSafe('prevTlDate', '—');
  }

  setTextSafe('prevTlCity', state.city || '—');
}

function createStoriesPreviewNode(tagName, className, text = '') {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function buildStoriesPreviewSlides(previewData) {
  const message = previewData.message?.trim() || getDefaultPresentMessage();
  const messageSlides = splitTextIntoChunks(message, STORY_MESSAGE_CHUNK_LIMIT);
  const [firstMessageChunk = getDefaultPresentMessage(), ...otherMessageChunks] = messageSlides;
  const [openingMessage = getDefaultPresentMessage(), ...openingOverflowChunks] = splitTextIntoChunks(firstMessageChunk, STORY_OPENING_MESSAGE_CHUNK_LIMIT);
  const remainingMessages = [...openingOverflowChunks, ...otherMessageChunks];
  const slides = [
    {
      type: 'message-opening',
      duration: getStoryMessageDuration(openingMessage) + 900,
      frameMedia: previewData.cover,
      headline: previewData.recipient,
      quote: openingMessage,
      signature: previewData.signature
    }
  ];

  remainingMessages.forEach((messageChunk, index) => {
    slides.push({
      type: 'message',
      duration: getStoryMessageDuration(messageChunk),
      label: index === 0 ? 'Continua' : 'Mais um pedaço',
      headline: `Palavras de ${previewData.sender}.`,
      quote: messageChunk,
      signature: previewData.signature
    });
  });

  slides.push({
    type: 'time',
    duration: STORY_TIME_SLIDE_DURATION_MS,
    label: 'Tempo vivido',
    headline: 'Cada instante continua contando.',
    copy: `Desde ${previewData.formattedDate}, essa história segue acontecendo em tempo real.`
  });

  if (previewData.galleryPhotos.length) {
    slides.push({
      type: 'gallery',
      duration: Math.max(previewData.galleryPhotos.length * STORY_PHOTO_DURATION_MS, 4500),
      label: 'Memórias',
      headline: previewData.title,
      photos: previewData.galleryPhotos
    });
  }

  return slides;
}

function renderStoriesPreviewProgress(slides) {
  const progress = document.getElementById('storiesPreviewProgress');
  if (!progress) return;

  progress.innerHTML = slides.map(() => (
    '<span class="stories-preview-progress-segment"><span class="stories-preview-progress-fill"></span></span>'
  )).join('');
}

function createStoriesPreviewSlideElement(slide, index) {
  const slideElement = createStoriesPreviewNode('section', `stories-preview-slide stories-preview-slide-${slide.type}`);
  slideElement.dataset.index = String(index);
  slideElement.dataset.type = slide.type;

  const content = createStoriesPreviewNode('div', 'stories-preview-slide-content');

  if (slide.label && slide.type !== 'message-opening') {
    content.appendChild(createStoriesPreviewNode('p', 'stories-preview-label', slide.label));
  }

  if (slide.headline && slide.type !== 'message-opening') {
    content.appendChild(createStoriesPreviewNode('h3', 'stories-preview-headline', slide.headline));
  }

  if (slide.type === 'message-opening') {
    const openingBlock = createStoriesPreviewNode('div', 'stories-preview-opening-block');
    const copy = createStoriesPreviewNode('div', 'stories-preview-opening-copy');
    const recipient = createStoriesPreviewNode('p', 'stories-preview-opening-recipient', `${slide.headline}...`);
    const quote = createStoriesPreviewNode('p', 'stories-preview-opening-quote', slide.quote);
    const footer = createStoriesPreviewNode('div', 'stories-preview-opening-footer');
    const line = createStoriesPreviewNode('span', 'stories-preview-opening-line');
    const signature = createStoriesPreviewNode('p', 'stories-preview-opening-signature', slide.signature);

    if (slide.frameMedia) {
      const frame = createStoriesPreviewNode('div', 'stories-preview-opening-media-frame');
      const image = createStoriesPreviewNode('img', 'stories-preview-opening-media');
      image.src = slide.frameMedia;
      image.alt = `Foto de capa do presente para ${slide.headline}`;
      image.loading = 'eager';
      frame.appendChild(image);
      openingBlock.appendChild(frame);
    } else {
      const frame = createStoriesPreviewNode('div', 'stories-preview-opening-media-frame');
      frame.appendChild(createStoriesPreviewNode('div', 'stories-preview-opening-media-placeholder', '🖼️'));
      openingBlock.appendChild(frame);
    }

    footer.append(line, signature);
    copy.append(recipient, quote, footer);
    openingBlock.appendChild(copy);
    content.appendChild(openingBlock);
  }

  if (slide.type === 'message') {
    const card = createStoriesPreviewNode('article', 'stories-preview-card');
    const quote = createStoriesPreviewNode('p', 'stories-preview-quote', slide.quote);
    const signature = createStoriesPreviewNode('p', 'stories-preview-signature', slide.signature);
    card.append(quote, signature);
    content.appendChild(card);
  }

  if (slide.type === 'time') {
    const panel = createStoriesPreviewNode('div', 'stories-preview-time-panel');
    const dateLine = createStoriesPreviewNode('p', 'stories-preview-time-date', `Desde ${getPreviewFormattedDate()}`);
    const primaryGrid = createStoriesPreviewNode('div', 'stories-preview-time-primary');
    const secondaryGrid = createStoriesPreviewNode('div', 'stories-preview-time-secondary');
    const copy = createStoriesPreviewNode('p', 'stories-preview-time-copy', slide.copy);
    const primaryDefs = [['years', 'anos'], ['months', 'meses']];
    const secondaryDefs = [['days', 'dias'], ['hours', 'horas'], ['minutes', 'min'], ['seconds', 'seg']];

    primaryDefs.forEach(([key, label]) => {
      const stat = createStoriesPreviewNode('article', 'stories-preview-stat stories-preview-stat-primary');
      const value = createStoriesPreviewNode('span', 'stories-preview-stat-value', '--');
      const caption = createStoriesPreviewNode('span', 'stories-preview-stat-label', label);
      value.dataset.timeKey = key;
      stat.append(value, caption);
      primaryGrid.appendChild(stat);
    });

    secondaryDefs.forEach(([key, label]) => {
      const stat = createStoriesPreviewNode('article', 'stories-preview-stat stories-preview-stat-secondary');
      const value = createStoriesPreviewNode('span', 'stories-preview-stat-value', '--');
      const caption = createStoriesPreviewNode('span', 'stories-preview-stat-label', label);
      value.dataset.timeKey = key;
      stat.append(value, caption);
      secondaryGrid.appendChild(stat);
    });

    panel.append(dateLine, primaryGrid, secondaryGrid);
    content.append(panel, copy);
  }

  if (slide.type === 'gallery') {
    const stack = createStoriesPreviewNode('div', 'stories-preview-gallery-stack');
    const dots = createStoriesPreviewNode('div', 'stories-preview-gallery-dots');

    if (slide.photos?.length) {
      slide.photos.forEach((photo, photoIndex) => {
        const image = createStoriesPreviewNode('img', `stories-preview-gallery-image${photoIndex === 0 ? ' active' : ''}`);
        image.src = photo;
        image.alt = `Foto ${photoIndex + 1} do preview`;
        image.loading = 'lazy';
        stack.appendChild(image);

        const dot = createStoriesPreviewNode('span', `stories-preview-gallery-dot${photoIndex === 0 ? ' active' : ''}`);
        dots.appendChild(dot);
      });
    } else {
      stack.appendChild(createStoriesPreviewNode('div', 'stories-preview-gallery-placeholder', '📸'));
    }

    content.append(stack, dots);
  }

  slideElement.appendChild(content);
  return slideElement;
}

function renderStoriesPreviewSlides(slides) {
  const slidesContainer = document.getElementById('storiesPreviewSlides');
  if (!slidesContainer) return;

  slidesContainer.innerHTML = '';
  slides.forEach((slide, index) => {
    slidesContainer.appendChild(createStoriesPreviewSlideElement(slide, index));
  });
}

function updateStoriesPreviewLiveCounter() {
  const counter = state.startDate ? calcTimeSince(state.startDate) : null;
  const values = {
    years: counter?.years ?? '—',
    months: counter?.months ?? '—',
    days: counter?.days ?? '—',
    hours: counter?.hours ?? '—',
    minutes: counter?.minutes ?? '—',
    seconds: counter?.seconds ?? '—'
  };

  document.querySelectorAll('#storiesPreviewSlides [data-time-key]').forEach((node) => {
    node.textContent = values[node.dataset.timeKey] ?? '—';
  });
}

function startStoriesPreviewLiveCounter() {
  stopStoriesPreviewLiveCounter();
  updateStoriesPreviewLiveCounter();
  previewStoryState.liveCounterId = window.setInterval(updateStoriesPreviewLiveCounter, 1000);
}

function stopStoriesPreviewLiveCounter() {
  if (!previewStoryState.liveCounterId) return;
  window.clearInterval(previewStoryState.liveCounterId);
  previewStoryState.liveCounterId = null;
}

function updateStoriesPreviewGallerySlide() {
  const currentSlide = previewStoryState.slides[previewStoryState.slideIndex];
  if (!currentSlide || currentSlide.type !== 'gallery') return;

  const currentElement = document.querySelector(`#storiesPreviewSlides .stories-preview-slide[data-index="${previewStoryState.slideIndex}"]`);
  if (!currentElement) return;

  const images = Array.from(currentElement.querySelectorAll('.stories-preview-gallery-image'));
  const dots = Array.from(currentElement.querySelectorAll('.stories-preview-gallery-dot'));
  if (!images.length) return;

  const activeIndex = Math.floor(previewStoryState.elapsed / STORY_PHOTO_DURATION_MS) % images.length;
  previewStoryState.galleryIndex = activeIndex;

  images.forEach((image, index) => image.classList.toggle('active', index === activeIndex));
  dots.forEach((dot, index) => dot.classList.toggle('active', index === activeIndex));
}

function updateStoriesPreviewProgress() {
  const fills = Array.from(document.querySelectorAll('#storiesPreviewProgress .stories-preview-progress-fill'));
  const currentSlide = previewStoryState.slides[previewStoryState.slideIndex];
  const currentProgress = currentSlide
    ? Math.min((previewStoryState.elapsed / currentSlide.duration) * 100, 100)
    : 0;

  fills.forEach((fill, index) => {
    if (index < previewStoryState.slideIndex) {
      fill.style.width = '100%';
    } else if (index > previewStoryState.slideIndex) {
      fill.style.width = '0%';
    } else if (previewStoryState.finished) {
      fill.style.width = '100%';
    } else {
      fill.style.width = `${currentProgress}%`;
    }
  });
}

function setActiveStoriesPreviewSlide(index, { resetElapsed = true } = {}) {
  const slides = Array.from(document.querySelectorAll('#storiesPreviewSlides .stories-preview-slide'));
  if (!slides.length) return;

  const nextIndex = Math.min(Math.max(index, 0), slides.length - 1);
  previewStoryState.slideIndex = nextIndex;
  if (resetElapsed) previewStoryState.elapsed = 0;

  slides.forEach((slideElement, slideIndex) => {
    slideElement.classList.toggle('active', slideIndex === previewStoryState.slideIndex);
  });

  updateStoriesPreviewLiveCounter();
  updateStoriesPreviewGallerySlide();
  updateStoriesPreviewProgress();
}

function syncStoriesPreviewMode() {
  const cover = document.getElementById('storiesPreviewCover');
  const player = document.getElementById('storiesPreviewPlayer');
  const replayButton = document.getElementById('storiesPreviewReplayButton');
  const shouldShowPlayer = previewStoryState.started || previewStoryState.finished;

  if (cover) cover.classList.toggle('hidden', shouldShowPlayer);
  if (player) player.classList.toggle('hidden', !shouldShowPlayer);
  if (replayButton) replayButton.classList.toggle('hidden', !previewStoryState.finished);
}

function updateStoriesPreviewPauseIndicator() {
  const indicator = document.getElementById('storiesPreviewPauseIndicator');
  if (!indicator) return;
  indicator.classList.toggle('visible', previewStoryState.started && previewStoryState.paused && !previewStoryState.finished);
}

function getStoriesPreviewAudioMoment(audioEl) {
  const desiredMoment = Math.max(0, Number(state.musicMoment) || 0);
  const duration = Number(audioEl?.duration);

  if (Number.isFinite(duration) && duration > 0) {
    return Math.min(desiredMoment, Math.max(0, duration - 0.35));
  }

  return desiredMoment;
}

function resetStoriesPreviewAudio() {
  const audioEl = document.getElementById('storiesPreviewAudio');
  if (!audioEl) return;

  audioEl.pause();

  if (!state.previewUrl) {
    audioEl.removeAttribute('src');
    audioEl.removeAttribute('data-source');
    audioEl.load();
    return;
  }

  if (audioEl.dataset.source !== state.previewUrl) {
    audioEl.src = state.previewUrl;
    audioEl.dataset.source = state.previewUrl;
    audioEl.load();
  }

  try {
    audioEl.currentTime = getStoriesPreviewAudioMoment(audioEl);
  } catch (_) { /* metadata pendente */ }
}

async function startStoriesPreviewAudio() {
  const audioEl = document.getElementById('storiesPreviewAudio');
  const wizardAudio = document.getElementById('audioPreview');

  if (!audioEl || !state.previewUrl) return;
  if (wizardAudio && !wizardAudio.paused) wizardAudio.pause();

  if (audioEl.dataset.source !== state.previewUrl) {
    audioEl.src = state.previewUrl;
    audioEl.dataset.source = state.previewUrl;
    audioEl.load();
  }

  try {
    audioEl.currentTime = getStoriesPreviewAudioMoment(audioEl);
  } catch (_) { /* metadata pendente */ }

  try {
    await audioEl.play();
  } catch (_) { /* autoplay bloqueado ou fonte indisponível */ }
}

function pauseStoriesPreviewAudio() {
  const audioEl = document.getElementById('storiesPreviewAudio');
  if (audioEl) audioEl.pause();
}

function resumeStoriesPreviewAudio() {
  const audioEl = document.getElementById('storiesPreviewAudio');
  if (!audioEl || !state.previewUrl) return;
  audioEl.play().catch(() => {});
}

function renderStoriesPreview(previewData) {
  const coverPhoto = previewData.cover || previewData.galleryPhotos[0] || '';
  const coverImage = document.getElementById('storiesPreviewCoverImage');
  const coverPlaceholder = document.getElementById('storiesPreviewCoverPlaceholder');
  setTextSafe('storiesPreviewCoverTitle', `${previewData.sender} criou um presente para você ❤`);
  setTextSafe('storiesPreviewCoverCopy', 'Clique abaixo para abrir');
  setTextSafe('storiesPreviewTrack', previewData.trackLabel);

  if (coverImage) {
    if (coverPhoto) {
      coverImage.src = coverPhoto;
      coverImage.classList.remove('hidden');
      if (coverPlaceholder) coverPlaceholder.classList.add('hidden');
    } else {
      coverImage.classList.add('hidden');
      if (coverPlaceholder) coverPlaceholder.classList.remove('hidden');
    }
  }

  previewStoryState.slides = buildStoriesPreviewSlides(previewData);
  renderStoriesPreviewProgress(previewStoryState.slides);
  renderStoriesPreviewSlides(previewStoryState.slides);

  if (previewStoryState.started || previewStoryState.finished) {
    const nextIndex = Math.min(previewStoryState.slideIndex, Math.max(previewStoryState.slides.length - 1, 0));
    setActiveStoriesPreviewSlide(nextIndex, { resetElapsed: false });
  } else {
    setActiveStoriesPreviewSlide(0);
    updateStoriesPreviewProgress();
  }

  updateStoriesPreviewLiveCounter();
  updateStoriesPreviewPauseIndicator();
  syncStoriesPreviewMode();
}

function startStoriesPreviewTicker() {
  if (previewStoryState.timerId) return;

  previewStoryState.timerId = window.setInterval(() => {
    if (!previewStoryState.started || previewStoryState.paused || previewStoryState.finished) return;

    const currentSlide = previewStoryState.slides[previewStoryState.slideIndex];
    if (!currentSlide) return;

    previewStoryState.elapsed += STORY_PREVIEW_INTERVAL_MS;
    updateStoriesPreviewProgress();

    if (currentSlide.type === 'gallery') {
      updateStoriesPreviewGallerySlide();
    }

    if (previewStoryState.elapsed >= currentSlide.duration) {
      nextStoriesPreviewSlide();
    }
  }, STORY_PREVIEW_INTERVAL_MS);
}

function stopStoriesPreviewAnimation({ resetProgress = false } = {}) {
  if (previewStoryState.timerId) {
    window.clearInterval(previewStoryState.timerId);
    previewStoryState.timerId = null;
  }

  stopStoriesPreviewLiveCounter();

  if (resetProgress) {
    document.querySelectorAll('#storiesPreviewProgress .stories-preview-progress-fill').forEach((fill) => {
      fill.style.width = '0%';
    });
  }
}

function finishStoriesPreview() {
  const currentSlide = previewStoryState.slides[previewStoryState.slideIndex];

  previewStoryState.finished = true;
  previewStoryState.paused = false;
  previewStoryState.elapsed = currentSlide?.duration || 0;

  pauseStoriesPreviewAudio();
  stopStoriesPreviewAnimation();
  updateStoriesPreviewPauseIndicator();
  updateStoriesPreviewProgress();
  syncStoriesPreviewMode();
}

async function startStoriesPreview() {
  if (previewStoryState.started && !previewStoryState.finished) return;
  if (!previewStoryState.slides.length) return;

  previewStoryState.started = true;
  previewStoryState.paused = false;
  previewStoryState.finished = false;
  previewStoryState.slideIndex = 0;
  previewStoryState.galleryIndex = 0;
  previewStoryState.elapsed = 0;

  syncStoriesPreviewMode();
  setActiveStoriesPreviewSlide(0);
  updateStoriesPreviewPauseIndicator();
  startStoriesPreviewLiveCounter();
  startStoriesPreviewTicker();
  await startStoriesPreviewAudio();
}

function toggleStoriesPreviewPause() {
  if (!previewStoryState.started || previewStoryState.finished) return;

  previewStoryState.paused = !previewStoryState.paused;
  updateStoriesPreviewPauseIndicator();

  if (previewStoryState.paused) pauseStoriesPreviewAudio();
  else resumeStoriesPreviewAudio();
}

function nextStoriesPreviewSlide() {
  if (!previewStoryState.slides.length) return;

  if (previewStoryState.slideIndex >= previewStoryState.slides.length - 1) {
    finishStoriesPreview();
    return;
  }

  previewStoryState.finished = false;
  setActiveStoriesPreviewSlide(previewStoryState.slideIndex + 1);
  syncStoriesPreviewMode();
}

function prevStoriesPreviewSlide() {
  if (!previewStoryState.slides.length || !previewStoryState.started) return;

  previewStoryState.finished = false;

  if (previewStoryState.slideIndex === 0) {
    setActiveStoriesPreviewSlide(0);
    syncStoriesPreviewMode();
    return;
  }

  setActiveStoriesPreviewSlide(previewStoryState.slideIndex - 1);
  syncStoriesPreviewMode();
}

function resetStoriesPreviewState() {
  stopStoriesPreviewAnimation({ resetProgress: true });
  pauseStoriesPreviewAudio();
  resetStoriesPreviewAudio();

  previewStoryState.slideIndex = 0;
  previewStoryState.galleryIndex = 0;
  previewStoryState.elapsed = 0;
  previewStoryState.started = false;
  previewStoryState.paused = false;
  previewStoryState.finished = false;

  updateStoriesPreviewPauseIndicator();
  syncStoriesPreviewMode();
}

function updatePreview() {
  const previewData = buildPreviewData();
  const template = getPreviewTemplate();

  updatePreviewTemplateUI(template);
  renderSpotifyPreview(previewData);
  renderStoriesPreview(previewData);

  if (template === 'spotify') startPhotoSlideshow();
  else stopPhotoSlideshow();

  if (template !== 'stories') resetStoriesPreviewState();

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
   10. BUSCA DE MÚSICA (Etapa 5) — iTunes Search API + áudio nativo
═══════════════════════════════════════════════════════════════ */
function generateWaveBars() {
  const wave = document.querySelector('.music-moment-wave');
  if (!wave) return;
  wave.innerHTML = '';
  const BAR_COUNT = 52;
  for (let i = 0; i < BAR_COUNT; i++) {
    const t = i / BAR_COUNT;
    // Combina senoides em diferentes frequências para parecer um waveform real
    const h = 22
      + Math.abs(Math.sin(t * Math.PI * 6.3) * 34)
      + Math.abs(Math.sin(t * Math.PI * 13.7 + 1.2) * 18)
      + Math.abs(Math.sin(t * Math.PI * 3.1 + 0.5) * 14);
    const bar = document.createElement('div');
    bar.className = 'music-moment-wave-bar';
    bar.style.height = `${Math.min(Math.round(h), 92)}%`;
    wave.appendChild(bar);
  }
}

function setupMusicSearch() {
  const searchInput     = document.getElementById('musicSearch');
  const suggestionsList = document.getElementById('musicSuggestions');
  const btnPlay         = document.getElementById('btnPlay');
  const btnPreviewMoment = document.getElementById('btnPreviewMoment');
  const audioEl         = document.getElementById('audioPreview');
  const momentPicker    = document.getElementById('musicMomentPicker');
  const momentTrack     = document.getElementById('musicMomentTrack');
  const momentSelection = document.getElementById('musicMomentSelection');
  const handleStart     = document.getElementById('momentHandleStart');
  const handleEnd       = document.getElementById('momentHandleEnd');
  const momentValue     = document.getElementById('musicMomentValue');
  const momentSpan      = document.getElementById('musicMomentSpan');

  const MAX_CLIP = DEFAULT_PREVIEW_DURATION_SECONDS;
  const MIN_CLIP = 1;

  let debounceTimer = null;
  let highlighted   = -1;

  // Restaura campo de busca e áudio se já há música salva
  if (state.youtubeQuery) searchInput.value = state.youtubeQuery;
  if (state.previewUrl) {
    audioEl.src = state.previewUrl;
    audioEl.load();
  }

  syncPlaybackButtons(false);
  generateWaveBars();
  updateMomentPicker();

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

  async function fetchSuggestions(query) {
    try {
      const res  = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=8&country=BR`
      );
      const data = await res.json();
      renderSuggestions(data.results || []);
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
      img.src       = track.artworkUrl60 || '';
      img.alt       = '';
      img.className = 'suggestion-art';
      img.loading   = 'lazy';

      const info       = document.createElement('div');
      info.className   = 'suggestion-info';
      const trackSpan  = document.createElement('span');
      trackSpan.className   = 'suggestion-track';
      trackSpan.textContent = track.trackName;
      const artistSpan = document.createElement('span');
      artistSpan.className   = 'suggestion-artist';
      artistSpan.textContent = track.artistName;

      info.appendChild(trackSpan);
      info.appendChild(artistSpan);
      li.appendChild(img);
      li.appendChild(info);

      li.addEventListener('mousedown', e => {
        e.preventDefault();
        selectTrack(track);
      });

      suggestionsList.appendChild(li);
    });

    suggestionsList.classList.remove('hidden');
  }

  function selectTrack(track) {
    suggestionsList.classList.add('hidden');
    searchInput.value = `${track.trackName} — ${track.artistName}`;

    stopPreviewPlayback(false);

    // Sempre atualiza nome e artista ao selecionar uma música
    const songEl   = document.getElementById('songName');
    const artistEl = document.getElementById('artistName');
    songEl.value     = track.trackName;
    state.songName   = track.trackName;
    artistEl.value   = track.artistName;
    state.artistName = track.artistName;

    state.youtubeQuery = `${track.trackName} ${track.artistName}`;
    state.previewUrl   = track.previewUrl || '';
    state.musicDuration = Number.isFinite(track.trackTimeMillis)
      ? Math.max(Math.round(track.trackTimeMillis / 1000), DEFAULT_PREVIEW_DURATION_SECONDS)
      : DEFAULT_PREVIEW_DURATION_SECONDS;
    state.musicMoment    = 0;
    state.musicMomentEnd = Math.min(DEFAULT_PREVIEW_DURATION_SECONDS, state.musicDuration);
    audioEl.src          = state.previewUrl;
    audioEl.load();

    updateMomentPicker();
    saveState();
    updatePreview();
  }

  function getPlayablePreviewStart() {
    const previewDuration = getMusicPreviewDuration(audioEl);
    return state.musicMoment <= previewDuration ? state.musicMoment : 0;
  }

  function getPreviewTimelineCurrent() {
    const previewStart = getPlayablePreviewStart();
    const elapsed = Math.max(0, (audioEl.currentTime || previewStart) - previewStart);
    const clipDur = Math.max(MIN_CLIP, state.musicMomentEnd - state.musicMoment);
    return Math.min(elapsed, clipDur);
  }

  // Play / pause do preview da música
  function togglePreviewPlayback() {
    if (!state.previewUrl) {
      showToast('Adicione uma música na etapa 5 🎵');
      return;
    }

    if (audioEl.paused) {
      const startMoment = getPlayablePreviewStart();
      try {
        audioEl.currentTime = startMoment;
      } catch (_) { /* metadata pendente */ }

      audioEl.play()
        .then(() => {
          syncPlaybackButtons(true);
          syncMusicPreviewDisplay(getPreviewTimelineCurrent(), Math.max(MIN_CLIP, state.musicMomentEnd - state.musicMoment));
        })
        .catch(() => showToast('Não foi possível reproduzir o áudio'));
    } else {
      stopPreviewPlayback();
    }
  }

  btnPlay.addEventListener('click', togglePreviewPlayback);
  btnPreviewMoment.addEventListener('click', togglePreviewPlayback);

  // ── Drag de dois handles ────────────────────────────────────
  let dragType = null;
  let dragStartX = 0;
  let dragStartMoment = 0;
  let dragStartEnd = 0;

  function onDragMove(e) {
    const duration = getSelectedTrackDuration(audioEl);
    if (!duration || !dragType) return;
    const trackWidth = momentTrack.getBoundingClientRect().width;
    const deltaSeconds = ((e.clientX - dragStartX) / trackWidth) * duration;

    if (dragType === 'start') {
      let s = dragStartMoment + deltaSeconds;
      s = Math.max(0, Math.min(s, state.musicMomentEnd - MIN_CLIP));
      if (state.musicMomentEnd - s > MAX_CLIP) s = state.musicMomentEnd - MAX_CLIP;
      state.musicMoment = s;
    } else if (dragType === 'end') {
      let end = dragStartEnd + deltaSeconds;
      end = Math.min(duration, Math.max(end, state.musicMoment + MIN_CLIP));
      if (end - state.musicMoment > MAX_CLIP) end = state.musicMoment + MAX_CLIP;
      state.musicMomentEnd = end;
    } else {
      const clipDur = dragStartEnd - dragStartMoment;
      let s = dragStartMoment + deltaSeconds;
      s = Math.max(0, Math.min(s, duration - clipDur));
      state.musicMoment    = s;
      state.musicMomentEnd = s + clipDur;
    }
    updateMomentPicker();
  }

  function onDragEnd(e) {
    if (!dragType) return;
    dragType = null;
    momentPicker.classList.remove('is-dragging');
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup',     onDragEnd);
    document.removeEventListener('pointercancel', onDragEnd); /* limpa se iOS cancelar o gesto */
    if (!audioEl.paused) {
      try { audioEl.currentTime = getPlayablePreviewStart(); } catch (_) {}
    }
    clearTimeout(debounceTimer);
    saveState();
    updatePreview();
  }

  function startDrag(e, type) {
    dragType        = type;
    dragStartX      = e.clientX;
    dragStartMoment = state.musicMoment;
    dragStartEnd    = state.musicMomentEnd;
    momentPicker.classList.add('is-dragging');
    document.addEventListener('pointermove',   onDragMove);
    document.addEventListener('pointerup',     onDragEnd);
    document.addEventListener('pointercancel', onDragEnd); /* iOS pode cancelar com pointercancel */
    e.preventDefault();
  }

  /* ATENÇÃO — NÃO voltar a bindar pointerdown nos elementos .music-moment-handle
     ou em #musicMomentSelection. Aprendido na marra:

     Os handles têm 28px de largura cada e ficam posicionados em left/right -6px
     dentro da seleção. Quando o trecho selecionado é pequeno (ex.: 30s clip
     dentro de uma música de 3min ≈ 16% do track ≈ 45px), os dois handles
     somados cobrem 100% da seleção — não sobra UM pixel sequer pro usuário
     tocar e arrastar o conjunto. Resultado: pan vira impossível no mobile.

     Por isso o roteamento é POR POSIÇÃO (clientX vs. selLeftPx/selRightPx),
     num único listener no pai (#musicMomentTrack), e não por target/element.
     Tap dentro de HANDLE_HIT_INNER de uma das bordas → resize daquele handle.
     Qualquer outro tap → pan (com salto se for fora da seleção).

     Se for mexer aqui no futuro, rode o caso "trecho de 30s numa música de 3min"
     no DevTools mobile antes de fazer commit. */
  const HANDLE_HIT_INNER = 12; /* px de tolerância em torno de cada borda da seleção */
  momentTrack.addEventListener('pointerdown', e => {
    if (momentPicker.classList.contains('is-disabled')) return;
    const duration = getSelectedTrackDuration(audioEl);
    if (!duration) return;
    const trackRect = momentTrack.getBoundingClientRect();
    const x = e.clientX - trackRect.left;
    const selLeftPx  = (state.musicMoment    / duration) * trackRect.width;
    const selRightPx = (state.musicMomentEnd / duration) * trackRect.width;

    if (Math.abs(x - selLeftPx) <= HANDLE_HIT_INNER)  { startDrag(e, 'start'); return; }
    if (Math.abs(x - selRightPx) <= HANDLE_HIT_INNER) { startDrag(e, 'end');   return; }

    const tapTime = (x / trackRect.width) * duration;
    const clipDur = state.musicMomentEnd - state.musicMoment;
    if (tapTime < state.musicMoment || tapTime > state.musicMomentEnd) {
      let newStart = tapTime - clipDur / 2;
      newStart = Math.max(0, Math.min(duration - clipDur, newStart));
      state.musicMoment    = newStart;
      state.musicMomentEnd = newStart + clipDur;
      updateMomentPicker();
    }
    startDrag(e, 'pan');
  });

  audioEl.addEventListener('loadedmetadata', () => {
    const dur = getSelectedTrackDuration(audioEl);
    state.musicMoment    = Math.max(0, Math.min(state.musicMoment, dur));
    state.musicMomentEnd = Math.max(state.musicMoment + 1, Math.min(state.musicMomentEnd, dur));
    updateMomentPicker();
    updatePreview();
    saveState();
  });

  audioEl.addEventListener('timeupdate', () => {
    const clipEnd = Math.min(state.musicMomentEnd, getMusicPreviewDuration(audioEl));

    if (!momentPicker.classList.contains('is-dragging')) {
      syncMusicPreviewDisplay(getPreviewTimelineCurrent(), Math.max(MIN_CLIP, state.musicMomentEnd - state.musicMoment));
    }

    if (!audioEl.paused && audioEl.currentTime >= clipEnd - 0.05) {
      stopPreviewPlayback();
    }
  });

  audioEl.addEventListener('pause', () => {
    syncPlaybackButtons(false);
  });

  audioEl.addEventListener('ended', () => {
    stopPreviewPlayback();
  });

  function updateHighlight(items) {
    items.forEach((li, i) => li.classList.toggle('highlighted', i === highlighted));
  }

  function syncPlaybackButtons(isPlaying) {
    btnPlay.textContent = isPlaying ? '⏸' : '▶';
    btnPreviewMoment.textContent = isPlaying ? 'Pausar trecho' : 'Ouvir trecho';
    btnPreviewMoment.classList.toggle('playing', isPlaying);
  }

  function stopPreviewPlayback(resetToMoment = true) {
    audioEl.pause();

    if (resetToMoment && state.previewUrl) {
      const startMoment = getPlayablePreviewStart();
      try {
        audioEl.currentTime = startMoment;
      } catch (_) { /* no-op */ }
      syncMusicPreviewDisplay(0, Math.max(MIN_CLIP, state.musicMomentEnd - state.musicMoment));
    }

    syncPlaybackButtons(false);
  }

  function updateMomentPicker() {
    const duration   = getSelectedTrackDuration(audioEl);
    const hasPreview = Boolean(state.previewUrl);

    // Clamp ambos os valores dentro da música
    const safeStart = Math.max(0, Math.min(state.musicMoment, duration || 0));
    const safeEnd   = Math.max(safeStart + MIN_CLIP, Math.min(state.musicMomentEnd, duration || MIN_CLIP));
    state.musicMoment    = safeStart;
    state.musicMomentEnd = safeEnd;

    momentPicker.classList.toggle('is-disabled', !hasPreview);
    btnPreviewMoment.disabled = !hasPreview;

    if (duration > 0) {
      momentSelection.style.left  = `${(safeStart / duration) * 100}%`;
      momentSelection.style.right = `${((duration - safeEnd) / duration) * 100}%`;
    } else {
      momentSelection.style.left  = '0%';
      momentSelection.style.right = '0%';
    }

    const labelStart  = document.getElementById('momentLabelStart');
    const labelEnd    = document.getElementById('momentLabelEnd');
    const totalDurEl  = document.getElementById('musicMomentTotalDuration');
    if (labelStart)  labelStart.textContent  = hasPreview ? formatAudioTime(safeStart) : '';
    if (labelEnd)    labelEnd.textContent    = hasPreview ? formatAudioTime(safeEnd)   : '';
    if (totalDurEl)  totalDurEl.textContent  = hasPreview ? formatAudioTime(duration)  : '';

    const clipDur = safeEnd - safeStart;
    if (hasPreview) {
      momentValue.textContent = `${formatAudioTime(safeStart)} — ${formatAudioTime(safeEnd)}`;
      momentSpan.textContent  = `${formatAudioTime(clipDur)} selecionados de ${formatAudioTime(duration)}`;
    } else {
      momentValue.textContent = 'Selecione uma música para escolher o momento';
      momentSpan.textContent  = 'Máximo de 30 segundos';
    }

    if (audioEl.paused) {
      syncMusicPreviewDisplay(0, Math.max(MIN_CLIP, safeEnd - safeStart));
    }
  }
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

function setupStoriesPreviewControls() {
  const startButton = document.getElementById('storiesPreviewStartButton');
  const prevZone = document.getElementById('storiesPreviewPrevZone');
  const pauseZone = document.getElementById('storiesPreviewPauseZone');
  const nextZone = document.getElementById('storiesPreviewNextZone');
  const replayButton = document.getElementById('storiesPreviewReplayButton');
  const audioEl = document.getElementById('storiesPreviewAudio');

  if (startButton) startButton.addEventListener('click', startStoriesPreview);
  if (prevZone) prevZone.addEventListener('click', prevStoriesPreviewSlide);
  if (pauseZone) pauseZone.addEventListener('click', toggleStoriesPreviewPause);
  if (nextZone) nextZone.addEventListener('click', nextStoriesPreviewSlide);
  if (replayButton) {
    replayButton.addEventListener('click', async () => {
      resetStoriesPreviewState();
      await startStoriesPreview();
    });
  }

  if (audioEl && !audioEl.dataset.bound) {
    audioEl.addEventListener('loadedmetadata', () => {
      if (!previewStoryState.started) return;

      try {
        audioEl.currentTime = getStoriesPreviewAudioMoment(audioEl);
      } catch (_) { /* metadata pendente */ }
    });

    audioEl.addEventListener('ended', () => {
      if (!previewStoryState.started || previewStoryState.finished || previewStoryState.paused || !state.previewUrl) return;

      try {
        audioEl.currentTime = getStoriesPreviewAudioMoment(audioEl);
      } catch (_) { /* metadata pendente */ }

      audioEl.play().catch(() => {});
    });

    audioEl.dataset.bound = '1';
  }
}

/* ═══════════════════════════════════════════════════════════════
   13. UPGRADE BANNER
═══════════════════════════════════════════════════════════════ */
function setupUpgradeLegacy() {
  const btn = document.getElementById('btnUpgrade');
  if (!btn) return;

  function renderUpgradeState() {
    btn.classList.toggle('added', !!state.wrappedSelected);
    btn.textContent = state.wrappedSelected ? 'OK Adicionado' : 'Adicionar';
  }
  btn.addEventListener('click', () => {
    state.wrappedSelected = !state.wrappedSelected;
    saveState();
    renderUpgradeState();
    showToast(state.wrappedSelected ? 'Wrapped adicionado ao presente!' : 'Wrapped removido');
    return;
    if (btn.classList.contains('added')) {
      btn.classList.remove('added');
      btn.textContent = 'Adicionar';
      localStorage.removeItem('soulmates_pending_wrapped');
      showToast('Versão Wrapped removida');
    } else {
      btn.classList.add('added');
      btn.textContent = '✓ Adicionado';
      localStorage.setItem('soulmates_pending_wrapped', '1');
      showToast('🎁 Wrapped adicionado ao pedido!');
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   13b. BOTÕES DE PLANO — redireciona para login/pagamento
═══════════════════════════════════════════════════════════════ */
function setupPlanButtons() {
  document.querySelectorAll('.btn-plan:not([data-plan])').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = btn.closest('.plan-card').classList.contains('featured') ? 'vitalicio' : '24h';
      localStorage.setItem('soulmates_pending_plan', plan);

      const loggedIn = localStorage.getItem('soulmates_session');
      document.body.style.opacity = '0';
      document.body.style.transition = 'opacity 0.4s ease';
      setTimeout(() => {
        window.location.href = loggedIn ? '../pagamento.html' : '../login.html';
      }, 400);
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   14. BIND DOS CAMPOS DE ENTRADA
      Cada campo atualiza state + preview automaticamente
═══════════════════════════════════════════════════════════════ */
function setupUpgrade() {
  const btn = document.getElementById('btnUpgrade');
  if (!btn) return;

  btn.classList.toggle('added', !!state.wrappedSelected);
  btn.textContent = state.wrappedSelected ? 'OK Adicionado' : 'Adicionar';

  btn.addEventListener('click', () => {
    state.wrappedSelected = !state.wrappedSelected;
    btn.classList.toggle('added', !!state.wrappedSelected);
    btn.textContent = state.wrappedSelected ? 'OK Adicionado' : 'Adicionar';
    saveState();
    showToast(state.wrappedSelected ? 'Wrapped adicionado ao presente!' : 'Wrapped removido');
  });
}

function setupPlanSelection() {
  document.querySelectorAll('.btn-plan[data-plan]').forEach(button => {
    button.addEventListener('click', () => {
      openFinalGift(button.dataset.plan);
    });
  });
}

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

  /* Etapa 9 — template */
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      resetStoriesPreviewState();
      state.selectedTemplate = card.dataset.template;
      saveState();
      updatePreview();
    });

    if (card.dataset.template === state.selectedTemplate) card.classList.add('selected');
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
  };

  for (const [id, stateKey] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.value = state[stateKey] || '';
  }

  // Char counts
  const titleCount = document.getElementById('titleCount');
  const msgCount   = document.getElementById('msgCount');
  if (titleCount) titleCount.textContent = (state.title || '').length;
  if (msgCount)   msgCount.textContent   = (state.message || '').length;
}

/* ═══════════════════════════════════════════════════════════════
   15. SALVAR PRESENTE CONCLUÍDO
═══════════════════════════════════════════════════════════════ */
const GIFTS_KEY = 'soulmates_gifts';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

function saveGift() {
  const id = generateId();

  // Salva o ID separadamente primeiro — é pequeno e nunca falha por quota
  localStorage.setItem('soulmates_last_gift_id', id);

  // Salva metadados mínimos para o pagamento.html exibir o resumo
  localStorage.setItem('soulmates_last_gift_meta', JSON.stringify({
    id, name1: state.name1, name2: state.name2, title: state.title, template: getFinalTemplate(),
  }));

  try {
    const gifts = JSON.parse(localStorage.getItem(GIFTS_KEY) || '[]');
    const gift = {
      id,
      name1:      state.name1,
      name2:      state.name2,
      startDate:  state.startDate,
      city:       state.city,
      title:      state.title,
      selectedTemplate: getFinalTemplate(),
      youtubeId:  state.youtubeId,
      previewUrl: state.previewUrl,
      musicDuration: state.musicDuration,
      musicMoment:    state.musicMoment,
      musicMomentEnd: state.musicMomentEnd,
      songName:   state.songName,
      artistName: state.artistName,
      photos:     state.photos,
      message:    state.message,
      extraPhoto: state.extraPhoto,
      giftType:   state.giftType,
      wrappedSelected: state.wrappedSelected,
      createdAt:  new Date().toISOString(),
    };
    gifts.push(gift);
    localStorage.setItem(GIFTS_KEY, JSON.stringify(gifts));
    // Limpa o estado do wizard para um novo presente
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) { /* ignora erros de storage — ID já está salvo separadamente */ }
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
   17. SINCRONIZA O PLAYER DO PREVIEW
═══════════════════════════════════════════════════════════════ */
function animatePlayerBar() {
  syncMusicPreviewDisplay(0, Math.max(1, state.musicMomentEnd - state.musicMoment));
}

/* ═══════════════════════════════════════════════════════════════
   18. INICIALIZAÇÃO
═══════════════════════════════════════════════════════════════ */
function init() {
  loadState();
  loadCidades(); // async — popula CIDADES em background via API IBGE
  bindInputs();
  setupAutocomplete();
  setupPhotoUpload();
  setupExtraPhotoUpload();
  setupMusicSearch();
  setupFaq();
  setupNavigation();
  setupMobilePreview();
  setupStoriesPreviewControls();
  setupUpgrade();
  setupPlanSelection();
  setupPlanButtons();
  animatePlayerBar();

  /* Hora real na status bar — atualiza a cada minuto */
  updateStatusTime();
  setInterval(updateStatusTime, 60000);

  /* Restaura a etapa onde o usuário parou */
  showStep(state.currentStep);
  updatePreview();

  /* Contador se já tiver data */
  if (state.startDate) startCounter(state.startDate);
}

document.addEventListener('DOMContentLoaded', init);
