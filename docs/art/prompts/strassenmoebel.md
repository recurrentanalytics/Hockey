# Straßenmöbel und Spielplatz (Kandidatenrunde 2026-11-28)

Kandidaten: `art/candidates/2026-11-28-strassenmoebel/` (nicht in Git), Zuordnung Nummer → SpriteCook-Asset in `candidates.json`.
Alle: `gemini-nano-banana-2.1`, 1K, zwei Varianten je Motiv, 12 Credits je Bild (144 Credits für die Runde).
Stilreferenzen: gewählter Spieler `9eeb43be-a11b-4be0-82a3-27e9583b318f`, Bank `ecf548ac-8726-4846-b691-8d04914e6a8d`, Platane `5e75d280-01cf-4bb1-8d6b-5b3ec9196e83`.
Jeder Prompt endet mit „No people, no ground, no shadow, no background.“ und dem Stilblock aus `docs/art/README.md`, Abschnitt 2.

| Nr. | Motiv | Kartiert (`ausstattung.geojson`) | Größenhinweis | Motivteil des Prompts |
|---|---|---|---|---|
| 1, 2 | Straßenlaterne | `highway=street_lamp` (56) | 48×128 | A single tall street lamp as found in a residential street of a German city: slim dark green cast-iron pole with a decorative base, a classic lantern-shaped lamp head with four glass panes at the top … about three times as tall as him. |
| 3, 4 | Fahrradbügel | `amenity=bicycle_parking` (46) | 64×48 | A single bicycle stand as found on a German city pavement: one bent steel tube shaped like an upside-down U (a "Fahrradbügel"), galvanised silver-grey metal … about up to his hip. No bicycle. |
| 5, 6 | Mülleimer | `amenity=waste_basket` (26) | 48×64 | A single public waste basket as found on a German city square: a round metal bin with a small rain hood on top, mounted on a short post, painted in a muted grey with a thin orange band … about up to his waist. |
| 7, 8 | Picknicktisch | `leisure=picnic_table` (2) | 80×56 | A single wooden picnic table with two attached benches as found on a German playground: thick warm ochre-brown wooden planks, sturdy A-shaped legs … table top visible … about up to his hip. |
| 9, 10 | Klettergerüst (Kuppel) | `playground=climbingframe` (2) | 96×80 | A single dome-shaped climbing frame as found on a German city playground: a half-sphere net of red and yellow metal bars with rope sections … a little taller than him. |
| 11, 12 | Holz-Nilpferd | nicht kartiert; steht im Sandkasten neben dem Platz (`docs/BONI_ORT.md`) | 112×64 | A single large wooden hippopotamus sculpture as found in a sandpit on a German city playground: a friendly, chunky hippo carved from warm honey-coloured wood … about as tall as his shoulder and twice as long as he is tall. |

Vorbehalt: Bauform der Laternen und Farbe der Mülleimer in Hannover-List sind nicht geprüft, die Prompts beschreiben übliche Formen.
