/* Scroll frame: one lime line runs clockwise around the viewport as the page
   is read — top, right, bottom, left — and closes where it started at the end
   of the page. Each edge gets its share by length, so the speed stays even
   round the corners. Phones (or narrow windows) keep the top edge only. */
const frame = document.querySelector('.scroll-frame');
if (frame) {
  const [top, right, bottom, left] = ['t', 'r', 'b', 'l'].map((k) => frame.querySelector(`[data-edge="${k}"]`));
  const full = matchMedia('(min-width: 760px) and (pointer: fine)');
  const footer = document.querySelector('footer'); // the footer is lime: over it the line switches to forest
  let pending = 0, closed = false;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  function update() {
    pending = 0;
    const range = document.documentElement.scrollHeight - innerHeight;
    const p = range > 0 ? clamp(scrollY / range) : 0;
    if (!full.matches) {
      top.style.transform = `scaleX(${p})`;
      right.style.transform = bottom.style.transform = left.style.transform = 'scale(0)';
    } else {
      const w = document.documentElement.clientWidth, h = innerHeight, d = p * (2 * w + 2 * h);
      top.style.transform = `scaleX(${clamp(d / w)})`;
      right.style.transform = `scaleY(${clamp((d - w) / h)})`;
      bottom.style.transform = `scaleX(${clamp((d - w - h) / w)})`;
      left.style.transform = `scaleY(${clamp((d - 2 * w - h) / h)})`;
    }
    // the frame closes: a single soft flash (state indication, so it also plays with reduced motion but without movement)
    // what is actually visible mid-screen? (the footer can sit behind the page as a curtain)
    const mid = document.elementFromPoint(innerWidth / 2, innerHeight * 0.55);
    frame.classList.toggle('on-lime', !!(footer && mid && footer.contains(mid)));
    const isClosed = p > 0.998;
    if (isClosed !== closed) { closed = isClosed; frame.classList.toggle('is-closed', closed); }
  }
  const queue = () => { if (!pending) pending = requestAnimationFrame(update); };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  full.addEventListener('change', queue);
  new ResizeObserver(queue).observe(document.body); // page height changes (lazy images, accordions)
  update();
}
