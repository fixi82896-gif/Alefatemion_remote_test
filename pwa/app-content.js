function renderHome() {
  const view = $('view');
  const banners = heroBanners();
  if (banners.length && (state.heroIndex >= banners.length || state.heroIndex < 0)) state.heroIndex = Math.floor(Math.random() * banners.length);
  const sections = (state.config?.home?.sections || []).filter((s) => s.enabled !== false).sort((a,b)=>Number(a.display_order||0)-Number(b.display_order||0));
  const known = sections.map((s)=>s.id);
  const quick = [
    ['radio','رادیو','پخش نواهای فعال'],['albums','آلبوم‌ها','مرور عکس و فیلم'],['media','رسانه‌ها','تصاویر و ویدئوها'],
    ['announcements','اطلاعیه‌ها','اخبار و پیام‌های عمومی'],['favorites','علاقه‌مندی‌ها','موارد ذخیره‌شده']
  ].filter(([id]) => !known.length || known.includes(id) || (id==='announcements' && known.includes('notices')));
  view.innerHTML = `
    ${banners.length ? '<div id="heroArea" class="hero" role="button" tabindex="0"></div>' : ''}
    <section class="section"><div class="section-title"><h2>دسترسی سریع</h2></div>
      <div class="cards quick">${quick.map(([id,title,sub])=>`<button class="card" data-quick="${id}"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(sub)}</small></button>`).join('')}</div>
    </section>
    ${renderPinnedNoticesHome()}
    <section class="section"><div class="section-title"><h2>وضعیت نسخه</h2></div><div class="card"><strong>${VERSION}</strong><small>نسخه آزمایشی وب — مدیریت فقط از Android</small></div></section>`;
  if (banners.length) {
    paintHero(banners);
    startHeroTimer(banners);
  } else stopHeroTimer();
  view.querySelectorAll('[data-quick]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.quick;
    if (id === 'radio') return openRadio();
    if (id === 'albums' || id === 'media') return setTab('albums');
    if (id === 'announcements') return setTab('notices');
    if (id === 'favorites') return setTab('favorites');
  }));
}

function renderPinnedNoticesHome() {
  const items = activeNotices().filter((n) => n.pinned).slice(0,2);
  if (!items.length) return '';
  return `<section class="section"><div class="section-title"><h2>اطلاعیه‌های مهم</h2><button class="ghost" id="allNotices">همه</button></div><div class="list">${items.map(noticeHtml).join('')}</div></section>`;
}

function activeNotices() {
  if (state.config?.announcements?.enabled === false) return [];
  const now = Date.now();
  return (state.config?.announcements?.items || []).filter((n) => n.published !== false && (!Number(n.expires_at_millis || 0) || Number(n.expires_at_millis) > now)).sort((a,b)=>Number(b.published_at_millis||0)-Number(a.published_at_millis||0));
}

function noticeHtml(n) {
  return `<article class="list-item"><strong>${escapeHtml(n.title || 'اطلاعیه')}</strong>${n.summary?`<div class="muted">${escapeHtml(n.summary)}</div>`:''}<p>${escapeHtml(n.body || '')}</p></article>`;
}

function renderNotices() {
  stopHeroTimer();
  const items = activeNotices();
  $('view').innerHTML = `<section class="section"><div class="section-title"><h2>اخبار و اطلاعیه‌ها</h2><span class="pill">${items.length}</span></div>${items.length?`<div class="list">${items.map(noticeHtml).join('')}</div>`:'<div class="empty">اطلاعیه‌ای برای نمایش وجود ندارد.</div>'}</section>`;
}

function parseCloudItems(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.map((wrapper) => {
    const obj = wrapper?.obj || {};
    const type = String(obj.type || '');
    return {
      id: String(obj.id ?? wrapper?.id ?? ''),
      name: String(obj.name || 'بدون نام'),
      type,
      isFolder: type === 'folder',
      isImage: type.startsWith('image/'),
      isVideo: type.startsWith('video/'),
      hash: String(obj.obj_hash || ''),
      downloadUrl: safeHttps(obj.download_url || ''),
      createdAt: Number(obj.created_at || 0),
      lastModified: Number(obj.last_modified || 0),
      hasCover: Boolean(obj.has_cover)
    };
  }).filter((item) => item.isFolder || item.isImage || item.isVideo)
    .sort((a,b) => Math.max(b.lastModified,b.createdAt)-Math.max(a.lastModified,a.createdAt) || a.name.localeCompare(b.name,'fa'));
}

