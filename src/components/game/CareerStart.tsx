"use client";

import { useState } from "react";
import { TEAMS, COMPETITIONS, getTeam, getCompetition } from "@/game/data";
import type { SessionUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function CareerStart({ user, go }: { user: SessionUser; go: (s: any) => void }) {
  const [teamId, setTeamId] = useState("ire");
  const [competitionId, setCompetitionId] = useState("sixnations");
  const [mode, setMode] = useState<"tournament" | "worldcup" | "friendlies">("tournament");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const team = getTeam(teamId);
  const comp = getCompetition(competitionId);
  const validComps = COMPETITIONS.filter((c) => c.teamIds.includes(teamId));

  const start = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/careers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, competitionId, mode }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.id) {
      setError((data as { error?: string }).error ?? "Could not start career.");
      return;
    }
    router.refresh();
    go({ name: "career-hub", id: data.id });
  };

  return (
    <div className="p-8">
      <h1 className="font-pixel mb-4 text-2xl uppercase text-yellow-300">Start Manager Career</h1>
      <p className="mb-6 text-slate-300">
        Manage a team through a full season or tournament. Pick lineups, talk to players, handle injuries, and watch or simulate every match.
      </p>

      {error && <p className="mb-4 rounded bg-red-900/50 p-3 text-red-200">{error}</p>}

      <div className="mb-6">
        <label className="mb-2 block font-pixel text-sm uppercase text-slate-300">Your Team</label>
        <select
          value={teamId}
          onChange={(e) => {
            setTeamId(e.target.value);
            const comps = COMPETITIONS.filter((c) => c.teamIds.includes(e.target.value));
            if (!comps.find((c) => c.id === competitionId)) setCompetitionId(comps[0]?.id ?? "");
          }}
          className="w-full max-w-md rounded border-2 border-slate-700 bg-slate-900 p-2 text-white"
        >
          {TEAMS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-slate-400">
          {team.name} · {team.country} · OVR {team.rating}
        </p>
      </div>

      <div className="mb-6">
        <label className="mb-2 block font-pixel text-sm uppercase text-slate-300">Mode</label>
        <div className="flex gap-2">
          {(["tournament", "worldcup", "friendlies"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded border-2 px-4 py-2 font-pixel text-xs uppercase ${
                mode === m ? "border-yellow-300 bg-yellow-300/20 text-yellow-300" : "border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {mode === "tournament" ? "League with playoffs" : mode === "worldcup" ? "Pool stage + knockout" : "Regular friendlies"}
        </p>
      </div>

      <div className="mb-8">
        <label className="mb-2 block font-pixel text-sm uppercase text-slate-300">Competition</label>
        <div className="flex flex-wrap gap-2">
          {validComps.map((c) => (
            <button
              key={c.id}
              onClick={() => setCompetitionId(c.id)}
              className={`rounded border-2 px-4 py-2 font-pixel text-xs uppercase ${
                competitionId === c.id ? "border-yellow-300 bg-yellow-300/20 text-yellow-300" : "border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              {c.short}
            </button>
          ))}
        </div>
        {comp && (
          <p className="mt-2 text-sm text-slate-400">
            {comp.name} · {comp.description}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={start}
          disabled={busy || !comp}
          className="rounded border-2 border-yellow-300 bg-yellow-300/20 px-6 py-3 font-pixel text-sm uppercase text-yellow-300 hover:bg-yellow-300/30 disabled:opacity-50"
        >
          {busy ? "Starting..." : "Start Career"}
        </button>
        <button onClick={() => go({ name: "menu" })} className="rounded border-2 border-slate-700 px-6 py-3 font-pixel text-sm uppercase text-slate-400 hover:border-slate-500">
          Back
        </button>
      </div>
    </div>
  );
}
