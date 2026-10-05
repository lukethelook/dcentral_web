/* Contact sheet (ContactSheet.astro)
   Every element with data-contact="start|purpose|question|talk" opens the form
   instead of jumping to the footer ("team" is an alias of "start"); data-discipline
   pre-selects an area, data-ref mentions the project the visitor came from.
   Without JS the links keep their href. The message leaves the browser only
   through the visitor's own mail client — nothing is stored. */
const dialog = document.getElementById('brief');

if (dialog) {
  const form = dialog.querySelector('.brief-form');
  const title = dialog.querySelector('.brief-title');
  const note = dialog.querySelector('.brief-note');
  const sendLabel = dialog.querySelector('.brief-send-label');
  const message = form.elements.message;
  const email = dialog.dataset.email;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const TOPICS = ['start', 'purpose', 'question', 'talk'];
  const areas = new Set();
  let topic = 'start';
  let trigger = null;

  const val = (name) => (form.elements[name]?.value ?? '').trim();
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  const setTopic = (id) => {
    topic = id === 'team' ? 'start' : TOPICS.includes(id) ? id : 'start';
    form.dataset.topic = topic;
    dialog.querySelectorAll('[data-topic]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.topic === topic)));
    form.querySelectorAll('[data-show]').forEach((el) => { el.hidden = !el.dataset.show.split(' ').includes(topic); });
    title.textContent = title.dataset[`title${cap(topic)}`];
    sendLabel.textContent = sendLabel.dataset[`label${cap(topic)}`];
    message.placeholder = message.dataset[`placeholder${cap(topic)}`] ?? '';
    note.textContent = '';
  };

  const syncAreas = () => form.querySelectorAll('[data-area]').forEach((b) => b.setAttribute('aria-pressed', String(areas.has(b.dataset.area))));

  // the field each topic cannot do without
  const required = () => (topic === 'talk' ? form.elements.phone : message);

  const compose = () => {
    const name = val('name');
    const footer = [name && `Name: ${name}`, topic !== 'talk' && val('contact') && `Kontakt: ${val('contact')}`].filter(Boolean);
    let subject, text;
    if (topic === 'talk') {
      subject = `Rückruf-Wunsch${name ? ` – ${name}` : ''}`;
      text = `bitte ruf mich zurück unter ${val('phone')}.`;
    } else if (topic === 'purpose') {
      subject = 'Purpose Accelerator – Projektvorschlag';
      text = val('message');
    } else if (topic === 'question') {
      subject = 'Frage über dcentral.at';
      text = val('message');
    } else {
      const list = [...areas];
      subject = `Projektanfrage${list.length ? `: ${list.join(', ')}` : ''}`;
      text = val('message');
      if (list.length) footer.unshift(`Bereich: ${list.join(', ')}`);
    }
    const body = ['Hallo Lukas,', '', text, '', ...footer].join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return { subject, body };
  };

  const open = (id, opts = {}) => {
    setTopic(id);
    if (opts.discipline) areas.add(opts.discipline);
    syncAreas();
    if (opts.ref && !message.value.trim()) message.value = `Ähnlich wie das Projekt für ${opts.ref}: `;
    document.documentElement.classList.add('brief-open');
    dialog.showModal();
    // keyboard users start typing right away; on touch the keyboard would cover the sheet
    if (finePointer.matches) (val('name') ? required() : form.elements.name).focus({ preventScroll: true });
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

  dialog.querySelectorAll('[data-topic]').forEach((b) => b.addEventListener('click', () => setTopic(b.dataset.topic)));
  form.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-area]');
    if (!chip) return;
    const a = chip.dataset.area;
    areas.has(a) ? areas.delete(a) : areas.add(a);
    syncAreas();
  });

  dialog.querySelector('.brief-close').addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  // cleanup on every close — also when the browser closes the dialog itself (Esc)
  dialog.addEventListener('close', () => {
    dialog.classList.remove('is-closing');
    document.documentElement.classList.remove('brief-open');
    trigger?.focus({ preventScroll: true });
  });

  form.addEventListener('input', (e) => e.target.classList?.remove('is-missing'));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const field = required();
    if (!field.value.trim()) {
      field.classList.remove('is-missing'); void field.offsetWidth; field.classList.add('is-missing');
      field.focus();
      note.textContent = topic === 'talk' ? 'Unter welcher Nummer erreichen wir dich?' : 'Bitte schreib kurz, worum es geht.';
      return;
    }
    const { subject, body } = compose();
    note.innerHTML = 'Dein E-Mail-Programm öffnet sich mit der fertigen Nachricht. Keines eingerichtet? <button type="button" class="brief-copy">Nachricht kopieren</button>';
    location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, '\r\n'))}`;
  });

  note.addEventListener('click', async (e) => {
    if (!e.target.closest('.brief-copy')) return;
    const { subject, body } = compose();
    try {
      await navigator.clipboard.writeText(`An: ${email}\nBetreff: ${subject}\n\n${body}`);
      note.textContent = `Kopiert – bitte an ${email} senden.`;
    } catch {
      note.textContent = `Bitte direkt an ${email} schreiben.`;
    }
  });

  // shareable deep link: /#anfrage, /#anfrage-question …
  const fromHash = () => {
    const m = location.hash.match(/^#anfrage(?:-(start|purpose|question|talk))?$/);
    if (m) open(m[1] || 'start');
  };
  fromHash();
  addEventListener('hashchange', fromHash);
}
