# dcentral — „Der zentrale Knoten"

Portfolio-Site für ein Salzkammergut-EPU: **ein Ansprechpartner, ein Netzwerk
dahinter.** Foto · Film & Aerial · Web · KI.

**Stack:** Astro 5 (static) · Tailwind v4 · GSAP (+ScrollTrigger) · Lenis
(Smooth-Scroll) · **OGL** (schlanke WebGL-Shader) · selbst gehostete Fonts
(@fontsource). Baut statisch → läuft auf jedem Hostinger-Plan.

Designkonzept: **„Mono + Signal"** — Brutalist-Tech. Carbon-Schwarz `#0E0E0E`,
Paper-Weiß `#F4F4F0`, ein elektrischer Lime-„Signal" `#C2F23D` (sparsam: CTA,
Hover, Key-Words). XXL-Grotesk (Archivo), sichtbares Hairline-Raster, Mono-
Metadaten. Spine bleibt: ein zentraler Knoten + Netzwerk, Salzkammergut.
Durchgehend WebGL (Hero-Flowmap, Arbeiten-Preview), MPA-Curtain-Übergänge,
alles mit `prefers-reduced-motion`-Fallback.

## Loslegen

Voraussetzung: Node.js 22+.

```bash
npm install
npm run dev      # → http://localhost:4321
npm run build    # → ./dist  (auf Hostinger public_html hochladen)
```

## Struktur

```
src/
  styles/global.css          Tokens (Mono+Signal), Type-Scale, Cursor, Curtain, Legal, Base
  lib/motion.ts              Lenis↔GSAP-Sync, magnetic(), whenVisible(), reduced-motion-Guard
  lib/gl.ts                  OGL-Layer: flowmapText() (Hero) + floatingPreview() (Work)
  lib/transitions.ts         MPA-Curtain-Wipe (Signal) zwischen Seiten
  layouts/Layout.astro       <head>, Fonts, SEO/OG, Smooth-Scroll, Cursor, Transitions
  components/
    Nav.astro                Fixed, scroll-aware, Mono, Signal-Hover
    Hero.astro               Flowmap-Typo-Distortion (OGL) — XXL „DCENTRAL", cursor-velocity + RGB-Split
    Manifest.astro           XXL-Statement, zeilenweiser Reveal, Signal-Highlights
    Leistungen.astro         4 Disziplinen als nummerierte Index-Zeilen (Akkordeon)
    Work.astro               Cases als Index-Liste + Floating-WebGL-Preview (velocity-distortion)
    Studio.astro             Knoten-Netzwerk als Signal-Wireframe (2D-Canvas)
    Region.astro             XXL-Grotesk-Ticker + Count-up-Stats
    Prozess.astro            4-Schritt-Stepper mit scrub-Linie (Signal)
    Faq.astro                Index-Akkordeon + FAQPage-JSON-LD
    Footer.astro             XXL-Kontakt-CTA (magnetisch) + Rechtslinks
  content.config.ts          Schema der "cases"-Collection
  content/cases/*.md         Case-Studies (Platzhalter — Frontmatter editieren)
  pages/
    index.astro              Onepage-Komposition
    arbeiten/[...id].astro    Case-Detailseiten
    impressum.astro · datenschutz.astro
```

## Inhalte pflegen

**Neuer Case:** Markdown-Datei in `src/content/cases/` ablegen. Frontmatter:
`title, client, discipline (Foto|Film & Aerial|Web|KI), year, summary, tags[],
hue (0–360 für Platzhalter-Visual), format (portrait|landscape|square), cover?,
featured, order`. Sobald echte Bilder da sind: `cover: "/images/…"` setzen —
das generative Platzhalter-Visual wird automatisch ersetzt.

**Echtes Hero-Bild:** Der Shader kann statt des generativen Felds ein Foto als
Textur samplen und übers Ripple verzerren (siehe Kommentar in `Hero.astro`).

## Auf Hostinger deployen

1. **Statisch (jeder Plan):** `npm run build`, dann *Inhalt* von `dist/` per
   File Manager/FTP in `public_html`. Fertig.
2. **Git-Deploy (Business/Cloud):** Repo zu GitHub, in hPanel verknüpfen,
   Node 22+ wählen — baut bei jedem Push.

## Offene Punkte / Optionen

- WebGL-Layer läuft über OGL (~17 kB gzip, geteilt von Hero + Work).
- Signal-Lime ist an einer Stelle tauschbar (`@theme` → `--color-signal`),
  Alternative `--color-signal-dim`, falls zu grell.
- Echte Fotos/Logos/Projektnamen eintauschen.
- Impressum/Datenschutz mit echten Daten füllen (Platzhalter markiert).
- Finale Headlines/Copy gegenlesen.
