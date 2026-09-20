'use strict';

const CONFIG_URL='/remote/app-config.json';
const CATALOG_URL='/remote/media-catalog.json';
const LOGO_URL='/assets/logo_alfatemiun.webp';

const STORAGE={
  name:'alfatemiun_pwa_name_v1',
  favorites:'alfatemiun_pwa_favorites_v1',
  theme:'alfatemiun_pwa_theme_v1',
  currentTrack:'alfatemiun_pwa_track_v1',
  muted:'alfatemiun_pwa_muted_v1',
  firstLogin:'alfatemiun_pwa_first_login_v1',
  albumLayout:'alfatemiun_pwa_album_layout_v1',
  slideDuration:'alfatemiun_pwa_slide_duration_v1',
  slideEffect:'alfatemiun_pwa_slide_effect_v1',
  guideSeen:'alfatemiun_pwa_guide_seen_v1'
};

const state={
  config:null,
  catalog:null,
  currentPage:'home',
  folderHash:null,
  folderTrail:[],
  albumSortDesc:true,
  favorites:new Set(JSON.parse(localStorage.getItem(STORAGE.favorites)||'[]')),
  currentMediaId:null,
  currentTrackId:localStorage.getItem(STORAGE.currentTrack)||'',
  muted:localStorage.getItem(STORAGE.muted)==='1',
  radioCategory:'all',
  deferredInstallPrompt:null,
  carouselItems:[],
  carouselIndex:0,
  carouselTimer:null,
  carouselInteracting:false,
  carouselStarted:false,
  albumLayout:localStorage.getItem(STORAGE.albumLayout)||'standard',
  slideDuration:Number(localStorage.getItem(STORAGE.slideDuration)||5),
  slideEffect:localStorage.getItem(STORAGE.slideEffect)||'random',
  guideIndex:0,
  lastRemoteLoad:0
};

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

function norm(v){
  return String(v||'')
    .replace(/[يى]/g,'ی')
    .replace(/ك/g,'ک')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}
function fa(v){return String(v).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)])}
function esc(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function safeHttps(v){
  const value=String(v||'').trim();
  if(value.startsWith('/'))return value;
  try{
    const u=new URL(value);
    return u.protocol==='https:'?u.href:'';
  }catch(_){return''}
}
function toast(message){
  const el=$('#toast');
  el.textContent=message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>el.classList.remove('show'),2200);
}
const LOCAL_SYMBOLS={
  waving_hand:'👋',
  contact_support:'؟',
  radio:'◉',
  chevron_left:'‹',
  refresh:'↻',
  sort:'☷',
  search:'⌕',
  badge:'♙',
  palette:'◐',
  language:'◎',
  home:'⌂',
  photo_album:'▧',
  campaign:'◖',
  favorite:'♥',
  settings:'⚙',
  music_note:'♪',
  close:'×',
  volume_up:'🔊',
  volume_off:'🔇',
  image:'▧',
  play_circle:'▶'
};
function localSymbol(name){return LOCAL_SYMBOLS[name]||'•'}
function materialIcon(name,extra=''){
  return '<span class="material-symbols-rounded '+extra+'">'+esc(localSymbol(name))+'</span>';
}
function localizeStaticIcons(){
  $$('.material-symbols-rounded').forEach(el=>{
    const key=String(el.textContent||'').trim();
    if(LOCAL_SYMBOLS[key])el.textContent=LOCAL_SYMBOLS[key];
  });
}

function applyTheme(theme){
  const allowed=['system','light','dark'];
  const value=allowed.includes(theme)?theme:'system';
  document.documentElement.dataset.theme=value;
  localStorage.setItem(STORAGE.theme,value);
  $('#themeSelector button, #profileThemeSelector button').forEach(btn=>btn.classList.toggle('active',btn.dataset.theme===value));
}

function setName(value){
  const name=String(value||'').trim().replace(/\s+/g,' ').slice(0,60);
  if(!name)return false;
  localStorage.setItem(STORAGE.name,name);
  if(!localStorage.getItem(STORAGE.firstLogin))localStorage.setItem(STORAGE.firstLogin,String(Date.now()));
  const welcome=$('#welcomeName');
  const profile=$('#profileDisplayName');
  const input=$('#profileNameInput');
  if(welcome)welcome.textContent=name+' عزیز';
  if(profile)profile.textContent=name;
  if(input&&document.activeElement!==input)input.value=name;
  renderProfileAccount();
  return true;
}
function openName(edit=false){
  const dialog=$('#nameDialog');
  const input=$('#displayNameInput');
  input.value=edit?(localStorage.getItem(STORAGE.name)||''):'';
  $('#continueBtn').disabled=!input.value.trim();
  if(!dialog.open)dialog.showModal();
  setTimeout(()=>input.focus(),70);
}

function showPage(page){
  if(!['home','albums','announcements','favorites','settings'].includes(page))return;
  closeProfile();
  state.currentPage=page;
  $('.page').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
  $('.nav-item').forEach(btn=>{
    const target=btn.dataset.pageTarget;
    btn.classList.toggle('active',target===page||(page==='settings'&&btn.id==='profileNavBtn'));
  });
  if(page==='favorites')renderFavorites();
  if(page==='home')renderHomeSections();
  if(page==='settings')renderSettingsMeta();
  window.scrollTo({top:0,behavior:'smooth'});
}

