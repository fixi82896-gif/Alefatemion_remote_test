'use strict';

/*
 * PWA Test 4 — clean Android 21 parity integration.
 * This is intentionally one cohesive layer on top of the last known-good Test 2.
 * It avoids the chained monkey-patches that made Test 3 unstable.
 */
const TEST4_LOGO = '/brand-logo.webp?v=test4-1';

function test4PrepareShell() {
  const welcome = $('welcome');
  if (welcome && welcome.dataset.test4Ready !== '1') {
    welcome.dataset.test4Ready = '1';
    welcome.innerHTML = `
      <div class="welcome-hand" aria-hidden="true">👋</div>
      <div class="welcome-copy">
        <strong id="welcomeName">خوش آمدید</strong>
        <span class="welcome-main">به موکب مجازی آل فاطمیون خوش آمدید</span>
        <small class="welcome-sub">لطفاً نظرات خود را با بخش پشتیبانی درمیان بگذارید</small>
      </div>
      <button id="contactButton" class="mini" type="button">ارتباط با پشتیبانی</button>`;

    if (!welcome.parentElement?.classList.contains('welcome-slot')) {
      const slot = document.createElement('div');
      slot.className = 'welcome-slot';
      welcome.parentNode?.insertBefore(slot, welcome);
      slot.appendChild(welcome);
    }
  }

  const radioButton = document.querySelector('.drawer-actions [data-action="radio"]');
  if (radioButton) radioButton.textContent = 'رادیو آل فاطمیون';
  document.querySelector('.drawer-note')?.remove();
}

test4PrepareShell();

/* Official logo is the only fallback avatar. */
setImageOrFallback = function test4SetImageOrFallback(imageId, textId, url) {
  const image = $(imageId);
  const fallback = $(textId);
  if (!image || !fallback) return;
  image.src = url || TEST4_LOGO;
  image.classList.remove('hidden');
  image.classList.toggle('brand-fallback', !url);
  fallback.classList.add('hidden');
};

syncProfilePreview = function test4SyncProfilePreview() {
  const image = $('profilePhotoPreview');
  const fallback = $('profilePhotoFallback');
  if (!image || !fallback) return;
  image.src = state.profilePhotoPending || state.profilePhotoDataUrl || TEST4_LOGO;
  image.classList.remove('hidden');
  image.classList.toggle('brand-fallback', !state.profilePhotoPending && !state.profilePhotoDataUrl);
  fallback.classList.add('hidden');
};

const test4BaseUpdateIdentityUi = updateIdentityUi;
updateIdentityUi = function test4UpdateIdentityUi() {
  test4PrepareShell();
  test4BaseUpdateIdentityUi();
  const name = String(state.me?.display_name || '').trim() || 'آل فاطمیون';
  if ($('welcomeName')) $('welcomeName').textContent = `${name} عزیز`;
};

/* Stable welcome collapse: the outer slot keeps layout height, so scrolling never jumps. */
updateWelcomeCollapse = function test4UpdateWelcomeCollapse() {
  const welcome = $('welcome');
  if (!welcome || $('app')?.classList.contains('hidden')) return;
  welcome.classList.toggle('compact', window.scrollY > 86);
  welcome.classList.remove('collapsed');
};

