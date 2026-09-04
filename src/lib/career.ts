import { COMPETITIONS, POSITION_NAMES, TEAMS, getCompetition, getTeam, type TeamData } from "@/game/data";
import { RugbyEngine, buildAttributes } from "@/game/engine";
import type { Difficulty, MatchConfig, MatchResult } from "@/game/types";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = () => Math.random();
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

export interface CareerPlayer {
  id: number;
  number: number;
  name: string;
  position: number; // 1..15 shirt number
  rating: number;
  form: number; // 0-100
  fatigue: number; // 0-100
  fitness: number; // 0-100, 100=healthy
  morale: number; // 0-100
  injuredWeeks: number;
  yellowCards: number;
  redCards: number;
  caps: number;
  tries: number;
  points: number;
}

export interface CareerFixture {
  id: string;
  week: number;
  home: string;
  away: string;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
  user: boolean;
  neutral: boolean;
  knockout?: string; // e.g. "Quarter-final"
}

export interface CareerStanding {
  teamId: string;
  p: number;
  w: number;
  d: number;
  l: number;
  pf: number;
  pa: number;
  bp: number;
  pts: number;
}

export interface CareerEvent {
  week: number;
  text: string;
  type: "result" | "injury" | "news" | "manager" | "press";
}

export interface CareerState {
  teamId: string;
  competitionId: string;
  mode: "tournament" | "worldcup" | "friendlies";
  week: number;
  roster: CareerPlayer[];
  schedule: CareerFixture[];
  standings: CareerStanding[];
  events: CareerEvent[];
  knockout?: { name: string; fixtures: CareerFixture[] }[];
  teamMorale: number;
  managerReputation: number; // 0-100
  coins: number; // Training budget
  lastResult?: { homeScore: number; awayScore: number; events: { minute: number; type: string; player: string; points: number; team: 0 | 1 }[] };
}

/** Build initial roster with fresh form/fatigue */
export function buildRoster(team: TeamData): CareerPlayer[] {
  return team.players.map((name, i) => {
    const pos = i + 1;
    const attrs = buildAttributes(pos, name, team.rating);
    const rating = Math.round((attrs.speed + attrs.strength + attrs.tackling + attrs.handling + attrs.kicking + attrs.evasion) / 6);
    return {
      id: i,
      number: pos,
      name,
      position: pos,
      rating,
      form: 70 + Math.floor(rnd() * 20),
      fatigue: 0,
      fitness: 100,
      morale: 65 + Math.floor(rnd() * 20),
      injuredWeeks: 0,
      yellowCards: 0,
      redCards: 0,
      caps: 0,
      tries: 0,
      points: 0,
    };
  });
}

/** Generate schedule based on competition type */
function generateSchedule(compId: string, teamId: string): CareerFixture[] {
  const comp = getCompetition(compId);
  if (!comp) throw new Error("Unknown competition: " + compId);
  const fixtures: CareerFixture[] = [];
  const others = comp.teamIds.filter((id) => id !== teamId);

  if (comp.format === "worldcup") {
    // Pools + knockout
    const pool = comp.teamIds.filter((id, i) => i % 4 === comp.teamIds.indexOf(teamId) % 4);
    pool.forEach((opponent, i) => {
      if (opponent === teamId) return;
      fixtures.push({
        id: `pool-${i}`,
        week: i + 1,
        home: rnd() < 0.5 ? teamId : opponent,
        away: rnd() < 0.5 ? teamId : opponent,
        played: false,
        user: true,
        neutral: true,
      });
    });
    // Knockout placeholder (will be filled after pools)
    fixtures.push(
      { id: "qf", week: pool.length + 1, home: teamId, away: "TBD", played: false, user: true, neutral: true, knockout: "Quarter-final" },
      { id: "sf", week: pool.length + 2, home: teamId, away: "TBD", played: false, user: true, neutral: true, knockout: "Semi-final" },
      { id: "f", week: pool.length + 3, home: teamId, away: "TBD", played: false, user: true, neutral: true, knockout: "Final" },
    );
  } else {
    // Round-robin league
    const rounds = comp.doubleRound ? 2 : 1;
    let week = 1;
    for (let r = 0; r < rounds; r++) {
      for (const opponent of others) {
        const home = r === 0 ? rnd() < 0.5 : rnd() < 0.5;
        fixtures.push({
          id: `r${r}-${week}`,
          week,
          home: home ? teamId : opponent,
          away: home ? opponent : teamId,
          played: false,
          user: true,
          neutral: false,
        });
        week++;
      }
    }
  }
  return fixtures;
}

