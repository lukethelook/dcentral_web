// Builds the "Eine Linie" studio portrait: one continuous line (a travelling-
// salesman path through weighted stipple points) drawn from the studio photo.
//
//   node scripts/build-oneline.mjs [input] [points]
//   default input: public/images/studio/lukas.webp · default points: 20000
//
// Output: public/data/studio-line.bin — Uint16 pairs (x, y) in drawing order,
// normalised to the face's bounding box (0…65535), preceded by a small header:
//   uint32 count · float32 aspect (bbox width / height in source pixels)
// Re-run whenever the portrait changes.
import fs from 'node:fs';
import sharp from 'sharp';

const input = process.argv[2] || 'public/images/studio/lukas.webp';
const N = Number(process.argv[3] || 20000);
const W = 584, H = 440;

// 1 · luminance field of a head-and-shoulders crop, with local contrast (eyes, brows, smile)
const meta = await sharp(input).metadata();
const sw = meta.width * 0.64, sh = sw * 880 / 1168;
const crop = { left: Math.round(meta.width * 0.63 - sw / 2), top: Math.round(Math.max(0, meta.height * 0.36 - sh * 0.42)), width: Math.round(sw), height: Math.round(sh) };
const grey = (sigma) => {
  let img = sharp(input).extract(crop).resize(W, H).greyscale();
  if (sigma) img = img.blur(sigma);
  return img.raw().toBuffer();
};
const [soft, wide] = await Promise.all([grey(0.8), grey(10)]);
const norm = (v) => Math.max(0, Math.min(1, (v / 255 - 0.035) / 0.62));
const dens = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const l = norm(soft[i]), lw = norm(wide[i]);
  const L = Math.pow(Math.max(0, Math.min(1, l + (l - lw) * 1.1)), 0.85);
  const t = Math.max(0, (L - 0.05) / 0.95);
  dens[i] = t <= 0 ? 0 : Math.pow(t, 1.6);
}

// 2 · weighted Voronoi stippling (Secord 2002): rejection-sample, then Lloyd-relax towards density
let seed = 1234567; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let n = N; const px = new Float32Array(n), py = new Float32Array(n);
for (let k = 0; k < n;) { const x = rand() * W, y = rand() * H; if (rand() < dens[(y | 0) * W + (x | 0)]) { px[k] = x; py[k] = y; k++; } }
const cell = Math.sqrt(W * H / n) * 1.2;
function grid() {
  const gw = Math.ceil(W / cell), gh = Math.ceil(H / cell), g = Array.from({ length: gw * gh }, () => []);
  for (let k = 0; k < n; k++) g[Math.min(gh - 1, py[k] / cell | 0) * gw + Math.min(gw - 1, px[k] / cell | 0)].push(k);
  return { g, gw, gh };
}
function nearest(G, x, y) {
  const cx = x / cell | 0, cy = y / cell | 0; let best = -1, bd = Infinity;
  for (let r = 1; r < 8; r++) {
    for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) {
      if (i < 0 || j < 0 || i >= G.gw || j >= G.gh) continue;
      for (const k of G.g[j * G.gw + i]) { const d = (px[k] - x) ** 2 + (py[k] - y) ** 2; if (d < bd) { bd = d; best = k; } }
    }
    if (best >= 0 && Math.sqrt(bd) < (r - 0.5) * cell) break;
  }
  return best;
}
for (let it = 0; it < 14; it++) {
  const G = grid(), sx = new Float64Array(n), sy = new Float64Array(n), sw2 = new Float64Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = dens[y * W + x]; if (d < 0.004) continue;
    const k = nearest(G, x + 0.5, y + 0.5); sx[k] += (x + 0.5) * d; sy[k] += (y + 0.5) * d; sw2[k] += d;
  }
  for (let k = 0; k < n; k++) if (sw2[k] > 0) { px[k] = sx[k] / sw2[k]; py[k] = sy[k] / sw2[k]; }
}
// drop isolated stipples (stray points in the dark sweater would cause long jumps)
{
  const G = grid(), keep = [];
  for (let k = 0; k < n; k++) {
    let c = 0; const cx = px[k] / cell | 0, cy = py[k] / cell | 0;
    for (let j = cy - 2; j <= cy + 2; j++) for (let i = cx - 2; i <= cx + 2; i++) {
      if (i < 0 || j < 0 || i >= G.gw || j >= G.gh) continue;
      for (const q of G.g[j * G.gw + i]) if (q !== k && Math.hypot(px[q] - px[k], py[q] - py[k]) < cell * 2.2) c++;
    }
    if (c >= 3) keep.push(k);
  }
  const kx = keep.map((k) => px[k]), ky = keep.map((k) => py[k]); n = keep.length; px.set(kx); py.set(ky);
}

