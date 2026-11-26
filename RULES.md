# Rulesets

Choose one under Settings → Rules. Each ruleset is a data block in `src/game/rules.js`. All values below come from the official rulebooks; the numbers in brackets are rule numbers.

**Sources**
- **World Skate:** [Rulebook Inline Hockey 2026](https://rollerhockey.si/wp-content/uploads/2025/10/WSK-Inline-Hockey-Rulebook-2026.pdf) (latest update June 2025)
- **USARS:** [Official Rules of Inline Hockey 2021–2022](https://image.aausports.org/dnn/hockey/pdf/USARSRuleBook.pdf)
- **ISHD / DRIV:** [Offizielle Spielregeln Inline-Skaterhockey 2026/2027](https://ishd.de/dokumente/2026/spielregeln.2026.pdf) and [Wettkampfordnung 2025](https://ishd.de/dokumente/2025/wko.2025.pdf)

None of the three rulebooks has icing or offside.

## World Skate (international inline hockey)

| Item | In the game |
| --- | --- |
| Periods | 2 × 20 min, teams change ends [1.2 A] |
| Clock | Stop time (penalties and play count actual playing time) [6.1] |
| Players | 4 skaters + goalie |
| Minor / major | **90 seconds** [6.1.2 A] / **4 min** [6.1.3 A] |
| Minimum strength | 3 players including the goalie, so at least 2 skaters; further penalties are stacked [6.2.1 A] |
| Power-play goal | Ends the first minor [6.2.1 B] |
| Hard hits | Called as charging [6.4.12, 6.4.13] |
| Checking from behind | **Major** (4 min) [6.4.26 A]; the game misconduct isn't modelled |
| Time-outs | 1 per team per period, 60 s; none in overtime [1.2 B] |
| Penalty shot | Carrier fouled from behind on a clear breakaway in the attacking half [6.1.9] |
| Overtime | 5 min sudden death, **3 on 3**, no change of ends [1.3] |
| Shootout | 3 shooters per team, then one each in sudden death with the shooting order reversed [1.3] |

## USARS (USA Roller Sports)

| Item | In the game |
| --- | --- |
| Periods | 2 × 16 min [74.1]. Leagues may use their own timing; the AAU tournament variant uses 16–20 min halves of running time. |
| Clock | Stop time: playing time stops on the whistle [73] |
| Minor / major | 2 min [16.1] / 5 min [20] |
| Minimum strength | No fewer than 2 skaters [27.1] |
| Power-play goal | Ends the minor [16.2] |
| Hard hits | Body checking is a roughing minor [48.2] |
| Checking from behind | Minor [42.2]; the misconduct isn't modelled |
| Time-outs | One 30-second time-out per game [82.1] |
| Overtime | 10 min sudden death, no change of ends [79.1] |
| Shootout | 3 shooters each, then sudden death [79.2] |

## ISHD (German Inline-Skaterhockey)

| Item | In the game |
| --- | --- |
| Game object | **Orange ball** [2.2] |
| Periods | 3 × 20 min (women/men) [WKO 22.1] |
| Clock | Stopped playing time [WKO 22.1] |
| Minor / major | 2 min [7.2] / 5 min [7.4] (10 min disciplinary not modelled) |
| Short games | If total playing time is under 30 min, all time penalties are halved [8.25.15] |
| Minimum strength | 2 field players + goalie |
| Power-play goal | Ends the first minor [7.2.3] |
| Checking | Fair check allowed only against the ball carrier, from the front or side [8.9.1]. Other hard hits are illegal checks [8.10.2], and hits from behind are always called. |
| Checking from behind | **Major** (5 min) [8.10.12 a] |
| Time-outs | One 30-second time-out per period, overtime included, not in the shootout [8.26.1] |
| Draw | League games go straight to a penalty shootout. Cup and playoff games (2 × 10 min overtime) are not modelled. |
| Shootout | 5 shooters each, then the same order until decided. Players with a running penalty can't shoot [8.24]. |

## Rules common to all rulesets

- **Delayed penalty:** play continues until the offending team touches the puck. A goal by the fouled team cancels the minor.
- **Fouls the game calls:**
  - tripping or slashing, when a poke check catches a body instead of the puck
  - hard hits by human players: charging, roughing or illegal check, depending on the ruleset
  - checking from behind
- **Incidental contact:** the AI skates around opponents, so contact between AI players isn't called.
- **Face-offs:**
  - centre at the start of each period and after goals
  - nearest end-zone spot after the goalie covers the puck
  - the offending team's end after a penalty
- **Shortened periods:** World Skate and USARS shrink penalties in proportion to the period length (to a quarter at least). ISHD uses its own halving rule.
- **Majors** are served in full: a power-play goal doesn't end them.
- **Time-outs:** call one from the pause menu; it's taken at the next stoppage. Your team gets back most of its energy. Skaters slowly tire from hard skating and sprinting (up to 15% slower), and recover during stoppages, intermissions and time-outs. AI teams take a time-out when tired, or when trailing by 1–2 goals in the last 2 minutes.
- **Face-off draw:** the centre who presses SHOOT or PASS first after the drop wins it back to a teammate. Pressing before the drop loses the draw.
- **Not modelled yet:**
  - misconducts and game misconducts
  - delay-of-game situations, such as holding the puck against the boards
