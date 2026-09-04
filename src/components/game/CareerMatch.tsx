"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STADIUMS, getStadium, getTeam, pickKits } from "@/game/data";
import type { CareerState } from "@/lib/career";
import type { PlayerCareerState } from "@/lib/player-career";
import type { MatchResult } from "@/game/types";
import type { Bindings } from "@/game/controls";
import type { Screen } from "./GameShell";
import { Btn, Crest, Kicker, Panel, PlayerSprite, ScreenHeader } from "./ui";
import MatchView from "./MatchView";
import { GameRuntime } from "@/game/runtime";

interface Props {
  careerId: number;
  fixtureId: string;
  mode: "manager" | "player";
  bindings: Bindings;
  go: (s: Screen) => void;
}

export default function CareerMatch({ careerId, fixtureId, mode, bindings, go }: Props) {
  const [managerState, setManagerState] = useState<CareerState | null>(null);
  const [playerState, setPlayerState] = useState<PlayerCareerState | null>(null);
  
  const [lineup, setLineup] = useState<number[]>([]);
  const [stage, setStage] = useState<"preview" | "live" | "result">("preview");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  
  // Player Match Stats (Be a Pro Mode)
  const [proTries, setProTries] = useState(0);
  const [proTackles, setProTackles] = useState(0);
  const [proPasses, setProPasses] = useState(0);
  const [proRating, setProRating] = useState(6.0);
  const [proXp, setProXp] = useState(0);

  const matchNoRef = useRef(0);
  const finishRef = useRef<any>(null);

  useEffect(() => {
    if (mode === "player") {
      fetch(`/api/player-careers/${careerId}`)
        .then((r) => r.json())
        .then((d: { state: PlayerCareerState }) => {
          setPlayerState(d.state);
        });
    } else {
      fetch(`/api/careers/${careerId}`)
        .then((r) => r.json())
        .then((d: { state: CareerState }) => {
          setManagerState(d.state);
          const available = d.state.roster.filter((p) => p.injuredWeeks === 0 && p.fitness > 40);
          const sorted = [...available].sort((a, b) => (b.form + b.fitness * 0.5) - (a.form + a.fitness * 0.5));
          setLineup(sorted.slice(0, 15).map((p) => p.id));
        });
    }
  }, [careerId, mode]);

  const state = mode === "player" ? playerState : managerState;
  const fixture = useMemo(() => state?.schedule.find((f) => f.id === fixtureId), [state, fixtureId]);
  const team = state ? getTeam(state.teamId) : null;
  const opponent = fixture && state ? getTeam(fixture.home === state.teamId ? fixture.away : fixture.home) : null;

  const simMatch = async () => {
    if (mode === "player") {
      // Player Career Simulation: simulate 1-3 tries, 2-6 tackles, 4-10 passes randomly
      const tries = Math.random() < 0.22 ? 1 : Math.random() < 0.04 ? 2 : 0;
      const tackles = Math.floor(Math.random() * 5) + 2;
      const passes = Math.floor(Math.random() * 7) + 3;
      const hScore = Math.floor(Math.random() * 25);
      const aScore = Math.floor(Math.random() * 25);
      
      const res = await fetch(`/api/player-careers/${careerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "match",
          fixtureId,
          userTries: tries,
          userTackles: tackles,
          userPasses: passes,
          homeScore: hScore,
          awayScore: aScore,
        }),
      });
      const d = await res.json();
      setProTries(tries);
      setProTackles(tackles);
      setProPasses(passes);
      setProRating(d.matchRating ?? 6.0);
      setProXp(d.xpEarned ?? 40);
      setResult({ homeScore: hScore, awayScore: aScore, homeTries: 0, awayTries: 0, events: [] });
      setPlayerState(d.state);
      setStage("result");
    } else {
      setSimBusy(true);
      const res = await fetch(`/api/careers/${careerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sim-match", fixtureId }),
      });
      const d = await res.json();
      setSimBusy(false);
      setResult({ homeScore: d.state.lastResult?.homeScore ?? 0, awayScore: d.state.lastResult?.awayScore ?? 0, homeTries: 0, awayTries: 0, events: d.state.lastResult?.events ?? [] });
      setManagerState(d.state);
      setStage("result");
    }
  };

  const onFinish = async (r: MatchResult) => {
    const userTeamIdx: 0 | 1 = fixture!.home === state!.teamId ? 0 : 1;
    
    if (mode === "player" && playerState) {
      // Pull stats from completed engine run
      const runtimeEngine = rtRef.current?.engine;
      const tries = runtimeEngine?.userTries ?? 0;
      const tackles = runtimeEngine?.userTackles ?? 0;
      const passes = runtimeEngine?.userPasses ?? 0;

      const res = await fetch(`/api/player-careers/${careerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "match",
          fixtureId,
          userTries: tries,
          userTackles: tackles,
          userPasses: passes,
          homeScore: r.homeScore,
          awayScore: r.awayScore,
        }),
      });
      const d = await res.json();
      setProTries(tries);
      setProTackles(tackles);
      setProPasses(passes);
      setProRating(d.matchRating ?? 6.0);
      setProXp(d.xpEarned ?? 50);
      setPlayerState(d.state);
    } else {
      await fetch(`/api/careers/${careerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "match", fixtureId, homeScore: r.homeScore, awayScore: r.awayScore, homeTries: r.homeTries, awayTries: r.awayTries, userTeam: userTeamIdx, events: r.events }),
      });
      await fetch(`/api/careers/${careerId}`).then((r) => r.json()).then((d: { state: CareerState }) => setManagerState(d.state));
    }
    setResult(r);
    setStage("result");
  };
  finishRef.current = onFinish;

  const rtRef = useRef<GameRuntime | null>(null);

  if (!state || !fixture || !team || !opponent) return <p className="p-8 font-pixel text-sm text-slate-400">Loading…</p>;

  const homeTeam = getTeam(fixture.home);
  const awayTeam = getTeam(fixture.away);
  const kits = pickKits(homeTeam, awayTeam);
  const stadium = getStadium(homeTeam.stadiumId ?? STADIUMS[0].id);
  const userTeamIdx: 0 | 1 = fixture.home === state.teamId ? 0 : 1;

  if (stage === "live") {
    return (
      <div className="fixed inset-0 z-40 bg-black">
        <MatchView
          key={`${fixture.id}-${matchNoRef.current}`}
          config={{
            home: homeTeam, away: awayTeam, userTeam: userTeamIdx, halfSeconds: 120, difficulty: "normal",
            homeColor: kits.home, awayColor: kits.away,
            competition: mode === "player" ? "Player Career" : "Manager Career",
            stadiumId: stadium.id,
            playerLockPosition: mode === "player" && playerState ? playerState.position : undefined,
            playerLockName: mode === "player" && playerState ? playerState.playerName : undefined,
            playerLockAttributes: mode === "player" && playerState ? playerState.attributes : undefined,
          }}
          stadium={stadium}
          competition={mode === "player" ? "Player Career" : "Manager Career"}
          bindings={bindings}
          onFinish={(r) => finishRef.current(r)}
          onQuit={() => go(mode === "player" ? { name: "player-career-hub", id: careerId } : { name: "career-hub", id: careerId })}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker={fixture.knockout ?? `Week ${fixture.week}`}
        title="Match Day"
        right={<Btn onClick={() => go(mode === "player" ? { name: "player-career-hub", id: careerId } : { name: "career-hub", id: careerId })}>Back</Btn>}
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
          {mode === "player" ? (
            <Panel className="p-4 lg:col-span-2">
              <Kicker>Be A Pro Mode</Kicker>
              <p className="text-slate-300 mt-2">You are locked to playing as **{playerState?.playerName}** at position #{playerState?.position}.</p>
              <div className="mt-4 flex items-center gap-4 border border-white/10 p-4 bg-black/40">
                <PlayerSprite jersey={team.primary} jersey2={team.secondary} number={playerState!.position} name={playerState!.playerName} scale={3} />
                <div>
                  <h4 className="font-pixel text-sm text-yellow-300 uppercase leading-relaxed">{playerState?.playerName}</h4>
                  <p className="text-sm text-slate-400">Rating OVR: {playerState?.rating}</p>
                  <p className="text-xs text-slate-500">Form: {playerState?.history.ratingAverage.toFixed(1)} AVG rating</p>
                </div>
              </div>
            </Panel>
          ) : (
            <Panel className="p-4 lg:col-span-2">
              <Kicker>Your starting XV</Kicker>
              <div className="mt-2 flex flex-wrap gap-2">
                {team.players.map((name, i) => {
                  const p = managerState?.roster.find((r) => r.id === i)!;
                  const inLineup = lineup.includes(i);
                  const disabled = !inLineup && lineup.length >= 15;
                  const injured = p?.injuredWeeks > 0;
                  return (
                    <button
                      key={i}
                      disabled={injured || (disabled && !inLineup)}
                      onClick={() => setLineup((L) => inLineup ? L.filter((x) => x !== i) : [...L, i])}
                      className={`tile p-2 text-left disabled:opacity-40 ${inLineup ? "small-selected" : ""}`}
                    >
                      <PlayerSprite jersey={team.primary} jersey2={team.secondary} number={i + 1} name={name} scale={2} />
                      <p className="truncate font-pixel text-[8px] uppercase">{p?.name}</p>
                      <p className="text-[10px] text-slate-400">
                        Form {Math.round(p?.form)} · Fat {Math.round(p?.fatigue)}
                        {injured && <span className="ml-1 text-red-300">Inj {p.injuredWeeks}w</span>}
                      </p>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-400">{lineup.length} / 15 selected</p>
            </Panel>
          )}

          <Panel className="flex flex-col gap-3 p-4">
            <Kicker>Match Options</Kicker>
            {/* GIANT, OBVIOUS BLINKING START BUTTON requested by user */}
            <button
              onClick={() => {
                matchNoRef.current++;
                setStage("live");
              }}
              disabled={mode === "manager" && lineup.length < 15}
              className="px-btn primary !py-4 !text-xs blink"
            >
              START MATCH (PLAY NOW) →
            </button>
            <Btn onClick={simMatch} disabled={simBusy || (mode === "manager" && lineup.length < 15)}>
              {simBusy ? "Simulating..." : "Quick Sim Match"}
            </Btn>
            <p className="text-[10px] text-slate-500">Tip: Quick sim runs the full match in seconds using your squad's form & fitness.</p>
          </Panel>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel className="p-4 lg:col-span-2">
            <Kicker>Full Time</Kicker>
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

          {mode === "player" ? (
            <Panel className="p-4">
              <Kicker>Your Match Performance</Kicker>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <div className="flex justify-between"><span>Match Rating:</span><span className="font-pixel text-green-300">{proRating.toFixed(1)} / 10.0</span></div>
                <div className="flex justify-between"><span>Tries Scored:</span><span>{proTries}</span></div>
                <div className="flex justify-between"><span>Tackles Made:</span><span>{proTackles}</span></div>
                <div className="flex justify-between"><span>Passes Completed:</span><span>{proPasses}</span></div>
                <div className="flex justify-between border-t border-white/10 pt-2 font-pixel text-[9px] text-yellow-300"><span>XP EARNED:</span><span>+{proXp} XP</span></div>
              </div>
              <Btn primary className="mt-4 w-full" onClick={() => go({ name: "player-career-hub", id: careerId })}>
                Back to Career Hub
              </Btn>
            </Panel>
          ) : (
            <Panel className="flex flex-col gap-3 p-4">
              <Kicker>Continue</Kicker>
              {state.schedule.filter((f) => f.user && !f.played).length > 0 ? (
                <>
                  <Btn primary onClick={() => {
                    const nxt = state.schedule.find((f) => f.user && !f.played);
                    if (nxt) go({ name: "career-match", id: careerId, fixtureId: nxt.id, mode: "manager" });
                  }}>Next match →</Btn>
                  <Btn onClick={async () => {
                    await fetch(`/api/careers/${careerId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "advance" }) });
                    go({ name: "career-hub", id: careerId });
                  }}>Advance week</Btn>
                </>
              ) : (
                <Btn primary onClick={() => go({ name: "career-hub", id: careerId })}>View final standings</Btn>
              )}
              <Btn onClick={() => go({ name: "career-hub", id: careerId })}>Back to hub</Btn>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
