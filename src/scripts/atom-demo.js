/**
 * Quantiflux — live demo of the atom hero (ported 1:1 from the study's
 * HeroCanvas.tsx: torus-knot core with shatter/ripple shaders, polyhedra,
 * orbital rings, particles, bloom + chromatic-aberration post-pass).
 * Wired up for the case page: pointer = approach/ripple, click/tap = shatter
 * burst (the shader supports it; the study never triggered it), and the four
 * states — Ruhe · Annäherung · Berührung · Rückkehr — light up live.
 * Renders only while visible; reduced motion / global pause show a still frame.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const ChromaShader = {
  uniforms: {
    tDiffuse: { value: null }, uAberration: { value: 0 }, uNoise: { value: 0 },
    uTime: { value: 0 }, uShake: { value: 0 }, uGlow: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uAberration; uniform float uNoise;
    uniform float uTime; uniform float uShake; uniform float uGlow;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      if (uShake > 0.005) {
        float t = uTime;
        float ax = sin(t * 23.7) * 0.55 + sin(t * 37.1) * 0.28 + sin(t * 61.3) * 0.17;
        float ay = cos(t * 19.3) * 0.50 + cos(t * 43.7) * 0.32 + cos(t * 73.1) * 0.18;
        vec2 shakeDir = vec2(ax, ay) * uShake * 0.012;
        vec4 col = vec4(0.0); float w = 0.0;
        for (int i = 0; i < 5; i++) { float t2 = (float(i) - 2.0) / 2.0; float wi = exp(-t2 * t2 * 1.8); col += texture2D(tDiffuse, uv + shakeDir * t2) * wi; w += wi; }
        uv += shakeDir * 0.5; gl_FragColor = col / w;
      } else { gl_FragColor = texture2D(tDiffuse, uv); }
      if (uNoise > 0.01) {
        float grain = rand(vUv * 800.0 + uTime * 27.0) * 2.0 - 1.0;
        uv += grain * uNoise * 0.004;
        vec4 noisy = texture2D(tDiffuse, clamp(uv, 0.001, 0.999));
        gl_FragColor = mix(gl_FragColor, noisy, uNoise * 0.4);
      }
      vec2 dir2 = vUv - vec2(0.5); float dist2 = length(dir2);
      vec2 offset = normalize(dir2 + vec2(0.0001)) * dist2 * uAberration * 0.028;
      float r2 = texture2D(tDiffuse, vUv + offset).r; float b2 = texture2D(tDiffuse, vUv - offset).b;
      gl_FragColor.r = mix(gl_FragColor.r, r2, min(uAberration, 1.0));
      gl_FragColor.b = mix(gl_FragColor.b, b2, min(uAberration, 1.0));
      if (uGlow > 0.01) {
        float vignette = 1.0 - smoothstep(0.0, 0.85, dist2);
        gl_FragColor.rgb += vignette * uGlow * vec3(1.0, 0.22, 0.05) * 0.6;
        gl_FragColor.rgb *= 1.0 + uGlow * 0.25;
      }
    }`,
};

const shatterVert = /* glsl */`
  uniform float uTime; uniform float uHover; uniform float uBurst; uniform vec3 uMouseWorld;
  float hash31(vec3 p) { p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }
  float noise3(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash31(i), hash31(i+vec3(1,0,0)), u.x), mix(hash31(i+vec3(0,1,0)), hash31(i+vec3(1,1,0)), u.x), u.y),
               mix(mix(hash31(i+vec3(0,0,1)), hash31(i+vec3(1,0,1)), u.x), mix(hash31(i+vec3(0,1,1)), hash31(i+vec3(1,1,1)), u.x), u.y), u.z);
  }
  void main() {
    vec3 pos = position;
    float dist = length(pos - uMouseWorld);
    float falloff = 1.0 - smoothstep(0.0, 2.6, dist);
    float ripple = sin(dist * 6.0 - uTime * 7.0) * falloff * uHover;
    pos += normalize(pos + vec3(0.0001)) * ripple * 0.18;
    float wob = noise3(pos * 3.5 + uTime * 1.8) * 2.0 - 1.0;
    pos += normalize(pos + vec3(0.0001)) * wob * uHover * 0.12;
    vec3 seed = floor(position * 2.8) * 0.37;
    vec3 shardDir = normalize(vec3(hash31(seed + vec3(1.7)) - 0.5, hash31(seed + vec3(3.3)) - 0.5, hash31(seed + vec3(5.1)) - 0.5));
    float shardScale = 0.5 + hash31(seed + vec3(7.9)) * 1.0;
    shardDir = normalize(shardDir + normalize(pos) * 1.2);
    pos += shardDir * uBurst * 2.6 * shardScale;
    float shimmer = noise3(pos * 6.0 + uTime * 8.0) * uBurst * 0.25;
    pos += normalize(pos + vec3(0.0001)) * shimmer;
    pos *= 1.0 + uHover * 0.022 * sin(uTime * 2.5);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }`;
