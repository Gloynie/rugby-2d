import { getCompetition, getTeam } from "@/game/data";
import { simulateMatch, type CareerFixture, type CareerStanding } from "./career";

export interface PlayerAppearance {
  skin: string;
  hair: string;
  hairStyle: "short" | "long" | "spiky" | "bald";
}

export interface PlayerAttributes {
  speed: number;
  strength: number;
  tackling: number;
  handling: number;
  kicking: number;
  evasion: number;
}

export interface PlayerCareerHistory {
  played: number;
  tries: number;
  tackles: number;
  passes: number;
  ratingAverage: number;
}

export interface PlayerCareerState {
  playerName: string;
  position: number; // 1..15 shirt position
  teamId: string;
  competitionId: string;
  rating: number;
  xp: number;
  appearance: PlayerAppearance;
  attributes: PlayerAttributes;
  history: PlayerCareerHistory;
  schedule: CareerFixture[];
  standings: CareerStanding[];
  week: number;
  log: string[];
}

export const ATTR_LIMIT = 99;

export function getAttrUpgradeCost(currentValue: number): number {
  return Math.round(50 + (currentValue - 50) * 4);
}

export function calculateOVR(attrs: PlayerAttributes): number {
  return Math.round((attrs.speed + attrs.strength + attrs.tackling + attrs.handling + attrs.kicking + attrs.evasion) / 6);
}

