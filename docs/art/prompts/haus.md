# House kits for the quarter (2026-11-27 and -28)

Generated through the SpriteCook MCP server from OpenCode (`https://mcp.spritecook.ai/mcp/openai`), project "BORSTENBOOM". **Nothing here is approved**: the pictures lie in `assets/welt/haeuser/` beside the art library, described by `bausaetze.json`, and the world shows them only with `?haeuser=neu`.

Closing style block of every prompt, the project's own with the view left out:

> Clean pixel art in Franco-Belgian ligne claire comic style: uniform one-pixel dark brown outline, flat warm colours with a single shade step, no gradients, no dithering, no anti-aliasing, light from the upper left.

## Façades

All with `gemini-nano-banana-2.1`, `pixel=true`, `resolution="1K"`, `aspect_ratio="1:1"`, size hint 160×160, two variations (24 credits per design). Style references: the first façade (`stuck`), the plane tree, the bench.

Common head of the prompt:

> Front elevation of one four-storey apartment house in Hannover-List, Germany, drawn as a flat game sprite of its street façade. Strict orthographic front view: perfectly vertical and horizontal lines, no perspective, no side walls visible, no roof, no sky, no pavement, no people, no lettering. The picture shows only the wall as one clean rectangle, from the plinth at the bottom edge up to the eaves at the top edge. Four storeys, seven evenly spaced window axes: every window stands exactly above the one below.

and before the style block: "Drawn in exactly the same chunky pixel size, outline weight and palette warmth as the house in the first style reference: the whole wall is about 160 pixels tall."

| Kit | File | SpriteCook asset | Result | Design part of the prompt |
| --- | --- | --- | --- | --- |
| `stuck` | `stuck.png` | `c005e738-1f35-4a6a-bd68-2fa9c94e6123` | 160×160 | (first round, hint 288×208, style: plane tree, linden, bench) Gründerzeit house of about 1900: rusticated sandstone-grey ground floor, arched dark green double door with a fanlight right of centre, three upper storeys with white casement windows, cream stucco surrounds, pediments on the first floor, a central bay with wrought-iron balconies, a bracketed cornice; dove-blue render, curtains, window boxes with red geraniums, one open window. |
| `jugendstil` | `jugendstil.png` | `2f65f01c-926b-4ec0-9c56-c8ca91fa1415` | 160×160 | An elegant house built about 1905. Dove-blue render, cream ornament. Upper windows with segmental-arched heads and flat surrounds, a small floral stucco panel under each second-floor window, flat bands between the storeys, a simple moulded cornice. Ground floor in smooth cream-grey render with tall rectangular windows and one oak-brown double door with an oval fanlight, left of centre. No balconies. |
| `klinker-a` | `klinker-a.png` | `d188c287-00ec-454a-92ee-bd66c1223097` | 160×160 | A red brick house built about 1895. Dark red-brown brick with visible courses, window surrounds and bands in pale sandstone, segmental brick arches over the windows, a corbelled brick cornice. Ground floor in brick on a grey stone plinth, one dark blue wooden double door with a rectangular fanlight, right of centre. No balconies. One window with a white roller blind half down. |
| `klinker-b` | `klinker-b.png` | `b7b4b2ac-f3f8-4a91-8708-fb6f4f0fc558` | 160×160 | second variation of the same prompt |
| `schlicht` | `schlicht.png` | `431eeb8f-c5c1-44f4-8695-b50c585c3dcf` | 160×160, cut off at the left | A plain house rebuilt about 1955, without any ornament. Smooth dove-blue render, a low grey plinth, a simple wooden eaves board. Every window the same: a simple rectangular two-light window with a thin white frame and a thin stone sill. One plain wooden front door with a small glass pane and a thin flat canopy, in the middle axis. One grey zinc downpipe at the far left edge. Also the yard side of every house. |
| `laden-a` | `laden-a.png` | `e383f826-f260-44b2-bd6a-0471945e0144` | 162×162 | A house of about 1900 with shops on the ground floor. Upper three storeys in dove-blue render with cream stucco surrounds, small lintels and a moulded cornice. Ground floor: one shop window in every axis, each exactly under the window above, dark green wooden frames on a low panelled base, a continuous dark green sign board without any letters, red and cream striped awnings over three of the shop windows, one glazed house door in the middle axis. |
| `laden-b` | `laden-b.png` | `9ec7b0db-f834-4ed9-aaf9-049478e9ce76` | 162×160 | second variation of the same prompt |

