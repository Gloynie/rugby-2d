"use client";

import { useEffect, useRef, useState } from "react";
import { currentSettings } from "@/game/settings";
import { ANCHOR_X, FOOT_Y, SPR_H, SPR_W, hashStr, makeLook, spriteFactory } from "@/game/sprites";
import MenuScene from "./MenuScene";

const BUF_W = 320;
const BUF_H = 180;

interface SceneProps {
  jersey: string;
  jersey2: string;
  playerName: string;
  number: number;
}

type Px = (x: number, y: number, w: number, h: number, color: string) => void;

function useSceneCanvas(draw: (b: CanvasRenderingContext2D, px: Px, t: number) => void, deps: unknown[]) {
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
    const px: Px = (x, y, w, h, c) => {
      b.fillStyle = c;
      b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    let raf = 0;
    let t0 = performance.now();
    let t = 0;
    let stopped = false;
    const frame = (now: number) => {
      if (stopped) return;
      t += Math.min(0.1, (now - t0) / 1000);
      t0 = now;
      b.clearRect(0, 0, BUF_W, BUF_H);
      draw(b, px, t);
      ctx.imageSmoothingEnabled = currentSettings().smooth;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(buf, 0, 0, canvas.width, canvas.height);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/** Scene 2: night floodlit pitch, the hero idling by the posts, crowd behind. */
function FloodlitScene({ jersey, jersey2, playerName, number }: SceneProps) {
  const ref = useSceneCanvas((b, px, t) => {
    const look = makeLook(`flood-${jersey}-${number}`, jersey, jersey2, number, playerName);
    const seed = hashStr(playerName);
    const rnd = (n: number) => ((Math.sin(seed * 0.37 + n * 12.9898) * 43758.5453) % 1 + 1) % 1;
    // sky + stands
    px(0, 0, BUF_W, 18, "#070b1c");
    px(0, 18, BUF_W, 58, "#121a2e");
    for (let i = 0; i < 380; i++) {
      const x = Math.floor(rnd(i) * BUF_W);
      const y = 20 + Math.floor(rnd(i + 500) * 50);
      const bob = Math.sin(t * 2.4 + rnd(i + 900) * 7) > 0.45 ? -1 : 0;
      px(x, y + bob, 2, 2, ["#f8fafc", "#facc15", "#1d4ed8", "#dc2626", "#94a3b8", "#22c55e"][Math.floor(rnd(i + 1300) * 6)]);
    }
    // floodlight glow
    for (const fx of [40, 280]) {
      px(fx - 1, 4, 3, 22, "#1f2937");
      px(fx - 9, 0, 19, 6, "#374151");
      const g = b.createRadialGradient(fx, 4, 2, fx, 4, 90);
      g.addColorStop(0, "rgba(253,230,138,0.26)");
      g.addColorStop(1, "rgba(253,230,138,0)");
      b.fillStyle = g;
      b.fillRect(fx - 90, 0, 180, 130);
    }
    px(0, 76, BUF_W, 4, "#0b1020");
    for (let i = 0; i < 12; i++) px(i * 28, 80, 27, 6, i % 2 ? "#0f172a" : "#facc15");
    // pitch
    for (let i = 0; i < 12; i++) px(i * 28, 86, 28, BUF_H - 86, i % 2 ? "#1f7a37" : "#1b6c31");
    px(0, 100, BUF_W, 1, "rgba(248,250,252,0.6)");
    px(0, 124, BUF_W, 1, "rgba(248,250,252,0.4)");
    // posts
    const gx = 214;
    px(gx - 16, 60, 2, 42, "#f8fafc");
    px(gx + 16, 60, 2, 42, "#f8fafc");
    px(gx - 16, 72, 34, 2, "#f8fafc");
    // hero idle, slight breathing bob
    const heroX = 200;
    const groundY = 160;
    const scale = 4;
    const f = Math.floor(t * 2) % 2;
    const spr = spriteFactory().get(look, "front", "idle", f, false, -1);
    b.fillStyle = "rgba(0,0,0,0.35)";
    b.beginPath();
    b.ellipse(heroX, groundY + 2, 18, 5, 0, 0, Math.PI * 2);
    b.fill();
    b.drawImage(spr, heroX - ANCHOR_X * scale * look.build.w, groundY - FOOT_Y * scale * look.build.h + Math.round(Math.sin(t * 1.5)), SPR_W * scale * look.build.w, SPR_H * scale * look.build.h);
    // readability shade on the left
    const sh = b.createLinearGradient(0, 0, BUF_W, 0);
    sh.addColorStop(0, "rgba(3,6,14,0.92)");
    sh.addColorStop(0.42, "rgba(3,6,14,0.5)");
    sh.addColorStop(1, "rgba(3,6,14,0.08)");
    b.fillStyle = sh;
    b.fillRect(0, 0, BUF_W, BUF_H);
  }, [jersey, jersey2, playerName, number]);
  return <canvas ref={ref} width={BUF_W * 4} height={BUF_H * 4} aria-hidden className="pixelated game-canvas absolute inset-0 h-full w-full object-cover" />;
}

/** Scene 3: dressing room before kick-off — jersey on the peg, hero sitting, lockers. */
function DressingRoomScene({ jersey, jersey2, playerName, number }: SceneProps) {
  const ref = useSceneCanvas((b, px, t) => {
    const look = makeLook(`room-${jersey}-${number}`, jersey, jersey2, number, playerName);
    // walls + floor
    px(0, 0, BUF_W, 118, "#1c2433");
    px(0, 0, BUF_W, 6, "#0f1522");
    px(0, 118, BUF_W, BUF_H - 118, "#2b2320");
    for (let x = 0; x < BUF_W; x += 16) px(x, 118, 1, BUF_H - 118, "rgba(0,0,0,0.25)");
    // bench along the back wall
    px(90, 96, 230, 8, "#5b4636");
    px(96, 104, 6, 14, "#3b2d24");
    px(306, 104, 6, 14, "#3b2d24");
    // lockers with hanging jerseys
    for (let i = 0; i < 6; i++) {
      const lx = 100 + i * 36;
      px(lx, 18, 30, 76, "#2d3748");
      px(lx + 2, 20, 26, 72, "#1f2937");
      px(lx + 12, 22, 6, 3, "#9ca3af");             // hook
      px(lx + 7, 26, 16, 20, jersey);                 // hanging jersey
      px(lx + 11, 26, 8, 2, jersey2);
      // number on the back
      px(lx + 13, 33, 4, 6, "rgba(255,255,255,0.75)");
    }
    // strip light flicker
    const flick = Math.sin(t * 9) > 0.92 ? 0.55 : 0.85;
    px(60, 8, 200, 3, `rgba(253,244,208,${flick})`);
    const g = b.createRadialGradient(160, 10, 10, 160, 10, 160);
    g.addColorStop(0, `rgba(253,244,208,${0.22 * flick})`);
    g.addColorStop(1, "rgba(253,244,208,0)");
    b.fillStyle = g;
    b.fillRect(0, 0, BUF_W, 130);
    // hero sitting on the bench (idle sprite, lowered)
    const heroX = 206;
    const groundY = 128;
    const scale = 3.4;
    const f = Math.floor(t * 1.6) % 2;
    const spr = spriteFactory().get(look, "front", "idle", f, false, -1);
    b.fillStyle = "rgba(0,0,0,0.4)";
    b.beginPath();
    b.ellipse(heroX, groundY + 2, 16, 4, 0, 0, Math.PI * 2);
    b.fill();
    b.drawImage(spr, heroX - ANCHOR_X * scale * look.build.w, groundY - FOOT_Y * scale * look.build.h, SPR_W * scale * look.build.w, SPR_H * scale * look.build.h);
    // ball on the floor
    px(248, 150, 10, 6, "#b45309");
    px(250, 152, 6, 1, "#fde68a");
    const sh = b.createLinearGradient(0, 0, BUF_W, 0);
    sh.addColorStop(0, "rgba(3,6,14,0.92)");
    sh.addColorStop(0.4, "rgba(3,6,14,0.55)");
    sh.addColorStop(1, "rgba(3,6,14,0.12)");
    b.fillStyle = sh;
    b.fillRect(0, 0, BUF_W, BUF_H);
  }, [jersey, jersey2, playerName, number]);
  return <canvas ref={ref} width={BUF_W * 4} height={BUF_H * 4} aria-hidden className="pixelated game-canvas absolute inset-0 h-full w-full object-cover" />;
}

const SCENES = 3;
const ROTATE_MS = 24000;
const FADE_MS = 1400;

/**
 * Rotates between three animated backdrops with a cross-fade. The previous scene stays
 * mounted during the fade so there is never a black frame between them.
 */
export default function MenuBackdrops(props: SceneProps) {
  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => {
      setIdx((i) => {
        setPrev(i);
        return (i + 1) % SCENES;
      });
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (prev === null) return;
    const t = window.setTimeout(() => setPrev(null), FADE_MS);
    return () => window.clearTimeout(t);
  }, [prev]);

  const render = (i: number) =>
    i === 0 ? <MenuScene {...props} /> : i === 1 ? <FloodlitScene {...props} /> : <DressingRoomScene {...props} />;

  return (
    <div className="absolute inset-0">
      {prev !== null && (
        <div key={`prev-${prev}`} className="backdrop-fade-out absolute inset-0">{render(prev)}</div>
      )}
      <div key={`cur-${idx}`} className={`absolute inset-0 ${prev !== null ? "backdrop-fade-in" : ""}`}>{render(idx)}</div>
    </div>
  );
}
