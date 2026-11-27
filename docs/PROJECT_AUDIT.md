# BORSTENBOOM! – Technische Bestandsaufnahme

Stand: 27. November 2026, Zweig `claude/inline-hockey-game-v0a0yo`, Commit `3938495` (75 Commits).
Geprüft am Code, nicht an der Projektbeschreibung. Wo etwas nicht gemessen oder nicht sicher ist, steht das dabei.

Verwandte Dokumente: [ARCHITECTURE.md](ARCHITECTURE.md) (wie es zusammenhängt), [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md) (was zu tun ist), [ROADMAP.md](ROADMAP.md).

---

## 1. Kurzfazit

BORSTENBOOM! ist kein Prototyp mehr, sondern ein vollständiges, spielbares Sportspiel mit einem bemerkenswert tiefen Kern. Regeln, KI, Torhüter, Animationen und Eingabe sind ausgereift. Darüber liegt eine junge, schnell gewachsene Schicht für den echten Ort (3D-Welt, Wetter, Schatten, Jahreszeiten, Untergrund).

- **Am wertvollsten:** der Spielkern (`src/game`, `src/world`, `src/input`), die saubere Trennung von Spiellogik und Darstellung über **eine** Projektionsfunktion (`project()`), der Untergrund als Faktormodell (`src/game/surface.js`) und die reproduzierbaren Asset-Werkzeuge (`tools/`).
- **Am stärksten auf den Boni zugeschnitten:** `src/intro/photoreal.js` (646 Zeilen, eine Datei für Kamera-Flug, Platzmodell, Shader, Wetter-Anbindung und Spielbrücke) und überall verstreute Boni-Konstanten (Ecken, Maße, Rasterausschnitte).
- **Größtes Risiko:** Es gibt keine Messung auf einem echten Tablet. Getestet wurde in Headless-Chromium mit Software-Rendering.
- **Größte stille Schuld:** Die Eingangsdaten der Werkzeuge (LGLN-Raster, Asphaltfoto) liegen nicht im Repository. Der Boni lässt sich heute nicht aus dem Repo heraus neu erzeugen.

---

## 2. Verzeichnisstruktur und Umfang

| Bereich | Inhalt | Umfang |
|---|---|---|
| `index.html` | Hallen-Version (Arena, 2D-Pixelhalle), Startpunkt ohne 3D | 22 Zeilen |
| `intro.html` | Hauptversion: 3D-Intro und Spiel auf dem echten Boni, Wetter-Menü (HTML/CSS inline) | 116 Zeilen |
| `test.html` | Schnelltest: Boni-Regeln auf flachem 2D-Platz, ohne 3D | 22 Zeilen |
| `src/main.js`, `config.js`, `settings.js` | Spielschleife, globale Konstanten, Einstellungen | 137 / 86 / 114 |
| `src/engine/` | Anzeige, Schrift, Zeichnen, Audio, Speicher, Vollbild (8 Module) | ≈ 850 |
| `src/input/` | Tastatur, Zeiger, Touch, Gamepads, Belegung (8 Module) | ≈ 960 |
| `src/game/` | Spiel, KI, Schiedsrichter, Regeln, Ball, Torhüter, Turnier, Wiederholung, Untergrund (10 Module) | ≈ 2 330 |
| `src/world/` | Figuren, Spieler, Halle, Kamera, Projektion, Partikel, Ansicht (8 Module) | ≈ 1 990 |
| `src/scenes/`, `src/ui/` | 13 Szenen (Menüs, Spiel, Pause, Belegung …), 4 UI-Bausteine | ≈ 1 800 |
| `src/intro/` | 3D-Welt: `main.js` (Start, Token), `photoreal.js` (Flug, Platz, Shader, Spielbrücke), `environment.js` (Wetter, Sonne, Jahreszeit) | 57 / 646 / 337 |
| `src/test/flat.js`, `src/native/pads.js` | Testplatz, Gamepad-Brücke der Android-App | 64 / 17 |
| `tools/` | Platzmodell, Schatten-/Kronenkarte, Stimme, Precache, Android-Build, Testläufe | ≈ 560 |
| `android/` | WebView-App (`MainActivity.java`, 308 Zeilen) | – |
| `assets/` | Pixelart (288 KB), Stimme (444 KB), 3D-Ort (1,2 MB), Schrift, App-Icons | ≈ 2 MB |
| `audio/hymne.mp3` | Vereinshymne (Torsong) | 4,0 MB |
| `docs/` | Ort, Roadmap, ältere Konzepte, Ortsbilder | 600 KB |

