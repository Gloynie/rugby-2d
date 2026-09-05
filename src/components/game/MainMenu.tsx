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

export default function MainMenu({ user, go }: { user: SessionUser | null; go: (s: Screen) => void }) {
  const tiles: Tile[] = [
    { id: "play", title: "Quick match", sub: "Pick any two teams, choose a stadium and kick off.", screen: { name: "play" } },
    { id: "compete", title: "Competitions", sub: "World Cup · Six Nations · Rugby Championship · URC · Premiership · Super Rugby", screen: { name: "competitions" } },
    { id: "squads", title: "Squads", sub: `${TEAMS.length} teams with real starting XVs`, screen: { name: "squads" } },
    { id: "controls", title: "Controls", sub: "Rebind every key", screen: { name: "controls" } },
    { id: "profile", title: user ? "My career" : "Sign in", sub: user ? "Record, history & competitions" : "Save results and run tournaments", screen: { name: "profile" } },
    { id: "howto", title: "How to play", sub: "Laws of the game & tips", screen: { name: "howto" } },
    { id: "career", title: "Manager mode", sub: "Run a club through a full season", screen: { name: "career" }, comingSoon: true },
    { id: "player-career", title: "Player Career", sub: "Create a customized pro, earn XP and upgrade your rating", screen: { name: "player-career-start" }, comingSoon: true },
    { id: "online", title: "Online Friendlies", sub: "Invite a PixelRuggas player by username", screen: { name: "online" } },
  ];
  const [sel, setSel] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const tilesCount = tiles.length;
  const openTile = (tile: Tile) => {
    if (tile.comingSoon) {
      setNotice(`${tile.title.toUpperCase()} IS COMING SOON.`);
      return;
    }
    go(tile.screen);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      let next = sel;
      switch (e.code) {
        case "ArrowRight":
          next = sel === 0 ? 1 : sel === 1 ? 0 : sel + 1;
          if (next >= tilesCount) next = 0;
          break;
        case "ArrowLeft":
          next = sel === 0 ? tilesCount - 1 : sel - 1;
          break;
        case "ArrowDown":
          next = sel === 0 ? 2 : sel === 1 ? 5 : sel + 2 < tilesCount ? sel + 2 : sel;
          break;
        case "ArrowUp":
          next = sel >= 2 ? (sel <= 3 ? 0 : sel <= 5 ? 1 : sel - 2) : sel;
          break;
        case "Enter":
        case "NumpadEnter":
          e.preventDefault();
          openTile(tiles[sel]);
          return;
        default:
          return;
      }
      e.preventDefault();
      setSel(next);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const cls = (i: number) => `tile ${sel === i ? "selected" : ""}`;
  const showcase = [getTeam("rsa"), getTeam("nzl"), getTeam("fra")];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <Kicker>Main menu</Kicker>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-pixel grid h-14 w-14 place-items-center border-2 border-black bg-yellow-400 text-2xl text-black shadow-[4px_4px_0_#000]">R</span>
            <span className="font-pixel text-xl tracking-[0.14em] text-white drop-shadow-[3px_3px_0_#000] md:text-2xl">PIXELRUGGAS</span>
          </div>
          <h1 className="font-pixel mt-2 text-[10px] uppercase leading-relaxed text-slate-200 drop-shadow-[2px_2px_0_#000] md:text-xs">
            {user ? `Welcome back, ${user.username}` : "Choose a mode and kick off"}
          </h1>
          {notice && <p className="font-pixel mt-2 border-2 border-yellow-400/60 bg-black/80 px-3 py-2 text-[8px] uppercase text-yellow-300">{notice}</p>}
        </div>
        <p className="hidden text-right text-slate-300 md:block">
          {TEAMS.length} real teams · {COMPETITIONS.length} competitions · {STADIUMS.length} stadiums
          <br />
          <span className="text-slate-400">Full rugby union laws · pixel players with fatigue · replays</span>
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-12 grid-rows-[1fr_1fr_auto] gap-3">
        <button className={`${cls(0)} col-span-12 row-span-2 md:col-span-8`} onMouseEnter={() => setSel(0)} onClick={() => go(tiles[0].screen)}>
          <div className="absolute inset-0 opacity-70">
            <PixelImage src="/img/hero.jpg" w={160} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-6">
            <Kicker>Play now</Kicker>
            <h2 className="font-pixel mt-2 text-2xl uppercase leading-relaxed drop-shadow-[3px_3px_0_#000] md:text-4xl">{tiles[0].title}</h2>
            <p className="mt-1 max-w-md text-xl text-slate-200">{tiles[0].sub}</p>
            <span className="px-btn primary mt-4 w-fit">
              Kick off <Kbd>ENTER</Kbd>
            </span>
          </div>
        </button>

        <button className={`${cls(1)} col-span-12 row-span-2 md:col-span-4`} onMouseEnter={() => setSel(1)} onClick={() => go(tiles[1].screen)}>
          <div className="absolute inset-0 opacity-70">
            <PixelImage src="/img/trophy.jpg" w={120} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-5">
            <Kicker>Tournaments</Kicker>
            <h2 className="font-pixel mt-2 text-lg uppercase leading-relaxed drop-shadow-[3px_3px_0_#000] md:text-2xl">{tiles[1].title}</h2>
            <p className="mt-1 text-lg text-slate-300">{tiles[1].sub}</p>
          </div>
        </button>

        <button className={`${cls(2)} col-span-6 min-h-[118px] md:col-span-3`} onMouseEnter={() => setSel(2)} onClick={() => go(tiles[2].screen)}>
          <div className="absolute right-2 bottom-1 flex items-end gap-1 opacity-90">
            {showcase.map((t, i) => (
              <RunningSprite key={t.id} jersey={t.primary} jersey2={t.secondary} number={[8, 10, 14][i]} name={t.players[[7, 9, 13][i]]} scale={2} />
            ))}
          </div>
          <div className="relative p-4 pr-32">
            <Kicker>Teams</Kicker>
            <h3 className="font-pixel mt-2 text-sm uppercase leading-relaxed">{tiles[2].title}</h3>
            <p className="text-slate-300">{tiles[2].sub}</p>
          </div>
        </button>

        <button className={`${cls(3)} col-span-6 min-h-[118px] md:col-span-3`} onMouseEnter={() => setSel(3)} onClick={() => go(tiles[3].screen)}>
          <div className="absolute right-3 bottom-3 flex gap-1 opacity-80">
            <Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd>
          </div>
          <div className="relative p-4">
            <Kicker>Settings</Kicker>
            <h3 className="font-pixel mt-2 text-sm uppercase leading-relaxed">{tiles[3].title}</h3>
            <p className="text-slate-300">{tiles[3].sub}</p>
          </div>
        </button>

        <button className={`${cls(4)} col-span-6 min-h-[118px] md:col-span-3`} onMouseEnter={() => setSel(4)} onClick={() => go(tiles[4].screen)}>
          <div className="relative p-4">
            <Kicker>{user ? "Career" : "Account"}</Kicker>
            <h3 className="font-pixel mt-2 text-sm uppercase leading-relaxed">{tiles[4].title}</h3>
            <p className="text-slate-300">{tiles[4].sub}</p>
          </div>
        </button>

        <button className={`${cls(5)} col-span-6 min-h-[118px] md:col-span-3`} onMouseEnter={() => setSel(5)} onClick={() => go(tiles[5].screen)}>
          <div className="relative p-4">
            <Kicker>Tutorial</Kicker>
            <h3 className="font-pixel mt-2 text-sm uppercase leading-relaxed">{tiles[5].title}</h3>
            <p className="text-slate-300">{tiles[5].sub}</p>
          </div>
        </button>

        <button className={`${cls(6)} col-span-12 min-h-[118px] cursor-not-allowed opacity-75 md:col-span-6`} onMouseEnter={() => setSel(6)} onClick={() => openTile(tiles[6])}>
          <div className="relative flex items-center gap-6 p-5">
            <div className="grid h-16 w-16 place-items-center border-4 border-yellow-300/60 bg-yellow-300/10">
              <span className="font-pixel text-lg">MGR</span>
            </div>
            <div className="flex-1">
              <Kicker>Mode</Kicker>
              <h3 className="font-pixel mt-1 text-sm uppercase leading-relaxed">{tiles[6].title}</h3>
              <p className="text-slate-300">{tiles[6].sub}</p>
            </div>
          </div>
          <div className="font-pixel absolute inset-0 grid place-items-center bg-black/55 text-xs uppercase tracking-widest text-yellow-300">Coming Soon</div>
        </button>

        <button className={`${cls(7)} col-span-12 min-h-[118px] cursor-not-allowed opacity-75 md:col-span-6`} onMouseEnter={() => setSel(7)} onClick={() => openTile(tiles[7])}>
          <div className="relative flex items-center gap-6 p-5">
            <div className="grid h-16 w-16 place-items-center border-4 border-yellow-300/60 bg-yellow-300/10">
              <span className="font-pixel text-lg">PRO</span>
            </div>
            <div className="flex-1">
              <Kicker>Mode</Kicker>
              <h3 className="font-pixel mt-1 text-sm uppercase leading-relaxed">{tiles[7].title}</h3>
              <p className="text-slate-300">{tiles[7].sub}</p>
            </div>
          </div>
          <div className="font-pixel absolute inset-0 grid place-items-center bg-black/55 text-xs uppercase tracking-widest text-yellow-300">Coming Soon</div>
        </button>

        <button className={`${cls(8)} col-span-12 min-h-[104px] border-green-400/60`} onMouseEnter={() => setSel(8)} onClick={() => go(tiles[8].screen)}>
          <div className="relative flex items-center gap-6 p-5">
            <div className="font-pixel grid h-14 w-20 place-items-center border-4 border-green-400 bg-green-400/15 text-xs text-green-300">1V1</div>
            <div className="flex-1">
              <Kicker color="#4ade80">Multiplayer</Kicker>
              <h3 className="font-pixel mt-1 text-sm uppercase leading-relaxed">{tiles[8].title}</h3>
              <p className="text-slate-300">{tiles[8].sub}</p>
            </div>
            <span className="font-pixel text-xs text-green-300">Invite →</span>
          </div>
        </button>
      </div>
    </div>
  );
}
