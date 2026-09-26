/**
 * Project Baby Bloom — Neural Soundscape demo.
 *
 * Sound (Web Audio, only after a click): a binaural beat (carrier left,
 * carrier + beat right), pink noise, an ocean swell whose LFO runs at the
 * breathing rate, and a heartbeat scheduled on the audio clock.
 * Picture (canvas): an interference field of two wave families whose moiré
 * drifts with the beat, a glass core that breathes with the swell, heartbeat
 * ripples fired on the very beats you hear, drifting motes and a live
 * waveform ring from an AnalyserNode. Sound and picture share one clock.
 */
import { animate } from 'motion';

const demoRoot = document.querySelector('[data-soundscape-demo]');
if (demoRoot) init(demoRoot);

function init(root) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = document.documentElement.classList.contains('motion-paused');
  const EASE_OUT = [0.23, 1, 0.32, 1];
  const SESSION = 30 * 60;
  const TAU = Math.PI * 2;

  // Research-based presets (sources in the component): EEG band → beat,
  // 0.1 Hz breathing for calm states, heartbeat after Salk, pink noise after Spencer.
  const STATES = {
    schlaf: { label: 'Einschlafen', band: 'delta', bandText: 'Delta · 0,5–4 Hz', beat: 2, carrier: 180, breath: 0.1, bpm: 60,
      science: 'Delta-Wellen prägen den Tiefschlaf – das Ziel beim Einschlafen.', hue: ['#5b3fd6', '#7fd8c6'], mix: { freq: 55, noise: 62, ocean: 32, heart: 38 } },
    ruhe: { label: 'Entspannen', band: 'theta', bandText: 'Theta · 4–8 Hz', beat: 6, carrier: 200, breath: 0.1, bpm: 72,
      science: 'Theta-Wellen treten beim Dösen und in tiefer Entspannung auf.', hue: ['#8b6cf0', '#9fe6d6'], mix: { freq: 50, noise: 42, ocean: 52, heart: 26 } },
    wach: { label: 'Ruhig wach', band: 'alpha', bandText: 'Alpha · 8–13 Hz', beat: 10, carrier: 220, breath: 0.14, bpm: 0,
      science: 'Alpha-Wellen stehen für entspannte, aufmerksame Wachheit.', hue: ['#4fc4b0', '#b3a2ff'], mix: { freq: 56, noise: 18, ocean: 38, heart: 0 } },
    froh: { label: 'Spielzeit', band: 'beta', bandText: 'Beta · 13–30 Hz', beat: 14, carrier: 240, breath: 0.2, bpm: 0,
      science: 'Niedrige Beta-Wellen um 14 Hz begleiten aktive, fröhliche Aufmerksamkeit.', hue: ['#f39bb8', '#9d86ff'], mix: { freq: 46, noise: 10, ocean: 46, heart: 0 } },
  };

  const $ = (s) => root.querySelector(s);
  const pills = [...root.querySelectorAll('[data-state]')];
  const pillInd = $('.ssd-states-ind');
  const sliders = [...root.querySelectorAll('[data-layer]')];
  const heartHint = $('[data-hint="heart"]');
  const oceanHint = $('[data-hint="ocean"]');
  const bandEl = $('[data-band]');
  const scienceEl = $('[data-science]');
  const playBtn = $('.ssd-play');
  const ringCircle = $('.ssd-ring circle');
  const readProfile = $('[data-readout-profile]');
  const readStatus = $('[data-readout-status]');
  const eqBars = [...root.querySelectorAll('.ssd-eq i')];
  const timerEl = $('[data-timer]');
  const centerLabel = $('[data-center-label]');
  const marker = $('[data-marker]');
  const markerLabel = $('[data-marker-label]');
  const bandSegs = [...root.querySelectorAll('[data-band-seg]')];
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const fx = document.createElement('canvas');
  const fxc = fx.getContext('2d');

  let state = 'schlaf';
  const mix = { ...STATES.schlaf.mix };
  // Smoothed render parameters — everything eases toward the chosen state.
  const P = { beat: 2, breath: 0.1, a: hex(STATES.schlaf.hue[0]), b: hex(STATES.schlaf.hue[1]), energy: 0.4, level: 0 };
  const still = () => reduced.matches || paused;
  document.addEventListener('motion-state', (e) => { paused = e.detail.paused; wake(); });

  function hex(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const lerp = (a, b, k) => a + (b - a) * k;
  const mixC = (c, d, k) => c.map((v, i) => lerp(v, d[i], k));

  /* ── States (roving radio group with a travelling indicator) ─────────── */
  function placeIndicator(glide) {
    const on = pills.find((p) => p.dataset.state === state);
    const box = on.parentElement.getBoundingClientRect(), r = on.getBoundingClientRect();
    const to = { transform: `translateX(${(r.left - box.left).toFixed(1)}px)`, width: `${r.width.toFixed(1)}px` };
    if (glide && !still()) animate(pillInd, to, { type: 'spring', duration: 0.5, bounce: 0.18 });
    else Object.assign(pillInd.style, to);
  }
  function placeMarker(glide) {
    const s = STATES[state];
    const LO = Math.log(0.5), HI = Math.log(30);
    const left = ((Math.log(s.beat) - LO) / (HI - LO)) * 100;
    markerLabel.textContent = `${s.beat} Hz`;
    bandSegs.forEach((b) => b.classList.toggle('is-on', b.dataset.bandSeg === s.band));
    if (glide && !still()) animate(marker, { left: `${left}%` }, { type: 'spring', duration: 0.8, bounce: 0.2 });
    else marker.style.left = `${left}%`;
  }
  function swapText(el, text, glide) {
    if (!glide || still()) { el.textContent = text; return; }
    animate(el, { opacity: [1, 0], transform: ['translateY(0px)', 'translateY(-6px)'] }, { duration: 0.14, ease: EASE_OUT }).then(() => {
      el.textContent = text;
      animate(el, { opacity: [0, 1], transform: ['translateY(6px)', 'translateY(0px)'] }, { duration: 0.32, ease: EASE_OUT });
    });
  }
  function paint(el) { if (el) el.style.setProperty('--v', `${el.value}%`); }
  function select(id, { focus = false, glide = true } = {}) {
    state = id;
    const s = STATES[id];
    pills.forEach((p) => {
      const on = p.dataset.state === id;
      p.setAttribute('aria-checked', String(on));
      p.tabIndex = on ? 0 : -1;
      if (on && focus) p.focus();
    });
    placeIndicator(glide);
    placeMarker(glide);
    swapText(bandEl, s.bandText, glide);
    swapText(scienceEl, s.science, glide);
    swapText(centerLabel, s.label, glide);
    readProfile.textContent = `${s.beat} Hz Schwebung · ${s.carrier} Hz Träger`;
    heartHint.textContent = s.bpm ? `${s.bpm} bpm` : 'aus in diesem Zustand';
    oceanHint.textContent = `Welle alle ${Math.round(1 / s.breath)} s`;
    for (const k of Object.keys(mix)) {
      const el = sliders.find((x) => x.dataset.layer === k);
      const setV = (v) => { mix[k] = v; if (el) { el.value = String(Math.round(v)); paint(el); } applyGains(); };
      if (!glide || still()) setV(s.mix[k]);
      else animate(mix[k], s.mix[k], { duration: 1.1, ease: EASE_OUT, onUpdate: setV });
    }
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

  /* ── Audio engine ─────────────────────────────────────────────────────── */
  let ac = null, nodes = null, playing = false, sched = 0, nextBeat = 0, startedAt = 0, elapsed = 0;
  const beats = []; // visual heartbeat events (performance.now times)
  let timeData = null, freqData = null;

  function pinkNoise(seconds) {
    // Paul Kellet's refined pink-noise filter over white noise (−3 dB/octave).
    const len = ac.sampleRate * seconds, buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    }
    return buf;
  }
  function brownNoise(seconds) {
    const len = ac.sampleRate * seconds, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
    return buf;
  }
  function build() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ac.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.82;
    const master = ac.createGain(); master.gain.value = 0;
    master.connect(analyser); analyser.connect(ac.destination);
    // Binaural beat: pure sines, hard left / hard right.
    const freqGain = ac.createGain(); freqGain.connect(master);
    const osc = (pan) => { const o = ac.createOscillator(); o.type = 'sine'; const p = ac.createStereoPanner(); p.pan.value = pan; o.connect(p); p.connect(freqGain); o.start(); return o; };
    const oscL = osc(-1), oscR = osc(1);
    // Pink noise, softened at the top.
    const noise = ac.createBufferSource(); noise.buffer = pinkNoise(6); noise.loop = true;
    const noiseLP = ac.createBiquadFilter(); noiseLP.type = 'lowpass'; noiseLP.frequency.value = 5200;
    const noiseGain = ac.createGain(); noise.connect(noiseLP); noiseLP.connect(noiseGain); noiseGain.connect(master); noise.start();
    // Ocean: brown noise swelling at the breathing rate (shared with the visual breath).
    const ocean = ac.createBufferSource(); ocean.buffer = brownNoise(8); ocean.loop = true;
    const oceanLP = ac.createBiquadFilter(); oceanLP.type = 'lowpass'; oceanLP.frequency.value = 600;
    const swell = ac.createGain(); swell.gain.value = 0.55;
    const lfo = ac.createOscillator(); lfo.frequency.value = STATES[state].breath;
    const lfoAmt = ac.createGain(); lfoAmt.gain.value = 0.45; lfo.connect(lfoAmt); lfoAmt.connect(swell.gain); lfo.start();
    const oceanGain = ac.createGain(); ocean.connect(oceanLP); oceanLP.connect(swell); swell.connect(oceanGain); oceanGain.connect(master); ocean.start();
    // Heartbeat bus.
    const heartGain = ac.createGain(); const heartLP = ac.createBiquadFilter(); heartLP.type = 'lowpass'; heartLP.frequency.value = 140;
    heartGain.connect(heartLP); heartLP.connect(master);
    nodes = { master, analyser, freqGain, oscL, oscR, noiseGain, oceanGain, heartGain, lfo };
    timeData = new Uint8Array(analyser.fftSize);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    retune(); applyGains();
  }
  function retune() {
    if (!nodes) return;
    const s = STATES[state], t = ac.currentTime;
    nodes.oscL.frequency.setTargetAtTime(s.carrier, t, 0.6);
    nodes.oscR.frequency.setTargetAtTime(s.carrier + s.beat, t, 0.6);
    nodes.lfo.frequency.setTargetAtTime(s.breath, t, 1.5);
  }
  function applyGains() {
    if (!nodes) return;
    const t = ac.currentTime, v = (k, max) => (mix[k] / 100) * max;
    nodes.freqGain.gain.setTargetAtTime(v('freq', 0.045), t, 0.2);
    nodes.noiseGain.gain.setTargetAtTime(v('noise', 0.16), t, 0.2);
    nodes.oceanGain.gain.setTargetAtTime(v('ocean', 0.32), t, 0.2);
    nodes.heartGain.gain.setTargetAtTime(v('heart', 1.1), t, 0.2);
  }
  function thump(at, strength) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(58, at); o.frequency.exponentialRampToValueAtTime(38, at + 0.2);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(strength, at + 0.018); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
    o.connect(g); g.connect(nodes.heartGain); o.start(at); o.stop(at + 0.26);
  }
  // Look-ahead scheduler on the audio clock; the visual ripple gets the same moment.
  function scheduler() {
    const s = STATES[state];
    if (!s.bpm || mix.heart < 1) { nextBeat = ac.currentTime + 0.2; return; }
    const period = 60 / s.bpm;
    while (nextBeat < ac.currentTime + 0.25) {
      if (nextBeat < ac.currentTime) nextBeat = ac.currentTime + 0.05;
      thump(nextBeat, 0.42); thump(nextBeat + 0.28, 0.2); // lub-dub
      const at = performance.now() + (nextBeat - ac.currentTime) * 1000;
      beats.push(at);
      nextBeat += period;
    }
  }
  async function play() {
    if (!ac) build();
    await ac.resume();
    playing = true; startedAt = performance.now() - elapsed * 1000;
    nextBeat = ac.currentTime + 0.4;
    nodes.master.gain.cancelScheduledValues(ac.currentTime);
    nodes.master.gain.setTargetAtTime(1, ac.currentTime, 0.8); // gentle fade-in
    sched = setInterval(scheduler, 50);
    playBtn.setAttribute('aria-pressed', 'true'); playBtn.setAttribute('aria-label', 'Soundscape pausieren');
    root.classList.add('is-playing');
    readStatus.textContent = 'Läuft · live im Browser erzeugt';
    wake();
  }
  function stop() {
    playing = false; clearInterval(sched);
    if (ac) nodes.master.gain.setTargetAtTime(0, ac.currentTime, 0.25);
    setTimeout(() => { if (!playing && ac) ac.suspend(); }, 1100);
    playBtn.setAttribute('aria-pressed', 'false'); playBtn.setAttribute('aria-label', 'Soundscape abspielen');
    root.classList.remove('is-playing');
    readStatus.textContent = 'Pausiert';
  }
  playBtn.addEventListener('click', () => (playing ? stop() : play()));
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stop(); });
  addEventListener('pagehide', () => { if (playing) stop(); });

  /* ── Visual ───────────────────────────────────────────────────────────── */
  let W = 0, H = 0, dpr = 1, raf = 0, visible = false, last = 0;
  let breathPhase = Math.PI, phaseL = 0, phaseR = 0;
  const motes = Array.from({ length: 120 }, () => ({
    a: Math.random() * TAU, r: 0.35 + Math.random() * 0.95, s: 0.4 + Math.random() * 1.2,
    w: (Math.random() < 0.5 ? -1 : 1) * (0.015 + Math.random() * 0.035), tw: Math.random() * TAU, fall: Math.random(),
  }));

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height;
    for (const c of [canvas, fx]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); fxc.setTransform(dpr, 0, 0, dpr, 0, 0);
    placeIndicator(false);
    draw(performance.now(), 0);
  }
  function wake() {
    if (still()) { draw(performance.now(), 0); return; }
    if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  function loop(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    draw(now, dt);
    if (visible && !still()) raf = requestAnimationFrame(loop);
  }
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);

  function draw(now, dt) {
    if (!W || !H) return;
    const s = STATES[state];
    // Ease every render parameter toward the state (≈ 0.5 s time constant).
    const k = dt ? 1 - Math.exp(-dt * 2.2) : 1;
    P.beat = lerp(P.beat, s.beat, k); P.breath = lerp(P.breath, s.breath, k);
    P.a = mixC(P.a, hex(s.hue[0]), k); P.b = mixC(P.b, hex(s.hue[1]), k);
    P.energy = lerp(P.energy, playing ? 1 : 0.38, dt ? 1 - Math.exp(-dt * 1.5) : 1);

    // Audio level (RMS) for reactivity.
    let level = 0;
    if (playing && nodes) {
      nodes.analyser.getByteTimeDomainData(timeData);
      let sum = 0; for (let i = 0; i < timeData.length; i += 4) { const v = (timeData[i] - 128) / 128; sum += v * v; }
      level = Math.min(1, Math.sqrt(sum / (timeData.length / 4)) * 5);
      nodes.analyser.getByteFrequencyData(freqData);
      eqBars.forEach((b, i) => { const v = freqData[2 + i * 3] / 255; b.style.transform = `scaleY(${(0.12 + v * 0.88).toFixed(3)})`; });
    } else if (!dt) {
      eqBars.forEach((b) => { b.style.transform = 'scaleY(0.12)'; });
    }
    P.level = lerp(P.level, level, dt ? 1 - Math.exp(-dt * 6) : 1);

    if (playing) elapsed = (now - startedAt) / 1000;
    const left = Math.max(0, SESSION - elapsed);
    timerEl.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    ringCircle.style.strokeDashoffset = String(1 - Math.min(1, elapsed / SESSION));

    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.34;
    breathPhase += dt * P.breath * TAU;
    const breath = 0.5 - 0.5 * Math.cos(breathPhase); // 0 → 1 → 0, one cycle per 1/breath s
    const E = P.energy;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    // 1 · Aura — breathes with the swell.
    const aura = ctx.createRadialGradient(cx, cy, R * 0.25, cx, cy, Math.min(W, H) * 0.5);
    aura.addColorStop(0, rgba(P.a, 0.22 + 0.18 * E * (0.6 + 0.4 * breath)));
    aura.addColorStop(0.55, rgba(P.b, 0.05 + 0.05 * E));
    aura.addColorStop(1, rgba(P.a, 0));
    ctx.fillStyle = aura; ctx.fillRect(0, 0, W, H);

    // 2 · Interference field — two wave families (left/right ear); the moiré drifts with the beat.
    const speed = 7 + 5 * E;
    phaseL += dt * speed;
    phaseR += dt * speed * (1 + P.beat / 26);
    const sp = R * 0.075, dx = R * 0.2 * (0.9 + 0.1 * breath), fAmt = mix.freq / 100;
    fxc.globalCompositeOperation = 'source-over';
    fxc.clearRect(0, 0, W, H);
    fxc.lineWidth = 1;
    for (const [ox, ph, col] of [[-dx, phaseL, P.a], [dx, phaseR, P.b]]) {
      fxc.strokeStyle = rgba(col, 0.55);
      for (let r = (ph % sp); r < R * 1.5; r += sp) {
        fxc.globalAlpha = Math.max(0, 1 - r / (R * 1.5));
        fxc.beginPath(); fxc.arc(cx + ox, cy, r, 0, TAU); fxc.stroke();
      }
    }
    fxc.globalAlpha = 1;
    fxc.globalCompositeOperation = 'destination-in';
    const mask = fxc.createRadialGradient(cx, cy, R * 0.45, cx, cy, R * 1.42);
    mask.addColorStop(0, 'rgba(0,0,0,1)'); mask.addColorStop(1, 'rgba(0,0,0,0)');
    fxc.fillStyle = mask; fxc.fillRect(0, 0, W, H);
    ctx.globalAlpha = (0.18 + 0.5 * fAmt) * (0.55 + 0.45 * E);
    ctx.drawImage(fx, 0, 0, W, H);
    ctx.globalAlpha = 1;

    // 3 · Motes — slow orbit, a little rain when the noise layer is up.
    const nAmt = mix.noise / 100;
    for (const m of motes) {
      m.a += dt * m.w * (0.6 + E); m.tw += dt * 1.3;
      m.fall = (m.fall + dt * 0.02 * nAmt * m.s) % 1;
      const rr = R * m.r * (1 + 0.04 * breath);
      const x = cx + Math.cos(m.a) * rr, y = cy + Math.sin(m.a) * rr * 0.92 + (m.fall - 0.5) * R * 0.25 * nAmt;
      const al = (0.15 + 0.35 * (0.5 + 0.5 * Math.sin(m.tw))) * (0.4 + 0.6 * E);
      ctx.fillStyle = rgba(m.s > 1 ? P.b : [236, 232, 255], al);
      ctx.beginPath(); ctx.arc(x, y, 0.5 + m.s * 0.7, 0, TAU); ctx.fill();
    }

    // 4 · Heartbeat ripples, fired on the scheduled beats.
    let pulse = 0;
    for (let i = beats.length - 1; i >= 0; i--) {
      const age = (now - beats[i]) / 1500;
      if (age < 0) continue;
      if (age > 1) { beats.splice(i, 1); continue; }
      pulse = Math.max(pulse, Math.exp(-age * 9));
      const hr = R * (0.46 + easeOut(age) * 0.95);
      ctx.strokeStyle = rgba([253, 222, 230], (1 - age) * (1 - age) * 0.55 * (0.25 + mix.heart / 100));
      ctx.lineWidth = 2.2 * (1 - age) + 0.4;
      ctx.beginPath(); ctx.arc(cx, cy, hr, 0, TAU); ctx.stroke();
    }

    // 5 · Live waveform ring (real audio when playing, a calm sine otherwise).
    const Ro = R * 0.42 * (0.94 + 0.08 * breath) * (1 + 0.035 * pulse) * (1 + 0.05 * P.level);
    const wr = Ro * 1.28;
    ctx.beginPath();
    const N = 180;
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * TAU;
      let amp;
      if (playing && timeData) amp = ((timeData[Math.floor((i / N) * (timeData.length - 1))] - 128) / 128) * R * 0.22;
      else amp = Math.sin(th * 6 + now / 900) * R * 0.012;
      const rr = wr + amp;
      const x = cx + Math.cos(th - Math.PI / 2) * rr, y = cy + Math.sin(th - Math.PI / 2) * rr;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = rgba(P.b, 0.35 + 0.35 * E); ctx.lineWidth = 1.2; ctx.stroke();

    // 6 · Glass core.
    ctx.globalCompositeOperation = 'source-over';
    const halo = ctx.createRadialGradient(cx, cy, Ro * 0.6, cx, cy, Ro * 1.9);
    halo.addColorStop(0, rgba(P.b, 0.35 * (0.5 + 0.5 * E))); halo.addColorStop(1, rgba(P.a, 0));
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, Ro * 1.9, 0, TAU); ctx.fill();
    const body = ctx.createRadialGradient(cx - Ro * 0.35, cy - Ro * 0.4, Ro * 0.05, cx, cy, Ro);
    body.addColorStop(0, 'rgba(255,255,255,0.95)');
    body.addColorStop(0.22, rgba(mixC(P.b, [255, 255, 255], 0.35), 0.95));
    body.addColorStop(0.7, rgba(P.a, 0.92));
    body.addColorStop(1, rgba(mixC(P.a, [20, 12, 60], 0.35), 0.95));
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, Ro, 0, TAU); ctx.fill();
    // Slow caustic highlight turning inside the glass.
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Ro, 0, TAU); ctx.clip();
    ctx.translate(cx, cy); ctx.rotate(now / 7000);
    const caustic = ctx.createRadialGradient(Ro * 0.35, Ro * 0.2, 0, Ro * 0.35, Ro * 0.2, Ro * 0.8);
    caustic.addColorStop(0, rgba(P.b, 0.45)); caustic.addColorStop(1, rgba(P.b, 0));
    ctx.fillStyle = caustic; ctx.fillRect(-Ro, -Ro, Ro * 2, Ro * 2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, Ro - 0.5, 0, TAU); ctx.stroke();
  }

  new ResizeObserver(size).observe(canvas);
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; wake(); }, { threshold: 0.05 }).observe(root);
  addEventListener('resize', () => placeIndicator(false));
  select('schlaf', { glide: false });
}
