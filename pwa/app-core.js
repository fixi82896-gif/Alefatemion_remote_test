'use strict';

const $ = (id) => document.getElementById(id);
const VERSION = 'PWA Test 2';
const VERSION_CODE = 2;
const INSTALL_KEY = 'alef_pwa_install_id_v1';
const FAVORITES_KEY = 'alef_pwa_favorites_v1';
const THEME_KEY = 'alef_pwa_theme_v1';
const SEEN_NOTICES_KEY = 'alef_pwa_seen_notices_v1';
const RADIO_SELECTION_KEY = 'alef_pwa_radio_selection_v1';
const RADIO_MUTED_KEY = 'alef_pwa_radio_muted_v1';
const ALBUM_LAYOUT_KEY = 'alef_pwa_album_layout_v1';
const ALBUM_SORT_KEY = 'alef_pwa_album_sort_v1';
const SLIDESHOW_INTERVAL_KEY = 'alef_pwa_slideshow_interval_v1';
const SLIDESHOW_EFFECT_KEY = 'alef_pwa_slideshow_effect_v1';
const ROOT_FALLBACK = 'BJPV-mKSsDD-nMfmncHIcw';
const ABOUT_TEXT = 'مجموعه آل فاطمیون از سال ۱۳۸۳ با هدف برپایی مراسمات مذهبی به سبکی نوین در شهر کرج و به‌طور خاص منطقه رجایی‌شهر متولد شد.\n\nدر ادامه، فعالیت‌های مجموعه با برپایی ایستگاه‌های صلواتی، نمایشگاه‌ها و ماکت‌های خیابانی مذهبی، خدمت در مسیر اربعین حسینی، کمک مؤمنانه در دوران کرونا و فعالیت‌های جهادی از جمله در مناطق آسیب‌دیده از سیل گسترش یافت.';

const state = {
  installId: getInstallId(),
  registrationId: '',
  otpRequestId: '',
  otpDestination: '',
  otpResendUntil: 0,
  otpTimer: null,
  config: null,
  me: null,
  permissions: null,
  profilePhotoDataUrl: '',
  profilePhotoPending: null,
  tab: 'home',
  noticeSubtab: 'public',
  rootHash: ROOT_FALLBACK,
  folderHash: ROOT_FALLBACK,
  folderStack: [],
  folderItems: [],
  albumGlobalItems: null,
  albumGlobalLoading: false,
  displayedAlbumItems: [],
  folderQuery: '',
  folderSearchHistory: false,
  albumSort: localStorage.getItem(ALBUM_SORT_KEY) || 'newest',
  albumLayout: localStorage.getItem(ALBUM_LAYOUT_KEY) || 'normal',
  slideshowInterval: Math.max(2, Math.min(30, Number(localStorage.getItem(SLIDESHOW_INTERVAL_KEY) || 5))),
  slideshowEffect: localStorage.getItem(SLIDESHOW_EFFECT_KEY) || 'fade',
  slideshowTimer: null,
  favorites: loadJson(FAVORITES_KEY, []),
  seenNotices: loadJson(SEEN_NOTICES_KEY, {}),
  heroIndex: -1,
  heroTimer: null,
  heroPointerStartX: null,
  homePreview: null,
  homePreviewLoading: false,
  deferredInstallPrompt: null,
  personalMessages: null,
  currentTrackId: null,
  radioSelection: loadRadioSelection(),
  radioMuted: localStorage.getItem(RADIO_MUTED_KEY) === '1',
  radioSuspendedForVideo: false,
  radioResumeAfterVideo: false,
  radioNowTimer: null,
  radioResolving: false,
  viewer: null,
  modalCleanup: null,
  navReady: false,
  restoringHistory: false
};

