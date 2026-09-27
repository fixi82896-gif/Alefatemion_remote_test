'use strict';

function openDrawer() {
  updateIdentityUi();
  $('drawerBackdrop').classList.remove('hidden');
  $('drawer').classList.remove('hidden');
  pushHistory('drawer');
}
function closeDrawerDirect() {
  $('drawerBackdrop').classList.add('hidden');
  $('drawer').classList.add('hidden');
}
function closeDrawer() {
  if (!$('drawer').classList.contains('hidden') && history.state?.alef && history.state?.kind === 'drawer') history.back();
  else closeDrawerDirect();
}

function openModal(title, html) {
  if (typeof state.modalCleanup === 'function') {
    try { state.modalCleanup(); } catch { /* ignore cleanup */ }
  }
  state.modalCleanup = null;
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = html;
  $('modalBackdrop').classList.remove('hidden');
  $('modal').classList.remove('hidden');
  pushHistory('modal');
}
function closeModalDirect() {
  const cleanup = state.modalCleanup;
  state.modalCleanup = null;
  if (typeof cleanup === 'function') {
    try { cleanup(); } catch { /* ignore cleanup */ }
  }
  $('modalBackdrop').classList.add('hidden');
  $('modal').classList.add('hidden');
  $('modalBody').innerHTML = '';
}
function closeModal() {
  if (!$('modal').classList.contains('hidden') && history.state?.alef && history.state?.kind === 'modal') history.back();
  else closeModalDirect();
}

function birthText(birth) {
  return birth ? `${toFaDigits(birth.year)}/${toFaDigits(String(birth.month).padStart(2, '0'))}/${toFaDigits(String(birth.day).padStart(2, '0'))}` : 'ثبت نشده';
}

function updateMessageCount() {
  const count = (state.personalMessages || []).filter((x) => !messageReadAt(x)).length;
  const badge = $('messageCount');
  if (badge) badge.textContent = count ? `(${toFaDigits(count)})` : '';
}

function enterProfileEdit() {
  const p = state.me || {};
  closeModalDirect();
  $('app').classList.add('hidden');
  $('splash').classList.add('hidden');
  $('auth').classList.remove('hidden');
  $('displayName').value = p.display_name || '';
  $('birthYear').value = p.birth_jalali?.year || '';
  $('birthMonth').value = p.birth_jalali?.month || '';
  $('birthDay').value = p.birth_jalali?.day || '';
  state.profilePhotoPending = null;
  syncProfilePreview();
  showAuthStep('profile');
}

function openProfileInfo() {
  const p = state.me || {};
  const photo = state.profilePhotoDataUrl
    ? `<img class="profile-info-photo" src="${escapeHtml(state.profilePhotoDataUrl)}" alt="عکس پروفایل">`
    : `<img class="profile-info-photo" src="/brand-logo.webp" alt="لوگوی آل فاطمیون">`;
  openModal('اطلاعات کاربری', `<div class="profile-info">
    ${photo}<strong>${escapeHtml(p.display_name || '—')}</strong><span class="muted">${escapeHtml(p.phone_masked || p.phone_e164 || '—')}</span>
    <div class="list">
      <div class="list-item"><small>شناسه کاربر</small><p>${escapeHtml(p.user_id || '—')}</p></div>
      <div class="list-item"><small>تاریخ تولد شمسی</small><p>${escapeHtml(birthText(p.birth_jalali))}</p></div>
      <div class="list-item"><small>وضعیت عضویت</small><p>${escapeHtml(p.membership_status || '—')}</p></div>
    </div>
    <button id="editProfile" class="primary" type="button">ویرایش اطلاعات کاربری</button>
  </div>`);
  $('editProfile')?.addEventListener('click', enterProfileEdit);
}

function openMessages() {
  state.noticeSubtab = 'personal';
  closeDrawerDirect();
  setTab('notices', { forcePush:true });
}

