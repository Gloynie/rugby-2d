"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Bindings } from "@/game/controls";
import { IDLE_INPUT, InputManager } from "@/game/input";
import { getStadium, getTeam, pickKits, STADIUMS, TEAMS } from "@/game/data";
import { RugbyEngine, type NetworkMatchState } from "@/game/engine";
import { GameRuntime, loadPixelFonts } from "@/game/runtime";
import { LIVE_FRAME, Renderer, VIEW_H, VIEW_W } from "@/game/render";
import type { InputFrame, MatchConfig, MatchResult } from "@/game/types";
import type { SessionUser } from "@/lib/auth";
import type { Screen } from "./GameShell";
import MatchReport from "./MatchReport";
import { Btn, Crest, Kicker, Panel, ScreenHeader, Scroll } from "./ui";

type OnlineStatus = "invited" | "ready" | "live" | "finished" | "declined" | "cancelled";
type Role = "host" | "guest";

type OnlineMatch = {
  id: number;
  hostUserId: number;
  guestUserId: number;
  hostTeamId: string;
  guestTeamId: string;
  stadiumId: string;
  halfSeconds: number;
  status: OnlineStatus;
  role: Role;
  opponentUsername: string;
  hostInput: InputPacket;
  guestInput: InputPacket;
  snapshot: NetworkMatchState | Record<string, never>;
};

type InputPacket = { seq?: number; frame?: InputFrame };

const EMPTY: InputFrame = { ...IDLE_INPUT };
const parseFrame = (packet: InputPacket | null | undefined): InputFrame => {
  const f = packet?.frame;
  if (!f) return { ...EMPTY };
  return {
    moveX: Number.isFinite(f.moveX) ? Math.max(-1, Math.min(1, f.moveX)) : 0,
    moveY: Number.isFinite(f.moveY) ? Math.max(-1, Math.min(1, f.moveY)) : 0,
    sprint: !!f.sprint, kickHeld: !!f.kickHeld, passUp: !!f.passUp, passDown: !!f.passDown,
    kickRelease: !!f.kickRelease, dropGoal: !!f.dropGoal, action: !!f.action,
    switchPlayer: !!f.switchPlayer, option1: !!f.option1, option2: !!f.option2, option3: !!f.option3,
  };
};

export default function OnlineFriendlies({ user, bindings, go }: { user: SessionUser | null; bindings: Bindings; go: (s: Screen) => void }) {
  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Panel className="max-w-lg p-7 text-center">
          <Kicker>Online Friendlies</Kicker>
          <h1 className="font-pixel mt-2 text-lg uppercase leading-relaxed">Sign in to play online</h1>
          <p className="mt-3 text-slate-300">Online friendlies use your PixelRuggas username to send and receive direct game invitations.</p>
          <Btn primary className="mt-5" onClick={() => go({ name: "profile", mode: "login" })}>Sign in</Btn>
        </Panel>
      </div>
    );
  }
  return <OnlineLobby user={user} go={go} />;
}

