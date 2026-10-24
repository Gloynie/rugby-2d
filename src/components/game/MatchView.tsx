"use client";

import { useEffect, useRef, useState } from "react";
import { ACTIONS, keyLabel, type Bindings } from "@/game/controls";
import { VIEW_H, VIEW_W } from "@/game/render";
import { GameRuntime } from "@/game/runtime";
import type { MatchConfig, MatchResult, Stadium } from "@/game/types";
import { Flag, flagFor } from "./Flags";
import NowPlaying from "./NowPlaying";
import { Btn, Kbd, Kicker, Panel, PlayerSprite } from "./ui";

const MAX_BENCH = 8;

/** Rugby formation spots, as a % of the pitch panel (1..15 in shirt order). */
const SPOTS: { x: number; y: number }[] = [
  { x: 38, y: 88 }, { x: 50, y: 90 }, { x: 62, y: 88 },
  { x: 44, y: 76 }, { x: 56, y: 76 },
  { x: 30, y: 74 }, { x: 70, y: 74 },
  { x: 50, y: 65 },
  { x: 40, y: 55 },
  { x: 53, y: 45 },
  { x: 11, y: 30 }, { x: 36, y: 34 }, { x: 57, y: 28 }, { x: 89, y: 24 },
  { x: 50, y: 11 },
];
const POS_TAG = ["LH", "HK", "TH", "LK", "LK", "BF", "OF", "N8", "SH", "FH", "LW", "IC", "OC", "RW", "FB"];

interface Props {
  config: MatchConfig;
  stadium: Stadium;
  competition: string;
  bindings: Bindings;
  onFinish: (result: MatchResult) => void;
  onQuit: () => void;
}

