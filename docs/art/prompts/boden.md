# Ground textures for the quarter (2026-11-28)

Generated through the SpriteCook MCP server from OpenCode, project "BORSTENBOOM". **Nothing here is approved**: the pictures lie in `assets/welt/boden/` beside the art library, described by `boden.json`, and the world shows them only with `?haeuser=neu` (layer "Gezeichneter Boden im Viertel").

All with `gemini-nano-banana-2.1`, `mode="texture"`, `pixel=true`, `bg_mode="include"`, `smart_crop=false`, `resolution="1K"`. The files are used exactly as they came back, one texture pixel for one ground pixel (12.5 per metre, 8 cm).

Head of every prompt:

> Seamless tileable top-down ground texture for a pixel art game, seen straight from above, filling the whole square image edge to edge with no border and no objects:

Closing style block:

> Clean pixel art in Franco-Belgian ligne claire comic style: flat warm colours with a single shade step, no outline round the image, no gradients, no dithering, no anti-aliasing, calm and low in contrast so that figures stand out on it.

| File | SpriteCook asset | Hint → result | Subject |
| --- | --- | --- | --- |
| `asphalt.png` | `98c2f3fd-1078-49d0-b6af-d37f5d45dd3f` | 64×64 → 100×100 | old street asphalt, flat warm dark grey with a few scattered single pixels slightly lighter and slightly darker, no lines, no cracks, no markings. |
| `rasen.png` | `09401dd3-f360-40ef-a942-74356bde8a61` | 64×64 → 204×176 | a mown lawn, flat mid green with small scattered tufts a touch lighter and a touch darker, no flowers, no paths. |
| `hof.png` | `965762e5-1c82-40fb-9362-43482b61e5f1` | 64×64 → 200×200 | the ground of a back yard: compacted grey-brown gravel, flat warm grey-beige with sparse small darker pebbles and a few lighter grains. |
| `platz.png` | `52850d99-4ea3-419c-838f-d43e52b23668` | 64×64 → 147×111 | the water-bound sandy surface of a city square: flat warm sand-beige with a few scattered small lighter and darker grains, no lines. |
| `gehweg.png` | `fa0f4a9e-04db-4620-aaf4-974ee6a63035` | 128×128, two variations → 90×78 | a city pavement of square light grey concrete slabs in a straight grid, about ten slabs across and ten slabs down. Every slab has a slightly different tone of warm light grey, a few carry a small stain or a chipped corner, so that no two slabs look alike. Thin joints, one pixel wide, a little darker than the slabs. |
| `kopfstein.png` | `e906de81-5862-4a6d-9802-593d76bafc48` | 128×128, two variations → 47×50 | an old street paved with granite setts in straight rows running left to right, about sixteen stones across and sixteen rows down. The stones differ a little in width and in tone, mid grey with warm and cool greys mixed, so that no two rows look alike. Thin joints, one pixel wide, darker than the stones. |

The kerb has no picture of its own: it is a line in the mean colour of `gehweg.png`, a little lighter.

## Not used

| Asset | Result | Why not |
| --- | --- | --- |
| `910290bd-f716-46d0-9d62-a9a057d6cf6a` | pavement, first prompt ("exactly eight slabs across … every slab 8 by 8 pixels"), 25×33 | cut down to a fragment of the pattern with a dark seam |
| `8f7773d1-47f9-47db-82d8-c637f389c1e4` | setts, first prompt ("exactly sixteen stones … 4 by 4 pixels"), 27×24 | the same |
| `09cd7655-ddf8-4eea-a45b-6a8987887caa` | pavement, second variation, 205×202 | slabs 20 pixels wide: 1.6 m on the ground |
| `27b3c39a-c77c-43e6-9a85-99a4b2a82476` | setts, second variation, 200×200 | stones 14 pixels wide with heavy outlines: too coarse and too loud |

Cost: 120 credits (four textures at 12, two first attempts at 12, two second rounds with two variations at 24).

## What worked

- **Texture mode cuts the result down to one repeat of the pattern.** A strictly regular pattern ("exactly eight slabs, every slab 8 by 8 pixels") comes back as a fragment a few pixels wide. Asking for slabs and stones that all differ a little gives a usable tile.
- **The exact-size model refuses textures** ("Pixel Engine Image makes sprites and single UI pieces").
- **The size hint is not kept** (64 asked, 100 to 204 returned), but the pixels are real pixels: used one to one the grain fits the house fronts.
