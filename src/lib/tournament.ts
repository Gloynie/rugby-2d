import { COMPETITIONS, getTeam } from "@/game/data";
import type { Competition } from "@/game/types";

export interface Fixture {
  id: string;
  home: string;
  away: string;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
  homeTries?: number;
  awayTries?: number;
  user: boolean;
  note?: string;
}

export interface KnockoutStage {
  name: string;
  fixtures: Fixture[];
}

export interface TournamentState {
  competitionId: string;
  userTeamId: string;
  format: "league" | "worldcup";
  pools?: string[][];
  rounds: Fixture[][];
  currentRound: number;
  knockout: KnockoutStage[];
  currentStage: number;
  stage: "league" | "knockout" | "finished";
  champion?: string;
  userEliminated: boolean;
  userPosition?: string;
  log: string[];
}

export interface ScoreLine {
  homeScore: number;
  awayScore: number;
  homeTries: number;
  awayTries: number;
}

export interface TableRow {
  teamId: string;
  p: number;
  w: number;
  d: number;
  l: number;
  pf: number;
  pa: number;
  pd: number;
  bp: number;
  pts: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function simulateScore(homeRating: number, awayRating: number, neutral = false): ScoreLine {
  const diff = (homeRating - awayRating) * 0.6 + (neutral ? 0 : 3);
  const gen = (exp: number) => {
    const total = Math.max(0, exp * (0.5 + Math.random()));
    const tries = clamp(Math.round((total / 7) * (0.6 + Math.random() * 0.7)), 0, 9);
    let convs = 0;
    for (let i = 0; i < tries; i++) if (Math.random() < 0.74) convs++;
    const pens = clamp(Math.round(Math.max(0, (total - tries * 7) / 3) * Math.random()), 0, 5);
    const dg = Math.random() < 0.06 ? 1 : 0;
    return { score: tries * 5 + convs * 2 + pens * 3 + dg * 3, tries };
  };
  const h = gen(Math.max(6, 24 + diff / 2));
  const a = gen(Math.max(6, 24 - diff / 2));
  return { homeScore: h.score, awayScore: a.score, homeTries: h.tries, awayTries: a.tries };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function roundRobin(ids: string[]): [string, string][][] {
  const teams = [...ids];
  if (teams.length % 2) teams.push("BYE");
  const n = teams.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = teams[i];
      const b = teams[n - 1 - i];
      if (a !== "BYE" && b !== "BYE") round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    teams.splice(1, 0, teams.pop() as string);
  }
  return rounds;
}

let fixtureCounter = 0;
function mk(home: string, away: string, userTeamId: string, prefix: string): Fixture {
  fixtureCounter++;
  return {
    id: `${prefix}-${home}-${away}-${fixtureCounter}`,
    home,
    away,
    played: false,
    user: home === userTeamId || away === userTeamId,
  };
}

export function createTournament(comp: Competition, userTeamId: string): TournamentState {
  const state: TournamentState = {
    competitionId: comp.id,
    userTeamId,
    format: comp.format,
    rounds: [],
    currentRound: 0,
    knockout: [],
    currentStage: -1,
    stage: "league",
    userEliminated: false,
    log: [],
  };
  if (comp.format === "worldcup") {
    const sorted = [...comp.teamIds].sort((a, b) => getTeam(b).rating - getTeam(a).rating);
    const pools: string[][] = [[], [], [], []];
    for (let pot = 0; pot < 4; pot++) {
      const potTeams = shuffle(sorted.slice(pot * 4, pot * 4 + 4));
      potTeams.forEach((t, i) => pools[i].push(t));
    }
    state.pools = pools;
    const poolRounds = pools.map((p) => roundRobin(shuffle(p)));
    for (let r = 0; r < 3; r++) {
      const round: Fixture[] = [];
      poolRounds.forEach((pr, pi) => {
        for (const [h, a] of pr[r]) round.push(mk(h, a, userTeamId, `p${pi}r${r}`));
      });
      state.rounds.push(round);
    }
  } else {
    const rr = roundRobin(shuffle(comp.teamIds));
    state.rounds = rr.map((round, r) => round.map(([h, a]) => mk(h, a, userTeamId, `r${r}`)));
    if (comp.doubleRound) {
      const second = rr.map((round, r) => round.map(([h, a]) => mk(a, h, userTeamId, `r${r + rr.length}`)));
      state.rounds.push(...second);
    }
  }
  state.log.push(`${comp.name} begins. You are ${getTeam(userTeamId).name}.`);
  return normalize(state);
}

export function tableFor(state: TournamentState, teamIds: string[]): TableRow[] {
  const rows = new Map<string, TableRow>();
  for (const id of teamIds) rows.set(id, { teamId: id, p: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, pd: 0, bp: 0, pts: 0 });
  for (const round of state.rounds) {
    for (const f of round) {
      if (!f.played) continue;
      const h = rows.get(f.home);
      const a = rows.get(f.away);
      if (!h || !a) continue;
      const hs = f.homeScore ?? 0;
      const as = f.awayScore ?? 0;
      h.p++; a.p++;
      h.pf += hs; h.pa += as; a.pf += as; a.pa += hs;
      if (hs > as) { h.w++; a.l++; h.pts += 4; if (hs - as <= 7) { a.bp++; a.pts++; } }
      else if (as > hs) { a.w++; h.l++; a.pts += 4; if (as - hs <= 7) { h.bp++; h.pts++; } }
      else { h.d++; a.d++; h.pts += 2; a.pts += 2; }
      if ((f.homeTries ?? 0) >= 4) { h.bp++; h.pts++; }
      if ((f.awayTries ?? 0) >= 4) { a.bp++; a.pts++; }
    }
  }
  for (const r of rows.values()) r.pd = r.pf - r.pa;
  return [...rows.values()].sort(
    (x, y) => y.pts - x.pts || y.pd - x.pd || y.pf - x.pf || getTeam(y.teamId).rating - getTeam(x.teamId).rating,
  );
}

export function nextUserFixture(state: TournamentState): { fixture: Fixture; label: string } | null {
  if (state.stage === "league") {
    const round = state.rounds[state.currentRound];
    if (!round) return null;
    const f = round.find((x) => x.user && !x.played);
    return f ? { fixture: f, label: `Round ${state.currentRound + 1}` } : null;
  }
  if (state.stage === "knockout") {
    const st = state.knockout[state.currentStage];
    if (!st) return null;
    const f = st.fixtures.find((x) => x.user && !x.played);
    return f ? { fixture: f, label: st.name } : null;
  }
  return null;
}

function simulateFixture(f: Fixture, neutral: boolean, knockout: boolean): void {
  const s = simulateScore(getTeam(f.home).rating, getTeam(f.away).rating, neutral);
  if (knockout && s.homeScore === s.awayScore) {
    if (getTeam(f.home).rating >= getTeam(f.away).rating) s.homeScore += 3;
    else s.awayScore += 3;
    f.note = "after extra time";
  }
  Object.assign(f, s, { played: true });
}

function winnerOf(f: Fixture): string {
  return (f.homeScore ?? 0) >= (f.awayScore ?? 0) ? f.home : f.away;
}

function stageNames(n: number): string[] {
  if (n === 8) return ["Quarter-finals", "Semi-finals", "Final"];
  if (n === 4) return ["Semi-finals", "Final"];
  return ["Final"];
}

function buildKnockout(state: TournamentState, comp: Competition): void {
  let pairs: [string, string][] = [];
  if (state.format === "worldcup" && state.pools) {
    const tabs = state.pools.map((p) => tableFor(state, p));
    const t = (pool: number, pos: number) => tabs[pool][pos].teamId;
    pairs = [[t(0, 0), t(1, 1)], [t(2, 0), t(3, 1)], [t(1, 0), t(0, 1)], [t(3, 0), t(2, 1)]];
    state.log.push("Pool stage complete. Quarter-final line-up confirmed.");
  } else {
    const n = comp.playoffTeams ?? 0;
    const table = tableFor(state, comp.teamIds);
    const q = table.slice(0, n).map((r) => r.teamId);
    if (n === 8) pairs = [[q[0], q[7]], [q[3], q[4]], [q[1], q[6]], [q[2], q[5]]];
    else if (n === 4) pairs = [[q[0], q[3]], [q[1], q[2]]];
    state.log.push("Regular season complete. Play-offs begin.");
  }
  const names = stageNames(pairs.length * 2);
  state.knockout = [{ name: names[0], fixtures: pairs.map(([h, a]) => mk(h, a, state.userTeamId, names[0])) }];
  state.currentStage = 0;
  state.stage = "knockout";
  const inKo = pairs.some(([h, a]) => h === state.userTeamId || a === state.userTeamId);
  if (!inKo) {
    state.userEliminated = true;
    const table = state.format === "worldcup" && state.pools
      ? tableFor(state, state.pools.find((p) => p.includes(state.userTeamId)) ?? [])
      : tableFor(state, comp.teamIds);
    const pos = table.findIndex((r) => r.teamId === state.userTeamId) + 1;
    state.userPosition = state.format === "worldcup" ? `Pool stage (${ordinal(pos)} in pool)` : `${ordinal(pos)} in the regular season`;
    state.log.push(`${getTeam(state.userTeamId).name} did not qualify for the knockout stage.`);
  }
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function normalize(state: TournamentState): TournamentState {
  const comp = COMPETITIONS.find((c) => c.id === state.competitionId);
  if (!comp) return state;
  let guard = 0;
  while (guard++ < 100) {
    if (state.stage === "league") {
      if (state.currentRound >= state.rounds.length) {
        const hasKo = state.format === "worldcup" || (comp.playoffTeams ?? 0) > 0;
        if (hasKo) {
          buildKnockout(state, comp);
          continue;
        }
        const table = tableFor(state, comp.teamIds);
        state.champion = table[0].teamId;
        const pos = table.findIndex((r) => r.teamId === state.userTeamId) + 1;
        state.userPosition = pos === 1 ? "Champions" : `${ordinal(pos)} place`;
        state.stage = "finished";
        state.log.push(`${getTeam(state.champion).name} are crowned ${comp.name} champions!`);
        return state;
      }
      const round = state.rounds[state.currentRound];
      if (round.some((f) => f.user && !f.played)) return state;
      for (const f of round) if (!f.played) simulateFixture(f, state.format === "worldcup", false);
      state.currentRound++;
      continue;
    }
    if (state.stage === "knockout") {
      const st = state.knockout[state.currentStage];
      if (st.fixtures.some((f) => f.user && !f.played)) return state;
      for (const f of st.fixtures) if (!f.played) simulateFixture(f, true, true);
      const winners = st.fixtures.map(winnerOf);
      const userLost = st.fixtures.some((f) => f.user && winnerOf(f) !== state.userTeamId);
      if (userLost && !state.userEliminated) {
        state.userEliminated = true;
        state.userPosition = st.name === "Final" ? "Runners-up" : st.name === "Semi-finals" ? "Semi-finalists" : "Quarter-finalists";
        state.log.push(`${getTeam(state.userTeamId).name} knocked out at the ${st.name.toLowerCase()} stage.`);
      }
      if (winners.length === 1) {
        state.champion = winners[0];
        state.stage = "finished";
        if (state.champion === state.userTeamId) state.userPosition = "Champions";
        state.log.push(`${getTeam(state.champion).name} win the ${comp.name}!`);
        return state;
      }
      const names = stageNames(winners.length);
      const next: Fixture[] = [];
      for (let i = 0; i < winners.length; i += 2) next.push(mk(winners[i], winners[i + 1], state.userTeamId, names[0]));
      state.knockout.push({ name: names[0], fixtures: next });
      state.currentStage++;
      continue;
    }
    return state;
  }
  return state;
}

export function applyUserResult(state: TournamentState, result: ScoreLine): TournamentState {
  const next = nextUserFixture(state);
  if (!next) return state;
  const f = next.fixture;
  Object.assign(f, result, { played: true });
  if (state.stage === "knockout" && f.homeScore === f.awayScore) {
    // sudden-death shoot-out decides drawn knockout ties
    if (Math.random() < 0.5) f.homeScore = (f.homeScore ?? 0) + 3;
    else f.awayScore = (f.awayScore ?? 0) + 3;
    f.note = "after extra time";
  }
  const userHome = f.home === state.userTeamId;
  const us = userHome ? f.homeScore : f.awayScore;
  const them = userHome ? f.awayScore : f.homeScore;
  const opp = getTeam(userHome ? f.away : f.home).name;
  const verb = (us ?? 0) > (them ?? 0) ? "beat" : (us ?? 0) < (them ?? 0) ? "lost to" : "drew with";
  state.log.push(`${next.label}: ${getTeam(state.userTeamId).name} ${verb} ${opp} ${us}-${them}.`);
  if (state.log.length > 12) state.log = state.log.slice(-12);
  return normalize(state);
}
