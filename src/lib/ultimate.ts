import { TEAMS, findTeam, getTeam } from "@/game/data";
import { buildAttributes, roleFor } from "@/game/engine";
import type { Attributes, MatchPlayerOverride, MatchResult, TeamData } from "@/game/types";

export type CardRarity = "bronze" | "silver" | "gold" | "elite";
export type UltimatePosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export interface CardRatings {
  pace: number;
  strength: number;
  physicality: number;
  scrummaging: number;
  tackling: number;
  handling: number;
  kicking: number;
  evasion: number;
}

export interface UltimateCard {
  instanceId: string;
  catalogueId: string;
  name: string;
  teamId: string;
  /** Original catalogue team/nation used to rate the card. */
  teamName: string;
  /** Latest club shown on the card where the current in-game roster can identify one. */
  clubName?: string;
  country: string;
  position: UltimatePosition;
  positionName: string;
  ovr: number;
  rarity: CardRarity;
  ratings: CardRatings;
  isStarter?: boolean;
}

export interface UltimateChallenge {
  id: "win-3" | "tries-8" | "packs-3" | "trade-5" | "elite-1";
  title: string;
  description: string;
  target: number;
  reward: number;
  progress: number;
  claimed: boolean;
}

export interface UltimateOpponent {
  name: string;
  teamId: string;
  primary: string;
  secondary: string;
  cards: UltimateCard[];
  level: "bronze" | "silver" | "gold" | "elite";
}

export interface UltimateCup {
  status: "active" | "champions" | "eliminated";
  stage: "semi" | "final";
  opponent: UltimateOpponent;
  otherSemiScore?: string;
  history: string[];
}

export interface UltimateClubState {
  clubName: string;
  primary: string;
  secondary: string;
  coins: number;
  cards: UltimateCard[];
  lineup: string[];
  bench: string[];
  wins: number;
  draws: number;
  losses: number;
  tries: number;
  packsOpened: number;
  tradedIn: number;
  matchesPlayed: number;
  challenges: UltimateChallenge[];
  cup: UltimateCup | null;
  log: string[];
}

export const BENCH_ROLES: UltimatePosition[] = [1, 2, 3, 4, 6, 9, 10, 12];
const POSITIONS = Array.from({ length: 15 }, (_, i) => (i + 1) as UltimatePosition);
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const round = (n: number) => Math.round(clamp(n, 1, 99));
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const STAR_OVR: Record<string, number> = {
  "Antoine Dupont": 93, "Ardie Savea": 92, "Cheslin Kolbe": 91, "Eben Etzebeth": 91,
  "Pieter-Steph du Toit": 91, "Caelan Doris": 90, "Rieko Ioane": 90, "Jordie Barrett": 90,
  "Damian McKenzie": 89, "Handré Pollard": 89, "Maro Itoje": 89, "Finn Russell": 89,
  "Will Jordan": 89, "Thomas Ramos": 88, "James Lowe": 88, "Bundee Aki": 88,
  "Marcus Smith": 87, "Beauden Barrett": 88, "Kurt-Lee Arendse": 87, "Malcolm Marx": 88,
  "Tadhg Beirne": 88, "Garry Ringrose": 87, "Damian Penaud": 88, "Grégory Alldritt": 88,
  "Siya Kolisi": 88, "Rob Valetini": 87, "Willie le Roux": 86, "Sione Tuipulotu": 86,
};

/** Club labels for card presentation, inferred from the current club rosters in this game. */
const CLUB_BY_PLAYER = new Map<string, string>();
for (const roster of TEAMS.filter((team) => team.type === "club")) {
  for (const player of roster.players) {
    if (!player.endsWith("(Sub)") && !CLUB_BY_PLAYER.has(player)) CLUB_BY_PLAYER.set(player, roster.name);
  }
}

function clubForCard(team: TeamData, player: string): string {
  if (team.type === "club") return team.name;
  return CLUB_BY_PLAYER.get(player) ?? "Club not listed";
}

