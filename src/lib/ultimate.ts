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
  leadership: number;
  lineout: number;
  agility: number;
  discipline: number;
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
  league?: LeagueState;
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

/** Curated real-world shirt positions for known players so cards show accurate roles. */
const KNOWN_POSITIONS: Record<string, number> = {
  // England
  "Joe Marler": 1, "Theo Dan": 2, "Dan Cole": 3, "Alex Coles": 5, "Ollie Chessum": 5, "Tom Willis": 2,
  "Ethan Roots": 5, "Danny Care": 9, "Fin Smith": 10, "Harry Randall": 9, "Max Malins": 15,
  "Ollie Sleightholme": 11, "Elliot Daly": 15, "Freddie Steward": 15, "Joe Carpenter": 15, "Ben Spencer": 9,
  "Manu Tuilagi": 13, "Louis Lynagh": 11, "Cadghan Murley": 11, "Gabriel Ibitoye": 14, "Tom Roebuck": 14,
  "Will Goodrick-Clarke": 14, "Ewan Richards": 4, "Elliott Obatoyinbo": 11,
  // France
  "Reda Wardi": 1, "Julien Marchand": 2, "Dorian Aldegheri": 3, "Paul Gabrillagues": 4, "Cameron Woki": 5,
  "Anthime Jelich": 4, "Paul Boudehent": 7, "Sekou Macalou": 7, "Baptiste Couillande": 9, "Noah Lolesio": 10,
  "Antoine Hastoy": 10, "Nicolas Depoort": 1, "Jonathan Danty": 12, "Matthis Lebel": 11,
  "Émilien Gailleton": 12, "Théo Attissogbé": 11, "Éric Dos Santos": 1, "Rodrigue Neti": 1, "Alexandre Roumat": 5,
  "Antoine Zeghdar": 13, "Romain Ntamack": 10, "Pita Ahki": 13, "Arthur Retière": 15,
  // Ireland
  "Finlay Bealham": 3, "Ronan Kelleher": 2, "Cian Healy": 1, "James Ryan": 4, "Iain Henderson": 5,
  "Tom O'Toole": 3, "Jack Conan": 8, "Craig Casey": 9, "Jack Crowley": 10, "Ross Byrne": 10,
  "Jordan Larmour": 15, "Jimmy O'Brien": 15, "Stuart McCloskey": 12, "Tommy Bowe": 11, "Rob Herring": 2,
  "Dave Kilcoyne": 1, "Jeremy Loughman": 1, "Ed Byrne": 1, "Max Deegan": 6, "Jack Boyle": 3,
  "Cian Prendergast": 6, "Shane Daly": 15, "Keith Earls": 11, "Simon Zebo": 15, "John Ryan": 3,
  // New Zealand
  "Ofa Tu'ungafasi": 1, "Asafo Aumua": 2, "Fletcher Newell": 3, "Patrick Tuipulotu": 4, "Sam Darry": 5,
  "Akira Ioane": 6, "Luke Jacobson": 7, "Finlay Christie": 9, "Stephen Perofeta": 10, "Emoni Narawa": 14,
  "Anton Lienert-Brown": 12, "David Havili": 12, "Sevu Reece": 14, "Mark Tele'a": 13, "Zarn Sullivan": 15,
  "TJ Perenara": 9, "Ruben Love": 15, "Petrus Danskie": 2, "Ethan Blackadder": 7, "Tom Christie": 7,
  // South Africa
  "Trevor Nyakane": 3, "Bongi Mbonambi": 2, "Vincent Koch": 3, "RG Snyman": 5, "Salmaan Moerat": 5,
  "Evan Roos": 8, "Deon Fourie": 7, "Cobus Reinach": 9, "Manie Libbok": 10, "Canan Moodie": 10,
  "Makazole Mapimpi": 11, "Aphelele Fassi": 15, "Andre Esterhuizen": 12, "Lukhanyo Am": 12, "Grant Williams": 9,
  "Siya Masuku": 11, "Kwagga Smith": 7, "Elton Jantjies": 10, "Ruan Nortje": 4, "Ben-Jason Dixon": 6,
  // Australia
  "Angus Bell": 1, "Dave Porecki": 2, "Taniela Tupou": 3, "Ryan Smith": 3, "Cadeyrn Neville": 5,
  "Langi Gleeson": 6, "Charlie Cale": 7, "Tate McDermott": 9, "Tom Lynagh": 9, "Lachie Anderson": 15,
  "Jock Campbell": 15, "Hunter Paisami": 12, "Lalakai Foketi": 13, "Darby Lancaster": 11, "Dylan Pietsch": 11,
  "Ben Donaldson": 10, "Nic White": 9, "Reece Hodge": 15, "Marika Koroibete": 11, "Filipo Daugunu": 11,
  // Argentina
  "Facundo Gigena": 1, "Mayco Vivas": 1, "Ignacio Ruiz": 2, "Matías Alemanno": 4, "Lautaro Soccino": 2,
  "Francisco Orrantia": 6, "Santiago Grondona": 7, "Lautaro Bazán": 9, "Santiago Carreras": 15, "Lucas Martínez": 9,
  "Jerónimo de la Fuente": 12, "Matías Orlando": 12, "Emilio Cordero": 13, "Facundo Isa": 7, "Lucio Anconetani": 13,
  "Ignacio Mendy": 11, "Socino Bautista": 2, "Agustín Segura": 14,
  // Club corrections for players misplaced in squad lists
  "Giacomo Ferrari": 1, "Simone Gesi": 15, "Scott Gregory": 12, "Onisi Ratave": 14,
  "Siosifa Amone": 12, "Jaco Visagie": 2, "Asenathi Ntlabakanye": 15, "Renzo du Plessis": 2,
  "Owen Farrell": 12, "Alex Goode": 15,
};