export function createPlayerCareer(
  playerName: string,
  position: number,
  teamId: string,
  competitionId: string,
  appearance: PlayerAppearance,
): PlayerCareerState {
  const comp = getCompetition(competitionId);
  if (!comp) throw new Error(`Unknown competition: ${competitionId}`);
  if (!comp.teamIds.includes(teamId)) {
    throw new Error(`Team ${getTeam(teamId).name} is not in competition ${comp.name}`);
  }
  
  // Default young player stats (60 OVR)
  const attributes: PlayerAttributes = {
    speed: 60,
    strength: 60,
    tackling: 60,
    handling: 60,
    kicking: 60,
    evasion: 60,
  };

  const others = comp.teamIds.filter((id) => id !== teamId);
  const schedule: CareerFixture[] = [];
  
  if (comp.format === "worldcup") {
    const pool = comp.teamIds.filter((id, i) => i % 4 === comp.teamIds.indexOf(teamId) % 4);
    pool.forEach((opponent, i) => {
      if (opponent === teamId) return;
      schedule.push({
        id: `pool-${i}`,
        week: i + 1,
        home: Math.random() < 0.5 ? teamId : opponent,
        away: Math.random() < 0.5 ? teamId : opponent,
        played: false,
        user: true,
        neutral: true,
      });
    });
    schedule.push(
      { id: "qf", week: pool.length + 1, home: teamId, away: "TBD", played: false, user: true, neutral: true, knockout: "Quarter-final" },
      { id: "sf", week: pool.length + 2, home: teamId, away: "TBD", played: false, user: true, neutral: true, knockout: "Semi-final" },
      { id: "f", week: pool.length + 3, home: teamId, away: "TBD", played: false, user: true, neutral: true, knockout: "Final" },
    );
  } else {
    const rounds = comp.doubleRound ? 2 : 1;
    let week = 1;
    for (let r = 0; r < rounds; r++) {
      for (const opponent of others) {
        const home = r === 0 ? Math.random() < 0.5 : Math.random() < 0.5;
        schedule.push({
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

  const standings: CareerStanding[] = comp.teamIds.map((id) => ({
    teamId: id, p: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, bp: 0, pts: 0,
  }));

  return {
    playerName,
    position,
    teamId,
    competitionId,
    rating: 60,
    xp: 200, // Initial starting XP to get them going!
    appearance,
    attributes,
    history: { played: 0, tries: 0, tackles: 0, passes: 0, ratingAverage: 0 },
    schedule,
    standings,
    week: 0,
    log: [`Your player career as ${playerName} starts now for ${getTeam(teamId).name}!`],
  };
}

/** Simulate a matchweek of other fixtures in player career */
export function advancePlayerCareerWeek(state: PlayerCareerState): PlayerCareerState {
  const next = { ...state, week: state.week + 1 };
  
  next.schedule = next.schedule.map((f) => {
    if (f.week !== next.week || f.played || f.user) return f;
    const home = getTeam(f.home);
    const away = getTeam(f.away);
    const result = simulateMatch(home, away, "normal");
    
    // Update standings
    const homeStanding = next.standings.find((s) => s.teamId === f.home)!;
    const awayStanding = next.standings.find((s) => s.teamId === f.away)!;
    homeStanding.p++; awayStanding.p++;
    homeStanding.pf += result.homeScore; homeStanding.pa += result.awayScore;
    awayStanding.pf += result.awayScore; awayStanding.pa += result.homeScore;
    
    if (result.homeScore > result.awayScore) {
      homeStanding.w++; awayStanding.l++; homeStanding.pts += 4;
    } else if (result.homeScore === result.awayScore) {
      homeStanding.d++; awayStanding.d++; homeStanding.pts += 2; awayStanding.pts += 2;
    } else {
      awayStanding.w++; homeStanding.l++; awayStanding.pts += 4;
    }
    if (result.homeTries >= 4) { homeStanding.bp++; homeStanding.pts++; }
    if (result.awayTries >= 4) { awayStanding.bp++; awayStanding.pts++; }
    
    return { ...f, played: true, homeScore: result.homeScore, awayScore: result.awayScore };
  });

  // Sort standings
  next.standings = [...next.standings].sort((a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf);
  return next;
}

/** Process game stats after playing a match to calculate Match Rating and award XP */
export function processMatchPerformance(
  state: PlayerCareerState,
  fixtureId: string,
  userTries: number,
  userTackles: number,
  userPasses: number,
  homeScore: number,
  awayScore: number,
): { state: PlayerCareerState; matchRating: number; xpEarned: number } {
  const fixture = state.schedule.find((f) => f.id === fixtureId);
  const next = { ...state };
  
  if (fixture) {
    fixture.played = true;
    fixture.homeScore = homeScore;
    fixture.awayScore = awayScore;

    // Update standings
    const homeStanding = next.standings.find((s) => s.teamId === fixture.home)!;
    const awayStanding = next.standings.find((s) => s.teamId === fixture.away)!;
    homeStanding.p++; awayStanding.p++;
    homeStanding.pf += homeScore; homeStanding.pa += awayScore;
    awayStanding.pf += awayScore; awayStanding.pa += homeScore;

    const userHome = fixture.home === state.teamId;
    const won = userHome ? homeScore > awayScore : awayScore > homeScore;
    const drew = homeScore === awayScore;

    if (won) {
      if (userHome) { homeStanding.w++; awayStanding.l++; homeStanding.pts += 4; }
      else { awayStanding.w++; homeStanding.l++; awayStanding.pts += 4; }
    } else if (drew) {
      homeStanding.d++; awayStanding.d++; homeStanding.pts += 2; awayStanding.pts += 2;
    } else {
      if (userHome) { awayStanding.w++; homeStanding.l++; awayStanding.pts += 4; }
      else { homeStanding.w++; awayStanding.l++; homeStanding.pts += 4; }
    }
  }

  // Calculate Match Rating (scale 4.0 to 10.0, like FIFA/EA FC)
  let rating = 6.0;
  rating += userTries * 1.5;
  rating += userTackles * 0.4;
  rating += userPasses * 0.15;
  rating = Math.min(10.0, Math.max(4.0, rating));

  // XP Earned based on performance and rating
  const baseXP = 50;
  const ratingXP = Math.round((rating - 4.0) * 15);
  const triesXP = userTries * 40;
  const totalXp = baseXP + ratingXP + triesXP;

  next.xp += totalXp;
  
  // Update Player Career history
  const h = next.history;
  const prevPlayed = h.played;
  h.played++;
  h.tries += userTries;
  h.tackles += userTackles;
  h.passes += userPasses;
  h.ratingAverage = Number(((h.ratingAverage * prevPlayed + rating) / h.played).toFixed(2));

  next.log.unshift(`Match Week ${state.week}: Rated ${rating.toFixed(1)} with ${userTries} tries, ${userTackles} tackles. Earned +${totalXp} XP!`);
  
  return { state: next, matchRating: rating, xpEarned: totalXp };
}

/** Upgrade a specific player attribute */
export function upgradeAttribute(state: PlayerCareerState, attr: keyof PlayerAttributes): { state: PlayerCareerState; error?: string } {
  const currentVal = state.attributes[attr];
  if (currentVal >= ATTR_LIMIT) return { state, error: "Attribute already at maximum (99) limit." };
  
  const cost = getAttrUpgradeCost(currentVal);
  if (state.xp < cost) return { state, error: `Insufficient XP. Requires ${cost} XP, you have ${state.xp} XP.` };

  const next = { ...state };
  next.xp -= cost;
  next.attributes[attr]++;
  next.rating = calculateOVR(next.attributes);
  
  next.log.unshift(`Upgraded ${attr.toUpperCase()} to ${next.attributes[attr]} for ${cost} XP!`);
  return { state: next };
}