/** Nationality labels come from the international squads where that player is represented. */
const COUNTRY_BY_PLAYER = new Map<string, string>();
for (const roster of TEAMS.filter((team) => team.type === "international")) {
  for (const player of roster.players) {
    if (!player.endsWith("(Sub)") && !COUNTRY_BY_PLAYER.has(player)) COUNTRY_BY_PLAYER.set(player, roster.country);
  }
}

function countryForCard(team: TeamData, player: string): string {
  return COUNTRY_BY_PLAYER.get(player) ?? team.country;
}

function cardOvr(position: UltimatePosition, name: string, teamRating: number): number {
  const h = [...name].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 17);
  const roleBias = position <= 8 ? 0 : position === 9 || position === 10 ? 1 : 2;
  return STAR_OVR[name] ?? clamp(Math.round(teamRating - 12 + roleBias + ((h % 15) - 7) / 2), 58, 84);
}

function rarityFor(ovr: number): CardRarity {
  if (ovr >= 84) return "elite";
  if (ovr >= 75) return "gold";
  if (ovr >= 64) return "silver";
  return "bronze";
}

function ratingsFor(position: UltimatePosition, name: string, teamRating: number, ovr: number): CardRatings {
  const base = buildAttributes(position, name, teamRating);
  const role = roleFor(position);
  const pace = round(25 + base.speed * 8.1 + (position >= 11 ? 8 : 0));
  const physicality = round(base.strength * 0.62 + (position <= 8 ? 23 : 5));
  const scrum = round(position <= 3 ? 66 + (base.strength - 55) * 0.48 : position <= 8 ? 42 + (base.strength - 55) * 0.22 : 22 + (base.strength - 55) * 0.08);
  const boost = ovr - (teamRating - 12);
  return {
    pace: round(pace + boost * 0.45),
    strength: round(base.strength + boost * 0.4),
    physicality: round(physicality + boost * 0.5),
    scrummaging: round(scrum + boost * 0.25),
    tackling: round(base.tackling + boost * 0.4),
    handling: round(base.handling + boost * 0.45),
    kicking: round(base.kicking + boost * 0.35),
    evasion: round(base.evasion + (role === "wing" || role === "fullback" ? 5 : 0) + boost * 0.4),
  };
}

