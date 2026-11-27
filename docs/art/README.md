# BORSTENBOOM! art production

How art gets from an idea into the running game. SpriteCook produces the art; Claude drives it through the SpriteCook plugin; this repository holds the results, their manifest and the checks.

Status: the plugin is installed and its capabilities are documented below from its own skill files (version 0.1.15, skills 2026.10.20). **No asset has been generated yet**, because the SpriteCook server needs a one-time sign-in by the account owner. Everything marked *proposed* gets locked only after the pilot run.

## 1. What SpriteCook can do

The plugin is a hosted MCP server (`https://mcp.spritecook.ai/mcp/claude`) plus ten workflow skills. Sign-in is OAuth in the browser; there is no API key to configure. Generation and animation spend SpriteCook credits.

| Need | Tool | Notes |
| --- | --- | --- |
| Still sprite, matched to our style | `generate_game_art` with `style_asset_ids` | Model Nano Banana 2.1, 12 credits at 1K. Width and height are only hints: small sprites usually come back 40–90 px. |
| Still sprite at an exact size | `generate_game_art` with `pixel-engine-image-v1` | Exactly 16–128 px, background already removed. Text only: takes no style references. |
| Several related props | one 3×3 or 4×4 sheet, then slice | Cheapest route, and the set shares outline and lighting. |
| Base character and standard animations | `generate_character`, `generate_character_animations` | Perspectives: platformer, isometric, topdown. Canvas often 56–170 px. |
| Animate an existing asset | `animate_game_art` | 2–16 frames, output as horizontal spritesheet, palette size enforced (`colors`). Takes 1–5 minutes. The source image is the first frame, so the starting pose has to be prepared first. |
| Edit or vary an asset | `generate_game_art` with `edit_asset_id` / `reference_asset_id` | Outfits, equipment variants, new poses of one character. |
| Tilesets, textures, UI kits | `generate_tileset`, `mode="texture"`, `create_ui_kit` | Not needed for the pilot. |
| Bring a local PNG into SpriteCook | `create_asset_upload` + `finalize_asset_upload` | Needed for the downscale-and-redraw route and for animating sliced sprites. |
| Fix edges after background removal | `get_asset_metadata` + `set_asset_alpha_cutoff` | Free. The bundled comparison script needs Python with Pillow, which is not installed here. |
| Account | `get_credit_balance`, `list_generation_models`, `list_recent_assets` | Check the balance before every batch. |

Limits that shape our pipeline:

- **Size is the hard part.** Our skater is 22×26 px today and the game renders at 216 px height. Reference-guided models return larger sprites, so every character goes through: generate → pick → nearest-neighbour downscale locally → upload → "clean redraw at the same pixel size" with the upload as reference.
- **Style consistency comes from references, not from prompts alone.** Once the first approved assets exist they are passed as `style_asset_ids` (up to 10) on every later generation.
- **The palette is guidance only.** Outputs contain hundreds of near-duplicate shades; we quantise locally to the project palette (nearest colour, no dithering).
- **Animation canvases are not aligned to the still.** Frames have to be re-anchored locally to one ground line.
- **The Godot export skill does not apply.** This game is plain JavaScript on a canvas.

## 2. Visual identity (*proposed*)

Warm, handcrafted pixel art in the spirit of Franco-Belgian ligne claire.

- **Outline:** one continuous dark outline, 1 px, same weight on characters, objects and UI. Warm dark brown-black, not pure black.
- **Colour:** flat fills with at most one shade step per material. No gradients, no dithering, no rim light. Light comes from the upper left.
- **Shapes:** simple, readable silhouettes; large heads and hands on characters (about 3 heads tall); clear, slightly exaggerated poses.
- **Detail:** a few telling details per object, never texture noise.
- **View:** side-on with a slight top-down tilt, matching the rink projection (16 px per metre across, 8 px per metre in depth).

Style block, reused word for word in every prompt:

> Clean pixel art in Franco-Belgian ligne claire comic style: uniform one-pixel dark brown outline, flat warm colours with a single shade step, no gradients, no dithering, no anti-aliasing, light from the upper left, simple readable silhouette, side view with a slight top-down tilt, transparent background.

Palette: the game's current palette (`src/engine/palette.js`) is cool and blue-grey. *Proposed* warm extension, to be confirmed against the pilot results before anything in the game is recoloured:

| Role | Hex |
| --- | --- |
| Outline | `#2a1d1a` |
| Paper white | `#f7efdc` |
| Skin / skin shade | `#f1c49c` / `#c58c66` |
| Brick red / shade | `#c8553d` / `#8a3324` |
| Ochre / shade | `#e2a742` / `#a8763f` |
| Leaf green / shade | `#6f9e4c` / `#3f6b3a` |
| Sky blue / shade | `#7fb2d6` / `#4a6f9c` |
| Stone grey / shade | `#b9b3a4` / `#7d7868` |
| Asphalt | `#4b4a52` |