// 3 · tour: Hilbert-curve order (locality, no long jumps), then 2-opt with neighbour lists
function hilbert(x, y, order) {
  let d = 0;
  for (let s = order >> 1; s > 0; s >>= 1) {
    const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0; d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } const t = x; x = y; y = t; }
  }
  return d;
}
const ord = 2048, key = new Float64Array(n);
for (let k = 0; k < n; k++) key[k] = hilbert(Math.min(ord - 1, px[k] / W * ord | 0), Math.min(ord - 1, py[k] / H * ord | 0), ord);
const tour = Int32Array.from(Array.from({ length: n }, (_, k) => k).sort((a, b) => key[a] - key[b]));
const K = 10, G = grid(), nb = new Int32Array(n * K);
for (let k = 0; k < n; k++) {
  const cand = []; const cx = px[k] / cell | 0, cy = py[k] / cell | 0;
  for (let r = 1; cand.length < K + 1 && r < 12; r++) {
    cand.length = 0;
    for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) {
      if (i < 0 || j < 0 || i >= G.gw || j >= G.gh) continue;
      for (const q of G.g[j * G.gw + i]) if (q !== k) cand.push(q);
    }
  }
  cand.sort((a, b) => ((px[a] - px[k]) ** 2 + (py[a] - py[k]) ** 2) - ((px[b] - px[k]) ** 2 + (py[b] - py[k]) ** 2));
  for (let j = 0; j < K; j++) nb[k * K + j] = cand[Math.min(j, cand.length - 1)];
}
const dist = (a, b) => Math.hypot(px[a] - px[b], py[a] - py[b]);
const pos = new Int32Array(n); for (let i = 0; i < n; i++) pos[tour[i]] = i;
const reverse = (i, j) => { while (i < j) { const a = tour[i], b = tour[j]; tour[i] = b; pos[b] = i; tour[j] = a; pos[a] = j; i++; j--; } };
const dlb = new Uint8Array(n);
for (let pass = 0, improved = true; improved && pass < 120; pass++) {
  improved = false;
  for (let i = 0; i < n - 1; i++) {
    const a = tour[i], b = tour[i + 1]; if (dlb[a]) continue; let found = false;
    for (let m = 0; m < K; m++) {
      const c = nb[a * K + m], j = pos[c];
      if (j > i + 1 && j < n - 1) {
        const d = tour[j + 1];
        if (dist(a, c) + dist(b, d) - dist(a, b) - dist(c, d) < -1e-6) { reverse(i + 1, j); improved = found = true; dlb[a] = dlb[b] = dlb[c] = dlb[d] = 0; break; }
      } else if (j < i && j > 0) {
        const p = tour[j - 1];
        if (dist(p, a) + dist(c, b) - dist(p, c) - dist(a, b) < -1e-6) { reverse(j, i); improved = found = true; dlb[a] = dlb[b] = dlb[c] = dlb[p] = 0; break; }
      }
    }
    if (!found) dlb[a] = 1;
  }
}

// 4 · normalise to the bounding box and write the binary
let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
for (let k = 0; k < n; k++) { x0 = Math.min(x0, px[k]); x1 = Math.max(x1, px[k]); y0 = Math.min(y0, py[k]); y1 = Math.max(y1, py[k]); }
const buf = Buffer.alloc(8 + n * 4);
buf.writeUInt32LE(n, 0);
buf.writeFloatLE(((x1 - x0) * crop.width / W) / ((y1 - y0) * crop.height / H), 4);
for (let i = 0; i < n; i++) {
  const k = tour[i];
  buf.writeUInt16LE(Math.round((px[k] - x0) / (x1 - x0) * 65535), 8 + i * 4);
  buf.writeUInt16LE(Math.round((py[k] - y0) / (y1 - y0) * 65535), 10 + i * 4);
}
fs.mkdirSync('public/data', { recursive: true });
fs.writeFileSync('public/data/studio-line.bin', buf);
console.log(`studio-line.bin: ${n} points, ${(buf.length / 1024).toFixed(0)} KB`);
