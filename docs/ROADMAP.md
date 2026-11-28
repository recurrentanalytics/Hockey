# BORSTENBOOM! – Roadmap

Stand: 27. November 2026, Commit `3938495`. Grundlage: [PROJECT_AUDIT.md](PROJECT_AUDIT.md), [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md) (Nummern T1 bis T17), [GAME_DESIGN.md](GAME_DESIGN.md).

**Grundsatz:** Klein anfangen, groß werden können. Der Boni wird zuerst außergewöhnlich gut. Allgemeine Strukturen entstehen erst, wenn der nächste Schritt sie wirklich braucht. Das Spiel kennt keine Karriereleiter mit Endziel (GAME_DESIGN 3).

---

## 1. Stand nach Kategorien

### Bereits implementiert
- Inlinehockey mit KI (auch Stufe „Kinder“), Torhütern, drei Regelwerken, Strafen, Bully, Dritteln, Verlängerung, Penaltyschießen, Statistik, Wiederholung, Turnier, Training, 2 Spielern.
- Eingabe über Tastatur, Touch und Gamepads (8BitDo Micro und SN30 Pro), frei belegbar.
- Pixel-Figuren mit Skelett-Animation (37 Posen), Pixelart von SpriteCook (Logo, Bonny, Torjubel), Schrift Pixelify Sans.
- Synthetischer Ton, Hymne, Kommentar und Erzählung mit der Stimme „Thorsten“.
- Intro vom Planeten auf den Boni, überspringbar, gesprochen.
- Echter Boni in 3D: Google-Kulisse, eigenes Platzmodell, Durchsicht durch die Bäume, Torkamera.
- Wetter live, historisch ab 1940 oder von Hand; Sonnenstand; Regen und Schnee; Jahreszeiten mit Laub und Herbstfarben; Laternen nachts.
- Baumschatten und Lichtflecken aus der amtlichen Kronenkarte, Figurenschatten nach Sonnenstand.
- Untergrund nach Wetter für Feldspieler und Ball (`src/game/surface.js`), Anzeige des Platzzustands.
- PWA mit automatischer Aktualisierung, Offline-Halle und Offline-Testplatz, Android-App.

### Teilweise implementiert
- **Untergrund:** wirkt nicht auf Torhüter und KI; Zustand ohne Gedächtnis (T8, ENVIRONMENT_SYSTEM).
- **Android-App:** Live-Version vollständig, mitgelieferte Ersatzkopie unvollständig (T1); Signaturschlüssel nicht übergeben (T17).
- **Laternen:** zwei geschätzte Lichtkegel, keine vermessenen Standorte.
- **Jahreszeiten an der Google-Kulisse:** umgefärbte Sommerbäume, keine echten Äste.
- **Tests:** nur die Halle hat einen automatischen Durchlauf (T2).

### Aktuell in Entwicklung
- Feinabstimmung von Wetterphysik und Steuerung. Wartet auf Praxistests mit den 8BitDo Micros.

### Nächster sinnvoller Schritt
**Phase 0 – Fundament sichern** (vor allem anderen, siehe unten): T1, T3, T4, T2, T17; direkt danach oder parallel T5 (Ortsbeschreibung).

### Mittelfristige Erweiterungen
Phase 1 (Boni perfektionieren), Phase 2 (lebendige Spielwelt), Phase 3 (Erweiterbarkeit).

### Langfristige Vision
Phase 4 (neue Orte, Reise), Phase 5 (neue Sportarten und gleichwertige Lebenswege, ohne vorgegebenes Endziel).

---

## 2. Phasen

### Phase 0 – Fundament sichern (neu, vorgezogen)

**Warum vor Phase 1:** Ohne Messung auf dem Tablet und ohne Test für den Boni-Pfad ist jede Feinarbeit an Optik und Physik ein Blindflug. Ohne reproduzierbare Ortsdaten hängt der Boni an Dateien, die nur in einer vergänglichen Arbeitsumgebung lagen. Alle Punkte sind klein.

| Schritt | Ziel | Bezug |
|---|---|---|
| 0.1 | ✅ Android-Assets korrigieren (Ersatzkopie vollständig, Prüfung im Build-Skript, App 0.8); Flugmodus-Test auf dem Gerät steht noch aus | T1 |
| 0.2 | ✅ Boni-Daten reproduzierbar: `tools/ort/abrufen.py`, Quellen und Prüfergebnis in `docs/BONI_ORT.md` | T3 |
| 0.3 | 🟡 Tablet- und Handytest: Anzeige `?fps` und App-Kurzbefehl „Leistungstest“ (App 0.9) fertig, Anleitung in `docs/PERFORMANCE_TEST.md`; Messung auf den Geräten steht aus | T4 |
| 0.4 | Boni-Test automatisieren: Testplatz und 3D-Standbilder ins Repo | T2 |
| 0.5 | Signaturschlüssel sicher an den Verein übergeben | T17 |
| 0.6 | Direkt danach oder parallel: **eine Ortsbeschreibung für den Boni** (`locations/boni/`), schlicht, ohne Welt-Engine. 🟡 Begonnen: `locations/boni/geo/` mit den Vektor-Geodaten (`tools/ort/geodaten.py`, siehe `docs/BONI_ORT.md`); `ort.js` steht noch aus | T5, WORLD_ARCHITECTURE 2 |

