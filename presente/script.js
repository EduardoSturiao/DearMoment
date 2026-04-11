'use strict';

const STORAGE_KEY = 'soulmates_wizard_state';
const STORY_INTERVAL_MS = 60;
const PHOTO_DURATION_MS = 1500;
const BASE_SLIDE_DURATION_MS = 4200;
const MESSAGE_CHUNK_LIMIT = 150;

const PLAN_META = {
  vitalicio: {
    label: 'Plano vitalicio',
    title: 'Uma lembranca pensada para durar muito mais do que um momento.',
    copy: 'Essa entrega foi desenhada para continuar emocionante sempre que for revisitada.'
  },
  '24h': {
    label: 'Plano 24h',
    title: 'Uma surpresa feita para marcar o instante certo.',
    copy: 'Mesmo em uma entrega mais curta, a intencao continua grande e memoravel.'
  },
  default: {
    label: 'Presente SoulMates',
    title: 'Um presente para ser revisitado sempre que bater saudade.',
    copy: 'Criado com cuidado para transformar musica, imagem e palavras em uma unica lembranca.'
  }
};

const state = loadState();
const present = buildPresentData();

const storyState = {
  slides: [],
  slideElements: [],
  currentSlideIndex: 0,
  elapsed: 0,
  timerId: null,
  liveCounterId: null,
  paused: false,
  started: false,
  finished: false,
  pauseToastTimer: null,
  youtubeApiPromise: null,
  youtubePlayerPromise: null,
  youtubePlayer: null
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (_) {
    return {};
  }
}

function byId(id) {
  return document.getElementById(id);
}

function getPlanMeta() {
  return PLAN_META[state.selectedPlan] || PLAN_META.default;
}

function getDisplayNames() {
  const first = state.name1?.trim() || 'Nome 1';
  const second = state.name2?.trim() || 'Nome 2';
  return `${first} & ${second}`;
}

function getCoverImage() {
  return state.extraPhoto || getCarouselPhotos()[0] || '';
}

function getCarouselPhotos() {
  if (!Array.isArray(state.photos)) return [];
  return state.photos.filter((photo, index, all) => photo && all.indexOf(photo) === index);
}

function getDefaultTitle() {
  return state.giftType === 'amigo'
    ? 'Uma surpresa para celebrar uma amizade que faz bem.'
    : 'Um presente feito para lembrar o quanto esse amor importa.';
}

function getDefaultMessage() {
  return state.giftType === 'amigo'
    ? 'Tem amizades que merecem um espaco so delas. Esta pagina foi criada para guardar os momentos, o carinho e a presenca que fazem essa historia ser tao especial.'
    : 'Tem historias que merecem um espaco so delas. Esta pagina foi criada para guardar a musica, as imagens e tudo aquilo que faz esse amor continuar vivo todos os dias.';
}

