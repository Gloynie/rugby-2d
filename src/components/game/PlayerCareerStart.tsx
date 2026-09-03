"use client";

import { useEffect, useState } from "react";
import { TEAMS, COMPETITIONS, POSITION_NAMES, getTeam, getCompetition } from "@/game/data";
import type { SessionUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Btn, Crest, Kicker, Panel, ScreenHeader, Scroll } from "./ui";

const SKIN_OPTIONS = ["#f3d1b0", "#e6b48c", "#c8865a", "#8d5a3b", "#5b3a29"];
const HAIR_OPTIONS = ["#1a1a1a", "#2d1b0e", "#5a3a1e", "#b8893a", "#a94a1e", "#f5f5f5"];
const STYLE_OPTIONS = ["short", "long", "spiky", "bald"] as const;

interface ActivePlayerCareer {
  id: number;
  playerName: string;
  teamId: string;
  competitionId: string;
  rating: number;
  status: string;
}

export default function PlayerCareerStart({ user, go }: { user: SessionUser; go: (s: any) => void }) {
  const [playerName, setPlayerName] = useState("James pro");
  const [position, setPosition] = useState(10); // Default Fly-half
  const [teamId, setTeamId] = useState("ire");
  const [competitionId, setCompetitionId] = useState("sixnations");
  
  // Customization State
  const [skin, setSkin] = useState(SKIN_OPTIONS[0]);
  const [hair, setHair] = useState(HAIR_OPTIONS[1]);
  const [hairStyle, setHairStyle] = useState<"short" | "long" | "spiky" | "bald">("short");

  const [activeCareers, setActiveCareers] = useState<ActivePlayerCareer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/player-careers")
      .then((r) => r.json())
      .then((d: { careers: ActivePlayerCareer[] }) => setActiveCareers(d.careers ?? []))
      .catch(() => {});
  }, []);

  const team = getTeam(teamId);
  const comp = getCompetition(competitionId);
  const validComps = COMPETITIONS.filter((c) => c.teamIds.includes(teamId));

  const start = async () => {
    if (!playerName.trim()) {
      setError("Please enter your Player Name.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/player-careers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerName,
        position,
        teamId,
        competitionId,
        appearance: { skin, hair, hairStyle },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
    setBusy(false);
    if (!res.ok || !data.id) {
      setError(data.error ?? "Could not start player career.");
      return;
    }
    router.refresh();
    go({ name: "player-career-hub", id: data.id });
  };

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader kicker="Player Career Mode" title="Be A Pro" />
      
      <Scroll className="pr-2">
        {/* Active Player Careers (Resume List) */}
        {activeCareers.length > 0 && (
          <section className="mb-4">
            <Kicker>Resume Your Career</Kicker>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {activeCareers.map((t) => {
                const c = getCompetition(t.competitionId);
                return (
                  <button key={t.id} onClick={() => go({ name: "player-career-hub", id: t.id })} className="tile flex items-center gap-3 p-3">
                    <Crest team={getTeam(t.teamId)} size={34} />
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-pixel text-[9px] uppercase text-yellow-300 truncate">{t.playerName} (OVR {t.rating})</p>
                      <p className="text-slate-300 truncate text-sm">
                        {getTeam(t.teamId).name} · {c?.name}
                      </p>
                    </div>
                    <Btn primary className="!py-1.5 !text-[8px] shrink-0">Resume</Btn>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Create New Pro Form */}
        <section className="space-y-4">
          <Kicker>Create New Pro</Kicker>
          
          <div className="grid gap-6 md:grid-cols-2">
            <Panel className="p-5">
              <Kicker>Pro Customization</Kicker>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-1 block font-pixel text-[8px] uppercase text-slate-400">Player Name</span>
                  <input
                    className="px-input w-full"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={24}
                    placeholder="Enter Pro Name"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block font-pixel text-[8px] uppercase text-slate-400">Position Role</span>
                  <select
                    className="px-input w-full"
                    value={position}
                    onChange={(e) => setPosition(Number(e.target.value))}
                  >
                    {POSITION_NAMES.map((name, idx) => (
                      <option key={idx} value={idx + 1}>
                        #{idx + 1} - {name}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <span className="mb-1 block font-pixel text-[8px] uppercase text-slate-400">Skin Tone</span>
                  <div className="flex gap-2 mt-1">
                    {SKIN_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSkin(s)}
                        className="h-8 w-8 rounded-full border-2 border-black"
                        style={{ background: s, outline: skin === s ? "2px solid #facc15" : "none" }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="mb-1 block font-pixel text-[8px] uppercase text-slate-400">Hair Style</span>
                  <div className="flex gap-2 mt-1">
                    {STYLE_OPTIONS.map((style) => (
                      <Btn key={style} primary={hairStyle === style} onClick={() => setHairStyle(style)} className="!py-1.5 !text-[8px] capitalize">
                        {style}
                      </Btn>
                    ))}
                  </div>
                </div>

                {hairStyle !== "bald" && (
                  <div>
                    <span className="mb-1 block font-pixel text-[8px] uppercase text-slate-400">Hair Color</span>
                    <div className="flex gap-2 mt-1">
                      {HAIR_OPTIONS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setHair(h)}
                          className="h-8 w-8 rounded-full border-2 border-black"
                          style={{ background: h, outline: hair === h ? "2px solid #facc15" : "none" }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            <Panel className="p-5 flex flex-col justify-between">
              <div>
                <Kicker>Team & Competition</Kicker>
                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className="mb-1 block font-pixel text-[8px] uppercase text-slate-400">Your Team</span>
                    <select
                      value={teamId}
                      onChange={(e) => {
                        setTeamId(e.target.value);
                        const comps = COMPETITIONS.filter((c) => c.teamIds.includes(e.target.value));
                        if (!comps.find((c) => c.id === competitionId)) setCompetitionId(comps[0]?.id ?? "");
                      }}
                      className="px-input w-full"
                    >
                      {TEAMS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (OVR {t.rating})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div>
                    <span className="mb-1 block font-pixel text-[8px] uppercase text-slate-400">Competition Campaign</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {validComps.map((c) => (
                        <Btn key={c.id} primary={competitionId === c.id} onClick={() => setCompetitionId(c.id)} className="!py-1.5 !text-[8px]">
                          {c.short}
                        </Btn>
                      ))}
                    </div>
                    {comp && <p className="mt-2 text-sm text-slate-400">{comp.description}</p>}
                  </div>
                </div>
              </div>

              <div className="mt-8">
                {/* GIANT BLINKING PLAY START BUTTON requested by user */}
                <button
                  onClick={start}
                  disabled={busy || !comp}
                  className="px-btn primary !py-4 w-full !text-xs blink"
                >
                  {busy ? "CREATING PRO..." : "START PLAYING PLAYER CAREER →"}
                </button>
              </div>
            </Panel>
          </div>
        </section>
      </Scroll>

      <div className="mt-4 flex">
        <Btn onClick={() => go({ name: "menu" })}>← Back</Btn>
      </div>
    </div>
  );
}
