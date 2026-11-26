// Rulesets, taken from the official rulebooks. Each one is plain data the referee reads.
//   World Skate  – Rulebook Inline Hockey 2026 (update June 2025)
//   USARS        – Official Rules of Inline Hockey 2021-2022
//   ISHD (DRIV)  – Offizielle Spielregeln Inline-Skaterhockey 2026/2027 + Wettkampfordnung 2025
// None of the three has icing or offside. Rule numbers are in RULES.md.

export const RULESETS = {
  worldskate: {
    name: 'WORLD SKATE',
    periods: 2, periodMinutes: 20,                 // 1.2 A: two periods of 20 min, change ends
    periodName: 'PERIOD',
    clock: 'stop',                                 // 6.1: penalties and play are actual playing time
    skaters: 4,
    minSkaters: 2,                                 // 6.2.1 A: never below 3 players incl. goalkeeper
    bodyCheck: false,
    hitFoul: 'CHARGING',                           // 6.4.12 / 6.4.13
    ball: false,
    minor: 1.5,                                    // 6.1.2 A: minor = 90 seconds
    major: 4,                                      // 6.1.3 A: four-minute time penalty
    ppGoalEndsMinor: true,                         // 6.2.1 B
    overtime: { minutes: 5, suddenDeath: true, skaters: 3, switchEnds: false }, // 1.3: 5 min, 3 on 3, same ends
    shootout: { rounds: 3, reverseSuddenDeath: true }, // 1.3: three shooters, then one each, order reversed
    timeouts: { per: 'period', seconds: 60, inOvertime: false }, // 1.2 B / 5.x F: one per period, none in OT
    fromBehind: 'major',                           // 6.4.26 A: major (+ game misconduct, not modelled)
    penaltyScaling: 'proportional',
    switchEnds: true,                              // teams change ends between periods
  },
  usars: {
    name: 'USARS',
    periods: 2, periodMinutes: 16,                 // 74.1: two 16-minute periods, 1-min intermission
    periodName: 'PERIOD',
    clock: 'stop',                                 // 73: time stops on the whistle (leagues may run a running clock)
    skaters: 4,
    minSkaters: 2,                                 // 27.1: on-rink strength no less than two skaters
    bodyCheck: false,
    hitFoul: 'ROUGHING',                           // 48.2: body checking is a roughing minor
    ball: false,
    minor: 2,                                      // 16.1
    major: 5,                                      // 20
    ppGoalEndsMinor: true,                         // 16.2
    overtime: { minutes: 10, suddenDeath: true, skaters: 4, switchEnds: false }, // 79.1: 10-min sudden death, same ends
    shootout: { rounds: 3, reverseSuddenDeath: false }, // 79.2: three shooters each, then sudden death
    timeouts: { per: 'game', seconds: 30, inOvertime: true }, // 82.1: one 30-second time-out per game
    fromBehind: 'minor',                           // 42.2: minor + misconduct (misconduct not modelled)
    penaltyScaling: 'proportional',
    switchEnds: true,                              // teams change ends between periods
  },
  ishd: {
    name: 'ISHD',
    periods: 3, periodMinutes: 20,                 // WKO 22.1: 3 x 20 min (Damen/Herren)
    periodName: 'DRITTEL',
    clock: 'stop',                                 // WKO 22.1: stopped playing time
    skaters: 4,
    minSkaters: 2,                                 // 7.x: play continues with two field players + goalie
    bodyCheck: true,                               // 8.9.1: fair check on the ball carrier, from the front or side
    hitFoul: 'ILLEGAL CHECK',                      // 8.10.2: unerlaubter Körperangriff
    ball: true,                                    // 2.2: orange ball
    minor: 2,                                      // 7.2
    major: 5,                                      // 7.4
    ppGoalEndsMinor: true,                         // 7.2.3
    overtime: null,                                // league games: a draw goes to a penalty shootout (WKO)
    shootout: { rounds: 5, reverseSuddenDeath: false }, // 8.24: five shooters, then same order until decided
    timeouts: { per: 'period', seconds: 30, inOvertime: true }, // 8.26.1: 30 s per period incl. overtime
    fromBehind: 'major',                           // 8.10.12 a: Große Zeitstrafe (5')
    penaltyScaling: 'halveUnder30',                // 8.25.15: total time under 30 min halves all penalties
    switchEnds: true,
  },
};

/** Ruleset with the chosen period length applied. */
export function resolveRules(id, periodLength = 'rulebook') {
  const base = RULESETS[id] ?? RULESETS.worldskate;
  const minutes = periodLength === 'rulebook' ? base.periodMinutes : Number(periodLength);
  const periodSeconds = minutes * 60;
  let penaltyScale;
  if (base.penaltyScaling === 'halveUnder30') {
    penaltyScale = minutes * base.periods < 30 ? 0.5 : 1;
  } else {
    // Shortened periods shrink penalties in proportion, but never below a quarter.
    penaltyScale = Math.max(0.25, Math.min(1, minutes / base.periodMinutes));
  }
  return {
    ...base,
    id,
    periodSeconds,
    penaltyScale,
    overtimeSeconds: base.overtime ? Math.min(base.overtime.minutes * 60, Math.max(60, periodSeconds)) : 0,
  };
}
