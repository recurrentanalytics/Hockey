# Borstenboom! – Pläne für später

Vereinbart, aber zurückgestellt. Reihenfolge laut Absprache: zuerst „Die echten Kinder“, dann „Die Reise der roten Kugel“.

## 1. Die echten Kinder im Spiel
- Jedes Kind des Vereins als eigene Pixelfigur: Vorname oder Spitzname, Rückennummer, Haarfarbe, Trikot. Basis ist das vorhandene Chibi-System (`src/world/sprites.js`, `figures.js`), dazu je ein kleines Porträt von SpriteCook.
- Thorsten nennt die Kinder beim Namen („Toooor durch Mila!“). Dafür die Namen in `tools/voice/lines.json` ergänzen und mit `tools/voice/make_voice.py` neu erzeugen.
- Eigene Jubelrufe des Vereins als Tonaufnahmen, zum Beispiel „TOOOR!“, „Borstentiere vor!“, „Was sind wir? Ein Borstentier!“.
- **Datenschutz:** nur Vornamen oder Spitznamen, keine Fotos. Einverständnis der Eltern einholen, besonders bei Stimmaufnahmen von Kindern.

## 2. Die Reise der roten Kugel
- Die Erdkugel aus dem Intro wird zur Weltkarte und zum Menü: Globus drehen, Ort wählen, die Kamera fliegt hin und landet auf einem echten Platz in 3D (Google Photorealistic 3D Tiles über Cesium ion, wie beim Boni).
- Abenteuer-Modus: Spiel für Spiel reisen die Borstentiere vom Boni hinaus. Erst weitere Plätze in Hannover, etwa bei befreundeten Vereinen, dann Turnierorte, später berühmte Plätze der Welt. Jeder Sieg schaltet einen neuen Ort frei, Thorsten erzählt zwischen den Stationen.
- Pro Ort nötig: der Platz-Grundriss (Ecken wie in `docs/BONI_ORT.md`), Kamerawinkel, ein Platzmodell (`tools/intro/court_glb.py`), die Spielfeldmaße (`src/config.js`).

## Kleinere Ideen
- Tor-Kamerafahrt: Die echte 3D-Kamera schwenkt bei einem Tor einmal um den Platz.
- Wetter und Tageszeit auf dem echten Boni: Abendlicht, Regen, Schnee.
- Online gegeneinander auf zwei Geräten.

## Offen aus dem Feinschliff
- Den App-Signaturschlüssel (Android) an den Verein übergeben. Er liegt nur in der Arbeitsumgebung, ohne ihn muss die App vor jedem späteren Update deinstalliert werden.
- `HANDOVER.md` auf den aktuellen Stand bringen.
- Steuerung (Grip, Tempo, automatischer Wechsel) nach Praxistests mit den 8BitDo Micros nachjustieren.
