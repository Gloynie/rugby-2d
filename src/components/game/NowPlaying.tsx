"use client";

import { useMemo, type ReactNode } from "react";
import { music, useMusic } from "@/game/music/player";
import { hashStr } from "@/game/sprites";

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const ICON = "h-full w-full fill-current";

export function PrevIcon() {
  return <svg viewBox="0 0 24 24" className={ICON}><path d="M6 5h2v14H6zM20 5v14L9.5 12z" /></svg>;
}
export function NextIcon() {
  return <svg viewBox="0 0 24 24" className={ICON}><path d="M16 5h2v14h-2zM4 5l10.5 7L4 19z" /></svg>;
}
export function PlayIcon() {
  return <svg viewBox="0 0 24 24" className={ICON}><path d="M7 4.5v15l13-7.5z" /></svg>;
}
export function PauseIcon() {
  return <svg viewBox="0 0 24 24" className={ICON}><path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" /></svg>;
}
export function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17h3.5c2 0 3.3-1 4.6-3l1.8-2.6c1.3-2 2.6-3 4.6-3H21" />
      <path d="M3 7h3.5c2 0 3.3 1 4.6 3M13 14.5c1.2 1.4 2.4 2.5 4.5 2.5H21" />
      <path d="M18.5 4.5 21 7l-2.5 2.5M18.5 14.5 21 17l-2.5 2.5" />
    </svg>
  );
}

/** Generated album art – a gradient unique to each song with an equaliser overlay. */
export function Cover({ title, size = 44, playing }: { title: string; size?: number; playing?: boolean }) {
  const [a, b] = useMemo(() => {
    const h = hashStr(title);
    return [h % 360, (h >>> 9) % 360];
  }, [title]);
  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-lg border border-white/20"
      style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${a} 75% 48%), hsl(${b} 70% 28%))` }}
    >
      <span className={`flex items-end gap-[2px] text-white/90 ${playing ? "" : "eq-paused"}`} style={{ height: size * 0.4 }}>
        <i className="eq-bar" /><i className="eq-bar" /><i className="eq-bar" /><i className="eq-bar" />
      </span>
    </span>
  );
}

function IconBtn({ onClick, label, children, big, active }: { onClick: () => void; label: string; children: ReactNode; big?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid place-items-center rounded-full transition hover:scale-110 hover:text-yellow-300 ${
        big ? "h-9 w-9 bg-yellow-400 p-2 text-black hover:bg-yellow-300 hover:text-black" : "h-7 w-7 p-1.5 text-slate-200"
      } ${active ? "text-yellow-300" : ""}`}
    >
      {children}
    </button>
  );
}

function Progress({ time, duration, className = "" }: { time: number; duration: number; className?: string }) {
  const frac = duration > 0 ? Math.min(1, time / duration) : 0;
  return (
    <div
      className={`group relative h-1.5 cursor-pointer rounded-full bg-white/15 ${className}`}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        music.seek((e.clientX - r.left) / r.width);
      }}
    >
      <div className="h-full rounded-full bg-yellow-400" style={{ width: `${frac * 100}%` }} />
      <div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow group-hover:opacity-100" style={{ left: `calc(${frac * 100}% - 6px)` }} />
    </div>
  );
}

export default function NowPlaying({ variant = "pill", onOpen }: { variant?: "pill" | "full"; onOpen?: () => void }) {
  const m = useMusic();
  const t = m.current;
  const title = t?.title ?? (m.synth ? "Built-in stadium theme" : m.ready ? "No songs added yet" : "Loading music…");
  const artist = t?.artist ?? (m.synth ? "PixelRuggas" : m.ready ? "Add MP3s in Music" : "");
  const hint = m.needsGesture && m.ready ? "Click anywhere to start the music" : null;
  const long = title.length > 26;

  if (variant === "full") {
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.03] p-5">
        <div className="flex items-center gap-4">
          <Cover title={title} size={96} playing={m.playing} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-yellow-400">{m.playing ? "Now playing" : "Paused"}</p>
            <p className="truncate font-display text-3xl font-bold leading-tight">{title}</p>
            <p className="truncate text-xl text-slate-300">{artist}</p>
            {hint && <p className="mt-1 text-sm text-yellow-300">{hint}</p>}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="w-10 text-right text-sm tabular-nums text-slate-400">{fmt(m.time)}</span>
          <Progress time={m.time} duration={m.duration} className="flex-1" />
          <span className="w-10 text-sm tabular-nums text-slate-400">{fmt(m.duration)}</span>
        </div>
        <div className="mt-3 flex items-center justify-center gap-3">
          <IconBtn label={m.shuffle ? "Shuffle on" : "Shuffle off"} active={m.shuffle} onClick={() => music.setShuffle(!m.shuffle)}><ShuffleIcon /></IconBtn>
          <IconBtn label="Previous" onClick={() => music.prev()}><PrevIcon /></IconBtn>
          <IconBtn label={m.playing ? "Pause" : "Play"} big onClick={() => music.toggle()}>{m.playing ? <PauseIcon /> : <PlayIcon />}</IconBtn>
          <IconBtn label="Next" onClick={() => music.next()}><NextIcon /></IconBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-[360px] max-w-full items-center gap-3 rounded-full border border-white/15 bg-black/60 py-1.5 pl-1.5 pr-3 backdrop-blur">
      <Cover title={title} size={36} playing={m.playing} />
      <button type="button" onClick={onOpen} disabled={!onOpen} className="min-w-0 flex-1 overflow-hidden text-left" title="Open music library">
        <span className="block overflow-hidden whitespace-nowrap font-display text-[15px] font-bold leading-tight">
          <span className={long && m.playing ? "title-marquee" : "block truncate"}>{title}</span>
        </span>
        <span className="block truncate text-xs leading-tight text-slate-400">{hint ?? artist}</span>
      </button>
      <div className="flex items-center">
        <IconBtn label="Previous" onClick={() => music.prev()}><PrevIcon /></IconBtn>
        <IconBtn label={m.playing ? "Pause" : "Play"} big onClick={() => music.toggle()}>{m.playing ? <PauseIcon /> : <PlayIcon />}</IconBtn>
        <IconBtn label="Next" onClick={() => music.next()}><NextIcon /></IconBtn>
      </div>
    </div>
  );
}