function formatDate(dateStr) {
  if (!dateStr) return 'um dia inesquecivel';

  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'um dia inesquecivel';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function calcTimeSince(dateStr) {
  if (!dateStr) return null;

  const start = new Date(`${dateStr}T00:00:00`);
  const now = new Date();

  if (Number.isNaN(start.getTime()) || start > now) return null;

  let cursor = new Date(start);
  let years = 0;
  let months = 0;

  while (true) {
    const nextYear = new Date(cursor);
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    if (nextYear > now) break;

    cursor = nextYear;
    years += 1;
  }

  while (true) {
    const nextMonth = new Date(cursor);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    if (nextMonth > now) break;

    cursor = nextMonth;
    months += 1;
  }

  let remainingMs = now.getTime() - cursor.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minuteMs = 60 * 1000;
  const secondMs = 1000;

  const days = Math.floor(remainingMs / dayMs);
  remainingMs -= days * dayMs;

  const hours = Math.floor(remainingMs / hourMs);
  remainingMs -= hours * hourMs;

  const minutes = Math.floor(remainingMs / minuteMs);
  remainingMs -= minutes * minuteMs;

  const seconds = Math.floor(remainingMs / secondMs);

  return { years, months, days, hours, minutes, seconds };
}

function buildPresentData() {
  const planMeta = getPlanMeta();
  const photos = getCarouselPhotos();
  const cover = getCoverImage() || '';
  const name1 = state.name1?.trim() || 'Alguem especial';
  const name2 = state.name2?.trim() || 'voce';
  const city = state.city?.trim() || 'um lugar especial';
  const song = state.songName?.trim() || 'Nossa musica';
  const artist = state.artistName?.trim() || 'Artista';
  const message = state.message?.trim() || getDefaultMessage();
  const signaturePrefix = state.giftType === 'amigo' ? 'Com carinho' : 'Com amor';

  let closingCopy = planMeta.copy;

  if (state.wrappedSelected) {
    closingCopy += ' A abertura Wrapped tambem faz parte desta entrega.';
  }

  return {
    planMeta,
    names: getDisplayNames(),
    name1,
    name2,
    city,
    formattedDate: formatDate(state.startDate),
    title: state.title?.trim() || getDefaultTitle(),
    message,
    messageSlides: splitMessageIntoSlides(message),
    cover,
    photos,
    closingImage: photos[photos.length - 1] || cover,
    song,
    artist,
    hasMusic: Boolean(state.youtubeId),
    trackLabel: Boolean(state.youtubeId) ? `${song} - ${artist}` : 'Sem trilha sonora',
    signature: `${signaturePrefix}, ${name1}.`,
    coverKicker: `Para ${name2}`,
    coverTitle: state.title?.trim() || getDefaultTitle(),
    coverCopy: state.title?.trim() || (Boolean(state.youtubeId)
      ? 'Toque para abrir esta historia com fotos, texto e musica ao fundo.'
      : 'Toque para abrir esta historia com fotos, texto e lembrancas.'),
    galleryCopy: state.title?.trim() || 'Nem toda lembranca cabe em palavras.',
    closingCopy
  };
}

function splitMessageIntoSlides(text) {
  const paragraphs = text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks = [];

  paragraphs.forEach((paragraph) => {
    if (paragraph.length <= MESSAGE_CHUNK_LIMIT) {
      chunks.push(paragraph);
      return;
    }

    const sentences = paragraph.match(/[^.!?]+[.!?]?/g) || [paragraph];
    let buffer = '';

    sentences.forEach((sentence) => {
      const next = buffer ? `${buffer} ${sentence.trim()}` : sentence.trim();

      if (next.length > MESSAGE_CHUNK_LIMIT && buffer) {
        chunks.push(buffer);
        buffer = sentence.trim();
      } else {
        buffer = next;
      }
    });

    if (buffer) chunks.push(buffer);
  });

  if (!chunks.length) return [getDefaultMessage()];
  return chunks;
}

function getMessageDuration(text) {
  return BASE_SLIDE_DURATION_MS + Math.min(text.length * 18, 2600);
}

function buildSlides() {
  const slides = [
    {
      type: 'intro',
      duration: 4600,
      media: present.cover,
      label: `Para ${present.name2}`,
      headline: present.names,
      copy: present.title,
      meta: [`Desde ${present.formattedDate}`, `Em ${present.city}`],
      chips: [present.planMeta.label, state.wrappedSelected ? 'Wrapped incluso' : '']
    },
    {
      type: 'time',
      duration: 5200,
      label: 'Tempo vivido',
      headline: 'Cada instante continua contando.',
      copy: `Desde ${present.formattedDate}, essa historia segue acontecendo em tempo real.`
    }
  ];

  present.messageSlides.forEach((messageChunk, index) => {
    slides.push({
      type: 'message',
      duration: getMessageDuration(messageChunk),
      label: index === 0 ? 'Mensagem' : 'Mais um pedaço',
      headline: `Palavras de ${present.name1}.`,
      quote: messageChunk,
      signature: present.signature
    });
  });

  if (present.photos.length) {
    slides.push({
      type: 'gallery',
      duration: Math.max(present.photos.length * PHOTO_DURATION_MS, 4500),
      label: 'Memorias',
      headline: 'Frames que ainda brilham.',
      copy: present.galleryCopy,
      photos: present.photos
    });
  }

  slides.push({
    type: 'closing',
    duration: 5200,
    media: present.closingImage,
    label: 'Feito para emocionar',
    headline: present.planMeta.title,
    copy: present.closingCopy
  });

  return slides;
}

function applyMediaBackground(element, src) {
  if (!element) return;

  if (!src) {
    element.style.removeProperty('background-image');
    return;
  }

  element.style.backgroundImage = `linear-gradient(135deg, rgba(255, 143, 156, 0.26), rgba(242, 176, 175, 0.08)), url("${src}")`;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text) element.textContent = text;

  return element;
}

