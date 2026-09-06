"use client";

import { useEffect, useState } from "react";
import { COMPETITIONS, STADIUMS, TEAMS, getTeam } from "@/game/data";
import type { SessionUser } from "@/lib/auth";
import type { Screen } from "./GameShell";
import { Kbd, Kicker, PixelImage, RunningSprite } from "./ui";

interface Tile {
  id: string;
  title: string;
  sub: string;
  screen: Screen;
  comingSoon?: boolean;
}

// Layout rows for keyboard navigation: [0,1] big tiles, [2..5] and [6..9] small tiles.
const ROWS = [[0, 1], [2, 3, 4, 5], [6, 7, 8, 9]];

function neighbour(current: number, key: "left" | "right" | "up" | "down"): number {
  const row = ROWS.findIndex((r) => r.includes(current));
  const col = ROWS[row].indexOf(current);
  if (key === "left") return ROWS[row][(col - 1 + ROWS[row].length) % ROWS[row].length];
  if (key === "right") return ROWS[row][(col + 1) % ROWS[row].length];
  const targetRow = key === "up" ? row - 1 : row + 1;
  if (targetRow < 0 || targetRow >= ROWS.length) return current;
  if (targetRow === 0) return col <= 2 ? 0 : 1; // big row: hero spans small columns 0-2
  const targetCols = ROWS[targetRow];
  return targetCols[Math.min(col, targetCols.length - 1)];
}

export default function MainMenu({ user, go }: { user: SessionUser | null; go: (s: Screen) => void }) {
  const tiles: Tile[] = [
    { id: "play", title: "Quick match", sub: "Pick any two teams, choose a stadium and kick off.", screen: { name: "play" } },
    { id: "compete", title: "Competitions", sub: "World Cup · Six Nations · URC · Premiership · Super Rugby", screen: { name: "competitions" } },
    { id: "squads", title: "Squads", sub: `${TEAMS.length} teams`, screen: { name: "squads" } },
    { id: "ultimate", title: "Ultimate Team", sub: "Build, sell & promote", screen: { name: "ultimate" } },
    { id: "online", title: "Online", sub: "Invite a friend", screen: { name: "online" } },
    { id: "controls", title: "Controls", sub: "Rebind keys", screen: { name: "controls" } },
    { id: "career", title: "Manager", sub: "Run a club", screen: { name: "career" }, comingSoon: true },
    { id: "player-career", title: "Player Career", sub: "Be a pro", screen: { name: "player-career-start" }, comingSoon: true },
    { id: "howto", title: "How to play", sub: "Laws & tips", screen: { name: "howto" } },
    { id: "profile", title: user ? "My record" : "Sign in", sub: user ? "History & career" : "Save progress", screen: { name: "profile" } },
  ];
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      const openTile = (tile: Tile) => { if (tile.comingSoon) setSel(tiles.findIndex((x) => x.id === tile.id)); else go(tile.screen); };
      if (e.key === "ArrowLeft") setSel((s) => neighbour(s, "left"));
      else if (e.key === "ArrowRight") setSel((s) => neighbour(s, "right"));
      else if (e.key === "ArrowUp") setSel((s) => neighbour(s, "up"));
      else if (e.key === "ArrowDown") setSel((s) => neighbour(s, "down"));
      else if (e.key === "Enter" || e.key === "NumpadEnter") { e.preventDefault(); openTile(tiles[sel]); return; }
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const cls = (i: number) => `tile ${sel === i ? "selected" : ""}`;
  const showcase = [getTeam("rsa"), getTeam("nzl"), getTeam("fra")];
  const small = (i: number) => (
    <button key={tiles[i].id} className={`${cls(i)} relative min-h-[92px] ${tiles[i].comingSoon ? "opacity-80" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => go(tiles[i].screen)}>
      <div className="relative p-3">
        <div className="flex items-center justify-between"><Kicker color={tiles[i].comingSoon ? "#94a3b8" : undefined}>{tiles[i].comingSoon ? "Soon" : "Menu"}</Kicker>{tiles[i].comingSoon && <span className="font-pixel text-[7px] text-yellow-300">SOON</span>}</div>
        <h3 className="font-pixel mt-1 text-[11px] uppercase leading-relaxed">{tiles[i].title}</h3>
        <p className="truncate text-slate-300">{tiles[i].sub}</p>
      </div>
      {tiles[i].comingSoon && <div className="font-pixel pointer-events-none absolute inset-x-0 bottom-1 text-center text-[8px] uppercase tracking-widest text-yellow-300/90">Coming soon</div>}
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
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-12 grid-rows-[minmax(120px,1fr)_minmax(120px,1fr)_auto_auto] gap-2">
        <button className={`${cls(0)} col-span-12 row-span-2 md:col-span-8`} onMouseEnter={() => setSel(0)} onClick={() => go(tiles[0].screen)}>
          <div className="absolute inset-0 opacity-70"><PixelImage src="/img/hero.jpg" w={160} /></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-5">
            <Kicker>Play now</Kicker>
            <h2 className="font-pixel mt-1 text-xl uppercase leading-relaxed drop-shadow-[3px_3px_0_#000] md:text-3xl">{tiles[0].title}</h2>
            <p className="mt-1 max-w-md text-slate-200">{tiles[0].sub}</p>
            <span className="px-btn primary mt-3 w-fit !py-2 !text-[9px]">Kick off <Kbd>ENTER</Kbd></span>
          </div>
        </button>

        <button className={`${cls(1)} col-span-12 row-span-2 md:col-span-4`} onMouseEnter={() => setSel(1)} onClick={() => go(tiles[1].screen)}>
          <div className="absolute inset-0 opacity-70"><PixelImage src="/img/trophy.jpg" w={120} /></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-4">
            <Kicker>Tournaments</Kicker>
            <h2 className="font-pixel mt-1 text-base uppercase leading-relaxed drop-shadow-[3px_3px_0_#000] md:text-xl">{tiles[1].title}</h2>
            <p className="mt-1 text-slate-300">{tiles[1].sub}</p>
          </div>
        </button>

        {small(2)}{small(3)}{small(4)}{small(5)}
        {small(6)}{small(7)}{small(8)}{small(9)}
      </div>

      <div className="mt-2 hidden items-center gap-3 text-slate-400 md:flex">
        <Kbd>↑↓←→</Kbd><span>navigate</span><Kbd>ENTER</Kbd><span>select</span>
        <span className="ml-auto flex items-end gap-1 opacity-80">{showcase.map((t, i) => <RunningSprite key={t.id} jersey={t.primary} jersey2={t.secondary} number={[8, 10, 14][i]} name={t.players[[7, 9, 13][i]]} scale={1} />)}</span>
      </div>
    </div>
  );
}
