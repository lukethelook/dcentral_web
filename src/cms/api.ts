// Gallery editor API — /api/cms/[action]
//
// Two storage modes behind one interface:
//   • local (astro dev): reads/writes the JSON + image files directly.
//   • online (Vercel): reads and commits through GitHub with the editor's own
//     Keystatic login (cookie `keystatic-gh-access-token`). Only people with push
//     access to the repo can save; every save is one commit on the branch this
//     deployment was built from, and Vercel rebuilds automatically.
// Both modes edit exactly the files Keystatic edits, so the two editors stay in sync.
import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const prerender = false;

declare const __CMS_BRANCH__: string;
// CMS_STORE=github forces the online mode in `astro dev` (to test commits locally)
const LOCAL = import.meta.env.DEV && process.env.CMS_STORE !== 'github';
const REPO = process.env.CMS_REPO || 'lukethelook/dcentral_web';
const BRANCH = process.env.CMS_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || (typeof __CMS_BRANCH__ === 'string' && __CMS_BRANCH__) || 'main';
const CASES = 'src/content/cases';
const PHOTOS = 'src/content/photos';
const PHOTO_IMG = 'public/images/photos';

type Json = Record<string, any>;
type Change = { path: string; content?: Buffer | string; remove?: boolean };
type Entry = Json & { id: string };

const ok = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
const fail = (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), { status, headers: { 'content-type': 'application/json' } });
// ids come from file names; never let a request escape the content folders
const safeId = (id: unknown) => (typeof id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(id) ? id : null);
// Same format Keystatic writes: 2-space indent, trailing newline.
const jsonText = (data: Json) => JSON.stringify(data, null, 2) + '\n';
const byOrder = (a: Json, b: Json) => (Number(a.order) || 0) - (Number(b.order) || 0);

/* ── storage ──────────────────────────────────────────────────────────── */
interface Store {
  mode: 'local' | 'github';
  list(dir: string): Promise<Entry[]>;
  commit(changes: Change[], message: string): Promise<void>;
}

const localStore: Store = {
  mode: 'local',
  async list(dir) {
    const abs = path.join(process.cwd(), dir);
    const files = (await fs.readdir(abs)).filter((f) => f.endsWith('.json'));
    return Promise.all(files.map(async (f) => ({ id: f.slice(0, -5), ...JSON.parse(await fs.readFile(path.join(abs, f), 'utf8')) })));
  },
  async commit(changes) {
    for (const c of changes) {
      const abs = path.join(process.cwd(), c.path);
      if (c.remove) await fs.rm(abs, { force: true }); else await fs.writeFile(abs, c.content!);
    }
  },
};

class AuthError extends Error {}
function githubStore(token: string): Store {
  const [owner, name] = REPO.split('/');
  async function gql(query: string, variables: Json) {
    const r = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'dcentral-cms' },
      body: JSON.stringify({ query, variables }),
    });
    if (r.status === 401) throw new AuthError('GitHub-Anmeldung abgelaufen');
    const d = await r.json();
    if (d.errors?.length) throw new Error(d.errors.map((e: Json) => e.message).join('; '));
    return d.data;
  }
  return {
    mode: 'github',
    async list(dir) {
      const d = await gql(
        `query($owner:String!,$name:String!,$expr:String!){repository(owner:$owner,name:$name){object(expression:$expr){... on Tree{entries{name object{... on Blob{text}}}}}}}`,
        { owner, name, expr: `${BRANCH}:${dir}` },
      );
      const entries = d.repository?.object?.entries ?? [];
      return entries.filter((e: Json) => e.name.endsWith('.json') && e.object?.text).map((e: Json) => ({ id: e.name.slice(0, -5), ...JSON.parse(e.object.text) }));
    },
    async commit(changes, message) {
      // optimistic: expectedHeadOid makes GitHub reject the commit if someone pushed in between
      const head = await gql(`query($owner:String!,$name:String!,$ref:String!){repository(owner:$owner,name:$name){ref(qualifiedName:$ref){target{oid}}}}`, { owner, name, ref: `refs/heads/${BRANCH}` });
      const oid = head.repository?.ref?.target?.oid;
      if (!oid) throw new Error(`Branch ${BRANCH} nicht gefunden`);
      await gql(
        `mutation($input:CreateCommitOnBranchInput!){createCommitOnBranch(input:$input){commit{oid}}}`,
        {
          input: {
            branch: { repositoryNameWithOwner: REPO, branchName: BRANCH },
            message: { headline: message },
            expectedHeadOid: oid,
            fileChanges: {
              additions: changes.filter((c) => !c.remove).map((c) => ({ path: c.path, contents: Buffer.from(c.content!).toString('base64') })),
              deletions: changes.filter((c) => c.remove).map((c) => ({ path: c.path })),
            },
          },
        },
      );
    },
  };
}