JavaScript gesamt: rund 9 500 Zeilen in 58 Modulen. Es gibt keine Laufzeit-Abhängigkeiten außer CesiumJS (vom CDN jsDelivr, in der App mitgeliefert) und keinen Build-Schritt.

---

## 3. Was wirklich implementiert ist (am Code geprüft)

Legende: ✅ vorhanden und genutzt · 🟡 vorhanden, aber mit Einschränkung · ⚪ nur angelegt oder veraltet

### 3.1 Spiel und Physik

| Funktion | Stand | Wo |
|---|---|---|
| Spielschleife mit festem 60-Hz-Takt, Szenenstapel | ✅ | `src/main.js` |
| Inlinehockey mit Ball (Standard) oder Puck | ✅ | `src/game/puck.js` (`PUCK`, `BALL`) |
| Ballphysik mit Höhe, Unterschritten, Bande, Pfosten, Netz, Aufspringen | ✅ | `src/game/match.js` `stepPuck()`, `src/game/physics.js` |
| Tor nur von vorne | ✅ | `match.js` `checkGoal()` (`p.mouth`) |
| Passen (vorgehalten), Schuss mit Aufladen, Direktschuss, Poke-Check, Bodycheck, Sprint, Ausdauer, Ermüdung | ✅ | `match.js`, `src/world/skater.js` |
| Automatischer Spielerwechsel (nächster zum Ball) und Wechsel auf den Passempfänger | ✅ | `match.js` `actions()`, `switchPlayer()` |
| Team-KI mit Stärken (auch „Kinder“), Torhüter-KI | ✅ | `src/game/ai.js` (`LEVELS`), `src/game/goalie.js` |
| Regelwerke World Skate, USARS, ISHD mit Strafen, verzögerter Strafe, Penalty, Verlängerung, Penaltyschießen, Auszeiten | ✅ | `src/game/referee.js`, `src/game/rules.js`, `RULES.md` |
| Modi: gegen KI, Turnier, 2 Spieler (gegeneinander, zusammen, geteilt), Training | ✅ | `src/scenes/*.js` |
| Reihenwechsel (2 Reihen à 4) | 🟡 | `match.js` `lineChanges()`; auf dem Boni wird 3 gegen 3 gespielt (`N = FIXED ? 3 : 4` in `src/scenes/rink.js`) |
| Wiederholung, Zeitlupe, Torjubel, drei Sterne, Statistik | ✅ | `src/game/replay.js`, `src/scenes/rink.js` |
| Skelett-Animation mit 37 Posen, Kontur zu Pixelart gewandelt, Sprite-Cache | ✅ | `src/world/figures.js`, `src/world/sprites.js` |
| Untergrund nach Wetter (Grip, Tempo, Bremsen, Ermüdung, Ausrutschen, Ball, Wind) | 🟡 | `src/game/surface.js`; wirkt nur auf Feldspieler und Ball, **nicht** auf Torhüter und nicht auf KI-Planung (siehe Abschnitt 5.4) |

### 3.2 Eingabe, Ton, Stimme

