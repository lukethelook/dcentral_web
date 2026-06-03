/* Tiny rich-text helper for CMS-editable copy.
   Converts `*highlighted*` → signal-coloured span and newlines → <br>.
   Used with set:html on owned content (no untrusted input). */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function hl(s: string): string {
  return esc(s)
    .replace(/\*([^*]+)\*/g, '<span class="hl">$1</span>')
    .replace(/\n/g, '<br />');
}