/** Distinct club names per division (lowest → top), so every division feels unique. */
const DIVISION_CLUB_NAMES: string[][] = [
  ["Bramley Stags", "Caldbeck Boars", "Dunmore Otters", "Fenbridge Rams", "Holloway Ravens", "Kestrel Park Foxes", "Marsh End Badgers"],
  ["Ashvale Wolves", "Barrowmoor Falcons", "Craydon Bears", "Drakemill Eagles", "Elmsworth Lions", "Foxglove Hounds", "Ironbridge Bulls"],
  ["Stonegate Sharks", "Ridgeway Rhinos", "Northcote Panthers", "Vale United", "Grantham Griffins", "Harlow Hawks", "Millford Mustangs"],
  ["Capital City RFC", "Harbour Town", "Kingsbridge", "Eastmark", "Silverdale", "Port Regis", "Westmoor"],
  ["Metropolis", "Northgate", "Sovereign", "Crown City", "Palatinate", "Ironclad", "Vanguard"],
  ["Leinster", "Munster", "Bulls", "Stormers", "Crusaders", "Blues", "Brumbies"],
];

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
  const h = [...name].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 17);
  const pace = round(25 + base.speed * 8.1 + (position >= 11 ? 8 : 0));
  const physicality = round(base.strength * 0.62 + (position <= 8 ? 23 : 5));
  const scrum = round(position <= 3 ? 66 + (base.strength - 55) * 0.48 : position <= 8 ? 42 + (base.strength - 55) * 0.22 : 22 + (base.strength - 55) * 0.08);
  const boost = ovr - (teamRating - 12);
  const leadership = round((position === 9 ? 74 : position === 10 ? 78 : position === 2 ? 70 : position === 8 ? 68 : 48) + (h % 17) - 8 + boost * 0.3);
  const lineout = round(position === 4 || position === 5 ? 78 + (h % 14) : position === 2 ? 70 : position === 6 || position === 7 ? 55 : 30);
  const agility = round((base.evasion + base.speed * 6) / 2 + boost * 0.35);
  const discipline = round(52 + (base.tackling - 60) * 0.25 + ((h >> 8) % 21) - 10);
  return {
    pace: round(pace + boost * 0.45),
    strength: round(base.strength + boost * 0.4),
    physicality: round(physicality + boost * 0.5),
    scrummaging: round(scrum + boost * 0.25),
    tackling: round(base.tackling + boost * 0.4),
    handling: round(base.handling + boost * 0.45),
    kicking: round(base.kicking + boost * 0.35),
    evasion: round(base.evasion + (role === "wing" || role === "fullback" ? 5 : 0) + boost * 0.4),
    leadership, lineout, agility, discipline,
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
    .map((name, index) =>
      // Real-world shirt role from the curated database where known; otherwise shirt order / bench role.
      cardFromTeam(team, (KNOWN_POSITIONS[name] ?? (index < 15 ? index + 1 : BENCH_ROLES[(index - 15) % BENCH_ROLES.length])) as UltimatePosition, name, index)),
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
      leadership: round(40 + (index % 22)), lineout: round(position <= 5 ? 52 + (index % 16) : 24),
      agility: round(paceBase + (index % 9)), discipline: round(45 + ((index * 5) % 22)),
    },
  };
}

