/* ──────────────────────────────────────────────────────────────────────────
   Page transitions — a Signal-coloured clip wipe between pages.

   Implemented as an MPA wipe (intercept internal link → wipe down → navigate →
   wipe up on load) rather than Astro View Transitions. This keeps every island's
   once-run init working without re-binding gymnastics, and is bulletproof on
   back/forward. Visual result is the same as a clip-path page transition.
   ────────────────────────────────────────────────────────────────────────── */
import gsap from 'gsap';
import { prefersReducedMotion } from './motion';

export function initTransitions() {
  const curtain = document.getElementById('curtain');
  if (!curtain) return;

  // Intro: curtain covers, then wipes up to reveal the page.
  const hideCurtain = () => { curtain.style.display = 'none'; };
  if (prefersReducedMotion) {
    hideCurtain();
  } else {
    gsap.set(curtain, { yPercent: 0 });
    gsap.timeline()
      .to(curtain, { yPercent: -100, duration: 0.9, ease: 'power4.inOut', delay: 0.15 })
      .add(hideCurtain);
    // Safety net: never let the curtain get stuck covering the page.
    setTimeout(hideCurtain, 2000);
  }

  // Outro: intercept internal navigations, wipe down, then go.
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement)?.closest?.('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (a.target === '_blank' || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey) return;

    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname) return; // same page → let anchors/Lenis handle

    e.preventDefault();
    if (prefersReducedMotion) { location.href = url.href; return; }

    curtain.style.display = 'grid';
    gsap.timeline()
      .set(curtain, { yPercent: 100 })
      .to(curtain, { yPercent: 0, duration: 0.7, ease: 'power4.inOut' })
      .add(() => { location.href = url.href; });
  });

  // Restored from bfcache → make sure the curtain is gone.
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) {
      gsap.set(curtain, { display: 'none', yPercent: -100 });
    }
  });
}
