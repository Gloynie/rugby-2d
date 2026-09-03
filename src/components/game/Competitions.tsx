"use client";

import { useEffect, useState } from "react";
import { COMPETITIONS, getCompetition, getStadium, getTeam } from "@/game/data";
import type { SessionUser } from "@/lib/auth";
import { nextUserFixture, tableFor, type Fixture, type TournamentState } from "@/lib/tournament";
import type { Screen } from "./GameShell";
import { Btn, Crest, Kicker, Panel, ScreenHeader, Scroll } from "./ui";

interface ActiveTournament {
  id: number;
  competitionId: string;
  teamId: string;
  status: string;
}

export default function CompetitionsScreen({ user, go }: { user: SessionUser | null; go: (s: Screen) => void }) {
  const [compId, setCompId] = useState(COMPETITIONS[0].id);
  const [active, setActive] = useState<ActiveTournament[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const comp = COMPETITIONS.find((c) => c.id === compId) ?? COMPETITIONS[0];
  const teams = comp.teamIds.map(getTeam).sort((a, b) => b.rating - a.rating);

  useEffect(() => {
    if (!user) return;
    fetch("/api/tournaments")
      .then((r) => r.json())
      .then((d: { tournaments: ActiveTournament[] }) => setActive(d.tournaments ?? []))
      .catch(() => {});
  }, [user]);

  const start = async (teamId: string) => {
    if (!user) {
      go({ name: "profile", mode: "login" });
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitionId: comp.id, teamId }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
    setBusy(false);
    if (!res.ok || !data.id) {
      setError(data.error ?? "Could not start the competition.");
      return;
    }
    go({ name: "hub", id: data.id });
  };

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker="Tournaments"
        title="Competitions"
        right={
          <div className="flex flex-wrap gap-2">
            {COMPETITIONS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCompId(c.id)}
                className="font-pixel border-2 border-black px-3 py-2 text-[8px] uppercase shadow-[3px_3px_0_#000]"
                style={compId === c.id ? { background: c.color, color: "#000" } : { background: "#1e293b", color: "#fff" }}
              >
                {c.short}
              </button>
            ))}
          </div>
        }
      />
      <Scroll className="pr-2">
        {active.length > 0 && (
          <section className="mb-4">
            <Kicker>Your competitions</Kicker>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {active.map((t) => {
                const c = getCompetition(t.competitionId);
                return (
                  <button key={t.id} onClick={() => go({ name: "hub", id: t.id })} className="tile flex items-center gap-3 p-3">
                    <Crest team={getTeam(t.teamId)} size={34} />
                    <div>
                      <p className="font-pixel text-[9px] uppercase" style={{ color: c?.color }}>{c?.name}</p>
                      <p className="text-slate-300">
                        as {getTeam(t.teamId).name} · <span className={t.status === "active" ? "text-green-400" : "text-slate-400"}>{t.status}</span>
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <Panel className="p-5" accent={comp.color}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <Kicker color={comp.color}>{comp.tagline}</Kicker>
              <h2 className="font-pixel mt-1 text-lg uppercase leading-relaxed md:text-xl">{comp.name}</h2>
              <p className="mt-2 text-slate-200">{comp.description}</p>
              <p className="font-pixel mt-2 text-[8px] uppercase tracking-widest text-slate-400">
                {comp.teamIds.length} teams ·{" "}
                {comp.format === "worldcup" ? "Pools + knockout" : comp.playoffTeams ? `League + top ${comp.playoffTeams} play-offs` : comp.doubleRound ? "Home & away league" : "Round-robin league"}
              </p>
            </div>
            <div className="border-2 border-white/10 bg-black/40 p-3 text-slate-300">
              <p className="font-pixel text-[9px] text-white">Enter the competition</p>
              <p className="mt-1 max-w-xs">Pick a team below. You play every one of your fixtures – the rest are simulated.</p>
              {!user && <p className="mt-1 text-yellow-300">Sign in required to save progress.</p>}
            </div>
          </div>
          {error && <p className="mt-3 border-2 border-red-500/60 bg-red-950/60 px-3 py-2 text-red-200">{error}</p>}
        </Panel>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
          {teams.map((t) => (
            <div key={t.id} className="tile flex items-center gap-3 p-3">
              <Crest team={t} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold leading-tight">{t.name}</p>
                <p className="truncate text-slate-400">{t.country} · OVR {t.rating} · {t.stadiumId ? getStadium(t.stadiumId).name.split(",")[0] : "Neutral"}</p>
              </div>
              <Btn primary disabled={busy} className="!px-3 !py-2 !text-[8px]" onClick={() => start(t.id)}>Enter</Btn>
            </div>
          ))}
        </div>
      </Scroll>
    </div>
  );
}

export function HubScreen({ id, go }: { id: number; go: (s: Screen) => void }) {
  const [state, setState] = useState<TournamentState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tournaments/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Could not load");
        return r.json() as Promise<{ state: TournamentState }>;
      })
      .then((d) => setState(d.state))
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const abandon = async () => {
    if (!confirm("Abandon this competition?")) return;
    await fetch(`/api/tournaments/${id}`, { method: "DELETE" });
    go({ name: "competitions" });
  };

  if (error) return <p className="border-2 border-red-500/60 bg-red-950/60 px-4 py-2 text-red-200">{error}</p>;
  if (!state) return <p className="font-pixel blink text-[10px] text-slate-300">LOADING...</p>;

  const comp = getCompetition(state.competitionId);
  const user = getTeam(state.userTeamId);
  const next = nextUserFixture(state);
  const groups: { name: string; ids: string[] }[] =
    state.format === "worldcup" && state.pools
      ? state.pools.map((p, i) => ({ name: `Pool ${String.fromCharCode(65 + i)}`, ids: p }))
      : [{ name: "Standings", ids: comp?.teamIds ?? [] }];

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker={comp?.tagline ?? "Competition"}
        title={comp?.name ?? "Competition"}
        right={
          <div className="flex gap-2">
            <Btn onClick={() => go({ name: "competitions" })}>All competitions</Btn>
            <Btn danger onClick={abandon}>Abandon</Btn>
          </div>
        }
      />
      <Scroll className="pr-2">
        <Panel className="p-5" accent={comp?.color}>
          {state.stage === "finished" ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Kicker>Competition complete</Kicker>
                <h2 className="font-pixel mt-1 text-lg uppercase leading-relaxed">
                  {state.champion === state.userTeamId ? "You are the champions!" : `${state.champion ? getTeam(state.champion).name : "—"} are champions`}
                </h2>
                <p className="text-slate-300">Your finish: <b className="text-white">{state.userPosition ?? "—"}</b></p>
              </div>
              <Btn primary onClick={() => go({ name: "competitions" })}>Start another</Btn>
            </div>
          ) : next ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Crest team={getTeam(next.fixture.home)} size={44} />
                <div>
                  <Kicker>Next up · {next.label}</Kicker>
                  <h2 className="font-pixel mt-1 text-sm uppercase leading-relaxed md:text-lg">
                    {getTeam(next.fixture.home).name} <span className="text-slate-500">v</span> {getTeam(next.fixture.away).name}
                  </h2>
                  <p className="text-slate-400">{next.fixture.home === state.userTeamId ? "Home match" : "Away match"} · playing as {user.name}</p>
                </div>
                <Crest team={getTeam(next.fixture.away)} size={44} />
              </div>
              <Btn primary className="!py-4 !text-xs" onClick={() => go({ name: "play", tournamentId: id })}>Play match →</Btn>
            </div>
          ) : (
            <div>
              <Kicker>Eliminated</Kicker>
              <h2 className="font-pixel mt-1 text-lg uppercase">{state.userPosition}</h2>
            </div>
          )}
          {state.userEliminated && state.stage !== "finished" && (
            <p className="mt-2 text-yellow-300">Your team has been eliminated – the rest of the competition has been simulated.</p>
          )}
        </Panel>

        {/* Current Round Fixtures */}
        {state.stage === "league" && state.rounds[state.currentRound] && (
          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <Kicker>Round {state.currentRound + 1} fixtures</Kicker>
              {state.rounds[state.currentRound].some((f) => f.user && f.played) && (
                <span className="font-pixel text-[8px] text-green-400">Other matches auto-simulated</span>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {state.rounds[state.currentRound].map((f) => {
                const home = getTeam(f.home);
                const away = getTeam(f.away);
                const isUser = f.user;
                return (
                  <div key={f.id} className={`flex items-center justify-between border-2 p-3 ${isUser ? "border-yellow-400/60 bg-yellow-400/5" : "border-white/10"}`}>
                    <div className="flex items-center gap-2">
                      <Crest team={home} size={28} />
                      <span className="font-pixel text-xs">{home.name}</span>
                    </div>
                    <div className="text-center">
                      {f.played ? (
                        <span className="font-pixel text-sm">{f.homeScore} - {f.awayScore}</span>
                      ) : (
                        <span className="font-pixel text-xs text-slate-500">vs</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-pixel text-xs">{away.name}</span>
                      <Crest team={away} size={28} />
                    </div>
                    {isUser && !f.played && (
                      <Btn primary className="ml-4 !px-3 !py-2 !text-[8px]" onClick={() => go({ name: "play", tournamentId: id })}>
                        Play
                      </Btn>
                    )}
                    {!isUser && !f.played && (
                      <span className="font-pixel text-[7px] text-slate-500 ml-4">Waiting</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {groups.map((g) => (
              <Panel key={g.name} className="overflow-hidden p-0">
                <h3 className="font-pixel border-b-2 border-white/10 px-4 py-2 text-[9px] uppercase tracking-widest text-slate-300">{g.name}</h3>
                <table className="w-full text-lg">
                  <thead className="font-pixel text-left text-[7px] uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-4 py-1">#</th><th>Team</th><th className="text-right">P</th><th className="text-right">W</th><th className="text-right">D</th><th className="text-right">L</th>
                      <th className="hidden text-right sm:table-cell">PF</th><th className="hidden text-right sm:table-cell">PA</th><th className="text-right">PD</th><th className="text-right">BP</th><th className="px-4 text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {tableFor(state, g.ids).map((r, i) => {
                      const q = state.format === "worldcup" ? i < 2 : comp?.playoffTeams ? i < comp.playoffTeams : i === 0;
                      return (
                        <tr key={r.teamId} className={r.teamId === state.userTeamId ? "bg-yellow-400/10" : ""}>
                          <td className="px-4 py-1 text-slate-400">{i + 1}{q && <span className="ml-1 text-green-400">•</span>}</td>
                          <td className="font-bold">{getTeam(r.teamId).name}</td>
                          <td className="text-right tabular-nums">{r.p}</td><td className="text-right tabular-nums">{r.w}</td><td className="text-right tabular-nums">{r.d}</td><td className="text-right tabular-nums">{r.l}</td>
                          <td className="hidden text-right tabular-nums sm:table-cell">{r.pf}</td><td className="hidden text-right tabular-nums sm:table-cell">{r.pa}</td>
                          <td className="text-right tabular-nums">{r.pd > 0 ? `+${r.pd}` : r.pd}</td><td className="text-right tabular-nums">{r.bp}</td>
                          <td className="px-4 text-right font-bold tabular-nums text-yellow-300">{r.pts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
            ))}
            {state.knockout.length > 0 && (
              <Panel className="p-4">
                <Kicker>Knockout stage</Kicker>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  {state.knockout.map((st) => (
                    <div key={st.name}>
                      <p className="font-pixel text-[8px] uppercase text-slate-400">{st.name}</p>
                      <ul className="mt-2 space-y-1">{st.fixtures.map((f) => <FixtureRow key={f.id} f={f} userTeamId={state.userTeamId} />)}</ul>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </div>
          <div className="space-y-4">
            <Panel className="p-4">
              <Kicker>Headlines</Kicker>
              <ul className="mt-2 space-y-1.5 text-slate-200">
                {[...state.log].reverse().map((l, i) => <li key={i} className="border-l-4 border-yellow-400/70 pl-2">{l}</li>)}
              </ul>
            </Panel>
            <Panel className="p-4">
              <Kicker>Your fixtures</Kicker>
              <ul className="mt-2 space-y-1.5">
                {state.rounds.map((round, ri) =>
                  round.filter((f) => f.user).map((f) => (
                    <li key={f.id}>
                      <p className="font-pixel text-[7px] uppercase text-slate-500">Round {ri + 1}</p>
                      <FixtureRow f={f} userTeamId={state.userTeamId} />
                    </li>
                  )),
                )}
              </ul>
            </Panel>
          </div>
        </div>
      </Scroll>
    </div>
  );
}

function FixtureRow({ f, userTeamId }: { f: Fixture; userTeamId: string }) {
  const h = getTeam(f.home);
  const a = getTeam(f.away);
  const cls = (tid: string) => `font-pixel text-[9px] ${tid === userTeamId ? "text-yellow-300" : "text-white"}`;
  return (
    <div className="flex items-center justify-between border-2 border-white/10 bg-black/40 px-3 py-1.5">
      <span className={cls(h.id)}>{h.short}</span>
      <span className="text-slate-200">{f.played ? `${f.homeScore} – ${f.awayScore}` : "v"}</span>
      <span className={cls(a.id)}>{a.short}</span>
      {f.note && <span className="ml-2 text-sm uppercase text-slate-500">{f.note}</span>}
    </div>
  );
}