/* Android-like home carousel: swipe + dots/counter under the image, no overlay arrows. */
paintHero = function test4PaintHero(items) {
  const hero = $('heroArea');
  if (!hero || !items.length) return;
  state.heroIndex = ((state.heroIndex % items.length) + items.length) % items.length;
  const item = items[state.heroIndex];
  const body = item.local
    ? `<div class="heritage-banner"><img src="${TEST4_LOGO}" alt=""><div><strong>آل فاطمیون</strong><span>روایت تصویری فعالیت‌های مذهبی و جهادی</span><small>با محوریت خدمت در مسیر اربعین حسینی</small></div></div>`
    : `<img src="${escapeHtml(safeHttps(item.image_url))}" alt="${escapeHtml(item.title || 'بنر آل فاطمیون')}">`;

  hero.innerHTML = `
    <div class="hero-card" role="button" tabindex="0">${body}</div>
    ${items.length > 1 ? `<div class="hero-pagination"><div class="dots">${items.map((_, i) => `<button type="button" class="dot ${i === state.heroIndex ? 'active' : ''}" data-hero-dot="${i}" aria-label="بنر ${i + 1}"></button>`).join('')}</div><span>${toFaDigits(state.heroIndex + 1)} از ${toFaDigits(items.length)}</span></div>` : ''}`;

  const card = hero.querySelector('.hero-card');
  const activate = () => { if (!item.local) handleBanner(item); };
  card?.addEventListener('click', activate);
  card?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
  });
  hero.querySelectorAll('[data-hero-dot]').forEach((button) => button.addEventListener('click', () => {
    state.heroIndex = Number(button.dataset.heroDot);
    paintHero(items);
    startHeroTimer(items);
  }));
  if (card) wireHeroManual(card, items);
};

/* Album/media cards keep all Test 2 navigation, but use Android-like presentation. */
itemCardHtml = function test4ItemCardHtml(item) {
  if (item.isFolder) {
    const cover = safeHttps(item.thumbnailUrl || '');
    return `<button class="album-card folder-card" data-folder="${escapeHtml(item.hash)}" type="button">
      <span class="media-fallback"><img src="${TEST4_LOGO}" alt=""></span>
      ${cover ? `<img class="media-thumb" src="${escapeHtml(cover)}" loading="lazy" decoding="async" alt="">` : ''}
      <span class="meta"><strong>${escapeHtml(item.name || 'آلبوم')}</strong><small>آلبوم</small></span>
    </button>`;
  }

  const imageUrl = safeHttps(item.thumbnailUrl || item.downloadUrl || '');
  const fav = isFavorite(item.id);
  return `<article class="album-card media-card" data-media="${escapeHtml(item.id)}">
    <span class="media-fallback"><img src="${TEST4_LOGO}" alt=""></span>
    ${imageUrl ? `<img class="media-thumb" src="${escapeHtml(thumbUrl(imageUrl))}" loading="lazy" decoding="async" alt="">` : ''}
    <img class="media-brand-mark" src="${TEST4_LOGO}" alt="آل فاطمیون">
    ${item.isVideo ? '<span class="play-indicator">▶</span>' : ''}
    <button class="fav ${fav ? 'on' : ''}" data-favorite="${escapeHtml(item.id)}" aria-label="برگزیده">♥</button>
    <div class="meta"><small>${item.isVideo ? 'فیلم' : 'تصویر'}</small></div>
  </article>`;
};

function test4WireBrokenImageFallbacks(root = document) {
  root.querySelectorAll('img.media-thumb').forEach((image) => {
    image.addEventListener('error', () => { image.style.display = 'none'; }, { once:true });
    image.draggable = false;
  });
}

const test4BasePaintFolder = paintFolder;
paintFolder = function test4PaintFolder() {
  test4BasePaintFolder();
  test4WireBrokenImageFallbacks($('view'));
};

const test4BaseRenderFavorites = renderFavorites;
renderFavorites = function test4RenderFavorites() {
  test4BaseRenderFavorites();
  test4WireBrokenImageFallbacks($('view'));
};

/* Latest photos/videos must open a collection, not jump to a single media item. */
function test4CollectionCard(item, index) {
  const src = safeHttps(item.thumbnailUrl || item.downloadUrl || '');
  return `<button class="media-collection-card" type="button" data-test4-media="${escapeHtml(item.id)}">
    <span class="media-fallback"><img src="${TEST4_LOGO}" alt=""></span>
    ${src ? `<img class="media-thumb" src="${escapeHtml(thumbUrl(src))}" loading="lazy" decoding="async" alt="">` : ''}
    <img class="media-brand-mark" src="${TEST4_LOGO}" alt="آل فاطمیون">
    ${item.isVideo ? '<span class="play-indicator">▶</span>' : ''}
    <small>${item.isVideo ? 'فیلم' : 'تصویر'} ${toFaDigits(index + 1)}</small>
  </button>`;
}

