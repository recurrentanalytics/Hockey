# Inline Hockey

A 2.5D pixel-art inline (roller) hockey game for the browser. It runs on desktop and mobile and supports keyboard, touch and any gamepad, including the 8BitDo SN30 Pro. Plain JavaScript with no build step. See [SPEC.md](SPEC.md) for the agreed design and phase plan.

## Run

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

ES modules need HTTP; opening `index.html` straight from disk won't work.

## Status: phase 1 (foundation)

- Angled pixel-art rink: boards with ads, crowd, see-through near boards, goals and markings
- Low-resolution renderer with crisp scaling. The width adapts to the screen's aspect ratio, and there's an optional pixel-perfect mode.
- Cameras: follow (1P), shared with zoom (2P), split screen (2P)
- Input: two keyboard layouts, gamepads (standard and non-standard mappings), and on-screen touch controls
- Remapping per device, saved in the browser, with a live input tester and raw button readout for odd controllers
- Menus: title, main menu, vs-AI setup, 2-player lobby (join with your own device), settings, controls, pause
- Free skate on the rink, to try out skating and the cameras

The puck, the AI, the rules and the full match engine come in phases 2–4.

## Default controls

| Action | Keyboard 1 | Keyboard 2 | Gamepad (position) |
| --- | --- | --- | --- |
| Move | WASD | Arrows | Left stick / D-pad |
| Shoot | J | Num1 / , | Left face button, right trigger |
| Pass | K | Num2 / . | Bottom face button |
| Check | I | Num5 / ; | Right face button |
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
