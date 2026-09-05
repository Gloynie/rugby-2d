/**
 * Procedural pixel-art player sprites.
 * A tiny "pixel rig" draws a 20x28 character in three views (side / front / back) for a
 * set of poses & animation frames. Sprites are baked to small canvases and cached per look.
 */
export const SPR_W = 20;
export const SPR_H = 28;
export const ANCHOR_X = 10;
export const FOOT_Y = 26;
export const LIE_S = 28;

export type View = "side" | "front" | "back";
export type Pose = "idle" | "run" | "pass" | "kick" | "dive" | "lie" | "celebrate" | "bind";

export const POSE_FRAMES: Record<Pose, number> = {
  idle: 2, run: 6, pass: 1, kick: 1, dive: 1, lie: 1, celebrate: 2, bind: 1,
};

export interface Look {
  id: string;
  jersey: string;
  jersey2: string;
  shorts: string;
  socks: string;
  skin: string;
  hair: string | null;
  number: number;
}

const SKINS = ["#f3d1b0", "#e6b48c", "#c8865a", "#8d5a3b", "#5b3a29"];
const HAIRS: (string | null)[] = ["#1a1a1a", "#2d1b0e", "#5a3a1e", "#b8893a", "#a94a1e", "#1a1a1a", null];
const BOOT = "#15151a";
const OUTLINE: [number, number, number] = [10, 12, 22];

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function shade(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function makeLook(id: string, jersey: string, jersey2: string, number: number, name: string): Look {
  const h = hashStr(name);
  const skin = SKINS[h % SKINS.length];
  const hair = HAIRS[(h >>> 4) % HAIRS.length];
  const light = luminance(jersey) > 0.55;
  const shorts = light ? "#1f2937" : "#f1f5f9";
  const socks = light ? "#1f2937" : jersey;
  return { id, jersey, jersey2, shorts, socks, skin, hair, number };
}

export function teamLooks(teamKey: string, players: string[], jersey: string, jersey2: string): Look[] {
  return players.map((n, i) => makeLook(`${teamKey}-${jersey}-${i}`, jersey, jersey2, i + 1, n));
}

interface Params {
  lean: number;
  torsoDy: number;
  headDy: number;
  armF: number;
  armB: number;
  legF: number;
  legB: number;
  kneeF: number;
  kneeB: number;
  armsUp: boolean;
  armsSide: boolean;
  liftL: number;
  liftR: number;
  swingL: number;
  swingR: number;
  kickFront: boolean;
}

function baseParams(): Params {
  return {
    lean: 0, torsoDy: 0, headDy: 0, armF: 0, armB: 0, legF: 0, legB: 0, kneeF: 0, kneeB: 0,
    armsUp: false, armsSide: false, liftL: 0, liftR: 0, swingL: 0, swingR: 0, kickFront: false,
  };
}

export function poseParams(pose: Pose, frame: number): Params {
  const p = baseParams();
  switch (pose) {
    case "idle":
      if (frame % 2) p.torsoDy = 1;
      break;
    case "run": {
      const t = ((frame % 6) / 6) * Math.PI * 2;
      const s = Math.sin(t);
      const c = Math.cos(t);
      p.legF = 0.85 * s;
      p.legB = -p.legF;
      p.kneeF = 0.9 * Math.max(0, c);
      p.kneeB = 0.9 * Math.max(0, -c);
      p.armF = -0.7 * s;
      p.armB = -p.armF;
      p.torsoDy = frame % 3 === 1 ? -1 : 0;
      p.lean = 1;
      p.liftL = s > 0.3 ? 2 : 0;
      p.liftR = s < -0.3 ? 2 : 0;
      p.swingL = Math.round(-s);
      p.swingR = Math.round(s);
      break;
    }
    case "pass":
      p.armF = 1.5;
      p.armB = 1.4;
      p.lean = -1;
      p.armsSide = true;
      break;
    case "kick":
      p.legF = 1.35;
      p.legB = -0.3;
      p.armF = -1;
      p.armB = 1;
      p.lean = -1;
      p.kickFront = true;
      p.liftR = 3;
      break;
    case "dive":
      p.armF = Math.PI / 2;
      p.armB = Math.PI / 2;
      p.lean = 2;
      p.armsUp = true;
      break;
    case "lie":
      p.swingL = 1;
      p.swingR = -1;
      p.legF = 0.15;
      p.legB = -0.1;
      break;
    case "celebrate":
      p.armF = Math.PI;
      p.armB = Math.PI;
      p.armsUp = true;
      if (frame % 2) {
        p.torsoDy = -1;
        p.legF = 0.3;
        p.legB = -0.3;
      }
      break;
    case "bind":
      p.lean = 2;
      p.headDy = 3;
      p.torsoDy = 2;
      p.armF = 1.2;
      p.armB = 1.2;
      p.legF = 0.4;
      p.legB = -0.4;
      p.kneeF = 0.4;
      p.kneeB = 0.4;
      break;
  }
  return p;
}

type Px = (x: number, y: number, w: number, h: number, c: string) => void;

function armSide(px: Px, x: number, y: number, a: number, sleeve: string, skin: string): void {
  const step = a > 2.5 ? 2.2 : 1.8;
  let cx = x;
  let cy = y;
  for (let i = 0; i < 4; i++) {
    px(cx, cy, 2, 2, i < 2 ? sleeve : skin);
    cx += Math.sin(a) * step;
    cy += Math.cos(a) * step;
  }
}

function legSide(px: Px, hx: number, hy: number, theta: number, knee: number, skin: string, sock: string): void {
  let x = hx;
  let y = hy;
  for (let i = 0; i < 2; i++) {
    px(x, y, 2, 2, skin);
    x += Math.sin(theta) * 1.7;
    y += Math.cos(theta) * 1.7;
  }
  const sa = theta - knee;
  for (let i = 0; i < 2; i++) {
    px(x, y, 2, 2, sock);
    x += Math.sin(sa) * 1.7;
    y += Math.cos(sa) * 1.7;
  }
  px(x, y, 2, 1, BOOT);
}

function drawSide(px: Px, L: Look, P: Params): void {
  const ox = 2;
  const oy = 2;
  const bx = ox + P.lean;
  const ty = oy + P.torsoDy;
  const dj = shade(L.jersey, 0.72);
  const ds = shade(L.skin, 0.72);
  const dso = shade(L.socks, 0.72);
  armSide(px, bx + 6, ty + 8, P.armB, dj, ds);
  legSide(px, ox + 6, oy + 17, P.legB, P.kneeB, ds, dso);
  px(bx + 5, ty + 7, 6, 7 - P.torsoDy, L.jersey);
  px(bx + 7, ty + 7, 3, 1, L.jersey2);
  px(bx + 5, ty + 12, 6, 1, shade(L.jersey, 0.85));
  px(ox + 5, oy + 14, 6, 3, L.shorts);
  legSide(px, ox + 8, oy + 17, P.legF, P.kneeF, L.skin, L.socks);
  const hy = ty + 1 + P.headDy;
  if (hy + 5 < ty + 7) px(bx + 8, hy + 5, 2, 1, L.skin);
  px(bx + 7, hy, 5, 5, L.skin);
  if (L.hair) {
    px(bx + 7, hy, 5, 1, L.hair);
    px(bx + 7, hy + 1, 2, 2, L.hair);
  }
  px(bx + 10, hy + 2, 1, 1, "#111111");
  armSide(px, bx + 8, ty + 8, P.armF, L.jersey, L.skin);
}

function armDown(px: Px, x: number, y: number, swing: number, L: Look): void {
  px(x, y + swing, 2, 3, L.jersey);
  px(x, y + 2 + swing, 2, 1, L.jersey2);
  px(x, y + 3 + swing, 2, 3, L.skin);
}

function armUp(px: Px, x: number, y: number, L: Look): void {
  px(x, y - 2, 2, 3, L.jersey);
  px(x, y - 3, 2, 1, L.jersey2);
  px(x, y - 8, 2, 4, L.skin);
}

function legFront(px: Px, x: number, y: number, lift: number, L: Look, bigBoot: boolean): void {
  const yy = y - lift;
  px(x, yy, 2, 3, L.skin);
  px(x, yy + 3, 2, 4, L.socks);
  px(x, yy + 7, 2, 1, BOOT);
  if (bigBoot) px(x - 1, yy + 6, 4, 2, BOOT);
}

const DIGITS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "001", "001"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
};

