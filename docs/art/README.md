# BORSTENBOOM! art production

How art gets from an idea into the running game. SpriteCook produces the art; Claude drives it through the SpriteCook plugin; this repository holds the results, their manifest and the checks.

Status (2026-11-27, Phase 3): the pipeline runs from SpriteCook to the running world view. `tools/assets/library.mjs` takes a generated picture, fits it, names and files it by its id, writes the manifest entry and runs the checks; the entry also says where the asset stands, and `welt.html` puts it there (a tree on every mapped tree, a bench on every mapped bench, skater, stick and puck on the court). The initial set is in the table in section 6a. The owner approved the skater still and stride and, on 2026-11-27, bench, stick, puck, plane tree and linden as well; only the small pilot skater is left unapproved. The 2D match (`index.html`) still draws its own skeleton figures and does not use library sprites; the hooks for the older sprite renderer described further down are gone.

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

- **Size is the hard part, and the pilot settled it.** The game renders at 216 px height and a skater is about 30 px tall. The reference-guided model returned 84 px for a 32 px request; shrinking that by 3 destroyed the face, and the documented "clean redraw" of the shrunk image came back at 56 px. The exact-size model (`pixel-engine-image-v1`) draws a clean 32×32 character directly. **Play-size sprites therefore come from the exact-size model; the reference-guided models are for large art** (world objects, portraits, style studies). See `pilot/size-comparison.png`.
- **The exact-size model takes no style references.** Consistency at play size rests on reusing the same `style` text and prompt wording, kept under `prompts/`.
- **Style consistency comes from references, not from prompts alone.** Once the first approved assets exist they are passed as `style_asset_ids` (up to 10) on every later generation.
- **The palette is guidance only.** Outputs contain hundreds of near-duplicate shades; we quantise locally to the project palette (nearest colour, no dithering).
- **Animation canvases are not aligned to the still.** A 32×32 still came back as 36×36 frames. `fit.mjs strip` puts all frames on one ground line.
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

**Team colours.** Players are recoloured per team in the engine. A character is generated once in a reference kit (red jersey, yellow trim, white helmet, navy shorts). After colour reduction, its manifest entry lists which sprite colours are team colours (`teamColors`: sprite hex → `main`, `shade`, `trim`, `trimShade`, `helmet`, `helmetShade`, `pants`, `pantsShade`; a team without a `trimShade` gets its `trim` there), and the engine swaps exactly those. The reference kit colours must not be used for anything else on the sprite; skin, outline, gloves and skates stay fixed.

**The Borstentiere kit** is not invented here: it follows the club's own jersey templates, `img/jersey_front.png` and `img/jersey_back.png` in the club website project (`~/coding/boni-borstentiere-website`), and the Bonny comic there for helmet and trousers. Forest green jersey `#1b4a2e` / `#0d2c1b`, cream stripe `#ecd9a4` with orange `#b8460f`, green helmet `#245a38`, dark brown trousers `#2e2118`. It is the team `borstentiere` in `src/config.js` and the default home team. The owner confirmed these colours on 2026-11-27. The boar crest, the name BONI and the number 61 are not on the sprite yet: a recolour cannot draw them.

## 3. Asset specifications

| Kind | Folder | Frame | Anchor | Notes |
| --- | --- | --- | --- | --- |
| Character | `assets/characters/<name>/` | 36×36 (generated at 32×32; figure about 30 px tall) | feet, bottom row | faces right; the engine mirrors |
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

Optional fields: `teamColors`, `idleFrame` and `hand` (stick grip, sprite pixels from the anchor) for characters; `maxColors`, `opaque`, `softAlpha` (intended translucency), `grounded: false` (flying or bouncing motion). Signed URLs, tokens and account data never go into the manifest.

## 5. Workflow

