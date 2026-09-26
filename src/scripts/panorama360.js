/**
 * 360° tour viewer (Three.js, vendored). Equirectangular panoramas are mapped
 * onto the inside of a sphere. Pointer drag / touch / arrow keys look around,
 * released drags keep a little momentum, and an idle drift slowly pans the
 * scene (off with reduced motion or the global pause). Scene changes crossfade
 * between two spheres. Nothing loads until the viewer is near the viewport.
 */
import * as THREE from './vendor/three.module.min.js';
import { animate } from 'motion';

document.querySelectorAll('[data-panorama]').forEach(init);

function init(root) {
  const stage = root.querySelector('.pano-stage');
  const canvas = stage.querySelector('canvas');
  const buttons = [...root.querySelectorAll('[data-scene]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = document.documentElement.classList.contains('motion-paused');
  document.addEventListener('motion-state', (e) => { paused = e.detail.paused; wake(); });
  const canDrift = () => !reduced.matches && !paused;

  let renderer, scene, camera, spheres = [], active = 0, current = -1;
  let lon = 90, lat = -24, vLon = 0, vLat = 0, fov = 72;
  let dragging = false, lastX = 0, lastY = 0, lastT = 0, idleSince = performance.now();
  let raf = 0, visible = false, started = false;
  const loader = new THREE.TextureLoader();
  const textures = new Map();

  function start() {
    if (started) return;
    started = true;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(fov, 16 / 9, 1, 1100);
    const geo = new THREE.SphereGeometry(500, 72, 48);
    geo.scale(-1, 1, 1); // view from inside
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = i;
      scene.add(mesh);
      spheres.push(mesh);
    }
    new ResizeObserver(resize).observe(stage);
    resize();
    show(0);
  }

  function resize() {
    if (!renderer) return;
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    draw();
  }

  function texture(i) {
    if (textures.has(i)) return textures.get(i);
    const p = new Promise((resolve) => {
      loader.load(buttons[i].dataset.src, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        resolve(t);
      });
    });
    textures.set(i, p);
    return p;
  }

  async function show(i) {
    if (i === current) return;
    current = i;
    buttons.forEach((b, k) => { const on = k === i; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    root.classList.add('is-loading');
    const tex = await texture(i);
    if (current !== i) return;
    root.classList.remove('is-loading');
    const next = spheres[1 - active], prev = spheres[active];
    next.material.map = tex; next.material.needsUpdate = true;
    next.renderOrder = 1; prev.renderOrder = 0;
    active = 1 - active;
    const quick = reduced.matches || paused;
    animate(0, 1, {
      duration: quick ? 0 : 0.9, ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => { next.material.opacity = v; draw(); },
      onComplete: () => { prev.material.opacity = 0; draw(); },
    });
    // Neighbouring scenes preload in the background once the first is up.
    buttons.forEach((_, k) => { if (k !== i) texture(k); });
    wake();
  }

  function draw() {
    if (!renderer) return;
    lat = Math.max(-80, Math.min(80, lat));
    const phi = THREE.MathUtils.degToRad(90 - lat), theta = THREE.MathUtils.degToRad(lon);
    camera.fov = fov; camera.updateProjectionMatrix();
    camera.lookAt(500 * Math.sin(phi) * Math.cos(theta), 500 * Math.cos(phi), 500 * Math.sin(phi) * Math.sin(theta));
    renderer.render(scene, camera);
  }

  function loop(now) {
    raf = 0;
    const moving = Math.abs(vLon) > 0.001 || Math.abs(vLat) > 0.001;
    if (!dragging) {
      lon += vLon; lat += vLat;
      vLon *= 0.94; vLat *= 0.94; // momentum decays
      if (canDrift() && now - idleSince > 2500) lon += 0.035; // ~2°/s idle drift
    }
    draw();
    if (visible && (dragging || moving || canDrift())) raf = requestAnimationFrame(loop);
  }
  function wake() { if (!raf && visible && started) raf = requestAnimationFrame(loop); }

  // Pointer: drag to look; flick keeps momentum.
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp; vLon = vLat = 0;
    stage.setPointerCapture(e.pointerId); root.classList.add('is-dragging', 'was-used');
    wake();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const k = fov / stage.clientHeight; // degrees per pixel
    const dx = (e.clientX - lastX) * k, dy = (e.clientY - lastY) * k;
    lon -= dx; lat += dy;
    const dt = Math.max(1, e.timeStamp - lastT);
    vLon = (-dx / dt) * 16; vLat = (dy / dt) * 16;
    lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
  });
  const end = () => { if (!dragging) return; dragging = false; idleSince = performance.now(); root.classList.remove('is-dragging'); wake(); };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  // Keyboard: arrows look around, +/- zoom.
  stage.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
    if (step) { e.preventDefault(); lon += step[0]; lat += step[1]; idleSince = performance.now(); root.classList.add('was-used'); draw(); }
    if (e.key === '+' || e.key === '=') { fov = Math.max(40, fov - 6); draw(); }
    if (e.key === '-') { fov = Math.min(90, fov + 6); draw(); }
  });
  // Scene buttons (radio group).
  buttons.forEach((b, i) => {
    b.addEventListener('click', () => { show(i); idleSince = performance.now(); });
    b.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      const n = (i + d + buttons.length) % buttons.length;
      buttons[n].focus(); show(n);
    });
  });

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) start();
    wake();
  }, { rootMargin: '300px 0px' }).observe(root);
}
