# Gestaltungs- und Motion-System

Die vollständige Markenbegründung und Brand Voice stehen in BRAND-CONCEPT.md, die visuelle Darstellung in dist/brandbook.html.

## Palette und Satz

Tannengrün #102f28, Papier #f1f2e8, dunkle Schrift #153e35, Chartreuse #d4ff3f. Manrope für klare Headlines, Instrument Serif für ausgewählte richtungsgebende Worte, DM Sans für längere Texte. Keine wechselnden Headlinefarben. Hero „Von hier. Für Weiter.“ bleibt ruhig zweizeilig.

Große offene Flächen, asymmetrische Disziplin-Bühne, galerieartige horizontale Projektstrecke. Inhalt ist sichtbar, auch wenn Animationen ausfallen. Mobile Disziplinwahl zeigt alle vier Optionen in zwei Reihen.

## Disziplinbilder

| Gruppe | Farbe | Komposition |
| --- | --- | --- |
| Fotografie | Limette #d4ff3f | versetzte konzentrische Fokuslinien |
| Film & Aerial | Eisblau #b5dbe8 | fließende Flug- und Höhenlinien |
| Web | Flieder #cdc1ee | kontinuierlich verformtes Koordinatengewebe |
| AI-Solutions | Koralle #edb09b | harmonisch verschachtelte Schleifen |

Gemeinsames Linienmaterial, deutlich verschiedene Kompositionen. Langsame Modulation, lokale Hover-Auslenkung. Auf Mobil reduzierte Dichte gegen Moiré.

## Bildwelt

Der Herkunft-Bildabschnitt wurde auf Nutzerwunsch entfernt. Die generierte Wasser-/Kalkstein-Materialstudie bleibt im Studio. Die Projektgalerie nutzt vorerst ausdrücklich freigegebene Dummymotive; sie sind als solche markiert und keine echten Projektaufnahmen. Quellen: DUMMY-MEDIA.json. Zuordnung: PROJECT-MEDIA.json.

Der Hero ist randlos und rechteckig über die volle Breite: keine Rundung und kein Außenabstand. Footer und Kennzahlen verwenden Chartreuse mit dunkelgrüner Schrift. Pfeil und Linienband wurden entfernt; das Manifest bleibt typografisch.

## Bewegung

Hero: bekannte Silhouette und zufällige Kreis/Kreuz/Stern-Pulse, selten kurz gedämpft Rot-Weiß-Rot. Instanzierte Bildschirmbänder mit weichen Alphakanten, 1,5–2-fache Pixeldichte und 1.560 horizontalen Samples. Auf Mobil alternierende Reihen ausgeblendet.

Hero-Einstieg: 146 Fäden wachsen unabhängig entlang ihrer Kurven, 1,1 s beim ersten Besuch pro Tab-Sitzung. Typografie und Buttons sind sofort sichtbar und bewegen sich nicht beim Einstieg. Disziplinwechsel: 260 ms, 9px, per Tastatur sofort. UI-Reaktionen: 160–240 ms. Projektgalerie: nahtloser Durchlauf mit 22px/s, Pause bei Hover/Fokus, manuelles Scrollen und Desktop-Drag. Hover öffnet das Dummymotiv in 280ms; Bilder wechseln alle 2,1s. Tastaturfokus öffnet ohne Bewegung. Scrollen steuert ausschließlich den Lesefortschritt.

Globale Pause und Reduced Motion gelten für alle Systeme. Offscreen-Canvas pausiert. Keine animierten Mauszeiger, kein Ton, keine künstlichen Ladezeiten.
