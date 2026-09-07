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
  icon: string;
  screen?: Screen;
}

interface UserRecord { wins: number; draws: number; losses: number }

export default function MainMenu({ user, go }: { user: SessionUser | null; go: (s: Screen) => void }) {
  const items: MenuItem[] = [
    { id: "play", label: "Kick Off", hint: "Quick match vs the CPU", icon: "KO", screen: { name: "play" } },
    { id: "compete", label: "Competitions", hint: "World Cup · Six Nations · URC", icon: "CUP", screen: { name: "competitions" } },
    { id: "ultimate", label: "Ultimate Team", hint: "Build a club · win promotion", icon: "UT", screen: { name: "ultimate" } },
    { id: "online", label: "Online", hint: "Challenge a friend live", icon: "1v1", screen: { name: "online" } },
    { id: "squads", label: "Squads", hint: "Browse every team", icon: "XV", screen: { name: "squads" } },
    { id: "howto", label: "How To Play", hint: "Controls & laws of the game", icon: "?", screen: { name: "howto" } },
    { id: "controls", label: "Controls", hint: "Rebind your keys", icon: "KEY", screen: { name: "controls" } },
    user
      ? { id: "record", label: "My Record", hint: "History & saved career", icon: "PRO", screen: { name: "profile" } }
      : { id: "signin", label: "Sign In", hint: "Save your progress", icon: "ID", screen: { name: "profile", mode: "login" } },
  ];
  const [sel, setSel] = useState(0);
  const [record, setRecord] = useState<UserRecord | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 900);
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

  useEffect(() => {
    const cols = 2;
    const rows = Math.ceil(items.length / cols);
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      const row = Math.floor(sel / cols);
      const col = sel % cols;
      if (e.key === "ArrowDown") { e.preventDefault(); setSel(((row + 1) % rows) * cols + col); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel(((row - 1 + rows) % rows) * cols + col); }
      else if (e.key === "ArrowRight") { e.preventDefault(); setSel(row * cols + Math.min(col + 1, cols - 1)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setSel(row * cols + Math.max(col - 1, 0)); }
      else if (e.key === "Enter" || e.key === "NumpadEnter") { e.preventDefault(); const it = items[sel]; if (it.screen) go(it.screen); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="relative flex h-full min-h-0 items-center justify-center px-4">
      {/* dim the attract-mode match behind */}
      <div className="absolute inset-0 bg-black/55" />

      <div className="relative w-full max-w-3xl">
        {/* Logo */}
        <div className="mb-5 flex items-center justify-center gap-4">
          <img src="/icon.png" alt="" className={`pixelated h-16 w-16 drop-shadow-[4px_4px_0_rgba(0,0,0,0.85)] transition-transform md:h-20 md:w-20 ${tick % 2 ? "translate-y-0.5" : ""}`} />
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.5em] text-green-400 drop-shadow-[2px_2px_0_#000]">Pixel</p>
            <h1 className="font-pixel -mt-1 text-3xl leading-none text-white drop-shadow-[4px_4px_0_#000] md:text-5xl">RUGGAS</h1>
          </div>
        </div>

        {/* Menu console */}
        <div className="rounded-xl border-4 border-white/20 bg-black/75 p-4 shadow-[8px_8px_0_rgba(0,0,0,0.6)] backdrop-blur-sm md:p-6">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {items.map((item, i) => {
              const active = i === sel;
              return (
                <button
                  key={item.id}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => item.screen && go(item.screen)}
                  className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-all ${
                    active ? "border-yellow-300 bg-yellow-400/15 shadow-[0_0_0_2px_rgba(250,204,21,0.4)]" : "border-white/10 bg-white/5 hover:border-white/30"
                  }`}
                >
                  <span className={`font-pixel grid h-11 w-12 shrink-0 place-items-center rounded border-2 text-[10px] ${active ? "border-yellow-300 bg-yellow-400 text-black" : "border-white/20 bg-black/50 text-green-400"}`}>
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xl font-black uppercase leading-tight md:text-2xl ${active ? "text-yellow-300" : "text-slate-100"}`}>{item.label}</span>
                    <span className="block truncate text-base text-slate-400">{item.hint}</span>
                  </span>
                  {active && <span className="font-pixel text-sm text-yellow-300">▶</span>}
                </button>
              );
            })}
          </div>

          {/* coming soon strip */}
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-white/15 px-3 py-2">
            <span className="font-pixel text-[9px] text-yellow-300">COMING SOON</span>
            <span className="rounded border border-white/15 bg-black/40 px-2 py-1 text-base text-slate-400">Manager Mode</span>
            <span className="rounded border border-white/15 bg-black/40 px-2 py-1 text-base text-slate-400">Player Career</span>
          </div>

          {/* record strip */}
          {user && record && (
            <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-lg">
              <span className="text-slate-400">Coach <span className="text-slate-100">{user.username}</span></span>
              <span className="text-green-400">{record.wins} W</span>
              <span className="text-slate-200">{record.draws} D</span>
              <span className="text-red-400">{record.losses} L</span>
              <span className="ml-auto text-slate-500">record</span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-4 text-base text-slate-400">
            <span><Kbd>↑↓←→</Kbd> select</span>
            <span><Kbd>ENTER</Kbd> confirm</span>
            <span className="ml-auto font-pixel text-[8px] text-slate-600">PIXELRUGGAS v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