function formatPersianDate(ms){
  const value=Number(ms);
  if(!Number.isFinite(value)||value<=0)return'—';
  try{
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  }catch(_){
    return new Date(value).toLocaleDateString('fa-IR');
  }
}

function renderProfileAccount(){
  const name=localStorage.getItem(STORAGE.name)||'دوست عزیز';
  const input=$('#profileNameInput');
  const first=$('#profileFirstLogin');
  if(input&&document.activeElement!==input)input.value=name;
  if(first)first.textContent=formatPersianDate(localStorage.getItem(STORAGE.firstLogin));
}

function openProfile(){
  const drawer=$('#profileDrawer');
  const backdrop=$('#profileBackdrop');
  if(!drawer||!backdrop)return;
  renderProfileAccount();
  $('#profileDisplayName').textContent=localStorage.getItem(STORAGE.name)||'دوست عزیز';
  backdrop.hidden=false;
  requestAnimationFrame(()=>drawer.classList.add('open'));
  drawer.setAttribute('aria-hidden','false');
  $('#profileNavBtn')?.classList.add('active');
}

function closeProfile(){
  const drawer=$('#profileDrawer');
  const backdrop=$('#profileBackdrop');
  if(!drawer||!backdrop)return;
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden','true');
  setTimeout(()=>{if(!drawer.classList.contains('open'))backdrop.hidden=true},240);
  if(state.currentPage!=='settings')$('#profileNavBtn')?.classList.remove('active');
}

function applyAlbumLayout(value){
  const allowed=['large','standard','compact'];
  const layout=allowed.includes(value)?value:'standard';
  state.albumLayout=layout;
  localStorage.setItem(STORAGE.albumLayout,layout);
  const grid=$('#albumGrid');
  if(grid)grid.dataset.layout=layout;
  $('#albumLayoutSelector button').forEach(btn=>btn.classList.toggle('active',btn.dataset.albumLayout===layout));
}

function applyViewerPreferences(){
  const duration=Number(localStorage.getItem(STORAGE.slideDuration)||state.slideDuration||5);
  state.slideDuration=[3,5,7,10].includes(duration)?duration:5;
  state.slideEffect=localStorage.getItem(STORAGE.slideEffect)||state.slideEffect||'random';
  const select=$('#slideDurationSelect');
  if(select)select.value=String(state.slideDuration);
  $('#slideEffectSelector button').forEach(btn=>btn.classList.toggle('active',btn.dataset.slideEffect===state.slideEffect));
}

async function clearPwaCache(){
  const button=$('#clearCacheBtn');
  if(button){button.disabled=true;button.textContent='در حال پاک‌کردن…'}
  try{
    if('caches'in window){
      const keys=await caches.keys();
      await Promise.all(keys.map(key=>caches.delete(key)));
    }
    toast('حافظه موقت پاک شد.');
  }catch(error){
    console.error(error);
    toast('پاک‌کردن حافظه موقت انجام نشد.');
  }finally{
    if(button){button.disabled=false;button.textContent='حذف حافظه موقت'}
  }
}

async function checkPwaUpdate(){
  const button=$('#checkUpdateBtn');
  if(button){button.disabled=true;button.textContent='در حال بررسی…'}
  try{
    const reg=await navigator.serviceWorker?.getRegistration();
    if(reg)await reg.update();
    await loadRemote();
    toast('آخرین نسخه و تنظیمات بررسی شد.');
  }catch(error){
    console.error(error);
    toast('بررسی بروزرسانی انجام نشد.');
  }finally{
    if(button){button.disabled=false;button.textContent='بررسی بروزرسانی'}
  }
}

async function sharePwa(){
  const url=location.hostname==='app.alefatemion.ir'?'https://app.alefatemion.ir/':location.origin+'/pwa/';
  const data={title:'آل فاطمیون',text:'نسخه وب آل فاطمیون',url};
  try{
    if(navigator.share)await navigator.share(data);
    else{
      await navigator.clipboard.writeText(url);
      toast('پیوند نسخه وب کپی شد.');
    }
  }catch(error){
    if(error?.name!=='AbortError')toast('اشتراک‌گذاری انجام نشد.');
  }
}

function officialSiteUrl(){
  return location.hostname==='app.alefatemion.ir'?'https://alefatemion.ir/':location.origin+'/';
}

function renderSettingsMeta(){
  const version=$('#pwaVersionText');
  const remote=$('#remoteRevisionText');
  if(version)version.textContent='PWA Test 0.5.0 • استقرار روی Liara';
  if(remote){
    const cr=state.config?.revision??'—';
    const mr=state.catalog?.revision??'—';
    remote.textContent='تنظیمات Remote: '+fa(cr)+' • شناسنامه رسانه: '+fa(mr);
  }
  applyAlbumLayout(localStorage.getItem(STORAGE.albumLayout)||state.albumLayout);
  applyViewerPreferences();
}