function OnlineLobby({ user, go }: { user: SessionUser; go: (s: Screen) => void }) {
  const [matches, setMatches] = useState<OnlineMatch[]>([]);
  const [opponent, setOpponent] = useState("");
  const [hostTeamId, setHostTeamId] = useState(user.favouriteTeam ?? "ire");
  const [guestTeamId, setGuestTeamId] = useState("fra");
  const [stadiumId, setStadiumId] = useState("twickenham");
  const [halfSeconds, setHalfSeconds] = useState(180);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = async () => {
    const res = await fetch("/api/online-friendlies", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMatches(data.matches ?? []);
      setLastRefresh(new Date());
    } else setError(data.error ?? "Could not load online matches.");
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, []);

  const invite = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/online-friendlies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opponentUsername: opponent, hostTeamId, guestTeamId, stadiumId, halfSeconds }),
    });
    const data = await res.json().catch(() => ({})) as { id?: number; recipient?: string; existing?: boolean; status?: string; error?: string };
    setBusy(false);
    if (!res.ok || !data.id) {
      setError(data.error ?? "Could not send the invitation.");
      return;
    }
    setOpponent("");
    setNotice(data.existing
      ? `An active ${data.status ?? ""} match with ${data.recipient ?? "that player"} already exists below.`
      : `Invite sent to ${data.recipient ?? opponent}. It is now visible in Your Sent Invites below.`);
    await refresh();
  };

  const accept = async (id: number, action: "accept" | "decline") => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/online-friendlies/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await res.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? `Could not ${action} this invitation.`);
      return;
    }
    if (action === "accept") go({ name: "online-match", id });
    else {
      setNotice("Invitation declined.");
      await refresh();
    }
  };

  const visibleMatches = matches.filter((m) => ["invited", "ready", "live"].includes(m.status));
  const active = visibleMatches.filter((m) => ["ready", "live"].includes(m.status));
  const incoming = visibleMatches.filter((m) => m.role === "guest" && m.status === "invited");
  const outgoing = visibleMatches.filter((m) => m.role === "host" && m.status === "invited");

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker="Online Multiplayer"
        title="Online Friendlies"
        right={<div className="flex gap-2"><Btn onClick={() => void refresh()}>Refresh</Btn><Btn onClick={() => go({ name: "menu" })}>Main menu</Btn></div>}
      />
      <Scroll className="pr-2">
        {error && <p className="mb-4 border-2 border-red-500/60 bg-red-950/60 px-4 py-3 text-red-200">{error}</p>}
        {notice && <p className="mb-4 border-2 border-green-400/60 bg-green-950/60 px-4 py-3 text-green-200">{notice}</p>}
        <Panel className="p-5" accent="#22c55e">
          <div className="flex flex-wrap items-center justify-between gap-3"><Kicker color="#22c55e">Invite a player by username</Kicker><span className="font-pixel text-[7px] text-slate-500">AUTO-REFRESH · {lastRefresh ? lastRefresh.toLocaleTimeString() : "CONNECTING"}</span></div>
          <p className="mt-2 text-slate-300">The invited player gets the away team. When they accept, the host presses Start Match and both browsers join the same live friendly.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label><span className="font-pixel text-[8px] text-slate-400">OPPONENT USERNAME</span><input className="px-input mt-1" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Their username" maxLength={20} autoCapitalize="none" autoCorrect="off" /></label>
            <Picker label="YOUR TEAM" value={hostTeamId} setValue={setHostTeamId} options={TEAMS.map((t) => [t.id, t.name] as const)} />
            <Picker label="THEIR TEAM" value={guestTeamId} setValue={setGuestTeamId} options={TEAMS.filter((t) => t.id !== hostTeamId).map((t) => [t.id, t.name] as const)} />
            <Picker label="STADIUM" value={stadiumId} setValue={setStadiumId} options={STADIUMS.map((s) => [s.id, s.name] as const)} />
            <div>
              <span className="font-pixel text-[8px] text-slate-400">MATCH LENGTH</span>
              <div className="mt-1 flex gap-1">
                {[120, 180, 240].map((sec) => <Btn key={sec} primary={halfSeconds === sec} className="!px-2 !py-2 !text-[7px]" onClick={() => setHalfSeconds(sec)}>{sec / 60}M</Btn>)}
              </div>
              <Btn primary className="mt-3 w-full !py-3 !text-[8px]" disabled={busy || !opponent.trim() || hostTeamId === guestTeamId} onClick={invite}>Send invite</Btn>
            </div>
          </div>

          <div className="mt-6 border-t-2 border-white/10 pt-4">
            <div className="flex items-center justify-between"><Kicker color="#facc15">Active invitation inbox</Kicker><span className="font-pixel text-[7px] text-slate-500">{incoming.length} RECEIVED · {outgoing.length} SENT · {active.length} READY/LIVE</span></div>
            {visibleMatches.length === 0 ? (
              <p className="mt-2 text-slate-400">No active invitations. Enter a friend’s exact username above and send one.</p>
            ) : (
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <InviteColumn title="Received invites" empty="No incoming invites." matches={incoming} kind="incoming" busy={busy} onAccept={accept} onJoin={(matchId) => go({ name: "online-match", id: matchId })} />
                <InviteColumn title="Your sent invites" empty="No pending invites sent." matches={outgoing} kind="outgoing" busy={busy} onAccept={accept} onJoin={(matchId) => go({ name: "online-match", id: matchId })} />
                <InviteColumn title="Ready / live" empty="No accepted matches." matches={active} kind="active" busy={busy} onAccept={accept} onJoin={(matchId) => go({ name: "online-match", id: matchId })} />
              </div>
            )}
          </div>
        </Panel>
      </Scroll>
    </div>
  );
}

