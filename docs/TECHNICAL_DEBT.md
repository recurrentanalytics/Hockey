# BORSTENBOOM! – Technische Schulden und Risiken

Stand: 27. November 2026, Commit `3938495`. Jede Position ist am Code geprüft. Grundlage: [PROJECT_AUDIT.md](PROJECT_AUDIT.md).

**Priorität:** 🔴 hoch (Fehler oder Risiko für den Betrieb, oder blockiert die nächsten Phasen) · 🟠 mittel (kostet bei jeder Erweiterung Zeit) · 🟢 niedrig (Aufräumen)
**Aufwand:** S (unter einer Stunde) · M (ein halber bis ganzer Tag) · L (mehrere Tage)

Nichts davon ist umgesetzt. Jede Position ist ein eigener kleiner Auftrag.

---

## Übersicht

| # | Thema | Prio | Aufwand | Nutzen |
|---|---|---|---|---|
| T1 | Android-Ersatzkopie unvollständig | 🔴 | S | App offline wieder vollständig |
| T2 | Kein Test für den Boni-Pfad (3D und Testplatz) | 🔴 | M | jeder Umbau prüfbar |
| T3 | Ortsdaten nicht reproduzierbar | 🔴 | M | Boni neu baubar, zweiter Ort möglich |
| T4 | Keine Messung auf echten Geräten | 🔴 | S–M | Grundlage aller Performance-Entscheidungen |
| T5 | Boni-Konstanten an acht Stellen | 🟠 | M | eine Quelle der Wahrheit, Voraussetzung für Ortsmodell |
| T6 | `photoreal.js` und `environment.js` zu breit | 🟠 | L | Intro, Prolog und Welt unabhängig erweiterbar |
| T7 | Ort wird beim Import festgelegt | 🟠 | M (Weg A) | Ortswechsel per `?ort=` |
| T8 | Untergrund wirkt nicht auf Torhüter und KI | 🟠 | M | spürbar besseres Spielgefühl bei Wetter |
| T9 | Sonnenstrahl zweimal implementiert | 🟠 | S | Figuren- und Bodenschatten stimmen überein |
| T10 | Zufall ohne Seed | 🟠 | M | reproduzierbare Physiktests |
| T11 | Hymne (4 MB) im Precache | 🟠 | S | schnellere Installation, weniger Datenvolumen |
| T12 | Jahreszeit-Shader läuft auf allen Kacheln | 🟠 | S | weniger GPU-Last auf Tablets |
| T13 | Spiel-Canvas zeichnet immer in voller Auflösung | 🟢–🟠 | M | Akku und Wärme auf Tablets, falls T4 es zeigt |
| T14 | Veraltete Dokumente | 🟢 | S | Klarheit für alle, die mitarbeiten |
| T15 | Reste und doppelte Kleinigkeiten | 🟢 | S | Aufräumen |
| T16 | Drei Speicherschemata | 🟢 | S | ein Spielstand, einfacher Export |
| T17 | Signaturschlüssel nicht übergeben | 🔴 | S | App-Updates ohne Neuinstallation |

---

## Details

### T1 🔴 Android-Ersatzkopie unvollständig (S)
`tools/android/build.sh` kopiert nur `assets/intro` und `assets/app` in die App. Es fehlen `assets/pixel`, `assets/fonts`, `assets/voice`, außerdem `test.html` und `src/test/`. Ohne Netz zeigt die App deshalb vermutlich keine Pixel-Grafiken (Logo, Bonny, „TOOOR!“), keine Pixelify-Schrift und keinen Kommentar.
**Vorschlag:** `cp -r assets "$WWW/"` statt einzelner Ordner, `test.html` mitnehmen. Danach einmal im Flugmodus prüfen.

### T2 🔴 Kein Test für den Boni-Pfad (M)
`tools/test/playthrough.cjs` prüft nur die Halle. Für `test.html` und `intro.html` gibt es keinen eingecheckten Test. Die Prüfskripte der letzten Wochen lagen nur in der Arbeitsumgebung.
**Vorschlag:**
- `tools/test/boni.cjs`: Testplatz starten, Spiel beginnen, Untergrund auf Sonne, Regen und Schnee setzen, Seitenfehler zählen, Kennzahlen ausgeben (Tempo, Ballweg, Stürze).
- `tools/test/stills.cjs`: Standbilder des 3D-Platzes für feste Zeitpunkte und Wetterlagen. Braucht Cesium-Zugang, läuft also nur lokal oder mit Token.
- Beide vor jedem Umbau und danach laufen lassen, Bilder vergleichen.

