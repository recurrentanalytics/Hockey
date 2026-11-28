# Der Bonifatiusplatz – Ortsanalyse für das Spiel

## Quellen
- **Luftbild (DOP20, 20 cm/Pixel) und Liegenschaftskarte (ALKIS):** © GeoBasis-DE / LGLN, Lizenz CC BY 4.0. Abgerufen über die offenen WMS-Dienste `opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms` und `…/alkis_wms`. Ausschnitte: `docs/ort/`.
- **Koordinaten:**
  - Bonifatiusschule: 52,38935 N / 9,74430 O
  - Comeniusschule: 52,38821 N / 9,74558 O
  - (beide aus den Geodaten von Wikimedia Commons)
- **Fotos:**
  - Trainingsfotos des Vereins: nur als Vorlage, nicht veröffentlicht, weil Kinder zu sehen sind.
  - Wikimedia Commons (Axel Hindemith, CC BY-SA 3.0).

## Anordnung
- **Form:** Der Platz ist eine lange, tropfenförmige Grünfläche in Nordwest–Südost-Richtung: im Nordwesten abgerundet, im Südosten breit an der Kollenrodtstraße.
- **Straßen:** Ringsum verläuft die Straße „Bonifatiusplatz“ mit Parkreihen.
- **Nordost:** Gründerzeit-Häuserzeile (4–5 Geschosse, rote Ziegeldächer, Gauben). Nördlich steht die **Bonifatiusschule** (großer Bau, rotes Dach).
- **Südwest:** die **Ricarda-Huch-Schule** und Wohnhäuser.
- **Südost:** jenseits der Kollenrodtstraße die **Comeniusschule** (historisch, Rundbogenfenster).
- **In der Grünfläche:** Rindenmulch, große Linden und Platanen, ein Kuppel-Klettergerüst, die Edelstahl-Schale (die glänzende Stelle im Luftbild), Drehkreisel, ein Sandkasten mit dem Holz-Nilpferd, ein Spielhaus mit rotem Dach, Bänke und ein kleines Häuschen mit rotem Dach am Südostende.
- **Bolzplatz (vom Verein bestätigt):** die Asphaltfläche **links neben der Edelstahl-Schale**, also nordwestlich davon. Die glänzende Stelle im Luftbild ist die Schale. **Links neben dem Bolzplatz** liegt der **Sandspielplatz mit der Holz-Nilpferd-Skulptur** (Klinker-Einfassung, Schaukel, Spielhaus mit rotem Dach). Reihenfolge von Nordwest nach Südost: Sandspielplatz mit Nilpferd, Bolzplatz, Schale, übriger Spielbereich, Häuschen mit rotem Dach. Ringsum steht ein hoher Stabmattenzaun mit Schrägstreben und eingebauten Stahl-Fußballtoren.

## Spielansicht
Die Kamera steht an der Südwest-Langseite des Bolzplatzes und schaut nach Nordosten. Von dort sieht man:
- vorn Bande und Spielfeld (vom Spiel selbst gezeichnet)
- dahinter den Zaun mit den Stahltoren
- Mulch und Linden
- die Straße mit Parkreihe
- die Häuserzeile, links die Bonifatiusschule
- links (Nordwest) hinter dem Zaun den Sandspielplatz mit Nilpferd, Schaukel und Spielhaus
- rechts (Südost) direkt am Zaun die Edelstahl-Schale und die Drehkreisel

Die Skizze `docs/ort/boni_skizze.png` (erzeugt von `tools/art/venue/boni_blockout.py`) legt diese Anordnung fest. Die Bild-KI zeichnet sie im Ligne-claire-Stil nach (`tools/art/venue/pollinations_edit.py`, Modell `microsoft/mai-image-2.7`, Beschreibung in `boni_backdrop_prompt.txt`).

## Grundriss Bolzplatz (aus dem Luftbild rekonstruiert, vom Verein in Lage und Form bestätigt)

Bild: `docs/ort/boni_bolzplatz_grundriss.jpg` (Luftbild © GeoBasis-DE / LGLN, CC BY 4.0).

- **Form:** Rechteck, eingezäunt. Die linke Seite folgt dem Rand der hellen Asphaltfläche (zum Nilpferd-Sandplatz), die untere Seite der Zaunlinie entlang der Hecke an der Straße, die obere Seite der Kante zur Straße mit den Parkplätzen.
- **Größe:** ca. 18 m (Seite oben) × 25 m (Seite links), Messgenauigkeit etwa ±1 m; im Winterbild verdecken Astschatten den Rand.
- **Ausrichtung:** Die Seiten sind um ca. 28° gegen die Nord-Süd- und Ost-West-Achse gedreht, also etwa parallel zu den umliegenden Straßen.
- **Ecken (WGS84, Breite/Länge):**
  - A Nord: 52.389138 / 9.744614
  - B Ost: 52.389062 / 9.744847
  - C Süd: 52.388862 / 9.744671
  - D West: 52.388939 / 9.744438
