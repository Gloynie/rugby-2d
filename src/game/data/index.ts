import type { Competition, TeamData } from "../types";
import { INTERNATIONAL_TEAMS } from "./internationals";
import { PREMIERSHIP_TEAMS, SUPER_RUGBY_TEAMS, TOP14_TEAMS, URC_TEAMS } from "./clubs";

export { STADIUMS, getStadium } from "./stadiums";
export { INTERNATIONAL_TEAMS } from "./internationals";
export { URC_TEAMS, PREMIERSHIP_TEAMS, SUPER_RUGBY_TEAMS, TOP14_TEAMS } from "./clubs";
export type { TeamData } from "../types";

import { applyRosterOverride } from "./rosterOverrides";

// Roster overrides (rosterOverrides.ts) swap in an exact starting XV per team.
export const TEAMS: TeamData[] = [
  ...INTERNATIONAL_TEAMS,
  ...URC_TEAMS,
  ...PREMIERSHIP_TEAMS,
  ...SUPER_RUGBY_TEAMS,
  ...TOP14_TEAMS,
].map((t) => ({ ...t, players: applyRosterOverride(t.id, t.players) }));

// Auto-pad player lists to at least 23 players for every team
export const PADDED_TEAMS: TeamData[] = TEAMS.map((t) => {
  const players = [...t.players];
  const genericNames = [
    "James O'Connor", "Thomas Ryan", "Luke Murphy", "William Byrne", "Daniel Kelly",
    "Michael McCarthy", "John O'Neill", "Patrick Walsh", "Conor O'Brien", "Sean Healy",
    "David Sullivan", "Kevin Doyle", "Brian Foley", "Paul Sheehan", "Mark Brennan",
    "Matthew Higgins", "Andrew Johnston", "Richard Fitz", "Simon Fitzgerald", "Peter Connolly",
  ];
  while (players.length < 23) {
    const idx = players.length - t.players.length;
    players.push(genericNames[idx % genericNames.length] + " (Sub)");
  }
  return { ...t, players };
});

const teamMap = new Map(PADDED_TEAMS.map((t) => [t.id, t]));

export function getTeam(id: string): TeamData {
  const t = teamMap.get(id);
  if (!t) throw new Error(`Unknown team ${id}`);
  return t;
}

export function findTeam(id: string | null | undefined): TeamData | undefined {
  return id ? teamMap.get(id) : undefined;
}

export const COMPETITIONS: Competition[] = [
  {
    id: "rwc",
    name: "Rugby World Cup",
    short: "RWC",
    format: "worldcup",
    teamIds: INTERNATIONAL_TEAMS.map((t) => t.id),
    color: "#c9a227",
    tagline: "The greatest prize in the game",
    description:
      "16 nations, four pools of four. Finish in the top two of your pool to reach the quarter-finals, then it is knockout rugby all the way to the Webb Ellis Cup.",
  },
  {
    id: "sixnations",
    name: "Guinness Six Nations",
    short: "6N",
    format: "league",
    teamIds: ["eng", "fra", "ire", "ita", "sco", "wal"],
    color: "#15803d",
    tagline: "Europe's oldest rivalry",
    description:
      "Five rounds, five matches, one champion. Bonus points for four tries and for losing by seven or fewer. Win every game for the Grand Slam.",
  },
  {
    id: "rugbychampionship",
    name: "The Rugby Championship",
    short: "TRC",
    format: "league",
    teamIds: ["nzl", "rsa", "aus", "arg"],
    doubleRound: true,
    color: "#166534",
    tagline: "Southern hemisphere supremacy",
    description:
      "The All Blacks, Springboks, Wallabies and Pumas meet home and away over six brutal rounds.",
  },
  {
    id: "urc",
    name: "United Rugby Championship",
    short: "URC",
    format: "league",
    teamIds: URC_TEAMS.map((t) => t.id),
    playoffTeams: 8,
    color: "#0ea5e9",
    tagline: "Four unions, one championship",
    description:
      "Sixteen sides from Ireland, Italy, Scotland, South Africa and Wales. The top eight after the regular season go into the play-offs.",
  },
  {
    id: "premiership",
    name: "Gallagher Premiership",
    short: "PREM",
    format: "league",
    teamIds: PREMIERSHIP_TEAMS.map((t) => t.id),
    playoffTeams: 4,
    color: "#dc2626",
    tagline: "England's elite club competition",
    description:
      "Ten English clubs battle through the regular season. The top four reach the semi-finals, with the final at Twickenham.",
  },
  {
    id: "top14",
    name: "Top 14",
    short: "TOP 14",
    format: "league",
    teamIds: TOP14_TEAMS.map((t) => t.id),
    playoffTeams: 4,
    color: "#f97316",
    tagline: "French club rugby's top flight",
    description:
      "Eight French giants battle through the regular season. The top four reach the semi-finals on the road to the Bouclier de Brennus.",
  },
  {
    id: "superrugby",
    name: "Super Rugby Pacific",
    short: "SRP",
    format: "league",
    teamIds: SUPER_RUGBY_TEAMS.map((t) => t.id),
    playoffTeams: 4,
    color: "#7c3aed",
    tagline: "The fastest rugby on the planet",
    description:
      "Eleven franchises from New Zealand, Australia and the Pacific Islands. Finish in the top four to make the play-offs.",
  },
];

