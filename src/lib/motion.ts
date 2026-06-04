/* ──────────────────────────────────────────────────────────────────────────
   Shared motion layer. Lenis smooth-scroll wired into GSAP's ticker so
   ScrollTrigger stays in perfect sync, plus a couple of reusable micro-
   interaction helpers. Everything degrades gracefully under reduced-motion.
   ────────────────────────────────────────────────────────────────────────── */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

export const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let registered = false;
export function registerGsap() {
  if (registered) return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

let lenis: Lenis | null = null;

/** Initialise Lenis once and drive it from GSAP's ticker. No-op under reduced-motion. */
export function initSmoothScroll(): Lenis | null {
  if (prefersReducedMotion || lenis) return lenis;
  registerGsap();

  lenis = new Lenis({
    duration: 1.1,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out
    smoothWheel: true,
    touchMultiplier: 1.6,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time: number) => lenis!.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Let in-page anchor links route through Lenis for a smooth glide.
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis!.scrollTo(target as HTMLElement, { offset: -10, duration: 1.3 });
    });
  });

  return lenis;
}

/** Lock / unlock page scroll (e.g. while the mobile menu is open). */
export function lockScroll() {
  lenis?.stop();
  document.documentElement.style.overflow = 'hidden';
}
export function unlockScroll() {
  lenis?.start();
  document.documentElement.style.overflow = '';
}

/** Magnetic hover: element drifts toward the cursor, springs back on leave. */
export function magnetic(el: HTMLElement, strength = 0.35) {
  if (prefersReducedMotion) return;
  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const mx = e.clientX - (r.left + r.width / 2);
    const my = e.clientY - (r.top + r.height / 2);
    gsap.to(el, { x: mx * strength, y: my * strength, duration: 0.6, ease: 'power3.out' });
  };
  const reset = () =>
    gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.5)' });
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', reset);
}

/**
 * Seamless marquee. `track` must contain exactly ONE set of items. The set is
 * cloned until the track is wider than the viewport + one set, then scrolled by
 * exactly one set width and looped — so it's always full (no empty gaps) on any
 * screen width, on a true infinite loop. Call after fonts are ready.
 */
export function marquee(track: HTMLElement, pxPerSec = 60) {
  if (prefersReducedMotion) return;
  const base = track.innerHTML;
  const unit = track.scrollWidth; // width of one set
  if (!unit) return;
  let guard = 0;
  while (track.scrollWidth < window.innerWidth + unit && guard++ < 60) {
    track.insertAdjacentHTML('beforeend', base);
  }
  gsap.fromTo(
    track,
    { x: 0 },
    { x: -unit, duration: unit / pxPerSec, ease: 'none', repeat: -1 },
  );
}

/** Scroll-velocity distortion: elements with [data-skew] tilt slightly with
 *  scroll speed and settle back when it stops. Driven by Lenis' velocity. */
export function initScrollSkew() {
  if (prefersReducedMotion) return;
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-skew]'));
  if (!els.length) return;
  const setters = els.map((el) => gsap.quickSetter(el, 'skewY', 'deg'));
  let cur = 0;
  const loop = () => {
    const v = lenis?.velocity ?? 0;
    const target = gsap.utils.clamp(-3.5, 3.5, v * 0.05);
    cur += (target - cur) * 0.12;
    if (Math.abs(cur) < 0.002) cur = 0;
    for (const s of setters) s(cur);
    requestAnimationFrame(loop);
  };
  loop();
}

/** Thin scroll-progress bar (element with [data-progress]); scaleX 0→1. */
export function initScrollProgress() {
  const bar = document.querySelector<HTMLElement>('[data-progress]');
  if (!bar) return;
  const update = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const p = h > 0 ? Math.min(1, window.scrollY / h) : 0;
    bar.style.transform = `scaleX(${p})`;
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
}

/** Lazily run a callback when an element first scrolls into view (for below-fold WebGL). */
export function whenVisible(el: Element, cb: () => void, rootMargin = '200px') {
  if (!('IntersectionObserver' in window)) return cb();
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        cb();
      }
    },
    { rootMargin },
  );
  io.observe(el);
}
