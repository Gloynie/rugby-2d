import { L, W, RugbyEngine } from "./engine";
import { DEFAULT_BINDINGS, keyLabel, type Bindings } from "./controls";
import {
  ANCHOR_X, FOOT_Y, LIE_S, SPR_H, SPR_W, hashStr, shade, spriteFactory, teamLooks,
  type Look, type Pose, type View,
} from "./sprites";
import type { Stadium, TeamIndex, Vec2 } from "./types";

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const LOW_W = 640;
export const LOW_H = 360;
export const BASE_PPM = 8;
export const PIXEL_FONT = '"PressStart2P", "Courier New", monospace';

export interface PlayerVisual {
  id: number;
  team: TeamIndex;
  x: number;
  y: number;
  view: View;
  mirror: boolean;
  pose: Pose;
  frame: number;
  lie: number;
  hasBall: boolean;
}

export interface BallVisual {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  kick: boolean;
  carried: boolean;
}

export interface Snapshot {
  t: number;
  players: PlayerVisual[];
  ball: BallVisual;
  focus: Vec2;
}

export type CeremonyStage = "pan" | "walkout" | "lineup" | "huddle" | "positions";

export interface FrameOptions {
  stepEngine: boolean;
  frozen: boolean;
  /** Any positive zoom: intro flyovers use a wide stadium view, live play uses 1x/2x. */
  zoom: number;
  camTarget?: Vec2;
  freeCam?: boolean;
  snapCam?: boolean;
  camSpeed?: number;
  hideHUD: boolean;
  letterbox: number;
  flash: number;
  /** Opening cinematic exterior view: 0 (begin) to 1 (end of the slow camera sweep). */
  establishing?: number;
  /** Hides the live match entities and renders only the pre-match presentation squad. */
  ceremony?: { stage: CeremonyStage; progress: number; anthemTeam?: TeamIndex };
  snapshot?: Snapshot;
  celebrate?: { team: TeamIndex; pos: Vec2 };
  drawOverlay?: (r: Renderer) => void;
}

// Normal gameplay camera. Stadium-wide views are reserved for the short pre-match establishing shot.
export const LIVE_FRAME: FrameOptions = { stepEngine: true, frozen: false, zoom: 1, hideHUD: false, letterbox: 0, flash: 0 };

interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const hyp = (x: number, y: number) => Math.sqrt(x * x + y * y);
const mod = (a: number, n: number) => ((a % n) + n) % n;

function makeCrowdTile(s: Stadium, frame: number): HTMLCanvasElement {
  const tile = document.createElement("canvas");
  tile.width = 32;
  tile.height = 32;
  const c = tile.getContext("2d");
  if (!c) return tile;
  c.fillStyle = s.night ? shade(s.stand, 0.55) : s.stand;
  c.fillRect(0, 0, 32, 32);
  let seed = hashStr(s.id) ^ 0x9e3779b9;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const cols = [s.accent, "#e5e7eb", "#111827", "#6b7280", s.accent, "#f3f4f6", "#374151", "#b91c1c", "#1d4ed8", "#facc15"];
  for (let y = 0; y < 32; y += 4) {
    for (let x = 0; x < 32; x += 3) {
      const skip = rnd() < 0.12;
      const col = cols[Math.floor(rnd() * cols.length)];
      const r = rnd();
      const jx = rnd() < 0.5 ? 0 : 1;
      if (skip) continue;
      const bob = frame === 1 && r < 0.5 ? -1 : 0;
      c.fillStyle = col;
      c.fillRect(x + jx, y + 1 + bob, 2, 2);
      c.fillStyle = "rgba(0,0,0,0.35)";
      c.fillRect(x, y + 3, 3, 1);
    }
  }
  return tile;
}

const BALL_T: Record<string, string[]> = {
  h: [" ##### ", "##WWW##", "#######", " ##### "],
  v: [" ## ", "####", "#W##", "#W##", "#W##", "####", " ## "],
  d1: ["   ###", "  ####", " #W###", "###W# ", "####  ", "###   "],
  d2: ["###   ", "####  ", "###W# ", " #W###", "  ####", "   ###"],
};

