/* ==========================================================================
   AQUA ARCHITECTURE — Interaction layer
   Vanilla JS only. No external dependencies.
   ========================================================================== */

(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouchDevice = window.matchMedia('(hover: none)').matches;
  var isNarrowViewport = window.matchMedia('(max-width: 880px)').matches;

  /* ------------------------------------------------------------------------
     Preloader
     ------------------------------------------------------------------------ */
  function initPreloader() {
    var preloader = document.querySelector('[data-preloader]');
    if (!preloader) return;

    var root = document.documentElement;
    root.classList.add('is-preloading');

    var minVisible = prefersReducedMotion ? 200 : 1100;
    var maxWait = prefersReducedMotion ? 200 : 2600;
    var startTime = Date.now();
    var finished = false;

    function fill() {
      requestAnimationFrame(function () {
        root.classList.add('is-preloader-filled');
      });
    }

    function finish() {
      if (finished) return;
      finished = true;
      var elapsed = Date.now() - startTime;
      var wait = Math.max(minVisible - elapsed, 0);
      setTimeout(function () {
        preloader.classList.add('is-done');
        root.classList.remove('is-preloading');
        setTimeout(function () {
          if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
        }, prefersReducedMotion ? 0 : 950);
      }, wait);
    }

    fill();

    // Safety net: never let the preloader block the page for long.
    setTimeout(finish, maxWait);

    var heroImg = document.querySelector('[data-hero-image]');
    if (!heroImg) {
      finish();
      return;
    }
    if (heroImg.complete && heroImg.naturalWidth > 0) {
      finish();
    } else {
      heroImg.addEventListener('load', finish, { once: true });
      heroImg.addEventListener('error', finish, { once: true });
    }
  }

  /* ------------------------------------------------------------------------
     Header: scrolled state + mobile nav toggle
     ------------------------------------------------------------------------ */
  function initHeader() {
    var header = document.querySelector('[data-header]');
    if (!header) return;

    var lastState = false;
    function onScroll() {
      var scrolled = window.scrollY > 12;
      if (scrolled !== lastState) {
        header.classList.toggle('is-scrolled', scrolled);
        lastState = scrolled;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var toggle = document.querySelector('[data-nav-toggle]');
    var mobileNav = document.querySelector('[data-mobile-nav]');
    if (!toggle || !mobileNav) return;

    function closeNav() {
      toggle.setAttribute('aria-expanded', 'false');
      mobileNav.classList.remove('is-open');
      header.classList.remove('nav-open');
      document.body.style.overflow = '';
    }

    function openNav() {
      toggle.setAttribute('aria-expanded', 'true');
      mobileNav.classList.add('is-open');
      header.classList.add('nav-open');
      document.body.style.overflow = 'hidden';
    }

    toggle.addEventListener('click', function () {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      if (expanded) { closeNav(); } else { openNav(); }
    });

    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeNav);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });
  }

  /* ------------------------------------------------------------------------
     Hero: Luxury Reveal orchestration
     Image loads first, then typography, then CTA (handled via CSS
     transition-delay once .is-revealed is applied; this just triggers it
     at the right moment relative to image load).
     ------------------------------------------------------------------------ */
  function initHeroReveal() {
    var hero = document.querySelector('.hero');
    var heroMediaWrap = document.querySelector('[data-hero-image]');
    if (!hero || !heroMediaWrap) return;

    var mediaContainer = heroMediaWrap.closest('.hero-media');

    function reveal() {
      mediaContainer.classList.add('is-loaded');
      window.requestAnimationFrame(function () {
        setTimeout(function () {
          hero.classList.add('is-revealed');
        }, prefersReducedMotion ? 0 : 120);
      });
    }

    if (heroMediaWrap.complete && heroMediaWrap.naturalWidth > 0) {
      reveal();
    } else {
      heroMediaWrap.addEventListener('load', reveal, { once: true });
      // Fallback in case the load event is missed (cache edge-cases)
      setTimeout(reveal, 2200);
    }
  }

  /* ------------------------------------------------------------------------
     Generic scroll reveal via IntersectionObserver
     ------------------------------------------------------------------------ */
  function initScrollReveal() {
    var targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -60px 0px' });

    targets.forEach(function (el) {
      // Hero items are orchestrated separately by initHeroReveal
      if (el.closest('.hero')) return;
      observer.observe(el);
    });
  }

  /* ------------------------------------------------------------------------
     Architectural scroll: gentle parallax on select large images
     (rAF-throttled, transform-only, disabled on touch/reduced motion)
     ------------------------------------------------------------------------ */
  function initParallax() {
    if (prefersReducedMotion || isTouchDevice) return;

    var els = Array.prototype.slice.call(document.querySelectorAll('[data-parallax-slow]'));
    if (!els.length) return;

    var ticking = false;
    var amplitude = 22; // px, within the 10-30px range specified

    function update() {
      var vh = window.innerHeight;
      els.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        var progress = (rect.top + rect.height / 2 - vh / 2) / vh; // -ish range
        var offset = Math.max(-1, Math.min(1, progress)) * amplitude;
        el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
      });
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* ------------------------------------------------------------------------
     Magnetic CTA buttons (desktop only)
     ------------------------------------------------------------------------ */
  function initMagneticButtons() {
    if (prefersReducedMotion || isTouchDevice || isNarrowViewport) return;

    var buttons = document.querySelectorAll('.btn-primary, .btn-outline');
    var maxMove = 7;

    buttons.forEach(function (btn) {
      var raf = null;

      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        var relX = e.clientX - rect.left - rect.width / 2;
        var relY = e.clientY - rect.top - rect.height / 2;
        var moveX = Math.max(-maxMove, Math.min(maxMove, relX * 0.28));
        var moveY = Math.max(-maxMove, Math.min(maxMove, relY * 0.28));

        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          btn.style.transform = 'translate(' + moveX.toFixed(1) + 'px,' + moveY.toFixed(1) + 'px)';
        });
      });

      btn.addEventListener('mouseleave', function () {
        if (raf) cancelAnimationFrame(raf);
        btn.style.transform = 'translate(0,0)';
      });
    });
  }

  /* ------------------------------------------------------------------------
     Cursor glow (subtle, desktop only, decorative)
     ------------------------------------------------------------------------ */
  function initCursorGlow() {
    if (prefersReducedMotion || isTouchDevice || isNarrowViewport) return;

    var glow = document.querySelector('.cursor-glow');
    if (!glow) return;

    var raf = null;
    var active = false;

    document.addEventListener('mousemove', function (e) {
      if (!active) {
        glow.classList.add('is-active');
        active = true;
      }
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        glow.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px) translate(-50%,-50%)';
      });
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
      glow.classList.remove('is-active');
      active = false;
    });
  }

  /* ------------------------------------------------------------------------
     Before / After slider
     ------------------------------------------------------------------------ */
  function initBeforeAfter() {
    var slider = document.querySelector('[data-ba-slider]');
    if (!slider) return;

    var before = slider.querySelector('[data-ba-before]');
    var handle = slider.querySelector('[data-ba-handle]');
    var range = slider.querySelector('[data-ba-range]');

    function setPosition(percent) {
      percent = Math.max(0, Math.min(100, percent));
      before.style.clipPath = 'inset(0 ' + (100 - percent) + '% 0 0)';
      handle.style.left = percent + '%';
      range.value = percent;
    }

    // Pointer drag across the whole slider
    var dragging = false;

    function percentFromClientX(clientX) {
      var rect = slider.getBoundingClientRect();
      var x = clientX - rect.left;
      return (x / rect.width) * 100;
    }

    slider.addEventListener('pointerdown', function (e) {
      dragging = true;
      slider.setPointerCapture(e.pointerId);
      setPosition(percentFromClientX(e.clientX));
    });

    slider.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      setPosition(percentFromClientX(e.clientX));
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (evt) {
      slider.addEventListener(evt, function () { dragging = false; });
    });

    // Keyboard / range input accessibility
    range.addEventListener('input', function () {
      setPosition(parseFloat(range.value));
    });

    setPosition(50);
  }

  /* ------------------------------------------------------------------------
     Request form: lightweight client-side handling
     (no backend wired up — demonstrates full interaction pattern)
     ------------------------------------------------------------------------ */
  function initRequestForm() {
    var form = document.querySelector('[data-request-form]');
    if (!form) return;

    var status = form.querySelector('[data-form-status]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = form.querySelector('#f-name');
      var phone = form.querySelector('#f-phone');

      if (!name.value.trim() || !phone.value.trim()) {
        status.textContent = 'Пожалуйста, укажите имя и телефон для связи.';
        status.className = 'form-status is-error';
        (name.value.trim() ? phone : name).focus();
        return;
      }

      var submitBtn = form.querySelector('.form-submit');
      var originalLabel = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправляем…';

      // No backend endpoint is connected in this build. Simulate the
      // network round-trip so the interaction pattern is complete and
      // ready to be wired to a real endpoint.
      setTimeout(function () {
        status.textContent = 'Спасибо! Мы свяжемся с вами в ближайшее время.';
        status.className = 'form-status is-success';
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
        form.reset();
      }, 700);
    });
  }

  /* ------------------------------------------------------------------------
     Smooth scroll for in-page anchor links (respects reduced motion
     via the CSS `scroll-behavior` rule, this just handles the header offset)
     ------------------------------------------------------------------------ */
  function initSmoothAnchors() {
    var header = document.querySelector('.site-header');
    var headerHeight = header ? header.offsetHeight : 0;

    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('href');
        if (!id || id === '#') return;
        var target = document.querySelector(id);
        if (!target) return;

        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.pageYOffset - headerHeight + 1;
        window.scrollTo({ top: top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });

        // Move focus for accessibility after the scroll settles
        setTimeout(function () {
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }, prefersReducedMotion ? 0 : 500);
      });
    });
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  function init() {
    initHeader();
    initHeroReveal();
    initScrollReveal();
    initParallax();
    initMagneticButtons();
    initCursorGlow();
    initBeforeAfter();
    initRequestForm();
    initSmoothAnchors();
  }

  initPreloader();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
