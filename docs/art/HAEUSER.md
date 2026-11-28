# Die Häuser des Viertels – Stilblatt (H1)

Stand: Das ganze Viertel ist eingekleidet (236 Häuser), **wartet auf Freigabe**. Sie sind der Normalfall in `welt.html`; `?haeuser=alt` zeigt die schlichten Blöcke.

## Grundsatz

Ein Haus hat zwei Schichten, und sie kommen aus verschiedenen Quellen:

| Schicht | Quelle | Wo |
|---|---|---|
| **Form:** Grundriss, Traufe, Geschosse, Dachform, First, Brandwände, Durchfahrten, Straßen- und Hofseite; welcher Bausatz an welche Wand kommt; das Netz | Geodaten (ALKIS, OSM), feste Regeln | `src/bau/haus.js`, engine-neutral (kein CesiumJS, kein DOM) |
| **Zeichnung:** Fassaden, Fenster, Türen, Läden, Dachziegel, Schornsteine, Gauben, Putz | **SpriteCook-Sprites** | `assets/welt/haeuser/`, beschrieben in `bausaetze.json` |
| **Darstellung:** Shader, Bildbogen der Bausätze, ein Zeichenobjekt für das Viertel | CesiumJS | `src/welt/haeuser.js` (Adapter) |

Was die Regeln aus dem echten Viertel machen, steht je Haus in `tests/referenz/viertel.json`: Körper, Dach, Farben, Bausatz, jede Wand mit Schnittstücken und Geschossen, Dachaufbauten, ein Prüfwert des Netzes. `tests/viertel-referenz.test.mjs` vergleicht bei jedem Lauf. Eine gewollte Änderung schreibt die Datei mit `UPDATE_REFERENZ=1` neu. Dieselbe Datei ist der Prüfstein für jeden späteren Generator (glTF, Godot): Er muss dieselben Häuser bauen.

Die erste Fassung von H1 zeichnete Fenster, Türen und Ziegel im Shader. Das war klotzig und beliebig und ist als Zielstil **verworfen**. Der Code dafür steckt noch in `haeuser.js`, wird in der Welt aber nicht mehr gezeigt. Neue sichtbare Gestaltung entsteht nicht im Shader.

## Die Bausätze

Sieben gezeichnete Fassaden, je vier Geschosse und sieben Fensterachsen:

| Bausatz | Trägt | Wand |
|---|---|---|
| `stuck` | Wohnhäuser | Putz, nimmt die Farbe des Hauses an |
| `jugendstil` | Wohnhäuser, Schulen | Putz, färbbar |
| `klinker-a`, `klinker-b` | Wohnhäuser | roter Klinker, bleibt wie gezeichnet |
| `schlicht` | Wohnhäuser (Nachkriegsbau) und **jede Hofseite** | Putz, färbbar |
| `laden-a`, `laden-b` | Häuser mit Handel im Erdgeschoss | Putz, färbbar, Ladenfront dunkelgrün |

Hofgebäude und Überdachungen bekommen getönten Putz ohne Fenster.

### Wie eine Fassade auf ein Haus kommt

- **Achsen:** Jede Fassade ist in senkrechte Streifen zerlegt: zwei Randachsen, schlichte Fensterachsen und ein Mittelstück mit der Haustür. Für eine Wand werden so viele Achsen nebeneinandergesetzt, wie ihre Länge verlangt. Kein Pixel wird skaliert; die fertige Reihe wird nur um wenige Prozent auf die Wandlänge gezogen. Passt keine ganze Achse (unter etwa 4 m, oder Abweichung über 25 %), trägt die Wand nur den Pfeiler zwischen zwei Fenstern. So laufen Gesimse und Sockel um jede Ecke.
- **Geschosse:** Jede Fassade ist auch in waagerechte Streifen zerlegt: Erdgeschoss, Obergeschosse, oberstes Geschoss mit Traufgesims. Ein Haus mit fünf Geschossen wiederholt ein mittleres, eines mit drei lässt eines weg.
- **Die Tür** sitzt einmal je Haus, an der längsten Straßenfront.
- **Farbe:** Bei färbbaren Bausätzen nimmt nur die Wandfläche die Farbe des Hauses an (neun Putzfarben). Stuck, Fenster, Türen und Läden bleiben, wie sie gezeichnet sind. Welche Pixel Wand sind, findet `wandmaske()` selbst.
- **Auswahl:** Bausatz und Farbe folgen aus der Kennung des Hauses. Ein Haus trägt, wenn es geht, weder den Bausatz noch die Farbe eines Nachbarn, mit dem es eine Wand teilt.
- **Brandwände** zeigen Putz, **Dächer** Ziegel (eine Textur, auf die Dachfarbe des Hauses getönt), **flache Dächer und Hofflügel** dunklen Putz.
- **Auf dem Dach:** Schornsteine nahe dem First, Dachfenster in der Fläche; ab etwa 35° Dachneigung Gauben mit Wangen und kleinem Satteldach.

