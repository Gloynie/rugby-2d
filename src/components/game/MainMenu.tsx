"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as audio from "@/game/audio";
import { COMPETITIONS, STADIUMS, TEAMS, findTeam, getTeam } from "@/game/data";
import { MenuPad, anyPadConnected } from "@/game/gamepad";
import { music, useMusic } from "@/game/music/player";
import type { SessionUser } from "@/lib/auth";
import type { Screen } from "./GameShell";
import MenuBackdrops from "./MenuBackdrops";
import NowPlaying from "./NowPlaying";
import { Crest } from "./ui";

interface Item {
  id: string;
  title: string;
  mono: string;
  headline: string;
  features: string[];
  cta: string;
  accent: string;
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
      {
        id: "kickoff", title: "Kick Off", mono: "KO", accent: "#facc15",
        headline: "Dive straight into the action.",
        features: ["Quick matches", "Any stadium", "Coin toss"],
        cta: "Enter Kick Off", screen: { name: "play" },
      },
      {
        id: "ultimate", title: "Ultimate Team", mono: "UT", accent: "#c084fc",
        headline: "Build your club from nothing to the top flight.",
        features: ["Open packs", "Build a squad", "Win promotion"],
        cta: "Enter Ultimate Team", screen: { name: "ultimate" },
      },
      {
        id: "compete", title: "Competitions", mono: "CP", accent: "#38bdf8",
        headline: "Chase every trophy in the world game.",
        features: ["World Cup", "Six Nations", "URC & more"],
        cta: "Expand Competitions", screen: { name: "competitions" },
      },
      {
        id: "online", title: "Online", mono: "ON", accent: "#34d399",
        headline: "Settle it head-to-head with a friend.",
        features: ["Invite by name", "Live matches"],
        cta: "Expand Online", screen: { name: "online" },
      },
      {
        id: "squads", title: "Squads", mono: "SQ", accent: "#fb923c",
        headline: "Know every side before you pick one.",
        features: [`${TEAMS.length} teams`, "Full ratings"],
        cta: "Browse Squads", screen: { name: "squads" },
      },
      {
        id: "music", title: "Music", mono: "MX", accent: "#f472b6",
        headline: "Your soundtrack, shuffled every session.",
        features: ["Add your MP3s", "Always shuffling"],
        cta: "Open Music", screen: { name: "music" },
      },
      {
        id: "manager", title: "Manager Career", mono: "MC", accent: "#94a3b8", soon: true,
        headline: "Are you ready to lead a club on and off the pitch?",
        features: ["Coming soon"], cta: "Coming soon",
      },
      {
        id: "player", title: "Player Career", mono: "PC", accent: "#94a3b8", soon: true,
        headline: "Rise from academy rookie to national legend.",
        features: ["Coming soon"], cta: "Coming soon",
      },
      {
        id: "howto", title: "Learn To Play", mono: "LP", accent: "#fbbf24",
        headline: "Master the laws, the controls and the dark arts.",
        features: ["Controls", "Laws of the game"],
        cta: "Open Learn To Play", screen: { name: "howto" },
      },
    ],
    [],
  );

  const [sel, setSel] = useState(0);
  const [record, setRecord] = useState<UserRecord | null>(null);
  const [pad, setPad] = useState(false);
  const mounted = useRef(false);
  const item = items[sel];
  const m = useMusic();

  useEffect(() => {
    if (mounted.current) audio.playBlip();
    else mounted.current = true;
  }, [sel]);

  useEffect(() => {
    void music.init();
    music.setContext("menu");
  }, []);

  // Show controller prompts only when a pad is actually plugged in.
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

  // Controller navigation: left stick / d-pad to browse, A to select, B to go back.
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
  const played = record ? record.wins + record.draws + record.losses : 0;
  const level = Math.max(1, Math.floor(played / 5) + 1);
  const intoLevel = played % 5;

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <MenuBackdrops jersey={fav.primary} jersey2={fav.secondary} playerName={fav.players[9] ?? fav.name} number={10} />
      </div>

      {/* ── top-left: utilities + wordmark ── */}
      <div className="absolute left-6 top-5 z-20 flex items-start gap-4">
        <div className="flex flex-col gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => go({ name: "settings" })}
            title="Settings"
            aria-label="Settings"
            className="text-slate-400 transition hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm8.9 4a7 7 0 01-.1 1.2l2 1.6-2 3.4-2.4-1a7.4 7.4 0 01-2 1.2l-.4 2.6h-4l-.4-2.6a7.4 7.4 0 01-2-1.2l-2.4 1-2-3.4 2-1.6a7.6 7.6 0 010-2.4l-2-1.6 2-3.4 2.4 1a7.4 7.4 0 012-1.2L11.1 2h4l.4 2.6a7.4 7.4 0 012 1.2l2.4-1 2 3.4-2 1.6c.06.39.1.79.1 1.2z" /></svg>
          </button>
          <button
            type="button"
            onClick={() => go({ name: "controls" })}
            title="Controls & accessibility"
            aria-label="Controls and accessibility"
            className="text-slate-400 transition hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12 2a2 2 0 110 4 2 2 0 010-4zm9 5.5l-.4 1.6-5.1 1v3.3l2.2 7-1.6.6-2.6-7h-3l-2.6 7-1.6-.6 2.2-7V10.1l-5.1-1L3 7.5l6.4 1.2h5.2L21 7.5z" /></svg>
          </button>
        </div>
        <div>
          <p className="font-pixel text-base uppercase leading-none tracking-[0.12em] text-white drop-shadow-[3px_3px_0_#000]">
            Pixel<span className="text-green-400">Ruggas</span>
          </p>
          <p className="mt-1.5 font-pixel text-[6px] uppercase tracking-[0.3em] text-slate-500">Pixel rugby union</p>
        </div>
      </div>

      {/* ── top-right: account ── */}
      <div className="absolute right-6 top-5 z-20 flex items-center gap-3">
        {offline && (
          <span
            className="font-pixel border border-yellow-400/50 bg-yellow-950/60 px-2 py-1 text-[7px] uppercase tracking-widest text-yellow-300"
            title="No database connected. Quick matches work; accounts and competitions are disabled."
          >
            Guest
          </span>
        )}
        {user ? (
          <>
            <button type="button" onClick={() => go({ name: "profile" })} className="flex items-center gap-2 transition hover:brightness-125" title="My record">
              <span className="font-pixel text-[9px] uppercase tracking-wider text-slate-200">{user.username}</span>
              <Crest team={fav} size={20} />
            </button>
            <span className="h-5 w-px bg-white/20" />
            <span className="font-pixel text-[8px] uppercase tracking-wider text-slate-400">Lv {level}</span>
            <span className="flex h-1.5 w-16 overflow-hidden bg-white/15">
              <span className="h-full bg-green-400" style={{ width: `${(intoLevel / 5) * 100}%` }} />
            </span>
            <span className="font-pixel text-[8px] text-slate-500">{record ? `${record.wins}W` : "0W"}</span>
            {onLogout && (
              <button type="button" onClick={onLogout} className="font-pixel text-[7px] uppercase tracking-widest text-slate-500 transition hover:text-white">
                Sign out
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" onClick={() => go({ name: "profile", mode: "login" })} className="font-pixel text-[8px] uppercase tracking-widest text-slate-300 transition hover:text-white">
              Sign in
            </button>
            <button type="button" onClick={() => go({ name: "profile", mode: "register" })} className="px-btn primary !px-2.5 !py-1.5 !text-[7px]">
              Create account
            </button>
          </>
        )}
      </div>

      {/* ── left: mode list ── */}
      <nav className="absolute left-7 top-1/2 z-20 w-[360px] -translate-y-1/2">
        <ul className="space-y-1.5">
          {items.map((it, i) => {
            const active = i === sel;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => (active ? open(it) : setSel(i))}
                  className={`group flex w-full items-center gap-2.5 py-1.5 text-left transition-all duration-150 ${
                    active ? "translate-x-1.5" : ""
                  }`}
                >
                  <span
                    className="block w-1.5 shrink-0 transition-all duration-150"
                    style={{ height: active ? 32 : 0, background: it.accent }}
                  />
                  <span
                    className={`font-pixel uppercase leading-tight transition-all duration-150 ${
                      active
                        ? "text-[21px] text-white drop-shadow-[2px_2px_0_#000]"
                        : it.soon
                          ? "text-[15px] text-slate-600"
                          : "text-[15px] text-slate-400 group-hover:text-slate-200"
                    }`}
                  >
                    {it.title}
                  </span>
                  {it.soon && (
                    <span className="font-pixel text-[8px] uppercase tracking-widest text-yellow-500/70">Soon</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── centre: selected mode ── */}
      <div key={item.id} className="menu-spotlight absolute left-1/2 top-1/2 z-10 w-[420px] max-w-[46vw] -translate-x-1/3 -translate-y-1/2 text-center">
        <div
          className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2"
          style={{ borderColor: `${item.accent}dd`, background: "rgba(3,6,14,0.45)" }}
        >
          <span className="font-pixel text-base" style={{ color: item.accent }}>{item.mono}</span>
        </div>
        <h2 className="mt-4 font-pixel text-[13px] uppercase leading-relaxed text-white drop-shadow-[2px_2px_0_#000] md:text-[15px]">
          {item.headline}
        </h2>
        <p className="mt-3 font-pixel text-[7px] uppercase tracking-[0.18em] text-slate-300">
          {item.features.join("  ·  ")}
        </p>
        <div className="mt-5 flex justify-center">
          {item.soon ? (
            <span className="font-pixel rounded-full border border-yellow-400/50 bg-yellow-400/10 px-5 py-2.5 text-[8px] uppercase tracking-widest text-yellow-300">
              Coming soon
            </span>
          ) : (
            <button
              type="button"
              onClick={() => open(item)}
              className="font-pixel flex items-center gap-2 rounded-full border border-white/30 bg-black/45 px-5 py-2.5 text-[8px] uppercase tracking-widest text-white backdrop-blur transition hover:border-white/70 hover:bg-black/70"
            >
              <span className="grid h-4 w-4 place-items-center rounded-full bg-white text-[6px] text-black">
                {pad ? "A" : "↵"}
              </span>
              {item.cta}
            </button>
          )}
        </div>
      </div>

      {/* ── bottom prompt bar ── */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-5 px-7 py-3.5">
        <Prompt badge={pad ? "A" : "↵"} label="Select" />
        <Prompt badge={pad ? "B" : "ESC"} label="Back" />
        <Prompt badge={pad ? "LS" : "↑↓"} label="Browse" />
        <button
          type="button"
          onClick={() => go({ name: "controls" })}
          className="font-pixel text-[7px] uppercase tracking-widest text-slate-400 transition hover:text-white"
        >
          Controls / Accessibility
        </button>
        <div className="ml-auto flex items-center gap-3">
          {pad && (
            <span className="font-pixel border border-green-400/40 bg-green-950/40 px-2 py-1 text-[6px] uppercase tracking-widest text-green-300">
              Controller
            </span>
          )}
          <span className="font-pixel text-[6px] uppercase tracking-widest text-slate-500">
            {COMPETITIONS.length} comps · {STADIUMS.length} grounds
          </span>
          <NowPlaying onOpen={() => go({ name: "music" })} />
        </div>
      </div>

      {m.needsGesture && (
        <p className="font-pixel pointer-events-none absolute bottom-14 right-7 z-20 text-[7px] uppercase tracking-widest text-yellow-300/80">
          Click anywhere to start the music
        </p>
      )}
    </div>
  );
}

function Prompt({ badge, label }: { badge: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-pixel grid h-5 min-w-[20px] place-items-center rounded-full border border-white/40 bg-black/50 px-1 text-[6px] text-white">
        {badge}
      </span>
      <span className="font-pixel text-[7px] uppercase tracking-widest text-slate-400">{label}</span>
    </span>
  );
}
