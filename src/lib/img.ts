/* Responsive Bilder: liest das Manifest aus scripts/responsive-images.mjs und
   liefert src/srcset/sizes/width/height zum Spreaden auf ein <img>.
   Fehlt ein Bild im Manifest (noch nicht gebaut), kommt nur src zurück. */

type Entry = { w: number; h: number; v: number[] };

// Glob statt Import: fehlt die Datei (frischer Checkout ohne Build), bleibt das Manifest leer.
const mods = import.meta.glob<Record<string, Entry>>('../generated/images.json', { eager: true, import: 'default' });
const manifest: Record<string, Entry> = Object.values(mods)[0] ?? {};

const variantUrl = (src: string, w: number) => '/_r' + src.replace(/^\/images/, '').replace(/\.[^.]+$/, `-${w}.webp`);

export interface ResponsiveAttrs {
  src: string;
  srcset?: string;
  sizes?: string;
  width?: number;
  height?: number;
}

export function responsive(src: string | null | undefined, sizes = '100vw'): ResponsiveAttrs {
  if (!src) return { src: '' };
  const entry = manifest[src];
  if (!entry) return { src };
  const base = { src, width: entry.w, height: entry.h };
  if (!entry.v.length) return base;
  const srcset = [...entry.v.map((w) => `${variantUrl(src, w)} ${w}w`), `${src} ${entry.w}w`].join(', ');
  return { ...base, srcset, sizes };
}