function cardFromTeam(team: TeamData, position: UltimatePosition, name: string, index: number): UltimateCard {
  const ovr = cardOvr(position, name, team.rating);
  return {
    instanceId: uid(),
    catalogueId: `${team.id}-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    teamId: team.id,
    teamName: team.name,
    clubName: clubForCard(team, name),
    country: countryForCard(team, name),
    position,
    positionName: roleFor(position).replace(/^./, (c) => c.toUpperCase()),
    ovr,
    rarity: rarityFor(ovr),
    ratings: ratingsFor(position, name, team.rating, ovr),
  };
}

/** Current squad lists included with the game, converted to individual Ultimate cards. */
export const PLAYER_CATALOGUE: UltimateCard[] = TEAMS.flatMap((team) =>
  team.players
    .filter((name) => !name.endsWith("(Sub)"))
    .map((name, index) => cardFromTeam(team, ((index % 15) + 1) as UltimatePosition, name, index)),
);

function academyCard(position: UltimatePosition, index: number): UltimateCard {
  const ovr = 47 + ((index * 5 + position * 3) % 12);
  const role = roleFor(position);
  const paceBase = role === "wing" || role === "fullback" ? 66 : role === "centre" ? 60 : role === "nine" || role === "ten" ? 58 : 44;
  const power = position <= 8 ? 65 : 44;
  return {
    instanceId: uid(),
    catalogueId: `academy-${position}-${index}`,
    name: ["Jordan", "Aiden", "Kai", "Liam", "Noah", "Tyler", "Ethan", "Mason"][index % 8] + " " + ["Hart", "Mills", "Taylor", "Reed", "Price", "Cole", "Shaw", "Fox"][position % 8],
    teamId: "academy",
    teamName: "Academy XV",
    clubName: "Academy XV",
    country: "Academy",
    position,
    positionName: role.replace(/^./, (c) => c.toUpperCase()),
    ovr,
    rarity: "bronze",
    isStarter: true,
    ratings: {
      pace: round(paceBase + (index % 6)), strength: round(power + (index % 7)), physicality: round(power + 3),
      scrummaging: round(position <= 3 ? 61 + (index % 6) : position <= 8 ? 43 : 25),
      tackling: round(42 + (index % 15)), handling: round(43 + ((index * 3) % 14)),
      kicking: round(position === 10 || position === 15 ? 57 : 28 + (index % 12)), evasion: round(paceBase - 2 + (index % 8)),
    },
  };
}

function defaultChallenges(): UltimateChallenge[] {
  return [
    { id: "win-3", title: "First Victories", description: "Win 3 Ultimate matches", target: 3, reward: 600, progress: 0, claimed: false },
    { id: "tries-8", title: "Try Machine", description: "Score 8 tries", target: 8, reward: 750, progress: 0, claimed: false },
    { id: "packs-3", title: "Collector", description: "Open 3 packs", target: 3, reward: 400, progress: 0, claimed: false },
    { id: "trade-5", title: "Club Builder", description: "Trade in 5 cards", target: 5, reward: 500, progress: 0, claimed: false },
    { id: "elite-1", title: "Big Pull", description: "Pack an Elite (84+) card", target: 1, reward: 1000, progress: 0, claimed: false },
  ];
}

export function createUltimateClub(clubName: string, primary = "#166534", secondary = "#facc15"): UltimateClubState {
  const cards = [...POSITIONS, ...BENCH_ROLES].map((position, index) => academyCard(position, index));
  return {
    clubName: clubName.trim().slice(0, 40) || "My Ultimate XV",
    primary, secondary,
    coins: 750,
    cards,
    lineup: cards.slice(0, 15).map((card) => card.instanceId),
    bench: cards.slice(15, 23).map((card) => card.instanceId),
    wins: 0, draws: 0, losses: 0, tries: 0, packsOpened: 0, tradedIn: 0, matchesPlayed: 0,
    challenges: defaultChallenges(),
    cup: null,
    log: ["Welcome to Ultimate Team. Your bronze Academy XV is ready to build from."],
  };
}

export function getSquadCards(state: UltimateClubState): UltimateCard[] {
  const byId = new Map(state.cards.map((card) => [card.instanceId, card]));
  const selected = [...state.lineup, ...state.bench].map((id) => byId.get(id)).filter((card): card is UltimateCard => Boolean(card));
  if (selected.length === 23) return selected;
  const fallback = state.cards.filter((card) => !selected.some((picked) => picked.instanceId === card.instanceId));
  return [...selected, ...fallback].slice(0, 23);
}

export function cardToOverride(card: UltimateCard): MatchPlayerOverride {
  const forwardPenalty = card.position <= 8 ? 0.9 : card.position === 9 || card.position === 10 ? 0.25 : 0;
  return {
    name: card.name,
    roleNumber: card.position,
    attrs: {
      // Same card PACE has a position-aware conversion: big forwards are powerful but not winger-fast.
      speed: clamp(4.05 + card.ratings.pace * 0.05 - forwardPenalty, 5.0, 8.9),
      strength: card.ratings.strength,
      tackling: card.ratings.tackling,
      handling: card.ratings.handling,
      kicking: card.ratings.kicking,
      evasion: card.ratings.evasion,
    },
  };
}

export function ultimateTeamData(state: UltimateClubState): { team: TeamData; overrides: MatchPlayerOverride[] } {
  const cards = getSquadCards(state);
  const avg = Math.round(cards.slice(0, 15).reduce((sum, card) => sum + card.ovr, 0) / Math.max(1, Math.min(15, cards.length)));
  return {
    team: {
      id: `ultimate-${state.clubName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: state.clubName,
      short: state.clubName.slice(0, 3).toUpperCase(),
      country: "Ultimate Team",
      type: "club",
      primary: state.primary,
      secondary: state.secondary,
      rating: avg,
      players: cards.map((card) => card.name),
    },
    overrides: cards.map(cardToOverride),
  };
}

