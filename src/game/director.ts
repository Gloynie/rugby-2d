import type { RugbyEngine } from "./engine";
import { keyLabel, type Bindings } from "./controls";
import type { FrameOptions, PlayerVisual, Renderer, Snapshot } from "./render";
import { CameraShots, type FeaturedPlayer } from "./camerashots";
import type { Stadium, TeamIndex, Vec2 } from "./types";

export type Scene = "intro" | "toss" | "tossChoice" | "live" | "try" | "replay" | "halftime" | "fulltime" | "scrum";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const REPLAY_SPEED = 0.5;
const REPLAY_LENGTH = 4.2;
const RING_SECONDS = 10;
const otherIdx = (t: TeamIndex): TeamIndex => (t === 0 ? 1 : 0);

export interface DirectorOptions {
  attract: boolean;
  competition: string;
  bindings: Bindings;
  skipIntro?: boolean;
}

export class Director {
  scene: Scene;
  t = 0;
  done = false;
  private ring: Snapshot[] = [];
  private ringTime = 0;
  private replayT = 0;
  private replayEnd = 0;
  private replayFresh = false;
  private lastTries = 0;
  private sawHalftime = false;
  private flash = 0;
  private introFrom: Vec2;
  private introTo: Vec2;
  private tossWinner: TeamIndex = 0;
  private tossChoice: "kick" | "ends" | null = null;
  private tossApplied = false;
  private scrumUser = 0;
  private scrumAi = 0;
  // ---- timing-based scrum contest ----
  private scrumPhase = 0;        // 0 = not started, 1..3 = shove number
  private scrumMarker = 0;       // 0..1 sweeping position
  private scrumDir: 1 | -1 = 1;
  private scrumSpeed = 1.1;
  private scrumTarget = 0.5;     // centre of the sweet spot
  private scrumHalfWidth = 0.12; // half-width of the sweet spot
  private scrumHits = 0;
  private scrumLock = 0;
  private scrumFeedback = "";

  /** Pick a fresh sweet spot; later shoves are faster and narrower. */
  private rollScrumTarget(packEdge: number): void {
    const step = Math.max(1, this.scrumPhase);
    this.scrumHalfWidth = Math.max(0.055, 0.135 - step * 0.022 + packEdge * 0.0022);
    this.scrumSpeed = 0.95 + step * 0.26 - packEdge * 0.012;
    // keep the target away from the extreme edges so it is always reachable
    this.scrumTarget = 0.22 + Math.random() * 0.56;
  }

  constructor(
    private engine: RugbyEngine,
    private stadium: Stadium,
    private opts: DirectorOptions,
  ) {
    this.scene = opts.skipIntro ? "live" : "intro";
    // Keep the matchup card on the same camera position that gameplay uses.
    this.introFrom = { x: 60, y: 35 };
    this.introTo = { x: 60, y: 35 };
  }

  private get internationalFixture(): boolean {
    return this.engine.teams[0].data.type === "international" && this.engine.teams[1].data.type === "international";
  }

  private get introLength(): number {
    // Complete the presentation before normal live gameplay begins.
    return this.opts.attract ? 6.2 : this.internationalFixture ? 11.25 : 7.55;
  }

  /** A once-per-stage sound cue consumed by the browser runtime. */
  ceremonyCue(): "home-anthem" | "away-anthem" | null {
    if (this.scene !== "intro" || this.opts.attract || !this.internationalFixture) return null;
    const lineupEnd = 4.9;
    const homeAnthemEnd = lineupEnd + 1.85;
    const awayAnthemEnd = homeAnthemEnd + 1.85;
    if (this.t >= lineupEnd && this.t < homeAnthemEnd) return "home-anthem";
    if (this.t >= homeAnthemEnd && this.t < awayAnthemEnd) return "away-anthem";
    return null;
  }

  /** Record what the renderer drew this frame so we can replay it later. */
  private replayLabel = "LAST PLAY";

  /** Build the cinematic feature for an engine player (null if the renderer has no look yet). */
  private feature(r: Renderer, id: number | null): FeaturedPlayer | null {
    if (id === null) return null;
    const p = this.engine.players[id];
    if (!p) return null;
    const look = r.lookFor(p.team, p.number);
    if (!look) return null;
    return { look, name: p.name, number: p.number, teamColor: this.engine.teams[p.team].color };
  }
  setReplayLabel(label: string): void { this.replayLabel = label; }

  record(snap: Snapshot, dt: number): void {
    this.ringTime += dt;
    this.ring.push({ ...snap, t: this.ringTime });
    const cutoff = this.ringTime - RING_SECONDS;
    while (this.ring.length > 2 && this.ring[0].t < cutoff) this.ring.shift();
  }

  /** Called after every engine step to detect events that deserve a scene. */
  afterStep(): void {
    const e = this.engine;
    const tries = e.tries[0] + e.tries[1];
    if (e.phase === "try" && tries > this.lastTries && e.tryScorer !== null) {
      this.lastTries = tries;
      this.scene = "try";
      this.t = 0;
      return;
    }
    if (e.phase === "halftime" && !this.sawHalftime) {
      this.sawHalftime = true;
      this.scene = "halftime";
      this.t = 0;
      return;
    }
    if (e.finished && this.scene !== "fulltime") {
      this.scene = "fulltime";
      this.t = 0;
    }
  }

