const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.STEP1_RESULTS||path.join(root,'step5-results');
fs.mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['pwa-server-test2.js'],{cwd:root,env:{...process.env,PORT:'3088',PWA_IDENTITY_BASE_URL:'https://identity-test.alefatemion.ir'},stdio:['ignore','pipe','pipe']});
(async()=>{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
 const health=await (await fetch('http://127.0.0.1:3088/api/health')).json();
 assert.equal(health.identity,'https://identity-test.alefatemion.ir');
 const browser=await chromium.launch({headless:true});
 const checks=[],errors=[];
 try{
  const context=await browser.newContext({viewport:{width:365,height:681},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='fixture.invalid')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="188"><rect width="400" height="188" fill="#317653"/></svg>'});
   if(u.hostname!=='127.0.0.1')return route.abort();
   if(u.pathname==='/brand-logo.webp')return route.fulfill({contentType:'image/webp',body:fs.readFileSync(root+'/docs/assets/logo_alfatemiun.webp')});
   if(u.pathname==='/api/media/catalog')return route.fulfill({json:{schema_version:1,revision:1,folders:[],media:[]}});
   if(u.pathname.startsWith('/api/')){
    const json=u.pathname==='/api/account/me'?{user_id:'fixture',display_name:'کاربر آزمایشی',birth_jalali:{year:1370,month:1,day:1}}:u.pathname==='/api/config'?{source:{root_hash:'fixture'},home:{},announcements:{items:Array.from({length:20},(_,i)=>({id:'notice-'+i,title:'خبر آزمایشی',body:'متن آزمایشی',published:true}))},nava:{enabled:true,tracks:[]}}:{items:[],messages:[],installations:[]};
    return route.fulfill({json});
   }
   return route.continue();
  });
  await page.goto('http://127.0.0.1:3088/?v=step5media-1');
  await page.locator('#app:not(.hidden)').waitFor();
  await page.addStyleTag({content:'#view{min-height:1800px}'});
  const measure=()=>page.evaluate(()=>{const w=$('welcome'),slot=w.parentElement,box=w.getBoundingClientRect(),inner=document.querySelector('.welcome-support-inner');return{y:scrollY,top:box.top,bottom:box.bottom,height:box.height,slot:slot.getBoundingClientRect().height,viewY:$('view').getBoundingClientRect().top+scrollY,compact:w.classList.contains('collapsed'),text:$('welcomeName').textContent,buttonBottom:$('contactButton').getBoundingClientRect().bottom,supportBottom:inner.getBoundingClientRect().bottom,root:document.scrollingElement.tagName};});
  for(const tab of ['home','albums','notices','favorites']){
   await page.locator(`[data-tab="${tab}"]`).click();if(tab==='notices')await page.locator('[data-notice-tab="public"]').click();await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(300);
   const expanded=await measure();assert.equal(expanded.compact,false);assert(expanded.buttonBottom<=expanded.bottom+1);
   assert.equal(expanded.text,'کاربر آزمایشی عزیز');
   await page.evaluate(()=>scrollTo(0,350));await page.waitForTimeout(300);
   const compact=await measure();assert.equal(compact.y,350);assert.equal(compact.compact,true);assert.equal(compact.top,10);assert.equal(compact.viewY,expanded.viewY);assert.equal(compact.slot,expanded.slot);assert(compact.height<expanded.height);
   if(tab==='notices'){
    const tabs=await page.locator('.primary-tabs').boundingBox();console.log('Notice geometry',JSON.stringify({tabs,compact}));assert(tabs.y>=compact.bottom-1,'Notice tabs overlap welcome');
   }
   if(tab==='home')await page.screenshot({path:path.join(out,'compact-365.png')});
   await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(300);
   const again=await measure();assert.equal(again.height,expanded.height);assert.equal(again.viewY,expanded.viewY);
   if(tab==='home')await page.screenshot({path:path.join(out,'expanded-365.png')});
   for(const action of ['settings','profile-info','support','radio','devices','messages']){
    await page.locator('#navProfile').click();await page.locator(`[data-action="${action}"]`).click();
    if(action!=='messages')await page.locator('#modal:not(.hidden)').waitFor();
    await page.goBack();await page.locator('#drawer:not(.hidden)').waitFor();
    await page.waitForTimeout(180);
    assert.equal(await page.locator('#drawer').isVisible(),true);
    assert.equal(await page.evaluate(()=>history.state.kind),'drawer');
    await page.goBack();await page.locator('#drawer.hidden').waitFor({state:'attached'});
    assert.equal(await page.evaluate(()=>state.tab),tab);
    checks.push({tab,action,firstBack:'drawer',secondBack:tab});
   }
  }
  await page.locator('[data-tab="albums"]').click();
  await page.locator('#navProfile').click();await page.locator('[data-action="settings"]').click();
  await page.locator('#closeModal').click();await page.locator('#drawer:not(.hidden)').waitFor();
  await page.locator('#closeDrawer').click();await page.locator('#drawer.hidden').waitFor({state:'attached'});
  assert.equal(await page.evaluate(()=>state.tab),'albums');
  for(const width of [320,393,768,1000]){
   await page.setViewportSize({width,height:800});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(300);
   const expanded=await measure();assert(expanded.buttonBottom<=expanded.bottom+1);
   const box=await page.locator('#welcome').boundingBox();assert(box.x>=0);assert(box.x+box.width<=width);
   await page.evaluate(()=>scrollTo(0,350));await page.waitForTimeout(300);const compact=await measure();assert.equal(expanded.slot,compact.slot);assert.equal(compact.y,350);
  }
  await page.setViewportSize({width:365,height:800});
  await page.locator('[data-tab="home"]').click();
  await page.evaluate(()=>{
   state.config.home.banners=[{id:'hero-test',placement:'hero',image_url:'https://fixture.invalid/banner.svg',title:'عنوان بنر آزمایشی',description:'توضیح بنر آزمایشی',sponsored:true,destination_type:'album',destination_id:'fixture-album'},{id:'fixed-test',fixed:true,image_url:'https://fixture.invalid/fixed.svg',title:'بنر ثابت',description:'توضیح ثابت'}];
   state.homePreview={albums:[],firstAlbum:null,firstAlbumCover:'',recentImages:[{name:'عکس آزمایشی',isImage:true,thumbnailUrl:'https://fixture.invalid/thumb.svg',downloadUrl:'https://fixture.invalid/full.jpg'}],recentVideos:[{name:'فیلم آزمایشی',isVideo:true,thumbnailUrl:'https://fixture.invalid/video-thumb.svg',downloadUrl:'https://fixture.invalid/movie.mp4'}]};
   state.heroIndex=1;renderHome();scrollTo(0,0);
  });
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.hero-indicators .dot').count(),2);
  assert.equal(await page.locator('.home-sponsored').textContent(),'تبلیغ');
  assert.equal(await page.locator('.hero-slide-button .home-banner-caption strong').textContent(),'عنوان بنر آزمایشی');
  assert.equal(await page.locator('.fixed-banner .home-banner-caption strong').textContent(),'بنر ثابت');
  const viewport=await page.locator('.hero-viewport').boundingBox(),indicators=await page.locator('.hero-indicators').boundingBox();
  assert.equal(viewport.height,188);assert(indicators.y>=viewport.y+viewport.height+8);
  assert.equal(await page.locator('[data-home-action="videos"] .home-content-image').getAttribute('src'),'https://fixture.invalid/video-thumb.svg');
  assert.equal(await page.locator('[data-home-action="images"] .home-content-image').getAttribute('src'),'https://fixture.invalid/thumb.svg');
  assert.equal(await page.locator('.home-content-icon svg').count(),6);
  assert.equal(await page.locator('.home-play-preview').count(),1);
  await page.screenshot({path:path.join(out,'home-step2-365.png'),fullPage:true});
  await page.locator('.hero-next').click();assert.equal(await page.evaluate(()=>state.heroIndex),0);
  await page.locator('[data-hero-dot="1"]').click();assert.equal(await page.evaluate(()=>state.heroIndex),1);
  await page.locator('#heroArea').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>state.heroIndex),0);
  await page.locator('#heroArea').dispatchEvent('pointerdown',{clientX:250,clientY:100});
  await page.locator('#heroArea').dispatchEvent('pointerup',{clientX:150,clientY:105});assert.equal(await page.evaluate(()=>state.heroIndex),1);
  await page.locator('#heroArea').dispatchEvent('pointerdown',{clientX:250,clientY:100});
  await page.locator('#heroArea').dispatchEvent('pointerup',{clientX:245,clientY:200});assert.equal(await page.evaluate(()=>state.heroIndex),1);
  await page.evaluate(()=>{startHeroTimer(heroItems());scrollTo(0,100)});
  await page.waitForTimeout(6200);assert.equal(await page.evaluate(()=>state.heroIndex),0);assert.equal(await page.evaluate(()=>scrollY),100);
  await page.locator('[data-hero-dot="1"]').click();await page.locator('.hero-slide-button').click();
  assert.equal(await page.evaluate(()=>state.tab),'albums');assert.equal(await page.evaluate(()=>state.folderHash),'fixture-album');
  await page.locator('[data-tab="home"]').click();
  await page.evaluate(()=>{state.homePreview.recentVideos[0].thumbnailUrl='';renderHome()});
  assert.equal(await page.locator('[data-home-action="videos"] .home-content-image').count(),0);
  await page.locator('[data-home-action="albums"]').click();assert.equal(await page.evaluate(()=>state.tab),'albums');
  await page.locator('[data-tab="home"]').click();await page.locator('[data-home-action="favorites"]').click();assert.equal(await page.evaluate(()=>state.tab),'favorites');
  await page.locator('[data-tab="home"]').click();await page.locator('[data-home-action="announcements"]').click();assert.equal(await page.evaluate(()=>state.tab),'notices');
  checks.push({home:'caption, indicators, icons, thumbnails, arrows, dots, keyboard, swipe, vertical gesture, auto advance without scroll jump, banner action and card routes passed'});
  await page.locator('[data-tab="home"]').click();
  await page.evaluate(()=>{
    state.albumGlobalItems = [
      {id:'p-old',name:'عکس قدیمی',isImage:true,type:'image/jpeg',downloadUrl:'https://fixture.invalid/old.svg',thumbnailUrl:'',createdAt:1,lastModified:1},
      {id:'p-new',name:'عکس تازه',isImage:true,type:'image/jpeg',downloadUrl:'https://fixture.invalid/new.svg',thumbnailUrl:'',createdAt:9,lastModified:9},
      {id:'v-one',name:'فیلم بدون کاور',isVideo:true,type:'video/mp4',downloadUrl:'https://fixture.invalid/video.mp4',thumbnailUrl:'',createdAt:5,lastModified:5}
    ]; state.albumSort='newest';
  });
  await page.locator('[data-home-action="images"]').click();
  await page.locator('[data-media="p-new"]').waitFor();
  assert.equal(await page.locator('#modal').isVisible(),false);
  assert.equal(await page.locator('.media-card').count(),2);
  assert.equal(await page.locator('.media-card').first().getAttribute('data-media'),'p-new');
  await page.locator('[data-media="p-old"]').click();await page.locator('#modal:not(.hidden)').waitFor();
  await page.goBack();await page.locator('#modal.hidden').waitFor({state:'attached'});
  assert.equal(await page.locator('.media-card').count(),2);
  assert.equal(await page.evaluate(()=>state.collectionKind),'image');
  await page.goBack();await page.locator('#heroArea').waitFor();
  assert.equal(await page.evaluate(()=>state.tab),'home');
  await page.locator('[data-home-action="videos"]').click();await page.locator('[data-media="v-one"]').waitFor();
  assert.equal(await page.locator('.media-card img').count(),0);
  assert.equal(await page.locator('.media-card').count(),1);
  await page.goBack();await page.locator('#heroArea').waitFor();
  await page.route('**/api/media/list?**', route => {
    const hash=new URL(route.request().url()).searchParams.get('hash');
    const results=hash==='child'?[{obj:{id:'c1',type:'image/jpeg',name:'عکس داخل پوشه',download_url:'https://fixture.invalid/child.svg'}}]:[
      {obj:{id:'f1',type:'folder',name:'پوشه نمونه',obj_hash:'child'}},
      {obj:{id:'m1',type:'image/jpeg',name:'تصویر نمونه',download_url:'https://fixture.invalid/photo.svg'}},
      {obj:{id:'m2',type:'video/mp4',name:'فیلم نمونه',download_url:'https://fixture.invalid/movie.mp4'}}
    ];return route.fulfill({json:{results}});
  });
  await page.evaluate(()=>resetMediaCache());
  await page.locator('[data-tab="albums"]').click();await page.locator('[data-folder="child"]').waitFor();
  await page.waitForFunction(()=>document.querySelector('.folder-card img')?.src.includes('thumb=true'));
  assert.equal(await page.locator('.folder-card img').count(),1);
  assert.equal(await page.locator('[data-media="m2"] img').count(),0);
  for(const mode of ['normal','compact','large']){
    await page.evaluate(mode=>{state.albumLayout=mode;paintFolder()},mode);
    const spans=await page.evaluate(()=>({folder:getComputedStyle(document.querySelector('.folder-card')).gridColumnStart,media:getComputedStyle(document.querySelector('.media-card')).gridColumnStart}));
    assert.equal(spans.folder,{normal:'span 3',compact:'span 4',large:'span 6'}[mode]);
    assert.equal(spans.media,{normal:'span 2',compact:'span 3',large:'span 3'}[mode]);
  }
  await page.evaluate(()=>{state.albumLayout='normal';paintFolder();scrollTo(0,0)});
  await page.screenshot({path:path.join(out,'albums-step3-365.png'),fullPage:true});
  await page.locator('[data-folder="child"]').click();await page.locator('[data-media="c1"]').waitFor();
  await page.goBack();await page.locator('[data-folder="child"]').waitFor();
  await page.locator('#albumSort').click();assert.equal(await page.evaluate(()=>state.albumSort),'oldest');
  await page.evaluate(()=>{state.albumGlobalItems=state.folderItems;});
  await page.locator('#albumSearch').fill('فیلم');await page.waitForTimeout(150);
  assert.equal(await page.locator('.media-card').count(),1);
  await page.goBack();await page.locator('[data-folder="child"]').waitFor();
  assert.equal(await page.locator('#albumSearch').inputValue(),'');
  const emptyLinks=await page.evaluate(()=>parseCloudItems({results:[{obj:{id:'empty',type:'video/mp4'}}]})[0]);
  assert.equal(emptyLinks.thumbnailUrl,'');assert.equal(emptyLinks.downloadUrl,'');
  checks.push({albums:'collection grid, newest order, viewer Back to collection, Back home, video without cover, three grid modes, folder Back, search Back, sort and empty links passed'});
  await page.evaluate(()=>{
    const items=[{id:'viewer-image',name:'تصویر آزمایشی',isImage:true,type:'image/jpeg',downloadUrl:'https://fixture.invalid/image.svg'},{id:'viewer-image2',name:'تصویر دوم',isImage:true,type:'image/jpeg',downloadUrl:'https://fixture.invalid/image2.svg'},{id:'viewer-video',name:'فیلم آزمایشی',isVideo:true,type:'video/webm',downloadUrl:'https://fixture.invalid/movie.webm'}];
    openViewer(items[0],items);
  });
  await page.locator('#viewerFullscreen').click();
  await page.waitForFunction(()=>document.fullscreenElement===document.getElementById('modal'));
  assert.equal(await page.locator('.viewer-watermark').isVisible(),true);
  await page.locator('#viewerFullscreen').click();
  await page.waitForFunction(()=>!document.fullscreenElement);
  assert.equal(await page.locator('#modal.viewer-expanded').count(),0);
  await page.evaluate(()=>{window.testNativeRequest=$('modal').requestFullscreen;$('modal').requestFullscreen=()=>Promise.reject(new Error('fixture denied'));});
  await page.locator('#viewerFullscreen').click();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#modal.viewer-expanded').count(),1);
  const fullBox=await page.locator('#modal').boundingBox();assert.equal(fullBox.x,0);assert.equal(fullBox.y,0);assert.equal(fullBox.width,365);assert.equal(fullBox.height,800);
  await page.screenshot({path:path.join(out,'viewer-expanded-365.png')});
  await page.locator('.viewer-stage').dispatchEvent('pointerdown',{pointerId:1,isPrimary:true,clientX:220,clientY:150});
  await page.locator('.viewer-stage').dispatchEvent('pointerup',{pointerId:1,isPrimary:true,clientX:140,clientY:320});
  assert.equal(await page.evaluate(()=>state.viewer.index),0);
  await page.locator('.viewer-stage').dispatchEvent('pointerdown',{pointerId:2,isPrimary:true,clientX:250,clientY:150});
  await page.locator('.viewer-stage').dispatchEvent('pointerup',{pointerId:2,isPrimary:true,clientX:150,clientY:155});
  assert.equal(await page.evaluate(()=>state.viewer.index),1);
  assert.equal(await page.locator('#modal.viewer-expanded').count(),1);
  await page.locator('#viewerZoom').click();
  await page.locator('.viewer-stage').dispatchEvent('pointerdown',{pointerId:3,isPrimary:true,clientX:250,clientY:150});
  await page.locator('.viewer-stage').dispatchEvent('pointerup',{pointerId:3,isPrimary:true,clientX:150,clientY:155});
  assert.equal(await page.evaluate(()=>state.viewer.index),1);
  await page.locator('#viewerNext').click();assert.equal(await page.locator('video#viewerMedia').count(),1);
  await page.locator('#viewerMedia').dispatchEvent('pointerdown',{pointerId:4,isPrimary:true,clientX:250,clientY:150});
  await page.locator('#viewerMedia').dispatchEvent('pointerup',{pointerId:4,isPrimary:true,clientX:100,clientY:150});
  assert.equal(await page.evaluate(()=>state.viewer.index),2);
  await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=100;canvas.height=100;
    const ctx=canvas.getContext('2d');ctx.fillRect(0,0,100,100);
    window.testStream=canvas.captureStream(10);window.testMedia=$('viewerMedia');testMedia.muted=true;testMedia.removeAttribute('src');testMedia.srcObject=testStream;
    window.testFrameTimer=setInterval(()=>{ctx.fillStyle=Math.random()>.5?'green':'black';ctx.fillRect(0,0,100,100)},50);
    await testMedia.play();
  });
  await page.waitForTimeout(300);
  const before=await page.evaluate(()=>testMedia.currentTime);
  await page.locator('#viewerFav').click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>testMedia===$('viewerMedia')),true);
  assert.equal(await page.evaluate(()=>testMedia.paused),false);
  assert((await page.evaluate(()=>testMedia.currentTime))>=before);
  await page.locator('#viewerFav').click();assert.equal(await page.evaluate(()=>testMedia===$('viewerMedia')),true);
  await page.locator('#closeModal').click();await page.locator('#modal.hidden').waitFor({state:'attached'});
  assert.equal(await page.locator('#modal.viewer-expanded').count(),0);
  assert.equal(await page.evaluate(()=>testMedia.paused),true);
  await page.evaluate(()=>{clearInterval(testFrameTimer);testStream.getTracks().forEach(t=>t.stop());$('modal').requestFullscreen=testNativeRequest;});
  await page.locator('#navProfile').click();await page.locator('[data-action="settings"]').click();
  assert.equal(await page.locator('#modal.viewer-expanded').count(),0);
  await page.locator('#closeModal').click();await page.locator('#drawer:not(.hidden)').waitFor();
  await page.locator('#closeDrawer').click();await page.locator('#drawer.hidden').waitFor({state:'attached'});
  checks.push({viewer:'native fullscreen, denied fallback, watermark, vertical/horizontal gestures, zoom, video controls, live video favorite continuity, cleanup and normal settings passed'});
  await page.evaluate(()=>{
    state.catalogFolders=new Map([['catalog-folder',{folder_hash:'catalog-folder',display_name:'اربعین ۱۴۰۵',real_name:'raw'}]]);
    state.catalogMedia=new Map([['123',{stable_id:'123',folder_hash:'catalog-folder',media_type:'image',sequence_number:7}],['hidden',{stable_id:'hidden',hidden:true}]]);
    const rows=parseCloudItems({results:[{obj:{id:123,type:'image/jpeg',name:'raw.jpg',download_url:'https://fixture.invalid/photo.jpg'}},{obj:{id:'hidden',type:'image/jpeg',name:'secret',download_url:'https://fixture.invalid/hidden.jpg'}}]});
    if(rows.length!==1||rows[0].id!=='123'||!rows[0].name.includes('عکس شماره ۷')||!rows[0].name.includes('اربعین ۱۴۰۵')||!rows[0].thumbnailUrl.includes('thumb=true'))throw Error('catalog parity failed');
    state.albumSort='newest';const folders=sortAlbumItems([{isFolder:true,name:'سال ۱۳۹۲',lastModified:999,createdAt:999},{isFolder:true,name:'سال ۱۴۰۵',lastModified:1,createdAt:1}]);
    if(folders[0].name!=='سال ۱۴۰۵')throw Error('Persian year sort failed');
    const item={id:'tap',name:'tap',type:'image/jpeg',isImage:true,downloadUrl:'https://fixture.invalid/tap.svg'};openViewer(item,[item]);
  });
  await page.locator('#viewerMedia').click({position:{x:50,y:40}});
  assert.equal(await page.locator('#viewerMedia.zoomed').count(),1);
  assert.notEqual(await page.locator('#viewerMedia').evaluate(e=>e.style.transformOrigin),'50% 50%');
  await page.waitForTimeout(300);
  const mark=await page.locator('.viewer-watermark').boundingBox(),stage=await page.locator('.viewer-stage').boundingBox();
  assert(mark.x>=stage.x&&mark.x<stage.x+stage.width/2);assert(mark.y>=stage.y&&mark.y<stage.y+stage.height/2);
  await page.locator('#viewerMedia').click();assert.equal(await page.locator('#viewerMedia.zoomed').count(),0);
  await page.evaluate(()=>{state.permissions={allow_download:true,allow_video_download:false,allow_photo_download:false,allow_share:false};openViewer({id:'native',name:'video',type:'video/mp4',isVideo:true,downloadUrl:'https://fixture.invalid/v.mp4'});});
  assert.equal(await page.locator('#viewerDownload').count(),0);assert.equal(await page.locator('#viewerShare').count(),0);
  assert.equal(await page.locator('video').evaluate(e=>e.controlsList.contains('nodownload')&&e.controlsList.contains('nofullscreen')),true);
  await page.locator('#closeModal').click();await page.locator('#modal.hidden').waitFor({state:'attached'});
  checks.push({media:'Android catalog names, stable IDs, hidden media, Persian year order, recursive cover thumbnail, tap-point zoom, top-left watermark and download controls passed'});
  await page.evaluate(()=>{window.close=()=>{};openSettings();});
  for(const width of [320,365,393,768]) {
    await page.setViewportSize({width,height:800});
    assert.equal(await page.locator('.settings-list').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
    const label=await page.locator('.settings-row strong').boundingBox(),select=await page.locator('#themeSelect').boundingBox();
    assert(label.x>=select.x+select.width-1 || label.y+label.height<=select.y+1);
  }
  await page.setViewportSize({width:365,height:800});
  await page.locator('#themeSelect').selectOption('dark');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.locator('#themeSelect').selectOption('light');
  await page.screenshot({path:path.join(out,'settings-365.png')});
  await page.evaluate(()=>{closeModalDirect();openExitOptions();});
  await page.screenshot({path:path.join(out,'exit-365.png')});
  let logouts=0;page.on('request',r=>{if(r.url().endsWith('/api/auth/logout'))logouts++;});
  page.once('dialog',d=>d.dismiss());await page.locator('#exitAccount').click();
  assert.equal(logouts,0);
  const user=await page.evaluate(()=>state.me.user_id);
  await page.locator('#exitApp').click();
  assert.equal(await page.evaluate(()=>state.me.user_id),user);assert.equal(logouts,0);
  await page.locator('#resumeApp').click();await page.locator('#app:not(.hidden)').waitFor();
  assert.equal(await page.evaluate(()=>state.tab),'home');
  await page.evaluate(()=>openExitOptions());page.once('dialog',d=>d.accept());
  await page.locator('#exitAccount').click();await page.locator('#auth:not(.hidden)').waitFor();
  assert.equal(logouts,1);assert.equal(await page.evaluate(()=>state.me),null);
  checks.push({settings:'RTL layout at 4 widths, theme switching, exit cancellation, preserved account on app exit, confirmed account logout passed'});
  assert.equal(await page.locator('#step1TraceExport').count(),0);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,health,checks,viewports:[320,365,393,768,1000],errors},null,2));
  console.log('PASS: 24 profile/back scenarios, close buttons, four-tab sticky scroll, 5 widths, health and no JS errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.kill());