function makeBall(t: string[]): HTMLCanvasElement {
  const w = t[0].length + 2;
  const h = t.length + 2;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  for (let y = 0; y < t.length; y++) {
    for (let x = 0; x < t[y].length; x++) {
      const ch = t[y][x];
      if (ch === " ") continue;
      ctx.fillStyle = ch === "W" ? "#fde68a" : "#b45309";
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
        d[i * 4] = 40; d[i * 4 + 1] = 20; d[i * 4 + 2] = 5; d[i * 4 + 3] = 255;
      }
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

export class Renderer {
  readonly bufW: number;
  readonly bufH: number;
  private ctx: CanvasRenderingContext2D;
  private buf: HTMLCanvasElement;
  private b: CanvasRenderingContext2D;
  private stadium: Stadium;
  private looks: [Look[], Look[]] = [[], []];
  private crowd: CanvasPattern[] = [];
  private balls: Record<string, HTMLCanvasElement> = {};
  private phase: number[] = [];
  private dust: Dust[] = [];
  private prevPhase = "";
  private basePpm: number;
  cam: Vec2 = { x: 60, y: 35 };
  zoom = 1;
  now = 0;
  showHelp = true;
  bindings: Bindings;
  lastSnapshot: Snapshot | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    stadium: Stadium,
    engine: RugbyEngine | null,
    bindings: Bindings = DEFAULT_BINDINGS,
    opts: { bufW?: number; bufH?: number; ppm?: number } = {},
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.stadium = stadium;
    this.bindings = bindings;
    this.bufW = opts.bufW ?? LOW_W;
    this.bufH = opts.bufH ?? LOW_H;
    this.basePpm = opts.ppm ?? BASE_PPM;
    this.buf = document.createElement("canvas");
    this.buf.width = this.bufW;
    this.buf.height = this.bufH;
    const b = this.buf.getContext("2d");
    if (!b) throw new Error("2d context unavailable");
    this.b = b;
    b.imageSmoothingEnabled = false;
    if (engine) {
      for (const t of [0, 1] as TeamIndex[]) {
        const tr = engine.teams[t];
        const j2 = tr.color === tr.data.primary ? tr.data.secondary : tr.data.primary;
        this.looks[t] = teamLooks(tr.data.id, tr.data.players, tr.color, j2);
      }
      this.phase = engine.players.map(() => Math.random() * 6);
    }
    for (const f of [0, 1]) {
      const pat = b.createPattern(makeCrowdTile(stadium, f), "repeat");
      if (pat) this.crowd.push(pat);
    }
    for (const k of Object.keys(BALL_T)) this.balls[k] = makeBall(BALL_T[k]);
  }

  get ppm(): number {
    return this.basePpm * this.zoom;
  }
  sx(x: number): number {
    return Math.round((x - this.cam.x) * this.ppm + this.bufW / 2);
  }
  sy(y: number): number {
    return Math.round((y - this.cam.y) * this.ppm + this.bufH / 2);
  }
  sw(m: number): number {
    return Math.round(m * this.ppm);
  }

  // ---------- visuals ----------
  computeVisuals(m: RugbyEngine, animDt: number, frozen: boolean, cel?: { team: TeamIndex; pos: Vec2 }): Snapshot {
    const players: PlayerVisual[] = m.players.filter((p) => p.isOnField).map((p) => {
      const speed = frozen ? 0 : hyp(p.vel.x, p.vel.y);
      this.phase[p.id] = (this.phase[p.id] ?? 0) + speed * animDt * 1.9;
      const animActive = p.anim !== "none" && m.time < p.animUntil;
      const inRuck = !!m.ruck && m.ruck.joined[p.team].has(p.id);
      const scrumBind = m.phase === "scrum" && p.isForward;
      let facing = p.facing;
      let pose: Pose = "idle";
      let frame = 0;
      let lie = -1;
      if (p.down > 0) {
        pose = p.anim === "dive" || p.anim === "tackle" ? "dive" : "lie";
        lie = mod(Math.round(((facing * 180) / Math.PI + 90) / 90) * 90, 360);
      } else if (cel && p.team === cel.team && hyp(p.pos.x - cel.pos.x, p.pos.y - cel.pos.y) < 18) {
        pose = "celebrate";
        frame = Math.floor(this.now * 4 + p.id) % 2;
      } else if (animActive && p.anim === "celebrate") {
        pose = "celebrate";
        frame = Math.floor(this.now * 4) % 2;
      } else if (animActive && p.anim === "pass") pose = "pass";
      else if (animActive && p.anim === "kick") pose = "kick";
      else if (inRuck || scrumBind) {
        pose = "bind";
        if (inRuck && m.ruck) facing = Math.atan2(m.ruck.y - p.pos.y, m.ruck.x - p.pos.x);
      } else if (speed > 0.6) {
        pose = "run";
        frame = Math.floor(this.phase[p.id]) % 6;
      } else {
        pose = "idle";
        frame = Math.floor(this.now * 1.5 + p.id * 0.37) % 2;
      }
      const dx = Math.cos(facing);
      const dy = Math.sin(facing);
      const view: View = Math.abs(dx) >= 0.5 ? "side" : dy > 0 ? "front" : "back";
      return {
        id: p.id, team: p.team, x: p.pos.x, y: p.pos.y, view, mirror: view === "side" && dx < 0,
        pose, frame, lie, hasBall: m.ball.carrier === p.id,
      };
    });
    const b = m.ball;
    return {
      t: 0,
      players,
      ball: { x: b.pos.x, y: b.pos.y, z: b.pos.z, vx: b.vel.x, vy: b.vel.y, kick: b.flight === "kick", carried: b.carrier !== null },
      focus: { x: b.pos.x, y: b.pos.y },
    };
  }

  // ---------- main ----------
  render(m: RugbyEngine, dt: number, f: FrameOptions): void {
    this.now += dt;
    const opts = f;
    // Every director shot eases its focal length instead of snapping between zoom values.
    const targetZoom = clamp(f.zoom, 0.35, 2);
    const zoomRate = f.ceremony ? 4.4 : f.snapshot ? 9 : 7;
    const zoomEase = 1 - Math.exp(-Math.max(0, dt) * zoomRate);
    this.zoom += (targetZoom - this.zoom) * zoomEase;
    if (opts.establishing !== undefined) {
      this.drawEstablishingShot(opts.establishing);
      if (opts.letterbox > 0) this.drawLetterbox(opts.letterbox);
      opts.drawOverlay?.(this);
      this.blit();
      return;
    }
    const snap = opts.snapshot ?? this.computeVisuals(m, opts.frozen ? 0 : dt, opts.frozen, opts.celebrate);
    if (!opts.snapshot) this.lastSnapshot = snap;
    this.updateCamera(m, snap, dt, opts);
    const b = this.b;
    b.clearRect(0, 0, this.bufW, this.bufH);
    this.drawStadium(opts.flash);
    this.drawPitch();
    if (opts.ceremony) {
      this.drawCeremony(m, opts.ceremony.stage, opts.ceremony.progress, opts.ceremony.anthemTeam);
    } else {
      if (!opts.snapshot) this.drawRuck(m);
      this.drawEntities(m, snap, opts);
      this.updateEffects(m, dt, opts.frozen || !!opts.snapshot);
    }
    if (!opts.hideHUD) this.drawHUD(m);
    if (opts.letterbox > 0) this.drawLetterbox(opts.letterbox);
    opts.drawOverlay?.(this);
    this.blit();
  }

  /**
   * Pre-match presentation layer: player walkouts for every fixture, then flag/anthem lineup
   * for international matches. It is deliberately drawn in screen space so the ceremony reads
   * clearly regardless of the gameplay camera.
   */
  /**
   * Match presentation with no duplicate live players. The normal engine squad remains hidden
   * until ceremony finishes; these are the only people rendered on the grass during walkout.
   */
  drawCeremony(m: RugbyEngine, stage: CeremonyStage, progress: number, anthemTeam?: TeamIndex): void {
    const b = this.b;
    const squads: [typeof m.players, typeof m.players] = [
      m.players.filter((p) => p.team === 0 && p.isOnField).sort((a, q) => a.number - q.number),
      m.players.filter((p) => p.team === 1 && p.isOnField).sort((a, q) => a.number - q.number),
    ];
    const drawPlayer = (team: TeamIndex, index: number, x: number, y: number, pose: Pose, view: View, dim = false) => {
      const p = squads[team][index];
      if (!p) return;
      const look = this.looks[team][Math.max(0, p.number - 1)] ?? this.looks[team][index];
      if (!look) return;
      const frames = pose === "run" ? 6 : pose === "celebrate" ? 2 : 2;
      const frame = Math.floor(this.now * (pose === "run" ? 8 : 2) + index) % frames;
      const sprite = spriteFactory().get(look, view, pose, frame, view === "side" && team === 1, -1);
      b.save();
      if (dim) b.globalAlpha = 0.42;
      b.fillStyle = "rgba(0,0,0,0.28)";
      b.fillRect(Math.round(x - 5), Math.round(y - 1), 10, 2);
      b.drawImage(sprite, Math.round(x - 8), Math.round(y - 22), 16, 22);
      b.restore();
    };
    const drawOfficial = (x: number, y: number, index: number) => {
      const sprite = spriteFactory().get(this.officialsLook, "front", "idle", Math.floor(this.now * 2 + index) % 2, false, -1);
      b.fillStyle = "rgba(0,0,0,0.28)";
      b.fillRect(x - 5, y - 1, 10, 2);
      b.drawImage(sprite, x - 8, y - 22, 16, 22);
    };
    // Ceremony line: both XVs stand shoulder-to-shoulder horizontally across the lower-middle
    // of the pitch. Home occupy the left, the three officials are in the central gap, away right.
    const lineupPoint = (team: TeamIndex, index: number) => ({
      x: team === 0 ? 52 + index * 15 : 378 + index * 15,
      y: 248,
    });
    const huddlePoint = (team: TeamIndex, index: number) => {
      const a = (index / 15) * Math.PI * 2 - Math.PI / 2;
      const cx = team === 0 ? 215 : 425;
      return { x: cx + Math.cos(a) * 29, y: 229 + Math.sin(a) * 18 };
    };
    const kickoffPoint = (team: TeamIndex, index: number) => {
      const p = squads[team][index];
      // Engine players are already waiting in genuine kickoff positions; map those world coords
      // onto this presentation pitch for the final transition into live play.
      return p ? { x: 58 + (p.pos.x / L) * 524, y: 108 + (p.pos.y / W) * 188 } : { x: 320, y: 230 };
    };

    if (stage === "pan") {
      b.fillStyle = "rgba(3,7,18,0.08)";
      b.fillRect(0, 0, this.bufW, this.bufH);
      return;
    }

    // Tunnel: central, lower edge of the screen, as requested.
    b.fillStyle = "#080d16";
    b.fillRect(282, 318, 76, 42);
    b.fillStyle = "#1e293b";
    b.fillRect(288, 323, 64, 37);
    b.fillStyle = "#facc15";
    b.fillRect(288, 323, 64, 3);
    b.fillStyle = "rgba(0,0,0,0.38)";
    b.fillRect(0, 0, this.bufW, this.bufH);

    if (stage === "walkout") {
      // Players emerge from one bottom-centre tunnel and run toward the lower middle of the field.
      const order = [...Array(15).keys()];
      for (const team of [0, 1] as TeamIndex[]) {
        for (const i of order) {
          const startX = 320 + (team === 0 ? -4 : 4) + ((i % 3) - 1) * 3;
          const startY = 354 + Math.floor(i / 3) * 3;
          const arrive = clamp(progress * 1.35 - i * 0.052, 0, 1);
          const slot = lineupPoint(team, i);
          const x = startX + (slot.x - startX) * arrive;
          const y = startY + (slot.y - startY) * arrive;
          drawPlayer(team, i, x, y, "run", "back");
        }
      }
      this.panel(this.bufW / 2 - 150, 84, 300, 33, { fill: "rgba(5,10,20,0.92)", accent: "#facc15" });
      this.text("TEAMS WALKING OUT", this.bufW / 2, 93, { size: 10, align: "center", color: "#ffffff" });
      this.text(`${m.teams[0].data.name.toUpperCase()}  V  ${m.teams[1].data.name.toUpperCase()}`, this.bufW / 2, 108, { align: "center", color: "#cbd5e1" });
      return;
    }

    if (stage === "lineup") {
      // Home left, referees in centre, away right. All players face the grandstand/crowd.
      for (let i = 0; i < 15; i++) {
        drawPlayer(0, i, lineupPoint(0, i).x, lineupPoint(0, i).y, "idle", "back", anthemTeam !== undefined && anthemTeam !== 0);
        drawPlayer(1, i, lineupPoint(1, i).x, lineupPoint(1, i).y, "idle", "back", anthemTeam !== undefined && anthemTeam !== 1);
      }
      // Officials stand side-by-side at the centre of the same horizontal presentation line.
      drawOfficial(294, 248, 0);
      drawOfficial(320, 248, 1);
      drawOfficial(346, 248, 2);
      this.text(m.teams[0].data.short, 157, 221, { size: 8, align: "center", color: m.teams[0].color });
      this.text("OFFICIALS", 320, 221, { size: 7, align: "center", color: "#4ade80" });
      this.text(m.teams[1].data.short, 483, 221, { size: 8, align: "center", color: m.teams[1].color });
      return;
    }

    if (stage === "huddle" || stage === "positions") {
      const k = stage === "positions" ? clamp(progress, 0, 1) : 0;
      for (const team of [0, 1] as TeamIndex[]) {
        for (let i = 0; i < 15; i++) {
          const from = huddlePoint(team, i);
          const to = kickoffPoint(team, i);
          const x = from.x + (to.x - from.x) * k;
          const y = from.y + (to.y - from.y) * k;
          drawPlayer(team, i, x, y, stage === "huddle" ? "idle" : "run", stage === "huddle" ? "front" : "side");
        }
      }
      if (stage === "huddle") {
        this.panel(228, 82, 184, 27, { fill: "rgba(5,10,20,0.92)", accent: "#facc15" });
        this.text("FINAL TEAM HUDDLES", 320, 90, { size: 8, align: "center", color: "#ffffff" });
      } else {
        this.text("TAKING POSITIONS", 320, 92, { size: 8, align: "center", color: "#facc15" });
      }
    }
  }

  /** Static stadium view (menus / thumbnails). */
  renderStatic(cam: Vec2, zoom = 1): void {
    this.cam = { ...cam };
    this.zoom = zoom;
    this.b.clearRect(0, 0, this.bufW, this.bufH);
    this.drawStadium(0);
    this.drawPitch();
    this.blit();
  }

  private blit(): void {
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    c.drawImage(this.buf, 0, 0, c.canvas.width, c.canvas.height);
  }

  private updateCamera(m: RugbyEngine, snap: Snapshot, dt: number, f: FrameOptions): void {
    let tx: number;
    let ty: number;
    if (f.camTarget) {
      tx = f.camTarget.x;
      ty = f.camTarget.y;
    } else {
      const b = snap.ball;
      tx = b.x;
      ty = b.y;
      if (!f.snapshot) {
        if (m.phase === "goalKick" && m.goalKick && !m.goalKick.launched) {
          tx = (m.goalKick.x + m.wx(m.goalKick.team, 110)) / 2;
          ty = (m.goalKick.y + 35) / 2;
        } else if (m.ball.carrier === null && m.ball.flight !== "none" && m.ball.target) {
          tx = (b.x + m.ball.target.x) / 2;
          ty = (b.y + m.ball.target.y) / 2;
        } else if (m.ball.carrier !== null) {
          tx += m.teams[m.players[m.ball.carrier].team].dir * 5;
        }
      }
    }
    if (!f.freeCam) {
      const halfW = this.bufW / 2 / this.ppm;
      const halfH = this.bufH / 2 / this.ppm;
      tx = clamp(tx, Math.min(60, halfW - 8), Math.max(60, L - halfW + 8));
      ty = clamp(ty, Math.min(35, halfH - 8), Math.max(35, W - halfH + 8));
    }
    if (f.snapCam) {
      this.cam.x = tx;
      this.cam.y = ty;
    } else {
      const k = 1 - Math.exp(-dt * (f.camSpeed ?? 4));
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }
  }

  // ---------- opening establishing shots ----------
  /**
   * Draw a full exterior pixel scene for the opening broadcast shot. Unlike the live camera,
   * this is deliberately side-on and wide enough to show a venue's roofline and surroundings.
   */
  private drawEstablishingShot(progress: number): void {
    const b = this.b;
    const s = this.stadium;
    const p = clamp(progress, 0, 1);
    b.clearRect(0, 0, this.bufW, this.bufH);
    // DHL Stadium is authored directly from the supplied aerial/interior reference: an oval
    // pale roof shell around an open bowl, yellow DHL fascia, dark seats and Table Mountain.
    if (s.blueprint === "dhl") {
      this.drawDhlAerialEstablishingShot(p);
      return;
    }
    const skyTop = s.night ? "#07111f" : "#70a8bf";
    const skyMid = s.night ? "#102844" : "#9fc6d1";
    const skyLow = s.night ? "#1d3b4d" : "#d1d8c5";
    const horizon = 230;
    const rect = (x: number, y: number, w: number, h: number, color: string) => {
      b.fillStyle = color;
      b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    // Flat colour bands preserve the pixel-art treatment while giving the sky depth.
    rect(0, 0, this.bufW, 88, skyTop);
    rect(0, 88, this.bufW, 78, skyMid);
    rect(0, 166, this.bufW, horizon - 166, skyLow);
    if (!s.night) {
      rect(520, 28, 14, 14, "#fff3b0");
      rect(523, 25, 8, 20, "#fff8ca");
    } else {
      for (let i = 0; i < 26; i++) {
        const x = (i * 71 + 19) % this.bufW;
        const y = 18 + ((i * 37) % 112);
        rect(x, y, i % 4 === 0 ? 2 : 1, 1, "#dbeafe");
      }
    }

    // Slow parallax: surroundings move more slowly than the stadium shell.
    const farPan = Math.round((0.5 - p) * 18);
    const nearPan = Math.round((0.5 - p) * 34);
    this.drawEstablishingLandmark(horizon, farPan);
    this.drawEstablishingCity(horizon, farPan);
    rect(0, horizon, this.bufW, 130, s.night ? "#162d28" : "#55765b");
    rect(0, horizon + 18, this.bufW, 4, s.night ? "#244c44" : "#7f9e70");
    this.drawEstablishingStadium(horizon + 63, nearPan);

    // Foreground road/plaza and tiny entry lights create depth during the aerial pull-in.
    rect(0, 306, this.bufW, 54, s.night ? "#111827" : "#66736d");
    rect(0, 310, this.bufW, 2, s.night ? "#334155" : "#d1d5db");
    for (let x = 12; x < this.bufW; x += 36) {
      rect(x, 322, 20, 2, s.night ? "#facc15" : "#e5e7eb");
      if (s.night) rect(x + 8, 300, 2, 7, "#fef3c7");
    }
  }

  /** DHL Stadium / Cape Town Stadium aerial shot based on the supplied reference imagery. */
  private drawDhlAerialEstablishingShot(progress: number): void {
    const b = this.b;
    const p = clamp(progress, 0, 1);
    const rect = (x: number, y: number, w: number, h: number, color: string) => {
      b.fillStyle = color;
      b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const oval = (cx: number, cy: number, rx: number, ry: number, color: string) => {
      b.fillStyle = color;
      for (let dy = -Math.round(ry); dy <= Math.round(ry); dy += 2) {
        const x = Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))) * rx;
        b.fillRect(Math.round(cx - x), Math.round(cy + dy), Math.round(x * 2), 2);
      }
    };
    // Cape Town sky, ocean, and a very broad flat Table Mountain. It remains behind the stadium.
    rect(0, 0, this.bufW, 104, "#8fc0d1");
    rect(0, 104, this.bufW, 91, "#c9d9cf");
    rect(0, 195, this.bufW, 42, "#4d897f");
    rect(0, 237, this.bufW, 123, "#429aad");
    const mountainBase = 226;
    const mountain = [18, 31, 48, 65, 84, 104, 121, 132, 136, 136, 136, 136, 136, 136, 136, 132, 121, 104, 84, 64, 47, 30, 18];
    const unit = this.bufW / mountain.length;
    mountain.forEach((h, i) => rect(i * unit, mountainBase - h, unit + 1, h, "#465e5b"));
    mountain.forEach((h, i) => { if (i >= 6 && i <= 16) rect(i * unit + 1, mountainBase - h, unit - 1, 4, "#91a6a0"); });
    rect(205, 85, 220, 5, "rgba(239,248,246,0.86)");
    rect(232, 80, 163, 5, "rgba(248,250,252,0.75)");
    // City blocks sit below the mountain on the stadium side of the water.
    for (let i = 0; i < 17; i++) {
      const x = 14 + i * 37;
      const h = 11 + ((i * 13) % 34);
      rect(x, 244 - h, 21 + ((i * 3) % 12), h, i % 3 ? "#687a76" : "#7f9089");
      rect(x + 4, 246 - h, 3, 2, "#d9e2d6");
    }
    // Stadium shadow and concentric oval building shell. It gets subtly closer during the shot.
    const zoom = 0.9 + p * 0.1;
    const cx = 323;
    const cy = 232;
    const rx = 235 * zoom;
    const ry = 98 * zoom;
    oval(cx + 4, cy + 10, rx + 7, ry + 7, "rgba(7,18,22,0.42)");
    oval(cx, cy, rx, ry, "#dfe9eb");                 // pale exterior roof
    oval(cx, cy, rx - 16, ry - 10, "#bdcbd0");      // roof inner shade
    oval(cx, cy, rx - 34, ry - 18, "#ffcc00");      // yellow DHL fascia
    oval(cx, cy, rx - 46, ry - 25, "#d40511");      // red fascia inner edge
    oval(cx, cy, rx - 53, ry - 30, "#17232a");      // open dark bowl
    oval(cx, cy, rx - 67, ry - 38, "#495762");      // seating ring
    oval(cx, cy, rx - 84, ry - 47, "#23303a");      // lower seating
    // Field is clearly inside the open roof, aligned long-axis like the aerial reference.
    rect(cx - 113, cy - 39, 226, 78, "#237b3d");
    for (let x = cx - 113; x < cx + 113; x += 16) rect(x, cy - 39, 8, 78, "#2d9148");
    rect(cx - 113, cy - 1, 226, 2, "rgba(255,255,255,0.85)");
    rect(cx - 1, cy - 39, 2, 78, "rgba(255,255,255,0.85)");
    // Four seating tiers and filled fan pixels around the field, constrained inside the bowl.
    for (let ring = 0; ring < 4; ring++) {
      const rrx = rx - 58 - ring * 9;
      const rry = ry - 33 - ring * 5;
      for (let i = 0; i < 100; i++) {
        const theta = (i / 100) * Math.PI * 2;
        const x = cx + Math.cos(theta) * rrx;
        const y = cy + Math.sin(theta) * rry;
        // Keep fans out of the physical field rectangle.
        if (Math.abs(x - cx) < 116 && Math.abs(y - cy) < 43) continue;
        rect(x, y, 3, 2, ["#d9e4ed", "#1d4ed8", "#111827", "#f8fafc", "#d40511"][((i + ring * 3) % 5)]);
      }
    }
    // Repeated sponsor fascia blocks, matching the yellow bands in the provided interior image.
    for (let i = 0; i < 10; i++) {
      const x = cx - 162 + i * 36;
      rect(x, cy - ry + 23, 25, 7, "#ffcc00");
      this.text("DHL", x + 12, cy - ry + 24, { align: "center", size: 5, color: "#d40511", shadow: false });
    }
    // Scoreboard/video screen on the bowl's right-hand side.
    rect(cx + rx - 55, cy - 31, 31, 24, "#111827");
    rect(cx + rx - 52, cy - 28, 25, 18, "#5ad3d0");
    rect(cx + rx - 48, cy - 24, 17, 3, "#facc15");
    // Foreground roof lip gives the view the same enclosed-bowl perspective as the interior photo.
    rect(0, 0, this.bufW, 15, "rgba(16,24,32,0.8)");
    rect(0, 15, this.bufW, 3, "#090d14");
  }

  /** Recognisable long-distance city/landmark silhouettes for the exterior view. */
  private drawEstablishingLandmark(horizon: number, pan: number): void {
    const b = this.b;
    const s = this.stadium;
    const rect = (x: number, y: number, w: number, h: number, color: string) => {
      b.fillStyle = color;
      b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const hill = (col: string, max = 58) => {
      for (let i = 0; i < 23; i++) {
        const x = pan - 20 + i * 31;
        const h = 16 + ((i * 23 + 11) % max);
        rect(x, horizon - h, 34, h, col);
      }
    };
    switch (s.landmark) {
      case "table-mountain": {
        // Cape Town's landmark: a broad, almost level summit with sharply descending shoulders.
        const peaks = [14, 22, 32, 47, 65, 83, 103, 117, 124, 126, 126, 126, 126, 126, 126, 126, 122, 114, 101, 84, 65, 48, 34, 22, 14];
        const bw = 27;
        const base = horizon + 21;
        peaks.forEach((h, i) => rect(pan - 20 + i * bw, base - h, bw + 1, h, "#38585a"));
        peaks.forEach((h, i) => {
          if (i >= 6 && i <= 18) rect(pan - 20 + i * bw + 2, base - h, bw - 2, 4, "#8da29e");
        });
        // Table cloth cloud over the flat summit.
        rect(205 + pan, base - 131, 230, 5, "rgba(236,246,241,0.82)");
        rect(230 + pan, base - 136, 174, 5, "rgba(248,250,252,0.75)");
        rect(270 + pan, base - 140, 90, 4, "rgba(248,250,252,0.65)");
        // Atlantic strip beyond the stadium.
        rect(0, base + 1, this.bufW, 22, s.night ? "#0c4252" : "#4096a7");
        rect(0, base + 5, this.bufW, 2, "rgba(226,247,250,0.6)");
        break;
      }
      case "rome-pines":
        hill(s.night ? "#17382f" : "#6d8061", 24);
        for (let x = 10 + pan; x < this.bufW; x += 40) {
          rect(x + 5, horizon - 47, 4, 47, "#5b4a3a");
          rect(x - 8, horizon - 62, 30, 16, "#315b3c");
          rect(x - 2, horizon - 72, 18, 15, "#396d47");
        }
        break;
      case "edinburgh-hills":
      case "dunedin-hills":
      case "exeter-hills":
      case "pretoria-hills":
      case "marseille-hills":
        hill(s.night ? "#173443" : "#607b63", 74);
        hill(s.night ? "#112937" : "#78906e", 43);
        break;
      case "northampton-park":
        hill(s.night ? "#193727" : "#638064", 25);
        for (let x = 14 + pan; x < this.bufW; x += 38) {
          rect(x, horizon - 31, 4, 31, "#604c39");
          rect(x - 9, horizon - 53, 22, 23, "#2e6b3d");
        }
        break;
      case "gloucester-rail":
        rect(0, horizon - 21, this.bufW, 3, "#334155");
        for (let x = 0; x < this.bufW; x += 28) rect(x + pan, horizon - 29, 3, 29, "#475569");
        break;
      case "auckland-skyline":
        rect(476 + pan, horizon - 87, 3, 87, "#e5e7eb");
        rect(470 + pan, horizon - 80, 15, 3, "#e5e7eb");
        break;
      case "sydney-olympic":
        rect(88 + pan, horizon - 79, 4, 79, "#e5e7eb");
        rect(81 + pan, horizon - 79, 20, 3, "#e5e7eb");
        break;
      default:
        break;
    }
  }

  private drawEstablishingCity(horizon: number, pan: number): void {
    const b = this.b;
    const s = this.stadium;
    const cityColor = s.night ? "#162e40" : "#728078";
    const cityLight = s.night ? "#fef3c7" : "#a8b1a6";
    for (let i = 0; i < 14; i++) {
      const w = 18 + ((i * 9) % 22);
      const h = 15 + ((i * 17) % 48);
      const x = ((i * 53 + 27 + pan) % (this.bufW + 60)) - 30;
      b.fillStyle = cityColor;
      b.fillRect(x, horizon - h, w, h);
      if (s.night) {
        b.fillStyle = cityLight;
        for (let yy = horizon - h + 7; yy < horizon - 3; yy += 8) b.fillRect(x + 4, yy, 2, 2);
      }
    }
  }

  /**
   * Pixel side elevation with a unique roofline for every named ground. The roof profile is
   * deliberately separate from the play-field renderer, so it remains visible in the wide intro.
   */
  private drawEstablishingStadium(baseY: number, pan: number): void {
    const b = this.b;
    const s = this.stadium;
    const x0 = 64 + pan;
    const width = 512;
    const bays = 16;
    const bayW = width / bays;
    const rect = (x: number, y: number, w: number, h: number, color: string) => {
      b.fillStyle = color;
      b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    type Profile = { roof: number[]; seat: string; shell: string; trim: string; sign: string; signBg: string; signFg: string; style: "box" | "wave" | "oval" | "canopy" | "sail" | "glass" | "terrace"; towers?: boolean; track?: boolean };
    const profiles: Record<string, Profile> = {
      "twickenham": { roof:[50,57,64,71,76,80,82,84,84,82,80,76,71,64,57,50], seat:"#a8b3bd", shell:"#313d4c", trim:"#e5e7eb", sign:"ALLIANZ STADIUM", signBg:"#e5e7eb", signFg:"#1d4ed8", style:"box" },
      "stade-de-france": { roof:[28,36,48,60,70,78,84,88,88,84,78,70,60,48,36,28], seat:"#8f9199", shell:"#343842", trim:"#f8fafc", sign:"STADE DE FRANCE", signBg:"#1e3a8a", signFg:"#ffffff", style:"oval", track:true },
      "aviva": { roof:[24,32,47,64,81,92,99,105,104,97,84,67,49,34,24,18], seat:"#d2e0e3", shell:"#94a7ad", trim:"#15803d", sign:"AVIVA STADIUM", signBg:"#15803d", signFg:"#ffffff", style:"wave" },
      "principality": { roof:[90,90,90,90,90,90,90,90,90,90,90,90,90,90,90,90], seat:"#57616e", shell:"#111827", trim:"#dc2626", sign:"PRINCIPALITY", signBg:"#dc2626", signFg:"#ffffff", style:"box" },
      "murrayfield": { roof:[25,31,38,48,64,78,88,94,94,88,78,64,48,38,31,25], seat:"#60748b", shell:"#263647", trim:"#dbeafe", sign:"MURRAYFIELD", signBg:"#1e293b", signFg:"#dbeafe", style:"terrace", towers:true },
      "olimpico": { roof:[20,27,35,43,50,55,59,62,62,59,55,50,43,35,27,20], seat:"#c2cbd1", shell:"#9ea9af", trim:"#38bdf8", sign:"STADIO OLIMPICO", signBg:"#38bdf8", signFg:"#ffffff", style:"oval", track:true },
      "eden-park": { roof:[38,50,62,73,82,88,91,93,93,91,88,82,73,62,50,38], seat:"#445061", shell:"#222a35", trim:"#ffffff", sign:"EDEN PARK", signBg:"#111111", signFg:"#ffffff", style:"box", towers:true },
      "ellis-park": { roof:[28,39,53,69,83,94,103,109,109,103,94,83,69,53,39,28], seat:"#777174", shell:"#37373d", trim:"#facc15", sign:"ELLIS PARK", signBg:"#166534", signFg:"#facc15", style:"oval", towers:true },
      "accor": { roof:[24,31,40,51,61,69,75,78,78,75,69,61,51,40,31,24], seat:"#d0d9df", shell:"#93a0aa", trim:"#eab308", sign:"ACCOR STADIUM", signBg:"#eab308", signFg:"#111827", style:"canopy", track:true },
      "amalfitani": { roof:[14,21,29,40,55,68,80,90,90,80,68,55,40,29,21,14], seat:"#a0a0a5", shell:"#55565d", trim:"#7dd3fc", sign:"VÉLEZ", signBg:"#7dd3fc", signFg:"#1e3a8a", style:"terrace" },
      "suncorp": { roof:[42,53,65,76,85,92,97,101,101,97,92,85,76,65,53,42], seat:"#cbd5db", shell:"#dce3e6", trim:"#7f1d1d", sign:"SUNCORP", signBg:"#7f1d1d", signFg:"#ffffff", style:"canopy" },
      "loftus": { roof:[22,29,40,56,72,84,92,97,97,92,84,72,56,40,29,22], seat:"#77787c", shell:"#46474e", trim:"#38bdf8", sign:"LOFTUS", signBg:"#38bdf8", signFg:"#0f172a", style:"terrace", towers:true },
      "dhl": { roof:[27,39,55,70,84,95,102,106,106,102,95,84,70,55,39,27], seat:"#cdd5d7", shell:"#f1f5f9", trim:"#d40511", sign:"DHL", signBg:"#ffcc00", signFg:"#d40511", style:"oval" },
      "thomond": { roof:[16,22,31,43,58,72,87,102,102,87,72,58,43,31,22,16], seat:"#545f6c", shell:"#303946", trim:"#b91c1c", sign:"THOMOND PARK", signBg:"#b91c1c", signFg:"#ffffff", style:"terrace" },
      "kingsholm": { roof:[12,16,24,34,48,63,78,95,95,78,63,48,34,24,16,12], seat:"#777174", shell:"#414148", trim:"#b91c1c", sign:"THE SHED", signBg:"#111827", signFg:"#f8fafc", style:"terrace" },
      "franklins": { roof:[19,27,39,54,67,76,82,86,86,82,76,67,54,39,27,19], seat:"#60756a", shell:"#263b2a", trim:"#facc15", sign:"FRANKLIN'S", signBg:"#14532d", signFg:"#facc15", style:"box" },
      "sandy-park": { roof:[15,24,36,50,67,83,100,116,116,100,83,67,50,36,24,15], seat:"#66707a", shell:"#252b34", trim:"#ec4899", sign:"SANDY PARK", signBg:"#111827", signFg:"#ec4899", style:"canopy" },
      "forsyth-barr": { roof:[58,65,72,79,85,91,96,99,99,96,91,85,79,72,65,58], seat:"#c8e3e6", shell:"#88aeb7", trim:"#facc15", sign:"FORSYTH BARR", signBg:"#f8fafc", signFg:"#0f172a", style:"glass" },
      "velodrome": { roof:[20,30,46,65,87,108,124,134,130,118,100,78,56,40,29,20], seat:"#dce5eb", shell:"#f8fafc", trim:"#38bdf8", sign:"VÉLODROME", signBg:"#f8fafc", signFg:"#0ea5e9", style:"sail" },
    };
    const profile = profiles[s.blueprint];
    const ground = baseY;

    // Rear shadow gives the arena depth against the skyline.
    rect(x0 - 12, ground - 8, width + 24, 18, "rgba(2,6,23,0.42)");
    for (let i = 0; i < bays; i++) {
      const h = profile.roof[i];
      const x = x0 + i * bayW;
      const y = ground - h;
      // Individual bays form the stepped real-stadium roofline.
      rect(x, y, bayW + 1, h, profile.shell);
      // Three seating tiers, with vertical aisles between bays.
      const tierTop = y + Math.max(7, h * 0.23);
      const tierHeight = Math.max(3, (ground - tierTop - 8) / 3);
      for (let tier = 0; tier < 3; tier++) {
        const sy = tierTop + tier * tierHeight;
        rect(x + 2, sy, bayW - 3, Math.max(2, tierHeight - 2), tier % 2 ? profile.seat : shade(profile.seat, 0.82));
        for (let seatX = x + 4; seatX < x + bayW - 2; seatX += 5) {
          for (let seatY = sy + 2; seatY < sy + tierHeight - 1; seatY += 4) {
            rect(seatX, seatY, 2, 1, (i + tier + Math.floor(seatY)) % 3 ? "rgba(255,255,255,0.4)" : profile.trim);
          }
        }
      }
      // Dark facade supports/entry portals beneath stands.
      rect(x + 2, ground - 8, bayW - 4, 8, shade(profile.shell, 0.55));
      if (i % 2 === 0) rect(x + bayW * 0.43, ground - 7, 3, 7, "#101827");
      // Roof lip
      rect(x, y, bayW + 1, 4, profile.trim);
    }

    // Roof family details make the façade read as a particular structure.
    if (profile.style === "oval" || profile.style === "canopy") {
      for (let i = 1; i < bays - 1; i += 2) rect(x0 + i * bayW, ground - profile.roof[i] - 9, bayW * 1.8, 4, profile.style === "canopy" ? "#f8fafc" : shade(profile.shell, 0.65));
    }
    if (profile.style === "wave" || profile.style === "sail") {
      for (let i = 0; i < bays - 1; i++) {
        const x = x0 + i * bayW;
        const y = ground - profile.roof[i] - 5;
        rect(x, y, bayW * 1.35, 4, "#f8fafc");
      }
    }
    if (profile.style === "glass") {
      for (let i = 0; i < bays; i += 2) rect(x0 + i * bayW + bayW / 2, ground - profile.roof[i] + 3, 2, profile.roof[i] - 14, "rgba(255,255,255,0.8)");
    }
    if (profile.style === "box") {
      rect(x0 - 4, ground - Math.max(...profile.roof) - 9, width + 8, 7, "#111827");
    }
    if (profile.towers) {
      for (const x of [x0 - 13, x0 + width + 10]) {
        rect(x, ground - 121, 4, 121, "#cbd5e1");
        rect(x - 8, ground - 121, 20, 4, "#fef3c7");
        rect(x - 5, ground - 116, 14, 3, "#dbeafe");
      }
    }
    if (profile.track) {
      rect(x0 + 18, ground + 2, width - 36, 4, "#60a5fa");
      rect(x0 + 35, ground + 7, width - 70, 2, "#f8fafc");
    }

    // Foreground stadium frontage and large, venue-specific sign.
    rect(x0 - 6, ground, width + 12, 9, "#151d29");
    rect(x0, ground + 9, width, 3, profile.trim);
    const signWidth = Math.max(56, this.measure(profile.sign, 9) + 18);
    const signX = x0 + width / 2 - signWidth / 2;
    const signY = ground - Math.max(...profile.roof) * 0.58;
    rect(signX - 2, signY - 2, signWidth + 4, 16, "#020617");
    rect(signX, signY, signWidth, 12, profile.signBg);
    this.text(profile.sign, signX + signWidth / 2, signY + 3, { align: "center", size: 8, color: profile.signFg, shadow: false });
  }

  // ---------- stadium & pitch ----------
  private drawStadium(flash: number): void {
    const b = this.b;
    const s = this.stadium;
    // Shared, deliberately clean pixel stadium: each ground differs by its turf, crowd palette,
    // advertising accent and day/night setting rather than by experimental building geometry.
    b.fillStyle = s.night ? shade(s.stand, 0.52) : s.stand;
    b.fillRect(0, 0, this.bufW, this.bufH);
    const frame = flash > 0.05 ? Math.floor(this.now * 8) % 2 : Math.floor(this.now * 1.4) % 2;
    const crowd = this.crowd[frame];
    if (crowd) {
      b.save();
      b.translate(mod(-this.cam.x * this.ppm, 32), mod(-this.cam.y * this.ppm, 32));
      b.fillStyle = crowd;
      b.fillRect(-32, -32, this.bufW + 64, this.bufH + 64);
      b.restore();
    }
    // A simple dark concrete bowl/track just outside the pitch.
    const outerX = this.sx(-7);
    const outerY = this.sy(-7);
    const outerW = this.sw(L + 14);
    const outerH = this.sw(W + 14);
    b.fillStyle = "#101827";
    b.fillRect(outerX, outerY, outerW, outerH);
    b.fillStyle = "#334155";
    b.fillRect(outerX + 3, outerY + 3, outerW - 6, outerH - 6);
    // Team-coloured hoardings frame the field and retain a different identity for each venue.
    const board = Math.max(2, this.sw(1.15));
    const segment = Math.max(9, this.sw(9));
    const left = this.sx(-4.6), right = this.sx(L + 4.6);
    const top = this.sy(-4.6), bottom = this.sy(W + 4.6);
    let i = 0;
    for (let x = left; x < right; x += segment, i++) {
      b.fillStyle = i % 2 ? s.accent : "#f8fafc";
      b.fillRect(x, top, Math.min(segment, right - x), board);
      b.fillStyle = i % 2 ? "#f8fafc" : s.accent;
      b.fillRect(x, bottom - board, Math.min(segment, right - x), board);
    }
    i = 0;
    for (let y = top; y < bottom; y += segment, i++) {
      b.fillStyle = i % 2 ? "#f8fafc" : s.accent;
      b.fillRect(left, y, board, Math.min(segment, bottom - y));
      b.fillStyle = i % 2 ? s.accent : "#f8fafc";
      b.fillRect(right - board, y, board, Math.min(segment, bottom - y));
    }
    if (flash > 0.05) {
      b.fillStyle = "rgba(255,255,255,0.35)";
      for (let n = 0; n < Math.floor(28 * flash); n++) b.fillRect(Math.floor(Math.random() * this.bufW), Math.floor(Math.random() * this.bufH), 2, 2);
    }
    if (s.night) {
      b.fillStyle = "rgba(3,7,18,0.26)";
      b.fillRect(0, 0, this.bufW, this.bufH);
    }
  }

  /** Exterior landscape shown in a wide aerial shot before the stadium shell is drawn. */
  private drawScenicBackdrop(): void {
    const b = this.b;
    const s = this.stadium;
    const daySky = "#8bb7c7";
    const nightSky = "#071426";
    b.fillStyle = s.night ? nightSky : daySky;
    b.fillRect(0, 0, this.bufW, this.bufH);
    const rect = (x: number, y: number, w: number, h: number, color: string) => { b.fillStyle = color; b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const horizon = Math.round(this.bufH * 0.57);
    rect(0, horizon, this.bufW, this.bufH - horizon, s.night ? "#15202a" : "#6f8078");
    rect(0, horizon + 10, this.bufW, 4, s.night ? "#1e3340" : "#82948a");
    const city = (palette: string[], density = 10) => {
      for (let i = 0; i < density; i++) {
        const w = 10 + ((i * 7) % 18);
        const h = 14 + ((i * 13) % 45);
        const x = (i * 51 + 17) % this.bufW;
        rect(x, horizon - h, w, h, palette[i % palette.length]);
        if (s.night) for (let yy = horizon - h + 5; yy < horizon - 3; yy += 7) rect(x + 3, yy, 2, 2, "#fef3c7");
      }
    };
    const hills = (colors: string[], maxH = 56) => {
      for (let i = 0; i < 20; i++) {
        const x = i * (this.bufW / 18) - 18;
        const h = 10 + ((i * 19) % maxH);
        rect(x, horizon - h, this.bufW / 15 + 3, h, colors[i % colors.length]);
      }
    };

    switch (s.landmark) {
      case "table-mountain": {
        // Cape Town: wide, unmistakably flat table summit with sloping shoulders and pale cloud cap.
        const base = horizon + 13;
        const segments = [16, 28, 43, 58, 75, 93, 105, 108, 108, 108, 108, 108, 108, 105, 93, 76, 60, 43, 28, 17];
        const sw = this.bufW / segments.length;
        segments.forEach((h, i) => rect(i * sw, base - h, sw + 1, h, "#3f5b5b"));
        segments.forEach((h, i) => { if (i > 3 && i < 16) rect(i * sw + 1, base - h, sw - 1, 4, "#91a7a1"); });
        rect(this.bufW * 0.33, base - 112, this.bufW * 0.34, 5, "#dbe7df");
        rect(this.bufW * 0.39, base - 117, this.bufW * 0.22, 4, "#eef7f2");
        rect(0, base, this.bufW, this.bufH - base, "#466d62");
        city(["#596d70", "#4b6167", "#6c7d75"], 12);
        break;
      }
      case "edinburgh-hills": case "dunedin-hills": case "exeter-hills": case "pretoria-hills": case "marseille-hills":
        hills(s.night ? ["#102939", "#163749", "#0b1e2b"] : ["#617866", "#728664", "#526d5b"], 68);
        city(s.night ? ["#142e40", "#1b4052"] : ["#788079", "#657069"], 7);
        break;
      case "rome-pines":
        hills(["#75806b", "#69775f"], 28);
        for (let x = 16; x < this.bufW; x += 41) { rect(x + 5, horizon - 44, 4, 44, "#554b3d"); rect(x - 7, horizon - 55, 28, 17, "#315b3c"); rect(x - 2, horizon - 65, 18, 14, "#3c6b46"); }
        break;
      case "sydney-olympic":
        city(s.night ? ["#1d3040", "#213e53", "#172d3d"] : ["#677f8a", "#8296a0", "#5f7784"], 13);
        rect(this.bufW * 0.12, horizon - 72, 4, 72, "#e5e7eb"); rect(this.bufW * 0.12 - 7, horizon - 72, 18, 3, "#e5e7eb");
        break;
      case "auckland-skyline":
        city(s.night ? ["#142b3b", "#1a3a4d"] : ["#65777c", "#788b8c"], 11);
        rect(this.bufW * 0.72, horizon - 78, 3, 78, "#e5e7eb"); rect(this.bufW * 0.72 - 5, horizon - 75, 13, 3, "#e5e7eb");
        break;
      case "gloucester-rail":
        city(["#6b7280", "#7c838d", "#56606a"], 8);
        rect(0, horizon - 18, this.bufW, 3, "#334155");
        for (let x = 0; x < this.bufW; x += 24) rect(x, horizon - 27, 3, 26, "#475569");
        break;
      case "northampton-park":
        hills(["#638064", "#52735b"], 30);
        for (let x = 8; x < this.bufW; x += 28) { rect(x, horizon - 24, 3, 24, "#604c39"); rect(x - 8, horizon - 42, 18, 20, "#2f6b3f"); }
        break;
      case "london-houses": case "dublin-terraces": case "cardiff-city": case "joburg-skyline": case "buenos-aires": case "brisbane-skyline": case "limerick-skyline":
        city(s.night ? ["#16293a", "#20394a", "#1c3040"] : ["#737b7a", "#687779", "#82827a"], 12);
        break;
      default:
        city(s.night ? ["#16293a", "#20394a"] : ["#6f7f7a", "#81908a"], 8);
    }
  }

  /**
   * Live top-down stadium plans. Seating is a first-class element: every plan is built from
   * individual grandstands populated with pixel fans, aisles and roof fascia—not a crowd texture.
   */
  private drawTopDownVenue(): void {
    const s = this.stadium;
    const seed = hashStr(s.id);
    const roof = s.night ? "#0b1220" : "#263241";
    const concrete = shade(s.stand, 0.78);
    const dark = shade(s.stand, 0.48);
    const whiteRoof = "#dbe4e8";
    // Blueprint coordinates originally span a full building footprint. Compress the plan around
    // the 120x70 pitch so all grandstands are visible at normal top-down match zoom.
    const planX = 0.72;
    const planY = 0.58;
    const map = (x: number, y: number) => ({ x: 60 + (x - 60) * planX, y: 35 + (y - 35) * planY });
    const stand = (x: number, y: number, w: number, h: number, face: "north" | "south" | "west" | "east", color: string, trim: string, localSeed: number) => {
      const mapped = map(x, y);
      const sw = w * planX;
      const sh = h * planY;
      // Anchor seats to the outside of the playable pitch. The green pitch is drawn later,
      // so no part of an actual grandstand can disappear under it.
      const px = face === "west" ? -sw - 0.8 : face === "east" ? L + 0.8 : mapped.x;
      const py = face === "north" ? -sh - 0.8 : face === "south" ? W + 0.8 : mapped.y;
      this.drawTopDownStand(px, py, sw, sh, face, color, trim, localSeed);
    };
    const top = (x: number, y: number, w: number, h: number, color = roof, trim = s.accent) => stand(x, y, w, h, "north", color, trim, seed);
    const bottom = (x: number, y: number, w: number, h: number, color = concrete, trim = s.accent) => stand(x, y, w, h, "south", color, trim, seed + 11);
    const left = (x: number, y: number, w: number, h: number, color = concrete, trim = s.accent) => stand(x, y, w, h, "west", color, trim, seed + 23);
    const right = (x: number, y: number, w: number, h: number, color = roof, trim = s.accent) => stand(x, y, w, h, "east", color, trim, seed + 37);
    const block = (x: number, y: number, w: number, h: number, color: string) => {
      const p = map(x, y);
      this.b.fillStyle = color;
      this.b.fillRect(this.sx(p.x), this.sy(p.y), this.sw(w * planX), this.sw(h * planY));
    };
    const label = (text: string, x: number, y: number, color = "#ffffff") => {
      const p = map(x, y);
      // Logos remain on the visible outer fascia rather than under the pitch surface.
      const py = y < 0 ? -4.5 : y > W ? W + 4 : p.y;
      this.text(text, this.sx(p.x), this.sy(py), { align: "center", size: 7, color, shadow: true });
    };
    const track = (color: string) => {
      // Stepped athletics track ring: deliberately lives outside the 0–120 / 0–70 pitch.
      const raw = (x: number, y: number, w: number, h: number) => {
        this.b.fillStyle = color;
        this.b.fillRect(this.sx(x), this.sy(y), this.sw(w), this.sw(h));
      };
      raw(-5, -6, 130, 5); raw(-5, W + 1, 130, 5);
      raw(-6, -1, 5, W + 2); raw(L + 1, -1, 5, W + 2);
      raw(-10, -10, 4, 5); raw(L + 6, -10, 4, 5);
      raw(-10, W + 5, 4, 5); raw(L + 6, W + 5, 4, 5);
    };
    const corner = (x: number, y: number, w: number, h: number, color: string) => top(x, y, w, h, color, s.accent);

    // DHL Stadium has an authored oval plan from the supplied aerial image, rather than sharing
    // the generic stadium-card geometry used by the other venue blueprints.
    if (s.blueprint === "dhl") {
      this.drawDhlTopDownPlan();
      return;
    }

    switch (s.blueprint) {
      case "twickenham":
        // Massive rectangular rugby bowl: deep east/west main stands, squared corners, open concourses.
        top(5, -23, 110, 19, "#3c4856", "#e5e7eb"); bottom(4, 74, 112, 21, "#303946", "#c8102e");
        left(-19, 3, 16, 64, "#45505c", "#e5e7eb"); right(123, 3, 16, 64, "#303946", "#c8102e");
        corner(-12, -17, 15, 13, dark); corner(117, -17, 15, 13, dark); corner(-12, 74, 15, 13, dark); corner(117, 74, 15, 13, dark);
        label("ALLIANZ", 60, -15, "#dbeafe");
        break;
      case "stade-de-france":
        // Continuous, low oval seating bowl surrounding the blue athletics track.
        track("#27588f");
        top(15, -28, 90, 20, "#363946", "#f8fafc"); bottom(15, 78, 90, 20, "#363946", "#f8fafc");
        left(-26, 12, 19, 46, "#41414a", "#1e3a8a"); right(127, 12, 19, 46, "#41414a", "#c8102e");
        top(0, -16, 16, 12, dark); top(104, -16, 16, 12, dark); bottom(0, 74, 16, 12, dark); bottom(104, 74, 16, 12, dark);
        label("STADE DE FRANCE", 60, -20, "#ffffff");
        break;
      case "aviva":
        // Tall east/west sides; dramatically lower north end and an asymmetric curved south stand.
        top(17, -12, 86, 8, "#c4d4d9", "#15803d"); bottom(8, 74, 104, 25, "#41515b", "#15803d");
        left(-22, 4, 19, 62, "#cad9dd", "#15803d"); right(123, 4, 19, 62, "#cad9dd", "#15803d");
        top(4, -7, 14, 3, "#dce9ed"); top(103, -7, 14, 3, "#dce9ed");
        label("AVIVA", 60, 86, "#ffffff");
        break;
      case "principality":
        // Fully enclosed compact rectangle, roof everywhere and a dark central opening.
        top(-8, -25, 136, 22, "#111827", "#dc2626"); bottom(-8, 73, 136, 22, "#111827", "#dc2626");
        left(-24, -3, 22, 76, "#111827", "#dc2626"); right(122, -3, 22, 76, "#111827", "#dc2626");
        for (let x = -2; x < 125; x += 12) block(x, -4, 2, 4, "#64748b");
        label("PRINCIPALITY", 60, -17, "#ffffff");
        break;
      case "murrayfield":
        // Iconic huge west/east grandstands and strongly open ends with floodlight masts.
        left(-27, 5, 24, 60, "#344154", "#dbeafe"); right(123, 5, 20, 60, "#263142", "#38bdf8");
        top(20, -10, 80, 6, concrete, "#38bdf8"); bottom(20, 74, 80, 7, roof, "#38bdf8");
        this.drawTopDownFloodlights([[-28, -6], [145, -6], [-28, 76], [145, 76]]);
        label("MURRAYFIELD", 60, -7, "#dbeafe");
        break;
      case "olimpico":
        // Wide elliptical Olympic plan with a full pale blue athletics ring.
        track("#73b9e8");
        top(12, -31, 96, 19, "#c5cfd4", "#38bdf8"); bottom(12, 82, 96, 19, "#c5cfd4", "#38bdf8");
        left(-30, 10, 21, 50, "#a8b4bb", "#38bdf8"); right(129, 10, 21, 50, "#a8b4bb", "#38bdf8");
        top(-2, -21, 15, 9, "#dbe4e8"); top(107, -21, 15, 9, "#dbe4e8"); bottom(-2, 74, 15, 12, "#dbe4e8"); bottom(107, 74, 15, 12, "#dbe4e8");
        label("OLIMPICO", 60, -23, "#ffffff");
        break;
      case "eden-park":
        // Tight rectangular rugby ground with four corner light towers and a deep south stand.
        top(5, -21, 110, 17, "#28313b", "#ffffff"); bottom(5, 74, 110, 23, "#252d37", "#ffffff");
        left(-18, 2, 15, 66, "#3a4453", "#ffffff"); right(123, 2, 15, 66, "#3a4453", "#ffffff");
        this.drawTopDownFloodlights([[-20, -20], [140, -20], [-20, 90], [140, 90]]);
        label("EDEN PARK", 60, -14, "#ffffff");
        break;
      case "ellis-park":
        // Steep, old-school oval bowl with deep concrete side bowls and four lights.
        top(13, -27, 94, 19, "#414047", "#facc15"); bottom(13, 78, 94, 19, "#414047", "#166534");
        left(-26, 12, 19, 46, "#4b4748", "#facc15"); right(127, 12, 19, 46, "#4b4748", "#166534");
        top(-1, -17, 14, 9, dark); top(107, -17, 14, 9, dark); bottom(-1, 74, 14, 12, dark); bottom(107, 74, 14, 12, dark);
        this.drawTopDownFloodlights([[-22, -12], [142, -12], [-22, 82], [142, 82]]);
        label("ELLIS PARK", 60, -19, "#facc15");
        break;
      case "accor":
        // Giant Sydney Olympic ellipse and athletic track with white cantilever roof segments.
        track("#6aa5d8");
        top(10, -32, 100, 20, whiteRoof, "#eab308"); bottom(10, 82, 100, 20, whiteRoof, "#eab308");
        left(-31, 8, 22, 54, "#aebbc3", "#eab308"); right(129, 8, 22, 54, "#aebbc3", "#eab308");
        top(-2, -22, 12, 10, "#dce6eb"); top(110, -22, 12, 10, "#dce6eb"); bottom(-2, 74, 12, 14, "#dce6eb"); bottom(110, 74, 12, 14, "#dce6eb");
        label("ACCOR", 60, -24, "#1f2937");
        break;
      case "amalfitani":
        // Concrete horseshoe, huge home terrace and deliberately more open north side.
        bottom(3, 74, 114, 27, "#6b6d73", "#7dd3fc"); left(-23, 9, 20, 55, "#5b5e64", "#7dd3fc"); right(123, 14, 15, 45, "#5b5e64", "#7dd3fc");
        top(30, -10, 60, 6, "#7a7d81", "#f8fafc");
        label("VÉLEZ", 60, 88, "#ffffff");
        break;
      case "suncorp":
        // Four high close stands under a segmented white rectangular roof.
        top(4, -25, 112, 21, whiteRoof, "#7f1d1d"); bottom(4, 74, 112, 21, roof, "#7f1d1d");
        left(-20, 3, 17, 64, "#d5dfe2", "#7f1d1d"); right(123, 3, 17, 64, "#d5dfe2", "#7f1d1d");
        for (let x = 9; x < 114; x += 15) block(x, -27, 7, 3, "#ffffff");
        label("SUNCORP", 60, -17, "#7f1d1d");
        break;
      case "loftus":
        // Open concrete Pretoria bowl with blue seating and tall floodlights.
        top(10, -20, 100, 16, "#4a4c52", "#38bdf8"); bottom(8, 74, 104, 21, "#505158", "#38bdf8");
        left(-17, 8, 14, 54, "#56585e", "#38bdf8"); right(123, 8, 14, 54, "#56585e", "#38bdf8");
        this.drawTopDownFloodlights([[-20, -8], [140, -8], [-20, 78], [140, 78]]);
        label("LOFTUS", 60, -13, "#38bdf8");
        break;

      case "thomond":
        // Limerick's huge red main stand opposite lower terrace, compact uneven ground.
        bottom(0, 74, 120, 28, "#303946", "#b91c1c"); left(-24, 8, 21, 54, "#303946", "#b91c1c");
        right(123, 12, 15, 46, "#475569", "#b91c1c"); top(26, -9, 72, 5, roof, "#b91c1c");
        label("THOMOND PARK", 60, 91, "#ffffff");
        break;
      case "kingsholm":
        // The Shed is a long low terrace on one touchline; tall red main stand opposite.
        top(2, -10, 116, 6, "#2b2b2f", "#f8fafc"); bottom(0, 74, 120, 29, "#3f3f46", "#b91c1c");
        left(-16, 6, 13, 58, "#54545a", "#b91c1c"); right(123, 6, 19, 58, "#45454d", "#b91c1c");
        label("THE SHED", 60, -8, "#ffffff");
        break;
      case "franklins":
        // Compact Northampton ground, green main stand, gold fascia and stepped open corners.
        top(10, -18, 100, 14, "#294733", "#facc15"); bottom(6, 74, 108, 20, "#26343a", "#facc15");
        left(-17, 12, 14, 46, concrete, "#facc15"); right(123, 12, 14, 46, concrete, "#facc15");
        top(0, -8, 12, 4, "#34553a"); bottom(108, 74, 12, 7, "#34553a");
        label("FRANKLIN'S", 60, -12, "#facc15");
        break;
      case "sandy-park":
        // Exeter's large covered west/east grandstands and low, open terrace at one end.
        top(2, -27, 116, 23, "#28313b", "#ec4899"); bottom(26, 74, 68, 7, concrete, "#ec4899");
        left(-22, 5, 19, 60, "#323946", "#ec4899"); right(123, 12, 14, 46, "#4b5563", "#ec4899");
        label("SANDY PARK", 60, -18, "#ec4899");
        break;
      case "forsyth-barr":
        // Dunedin's enclosed ETFE/glass bubble: pale roof on every side and translucent ribs.
        top(-7, -27, 134, 23, "#b8dce2", "#facc15"); bottom(-7, 74, 134, 22, "#9ccbd5", "#facc15");
        left(-24, -4, 22, 78, "#a7d7df", "#facc15"); right(122, -4, 22, 78, "#a7d7df", "#facc15");
        for (let x = -3; x < 124; x += 11) block(x, -25, 2, 20, "rgba(255,255,255,0.72)");
        label("FORSYTH BARR", 60, -18, "#0f172a");
        break;
      case "velodrome":
        // Marseille's asymmetrical sweeping white roof, with high south/east sails and blue bowl.
        top(8, -32, 102, 28, whiteRoof, "#38bdf8"); bottom(20, 74, 80, 10, "#dbeafe", "#38bdf8");
        left(-14, 16, 11, 42, "#e2e8f0", "#38bdf8"); right(123, -2, 25, 76, whiteRoof, "#38bdf8");
        for (let i = 0; i < 7; i++) block(12 + i * 15, -36 + (i % 3) * 3, 12, 3, "#ffffff");
        label("VÉLODROME", 60, -23, "#0ea5e9");
        break;
    }
  }

  /** Detailed DHL Stadium top-down bowl authored from the supplied aerial reference. */
  private drawDhlTopDownPlan(): void {
    const b = this.b;
    const cx = 60;
    const cy = 35;
    const oval = (rx: number, ry: number, color: string) => {
      b.fillStyle = color;
      for (let dy = -ry; dy <= ry; dy += 0.8) {
        const span = Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))) * rx;
        b.fillRect(this.sx(cx - span), this.sy(cy + dy), Math.max(1, this.sw(span * 2)), Math.max(1, this.sw(0.9)));
      }
    };
    // True oval roof shell, based on Cape Town Stadium's pale rounded aerial profile.
    oval(80, 49, "#081018");       // external outline/shadow
    oval(78, 47, "#dce7e9");       // white-grey outer canopy
    oval(74, 43, "#b9c9ce");       // roof panel shadow
    // Roof panel seams and radial truss hints across the light grey canopy.
    for (let i = 0; i < 18; i++) {
      const theta = (i / 18) * Math.PI * 2;
      const x = cx + Math.cos(theta) * 70;
      const y = cy + Math.sin(theta) * 39;
      b.fillStyle = "rgba(71,85,105,0.58)";
      b.fillRect(this.sx(x) - 1, this.sy(y) - 1, Math.max(2, this.sw(2.5)), Math.max(2, this.sw(1.4)));
    }
    // The unmistakeable yellow DHL fascia wraps the inside edge of the roof opening.
    oval(69, 38, "#ffcc00");
    oval(66.5, 35.5, "#d40511");
    oval(64, 33, "#1d2932");       // upper bowl
    oval(61, 30, "#34434d");       // second seating tier
    oval(58, 27, "#202c35");       // lower seating tier / field opening edge

    // Seating only exists in the annular bowl, leaving the rectangular pitch free to be drawn later.
    const fanColours = ["#f8fafc", "#cbd5e1", "#60a5fa", "#1d4ed8", "#d40511", "#facc15", "#111827"];
    for (let i = 0; i < 520; i++) {
      const a = (i * 2.3999632297) % (Math.PI * 2);
      const ring = 0.56 + ((i * 47) % 100) / 100 * 0.3;
      const x = cx + Math.cos(a) * 76 * ring;
      const y = cy + Math.sin(a) * 46 * ring;
      // Skip the central field; fans remain visibly positioned inside the stadium seats.
      if (x > -1 && x < 121 && y > -1 && y < 71) continue;
      b.fillStyle = fanColours[i % fanColours.length];
      const size = i % 5 === 0 ? 3 : 2;
      b.fillRect(this.sx(x), this.sy(y), size, size);
      b.fillStyle = "rgba(2,6,23,0.65)";
      b.fillRect(this.sx(x), this.sy(y) + size, size, 1);
    }
    // Repeated DHL panels are visible on the north/south inner fascia.
    for (let i = 0; i < 9; i++) {
      const x = 17 + i * 10.8;
      b.fillStyle = "#ffcc00";
      b.fillRect(this.sx(x), this.sy(-2.8), this.sw(8.6), Math.max(3, this.sw(1.7)));
      b.fillRect(this.sx(x), this.sy(71.1), this.sw(8.6), Math.max(3, this.sw(1.7)));
      this.text("DHL", this.sx(x + 4.3), this.sy(-2.55), { align: "center", size: 5, color: "#d40511", shadow: false });
      this.text("DHL", this.sx(x + 4.3), this.sy(71.35), { align: "center", size: 5, color: "#d40511", shadow: false });
    }
    // East-side video board, just like the large screen visible in the stadium photograph.
    b.fillStyle = "#0b1220";
    b.fillRect(this.sx(121.8), this.sy(27), this.sw(7), this.sw(16));
    b.fillStyle = "#62d6cf";
    b.fillRect(this.sx(123), this.sy(29), this.sw(4.6), this.sw(8));
    b.fillStyle = "#facc15";
    b.fillRect(this.sx(123.5), this.sy(31), this.sw(3.6), this.sw(1.2));
    // Compact mountain inset beyond the north-west roof, visible only in wider stadium framing.
    this.drawTopDownTableMountain();
  }

  private drawTopDownStand(x: number, y: number, w: number, h: number, face: "north" | "south" | "west" | "east", shell: string, trim: string, seed: number): void {
    const b = this.b;
    const px = this.sx(x), py = this.sy(y), pw = this.sw(w), ph = this.sw(h);
    if (pw <= 1 || ph <= 1) return;
    b.fillStyle = "#0b1020";
    b.fillRect(px - 2, py - 2, pw + 4, ph + 4);
    b.fillStyle = shell;
    b.fillRect(px, py, pw, ph);
    const vertical = face === "west" || face === "east";
    const rowSize = Math.max(2, Math.round(this.ppm * 0.5));
    const seat = this.stadium.night ? "rgba(203,213,225,0.32)" : "rgba(241,245,249,0.33)";
    const aisle = "rgba(2,6,23,0.42)";
    // Tier rows and stair aisles: these are actual stands, not a full-screen noise texture.
    if (vertical) {
      for (let xx = px + rowSize; xx < px + pw - 1; xx += rowSize * 2) { b.fillStyle = seat; b.fillRect(xx, py + 2, 1, ph - 4); }
      for (let yy = py + rowSize * 3; yy < py + ph; yy += rowSize * 7) { b.fillStyle = aisle; b.fillRect(px, yy, pw, Math.max(1, rowSize)); }
    } else {
      for (let yy = py + rowSize; yy < py + ph - 1; yy += rowSize * 2) { b.fillStyle = seat; b.fillRect(px + 2, yy, pw - 4, 1); }
      for (let xx = px + rowSize * 6; xx < px + pw; xx += rowSize * 11) { b.fillStyle = aisle; b.fillRect(xx, py, Math.max(1, rowSize), ph); }
    }
    // Deterministic coloured fan pixels only inside the stand shell.
    const fanColours = [this.stadium.accent, "#f8fafc", "#facc15", "#60a5fa", "#ef4444", "#cbd5e1", "#111827"];
    // Dense 2px supporters are intentionally visible at the 0.52x stadium-wide camera.
    const fanCount = Math.max(24, Math.floor((pw * ph) / 38));
    const fanSize = Math.max(2, Math.round(this.ppm * 0.32));
    for (let i = 0; i < fanCount; i++) {
      const nx = ((seed + i * 37) % 1000) / 1000;
      const ny = ((seed * 3 + i * 71) % 1000) / 1000;
      const fx = px + 3 + Math.floor(nx * Math.max(1, pw - fanSize - 5));
      const fy = py + 3 + Math.floor(ny * Math.max(1, ph - fanSize - 5));
      b.fillStyle = fanColours[(seed + i) % fanColours.length];
      b.fillRect(fx, fy, fanSize, fanSize);
      // tiny dark body/shadow below the supporter makes each fan read as a person rather than noise.
      b.fillStyle = "rgba(2,6,23,0.5)";
      b.fillRect(fx, fy + fanSize, fanSize, 1);
    }
    // Roof fascia on the pitch-facing edge.
    b.fillStyle = trim;
    if (face === "north") b.fillRect(px, py + ph - 3, pw, 3);
    else if (face === "south") b.fillRect(px, py, pw, 3);
    else if (face === "west") b.fillRect(px + pw - 3, py, 3, ph);
    else b.fillRect(px, py, 3, ph);
  }

  private drawTopDownFloodlights(points: [number, number][]): void {
    const b = this.b;
    for (const [x, y] of points) {
      const mx = 60 + (x - 60) * 0.72;
      const my = 35 + (y - 35) * 0.58;
      const px = this.sx(mx), py = this.sy(my);
      b.fillStyle = "#334155"; b.fillRect(px - 3, py - 3, 6, 6);
      b.fillStyle = "#fef3c7"; b.fillRect(px - 6, py - 5, 12, 3);
    }
  }

  private drawTopDownTableMountain(): void {
    const b = this.b;
    // Compact north-west mountain silhouette visible beyond the DHL roof in wide stadium-cam view.
    const plan = (x: number, y: number) => ({ x: 60 + (x - 60) * 0.72, y: 35 + (y - 35) * 0.58 });
    const pts = [[-24,-48,16,8],[-8,-55,16,15],[8,-59,18,19],[26,-61,46,21],[72,-59,18,19],[90,-54,16,14],[106,-47,16,7]] as const;
    for (const [x, y, w, h] of pts) {
      const p = plan(x, y);
      b.fillStyle = "#405d5e";
      b.fillRect(this.sx(p.x), this.sy(p.y), this.sw(w * 0.72), this.sw(h * 0.58));
    }
    const p = plan(27, -62);
    b.fillStyle = "#dce9df";
    b.fillRect(this.sx(p.x), this.sy(p.y), this.sw(44 * 0.72), Math.max(2, this.sw(1.2 * 0.58)));
  }

  /**
   * Named venue blueprints. These are deliberately drawn as recognisable pixel silhouettes,
   * not interchangeable texture swaps: each real ground has its own stand volume, roof form,
   * corner treatment, lighting and fascia lettering.
   */
  private drawVenueArchitecture(): void {
    const b = this.b;
    const s = this.stadium;
    const x0 = this.sx(-8), x1 = this.sx(L + 8), y0 = this.sy(-8), y1 = this.sy(W + 8);
    const ix0 = this.sx(-1), ix1 = this.sx(L + 1), iy0 = this.sy(-1), iy1 = this.sy(W + 1);
    const roof = s.night ? "#080d19" : "#1d2737";
    const concrete = shade(s.stand, 0.72);
    const dark = shade(s.stand, 0.43);
    const trim = shade(s.accent, 1.2);
    const step = Math.max(5, Math.round(this.ppm * 1.35));
    const deep = Math.max(12, Math.round(this.ppm * 2.35));
    const mid = Math.max(9, Math.round(this.ppm * 1.7));
    const rect = (x: number, y: number, w: number, h: number, color: string) => { b.fillStyle = color; b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    // A stand is a real tiered structure: roof/concrete shell, shadowed seating rows, aisle breaks and a fascia.
    const stand = (x: number, y: number, w: number, h: number, color: string, vertical = false) => {
      rect(x, y, w, h, color);
      if (w < 6 || h < 6) return;
      const seat = s.night ? "rgba(226,232,240,0.3)" : "rgba(248,250,252,0.28)";
      const aisle = s.night ? "rgba(2,6,23,0.48)" : "rgba(15,23,42,0.36)";
      const row = Math.max(2, Math.round(step * 0.32));
      if (vertical) {
        for (let xx = x + row; xx < x + w - 1; xx += row * 2) rect(xx, y + 2, 1, h - 4, seat);
        for (let yy = y + step * 2; yy < y + h; yy += step * 5) rect(x, yy, w, 2, aisle);
      } else {
        for (let yy = y + row; yy < y + h - 1; yy += row * 2) rect(x + 2, yy, w - 4, 1, seat);
        for (let xx = x + step * 3; xx < x + w; xx += step * 6) rect(xx, y, 2, h, aisle);
      }
      rect(x, y + h - 3, w, 3, "rgba(2,6,23,0.56)");
    };
    const top = (h: number, col = roof, inset = 0) => stand(x0 + inset, y0, x1 - x0 - inset * 2, h, col, false);
    const bottom = (h: number, col = concrete, inset = 0) => stand(x0 + inset, y1 - h, x1 - x0 - inset * 2, h, col, false);
    const left = (w: number, col = concrete, inset = 0) => stand(x0, y0 + inset, w, y1 - y0 - inset * 2, col, true);
    const right = (w: number, col = roof, inset = 0) => stand(x1 - w, y0 + inset, w, y1 - y0 - inset * 2, col, true);
    const rail = (y: number, from = x0, to = x1, col = trim) => {
      for (let x = from; x < to; x += step * 3) rect(x, y, step * 2, 2, col);
    };
    const lights = (corners: [number, number][]) => {
      for (const [x, y] of corners) {
        rect(x - 2, y - step * 2, 4, step * 4, "#dbeafe");
        rect(x - step, y - step * 2, step * 2, 3, "#fef3c7");
      }
    };
    const steps = (isLeft: boolean, isTop: boolean, count = 4, colA = roof, colB = concrete) => {
      for (let i = 0; i < count; i++) {
        const size = step * (i + 1);
        rect(isLeft ? ix0 - size : ix1, isTop ? iy0 - (i + 1) * step : iy1 + i * step, size, step, i % 2 ? colA : colB);
      }
    };
    const sign = (label: string, y: number, bg: string, fg: string, width?: number) => {
      const w = width ?? Math.max(42, this.measure(label, 8) + 14);
      const x = Math.round((x0 + x1 - w) / 2);
      rect(x - 2, y - 2, w + 4, 15, "#020617");
      rect(x, y, w, 11, bg);
      this.text(label, x + w / 2, y + 2, { align: "center", size: 7, color: fg, shadow: false });
    };
    const ovalRing = (topH: number, sideW: number, colTop = roof, colSide = concrete, count = 5) => {
      top(topH, colTop, sideW);
      bottom(topH, colTop, sideW);
      left(sideW, colSide, topH);
      right(sideW, colSide, topH);
      steps(true, true, count, colTop, colSide);
      steps(false, true, count, colTop, colSide);
      steps(true, false, count, colTop, colSide);
      steps(false, false, count, colTop, colSide);
    };

    switch (s.blueprint) {
      case "twickenham": {
        // Traditional vast rectangular English rugby ground: four tall, squared grandstands.
        top(deep * 1.22, "#3a4352", step);
        bottom(deep * 1.08, "#303947", step);
        left(mid * 1.18, "#3e4756", step);
        right(mid * 1.18, "#252d3a", step);
        rail(y0 + deep * 1.22 - 3, x0 + step, x1 - step, "#e5e7eb");
        rail(y1 - deep * 1.08, x0 + step, x1 - step, "#c8102e");
        for (let x = x0 + step * 2; x < x1 - step; x += step * 5) rect(x, y0 + 2, step * 3, 3, "#e5e7eb");
        sign("ALLIANZ", y0 + 7, "#e5e7eb", "#1d4ed8", 66);
        break;
      }
      case "stade-de-france": {
        // Low, broad elliptical bowl and a floating outer roof ring.
        ovalRing(deep, mid * 1.12, "#30333c", "#44414b", 6);
        for (let x = x0 + deep; x < x1 - deep; x += step * 4) rect(x, y0 + 2, step * 2, 3, "#f8fafc");
        rail(y0 + deep - 2, x0 + deep, x1 - deep, "#1e3a8a");
        rail(y1 - deep, x0 + deep, x1 - deep, "#c8102e");
        sign("STADE DE FRANCE", y0 + 8, "#1e3a8a", "#ffffff", 118);
        break;
      }
      case "aviva": {
        // Dublin's high east/west bowl and deliberately dipped north end / wave roof.
        top(mid * 0.7, "#dce7ef", step * 2);
        bottom(deep * 1.45, roof, step);
        left(deep * 1.22, "#c4d3dc", step);
        right(deep * 1.22, "#c4d3dc", step);
        for (let i = 0; i < 9; i++) {
          const h = (i < 2 || i > 6) ? step * 3 : step * (1 + (i % 2));
          rect(ix0 + i * step * 4, y0 + mid * 0.7 - h, step * 3, h, "#eef7fb");
        }
        rail(y1 - deep * 1.45, x0 + step, x1 - step, "#15803d");
        sign("AVIVA", y1 - deep * 1.45 + 5, "#15803d", "#ffffff", 52);
        break;
      }
      case "principality": {
        // Cardiff's fully enclosed retractable-roof box, red fascias and roof-truss grid.
        top(deep * 1.38, "#111827"); bottom(deep * 1.28, "#111827"); left(deep * 0.95, "#111827"); right(deep * 0.95, "#111827");
        rail(y0 + deep * 1.38 - 3, x0, x1, "#dc2626"); rail(y1 - deep * 1.28, x0, x1, "#dc2626");
        for (let x = x0 + step; x < x1; x += step * 4) { rect(x, y0 + 2, 2, deep * 1.38 - 4, "#64748b"); rect(x + step * 2, y1 - deep * 1.28, 2, deep * 1.28 - 3, "#64748b"); }
        sign("PRINCIPALITY", y0 + 8, "#dc2626", "#ffffff", 110);
        break;
      }
      case "murrayfield": {
        // Edinburgh's open ends, big opposing side stands and exposed floodlight masts.
        left(deep * 1.42, "#344154", step * 2); right(deep * 1.12, "#263142", step * 2);
        top(mid * 0.7, concrete, deep); bottom(mid * 0.7, roof, deep);
        rail(y0 + mid * 0.7 - 2, x0 + deep, x1 - deep, "#38bdf8");
        lights([[x0 + deep, y0 + mid], [x0 + deep, y1 - mid], [x1 - deep, y0 + mid], [x1 - deep, y1 - mid]]);
        sign("MURRAYFIELD", y0 + 5, "#1e293b", "#dbeafe", 94);
        break;
      }
      case "olimpico": {
        // Rome's athletics track / broad sunken oval with blue-and-white fascia.
        ovalRing(deep * 1.12, mid * 1.35, "#cbd5e1", "#94a3b8", 7);
        rect(ix0 - mid * 0.8, iy0 - mid * 0.8, ix1 - ix0 + mid * 1.6, iy1 - iy0 + mid * 1.6, "#60a5fa");
        rect(ix0 - mid * 0.45, iy0 - mid * 0.45, ix1 - ix0 + mid * 0.9, iy1 - iy0 + mid * 0.9, "#dbeafe");
        rail(y0 + deep * 1.12 - 2, x0 + deep, x1 - deep, "#38bdf8");
        sign("OLIMPICO", y0 + 8, "#38bdf8", "#ffffff", 74);
        break;
      }
      case "eden-park": {
        // Auckland's tight rugby rectangle, terraced ends and famous four floodlight towers.
        top(deep * 1.12, "#252b35", step); bottom(deep * 1.2, "#252b35", step);
        left(mid * 1.05, "#384250", step); right(mid * 1.05, "#384250", step);
        rail(y0 + deep * 1.12 - 3, x0 + step, x1 - step, "#f8fafc");
        lights([[ix0 + 5, iy0 - deep], [ix1 - 5, iy0 - deep], [ix0 + 5, iy1 + deep], [ix1 - 5, iy1 + deep]]);
        sign("EDEN PARK", y0 + 7, "#111111", "#ffffff", 76);
        break;
      }
      case "ellis-park": {
        // Steep Johannesburg bowl: high concrete sides and bright old-school floodlights.
        ovalRing(deep * 1.25, mid * 1.42, "#31343a", "#414047", 6);
        rail(y0 + deep * 1.25 - 3, x0 + deep, x1 - deep, "#facc15");
        rail(y1 - deep * 1.25, x0 + deep, x1 - deep, "#166534");
        lights([[x0 + deep * 0.8, y0 + deep], [x1 - deep * 0.8, y0 + deep], [x0 + deep * 0.8, y1 - deep], [x1 - deep * 0.8, y1 - deep]]);
        sign("ELLIS PARK", y0 + 8, "#166534", "#facc15", 78);
        break;
      }
      case "accor": {
        // Sydney's huge continuous Olympic oval with a white cantilever perimeter roof.
        ovalRing(deep * 1.45, deep * 0.98, "#e2e8f0", "#94a3b8", 8);
        rail(y0 + deep * 1.45 - 3, x0 + deep, x1 - deep, "#eab308");
        for (let x = x0 + deep; x < x1 - deep; x += step * 3) rect(x, y0 + 2, step * 2, 2, "#ffffff");
        sign("ACCOR STADIUM", y0 + 8, "#eab308", "#0f172a", 102);
        break;
      }
      case "amalfitani": {
        // Vélez: raw open concrete terraces, high main stand and blue-white Argentine stripe seating.
        top(mid * 0.45, "#64748b", deep); bottom(deep * 1.6, "#71717a", step);
        left(deep * 1.1, "#52525b", mid); right(mid * 0.82, "#52525b", mid);
        for (let x = x0 + step; x < x1 - step; x += step * 4) rect(x, y1 - deep * 1.6 + 4, step * 2, 3, x % (step * 8) ? "#7dd3fc" : "#f8fafc");
        sign("VÉLEZ", y1 - deep * 1.6 + 11, "#7dd3fc", "#1e3a8a", 44);
        break;
      }
      case "suncorp": {
        // Brisbane's steep rectangle under a segmented white roof canopy.
        top(deep * 1.48, "#e2e8f0", step); bottom(deep * 1.18, roof, step);
        left(mid * 1.15, "#d1d5db", step); right(mid * 1.15, "#d1d5db", step);
        for (let x = x0 + step; x < x1 - step; x += step * 4) { rect(x, y0 + 2, step * 3, 3, "#f8fafc"); rect(x + step, y0 + 5, 2, deep * 1.48 - 8, "#94a3b8"); }
        rail(y1 - deep * 1.18, x0 + step, x1 - step, "#7f1d1d");
        sign("SUNCORP", y0 + 9, "#7f1d1d", "#ffffff", 66);
        break;
      }
      case "loftus": {
        // Pretoria's open classic concrete bowl with tall light towers and blue seating band.
        top(deep, "#3b3d44", step * 2); bottom(deep * 1.28, "#464850", step * 2);
        left(mid, "#51525a", deep); right(mid, "#51525a", deep);
        rail(y0 + deep - 3, x0 + step * 2, x1 - step * 2, "#38bdf8");
        lights([[x0 + step * 3, y0 + mid], [x1 - step * 3, y0 + mid], [x0 + step * 3, y1 - mid], [x1 - step * 3, y1 - mid]]);
        sign("LOFTUS", y0 + 7, "#38bdf8", "#0f172a", 54);
        break;
      }
      case "dhl": {
        // Cape Town's large modern oval: continuous white canopy, deep red fascia and DHL roof sign.
        ovalRing(deep * 1.32, deep * 0.94, "#f1f5f9", "#a8b1bb", 7);
        rail(y0 + deep * 1.32 - 3, x0 + deep, x1 - deep, "#d40511");
        rail(y1 - deep * 1.32, x0 + deep, x1 - deep, "#d40511");
        for (let x = x0 + deep; x < x1 - deep; x += step * 3) rect(x, y0 + 2, step * 2, 3, "#f8fafc");
        sign("DHL", y0 + 8, "#ffcc00", "#d40511", 46);
        break;
      }
      case "thomond": {
        // Compact Limerick rugby ground: massive red east main stand and low open north terrace.
        top(mid * 0.55, roof, deep); bottom(deep * 1.65, "#2d3748", step);
        left(deep * 1.32, "#303746", mid); right(mid * 0.9, concrete, mid);
        rail(y1 - deep * 1.65, x0 + step, x1 - step, "#b91c1c");
        for (let x = x0 + step * 2; x < x1 - step; x += step * 4) rect(x, y1 - deep * 1.65 + 4, step * 2, 3, "#dc2626");
        sign("THOMOND PARK", y1 - deep * 1.65 + 11, "#b91c1c", "#ffffff", 104);
        break;
      }
      case "kingsholm": {
        // Gloucester's tight, old-school rugby ground: low Shed terrace and a tall red main stand.
        top(deep * 0.72, "#27272a", step); bottom(deep * 1.72, "#3f3f46", step);
        left(mid * 1.25, "#52525b", mid); right(deep * 1.18, "#3f3f46", mid);
        rail(y1 - deep * 1.72, x0 + step, x1 - step, "#b91c1c");
        for (let x = x0 + step; x < x1 - step; x += step * 2) rect(x, y0 + deep * 0.72 - 3, step, 2, "#e5e7eb");
        sign("THE SHED", y0 + 6, "#111827", "#f8fafc", 62);
        break;
      }
      case "franklins": {
        // Compact Northampton bowl: main green stand, bright gold fascia, corners visibly open.
        top(deep * 1.05, "#263b2a", step * 2); bottom(deep * 1.18, "#1f2937", step * 2);
        left(mid * 0.82, concrete, deep); right(mid * 0.82, concrete, deep);
        rail(y0 + deep * 1.05 - 3, x0 + step * 2, x1 - step * 2, "#facc15");
        steps(true, true, 2, "#263b2a", concrete); steps(false, false, 2, "#263b2a", concrete);
        sign("FRANKLIN'S", y0 + 7, "#14532d", "#facc15", 88);
        break;
      }
      case "sandy-park": {
        // Exeter's new grandstand and distinctly open/terraced opposite end.
        top(deep * 1.46, "#262b34", step); bottom(mid * 0.52, concrete, deep);
        left(deep * 1.1, "#323946", mid); right(mid * 0.72, "#4b5563", mid);
        for (let x = x0 + step; x < x1 - step; x += step * 4) rect(x, y0 + 2, step * 3, 3, "#f8fafc");
        rail(y0 + deep * 1.46 - 3, x0 + step, x1 - step, "#ec4899");
        sign("SANDY PARK", y0 + 8, "#111827", "#ec4899", 82);
        break;
      }
      case "forsyth-barr": {
        // Dunedin's transparent enclosed bubble: pale glass perimeter and prominent diagonal roof ribs.
        top(deep * 1.32, "rgba(186,230,253,0.48)"); bottom(deep * 1.18, "rgba(148,163,184,0.62)");
        left(mid * 1.18, "rgba(186,230,253,0.46)"); right(mid * 1.18, "rgba(186,230,253,0.46)");
        b.fillStyle = "rgba(226,232,240,0.8)";
        for (let x = x0; x < x1; x += step * 4) { rect(x, y0 + 2, 2, deep * 1.32 - 4, "rgba(255,255,255,0.7)"); rect(x + step * 2, y1 - deep * 1.18, 2, deep * 1.18 - 2, "rgba(255,255,255,0.55)"); }
        rail(y0 + deep * 1.32 - 2, x0, x1, "#facc15");
        sign("FORSYTH BARR", y0 + 8, "#f8fafc", "#0f172a", 100);
        break;
      }
      case "velodrome": {
        // Marseille's iconic dramatic white asymmetrical sail roof, opening out at corners.
        top(deep * 1.55, "#f8fafc", step * 2); bottom(deep * 0.72, "#dbeafe", deep);
        left(mid * 0.75, "#e2e8f0", deep); right(deep * 1.28, "#f8fafc", step);
        for (let i = 0; i < 8; i++) rect(x0 + step * 2 + i * step * 4, y0 + 2 + (i % 4) * 3, step * 3, 3, "#ffffff");
        for (let i = 0; i < 5; i++) rect(x1 - deep * 1.28 + i * step * 2, y0 + step * (i + 1), step * 3, 3, "#ffffff");
        rail(y0 + deep * 1.55 - 3, x0 + step * 2, x1 - step, "#38bdf8");
        sign("VÉLODROME", y0 + 9, "#f8fafc", "#0ea5e9", 88);
        break;
      }
    }
  }

  private drawPitch(): void {
    const b = this.b;
    const s = this.stadium;
    for (let i = 0; i < 24; i++) {
      b.fillStyle = i % 2 ? s.grassA : s.grassB;
      b.fillRect(this.sx(i * 5), this.sy(0), this.sx((i + 1) * 5) - this.sx(i * 5), this.sw(W));
    }
    b.fillStyle = "rgba(255,255,255,0.06)";
    b.fillRect(this.sx(0), this.sy(0), this.sw(10), this.sw(W));
    b.fillRect(this.sx(110), this.sy(0), this.sw(10), this.sw(W));
    const lw = Math.max(1, Math.round(this.ppm / 8));
    b.fillStyle = "#f4f4f5";
    const v = (x: number, dash = 0) => {
      const px = this.sx(x);
      if (!dash) {
        b.fillRect(px, this.sy(0), lw, this.sw(W));
        return;
      }
      for (let y = this.sy(0); y < this.sy(W); y += dash * 2) b.fillRect(px, y, lw, dash);
    };
    const h = (y: number) => b.fillRect(this.sx(0), this.sy(y), this.sw(L), lw);
    h(0);
    h(W);
    for (const x of [0, 10, 32, 60, 88, 110, 120]) v(x);
    const dash = Math.max(2, Math.round(this.ppm / 2));
    for (const x of [50, 70]) v(x, dash);
    for (const x of [15, 105]) v(x, Math.max(1, Math.round(dash / 2)));
    for (const y of [5, 15, W - 5, W - 15]) {
      for (let x = this.sx(10); x < this.sx(110); x += dash * 3) b.fillRect(x, this.sy(y), dash, lw);
    }
    // centre spot
    b.fillRect(this.sx(60) - lw, this.sy(35) - lw, lw * 3, lw * 3);
    this.posts(10);
    this.posts(110);
    for (const [x, y] of [[10, 0], [10, W], [110, 0], [110, W], [0, 0], [0, W], [120, 0], [120, W]]) this.flag(x, y);
  }

  private posts(x: number): void {
    const b = this.b;
    const px = this.sx(x);
    const z = Math.max(1, Math.round(this.ppm / 8));
    const hgt = Math.max(4, Math.round(this.ppm * 2.6));
    const bar = Math.round(hgt * 0.4);
    const y1 = this.sy(32.2);
    const y2 = this.sy(37.8);
    b.fillStyle = "#0b1020";
    b.fillRect(px - z, y1 - bar - z, 3 * z, y2 - y1 + 2 * z);
    for (const py of [y1, y2]) b.fillRect(px - z, py - hgt - z, 3 * z, hgt + 2 * z);
    b.fillStyle = "#f8fafc";
    b.fillRect(px, y1 - bar, z, y2 - y1);
    for (const py of [y1, y2]) b.fillRect(px, py - hgt, z, hgt);
    b.fillStyle = this.stadium.accent;
    for (const py of [y1, y2]) b.fillRect(px - z, py - Math.round(hgt * 0.28), 3 * z, Math.round(hgt * 0.28));
  }

  private flag(x: number, y: number): void {
    const b = this.b;
    const z = Math.max(1, Math.round(this.ppm / 8));
    const px = this.sx(x);
    const py = this.sy(y);
    const hgt = Math.max(2, Math.round(this.ppm * 0.9));
    b.fillStyle = "#f8fafc";
    b.fillRect(px, py - hgt, z, hgt);
    b.fillStyle = this.stadium.accent;
    b.fillRect(px + z, py - hgt, z * 3, Math.max(1, Math.round(hgt * 0.45)));
  }

  private drawRuck(m: RugbyEngine): void {
    if (m.phase !== "ruck" || !m.ruck) return;
    const b = this.b;
    const r = m.ruck;
    const att = r.team;
    const rf = m.fx(att, r.x);
    const line = (x: number, color: string) => {
      const px = this.sx(x);
      b.fillStyle = color;
      for (let y = this.sy(0); y < this.sy(W); y += 6) b.fillRect(px, y, 1, 3);
    };
    line(m.wx(att, rf + 1), "rgba(248,113,113,0.9)");
    line(m.wx(att, rf - 1), "rgba(147,197,253,0.9)");
    this.text(`RUCK ${r.joined[att].size}v${r.joined[att === 0 ? 1 : 0].size}`, this.sx(r.x), this.sy(r.y) - this.sw(4.5) - 8, { align: "center", color: "#fde68a" });
  }

  // ---------- entities ----------
  private officialsLook: Look = {
    id: "officials",
    jersey: "#22c55e", // Neon green
    jersey2: "#111827",
    shorts: "#111827",
    socks: "#22c55e",
    skin: "#f3d1b0",
    hair: "#1a1a1a",
    number: 0,
  };

  private drawEntities(m: RugbyEngine, snap: Snapshot, f: FrameOptions): void {
    const b = this.b;
    const z = this.zoom;
    
    // Draw Shadows for Players
    const order = [...snap.players].sort((p, q) => (p.lie >= 0 ? 0 : 1) - (q.lie >= 0 ? 0 : 1) || p.y - q.y);
    for (const v of order) this.shadow(this.sx(v.x), this.sy(v.y), v.lie >= 0 ? 12 * z : 8 * z);
    
    // Draw Shadows for Referee and Touch Judges
    this.shadow(this.sx(m.referee.pos.x), this.sy(m.referee.pos.y), 8 * z);
    m.touchJudges.forEach((tj) => this.shadow(this.sx(tj.pos.x), this.sy(tj.pos.y), 8 * z));

    const ball = snap.ball;
    if (!ball.carried) this.shadow(this.sx(ball.x), this.sy(ball.y), Math.max(3, (6 - ball.z * 0.3) * z));
    const controlled = !f.snapshot && m.userTeam !== null ? m.controlled : -1;
    
    // Draw Referee on field (neon green)
    const refDx = Math.cos(m.referee.facing);
    const refView: View = Math.abs(refDx) >= 0.5 ? "side" : Math.sin(m.referee.facing) > 0 ? "front" : "back";
    const refPose: Pose = Math.sqrt(m.referee.vel.x * m.referee.vel.x + m.referee.vel.y * m.referee.vel.y) > 0.5 ? "run" : "idle";
    const refSpr = spriteFactory().get(this.officialsLook, refView, refPose, Math.floor(m.referee.animFrame), refView === "side" && refDx < 0, -1);
    b.drawImage(refSpr, this.sx(m.referee.pos.x) - ANCHOR_X * z, this.sy(m.referee.pos.y) - FOOT_Y * z, SPR_W * z, SPR_H * z);

    // Draw Touch Judges on the sidelines (neon green, holding flags)
    m.touchJudges.forEach((tj) => {
      const tjDx = Math.cos(tj.facing);
      const tjView: View = "side";
      const tjPose: Pose = Math.abs(tj.vel.x) > 0.5 ? "run" : "idle";
      const tjSpr = spriteFactory().get(this.officialsLook, tjView, tjPose, Math.floor(tj.animFrame), tjDx < 0, -1);
      b.drawImage(tjSpr, this.sx(tj.pos.x) - ANCHOR_X * z, this.sy(tj.pos.y) - FOOT_Y * z, SPR_W * z, SPR_H * z);
    });

    for (const v of order) {
      // Robust lookup in looks roster using modulo bounds
      const teamLooksRoster = this.looks[v.team];
      const look = teamLooksRoster[v.id % teamLooksRoster.length];
      if (!look) continue;
      const spr = spriteFactory().get(look, v.view, v.pose, v.frame, v.mirror, v.lie);
      const x = this.sx(v.x);
      const y = this.sy(v.y);
      if (v.id === controlled) {
        b.fillStyle = "rgba(250,204,21,0.35)";
        b.fillRect(x - 6 * z, y - z, 12 * z, 2 * z);
      }
      if (v.lie >= 0) b.drawImage(spr, x - (LIE_S / 2) * z, y - (LIE_S / 2) * z, LIE_S * z, LIE_S * z);
      else b.drawImage(spr, x - ANCHOR_X * z, y - FOOT_Y * z, SPR_W * z, SPR_H * z);
      if (v.hasBall) this.drawBall(ball, v);
      const top = y - FOOT_Y * z;
      if (v.id === controlled) {
        const bob = Math.floor(this.now * 4) % 2;
        b.fillStyle = "#facc15";
        b.fillRect(x - z, top - 5 * z - bob, 2 * z, z);
        b.fillRect(x - 2 * z, top - 6 * z - bob, 4 * z, z);
        b.fillRect(x - 3 * z, top - 7 * z - bob, 6 * z, z);
      }

    }
    if (!ball.carried) this.drawBall(ball, null);
  }

  private shadow(x: number, y: number, w: number): void {
    const b = this.b;
    b.fillStyle = "rgba(0,0,0,0.28)";
    b.fillRect(Math.round(x - w / 2), y - 1, Math.round(w), 2);
    b.fillRect(Math.round(x - w / 3), y - 2, Math.round((w * 2) / 3), 4);
  }

  private drawBall(ball: BallVisual, carrier: PlayerVisual | null): void {
    const b = this.b;
    const z = this.zoom;
    let key: string;
    if (carrier) key = carrier.view === "side" ? "h" : "v";
    else if (ball.kick && ball.z > 0.3) key = ["h", "d1", "v", "d2"][Math.floor(this.now * 14) % 4];
    else {
      const a = Math.atan2(ball.vy, ball.vx);
      const c = Math.cos(a);
      const s = Math.sin(a);
      key = Math.abs(c) > 0.92 ? "h" : Math.abs(s) > 0.92 ? "v" : c * s > 0 ? "d2" : "d1";
    }
    const spr = this.balls[key];
    let x = this.sx(ball.x);
    let y = this.sy(ball.y) - Math.round(ball.z * this.ppm * 0.9);
    if (carrier) {
      x = this.sx(carrier.x) + (carrier.view === "side" ? (carrier.mirror ? -5 : 5) : 0) * z;
      y = this.sy(carrier.y) - (carrier.lie >= 0 ? 2 : 12) * z;
    }
    b.drawImage(spr, x - Math.round((spr.width * z) / 2), y - Math.round((spr.height * z) / 2), spr.width * z, spr.height * z);
  }

  private updateEffects(m: RugbyEngine, dt: number, frozen: boolean): void {
    const b = this.b;
    if (!frozen) {
      if (m.phase === "tackle" && this.prevPhase !== "tackle" && m.lastTackle) {
        const c = m.players[m.lastTackle.carrier];
        for (let i = 0; i < 10; i++) {
          this.dust.push({ x: c.pos.x, y: c.pos.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 4, life: 0.5 + Math.random() * 0.3 });
        }
      }
      this.prevPhase = m.phase;
      for (const d of this.dust) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vx *= 0.9;
        d.vy *= 0.9;
        d.life -= dt;
      }
      this.dust = this.dust.filter((d) => d.life > 0);
    }
    for (const d of this.dust) {
      b.fillStyle = `rgba(226,232,240,${clamp(d.life * 1.5, 0, 0.9)})`;
      const s = d.life > 0.4 ? 2 : 1;
      b.fillRect(this.sx(d.x), this.sy(d.y) - Math.round((0.6 - d.life) * 6), s * this.zoom, s * this.zoom);
    }
  }

  // ---------- text & panels (buffer coordinates) ----------
  text(
    s: string, x: number, y: number,
    o: { size?: number; color?: string; align?: CanvasTextAlign; shadow?: boolean; alpha?: number } = {},
  ): void {
    const b = this.b;
    const size = o.size ?? 8;
    b.font = `${size}px ${PIXEL_FONT}`;
    b.textBaseline = "top";
    b.textAlign = o.align ?? "left";
    if (o.alpha !== undefined) b.globalAlpha = o.alpha;
    if (o.shadow !== false) {
      b.fillStyle = "rgba(0,0,0,0.85)";
      const d = Math.max(1, Math.round(size / 8));
      b.fillText(s, x + d, y + d);
    }
    b.fillStyle = o.color ?? "#ffffff";
    b.fillText(s, x, y);
    b.globalAlpha = 1;
  }

  measure(s: string, size = 8): number {
    this.b.font = `${size}px ${PIXEL_FONT}`;
    return this.b.measureText(s).width;
  }

  panel(x: number, y: number, w: number, h: number, o: { fill?: string; border?: string; accent?: string } = {}): void {
    const b = this.b;
    b.fillStyle = o.fill ?? "rgba(8,12,24,0.86)";
    b.fillRect(x, y, w, h);
    b.fillStyle = o.border ?? "rgba(255,255,255,0.28)";
    b.fillRect(x, y, w, 1);
    b.fillRect(x, y + h - 1, w, 1);
    b.fillRect(x, y, 1, h);
    b.fillRect(x + w - 1, y, 1, h);
    if (o.accent) {
      b.fillStyle = o.accent;
      b.fillRect(x, y, 3, h);
    }
  }

  bar(x: number, y: number, w: number, h: number, frac: number, color: string, bg = "#1e293b"): void {
    const b = this.b;
    b.fillStyle = bg;
    b.fillRect(x, y, w, h);
    b.fillStyle = color;
    b.fillRect(x, y, Math.round(w * clamp(frac, 0, 1)), h);
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.b.fillStyle = color;
    this.b.fillRect(x, y, w, h);
  }

  fillEllipse(x: number, y: number, rx: number, ry: number, color: string): void {
    this.b.fillStyle = color;
    this.b.beginPath();
    this.b.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
    this.b.fill();
  }

  private drawLetterbox(k: number): void {
    const h = Math.round(28 * k);
    this.rect(0, 0, this.bufW, h, "#000");
    this.rect(0, this.bufH - h, this.bufW, h, "#000");
  }

  // ---------- HUD ----------
  private drawHUD(m: RugbyEngine): void {
    this.drawScoreboard(m);
    this.drawMessage(m);
    this.drawPlayerCard(m);
    this.drawMiniMap(m);
    if (this.showHelp && m.userTeam !== null) this.drawHelp();
    this.drawPhaseUI(m);


    // --- Draw Spectator Speed indicator if accelerated ---
    if (m.spectatorSpeed > 1) {
      this.panel(this.bufW - 90, 6, 84, 16, { accent: "#facc15" });
      this.text(">> SPECTATE 2X", this.bufW - 48, 10, { align: "center", color: "#facc15", size: 8 });
    }
  }

  private drawScoreboard(m: RugbyEngine): void {
    const x = 6;
    const y = 6;
    this.panel(x, y, 196, 18);
    this.rect(x + 4, y + 3, 4, 12, m.teams[0].color);
    this.rect(x + 188, y + 3, 4, 12, m.teams[1].color);
    this.text(m.teams[0].data.short, x + 12, y + 5);
    this.text(`${m.score[0]}-${m.score[1]}`, x + 98, y + 5, { align: "center", color: "#fde68a" });
    this.text(m.teams[1].data.short, x + 184, y + 5, { align: "right" });
    this.rect(m.possession === 0 ? x + 44 : x + 148, y + 8, 3, 3, "#facc15");
    this.panel(x + 200, y, 82, 18);
    this.text(m.gameClock(), x + 206, y + 5, { color: m.timeUp ? "#f87171" : "#ffffff" });
    this.text(m.half === 1 ? "1H" : "2H", x + 262, y + 5, { color: "#94a3b8" });
  }

  private drawMessage(m: RugbyEngine): void {
    const msg = m.message;
    if (msg.timer <= 0 || !msg.text) return;
    const big = msg.text.length <= 18 && msg.text === msg.text.toUpperCase();
    const size = big ? 16 : 8;
    const w = Math.max(this.measure(msg.text, size), msg.sub ? this.measure(msg.sub, 8) : 0) + 24;
    const h = msg.sub ? 36 : 22;
    const x = Math.round(this.bufW / 2 - w / 2);
    const y = 34;
    this.panel(x, y, Math.round(w), h, { accent: msg.color });
    this.text(msg.text, this.bufW / 2 + 2, y + 5, { size, align: "center", color: "#fff" });
    if (msg.sub) this.text(msg.sub, this.bufW / 2 + 2, y + (big ? 24 : 18), { align: "center", color: "#cbd5e1" });
  }

  private drawPlayerCard(m: RugbyEngine): void {
    if (m.userTeam === null || m.controlled < 0) return;
    const p = m.players[m.controlled];
    const x = 6;
    const y = this.bufH - 28;
    this.panel(x, y, 176, 22, { accent: m.teams[p.team].color });
    this.text(`${p.number} ${p.name.toUpperCase().slice(0, 15)}`, x + 8, y + 4, { color: "#fff" });
    const role = p.isForward ? "FORWARD" : p.number === 9 || p.number === 10 ? "HALF-BACK" : "BACK";
    this.text(`${role}  PACE ${p.attrs.speed.toFixed(1)}  POWER ${Math.round(p.attrs.strength)}`, x + 8, y + 14, { color: "#94a3b8" });
    if (m.charging) {
      const cx = this.sx(p.pos.x);
      const cy = this.sy(p.pos.y) - (FOOT_Y + 9) * this.zoom;
      this.rect(cx - 8, cy - 1, 16, 4, "#0b1020");
      this.rect(cx - 7, cy, Math.round(14 * m.kickCharge), 2, m.kickCharge > 0.22 ? "#fbbf24" : "#7dd3fc");
    }
    if (m.userOffsideWarning && Math.floor(this.now * 4) % 2 === 0) {
      this.text("GET ONSIDE!", this.sx(p.pos.x), this.sy(p.pos.y) - (FOOT_Y + 10) * this.zoom, { align: "center", color: "#f87171" });
    }
  }

  private drawMiniMap(m: RugbyEngine): void {
    const w = 96;
    const h = 56;
    const x = Math.round(this.bufW / 2 - w / 2);
    const y = this.bufH - h - 6;
    this.panel(x - 3, y - 3, w + 6, h + 6);
    this.rect(x, y, w, h, "#2f7d32");
    const mx = (wx: number) => x + Math.round((wx / L) * w);
    const my = (wy: number) => y + Math.round((wy / W) * h);
    for (const lx of [10, 32, 60, 88, 110]) this.rect(mx(lx), y, 1, h, "rgba(255,255,255,0.7)");
    for (const p of m.players) {
      this.rect(mx(p.pos.x) - 1, my(p.pos.y) - 1, 2, 2, m.teams[p.team].color);
      if (p.id === m.controlled && m.userTeam !== null) this.rect(mx(p.pos.x) - 2, my(p.pos.y) - 2, 4, 1, "#facc15");
    }
    this.rect(mx(m.ball.pos.x) - 1, my(m.ball.pos.y) - 1, 2, 2, "#fde68a");
    const hw = this.bufW / 2 / this.ppm;
    const hh = this.bufH / 2 / this.ppm;
    const cx = mx(this.cam.x - hw);
    const cy = my(this.cam.y - hh);
    const cw = Math.round(((2 * hw) / L) * w);
    const ch = Math.round(((2 * hh) / W) * h);
    this.rect(cx, cy, cw, 1, "rgba(255,255,255,0.5)");
    this.rect(cx, cy + ch, cw, 1, "rgba(255,255,255,0.5)");
    this.rect(cx, cy, 1, ch, "rgba(255,255,255,0.5)");
    this.rect(cx + cw, cy, 1, ch, "rgba(255,255,255,0.5)");
    const home = m.teams[0];
    this.text(home.dir === 1 ? `${home.data.short} >` : `< ${home.data.short}`, x + w / 2, y - 13, { align: "center", color: "#cbd5e1" });
  }

  private drawHelp(): void {
    const k = (c: string) => keyLabel(c, true);
    const bnd = this.bindings;
    const lines = [
      `${k(bnd.up)}${k(bnd.down)}${k(bnd.left)}${k(bnd.right)} MOVE ${k(bnd.sprint)} SPRINT`,
      `${k(bnd.passUp)}/${k(bnd.passDown)} PASS ${k(bnd.kick)} KICK ${k(bnd.dropGoal)} DROP`,
      `${k(bnd.action)} TACKLE/DIVE ${k(bnd.switch)} SWITCH`,
    ];
    if (bnd.up === "ArrowUp" && bnd.down === "ArrowDown") lines[0] = `ARROWS MOVE  ${k(bnd.sprint)} SPRINT`;
    const w = Math.max(...lines.map((l) => this.measure(l))) + 12;
    const h = 8 + lines.length * 11;
    const x = this.bufW - w - 6;
    const y = this.bufH - h - 6;
    this.panel(x, y, Math.round(w), h);
    lines.forEach((l, i) => this.text(l, x + 6, y + 5 + i * 11, { color: "#cbd5e1" }));
  }

  private banner(text: string, sub: string): void {
    const w = Math.max(this.measure(text), sub ? this.measure(sub) : 0) + 20;
    const x = Math.round(this.bufW / 2 - w / 2);
    const y = this.bufH - 100;
    this.panel(x, y, Math.round(w), sub ? 30 : 18);
    this.text(text, this.bufW / 2, y + 5, { align: "center" });
    if (sub) this.text(sub, this.bufW / 2, y + 17, { align: "center", color: "#facc15" });
  }

  private drawPhaseUI(m: RugbyEngine): void {
    const k = (c: string) => keyLabel(c, true);
    if ((m.phase === "kickoff" || m.phase === "dropout") && m.restart) {
      const mine = m.userTeam === m.restart.team;
      const label = m.phase === "kickoff" ? "KICK-OFF" : "GOAL-LINE DROP-OUT";
      this.banner(`${label} - ${m.teamName(m.restart.team).toUpperCase()}`, mine ? `PRESS ${k(this.bindings.action)} TO KICK` : "");
    } else if (m.phase === "scrum") {
      this.banner(`SCRUM - ${m.teamName(m.restart?.team ?? 0).toUpperCase()} BALL`, "");
    } else if (m.phase === "lineout") {
      this.banner(`LINEOUT - ${m.teamName(m.restart?.team ?? 0).toUpperCase()} THROW`, "");
    } else if (m.phase === "penaltyChoice" && m.penalty) {
      const pen = m.penalty;
      const mine = m.userTeam === pen.team;
      const w = 250;
      const h = 82;
      const x = Math.round(this.bufW / 2 - w / 2);
      const y = Math.round(this.bufH / 2 - h / 2);
      this.panel(x, y, w, h, { accent: m.teams[pen.team].color });
      this.text(`PENALTY - ${m.teamName(pen.team).toUpperCase()}`, x + 10, y + 6, { color: "#facc15" });
      this.text(`${Math.round(pen.distance)}M FROM THE POSTS`, x + 10, y + 18, { color: "#94a3b8" });
      const opts: [string, boolean][] = [
        [`${k(this.bindings.opt1)}  KICK AT GOAL${pen.canGoal ? "" : " (TOO FAR)"}`, pen.canGoal],
        [`${k(this.bindings.opt2)}  KICK TO TOUCH`, true],
        [`${k(this.bindings.opt3)}  TAP AND GO`, true],
      ];
      opts.forEach(([label, ok], i) => this.text(label, x + 10, y + 34 + i * 12, { color: ok ? "#fff" : "#64748b" }));
      if (!mine) this.text("CPU DECIDING...", x + w - 10, y + 70, { align: "right", color: "#94a3b8" });
    } else if (m.phase === "goalKick" && m.goalKick && m.goalKick.meter && !m.goalKick.launched) {
      const gk = m.goalKick;
      const meter = m.goalKick.meter;
      const w = 300;
      const h = 60;
      const x = Math.round(this.bufW / 2 - w / 2);
      const y = this.bufH - h - 80;
      this.panel(x, y, w, h);
      this.text(`${gk.kind === "conversion" ? "CONVERSION" : "PENALTY KICK"} - ${Math.round(gk.distance)}M`, x + w / 2, y + 5, { align: "center", color: "#facc15" });
      this.text("POWER", x + 10, y + 20, { color: "#94a3b8" });
      const power = meter.stage === "power" ? meter.value : meter.power;
      this.bar(x + 70, y + 20, 200, 6, power, power >= gk.requiredPower ? "#22c55e" : "#f59e0b");
      this.rect(x + 70 + Math.round(200 * gk.requiredPower), y + 18, 2, 10, "#fff");
      this.text("AIM", x + 10, y + 34, { color: "#94a3b8" });
      this.bar(x + 70, y + 34, 200, 6, 0, "#334155");
      this.rect(x + 70 + 92, y + 34, 16, 6, "#22c55e");
      if (meter.stage !== "power") {
        const a = meter.stage === "accuracy" ? meter.value : meter.accuracy;
        this.rect(x + 70 + Math.round(200 * a) - 1, y + 32, 2, 10, "#fff");
      }
      this.text(
        meter.stage === "power" ? `${k(this.bindings.action)}: SET POWER PAST THE MARKER` : `${k(this.bindings.action)}: STOP IN THE GREEN`,
        x + w / 2, y + 47, { align: "center", color: "#cbd5e1" },
      );
    }
  }
}

/** Render a static stadium picture into a DOM canvas (menus). */
export function renderStadiumThumb(canvas: HTMLCanvasElement, stadium: Stadium): void {
  const bufW = Math.max(80, Math.round(canvas.width / 2));
  const bufH = Math.max(45, Math.round(canvas.height / 2));
  const r = new Renderer(canvas, stadium, null, DEFAULT_BINDINGS, { bufW, bufH, ppm: bufW / 150 });
  r.renderStatic({ x: 60, y: 35 });
}
