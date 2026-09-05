import type { RugbyEngine } from "./engine";
import { keyLabel, type Bindings } from "./controls";
import type { FrameOptions, PlayerVisual, Renderer, Snapshot } from "./render";
import type { Stadium, Vec2 } from "./types";

export type Scene = "intro" | "live" | "try" | "replay" | "halftime" | "fulltime";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const REPLAY_SPEED = 0.5;
const REPLAY_LENGTH = 4.2;
const RING_SECONDS = 10;

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

  update(dt: number, skip: boolean, paused: boolean): FrameOptions {
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
        if (this.t >= this.introLength || (skip && !this.opts.attract)) this.scene = "live";
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
      case "live":
        f.stepEngine = true;
        f.zoom = 1;
        break;
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
        f.drawOverlay = (r) => this.drawTry(r);
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
        f.drawOverlay = (r) => this.drawReplay(r);
        if (this.replayT >= this.replayEnd || (skip && !this.opts.attract)) this.endReplay();
        break;
      }
      case "halftime":
      case "fulltime": {
        const k = clamp(this.t / 6, 0, 1);
        f.camTarget = { x: lerp(25, 95, k), y: 35 + Math.sin(this.t * 0.6) * 6 };
        f.freeCam = true;
        f.camSpeed = 2.5;
        f.hideHUD = true;
        f.letterbox = 1;
        f.frozen = true;
        if (this.scene === "fulltime") {
          this.flash = Math.max(this.flash, 0.6);
          f.flash = this.flash;
        }
        f.drawOverlay = (r) => this.drawScoreCard(r, this.scene === "halftime" ? "HALF TIME" : "FULL TIME");
        const length = this.scene === "halftime" ? 4.5 : 5.5;
        if (this.t > length || (skip && this.t > 0.6 && !this.opts.attract)) {
          if (this.scene === "halftime") {
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
