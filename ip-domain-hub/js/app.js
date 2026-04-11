/* ════════════════════════════════════════════════════════════════════════════
   app.js — Application bootstrap & shared utilities
   ─────────────────────────────────────────────────────────────────────────────
   Responsibilities:
     - Page initialisation (runs on DOMContentLoaded)
     - Dark / light theme toggle with localStorage persistence
     - Sticky navigation scroll behaviour
     - Mobile hamburger menu
     - Smooth scroll helper used by tool cards
     - Toast notification system (showToast)
   ════════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── Theme ────────────────────────────────────────────────────────────────────

/**
 * Apply a theme ('dark' or 'light') to the <html> element and persist it.
 * @param {'dark'|'light'} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ipdh-theme', theme);
}

/** Toggle between dark and light mode. */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/** Load saved theme from localStorage or default to dark. */
function initTheme() {
  const saved = localStorage.getItem('ipdh-theme');
  applyTheme(saved === 'light' ? 'light' : 'dark');
}


// ─── Navigation ───────────────────────────────────────────────────────────────

/** Add/remove .scrolled class to the nav when the user scrolls past the hero. */
function initNavScroll() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on init
}

/** Wire up the mobile hamburger menu toggle. */
function initHamburger() {
  const btn   = document.getElementById('nav-hamburger');
  const links = document.getElementById('nav-links');
  if (!btn || !links) return;

  btn.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });

  // Close menu when a nav link is clicked
  links.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      links.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
}

/**
 * Smooth-scroll to a CSS selector target.
 * Accounts for the sticky nav height so the section title isn't hidden.
 * @param {string} selector  e.g. '#ip-checker'
 */
function smoothScrollTo(selector) {
  const target = document.querySelector(selector);
  if (!target) return;
  const navH   = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 60;
  const offset = target.getBoundingClientRect().top + window.scrollY - navH - 16;
  window.scrollTo({ top: offset, behavior: 'smooth' });
}


// ─── Toast Notification ───────────────────────────────────────────────────────

let _toastTimer = null;

/**
 * Display a brief toast notification.
 * @param {string}               message  Text to display
 * @param {'pass'|'warning'|'fail'|'info'} type  Determines border colour
 * @param {number}               duration  ms before auto-dismiss (default 3500)
 */
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // Clear any existing timeout
  if (_toastTimer) { clearTimeout(_toastTimer); }

  toast.textContent = message;
  toast.className   = `toast toast-${type} show`;

  _toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}


// ─── Intersection Observer for section entry animations ───────────────────────

function initScrollAnimations() {
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  // Apply subtle fade-in to tool cards and integration cards
  document.querySelectorAll('.tool-card, .integration-card, .stat-card').forEach(el => {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(16px)';
    el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    observer.observe(el);
  });
}


// ─── DOMContentLoaded — initialise everything ────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // 1. Restore saved theme
  initTheme();

  // 2. Wire up theme toggle button
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // 3. Navigation behaviours
  initNavScroll();
  initHamburger();

  // 4. Scroll animations
  initScrollAnimations();

  // 5. Initialise phone form datetime to "now"
  if (typeof initPhoneDatetime === 'function') initPhoneDatetime();

  // 6. Initial dashboard render (empty state)
  if (typeof renderDashboard === 'function') renderDashboard();

  // 7. Render phone log (empty state)
  if (typeof renderPhoneLog === 'function') renderPhoneLog();

  // 8. Initial hero counter reset
  if (typeof refreshHeroStats === 'function') refreshHeroStats();
});