/** Fair quick-sell valuation: exponential in OVR with a rarity floor so cards sell for what they're worth. */
export function cardValue(card: UltimateCard): number {
  const floors: Record<CardRarity, number> = { bronze: 30, silver: 150, gold: 600, elite: 2000 };
  const curve = Math.pow(1.12, card.ovr - 50) * 40;
  return Math.max(floors[card.rarity], Math.round(curve));
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
    league: createLeague(0, 1),
    log: ["Welcome to Ultimate Team. Your bronze Academy XV starts in Regional League Three. Win promotion to reach the URC Super League."],
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
    league: state.league ?? createLeague(0, 1),
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

// ---------------------------------------------------------------------------
// Promotion & relegation league ladder
// ---------------------------------------------------------------------------

export interface DivisionDef { id: string; name: string; tier: number; min: number; max: number }
export const DIVISIONS: DivisionDef[] = [
  { id: "regional-3", name: "Regional League Three", tier: 6, min: 44, max: 54 },
  { id: "regional-2", name: "Regional League Two", tier: 5, min: 55, max: 62 },
  { id: "regional-1", name: "Regional League One", tier: 4, min: 63, max: 70 },
  { id: "national-2", name: "National Championship Two", tier: 3, min: 71, max: 77 },
  { id: "national-1", name: "National Championship One", tier: 2, min: 78, max: 84 },
  { id: "urc", name: "URC Super League", tier: 1, min: 85, max: 93 },
];

export interface LeagueMatch { home: number; away: number; played: boolean; homeScore?: number; awayScore?: number }
export interface LeagueState {
  divisionIndex: number;
  season: number;
  round: number; // 0-based completed rounds
  opponents: UltimateOpponent[];
  rounds: LeagueMatch[][];
  promotion?: "up" | "down" | "stay";
}

function createAiOpponentInBand(min: number, max: number, seed: number, divisionIndex: number, slot: number): UltimateOpponent {
  const mid = Math.round((min + max) / 2);
  const opp = createAiOpponent("silver", seed);
  // Re-roll card OVRs into the division band by re-generating cards at band target.
  const target = clamp(mid + ((seed % 5) - 2), min, max);
  const cards = [...POSITIONS, ...BENCH_ROLES].map((position, index) => {
    const card = aiCard(target, position, index + seed);
    card.ovr = clamp(card.ovr, min, max);
    card.rarity = rarityFor(card.ovr);
    return card;
  });
  const names = DIVISION_CLUB_NAMES[clamp(divisionIndex, 0, DIVISION_CLUB_NAMES.length - 1)];
  const clubName = names[slot % names.length];
  return { ...opp, name: clubName, cards, teamId: `div${divisionIndex}-${slot}`, level: min >= 78 ? "elite" : min >= 63 ? "gold" : min >= 55 ? "silver" : "bronze" };
}

function circleSchedule(size: number): [number, number][][] {
  const ids = Array.from({ length: size }, (_, i) => i);
  if (ids.length % 2) ids.push(-99);
  const n = ids.length;
  const rounds: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i]; const b = ids[n - 1 - i];
      if (a !== -99 && b !== -99) round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    ids.splice(1, 0, ids.pop() as number);
  }
  return rounds;
}

export function createLeague(divisionIndex: number, season: number, seed = Math.floor(Math.random() * 99999)): LeagueState {
  const div = DIVISIONS[clamp(divisionIndex, 0, DIVISIONS.length - 1)];
  const opponents = Array.from({ length: 7 }, (_, i) => createAiOpponentInBand(div.min, div.max, seed + i * 131 + i * i, divisionIndex, i));
  // index 0 = user (-1), opponents are 1..7
  const rounds = circleSchedule(8).map((round) => round.map(([a, b]) => ({ home: a === 0 ? -1 : a, away: b === 0 ? -1 : b, played: false })));
  return { divisionIndex, season, round: 0, opponents, rounds, promotion: undefined };
}

function avgOvrOf(cards: UltimateCard[]): number {
  return Math.round(cards.slice(0, 15).reduce((sum, card) => sum + card.ovr, 0) / 15);
}

function leagueScore(strengthDiff: number): number {
  const exp = 15 + strengthDiff * 0.6 + Math.random() * 12;
  const tries = Math.max(0, Math.round((exp / 7) * (0.5 + Math.random() * 0.8)));
  const conv = Math.round(tries * (0.5 + Math.random() * 0.35));
  const pens = Math.round(Math.random() * 3);
  return tries * 5 + conv * 2 + pens * 3;
}

export interface LeagueTable { teamKey: number; name: string; played: number; won: number; drawn: number; lost: number; pf: number; pa: number; pts: number; isUser: boolean }