function createSlideElement(slide, index) {
  const slideElement = createElement('section', `story-slide story-slide-${slide.type}`);
  slideElement.dataset.index = String(index);

  if (slide.media || slide.type === 'intro' || slide.type === 'closing') {
    const media = createElement('div', 'story-slide-media');
    const overlay = createElement('div', 'story-slide-overlay');
    applyMediaBackground(media, slide.media);
    slideElement.append(media, overlay);
  }

  const content = createElement('div', 'story-slide-content');

  if (slide.label) {
    content.appendChild(createElement('p', 'story-label', slide.label));
  }

  if (slide.headline) {
    content.appendChild(createElement('h2', 'story-headline', slide.headline));
  }

  if (slide.type === 'intro') {
    content.appendChild(createElement('p', 'story-copy', slide.copy));

    const metaRow = createElement('div', 'story-meta-row');
    slide.meta.forEach((item) => {
      metaRow.appendChild(createElement('span', 'story-meta-pill', item));
    });
    slide.chips.filter(Boolean).forEach((item) => {
      metaRow.appendChild(createElement('span', 'story-meta-pill', item));
    });
    content.appendChild(metaRow);
  }

  if (slide.type === 'time') {
    const panel = createElement('div', 'story-time-panel');
    const dateLine = createElement('p', 'story-time-date', `Desde ${present.formattedDate}`);
    const primaryGrid = createElement('div', 'story-time-primary');
    const secondaryGrid = createElement('div', 'story-time-secondary');
    const primaryDefs = [
      ['years', 'anos'],
      ['months', 'meses']
    ];
    const secondaryDefs = [
      ['days', 'dias'],
      ['hours', 'horas'],
      ['minutes', 'min'],
      ['seconds', 'seg']
    ];

    primaryDefs.forEach(([key, label]) => {
      const stat = createElement('article', 'story-time-unit story-time-unit-primary');
      const value = createElement('span', 'story-stat-value', '--');
      const caption = createElement('span', 'story-stat-label', label);

      value.dataset.timeKey = key;
      stat.append(value, caption);
      primaryGrid.appendChild(stat);
    });

    secondaryDefs.forEach(([key, label]) => {
      const stat = createElement('article', 'story-time-unit story-time-unit-secondary');
      const value = createElement('span', 'story-stat-value', '--');
      const caption = createElement('span', 'story-stat-label', label);

      value.dataset.timeKey = key;
      stat.append(value, caption);
      secondaryGrid.appendChild(stat);
    });

    panel.append(dateLine, primaryGrid, secondaryGrid);
    content.append(panel, createElement('p', 'story-copy', slide.copy));
  }

  if (slide.type === 'message') {
    const card = createElement('div', 'story-card');
    const quote = createElement('p', 'story-quote', slide.quote);
    const signature = createElement('p', 'story-signature', slide.signature);

    card.append(quote, signature);
    content.appendChild(card);
  }

  if (slide.type === 'gallery') {
    const stack = createElement('div', 'story-gallery-stack');
    const indices = createElement('div', 'story-gallery-indices');

    slide.photos.forEach((photo, photoIndex) => {
      const image = createElement('img', 'story-gallery-image');
      const dot = createElement('span', 'story-gallery-dot');

      image.src = photo;
      image.alt = `Foto ${photoIndex + 1} do presente`;
      image.loading = photoIndex === 0 ? 'eager' : 'lazy';

      if (photoIndex === 0) {
        image.classList.add('active');
        dot.classList.add('active');
      }

      stack.appendChild(image);
      indices.appendChild(dot);
    });

    content.append(stack, indices, createElement('p', 'story-copy', slide.copy));
  }

  if (slide.type === 'closing') {
    content.appendChild(createElement('p', 'story-copy', slide.copy));
  }

  slideElement.appendChild(content);
  return slideElement;
}

function renderPreviewShell() {
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';
  byId('previewShell').classList.toggle('hidden', !isPreview);
}

function renderCover() {
  byId('coverKicker').textContent = present.coverKicker;
  byId('coverTitle').textContent = present.coverTitle;
  applyMediaBackground(byId('storyCoverMedia'), present.cover);
  byId('trackLabel').textContent = present.trackLabel;
}

function renderProgressBars() {
  const container = byId('progressContainer');
  container.innerHTML = '';

  storyState.slides.forEach(() => {
    const segment = createElement('div', 'progress-segment');
    const fill = createElement('div', 'progress-fill');

    segment.appendChild(fill);
    container.appendChild(segment);
  });
}

function renderSlides() {
  const container = byId('storySlides');

  container.innerHTML = '';
  storyState.slideElements = storyState.slides.map((slide, index) => createSlideElement(slide, index));
  storyState.slideElements.forEach((slideElement) => container.appendChild(slideElement));
}

