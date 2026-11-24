// Erzeugt vor jedem Build verkleinerte Varianten aller Bilder unter public/images
// (WebP in mehreren Breiten) nach public/_r/… und schreibt ein Manifest nach
// src/generated/images.json. src/lib/img.ts liest das Manifest und baut daraus
// srcset/sizes. Bilder ohne Eintrag (z. B. frisch im CMS hochgeladen, noch nicht
// gebaut) werden unverändert ausgeliefert – nichts bricht.
//
// Aufruf: automatisch über "prebuild"/"predev", manuell: node scripts/responsive-images.mjs
import { readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, relative, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(root, 'public', 'images');
const OUT_DIR = join(root, 'public', '_r');
const MANIFEST = join(root, 'src', 'generated', 'images.json');

const WIDTHS = [480, 800, 1200, 1600, 2000];
const MIN_WIDTH = 700; // kleinere Bilder lohnen keine Varianten
const QUALITY = 72;
const RASTER = new Set(['.jpg', '.jpeg', '.png', '.webp']);
// 360°-Panoramen brauchen die volle Auflösung, -sm sind bereits Thumbnails
const SKIP = (rel) => rel.startsWith(`panoramas${sep}`) || /-sm\.[a-z]+$/i.test(rel);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (RASTER.has(extname(entry.name).toLowerCase())) yield p;
  }
}

async function isFresh(out, srcMtime) {
  try {
    return (await stat(out)).mtimeMs >= srcMtime;
  } catch {
    return false;
  }
}

const manifest = {};
const jobs = [];
for await (const file of walk(SRC_DIR)) {
  const rel = relative(SRC_DIR, file);
  if (SKIP(rel)) continue;
  jobs.push(file);
}

let created = 0;
const queue = [...jobs];
async function worker() {
  while (queue.length) {
    const file = queue.shift();
    const rel = relative(SRC_DIR, file);
    const srcMtime = (await stat(file)).mtimeMs;
    const meta = await sharp(file).metadata();
    const w = meta.autoOrient?.width ?? meta.width;
    const h = meta.autoOrient?.height ?? meta.height;
    if (!w || !h) continue;
    const key = '/images/' + rel.split(sep).join('/');
    const variants = w >= MIN_WIDTH ? WIDTHS.filter((x) => x < w * 0.92) : [];
    for (const vw of variants) {
      const out = join(OUT_DIR, rel.replace(/\.[^.]+$/, `-${vw}.webp`));
      if (await isFresh(out, srcMtime)) continue;
      await mkdir(dirname(out), { recursive: true });
      await sharp(file).rotate().resize({ width: vw }).webp({ quality: QUALITY, effort: 4 }).toFile(out);
      created++;
    }
    manifest[key] = { w, h, v: variants };
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: 4 }, worker));

await mkdir(dirname(MANIFEST), { recursive: true });
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(MANIFEST, JSON.stringify(sorted, null, 0) + '\n');
console.log(`[responsive-images] ${Object.keys(manifest).length} Bilder, ${created} Varianten neu erzeugt (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
