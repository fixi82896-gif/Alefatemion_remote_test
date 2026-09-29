'use strict';

function enabledTracks() {
  const nava = state.config?.nava;
  if (!nava?.enabled) return [];
  return (nava.tracks || [])
    .filter((t) => t?.enabled !== false)
    .filter((t) => t?.stream_url)
    .filter((t) => t.category === 'celebration' ? nava.celebration_enabled !== false : nava.mourning_enabled !== false)
    .filter((t, index, array) => array.findIndex((x) => String(x.id) === String(t.id)) === index);
}

function normalizeRadioSelection() {
  const all = enabledTracks();
  if (state.radioSelection == null) return null;
  const valid = [...new Set(state.radioSelection)].filter((id) => all.some((t) => String(t.id) === String(id)));
  if (!valid.length || valid.length >= all.length) return null;
  return valid;
}

function radioPlaylist() {
  const all = enabledTracks();
  state.radioSelection = normalizeRadioSelection();
  saveRadioSelection();
  if (state.radioSelection == null) return all;
  const selected = new Set(state.radioSelection.map(String));
  return all.filter((t) => selected.has(String(t.id)));
}

function updateRadioFab() {
  const fab = $('radioFab');
  if (!fab) return;
  const tracks = enabledTracks();
  fab.disabled = !state.config?.nava?.enabled || !tracks.length;
  const muted = state.radioMuted || fab.disabled;
  fab.classList.toggle('muted', muted);
  fab.classList.toggle('playing', !muted && !$('audio').paused);
  fab.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${muted ? 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v3.01l2.45 2.45c.03-.14.05-.28.05-.43z M19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.9 8.9 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71z M4.27 3 3 4.27 7.73 9H3v6h4l5 5v-8.73l4.25 4.25A6.8 6.8 0 0 1 14 18.71v2.06a8.8 8.8 0 0 0 3.69-2.8L19.73 20 21 18.73 4.27 3z M12 4 9.91 6.09 12 8.18V4z' : 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z'}"/></svg>`;
  fab.title = state.radioAutoplayBlocked ? 'برای شروع پخش لمس کنید' : muted ? 'رادیو خاموش است' : 'رادیو آل فاطمیون';
  fab.setAttribute('aria-label', 'رادیو آل فاطمیون؛ ' + (state.radioAutoplayBlocked ? 'برای پخش لمس کنید' : $('audio').paused ? 'متوقف' : 'در حال پخش'));
}

function updateRadioVideoGate() {
  const item = typeof viewerCurrent === 'function' ? viewerCurrent() : null;
  const isVideo = Boolean(item && (item.isVideo || String(item.type || '').startsWith('video/')) && !$('modal').classList.contains('hidden'));
  setRadioVideoGate(isVideo);
}

function setRadioVideoGate(active) {
  const audio = $('audio');
  if (!audio) return;
  if (active) {
    if (!audio.paused) state.radioResumeAfterVideo = true;
    state.radioSuspendedForVideo = true;
    audio.pause();
  } else {
    const shouldResume = state.radioSuspendedForVideo && state.radioResumeAfterVideo && !state.radioMuted && Boolean(state.currentTrackId);
    state.radioSuspendedForVideo = false;
    state.radioResumeAfterVideo = false;
    if (shouldResume) audio.play().catch(() => {});
  }
  updateRadioFab();
}

function hideRadioNowPlaying() {
  clearTimeout(state.radioNowTimer);
  $('radioNowPlaying')?.classList.remove('radio-visible');
}
function showRadioNowPlaying(track) {
  const banner = $('radioNowPlaying');
  if (!banner || !track) return;
  clearTimeout(state.radioNowTimer);
  banner.textContent = [track.title, track.performer].filter(Boolean).join(' - ') || 'رادیو آل فاطمیون';
  banner.classList.remove('hidden');
  requestAnimationFrame(() => banner.classList.add('radio-visible'));
  state.radioNowTimer = setTimeout(hideRadioNowPlaying, 5000);
}

function retryRadioAfterGesture(event) {
  if (!event.isTrusted || !state.radioAutoplayBlocked || state.radioMuted || state.radioSuspendedForVideo || state.introActive || !state.sessionStarted || !$('audio').getAttribute('src')) return;
  state.radioAutoplayBlocked = false;
  $('audio').play().catch(error => { if(error.name === 'NotAllowedError') state.radioAutoplayBlocked = true; }).finally(updateRadioFab);
}

async function resolveRadioTrack(track) {
  const source = safeHttps(track?.stream_url || '');
  if (!source) throw new Error('آدرس این نوا معتبر نیست.');
  const result = await api(`/api/radio/resolve?source=${encodeURIComponent(source)}`);
  const media = safeHttps(result.media_url || '');
  if (!media) throw new Error('منبع صوتی این نوا قابل دریافت نیست.');
  return media;
}

