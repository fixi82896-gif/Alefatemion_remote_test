'use strict';

const $ = (id) => document.getElementById(id);
const VERSION = 'PWA Test 1';
const INSTALL_KEY = 'alef_pwa_install_id_v1';
const FAVORITES_KEY = 'alef_pwa_favorites_v1';
const THEME_KEY = 'alef_pwa_theme_v1';
const ROOT_FALLBACK = 'BJPV-mKSsDD-nMfmncHIcw';
const ABOUT_TEXT = 'مجموعه آل فاطمیون از سال ۱۳۸۳ با هدف برپایی شعائر مذهبی و مراسم مذهبی به سبکی جدید در شهر کرج متولد شد.\n\nاز آن زمان تاکنون با برگزاری اولین ایستگاه‌های صلواتی و نمایشگاه مذهبی در شهر کرج و برگزاری موکب پذیرایی در مراسم پیاده‌روی اربعین حسینی و اردوهای جهادی و کمک مؤمنانه در زمان کرونا در حال فعالیت بوده است.';

const state = {
  installId: getInstallId(),
  registrationId: '',
  otpRequestId: '',
  config: null,
  me: null,
  permissions: null,
  tab: 'home',
  rootHash: ROOT_FALLBACK,
  folderHash: ROOT_FALLBACK,
  folderStack: [],
  folderItems: [],
  folderQuery: '',
  favorites: loadJson(FAVORITES_KEY, []),
  heroIndex: 0,
  heroTimer: null,
  deferredInstallPrompt: null,
  currentTrackId: null
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
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites.slice(0, 500)));
}

function faToEn(value) {
  const map = { '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9','٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
  return String(value || '').replace(/[۰-۹٠-٩]/g, (c) => map[c] || c);
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
    SESSION_REVOKED: 'نشست این دستگاه پایان یافته است. دوباره وارد شوید.',
    SESSION_EXPIRED: 'نشست شما منقضی شده است. دوباره وارد شوید.',
    MEMBERSHIP_BLOCKED: 'دسترسی این حساب مسدود شده است.',
    INSTALLATION_BLOCKED: 'این دستگاه توسط مدیریت مسدود شده است.',
    SERVICE_UNAVAILABLE: 'سرویس موقتاً در دسترس نیست.',
    CONFIG_UNAVAILABLE: 'تنظیمات برنامه در دسترس نیست.',
    MEDIA_UNAVAILABLE: 'دریافت رسانه‌ها انجام نشد.'
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
  box.textContent = message;
  box.classList.remove('hidden');
}

function clearError() { $('authError').classList.add('hidden'); }

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
}

function showAuthStep(step) {
  $('phoneForm').classList.toggle('hidden', step !== 'phone');
  $('otpForm').classList.toggle('hidden', step !== 'otp');
  $('profileForm').classList.toggle('hidden', step !== 'profile');
  $('authHint').textContent = step === 'phone'
    ? 'شماره همراه خود را وارد کنید.'
    : step === 'otp'
      ? 'کد ۶ رقمی ارسال‌شده را وارد کنید.'
      : 'برای تکمیل حساب، نام و تاریخ تولد شمسی را ثبت کنید.';
  clearError();
}

function showApp() {
  $('auth').classList.add('hidden');
  $('app').classList.remove('hidden');
  updateIdentityUi();
  renderCurrentTab();
}

function showAuth() {
  stopHeroTimer();
  $('app').classList.add('hidden');
  $('auth').classList.remove('hidden');
  showAuthStep('phone');
}

async function loadConfig() {
  try {
    state.config = await api('/api/config');
    state.rootHash = state.config?.source?.root_hash || ROOT_FALLBACK;
    if (!state.folderStack.length) state.folderHash = state.rootHash;
  } catch (error) {
    console.warn('config', error);
    state.config = null;
    state.rootHash = ROOT_FALLBACK;
  }
}

async function loadAccount() {
  try {
    state.me = await api('/api/account/me');
    try { state.permissions = await api('/api/account/permissions'); } catch { state.permissions = state.me?.permissions || null; }
    return true;
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      state.me = null;
      state.permissions = null;
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
    showAuthStep('profile');
    return;
  }
  showApp();
}

function updateIdentityUi() {
  const name = state.me?.display_name || 'عضو آل فاطمیون';
  const initials = name.trim().slice(0, 2) || 'آل';
  $('welcomeName').textContent = `${name} عزیز، خوش آمدید`;
  $('avatarText').textContent = initials;
  $('drawerAvatar').textContent = initials;
  $('drawerName').textContent = name;
  $('drawerPhone').textContent = state.me?.phone_masked || state.me?.phone_e164 || '—';
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.bottom-nav button[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  const titles = { home: 'خانه', albums: 'آلبوم‌ها', notices: 'اطلاعیه‌ها', favorites: 'علاقه‌مندی‌ها' };
  $('topTitle').textContent = titles[tab] || 'آل فاطمیون';
  renderCurrentTab();
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

function heroBanners() {
  return (state.config?.home?.banners || [])
    .filter((b) => b?.placement === 'hero' && activeByTime(b) && safeHttps(b.image_url))
    .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0));
}

function stopHeroTimer() {
  clearInterval(state.heroTimer);
  state.heroTimer = null;
}

function startHeroTimer(banners) {
  stopHeroTimer();
  if (banners.length < 2) return;
  state.heroTimer = setInterval(() => {
    if (state.tab !== 'home') return;
    state.heroIndex = (state.heroIndex + 1) % banners.length;
    paintHero(banners);
  }, 6000);
}

function paintHero(banners) {
  const hero = $('heroArea');
  if (!hero || !banners.length) return;
  state.heroIndex = ((state.heroIndex % banners.length) + banners.length) % banners.length;
  const b = banners[state.heroIndex];
  hero.innerHTML = `<img src="${escapeHtml(safeHttps(b.image_url))}" alt="${escapeHtml(b.title || 'بنر آل فاطمیون')}"><div class="dots">${banners.map((_,i)=>`<span class="dot ${i===state.heroIndex?'active':''}"></span>`).join('')}</div>`;
  hero.onclick = () => handleBanner(b);
}
