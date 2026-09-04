export type Vec2 = { x: number; y: number };
export type TeamIndex = 0 | 1;
export type Difficulty = "easy" | "normal" | "hard";

export interface TeamData {
  id: string;
  name: string;
  short: string;
  country: string;
  type: "international" | "club";
  primary: string;
  secondary: string;
  rating: number;
  stadiumId?: string;
  /** 15 starting players in shirt-number order (1..15) */
  players: string[];
}

export interface Competition {
  id: string;
  name: string;
  short: string;
  format: "league" | "worldcup";
  teamIds: string[];
  doubleRound?: boolean;
  /** number of teams that qualify for knockout playoffs (league formats) */
  playoffTeams?: number;
  color: string;
  tagline: string;
  description: string;
}

export interface Stadium {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  grassA: string;
  grassB: string;
  stand: string;
  accent: string;
  night: boolean;
}

export interface Attributes {
  speed: number; // max run speed in m/s
  strength: number;
  tackling: number;
  handling: number;
  kicking: number;
  evasion: number;
}

export interface PlayerState {
  id: number;
  team: TeamIndex;
  number: number;
  name: string;
  pos: Vec2;
  vel: Vec2;
  facing: number;
  attrs: Attributes;
  down: number;
  busy: number;
  tackleCooldown: number;
  stamina: number;
  isForward: boolean;
  aiTimer: number;
  /** current one-shot animation and when it ends (engine time) */
  anim: AnimKind;
  animUntil: number;
  /** long-term fatigue accumulated over the match (caps max stamina) */
  fatigue: number;
  // --- New features ---
  isOnField: boolean;      // currently on field (true for starting XV or subbed-on)
  isBench: boolean;        // currently on the bench
  isInjured: boolean;      // got injured and can no longer play
  hasBeenSubbedOff: boolean; // subbed off (cannot re-enter)
  rating: number;          // overall player rating
}

export type AnimKind = "none" | "pass" | "kick" | "dive" | "tackle" | "celebrate" | "injured" | "sidestep" | "bounce" | "lie";

export type KickKind = "punt" | "grubber" | "kickoff" | "dropout" | "dropgoal" | "conversion" | "penalty";

export interface BallState {
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  carrier: number | null;
  lastTeam: TeamIndex | null;
  lastPlayer: number | null;
  flight: "none" | "pass" | "kick";
  kickKind: KickKind | null;
  kickTeam: TeamIndex | null;
  kickFromX: number;
  kickFrom22: boolean;
  bounced: boolean;
  noCatchUntil: number;
  passer: number | null;
  passerUntil: number;
  goalChecked: boolean;
  /** predicted arrival point of a pass / landing point of a kick */
  target: Vec2 | null;
  /** intended receiver of a pass */
  receiver: number | null;
}

export type Phase =
  | "kickoff"
  | "dropout"
  | "play"
  | "tackle"
  | "ruck"
  | "scrum"
  | "lineout"
  | "try"
  | "goalKick"
  | "penaltyChoice"
  | "whistle"
  | "halftime"
  | "fulltime";

export interface MatchEvent {
  minute: number;
  team: TeamIndex;
  type: "try" | "conversion" | "penalty" | "dropgoal";
  player: string;
  points: number;
}

export interface InputFrame {
  moveX: number;
  moveY: number;
  sprint: boolean;
  kickHeld: boolean;
  passUp: boolean;
  passDown: boolean;
  kickRelease: boolean;
  dropGoal: boolean;
  action: boolean;
  switchPlayer: boolean;
  option1: boolean;
  option2: boolean;
  option3: boolean;
}

export interface MatchConfig {
  home: TeamData;
  away: TeamData;
  userTeam: TeamIndex | null;
  halfSeconds: number;
  difficulty: Difficulty;
  homeColor?: string;
  awayColor?: string;
  competition?: string;
  stadiumId?: string;
  /** Custom starting lineups (indexes into the team's player list) */
  homeLineup?: number[];
  awayLineup?: number[];
  /** Custom bench lineups */
  homeBench?: number[];
  awayBench?: number[];
  /** Speeds up the engine simulation for watch mode (e.g. 1 or 2) */
  spectatorSpeed?: number;
  // --- New Player Career options ---
  playerLockPosition?: number;
  playerLockName?: string;
  playerLockAttributes?: Attributes;
}

export interface RefereeState {
  pos: Vec2;
  vel: Vec2;
  facing: number;
  animFrame: number;
}

export interface TMOState {
  active: boolean;
  timer: number;
  checkType: "try" | "forwardPass" | "highTackle";
  homeScoreBefore: number;
  awayScoreBefore: number;
  decision: "confirmed" | "overridden";
  reason: string;
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  homeTries: number;
  awayTries: number;
  events: MatchEvent[];
}