const shatterFrag = /* glsl */`
  uniform vec3 uColor; uniform float uOpacity; uniform float uHover; uniform float uBurst;
  void main() {
    // Softer than the study: thousands of overlapping edges add up, so the
    // burst thins the shards out instead of pushing them past white.
    vec3 col = uColor * (1.0 + uHover * 0.3 + uBurst * 0.45);
    col = mix(col, vec3(1.0, 0.72, 0.5), uBurst * 0.3);
    float alpha = uOpacity * (1.0 + uHover * 0.1) * (1.0 - uBurst * 0.45);
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }`;

document.querySelectorAll('[data-atom-demo]').forEach(init);

function init(root) {
  const stage = root.querySelector('.atom-stage');
  const canvas = stage.querySelector('canvas');
  const burstBtn = root.querySelector('[data-atom-burst]');
  const states = [...root.querySelectorAll('[data-atom-state]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = document.documentElement.classList.contains('motion-paused');
  document.addEventListener('motion-state', (e) => { paused = e.detail.paused; wake(); });
  const still = () => reduced.matches || paused;

  let started = false, visible = false, raf = 0;
  let renderer, composer, bloomPass, chromaPass, camera, scene, draw;
  let targetX = 0, targetY = 0, curX = 0, curY = 0, hoverTarget = 0, hoverCur = 0, burstCur = 0, burstAt = -1e9, t = 0, last = 0;
  const mouseWorld = new THREE.Vector3(99, 99, 0);

  function start() {
    if (started) return;
    started = true;
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.z = 5.8;
    composer = new EffectComposer(renderer);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.18, 0.3, 0.15);
    chromaPass = new ShaderPass(ChromaShader);
    composer.addPass(new RenderPass(scene, camera)); composer.addPass(bloomPass); composer.addPass(chromaPass); composer.addPass(new OutputPass());

    const C_HOT = new THREE.Color(0xff3a1a), C_COOL = new THREE.Color(0xff8855), C_WHITE = new THREE.Color(0xffeedd), C_MID = new THREE.Color(0xe42718);
    const shaderMat = (color, opacity) => new THREE.ShaderMaterial({
      vertexShader: shatterVert, fragmentShader: shatterFrag, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uHover: { value: 0 }, uBurst: { value: 0 }, uMouseWorld: { value: new THREE.Vector3() }, uColor: { value: color.clone() }, uOpacity: { value: opacity } },
    });
    const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const edges = (g, m) => new THREE.LineSegments(new THREE.EdgesGeometry(g), m);
    const coreMat = shaderMat(C_HOT, 1.0), ghostMat = shaderMat(C_COOL, 0.15);
    const coreMesh = edges(new THREE.TorusKnotGeometry(1.25, 0.36, 180, 20, 2, 3), coreMat);
    const ghostMesh = edges(new THREE.TorusKnotGeometry(1.55, 0.22, 140, 14, 3, 5), ghostMat);
    const icoMat = lineMat(C_MID, 0.1), icoMesh = edges(new THREE.IcosahedronGeometry(2.7, 1), icoMat);
    const dodMat = lineMat(C_HOT, 0.07), dodMesh = edges(new THREE.DodecahedronGeometry(2.0, 0), dodMat);
    const ring = (rot) => { const m = edges(new THREE.TorusGeometry(2.1, 0.008, 3, 64), lineMat(C_HOT, 0.1)); m.rotation.set(...rot); return m; };
    const ring1 = ring([Math.PI / 2, 0, 0]), ring2 = ring([0, 0, Math.PI / 5]), ring3 = ring([Math.PI / 3, Math.PI / 4, 0]);
    const particles = (count, rMin, rMax, color, size, opacity) => {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = rMin + Math.random() * (rMax - rMin), th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      return new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity, sizeAttenuation: true, depthWrite: false }));
    };
    const innerPts = particles(120, 1.5, 2.4, C_HOT, 0.055, 0.6), outerPts = particles(280, 2.6, 5.5, C_WHITE, 0.03, 0.18), glowPts = particles(40, 0.8, 1.4, C_HOT, 0.09, 0.8);
    const coreSphere = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), new THREE.MeshBasicMaterial({ color: C_HOT, transparent: true, opacity: 0.85 }));
    scene.add(coreMesh, ghostMesh, icoMesh, dodMesh, ring1, ring2, ring3, innerPts, outerPts, glowPts, coreSphere);

    const inv = new THREE.Matrix4();
    draw = () => {
      inv.copy(coreMesh.matrixWorld).invert();
      const mwLocal = mouseWorld.clone().applyMatrix4(inv);
      inv.copy(ghostMesh.matrixWorld).invert();
      const mwGhost = mouseWorld.clone().applyMatrix4(inv);
      const set = (m, h, b, mw) => { m.uniforms.uTime.value = t; m.uniforms.uHover.value = h; m.uniforms.uBurst.value = b; m.uniforms.uMouseWorld.value.copy(mw); };
      set(coreMat, hoverCur, burstCur, mwLocal); set(ghostMat, hoverCur * 0.7, burstCur * 0.8, mwGhost);
      chromaPass.uniforms.uAberration.value = hoverCur * 0.5 + burstCur * 2.5;
      chromaPass.uniforms.uNoise.value = burstCur * 0.9;
      chromaPass.uniforms.uTime.value = t;
      chromaPass.uniforms.uShake.value = hoverCur * 0.22 + burstCur * 0.5;
      chromaPass.uniforms.uGlow.value = hoverCur * 0.12 + burstCur * 0.22;
      // Tuned down from the study (0.55 / 3.5) so the burst reads as light, not a white-out.
      bloomPass.strength = 0.15 + 0.05 * Math.abs(Math.sin(t * 0.35)) + hoverCur * 0.32 + burstCur * 0.7;
      const breath = 1 + 0.018 * Math.sin(t * 0.7), breath2 = 1 + 0.012 * Math.sin(t * 0.45 + 1.2);
      coreMesh.rotation.set(t * 0.14 - curY * 0.85, t * 0.22 + curX * 1.1, t * 0.06); coreMesh.scale.setScalar(breath + burstCur * 0.3);
      coreMat.uniforms.uOpacity.value = 0.82 + 0.18 * Math.sin(t * 1.1);
      ghostMesh.rotation.set(t * 0.11 + curY * 0.4, -t * 0.17 + curX * 0.5, -t * 0.08); ghostMesh.scale.setScalar(breath2 + burstCur * 0.2);
      ghostMat.uniforms.uOpacity.value = 0.08 + 0.09 * Math.abs(Math.sin(t * 0.6 + 0.5));
      icoMesh.rotation.set(-t * 0.05 + curY * 0.2, -t * 0.07 - curX * 0.25, t * 0.03);
      icoMat.opacity = 0.06 + 0.06 * Math.sin(t * 0.4) + hoverCur * 0.06 + burstCur * 0.15;
      dodMesh.rotation.set(-t * 0.08, t * 0.1 + curX * 0.15, t * 0.05);
      dodMat.opacity = 0.04 + 0.04 * Math.sin(t * 0.55 + 1.0) + hoverCur * 0.04 + burstCur * 0.12;
      const spin = 1 + burstCur * 6;
      ring1.rotation.z = t * 0.18 * spin + curX * 0.3; ring1.rotation.x = Math.PI / 2 + t * 0.06;
      ring2.rotation.y = t * 0.14 * spin; ring2.rotation.z = t * 0.1 - curY * 0.2;
      ring3.rotation.x = Math.PI / 3 + t * 0.09; ring3.rotation.z = t * 0.13 * spin + curX * 0.2;
      [ring1, ring2, ring3].forEach((r, i) => { r.material.opacity = 0.08 + 0.07 * Math.sin(t * [0.9, 0.7, 1.1][i] + i) + hoverCur * 0.18 + burstCur * 0.5; });
      innerPts.rotation.set(t * 0.12 - curY * 0.4, t * 0.28 + curX * 0.6, 0); innerPts.scale.setScalar(1 + burstCur * 1.8);
      innerPts.material.opacity = 0.32 + 0.18 * Math.sin(t * 0.8) + hoverCur * 0.28 + burstCur * 0.5; innerPts.material.size = 0.055 + hoverCur * 0.03 + burstCur * 0.08;
      outerPts.rotation.set(0, t * 0.04, t * 0.02); outerPts.scale.setScalar(1 + burstCur * 0.6);
      outerPts.material.opacity = 0.1 + 0.07 * Math.sin(t * 0.3 + 0.5) + hoverCur * 0.1;
      glowPts.rotation.set(t * 0.2 - curY * 0.6, -t * 0.35 + curX * 0.8, 0); glowPts.scale.setScalar(1 + burstCur * 2.5);
      glowPts.material.opacity = 0.42 + 0.22 * Math.sin(t * 1.8) + hoverCur * 0.35 + burstCur * 0.6;
      coreSphere.scale.setScalar(1 + 0.09 * Math.sin(t * 1.4) + hoverCur * 0.15 + burstCur * 0.8);
      coreSphere.material.opacity = 0.55 + 0.2 * Math.sin(t * 1.4) + hoverCur * 0.3 + burstCur * 0.4;
      scene.rotation.y = curX * 0.18; scene.rotation.x = -curY * 0.12;
      const q = hoverCur * 0.01, qi = t * 22;
      camera.position.x = Math.sin(t * 0.12) * 0.12 + q * (Math.sin(qi) * 0.45 + Math.sin(qi * 1.41) * 0.3 + Math.sin(qi * 2.13) * 0.15);
      camera.position.y = Math.cos(t * 0.09) * 0.08 + q * (Math.cos(qi * 0.97) * 0.4 + Math.cos(qi * 1.57) * 0.35 + Math.cos(qi * 2.51) * 0.15);
      camera.lookAt(scene.position);
      composer.render();
    };
    new ResizeObserver(resize).observe(stage);
    resize();
  }

  function resize() {
    if (!renderer) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloomPass.resolution.set(w, h);
    camera.aspect = w / h;
    camera.position.z = w / h < 1 ? 7.4 : 5.8; // portrait: step back so the atom fits
    camera.updateProjectionMatrix();
    draw();
  }

  // Live state readout: Ruhe · Annäherung · Berührung · Rückkehr
  let shown = '';
  function setState(s) {
    if (s === shown) return; shown = s;
    states.forEach((el) => el.classList.toggle('is-on', el.dataset.atomState === s));
  }

  function loop(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    t += dt;
    const k = dt * 60; // original easing constants were tuned per 60 fps frame
    curX += (targetX - curX) * (1 - Math.pow(1 - 0.035, k));
    curY += (targetY - curY) * (1 - Math.pow(1 - 0.035, k));
    hoverCur += (hoverTarget - hoverCur) * (1 - Math.pow(1 - 0.045, k));
    burstCur *= Math.pow(0.955, k);
    const since = now - burstAt;
    setState(since < 750 ? 'beruehrung' : since < 2600 ? 'rueckkehr' : hoverCur > 0.3 ? 'annaeherung' : 'ruhe');
    draw();
    if (visible && !still()) raf = requestAnimationFrame(loop);
  }
  function wake() {
    if (!started) return;
    if (still()) { draw(); setState('ruhe'); return; }
    if (!raf && visible) { last = 0; raf = requestAnimationFrame(loop); }
  }

  const toWorld = (e) => {
    const r = canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(v, camera);
    ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), mouseWorld);
    targetX = v.x * 0.7; targetY = -v.y * 0.5;
  };
  const burst = () => { if (still()) return; burstCur = 1; burstAt = performance.now(); root.classList.add('was-used'); wake(); };
  stage.addEventListener('pointerenter', () => { hoverTarget = 1; wake(); });
  stage.addEventListener('pointerleave', () => { hoverTarget = 0; targetX = targetY = 0; });
  stage.addEventListener('pointermove', (e) => { if (camera) toWorld(e); hoverTarget = 1; });
  stage.addEventListener('pointerdown', (e) => { if (camera) toWorld(e); hoverTarget = 1; burst(); });
  burstBtn?.addEventListener('click', burst);

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) start();
    wake();
  }, { rootMargin: '200px 0px' }).observe(root);
}
