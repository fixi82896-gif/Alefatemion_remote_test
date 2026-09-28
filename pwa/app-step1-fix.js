'use strict';

/* Step1: shared welcome and evidence-based profile history repair.
 * Device trace step1fix-2 events 24-25 proved that closing the drawer
 * for a child screen replaced its history entry with "tab". */
updateWelcomeCollapse = function step1FixedWelcomeCollapse() {
  const welcome = $('welcome');
  if (!welcome || $('app')?.classList.contains('hidden')) return;
  const y = window.scrollY || document.documentElement.scrollTop || 0;
  const compact = welcome.classList.contains('collapsed');
  if (!compact && y > 24) welcome.classList.add('collapsed');
  else if (compact && y < 8) welcome.classList.remove('collapsed');
  step1MeasureWelcome();
};

function step1MeasureWelcome() {
  const welcome = $('welcome');
  const header = document.querySelector('.welcome-header');
  if (!welcome || !header || $('app')?.classList.contains('hidden')) return;
  const height = Math.ceil(header.getBoundingClientRect().height);
  if (!height) return;
  const support = document.querySelector('.welcome-support-inner');
  const supportHeight = Math.max(88, Math.ceil(support?.getBoundingClientRect().height || 88));
  /* Reserve expanded height even when the support area is collapsed.
   * Only width/text changes affect this reservation, never scroll position. */
  welcome.style.setProperty('--welcome-support-height', supportHeight + 'px');
  welcome.parentElement.style.height = (height + supportHeight + 20) + 'px';
  document.documentElement.style.setProperty('--welcome-sticky-edge',
    (height + (welcome.classList.contains('collapsed') ? 0 : supportHeight) + 10) + 'px');
}

const step1WelcomeObserver = new MutationObserver(() => updateWelcomeCollapse());
if ($('app')) step1WelcomeObserver.observe($('app'), { attributes:true, attributeFilter:['class'] });
const step1WelcomeHeader = document.querySelector('.welcome-header');
if (step1WelcomeHeader && typeof ResizeObserver === 'function') {
  const observer = new ResizeObserver(step1MeasureWelcome);
  observer.observe(step1WelcomeHeader);
  const support = document.querySelector('.welcome-support-inner');
  if (support) observer.observe(support);
}
addEventListener('resize', step1MeasureWelcome);

const step1BaseUpdateIdentityUi = updateIdentityUi;
updateIdentityUi = function step1UpdateIdentityUi() {
  step1BaseUpdateIdentityUi();
  $('welcomeName').textContent = ((state.me?.display_name || '').trim() || 'آل فاطمیون') + ' عزیز';
  step1MeasureWelcome();
};

function step1ShowDrawerDirect() {
  updateIdentityUi();
  $('drawerBackdrop')?.classList.remove('hidden');
  $('drawer')?.classList.remove('hidden');
}

const step1BaseHandlePopState = handlePopState;
handlePopState = function step1FixedHandlePopState(event) {
  if (!state.me) return;
  const snapshot = event.state;
  if (snapshot?.alef === true && snapshot.kind === 'drawer') {
    /* Restoration must not replace or push the destination history entry. */
    const restoring = state.restoringHistory;
    state.restoringHistory = true;
    try {
      if (!$('modal')?.classList.contains('hidden')) closeModalDirect();
      if (state.tab !== snapshot.tab) restoreFromHistory(snapshot);
      step1ShowDrawerDirect();
    } finally { state.restoringHistory = restoring; }
    return;
  }
  step1BaseHandlePopState(event);
};

/* app-auth defines this dispatcher after this deferred script.
 * Preserve the drawer entry only when navigating to its child screens.
 * Explicit close and logout keep their existing behavior. */
document.addEventListener('DOMContentLoaded', () => {
  const baseAction = handleDrawerAction;
  handleDrawerAction = function step1HandleDrawerAction(action) {
    const children = {
      'profile-info':openProfileInfo, settings:openSettings,
      radio:openRadio, devices:openDevices, support:openSupport,
      messages:() => { state.noticeSubtab = 'personal'; setTab('notices', {forcePush:true}); }
    };
    if (!Object.hasOwn(children, action) || history.state?.kind !== 'drawer' ||
        history.state?.alef !== true || $('drawer').classList.contains('hidden')) {
      return baseAction(action);
    }
    /* Hide only the UI, leaving the drawer's history entry in place. */
    $('drawerBackdrop').classList.add('hidden');
    $('drawer').classList.add('hidden');
    return children[action]();
  };
}, { once:true });