### T3 🔴 Ortsdaten nicht reproduzierbar (M)
`tools/intro/shadow_casters.py` und `court_glb.py` brauchen Eingangsdaten, die nicht im Repo liegen: LGLN-Raster für Oberflächen- und Geländemodell, Gebäudemaske, Luftbild und das Asphaltfoto (Poly Haven, CC0). Der Abruf über den LGLN-WMS war Handarbeit (Farbskala dekodieren: 1,2 m je Graustufe). Die Pixelkoordinaten der Ecken im Referenzraster stehen fest im Skript.
**Vorschlag:** `tools/ort/abrufen.py <ort.json>`: lädt DOP20, DOM1, DGM1 (Farbskala) und ALKIS-Gebäude für den Ausschnitt um die Ecken, dekodiert die Höhen und legt die Rohdaten in einen nicht eingecheckten Ordner. Die Asphalt-Quelle als Download-Hinweis in `quellen.md`. Das ist die wichtigste Voraussetzung für jeden zweiten Ort.

### T4 🔴 Keine Messung auf echten Geräten (S–M)
Alle Tests liefen mit Software-Rendering. Ob das Spiel auf dem Android-Tablet flüssig läuft, ist unbekannt. Kritisch sind Boden-Shader (`TREE_LIGHT`, bis 48 Texturzugriffe pro Pixel), Jahreszeit-Shader auf allen Kacheln, Schattenkarte und der Spiel-Canvas in voller Auflösung.
**Vorschlag:** eine Anzeige mit `?fps` (Bildrate des Spiels und der letzten Cesium-Bilder, Gerätepixelverhältnis, Auflösungsfaktor). Einmal auf Tablet und Handy ansehen: Intro, Spiel bei Sonne, Spiel im Herbst, Torkamera. Danach entscheiden, ob T12 und T13 nötig sind. Ein Qualitätsschalter (niedrig, mittel, hoch) in den Einstellungen wäre die übliche Antwort.

### T5 🟠 Boni-Konstanten an acht Stellen (M)
Ecken, Zaunmaß, Spielfeld, Kronenkarte, Blick und Laternen stehen verteilt in `photoreal.js`, `environment.js` (Shader), `config.js`, `flat.js`, `court_glb.py`, `shadow_casters.py` (Liste in PROJECT_AUDIT 5.1).
**Vorschlag:** `locations/boni/ort.js` (und `ort.json` für Python) nach [WORLD_ARCHITECTURE.md](WORLD_ARCHITECTURE.md). Alle Stellen lesen daraus. Die Shader bekommen die Kartenmaße als Uniform. Keine Verhaltensänderung; mit T2 prüfen.

### T6 🟠 `photoreal.js` und `environment.js` zu breit (L)
`photoreal.js` (646 Zeilen) vereint Cesium-Start, Flug, Karte, Erzählung, Modelle, fünf Shader, Wetter-Anbindung und Spielbrücke. `environment.js` mischt reines Modell, Darstellung und Menü. Der geplante Prolog und jeder neue Ort würden die Dateien weiter wachsen lassen.
**Vorschlag:** Aufteilung nach WORLD_ARCHITECTURE Abschnitt 5, in kleinen Schritten, zuerst die reinen Funktionen (`sunPosition`, `season`, `visuals`, `fetchWeather`, Rahmen). Erst nach T2.

### T7 🟠 Ort wird beim Import festgelegt (M)
`config.js` (`RINK`, `GOAL`, `SKATE`, `SHOT`), `projection.js` (`FIXED`), `ai.js` (`K`, `KY`) und `scenes/rink.js` (`N`) werten `globalThis.BONI_3D` beim Laden aus. `BONI_3D` ist zudem ein Sammelobjekt ohne festgelegte Schnittstelle.
**Vorschlag:** Weg A aus WORLD_ARCHITECTURE: `?ort=<id>` lädt die Ortsbeschreibung vor dem Spiel. `BONI_3D` in `ORT` umbenennen und die Felder in einem Kommentarblock festschreiben. Der Umbau zu Laufzeitobjekten (Weg B) erst, wenn er wirklich gebraucht wird.

### T8 🟠 Untergrund wirkt nicht auf Torhüter und KI (M)
`goalie.js` importiert `SURF` nicht. `ai.js` plant Pässe und Wege wie auf trockenem Platz. Schüsse sind unabhängig vom Untergrund.
**Vorschlag:** siehe [ENVIRONMENT_SYSTEM.md](ENVIRONMENT_SYSTEM.md) Abschnitt 3. Spürbar, klein, gut testbar mit T2.

### T9 🟠 Sonnenstrahl zweimal implementiert (S)
`treeLight()` (GLSL, `environment.js`) und `lit()` (JS, `photoreal.js`) verfolgen denselben Strahl, aber mit verschiedenen Regeln: `lit()` kennt keinen Kronenansatz (35 % der Höhe) und keine Dächer (Grünkanal). Eine Figur kann deshalb anders beleuchtet wirken als der Boden unter ihr.
**Vorschlag:** gleiche Regeln in beiden, die Konstanten aus T5 teilen.

