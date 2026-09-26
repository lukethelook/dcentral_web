/**
 * dcentral motion system — built on Motion (motion.dev, the Framer Motion engine).
 * Loaded on every page. Respects the brand rules in docs/brand/DESIGN.md:
 * text is never hidden before JS runs, nothing hijacks the wheel, the global
 * pause and prefers-reduced-motion switch everything to instant states.
 */
import { animate, cubicBezier, inView, scroll, stagger } from 'motion';

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
   untouched; everything below is prepared by JS only (no JS = fully visible).
   Modes: false = the element · 'lines' = masked line-by-line headline ·
   'clip' = image wipe · any other string = staggered children (selector). */
const REVEAL = [
  ['.manifest-bottom > p', false],
  ['.services .section-title h2', 'lines'],
  ['.discipline-stage', false],
  ['.work-heading h2', 'lines'],
  ['.gallery', '.project'],
  ['.studio-visual', 'clip'],
  ['.studio-copy h2', 'lines'],
  ['.studio-copy', ':scope > :not(h2)'],
  ['.impact-grid h2', 'lines'],
  ['.impact-grid > div:first-child', ':scope > :not(h2)'],
  ['.impact-offers', ':scope > *'],
  ['.impact-steps', ':scope > li'],
  ['.region h2', 'lines'],
  ['.client-list', ':scope > span'],
  ['.stats', ':scope > div'],
  ['.process h2', 'lines'],
  ['.steps', ':scope > li'],
  ['.faq-heading h2', 'lines'],
  ['.faq-heading', ':scope > :not(h2)'],
  ['.faq-list', ':scope > details'],
  ['.contact h2', 'lines'],
  ['.contact-mail', false],
  ['.contact-grid', ':scope > div'],
  // Subpages (.case-visual is deliberately absent: it enters via the shared-element transition)
  ['.case-body > div, .case-meta', false],
  ['.case-h2', 'lines'],
  ['.case-highlights', ':scope > article'],
  ['.case-screens', ':scope > figure'],
  ['.case-loop', ':scope > li'],
  ['.case-stack', ':scope > li'],
  ['.case-cta', false],
  ['.ssd', false],
  ['.nf', false],
  ['.case-outlook-head', false],
  ['.case-outlook-grid', ':scope > article'],
  ['.legal h2, .legal h2 + p', false],
];
const HIDDEN = { opacity: '0', transform: 'translateY(22px)' };
const pending = new Map();

const onScreen = (el) => {
  const r = el.getBoundingClientRect();
  return r.top < innerHeight && r.bottom > 0;
};
const parts = (el, mode) => {
  if (mode === 'lines') return [...el.querySelectorAll(':scope > .line > .line-inner')];
  if (mode && mode !== 'clip') return [...el.querySelectorAll(mode)];
  return [el];
};

// Wrap each <br>-separated line of a headline in a mask: .line > .line-inner.
function splitLines(h) {
  if (h.querySelector(':scope > .line')) return;
  const groups = [[]];
  [...h.childNodes].forEach((n) => {
    if (n.nodeName === 'BR') groups.push([]);
    else groups[groups.length - 1].push(n);
  });
  h.replaceChildren(...groups
    .filter((g) => g.some((n) => n.nodeType !== 3 || n.textContent.trim()))
    .map((g) => {
      const line = document.createElement('span');
      const inner = document.createElement('span');
      line.className = 'line'; inner.className = 'line-inner';
      inner.append(...g);
      line.append(inner);
      return line;
    }));
}

function prepare(el, mode) {
  if (mode === 'clip') {
    el.style.clipPath = 'inset(100% 0 0 0)';
    // A fully clipped lazy image would never load (the browser treats it as invisible).
    el.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; });
    return;
  }
  if (mode === 'lines') {
    splitLines(el);
    parts(el, mode).forEach((p) => { p.style.transform = 'translateY(108%)'; });
    return;
  }
  parts(el, mode).forEach((p) => setStyles(p, HIDDEN));
}