function test4PaintMediaCollection(kind, items, query = '') {
  const normalized = normalizeSearch(query);
  const visible = items.filter((item) => !normalized || itemSearchText(item).includes(normalized));
  $('modalTitle').textContent = kind === 'video' ? 'تازه‌ترین فیلم‌ها' : 'تازه‌ترین تصاویر';
  $('modalBody').innerHTML = `
    <section class="media-collection-page">
      <input id="test4CollectionSearch" value="${escapeHtml(query)}" placeholder="جست‌وجوی رسانه">
      <div class="media-collection-grid">${visible.map((item, index) => test4CollectionCard(item, index)).join('')}</div>
      ${visible.length ? '' : '<div class="empty">موردی برای نمایش پیدا نشد.</div>'}
    </section>`;
  $('modal').classList.add('collection-modal');
  const input = $('test4CollectionSearch');
  input?.addEventListener('input', (event) => {
    const value = event.target.value;
    test4PaintMediaCollection(kind, items, value);
    queueMicrotask(() => { const next = $('test4CollectionSearch'); next?.focus(); next?.setSelectionRange(value.length, value.length); });
  });
  $('modalBody').querySelectorAll('[data-test4-media]').forEach((button) => button.addEventListener('click', () => {
    const item = visible.find((x) => String(x.id) === String(button.dataset.test4Media));
    if (item) openViewer(item, visible);
  }));
  test4WireBrokenImageFallbacks($('modalBody'));
}

openMediaCollection = async function test4OpenMediaCollection(kind) {
  openModal(kind === 'video' ? 'تازه‌ترین فیلم‌ها' : 'تازه‌ترین تصاویر', '<div class="empty">در حال دریافت رسانه‌ها…</div>');
  try {
    if (!state.albumGlobalItems) state.albumGlobalItems = await loadAllMediaTree(state.rootHash);
    const items = (state.albumGlobalItems || [])
      .filter((x) => kind === 'video' ? x.isVideo : x.isImage)
      .filter((x) => safeHttps(x.downloadUrl || ''));
    if (!items.length) {
      $('modalBody').innerHTML = `<div class="empty">${kind === 'video' ? 'فیلمی' : 'تصویری'} برای نمایش پیدا نشد.</div>`;
      return;
    }
    test4PaintMediaCollection(kind, items, '');
  } catch (error) {
    $('modalBody').innerHTML = `<div class="empty">${escapeHtml(error.message || 'دریافت رسانه‌ها انجام نشد.')}</div>`;
  }
};

/* Full-screen viewer decoration while preserving the proven Test 2 viewer controls. */
function test4DecorateViewer() {
  const viewer = $('modalBody')?.querySelector('.viewer');
  if (!viewer || !state.viewer) return;
  $('modal').classList.remove('collection-modal');
  $('modal').classList.add('viewer-fullscreen');
  const item = viewerCurrent();
  if ($('modalTitle')) $('modalTitle').textContent = item?.isVideo ? 'نمایش فیلم' : 'نمایش تصویر';
  const stage = viewer.querySelector('.viewer-stage') || viewer;
  if (!stage.querySelector('.test4-viewer-watermark')) {
    const mark = document.createElement('img');
    mark.className = 'test4-viewer-watermark';
    mark.src = TEST4_LOGO;
    mark.alt = 'آل فاطمیون';
    stage.appendChild(mark);
  }
  stage.addEventListener('contextmenu', (event) => event.preventDefault());
  stage.querySelectorAll('img,video').forEach((node) => { node.draggable = false; });
}

const test4BaseRenderViewer = renderViewer;
renderViewer = function test4RenderViewer() {
  test4BaseRenderViewer();
  test4DecorateViewer();
};

const test4BaseCloseModalDirect = closeModalDirect;
closeModalDirect = function test4CloseModalDirect() {
  $('modal')?.classList.remove('viewer-fullscreen', 'collection-modal');
  test4BaseCloseModalDirect();
};