## Roof

| File | SpriteCook asset | Model, request → result | Subject |
| --- | --- | --- | --- |
| `ziegel.png` | `32dccac8-3093-474c-98dc-7a886d6ee774` | Nano Banana 2.1, `mode="texture"`, 48×48 → 160×163 | Seamless tileable texture, very low resolution: a patch of red clay pantile roof seen straight on, eight tiles wide and six courses tall. **Changed locally:** cut from joint to joint (136×134) and halved (68×67), so that it repeats without a seam and its pixels are the size of the façades'. |
| `schornstein.png` | `55bd5a24-b8af-4045-bec0-378c268cbbc3` | `pixel-engine-image-v1`, exactly 16×28 | One red-brick chimney stack, strict orthographic front view: a straight brick shaft with visible courses, a pale stone cap, two small terracotta pots. |
| `gaube.png` | `e71bc429-5b17-4f4d-8cc7-d1288233a493` | `pixel-engine-image-v1`, exactly 24×24 | The front of one small roof dormer: a two-light casement window with a white frame, set in a front clad in dark grey slate, a thin zinc-grey roof edge. |
| `dachfenster.png` | `6bc13ed8-6e66-4c35-82bb-d0c68348a15f` | `pixel-engine-image-v1`, exactly 16×16 | One small cast-iron roof window seen straight on: a dark blue-grey glass pane with one reflection in a grey metal frame. |
| `putz.png` | `47733566-cac3-4a1d-9896-ccb95c3f6ae7` | Nano Banana 2.1, `mode="texture"`, 64×64 → 300×302 | Seamless texture of a plain windowless gable wall: flat warm grey-beige rough render, a few hairline cracks, two darker patches. Used for party walls, flat roofs and yard buildings, tinted. |

## Not used

| Asset | Result | Why not |
| --- | --- | --- |
| `c8817c0e-185e-4fea-8f5f-c86a22ebc65a` | first façade, fine variant, 308×316 | 24.7 px per metre; the owner chose the coarse size |
| `f1aa5927-18fe-4866-b33f-ac8faf89b953`, `4dbc59d7-d388-491e-b16f-be213d7ca5c3` | roof parts and tiles of the fine variant | fine pixel size |
| `b7e17e75-03e9-418a-b97e-564102eb2361` | second Jugendstil variation, 94×78 | too coarse |
| `10c400be-308e-49d9-b5e8-f2041d50356b` | first plain variation, 82×82 | too coarse |
| `94b32a5e-432d-4d02-bca9-911494fd7c25` | roof tiles, 21×22 | blurred stripes |
| `e776415d-b873-4c36-838a-862462ce5986` | roof tiles from the exact-size model, 64×64 | beaver-tail tiles 16 px wide with gaps at the edges; does not repeat |
| `a17c0321-…`, `dc1c3901-…`, `44ca41e7-…` | three attempts at a separate courtyard side | thin strips, or 7 px per metre |

Cost so far: 240 credits (108 for the first sample, 132 for the quarter's kits).

## What worked

- **A matching square size hint is honoured.** Asked for 160×160 with a 160×160 style reference, six of eight façades came back at 160 to 162 pixels. Asked for 288×208 the same model returned 160 and 316.
- **The style reference fixes the layout too.** All new façades have their seven window axes at the reference's positions, so one set of cut lines (30, 50, 70, 90, 110, 130) fits nearly all kits.
- **The exact-size model is right for small parts** (chimney, dormer, roof window): the size asked for, background already removed, 6 credits. It takes no style reference, so the style block carries the look.
- **Colours are not a palette**: each façade has 3 000 to 10 000 near-duplicate shades. They are used as generated.
- **The art library's checks do not fit these pictures** (128 px frame limit, 32 colours, transparent background). Taking façades into `assets/manifest.json` needs an agreed extension of `tools/assets/validate.mjs`.
