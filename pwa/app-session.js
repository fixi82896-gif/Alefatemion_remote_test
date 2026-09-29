'use strict';

const INTRO_SEEN_KEY = 'alef_pwa_intro_seen_v1';
function introDay() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
}
function shouldShowIntro(config) {
  if (!config?.enabled) return false;
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(INTRO_SEEN_KEY) || '{}'); } catch { /* no valid record */ }
  if (config.display_mode === 'daily') return seen.day !== introDay();
  if (config.display_mode === 'once_per_install') return !seen.install;
  if (config.display_mode === 'once_per_revision') return Number(seen.revision || 0) < Number(config.content_revision || 0);
  return true;
}
function introColor(value, fallback) {
  const hex = String(value || '');
  if (/^#[0-9a-f]{8}$/i.test(hex)) return '#' + hex.slice(3) + hex.slice(1,3);
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback;
}
function introNumber(value, fallback, min, max) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
}
function showEntryIntro(config) {
  state.introActive = true;
  $('splash').classList.add('hidden');
  $('auth').classList.add('hidden');
  $('app').classList.add('hidden');
  const root = document.createElement('section');
  root.id = 'entryIntro';
  root.className = 'entry-intro';
  const background = config.background || {};
  const colors = (background.gradient_colors || []).map(c => introColor(c, '#07170f'));
  root.style.background = background.mode === 'solid' ? (colors[0] || '#07170f') : `linear-gradient(180deg,${(colors.length > 1 ? colors : ['#020a06','#0d2d1d']).join(',')})`;
  root.style.color = introColor(config.text_color, '#ffffff');
  root.style.setProperty('--intro-accent', introColor(config.accent_color, '#d8c996'));
  root.style.setProperty('--intro-button', introColor(config.button_color, '#1d7047'));
  root.style.setProperty('--intro-watermark', introNumber(background.watermark_opacity_percent,14,0,50)/100);
  root.style.setProperty('--intro-size', introNumber(config.text_size_sp,20,14,32)+'px');
  root.style.setProperty('--intro-line', introNumber(config.line_height_sp,38,22,60)+'px');
  const image = background.mode === 'image' ? safeHttps(background.image_url) : '';
  root.innerHTML = `${image ? `<img class="intro-background" src="${escapeHtml(image)}" alt=""><div class="intro-shade"></div>` : ''}
    <img class="intro-watermark" src="/brand-logo.webp" alt="">
    <div class="intro-content"><header><img src="/brand-logo.webp" alt="آل فاطمیون"><div><h1>${escapeHtml(config.title || 'آل فاطمیون')}</h1><p>${escapeHtml(config.subtitle || '')}</p></div></header>
    <p id="introMessage" class="intro-message"></p>
    <div class="intro-actions"><button id="introPlay" class="ghost hidden" type="button">پخش صدای خوشامدگویی</button>${config.audio?.enabled && config.audio?.allow_skip ? '<button id="introSkip" class="ghost" type="button">رد کردن صدا</button>' : ''}<button id="introEnter" class="primary hidden" type="button">${escapeHtml(config.button_text || 'ورود به برنامه')}</button></div></div>`;
  root.querySelector('.intro-shade')?.style.setProperty('opacity',introNumber(background.image_overlay_percent,45,0,90)/100);
  const message = root.querySelector('#introMessage');
  message.style.textAlign = config.text_align === 'center' ? 'center' : 'start';
  document.body.appendChild(root);
  scrollTo(0,0);
  const audioConfig = config.audio || {};
  const audio = new Audio();
  audio.preload = 'auto';
  let audioDone = !audioConfig.enabled, textDone = false, failSafe = false, closed = false;
  let typingTimer, failTimer;
  const enter = root.querySelector('#introEnter'), play = root.querySelector('#introPlay');
  const updateButton = () => {
    const mode = audioConfig.button_mode || 'after_audio';
    enter.classList.toggle('hidden', !(failSafe || mode === 'immediate' || (mode === 'after_text' ? textDone : audioDone)));
  };
  const completed = () => { audioDone = true; play.classList.add('hidden'); updateButton(); };
  root.querySelector('#introSkip')?.addEventListener('click',()=>{audio.pause();completed();});
  audio.addEventListener('ended',completed);
  audio.addEventListener('error',completed);
  const playIntro = () => audio.play().then(() => play.classList.add('hidden')).catch(error => {
    if (closed) return;
    if (error.name === 'NotAllowedError') play.classList.remove('hidden');
    else completed();
  });
  play.addEventListener('click',playIntro);
  if (audioConfig.enabled) {
    audio.src = safeHttps(audioConfig.asset_url) || '/intro-salam.m4a';
    audio.volume = introNumber(audioConfig.volume_percent,100,0,100)/100;
    playIntro();
  }
  const full = String(config.message || '').trim();
  const effect = config.text_effect || 'static';
  const parts = effect === 'word_by_word' ? (full.match(/\S+\s*/g) || []) : Array.from(full);
  if (effect === 'typewriter' || effect === 'word_by_word') {
    let index = 0;
    const tick = () => {
      if (closed) return;
      if (index < parts.length) message.textContent += parts[index++];
      textDone = index >= parts.length;
      updateButton();
      if (!textDone) typingTimer = setTimeout(tick,introNumber(config.effect_speed_millis,45,10,250)*(effect === 'word_by_word' ? 3 : 1));
    };
    tick();
  } else {
    message.textContent = full; textDone = true;
    if (effect === 'fade' || effect === 'slide_up') message.classList.add('intro-'+effect);
  }
  failTimer = setTimeout(()=>{failSafe = true; updateButton();},30000);
  updateButton();
  enter.addEventListener('click',()=>{
    if (closed) return;
    closed = true;
    clearTimeout(typingTimer); clearTimeout(failTimer);
    audio.pause(); audio.removeAttribute('src'); audio.load();
    try { localStorage.setItem(INTRO_SEEN_KEY,JSON.stringify({install:true,day:introDay(),revision:Number(config.content_revision || 0)})); } catch { /* storage unavailable */ }
    root.remove(); state.introActive = false;
    showApp();
  });
}

const sessionBaseShowApp = showApp;
showApp = function showAppWithEntry() {
  if (state.introActive) return;
  if (!state.introChecked) {
    state.introChecked = true;
    if (shouldShowIntro(state.config?.intro)) { showEntryIntro(state.config.intro); return; }
  }
  sessionBaseShowApp();
  if (!state.sessionStarted) {
    state.sessionStarted = true;
    startRadioFromRandomIfNeeded();
  }
};