export default function MatchView({ config, stadium, competition, bindings, onFinish, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rtRef = useRef<GameRuntime | null>(null);
  const [paused, setPaused] = useState(false);
  const [menuView, setMenuView] = useState<"main" | "subs" | "controls">("main");
  const [subOff, setSubOff] = useState<number | null>(null);
  const [subOn, setSubOn] = useState<number | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(1);
  const [pad, setPad] = useState(false);
  const [subFlash, setSubFlash] = useState<{ off: string; on: string } | null>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rt = new GameRuntime({
      canvas,
      config,
      stadium,
      bindings,
      competition,
      onFinish: (r) => finishRef.current(r),
      onPauseToggle: () => {
        const next = !rt.paused;
        rt.setPaused(next);
        setPaused(next);
        setMenuView("main");
        setSubOff(null);
        setSubOn(null);
      },
    });
    rtRef.current = rt;
    void rt.start();
    return () => rt.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show controller prompts only when a pad is plugged in.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (typeof navigator !== "undefined" && navigator.getGamepads) {
        for (const p of navigator.getGamepads()) {
          if (p && p.connected) {
            setPad(true);
            break;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const engine = rtRef.current?.engine ?? null;
  const userTeamIdx = config.userTeam;

  const activeOnField = engine
    ? engine.players.filter((p) => p.team === userTeamIdx && p.isOnField).sort((a, b) => a.number - b.number)
    : [];
  const benchPlayers = engine
    ? engine.players.filter((p) => p.team === userTeamIdx && p.isBench && !p.hasBeenSubbedOff).sort((a, b) => a.number - b.number)
    : [];
  const usedUp = engine
    ? engine.players.filter((p) => p.team === userTeamIdx && p.hasBeenSubbedOff).sort((a, b) => a.number - b.number)
    : [];

  const resume = () => {
    rtRef.current?.setPaused(false);
    setPaused(false);
    setMenuView("main");
  };

  const changeSpeed = (speed: number) => {
    setCurrentSpeed(speed);
    if (rtRef.current) rtRef.current.engine.spectatorSpeed = speed;
  };

  const handleSub = () => {
    if (subOff === null || subOn === null || !rtRef.current || userTeamIdx === null) return;
    const ok = rtRef.current.engine.makeSubstitution(userTeamIdx, subOn, subOff);
    if (!ok) return;
    const offName = engine?.players.find((p) => p.number === subOff)?.name ?? "";
    const onName = engine?.players.find((p) => p.number === subOn)?.name ?? "";
    setSubOff(null);
    setSubOn(null);
    setSubFlash({ off: offName, on: onName });
    window.setTimeout(() => setSubFlash(null), 3200);
    setMenuView("main");
    resume();
  };

  const k = (c: string) => keyLabel(c, true);

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        className="pixelated game-canvas max-h-full max-w-full"
        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, width: "100%", height: "auto" }}
      />

      {/* Substitution cutscene */}
      {subFlash && (
        <div className="absolute inset-x-0 top-1/3 z-50 flex justify-center">
          <Panel className="sub-cut w-[620px] max-w-[95vw] p-5" accent="#22c55e">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 text-right">
                <p className="font-pixel text-[8px] uppercase tracking-widest text-red-400">Off</p>
                <p className="font-pixel mt-1 text-[11px] uppercase leading-snug">{subFlash.off}</p>
              </div>
              <span className="font-pixel shrink-0 text-[18px] text-yellow-300">⇄</span>
              <div className="flex-1 text-left">
                <p className="font-pixel text-[8px] uppercase tracking-widest text-green-400">On</p>
                <p className="font-pixel mt-1 text-[11px] uppercase leading-snug">{subFlash.on}</p>
              </div>
            </div>
            <p className="font-pixel mt-3 text-center text-[8px] uppercase tracking-[0.3em] text-slate-300">
              Substitution · {benchPlayers.length + 1} left on the bench
            </p>
          </Panel>
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#05070d]/72">
          <Panel
            className={`p-7 slide-in ${menuView === "subs" ? "w-[1080px]" : "w-[560px]"} max-w-[96vw]`}
          >
            <div className="flex items-start justify-between">
              <div>
                <Kicker>Paused</Kicker>
                <h2 className="font-pixel mt-2 text-xl uppercase">
                  {menuView === "subs" ? "Substitutions" : "Match Menu"}
                </h2>
              </div>
              <div className="hidden md:block">
                <NowPlaying />
              </div>
            </div>

            {menuView === "main" && (
              <div className="mt-6 grid gap-3">
                <Btn primary onClick={resume}>
                  {pad ? "A · " : ""}Resume Match
                </Btn>

                {config.userTeam !== null && (
                  <Btn onClick={() => setMenuView("subs")}>
                    Substitutions · {benchPlayers.length}/{MAX_BENCH} on bench
                  </Btn>
                )}

                <div className="flex items-center justify-between border-2 border-slate-700 bg-slate-900/60 p-3">
                  <span className="font-pixel text-[9px] uppercase text-slate-300">Watch speed</span>
                  <div className="flex gap-2">
                    <Btn primary={currentSpeed === 1} className="!py-2 !text-[8px]" onClick={() => changeSpeed(1)}>1X</Btn>
                    <Btn primary={currentSpeed === 2} className="!py-2 !text-[8px]" onClick={() => changeSpeed(2)}>2X</Btn>
                  </div>
                </div>

                <Btn onClick={() => setMenuView("controls")}>View Controls</Btn>
                <Btn danger onClick={onQuit}>Quit to Menu</Btn>
                <p className="mt-1 text-slate-400">
                  {pad ? (
                    <>Use the <Kbd>LEFT STICK</Kbd> to move this menu, <Kbd>A</Kbd> to select, <Kbd>B</Kbd> to go back.</>
                  ) : (
                    <>Press <Kbd>{keyLabel(bindings.pause)}</Kbd> to resume · <Kbd>{keyLabel(bindings.help)}</Kbd> toggles help</>
                  )}
                </p>
              </div>
            )}

            {menuView === "controls" && (
              <div className="mt-4">
                {pad && (
                  <p className="mb-3 rounded border border-green-400/50 bg-green-950/40 px-3 py-2 text-green-200">
                    Controller detected. Left stick or d-pad moves the menu, <b>A</b> selects, <b>B</b> goes back,
                    <b> right stick</b> does skill moves in play.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {ACTIONS.map((a) => (
                    <div key={a.id} className="flex items-center justify-between border-b border-white/10 py-1">
                      <span className="text-slate-300">{a.label}</span>
                      <span className="flex items-center gap-1.5">
                        <Kbd>{keyLabel(bindings[a.id])}</Kbd>
                        {pad && <PadHint action={a.id} />}
                      </span>
                    </div>
                  ))}
                  {pad && (
                    <>
                      <div className="col-span-2 mt-2 font-pixel text-[8px] uppercase tracking-widest text-green-300">
                        Controller only
                      </div>
                      <div className="flex justify-between"><span className="text-slate-300">Move</span><Kbd>L-STICK</Kbd></div>
                      <div className="flex justify-between"><span className="text-slate-300">Hand off</span><Kbd>R ↑</Kbd></div>
                      <div className="flex justify-between"><span className="text-slate-300">Bounce</span><Kbd>R ↓</Kbd></div>
                      <div className="flex justify-between"><span className="text-slate-300">Step left</span><Kbd>R ←</Kbd></div>
                      <div className="flex justify-between"><span className="text-slate-300">Step right</span><Kbd>R →</Kbd></div>
                    </>
                  )}
                </div>
                <p className="mt-3 text-slate-400">Rebind keys from the main menu → Controls.</p>
                <Btn className="mt-4" onClick={() => setMenuView("main")}>Back</Btn>
              </div>
            )}

            {menuView === "subs" && engine && userTeamIdx !== null && (
              <div className="mt-4">
                <p className="text-sm text-slate-400">
                  Tap a player on the pitch to take them off, then pick a replacement from the bench.
                  Up to {MAX_BENCH} on the bench — players who come off cannot return.
                </p>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
                  {/* ---------- pitch ---------- */}
                  <div className="relative min-h-[300px] overflow-hidden border-2 border-black shadow-[3px_3px_0_#000]">
                    <div className="absolute inset-0">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="absolute inset-x-0" style={{ top: `${i * 10}%`, height: "10%", background: i % 2 ? "#1b6c31" : "#1f7a37" }} />
                      ))}
                    </div>
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-x-[4%] top-1/2 h-0.5 bg-white/55" />
                      <div className="absolute inset-y-[4%] left-1/2 w-0.5 bg-white/45" />
                      <div className="absolute inset-x-[4%] top-[6%] h-px bg-white/50" />
                      <div className="absolute inset-x-[4%] bottom-[6%] h-px bg-white/50" />
                    </div>

                    {activeOnField.map((p) => {
                      const idx = Math.min(14, Math.max(0, p.number - 1));
                      const spot = SPOTS[idx];
                      const chosen = subOff === p.number;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSubOff(chosen ? null : p.number)}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:z-20 hover:scale-110 ${chosen ? "z-30 scale-110" : "z-10"}`}
                          style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                        >
                          <span
                            className={`relative flex w-[54px] flex-col items-center border-2 pb-0.5 pt-0.5 shadow-[2px_2px_0_#000] ${
                              chosen ? "border-red-500 bg-red-100" : "border-[#141a21]/20 bg-white"
                            }`}
                          >
                            {chosen && <span className="absolute -inset-1 border-2 border-red-400" />}
                            <span className="flex w-full items-center justify-between px-1">
                              <span className="font-pixel text-[8px] text-yellow-300">{POS_TAG[idx]}</span>
                            </span>
                            <PlayerSprite jersey={engine.teams[p.team].color} jersey2={engine.teams[p.team].data.secondary} number={p.number} name={p.name} scale={1.5} view="front" />
                            <span className="font-pixel w-full truncate px-0.5 text-center text-[6px] uppercase text-white">
                              {p.name.split(" ").slice(-1)[0].slice(0, 9)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* ---------- bench ---------- */}
                  <div className="flex min-h-0 flex-col">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <Kicker>Bench · {benchPlayers.length}/{MAX_BENCH}</Kicker>
                      {engine && userTeamIdx !== null && <Flag id={flagFor(engine.teams[userTeamIdx].data.country)} size={20} title={engine.teams[userTeamIdx].data.country} />}
                    </div>

                    <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1 scroll">
                      <div className="grid grid-cols-2 gap-2">
                        {benchPlayers.map((p) => {
                          const chosen = subOn === p.number;
                          return (
                            <button
                              key={p.id}
                              onClick={() => setSubOn(chosen ? null : p.number)}
                              className={`relative flex flex-col items-center border-2 px-1.5 pb-1.5 pt-1 text-center shadow-[2px_2px_0_#000] transition ${
                                chosen ? "border-green-400 bg-green-400/10" : "border-black bg-black/50 hover:-translate-y-0.5 hover:border-white/25"
                              }`}
                            >
                              {chosen && <span className="font-pixel absolute right-1 top-1 text-[7px] text-green-400">ON</span>}
                              <span className="font-pixel self-start text-[8px] text-yellow-300">#{p.number}</span>
                              <PlayerSprite jersey={engine.teams[p.team].color} jersey2={engine.teams[p.team].data.secondary} number={p.number} name={p.name} scale={2} view="front" />
                              <span className="font-pixel mt-0.5 w-full truncate text-[7px] uppercase leading-tight">{p.name}</span>
                              <span className="mt-0.5 text-[13px] leading-none text-slate-400">
                                PAC {p.attrs.speed.toFixed(1)} · STR {Math.round(p.attrs.strength)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {benchPlayers.length === 0 && (
                        <p className="p-2 text-sm text-slate-500">Bench empty — all replacements used.</p>
                      )}
                    </div>

                    {usedUp.length > 0 && (
                      <div className="mt-2 border-t border-white/10 pt-2">
                        <p className="font-pixel text-[7px] uppercase tracking-widest text-slate-500">Used</p>
                        <p className="mt-1 text-sm leading-snug text-slate-500">
                          {usedUp.map((p) => p.name.split(" ").slice(-1)[0]).join(", ")}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex gap-3">
                      <Btn primary disabled={subOff === null || subOn === null} onClick={handleSub}>
                        {subOff !== null && subOn !== null ? "Confirm sub" : "Pick both players"}
                      </Btn>
                      <Btn onClick={() => { setSubOff(null); setSubOn(null); setMenuView("main"); }}>Cancel</Btn>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

/** Controller button hint for an action, matching DEFAULT_PAD_BINDINGS. */
function PadHint({ action }: { action: string }) {
  const map: Record<string, string> = {
    action: "A", sprint: "RT", passUp: "Y", passDown: "X", kick: "B", dropGoal: "RB",
    switch: "LB", opt1: "D↑", opt2: "D←", opt3: "D→", pause: "START", help: "BACK",
    handOff: "R↑", bounce: "R↓", stepLeft: "R←", stepRight: "R→",
  };
  const hint = map[action];
  if (!hint) return null;
  return (
    <span className="font-pixel border border-green-400/60 bg-green-950/50 px-1.5 py-0.5 text-[7px] text-green-300">
      {hint}
    </span>
  );
}
