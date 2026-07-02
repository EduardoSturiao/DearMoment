/* ================================================================
   DearMoment — GIFT CREATOR WIZARD
   script.js
   Arquitetura: estado global → localStorage → formulário multi-etapa
================================================================ */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   0. MODO EDIÇÃO
═══════════════════════════════════════════════════════════════ */
const _urlParams   = new URLSearchParams(window.location.search);
const EDIT_GIFT_ID = _urlParams.get('edit') || null;
const isEditMode   = !!EDIT_GIFT_ID;

/* ═══════════════════════════════════════════════════════════════
   1. ESTADO GLOBAL
═══════════════════════════════════════════════════════════════ */
const STORAGE_KEY  = 'DearMoment_wizard_state';
const TOTAL_STEPS  = 9;
const FLOW_VERSION = 2;
const DEFAULT_PREVIEW_DURATION_SECONDS = 30;
const BUCKET       = 'gift-images';
const SUPABASE_URL = window.SUPABASE_URL || 'https://imiwhgrjwgydedbfdlkn.supabase.co';

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
  giftId:          '',
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) Object.assign(state, JSON.parse(saved));
    migrateLegacyWizardState();
  } catch (_) {}
  if (!state.giftId) {
    state.giftId = generateId();
    saveState();
  }
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
    CIDADES = data.map(m => {
      try { return `${m.nome}, ${m.microrregiao.mesorregiao.UF.sigla}`; }
      catch (_) { return m.nome || null; }
    }).filter(Boolean);
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

/* Redimensiona e comprime foto antes de gravar no localStorage.
   Mantém máximo 1200px e converte para JPEG — reduz de ~5MB para ~200KB por foto. */
function compressImage(file, maxDimension = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width: w, height: h } = img;
      if (w > maxDimension || h > maxDimension) {
        if (w > h) { h = Math.round(h * maxDimension / w); w = maxDimension; }
        else       { w = Math.round(w * maxDimension / h); h = maxDimension; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); fileToBase64(file).then(resolve); };
    img.src = url;
  });
}

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
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function dataUrlToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(',');
  const mime  = header.match(/:(.*?);/)[1];
  const bstr  = atob(b64);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}