const GUIDE_STEPS=[
  ['خانه','بنرهای خانه، رادیو و تازه‌ترین محتوای مجموعه از این صفحه در دسترس است.'],
  ['آلبوم‌ها','برای مرور آرشیو، جستجو، مرتب‌سازی و تازه‌سازی از بخش آلبوم‌ها استفاده کنید.'],
  ['اطلاعیه‌ها','اخبار و اطلاعیه‌های مجموعه در این بخش نمایش داده می‌شوند.'],
  ['برگزیده‌ها','رسانه‌هایی که با علامت قلب انتخاب می‌کنید در برگزیده‌ها نگهداری می‌شوند.'],
  ['پروفایل','حالت ظاهر، اطلاعات کاربری، پیام‌ها، رادیو، پشتیبانی و تنظیمات از منوی پروفایل در دسترس است.'],
  ['تنظیمات','حافظه موقت، بروزرسانی، اشتراک‌گذاری، راهنما و تنظیمات آلبوم در این صفحه قرار دارند.']
];

function renderGuide(){
  const step=GUIDE_STEPS[state.guideIndex]||GUIDE_STEPS[0];
  $('#guideTitle').textContent=step[0];
  $('#guideText').textContent=step[1];
  const progress=$('#guideProgress');
  progress.innerHTML=GUIDE_STEPS.map((_,i)=>'<i class="'+(i===state.guideIndex?'active':'')+'"></i>').join('');
  $('#guideNextBtn').textContent=state.guideIndex===GUIDE_STEPS.length-1?'پایان':'بعدی';
}

function openGuide(){
  state.guideIndex=0;
  renderGuide();
  const dialog=$('#guideDialog');
  if(dialog&&!dialog.open)dialog.showModal();
}

function nextGuide(){
  if(state.guideIndex<GUIDE_STEPS.length-1){
    state.guideIndex++;
    renderGuide();
  }else{
    localStorage.setItem(STORAGE.guideSeen,'1');
    $('#guideDialog')?.close();
  }
}

function visibleAnnouncements(){
  const now=Date.now();
  return (state.config?.announcements?.items||[])
    .filter(item=>item&&item.published&&(!item.expires_at_millis||item.expires_at_millis>now))
    .sort((a,b)=>(Number(b.pinned)-Number(a.pinned))||((b.published_at_millis||0)-(a.published_at_millis||0)));
}

function announcementCard(item){
  const btn=document.createElement('button');
  btn.type='button';
  btn.className='announcement-card';
  const category=item.category==='radio_update'?'رادیو':item.category==='album_update'?'آلبوم':'اطلاعیه';
  const date=item.published_at_millis?new Date(item.published_at_millis).toLocaleDateString('fa-IR'):'';
  btn.innerHTML=
    '<span class="tag">'+esc(category)+(item.pinned?' • سنجاق‌شده':'')+'</span>'+
    '<strong>'+esc(item.title||'اطلاعیه')+'</strong>'+
    '<p>'+esc(item.summary||'')+'</p>'+
    '<time>'+esc(date)+'</time>';
  btn.onclick=()=>{
    $('#detailAnnouncementTitle').textContent=item.title||'اطلاعیه';
    $('#detailAnnouncementBody').textContent=item.body||item.summary||'';
    $('#announcementDialog').showModal();
  };
  return btn;
}

function renderAnnouncements(){
  const items=visibleAnnouncements();
  const main=$('#announcementList');
  const home=$('#homeAnnouncements');
  main.replaceChildren();
  home.replaceChildren();

  if(!items.length){
    main.innerHTML='<div class="empty-state">اطلاعیه‌ای برای نمایش وجود ندارد.</div>';
    home.innerHTML='<div class="empty-state">خبر تازه‌ای وجود ندارد.</div>';
    return;
  }
  items.forEach(item=>main.append(announcementCard(item)));
  items.slice(0,3).forEach(item=>home.append(announcementCard(item)));
}

function visibleBanners(){
  const now=Date.now();
  return (state.config?.home?.banners||[])
    .filter(b=>b&&b.enabled&&(!b.starts_at_millis||b.starts_at_millis<=now)&&(!b.expires_at_millis||b.expires_at_millis>now))
    .sort((a,b)=>(a.display_order||0)-(b.display_order||0));
}