function drawDigit(px: Px, d: string, x: number, y: number, c: string): void {
  const g = DIGITS[d];
  if (!g) return;
  for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r][k] === "1") px(x + k, y + r, 1, 1, c);
}

function drawNumber(px: Px, n: number, x0: number, y0: number, c: string): void {
  const s = String(n);
  if (s.length === 1) drawDigit(px, s, x0 + 2, y0, c);
  else {
    drawDigit(px, s[0], x0, y0, c);
    drawDigit(px, s[1], x0 + 5, y0, c);
  }
}

function drawFrontBack(px: Px, L: Look, P: Params, back: boolean): void {
  const ox = 2;
  const oy = 2;
  const ty = oy + P.torsoDy;
  legFront(px, ox + 5, oy + 17, P.liftL, L, false);
  legFront(px, ox + 9, oy + 17, P.liftR, L, P.kickFront);
  px(ox + 4, ty + 7, 8, 7 - P.torsoDy, L.jersey);
  if (!back) px(ox + 6, ty + 7, 4, 1, L.jersey2);
  px(ox + 4, ty + 12, 8, 1, shade(L.jersey, 0.85));
  px(ox + 4, oy + 14, 8, 3, L.shorts);
  if (P.armsUp) {
    armUp(px, ox + 2, ty + 8, L);
    armUp(px, ox + 12, ty + 8, L);
  } else if (P.armsSide) {
    px(ox + 12, ty + 9, 2, 2, L.jersey);
    px(ox + 14, ty + 9, 3, 2, L.skin);
    px(ox + 12, ty + 11, 2, 2, L.skin);
    px(ox + 2, ty + 8, 2, 3, L.jersey);
    px(ox + 2, ty + 11, 2, 2, L.skin);
  } else {
    armDown(px, ox + 2, ty + 8, P.swingL, L);
    armDown(px, ox + 12, ty + 8, P.swingR, L);
  }
  const hy = ty + 1 + P.headDy;
  if (hy + 5 < ty + 7) px(ox + 7, hy + 5, 2, 1, L.skin);
  px(ox + 5, hy, 6, 5, L.skin);
  if (L.hair) {
    if (back) px(ox + 5, hy, 6, 4, L.hair);
    else {
      px(ox + 5, hy, 6, 1, L.hair);
      px(ox + 5, hy + 1, 1, 2, L.hair);
      px(ox + 10, hy + 1, 1, 2, L.hair);
    }
  }
  if (!back) {
    px(ox + 6, hy + 2, 1, 1, "#111111");
    px(ox + 9, hy + 2, 1, 1, "#111111");
  } else {
    const nc = luminance(L.jersey) > 0.55 ? "#111827" : "#f8fafc";
    drawNumber(px, L.number, ox + 4, ty + 8, nc);
  }
}

