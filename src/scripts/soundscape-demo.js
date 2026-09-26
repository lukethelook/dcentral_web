/**
 * Project Baby Bloom — Neural Soundscape demo.
 * A calm canvas visual (breathing core, frequency rings, heartbeat ripples,
 * rain drift) plus a small Web Audio engine: a binaural frequency layer,
 * filtered-noise rain and ocean, and a soft heartbeat. Sound only after click.
 */
import { animate } from 'motion';

const demoRoot = document.querySelector('[data-soundscape-demo]');
if (demoRoot) init(demoRoot);

function init(root) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = document.documentElement.classList.contains('motion-paused');

  // Each state: colours, breathing period (s), frequency profile, default mix.
  const STATES = {
    ruhe: { label: 'Entspannen', profile: 'Alpha · 10 Hz', carrier: 200, beat: 10, breath: 7, hue: ['#8b6cf0', '#7fd8c6'], mix: { freq: 55, rain: 45, ocean: 40, heart: 15 } },
    wach: { label: 'Aufmerksam', profile: 'Beta · 14 Hz', carrier: 220, beat: 14, breath: 4.5, hue: ['#7fd8c6', '#f7c3cd'], mix: { freq: 60, rain: 20, ocean: 25, heart: 0 } },
    froh: { label: 'Fröhlich', profile: 'Alpha/Beta · 12 Hz', carrier: 240, beat: 12, breath: 5.5, hue: ['#f7c3cd', '#9d86ff'], mix: { freq: 50, rain: 15, ocean: 45, heart: 10 } },
    schlaf: { label: 'Einschlafen', profile: 'Delta · 2 Hz', carrier: 150, beat: 2, breath: 9, hue: ['#6d4ae0', '#7fd8c6'], mix: { freq: 62, rain: 48, ocean: 30, heart: 25 } },
  };
  const EASE_OUT = [0.23, 1, 0.32, 1];
  const SESSION = 30 * 60;
  let state = 'schlaf';
  const mix = { ...STATES.schlaf.mix }; // 0–100
  const hueNow = { a: STATES.schlaf.hue[0], b: STATES.schlaf.hue[1] };

  const $ = (s) => root.querySelector(s);
  const pills = [...root.querySelectorAll('[data-state]')];
  const sliders = [...root.querySelectorAll('[data-layer]')];
  const playBtn = $('.ssd-play');
  const readProfile = $('[data-readout-profile]');
  const readStatus = $('[data-readout-status]');
  const live = $('[data-ssd-live]');
  const timerEl = $('[data-timer]');
  const centerLabel = $('[data-center-label]');
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');

  // Render state
  let W = 0, H = 0, raf = 0, visible = false, elapsed = 0;
  const ripples = [];
  const drops = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 0.8 }));
  // Audio state
  let ac = null, nodes = null, playing = false, heartTimer = 0, startedAt = 0, lastBeat = 0;

  const still = () => reduced.matches || paused;
  document.addEventListener('motion-state', (e) => { paused = e.detail.paused; wake(); });

  /* ── Colour helpers ───────────────────────────────────────────────────── */
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
  function blendHue([a, b], instant) {
    if (instant) { hueNow.a = a; hueNow.b = b; return; }
    const fa = hex(hueNow.a), fb = hex(hueNow.b), ta = hex(a), tb = hex(b);
    animate(0, 1, { duration: 0.9, ease: EASE_OUT, onUpdate: (t) => {
      hueNow.a = toHex(fa.map((v, i) => v + (ta[i] - v) * t));
      hueNow.b = toHex(fb.map((v, i) => v + (tb[i] - v) * t));
      if (still()) draw(performance.now());
    } });
  }

  /* ── State selection (roving radio group) ─────────────────────────────── */
  function paint(el) { if (el) el.style.setProperty('--v', `${el.value}%`); }
  function select(id, { focus = false, instant = false } = {}) {
    state = id;
    pills.forEach((p) => {
      const on = p.dataset.state === id;
      p.setAttribute('aria-checked', String(on));
      p.tabIndex = on ? 0 : -1;
      if (on && focus) p.focus();
    });
    const s = STATES[id];
    readProfile.textContent = s.profile;
    centerLabel.textContent = s.label;
    if (!instant) live.textContent = `Zustand ${s.label}, ${s.profile}`;
    // The mix glides to the state's preset; sliders follow.
    for (const k of Object.keys(mix)) {
      const el = sliders.find((x) => x.dataset.layer === k);
      const setV = (v) => { mix[k] = v; if (el) { el.value = String(Math.round(v)); paint(el); } applyGains(); };
      if (instant || still()) setV(s.mix[k]);
      else animate(mix[k], s.mix[k], { duration: 0.9, ease: EASE_OUT, onUpdate: setV });
    }
    blendHue(s.hue, instant || still());
    retune();
    wake();
  }
  pills.forEach((p, i) => {
    p.addEventListener('click', () => select(p.dataset.state));
    p.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      select(pills[(i + d + pills.length) % pills.length].dataset.state, { focus: true });
    });
  });
  sliders.forEach((el) => {
    el.addEventListener('input', () => { mix[el.dataset.layer] = Number(el.value); paint(el); applyGains(); wake(); });
  });

  /* ── Audio engine (created on first play) ─────────────────────────────── */
  function noiseBuffer(brown) {
    const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } else d[i] = w;
    }
    return buf;
  }
  function build() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    // Binaural frequency layer: carrier left, carrier + beat right.
    const freqGain = ac.createGain(); freqGain.connect(master);
    const osc = (pan) => { const o = ac.createOscillator(); o.type = 'sine'; const p = ac.createStereoPanner(); p.pan.value = pan; o.connect(p); p.connect(freqGain); o.start(); return o; };
    const oscL = osc(-1), oscR = osc(1);
    // Rain: white noise through a gentle band-pass.
    const rainSrc = ac.createBufferSource(); rainSrc.buffer = noiseBuffer(false); rainSrc.loop = true;
    const rainF = ac.createBiquadFilter(); rainF.type = 'bandpass'; rainF.frequency.value = 2400; rainF.Q.value = 0.6;
    const rainGain = ac.createGain(); rainSrc.connect(rainF); rainF.connect(rainGain); rainGain.connect(master); rainSrc.start();
    // Ocean: brown noise, low-pass, swelling with a slow LFO.
    const oceanSrc = ac.createBufferSource(); oceanSrc.buffer = noiseBuffer(true); oceanSrc.loop = true;
    const oceanF = ac.createBiquadFilter(); oceanF.type = 'lowpass'; oceanF.frequency.value = 520;
    const swell = ac.createGain(); swell.gain.value = 0.6;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.09;
    const lfoAmt = ac.createGain(); lfoAmt.gain.value = 0.4; lfo.connect(lfoAmt); lfoAmt.connect(swell.gain); lfo.start();
    const oceanGain = ac.createGain(); oceanSrc.connect(oceanF); oceanF.connect(swell); swell.connect(oceanGain); oceanGain.connect(master); oceanSrc.start();
    // Heartbeat: short, low sine thumps (scheduled while playing).
    const heartGain = ac.createGain(); heartGain.connect(master);
    nodes = { master, freqGain, oscL, oscR, rainGain, oceanGain, heartGain };
    retune(); applyGains();
  }
  function retune() {
    if (!nodes) return;
    const s = STATES[state], t = ac.currentTime;
    nodes.oscL.frequency.setTargetAtTime(s.carrier, t, 0.4);
    nodes.oscR.frequency.setTargetAtTime(s.carrier + s.beat, t, 0.4);
  }
  function applyGains() {
    if (!nodes) return;
    const t = ac.currentTime, v = (k, max) => (mix[k] / 100) * max;
    nodes.freqGain.gain.setTargetAtTime(v('freq', 0.05), t, 0.15);
    nodes.rainGain.gain.setTargetAtTime(v('rain', 0.07), t, 0.15);
    nodes.oceanGain.gain.setTargetAtTime(v('ocean', 0.35), t, 0.15);
    nodes.heartGain.gain.setTargetAtTime(v('heart', 0.9), t, 0.15);
  }
  function thump(at, strength) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(62, at); o.frequency.exponentialRampToValueAtTime(40, at + 0.18);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(strength, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    o.connect(g); g.connect(nodes.heartGain); o.start(at); o.stop(at + 0.25);
  }
  function scheduleHeart() {
    const bpm = state === 'schlaf' ? 58 : state === 'ruhe' ? 64 : 72;
    const now = ac.currentTime;
    if (now - lastBeat > 60 / bpm - 0.02) {
      thump(now + 0.05, 0.35); thump(now + 0.33, 0.18);
      lastBeat = now; ripples.push({ t: performance.now() });
    }
  }
  async function play() {
    if (!ac) build();
    await ac.resume();
    playing = true; startedAt = performance.now() - elapsed * 1000;
    nodes.master.gain.cancelScheduledValues(ac.currentTime);
    nodes.master.gain.setTargetAtTime(1, ac.currentTime, 0.6); // soft fade-in
    heartTimer = setInterval(() => { if (mix.heart > 1) scheduleHeart(); }, 60);
    playBtn.setAttribute('aria-pressed', 'true'); playBtn.setAttribute('aria-label', 'Soundscape pausieren');
    root.classList.add('is-playing');
    readStatus.textContent = 'Läuft · live im Browser erzeugt';
    live.textContent = 'Soundscape läuft';
    wake();
  }
  function stop() {
    playing = false; clearInterval(heartTimer);
    if (ac) nodes.master.gain.setTargetAtTime(0, ac.currentTime, 0.2);
    setTimeout(() => { if (!playing && ac) ac.suspend(); }, 900);
    playBtn.setAttribute('aria-pressed', 'false'); playBtn.setAttribute('aria-label', 'Soundscape abspielen');
    root.classList.remove('is-playing');
    readStatus.textContent = 'Pausiert';
    live.textContent = 'Soundscape pausiert';
  }
  playBtn.addEventListener('click', () => (playing ? stop() : play()));
  // Hiding the tab or leaving the page always stops the sound.
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stop(); });
  addEventListener('pagehide', () => { if (playing) stop(); });

  /* ── Visual ───────────────────────────────────────────────────────────── */
  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }
  function wake() {
    if (still()) { draw(performance.now()); return; }
    if (!raf && visible) raf = requestAnimationFrame(loop);
  }
  function loop(now) {
    raf = 0;
    draw(now);
    if (visible && !still()) raf = requestAnimationFrame(loop);
  }
  function draw(now) {
    if (!W || !H) return;
    const s = STATES[state];
    if (playing) elapsed = (now - startedAt) / 1000;
    const left = Math.max(0, SESSION - elapsed);
    timerEl.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    const t = still() ? 0 : now / 1000;
    const energy = playing ? 1 : 0.45;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.34;
    ctx.clearRect(0, 0, W, H);

    // Background glow
    // Fades out fully inside the canvas so no square edge shows against the panel.
    const bg = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, Math.min(W, H) * 0.5);
    bg.addColorStop(0, rgba(hueNow.a, 0.28 * energy + 0.1)); bg.addColorStop(1, 'rgba(20,15,51,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Rain drift
    const rain = mix.rain / 100;
    if (rain > 0.02) {
      ctx.strokeStyle = rgba('#cfc8f5', 0.18 * rain * (0.5 + energy / 2)); ctx.lineWidth = 1;
      drops.forEach((d, i) => {
        if (i / drops.length > rain) return;
        const y = ((d.y + t * 0.05 * d.s * (0.6 + energy)) % 1) * H, x = d.x * W;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 10 * d.s); ctx.stroke();
      });
    }

    // Heartbeat ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const age = (now - ripples[i].t) / 1600;
      if (age > 1) { ripples.splice(i, 1); continue; }
      ctx.strokeStyle = rgba('#fde8ec', (1 - age) * 0.35 * (mix.heart / 100 + 0.2)); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R * (0.55 + age * 0.9), 0, Math.PI * 2); ctx.stroke();
    }

    // Frequency rings: organic outlines driven by the beat, the ocean swell and the breath.
    const breath = 1 + Math.sin((t / s.breath) * Math.PI * 2) * 0.045 * (0.6 + energy);
    const swell = 1 + Math.sin(t * 0.55) * 0.03 * (mix.ocean / 100);
    const fAmp = (mix.freq / 100) * (0.5 + energy * 0.7);
    for (let k = 0; k < 4; k++) {
      const rr = R * (1.02 - k * 0.1) * breath * swell;
      ctx.beginPath();
      for (let a = 0; a <= 360; a += 2) {
        const th = (a * Math.PI) / 180;
        const wob = Math.sin(th * (5 + k) + t * (0.35 + s.beat * 0.04) * (k % 2 ? -1 : 1)) * 6 * fAmp
          + Math.sin(th * (11 + k * 2) - t * 0.6) * 2.4 * fAmp;
        const x = cx + (rr + wob) * Math.cos(th), y = cy + (rr + wob) * Math.sin(th);
        if (a) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = rgba(k % 2 ? hueNow.a : hueNow.b, 0.55 - k * 0.1);
      ctx.lineWidth = k === 0 ? 1.6 : 1.1;
      ctx.stroke();
    }

    // Core
    const cr = R * 0.5 * breath;
    const core = ctx.createRadialGradient(cx - cr * 0.3, cy - cr * 0.35, cr * 0.1, cx, cy, cr);
    core.addColorStop(0, '#e7fbf6'); core.addColorStop(0.35, hueNow.b); core.addColorStop(1, hueNow.a);
    ctx.shadowColor = rgba(hueNow.a, 0.8); ctx.shadowBlur = 50 * (0.6 + energy * 0.6);
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  new ResizeObserver(size).observe(canvas);
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; wake(); }, { threshold: 0.05 }).observe(root);
  select('schlaf', { instant: true });
}
