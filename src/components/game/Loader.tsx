"use client";

import { useEffect, useRef, useState } from "react";

interface BootProps {
  label?: string;
  steps?: string[];
}

const TIPS = [
  "Draw a defender before you pass — the gap opens for your support runner.",
  "Kick from inside your own 22 and the lineout comes back to where you kicked.",
  "Find touch beyond the opposition 22 from your own half for a 50:22.",
  "Forwards bounce tacklers. Backs step them. Pick the right carrier.",
  "Mash the action key at a scrum — double the opposition shove wins a penalty.",
  "Tired players fumble. Watch the stamina bar before you sprint again.",
  "A drop goal is three points when the defence refuses to break.",
];

/** Full-screen animated loader: pixel pitch, spinning ball, shimmering bar and rotating tips. */
export default function Loader({ label, steps }: BootProps) {
  const list = steps && steps.length ? steps : ["WAKING THE GROUNDSMAN", "CHALKING THE LINES", "INFLATING THE BALL", "READY"];
  const [n, setN] = useState(0);
  const [tip, setTip] = useState(TIPS[0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const t = window.setInterval(() => setN((x) => Math.min(list.length, x + 1)), 420);
    return () => window.clearInterval(t);
  }, [list.length]);

  // Randomised only on the client so the server and browser HTML match.
  useEffect(() => {
    const pick = window.setTimeout(() => setTip(TIPS[Math.floor(Math.random() * TIPS.length)]), 0);
    return () => window.clearTimeout(pick);
  }, []);

  // Pixel animation: a ball tumbling across a striped pitch with a bouncing shadow.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 180;
    const H = 54;
    const buf = document.createElement("canvas");
    buf.width = W;
    buf.height = H;
    const b = buf.getContext("2d");
    if (!b) return;
    b.imageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    let t = 0;
    let last = performance.now();
    let stopped = false;

    const px = (x: number, y: number, w: number, h: number, c: string) => {
      b.fillStyle = c;
      b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };

    const draw = (now: number) => {
      if (stopped) return;
      t += Math.min(0.08, (now - last) / 1000);
      last = now;
      b.clearRect(0, 0, W, H);

      // pitch stripes scrolling left
      const off = Math.floor((t * 34) % 16);
      for (let i = -1; i < W / 16 + 1; i++) {
        px(i * 16 - off, 34, 16, H - 34, i % 2 ? "#1f7a37" : "#1b6c31");
      }
      px(0, 33, W, 1, "rgba(248,250,252,0.55)");

      // crowd specks above the pitch
      for (let i = 0; i < 46; i++) {
        const cx = (i * 29 + Math.floor(t * 6)) % W;
        const cy = 8 + ((i * 7) % 18);
        const bob = Math.sin(t * 4 + i) > 0.4 ? -1 : 0;
        px(cx, cy + bob, 2, 2, ["#f8fafc", "#facc15", "#38bdf8", "#f87171"][i % 4]);
      }

      // ball arcing across, rotating through four frames
      const prog = (t * 0.55) % 1;
      const bx = prog * (W + 24) - 12;
      const by = 28 - Math.abs(Math.sin(prog * Math.PI * 2)) * 14;
      px(bx - 4, 33, 9, 2, "rgba(0,0,0,0.3)");
      const spin = Math.floor(t * 12) % 4;
      if (spin === 0) { px(bx - 5, by, 10, 6, "#b45309"); px(bx - 3, by + 2, 6, 1, "#fde68a"); }
      else if (spin === 1) { px(bx - 4, by - 1, 8, 8, "#b45309"); px(bx - 2, by + 2, 4, 1, "#fde68a"); }
      else if (spin === 2) { px(bx - 3, by - 2, 6, 10, "#b45309"); px(bx - 1, by + 2, 2, 2, "#fde68a"); }
      else { px(bx - 4, by - 1, 8, 8, "#b45309"); px(bx - 3, by + 3, 6, 1, "#fde68a"); }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(buf, 0, 0, canvas.width, canvas.height);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  const pct = Math.round((n / list.length) * 100);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#05070d]">
      <div className="menu-glow pointer-events-none absolute inset-0" />
      <div className="scanlines pointer-events-none absolute inset-0 opacity-25" />
      <div className="vignette pointer-events-none absolute inset-0" />

      <div className="relative flex w-[440px] max-w-[88vw] flex-col items-center">
        <p className="font-pixel loader-rise text-xl uppercase leading-none tracking-[0.1em] text-white drop-shadow-[3px_3px_0_#000]">
          Pixel<span className="text-green-400">Ruggas</span>
        </p>
        <p className="font-pixel loader-rise mt-2 text-[7px] uppercase tracking-[0.35em] text-slate-500" style={{ animationDelay: "90ms" }}>
          Pixel rugby union
        </p>

        <canvas
          ref={canvasRef}
          width={720}
          height={216}
          className="pixelated loader-rise mt-6 w-full border-2 border-black shadow-[4px_4px_0_#000]"
          style={{ animationDelay: "160ms" }}
          aria-hidden
        />

        <div className="loader-rise mt-5 w-full border-2 border-black bg-black/70 p-2.5 shadow-[4px_4px_0_#000]" style={{ animationDelay: "230ms" }}>
          <div className="relative h-3 w-full overflow-hidden border border-black bg-[#0b1020]">
            <div
              className="h-full bg-gradient-to-r from-green-500 via-yellow-400 to-yellow-300 transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(6, pct)}%` }}
            />
            <div className="loader-shimmer pointer-events-none absolute inset-y-0 w-16" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-pixel text-[7px] uppercase tracking-widest text-slate-300">
              {list[Math.min(n, list.length - 1)]}
              <span className="loader-dots" />
            </span>
            <span className="font-pixel text-[7px] text-yellow-300">{pct}%</span>
          </div>
        </div>

        {label && (
          <p className="font-pixel loader-rise mt-4 text-center text-[8px] uppercase leading-relaxed tracking-widest text-yellow-300" style={{ animationDelay: "300ms" }}>
            {label}
          </p>
        )}

        <div className="loader-rise mt-5 max-w-[380px] border-l-2 border-green-500/70 bg-black/40 px-3 py-2" style={{ animationDelay: "380ms" }}>
          <p className="font-pixel text-[6px] uppercase tracking-[0.3em] text-green-400">Tip</p>
          <p className="mt-1 text-[15px] leading-snug text-slate-300">{tip}</p>
        </div>
      </div>
    </div>
  );
}

/** Lightweight splash used while a screen mounts. */
export function Splash({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid h-full place-items-center">
      <p className="font-pixel animate-pulse text-[10px] uppercase tracking-[0.3em] text-yellow-300">{label}</p>
    </div>
  );
}
