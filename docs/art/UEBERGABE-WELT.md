# Übergabe Welt H1 (Stand 2026-11-28)

Branch `work/world-h1-haeuser`, Worktree `Hockey-API-welt`, nichts gepusht. Alles Neue nur mit `welt.html?haeuser=neu`.

## Fertig und geprüft
- 236 Häuser in SpriteCook-Fassaden (`src/welt/haeuser.js`, `assets/welt/haeuser/`, `docs/art/HAEUSER.md`). Tests grün, Funktionsprüfung in der Welt bestanden.

## Fertig, nur teilweise geprüft
- **Google-3D-Kacheln nur rund ums Viertel** (`welt.js`, `showGoogle`, `viertelSchnitt`): mit einer Attrappe geprüft, nie mit echten Kacheln. Die letzte Fassung (ein Rechteck statt 57 Schnittflächen) ist gar nicht gelaufen.
- **Gezeichneter Boden** (`src/welt/boden.js`, `assets/welt/boden/boden.json`, `tests/boden.test.mjs`, `docs/art/prompts/boden.md`): Tests grün (2), **in der Welt noch nie gesehen**. Der erste Lauf scheiterte an einer fehlenden Definition, die nachgetragen ist; der Lauf danach ist nicht ausgewertet. Zu prüfen: Welt wird „bereit", Boden liegt über Luftbild und Pixelboden, Bolzplatz bleibt frei, Texturen passen im Maßstab.

## Offen
- Fassaden-Relief (Fenster zurück, Gesimse vor, Balkone, Markisen): nur Plan und Fenstererkennung (`relief.mjs`, siehe unten), kein Code im Repo.
- Straßenmöbel (Laternen, Fahrradbügel, Mülleimer an den OSM-Standorten in `ausstattung.geojson`), Bodendetails, parkende Autos (Stellen aus dem Luftbild), Durchfahrten auskleiden, Winter.
- Tablet-Leistung nicht gemessen. `tests/geodaten.test.mjs` braucht Python (fehlt auf diesem Rechner).
- SpriteCook: 360 Credits verbraucht, Rahmen vom Besitzer erweitert. Animationspreise unbekannt.

## Werkzeuge (nicht im Repo)
`C:\Users\krawalker\AppData\Local\Temp\opencode\h1\`: `bild.mjs` (Screenshots; `PLAN=1` schreibt den Bodenplan als Bild), `funktion.mjs`, `google.mjs` (Google-Attrappe), `diag.mjs` (warum wird die Welt nicht bereit), `relief.mjs` (Fensteröffnungen je Bausatz), `server.mjs` (Port 4180, Galerie unter `/review/`). Node: `C:\Program Files\nodejs\node.exe`, Playwright und Cesium aus `Hockey-API\node_modules`.
