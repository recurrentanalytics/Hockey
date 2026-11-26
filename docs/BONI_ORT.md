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