function storeFor(request: Request): Store | null {
  if (LOCAL) return localStore;
  const cookie = request.headers.get('cookie') || '';
  const token = /(?:^|;\s*)keystatic-gh-access-token=([^;]+)/.exec(cookie)?.[1];
  return token ? githubStore(decodeURIComponent(token)) : null;
}

/* ── helpers ──────────────────────────────────────────────────────────── */
function slugify(name: string) {
  return name
    .replace(/\.[^.]+$/, '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'foto';
}
const titleFrom = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

/* ── routes ───────────────────────────────────────────────────────────── */
export const GET: APIRoute = async ({ params, request }) => {
  if (params.action !== 'state') return fail('unknown action', 404);
  const store = storeFor(request);
  if (!store) return fail('login', 401);
  try {
    const [cases, photos] = await Promise.all([store.list(CASES), store.list(PHOTOS)]);
    return ok({
      mode: store.mode,
      branch: store.mode === 'github' ? BRANCH : null,
      // online, images come straight from the repo so fresh uploads show before Vercel has rebuilt
      imageBase: store.mode === 'github' ? `https://raw.githubusercontent.com/${REPO}/${BRANCH}/public` : '',
      cases: cases
        .map((c) => ({ id: c.id, title: c.title, client: c.client, order: c.order ?? 0, galleryTitle: c.galleryTitle ?? '', galleryPhotos: (c.galleryPhotos ?? []).filter(Boolean) }))
        .sort(byOrder),
      photos: photos.sort(byOrder),
    });
  } catch (e) {
    return e instanceof AuthError ? fail('login', 401) : fail(String((e as Error).message), 500);
  }
};

export const POST: APIRoute = async ({ params, request, url }) => {
  // only the editor itself may post (cookies are SameSite=lax, this is a second fence)
  // (behind Vercel's proxy url.host is internal — compare with the forwarded public host)
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
  if (origin && new URL(origin).host !== host) return fail('forbidden', 403);
  const store = storeFor(request);
  if (!store) return fail('login', 401);
  const action = params.action;

  try {
    // 1) One image in → web versions out (nothing is stored yet; the client keeps it until "Speichern").
    if (action === 'process') {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File) || !file.type.startsWith('image/')) return fail('kein Bild');
      const taken = new Set([...(await store.list(PHOTOS)).map((p) => p.id), ...String(form.get('taken') || '').split(',').filter(Boolean)]);
      const base = slugify(String(form.get('name') || file.name));
      let id = base, n = 2;
      while (taken.has(id)) id = `${base}-${n++}`;
      const input = Buffer.from(await file.arrayBuffer());
      const big = await sharp(input).rotate().resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).sharpen({ sigma: 0.6 }).webp({ quality: 84 }).toBuffer({ resolveWithObject: true });
      const sm = await sharp(input).rotate().resize({ width: 760, height: 760, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      return ok({
        id,
        json: {
          image: `/images/photos/${id}.webp`, thumb: `/images/photos/${id}-sm.webp`, alt: '',
          series: String(form.get('series') || 'Fotografie'), project: safeId(form.get('project')),
          width: big.info.width, height: big.info.height, featured: false, order: 0, title: titleFrom(String(form.get('name') || file.name)),
        },
        big: big.data.toString('base64'),
        sm: sm.toString('base64'),
      });
    }

    // 2) Save: gallery or homepage selection + edited/new photos, written as one change set (one commit online).
    if (action === 'save') {
      const body = await request.json();
      const changes: Change[] = [];
      const photos = new Map((await store.list(PHOTOS)).map((p) => [p.id, p]));
      const touched = new Set<string>();

      // new photos: binaries + entries (order: after everything else)
      let nextOrder = Math.max(0, ...[...photos.values()].map((p) => Number(p.order) || 0)) + 1;
      for (const np of body.newPhotos ?? []) {
        const id = safeId(np.id);
        if (!id || photos.has(id)) continue;
        if (np.big) changes.push({ path: `${PHOTO_IMG}/${id}.webp`, content: Buffer.from(np.big, 'base64') });
        if (np.sm) changes.push({ path: `${PHOTO_IMG}/${id}-sm.webp`, content: Buffer.from(np.sm, 'base64') });
        const { id: _drop, ...json } = np.json ?? {};
        photos.set(id, { id, ...json, order: nextOrder++ });
        touched.add(id);
      }
      // inline edits (title, alt, series, project)
      for (const [rawId, edit] of Object.entries<Json>(body.photoEdits ?? {})) {
        const id = safeId(rawId), p = id && photos.get(id);
        if (!p) continue;
        for (const key of ['title', 'alt', 'series'] as const) if (typeof edit[key] === 'string') p[key] = edit[key];
        if ('project' in edit) p.project = safeId(edit.project);
        touched.add(id!);
      }
      // photos deleted from the library: entry + both image files, and every reference to them
      const deleted = ((body.deletePhotos ?? []) as unknown[]).map(safeId).filter((id): id is string => !!id && photos.has(id));
      const cases = new Map((await store.list(CASES)).map((c) => [c.id, c]));
      const dirtyCases = new Set<string>();
      for (const id of deleted) {
        const p = photos.get(id)!;
        changes.push({ path: `${PHOTOS}/${id}.json`, remove: true });
        for (const img of new Set([p.image, p.thumb])) if (typeof img === 'string' && img.startsWith('/images/photos/')) changes.push({ path: `public${img}`, remove: true });
        photos.delete(id); touched.delete(id);
        for (const c of cases.values()) if ((c.galleryPhotos ?? []).includes(id)) { c.galleryPhotos = c.galleryPhotos.filter((x: string) => x !== id); dirtyCases.add(c.id); }
      }
      const selection = ((body.photos ?? []) as unknown[]).map(safeId).filter((id): id is string => !!id && photos.has(id));

      let message = deleted.length ? `cms: ${deleted.length} Foto${deleted.length === 1 ? '' : 's'} gelöscht` : 'cms: Fotos aktualisiert';
      if (body.kind === 'gallery') {
        const caseId = safeId(body.case);
        const c = caseId && cases.get(caseId);
        if (!c) return fail('Projekt nicht gefunden');
        if (typeof body.galleryTitle === 'string') c.galleryTitle = body.galleryTitle;
        c.galleryPhotos = selection;
        dirtyCases.add(caseId!);
        message = `cms: Galerie ${c.client || caseId} (${selection.length} Fotos)` + (deleted.length ? ` · ${deleted.length} gelöscht` : '');
      } else if (body.kind === 'home') {
        let rest = selection.length;
        for (const p of [...photos.values()].sort(byOrder)) {
          const at = selection.indexOf(p.id), featured = at >= 0, order = featured ? at : rest++;
          if (p.featured !== featured || p.order !== order) { p.featured = featured; p.order = order; touched.add(p.id); }
        }
        message = `cms: Startseiten-Fotos (${selection.length})`;
      }
      for (const id of touched) { if (!photos.has(id)) continue; const { id: _id, ...data } = photos.get(id)!; changes.push({ path: `${PHOTOS}/${id}.json`, content: jsonText(data) }); }
      for (const id of dirtyCases) { const { id: _id, ...data } = cases.get(id)!; changes.push({ path: `${CASES}/${id}.json`, content: jsonText(data) }); }
      const added = (body.newPhotos ?? []).length;
      if (added) message += ` · ${added} neue${added === 1 ? 's Foto' : ' Fotos'}`;
      if (!changes.length) return ok({ saved: 0 });
      await store.commit(changes, message);
      return ok({ saved: changes.length, mode: store.mode, branch: store.mode === 'github' ? BRANCH : null });
    }

    return fail('unknown action', 404);
  } catch (e) {
    if (e instanceof AuthError) return fail('login', 401);
    const msg = String((e as Error).message);
    // someone else committed in between → the client reloads and the user saves again
    if (/expected|head|stale|fast.forward/i.test(msg)) return fail('Inzwischen wurde etwas anderes gespeichert. Seite neu laden und erneut speichern.', 409);
    return fail(msg, 500);
  }
};