- **Umgebung:** links (Nordwest) der Sandspielplatz mit Holz-Nilpferd, rechts (Südost) hinter Mulchstreifen die Metallschale, oben die Straße mit Schrägparkern und Altbauten, unten links Hecke und Straße.

## Intro-Anflug

`intro.html` zeigt einen Kameraflug: aus 1,2 km Höhe über Hannover-List hinab auf den Boni, Drehung, bis der Platz quer liegt, und Abkippen in den Blickwinkel der Spielkamera (60° aus der Senkrechten, Boden 2:1 gestaucht wie `PROJ`). Am Ende erscheinen die Platzlinie, der Vereinsname und „Spiel starten“.

### Fotorealistisch: Google 3D über Cesium ion (`src/intro/photoreal.js`)

- **Daten:** „Google Photorealistic 3D Tiles“ (Cesium-ion-Asset 2275207), dargestellt mit CesiumJS 1.147.0 (vom CDN jsDelivr).
- **Zugang:** kostenloses Cesium-ion-Community-Konto des Vereins, 1.000 Sitzungen („Root Tiles“) im Monat, nur nicht-kommerziell. Das Google- und das Cesium-Logo müssen sichtbar bleiben; CesiumJS blendet sie ein.
- **Token:** einmalig `intro.html?token=<Cesium-ion-Token>` aufrufen; er wird im Browser gespeichert. Der Token ist im Spiel für jeden auslesbar, das ist bei Cesium so vorgesehen. Im Cesium-Konto unter „Access Tokens“ sollte er auf die Adresse des Spiels beschränkt werden („Allowed URLs“).
- **Ohne Token** oder wenn das Laden scheitert, läuft die Luftbild-Version unten.
- **Bekannte Eigenheit:** Im Google-Modell überdecken die Baumkronen den Platz großteils. Das Spiel zeichnet Feld, Banden und Tore ohnehin selbst über diese Stelle.
- **Vorschauvideo in der Entwicklungsumgebung:** `CESIUM_DIR=<node_modules/cesium/Build/Cesium> node tools/intro/record.cjs <ordner> 960 540 20 proxy` (der Token kommt dort vom Netzwerk-Proxy).
- **Echte Schatten:** `tools/intro/shadow_casters.py` baut aus dem amtlichen Höhenmodell (DOM1 minus DGM1, ALKIS-Gebäude, LGLN CC BY 4.0) eine weichgezeichnete Kronen- und Dachhöhenkarte im Umkreis von 46 m: `assets/intro/boni_schatten_hoehen.png` (rot: Höhe in 0,2-m-Stufen, grün: Dach). Boden, Zaun und Tore verfolgen pro Pixel den Strahl zur Sonne durch diese Karte (`TREE_LIGHT` in `src/intro/environment.js`). Dächer blockieren ganz. Kronen lassen Licht durch ihre Lücken (Lichtflecken, Rauschtextur `laub.png`), an dünnen Kronenrändern mehr. Pfosten und Rahmen werfen zusätzlich Schatten über Cesiums Schattenkarte, Netze und Maschendraht nicht. Das Spiel liest dieselbe Karte, um zu entscheiden, ob eine Figur in der Sonne steht.
- **Jahreszeiten** (`season()` in `environment.js`): Laub treibt Mitte April bis Mai aus und fällt Mitte Oktober bis Mitte November. Danach lassen die Kronen fast alles Licht durch. Im Herbst färben sich die Google-Bäume Baum für Baum gelb, orange und braun, und Laub liegt auf dem Platz. Im Winter werden die Kronen grau-braun und rund um den Platz ausgedünnt. Darunter liegt dann das amtliche Luftbild als Boden (`boni_schatten_luftboden.glb`, 1,5 m unter dem Platz), weil das Google-Modell unter Kronen keinen Boden hat. Im Wetter-Menü lassen sich unter „Wählen“ die Jahreszeiten einstellen; „Damals“ und „Live“ nehmen das echte Datum.
  Neu erzeugen: `python3 tools/intro/shadow_casters.py hoehe.png gebaeude.png assets/intro/boni_schatten.glb luftbild.jpg` (Rasterbilder aus dem LGLN-WMS wie bei `boni_hoehe.png`, Luftbild DOP20 im selben Ausschnitt).
