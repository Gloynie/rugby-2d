"use client";

import { useEffect, useRef } from "react";
import { currentSettings } from "@/game/settings";
import { ANCHOR_X, FOOT_Y, SPR_H, SPR_W, hashStr, makeLook, spriteFactory, type Pose } from "@/game/sprites";

const BUF_W = 320;
const BUF_H = 180;

interface Props {
  jersey?: string;
  jersey2?: string;
  playerName?: string;
  number?: number;
  night?: boolean;
}

/** One scripted beat of the idle loop. */
interface Beat {
  pose: Pose;
  seconds: number;
  fps: number;
  /** hold the last frame instead of looping */
  hold?: boolean;
}

const LOOP: Beat[] = [
  { pose: "idle", seconds: 4.2, fps: 2 },
  { pose: "run", seconds: 2.6, fps: 10 },
  { pose: "idle", seconds: 2.4, fps: 2 },
  { pose: "pass", seconds: 0.55, fps: 1, hold: true },
  { pose: "idle", seconds: 2.2, fps: 2 },
  { pose: "kick", seconds: 0.7, fps: 1, hold: true },
  { pose: "idle", seconds: 3.0, fps: 2 },
  { pose: "celebrate", seconds: 2.4, fps: 4 },
];

/**
 * Animated pixel-art title scene: a single hero player idling on the pitch in front of a
 * floodlit crowd. Deliberately cheap to draw – one small buffer canvas scaled up.
 */
