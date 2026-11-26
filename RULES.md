# Rulesets

The game ships three rulesets you can choose in Settings → Rules. Each one is a data block in `src/game/rules.js`.

**Status: provisional.** The official rulebooks couldn't be opened from the build environment; their sites were blocked. The values come from web search results. **Verified** means a search result quoted it. Everything else is **unconfirmed** and needs checking against the rulebook.

## World Skate (international inline hockey)

| Item | Value | Status |
| --- | --- | --- |
| Periods | 2 × 20 min | Verified |
| Clock | Stop time | Unconfirmed |
| Players | 4 skaters + goalie | Standard for inline |
| Body checking | Not allowed (called as a minor) | Unconfirmed |
| Minor / major | 2 / 5 min | Verified (bench minor = 2 min) |
| Power-play goal ends the minor | Yes | Unconfirmed |
| Overtime | 5 min, ends on the first goal | Verified |
| Overtime skaters | 4 | Unconfirmed |
| Shootout after overtime | Yes | Verified |
| Shootout shooters | 3, then sudden death | Unconfirmed |
| Penalty shot instead of a penalty in the last 2 minutes / OT | Not modelled yet | Verified that it exists, details unknown |

## USARS (USA Roller Sports)

| Item | Value | Status |
| --- | --- | --- |
| Halves | 2 × 18 min (rulebook range 16–20) | Verified range |
| Clock | Running time | Verified |
| Body checking | Not allowed | Unconfirmed |
| Minor / major | 2 / 5 min | Major verified |
| Overtime | 10 min sudden death | Unconfirmed (low-quality source) |
| Shootout | 3 shooters, then sudden death | Unconfirmed |
| Time-outs | 1 per team per game, 1 min | Verified, not modelled yet |

## ISHD (German Inline-Skaterhockey)

| Item | Value | Status |
| --- | --- | --- |
| Game object | **Ball** (orange; rolls further, bounces more) | Unconfirmed |
| Periods | 3 × 20 min | Unconfirmed (club article) |
| Clock | Stop time; time penalties served with the clock stopped | Penalties verified |
| Body checking | Allowed against the ball carrier; other hits called as interference | Unconfirmed |
| Minor / major | 2 / 5 min (10 min disciplinary not modelled) | Verified |
| Overtime | None: a draw goes straight to a shootout | Verified |
| Shootout | 5 shooters, then sudden death. Players with a penalty still running may not shoot. | Shootout and penalty rule verified; shooter count unconfirmed |

## Rules common to all rulesets

- **Teams change ends** after each period.
- **Delayed penalty:** play continues until the offending team touches the puck. A goal by the fouled team cancels the minor.
- **Strength:** a team never drops below 3 skaters. Further penalties wait until a spot frees up.
- **Penalty shot:** awarded when a player on a clear breakaway is fouled.
- **Fouls the game can call:**
  - tripping or slashing, when a poke check catches a body instead of the puck
  - body checking or interference, on hard hits by human players
- **Shortened periods:** if you pick shorter periods than the rulebook, penalty lengths shrink in proportion (30 seconds at least).
- **Face-offs:**
  - centre at the start of each period and after goals
  - nearest end-zone spot after the goalie covers the puck
  - the offending team's end after a penalty
- **Not modelled yet:** icing and offside (most inline rules have no offside), time-outs, majors, misconducts.

## Sources (search results)

- [World Skate Inline Hockey Rulebook 2021](https://www.worldskate.org/inline-hockey/about/regulations.html?download=4819:inline-hockey-rulebook-2021)
- [World Skate Inline Hockey Rulebook 2026 (rollerhockey.si mirror)](https://rollerhockey.si/wp-content/uploads/2025/10/WSK-Inline-Hockey-Rulebook-2026.pdf)
- [USARS Official Rules of Inline Hockey (aausports.org mirror)](https://image.aausports.org/dnn/hockey/pdf/USARSRuleBook.pdf)
- [USA Roller Sports official rules page](https://www.usarollersports.org/usars-resources/official-rules)
- [ISHD Offizielle Spielregeln Inline-Skaterhockey 2026/2027](https://ishd.de/dokumente/2026/spielregeln.2026.pdf)
- [ISHD Wettkampfordnung 2025](https://ishd.de/dokumente/2025/wko.2025.pdf) and [2022](https://ishd.de/dokumente/2022/wko.2022.pdf)
- [ISHD Casebook 2023](https://ishd.de/dokumente/2023/casebook.2023.pdf)
- [Inline-Skaterhockey overview (vereinsticket.de)](https://www.vereinsticket.de/neuigkeiten/alles-was-du-ueber-inline-skaterhockey-wissen-musst)
