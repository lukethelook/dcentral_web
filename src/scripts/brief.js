/* „Brief an Lukas" (ContactSheet.astro)
   Every element with data-contact="start|team|purpose|question|talk" opens the sheet
   instead of jumping to the footer; data-discipline pre-selects a discipline,
   data-ref pre-fills a reference project. Without JS the links keep their href.
   The letter leaves the browser only through the visitor's own mail client. */
const dialog = document.getElementById('brief');

if (dialog) {
  const form = dialog.querySelector('.brief-form');
  const title = dialog.querySelector('.brief-title');
  const note = dialog.querySelector('.brief-note');
  const noteDefault = note.textContent;
  const email = dialog.dataset.email;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const picks = { disc: new Set(), when: '', slot: '' };
  let intent = 'start';
  let trigger = null;

  const letters = [...dialog.querySelectorAll('.brief-letter')];
  const fields = () => [...form.querySelectorAll('[data-field]')];
  const value = (name) => (form.querySelector(`.brief-letter.is-active [data-field="${name}"]`)?.value ?? form.querySelector(`[data-field="${name}"]`)?.value ?? '').trim();
  const list = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} und ${a.at(-1)}`);

  // Inline blanks grow with their text (measured in the input's own font).
  const ctx = document.createElement('canvas').getContext('2d');
  const fit = (input) => {
    if (input.tagName !== 'INPUT') return;
    ctx.font = getComputedStyle(input).font;
    const w = ctx.measureText(input.value || input.placeholder).width;
    input.style.width = `${Math.ceil(w) + 10}px`;
  };

  const syncChips = () => {
    form.querySelectorAll('.brief-chip').forEach((chip) => {
      const { pick, value: v } = chip.dataset;
      const on = pick === 'disc' ? picks.disc.has(v) : picks[pick] === v;
      chip.setAttribute('aria-pressed', String(on));
    });
    // the crew: Lukas plus one node per discipline from the network
    const crew = dialog.querySelectorAll('[data-crew]');
    let n = 0;
    crew.forEach((li) => { const on = picks.disc.has(li.dataset.crew); li.classList.toggle('is-in', on); n += on; });
    dialog.querySelector('.brief-count').textContent = n
      ? `Lukas + ${n} aus dem Netzwerk. Ein Ansprechpartner für alles.`
      : 'Tipp an, was du brauchst – das Team setzt sich zusammen.';
  };

  const setIntent = (id) => {
    intent = letters.some((l) => l.dataset.for === id) ? id : 'start';
    form.dataset.intent = intent;
    dialog.querySelectorAll('[data-tab]').forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.tab === intent)));
    letters.forEach((l) => {
      const on = l.dataset.for === intent;
      l.classList.toggle('is-active', on);
      l.hidden = !on;
      [...l.children].forEach((el, i) => el.style.setProperty('--i', i));
    });
    title.textContent = title.dataset[`title${intent[0].toUpperCase()}${intent.slice(1)}`];
    note.textContent = noteDefault;
    fields().forEach(fit);
  };

  const compose = () => {
    const name = value('name'), org = value('org'), contact = value('contact');
    const disc = [...picks.disc];
    const sign = `Viele Grüße${name ? `\n${name}` : ''}`;
    const reach = contact ? `Erreichbar bin ich unter ${contact}.` : '';
    let subject, lines;
    if (intent === 'team') {
      subject = `Team zusammenstellen${disc.length ? `: ${disc.join(', ')}` : ''}`;
      lines = [`für ${value('what') || 'unser Vorhaben'} suche ich ein Team${disc.length ? ` aus ${list(disc)}` : ''}.`,
        name ? `Ich bin ${name}${org ? ` von ${org}` : ''}.` : org ? `Wir sind ${org}.` : '', reach];
    } else if (intent === 'purpose') {
      subject = `Purpose Accelerator – Projektvorschlag${org ? `: ${org}` : ''}`;
      lines = [`${org ? `wir sind ${org} und wollen` : 'wir wollen'} ${value('impact') || 'etwas bewegen'}.`,
        disc.length ? `Helfen würde uns ${list(disc)}.` : '', name ? `Ich bin ${name}.` : '', reach];
    } else if (intent === 'question') {
      subject = 'Frage über dcentral.at';
      lines = ['ich hätte eine Frage:', '', value('question'), '', contact ? `Antwort bitte an ${contact}.` : ''];
    } else if (intent === 'talk') {
      subject = `Rückruf-Wunsch${name ? ` – ${name}` : ''}`;
      lines = [`ruf mich bitte unter ${value('phone')} an${picks.slot ? `, am besten ${picks.slot}` : ''}.`];
    } else {
      subject = `Projektanfrage${disc.length ? `: ${disc.join(', ')}` : ''}${org ? ` – ${org}` : ''}`;
      lines = [name ? `ich bin ${name}${org ? ` von ${org}` : ''}.` : org ? `ich melde mich von ${org}.` : '',
        `Wir planen ${value('what') || 'ein Projekt'}${disc.length ? ` und brauchen dafür ${list(disc)}` : ''}.`,
        picks.when ? `Starten würden wir gern ${picks.when}.` : '', reach];
    }
    const body = ['Hallo Lukas,', '', ...lines.filter((l, i, a) => l || (a[i - 1] && a[i + 1])), '', sign].join('\n').replace(/\n{3,}/g, '\n\n');
    return { subject, body };
  };

  const open = (id, opts = {}) => {
    setIntent(id);
    if (opts.discipline) picks.disc.add(opts.discipline);
    if (opts.ref) {
      const what = form.querySelector('.brief-letter.is-active [data-field="what"]');
      if (what && !what.value) { fields().filter((f) => f.dataset.field === 'what').forEach((f) => { f.value = `so etwas wie das Projekt für ${opts.ref}`; }); }
    }
    syncChips();
    document.documentElement.classList.add('brief-open');
    dialog.showModal();
    fields().forEach(fit);
    const first = form.querySelector('.brief-letter.is-active [data-main]');
    first?.focus({ preventScroll: true });
  };

  const close = () => {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    const done = () => dialog.close();
    if (reduced.matches) return done();
    const panel = dialog.querySelector('.brief-panel');
    const end = (e) => { if (e.target !== panel) return; panel.removeEventListener('animationend', end); done(); };
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

  dialog.querySelectorAll('[data-tab]').forEach((t) => t.addEventListener('click', () => {
    setIntent(t.dataset.tab);
    syncChips();
    form.querySelector('.brief-letter.is-active [data-main]')?.focus({ preventScroll: true });
  }));
  dialog.querySelector('.brief-close').addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  // cleanup on every close — also when the browser closes the dialog itself (Esc)
  dialog.addEventListener('close', () => {
    dialog.classList.remove('is-closing');
    document.documentElement.classList.remove('brief-open');
    trigger?.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });

  // one value per field across all letters (switching tabs keeps what was typed)
  form.addEventListener('input', (e) => {
    const f = e.target.dataset?.field;
    if (!f) return;
    fields().filter((x) => x.dataset.field === f && x !== e.target).forEach((x) => { x.value = e.target.value; });
    fields().filter((x) => x.dataset.field === f).forEach(fit);
    e.target.classList.remove('is-missing');
  });

  form.addEventListener('click', (e) => {
    const chip = e.target.closest('.brief-chip');
    if (!chip) return;
    const { pick, value: v } = chip.dataset;
    if (pick === 'disc') picks.disc.has(v) ? picks.disc.delete(v) : picks.disc.add(v);
    else picks[pick] = picks[pick] === v ? '' : v;
    syncChips();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const main = form.querySelector('.brief-letter.is-active [data-main]');
    if (main && !main.value.trim() && !(intent !== 'talk' && intent !== 'question' && picks.disc.size)) {
      main.classList.remove('is-missing'); void main.offsetWidth; main.classList.add('is-missing');
      main.focus();
      note.textContent = intent === 'talk' ? 'Unter welcher Nummer erreiche ich dich?' : 'Erzähl mir kurz, worum es geht – ein paar Worte reichen.';
      return;
    }
    const { subject, body } = compose();
    note.textContent = 'Dein Mailprogramm öffnet sich mit dem fertigen Brief – nur noch auf Senden tippen.';
    location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, '\r\n'))}`;
  });

  dialog.querySelector('.brief-copy').addEventListener('click', async () => {
    const { subject, body } = compose();
    try {
      await navigator.clipboard.writeText(`An: ${email}\nBetreff: ${subject}\n\n${body}`);
      note.textContent = `Kopiert. Einfach an ${email} schicken.`;
    } catch {
      note.textContent = `Kopieren hat nicht geklappt – schreib einfach an ${email}.`;
    }
  });

  // shareable deep link: /#brief or /#brief-team
  const fromHash = () => {
    const m = location.hash.match(/^#brief(?:-(start|team|purpose|question|talk))?$/);
    if (m) open(m[1] || 'start');
  };
  fromHash();
  addEventListener('hashchange', fromHash);
}
