"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as audio from "@/game/audio";
import { COMPETITIONS, STADIUMS, TEAMS, getTeam } from "@/game/data";
import { music, useMusic } from "@/game/music/player";
import type { SessionUser } from "@/lib/auth";
import GameMark from "./GameMark";
import type { Screen } from "./GameShell";
import NowPlaying from "./NowPlaying";
import { Crest, Kbd, RunningSprite } from "./ui";

type Art = "hero" | "trophy" | "stadium";

interface Item {
  id: string;
  title: string;
  sub: string;
  blurb: string;
  accent: string;
  art: Art;
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

const ART: Record<Art, string> = {
  hero: "/img/hero.jpg",
  trophy: "/img/trophy.jpg",
  stadium: "/img/stadium.jpg",
};

export default function MainMenu({ user, go }: { user: SessionUser | null; go: (s: Screen) => void }) {
  const items: Item[] = useMemo(
    () => [
      {
        id: "kickoff", title: "Kick Off", sub: "Quick match", tier: "featured", accent: "#facc15", art: "hero",
        blurb: "Pick any team, choose from 19 stadiums, win the coin toss and play full-length rugby union with scrums, lineouts, kicking and penalties.",
        chips: ["80 minutes", "Coin toss", "Scrum contest", "Replays"], screen: { name: "play" },
      },
      {
        id: "ultimate", title: "Ultimate Team", sub: "Build · Packs · Promotion", tier: "featured", accent: "#c084fc", art: "trophy",
        blurb: "Start with a bruised, battered squad and build a club of your own. Open packs, quick-sell players and fight up through the divisions to the top flight.",
        chips: ["Pack opening", "Squad builder", "Seasons", "Quick sell"], screen: { name: "ultimate" },
      },
      {
        id: "compete", title: "Competitions", sub: "World Cup · 6N · URC", tier: "main", accent: "#38bdf8", art: "trophy",
        blurb: "Rugby World Cup, Six Nations, Rugby Championship, URC, Premiership and Super Rugby Pacific – full tables, knockouts and every fixture simulated.",
        chips: COMPETITIONS.map((c) => c.short), screen: { name: "competitions" },
      },
      {
        id: "online", title: "Online", sub: "Challenge a friend", tier: "main", accent: "#34d399", art: "stadium",
        blurb: "Invite another player by username and settle it in a live head-to-head match.",
        chips: ["Invite by username", "Live match"], screen: { name: "online" },
      },
      {
        id: "squads", title: "Squads", sub: "Every team & player", tier: "main", accent: "#fb923c", art: "hero",
        blurb: "Browse every squad, check player ratings and meet the pixel stars of all the teams.",
        chips: [`${TEAMS.length} teams`, "Player ratings"], screen: { name: "squads" },
      },
      {
        id: "music", title: "Music", sub: "Your soundtrack", tier: "main", accent: "#f472b6", art: "stadium",
        blurb: "Play, skip and shuffle your songs while you browse the menus – or add your own MP3s.",
        chips: ["Play · skip · back", "Shuffle", "Add MP3s"], screen: { name: "music" },
      },
      {
        id: "manager", title: "Manager", sub: "Coming soon", tier: "chip", accent: "#94a3b8", art: "stadium", soon: true,
        blurb: "Take charge of a club through a whole season. This mode is coming soon.", chips: ["Coming soon"],
      },
      {
        id: "player", title: "Player Career", sub: "Coming soon", tier: "chip", accent: "#94a3b8", art: "hero", soon: true,
        blurb: "Create a player and grow from rookie to legend. This mode is coming soon.", chips: ["Coming soon"],
      },
      {
        id: "controls", title: "Controls", sub: "Rebind keys", tier: "chip", accent: "#60a5fa", art: "stadium",
        blurb: "Rebind every key to suit your keyboard.", chips: ["Presets", "Custom keys"], screen: { name: "controls" },
      },
      {
        id: "settings", title: "Settings", sub: "Audio & look", tier: "chip", accent: "#cbd5e1", art: "stadium",
        blurb: "Music and effects volume, soft or crisp pixels, and performance options.", chips: ["Volume", "Soft pixels"], screen: { name: "settings" },
      },
      {
        id: "howto", title: "How To Play", sub: "Laws & tips", tier: "chip", accent: "#fbbf24", art: "hero",
        blurb: "Controls, the laws of the game and tips for breaking the defensive line.", chips: ["Controls", "Laws"], screen: { name: "howto" },
      },
      user
        ? { id: "record", title: "My Record", sub: "Career & history", tier: "chip", accent: "#4ade80", art: "trophy", blurb: "Your results, record and competitions.", chips: ["History"], screen: { name: "profile" } }
        : { id: "signin", title: "Sign In", sub: "Save progress", tier: "chip", accent: "#4ade80", art: "trophy", blurb: "Create an account to save results, competitions and your Ultimate Team.", chips: ["Free"], screen: { name: "profile", mode: "login" } },
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

  // Today's featured fixture. It starts as a fixed pair (so the server and browser render the
  // same HTML) and is shuffled right after the first paint.
  const [fixture, setFixture] = useState<readonly [ReturnType<typeof getTeam>, ReturnType<typeof getTeam>]>(() => [getTeam("nzl"), getTeam("rsa")]);
  useEffect(() => {
    const ids = ["nzl", "rsa", "ire", "fra", "eng", "sco", "aus", "arg"];
    const a = ids[Math.floor(Math.random() * ids.length)];
    let b = ids[Math.floor(Math.random() * ids.length)];
    if (b === a) b = ids[(ids.indexOf(a) + 3) % ids.length];
    setFixture([getTeam(a), getTeam(b)]);
  }, []);
  const showcase = useMemo(() => [getTeam("rsa"), getTeam("nzl"), getTeam("fra")], []);

  const featured = items.filter((i) => i.tier === "featured");
  const mains = items.filter((i) => i.tier === "main");
  const chips = items.filter((i) => i.tier === "chip");

  const rowCls = (it: Item) => (items[sel].id === it.id ? "menu-row is-active" : "menu-row");

  return (
    <div className="relative grid h-full min-h-0 gap-5 lg:grid-cols-[minmax(310px,390px)_minmax(0,1fr)]">
      {/* ───────────── left rail ───────────── */}
      <div className="flex min-h-0 flex-col gap-2">
        <div className="mb-1 flex items-center justify-between">
          <GameMark size={46} />
          <span className="text-right text-xs font-bold uppercase leading-tight tracking-[0.2em] text-slate-400">
            Pixel rugby<br />union
          </span>
        </div>

        {featured.map((it) => (
          <button
            key={it.id}
            type="button"
            onMouseEnter={() => setSel(items.indexOf(it))}
            onClick={() => open(it)}
            className={`${rowCls(it)} min-h-[64px] flex-[1.35]`}
            style={{ ["--accent" as string]: it.accent }}
          >
            <span className="menu-bar" />
            <span className="min-w-0 flex-1 text-left">
              <span className="block font-display text-[28px] font-bold uppercase leading-none tracking-wide">{it.title}</span>
              <span className="mt-1 block text-[15px] font-semibold leading-none text-slate-300">{it.sub}</span>
            </span>
            <span className="rounded-full border px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-widest" style={{ borderColor: it.accent, color: it.accent }}>Featured</span>
            <span className="menu-arrow">›</span>
          </button>
        ))}

        {mains.map((it) => (
          <button
            key={it.id}
            type="button"
            onMouseEnter={() => setSel(items.indexOf(it))}
            onClick={() => open(it)}
            className={`${rowCls(it)} min-h-[40px] flex-1`}
            style={{ ["--accent" as string]: it.accent }}
          >
            <span className="menu-bar" />
            <span className="min-w-0 flex-1 text-left">
              <span className="block font-display text-[21px] font-bold uppercase leading-none tracking-wide">{it.title}</span>
              <span className="mt-0.5 block truncate text-[14px] font-semibold leading-none text-slate-400">{it.sub}</span>
            </span>
            <span className="menu-arrow">›</span>
          </button>
        ))}

        <div className="mt-1 grid grid-cols-2 gap-2">
          {chips.map((it) => (
            <button
              key={it.id}
              type="button"
              onMouseEnter={() => setSel(items.indexOf(it))}
              onClick={() => open(it)}
              className={`${rowCls(it)} menu-chip min-h-[38px] ${it.soon ? "opacity-70" : ""}`}
              style={{ ["--accent" as string]: it.accent }}
              aria-disabled={it.soon}
            >
              <span className="menu-bar" />
              <span className="min-w-0 flex-1 text-left font-display text-[15px] font-bold uppercase leading-none tracking-wide">
                {it.title}
              </span>
              {it.soon && (
                <span className="rounded bg-yellow-400/15 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-yellow-300">Soon</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ───────────── spotlight ───────────── */}
      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <div className="relative min-h-[260px] flex-1 overflow-hidden rounded-3xl border border-white/15 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
          {(Object.keys(ART) as Art[]).map((a) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={a}
              src={ART[a]}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
              style={{ opacity: item.art === a ? 0.75 : 0 }}
            />
          ))}
          <div className="absolute inset-0 transition-all duration-500" style={{ background: `linear-gradient(115deg, ${item.accent}66 0%, transparent 55%)` }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

          {/* top strip */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-5">
            <div>
              <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-slate-300">
                {user ? `Welcome back, ${user.username}` : "Welcome to PixelRuggas"}
              </p>
              {record && (
                <p className="mt-1 font-display text-lg font-bold tracking-wide">
                  <span className="text-green-400">{record.wins}W</span> <span className="text-slate-300">{record.draws}D</span> <span className="text-red-400">{record.losses}L</span>
                </p>
              )}
            </div>
            <Extra id={item.id} fixture={fixture} showcase={showcase} playingTitle={m.current?.title ?? null} />
          </div>

          {/* content */}
          <div key={item.id} className="slide-in absolute inset-x-0 bottom-0 p-6 md:p-8">
            <p className="font-display text-sm font-bold uppercase tracking-[0.35em]" style={{ color: item.accent }}>
              {item.soon ? "Coming soon" : item.tier === "featured" ? "Featured mode" : "Menu"}
            </p>
            <h2 className="mt-1 font-display text-5xl font-bold uppercase leading-none tracking-wide drop-shadow-[0_4px_14px_rgba(0,0,0,0.7)] md:text-7xl">{item.title}</h2>
            <p className="mt-3 max-w-xl text-xl font-semibold leading-snug text-slate-200">{item.blurb}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {item.chips.map((c) => (
                <span key={c} className="rounded-full border border-white/20 bg-black/40 px-3 py-1 font-display text-sm font-bold uppercase tracking-wider text-slate-200 backdrop-blur">
                  {c}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-4">
              {item.soon ? (
                <span className="rounded-lg border border-yellow-400/50 bg-yellow-400/10 px-5 py-3 font-display text-lg font-bold uppercase tracking-[0.2em] text-yellow-300">🔒 Coming soon</span>
              ) : (
                <button
                  type="button"
                  onClick={() => open(item)}
                  className="rounded-lg px-7 py-3 font-display text-xl font-bold uppercase tracking-[0.2em] text-black shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition hover:brightness-110 active:translate-y-px"
                  style={{ background: item.accent }}
                >
                  {item.id === "kickoff" ? "Kick off" : item.id === "ultimate" ? "Enter club" : "Open"} →
                </button>
              )}
              {!item.soon && <span className="hidden text-slate-300 md:block"><Kbd>ENTER</Kbd> to select</span>}
            </div>
          </div>
        </div>

        {/* stat strip */}
        <div className="grid grid-cols-4 gap-3">
          {[
            ["Teams", String(TEAMS.length)],
            ["Competitions", String(COMPETITIONS.length)],
            ["Stadiums", String(STADIUMS.length)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-white/10 bg-black/45 px-4 py-2 backdrop-blur">
              <p className="font-display text-3xl font-bold leading-none text-yellow-300">{v}</p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{k}</p>
            </div>
          ))}
          <div className="hidden items-center justify-center rounded-xl border border-white/10 bg-black/45 px-2 backdrop-blur md:flex">
            <NowPlaying onOpen={() => go({ name: "music" })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Extra({
  id, fixture, showcase, playingTitle,
}: {
  id: string;
  fixture: readonly [ReturnType<typeof getTeam>, ReturnType<typeof getTeam>];
  showcase: ReturnType<typeof getTeam>[];
  playingTitle: string | null;
}) {
  const card = "rounded-2xl border border-white/15 bg-black/50 p-3 backdrop-blur";
  if (id === "kickoff") {
    return (
      <div className={`${card} text-center`}>
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-yellow-300">Today&apos;s fixture</p>
        <div className="mt-2 flex items-center gap-3">
          <Crest team={fixture[0]} size={38} />
          <span className="font-display text-xl font-bold text-slate-300">VS</span>
          <Crest team={fixture[1]} size={38} />
        </div>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{fixture[0].short} · {fixture[1].short}</p>
      </div>
    );
  }
  if (id === "compete") {
    return (
      <div className={`${card} flex max-w-[220px] flex-wrap justify-end gap-1.5`}>
        {COMPETITIONS.map((c) => (
          <span key={c.id} className="rounded-md px-2 py-0.5 font-display text-sm font-bold text-black" style={{ background: c.color }}>{c.short}</span>
        ))}
      </div>
    );
  }
  if (id === "squads") {
    return (
      <div className={`${card} flex items-end gap-1`}>
        {showcase.map((t, i) => (
          <RunningSprite key={t.id} jersey={t.primary} jersey2={t.secondary} number={[8, 10, 14][i]} name={t.players[[7, 9, 13][i]]} scale={3} />
        ))}
      </div>
    );
  }
  if (id === "music") {
    return (
      <div className={`${card} max-w-[240px]`}>
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-pink-300">On air</p>
        <p className="mt-1 truncate font-display text-lg font-bold">{playingTitle ?? "Built-in theme"}</p>
      </div>
    );
  }
  return null;
}
