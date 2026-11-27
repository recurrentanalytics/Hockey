# House kit, vertical sample: Bonifatiusplatz 3 (2026-11-27)

Generated through the SpriteCook MCP server from OpenCode (`https://mcp.spritecook.ai/mcp/openai`), project "BORSTENBOOM". All with `gemini-nano-banana-2.1`, `pixel=true`, `resolution="1K"`, `aspect_ratio="1:1"`, 12 credits per picture. **Nothing here is approved**: the pictures lie in `assets/welt/haeuser/` beside the art library, and the world shows them only with `?haeuser=probe`.

Closing style block of every prompt, the project's own with the view left out:

> Clean pixel art in Franco-Belgian ligne claire comic style: uniform one-pixel dark brown outline, flat warm colours with a single shade step, no gradients, no dithering, no anti-aliasing, light from the upper left.

## In the kit

| File | SpriteCook asset | Size hint → result | References | Subject part of the prompt |
| --- | --- | --- | --- | --- |
| `gruenderzeit-a.png` | `c8817c0e-185e-4fea-8f5f-c86a22ebc65a` | 288×208 → 308×316 | style: plane tree, linden, bench | Front elevation of one four-storey Gründerzeit apartment house (built about 1900) in Hannover-List, drawn as a flat game sprite of its street façade. Strict orthographic front view, no perspective, no side walls, no roof, no sky, no pavement, no people, no lettering. Only the wall, from the plinth at the bottom edge up to the moulded eaves cornice at the top edge. Ground floor: rusticated sandstone-grey plinth, tall windows, one arched double front door in dark green wood with a fanlight, right of centre; a string course above. Three upper storeys with nine evenly spaced tall casement windows each: white frames with T-shaped glazing bars, cream stucco surrounds, small pediments over the first-floor windows, simpler lintels on the top floor. A slightly projecting central bay with two small wrought-iron balconies. A bracketed cornice along the top. Walls in soft dove-blue painted render, ornament in cream white. Curtains in some windows, two window boxes with red geraniums, one window standing open. |
| `dachteile-a.png` | `f1aa5927-18fe-4866-b33f-ac8faf89b953` | 64×80 → 136×136 | reference: the façade | Roof details for the same house, three separate objects side by side in one row, each in strict orthographic front view and in exactly the pixel size of the reference. Left: one small shed dormer front (Schleppgaube) with a two-light casement window like the upper windows of the reference, clad in dark grey slate shingles, a thin zinc-grey roof edge on top. Middle: one red-brick chimney stack with a pale stone cap and two terracotta chimney pots. Right: one small cast-iron roof window lying flat, a dark glass pane in a grey metal frame. |
| `ziegel-a.png` | `4dbc59d7-d388-491e-b16f-be213d7ca5c3` | 128×128 → 200×200, `mode="texture"`, `bg_mode="include"` | reference: the façade | Seamless tileable texture: a patch of red clay pantile roof seen straight on, exactly eight tiles wide and six courses tall, edge to edge. Every pantile clearly drawn and the same size, about 16 pixels wide and 20 tall, with a rounded lower edge, one flat warm brick-red colour, one darker red shade along its right side and under the course above, and a one-pixel dark brown outline. Three single tiles a little lighter, two a little darker. |
| `putz-a.png` | `47733566-cac3-4a1d-9896-ccb95c3f6ae7` | 64×64 → 300×302, `mode="texture"`, `bg_mode="include"` | reference: the façade | Seamless tileable texture of the plain windowless gable wall (fire wall) of an old German town house: flat warm grey-beige rough render, very calm, a few hairline cracks, two small darker patched areas, faint water stains. No bricks, no windows. |

## Not used

| Asset | Result | Why not |
| --- | --- | --- |
| `c005e738-1f35-4a6a-bd68-2fa9c94e6123` | second variation of the façade, 160×160 | good, but half the pixel density of the chosen one; kept as a candidate |
| `94b32a5e-432d-4d02-bca9-911494fd7c25` | first roof tiles, 21×22 | blurred stripes, no tiles to see |
| `a17c0321-36b4-488e-8d23-87d2d980bf44` | courtyard side, with the façade as reference, 158×158 | came back as a thin strip |
| `dc1c3901-74fa-4730-931b-703db0d7c7cd` | courtyard side as an edit of the façade, 120×120 | thin strip again |
| `44ca41e7-f8b4-497e-9b9e-0a405081ab30` | courtyard side, described from scratch, 96×91 | a proper plain rear wall, but at 7 px per metre against the front's 25; not used, the yard walls wear the street kit for now |

Cost of the sample: 108 credits (9 pictures), 36 of them on the three courtyard attempts.

## What the sample showed

- **Size is a hint and it scatters widely.** The same request (288×208) came back at 160×160 and at 308×316; texture requests of 64×64 came back at 21×22 and 300×302. Pixel density therefore has to be read off each result (picture height ÷ real height) and written into the kit; it cannot be ordered. The chosen façade has 24.7 px per metre, not the 16 the world plan names.
- **The model draws squares.** Asked for 18 × 13 m it drew seven window axes on a square. The façade is therefore cut into axes and set together again for the real wall length (`fuege()` in `src/welt/haeuser.js`); nothing is stretched beyond a few per cent.
- **A reference keeps the look, not the scale.** Parts generated "in exactly the pixel size of the reference" came close for the roof parts and far off for the courtyard wall.
- **Colours are not a palette.** The façade has about 27 000 distinct colours (near-duplicate shades). It is used as generated; quantising to the project palette is an open step.
- **The art library's checks do not fit these pictures** (128 px frame limit, 32 colours, transparent background). Taking façades into `assets/manifest.json` needs an agreed extension of `tools/assets/validate.mjs`.
