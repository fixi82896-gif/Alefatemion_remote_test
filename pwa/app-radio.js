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
  fab.classList.toggle('muted', state.radioMuted || fab.disabled);
  fab.textContent = state.radioMuted ? '♩' : '♪';
  fab.title = state.radioMuted ? 'رادیو خاموش است' : 'رادیو آل فاطمیون';
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

function showRadioNowPlaying(track) {
  const banner = $('radioNowPlaying');
  if (!banner || !track) return;
  clearTimeout(state.radioNowTimer);
  banner.textContent = [track.title, track.performer].filter(Boolean).join(' - ') || 'رادیو آل فاطمیون';
  banner.classList.remove('hidden');
  state.radioNowTimer = setTimeout(() => banner.classList.add('hidden'), 5000);
  if (state.tab === 'home') renderHome();
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
  updateRadioFab();
  try {
    const audio = $('audio');
    const resolved = await resolveRadioTrack(track);
    const same = String(state.currentTrackId || '') === String(track.id) && audio.src === resolved;
    state.currentTrackId = String(track.id);
    if (!same) {
      audio.src = resolved;
      audio.load();
    }
    if (!state.radioSuspendedForVideo) await audio.play();
    showRadioNowPlaying(track);
    if (options.toast !== false) toast(`در حال پخش: ${track.title || 'نوا'}`);
  } catch (error) {
    console.warn('radio-play', error);
    toast(error.message || 'پخش این نوا انجام نشد.');
  } finally {
    state.radioResolving = false;
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
    $('audio').play().catch(() => playTrack(current.id, { toast:false }));
    return;
  }
  const index = playlist.length <= 1 ? 0 : Math.floor(Math.random() * playlist.length);
  playTrack(playlist[index].id, { toast:false });
}

function setRadioMuted(muted) {
  state.radioMuted = Boolean(muted);
  localStorage.setItem(RADIO_MUTED_KEY, state.radioMuted ? '1' : '0');
  if (state.radioMuted) $('audio').pause();
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
      <div><strong>${escapeHtml(current?.title || 'صف پخش آماده است')}</strong><small>${escapeHtml(!state.config?.nava?.enabled ? 'رادیو از سوی مدیر غیرفعال است.' : !tracks.length ? 'هنوز نوایی ثبت نشده است.' : state.radioMuted ? 'رادیو خاموش است.' : state.radioSuspendedForVideo ? 'هنگام پخش ویدئو موقتاً متوقف است.' : current?.performer || (selected == null ? 'پخش همه نواها به ترتیب' : `${toFaDigits(selected.length)} نوا در صف پخش`))}</small></div>
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
    root.innerHTML = `${mourning.length ? `<details class="radio-group" open><summary>نوحه و عزاداری <span>${toFaDigits(mourning.length)} نوا</span></summary>${mourning.map(radioTrackRow).join('')}</details>` : ''}${celebration.length ? `<details class="radio-group"><summary>مولودی و سرود <span>${toFaDigits(celebration.length)} نوا</span></summary>${celebration.map(radioTrackRow).join('')}</details>` : ''}${filtered.length ? '' : '<div class="empty">نوایی مطابق جست‌وجو پیدا نشد.</div>'}`;
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
