"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as audio from "@/game/audio";
import { COMPETITIONS, STADIUMS, TEAMS, findTeam, getTeam } from "@/game/data";
import { music, useMusic } from "@/game/music/player";
import type { SessionUser } from "@/lib/auth";
import type { Screen } from "./GameShell";
import MenuScene from "./MenuScene";
import NowPlaying from "./NowPlaying";
import { Crest, Kbd } from "./ui";

interface Item {
  id: string;
  title: string;
  sub: string;
  blurb: string;
  accent: string;
  chips: string[];
  screen?: Screen;
  soon?: boolean;
  tier: "featured" | "main" | "chip";
}

interface UserRecord {
  wins: number;
  draws: number;
  losses: number;
}

export default function MainMenu({ user, go }: { user: SessionUser | null; go: (s: Screen) => void }) {
  const items: Item[] = useMemo(
    () => [
      {
        id: "kickoff", title: "Kick Off", sub: "Quick match", tier: "featured", accent: "#facc15",
        blurb: "Pick any team, choose a stadium, win the toss and play full 80-minute rugby union.",
        chips: ["Coin toss", "Scrums", "Replays"], screen: { name: "play" },
      },
      {
        id: "ultimate", title: "Ultimate Team", sub: "Build · Packs · Promotion", tier: "featured", accent: "#c084fc",
        blurb: "Build a club from nothing. Open packs, sell spares and climb the divisions.",
        chips: ["Packs", "Squad builder", "Seasons"], screen: { name: "ultimate" },
      },
      {
        id: "compete", title: "Competitions", sub: "World Cup · 6N · URC", tier: "main", accent: "#38bdf8",
        blurb: "Six real competitions with full tables, knockouts and every fixture simulated.",
        chips: COMPETITIONS.map((c) => c.short), screen: { name: "competitions" },
      },
      {
        id: "online", title: "Online", sub: "Challenge a friend", tier: "main", accent: "#34d399",
        blurb: "Invite another player by username and settle it in a live head-to-head.",
        chips: ["Invite", "Live match"], screen: { name: "online" },
      },
      {
        id: "squads", title: "Squads", sub: "Every team & player", tier: "main", accent: "#fb923c",
        blurb: "Browse all squads, ratings and the pixel stars of every side.",
        chips: [`${TEAMS.length} teams`, "Ratings"], screen: { name: "squads" },
      },
      {
        id: "music", title: "Music", sub: "Your soundtrack", tier: "main", accent: "#f472b6",
        blurb: "Play, skip and shuffle your songs in the menus — or add your own MP3s.",
        chips: ["Play · skip", "Shuffle", "Add MP3s"], screen: { name: "music" },
      },
      {
        id: "manager", title: "Manager", sub: "Coming soon", tier: "chip", accent: "#94a3b8", soon: true,
        blurb: "Run a club through a full season. Coming soon.", chips: ["Soon"],
      },
      {
        id: "player", title: "Player Career", sub: "Coming soon", tier: "chip", accent: "#94a3b8", soon: true,
        blurb: "Create a player and grow from rookie to legend. Coming soon.", chips: ["Soon"],
      },
      {
        id: "controls", title: "Controls", sub: "Rebind keys", tier: "chip", accent: "#60a5fa",
        blurb: "Rebind every key to suit your keyboard.", chips: ["Presets"], screen: { name: "controls" },
      },
      {
        id: "settings", title: "Settings", sub: "Audio & look", tier: "chip", accent: "#cbd5e1",
        blurb: "Volume, pixel sharpness and performance options.", chips: ["Volume", "Pixels"], screen: { name: "settings" },
      },
      {
        id: "howto", title: "How To Play", sub: "Laws & tips", tier: "chip", accent: "#fbbf24",
        blurb: "Controls, the laws of the game and tips for breaking the line.", chips: ["Laws"], screen: { name: "howto" },
      },
      user
        ? { id: "record", title: "My Record", sub: "Career history", tier: "chip", accent: "#4ade80", blurb: "Your results, record and competitions.", chips: ["History"], screen: { name: "profile" } }
        : { id: "signin", title: "Sign In", sub: "Save progress", tier: "chip", accent: "#4ade80", blurb: "Create an account to save results and your club.", chips: ["Free"], screen: { name: "profile", mode: "login" } },
    ],
    [user],
  );

  const [sel, setSel] = useState(0);
  const [record, setRecord] = useState<UserRecord | null>(null);
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
      if (e.key === "ArrowDown" || e.key === "ArrowRight") setSel((s) => (s + 1) % items.length);
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") setSel((s) => (s - 1 + items.length) % items.length);
      else if (e.key === "Enter" || e.key === "NumpadEnter") {
        e.preventDefault();
        open(items[sel]);
        return;
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const fav = findTeam(user?.favouriteTeam) ?? getTeam("rsa");
  const featured = items.filter((i) => i.tier === "featured");
  const mains = items.filter((i) => i.tier === "main");
  const chips = items.filter((i) => i.tier === "chip");
  const rowCls = (it: Item) => (items[sel].id === it.id ? "menu-row is-active" : "menu-row");

  return (
    <div className="relative h-full min-h-0">
      {/* animated idle-player title scene */}
      <div className="pointer-events-none absolute -inset-x-6 -inset-y-2 -z-10 overflow-hidden md:-inset-x-10">
        <MenuScene jersey={fav.primary} jersey2={fav.secondary} playerName={fav.players[9] ?? fav.name} number={10} />
      </div>

      <div className="grid h-full min-h-0 grid-cols-12 gap-3">
        {/* ─────────── left: mode list ─────────── */}
        <div className="col-span-12 flex min-h-0 flex-col gap-1.5 md:col-span-5 lg:col-span-4">
          {featured.map((it) => (
            <button
              key={it.id}
              type="button"
              onMouseEnter={() => setSel(items.indexOf(it))}
              onClick={() => open(it)}
              className={`${rowCls(it)} flex-[1.3]`}
              style={{ ["--accent" as string]: it.accent }}
            >
              <span className="menu-bar" />
              <span className="min-w-0 flex-1 text-left">
                <span className="font-pixel block truncate text-[13px] uppercase leading-tight">{it.title}</span>
                <span className="mt-1 block truncate text-[15px] leading-none text-slate-300">{it.sub}</span>
              </span>
              <span className="font-pixel shrink-0 text-[7px] uppercase" style={{ color: it.accent }}>★</span>
              <span className="menu-arrow">▶</span>
            </button>
          ))}

          {mains.map((it) => (
            <button
              key={it.id}
              type="button"
              onMouseEnter={() => setSel(items.indexOf(it))}
              onClick={() => open(it)}
              className={`${rowCls(it)} flex-1`}
              style={{ ["--accent" as string]: it.accent }}
            >
              <span className="menu-bar" />
              <span className="min-w-0 flex-1 text-left">
                <span className="font-pixel block truncate text-[10px] uppercase leading-tight">{it.title}</span>
                <span className="mt-0.5 block truncate text-[14px] leading-none text-slate-400">{it.sub}</span>
              </span>
              <span className="menu-arrow">▶</span>
            </button>
          ))}

          <div className="grid shrink-0 grid-cols-3 gap-1.5">
            {chips.map((it) => (
              <button
                key={it.id}
                type="button"
                onMouseEnter={() => setSel(items.indexOf(it))}
                onClick={() => open(it)}
                className={`${rowCls(it)} menu-chip ${it.soon ? "opacity-70" : ""}`}
                style={{ ["--accent" as string]: it.accent }}
                aria-disabled={it.soon}
              >
                <span className="menu-bar" />
                <span className="font-pixel min-w-0 flex-1 truncate text-left text-[8px] uppercase leading-tight">{it.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─────────── right: spotlight ─────────── */}
        <div className="col-span-12 flex min-h-0 flex-col justify-between md:col-span-7 lg:col-span-8">
          <div className="flex items-start justify-between gap-3">
            <div className="border-2 border-black bg-black/70 px-3 py-2 shadow-[3px_3px_0_#000]">
              <p className="font-pixel text-[8px] uppercase tracking-[0.2em] text-yellow-400">
                {user ? `Welcome back, ${user.username}` : "Welcome to PixelRuggas"}
              </p>
              {record ? (
                <p className="font-pixel mt-1 text-[10px]">
                  <span className="text-green-400">{record.wins}W</span> <span className="text-slate-300">{record.draws}D</span>{" "}
                  <span className="text-red-400">{record.losses}L</span>
                </p>
              ) : (
                <p className="mt-0.5 text-[15px] text-slate-400">
                  {TEAMS.length} teams · {COMPETITIONS.length} comps · {STADIUMS.length} stadiums
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 border-2 border-black bg-black/70 px-2 py-1.5 shadow-[3px_3px_0_#000]">
              <Crest team={fav} size={26} />
              <span className="font-pixel text-[8px] uppercase text-slate-300">{fav.short}</span>
            </div>
          </div>

          <div key={item.id} className="slide-in max-w-xl border-2 border-black bg-black/75 p-4 shadow-[4px_4px_0_#000]">
            <p className="font-pixel text-[8px] uppercase tracking-[0.25em]" style={{ color: item.accent }}>
              {item.soon ? "Coming soon" : item.tier === "featured" ? "Featured" : "Menu"}
            </p>
            <h2 className="font-pixel mt-2 text-xl uppercase leading-tight drop-shadow-[3px_3px_0_#000] md:text-3xl">{item.title}</h2>
            <p className="mt-2 text-[17px] leading-snug text-slate-200">{item.blurb}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.chips.map((c) => (
                <span key={c} className="font-pixel border-2 border-white/20 bg-black/60 px-2 py-1 text-[7px] uppercase text-slate-200">
                  {c}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {item.soon ? (
                <span className="font-pixel border-2 border-yellow-400/60 bg-yellow-400/10 px-4 py-3 text-[9px] uppercase text-yellow-300">🔒 Coming soon</span>
              ) : (
                <button type="button" onClick={() => open(item)} className="px-btn primary !px-5 !py-3 !text-[11px]">
                  {item.id === "kickoff" ? "Kick off" : item.id === "ultimate" ? "Enter club" : "Open"} ▶
                </button>
              )}
              <span className="hidden text-slate-300 md:inline">
                <Kbd>↑</Kbd><Kbd>↓</Kbd> browse · <Kbd>ENTER</Kbd> select
              </span>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="hidden gap-1.5 md:flex">
              {[
                ["Teams", String(TEAMS.length)],
                ["Comps", String(COMPETITIONS.length)],
                ["Grounds", String(STADIUMS.length)],
              ].map(([k, v]) => (
                <div key={k} className="border-2 border-black bg-black/70 px-3 py-1.5 shadow-[3px_3px_0_#000]">
                  <p className="font-pixel text-[12px] leading-none text-yellow-300">{v}</p>
                  <p className="font-pixel mt-1 text-[6px] uppercase tracking-[0.2em] text-slate-400">{k}</p>
                </div>
              ))}
            </div>
            <div className="hidden lg:block">
              <NowPlaying onOpen={() => go({ name: "music" })} />
            </div>
          </div>
        </div>
      </div>

      {m.needsGesture && (
        <p className="font-pixel pointer-events-none absolute bottom-0 left-0 text-[7px] uppercase tracking-widest text-yellow-300/80">
          Click anywhere to start the music
        </p>
      )}
    </div>
  );
}