function Picker({ label, value, setValue, options }: { label: string; value: string; setValue: (v: string) => void; options: readonly (readonly [string, string])[] }) {
  return <label><span className="font-pixel text-[8px] text-slate-400">{label}</span><select className="px-input mt-1" value={value} onChange={(e) => setValue(e.target.value)}>{options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>;
}

function InviteColumn({ title, empty, matches, kind, busy, onAccept, onJoin }: {
  title: string;
  empty: string;
  matches: OnlineMatch[];
  kind: "incoming" | "outgoing" | "active";
  busy: boolean;
  onAccept: (id: number, action: "accept" | "decline") => void;
  onJoin: (id: number) => void;
}) {
  return <div className="border-2 border-white/10 bg-black/30 p-3"><p className="font-pixel text-[8px] uppercase text-slate-300">{title}</p>{matches.length === 0 ? <p className="mt-2 text-sm text-slate-500">{empty}</p> : <div className="mt-2 space-y-2">{matches.map((m) => {
    const home = getTeam(m.hostTeamId); const away = getTeam(m.guestTeamId);
    return <div key={m.id} className="border border-white/15 bg-black/40 p-2">
      <p className="font-pixel text-[8px] text-white">{home.short} <span className="text-slate-500">V</span> {away.short}</p>
      <p className="mt-1 text-sm text-slate-300">{kind === "incoming" ? `From ${m.opponentUsername}` : kind === "outgoing" ? `To ${m.opponentUsername}` : m.opponentUsername}</p>
      <p className={`font-pixel mt-1 text-[7px] uppercase ${m.status === "live" ? "text-green-300" : m.status === "ready" ? "text-yellow-300" : "text-slate-400"}`}>{m.status}</p>
      <div className="mt-2 flex flex-wrap gap-1">{kind === "incoming" ? <><Btn primary disabled={busy} className="!px-2 !py-2 !text-[7px]" onClick={() => onAccept(m.id, "accept")}>Accept</Btn><Btn danger disabled={busy} className="!px-2 !py-2 !text-[7px]" onClick={() => onAccept(m.id, "decline")}>Decline</Btn></> : <Btn primary className="!px-2 !py-2 !text-[7px]" onClick={() => onJoin(m.id)}>{m.status === "live" ? "Join live" : "Open lobby"}</Btn>}</div>
    </div>;
  })}</div>}</div>;
}

function MatchList({ title, matches, user, onAccept, onJoin, busy }: { title: string; matches: OnlineMatch[]; user: SessionUser; onAccept: (id: number, a: "accept" | "decline") => void; onJoin: (id: number) => void; busy: boolean }) {
  return <section className="mt-5"><Kicker>{title}</Kicker><div className="mt-2 grid gap-2">{matches.map((m) => {
    const home = getTeam(m.hostTeamId), away = getTeam(m.guestTeamId); const incoming = m.role === "guest" && m.status === "invited";
    return <Panel key={m.id} className="flex flex-wrap items-center gap-3 p-3">
      <Crest team={home} size={30} /><b>{home.name}</b><span className="text-slate-500">v</span><b>{away.name}</b><Crest team={away} size={30} />
      <span className="ml-auto text-slate-400">{m.role === "host" ? `Invited ${m.opponentUsername}` : `From ${m.opponentUsername}`} · {m.status.toUpperCase()}</span>
      {incoming ? <><Btn primary disabled={busy} onClick={() => onAccept(m.id, "accept")}>Accept</Btn><Btn danger disabled={busy} onClick={() => onAccept(m.id, "decline")}>Decline</Btn></> : <Btn primary onClick={() => onJoin(m.id)}>{m.status === "live" ? "Join live" : "Open lobby"}</Btn>}
    </Panel>;
  })}</div></section>;
}

export function OnlineMatchRoom({ id, bindings, go }: { id: number; bindings: Bindings; go: (s: Screen) => void }) {
  const [match, setMatch] = useState<OnlineMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/online-friendlies/${id}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Could not load online friendly."); return; }
    setMatch(data as OnlineMatch);
  };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 1200); return () => window.clearInterval(timer); }, [id]);

  const action = async (actionName: "accept" | "decline" | "start" | "cancel") => {
    setStarting(true);
    const res = await fetch(`/api/online-friendlies/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName }) });
    const data = await res.json().catch(() => ({}));
    setStarting(false);
    if (!res.ok) setError(data.error ?? "Action failed.");
    else await load();
  };

  if (error) return <div className="p-8"><p className="border-2 border-red-500/60 bg-red-950/60 p-4 text-red-200">{error}</p><Btn className="mt-4" onClick={() => go({ name: "online" })}>Back</Btn></div>;
  if (!match) return <p className="p-8 font-pixel blink text-[10px] text-slate-300">CONNECTING TO LOBBY...</p>;
  if (match.status === "live") return <OnlineLiveMatch match={match} bindings={bindings} go={go} />;
  const home = getTeam(match.hostTeamId), away = getTeam(match.guestTeamId), stadium = getStadium(match.stadiumId);
  return <div className="flex h-full items-center justify-center"><Panel className="w-[680px] max-w-[95vw] p-7 text-center">
    <Kicker color="#22c55e">Online Friendly #{match.id}</Kicker><h1 className="font-pixel mt-2 text-lg uppercase">Match Lobby</h1>
    <div className="mt-6 flex items-center justify-center gap-6"><div className="flex flex-col items-center gap-2"><Crest team={home} size={56}/><b>{home.name}</b><span className="text-slate-400">{match.role === "host" ? "YOU" : match.opponentUsername}</span></div><span className="font-pixel text-xl text-yellow-300">VS</span><div className="flex flex-col items-center gap-2"><Crest team={away} size={56}/><b>{away.name}</b><span className="text-slate-400">{match.role === "guest" ? "YOU" : match.opponentUsername}</span></div></div>
    <p className="mt-5 text-slate-300">{stadium.name} · {match.halfSeconds / 60} minutes per half</p>
    <p className="mt-2 font-pixel text-[9px] uppercase" style={{ color: match.status === "ready" ? "#22c55e" : "#facc15" }}>{match.status === "invited" ? (match.role === "host" ? "Waiting for your friend to accept..." : "You have been invited. Accept to enter the lobby.") : "Both players are ready! Host can start."}</p>
    <div className="mt-6 flex justify-center gap-3">{match.status === "invited" && match.role === "guest" && <><Btn primary disabled={starting} onClick={() => action("accept")}>Accept invite</Btn><Btn danger disabled={starting} onClick={() => action("decline")}>Decline</Btn></>}{match.status === "ready" && match.role === "host" && <Btn primary disabled={starting} onClick={() => action("start")}>Start Online Match →</Btn>}<Btn onClick={() => go({ name: "online" })}>Back</Btn></div>
  </Panel></div>;
}

function OnlineLiveMatch({ match, bindings, go }: { match: OnlineMatch; bindings: Bindings; go: (s: Screen) => void }) {
  return match.role === "host" ? <OnlineHost match={match} bindings={bindings} go={go} /> : <OnlineGuest match={match} bindings={bindings} go={go} />;
}

function OnlineHost({ match, bindings, go }: { match: OnlineMatch; bindings: Bindings; go: (s: Screen) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const remoteHeld = useRef<InputFrame>({ ...EMPTY });
  const remoteEdge = useRef<InputFrame>({ ...EMPTY });
  const remoteSeq = useRef(-1);
  const lastPublish = useRef(0);
  const lastPoll = useRef(0);
  const postedFinish = useRef(false);
  const [note, setNote] = useState("HOSTING · opponent connecting...");
  const [result, setResult] = useState<MatchResult | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const home = getTeam(match.hostTeamId), away = getTeam(match.guestTeamId), kits = pickKits(home, away), stadium = getStadium(match.stadiumId);
    const config: MatchConfig = { home, away, userTeam: 0, remoteTeam: 1, halfSeconds: match.halfSeconds, difficulty: "normal", homeColor: kits.home, awayColor: kits.away, competition: "ONLINE FRIENDLY", stadiumId: stadium.id };
    let disposed = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/online-friendlies/${match.id}`, { cache: "no-store" });
        const d = await res.json() as OnlineMatch;
        if (disposed) return;
        const packet = d.guestInput;
        if (typeof packet?.seq === "number" && packet.seq !== remoteSeq.current) {
          remoteSeq.current = packet.seq;
          const incoming = parseFrame(packet);
          remoteHeld.current = { ...incoming, passUp: false, passDown: false, kickRelease: false, dropGoal: false, action: false, switchPlayer: false, option1: false, option2: false, option3: false };
          remoteEdge.current = { ...EMPTY, passUp: incoming.passUp, passDown: incoming.passDown, kickRelease: incoming.kickRelease, dropGoal: incoming.dropGoal, action: incoming.action, switchPlayer: incoming.switchPlayer, option1: incoming.option1, option2: incoming.option2, option3: incoming.option3 };
          setNote("HOSTING · opponent connected");
        }
      } catch { /* retry on next poll */ }
    };
    const postSnapshot = (engine: RugbyEngine, finish = false) => {
      const now = performance.now();
      if (!finish && now - lastPublish.current < 180) return;
      lastPublish.current = now;
      void fetch(`/api/online-friendlies/${match.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: finish ? "finish" : "snapshot", snapshot: engine.exportNetworkState() }) });
    };
    const rt = new GameRuntime({
      canvas, config, stadium, bindings, competition: "ONLINE FRIENDLY",
      remoteInput: () => { const out = { ...remoteHeld.current, ...remoteEdge.current }; remoteEdge.current = { ...EMPTY }; return out; },
      onStep: (engine) => { postSnapshot(engine); const now = performance.now(); if (now - lastPoll.current > 90) { lastPoll.current = now; void poll(); } },
      onFinish: (result) => {
        if (!postedFinish.current) { postedFinish.current = true; postSnapshot(rt.engine, true); }
        setResult(result);
        setNote(`FULL TIME · ${result.homeScore}-${result.awayScore}`);
      },
      onPauseToggle: () => {},
    });
    runtimeRef.current = rt;
    void rt.start();
    const heartbeat = window.setInterval(() => void poll(), 600);
    return () => { disposed = true; window.clearInterval(heartbeat); rt.stop(); };
  }, [match.id, match.hostTeamId, match.guestTeamId, match.stadiumId, match.halfSeconds, bindings]);
  const home = getTeam(match.hostTeamId);
  const away = getTeam(match.guestTeamId);
  const kits = pickKits(home, away);
  return <>
    <OnlineCanvas canvasRef={canvasRef} note={note} role="HOST · You control home team" onExit={() => { runtimeRef.current?.stop(); go({ name: "online" }); }} />
    {result && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <Panel className="max-h-[92vh] w-[1000px] max-w-full overflow-y-auto p-6 scroll">
        <Kicker>Online friendly · Full time</Kicker>
        <h2 className="font-pixel mt-2 text-lg text-yellow-300">{home.short} {result.homeScore} - {result.awayScore} {away.short}</h2>
        <div className="mt-5"><MatchReport result={result} home={home} away={away} homeColor={kits.home} awayColor={kits.away} /></div>
        <Btn primary className="mt-5" onClick={() => { runtimeRef.current?.stop(); go({ name: "online" }); }}>Return to online lobby</Btn>
      </Panel>
    </div>}
  </>;
}

function OnlineGuest({ match, bindings, go }: { match: OnlineMatch; bindings: Bindings; go: (s: Screen) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RugbyEngine | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const [note, setNote] = useState("CONNECTING · waiting for host broadcast...");
  const [result, setResult] = useState<MatchResult | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const home = getTeam(match.hostTeamId), away = getTeam(match.guestTeamId), kits = pickKits(home, away), stadium = getStadium(match.stadiumId);
    const engine = new RugbyEngine({ home, away, userTeam: 1, remoteTeam: 0, halfSeconds: match.halfSeconds, difficulty: "normal", homeColor: kits.home, awayColor: kits.away, competition: "ONLINE FRIENDLY", stadiumId: stadium.id });
    const renderer = new Renderer(canvas, stadium, engine, bindings);
    engineRef.current = engine; rendererRef.current = renderer;
    let paused = false, disposed = false, raf = 0, seq = 0, lastSend = 0, lastState = 0;
    const input = new InputManager(bindings, () => { paused = !paused; setNote(paused ? "PAUSED LOCALLY · press pause to resume" : "CONNECTED · controlling away team"); }, () => { renderer.showHelp = !renderer.showHelp; });
    inputRef.current = input; input.attach();
    const updateState = async () => {
      try {
        const res = await fetch(`/api/online-friendlies/${match.id}`, { cache: "no-store" });
        const d = await res.json() as OnlineMatch;
        if (disposed) return;
        if (d.status === "finished") setNote("FULL TIME · host ended match");
        const snap = d.snapshot as NetworkMatchState;
        if (snap && Array.isArray(snap.players)) {
          engine.importNetworkState(snap);
          // On the guest client highlight their remote-controlled player as the local one.
          engine.controlled = snap.remoteControlled;
          if (d.status === "finished" && snap.matchResult) setResult(snap.matchResult);
          setNote(d.status === "finished" ? "FULL TIME" : "CONNECTED · You control away team");
        }
      } catch { setNote("RECONNECTING..."); }
    };
    const send = (frame: InputFrame) => void fetch(`/api/online-friendlies/${match.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "input", packet: { seq: ++seq, frame } }) });
    const loop = async (now: number) => {
      if (disposed) return;
      const frame = input.frame();
      const hasEdge = frame.passUp || frame.passDown || frame.kickRelease || frame.dropGoal || frame.action || frame.switchPlayer || frame.option1 || frame.option2 || frame.option3;
      if (!paused && (now - lastSend > 75 || hasEdge)) { lastSend = now; send(frame); }
      if (now - lastState > 120) { lastState = now; void updateState(); }
      renderer.render(engine, 1 / 60, LIVE_FRAME);
      raf = requestAnimationFrame(loop);
    };
    void loadPixelFonts().then(() => { if (!disposed) raf = requestAnimationFrame(loop); });
    return () => { disposed = true; cancelAnimationFrame(raf); input.detach(); };
  }, [match.id, match.hostTeamId, match.guestTeamId, match.stadiumId, match.halfSeconds, bindings]);
  const home = getTeam(match.hostTeamId);
  const away = getTeam(match.guestTeamId);
  const kits = pickKits(home, away);
  return <>
    <OnlineCanvas canvasRef={canvasRef} note={note} role="GUEST · You control away team" onExit={() => { inputRef.current?.detach(); go({ name: "online" }); }} />
    {result && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <Panel className="max-h-[92vh] w-[1000px] max-w-full overflow-y-auto p-6 scroll">
        <Kicker>Online friendly · Full time</Kicker>
        <h2 className="font-pixel mt-2 text-lg text-yellow-300">{home.short} {result.homeScore} - {result.awayScore} {away.short}</h2>
        <div className="mt-5"><MatchReport result={result} home={home} away={away} homeColor={kits.home} awayColor={kits.away} /></div>
        <Btn primary className="mt-5" onClick={() => { inputRef.current?.detach(); go({ name: "online" }); }}>Return to online lobby</Btn>
      </Panel>
    </div>}
  </>;
}

function OnlineCanvas({ canvasRef, note, role, onExit }: { canvasRef: RefObject<HTMLCanvasElement | null>; note: string; role: string; onExit: () => void }) {
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-black"><canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className="pixelated max-h-full max-w-full" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, width: "100%", height: "auto" }} /><div className="font-pixel absolute left-3 top-3 border-2 border-green-400/60 bg-black/80 px-3 py-2 text-[8px] uppercase text-green-300">{role}<br/><span className="text-slate-300">{note}</span></div><button onClick={onExit} className="px-btn absolute right-3 top-3 !py-2 !text-[8px]">Leave online match</button></div>;
}
