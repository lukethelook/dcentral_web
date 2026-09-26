/**
 * dcentral motion system — built on Motion (motion.dev, the Framer Motion engine).
 * Loaded on every page. Respects the brand rules in docs/brand/DESIGN.md:
 * text is never hidden before JS runs, nothing hijacks the wheel, the global
 * pause and prefers-reduced-motion switch everything to instant states.
 */
import { animate, inView, stagger } from 'motion';

// Codebase token: --ease / --ease-out = cubic-bezier(.23,1,.32,1).
const EASE_OUT = [0.23, 1, 0.32, 1];
// Strong ease-in-out for on-screen movement (scroll travel).
const EASE_IN_OUT = [0.77, 0, 0.175, 1];

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
let paused = reduced.matches || root.classList.contains('motion-paused');
const canMove = () => !paused && !reduced.matches;
document.addEventListener('motion-state', (e) => { paused = e.detail.paused; if (paused) revealAll(); });
reduced.addEventListener('change', () => { if (reduced.matches) revealAll(); });

const setStyles = (el, s) => Object.assign(el.style, s);
const clear = (el) => { el.style.opacity = ''; el.style.transform = ''; el.style.clipPath = ''; };

/* ── 1 · Scroll reveals ──────────────────────────────────────────────────
   Marketing tier, seen once per visit. Elements already on screen at load stay
   untouched; everything below is prepared by JS only (no JS = fully visible). */
const REVEAL = [
  // [selector, mode]  mode: false = element itself · 'clip' = image wipe · else = staggered children
  ['.manifest-bottom > p', false],
  ['.services .section-title', false],
  ['.discipline-stage', false],
  ['.work-heading h2', false],
  ['.gallery', '.project'],
  ['.studio-visual', 'clip'],
  ['.studio-copy', ':scope > *'],
  ['.impact-grid > div:first-child', false],
  ['.impact-offers', ':scope > *'],
  ['.impact-steps', ':scope > li'],
  ['.region h2', false],
  ['.client-list', ':scope > span'],
  ['.stats', ':scope > div'],
  ['.process h2', false],
  ['.steps', ':scope > li'],
  ['.faq-heading', false],
  ['.faq-list', ':scope > details'],
  ['.contact h2, .contact-mail', false],
  ['.contact-grid', ':scope > div'],
  // Subpages (.case-visual is deliberately absent: it enters via the shared-element transition)
  ['.case-body > div, .case-meta', false],
  ['.legal h2, .legal h2 + p', false],
];
const HIDDEN = { opacity: '0', transform: 'translateY(22px)' };
const pending = new Map();

const onScreen = (el) => {
  const r = el.getBoundingClientRect();
  return r.top < innerHeight && r.bottom > 0;
};
const parts = (el, mode) => (mode && mode !== 'clip' ? [...el.querySelectorAll(mode)] : [el]);

function prepare(el, mode) {
  if (mode === 'clip') {
    el.style.clipPath = 'inset(100% 0 0 0)';
    const img = el.querySelector('img');
    if (img) img.style.transform = 'scale(1.08)';
  } else {
    parts(el, mode).forEach((p) => setStyles(p, HIDDEN));
  }
}

