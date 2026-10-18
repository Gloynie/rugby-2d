"use client";

import { useEffect, useMemo, useState } from "react";
import * as audio from "@/game/audio";
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
  packOdds,
  quickSellDuplicates,
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
import { Crest, Btn, Kicker, Panel, PlayerSprite, ScreenHeader, Scroll } from "./ui";

type Tab = "club" | "squad" | "packs" | "challenges" | "season";
type ClubSummary = { id: number; clubName: string; coins: number; rating: number; updatedAt: string };
type Battle = { opponent: UltimateOpponent; mode: "friendly" | "league"; userHome: boolean };

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
  const [completedBattle, setCompletedBattle] = useState<{ result: MatchResult; opponent: UltimateOpponent; userHome: boolean } | null>(null);
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
  // Controller LB / RB (and keyboard Q / E) cycle the UT sections.
  useEffect(() => {
    const order: Tab[] = ["club", "squad", "season", "packs", "challenges"];
    const cycle = (dir: -1 | 1) => setTab((cur) => order[(order.indexOf(cur) + dir + order.length) % order.length]);
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "q" || e.key === "Q") cycle(-1);
      if (e.key === "e" || e.key === "E") cycle(1);
    };
    const onBumper = (e: Event) => cycle((e as CustomEvent<-1 | 1>).detail);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pixelruggas:bumper", onBumper);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pixelruggas:bumper", onBumper);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  if (completedBattle) return <ResultOverlay result={completedBattle.result} club={club} opponent={completedBattle.opponent} userHome={completedBattle.userHome} onClose={() => { setCompletedBattle(null); setTab("club"); }} />;

  if (battle) {
    const userSquad = ultimateTeamData(club);
    const aiSquad = opponentToTeam(battle.opponent);
    const stadium = getStadium("twickenham");
    // Honour the league fixture orientation so recorded scores are never inverted.
    const homeSquad = battle.userHome ? userSquad : aiSquad;
    const awaySquad = battle.userHome ? aiSquad : userSquad;
    return <div className="fixed inset-0 z-40 bg-black">
      <MatchView
        config={{ home: homeSquad.team, away: awaySquad.team, userTeam: battle.userHome ? 0 : 1, halfSeconds: 150, difficulty: "normal", homeColor: homeSquad.team.primary, awayColor: awaySquad.team.primary, competition: battle.mode === "league" ? "ULTIMATE LEAGUE" : "SQUAD BATTLE", stadiumId: stadium.id, homePlayerOverrides: homeSquad.overrides, awayPlayerOverrides: awaySquad.overrides }}
        stadium={stadium}
        competition={battle.mode === "league" ? "ULTIMATE LEAGUE" : "SQUAD BATTLE"}
        bindings={bindings}
        onQuit={() => setBattle(null)}
        onFinish={async (result) => {
          const data = battle.mode === "league"
            ? await commit({ action: "league-result", mode: "league", result })
            : await commit({ action: "record-match", mode: battle.mode, result });
          if (data) {
            const won = battle.userHome ? result.homeScore > result.awayScore : result.awayScore > result.homeScore;
            if (won || data.promoted === "up") audio.playFanfare();
            setCompletedBattle({ result, opponent: battle.opponent, userHome: battle.userHome });
            setBattle(null);
          }
        }}
      />
    </div>;
  }

  const totalOvr = Math.round(getSquadCards(club).slice(0, 15).reduce((sum, card) => sum + card.ovr, 0) / 15);
  const tabs: { id: Tab; label: string; sub: string; accent: string }[] = [
    { id: "club", label: "Club", sub: "Overview", accent: "#facc15" },
    { id: "squad", label: "Squad", sub: "Matchday 23", accent: "#c084fc" },
    { id: "season", label: "Season", sub: "League · promotion", accent: "#38bdf8" },
    { id: "packs", label: "Packs", sub: "Open & quick sell", accent: "#34d399" },
    { id: "challenges", label: "Challenges", sub: "Earn funds", accent: "#fb923c" },
  ];
  const activeTab = tabs.find((t) => t.id === tab) ?? tabs[0];


  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* ── UT top bar: wordmark, breadcrumbs, funds / rating ── */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-pixel grid h-9 w-9 place-items-center border-2 border-black bg-[#c084fc] text-[11px] text-black shadow-[3px_3px_0_#000]">UT</span>
            <div>
              <p className="font-pixel text-[11px] uppercase leading-none text-white">{club.clubName}</p>
              <p className="font-pixel mt-1 text-[7px] uppercase tracking-[0.25em] text-slate-400">{activeTab.sub}</p>
            </div>
          </div>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Ultimate Team sections">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`font-pixel border-b-2 px-3 py-2 text-[8px] uppercase tracking-[0.2em] transition ${
                  tab === t.id ? "text-white" : "border-transparent text-slate-500 hover:text-slate-200"
                }`}
                style={tab === t.id ? { borderColor: t.accent } : undefined}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div className="border-2 border-black bg-black/70 px-3 py-1.5 text-center shadow-[3px_3px_0_#000]">
            <p className="font-pixel text-[11px] leading-none text-yellow-300">{club.coins.toLocaleString()}</p>
            <p className="font-pixel mt-1 text-[6px] uppercase tracking-widest text-slate-400">Funds</p>
          </div>
          <div className="border-2 border-black bg-black/70 px-3 py-1.5 text-center shadow-[3px_3px_0_#000]">
            <p className="font-pixel text-[11px] leading-none text-white">{totalOvr}</p>
            <p className="font-pixel mt-1 text-[6px] uppercase tracking-widest text-slate-400">Team OVR</p>
          </div>
          <Btn onClick={() => go({ name: "menu" })} className="!py-2.5 !text-[8px]">Menu</Btn>
        </div>
      </div>

      {error && <p className="mb-2 border-2 border-red-500/60 bg-red-950/60 px-4 py-2 text-lg text-red-100">{error}</p>}
      {notice && <p className="mb-2 border-2 border-green-400/60 bg-green-950/60 px-4 py-2 text-lg text-green-100">{notice}</p>}

      {/* ── body: left rail (main-menu style) + content ── */}
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
        <aside className="col-span-3 hidden min-h-0 flex-col gap-1 md:flex lg:col-span-2">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`group flex items-center gap-2.5 py-2 pl-1 text-left transition-all ${active ? "translate-x-1.5" : ""}`}
              >
                <span className="block w-1.5 shrink-0 transition-all" style={{ height: active ? 26 : 0, background: t.accent }} />
                <span>
                  <span className={`font-pixel block uppercase leading-tight transition-all ${active ? "text-[13px] text-white drop-shadow-[2px_2px_0_#000]" : "text-[10px] text-slate-500 group-hover:text-slate-200"}`}>{t.label}</span>
                  <span className={`block text-[13px] leading-none ${active ? "text-slate-300" : "text-slate-600"}`}>{t.sub}</span>
                </span>
              </button>
            );
          })}
          <div className="mt-auto border-2 border-black bg-black/60 p-2.5 shadow-[3px_3px_0_#000]">
            <p className="font-pixel text-[6px] uppercase tracking-widest text-slate-400">Season</p>
            <p className="mt-1 text-[14px] leading-tight text-slate-200">{club.league ? `Division ${club.league.divisionIndex + 1} · Season ${club.league.season} · Round ${club.league.round}` : "Not started"}</p>
          </div>
        </aside>

        <div className="col-span-12 min-h-0 md:col-span-9 lg:col-span-10">
          {tab === "squad" ? (
            <SquadTab club={club} busy={busy} onSave={async (lineup, bench) => { const data = await commit({ action: "save-squad", lineup, bench }); if (data) setNotice("Your matchday 23 is saved."); }} onSell={async (id) => { const data = await commit({ action: "quick-sell", cardIds: [id] }); if (data) { audio.playCoin(); setNotice(`Sold for +${data.coinsEarned ?? 0} funds.`); } }} />
          ) : (
            <Scroll className="pr-2">
              {tab === "club" && <ClubHome club={club} onTab={setTab} />}
              {tab === "packs" && <PackTab club={club} busy={busy} onOpen={async (packId) => { const data = await commit({ action: "open-pack", packId }); const cards = data?.packedCards as UltimateCard[] | undefined; if (cards) { audio.playPackOpen(); const best = Math.max(...cards.map((card) => card.ovr)); if (best >= 88) audio.playLegendary(); else if (best >= 80) audio.playFanfare(); setPackCards(cards); setReveal(0); } }} onSell={async (id) => { const data = await commit({ action: "quick-sell", cardIds: [id] }); if (data) { audio.playCoin(); setNotice(`Sold for +${data.coinsEarned ?? 0} funds.`); } }} onSellDuplicates={async () => { const data = await commit({ action: "quick-sell-duplicates" }); if (data) { audio.playCoin(); setNotice(`Sold ${data.count ?? 0} duplicates for +${data.coinsEarned ?? 0} funds.`); } }} />}
              {tab === "challenges" && <Challenges club={club} busy={busy} onClaim={async (id) => { const data = await commit({ action: "claim-challenge", challengeId: id }); if (data) { audio.playCoin(); setNotice(`Challenge reward claimed: +${data.reward ?? 0} funds.`); } }} />}
              {tab === "season" && <SeasonTab club={club} busy={busy} onPlayNext={() => { const match = currentLeagueMatch(club); if (!match) return; const userHome = match.home === -1; const oppIndex = (match.home === -1 ? match.away : match.home) - 1; setBattle({ opponent: club.league!.opponents[oppIndex], mode: "league", userHome }); }} onOnline={async (username) => { const data = await inviteUltimate(clubId!, username); if (data.error) setError(data.error); else { setNotice(`Ultimate Team invite sent to ${data.recipient}. Open Online to track it.`); go({ name: "online" }); } }} />}
            </Scroll>
          )}
        </div>
      </div>

      {/* ── bottom prompt bar ── */}
      <div className="mt-2 flex items-center gap-4 border-t border-white/10 pt-2">
        <Prompt badge="A" alt="↵" label="Select" />
        <Prompt badge="B" alt="ESC" label="Back" />
        <Prompt badge="LB/RB" alt="Q/E" label="Switch section" />
        {tab === "squad" && <Prompt badge="A" alt="↵" label="Pick up / place" />}
        <span className="font-pixel ml-auto text-[6px] uppercase tracking-widest text-slate-500">Ultimate Team · {club.cards.length} cards</span>
      </div>

      {packCards && <PackReveal key={packCards[reveal]?.instanceId ?? reveal} cards={packCards} index={reveal} onNext={() => reveal < packCards.length - 1 ? setReveal(reveal + 1) : setPackCards(null)} />}
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
            <Stat n={club.coins.toLocaleString()} label="Funds" />
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

/** Rugby position tag by shirt number (1 loosehead … 15 fullback). */
const UT_POS_TAG = ["LH", "HK", "TH", "LK", "LK", "BF", "OF", "N8", "SH", "FH", "LW", "IC", "OC", "RW", "FB"];

/**
 * Pitch layout for the squad view – vertical pitch, attacking up the screen, so the
 * forwards pack down at the bottom and the backs fan out towards the top like a
 * real team sheet. Values are % of the pitch panel.
 */
const UT_SPOTS: { x: number; y: number }[] = [
  { x: 36, y: 86 }, { x: 50, y: 88 }, { x: 64, y: 86 },
  { x: 43, y: 75 }, { x: 57, y: 75 },
  { x: 29, y: 73 }, { x: 71, y: 73 },
  { x: 50, y: 65 },
  { x: 38, y: 55 },
  { x: 52, y: 45 },
  { x: 10, y: 30 },
  { x: 36, y: 33 },
  { x: 56, y: 27 },
  { x: 88, y: 24 },
  { x: 50, y: 10 },
];

/** One slot on the squad pitch / bench. Module-level so React keeps it mounted between taps. */
function SquadCard({
  id, index, area, byId, held, focus, onTap, onFocus,
}: {
  id: string | undefined; index: number; area: "lineup" | "bench";
  byId: Map<string, UltimateCard>; held: string | null; focus: string | null;
  onTap: (area: "lineup" | "bench", index: number) => void; onFocus: (id: string) => void;
}) {
  const card = id ? byId.get(id) : undefined;
  const t = card ? findTeam(card.teamId) : undefined;
  const isHeld = !!id && held === id;
  const isFocus = !!id && focus === id;
  const tag = area === "lineup" ? UT_POS_TAG[index] : "SUB";
  return (
    <button
      type="button"
      onClick={() => onTap(area, index)}
      onFocus={() => id && onFocus(id)}
      onMouseEnter={() => id && onFocus(id)}
      title={card ? `${card.name} · ${card.positionName}` : `Empty ${tag} slot`}
      className={`relative flex w-[60px] flex-col items-center border-2 pb-0.5 pt-0.5 shadow-[2px_2px_0_#000] transition-transform hover:z-20 hover:scale-105 ${
        isHeld ? "border-yellow-300 bg-yellow-400/20" : isFocus ? "border-white bg-[#10243a]" : "border-black bg-[#0b1626]/95"
      } ${held && !isHeld ? "ring-1 ring-yellow-300/40" : ""}`}
    >
      {isFocus && <span className="pointer-events-none absolute -inset-1 border-2 border-yellow-300" aria-hidden />}
      <span className="flex w-full items-center justify-between px-1">
        <span className="font-pixel text-[9px] text-yellow-300">{card?.ovr ?? "--"}</span>
        <span className="font-pixel text-[6px] text-slate-400">{tag}</span>
      </span>
      {card ? (
        <PlayerSprite jersey={t?.primary ?? "#475569"} jersey2={t?.secondary ?? "#f8fafc"} number={card.position} name={card.name} scale={1} view="front" pose="idle" />
      ) : (
        <span className="grid h-7 w-5 place-items-center font-pixel text-[9px] text-slate-600">+</span>
      )}
      <span className="font-pixel w-full truncate px-0.5 text-center text-[6px] uppercase text-white">
        {card ? card.name.split(" ").slice(-1)[0].slice(0, 9) : "EMPTY"}
      </span>
    </button>
  );
}

function SquadTab({ club, busy, onSave, onSell }: { club: UltimateClubState; busy: boolean; onSave: (lineup: string[], bench: string[]) => Promise<void>; onSell: (id: string) => Promise<void> }) {
  const [lineup, setLineup] = useState(club.lineup);
  const [bench, setBench] = useState(club.bench);
  // `held` = card picked up and waiting to be placed; `focus` = card currently inspected on the right.
  const [held, setHeld] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(club.lineup[9] ?? club.lineup[0] ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setLineup(club.lineup); setBench(club.bench); setDirty(false); }, [club]);
  const byId = useMemo(() => new Map(club.cards.map((c) => [c.instanceId, c])), [club.cards]);

  const squadIds = new Set([...lineup, ...bench]);
  const available = club.cards.filter((card) => !squadIds.has(card.instanceId)).sort((a, b) => b.ovr - a.ovr);
  const focusCard = focus ? byId.get(focus) : undefined;
  const lineupOvr = Math.round(lineup.reduce((acc, id) => acc + (byId.get(id)?.ovr ?? 0), 0) / Math.max(1, lineup.length));

  /** Tap a slot: pick up its card, or drop the held card into it (swapping as needed). */
  const tapSlot = (area: "lineup" | "bench", index: number) => {
    const target = area === "lineup" ? lineup : bench;
    const occupant = target[index];
    if (!held) {
      if (occupant) { setHeld(occupant); setFocus(occupant); setNotice("Picked up. Choose a slot to place them."); }
      return;
    }
    const newLine = [...lineup];
    const newBench = [...bench];
    const srcLine = lineup.indexOf(held);
    const srcBench = bench.indexOf(held);
    // move the displaced occupant back to where the held card came from
    if (srcLine >= 0) newLine[srcLine] = occupant;
    else if (srcBench >= 0) newBench[srcBench] = occupant;
    if (area === "lineup") newLine[index] = held; else newBench[index] = held;
    setLineup(newLine); setBench(newBench); setHeld(null); setDirty(true);
    setNotice("Moved. Save the squad when you are done.");
  };

  /** Tap a card in the collection list: pick it up, or inspect it. */
  const tapAvailable = (id: string) => {
    setFocus(id);
    setHeld((h) => (h === id ? null : id));
  };

  const teamOf = (card?: UltimateCard) => (card ? findTeam(card.teamId) : undefined);

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-3">
      {/* ── left: club header + collection list ── */}
      <aside className="col-span-3 flex min-h-0 flex-col gap-2 xl:col-span-2">
        <div className="border-2 border-black bg-black/70 p-3 shadow-[3px_3px_0_#000]">
          <p className="font-pixel truncate text-[9px] uppercase leading-tight">{club.clubName}</p>
          <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
            <span className="font-pixel text-[7px] uppercase text-slate-400">Starting XV</span>
            <span className="font-pixel text-[13px] text-yellow-300">{lineupOvr}</span>
          </div>
          <p className="mt-1 text-[13px] text-slate-400">{lineup.filter(Boolean).length}/15 picked · {bench.filter(Boolean).length}/8 bench</p>
        </div>
        <Btn primary disabled={busy || !dirty} onClick={() => void onSave(lineup, bench)} className="!py-3 !text-[8px]">
          {dirty ? "Save squad" : "Squad saved"}
        </Btn>
        {held && (
          <button type="button" onClick={() => { setHeld(null); setNotice(null); }} className="font-pixel border-2 border-yellow-300/70 bg-yellow-400/10 px-2 py-2 text-[7px] uppercase tracking-widest text-yellow-200">
            Holding {byId.get(held)?.name.split(" ").slice(-1)[0]} · tap to drop
          </button>
        )}
        <p className="font-pixel text-[7px] uppercase tracking-widest text-slate-400">Collection · {available.length}</p>
        <Scroll className="min-h-0 flex-1 pr-1">
          <div className="space-y-1">
            {available.map((card) => {
              const t = teamOf(card);
              const isHeld = held === card.instanceId;
              return (
                <button
                  key={card.instanceId}
                  type="button"
                  onClick={() => tapAvailable(card.instanceId)}
                  onFocus={() => setFocus(card.instanceId)}
                  className={`flex w-full items-center gap-2 border-2 px-1.5 py-1 text-left transition ${isHeld ? "border-yellow-300 bg-yellow-400/15" : focus === card.instanceId ? "border-white/60 bg-black/50" : "border-transparent bg-black/40 hover:border-white/20"}`}
                >
                  <span className="font-pixel w-6 text-[9px] text-yellow-300">{card.ovr}</span>
                  <span className="h-3 w-1.5 shrink-0" style={{ background: t?.primary ?? "#475569" }} />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{card.name}</span>
                  <span className="font-pixel text-[6px] text-slate-500">{UT_POS_TAG[card.position - 1] ?? "SUB"}</span>
                </button>
              );
            })}
            {available.length === 0 && <p className="border border-white/10 p-3 text-center text-[13px] text-slate-500">Every card is in the matchday 23.</p>}
          </div>
        </Scroll>
      </aside>

      {/* ── centre: the pitch + bench ── */}
      <section className="col-span-6 flex min-h-0 flex-col xl:col-span-7">
        <div className="relative min-h-0 flex-1 overflow-hidden border-2 border-black shadow-[4px_4px_0_#000]">
          <div className="absolute inset-0">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="absolute inset-x-0" style={{ top: `${i * 10}%`, height: "10%", background: i % 2 ? "#1b6c31" : "#1f7a37" }} />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-[4%] top-[6%] h-px bg-white/55" />
            <div className="absolute inset-x-[4%] top-[22%] h-px bg-white/35" />
            <div className="absolute inset-x-[4%] top-1/2 h-0.5 bg-white/60" />
            <div className="absolute inset-x-[4%] bottom-[22%] h-px bg-white/35" />
            <div className="absolute inset-x-[4%] bottom-[6%] h-px bg-white/55" />
            <div className="absolute inset-y-[4%] left-[4%] w-px bg-white/45" />
            <div className="absolute inset-y-[4%] right-[4%] w-px bg-white/45" />
            <div className="absolute left-1/2 top-[3%] h-[6%] w-0.5 -translate-x-1/2 bg-white/70" />
            <div className="absolute bottom-[3%] left-1/2 h-[6%] w-0.5 -translate-x-1/2 bg-white/70" />
            <p className="font-pixel absolute bottom-3 left-4 text-[22px] uppercase text-white/10">MATCHDAY XV</p>
          </div>
          {notice && <p className="font-pixel absolute left-1/2 top-2 z-30 -translate-x-1/2 border-2 border-black bg-black/80 px-3 py-1.5 text-[7px] uppercase tracking-widest text-yellow-200 shadow-[2px_2px_0_#000]">{notice}</p>}
          {UT_SPOTS.map((spot, i) => (
            <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${spot.x}%`, top: `${spot.y}%`, zIndex: focus && lineup[i] === focus ? 30 : 10 }}>
              <SquadCard id={lineup[i]} index={i} area="lineup" byId={byId} held={held} focus={focus} onTap={tapSlot} onFocus={setFocus} />
            </div>
          ))}
        </div>
        <div className="mt-2 border-2 border-black bg-black/70 p-2 shadow-[3px_3px_0_#000]">
          <p className="font-pixel mb-1.5 text-[7px] uppercase tracking-widest text-slate-400">Bench · 8</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scroll">
            {Array.from({ length: 8 }).map((_, i) => (
              <SquadCard key={i} id={bench[i]} index={i} area="bench" byId={byId} held={held} focus={focus} onTap={tapSlot} onFocus={setFocus} />
            ))}
          </div>
        </div>
      </section>

      {/* ── right: focused player ── */}
      <aside className="col-span-3 flex min-h-0 flex-col gap-2">
        <div className="flex min-h-0 flex-1 flex-col border-2 border-black bg-black/75 p-3 shadow-[3px_3px_0_#000]">
          {focusCard ? (
            <>
              <div className="flex items-start gap-3">
                <span className="border-2 border-black bg-[#10243a] p-1 shadow-[2px_2px_0_#000]">
                  <PlayerSprite jersey={teamOf(focusCard)?.primary ?? "#475569"} jersey2={teamOf(focusCard)?.secondary ?? "#f8fafc"} number={focusCard.position} name={focusCard.name} scale={2} view="front" pose="idle" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-pixel text-[7px] uppercase tracking-widest text-yellow-400">#{focusCard.position} {UT_POS_TAG[focusCard.position - 1] ?? "SUB"}</p>
                  <p className="font-pixel mt-1 break-words text-[11px] uppercase leading-snug">{focusCard.name}</p>
                  <p className="mt-1 text-[14px] text-slate-400">{focusCard.positionName}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-y border-white/10 py-2">
                <span className="font-pixel text-[7px] uppercase text-slate-400">Overall</span>
                <span className="font-pixel text-[20px] text-yellow-300">{focusCard.ovr}</span>
              </div>
              <div className="mt-3 space-y-1.5">
                {Object.entries(focusCard.ratings).slice(0, 7).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="font-pixel w-9 text-[7px] uppercase text-slate-400">{k.slice(0, 4)}</span>
                    <span className="h-1.5 flex-1 bg-white/10"><span className="block h-full bg-gradient-to-r from-green-500 to-yellow-300" style={{ width: `${Math.min(100, v as number)}%` }} /></span>
                    <span className="font-pixel w-6 text-right text-[8px] text-white">{v as number}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-white/10 pt-2 text-[14px] text-slate-300">
                <p><span className="text-slate-500">Club </span>{focusCard.clubName ?? focusCard.teamName}</p>
                <p><span className="text-slate-500">Nation </span>{focusCard.country}</p>
              </div>
              <div className="mt-auto flex flex-col gap-1.5 pt-3">
                <Btn onClick={() => setHeld(held === focusCard.instanceId ? null : focusCard.instanceId)} className="!py-2 !text-[7px]">
                  {held === focusCard.instanceId ? "Put down" : "Pick up"}
                </Btn>
                {!squadIds.has(focusCard.instanceId) && (
                  <Btn danger onClick={() => void onSell(focusCard.instanceId)} className="!py-2 !text-[7px]">
                    Quick sell · {cardValue(focusCard).toLocaleString()} F
                  </Btn>
                )}
              </div>
            </>
          ) : (
            <p className="m-auto font-pixel text-[7px] uppercase tracking-widest text-slate-500">Select a card</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function PackTab({ club, busy, onOpen, onSell, onSellDuplicates }: { club: UltimateClubState; busy: boolean; onOpen: (id: PackId) => Promise<void>; onSell: (id: string) => Promise<void>; onSellDuplicates: () => Promise<void> }) {
  const squadIds = new Set([...club.lineup, ...club.bench]);
  const available = club.cards.filter((card) => !squadIds.has(card.instanceId)).sort((a, b) => b.ovr - a.ovr);
  const dupeCount = (() => {
    const seen = new Set<string>();
    let count = 0;
    for (const card of available) { if (seen.has(card.catalogueId)) count++; else seen.add(card.catalogueId); }
    return count;
  })();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="p-6">
        <Kicker>Pack shop · {club.packsOpened} opened</Kicker>
        <p className="mt-2 text-lg text-slate-300">Open packs using club funds. Any 80+ pull gets a full walkout reveal.</p>
        <div className="mt-4 grid gap-3">
          {PACKS.map((pack) => (
            <div key={pack.id} className="rounded-lg border-2 p-4" style={{ borderColor: pack.color, background: `${pack.color}14` }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black" style={{ color: pack.color }}>{pack.name}</p>
                  <p className="text-base text-slate-300">{pack.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-yellow-300">{pack.cost.toLocaleString()} F</p>
                  <Btn primary className="mt-2 !text-[10px]" disabled={busy || club.coins < pack.cost} onClick={() => void onOpen(pack.id)}>Open pack</Btn>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-2 text-sm text-slate-400">
                {packOdds(pack.id).map((o) => (
                  <span key={o.band} className="rounded border border-white/10 bg-black/30 px-2 py-0.5">
                    <b className="text-slate-200">{o.band}</b> · {o.chance}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="p-6">
        <div className="flex items-center justify-between">
          <Kicker>Quick sell · {available.length} available</Kicker>
          {dupeCount > 0 && <Btn className="!py-2 !text-[9px]" disabled={busy} onClick={() => void onSellDuplicates()}>Sell {dupeCount} duplicates</Btn>}
        </div>
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
  const tier: "plain" | "walkout" | "elite" = card.ovr >= 88 ? "elite" : card.ovr >= 80 ? "walkout" : "plain";
  const team = findTeam(card.teamId);
  const jersey = team?.primary ?? (tier !== "plain" ? "#6d28d9" : "#475569");
  const jersey2 = team?.secondary ?? "#f8fafc";
  const rarity = tier === "elite" ? "#a78bfa" : tier === "walkout" ? "#facc15" : card.rarity === "gold" ? "#facc15" : card.rarity === "silver" ? "#94a3b8" : "#b7791f";

  // Walkout stages: 0 flare, 1 country, 2 club, 3 position, 4 card. Plain cards jump to 4.
  // Component is keyed by card at the call site, so initial state resets per card.
  const [stage, setStage] = useState(tier === "plain" ? 4 : 0);
  useEffect(() => {
    if (tier === "plain") return;
    // Elite pulls hold each beat a touch longer for extra tension.
    const beat = tier === "elite" ? 1050 : 850;
    const timers = [1, 2, 3, 4].map((st) => window.setTimeout(() => setStage(st), beat * st));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [card.instanceId, tier]);

  const skip = () => setStage(4);
  const positionGroup = card.position <= 8 ? "FORWARD" : "BACK";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/92 p-6" onClick={stage < 4 ? skip : undefined}>
      {tier !== "plain" && (
        <>
          <div className={`walkout-rays pointer-events-none absolute inset-0 ${tier === "elite" ? "elite" : ""}`} />
          <div className="walkout-floor pointer-events-none absolute inset-x-0 bottom-0 h-1/3" />
        </>
      )}

      {stage < 4 ? (
        <div className="relative w-[640px] max-w-full text-center">
          <p className="font-pixel text-[9px] uppercase tracking-[0.4em] text-slate-400">
            {tier === "elite" ? "★ Elite walkout ★" : "Walkout"}
          </p>
          <p className="font-pixel walkout-pulse mt-2 text-[12px] uppercase text-yellow-300">{card.ovr >= 88 ? "Something special" : "80+ player incoming"}</p>

          <div className="mt-8 flex min-h-[220px] items-center justify-center">
            {stage === 0 && <span className="walkout-flare block h-40 w-40 rounded-full" />}
            {stage === 1 && (
              <div className="walkout-pop">
                <p className="font-pixel text-[8px] uppercase tracking-[0.35em] text-slate-400">Nation</p>
                <p className="font-pixel mt-3 text-[28px] uppercase leading-tight text-white drop-shadow-[4px_4px_0_#000]">{card.country}</p>
              </div>
            )}
            {stage === 2 && (
              <div className="walkout-pop flex flex-col items-center">
                <p className="font-pixel text-[8px] uppercase tracking-[0.35em] text-slate-400">Club</p>
                {team && <div className="mt-3"><Crest team={team} size={72} /></div>}
                <p className="font-pixel mt-3 text-[16px] uppercase leading-tight text-white drop-shadow-[3px_3px_0_#000]">{card.clubName ?? card.teamName}</p>
              </div>
            )}
            {stage === 3 && (
              <div className="walkout-pop">
                <p className="font-pixel text-[8px] uppercase tracking-[0.35em] text-slate-400">Position</p>
                <p className="font-pixel mt-3 text-[26px] uppercase text-white drop-shadow-[4px_4px_0_#000]">{card.positionName}</p>
                <p className="font-pixel mt-2 text-[9px] uppercase tracking-widest" style={{ color: rarity }}>#{card.position} · {positionGroup}</p>
              </div>
            )}
          </div>

          <div className="mx-auto mt-6 flex w-48 gap-1">
            {[1, 2, 3, 4].map((s) => (
              <span key={s} className="h-1.5 flex-1" style={{ background: s <= stage ? rarity : "rgba(255,255,255,0.15)" }} />
            ))}
          </div>
          <p className="font-pixel mt-4 text-[7px] uppercase tracking-widest text-slate-500">Click to skip</p>
        </div>
      ) : (
        <div className={`relative w-[640px] max-w-full border-2 border-black bg-[#05070d]/95 p-7 text-center shadow-[4px_4px_0_#000] ${tier !== "plain" ? "walkout-card-in" : ""}`}>
          <span className="absolute inset-x-0 top-0 h-1" style={{ background: rarity }} />
          <p className="font-pixel text-[8px] uppercase tracking-[0.3em] text-slate-400">
            {tier === "elite" ? "★ Elite ★" : tier === "walkout" ? "Walkout" : "Pack reveal"}
          </p>

          <div className="mx-auto mt-5 flex w-full max-w-lg items-stretch gap-5 border-2 bg-[#0b1626] p-5 text-left shadow-[3px_3px_0_#000]" style={{ borderColor: rarity }}>
            <div className="relative grid w-36 shrink-0 place-items-end overflow-hidden border-2 border-black bg-black/40">
              <span className="absolute inset-x-0 top-0 h-10" style={{ background: `linear-gradient(180deg, ${rarity}55, transparent)` }} />
              <PlayerSprite jersey={jersey} jersey2={jersey2} number={card.position} name={card.name} scale={4} view="front" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-pixel text-[36px] leading-none" style={{ color: rarity }}>{card.ovr}</p>
                  <p className="font-pixel mt-1 text-[8px] uppercase text-slate-400">{card.positionName}</p>
                </div>
                <span className="font-pixel text-[8px] uppercase" style={{ color: rarity }}>{card.rarity}</span>
              </div>
              <p className="font-pixel mt-4 break-words text-[13px] uppercase leading-snug">{card.name}</p>
              <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2">
                {team && <Crest team={team} size={22} />}
                <p className="min-w-0 truncate text-[15px] text-slate-200">{card.clubName ?? card.teamName}</p>
              </div>
              <p className="mt-1 text-[15px] text-slate-200"><span className="text-slate-500">Nation </span>{card.country}</p>
            </div>
          </div>

          <div className="mx-auto mt-4 grid max-w-lg grid-cols-4 gap-1.5 text-left">
            {Object.entries(card.ratings).map(([k, v]) => (
              <span key={k} className="border-2 border-black bg-black/40 px-2 py-1.5 font-pixel text-[8px]">
                <b style={{ color: rarity }}>{v}</b> <span className="text-slate-400">{k.toUpperCase().slice(0, 4)}</span>
              </span>
            ))}
          </div>
          <p className="font-pixel mt-5 text-[7px] uppercase tracking-widest text-slate-500">Card {index + 1} of {cards.length}</p>
          <Btn primary className="mt-4" onClick={onNext}>{index < cards.length - 1 ? "Reveal next card" : "Add to club"}</Btn>
        </div>
      )}
    </div>
  );
}

function Prompt({ badge, alt, label }: { badge: string; alt: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-pixel grid h-5 min-w-[20px] place-items-center rounded-full border border-white/40 bg-black/50 px-1 text-[6px] text-white" title={`Keyboard: ${alt}`}>{badge}</span>
      <span className="font-pixel text-[7px] uppercase tracking-widest text-slate-400">{label}</span>
    </span>
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
      {onSell && <button type="button" onClick={onSell} className="mt-2 w-full rounded border-2 border-yellow-400/70 bg-yellow-400/10 px-2 py-1.5 text-[11px] font-black uppercase text-yellow-300 hover:bg-yellow-400/20">Quick sell · {value.toLocaleString()} F</button>}
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
            <p className="mt-2 text-base text-slate-400">{ch.progress}/{ch.target} · reward <b className="text-yellow-300">{ch.reward} funds</b></p>
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
        <p className="mt-2 text-lg text-slate-300">Finish top 2 to earn promotion toward the URC Super League. Bottom 2 are relegated. Every league result pays funds — more for wins and for beating stronger clubs.</p>
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

function ResultOverlay({ result, club, opponent, userHome, onClose }: { result: MatchResult; club: UltimateClubState; opponent: UltimateOpponent; userHome: boolean; onClose: () => void }) {
  const userTeamData = ultimateTeamData(club).team;
  const oppTeamData = opponentToTeam(opponent).team;
  const home = userHome ? userTeamData : oppTeamData;
  const away = userHome ? oppTeamData : userTeamData;
  const won = userHome ? result.homeScore > result.awayScore : result.awayScore > result.homeScore;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <Panel className="max-h-[92vh] w-[1000px] max-w-full overflow-y-auto p-6 scroll">
        <Kicker>Ultimate match complete · {won ? "Victory" : result.homeScore === result.awayScore ? "Draw" : "Defeat"}</Kicker>
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