| Funktion | Stand | Wo |
|---|---|---|
| Tastatur (2 Profile), Touch (Stick und Knöpfe, auch für Menüs), jedes Gamepad, frei belegbar | ✅ | `src/input/manager.js` u. a. |
| 8BitDo SN30 Pro und Micro erkannt; native Gamepad-Brücke in der App | ✅ | `src/input/pads.js`, `src/native/pads.js`, `MainActivity.java` |
| Synthetische Soundeffekte (Web Audio), Publikum, Umgebung draußen (Stadt, Vögel), Zaunklappern | ✅ | `src/engine/audio.js` |
| Torsong: Vereinshymne | ✅ | `audio/hymne.mp3`, `audio.song()` |
| Kommentar und Erzählung als vorab erzeugte MP3 (Piper, „Thorsten“, CC0) | ✅ | `assets/voice/`, `tools/voice/` |
| Gerätestimme als Ersatz (Browser und Android-TTS) | ✅ | `photoreal.js` (Erzählung), `MainActivity.java` |

### 3.3 Räumliche Welt (nur `intro.html`)

| Funktion | Stand | Wo |
|---|---|---|
| Flug vom Planeten über Deutschland und Hannover auf den Boni, Erzähltext gesprochen, überspringbar | ✅ | `photoreal.js` (`STORY`, `ZOOM`, `T`, `place()`, `narrate()`) |
| Google Photorealistic 3D Tiles über Cesium ion, Token nur auf dem Gerät | ✅ | `photoreal.js`, `src/intro/main.js` |
| Platz aus amtlichem Luftbild rekonstruiert (4 Eckpunkte) | ✅ | `COURT` in `photoreal.js`, `docs/BONI_ORT.md` |
| Eigenes Platzmodell (Zaun, Tore, Pfosten) und eigener Boden | ✅ | `assets/intro/boni_platz.glb`, `boni_boden.glb`, `tools/intro/court_glb.py` |
| Pixel-Figuren mit derselben Kamera projiziert | ✅ | `BONI_3D.toCss` → `src/world/projection.js` |
| Bäume vor dem Platz werden durchsichtig (Dither) | ✅ | `seeThrough`-Shader in `photoreal.js` |
| Kronen- und Dachhöhenkarte aus LGLN-Höhenmodell | ✅ | `assets/intro/boni_schatten_hoehen.png`, `tools/intro/shadow_casters.py` |
| Sonnenschatten der Bäume und Häuser per Strahlverfolgung, Lichtflecken | ✅ | `TREE_LIGHT` in `src/intro/environment.js` |
| Schatten von Pfosten und Rahmen (Cesium-Schattenkarte) | ✅ | `photoreal.js` (`viewer.shadows`, `courtShader`) |
| Figurenschatten nach Sonnenstand, nur in der Sonne | ✅ | `setSunShadow()` (`photoreal.js`), `Skater.drawShadow()` |
| Torkamera umkreist den echten Platz | ✅ | `BONI_3D.onGoal` |

### 3.4 Umwelt und Jahreszeiten (nur `intro.html`)

| Funktion | Stand | Wo |
|---|---|---|
| Live-Wetter, historisches Wetter ab 1940, Wahl von Hand | ✅ | `environment.js` (`fetchWeather`, Open-Meteo `forecast` und `archive`) |
| Sonnenstand (NOAA-Näherung) | ✅ | `sunPosition()` |
| Farbstimmung, Nebel, Vignette (Post-Processing) | ✅ | `createEnvironment()` |
| Regen und Schnee fallen (Canvas-Overlay), nasser oder verschneiter Boden | ✅ | `#weatherFx`, Boden-Shader |
| Laubentwicklung nach Datum, Herbstfarben, Winter-Ausdünnung mit Luftbild-Boden | ✅ | `season()`, `SEASON`-Shader, `boni_schatten_luftboden.glb` |
| Herbstlaub auf dem Platz | ✅ | Boden-Shader (`u_leaves`) |
| Laternenlicht nachts | 🟡 | Boden-Shader; zwei feste Lichtkegel, Lage geschätzt, keine echten Laternenstandorte |
| Temperatur und Wind einstellbar, Platzzustand wird angezeigt | ✅ | `weatherPanel()`, `#surface` |
| Nässe als Zustand mit Gedächtnis (Abtrocknen, Pfützen) | ⚪ | nicht vorhanden; Nässe folgt sofort dem aktuellen Wettersymbol |

