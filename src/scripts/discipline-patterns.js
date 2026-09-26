/** Four related, deliberately distinct line studies. No external runtime.
 * 0: optical focus / 1: aerial ribbons / 2: woven mesh / 3: harmonic field.
 * Artwork is decorative; text and navigation remain native HTML.
 */
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover:hover) and (pointer:fine)');
let paused = reduced.matches || document.documentElement.classList.contains('motion-paused');
const palettes = [
  { background: '#d4ff3f', ink: '#37561c' },
  { background: '#b5dbe8', ink: '#244e68' },
  { background: '#cdc1ee', ink: '#564576' },
  { background: '#edb09b', ink: '#7f3d3a' },
];
const scenes = [...document.querySelectorAll('[data-pattern]')].map(host => {
  const variant = Number(host.dataset.pattern);
  const canvas = host.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { wake() {} };
  const palette = palettes[variant];
  let visible = false, raf = 0, last = 0, elapsed = 0, width = 0, height = 0;
  let pointer = { x: 450, y: 300, force: 0, target: 0 };
  function point(x, y) {
    const dx = x - pointer.x, dy = y - pointer.y;
    const distance = Math.hypot(dx, dy);
    const push = Math.exp(-distance * distance / 24000) * pointer.force * 22;
    return [x + dx / (distance + 20) * push, y + dy / (distance + 20) * push];
  }
  function path(points, alpha = .55) {
    ctx.beginPath();
    points.forEach(([x,y], i) => { const p = point(x,y); i ? ctx.lineTo(...p) : ctx.moveTo(...p); });
    ctx.globalAlpha = alpha; ctx.stroke();
  }
  function paint() {
    ctx.setTransform(canvas.width / 900, 0, 0, canvas.height / 600, 0, 0);
    ctx.globalAlpha = 1; ctx.fillStyle = palette.background; ctx.fillRect(0, 0, 900, 600);
    ctx.strokeStyle = palette.ink; ctx.lineWidth = Math.max(.65, 900 / Math.max(width, 1) * .45);
    const detailStep = width < 500 ? 1.7 : 1;
    const t = elapsed * .22;
    if (variant === 0) {
      // Off-centre optical rings: a quiet, cropped focus plane.
      for (let j = 0; j < 115; j += detailStep) {
        const r = 22 + j * 5.4, points = [];
        for (let i = 0; i <= 220; i++) {
          const a = i / 220 * Math.PI * 2;
          const warp = 1 + .042 * Math.sin(a * 3 + j * .018 + t);
          points.push([575 + Math.cos(a) * r * 1.13 * warp, 235 + Math.sin(a) * r * .79 * warp]);
        }
        path(points, .56);
      }
    } else if (variant === 1) {
      // Long aerial trajectories; rhythm and parallax without another mountain.
      for (let j = 0; j < 120; j += detailStep) {
        const points = [];
        for (let i = 0; i <= 150; i++) {
          const x = i * 6;
          const y = -150 + j * 7 + 104 * Math.sin(x / 310 + j * .021 + t * .16)
            - 95 * Math.exp(-(((x - 610) / 190) ** 2)) * Math.sin(j / 120 * Math.PI)
            + 9 * Math.sin(x / 180 + t) - x * .12;
          points.push([x, y]);
        }
        path(points, .55);
      }
    } else if (variant === 2) {
      // A continuous, woven coordinate surface rather than a technical icon.
      function mesh(u,v) {
        const bend = Math.exp(-((u - .55) ** 2 + (v - .48) ** 2) * 10);
        return [-80 + u * 1060 + 66 * Math.sin(v * 5 + t * .12) * bend,
          -100 + v * 800 + 100 * Math.sin(u * 5 + t * .15) * bend];
      }
      for (let j = 0; j <= 100; j += detailStep) {
        const a = [], b = [];
        for (let i = 0; i <= 100; i++) { a.push(mesh(i / 100, j / 100)); b.push(mesh(j / 100, i / 100)); }
        path(a, .46); path(b, .32);
      }
    } else {
      // Harmonic loops: an emergent two-lobed field with a fine central weave.
      for (let j = 0; j < 105; j += detailStep) {
        const points = [], r = 45 + j * 4.5;
        for (let i = 0; i <= 240; i++) {
          const a = i / 240 * Math.PI * 2;
          const lobe = 1 + .32 * Math.cos(a * 2 + .35) + .07 * Math.sin(a * 3 + t * .3 + j * .008);
          points.push([490 + Math.cos(a) * r * lobe, 245 + Math.sin(a) * r * .83 + 38 * Math.sin(a * 2 + t * .12)]);
        }
        path(points, .53);
      }
    }
    ctx.globalAlpha = 1;
  }
  function draw(now) {
    raf = 0;
    if (!visible || document.hidden) { last = 0; return; }
    const dt = last ? Math.min((now - last) / 1000, .05) : 0;
    if (last && dt < 1 / 32 && !paused) { wake(); return; }
    last = now;
    if (!paused) { elapsed += dt; pointer.force += (pointer.target - pointer.force) * (1 - Math.exp(-7 * dt)); }
    else pointer.force = 0;
    paint();
    if (!paused) wake();
  }
  function wake() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(draw); }
  new ResizeObserver(() => {
    width = host.clientWidth; height = host.clientHeight;
    const dpr = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    paint(); wake();
  }).observe(host);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = 0;
    if (visible) wake(); else { cancelAnimationFrame(raf); raf = 0; }
  }, { rootMargin: '60px' }).observe(host);
  canvas.addEventListener('pointermove', e => {
    if (!fine.matches || paused) return;
    const r = canvas.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) / width * 900;
    pointer.y = (e.clientY - r.top) / height * 600;
    pointer.target = 1; wake();
  });
  canvas.addEventListener('pointerleave', () => { pointer.target = 0; wake(); });
  return { wake() { last = 0; wake(); } };
});
document.addEventListener('motion-state', e => { paused = e.detail.paused; scenes.forEach(s => s.wake()); });
document.addEventListener('visibilitychange', () => scenes.forEach(s => s.wake()));