/* Radio banner must update itself, not re-render Home and reset scroll. */
showRadioNowPlaying = function test4ShowRadioNowPlaying(track) {
  const banner = $('radioNowPlaying');
  if (!banner || !track) return;
  clearTimeout(state.radioNowTimer);
  banner.textContent = [track.title, track.performer].filter(Boolean).join(' - ') || 'رادیو آل فاطمیون';
  banner.classList.remove('hidden');
  banner.classList.remove('rolling');
  void banner.offsetWidth;
  banner.classList.add('rolling');
  state.radioNowTimer = setTimeout(() => banner.classList.add('hidden'), 5000);
};

/* Android-like settings without the obsolete management explanation. */
openSettings = function test4OpenSettings() {
  const selected = localStorage.getItem(THEME_KEY) || 'system';
  openModal('تنظیمات', `<div class="list settings-list">
    <label class="list-item settings-row"><div><strong>حالت ظاهر</strong><small class="muted">سیستم، روشن یا تیره</small></div><select id="themeSelect"><option value="system">سیستم</option><option value="light">روشن</option><option value="dark">تیره</option></select></label>
    <button class="list-item" id="checkPwaUpdate" type="button"><strong>بروزرسانی نرم‌افزار</strong><small class="muted">بررسی نسخه تازه PWA</small></button>
    <button class="list-item" id="sharePwa" type="button"><strong>ارسال برای دوستان</strong><small class="muted">اشتراک لینک برنامه</small></button>
    <button class="list-item" id="installPwa" type="button"><strong>نصب روی صفحه اصلی</strong><small class="muted">ویژه نسخه وب</small></button>
    <button class="list-item" id="clearPwaCache" type="button"><strong>حافظه موقت</strong><small class="muted">پاک‌سازی فایل‌های کش‌شده رابط</small></button>
    <button class="list-item" id="aboutPwa" type="button"><strong>درباره ما</strong></button>
    <div class="list-item"><strong>نسخه</strong><p>${VERSION}</p></div>
  </div>`);
  $('themeSelect').value = selected;
  $('themeSelect').addEventListener('change', (e) => applyTheme(e.target.value));
  $('installPwa').addEventListener('click', installPwa);
  $('sharePwa').addEventListener('click', sharePwa);
  $('checkPwaUpdate').addEventListener('click', async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      await reg?.update?.();
      toast('بررسی بروزرسانی انجام شد.');
    } catch { toast('بررسی بروزرسانی انجام نشد.'); }
  });
  $('clearPwaCache').addEventListener('click', async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      toast('حافظه موقت پاک شد.');
    } catch { toast('پاک‌سازی حافظه موقت انجام نشد.'); }
  });
  $('aboutPwa').addEventListener('click', () => openModal('درباره ما', `<div class="about-card"><img src="${TEST4_LOGO}" alt="آل فاطمیون"><p>${escapeHtml(ABOUT_TEXT)}</p></div>`));
};

/* Exit has two independent choices, matching Android semantics as far as browsers allow. */
const test4PerformAccountLogout = logout;
logout = function test4LogoutMenu() {
  openModal('خروج', `<div class="exit-choice">
    <p class="muted">نوع خروج را انتخاب کنید.</p>
    <button id="test4ExitApp" class="list-item" type="button"><strong>خروج از برنامه</strong><small class="muted">حساب شما فعال باقی می‌ماند.</small></button>
    <button id="test4ExitAccount" class="list-item danger-text" type="button"><strong>خروج از حساب کاربری</strong><small class="muted">نشست این دستگاه پایان می‌یابد.</small></button>
  </div>`);
  $('test4ExitApp')?.addEventListener('click', () => {
    closeModalDirect();
    try { window.close(); } catch { /* browser may reject */ }
    if (!document.hidden) {
      if (history.length > 1) history.back();
      else toast('برای خروج، این تب یا پنجره را ببندید.');
    }
  });
  $('test4ExitAccount')?.addEventListener('click', () => test4PerformAccountLogout());
};

/* Boot event handlers reference these elements; keep shell ready before boot(). */
test4PrepareShell();