function renderCarousel(){
  const host=$('#heroCarousel');
  const pagination=$('#heroPagination');
  if(!host||!pagination)return;

  state.carouselItems=[{id:'local-alfatemiun',local:true},...visibleBanners().map(b=>({id:'remote-'+b.id,banner:b}))];
  host.replaceChildren();
  pagination.replaceChildren();

  state.carouselItems.forEach((item,index)=>{
    const wrap=document.createElement('div');
    wrap.className='hero-slide-wrap';
    wrap.dataset.index=String(index);

    if(item.local){
      const slide=document.createElement('div');
      slide.className='hero-slide local';
      slide.innerHTML=
        '<img class="hero-local-logo" src="'+LOGO_URL+'" alt="لوگوی آل فاطمیون">'+
        '<div class="hero-local-copy">'+
          '<h1>آل فاطمیون</h1>'+
          '<p>روایت تصویری فعالیت‌های مذهبی و جهادی</p>'+
          '<small>با محوریت خدمت در مسیر اربعین حسینی</small>'+
        '</div>';
      wrap.append(slide);
    }else{
      const banner=item.banner;
      const slide=document.createElement('button');
      slide.type='button';
      slide.className='hero-slide remote';
      const image=safeHttps(banner.image_url);
      const isLocalFallback=image==='/assets/home-banner-local.svg';
      if(isLocalFallback){
        slide.classList.add('local-fallback');
        slide.innerHTML=
          '<div class="fallback-banner-logo"><img src="'+LOGO_URL+'" alt=""></div>'+
          '<div class="fallback-banner-copy">'+
            '<strong>آل فاطمیون</strong>'+
            '<span>موکب مجازی آل فاطمیون</span>'+
            '<small>روایت تصویری فعالیت‌های مذهبی و جهادی</small>'+
          '</div>';
      }else if(image){
        const img=document.createElement('img');
        img.src=image;
        img.alt=banner.title||'بنر آل فاطمیون';
        img.loading=index===0?'eager':'lazy';
        slide.append(img);
      }
      if(!isLocalFallback&&(banner.title||banner.description)){
        const overlay=document.createElement('span');
        overlay.className='hero-overlay';
        overlay.innerHTML=(banner.title?'<strong>'+esc(banner.title)+'</strong>':'')+(banner.description?'<small>'+esc(banner.description)+'</small>':'');
        slide.append(overlay);
      }
      slide.onclick=()=>handleBanner(banner);
      wrap.append(slide);
    }
    host.append(wrap);
  });

  const count=document.createElement('span');
  count.className='hero-page-count';
  count.id='heroPageCount';
  pagination.append(count);

  state.carouselItems.forEach((_,index)=>{
    const dot=document.createElement('button');
    dot.type='button';
    dot.className='hero-dot';
    dot.setAttribute('aria-label','بنر '+fa(index+1));
    dot.onclick=()=>goCarousel(index,true);
    pagination.append(dot);
  });

  if(!state.carouselStarted){
    state.carouselIndex=state.carouselItems.length>1?Math.floor(Math.random()*state.carouselItems.length):0;
    state.carouselStarted=true;
  }else{
    state.carouselIndex=Math.min(state.carouselIndex,state.carouselItems.length-1);
  }

  requestAnimationFrame(()=>{
    goCarousel(state.carouselIndex,false);
    updateCarouselUI();
  });
  restartCarouselTimer();
}

function handleBanner(banner){
  const type=String(banner.destination_type||'none').toLowerCase();
  if(type==='external'){
    const url=safeHttps(banner.external_url);
    if(url)window.open(url,'_blank','noopener');
    return;
  }
  if(type==='album'&&banner.destination_id){
    state.folderHash=banner.destination_id;
    state.folderTrail=[];
    showPage('albums');
    renderAlbums();
    return;
  }
  if(type==='announcements'){showPage('announcements');return}
  if(type==='favorites'){showPage('favorites');return}
}

function goCarousel(index,animated=true){
  const host=$('#heroCarousel');
  const slide=host?.children[index];
  if(!host||!slide)return;
  state.carouselIndex=index;

  /*
   * فقط خود نوار افقی بنر حرکت می‌کند.
   * scrollIntoView می‌توانست همراه با جابه‌جایی افقی،
   * اسکرول عمودی صفحه را هم تغییر دهد.
   */
  host.scrollTo({
    left: slide.offsetLeft,
    behavior: animated?'smooth':'auto'
  });

  updateCarouselUI();
}
function updateCarouselUI(){
  const total=state.carouselItems.length;
  const count=$('#heroPageCount');
  if(count)count.textContent=total?fa(state.carouselIndex+1)+' از '+fa(total):'';
  $$('#heroPagination .hero-dot').forEach((dot,index)=>dot.classList.toggle('active',index===state.carouselIndex));
}
function restartCarouselTimer(){
  clearInterval(state.carouselTimer);
  if(state.carouselItems.length<=1)return;
  state.carouselTimer=setInterval(()=>{
    if(document.hidden||state.carouselInteracting||state.currentPage!=='home')return;
    const next=(state.carouselIndex+1)%state.carouselItems.length;
    goCarousel(next,true);
  },6000);
}
function wireCarousel(){
  const host=$('#heroCarousel');
  let raf=0;
  host.addEventListener('scroll',()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      const width=host.clientWidth||1;
      const index=Math.max(0,Math.min(state.carouselItems.length-1,Math.round(host.scrollLeft/width)));
      if(index!==state.carouselIndex){
        state.carouselIndex=index;
        updateCarouselUI();
      }
    });
  },{passive:true});
  ['pointerdown','touchstart'].forEach(event=>host.addEventListener(event,()=>{state.carouselInteracting=true},{passive:true}));
  ['pointerup','pointercancel','touchend','touchcancel'].forEach(event=>host.addEventListener(event,()=>{
    state.carouselInteracting=false;
    restartCarouselTimer();
  },{passive:true}));
}