export const PACKS = [
  { id: "bronze", name: "Bronze Foundations Pack", cost: 250, count: 3, min: 48, max: 67, color: "#b7791f", description: "3 players rated 48–67" },
  { id: "silver", name: "Silver Matchday Pack", cost: 700, count: 4, min: 60, max: 78, color: "#94a3b8", description: "4 players rated 60–78" },
  { id: "gold", name: "Gold International Pack", cost: 1650, count: 5, min: 70, max: 87, color: "#facc15", description: "5 players, one 75+ guaranteed" },
  { id: "elite", name: "Elite Legends Pack", cost: 4200, count: 5, min: 78, max: 94, color: "#a78bfa", description: "5 players, one 84+ guaranteed" },
] as const;
export type PackId = typeof PACKS[number]["id"];

function cloneCatalogueCard(template: UltimateCard): UltimateCard {
  return { ...template, instanceId: uid(), ratings: { ...template.ratings } };
}

function pool(min: number, max: number): UltimateCard[] {
  return PLAYER_CATALOGUE.filter((card) => card.ovr >= min && card.ovr <= max);
}

function drawFrom(min: number, max: number): UltimateCard {
  const options = pool(min, max);
  const fallback = PLAYER_CATALOGUE.filter((card) => card.ovr <= max);
  return cloneCatalogueCard((options.length ? options : fallback)[Math.floor(Math.random() * (options.length || fallback.length))]);
}

export function openPack(state: UltimateClubState, packId: PackId): { state: UltimateClubState; cards?: UltimateCard[]; error?: string } {
  const pack = PACKS.find((entry) => entry.id === packId);
  if (!pack) return { state, error: "Unknown pack." };
  if (state.coins < pack.cost) return { state, error: `You need ${pack.cost} coins for this pack.` };
  const cards: UltimateCard[] = [];
  for (let i = 0; i < pack.count; i++) {
    let min: number = pack.min;
    if (pack.id === "gold" && i === 0) min = 75;
    if (pack.id === "elite" && i === 0) min = 84;
    const pull = drawFrom(min, pack.max);
    // Gold/elite packs occasionally exceed their stated band – the walkout moment.
    if ((pack.id === "gold" && Math.random() < 0.1) || (pack.id === "elite" && Math.random() < 0.28)) {
      const star = PLAYER_CATALOGUE.filter((card) => card.ovr >= 80);
      if (star.length) cards.push(cloneCatalogueCard(star[Math.floor(Math.random() * star.length)]));
      else cards.push(pull);
    } else cards.push(pull);
  }
  const next: UltimateClubState = {
    ...state,
    coins: state.coins - pack.cost,
    cards: [...state.cards, ...cards],
    packsOpened: state.packsOpened + 1,
    log: [`Opened ${pack.name}: ${cards.map((card) => `${card.name} ${card.ovr}`).join(", ")}.`, ...state.log].slice(0, 20),
  };
  next.challenges = updateChallenges(next).challenges;
  return { state: next, cards };
}

export function quickSell(state: UltimateClubState, ids: string[]): { state: UltimateClubState; coinsEarned?: number; error?: string } {
  const protectedIds = new Set([...state.lineup, ...state.bench]);
  const sell = state.cards.filter((card) => ids.includes(card.instanceId) && !protectedIds.has(card.instanceId));
  if (!sell.length) return { state, error: "Move cards out of your matchday 23 before trading them in." };
  const coinsEarned = sell.reduce((sum, card) => sum + Math.max(35, Math.round((card.ovr - 38) * 13)), 0);
  const sellIds = new Set(sell.map((card) => card.instanceId));
  const next: UltimateClubState = {
    ...state,
    coins: state.coins + coinsEarned,
    cards: state.cards.filter((card) => !sellIds.has(card.instanceId)),
    tradedIn: state.tradedIn + sell.length,
    log: [`Traded in ${sell.length} player${sell.length === 1 ? "" : "s"} for +${coinsEarned} coins.`, ...state.log].slice(0, 20),
  };
  next.challenges = updateChallenges(next).challenges;
  return { state: next, coinsEarned };
}