**Leitplanken, damit Phase 0 keine Großbaustelle wird:**
- Jeder Schritt ist ein eigener, kleiner Auftrag mit sichtbarem Ergebnis.
- Kein Umbau von `photoreal.js` oder des Spielkerns in Phase 0 (das ist T6 und T7, später).
- Die Ortsbeschreibung ist eine Datei mit Zahlen und Verweisen, die vorhandene Stellen lesen. Kein Ladesystem, keine Ortswechsel, keine Abstraktion für Orte, die es noch nicht gibt.
- Messen vor Optimieren: Performance-Arbeit (T12, T13) erst, wenn 0.3 einen Bedarf zeigt.
- Dokumentation (T14) nur dort nachziehen, wo sie falsch ist.

### Phase 1 – Boni perfektionieren

| Bereich | Inhalt | Bezug |
|---|---|---|
| Spielgefühl | Grip, Tempo, Auto-Wechsel und Wetterstärke nach Praxistest mit den Micros | – |
| Untergrund | Torhüter und KI an `SURF`; Schüsse auf Schnee und Laub | T8 |
| Physikqualität | Seed für Zufall, Kennzahlen-Test je Wetter | T10, T2 |
| Schatten | Figuren- und Bodenlicht nach denselben Regeln | T9 |
| Performance | je nach Messung: Jahreszeit-Shader begrenzen, Qualitätsstufen, Canvas-Auflösung | T12, T13, T4 |
| Installation | Hymne aus dem Precache oder kürzen | T11 |
| Optik | echte Laternenstandorte, Nässeglanz, Reif im Schatten | ENVIRONMENT_SYSTEM |
| Animation | Sturz- und Aufstehbewegung beim Ausrutschen, Spritzer bei Nässe, Schneestaub | – |

T5 (Ortsbeschreibung) ist nach Phase 0 vorgezogen: Es ändert nichts am Verhalten, verhindert aber, dass Optik, Physik und Werkzeuge bei jeder Feinarbeit auseinanderlaufen.

### Phase 2 – Der Boni als lebendige Spielwelt

| Inhalt | Bezug |
|---|---|
| Spielstand und Speicher vereinheitlichen (Voraussetzung für alles Weitere) | T16 |
| Zwei Kinderfiguren (neutral im Code, Namen nur auf dem Gerät), Auswahl beim Start | GAME_DESIGN 5 |
| Lernaufgaben auf dem Boni (bremsen, übersetzen, rückwärts, Pass, Schuss), Fertigkeiten | GAME_DESIGN 5 |
| Prolog in der vorhandenen Intro-Zeitleiste (Zeitleiste als Liste von Bausteinen) | GAME_DESIGN 6, T6 (Teil Zeitleiste) |
| Familienalbum mit Auslösern aus `match.events` und Erlebnissen ohne Spiel, Mamas Kommentare | GAME_DESIGN 7 |
| Eigene Stimme für Mama klären (Piper-Stimmen prüfen oder eigene Aufnahme) | GAME_DESIGN 7 |
| **Die echten Kinder des Vereins** als Pixelfiguren: Vorname oder Spitzname, Rückennummer, Haarfarbe, Trikot; Thorsten nennt sie beim Namen; Vereinsjubelrufe. Datenschutz: nur Vor- oder Spitznamen, keine Fotos, Einverständnis der Eltern | bisherige Roadmap Punkt 1 |
| Charaktereditor (Name nur lokal, Haare, Helm, Trikot, Nummer) | GAME_DESIGN 5 |

### Phase 3 – Technische Erweiterbarkeit

| Inhalt | Bezug |
|---|---|
| Ort per `?ort=<id>` laden, `BONI_3D` → `ORT` mit fester Schnittstelle | T7, WORLD_ARCHITECTURE 4 |
| `photoreal.js` und `environment.js` aufteilen | T6, WORLD_ARCHITECTURE 5 |
| Untergrund in Material, Zustand und Profile trennen (ohne Verhaltensänderung) | ENVIRONMENT_SYSTEM 2 |
| Zustand mit Gedächtnis (Abtrocknen, Gefrieren, Vorgeschichte von Open-Meteo) | ENVIRONMENT_SYSTEM 2 B |
| Werkzeuge lesen `ort.json` | T3, T5 |

