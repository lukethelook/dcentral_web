/* Tiny rich-text helper for CMS-editable copy.
   Converts `*betont*` → <em> (Instrument Serif accent) and newlines → <br>.
   Used with set:html on owned content (no untrusted input). */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function hl(s: string): string {
  return esc(s)
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');
}

/* Same as hl() but flattens line breaks — for single-line contexts. */
export function hlInline(s: string): string {
  return hl(s.replace(/\s*\n\s*/g, ' '));
}
