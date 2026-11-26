// Rulesets. Each one is plain data the referee reads.
//
// Sources: search results only – the official PDFs could not be opened from the build
// environment. Values marked VERIFIED appeared in the search results; everything else
// is PROVISIONAL and needs confirming against the rulebook.
//   World Skate rulebook 2021 / 2026 (worldskate.org, rollerhockey.si mirror)
//   USARS "Official Rules of Inline Hockey" (aausports.org mirror)
//   DRIV/ISHD "Offizielle Spielregeln Inline-Skaterhockey 2026/2027", WKO 2025 (ishd.de)

export const RULESETS = {
  worldskate: {
    name: 'WORLD SKATE',
    periods: 2, periodMinutes: 20,            // VERIFIED: two 20-minute periods
    periodName: 'PERIOD',
    clock: 'stop',                            // PROVISIONAL: stop time
    skaters: 4,                               // 4 skaters + goalie
    minSkaters: 3,                            // PROVISIONAL
    bodyCheck: false,                         // PROVISIONAL: body checking prohibited
    ball: false,
    minor: 2, major: 5,                       // minor 2 min (bench minor VERIFIED), major 5
    ppGoalEndsMinor: true,                    // PROVISIONAL
    overtime: { minutes: 5, suddenDeath: true, skaters: 4 }, // VERIFIED: 5 min, ends on goal; skaters PROVISIONAL
    shootout: { rounds: 3 },                  // VERIFIED: shootout after OT; rounds PROVISIONAL
    switchEnds: true,
  },
  usars: {
    name: 'USARS',
    periods: 2, periodMinutes: 18,            // VERIFIED range: halves of 16–20 min
    periodName: 'HALF',
    clock: 'running',                         // VERIFIED: running time
    skaters: 4,
    minSkaters: 3,                            // PROVISIONAL
    bodyCheck: false,                         // PROVISIONAL
    ball: false,
    minor: 2, major: 5,                       // VERIFIED: major 5 (match penalty), minor 2 general practice
    ppGoalEndsMinor: true,                    // PROVISIONAL
    overtime: { minutes: 10, suddenDeath: true, skaters: 4 }, // PROVISIONAL (low-authority source)
    shootout: { rounds: 3 },                  // PROVISIONAL
    switchEnds: true,
  },
  ishd: {
    name: 'ISHD',
    periods: 3, periodMinutes: 20,            // PROVISIONAL: 3 x 20 (third-party source)
    periodName: 'DRITTEL',
    clock: 'stop',                            // PROVISIONAL; time penalties are served with stopped time (VERIFIED)
    skaters: 4,
    minSkaters: 3,                            // PROVISIONAL
    bodyCheck: true,                          // PROVISIONAL: inline-skaterhockey allows checking the ball carrier
    ball: true,                               // PROVISIONAL: inline-skaterhockey is played with a ball
    minor: 2, major: 5,                       // VERIFIED: minor 2, major 5 (disciplinary 10 not modelled)
    ppGoalEndsMinor: true,                    // PROVISIONAL
    overtime: null,                           // VERIFIED: a draw goes straight to a penalty shootout
    shootout: { rounds: 5 },                  // shootout VERIFIED; rounds PROVISIONAL
    switchEnds: true,
  },
};

/** Ruleset with the chosen period length applied. Penalties scale with shortened periods. */
export function resolveRules(id, periodLength = 'rulebook') {
  const base = RULESETS[id] ?? RULESETS.worldskate;
  const minutes = periodLength === 'rulebook' ? base.periodMinutes : Number(periodLength);
  const periodSeconds = minutes * 60;
  const scale = Math.min(1, periodSeconds / (base.periodMinutes * 60));
  return {
    ...base,
    id,
    periodSeconds,
    penaltyScale: Math.max(0.25, scale),
    overtimeSeconds: base.overtime ? Math.min(base.overtime.minutes * 60, Math.max(60, periodSeconds)) : 0,
  };
}
