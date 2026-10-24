import type { Renderer } from "./render";
import type { Vec2 } from "./types";

/**
 * Cinematic camera shots drawn on top of the live game. These run via the director's
 * `drawOverlay` hook so the engine keeps stepping while they play.
 */
export const CameraShots = {
  /** Slow wide pan across a packed stand while the ball is out of play. */
  crowdPan(r: Renderer, _target: Vec2, progress: number): void {
    const b = r.drawBuffer;
    const w = r.bufW, h = r.bufH;
    // Cinematic darken + soft top/bottom bars
    const grad = b.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(2,6,16,0.65)");
    grad.addColorStop(0.32, "rgba(2,6,16,0.05)");
    grad.addColorStop(0.78, "rgba(2,6,16,0.0)");
    grad.addColorStop(1, "rgba(2,6,16,0.55)");
    b.fillStyle = grad;
    b.fillRect(0, 0, w, h);
    // Letterbox
    r.rect(0, 0, w, 18, "#000");
    r.rect(0, h - 18, w, 18, "#000");
    // Slide banner
    const x = Math.round(((progress * 2) % 1) * 240) - 120;
    r.panel(8 + x, h - 30, 200, 14);
    r.text("CROWD PAN", 14 + x, h - 27, { color: "#fde68a", size: 6 });
    r.text(String(1 + Math.floor(progress * 8)) + " / 8", 14 + x, h - 18, { color: "#94a3b8", size: 5 });
  },

  /** Close-up on the captain, used for big moments. */
  celebration(r: Renderer, scorerName: string, teamColor: string): void {
    const b = r.drawBuffer;
    // radial tint
    const glow = b.createRadialGradient(r.bufW / 2, r.bufH / 2, 30, r.bufW / 2, r.bufH / 2, 260);
    glow.addColorStop(0, "rgba(255,255,255,0.18)");
    glow.addColorStop(1, "rgba(0,0,0,0.55)");
    b.fillStyle = glow;
    b.fillRect(0, 0, r.bufW, r.bufH);
    // banner
    r.panel(0, r.bufH - 56, r.bufW, 28);
    r.rect(0, r.bufH - 56, r.bufW, 3, teamColor);
    r.text("TRY", r.bufW / 2, r.bufH - 50, { align: "center", color: "#fde68a", size: 14 });
    r.text(scorerName.toUpperCase().slice(0, 26), r.bufW / 2, r.bufH - 32, { align: "center", color: "#f8fafc", size: 8 });
  },

  /** Top-down broadcast replay card with the time and teams. */
  replay(r: Renderer, label: string, home: string, away: string, homeScore: number, awayScore: number, minute: number): void {
    const b = r.drawBuffer;
    r.rect(0, 0, r.bufW, r.bufH, "rgba(2,4,10,0.55)");
    r.panel(r.bufW - 168, 6, 162, 56);
    r.text("REPLAY", r.bufW - 160, 12, { color: "#fde68a", size: 8 });
    r.text(label.toUpperCase().slice(0, 18), r.bufW - 160, 24, { color: "#f8fafc", size: 7 });
    r.text(`${home} ${homeScore}  ·  ${away} ${awayScore}`, r.bufW - 160, 36, { color: "#cbd5e1", size: 6 });
    r.text(`${minute}'`, r.bufW - 160, 50, { color: "#fde68a", size: 9 });
  },

  /** Low-angle crowd reaction: pixelated fans waving in the stands. */
  crowdWave(r: Renderer, t: number): void {
    const b = r.drawBuffer;
    const w = r.bufW, h = r.bufH;
    b.fillStyle = "rgba(0,0,0,0.35)";
    b.fillRect(0, h * 0.35, w, h * 0.45);
    const rows = 5;
    for (let r2 = 0; r2 < rows; r2++) {
      const y = h * (0.35 + r2 / rows);
      const fade = r2 / rows;
      for (let x = 0; x < w; x += 3) {
        const sway = Math.sin(t * 6 + x * 0.18 + r2) > 0.2 ? -1 : 0;
        b.fillStyle = ["#fbbf24", "#f8fafc", "#22c55e", "#3b82f6", "#f87171"][(r2 + (x / 3 | 0)) % 5];
        b.fillRect(x, y + sway, 2, 2);
        if (fade < 0.4) {
          b.fillStyle = "rgba(0,0,0,0.2)";
          b.fillRect(x, y - 1, 2, 1);
        }
      }
    }
  },
};

/**
 * Crowd reaction shot: the stands going up after a score. `tint` is the scoring team's colour
 * so the celebrating end of the ground reads as their supporters.
 */
export function crowdReaction(r: Renderer, t: number, tint: string): void {
  const b = r.drawBuffer;
  const W = r.bufW;
  const H = r.bufH;
  b.fillStyle = "#0a0f1e";
  b.fillRect(0, 0, W, H);

  const skins = ["#f3d1b0", "#e6b48c", "#c8865a", "#8d5a3b", "#5b3a29"];
  const shirts = [tint, "#f8fafc", "#cbd5e1", "#94a3b8", "#1f2937", tint];

  // Banked stand, low angle looking up into the crowd.
  const rows = 8;
  for (let row = 0; row < rows; row++) {
    const bandH = Math.round(H * 0.082);
    const y = Math.round(H * 0.3) + row * bandH;
    const depth = row / rows;
    b.fillStyle = `rgba(${Math.round(24 + depth * 40)},${Math.round(30 + depth * 44)},${Math.round(48 + depth * 56)},1)`;
    b.fillRect(0, y, W, bandH);
    b.fillStyle = "rgba(0,0,0,0.35)";
    b.fillRect(Math.round(W * 0.5), y, 10, bandH);

    // Proper supporters: head, torso, some with arms in the air.
    const stepX = 11;
    for (let i = 0; i * stepX < W; i++) {
      const seed = (i * 31 + row * 17) % 100;
      const x = i * stepX + ((i * 13) % 3);
      const jump = Math.sin(t * 7 + seed) > 0.25 ? -2 : 0;
      const skin = skins[seed % skins.length];
      const shirt = shirts[seed % shirts.length];
      const armsUp = seed % 3 === 0;
      // head
      b.fillStyle = skin;
      b.fillRect(x + 3, y + 3 + jump, 3, 3);
      // torso
      b.fillStyle = shirt;
      b.fillRect(x + 1, y + 6 + jump, 7, 5);
      // arms
      if (armsUp) {
        b.fillStyle = skin;
        b.fillRect(x, y + 1 + jump, 1, 4);
        b.fillRect(x + 8, y + 1 + jump, 1, 4);
      }
    }
  }
  // roof shadow + bottom falloff, no caption text (clean broadcast shot)
  b.fillStyle = "rgba(4,8,18,0.55)";
  b.fillRect(0, 0, W, Math.round(H * 0.3));
  b.fillStyle = "rgba(4,8,18,0.9)";
  b.fillRect(0, H - 10, W, 10);
}
