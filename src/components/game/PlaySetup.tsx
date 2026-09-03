"use client";

import { useEffect, useMemo, useState } from "react";
import type { Bindings } from "@/game/controls";
import { COMPETITIONS, STADIUMS, TEAMS, getCompetition, getStadium, getTeam, pickKits } from "@/game/data";
import type { Difficulty, MatchConfig, MatchResult, Stadium, TeamData, TeamIndex } from "@/game/types";
import type { SessionUser } from "@/lib/auth";
import { nextUserFixture, type TournamentState } from "@/lib/tournament";
import type { Screen } from "./GameShell";
import MatchView from "./MatchView";
import { Btn, Crest, Kbd, Kicker, Panel, PlayerSprite, StadiumThumb, Scroll, ScreenHeader, isLight } from "./ui";

type Step = "team" | "opponent" | "stadium" | "settings" | "match" | "result";

const HALF_OPTIONS = [
  { label: "2 min", value: 120 },
  { label: "4 min", value: 240 },
  { label: "6 min", value: 360 },
  { label: "10 min", value: 600 },
];

interface Props {
  user: SessionUser | null;
  bindings: Bindings;
  tournamentId?: number;
  go: (s: Screen) => void;
  setInMatch: (v: boolean) => void;
}

export default function PlaySetup({ user, bindings, tournamentId, go, setInMatch }: Props) {
  const [step, setStep] = useState<Step>("team");
  const [filter, setFilter] = useState<string>("all");
  const [home, setHome] = useState<TeamData>(getTeam("ire"));
  const [away, setAway] = useState<TeamData>(getTeam("fra"));
  const [userTeam, setUserTeam] = useState<TeamIndex>(0);
  const [stadium, setStadium] = useState<Stadium>(getStadium("aviva"));
  const [halfSeconds, setHalfSeconds] = useState(240);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [tournament, setTournament] = useState<{ id: number; state: TournamentState } | null>(null);
  const [fixtureLabel, setFixtureLabel] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matchNo, setMatchNo] = useState(0);

  useEffect(() => {
    if (!tournamentId) return;
    fetch(`/api/tournaments/${tournamentId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Could not load competition");
        return r.json() as Promise<{ id: number; state: TournamentState }>;
      })
      .then((d) => {
        const next = nextUserFixture(d.state);
        if (!next) {
          setError("No fixture waiting to be played in this competition.");
          return;
        }
        const h = getTeam(next.fixture.home);
        const a = getTeam(next.fixture.away);
        setHome(h);
        setAway(a);
        setUserTeam(h.id === d.state.userTeamId ? 0 : 1);
        setStadium(getStadium(h.stadiumId ?? STADIUMS[Math.floor(Math.random() * STADIUMS.length)].id));
        setFixtureLabel(next.label);
        setTournament(d);
        setStep("stadium");
      })
      .catch((e: Error) => setError(e.message));
  }, [tournamentId]);

  useEffect(() => {
    setInMatch(step === "match" || step === "result");
    return () => setInMatch(false);
  }, [step, setInMatch]);

  const teams = useMemo(() => (filter === "all" ? TEAMS : (getCompetition(filter)?.teamIds.map(getTeam) ?? TEAMS)), [filter]);
  const kits = pickKits(home, away);
  const competitionName = tournament
    ? (getCompetition(tournament.state.competitionId)?.name ?? "Competition")
    : filter !== "all"
      ? (getCompetition(filter)?.name ?? "Friendly")
      : "Friendly";
  const config: MatchConfig = {
    home, away, userTeam, halfSeconds, difficulty, homeColor: kits.home, awayColor: kits.away, competition: competitionName, stadiumId: stadium.id,
  };

  const onFinish = async (r: MatchResult) => {
    setResult(r);
    setStep("result");
    const me = userTeam === 0 ? home : away;
    if (tournament) {
      const res = await fetch(`/api/tournaments/${tournament.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...r, stadiumId: stadium.id }),
      });
      setSaveMsg(res.ok ? "Result recorded in your competition." : "Could not save the result.");
      return;
    }
    if (user) {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition: competitionName, homeTeam: home.id, awayTeam: away.id, homeScore: r.homeScore, awayScore: r.awayScore,
          userTeam: me.id, stadium: stadium.name,
        }),
      });
      setSaveMsg(res.ok ? "Result saved to your career record." : "Could not save the result.");
    } else {
      setSaveMsg("Sign in to save results to your career record.");
    }
  };

  if (step === "match" || step === "result") {
    return (
      <div className="fixed inset-0 z-40 bg-black">
        <MatchView
          key={`${home.id}-${away.id}-${stadium.id}-${matchNo}`}
          config={config}
          stadium={stadium}
          competition={competitionName}
          bindings={bindings}
          onFinish={onFinish}
          onQuit={() => (tournament ? go({ name: "hub", id: tournament.id }) : go({ name: "menu" }))}
        />
        {step === "result" && result && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <Panel className="w-[600px] max-w-[95vw] p-7 slide-in">
              <Kicker>Full time · {competitionName}</Kicker>
              <div className="mt-4 flex items-center justify-between gap-4">
                <TeamBadge team={home} color={kits.home} />
                <div className="text-center">
                  <p className="font-pixel text-3xl tabular-nums text-yellow-300">{result.homeScore} – {result.awayScore}</p>
                  <p className="mt-1 text-slate-400">Tries {result.homeTries} – {result.awayTries}</p>
                </div>
                <TeamBadge team={away} color={kits.away} right />
              </div>
              <ul className="mt-5 max-h-40 space-y-0.5 overflow-auto text-lg text-slate-300 scroll">
                {result.events.length === 0 && <li className="text-slate-500">No scores – a proper arm wrestle.</li>}
                {result.events.map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-9 text-slate-500">{e.minute}&apos;</span>
                    <span className="font-pixel text-[9px] leading-relaxed" style={{ color: e.team === 0 ? kits.home : kits.away }}>
                      {(e.team === 0 ? home : away).short}
                    </span>
                    <span className="capitalize">{e.type === "dropgoal" ? "Drop goal" : e.type}</span>
                    <span className="text-slate-400">{e.player}</span>
                  </li>
                ))}
              </ul>
              {saveMsg && <p className="mt-3 text-slate-400">{saveMsg}</p>}
              <div className="mt-5 flex flex-wrap gap-3">
                {tournament ? (
                  <Btn primary onClick={() => go({ name: "hub", id: tournament.id })}>Continue competition</Btn>
                ) : (
                  <Btn primary onClick={() => { setResult(null); setSaveMsg(null); setMatchNo((n) => n + 1); setStep("match"); }}>Play again</Btn>
                )}
                {!tournament && <Btn onClick={() => { setResult(null); setSaveMsg(null); setStep("team"); }}>New match</Btn>}
                <Btn onClick={() => go({ name: "menu" })}>Main menu</Btn>
              </div>
            </Panel>
          </div>
        )}
      </div>
    );
  }

  const steps: Step[] = tournament ? ["stadium", "settings"] : ["team", "opponent", "stadium", "settings"];

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker={tournament ? `${competitionName} · ${fixtureLabel}` : "Quick match"}
        title={
          step === "team" ? "Choose your team" : step === "opponent" ? "Choose the opposition" : step === "stadium" ? "Choose the stadium" : "Match settings"
        }
        right={
          <ol className="flex gap-2">
            {steps.map((s, i) => (
              <li key={s} className={`font-pixel px-3 py-1.5 text-[8px] uppercase ${s === step ? "bg-yellow-400 text-black" : "bg-white/10 text-slate-300"}`}>
                {i + 1}. {s}
              </li>
            ))}
          </ol>
        }
      />
      {error && <p className="mb-3 border-2 border-red-500/60 bg-red-950/60 px-4 py-2 text-red-200">{error}</p>}

      <Panel className="mb-3 flex items-center justify-between px-5 py-3">
        <TeamBadge team={home} color={kits.home} label={userTeam === 0 ? "YOU" : "CPU"} />
        <div className="text-center">
          <p className="text-slate-400">{stadium.name}</p>
          <p className="font-pixel text-lg text-yellow-300">VS</p>
          {!tournament && (
            <button className="font-pixel text-[8px] uppercase text-yellow-400 hover:underline" onClick={() => setUserTeam(userTeam === 0 ? 1 : 0)}>
              Swap control
            </button>
          )}
        </div>
        <TeamBadge team={away} color={kits.away} label={userTeam === 1 ? "YOU" : "CPU"} right />
      </Panel>

      <div className="min-h-0 flex-1">
        {(step === "team" || step === "opponent") && (
          <div className="flex h-full flex-col">
            <div className="mb-2 flex flex-wrap gap-2">
              {[{ id: "all", short: "All" }, ...COMPETITIONS].map((c) => (
                <Btn key={c.id} selected={filter === c.id} primary={filter === c.id} className="!py-2 !text-[8px]" onClick={() => setFilter(c.id)}>
                  {c.short}
                </Btn>
              ))}
            </div>
            <Scroll className="pr-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
                {teams.map((t) => {
                  const selected = step === "team" ? home.id === t.id : away.id === t.id;
                  const disabled = step === "opponent" && t.id === home.id;
                  return (
                    <button
                      key={t.id}
                      disabled={disabled}
                      onClick={() => {
                        if (step === "team") {
                          setHome(t);
                          setStadium(getStadium(t.stadiumId));
                          if (away.id === t.id) setAway(teams.find((x) => x.id !== t.id) ?? away);
                          setStep("opponent");
                        } else {
                          setAway(t);
                          setStep("stadium");
                        }
                      }}
                      className={`tile flex items-center gap-2 p-2 disabled:opacity-30 ${selected ? "small-selected" : ""}`}
                    >
                      <Crest team={t} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold leading-tight">{t.name}</p>
                        <p className="text-slate-400">{t.country}</p>
                      </div>
                      <span className="font-pixel text-[9px] text-yellow-300">{t.rating}</span>
                    </button>
                  );
                })}
              </div>
            </Scroll>
          </div>
        )}

        {step === "stadium" && (
          <Scroll className="pr-2">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {STADIUMS.map((s) => (
                <button key={s.id} onClick={() => { setStadium(s); setStep("settings"); }} className={`tile ${stadium.id === s.id ? "small-selected" : ""}`}>
                  <div className="relative h-24 md:h-28">
                    <StadiumThumb stadium={s} />
                    <span className="font-pixel absolute right-2 top-2 bg-black/70 px-2 py-1 text-[7px] uppercase text-slate-200">{s.night ? "Night" : "Day"}</span>
                  </div>
                  <div className="p-3">
                    <p className="font-bold leading-tight">{s.name}</p>
                    <p className="text-slate-400">{s.city}, {s.country} · {s.capacity.toLocaleString()}</p>
                  </div>
                </button>
              ))}
            </div>
          </Scroll>
        )}

        {step === "settings" && (
          <div className="grid h-full gap-4 lg:grid-cols-3">
            <Panel className="p-5">
              <Kicker>Half length (real time)</Kicker>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {HALF_OPTIONS.map((o) => (
                  <Btn key={o.value} primary={halfSeconds === o.value} onClick={() => setHalfSeconds(o.value)}>{o.label}</Btn>
                ))}
              </div>
              <p className="mt-3 text-slate-400">The match clock is scaled to a full 80 minutes.</p>
              <Kicker className="mt-6">Difficulty</Kicker>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
                  <Btn key={d} primary={difficulty === d} onClick={() => setDifficulty(d)}>{d}</Btn>
                ))}
              </div>
            </Panel>
            <Panel className="p-5">
              <Kicker>Your XV</Kicker>
              <div className="mt-3 flex flex-wrap gap-1">
                {(userTeam === 0 ? home : away).players.map((n, i) => (
                  <div key={i} className="flex w-[64px] flex-col items-center" title={n}>
                    <PlayerSprite jersey={userTeam === 0 ? kits.home : kits.away} jersey2={(userTeam === 0 ? home : away).secondary} number={i + 1} name={n} scale={2} view={i % 2 ? "back" : "front"} />
                    <span className="w-full truncate text-center text-sm text-slate-300">{n.split(" ").slice(-1)[0]}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel className="flex flex-col p-5">
              <Kicker>Controls</Kicker>
              <ul className="mt-3 space-y-1 text-slate-200">
                <li><Kbd>{lbl(bindings.up)}</Kbd><Kbd>{lbl(bindings.down)}</Kbd><Kbd>{lbl(bindings.left)}</Kbd><Kbd>{lbl(bindings.right)}</Kbd> move · <Kbd>{lbl(bindings.sprint)}</Kbd> sprint</li>
                <li><Kbd>{lbl(bindings.passUp)}</Kbd>/<Kbd>{lbl(bindings.passDown)}</Kbd> pass up / down</li>
                <li><Kbd>{lbl(bindings.kick)}</Kbd> hold to punt, tap to grubber · <Kbd>{lbl(bindings.dropGoal)}</Kbd> drop goal</li>
                <li><Kbd>{lbl(bindings.action)}</Kbd> tackle · dive · kick-off · goal meter</li>
                <li><Kbd>{lbl(bindings.switch)}</Kbd> switch defender · <Kbd>{lbl(bindings.pause)}</Kbd> pause</li>
              </ul>
              <Btn primary className="mt-auto w-full !py-4 !text-xs" onClick={() => { setMatchNo((n) => n + 1); setStep("match"); }}>
                Kick off
              </Btn>
            </Panel>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-3">
        {step !== "team" && !(tournament && step === "stadium") && (
          <Btn onClick={() => setStep(step === "opponent" ? "team" : step === "stadium" ? "opponent" : "stadium")}>← Back</Btn>
        )}
        {step === "stadium" && <Btn primary onClick={() => setStep("settings")}>Continue →</Btn>}
        <Btn className="ml-auto" onClick={() => (tournament ? go({ name: "hub", id: tournament.id }) : go({ name: "menu" }))}>Cancel</Btn>
      </div>
    </div>
  );
}

function lbl(code: string): string {
  const m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1];
  const d = /^Digit(\d)$/.exec(code);
  if (d) return d[1];
  const map: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Space: "SPACE", ShiftLeft: "SHIFT", ShiftRight: "R-SHIFT", Escape: "ESC", Enter: "ENTER", ControlLeft: "CTRL", ControlRight: "R-CTRL" };
  return map[code] ?? code.replace("Numpad", "NUM ").toUpperCase();
}

function TeamBadge({ team, color, label, right }: { team: TeamData; color: string; label?: string; right?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${right ? "flex-row-reverse text-right" : ""}`}>
      <Crest team={team} size={44} color={color} />
      <div>
        <p className="font-pixel text-[10px] uppercase leading-relaxed">{team.name}</p>
        <p className="text-slate-400">
          {label && <span className="font-pixel text-[8px]" style={{ color: isLight(color) ? "#fde68a" : color }}>{label} · </span>}
          OVR {team.rating}
        </p>
      </div>
    </div>
  );
}