function outline(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      const n =
        (x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w]);
      if (n) {
        d[i * 4] = OUTLINE[0];
        d[i * 4 + 1] = OUTLINE[1];
        d[i * 4 + 2] = OUTLINE[2];
        d[i * 4 + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export class SpriteFactory {
  private cache = new Map<string, HTMLCanvasElement>();

  /**
   * @param lie -1 for standing sprites, otherwise a rotation in degrees (multiple of 90) for a
   *            player lying on the ground (rendered from the back view, rotated so the head points that way).
   */
  get(look: Look, view: View, pose: Pose, frame: number, mirror: boolean, lie: number): HTMLCanvasElement {
    const f = ((frame % POSE_FRAMES[pose]) + POSE_FRAMES[pose]) % POSE_FRAMES[pose];
    const key = `${look.id}|${view}|${pose}|${f}|${mirror ? 1 : 0}|${lie}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    let out: HTMLCanvasElement;
    if (lie >= 0) {
      const base = this.base(look, "back", pose, f);
      const [c, ctx] = makeCanvas(LIE_S, LIE_S);
      ctx.translate(LIE_S / 2, LIE_S / 2);
      ctx.rotate((lie * Math.PI) / 180);
      ctx.drawImage(base, -SPR_W / 2, -SPR_H / 2);
      out = c;
    } else {
      const base = this.base(look, view, pose, f);
      if (mirror && view === "side") {
        const [c, ctx] = makeCanvas(SPR_W, SPR_H);
        ctx.translate(SPR_W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(base, 0, 0);
        out = c;
      } else out = base;
    }
    this.cache.set(key, out);
    return out;
  }

  private base(look: Look, view: View, pose: Pose, frame: number): HTMLCanvasElement {
    const key = `base|${look.id}|${view}|${pose}|${frame}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const [c, ctx] = makeCanvas(SPR_W, SPR_H);
    const px: Px = (x, y, w, h, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const params = poseParams(pose, frame);
    if (view === "side") drawSide(px, look, params);
    else drawFrontBack(px, look, params, view === "back");
    outline(ctx, SPR_W, SPR_H);
    this.cache.set(key, c);
    return c;
  }
}

let factory: SpriteFactory | null = null;
export function spriteFactory(): SpriteFactory {
  if (!factory) factory = new SpriteFactory();
  return factory;
}

/** Draw a single sprite frame into a DOM canvas (used for squad previews). */
export function drawLookPreview(
  canvas: HTMLCanvasElement, look: Look, view: View, pose: Pose, frame: number, scale: number,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = SPR_W * scale;
  canvas.height = SPR_H * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(spriteFactory().get(look, view, pose, frame, false, -1), 0, 0, canvas.width, canvas.height);
}
