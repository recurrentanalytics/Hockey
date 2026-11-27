# Inline Hockey – Projektübergabe (technische Zusammenfassung)

Stand: Version 24. Branch `claude/inline-hockey-game-v0a0yo` im Repo `recurrentanalytics/hockey`.

## 1. Ziel

Ein Browser-Inlinehockey-Spiel im 2.5D-Pixel-Art-Stil mit niedlichen Chibi-Kindern als Spielern. Der eigene Verein, die **Boni Borstentiere** aus Hannover-List, ist fest eingebaut. Gespielt wird auf Desktop (Tastatur), Mobil (Touch) und mit Gamepad (vor allem 8BitDo SN30 Pro). Es gibt 1 Spieler gegen KI sowie 2 Spieler lokal, gegeneinander oder zusammen. Die Regeln folgen den echten Regelbüchern. Die Oberfläche ist komplett deutsch.

## 2. Getroffene Entscheidungen (chronologisch, wichtig für die Weiterarbeit)

| Thema | Entscheidung |
|---|---|
| Kamera / Perspektive | Seitlich-schräg (Broadcast-Kamera), 2.5D, Schrägprojektion |
| Spielmodi | 1P gegen KI, 2P gegeneinander, 2P zusammen gegen KI, Training, Turnier |
| 2P-Kamera | Wählbar: gemeinsam (mit Zoom) oder geteilter Bildschirm |
| Eingabe | Tastatur (2 Profile), Touch (virtueller Stick + Knöpfe, auch für Menüs), jedes Gamepad, frei belegbar; Sonderbehandlung 8BitDo SN30 Pro |
| Regeln | Realistisch, wählbar: **World Skate, USARS, ISHD**. Werte aus den offiziellen Regelbüchern (siehe `RULES.md` mit Regelnummern) |
| Grafikstil | Zuerst Pixel-Art. Dann „besser und süßer“: Chibi. Dann „viel mehr Detail“: doppelte Auflösung und realistische Proportionen. Dann **endgültig: eindeutig Kinder im süßen Chibi-Look, aber mit hohem Detailgrad** |
| Animationen | „Saumäßig realistisch“: Skelett-basierte Posen, 8-Phasen-Schrittzyklus usw. |
| Spielgerät | Standard ist ein **roter Inline-Hockeyball** (Low Bounce); ein roter Roller-Puck mit Gleitnoppen ist wählbar |
| Verein | Boni Borstentiere (Website: recurrentanalytics.github.io/boni-borstentiere-website): Teams Borstentiere (Kinder) und Balding Borstis (Erwachsene; Witz: Brillen); Maskottchen Bonny (Wildschwein, Rückennummer 61); Vereinshymne als Torsong; Spielort Bonifatiusplatz |
| Sprache | Alles Deutsch (Umlaute in beiden Pixel-Schriften ergänzt) |
| Technik | Vanilla JavaScript (ES-Module), **kein Build-Schritt**, keine Abhängigkeiten, HTML5-Canvas; Sounds synthetisch per Web Audio |
| Auslieferung | (a) Claude-Artifact (privat, Version 24) und (b) lokal: `git pull && python3 serve.py`, dann http://localhost:8000 (Chrome; in Vivaldi wurde das Gamepad nicht erkannt) |
| Arbeitsweise | Der Nutzer will, dass anfangs Fragen gestellt werden; danach Umsetzung in Phasen mit Check-ins. Jede Änderung wird mit Playwright (headless) getestet und mit Screenshots geprüft |

## 3. Architektur

