'use strict';

// Google Material icons; Apache 2.0 (see package license).
const HOME_SECTION_ICONS = {"albums": "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" enable-background=\"new 0 0 24 24\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\"><rect fill=\"none\" height=\"24\" width=\"24\"/><g><path d=\"M18,2H6C4.9,2,4,2.9,4,4v16c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V4C20,2.9,19.1,2,18,2z M15.24,10.55L13.5,9.5l-1.74,1.05 c-0.33,0.2-0.76-0.04-0.76-0.43V4h5v6.12C16,10.51,15.58,10.75,15.24,10.55z M7.6,17.2l1.38-1.83c0.2-0.27,0.6-0.27,0.8,0L11,17 l2.23-2.97c0.2-0.27,0.6-0.27,0.8,0l2.38,3.17c0.25,0.33,0.01,0.8-0.4,0.8H8C7.59,18,7.35,17.53,7.6,17.2z\"/></g></svg>", "images": "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\"><path d=\"M0 0h24v24H0V0z\" fill=\"none\"/><path d=\"M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-10.6-3.47l1.63 2.18 2.58-3.22c.2-.25.58-.25.78 0l2.96 3.7c.26.33.03.81-.39.81H9c-.41 0-.65-.47-.4-.8l2-2.67c.2-.26.6-.26.8 0zM2 7v13c0 1.1.9 2 2 2h13c.55 0 1-.45 1-1s-.45-1-1-1H5c-.55 0-1-.45-1-1V7c0-.55-.45-1-1-1s-1 .45-1 1z\"/></svg>", "videos": "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\"><path d=\"M3 6c-.55 0-1 .45-1 1v13c0 1.1.9 2 2 2h13c.55 0 1-.45 1-1s-.45-1-1-1H5c-.55 0-1-.45-1-1V7c0-.55-.45-1-1-1zm17-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l5.47 4.1c.27.2.27.6 0 .8L12 14.5z\"/></svg>", "radio": "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\"><path d=\"M3.24 6.15C2.51 6.43 2 7.17 2 8v12c0 1.1.9 2 2 2h16c1.11 0 2-.9 2-2V8c0-1.1-.9-2-2-2H8.3l7.43-3c.46-.19.68-.71.49-1.17-.19-.46-.71-.68-1.17-.49L3.24 6.15zM7 20c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-8h-2v-1c0-.55-.45-1-1-1s-1 .45-1 1v1H4V9c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v3z\"/></svg>", "favorites": "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\"><path d=\"M0 0h24v24H0V0z\" fill=\"none\"/><path d=\"M13.35 20.13c-.76.69-1.93.69-2.69-.01l-.11-.1C5.3 15.27 1.87 12.16 2 8.28c.06-1.7.93-3.33 2.34-4.29 2.64-1.8 5.9-.96 7.66 1.1 1.76-2.06 5.02-2.91 7.66-1.1 1.41.96 2.28 2.59 2.34 4.29.14 3.88-3.3 6.99-8.55 11.76l-.1.09z\"/></svg>", "announcements": "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" height=\"24\" viewBox=\"0 -960 960 960\" width=\"24\"><path d=\"M840-440h-80q-17 0-28.5-11.5T720-480q0-17 11.5-28.5T760-520h80q17 0 28.5 11.5T880-480q0 17-11.5 28.5T840-440ZM664-288q10-14 26-16t30 8l64 48q14 10 16 26t-8 30q-10 14-26 16t-30-8l-64-48q-14-10-16-26t8-30Zm120-424-64 48q-14 10-30 8t-26-16q-10-14-8-30t16-26l64-48q14-10 30-8t26 16q10 14 8 30t-16 26ZM200-360h-40q-33 0-56.5-23.5T80-440v-80q0-33 23.5-56.5T160-600h160l139-84q20-12 40.5 0t20.5 35v338q0 23-20.5 35t-40.5 0l-139-84h-40v120q0 17-11.5 28.5T240-200q-17 0-28.5-11.5T200-240v-120Zm240-22v-196l-98 58H160v80h182l98 58Zm120 36v-268q27 24 43.5 58.5T620-480q0 41-16.5 75.5T560-346ZM300-480Z\"/></svg>"};

function fixedBanners() {
  return (state.config?.home?.banners || [])
    .filter((b) => b?.fixed === true && activeByTime(b) && safeHttps(b.image_url))
    .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
    .slice(0, 3);
}

function activeNotices() {
  if (state.config?.announcements?.enabled === false) return [];
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const seenDay = 24 * 60 * 60 * 1000;
  return (state.config?.announcements?.items || [])
    .filter((n) => n?.published !== false)
    .filter((n) => {
      const expires = Number(n.expires_at_millis || 0);
      if (expires && expires <= now) return false;
      const published = Number(n.published_at_millis || 0);
      if (!n.pinned && published > 0 && published < now - sevenDays) return false;
      const seenAt = Number(state.seenNotices[n.id] || 0);
      if (!n.pinned && seenAt > 0 && seenAt < now - seenDay) return false;
      return true;
    })
    .sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true) || Number(b.published_at_millis || 0) - Number(a.published_at_millis || 0));
}

function noticeCategoryLabel(category) {
  const map = { notice:'اطلاعیه', news:'خبر', album:'آلبوم', radio:'رادیو', update:'بروزرسانی' };
  return map[String(category || '').toLowerCase()] || 'اطلاعیه';
}

function noticeCategoryIcon(category) {
  const key = String(category || '').toLowerCase();
  if (key === 'radio') return '♪';
  if (key === 'album') return '▦';
  if (key === 'news') return '●';
  return '◉';
}

function homeSectionEnabled(id) {
  const sections = state.config?.home?.sections || [];
  if (!sections.length) return true;
  return sections.some((s) => s?.id === id && s.enabled !== false);
}

