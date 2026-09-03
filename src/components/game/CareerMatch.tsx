"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STADIUMS, getStadium, getTeam, pickKits } from "@/game/data";
import type { CareerState } from "@/lib/career";
import type { MatchResult } from "@/game/types";
import type { Bindings } from "@/game/controls";
import type { Screen } from "./GameShell";
import { Btn, Crest, Kicker, Panel, PlayerSprite, ScreenHeader } from "./ui";
import MatchView from "./MatchView";

export default function CareerMatch({ careerId, fixtureId, bindings, go }: { careerId: number; fixtureId: string; bindings: Bindings; go: (s: Screen) => void }) {
  const [state, setState] = useState<CareerState | null>(null);
  const [lineup, setLineup] = useState<number[]>([]);
  const [stage, setStage] = useState<"preview" | "live" | "result">("preview");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const matchNoRef = useRef(0);

  useEffect(() => {
    fetch(`/api/careers/${careerId}`).then((r) => r.json()).then((d: { state: CareerState }) => {
      setState(d.state);
      // Auto-pick best 15 by form+fitness (injured excluded)
      const available = d.state.roster.filter((p) => p.injuredWeeks === 0 && p.fitness > 40);
      const sorted = [...available].sort((a, b) => (b.form + b.fitness * 0.5) - (a.form + a.fitness * 0.5));
      setLineup(sorted.slice(0, 15).map((p) => p.id));
    });
  }, [careerId]);

  const fixture = useMemo(() => state?.schedule.find((f) => f.id === fixtureId), [state, fixtureId]);
  const team = state ? getTeam(state.teamId) : null;
  const opponent = fixture && state ? getTeam(fixture.home === state.teamId ? fixture.away : fixture.home) : null;

  const simMatch = async () => {
    setSimBusy(true);
    const res = await fetch(`/api/careers/${careerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sim-match", fixtureId }),
    });
    const d = await res.json();
    setSimBusy(false);
    setResult({ homeScore: d.state.lastResult?.homeScore ?? 0, awayScore: d.state.lastResult?.awayScore ?? 0, homeTries: 0, awayTries: 0, events: d.state.lastResult?.events ?? [] });
    setState(d.state);
    setStage("result");
  };

  const onFinish = async (r: MatchResult) => {
    const userTeam: 0 | 1 = fixture!.home === state!.teamId ? 0 : 1;
    await fetch(`/api/careers/${careerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "match", fixtureId, homeScore: r.homeScore, awayScore: r.awayScore, homeTries: r.homeTries, awayTries: r.awayTries, userTeam, events: r.events }),
    });
    await fetch(`/api/careers/${careerId}`).then((r) => r.json()).then((d: { state: CareerState }) => setState(d.state));
    setResult(r);
    setStage("result");
  };

  if (!state || !fixture || !team || !opponent) return <p className="p-8 font-pixel text-sm text-slate-400">Loading…</p>;

  const homeTeam = getTeam(fixture.home);
  const awayTeam = getTeam(fixture.away);
  const kits = pickKits(homeTeam, awayTeam);
  const stadium = getStadium(homeTeam.stadiumId ?? STADIUMS[0].id);
  const userTeam: 0 | 1 = fixture.home === state.teamId ? 0 : 1;

  if (stage === "live") {
    return (
      <div className="fixed inset-0 z-40 bg-black">
        <MatchView
          key={`${fixture.id}-${matchNoRef.current}`}
          config={{
            home: homeTeam, away: awayTeam, userTeam: null, halfSeconds: 120, difficulty: "normal",
            homeColor: kits.home, awayColor: kits.away,
            competition: "Manager Career",
            stadiumId: stadium.id,
          }}
          stadium={stadium}
          competition="Manager Career"
          bindings={bindings}
          onFinish={onFinish}
          onQuit={() => go({ name: "career-hub", id: careerId })}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker={fixture.knockout ?? `Week ${fixture.week}`}
        title="Match day"
        right={<Btn onClick={() => go({ name: "career-hub", id: careerId })}>Back</Btn>}
      />
      <Panel className="mb-4 flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <Crest team={homeTeam} size={44} />
          <div>
            <p className="font-pixel text-sm uppercase">{homeTeam.name}</p>
            <p className="text-slate-400">Home · OVR {homeTeam.rating}</p>
          </div>
        </div>
        <div className="text-center">
          <p className="font-pixel text-xs text-slate-400">{stadium.name}</p>
          <p className="font-pixel text-2xl text-yellow-300">VS</p>
        </div>
        <div className="flex items-center gap-3 flex-row-reverse">
          <Crest team={awayTeam} size={44} />
          <div className="text-right">
            <p className="font-pixel text-sm uppercase">{awayTeam.name}</p>
            <p className="text-slate-400">Away · OVR {awayTeam.rating}</p>
          </div>
        </div>
      </Panel>

      {stage === "preview" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel className="p-4 lg:col-span-2">
            <Kicker>Your starting XV</Kicker>
            <div className="mt-2 flex flex-wrap gap-2">
              {team.players.map((name, i) => {
                const p = state.roster.find((r) => r.id === i)!;
                const inLineup = lineup.includes(i);
                const disabled = !inLineup && lineup.length >= 15;
                const injured = p.injuredWeeks > 0;
                return (
                  <button
                    key={i}
                    disabled={injured || (disabled && !inLineup)}
                    onClick={() => setLineup((L) => inLineup ? L.filter((x) => x !== i) : [...L, i])}
                    className={`tile p-2 text-left disabled:opacity-40 ${inLineup ? "small-selected" : ""}`}
                  >
                    <PlayerSprite jersey={team.primary} jersey2={team.secondary} number={i + 1} name={p.name} scale={2} />
                    <p className="truncate font-pixel text-[8px] uppercase">{p.name}</p>
                    <p className="text-[10px] text-slate-400">
                      Form {Math.round(p.form)} · Fat {Math.round(p.fatigue)}
                      {injured && <span className="ml-1 text-red-300">Inj {p.injuredWeeks}w</span>}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-400">{lineup.length} / 15 selected</p>
          </Panel>
          <Panel className="flex flex-col gap-3 p-4">
            <Kicker>Match options</Kicker>
            <p className="text-sm text-slate-300">
              You're managing {team.name}. Step onto the pitch yourself — or let your AI squad play it out and check the result.
            </p>
            <Btn primary className="!py-4" onClick={() => { matchNoRef.current++; setStage("live"); }} disabled={lineup.length < 15}>
              Watch live →
            </Btn>
            <Btn onClick={simMatch} disabled={simBusy || lineup.length < 15}>
              {simBusy ? "Simulating..." : "Quick sim"}
            </Btn>
            <p className="text-[10px] text-slate-500">Tip: Quick sim runs the full match in seconds using your squad's form & fitness.</p>
          </Panel>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel className="p-4 lg:col-span-2">
            <Kicker>Full time</Kicker>
            <div className="mt-3 flex items-center justify-between">
              <Crest team={homeTeam} size={44} />
              <p className="font-pixel text-4xl tabular-nums text-yellow-300">{result?.homeScore} - {result?.awayScore}</p>
              <Crest team={awayTeam} size={44} />
            </div>
            <p className="mt-2 text-slate-400">Tries {result?.homeTries} - {result?.awayTries}</p>
            <ul className="mt-4 max-h-40 space-y-1 overflow-auto text-sm">
              {result?.events.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-8 text-slate-500">{e.minute}&apos;</span>
                  <span className="font-pixel text-[8px]" style={{ color: e.team === 0 ? kits.home : kits.away }}>{e.team === 0 ? homeTeam.short : awayTeam.short}</span>
                  <span className="capitalize">{e.type === "dropgoal" ? "Drop goal" : e.type}</span>
                  <span className="text-slate-400">{e.player}</span>
                </li>
              ))}
              {(!result?.events || result.events.length === 0) && <li className="text-slate-500">No scoring events.</li>}
            </ul>
          </Panel>
          <Panel className="flex flex-col gap-3 p-4">
            <Kicker>Continue</Kicker>
            {state.schedule.filter((f) => f.user && !f.played).length > 0 ? (
              <>
                <Btn primary onClick={() => {
                  const nxt = state.schedule.find((f) => f.user && !f.played);
                  if (nxt) go({ name: "career-match", id: careerId, fixtureId: nxt.id });
                }}>Next match →</Btn>
                <Btn onClick={async () => {
                  await fetch(`/api/careers/${careerId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "advance" }) });
                  await fetch(`/api/careers/${careerId}`).then((r) => r.json()).then((d: { state: CareerState }) => setState(d.state));
                  go({ name: "career-hub", id: careerId });
                }}>Advance week</Btn>
              </>
            ) : (
              <Btn primary onClick={() => go({ name: "career-hub", id: careerId })}>View final standings</Btn>
            )}
            <Btn onClick={() => go({ name: "career-hub", id: careerId })}>Back to hub</Btn>
          </Panel>
        </div>
      )}
    </div>
  );
}
