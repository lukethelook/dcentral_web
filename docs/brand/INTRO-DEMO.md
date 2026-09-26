# Final integrierter Fadenaufbau und separate Demo

Aufruf: `/intro-demo.html` (lokal auf Port 4176).

Der Nutzer hat die Variante mit individuellen Fäden freigegeben und finalisieren lassen. Sie ist jetzt in der randlosen Homepage integriert. Die separate Demo bietet weiterhin Wiederholen und Zeitlupe, verwendet aber denselben Renderer.

Jeder der 146 Fäden wird entlang seiner tatsächlichen dreidimensionalen Kurvenlänge gezeichnet. Linkes und rechtes Ende haben jeweils eine eigene Startzeit (0–220 ms) und Dauer (360–850 ms). Einige Fäden verbinden sich dadurch früh, andere später. Die Treffpunkte streuen im mittleren Drittel, damit keine gemeinsame Naht oder Wischkante entsteht. Bei Wiederholung werden die Tempi neu verteilt; die ganze Szene ist spätestens nach 1,1 Sekunden vollständig. Text und Buttons bleiben sofort sichtbar.

- `dist/landscapes.js`: gemeinsamer finaler Renderer. `intro-landscapes.js` ist nur noch ein Import für die Demo. Instanzattribute tragen die gemessene Bogenlänge, eine kleine Datentextur die zwei aktuellen Endpunkte pro Faden. Nach dem Einstieg werden keine weiteren Fadendaten hochgeladen. Der fertige Shader entspricht der originalen Darstellung.
- `dist/intro-threads.js`: individuelle Startzeiten, Dauern und Treffpunkte; für beide Enden separat ausgewertete Kurve `cubic-bezier(.23,1,.32,1)`.
- Die Kamera bestimmt nur die sichtbaren Startpunkte und den Bereich der Verbindung. Es gibt keine gemeinsame Bildschirmmaske mehr.
- `dist/intro-demo.html`, `intro-demo.css`, `intro-demo.js`: reduzierte Hero-Preview und Wiederholen-/Zeitlupenbedienung.
- Tatsächliche Laufzeit, unabhängig vom begrenzten Physik-Zeitschritt. Keine zusätzliche Bibliothek und kein zusätzlicher Renderer.

- Reduced Motion zeigt das vollständige Panorama sofort. Bewegungspause und Verlassen des Tabs beenden den Einstieg. Wiederholen ist während des kurzen Aufbaus deaktiviert.
- Keine Dauerschleife. Zeitlupe ×3 dient allein der Beurteilung des Entwurfs.

Auf der Homepage läuft der Einstieg einmal pro Tab-Sitzung (`dcentral:hero-entry:v1`). Die Demo besitzt `data-intro-demo` und umgeht den Sitzungsspeicher für explizite Wiederholungen.

Verifikation: monotones Wachstum, unabhängige Enden und vollständiger Abschluss aller 146 Fäden bei 1,1 s numerisch geprüft; sichtbare Zwischenphase in der Browser-Zeitlupe und vollständiges Panorama kontrolliert.
