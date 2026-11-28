# BORSTENBOOM! – Architektur (Ist-Zustand)

> **Stand 2026-11-28:** `intro.html`, `src/intro/main.js` und `src/intro/photoreal.js` sind entfernt. Einstieg ist `welt.html` (`src/welt/*`): Anflug, Viertel und Spiel in einer Szene; sie setzt `BONI_3D` selbst (`toCss`, `shadow`, `pausiert`). `src/intro/environment.js` (Sonne, Wetter, Jahreszeit) bleibt und wird von der Welt benutzt. Abschnitte unten, die `photoreal.js` beschreiben, gelten nur noch als Geschichte; das gemeinsame Bild steht in `docs/BONI_ORT.md`.

Stand: 27. November 2026, Commit `3938495`. Beschreibt, wie der Code heute tatsächlich zusammenhängt. Bewertungen und Befunde stehen in [PROJECT_AUDIT.md](PROJECT_AUDIT.md), Verbesserungen in [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md).

---

## 1. Drei Einstiegspunkte, ein Spiel

```
index.html ─────────────► src/main.js                         Halle (2D-Pixelarena, Schrägprojektion)

test.html  ─► src/test/flat.js ─(setzt BONI_3D)─► src/main.js  Boni-Regeln auf flachem 2D-Platz

intro.html ─► src/intro/main.js ─► src/intro/photoreal.js ─(setzt BONI_3D)─► src/main.js
                 (Token, Rückfall)    (Cesium, Flug, Wetter,                   Boni auf dem echten 3D-Platz
                                       Schatten, Spielbrücke)
```

Alle drei laden **dasselbe** Spiel (`src/main.js` und alles darunter). Was sie unterscheidet, steht im globalen Objekt `globalThis.BONI_3D`, das vor dem Import von `src/main.js` gesetzt wird:

| Feld von `BONI_3D` | gesetzt von | gelesen von | Bedeutung |
|---|---|---|---|
| (Vorhandensein) | `photoreal.js`, `flat.js` | `config.js`, `projection.js`, `audio.js` | Boni-Maße und -Regeln statt Halle, feste Kamera, Außengeräusche |
| `toCss(x, y, z)` | `photoreal.js` (Cesium-Kamera), `flat.js` (2:1-Projektion) | `projection.js` | Meter → CSS-Pixel des Fensters |
| `display` | `src/main.js` | `projection.js` | Umrechnung CSS-Pixel → Pixel der Spielebene |
| `zoom`, `zoomLock` | `projection.js`, `photoreal.js` | `projection.js` | Figurengröße halten, während die Torkamera fliegt |
| `shadow` | `photoreal.js` | `skater.js` | Sonnenschatten der Figuren (Richtung, Stärke, `lit(x, y)`, `leaf`) |
| `onGoal()` | `photoreal.js` | `scenes/rink.js` | Torkamera um den Platz |

Ohne `BONI_3D` (Halle) bleiben alle Werte bei den Arena-Vorgaben.

---

