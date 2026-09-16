/* ====================================================================
   PRASATH SIVAGURU — script.js
   SCROLL-FIXED build: Lenis via native RAF, gallery on window.load,
   intro never blocks body scroll, all GSAP animations intact.
   ==================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
     ENVIRONMENT CHECKS
     ------------------------------------------------------------------ */
  const isMobile = () => window.innerWidth <= 767;
  const isTouch  = () => window.matchMedia('(hover: none)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     GSAP REGISTRATION
     ------------------------------------------------------------------ */
  gsap.registerPlugin(ScrollTrigger);

  // Tell ScrollTrigger to always read window.scrollY (not any proxy)
  // This ensures compatibility with Lenis' native-scroll mode.
  ScrollTrigger.config({ autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load,resize' });

  /* ------------------------------------------------------------------
     LENIS SMOOTH SCROLL

     FIX #2 (was root cause): The previous code passed `gsap.ticker`
     time × 1000 to lenis.raf(). GSAP's internal clock starts from a
     non-zero value and is NOT the same as the requestAnimationFrame
     DOMHighResTimestamp that Lenis requires. This caused Lenis to
     receive an enormous first delta, effectively freezing its scroll
     while still calling event.preventDefault() on every wheel event.

     Fix: drive Lenis with requestAnimationFrame directly. The browser
     provides the correct timestamp. ScrollTrigger is still updated on
     every Lenis scroll event via lenis.on('scroll', ...).
     ------------------------------------------------------------------ */
  let lenis = null;

  function initLenis() {
    if (prefersReducedMotion) return;

    // Initialize Lenis smooth scroll engine
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    // Notify GSAP ScrollTrigger whenever Lenis updates scroll position
    lenis.on('scroll', ScrollTrigger.update);

    // Sync Lenis RAF directly with GSAP Ticker for frame synchronization
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    // Disable GSAP lag smoothing to avoid scroll jumping
    gsap.ticker.lagSmoothing(0);
  }

  /* ------------------------------------------------------------------
     UTILITY: SPLIT TEXT INTO CHARACTER SPANS
     ------------------------------------------------------------------ */
  function splitChars(el) {
    const text = el.textContent;
    el.innerHTML = '';
    el.setAttribute('aria-label', text);
    const chars = [...text].map(char => {
      const span = document.createElement('span');
      span.textContent = char === ' ' ? '\u00A0' : char;
      span.style.display = 'inline-block';
      span.setAttribute('aria-hidden', 'true');
      el.appendChild(span);
      return span;
    });
    return chars;
  }

  /* ------------------------------------------------------------------
     01. CINEMATIC INTRO ANIMATION

     FIX #1 (was root cause): The previous code set body.style.overflow
     = 'hidden' and relied SOLELY on the GSAP timeline's onComplete to
     clear it. If the timeline stalled (because lenis.raf was broken),
     overflow stayed hidden forever — the page could never scroll.

     Fix:
      - Do NOT touch body.overflow at all. The intro overlay is
        position:fixed + z-index:8000, so it covers the page visually.
        The body can scroll underneath; the user sees nothing anyway.
      - A safety timer clears the overlay after 3 s regardless.
      - window.scrollTo(0,0) on intro complete to reset position.
     ------------------------------------------------------------------ */
  function initIntro() {
    const overlay  = document.getElementById('intro-overlay');
    const line     = document.querySelector('.intro-line');
    const firstEl  = document.getElementById('intro-first');
    const lastEl   = document.getElementById('intro-last');
    const role     = document.getElementById('intro-role');

    if (!overlay || !firstEl || !lastEl) return;

    // Helper: fully dismiss the overlay
    function dismissOverlay() {
      gsap.set(overlay, { display: 'none', pointerEvents: 'none' });
      overlay.setAttribute('aria-hidden', 'true');
      // Snap to top in case scroll crept during intro
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    // Safety net: dismiss after 3 s even if GSAP stalls
    const safetyId = setTimeout(dismissOverlay, 3000);

    if (prefersReducedMotion) {
      clearTimeout(safetyId);
      dismissOverlay();
      return;
    }

    // Split characters
    const firstChars = splitChars(firstEl);
    const lastChars  = splitChars(lastEl);

    gsap.timeline({
      onComplete: () => {
        clearTimeout(safetyId);
        dismissOverlay();
      }
    })
      .set(overlay, { opacity: 1 })
      .to({}, { duration: 0.15 })
      // Timeline line
      .to(line, {
        scaleX: 1,
        duration: 0.38,
        ease: 'power3.inOut',
        transformOrigin: 'left center',
      })
      // PRASATH chars
      .from(firstChars, {
        y: 50, opacity: 0,
        duration: 0.4,
        stagger: 0.025,
        ease: 'power3.out',
      }, '-=0.1')
      // SIVAGURU chars
      .from(lastChars, {
        y: 50, opacity: 0,
        duration: 0.4,
        stagger: 0.022,
        ease: 'power3.out',
      }, '-=0.32')
      // Role text
      .to(role, {
        opacity: 1, y: 0,
        duration: 0.28,
        ease: 'power2.out',
      }, '-=0.15')
      .to({}, { duration: 0.3 })
      // Fade out overlay
      .to(overlay, {
        opacity: 0,
        duration: 0.45,
        ease: 'power2.inOut',
      });
  }

  /* ------------------------------------------------------------------
     02. CUSTOM CURSOR
     ------------------------------------------------------------------ */
  function initCursor() {
    if (isTouch() || isMobile()) return;

    const cursor   = document.getElementById('cursor');
    const follower = document.getElementById('cursor-follower');
    const label    = document.getElementById('cursor-label');

    if (!cursor || !follower || !label) return;

    let cx = window.innerWidth  / 2;
    let cy = window.innerHeight / 2;
    let fx = cx, fy = cy;

    window.addEventListener('mousemove', (e) => {
      cx = e.clientX;
      cy = e.clientY;
    }, { passive: true });

    gsap.ticker.add(() => {
      gsap.set(cursor, { x: cx, y: cy });
      gsap.set(label,  { x: cx, y: cy });
      fx += (cx - fx) * 0.12;
      fy += (cy - fy) * 0.12;
      gsap.set(follower, { x: fx, y: fy });
    });

    function setCursorType(type) {
      document.body.classList.remove('cursor-play', 'cursor-view', 'cursor-open');
      if (type) {
        document.body.classList.add('cursor-' + type);
        label.textContent = type.toUpperCase();
      }
    }

    document.querySelectorAll('[data-cursor]').forEach(el => {
      el.addEventListener('mouseenter', () => setCursorType(el.dataset.cursor));
      el.addEventListener('mouseleave', () => setCursorType(null));
    });

    document.querySelectorAll('.video-gallery-card').forEach(el => {
      el.addEventListener('mouseenter', () => setCursorType('play'));
      el.addEventListener('mouseleave', () => setCursorType(null));
    });

    document.querySelectorAll('.magnetic-btn').forEach(el => {
      el.addEventListener('mouseenter', () => setCursorType('open'));
      el.addEventListener('mouseleave', () => setCursorType(null));
    });

    document.querySelectorAll('.narrative-card').forEach(el => {
      el.addEventListener('mouseenter', () => setCursorType('view'));
      el.addEventListener('mouseleave', () => setCursorType(null));
    });

    document.querySelectorAll('.skill-card').forEach(el => {
      el.addEventListener('mouseenter', () => setCursorType('view'));
      el.addEventListener('mouseleave', () => setCursorType(null));
    });
  }

  /* ------------------------------------------------------------------
     03. HERO VIDEO BACKGROUND
     ------------------------------------------------------------------ */
  function initHeroVideo() {
    const video = document.getElementById('hero-video');
    if (!video) return;

    if (prefersReducedMotion) {
      video.pause();
      return;
    }

    video.muted = true;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  }

  /* ------------------------------------------------------------------
     03B. HERO PARALLAX + CURSOR LIGHT
     ------------------------------------------------------------------ */
  function initHeroParallax() {
    if (prefersReducedMotion || isTouch()) return;

    const textGroup   = document.getElementById('hero-text-group');
    const glassPanel  = document.getElementById('hero-glass-panel');
    const cursorLight = document.getElementById('hero-cursor-light');
    const heroSection = document.querySelector('.hero-section');

    if (!heroSection) return;

    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;

    window.addEventListener('mousemove', (e) => {
      const rect = heroSection.getBoundingClientRect();
      if (rect.bottom < 0) return;
      targetX = e.clientX / window.innerWidth  - 0.5;
      targetY = e.clientY / window.innerHeight - 0.5;

      if (cursorLight) {
        gsap.to(cursorLight, {
          x: e.clientX, y: e.clientY,
          duration: 1.2,
          ease: 'power2.out',
        });
      }
    }, { passive: true });

    gsap.ticker.add(() => {
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;

      const rx = currentY * 3;
      const ry = -currentX * 5;

      if (textGroup) {
        gsap.set(textGroup, {
          x: currentX * -12,
          y: currentY * -8,
          rotateX: rx * 0.4,
          rotateY: ry * 0.4,
          transformPerspective: 1200,
        });
      }

      if (glassPanel) {
        gsap.set(glassPanel, {
          x: currentX * 18,
          y: currentY * 12,
          rotateX: rx * 0.8,
          rotateY: ry * 0.8,
          transformPerspective: 1200,
        });
      }
    });
  }

  /* ------------------------------------------------------------------
     04. TIMECODE ANIMATION (decorative)
     ------------------------------------------------------------------ */
  function initTimecode() {
    const timecodeEl = document.getElementById('eu-timecode');
    const frameEl    = document.getElementById('eu-frame');
    if (!timecodeEl && !frameEl) return;

    let frame = 1;
    setInterval(() => {
      frame++;
      if (frame > 9999) frame = 1;
      const h  = 0;
      const m  = Math.floor(frame / 1800) % 60;
      const s  = Math.floor(frame / 30) % 60;
      const f  = frame % 30;
      const tc = [h, m, s, f].map(n => String(n).padStart(2, '0')).join(':');
      if (timecodeEl) timecodeEl.textContent = tc;
      if (frameEl)    frameEl.textContent = 'FRAME ' + String(frame).padStart(4, '0');
    }, 1000 / 30);
  }

  /* ------------------------------------------------------------------
     05. NAVIGATION — SCROLL GLASS EFFECT + ACTIVE SECTION
     ------------------------------------------------------------------ */
  function initNav() {
    const header       = document.getElementById('site-header');
    const navLinks     = document.querySelectorAll('.nav-link[data-section]');
    const mobileToggle = document.getElementById('mobile-toggle');
    const mobileMenu   = document.getElementById('mobile-menu');
    const mobileLinks  = document.querySelectorAll('.mobile-nav-link');

    if (!header) return;

    // Scroll → glass header
    ScrollTrigger.create({
      start: '80px top',
      onEnter:     () => header.classList.add('scrolled'),
      onLeaveBack: () => header.classList.remove('scrolled'),
    });

    // Active nav link
    const sections = document.querySelectorAll('section[id]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
          navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.section === entry.target.id);
          });
        }
      });
    }, { threshold: 0.3 });

    sections.forEach(s => observer.observe(s));

    // Mobile menu toggle
    if (mobileToggle && mobileMenu) {
      function toggleMenu(open) {
        mobileToggle.classList.toggle('open', open);
        mobileMenu.classList.toggle('open', open);
        mobileMenu.setAttribute('aria-hidden', String(!open));
        mobileToggle.setAttribute('aria-expanded', String(open));
        if (lenis) {
          open ? lenis.stop() : lenis.start();
        }
      }

      mobileToggle.addEventListener('click', () => {
        toggleMenu(!mobileMenu.classList.contains('open'));
      });

      mobileLinks.forEach(link => {
        link.addEventListener('click', () => toggleMenu(false));
      });
    }

    // Anchor link smooth scroll using Lenis
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (!targetId || targetId === '#') return;
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          if (lenis) {
            lenis.scrollTo(targetEl, { offset: 0 });
          } else {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });
  }

  /* ------------------------------------------------------------------
     06. SCROLL REVEAL — STAGGERED SECTIONS
     ------------------------------------------------------------------ */
  function initScrollReveals() {
    if (prefersReducedMotion) return;

    gsap.from('.narrative-card', {
      scrollTrigger: { trigger: '.narrative-grid', start: 'top 80%' },
      y: 60, opacity: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out',
    });

    document.querySelectorAll('.section-heading').forEach(el => {
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: 'top 85%' },
        y: 40, opacity: 0, duration: 0.7, ease: 'power3.out',
      });
    });

    gsap.from('.about-lead', {
      scrollTrigger: { trigger: '.about-lead', start: 'top 85%' },
      y: 30, opacity: 0, duration: 0.6, ease: 'power3.out',
    });

    gsap.from('.about-body', {
      scrollTrigger: { trigger: '.about-body', start: 'top 88%' },
      y: 24, opacity: 0, duration: 0.6, ease: 'power3.out', delay: 0.1,
    });

    gsap.from('.pillar-item', {
      scrollTrigger: { trigger: '.about-pillars', start: 'top 85%' },
      y: 30, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power3.out',
    });

    gsap.from('.about-side > *', {
      scrollTrigger: { trigger: '.about-side', start: 'top 85%' },
      y: 30, opacity: 0, duration: 0.6, stagger: 0.15, ease: 'power3.out',
    });

    gsap.from('.skill-card', {
      scrollTrigger: { trigger: '.skills-grid', start: 'top 80%' },
      y: 50, opacity: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out',
    });

    gsap.from('.web-feature-card', {
      scrollTrigger: { trigger: '.web-features-grid', start: 'top 80%' },
      y: 40, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out',
    });

    gsap.from('.web-service-item', {
      scrollTrigger: { trigger: '.web-service-list', start: 'top 80%' },
      x: -30, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out',
    });

    const contactHls = document.querySelectorAll('.contact-hl');
    if (contactHls.length > 0) {
      gsap.fromTo(contactHls,
        { y: 40, opacity: 0 },
        {
          scrollTrigger: {
            trigger: '#contact-big-text',
            start: 'top 85%',
            once: true,
          },
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power3.out',
          onComplete: () => {
            gsap.set(contactHls, { clearProps: 'transform,opacity' });
          }
        }
      );
    }

    gsap.from('.contact-box', {
      scrollTrigger: { trigger: '.contact-cta-col', start: 'top 80%' },
      y: 30, opacity: 0, duration: 0.6, stagger: 0.12, ease: 'power3.out',
    });

    gsap.to('.about-bg-text', {
      scrollTrigger: {
        trigger: '.about-section',
        start: 'top bottom', end: 'bottom top',
        scrub: 1.5,
      },
      y: -80, ease: 'none',
    });

    gsap.to('.philosophy-bg-text', {
      scrollTrigger: {
        trigger: '.philosophy-section',
        start: 'top bottom', end: 'bottom top',
        scrub: 1.5,
      },
      y: -60, ease: 'none',
    });
  }

  /* ------------------------------------------------------------------
     07. PHILOSOPHY QUOTE — BLUR-IN ON SCROLL
     ------------------------------------------------------------------ */
  function initPhilosophyAnimation() {
    if (prefersReducedMotion) return;

    const quote  = document.getElementById('philosophy-quote');
    const author = document.querySelector('.philosophy-author');
    if (!quote) return;

    gsap.set([quote, author].filter(Boolean), { opacity: 0, filter: 'blur(16px)', scale: 0.95 });

    gsap.to([quote, author].filter(Boolean), {
      scrollTrigger: {
        trigger: '.philosophy-section',
        start: 'top 70%', end: 'center 50%',
        scrub: 1.2,
      },
      opacity: 1, filter: 'blur(0px)', scale: 1,
      ease: 'none', stagger: 0.05,
    });
  }

  /* ------------------------------------------------------------------
     08. WEB DESIGN — PRICE PANEL 3D TILT
     ------------------------------------------------------------------ */
  function initPricePanelTilt() {
    if (isTouch() || prefersReducedMotion) return;

    const panel = document.getElementById('price-panel');
    const shine = panel ? panel.querySelector('.price-panel-shine') : null;
    if (!panel) return;

    panel.addEventListener('mousemove', (e) => {
      const rect = panel.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width  - 0.5;
      const y = (e.clientY - rect.top)  / rect.height - 0.5;

      gsap.to(panel, {
        rotateX: -y * 12, rotateY: x * 12,
        transformPerspective: 900,
        duration: 0.25, ease: 'power2.out',
      });

      if (shine) {
        const px = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
        const py = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
        shine.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(201,169,110,0.18) 0%, transparent 60%)`;
        gsap.to(shine, { opacity: 1, duration: 0.2 });
      }
    });

    panel.addEventListener('mouseleave', () => {
      gsap.to(panel, { rotateX: 0, rotateY: 0, duration: 0.5, ease: 'power3.out' });
      if (shine) gsap.to(shine, { opacity: 0, duration: 0.3 });
    });
  }

  /* ------------------------------------------------------------------
     09. PROCESS TIMELINE ANIMATION
     ------------------------------------------------------------------ */
  function initProcessTimeline() {
    if (prefersReducedMotion) return;

    const steps   = document.querySelectorAll('.process-step');
    const fill    = document.getElementById('process-track-fill');
    const section = document.getElementById('process-timeline');
    if (!section || steps.length === 0) return;

    steps.forEach((step, i) => {
      ScrollTrigger.create({
        trigger: section,
        start: `top ${80 - i * 15}%`,
        onEnter:     () => step.classList.add('active'),
        onLeaveBack: () => step.classList.remove('active'),
      });
    });

    if (fill) {
      gsap.to(fill, {
        width: '100%',
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top 70%', end: 'top 30%',
          scrub: 1,
        }
      });
    }
  }

  /* ------------------------------------------------------------------
     10. VIDEO GALLERY — HORIZONTAL SCROLL (desktop only)

     FIX #3 + #4 (were root causes):
      - Old code: `setTimeout(setupScroll, 100)` inside boot() which
        runs at DOMContentLoaded. Images not loaded → track.scrollWidth
        is wrong → pin starts at wrong scroll offset (sometimes 0) →
        pin is active from the very top of the page → every wheel tick
        goes into horizontal gallery movement instead of page scrolling.

      - Fix: initGalleryScroll() now registers a one-shot window 'load'
        listener. At that point all images are decoded and the layout is
        stable. We then call ScrollTrigger.refresh() to ensure all
        positions are recalculated BEFORE setting up the pin.
        No setTimeout anywhere.

     SCROLL ARCHITECTURE:
      - Outside the gallery pin: Lenis receives wheel → native scrollY
        increases → ScrollTrigger.update() → animations progress.
        Normal vertical scroll in every other section.
      - When the pin IS active (user is inside the gallery section):
        ScrollTrigger consumes scroll progress to advance horizontal
        translation, then releases the pin and resumes vertical scroll.
      - Mobile (≤767px): this function returns early. The gallery uses
        CSS overflow-x: auto + scroll-snap for native touch scroll.
     ------------------------------------------------------------------ */
  let galleryScrollTrigger = null;

  function setupGalleryScroll() {
    if (isMobile() || prefersReducedMotion) return;

    const section = document.getElementById('gallery');
    const track   = document.getElementById('gallery-track');
    if (!section || !track) return;

    // Kill any existing instance before measuring
    if (galleryScrollTrigger) {
      galleryScrollTrigger.kill();
      galleryScrollTrigger = null;
      gsap.set(track, { x: 0 });
    }

    const getScrollDist = () => Math.max(0, track.scrollWidth - window.innerWidth);

    if (getScrollDist() < 50) return;

    const anim = gsap.to(track, {
      x: () => -getScrollDist(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        pin: true,
        pinSpacing: true,
        scrub: 1,
        start: 'top top',
        end: () => `+=${getScrollDist()}`,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      }
    });

    // Store reference so we can kill on resize
    galleryScrollTrigger = anim.scrollTrigger;
  }

  function initGalleryScroll() {
    if (isMobile() || prefersReducedMotion) return;

    setupGalleryScroll();

    if (document.readyState === 'complete') {
      ScrollTrigger.refresh();
    } else {
      window.addEventListener('load', () => {
        setupGalleryScroll();
        ScrollTrigger.refresh();
      }, { once: true });
    }
  }

  /* ------------------------------------------------------------------
     11. VIDEO GALLERY — CARD HOVER 3D TILT
     ------------------------------------------------------------------ */
  function initGalleryCardTilt() {
    if (isTouch() || prefersReducedMotion) return;

    document.querySelectorAll('.video-gallery-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width  - 0.5;
        const y = (e.clientY - rect.top)  / rect.height - 0.5;
        gsap.to(card, {
          rotateX: -y * 8, rotateY: x * 8,
          transformPerspective: 800,
          duration: 0.2, ease: 'power2.out',
        });
      });

      card.addEventListener('mouseleave', () => {
        gsap.to(card, {
          rotateX: 0, rotateY: 0,
          duration: 0.5, ease: 'power3.out',
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     12. VIDEO LIGHTBOX
     ------------------------------------------------------------------ */
  function initLightbox() {
    const lightbox = document.getElementById('video-lightbox');
    const backdrop = document.getElementById('lightbox-backdrop');
    const closeBtn = document.getElementById('lightbox-close');
    const video    = document.getElementById('lightbox-video');
    const counter  = document.getElementById('lightbox-counter');
    const metaEl   = document.getElementById('lightbox-meta');
    const titleEl  = document.getElementById('lightbox-title');
    const cards    = document.querySelectorAll('.video-gallery-card');

    if (!lightbox || !video) return;

    function openLightbox(card) {
      video.src = card.dataset.video || '';
      if (metaEl)   metaEl.textContent   = card.dataset.meta   || '';
      if (titleEl)  titleEl.textContent  = card.dataset.title  || '';
      if (counter)  counter.textContent  = card.dataset.number || '';

      lightbox.setAttribute('aria-hidden', 'false');
      lightbox.classList.add('open');
      if (lenis) lenis.stop();

      video.load();
      video.play().catch(() => {});
      closeBtn && closeBtn.focus();
    }

    function closeLightbox() {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      if (lenis) lenis.start();
      video.pause();
      video.src = '';
    }

    cards.forEach(card => {
      card.addEventListener('click', () => openLightbox(card));
    });

    backdrop && backdrop.addEventListener('click', closeLightbox);
    closeBtn  && closeBtn.addEventListener('click', closeLightbox);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
    });
  }

  /* ------------------------------------------------------------------
     13. SKILL CARDS — 3D TILT + SHINE
     ------------------------------------------------------------------ */
  function initSkillCards() {
    if (isTouch() || prefersReducedMotion) return;

    document.querySelectorAll('.skill-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top)  / rect.height;
        card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
        gsap.to(card, {
          rotateX: (y - 0.5) * -14,
          rotateY: (x - 0.5) *  14,
          transformPerspective: 900,
          duration: 0.2, ease: 'power2.out',
        });
      });

      card.addEventListener('mouseleave', () => {
        gsap.to(card, {
          rotateX: 0, rotateY: 0,
          duration: 0.5, ease: 'power3.out',
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     14. MAGNETIC BUTTONS
     ------------------------------------------------------------------ */
  function initMagneticButtons() {
    if (isTouch() || prefersReducedMotion) return;

    document.querySelectorAll('.magnetic-btn').forEach(btn => {
      const inner = btn.querySelector('span') || btn;

      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const dx = (e.clientX - (rect.left + rect.width  / 2)) * 0.35;
        const dy = (e.clientY - (rect.top  + rect.height / 2)) * 0.35;
        gsap.to(btn, { x: dx, y: dy, duration: 0.3, ease: 'power2.out' });
        if (inner !== btn) gsap.to(inner, { x: dx * 0.4, y: dy * 0.4, duration: 0.3, ease: 'power2.out' });
      });

      btn.addEventListener('mouseleave', () => {
        gsap.to(btn,   { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
        if (inner !== btn) gsap.to(inner, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
      });
    });
  }

  /* ------------------------------------------------------------------
     15. EMAIL COPY
     ------------------------------------------------------------------ */
  function initEmailCopy() {
    const btn   = document.getElementById('copy-email-btn');
    const label = document.getElementById('copy-btn-text');
    const toast = document.getElementById('toast-notification');
    if (!btn) return;

    const EMAIL = 'info@d6mediastudio.in';

    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(EMAIL);
      } catch {
        // Fallback
        const el = document.getElementById('email-address');
        if (el) {
          const r = document.createRange();
          r.selectNode(el);
          window.getSelection().removeAllRanges();
          window.getSelection().addRange(r);
          document.execCommand('copy');
          window.getSelection().removeAllRanges();
        }
      }

      if (label) label.textContent = 'Copied!';
      if (toast) {
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
      }
      setTimeout(() => { if (label) label.textContent = 'Copy Email'; }, 2000);
    });
  }

  /* ------------------------------------------------------------------
     16. WD INTRO REVEAL
     ------------------------------------------------------------------ */
  function initWDReveal() {
    if (prefersReducedMotion) return;

    gsap.from('.wd-kicker', {
      scrollTrigger: { trigger: '.wd-intro-text', start: 'top 80%' },
      opacity: 0, y: 20, duration: 0.5, ease: 'power3.out',
    });

    gsap.from('.wd-h3', {
      scrollTrigger: { trigger: '.wd-intro-text', start: 'top 80%' },
      opacity: 0, y: 30, duration: 0.6, ease: 'power3.out', delay: 0.1,
    });

    gsap.from('.wd-body', {
      scrollTrigger: { trigger: '.wd-intro-text', start: 'top 80%' },
      opacity: 0, y: 24, duration: 0.5, ease: 'power3.out', delay: 0.2,
    });

    gsap.from('.price-panel', {
      scrollTrigger: { trigger: '.wd-intro-layout', start: 'top 80%' },
      opacity: 0, y: 40, duration: 0.8, ease: 'power3.out', delay: 0.15,
    });
  }

  /* ------------------------------------------------------------------
     17. HERO ENTRANCE (after intro fades)
     ------------------------------------------------------------------ */
  function initHeroEntrance() {
    if (prefersReducedMotion) return;

    const targets = [
      document.querySelector('.hero-kicker'),
      document.getElementById('hero-line-1'),
      document.getElementById('hero-line-2'),
      document.querySelector('.hero-tagline-row'),
      document.getElementById('hero-glass-panel'),
      document.querySelector('.hero-scroll'),
    ].filter(Boolean);

    gsap.set(targets, { opacity: 0, y: 30 });

    // Delay matches intro duration (~1.65 s)
    gsap.to(targets, {
      opacity: 1, y: 0,
      duration: 0.8,
      stagger: 0.1,
      ease: 'power3.out',
      delay: 1.65,
    });
  }

  /* ------------------------------------------------------------------
     18. GALLERY SCROLL HINT
     ------------------------------------------------------------------ */
  function initGalleryHint() {
    const hint = document.getElementById('gallery-scroll-hint');
    if (!hint) return;

    ScrollTrigger.create({
      trigger: '#gallery',
      start: 'top top',
      onEnter:     () => gsap.to(hint, { opacity: 0, duration: 0.4 }),
      onLeaveBack: () => gsap.to(hint, { opacity: 0.7, duration: 0.4 }),
    });
  }

  /* ------------------------------------------------------------------
     19. SECTION SEPARATOR ANIMATION
     ------------------------------------------------------------------ */
  function initSeparators() {
    if (prefersReducedMotion) return;

    document.querySelectorAll('.section-sep').forEach(sep => {
      const line = sep.querySelector('.sep-line');
      if (!line) return;
      gsap.from(line, {
        scrollTrigger: { trigger: sep, start: 'top 90%' },
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 0.8,
        ease: 'power3.out',
      });
    });
  }

  /* ------------------------------------------------------------------
     20. WINDOW RESIZE — KILL + REBUILD GALLERY, REFRESH SCROLLTRIGGER
     ------------------------------------------------------------------ */
  function initResizeHandler() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // On desktop ↔ mobile breakpoint switch, rebuild gallery scroll
        if (!isMobile() && !prefersReducedMotion) {
          setupGalleryScroll();
        } else if (isMobile() && galleryScrollTrigger) {
          galleryScrollTrigger.kill();
          galleryScrollTrigger = null;
          gsap.set('#gallery-track', { x: 0 });
        }
        ScrollTrigger.refresh();
      }, 250);
    });
  }

  /* ------------------------------------------------------------------
     BOOT SEQUENCE
     Order matters:
      1. Lenis first — must be running before any ScrollTrigger.update
      2. Intro — visual only, never blocks body scroll anymore
      3. Hero entrance animations
      4. All ScrollTrigger-based animations
      5. initGalleryScroll — deferred to window.load inside the function
      6. Interaction layers (cursor, tilt, magnetic)
     ------------------------------------------------------------------ */
  function boot() {
    // 1. Smooth scroll engine (uses RAF, not gsap.ticker)
    initLenis();

    // 2. Intro overlay (does NOT set body overflow)
    initIntro();

    // 3. Hero
    initHeroEntrance();
    initHeroParallax();
    initHeroVideo();
    initTimecode();

    // 4. Navigation
    initNav();

    // 5. All scroll-driven animations
    initScrollReveals();
    initPhilosophyAnimation();
    initProcessTimeline();
    initGalleryHint();
    initSeparators();

    // 6. Gallery horizontal scroll (waits for window.load internally)
    initGalleryScroll();

    // 7. Interaction layers
    initCursor();
    initGalleryCardTilt();
    initLightbox();
    initSkillCards();
    initMagneticButtons();
    initEmailCopy();
    initWDReveal();
    initPricePanelTilt();

    // 8. Resize handler (also manages gallery rebuild)
    initResizeHandler();

    // 9. Ensure text editing & blinking carets are strictly disabled
    initTextEditingPrevention();
  }

  /* ------------------------------------------------------------------
     21. PREVENT ACCIDENTAL TEXT EDITING & CARET INSERTION
     ------------------------------------------------------------------ */
  function initTextEditingPrevention() {
    try {
      if (document.designMode && document.designMode.toLowerCase() === 'on') {
        document.designMode = 'off';
      }
    } catch {}

    document.querySelectorAll('[contenteditable]').forEach(el => {
      el.removeAttribute('contenteditable');
      try { el.contentEditable = 'false'; } catch {}
    });

    // Blur focus on click for non-form elements to prevent text-caret insertion
    document.addEventListener('mousedown', (e) => {
      const isInput = e.target.closest('input, textarea, select, [contenteditable="true"]');
      if (!isInput && document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
    }, { passive: true });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