export function saveSquad(state: UltimateClubState, lineup: string[], bench: string[]): { state: UltimateClubState; error?: string } {
  const all = [...lineup, ...bench];
  if (lineup.length !== 15 || bench.length !== 8 || new Set(all).size !== 23) return { state, error: "Choose exactly 15 starters and 8 bench players, with no duplicates." };
  const owned = new Set(state.cards.map((card) => card.instanceId));
  if (!all.every((id) => owned.has(id))) return { state, error: "Your selected squad contains an unavailable card." };
  return { state: { ...state, lineup, bench, log: ["Matchday 23 saved.", ...state.log].slice(0, 20) } };
}

function aiCard(target: number, position: UltimatePosition, index: number): UltimateCard {
  const candidates = PLAYER_CATALOGUE.filter((card) => card.position === position && card.ovr >= target - 7 && card.ovr <= target + 7);
  const fallback = PLAYER_CATALOGUE.filter((card) => card.position === position);
  return cloneCatalogueCard((candidates.length ? candidates : fallback)[(index * 17 + target) % (candidates.length || fallback.length)]);
}

export function createAiOpponent(level: UltimateOpponent["level"], seed = Math.floor(Math.random() * 99999)): UltimateOpponent {
  const targets = { bronze: 57, silver: 67, gold: 77, elite: 85 };
  const target = targets[level];
  const cards = [...POSITIONS, ...BENCH_ROLES].map((position, index) => aiCard(target + ((seed + index * 7) % 5) - 2, position, index));
  const style = { bronze: ["#92400e", "#fde68a"], silver: ["#475569", "#e2e8f0"], gold: ["#7c5b00", "#facc15"], elite: ["#312e81", "#c4b5fd"] }[level];
  return { name: `${["Harbour", "Rugby", "Storm", "Northern", "Coastal"][seed % 5]} ${["XV", "United", "Select", "Rovers", "Legends"][Math.floor(seed / 5) % 5]}`, teamId: `ai-${level}-${seed}`, primary: style[0], secondary: style[1], cards, level };
}

export function opponentToTeam(opponent: UltimateOpponent): { team: TeamData; overrides: MatchPlayerOverride[] } {
  const average = Math.round(opponent.cards.slice(0, 15).reduce((sum, card) => sum + card.ovr, 0) / 15);
  return {
    team: { id: opponent.teamId, name: opponent.name, short: opponent.name.slice(0, 3).toUpperCase(), country: "Ultimate AI", type: "club", primary: opponent.primary, secondary: opponent.secondary, rating: average, players: opponent.cards.map((card) => card.name) },
    overrides: opponent.cards.map(cardToOverride),
  };
}

export function startCup(state: UltimateClubState): { state: UltimateClubState; error?: string } {
  if (state.cup?.status === "active") return { state, error: "Finish your current Squad Cup before starting another." };
  const opponent = createAiOpponent("silver");
  return { state: { ...state, cup: { status: "active", stage: "semi", opponent, otherSemiScore: `${Math.floor(Math.random() * 25)}-${Math.floor(Math.random() * 25)}`, history: [`Semi-final: ${state.clubName} v ${opponent.name}`] }, log: ["Squad Cup started. Win two AI matches for a 1,500-coin champion bonus.", ...state.log].slice(0, 20) } };
}