**Team colours.** Players are recoloured per team in the engine, as today. Characters are therefore generated in fixed key colours that the engine swaps: jersey `#ff00aa`, jersey shade `#aa0071`, trim `#00ffd5`, helmet `#ffe600`, helmet shade `#b3a100`, pants `#5a00ff`, pants shade `#3c00aa`. Key colours appear nowhere else in a sprite.

## 3. Asset specifications

| Kind | Folder | Frame | Anchor | Notes |
| --- | --- | --- | --- | --- |
| Character | `assets/characters/<name>/` | 32×32 (figure about 26 px tall) | feet, bottom row | faces right; the engine mirrors |
| Animation | same folder, one file per motion | same frame, 4–8 frames side by side | same as the still | one ground line across all frames |
| Equipment | `assets/equipment/` | 16×16 or 32×16 | grip or centre | sticks, pucks, balls, goals |
| Prop | `assets/props/` | up to 32×32 | ground contact | benches, cones, bins |
| World object | `assets/world/<place>/` | up to 64×96 | ground contact | trees, lamps, façade details |
| UI | `assets/ui/` | as needed | none | |
| Tiles | `assets/tiles/` | 16×16 | none | opaque |

Rules for every file: PNG, 8-bit RGBA, alpha only 0 or 255, at most 32 colours, lower-case kebab-case names, no spaces or version suffixes (Git keeps the history).

## 4. Manifest

`assets/manifest.json` lists every asset. Nothing is loaded by the game or accepted by the checks unless it is listed.

```json
{
  "id": "character.skater.skate",
  "kind": "character",
  "file": "characters/skater/skate.png",
  "frame": { "w": 32, "h": 32 },
  "frames": 6,
  "anchor": { "x": 16, "y": 31 },
  "sha12": "first 12 hex digits of the file's SHA-256",
  "source": { "asset_id": "SpriteCook asset id", "model": "…", "prompt": "prompts/skater-skate.md" }
}
```

Optional fields: `maxColors`, `opaque`, `softAlpha` (intended translucency), `grounded: false` (flying or bouncing motion). Signed URLs, tokens and account data never go into the manifest.

## 5. Workflow

1. **Concept.** One short spec: what it is, size, kind, motions.
2. **Balance.** `get_credit_balance`; stop if the batch does not fit.
3. **Generate.** Style block + subject; approved assets as `style_asset_ids`. Props in sheets, characters singly.
4. **Inspect.** Look at the result at native size and at 4× zoom, on light and dark backgrounds. Reject and regenerate at most twice; then change the prompt.
5. **Fit.** Downscale-and-redraw to the frame size if needed, quantise to the palette, re-anchor animation frames, fix edges.
6. **Export.** Save under `assets/…`, add the manifest entry with `asset_id` and `sha12`, keep the prompt under `docs/art/prompts/`.
7. **Check.** `npm run assets:check` must report no errors.
8. **Integrate and look.** Load it in the game and take a screenshot of it in play. An asset is done when it looks right there, not when the file validates.
9. **Commit** asset, manifest entry and prompt together.

`npm run assets:check` verifies: naming and folders, declared frame size against the real image, removed background, hard pixel edges, colour count, non-empty frames, a steady ground line across animation frames, anchor position, file hash, and that no PNG sits in `assets/` unlisted.

## 6. Pilot set

Five assets that exercise every route once:

| # | Asset | Route | Decides |
| --- | --- | --- | --- |
| 1 | Skater, neutral kit in key colours, still | generate → downscale → redraw | character proportions and outline |
| 2 | Skater push-and-glide cycle, 6 frames | prepare mid-stride pose → `animate_game_art` | animation quality at our size |
| 3 | Hockey stick | exact-size model, 32×16 | whether exact-size output matches the style without references |
| 4 | Puck and ISHD ball | exact-size model, 16×16 | smallest readable size |
| 5 | One Bonifatiusplatz object (street lamp or plane tree) | generate with assets 1 and 3 as style references | world objects next to characters |

Expected cost: roughly 5 stills, 2 redraws and 1 animation plus retries. Still prices are 12 credits each; the animation price has to be read from `list_generation_models` after sign-in.

## 7. Open decisions

- **Stick in play.** The stick is drawn live as a line today so it can aim, wind up and poke. A sprite cannot rotate freely without breaking the pixel grid. Proposed: keep the live stick in play and take its colours from the stick asset; use the sprite for menus, pickups and UI.
- **Skater size.** 32×32 frames are larger than today's 22×26. Either the figure stays about 26 px tall inside the larger frame (proposed), or the whole game scale changes.
- **Engine loading.** The game bakes all sprites in code and has no image loader. The loader, with the code-drawn sprites as fallback, is built together with the first real asset.
- **World geometry.** The game is a rink only. The Bonifatiusplatz world built from OpenStreetMap footprints is a separate pipeline (Python; Blender is not installed here) and has not been started.