1. **Concept.** One short spec: what it is, size, kind, motions.
2. **Balance.** `get_credit_balance`; stop if the batch does not fit.
3. **Generate.** Style block + subject; approved assets as `style_asset_ids`. Props in sheets, characters singly.
4. **Inspect.** Look at the result at native size and at 4× zoom, on light and dark backgrounds. Reject and regenerate at most twice; then change the prompt.
5. **Fit.** `node tools/assets/fit.mjs` does the local steps: `frame` (trim, stand on the frame's bottom edge, reduce colours), `strip` (animation sheet onto one ground line), `shrink`, and `preview` (contact sheet on light and dark).
6. **Export.** Save under `assets/…`, add the manifest entry with `asset_id` and `sha12`, keep the prompt under `docs/art/prompts/`.
7. **Check.** `npm run assets:check` must report no errors.
8. **Integrate and look.** Load it in the game and take a screenshot of it in play. An asset is done when it looks right there, not when the file validates.
9. **Commit** asset, manifest entry and prompt together.

`npm run assets:check` verifies: naming and folders, declared frame size against the real image, removed background, hard pixel edges, colour count, non-empty frames, a steady ground line across animation frames, anchor position, file hash, and that no PNG sits unlisted in the library's folders (`characters`, `equipment`, `props`, `world`, `ui`, `tiles`). The other folders under `assets/` (app icons, fonts, intro data, pixel art, voice) belong to the game and are not checked.

## Who chooses

The project owner chooses every asset. Nothing generated goes into the game on Claude's judgement.

1. Generated images land in `art/candidates/<date>-<subject>/` (not in Git, not loaded by the game), together with `candidates.json`, which records the SpriteCook asset id of each number.
2. `node tools/assets/fit.mjs sheet <folder>` writes `sheet.png`: every candidate numbered, enlarged on a light and a dark background, and at native size.
3. The owner answers with numbers, or asks for another round.
4. Only the chosen images are fitted, moved to `assets/` and entered in the manifest with `"approved": { "date": "YYYY-MM-DD" }`.
5. The game loads approved assets only. `npm run assets:check` lists everything still waiting. Opening the game with `?preview=art` shows waiting assets too, for judging them in play.

## Pixel density

The world layer has two pixels per world pixel (`VIEW.worldDensity`). Positions, cameras and the built-in sprites still use world pixels, so the game plays and frames exactly as before. An asset with `"density": 2` in the manifest is drawn at half its pixel size and so shows twice the detail: a 56 px figure stands as tall as a 28 px one. Until the arena, goalie and puck are replaced, they stay at the coarse density.

## 6. Pilot set (done)

| Asset | File | Route | In the game |
| --- | --- | --- | --- |
| Skater stride, 8 frames of 36×36 | `assets/characters/skater/skate.png` | exact-size still → `animate_game_art` → `strip` | every skater, recoloured for all four teams |
| Hockey stick, 64×16 | `assets/equipment/stick.png` | exact-size model | title screen |
| Puck, 16×16 | `assets/equipment/puck.png` | exact-size model | title screen |
| Plane tree, 80×80 | `assets/world/bonifatiusplatz/plane-tree.png` | reference-guided model, styled on the large skater study | far corners of the arena |

Pictures: `pilot/assets.png` (the files at 5×), `pilot/ingame-faceoff.png`, `pilot/ingame-corner.png`, `pilot/ingame-title.png` (screenshots of the running game), `pilot/size-comparison.png` (shrunk redraws against exact-size output). Prompts: `prompts/pilot.md`.

Cost: 140 credits in total, including the rejected routes (stills 6 each at exact size and 12 each reference-guided, the 8-frame animation 20).

What the pilot showed:

- The whole chain runs without manual steps: generate, download, fit, check, load, screenshot.
- The stride animation keeps the character consistent across all 8 frames. Two frames have small gaps in the arm outline.
- Team recolouring by exact colour swap works for all four teams.
- The stick and the puck are far larger than their in-play size (the puck in play is 5×3 px), so they serve as UI art, not as play sprites.
- The goalie, the stick in play, the puck in play and the arena are still code-drawn and do not match the new skater yet.
- The tree stands in an arena corner only to prove the route; a world for it does not exist yet.

## 6a. Initial set and the one-command intake (Phase 3)

| Asset | Id | Size | Stands | State |
| --- | --- | --- | --- | --- |
| Player | `character.skater.glide` | 84×84 | – | approved |
| Animation: stride, 8 frames | `character.skater.stride` | 84×84 × 8 | court centre, 1.4 m tall, in the Borstentiere kit | approved |
| Hockey stick | `equipment.stick` | 76×62 | on the court next to the player | approved 2026-11-27 |
| Puck | `equipment.puck` | 36×28 | on the court, true size (7 cm, hard to see) | approved 2026-11-27 |
| Tree: plane tree | `world.bonifatiusplatz.plane-tree` | 80×80 | species of the grove, assigned to mapped trees by their id (see `docs/BONI_ORT.md`, trees) | approved 2026-11-27 |
| Tree: linden | `world.bonifatiusplatz.linden` | 52×80 | second species of the grove | approved 2026-11-27 |
| Environmental object: park bench | `prop.bench` | 70×64 | on each of the 22 benches mapped in `ausstattung.geojson` | approved 2026-11-27 |
| Street lamp | `prop.street-lamp` | 20×120 | on each of the 56 street lamps mapped (`highway=street_lamp`), 4.5 m | approved 2026-11-28 |
| Bicycle stand | `prop.bicycle-stand` | 50×72 | on each of the 46 bicycle parkings (`amenity=bicycle_parking`), 0.85 m | approved 2026-11-28 |
| Waste basket | `prop.waste-basket` | 46×70 | on each of the 26 waste baskets (`amenity=waste_basket`), 1.0 m | approved 2026-11-28 |
| Picnic table | `prop.picnic-table` | 68×42 | on the 2 picnic tables (`leisure=picnic_table`), 0.8 m | approved 2026-11-28 |
| Climbing dome | `world.bonifatiusplatz.climbing-dome` | 78×66 | on the 2 climbing frames (`playground=climbingframe`), 2.2 m | approved 2026-11-28 |
| Wooden hippo | `world.bonifatiusplatz.hippo` | 110×68 | in the sandpit next to the court (`playground=sandpit`), 1.1 m; sun-bleached, worn wood, open mouth | approved 2026-11-28 |

Pictures: `set/bogen.png` (bench, puck, stick as generated), `set/welt-baeume.jpg`, `set/welt-platz.jpg` (in the world view with `?preview=art`). Prompts: `prompts/set.md`, `prompts/skater.md`, `prompts/pilot.md`, `prompts/strassenmoebel.md`. Bench, stick and puck were generated with the chosen skater as style reference (`gemini-nano-banana-2.1`, 12 credits each).

From a downloaded picture to the world it is one command; nothing is placed by hand:

```sh
node tools/assets/library.mjs add art/candidates/<folder>/bench.png prop.bench --height 0.9 \
     --place ausstattung:amenity=bench --asset <SpriteCook id> --model gemini-nano-banana-2.1 --prompt docs/art/prompts/set.md
node tools/assets/library.mjs approve prop.bench      # the owner's yes
node tools/assets/library.mjs list
```

- **Name and folder** come from the id (`kind.subject[.variant]` → `assets/<kind folder>/<subject>[/<variant>].png`).
- **Fit:** trimmed, stood on the bottom edge, at most 32 colours, hard alpha; animation strips with `--frames n` on one ground line.
- **Placement** is part of the manifest entry: `place.layer` + `place.match` (every matching point of a geodata layer in `locations/<ort>/geo`) or `place.court` (court metres), plus `worldHeight` in metres. `src/welt/bibliothek.js` reads it. A layer that has a sprite hides its schematic stand-in.
- **Approval** stays with the owner: a re-added picture loses it; `approve` sets it.
- **Not automated:** the generation call itself (it runs through the SpriteCook tools in a Claude session and spends credits), the choice between candidates, and separating team colours on a new character (see `prompts/skater.md`).

## 7. Open decisions

- **Skater: still and stride approved (2026-11-27).** Candidate 6 as the still (`assets/characters/skater/glide.png`) and take 2 of its stride (`assets/characters/skater/stride.png`, 8 frames), both 84×84 at density 2, so the figure stands 41 world pixels tall; `pilot/skater-teams.png` shows the still in all five kits, the Borstentiere first. The game uses the stride for every skater. Shot, cheer and knockdown still move only the live-drawn stick or turn the sprite: the arms do not move. Prompts and local steps: `prompts/skater.md`.
- **The four pilot assets are not approved.** They stay in the manifest without approval, visible only with `?preview=art`. The chosen skater takes precedence over the small pilot skater there too.
- **Stick in play.** It stays a live-drawn line so it can aim, wind up and poke. A sprite cannot rotate freely without breaking the pixel grid.
- **Skater pose.** The generated skater swings the arms like a speed skater; the hands do not hold the live-drawn stick. A two-handed stick-carrying pose needs its own still and animation.
- **Goalie.** Next character to generate, so both player types match. The full list of motions the game already animates in code, and what each needs from the new art, is in `prompts/skater.md`.
- **Palette.** The arena still uses the cool built-in palette; the warm palette above is not applied anywhere yet.
- **World geometry.** The game is a rink only. The Bonifatiusplatz world built from OpenStreetMap footprints is a separate pipeline (Python; Blender is not installed here) and has not been started.
