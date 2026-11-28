# Übergabe an eine neue Sitzung (Stand 2026-11-28, Commit `7b7725e`)

Diesen Text als erste Nachricht in eine neue Claude-Code-Sitzung kopieren.

---

Du übernimmst die Arbeit an **BORSTENBOOM!**, einem Browser-Spiel für den Kinder-Inlinehockeyverein Boni Borstentiere aus Hannover-List. Repository: `recurrentanalytics/Hockey`, Branch `claude/inline-hockey-game-v0a0yo`. Arbeite und pushe nur auf diesem Branch, erstelle keine Pull Requests.

## Feste Regeln
- **Sprache:** Antworte auf Deutsch. Code-Kommentare sind Englisch, Doku und Commit-Texte Deutsch.
- **Datenschutz:** Das Repository ist öffentlich. Nie Namen von Kindern, Familienangaben oder persönliche Daten ins Repository. Fotos von Kindern sind nur lokale Referenz. In der Spieldoku heißen die Kinder „Kind A“ und „Kind B“.
- **Geheimnisse:** Cesium-Token, Signaturschlüssel und Passwörter nie ins Repository. Schlüssel nur über `request_credential`. Den Signaturschlüssel der Android-App hat der Besitzer selbst; zum Bauen setzt er `BONI_KEYSTORE` und `BONI_KEYSTORE_PASS`.
- **Google-3D-Kacheln:** nie dauerhaft speichern oder offline vorhalten.
- **Assets:** Jedes neue Asset wählt der Besitzer selbst aus. Kandidaten bestellen, als Vergleichsbogen zeigen, erst nach seiner Wahl eintragen (`tools/assets/library.mjs`, `assets/manifest.json`, Aufträge in `docs/art/prompts/`).
- **Quellenangaben:**
  - „© GeoBasis-DE / LGLN, CC BY 4.0“ (Luftbild, ALKIS)
  - „© GeoBasis-DE / LGLN, dl-de/by-2-0“ (LoD2-Dächer)
  - „© OpenStreetMap-Mitwirkende, ODbL“
- **Commits:** Erst committen und pushen, wenn alles geprüft ist:
  - `node --test tests/*.test.mjs` (heute 122 bestanden, 0 fehlgeschlagen, 0 offen)
  - `npm run -s assets:check` (0 Fehler)
  - `npm run -s precache:check`

  Im Commit-Text keine Modellnamen; die Zeilen am Ende gibt die Umgebung vor. Wird der Push abgelehnt: `git fetch` und `git merge`, kein Force-Push. Eine andere Sitzung arbeitet gelegentlich auf demselben Branch.
- **Ehrlich berichten:** Was nicht geprüft werden konnte (echte Google-Kacheln ohne Token, echte Geräte), so benennen.

## Wo was steht
- **Einstieg:**
  - `welt.html` ist die Startseite: Anflug auf den Boni, die 3D-Welt mit CesiumJS, das Spiel auf dem echten Platz.
  - `index.html` ist das Hallenspiel und der Offline-Rückfall.
  - `test.html` ist ein flacher Testplatz.
  - Dazu gibt es eine Android-App (`android/`, `tools/android/build.sh`).
- **Überblick:** `docs/ROADMAP.md` (Phasen und Nebenstrang „Architektur-Bibliothek“), `docs/WORLD_ARCHITECTURE.md`, `docs/TECHNICAL_DEBT.md`, `docs/BONI_ORT.md`, `docs/PERFORMANCE_TEST.md`.
- **Ort:** `locations/boni/ort.js` ist die Ortsbeschreibung mit Ecken, Blick, Zaun, Spielfeld und Verweisen. Sie wird gelesen von `src/config.js` und `src/welt/*`, Python liest sie mit `tools/ort/ort.py`. Geodaten liegen in `locations/boni/geo/`, die gemessenen LoD2-Dächer und Gebäudeteile in `daecher.json` (erzeugt mit `tools/ort/lod2.py`).
- **Häuser:**
  - `src/bau/haus.js` enthält die engine-neutralen Regeln: Körper, Dach, Wandläufe, Bausätze, `netz()`, `relief()`.
  - `src/welt/haeuser.js` ist der CesiumJS-Adapter mit Shader.
  - Die Fassaden-Bausätze stehen in `assets/welt/haeuser/bausaetze.json`, mit vermessenen `oeffnungen` und `gesimse` (aus `tools/assets/fassaden-vermessen.mjs`).
  - Schemas liegen in `schema/`.
  - `tests/referenz/viertel.json` hält fest, was die Regeln aus jedem der 481 Baukörper machen. Gewollte Änderungen schreibt `UPDATE_REFERENZ=1` neu.
  - Doku: `docs/art/HAEUSER.md`.