- **Wetter und Spielphysik** (`src/game/surface.js`): Wetter, Temperatur, Laub und Wind verändern das Fahren und den Ball. Nasser Platz: wenig Grip in Kurven, langer Bremsweg, Ausrutscher bei harten Wenden, der Ball rollt zäh und springt kaum. Schnee: langsam und glatt, der Ball bleibt fast liegen. Frost oder Glätte: kaum Bremswirkung. Kälte: harte Rollen, der Ball springt mehr. Hitze: viel Grip, aber die Spieler werden schnell müde. Laub macht rutschig, nasses Laub besonders. Wind treibt den Ball vor allem in der Luft, durch die Bäume gebremst. Live und „Damals“ nutzen die echten Werte von Open-Meteo (Temperatur, Wind, Niederschlag). Unter „Wählen“ lassen sich Temperatur und Wind einstellen. Oben links zeigt das Spiel den Platzzustand an.

### Rückfallebene: Luftbild-Version (`src/intro/aerial.js`)

Die ganze Umgebung ist echtes 3D, gebaut nur aus freien amtlichen Daten des LGLN (CC BY 4.0):

| Datei | Quelle | Inhalt |
|---|---|---|
| `assets/intro/boni_umgebung.jpg` | DOP20 (`dop_wms`, `ni_dop20`) | Luftbild 1,2 × 1,2 km, 0,5 m/Pixel |
| `assets/intro/boni_park.jpg` | DOP20 | Referenz-Luftbild des Viertels, 2× vergrößert |
| `assets/intro/boni_platz.jpg` | DOP20 | Platzumgebung, 4× vergrößert |
| `assets/intro/boni_hoehe.png` | DOM1 und DGM1 (`dom_wms`, `dgm_wms`, Farbskala) | Höhe über Grund, 1 m Raster, 0,15 m je Stufe |
| `assets/intro/boni_gebaeude.png` | ALKIS (`alkis_wms`) | Gebäudegrundrisse, 1 m Raster |

- **Glättung des Luftbilds:** `tools/intro/enhance.py` (OpenCV): Entrauschen (entfernt JPEG-Blöcke), Lanczos-Vergrößerung, kantenerhaltende Glättung, leichtes Nachschärfen. Es wird nichts erfunden, nur interpoliert.
- **Höhen:** `tools/intro/height.py` liest die Farbskala des DOM-Kartendienstes zurück in Meter (Kalibrierung: Firsthöhe der Gründerzeitblöcke ≈ 21 m, Genauigkeit etwa ±0,5 m je Punkt, Maßstab ±15 %). Der eingezäunte Platz wird eingeebnet, denn im Sommer-Oberflächenmodell hängen Baumkronen darüber.
- **Häuser und Bäume:** `tools/intro/buildings.py` macht aus der Liegenschaftskarte eine Gebäudemaske. Hauswände bekommen Putz- oder Klinkerfarben mit Fensterreihen (das Luftbild zeigt nur Dächer), Baumkronen werden als Laub schattiert (das Luftbild ist eine Winteraufnahme).
- **Sichtlinie:** Zwischen Kamera und vorderem Zaun versinken Bäume und Häuser, die höher als die Sichtlinie auf den Platz wären. Im Luftbild bleiben sie sichtbar.
- **Darstellung:** WebGL2, Gitter mit 1 m (Viertel) und 4 m (Umgebung) Maschenweite, Mipmaps, anisotrope Filterung, Tiefenpuffer, leichter Dunst (`src/intro/intro.js`).
- **Vorschauvideo:** `node tools/intro/record.cjs <ordner> 960 540 25` (Playwright und ffmpeg).
- **Grenzen:** Die Daten haben 1 m (Höhe) und 20 cm (Bild) Auflösung. Aus der Nähe wirken Baumkronen wie weiche Wände, Dachkanten sind leicht abgerundet, und das Luftbild ist nicht entzerrt (hohe Dächer liegen etwas versetzt).

## Ortsdaten reproduzierbar neu erzeugen

Alle Rohdaten lassen sich mit einem Skript neu laden. Sie werden nicht eingecheckt (Ordner `daten/`, siehe `.gitignore`).

```sh
python3 tools/ort/abrufen.py tools/ort/boni.json daten/boni          # LGLN-WMS + Asphaltfoto, ca. 1 Minute
python3 tools/intro/shadow_casters.py daten/boni/hoehe.png daten/boni/gebaeude.png \
        assets/intro/boni_schatten.glb daten/boni/luftbild.jpg      # Kronenkarte, Luftbild-Boden
python3 tools/intro/court_glb.py daten/boni/clean_asphalt_diff_2k.jpg \
        assets/intro/boni_platz.glb assets/intro/boni_boden.glb daten/boni/flecken.png   # Platzmodell
```

Benötigt: Python 3 mit numpy, Pillow, opencv-python.

