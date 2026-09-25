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
    navToggle.addEventListener('click', () => {
      const willOpen = !mainNav.classList.contains('is-open');
      mainNav.classList.toggle('is-open', willOpen);
      navToggle.setAttribute('aria-expanded', String(willOpen));
    });
    mainNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeNav));
    document.addEventListener('click', (event) => { if (!mainNav.contains(event.target) && !navToggle.contains(event.target)) closeNav(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 980) closeNav(); }, { passive:true });
  }

  const versionName = document.getElementById('versionName');
  const versionCode = document.getElementById('versionCode');
  const downloadButton = document.getElementById('downloadButton');
  if (!versionName || !downloadButton) return;

  fetch('/api/release', { cache: 'no-store', headers: { 'Accept': 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error('release metadata unavailable');
      return response.json();
    })
    .then((release) => {
      if (release.version_name) versionName.textContent = `نسخه ${release.version_name}`;
      if (versionCode && release.version_code) versionCode.textContent = `Code ${release.version_code}`;
      downloadButton.setAttribute('href', release.download_url || '/download/android');
    })
    .catch(() => {
      downloadButton.setAttribute('href', '/download/android');
    });
})();
