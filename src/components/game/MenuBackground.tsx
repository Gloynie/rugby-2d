"use client";

import { useEffect, useRef } from "react";
import { COMPETITIONS, STADIUMS, getStadium, getTeam, pickKits } from "@/game/data";
import { GameRuntime } from "@/game/runtime";
import { VIEW_H, VIEW_W } from "@/game/render";
import { DEFAULT_BINDINGS } from "@/game/controls";
import * as audio from "@/game/audio";

function randomFixture() {
  const comp = COMPETITIONS[Math.floor(Math.random() * COMPETITIONS.length)];
  const ids = [...comp.teamIds].sort(() => Math.random() - 0.5);
  const home = getTeam(ids[0]);
  const away = getTeam(ids[1]);
  const stadium = Math.random() < 0.6 && home.stadiumId ? getStadium(home.stadiumId) : STADIUMS[Math.floor(Math.random() * STADIUMS.length)];
  return { comp, home, away, stadium };
}

/** Attract mode: an AI-vs-AI match with cinematic stadium fly-overs behind the menus. */
export default function MenuBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    // Start menu music on first user interaction
    const startMusic = () => {
      audio.startMenuMusic();
      window.removeEventListener("click", startMusic);
      window.removeEventListener("keydown", startMusic);
    };
    window.addEventListener("click", startMusic);
    window.addEventListener("keydown", startMusic);
    return () => {
      window.removeEventListener("click", startMusic);
      window.removeEventListener("keydown", startMusic);
      audio.stopMenuMusic();
    };
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let rt: GameRuntime | null = null;
    let disposed = false;
    let timer = 0;
    const startMatch = () => {
      if (disposed) return;
      rt?.stop();
      const { comp, home, away, stadium } = randomFixture();
      const kits = pickKits(home, away);
      rt = new GameRuntime({
        canvas,
        config: { home, away, userTeam: null, halfSeconds: 45, difficulty: "normal", homeColor: kits.home, awayColor: kits.away },
        stadium,
        bindings: DEFAULT_BINDINGS,
        competition: comp.name,
        attract: true,
        onFinish: () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(startMatch, 400);
        },
      });
      void rt.start();
      window.clearTimeout(timer);
      timer = window.setTimeout(startMatch, 150000);
    };
    startMatch();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      rt?.stop();
    };
  }, []);
  return <canvas ref={ref} width={VIEW_W} height={VIEW_H} className="pixelated absolute inset-0 h-full w-full object-cover opacity-90" />;
}
