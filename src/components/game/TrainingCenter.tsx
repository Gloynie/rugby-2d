"use client";

import { useState } from "react";
import { getTeam } from "@/game/data";
import type { CareerState } from "@/lib/career";
import { Btn, Kicker, Panel, PlayerSprite } from "./ui";

interface Props {
  state: CareerState;
  onTrainPlayer: (playerId: number, type: "fitness" | "skills" | "strength") => Promise<void>;
  onTrainTeam: (type: "bonding" | "tactics" | "intense") => Promise<void>;
  busy: boolean;
}

export default function TrainingCenter({ state, onTrainPlayer, onTrainTeam, busy }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const team = getTeam(state.teamId);
  const kits = { home: team.primary, away: team.secondary };
  const selectedPlayer = selected !== null ? state.roster.find((p) => p.id === selected) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel className="p-4 lg:col-span-2">
        <div className="flex items-center justify-between">
          <Kicker>Player Training</Kicker>
          <div className="flex items-center gap-2">
            <span className="font-pixel text-yellow-300">{state.coins}</span>
            <span className="text-slate-400">coins</span>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-300">Pick a player and choose their training focus. Costs coins and develops their profile.</p>
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
          {state.roster.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              disabled={busy}
              className={`tile p-2 disabled:opacity-40 ${selected === p.id ? "small-selected" : ""}`}
            >
              <PlayerSprite jersey={kits.home} jersey2={kits.away} number={p.number} name={p.name} scale={1.5} />
              <p className="truncate text-center text-[9px]">{p.name.split(" ").slice(-1)[0]}</p>
              <p className="text-center text-[8px] text-slate-400">OVR {p.rating}</p>
            </button>
          ))}
        </div>
        {selectedPlayer && (
          <div className="mt-4 rounded border-2 border-yellow-400/40 bg-yellow-400/5 p-4">
            <div className="flex items-center gap-4">
              <PlayerSprite jersey={kits.home} jersey2={kits.away} number={selectedPlayer.number} name={selectedPlayer.name} scale={3} />
              <div className="flex-1">
                <p className="font-pixel text-sm">{selectedPlayer.name}</p>
                <p className="text-sm text-slate-400">OVR {selectedPlayer.rating} · Fitness {Math.round(selectedPlayer.fitness)}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Btn primary disabled={busy || state.coins < 60} onClick={() => onTrainPlayer(selectedPlayer.id, "fitness")}>
                Fitness · 60
              </Btn>
              <Btn primary disabled={busy || state.coins < 100} onClick={() => onTrainPlayer(selectedPlayer.id, "skills")}>
                Skills · 100
              </Btn>
              <Btn primary disabled={busy || state.coins < 80} onClick={() => onTrainPlayer(selectedPlayer.id, "strength")}>
                Strength · 80
              </Btn>
            </div>
          </div>
        )}
      </Panel>
      <Panel className="p-4">
        <Kicker>Team Training</Kicker>
        <p className="mt-2 text-sm text-slate-300">Run sessions for the whole squad.</p>
        <div className="mt-3 grid gap-2">
          <button
            onClick={() => onTrainTeam("bonding")}
            disabled={busy || state.coins < 120}
            className="tile p-3 text-left disabled:opacity-40"
          >
            <p className="font-pixel text-xs">Team Bonding</p>
            <p className="text-sm text-slate-400">Morale +15 · All players +8 morale</p>
            <p className="mt-1 text-xs text-yellow-300">120 coins</p>
          </button>
          <button
            onClick={() => onTrainTeam("tactics")}
            disabled={busy || state.coins < 150}
            className="tile p-3 text-left disabled:opacity-40"
          >
            <p className="font-pixel text-xs">Tactics Session</p>
            <p className="text-sm text-slate-400">All players +4 form</p>
            <p className="mt-1 text-xs text-yellow-300">150 coins</p>
          </button>
          <button
            onClick={() => onTrainTeam("intense")}
            disabled={busy || state.coins < 180}
            className="tile p-3 text-left disabled:opacity-40"
          >
            <p className="font-pixel text-xs">Intense Training</p>
            <p className="text-sm text-slate-400">All players +1 OVR</p>
            <p className="mt-1 text-xs text-yellow-300">180 coins</p>
          </button>
        </div>
      </Panel>
    </div>
  );
}