  update(dt: number, skip: boolean, paused: boolean, input?: { option1: boolean; option2: boolean; action: boolean }): FrameOptions {
    if (!paused) this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 0.45);
    const f: FrameOptions = { stepEngine: false, frozen: false, zoom: 1, hideHUD: false, letterbox: 0, flash: this.flash };
    const e = this.engine;
    switch (this.scene) {
      case "intro": {
        f.freeCam = true;
        // Renderer now eases every framing change for a continuous broadcast-style camera move.
        f.snapCam = false;
        f.hideHUD = true;
        f.letterbox = 1;
        f.frozen = true;
        const international = this.internationalFixture;
        const panEnd = this.opts.attract ? 1.2 : 1.65;
        const walkoutEnd = this.opts.attract ? 2.8 : 4.0;
        const lineupEnd = walkoutEnd + 0.9;
        const homeAnthemEnd = lineupEnd + (international && !this.opts.attract ? 1.85 : 0);
        const awayAnthemEnd = homeAnthemEnd + (international && !this.opts.attract ? 1.85 : 0);
        const huddleEnd = (international && !this.opts.attract ? awayAnthemEnd : lineupEnd) + 1.05;
        const positionsEnd = huddleEnd + 1.0;

        if (this.t < panEnd) {
          // Stadium pan: close enough to remain readable, wide enough to show the packed bowl.
          const k = easeInOut(clamp(this.t / panEnd, 0, 1));
          f.zoom = 0.74;
          f.camSpeed = 1.45;
          f.camTarget = { x: lerp(38, 82, k), y: 35 + Math.sin(k * Math.PI) * 5 };
          f.ceremony = { stage: "pan", progress: k };
          f.drawOverlay = (r) => this.drawStadiumPanLabel(r);
        } else if (this.t < walkoutEnd) {
          f.zoom = 0.88;
          f.camSpeed = 2.15;
          f.camTarget = { x: 60, y: 42 };
          f.ceremony = { stage: "walkout", progress: clamp((this.t - panEnd) / (walkoutEnd - panEnd), 0, 1) };
        } else if (this.t < lineupEnd) {
          f.zoom = 0.9;
          f.camSpeed = 2.4;
          f.camTarget = { x: 60, y: 34 };
          f.ceremony = { stage: "lineup", progress: clamp((this.t - walkoutEnd) / (lineupEnd - walkoutEnd), 0, 1) };
        } else if (this.t < homeAnthemEnd) {
          f.zoom = 0.9;
          f.camSpeed = 2.6;
          f.camTarget = { x: 60, y: 34 };
          f.ceremony = { stage: "lineup", progress: 1, anthemTeam: 0 };
          f.drawOverlay = (r) => this.drawAnthemCard(r, 0);
        } else if (this.t < awayAnthemEnd) {
          f.zoom = 0.9;
          f.camSpeed = 2.6;
          f.camTarget = { x: 60, y: 34 };
          f.ceremony = { stage: "lineup", progress: 1, anthemTeam: 1 };
          f.drawOverlay = (r) => this.drawAnthemCard(r, 1);
        } else if (this.t < huddleEnd) {
          f.zoom = 1.06;
          f.camSpeed = 2.1;
          f.camTarget = { x: 60, y: 35 };
          f.ceremony = { stage: "huddle", progress: clamp((this.t - (international && !this.opts.attract ? awayAnthemEnd : lineupEnd)) / (huddleEnd - (international && !this.opts.attract ? awayAnthemEnd : lineupEnd)), 0, 1) };
        } else if (this.t < positionsEnd) {
          f.zoom = 1;
          f.camSpeed = 3.1;
          f.camTarget = { x: 60, y: 35 };
          f.ceremony = { stage: "positions", progress: clamp((this.t - huddleEnd) / (positionsEnd - huddleEnd), 0, 1) };
        } else {
          f.zoom = 1;
          f.camTarget = { x: 60, y: 35 };
          f.drawOverlay = (r) => this.drawMatchupCard(r, clamp((this.t - positionsEnd) / 0.45, 0, 1));
        }
        if (this.t >= this.introLength || (skip && !this.opts.attract)) this.beginToss();
        if (!this.opts.attract) {
          const existing = f.drawOverlay;
          f.drawOverlay = (r) => {
            existing?.(r);
            r.panel(r.bufW - 90, 34, 84, 18);
            r.text("PRESS " + keyLabel(this.opts.bindings.action, true) + " TO SKIP", r.bufW - 48, 39, { align: "center", color: "#facc15", size: 8 });
          };
        }
        break;
      }
      case "toss": {
        // Referee coin toss: spin for 1.4s, then reveal the winner.
        if (!this.tossApplied && this.t > 1.4) {
          if (this.tossChoice !== null) {
            this.applyToss();
            this.scene = "live";
          } else {
            this.scene = "tossChoice";
            this.t = 0;
          }
        }
        if (skip && !this.opts.attract) {
          if (this.tossChoice === null) this.tossChoice = Math.random() < 0.5 ? "kick" : "ends";
          this.applyToss();
          this.scene = "live";
        }
        f.zoom = 1;
        f.camTarget = { x: 60, y: 35 };
        f.hideHUD = true;
        f.letterbox = 1;
        f.frozen = true;
        f.drawOverlay = (r) => this.drawToss(r);
        break;
      }
      case "tossChoice": {
        f.zoom = 1;
        f.camTarget = { x: 60, y: 35 };
        f.hideHUD = true;
        f.letterbox = 1;
        f.frozen = true;
        if (input?.option1) this.tossChoice = "kick";
        else if (input?.option2) this.tossChoice = "ends";
        else if (input?.action) this.tossChoice = "kick";
        if (this.tossChoice !== null) {
          this.applyToss();
          this.scene = "live";
        }
        f.drawOverlay = (r) => this.drawTossChoice(r);
        break;
      }
      case "live": {
        f.stepEngine = true;
        f.zoom = 1;
        if (!paused && (this.engine.phase === "whistle" || this.engine.phase === "halftime")) {
          const t2 = this.t * 0.4;
          f.drawOverlay = (r) => CameraShots.crowdPan(r, { x: 60, y: 35 }, t2);
        }
        if (!paused && (this.engine.phase === "lineout" || this.engine.phase === "scrum")) {
          const t2 = this.t;
          const existing = f.drawOverlay;
          f.drawOverlay = (r) => { existing?.(r); CameraShots.crowdWave(r, t2); };
        }
        if (this.engine.scrumInteractive && this.engine.phase === "scrum") {
          this.scene = "scrum";
          this.t = 0;
          this.scrumUser = 0;
          this.scrumAi = 0;
          this.scrumPhase = 0;
        }
        break;
      }
      case "scrum": {
        // Timing contest: a marker sweeps the bar, press on the sweet spot. Three shoves,
        // each with a smaller target, so a dominant scrum takes real precision.
        f.frozen = true;
        f.zoom = 1.5;
        f.hideHUD = true;
        f.letterbox = 1;
        const r = this.engine.restart;
        f.camTarget = r ? { x: r.x, y: r.y } : { x: 60, y: 35 };
        f.camSpeed = 8;

        const userPack = this.engine.userTeam !== null ? this.engine.packStrengthPublic(this.engine.userTeam) : 70;
        const oppPack = this.engine.userTeam !== null ? this.engine.packStrengthPublic(otherIdx(this.engine.userTeam)) : 70;
        // A stronger pack gets a slightly wider target and a slower sweep.
        const packEdge = Math.max(-10, Math.min(10, userPack - oppPack));

        if (this.scrumPhase === 0) {
          // first frame of this contest – set the sweet spot up
          this.scrumPhase = 1;
          this.scrumMarker = 0;
          this.scrumDir = 1;
          this.scrumHits = 0;
          this.scrumFeedback = "";
          this.rollScrumTarget(packEdge);
        }

        if (!paused) {
          const speed = this.scrumSpeed;
          this.scrumMarker += this.scrumDir * speed * dt;
          if (this.scrumMarker >= 1) { this.scrumMarker = 1; this.scrumDir = -1; }
          if (this.scrumMarker <= 0) { this.scrumMarker = 0; this.scrumDir = 1; }
        }

        if (input?.action && this.scrumLock <= 0) {
          this.scrumLock = 0.25;
          const dist = Math.abs(this.scrumMarker - this.scrumTarget);
          if (dist <= this.scrumHalfWidth * 0.4) {
            this.scrumHits += 1.0;
            this.scrumFeedback = "PERFECT SHOVE!";
          } else if (dist <= this.scrumHalfWidth) {
            this.scrumHits += 0.6;
            this.scrumFeedback = "GOOD SHOVE";
          } else {
            this.scrumHits -= 0.35;
            this.scrumFeedback = "SLIPPED!";
          }
          this.scrumPhase++;
          if (this.scrumPhase <= 3) this.rollScrumTarget(packEdge);
        }
        if (this.scrumLock > 0) this.scrumLock -= dt;

        const outOfTime = this.t > 7.5;
        if (this.scrumPhase > 3 || outOfTime) {
          this.engine.scrumInteractive = false;
          // Convert the three timed shoves into the 0..1 push values the engine expects.
          const userPush = Math.max(0, Math.min(1, this.scrumHits / 3));
          const aiPush = Math.max(0, Math.min(1, 0.52 - packEdge * 0.012 + (outOfTime ? 0.3 : 0)));
          this.engine.resolveScrumContest(userPush >= 0.92 ? 1 : userPush, aiPush >= 0.92 ? 1 : aiPush, this.engine.userTeam ?? 0);
          this.scrumPhase = 0;
          this.scene = "live";
        }
        f.drawOverlay = (r2) => this.drawScrumContest(r2);
        break;
      }
      case "try": {
        const scorer = e.tryScorer !== null ? e.players[e.tryScorer] : null;
        f.frozen = true;
        f.zoom = 2;
        f.hideHUD = true;
        f.letterbox = 1;
        f.camSpeed = 6;
        this.flash = 1;
        f.flash = 1;
        if (scorer) {
          f.camTarget = { x: scorer.pos.x, y: scorer.pos.y };
          f.celebrate = { team: scorer.team, pos: scorer.pos };
        }
        if (scorer) {
          const teamColor = e.teams[scorer.team].color;
          const tt = this.t;
          const sid = scorer.id;
          f.drawOverlay = (r) => {
            // Cut 1: tunnel-cam portrait of the scorer. Cut 2: wide celebration.
            const fp = this.feature(r, sid);
            if (fp && tt < 1.0 && !this.opts.attract) CameraShots.portrait(r, fp, tt, "TRY!", `${scorer.name} · ${e.teams[scorer.team].data.name}`);
            else CameraShots.celebration(r, scorer.name, teamColor);
          };
        } else f.drawOverlay = (r) => this.drawTry(r);
        if (this.t > 2.2 || (skip && !this.opts.attract)) this.startReplay();
        break;
      }
      case "replay": {
        if (!paused) this.replayT += dt * REPLAY_SPEED;
        const snap = this.sample(this.replayT);
        f.snapshot = snap;
        f.zoom = 2;
        f.camTarget = snap.focus;
        f.camSpeed = 7;
        f.snapCam = this.replayFresh;
        this.replayFresh = false;
        f.hideHUD = true;
        f.letterbox = 1;
        f.frozen = true;
        {
          const tt = this.t;
          const sid = e.tryScorer;
          f.drawOverlay = (r) => {
            const h = e.teams[0].data.short;
            const a = e.teams[1].data.short;
            const fp = this.feature(r, sid);
            if (fp && tt < 0.9 && !this.opts.attract) CameraShots.sideline(r, fp, tt, "Replay · touchline cam");
            else CameraShots.replay(r, this.replayLabel ?? "LAST PLAY", h, a, e.score[0], e.score[1], e.gameMinute());
          };
        }
        if (this.replayT >= this.replayEnd || (skip && !this.opts.attract)) this.endReplay();
        break;
      }
      case "halftime":
      case "fulltime": {
        const isHalf = this.scene === "halftime";
        f.freeCam = true;
        f.hideHUD = true;
        f.letterbox = 1;
        f.frozen = true;
        // Stage A (0–2.4s): score card over a slow pan. Stage B: full stats board over a
        // different angle – a high wide shot that drifts, like a broadcast half-time.
        const statsStart = 2.4;
        const inStats = this.t >= statsStart && !this.opts.attract;
        if (!inStats) {
          const k = clamp(this.t / 6, 0, 1);
          f.camTarget = { x: lerp(25, 95, k), y: 35 + Math.sin(this.t * 0.6) * 6 };
          f.camSpeed = 2.5;
          f.zoom = 1;
          f.drawOverlay = (r) => this.drawScoreCard(r, isHalf ? "HALF TIME" : "FULL TIME");
        } else {
          const k2 = clamp((this.t - statsStart) / 8, 0, 1);
          f.zoom = 0.78;
          f.camSpeed = 1.6;
          f.camTarget = { x: lerp(70, 50, k2), y: 35 + Math.sin(this.t * 0.4) * 4 };
          f.drawOverlay = (r) => this.drawStatsBoard(r, isHalf ? "HALF TIME STATS" : "FULL TIME STATS", this.t - statsStart);
        }
        if (!isHalf) {
          this.flash = Math.max(this.flash, 0.6);
          f.flash = this.flash;
        }
        // Give the stats board time to be read; action key skips any stage.
        const length = this.opts.attract ? 4.5 : isHalf ? 9.5 : 10.5;
        if (this.t > length || (skip && this.t > 0.6 && !this.opts.attract)) {
          if (isHalf) {
            e.phaseTimer = 0.01;
            this.scene = "live";
          } else this.done = true;
        }
        break;
      }
    }
    return f;
  }

  // ---------- replay ----------
  private startReplay(): void {
    if (this.ring.length < 10) {
      this.endReplay();
      return;
    }
    const e = this.engine;
    this.replayLabel =
      e.phase === "try" ? "TRY REPLAY"
      : e.phase === "penaltyChoice" ? "PENALTY SHOT"
      : e.phase === "goalKick" ? "GOAL KICK"
      : e.phase === "scrum" ? "SCRUM"
      : e.phase === "lineout" ? "LINEOUT"
      : "LAST PLAY";
    const end = this.ring[this.ring.length - 1].t;
    this.replayT = Math.max(this.ring[0].t, end - REPLAY_LENGTH);
    this.replayEnd = end;
    this.replayFresh = true;
    this.scene = "replay";
    this.t = 0;
  }

  private endReplay(): void {
    this.engine.phaseTimer = Math.min(this.engine.phaseTimer, 0.35);
    this.engine.message.timer = 0;
    this.scene = "live";
    this.t = 0;
  }

  private sample(T: number): Snapshot {
    const r = this.ring;
    let i = 0;
    while (i < r.length - 2 && r[i + 1].t <= T) i++;
    const a = r[i];
    const b = r[Math.min(i + 1, r.length - 1)];
    const span = b.t - a.t;
    const k = span > 0 ? clamp((T - a.t) / span, 0, 1) : 0;
    const players: PlayerVisual[] = a.players.map((p, idx) => {
      const q = b.players[idx] ?? p;
      return { ...p, x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k) };
    });
    const ball = { ...a.ball, x: lerp(a.ball.x, b.ball.x, k), y: lerp(a.ball.y, b.ball.y, k), z: lerp(a.ball.z, b.ball.z, k) };
    return { t: T, players, ball, focus: { x: ball.x, y: ball.y } };
  }

  // ---------- overlays ----------
  private beginToss(): void {
    this.scene = "toss";
    this.t = 0;
    this.tossApplied = false;
    const user = this.engine.userTeam;
    this.tossWinner = Math.random() < 0.5 ? 0 : 1;
    if (this.opts.attract || user === null || this.tossWinner !== user) {
      this.tossChoice = Math.random() < 0.5 ? "kick" : "ends";
    } else {
      this.tossChoice = null; // user decides after the coin lands
    }
  }

  private applyToss(): void {
    if (this.tossApplied) return;
    this.tossApplied = true;
    this.engine.applyTossDecision(this.tossWinner, this.tossChoice ?? "kick");
  }

  private drawToss(r: Renderer): void {
    const e = this.engine;
    r.panel(r.bufW / 2 - 150, r.bufH / 2 - 70, 300, 140, { fill: "rgba(5,10,20,0.92)", accent: "#facc15" });
    r.text("COIN TOSS", r.bufW / 2, r.bufH / 2 - 58, { align: "center", size: 14, color: "#facc15" });
    // spinning coin
    const spin = Math.max(0.12, Math.abs(Math.cos(this.t * 9)));
    const cx = r.bufW / 2;
    const cy = r.bufH / 2 + 6;
    const rw = 26 * spin;
    r.fillEllipse(cx, cy, rw + 3, 26, "#0b1020");
    r.fillEllipse(cx, cy, rw, 24, spin > 0.5 ? "#facc15" : "#e5e7eb");
    if (this.t > 1.0) {
      const winner = e.teams[this.tossWinner];
      r.text(`${winner.data.name.toUpperCase()} WIN THE TOSS`, r.bufW / 2, r.bufH / 2 + 46, { align: "center", size: 8, color: "#ffffff" });
    } else {
      r.text("THE REFEREE TOSSES THE COIN", r.bufW / 2, r.bufH / 2 + 46, { align: "center", size: 7, color: "#94a3b8" });
    }
  }

  private drawTossChoice(r: Renderer): void {
    const e = this.engine;
    r.panel(r.bufW / 2 - 170, r.bufH / 2 - 60, 340, 120, { fill: "rgba(5,10,20,0.94)", accent: e.teams[this.tossWinner].color });
    r.text("YOU WON THE TOSS", r.bufW / 2, r.bufH / 2 - 46, { align: "center", size: 12, color: "#facc15" });
    r.text("WHAT DOES THE CAPTAIN CHOOSE?", r.bufW / 2, r.bufH / 2 - 22, { align: "center", size: 8, color: "#94a3b8" });
    r.text(`[${keyLabel(this.opts.bindings.opt1, true)}]  KICK OFF`, r.bufW / 2, r.bufH / 2 + 2, { align: "center", size: 10, color: "#ffffff" });
    r.text(`[${keyLabel(this.opts.bindings.opt2, true)}]  CHOOSE ENDS`, r.bufW / 2, r.bufH / 2 + 26, { align: "center", size: 10, color: "#ffffff" });
  }

  private drawScrumContest(r: Renderer): void {
    const key = keyLabel(this.opts.bindings.action, true);
    const w = 340;
    const x = r.bufW / 2 - w / 2;
    const y = r.bufH / 2 - 76;
    r.panel(x, y, w, 152, { fill: "rgba(5,10,20,0.94)", accent: "#facc15" });
    const shove = Math.min(3, Math.max(1, this.scrumPhase));
    r.text(`SCRUM – SHOVE ${shove} OF 3`, r.bufW / 2, y + 10, { align: "center", size: 11, color: "#facc15" });
    r.text(`PRESS ${key} ON THE GREEN`, r.bufW / 2, y + 28, { align: "center", size: 7, color: "#cbd5e1" });

    // timing bar
    const bx = x + 24;
    const bw = w - 48;
    const by = y + 48;
    r.rect(bx, by, bw, 18, "#0b1020");
    r.rect(bx, by, bw, 1, "#334155");
    r.rect(bx, by + 17, bw, 1, "#334155");
    // sweet spot
    const sw = Math.max(6, bw * this.scrumHalfWidth * 2);
    const sx = bx + bw * this.scrumTarget - sw / 2;
    r.rect(sx, by + 1, sw, 16, "rgba(34,197,94,0.35)");
    // perfect core
    const pw = Math.max(3, sw * 0.4);
    r.rect(bx + bw * this.scrumTarget - pw / 2, by + 1, pw, 16, "rgba(250,204,21,0.55)");
    // marker
    const mx = bx + bw * this.scrumMarker;
    r.rect(mx - 1, by - 3, 3, 24, "#f8fafc");

    // shove pips
    for (let i = 0; i < 3; i++) {
      const filled = i < this.scrumPhase - 1;
      r.rect(bx + i * 16, y + 78, 12, 5, filled ? "#22c55e" : "#334155");
    }
    r.text(`POWER ${Math.round(Math.max(0, this.scrumHits) / 3 * 100)}%`, x + w - 24, y + 76, { align: "right", size: 8, color: "#ffffff" });
    if (this.scrumFeedback) {
      const col = this.scrumFeedback.startsWith("PERFECT") ? "#facc15" : this.scrumFeedback.startsWith("GOOD") ? "#22c55e" : "#f87171";
      r.text(this.scrumFeedback, r.bufW / 2, y + 96, { align: "center", size: 10, color: col });
    }
    r.text("NAIL ALL THREE FOR A DOMINANT SCRUM", r.bufW / 2, y + 120, { align: "center", size: 7, color: "#94a3b8" });
    r.text("MISS AND YOUR PACK GOES BACKWARDS", r.bufW / 2, y + 134, { align: "center", size: 6, color: "#64748b" });
  }

  private drawStadiumPanLabel(r: Renderer): void {
    const s = this.stadium;
    const w = 310;
    const x = 18;
    const y = r.bufH - 72;
    r.panel(x, y, w, 42, { accent: s.accent });
    r.text(s.name.toUpperCase(), x + 12, y + 8, { size: 8, color: "#facc15" });
    r.text(`${s.city.toUpperCase()}, ${s.country.toUpperCase()} · ${s.capacity.toLocaleString("en-US")} CAPACITY`, x + 12, y + 24, { color: "#d1d5db" });
  }

  private drawAnthemCard(r: Renderer, team: 0 | 1): void {
    const data = this.engine.teams[team].data;
    const x = r.bufW / 2 - 145;
    const y = r.bufH - 62;
    r.panel(x, y, 290, 28, { accent: this.engine.teams[team].color });
    r.text(`PLEASE STAND FOR ${data.country.toUpperCase()}`, r.bufW / 2, y + 7, { align: "center", size: 8, color: "#facc15" });
    r.text("NATIONAL ANTHEM", r.bufW / 2, y + 18, { align: "center", color: "#ffffff" });
  }

  private drawMatchupCard(r: Renderer, progress: number): void {
    const e = this.engine;
    const k = easeOut(progress);
    const w = 380;
    const h = 96;
    const x = Math.round(r.bufW / 2 - w / 2);
    const y = Math.round(r.bufH / 2 - h / 2 + (1 - k) * 24);
    r.panel(x, y, w, h, { fill: "rgba(8,12,24,0.92)" });
    r.rect(x, y, w, 3, e.teams[0].color);
    r.rect(x, y + h - 3, w, 3, e.teams[1].color);
    r.text(this.opts.competition.toUpperCase(), r.bufW / 2, y + 12, { align: "center", color: "#94a3b8" });
    const home = e.teams[0].data;
    const away = e.teams[1].data;
    r.rect(x + 40, y + 32, 40, 28, e.teams[0].color);
    r.rect(x + w - 80, y + 32, 40, 28, e.teams[1].color);
    r.text(home.short, x + 60, y + 42, { size: 8, align: "center", color: lum(e.teams[0].color) > 0.6 ? "#111" : "#fff", shadow: false });
    r.text(away.short, x + w - 60, y + 42, { size: 8, align: "center", color: lum(e.teams[1].color) > 0.6 ? "#111" : "#fff", shadow: false });
    r.text("VS", r.bufW / 2, y + 40, { size: 16, align: "center", color: "#facc15" });
    r.text(home.name.toUpperCase().slice(0, 14), x + 60, y + 66, { align: "center" });
    r.text(away.name.toUpperCase().slice(0, 14), x + w - 60, y + 66, { align: "center" });
    r.text(`OVR ${home.rating}`, x + 60, y + 78, { align: "center", color: "#94a3b8" });
    r.text(`OVR ${away.rating}`, x + w - 60, y + 78, { align: "center", color: "#94a3b8" });
  }

  private teamLine(): string {
    const e = this.engine;
    return `${e.teams[0].data.name.toUpperCase()} V ${e.teams[1].data.name.toUpperCase()}`;
  }

  private drawIntro(r: Renderer): void {
    const s = this.stadium;
    const e = this.engine;
    const skipKey = keyLabel(this.opts.bindings.action, true);
    if (this.t < 5) {
      const k = easeOut(clamp((this.t - 0.5) / 0.7, 0, 1));
      const w = 330;
      const x = Math.round(-w + (w + 10) * k);
      const y = r.bufH - 76;
      r.panel(x, y, w, 40, { accent: s.accent });
      const name = s.name.toUpperCase();
      r.text(name, x + 12, y + 8, { size: name.length * 8 <= 300 ? 8 : 8, color: "#facc15" });
      r.text(`${s.city.toUpperCase()}, ${s.country.toUpperCase()}  ${s.capacity.toLocaleString("en-US")} SEATS`, x + 12, y + 24, { color: "#cbd5e1" });
    } else {
      const k = easeOut(clamp((this.t - 5) / 0.5, 0, 1));
      const w = 380;
      const h = 96;
      const x = Math.round(r.bufW / 2 - w / 2);
      const y = Math.round(r.bufH / 2 - h / 2 + (1 - k) * 30);
      r.panel(x, y, w, h, { fill: "rgba(8,12,24,0.92)" });
      r.rect(x, y, w, 3, e.teams[0].color);
      r.rect(x, y + h - 3, w, 3, e.teams[1].color);
      r.text(this.opts.competition.toUpperCase(), r.bufW / 2, y + 12, { align: "center", color: "#94a3b8" });
      const home = e.teams[0].data;
      const away = e.teams[1].data;
      r.rect(x + 40, y + 32, 40, 28, e.teams[0].color);
      r.rect(x + w - 80, y + 32, 40, 28, e.teams[1].color);
      r.text(home.short, x + 60, y + 42, { size: 8, align: "center", color: lum(e.teams[0].color) > 0.6 ? "#111" : "#fff", shadow: false });
      r.text(away.short, x + w - 60, y + 42, { size: 8, align: "center", color: lum(e.teams[1].color) > 0.6 ? "#111" : "#fff", shadow: false });
      r.text("VS", r.bufW / 2, y + 40, { size: 16, align: "center", color: "#facc15" });
      r.text(home.name.toUpperCase().slice(0, 14), x + 60, y + 66, { align: "center" });
      r.text(away.name.toUpperCase().slice(0, 14), x + w - 60, y + 66, { align: "center" });
      r.text(`OVR ${home.rating}`, x + 60, y + 78, { align: "center", color: "#94a3b8" });
      r.text(`OVR ${away.rating}`, x + w - 60, y + 78, { align: "center", color: "#94a3b8" });
    }
    if (!this.opts.attract && Math.floor(this.t * 2) % 2 === 0) {
      r.text(`PRESS ${skipKey} TO SKIP`, r.bufW - 8, 10, { align: "right", color: "#94a3b8" });
    }
  }

  private drawTry(r: Renderer): void {
    const e = this.engine;
    const scorer = e.tryScorer !== null ? e.players[e.tryScorer] : null;
    if (!scorer) return;
    const k = easeOut(clamp(this.t / 0.35, 0, 1));
    const color = e.teams[scorer.team].color;
    r.text("TRY!", r.bufW / 2, 40 - (1 - k) * 20, { size: 32, align: "center", color: "#facc15" });
    const w = 260;
    const x = Math.round(r.bufW / 2 - w / 2);
    const y = r.bufH - 74;
    r.panel(x, y, w, 36, { accent: color });
    r.text(scorer.name.toUpperCase().slice(0, 22), x + 12, y + 7, { color: "#fff" });
    r.text(`${e.teams[scorer.team].data.name.toUpperCase().slice(0, 18)}  +5`, x + 12, y + 21, { color: "#cbd5e1" });
    r.text(`${e.score[0]} - ${e.score[1]}`, x + w - 12, y + 12, { size: 16, align: "right", color: "#fde68a" });
  }

  private drawReplay(r: Renderer): void {
    const blink = Math.floor(this.t * 2) % 2 === 0;
    r.panel(r.bufW - 96, 34, 90, 16);
    if (blink) r.rect(r.bufW - 90, 39, 6, 6, "#ef4444");
    r.text("REPLAY", r.bufW - 80, 38, { color: "#fff" });
    r.text("SLOW-MO 0.5X", 8, 38, { color: "#94a3b8" });
    if (!this.opts.attract) r.text(`${keyLabel(this.opts.bindings.action, true)} SKIP`, 8, r.bufH - 40, { color: "#64748b" });
  }

  /** Broadcast-style team comparison with bars that grow in over the first second. */
  private drawStatsBoard(r: Renderer, title: string, tt: number): void {
    const e = this.engine;
    const a = e.teamStats[0];
    const b = e.teamStats[1];
    const grow = easeOut(clamp(tt / 0.9, 0, 1));
    const w = 500;
    const h = 232;
    const x = Math.round(r.bufW / 2 - w / 2);
    const y = Math.round(r.bufH / 2 - h / 2);
    r.panel(x, y, w, h, { fill: "rgba(5,8,18,0.94)" });
    r.rect(x, y, w, 3, "#facc15");
    r.text(title, r.bufW / 2, y + 10, { size: 12, align: "center", color: "#facc15" });

    // header: crests as colour blocks + score
    r.rect(x + 18, y + 30, 10, 18, e.teams[0].color);
    r.rect(x + w - 28, y + 30, 10, 18, e.teams[1].color);
    r.text(e.teams[0].data.short, x + 34, y + 35, { size: 9, color: "#ffffff" });
    r.text(e.teams[1].data.short, x + w - 34, y + 35, { size: 9, align: "right", color: "#ffffff" });
    r.text(`${e.score[0]}  -  ${e.score[1]}`, r.bufW / 2, y + 33, { size: 13, align: "center", color: "#ffffff" });

    const possTot = Math.max(1, a.possessionSeconds + b.possessionSeconds);
    const terrTot = Math.max(1, a.territorySeconds + b.territorySeconds);
    const rows: [string, number, number, boolean][] = [
      ["POSSESSION", Math.round((a.possessionSeconds / possTot) * 100), Math.round((b.possessionSeconds / possTot) * 100), true],
      ["TERRITORY", Math.round((a.territorySeconds / terrTot) * 100), Math.round((b.territorySeconds / terrTot) * 100), true],
      ["TRIES", a.tries, b.tries, false],
      ["METRES MADE", Math.round(a.metresMade), Math.round(b.metresMade), false],
      ["LINE BREAKS", a.lineBreaks, b.lineBreaks, false],
      ["TACKLES", a.tackles, b.tackles, false],
      ["PASSES", a.passes, b.passes, false],
      ["SCRUMS WON", a.scrumsWon, b.scrumsWon, false],
      ["LINEOUTS WON", a.lineoutsWon, b.lineoutsWon, false],
      ["PENALTIES", a.penalties, b.penalties, false],
    ];
    const rowH = 17;
    const top = y + 56;
    const barW = 150;
    const mid = r.bufW / 2;
    rows.forEach(([label, va, vb, pct], i) => {
      const ry = top + i * rowH;
      const tot = pct ? 100 : Math.max(1, va + vb);
      const fa = (va / tot) * grow;
      const fb = (vb / tot) * grow;
      // values
      r.text(pct ? `${va}%` : String(va), mid - barW - 10, ry + 4, { size: 8, align: "right", color: va >= vb ? "#ffffff" : "#94a3b8" });
      r.text(pct ? `${vb}%` : String(vb), mid + barW + 10, ry + 4, { size: 8, color: vb >= va ? "#ffffff" : "#94a3b8" });
      // bars grow outward from the centre
      r.rect(mid - barW, ry + 5, barW, 6, "rgba(255,255,255,0.08)");
      r.rect(mid, ry + 5, barW, 6, "rgba(255,255,255,0.08)");
      r.rect(mid - Math.round(barW * fa), ry + 5, Math.round(barW * fa), 6, e.teams[0].color);
      r.rect(mid, ry + 5, Math.round(barW * fb), 6, e.teams[1].color);
      // label over the centre seam
      r.rect(mid - 42, ry + 3, 84, 10, "rgba(5,8,18,0.95)");
      r.text(label, mid, ry + 4, { size: 6, align: "center", color: "#cbd5e1" });
    });
    if (!this.opts.attract && Math.floor(this.t * 2) % 2 === 0) {
      r.text(`PRESS ${keyLabel(this.opts.bindings.action, true)} TO CONTINUE`, r.bufW / 2, y + h - 14, { align: "center", size: 7, color: "#94a3b8" });
    }
  }

  private drawScoreCard(r: Renderer, title: string): void {
    const e = this.engine;
    const k = easeOut(clamp(this.t / 0.5, 0, 1));
    const w = 420;
    const h = 96;
    const x = Math.round(r.bufW / 2 - w / 2);
    const y = Math.round(r.bufH / 2 - h / 2 + (1 - k) * 30);
    r.panel(x, y, w, h, { fill: "rgba(8,12,24,0.92)" });
    r.rect(x, y, w, 3, "#facc15");
    r.text(title, r.bufW / 2, y + 12, { size: 16, align: "center", color: "#facc15" });
    r.rect(x + 24, y + 42, 12, 22, e.teams[0].color);
    r.rect(x + w - 36, y + 42, 12, 22, e.teams[1].color);
    r.text(`${e.teams[0].data.short} ${e.score[0]} - ${e.score[1]} ${e.teams[1].data.short}`, r.bufW / 2, y + 44, { size: 16, align: "center" });
    r.text(`TRIES ${e.tries[0]} - ${e.tries[1]}   ${e.teams[0].data.name.toUpperCase().slice(0, 12)} V ${e.teams[1].data.name.toUpperCase().slice(0, 12)}`, r.bufW / 2, y + 70, { align: "center", color: "#94a3b8" });
    if (!this.opts.attract && title === "FULL TIME" && Math.floor(this.t * 2) % 2 === 0) {
      r.text(`PRESS ${keyLabel(this.opts.bindings.action, true)} TO CONTINUE`, r.bufW / 2, y + h + 8, { align: "center", color: "#cbd5e1" });
    }
    if (this.opts.attract) r.text(this.teamLine(), r.bufW / 2, y + h + 8, { align: "center", color: "#475569" });
  }
}

function lum(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