export default function MenuScene({
  jersey = "#15803d",
  jersey2 = "#f8fafc",
  playerName = "PixelRuggas",
  number = 10,
  night = true,
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

    const look = makeLook(`menu-${jersey}-${number}`, jersey, jersey2, number, playerName);
    const seed = hashStr(`${jersey}${playerName}`);
    const rnd = (n: number) => ((Math.sin(seed * 0.73 + n * 12.9898) * 43758.5453) % 1 + 1) % 1;

    // pre-computed crowd so the stands stay stable between frames
    const crowd = Array.from({ length: 420 }, (_, i) => ({
      x: Math.floor(rnd(i) * (BUF_W + 16)) - 8,
      y: 18 + Math.floor(rnd(i + 900) * 52),
      c: ["#f8fafc", "#facc15", "#1d4ed8", "#dc2626", "#94a3b8", "#22c55e"][Math.floor(rnd(i + 1700) * 6)],
      p: rnd(i + 2600),
    }));

    const px = (x: number, y: number, w: number, h: number, color: string) => {
      b.fillStyle = color;
      b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };

    // Hero stands slightly right of centre so menu text has room on the left.
    const heroX = Math.round(BUF_W * 0.68);
    const groundY = Math.round(BUF_H * 0.88);
    const scale = 4;

    let raf = 0;
    let t0 = performance.now();
    let elapsed = 0;
    let stopped = false;

    const totalLoop = LOOP.reduce((s, x) => s + x.seconds, 0);

    const draw = (now: number) => {
      if (stopped) return;
      const dt = Math.min(0.1, (now - t0) / 1000);
      t0 = now;
      elapsed += dt;
      const loopT = elapsed % totalLoop;

      // which scripted beat are we in?
      let acc = 0;
      let beat = LOOP[0];
      let beatT = 0;
      for (const x of LOOP) {
        if (loopT < acc + x.seconds) {
          beat = x;
          beatT = loopT - acc;
          break;
        }
        acc += x.seconds;
      }
      const frame = beat.hold ? 0 : Math.floor(beatT * beat.fps);

      // ---------------- sky / stands ----------------
      b.clearRect(0, 0, BUF_W, BUF_H);
      const skyTop = night ? "#0a1026" : "#2c5f84";
      const skyLow = night ? "#13203f" : "#5e9ab8";
      px(0, 0, BUF_W, 14, skyTop);
      px(0, 14, BUF_W, 10, skyLow);

      // floodlight pylons + glow
      for (const fx of [34, 286]) {
        px(fx - 1, 6, 3, 22, "#1f2937");
        px(fx - 9, 2, 19, 6, "#374151");
        for (let i = 0; i < 6; i++) px(fx - 8 + i * 3, 3, 2, 3, "#fde68a");
        const glow = b.createRadialGradient(fx, 6, 2, fx, 6, 70);
        glow.addColorStop(0, "rgba(253,230,138,0.22)");
        glow.addColorStop(1, "rgba(253,230,138,0)");
        b.fillStyle = glow;
        b.fillRect(fx - 70, 0, 140, 110);
      }

      // stand structure
      px(0, 16, BUF_W, 58, night ? "#131a2e" : "#2b3448");
      px(0, 72, BUF_W, 4, "#0b1020");
      // crowd (two-phase bob so it looks alive)
      for (const c of crowd) {
        const bob = Math.sin(elapsed * 2.2 + c.p * 6.3) > 0.4 ? -1 : 0;
        px(c.x, c.y + bob, 2, 2, c.c);
      }
      // sponsor hoardings
      for (let i = 0; i < 12; i++) {
        px(i * 28, 76, 27, 7, i % 2 ? "#0f172a" : "#facc15");
      }

      // ---------------- pitch ----------------
      for (let i = 0; i < 12; i++) {
        px(i * 28, 83, 28, BUF_H - 83, i % 2 ? "#1f7a37" : "#1b6c31");
      }
      // try line + 22 markings running into the distance
      px(0, 96, BUF_W, 1, "rgba(248,250,252,0.65)");
      px(0, 118, BUF_W, 1, "rgba(248,250,252,0.45)");
      px(heroX + 54, 83, 1, BUF_H - 83, "rgba(248,250,252,0.35)");

      // goal posts behind the hero
      px(heroX - 72, 60, 2, 36, "#f8fafc");
      px(heroX - 40, 60, 2, 36, "#f8fafc");
      px(heroX - 72, 70, 34, 2, "#f8fafc");

      // ---------------- hero player ----------------
      const view = beat.pose === "run" ? "side" : "front";
      const sprite = spriteFactory().get(look, view, beat.pose, frame, false, -1);
      // soft shadow
      b.fillStyle = "rgba(0,0,0,0.33)";
      b.beginPath();
      b.ellipse(heroX, groundY + 2, 20, 5, 0, 0, Math.PI * 2);
      b.fill();
      const bobY = beat.pose === "idle" ? Math.round(Math.sin(elapsed * 1.6) * 1) : 0;
      b.drawImage(
        sprite,
        heroX - ANCHOR_X * scale,
        groundY - FOOT_Y * scale + bobY,
        SPR_W * scale,
        SPR_H * scale,
      );

      // ball resting at his feet (hidden while he kicks it)
      if (beat.pose !== "kick") {
        px(heroX + 26, groundY - 6, 8, 5, "#b45309");
        px(heroX + 28, groundY - 5, 4, 1, "#fde68a");
      } else {
        const k = Math.min(1, beatT / beat.seconds);
        px(heroX + 30 + k * 58, groundY - 10 - Math.sin(k * Math.PI) * 42, 7, 5, "#b45309");
      }

      // vignette so menu text on the left stays readable
      const shade = b.createLinearGradient(0, 0, BUF_W, 0);
      shade.addColorStop(0, "rgba(4,8,18,0.92)");
      shade.addColorStop(0.45, "rgba(4,8,18,0.45)");
      shade.addColorStop(1, "rgba(4,8,18,0.05)");
      b.fillStyle = shade;
      b.fillRect(0, 0, BUF_W, BUF_H);
      b.fillStyle = "rgba(4,8,18,0.35)";
      b.fillRect(0, BUF_H - 16, BUF_W, 16);

      // ---------------- blit ----------------
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
  }, [jersey, jersey2, playerName, number, night]);

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
