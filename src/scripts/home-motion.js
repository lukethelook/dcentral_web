/**
 * Homepage motion — the hero's thread, hero depth on scroll, the discipline
 * tab indicator and the studio image parallax. Built on Motion (motion.dev).
 * Brand rules (docs/brand/DESIGN.md): headline and buttons are visible and
 * still from the first frame; scroll-linked effects never take over scrolling.
 */
import { animate, scroll } from 'motion';

// Codebase token: --ease / --ease-out = cubic-bezier(.23,1,.32,1).
const EASE_OUT = [0.23, 1, 0.32, 1];

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const root = document.documentElement;
let paused = reduced.matches || root.classList.contains('motion-paused');
document.addEventListener('motion-state', (e) => { paused = e.detail.paused; });
const canMove = () => !paused && !reduced.matches;

/* ── 1 · „Der Faden" ─────────────────────────────────────────────────────
   One thread continues the Traunstein's filaments: it draws in beneath
   „Für Weiter." once per session and runs on past the edge — weiter.
   With a fine pointer it can be plucked like a string (delight tier). */
const hero = document.querySelector('.hero');
const svg = hero?.querySelector('.hero-thread');
const em = hero?.querySelector('h1 em');
if (hero && svg && em) {
  const path = svg.querySelector('path');
  const grad = svg.querySelector('linearGradient');
  const N = 120;
  let base = []; // [x, y] samples of the resting thread in svg coordinates
  let amp = 0; // current deflection in px (spring-driven)
  let px = 0; // pointer x where the thread is held
  let spring = null;

  const cubic = (p0, p1, p2, p3, t) => {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  };
  function layout() {
    const h = hero.getBoundingClientRect();
    const e = em.getBoundingClientRect();
    const x0 = e.left - h.left + e.height * 0.04;
    const y0 = e.bottom - h.top - e.height * 0.02;
    const x3 = h.width + 40;
    // Gentle rise toward the edge; on narrow screens flatter so it clears „Weiter."
    const y3 = y0 - Math.min(h.height * 0.06, h.width * 0.05);
    const span = x3 - x0;
    const c1 = [x0 + span * 0.38, y0 + e.height * 0.16];
    const c2 = [x0 + span * 0.68, y3 + e.height * 0.28];
    base = Array.from({ length: N + 1 }, (_, i) => {
      const t = i / N;
      return [cubic(x0, c1[0], c2[0], x3, t), cubic(y0, c1[1], c2[1], y3, t)];
    });
    grad.setAttribute('x1', x0); grad.setAttribute('x2', x3);
    render();
  }
  function baseYAt(x) {
    for (let i = 1; i < base.length; i++) {
      if (base[i][0] >= x) {
        const [ax, ay] = base[i - 1], [bx, by] = base[i];
        return ay + (by - ay) * ((x - ax) / (bx - ax || 1));
      }
    }
    return null;
  }
  function render() {
    const sigma = 110;
    let d = '';
    for (let i = 0; i < base.length; i++) {
      const [x, y] = base[i];
      const dy = amp * Math.exp(-((x - px) ** 2) / (2 * sigma * sigma));
      d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${(y + dy).toFixed(1)}`;
    }
    path.setAttribute('d', d);
  }
  const setAmp = (to, opts) => {
    spring?.stop();
    spring = animate(amp, to, { ...opts, onUpdate: (v) => { amp = v; render(); } });
  };

  layout();
  document.fonts.ready.then(layout);
  new ResizeObserver(layout).observe(hero);

  // Draw-in: once per tab session, right as the terrain's own threads settle.
  const KEY = 'dcentral:hero-thread:v1';
  let seen = false;
  try { seen = sessionStorage.getItem(KEY) === 'seen'; sessionStorage.setItem(KEY, 'seen'); } catch { /* storage may be blocked */ }
  if (canMove() && !seen) {
    path.style.strokeDashoffset = '1';
    animate(path, { strokeDashoffset: [1, 0] }, { duration: 1.8, delay: 0.85, ease: EASE_OUT });
  } else {
    path.style.strokeDashoffset = '0';
  }

  // Pluck: near the thread it follows the pointer; moving away lets it ring out.
  let held = false;
  const release = () => {
    if (!held) return;
    held = false;
    setAmp(0, { type: 'spring', stiffness: 420, damping: 6, restDelta: 0.1 });
  };
  hero.addEventListener('pointermove', (e) => {
    if (!fine.matches || !canMove() || e.pointerType !== 'mouse') return;
    const r = svg.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const by = baseYAt(x);
    if (by !== null && Math.abs(y - by) < 34) {
      px = x;
      held = true;
      setAmp(Math.max(-26, Math.min(26, y - by)), { type: 'spring', stiffness: 700, damping: 45 });
    } else release();
  });
  hero.addEventListener('pointerleave', release);
}

/* ── 2 · Hero depth on scroll ────────────────────────────────────────────
   Scroll-linked (native ScrollTimeline where supported): the copy lifts away
   faster than the page, the mountain sinks slower — the hero gains depth
   as you leave it. Driven by the scrollbar, never by us. */
if (hero && !reduced.matches) {
  const opts = { target: hero, offset: ['start start', 'end start'] };
  const lin = { ease: 'linear' };
  const lift = [hero.querySelector('.hero-copy'), svg].filter(Boolean);
  const land = hero.querySelector('.hero-landscape');
  const bottom = hero.querySelector('.hero-bottom');
  lift.forEach((el) => {
    scroll(animate(el, { transform: ['translateY(0px)', 'translateY(-16vh)'] }, lin), opts);
    scroll(animate(el, { opacity: [1, 1, 0] }, { ...lin, times: [0, 0.3, 0.8] }), opts);
  });
  if (land) scroll(animate(land, { transform: ['translateY(0%)', 'translateY(20%)'], opacity: [1, 0.45] }, lin), opts);
  if (bottom) scroll(animate(bottom, { opacity: [1, 0, 0] }, { ...lin, times: [0, 0.22, 1] }), opts);
}

/* ── 3 · Discipline tab indicator ────────────────────────────────────────
   Spatial consistency: one line travels to the chosen discipline instead of
   four lines toggling — a spring, so quick re-selection feels continuous. */
const tabs = document.querySelector('.discipline-tabs');
if (tabs) {
  const bar = document.createElement('span');
  bar.className = 'tab-indicator';
  bar.setAttribute('aria-hidden', 'true');
  tabs.append(bar);
  tabs.classList.add('has-indicator');
  let current = null;
  const place = (glide) => {
    const sel = tabs.querySelector('[aria-selected="true"]');
    if (!sel) return;
    const t = tabs.getBoundingClientRect(), b = sel.getBoundingClientRect();
    const target = `translate(${(b.left - t.left).toFixed(1)}px, ${(b.bottom - t.top - 1).toFixed(1)}px) scaleX(${b.width.toFixed(1)})`;
    current?.stop();
    if (glide && canMove()) current = animate(bar, { transform: target }, { type: 'spring', duration: 0.5, bounce: 0.12 });
    else bar.style.transform = target;
  };
  place(false);
  new MutationObserver(() => place(true)).observe(tabs, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
  new ResizeObserver(() => place(false)).observe(tabs);
}

/* ── 4 · Studio image parallax ───────────────────────────────────────────
   The material study drifts slightly slower than its frame. */
const frame = document.querySelector('.studio-frame');
const studioImg = frame?.querySelector('img');
if (frame && studioImg && !reduced.matches) {
  scroll(animate(studioImg, { transform: ['translateY(-6%) scale(1.14)', 'translateY(6%) scale(1.14)'] }, { ease: 'linear' }),
    { target: frame, offset: ['start end', 'end start'] });
}
