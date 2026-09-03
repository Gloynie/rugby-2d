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
  const [showControls, setShowControls] = useState(false);
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
      },
    });
    rtRef.current = rt;
    void rt.start();
    return () => {
      rt.stop();
      // Stop menu music if it was playing
      import("@/game/audio").then((a) => a.stopMenuMusic());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resume = () => {
    rtRef.current?.setPaused(false);
    setPaused(false);
    setShowControls(false);
  };

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
          <Panel className="w-[520px] max-w-[95vw] p-7 slide-in">
            <Kicker>Paused</Kicker>
            <h2 className="font-pixel mt-2 text-xl uppercase">Match menu</h2>
            {!showControls ? (
              <div className="mt-6 grid gap-3">
                <Btn primary onClick={resume}>Resume match</Btn>
                <Btn onClick={() => setShowControls(true)}>View controls</Btn>
                <Btn danger onClick={onQuit}>Quit to menu</Btn>
                <p className="mt-2 text-slate-400">
                  Press <Kbd>{keyLabel(bindings.pause)}</Kbd> to resume · <Kbd>{keyLabel(bindings.help)}</Kbd> toggles the on-screen help
                </p>
              </div>
            ) : (
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
                <Btn className="mt-4" onClick={() => setShowControls(false)}>Back</Btn>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