function updateProgressBars() {
  const fills = document.querySelectorAll('.progress-fill');
  const currentSlide = storyState.slides[storyState.currentSlideIndex];
  const currentDuration = currentSlide?.duration || BASE_SLIDE_DURATION_MS;
  const currentWidth = storyState.finished
    ? 100
    : Math.min((storyState.elapsed / currentDuration) * 100, 100);

  fills.forEach((fill, index) => {
    if (index < storyState.currentSlideIndex) {
      fill.style.width = '100%';
    } else if (index > storyState.currentSlideIndex) {
      fill.style.width = '0%';
    } else {
      fill.style.width = `${currentWidth}%`;
    }
  });
}

function updateTimeSlide() {
  const time = calcTimeSince(state.startDate);

  document.querySelectorAll('[data-time-key]').forEach((node) => {
    if (!time) {
      node.textContent = '--';
      return;
    }

    node.textContent = String(time[node.dataset.timeKey]).padStart(2, '0');
  });
}

function startLiveCounter() {
  updateTimeSlide();

  if (storyState.liveCounterId) {
    window.clearInterval(storyState.liveCounterId);
  }

  storyState.liveCounterId = window.setInterval(updateTimeSlide, 1000);
}

function updateGallerySlide() {
  const currentSlide = storyState.slides[storyState.currentSlideIndex];
  const currentElement = storyState.slideElements[storyState.currentSlideIndex];

  if (!currentSlide || currentSlide.type !== 'gallery' || !currentElement) return;

  const images = currentElement.querySelectorAll('.story-gallery-image');
  const dots = currentElement.querySelectorAll('.story-gallery-dot');
  const nextIndex = Math.min(Math.floor(storyState.elapsed / PHOTO_DURATION_MS), images.length - 1);

  images.forEach((image, imageIndex) => {
    image.classList.toggle('active', imageIndex === nextIndex);
  });

  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle('active', dotIndex === nextIndex);
  });
}

function setActiveSlide(nextIndex, resetElapsed = true) {
  storyState.currentSlideIndex = nextIndex;
  storyState.finished = false;

  if (resetElapsed) storyState.elapsed = 0;

  storyState.slideElements.forEach((slideElement, slideIndex) => {
    slideElement.classList.toggle('active', slideIndex === nextIndex);
  });

  byId('replayButton').classList.add('hidden');
  updateProgressBars();
  updateTimeSlide();
  updateGallerySlide();
}

function nextSlide() {
  if (storyState.finished) {
    restartStory();
    return;
  }

  if (storyState.currentSlideIndex >= storyState.slides.length - 1) {
    finishStory();
    return;
  }

  setActiveSlide(storyState.currentSlideIndex + 1);
}

function prevSlide() {
  if (!storyState.started) return;

  const currentSlide = storyState.slides[storyState.currentSlideIndex];

  if (storyState.elapsed > currentSlide.duration * 0.24) {
    storyState.elapsed = 0;
    updateProgressBars();
    updateGallerySlide();
    return;
  }

  if (storyState.currentSlideIndex === 0) {
    storyState.elapsed = 0;
    updateProgressBars();
    return;
  }

  setActiveSlide(storyState.currentSlideIndex - 1);
}

function startTicker() {
  stopTicker();

  storyState.timerId = window.setInterval(() => {
    if (!storyState.started || storyState.paused || storyState.finished) return;

    const currentSlide = storyState.slides[storyState.currentSlideIndex];

    storyState.elapsed += STORY_INTERVAL_MS;
    updateProgressBars();

    if (currentSlide.type === 'gallery') {
      updateGallerySlide();
    }

    if (storyState.elapsed >= currentSlide.duration) {
      nextSlide();
    }
  }, STORY_INTERVAL_MS);
}

function stopTicker() {
  if (!storyState.timerId) return;

  window.clearInterval(storyState.timerId);
  storyState.timerId = null;
}

function showPauseIndicator(text) {
  const indicator = byId('pauseIndicator');

  indicator.textContent = text;
  indicator.classList.add('visible');

  if (storyState.pauseToastTimer) {
    window.clearTimeout(storyState.pauseToastTimer);
  }

  storyState.pauseToastTimer = window.setTimeout(() => {
    indicator.classList.remove('visible');
  }, 1200);
}

function setPaused(nextValue) {
  if (!storyState.started || storyState.finished) return;

  storyState.paused = nextValue;
  byId('pauseButton').textContent = nextValue ? 'Retomar' : 'Pausar';
  byId('pauseButton').setAttribute('aria-pressed', String(nextValue));

  if (nextValue) {
    pauseBackgroundAudio();
    showPauseIndicator('Pausado');
  } else {
    resumeBackgroundAudio();
    showPauseIndicator('Seguindo');
  }
}

function togglePause() {
  setPaused(!storyState.paused);
}