export function leagueTable(state: UltimateClubState): LeagueTable[] {
  const league = state.league!;
  const entries: LeagueTable[] = [
    { teamKey: -1, name: state.clubName, played: 0, won: 0, drawn: 0, lost: 0, pf: 0, pa: 0, pts: 0, isUser: true },
    ...league.opponents.map((opp, i) => ({ teamKey: i + 1, name: opp.name, played: 0, won: 0, drawn: 0, lost: 0, pf: 0, pa: 0, pts: 0, isUser: false })),
  ];
  const byKey = new Map(entries.map((e) => [e.teamKey, e]));
  for (const round of league.rounds) for (const match of round) {
    if (!match.played) continue;
    const home = byKey.get(match.home)!; const away = byKey.get(match.away)!;
    const hs = match.homeScore ?? 0; const as = match.awayScore ?? 0;
    home.played++; away.played++; home.pf += hs; home.pa += as; away.pf += as; away.pa += hs;
    if (hs > as) { home.won++; home.pts += 4; away.lost++; if (hs - as <= 7) away.pts++; }
    else if (as > hs) { away.won++; away.pts += 4; home.lost++; if (as - hs <= 7) home.pts++; }
    else { home.drawn++; away.drawn++; home.pts += 2; away.pts += 2; }
    if (hs >= 20) home.pts++; if (as >= 20) away.pts++;
  }
  return entries.sort((a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf);
}

export function currentLeagueMatch(state: UltimateClubState): LeagueMatch | null {
  const league = state.league;
  if (!league || league.round >= league.rounds.length) return null;
  return league.rounds[league.round].find((m) => m.home === -1 || m.away === -1) ?? null;
}

export function recordLeagueResult(state: UltimateClubState, result: MatchResult): { state: UltimateClubState; promoted?: "up" | "down" | "stay"; seasonComplete: boolean; reward: number } {
  const league = state.league!;
  const match = currentLeagueMatch(state);
  if (!match) return { state, seasonComplete: true, reward: 0 };
  match.played = true;
  match.homeScore = result.homeScore;
  match.awayScore = result.awayScore;
  // Per-match funds: base by result, scaled by league tier and opponent quality.
  const div = DIVISIONS[league.divisionIndex];
  const userHome = match.home === -1;
  const oppIndex = (match.home === -1 ? match.away : match.home) - 1;
  const oppAvg = avgOvrOf(league.opponents[oppIndex].cards);
  const userScore = userHome ? result.homeScore : result.awayScore;
  const oppScore = userHome ? result.awayScore : result.homeScore;
  const outcome = userScore > oppScore ? "win" : userScore === oppScore ? "draw" : "loss";
  const tierMult = 1 + (DIVISIONS.length - div.tier) * 0.25;
  const oppFactor = 0.6 + oppAvg / 100;
  const base = outcome === "win" ? 260 : outcome === "draw" ? 130 : 70;
  const matchReward = Math.round(base * tierMult * oppFactor);
  // Simulate the other three matches in this round.
  for (const other of league.rounds[league.round]) {
    if (other.played) continue;
    const homeOvr = other.home === -1 ? avgOvrOf(getSquadCards(state)) : avgOvrOf(league.opponents[other.home - 1].cards);
    const awayOvr = other.away === -1 ? avgOvrOf(getSquadCards(state)) : avgOvrOf(league.opponents[other.away - 1].cards);
    other.played = true;
    other.homeScore = leagueScore(homeOvr - awayOvr);
    other.awayScore = leagueScore(awayOvr - homeOvr);
  }
  let next: UltimateClubState = { ...state, coins: state.coins + matchReward, league: { ...league, round: league.round + 1 } };
  const seasonComplete = next.league!.round >= next.league!.rounds.length;
  let promoted: "up" | "down" | "stay" | undefined;
  let bonus = 0;
  if (seasonComplete) {
    const table = leagueTable(next);
    const pos = table.findIndex((e) => e.isUser) + 1;
    if (pos <= 2 && next.league!.divisionIndex < DIVISIONS.length - 1) promoted = "up";
    else if (pos >= 7 && next.league!.divisionIndex > 0) promoted = "down";
    else promoted = "stay";
    const newIndex = promoted === "up" ? next.league!.divisionIndex + 1 : promoted === "down" ? next.league!.divisionIndex - 1 : next.league!.divisionIndex;
    bonus = promoted === "up" ? 1200 : promoted === "down" ? 250 : 500;
    next = { ...next, coins: next.coins + bonus };
    next.league = { ...createLeague(newIndex, next.league!.season + 1), promotion: promoted };
    next.log = [promoted === "up" ? `PROMOTED to ${DIVISIONS[newIndex].name}! +${bonus} funds.` : promoted === "down" ? `Relegated to ${DIVISIONS[newIndex].name}. +${bonus} funds.` : `Season complete (${pos}${pos === 1 ? "st" : pos === 2 ? "nd" : pos === 3 ? "rd" : "th"}). +${bonus} funds.`, ...next.log].slice(0, 20);
  }
  const oppName = league.opponents[oppIndex].name;
  next.log = [`${outcome === "win" ? "WIN" : outcome === "draw" ? "DRAW" : "LOSS"} ${userScore}-${oppScore} v ${oppName} (+${matchReward} funds)`, ...next.log].slice(0, 20);
  return { state: next, promoted, seasonComplete, reward: matchReward + bonus };
}