function play(el, mode) {
  pending.delete(el);
  if (!canMove()) return finish(el, mode);
  if (mode === 'clip') {
    animate(el, { clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'] }, { duration: 1.1, ease: EASE_OUT })
      .then(() => { el.style.clipPath = ''; });
    const img = el.querySelector('img');
    if (img) animate(img, { transform: ['scale(1.08)', 'scale(1)'] }, { duration: 1.4, ease: EASE_OUT })
      .then(() => { img.style.transform = ''; });
    return;
  }
  const targets = parts(el, mode); // queried now: includes gallery loop copies built meanwhile
  animate(targets, { opacity: [0, 1], transform: ['translateY(22px)', 'translateY(0px)'] },
    { duration: 0.8, ease: EASE_OUT, delay: stagger(mode ? 0.06 : 0) })
    .then(() => targets.forEach(clear));
}

function finish(el, mode) {
  pending.delete(el);
  clear(el);
  if (mode === 'clip') el.querySelectorAll('img').forEach((i) => { i.style.transform = ''; });
  else parts(el, mode).forEach(clear);
}
function revealAll() { [...pending].forEach(([el, mode]) => finish(el, mode)); }

if (canMove()) {
  for (const [selector, mode] of REVEAL) {
    document.querySelectorAll(selector).forEach((el) => {
      if (onScreen(el)) return;
      prepare(el, mode);
      pending.set(el, mode);
      inView(el, () => { play(el, mode); }, { amount: 0.15, margin: '0px 0px -8% 0px' });
    });
  }
}

/* ── 2 · Smooth anchor travel ────────────────────────────────────────────
   Spatial consistency: in-page links glide to their section instead of
   teleporting. Not a wheel hijack — any wheel/touch/key input cancels it. */
let travel = null;
const stopTravel = () => { if (travel) { travel.stop(); travel = null; } };
['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => addEventListener(t, stopTravel, { passive: true }));

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = e.target.closest('a[href]');
  if (!link) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
  const top = url.hash === '#top';
  const target = top ? document.body : document.getElementById(decodeURIComponent(url.hash.slice(1)));
  if (!target) return;
  e.preventDefault();
  const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
  const to = top ? 0 : Math.max(0, target.getBoundingClientRect().top + scrollY - pad);
  const from = scrollY;
  history.pushState(null, '', url.hash);
  dispatchEvent(new HashChangeEvent('hashchange'));
  const focusTarget = () => {
    if (top) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  };
  stopTravel();
  const distance = Math.abs(to - from);
  if (!canMove() || distance < 2) { scrollTo(0, to); focusTarget(); return; }
  // Longer trips take a little longer, never sluggish: 0.6 s – 1.25 s.
  const duration = Math.min(1.25, 0.6 + distance / 6000);
  const run = animate(from, to, { duration, ease: EASE_IN_OUT, onUpdate: (v) => scrollTo(0, v) });
  travel = run;
  run.then(() => { if (travel === run) { travel = null; focusTarget(); } });
});

/* ── 3 · FAQ accordion ───────────────────────────────────────────────────
   State indication: answers open and close with height + fade instead of
   snapping. Interruptible — a second click retargets from the current height. */
document.querySelectorAll('.faq-list details').forEach((details) => {
  const summary = details.querySelector('summary');
  const content = details.querySelector('.detail-content');
  if (!summary || !content) return;
  let anim = null;
  summary.addEventListener('click', (e) => {
    if (!canMove()) return; // native instant toggle
    e.preventDefault();
    const opening = !details.open || details.dataset.state === 'closing';
    // A closed <details> still reports its content's full height in current Chrome
    // (::details-content), so a closed item always starts from 0.
    const start = details.open ? content.getBoundingClientRect().height : 0;
    const startOpacity = details.open ? Number(getComputedStyle(content).opacity) : 0;
    anim?.stop();
    content.style.overflow = 'hidden';
    let run;
    if (opening) {
      details.open = true;
      details.dataset.state = 'open';
      content.style.height = 'auto';
      const end = content.getBoundingClientRect().height;
      content.style.height = `${start}px`; // never hand Motion an inline `auto` as origin
      run = animate(content, { height: [`${start}px`, `${end}px`], opacity: [start ? startOpacity : 0, 1] },
        { duration: 0.32, ease: EASE_OUT });
    } else {
      details.dataset.state = 'closing';
      run = animate(content, { height: [`${start}px`, '0px'], opacity: [startOpacity, 0] },
        { duration: 0.24, ease: EASE_OUT });
    }
    anim = run;
    run.then(() => {
      if (anim !== run) return; // superseded by a newer click
      if (details.dataset.state === 'closing') details.open = false;
      delete details.dataset.state;
      content.style.height = ''; content.style.overflow = ''; content.style.opacity = '';
      anim = null;
    });
  });
});

/* ── 4 · Mobile menu ─────────────────────────────────────────────────────
   Occasional, touch only: the panel unrolls from the header and the links
   follow with a short stagger. Closing stays instant — the user is leaving. */
const nav = document.getElementById('navigation');
if (nav) {
  let wasOpen = false;
  new MutationObserver(() => {
    const open = nav.classList.contains('open');
    if (open === wasOpen) return;
    wasOpen = open;
    if (!open || !canMove()) return;
    animate(nav, { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'] }, { duration: 0.34, ease: EASE_OUT })
      .then(() => { nav.style.clipPath = ''; });
    const links = [...nav.querySelectorAll('a')];
    animate(links, { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0px)'] },
      { duration: 0.3, ease: EASE_OUT, delay: stagger(0.04, { startDelay: 0.06 }) })
      .then(() => links.forEach(clear));
  }).observe(nav, { attributes: true, attributeFilter: ['class'] });
}

/* ── 5 · Shared-element page transition hook ─────────────────────────────
   The clicked project cover becomes the case hero on the next page
   (cross-document View Transitions, see motion.css). Only the clicked card
   carries the name — the gallery's loop copies would otherwise collide. */
const unnameCovers = () => document.querySelectorAll('.project-cover').forEach((c) => { c.style.viewTransitionName = ''; });
document.addEventListener('click', (e) => {
  const link = e.target.closest('.project a[href^="/arbeiten/"]');
  if (!link || e.defaultPrevented) return;
  unnameCovers();
  link.querySelector('.project-cover')?.style.setProperty('view-transition-name', 'case-hero');
});
addEventListener('pageshow', (e) => { if (e.persisted) unnameCovers(); });
