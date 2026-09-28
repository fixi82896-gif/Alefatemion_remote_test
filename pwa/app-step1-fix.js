'use strict';

/* PWA Step 1 fix only:
 * 1) collapse the welcome card early and with hysteresis so it stays visible
 *    while its fixed-height slot prevents page jumps;
 * 2) restore the profile drawer when browser Back returns from one of its
 *    child screens/modal pages.
 */

updateWelcomeCollapse = function step1FixedWelcomeCollapse() {
  const welcome = $('welcome');
  if (!welcome || $('app')?.classList.contains('hidden')) return;

  const y = window.scrollY || document.documentElement.scrollTop || 0;
  const compact = welcome.classList.contains('collapsed');

  if (!compact && y > 24) welcome.classList.add('collapsed');
  else if (compact && y < 8) welcome.classList.remove('collapsed');
};

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
