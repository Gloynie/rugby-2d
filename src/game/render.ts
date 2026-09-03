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
  stamina: number;
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

export interface FrameOptions {
  stepEngine: boolean;
  frozen: boolean;
  zoom: 1 | 2;
  camTarget?: Vec2;
  freeCam?: boolean;
  snapCam?: boolean;
  camSpeed?: number;
  hideHUD: boolean;
  letterbox: number;
  flash: number;
  snapshot?: Snapshot;
  celebrate?: { team: TeamIndex; pos: Vec2 };
  drawOverlay?: (r: Renderer) => void;
}

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
  zoom: 1 | 2 = 1;
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
    const players: PlayerVisual[] = m.players.map((p) => {
      const speed = frozen ? 0 : hyp(p.vel.x, p.vel.y);
      const tired = p.stamina < 25;
      this.phase[p.id] = (this.phase[p.id] ?? 0) + speed * animDt * (tired ? 1.4 : 1.9);
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
        pose = tired ? "runtired" : "run";
        frame = Math.floor(this.phase[p.id]) % 6;
      } else {
        pose = tired ? "tired" : "idle";
        frame = Math.floor(this.now * 1.5 + p.id * 0.37) % 2;
      }
      const dx = Math.cos(facing);
      const dy = Math.sin(facing);
      const view: View = Math.abs(dx) >= 0.5 ? "side" : dy > 0 ? "front" : "back";
      return {
        id: p.id, team: p.team, x: p.pos.x, y: p.pos.y, view, mirror: view === "side" && dx < 0,
        pose, frame, lie, hasBall: m.ball.carrier === p.id, stamina: p.stamina,
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
    let opts = f;
    if (f.zoom !== this.zoom) {
      this.zoom = f.zoom;
      opts = { ...f, snapCam: true };
    }
    const snap = opts.snapshot ?? this.computeVisuals(m, opts.frozen ? 0 : dt, opts.frozen, opts.celebrate);
    if (!opts.snapshot) this.lastSnapshot = snap;
    this.updateCamera(m, snap, dt, opts);
    const b = this.b;
    b.clearRect(0, 0, this.bufW, this.bufH);
    this.drawStadium(opts.flash);
    this.drawPitch();
    if (!opts.snapshot) this.drawRuck(m);
    this.drawEntities(m, snap, opts);
    this.updateEffects(m, dt, opts.frozen || !!opts.snapshot);
    if (!opts.hideHUD) this.drawHUD(m);
    if (opts.letterbox > 0) this.drawLetterbox(opts.letterbox);
    opts.drawOverlay?.(this);
    this.blit();
  }

  /** Static stadium view (menus / thumbnails). */
  renderStatic(cam: Vec2, zoom: 1 | 2 = 1): void {
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

  // ---------- stadium & pitch ----------
  private drawStadium(flash: number): void {
    const b = this.b;
    const s = this.stadium;
    b.fillStyle = s.night ? shade(s.stand, 0.55) : s.stand;
    b.fillRect(0, 0, this.bufW, this.bufH);
    const excited = flash > 0.05;
    const frame = excited ? Math.floor(this.now * 8) % 2 : Math.floor(this.now * 1.6) % 2;
    const pat = this.crowd[frame];
    if (pat) {
      b.save();
      b.translate(mod(-this.cam.x * this.ppm, 32), mod(-this.cam.y * this.ppm, 32));
      b.fillStyle = pat;
      b.fillRect(-32, -32, this.bufW + 64, this.bufH + 64);
      b.restore();
    }
    if (excited) {
      const n = Math.floor(40 * flash);
      b.fillStyle = "#ffffff";
      for (let i = 0; i < n; i++) {
        b.fillRect(Math.floor(Math.random() * this.bufW), Math.floor(Math.random() * this.bufH), 2, 2);
      }
    }
    if (s.night) {
      b.fillStyle = "rgba(4,8,24,0.32)";
      b.fillRect(0, 0, this.bufW, this.bufH);
    }
    // stand front wall + walkway
    b.fillStyle = "#0b1020";
    b.fillRect(this.sx(-8), this.sy(-8), this.sw(L + 16), this.sw(W + 16));
    b.fillStyle = "#1f2937";
    b.fillRect(this.sx(-7.4), this.sy(-7.4), this.sw(L + 14.8), this.sw(W + 14.8));
    // hoardings
    const th = Math.max(1, this.sw(1));
    const seg = Math.max(4, this.sw(8));
    const x0 = this.sx(-6.5);
    const y0 = this.sy(-6.5);
    const x1 = this.sx(L + 6.5);
    const y1 = this.sy(W + 6.5);
    let i = 0;
    for (let x = x0; x < x1; x += seg, i++) {
      b.fillStyle = i % 2 ? s.accent : "#f8fafc";
      b.fillRect(x, y0 - th, Math.min(seg, x1 - x), th);
      b.fillStyle = i % 2 ? "#f8fafc" : s.accent;
      b.fillRect(x, y1, Math.min(seg, x1 - x), th);
    }
    i = 0;
    for (let y = y0; y < y1; y += seg, i++) {
      b.fillStyle = i % 2 ? "#f8fafc" : s.accent;
      b.fillRect(x0 - th, y, th, Math.min(seg, y1 - y));
      b.fillStyle = i % 2 ? s.accent : "#f8fafc";
      b.fillRect(x1, y, th, Math.min(seg, y1 - y));
    }
    // apron grass
    b.fillStyle = shade(s.grassB, 0.82);
    b.fillRect(x0, y0, x1 - x0, y1 - y0);
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
      if (v.id === controlled || v.stamina < 35) {
        const w = 10 * z;
        b.fillStyle = "#0b1020";
        b.fillRect(x - w / 2 - 1, y + 2 * z, w + 2, 2 * z + 2);
        b.fillStyle = v.stamina > 50 ? "#22c55e" : v.stamina > 25 ? "#facc15" : "#ef4444";
        b.fillRect(x - w / 2, y + 2 * z + 1, Math.round((w * v.stamina) / 100), 2 * z);
      }
      if (v.stamina < 25 && v.lie < 0 && Math.floor(this.now * 3 + v.id) % 3 === 0) {
        b.fillStyle = "#7dd3fc";
        b.fillRect(x + (v.mirror ? -5 : 4) * z, top + 2 * z, z, 2 * z);
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

    // --- Draw TMO overlay if active ---
    if (m.tmo.active) {
      this.drawTMOOverlay(m);
    }

    // --- Draw Spectator Speed indicator if accelerated ---
    if (m.spectatorSpeed > 1) {
      this.panel(this.bufW - 90, 6, 84, 16, { accent: "#facc15" });
      this.text(">> SPECTATE 2X", this.bufW - 48, 10, { align: "center", color: "#facc15", size: 8 });
    }
  }

  private drawTMOOverlay(m: RugbyEngine): void {
    const b = this.b;
    const w = 400;
    const h = 130;
    const x = Math.round(this.bufW / 2 - w / 2);
    const y = Math.round(this.bufH / 2 - h / 2 - 20);

    // Draw static background card
    this.panel(x, y, w, h, { fill: "rgba(10,15,30,0.95)", border: "#fbbf24", accent: "#fbbf24" });
    
    // Draw CRT static-noise scanline lines in review area
    b.fillStyle = "rgba(255,255,255,0.04)";
    for (let i = 0; i < h; i += 4) {
      if (Math.floor(this.now * 25 + i) % 3 === 0) {
        b.fillRect(x + 10, y + i, w - 20, 2);
      }
    }

    this.text("TMO TELEVISION REVIEW", this.bufW / 2, y + 10, { align: "center", color: "#fbbf24", size: 10 });
    this.text(`Potential: ${m.tmo.checkType.toUpperCase()}`, this.bufW / 2, y + 26, { align: "center", color: "#fff", size: 8 });
    
    // Animated progress scanbar
    const barWidth = 240;
    const barX = this.bufW / 2 - barWidth / 2;
    this.bar(barX, y + 42, barWidth, 6, (3.5 - m.tmo.timer) / 3.5, "#fbbf24");
    
    // Blinking TMO red alert dot
    const blink = Math.floor(this.now * 3) % 2 === 0;
    if (blink) {
      this.rect(this.bufW / 2 - 130, y + 10, 6, 6, "#ef4444");
    }

    // Live TMO decision text
    this.text(m.tmo.reason.toUpperCase(), this.bufW / 2, y + 64, { align: "center", color: "#cbd5e1", size: 8 });
    
    // Status message
    const decisionColor = m.tmo.decision === "confirmed" ? "#22c55e" : "#ef4444";
    const statusText = m.tmo.timer > 1.2 ? "ANALYSING REPLAY ANGLE..." : `DECISION: ${m.tmo.decision.toUpperCase()}`;
    this.text(statusText, this.bufW / 2, y + 84, { align: "center", color: m.tmo.timer > 1.2 ? "#94a3b8" : decisionColor, size: 8 });
    this.text("REFEREE CONSULTING VIDEO OFFICIAL", this.bufW / 2, y + 104, { align: "center", color: "#64748b", size: 8 });
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
    this.bar(x + 8, y + 15, 100, 3, p.stamina / 100, p.stamina > 50 ? "#22c55e" : p.stamina > 25 ? "#facc15" : "#ef4444");
    const maxStam = 100 - p.fatigue;
    this.rect(x + 8 + maxStam, y + 14, 1, 5, "#f87171");
    if (p.stamina < 25 && Math.floor(this.now * 3) % 2 === 0) this.text("TIRED", x + 116, y + 13, { color: "#f87171" });
    else this.text(`STA ${Math.round(p.stamina)}`, x + 116, y + 13, { color: "#94a3b8" });
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
