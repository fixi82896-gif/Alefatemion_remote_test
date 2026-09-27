function openDrawer() {
  updateIdentityUi();
  $('drawerBackdrop').classList.remove('hidden');
  $('drawer').classList.remove('hidden');
}
function closeDrawer() { $('drawerBackdrop').classList.add('hidden'); $('drawer').classList.add('hidden'); }
function openModal(title, html) { $('modalTitle').textContent=title; $('modalBody').innerHTML=html; $('modalBackdrop').classList.remove('hidden'); $('modal').classList.remove('hidden'); }
function closeModal() { $('modalBackdrop').classList.add('hidden'); $('modal').classList.add('hidden'); $('modalBody').innerHTML=''; }

function birthText(birth) { return birth ? `${birth.year}/${String(birth.month).padStart(2,'0')}/${String(birth.day).padStart(2,'0')}` : 'ثبت نشده'; }

function openProfileInfo() {
  const p=state.me;
  openModal('اطلاعات کاربری', `<div class="list"><div class="list-item"><strong>${escapeHtml(p.display_name||'—')}</strong><div class="muted">${escapeHtml(p.phone_masked||p.phone_e164||'—')}</div></div><div class="list-item"><small>شناسه کاربر</small><p>${escapeHtml(p.user_id||'—')}</p></div><div class="list-item"><small>تاریخ تولد شمسی</small><p>${escapeHtml(birthText(p.birth_jalali))}</p></div><div class="list-item"><small>وضعیت عضویت</small><p>${escapeHtml(p.membership_status||'—')}</p></div><button id="editProfile" class="primary">ویرایش نام و تاریخ تولد</button></div>`);
  $('editProfile')?.addEventListener('click',()=>{
    closeModal(); $('auth').classList.remove('hidden'); $('app').classList.add('hidden'); $('displayName').value=p.display_name||'';
    $('birthYear').value=p.birth_jalali?.year||''; $('birthMonth').value=p.birth_jalali?.month||''; $('birthDay').value=p.birth_jalali?.day||''; showAuthStep('profile');
  });
}

async function openMessages() {
  openModal('پیام‌ها','<div class="empty">در حال دریافت پیام‌ها…</div>');
  try {
    const data=await api('/api/account/messages'); const items=Array.isArray(data.messages)?data.messages:[];
    $('modalBody').innerHTML=items.length?`<div class="list">${items.map((m)=>`<article class="list-item" data-message="${escapeHtml(m.message_id)}"><strong>${escapeHtml(m.title||'پیام')}</strong><p>${escapeHtml(m.body||'')}</p><small class="muted">${m.read_at?'خوانده شده':'خوانده نشده'}</small></article>`).join('')}</div>`:'<div class="empty">پیامی وجود ندارد.</div>';
    for(const m of items.filter((x)=>!x.read_at)) api(`/api/account/messages/${m.message_id}/read`,{method:'POST',body:{}}).catch(()=>{});
  } catch(error) { $('modalBody').innerHTML=`<div class="empty">${escapeHtml(error.message)}</div>`; }
}

function enabledTracks() {
  const nava=state.config?.nava;
  if (!nava?.enabled) return [];
  return (nava.tracks||[]).filter((t)=>t.enabled!==false && (t.category==='celebration'?nava.celebration_enabled!==false:nava.mourning_enabled!==false));
}

function openRadio(preselect='') {
  const tracks=enabledTracks();
  openModal('رادیو', tracks.length?`<div class="list">${tracks.map((t)=>`<div class="list-item radio-row"><div><strong>${escapeHtml(t.title||'بدون عنوان')}</strong><small class="muted">${escapeHtml(t.performer||'')}</small></div><button data-track="${escapeHtml(t.id)}">پخش</button></div>`).join('')}</div>`:'<div class="empty">رادیو یا نواهای این بخش غیرفعال است.</div>');
  $('modalBody').querySelectorAll('[data-track]').forEach((button)=>button.addEventListener('click',()=>playTrack(button.dataset.track)));
  if(preselect && tracks.some((t)=>t.id===preselect)) setTimeout(()=>playTrack(preselect),0);
}

async function playTrack(id) {
  const track=enabledTracks().find((t)=>t.id===id); if(!track) return;
  const source=safeHttps(track.stream_url||track.page_url); if(!source){ toast('آدرس این نوا معتبر نیست.'); return; }
  const audio=$('audio'); state.currentTrackId=id; audio.src=source;
  try { await audio.play(); toast(`در حال پخش: ${track.title}`); }
  catch {
    audio.removeAttribute('src');
    const fallback=safeHttps(track.page_url||track.stream_url); if(fallback) window.open(fallback,'_blank','noopener,noreferrer');
    toast('پخش مستقیم این منبع ممکن نبود؛ صفحه منبع باز شد.');
  }
}

