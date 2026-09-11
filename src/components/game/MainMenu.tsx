"use client";

import { useEffect, useRef, useState } from "react";
import * as audio from "@/game/audio";
import { COMPETITIONS, STADIUMS, TEAMS, getTeam } from "@/game/data";
import type { SessionUser } from "@/lib/auth";
import type { Screen } from "./GameShell";
import { Kbd, Kicker, PixelImage, RunningSprite } from "./ui";

interface Tile {
  id: string;
  title: string;
  sub: string;
  screen?: Screen;
  soon?: boolean;
  hot?: boolean;
}

interface UserRecord { wins: number; draws: number; losses: number }

// Layout: two hero tiles on top (Kick Off + Ultimate Team emphasized), two rows of four small tiles.
const ROWS = [[0, 1], [2, 3, 4, 5], [6, 7, 8, 9]];

function neighbour(current: number, key: "left" | "right" | "up" | "down"): number {
  const row = ROWS.findIndex((r) => r.includes(current));
  const col = ROWS[row].indexOf(current);
  if (key === "left") return ROWS[row][(col - 1 + ROWS[row].length) % ROWS[row].length];
  if (key === "right") return ROWS[row][(col + 1) % ROWS[row].length];
  const targetRow = key === "up" ? row - 1 : row + 1;
  if (targetRow < 0 || targetRow >= ROWS.length) return current;
  if (targetRow === 0) return col <= 1 ? 0 : 1;
  const targetCols = ROWS[targetRow];
  return targetCols[Math.min(col, targetCols.length - 1)];
}

