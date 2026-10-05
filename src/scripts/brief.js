/* „Brief an Lukas" (ContactSheet.astro)
   Every element with data-contact="start|purpose|question|talk" opens the sheet
   instead of jumping to the footer ("team" is an alias of "start"); data-discipline
   and data-ref add context from the page. Without JS the links keep their href.
   The letter leaves the browser only through the visitor's own mail client. */
const dialog = document.getElementById('brief');

if (dialog) {
  const form = dialog.querySelector('.brief-form');
  const title = dialog.querySelector('.brief-title');
  const note = dialog.querySelector('.brief-note');
  const sendLabel = dialog.querySelector('.brief-send-label');
  const email = dialog.dataset.email;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const letters = [...dialog.querySelectorAll('.brief-letter')];
  let intent = 'start';
  let context = {};
  let trigger = null;

  const fields = () => [...form.querySelectorAll('[data-field]')];
  const active = (sel) => [...form.querySelectorAll(`.brief-letter.is-active ${sel}`)];
  const value = (name) => (active(`[data-field="${name}"]`)[0]?.value ?? '').trim();

  // Inline blanks grow with their text (measured in the input's own font).
  const measure = document.createElement('canvas').getContext('2d');
  const fit = (input) => {
    if (input.tagName !== 'INPUT') return;
    measure.font = getComputedStyle(input).font;
    input.style.width = `${Math.ceil(measure.measureText(input.value || input.placeholder).width) + 10}px`;
  };

  const setIntent = (id) => {
    intent = id === 'team' ? 'start' : letters.some((l) => l.dataset.for === id) ? id : 'start';
    form.dataset.intent = intent;
    letters.forEach((l) => {
      const on = l.dataset.for === intent;
      l.classList.toggle('is-active', on);
      l.hidden = !on;
      [...l.children].forEach((el, i) => el.style.setProperty('--i', i));
    });
    title.textContent = title.dataset[`title${intent[0].toUpperCase()}${intent.slice(1)}`];
    sendLabel.textContent = intent === 'talk' ? sendLabel.dataset.labelTalk : sendLabel.dataset.labelDefault;
    note.textContent = '';
  };

  const compose = () => {
    const name = value('name'), contact = value('contact');
    const reach = contact ? `Erreichbar bin ich unter ${contact}.` : '';
    let subject, lines;
    if (intent === 'purpose') {
      const org = value('org');
      subject = `Purpose Accelerator – Projektvorschlag${org ? `: ${org}` : ''}`;
      lines = [`${org ? `wir sind ${org} und wollen` : 'wir wollen'} ${value('impact')}.`, reach];
    } else if (intent === 'question') {
      subject = 'Frage über dcentral.at';
      lines = ['meine Frage:', '', value('question'), '', contact ? `Antwort bitte an ${contact}.` : ''];
    } else if (intent === 'talk') {
      subject = 'Rückruf-Wunsch';
      lines = [`bitte ruf mich zurück unter ${value('phone')}.`];
    } else {
      subject = `Projektanfrage${context.discipline ? `: ${context.discipline}` : ''}`;
      lines = [`${name ? `ich bin ${name} und plane` : 'ich plane'} ${value('what')}${context.discipline ? ` (Bereich: ${context.discipline})` : ''}.`, reach];
    }
    const body = ['Hallo Lukas,', '', ...lines, '', `Viele Grüße${name ? `\n${name}` : ''}`].join('\n').replace(/\n{3,}/g, '\n\n');
    return { subject, body };
  };

  const open = (id, opts = {}) => {
    context = { discipline: opts.discipline || '' };
    setIntent(id);
    if (opts.ref) {
      const what = fields().filter((f) => f.dataset.field === 'what');
      if (what.every((f) => !f.value)) what.forEach((f) => { f.value = `so etwas wie das Projekt für ${opts.ref}`; });
    }
    document.documentElement.classList.add('brief-open');
    dialog.showModal();
    fields().forEach(fit);
    // keyboard users start typing right away; on touch the keyboard would cover the sheet
    if (finePointer.matches) active('[data-main]')[0]?.focus({ preventScroll: true });
  };

  const close = () => {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    if (reduced.matches) return dialog.close();
    const panel = dialog.querySelector('.brief-panel');
    const end = (e) => { if (e.target !== panel) return; panel.removeEventListener('animationend', end); dialog.close(); };
    panel.addEventListener('animationend', end);
    dialog.classList.add('is-closing');
  };

  // open from any CTA — capture phase, so the in-page anchor scroll (motion-system.js)
  // sees defaultPrevented and leaves the page where it is
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-contact]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    trigger = a;
    open(a.dataset.contact, { discipline: a.dataset.discipline, ref: a.dataset.ref });
  }, true);

  dialog.querySelector('.brief-close').addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  // cleanup on every close — also when the browser closes the dialog itself (Esc)
  dialog.addEventListener('close', () => {
    dialog.classList.remove('is-closing');
    document.documentElement.classList.remove('brief-open');
    trigger?.focus({ preventScroll: true });
  });

  // one value per field across all letters (switching letters keeps what was typed)
  form.addEventListener('input', (e) => {
    const f = e.target.dataset?.field;
    if (!f) return;
    fields().filter((x) => x.dataset.field === f && x !== e.target).forEach((x) => { x.value = e.target.value; });
    fields().filter((x) => x.dataset.field === f).forEach(fit);
    e.target.classList.remove('is-missing');
  });

  // Enter jumps to the next empty blank; on the last one it sends
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    const blanks = active('[data-field]');
    const next = blanks.slice(blanks.indexOf(e.target) + 1).find((b) => !b.value.trim());
    if (next) { e.preventDefault(); next.focus(); }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const main = active('[data-main]')[0];
    if (main && !main.value.trim()) {
      main.classList.remove('is-missing'); void main.offsetWidth; main.classList.add('is-missing');
      main.focus();
      note.textContent = intent === 'talk' ? 'Unter welcher Nummer erreiche ich dich?' : 'Ein paar Worte reichen.';
      return;
    }
    const { subject, body } = compose();
    note.innerHTML = 'Dein Mailprogramm öffnet sich. Keins eingerichtet? <button type="button" class="brief-copy">Text kopieren</button>';
    location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, '\r\n'))}`;
  });

  note.addEventListener('click', async (e) => {
    if (!e.target.closest('.brief-copy')) return;
    const { subject, body } = compose();
    try {
      await navigator.clipboard.writeText(`An: ${email}\nBetreff: ${subject}\n\n${body}`);
      note.textContent = `Kopiert – einfach an ${email} schicken.`;
    } catch {
      note.textContent = `Schreib einfach an ${email}.`;
    }
  });

  // shareable deep link: /#brief, /#brief-question …
  const fromHash = () => {
    const m = location.hash.match(/^#brief(?:-(start|team|purpose|question|talk))?$/);
    if (m) open(m[1] || 'start');
  };
  fromHash();
  addEventListener('hashchange', fromHash);
}
