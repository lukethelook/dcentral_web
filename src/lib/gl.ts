/* ──────────────────────────────────────────────────────────────────────────
   WebGL layer (OGL — ~10 kB). Two reusable pieces:

   • flowmapText  — renders text to a 2D canvas → texture, then distorts it with
                    a cursor-VELOCITY flowmap (ping-pong RG buffer) + RGB split.
                    The signature hero effect.
   • floatingPreview — a small canvas that shows an image distorted by pointer
                    velocity; the work-index hover preview.

   Both no-op gracefully and expose start/stop so an IntersectionObserver can
   keep only on-screen contexts running.
   ────────────────────────────────────────────────────────────────────────── */
import { Renderer, Triangle, Program, Mesh, Texture, RenderTarget, Vec2 } from 'ogl';

const DPR = () => Math.min(window.devicePixelRatio || 1, 1.5);

/* ── Flowmap-distorted text ─────────────────────────────────────────────── */
export interface FlowmapTextOpts {
  /** Paints the text onto the offscreen 2D canvas. Called on load + resize. */
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  strength?: number;    // how far the flow displaces the text (uv units)
  chromatic?: number;   // RGB-split amount relative to displacement
  falloff?: number;     // brush radius
  dissipation?: number; // how fast the flow fades (0..1, higher = lingers)
}

export function flowmapText(canvas: HTMLCanvasElement, opts: FlowmapTextOpts) {
  const renderer = new Renderer({ canvas, dpr: DPR(), alpha: true, premultipliedAlpha: false });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);

  // text → texture (offscreen 2D canvas)
  const tex2d = document.createElement('canvas');
  const tctx = tex2d.getContext('2d')!;
  const texture = new Texture(gl, { image: tex2d, generateMipmaps: false });

  // flowmap ping-pong targets (half-res is plenty — the flow is low frequency)
  const makeRT = () => new RenderTarget(gl, { width: 1, height: 1, type: gl.UNSIGNED_BYTE });
  let rtA = makeRT();
  let rtB = makeRT();

  const mouse = new Vec2(-1, -1);
  const lastMouse = new Vec2(-1, -1);
  const velocity = new Vec2(0, 0);
  let aspect = 1;

  const flowProgram = new Program(gl, {
    vertex: BASE_VERT,
    fragment: /* glsl */ `
      precision highp float;
      uniform sampler2D tMap;
      uniform float uFalloff; uniform float uDissipation; uniform float uAspect;
      uniform vec2 uMouse; uniform vec2 uVelocity;
      varying vec2 vUv;
      void main() {
        vec4 color = texture2D(tMap, vUv) * uDissipation;
        vec2 cursor = vUv - uMouse; cursor.x *= uAspect;
        vec3 stamp = vec3(uVelocity * vec2(1.0, -1.0),
                          1.0 - pow(1.0 - min(1.0, length(uVelocity)), 3.0));
        float falloff = smoothstep(uFalloff, 0.0, length(cursor));
        color.rgb = mix(color.rgb, stamp, vec3(falloff));
        gl_FragColor = color;
      }`,
    uniforms: {
      tMap: { value: rtA.texture },
      uFalloff: { value: opts.falloff ?? 0.18 },
      uDissipation: { value: opts.dissipation ?? 0.92 },
      uAspect: { value: 1 },
      uMouse: { value: mouse },
      uVelocity: { value: velocity },
    },
  });
  const flowMesh = new Mesh(gl, { geometry: new Triangle(gl), program: flowProgram });

  const mainProgram = new Program(gl, {
    vertex: BASE_VERT,
    fragment: /* glsl */ `
      precision highp float;
      uniform sampler2D tText; uniform sampler2D tFlow;
      uniform float uStrength; uniform float uChromatic; uniform float uTime;
      varying vec2 vUv;
      const vec3 PAPER = vec3(0.957, 0.957, 0.941);
      void main() {
        vec2 flow = texture2D(tFlow, vUv).xy;
        // gentle idle drift so it never looks dead
        vec2 idle = vec2(sin(uTime * 0.6 + vUv.y * 9.0), cos(uTime * 0.5 + vUv.x * 7.0)) * 0.0016;
        vec2 disp = flow * uStrength + idle;
        vec2 dir = disp * uChromatic;
        float ar = texture2D(tText, vUv + disp + dir).a;
        float ag = texture2D(tText, vUv + disp).a;
        float ab = texture2D(tText, vUv + disp - dir).a;
        vec3 rgb = vec3(ar, ag, ab) * PAPER;
        float a = max(ar, max(ag, ab));
        gl_FragColor = vec4(rgb, a);
      }`,
    uniforms: {
      tText: { value: texture },
      tFlow: { value: rtB.texture },
      uStrength: { value: opts.strength ?? 0.22 },
      uChromatic: { value: opts.chromatic ?? 0.35 },
      uTime: { value: 0 },
    },
    transparent: true,
  });
  const mainMesh = new Mesh(gl, { geometry: new Triangle(gl), program: mainProgram });

  function resize() {
    // Measure the HOST element, not the canvas: OGL sets an inline 300×150 size
    // on the canvas which would otherwise win over our CSS width/height:100%.
    const host = (canvas.parentElement as HTMLElement | null) ?? canvas;
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.dpr = DPR();
    renderer.setSize(w, h);
    aspect = w / h;
    flowProgram.uniforms.uAspect.value = aspect;

    // repaint text texture at device resolution
    const dpr = DPR();
    tex2d.width = Math.round(w * dpr);
    tex2d.height = Math.round(h * dpr);
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.clearRect(0, 0, w, h);
    opts.paint(tctx, w, h);
    texture.image = tex2d; texture.needsUpdate = true;

    // resize flow targets (half res)
    const fw = Math.max(2, Math.round(w / 2));
    const fh = Math.max(2, Math.round(h / 2));
    rtA = new RenderTarget(gl, { width: fw, height: fh, type: gl.UNSIGNED_BYTE });
    rtB = new RenderTarget(gl, { width: fw, height: fh, type: gl.UNSIGNED_BYTE });
  }
  resize();
  window.addEventListener('resize', resize);

  let lastMove = -1e9;
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = 1 - (e.clientY - r.top) / r.height;
    if (lastMouse.x >= 0) {
      velocity.set((x - lastMouse.x), (y - lastMouse.y));
      velocity.x *= 6; velocity.y *= 6; // amplify so motion is felt
    }
    mouse.set(x, y);
    lastMouse.set(x, y);
    lastMove = performance.now();
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  let raf = 0; let running = false; const t0 = performance.now();
  let autoX = 0.5, autoY = 0.5;
  function frame(now: number) {
    // Auto-drive when there's no active cursor (touch devices always, desktop
    // when idle): a virtual point glides along a path so the distortion lives
    // without input. Real pointer movement takes over instantly.
    if (now - lastMove > 1600) {
      const at = now / 1000;
      const tx = 0.5 + Math.sin(at * 0.7) * 0.34 + Math.sin(at * 0.23) * 0.08;
      const ty = 0.5 + Math.sin(at * 1.03 + 1.2) * 0.26;
      velocity.set((tx - autoX) * 11, (ty - autoY) * 11);
      mouse.set(tx, ty);
      autoX = tx; autoY = ty;
    } else {
      // decay velocity each frame
      velocity.x *= 0.86; velocity.y *= 0.86;
    }

    // update flowmap: read rtA → write rtB, then swap so rtB holds latest
    flowProgram.uniforms.tMap.value = rtA.texture;
    renderer.render({ scene: flowMesh, target: rtB });
    const tmp = rtA; rtA = rtB; rtB = tmp;

    mainProgram.uniforms.tFlow.value = rtA.texture;
    mainProgram.uniforms.uTime.value = (now - t0) / 1000;
    renderer.render({ scene: mainMesh });

    if (running) raf = requestAnimationFrame(frame);
  }

  return {
    start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } },
    stop() { running = false; cancelAnimationFrame(raf); },
    repaint() { resize(); },
    renderStatic() { renderer.render({ scene: mainMesh }); },
  };
}

