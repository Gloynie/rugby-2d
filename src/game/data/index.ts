import type { Competition, TeamData } from "../types";
import { INTERNATIONAL_TEAMS } from "./internationals";
import { PREMIERSHIP_TEAMS, SUPER_RUGBY_TEAMS, URC_TEAMS } from "./clubs";

export { STADIUMS, getStadium } from "./stadiums";
export type { TeamData } from "../types";

export const TEAMS: TeamData[] = [
  ...INTERNATIONAL_TEAMS,
  ...URC_TEAMS,
  ...PREMIERSHIP_TEAMS,
  ...SUPER_RUGBY_TEAMS,
];

const teamMap = new Map(TEAMS.map((t) => [t.id, t]));

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