async function playTrack(id, options = {}) {
  const track = enabledTracks().find((t) => String(t.id) === String(id));
  if (!track || state.radioResolving) return;
  state.radioMuted = false;
  localStorage.setItem(RADIO_MUTED_KEY, '0');
  state.radioResolving = true;
  const epoch = state.radioEpoch || 0;
  updateRadioFab();
  try {
    const audio = $('audio');
    const resolved = await resolveRadioTrack(track);
    if ((state.radioEpoch || 0) !== epoch || state.radioMuted || !state.me) return;
    const same = String(state.currentTrackId || '') === String(track.id) && audio.src === resolved;
    state.currentTrackId = String(track.id);
    if (!same) {
      audio.src = resolved;
      audio.load();
    }
    if (!state.radioSuspendedForVideo) await audio.play();
    state.radioAutoplayBlocked = false;
    if (options.toast !== false) toast(`در حال پخش: ${track.title || 'نوا'}`);
  } catch (error) {
    if ((state.radioEpoch || 0) !== epoch) return;
    if (error.name === 'NotAllowedError') { state.radioAutoplayBlocked = true; }
    else { console.warn('radio-play', error); toast('پخش این نوا انجام نشد. دوباره تلاش کنید.'); }
  } finally {
    if ((state.radioEpoch || 0) === epoch) state.radioResolving = false;
    updateRadioFab();
  }
}

function playNextTrack() {
  const playlist = radioPlaylist();
  if (!playlist.length) return;
  let index = playlist.findIndex((t) => String(t.id) === String(state.currentTrackId));
  if (index < 0) index = -1;
  const nextIndex = index + 1;
  if (nextIndex >= playlist.length && state.config?.nava?.repeat_last_track === false) {
    state.currentTrackId = null;
    updateRadioFab();
    return;
  }
  playTrack(playlist[(nextIndex + playlist.length) % playlist.length].id, { toast:false });
}

function startRadioFromRandomIfNeeded() {
  const playlist = radioPlaylist();
  if (!playlist.length || state.radioMuted || state.radioSuspendedForVideo) return;
  const current = playlist.find((t) => String(t.id) === String(state.currentTrackId));
  if (current) {
    $('audio').play().catch(error => { if (error.name === 'NotAllowedError') {state.radioAutoplayBlocked = true; updateRadioFab();} else playTrack(current.id, { toast:false }); });
    return;
  }
  const index = playlist.length <= 1 ? 0 : Math.floor(Math.random() * playlist.length);
  playTrack(playlist[index].id, { toast:false });
}

function setRadioMuted(muted) {
  state.radioMuted = Boolean(muted);
  localStorage.setItem(RADIO_MUTED_KEY, state.radioMuted ? '1' : '0');
  if (state.radioMuted) { state.radioEpoch = (state.radioEpoch || 0) + 1; state.radioResolving = false; state.radioAutoplayBlocked = false; $('audio').pause(); hideRadioNowPlaying(); }
  else startRadioFromRandomIfNeeded();
  updateRadioFab();
  if (!$('modal').classList.contains('hidden') && $('modalTitle').textContent === 'رادیو آل فاطمیون') openRadio();
}

function radioTrackRow(t) {
  const selected = state.radioSelection != null && state.radioSelection.map(String).includes(String(t.id));
  const current = String(state.currentTrackId || '') === String(t.id);
  return `<button class="radio-track-row ${current ? 'playing' : ''}" type="button" data-radio-track="${escapeHtml(t.id)}">
    <span class="radio-check">${selected ? '☑' : '☐'}</span>
    <span><strong>${escapeHtml(t.title || 'بدون عنوان')}</strong>${t.performer ? `<small>${escapeHtml(t.performer)}</small>` : ''}${current ? '<em>در حال پخش</em>' : ''}</span>
  </button>`;
}

