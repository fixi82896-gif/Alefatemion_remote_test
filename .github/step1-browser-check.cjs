const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.STEP1_RESULTS||path.join(root,'step1-results');
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
   if(u.hostname!=='127.0.0.1')return route.abort();
   if(u.pathname==='/brand-logo.webp')return route.fulfill({contentType:'image/webp',body:fs.readFileSync(root+'/docs/assets/logo_alfatemiun.webp')});
   if(u.pathname.startsWith('/api/')){
    const json=u.pathname==='/api/account/me'?{user_id:'fixture',display_name:'کاربر آزمایشی',birth_jalali:{year:1370,month:1,day:1}}:u.pathname==='/api/config'?{source:{root_hash:'fixture'},home:{},announcements:{items:Array.from({length:20},(_,i)=>({id:'notice-'+i,title:'خبر آزمایشی',body:'متن آزمایشی',published:true}))},nava:{enabled:true,tracks:[]}}:{items:[],messages:[],installations:[]};
    return route.fulfill({json});
   }
   return route.continue();
  });
  await page.goto('http://127.0.0.1:3088/?v=step1fix-3');
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
  assert.equal(await page.locator('#step1TraceExport').count(),0);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,health,checks,viewports:[320,365,393,768,1000],errors},null,2));
  console.log('PASS: 24 profile/back scenarios, close buttons, four-tab sticky scroll, 5 widths, health and no JS errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.kill());
