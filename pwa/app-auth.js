'use strict';

async function saveProfile(event) {
  event.preventDefault();
  clearError();
  const button = event.submitter;
  const name = $('displayName').value.trim();
  const year = Number(faToEn($('birthYear').value));
  const month = Number(faToEn($('birthMonth').value));
  const day = Number(faToEn($('birthDay').value));
  if (!name || !Number.isInteger(year) || year < 1200 || year > 1600 || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) {
    (state.profileEditing ? toast : showError)('نام و تاریخ تولد شمسی را کامل و صحیح وارد کنید.');
    return;
  }
  setBusy(button, true, 'در حال ذخیره…');
  try {
    const payload = { display_name:name, birth_jalali:{ year, month, day } };
    const photo = dataUrlToProfilePhoto(state.profilePhotoPending);
    if (photo) payload.profile_photo = photo;
    await api('/api/account/me', { method:'PATCH', body:payload });
    await loadAccount();
    state.profilePhotoPending = null;
    if (state.profileEditing) closeModal();
    else showApp();
    toast('پروفایل ذخیره شد.');
  } catch (error) { if (state.profileEditing) toast(error.message); else showError(error.message); }
  finally { setBusy(button, false); }
}

async function submitPhone(event) {
  event.preventDefault();
  clearError();
  const button = event.submitter;
  const phone = faToEn($('phone').value).replace(/\s+/g, '');
  if (!$('privacy').checked) { showError('برای ادامه، مطالعه و پذیرش قوانین حساب لازم است.'); return; }
  setBusy(button, true, 'در حال ارسال…');
  try {
    const reg = await api('/api/auth/register', { method:'POST', body:{ phone, install_id:state.installId } });
    state.registrationId = reg.registration_id;
    const otp = await api('/api/auth/otp/request', { method:'POST', body:{ registration_id:state.registrationId, install_id:state.installId } });
    state.otpRequestId = otp.otp_request_id;
    state.otpDestination = otp.destination_masked || otp.destination || reg.phone_masked || '';
    $('otpDestination').textContent = state.otpDestination ? `کد ۶ رقمی برای ${state.otpDestination} ارسال شد.` : 'کد ۶ رقمی ارسال‌شده را وارد کنید.';
    showAuthStep('otp');
    startOtpCountdown(otp.resend_after_seconds || 60);
    $('otp').value = '';
    $('otp').focus();
    toast('کد ورود ارسال شد.');
  } catch (error) { showError(error.message); }
  finally { setBusy(button, false); }
}

async function resendOtp() {
  if (!state.registrationId || state.otpResendUntil > Date.now()) return;
  clearError();
  const button = $('resendOtp');
  setBusy(button, true, 'در حال ارسال…');
  try {
    const otp = await api('/api/auth/otp/request', { method:'POST', body:{ registration_id:state.registrationId, install_id:state.installId } });
    state.otpRequestId = otp.otp_request_id;
    if (otp.destination_masked) state.otpDestination = otp.destination_masked;
    $('otpDestination').textContent = state.otpDestination ? `کد ۶ رقمی برای ${state.otpDestination} ارسال شد.` : 'کد ۶ رقمی ارسال‌شده را وارد کنید.';
    $('otp').value = '';
    startOtpCountdown(otp.resend_after_seconds || 60);
    toast('کد جدید ارسال شد.');
  } catch (error) { showError(error.message); }
  finally { setBusy(button, false); updateOtpCountdown(); }
}

async function submitOtp(event) {
  event.preventDefault();
  clearError();
  const button = event.submitter;
  const code = faToEn($('otp').value).replace(/\D/g, '');
  if (code.length !== 6) { showError('کد باید ۶ رقم باشد.'); return; }
  setBusy(button, true, 'در حال بررسی…');
  try {
    await api('/api/auth/otp/verify', { method:'POST', body:{ registration_id:state.registrationId, otp_request_id:state.otpRequestId, install_id:state.installId, code } });
    stopOtpCountdown();
    await finishLogin();
  } catch (error) { showError(error.message); }
  finally { setBusy(button, false); }
}

function handleDrawerAction(action) {
  closeDrawerDirect();
  if (action === 'profile-info') return openProfileInfo();
  if (action === 'messages') return openMessages();
  if (action === 'radio') return openRadio();
  if (action === 'devices') return openDevices();
  if (action === 'support') return openSupport();
  if (action === 'settings') return openSettings();
  if (action === 'logout') return openExitOptions();
}