## Maßstab

Die Welt hat zwei Ebenen mit je einem Maß. Beide stehen in `assets/welt/massstab.json`:

| Ebene | Pixel je Meter | Was |
|---|---|---|
| **Kulisse** (`px_je_m`) | 12,5 | Fassaden, Dachziegel, Dachteile, Putz, Boden (160 Pixel für 12,8 m Traufhöhe) |
| **Bühne** (`buehne_px_je_m`) | 23 | alles auf Augenhöhe neben den Figuren: Spielfiguren (ein 1,4 m großes Kind ist 32 Pixel hoch), Bank, Laterne, Mülleimer, Fahrradbügel, Picknicktisch, Klettergerüst, Nilpferd |
| Bäume | 9 | Ausnahme, siehe unten |

Vorn ist es also fein und niedlich, die Kulisse dahinter ist ruhiger und gröber. Der Besitzer hat die Bühne nach der Spielfigur gewählt (32er-Chibi, „so niedlich wie möglich“, 2026-11-28, `docs/art/prompts/niedlich.md`).

Die Kulisse auf das Bühnenmaß zu bringen, wurde versucht und geht mit SpriteCook heute nicht. Eine Fassade bräuchte etwa 300 Pixel Höhe. Die Bildmodelle behalten aber das Raster ihrer Vorlage oder zeichnen gröber (160, 96 oder 42 Pixel), und das Exakt-Größen-Modell zeichnet höchstens 128. Bei den Bäumen gilt dasselbe: 14 m wären etwa 320 Pixel. Ein möglicher Weg wäre, Fassaden aus einzeln gezeichneten Achs- und Geschossstücken (je unter 128 Pixel) zusammenzusetzen; das ist nicht erprobt.

Die Asset-Prüfung (`npm run assets:check`) meldet einen Fehler, wenn ein Bausatz oder der Boden mehr als 5 % vom Kulissenmaß abweicht. `node tools/assets/validate.mjs assets --massstab` zeigt die Pixeldichte aller Welt-Sprites gegenüber der Bühne.

Das Spielfeld des 2D-Spiels hat ein eigenes Maß (16 Pixel je Meter quer, 8 in der Tiefe). Das ist eine andere Ansicht und bleibt getrennt. Die Spielfigur in der Welt ist noch die animierte Figur des 2D-Spiels; ihre Welt-Variante (32er-Chibi) bekommt als Nächstes eine Laufanimation.

SpriteCook hält die Größe ein, wenn man quadratisch und in der Größe der Stilreferenz bestellt (160 × 160). Kleine Dachteile kommen aus dem Exakt-Größen-Modell.

## Bauteile

Jede Fassade weiß, wo ihre Teile liegen. In `bausaetze.json` stehen sie je Fassade, in Pixeln des Bildes:

- **`oeffnungen`**: Fenster, Schaufenster und die Tür, jeweils mit Geschoss (0 = Erdgeschoss), Rahmen (`x`, `y`, `b`, `h`) und bei Fenstern der Glasfläche (`glas`).
- **`gesimse`**: waagerechte Zierbänder über die ganze Front, als Zeilenbereiche. Dazu zählen auch Sockelbänder.

Gemessen werden sie mit `node tools/assets/fassaden-vermessen.mjs`:
- `--schreiben` trägt sie ein.
- `--bild datei.png` zeichnet sie zur Kontrolle über die Fassaden.

Das Werkzeug arbeitet mit dem Fensterraster einer Fassade, der Fensterhöhe je Geschoss und dem hellen Fensterrahmen. So stören Vorhänge, helle Scheiben und Balkone nicht. Der Test `tests/welt-bausaetze.test.mjs` misst jede Fassade neu und vergleicht mit dem Eingetragenen. Ein geändertes Bild fällt damit sofort auf.

**Grenzen:**
- Die Rahmen sind auf etwa 1–2 Pixel genau.
- Bei Fenstern mit Vorhang deckt der Rahmen manchmal nur die Glasfläche ab, nicht die ganze Fensterbreite.
- Die schmalen Seitentüren der Läden werden nicht erkannt.
- Gesimse bei Klinker sind nur dort erfasst, wo sie hell sind.