| Quelle | Dienst / Adresse | Layer | Lizenz |
|---|---|---|---|
| Digitales Oberflächenmodell DOM1 (Farbskala) | `opendata.lgln.niedersachsen.de/doorman/noauth/dom_wms` | `ni_dom1_farbe` | © GeoBasis-DE / LGLN, CC BY 4.0 |
| Digitales Geländemodell DGM1 (Farbskala) | `…/dgm_wms` | `ni_dgm1_farbe` | © GeoBasis-DE / LGLN, CC BY 4.0 |
| Liegenschaftskarte ALKIS (Farbe) | `…/alkis_wms` | `ALKIS` | © GeoBasis-DE / LGLN, CC BY 4.0 |
| Digitales Orthophoto DOP20 | `…/dop_wms` | `ni_dop20` | © GeoBasis-DE / LGLN, CC BY 4.0 |
| Asphaltfoto „clean_asphalt“ | Poly Haven | – | CC0 |

Der Ausschnitt (1224 × 1226 m um den Platz, UTM 32 / EPSG:25832) und das Pixelraster der Werkzeuge stehen in `tools/ort/boni.json`. Den Ursprung des Rasters habe ich aus den vier Platzecken zurückgerechnet. Die vier Ecken ergeben ihn übereinstimmend auf etwa 0,2 m genau.

**Prüfung am 27. November 2026** (Neuabruf gegen die Dateien im Spiel):

| Ergebnis | Übereinstimmung |
|---|---|
| Platzmodell `boni_platz.glb`, Boden `boni_boden.glb` | bitgleich |
| Höhenumrechnung (aus den damaligen Rohdaten) | bitgleich |
| Kronenkarte um den Platz (±46 m) | im Mittel 0,32 m Abweichung, 98 % der Zellen gleich belegt, Dächer IoU 0,87 |
| Gebäudemaske (aus der damaligen Karte) | IoU 0,96; die damaligen Handschritte sind nicht überliefert |

Die Kronenkarte ist nicht bitgleich, weil der LGLN-Dienst das 1-m-Raster bei jedem Abruf leicht anders auf Pixel umrechnet. An Kronen- und Dachkanten wirkt sich das stark aus, am Platz selbst kaum. Die Dateien im Spiel bleiben unverändert. Wer sie neu erzeugt, bekommt einen gleichwertigen, nicht identischen Stand. Abhilfe für später: den Ausschnitt auf das 1-m-Raster des LGLN ausrichten (ganze Meter in UTM), damit Pixel und Rasterzellen deckungsgleich sind.


## Vektor-Geodaten (Grundrisse, Wege, Platz)

Neben den Rasterbildern oben gibt es den Boni jetzt als Vektordatensatz in `locations/boni/geo/`: amtliche Gebäudegrundrisse und Nutzungsflächen (ALKIS-WFS des LGLN, CC BY 4.0), dazu Wege, Flächen, Bäume, Zäune und Ausstattung aus OpenStreetMap (ODbL), alles in ETRS89 / UTM 32N und mit dem Platzrahmen (Achsen a und b wie in `shadow_casters.py`). Quellen, Lizenzen, Prüfergebnisse und die Liste dessen, was fehlt oder unsicher ist, stehen in `locations/boni/geo/README.md`; die Datei wird mit erzeugt.

```sh
python3 tools/ort/geodaten.py abrufen tools/ort/boni.json   # Rohdaten neu laden (Netz), nach locations/boni/geo/roh/
python3 tools/ort/geodaten.py bauen   tools/ort/boni.json   # Ebenen, Rahmen, Prüfung und Bericht aus den Rohdaten
python3 tools/ort/geodaten.py pruefen tools/ort/boni.json   # Neubau im Speicher, Vergleich mit den Dateien
python3 serve.py                                            # Ansicht: http://localhost:8000/tools/ort/ansicht.html
```

- Die Rohdaten sind eingecheckt (gepackt, 180 KB), damit `bauen` ohne Netz dasselbe Ergebnis liefert. `abrufen` holt einen neuen Stand; danach ändern sich die Ebenen.
- Der Ausschnitt ist ein Quadrat um die Platzmitte (`geodaten.halbe_seite_m` in `tools/ort/boni.json`, derzeit 200 m). Für Nachbarblöcke den Wert vergrößern.
- Die Ansicht legt die Ebenen auf Wunsch über das Luftbild oder die Liegenschaftskarte des LGLN und rechnet den Zeiger in Platzmeter um. Bilder: `docs/ort/boni_geodaten_ansicht.jpg`, `docs/ort/boni_geodaten_luftbild.jpg` (Luftbild © GeoBasis-DE / LGLN, CC BY 4.0).
- Das Spiel liest diese Daten noch nicht. Sie sind die Grundlage für die Welt um den Platz.

## Weltansicht (`welt.html`)

Der Boni als begehbare 3D-Ansicht aus den Vektor-Geodaten, im selben 3D-Unterbau wie das Intro (CesiumJS):

```sh
python3 serve.py      # dann http://localhost:8000/welt.html   (?sicht=oben|schraeg|spiel|platz)
```