### 3.5 Auslieferung

| Funktion | Stand | Wo |
|---|---|---|
| GitHub Pages, automatische Aktualisierung | ✅ | `sw.js` (eigene Dateien zuerst aus dem Netz) |
| PWA (zwei Manifeste: Hauptspiel und Testplatz) | ✅ | `manifest.webmanifest`, `manifest-test.webmanifest` |
| Offline: Halle und Testplatz; Google-Kacheln nie gespeichert (Nutzungsbedingungen) | ✅ | `sw.js` (`NEVER`), `sw-files.js` |
| Android-WebView-App mit Live-Version und mitgelieferter Ersatzkopie | 🟡 | `MainActivity.java`, `tools/android/build.sh`: **die Ersatzkopie ist unvollständig**, siehe Abschnitt 5.6 |
| Signaturschlüssel | 🟡 | liegt nur in der Arbeitsumgebung, noch nicht übergeben |

---

## 4. Was gut ist

1. **Eine Projektionsfunktion als Naht zwischen Spiel und Darstellung.** Die gesamte Spiellogik rechnet in Metern (`x` längs, `y` quer, `z` hoch). Nur `project()` in `src/world/projection.js` entscheidet, ob daraus die Schrägprojektion der Halle, der flache Testplatz oder die echte Cesium-Kamera wird. Das ist der Grund, warum dasselbe Spiel auf drei Darstellungen läuft. Diese Naht ist das wertvollste Architekturelement für die spätere Welt.
2. **Spielkern ohne Ortswissen.** `referee.js`, `rules.js`, `replay.js`, `physics.js`, `tournament.js` und `surface.js` importieren weder Cesium noch DOM. `match.js` kennt den Ort nur über `RINK` und `GOAL`.
3. **Untergrund als reines Faktormodell.** `surface.js` ist eine reine Funktion (`surfaceFor`) plus ein Zustandsobjekt (`SURF`). Ohne 3D bleibt alles neutral. Das ist eine sehr gute Ausgangslage für das Umweltsystem.
4. **Daten statt Handarbeit beim Ort.** Platzmodell, Kronenkarte und Luftbild-Boden werden von Skripten aus amtlichen Daten gebaut (`tools/intro/*.py`), Stimmen ebenfalls (`tools/voice/`).
5. **Sparsame Abhängigkeiten.** Kein Framework, kein Bundler. Die App startet als Ordner von Dateien. Das hält die Wartung klein.
6. **Gute Rückfallebenen.** Ohne Token oder Netz startet die Halle, ohne Google-Daten der Testplatz, ohne Stimmdateien die Gerätestimme.

---

## 5. Befunde

### 5.1 Fest auf den Boni zugeschnitten

Die Boni-Geometrie steht an mindestens acht Stellen, jeweils von Hand abgestimmt:

| Wert | Stellen |
|---|---|
| Eckpunkte (Lat/Lon) | `COURT` in `src/intro/photoreal.js`, `docs/BONI_ORT.md` |
| Eckpunkte als Pixel im LGLN-Referenzraster (`888.6, 591.5` …) und Rasterausschnitt (`x0 = -2176` …) | `tools/intro/shadow_casters.py` (und früher im Luftbild-Intro) |
| Zaunmaß 25,2 × 18 m | `tools/intro/court_glb.py`, `src/test/flat.js` (`FENCE`), Boden-Shader in `environment.js` (`12.6`, `9.0`) |
| Spielfeld 22,8 × 17,2 m, Tore 1,37 m, Torlinie 9,2 m | `BONI_RINK` in `src/config.js`, `court_glb.py` |
| Kronenkarte: Radius 46 m, Raster 0,5 m, Größe 185 × 167 | `shadow_casters.py`, `TREE_LIGHT` (`46.0`, `41.4`, `185.0`, `167.0`), `crownAt()` in `photoreal.js` |
| Blickrichtung 118,2°, Neigung 60° | `photoreal.js` (`FINAL_HEADING`, `FINAL_TILT`) |
| Laternenpositionen | Boden-Shader (Texturkoordinaten) |
| Geografie, Ortsnamen und Erzähltext | `STORY`, Kartennadeln, `tools/voice/lines.json` |