function photoSrc(src) {
  if (!src || src.startsWith('data:')) return src;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${src}`;
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

  /* No step-final em modo edição: mostra painel de salvar, oculta planos/FAQ */
  if (isFinal && isEditMode) {
    const plansGrid  = document.querySelector('.plans-grid');
    const faqSection = document.querySelector('.faq-section');
    const editPanel  = document.getElementById('editSavePanel');
    const subtitle   = document.getElementById('finalSubtitle');
    if (plansGrid)  plansGrid.style.display  = 'none';
    if (faqSection) faqSection.style.display = 'none';
    if (editPanel)  editPanel.style.display  = 'flex';
    if (subtitle)   subtitle.textContent     = 'Revise cada etapa e salve as alterações quando estiver pronto.';
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
      if (new Date(state.startDate + 'T00:00:00') > new Date()) {
        showToast('A data deve ser no passado 📅'); return false;
      }
      if (!state.city.trim()) { showToast('Informe a cidade'); return false; }
      break;
    case 4:
      if (!state.title.trim()) { showToast('Adicione um título'); return false; }
      break;
    case 9: {
      const emptyIdx = state.capsulas.findIndex(c => !c || !c.trim());
      if (emptyIdx !== -1) {
        showToast(`Preencha a mensagem da cápsula ${emptyIdx + 1}`);
        return false;
      }
      break;
    }
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

  let loggedIn = false;
  if (window.sb) {
    const { data } = await window.sb.auth.getSession();
    loggedIn = !!(data && data.session);
  }

  if (loggedIn) {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.4s ease';
    setTimeout(() => { window.location.href = '../pagamento.html'; }, 400);
    return;
  }

  // Não logado → mostrar card de auth inline (FIX-2)
  document.querySelector('.plans-grid').classList.add('hidden');
  document.querySelector('.faq-section').classList.add('hidden');
  document.getElementById('btnPreviewGift').classList.add('hidden');
  document.getElementById('wizard-auth-card').classList.remove('hidden');
}

/* ═══════════════════════════════════════════════════════════════
   AUTH INLINE — FIX-2 (wizard sem redirect para login/cadastro)
═══════════════════════════════════════════════════════════════ */
function setupWizardAuth() {
  const card        = document.getElementById('wizard-auth-card');
  const tabs        = card.querySelectorAll('.wizard-auth-tab');
  const panelLogin  = document.getElementById('wizardAuthLogin');
  const panelSignup = document.getElementById('wizardAuthSignup');

  function showPlans() {
    card.classList.add('hidden');
    document.querySelector('.plans-grid').classList.remove('hidden');
    document.querySelector('.faq-section').classList.remove('hidden');
    document.getElementById('btnPreviewGift').classList.remove('hidden');
  }

  function redirectToPagamento() {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.4s ease';
    setTimeout(() => { window.location.href = '../pagamento.html'; }, 400);
  }

  document.getElementById('wizardAuthBack').addEventListener('click', showPlans);

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      panelLogin.classList.toggle('hidden', !isLogin);
      panelSignup.classList.toggle('hidden', isLogin);
    });
  });

  /* ── Toggle visibilidade de senha ── */
  document.querySelectorAll('.wizard-auth-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  /* ── Login ── */
  document.getElementById('wizardLoginBtn').addEventListener('click', async () => {
    const btn     = document.getElementById('wizardLoginBtn');
    const errorEl = document.getElementById('wizardLoginError');
    const email   = document.getElementById('wizardLoginEmail').value.trim();
    const pass    = document.getElementById('wizardLoginPassword').value;

    errorEl.classList.add('hidden');
    if (!email || !pass) { errorEl.textContent = 'Preencha e-mail e senha.'; errorEl.classList.remove('hidden'); return; }

    btn.disabled = true; btn.textContent = 'Entrando...';

    const { error } = await window.sb.auth.signInWithPassword({ email, password: pass });

    if (error) {
      errorEl.textContent = /Email not confirmed/i.test(error.message)
        ? 'Confirme seu e-mail antes de entrar.'
        : 'E-mail ou senha inválidos.';
      errorEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Entrar';
      return;
    }

    btn.textContent = 'Redirecionando...';
    redirectToPagamento();
  });

  /* ── Cadastro ── */
  let signupEmail = '';

  document.getElementById('wizardSignupBtn').addEventListener('click', async () => {
    const btn       = document.getElementById('wizardSignupBtn');
    const errorEl   = document.getElementById('wizardSignupError');
    const firstName = document.getElementById('wizardSignupFirstName').value.trim();
    const lastName  = document.getElementById('wizardSignupLastName').value.trim();
    const birthdate = document.getElementById('wizardSignupBirthdate').value;
    const email     = document.getElementById('wizardSignupEmail').value.trim();
    const pass      = document.getElementById('wizardSignupPassword').value;
    const confirm   = document.getElementById('wizardSignupConfirm').value;
    const gender    = document.querySelector('input[name="wizardGender"]:checked')?.value || '';

    errorEl.classList.add('hidden');
    if (!firstName)       { errorEl.textContent = 'Digite seu primeiro nome.'; errorEl.classList.remove('hidden'); return; }
    if (!lastName)        { errorEl.textContent = 'Digite seu último nome.'; errorEl.classList.remove('hidden'); return; }
    if (!birthdate)       { errorEl.textContent = 'Informe sua data de nascimento.'; errorEl.classList.remove('hidden'); return; }
    if (!email)           { errorEl.textContent = 'Digite seu e-mail.'; errorEl.classList.remove('hidden'); return; }
    if (pass.length < 6)  { errorEl.textContent = 'A senha deve ter pelo menos 6 caracteres.'; errorEl.classList.remove('hidden'); return; }
    if (pass !== confirm) { errorEl.textContent = 'As senhas não coincidem.'; errorEl.classList.remove('hidden'); return; }

    btn.disabled = true; btn.textContent = 'Criando conta...';

    const { error } = await window.sb.auth.signUp({
      email,
      password: pass,
      options: { data: { first_name: firstName, last_name: lastName, birthdate, gender } },
    });

    if (error) {
      errorEl.textContent = /already registered/i.test(error.message)
        ? 'Este e-mail já está cadastrado. Use a aba "Entrar".'
        : 'Erro ao criar conta. Tente novamente.';
      errorEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Criar conta';
      return;
    }

    signupEmail = email;
    document.getElementById('wizardOtpEmail').textContent = email;
    document.getElementById('wizardSignupForm').classList.add('hidden');
    document.getElementById('wizardSignupOtp').classList.remove('hidden');
  });

  /* ── Verificação OTP ── */
  document.getElementById('wizardOtpBtn').addEventListener('click', async () => {
    const btn     = document.getElementById('wizardOtpBtn');
    const errorEl = document.getElementById('wizardOtpError');
    const token   = document.getElementById('wizardOtpCode').value.trim();

    errorEl.classList.add('hidden');
    if (!token || token.length < 6) {
      errorEl.textContent = 'Digite o código de 6 dígitos.';
      errorEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true; btn.textContent = 'Verificando...';

    const { error } = await window.sb.auth.verifyOtp({ email: signupEmail, token, type: 'signup' });

    if (error) {
      errorEl.textContent = 'Código inválido ou expirado. Tente novamente.';
      errorEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Confirmar';
      return;
    }

    btn.textContent = 'Redirecionando...';
    redirectToPagamento();
  });

  /* ── Reenviar código ── */
  document.getElementById('wizardOtpResend').addEventListener('click', async () => {
    const btn = document.getElementById('wizardOtpResend');
    btn.disabled = true; btn.textContent = 'Enviando...';
    await window.sb.auth.resend({ email: signupEmail, type: 'signup' });
    btn.textContent = 'Código reenviado!';
    setTimeout(() => { btn.disabled = false; btn.textContent = 'Reenviar código'; }, 3000);
  });
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

    let userId = null;
    if (window.sb) {
      const { data } = await window.sb.auth.getSession();
      userId = data && data.session ? data.session.user.id : null;
    }

    for (const file of toAdd) {
      const b64 = await compressImage(file);

      if (userId) {
        const idx  = state.photos.length;
        /* Nome sempre único (timestamp) — reaproveitar photo-<idx>.jpg depois de
           remover uma foto faz o navegador exibir a versão antiga em cache, já
           que a URL fica idêntica à de um arquivo que ele acabou de baixar. */
        const path = `${userId}/${state.giftId}/photo-${idx}-${Date.now()}.jpg`;
        const { error } = await window.sb.storage.from(BUCKET).upload(path, dataUrlToBlob(b64), { contentType: 'image/jpeg' });
        if (error) { console.error('Storage upload error:', error); showToast('Erro ao salvar foto. Tente novamente.'); continue; }
        state.photos.push(path);
      } else {
        state.photos.push(b64);
      }

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
          <img src="${photoSrc(src)}" alt="Foto ${i + 1}" loading="lazy" />
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
    const src = state.photos[index];
    if (src && !src.startsWith('data:') && window.sb) {
      window.sb.storage.from(BUCKET).remove([src]);
    }
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
    const b64 = await compressImage(file);

    let userId = null;
    if (window.sb) {
      const { data } = await window.sb.auth.getSession();
      userId = data && data.session ? data.session.user.id : null;
    }

    if (userId) {
      /* Nome sempre único (timestamp) — mesma razão do upload da galeria:
         evita que o navegador reexiba uma imagem antiga em cache na mesma URL. */
      const path = `${userId}/${state.giftId}/cover-${Date.now()}.jpg`;
      const { error } = await window.sb.storage.from(BUCKET).upload(path, dataUrlToBlob(b64), { contentType: 'image/jpeg' });
      if (error) { console.error('Storage upload error:', error); showToast('Erro ao salvar foto de destaque. Tente novamente.'); input.value = ''; return; }
      state.extraPhoto = path;
    } else {
      state.extraPhoto = b64;
    }

    saveState();
    renderExtraPhoto();
    updatePreview();
    input.value = '';
  });

  btnRemove.addEventListener('click', e => {
    e.stopPropagation();
    if (state.extraPhoto && !state.extraPhoto.startsWith('data:') && window.sb) {
      window.sb.storage.from(BUCKET).remove([state.extraPhoto]);
    }
    state.extraPhoto = null;
    saveState();
    renderExtraPhoto();
    updatePreview();
  });

  function renderExtraPhoto() {
    if (state.extraPhoto) {
      img.src = photoSrc(state.extraPhoto);
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

    if (q.length < 2) { hideDropdown(); return; }
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
      hideDropdown();
    }
  });

  searchInput.addEventListener('blur', () => {
    setTimeout(() => hideDropdown(), 200);
  });

  // No mobile o .steps-container tem overflow-y:auto que corta elementos
  // position:absolute. Usando position:fixed com coordenadas do viewport.
  function showDropdown() {
    if (window.matchMedia('(max-width: 900px)').matches) {
      const rect = searchInput.getBoundingClientRect();
      Object.assign(suggestionsList.style, {
        position: 'fixed',
        top:   (rect.bottom + 2) + 'px',
        left:  rect.left + 'px',
        width: rect.width + 'px',
        right: 'auto',
        maxHeight: Math.min(window.innerHeight - rect.bottom - 8, window.innerHeight * 0.44) + 'px',
      });
    }
    suggestionsList.classList.remove('hidden');
  }

  function hideDropdown() {
    suggestionsList.classList.add('hidden');
    suggestionsList.style.cssText = '';
  }

  const MUSIC_SEARCH_URL = 'https://imiwhgrjwgydedbfdlkn.supabase.co/functions/v1/music-search';

  async function fetchSuggestions(query) {
    try {
      // Sem Authorization header — função pública (--no-verify-jwt).
      // Header customizado forçaria preflight CORS que browsers estritos bloqueiam.
      const res = await fetch(`${MUSIC_SEARCH_URL}?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('api error');
      const data = await res.json();
      const allResults = data.results || [];
      // Filtra apenas músicas com prévia disponível — faixas sem previewUrl não podem
      // ser tocadas no presente e causariam o player silenciosamente desabilitado.
      const tracks = allResults
        .filter(t => t.previewUrl)
        .map(t => ({
          trackName:       t.trackName       || '',
          artistName:      t.artistName      || '',
          artworkUrl60:    t.artworkUrl60    || t.artworkUrl100 || '',
          previewUrl:      t.previewUrl,
          trackTimeMillis: t.trackTimeMillis
        }));
      renderSuggestions(tracks, allResults.length);
    } catch (err) {
      console.error('Busca de música falhou:', err);
      suggestionsList.classList.add('hidden');
    }
  }

  function renderSuggestions(tracks, totalFound = 0) {
    suggestionsList.innerHTML = '';
    highlighted = -1;

    if (!tracks.length) {
      if (totalFound > 0) {
        // Resultados existem mas nenhum tem prévia disponível no iTunes
        const li = document.createElement('li');
        li.className = 'music-no-preview-msg';
        li.textContent = 'Nenhuma prévia disponível para essa busca. Tente outro artista ou álbum.';
        suggestionsList.appendChild(li);
        showDropdown();
      } else {
        suggestionsList.classList.add('hidden');
      }
      return;
    }

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

    showDropdown();
  }

  function selectTrack(track) {
    hideDropdown();
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
    if (isEditMode) {
      btnPreview.style.display = 'none';
    } else {
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
  const dateError = document.getElementById('startDateError');
  const handleDateChange = () => {
    const newDate = dateInput.value;
    if (!newDate) return; // Ignora eventos intermediários do Chrome com valor vazio
    const isFuture = new Date(newDate + 'T00:00:00') > new Date();
    if (dateError) dateError.style.display = isFuture ? '' : 'none';
    if (isFuture) { stopCounter(); return; }
    state.startDate = newDate;
    saveState();
    startCounter(newDate);
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
  if (isEditMode) return; // em edição o save acontece em finalizeEditInSupabase()
  const id = state.giftId;

  localStorage.setItem('DearMoment_last_gift_id', id);
  localStorage.setItem('DearMoment_last_gift_meta', JSON.stringify({
    id, name1: state.name1, name2: state.name2, title: state.title, template: getFinalTemplate(),
  }));

  try {
    const gifts     = JSON.parse(localStorage.getItem(GIFTS_KEY) || '[]');
    const existingIdx = gifts.findIndex(g => g.id === id);
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
      createdAt:       existingIdx !== -1 ? gifts[existingIdx].createdAt : new Date().toISOString(),
    };
    /* Substitui a entrada existente em vez de empilhar — passar pela etapa
       final mais de uma vez (ex: voltar e corrigir algo antes de pagar)
       nunca deve deixar duas entradas com o mesmo id no array, senão
       pagamento.html acaba lendo a versão desatualizada. */
    if (existingIdx !== -1) gifts[existingIdx] = gift;
    else gifts.push(gift);
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
  if (isEditMode && state.currentStep <= 3) {
    showToast('Os nomes não podem ser alterados na edição');
    return;
  }
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
   17. MODO EDIÇÃO — salvar alterações
═══════════════════════════════════════════════════════════════ */

async function finalizeEditInSupabase() {
  const giftId = state.giftId;
  if (!giftId) return;

  const btn     = document.getElementById('btnSaveEdit');
  const btnText = document.getElementById('btnSaveEditText');
  if (btn) { btn.disabled = true; btnText.textContent = 'Salvando...'; }

  try {
    const { data: userData } = await window.sb.auth.getUser();
    const userId = userData && userData.user ? userData.user.id : null;
    if (!userId) throw new Error('Sessão expirada. Faça login novamente.');

    const photoRows = [];

    /* Fotos da galeria.
       No M1, state.photos contém storage_paths (ex: uid/gid/photo-0.jpg).
       base64 só ocorre como fallback sem login — impossível no modo edição,
       mas tratamos como segurança. */
    for (let i = 0; i < state.photos.length; i++) {
      const src = state.photos[i];
      if (!src) continue;
      if (src.startsWith('data:')) {
        const blob = dataUrlToBlob(src);
        const ext  = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const path = `${userId}/${giftId}/photo-${i}.${ext}`;
        const { error } = await window.sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: true });
        if (error && !error.message?.includes('row-level security')) throw error;
        photoRows.push({ gift_id: giftId, storage_path: path, is_extra: false, position: i });
      } else {
        /* Já é um storage_path — usar diretamente, sem re-upload */
        photoRows.push({ gift_id: giftId, storage_path: src, is_extra: false, position: i });
      }
    }

    /* Foto de capa */
    if (state.extraPhoto) {
      if (state.extraPhoto.startsWith('data:')) {
        const blob = dataUrlToBlob(state.extraPhoto);
        const ext  = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const path = `${userId}/${giftId}/cover.${ext}`;
        const { error } = await window.sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: true });
        if (error && !error.message?.includes('row-level security')) throw error;
        photoRows.push({ gift_id: giftId, storage_path: path, is_extra: true, position: 0 });
      } else {
        photoRows.push({ gift_id: giftId, storage_path: state.extraPhoto, is_extra: true, position: 0 });
      }
    }

    /* UPDATE no gift — não toca em paid nem created_at */
    const giftRow = {
      name1:          state.name1        || null,
      name2:          state.name2        || null,
      start_date:     state.startDate    || null,
      city:           state.city         || null,
      title:          state.title        || null,
      template:       getFinalTemplate(),
      youtube_id:     state.youtubeId    || null,
      song_name:      state.songName     || null,
      artist_name:    state.artistName   || null,
      preview_url:    state.previewUrl   || null,
      music_duration: state.musicDuration || null,
      photo_captions: Array.isArray(state.photoCaptions) ? state.photoCaptions : [],
      message:        state.message      || null,
      capsulas:       Array.isArray(state.capsulas) ? state.capsulas : [],
      gift_type:      state.giftType     || 'amoroso',
    };
    const { error: giftErr } = await window.sb.from('gifts')
      .update(giftRow)
      .eq('id', giftId)
      .eq('user_id', userId);
    if (giftErr) throw giftErr;

    /* Substitui gift_photos */
    await window.sb.from('gift_photos').delete().eq('gift_id', giftId);
    if (photoRows.length) {
      const { error: photoErr } = await window.sb.from('gift_photos').insert(photoRows);
      if (photoErr) throw photoErr;
    }

    /* Limpa localStorage e redireciona para o presente */
    localStorage.removeItem('DearMoment_wizard_state');
    localStorage.removeItem('DearMoment_last_gift_id');
    localStorage.removeItem('DearMoment_last_gift_meta');
    localStorage.removeItem('DearMoment_pending_plan');

    window.location.href = `../presente.html?id=${encodeURIComponent(giftId)}`;

  } catch (err) {
    console.error('Erro ao salvar edição:', err);
    showToast('Erro ao salvar. Tente novamente.');
    if (btn) { btn.disabled = false; btnText.textContent = 'Salvar alterações'; }
  }
}

