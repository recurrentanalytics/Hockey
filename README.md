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

**After phase 6:**
- Rulebook time-outs and fatigue
- Majors for checking from behind
- A face-off timing draw
- Animations: goalie butterfly, knockdowns from checks, the scorer raising the stick
- A stats table on the final screen

**More:**
- **Line changes:** each team has two lines of 4 skaters (8 in all). A tired line swaps for the rested one at stoppages, and the bench recovers.
- **Realistic animations:** an 8-phase stride with arm swing, crossovers in turns, hockey stops, shot wind-ups and follow-throughs, poke-check lunges, stickhandling, falls (stumble, sprawl, kneel, get up), face-off crouches, breathing and tired poses. Goalies breathe, shuffle, and make glove, blocker and butterfly saves. After goals there is a group hug and the beaten team hangs their heads. The net wobbles and the crowd does the wave.
- **Goal replays:** a slow-motion replay with TV letterbox after every goal; skip with confirm/shoot. You can turn replays off in Settings → Goal replays.
- **Player stats:** goals, assists (from the passing chain) and shots on goal for every skater, saves for goalies. A scorer line shows after each goal, and the final screen names the three stars of the game.
- **Tournament:** 4 teams play a round robin, then the top two meet in the final. Scoring is 3 points for a regulation win, 2 for a win in OT or the shootout, and 1 for a loss in OT or the shootout. Games without you are simulated, and progress is saved in the browser.

**Boni Borstentiere:** the club from Hannover-List is in the game ([website](https://recurrentanalytics.github.io/boni-borstentiere-website/)).
- **BORSTENTIERE** play in green with orange and cream stripes. Their #61 is **Bonny**, the little wild boar from the Eilenriede, and their goalies have boar ears on the mask.
- **BALDING BORSTIS** are the adults' section: bald heads, glasses, and a Keiler goalie mask ("Haare optional"). When the two meet, the away side wears a cream kit.
- **Venue:** a second venue, **Bonifatiusplatz**, an outdoor asphalt pitch with wooden boards, Eilenriede trees, parents watching and the playground hippo. Bonny's face replaces the centre logo in club games.
- **Hymn and chants:** the club hymn (`audio/hymne.mp3`, from the club website) is the club's goal song. Chants from the site and the Bonny comic: TOOORRR!!!, BONNY! BONNY! BONNY!, WAS SIND WIR? EIN BORSTENTIER!, ZUSAMMEN SIND WIR STARK!

**Extras:**
- Hair under the helmets, and team animals on the jerseys.
- Players hop for joy after a goal.
- A video wall at stoppages: kiss cam, Bonny cam, dance cam and a goal card.

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

### 8BitDo SN30 Pro (and other gamepads)

- **Modes:** choose one when switching the pad on.
  - START+X: Windows (X-input). The browser sees an Xbox pad, and rumble works.
  - START+B: Android (D-input). Detected automatically, including the d-pad hat.
  - START+A: macOS
  - START+Y: Switch. Detected as a Pro Controller, with Nintendo letters.
- **Default buttons** (SN30 letters): **A pass**, B or ZR shoot, Y poke check, X or L switch, R or ZL sprint, START pause. Move with the d-pad or the left stick. A confirms in menus and B goes back; Settings → Controls → Menu confirm changes this. Xbox and PlayStation pads are laid out by position instead: bottom pass, left shoot, right poke check.
- **A not passing?** If the browser reports the pad as an Xbox or PlayStation pad, set Settings → Controls → **Button labels: NINTENDO (A PASS)**. That switches labels and layout for every pad.
- **Guided setup:** Settings → Controls → *Pad 1* → **Guided setup**. A drawing of the pad lights up each button to press, so the mapping and the letters on screen match your pad in any mode and browser. It's recommended for X-input mode, where the browser reports an Xbox pad.
- **Rumble:** hits, goals, shots and posts, where the browser and mode support it (Chrome, X-input). Turn it off under Controls → Rumble.

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
