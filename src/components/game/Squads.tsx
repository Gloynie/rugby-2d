"use client";

import { useState } from "react";
import { COMPETITIONS, POSITION_NAMES, TEAMS, getCompetition, getStadium, getTeam } from "@/game/data";
import { buildAttributes } from "@/game/engine";
import type { Pose } from "@/game/sprites";
import { Btn, Crest, Kicker, Panel, PlayerSprite, ScreenHeader, Scroll } from "./ui";

const POSES: Pose[] = ["idle", "run", "pass", "kick", "celebrate"];

export default function SquadsScreen() {
  const [filter, setFilter] = useState("all");
  const [teamId, setTeamId] = useState("rsa");
  const [pose, setPose] = useState<Pose>("idle");
  const teams = filter === "all" ? TEAMS : (getCompetition(filter)?.teamIds.map(getTeam) ?? TEAMS);
  const team = getTeam(teamId);

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker="Teams & players"
        title="Squads"
        right={
          <div className="flex flex-wrap gap-2">
            {[{ id: "all", short: "All" }, ...COMPETITIONS].map((c) => (
              <Btn key={c.id} primary={filter === c.id} className="!py-2 !text-[8px]" onClick={() => setFilter(c.id)}>{c.short}</Btn>
            ))}
          </div>
        }
      />
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
        <Scroll className="pr-2">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {teams.map((t) => (
              <button key={t.id} onClick={() => setTeamId(t.id)} className={`tile flex items-center gap-3 p-2 ${t.id === teamId ? "small-selected" : ""}`}>
                <Crest team={t} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold leading-tight">{t.name}</p>
                  <p className="truncate text-slate-400">{t.country}</p>
                </div>
                <span className="font-pixel text-[9px] text-yellow-300">{t.rating}</span>
              </button>
            ))}
          </div>
        </Scroll>
        <Panel className="flex min-h-0 flex-col p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-4">
            <Crest team={team} size={52} />
            <div className="flex-1">
              <Kicker>Starting XV · OVR {team.rating}</Kicker>
              <h2 className="font-pixel text-lg uppercase leading-relaxed">{team.name}</h2>
              <p className="text-slate-400">{team.country} · {team.stadiumId ? getStadium(team.stadiumId).name : "Neutral venues"}</p>
            </div>
            <div className="flex gap-1">
              {POSES.map((p) => (
                <Btn key={p} primary={pose === p} className="!px-2 !py-2 !text-[7px]" onClick={() => setPose(p)}>{p}</Btn>
              ))}
            </div>
          </div>
          <Scroll className="mt-3 pr-2">
            <table className="w-full text-lg">
              <thead className="font-pixel text-left text-[7px] uppercase tracking-widest text-slate-500">
                <tr><th className="py-1">#</th><th></th><th>Player</th><th>Position</th><th className="text-right">SPD</th><th className="text-right">STR</th><th className="text-right">TCK</th><th className="text-right">HND</th><th className="text-right">KCK</th><th className="text-right">EVA</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {team.players.map((name, i) => {
                  const a = buildAttributes(i + 1, name, team.rating);
                  return (
                    <tr key={i}>
                      <td className="py-0.5 text-slate-400">{i + 1}</td>
                      <td className="w-14">
                        <PlayerSprite jersey={team.primary} jersey2={team.secondary} number={i + 1} name={name} scale={2} view={pose === "run" ? "side" : i % 3 === 1 ? "back" : "front"} pose={pose} />
                      </td>
                      <td className="font-bold">{name}</td>
                      <td className="text-slate-400">{POSITION_NAMES[i]}</td>
                      <td className="text-right tabular-nums">{Math.round(((a.speed - 5) / 3.6) * 99)}</td>
                      <td className="text-right tabular-nums">{Math.round(a.strength)}</td>
                      <td className="text-right tabular-nums">{Math.round(a.tackling)}</td>
                      <td className="text-right tabular-nums">{Math.round(a.handling)}</td>
                      <td className="text-right tabular-nums">{Math.round(a.kicking)}</td>
                      <td className="text-right tabular-nums">{Math.round(a.evasion)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Scroll>
        </Panel>
      </div>
    </div>
  );
}
