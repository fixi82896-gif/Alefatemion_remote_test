'use strict';

(function(){
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = Array.from(document.querySelectorAll('.reveal'));

  items.forEach((el, index) => {
    if (!reduced) el.style.transitionDelay = `${Math.min((index % 5) * 70, 280)}ms`;
  });

  if (reduced || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
    items.forEach((el) => observer.observe(el));
  }

  const progress = document.getElementById('scrollProgress');
  const header = document.querySelector('.site-header');
  let ticking = false;

  function updateScrollUi() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const height = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    if (progress) progress.style.width = `${Math.max(0, Math.min(100, (scrollTop / height) * 100))}%`;
    if (header) header.classList.toggle('is-scrolled', scrollTop > 18);
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateScrollUi);
      ticking = true;
    }
  }, { passive: true });
  updateScrollUi();

  const navLinks = Array.from(document.querySelectorAll('.main-nav a[href^="#"]'));
  const navTargets = navLinks
    .map((link) => ({ link, target: document.querySelector(link.getAttribute('href')) }))
    .filter((item) => item.target);

  if ('IntersectionObserver' in window && navTargets.length) {
    const navObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navTargets.forEach(({ link, target }) => {
        link.classList.toggle('is-active', target === visible.target);
      });
    }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.1, 0.25] });
    navTargets.forEach(({ target }) => navObserver.observe(target));
  }



  // خط زمان با حرکت صفحه پیش می‌رود و نزدیک‌ترین ایستگاه را برجسته می‌کند.
  const timeline = document.querySelector('.timeline');
  const timelineSteps = timeline ? Array.from(timeline.querySelectorAll('.timeline-item')) : [];
  function updateTimeline() {
    if (!timeline || !timelineSteps.length) return;
    const rect = timeline.getBoundingClientRect();
    const viewportAnchor = window.innerHeight * 0.58;
    const total = Math.max(rect.height - 30, 1);
    const progressed = Math.max(0, Math.min(total, viewportAnchor - rect.top - 15));
    timeline.style.setProperty('--timeline-progress', `${(progressed / total) * 100}%`);

    let closest = null;
    let closestDistance = Infinity;
    timelineSteps.forEach((step) => {
      const stepRect = step.getBoundingClientRect();
      const center = stepRect.top + (stepRect.height / 2);
      const distance = Math.abs(center - viewportAnchor);
      if (distance < closestDistance) {
        closest = step;
        closestDistance = distance;
      }
    });
    timelineSteps.forEach((step) => step.classList.toggle('is-current', step === closest && rect.top < viewportAnchor && rect.bottom > viewportAnchor * .35));
  }

  let timelineTicking = false;
  function requestTimelineUpdate() {
    if (timelineTicking) return;
    timelineTicking = true;
    requestAnimationFrame(() => {
      updateTimeline();
      timelineTicking = false;
    });
  }
  if (timeline) {
    window.addEventListener('scroll', requestTimelineUpdate, { passive: true });
    window.addEventListener('resize', requestTimelineUpdate, { passive: true });
    updateTimeline();
  }

  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  if (navToggle && mainNav) {
    const closeNav = () => { mainNav.classList.remove('is-open'); navToggle.setAttribute('aria-expanded', 'false'); };
    let navigationToken = 0;
    let navigationObserver = null;
    let navigationReserve = null;
    let navigationTimers = [];
    let navigationActive = false;

    const clearNavigationTimers = () => {
      navigationTimers.forEach((timer) => window.clearTimeout(timer));
      navigationTimers = [];
    };

    const stopNavigationTracking = ({ keepReserve = true } = {}) => {
      navigationActive = false;
      navigationToken += 1;
      clearNavigationTimers();
      if (navigationObserver) navigationObserver.disconnect();
      navigationObserver = null;
      // Cancel any in-flight native smooth scroll at the user's current position.
      window.scrollTo({ top: window.scrollY, behavior: 'instant' });
      if (!keepReserve) clearNavigationReserve();
    };

    const clearNavigationReserve = () => {
      if (navigationReserve && navigationReserve.parentNode) navigationReserve.parentNode.removeChild(navigationReserve);
      navigationReserve = null;
    };

    const interruptNavigationForUser = () => {
      if (!navigationActive) return;
      stopNavigationTracking({ keepReserve: true });
    };

    window.addEventListener('wheel', interruptNavigationForUser, { passive: true });
    window.addEventListener('touchstart', interruptNavigationForUser, { passive: true });
    window.addEventListener('pointerdown', interruptNavigationForUser, { passive: true });
    window.addEventListener('keydown', (event) => {
      if (!navigationActive) return;
      const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
      if (scrollKeys.includes(event.key)) interruptNavigationForUser();
    });

    const ensureScrollCapacity = (desiredTop) => {
      const reserveHeight = navigationReserve ? navigationReserve.getBoundingClientRect().height : 0;
      const baseScrollHeight = Math.max(0, document.documentElement.scrollHeight - reserveHeight);
      const baseMaxScroll = Math.max(0, baseScrollHeight - window.innerHeight);
      const missing = Math.ceil(desiredTop - baseMaxScroll);

      if (missing <= 0) {
        clearNavigationReserve();
        return;
      }

      const footer = document.querySelector('.footer');
      if (!footer) return;
      if (!navigationReserve) {
        navigationReserve = document.createElement('div');
        navigationReserve.setAttribute('aria-hidden', 'true');
        navigationReserve.style.pointerEvents = 'none';
        navigationReserve.style.visibility = 'hidden';
        footer.appendChild(navigationReserve);
      }
      const requiredHeight = missing + 2;
      if (Math.abs(navigationReserve.getBoundingClientRect().height - requiredHeight) > 1) {
        navigationReserve.style.height = `${requiredHeight}px`;
      }
    };

    const scrollToSection = (href) => {
      const target = document.querySelector(href);
      if (!target) return;

      stopNavigationTracking({ keepReserve: false });
      const token = ++navigationToken;
      navigationActive = true;
      closeNav();

      const align = (behavior = 'instant') => {
        if (token !== navigationToken) return;
        if (href === '#top') {
          clearNavigationReserve();
          window.scrollTo({ top: 0, behavior });
          return;
        }

        const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
        const absoluteTop = window.scrollY + target.getBoundingClientRect().top;
        const desiredTop = Math.max(0, Math.round(absoluteTop - headerHeight));
        ensureScrollCapacity(desiredTop);
        window.scrollTo({ top: desiredTop, behavior });
      };

      window.requestAnimationFrame(() => align(reduced ? 'instant' : 'smooth'));

      const correctionDelays = [160, 360, 700, 1150, 1650];
      correctionDelays.forEach((delay, index) => {
        const timer = window.setTimeout(() => align(index === 0 && !reduced ? 'smooth' : 'instant'), delay);
        navigationTimers.push(timer);
      });

      if ('ResizeObserver' in window && href !== '#top') {
        navigationObserver = new ResizeObserver(() => {
          if (!navigationActive || token !== navigationToken) return;
          window.requestAnimationFrame(() => align('instant'));
        });
        navigationObserver.observe(document.body);
      }

      const finishTimer = window.setTimeout(() => {
        if (token !== navigationToken) return;
        align('instant');
        navigationActive = false;
        clearNavigationTimers();
        if (navigationObserver) navigationObserver.disconnect();
        navigationObserver = null;
      }, 1900);
      navigationTimers.push(finishTimer);

      document.querySelectorAll('img').forEach((img) => {
        if (img.complete) return;
        const onSettled = () => { if (navigationActive && token === navigationToken) align('instant'); };
        img.addEventListener('load', onSettled, { once:true });
        img.addEventListener('error', onSettled, { once:true });
      });

      if (window.location.hash !== href) {
        window.history.pushState(null, '', href);
      }
    };

    navToggle.addEventListener('click', () => {
      const willOpen = !mainNav.classList.contains('is-open');
      mainNav.classList.toggle('is-open', willOpen);
      navToggle.setAttribute('aria-expanded', String(willOpen));
    });
    mainNav.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      event.preventDefault();
      scrollToSection(href);
    }));
    document.addEventListener('click', (event) => { if (!mainNav.contains(event.target) && !navToggle.contains(event.target)) closeNav(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 980) closeNav(); }, { passive:true });
  }

  const versionName = document.getElementById('versionName');
  const versionCode = document.getElementById('versionCode');
  const downloadButton = document.getElementById('downloadButton');
  if (!versionName || !downloadButton) return;

  const loadRelease = () => fetch('/api/release', { cache: 'no-store', headers: { 'Accept': 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error('release metadata unavailable');
      return response.json();
    })
    .then((release) => {
      downloadButton.removeAttribute('aria-disabled');
      if (release.version_name) versionName.textContent = `نسخه ${release.version_name}`;
      if (versionCode && release.version_code) versionCode.textContent = `Code ${release.version_code}`;
      downloadButton.setAttribute('href', release.download_url || '/download/android');
    })
    .catch(() => {
      versionName.textContent = 'نسخه رسمی موقتاً در دسترس نیست';
      if (versionCode) versionCode.textContent = '';
      downloadButton.removeAttribute('href');
      downloadButton.setAttribute('aria-disabled', 'true');
    });
  loadRelease();
  window.setInterval(loadRelease, 120000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadRelease(); });
})();
