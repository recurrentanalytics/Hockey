# Geodaten Bonifatiusplatz, Hannover-List

Erzeugt von `tools/ort/geodaten.py bauen` aus den Rohdaten in `roh/` (abgerufen am 2026-11-27). Nicht von Hand ändern.
Ansicht: `python3 serve.py`, dann http://localhost:8000/tools/ort/ansicht.html

## Koordinaten

- **System:** ETRS89 / UTM Zone 32N (EPSG:25832), Meter. Das ist das amtliche System in Niedersachsen; ALKIS kommt darin an, OSM wird aus WGS84 umgerechnet (`tools/ort/utm.py`). WGS84 und ETRS89 liegen rechnerisch einige Dezimeter auseinander; gemessen an den Gebäuden passt OSM hier aber ohne Verschiebung am besten auf die amtlichen Grundrisse (siehe Prüfung), deshalb wird nichts verschoben.
- **Ausschnitt:** Ost 550475–550875, Nord 5804366–5804766 (400 × 400 m um den Bolzplatz). Was den Ausschnitt berührt, bleibt ganz erhalten; nichts wird abgeschnitten.
- **Platzrahmen** (`rahmen.json`): Ursprung in der Platzmitte (550675.46 / 5804566.23), Achse a längs (Ecke A → D), Achse b quer (A → B). So rechnen auch `shadow_casters.py` und das Intro.
- **Maßstab:** Gitterstrecken sind um den Faktor 0.999632 kürzer als in der Natur (0,37 mm je Meter, 15 cm auf 400 m). Für das Spiel unerheblich, hier nur festgehalten.

## Ebenen

| Datei | Inhalt | Anzahl | Quelle |
|---|---|---|---|
| `gebaeude.geojson` | Gebäudegrundrisse mit Funktion, Adresse, Fläche; Höhe und Dach aus OSM angehängt | 265 | ALKIS (amtlich) |
| `nutzung.geojson` | Straßen- und Wegeflächen, Wohnflächen, Spielplatzfläche | 146 | ALKIS (amtlich) |
| `platz.geojson` | Zaun des Bolzplatzes, Ecken A–D, Achsen | 1 Platz | Verein, Luftbild |
| `wege.geojson` | Mittellinien von Straßen, Fußwegen, Treppen | 122 | OSM |
| `flaechen.geojson` | Spielplatz, Bolzplatz, Gärten, Schulhöfe, Parkplätze | 52 | OSM |
| `baeume.geojson` | Einzelbäume und Baumreihen | 84 | OSM |
| `einfriedungen.geojson` | Zäune, Mauern, Hecken, Tore, Poller | 10 | OSM |
| `ausstattung.geojson` | Spielgeräte, Bänke, Laternen, Läden | 272 | OSM |
| `osm_gebaeude.geojson` | OSM-Gebäude und Gebäudeteile, nur zum Abgleich | 255 | OSM |

Amtliche Nutzung: Fläche besonderer funktionaler Prägung / Bildung und Wissenschaft (3), Fläche besonderer funktionaler Prägung / Gesundheit, Kur (1), Fläche besonderer funktionaler Prägung / Religiöse Einrichtung (1), Industrie- und Gewerbefläche / Gebäude- und Freifläche Versorgungsanlage, Elektrizität (1), Industrie- und Gewerbefläche / Handel und Dienstleistung (4), Sport-, Freizeit- und Erholungsfläche / Spielplatz, Bolzplatz (1), Straßenverkehr (24), Straßenverkehr / Begleitfläche Straßenverkehr (12), Weg / Fußweg (47), Weg / Rad- und Fußweg (30), Wohnbaufläche (22).
Wege aus OSM: footway (52), residential (32), service (26), steps (9), tertiary (3).

## Quellen und Lizenzen

| Rohdatei | Stand der Quelle | Lizenz | Größe |
|---|---|---|---|
| `roh/alkis_gebaeude.gml.gz` | 2026-11-27T11:53:28.033+01:00 | © GeoBasis-DE / LGLN (2026), CC BY 4.0 | 281 KB |
| `roh/alkis_nutzung.gml.gz` | 2026-11-27T11:53:28.373+01:00 | © GeoBasis-DE / LGLN (2026), CC BY 4.0 | 150 KB |
| `roh/alkis_gebaeude_4258.gml.gz` | 2026-11-27T11:53:28.650+01:00 | © GeoBasis-DE / LGLN (2026), CC BY 4.0 | 317 KB |
| `roh/osm.json.gz` | 2026-11-27T10:53:12Z | © OpenStreetMap-Mitwirkende, ODbL 1.0 | 521 KB |

- **ALKIS:** offener WFS »ALKIS vereinfacht« des LGLN, `https://opendata.lgln.niedersachsen.de/doorman/noauth/alkis_wfs_einfach`.
- **OSM:** Overpass-Abfrage, Wortlaut in `roh/abruf.json`. Die ODbL verlangt Namensnennung und Weitergabe unter gleichen Bedingungen für die aus OSM abgeleiteten Ebenen; ALKIS-Ebenen und OSM-Ebenen liegen deshalb in getrennten Dateien. In `gebaeude.geojson` stammen nur die Felder `hoehe_m`, `hoehe_quelle` und `osm*` aus OSM.