**Mögliche Anpassung:** Wenn in Phase 2 der Prolog gebaut wird, sollte der Teil „Zeitleiste aus `photoreal.js` lösen“ aus T6 dort mit erledigt werden. Das ist ohnehin nötig und verhindert, dass der Prolog die Datei weiter aufbläht.

### Phase 4 – Neue Orte und größere Spielwelt

| Inhalt | Bezug |
|---|---|
| Zweiter Ort in Hannover als Probe des Ortsmodells | WORLD_ARCHITECTURE 6 |
| Vereinsort in der Region | GAME_DESIGN 8 |
| **Die Reise der roten Kugel:** Erdkugel als Weltkarte, Ort wählen, Anflug und Landung; Abenteuer-Modus: Sieg schaltet neue Orte frei, Thorsten erzählt zwischen den Stationen | bisherige Roadmap Punkt 2 |
| Material je Ort (Beton, Pflaster), Vegetation je Ort | ENVIRONMENT_SYSTEM 2 A, 5 |
| **Zeitreise am Boni:** Bebauung und Bäume früherer Jahre zum Regler „Damals“; vorher prüfen, welche alten Luftbilder und Karten es gibt. Passt nicht zur heutigen Google-Kulisse und braucht eine eigene Darstellung | bisherige Roadmap Punkt 3 |
| **Eigene 3D-Bäume am Platz (Weg B):** Google-Bäume im Umkreis von ca. 50 m durch echte Baummodelle ersetzen (Fotoscans, CC0), die im Winter wirklich kahl sind; als Versuch mit Vorher-nachher-Vergleich, Leistung auf dem Tablet prüfen | bisherige Roadmap Punkt 4 |
| Online gegeneinander auf zwei Geräten | bisherige kleinere Ideen |

### Phase 5 – Neue Sportarten und Lebenswege

| Inhalt | Bezug |
|---|---|
| Eigene Disziplin für Kind B (Vorschlag: Kunst- oder Freestyle-Skaten) | GAME_DESIGN 9 |
| Lockere Spielformen: Street Hockey, Beer League | GAME_DESIGN 9 |
| Eishockey: Profil Kufen, Eisfläche; Ausgangspunkt ist die Halle (60 × 30 m, Bodycheck-Regeln) | GAME_DESIGN 9 |
| Fortschritt als Netz gleichwertiger Wege (Verein, Eis, Freizeit, Tricks, Entdecken); die NHL ist eine mögliche Geschichte, kein Endziel | GAME_DESIGN 3, 10 |

### Nebenstrang – Architektur-Bibliothek (Häuser)

Grundlage ist die Architektur-Analyse vom 2026-11-28 (Roadmap-Schritte 0–9). Entscheidung des Besitzers am selben Tag: Was dem Spiel nützt, wird hier gemacht. Alles, was nur anderen Projekten nützt, ruht, bis es ein zweites Projekt gibt; dann zieht `src/bau/` mit `schema/` und dem Referenztest in ein eigenes Repository.

| Schritt | Inhalt | Stand |
|---|---|---|
| 0 | Neue Häuser als Standard | ✅ `f3505c1` |
| 1 | Ein Weltmaßstab (Kulisse 12,5, Bühne 23 Pixel je Meter), Bausätze in der Asset-Prüfung, Fenster, Türen und Gesimse je Fassade vermessen | ✅ `5bc26c1`, `f2acd26`, `d74d9de` |
| 2 | Hausregeln engine-neutral in `src/bau/haus.js`, Cesium nur noch Adapter, Referenz des gebauten Viertels | ✅ `3a6b937` |
| 3 | Datenmodell: `schema/bausatz.schema.json`, `schema/bauplan.schema.json` | ✅ `235befc` |
| 5 | Echte Dächer und Höhen aus dem LoD2-Gebäudemodell des LGLN (`tools/ort/lod2.py`, `locations/boni/geo/daecher.json`) | ✅ 2026-11-28 |
| 4 | 3D-Pilot: Fensterachse und Gesims als 3D-Modul in Blender, als Relief an einigen Häusern | ruht: kostet Leistung, bei der Pixel-Optik wenig sichtbar; braucht Blender |
| 6–9 | Zweiter Grafikstil, Godot-Adapter, zweite Architekturfamilie, eigenes Repository | ruht bis zu einem zweiten Projekt; nützt dem Spiel nicht |

---

## 3. Was bewusst nicht geplant ist

- **Kein Framework und kein Build-System.** Die Vanilla-Architektur trägt alle geplanten Schritte.
- **Kein Umbau des Spielkerns zu Laufzeit-Orten**, solange Neuladen je Ort genügt (WORLD_ARCHITECTURE 4, Weg A).
- **Keine eigene Intro-Engine.** Die vorhandene Zeitleiste wird erweitert.
- **Keine Online-Konten.** Spielstand und Album bleiben auf dem Gerät.