function setupEditMode() {
  if (!isEditMode) return;

  /* Valida que o state carregado corresponde ao ID da URL */
  if (!state.editMode || state.giftId !== EDIT_GIFT_ID) {
    localStorage.removeItem('DearMoment_wizard_state');
    window.location.href = '../meus-presentes.html';
    return;
  }

  const btnSave   = document.getElementById('btnSaveEdit');
  const btnCancel = document.getElementById('btnCancelEdit');

  if (btnSave)   btnSave.addEventListener('click', finalizeEditInSupabase);
  if (btnCancel) {
    btnCancel.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('DearMoment_wizard_state');
      localStorage.removeItem('DearMoment_last_gift_id');
      localStorage.removeItem('DearMoment_last_gift_meta');
      window.location.href = '../meus-presentes.html';
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   18. INICIALIZAÇÃO
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
  setupWizardAuth();
  setupEditMode();

  showStep(state.currentStep);

  // Timer global — lê state.startDate diretamente a cada segundo,
  // sem depender de start/stop chamados corretamente na navegação
  setInterval(() => {
    if (!state.startDate) return;
    const t = calcTimeSince(state.startDate);
    if (!t) return;
    setTextSafe('cYears',   t.years);
    setTextSafe('cMonths',  t.months);
    setTextSafe('cDays',    t.days);
    setTextSafe('cHours',   t.hours);
    setTextSafe('cMinutes', t.minutes);
    setTextSafe('cSeconds', t.seconds);
  }, 1000);
}

document.addEventListener('DOMContentLoaded', init);