Ändert sich eine Zahl an einer Stelle, laufen die anderen still auseinander. Für einen zweiten Ort müsste man alle Stellen finden.

### 5.2 Kopplung über einen globalen Schalter

`globalThis.BONI_3D` wird **vor** dem Laden des Spiels gesetzt und beim Import ausgewertet:

- `src/config.js` wählt beim Import `RINK`, `GOAL`, `SKATE` und `SHOT` (Boni oder Halle).
- `src/world/projection.js` setzt `FIXED` beim Import.
- `src/game/ai.js` skaliert seine Positionen beim Import (`K`, `KY`).
- `src/scenes/rink.js` wählt 3 gegen 3 beim Import.

Folge: Ort und Spielfeld lassen sich zur Laufzeit nicht wechseln, ohne die Seite neu zu laden. Für die geplante Reise zwischen Orten ist das die wichtigste Architekturgrenze. Zugleich ist `BONI_3D` ein Sammelobjekt (Projektion, Anzeige, Zoom-Sperre, Schatten, Torkamera) ohne festgelegte Schnittstelle.

### 5.3 Doppelte Funktionalität

| Was | Wo doppelt | Bewertung |
|---|---|---|
| Drei Darstellungen des Boni: alte Pixel-Variante der Halle (`venue: 'boni'` in `src/world/rink.js`, mit Nilpferd und Holzbande), flacher Testplatz (`src/test/flat.js`), echter 3D-Platz | 3 Stellen | Die Hallen-Variante ist ein Überbleibsel aus der Zeit vor dem echten Platz und hat andere Maße. |
| Sonnenstrahl durch die Kronenkarte | GLSL `treeLight()` (`environment.js`) und JavaScript `lit()` (`photoreal.js`) | Logik zweimal, mit leicht verschiedenen Regeln (Kronenansatz, Dächer). |
| Rausch- und Hash-Funktionen in Shadern | `NOISE`, `SEASON` (`photoreal.js`), Boden-Shader | klein, aber verstreut |
| Speicher | `src/engine/storage.js` (Präfix `inline-hockey:`), `boniWeather` und `boniCesiumToken` direkt per `localStorage` | drei Schemata |
| Stimme abspielen | `Audio.say()` (`audio.js`), `voice.line()` (`photoreal.js`), Android-TTS | gewachsen, funktioniert |
| Debug-Zugriff | `window.__app` nur mit `?debug`, aber `window.app` immer (`src/main.js`, letzte Zeile) | widersprüchlich |

### 5.4 Physik: Lücken im Untergrundsystem

- **Torhüter** (`goalie.js`) importieren `SURF` nicht. Sie bewegen sich bei Schnee genauso wie bei Sonne.
- **Die KI plant wie auf trockenem Platz.** Passvorhalt, Laufwege und Schussentscheidungen berücksichtigen weder Ballreibung noch Wind. Auf nassem Platz fallen KI-Pässe zu kurz aus, und die KI fährt nicht vorsichtiger.
- **Schuss- und Passgeschwindigkeit** werden vom Wetter nicht beeinflusst (nur das Ausrollen danach).
- **Der Zustand hat kein Gedächtnis.** Nässe springt mit dem Wettersymbol, Frost hängt nur an der Temperatur. Abtrocknen, Reif im Schatten und Pfützen fehlen.
- **Der Zustand ist überall gleich.** Laub liegt im Shader sichtbar vor allem am Zaun, die Physik wirkt aber auf dem ganzen Platz gleich.
- **Kein Zufalls-Seed.** `Math.random` wird im Spielkern 38-mal benutzt. Spielabläufe sind nicht reproduzierbar, was automatische Physiktests erschwert.