function folderMap(){return new Map((state.catalog?.folders||[]).map(f=>[f.folder_hash,f]))}
function children(hash){return (state.catalog?.folders||[]).filter(f=>(f.parent_folder_hash||'')===(hash||''))}
function directMedia(hash){return (state.catalog?.media||[]).filter(m=>m.folder_hash===hash&&!m.hidden)}
function recursiveCount(hash){
  let count=directMedia(hash).length;
  for(const folder of children(hash))count+=recursiveCount(folder.folder_hash);
  return count;
}
function folderName(folder){
  return String(folder?.display_name||folder?.real_name||'آلبوم بدون نام').trim()||'آلبوم بدون نام';
}
function sortFolders(folders){
  return [...folders].sort((a,b)=>{
    const an=folderName(a),bn=folderName(b);
    return state.albumSortDesc?bn.localeCompare(an,'fa',{numeric:true}):an.localeCompare(bn,'fa',{numeric:true});
  });
}
function renderBreadcrumb(){
  const box=$('#albumBreadcrumb');
  box.replaceChildren();
  const root=document.createElement('button');
  root.textContent='همه آلبوم‌ها';
  root.onclick=()=>{
    state.folderHash=state.config?.source?.root_hash||'';
    state.folderTrail=[];
    renderAlbums();
  };
  box.append(root);

  state.folderTrail.forEach((part,index)=>{
    const btn=document.createElement('button');
    btn.textContent='← '+part.name;
    btn.onclick=()=>{
      state.folderHash=part.hash;
      state.folderTrail=state.folderTrail.slice(0,index+1);
      renderAlbums();
    };
    box.append(btn);
  });
}
function searchResults(query){
  const q=norm(query);
  if(!q)return null;
  return{
    folders:(state.catalog?.folders||[]).filter(f=>norm((f.real_name||'')+' '+(f.display_name||'')).includes(q)),
    media:(state.catalog?.media||[]).filter(m=>!m.hidden&&norm(
      (m.display_name||'')+' '+(m.folder_path||'')+' '+(m.event||'')+' '+(m.year||'')+' '+(m.location||'')+' '+(m.tags||[]).join(' ')+' '+(m.sequence_number||'')
    ).includes(q))
  };
}

function makeFolder(folder,fromSearch=false){
  const btn=document.createElement('button');
  btn.type='button';
  btn.className='album-card';
  btn.innerHTML=
    '<img class="album-watermark" src="'+LOGO_URL+'" alt="">'+
    '<div class="album-info"><strong>'+esc(folderName(folder))+'</strong><small>'+fa(recursiveCount(folder.folder_hash))+' رسانه</small></div>';
  btn.onclick=()=>{
    state.folderHash=folder.folder_hash;
    const map=folderMap(),trail=[];
    let current=folder,guard=0;
    while(current&&guard++<64&&current.folder_hash!==state.config?.source?.root_hash){
      trail.unshift({hash:current.folder_hash,name:folderName(current)});
      current=map.get(current.parent_folder_hash);
    }
    state.folderTrail=trail;
    if(fromSearch)$('#albumSearch').value='';
    renderAlbums();
  };
  return btn;
}

function mediaLabel(media){
  const type=media.media_type==='video'?'فیلم':'عکس';
  if(media.display_name)return media.display_name;
  const subject=[media.event,media.year,media.location].filter(Boolean).join(' – ')||(media.folder_path||'').split('←').pop()?.trim()||'';
  const numbered=media.sequence_number>0?type+' شماره '+fa(media.sequence_number):type;
  return subject?subject+' – '+numbered:numbered;
}

function mediaIconName(media){return media.media_type==='video'?'play_circle':'image'}
function makeMedia(media){
  const btn=document.createElement('button');
  btn.type='button';
  btn.className='media-card';
  btn.innerHTML=
    '<div class="media-icon">'+materialIcon(mediaIconName(media))+'</div>'+
    '<strong>'+esc(mediaLabel(media))+'</strong>'+
    '<small>'+esc(media.folder_path||'')+'</small>';
  btn.onclick=()=>openMedia(media.stable_id);
  return btn;
}
function makeHomeAlbum(folder){
  const btn=document.createElement('button');
  btn.type='button';
  btn.className='home-album-card';
  btn.innerHTML=
    '<div class="home-album-cover">'+materialIcon('photo_album')+'<img class="home-album-watermark" src="'+LOGO_URL+'" alt=""></div>'+
    '<strong>'+esc(folderName(folder))+'</strong>';
  btn.onclick=()=>{
    state.folderHash=folder.folder_hash;
    const map=folderMap(),trail=[];
    let current=folder,guard=0;
    while(current&&guard++<64&&current.folder_hash!==state.config?.source?.root_hash){
      trail.unshift({hash:current.folder_hash,name:folderName(current)});
      current=map.get(current.parent_folder_hash);
    }
    state.folderTrail=trail;
    showPage('albums');
    renderAlbums();
  };
  return btn;
}
function makeHomeMedia(media){
  const btn=document.createElement('button');
  btn.type='button';
  btn.className='home-media-card';
  btn.innerHTML=
    '<span class="media-center">'+materialIcon(mediaIconName(media))+'</span>'+
    '<span class="media-caption">'+esc(mediaLabel(media))+'</span>';
  btn.onclick=()=>openMedia(media.stable_id);
  return btn;
}
function recentMedia(type,limit=10){
  return (state.catalog?.media||[])
    .filter(m=>!m.hidden&&m.media_type===type)
    .sort((a,b)=>{
      const aa=Number(a.stable_id),bb=Number(b.stable_id);
      return (Number.isFinite(bb)?bb:0)-(Number.isFinite(aa)?aa:0);
    })
    .slice(0,limit);
}
function renderHomeSections(){
  if(!state.catalog||!state.config)return;
  const root=state.config?.source?.root_hash||'';
  const albums=$('#homeAlbums'),images=$('#homeImages'),videos=$('#homeVideos'),favorites=$('#homeFavorites');
  albums.replaceChildren();
  images.replaceChildren();
  videos.replaceChildren();
  favorites.replaceChildren();

  sortFolders(children(root)).slice(0,8).forEach(folder=>albums.append(makeHomeAlbum(folder)));
  recentMedia('image',10).forEach(media=>images.append(makeHomeMedia(media)));
  recentMedia('video',10).forEach(media=>videos.append(makeHomeMedia(media)));

  const favoriteItems=(state.catalog?.media||[]).filter(m=>!m.hidden&&state.favorites.has(m.stable_id)).slice(0,8);
  if(favoriteItems.length){
    favoriteItems.forEach(media=>favorites.append(makeHomeMedia(media)));
  }else{
    favorites.innerHTML='<div class="empty-state">هنوز موردی به برگزیده‌ها اضافه نشده است.</div>';
  }
}

