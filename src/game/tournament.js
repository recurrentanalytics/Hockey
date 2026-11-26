// Tournament: four teams play a round robin, the top two meet in the final.
// Games without the player's team are simulated. Progress is saved in the browser.
import { TEAMS } from '../config.js';
import { load, save } from '../engine/storage.js';

const KEY = 'tournament';
// Every team plays each other once over three rounds.
const ROUNDS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];

export function loadTournament() {
  const t = load(KEY, null);
  return t && t.v === 1 ? t : null;
}

export function saveTournament(t) {
  save(KEY, t);
}

export function clearTournament() {
  save(KEY, null);
}

export function newTournament(userTeam) {
  // Three opponents; the club teams always meet when one of them is picked.
  let others = Object.keys(TEAMS).filter((k) => k !== userTeam && !TEAMS[k].hidden);
  if (userTeam === 'borstentiere' || userTeam === 'borstis') others = [userTeam === 'borstentiere' ? 'borstis' : 'borstentiere', ...others.filter((k) => !k.startsWith('borst'))];
  others = others.slice(0, 3);
  const teams = [userTeam, ...others];
  const games = [];
  ROUNDS.forEach((round, r) => round.forEach(([a, b]) => games.push({ round: r + 1, home: teams[a], away: teams[b], played: false })));
  const t = { v: 1, user: userTeam, teams, games, final: null, champion: null };
  saveTournament(t);
  return t;
}

/** Points: regulation win 3, win in OT/shootout 2, loss in OT/shootout 1. */
export function standings(t) {
  const rows = Object.fromEntries(t.teams.map((k) => [k, { team: k, gp: 0, w: 0, otw: 0, otl: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  for (const g of t.games) {
    if (!g.played) continue;
    const h = rows[g.home], a = rows[g.away];
    h.gp++; a.gp++;
    h.gf += g.score.home; h.ga += g.score.away;
    a.gf += g.score.away; a.ga += g.score.home;
    const homeWon = g.score.home > g.score.away;
    const [win, loss] = homeWon ? [h, a] : [a, h];
    if (g.how) { win.otw++; win.pts += 2; loss.otl++; loss.pts += 1; } else { win.w++; win.pts += 3; loss.l++; }
  }
  return Object.values(rows).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
}

/** The next game the player's team has to play (or the final), or null. */
export function nextUserGame(t) {
  const g = t.games.find((x) => !x.played && (x.home === t.user || x.away === t.user));
  if (g) return g;
  if (t.final && !t.final.played && (t.final.home === t.user || t.final.away === t.user)) return t.final;
  return null;
}

function poisson(lambda) {
  let k = 0, p = Math.exp(-lambda), s = p;
  const u = Math.random();
  while (u > s) { k++; p *= lambda / k; s += p; }
  return k;
}

/** Quick result for a game without the player. */
export function simulate(g) {
  let home = poisson(2.8), away = poisson(2.8), how = '';
  if (home === away) {
    how = Math.random() < 0.5 ? 'OT' : 'SO';
    if (Math.random() < 0.5) home++; else away++;
  }
  g.played = true;
  g.score = { home, away };
  g.how = how;
}

/** Simulate the other games of a round (everything before the player's next game). */
export function simulateUpTo(t, game) {
  for (const g of t.games) {
    if (g.played || g === game) continue;
    if (g.round <= (game?.round ?? 99)) simulate(g);
  }
}

export function record(t, game, score, how) {
  game.played = true;
  game.score = { home: score.home, away: score.away };
  game.how = how || '';
  advance(t);
  saveTournament(t);
}

/** After the round robin: set up the final; simulate it if the player didn't make it. */
export function advance(t) {
  if (t.games.some((g) => !g.played)) return;
  if (!t.final) {
    const [first, second] = standings(t);
    t.final = { round: 'FINAL', home: first.team, away: second.team, played: false };
  }
  const f = t.final;
  if (!f.played && f.home !== t.user && f.away !== t.user) simulate(f);
  if (f.played) t.champion = f.score.home > f.score.away ? f.home : f.away;
}
