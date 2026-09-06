"use client";

import { useEffect, useMemo, useState } from "react";
import type { Bindings } from "@/game/controls";
import { findTeam, getStadium } from "@/game/data";
import type { MatchResult } from "@/game/types";
import type { SessionUser } from "@/lib/auth";
import {
  DIVISIONS,
  PACKS,
  cardValue,
  createAiOpponent,
  currentLeagueMatch,
  getSquadCards,
  leagueTable,
  opponentToTeam,
  ultimateTeamData,
  type PackId,
  type UltimateCard,
  type UltimateClubState,
  type UltimateOpponent,
} from "@/lib/ultimate";
import type { Screen } from "./GameShell";
import MatchReport from "./MatchReport";
import MatchView from "./MatchView";
import { Btn, Kicker, Panel, PlayerSprite, ScreenHeader, Scroll } from "./ui";

type Tab = "club" | "squad" | "packs" | "challenges" | "season";
type ClubSummary = { id: number; clubName: string; coins: number; rating: number; updatedAt: string };
type Battle = { opponent: UltimateOpponent; mode: "friendly" | "league" };

const COLOURS = ["#166534", "#1d4ed8", "#b91c1c", "#7c3aed", "#0f766e", "#b45309", "#be123c", "#1e293b"];
const SEC_COLOURS = ["#facc15", "#f8fafc", "#111827", "#f8fafc", "#f8fafc", "#f8fafc", "#facc15", "#38bdf8"];

/** Shirt number -> formation coordinates on a 0..100 / 0..100 pitch (attacking to the right). */
const FORMATION: Record<number, { x: number; y: number }> = {
  1: { x: 26, y: 38 }, 2: { x: 23, y: 50 }, 3: { x: 26, y: 62 },
  4: { x: 33, y: 41 }, 5: { x: 33, y: 59 },
  6: { x: 37, y: 27 }, 7: { x: 37, y: 73 }, 8: { x: 41, y: 50 },
  9: { x: 50, y: 56 }, 10: { x: 58, y: 46 },
  12: { x: 66, y: 36 }, 13: { x: 66, y: 64 },
  11: { x: 76, y: 14 }, 14: { x: 76, y: 86 }, 15: { x: 86, y: 50 },
};

