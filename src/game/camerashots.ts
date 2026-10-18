import type { Renderer } from "./render";
import { ANCHOR_X, FOOT_Y, SPR_H, SPR_W, spriteFactory, type Look } from "./sprites";
import type { Vec2 } from "./types";

/** A player to feature in a cinematic close-up. */
export interface FeaturedPlayer {
  look: Look;
  name: string;
  number: number;
  teamColor: string;
}

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

  /**
   * Side-on "touchline" shot: the featured player large on one side, running across a
   * blurred pitch, like a broadcast cut to the man on the ball during a stoppage.
   */
  sideline(r: Renderer, fp: FeaturedPlayer, t: number, caption: string): void {
    const b = r.drawBuffer;
    const w = r.bufW, h = r.bufH;
    // deep pitch backdrop with motion stripes
    b.fillStyle = "#0e3a1c";
    b.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      const off = Math.floor((t * 90) % 36);
      b.fillStyle = i % 2 ? "#13522a" : "#115024";
      b.fillRect(i * 36 - off, 0, 36, h);
    }
    // horizon stand band
    b.fillStyle = "#121a2e";
    b.fillRect(0, 0, w, Math.round(h * 0.34));
    for (let i = 0; i < 160; i++) {
      const x = (i * 17 + Math.floor(t * 20)) % w;
      const y = 6 + ((i * 11) % Math.round(h * 0.28));
      b.fillStyle = ["#f8fafc", "#facc15", "#1d4ed8", "#dc2626", "#94a3b8"][i % 5];
      b.fillRect(x, y, 2, 2);
    }
    b.fillStyle = "rgba(0,0,0,0.35)";
    b.fillRect(0, Math.round(h * 0.34), w, 3);
    // big running sprite, side view
    const scale = 7;
    const frame = Math.floor(t * 9) % 6;
    const spr = spriteFactory().get(fp.look, "side", "run", frame, false, -1);
    const gx = Math.round(w * 0.62);
    const gy = Math.round(h * 0.92);
    b.fillStyle = "rgba(0,0,0,0.4)";
    b.beginPath();
    b.ellipse(gx, gy + 3, 30, 7, 0, 0, Math.PI * 2);
    b.fill();
    b.drawImage(spr, gx - ANCHOR_X * scale * fp.look.build.w, gy - FOOT_Y * scale * fp.look.build.h, SPR_W * scale * fp.look.build.w, SPR_H * scale * fp.look.build.h);
    // letterbox + lower-third
    r.rect(0, 0, w, 18, "#000");
    r.rect(0, h - 18, w, 18, "#000");
    r.panel(14, h - 62, 220, 36);
    r.rect(14, h - 62, 4, 36, fp.teamColor);
    r.text(`${fp.number}  ${fp.name.toUpperCase().slice(0, 20)}`, 26, h - 55, { size: 8, color: "#ffffff" });
    r.text(caption.toUpperCase(), 26, h - 41, { size: 6, color: "#cbd5e1" });
  },

  /**
   * Front-on "tunnel cam" portrait: the featured player facing camera against a dark
   * backdrop with a slow light sweep – used for try-scorers and match-winners.
   */
  portrait(r: Renderer, fp: FeaturedPlayer, t: number, headline: string, sub: string): void {
    const b = r.drawBuffer;
    const w = r.bufW, h = r.bufH;
    b.fillStyle = "#05070d";
    b.fillRect(0, 0, w, h);
    // sweeping light bar
    const sx = ((t * 120) % (w + 160)) - 80;
    const g = b.createLinearGradient(sx - 80, 0, sx + 80, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.10)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    b.fillStyle = g;
    b.fillRect(0, 0, w, h);
    // team colour wash from below
    const tg = b.createLinearGradient(0, h, 0, h * 0.4);
    tg.addColorStop(0, fp.teamColor + "66");
    tg.addColorStop(1, fp.teamColor + "00");
    b.fillStyle = tg;
    b.fillRect(0, 0, w, h);
    // large front-facing sprite, gentle idle bob
    const scale = 8;
    const frame = Math.floor(t * 2) % 2;
    const spr = spriteFactory().get(fp.look, "front", "idle", frame, false, -1);
    const gx = Math.round(w / 2);
    const gy = Math.round(h * 0.98);
    b.drawImage(spr, gx - ANCHOR_X * scale * fp.look.build.w, gy - FOOT_Y * scale * fp.look.build.h + Math.round(Math.sin(t * 1.6)), SPR_W * scale * fp.look.build.w, SPR_H * scale * fp.look.build.h);
    r.rect(0, 0, w, 18, "#000");
    r.rect(0, h - 18, w, 18, "#000");
    r.text(headline.toUpperCase(), w / 2, 30, { size: 14, align: "center", color: "#facc15" });
    r.text(sub.toUpperCase().slice(0, 40), w / 2, 50, { size: 7, align: "center", color: "#e5e7eb" });
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