function renderAlbums(){
  if(!state.catalog||!state.config)return;
  const grid=$('#albumGrid');
  applyAlbumLayout(localStorage.getItem(STORAGE.albumLayout)||state.albumLayout);
  grid.replaceChildren();
  renderBreadcrumb();

  const searched=searchResults($('#albumSearch').value.trim());
  if(searched){
    const all=[
      ...searched.folders.map(value=>({kind:'folder',value})),
      ...searched.media.slice(0,100).map(value=>({kind:'media',value}))
    ];
    if(!all.length){
      grid.innerHTML='<div class="empty-state" style="grid-column:1/-1">نتیجه‌ای پیدا نشد.</div>';
      return;
    }
    all.forEach(item=>grid.append(item.kind==='folder'?makeFolder(item.value,true):makeMedia(item.value)));
    return;
  }

  const folders=sortFolders(children(state.folderHash));
  const media=directMedia(state.folderHash);
  if(!folders.length&&!media.length){
    grid.innerHTML='<div class="empty-state" style="grid-column:1/-1">این پوشه محتوایی برای نمایش ندارد.</div>';
    return;
  }
  folders.forEach(folder=>grid.append(makeFolder(folder)));
  media.forEach(item=>grid.append(makeMedia(item)));
}

function openMedia(id){
  const media=(state.catalog?.media||[]).find(item=>item.stable_id===id);
  if(!media)return;
  state.currentMediaId=id;
  $('#mediaTitle').textContent=mediaLabel(media);
  $('#mediaTypeIcon').textContent=localSymbol(media.media_type==='video'?'play_circle':'image');
  updateFavoriteBtn();
  $('#mediaDialog').showModal();
}
function saveFavorites(){localStorage.setItem(STORAGE.favorites,JSON.stringify([...state.favorites]))}
function toggleFavorite(){
  if(!state.currentMediaId)return;
  if(state.favorites.has(state.currentMediaId))state.favorites.delete(state.currentMediaId);
  else state.favorites.add(state.currentMediaId);
  saveFavorites();
  updateFavoriteBtn();
  renderFavorites();
  renderHomeSections();
  toast(state.favorites.has(state.currentMediaId)?'به برگزیده‌ها اضافه شد':'از برگزیده‌ها حذف شد');
}
function updateFavoriteBtn(){
  $('#favoriteToggle').textContent=state.favorites.has(state.currentMediaId)?'حذف از برگزیده‌ها':'افزودن به برگزیده‌ها';
}
function renderFavorites(){
  const grid=$('#favoriteGrid');
  grid.replaceChildren();
  const items=(state.catalog?.media||[]).filter(m=>state.favorites.has(m.stable_id)&&!m.hidden);
  if(!items.length){
    grid.innerHTML='<div class="empty-state" style="grid-column:1/-1">هنوز موردی به برگزیده‌ها اضافه نشده است.</div>';
    return;
  }
  items.forEach(media=>grid.append(makeMedia(media)));
}

