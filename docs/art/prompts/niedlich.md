# Bühne im niedlichen Maß (Kandidatenrunden 2026-11-28)

Nach den Chibi-Figuren (`art/candidates/2026-11-28-figuren/`) hat der Besitzer den 32 Pixel hohen Spieler gewählt, Variante 4, Asset `94403fa4-3412-479a-a5c2-6c92171fa2de`: „so niedlich wie möglich“. Das sind etwa 23 Pixel je Meter. Alles, was auf Augenhöhe neben den Figuren steht, wurde in diesem Maß neu gezeichnet.

Kandidaten: `art/candidates/2026-11-28-niedlich/` (nicht in Git), Zuordnung in `candidates.txt`, Vergleichsbogen `bogen.png`, Szene in Weltgröße `szene.png`.

**Modell:** `pixel-engine-image-v1`, 4 Varianten je Motiv, 6 Credits je Bild. Es zeichnet exakt in der bestellten Größe.

**Aufträge:** dieselben Motivteile wie in `einheitlich.md`, ergänzt um „Cute, rounded, friendly, very readable“. Stil: „cute chibi pixel art, 1px warm dark brown outline, flat colours, one shade step, light from upper left“.

**Bestellte Größen** in Pixeln, bei 23 Pixeln je Meter:

| Motiv | Größe |
|---|---|
| Bank | 24×22 |
| Laterne | 28×104 |
| Fahrradbügel | 20×20 |
| Mülleimer | 16×24 |
| Picknicktisch | 40×20 |
| Klettergerüst | 60×51 |
| Nilpferd | 38×26 |

Der Fahrradbügel wurde zweimal bestellt. In der ersten Runde kamen nur Doppelbügel, die zweite Runde verlangte „exactly one bent steel tube … Only one hoop“.

**Zusätzlich bestellt und nicht verwendet:**

| Was | Warum nicht verwendet |
|---|---|
| Schornstein, Gaube, Dachfenster | Die Dachteile gehören zur Kulisse und bleiben bei 12,5. Die erste Gauben-Runde lieferte außerdem ganze Häuschen. |
| Bäume mit Vorlage | Das Bildmodell behält das 128er-Raster. |
| Drei Fassadentests | Ergebnisraster 160, 96 und 42 statt der nötigen etwa 300 Pixel (siehe `docs/art/HAEUSER.md`, Maßstab). |

## Auswahl

Der Besitzer hat gesagt: „mach, wie du denkst, dass es am einheitlichsten und süßesten ist“. Gewählt hat Claude:

| Motiv | Asset | Bild | Pixel je Meter |
|---|---|---|---|
| Bank | `a897dd63-5aa5-4ffa-91c5-e2aaa557f394` | 24×22 | 24,4 |
| Laterne | `c1b3b967-575d-4f6e-a01f-4f42c6d0dbcc` | 28×104 | 23,1 |
| Fahrradbügel | `e9d42756-b81d-46e9-8635-6b51af8b02ee` | 20×20 | 23,5 |
| Mülleimer | `4f0ff6b8-61df-48b0-8a1a-f393f7948f17` | 16×24 | 24,0 |
| Picknicktisch | `a220abc8-6c81-4089-bc73-4bf36d9d5df0` | 40×20 | 25,0 |
| Klettergerüst | `c0ba40bd-8d47-4445-b54f-5c395393ca3f` | 60×50 | 22,7 |
| Nilpferd | `6a950971-3d39-47a6-b68b-6010cd8ea363` | 38×26 | 23,6 |

Die Assets ersetzen die Fassung aus `einheitlich.md` unter derselben Kennung. Die Bäume aus jener Runde bleiben.

## Spielerfigur in der Welt

**Vorlage:** der 32er-Chibi, Variante 4 (`94403fa4-3412-479a-a5c2-6c92171fa2de`), aus der Runde `art/candidates/2026-11-28-figuren/`.

Der Auftrag für diese Runde war:
> Cute chibi kid inline hockey player, big round head with dark green helmet, small body, dark green jersey with cream trim and orange stripe, dark brown pants, inline skates, holding a hockey stick, standing, three-quarter side view. Readable, a few telling details. No ground, no shadow.

Bestellt wurde mit `pixel-engine-image-v1` in 32×32 Pixeln, mit der Palette des Borstentiere-Trikots.

**Animation:** `animate_game_art`, 8 Bilder, mit beiden Animationsmodellen zum Vergleich. Gewählt ist `pixel-engine-v1.5` (`17823e5b-5101-431d-bc79-c0a0f46dd8f2`), weil der Beinschritt dort deutlicher ist. Die andere Fassung ist `cf3295bb-9d02-43d8-90a9-730117b360b0` (v1.1). Bewegungsauftrag:
> The cute chibi kid inline hockey player in the dark green helmet and green jersey with cream and orange stripes skates forward on inline skates in place: alternating long gliding strides, one skate pushing out to the side and back while the other glides, body leaning slightly forward and bobbing gently, both hands on the hockey stick with its blade low near the ground and swinging slightly with the rhythm. The head, helmet and face stay steady and friendly. Loops seamlessly.

**In der Welt:** Die Figur ersetzt `character.skater.stride`. Das Bild ist 32×34 Pixel groß, das Kind darin 33 Pixel hoch. `worldHeight` beträgt 1,44 m, damit das Kind 1,4 m groß ist; das entspricht 23,6 Pixeln je Meter. Die Figur trägt die Vereinsfarben schon selbst, deshalb gibt es keine `teamColors` mehr. Gegnerfarben brauchen eine eigene Fassung.