## Prüfung (alles bestanden)

| Prüfung | Ergebnis | |
|---|---|---|
| Umrechnung UTM → Länge/Breite → UTM (nur für den Abruf-Ausschnitt gebraucht) | größter Fehler 0.716 mm | bestanden |
| Umrechnung gegen den LGLN-Dienst (dieselben Gebäude in EPSG:4258 und EPSG:25832) | 3454 Punkte, größte Abweichung 0.04 mm | bestanden |
| Platzseiten | AB 17.97 m, BC 25.27 m, CD 18.02 m, DA 25.17 m; erwartet 18.0 × 25.2 m | bestanden |
| Platzwinkel und Richtung | Innenwinkel A 90.36°, B 89.76°, C 89.92°, D 89.96°; Achse b (Blickrichtung des Spiels) 118.42° gegen Nord, im Spiel 118.2° | bestanden |
| Platz liegt in genau einer amtlichen Fläche | Sport-, Freizeit- und Erholungsfläche / Spielplatz, Bolzplatz | bestanden |
| Lage von OSM gegen ALKIS | 1973 OSM-Gebäudeecken: Median 0.164 m neben der amtlichen Kante, 90 % unter 0.992 m. Probe mit starrer Verschiebung (0,1-m-Raster bis ±0,3 m): bester Wert bei 0.0 / -0.1 m mit Median 0.152 m, also kein lohnender Versatz | bestanden |
| Bolzplatz in OSM (`way/179243848`) | Seiten 17.34, 17.33, 10.59, 10.58 m, Mittelpunkt 0.14 m neben der Platzmitte, Richtung 2.17° neben Achse a | nur Vergleich |

## Was fehlt oder unsicher ist

- **Zaunecken des Bolzplatzes:** aus dem Luftbild abgelesen und vom Verein bestätigt, etwa ±1 m. Die Innenwinkel weichen bis 0.4° vom rechten Winkel ab. Nicht vermessen.
- **Bolzplatz in OSM kleiner als der Zaun:** OSM zeichnet 17.34 × 10.59 m, der Verein 25.17 × 17.97 m. Maßgeblich bleiben die Ecken des Vereins; welche Linie OSM meint (Asphaltkante, Spielfeld), ist offen.
- **Bäume:** OSM kennt im Ausschnitt 84 Bäume und Baumreihen, davon 13 Einzelbäume im Umkreis von 60 m um die Platzmitte. Es sind Punkte mit leaf_type (82); Art, Stamm- und Kronenmaß fehlen, und ob jeder Baum des Platzes erfasst ist, ist nicht geprüft. Kronenhöhen gibt es nur als Raster aus dem amtlichen Oberflächenmodell (`assets/intro/boni_schatten_hoehen.png`, ±46 m um den Platz). Ein Baumkataster der Stadt habe ich nicht geprüft.
- **Zäune und Mauern:** OSM hat 10 Einträge (bollard 1, fence 2, gate 4, hedge 1, retaining_wall 2), davon 0 Linien näher als 30 m am Platz. Der Zaun des Bolzplatzes selbst und die Klinker-Einfassung des Sandspielplatzes sind nicht kartiert.
- **Spielgeräte:** als Punkte ohne Form und Größe (aerialrotator, climbingframe, playhouse, sandpit, swing, trampoline). Nilpferd, Edelstahl-Schale und Spielhaus sind nicht einzeln erkennbar benannt.
- **Gebäudehöhen:** 213 von 265 amtlichen Grundrissen haben eine Höhe, davon 21 als in OSM eingetragene Höhe; der Rest ist aus Geschosszahlen geschätzt (3,2 m je Geschoss, 2,8 m je Dachgeschoss, grob ±2 m). Das amtliche 3D-Gebäudemodell (LoD2) und das Höhenmodell als Zahlen sind noch nicht eingebunden.
- **Gelände:** nicht enthalten und hier nicht ausgewertet. Geländehöhen gibt es bisher nur als Farbskala aus dem LGLN-Kartendienst (`tools/ort/abrufen.py`), nicht als Zahlen.
- **Höfe und Durchfahrten:** ALKIS führt Durchfahrten und Arkaden als eigene Bauteile (`art` = Bauteil). Innenhöfe ergeben sich als Lücken zwischen den Grundrissen, nicht als eigene Flächen.
- **Aktualität:** ALKIS-Objekte tragen ihr Fortführungsdatum im Feld `stand`. Der OSM-Stand hängt vom antwortenden Spiegelserver ab und steht oben in der Quellentabelle.
- **Parkplätze, Bordsteine, Straßenmarkierungen:** nur als Flächen (ALKIS Straßenverkehr) und Mittellinien (OSM), nicht im Detail.
