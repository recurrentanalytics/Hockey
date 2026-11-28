# Bäume durchs Jahr (2026-11-28)

Frühling, Herbst und Winter für Platane und Linde. Jedes Bild ist aus dem Sommerbaum erzeugt (`generate_game_art` mit `edit_asset_id` = Sommerbaum, Modell `gemini-nano-banana-2.1`, `pixel: true`, `smart_crop: false`, zwei Varianten), damit Stamm, Größe und Pixelraster gleich bleiben. Die Linde (Hochformat 84 × 128) braucht `aspect_ratio: "9:16"`; mit 1:1 kam sie in fremdem Raster zurück.

Gemeinsamer Rahmen jedes Auftrags (hier für die Platane; bei der Linde „linden tree“ und „the three round crowns“):

> The same pixel-art plane tree in [SEASON]. Keep the trunk, the branching, the size, the position in the frame, the dark outline and the pixel grid exactly as in the picture. […] Hard pixels, flat colours, light from the upper left. Transparent background, no ground, no shadow.

| Jahreszeit | Was sich ändert |
|---|---|
| Frühling | small fresh light yellow-green young leaves in the same crown shape, clearly sparser than in summer, so many dark branches show through |
| Herbst | Platane: golden yellow, orange and russet brown leaves, a little thinner. Linde: bright yellow and warm ochre heart-shaped leaves |
| Winter | completely bare: the crown is a web of dark brown branches and fine twigs that fills the same crown outline, with empty transparent gaps |

**Gewählt** (der Besitzer hat die Wahl am 2026-11-28 abgegeben: „süß und kohärent mit dem Rest“):

| Baum | Frühling | Herbst | Winter |
|---|---|---|---|
| Platane | Variante 2 | Variante 1 (einheitlich goldorange) | Variante 2 (kräftigere Äste) |
| Linde | Variante 1 (Form des Sommerbaums) | Variante 2 (gelb, neben der orangen Platane) | Variante 2 (kräftigere Äste) |

**Nachbearbeitung** (einmalig, vor dem Eintragen):
- auf den Rahmen des Sommerbaums gesetzt, Stammfuß auf Stammfuß;
- im Frühling die weißen Pixel entfernt (das Modell hatte den Himmel zwischen den jungen Blättern weiß gemalt);
- auf 20 Farben ohne Rasterung gebracht und die Kanten hart gestellt, wie bei den Sommerbäumen (die Ergebnisse hatten über 2000 Farben).

Die SpriteCook-IDs stehen je Bild im Manifest (`jahreszeiten.<zeit>.source`).
