# Initial set: bench, stick, puck (2026-11-27)

All three: `gemini-nano-banana-2.1`, style reference the chosen skater `9eeb43be-a11b-4be0-82a3-27e9583b318f` (the bench also the plane tree `5e75d280-01cf-4bb1-8d6b-5b3ec9196e83`), one variation, 12 credits each. Each prompt ends with the style block from `docs/art/README.md` section 2 and "no ground, no shadow, no background".

| Asset | SpriteCook asset | Size hint → result | Subject part of the prompt |
| --- | --- | --- | --- |
| `prop.bench` | `ecf548ac-8726-4846-b691-8d04914e6a8d` | 64×48 → 70×70 | A single wooden park bench as found on a German city playground: slatted wooden seat and backrest in warm ochre brown, dark green cast-iron legs and armrests. Side view with a slight top-down tilt, drawn to stand next to the inline skater in the style reference and to reach about up to his chest. No people. |
| `equipment.stick` | `e222fe65-40ae-4def-baca-bc519ba07042` | 96×48 → 76×76 | A single inline hockey stick lying flat, side view: long straight shaft from the upper left to the lower right, blade at the lower right end. Light ochre wooden shaft, white tape with dark lines on the blade, a dark taped grip with a knob at the top end. Same chunky pixel size as the skater, about as long as he is tall. One stick only, no hands, no player, no puck. |
| `equipment.puck` | `4e081222-5c5f-4110-aa64-0bc21348208f` | 32×32 → 36×36 | A single black inline hockey puck lying flat, seen from the side and slightly above: a short flat black cylinder with a dark grey top face, a thin lighter rim and a few small round glide pegs on top. Same chunky pixel size as the skater, about as wide as his skate. One puck only, no stick. |

For an object (unlike a character, see `pilot.md`) the words "hockey" and "stick" did no harm. Intake: `tools/assets/library.mjs add …` with the options listed in the art README, section 6a.