```
index.html, css/style.css, serve.py (No-Cache-Server), audio/hymne.mp3
SPEC.md, RULES.md, README.md, HANDOVER.md
src/
  main.js            Spielschleife (fester 60-Hz-Takt), Szenen-Stapel, Vollbild, Fehleranzeige
  config.js          VIEW, PROJ {x:16,y:8,z:14 px/m}, RES=2, RINK (60×30 m), GOAL, SKATE, SHOT, TEAMS
  settings.js        persistente Einstellungen + Optionslisten (deutsche Labels)
  engine/  display.js (2 Ebenen: Welt in RES-facher Auflösung, UI 216 px hoch), font.js (3×5 + 5×7 Pixelschrift mit ÄÖÜ),
           draw.js, raster.js (Surface), audio.js (synthetische SFX, Torsong, Publikum), storage.js, fullscreen.js
  input/   actions.js, keyboard.js, pointers.js, touch.js, menuPad.js, pads.js (Pad-Erkennung/Layouts), labels.js, manager.js
  game/    match.js (Spiellogik), puck.js (Ball/Puck-Physik mit Höhe z), goalie.js, ai.js (Team-KI),
           referee.js (Uhr, Drittel, Strafen, Überzahl, Penalty, Verlängerung, Penaltyschießen, Auszeiten),
           rules.js (3 Regelwerke als Daten), tournament.js, replay.js (Aufzeichnung + Zeitlupe), physics.js
  world/   figures.js (Skelett-Renderer für Spieler und Torhüter), sprites.js (API-Fassade), skater.js (Bewegung + Posenwahl + Zeichnen),
           rink.js (Halle/Boni backen), view.js (Welt zeichnen, Netzwackeln, La-Ola), particles.js, camera.js, projection.js
  scenes/  title, mainMenu, matchSetup, twoPlayer, tournamentScene, settingsScene, controls, bindings, padSetup, pause, rink, backdrop, menuScene
  ui/      menu.js, hud.js, videoWall.js (Kuss-/Bonny-/Tanz-Cam, Torkarte), corner.js, padDiagram.js
```

### Rendering
- **Schrägprojektion:** `project(x,y,z) = {x*16, y*8 - z*14}` in logischen Pixeln.
- **Weltebene:** wird mit `RES=2` gerendert. Halle, Linien, Glas, Tore und Publikum werden in voller Auflösung vorab gebacken. Spieler, Torhüter, Schläger und Ball zeichnen sich selbst in voller Auflösung (Transform 1/RES).
- **Kamera:** näher am Geschehen (`CLOSE_ZOOM = 1.35`), geteilter Bildschirm mit 0.9. UI-Ebene in fester niedriger Auflösung.
- **Figuren (`figures.js`):**
  - Jede Pose ist ein Skelett: Hüfte, Knie per 2-Knochen-IK, Knöchel, Schultern, Ellbogen, Hände, Neigung, Kopfneigung.
  - Gezeichnet wird mit Vektorformen auf eine Canvas, danach Alpha-Schwelle (knackige Pixel) und automatischer dunkler Umriss.
  - Drei Tonstufen pro Material mit Licht von oben links; die fernen Gliedmaßen sind abgedunkelt.
  - Chibi-Kind: Kopf mit r=8,6 px (ca. 40 % der Höhe), runder Bauch, kurze Glieder; die Posendaten werden mit K=0,74 skaliert.
  - Ausrüstung: Helm mit Glanz, Schirm, Ohrloch und Kinnriemen; große Augen mit Lichtpunkt; Bäckchen; Trikot mit Saumstreifen und Team-Tier; Rückennummer (wird nach dem Spiegeln gezeichnet); Hose; Stutzen über dem Knie; große Handschuhe; Skates mit 4 Rollen.
  - Stimmungen: normal, blinzeln, fröhlich, angestrengt, schwindelig, traurig.
  - Sonderköpfe: Bonny (Wildschwein mit Helm) und Borstis (Brille).
  - Frames werden lazy gebacken und gecacht. `warm()` bäckt die Kernposen beim Start, `warmStep()` den Rest Stück für Stück in den ersten Sekunden.
- **Posen:** glide, idleA/B, tiredA/B, stride0–7, sprint0–7, cross0–3, stop, windup, release, passOut, lunge, stumble, sprawl (liegend, um 90° gedreht), kneel, rise, cheerA/B, sad, draw (Bully), ready.
  - Die Auswahl in `Skater.pose()` folgt dem Zustand: downT-Phasen, celebrateT, stance, charging, releaseT, pokeT, sadT, brakeT, crossT, pushing, Gleiten oder Stehen.
  - Der Schläger wird dynamisch gezeichnet (`stickPoint()`): Ausholen hinter die Schulter, Durchschwung, Stockhandling mit seitlichem Dribbeln.
- **Torhüter:** stance, breathe, shuffleA/B, butterfly, glove, blocker, cover. Körper als Kind (Skalierung 0,74) mit großer Maske und Gitter.
- **Effekte:**
  - Partikel: Funken, Ball-Spur, Sterne, Staub, Konfetti
  - Netzwackeln bei Tor und Pfosten
  - La-Ola-Welle (Publikum in Spalten gezeichnet)
  - Torlicht, Kamerawackeln, Videowand
  - Ring unter dem gesteuerten Spieler
  - Ball scheint durch Spieler hindurch („Ghost“)
  - Pfeil am Rand, wenn der Ball außerhalb des Bildes ist
  - Tastenleiste blendet nach 25 s Spielzeit aus

