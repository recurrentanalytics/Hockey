# Skater (chosen 2026-11-27)

Candidate round `art/candidates/2026-11-27-skater/` (seven candidates, not in Git). The owner chose number 6, SpriteCook asset `9eeb43be-a11b-4be0-82a3-27e9583b318f`, 84×84 with 1271 colours.

Still — `gemini-nano-banana-2.1`, size hint 56×56, reference: the large skater study `ac3f660c-397a-430f-b292-eb5bc6447c1f` (read back from SpriteCook with `get_asset_metadata`):

> A cute inline hockey player on inline skates, facing right, full body side view with a slight top-down tilt, in exactly the chunky style and pixel size of the reference sprites. Extra cute comic proportions: very big round head, about two and a half heads tall, big friendly eye, rosy cheek, small smile, short sturdy body. White helmet, plain red jersey with a yellow stripe on the sleeve, grey padded gloves, dark navy shorts, red socks, black inline skates with small wheels. Knees bent in a low glide, one leg pushed back, both gloved hands held together low in front of the body as if gripping a stick, but the hands are empty: no stick, no puck. Clean pixel art in Franco-Belgian ligne claire comic style: uniform one-pixel dark brown outline, flat warm colours with a single shade step, no gradients, no dithering, no anti-aliasing, light from the upper left, simple readable silhouette. About 56 pixels tall.

## Local steps for `assets/characters/skater/glide.png`

1. `fit.mjs frame 06.png glide.png 84 84 32`
2. Palette clean-up, 32 → 25 colours. The picture looks the same; the point is that every team colour is used for one thing only.
   - The four near-black outline shades and `#3f0000` become `#271811`.
   - Single stray pixels join their neighbour: `#ecae7f` → `#f5bd8c`, `#d67d5f` → `#e38c71`, `#c37b10` and `#d38e05` → `#ca860b`, `#443c31` and `#584b3a` → `#403129`, `#aaa390` → `#b2ab98`.
   - Helmet shade and gloves shared one grey. In rows 0–24, `#b2ab98` becomes `#b3ab98` and `#8e8171` becomes `#8f8171` (helmet only).
   - Eye whites and helmet shared one cream. From row 15 down and column 50 right, `#f7efdc` becomes `#f8efdc` (eyes only).
   - Wheels and trouser shade shared one navy. From row 66 down, `#1d2339` becomes `#1e2339` (wheels only).

Any animation made from this asset needs the same separation before its `teamColors` can be listed.

## Stride — `animate_game_art` on the still, 8 frames, spritesheet, 24 colours, edge margin 6, prompt not auto-enhanced

Candidates in `art/candidates/2026-11-27-skater-stride/` (not in Git). Both came back as 8 frames of 96×96.

1. `pixel-engine-v1.1`, 20 credits, asset `c29cb649-e8bd-4923-9e62-23306defe54f`. The pilot's stride prompt plus "both gloved hands stay together low in front of the body". The arms swing apart all the same, the body stands up in two frames (83 to 92 px tall) and one helmet has a ragged edge.
2. `pixel-engine-v1.5`, 26 credits, asset `918a831b-bacd-4d33-bb67-043aca7c6943`. Hands stay together, the figure stays 82 to 84 px tall. The owner chose this take on 2026-11-27; it is `character.skater.stride` in the manifest:

> Inline skating stride loop in place, facing right. Only the legs move: the skater pushes off with one leg, glides, then pushes off with the other leg, knees bent low the whole time. The upper body keeps exactly the starting pose: leaning forward, both gloved hands held together low in front of the body, never apart, arms not swinging, hands empty. Head, helmet and face stay exactly as in the first frame, with both eyes and rosy cheeks. The body keeps the same size and stays in the same spot, never stands upright, skates stay on the same ground line. Loops smoothly.

Local steps for `assets/characters/skater/stride.png` (take 2):

1. `fit.mjs strip 02.png stride.png 8 84 84`
2. Palette separation, 23 → 29 colours:
   - Eye whites: cream patches (`#f5ecd8`, `#faf5f0`) of at most 25 pixels that start at column 49 or further right and row 12 or lower become `#f8efdc`.
   - Helmet greys: in rows 0–30, `#b5ad9d` → `#b6ad9d`, `#a29787` → `#a39787`, `#797064` → `#7a7064`.
   - Wheels: from row 66 down, `#21273f` → `#22273f`.
   - Stripe shade: the animation has one yellow only. Every `#e1a315` pixel with a different colour directly below it becomes `#ca860b`, which gives the stripe the darker lower edge the still has (orange on the Borstentiere).

## Motions the new skater still needs

The game before the art pipeline (commit `540ad8e`, the state of `~/Hockey`) has no image files: all its animations are code, and all of them are still in the engine. This is what each one needs from the new skater.

| Motion in the game | How it is made today | With the new skater | To generate |
| --- | --- | --- | --- |
| Stride, tempo follows speed | 4 code-drawn frames (glide, push, glide, push) | approved and in the game (see Stride above) | done: `stride.png` |
| Shot wind-up, follow-through, poke check | stick drawn live from the grip | works; the arms do not move | optional later: `shoot.png` |
| Scorer raises the stick | stick drawn live, blade at 2.3 m | works; the arms do not move | optional later: `cheer.png` |
| Knockdown after a check | sprite turned a quarter turn | works | optional later: `down.png` |
| Goalie stand and butterfly | two code-drawn sprites | unchanged, small and code-drawn next to the new skater | a goalie character with `stand` and `butterfly`; the engine has no art hook for the goalie yet |
