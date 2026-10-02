// Gallery editor API (dev only — injected by the `dcentral-gallery-editor`
// integration in astro.config.mjs, never part of the production build).
// Reads and writes the same JSON files Keystatic uses, so both editors stay in sync.
import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const prerender = false;

const ROOT = process.cwd();
const CASES = path.join(ROOT, 'src/content/cases');
const PHOTOS = path.join(ROOT, 'src/content/photos');
const PHOTO_IMG = path.join(ROOT, 'public/images/photos');

type Json = Record<string, unknown>;
const readJson = async (file: string): Promise<Json> => JSON.parse(await fs.readFile(file, 'utf8'));
// Same format Keystatic writes: 2-space indent, trailing newline.
const writeJson = (file: string, data: Json) => fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
const ok = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
const fail = (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), { status, headers: { 'content-type': 'application/json' } });
// ids come from file names; never let a request escape the content folders
const safeId = (id: unknown) => (typeof id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(id) ? id : null);

async function readDir(dir: string) {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  return Promise.all(files.map(async (f) => ({ id: f.slice(0, -5), ...(await readJson(path.join(dir, f))) })));
}

function slugify(name: string) {
  return name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'foto';
}
const titleFrom = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

async function uniqueSlug(base: string) {
  let slug = base, n = 2;
  for (;;) {
    try { await fs.access(path.join(PHOTOS, `${slug}.json`)); slug = `${base}-${n++}`; } catch { return slug; }
  }
}

export const GET: APIRoute = async ({ params }) => {
  if (params.action !== 'state') return fail('unknown action', 404);
  const [cases, photos] = await Promise.all([readDir(CASES), readDir(PHOTOS)]);
  return ok({
    cases: cases
      .map((c: Json) => ({ id: c.id, title: c.title, client: c.client, order: c.order ?? 0, galleryTitle: c.galleryTitle ?? '', galleryPhotos: ((c.galleryPhotos as string[]) ?? []).filter(Boolean) }))
      .sort((a, b) => (a.order as number) - (b.order as number)),
    photos: photos.sort((a: Json, b: Json) => (a.order as number) - (b.order as number)),
  });
};

export const POST: APIRoute = async ({ params, request }) => {
  const action = params.action;

  // A project's gallery: title + ordered list of library photo ids.
  if (action === 'gallery') {
    const body = await request.json();
    const id = safeId(body.case);
    if (!id) return fail('invalid case');
    const file = path.join(CASES, `${id}.json`);
    const data = await readJson(file);
    if (typeof body.galleryTitle === 'string') data.galleryTitle = body.galleryTitle;
    data.galleryPhotos = (body.photos as unknown[]).map(safeId).filter(Boolean);
    await writeJson(file, data);
    return ok({ saved: id });
  }

  // Homepage module: exactly these photos are featured, in this order.
  if (action === 'home') {
    const body = await request.json();
    const ids = (body.photos as unknown[]).map(safeId).filter(Boolean) as string[];
    const photos = (await readDir(PHOTOS)).sort((a: Json, b: Json) => (a.order as number) - (b.order as number));
    let rest = ids.length;
    for (const p of photos) {
      const { id, ...data } = p as Json & { id: string };
      const at = ids.indexOf(id), featured = at >= 0, order = featured ? at : rest++;
      if (data.featured !== featured || data.order !== order) await writeJson(path.join(PHOTOS, `${id}.json`), { ...data, featured, order });
    }
    return ok({ saved: ids.length });
  }

  // Inline edits of one photo (title, alt text, series, project link).
  if (action === 'photo') {
    const body = await request.json();
    const id = safeId(body.id);
    if (!id) return fail('invalid photo');
    const file = path.join(PHOTOS, `${id}.json`);
    const data = await readJson(file);
    for (const key of ['title', 'alt', 'series'] as const) if (typeof body[key] === 'string') data[key] = body[key];
    if ('project' in body) data.project = safeId(body.project);
    await writeJson(file, data);
    return ok({ saved: id, photo: { id, ...data } });
  }

  // Drag & drop upload: rotate by EXIF, export 2200 px + 760 px WebP, create the library entry.
  if (action === 'upload') {
    const form = await request.formData();
    const series = String(form.get('series') || 'Fotografie');
    const project = safeId(form.get('project'));
    const existing = await readDir(PHOTOS);
    let order = Math.max(0, ...existing.map((p: Json) => Number(p.order) || 0)) + 1;
    const created: Json[] = [];
    for (const entry of form.getAll('files')) {
      if (!(entry instanceof File) || !entry.type.startsWith('image/')) continue;
      const input = Buffer.from(await entry.arrayBuffer());
      const id = await uniqueSlug(slugify(entry.name));
      const big = await sharp(input).rotate().resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).sharpen({ sigma: 0.6 }).webp({ quality: 84 }).toBuffer({ resolveWithObject: true });
      await fs.writeFile(path.join(PHOTO_IMG, `${id}.webp`), big.data);
      await sharp(input).rotate().resize({ width: 760, height: 760, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(PHOTO_IMG, `${id}-sm.webp`));
      const data = {
        image: `/images/photos/${id}.webp`, thumb: `/images/photos/${id}-sm.webp`,
        alt: '', series, project, width: big.info.width, height: big.info.height,
        featured: false, order: order++, title: titleFrom(entry.name),
      };
      await writeJson(path.join(PHOTOS, `${id}.json`), data);
      created.push({ id, ...data });
    }
    return ok({ created });
  }

  return fail('unknown action', 404);
};