### Simulation
- **Takt und Kader:** Fester 60-Hz-Schritt. Gespielt wird 4 gegen 4 plus Torhüter, mit 2 Reihen pro Team und Linienwechseln bei Unterbrechungen. Müdigkeit kostet bis zu 15 % Tempo.
- **Ball- und Puck-Physik:** Höhe z, Schwerkraft, Abprall an Bande, Pfosten, Netz und Körpern. Der Ball rollt weiter und springt etwas mehr als der Puck.
- **Aktionen:** Schuss mit Aufladen (Zielhilfe zu den Pfosten), Direktschuss, Pass mit Vorhalt (der Empfänger hat mehr Reichweite), Poke-Check, Sprint mit Ausdauer, Spielerwechsel.
- **Bully:** Reaktionsduell; wer zu früh drückt, verliert das Bully.
- **Kontakt:** Checks gibt es nur dort, wo sie erlaubt sind (ISHD). Gefoult wird nur bei harten menschlichen Checks. Stürze gibt es bei regelgerechten Checks, harten menschlichen Checks oder Crashs über 10 m/s.
- **KI:**
  - Situativ: Ball frei, Angriff (Raumaufteilung, Zug zum Slot, Schüsse weg vom Torhüter, Pässe nach Prüfung der Passbahn), Verteidigung (Pressing, Slot-Absicherung, Manndeckung).
  - Sie weicht aus, statt zu rammen, und bremst bei hoher Annäherungsgeschwindigkeit.
  - Nach Toren: Jubeltraube mit dem Torschützen, die Verlierer gucken traurig.
- **Schiedsrichter:**
  - Regelzeit und Unterbrechungen: Spielzeit pro Regelwerk, Drittel bzw. Halbzeiten, Seitenwechsel.
  - Strafen: kleine und große Strafen, verzögerte Strafe, Überzahl (ein Überzahltor beendet die kleine Strafe), Mindestanzahl Spieler.
  - Penalty bei Foul an einem Durchbruch.
  - Spielentscheidung: Verlängerung (World Skate 3 gegen 3 bzw. Sudden Death), Penaltyschießen mit Münzwurf und umgedrehter Reihenfolge.
  - Auszeiten für Mensch und KI.
- **Statistik:** Tore, Vorlagen (aus der Passkette), Torschüsse, Paraden, Überzahl, Strafzeit, Bullys, Checks. Am Ende kürt die Endtafel die „Drei Sterne“.
- **Turnier:** 4 Teams im Jeder-gegen-jeden, danach Finale der Top 2. Punkte 3/2/1; Spiele ohne den Spieler werden simuliert; Speicherung in localStorage.
- **Tor-Wiederholung:** Der Recorder speichert ca. 6 s Snapshots. Abgespielt werden etwa 3 s vor dem Tor bis 0,75 s danach in Zeitlupe (0,55×), im TV-Look und überspringbar. Danach wird der Live-Zustand wiederhergestellt.

### Eingabe
- **Pads:** Erkennung über id und Mapping (standard, dinput8bitdo, raw). Das Steuerkreuz kann auch als Hat-Achse kommen. Profile werden pro Pad gespeichert.
- **Einrichtung:** Geführte Pad-Einrichtung; Neubelegung per Tastendruck, auch für Hat-Achsen.
- **Nintendo-Layout:** Für Nintendo-beschriftete Pads gilt A = Pass, B = Schuss, Y = Check, X/L = Wechsel, R/ZL = Sprint. Die Einstellung „Tasten-Beschriftung“ wählt das Layout.
- **Rest:** Vibration; Touch-Steuerung für Spiel und Menüs; Tastatur 1 (WASD + JKIL) und Tastatur 2 (Pfeile + Nummernblock).

