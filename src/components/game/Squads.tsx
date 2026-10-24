"use client";

import { useEffect, useMemo, useState } from "react";
import { COMPETITIONS, POSITION_NAMES, TEAMS, getCompetition, getStadium, getTeam } from "@/game/data";
import { buildAttributes } from "@/game/engine";
import { MenuPad } from "@/game/gamepad";
import { Flag, flagFor } from "./Flags";
import type { TeamData } from "@/game/types";
import { Btn, Crest, Kicker, PlayerSprite, ScreenHeader, Scroll } from "./ui";

/** Short tag shown on each card, by shirt number. */
const POS_TAG = ["LH", "HK", "TH", "LK", "LK", "BF", "OF", "N8", "SH", "FH", "LW", "IC", "OC", "RW", "FB"];

/**
 * Where each shirt number sits on the pitch, as a percentage of the pitch panel.
 * Forwards pack down in the bottom third, backs fan out across the middle and top —
 * the classic 1-15 rugby union shape.
 */
const SPOTS: { x: number; y: number }[] = [
  { x: 36, y: 86 }, { x: 50, y: 88 }, { x: 64, y: 86 },   // 1-3 front row
  { x: 43, y: 75 }, { x: 57, y: 75 },                      // 4-5 locks
  { x: 29, y: 73 }, { x: 71, y: 73 },                      // 6-7 flankers
  { x: 50, y: 65 },                                        // 8
  { x: 38, y: 55 },                                        // 9 scrum-half
  { x: 52, y: 45 },                                        // 10 fly-half
  { x: 10, y: 30 },                                        // 11 left wing
  { x: 36, y: 33 },                                        // 12 inside centre
  { x: 56, y: 27 },                                        // 13 outside centre
  { x: 88, y: 24 },                                        // 14 right wing
  { x: 50, y: 10 },                                        // 15 fullback
];

/** Overall rating for a player, averaged from their generated attributes. */
function ovr(team: TeamData, index: number): number {
  const a = buildAttributes(index + 1, team.players[index], team.rating);
  const speed = ((a.speed - 5) / 3.6) * 99;
  return Math.round((speed + a.strength + a.tackling + a.handling + a.evasion) / 5);
}

function lastName(full: string): string {
  const parts = full.trim().split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : full;
}

