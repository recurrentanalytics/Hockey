# Pilot prompts (2026-11-27)

The exact calls behind the pilot assets. Reuse the wording; change only the subject.

Shared `style` for the exact-size model: `clean ligne claire comic pixel art, flat warm colours, uniform dark brown outline`

## Skater still — `pixel-engine-image-v1`, 32×32, 3 variations (kept the first)

> Roller skating athlete in a team kit gliding on inline skates, facing right, full body side view. Big head, about three heads tall, one dot eye and small smile. White helmet, plain red long-sleeved jersey with one yellow sleeve stripe, grey padded gloves, both arms bent with empty fists in front of the body, navy shorts, red socks, black inline skates, one leg pushed back. Empty hands, holding nothing. Dark brown one-pixel outline, flat colours, one shade step, no dithering.

Do not write "hockey" or "stick" here: with either word the model draws a stick into the hands, even after "no stick".

## Skater stride — `animate_game_art` on the still, `pixel-engine-v1.1`, 8 frames, spritesheet, 24 colours, edge margin 6

> A continuous inline skating stride loop in place, facing right: the skater pushes off with one leg, glides, then pushes with the other leg, arms swinging in rhythm opposite to the legs. The head and helmet stay steady, the body keeps the same size and stays in the same spot, skates stay on the same ground line. Loops smoothly without stopping or standing upright.

Returned 8 frames of 36×36. Local step: `fit.mjs strip … 8 36 36 16`.

## Stick — `pixel-engine-image-v1`, 64×16, 2 variations (kept the second)

> A single ice hockey stick lying flat, side view, shaft running left to right with the blade at the lower right end. Light ochre wooden shaft, dark tape on the blade and a dark grip at the top end. Dark brown one-pixel outline, flat colours with one shade step, no gradients, no dithering.

## Puck — `pixel-engine-image-v1`, 16×16, 2 variations (kept the first)

> A single small black inline hockey puck lying flat on the ground, seen from the side and slightly above, a short flat cylinder with a thin lighter grey top rim. Dark brown one-pixel outline, flat colours with one shade step, no gradients, no dithering. Tiny object centred with empty space around it.

## Plane tree — `gemini-nano-banana-2.1`, size hint 96×128, style reference: the large skater study

> A single old plane tree as found on a German city square: thick pale mottled trunk with patches of bark, broad rounded leafy crown in two greens, a small ring of earth at the foot. Side view with a slight top-down tilt, standing on the ground, drawn to stand next to the hockey player in the style reference and about three times his height. Clean pixel art in Franco-Belgian ligne claire comic style: uniform one-pixel dark brown outline, flat warm colours with a single shade step, no gradients, no dithering, no anti-aliasing, light from the upper left, simple readable silhouette. No ground, no shadow, no background.

Returned 80×80 with 757 colours. Local step: `fit.mjs frame … 80 80 12`.

## Not used: large skater study — `gemini-nano-banana-2.1`, size hint 32×32

Came back 84×84 (asset `ac3f660c-397a-430f-b292-eb5bc6447c1f`). Good as a style reference and for portraits; too large for play. Shrinking it by 3 destroyed the face, and the "clean redraw" of the shrunk image returned 56×56, not 28.
