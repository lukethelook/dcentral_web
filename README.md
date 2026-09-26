# dcentral. — „Von hier. Weiter."

Portfolio-Site für ein Salzkammergut-EPU: **ein Ansprechpartner, ein Netzwerk
dahinter.** Foto · Film & Aerial · Web · KI.

**Stack:** Astro 5 · Vanilla-CSS + ES-Module · **Three.js** (lokal gebündelt,
`src/scripts/vendor`) · selbst gehostete Fonts (`public/fonts`) · **Keystatic CMS** ·
Deploy auf **Vercel**.

Designkonzept: **„Von hier. Weiter."** (Sept. 2026). Tannengrün `#102f28`, Papier
`#f1f2e8`, Chartreuse `#d4ff3f`, Schrift `#153e35`. Manrope · Instrument Serif ·
DM Sans. Signature: interaktive Traunstein-Linienlandschaft im Hero (146 Fäden,
Einstieg einmal pro Tab-Sitzung), vier Disziplin-Muster, endlos laufende
Projektgalerie. Globale Bewegungspause + `prefers-reduced-motion`. Marke, Voice,
Motion-Regeln und Bildherkunft: **`docs/brand/`** (zuerst `BRAND-CONCEPT.md`).

## Loslegen

```bash
npm install
npm run dev      # Seite: http://127.0.0.1:4321  ·  CMS: http://127.0.0.1:4321/keystatic
npm run build    # Produktions-Build (Vercel)
```

## Inhalte bearbeiten (Keystatic CMS)

**Lokal:** `npm run dev` → `http://127.0.0.1:4321/keystatic`. Schreibt direkt in
die Dateien. **Live (nach Deploy):** `https://DEINE-DOMAIN/keystatic` → Login mit
GitHub → Änderungen werden committet → Vercel veröffentlicht automatisch neu.

Editierbar im UI:
- **Arbeiten / Projekte** — Cases anlegen/ändern, inkl. Titelbild und zwei
  Galerie-Vorschaubildern (Hover). Häkchen „Vorschau ist Dummymotiv" entfernen,
  sobald echte Projektbilder drin sind.
- **Seiteninhalte** — Hero, Manifest, Leistungen, Arbeiten (Sektion), Studio,
  Impact, Region, Prozess, FAQ, Kontakt (Texte, Listen, Kennzahlen, Bilder).

Konvention in Textfeldern: `*Wort*` = Serif-Akzent (Instrument Serif kursiv),
Zeilenumbruch = neue Zeile.

**Wo liegen die Inhalte?**
- Projekte: `src/content/cases/*.json` · Bilder: `public/images/cases/`
- Sektionen: `src/content/site/*.json`
- Design: `src/styles/redesign.css` (Basis) + `concept.css` (Konzept-Ebene) +
  `pages.css` (Unterseiten) · Interaktion: `src/scripts/*.js`
- Recht: `src/pages/impressum.astro`, `datenschutz.astro`, `bildnachweis.astro`

## Deploy & „von überall editieren" — Einrichtungs-Checkliste

Einmalig nötig (Konten: GitHub + Vercel, beide gratis):

1. **GitHub-Repo:** Repo anlegen, dann pushen:
   ```bash
   git remote add origin https://github.com/DEIN-USER/dcentral.git
   git push -u origin main
   ```
2. **Vercel:** vercel.com → „Add New Project" → Repo importieren (Astro wird
   erkannt). Deploy. → Seite ist live, baut bei jedem Push automatisch neu.
3. **`keystatic.config.ts`:** `const repo = 'OWNER/REPO'` auf dein GitHub-Repo
   setzen (z.B. `'DEIN-USER/dcentral'`), committen/pushen.
4. **Keystatic-GitHub-Login** (für Editieren von überall): auf der deployten Seite
   `…/keystatic` öffnen → dem Setup-Flow folgen (legt eine GitHub-App an) →
   die erzeugten Werte als **Environment Variables** in Vercel eintragen:
   `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`,
   `KEYSTATIC_SECRET` → in Vercel neu deployen.
   (Docs: keystatic.com/docs/github-mode)
5. **Domain:** in Vercel unter „Domains" deine Domain hinzufügen und die
   DNS-Einträge beim Domain-Anbieter setzen. (Hostinger-Hosting nicht mehr nötig.)

Danach: `domain/keystatic` → mit GitHub einloggen → editieren → speichern → live.

## Struktur

```
src/
  styles/global.css      Tokens (Mono+Signal), Type-Scale, Cursor, Curtain, .hl
  lib/ motion.ts         Lenis↔GSAP, magnetic(), whenVisible()
       gl.ts             OGL: flowmapText() (Hero + Studio-Logo), floatingPreview()
       transitions.ts    Curtain-Wipe zwischen Seiten
       text.ts           hl(): `*…*`→Signal, \n→<br>
  content.config.ts      Schema der cases-Collection (JSON)
  content/cases/*.json   Projekte  ·  content/site/*.json  Sektionstexte
  components/            Hero, Manifest, Leistungen, Work, Studio, Region,
                         Prozess, Faq, Footer, Nav  (lesen aus content/*)
  pages/                 index, arbeiten/[...id], impressum, datenschutz
keystatic.config.ts      CMS-Schema (Collections + Singletons)
astro.config.mjs         react + keystatic + vercel-Adapter
```

## Offene Punkte
- Echte Fotos/Logos eintauschen (Cases → Titelbild im CMS hochladen).
- Impressum/Datenschutz mit echten Daten füllen.
- Signal-Lime tauschbar in `global.css` (`--color-signal`, alt: `--color-signal-dim`).
