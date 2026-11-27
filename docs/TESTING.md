# BORSTENBOOM! – Tests und CI

Alles läuft mit Node (ab 20) und Playwright. Python 3 wird nur für den Geodaten-Test gebraucht (nur Standardbibliothek).

## Einrichten (einmalig)

```sh
npm ci                              # Playwright und CesiumJS (festgenagelt, nur für die Tests)
npx playwright install chromium     # Browser für die Smoke-Tests
```

Python 3 und `gh` (nur für Pull Requests) unter Windows: `winget install Python.Python.3.12` und `winget install GitHub.cli`.

## Befehle

| Befehl | Was er prüft | Dauer |
|---|---|---|
| `npm test` | alle Unit- und Headless-Tests (`tests/*.test.mjs`), inklusive 36 geseedeter KI-Spiele | ca. 2 min |
| `npm run test:sim` | nur die KI-Simulation; Länge über `SIM_GAMES=180` (PowerShell: `$env:SIM_GAMES=180`) | je nach Anzahl |
| `npm run test:e2e` | Browser-Smoke-Tests: Halle, flacher Boni-Platz, 3D-Welt (`tests/e2e`) | ca. 3 min |
| `npm run assets:check` | Art-Bibliothek gegen `assets/manifest.json` | Sekunden |
| `npm run precache:check` | `sw-files.js` passt zum Dateibaum (neu erzeugen: `node tools/app/precache.cjs`) | Sekunden |
| `npm run ci` | alles oben in der Reihenfolge der CI | ca. 5 min |
| `npm run balance -- --games 36` | Balance-Bericht (misst nur, ändert nichts), siehe `docs/BALANCE_ANALYSE.md` | ca. 2 min |
| `npm run balance:history -- --games 18 <commit> …` | dieselbe Messung an älteren Commits (entpackt sie in den Temp-Ordner) | je Commit ca. 1 min |

## Verhalten ohne Werkzeuge

- Ohne Python 3 wird der Geodaten-Test mit Hinweis **übersprungen**. Mit `CI=true` oder `REQUIRE_TOOLS=1` **schlägt er fehl**. `PYTHON=<Pfad>` erzwingt einen Interpreter.
- Mit `E2E_PORT=<Port>` läuft der Testserver auf einem anderen Port. `node tools/test/static-server.mjs` startet ihn auch allein (ohne Python).

## Browser-Tests

- Jeder Test schlägt fehl bei einem unbehandelten JavaScript-Fehler, einem `console.error` oder einem HTTP-Fehler vom eigenen Server.
- Alle Anfragen, die den Testserver verlassen (Wetter, LGLN-Luftbild, Google), werden blockiert. Die Tests brauchen kein Netz. CesiumJS kommt aus `node_modules` (`?cesiumBase=`).
- Die 3D-Welt wird mit Software-Rendering (SwiftShader) gezeichnet; deshalb die langen Zeitgrenzen in `playwright.config.mjs`.

## CI (GitHub Actions)

- `.github/workflows/ci.yml`, bei jedem Push und Pull Request: Asset-Prüfung, Precache-Prüfung, Unit-Tests (mit Python, inklusive 36 KI-Spielen), Browser-Tests. Der Playwright-Bericht liegt als Artefakt am Lauf.
- `.github/workflows/simulation.yml`, jede Nacht und von Hand (`Run workflow`, Spiele einstellbar, Standard 180): lange Simulation plus Balance-Bericht.

## Bekannte Befunde (als TODO-Tests geführt)

- `tests/lineup.test.mjs`: Auf dem Boni stehen 4 statt 3 Feldspieler pro Seite auf dem Eis.
- `tests/precache.test.mjs`: `welt.html` und ihre Daten sind nicht im Offline-Precache.