- **Boden:** das amtliche Luftbild DOP20, live aus dem WMS des LGLN (3 km um den Platz), auf dem Ellipsoid.
- **Gebäude:** die ALKIS-Grundrisse als Volumen. Die Höhe kommt aus `hoehe_m` (OSM-Höhe oder Schätzung aus Geschossen); Grundrisse ohne Angabe stehen heller und 10 m hoch, Durchfahrten und Arkaden 4 m.
- **Flächen und Wege:** ALKIS-Nutzung halb durchsichtig über dem Luftbild, OSM-Wege als Linien, Zäune und Mauern als 1,4 m hohe Wände.
- **Bäume:** an ihrer OSM-Position, als Kegel mit angenommener Größe (9 m hoch, 3 m Kronenradius). Die Größe steht nicht in den Daten.
- **Bolzplatz:** Zaunlinie, Ecken A–D und die Achsen a (gelb) und b (blau).
- **Kamera:** frei drehen, zoomen, kippen; Knöpfe für Schrägblick, Draufsicht, Platz und die Spielkamera (Richtung 118,2°, 60° aus der Senkrechten).
- **Zeiger und Klick:** Position in UTM und Platzmetern, Eigenschaften des angeklickten Objekts.
- **Google-3D-Kacheln:** zuschaltbar, wenn auf dem Gerät der Cesium-Token des Vereins gespeichert ist (wie im Intro). Dann stehen die Grundrisse halb durchsichtig auf der gemessenen Bodenhöhe der Kacheln. Dieser Teil ist ohne Token geschrieben und noch nicht ausprobiert.
- **Gelände:** keins. Ohne die Google-Kacheln ist die Welt eben.

Bilder: `docs/ort/boni_welt_schraeg.jpg`, `boni_welt_platz.jpg`, `boni_welt_spielkamera.jpg` (Luftbild © GeoBasis-DE / LGLN, CC BY 4.0). Die Koordinaten rechnet `src/welt/utm.js` um; ein Test hält sie mit `tools/ort/utm.py` gleich.

## Bäume, Schatten und Losfahren (`src/welt/baeume.js`, `src/welt/spieler.js`)

In `welt.html` steht auf jedem in OSM kartierten Baumstandort ein Baum aus Stamm und Krone mit Bodenschatten; mit „Losfahren“ steuert man den Spieler aus der Art-Bibliothek hindurch (Pfeiltasten oder WASD, oder auf den Boden tippen; die Kamera folgt im Blickwinkel des Spiels).

- **Standort:** die Punkte aus `locations/boni/geo/baeume.geojson`, unverändert.
- **Abgeleitete Bäume:** OSM kennt am Platz nur einen Teil der Bäume (11 von grob 36 Kronen im vermessenen Bereich). Jeder Kronengipfel der Höhenkarte ab 7 m, der keinen kartierten Baum im Umkreis von 5 m hat und nicht über dem Bolzplatz liegt, wird deshalb ein weiterer Baum (`standort: 'abgeleitet'`, Kennung `dom/<a>_<b>`, derzeit 32). Sein Stamm steht am Gipfel der Krone, also nur ungefähr richtig. Außerhalb der Höhenkarte (46 m um den Platz) gibt es weiter nur die kartierten Bäume.
- **Fotografierte Bäume:** Unter jeder gezeichneten Krone ersetzt der Pixel-Boden das Foto durch den Bodenton, der direkt außerhalb der Krone liegt, damit kein Baum unter dem Baum liegt (`pixelboden.js`). Außerhalb des Pixel-Bodens und in den Google-3D-Kacheln bleiben die echten Bäume sichtbar.
- **Größe:** wo die Kronenhöhenkarte des amtlichen Oberflächenmodells reicht (`assets/intro/boni_schatten_hoehen.png`, ±46 m um den Platz), die dort gemessene Kronenhöhe; sonst 9 bis 16 m, festgelegt über die OSM-Kennung des Baums. Kronenradius 0,32 × Höhe (2 bis 6,5 m), Stammradius 0,035 × Höhe.
- **Art:** OSM kennt hier nur „Laubbaum“. Solange das so ist, wird jedem Baum über seine Kennung eine der Baumarten der Art-Bibliothek zugeteilt (derzeit Platane und Linde) und er wird gespiegelt oder nicht. Gleiche Daten ergeben immer denselben Hain.
- **Stamm und Krone:** aus einem Sprite, geteilt an der Zeile, in der der Umriss breiter als der Stamm wird. Ohne freigegebenes Baum-Sprite stehen dort ein schlichter Stamm und eine Kugel in derselben Größe.
- **Licht:** eine Sonne für alles (`LICHT`: aus 73°, 45° hoch), so gewählt, dass das Licht in der Spielkamera von links oben kommt wie in den Sprites.
- **Schatten und Luftbild:** Im Luftbild sind die Schlagschatten der echten Bäume schon enthalten. Solange das Luftbild der Boden ist, zeichnet das System deshalb nur einen Kontaktschatten unter der Krone. Den vollen Schlagschatten nach `LICHT` gibt es, wenn der Boden gezeichnet ist (Luftbild aus).
- **Kollision:** Kreis aus Stammradius plus 0,35 m Wurzelanlauf; der Spieler gleitet daran entlang.
- **Tiefe und Verdeckung:** Die 3D-Ansicht sortiert Stamm, Krone und Spieler nach ihrer Lage. Steht der Spieler aus Sicht der Kamera hinter einer Krone, wird nur diese Krone durchscheinend; der Stamm bleibt.
- **Noch nicht:** Häuser und Zäune halten den Spieler nicht auf. Art, Kronenform und Stammumfang sind keine Messwerte. Der Sonnenstand des Luftbilds ist nicht ausgewertet.

