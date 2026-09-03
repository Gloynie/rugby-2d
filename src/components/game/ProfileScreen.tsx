"use client";

import { useEffect, useState } from "react";
import { TEAMS, findTeam, getCompetition } from "@/game/data";
import type { SessionUser } from "@/lib/auth";
import type { Screen } from "./GameShell";
import { Btn, Crest, Kicker, Panel, ScreenHeader, Scroll } from "./ui";

interface MatchRow {
  id: number; competition: string; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; userTeam: string; stadium: string; result: string;
}
interface TourRow { id: number; competitionId: string; teamId: string; status: string }

export default function ProfileScreen({
  user, setUser, initialMode, go, offline,
}: { user: SessionUser | null; setUser: (u: SessionUser | null) => void; initialMode?: "login" | "register"; go: (s: Screen) => void; offline?: boolean }) {
  if (!user) return <AuthPanel initialMode={initialMode ?? "login"} onAuth={setUser} offline={offline} />;
  return <Career user={user} go={go} />;
}

function Career({ user, go }: { user: SessionUser; go: (s: Screen) => void }) {
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [tours, setTours] = useState<TourRow[]>([]);
  useEffect(() => {
    fetch("/api/matches").then((r) => r.json()).then((d: { matches: MatchRow[] }) => setRows(d.matches ?? [])).catch(() => {});
    fetch("/api/tournaments").then((r) => r.json()).then((d: { tournaments: TourRow[] }) => setTours(d.tournaments ?? [])).catch(() => {});
  }, []);
  const w = rows.filter((m) => m.result === "W").length;
  const d = rows.filter((m) => m.result === "D").length;
  const l = rows.filter((m) => m.result === "L").length;
  const pf = rows.reduce((s, m) => s + (m.userTeam === m.homeTeam ? m.homeScore : m.awayScore), 0);
  const pa = rows.reduce((s, m) => s + (m.userTeam === m.homeTeam ? m.awayScore : m.homeScore), 0);
  const fav = findTeam(user.favouriteTeam);
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader kicker="Career" title={user.username} right={fav ? <div className="flex items-center gap-2 text-slate-300"><Crest team={fav} size={36} /> {fav.name}</div> : undefined} />
      <Scroll className="pr-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {[["Played", rows.length], ["Won", w], ["Drawn", d], ["Lost", l], ["Points +/-", `${pf} / ${pa}`]].map(([k, v]) => (
            <Panel key={String(k)} className="p-3">
              <Kicker>{k}</Kicker>
              <p className="font-pixel mt-2 text-xl">{v}</p>
            </Panel>
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel className="p-4 lg:col-span-2">
            <Kicker>Match history</Kicker>
            {rows.length === 0 ? (
              <p className="mt-2 text-slate-400">No matches yet. <button className="text-yellow-300 underline" onClick={() => go({ name: "play" })}>Play one now</button>.</p>
            ) : (
              <ul className="mt-2 divide-y divide-white/10">
                {rows.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 py-1.5">
                    <span className={`font-pixel grid h-6 w-6 place-items-center text-[9px] ${m.result === "W" ? "bg-green-500/30 text-green-300" : m.result === "L" ? "bg-red-500/30 text-red-300" : "bg-slate-500/30 text-slate-200"}`}>{m.result}</span>
                    <span className="font-bold">{findTeam(m.homeTeam)?.name ?? m.homeTeam}</span>
                    <span className="bg-black/50 px-2 font-bold text-yellow-300">{m.homeScore} – {m.awayScore}</span>
                    <span className="font-bold">{findTeam(m.awayTeam)?.name ?? m.awayTeam}</span>
                    <span className="ml-auto text-slate-500">{m.competition} · {m.stadium}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel className="p-4">
            <Kicker>Competitions</Kicker>
            {tours.length === 0 ? (
              <p className="mt-2 text-slate-400">None yet. <button className="text-yellow-300 underline" onClick={() => go({ name: "competitions" })}>Start one</button>.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {tours.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => go({ name: "hub", id: t.id })} className="tile w-full p-2">
                      <p className="font-bold">{getCompetition(t.competitionId)?.name}</p>
                      <p className="text-slate-400">as {findTeam(t.teamId)?.name} · <span className={t.status === "active" ? "text-green-400" : ""}>{t.status}</span></p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </Scroll>
    </div>
  );
}

export function AuthPanel({ initialMode, onAuth, offline }: { initialMode: "login" | "register"; onAuth: (u: SessionUser) => void; offline?: boolean }) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [favouriteTeam, setFavouriteTeam] = useState("ire");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, favouriteTeam }),
    });
    const data = (await res.json().catch(() => ({}))) as { user?: SessionUser; error?: string };
    setBusy(false);
    if (!res.ok || !data.user) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    onAuth(data.user);
  };

  return (
    <div className="flex h-full items-center justify-center">
      <Panel className="w-[460px] max-w-full p-6 slide-in">
        <Kicker>{mode === "login" ? "Sign in" : "Create account"}</Kicker>
        <h1 className="font-pixel mt-1 text-lg uppercase leading-relaxed">{mode === "login" ? "Welcome back" : "Join the squad"}</h1>
        {offline && (
          <div className="mt-4 border-2 border-yellow-400/70 bg-yellow-950/60 p-3 text-yellow-100">
            <p className="font-pixel text-[8px] uppercase text-yellow-300">Guest mode – no database connected</p>
            <p className="mt-1">
              Accounts, saved results and competitions need PostgreSQL. Quick matches work without it.
              Open <b>README.md</b> → “Accounts &amp; competitions” to set it up in a couple of minutes.
            </p>
          </div>
        )}
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block">
            <span className="font-pixel mb-1 block text-[8px] uppercase text-slate-400">Username</span>
            <input className="px-input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={20} />
          </label>
          <label className="block">
            <span className="font-pixel mb-1 block text-[8px] uppercase text-slate-400">Password</span>
            <input className="px-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} />
          </label>
          {mode === "register" && (
            <label className="block">
              <span className="font-pixel mb-1 block text-[8px] uppercase text-slate-400">Favourite team</span>
              <select className="px-input" value={favouriteTeam} onChange={(e) => setFavouriteTeam(e.target.value)}>
                {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}
          {error && <p className="border-2 border-red-500/60 bg-red-950/60 px-3 py-2 text-red-200">{error}</p>}
          <Btn type="submit" primary disabled={busy} className="w-full !py-4">
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </Btn>
        </form>
        <p className="mt-4 text-center text-slate-400">
          {mode === "login" ? (
            <>New here? <button className="text-yellow-300 underline" onClick={() => setMode("register")}>Create an account</button></>
          ) : (
            <>Already have an account? <button className="text-yellow-300 underline" onClick={() => setMode("login")}>Sign in</button></>
          )}
          <br />
          <span className="text-slate-500">You can also play quick matches as a guest.</span>
        </p>
      </Panel>
    </div>
  );
}