function finishStory() {
  storyState.finished = true;
  storyState.elapsed = storyState.slides[storyState.currentSlideIndex].duration;
  updateProgressBars();
  byId('replayButton').classList.remove('hidden');
}

async function startStory() {
  if (storyState.started) return;

  storyState.started = true;
  storyState.paused = false;
  storyState.finished = false;
  storyState.currentSlideIndex = 0;
  storyState.elapsed = 0;

  byId('storyCover').classList.add('hidden');
  byId('storyPlayer').classList.remove('hidden');
  byId('pauseButton').textContent = 'Pausar';
  byId('pauseButton').setAttribute('aria-pressed', 'false');

  setActiveSlide(0);
  startTicker();
  await startBackgroundAudio();
}

async function restartStory() {
  storyState.finished = false;
  storyState.paused = false;
  storyState.elapsed = 0;

  byId('pauseButton').textContent = 'Pausar';
  byId('pauseButton').setAttribute('aria-pressed', 'false');
  byId('replayButton').classList.add('hidden');

  setActiveSlide(0);
  await restartBackgroundAudio();
}

function safePlayerCall(callback) {
  if (!storyState.youtubePlayer) return;

  try {
    callback(storyState.youtubePlayer);
  } catch (_) {
    /* no-op */
  }
}

function ensureYouTubeApi() {
  if (!present.hasMusic) return Promise.resolve(null);
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (storyState.youtubeApiPromise) return storyState.youtubeApiPromise;

  storyState.youtubeApiPromise = new Promise((resolve) => {
    const previousHandler = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousHandler === 'function') previousHandler();
      resolve(window.YT || null);
    };

    const existingScript = document.querySelector('script[data-youtube-api="1"]');
    if (existingScript) return;

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.dataset.youtubeApi = '1';
    script.onerror = () => resolve(null);

    document.head.appendChild(script);
  });

  return storyState.youtubeApiPromise;
}

function ensureBackgroundPlayer() {
  if (!present.hasMusic) return Promise.resolve(null);
  if (storyState.youtubePlayerPromise) return storyState.youtubePlayerPromise;

  storyState.youtubePlayerPromise = ensureYouTubeApi().then((YT) => {
    if (!YT?.Player) return null;

    return new Promise((resolve) => {
      const host = byId('youtubeAudioHost');
      host.innerHTML = '<div id="youtubeAudioFrame"></div>';

      storyState.youtubePlayer = new YT.Player('youtubeAudioFrame', {
        videoId: state.youtubeId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          loop: 1,
          playlist: state.youtubeId
        },
        events: {
          onReady: (event) => {
            safePlayerCall((player) => player.setVolume?.(70));
            resolve(event.target);
          },
          onError: () => resolve(null)
        }
      });
    });
  });

  return storyState.youtubePlayerPromise;
}

async function startBackgroundAudio() {
  const player = await ensureBackgroundPlayer();
  if (!player) return;

  safePlayerCall((currentPlayer) => currentPlayer.playVideo());
}

function pauseBackgroundAudio() {
  safePlayerCall((player) => player.pauseVideo());
}

function resumeBackgroundAudio() {
  safePlayerCall((player) => player.playVideo());
}

async function restartBackgroundAudio() {
  const player = await ensureBackgroundPlayer();
  if (!player) return;

  safePlayerCall((currentPlayer) => {
    currentPlayer.seekTo?.(0, true);
    currentPlayer.playVideo();
  });
}

function bindEvents() {
  byId('startStoryButton').addEventListener('click', startStory);
  byId('pauseButton').addEventListener('click', togglePause);
  byId('pauseZone').addEventListener('click', togglePause);
  byId('prevZone').addEventListener('click', prevSlide);
  byId('nextZone').addEventListener('click', nextSlide);
  byId('replayButton').addEventListener('click', restartStory);

  document.addEventListener('keydown', (event) => {
    if (!storyState.started) return;

    if (event.key === 'ArrowRight') nextSlide();
    if (event.key === 'ArrowLeft') prevSlide();
    if (event.key === ' ') {
      event.preventDefault();
      togglePause();
    }
  });
}

function init() {
  renderPreviewShell();
  renderCover();

  storyState.slides = buildSlides();

  renderProgressBars();
  renderSlides();
  setActiveSlide(0);
  startLiveCounter();
  bindEvents();
}

window.addEventListener('beforeunload', () => {
  stopTicker();

  if (storyState.liveCounterId) {
    window.clearInterval(storyState.liveCounterId);
  }

  if (storyState.pauseToastTimer) {
    window.clearTimeout(storyState.pauseToastTimer);
  }
});

document.addEventListener('DOMContentLoaded', init);
