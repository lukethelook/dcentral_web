import { config, fields, collection, singleton } from '@keystatic/core';

// ── Storage ────────────────────────────────────────────────────────────────
// Lokal (npm run dev) schreibt direkt auf die Festplatte. In Produktion (Vercel)
// committet Keystatic via GitHub — dann `repo` auf dein GitHub-Repo setzen und
// die Env-Vars KEYSTATIC_GITHUB_CLIENT_ID / _SECRET / KEYSTATIC_SECRET hinterlegen.
const repo = 'lukethelook/dcentral_web';

const TEXT = (label: string, opts: { multiline?: boolean; description?: string } = {}) =>
  fields.text({ label, multiline: opts.multiline, description: opts.description });

const RICH = '„*Wort*" = Serif-Akzent (kursiv), Zeilenumbruch = neue Zeile';

export default config({
  storage:
    process.env.NODE_ENV === 'production'
      ? { kind: 'github', repo }
      : { kind: 'local' },
  ui: {
    brand: { name: 'dcentral' },
    navigation: {
      Arbeiten: ['cases'],
      Seiteninhalte: ['hero', 'manifest', 'leistungen', 'work', 'studio', 'accelerator', 'region', 'prozess', 'faq', 'contact'],
      Rechtliches: ['impressum', 'datenschutz'],
      'SEO & Firma': ['seo'],
    },
  },

  collections: {
    cases: collection({
      label: 'Arbeiten / Projekte',
      slugField: 'title',
      path: 'src/content/cases/*',
      format: { data: 'json' },
      schema: {
        title: fields.slug({ name: { label: 'Titel' } }),
        client: TEXT('Kunde'),
        discipline: fields.select({
          label: 'Disziplin',
          options: [
            { label: 'Foto', value: 'Foto' },
            { label: 'Film & Aerial', value: 'Film & Aerial' },
            { label: 'Web', value: 'Web' },
            { label: 'KI', value: 'KI' },
          ],
          defaultValue: 'Foto',
        }),
        also: fields.multiselect({
          label: 'Weitere Disziplinen',
          description: 'Projekt erscheint zusätzlich unter diesen Galerie-Filtern (z.B. Web + KI).',
          options: [
            { label: 'Foto', value: 'Foto' },
            { label: 'Film & Aerial', value: 'Film & Aerial' },
            { label: 'Web', value: 'Web' },
            { label: 'KI', value: 'KI' },
          ],
        }),
        year: fields.integer({ label: 'Jahr', defaultValue: 2025 }),
        url: TEXT('Live-Link (optional, z.B. https://…)'),
        summary: TEXT('Kurzbeschreibung (Listen-/Teaser-Text)', { multiline: true }),
        body: TEXT('Beschreibung (Detailseite)', { multiline: true }),
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Themen', itemLabel: (p) => p.value,
        }),
        hue: fields.integer({ label: 'Farbton 0–360 (Platzhalter-Visual)', defaultValue: 200 }),
        format: fields.select({
          label: 'Kachel-Format',
          options: [
            { label: 'Hochformat', value: 'portrait' },
            { label: 'Querformat', value: 'landscape' },
            { label: 'Quadrat', value: 'square' },
          ],
          defaultValue: 'portrait',
        }),
        cover: fields.image({
          label: 'Titelbild (ersetzt den Platzhalter)',
          directory: 'public/images/cases',
          publicPath: '/images/cases/',
        }),
        previews: fields.array(
          fields.image({
            label: 'Vorschaubild',
            directory: 'public/images/cases',
            publicPath: '/images/cases/',
          }),
          { label: 'Galerie-Vorschau (Hover, 2 Bilder)', itemLabel: (p) => p.value?.filename ?? 'Bild' },
        ),
        previewDummy: fields.checkbox({
          label: 'Vorschau ist Dummymotiv',
          description: 'Solange aktiv, steht „Dummymotiv" auf der Vorschau. Deaktivieren, sobald echte Projektbilder drin sind.',
          defaultValue: true,
        }),
        showcase: fields.object({
          desktop: fields.image({ label: 'Desktop-Screenshot (ganze Seite, scrollt im Browser-Mockup)', directory: 'public/images/cases', publicPath: '/images/cases/' }),
          mobile: fields.image({ label: 'Mobil-Screenshot (ganze Seite, scrollt im Handy-Mockup)', directory: 'public/images/cases', publicPath: '/images/cases/' }),
          label: TEXT('Adresszeile im Browser (z.B. maplove.cc)'),
        }, { label: 'Animiertes Geräte-Mockup (ersetzt das Titelbild auf der Projektseite)' }),
        highlightsTitle: TEXT('Überschrift Leistungen (z.B. „Was ich gebaut habe")'),
        highlights: fields.array(
          fields.object({ t: TEXT('Titel'), d: TEXT('Text', { multiline: true }) }),
          { label: 'Leistungen / Highlights', itemLabel: (p) => p.fields.t.value },
        ),
        screens: fields.array(
          fields.object({
            image: fields.image({ label: 'Screenshot', directory: 'public/images/cases', publicPath: '/images/cases/' }),
            device: fields.select({ label: 'Gerät', options: [{ label: 'Desktop', value: 'desktop' }, { label: 'Mobil', value: 'mobile' }], defaultValue: 'desktop' }),
            caption: TEXT('Bildunterschrift'),
          }),
          { label: 'Screens', itemLabel: (p) => p.fields.caption.value || p.fields.device.value },
        ),
        loopTitle: TEXT('Überschrift Ablauf (optional)'),
        loop: fields.array(
          fields.object({ t: TEXT('Schritt'), d: TEXT('Text', { multiline: true }) }),
          { label: 'Ablauf / Wie es funktioniert', itemLabel: (p) => p.fields.t.value },
        ),
        stack: fields.array(fields.text({ label: 'Technologie' }), { label: 'Techstack', itemLabel: (p) => p.value }),
        featured: fields.checkbox({ label: 'Hervorgehoben', defaultValue: false }),
        order: fields.integer({ label: 'Reihenfolge', defaultValue: 0 }),
      },
    }),
  },

  singletons: {
    hero: singleton({
      label: 'Hero', path: 'src/content/site/hero', format: { data: 'json' },
      schema: {
        location: TEXT('Standort'),
        intro: TEXT('Einleitung über der Headline'),
        headline: TEXT('Headline', { multiline: true, description: RICH }),
        network: TEXT('Netzwerk-Satz', { multiline: true }),
        ctaPrimary: TEXT('Button'),
        ticker: fields.array(fields.text({ label: 'Wort' }), { label: 'Disziplinen (Leiste unten)', itemLabel: (p) => p.value }),
      },
    }),

    manifest: singleton({
      label: 'Manifest', path: 'src/content/site/manifest', format: { data: 'json' },
      schema: {
        eyebrow: TEXT('Label'),
        headline: TEXT('Aussage (liest sich beim Scrollen ein)', { multiline: true, description: RICH }),
        foot: TEXT('Fließtext', { multiline: true }),
      },
    }),

    leistungen: singleton({
      label: 'Leistungen', path: 'src/content/site/leistungen', format: { data: 'json' },
      schema: {
        eyebrow: TEXT('Label'),
        title: TEXT('Überschrift', { multiline: true, description: RICH }),
        services: fields.array(
          fields.object({
            no: TEXT('Nummer'),
            title: TEXT('Titel'),
            short: TEXT('Kurzname (Tab)', { description: 'Optional, z.B. „Web" statt „Web & Entwicklung"' }),
            tag: TEXT('Schlagzeile'),
            body: TEXT('Beschreibung', { multiline: true }),
            entry: TEXT('Einstieg-Zeile'),
            items: fields.array(fields.text({ label: 'Stichwort' }), { label: 'Stichworte', itemLabel: (p) => p.value }),
          }),
          { label: 'Disziplinen', itemLabel: (p) => p.fields.title.value },
        ),
      },
    }),

    studio: singleton({
      label: 'Studio', path: 'src/content/site/studio', format: { data: 'json' },
      schema: {
        eyebrow: TEXT('Label'),
        title: TEXT('Überschrift', { multiline: true, description: RICH }),
        subtitle: TEXT('Unterzeile', { multiline: true }),
        lead: TEXT('Fließtext', { multiline: true }),
        points: fields.array(fields.text({ label: 'Punkt' }), { label: 'Punkte', itemLabel: (p) => p.value }),
        cta: TEXT('Link-Text'),
        image: fields.image({ label: 'Bild', directory: 'public/images/studio', publicPath: '/images/studio/' }),
        imageAlt: TEXT('Bild-Beschreibung (Alt-Text)'),
        caption: TEXT('Bildunterschrift'),
      },
    }),

    region: singleton({
      label: 'Region & Vertrauen', path: 'src/content/site/region', format: { data: 'json' },
      schema: {
        eyebrow: TEXT('Label'),
        title: TEXT('Überschrift', { multiline: true, description: RICH }),
        clients: fields.array(fields.text({ label: 'Kunde' }), { label: 'Kundenliste', itemLabel: (p) => p.value }),
        stats: fields.array(
          fields.object({ n: TEXT('Zahl'), l: TEXT('Bezeichnung') }),
          { label: 'Kennzahlen', itemLabel: (p) => `${p.fields.n.value} ${p.fields.l.value}` },
        ),
      },
    }),

    prozess: singleton({
      label: 'Prozess', path: 'src/content/site/prozess', format: { data: 'json' },
      schema: {
        eyebrow: TEXT('Label'),
        title: TEXT('Überschrift', { multiline: true, description: RICH }),
        steps: fields.array(
          fields.object({ no: TEXT('Nummer'), t: TEXT('Titel'), d: TEXT('Text', { multiline: true }) }),
          { label: 'Schritte', itemLabel: (p) => p.fields.t.value },
        ),
      },
    }),

    work: singleton({
      label: 'Arbeiten (Sektion)', path: 'src/content/site/work', format: { data: 'json' },
      schema: {
        railLeft: TEXT('Leiste links'),
        railRight: TEXT('Leiste rechts'),
        title: TEXT('Überschrift', { multiline: true, description: RICH }),
        note: TEXT('Hinweis unter der Galerie', { description: 'z.B. Kennzeichnung der Dummymotive. Leer lassen, wenn alle Bilder echt sind.' }),
      },
    }),

    faq: singleton({
      label: 'FAQ', path: 'src/content/site/faq', format: { data: 'json' },
      schema: {
        eyebrow: TEXT('Label'),
        title: TEXT('Überschrift', { multiline: true, description: RICH }),
        cta: TEXT('Link-Text'),
        items: fields.array(
          fields.object({ q: TEXT('Frage'), a: TEXT('Antwort', { multiline: true }) }),
          { label: 'Fragen', itemLabel: (p) => p.fields.q.value },
        ),
      },
    }),

    contact: singleton({
      label: 'Kontakt / Footer', path: 'src/content/site/contact', format: { data: 'json' },
      schema: {
        eyebrow: TEXT('Label'),
        headline: TEXT('Überschrift', { multiline: true, description: RICH }),
        email: TEXT('E-Mail'),
        phone: TEXT('Telefon (Anzeige)'),
        phoneHref: TEXT('Telefon (Wählnummer, z.B. +43650…)'),
        location: fields.array(fields.text({ label: 'Zeile' }), { label: 'Vor Ort', itemLabel: (p) => p.value }),
        response: fields.array(fields.text({ label: 'Zeile' }), { label: 'Antwortzeit', itemLabel: (p) => p.value }),
        social: fields.array(
          fields.object({ label: TEXT('Name'), href: TEXT('Link (URL)') }),
          { label: 'Social-Links', itemLabel: (p) => p.fields.label.value },
        ),
        name: TEXT('Name (Copyright)'),
      },
    }),

    accelerator: singleton({
      label: 'Accelerator (Impact)', path: 'src/content/site/accelerator', format: { data: 'json' },
      schema: {
        eyebrow: TEXT('Label'),
        title: TEXT('Überschrift', { multiline: true, description: RICH }),
        lead: TEXT('Einleitung', { multiline: true }),
        offerTitle: TEXT('Überschrift „Was ich einbringe"'),
        offer: fields.array(
          fields.object({ t: TEXT('Titel'), d: TEXT('Untertitel') }),
          { label: 'Was ich einbringe', itemLabel: (p) => p.fields.t.value },
        ),
        causes: fields.array(fields.text({ label: 'Themenfeld' }), { label: 'Themenfelder', itemLabel: (p) => p.value }),
        steps: fields.array(
          fields.object({ no: TEXT('Nr.'), t: TEXT('Titel'), d: TEXT('Text', { multiline: true }) }),
          { label: 'Ablauf', itemLabel: (p) => p.fields.t.value },
        ),
        ctaLabel: TEXT('Button-Text'),
        ctaHref: TEXT('Button-Link (z.B. mailto:…)'),
      },
    }),

    impressum: singleton({
      label: 'Impressum', path: 'src/content/site/impressum', format: { data: 'json' },
      schema: {
        title: TEXT('Überschrift'),
        note: TEXT('Hinweis (optional, oben)', { multiline: true }),
        blocks: fields.array(
          fields.object({ heading: TEXT('Abschnitt'), body: TEXT('Text', { multiline: true }) }),
          { label: 'Abschnitte', itemLabel: (p) => p.fields.heading.value },
        ),
      },
    }),

    datenschutz: singleton({
      label: 'Datenschutz', path: 'src/content/site/datenschutz', format: { data: 'json' },
      schema: {
        title: TEXT('Überschrift'),
        note: TEXT('Hinweis (optional, oben)', { multiline: true }),
        blocks: fields.array(
          fields.object({ heading: TEXT('Abschnitt'), body: TEXT('Text', { multiline: true }) }),
          { label: 'Abschnitte', itemLabel: (p) => p.fields.heading.value },
        ),
      },
    }),

    seo: singleton({
      label: 'SEO & Firma', path: 'src/content/site/seo', format: { data: 'json' },
      schema: {
        siteName: TEXT('Seitenname'),
        defaultTitle: TEXT('Standard-Titel (Startseite / Fallback)', { description: 'Erscheint im Browser-Tab & bei Google. ~55–60 Zeichen, Keyword + Region.' }),
        titleTemplate: TEXT('Titel-Vorlage für Unterseiten', { description: 'Platzhalter %s = Seitentitel, z.B. „%s · dcentral".' }),
        defaultDescription: TEXT('Standard-Beschreibung', { multiline: true, description: 'Google-Snippet, ~150–160 Zeichen.' }),
        keywords: fields.array(fields.text({ label: 'Keyword' }), { label: 'Keywords', itemLabel: (p) => p.value }),
        business: fields.object({
          name: TEXT('Anzeigename'),
          legalName: TEXT('Rechtlicher Name'),
          street: TEXT('Straße'),
          postalCode: TEXT('PLZ'),
          city: TEXT('Ort'),
          region: TEXT('Bundesland'),
          country: TEXT('Land (Code, z.B. AT)'),
          lat: TEXT('Breitengrad (lat)'),
          lng: TEXT('Längengrad (lng)'),
          email: TEXT('E-Mail'),
          phone: TEXT('Telefon (international, z.B. +43…)'),
          priceRange: TEXT('Preisniveau (z.B. €€)'),
          areaServed: fields.array(fields.text({ label: 'Gebiet' }), { label: 'Einzugsgebiet', itemLabel: (p) => p.value }),
          sameAs: fields.array(fields.text({ label: 'Profil-URL' }), { label: 'Social/Profile (sameAs)', itemLabel: (p) => p.value }),
        }, { label: 'Firmendaten (für Google-Local-Schema)' }),
      },
    }),
  },
});
