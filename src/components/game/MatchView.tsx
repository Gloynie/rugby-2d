"use client";

import { useEffect, useRef, useState } from "react";
import { ACTIONS, keyLabel, type Bindings } from "@/game/controls";
import { VIEW_H, VIEW_W } from "@/game/render";
import { GameRuntime } from "@/game/runtime";
import type { MatchConfig, MatchResult, Stadium } from "@/game/types";
import { Btn, Kbd, Kicker, Panel } from "./ui";

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
  const [menuView, setMenuView] = useState<"main" | "controls" | "subs">("main");
  const [subOff, setSubOff] = useState<number | null>(null); // Player going off (shirt number)
  const [subOn, setSubOn] = useState<number | null>(null);   // Player coming on (shirt number)
  const [currentSpeed, setCurrentSpeed] = useState(config.spectatorSpeed ?? 1);

  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rt = new GameRuntime({
      canvas,
      config: { ...config, spectatorSpeed: currentSpeed },
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
    return () => {
      rt.stop();
      import("@/game/audio").then((a) => a.stopMenuMusic());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resume = () => {
    rtRef.current?.setPaused(false);
    setPaused(false);
    setMenuView("main");
  };

  const changeSpeed = (speed: number) => {
    setCurrentSpeed(speed);
    if (rtRef.current) {
      rtRef.current.engine.spectatorSpeed = speed;
    }
  };

  const handleSub = () => {
    if (subOff !== null && subOn !== null && rtRef.current) {
      const teamIdx = config.userTeam ?? 0;
      const ok = rtRef.current.engine.makeSubstitution(teamIdx, subOn, subOff);
      if (ok) {
        setSubOff(null);
        setSubOn(null);
        resume();
      }
    }
  };

  const engine = rtRef.current?.engine;
  const userTeamIdx = config.userTeam ?? 0;
  
  // List active on-field players for substitution (user's team)
  const activeOnField = engine?.players.filter((p) => p.team === userTeamIdx && p.isOnField) ?? [];
  // List bench players who haven't been subbed off or injured yet
  const benchPlayers = engine?.players.filter((p) => p.team === userTeamIdx && p.isBench && !p.hasBeenSubbedOff && !p.isInjured) ?? [];

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        className="pixelated max-h-full max-w-full"
        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, width: "100%", height: "auto" }}
      />
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <Panel className="w-[560px] max-w-[95vw] p-7 slide-in">
            <Kicker>Paused</Kicker>
            <h2 className="font-pixel mt-2 text-xl uppercase">Match Menu</h2>
            
            {menuView === "main" && (
              <div className="mt-6 grid gap-3">
                <Btn primary onClick={resume}>Resume Match</Btn>
                
                {/* Substitutions Option (only if user controls a team) */}
                {config.userTeam !== null && (
                  <Btn onClick={() => setMenuView("subs")}>Substitutions (Tactics)</Btn>
                )}

                {/* Spectating Speed Controls */}
                <div className="flex items-center justify-between border-2 border-slate-700 bg-slate-900/60 p-3">
                  <span className="font-pixel text-[9px] uppercase text-slate-300">Spectator Speed</span>
                  <div className="flex gap-2">
                    <Btn primary={currentSpeed === 1} className="!py-2 !text-[8px]" onClick={() => changeSpeed(1)}>1X (Normal)</Btn>
                    <Btn primary={currentSpeed === 2} className="!py-2 !text-[8px]" onClick={() => changeSpeed(2)}>2X (Fast)</Btn>
                  </div>
                </div>

                <Btn onClick={() => setMenuView("controls")}>View Controls</Btn>
                <Btn danger onClick={onQuit}>Quit to Menu</Btn>
                <p className="mt-2 text-slate-400">
                  Press <Kbd>{keyLabel(bindings.pause)}</Kbd> to resume · <Kbd>{keyLabel(bindings.help)}</Kbd> toggles help
                </p>
              </div>
            )}

            {menuView === "controls" && (
              <div className="mt-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {ACTIONS.map((a) => (
                    <div key={a.id} className="flex items-center justify-between border-b border-white/10 py-1">
                      <span className="text-slate-300">{a.label}</span>
                      <Kbd>{keyLabel(bindings[a.id])}</Kbd>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-slate-400">Rebind keys from the main menu → Controls.</p>
                <Btn className="mt-4" onClick={() => setMenuView("main")}>Back</Btn>
              </div>
            )}

            {menuView === "subs" && (
              <div className="mt-4">
                <Kicker>Tactical Substitutions</Kicker>
                <p className="text-xs text-slate-400 mt-1">Select a player to take off, then pick a bench replacement. Subs are single-use.</p>
                
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {/* On Field List */}
                  <div>
                    <span className="font-pixel text-[8px] text-yellow-300 block mb-2">On Field (Take Off)</span>
                    <div className="max-h-48 overflow-y-auto space-y-1 border border-white/10 p-2 bg-black/40 scroll">
                      {activeOnField.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSubOff(p.number)}
                          className={`w-full text-left p-1.5 text-xs rounded border ${subOff === p.number ? "border-yellow-300 bg-yellow-300/10 text-yellow-300" : "border-transparent text-white hover:bg-white/5"}`}
                        >
                          #{p.number} {p.name.slice(0, 18)} (STA {Math.round(p.stamina)})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bench List */}
                  <div>
                    <span className="font-pixel text-[8px] text-green-400 block mb-2">Bench (Bring On)</span>
                    <div className="max-h-48 overflow-y-auto space-y-1 border border-white/10 p-2 bg-black/40 scroll">
                      {benchPlayers.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSubOn(p.number)}
                          className={`w-full text-left p-1.5 text-xs rounded border ${subOn === p.number ? "border-green-400 bg-green-400/10 text-green-300" : "border-transparent text-white hover:bg-white/5"}`}
                        >
                          #{p.number} {p.name.slice(0, 18)} (OVR {p.rating})
                        </button>
                      ))}
                      {benchPlayers.length === 0 && (
                        <span className="text-xs text-slate-500 block p-2">No substitutions remaining.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex gap-3">
                  <Btn primary disabled={subOff === null || subOn === null} onClick={handleSub}>Make Substitution</Btn>
                  <Btn onClick={() => setMenuView("main")}>Cancel</Btn>
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