export default function SquadsScreen() {
  const [filter, setFilter] = useState("all");
  const [teamId, setTeamId] = useState("rsa");
  const [sel, setSel] = useState(9); // fly-half selected by default
  const [listOpen, setListOpen] = useState(true);

  const teams = useMemo(
    () => (filter === "all" ? TEAMS : (getCompetition(filter)?.teamIds.map(getTeam) ?? TEAMS)),
    [filter],
  );
  const team = getTeam(teamId);
  const starters = team.players.slice(0, 15);
  const bench = team.players.slice(15);
  const safeSel = Math.min(sel, team.players.length - 1);
  const player = team.players[safeSel];
  const attrs = buildAttributes(safeSel + 1, player, team.rating);
  const rating = ovr(team, safeSel);
  const squadAvg = Math.round(team.players.reduce((acc, _, i) => acc + ovr(team, i), 0) / Math.max(1, team.players.length));

  // Arrow keys / Enter move around the XV, so the screen works without a mouse.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      const n = team.players.length;
      if (e.key === "ArrowRight") setSel((s) => (s + 1) % n);
      else if (e.key === "ArrowLeft") setSel((s) => (s - 1 + n) % n);
      else if (e.key === "ArrowDown") setSel((s) => Math.min(n - 1, s + 3));
      else if (e.key === "ArrowUp") setSel((s) => Math.max(0, s - 3));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [team.players.length]);

  // Controller: left stick / d-pad moves through the XV, A opens nothing (view only).
  useEffect(() => {
    const reader = new MenuPad();
    let raf = 0;
    const tick = () => {
      const nav = reader.poll();
      if (nav.down) setSel((s) => (s + 1) % team.players.length);
      if (nav.up) setSel((s) => (s - 1 + team.players.length) % team.players.length);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [team.players.length]);

  const stat = (label: string, value: number) => (
    <div key={label} className="flex items-center gap-2">
      <span className="font-pixel w-9 text-[8px] uppercase text-slate-400">{label}</span>
      <span className="h-1.5 flex-1 bg-white/10">
        <span className="block h-full bg-gradient-to-r from-green-500 to-yellow-300" style={{ width: `${Math.min(100, value)}%` }} />
      </span>
      <span className="font-pixel w-6 text-right text-[9px] text-white">{Math.round(value)}</span>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScreenHeader
        kicker="Teams & players"
        title="Squads"
        right={
          <div className="flex flex-wrap gap-1.5">
            {[{ id: "all", short: "All" }, ...COMPETITIONS].map((c) => (
              <Btn key={c.id} primary={filter === c.id} className="!px-2.5 !py-2 !text-[7px]" onClick={() => setFilter(c.id)}>
                {c.short}
              </Btn>
            ))}
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
        {/* ── left rail: team identity + team list ── */}
        <aside className="col-span-3 flex min-h-0 flex-col gap-2 xl:col-span-2">
          <div className="border-2 border-black bg-black/70 p-3 shadow-[3px_3px_0_#000]">
            <div className="flex items-center gap-2">
              <Flag id={flagFor(team.country)} size={34} title={team.country} />
              <Crest team={team} size={26} />
              <div className="min-w-0">
                <p className="font-pixel truncate text-[9px] uppercase leading-tight">{team.name}</p>
                <p className="truncate text-[14px] text-slate-400">{team.country}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
              <span className="font-pixel text-[7px] uppercase text-slate-400">Squad rating</span>
              <span className="font-pixel text-[13px] text-yellow-300">{squadAvg}</span>
            </div>
            <p className="mt-1 truncate text-[13px] text-slate-500">
              {team.stadiumId ? getStadium(team.stadiumId).name : "Neutral venues"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            className="font-pixel flex items-center justify-between border-2 border-black bg-black/60 px-2.5 py-2 text-[7px] uppercase tracking-widest text-slate-300 shadow-[3px_3px_0_#000] hover:text-white"
          >
            Change team <span aria-hidden>{listOpen ? "▾" : "▸"}</span>
          </button>

          {listOpen && (
            <Scroll className="min-h-0 flex-1 pr-1">
              <div className="space-y-1">
                {teams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTeamId(t.id); setSel(9); }}
                    className={`flex w-full items-center gap-2 border-2 px-2 py-1.5 text-left transition ${
                      t.id === teamId
                        ? "border-yellow-400 bg-yellow-400/10"
                        : "border-transparent bg-black/40 hover:border-white/20"
                    }`}
                  >
                    <Crest team={t} size={20} />
                    <span className="min-w-0 flex-1 truncate text-[14px]">{t.name}</span>
                    <span className="font-pixel text-[8px] text-slate-400">{t.rating}</span>
                  </button>
                ))}
              </div>
            </Scroll>
          )}
        </aside>

        {/* ── centre: the pitch ── */}
        <section className="col-span-6 flex min-h-0 flex-col xl:col-span-7">
          <div className="relative min-h-0 flex-1 overflow-hidden border-2 border-black shadow-[4px_4px_0_#000]">
            {/* pitch surface */}
            <div className="absolute inset-0">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute inset-x-0"
                  style={{ top: `${i * 10}%`, height: "10%", background: i % 2 ? "#1b6c31" : "#1f7a37" }}
                />
              ))}
            </div>
            {/* markings */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-[4%] top-[6%] h-px bg-white/55" />
              <div className="absolute inset-x-[4%] top-[22%] h-px bg-white/35" />
              <div className="absolute inset-x-[4%] top-1/2 h-0.5 bg-white/60" />
              <div className="absolute inset-x-[4%] bottom-[22%] h-px bg-white/35" />
              <div className="absolute inset-x-[4%] bottom-[6%] h-px bg-white/55" />
              <div className="absolute inset-y-[4%] left-[4%] w-px bg-white/45" />
              <div className="absolute inset-y-[4%] right-[4%] w-px bg-white/45" />
              <div className="absolute left-1/2 top-[3%] h-[6%] w-0.5 -translate-x-1/2 bg-white/70" />
              <div className="absolute bottom-[3%] left-1/2 h-[6%] w-0.5 -translate-x-1/2 bg-white/70" />
              <p className="font-pixel absolute bottom-3 left-4 text-[22px] uppercase text-white/10">1–15</p>
            </div>

            {/* player cards */}
            {starters.map((name, i) => {
              const spot = SPOTS[i];
              const active = i === safeSel;
              const r = ovr(team, i);
              return (
                <button
                  key={i}
                  onClick={() => setSel(i)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-100 hover:z-20 hover:scale-110"
                  style={{ left: `${spot.x}%`, top: `${spot.y}%`, zIndex: active ? 30 : 10 }}
                  title={`${i + 1} ${name} · ${POSITION_NAMES[i]}`}
                >
                  <span
                    className={`relative flex w-[58px] flex-col items-center border-2 pb-0.5 pt-0.5 shadow-[2px_2px_0_#000] ${
                      active ? "border-yellow-300 bg-[#10243a]" : "border-black bg-[#0b1626]/95"
                    }`}
                  >
                    {active && <span className="absolute -inset-1 border-2 border-yellow-300" aria-hidden />}
                    <span className="flex w-full items-center justify-between px-1">
                      <span className="font-pixel text-[9px] text-yellow-300">{r}</span>
                      <span className="font-pixel text-[6px] text-slate-400">{POS_TAG[i]}</span>
                    </span>
                    <PlayerSprite
                      jersey={team.primary}
                      jersey2={team.secondary}
                      number={i + 1}
                      name={name}
                      scale={1}
                      view="front"
                      pose="idle"
                    />
                    <span className="font-pixel w-full truncate px-0.5 text-center text-[6px] uppercase text-white">
                      {lastName(name).slice(0, 9)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {bench.length > 0 && (
            <div className="mt-2 border-2 border-black bg-black/70 p-2 shadow-[3px_3px_0_#000]">
              <p className="font-pixel mb-1.5 text-[7px] uppercase tracking-widest text-slate-400">
                Bench &amp; wider squad · {bench.length}
              </p>
              <div className="flex gap-1 overflow-x-auto pb-1 scroll">
                {bench.map((name, i) => {
                  const idx = i + 15;
                  const active = idx === safeSel;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSel(idx)}
                      title={`${idx + 1} ${name}`}
                      className={`flex shrink-0 items-center gap-1.5 border-2 px-2 py-1 ${
                        active ? "border-yellow-300 bg-yellow-400/10" : "border-black bg-[#0b1626]"
                      }`}
                    >
                      <span className="font-pixel text-[8px] text-yellow-300">{ovr(team, idx)}</span>
                      <span className="font-pixel text-[7px] uppercase text-slate-200">{lastName(name).slice(0, 10)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ── right: selected player ── */}
        <aside className="col-span-3 flex min-h-0 flex-col gap-2">
          <div className="flex min-h-0 flex-1 flex-col border-2 border-black bg-black/75 p-3 shadow-[3px_3px_0_#000]">
            <div className="flex items-start gap-3">
              <span className="border-2 border-black bg-[#10243a] p-1 shadow-[2px_2px_0_#000]">
                <PlayerSprite jersey={team.primary} jersey2={team.secondary} number={safeSel + 1} name={player} scale={2} view="front" pose="idle" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-pixel text-[7px] uppercase tracking-widest text-yellow-400">#{safeSel + 1} {POS_TAG[safeSel] ?? "RES"}</p>
                <p className="font-pixel mt-1 break-words text-[11px] uppercase leading-snug">{player}</p>
                <p className="mt-1 text-[14px] text-slate-400">{POSITION_NAMES[safeSel] ?? "Replacement"}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-y border-white/10 py-2">
              <span className="font-pixel text-[7px] uppercase text-slate-400">Overall</span>
              <span className="font-pixel text-[20px] text-yellow-300">{rating}</span>
            </div>

            <div className="mt-3 space-y-1.5">
              {stat("PAC", ((attrs.speed - 5) / 3.6) * 99)}
              {stat("STR", attrs.strength)}
              {stat("TCK", attrs.tackling)}
              {stat("HND", attrs.handling)}
              {stat("KCK", attrs.kicking)}
              {stat("EVA", attrs.evasion)}
            </div>

            <div className="mt-3 border-t border-white/10 pt-2">
              <Kicker>Role</Kicker>
              <p className="mt-1 text-[14px] leading-snug text-slate-300">
                {safeSel < 8
                  ? "Forward – wins the ball at scrum, lineout and ruck. Strong in contact, best for bouncing defenders."
                  : safeSel < 15
                    ? "Back – creates and finishes chances in open space. Quicker and more agile, best for side steps."
                    : "Replacement – ready on the bench to change the game in the closing quarter."}
              </p>
            </div>

            <p className="font-pixel mt-auto pt-3 text-[6px] uppercase tracking-widest text-slate-500">
              Arrow keys move around the XV
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