function updateChallenges(state: UltimateClubState): UltimateClubState {
  const hasElite = state.cards.some((card) => card.ovr >= 84);
  return {
    ...state,
    challenges: state.challenges.map((challenge) => ({
      ...challenge,
      progress: challenge.id === "win-3" ? state.wins : challenge.id === "tries-8" ? state.tries : challenge.id === "packs-3" ? state.packsOpened : challenge.id === "trade-5" ? state.tradedIn : hasElite ? 1 : 0,
    })),
  };
}

export function claimChallenge(state: UltimateClubState, challengeId: UltimateChallenge["id"]): { state: UltimateClubState; reward?: number; error?: string } {
  const challenge = state.challenges.find((entry) => entry.id === challengeId);
  if (!challenge) return { state, error: "Challenge not found." };
  if (challenge.claimed) return { state, error: "Reward already claimed." };
  if (challenge.progress < challenge.target) return { state, error: "Challenge is not complete yet." };
  const next: UltimateClubState = {
    ...state,
    coins: state.coins + challenge.reward,
    challenges: state.challenges.map((entry) => entry.id === challengeId ? { ...entry, claimed: true } : entry),
    log: [`Challenge complete: ${challenge.title} +${challenge.reward} coins.`, ...state.log].slice(0, 20),
  };
  return { state: next, reward: challenge.reward };
}

export function recordUltimateResult(state: UltimateClubState, result: MatchResult, mode: "friendly" | "cup"): { state: UltimateClubState; reward: number; won: boolean } {
  const won = result.homeScore > result.awayScore;
  const drew = result.homeScore === result.awayScore;
  const matchReward = won ? 320 : drew ? 175 : 90;
  let next: UltimateClubState = {
    ...state,
    coins: state.coins + matchReward,
    wins: state.wins + (won ? 1 : 0),
    draws: state.draws + (drew ? 1 : 0),
    losses: state.losses + (!won && !drew ? 1 : 0),
    tries: state.tries + result.homeTries,
    matchesPlayed: state.matchesPlayed + 1,
    log: [`${mode === "cup" ? "Squad Cup" : "Squad Battle"}: ${result.homeScore}-${result.awayScore} · +${matchReward} coins.`, ...state.log].slice(0, 20),
  };
  if (mode === "cup" && next.cup?.status === "active") {
    if (!won) {
      next.cup = { ...next.cup, status: "eliminated", history: [...next.cup.history, "Eliminated from the Squad Cup."] };
    } else if (next.cup.stage === "semi") {
      const finalOpponent = createAiOpponent("gold");
      next.cup = { ...next.cup, stage: "final", opponent: finalOpponent, history: [...next.cup.history, `Won semi-final. Final: ${next.clubName} v ${finalOpponent.name}`] };
      next.log = ["Through to the Squad Cup Final!", ...next.log].slice(0, 20);
    } else {
      next.coins += 1500;
      next.cup = { ...next.cup, status: "champions", history: [...next.cup.history, "Squad Cup Champions! +1500 coin bonus."] };
      next.log = ["SQUAD CUP CHAMPIONS! +1500 coins.", ...next.log].slice(0, 20);
    }
  }
  next = updateChallenges(next);
  return { state: next, reward: matchReward + (mode === "cup" && won && state.cup?.stage === "final" ? 1500 : 0), won };
}

export function isValidClubState(value: unknown): value is UltimateClubState {
  return Boolean(value && typeof value === "object" && Array.isArray((value as UltimateClubState).cards) && Array.isArray((value as UltimateClubState).lineup));
}

/** Adds newer display metadata to clubs created before the card presentation update. */
export function hydrateUltimateClubState(state: UltimateClubState): UltimateClubState {
  return {
    ...state,
    cards: state.cards.map((card) => ({
      ...card,
      clubName: card.clubName ?? (card.teamId === "academy" ? "Academy XV" : CLUB_BY_PLAYER.get(card.name) ?? card.teamName),
      country: card.teamId === "academy" ? card.country : COUNTRY_BY_PLAYER.get(card.name) ?? card.country,
    })),
  };
}

export function cardTeam(card: UltimateCard): TeamData | undefined {
  return findTeam(card.teamId);
}
