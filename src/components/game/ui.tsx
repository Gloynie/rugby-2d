"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { renderStadiumThumb } from "@/game/render";
import { drawLookPreview, makeLook, type Pose, type View } from "@/game/sprites";
import type { Stadium, TeamData } from "@/game/types";

export function Kicker({ children, color, className = "" }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <p className={`font-pixel text-[9px] uppercase tracking-[0.25em] ${className}`} style={{ color: color ?? "#facc15" }}>
      {children}
    </p>
  );
}

export function Title({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={`font-pixel text-lg uppercase leading-relaxed drop-shadow-[3px_3px_0_#000] md:text-2xl ${className}`}>{children}</h1>
  );
}

export function Btn({
  children, onClick, primary, danger, disabled, selected, className = "", type = "button",
}: {
  children: ReactNode; onClick?: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; selected?: boolean;
  className?: string; type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-btn ${primary ? "primary" : ""} ${danger ? "danger" : ""} ${selected ? "selected" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = "", accent }: { children: ReactNode; className?: string; accent?: string }) {
  return (
    <div className={`px-panel ${className}`} style={accent ? { borderLeftColor: accent, borderLeftWidth: 6 } : undefined}>
      {children}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="font-pixel mx-0.5 inline-block border-2 border-black bg-white px-1.5 py-1 align-middle text-[8px] text-black shadow-[2px_2px_0_#000]">
      {children}
    </span>
  );
}

export function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

export function Crest({ team, size = 40, color }: { team: TeamData; size?: number; color?: string }) {
  const fill = color ?? team.primary;
  const clip = "polygon(0 0, 100% 0, 100% 68%, 50% 100%, 0 68%)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size * 1.12 }}>
      <div className="absolute inset-0" style={{ background: "#000", clipPath: clip }} />
      <div className="absolute inset-[2px]" style={{ background: team.secondary, clipPath: clip }} />
      <div className="absolute inset-[5px] grid place-items-center" style={{ background: fill, clipPath: clip }}>
        <span className="font-pixel" style={{ fontSize: Math.max(6, size / 5), color: isLight(fill) ? "#111" : "#fff", marginTop: -size * 0.12 }}>
          {team.short}
        </span>
      </div>
    </div>
  );
}

/** Draws a photo into a tiny canvas and upscales it – instant pixel art. */
export function PixelImage({ src, w = 128, className = "" }: { src: string; w?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const c = ref.current;
      if (!c) return;
      const h = Math.max(1, Math.round((w * img.height) / img.width));
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
    };
  }, [src, w]);
  return <canvas ref={ref} className={`pixelated h-full w-full object-cover ${className}`} />;
}

export function StadiumThumb({ stadium, className = "" }: { stadium: Stadium; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) renderStadiumThumb(ref.current, stadium);
  }, [stadium]);
  return <canvas ref={ref} width={320} height={180} className={`pixelated h-full w-full object-cover ${className}`} />;
}

export function PlayerSprite({
  jersey, jersey2, number, name, pose = "idle", view = "front", scale = 3, className = "",
}: {
  jersey: string; jersey2: string; number: number; name: string; pose?: Pose; view?: View; scale?: number; className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const look = makeLook(`prev-${jersey}-${number}`, jersey, jersey2, number, name);
    drawLookPreview(ref.current, look, view, pose, 0, scale);
  }, [jersey, jersey2, number, name, pose, view, scale]);
  return <canvas ref={ref} className={`pixelated ${className}`} style={{ width: 20 * scale, height: 28 * scale }} />;
}

/** Animated running sprite (menu decoration). */
export function RunningSprite({ jersey, jersey2, number, name, scale = 4 }: { jersey: string; jersey2: string; number: number; name: string; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const look = makeLook(`run-${jersey}-${number}`, jersey, jersey2, number, name);
    let frame = 0;
    const id = window.setInterval(() => {
      drawLookPreview(c, look, "side", "run", frame++, scale);
    }, 110);
    return () => window.clearInterval(id);
  }, [jersey, jersey2, number, name, scale]);
  return <canvas ref={ref} className="pixelated" style={{ width: 20 * scale, height: 28 * scale }} />;
}

export function Scroll({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`scroll h-full min-h-0 ${className}`}>{children}</div>;
}

export function ScreenHeader({ kicker, title, right }: { kicker: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <Kicker>{kicker}</Kicker>
        <Title>{title}</Title>
      </div>
      {right}
    </div>
  );
}
