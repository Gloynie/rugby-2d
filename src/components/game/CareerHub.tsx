"use client";

import { useEffect, useState } from "react";
import { getTeam, getCompetition, STADIUMS, getStadium, pickKits } from "@/game/data";
import { POSITION_NAMES } from "@/game/data";
import type { CareerState, CareerPlayer, CareerFixture } from "@/lib/career";
import type { SessionUser } from "@/lib/auth";
import { Btn, Crest, Kicker, Panel, PlayerSprite, ScreenHeader, Scroll } from "./ui";
import TrainingCenter from "./TrainingCenter";
import type { Screen } from "./GameShell";

export default function CareerHub({ careerId, go }: { careerId: number; go: (s: Screen) => void }) {
  const [state, setState] = useState<CareerState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "roster" | "talk" | "fixtures" | "training">("overview");

  const reload = async () => {
    const res = await fetch(`/api/careers/${careerId}`);
    const d = (await res.json()) as { state: CareerState };
    setState(d.state);
  };

  useEffect(() => { void reload(); }, [careerId]);

  const action = async (payload: any) => {
    setBusy(payload.action);
    setError(null);
    const res = await fetch(`/api/careers/${careerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError((d as { error?: string }).error ?? "Error"); return; }
    await reload();
    // If we just played a match (sim-match), stay on hub. The user can watch-live via go({name: "career-match", ...})
  };

  if (!state) return <p className="p-8 font-pixel text-sm text-slate-400">Loading…</p>;
  const team = getTeam(state.teamId);
  const comp = getCompetition(state.competitionId);
  const nextFixture = state.schedule.find((f) => f.user && !f.played && f.week === state.week);
  const nextFuture = state.schedule.find((f) => f.user && !f.played && f.week > state.week);
  const next = nextFixture ?? nextFuture;

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker={comp?.tagline ?? "Manager Career"}
        title={`${team.name} Manager`}
        right={
          <div className="flex gap-2">
            <Btn onClick={() => go({ name: "menu" })}>Back to menu</Btn>
          </div>
        }
      />
      <div className="mb-3 flex gap-2">
        {(["overview", "roster", "talk", "training", "fixtures"] as const).map((t) => (
          <Btn key={t} primary={tab === t} onClick={() => setTab(t)}>{t}</Btn>
        ))}
        <span className="ml-auto font-pixel self-center text-[9px] uppercase tracking-widest text-slate-400">
          Week {state.week} · Morale {Math.round(state.teamMorale)} · Coins {state.coins} · Rep {Math.round(state.managerReputation)}
        </span>
      </div>
      {error && <p className="mb-3 border-2 border-red-500/60 bg-red-950/60 px-4 py-2 text-red-200">{error}</p>}
      <Scroll className="pr-2">
        {tab === "overview" && <Overview state={state} next={next} onPlay={next ? () => go({ name: "career-match", id: careerId, fixtureId: next.id, mode: "manager" }) : undefined} busy={busy} />}
        {tab === "roster" && <Roster state={state} onAction={(id, t) => action({ action: "player-action", playerId: id, type: t })} busy={busy} />}
        {tab === "talk" && <Talk state={state} onTalk={(t) => action({ action: "team-talk", type: t })} busy={busy} />}
        {tab === "training" && state && (
          <TrainingCenter
            state={state}
            busy={busy !== null}
            onTrainPlayer={async (id, type) => action({ action: "train-player", playerId: id, type })}
            onTrainTeam={async (type) => action({ action: "train-team", type })}
          />
        )}
        {tab === "fixtures" && <Fixtures state={state} />}
      </Scroll>
    </div>
  );
}

function Overview({ state, next, onPlay, busy }: { state: CareerState; next?: CareerFixture; onPlay?: () => void; busy?: string | null }) {
  const team = getTeam(state.teamId);
  const comp = getCompetition(state.competitionId);
  const myStanding = state.standings.find((s) => s.teamId === state.teamId);
  const pos = state.standings.indexOf(myStanding!) + 1;
  const available = state.roster.filter((p) => p.injuredWeeks === 0 && p.fitness > 40);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel className="p-4 lg:col-span-2">
        <Kicker>Next fixture</Kicker>
        {next ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Crest team={getTeam(next.home)} size={36} />
              <span className="font-pixel text-sm">{next.home === state.teamId ? team.name : getTeam(next.home).name}</span>
              <span className="font-pixel text-xs text-slate-500">vs</span>
              <span className="font-pixel text-sm">{next.away === state.teamId ? team.name : getTeam(next.away).name}</span>
              <Crest team={getTeam(next.away)} size={36} />
              {next.knockout && <span className="font-pixel text-[9px] uppercase text-yellow-300">{next.knockout}</span>}
            </div>
            <span className="font-pixel text-xs text-slate-400">Week {next.week}</span>
          </div>
        ) : (
          <p className="mt-3 text-slate-400">All fixtures complete.</p>
        )}
        {onPlay && <Btn primary className="mt-4" onClick={onPlay} disabled={busy === "sim-match"}>Match day →</Btn>}
      </Panel>
      <Panel className="p-4">
        <Kicker>Your standing</Kicker>
        {myStanding ? (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div><p className="font-pixel text-2xl">{pos}</p><p className="text-xs text-slate-400">Pos</p></div>
            <div><p className="font-pixel text-2xl">{myStanding.pts}</p><p className="text-xs text-slate-400">Pts</p></div>
            <div><p className="font-pixel text-2xl">{myStanding.w}/{myStanding.p}</p><p className="text-xs text-slate-400">W/P</p></div>
            <div><p className="font-pixel text-2xl">{myStanding.pf}</p><p className="text-xs text-slate-400">For</p></div>
            <div><p className="font-pixel text-2xl">{myStanding.pa}</p><p className="text-xs text-slate-400">Agst</p></div>
            <div><p className="font-pixel text-2xl">{myStanding.bp}</p><p className="text-xs text-slate-400">BP</p></div>
          </div>
        ) : <p className="mt-3 text-slate-400">—</p>}
      </Panel>
      <Panel className="p-4">
        <Kicker>Injuries ({state.roster.filter((p) => p.injuredWeeks > 0).length})</Kicker>
        <ul className="mt-2 space-y-1">
          {state.roster.filter((p) => p.injuredWeeks > 0).map((p) => (
            <li key={p.id} className="flex justify-between text-sm">
              <span>{p.name}</span>
              <span className="text-red-300">{p.injuredWeeks}w</span>
            </li>
          ))}
          {state.roster.every((p) => p.injuredWeeks === 0) && <li className="text-slate-500">No injuries.</li>}
        </ul>
      </Panel>
      <Panel className="p-4 lg:col-span-2">
        <Kicker>Recent events</Kicker>
        <ul className="mt-2 space-y-1">
          {state.events.slice(0, 10).map((e, i) => (
            <li key={i} className="flex gap-3 border-l-2 border-yellow-400/40 pl-2 text-sm">
              <span className="font-pixel text-[8px] text-slate-500">W{e.week}</span>
              <span className={e.type === "injury" ? "text-red-300" : e.type === "result" ? "text-green-300" : "text-slate-200"}>{e.text}</span>
            </li>
          ))}
          {state.events.length === 0 && <li className="text-slate-500">No events yet.</li>}
        </ul>
      </Panel>
      <Panel className="p-4">
        <Kicker>Top form</Kicker>
        <ul className="mt-2 space-y-1">
          {[...state.roster].filter((p) => p.injuredWeeks === 0).sort((a, b) => b.form - a.form).slice(0, 5).map((p) => (
            <li key={p.id} className="flex justify-between text-sm">
              <span>{p.name}</span>
              <span className="text-green-300">{Math.round(p.form)}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel className="p-4 lg:col-span-3">
        <Kicker>{comp?.name}</Kicker>
        <table className="mt-2 w-full text-sm">
          <thead className="font-pixel text-[7px] uppercase text-slate-500">
            <tr><th className="px-2 py-1 text-left">#</th><th className="text-left">Team</th><th className="text-right">P</th><th className="text-right">W</th><th className="text-right">D</th><th className="text-right">L</th><th className="text-right">PF</th><th className="text-right">PA</th><th className="text-right">BP</th><th className="px-2 text-right">Pts</th></tr>
          </thead>
          <tbody>
            {state.standings.slice(0, 8).map((s, i) => {
              const t = getTeam(s.teamId);
              return (
                <tr key={s.teamId} className={s.teamId === state.teamId ? "bg-yellow-400/10" : ""}>
                  <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                  <td className="flex items-center gap-2"><Crest team={t} size={16} /> {t.short}</td>
                  <td className="text-right tabular-nums">{s.p}</td><td className="text-right tabular-nums">{s.w}</td><td className="text-right tabular-nums">{s.d}</td><td className="text-right tabular-nums">{s.l}</td>
                  <td className="text-right tabular-nums">{s.pf}</td><td className="text-right tabular-nums">{s.pa}</td><td className="text-right tabular-nums">{s.bp}</td>
                  <td className="px-2 text-right font-bold tabular-nums text-yellow-300">{s.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function Roster({ state, onAction, busy }: { state: CareerState; onAction: (id: number, t: "praise" | "criticise" | "rest") => void; busy?: string | null }) {
  const team = getTeam(state.teamId);
  return (
    <Panel className="p-4">
      <Kicker>Squad ({state.roster.length} players)</Kicker>
      <table className="mt-3 w-full text-sm">
        <thead className="font-pixel text-[7px] uppercase text-slate-500">
          <tr><th>#</th><th></th><th>Player</th><th>Pos</th><th className="text-right">OVR</th><th className="text-right">Form</th><th className="text-right">Fat</th><th className="text-right">Mor</th><th className="text-right">Fit</th><th>Status</th></tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {state.roster.map((p) => (
            <tr key={p.id} className={p.injuredWeeks > 0 ? "opacity-60" : ""}>
              <td className="py-1 text-slate-400">{p.number}</td>
              <td><PlayerSprite jersey={team.primary} jersey2={team.secondary} number={p.number} name={p.name} scale={2} view={p.number % 2 ? "back" : "front"} /></td>
              <td className="font-bold">{p.name}</td>
              <td className="text-slate-400">{POSITION_NAMES[p.number - 1]}</td>
              <td className="text-right tabular-nums">{p.rating}</td>
              <td className="text-right tabular-nums text-green-300">{Math.round(p.form)}</td>
              <td className="text-right tabular-nums text-orange-300">{Math.round(p.fatigue)}</td>
              <td className="text-right tabular-nums text-cyan-300">{Math.round(p.morale)}</td>
              <td className="text-right tabular-nums">{Math.round(p.fitness)}</td>
              <td>
                {p.injuredWeeks > 0 ? (
                  <span className="text-red-300">Injured {p.injuredWeeks}w</span>
                ) : (
                  <div className="flex gap-1">
                    <button onClick={() => onAction(p.id, "praise")} disabled={busy !== null} className="font-pixel border border-green-400/40 px-1 py-0.5 text-[7px] text-green-300 hover:bg-green-400/10">Praise</button>
                    <button onClick={() => onAction(p.id, "criticise")} disabled={busy !== null} className="font-pixel border border-red-400/40 px-1 py-0.5 text-[7px] text-red-300 hover:bg-red-400/10">Criticise</button>
                    <button onClick={() => onAction(p.id, "rest")} disabled={busy !== null} className="font-pixel border border-cyan-400/40 px-1 py-0.5 text-[7px] text-cyan-300 hover:bg-cyan-400/10">Rest</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function Talk({ state, onTalk, busy }: { state: CareerState; onTalk: (t: "motivate" | "relax" | "demand") => void; busy?: string | null }) {
  const options: { id: "motivate" | "relax" | "demand"; title: string; quote: string; effect: string }[] = [
    { id: "motivate", title: "Inspire the squad", quote: "We've worked hard all week. Trust the system. Every one of you belongs on that pitch.", effect: "Morale +, Form slight bump" },
    { id: "relax", title: "Keep it light", quote: "Shoulders down, lads. Enjoy it. Go out there and play your game.", effect: "Fatigue −, morale slight dip" },
    { id: "demand", title: "Raise standards", quote: "Not good enough. I expect more from every single one of you this week.", effect: "Form +, fatigue +, morale mixed" },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {options.map((o) => (
        <Panel key={o.id} className="p-5">
          <Kicker>Team talk</Kicker>
          <h3 className="mt-2 font-pixel text-sm uppercase">{o.title}</h3>
          <p className="mt-3 italic text-slate-300">"{o.quote}"</p>
          <p className="mt-2 text-xs text-slate-400">{o.effect}</p>
          <Btn primary className="mt-4 w-full" onClick={() => onTalk(o.id)} disabled={busy !== null}>Deliver talk</Btn>
        </Panel>
      ))}
      <Panel className="p-5 md:col-span-3">
        <Kicker>Press conference</Kicker>
        <p className="mt-2 text-slate-300">
          The media are asking about your team's chances. Your public stance shapes morale and reputation.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn onClick={() => onTalk("demand")} disabled={busy !== null}>We're favourites</Btn>
          <Btn onClick={() => onTalk("relax")} disabled={busy !== null}>Taking it one game at a time</Btn>
          <Btn onClick={() => onTalk("motivate")} disabled={busy !== null}>Back the squad</Btn>
        </div>
      </Panel>
    </div>
  );
}

function Fixtures({ state }: { state: CareerState }) {
  return (
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
  );
}