### 5.5 Unnötige Komplexität und Altlasten

- `src/intro/photoreal.js` vereint sieben Aufgaben: Cesium-Start, Kameraflug und Zeitleiste, Kartennadeln, Erzählung, Platzrahmen und Modelle, fünf Shader (Durchsicht, Jahreszeit, Boden-Jahreszeit, Platz, Pfosten), Wetter- und Untergrund-Anbindung, Spielbrücke mit Torkamera. Jede Erweiterung des Intros oder der Welt landet heute dort.
- `src/intro/environment.js` mischt reines Modell (Sonne, Jahreszeit, Wetterabruf, Optik-Werte) mit Cesium-Darstellung, Regen-Overlay und DOM-Menü.
- Veraltete Dokumente: `README.md` (englisch, beschreibt nur die Halle, Titel „Inline Hockey“), `HANDOVER.md` (Stand „Version 24“), `SPEC.md`, `docs/VISUELLE_NEUAUSRICHTUNG.md` (Comic-Stil, später verworfen; nennt entfernte Module).
- Reste: `<canvas id="gl">` in `intro.html` (vom entfernten Luftbild-Intro, wird nur versteckt), `tools/intro/__pycache__/…pyc` ist eingecheckt, `court_glb.py` erzeugt noch `flecken.png`, das nicht mehr gebraucht wird.
- Der Einstellungswert `venue` (`arena`/`boni`) bedeutet nur noch „Hallen-Optik“ und kollidiert begrifflich mit dem echten Ort.

### 5.6 Fehler und Risiken in der Auslieferung

- **Android-Ersatzkopie unvollständig (am Skript geprüft, nicht auf dem Gerät).** `tools/android/build.sh` kopiert nur `assets/intro` und `assets/app`. Es fehlen `assets/pixel` (Logo, Bonny, Torjubel), `assets/fonts` (Pixelify Sans), `assets/voice` (Kommentar) sowie `test.html` und `src/test`. Ohne Netz zeigt die App deshalb vermutlich Ersatzschrift, keine Pixel-Grafiken und keinen Kommentar. Solange die Live-Version lädt, fällt das nicht auf.
- **4 MB Hymne im Precache.** `audio/hymne.mp3` steht in `sw-files.js`. Die PWA lädt sie bei der Installation, auch auf dem Handy über Mobilfunk.
- **Die Werkzeuge sind nicht aus dem Repo heraus reproduzierbar.** `shadow_casters.py` braucht `hoehe.png`, `gebaeude.png` und ein Luftbild, `court_glb.py` braucht das Asphaltfoto `clean_asphalt_diff_2k.jpg` (Poly Haven, CC0). Weder die Dateien noch ein Abrufskript für den LGLN-WMS liegen im Repo. Die Abrufschritte wurden bisher von Hand ausgeführt.
- **Cesium-ion-Kontingent.** Das kostenlose Community-Konto erlaubt 1 000 Sitzungen im Monat, nur nicht-kommerziell. Für einen Verein reicht das vermutlich, bei wachsender Verbreitung nicht.
- **Öffentliches Repository.** Alles, was hier steht, ist weltweit lesbar (siehe [GAME_DESIGN.md](GAME_DESIGN.md), Abschnitt Datenschutz).

### 5.7 Performance (Einschätzung, nicht gemessen)

Echte Messungen auf Tablet oder Handy gibt es nicht. Die Tests liefen in Headless-Chromium mit Software-Rendering (SwiftShader), wo ein Bild 7 bis 11 Sekunden braucht. Das sagt über echte Geräte nichts aus. Absehbare Lastspitzen:

| Stelle | Warum teuer | Gegenmittel im Code |
|---|---|---|
| Boden-Shader `treeLight()` | bis zu 48 Texturzugriffe pro Pixel, plus Rauschen | Cesium zeichnet nach der Landung nur bei Änderungen (`requestRenderMode`) |
| `SEASON`-Shader auf **allen** Google-Kacheln | läuft etwa von Mitte September bis Ende Juni auf jedem Kachelpixel, auch weit entfernt (früher Ausstieg nur bei Nicht-Vegetation) | `u_near` schaltet ihn nur im Hochsommer ab |
| Cesium-Schattenkarte | 4 Kaskaden, 4096² (Desktop) oder 2048² (Mobil), nur für Pfosten und Rahmen | nur bei Sonne aktiv |
| Spiel-Canvas | wird jedes Bild in voller Geräteauflösung neu gezeichnet (Welt in doppelter Auflösung, Text, UI), auch wenn Cesium ruht | keines |
| Torkamera | Cesium zeichnet während des Flugs durchgehend, mit allen Shadern | kurz (ca. 2 s) |
| Sprite-Erzeugung | Figuren werden zur Laufzeit gezeichnet und zwischengespeichert (`figures.js`, `warm()`/`warmStep()`) | schrittweises Aufwärmen |
| Erster Start | CesiumJS (mehrere MB, nicht gemessen) vom CDN, dann Google-Kacheln | Service Worker speichert Cesium |

Mobil sind bereits reduziert: Auflösung 0,8, Kachel-Fehlertoleranz 14 statt 8, kein MSAA (`FLIGHT` in `photoreal.js`).

### 5.8 Tests

| Test | Was er prüft | Stand |
|---|---|---|
| `tools/test/playthrough.cjs` | Halle (`index.html?debug`) auf drei Bildschirmgrößen: Menüs, Spiel, erzwungenes Tor, Schlusspfiff, Seitenfehler | läuft, am 27.11. **0 Fehler** |
| `tools/intro/record.cjs` | Intro als Video oder Standbilder (nur mit Cesium-Zugang) | Werkzeug, kein Test |
| Unit-Tests, CI | – | **nicht vorhanden** |

Weder der Testplatz (`test.html`) noch der 3D-Pfad haben einen eingecheckten automatischen Test. Die Prüfskripte der letzten Wochen (Standbilder je Wetter, Physiktest auf dem Testplatz) lagen nur in der Arbeitsumgebung.

---

## 6. Daten und Assets: lokal oder zur Laufzeit?

| Daten | Heute | Empfehlung |
|---|---|---|
| Spielcode, Pixelart, Schrift, Stimmen | lokal, im Precache | so lassen (klein, offline nötig) |
| `audio/hymne.mp3` (4 MB) | lokal, im Precache | zur Laufzeit laden und erst nach dem ersten Abspielen speichern, oder auf 1 MB kürzen und neu kodieren |
| Platzmodell, Boden, Kronenkarte, Luftbild-Boden (1,2 MB) | lokal, nicht im Precache, bei Bedarf geladen | richtig so: abgeleitete amtliche Daten, pro Ort klein |
| Google 3D Tiles | nur zur Laufzeit | muss so bleiben (Nutzungsbedingungen) |
| CesiumJS | vom CDN, im Service Worker gespeichert; in der App mitgeliefert | so lassen |
| Wetter | zur Laufzeit (Open-Meteo, ohne Schlüssel) | so lassen; letzte Werte für offline merken |
| LGLN-Rohdaten (Höhenmodell, Gebäude, Luftbild) | **nirgends im Repo** | nicht ins Spiel, aber als Abrufskript ins Repo (siehe TECHNICAL_DEBT T3) |
| `docs/ort/*.jpg` (600 KB) | im Repo | so lassen (Dokumentation) |

---

## 7. Annahmen und Unsicherheiten

- Leistung auf echten Geräten ist unbekannt (siehe 5.7).
- Die unvollständige Android-Ersatzkopie ist aus dem Build-Skript abgeleitet, nicht auf dem Gerät beobachtet.
- Die Stärke der Wettereffekte ist geschätzt und nicht mit den Gamepads erprobt.
- Laternenstandorte sind nicht vermessen.
- Größe von CesiumJS und Ladezeit des ersten Starts sind nicht gemessen.