export default function MainMenu({ user, go }: { user: SessionUser | null; go: (s: Screen) => void }) {
  const tiles: Tile[] = [
    { id: "play", title: "Kick Off", sub: "Quick match vs the CPU", screen: { name: "play" }, hot: true },
    { id: "ultimate", title: "Ultimate Team", sub: "Build your club · packs · promotion", screen: { name: "ultimate" }, hot: true },
    { id: "compete", title: "Competitions", sub: "World Cup · 6N · URC", screen: { name: "competitions" } },
    { id: "online", title: "Online", sub: "Challenge a friend", screen: { name: "online" } },
    { id: "squads", title: "Squads", sub: "Every team", screen: { name: "squads" } },
    { id: "controls", title: "Controls", sub: "Rebind keys", screen: { name: "controls" } },
    { id: "howto", title: "How To Play", sub: "Laws & tips", screen: { name: "howto" } },
    { id: "manager", title: "Manager", sub: "Coming soon", soon: true },
    { id: "player", title: "Player Career", sub: "Coming soon", soon: true },
    user ? { id: "record", title: "My Record", sub: "Career & history", screen: { name: "profile" } } : { id: "signin", title: "Sign In", sub: "Save progress", screen: { name: "profile", mode: "login" } },
  ];
  const [sel, setSel] = useState(0);
  const [record, setRecord] = useState<UserRecord | null>(null);
  const mounted = useRef(false);
  useEffect(() => { if (mounted.current) audio.playBlip(); else mounted.current = true; }, [sel]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/matches", { cache: "no-store" }).then((r) => r.json()).then((d: { matches?: { result: string }[] }) => {
      const matches = d.matches ?? [];
      setRecord({
        wins: matches.filter((m) => m.result === "W").length,
        draws: matches.filter((m) => m.result === "D").length,
        losses: matches.filter((m) => m.result === "L").length,
      });
    }).catch(() => {});
  }, [user]);

  const select = (tile: Tile) => { if (!tile.soon && tile.screen) go(tile.screen); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") setSel((s) => neighbour(s, "left"));
      else if (e.key === "ArrowRight") setSel((s) => neighbour(s, "right"));
      else if (e.key === "ArrowUp") setSel((s) => neighbour(s, "up"));
      else if (e.key === "ArrowDown") setSel((s) => neighbour(s, "down"));
      else if (e.key === "Enter" || e.key === "NumpadEnter") { e.preventDefault(); select(tiles[sel]); return; }
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const cls = (i: number) => `tile ${sel === i ? "selected" : ""}`;
  const showcase = [getTeam("rsa"), getTeam("nzl"), getTeam("fra")];

  const small = (i: number) => (
    <button key={tiles[i].id} className={`${cls(i)} relative min-h-[96px] ${tiles[i].soon ? "opacity-80" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => select(tiles[i])}>
      <div className="relative p-3">
        <Kicker color={tiles[i].soon ? "#94a3b8" : undefined}>{tiles[i].soon ? "Soon" : "Menu"}</Kicker>
        <h3 className="font-pixel mt-1 text-xs uppercase leading-relaxed">{tiles[i].title}</h3>
        <p className="truncate text-slate-300">{tiles[i].sub}</p>
      </div>
      {tiles[i].soon && <div className="font-pixel pointer-events-none absolute inset-x-0 bottom-1 text-center text-[8px] uppercase tracking-widest text-yellow-300/90">Coming soon</div>}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <Kicker>Main menu</Kicker>
          <h1 className="font-pixel text-lg uppercase leading-relaxed drop-shadow-[3px_3px_0_#000] md:text-2xl">{user ? `Welcome back, ${user.username}` : "Welcome to PixelRuggas"}</h1>
        </div>
        <p className="hidden text-right text-slate-300 md:block">
          {TEAMS.length} teams · {COMPETITIONS.length} competitions · {STADIUMS.length} stadiums
          {record && <span className="ml-3 text-green-400">{record.wins}W {record.draws}D {record.losses}L</span>}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-12 grid-rows-[minmax(120px,1fr)_minmax(120px,1fr)_auto_auto] gap-3">
        {/* Hero: Kick Off (emphasized) */}
        <button className={`${cls(0)} col-span-12 row-span-2 border-yellow-300/70 md:col-span-8`} onMouseEnter={() => setSel(0)} onClick={() => select(tiles[0])}>
          <div className="absolute inset-0 opacity-70"><PixelImage src="/img/hero.jpg" w={160} /></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
          <div className="absolute right-3 top-3 rounded border-2 border-yellow-300 bg-yellow-400/20 px-2 py-1 font-pixel text-[8px] text-yellow-300">★ FEATURED</div>
          <div className="relative flex h-full flex-col justify-end p-6">
            <Kicker>Play now</Kicker>
            <h2 className="font-pixel mt-2 text-2xl uppercase leading-relaxed drop-shadow-[3px_3px_0_#000] md:text-4xl">{tiles[0].title}</h2>
            <p className="mt-1 max-w-md text-xl text-slate-200">{tiles[0].sub}</p>
            <span className="px-btn primary mt-4 w-fit"><Kbd>ENTER</Kbd> KICK OFF</span>
          </div>
        </button>

        {/* Hero: Ultimate Team (emphasized) */}
        <button className={`${cls(1)} col-span-12 row-span-2 border-yellow-300/70 md:col-span-4`} onMouseEnter={() => setSel(1)} onClick={() => select(tiles[1])}>
          <div className="absolute inset-0 opacity-70"><PixelImage src="/img/trophy.jpg" w={120} /></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
          <div className="absolute right-3 top-3 rounded border-2 border-yellow-300 bg-yellow-400/20 px-2 py-1 font-pixel text-[8px] text-yellow-300">★ FEATURED</div>
          <div className="relative flex h-full flex-col justify-end p-5">
            <Kicker>Build your club</Kicker>
            <h2 className="font-pixel mt-2 text-lg uppercase leading-relaxed drop-shadow-[3px_3px_0_#000] md:text-2xl">{tiles[1].title}</h2>
            <p className="mt-1 text-lg text-slate-300">{tiles[1].sub}</p>
          </div>
        </button>

        {small(2)}{small(3)}{small(4)}{small(5)}
        {small(6)}{small(7)}{small(8)}{small(9)}
      </div>

      <div className="mt-2 hidden items-center gap-4 text-slate-400 md:flex">
        <span><Kbd>↑↓←→</Kbd> navigate</span>
        <span><Kbd>ENTER</Kbd> select</span>
        <span className="ml-auto flex items-end gap-1 opacity-80">{showcase.map((t, i) => <RunningSprite key={t.id} jersey={t.primary} jersey2={t.secondary} number={[8, 10, 14][i]} name={t.players[[7, 9, 13][i]]} scale={1} />)}</span>
      </div>
    </div>
  );
}
