# Die Häuser des Viertels – Stilblatt (H1)

Stand: Prototyp, **wartet auf Freigabe**. Gilt für alles, was `src/welt/haeuser.js` zeichnet, und als Vorgabe für spätere Fassaden-Sprites, damit Gezeichnetes und Erzeugtes zusammenpassen.

Die Häuser entstehen ohne Sprites: Form aus den Geodaten, Zeichnung im Shader. SpriteCook-Credits hat H1 nicht verbraucht.

## Maßstab

| Was | Wert |
|---|---|
| Kunstpixel auf Wand und Dach | **16 je Meter** (`PX`), fest an der Wand, wandert nicht mit der Kamera |
| Fensterachse | 1,7 m (27 px); die Achsen teilen jede freie Wand gleichmäßig |
| Erdgeschoss | 3,6 m (57 px), bei eingeschossigen Häusern die ganze Wand |
| Obergeschoss | Traufhöhe minus Erdgeschoss, geteilt durch die übrigen Geschosse (meist 3,07 m, 49 px) |
| Fenster Straße | 16 oder 18 px breit (je Haus), 27 px hoch, Brüstung 14 px über dem Boden des Geschosses |
| Fenster Hof | 14 × 24 px, ohne Schmuck |
| Haustür | 18 × 40 px mit Oberlicht |
| Sockel | 8 px |
| Durchfahrt | lichte Höhe 3,2 m |

## Linie

- **Umriss `#2a1d1a`**, 1 px: am Fuß der Wand, an ihrer Oberkante (Traufe und Ortgang), an echten Hausecken (Knick über 25°), an der Traufe des Dachs.
- **Strich um Öffnungen**: dieselbe Farbe, zu einem Viertel in die Wandfarbe gemischt (im Hof zur Hälfte). So bleibt der Hausumriss die stärkste Linie.
- Keine Verläufe, kein Rauschen. Putz ist eine Fläche. Klinker zeigt einzelne Lagen, Ziegel zeigen Reihen.

## Farbe

Wandfarben (Putz): Cremeweiß `#efe2c4`, Sand `#e3cf9f`, Ocker `#d9b56e`, Altrosa `#d9a79a`, Salbei `#b5c2a0`, Taubenblau `#9fb1c4`, Hellgrau `#d8d4cc`, Elfenbein `#f1e9d6`, Lachs `#dfae8c`.
Klinker: Klinkerrot `#a84a32`, Gelbklinker `#c9a468`. Nebengebäude: Graubraun `#b9a48f`, Putzgrau `#c4bdb0`, Backstein `#a8684f`.
Dach: Ziegelrot `#b9553a`, Ziegel dunkel `#a24a35`, Ziegel hell `#c46544`, Braun `#8f5b45`, Schiefer `#565b68`. Flachdach: Bitumen `#5d5a57`, Kies `#8f8b86`.
Fest: Papierweiß `#f7efdc` (Fensterrahmen), Glas `#3c495e`, Glanz `#72879f`, Vorhang `#ded9c7`.
Türen, Ladenschilder, Markisen: Dunkelgrün, Ochsenblut, Marine, Ocker, Anthrazit.

Regeln:

- Jede Farbe folgt aus der Kennung des Hauses (`oid`). Gleiche Daten, gleiche Straße.
- Ein Haus trägt nie die Wandfarbe eines Nachbarn, mit dem es eine Wand teilt.
- Etwa ein Fünftel der Wohnhäuser ist Klinker. Schulen sind cremeweiß mit ziegelrotem Dach.
- Je Material genau eine Schattenstufe (Sockel, Laibung) und eine Schmuckfarbe: auf farbigen Wänden hell, auf blassen Wänden eine Stufe dunkler.

## Licht

- Drei Stufen je nach Seite zur Sonne: Licht 100 %, Streiflicht 89 %, Schatten 76 % und etwas kühler. Dächer 100 / 90 / 78 %.
- Die Stärke folgt der Sonne des Umweltmoduls. Unter Wolken und nachts stehen alle Seiten gleich bei 90 %; die Farbstimmung der ganzen Szene macht den Rest.
- Ein Wechsel von Uhrzeit oder Wetter ändert drei Zahlen. Es wird nichts neu gebaut.

## Bauteile und woher sie kommen

| Bauteil | Regel | Datenfeld |
|---|---|---|
| Grundriss | unverändert | ALKIS |
| Traufe | Höhe minus Dachgeschosse × 2,8 m; ein Geschoss höchstens 3,9 m | `hoehe_m`, `osm_roof_levels`, `osm_building_levels` |
| Dachform | Sattel, Walm, flach | `osm_roof_shape` |
| First | entlang der freien Fronten, quer zu den Brandwänden; an der Straße steht die Traufe zur Straße | geteilte Kanten, OSM-Straßen |
| Dachspanne | der Hauptbaukörper; Hofflügel bleiben flach auf Traufhöhe | Grundriss |
| Brandwand | Wand an einem Nachbarn: ohne Fenster, graueres Putzgrau | geteilte Kanten |
| Straßenfront | Wand, vor der in 7 m eine Straße liegt: Schmuck, Tür, Laden | OSM `highway` |
| Hoffront | alle übrigen freien Wände: schlichte Fenster | – |
| Laden | Schaufenster, Schild, bei knapp der Hälfte eine Markise; nur an der Straße | `funktion` enthält „Handel“ |
| Durchfahrt | echte Öffnung mit Tunnelwänden und Decke | ALKIS-Bauteil |
| Fensterschmuck | vier Arten je Haus: schlicht, Verdachung, Faschen, beides | `oid` |

Namen auf Ladenschildern gibt es nicht: Die Schilder tragen unlesbar kleine Zeichen. Echte Geschäftsnamen erscheinen nirgends.

## Ferne

Je kleiner ein Haus im Bild wird, desto mehr fällt weg: zuerst Striche, Sprossen und Schmuck (ab etwa einem Kunstpixel je Bildpunkt), dann die Fenster selbst (ab etwa fünf). Gesimse und Sockel bleiben länger. So flimmert in der Übersicht nichts.

## Für spätere Sprites

Wer Fassadenteile mit SpriteCook zeichnet, hält sich an: 16 px je Meter, Achse 27 px, Geschoss 49 px, Umriss `#2a1d1a`, Licht von links oben nur als eine Schattenstufe, Wandfarbe als Tauschfarbe (wie `teamColors` bei den Figuren), damit ein Blatt alle Putzfarben bedient.