function getInstallId() {
  let value = localStorage.getItem(INSTALL_KEY) || '';
  if (!/^[0-9a-f-]{36}$/i.test(value)) {
    value = crypto.randomUUID();
    localStorage.setItem(INSTALL_KEY, value);
  }
  return value;
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function loadRadioSelection() {
  try {
    const raw = localStorage.getItem(RADIO_SELECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

function saveRadioSelection() {
  if (state.radioSelection == null) localStorage.removeItem(RADIO_SELECTION_KEY);
  else localStorage.setItem(RADIO_SELECTION_KEY, JSON.stringify([...new Set(state.radioSelection)]));
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites.slice(0, 500)));
}

function saveSeenNotices() {
  localStorage.setItem(SEEN_NOTICES_KEY, JSON.stringify(state.seenNotices));
}

function faToEn(value) {
  const map = { '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9','٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
  return String(value || '').replace(/[۰-۹٠-٩]/g, (c) => map[c] || c);
}

function toFaDigits(value) {
  return String(value ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

function normalizeSearch(value) {
  return faToEn(String(value || ''))
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function safeHttps(url) {
  try {
    const parsed = new URL(String(url || ''), location.origin);
    return parsed.protocol === 'https:' || (parsed.origin === location.origin && ['http:','https:'].includes(parsed.protocol)) ? parsed.href : '';
  } catch {
    return '';
  }
}

function thumbUrl(url) {
  const safe = safeHttps(url);
  if (!safe) return '';
  return `${safe}${safe.includes('?') ? '&' : '?'}thumb=true`;
}

function apiErrorMessage(data, fallback = 'عملیات انجام نشد.') {
  const code = data?.error?.code || '';
  const map = {
    OTP_RATE_LIMITED: 'ارسال کد موقتاً محدود شده است. کمی بعد دوباره امتحان کنید.',
    OTP_INVALID: 'کد واردشده صحیح نیست.',
    OTP_EXPIRED: 'اعتبار کد تمام شده است. کد جدید بگیرید.',
    OTP_ATTEMPTS_EXCEEDED: 'تعداد تلاش برای این کد تمام شده است.',
    OTP_DELIVERY_UNAVAILABLE: 'ارسال پیامک موقتاً در دسترس نیست.',
    SESSION_REQUIRED: 'ورود مجدد لازم است.',
    SESSION_REVOKED: 'نشست این دستگاه پایان یافته است. دوباره وارد شوید.',
    SESSION_EXPIRED: 'نشست شما منقضی شده است. دوباره وارد شوید.',
    AUTH_REQUIRED: 'نشست شما منقضی شده است. دوباره وارد شوید.',
    MEMBERSHIP_BLOCKED: 'دسترسی این حساب مسدود شده است.',
    INSTALLATION_BLOCKED: 'این دستگاه توسط مدیریت مسدود شده است.',
    SERVICE_UNAVAILABLE: 'سرویس موقتاً در دسترس نیست.',
    CONFIG_UNAVAILABLE: 'تنظیمات برنامه در دسترس نیست.',
    MEDIA_UNAVAILABLE: 'دریافت رسانه‌ها انجام نشد.',
    RADIO_SOURCE_UNAVAILABLE: 'منبع صوتی این نوا قابل دریافت نیست.'
  };
  return map[code] || data?.error?.message || fallback;
}

async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body != null && typeof options.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    options = { ...options, body: JSON.stringify(options.body) };
  }
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options, headers });
  let data = {};
  try { data = await response.json(); } catch { /* non-json */ }
  if (!response.ok) {
    const error = new Error(apiErrorMessage(data, `خطای ${response.status}`));
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function setBusy(button, busy, text = 'در حال انجام…') {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = text;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function showError(message) {
  const box = $('authError');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('hidden');
}

function clearError() { $('authError')?.classList.add('hidden'); }

let toastTimer;
function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').classList.remove('hidden');
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 3500);
}

function applyTheme(theme) {
  const chosen = ['light','dark','system'].includes(theme) ? theme : 'system';
  localStorage.setItem(THEME_KEY, chosen);
  const effective = chosen === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : chosen;
  document.documentElement.dataset.theme = effective;
  if ($('drawerTheme')) $('drawerTheme').value = chosen;
}

function showSplash(message = 'در حال بررسی وضعیت ورود…', retry = false) {
  stopHeroTimer();
  $('app').classList.add('hidden');
  $('auth').classList.add('hidden');
  $('splash').classList.remove('hidden');
  $('splashText').textContent = message;
  $('splashRetry').classList.toggle('hidden', !retry);
}

function showAuthStep(step) {
  $('phoneForm').classList.toggle('hidden', step !== 'phone');
  $('otpForm').classList.toggle('hidden', step !== 'otp');
  $('profileForm').classList.toggle('hidden', step !== 'profile');
  $('authHint').textContent = step === 'phone'
    ? 'شماره همراه خودتان را وارد کنید.'
    : step === 'otp'
      ? 'کد تأیید ارسال‌شده را وارد کنید.'
      : 'برای تکمیل حساب، مشخصات کاربری را ثبت کنید.';
  clearError();
  if (step !== 'otp') stopOtpCountdown();
}

function showApp() {
  $('splash').classList.add('hidden');
  $('auth').classList.add('hidden');
  $('app').classList.remove('hidden');
  updateIdentityUi();
  initNavigationHistory();
  renderCurrentTab();
  updateRadioFab();
}

function showAuth() {
  stopHeroTimer();
  stopAudioForLogout();
  $('splash').classList.add('hidden');
  $('app').classList.add('hidden');
  $('auth').classList.remove('hidden');
  showAuthStep('phone');
}

async function loadConfig() {
  try {
    state.config = await api('/api/config');
    state.rootHash = state.config?.source?.root_hash || ROOT_FALLBACK;
    if (!state.folderStack.length || !state.folderHash) state.folderHash = state.rootHash;
  } catch (error) {
    console.warn('config', error);
    state.config = null;
    state.rootHash = ROOT_FALLBACK;
    if (!state.folderHash) state.folderHash = ROOT_FALLBACK;
  }
}

async function loadProfilePhoto() {
  state.profilePhotoDataUrl = '';
  if (!state.me?.has_profile_photo || !state.me?.user_id) return;
  try {
    const payload = await api(`/api/account/photo/${encodeURIComponent(state.me.user_id)}`);
    if (payload?.has_photo && payload?.base64) {
      const mime = String(payload.mime || 'image/jpeg').replace(/[^a-z0-9/+.-]/gi, '');
      state.profilePhotoDataUrl = `data:${mime};base64,${payload.base64}`;
    }
  } catch (error) {
    console.warn('profile-photo', error);
  }
}

async function loadAccount() {
  try {
    state.me = await api('/api/account/me');
    try { state.permissions = await api('/api/account/permissions'); } catch { state.permissions = state.me?.permissions || null; }
    await loadProfilePhoto();
    return true;
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      state.me = null;
      state.permissions = null;
      state.profilePhotoDataUrl = '';
      return false;
    }
    throw error;
  }
}

async function finishLogin() {
  const ok = await loadAccount();
  if (!ok) throw new Error('ورود کامل نشد. دوباره تلاش کنید.');
  await loadConfig();
  const provisional = !state.me?.display_name || state.me.display_name === 'عضو آل فاطمیون';
  if (provisional || !state.me?.birth_jalali) {
    $('displayName').value = provisional ? '' : (state.me.display_name || '');
    if (state.me?.birth_jalali) {
      $('birthYear').value = state.me.birth_jalali.year || '';
      $('birthMonth').value = state.me.birth_jalali.month || '';
      $('birthDay').value = state.me.birth_jalali.day || '';
    }
    syncProfilePreview();
    showAuthStep('profile');
    return;
  }
  showApp();
}

function setImageOrFallback(imageId, textId, url, text) {
  const image = $(imageId);
  const fallback = $(textId);
  if (!image || !fallback) return;
  if (url) {
    image.src = url;
    image.classList.remove('hidden');
    fallback.classList.add('hidden');
  } else {
    image.removeAttribute('src');
    image.classList.add('hidden');
    fallback.classList.remove('hidden');
    fallback.textContent = text;
  }
}

function updateIdentityUi() {
  const name = state.me?.display_name || 'عضو آل فاطمیون';
  const initials = name.trim().slice(0, 2) || 'آل';
  $('welcomeName').textContent = `${name} عزیز، خوش آمدید`;
  $('drawerName').textContent = name;
  $('drawerPhone').textContent = state.me?.phone_masked || state.me?.phone_e164 || '—';
  setImageOrFallback('avatarImage', 'avatarText', state.profilePhotoDataUrl, initials);
  setImageOrFallback('drawerAvatarImage', 'drawerAvatar', state.profilePhotoDataUrl, initials);
  setImageOrFallback('navAvatarImage', 'navAvatarText', state.profilePhotoDataUrl, initials);
  if ($('drawerTheme')) $('drawerTheme').value = localStorage.getItem(THEME_KEY) || 'system';
}

function navSnapshot(kind = 'tab') {
  return {
    alef: true,
    kind,
    tab: state.tab,
    collectionKind: state.collectionKind || null,
    folderHash: state.folderHash,
    folderStack: state.folderStack.map((x) => ({ hash: x.hash, name: x.name }))
  };
}

function initNavigationHistory() {
  if (state.navReady) return;
  state.navReady = true;
  history.replaceState(navSnapshot('tab'), '', location.pathname + location.search);
}

function pushHistory(kind, extra = {}) {
  if (!state.navReady || state.restoringHistory) return;
  history.pushState({ ...navSnapshot(kind), ...extra }, '', location.pathname + location.search);
}

function restoreFromHistory(snapshot) {
  if (!snapshot?.alef || !state.me) return;
  state.restoringHistory = true;
  try {
    state.tab = ['home','albums','notices','favorites'].includes(snapshot.tab) ? snapshot.tab : 'home';
    if (state.tab === 'albums') {
      state.collectionKind = ['image','video'].includes(snapshot.collectionKind) ? snapshot.collectionKind : null;
      state.folderHash = snapshot.folderHash || state.rootHash;
      state.folderStack = Array.isArray(snapshot.folderStack) ? snapshot.folderStack.map((x) => ({ hash:String(x.hash||''), name:String(x.name||'') })) : [];
      state.folderQuery = '';
    }
    syncBottomNav();
    renderCurrentTab();
  } finally {
    state.restoringHistory = false;
  }
}

function handlePopState(event) {
  if (!state.me) return;
  if (!$('modal').classList.contains('hidden')) {
    closeModalDirect();
    return;
  }
  if (!$('drawer').classList.contains('hidden')) {
    closeDrawerDirect();
    return;
  }
  if (state.folderQuery) {
    state.folderQuery = '';
    state.folderSearchHistory = false;
    if (state.tab === 'albums') paintFolder();
    return;
  }
  restoreFromHistory(event.state);
}

function syncBottomNav() {
  document.querySelectorAll('.bottom-nav button[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === state.tab);
  });
  const titles = { home: 'خانه', albums: 'آلبوم‌ها', notices: 'اطلاعیه‌ها', favorites: 'برگزیده‌ها' };
  $('topTitle').textContent = titles[state.tab] || 'آل فاطمیون';
}

function setTab(tab, options = {}) {
  if (!['home','albums','notices','favorites'].includes(tab)) return;
  const nextCollection = tab === 'albums' && ['image','video'].includes(options.collection) ? options.collection : null;
  const changed = state.tab !== tab || (state.collectionKind || null) !== nextCollection;
  state.tab = tab;
  state.collectionKind = nextCollection;
  if (tab !== 'albums') {
    state.folderQuery = '';
    state.folderSearchHistory = false;
  }
  syncBottomNav();
  if ((changed || options.forcePush) && options.push !== false) pushHistory('tab');
  renderCurrentTab();
  updateRadioVideoGate();
}

function renderCurrentTab() {
  if (!state.me) return;
  if (state.tab === 'home') renderHome();
  else if (state.tab === 'albums') renderAlbums();
  else if (state.tab === 'notices') renderNotices();
  else if (state.tab === 'favorites') renderFavorites();
}

function currentMillis() { return Date.now(); }
function activeByTime(item) {
  const now = currentMillis();
  const start = Number(item?.starts_at_millis || 0);
  const end = Number(item?.expires_at_millis || 0);
  return item?.enabled !== false && (!start || start <= now) && (!end || end > now);
}

function remoteHeroBanners() {
  return (state.config?.home?.banners || [])
    .filter((b) => b?.placement === 'hero' && b?.fixed !== true && activeByTime(b) && safeHttps(b.image_url))
    .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0));
}