Genutzt werden die Bauteile noch nicht. Sie sind die Grundlage für:
- nachts beleuchtete Fenster,
- echte Fensterlaibungen,
- andere Darstellungen als Cesium.

## Prüfung

`npm run assets:check` prüft neben der Art-Bibliothek auch die Bausätze der Welt (`validateWelt` in `tools/assets/validate.mjs`):
- **Bilder:** Jedes Bild ist vorhanden, so groß wie eingetragen und unverändert (`sha12`). Jedes PNG in den Ordnern steht in seinem Bausatz.
- **Maßstab:** Jede Pixelgröße ist der Weltmaßstab.
- **Schnitte:** Schnittstücke und Geschosszeilen liegen im Bild.
- **Bauteile:** Jedes liegt in seinem Geschoss. Jede Fassade hat genau eine Tür, und zwar im Mittelstück.

Nach einem Bildwechsel den `sha12` neu eintragen und die Bauteile neu messen.

## Datenmodell

Zwei JSON-Schemas in `schema/` beschreiben, was zwischen Daten, Regeln und Darstellung ausgetauscht wird:

| Schema | Beschreibt | Beispiel | Geprüft von |
|---|---|---|---|
| `bausatz.schema.json` | die Bausätze: Fassaden mit Schnitten und Bauteilen, Ziegel, Putz, Dachteile | `assets/welt/haeuser/bausaetze.json` | `npm run assets:check` |
| `bauplan.schema.json` | ein gebautes Haus: Körper, Dach, Farben, Bausatz, Wandläufe mit Schnitten und Geschossen, Aufbauten, Netz-Prüfwert | jedes Haus in `tests/referenz/viertel.json` | `tests/viertel-referenz.test.mjs` |

Der Bauplan ist die Übergabe an jede Darstellung. Heute baut der CesiumJS-Adapter daraus das Viertel, später ebenso ein glTF- oder Godot-Adapter.

Geprüft wird mit `tools/assets/schema.mjs`, einem kleinen eigenen Prüfer ohne Abhängigkeit. Er kennt die Teile von JSON Schema, die die beiden Schemas nutzen.

Schemas für einzelne 3D-Module und Material-Sets folgen erst mit dem 3D-Pilot. Vorher würden sie Bauteile beschreiben, die es nicht gibt.

## Licht

Die Sprites tragen ihr eigenes Licht von links oben. Dazu kommen drei Stufen je nach Seite zur Sonne (100 / 92 / 82 %, Dächer 100 / 93 / 84 %), damit Vorder- und Rückseite auseinanderzuhalten sind. Die Stärke folgt dem Umweltmodul; ein Wechsel von Uhrzeit oder Wetter ändert drei Zahlen und baut nichts neu.

## Offen

- **Durchfahrten:** Die Tunnelwände sind noch einfarbig (aus der ersten Fassung) und wirken von der Straße wie ein dunkles Rechteck in der Wand.
- **Leistung:** rund 199 000 Ecken und 98 000 Dreiecke in einem Zeichenobjekt; auf einem Tablet nicht gemessen, nur im Headless-Lauf (SwiftShader) geprüft.
- **Nähte zwischen Achsen:** Der Shader liest nie über den Rand eines Wandfelds hinaus. An der Stelle, an der zuvor eine gepunktete Linie auffiel, ist das nicht hochaufgelöst nachgeprüft.
- **Freigabe:** Die Bausätze warten auf die Freigabe des Besitzers. Die Asset-Prüfung kennt sie inzwischen (siehe „Prüfung“) und meldet bis dahin eine Warnung.

## Für weitere Bausätze

- Auftrag wie in `docs/art/prompts/haus.md`: strikte Frontansicht, nur die Wand von Sockel bis Traufe, vier Geschosse, sieben Achsen, 160 × 160, `stuck` als erste Stilreferenz.
- Wand in Taubenblau bestellen, wenn der Bausatz färbbar sein soll: Die Farbe hebt sich klar von Stuck und Glas ab.
- Nach der Erzeugung die Schnittlinien am Bild prüfen (Pfeilermitten, Geschossgrenzen), dann den Eintrag in `bausaetze.json` schreiben, mit `sha12`. Danach die Bauteile messen (`fassaden-vermessen.mjs --schreiben`) und mit `--bild` ansehen. `tests/haeuser.test.mjs` und `npm run assets:check` prüfen jeden Bausatz.