function homeSectionsOrdered() {
  return (state.config?.home?.sections || [])
    .filter((s) => s?.enabled !== false && s.id !== 'quick_access')
    .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
}

function homeBannerCardHtml({ id, title, subtitle, imageUrl = '', icon = '•', status = '', radio = false, loading = false, video = false }) {
  const image = String(imageUrl || '').trim() ? safeHttps(imageUrl) : '';
  return `<button class="home-content-banner ${radio ? 'radio-mode' : ''}" data-home-action="${escapeHtml(id)}" type="button">
    ${image ? `<img class="home-content-image" src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">` : ''}
    <div class="home-content-shade"></div>
    <img class="home-content-logo" src="/brand-logo.webp" alt="آل فاطمیون">
    <span class="home-content-icon">${HOME_SECTION_ICONS[id] || escapeHtml(icon)}</span>
    ${video && image ? '<span class="home-play-preview" aria-hidden="true">▶</span>' : ''}
    ${loading ? '<span class="home-card-loading" aria-hidden="true"></span>' : ''}
    ${status ? `<span class="home-content-status">${escapeHtml(status)}</span>` : ''}
    <div class="home-content-copy">
      <strong>${escapeHtml(title)}</strong>
      <span class="home-subtitle-row"><span>${escapeHtml(loading ? 'در حال آماده‌سازی…' : subtitle)}</span><b aria-hidden="true">‹</b></span>
    </div>
  </button>`;
}

async function findFolderPreview(folder) {
  if (!folder?.hash) return '';
  try {
    const children = await fetchFolder(folder.hash);
    const media = children.find((x) => x.isImage && (x.thumbnailUrl || x.downloadUrl)) || children.find((x) => x.isVideo && x.thumbnailUrl);
    return media?.thumbnailUrl || (media?.isImage ? media.downloadUrl : '') || '';
  } catch {
    return '';
  }
}

async function loadAllMediaTree(rootHash = state.rootHash) {
  const collected = [];
  const queue = [{ hash:rootHash, path:'آلبوم‌ها' }];
  const visited = new Set();
  let folderCount = 0;
  while (queue.length && folderCount < 250 && collected.length < 2500) {
    const current = queue.shift();
    if (!current?.hash || visited.has(current.hash)) continue;
    visited.add(current.hash);
    folderCount += 1;
    let items = [];
    try { items = await fetchFolder(current.hash); } catch { continue; }
    for (const item of items) {
      const enriched = { ...item, parentHash:current.hash, path:current.path };
      collected.push(enriched);
      if (item.isFolder && item.hash) {
        queue.push({ hash:item.hash, path:`${current.path} / ${item.name}` });
      }
      if (collected.length >= 2500) break;
    }
  }
  return collected;
}

async function loadHomePreview() {
  if (state.homePreviewLoading) return;
  state.homePreviewLoading = true;
  try {
    const rootItems = await fetchFolder(state.rootHash);
    const albums = rootItems.filter((x) => x.isFolder).slice(0, 8);
    const firstAlbum = albums[0] || null;
    const firstAlbumCover = firstAlbum ? await findFolderPreview(firstAlbum) : '';
    const all = await loadAllMediaTree(state.rootHash);
    const media = all.filter((x) => x.isImage || x.isVideo)
      .sort((a, b) => Math.max(b.lastModified, b.createdAt) - Math.max(a.lastModified, a.createdAt));
    state.homePreview = {
      albums,
      firstAlbum,
      firstAlbumCover,
      recentImages: media.filter((x) => x.isImage).slice(0, 10),
      recentVideos: media.filter((x) => x.isVideo).slice(0, 10)
    };
    state.albumGlobalItems = all;
  } catch (error) {
    console.warn('home-preview', error);
    state.homePreview = { albums:[], firstAlbum:null, firstAlbumCover:'', recentImages:[], recentVideos:[] };
  } finally {
    state.homePreviewLoading = false;
    if (state.tab === 'home' && state.me) renderHome();
  }
}

function renderHome() {
  stopHeroTimer();
  const view = $('view');
  const items = heroItems();
  const fixed = fixedBanners();
  const preview = state.homePreview;
  if (items.length && (state.heroIndex >= items.length || state.heroIndex < 0)) {
    state.heroIndex = items.length <= 1 ? 0 : Math.floor(Math.random() * items.length);
  }

  const latestNotice = activeNotices()[0] || null;
  const favorite = state.favorites[0] || null;
  const currentTrack = enabledTracks().find((t) => t.id === state.currentTrackId) || null;
  const radioSubtitle = currentTrack
    ? [currentTrack.title, currentTrack.performer].filter(Boolean).join(' - ')
    : 'انتخاب و پخش نواها';

  const sectionHtml = [];
  const sections = homeSectionsOrdered();
  const sourceSections = sections.length ? sections : [
    { id:'radio' }, { id:'albums' }, { id:'media' }, { id:'announcements' }, { id:'favorites' }
  ];

  for (const section of sourceSections) {
    if (section.id === 'announcements') {
      if (latestNotice) sectionHtml.push(homeBannerCardHtml({
        id:'announcements', title:'آخرین اخبار و اطلاعیه‌ها', subtitle:latestNotice.title || 'مشاهده اطلاعیه‌ها',
        imageUrl:latestNotice.image_url || '', icon:'◉'
      }));
    } else if (section.id === 'albums') {
      sectionHtml.push(homeBannerCardHtml({
        id:'albums', title:'آلبوم‌های تازه',
        subtitle:preview?.firstAlbum?.name || 'مشاهده آلبوم‌ها',
        imageUrl:preview?.firstAlbumCover || '', icon:'▦', loading:!preview
      }));
    } else if (section.id === 'media') {
      const image = preview?.recentImages?.[0];
      const video = preview?.recentVideos?.find((x) => x.thumbnailUrl) || preview?.recentVideos?.[0];
      sectionHtml.push(homeBannerCardHtml({
        id:'images', title:'تازه‌ترین تصاویر', subtitle:image?.name || 'مشاهده تصاویر',
        imageUrl:image?.thumbnailUrl || image?.downloadUrl || '', icon:'▧', loading:!preview
      }));
      sectionHtml.push(homeBannerCardHtml({
        id:'videos', title:'تازه‌ترین فیلم‌ها', subtitle:video?.name || 'مشاهده فیلم‌ها',
        imageUrl:video?.thumbnailUrl || '', icon:'▶', loading:!preview, video:true
      }));
    } else if (section.id === 'radio') {
      sectionHtml.push(homeBannerCardHtml({
        id:'radio', title:'رادیو آل فاطمیون', subtitle:radioSubtitle,
        imageUrl:state.config?.home?.radio_banner_image_url || '', icon:'♪',
        status:currentTrack && !$('audio').paused ? 'در حال پخش' : '', radio:true
      }));
    } else if (section.id === 'favorites') {
      sectionHtml.push(homeBannerCardHtml({
        id:'favorites', title:'برگزیده‌های شما',
        subtitle:favorite?.name || 'هنوز موردی به برگزیده‌ها اضافه نشده',
        imageUrl:favorite?.thumbnailUrl || (favorite?.isVideo || String(favorite?.type || '').startsWith('video/') ? '' : favorite?.downloadUrl) || '', icon:'♥',
        video:favorite?.isVideo || String(favorite?.type || '').startsWith('video/')
      }));
    }
  }

  view.innerHTML = `
    ${items.length ? '<section class="home-block"><div id="heroArea" class="hero-carousel" role="region" aria-label="بنرهای آل فاطمیون" tabindex="0"></div></section>' : ''}
    ${fixed.map((b, i) => `<section class="home-block"><button class="fixed-banner" data-fixed-banner="${i}" type="button">${homeRemoteBannerHtml(b)}</button></section>`).join('')}
    <section class="home-content-list">${sectionHtml.join('')}</section>`;

  if (items.length) {
    paintHero(items);
    startHeroTimer(items);
  }
  view.querySelectorAll('.home-content-image, .fixed-banner > img').forEach((img) => {
    img.addEventListener('error', () => { img.hidden = true; }, {once:true});
  });
  view.querySelectorAll('[data-fixed-banner]').forEach((button) => button.addEventListener('click', () => {
    handleBanner(fixed[Number(button.dataset.fixedBanner)]);
  }));
  view.querySelectorAll('[data-home-action]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.homeAction;
    if (id === 'radio') return openRadio();
    if (id === 'albums') return openAlbumsRoot();
    if (id === 'images') return openMediaCollection('image');
    if (id === 'videos') return openMediaCollection('video');
    if (id === 'announcements') { state.noticeSubtab = 'public'; return setTab('notices'); }
    if (id === 'favorites') return setTab('favorites');
  }));

  if (!state.homePreview && !state.homePreviewLoading) loadHomePreview();
}

function openAlbumsRoot() {
  state.folderStack = [{ hash:state.rootHash, name:'آلبوم‌ها' }];
  state.folderHash = state.rootHash;
  state.folderQuery = '';
  setTab('albums', { forcePush:true });
}

function openMediaCollection(kind) {
  if (!['image','video'].includes(kind)) return;
  state.folderQuery = '';
  state.folderSearchHistory = false;
  setTab('albums', { collection:kind, forcePush:true });
}

function collectionTitle() {
  return state.collectionKind === 'video' ? 'تازه‌ترین فیلم‌ها' : 'تازه‌ترین تصاویر';
}

function noticeCardHtml(n) {
  const isNew = !isNoticeSeen(n.id);
  return `<button class="notice-card" type="button" data-notice="${escapeHtml(n.id)}">
    ${safeHttps(n.image_url) ? `<img src="${escapeHtml(safeHttps(n.image_url))}" alt="">` : ''}
    <div class="notice-copy">
      <div class="notice-meta"><span>${noticeCategoryIcon(n.category)} ${escapeHtml(noticeCategoryLabel(n.category))}</span>${n.pinned ? '<span title="سنجاق‌شده">📌</span>' : ''}${isNew ? '<span class="badge">جدید</span>' : ''}</div>
      <strong>${escapeHtml(n.title || 'اطلاعیه')}</strong>
      <p>${escapeHtml(n.summary || n.body || '')}</p>
      <small>${escapeHtml(formatPersianDate(n.published_at_millis))}</small>
    </div>
  </button>`;
}

function openNoticeDetail(id) {
  const n = activeNotices().find((x) => String(x.id) === String(id));
  if (!n) return;
  markNoticeSeen(n.id);
  const image = safeHttps(n.image_url);
  openModal(noticeCategoryLabel(n.category), `<article class="notice-detail">
    <small class="muted">${escapeHtml(formatPersianDate(n.published_at_millis))}</small>
    <h2>${escapeHtml(n.title || 'اطلاعیه')}</h2>
    ${image ? `<img src="${escapeHtml(image)}" alt="">` : ''}
    <p>${escapeHtml(n.body || n.summary || '')}</p>
    <div class="notice-detail-actions">
      ${n.related_album_hash ? '<button id="noticeAlbum" class="primary" type="button">مشاهده آلبوم مرتبط</button>' : ''}
      ${n.related_track_id ? '<button id="noticeRadio" class="primary" type="button">پخش نوای مرتبط</button>' : ''}
    </div>
  </article>`);
  $('noticeAlbum')?.addEventListener('click', () => {
    closeModal();
    state.folderStack = [{ hash:state.rootHash, name:'آلبوم‌ها' }, { hash:String(n.related_album_hash), name:n.related_album_name || 'آلبوم مرتبط' }];
    state.folderHash = String(n.related_album_hash);
    state.folderQuery = '';
    setTab('albums', { forcePush:true });
  });
  $('noticeRadio')?.addEventListener('click', () => { closeModal(); openRadio(String(n.related_track_id || '')); });
  if (state.tab === 'notices') renderNotices();
}

async function loadPersonalMessages(force = false) {
  if (state.personalMessages && !force) return state.personalMessages;
  const data = await api('/api/account/messages');
  state.personalMessages = Array.isArray(data.messages) ? data.messages : [];
  updateMessageCount();
  return state.personalMessages;
}

function messageReadAt(m) { return m.read_at_millis || m.read_at || null; }
function messageCreatedAt(m) { return Number(m.created_at_millis || (m.created_at ? Date.parse(m.created_at) : 0) || 0); }

function personalMessageHtml(m) {
  const unread = !messageReadAt(m);
  return `<article class="personal-message ${unread ? 'unread' : ''}" data-personal-message="${escapeHtml(m.message_id)}">
    <button class="personal-message-toggle" type="button" data-message-toggle="${escapeHtml(m.message_id)}">
      <span>${unread ? '<b class="unread-dot"></b>' : '✓'}</span>
      <strong>${escapeHtml(m.title || 'پیام')}</strong>
      <small>${escapeHtml(formatPersianDate(messageCreatedAt(m)))}</small>
      <span class="chevron">⌄</span>
    </button>
    <div class="personal-message-body hidden" data-message-body="${escapeHtml(m.message_id)}">
      <p>${escapeHtml(m.body || '')}</p>
      ${m.origin && m.origin !== 'system' ? '<small class="muted">پشتیبانی</small>' : ''}
      <button class="text-danger" type="button" data-message-delete="${escapeHtml(m.message_id)}">حذف</button>
    </div>
  </article>`;
}

async function renderNotices() {
  stopHeroTimer();
  const view = $('view');
  const publicItems = activeNotices();
  let personal = state.personalMessages;
  if (state.noticeSubtab === 'personal' && !personal) {
    view.innerHTML = '<div class="empty">در حال دریافت پیام‌های شخصی…</div>';
    try { personal = await loadPersonalMessages(); }
    catch (error) { view.innerHTML = `<div class="empty">${escapeHtml(error.message)}<br><button id="retryMessages" class="ghost">تلاش دوباره</button></div>`; $('retryMessages')?.addEventListener('click', () => renderNotices()); return; }
  }
  const publicUnread = publicItems.filter((x) => !isNoticeSeen(x.id)).length;
  const personalUnread = (personal || []).filter((x) => !messageReadAt(x)).length;
  view.innerHTML = `<section class="notice-shell">
    <div class="primary-tabs">
      <button type="button" data-notice-tab="public" class="${state.noticeSubtab === 'public' ? 'active' : ''}">اخبار و اطلاعیه‌ها${publicUnread ? ` (${toFaDigits(publicUnread)})` : ''}</button>
      <button type="button" data-notice-tab="personal" class="${state.noticeSubtab === 'personal' ? 'active' : ''}">پیام‌های شخصی${personalUnread ? ` (${toFaDigits(personalUnread)})` : ''}</button>
    </div>
    <div class="notice-page-head"><span class="notice-page-icon">${state.noticeSubtab === 'public' ? '◉' : '●'}</span><div><h2>${state.noticeSubtab === 'public' ? 'اخبار و اطلاعیه‌ها' : 'پیام‌های شخصی'}</h2><small>${state.noticeSubtab === 'public' ? `${toFaDigits(publicUnread)} تازه • ${toFaDigits(publicItems.length)} قابل مشاهده` : 'پیام‌های مرتبط با حساب شما'}</small></div></div>
    <div class="notice-list">${state.noticeSubtab === 'public'
      ? (publicItems.length ? publicItems.map(noticeCardHtml).join('') : '<div class="empty">فعلاً خبری ثبت نشده است.</div>')
      : ((personal || []).length ? (personal || []).map(personalMessageHtml).join('') : '<div class="empty">پیام شخصی ندارید.</div>')}
    </div>
  </section>`;
  view.querySelectorAll('[data-notice-tab]').forEach((button) => button.addEventListener('click', () => {
    state.noticeSubtab = button.dataset.noticeTab;
    renderNotices();
  }));
  view.querySelectorAll('[data-notice]').forEach((button) => button.addEventListener('click', () => openNoticeDetail(button.dataset.notice)));
  view.querySelectorAll('[data-message-toggle]').forEach((button) => button.addEventListener('click', async () => {
    const id = button.dataset.messageToggle;
    const body = view.querySelector(`[data-message-body="${CSS.escape(id)}"]`);
    body?.classList.toggle('hidden');
    const m = state.personalMessages?.find((x) => String(x.message_id) === String(id));
    if (m && !messageReadAt(m)) {
      m.read_at_millis = Date.now();
      updateMessageCount();
      api(`/api/account/messages/${encodeURIComponent(id)}/read`, { method:'POST', body:{} }).catch(() => {});
      button.closest('.personal-message')?.classList.remove('unread');
    }
  }));
  view.querySelectorAll('[data-message-delete]').forEach((button) => button.addEventListener('click', async () => {
    const id = button.dataset.messageDelete;
    if (!confirm('این پیام فقط از صندوق شما حذف می‌شود. ادامه می‌دهید؟')) return;
    try {
      await api(`/api/account/messages/${encodeURIComponent(id)}`, { method:'DELETE' });
      state.personalMessages = (state.personalMessages || []).filter((x) => String(x.message_id) !== String(id));
      updateMessageCount();
      renderNotices();
    } catch (error) { toast(error.message); }
  }));
}

function parseCloudItems(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.map((wrapper) => {
    const obj = wrapper?.obj || {};
    const type = String(obj.type || '');
    const rawDownload = String(obj.download_url || obj.content_url || '').trim();
    const download = rawDownload ? safeHttps(rawDownload) : '';
    const rawThumbnail = String(obj.thumbnail_url || obj.cover_url || '').trim();
    const thumbnail = rawThumbnail ? safeHttps(rawThumbnail) : '';
    return {
      id: String(obj.id ?? wrapper?.id ?? obj.obj_hash ?? ''),
      name: String(obj.name || 'بدون نام'),
      type,
      isFolder: type === 'folder',
      isImage: type.startsWith('image/'),
      isVideo: type.startsWith('video/'),
      hash: String(obj.obj_hash || ''),
      downloadUrl: download,
      thumbnailUrl: thumbnail,
      createdAt: Number(obj.created_at || 0),
      lastModified: Number(obj.last_modified || 0),
      hasCover: Boolean(obj.has_cover)
    };
  }).filter((item) => item.isFolder || item.isImage || item.isVideo);
}

async function fetchFolder(hash) {
  const payload = await api(`/api/media/list?hash=${encodeURIComponent(hash)}`);
  return parseCloudItems(payload);
}

function ensureFolderTrail() {
  if (!Array.isArray(state.folderStack) || !state.folderStack.length || state.folderStack[0]?.hash !== state.rootHash) {
    state.folderStack = [{ hash:state.rootHash, name:'آلبوم‌ها' }];
  }
  const current = state.folderStack[state.folderStack.length - 1];
  state.folderHash = current?.hash || state.rootHash;
}

function atAlbumsRoot() {
  ensureFolderTrail();
  return state.folderStack.length === 1 && state.folderHash === state.rootHash;
}

function sortAlbumItems(items) {
  const direction = state.albumSort === 'oldest' ? 1 : -1;
  return [...items].sort((a, b) => {
    const aTime = Math.max(a.lastModified, a.createdAt);
    const bTime = Math.max(b.lastModified, b.createdAt);
    if (aTime !== bTime) return (aTime - bTime) * direction;
    return a.name.localeCompare(b.name, 'fa');
  });
}

async function renderAlbums() {
  stopHeroTimer();
  ensureFolderTrail();
  const view = $('view');
  const request = state.albumRenderRequest = (state.albumRenderRequest || 0) + 1;
  const collection = state.collectionKind || null;
  const hash = state.folderHash;
  view.innerHTML = '<div class="empty">در حال دریافت آلبوم‌ها…</div>';
  try {
    let items;
    if (collection) {
      const all = state.albumGlobalItems || await loadAllMediaTree(state.rootHash);
      items = all.filter(x => collection === 'video' ? x.isVideo : x.isImage);
      state.albumGlobalItems = all;
    } else items = await fetchFolder(hash || state.rootHash);
    if (request !== state.albumRenderRequest || state.tab !== 'albums' || (state.collectionKind || null) !== collection) return;
    state.folderItems = items;
    paintFolder();
  } catch (error) {
    if (request !== state.albumRenderRequest || state.tab !== 'albums') return;
    view.innerHTML = `<div class="empty">${escapeHtml(error.message)}<br><br><button id="retryAlbums" class="primary">تلاش دوباره</button></div>`;
    $('retryAlbums')?.addEventListener('click', renderAlbums);
  }
}

function breadcrumbHtml() {
  if (state.collectionKind) return `<div class="breadcrumbs"><strong>${collectionTitle()}</strong></div>`;
  return `<div class="breadcrumbs">${state.folderStack.map((entry, index) => `<button type="button" data-crumb="${index}">${escapeHtml(entry.name)}</button>${index < state.folderStack.length - 1 ? '<span>←</span>' : ''}`).join('')}</div>`;
}

async function loadGlobalSearchIfNeeded() {
  if (state.albumGlobalItems || state.albumGlobalLoading) return;
  state.albumGlobalLoading = true;
  try {
    state.albumGlobalItems = await loadAllMediaTree(state.rootHash);
  } finally {
    state.albumGlobalLoading = false;
    if (state.tab === 'albums' && state.folderQuery) paintFolder();
  }
}

function itemSearchText(item) {
  return normalizeSearch([item.name, item.path || ''].join(' '));
}

function paintFolder() {
  ensureFolderTrail();
  const query = normalizeSearch(state.folderQuery);
  const atRoot = !state.collectionKind && atAlbumsRoot();
  let source = state.folderItems;
  if (query && atRoot) {
    if (!state.albumGlobalItems) {
      loadGlobalSearchIfNeeded();
      source = [];
    } else source = state.albumGlobalItems;
  }
  const filtered = source.filter((item) => !query || itemSearchText(item).includes(query));
  const items = [...sortAlbumItems(filtered.filter(x => x.isFolder)), ...sortAlbumItems(filtered.filter(x => !x.isFolder))];
  state.displayedAlbumItems = items;
  const loadingGlobal = query && atRoot && state.albumGlobalLoading && !state.albumGlobalItems;
  $('view').innerHTML = `<section class="albums-shell">
    <div class="albums-top-row">${breadcrumbHtml()}<button id="albumSettings" class="icon-btn" type="button" title="تنظیمات آلبوم">⚙</button></div>
    <div class="album-toolbar">
      <input id="albumSearch" value="${escapeHtml(state.folderQuery)}" placeholder="جستجوی آلبوم، سال یا نام برنامه">
      <button id="albumSort" class="ghost" type="button">${state.albumSort === 'newest' ? 'جدیدترین' : 'قدیمی‌ترین'}</button>
      <button id="albumRefresh" class="ghost" type="button">↻</button>
    </div>
    ${loadingGlobal ? '<div class="empty">در حال جستجو در همه آلبوم‌ها و رسانه‌ها…</div>' : `<div class="album-grid layout-${escapeHtml(state.albumLayout)}">${items.map(itemCardHtml).join('')}</div>${items.length ? '' : '<div class="empty">موردی مطابق جستجو پیدا نشد.</div>'}`}
  </section>`;

  $('albumSearch')?.addEventListener('focus', () => {
    if (!state.folderSearchHistory) { state.folderSearchHistory = true; pushHistory('album-search'); }
  });
  $('albumSearch')?.addEventListener('input', (event) => {
    state.folderQuery = event.target.value;
    paintFolder();
    queueMicrotask(() => { const input = $('albumSearch'); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } });
  });
  $('albumSort')?.addEventListener('click', () => {
    state.albumSort = state.albumSort === 'newest' ? 'oldest' : 'newest';
    localStorage.setItem(ALBUM_SORT_KEY, state.albumSort);
    paintFolder();
  });
  $('albumRefresh')?.addEventListener('click', () => {
    state.albumGlobalItems = null; state.homePreview = null; renderAlbums();
  });
  $('albumSettings')?.addEventListener('click', openAlbumSettings);
  $('view').querySelectorAll('[data-crumb]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.crumb);
    if (!Number.isInteger(index) || index < 0 || index >= state.folderStack.length) return;
    state.folderStack = state.folderStack.slice(0, index + 1);
    state.folderHash = state.folderStack[state.folderStack.length - 1].hash;
    state.folderQuery = '';
    pushHistory('folder');
    renderAlbums();
  }));
  $('view').querySelectorAll('[data-folder]').forEach((button) => button.addEventListener('click', () => {
    const item = state.displayedAlbumItems.find((x) => x.isFolder && x.hash === button.dataset.folder);
    if (!item) return;
    state.folderStack.push({ hash:item.hash, name:item.name });
    state.folderHash = item.hash;
    state.folderQuery = '';
    pushHistory('folder');
    renderAlbums();
  }));
  $('view').querySelectorAll('[data-media]').forEach((button) => button.addEventListener('click', () => {
    const item = state.displayedAlbumItems.find((x) => String(x.id) === String(button.dataset.media));
    if (!item) return;
    const media = state.displayedAlbumItems.filter((x) => x.isImage || x.isVideo);
    openViewer(item, media);
  }));
  $('view').querySelectorAll('[data-favorite]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    const item = state.displayedAlbumItems.find((x) => String(x.id) === String(button.dataset.favorite));
    if (item) toggleFavorite(item);
  }));
}

function openAlbumSettings() {
  openModal('تنظیمات آلبوم', `<div class="settings-list">
    <label class="list-item settings-row"><div><strong>چیدمان</strong><small>اندازه کارت‌های آلبوم و رسانه</small></div><select id="albumLayoutSelect"><option value="compact">فشرده</option><option value="normal">معمولی</option><option value="large">بزرگ</option></select></label>
    <label class="list-item settings-row"><div><strong>مدت اسلایدشو</strong><small>مدت نمایش هر تصویر</small></div><select id="slideInterval"><option value="3">۳ ثانیه</option><option value="5">۵ ثانیه</option><option value="8">۸ ثانیه</option><option value="12">۱۲ ثانیه</option></select></label>
    <label class="list-item settings-row"><div><strong>افکت اسلایدشو</strong><small>نحوه تعویض تصاویر</small></div><select id="slideEffect"><option value="fade">محو</option><option value="slide">حرکت</option><option value="none">بدون افکت</option></select></label>
  </div>`);
  $('albumLayoutSelect').value = ['compact','normal','large'].includes(state.albumLayout) ? state.albumLayout : 'normal';
  $('slideInterval').value = ['3','5','8','12'].includes(String(state.slideshowInterval)) ? String(state.slideshowInterval) : '5';
  $('slideEffect').value = ['fade','slide','none'].includes(state.slideshowEffect) ? state.slideshowEffect : 'fade';
  $('albumLayoutSelect').addEventListener('change', (e) => { state.albumLayout = e.target.value; localStorage.setItem(ALBUM_LAYOUT_KEY, state.albumLayout); });
  $('slideInterval').addEventListener('change', (e) => { state.slideshowInterval = Number(e.target.value); localStorage.setItem(SLIDESHOW_INTERVAL_KEY, String(state.slideshowInterval)); });
  $('slideEffect').addEventListener('change', (e) => { state.slideshowEffect = e.target.value; localStorage.setItem(SLIDESHOW_EFFECT_KEY, state.slideshowEffect); });
  state.modalCleanup = () => { if (state.tab === 'albums') paintFolder(); };
}

function itemCardHtml(item) {
  if (item.isFolder) {
    const cover = item.thumbnailUrl || '';
    return `<button class="album-card folder-card" data-folder="${escapeHtml(item.hash)}" type="button">
      <span class="album-cover folder-cover"><span class="album-cover-fallback" aria-hidden="true">▰</span>${cover ? `<img src="${escapeHtml(cover)}" loading="lazy" alt="" onerror="this.hidden=true">` : ''}</span>
      <span class="meta"><strong>${escapeHtml(item.name)}</strong><small class="muted">آلبوم</small></span>
    </button>`;
  }
  const mediaIcon = item.isVideo ? '' : '▧';
  const imageUrl = item.thumbnailUrl || (item.isImage ? item.downloadUrl : '');
  const image = `<div class="album-cover"><span class="album-cover-fallback" aria-hidden="true">${mediaIcon}</span>${imageUrl ? `<img src="${escapeHtml(thumbUrl(imageUrl))}" loading="lazy" alt="${escapeHtml(item.name)}" onerror="this.hidden=true">` : ''}</div>`;
  const fav = isFavorite(item.id);
  return `<article class="album-card media-card" data-media="${escapeHtml(item.id)}">${image}${item.isVideo ? '<span class="play-indicator">▶</span>' : ''}<button class="fav ${fav ? 'on' : ''}" data-favorite="${escapeHtml(item.id)}" aria-label="برگزیده">♥</button><div class="meta"><strong>${escapeHtml(item.name)}</strong><small>${item.isVideo ? 'ویدئو' : 'تصویر'}</small></div></article>`;
}

function favoriteSnapshot(item) {
  return { id:item.id, name:item.name, type:item.type, downloadUrl:item.downloadUrl, thumbnailUrl:item.thumbnailUrl || '', addedAt:Date.now() };
}
function isFavorite(id) { return state.favorites.some((x) => String(x.id) === String(id)); }
function toggleFavorite(item) {
  const index = state.favorites.findIndex((x) => String(x.id) === String(item.id));
  if (index >= 0) { state.favorites.splice(index, 1); toast('از برگزیده‌ها حذف شد.'); }
  else { state.favorites.unshift(favoriteSnapshot(item)); toast('به برگزیده‌ها افزوده شد.'); }
  saveFavorites();
  if (state.tab === 'favorites') renderFavorites();
  else if (state.tab === 'albums') paintFolder();
}

function renderFavorites() {
  stopHeroTimer();
  const items = state.favorites.map((item) => ({ ...item, isImage:String(item.type).startsWith('image/'), isVideo:String(item.type).startsWith('video/') }));
  state.displayedAlbumItems = items;
  $('view').innerHTML = `<section class="section"><div class="section-title"><h2>برگزیده‌ها</h2><span class="pill">${toFaDigits(items.length)}</span></div>${items.length ? `<div class="album-grid layout-${escapeHtml(state.albumLayout)}">${items.map(itemCardHtml).join('')}</div>` : '<div class="empty">هنوز موردی به برگزیده‌ها اضافه نشده است.</div>'}</section>`;
  $('view').querySelectorAll('[data-media]').forEach((button) => button.addEventListener('click', () => {
    const item = items.find((x) => String(x.id) === String(button.dataset.media)); if (item) openViewer(item, items);
  }));
  $('view').querySelectorAll('[data-favorite]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation(); const item = items.find((x) => String(x.id) === String(button.dataset.favorite)); if (item) toggleFavorite(item);
  }));
}

function effectivePermission(name) {
  if (state.me?.is_admin === true) return true;
  const p = state.permissions || state.me?.permissions || {};
  if (name === 'allow_photo_download' && p.allow_download === true) return true;
  if (name === 'allow_video_download' && p.allow_download === true) return true;
  return p[name] === true;
}

function viewerCurrent() {
  if (!state.viewer?.items?.length) return null;
  return state.viewer.items[state.viewer.index] || null;
}

function syncViewerFullscreenButton() {
  const button = $('viewerFullscreen');
  if (!button) return;
  const expanded = $('modal').classList.contains('viewer-expanded');
  button.textContent = expanded ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه';
  button.setAttribute('aria-pressed', String(expanded));
}

async function toggleViewerFullscreen() {
  const viewer = state.viewer;
  if (!viewer) return;
  const modal = $('modal');
  if (modal.classList.contains('viewer-expanded')) {
    modal.classList.remove('viewer-expanded');
    syncViewerFullscreenButton();
    if (document.fullscreenElement === modal) {
      try { await document.exitFullscreen(); } catch { /* keep windowed fallback */ }
    }
    return;
  }
  modal.classList.add('viewer-expanded');
  syncViewerFullscreenButton();
  if (modal.requestFullscreen && document.fullscreenEnabled) {
    try {
      await modal.requestFullscreen();
      if (state.viewer !== viewer) {
        if (document.fullscreenElement === modal) await document.exitFullscreen();
      } else viewer.nativeFullscreen = document.fullscreenElement === modal;
    } catch { /* expanded viewport remains available when native fullscreen is denied */ }
  }
}

function renderViewer() {
  const item = viewerCurrent();
  if (!item) { closeModal(); return; }
  const url = safeHttps(item.downloadUrl);
  const isVideo = item.isVideo || String(item.type || '').startsWith('video/');
  const shareAllowed = effectivePermission('allow_share');
  const downloadAllowed = isVideo ? effectivePermission('allow_video_download') : effectivePermission('allow_photo_download');
  $('modalTitle').textContent = item.name || 'رسانه';
  $('modalBody').innerHTML = `<div class="viewer ${escapeHtml(state.slideshowEffect)}">
    <div class="viewer-stage">
      ${isVideo ? `<video id="viewerMedia" src="${escapeHtml(url)}" controls playsinline></video>` : `<img id="viewerMedia" draggable="false" class="viewer-image" src="${escapeHtml(url)}" alt="${escapeHtml(item.name)}">`}
      <img class="viewer-watermark" src="/brand-logo.webp" alt="">
      ${state.viewer.items.length > 1 ? '<button id="viewerPrev" class="viewer-nav viewer-prev" type="button">‹</button><button id="viewerNext" class="viewer-nav viewer-next" type="button">›</button>' : ''}
    </div>
    <div class="viewer-position">${toFaDigits(state.viewer.index + 1)} از ${toFaDigits(state.viewer.items.length)}</div>
    <div class="viewer-actions">
      <button id="viewerFullscreen" type="button" aria-pressed="false">تمام‌صفحه</button>
      <button id="viewerFav" type="button">${isFavorite(item.id) ? '♥ حذف از برگزیده‌ها' : '♡ افزودن به برگزیده‌ها'}</button>
      ${!isVideo ? '<button id="viewerZoom" type="button">بزرگ‌نمایی</button>' : ''}
      ${!isVideo && state.viewer.items.filter((x) => x.isImage || String(x.type || '').startsWith('image/')).length > 1 ? `<button id="viewerSlide" type="button">${state.slideshowTimer ? 'توقف اسلایدشو' : 'اسلایدشو'}</button>` : ''}
      ${shareAllowed ? '<button id="viewerShare" type="button">اشتراک</button>' : ''}
      ${downloadAllowed ? '<button id="viewerDownload" type="button">دانلود</button>' : ''}
    </div>
    ${(!shareAllowed || !downloadAllowed) ? '<small class="muted">اشتراک و دانلود مطابق مجوز حساب کنترل می‌شوند.</small>' : ''}
  </div>`;
  setRadioVideoGate(isVideo);
  $('viewerPrev')?.addEventListener('click', () => moveViewer(-1));
  $('viewerNext')?.addEventListener('click', () => moveViewer(1));
  $('viewerFav')?.addEventListener('click', () => {
    toggleFavorite(item);
    $('viewerFav').textContent = isFavorite(item.id) ? '♥ حذف از برگزیده‌ها' : '♡ افزودن به برگزیده‌ها';
  });
  $('viewerFullscreen')?.addEventListener('click', toggleViewerFullscreen);
  syncViewerFullscreenButton();
  $('viewerZoom')?.addEventListener('click', () => $('viewerMedia')?.classList.toggle('zoomed'));
  $('viewerSlide')?.addEventListener('click', toggleSlideshow);
  $('viewerShare')?.addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title:item.name, url });
      else { await navigator.clipboard.writeText(url); toast('لینک کپی شد.'); }
    } catch { /* cancel */ }
  });
  $('viewerDownload')?.addEventListener('click', () => {
    const a = document.createElement('a'); a.href = url; a.download = item.name || 'alefatemion-media'; a.rel = 'noopener'; a.click();
  });
  const stage = $('modalBody').querySelector('.viewer-stage');
  let gesture = null;
  stage?.addEventListener('pointerdown', (event) => {
    if (gesture || event.isPrimary === false || event.target.closest('button, video') || $('viewerMedia')?.classList.contains('zoomed')) {
      gesture = null;
      return;
    }
    gesture = { id:event.pointerId, x:event.clientX, y:event.clientY };
  });
  stage?.addEventListener('pointerup', (event) => {
    const start = gesture;
    gesture = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) moveViewer(dx > 0 ? -1 : 1);
  });
  stage?.addEventListener('pointercancel', () => { gesture = null; });
  stage?.addEventListener('pointerleave', () => { gesture = null; });
}

function openViewer(item, collection = [item]) {
  const items = collection.filter((x) => (x.isImage || x.isVideo || /^image\//.test(x.type || '') || /^video\//.test(x.type || '')) && safeHttps(x.downloadUrl));
  const index = Math.max(0, items.findIndex((x) => String(x.id) === String(item.id)));
  openModal(item.name || 'رسانه', '<div class="empty">در حال آماده‌سازی…</div>');
  const viewer = state.viewer = { items:items.length ? items : [item], index, zoomed:false, nativeFullscreen:false };
  const fullscreenChanged = () => {
    if (document.fullscreenElement === $('modal')) viewer.nativeFullscreen = true;
    else if (viewer.nativeFullscreen) {
      viewer.nativeFullscreen = false;
      $('modal').classList.remove('viewer-expanded');
    }
    syncViewerFullscreenButton();
  };
  document.addEventListener('fullscreenchange', fullscreenChanged);
  state.modalCleanup = () => {
    stopSlideshow();
    const media = $('viewerMedia');
    if (media?.tagName === 'VIDEO') media.pause();
    document.removeEventListener('fullscreenchange', fullscreenChanged);
    $('modal').classList.remove('viewer-expanded');
    if (document.fullscreenElement === $('modal')) document.exitFullscreen().catch(() => {});
    state.viewer = null;
    setRadioVideoGate(false);
  };
  renderViewer();
}

function moveViewer(delta) {
  if (!state.viewer?.items?.length) return;
  state.viewer.index = (state.viewer.index + delta + state.viewer.items.length) % state.viewer.items.length;
  renderViewer();
}

function stopSlideshow() {
  clearInterval(state.slideshowTimer);
  state.slideshowTimer = null;
}

function toggleSlideshow() {
  if (state.slideshowTimer) { stopSlideshow(); renderViewer(); return; }
  const imageCount = state.viewer?.items?.filter((x) => x.isImage || String(x.type || '').startsWith('image/')).length || 0;
  if (imageCount < 2) return;
  state.slideshowTimer = setInterval(() => {
    if (!state.viewer) return stopSlideshow();
    let tries = 0;
    do { state.viewer.index = (state.viewer.index + 1) % state.viewer.items.length; tries += 1; }
    while (tries <= state.viewer.items.length && (state.viewer.items[state.viewer.index].isVideo || String(state.viewer.items[state.viewer.index].type || '').startsWith('video/')));
    renderViewer();
  }, state.slideshowInterval * 1000);
  renderViewer();
}

function handleBanner(banner) {
  const type = String(banner?.destination_type || 'none');
  if (type === 'radio') return openRadio(banner.destination_id || '');
  if (type === 'album' && banner.destination_id) {
    state.folderStack = [{ hash:state.rootHash, name:'آلبوم‌ها' }, { hash:String(banner.destination_id), name:banner.title || 'آلبوم منتخب' }];
    state.folderHash = String(banner.destination_id);
    state.folderQuery = '';
    setTab('albums', { forcePush:true });
    return;
  }
  if (type === 'external') {
    const url = safeHttps(banner.external_url); if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }
}
