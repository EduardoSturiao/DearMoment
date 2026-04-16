'use strict';

const STORAGE_KEY = 'soulmates_wizard_state';
const STORY_INTERVAL_MS = 60;
const PHOTO_DURATION_MS = 1500;
const BASE_SLIDE_DURATION_MS = 4200;
const MESSAGE_CHUNK_LIMIT = 110;
const OPENING_MESSAGE_CHUNK_LIMIT = 60;

const PLAN_META = {
  vitalicio: {
    label: 'Plano vitalício',
    title: 'Uma lembrança pensada para durar muito mais do que um momento.',
    copy: 'Essa entrega foi desenhada para continuar emocionante sempre que for revisitada.'
  },
  '24h': {
    label: 'Plano 24h',
    title: 'Uma surpresa feita para marcar o instante certo.',
    copy: 'Mesmo em uma entrega mais curta, a intenção continua grande e memorável.'
  },
  default: {
    label: 'Presente SoulMates',
    title: 'Um presente para ser revisitado sempre que bater saudade.',
    copy: 'Criado com cuidado para transformar música, imagem e palavras em uma única lembrança.'
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
  youtubeApiPromise: null,
  youtubePlayerPromise: null,
  youtubePlayer: null,
  nativeAudio: null
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
    ? 'Tem amizades que merecem um espaço só delas. Esta página foi criada para guardar os momentos, o carinho e a presença que fazem essa história ser tão especial.'
    : 'Tem histórias que merecem um espaço só delas. Esta página foi criada para guardar a música, as imagens e tudo aquilo que faz esse amor continuar vivo todos os dias.';
}

function formatDate(dateStr) {
  if (!dateStr) return 'um dia inesquecível';

  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'um dia inesquecível';

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
  const name1 = state.name1?.trim() || 'Alguém especial';
  const name2 = state.name2?.trim() || 'você';
  const city = state.city?.trim() || 'um lugar especial';
  const song = state.songName?.trim() || 'Nossa música';
  const artist = state.artistName?.trim() || 'Artista';
  const audioSrc = state.previewUrl?.trim() || '';
  const audioStartTime = Math.max(0, Number(state.musicMoment) || 0);
  const hasMusic = Boolean(audioSrc || state.youtubeId);
  const message = state.message?.trim() || getDefaultMessage();
  const signaturePrefix = state.giftType === 'amigo' ? 'Com carinho' : 'Com amor';

  let closingCopy = planMeta.copy;

  if (state.wrappedSelected) {
    closingCopy += ' A abertura Wrapped também faz parte desta entrega.';
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
    audioSrc,
    audioStartTime,
    hasMusic,
    trackLabel: hasMusic ? `${song} - ${artist}` : 'Sem trilha sonora',
    signature: `${signaturePrefix}, ${name1}.`,
    coverTitle: `${name1} criou um presente para você ❤`,
    coverCopy: 'Clique abaixo para abrir',
    galleryCopy: state.title?.trim() || 'Nem toda lembrança cabe em palavras.',
    closingCopy
  };
}

function splitMessageIntoSlides(text) {
  return splitTextIntoChunks(text, MESSAGE_CHUNK_LIMIT);
}

function splitTextIntoChunks(text, limit) {
  const paragraphs = text
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

  if (!chunks.length) return [getDefaultMessage()];
  return chunks;
}

function getMessageDuration(text) {
  return BASE_SLIDE_DURATION_MS + Math.min(text.length * 18, 2600);
}

function buildSlides() {
  const slides = [];
  const [firstMessageChunk = getDefaultMessage(), ...otherMessageChunks] = present.messageSlides;
  const [openingMessage, ...openingOverflowChunks] = splitTextIntoChunks(firstMessageChunk, OPENING_MESSAGE_CHUNK_LIMIT);
  const remainingMessages = [...openingOverflowChunks, ...otherMessageChunks];

  slides.push({
    type: 'message-opening',
    duration: getMessageDuration(openingMessage) + 900,
    frameMedia: present.cover,
    headline: present.name2,
    quote: openingMessage,
    signature: present.signature
  });

  remainingMessages.forEach((messageChunk, index) => {
    slides.push({
      type: 'message',
      duration: getMessageDuration(messageChunk),
      label: index === 0 ? 'Continua' : 'Mais um pedaço',
      headline: `Palavras de ${present.name1}.`,
      quote: messageChunk,
      signature: present.signature
    });
  });

  slides.push({
    type: 'time',
    duration: 5200,
    label: 'Tempo vivido',
    headline: 'Cada instante continua contando.',
    copy: `Desde ${present.formattedDate}, essa história segue acontecendo em tempo real.`
  });

  if (present.photos.length) {
    slides.push({
      type: 'gallery',
      duration: Math.max(present.photos.length * PHOTO_DURATION_MS, 4500),
      label: 'Memórias',
      headline: present.galleryCopy,
      photos: present.photos
    });
  }

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

  if (slide.media && slide.type !== 'message-opening') {
    const media = createElement('div', 'story-slide-media');
    const overlay = createElement('div', 'story-slide-overlay');
    applyMediaBackground(media, slide.media);
    slideElement.append(media, overlay);
  }

  const content = createElement('div', 'story-slide-content');

  if (slide.label && slide.type !== 'message-opening') {
    content.appendChild(createElement('p', 'story-label', slide.label));
  }

  if (slide.headline && slide.type !== 'message-opening') {
    content.appendChild(createElement('h2', 'story-headline', slide.headline));
  }

  if (slide.type === 'message-opening') {
    const openingBlock = createElement('div', 'story-opening-block');
    const copy = createElement('div', 'story-opening-copy');
    const recipientBlock = createElement('div', 'story-opening-recipient-block');
    const recipient = createElement('p', 'story-opening-recipient', `${slide.headline}...`);
    const quote = createElement('p', 'story-opening-quote', slide.quote);
    const footer = createElement('div', 'story-opening-footer');
    const line = createElement('span', 'story-opening-line');
    const signature = createElement('p', 'story-opening-signature', slide.signature);

    if (slide.frameMedia) {
      const frame = createElement('div', 'story-opening-media-frame');
      const image = createElement('img', 'story-opening-media');

      image.src = slide.frameMedia;
      image.alt = `Foto de capa do presente para ${slide.headline}`;
      image.loading = 'eager';

      frame.appendChild(image);
      openingBlock.appendChild(frame);
    }

    footer.append(line, signature);
    recipientBlock.append(recipient);
    copy.append(recipientBlock, quote, footer);
    openingBlock.appendChild(copy);
    content.appendChild(openingBlock);
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

    content.append(stack, indices);
  }

  slideElement.appendChild(content);
  return slideElement;
}

function renderCover() {
  byId('coverTitle').textContent = present.coverTitle;
  byId('coverCopy').textContent = present.coverCopy;
  applyMediaBackground(byId('storyCoverMedia'), present.cover);
  byId('trackLabel').textContent = present.hasMusic ? `${present.song} - ${present.artist}` : present.trackLabel;
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

function updatePauseIndicator() {
  const indicator = byId('pauseIndicator');
  indicator.classList.toggle('visible', storyState.paused);
}

function setPaused(nextValue) {
  if (!storyState.started || storyState.finished) return;

  storyState.paused = nextValue;
  updatePauseIndicator();

  if (nextValue) {
    pauseBackgroundAudio();
  } else {
    resumeBackgroundAudio();
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
  updatePauseIndicator();

  setActiveSlide(0);
  startTicker();
  await startBackgroundAudio();
}

async function restartStory() {
  storyState.finished = false;
  storyState.paused = false;
  storyState.elapsed = 0;

  updatePauseIndicator();
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

function ensureNativeAudio() {
  if (!present.audioSrc) return null;
  if (storyState.nativeAudio) return storyState.nativeAudio;

  const audio = byId('backgroundAudio');
  if (!audio) return null;

  audio.src = present.audioSrc;
  audio.loop = false;
  audio.volume = 1;
  audio.preload = 'auto';

  if (!audio.dataset.momentBound) {
    audio.addEventListener('loadedmetadata', () => {
      setNativeAudioMoment(audio);
    });

    audio.addEventListener('ended', () => {
      setNativeAudioMoment(audio);

      if (storyState.started && !storyState.finished && !storyState.paused) {
        audio.play().catch(() => {});
      }
    });

    audio.dataset.momentBound = '1';
  }

  storyState.nativeAudio = audio;
  return audio;
}

function getNativeAudioMoment(audio) {
  const desiredMoment = Math.max(0, Number(present.audioStartTime) || 0);
  const duration = Number(audio?.duration);

  if (Number.isFinite(duration) && duration > 0) {
    return Math.min(desiredMoment, Math.max(0, duration - 0.35));
  }

  return desiredMoment;
}

function setNativeAudioMoment(audio) {
  if (!audio) return;

  try {
    audio.currentTime = getNativeAudioMoment(audio);
  } catch (_) {
    /* metadata pendente */
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
  const nativeAudio = ensureNativeAudio();

  if (nativeAudio) {
    try {
      setNativeAudioMoment(nativeAudio);
      await nativeAudio.play();
    } catch (_) {
      /* no-op */
    }
    return;
  }

  const player = await ensureBackgroundPlayer();
  if (!player) return;

  safePlayerCall((currentPlayer) => {
    if (present.audioStartTime > 0) {
      currentPlayer.seekTo?.(present.audioStartTime, true);
    }

    currentPlayer.playVideo();
  });
}

function pauseBackgroundAudio() {
  const nativeAudio = ensureNativeAudio();
  if (nativeAudio) {
    nativeAudio.pause();
    return;
  }

  safePlayerCall((player) => player.pauseVideo());
}

function resumeBackgroundAudio() {
  const nativeAudio = ensureNativeAudio();
  if (nativeAudio) {
    nativeAudio.play().catch(() => {});
    return;
  }

  safePlayerCall((player) => player.playVideo());
}

async function restartBackgroundAudio() {
  const nativeAudio = ensureNativeAudio();
  if (nativeAudio) {
    setNativeAudioMoment(nativeAudio);
    nativeAudio.play().catch(() => {});
    return;
  }

  const player = await ensureBackgroundPlayer();
  if (!player) return;

  safePlayerCall((currentPlayer) => {
    currentPlayer.seekTo?.(present.audioStartTime || 0, true);
    currentPlayer.playVideo();
  });
}

function bindEvents() {
  byId('startStoryButton').addEventListener('click', startStory);
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
  renderCover();

  storyState.slides = buildSlides();

  ensureNativeAudio();
  if (!present.audioSrc && present.hasMusic) {
    ensureBackgroundPlayer().catch(() => null);
  }

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

  if (storyState.nativeAudio) {
    storyState.nativeAudio.pause();
  }
});

document.addEventListener('DOMContentLoaded', init);
