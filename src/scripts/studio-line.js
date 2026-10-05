/* „Eine Linie. Ein Gegenüber." — the studio portrait as one continuous line.
   Data: public/data/studio-line.bin (scripts/build-oneline.mjs).
   · scroll draws the line in one stroke (one-way, never undraws)
   · once drawn, a lime signal runs through the whole thread
   · pointer pulls the thread like a rubber band (fine pointers only)
   · click / button: the thread unravels and writes Foto → Film → Web → KI, then
     knots itself back into the face; plays once by itself after the first draw
   Pauses off-screen; reduced motion / „Bewegung pausieren": finished line, no motion. */
const frame = document.querySelector('[data-studio-line]');
if (frame) init(frame);

function init(frame) {
  const canvas = frame.querySelector('canvas'), ctx = canvas.getContext('2d');
  const btn = frame.querySelector('.sl-words'), countEl = frame.querySelector('.sl-count');
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)'), fine = matchMedia('(hover: hover) and (pointer: fine)');
  let paused = reduce.matches || root.classList.contains('motion-paused');
  const WORDS = ['Foto', 'Film', 'Web', 'KI'];
  const STAGES = [{ at: 0, s: 'tangle' }, { at: 0.9, s: 0 }, { at: 3.0, s: 1 }, { at: 5.1, s: 2 }, { at: 7.2, s: 3 }, { at: 9.5, s: 'tangle' }, { at: 10.3, s: 'face' }];
  const SEQ_END = 12.6;

  let n = 0, aspect = 1, U, V, X, Y, cum, ox, oy, vx, vy, tx, ty, wordOff = [];
  let w = 0, h = 0, visible = false, raf = 0, drawn = 0, drawnTarget = 0, seqAt = -1e9, autoDone = false, settled = true, last = 0, sig = 0;
  const mouse = { x: -1e4, y: -1e4, in: false };

  async function load() {
    const buf = await (await fetch('/data/studio-line.bin')).arrayBuffer();
    const dv = new DataView(buf);
    n = dv.getUint32(0, true); aspect = dv.getFloat32(4, true);
    const raw = new Uint16Array(buf, 8, n * 2);
    U = new Float32Array(n); V = new Float32Array(n);
    for (let i = 0; i < n; i++) { U[i] = raw[i * 2] / 65535; V[i] = raw[i * 2 + 1] / 65535; }
    X = new Float32Array(n); Y = new Float32Array(n); cum = new Float32Array(n);
    ox = new Float32Array(n); oy = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n);
    tx = new Float32Array(n); ty = new Float32Array(n);
    for (let i = 0; i < n; i++) { // a loose tangle: neighbours drift out together (units of frame width)
      const a = Math.sin(i * 0.0021) * 3.1 + Math.sin(i * 0.00043 + 1.7) * 4 + Math.cos(i * 0.013) * 0.6;
      const m = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(i * 0.0037 + 2));
      tx[i] = Math.cos(a) * m; ty[i] = Math.sin(a) * m * 0.8;
    }
    layout();
    await Promise.race([document.fonts.load('600 80px Manrope'), new Promise((r) => setTimeout(r, 1200))]);
    buildWords();
    frame.classList.add('is-line');
    if (paused) drawn = drawnTarget = 1;
    wake();
  }

  function layout() {
    const dpr = Math.min(2, devicePixelRatio || 1), r = frame.getBoundingClientRect();
    w = r.width; h = r.height; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let fh = h * 0.88, fw = fh * aspect;
    if (fw > w * 0.9) { fw = w * 0.9; fh = fw / aspect; }
    const left = (w - fw) / 2, top = (h - fh) / 2;
    for (let i = 0; i < n; i++) { X[i] = left + U[i] * fw; Y[i] = top + V[i] * fh; }
    cum[0] = 0; for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
  }

  // each discipline as a word made of the same thread: point i → i-th letter sample along a Hilbert curve
  function hil(x, y, order) { let d = 0; for (let s = order >> 1; s > 0; s >>= 1) { const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0; d += s * s * ((3 * rx) ^ ry); if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } const t = x; x = y; y = t; } } return d; }
  function buildWords() {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    const x = c.getContext('2d', { willReadFrequently: true }), ord = 1024;
    const key = (px, py) => hil(Math.max(0, Math.min(ord - 1, px / w * ord | 0)), Math.max(0, Math.min(ord - 1, py / h * ord | 0)), ord);
    wordOff = WORDS.map((word) => {
      x.clearRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      let size = h * 0.4; x.font = `600 ${size}px Manrope, sans-serif`;
      const tw = x.measureText(word).width; if (tw > w * 0.84) { size *= w * 0.84 / tw; x.font = `600 ${size}px Manrope, sans-serif`; }
      x.fillText(word, c.width / 2, c.height * 0.53);
      const d = x.getImageData(0, 0, c.width, c.height).data, px = [];
      for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) if (d[(yy * c.width + xx) * 4 + 3] > 128) px.push(xx, yy);
      const m = px.length / 2, pick = new Float32Array(n * 2), kk = new Float64Array(n);
      for (let i = 0; i < n; i++) { const k = Math.floor(Math.random() * m); pick[i * 2] = px[k * 2] + Math.random() * 0.8; pick[i * 2 + 1] = px[k * 2 + 1] + Math.random() * 0.8; kk[i] = key(pick[i * 2], pick[i * 2 + 1]); }
      const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => kk[a] - kk[b]);
      const off = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { const t = order[i]; off[i * 2] = pick[t * 2] - X[i]; off[i * 2 + 1] = pick[t * 2 + 1] - Y[i]; }
      return off;
    });
  }

  function play() {
    if (paused || !n || performance.now() - seqAt < SEQ_END * 1000) return;
    drawn = drawnTarget = 1; seqAt = performance.now(); settled = false; wake();
  }

  function scrollTarget() {
    const r = frame.getBoundingClientRect();
    return Math.max(0, Math.min(1, (innerHeight * 0.92 - r.top) / (r.height * 0.75 + innerHeight * 0.25)));
  }

  function frameStep(now) {
    raf = 0;
    if (!visible || !n) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    if (paused) drawn = drawnTarget = 1;
    else { drawnTarget = Math.max(drawnTarget, scrollTarget()); drawn += (drawnTarget - drawn) * Math.min(1, dt * 3.2); if (drawnTarget - drawn < 0.0005) drawn = drawnTarget; }
    const count = Math.floor(n * drawn);
    if (count >= n && !autoDone && !paused) { autoDone = true; setTimeout(play, 2200); }

    // springs: tangle / words / rubber band
    const ua = (now - seqAt) / 1000, seq = ua < SEQ_END && !paused;
    const pull = mouse.in && fine.matches && !paused && !seq;
    if (seq || pull || !settled) {
      let motion = 0;
      for (let i = 0; i < n; i++) {
        let gx = 0, gy = 0;
        if (seq) {
          const ta = ua - (i / n) * 0.8; let st = null;
          for (const S of STAGES) if (S.at <= ta) st = S.s;
          if (st === 'tangle') { gx = tx[i] * w; gy = ty[i] * w; } else if (typeof st === 'number' && wordOff[st]) { gx = wordOff[st][i * 2]; gy = wordOff[st][i * 2 + 1]; }
        }
        if (pull) { const dx = X[i] + ox[i] - mouse.x, dy = Y[i] + oy[i] - mouse.y, d2 = dx * dx + dy * dy; if (d2 < 8100) { const d = Math.sqrt(d2) || 1, f = (1 - d / 90) * 30; gx += dx / d * f; gy += dy / d * f; } }
        vx[i] = (vx[i] + (gx - ox[i]) * 0.07) * 0.82; vy[i] = (vy[i] + (gy - oy[i]) * 0.07) * 0.82;
        ox[i] += vx[i]; oy[i] += vy[i];
        motion += Math.abs(vx[i]) + Math.abs(vy[i]) + Math.abs(ox[i]) * 0.02;
      }
      settled = !seq && !pull && motion / n < 0.002;
      if (settled) { ox.fill(0); oy.fill(0); vx.fill(0); vy.fill(0); }
    }
    btn.disabled = seq || paused;

    // draw: crisp thread; long hops through dark areas as a faint thread
    ctx.clearRect(0, 0, w, h);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const hop = h * 0.045, faint = [];
    ctx.beginPath(); ctx.moveTo(X[0] + ox[0], Y[0] + oy[0]);
    for (let i = 1; i < count; i++) {
      const x = X[i] + ox[i], y = Y[i] + oy[i];
      if (cum[i] - cum[i - 1] > hop && !seq) { faint.push(X[i - 1] + ox[i - 1], Y[i - 1] + oy[i - 1], x, y); ctx.moveTo(x, y); } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(243,244,236,.9)'; ctx.lineWidth = w < 500 ? 0.6 : 0.75; ctx.stroke();
    if (faint.length) { ctx.beginPath(); for (let k = 0; k < faint.length; k += 4) { ctx.moveTo(faint[k], faint[k + 1]); ctx.lineTo(faint[k + 2], faint[k + 3]); } ctx.strokeStyle = 'rgba(243,244,236,.16)'; ctx.lineWidth = 0.6; ctx.stroke(); }

    // the signal: a lime spark through the whole thread
    if (count >= n && !paused) {
      sig = (sig + dt * 1400) % (n + 700);
      const head = Math.floor(sig) - 300, a = Math.max(0, head - 220), b = Math.min(n - 1, head);
      if (b > a) {
        ctx.beginPath(); ctx.moveTo(X[a] + ox[a], Y[a] + oy[a]);
        for (let i = a + 1; i <= b; i++) ctx.lineTo(X[i] + ox[i], Y[i] + oy[i]);
        ctx.strokeStyle = 'rgba(212,255,63,.95)'; ctx.lineWidth = 1.05; ctx.shadowColor = 'rgba(212,255,63,.7)'; ctx.shadowBlur = 7; ctx.stroke(); ctx.shadowBlur = 0;
      }
    }
    // the pen tip while drawing
    if (count > 0 && count < n) {
      const i = count - 1;
      ctx.beginPath(); ctx.arc(X[i] + ox[i], Y[i] + oy[i], 3, 0, Math.PI * 2);
      ctx.fillStyle = '#d4ff3f'; ctx.shadowColor = 'rgba(212,255,63,.9)'; ctx.shadowBlur = 16; ctx.fill(); ctx.shadowBlur = 0;
    }
    countEl.textContent = `1 Linie · ${(cum[Math.max(0, count - 1)] / 96 * 0.0254).toFixed(1).replace('.', ',')} m`;

    // keep running only while something moves
    if (!paused || count < n || !settled || seq) raf = requestAnimationFrame(frameStep);
  }
  function wake() { if (!raf && visible && n) { last = 0; raf = requestAnimationFrame(frameStep); } }

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !n && !frame.dataset.loading) { frame.dataset.loading = '1'; load().catch(() => frame.classList.remove('is-line')); }
    wake();
  // observe the section, not the frame: the frame sits inside a clip-path reveal, and a
  // clipped element reports "not intersecting" without an update once the clip opens
  }, { rootMargin: '300px 0px' }).observe(frame.closest('section') || frame);
  addEventListener('scroll', wake, { passive: true });
  new ResizeObserver(() => { if (!n) return; layout(); buildWords(); wake(); }).observe(frame);
  document.addEventListener('motion-state', (e) => { paused = e.detail.paused || reduce.matches; wake(); });
  frame.addEventListener('pointermove', (e) => { const r = frame.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.in = true; settled = false; wake(); });
  frame.addEventListener('pointerleave', () => { mouse.in = false; wake(); });
  frame.addEventListener('click', play);
  btn.addEventListener('click', (e) => { e.stopPropagation(); play(); });
}