async function fetchFolder(hash) {
  const payload = await api(`/api/media/list?hash=${encodeURIComponent(hash)}`);
  return parseCloudItems(payload);
}

async function renderAlbums() {
  stopHeroTimer();
  const view = $('view');
  view.innerHTML = '<div class="empty">در حال دریافت آلبوم‌ها…</div>';
  try {
    state.folderItems = await fetchFolder(state.folderHash || state.rootHash);
    paintFolder();
  } catch (error) {
    view.innerHTML = `<div class="empty">${escapeHtml(error.message)}<br><br><button id="retryAlbums" class="primary">تلاش دوباره</button></div>`;
    $('retryAlbums')?.addEventListener('click', renderAlbums);
  }
}

function paintFolder() {
  const query = normalizeSearch(state.folderQuery);
  const items = state.folderItems.filter((item) => !query || normalizeSearch(item.name).includes(query));
  const atRoot = state.folderHash === state.rootHash && !state.folderStack.length;
  $('view').innerHTML = `
    <div class="toolbar">${atRoot?'': '<button id="folderBack" class="ghost">بازگشت</button>'}<input id="albumSearch" value="${escapeHtml(state.folderQuery)}" placeholder="جستجو در این آلبوم"></div>
    <div class="album-grid">${items.map(itemCardHtml).join('')}</div>
    ${items.length?'':'<div class="empty">موردی پیدا نشد.</div>'}`;
  $('folderBack')?.addEventListener('click', () => {
    const previous = state.folderStack.pop();
    state.folderHash = previous?.hash || state.rootHash;
    state.folderQuery = '';
    renderAlbums();
  });
  $('albumSearch')?.addEventListener('input', (event) => { state.folderQuery = event.target.value; paintFolder(); });
  $('view').querySelectorAll('[data-folder]').forEach((button) => button.addEventListener('click', () => {
    const item = state.folderItems.find((x) => x.hash === button.dataset.folder);
    if (!item) return;
    state.folderStack.push({ hash: state.folderHash, name: item.name });
    state.folderHash = item.hash;
    state.folderQuery = '';
    renderAlbums();
  }));
  $('view').querySelectorAll('[data-media]').forEach((button) => button.addEventListener('click', () => {
    const item = state.folderItems.find((x) => x.id === button.dataset.media);
    if (item) openViewer(item);
  }));
  $('view').querySelectorAll('[data-favorite]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    const item = state.folderItems.find((x) => x.id === button.dataset.favorite);
    if (item) toggleFavorite(item);
  }));
}

function itemCardHtml(item) {
  if (item.isFolder) {
    return `<button class="album-card folder-card" data-folder="${escapeHtml(item.hash)}"><span class="folder-icon">▰</span><span class="meta"><strong>${escapeHtml(item.name)}</strong><small class="muted">آلبوم</small></span></button>`;
  }
  const mediaIcon = item.isVideo ? '▶' : '▧';
  const image = item.downloadUrl ? `<img src="${escapeHtml(thumbUrl(item.downloadUrl))}" loading="lazy" alt="${escapeHtml(item.name)}" onerror="this.style.display='none'">` : `<div class="folder-icon">${mediaIcon}</div>`;
  const fav = isFavorite(item.id);
  return `<article class="album-card" data-media="${escapeHtml(item.id)}">${image}<button class="fav ${fav?'on':''}" data-favorite="${escapeHtml(item.id)}" aria-label="علاقه‌مندی">♥</button><div class="meta"><strong>${escapeHtml(item.name)}</strong><small>${item.isVideo?'ویدئو':'تصویر'}</small></div></article>`;
}

