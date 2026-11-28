# Welt-Sprites im Einheitsmaß (Kandidatenrunde 2026-11-28)

Ziel: Alle Sprites, die in der Weltansicht stehen, in der groben Pixelgröße der Häuser (12,5 Pixel je Meter, `assets/welt/massstab.json`) statt 52–85 (Straßenmöbel) oder 6 (Bäume).

Kandidaten: `art/candidates/2026-11-28-einheitlich/` (nicht in Git), Zuordnung Motiv → SpriteCook-Assets in `candidates.json`, Vergleichsbögen `bogen_klein.png` und `bogen_gross.png`.
Alle mit `pixel-engine-image-v1` (zeichnet exakt in der bestellten Größe, keine Referenzbilder), vier Varianten je Motiv, 6 Credits je Bild (216 Credits für die Runde).

Stil, an jeden Auftrag angehängt: „coarse pixel art, 1px warm dark brown outline, flat colours, one shade step, light from upper left“. Jeder Motivteil endet mit „No people, no ground, no shadow.“

| Motiv | Bestellt (Pixel) | Höhe in der Welt | Motivteil des Auftrags |
|---|---|---|---|
| Bank | 16×16 | 0,9 m | A single park bench as found in a German city: dark green cast-iron sides, three warm brown wooden slats for seat and backrest. Seen from the side with a slight top-down tilt. Tiny, very simple, readable silhouette. |
| Laterne | 16×56 | 4,5 m | A single tall street lamp of a German residential street: slim dark green cast-iron pole with a wider base, a classic lantern head with glass panes at the top. Side view. Very simple, readable silhouette. |
| Fahrradbügel | 16×16 | 0,85 m | A single bicycle stand on a German pavement: one bent steel tube shaped like an upside-down U, galvanised silver-grey. Side view with slight top-down tilt. No bicycle. Very simple, tiny. |
| Mülleimer | 16×16 | 1 m | A single public waste basket on a German city square: round metal bin with a small rain hood, on a short post, muted grey with a thin orange band. Side view with slight top-down tilt. Very simple, tiny. |
| Picknicktisch | 26×16 | 0,8 m | A single wooden picnic table with two attached benches on a German playground: thick warm ochre-brown planks, sturdy A-shaped legs, table top visible from a slight top-down tilt. Side view. Very simple. |
| Klettergerüst | 33×28 | 2,2 m | A single dome-shaped climbing frame on a German city playground: half-sphere of red and yellow metal bars with rope sections between them. Side view with slight top-down tilt. Simple readable shape. |
| Nilpferd | 24×16 | 1,1 m | A chunky wooden hippopotamus sculpture for a children's sandpit, standing, side view, wide open smiling mouth. Old weathered sun-bleached wood: faded silvery grey-beige with a hint of honey colour, a few grain lines and cracks, worn rounded edges. No paint. |
| Platane | 128×128 | 14 m | A single large old plane tree (Platane) of a German city square in summer: tall trunk with patchy grey, olive and cream bark, a broad rounded crown of fresh green leaves in a few large clumps. Side view. |
| Linde | 84×128 | 14 m | A single tall linden tree (Linde) of a German city street in summer: straight dark grey-brown trunk, a tall oval crown of green heart-shaped leaves in a few large clumps, narrower than wide. Side view. |

**Grenzen des Modells:** Es zeichnet zwischen 16 und 128 Pixeln.
- **Kleine Dinge sind etwas feiner als die Häuser.** Bank, Fahrradbügel, Mülleimer, Picknicktisch und Nilpferd liegen bei 15–20 Pixeln je Meter.
- **Die Bäume sind etwas gröber.** Sie liegen bei 9 Pixeln je Meter; 14 m wären 175 Pixel. Jeder Baum wird in der Welt ohnehin auf seine gemessene Höhe gestreckt.

## Auswahl (2026-11-28)

Der Besitzer hat bei jedem Motiv **Variante 3** gewählt: „so 20 Pixel ungefähr scheint ein Sweet Spot zu sein: süß, nicht ultra detailliert und dennoch sehr deutlich erkennbar.“

Die Assets ersetzen die bisherigen Bilder unter derselben Kennung (`assets/manifest.json`, `source.asset_id`). Die Vorgänger stehen in `strassenmoebel.md`, `set.md` und `pilot.md`.

| Motiv | Gewähltes Asset | Bildgröße | Pixel je Meter |
|---|---|---|---|
| Bank | `2d72a995-6cd2-4b7e-aef5-d199574ae1e8` | 16×16 | 17,8 |
| Laterne | `e60a2e4f-0bb0-4753-94a7-19c4a71f5127` | 16×56 | 12,4 |
| Fahrradbügel | `2e375b6d-4a3f-431e-9660-af8a11085591` | 16×16 | 18,8 |
| Mülleimer | `920c533a-d11b-4569-b9e6-322088b86786` | 10×16 | 16,0 |
| Picknicktisch | `f84c2e0a-7d0a-4f04-bdef-f7905256774e` | 26×16 | 20,0 |
| Klettergerüst | `50b351ba-5e73-40e0-8533-c7715a88e9b3` | 34×28 | 12,7 |
| Nilpferd | `87624903-5cbb-48be-8cb6-3d3ab989452e` | 24×16 | 14,5 |
| Platane | `ceeefc64-1a47-4214-992b-704ee6303e4a` | 128×128 | 9,1 |
| Linde | `7fe44e2c-0cfb-4311-b273-59cd83f3f475` | 84×128 | 9,1 |