/* ── Floating image preview (work index hover) ──────────────────────────── */
export interface FloatingPreviewHandle {
  setImage(src: CanvasImageSource): void;
  show(): void;
  hide(): void;
  setVelocity(vx: number, vy: number): void;
}

export function floatingPreview(canvas: HTMLCanvasElement): FloatingPreviewHandle {
  const renderer = new Renderer({ canvas, dpr: DPR(), alpha: true });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);

  const tex = new Texture(gl, { generateMipmaps: false });
  const vel = new Vec2(0, 0);

  const program = new Program(gl, {
    vertex: BASE_VERT,
    fragment: /* glsl */ `
      precision highp float;
      uniform sampler2D tImage; uniform float uHover; uniform vec2 uVel; uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        // reveal scale from centre
        float s = mix(1.18, 1.0, uHover);
        uv = (uv - 0.5) * s + 0.5;
        vec2 d = uVel * 0.35;
        float r = texture2D(tImage, uv + d).r;
        float g = texture2D(tImage, uv).g;
        float b = texture2D(tImage, uv - d).b;
        vec3 col = vec3(r, g, b);
        gl_FragColor = vec4(col, uHover);
      }`,
    uniforms: {
      tImage: { value: tex },
      uHover: { value: 0 },
      uVel: { value: vel },
      uTime: { value: 0 },
    },
    transparent: true,
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

  const resize = () => {
    const host = (canvas.parentElement as HTMLElement | null) ?? canvas;
    renderer.dpr = DPR();
    renderer.setSize(host.clientWidth || 360, host.clientHeight || 460);
  };
  resize();
  window.addEventListener('resize', resize);

  let raf = 0; const t0 = performance.now();
  const loop = (now: number) => {
    vel.x *= 0.9; vel.y *= 0.9;
    program.uniforms.uTime.value = (now - t0) / 1000;
    renderer.render({ scene: mesh });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    setImage(src) { tex.image = src as any; tex.needsUpdate = true; },
    show() { animate(program.uniforms.uHover, 1, 0.12); },
    hide() { animate(program.uniforms.uHover, 0, 0.12); },
    setVelocity(vx, vy) { vel.set(vx, vy); },
  };
}

/* tiny eased uniform tween without pulling gsap into this module */
function animate(u: { value: number }, to: number, speed: number) {
  const step = () => {
    u.value += (to - u.value) * speed;
    if (Math.abs(to - u.value) > 0.001) requestAnimationFrame(step);
    else u.value = to;
  };
  step();
}

const BASE_VERT = /* glsl */ `
  attribute vec2 uv; attribute vec2 position;
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }
`;