### T10 🟠 Zufall ohne Seed (M)
`Math.random` steht 38-mal in `src/game` und `src/world`. Physikänderungen lassen sich nicht mit demselben Spielverlauf vergleichen.
**Vorschlag:** eine kleine Zufallsquelle mit Seed (`src/engine/rng.js`) und `?seed=` für Tests. Optik-Zufall (Partikel) darf frei bleiben.

### T11 🟠 Hymne (4 MB) im Precache (S)
`audio/hymne.mp3` steht in `sw-files.js`. Jede PWA-Installation lädt 4 MB, bevor das Spiel offline geht.
**Vorschlag:** aus dem Precache nehmen (beim ersten Abspielen speichert der Service Worker sie ohnehin) oder auf die gespielten 10 bis 20 Sekunden kürzen und neu kodieren (etwa 0,3 MB).

### T12 🟠 Jahreszeit-Shader auf allen Kacheln (S)
`seasonal()` läuft im Kachel-Shader überall, wo Vegetation erkannt wird, auch Kilometer entfernt. Die Wirkung endet erst bei 900 m (`tree`-Faktor), die Rechenarbeit nicht.
**Vorschlag:** früher Ausstieg über die Entfernung vor den Texturzugriffen. Während des Flugs aus dem All (`u_holes` aus) die Jahreszeit erst ab etwa 2 km Höhe einschalten.

### T13 🟢–🟠 Spiel-Canvas in voller Auflösung (M)
`#screen` wird jedes Bild in Gerätepixeln neu gezeichnet, auch wenn sich wenig bewegt. Auf hochauflösenden Tablets (DPR 2 bis 3) kostet das Akku.
**Vorschlag:** nur bei Bedarf (nach T4). Etwa die Textebene seltener neu zeichnen oder die Spielebene auf DPR 2 begrenzen.

### T14 🟢 Veraltete Dokumente (S)
`README.md` (englisch, nur Halle, „Inline Hockey“), `HANDOVER.md` („Version 24“), `SPEC.md` (Phasenplan der Halle), `docs/VISUELLE_NEUAUSRICHTUNG.md` (Comic-Stil, verworfen).
**Vorschlag:** README neu und kurz auf Deutsch mit Verweisen auf `docs/`. HANDOVER durch ARCHITECTURE und PROJECT_AUDIT ersetzen. VISUELLE_NEUAUSRICHTUNG mit einem Hinweis „verworfen“ versehen oder in `docs/archiv/` verschieben. Löschen nur nach Absprache.

### T15 🟢 Reste und doppelte Kleinigkeiten (S)
- `<canvas id="gl">` in `intro.html` (Luftbild-Intro, entfernt).
- `tools/intro/__pycache__/court_glb.cpython-313.pyc` ist eingecheckt; `__pycache__/` in `.gitignore`.
- `court_glb.py` schreibt noch `flecken.png`, das nicht mehr gebraucht wird.
- `window.app` ist immer gesetzt, obwohl der Kommentar `?debug` verlangt (`src/main.js`).
- Alte Pixel-Variante des Boni in `src/world/rink.js` (`venue: 'boni'`) und Einstellung „Spielort“ der Halle: begrifflich mit dem echten Ort verwechselbar. Behalten, aber als „Halle: Draußen-Optik“ benennen, oder entfernen (nach Absprache).
- Rauschfunktionen in mehreren Shadern.

### T16 🟢 Drei Speicherschemata (S)
`inline-hockey:*` über `engine/storage.js`, dazu `boniWeather` und `boniCesiumToken` direkt. Für Spielstand und Album (Phase 2) braucht es einen Ort.
**Vorschlag:** alles über `engine/storage.js`, Präfix `borstenboom:` mit Übernahme der alten Schlüssel. Token bleibt getrennt (Geheimnis, in der App in SharedPreferences).

### T17 🔴 Signaturschlüssel nicht übergeben (S)
Der Release-Schlüssel der Android-App liegt nur in der Arbeitsumgebung. Ohne ihn muss die App vor jedem späteren Update deinstalliert werden. Steht schon in der Roadmap.

---

## Risiken außerhalb des Codes

| Risiko | Wirkung | Umgang |
|---|---|---|
| Cesium ion Community: 1 000 Sitzungen im Monat, nur nicht-kommerziell | Bei mehr Spielern bricht die 3D-Ansicht weg, Rückfall auf die Halle | Nutzung im Cesium-Konto beobachten; Testplatz als vollwertiger Rückfall |
| Google-3D-Kacheln: Bedingungen, Verfügbarkeit, Aufnahmestand | Kulisse kann sich ändern oder wegfallen | Ortsdaten (LGLN) unabhängig halten; Testplatz und Luftbild-Boden als Rückfall |
| Öffentliches Repository | Namen von Kindern weltweit lesbar | siehe [GAME_DESIGN.md](GAME_DESIGN.md) Abschnitt 11 |
| Open-Meteo ohne Schlüssel | Ratenbegrenzung, Ausfall | Rückfall „Sonne“ ist vorhanden; letzte Werte merken |
