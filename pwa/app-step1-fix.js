'use strict';

/* PWA Step 1 fix only:
 * 1) collapse the welcome card early and with hysteresis so it stays visible
 *    while its fixed-height slot prevents page jumps;
 * 2) restore the profile drawer when browser Back returns from one of its
 *    child screens/modal pages.
 */

updateWelcomeCollapse = function step1FixedWelcomeCollapse() {
  const welcome = $('welcome');
  if (!welcome) return;
  const appVisible = !$('app')?.classList.contains('hidden');
  welcome.parentElement.classList.toggle('step1-home', appVisible && state.tab === 'home');
  if (!appVisible) return;

  const y = window.scrollY || document.documentElement.scrollTop || 0;
  const compact = welcome.classList.contains('collapsed');

  if (!compact && y > 24) welcome.classList.add('collapsed');
  else if (compact && y < 8) welcome.classList.remove('collapsed');
};

/* Tab changes and session restoration can happen without a scroll event. */
const step1WelcomeObserver = new MutationObserver(() => updateWelcomeCollapse());
const step1BottomNav = document.querySelector('.bottom-nav');
if (step1BottomNav) step1WelcomeObserver.observe(step1BottomNav, { attributes:true, attributeFilter:['class'], subtree:true });
if ($('app')) step1WelcomeObserver.observe($('app'), { attributes:true, attributeFilter:['class'] });
updateWelcomeCollapse();

function step1ShowDrawerDirect() {
  updateIdentityUi();
  $('drawerBackdrop')?.classList.remove('hidden');
  $('drawer')?.classList.remove('hidden');
}

const step1BaseHandlePopState = handlePopState;
handlePopState = function step1FixedHandlePopState(event) {
  const snapshot = event.state;
  const returningToDrawer = snapshot?.alef === true && snapshot?.kind === 'drawer';

  if (returningToDrawer) {
    if (!$('modal')?.classList.contains('hidden')) closeModalDirect();
    step1ShowDrawerDirect();
    return;
  }

  step1BaseHandlePopState(event);
};

/* Temporary, opt-in navigation evidence. It deliberately does not fix or
 * consume Back events. No account fields, URLs, folder IDs, or tokens are
 * retained; the bounded trace lives in memory until the user downloads it. */
(function step1NavigationTrace() {
  if (!['alefatemion-pwa-test.liara.run', 'localhost', '127.0.0.1'].includes(location.hostname)) return;
  if (new URLSearchParams(location.search).get('navtrace') !== '1') return;
  const events = [];
  let sequence = 0;
  let popCount = 0;
  const started = performance.now();
  const safeState = (value) => ({
    alef:value?.alef === true,
    kind:['tab','drawer','modal','search'].includes(value?.kind) ? value.kind : null,
    tab:['home','albums','notices','favorites'].includes(value?.tab) ? value.tab : null,
    folderDepth:Array.isArray(value?.folderStack) ? value.folderStack.length : 0
  });
  const visible = (id) => Boolean($(id) && !$(id).classList.contains('hidden'));
  function record(event, extra = {}) {
    events.push({ sequence:++sequence, ms:Math.round(performance.now() - started), event,
      history:safeState(history.state), historyLength:history.length,
      tab:safeState({tab:state.tab}).tab, drawer:visible('drawer'), modal:visible('modal'),
      restoring:state.restoringHistory === true, popCount, ...extra });
    if (events.length > 250) events.shift();
  }
  function traced(name, fn) {
    return function(...args) {
      record(name + ':before');
      try { return fn.apply(this, args); }
      finally { record(name + ':after'); }
    };
  }
  openDrawer = traced('openDrawer', openDrawer);
  openModal = traced('openModal', openModal);
  closeDrawerDirect = traced('closeDrawerDirect', closeDrawerDirect);
  closeModalDirect = traced('closeModalDirect', closeModalDirect);
  pushHistory = traced('pushHistory', pushHistory);
  document.addEventListener('DOMContentLoaded', () => {
    handleDrawerAction = traced('handleDrawerAction', handleDrawerAction);
  }, { once:true });
  handlePopState = traced('handlePopState', handlePopState);
  for (const method of ['pushState','replaceState','back','go','forward']) {
    history[method] = traced('history.' + method, history[method]);
  }
  addEventListener('popstate', (event) => {
    popCount += 1;
    record('popstate:before', { destination:safeState(event.state) });
    queueMicrotask(() => record('popstate:microtask'));
    setTimeout(() => record('popstate:settled'), 120);
  }, { capture:true });
  document.addEventListener('click', (event) => {
    const control = event.target instanceof Element ? event.target.closest('button') : null;
    if (!control) return;
    const ids = ['navProfile','profileButton','closeDrawer','closeModal'];
    const actions = ['profile-info','messages','radio','devices','support','settings','logout'];
    const action = actions.includes(control.dataset.action) ? control.dataset.action : null;
    const tab = safeState({tab:control.dataset.tab}).tab;
    if (ids.includes(control.id) || action || tab) record('click', { control:ids.includes(control.id) ? control.id : null, action, targetTab:tab });
  }, { capture:true });
  const button = document.createElement('button');
  button.id = 'step1TraceExport';
  button.type = 'button';
  button.className = 'step1-trace-export';
  button.textContent = 'دریافت گزارش بازگشت';
  button.addEventListener('click', () => {
    record('export');
    const report = { build:'step1fix-2', mode:'diagnostic-only',
      viewport:{width:innerWidth,height:innerHeight}, events };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {type:'application/json'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Alefatemion-Step1-Back-Trace.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
  document.body.appendChild(button);
  record('trace:ready');
})();