/** Initialize a new career */
export function createCareer(teamId: string, competitionId: string, mode: "tournament" | "worldcup" | "friendlies"): CareerState {
  const comp = getCompetition(competitionId);
  if (!comp) throw new Error(`Unknown competition: ${competitionId}`);
  if (!comp.teamIds.includes(teamId)) throw new Error(`Team ${teamId} is not in competition ${competitionId}`);
  const team = getTeam(teamId);
  const roster = buildRoster(team);
  const schedule = generateSchedule(competitionId, teamId);
  const standings: CareerStanding[] = getCompetition(competitionId)!.teamIds.map((id) => ({
    teamId: id,
    p: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, bp: 0, pts: 0,
  }));
  return {
    teamId,
    competitionId,
    mode,
    week: 0,
    roster,
    schedule,
    standings,
    events: [{ week: 0, text: `You are now manager of ${team.name}. Good luck!`, type: "news" }],
    teamMorale: 70,
    managerReputation: 50,
    coins: 500, // Starting budget
  };
}

/** Simulate a match between two teams (AI vs AI) and return result */
export function simulateMatch(home: TeamData, away: TeamData, difficulty: Difficulty = "normal"): MatchResult {
  const config: MatchConfig = {
    home,
    away,
    userTeam: null,
    halfSeconds: 120,
    difficulty,
  };
  const engine = new RugbyEngine(config);
  let frames = 0;
  const maxFrames = 60 * 600; // 10 minutes max
  while (!engine.finished && frames < maxFrames) {
    engine.update(1 / 60, {
      moveX: 0, moveY: 0, sprint: false, kickHeld: false, passUp: false, passDown: false,
      kickRelease: false, dropGoal: false, action: false, switchPlayer: false,
      option1: false, option2: false, option3: false,
    });
    frames++;
  }
  return engine.result();
}

/** Apply match result to career state */
export function applyMatchResult(state: CareerState, fixtureId: string, result: MatchResult, userTeam: 0 | 1): CareerState {
  const fixture = state.schedule.find((f) => f.id === fixtureId);
  if (!fixture || fixture.played) return state;
  const next = { ...state, schedule: state.schedule.map((f) => f.id === fixtureId ? { ...f, played: true, homeScore: result.homeScore, awayScore: result.awayScore } : f) };
  const home = getTeam(fixture.home);
  const away = getTeam(fixture.away);
  const userHome = fixture.home === state.teamId;
  const us = userHome ? result.homeScore : result.awayScore;
  const them = userHome ? result.awayScore : result.homeScore;
  const won = us > them;
  const drew = us === them;
  // Update standings
  const homeStanding = next.standings.find((s) => s.teamId === fixture.home)!;
  const awayStanding = next.standings.find((s) => s.teamId === fixture.away)!;
  homeStanding.p++; awayStanding.p++;
  homeStanding.pf += result.homeScore; homeStanding.pa += result.awayScore;
  awayStanding.pf += result.awayScore; awayStanding.pa += result.homeScore;
  if (won) {
    if (userHome) { homeStanding.w++; awayStanding.l++; homeStanding.pts += 4; }
    else { awayStanding.w++; homeStanding.l++; awayStanding.pts += 4; }
  } else if (drew) {
    homeStanding.d++; awayStanding.d++; homeStanding.pts += 2; awayStanding.pts += 2;
  } else {
    if (userHome) { awayStanding.w++; homeStanding.l++; awayStanding.pts += 4; }
    else { homeStanding.w++; awayStanding.l++; homeStanding.pts += 4; }
  }
  // Bonus points (4 tries)
  if (result.homeTries >= 4) { homeStanding.bp++; homeStanding.pts++; }
  if (result.awayTries >= 4) { awayStanding.bp++; awayStanding.pts++; }
  // Update roster: fatigue, form, injuries
  next.roster = next.roster.map((p) => {
    const played = userTeam === 0 || userTeam === 1; // TODO: track which players actually played
    if (!played) return p;
    const fatigueGain = 25 + rnd() * 15;
    const formDelta = won ? 5 : drew ? 0 : -5;
    return {
      ...p,
      fatigue: clamp(p.fatigue + fatigueGain, 0, 100),
      form: clamp(p.form + formDelta + (rnd() - 0.5) * 4, 0, 100),
      caps: p.caps + 1,
    };
  });
  // Random injury chance (Disabled - Injuries removed from game)
  // Morale
  next.teamMorale = clamp(next.teamMorale + (won ? 8 : drew ? 0 : -8), 0, 100);
  // Award coins based on result
  const coinReward = won ? 150 : drew ? 75 : 40;
  next.coins += coinReward;
  next.events.unshift({
    week: next.week,
    text: `${home.name} ${result.homeScore} - ${result.awayScore} ${away.name} (${won ? "W" : drew ? "D" : "L"}) +${coinReward} coins`,
    type: "result",
  });
  next.lastResult = { homeScore: result.homeScore, awayScore: result.awayScore, events: result.events.map((e) => ({ ...e, team: e.team as 0 | 1 })) };
  return next;
}