function heroItems() {
  const local = { id:'local-alfatemiun', local:true, title:'آل فاطمیون' };
  return [local, ...remoteHeroBanners().map((b) => ({ ...b, local:false }))];
}

function stopHeroTimer() {
  clearInterval(state.heroTimer);
  state.heroTimer = null;
}

function moveHero(delta, items, manual = false) {
  if (!items.length) return;
  state.heroIndex = (state.heroIndex + delta + items.length) % items.length;
  paintHero(items);
  if (manual) startHeroTimer(items);
}

function startHeroTimer(items) {
  stopHeroTimer();
  if (items.length < 2) return;
  state.heroTimer = setInterval(() => {
    if (state.tab !== 'home' || document.hidden || state.heroPointerStartX != null) return;
    moveHero(1, items, false);
  }, 6000);
}

function wireHeroManual(hero, items) {
  hero.onpointerdown = (event) => {
    if (event.target.closest('.hero-arrow, [data-hero-dot]')) return;
    state.heroPointerStartX = event.clientX;
    state.heroPointerStartY = event.clientY;
  };
  hero.onpointerup = (event) => {
    if (state.heroPointerStartX == null) return;
    const dx = event.clientX - state.heroPointerStartX;
    const dy = event.clientY - state.heroPointerStartY;
    state.heroPointerStartX = null;
    if (Math.abs(dx) < 35 || Math.abs(dx) <= Math.abs(dy)) return;
    hero.suppressClickUntil = performance.now() + 500;
    moveHero(dx > 0 ? -1 : 1, items, true);
  };
  hero.onpointercancel = () => { state.heroPointerStartX = null; };
  hero.onpointerleave = () => { state.heroPointerStartX = null; };
  hero.onkeydown = (event) => {
    if (event.target !== hero || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    moveHero(event.key === 'ArrowRight' ? -1 : 1, items, true);
  };
}

function homeRemoteBannerHtml(banner) {
  const title = String(banner.title || '').trim();
  const description = String(banner.description || '').trim();
  const sponsored = banner.sponsored === true;
  return `<img src="${escapeHtml(safeHttps(banner.image_url))}" alt="${escapeHtml(title || 'بنر آل فاطمیون')}" decoding="async">
    ${title || description || sponsored ? `<span class="home-banner-overlay"><span class="home-banner-caption">
      ${sponsored ? '<small class="home-sponsored">تبلیغ</small>' : ''}
      ${title ? `<strong>${escapeHtml(title)}</strong>` : ''}
      ${description ? `<span>${escapeHtml(description)}</span>` : ''}
    </span></span>` : ''}`;
}

function paintHero(items) {
  const hero = $('heroArea');
  if (!hero || !items.length) return;
  state.heroIndex = ((state.heroIndex % items.length) + items.length) % items.length;
  const item = items[state.heroIndex];
  const body = item.local
    ? `<div class="heritage-banner"><img src="/brand-logo.webp" alt=""><div><strong>آل فاطمیون</strong><span>روایت تصویری فعالیت‌های مذهبی و جهادی</span><small>با محوریت خدمت در مسیر اربعین حسینی</small></div></div>`
    : `<button type="button" class="hero-slide-button" data-hero-open>${homeRemoteBannerHtml(item)}</button>`;
  hero.innerHTML = `<div class="hero-viewport"><div class="hero-visual">${body}</div>${items.length > 1 ? '<button class="hero-arrow hero-prev" type="button" aria-label="بنر قبلی">‹</button><button class="hero-arrow hero-next" type="button" aria-label="بنر بعدی">›</button>' : ''}</div>
    ${items.length > 1 ? `<div class="hero-indicators"><span class="hero-counter">${toFaDigits(state.heroIndex + 1)} از ${toFaDigits(items.length)}</span><div class="dots">${items.map((_,i)=>`<button type="button" class="dot ${i===state.heroIndex?'active':''}" data-hero-dot="${i}" aria-label="بنر ${i+1}" aria-current="${i===state.heroIndex?'true':'false'}"></button>`).join('')}</div></div>` : ''}`;
  hero.onclick = (event) => {
    if (performance.now() < (hero.suppressClickUntil || 0)) return;
    if (event.target.closest('[data-hero-open]') && !item.local) handleBanner(item);
  };
  hero.querySelector('.hero-prev')?.addEventListener('click', (event) => { event.stopPropagation(); moveHero(-1, items, true); });
  hero.querySelector('.hero-next')?.addEventListener('click', (event) => { event.stopPropagation(); moveHero(1, items, true); });
  hero.querySelectorAll('[data-hero-dot]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation(); state.heroIndex = Number(button.dataset.heroDot); paintHero(items); startHeroTimer(items);
  }));
  hero.querySelector('.hero-slide-button > img')?.addEventListener('error', (event) => { event.target.hidden = true; }, {once:true});
  wireHeroManual(hero, items);
}