## 2. Schichten und Module

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Einstieg     index.html · test.html (src/test/flat.js) · intro.html (src/intro/*)│
├─────────────────────────────────────────────────────────────────────────────┤
│ 3D-Welt      src/intro/photoreal.js   Cesium, Flug, Platzmodelle, Shader, Spielbrücke│
│ (nur intro)  src/intro/environment.js Sonne, Jahreszeit, Wetter, Boden-Shader, Menü │
├─────────────────────────────────────────────────────────────────────────────┤
│ Szenen       src/scenes/*  Titel, Menüs, Spielaufbau, Spiel (rink.js), Pause, Belegung│
│ UI           src/ui/*      Menü, HUD/Toasts, Ecken-Knöpfe, Pad-Diagramm             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Spiel        src/game/*    match (Spielablauf), ai, goalie, referee, rules, puck,   │
│                            physics, replay, tournament, surface                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Welt         src/world/*   skater (Bewegung, Pose), figures/sprites (Pixelfiguren), │
│                            rink (Halle backen, Maße), projection, camera, view,     │
│                            particles                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ Eingabe      src/input/*   manager, keyboard, pointers, touch, menuPad, pads, labels│
│ Motor        src/engine/*  display, font, raster, draw, palette, audio, storage,    │
│                            fullscreen                                              │
│ Grundlage    src/config.js · src/settings.js                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Abhängigkeiten (aus den `import`-Zeilen ermittelt)

- `src/game/*` hängt nur von `config.js`, `world/rink.js` (Maße, `RINK_CORE`, `goalBox`), `world/skater.js`, `world/sprites.js`, `world/projection.js` (nur Ball und Torhüter zum Zeichnen) und `engine/storage.js` (Turnier) ab. Kein DOM, kein Cesium.
- `surface.js`, `physics.js`, `rules.js`, `replay.js` haben **keine** Importe.
- `src/world/skater.js` importiert `game/surface.js` (Untergrund).
- `src/game/match.js` importiert `surface.js` (Ball).
- `src/intro/photoreal.js` importiert `environment.js` und `game/surface.js`. Das Spiel selbst lädt es per dynamischem `import('../main.js')`.
- `src/intro/environment.js` hat keine Importe (bekommt `Cesium` und `viewer` übergeben).
- Kein Modul importiert `src/intro/*` außer dem Intro selbst. Die Spiel-Schicht kennt die 3D-Welt nur über `globalThis.BONI_3D`.

### 2.2 Größte Module

| Modul | Zeilen | Aufgabe |
|---|---|---|
| `src/game/match.js` | 782 | Spielzustand, Bully, Kontakte, Pässe, Schüsse, Reihenwechsel, Ballschritt, Tore |
| `src/world/figures.js` | 718 | Skelett, 37 Posen, Pixelkonvertierung der Figuren |
| `src/intro/photoreal.js` | 646 | alles am 3D-Ort (siehe 5.) |
| `src/scenes/rink.js` | 588 | Spielszene: Kameras, Ereignisse, Jubel, Wiederholung, Zeichnen |
| `src/world/skater.js` | 493 | Bewegung, Grip, Posenwahl, Schläger, Schatten |
| `src/world/rink.js` | 487 | Hallen-Grafik backen (auch alte Boni-Variante), Spielfeldgrenzen |
| `src/input/manager.js` | 476 | Eingabegeräte, Belegung, Zuordnung zu Spielern |

---

## 3. Spielschleife und Datenfluss

```
requestAnimationFrame
 └─ step(now)                                      src/main.js
     ├─ bis zu 10 × fester Schritt (1/60 s)
     │   ├─ input.poll()                           Tastatur, Touch, Gamepads → Aktionen
     │   └─ app.top.update(dt)                     oberste Szene, im Spiel: RinkScene
     │        └─ match.update(dt, input)           src/game/match.js
     │             ├─ Menschen: skater.update(move, sprint) + actions() (Pass, Schuss, Check)
     │             ├─ ai.think(dt) → KI-Spieler: skater.update(...)
     │             ├─ Ausrutscher auswerten (SURF.slip) → Ball springt weg, Ereignis „slip“
     │             ├─ Kontakte, Pokes, Ball aufnehmen
     │             ├─ stepPuck(dt): Unterschritte mit Schwerkraft, Wind, Bande, Netz, Tor
     │             ├─ Torhüter, Schiedsrichter (Uhr, Strafen)
     │             └─ events[] → RinkScene: Ton, Stimme, Partikel, Torkamera (BONI_3D.onGoal)
     └─ Zeichnen
         ├─ display.beginFrame()
         ├─ Szenen von unten nach oben: draw()
         │    └─ RinkScene: world.draw → Figuren nach Tiefe sortiert, jede über project()
         ├─ Touch-Knöpfe, Vollbild-Knopf, Toasts
         └─ display.present()                       Welt- und UI-Ebene → #screen
```

Die Simulation läuft im festen Takt unabhängig von der Bildrate. Gezeichnet wird jedes Bild.

---

## 4. Koordinatensysteme

| # | System | Einheit und Achsen | Wo |
|---|---|---|---|
| 1 | WGS84 | Grad (Länge, Breite) | `COURT` in `photoreal.js` |
| 2 | ECEF | Meter, Erdmittelpunkt | Cesium intern |
| 3 | ENU am Platz | Meter: Ost, Nord, Hoch; Ursprung Platzmitte auf gemessener Bodenhöhe | `buildFrame()` → `frame.enu`, `frame.inv` |
| 4 | Platz lokal | Meter: `a` längs (Ecke A → D), `b` quer (A → B), `z` hoch | `frame.u`, `frame.v`, `frame.at(a, b, z)` |
| 5 | glTF-Modell | Y oben: `X = a`, `Y = z`, `Z = −b` | `tools/intro/court_glb.py` (`Geo.quad`), Laden mit `forwardAxis: X` |
| 6 | **Spiel** | Meter: `x = a` (links → rechts), `y = −b` (zur Kamera hin), `z` hoch | gesamter Spielkern |
| 7 | Spielebene | logische Pixel; Welt in `RES = 2`-facher Auflösung | `project()`, `display` |
| 8 | Bildschirm | CSS-Pixel bzw. Gerätepixel (`dpr`) | `toCss`, `display.dpr` |
| 9 | LGLN-Referenzraster | 0,2 m pro Pixel, Ursprung `CENTER = (898.4, 668.4)` | `tools/intro/shadow_casters.py` |
| 10 | Kronenkarte | 0,5 m Raster, `a` ab −46 m, `b` ab −41,4 m | `boni_schatten_hoehen.png`, `TREE_LIGHT`, `crownAt()` |

Wichtige Umrechnungen:

- **Spiel → Bildschirm (3D):** `gameMatrix` = Projektion · Kamera · ENU · lokale Platzmatrix (mit `y = −b`), jedes Bild nach dem Rendern neu (`scene.postRender` in `photoreal.js`). `toCss()` multipliziert damit.
- **Augenraum → Platz (Shader):** `u_ecToCourt` = Platz-aus-ENU · ENU-aus-ECEF · Kamera⁻¹, jedes Bild in `scene.preRender`. Boden- und Zaun-Shader rechnen damit in Platzmetern.
- **Sonne → Platz:** Azimut und Höhe (`sunPosition()`) werden in Ost/Nord/Hoch zerlegt und auf `frame.u`/`frame.v` projiziert (`u_sunDir`, `setSunShadow()`).
- **Wind → Spiel:** Windrichtung (woher) + 180° → Ost/Nord → `a`, `b` → Spiel (`x = a`, `y = −b`) in `onAir()`.

---

## 5. Die 3D-Welt im Detail (`src/intro/photoreal.js`)

Ablauf in `run({ token, cesiumBase })`:

1. **Cesium starten:** CesiumJS 1.147 vom CDN laden (in der App aus `vendor/cesium/`), `Viewer` ohne Bedienelemente, Google-3D-Kacheln über den ion-Endpunkt (Asset 2275207).
2. **Platzrahmen:** `buildFrame()` aus den vier Eckpunkten und der Bodenhöhe (wird nach dem Laden am Mesh nachgemessen). `courtMatrix()` setzt alle Modelle des Platzes.
3. **Modelle:** `boni_platz.glb` (Zaun, Tore), `boni_boden.glb` (Asphalt und Mulch, unbeleuchtet), `boni_schatten_luftboden.glb` (Luftbild unter den Kronen, nur im Winter).
4. **Schatten:** `courtShader` (Baumschatten auf Zaun und Toren, Netze werfen keine Schatten), Cesium-Schattenkarte für Pfosten, `setSunShadow()` für die Figuren.
5. **Umwelt:** `createEnvironment()` aus `environment.js` mit Rückruf `onChange` → `onEnv()` (Sonne, Laub, Jahreszeit) und `onAir()` (Untergrund).
6. **Durchsicht und Jahreszeit:** `seeThrough`-Shader auf dem Google-Kachelsatz (Dither-Löcher über dem Platz, `seasonal()` für Herbst und Winter), `groundSeason` auf dem Luftbild-Boden.
7. **Karte:** Umriss Deutschlands (`assets/intro/deutschland.json`), Nadeln Deutschland, Hannover, Boni.
8. **Erzählung:** `STORY`-Zeilen, `voice.line()` spielt `assets/voice/intro-*.mp3` oder die Gerätestimme.
9. **Zeitleiste:** `place(t)` setzt Kamera, Einblendungen und Shader-Uniforms je Zeitpunkt (`ZOOM`-Stützpunkte mit monotonem Spline, Phasen `T`). `introDebug.freeze(t)` friert für Aufnahmen ein.
10. **Spielbrücke:** `startGame()` setzt `globalThis.BONI_3D`, öffnet das Wetter-Menü und lädt `../main.js`. Danach zeichnet Cesium nur noch bei Bedarf (`requestRenderMode`).

### 5.1 Darstellungsstapel in `intro.html`

| Ebene (unten → oben) | Element | Inhalt |
|---|---|---|
| 1 | `#cesium` | Cesium-Canvas: Google-Kacheln, Platzmodelle, Shader, Post-Processing (`grade`) |
| 2 | `#screen` | Spiel-Canvas, transparent: Figuren, Ball, HUD; per CSS-Filter an Licht und Wetter angepasst |
| 3 | `#weatherFx` | Regen und Schnee (2D-Canvas) |
| 4 | `#ui` | HTML: Titel, Untertitel, Knöpfe, Wetter-Menü, Platzzustand, Hinweise, Quellenangabe |
| 5 | `#cover` | Ladeabdeckung |

`#gl` ist ein ungenutzter Rest des früheren Luftbild-Intros.

---

## 6. Umwelt (`src/intro/environment.js`)

```
Wetterquelle ──► refresh() ──► apply(look, date, amount, air) ──► Darstellung + onChange
  live:  Open-Meteo forecast (current: Temperatur, Code, Niederschlag, Wind)
  hist:  Open-Meteo archive/forecast (stündlich, ab 1940)
  pick:  Hand: Wetter, Uhrzeit, Jahreszeit, Temperatur, Wind (geschätzt, falls nicht gesetzt)

apply():
  visuals(look, date)  → Sonne, Tag/Nacht, goldenes Licht, Sonnenanteil, Belichtung, Tönung,
                          Sättigung, Nebel, nass/Schnee, Niederschlag, season(date), leaf
  → Post-Processing-Uniforms, Boden-Uniforms (Sonne, Schattentiefe, Laub, Nässe, Schnee, Nacht)
  → viewer.shadows, Schattenkarte
  → CSS-Filter auf #screen (Pixel-Figuren bekommen dasselbe Licht)
  → onChange({ visuals, air: { temp, wind, windDir, amount, leaves } })

photoreal.js:
  onEnv(visuals) → u_sunDir, u_leaf (Boden, Zaun), Figurenschatten, Jahreszeit-Shader
  onAir(air)     → surfaceFor(...) → setSurface(SURF) → Spielphysik; Anzeige „Platz: …“
```

Gespeichert wird der Zustand des Menüs in `localStorage['boniWeather']`. Im Live-Modus wird alle 10 Minuten neu abgefragt.

---

## 7. Untergrund und Physik (`src/game/surface.js`)

`surfaceFor({ look, temp, wind, windTo, leaves, amount })` liefert Faktoren auf die Grundwerte (1 = trockener Asphalt bei etwa 15 °C):

| Faktor | wirkt in | auf |
|---|---|---|
| `grip`, `accel`, `speed`, `glide`, `brake`, `tire` | `skater.js` `update()` | Seitenhaftung, Beschleunigung, Höchsttempo, Roll- und Bremswiderstand, Ermüdung |
| `slip` | `skater.js` → `match.js` | Sturz bei harter Wende mit Tempo, Ball springt weg, Ereignis `slip` |
| `ballDrag`, `ballFriction`, `ballBounce`, `boardBounce` | `match.js` `stepPuck()` | Ausrollen, Aufspringen, Bande |
| `wind` | `match.js` `stepPuck()` | Beschleunigung des Balls, in der Luft voll, am Boden 30 % |
| `label` | `photoreal.js` | Anzeige des Platzzustands |

Die Grundwerte stehen in `src/config.js` (`SKATE`, `SHOT`) und `src/game/puck.js` (`PUCK`, `BALL`). `SURF` ist ein veränderliches Modul-Objekt. Halle und Testplatz lassen es neutral.

---

## 8. Eingabe

`InputManager` (`src/input/manager.js`) sammelt Tastatur (`keyboard.js`, zwei Profile), Zeiger und Touch (`pointers.js`, `touch.js`, `menuPad.js`) und Gamepads (`pads.js` mit Layout-Erkennung). Belegungen werden in `inline-hockey:bindings` gespeichert. In der Android-App übersetzt `MainActivity.java` Tasten- und Achsenereignisse in das W3C-Standardlayout. `src/native/pads.js` ersetzt dort `navigator.getGamepads`. Jede Spielerfigur ist einem Controller zugeordnet. Die Spielszene fragt `input.controller(id)` nach `move`, `down`, `pressed`.

---

## 9. Darstellung und Animation

- **`Display`** (`src/engine/display.js`): Spielebene in `RES = 2`-facher logischer Auflösung (Zoom über die Ebenengröße), UI-Ebene mit 216 logischen Zeilen, zusätzlich eine hochaufgelöste Textebene (Pixelify Sans über `setHiresText`). `present()` setzt alles auf `#screen` zusammen; im 3D-Modus transparent.
- **Figuren** (`figures.js`, `sprites.js`): Ein Skelett (Hüfte, Knie mit IK, Knöchel, Schulter, Ellbogen, Hand) wird je Pose mit Vektorformen gezeichnet und über eine Alpha-Schwelle mit Kontur in Pixelart umgewandelt. Ergebnisse liegen in einem Cache (`warm()`, `warmStep()`).
- **Posenwahl** (`skater.js` `pose()`): Sturz, Jubel, Bully, Ausholen, Schuss, Poke, Bremsen, Übersetzen, Schritt, Gleiten.
- **Projektion** (`projection.js`): `project(x, y, z)` und `fixedZoom()`. In der Halle `{16x, 8y − 14z}`, sonst über `BONI_3D.toCss`.
- **Kamera** (`camera.js`): folgt in der Halle dem Geschehen. Auf dem Boni steht sie fest (`FIXED`), der Zoom folgt der 3D-Kamera.
- **Ansicht** (`view.js`): In der Halle Hintergrund, Publikum, nach Tiefe sortierte Objekte, Vordergrund. Auf dem Boni nur die Objekte.

---

## 10. Ton und Stimme

- `Audio` (`src/engine/audio.js`): alle Effekte synthetisch (Web Audio), Publikumsrauschen, Außengeräusche nur bei `BONI_3D`, Torsong über `<audio>` (`audio/hymne.mp3`).
- Kommentar: `say(group)` wählt zufällig eine Datei aus `assets/voice/index.json`, ohne sich selbst ins Wort zu fallen.
- Erzählung im Intro: `voice.line(i)` in `photoreal.js`, mit Rückfall auf die Browser- oder Android-Stimme.
- Erzeugung: `tools/voice/lines.json` → `tools/voice/make_voice.py` (Piper, Stimme „Thorsten“) → MP3 und `index.json`.

---

## 11. Speicher und Offline

| Schlüssel | Inhalt | Modul |
|---|---|---|
| `inline-hockey:settings` | Einstellungen | `settings.js` über `engine/storage.js` |
| `inline-hockey:bindings` | Tastenbelegung | `input/manager.js` |
| `inline-hockey:tournament` | laufendes Turnier | `game/tournament.js` |
| `boniWeather` | Wetter-Menü | `intro/environment.js` (direkt) |
| `boniCesiumToken` | Cesium-Token (in der App: SharedPreferences) | `intro/main.js` |

Service Worker `sw.js` (Cache `boni-v3`):

- **Eigene Dateien:** zuerst aus dem Netz, damit Updates sofort ankommen. Vorab gespeichert wird die Liste in `sw-files.js` (110 Dateien, erzeugt von `tools/app/precache.cjs`).
- **CesiumJS vom CDN:** zuerst aus dem Speicher.
- **Google und Cesium ion:** nie gespeichert.

Android-App: lädt die Live-Version von GitHub Pages, bei Fehlern die mitgelieferte Kopie unter `https://appassets.androidplatform.net/www/`.

---

## 12. Werkzeuge (`tools/`)

| Werkzeug | Eingabe | Ausgabe |
|---|---|---|
| `ort/abrufen.py` | `tools/ort/boni.json` (Ecken, Ausschnitt) | LGLN-Rohdaten und Asphaltfoto in `daten/<ort>/`, `hoehe.png`, `gebaeude.png` |
| `intro/court_glb.py` | Asphaltfoto (Poly Haven, CC0), Maße im Skript | `boni_platz.glb`, `boni_boden.glb` (+ ungenutztes `flecken.png`) |
| `intro/shadow_casters.py` | LGLN-Höhenraster, Gebäudemaske, Luftbild (aus `ort/abrufen.py`) | `boni_schatten_hoehen.png`, `boni_schatten_luftboden.glb` (optional Schattenwerfer-Mesh) |
| `voice/make_voice.py` | `lines.json`, Piper, Thorsten-Modell | `assets/voice/*` |
| `app/precache.cjs` | Dateibaum | `sw-files.js` |
| `android/build.sh` | Webdateien, CesiumJS aus npm | APK |
| `test/playthrough.cjs` | – | Screenshots und Fehlerzählung (Halle) |
| `intro/record.cjs` | Cesium-Zugang | Intro-Video oder Standbilder |
