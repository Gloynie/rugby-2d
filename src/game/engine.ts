import type {
  Attributes,
  BallState,
  Difficulty,
  InputFrame,
  KickKind,
  MatchConfig,
  MatchEvent,
  MatchResult,
  PlayerMatchRating,
  Phase,
  PlayerState,
  TeamMatchStats,
  TeamData,
  TeamIndex,
  Vec2,
  RefereeState,
} from "./types";

export const L = 120;
export const W = 70;
const G = 9.81;
const DEG = Math.PI / 180;
const CATCH_R = 1.15;
const TACKLE_R = 1.35;
const GOAL_ELEV = 33 * DEG;

export function emptyTeamMatchStats(): TeamMatchStats {
  return {
    tries: 0, penalties: 0, dropGoals: 0, conversions: 0,
    scrumsWon: 0, lineoutsWon: 0, tackles: 0, lineBreaks: 0,
    metresMade: 0, possessionSeconds: 0, territorySeconds: 0, passes: 0,
  };
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const hyp = (x: number, y: number) => Math.sqrt(x * x + y * y);
const dist = (a: Vec2, b: Vec2) => hyp(a.x - b.x, a.y - b.y);
const other = (t: TeamIndex): TeamIndex => (t === 0 ? 1 : 0);

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const BASES: Record<string, Attributes> = {
  prop: { speed: 5.6, strength: 95, tackling: 80, handling: 60, kicking: 20, evasion: 40 },
  hooker: { speed: 6.0, strength: 88, tackling: 82, handling: 66, kicking: 25, evasion: 50 },
  lock: { speed: 5.9, strength: 90, tackling: 80, handling: 62, kicking: 20, evasion: 45 },
  flanker: { speed: 6.7, strength: 85, tackling: 90, handling: 70, kicking: 30, evasion: 62 },
  eight: { speed: 6.7, strength: 90, tackling: 85, handling: 72, kicking: 30, evasion: 64 },
  nine: { speed: 7.0, strength: 60, tackling: 66, handling: 90, kicking: 76, evasion: 80 },
  ten: { speed: 6.9, strength: 62, tackling: 66, handling: 90, kicking: 92, evasion: 78 },
  wing: { speed: 7.7, strength: 68, tackling: 62, handling: 78, kicking: 45, evasion: 88 },
  centre: { speed: 7.3, strength: 80, tackling: 82, handling: 80, kicking: 50, evasion: 78 },
  fullback: { speed: 7.5, strength: 66, tackling: 70, handling: 85, kicking: 86, evasion: 82 },
};

export function roleFor(n: number): string {
  switch (n) {
    case 1: case 3: return "prop";
    case 2: return "hooker";
    case 4: case 5: return "lock";
    case 6: case 7: return "flanker";
    case 8: return "eight";
    case 9: return "nine";
    case 10: return "ten";
    case 11: case 14: return "wing";
    case 12: case 13: return "centre";
    default: return "fullback";
  }
}

export function buildAttributes(number: number, name: string, rating: number): Attributes {
  const b = BASES[roleFor(number)];
  const h = hashStr(name);
  const j = (k: number) => (((h >> (k * 4)) & 15) / 15 - 0.5) * 8;
  const adj = (rating - 80) * 0.5;
  return {
    speed: clamp(b.speed + (rating - 80) * 0.02 + j(0) * 0.05, 5.0, 8.6),
    strength: clamp(b.strength + adj + j(1), 30, 99),
    tackling: clamp(b.tackling + adj + j(2), 30, 99),
    handling: clamp(b.handling + adj + j(3), 30, 99),
    kicking: clamp(b.kicking + adj + j(4), 10, 99),
    evasion: clamp(b.evasion + adj + j(5), 30, 99),
  };
}

export interface TeamRuntime {
  data: TeamData;
  dir: 1 | -1;
  color: string;
  lineF: number;
}

export interface RuckState {
  x: number;
  y: number;
  team: TeamIndex;
  timer: number;
  joined: [Set<number>, Set<number>];
  joiners: [number[], number[]];
  userGrace: number;
}

export interface GoalKickMeter {
  stage: "power" | "accuracy" | "done";
  value: number;
  dirn: number;
  power: number;
  accuracy: number;
}

export interface GoalKickState {
  team: TeamIndex;
  kind: "conversion" | "penalty";
  x: number;
  y: number;
  kickerId: number;
  launched: boolean;
  scored: boolean;
  timer: number;
  scoredAt: number;
  aiTimer: number;
  distance: number;
  requiredPower: number;
  meter: GoalKickMeter | null;
}

export interface PenaltyState {
  team: TeamIndex;
  x: number;
  y: number;
  canGoal: boolean;
  distance: number;
  timer: number;
}

export interface RestartInfo {
  kind: "kickoff" | "dropout" | "scrum" | "lineout" | "penalty";
  team: TeamIndex;
  x: number;
  y: number;
}

interface Decision {
  dir: Vec2;
  sprint: boolean;
}

interface FrameContext {
  carrier: PlayerState | null;
  focus: Vec2;
  att: TeamIndex;
  chasers: [Set<number>, Set<number>];
  slots: [Map<number, number>, Map<number, number>];
}

/** JSON-safe state sent from an online-match host to the invited opponent. */
export interface NetworkMatchState {
  time: number;
  clock: number;
  half: 1 | 2;
  timeUp: boolean;
  score: [number, number];
  tries: [number, number];
  possession: TeamIndex;
  phase: Phase;
  phaseTimer: number;
  finished: boolean;
  controlled: number;
  remoteControlled: number;
  players: PlayerState[];
  ball: BallState;
  teams: { dir: 1 | -1; color: string; lineF: number }[];
  message: { text: string; sub: string; timer: number; color: string };
  commentary: string[];
  liveCommentary: { text: string; team: TeamIndex | null; t: number }[];
  events: MatchEvent[];
  restart: unknown;
  ruck: unknown;
  goalKick: unknown;
  penalty: unknown;
  tryInfo: unknown;
  tryScorer: number | null;
  lastTackle: unknown;
  referee: RefereeState;
  touchJudges: [RefereeState, RefereeState];
  matchResult: MatchResult;
}

export class RugbyEngine {
  teams: [TeamRuntime, TeamRuntime];
  players: PlayerState[] = [];
  ball: BallState;
  phase: Phase = "kickoff";
  phaseTimer = 0;
  half: 1 | 2 = 1;
  clock = 0;
  halfSeconds: number;
  timeUp = false;
  score: [number, number] = [0, 0];
  tries: [number, number] = [0, 0];
  possession: TeamIndex = 0;
  userTeam: TeamIndex | null;
  /** Second browser-controlled team in invite online friendlies. */
  remoteTeam: TeamIndex | null = null;
  controlled = -1;
  remoteControlled = -1;
  message = { text: "", sub: "", timer: 0, color: "#ffffff" };
  commentary: string[] = [];
  /** Live play-by-play commentary (shown in overlay) */
  liveCommentary: { text: string; team: TeamIndex | null; t: number }[] = [];
  events: MatchEvent[] = [];
  teamStats: [TeamMatchStats, TeamMatchStats] = [emptyTeamMatchStats(), emptyTeamMatchStats()];
  private playerStatMap = new Map<number, Omit<PlayerMatchRating, "rating">>();
  /** prevents counting the same carrier crossing a defensive line repeatedly */
  private lineBreakPlayers = new Set<number>();
  time = 0;
  dt = 1 / 60;
  difficulty: Difficulty;
  restart: RestartInfo | null = null;
  ruck: RuckState | null = null;
  goalKick: GoalKickState | null = null;
  penalty: PenaltyState | null = null;
  kickCharge = 0;
  charging = false;
  inGoalTimer = 0;
  deadTimer = 0;
  passChain = 0;
  carryTime = 0;
  firstHalfKicker: TeamIndex = 0;
  lastTackle: { tackler: number; carrier: number } | null = null;
  tryInfo: { team: TeamIndex; y: number } | null = null;
  tryScorer: number | null = null;
  userOffsideWarning = false;
  finished = false;
  aiSpeedMult = 1;
  rng: () => number = Math.random;

  // --- New features ---
  referee: RefereeState;
  touchJudges: [RefereeState, RefereeState];
  spectatorSpeed = 1;
  playerLockPosition: number | null = null; // Position to lock control (Be a Pro mode)
  userTries = 0;
  userTackles = 0;
  userPasses = 0;

  constructor(cfg: MatchConfig) {
    this.userTeam = cfg.userTeam;
    this.remoteTeam = cfg.remoteTeam ?? null;
    this.halfSeconds = cfg.halfSeconds;
    this.difficulty = cfg.difficulty;
    this.spectatorSpeed = cfg.spectatorSpeed ?? 1;
    this.aiSpeedMult = cfg.difficulty === "easy" ? 0.92 : cfg.difficulty === "hard" ? 1.06 : 1;
    this.teams = [
      { data: cfg.home, dir: 1, color: cfg.homeColor ?? cfg.home.primary, lineF: 60 },
      { data: cfg.away, dir: -1, color: cfg.awayColor ?? cfg.away.secondary, lineF: 60 },
    ];

    // Initialize Referee
    this.referee = {
      pos: { x: 55, y: 30 },
      vel: { x: 0, y: 0 },
      facing: 0,
      animFrame: 0,
    };

    // Initialize Touch Judges (wearing neon green)
    this.touchJudges = [
      { pos: { x: 60, y: -1.5 }, vel: { x: 0, y: 0 }, facing: 0, animFrame: 0 },
      { pos: { x: 60, y: W + 1.5 }, vel: { x: 0, y: 0 }, facing: Math.PI, animFrame: 0 },
    ];

    let id = 0;
    for (const t of [0, 1] as TeamIndex[]) {
      const data = this.teams[t].data;
      const totalPlayersCount = data.players.length;
      
      // Determine starters vs bench lists (indexes in roster)
      const lineup = t === 0 ? (cfg.homeLineup ?? Array.from({length: 15}, (_, i) => i)) : (cfg.awayLineup ?? Array.from({length: 15}, (_, i) => i));
      const bench = t === 0 ? (cfg.homeBench ?? Array.from({length: 8}, (_, i) => 15 + i)) : (cfg.awayBench ?? Array.from({length: 8}, (_, i) => 15 + i));

      for (let i = 0; i < totalPlayersCount; i++) {
        const name = data.players[i] ?? `Player ${i + 1}`;
        const isStarter = lineup.includes(i);
        const isBenched = bench.includes(i);
        
        // If neither starter nor benched, they are extended squad reserves (available for bench)
        const activeInGame = isStarter || isBenched;
        if (!activeInGame && i >= 23) continue; // clamp to 23 for simplicity in the match state

         const jerseyNumber = isStarter ? (lineup.indexOf(i) + 1) : (16 + bench.indexOf(i));
        
        let finalName = name;
        let attrs = buildAttributes(jerseyNumber, name, data.rating);
        
        // Overwrite if player lock / Be A Pro custom player
        const isLockedTeam = t === this.userTeam;
        if (isLockedTeam && cfg.playerLockPosition && jerseyNumber === cfg.playerLockPosition) {
          finalName = cfg.playerLockName || name;
          if (cfg.playerLockAttributes) {
            attrs = { ...cfg.playerLockAttributes };
          }
          this.playerLockPosition = cfg.playerLockPosition;
        }

        const playerRating = Math.round((attrs.speed + attrs.strength + attrs.tackling + attrs.handling + attrs.kicking + attrs.evasion) / 6);

        this.players.push({
          id: id++,
          team: t,
          number: jerseyNumber,
          name: finalName,
          pos: { x: 60, y: 35 },
          vel: { x: 0, y: 0 },
          facing: this.teams[t].dir === 1 ? 0 : Math.PI,
          attrs,
          down: 0,
          busy: 0,
          tackleCooldown: 0,
          stamina: 100,
          isForward: jerseyNumber <= 8,
          aiTimer: this.rng() * 0.2,
          anim: "none",
          animUntil: 0,
          fatigue: 0,
          isOnField: isStarter,
          isBench: isBenched,
          hasBeenSubbedOff: false,
          rating: playerRating,
        });
      }
    }
    for (const p of this.players) {
      this.playerStatMap.set(p.id, {
        id: p.id, team: p.team, number: p.number, name: p.name,
        tries: 0, tackles: 0, lineBreaks: 0, metresMade: 0, passes: 0,
      });
    }
    this.ball = {
      pos: { x: 60, y: 35, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      carrier: null,
      lastTeam: null,
      lastPlayer: null,
      flight: "none",
      kickKind: null,
      kickTeam: null,
      kickFromX: 60,
      kickFrom22: false,
      bounced: false,
      noCatchUntil: 0,
      passer: null,
      passerUntil: 0,
      goalChecked: false,
      target: null,
      receiver: null,
    };
    this.firstHalfKicker = this.rng() < 0.5 ? 0 : 1;
    this.setupKickoff(this.firstHalfKicker, "kickoff");
    this.say("KICK OFF", `${cfg.home.name} v ${cfg.away.name}`);
  }

  // ---------- helpers ----------
  fx(team: TeamIndex, x: number): number {
    return this.teams[team].dir === 1 ? x : L - x;
  }
  wx(team: TeamIndex, f: number): number {
    return this.teams[team].dir === 1 ? f : L - f;
  }
  teamName(t: TeamIndex): string {
    return this.teams[t].data.name;
  }
  pl(team: TeamIndex, number: number): PlayerState {
    // Find player by shirt number (active or on bench)
    const p = this.players.find((pl) => pl.team === team && pl.number === number);
    if (p) return p;
    // Fallback if not found
    return this.players.find((pl) => pl.team === team && pl.isOnField) || this.players[team === 0 ? 0 : 15];
  }

  /** Force a substitution during the game */
  makeSubstitution(team: TeamIndex, onNumber: number, offNumber: number): boolean {
    const playerOff = this.players.find((p) => p.team === team && p.number === offNumber && p.isOnField);
    const playerOn = this.players.find((p) => p.team === team && p.number === onNumber && p.isBench && !p.hasBeenSubbedOff);
    
    if (!playerOff || !playerOn) return false;
    
    playerOff.isOnField = false;
    playerOff.isBench = false;
    playerOff.hasBeenSubbedOff = true;
    playerOff.anim = "none";
    
    playerOn.isOnField = true;
    playerOn.isBench = false;
    playerOn.pos = { ...playerOff.pos };
    playerOn.facing = playerOff.facing;
    playerOn.stamina = Math.min(100 - playerOn.fatigue, 95); // Starts with fresh legs but slightly worn
    
    // Announce sub
    this.say("SUBSTITUTION", `${playerOff.name} off, ${playerOn.name} on`, this.teams[team].color, 3);
    this.pushComment(`Substitution: ${playerOn.name} replaces ${playerOff.name} for ${this.teamName(team)}.`, team);
    
    // Update controlled player if we just subbed him off
    if (this.controlled === playerOff.id) {
      this.controlled = playerOn.id;
    }
    return true;
  }
  carrier(): PlayerState | null {
    return this.ball.carrier === null ? null : this.players[this.ball.carrier];
  }
  gameMinute(): number {
    const m = Math.min(40, Math.floor((this.clock / this.halfSeconds) * 40));
    return m + (this.half === 2 ? 40 : 0) + 1;
  }
  gameClock(): string {
    const total = Math.min(40 * 60, (this.clock / this.halfSeconds) * 40 * 60) + (this.half === 2 ? 40 * 60 : 0);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  private playerStat(id: number): Omit<PlayerMatchRating, "rating"> {
    const known = this.playerStatMap.get(id);
    if (known) return known;
    const p = this.players[id];
    const fallback = { id, team: p?.team ?? 0, number: p?.number ?? 0, name: p?.name ?? "Player", tries: 0, tackles: 0, lineBreaks: 0, metresMade: 0, passes: 0 } as Omit<PlayerMatchRating, "rating">;
    this.playerStatMap.set(id, fallback);
    return fallback;
  }

  private calculatedPlayerRatings(): PlayerMatchRating[] {
    return this.players
      .filter((p) => p.isOnField || p.hasBeenSubbedOff)
      .map((p) => {
        const stat = this.playerStat(p.id);
        const base = 5.7 + stat.tries * 1.45 + stat.tackles * 0.13 + stat.lineBreaks * 0.7 + stat.metresMade * 0.012 + stat.passes * 0.035;
        const fatiguePenalty = Math.max(0, p.fatigue - 24) * 0.012;
        const rating = Math.round(Math.max(4, Math.min(10, base - fatiguePenalty)) * 10) / 10;
        return { ...stat, metresMade: Math.round(stat.metresMade), rating };
      })
      .sort((a, b) => a.team - b.team || a.number - b.number);
  }

  result(): MatchResult {
    return {
      homeScore: this.score[0],
      awayScore: this.score[1],
      homeTries: this.tries[0],
      awayTries: this.tries[1],
      events: [...this.events],
      stats: [{ ...this.teamStats[0], metresMade: Math.round(this.teamStats[0].metresMade) }, { ...this.teamStats[1], metresMade: Math.round(this.teamStats[1].metresMade) }],
      playerRatings: this.calculatedPlayerRatings(),
    };
  }

  /** Serialize the host's authoritative game state for an online guest. */
  exportNetworkState(): NetworkMatchState {
    const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
    return {
      time: this.time,
      clock: this.clock,
      half: this.half,
      timeUp: this.timeUp,
      score: copy(this.score),
      tries: copy(this.tries),
      possession: this.possession,
      phase: this.phase,
      phaseTimer: this.phaseTimer,
      finished: this.finished,
      controlled: this.controlled,
      remoteControlled: this.remoteControlled,
      players: copy(this.players),
      ball: copy(this.ball),
      teams: this.teams.map((t) => ({ dir: t.dir, color: t.color, lineF: t.lineF })),
      message: copy(this.message),
      commentary: copy(this.commentary),
      liveCommentary: copy(this.liveCommentary),
      events: copy(this.events),
      restart: copy(this.restart),
      ruck: this.ruck
        ? { ...copy(this.ruck), joined: this.ruck.joined.map((set) => [...set]) }
        : null,
      goalKick: copy(this.goalKick),
      penalty: copy(this.penalty),
      tryInfo: copy(this.tryInfo),
      tryScorer: this.tryScorer,
      lastTackle: copy(this.lastTackle),
      referee: copy(this.referee),
      touchJudges: copy(this.touchJudges),
      matchResult: this.result(),
    };
  }

  /** Apply a received online-host snapshot without discarding engine methods. */
  importNetworkState(state: NetworkMatchState): void {
    this.time = state.time;
    this.clock = state.clock;
    this.half = state.half;
    this.timeUp = state.timeUp;
    this.score = state.score;
    this.tries = state.tries;
    this.possession = state.possession;
    this.phase = state.phase;
    this.phaseTimer = state.phaseTimer;
    this.finished = state.finished;
    this.controlled = state.controlled;
    this.remoteControlled = state.remoteControlled;
    this.players = state.players;
    this.ball = state.ball;
    state.teams.forEach((saved, i) => {
      const team = this.teams[i];
      if (team) Object.assign(team, saved);
    });
    this.message = state.message;
    this.commentary = state.commentary;
    this.liveCommentary = state.liveCommentary;
    this.events = state.events;
    this.restart = state.restart as RestartInfo | null;
    const rawRuck = state.ruck as (Omit<RuckState, "joined"> & { joined: number[][] }) | null;
    this.ruck = rawRuck
      ? { ...rawRuck, joined: [new Set(rawRuck.joined[0]), new Set(rawRuck.joined[1])] }
      : null;
    this.goalKick = state.goalKick as GoalKickState | null;
    this.penalty = state.penalty as PenaltyState | null;
    this.tryInfo = state.tryInfo as { team: TeamIndex; y: number } | null;
    this.tryScorer = state.tryScorer;
    this.lastTackle = state.lastTackle as { tackler: number; carrier: number } | null;
    this.referee = state.referee;
    this.touchJudges = state.touchJudges;
  }

  say(text: string, sub = "", color = "#ffffff", duration = 2.6): void {
    this.message = { text, sub, timer: duration, color };
    if (text) {
      this.commentary.unshift(sub ? `${text} – ${sub}` : text);
      if (this.commentary.length > 6) this.commentary.pop();
    }
  }
  pushComment(text: string, team: TeamIndex | null = null): void {
    this.liveCommentary.unshift({ text, team, t: this.time });
    if (this.liveCommentary.length > 6) this.liveCommentary.pop();
    this.commentary.unshift(text);
    if (this.commentary.length > 12) this.commentary.pop();
  }
  private gauss(): number {
    const u = Math.max(1e-9, this.rng());
    const v = this.rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  nearestOpponentDist(p: PlayerState): number {
    let best = 99;
    for (const o of this.players) {
      if (!o.isOnField) continue;
      if (o.team === p.team || o.down > 0) continue;
      const d = dist(o.pos, p.pos);
      if (d < best) best = d;
    }
    return best;
  }
  spaceAt(pos: Vec2, team: TeamIndex): number {
    let best = 12;
    for (const o of this.players) {
      if (!o.isOnField) continue;
      if (o.team === team || o.down > 0) continue;
      const d = dist(o.pos, pos);
      if (d < best) best = d;
    }
    return best;
  }
  nearestPlayer(team: TeamIndex, pos: Vec2, excludeId = -1): PlayerState {
    let best: PlayerState | null = null;
    let bd = Infinity;
    for (const p of this.players) {
      if (!p.isOnField) continue;
      if (p.team !== team || p.id === excludeId || p.down > 0 || p.busy > 0) continue;
      const d = dist(p.pos, pos);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best ?? this.pl(team, 9);
  }
  chooseKicker(team: TeamIndex): PlayerState {
    let best = this.pl(team, 10);
    for (const n of [10, 15, 12, 9, 13]) {
      const p = this.pl(team, n);
      if (p.attrs.kicking > best.attrs.kicking) best = p;
    }
    return best;
  }
  defenderOfEnd(x: number): TeamIndex {
    const attackerOfRightEnd: TeamIndex = this.teams[0].dir === 1 ? 0 : 1;
    return x > 60 ? other(attackerOfRightEnd) : attackerOfRightEnd;
  }
  requiredPower(d: number): number {
    const denom = 2 * Math.cos(GOAL_ELEV) ** 2 * (d * Math.tan(GOAL_ELEV) - 3.3);
    if (denom <= 0) return 1;
    const v = Math.sqrt((G * d * d) / denom);
    return clamp((v - 13) / 17, 0, 1);
  }
  predictLanding(): Vec2 {
    const b = this.ball;
    const vz = b.vel.z;
    const t = (vz + Math.sqrt(Math.max(0, vz * vz + 2 * G * b.pos.z))) / G;
    return { x: b.pos.x + b.vel.x * t, y: b.pos.y + b.vel.y * t };
  }

  /** Run Referee and Linesmen movement AI */
  updateOfficials(dt: number): void {
    const bp = this.ball.pos;
    
    // --- 1. Referee AI (neon green) ---
    // Ref runs toward the ball, keeping a safe diagonal distance of 8m so as not to get in the way
    const targetRefX = bp.x - 6;
    const targetRefY = bp.y + (bp.y < 35 ? 7 : -7);
    const dx = targetRefX - this.referee.pos.x;
    const dy = targetRefY - this.referee.pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    
    if (d > 1.5) {
      const speed = Math.min(5.2, d * 1.5);
      this.referee.vel.x = (dx / d) * speed;
      this.referee.vel.y = (dy / d) * speed;
      this.referee.facing = Math.atan2(dy, dx);
      this.referee.animFrame = (this.referee.animFrame + dt * speed * 2) % 6;
    } else {
      this.referee.vel.x = 0;
      this.referee.vel.y = 0;
    }
    this.referee.pos.x = clamp(this.referee.pos.x + this.referee.vel.x * dt, 1, L - 1);
    this.referee.pos.y = clamp(this.referee.pos.y + this.referee.vel.y * dt, 1, W - 1);

    // --- 2. Touch Judges AI (neon green, holding flags) ---
    // Linesmen stay strictly on their sideline, running parallel to the ball's X coordinate
    this.touchJudges.forEach((tj, i) => {
      const tdx = bp.x - tj.pos.x;
      if (Math.abs(tdx) > 0.5) {
        const speed = Math.min(6.5, Math.abs(tdx) * 2);
        tj.vel.x = Math.sign(tdx) * speed;
        tj.facing = tdx > 0 ? 0 : Math.PI;
        tj.animFrame = (tj.animFrame + dt * speed * 2) % 6;
      } else {
        tj.vel.x = 0;
      }
      tj.pos.x = clamp(tj.pos.x + tj.vel.x * dt, 0.5, L - 0.5);
    });
  }

  private resetPlayers(): void {
    for (const p of this.players) {
      if (!p.isOnField) continue;
      p.down = 0;
      p.busy = 0;
      p.vel.x = 0;
      p.vel.y = 0;
      p.tackleCooldown = 0;
      p.anim = "none";
      p.animUntil = 0;
      p.stamina = Math.min(100 - p.fatigue, p.stamina + 20);
    }
    this.charging = false;
    this.kickCharge = 0;
    this.inGoalTimer = 0;
    this.deadTimer = 0;
    this.passChain = 0;
    this.userOffsideWarning = false;
  }
  private place(p: PlayerState, team: TeamIndex, f: number, y: number): void {
    p.pos.x = clamp(this.wx(team, f), 0.5, L - 0.5);
    p.pos.y = clamp(y, 0.8, W - 0.8);
    p.vel.x = 0;
    p.vel.y = 0;
    p.facing = this.teams[p.team].dir === 1 ? 0 : Math.PI;
  }

  // ---------- main update ----------
  update(dt: number, input: InputFrame, remoteInput: InputFrame | null = null): void {
    if (this.finished) return;
    // Apply spectator speed multiplier (e.g. 2x speed spectating)
    dt *= this.spectatorSpeed;
    this.dt = dt;
    this.time += dt;
    
    // Update match officials (referee + touch judges)
    this.updateOfficials(dt);
    if (this.message.timer > 0) this.message.timer -= dt;
    for (const p of this.players) {
      if (p.down > 0) p.down -= dt;
      if (p.busy > 0) p.busy -= dt;
      if (p.tackleCooldown > 0) p.tackleCooldown -= dt;
    }
    switch (this.phase) {
      case "kickoff":
      case "dropout":
        this.updateRestartWait(dt, input, remoteInput);
        break;
      case "play":
        this.updatePlay(dt, input, remoteInput);
        break;
      case "tackle":
        this.tickClock(dt);
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.startRuck();
        break;
      case "ruck":
        this.updateRuck(dt, input, remoteInput);
        break;
      case "scrum":
      case "lineout":
        this.tickClock(dt);
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          if (this.phase === "scrum") this.resolveScrum();
          else this.resolveLineout();
        }
        break;
      case "try":
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0 && this.tryInfo) {
          const t = this.tryInfo.team;
          const y = this.tryInfo.y;
          const back = 10 + Math.abs(y - 35) * 0.55;
          this.setupGoalKick(t, this.wx(t, 110 - back), y, "conversion");
        }
        break;
      case "goalKick":
        this.updateGoalKick(dt, input, remoteInput);
        break;
      case "penaltyChoice":
        this.updatePenaltyChoice(dt, input, remoteInput);
        break;
      case "whistle":
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.executeRestart();
        break;
      case "halftime":
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.startSecondHalf();
        break;
      case "fulltime":
        break;
    }
  }

  private tickClock(dt: number): void {
    this.clock += dt;
    if (this.clock >= this.halfSeconds && !this.timeUp) {
      this.timeUp = true;
      this.say("TIME IS UP", "Play continues until the next stoppage", "#fbbf24");
    }
  }

  // ---------- restarts ----------
  scheduleRestart(kind: RestartInfo["kind"], team: TeamIndex, x = 60, y = 35): void {
    this.restart = { kind, team, x: clamp(x, 0, L), y: clamp(y, 0, W) };
    this.phase = "whistle";
    this.phaseTimer = 1.1;
    this.ball.carrier = null;
    this.ball.flight = "none";
    this.ball.vel = { x: 0, y: 0, z: 0 };
    this.ball.pos.z = 0;
    this.ball.target = null;
    this.ball.receiver = null;
    this.ruck = null;
    this.goalKick = null;
    this.penalty = null;
    this.charging = false;
    this.kickCharge = 0;
  }

  private executeRestart(): void {
    const r = this.restart;
    if (!r) {
      this.setupKickoff(0, "kickoff");
      return;
    }
    if (this.timeUp && r.kind !== "penalty") {
      this.endHalf();
      return;
    }
    switch (r.kind) {
      case "scrum":
        this.setupScrum(r.team, r.x, r.y);
        break;
      case "lineout":
        this.setupLineout(r.team, r.x, r.y < 35 ? 0 : W);
        break;
      case "dropout":
        this.setupKickoff(r.team, "dropout");
        break;
      case "kickoff":
        this.setupKickoff(r.team, "kickoff");
        break;
      case "penalty":
        this.setupPenaltyChoice(r.team, r.x, r.y);
        break;
    }
  }

  private endHalf(): void {
    this.ruck = null;
    this.goalKick = null;
    this.penalty = null;
    this.ball.carrier = null;
    if (this.half === 1) {
      this.phase = "halftime";
      this.phaseTimer = 3.5;
      this.say("HALF TIME", `${this.teamName(0)} ${this.score[0]} – ${this.score[1]} ${this.teamName(1)}`, "#fbbf24", 3.5);
    } else {
      this.phase = "fulltime";
      this.finished = true;
      this.say("FULL TIME", `${this.teamName(0)} ${this.score[0]} – ${this.score[1]} ${this.teamName(1)}`, "#fbbf24", 99);
    }
  }

  private startSecondHalf(): void {
    this.half = 2;
    this.clock = 0;
    this.timeUp = false;
    this.teams[0].dir = this.teams[0].dir === 1 ? -1 : 1;
    this.teams[1].dir = this.teams[1].dir === 1 ? -1 : 1;
    for (const p of this.players) {
      p.fatigue = Math.max(0, p.fatigue - 12);
      p.stamina = 100 - p.fatigue;
    }
    this.setupKickoff(other(this.firstHalfKicker), "kickoff");
    this.say("SECOND HALF", "Teams have changed ends");
  }

  setupKickoff(team: TeamIndex, kind: "kickoff" | "dropout"): void {
    if (this.timeUp) {
      this.endHalf();
      return;
    }
    this.resetPlayers();
    this.ruck = null;
    this.goalKick = null;
    this.penalty = null;
    this.phase = kind;
    this.phaseTimer = 1.6;
    const rcv = other(team);
    const kicker = this.chooseKicker(team);
    const baseF = kind === "kickoff" ? 60 : 10;
    this.restart = { kind, team, x: this.wx(team, baseF), y: 35 };
    let i = 0;
    for (let n = 1; n <= 15; n++) {
      const p = this.pl(team, n);
      if (p.id === kicker.id) {
        this.place(p, team, baseF - 0.8, 35);
        continue;
      }
      this.place(p, team, baseF - 2.5, 5 + i * 4.4);
      i++;
    }
    // receiving team
    const off = kind === "kickoff" ? 0 : -40;
    for (let n = 1; n <= 8; n++) {
      const k = n - 1;
      const f = 66 + off + (k % 2) * 3;
      const y = k < 4 ? 13 + k * 4 : 41 + (k - 4) * 4;
      this.place(this.pl(rcv, n), team, f, y);
    }
    this.place(this.pl(rcv, 9), team, 66 + off, 35);
    this.place(this.pl(rcv, 10), team, 76 + off, 30);
    this.place(this.pl(rcv, 12), team, 74 + off, 46);
    this.place(this.pl(rcv, 13), team, 74 + off, 22);
    this.place(this.pl(rcv, 11), team, 84 + off, 10);
    this.place(this.pl(rcv, 14), team, 84 + off, 60);
    this.place(this.pl(rcv, 15), team, 92 + off, 35);
    const b = this.ball;
    b.carrier = kicker.id;
    b.flight = "none";
    b.kickKind = null;
    b.vel = { x: 0, y: 0, z: 0 };
    b.pos = { x: kicker.pos.x, y: kicker.pos.y, z: 1 };
    this.possession = rcv;
    if (this.userTeam !== null) {
      this.controlled = this.userTeam === team ? kicker.id : this.pl(this.userTeam, 15).id;
    }
  }

  private updateRestartWait(dt: number, input: InputFrame, remoteInput: InputFrame | null): void {
    const r = this.restart;
    if (!r) return;
    // Each human-controlled team waits for that browser's action.
    const teamInput = r.team === this.userTeam ? input : r.team === this.remoteTeam ? remoteInput : null;
    if (teamInput) {
      if (teamInput.action) this.performRestartKick();
    } else {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.performRestartKick();
    }
  }

  private performRestartKick(): void {
    const r = this.restart;
    if (!r) return;
    const team = r.team;
    const kicker = this.carrier() ?? this.chooseKicker(team);
    let tf: number;
    let ty: number;
    if (r.kind === "kickoff") {
      tf = 73 + this.rng() * 18;
      ty = this.rng() < 0.5 ? 8 + this.rng() * 14 : 48 + this.rng() * 14;
    } else {
      tf = 38 + this.rng() * 22;
      ty = 14 + this.rng() * 42;
    }
    this.launchKickTo(kicker, this.wx(team, tf), ty, 50 * DEG, r.kind === "kickoff" ? "kickoff" : "dropout");
    this.phase = "play";
    this.possession = other(team);
    this.teams[team].lineF = this.fx(other(team), kicker.pos.x);
    if (this.userTeam !== null) {
      this.controlled = this.nearestPlayer(this.userTeam, this.predictLanding()).id;
    }
  }

  private launchKickTo(kicker: PlayerState, tx: number, ty: number, elev: number, kind: KickKind): void {
    const dx = tx - kicker.pos.x;
    const dy = ty - kicker.pos.y;
    const d = Math.max(3, hyp(dx, dy));
    const angle = Math.atan2(dy, dx) + (this.rng() - 0.5) * 0.05;
    const v = Math.sqrt((d * G) / Math.sin(2 * elev));
    const b = this.ball;
    b.pos = { x: kicker.pos.x, y: kicker.pos.y, z: 0.5 };
    b.vel = { x: v * Math.cos(elev) * Math.cos(angle), y: v * Math.cos(elev) * Math.sin(angle), z: v * Math.sin(elev) };
    b.carrier = null;
    b.flight = "kick";
    b.kickKind = kind;
    b.kickTeam = kicker.team;
    b.kickFromX = kicker.pos.x;
    b.kickFrom22 = this.fx(kicker.team, kicker.pos.x) < 32;
    b.bounced = false;
    b.goalChecked = false;
    b.noCatchUntil = this.time + 0.35;
    b.lastTeam = kicker.team;
    b.lastPlayer = kicker.id;
    b.passer = null;
    b.receiver = null;
    b.target = this.predictLanding();
    kicker.busy = 0.35;
    kicker.anim = "kick";
    kicker.animUntil = this.time + 0.5;
  }

  // ---------- open play ----------
  private updatePlay(dt: number, input: InputFrame, remoteInput: InputFrame | null): void {
    this.tickClock(dt);
    if (this.ball.carrier !== null) {
      this.carryTime += dt;
      if (this.carryTime > 2.5) this.passChain = 0;
    }
    this.updateControl(input, remoteInput);
    if (this.userTeam !== null && this.controlled >= 0) {
      this.handleUserActions(input, dt, this.controlled);
      if (this.phase !== "play") return;
    }
    if (this.remoteTeam !== null && remoteInput && this.remoteControlled >= 0) {
      this.handleUserActions(remoteInput, dt, this.remoteControlled);
      if (this.phase !== "play") return;
    }
    this.moveAll(dt, input, remoteInput);
    this.recordOpenPlayStats(dt);
    this.separate();
    this.updateBall(dt);
    if (this.phase !== "play") return;
    this.checkTry(dt);
    if (this.phase !== "play") return;
    this.checkCatches();
    if (this.phase !== "play") return;
    this.checkTackles();
    if (this.phase !== "play") return;
    this.checkBoundaries(dt);
  }

  private recordOpenPlayStats(dt: number): void {
    const carrier = this.carrier();
    if (!carrier || !carrier.isOnField) return;
    const team = carrier.team;
    const teamStats = this.teamStats[team];
    teamStats.possessionSeconds += dt;
    if (this.fx(team, carrier.pos.x) > 60) teamStats.territorySeconds += dt;
    const metres = hyp(carrier.vel.x, carrier.vel.y) * dt;
    teamStats.metresMade += metres;
    this.playerStat(carrier.id).metresMade += metres;

    // A carrier is credited with one line break after penetrating two metres beyond the defence line.
    const defenceLine = this.teams[other(team)].lineF;
    if (this.fx(team, carrier.pos.x) > defenceLine + 2 && !this.lineBreakPlayers.has(carrier.id)) {
      this.lineBreakPlayers.add(carrier.id);
      teamStats.lineBreaks++;
      this.playerStat(carrier.id).lineBreaks++;
    }
  }

  private updateControl(input: InputFrame, remoteInput: InputFrame | null): void {
    if (this.userTeam !== null) this.updateControlForTeam(this.userTeam, input, false);
    if (this.remoteTeam !== null && remoteInput) this.updateControlForTeam(this.remoteTeam, remoteInput, true);
  }

  private updateControlForTeam(team: TeamIndex, input: InputFrame, remote: boolean): void {
    // Player career locks only the local user's team to their created player.
    if (!remote && this.playerLockPosition !== null && this.userTeam === team) {
      const lockedPlayer = this.pl(team, this.playerLockPosition);
      if (lockedPlayer?.isOnField) {
        this.controlled = lockedPlayer.id;
        return;
      }
    }
    const b = this.ball;
    const current = remote ? this.remoteControlled : this.controlled;
    const set = (id: number) => { if (remote) this.remoteControlled = id; else this.controlled = id; };
    if (b.carrier !== null && this.players[b.carrier]?.team === team) {
      set(b.carrier);
      return;
    }
    const focus = b.flight !== "none" && b.target && b.pos.z > 0 ? b.target : { x: b.pos.x, y: b.pos.y };
    const cur = current >= 0 ? this.players[current] : null;
    if (input.switchPlayer) {
      set(this.nearestPlayer(team, focus, current).id);
      return;
    }
    if (!cur || cur.team !== team || !cur.isOnField || cur.down > 0 || cur.busy > 0 || dist(cur.pos, focus) > 28) {
      set(this.nearestPlayer(team, focus).id);
    }
  }

  private handleUserActions(input: InputFrame, dt: number, playerId: number): void {
    const p = this.players[playerId];
    if (p.down > 0 || p.busy > 0) {
      this.charging = false;
      return;
    }
    const isCarrier = this.ball.carrier === p.id;
    if (isCarrier) {
      if (input.passUp || input.passDown) {
        this.charging = false;
        this.kickCharge = 0;
        this.pass(p, input.passUp ? -1 : 1);
        return;
      }
      if (input.dropGoal) {
        this.charging = false;
        this.kickCharge = 0;
        this.dropGoal(p);
        return;
      }
      if (input.kickHeld) {
        this.charging = true;
        this.kickCharge = Math.min(1, this.kickCharge + dt / 1.1);
      } else if (this.charging || input.kickRelease) {
        const power = this.kickCharge;
        this.charging = false;
        this.kickCharge = 0;
        this.punt(p, power);
        return;
      }
      if (input.action && this.fx(p.team, p.pos.x) >= 109.6) {
        this.scoreTry(p);
      }
    } else {
      this.charging = false;
      this.kickCharge = 0;
      const c = this.carrier();
      if (input.action && c && c.team !== p.team && p.tackleCooldown <= 0) {
        if (dist(p.pos, c.pos) < 2.3) {
          this.attemptTackle(p, c, 0.12);
        } else {
          p.tackleCooldown = 0.35;
        }
      }
    }
  }

  private buildContext(): FrameContext {
    const carrier = this.carrier();
    const b = this.ball;
    let focus: Vec2;
    if (carrier) focus = carrier.pos;
    else if (b.flight !== "none" && b.target && b.pos.z > 0) focus = b.target;
    else focus = { x: b.pos.x, y: b.pos.y };
    const att = this.possession;
    const def = other(att);
    const chasers: [Set<number>, Set<number>] = [new Set(), new Set()];
    for (const t of [0, 1] as TeamIndex[]) {
      if (this.phase === "ruck") continue;
      if (carrier && carrier.team === t) continue;
      const sorted = this.players
        .filter((p) => p.isOnField && p.team === t && p.down <= 0 && p.busy <= 0 && p.id !== this.controlled && p.id !== this.remoteControlled)
        .sort((a, c) => dist(a.pos, focus) - dist(c.pos, focus));
      for (let i = 0; i < Math.min(2, sorted.length); i++) chasers[t].add(sorted[i].id);
    }
    // defensive line management
    const fF = this.fx(att, focus.x);
    const dteam = this.teams[def];
    if (this.phase === "ruck" && this.ruck) {
      dteam.lineF = this.fx(att, this.ruck.x) + 2;
    } else {
      const lineSpeed = 2.2;
      dteam.lineF = Math.max(fF + 2.5, dteam.lineF - lineSpeed * this.dt);
    }
    dteam.lineF = clamp(dteam.lineF, 2, 111);
    // slots
    const slots: [Map<number, number>, Map<number, number>] = [new Map(), new Map()];
    const liners = this.players
      .filter((p) => p.isOnField && p.team === def && p.number !== 15 && !chasers[def].has(p.id) && p.down <= 0)
      .sort((a, c) => a.pos.y - c.pos.y);
    const n = liners.length;
    if (n > 0) {
      const spacing = n > 1 ? Math.min(6.2, 64 / (n - 1)) : 0;
      const half = ((n - 1) / 2) * spacing;
      const center = clamp(focus.y, 2 + half, W - 2 - half);
      liners.forEach((p, i) => slots[def].set(p.id, center - half + i * spacing));
    }
    return { carrier, focus, att, chasers, slots };
  }

  private moveAll(dt: number, input: InputFrame, remoteInput: InputFrame | null): void {
    const ctx = this.buildContext();
    for (const p of this.players) {
      if (!p.isOnField) {
        p.vel.x = 0;
        p.vel.y = 0;
        continue;
      }
      if (p.down > 0 || p.busy > 0) {
        p.vel.x *= 0.5;
        p.vel.y *= 0.5;
        continue;
      }
      let d: Decision;
      if (p.id === this.controlled) {
        const l = hyp(input.moveX, input.moveY);
        d = { dir: l > 0 ? { x: input.moveX / l, y: input.moveY / l } : { x: 0, y: 0 }, sprint: input.sprint };
      } else if (remoteInput && p.id === this.remoteControlled) {
        const l = hyp(remoteInput.moveX, remoteInput.moveY);
        d = { dir: l > 0 ? { x: remoteInput.moveX / l, y: remoteInput.moveY / l } : { x: 0, y: 0 }, sprint: remoteInput.sprint };
      } else {
        d = this.aiDecide(p, ctx);
        if (this.phase !== "play") return;
      }
      this.movePlayer(p, d.dir, d.sprint, dt);
    }
  }

  private movePlayer(p: PlayerState, desired: Vec2, sprint: boolean, dt: number): void {
    let maxSpeed = p.attrs.speed;
    if (sprint && p.stamina > 5) maxSpeed *= 1.25;
    if (this.ball.carrier === p.id) {
      maxSpeed *= 0.96;
      if (this.charging && p.id === this.controlled) maxSpeed *= 0.5;
    }
    if (p.id !== this.controlled && p.id !== this.remoteControlled && p.team !== this.userTeam && p.team !== this.remoteTeam) maxSpeed *= this.aiSpeedMult;
    maxSpeed *= 0.8 + 0.2 * (p.stamina / 100);
    const tx = desired.x * maxSpeed;
    const ty = desired.y * maxSpeed;
    const a = 14 * dt;
    p.vel.x += clamp(tx - p.vel.x, -a, a);
    p.vel.y += clamp(ty - p.vel.y, -a, a);
    p.pos.x = clamp(p.pos.x + p.vel.x * dt, -4, L + 4);
    p.pos.y = clamp(p.pos.y + p.vel.y * dt, -4, W + 4);
    if (hyp(desired.x, desired.y) > 0.1) p.facing = Math.atan2(desired.y, desired.x);
    const moving = hyp(p.vel.x, p.vel.y) > 0.5;
    if (sprint && moving) {
      p.stamina = Math.max(0, p.stamina - 9 * dt);
      p.fatigue = Math.min(40, p.fatigue + 0.3 * dt);
    } else {
      p.stamina = Math.min(100 - p.fatigue, p.stamina + 6 * dt);
    }
  }

  private moveTo(p: PlayerState, target: Vec2, sprint: boolean): Decision {
    const dx = target.x - p.pos.x;
    const dy = target.y - p.pos.y;
    const d = hyp(dx, dy);
    if (d < 0.35) return { dir: { x: 0, y: 0 }, sprint: false };
    return { dir: { x: dx / d, y: dy / d }, sprint: sprint && d > 3 };
  }

  private separate(): void {
    const n = this.players.length;
    for (let i = 0; i < n; i++) {
      const a = this.players[i];
      if (!a.isOnField) continue;
      if (a.down > 0 || a.busy > 0) continue;
      for (let j = i + 1; j < n; j++) {
        const b = this.players[j];
        if (!b.isOnField) continue;
        if (b.down > 0 || b.busy > 0) continue;
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const d = hyp(dx, dy);
        if (d < 1.0 && d > 0.0001) {
          const push = (1.0 - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          a.pos.x -= ux * push;
          a.pos.y -= uy * push;
          b.pos.x += ux * push;
          b.pos.y += uy * push;
        }
      }
    }
  }

  // ---------- AI ----------
  private aiTick(p: PlayerState, interval: number): boolean {
    if (p.aiTimer > 0) {
      p.aiTimer -= this.dt;
      return false;
    }
    p.aiTimer = interval;
    return true;
  }

  private aiDecide(p: PlayerState, ctx: FrameContext): Decision {
    if (ctx.carrier && ctx.carrier.id === p.id) return this.aiCarrier(p);
    if (!ctx.carrier && this.ball.receiver === p.id && this.ball.flight === "pass") {
      return this.moveTo(p, ctx.focus, true);
    }
    if (ctx.carrier) {
      return ctx.carrier.team === p.team ? this.aiSupport(p, ctx.focus) : this.aiDefend(p, ctx);
    }
    // loose ball / in flight
    if (ctx.chasers[p.team].has(p.id)) return this.moveTo(p, ctx.focus, true);
    return p.team === ctx.att ? this.aiSupport(p, ctx.focus) : this.aiDefend(p, ctx);
  }

  private aiCarrier(p: PlayerState): Decision {
    const t = p.team;
    const dir = this.teams[t].dir;
    const f = this.fx(t, p.pos.x);
    let nearest = 99;
    const threats: { o: PlayerState; d: number }[] = [];
    for (const o of this.players) {
      if (o.team === t || o.down > 0) continue;
      const d = dist(o.pos, p.pos);
      if (d < nearest) nearest = d;
      if (d < 7 && this.fx(t, o.pos.x) > f - 1.5) threats.push({ o, d });
    }
    if (this.aiTick(p, 0.12)) {
      const kickerish = [9, 10, 15].includes(p.number);
      if (kickerish && f < 25 && ((nearest < 4 && this.rng() < 0.35) || (f < 18 && this.rng() < 0.15))) {
        const toTouch = f < 24;
        this.punt(p, toTouch ? 0.45 + this.rng() * 0.2 : 0.7 + this.rng() * 0.3, toTouch ? "touch" : "long");
        return { dir: { x: 0, y: 0 }, sprint: false };
      }
      if (
        f > 80 && Math.abs(p.pos.y - 35) < 14 && [10, 15, 12].includes(p.number) &&
        nearest > 4.5 && this.rng() < 0.018 && (this.timeUp || this.rng() < 0.6)
      ) {
        this.dropGoal(p);
        return { dir: { x: 0, y: 0 }, sprint: false };
      }
      const committed = nearest < 1.7 || this.carryTime < 0.35;
      const passWindow = p.isForward ? nearest < 2.4 && this.rng() < 0.25 : nearest < 3.2 || (threats.length >= 2 && nearest < 4.5 && this.rng() < 0.2);
      if (!committed && passWindow && this.passChain < 3) {
        const mySpace = this.spaceAt(p.pos, t);
        let best: { side: 1 | -1; q: PlayerState; space: number } | null = null;
        for (const side of [-1, 1] as const) {
          const q = this.pickReceiver(p, side);
          if (!q) continue;
          const space = this.spaceAt(q.pos, t);
          if (!best || space > best.space) best = { side, q, space };
        }
        const margin = p.isForward ? 4 : 2;
        if (best && best.space > mySpace + margin) {
          this.pass(p, best.side);
          return { dir: { x: 0, y: 0 }, sprint: false };
        }
      }
    }
    let dy = 0;
    for (const { o, d } of threats) {
      const s = Math.sign(p.pos.y - o.pos.y) || (p.pos.y < 35 ? 1 : -1);
      dy += s * ((7 - d) / 7) * 1.0;
    }
    dy = clamp(dy, -1, 1);
    if (p.pos.y < 12) dy += ((12 - p.pos.y) / 12) * 2;
    if (p.pos.y > W - 12) dy -= ((p.pos.y - (W - 12)) / 12) * 2;
    if (f > 104) dy *= 0.3;
    const len = hyp(1, dy);
    return { dir: { x: dir / len, y: dy / len }, sprint: nearest > 1.0 };
  }

  private supportOffset(number: number, open: 1 | -1): { dx: number; dy: number } {
    switch (number) {
      case 9: return { dx: -3, dy: -open * 2.5 };
      case 10: return { dx: -7, dy: open * 9 };
      case 12: return { dx: -9, dy: open * 17 };
      case 13: return { dx: -11, dy: open * 25 };
      case 14: return open === 1 ? { dx: -12, dy: 33 } : { dx: -7, dy: 12 };
      case 11: return open === -1 ? { dx: -12, dy: -33 } : { dx: -7, dy: -12 };
      case 15: return { dx: -16, dy: open * 6 };
      case 1: return { dx: -4, dy: 3.5 };
      case 2: return { dx: -2.5, dy: -3 };
      case 3: return { dx: -4, dy: -6.5 };
      case 4: return { dx: -6, dy: 5 };
      case 5: return { dx: -6, dy: -5 };
      case 6: return { dx: -3, dy: 7 };
      case 7: return { dx: -2, dy: 1 };
      default: return { dx: -3.5, dy: -1.5 };
    }
  }

  private aiSupport(p: PlayerState, focus: Vec2): Decision {
    const t = p.team;
    const fF = this.fx(t, focus.x);
    const open: 1 | -1 = focus.y < 35 ? 1 : -1;
    const off = this.supportOffset(p.number, open);
    let tf = fF + off.dx;
    tf = Math.min(tf, fF - 1);
    tf = clamp(tf, 2, 118);
    const target = { x: this.wx(t, tf), y: clamp(focus.y + off.dy, 2, W - 2) };
    return this.moveTo(p, target, dist(p.pos, target) > 6);
  }

  private aiDefend(p: PlayerState, ctx: FrameContext): Decision {
    const t = p.team;
    const att = other(t);
    const fF = this.fx(att, ctx.focus.x);
    if (ctx.chasers[t].has(p.id)) {
      if (ctx.carrier) {
        const c = ctx.carrier;
        const d = dist(p.pos, c.pos);
        const lead = clamp(d / Math.max(1, p.attrs.speed * 1.2), 0, 1);
        return this.moveTo(p, { x: c.pos.x + c.vel.x * lead, y: c.pos.y + c.vel.y * lead }, true);
      }
      return this.moveTo(p, ctx.focus, true);
    }
    if (p.number === 15) {
      const target = { x: this.wx(att, Math.min(fF + 24, 112)), y: 35 + (ctx.focus.y - 35) * 0.5 };
      return this.moveTo(p, target, dist(p.pos, target) > 10);
    }
    const slot = ctx.slots[t].get(p.id);
    const target = { x: this.wx(att, this.teams[t].lineF), y: slot ?? p.pos.y };
    return this.moveTo(p, target, dist(p.pos, target) > 5);
  }

  // ---------- passing & kicking ----------
  pickReceiver(p: PlayerState, side: 1 | -1): PlayerState | null {
    const t = p.team;
    const f = this.fx(t, p.pos.x);
    let best: PlayerState | null = null;
    let bestScore = -Infinity;
    for (const q of this.players) {
      if (!q.isOnField) continue;
      if (q.team !== t || q.id === p.id || q.down > 0 || q.busy > 0) continue;
      const dy = (q.pos.y - p.pos.y) * side;
      if (dy < 1.0) continue;
      const d = dist(q.pos, p.pos);
      if (d > 22) continue;
      const qf = this.fx(t, q.pos.x);
      if (qf > f + 2.5) continue;
      const behind = f - qf;
      const projY = q.pos.y + q.vel.y * (d / 14);
      if (projY < 1.5 || projY > W - 1.5) continue;
      const touchPenalty = q.pos.y < 6 || q.pos.y > W - 6 ? 4 : 0;
      const score =
        this.spaceAt(q.pos, t) - Math.abs(d - 8) * 0.25 - Math.max(0, behind - 6) * 0.3 + (qf > f - 1 ? -0.6 : 0) - touchPenalty;
      if (score > bestScore) {
        bestScore = score;
        best = q;
      }
    }
    return best;
  }

  pass(p: PlayerState, side: 1 | -1): void {
    const q = this.pickReceiver(p, side);
    if (!q) {
      if (p.id === this.controlled) this.say("No support there!", "", "#fbbf24", 1);
      return;
    }

    // Track player career and match-report passes
    if (this.playerLockPosition !== null && this.userTeam === p.team && p.number === this.playerLockPosition) {
      this.userPasses++;
    }
    this.teamStats[p.team].passes++;
    this.playerStat(p.id).passes++;

    p.anim = "pass";
    p.animUntil = this.time + 0.35;
    const t = p.team;
    const f = this.fx(t, p.pos.x);
    const d0 = dist(p.pos, q.pos);
    const speed = clamp(9 + d0 * 0.55, 10, 19);
    let tf = d0 / speed;
    const target = { x: q.pos.x + q.vel.x * tf, y: clamp(q.pos.y + q.vel.y * tf, 1.5, W - 1.5) };
    if (this.fx(t, target.x) > f - 0.4) target.x = this.wx(t, f - 0.4);
    const pressure = this.nearestOpponentDist(p) < 2.0;
    const noise = pressure ? (this.rng() - 0.5) * (0.3 - p.attrs.handling * 0.0016) : (this.rng() - 0.5) * 0.04;
    const d = Math.max(1, dist(p.pos, target));
    tf = d / speed;
    const ang = Math.atan2(target.y - p.pos.y, target.x - p.pos.x) + noise;
    const b = this.ball;
    b.pos = { x: p.pos.x, y: p.pos.y, z: 1.2 };
    b.vel = { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed, z: (G * tf) / 2 };
    b.carrier = null;
    b.flight = "pass";
    b.kickKind = null;
    b.lastTeam = t;
    b.lastPlayer = p.id;
    b.passer = p.id;
    b.passerUntil = this.time + 0.5;
    b.noCatchUntil = this.time + 0.08;
    b.bounced = false;
    b.target = target;
    b.receiver = q.id;
    this.passChain++;
    this.charging = false;
    this.kickCharge = 0;
    const dir = this.teams[t].dir;
    if (b.vel.x * dir > 0.8) {
      this.say("FORWARD PASS!", `Scrum to ${this.teamName(other(t))}`, "#f87171");
      this.scheduleRestart("scrum", other(t), p.pos.x, p.pos.y);
      return;
    }
    if (t === this.userTeam) this.controlled = q.id;
  }

  punt(p: PlayerState, power: number, mode?: "touch" | "long"): void {
    const t = p.team;
    const dir = this.teams[t].dir;
    const attackAngle = dir === 1 ? 0 : Math.PI;
    let angle: number;
    if (mode === "touch") {
      const rel = (p.pos.y < 35 ? -1 : 1) * 42 * DEG;
      angle = dir === 1 ? rel : Math.PI - rel;
    } else if (mode === "long") {
      angle = attackAngle + (this.rng() - 0.5) * 0.35;
    } else {
      let rel = Math.atan2(Math.sin(p.facing - attackAngle), Math.cos(p.facing - attackAngle));
      rel = clamp(rel, -80 * DEG, 80 * DEG);
      angle = attackAngle + rel;
    }
    angle += (this.rng() - 0.5) * (0.06 + (100 - p.attrs.kicking) * 0.002);
    let v: number;
    let elev: number;
    let kind: KickKind;
    if (power < 0.22 && !mode) {
      v = 9 + power * 20;
      elev = 12 * DEG;
      kind = "grubber";
    } else {
      const range = (16 + 44 * power) * (0.8 + p.attrs.kicking / 500);
      elev = 40 * DEG;
      v = Math.sqrt((range * G) / Math.sin(2 * elev));
      kind = "punt";
    }
    const b = this.ball;
    b.pos = { x: p.pos.x, y: p.pos.y, z: 0.6 };
    b.vel = { x: v * Math.cos(elev) * Math.cos(angle), y: v * Math.cos(elev) * Math.sin(angle), z: v * Math.sin(elev) };
    b.carrier = null;
    b.flight = "kick";
    b.kickKind = kind;
    b.kickTeam = t;
    b.kickFromX = p.pos.x;
    b.kickFrom22 = this.fx(t, p.pos.x) < 32;
    b.bounced = false;
    b.goalChecked = false;
    b.noCatchUntil = this.time + 0.3;
    b.lastTeam = t;
    b.lastPlayer = p.id;
    b.passer = null;
    b.receiver = null;
    b.target = this.predictLanding();
    p.busy = 0.3;
    p.anim = "kick";
    p.animUntil = this.time + 0.45;
    this.possession = other(t);
    this.teams[t].lineF = this.fx(other(t), p.pos.x);
    this.passChain = 0;
    this.charging = false;
    this.kickCharge = 0;
  }

  dropGoal(p: PlayerState): void {
    const t = p.team;
    const gx = this.teams[t].dir === 1 ? 110 : 10;
    const dx = gx - p.pos.x;
    const dy = 35 - p.pos.y;
    const d = hyp(dx, dy);
    if (d > 55 || dx * this.teams[t].dir < 0) {
      if (p.id === this.controlled) this.say("Too far out!", "", "#fbbf24", 1);
      return;
    }
    const pressure = this.nearestOpponentDist(p) < 3;
    const sigma = (0.03 + d * 0.0012) * (1.4 - p.attrs.kicking / 100) * (pressure ? 1.8 : 1);
    const angle = Math.atan2(dy, dx) + this.gauss() * sigma;
    const power = clamp(this.requiredPower(d) + 0.15 + (this.rng() - 0.5) * 0.15, 0.2, 1);
    const v = 13 + 17 * power;
    const b = this.ball;
    b.pos = { x: p.pos.x, y: p.pos.y, z: 0.4 };
    b.vel = {
      x: v * Math.cos(GOAL_ELEV) * Math.cos(angle),
      y: v * Math.cos(GOAL_ELEV) * Math.sin(angle),
      z: v * Math.sin(GOAL_ELEV),
    };
    b.carrier = null;
    b.flight = "kick";
    b.kickKind = "dropgoal";
    b.kickTeam = t;
    b.kickFromX = p.pos.x;
    b.kickFrom22 = false;
    b.bounced = false;
    b.goalChecked = false;
    b.noCatchUntil = this.time + 0.4;
    b.lastTeam = t;
    b.lastPlayer = p.id;
    b.passer = null;
    b.receiver = null;
    b.target = this.predictLanding();
    p.busy = 0.45;
    p.anim = "kick";
    p.animUntil = this.time + 0.5;
    this.possession = other(t);
    this.teams[t].lineF = this.fx(other(t), p.pos.x);
    this.say("Drop goal attempt!", p.name, "#ffffff", 1.5);
  }

  // ---------- ball physics ----------
  private updateBall(dt: number): void {
    const b = this.ball;
    const c = this.carrier();
    if (c) {
      b.pos.x = c.pos.x + Math.cos(c.facing) * 0.35;
      b.pos.y = c.pos.y + Math.sin(c.facing) * 0.35;
      b.pos.z = 1;
      b.vel.x = c.vel.x;
      b.vel.y = c.vel.y;
      b.vel.z = 0;
      return;
    }
    const px = b.pos.x;
    const py = b.pos.y;
    const pz = b.pos.z;
    if (pz > 0 || b.vel.z > 0) {
      b.vel.z -= G * dt;
      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;
      b.pos.z += b.vel.z * dt;
      if (
        b.flight === "kick" && !b.goalChecked && b.kickTeam !== null &&
        (b.kickKind === "conversion" || b.kickKind === "penalty" || b.kickKind === "dropgoal")
      ) {
        const gx = this.teams[b.kickTeam].dir === 1 ? 110 : 10;
        if ((px - gx) * (b.pos.x - gx) <= 0 && px !== b.pos.x) {
          const tt = (gx - px) / (b.pos.x - px);
          const yAt = py + (b.pos.y - py) * tt;
          const zAt = pz + (b.pos.z - pz) * tt;
          b.goalChecked = true;
          if (Math.abs(yAt - 35) <= 2.8 && zAt >= 3) {
            this.registerGoal(b.kickTeam, b.kickKind);
          } else if (b.kickKind === "dropgoal") {
            this.say("Drop goal misses", "Goal-line drop-out", "#f87171");
            this.scheduleRestart("dropout", other(b.kickTeam));
            return;
          }
        }
      }
      if (b.pos.z <= 0) {
        b.pos.z = 0;
        const firstKickoffBounce = b.kickKind === "kickoff" && !b.bounced;
        b.bounced = true;
        if (b.flight === "pass") {
          b.flight = "none";
          b.receiver = null;
          b.target = null;
        }
        if (b.vel.z < -2) {
          b.vel.z = -b.vel.z * 0.45;
          b.vel.x = b.vel.x * 0.65 + (this.rng() - 0.5) * 2.5;
          b.vel.y = b.vel.y * 0.65 + (this.rng() - 0.5) * 2.5;
        } else {
          b.vel.z = 0;
          b.vel.x *= 0.6;
          b.vel.y *= 0.6;
        }
        if (firstKickoffBounce && this.phase === "play" && b.kickTeam !== null) {
          if (this.fx(b.kickTeam, b.pos.x) < 70) {
            this.say("Kick-off did not go 10m", "Scrum at halfway", "#f87171");
            this.scheduleRestart("scrum", other(b.kickTeam), 60, 35);
          }
        }
      }
    } else {
      const sp = hyp(b.vel.x, b.vel.y);
      if (sp > 0) {
        const ns = Math.max(0, sp - 4 * dt);
        b.vel.x *= ns / sp;
        b.vel.y *= ns / sp;
        b.pos.x += b.vel.x * dt;
        b.pos.y += b.vel.y * dt;
      }
    }
  }

  private registerGoal(team: TeamIndex, kind: KickKind): void {
    const points = kind === "conversion" ? 2 : 3;
    this.score[team] += points;
    if (kind === "conversion") this.teamStats[team].conversions++;
    else if (kind === "penalty") this.teamStats[team].penalties++;
    else if (kind === "dropgoal") this.teamStats[team].dropGoals++;
    const kicker = this.ball.lastPlayer !== null ? this.players[this.ball.lastPlayer].name : "";
    const type = kind === "conversion" ? "conversion" : kind === "penalty" ? "penalty" : "dropgoal";
    this.events.push({ minute: this.gameMinute(), team, type, player: kicker, points });
    const label = kind === "conversion" ? "CONVERSION GOOD!" : kind === "penalty" ? "PENALTY GOAL!" : "DROP GOAL!";
    this.say(label, `${kicker} – ${this.teamName(team)} +${points}`, this.teams[team].color);
    if (kind === "dropgoal") {
      this.scheduleRestart("kickoff", other(team));
    } else if (this.goalKick) {
      this.goalKick.scored = true;
      this.goalKick.scoredAt = this.goalKick.timer;
    }
  }

  // ---------- catching, tackling, scoring ----------
  private checkCatches(): void {
    const b = this.ball;
    if (b.carrier !== null || b.pos.z > 2.4 || this.time < b.noCatchUntil) return;
    let best: PlayerState | null = null;
    let bd = CATCH_R;
    for (const p of this.players) {
      if (p.down > 0 || p.busy > 0) continue;
      if (p.id === b.passer && this.time < b.passerUntil) continue;
      const d = dist(p.pos, b.pos);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (best) this.receive(best);
  }

  private receive(p: PlayerState): void {
    const b = this.ball;
    const inAir = b.pos.z > 0.25;
    const pressure = this.nearestOpponentDist(p) < 2.0;
    let knock = 0.01 + (pressure ? 0.04 : 0) + Math.max(0, 85 - p.attrs.handling) / 600;
    knock += (1 - p.stamina / 100) * 0.03;
    if (b.flight === "kick" && inAir) knock += 0.04;
    if (b.flight === "pass" && b.lastTeam !== null && b.lastTeam !== p.team) {
      knock = this.rng() < 0.5 ? 1 : 0.05;
    }
    if (this.userTeam === p.team && this.difficulty === "easy") knock *= 0.5;
    if (this.rng() < knock) {
      this.knockOn(p);
      return;
    }
    const f = this.fx(p.team, b.pos.x);
    if (f >= 110) {
      this.giveBallTo(p);
      this.scoreTry(p);
      return;
    }
    if (f <= 10 && b.flight === "kick") {
      this.say("Touched down in-goal", "Goal-line drop-out");
      this.scheduleRestart("dropout", p.team);
      return;
    }
    if (b.flight === "pass" && b.lastTeam !== p.team) this.say("INTERCEPTED!", p.name, "#fbbf24");
    this.pushComment(`Intercepted by ${p.name}!`, p.team);
    this.giveBallTo(p);
  }

  private knockOn(p: PlayerState): void {
    const b = this.ball;
    const dir = this.teams[p.team].dir;
    b.carrier = null;
    b.flight = "none";
    b.vel = { x: dir * 2.5 + (this.rng() - 0.5) * 2, y: (this.rng() - 0.5) * 2, z: 1 };
    b.pos.z = 1;
    this.say("KNOCK ON!", `${p.name} – scrum to ${this.teamName(other(p.team))}`, "#f87171");
    this.scheduleRestart("scrum", other(p.team), p.pos.x, p.pos.y);
  }

  giveBallTo(p: PlayerState): void {
    const b = this.ball;
    b.carrier = p.id;
    b.flight = "none";
    b.kickKind = null;
    b.kickTeam = null;
    b.bounced = false;
    b.passer = null;
    b.target = null;
    b.receiver = null;
    b.vel = { x: 0, y: 0, z: 0 };
    b.lastTeam = p.team;
    b.lastPlayer = p.id;
    if (p.anim !== "celebrate") p.anim = "none";
    if (this.possession !== p.team) this.passChain = 0;
    this.possession = p.team;
    this.carryTime = 0;
    this.inGoalTimer = 0;
    this.deadTimer = 0;
    if (this.userTeam !== null) {
      if (p.team === this.userTeam) this.controlled = p.id;
      else this.controlled = this.nearestPlayer(this.userTeam, p.pos).id;
    }
  }

  private checkTry(dt: number): void {
    const c = this.carrier();
    if (!c) return;
    const f = this.fx(c.team, c.pos.x);
    if (f > 120 || (f >= 110 && (c.pos.y < 0.5 || c.pos.y > W - 0.5))) {
      this.say("Ball dead", "Goal-line drop-out");
      this.scheduleRestart("dropout", other(c.team));
      return;
    }
    if (f >= 109.6) {
      this.inGoalTimer += dt;
      if (c.id !== this.controlled || this.inGoalTimer > 0.45) this.scoreTry(c);
    } else {
      this.inGoalTimer = 0;
    }
  }

  private scoreTry(p: PlayerState): void {
    const t = p.team;
    if (this.playerLockPosition !== null && this.userTeam === t && p.number === this.playerLockPosition) {
      this.userTries++;
    }
    this.score[t] += 5;
    this.tries[t]++;
    this.teamStats[t].tries++;
    this.playerStat(p.id).tries++;
    this.events.push({ minute: this.gameMinute(), team: t, type: "try", player: p.name, points: 5 });
    this.say("TRY!", `${p.name} – ${this.teamName(t)}`, this.teams[t].color, 2.6);
    this.pushComment(`TRY! Brilliant finish from ${p.name}!`, t);
    this.phase = "try";
    this.phaseTimer = 2.4;
    this.tryInfo = { team: t, y: clamp(p.pos.y, 3, W - 3) };
    this.tryScorer = p.id;
    p.anim = "celebrate";
    p.animUntil = this.time + 8;
    this.ball.carrier = p.id;
    this.charging = false;
    this.kickCharge = 0;
    this.ruck = null;
  }

  private checkTackles(): void {
    const c = this.carrier();
    if (!c) return;
    for (const p of this.players) {
      if (!p.isOnField) continue;
      if (p.team === c.team || p.down > 0 || p.busy > 0 || p.tackleCooldown > 0) continue;
      if (dist(p.pos, c.pos) < TACKLE_R) {
        this.attemptTackle(p, c, p.id === this.controlled ? -0.15 : 0);
        if (this.phase !== "play") return;
      }
    }
  }

  private attemptTackle(t: PlayerState, c: PlayerState, bonus: number): void {
    // --- New features: Bounce-offs and Side-steps ---
    const carrierIsForward = c.number <= 8;
    const carrierIsBack = c.number > 8;

    // 1. Backs Side-step Chance (Agility / Evasion)
    if (carrierIsBack && this.rng() < 0.18) {
      c.anim = "sidestep";
      c.animUntil = this.time + 0.55;
      t.down = 1.2; // Freeze/stun defender
      t.anim = "dive";
      t.tackleCooldown = 1.5;
      this.say("SIDE-STEP!", `${c.name} evades the tackle!`, this.teams[c.team].color, 1.5);
      this.pushComment(`Beautiful side-step from ${c.name} to bypass the defender!`, c.team);
      import("./audio").then((a) => a.playGoal()); // Play a nice success sound
      return;
    }

    // 2. Forwards Bounce-off Chance (Strength / Physicality)
    if (carrierIsForward && this.rng() < 0.18) {
      c.anim = "bounce";
      c.animUntil = this.time + 0.6;
      t.down = 1.6; // Knock tackler flat on their back
      t.anim = "lie";
      t.tackleCooldown = 2.0;
      this.say("BOUNCED!", `${c.name} runs over the defender!`, this.teams[c.team].color, 1.5);
      this.pushComment(`PHYSICALITY! ${c.name} bounces the tackler flat on the turf!`, c.team);
      import("./audio").then((a) => a.playTackle()); // Play impact thud
      return;
    }

    let p = 0.44 + (t.attrs.tackling - c.attrs.evasion) / 250 + (t.attrs.strength - c.attrs.strength) / 600 + bonus;
    if (c.team === this.userTeam) p += this.difficulty === "easy" ? -0.12 : this.difficulty === "hard" ? 0.06 : 0;
    else if (t.team === this.userTeam) p += this.difficulty === "easy" ? 0.08 : this.difficulty === "hard" ? -0.05 : 0;
    p -= (1 - t.stamina / 100) * 0.1;
    p += 0.05;
    p = clamp(p, 0.25, 0.95);
    t.tackleCooldown = 1.0;
    if (this.rng() < p) this.performTackle(t, c);
    else {
      t.down = 0.8;
      t.anim = "dive";
    }
  }

  private performTackle(t: PlayerState, c: PlayerState): void {
    c.vel = { x: 0, y: 0 };
    t.vel = { x: 0, y: 0 };
    this.charging = false;
    this.kickCharge = 0;
    if (this.rng() < 0.03) {
      c.down = 1.2;
      t.down = 1.2;
      this.say("HIGH TACKLE!", `Penalty to ${this.teamName(c.team)}`, "#f87171");
      this.pushComment(`High tackle! Penalty to ${this.teamName(c.team)}.`, c.team);
      this.scheduleRestart("penalty", c.team, c.pos.x, c.pos.y);
      return;
    }
    if (this.fx(c.team, c.pos.x) >= 109.6) {
      c.down = 1.5;
      t.down = 1.5;
      this.say("HELD UP!", "Goal-line drop-out");
      this.scheduleRestart("dropout", t.team);
      return;
    }

    // Track player career and match-report tackles.
    if (this.playerLockPosition !== null && this.userTeam === t.team && t.number === this.playerLockPosition) {
      this.userTackles++;
    }
    this.teamStats[t.team].tackles++;
    this.playerStat(t.id).tackles++;

    this.lastTackle = { tackler: t.id, carrier: c.id };
    c.down = 3;
    t.down = 2.8;
    t.anim = "tackle";
    c.anim = "none";
    this.phase = "tackle";
    this.phaseTimer = 0.45;
  }

  // ---------- rucks ----------
  private startRuck(): void {
    const lt = this.lastTackle;
    if (!lt) {
      this.phase = "play";
      return;
    }
    const c = this.players[lt.carrier];
    const t = this.players[lt.tackler];
    const att = c.team;
    const dir = this.teams[att].dir;
    const x = clamp(c.pos.x, 2, L - 2);
    const y = clamp(c.pos.y, 1, W - 1);
    const rp = { x, y };
    const joinedAtt = new Set<number>([c.id]);
    const joinedDef = new Set<number>([t.id]);
    const attJoiners = this.players
      .filter((p) => p.team === att && p.id !== c.id && p.down <= 0 && p.id !== this.controlled && p.id !== this.remoteControlled)
      .sort((a, b) => dist(a.pos, rp) - dist(b.pos, rp))
      .slice(0, 2)
      .filter((p) => dist(p.pos, rp) < 16)
      .map((p) => p.id);
    const defJoiners = this.players
      .filter((p) => p.team !== att && p.id !== t.id && p.down <= 0 && p.id !== this.controlled && p.id !== this.remoteControlled)
      .sort((a, b) => dist(a.pos, rp) - dist(b.pos, rp))
      .slice(0, 2)
      .filter((p, i) => dist(p.pos, rp) < (i === 0 ? 6 : 4))
      .map((p) => p.id);
    this.ruck = {
      x, y, team: att, timer: 2.2,
      joined: att === 0 ? [joinedAtt, joinedDef] : [joinedDef, joinedAtt],
      joiners: att === 0 ? [attJoiners, defJoiners] : [defJoiners, attJoiners],
      userGrace: 2.0,
    };
    const b = this.ball;
    b.carrier = null;
    b.flight = "none";
    b.pos = { x: x - dir * 0.6, y, z: 0 };
    b.vel = { x: 0, y: 0, z: 0 };
    c.down = 3.5;
    t.down = 3.3;
    this.phase = "ruck";
    this.teams[other(att)].lineF = this.fx(att, x) + 2;
    this.passChain = 0;
    if (this.userTeam !== null) {
      const cur = this.controlled >= 0 ? this.players[this.controlled] : null;
      if (!cur || cur.down > 0 || cur.id === c.id || cur.id === t.id) {
        this.controlled = this.nearestPlayer(this.userTeam, rp).id;
      }
    }
  }

  private updateRuck(dt: number, input: InputFrame, remoteInput: InputFrame | null): void {
    this.tickClock(dt);
    const r = this.ruck;
    if (!r) {
      this.phase = "play";
      return;
    }
    r.timer -= dt;
    if (r.userGrace > 0) r.userGrace -= dt;
    const att = r.team;
    const def = other(att);
    const rf = this.fx(att, r.x);
    const rp = { x: r.x, y: r.y };
    const ctx = this.buildContext();
    ctx.focus = rp;
    for (const p of this.players) {
      if (!p.isOnField) continue;
      if (p.down > 0 || p.busy > 0) continue;
      let d: Decision;
      if (p.id === this.controlled) {
        const l = hyp(input.moveX, input.moveY);
        d = { dir: l > 0 ? { x: input.moveX / l, y: input.moveY / l } : { x: 0, y: 0 }, sprint: input.sprint };
      } else if (remoteInput && p.id === this.remoteControlled) {
        const l = hyp(remoteInput.moveX, remoteInput.moveY);
        d = { dir: l > 0 ? { x: remoteInput.moveX / l, y: remoteInput.moveY / l } : { x: 0, y: 0 }, sprint: remoteInput.sprint };
      } else if (r.joined[p.team].has(p.id)) {
        d = { dir: { x: 0, y: 0 }, sprint: false };
      } else if (r.joiners[p.team].includes(p.id)) {
        d = this.moveTo(p, rp, true);
        if (dist(p.pos, rp) < 1.5) r.joined[p.team].add(p.id);
      } else if (p.team === att) {
        d = this.aiSupport(p, rp);
      } else {
        d = this.aiDefend(p, ctx);
      }
      this.movePlayer(p, d.dir, d.sprint, dt);
    }
    this.separate();
    if (this.userTeam !== null && this.controlled >= 0) {
      const u = this.players[this.controlled];
      if (dist(u.pos, rp) < 1.5) r.joined[this.userTeam].add(u.id);
      const uf = this.fx(att, u.pos.x);
      const joined = r.joined[this.userTeam].has(u.id);
      const near = dist(u.pos, rp) < 12;
      const offside = this.userTeam === def ? uf < rf + 0.8 : uf > rf + 1.0;
      this.userOffsideWarning = !joined && near && offside;
      if (this.userOffsideWarning && r.userGrace <= 0) {
        const benefits = this.userTeam === def ? att : def;
        this.say("OFFSIDE!", `Penalty to ${this.teamName(benefits)}`, "#f87171");
        this.scheduleRestart("penalty", benefits, r.x, r.y);
        return;
      }
    }
    if (r.timer <= 0) this.resolveRuck();
  }

  private resolveRuck(): void {
    const r = this.ruck;
    if (!r) return;
    const att = r.team;
    const def = other(att);
    const a = r.joined[att].size;
    const d = r.joined[def].size;
    const roll = this.rng();
    this.userOffsideWarning = false;
    if (roll < 0.05) {
      const reasons = ["Offside at the ruck", "Hands in the ruck", "Not rolling away"];
      this.say(reasons[Math.floor(this.rng() * reasons.length)], `Penalty to ${this.teamName(att)}`, "#fbbf24");
      this.scheduleRestart("penalty", att, r.x, r.y);
      return;
    }
    if (roll < 0.08) {
      const reasons = ["Holding on", "Sealing off"];
      this.say(reasons[Math.floor(this.rng() * reasons.length)], `Penalty to ${this.teamName(def)}`, "#fbbf24");
      this.scheduleRestart("penalty", def, r.x, r.y);
      return;
    }
    let pRetain = 0.85 + 0.08 * (a - d);
    if (a <= 1 && d >= 2) pRetain -= 0.30;
    if (this.userTeam === att && this.difficulty === "easy") pRetain += 0.08;
    if (this.userTeam === def && this.difficulty === "easy") pRetain -= 0.08;
    pRetain = clamp(pRetain, 0.2, 0.97);
    const winner: TeamIndex = this.rng() < pRetain ? att : def;
    for (const id of [...r.joined[0], ...r.joined[1]]) {
      const p = this.players[id];
      p.busy = 0.7;
      p.down = 0.3;
    }
    this.ruck = null;
    if (winner !== att) this.say("TURNOVER!", `${this.teamName(def)} steal the ball`, "#fbbf24");
    this.pushComment(`Turnover! ${this.teamName(def)} win the ball.`, def);
    const receiver = this.pickRuckReceiver(winner, r);
    const wdir = this.teams[winner].dir;
    receiver.pos = { x: clamp(r.x - wdir * 1.4, 1, L - 1), y: r.y };
    receiver.vel = { x: 0, y: 0 };
    receiver.down = 0;
    receiver.busy = 0;
    this.giveBallTo(receiver);
    this.phase = "play";
    this.teams[other(winner)].lineF = this.fx(winner, r.x) + 2;
    this.inGoalTimer = 0;
  }

  private pickRuckReceiver(team: TeamIndex, r: RuckState): PlayerState {
    const nine = this.pl(team, 9);
    const rp = { x: r.x, y: r.y };
    if (nine.down <= 0 && !r.joined[team].has(nine.id) && dist(nine.pos, rp) < 12) return nine;
    let best: PlayerState | null = null;
    let bd = Infinity;
    for (const p of this.players) {
      if (!p.isOnField) continue;
      if (p.team !== team || p.down > 0 || r.joined[team].has(p.id)) continue;
      const dd = dist(p.pos, rp);
      if (dd < bd) {
        bd = dd;
        best = p;
      }
    }
    return best ?? nine;
  }

  // ---------- set pieces ----------
  private setupScrum(team: TeamIndex, x: number, y: number): void {
    this.resetPlayers();
    const def = other(team);
    const fM = clamp(this.fx(team, x), 15, 105);
    const my = clamp(y, 6, W - 6);
    const open: 1 | -1 = my < 35 ? 1 : -1;
    this.restart = { kind: "scrum", team, x: this.wx(team, fM), y: my };
    const packAtt: [number, number, number][] = [
      [1, -0.9, -1.0], [2, -0.9, 0], [3, -0.9, 1.0], [4, -1.8, -0.5], [5, -1.8, 0.5],
      [6, -1.9, -1.5], [7, -1.9, 1.5], [8, -2.7, 0],
    ];
    for (const [n, df, dy] of packAtt) {
      this.place(this.pl(team, n), team, fM + df, my + dy);
      this.place(this.pl(def, n), team, fM - df, my + dy);
    }
    this.place(this.pl(team, 9), team, fM - 1.2, my + open * 2.2);
    this.place(this.pl(def, 9), team, fM + 3.2, my - open * 2.2);
    const backs: [number, number, number][] = [
      [10, -9, 7], [12, -11, 15], [13, -13, 23], [14, -14, 31], [11, -6, -9], [15, -20, 8],
    ];
    for (const [n, df, dy] of backs) {
      this.place(this.pl(team, n), team, fM + df, my + open * dy);
      this.place(this.pl(def, n), team, fM + 8.5 + (n === 15 ? 16 : 0), my + open * dy);
    }
    for (const p of this.players) { if (p.isOnField) p.busy = 9; }
    this.ball.carrier = null;
    this.ball.pos = { x: this.wx(team, fM), y: my, z: 0 };
    this.phase = "scrum";
    this.phaseTimer = 2.0;
    this.possession = team;
    this.say("SCRUM", `${this.teamName(team)} put-in`, "#ffffff", 2);
    if (this.userTeam !== null) this.controlled = this.pl(this.userTeam, 9).id;
  }

  private packStrength(team: TeamIndex): number {
    let s = 0;
    for (let n = 1; n <= 8; n++) s += this.pl(team, n).attrs.strength;
    return s / 8;
  }

  private resolveScrum(): void {
    const r = this.restart;
    if (!r) return;
    const att = r.team;
    const def = other(att);
    const diff = this.packStrength(att) - this.packStrength(def);
    for (const p of this.players) { if (p.isOnField) p.busy = p.isForward ? 1.2 : 0; }
    if (this.rng() < 0.06) {
      const pen: TeamIndex = this.rng() < 0.5 + diff * 0.01 ? att : def;
      this.say("SCRUM PENALTY", `Collapsed scrum – penalty to ${this.teamName(pen)}`, "#fbbf24");
      this.scheduleRestart("penalty", pen, r.x, r.y);
      return;
    }
    const pWin = clamp(0.86 + diff * 0.004, 0.6, 0.96);
    const winner: TeamIndex = this.rng() < pWin ? att : def;
    this.teamStats[winner].scrumsWon++;
    if (winner !== att) {
      this.say("SCRUM TURNOVER!", `${this.teamName(def)} win it against the head`, "#fbbf24");
      this.pushComment(`Scrum turnover! ${this.teamName(def)} against the head.`, def);
    } else this.say("Scrum won", `${this.teamName(att)} ball`, "#ffffff", 1.2);
    const nine = this.pl(winner, 9);
    nine.busy = 0;
    const wdir = this.teams[winner].dir;
    nine.pos = { x: clamp(r.x - wdir * 3.4, 1, L - 1), y: r.y + (r.y < 35 ? 2 : -2) };
    this.giveBallTo(nine);
    this.phase = "play";
    this.teams[other(winner)].lineF = this.fx(winner, r.x) + 6;
  }

  private setupLineout(team: TeamIndex, x: number, side: number): void {
    this.resetPlayers();
    const def = other(team);
    const fM = clamp(this.fx(team, x), 15, 105);
    const inward = side === 0 ? 1 : -1;
    const ly = (m: number) => side + inward * m;
    this.restart = { kind: "lineout", team, x: this.wx(team, fM), y: side };
    const jumpers = [1, 3, 4, 5, 6, 7, 8];
    jumpers.forEach((n, i) => {
      this.place(this.pl(team, n), team, fM - 0.7, ly(5.5 + i * 1.4));
      this.place(this.pl(def, n), team, fM + 0.7, ly(5.5 + i * 1.4));
    });
    this.place(this.pl(team, 2), team, fM, ly(0.6));
    this.place(this.pl(def, 2), team, fM + 1.5, ly(3));
    this.place(this.pl(team, 9), team, fM - 2.5, ly(13));
    this.place(this.pl(def, 9), team, fM + 2.5, ly(15));
    const backs: [number, number][] = [[10, 20], [12, 28], [13, 36], [14, 46], [11, 10], [15, 30]];
    for (const [n, m] of backs) {
      this.place(this.pl(team, n), team, fM - 10 - (n === 15 ? 12 : 0), ly(m));
      this.place(this.pl(def, n), team, fM + 10 + (n === 15 ? 12 : 0), ly(m));
    }
    for (const p of this.players) p.busy = 9;
    this.ball.carrier = null;
    this.ball.pos = { x: this.wx(team, fM), y: ly(0.6), z: 1 };
    this.phase = "lineout";
    this.phaseTimer = 1.6;
    this.possession = team;
    this.say("LINEOUT", `${this.teamName(team)} throw`, "#ffffff", 2);
    if (this.userTeam !== null) this.controlled = this.pl(this.userTeam, 9).id;
  }

  private resolveLineout(): void {
    const r = this.restart;
    if (!r) return;
    const att = r.team;
    const def = other(att);
    const jump = (t: TeamIndex) => (this.pl(t, 4).attrs.strength + this.pl(t, 5).attrs.strength) / 2;
    const pWin = clamp(0.82 + (jump(att) - jump(def)) * 0.004, 0.55, 0.95);
    const winner: TeamIndex = this.rng() < pWin ? att : def;
    this.teamStats[winner].lineoutsWon++;
    for (const p of this.players) { if (p.isOnField) p.busy = p.isForward ? 0.6 : 0; }
    if (winner !== att) {
      this.say("LINEOUT STOLEN!", `${this.teamName(def)} win it in the air`, "#fbbf24");
      this.pushComment(`Lineout stolen! ${this.teamName(def)} against the throw.`, def);
    } else this.say("Lineout won", `${this.teamName(att)} ball`, "#ffffff", 1.2);
    const nine = this.pl(winner, 9);
    nine.busy = 0;
    const wdir = this.teams[winner].dir;
    const inward = r.y === 0 ? 1 : -1;
    nine.pos = { x: clamp(r.x - wdir * 2.5, 1, L - 1), y: r.y + inward * 12 };
    this.giveBallTo(nine);
    this.phase = "play";
    this.teams[other(winner)].lineF = this.fx(winner, r.x) + 10;
  }

  // ---------- penalties & goal kicks ----------
  private setupPenaltyChoice(team: TeamIndex, x: number, y: number): void {
    this.resetPlayers();
    const def = other(team);
    const fM = clamp(this.fx(team, x), 6, 108);
    const my = clamp(y, 3, W - 3);
    const gx = this.wx(team, 110);
    const distance = hyp(gx - this.wx(team, fM), 35 - my);
    this.restart = { kind: "penalty", team, x: this.wx(team, fM), y: my };
    this.penalty = { team, x: this.wx(team, fM), y: my, canGoal: distance <= 58, distance, timer: 1.2 };
    this.place(this.pl(team, 9), team, fM - 0.5, my);
    let i = 0;
    for (let n = 1; n <= 15; n++) {
      if (n === 9) continue;
      const p = this.pl(team, n);
      this.place(p, team, fM - 4 - (i % 3) * 2.5, clamp(my + (i - 7) * 4.2, 2, W - 2));
      i++;
    }
    let j = 0;
    for (let n = 1; n <= 15; n++) {
      const p = this.pl(def, n);
      if (n === 15) {
        this.place(p, team, Math.min(fM + 28, 112), 35);
        continue;
      }
      this.place(p, team, fM + 10.5, clamp(my + (j - 6.5) * 4.6, 2, W - 2));
      j++;
    }
    this.ball.carrier = null;
    this.ball.pos = { x: this.wx(team, fM), y: my, z: 0 };
    this.phase = "penaltyChoice";
    this.possession = team;
    if (this.userTeam !== null) this.controlled = this.pl(this.userTeam, 9).id;
  }

  private updatePenaltyChoice(dt: number, input: InputFrame, remoteInput: InputFrame | null): void {
    const pen = this.penalty;
    if (!pen) {
      this.phase = "play";
      return;
    }
    const teamInput = pen.team === this.userTeam ? input : pen.team === this.remoteTeam ? remoteInput : null;
    if (teamInput) {
      if (teamInput.option1 && pen.canGoal) { this.takePenalty("goal"); return; }
      if (teamInput.option2) { this.takePenalty("touch"); return; }
      if (teamInput.option3) { this.takePenalty("tap"); return; }
      return;
    }
    pen.timer -= dt;
    if (pen.timer > 0) return;
    const kicker = this.chooseKicker(pen.team);
    const range = 38 + (kicker.attrs.kicking - 70) * 0.35;
    const f = this.fx(pen.team, pen.x);
    if (pen.canGoal && pen.distance <= range) this.takePenalty("goal");
    else if (f > 92 && this.rng() < 0.35) this.takePenalty("tap");
    else this.takePenalty("touch");
  }

  takePenalty(choice: "goal" | "touch" | "tap"): void {
    const pen = this.penalty;
    if (!pen) return;
    const team = pen.team;
    const f = this.fx(team, pen.x);
    this.penalty = null;
    if (choice === "goal") {
      this.setupGoalKick(team, pen.x, pen.y, "penalty");
      return;
    }
    if (choice === "touch") {
      const kicker = this.chooseKicker(team);
      const gain = 20 + kicker.attrs.kicking * 0.22 + this.rng() * 8;
      const nf = Math.min(f + gain, 105);
      this.say("Kicked to touch", `Lineout to ${this.teamName(team)}`, "#ffffff", 1.6);
      this.setupLineout(team, this.wx(team, nf), pen.y < 35 ? 0 : W);
      return;
    }
    const nine = this.pl(team, 9);
    nine.pos = { x: pen.x, y: pen.y };
    this.giveBallTo(nine);
    this.phase = "play";
    this.teams[other(team)].lineF = f + 10;
    this.say("Tap and go!", "", "#ffffff", 1.2);
  }

  private setupGoalKick(team: TeamIndex, x: number, y: number, kind: "conversion" | "penalty"): void {
    this.resetPlayers();
    this.ruck = null;
    this.penalty = null;
    const def = other(team);
    const dir = this.teams[team].dir;
    const gx = this.wx(team, 110);
    const kx = clamp(x, 2, L - 2);
    const ky = clamp(y, 3, W - 3);
    const distance = hyp(gx - kx, 35 - ky);
    const kicker = this.chooseKicker(team);
    const fK = this.fx(team, kx);
    kicker.pos = { x: clamp(kx - dir * 1.4, 1, L - 1), y: ky };
    kicker.facing = dir === 1 ? 0 : Math.PI;
    let i = 0;
    for (let n = 1; n <= 15; n++) {
      const p = this.pl(team, n);
      if (p.id === kicker.id) continue;
      this.place(p, team, fK - 6 - (i % 2) * 2, clamp(ky + (i - 6.5) * 3.2, 2, W - 2));
      i++;
    }
    let j = 0;
    for (let n = 1; n <= 15; n++) {
      const p = this.pl(def, n);
      const f = kind === "conversion" ? 110.8 : Math.min(fK + 10.5, 111);
      this.place(p, team, f, 6 + j * 4.2);
      j++;
    }
    this.ball.carrier = null;
    this.ball.flight = "none";
    this.ball.vel = { x: 0, y: 0, z: 0 };
    this.ball.pos = { x: kx, y: ky, z: 0 };
    this.goalKick = {
      team, kind, x: kx, y: ky, kickerId: kicker.id, launched: false, scored: false, timer: 0, scoredAt: 0,
      aiTimer: 1.6, distance, requiredPower: this.requiredPower(distance),
      meter: (this.userTeam === team || this.remoteTeam === team) ? { stage: "power", value: 0, dirn: 1, power: 0, accuracy: 0 } : null,
    };
    this.phase = "goalKick";
    this.possession = team;
    if (this.userTeam !== null) this.controlled = this.userTeam === team ? kicker.id : this.pl(this.userTeam, 15).id;
    this.say(kind === "conversion" ? "CONVERSION" : "PENALTY KICK", `${kicker.name} – ${Math.round(distance)}m`, "#ffffff", 2);
  }

  private updateGoalKick(dt: number, input: InputFrame, remoteInput: InputFrame | null): void {
    const gk = this.goalKick;
    if (!gk) {
      this.phase = "play";
      return;
    }
    if (!gk.launched) {
      if (gk.meter) {
        const m = gk.meter;
        const kickerInput = gk.team === this.userTeam ? input : gk.team === this.remoteTeam ? remoteInput : null;
        if (m.stage === "power") {
          m.value += m.dirn * dt * 1.2;
          if (m.value >= 1) { m.value = 1; m.dirn = -1; }
          if (m.value <= 0) { m.value = 0; m.dirn = 1; }
          if (kickerInput?.action) {
            m.power = m.value;
            m.stage = "accuracy";
            m.value = 0;
            m.dirn = 1;
          }
        } else if (m.stage === "accuracy") {
          m.value += m.dirn * dt * 1.7;
          if (m.value >= 1) { m.value = 1; m.dirn = -1; }
          if (m.value <= 0) { m.value = 0; m.dirn = 1; }
          if (kickerInput?.action) {
            m.accuracy = m.value;
            m.stage = "done";
            this.executeGoalKick(m.power, m.accuracy);
          }
        }
      } else {
        gk.aiTimer -= dt;
        if (gk.aiTimer <= 0) this.aiGoalKick();
      }
      return;
    }
    gk.timer += dt;
    this.updateBall(dt);
    const b = this.ball;
    if (gk.scored) {
      if (gk.timer > gk.scoredAt + 1.3) this.afterGoalKick(true);
      return;
    }
    const landed = b.pos.z <= 0 && b.bounced;
    const out = b.pos.y < 0 || b.pos.y > W || b.pos.x < 0 || b.pos.x > L;
    if (landed || out || (b.goalChecked && gk.timer > 3.5) || gk.timer > 8) this.afterGoalKick(false);
  }

  private executeGoalKick(power: number, accOffset: number): void {
    const gk = this.goalKick;
    if (!gk) return;
    const kicker = this.players[gk.kickerId];
    const gx = this.wx(gk.team, 110);
    const angle = Math.atan2(35 - gk.y, gx - gk.x) + accOffset * 0.2;
    const v = 13 + 17 * clamp(power, 0, 1);
    const b = this.ball;
    b.pos = { x: gk.x, y: gk.y, z: 0.3 };
    b.vel = {
      x: v * Math.cos(GOAL_ELEV) * Math.cos(angle),
      y: v * Math.cos(GOAL_ELEV) * Math.sin(angle),
      z: v * Math.sin(GOAL_ELEV),
    };
    b.carrier = null;
    b.flight = "kick";
    b.kickKind = gk.kind;
    b.kickTeam = gk.team;
    b.kickFromX = gk.x;
    b.kickFrom22 = false;
    b.bounced = false;
    b.goalChecked = false;
    b.noCatchUntil = this.time + 1.5;
    b.lastTeam = gk.team;
    b.lastPlayer = kicker.id;
    b.receiver = null;
    b.target = this.predictLanding();
    gk.launched = true;
    kicker.busy = 0.5;
    kicker.anim = "kick";
    kicker.animUntil = this.time + 0.5;
  }

  private aiGoalKick(): void {
    const gk = this.goalKick;
    if (!gk) return;
    const kicker = this.players[gk.kickerId];
    const d = gk.distance;
    const gx = this.wx(gk.team, 110);
    const angleFactor = 1 - (Math.abs(35 - gk.y) / (d + 1)) * 0.35;
    const p = clamp((kicker.attrs.kicking / 100) * (1.12 - d / 70) * angleFactor, 0.05, 0.96);
    const success = this.rng() < p;
    const baseAngle = Math.atan2(35 - gk.y, gx - gk.x);
    let power: number;
    let targetY: number;
    if (success) {
      power = clamp(gk.requiredPower + 0.12 + this.rng() * 0.1, 0, 1);
      targetY = 35 + (this.rng() - 0.5) * 4;
    } else if (this.rng() < 0.3) {
      power = clamp(gk.requiredPower - 0.1 - this.rng() * 0.15, 0.1, 1);
      targetY = 35 + (this.rng() - 0.5) * 3;
    } else {
      power = clamp(gk.requiredPower + 0.1 + this.rng() * 0.15, 0, 1);
      targetY = 35 + (this.rng() < 0.5 ? -1 : 1) * (3.4 + this.rng() * 4);
    }
    const targetAngle = Math.atan2(targetY - gk.y, gx - gk.x);
    this.executeGoalKick(power, (targetAngle - baseAngle) / 0.2);
  }

  private afterGoalKick(success: boolean): void {
    const gk = this.goalKick;
    if (!gk) return;
    this.goalKick = null;
    if (gk.kind === "conversion") {
      if (!success) this.say("Conversion missed", "", "#f87171", 1.5);
      this.setupKickoff(other(gk.team), "kickoff");
      return;
    }
    if (success) {
      this.setupKickoff(other(gk.team), "kickoff");
      return;
    }
    const b = this.ball;
    const f = this.fx(gk.team, b.pos.x);
    if (b.pos.y > 0 && b.pos.y < W && f > 10 && f < 110) {
      this.say("Penalty missed", "Play on!", "#f87171", 1.5);
      this.phase = "play";
      this.possession = other(gk.team);
      for (const p of this.players) { if (p.isOnField) p.busy = 0; }
      if (this.userTeam !== null) this.controlled = this.nearestPlayer(this.userTeam, { x: b.pos.x, y: b.pos.y }).id;
      return;
    }
    this.say("Penalty missed", "Goal-line drop-out", "#f87171", 1.5);
    this.scheduleRestart("dropout", other(gk.team));
  }

  // ---------- boundaries ----------
  private checkBoundaries(dt: number): void {
    const b = this.ball;
    const c = this.carrier();
    if (c) {
      if (c.pos.y < 0.45 || c.pos.y > W - 0.45) {
        this.say("Into touch", `Lineout to ${this.teamName(other(c.team))}`);
        this.scheduleRestart("lineout", other(c.team), c.pos.x, c.pos.y < 35 ? 0 : W);
      }
      return;
    }
    if (b.pos.y < 0 || b.pos.y > W) {
      this.ballIntoTouch();
      return;
    }
    if (b.pos.x < 0 || b.pos.x > L) {
      const defTeam = this.defenderOfEnd(b.pos.x);
      if (b.kickKind === "kickoff" && b.kickTeam !== null && !b.bounced) {
        this.say("Kick-off went dead", "Scrum at halfway");
        this.scheduleRestart("scrum", other(b.kickTeam), 60, 35);
        return;
      }
      this.say("Ball dead", "Goal-line drop-out");
      this.scheduleRestart("dropout", defTeam);
      return;
    }
    const still = b.pos.z <= 0 && hyp(b.vel.x, b.vel.y) < 0.2;
    if (still && (b.pos.x < 10 || b.pos.x > 110)) {
      this.deadTimer += dt;
      if (this.deadTimer > 2.5) {
        this.say("Ball dead in-goal", "Goal-line drop-out");
        this.scheduleRestart("dropout", this.defenderOfEnd(b.pos.x));
      }
    } else if (still) {
      this.deadTimer += dt;
      if (this.deadTimer > 12) {
        this.scheduleRestart("scrum", this.possession, b.pos.x, b.pos.y);
      }
    } else {
      this.deadTimer = 0;
    }
  }

  private ballIntoTouch(): void {
    const b = this.ball;
    const side = b.pos.y < 35 ? 0 : W;
    const x = clamp(b.pos.x, 0, L);
    if (x <= 10 || x >= 110) {
      this.say("Ball dead", "Goal-line drop-out");
      this.scheduleRestart("dropout", this.defenderOfEnd(x));
      return;
    }
    let throwTeam: TeamIndex;
    let markX = x;
    if (b.flight === "kick" && b.kickTeam !== null) {
      if (b.kickKind === "kickoff" && !b.bounced) {
        this.say("Kick-off straight into touch", "Scrum at halfway");
        this.scheduleRestart("scrum", other(b.kickTeam), 60, 35);
        return;
      }
      throwTeam = other(b.kickTeam);
      if (!b.bounced && !b.kickFrom22 && b.kickKind !== "dropout") {
        markX = b.kickFromX;
        this.say("Out on the full", "Lineout back where it was kicked from");
      } else {
        this.say("Found touch!", `Lineout to ${this.teamName(throwTeam)}`);
      }
    } else {
      throwTeam = b.lastTeam !== null ? other(b.lastTeam) : 0;
      this.say("Into touch", `Lineout to ${this.teamName(throwTeam)}`);
    }
    this.scheduleRestart("lineout", throwTeam, markX, side);
  }
}
