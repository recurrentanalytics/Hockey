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