function bindEvents() {
  $('phoneForm').addEventListener('submit', submitPhone);
  $('otpForm').addEventListener('submit', submitOtp);
  $('profileForm').addEventListener('submit', saveProfile);
  $('otpBack').addEventListener('click', () => { state.otpRequestId = ''; state.registrationId = ''; showAuthStep('phone'); });
  $('resendOtp').addEventListener('click', resendOtp);
  $('profilePhoto').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      state.profilePhotoPending = await compressProfilePhotoFile(file);
      syncProfilePreview();
    } catch (error) { showError(error.message || 'آماده‌سازی عکس انجام نشد.'); }
  });
  document.querySelectorAll('.bottom-nav button[data-tab]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.tab)));
  $('profileButton').addEventListener('click', openDrawer);
  $('navProfile').addEventListener('click', openDrawer);
  $('closeDrawer').addEventListener('click', closeDrawer);
  $('drawerBackdrop').addEventListener('click', closeDrawer);
  $('closeModal').addEventListener('click', closeModal);
  $('modalBackdrop').addEventListener('click', closeModal);
  document.querySelectorAll('.drawer-actions [data-action]').forEach((button) => button.addEventListener('click', () => handleDrawerAction(button.dataset.action)));
  $('drawerTheme').addEventListener('change', (e) => applyTheme(e.target.value));
  $('contactButton').addEventListener('click', openSupport);
  $('radioFab').addEventListener('click', () => openRadio());
  $('radioNowPlaying').addEventListener('click', () => { hideRadioNowPlaying(); openRadio(); });
  $('splashRetry').addEventListener('click', boot);
  addEventListener('online', updateOnlineState);
  addEventListener('offline', updateOnlineState);
  addEventListener('popstate', handlePopState);
  addEventListener('scroll', updateWelcomeCollapse, { passive:true });
  addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); state.deferredInstallPrompt = event; });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if ((localStorage.getItem(THEME_KEY) || 'system') === 'system') applyTheme('system'); });

  const audio = $('audio');
  audio.addEventListener('ended', playNextTrack);
  audio.addEventListener('play', () => {
    updateRadioFab();
    const track = enabledTracks().find((t) => String(t.id) === String(state.currentTrackId));
    if (track && state.radioAnnouncedId !== String(track.id)) { state.radioAnnouncedId = String(track.id); showRadioNowPlaying(track); }
  });
  audio.addEventListener('pause', updateRadioFab);
  document.addEventListener('pointerup', retryRadioAfterGesture);
  document.addEventListener('keydown', retryRadioAfterGesture);
  audio.addEventListener('error', () => {
    if (!state.currentTrackId || state.radioResolving || state.radioMuted || !state.sessionStarted) return;
    const current = enabledTracks().find(t => String(t.id) === String(state.currentTrackId));
    if (!current) return;
    const epoch = state.radioEpoch || 0;
    resolveRadioTrack(current).then(src => {
      if ((state.radioEpoch || 0) !== epoch || state.radioMuted || !state.sessionStarted) return;
      if (audio.src !== src) { audio.src = src; if (!state.radioSuspendedForVideo) audio.play().catch(() => {}); }
    }).catch(() => toast('پخش این نوا موقتاً در دسترس نیست.'));
  });

  document.addEventListener('visibilitychange', () => {
    const stopInBackground = state.config?.nava?.stop_in_background !== false;
    if (!stopInBackground) return;
    if (document.hidden) {
      if (!audio.paused) state.radioResumeAfterVideo = true;
      audio.pause();
    } else if (state.radioResumeAfterVideo && !state.radioMuted && !state.radioSuspendedForVideo) {
      state.radioResumeAfterVideo = false;
      audio.play().catch(() => {});
    }
  });
}

async function boot() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'system');
  updateOnlineState();
  showSplash('در حال بررسی وضعیت ورود…', false);
  if (!boot.bound) {
    bindEvents();
    boot.bound = true;
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('sw', error));
  }
  try {
    await loadConfig();
    if (await loadAccount()) {
      showApp();
      loadPersonalMessages().catch(() => {});
      updateRadioFab();
    } else showAuth();
  } catch (error) {
    console.error(error);
    showSplash('بررسی وضعیت ورود انجام نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.', true);
  }
}

boot.bound = false;
boot();
