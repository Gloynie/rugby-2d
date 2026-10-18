"use client";

import { useEffect, useState } from "react";

interface BootProps {
  /** show a custom line under the title */
  label?: string;
  /** estimated seconds shown as a deterministic progress bar */
  steps?: string[];
}

/** Full-screen pixel loader used for the very first paint and between major views. */
export default function Loader({ label, steps }: BootProps) {
  const [n, setN] = useState(0);
  const list = steps && steps.length ? steps : ["INIT", "LOAD KITS", "TUNE ENGINES", "READY"];
  useEffect(() => {
    const t = window.setInterval(() => setN((x) => Math.min(list.length, x + 1)), 220);
    return () => window.clearInterval(t);
  }, [list.length]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black">
      <div className="absolute inset-0 menu-glow" />
      <div className="scanlines absolute inset-0 opacity-30" />
      <div className="relative flex flex-col items-center gap-5">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 animate-ping rounded-full border-4 border-yellow-400/30" />
          <div className="grid h-full w-full place-items-center rounded-full border-4 border-yellow-400 bg-black shadow-[0_0_20px_rgba(250,204,21,0.6)]">
            <span className="font-pixel text-2xl text-yellow-300">R</span>
          </div>
        </div>
        <p className="font-pixel text-base uppercase tracking-[0.3em] text-yellow-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          PixelRuggas
        </p>
        <div className="w-72 max-w-[70vw] border-2 border-black bg-black/60 p-2 shadow-[3px_3px_0_#000]">
          <div className="flex h-3 w-full border border-black bg-black/50">
            <div
              className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all duration-200"
              style={{ width: `${Math.max(8, (n / list.length) * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-pixel text-[7px] uppercase tracking-widest text-slate-300">
            <span>{list[Math.min(n, list.length) - 1] ?? list[0]}</span>
            <span>{Math.round((n / list.length) * 100)}%</span>
          </div>
          {label && <p className="mt-2 text-center text-sm text-slate-400">{label}</p>}
        </div>
        <p className="font-pixel text-[8px] uppercase tracking-widest text-slate-500">
          Painted in pixels · powered by fans
        </p>
      </div>
    </div>
  );
}

/** Lightweight splash used while a screen is mounting (avoids a flash of the previous view). */
export function Splash({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid h-full place-items-center">
      <p className="font-pixel animate-pulse text-[10px] uppercase tracking-[0.3em] text-yellow-300">{label}</p>
    </div>
  );
}