async function openDevices() {
  openModal('مدیریت دستگاه‌ها','<div class="empty">در حال دریافت دستگاه‌ها…</div>');
  try {
    const data=await api('/api/account/installations'); const items=Array.isArray(data.installations)?data.installations:[];
    const active=items.filter((x)=>x.status==='active'); const inactive=items.filter((x)=>x.status!=='active');
    $('modalBody').innerHTML=`<div class="section-title"><h2>فعال</h2><span class="pill">${active.length}</span></div><div class="list">${active.map(deviceHtml).join('')||'<div class="empty">—</div>'}</div><div class="section-title" style="margin-top:18px"><h2>غیرفعال</h2><span class="pill">${inactive.length}</span></div><div class="list">${inactive.map(deviceHtml).join('')||'<div class="empty">—</div>'}</div>`;
    $('modalBody').querySelectorAll('[data-remove-device]').forEach((button)=>button.addEventListener('click',()=>removeDevice(button.dataset.removeDevice,button.dataset.history==='1')));
  } catch(error){ $('modalBody').innerHTML=`<div class="empty">${escapeHtml(error.message)}</div>`; }
}

function deviceHtml(d) {
  const label=String(d.platform).toLowerCase()==='pwa'?'نسخه وب (PWA)':'Android';
  const inactive=d.status!=='active';
  const canRemove=!d.is_current;
  return `<div class="list-item"><strong>${escapeHtml(label)} ${d.is_current?'<span class="pill">این دستگاه</span>':''}</strong><div class="muted">نسخه ${escapeHtml(d.version_name||'—')} • ${escapeHtml(d.status||'—')}</div>${canRemove?`<button class="ghost" data-remove-device="${escapeHtml(d.install_id)}" data-history="${inactive?'1':'0'}">${inactive?'حذف از سابقه':'خروج این دستگاه'}</button>`:''}</div>`;
}

async function removeDevice(id, historyOnly) {
  if(!confirm(historyOnly?'این دستگاه از سابقه شما مخفی شود؟':'نشست این دستگاه پایان یابد؟')) return;
  try { await api(`/api/account/installations/${id}${historyOnly?'/history':''}`,{method:'DELETE'}); toast('انجام شد.'); openDevices(); }
  catch(error){ toast(error.message); }
}

function supportMethods() {
  return (state.config?.management_contact?.methods||[]).filter((m)=>m.enabled!==false && m.value);
}
function openSupport() {
  const methods=supportMethods();
  openModal('پشتیبانی', methods.length?`<div class="list">${methods.map((m)=>`<button class="list-item" data-support="${escapeHtml(m.id)}"><strong>${escapeHtml(m.label||'ارتباط')}</strong><small class="muted">${escapeHtml(m.type||'')}</small></button>`).join('')}</div>`:'<div class="empty">راه ارتباطی فعالی ثبت نشده است.</div>');
  $('modalBody').querySelectorAll('[data-support]').forEach((button)=>button.addEventListener('click',()=>{
    const m=methods.find((x)=>x.id===button.dataset.support); if(!m)return;
    let url=''; if(m.type==='email') url=`mailto:${m.value}`; else url=safeHttps(m.value);
    if(url) location.href=url;
  }));
}

function openSettings() {
  const selected=localStorage.getItem(THEME_KEY)||'system';
  openModal('تنظیمات', `<div class="list"><div class="list-item settings-row"><div><strong>حالت ظاهر</strong><small class="muted">روشن، تیره یا مطابق دستگاه</small></div><select id="themeSelect"><option value="system">سیستم</option><option value="light">روشن</option><option value="dark">تیره</option></select></div><div class="list-item"><strong>نسخه</strong><p>${VERSION}</p></div><button class="list-item" id="installPwa"><strong>نصب روی صفحه اصلی</strong><small class="muted">در صورت پشتیبانی مرورگر</small></button><button class="list-item" id="sharePwa"><strong>ارسال برنامه برای دوستان</strong><small class="muted">اشتراک لینک نسخه وب</small></button><button class="list-item" id="aboutPwa"><strong>درباره ما</strong></button><div class="list-item"><strong>مدیریت</strong><small class="muted">تمام تنظیمات مدیریتی فقط از اپ Android مدیر انجام می‌شود.</small></div></div>`);
  $('themeSelect').value=selected; $('themeSelect').addEventListener('change',(e)=>applyTheme(e.target.value));
  $('installPwa').addEventListener('click', installPwa);
  $('sharePwa').addEventListener('click', sharePwa);
  $('aboutPwa').addEventListener('click',()=>openModal('درباره ما',`<div class="list-item"><p>${escapeHtml(ABOUT_TEXT)}</p></div>`));
}

async function installPwa() {
  if(state.deferredInstallPrompt){ state.deferredInstallPrompt.prompt(); await state.deferredInstallPrompt.userChoice; state.deferredInstallPrompt=null; return; }
  toast('از منوی مرورگر گزینه «افزودن به صفحه اصلی / Install» را انتخاب کنید.');
}
async function sharePwa() {
  try { if(navigator.share) await navigator.share({title:'آل فاطمیون',text:'نسخه وب آل فاطمیون',url:location.origin}); else { await navigator.clipboard.writeText(location.origin); toast('لینک برنامه کپی شد.'); } } catch { /* cancel */ }
}