export function getCompetition(id: string): Competition | undefined {
  return COMPETITIONS.find((c) => c.id === id);
}

export interface ClubLeague {
  id: string;
  name: string;
  short: string;
  teamIds: string[];
  color: string;
  tagline: string;
}

/** Domestic leagues used by the Kick-Off club picker. */
export const CLUB_LEAGUES: ClubLeague[] = [
  { id: "urc", name: "United Rugby Championship", short: "URC", teamIds: URC_TEAMS.map((t) => t.id), color: "#0ea5e9", tagline: "Ireland · Italy · Scotland · South Africa · Wales" },
  { id: "top14", name: "Top 14", short: "TOP 14", teamIds: TOP14_TEAMS.map((t) => t.id), color: "#f97316", tagline: "France's top flight" },
  { id: "premiership", name: "Gallagher Premiership", short: "PREM", teamIds: PREMIERSHIP_TEAMS.map((t) => t.id), color: "#dc2626", tagline: "England's elite clubs" },
  { id: "superrugby", name: "Super Rugby Pacific", short: "SRP", teamIds: SUPER_RUGBY_TEAMS.map((t) => t.id), color: "#7c3aed", tagline: "New Zealand · Australia · Pacific" },
];

/** Star rating out of 5 (half stars allowed) for a team's overall rating. */
export function starsFor(rating: number): number {
  if (rating >= 92) return 5;
  if (rating >= 88) return 4.5;
  if (rating >= 84) return 4;
  if (rating >= 80) return 3.5;
  if (rating >= 76) return 3;
  if (rating >= 72) return 2.5;
  if (rating >= 68) return 2;
  return 1.5;
}

export function competitionsForTeam(teamId: string): Competition[] {
  return COMPETITIONS.filter((c) => c.teamIds.includes(teamId));
}

export const POSITION_NAMES = [
  "Loosehead Prop", "Hooker", "Tighthead Prop", "Lock", "Lock", "Blindside Flanker", "Openside Flanker", "Number 8",
  "Scrum-half", "Fly-half", "Left Wing", "Inside Centre", "Outside Centre", "Right Wing", "Fullback",
];

/** Pick jersey colours that contrast: if the away primary is too close to the home primary, use the away change kit. */
export function pickKits(home: TeamData, away: TeamData): { home: string; away: string } {
  const dist = colorDistance(home.primary, away.primary);
  if (dist > 120) return { home: home.primary, away: away.primary };
  const alt = colorDistance(home.primary, away.secondary) > 120 ? away.secondary : "#f97316";
  return { home: home.primary, away: alt };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}