### Tests (Playwright, headless Chromium, Skripte im Scratchpad)
- **Gesamtablauf:** e2e, sn30, rawpad (Fake-Gamepads), mobile2 (Touch).
- **Spielmodi und Inhalte:** rules_ui, tourney, wall, boni, replay.
- **Simulation:** audit (Spielstatistiken über viele KI-Partien), perf (ca. 1,2 ms Zeichenzeit pro Bild).
- **Grafik:** Posen- und Figuren-Sheets.
- **Aktueller Zielkorridor:** ca. 7,5 Tore pro 10 Minuten, ca. 80 % angekommene Pässe, 2–8 Stürze pro Spiel.

## 4. Wo wir stehen

Alles oben Genannte ist fertig, getestet, gepusht und als Artifact Version 24 veröffentlicht. Die Oberfläche ist deutsch, die Spieler sind Chibi-Kinder mit hohem Detailgrad.

Bekannte Restpunkte:
- Das Maskottchen im Mittelkreis, die Werbe-Symbole, Bäume und das Nilpferd am Boni sind noch gröbere Deko-Ebenen in einfacher Auflösung.
- Der Spielstart dauert ca. 0,4–0,7 s, weil die Halle in hoher Auflösung gebacken wird.
- Die Hintergrund-Spieler im Titelbildschirm sind bei Zoom 1 recht klein.
- Pad in Vivaldi nicht erkannt (Browserproblem); Chrome funktioniert.

## 5. Wo wir hinwollen (Vorschläge, noch nicht beauftragt)

**Spielgefühl und Tiefe**
1. Schusstypen: Handgelenkschuss, Schlagschuss, Lupfer und Bauerntrick hinterm Tor; Täuschung beim Penalty.
2. Dekes und Tricks (Stickhandling-Taste, Spin-o-rama), Körpertäuschung, Rückwärtsfahren der Verteidiger.
3. Spielerwerte pro Kind (Tempo, Schuss, Technik, Ausdauer) mit sichtbaren Stärken; Torhüter mit eigenem Stil.
4. Taktik-Menü: Aggressivität, Forechecking, Linien-Einteilung, Powerplay- und Unterzahl-Formationen.
5. Dynamische Schwierigkeit / „Kinder-Modus“ für jüngere Spieler.

**Atmosphäre**
6. Stadionsprecher-Texte und Lauftext („BONNY ZIEHT AB!“), Fangesänge und Trommeln, Pfiffe, reagierendes Publikum (Buhrufe bei Strafen).
7. Eltern-Tribüne am Boni, Wetter (Sonne, Abendlicht, Regen am Boni), Flutlicht.
8. Jubel-Choreografien wählbar, Teamfoto nach dem Sieg, Pokalübergabe im Turnier.

**Modi und Langzeitmotivation**
9. Saison/Liga mit Tabelle und Spielplan, Karriere eines eigenen Kindes (Level-ups), Trainingsaufgaben (Hütchen, Zielschießen, Penalty-Challenge).
10. Online-Bestenlisten, Online-Mehrspieler über WebRTC (große Aufgabe).
11. Vereins-Editor: eigene Spielernamen, Trikotfarben, Rückennummern; echte Kader der Borstentiere (nur mit Einverständnis, Datenschutz bei Kindern beachten).

**Technik und Qualität**
12. Restliche Grafik (Maskottchen, Deko, Bäume, Nilpferd) ebenfalls in hoher Auflösung.
13. PWA: offline spielbar, aufs Handy installierbar, App-Icon.
14. Sprachdatei statt fest eingebauter Texte (Deutsch/Englisch umschaltbar).
15. Automatische Tests ins Repo übernehmen (aktuell nur im Scratchpad), CI per GitHub Actions.

## 6. Nützlich für die Weiterarbeit

- **Starten:** `python3 serve.py` (Port 8000; für Tests Port 8123). Debug in der Konsole: `window.app`, z. B. `app.top.match`.
- **Neue Posen:** Eintrag in `P` in `world/figures.js` (Koordinaten wie für einen größeren Körper; sie werden skaliert) und Auswahl in `Skater.pose()`.
- **Neue Texte:** direkt als deutsche Großbuchstaben-Strings. Die Pixelschrift kennt A–Z, 0–9, ÄÖÜ und gängige Satzzeichen; ß wird automatisch zu SS.
- **Regeln:** Werte in `game/rules.js`, Ablauf in `game/referee.js`.
- **Balance:** Torhüter-Werte in `game/goalie.js` (SKILL), KI in `game/ai.js` (LEVELS, steer, passTarget), Physik in `config.js` und `game/puck.js`.