Bilder: `docs/art/set/welt-fahren.jpg`, `docs/art/set/welt-hinter-baum.jpg`.

## Pixel-Boden: vom Luftbild zur Pixelart (`src/welt/pixelboden.js`)

Rund um den Bolzplatz wird das Luftbild selbst zu Pixelart; das Viertel außen bleibt das unveränderte Foto. Schalter „Pixel-Boden um den Platz“ in `welt.html`.

- **Quelle:** dasselbe DOP20, einmal für 260 × 260 m um die Platzmitte geholt und mit seiner eigenen Georeferenz wieder auf den Boden gelegt. Nichts wird verschoben oder verzerrt.
- **Pixelraster:** fest in der Welt, 0,25 m je Pixel, ohne Glättung dargestellt. Es wandert nicht mit der Kamera.
- **Kantenvereinfachung:** leichte Glättung vor der Farbreduktion, damit Kleinteiliges (Äste, Rauschen) zu Flächen wird.
- **Palette und Dithering:** die warme Palette des Art-Standards (17 Farben) mit geordnetem 4×4-Raster zwischen benachbarten Tönen.
- **Umrisse:** dunkle Linie nur entlang echter, kartierter Kanten: Zaun des Bolzplatzes, Umriss des Spielplatzes (OSM), Wegeflächen (ALKIS), und nur dort, wo der Stil schon überwiegt.
- **Platzboden:** innerhalb des Zauns nur Asphalttöne; Hell und Dunkel des Fotos bleiben, Farbrauschen nicht. Darauf die echten Markierungen, wie sie für das Platzmodell des Intros aus den Vereinsfotos rekonstruiert wurden (weißer Rahmen 0,5 m innerhalb des Zauns, Mittellinie, Mittelkreis 3 m, Bögen 6 m vor den Toren).
- **Maske:** volle Pixelart bis 6 m um den Zaun, dann weich abnehmend bis 26 m, auf der Spielplatzfläche bis 62 m. Der Übergang ist selbst gerastert (2×2-Pixel-Punkte lösen sich ins Foto auf), es gibt keine gerade Kante und kein Rechteck.
- **Grenzen:** Das Luftbild ist eine Winteraufnahme; Grün entsteht nicht, wo das Foto keins hat. Mit den Google-3D-Kacheln ist der Pixel-Boden nicht zu sehen (die Kacheln ersetzen den Boden). Häuser sind weiter schlichte Volumen, Straßen und Autos außerhalb der Maske unverändert Foto.

Bilder: `docs/ort/boni_hybrid_platz.jpg`, `docs/ort/boni_hybrid_viertel.png` (Luftbild © GeoBasis-DE / LGLN, CC BY 4.0).

## Das Viertel befahren und ein Spiel starten (`src/welt/hindernisse.js`)

`welt.html` → „Losfahren“: Der Spieler startet auf dem Bolzplatz und fährt durch das echte Viertel (Pfeiltasten oder WASD, am Handy auf den Boden tippen). Auf dem Platz erscheint „Spiel starten“: mit gespeichertem Cesium-Token das Spiel auf dem echten Platz in 3D, dort wo das Intro endet (`intro.html?quick`), sonst das Spiel auf dem schlichten Testplatz (`test.html`), jeweils 3 gegen 3.

