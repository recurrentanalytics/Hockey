# Inline Hockey: Game Spec

Agreed decisions for the game. Phase-by-phase work follows this document.

## Core decisions

| Area | Decision |
| --- | --- |
| Platform | Browser game (desktop + mobile, same build) |
| View | Side-on/angled 2.5D. Rink drawn at an angle; camera follows the puck. |
| Art | Pixel art: low internal resolution, scaled up with crisp pixels. Sprites drawn in code unless assets are supplied. |
| Modes | 1 player vs AI; local 2-player (versus, or co-op on the same team vs AI) |
| 2-player camera | Choosable in settings: shared zooming camera or split screen |
| Input | Keyboard, touch (on-screen stick + buttons), any gamepad via the Gamepad API (incl. 8BitDo SN30 Pro over Bluetooth). All controls remappable in a settings screen and saved. |
| Team size | 4 skaters + 1 goalie per side; penalties create power plays |
| Teams | Made-up team names and colours, no real clubs |

## Rulesets (choosable in the menu)

- World Skate / IIHF inline
- USA Roller Sports / NARCh
- German ISHD

Each ruleset sets: period count and length, stop-time vs running clock, icing, penalty types and lengths, and overtime/shootout format.
Before each ruleset is coded, a short summary from the official rulebook gets reviewed.

## Phases

1. **Foundation**: pixel-art renderer, angled rink, camera, input system (keyboard/gamepad/touch + remapping), menus
2. **Skating & puck**: physics, carrying, passing, shooting, checks, goalies
3. **AI**: team positioning, attacking/defending, goalie behaviour
4. **Rules engine**: rulesets, penalties, power plays, overtime/shootouts
5. **2-player**: shared and split-screen cameras, co-op and versus
6. **Polish**: sound, animations, team colours

Check-in with the user after each phase.