async function openDevices() {
  const alreadyOpen = !$('modal').classList.contains('hidden') && $('modalTitle').textContent === 'مدیریت دستگاه‌ها';
  if (alreadyOpen) $('modalBody').innerHTML = '<div class="empty">در حال دریافت دستگاه‌ها…</div>';
  else openModal('مدیریت دستگاه‌ها', '<div class="empty">در حال دریافت دستگاه‌ها…</div>');
  try {
    const data = await api('/api/account/installations');
    const items = Array.isArray(data.installations) ? data.installations : [];
    const active = items.filter((x) => x.status === 'active');
    const inactive = items.filter((x) => x.status !== 'active');
    $('modalBody').innerHTML = `<div class="device-tabs">
      <section><div class="section-title"><h2>فعال</h2><span class="pill">${toFaDigits(active.length)}</span></div><div class="list">${active.map(deviceHtml).join('') || '<div class="empty">دستگاه فعالی ثبت نشده است.</div>'}</div></section>
      <section><div class="section-title"><h2>غیرفعال</h2><span class="pill">${toFaDigits(inactive.length)}</span></div><div class="list">${inactive.map(deviceHtml).join('') || '<div class="empty">سابقه غیرفعالی وجود ندارد.</div>'}</div></section>
    </div>`;
    $('modalBody').querySelectorAll('[data-remove-device]').forEach((button) => button.addEventListener('click', () => removeDevice(button.dataset.removeDevice, button.dataset.history === '1')));
  } catch (error) { $('modalBody').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}

function deviceHtml(d) {
  const label = String(d.platform).toLowerCase() === 'pwa' ? 'نسخه وب (PWA)' : 'Android';
  const inactive = d.status !== 'active';
  const canRemove = !d.is_current;
  return `<div class="list-item device-card"><strong>${escapeHtml(label)} ${d.is_current ? '<span class="pill">این دستگاه</span>' : ''}</strong><div class="muted">نسخه ${escapeHtml(d.version_name || '—')} • ${escapeHtml(d.status || '—')}</div>${canRemove ? `<button class="ghost" data-remove-device="${escapeHtml(d.install_id)}" data-history="${inactive ? '1' : '0'}">${inactive ? 'حذف از سابقه' : 'خروج این دستگاه'}</button>` : ''}</div>`;
}

async function removeDevice(id, historyOnly) {
  if (!confirm(historyOnly ? 'این دستگاه از سابقه شما مخفی شود؟' : 'نشست این دستگاه پایان یابد؟')) return;
  try {
    await api(`/api/account/installations/${encodeURIComponent(id)}${historyOnly ? '/history' : ''}`, { method:'DELETE' });
    toast('انجام شد.');
    openDevices();
  } catch (error) { toast(error.message); }
}

function supportMethods() {
  if (state.config?.management_contact?.enabled === false) return [];
  return (state.config?.management_contact?.methods || []).filter((m) => m.enabled !== false && m.value);
}
function openSupport() {
  const methods = supportMethods();
  openModal('پشتیبانی', methods.length ? `<div class="list">${methods.map((m) => `<button class="list-item support-row" type="button" data-support="${escapeHtml(m.id)}"><strong>${escapeHtml(m.label || 'ارتباط')}</strong><small class="muted">${escapeHtml(m.type || '')}</small></button>`).join('')}</div>` : '<div class="empty">راه ارتباطی فعالی ثبت نشده است.</div>');
  $('modalBody').querySelectorAll('[data-support]').forEach((button) => button.addEventListener('click', () => {
    const m = methods.find((x) => String(x.id) === String(button.dataset.support));
    if (!m) return;
    const url = m.type === 'email' ? `mailto:${m.value}` : safeHttps(m.value);
    if (url) location.href = url;
  }));
}

function openSettings() {
  const selected = localStorage.getItem(THEME_KEY) || 'system';
  openModal('تنظیمات', `<div class="list settings-list">
    <label class="list-item settings-row"><div><strong>حالت ظاهر</strong><small class="muted">روشن، تیره یا مطابق دستگاه</small></div><select id="themeSelect"><option value="system">سیستم</option><option value="light">روشن</option><option value="dark">تیره</option></select></label>
    <div class="list-item"><strong>نسخه</strong><p>${VERSION}</p></div>
    <button class="list-item" id="installPwa" type="button"><strong>نصب روی صفحه اصلی</strong><small class="muted">در صورت پشتیبانی مرورگر</small></button>
    <button class="list-item" id="sharePwa" type="button"><strong>ارسال برنامه برای دوستان</strong><small class="muted">اشتراک لینک نسخه وب</small></button>
    <button class="list-item" id="aboutPwa" type="button"><strong>درباره ما</strong></button>
    <div class="list-item"><strong>مدیریت</strong><small class="muted">تمام عملیات مدیریتی فقط از نرم‌افزار Android مدیر انجام می‌شود.</small></div>
  </div>`);
  $('themeSelect').value = selected;
  $('themeSelect').addEventListener('change', (e) => applyTheme(e.target.value));
  $('installPwa').addEventListener('click', installPwa);
  $('sharePwa').addEventListener('click', sharePwa);
  $('aboutPwa').addEventListener('click', () => openModal('درباره ما', `<div class="about-card"><img src="/brand-logo.webp" alt="آل فاطمیون"><p>${escapeHtml(ABOUT_TEXT)}</p></div>`));
}

async function installPwa() {
  if (state.deferredInstallPrompt) {
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    return;
  }
  toast('از منوی مرورگر گزینه «افزودن به صفحه اصلی / Install» را انتخاب کنید.');
}
async function sharePwa() {
  try {
    if (navigator.share) await navigator.share({ title:'آل فاطمیون', text:'نسخه وب آل فاطمیون', url:location.origin });
    else { await navigator.clipboard.writeText(location.origin); toast('لینک برنامه کپی شد.'); }
  } catch { /* cancelled */ }
}

async function logout() {
  try { await api('/api/auth/logout', { method:'POST', body:{} }); } catch { /* local reset */ }
  state.me = null;
  state.permissions = null;
  state.profilePhotoDataUrl = '';
  state.personalMessages = null;
  state.navReady = false;
  closeDrawerDirect();
  closeModalDirect();
  history.replaceState(null, '', location.pathname + location.search);
  showAuth();
}