- **Maßstab** (`assets/welt/massstab.json`):

  | Ebene | Pixel je Meter |
  |---|---|
  | Kulisse (Häuser, Boden, Dachteile) | 12,5 |
  | Bühne (Figuren, Straßenmöbel, Spielplatz; Kind 1,4 m = 32 px) | 23 |
  | Bäume (Ausnahme, Zeichenmodelle enden bei 128 px) | 9 |

  Größere Fassaden lassen sich mit SpriteCook nicht erzeugen; das ist getestet.
- **Physik und Wetter:**
  - `src/game/surface.js` bestimmt Haftung, Ball, Wind und Rutschen je Wetter.
  - Pässe gleichen den Bodenwiderstand aus, Torhüter sind auf Nässe, Schnee und Glätte langsamer.
  - Tests: `tests/wetter.test.mjs`, `tests/wetter-spieler.test.mjs`.
- **Prüfwerkzeuge:**
  - `?fps` blendet die Leistungsanzeige ein, `?dunst=a,b,s` stellt den Dunst über den Google-Kacheln ein, `?relief=0` schaltet das Fassaden-Relief ab.
  - `tools/test/welt-leistung.cjs` misst die Bilddauer je Variante.
  - Browser-Prüfungen laufen mit Playwright und SwiftShader. CesiumJS lokal über `CESIUM_DIR` (siehe Kopf von `tools/test/welt-leistung.cjs`), dazu `cesiumBase=/_cesium/` an der Adresse.
- **SpriteCook:** Es gibt ein Projekt „BORSTENBOOM“. `pixel-engine-image-v1` zeichnet pixelgenau 16–128 px und ist am besten für Sprites im Weltmaß. Die Bildmodelle behalten das Raster ihrer Vorlage.

## Stand und offene Punkte
**Zuletzt erledigt:**
- Fassaden-Relief (`7b7725e`): Rahmen, Laibungen, Bänke und Gesimse aus den vermessenen Bauteilen, an den Straßenseiten im Umkreis von 100 m, 126 000 Ecken, abschaltbar.
- LoD2-Dächer und -Gebäudeteile.
- Wetterphysik für Torhüter und Pässe.
- Ortsbeschreibung (Roadmap 0.6).
- Entscheidung „Welt im Browser nur online, offline die Halle“.
- 3 gegen 3 auf dem Boni.
- Bühne im niedlichen Maß, Chibi-Spielerfigur mit Fahranimation in der Welt.

**Offen, nach Vorrang:**
1. **Leistung des Reliefs auf echten Geräten:** Der Besitzer misst mit `welt.html?fps` und `?relief=0`. Im Software-Rendering kostete das Relief rund 30 % Bilddauer. Wenn es ruckelt, `RELIEF.umkreis` in `src/bau/haus.js` verkleinern, oder die doppelt gezeichneten Fassaden-Pixel vermeiden (Vorderflächen der Rahmen). Ideen zur Verbesserung: Relief nach Kameraabstand ein- und ausblenden, Hofseiten nur nah.
2. **Roadmap 0.3:** Messung auf Tablet und Handy steht aus (macht der Besitzer).
3. **Roadmap 0.4:** automatischer Boni-Test, also Browser-Test mit Standbildern an festen Kameras gegen Referenzbilder. Achtung: Live-Wetter und Uhrzeit verändern das Bild. Für den Test Wetter und Zeit fest setzen, sonst weichen schon zwei Läufe desselben Codes um etwa 9 von 255 ab.
4. **Technische Schuld T5, Rest:** `tools/intro/court_glb.py` und `shadow_casters.py` auf `tools/ort/ort.py` umstellen.
5. **Stil (vom Besitzer vorerst zurückgestellt):**
   - Gegner im Chibi-Stil in anderen Trikotfarben (die Figur trägt die Farben fest im Bild),
   - neuer Torwart (dunkles Maskengitter, nicht wie ein weißer Bart),
   - Zuschauer am Zaun,
   - die Figuren des 2D-Spiels selbst.
6. **Architektur-Bibliothek:** Schritte 6–9 ruhen bis zu einem zweiten Projekt (`docs/ROADMAP.md`, Nebenstrang).

## Wie der Besitzer arbeiten möchte
- **Rückmeldung:** Kurze, klare Antworten, ohne Rückfragen-Schleifen bei Kleinigkeiten. Bei echten Entscheidungen (Kosten, Stil, Umfang) kurz fragen, mit Empfehlung.
- **Bilder:** Ergebnisse als Bild zeigen, z. B. vorher/nachher aus der Welt, Vergleichsbögen für Assets.
- **Stil der Welt:** einheitlich und so niedlich wie möglich, aber deutlich erkennbar, nicht überdetailliert.
- **Leistung:** Flüssig im Browser hat Vorrang vor Tablet-Spezialfällen.

Lies zuerst `docs/ROADMAP.md` und `docs/art/HAEUSER.md`, führe die Tests aus und sag mir dann kurz, womit du anfangen würdest.
