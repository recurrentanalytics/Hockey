# Die Häuser des Viertels – Stilblatt (H1)

Stand: Das ganze Viertel ist eingekleidet (236 Häuser), **wartet auf Freigabe**. Zu sehen mit `welt.html?haeuser=neu`; ohne den Schalter bleibt die Welt, wie sie war.

## Grundsatz

Ein Haus hat zwei Schichten, und sie kommen aus verschiedenen Quellen:

| Schicht | Quelle | Wo |
|---|---|---|
| **Form:** Grundriss, Traufe, Geschosse, Dachform, First, Brandwände, Durchfahrten, Straßen- und Hofseite | Geodaten (ALKIS, OSM), feste Regeln | `src/welt/haeuser.js`, oberer Teil |
| **Zeichnung:** Fassaden, Fenster, Türen, Läden, Dachziegel, Schornsteine, Gauben, Putz | **SpriteCook-Sprites** | `assets/welt/haeuser/`, beschrieben in `bausaetze.json` |

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

**12,5 Pixel je Meter** für Fassaden, Dachziegel und Dachteile (160 Pixel für 12,8 m Traufhöhe). Das ist die vom Besitzer gewählte grobe Pixelgröße; sie liegt nah an den Bäumen und am vereinbarten Umgebungsmaß von 16.

SpriteCook hält die Größe ein, wenn man quadratisch und in der Größe der Stilreferenz bestellt (160 × 160). Kleine Dachteile kommen aus dem Exakt-Größen-Modell.

## Licht

Die Sprites tragen ihr eigenes Licht von links oben. Dazu kommen drei Stufen je nach Seite zur Sonne (100 / 92 / 82 %, Dächer 100 / 93 / 84 %), damit Vorder- und Rückseite auseinanderzuhalten sind. Die Stärke folgt dem Umweltmodul; ein Wechsel von Uhrzeit oder Wetter ändert drei Zahlen und baut nichts neu.

## Offen

- **Durchfahrten:** Die Tunnelwände sind noch einfarbig (aus der ersten Fassung) und wirken von der Straße wie ein dunkles Rechteck in der Wand.
- **Leistung:** rund 199 000 Ecken und 98 000 Dreiecke in einem Zeichenobjekt; auf einem Tablet nicht gemessen, nur im Headless-Lauf (SwiftShader) geprüft.
- **Nähte zwischen Achsen:** Der Shader liest nie über den Rand eines Wandfelds hinaus. An der Stelle, an der zuvor eine gepunktete Linie auffiel, ist das nicht hochaufgelöst nachgeprüft.
- **Freigabe:** Die Bilder liegen neben der Art-Bibliothek; `tools/assets/validate.mjs` kennt ihr Format nicht.

## Für weitere Bausätze

- Auftrag wie in `docs/art/prompts/haus.md`: strikte Frontansicht, nur die Wand von Sockel bis Traufe, vier Geschosse, sieben Achsen, 160 × 160, `stuck` als erste Stilreferenz.
- Wand in Taubenblau bestellen, wenn der Bausatz färbbar sein soll: Die Farbe hebt sich klar von Stuck und Glas ab.
- Nach der Erzeugung die Schnittlinien am Bild prüfen (Pfeilermitten, Geschossgrenzen), dann den Eintrag in `bausaetze.json` schreiben. Der Test `tests/haeuser.test.mjs` prüft jeden Bausatz.