- **Tempo:** 5,5 m/s, alle Maße in echten Metern.
- **Hauswände:** jeder ALKIS-Grundriss samt Innenhöfen. Durchfahrten und Arkaden (ALKIS „Bauteil“) bleiben offen und sind ab 3,2 m Höhe gezeichnet, darunter fährt man durch.
- **Mauern, Zäune, Hecken:** die in OSM kartierten Linien. An jedem kartierten Tor bleibt eine 3 m breite Öffnung.
- **Zaun des Bolzplatzes:** zu sehen ist das Platzmodell des Intros (`assets/intro/boni_platz.glb`: Doppelstabzaun, Fußballtore in den Stirnseiten, rote Streethockey-Tore), auf demselben Zaunrechteck wie im Intro. Aufgehalten wird man an den vier Seiten zwischen den Ecken. **Die Eingänge sind angenommen** (Mitte der beiden langen Seiten, je 3 m; die Stirnseiten tragen die Tore); wo sie wirklich liegen, steht weder in einem Datensatz noch im Modell (`PLATZ_EINGAENGE`). Dort fährt man durch den gezeichneten Zaun.
- **Bäume:** wie zuvor, Stamm mit Wurzelanlauf.
- **Tiefe:** Häuser, Bäume und Spieler verdecken sich nach ihrer Lage. Häuser und Kronen, die aus Sicht der Spielkamera vor dem Spieler stehen, werden durchscheinend, solange er dahinter ist.
- **Ausschnitt:** alles im Datensatz (400 × 400 m): Platz, Park und die Blöcke ringsum. Außerhalb gibt es weder Wände noch Grenze.
- **Noch nicht:** Der Rückweg aus dem Hockeyspiel in die Welt, Türen und Hauseingänge, parkende Autos, andere Figuren. Die Zäune um den Sandspielplatz und die Schale fehlen in den Daten und halten deshalb niemanden auf.

Bild: `docs/ort/boni_viertel_strasse.jpg`.

Bild mit dem Platzmodell des Intros in der Weltansicht: `docs/ort/boni_welt_introplatz.jpg`.

**Eigene Kopie des Luftbilds (`src/welt/luftbild.js`):** Die Welt steht auf `assets/welt/boni_umgebung.jpg` (DOP20 des LGLN, 1,2 × 1,2 km um den Platz, 0,5 m je Pixel; es ist das Luftbild der früheren Intro-Fassung, aus der Git-Historie zurückgeholt; Ausdehnung in `boni_umgebung.json`). Auch der Pixel-Boden wird daraus gerechnet. Der Live-Dienst des LGLN liegt als zuschaltbare Ebene darüber (0,2 m, schärfer) und schaltet sich nach sechs Fehlern selbst ab. Anlass: Am 27.11.2026 antwortete der ganze LGLN-Server zeitweise mit „Dienst nicht verfügbar“, und die Welt stand ohne Boden da. Seitdem hängt sie für den Boden an keinem fremden Dienst mehr; nur CesiumJS kommt weiter vom CDN.

## Eine Szene: Viertel und Spiel ohne Seitenwechsel

Seit Stand 14 läuft das Hockeyspiel in `welt.html` selbst, über derselben Welt (Platzmodell, Pixel-Boden, Bäume, Häuser):

- **Betreten:** Auf dem Platz „Spiel starten“. Die Kamera geht in die feste Spielkamera des Intro-Endes (118,2°, 60° aus der Senkrechten, 20° Bildwinkel, der Platz füllt die Breite). Das Spiel zeichnet seine Figuren wie am Intro-Ende durch diese Kamera auf eine durchsichtige Ebene (`globalThis.BONI_3D.toCss`). Bäume und Häuser zwischen Kamera und Platz werden für die Dauer des Spiels durchscheinend.
- **Verlassen:** „◀ Platz verlassen“ legt das Spiel schlafen (`BONI_3D.pausiert`, eine Zeile in `src/main.js`), blendet es aus und gibt den Spieler im Viertel wieder frei. Beim nächsten Betreten läuft dasselbe Spiel weiter.
- **Intro:** Am Ende von `intro.html` steht unter „Spiel starten“ der Verweis „Viertel erkunden“ (`welt.html?sicht=fahren`). Das ist ein Seitenwechsel: Intro und Welt sind noch zwei getrennte 3D-Szenen.
- **Licht und Wetter (seit Stand 15):** Die Welt benutzt das Umgebungsmodul des Intros unverändert (`src/intro/environment.js`): Live-Wetter von Open-Meteo oder von Hand gewählt, Uhrzeit, Jahreszeit; Farbstimmung der ganzen Ansicht, Regen und Schnee über allem, dasselbe Wetterfeld (⛅ neben der Tafel). Von dort weitergereicht wie im Intro: der Belag für die Spielphysik (`src/game/surface.js`: nass, Laub, Frost, Wind), der Sonnenschatten der Figuren und ihr Baumschatten per Strahl durch die Kronenhöhenkarte (`BONI_3D.shadow`), dazu Richtung und Tiefe der Baumschatten der Welt.
- **Noch nicht aus dem Intro übernommen:** die Lichtflecken unter den Bäumen auf dem Platzboden und am Zaun (das sind Shader auf dem Bodenmodell und den Google-Kacheln des Intros; in der Welt liegt der Pixel-Boden), Laub auf dem Boden, Laternen bei Nacht, herbstlich gefärbte und ausgedünnte Bäume.

Bild: `docs/ort/boni_welt_spiel.jpg`.