function contactHref(method){
  const value=String(method.value||'').trim();
  const type=String(method.type||'').toLowerCase();
  if(!value)return'';
  if(type==='email')return'mailto:'+value;
  if(type==='phone')return'tel:'+value.replace(/[^+0-9]/g,'');
  if(type==='sms')return'sms:'+value.replace(/[^+0-9]/g,'');
  if(type==='telegram')return safeHttps(value)||'https://t.me/'+value.replace(/^@/,'');
  if(type==='eitaa')return safeHttps(value)||'https://eitaa.com/'+value.replace(/^@/,'');
  if(type==='whatsapp')return safeHttps(value)||'https://wa.me/'+value.replace(/\D/g,'');
  if(type==='web')return safeHttps(value);
  return safeHttps(value);
}
function renderSupport(){
  const list=$('#supportList');
  list.replaceChildren();
  const methods=state.config?.management_contact?.enabled
    ?(state.config.management_contact.methods||[]).filter(method=>method.enabled)
    :[];
  if(!methods.length){
    list.innerHTML='<div class="empty-state">راه ارتباطی فعالی ثبت نشده است.</div>';
    return;
  }
  methods.forEach(method=>{
    const href=contactHref(method);
    if(!href)return;
    const a=document.createElement('a');
    a.className='support-item';
    a.href=href;
    if(href.startsWith('https://')){a.target='_blank';a.rel='noopener'}
    a.innerHTML=
      '<div><strong>'+esc(method.label||'ارتباط با پشتیبانی')+'</strong>'+
      '<small>'+esc(String(method.value||'').replace(/^https?:\/\//,''))+'</small></div>'+
      materialIcon('chevron_left');
    list.append(a);
  });
}
function quickSupport(){
  const methods=state.config?.management_contact?.methods||[];
  const method=methods.find(m=>m.enabled&&m.quick_access)||methods.find(m=>m.enabled);
  const href=method?contactHref(method):'';
  if(href){
    if(href.startsWith('https://'))window.open(href,'_blank','noopener');
    else location.href=href;
  }else{
    showPage('settings');
    toast('راه ارتباطی در تنظیمات موجود است');
  }
}

function tracks(){return (state.config?.nava?.tracks||[]).filter(track=>track.enabled)}
function currentTrack(){return tracks().find(track=>track.id===state.currentTrackId)||tracks()[0]||null}
function chooseTrack(track){
  state.currentTrackId=track.id;
  localStorage.setItem(STORAGE.currentTrack,track.id);
  updateNow();
  renderRadio();
  toast('نوا انتخاب شد؛ پخش مستقیم وب در مرحله بعد تکمیل می‌شود');
}
function updateNow(){
  const track=currentTrack();
  if(track&&!state.currentTrackId){
    state.currentTrackId=track.id;
    localStorage.setItem(STORAGE.currentTrack,track.id);
  }
  const title=track?.title||'رادیو آماده پخش است';
  const performer=track?.performer||'انتخاب و مدیریت نواها';
  $('#nowPlayingHome').textContent=track?title+' - '+performer:title;
  $('#radioNowTitle').textContent=title;
  $('#radioNowPerformer').textContent=performer;
  $('#radioMuteBtn').innerHTML=materialIcon(state.muted?'volume_off':'volume_up');
}
function renderRadio(){
  const list=$('#radioList');
  list.replaceChildren();
  const q=norm($('#radioSearch').value);
  let items=tracks().filter(track=>state.radioCategory==='all'||track.category===state.radioCategory);
  if(q)items=items.filter(track=>norm((track.title||'')+' '+(track.performer||'')).includes(q));

  if(!items.length){
    list.innerHTML='<div class="empty-state">نوایی پیدا نشد.</div>';
    return;
  }

  items.forEach(track=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='track-row'+(track.id===state.currentTrackId?' active':'');
    btn.innerHTML=
      '<span class="note-icon material-symbols-rounded">'+esc(localSymbol('music_note'))+'</span>'+
      '<span class="track-copy"><strong>'+esc(track.title)+'</strong><small>'+esc(track.performer||'بدون نام خواننده')+'</small></span>'+
      materialIcon('chevron_left');
    btn.onclick=()=>chooseTrack(track);
    list.append(btn);
  });
}

async function loadRemote(){
  try{
    const [configResponse,catalogResponse]=await Promise.all([
      fetch(CONFIG_URL,{cache:'no-store'}),
      fetch(CATALOG_URL,{cache:'no-store'})
    ]);
    if(!configResponse.ok||!catalogResponse.ok)throw Error('remote');

    state.config=await configResponse.json();
    state.catalog=await catalogResponse.json();
    state.folderHash=state.folderHash||state.config?.source?.root_hash||'';

    renderCarousel();
    renderAnnouncements();
    renderAlbums();
    renderFavorites();
    renderHomeSections();
    renderSupport();
    renderRadio();
    updateNow();
    state.lastRemoteLoad=Date.now();
    renderSettingsMeta();
  }catch(error){
    console.error(error);
    $('#albumGrid').innerHTML='<div class="empty-state" style="grid-column:1/-1">دریافت اطلاعات Remote ناموفق بود. اتصال اینترنت را بررسی کنید.</div>';
    $('#announcementList').innerHTML='<div class="empty-state">دریافت اطلاعیه‌ها ناموفق بود.</div>';
    $('#homeAnnouncements').innerHTML='<div class="empty-state">دریافت خبرهای تازه ناموفق بود.</div>';
    toast('اتصال به Remote برقرار نشد');
  }
}

function wire(){
  wireCarousel();

  $('#displayNameInput').oninput=event=>{
    $('#continueBtn').disabled=!event.target.value.trim();
  };
  $('#nameForm').onsubmit=event=>{
    event.preventDefault();
    if(setName($('#displayNameInput').value))$('#nameDialog').close();
  };
  $('#favoriteToggle').onclick=toggleFavorite;
  $('#quickSupportBtn').onclick=quickSupport;

  const openRadio=()=>{
    renderRadio();
    $('#radioDialog').showModal();
  };
  $('#radioFab').onclick=openRadio;
  $('#openRadioHero').onclick=openRadio;

  $('#radioSearch').oninput=renderRadio;
  $('#radioMuteBtn').onclick=()=>{
    state.muted=!state.muted;
    localStorage.setItem(STORAGE.muted,state.muted?'1':'0');
    updateNow();
    toast(state.muted?'رادیو بی‌صدا شد':'رادیو فعال شد');
  };

  $('#albumSearch').oninput=renderAlbums;
  $('#albumSort').onclick=()=>{
    state.albumSortDesc=!state.albumSortDesc;
    renderAlbums();
  };
  $('#albumRefresh').onclick=()=>{
    toast('در حال تازه‌سازی...');
    loadRemote();
  };

  const themeHandler=event=>{
    const btn=event.target.closest('button[data-theme]');
    if(btn)applyTheme(btn.dataset.theme);
  };
  $('#profileThemeSelector').onclick=themeHandler;

  $('#radioCategorySelector').onclick=event=>{
    const btn=event.target.closest('button[data-radio-category]');
    if(!btn)return;
    state.radioCategory=btn.dataset.radioCategory;
    $$('#radioCategorySelector button').forEach(item=>item.classList.toggle('active',item===btn));
    renderRadio();
  };

  $('#bottomNav').onclick=event=>{
    const profile=event.target.closest('[data-open-profile]');
    if(profile){openProfile();return}
    const btn=event.target.closest('[data-page-target]');
    if(btn)showPage(btn.dataset.pageTarget);
  };
  $$('[data-go]').forEach(btn=>btn.onclick=()=>showPage(btn.dataset.go));
  $$('[data-close-dialog]').forEach(btn=>{
    btn.onclick=()=>document.getElementById(btn.dataset.closeDialog)?.close();
  });

  $('#profileBackdrop').onclick=closeProfile;
  $('#profileAvatarBtn').onclick=()=>{
    const panel=$('#profileAccountPanel');
    panel.hidden=!panel.hidden;
  };
  $('#profileSaveNameBtn').onclick=()=>{
    const value=$('#profileNameInput').value;
    if(setName(value))toast('نام نمایشی ذخیره شد.');
  };
  $('#profileDrawer').onclick=event=>{
    const row=event.target.closest('[data-profile-action]');
    if(!row)return;
    const action=row.dataset.profileAction;
    if(action==='account'){
      const panel=$('#profileAccountPanel');
      panel.hidden=!panel.hidden;
      renderProfileAccount();
      return;
    }
    if(action==='messages'){closeProfile();showPage('announcements');return}
    if(action==='radio'){closeProfile();openRadio();return}
    if(action==='support'){
      closeProfile();
      showPage('settings');
      setTimeout(()=>$('#supportSettings')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
      return;
    }
    if(action==='settings'){closeProfile();showPage('settings');return}
    if(action==='logout'){
      closeProfile();
      localStorage.removeItem(STORAGE.name);
      openName(false);
      toast('از حساب محلی نسخه وب خارج شدید.');
    }
  };

  $('#settingsBackBtn').onclick=()=>showPage('home');
  $('#clearCacheBtn').onclick=clearPwaCache;
  $('#checkUpdateBtn').onclick=checkPwaUpdate;
  $('#sharePwaBtn').onclick=sharePwa;
  $('#showGuideBtn').onclick=openGuide;
  $('#aboutBtn').onclick=()=>{location.href=officialSiteUrl()};

  $('#albumLayoutSelector').onclick=event=>{
    const btn=event.target.closest('[data-album-layout]');
    if(btn)applyAlbumLayout(btn.dataset.albumLayout);
  };
  $('#slideDurationSelect').onchange=event=>{
    state.slideDuration=Number(event.target.value)||5;
    localStorage.setItem(STORAGE.slideDuration,String(state.slideDuration));
    toast('مدت نمایش ذخیره شد.');
  };
  $('#slideEffectSelector').onclick=event=>{
    const btn=event.target.closest('[data-slide-effect]');
    if(!btn)return;
    state.slideEffect=btn.dataset.slideEffect;
    localStorage.setItem(STORAGE.slideEffect,state.slideEffect);
    applyViewerPreferences();
    toast('افکت اسلایدشو ذخیره شد.');
  };

  $('#guideCloseBtn').onclick=()=>$('#guideDialog').close();
  $('#guideSkipBtn').onclick=()=>{
    localStorage.setItem(STORAGE.guideSeen,'1');
    $('#guideDialog').close();
  };
  $('#guideNextBtn').onclick=nextGuide;

  $('#installBtn').onclick=async()=>{
    if(!state.deferredInstallPrompt)return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt=null;
    $('#installBtn').hidden=true;
  };
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    state.deferredInstallPrompt=event;
    $('#installBtn').hidden=false;
  });

  let lastCompact=false;
  window.addEventListener('scroll',()=>{
    const compact=window.scrollY>92;
    if(compact!==lastCompact){
      $('#welcomeCard').classList.toggle('compact',compact);
      lastCompact=compact;
    }
  },{passive:true});

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){
      restartCarouselTimer();
      if(Date.now()-state.lastRemoteLoad>120000)loadRemote();
    }
  });
  setInterval(()=>{
    if(!document.hidden&&Date.now()-state.lastRemoteLoad>300000)loadRemote();
  },60000);
}

async function init(){
  localizeStaticIcons();
  applyTheme(localStorage.getItem(STORAGE.theme)||'system');
  if(!localStorage.getItem(STORAGE.firstLogin))localStorage.setItem(STORAGE.firstLogin,String(Date.now()));
  applyAlbumLayout(localStorage.getItem(STORAGE.albumLayout)||'standard');
  applyViewerPreferences();
  wire();

  const savedName=localStorage.getItem(STORAGE.name);
  if(savedName)setName(savedName);
  else openName(false);

  await loadRemote();
  renderSettingsMeta();

  if('serviceWorker'in navigator){
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }

  if(localStorage.getItem(STORAGE.guideSeen)!=='1'&&savedName){
    setTimeout(openGuide,650);
  }
}

init();