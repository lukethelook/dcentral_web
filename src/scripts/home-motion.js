/**
 * Homepage motion — hero depth on scroll, the discipline tab indicator and
 * the studio image parallax. Built on Motion (motion.dev).
 * Brand rules (docs/brand/DESIGN.md): headline and buttons are visible and
 * still from the first frame; scroll-linked effects never take over scrolling.
 */
import { animate, scroll } from 'motion';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
let paused = reduced.matches || root.classList.contains('motion-paused');
document.addEventListener('motion-state', (e) => { paused = e.detail.paused; });
const canMove = () => !paused && !reduced.matches;

/* ── 1 · Hero depth on scroll ────────────────────────────────────────────
   Scroll-linked (native ScrollTimeline where supported): the copy lifts away
   faster than the page, the mountain sinks slower — the hero gains depth
   as you leave it. Driven by the scrollbar, never by us. */
const hero = document.querySelector('.hero');
if (hero && !reduced.matches) {
  const opts = { target: hero, offset: ['start start', 'end start'] };
  const lin = { ease: 'linear' };
  const copy = hero.querySelector('.hero-copy');
  const land = hero.querySelector('.hero-landscape');
  const bottom = hero.querySelector('.hero-bottom');
  if (copy) {
    scroll(animate(copy, { transform: ['translateY(0px)', 'translateY(-16vh)'] }, lin), opts);
    scroll(animate(copy, { opacity: [1, 1, 0] }, { ...lin, times: [0, 0.3, 0.8] }), opts);
  }
  if (land) scroll(animate(land, { transform: ['translateY(0%)', 'translateY(20%)'], opacity: [1, 0.45] }, lin), opts);
  if (bottom) scroll(animate(bottom, { opacity: [1, 0, 0] }, { ...lin, times: [0, 0.22, 1] }), opts);
}

/* ── 2 · Discipline tab indicator ────────────────────────────────────────
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

/* ── 3 · Studio image parallax ───────────────────────────────────────────
   The material study drifts slightly slower than its frame. */
const frame = document.querySelector('.studio-frame');
const studioImg = frame?.querySelector('img');
if (frame && studioImg && !reduced.matches) {
  scroll(animate(studioImg, { transform: ['translateY(-6%) scale(1.14)', 'translateY(6%) scale(1.14)'] }, { ease: 'linear' }),
    { target: frame, offset: ['start end', 'end start'] });
}