function openRadio(preselect = '') {
  const tracks = enabledTracks();
  const selected = normalizeRadioSelection();
  state.radioSelection = selected;
  const current = tracks.find((t) => String(t.id) === String(state.currentTrackId));
  const radioAlreadyOpen = !$('modal').classList.contains('hidden') && $('modalTitle').textContent === 'رادیو آل فاطمیون';
  const radioHtml = `<section class="radio-sheet">
    <div class="radio-status-card">
      <span class="radio-status-icon">♪</span>
      <div><strong>${escapeHtml(current?.title || 'صف پخش آماده است')}</strong><small>${escapeHtml(!state.config?.nava?.enabled ? 'رادیو از سوی مدیر غیرفعال است.' : !tracks.length ? 'هنوز نوایی ثبت نشده است.' : state.radioMuted ? 'رادیو خاموش است.' : state.radioSuspendedForVideo ? 'هنگام پخش ویدئو موقتاً متوقف است.' : state.radioAutoplayBlocked ? 'برای شروع پخش، صفحه را لمس کنید.' : current?.performer || (selected == null ? 'پخش همه نواها به ترتیب' : `${toFaDigits(selected.length)} نوا در صف پخش`))}</small></div>
      <label class="switch"><input id="radioSwitch" type="checkbox" ${!state.radioMuted && tracks.length ? 'checked' : ''} ${tracks.length ? '' : 'disabled'}><span></span></label>
    </div>
    ${tracks.length ? `<input id="radioSearch" class="radio-search" placeholder="جست‌وجوی نوا">
      <button id="radioAll" class="radio-all ${selected == null ? 'active' : ''}" type="button"><span>${selected == null ? '◉' : '○'}</span><div><strong>پخش همه نواها</strong><small>به ترتیب فهرست ثبت‌شده مدیر</small></div></button>
      <small class="muted">برای محدودکردن صف، یک یا چند نوا را علامت بزنید.</small>
      <div id="radioGroups"></div>` : '<div class="empty">رادیو یا نواهای این بخش غیرفعال است.</div>'}
  </section>`;
  if (radioAlreadyOpen) {
    $('modalTitle').textContent = 'رادیو آل فاطمیون';
    $('modalBody').innerHTML = radioHtml;
  } else openModal('رادیو آل فاطمیون', radioHtml);

  function paintGroups(query = '') {
    const root = $('radioGroups');
    if (!root) return;
    const normalized = normalizeSearch(query);
    const filtered = tracks.filter((t) => !normalized || normalizeSearch(`${t.title || ''} ${t.performer || ''} ${t.category || ''}`).includes(normalized));
    const mourning = filtered.filter((t) => t.category !== 'celebration');
    const celebration = filtered.filter((t) => t.category === 'celebration');
    root.innerHTML = `${mourning.length ? `<details class="radio-group"><summary>نوحه و عزاداری <span>${toFaDigits(mourning.length)} نوا</span></summary>${mourning.map(radioTrackRow).join('')}</details>` : ''}${celebration.length ? `<details class="radio-group"><summary>مولودی و سرود <span>${toFaDigits(celebration.length)} نوا</span></summary>${celebration.map(radioTrackRow).join('')}</details>` : ''}${filtered.length ? '' : '<div class="empty">نوایی مطابق جست‌وجو پیدا نشد.</div>'}`;
    root.querySelectorAll('[data-radio-track]').forEach((button) => button.addEventListener('click', () => toggleRadioTrack(button.dataset.radioTrack)));
  }
  paintGroups('');
  $('radioSearch')?.addEventListener('input', (e) => paintGroups(e.target.value));
  $('radioSwitch')?.addEventListener('change', (e) => setRadioMuted(!e.target.checked));
  $('radioAll')?.addEventListener('click', () => {
    state.radioSelection = null;
    saveRadioSelection();
    state.radioMuted = false;
    localStorage.setItem(RADIO_MUTED_KEY, '0');
    startRadioFromRandomIfNeeded();
    openRadio();
  });
  if (preselect && tracks.some((t) => String(t.id) === String(preselect))) setTimeout(() => playTrack(preselect), 0);
}

function toggleRadioTrack(id) {
  const all = enabledTracks();
  const key = String(id);
  if (!all.some((t) => String(t.id) === key)) return;
  if (state.radioSelection == null) state.radioSelection = [key];
  else if (state.radioSelection.map(String).includes(key)) {
    state.radioSelection = state.radioSelection.filter((x) => String(x) !== key);
    if (!state.radioSelection.length) state.radioSelection = null;
  } else state.radioSelection = [...state.radioSelection, key];
  state.radioSelection = normalizeRadioSelection();
  saveRadioSelection();
  state.radioMuted = false;
  localStorage.setItem(RADIO_MUTED_KEY, '0');
  if (state.radioSelection == null || state.radioSelection.map(String).includes(String(state.currentTrackId))) {
    if ($('audio').paused && state.currentTrackId) $('audio').play().catch(() => {});
  } else playTrack(key, { toast:false });
  openRadio();
}

function stopAudioForLogout() {
  state.radioEpoch = (state.radioEpoch || 0) + 1;
  state.radioResolving = false;
  state.radioAutoplayBlocked = false;
  state.radioAnnouncedId = null;
  hideRadioNowPlaying();
  clearTimeout(state.radioNowTimer);
  const audio = $('audio');
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  state.currentTrackId = null;
  state.radioSuspendedForVideo = false;
  state.radioResumeAfterVideo = false;
}