Bild bei gewähltem Regen am Herbstabend: `docs/ort/boni_welt_regen.jpg`.

## Anflug in der Welt (`src/welt/anflug.js`)

`welt.html` beginnt seit Stand 16 mit einem Anflug in derselben Szene, in der man danach fährt und spielt: vom ganzen Planeten über Deutschland (Umriss) und Hannover hinab auf den Boni, mit den sechs Sätzen und den Sprachaufnahmen des Intros, Landung in der Spielkamera. Dort stehen Logo, „Losfahren“ und „Spiel starten“. Mit `?sicht=…` oder `?ohneanflug` startet die Welt ohne Anflug; jede Taste oder „Überspringen“ springt zur Landung.

- **Planet:** das Natural-Earth-Bild, das CesiumJS mitbringt. Kein Konto, kein Token.
- **Lücke in der Mitte:** Zwischen rund 100 km und 1 km Höhe gibt es außer der Luftbild-Kopie (1,2 km) kein Bild der Stadt; der Platz erscheint dort als kleines Quadrat auf einfarbigem Grund. Das Intro (`intro.html`) fliegt an dieser Stelle durch die Google-3D-Kacheln und sieht deshalb anders aus.
- **Das Intro bleibt** unverändert als eigene Seite bestehen.

Bilder: `docs/ort/boni_anflug_land.jpg`, `docs/ort/boni_anflug_landung.jpg`.

## Stand 2026-11-28: eine Seite für alles

- **`welt.html` ist die Startseite** (Web-App und Android-App): Anflug → Landung auf dem Platz → Losfahren oder Spiel starten, Platz verlassen und wieder betreten, alles in einer Szene.
- **Normalfall:** SpriteCook-Fassaden für alle Häuser, gezeichneter Boden im Viertel, Straßenmöbel, Bäume, Pixel-Boden am Platz, Wetter. Die schlichten Blöcke gibt es nur noch mit `?haeuser=alt`.
- **Entfernt:** `intro.html` mit `src/intro/main.js` und `src/intro/photoreal.js`, dazu die nur dort benutzten `assets/intro/boni_boden.glb`, `boni_schatten_luftboden.glb` und `tools/intro/record.cjs`. Abschnitte oben über `intro.html` und `photoreal.js` beschreiben diesen früheren Stand.
- **Ohne Netz:** CesiumJS kommt vom CDN (in der Android-App aus der mitgelieferten Kopie). Lädt es nicht, startet nach kurzer Meldung die Hallen-Version.
- **Android-App:** Startadresse und Build-Skript zeigen auf `welt.html` (mit `locations/`); der Token wird mit der App geteilt. Die App ist damit nicht neu gebaut und nicht auf einem Gerät geprüft.

## Eingänge des Bolzplatzes (2026-11-28, vom Verein beschrieben)

Drei Türen, je 2 m breit, in Zaunmodell (`tools/intro/court_glb.py`, `DOORS`) und Kollision (`src/welt/hindernisse.js`, `PLATZ_EINGAENGE`) gleich:
- auf der Längsseite zum Holz-Nilpferd (A–D, b = −9) eine am rechten Ende, vom Nilpferd aus gesehen (a = +10,9);
- auf der gegenüberliegenden Längsseite (B–C, b = +9) je eine an beiden Enden (a = ±10,9).

Die genaue Lage am Ende (Abstand zur Ecke) ist geschätzt. `assets/intro/boni_platz.glb` ist dafür neu erzeugt; außer den Zaunteilen ist es mit dem vorigen Modell gleich (Tore, Netze, Texturen pixelgleich geprüft). Bild: `docs/ort/boni_platz_tueren.jpg`.

## Spiel direkt vom Platz, Bonny im Viertel (2026-11-28)

- **„Spiel starten“ auf dem Platz** führt ohne Titelbild und Menüs direkt zum Bully: Borstentiere gegen den Gegner aus der Auswahl am Knopf (gespeichert wie in den Spieleinstellungen), Regeln und Spielzeit aus den Einstellungen. `main.js` ruft dafür `BONI_3D.start(app)` statt den Titel zu zeigen.
- **„Platz verlassen“** lässt das Match stehen (Uhr steht); beim nächsten Betreten geht es weiter.
- **Schlusspfiff** oder **„Spiel beenden“** im Pausenmenü (dort statt „Zum Menü“) bringt dich zurück ins Viertel; das nächste Betreten startet ein neues Match.
- **Figur im Viertel:** Bonny (#61) im Borstentiere-Trikot, mit demselben Figurenrenderer wie auf dem Platz (`src/world/figures.js`, Laufschritt `stride0`–`stride7`, Stand `idleA`), 1,3 m groß. Der SpriteCook-Skater bleibt in der Art-Bibliothek, wird aber nicht mehr als Figur benutzt.
