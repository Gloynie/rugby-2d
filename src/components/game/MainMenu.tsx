"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as audio from "@/game/audio";
import { findTeam, getTeam } from "@/game/data";
import { MenuPad, anyPadConnected } from "@/game/gamepad";
import { music, useMusic } from "@/game/music/player";
import type { SessionUser } from "@/lib/auth";
import type { Screen } from "./GameShell";
import NowPlaying from "./NowPlaying";
import { PlayerSprite } from "./ui";

interface Item {
  id: string;
  title: string;
  screen?: Screen;
  soon?: boolean;
}

interface UserRecord {
  wins: number;
  draws: number;
  losses: number;
}

export default function MainMenu({
  user, go, onLogout, offline,
}: { user: SessionUser | null; go: (s: Screen) => void; onLogout?: () => void; offline?: boolean }) {
  const items: Item[] = useMemo(
    () => [
      { id: "kickoff", title: "Kick-Off", screen: { name: "play" } },
      { id: "ultimate", title: "Ultimate Team", screen: { name: "ultimate" } },
      { id: "compete", title: "Competitions", screen: { name: "competitions" } },
      { id: "online", title: "Online", screen: { name: "online" } },
      { id: "squads", title: "Squads", screen: { name: "squads" } },
      { id: "manager", title: "Manager Career", soon: true },
      { id: "player", title: "Player Career", soon: true },
      { id: "music", title: "Music", screen: { name: "music" } },
      { id: "controls", title: "Controls", screen: { name: "controls" } },
      { id: "settings", title: "Settings", screen: { name: "settings" } },
      { id: "howto", title: "How To Play", screen: { name: "howto" } },
      user
        ? { id: "record", title: "My Record", screen: { name: "profile" } }
        : { id: "signin", title: "Sign In", screen: { name: "profile", mode: "login" } },
    ],
    [user],
  );

  const [sel, setSel] = useState(0);
  const [record, setRecord] = useState<UserRecord | null>(null);
  const [pad, setPad] = useState(false);
  const mounted = useRef(false);
  const m = useMusic();

  useEffect(() => {
    if (mounted.current) audio.playBlip();
    else mounted.current = true;
  }, [sel]);

  useEffect(() => {
    void music.init();
    music.setContext("menu");
  }, []);

  useEffect(() => {
    const check = () => setPad(anyPadConnected());
    check();
    const t = window.setInterval(check, 1500);
    window.addEventListener("gamepadconnected", check);
    window.addEventListener("gamepaddisconnected", check);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("gamepadconnected", check);
      window.removeEventListener("gamepaddisconnected", check);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/matches", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { matches?: { result: string }[] }) => {
        const ms = d.matches ?? [];
        setRecord({
          wins: ms.filter((x) => x.result === "W").length,
          draws: ms.filter((x) => x.result === "D").length,
          losses: ms.filter((x) => x.result === "L").length,
        });
      })
      .catch(() => undefined);
  }, [user]);

  const open = (it: Item) => {
    if (!it.soon && it.screen) go(it.screen);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowDown") setSel((s) => (s + 1) % items.length);
      else if (e.key === "ArrowUp") setSel((s) => (s - 1 + items.length) % items.length);
      else if (e.key === "Enter" || e.key === "NumpadEnter" || e.key === "ArrowRight") {
        e.preventDefault();
        open(items[sel]);
        return;
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  // Controller navigation: stick / d-pad to browse, A to select.
  useEffect(() => {
    const reader = new MenuPad();
    let raf = 0;
    const tick = () => {
      const nav = reader.poll();
      if (nav.down) setSel((s) => (s + 1) % items.length);
      if (nav.up) setSel((s) => (s - 1 + items.length) % items.length);
      if (nav.confirm) setSel((s) => { open(items[s]); return s; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const fav = findTeam(user?.favouriteTeam) ?? getTeam("rsa");

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[#cfd4d9] text-slate-900">
      {/* Static backdrop image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/menu-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-white/25 via-transparent to-transparent" />

      {/* Big pixel player on the right */}
      <div className="pointer-events-none absolute -bottom-2 right-[4%] hidden items-end md:flex" aria-hidden>
        <div className="relative">
          <div className="absolute -bottom-3 left-1/2 h-8 w-[220px] -translate-x-1/2 rounded-[50%] bg-black/30 blur-md" />
          <PlayerSprite
            jersey={fav.primary}
            jersey2={fav.secondary}
            number={10}
            name={fav.players[9] ?? fav.name}
            scale={11}
            view="front"
            pose="celebrate"
          />
        </div>
      </div>

      {/* Logo */}
      <header className="absolute left-8 top-6 z-20 flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.35)] ring-2 ring-black/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/pixelruggas-ball.png" alt="PixelRuggas" className="pixelated h-11 w-11 object-contain" />
        </span>
        <p className="font-display text-[34px] font-bold uppercase italic leading-none tracking-tight text-[#14181d]">
          Pixel<span className="text-[#1d9e4b]">Ruggas</span>
        </p>
      </header>

      {/* Account chip, top right */}
      <div className="absolute right-6 top-6 z-20 flex items-center gap-3">
        {offline && (
          <span className="font-pixel border border-amber-600/60 bg-amber-100/80 px-2 py-1 text-[7px] uppercase tracking-widest text-amber-800">
            Guest
          </span>
        )}
        {record && (
          <span className="font-display text-sm font-bold uppercase tracking-wide text-slate-700">
            {record.wins}W · {record.draws}D · {record.losses}L
          </span>
        )}
        {user ? (
          <>
            <span className="font-display text-base font-bold uppercase tracking-wide text-slate-800">{user.username}</span>
            {onLogout && (
              <button type="button" onClick={onLogout} className="font-pixel text-[7px] uppercase tracking-widest text-slate-500 transition hover:text-slate-900">
                Sign out
              </button>
            )}
          </>
        ) : (
          <button type="button" onClick={() => go({ name: "profile", mode: "login" })} className="font-display text-base font-bold uppercase tracking-wide text-slate-700 transition hover:text-black">
            Sign in
          </button>
        )}
      </div>

      {/* Slanted menu bars */}
      <nav className="absolute left-10 top-[19%] z-20 w-[380px] max-w-[44vw]">
        <ul className="flex flex-col gap-[7px]">
          {items.map((it, i) => {
            const active = i === sel;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => (active ? open(it) : setSel(i))}
                  className={`block w-full -skew-x-[9deg] px-6 py-[9px] text-left shadow-[3px_3px_0_rgba(0,0,0,0.35)] transition-all duration-100 ${
                    active
                      ? "translate-x-2 bg-[#eef1f4] shadow-[5px_5px_0_rgba(0,0,0,0.3)]"
                      : "bg-[#151a21]/95 hover:bg-[#1d242e]"
                  }`}
                >
                  <span className="flex skew-x-[9deg] items-center gap-2">
                    <span
                      className={`font-display flex-1 truncate text-[21px] font-bold uppercase leading-none tracking-wide ${
                        active ? "text-[#1273c8]" : it.soon ? "text-slate-500" : "text-[#e8ecf0]"
                      }`}
                    >
                      {it.title}
                    </span>
                    {it.soon && (
                      <span className={`font-pixel text-[6px] uppercase tracking-widest ${active ? "text-amber-600" : "text-amber-500/80"}`}>
                        Soon
                      </span>
                    )}
                    {active && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/brand/pixelruggas-ball.png" alt="" className="pixelated h-5 w-5 shrink-0 object-contain" />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom-left prompts */}
      <div className="absolute bottom-5 left-10 z-20 flex items-center gap-5">
        <Prompt badge={pad ? "A" : "↵"} label="Select" />
        <Prompt badge={pad ? "B" : "ESC"} label="Back" />
        <Prompt badge={pad ? "LS" : "↑↓"} label="Browse" />
      </div>

      {/* Now playing, bottom right */}
      <div className="absolute bottom-5 right-6 z-20 hidden sm:block">
        <NowPlaying onOpen={() => go({ name: "music" })} />
      </div>

      {m.needsGesture && (
        <p className="font-pixel absolute bottom-16 right-6 z-20 text-[7px] uppercase tracking-widest text-slate-600">
          Click anywhere to start the music
        </p>
      )}
    </div>
  );
}

function Prompt({ badge, label }: { badge: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-[#14181d] px-1 font-display text-[10px] font-bold text-white">
        {badge}
      </span>
      <span className="font-display text-sm font-semibold uppercase tracking-wide text-slate-700">{label}</span>
    </span>
  );
}
