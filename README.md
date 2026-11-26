# Inline Hockey

A 2.5D pixel-art inline (roller) hockey game for the browser. It runs on desktop and mobile and supports keyboard, touch and any gamepad, including the 8BitDo SN30 Pro. Plain JavaScript with no build step. See [SPEC.md](SPEC.md) for the agreed design and phase plan.

## Run

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

ES modules need HTTP; opening `index.html` straight from disk won't work.

## Status

**Phase 1 (foundation):**
- Angled pixel-art rink and arena
- Cameras: follow, shared with zoom, and split screen
- Input: keyboard, gamepad and touch, with remapping
- Menus, including on-screen d-pad / OK / BACK on touch devices
- Fullscreen

**Phase 2 (puck and goalies):**
- Puck physics with height: lifted shots, bounces off boards, posts and the net, landing on the net roof
- Carrying the puck on a live-drawn stick
- Hold-to-charge shots with aim assist toward the posts, and one-timers
- Passes that lead the receiver. Control switches automatically to whoever receives the pass.
- Poke checks to strip the puck. Inline rules don't allow body checking.
- Sprint stamina
- Goalies that hold their angle, read shots with human-like reaction and error, make saves with rebounds, and cover loose pucks
- Goals, face-offs and a score/shots board
- Modes:
  - Practice: you, a teammate and both goalies
  - 2P versus: 1-on-1 with goalies
  - 2P co-op: two players attacking one goalie

**Phase 3 (team AI):** every skater nobody controls is played by the team AI.
- Loose puck: the closest skater chases it, and the others hold a formation that shifts with the puck.
- Attacking: the carrier drives to the slot, dodges defenders, and shoots away from the goalie or passes into open lanes. Teammates get open: back door, high slot, points, and breakout outlets.
- Defending: one skater pressures and pokes, and the others mark opponents goal-side.
- Pass receivers skate into the puck's path. Goalies make outlet passes to open teammates.
- Difficulty changes opponent speed, reaction time, pokes, passing and aim. Teammates of human players always play at normal.
- 4-on-4 with goalies in VS AI, 2P versus (each player has 3 AI teammates) and 2P co-op.

**Phase 4 (rules engine):** VS AI and 2-player games are full matches under the ruleset you choose in Settings. Values come from the official rulebooks; see [RULES.md](RULES.md) for each rule with its reference.
- Game clock with stop time or running time
- Periods, period breaks, and changing ends
- Penalties: tripping and slashing from missed pokes, and body checking or interference on hard hits
- Delayed penalties, the penalty box, power plays (a power-play goal ends the minor), and a minimum of 3 skaters
- Penalty shots on fouled breakaways
- Sudden-death overtime and shootouts with sudden death
- Final screen
- World Skate: 90-second minors, 3-on-3 overtime, and sudden death with the shooting order reversed
- ISHD: played with a ball, fair checks on the carrier allowed, penalties halved in games under 30 minutes

**Phase 5 (2 players):** versus and co-op on one screen, with shared or split camera and a separate device for each player. These were built during phases 1–3.

**Phase 6 (polish):**
- Synthesized sound effects with no audio files: stick, shots, post pings, boards, saves, hits, whistle, goal horn with crowd cheer, buzzer, crowd murmur and menu blips. Volume is in Settings → Sound.
- Team choice for both sides in VS AI and in the 2-player lobby. There are 4 made-up teams.
- Goal moments: goal light, crowd jumping in the stands, camera shake on goals, post hits and big hits.

## Default controls

| Action | Keyboard 1 | Keyboard 2 | Gamepad (position) |
| --- | --- | --- | --- |
| Move | WASD | Arrows | Left stick / D-pad |
| Shoot | J | Num1 / , | Left face button, right trigger |
| Pass | K | Num2 / . | Bottom face button |
| Poke check | I | Num5 / ; | Right face button |
| Switch player | L | Num3 / / | Left bumper |
| Sprint | Left Shift / Space | Num0 / Right Shift | Right bumper, left trigger |
| Pause | Esc | Backspace | Start |

Menus: arrows/WASD + Enter/Esc, the d-pad and face buttons, or tap/click.

**Fullscreen:** the game goes fullscreen on your first tap, click or key press (turn this off under Settings → Auto fullscreen). The corner button or **F** toggles it. On phones it also tries to lock landscape. iPhone Safari doesn't support fullscreen for web pages.

**Touch:** on phones and tablets the stick and buttons show from the start. Menus have a back button in the top-left corner.
**8BitDo / Nintendo layout:** Settings → Controls → *Button labels* switches the on-screen names, and *Menu confirm* lets you use the right button to confirm. If your controller reports a non-standard mapping, remap it under Settings → Controls → Pad.

## Layout

```
src/
  main.js            loop (fixed 60 Hz) + scene stack
  config.js          rink size, projection, skating, teams
  settings.js        persisted settings + menu options
  engine/            display layers, pixel font, rasteriser, palette, storage
  input/             keyboard, pointers, touch controls, gamepads, bindings, labels
  world/             rink bake, goals, sprites, skater, camera, world renderer
  ui/                menu widget, hint bar, toasts
  scenes/            title, menus, lobby, settings, controls, bindings, rink, pause
```