async function logout() {
  try { await api('/api/auth/logout',{method:'POST',body:{}}); } catch { /* local reset anyway */ }
  state.me=null; state.permissions=null; closeDrawer(); closeModal(); showAuth();
}

async function saveProfile(event) {
  event.preventDefault(); clearError();
  const button=event.submitter;
  const name=$('displayName').value.trim(); const year=Number(faToEn($('birthYear').value)); const month=Number(faToEn($('birthMonth').value)); const day=Number(faToEn($('birthDay').value));
  if(!name || !Number.isInteger(year)||year<1200||year>1600||!Number.isInteger(month)||month<1||month>12||!Number.isInteger(day)||day<1||day>31){ showError('نام و تاریخ تولد شمسی را کامل و صحیح وارد کنید.'); return; }
  setBusy(button,true,'در حال ذخیره…');
  try {
    await api('/api/account/me',{method:'PATCH',body:{display_name:name,birth_jalali:{year,month,day}}});
    state.me=await api('/api/account/me'); state.permissions=state.me.permissions||state.permissions;
    $('auth').classList.add('hidden'); $('app').classList.remove('hidden'); showApp(); toast('پروفایل ذخیره شد.');
  } catch(error){ showError(error.message); }
  finally{ setBusy(button,false); }
}

async function submitPhone(event) {
  event.preventDefault(); clearError();
  const button=event.submitter; const phone=faToEn($('phone').value).replace(/\s+/g,'');
  if(!$('privacy').checked){ showError('پذیرش حریم خصوصی لازم است.'); return; }
  setBusy(button,true,'در حال ارسال…');
  try {
    const reg=await api('/api/auth/register',{method:'POST',body:{phone,install_id:state.installId}});
    state.registrationId=reg.registration_id;
    const otp=await api('/api/auth/otp/request',{method:'POST',body:{registration_id:state.registrationId,install_id:state.installId}});
    state.otpRequestId=otp.otp_request_id;
    showAuthStep('otp');
    $('otp').focus();
    toast('کد ورود ارسال شد.');
  } catch(error){ showError(error.message); }
  finally{ setBusy(button,false); }
}

async function submitOtp(event) {
  event.preventDefault(); clearError();
  const button=event.submitter; const code=faToEn($('otp').value).replace(/\D/g,'');
  if(code.length!==6){ showError('کد باید ۶ رقم باشد.'); return; }
  setBusy(button,true,'در حال بررسی…');
  try {
    await api('/api/auth/otp/verify',{method:'POST',body:{registration_id:state.registrationId,otp_request_id:state.otpRequestId,install_id:state.installId,code}});
    await finishLogin();
  } catch(error){ showError(error.message); }
  finally{ setBusy(button,false); }
}

function handleDrawerAction(action) {
  closeDrawer();
  if(action==='profile-info') return openProfileInfo();
  if(action==='messages') return openMessages();
  if(action==='radio') return openRadio();
  if(action==='devices') return openDevices();
  if(action==='support') return openSupport();
  if(action==='settings') return openSettings();
  if(action==='logout') return logout();
}

function bindEvents() {
  $('phoneForm').addEventListener('submit',submitPhone);
  $('otpForm').addEventListener('submit',submitOtp);
  $('profileForm').addEventListener('submit',saveProfile);
  $('otpBack').addEventListener('click',()=>showAuthStep('phone'));
  document.querySelectorAll('.bottom-nav button[data-tab]').forEach((button)=>button.addEventListener('click',()=>setTab(button.dataset.tab)));
  $('profileButton').addEventListener('click',openDrawer); $('navProfile').addEventListener('click',openDrawer);
  $('closeDrawer').addEventListener('click',closeDrawer); $('drawerBackdrop').addEventListener('click',closeDrawer);
  $('closeModal').addEventListener('click',closeModal); $('modalBackdrop').addEventListener('click',closeModal);
  document.querySelectorAll('.drawer-actions [data-action]').forEach((button)=>button.addEventListener('click',()=>handleDrawerAction(button.dataset.action)));
  $('contactButton').addEventListener('click',openSupport);
  addEventListener('online',updateOnlineState); addEventListener('offline',updateOnlineState);
  addEventListener('beforeinstallprompt',(event)=>{ event.preventDefault(); state.deferredInstallPrompt=event; });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{ if((localStorage.getItem(THEME_KEY)||'system')==='system') applyTheme('system'); });
  $('audio').addEventListener('ended',()=>{
    const tracks=enabledTracks(); const index=tracks.findIndex((t)=>t.id===state.currentTrackId);
    if(index>=0 && index<tracks.length-1) playTrack(tracks[index+1].id);
  });
}

function updateOnlineState() { $('offline').classList.toggle('hidden',navigator.onLine); }

async function boot() {
  applyTheme(localStorage.getItem(THEME_KEY)||'system');
  updateOnlineState(); bindEvents();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch((error)=>console.warn('sw',error));
  await loadConfig();
  try {
    if(await loadAccount()) showApp(); else showAuth();
  } catch(error) {
    console.error(error); showAuth(); showError('ارتباط با سرویس حساب برقرار نشد. اتصال اینترنت را بررسی کنید.');
  }
}

boot();