export default function UltimateTeam({ user, bindings, go, setInMatch }: { user: SessionUser | null; bindings: Bindings; go: (screen: Screen) => void; setInMatch: (value: boolean) => void }) {
  const [summaries, setSummaries] = useState<ClubSummary[]>([]);
  const [clubId, setClubId] = useState<number | null>(null);
  const [club, setClub] = useState<UltimateClubState | null>(null);
  const [tab, setTab] = useState<Tab>("club");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [completedBattle, setCompletedBattle] = useState<{ result: MatchResult; opponent: UltimateOpponent } | null>(null);
  const [packCards, setPackCards] = useState<UltimateCard[] | null>(null);
  const [reveal, setReveal] = useState(0);

  const loadClub = async (id: number) => {
    const res = await fetch(`/api/ultimate/${id}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({})) as { state?: UltimateClubState; error?: string };
    if (!res.ok || !data.state) { setError(data.error ?? "Could not load your Ultimate Club."); return; }
    setClub(data.state); setClubId(id);
  };
  const load = async () => {
    if (!user) return;
    const res = await fetch("/api/ultimate", { cache: "no-store" });
    const data = await res.json().catch(() => ({})) as { clubs?: ClubSummary[]; error?: string };
    if (!res.ok) { setError(data.error ?? "Could not load Ultimate Team."); return; }
    const list = data.clubs ?? [];
    setSummaries(list);
    if (list.length && !clubId) await loadClub(list[0].id);
  };
  useEffect(() => { void load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setInMatch(Boolean(battle)); return () => setInMatch(false); }, [battle, setInMatch]);

  const commit = async (payload: Record<string, unknown>) => {
    if (!clubId) return null;
    setBusy(true); setError(null); setNotice(null);
    const res = await fetch(`/api/ultimate/${clubId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({})) as { state?: UltimateClubState; error?: string; [key: string]: unknown };
    setBusy(false);
    if (!res.ok || !data.state) { setError(data.error ?? "Ultimate Team action failed."); return null; }
    setClub(data.state);
    return data;
  };

  if (!user) return <SignInGate go={go} />;
  if (!club) return <ClubSetup summaries={summaries} onCreated={(id) => void loadClub(id)} go={go} />;
  if (completedBattle) return <ResultOverlay result={completedBattle.result} club={club} opponent={completedBattle.opponent} onClose={() => { setCompletedBattle(null); setTab("club"); }} />;

  if (battle) {
    const userSquad = ultimateTeamData(club);
    const aiSquad = opponentToTeam(battle.opponent);
    const stadium = getStadium("twickenham");
    return <div className="fixed inset-0 z-40 bg-black">
      <MatchView
        config={{ home: userSquad.team, away: aiSquad.team, userTeam: 0, halfSeconds: 150, difficulty: "normal", homeColor: club.primary, awayColor: aiSquad.team.primary, competition: battle.mode === "league" ? "ULTIMATE LEAGUE" : "SQUAD BATTLE", stadiumId: stadium.id, homePlayerOverrides: userSquad.overrides, awayPlayerOverrides: aiSquad.overrides }}
        stadium={stadium}
        competition={battle.mode === "league" ? "ULTIMATE LEAGUE" : "SQUAD BATTLE"}
        bindings={bindings}
        onQuit={() => setBattle(null)}
        onFinish={async (result) => {
          const data = battle.mode === "league"
            ? await commit({ action: "league-result", mode: "league", result })
            : await commit({ action: "record-match", mode: battle.mode, result });
          if (data) { setCompletedBattle({ result, opponent: battle.opponent }); setBattle(null); }
        }}
      />
    </div>;
  }

  const totalOvr = Math.round(getSquadCards(club).slice(0, 15).reduce((sum, card) => sum + card.ovr, 0) / 15);
  const tabs: { id: Tab; label: string }[] = [
    { id: "club", label: "Club" }, { id: "squad", label: "Squad" }, { id: "packs", label: "Packs & Sell" },
    { id: "challenges", label: "Challenges" }, { id: "season", label: "League Season" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-white/10 bg-gradient-to-r from-slate-900 to-slate-950 px-5 py-3">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-lg border-2" style={{ borderColor: club.primary, background: club.primary }}>
            <span className="font-pixel text-sm" style={{ color: club.secondary }}>{club.clubName.slice(0, 2).toUpperCase()}</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-yellow-400">PixelRuggas Ultimate Team</p>
            <h1 className="text-2xl font-black uppercase leading-none">{club.clubName}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-yellow-400/60 bg-yellow-400/10 px-4 py-2 text-center">
            <p className="text-lg font-black leading-none text-yellow-300">{club.coins.toLocaleString()}</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Coins</p>
          </div>
          <div className="rounded-lg border border-white/15 bg-black/30 px-4 py-2 text-center">
            <p className="text-lg font-black leading-none">{totalOvr}</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Team OVR</p>
          </div>
          <Btn onClick={() => go({ name: "menu" })}>Menu</Btn>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-lg border-2 px-5 py-2 text-base font-bold uppercase tracking-wide transition ${tab === t.id ? "border-yellow-400 bg-yellow-400 text-black" : "border-white/15 bg-black/30 text-slate-200 hover:border-white/40"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {error && <p className="mb-3 rounded-lg border-2 border-red-500/60 bg-red-950/60 px-4 py-2 text-lg text-red-100">{error}</p>}
      {notice && <p className="mb-3 rounded-lg border-2 border-green-400/60 bg-green-950/60 px-4 py-2 text-lg text-green-100">{notice}</p>}
      <Scroll className="pr-2">
        {tab === "club" && <ClubHome club={club} onTab={setTab} />}
        {tab === "squad" && <SquadTab club={club} busy={busy} onSave={async (lineup, bench) => { const data = await commit({ action: "save-squad", lineup, bench }); if (data) setNotice("Your matchday 23 is saved."); }} onSell={async (id) => { const data = await commit({ action: "quick-sell", cardIds: [id] }); if (data) setNotice(`Sold for +${data.coinsEarned ?? 0} coins.`); }} />}
        {tab === "packs" && <PackTab club={club} busy={busy} onOpen={async (packId) => { const data = await commit({ action: "open-pack", packId }); const cards = data?.packedCards as UltimateCard[] | undefined; if (cards) { setPackCards(cards); setReveal(0); } }} onSell={async (id) => { const data = await commit({ action: "quick-sell", cardIds: [id] }); if (data) setNotice(`Sold for +${data.coinsEarned ?? 0} coins.`); }} />}
        {tab === "challenges" && <Challenges club={club} busy={busy} onClaim={async (id) => { const data = await commit({ action: "claim-challenge", challengeId: id }); if (data) setNotice(`Challenge reward claimed: +${data.reward ?? 0} coins.`); }} />}
        {tab === "season" && <SeasonTab club={club} busy={busy} onPlayNext={() => { const match = currentLeagueMatch(club); if (!match) return; const oppIndex = (match.home === -1 ? match.away : match.home) - 1; setBattle({ opponent: club.league!.opponents[oppIndex], mode: "league" }); }} onOnline={async (username) => { const data = await inviteUltimate(clubId!, username); if (data.error) setError(data.error); else { setNotice(`Ultimate Team invite sent to ${data.recipient}. Open Online to track it.`); go({ name: "online" }); } }} />}
      </Scroll>
      {packCards && <PackReveal cards={packCards} index={reveal} onNext={() => reveal < packCards.length - 1 ? setReveal(reveal + 1) : setPackCards(null)} />}
    </div>
  );
}

function SignInGate({ go }: { go: (screen: Screen) => void }) {
  return (
    <div className="flex h-full items-center justify-center">
      <Panel className="max-w-lg p-8 text-center">
        <Kicker>Ultimate Team</Kicker>
        <h1 className="mt-2 text-2xl font-black uppercase">Sign in to build your club</h1>
        <p className="mt-3 text-lg text-slate-300">Packs, cards, challenges and your Ultimate squad are saved to your PixelRuggas account.</p>
        <Btn primary className="mt-6" onClick={() => go({ name: "profile", mode: "login" })}>Sign in</Btn>
      </Panel>
    </div>
  );
}

function ClubSetup({ summaries, onCreated, go }: { summaries: ClubSummary[]; onCreated: (id: number) => void; go: (screen: Screen) => void }) {
  const [name, setName] = useState("My Ultimate XV"); const [primary, setPrimary] = useState(COLOURS[0]); const [secondary, setSecondary] = useState(SEC_COLOURS[0]); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const create = async () => { setBusy(true); setError(null); const res = await fetch("/api/ultimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clubName: name, primary, secondary }) }); const data = await res.json().catch(() => ({})) as { id?: number; error?: string }; setBusy(false); if (!res.ok || !data.id) { setError(data.error ?? "Could not create club."); return; } onCreated(data.id); };
  return (
    <div className="flex h-full items-center justify-center">
      <Panel className="w-[680px] max-w-[95vw] p-8">
        <Kicker>Start from the bottom</Kicker>
        <h1 className="mt-2 text-2xl font-black uppercase">Create your Ultimate Club</h1>
        <p className="mt-3 text-lg text-slate-300">You begin with a low-rated Academy XV in Regional League Three. Win promotion all the way to the URC Super League.</p>
        {error && <p className="mt-4 rounded border border-red-500 bg-red-950/60 p-3 text-lg text-red-100">{error}</p>}
        <label className="mt-6 block">
          <span className="text-sm font-bold uppercase tracking-widest text-slate-400">Club name</span>
          <input className="px-input mt-1 text-lg" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="mt-5 grid grid-cols-2 gap-6">
          <ColourPicker title="Primary colour" value={primary} setValue={setPrimary} options={COLOURS} />
          <ColourPicker title="Secondary colour" value={secondary} setValue={setSecondary} options={SEC_COLOURS} />
        </div>
        {summaries.length > 0 && (
          <div className="mt-6">
            <Kicker>Your existing clubs</Kicker>
            <div className="mt-2 flex flex-wrap gap-2">{summaries.map((club) => <Btn key={club.id} onClick={() => onCreated(club.id)}>{club.clubName} · OVR {club.rating}</Btn>)}</div>
          </div>
        )}
        <div className="mt-8 flex gap-3">
          <Btn primary disabled={busy} onClick={create}>{busy ? "Creating..." : "Create club"}</Btn>
          <Btn onClick={() => go({ name: "menu" })}>Back</Btn>
        </div>
      </Panel>
    </div>
  );
}
function ColourPicker({ title, value, setValue, options }: { title: string; value: string; setValue: (value: string) => void; options: string[] }) {
  return (
    <div>
      <span className="text-sm font-bold uppercase tracking-widest text-slate-400">{title}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((colour) => (
          <button key={colour} onClick={() => setValue(colour)} aria-label={`${title} ${colour}`} className="h-9 w-9 rounded-md border-2 border-black" style={{ background: colour, outline: value === colour ? "3px solid #facc15" : "none" }} />
        ))}
      </div>
    </div>
  );
}

function ClubHome({ club, onTab }: { club: UltimateClubState; onTab: (tab: Tab) => void }) {
  const starters = getSquadCards(club).slice(0, 15);
  const byId = useMemo(() => new Map(club.cards.map((c) => [c.instanceId, c])), [club.cards]);
  const rating = Math.round(starters.reduce((s, c) => s + c.ovr, 0) / 15);
  const claimed = club.challenges.filter((c) => !c.claimed && c.progress >= c.target).length;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel className="p-6 lg:col-span-2" accent={club.primary}>
        <Kicker>Your starting XV</Kicker>
        <FormationPitch byId={byId} lineup={club.lineup} selected={null} onSelect={() => onTab("squad")} readOnly />
        <div className="mt-5 flex flex-wrap gap-3">
          <Btn primary onClick={() => onTab("season")}>Play league match</Btn>
          <Btn onClick={() => onTab("squad")}>Edit squad</Btn>
          <Btn onClick={() => onTab("packs")}>Open packs</Btn>
        </div>
      </Panel>
      <div className="space-y-4">
        <Panel className="p-6">
          <Kicker>Club record</Kicker>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <Stat n={rating} label="Team OVR" />
            <Stat n={club.coins.toLocaleString()} label="Coins" />
            <Stat n={`${club.wins}-${club.draws}-${club.losses}`} label="W-D-L" />
            <Stat n={club.cards.length} label="Cards owned" />
          </div>
          {claimed > 0 && <p className="mt-4 text-lg text-yellow-300">{claimed} challenge reward{claimed > 1 ? "s" : ""} ready to claim.</p>}
        </Panel>
        <Panel className="p-6">
          <Kicker>Club activity</Kicker>
          <ul className="mt-3 space-y-2">
            {club.log.slice(0, 7).map((item, i) => <li key={i} className="border-l-4 border-yellow-400/50 bg-black/30 px-3 py-1.5 text-base text-slate-200">{item}</li>)}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <p className="text-2xl font-black text-yellow-300">{n}</p>
      <p className="text-[11px] uppercase tracking-widest text-slate-400">{label}</p>
    </div>
  );
}

/** Pitch with the starting XV arranged in real rugby formation + bench row. */
function FormationPitch({ byId, lineup, bench, selected, onSelect, readOnly }: { byId: Map<string, UltimateCard>; lineup: string[]; bench?: string[]; selected?: string | null; onSelect?: (cardId: string) => void; readOnly?: boolean }) {
  const jersey = (card?: UltimateCard) => { const t = card ? findTeam(card.teamId) : undefined; return t?.primary ?? "#475569"; };
  const jersey2 = (card?: UltimateCard) => { const t = card ? findTeam(card.teamId) : undefined; return t?.secondary ?? "#f8fafc"; };
  return (
    <div>
      <div className="relative w-full overflow-hidden rounded-lg border-2 border-white/20" style={{ aspectRatio: "16 / 9", background: "repeating-linear-gradient(90deg, #2f8f3a 0 48px, #2a7f33 48px 96px)" }}>
        <div className="pointer-events-none absolute inset-y-0 left-[10%] w-px bg-white/70" />
        <div className="pointer-events-none absolute inset-y-0 left-[50%] w-px bg-white/70" />
        <div className="pointer-events-none absolute inset-y-0 left-[90%] w-px bg-white/70" />
        <div className="pointer-events-none absolute inset-y-0 left-[22%] w-px border-l border-dashed border-white/40" />
        <div className="pointer-events-none absolute inset-y-0 left-[78%] w-px border-l border-dashed border-white/40" />
        {lineup.map((id, i) => {
          const card = byId.get(id);
          const pos = FORMATION[i + 1];
          if (!pos) return null;
          const isSel = selected === id;
          return (
            <button
              key={id}
              onClick={() => !readOnly && onSelect?.(id)}
              disabled={readOnly}
              className={`absolute -translate-x-1/2 -translate-y-1/2 ${readOnly ? "cursor-default" : ""} ${isSel ? "z-10" : ""}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: "15%", maxWidth: 96 }}
            >
              <div className={`flex flex-col items-center rounded-md border-2 p-1 ${isSel ? "border-yellow-300 bg-yellow-400/20" : "border-black/50 bg-black/45"} ${!readOnly ? "hover:border-yellow-300/70" : ""}`}>
                <PlayerSprite jersey={jersey(card)} jersey2={jersey2(card)} number={i + 1} name={card?.name ?? `#${i + 1}`} scale={2} view="front" />
                <span className="mt-0.5 w-full truncate text-center text-[10px] font-bold leading-tight text-white">{card?.name ?? "EMPTY"}</span>
                <span className="text-[10px] font-black text-yellow-300">{i + 1} · {card?.ovr ?? "--"}</span>
              </div>
            </button>
          );
        })}
      </div>
      {bench && (
        <div className="mt-3">
          <Kicker>Bench</Kicker>
          <div className="mt-2 grid grid-cols-4 gap-2 md:grid-cols-8">
            {bench.map((id, i) => {
              const card = byId.get(id);
              const isSel = selected === id;
              return (
                <button key={id} onClick={() => onSelect?.(id)} className={`rounded-md border-2 p-1.5 text-left ${isSel ? "border-yellow-300 bg-yellow-400/20" : "border-white/15 bg-black/30 hover:border-yellow-300/70"}`}>
                  <div className="flex items-center justify-between"><span className="text-[10px] text-slate-400">B{i + 1}</span><span className="text-[11px] font-black text-yellow-300">{card?.ovr ?? "--"}</span></div>
                  <p className="truncate text-xs font-bold">{card?.name ?? "EMPTY"}</p>
                  <p className="truncate text-[10px] text-slate-400">{card ? `${card.positionName} · ${card.ratings.pace} PAC` : ""}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SquadTab({ club, busy, onSave, onSell }: { club: UltimateClubState; busy: boolean; onSave: (lineup: string[], bench: string[]) => Promise<void>; onSell: (id: string) => Promise<void> }) {
  const [lineup, setLineup] = useState(club.lineup); const [bench, setBench] = useState(club.bench); const [selected, setSelected] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { setLineup(club.lineup); setBench(club.bench); }, [club]);
  const byId = useMemo(() => new Map(club.cards.map((c) => [c.instanceId, c])), [club.cards]);
  const assign = (area: "lineup" | "bench", index: number) => {
    if (!selected) { setSelected(area === "lineup" ? lineup[index] : bench[index]); return; }
    const target = area === "lineup" ? lineup : bench;
    const sourceLine = lineup.indexOf(selected); const sourceBench = bench.indexOf(selected);
    const displaced = target[index]; const newLine = [...lineup], newBench = [...bench];
    if (sourceLine >= 0) newLine[sourceLine] = displaced; else if (sourceBench >= 0) newBench[sourceBench] = displaced;
    if (area === "lineup") newLine[index] = selected; else newBench[index] = selected;
    setLineup(newLine); setBench(newBench); setSelected(null); setNotice("Card moved. Save your matchday 23 when ready.");
  };
  const squadIds = new Set([...lineup, ...bench]);
  const available = club.cards.filter((card) => !squadIds.has(card.instanceId)).sort((a, b) => b.ovr - a.ovr);
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <Panel className="p-5">
        <div className="flex items-center justify-between">
          <Kicker>Matchday 23 · formation view</Kicker>
          <Btn primary disabled={busy} onClick={() => void onSave(lineup, bench)}>Save squad</Btn>
        </div>
        {notice && <p className="mt-2 text-lg text-yellow-200">{notice}</p>}
        <p className="mt-2 text-base text-slate-300">Click a card in the available collection, then click a formation or bench slot to place it. Click a placed player to pick them up and move them.</p>
        <div className="mt-4">
          <FormationPitch byId={byId} lineup={lineup} bench={bench} selected={selected} onSelect={(id) => { const slot = lineup.indexOf(id); if (slot >= 0) assign("lineup", slot); else assign("bench", bench.indexOf(id)); }} />
        </div>
      </Panel>
      <Panel className="p-5">
        <Kicker>Available collection · {available.length}</Kicker>
        <p className="mt-2 text-base text-slate-300">Players outside your matchday 23. Select one to place it in the squad, or quick sell it for coins.</p>
        <div className="mt-3 grid max-h-[620px] grid-cols-2 gap-2 overflow-y-auto pr-1 scroll">
          {available.map((card) => <CardMini key={card.instanceId} card={card} selected={selected === card.instanceId} onSelect={() => setSelected(card.instanceId)} onSell={() => void onSell(card.instanceId)} />)}
          {available.length === 0 && <p className="col-span-full rounded-lg border border-white/10 p-4 text-center text-slate-500">Every owned card is in your matchday 23. Open a pack to grow the collection.</p>}
        </div>
      </Panel>
    </div>
  );
}

function PackTab({ club, busy, onOpen, onSell }: { club: UltimateClubState; busy: boolean; onOpen: (id: PackId) => Promise<void>; onSell: (id: string) => Promise<void> }) {
  const squadIds = new Set([...club.lineup, ...club.bench]);
  const available = club.cards.filter((card) => !squadIds.has(card.instanceId)).sort((a, b) => b.ovr - a.ovr);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="p-6">
        <Kicker>Pack shop</Kicker>
        <p className="mt-2 text-lg text-slate-300">Open packs using match coins. Any 80+ pull gets a full walkout reveal.</p>
        <div className="mt-4 grid gap-3">
          {PACKS.map((pack) => (
            <div key={pack.id} className="flex items-center justify-between rounded-lg border-2 p-4" style={{ borderColor: pack.color, background: `${pack.color}14` }}>
              <div>
                <p className="text-lg font-black" style={{ color: pack.color }}>{pack.name}</p>
                <p className="text-base text-slate-300">{pack.description}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-yellow-300">{pack.cost.toLocaleString()}c</p>
                <Btn primary className="mt-2 !text-[10px]" disabled={busy || club.coins < pack.cost} onClick={() => void onOpen(pack.id)}>Open pack</Btn>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="p-6">
        <Kicker>Quick sell · {available.length} available</Kicker>
        <p className="mt-2 text-base text-slate-300">Values scale with OVR. Matchday 23 players are protected and never appear here.</p>
        <div className="mt-3 grid max-h-[560px] grid-cols-2 gap-2 overflow-y-auto pr-1 scroll">
          {available.map((card) => <CardMini key={card.instanceId} card={card} onSell={() => void onSell(card.instanceId)} />)}
        </div>
      </Panel>
    </div>
  );
}

function PackReveal({ cards, index, onNext }: { cards: UltimateCard[]; index: number; onNext: () => void }) {
  const card = cards[index];
  const walkout = card.ovr >= 80;
  const team = findTeam(card.teamId);
  const jersey = team?.primary ?? (walkout ? "#6d28d9" : "#475569");
  const jersey2 = team?.secondary ?? "#f8fafc";
  const rarity = walkout ? "#facc15" : card.rarity === "gold" ? "#facc15" : card.rarity === "silver" ? "#94a3b8" : "#b7791f";
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-6">
      <div className={`pack-reveal relative w-[600px] max-w-full p-8 text-center ${walkout ? "elite" : ""}`} style={{ borderColor: rarity }}>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{walkout ? "Walkout! 80+ player" : "Pack reveal"}</p>
        {walkout && <p className="blink mt-3 text-lg font-black uppercase text-yellow-300">Elite card incoming</p>}
        <div className="mx-auto mt-5 flex w-full max-w-md items-center gap-6 rounded-xl border-4 bg-gradient-to-b from-slate-800 to-slate-950 p-6 text-left" style={{ borderColor: rarity }}>
          <div className="grid h-40 w-32 shrink-0 place-items-end overflow-hidden rounded-md border-2 border-white/20 bg-black/35">
            <PlayerSprite jersey={jersey} jersey2={jersey2} number={card.position} name={card.name} scale={4} view="front" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between">
              <div><p className="text-5xl font-black" style={{ color: rarity }}>{card.ovr}</p><p className="mt-1 text-sm font-bold uppercase text-slate-400">{card.positionName}</p></div>
              <span className="text-sm font-black uppercase" style={{ color: rarity }}>{card.rarity}</span>
            </div>
            <p className="mt-4 truncate text-2xl font-black uppercase">{card.name}</p>
            <p className="mt-2 text-lg text-slate-200"><span className="text-slate-500">Club </span>{card.clubName ?? card.teamName}</p>
            <p className="text-lg text-slate-200"><span className="text-slate-500">Country </span>{card.country}</p>
          </div>
        </div>
        <div className="mx-auto mt-4 grid max-w-md grid-cols-4 gap-1.5 text-left text-base">
          {Object.entries(card.ratings).map(([k, v]) => <span key={k} className="rounded border border-white/10 bg-black/30 px-2 py-1"><b style={{ color: rarity }}>{v}</b> {k.toUpperCase().slice(0, 4)}</span>)}
        </div>
        <p className="mt-5 text-base text-slate-400">Card {index + 1} of {cards.length}</p>
        <Btn primary className="mt-4" onClick={onNext}>{index < cards.length - 1 ? "Reveal next card" : "Add to club"}</Btn>
      </div>
    </div>
  );
}

function CardMini({ card, selected, onSelect, onSell }: { card: UltimateCard; selected?: boolean; onSelect?: () => void; onSell?: () => void }) {
  const rarity = { bronze: "#b7791f", silver: "#94a3b8", gold: "#facc15", elite: "#a78bfa" }[card.rarity];
  const sourceTeam = findTeam(card.teamId);
  const jersey = sourceTeam?.primary ?? "#475569";
  const jersey2 = sourceTeam?.secondary ?? "#f8fafc";
  const club = card.clubName ?? card.teamName;
  const value = cardValue(card);
  return (
    <div className={`relative overflow-hidden rounded-lg border-2 bg-gradient-to-b from-slate-800/90 to-black/90 p-2.5 ${selected ? "ring-2 ring-yellow-300" : ""}`} style={{ borderColor: rarity }}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: rarity }} />
      <button onClick={onSelect} className="flex w-full items-start gap-2 text-left">
        <div className="grid h-14 w-11 shrink-0 place-items-end overflow-hidden rounded border border-white/15 bg-black/40">
          <PlayerSprite jersey={jersey} jersey2={jersey2} number={card.position} name={card.name} scale={1.6} view="front" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-1"><span className="text-[11px] font-bold text-slate-300">#{card.position} {card.positionName}</span><span className="text-base font-black" style={{ color: rarity }}>{card.ovr}</span></div>
          <p className="truncate text-base font-bold leading-tight">{card.name}</p>
          <p className="truncate text-xs text-slate-300">{club} · {card.country}</p>
          <p className="mt-0.5 text-xs text-slate-400">PAC {card.ratings.pace} · KCK {card.ratings.kicking} · LD {card.ratings.leadership}</p>
        </div>
      </button>
      {onSell && <button type="button" onClick={onSell} className="mt-2 w-full rounded border-2 border-yellow-400/70 bg-yellow-400/10 px-2 py-1.5 text-[11px] font-black uppercase text-yellow-300 hover:bg-yellow-400/20">Quick sell · {value.toLocaleString()}c</button>}
    </div>
  );
}

function Challenges({ club, busy, onClaim }: { club: UltimateClubState; busy: boolean; onClaim: (id: string) => Promise<void> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {club.challenges.map((ch) => {
        const complete = ch.progress >= ch.target;
        return (
          <Panel key={ch.id} className="p-6" accent={complete && !ch.claimed ? "#facc15" : undefined}>
            <Kicker>{ch.claimed ? "Claimed" : complete ? "Completed" : "Objective"}</Kicker>
            <h3 className="mt-2 text-xl font-black uppercase">{ch.title}</h3>
            <p className="mt-2 text-lg text-slate-300">{ch.description}</p>
            <div className="mt-4 h-4 overflow-hidden rounded border border-white/20 bg-black/50"><div className="h-full bg-yellow-400" style={{ width: `${Math.min(100, (ch.progress / ch.target) * 100)}%` }} /></div>
            <p className="mt-2 text-base text-slate-400">{ch.progress}/{ch.target} · reward <b className="text-yellow-300">{ch.reward} coins</b></p>
            {!ch.claimed && <Btn primary className="mt-4" disabled={!complete || busy} onClick={() => void onClaim(ch.id)}>Claim reward</Btn>}
          </Panel>
        );
      })}
    </div>
  );
}

function SeasonTab({ club, busy, onPlayNext, onOnline }: { club: UltimateClubState; busy: boolean; onPlayNext: () => void; onOnline: (username: string) => Promise<void> }) {
  const [opponent, setOpponent] = useState("");
  const league = club.league!;
  const division = DIVISIONS[league.divisionIndex];
  const table = leagueTable(club);
  const match = currentLeagueMatch(club);
  const userPos = table.findIndex((e) => e.isUser) + 1;
  const oppIndex = match ? (match.home === -1 ? match.away : match.home) - 1 : null;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel className="p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Kicker>{division.name} · Season {league.season}</Kicker>
          <span className="text-base font-bold text-slate-400">Tier {division.tier} · Round {Math.min(league.round + 1, league.rounds.length)}/{league.rounds.length}</span>
        </div>
        <p className="mt-2 text-lg text-slate-300">Finish top 2 to earn promotion toward the URC Super League. Bottom 2 are relegated. Every league result pays coins.</p>
        {league.promotion === "up" && <p className="mt-3 rounded-lg border border-green-400/60 bg-green-950/40 p-3 text-lg text-green-300">PROMOTED last season!</p>}
        {league.promotion === "down" && <p className="mt-3 rounded-lg border border-red-400/60 bg-red-950/40 p-3 text-lg text-red-300">Relegated last season. Climb back up!</p>}
        <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-base">
            <thead className="text-[11px] uppercase tracking-widest text-slate-500">
              <tr><th className="px-3 py-2 text-left">#</th><th className="text-left">Club</th><th className="text-right">P</th><th className="text-right">W</th><th className="text-right">D</th><th className="text-right">L</th><th className="text-right">PF</th><th className="text-right">PA</th><th className="px-3 text-right">Pts</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {table.map((row, i) => (
                <tr key={row.teamKey} className={row.isUser ? "bg-yellow-400/10" : i < 2 ? "bg-green-400/5" : i >= table.length - 2 ? "bg-red-400/5" : ""}>
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className={row.isUser ? "font-black text-yellow-300" : "font-bold"}>{row.name}</td>
                  <td className="text-right tabular-nums">{row.played}</td><td className="text-right tabular-nums">{row.won}</td><td className="text-right tabular-nums">{row.drawn}</td><td className="text-right tabular-nums">{row.lost}</td>
                  <td className="text-right tabular-nums">{row.pf}</td><td className="text-right tabular-nums">{row.pa}</td>
                  <td className="px-3 text-right text-lg font-black tabular-nums text-yellow-300">{row.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {match ? <>
            <span className="text-lg text-slate-200">Next: {club.clubName} v {oppIndex !== null ? club.league!.opponents[oppIndex].name : ""}</span>
            <Btn primary disabled={busy} onClick={onPlayNext}>Play league match</Btn>
          </> : <span className="text-xl font-black text-yellow-300">Season complete — final position {userPos}</span>}
        </div>
      </Panel>
      <Panel className="p-6">
        <Kicker>Ultimate Online</Kicker>
        <p className="mt-2 text-lg text-slate-300">Invite another user by username to play with both players' saved Ultimate squads.</p>
        <input className="px-input mt-4 text-lg" placeholder="Opponent username" value={opponent} onChange={(e) => setOpponent(e.target.value)} autoCapitalize="none" />
        <Btn primary className="mt-3 w-full" disabled={busy || !opponent.trim()} onClick={() => void onOnline(opponent)}>Invite Ultimate opponent</Btn>
        <p className="mt-3 text-base text-slate-500">Your selected matchday 23 is locked into the invite when it is sent.</p>
      </Panel>
    </div>
  );
}

function ResultOverlay({ result, club, opponent, onClose }: { result: MatchResult; club: UltimateClubState; opponent: UltimateOpponent; onClose: () => void }) {
  const home = ultimateTeamData(club).team; const away = opponentToTeam(opponent).team;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <Panel className="max-h-[92vh] w-[1000px] max-w-full overflow-y-auto p-6 scroll">
        <Kicker>Ultimate match complete</Kicker>
        <h2 className="mt-2 text-2xl font-black text-yellow-300">{home.short} {result.homeScore} - {result.awayScore} {away.short}</h2>
        <div className="mt-5"><MatchReport result={result} home={home} away={away} homeColor={home.primary} awayColor={away.primary} /></div>
        <Btn primary className="mt-5" onClick={onClose}>Return to Ultimate Team</Btn>
      </Panel>
    </div>
  );
}

async function inviteUltimate(ultimateClubId: number, opponentUsername: string): Promise<{ recipient?: string; error?: string }> {
  const res = await fetch("/api/online-friendlies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opponentUsername, matchType: "ultimate", ultimateClubId, stadiumId: "twickenham", halfSeconds: 150 }) });
  return res.json().catch(() => ({ error: "Could not send Ultimate invite." }));
}