/** Advance to next week: recover fatigue, heal injuries, simulate other fixtures */
export function advanceWeek(state: CareerState): CareerState {
  const next = { ...state, week: state.week + 1 };
  next.roster = next.roster.map((p) => {
    let fatigue = Math.max(0, p.fatigue - 30); // recover 30 per week
    let fitness = p.fitness;
    let injuredWeeks = p.injuredWeeks;
    if (p.injuredWeeks > 0) {
      injuredWeeks--;
      fitness = clamp(fitness + 50, 0, 100);
      if (injuredWeeks === 0) fitness = 100;
    }
    return { ...p, fatigue, fitness, injuredWeeks };
  });
  // Simulate other fixtures this week
  next.schedule = next.schedule.map((f) => {
    if (f.week !== next.week || f.played || f.user) return f;
    const home = getTeam(f.home);
    const away = getTeam(f.away);
    const result = simulateMatch(home, away);
    // Update standings
    const homeStanding = next.standings.find((s) => s.teamId === f.home)!;
    const awayStanding = next.standings.find((s) => s.teamId === f.away)!;
    homeStanding.p++; awayStanding.p++;
    homeStanding.pf += result.homeScore; homeStanding.pa += result.awayScore;
    awayStanding.pf += result.awayScore; awayStanding.pa += result.homeScore;
    if (result.homeScore > result.awayScore) { homeStanding.w++; awayStanding.l++; homeStanding.pts += 4; }
    else if (result.homeScore === result.awayScore) { homeStanding.d++; awayStanding.d++; homeStanding.pts += 2; awayStanding.pts += 2; }
    else { awayStanding.w++; homeStanding.l++; awayStanding.pts += 4; }
    if (result.homeTries >= 4) { homeStanding.bp++; homeStanding.pts++; }
    if (result.awayTries >= 4) { awayStanding.bp++; awayStanding.pts++; }
    return { ...f, played: true, homeScore: result.homeScore, awayScore: result.awayScore };
  });
  // Sort standings
  next.standings = [...next.standings].sort((a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf);
  return next;
}

/** Manager actions */
export function teamTalk(state: CareerState, type: "motivate" | "relax" | "demand"): CareerState {
  const delta = type === "motivate" ? 8 : type === "relax" ? -3 : 5;
  const fatigueDelta = type === "relax" ? -15 : type === "demand" ? 5 : 0;
  return {
    ...state,
    teamMorale: clamp(state.teamMorale + delta, 0, 100),
    roster: state.roster.map((p) => ({
      ...p,
      morale: clamp(p.morale + delta + (rnd() - 0.5) * 6, 0, 100),
      fatigue: clamp(p.fatigue + fatigueDelta, 0, 100),
    })),
    events: [{ week: state.week, text: `Team talk: ${type === "motivate" ? "Inspired the squad" : type === "relax" ? "Kept it light" : "Raised standards"}`, type: "manager" }],
  };
}

export function playerAction(state: CareerState, playerId: number, action: "praise" | "criticise" | "rest"): CareerState {
  const p = state.roster.find((x) => x.id === playerId);
  if (!p) return state;
  let morale = p.morale;
  let fatigue = p.fatigue;
  let form = p.form;
  if (action === "praise") { morale = clamp(morale + 10, 0, 100); form = clamp(form + 3, 0, 100); }
  else if (action === "criticise") { morale = clamp(morale - 8, 0, 100); form = clamp(form + 5, 0, 100); }
  else if (action === "rest") { fatigue = clamp(fatigue - 25, 0, 100); }
  return {
    ...state,
    roster: state.roster.map((x) => x.id === playerId ? { ...x, morale, fatigue, form } : x),
    events: [{ week: state.week, text: `${action === "praise" ? "Praised" : action === "criticise" ? "Criticised" : "Rested"} ${p.name}`, type: "manager" }],
  };
}

/** Training actions - spend coins to improve players */
export function trainPlayer(state: CareerState, playerId: number, training: "fitness" | "skills" | "strength"): { state: CareerState; error?: string } {
  const p = state.roster.find((x) => x.id === playerId);
  if (!p) return { state, error: "Player not found" };
  if (p.injuredWeeks > 0) return { state, error: "Player is injured" };
  
  const cost = training === "fitness" ? 60 : training === "skills" ? 100 : 80;
  if (state.coins < cost) return { state, error: `Need ${cost} coins (have ${state.coins})` };
  
  const next = { ...state, coins: state.coins - cost };
  next.roster = next.roster.map((pl) => {
    if (pl.id !== playerId) return pl;
    const np = { ...pl };
    np.fatigue = clamp(np.fatigue + 20, 0, 100); // Training is tiring
    if (training === "fitness") {
      np.fitness = clamp(np.fitness + 15, 0, 100);
    } else if (training === "skills") {
      np.rating = Math.min(99, np.rating + 1);
      np.form = clamp(np.form + 5, 0, 100);
    } else if (training === "strength") {
      np.rating = Math.min(99, np.rating + 1);
      np.fatigue = clamp(np.fatigue + 5, 0, 100); // Extra fatigue
    }
    return np;
  });
  
  const labels = { fitness: "Fitness", skills: "Skills", strength: "Strength" };
  next.events.unshift({ week: state.week, text: `${p.name} did ${labels[training]} training (-${cost} coins)`, type: "manager" });
  return { state: next };
}

export function trainTeam(state: CareerState, type: "bonding" | "tactics" | "intense"): { state: CareerState; error?: string } {
  const cost = type === "bonding" ? 120 : type === "tactics" ? 150 : 180;
  if (state.coins < cost) return { state, error: `Need ${cost} coins (have ${state.coins})` };
  
  const next = { ...state, coins: state.coins - cost };
  if (type === "bonding") {
    next.teamMorale = clamp(next.teamMorale + 15, 0, 100);
    next.roster = next.roster.map((p) => ({ ...p, morale: clamp(p.morale + 8, 0, 100) }));
  } else if (type === "tactics") {
    next.roster = next.roster.map((p) => ({ ...p, form: clamp(p.form + 4, 0, 100), fatigue: clamp(p.fatigue + 10, 0, 100) }));
  } else {
    next.roster = next.roster.map((p) => ({ ...p, rating: Math.min(99, p.rating + 1), fatigue: clamp(p.fatigue + 20, 0, 100) }));
  }
  
  const labels = { bonding: "Team bonding", tactics: "Tactics session", intense: "Intense training" };
  next.events.unshift({ week: state.week, text: `${labels[type]} (-${cost} coins)`, type: "manager" });
  return { state: next };
}