function markNoticeSeen(id) {
  if (!id) return;
  if (!state.seenNotices[id]) {
    state.seenNotices[id] = Date.now();
    saveSeenNotices();
  }
}

function isNoticeSeen(id) { return Boolean(state.seenNotices[id]); }

function formatPersianDate(value) {
  const millis = Number(value || 0);
  if (!millis) return '';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(millis));
  } catch {
    return new Date(millis).toLocaleString('fa-IR');
  }
}

function stopOtpCountdown() {
  clearInterval(state.otpTimer);
  state.otpTimer = null;
}

function updateOtpCountdown() {
  const button = $('resendOtp');
  if (!button) return;
  const remaining = Math.max(0, Math.ceil((state.otpResendUntil - Date.now()) / 1000));
  if (remaining > 0) {
    button.disabled = true;
    button.textContent = `ارسال مجدد تا ${toFaDigits(remaining)} ثانیه دیگر`;
  } else {
    button.disabled = false;
    button.textContent = 'ارسال مجدد کد';
    stopOtpCountdown();
  }
}

function startOtpCountdown(seconds) {
  stopOtpCountdown();
  state.otpResendUntil = Date.now() + Math.max(0, Number(seconds || 0)) * 1000;
  updateOtpCountdown();
  if (state.otpResendUntil > Date.now()) state.otpTimer = setInterval(updateOtpCountdown, 1000);
}

function syncProfilePreview() {
  const url = state.profilePhotoPending || state.profilePhotoDataUrl;
  const image = $('profilePhotoPreview');
  const fallback = $('profilePhotoFallback');
  if (!image || !fallback) return;
  if (url) {
    image.src = url;
    image.classList.remove('hidden');
    fallback.classList.add('hidden');
  } else {
    image.classList.add('hidden');
    fallback.classList.remove('hidden');
  }
}

async function compressProfilePhotoFile(file) {
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error('فایل انتخاب‌شده تصویر معتبر نیست.');
  const bitmap = await createImageBitmap(file);
  const max = 640;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha:false });
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
  if (dataUrl.length > 220000) return canvas.toDataURL('image/jpeg', 0.62);
  return dataUrl;
}

function dataUrlToProfilePhoto(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:image/jpeg;base64,')) return null;
  return { mime:'image/jpeg', base64:dataUrl.slice('data:image/jpeg;base64,'.length) };
}

function updateOnlineState() { $('offline').classList.toggle('hidden', navigator.onLine); }

function updateWelcomeCollapse() {
  const welcome = $('welcome');
  if (!welcome || $('app').classList.contains('hidden')) return;
  welcome.classList.toggle('collapsed', window.scrollY > 70);
}
