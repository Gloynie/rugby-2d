"use client";

import { useEffect, useRef } from "react";
import { currentSettings } from "@/game/settings";
import { ANCHOR_X, FOOT_Y, SPR_H, SPR_W, hashStr, makeLook, spriteFactory } from "@/game/sprites";

const BUF_W = 320;
const BUF_H = 180;

interface Props {
  jersey?: string;
  jersey2?: string;
  playerName?: string;
  number?: number;
  night?: boolean;
}

/**
 * Animated title scene: an original pixel player walking away from camera down a
 * players' tunnel toward the floodlit pitch. One small buffer canvas, scaled up.
 */
export default function MenuScene({
  jersey = "#15803d",
  jersey2 = "#f8fafc",
  playerName = "PixelRuggas",
  number = 10,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const buf = document.createElement("canvas");
    buf.width = BUF_W;
    buf.height = BUF_H;
    const b = buf.getContext("2d");
    if (!b) return;
    b.imageSmoothingEnabled = false;

    const look = makeLook(`tunnel-${jersey}-${number}`, jersey, jersey2, number, playerName);
    const seed = hashStr(`${jersey}${playerName}`);
    const rnd = (n: number) => ((Math.sin(seed * 0.73 + n * 12.9898) * 43758.5453) % 1 + 1) % 1;

    // Vanishing point: the bright pitch opening the player walks toward.
    const vpX = Math.round(BUF_W * 0.52);
    const vpY = Math.round(BUF_H * 0.47);

    const px = (x: number, y: number, w: number, h: number, color: string) => {
      b.fillStyle = color;
      b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };

    // Crowd specks visible through the tunnel mouth.
    const crowd = Array.from({ length: 90 }, (_, i) => ({
      x: rnd(i) * 56 - 28,
      y: rnd(i + 400) * 18 - 9,
      c: ["#f8fafc", "#facc15", "#38bdf8", "#f87171", "#4ade80"][Math.floor(rnd(i + 800) * 5)],
    }));

    let raf = 0;
    let t0 = performance.now();
    let elapsed = 0;
    let stopped = false;

    const draw = (now: number) => {
      if (stopped) return;
      const dt = Math.min(0.1, (now - t0) / 1000);
      t0 = now;
      elapsed += dt;

      // 11s loop: the player strides away, reaches the light, scene fades and restarts.
      const LOOP = 11;
      const loopT = elapsed % LOOP;
      const walk = Math.min(1, loopT / 8.2);          // 0 near camera, 1 at the tunnel mouth
      const fade = loopT > 9.6 ? (loopT - 9.6) / 1.4 : 0;

      b.clearRect(0, 0, BUF_W, BUF_H);
      px(0, 0, BUF_W, BUF_H, "#05070d");

      // ---------------- tunnel mouth (bright pitch beyond) ----------------
      const openW = 74;
      const openH = 46;
      const ox = vpX - openW / 2;
      const oy = vpY - openH / 2;
      // layered glow around the opening
      for (let g = 7; g >= 1; g--) {
        b.globalAlpha = 0.055 * g;
        px(ox - g * 4, oy - g * 3, openW + g * 8, openH + g * 6, "#fff7cf");
      }
      b.globalAlpha = 1;
      px(ox, oy, openW, openH, "#cfe8b6");                // sunlit grass
      px(ox, oy, openW, 15, "#bcd9e8");                   // sky band
      for (let i = 0; i < 6; i++) px(ox, oy + 15 + i * 6, openW, 3, i % 2 ? "#c3e0a8" : "#b7d79b");
      // far stand + crowd inside the opening
      px(ox, oy + 9, openW, 7, "#55606e");
      for (const c of crowd) {
        const cx = vpX + c.x;
        const cy = vpY - 10 + c.y;
        if (cx > ox + 1 && cx < ox + openW - 2 && cy > oy + 8 && cy < oy + 16) {
          const bob = Math.sin(elapsed * 3 + c.x) > 0.3 ? -1 : 0;
          px(cx, cy + bob, 1, 1, c.c);
        }
      }
      // goalposts in the distance
      px(vpX - 11, oy + 16, 1, 11, "#f8fafc");
      px(vpX + 11, oy + 16, 1, 11, "#f8fafc");
      px(vpX - 11, oy + 19, 23, 1, "#f8fafc");

      // ---------------- tunnel walls in perspective ----------------
      const slabs = 15;
      for (let i = slabs - 1; i >= 0; i--) {
        const k = i / slabs;                       // 0 = nearest camera
        const far = 1 - k;
        const halfW = 26 + k * k * 210;
        const halfH = 18 + k * k * 132;
        const lx = vpX - halfW;
        const rx = vpX + halfW;
        const ty = vpY - halfH;
        const by = vpY + halfH;
        const shade = 0.1 + far * 0.42;
        const wall = `rgba(${Math.round(26 + shade * 44)},${Math.round(30 + shade * 46)},${Math.round(40 + shade * 56)},1)`;
        const thick = Math.max(2, Math.round(16 * k + 3));
        // side walls
        px(lx, ty, thick, by - ty, wall);
        px(rx - thick, ty, thick, by - ty, wall);
        // ceiling + floor
        px(lx, ty, rx - lx, Math.max(2, thick * 0.7), `rgba(16,19,28,1)`);
        px(lx, by - Math.max(2, thick * 0.6), rx - lx, Math.max(2, thick * 0.6), "#1b2030");
        // recessed ceiling light strip for every other slab
        if (i % 2 === 0) {
          const lw = Math.max(3, halfW * 0.5);
          px(vpX - lw / 2, ty + 1, lw, Math.max(1, Math.round(2 + k * 3)), "#fdf4d0");
          b.globalAlpha = 0.18;
          px(vpX - lw / 2 - 3, ty + 1, lw + 6, Math.max(2, Math.round(4 + k * 4)), "#fde68a");
          b.globalAlpha = 1;
        }
        // sponsor panel on the right wall, low and dim so it reads as set dressing
        if (i % 3 === 1 && k > 0.25) {
          px(rx - thick - Math.round(5 + k * 10), vpY - halfH * 0.1, Math.round(4 + k * 9), Math.round(7 + k * 16), "#213046");
        }
      }

      // red carpet running to the mouth
      for (let i = slabs - 1; i >= 0; i--) {
        const k = i / slabs;
        const halfW = (26 + k * k * 210) * 0.42;
        const halfH = 18 + k * k * 132;
        const y = vpY + halfH - Math.max(2, 16 * k * 0.6) - 1;
        px(vpX - halfW, y - Math.max(1, 7 * k), halfW * 2, Math.max(1, 8 * k), i % 2 ? "#6d1620" : "#7c1d26");
      }

      // ---------------- the player, walking away ----------------
      // Scale and position interpolate toward the vanishing point as they walk.
      const scale = 5.2 - walk * 3.9;
      const groundY = Math.round(BUF_H * 0.95 - walk * (BUF_H * 0.95 - (vpY + 20)));
      const heroX = Math.round(BUF_W * 0.60 - walk * (BUF_W * 0.60 - vpX));
      const frame = Math.floor(elapsed * 7) % 6;
      const sprite = spriteFactory().get(look, "back", "run", frame, false, -1);
      // contact shadow
      b.fillStyle = "rgba(0,0,0,0.45)";
      b.beginPath();
      b.ellipse(heroX, groundY + 1, 7 * scale * 0.42, 2.2 * scale * 0.3, 0, 0, Math.PI * 2);
      b.fill();
      b.drawImage(
        sprite,
        heroX - ANCHOR_X * scale,
        groundY - FOOT_Y * scale,
        SPR_W * scale,
        SPR_H * scale,
      );

      // warm bounce light from the pitch opening washing back over the scene
      const warm = b.createRadialGradient(vpX, vpY, 10, vpX, vpY, 190);
      warm.addColorStop(0, "rgba(255,244,205,0.30)");
      warm.addColorStop(1, "rgba(255,244,205,0)");
      b.fillStyle = warm;
      b.fillRect(0, 0, BUF_W, BUF_H);

      // left-side darkening so the nav list stays legible on top
      const shade = b.createLinearGradient(0, 0, BUF_W, 0);
      shade.addColorStop(0, "rgba(3,6,14,0.94)");
      shade.addColorStop(0.34, "rgba(3,6,14,0.62)");
      shade.addColorStop(0.72, "rgba(3,6,14,0.10)");
      shade.addColorStop(1, "rgba(3,6,14,0.45)");
      b.fillStyle = shade;
      b.fillRect(0, 0, BUF_W, BUF_H);
      // top and bottom falloff for the header / prompt bar
      const vert = b.createLinearGradient(0, 0, 0, BUF_H);
      vert.addColorStop(0, "rgba(3,6,14,0.72)");
      vert.addColorStop(0.25, "rgba(3,6,14,0)");
      vert.addColorStop(0.78, "rgba(3,6,14,0)");
      vert.addColorStop(1, "rgba(3,6,14,0.82)");
      b.fillStyle = vert;
      b.fillRect(0, 0, BUF_W, BUF_H);

      // loop cross-fade
      if (fade > 0) {
        b.fillStyle = `rgba(3,6,14,${Math.min(1, fade)})`;
        b.fillRect(0, 0, BUF_W, BUF_H);
      }

      const smooth = currentSettings().smooth;
      ctx.imageSmoothingEnabled = smooth;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(buf, 0, 0, canvas.width, canvas.height);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [jersey, jersey2, playerName, number]);

  return (
    <canvas
      ref={ref}
      width={BUF_W * 4}
      height={BUF_H * 4}
      aria-hidden
      className="pixelated game-canvas absolute inset-0 h-full w-full object-cover"
    />
  );
}
