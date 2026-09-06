"use client";

import { useEffect, useState } from "react";
import { getTeam } from "@/game/data";
import type { SessionUser } from "@/lib/auth";
import type { Screen } from "./GameShell";
import { Kbd } from "./ui";

interface MenuItem {
  id: string;
  label: string;
  hint: string;
  screen?: Screen;
  soon?: boolean;
}

interface UserRecord { wins: number; draws: number; losses: number }

export default function MainMenu({ user, go }: { user: SessionUser | null; go: (s: Screen) => void }) {
  const items: MenuItem[] = [
    { id: "play", label: "Kick Off", hint: "Quick match vs the CPU", screen: { name: "play" } },
    { id: "compete", label: "Competitions", hint: "World Cup, Six Nations & more", screen: { name: "competitions" } },
    { id: "ultimate", label: "Ultimate Team", hint: "Build your club, win promotion", screen: { name: "ultimate" } },
    { id: "online", label: "Online Friendlies", hint: "Challenge another player", screen: { name: "online" } },
    { id: "squads", label: "Squads", hint: "Browse every team", screen: { name: "squads" } },
    { id: "howto", label: "How To Play", hint: "Controls & laws", screen: { name: "howto" } },
    { id: "controls", label: "Controls", hint: "Rebind your keys", screen: { name: "controls" } },
    { id: "manager", label: "Manager Mode", hint: "Coming soon", soon: true },
    { id: "player", label: "Player Career", hint: "Coming soon", soon: true },
    user ? { id: "record", label: "My Record", hint: "Career & history", screen: { name: "profile" } } : { id: "signin", label: "Sign In", hint: "Save your progress", screen: { name: "profile", mode: "login" } },
  ];
  const [sel, setSel] = useState(0);
  const [featured, setFeatured] = useState<[string, string]>(["nzl", "rsa"]);
  const [record, setRecord] = useState<UserRecord | null>(null);

  useEffect(() => {
    const featuredPool = ["nzl", "rsa", "ire", "fra", "eng", "aus", "arg", "fij"];
    const rotate = () => {
      const a = featuredPool[Math.floor(Math.random() * featuredPool.length)];
      let b = featuredPool[Math.floor(Math.random() * featuredPool.length)];
      if (b === a) b = featuredPool[(featuredPool.indexOf(a) + 1) % featuredPool.length];
      setFeatured([a, b]);
    };
    const id = window.setInterval(rotate, 7000);
    return () => window.clearInterval(id);
  }, []);

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

  const select = (item: MenuItem) => {
    if (item.soon) return;
    if (item.screen) go(item.screen);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % items.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s - 1 + items.length) % items.length); }
      else if (e.key === "Enter" || e.key === "NumpadEnter") { e.preventDefault(); select(items[sel]); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const home = getTeam(featured[0]);
  const away = getTeam(featured[1]);

  return (
    <div className="relative flex h-full min-h-0 items-stretch">
      {/* Left: logo + arcade menu */}
      <div className="flex flex-1 flex-col justify-center pl-[6%] md:pl-[10%]">
        <div className="mb-6 flex items-center gap-4">
          <img src="/icon.png" alt="" className="pixelated h-16 w-16 drop-shadow-[4px_4px_0_rgba(0,0,0,0.8)] md:h-20 md:w-20" />
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.5em] text-green-400 drop-shadow-[2px_2px_0_#000]">Pixel</p>
            <h1 className="font-pixel -mt-1 text-3xl leading-none text-white drop-shadow-[4px_4px_0_#000] md:text-5xl">RUGGAS</h1>
          </div>
        </div>

        <nav className="w-full max-w-md">
          {items.map((item, i) => {
            const active = i === sel;
            return (
              <button
                key={item.id}
                onMouseEnter={() => setSel(i)}
                onClick={() => select(item)}
                className={`group flex w-full items-center gap-3 px-3 py-1.5 text-left transition-all ${active ? "translate-x-2" : ""}`}
              >
                <span className={`font-pixel text-sm ${active ? "text-yellow-300" : "text-transparent"}`}>▶</span>
                <span
                  className={`text-2xl font-black uppercase tracking-wide transition-colors md:text-3xl ${
                    item.soon ? "text-slate-600" : active ? "text-yellow-300 drop-shadow-[3px_3px_0_#000]" : "text-slate-100 drop-shadow-[2px_2px_0_#000]"
                  }`}
                >
                  {item.label}
                </span>
                {item.soon && <span className="font-pixel rounded border border-yellow-400/60 px-1.5 py-0.5 text-[8px] text-yellow-300">SOON</span>}
                <span className={`ml-auto hidden text-base text-slate-400 sm:block ${active ? "text-slate-200" : ""}`}>{item.hint}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-6 flex items-center gap-4 text-slate-300">
          <span><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
          <span><Kbd>ENTER</Kbd> select</span>
          <span className="font-pixel text-[8px] text-slate-500">v1.0</span>
        </div>
      </div>

      {/* Right: info panels */}
      <div className="hidden w-[360px] flex-col justify-center gap-4 pr-[5%] lg:flex">
        <div className="rounded-lg border-2 border-white/15 bg-black/60 p-5 backdrop-blur-sm">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-green-400">Featured test match</p>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex flex-col items-center gap-1">
              <span className="grid h-14 w-14 place-items-center rounded-full border-2" style={{ background: home.primary, borderColor: home.secondary }}>
                <span className="font-pixel text-[10px]" style={{ color: light(home.primary) ? "#111" : "#fff" }}>{home.short}</span>
              </span>
              <span className="text-sm font-bold uppercase">{home.short}</span>
            </div>
            <span className="font-pixel text-2xl text-yellow-300">VS</span>
            <div className="flex flex-col items-center gap-1">
              <span className="grid h-14 w-14 place-items-center rounded-full border-2" style={{ background: away.primary, borderColor: away.secondary }}>
                <span className="font-pixel text-[10px]" style={{ color: light(away.primary) ? "#111" : "#fff" }}>{away.short}</span>
              </span>
              <span className="text-sm font-bold uppercase">{away.short}</span>
            </div>
          </div>
          <p className="mt-3 text-center text-sm text-slate-400">Playing now in the background — press Kick Off to take control.</p>
        </div>

        <div className="rounded-lg border-2 border-white/15 bg-black/60 p-5 backdrop-blur-sm">
          {user ? (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-green-400">Coach {user.username}</p>
              {record ? (
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-3xl font-black text-green-400">{record.wins}</p><p className="text-xs uppercase text-slate-400">Wins</p></div>
                  <div><p className="text-3xl font-black text-slate-200">{record.draws}</p><p className="text-xs uppercase text-slate-400">Draws</p></div>
                  <div><p className="text-3xl font-black text-red-400">{record.losses}</p><p className="text-xs uppercase text-slate-400">Losses</p></div>
                </div>
              ) : (
                <p className="mt-3 text-slate-400">No matches played yet.</p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-green-400">Guest mode</p>
              <p className="mt-3 text-slate-300">Sign in to save results, build an Ultimate Team and challenge friends online.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function light(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}
