import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { makeLook, spriteFactory, POSE_FRAMES, SPR_W, SPR_H, type Pose, type View } from "../src/game/sprites";

function hex(c: string): [number, number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) { const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255]; }
  const r = /rgba?\(([^)]+)\)/.exec(c);
  if (r) { const p = r[1].split(",").map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 255 : Math.round(p[3] * 255)]; }
  return [255, 0, 255, 255];
}
class SoftCanvas {
  width = 0; height = 0; data!: Uint8ClampedArray; fillStyle = "#000"; imageSmoothingEnabled = false;
  ensure() { if (!this.data || this.data.length !== this.width * this.height * 4) this.data = new Uint8ClampedArray(this.width * this.height * 4); }
  getContext() { this.ensure(); return this; }
  fillRect(x: number, y: number, w: number, h: number) { this.ensure(); const [r, g, b, a] = hex(this.fillStyle); for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { if (xx < 0 || yy < 0 || xx >= this.width || yy >= this.height) continue; const i = (yy * this.width + xx) * 4; this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = a; } }
  getImageData(x: number, y: number, w: number, h: number) { return { data: this.data.slice(0), width: w, height: h }; }
  putImageData(img: { data: Uint8ClampedArray }) { this.data.set(img.data); }
  clearRect() {} translate() {} rotate() {} scale() {} drawImage() {}
}
(globalThis as any).document = { createElement: () => new SoftCanvas() };

const look = makeLook("t", "#166534", "#facc15", 12, "Damian de Allende");
const look2 = makeLook("t2", "#f5f5f5", "#c8102e", 7, "Sam Underhill");
const poses: Pose[] = ["idle", "run", "tired", "pass", "kick", "dive", "lie", "celebrate", "bind"];
const views: View[] = ["side", "front", "back"];
const S = 5;
const cols = 14; const rows = views.length * 2;
const W = cols * (SPR_W + 2) * S, H = rows * (SPR_H + 2) * S;
const out = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) { out[i * 4] = 46; out[i * 4 + 1] = 125; out[i * 4 + 2] = 50; out[i * 4 + 3] = 255; }
let row = 0;
for (const lk of [look, look2]) for (const v of views) {
  let col = 0;
  for (const p of poses) for (let f = 0; f < POSE_FRAMES[p] && col < cols; f++) {
    const spr = spriteFactory().get(lk, v, p, f, false, -1) as unknown as SoftCanvas;
    for (let y = 0; y < SPR_H; y++) for (let x = 0; x < SPR_W; x++) {
      const i = (y * SPR_W + x) * 4; if (spr.data[i + 3] === 0) continue;
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
        const ox = (col * (SPR_W + 2) + x) * S + dx, oy = (row * (SPR_H + 2) + y) * S + dy; const o = (oy * W + ox) * 4;
        out[o] = spr.data[i]; out[o + 1] = spr.data[i + 1]; out[o + 2] = spr.data[i + 2]; out[o + 3] = 255;
      }
    }
    col++;
  }
  row++;
}
// PNG encode
const crcTable = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c; }
const crc32 = (buf: Uint8Array) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type: string, data: Uint8Array) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), Buffer.from(data)]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(out.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array(0))]);
writeFileSync("/tmp/sheet.png", png);
console.log("wrote /tmp/sheet.png", W, H);