function play(el, mode) {
  pending.delete(el);
  if (!canMove()) return finish(el, mode);
  if (mode === 'clip') {
    animate(el, { clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'] }, { duration: 1.2, ease: EASE_OUT })
      .then(() => { el.style.clipPath = ''; });
    return;
  }
  const targets = parts(el, mode); // queried now: includes gallery loop copies built meanwhile
  if (mode === 'lines') {
    animate(targets, { transform: ['translateY(108%)', 'translateY(0%)'] },
      { duration: 1.05, ease: EASE_OUT, delay: stagger(0.09) })
      .then(() => targets.forEach(clear));
    return;
  }
  animate(targets, { opacity: [0, 1], transform: ['translateY(22px)', 'translateY(0px)'] },
    { duration: 0.8, ease: EASE_OUT, delay: stagger(mode ? 0.06 : 0, { startDelay: mode ? 0.12 : 0 }) })
    .then(() => targets.forEach(clear));
}

function finish(el, mode) {
  pending.delete(el);
  clear(el);
  if (mode !== 'clip') parts(el, mode).forEach(clear);
}
function revealAll() { [...pending].forEach(([el, mode]) => finish(el, mode)); }

if (canMove()) {
  for (const [selector, mode] of REVEAL) {
    document.querySelectorAll(selector).forEach((el) => {
      if (onScreen(el)) return;
      prepare(el, mode);
      pending.set(el, mode);
      // IntersectionObserver honours the target's own clip-path: a clipped element never
      // "intersects", so clip reveals watch their (unclipped) parent instead.
      const watch = mode === 'clip' ? el.parentElement : el;
      inView(watch, () => { play(el, mode); }, { amount: 0.15, margin: '0px 0px -8% 0px' });
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
      run = animate(content, { height: [`${start}px`, `${end}px`], opacity: [startOpacity, 1] },
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

/* ── 7 · Signal loop (case pages) ────────────────────────────────────────
   State indication: when a process list comes into view, a chartreuse signal
   runs through it once and lights each step as it arrives. Without JS or with
   reduced motion every step is simply lit (see pages.css). */
document.querySelectorAll('[data-signal-loop]').forEach((list) => {
  const line = list.querySelector('.case-loop-signal');
  const steps = [...list.querySelectorAll(':scope > li')];
  if (!line || !steps.length || reduced.matches) return;
  root.classList.add('js-loop');
  const lightAll = () => { line.style.transform = 'scaleX(1)'; steps.forEach((s) => s.classList.add('is-lit')); };
  if (paused) return lightAll();
  inView(list, () => {
    if (!canMove()) return lightAll();
    const total = 0.55 * steps.length + 0.4, delay = 0.25;
    const curve = [0.65, 0, 0.35, 1];
    animate(line, { transform: ['scaleX(0)', 'scaleX(1)'] }, { duration: total, ease: curve, delay });
    // Step i lights when the eased line reaches i/n — invert the curve to find that moment.
    const ease = cubicBezier(...curve);
    const timeAt = (p) => { let lo = 0, hi = 1; for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (ease(m) < p) lo = m; else hi = m; } return hi; };
    steps.forEach((s, i) => {
      setTimeout(() => s.classList.add('is-lit'), (delay + timeAt(i / steps.length) * total + 0.06) * 1000);
    });
  }, { amount: 0.5 });
});

/* ── 8 · Showcase videos ─────────────────────────────────────────────────
   Autoplay only while visible and while motion is allowed; otherwise the
   poster frame stands still (reduced motion, global pause, offscreen). */
document.querySelectorAll('video[data-motion-video]').forEach((video) => {
  let visible = false;
  const sync = () => {
    if (visible && canMove()) video.play().catch(() => {});
    else video.pause();
  };
  if (!canMove()) { video.removeAttribute('autoplay'); video.pause(); }
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; sync(); }, { threshold: 0.2 }).observe(video);
  document.addEventListener('motion-state', sync);
  reduced.addEventListener('change', sync);
});

/* ── 9 · Cinema stage: Vimeo loads only on explicit click (privacy, no autoplay). */
document.querySelectorAll('[data-cinema]').forEach((stage) => {
  const btn = stage.querySelector('.cinema-play');
  btn?.addEventListener('click', () => {
    const id = encodeURIComponent(stage.dataset.cinema);
    const frame = document.createElement('iframe');
    frame.src = stage.dataset.provider === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`
      : `https://player.vimeo.com/video/${id}?dnt=1&autoplay=1&title=0&byline=0&portrait=0&color=d4ff3f`;
    stage.querySelector('.cinema-loop')?.pause();
    frame.allow = 'autoplay; fullscreen; picture-in-picture';
    frame.allowFullscreen = true;
    frame.title = btn.getAttribute('aria-label') || 'Film';
    stage.classList.add('is-playing');
    stage.append(frame);
    frame.focus();
  }, { once: true });
});

/* ── 6 · Footer curtain ──────────────────────────────────────────────────
   On large screens the chartreuse footer sits beneath the page and is
   uncovered as the content scrolls away (pure CSS sticky, see motion.css).
   Only when the whole footer fits the viewport — otherwise it scrolls normally.
   Its content settles from slightly above while being uncovered. */
const footer = document.querySelector('footer.contact');
const main = document.querySelector('main');
if (footer && main) {
  const wide = matchMedia('(min-width: 1024px)');
  const fits = () => {
    root.classList.toggle('footer-curtain', wide.matches && footer.offsetHeight < innerHeight - 24);
  };
  fits();
  addEventListener('resize', fits);
  if (!reduced.matches) {
    const inner = footer.querySelector('.shell');
    scroll(animate(inner, { transform: ['translateY(-12%)', 'translateY(0%)'], opacity: [0.35, 1] }, { ease: 'linear' }),
      { target: main, offset: ['end end', 'end start'] });
  }
}