function favoriteSnapshot(item) {
  return { id:item.id, name:item.name, type:item.type, downloadUrl:item.downloadUrl, addedAt:Date.now() };
}
function isFavorite(id) { return state.favorites.some((x)=>x.id===id); }
function toggleFavorite(item) {
  const index = state.favorites.findIndex((x)=>x.id===item.id);
  if (index >= 0) { state.favorites.splice(index,1); toast('از علاقه‌مندی‌ها حذف شد.'); }
  else { state.favorites.unshift(favoriteSnapshot(item)); toast('به علاقه‌مندی‌ها افزوده شد.'); }
  saveFavorites();
  if (state.tab === 'favorites') renderFavorites(); else if (state.tab === 'albums') paintFolder();
}

function renderFavorites() {
  stopHeroTimer();
  const items = state.favorites;
  $('view').innerHTML = `<section class="section"><div class="section-title"><h2>علاقه‌مندی‌ها</h2><span class="pill">${items.length}</span></div>${items.length?`<div class="album-grid">${items.map(itemCardHtml).join('')}</div>`:'<div class="empty">هنوز رسانه‌ای به علاقه‌مندی‌ها اضافه نشده است.</div>'}</section>`;
  $('view').querySelectorAll('[data-media]').forEach((button)=>button.addEventListener('click',()=>{
    const item=state.favorites.find((x)=>x.id===button.dataset.media); if(item) openViewer({...item,isImage:String(item.type).startsWith('image/'),isVideo:String(item.type).startsWith('video/')});
  }));
  $('view').querySelectorAll('[data-favorite]').forEach((button)=>button.addEventListener('click',(event)=>{
    event.stopPropagation(); const item=state.favorites.find((x)=>x.id===button.dataset.favorite); if(item) toggleFavorite(item);
  }));
}

function effectivePermission(name) {
  if (state.me?.is_admin === true) return true;
  const p = state.permissions || state.me?.permissions || {};
  return p[name] === true;
}

function openViewer(item) {
  const url = safeHttps(item.downloadUrl);
  const media = item.isVideo
    ? `<video src="${escapeHtml(url)}" controls playsinline></video>`
    : `<img src="${escapeHtml(url)}" alt="${escapeHtml(item.name)}">`;
  const shareAllowed = effectivePermission('allow_share');
  const downloadAllowed = item.isVideo ? effectivePermission('allow_video_download') : effectivePermission('allow_photo_download');
  openModal(item.name || 'رسانه', `<div class="viewer">${media}<div class="viewer-actions"><button id="viewerFav">${isFavorite(item.id)?'حذف از علاقه‌مندی':'افزودن به علاقه‌مندی'}</button>${shareAllowed?'<button id="viewerShare">اشتراک</button>':''}${downloadAllowed?'<button id="viewerDownload">دانلود</button>':''}</div>${(!shareAllowed||!downloadAllowed)?'<small class="muted">گزینه‌های اشتراک و دانلود مطابق مجوز حساب نمایش داده می‌شوند.</small>':''}</div>`);
  $('viewerFav')?.addEventListener('click',()=>{ toggleFavorite(item); closeModal(); });
  $('viewerShare')?.addEventListener('click', async()=>{
    try {
      if (navigator.share) await navigator.share({ title:item.name, url });
      else { await navigator.clipboard.writeText(url); toast('لینک کپی شد.'); }
    } catch { /* user cancel */ }
  });
  $('viewerDownload')?.addEventListener('click',()=>{
    const a=document.createElement('a'); a.href=url; a.download=item.name||'alefatemion-media'; a.rel='noopener'; a.click();
  });
}

function handleBanner(banner) {
  const type = String(banner?.destination_type || 'none');
  if (type === 'radio') return openRadio(banner.destination_id || '');
  if (type === 'album' && banner.destination_id) {
    state.folderStack=[]; state.folderHash=String(banner.destination_id); state.folderQuery=''; setTab('albums'); return;
  }
  if (type === 'external') {
    const url=safeHttps(banner.external_url); if(url) window.open(url,'_blank','noopener,noreferrer');
  }
}
