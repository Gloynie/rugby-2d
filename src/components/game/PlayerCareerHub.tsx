"use client";

import { useEffect, useState } from "react";
import { getTeam, getCompetition, POSITION_NAMES } from "@/game/data";
import { getAttrUpgradeCost, calculateOVR, type PlayerCareerState, type PlayerAttributes, ATTR_LIMIT } from "@/lib/player-career";
import { Btn, Crest, Kicker, Panel, PlayerSprite, ScreenHeader, Scroll } from "./ui";
import type { Screen } from "./GameShell";

export default function PlayerCareerHub({ id, go }: { id: number; go: (s: Screen) => void }) {
  const [state, setState] = useState<PlayerCareerState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "attributes" | "standings" | "fixtures">("overview");

  const reload = async () => {
    const res = await fetch(`/api/player-careers/${id}`);
    const d = (await res.json()) as { state: PlayerCareerState };
    setState(d.state);
  };

  useEffect(() => { void reload(); }, [id]);

  const upgrade = async (attr: keyof PlayerAttributes) => {
    setBusy(attr);
    setError(null);
    const res = await fetch(`/api/player-careers/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upgrade", attribute: attr }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError((d as { error?: string }).error ?? "Error upgrading attribute."); return; }
    await reload();
  };

  const abandon = async () => {
    if (!confirm("Abandon this Player Career?")) return;
    await fetch(`/api/player-careers/${id}`, { method: "DELETE" });
    go({ name: "menu" });
  };

  if (!state) return <p className="p-8 font-pixel text-sm text-slate-400">Loading…</p>;

  const team = getTeam(state.teamId);
  const comp = getCompetition(state.competitionId);
  const next = state.schedule.find((f) => f.user && !f.played && f.week === state.week);
  const nextFuture = state.schedule.find((f) => f.user && !f.played && f.week > state.week);
  const current = next ?? nextFuture;

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker={`${comp?.name ?? "Player Career"} · Active`}
        title={`Be A Pro: ${state.playerName}`}
        right={
          <div className="flex gap-2">
            <Btn onClick={() => go({ name: "menu" })}>Main Menu</Btn>
            <Btn danger onClick={abandon}>Abandon</Btn>
          </div>
        }
      />

      <div className="mb-3 flex gap-2">
        {(["overview", "attributes", "standings", "fixtures"] as const).map((t) => (
          <Btn key={t} primary={tab === t} onClick={() => setTab(t)}>{t}</Btn>
        ))}
        <span className="ml-auto font-pixel self-center text-[9px] uppercase tracking-widest text-slate-400">
          Week {state.week} · OVR {state.rating} · XP {state.xp} · {POSITION_NAMES[state.position - 1].toUpperCase()}
        </span>
      </div>

      {error && <p className="mb-3 border-2 border-red-500/60 bg-red-950/60 px-4 py-2 text-red-200">{error}</p>}

      <Scroll className="pr-2">
        {tab === "overview" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel className="p-4 lg:col-span-2">
              <Kicker>Next Fixture</Kicker>
              {current ? (
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Crest team={getTeam(current.home)} size={44} />
                    <span className="font-pixel text-sm uppercase">{getTeam(current.home).name}</span>
                  </div>
                  <span className="font-pixel text-xs text-slate-400">VS</span>
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <Crest team={getTeam(current.away)} size={44} />
                    <span className="font-pixel text-sm uppercase text-right">{getTeam(current.away).name}</span>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-slate-400">All season fixtures completed.</p>
              )}
              {current && (
                <Btn primary className="mt-6 w-full !py-4" onClick={() => go({ name: "career-match", id, fixtureId: current.id, mode: "player" })}>
                  PLAY FIXTURE (PLAYER LOCK) →
                </Btn>
              )}
            </Panel>

            <Panel className="p-4">
              <Kicker>Pro Profile</Kicker>
              <div className="mt-3 flex items-center gap-4">
                <PlayerSprite jersey={team.primary} jersey2={team.secondary} number={state.position} name={state.playerName} scale={3} view="front" />
                <div>
                  <h3 className="font-pixel text-sm uppercase leading-relaxed text-yellow-300">{state.playerName}</h3>
                  <p className="text-slate-300">OVR Rating: {state.rating}</p>
                  <p className="text-slate-400">{POSITION_NAMES[state.position - 1]}</p>
                  <p className="text-slate-500">{team.name}</p>
                </div>
              </div>
            </Panel>

            <Panel className="p-4">
              <Kicker>Career Statistics</Kicker>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
                <div className="border border-white/10 p-2"><p className="font-pixel text-lg text-yellow-300">{state.history.played}</p><p className="text-xs text-slate-400">Games</p></div>
                <div className="border border-white/10 p-2"><p className="font-pixel text-lg text-yellow-300">{state.history.tries}</p><p className="text-xs text-slate-400">Tries</p></div>
                <div className="border border-white/10 p-2"><p className="font-pixel text-lg text-yellow-300">{state.history.tackles}</p><p className="text-xs text-slate-400">Tackles</p></div>
                <div className="border border-white/10 p-2"><p className="font-pixel text-lg text-yellow-300">{state.history.passes}</p><p className="text-xs text-slate-400">Passes</p></div>
                <div className="border border-white/10 p-2 col-span-2"><p className="font-pixel text-lg text-green-300">{state.history.ratingAverage.toFixed(1)}</p><p className="text-xs text-slate-400">Average Match Rating</p></div>
              </div>
            </Panel>

            <Panel className="p-4 lg:col-span-2">
              <Kicker>Career Timeline</Kicker>
              <ul className="mt-2 space-y-1">
                {state.log.map((l, idx) => (
                  <li key={idx} className="border-l-4 border-yellow-400/40 pl-3 text-sm text-slate-300 leading-relaxed">
                    {l}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        )}

        {tab === "attributes" && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(Object.keys(state.attributes) as (keyof PlayerAttributes)[]).map((attr) => {
              const currentVal = state.attributes[attr];
              const cost = getAttrUpgradeCost(currentVal);
              const canAfford = state.xp >= cost && currentVal < ATTR_LIMIT;
              return (
                <Panel key={attr} className="p-4">
                  <Kicker>{attr}</Kicker>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-pixel text-lg text-yellow-300">{currentVal}</span>
                    <span className="text-xs text-slate-400">Limit {ATTR_LIMIT}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-4 w-full bg-slate-900 border-2 border-slate-700 relative overflow-hidden">
                    <div className="h-full bg-yellow-400" style={{ width: `${(currentVal / ATTR_LIMIT) * 100}%` }} />
                  </div>
                  {currentVal < ATTR_LIMIT ? (
                    <Btn
                      primary={canAfford}
                      disabled={!canAfford || busy !== null}
                      onClick={() => upgrade(attr)}
                      className="mt-3 w-full !text-[9px]"
                    >
                      Upgrade · {cost} XP
                    </Btn>
                  ) : (
                    <span className="font-pixel text-[8px] text-green-400 text-center block mt-4 uppercase">MAX LIMIT REACHED</span>
                  )}
                </Panel>
              );
            })}
          </div>
        )}

        {tab === "standings" && (
          <Panel className="p-0 overflow-hidden">
            <h3 className="font-pixel border-b-2 border-white/10 px-4 py-2 text-[9px] uppercase tracking-widest text-slate-300">Standings</h3>
            <table className="w-full text-lg">
              <thead className="font-pixel text-[7px] uppercase text-slate-500">
                <tr><th className="px-4 py-1 text-left">#</th><th className="text-left">Team</th><th className="text-right">P</th><th className="text-right">W</th><th className="text-right">D</th><th className="text-right">L</th><th className="text-right">PF</th><th className="text-right">PA</th><th className="text-right">BP</th><th className="px-4 text-right">Pts</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {state.standings.map((s, idx) => (
                  <tr key={s.teamId} className={s.teamId === state.teamId ? "bg-yellow-400/10" : ""}>
                    <td className="px-4 py-1 text-slate-400">{idx + 1}</td>
                    <td className="font-bold">{getTeam(s.teamId).name} {s.teamId === state.teamId && <span className="font-pixel text-[8px] text-yellow-300 ml-1">YOURS</span>}</td>
                    <td className="text-right tabular-nums">{s.p}</td><td className="text-right tabular-nums">{s.w}</td><td className="text-right tabular-nums">{s.d}</td><td className="text-right tabular-nums">{s.l}</td>
                    <td className="text-right tabular-nums">{s.pf}</td><td className="text-right tabular-nums">{s.pa}</td><td className="text-right tabular-nums">{s.bp}</td>
                    <td className="px-4 text-right font-bold tabular-nums text-yellow-300">{s.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {tab === "fixtures" && (
          <Panel className="p-4">
            <Kicker>All fixtures</Kicker>
            <table className="mt-3 w-full text-sm">
              <thead className="font-pixel text-[7px] uppercase text-slate-500">
                <tr><th>Wk</th><th>Home</th><th></th><th>Away</th><th className="text-right">Score</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {state.schedule.map((f) => {
                  const homeValid = f.home !== "TBD";
                  const awayValid = f.away !== "TBD";
                  const home = homeValid ? getTeam(f.home) : null;
                  const away = awayValid ? getTeam(f.away) : null;
                  const userTeam = f.home === state.teamId || f.away === state.teamId;
                  return (
                    <tr key={f.id} className={userTeam ? "bg-yellow-400/10" : ""}>
                      <td className="py-1 text-slate-400">{f.week}</td>
                      <td className="flex items-center gap-2">
                        {home ? <><Crest team={home} size={18} /> {home.short}</> : <span className="text-slate-500">TBD</span>}
                      </td>
                      <td className="text-center text-slate-500">vs</td>
                      <td className="flex items-center gap-2">
                        {away ? <><Crest team={away} size={18} /> {away.short}</> : <span className="text-slate-500">TBD</span>}
                      </td>
                      <td className="text-right tabular-nums">{f.played ? `${f.homeScore} - ${f.awayScore}` : "—"}</td>
                      <td className="text-right text-[9px] uppercase text-slate-400">
                        {f.knockout ?? (userTeam ? "Yours" : "")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        )}
      </Scroll>
    </div>
  );
}
