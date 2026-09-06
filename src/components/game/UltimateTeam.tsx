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

type Tab = "club" | "squad" | "packs" | "challenges" | "play";
type ClubSummary = { id: number; clubName: string; coins: number; rating: number; updatedAt: string };
type Battle = { opponent: UltimateOpponent; mode: "friendly" | "cup" | "league" };

const COLOURS = ["#166534", "#1d4ed8", "#b91c1c", "#7c3aed", "#0f766e", "#b45309", "#be123c", "#1e293b"];
const SEC_COLOURS = ["#facc15", "#f8fafc", "#111827", "#f8fafc", "#f8fafc", "#f8fafc", "#facc15", "#38bdf8"];

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
        config={{ home: userSquad.team, away: aiSquad.team, userTeam: 0, halfSeconds: 150, difficulty: "normal", homeColor: club.primary, awayColor: aiSquad.team.primary, competition: battle.mode === "cup" ? "ULTIMATE SQUAD CUP" : "ULTIMATE SQUAD BATTLE", stadiumId: stadium.id, homePlayerOverrides: userSquad.overrides, awayPlayerOverrides: aiSquad.overrides }}
        stadium={stadium}
        competition={battle.mode === "cup" ? "ULTIMATE SQUAD CUP" : "ULTIMATE SQUAD BATTLE"}
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
  return <div className="flex h-full flex-col">
    <ScreenHeader
      kicker="PixelRuggas Ultimate Team"
      title={club.clubName}
      right={<div className="flex items-center gap-3"><span className="font-pixel border-2 border-yellow-400/70 bg-yellow-400/10 px-3 py-2 text-[9px] text-yellow-300">{club.coins.toLocaleString()} COINS</span><span className="font-pixel text-[9px] text-slate-300">OVR {totalOvr}</span><Btn onClick={() => go({ name: "menu" })}>Menu</Btn></div>}
    />
    <div className="mb-3 flex flex-wrap gap-2">
      {(["club", "squad", "packs", "challenges", "play"] as Tab[]).map((entry) => <Btn key={entry} primary={tab === entry} onClick={() => setTab(entry)}>{entry === "play" ? "Season" : entry}</Btn>)}
    </div>
    {error && <p className="mb-3 border-2 border-red-500/60 bg-red-950/60 px-4 py-2 text-red-100">{error}</p>}
    {notice && <p className="mb-3 border-2 border-green-400/60 bg-green-950/60 px-4 py-2 text-green-100">{notice}</p>}
    <Scroll className="pr-2">
      {tab === "club" && <ClubHome club={club} onTab={setTab} />}
      {tab === "squad" && <SquadBuilder club={club} busy={busy} onSave={async (lineup, bench) => { const data = await commit({ action: "save-squad", lineup, bench }); if (data) setNotice("Your matchday 23 is saved."); }} onSell={async (id) => { const data = await commit({ action: "quick-sell", cardIds: [id] }); if (data) setNotice(`Sold for +${data.coinsEarned ?? 0} coins.`); }} />}
      {tab === "packs" && <PackRoom club={club} busy={busy} onOpen={async (packId) => { const data = await commit({ action: "open-pack", packId }); const cards = data?.packedCards as UltimateCard[] | undefined; if (cards) { setPackCards(cards); setReveal(0); } }} />}
      {tab === "challenges" && <Challenges club={club} busy={busy} onClaim={async (id) => { const data = await commit({ action: "claim-challenge", challengeId: id }); if (data) setNotice(`Challenge reward claimed: +${data.reward ?? 0} coins.`); }} />}
      {tab === "play" && <SeasonHub club={club} busy={busy} onPlayNext={() => { const match = currentLeagueMatch(club); if (!match) return; const oppIndex = (match.home === -1 ? match.away : match.home) - 1; setBattle({ opponent: club.league!.opponents[oppIndex], mode: "league" }); }} onOnline={async (username) => { const data = await inviteUltimate(clubId!, username); if (data.error) setError(data.error); else { setNotice(`Ultimate Team invite sent to ${data.recipient}. Open Online to track it.`); go({ name: "online" }); } }} />}
    </Scroll>
    {packCards && <PackReveal cards={packCards} index={reveal} onNext={() => reveal < packCards.length - 1 ? setReveal(reveal + 1) : setPackCards(null)} />}
  </div>;
}

function SignInGate({ go }: { go: (screen: Screen) => void }) { return <div className="flex h-full items-center justify-center"><Panel className="max-w-lg p-7 text-center"><Kicker>Ultimate Team</Kicker><h1 className="font-pixel mt-2 text-lg uppercase">Sign in to build your club</h1><p className="mt-3 text-slate-300">Packs, cards, challenges and your Ultimate squad are saved to your PixelRuggas account.</p><Btn primary className="mt-5" onClick={() => go({ name: "profile", mode: "login" })}>Sign in</Btn></Panel></div>; }

function ClubSetup({ summaries, onCreated, go }: { summaries: ClubSummary[]; onCreated: (id: number) => void; go: (screen: Screen) => void }) {
  const [name, setName] = useState("My Ultimate XV"); const [primary, setPrimary] = useState(COLOURS[0]); const [secondary, setSecondary] = useState(SEC_COLOURS[0]); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const create = async () => { setBusy(true); setError(null); const res = await fetch("/api/ultimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clubName: name, primary, secondary }) }); const data = await res.json().catch(() => ({})) as { id?: number; error?: string }; setBusy(false); if (!res.ok || !data.id) { setError(data.error ?? "Could not create club."); return; } onCreated(data.id); };
  return <div className="flex h-full items-center justify-center"><Panel className="w-[650px] max-w-[95vw] p-7"><Kicker>Start from bronze</Kicker><h1 className="font-pixel mt-2 text-lg uppercase">Create your Ultimate Club</h1><p className="mt-3 text-slate-300">You begin with a low-rated Academy XV, 8 bronze subs and 750 coins. Improve it through matches, packs, challenges and trade-ins.</p>{error && <p className="mt-4 border border-red-500 bg-red-950/60 p-2 text-red-100">{error}</p>}<label className="mt-5 block"><span className="font-pixel text-[8px] text-slate-400">CLUB NAME</span><input className="px-input mt-1" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label><div className="mt-4 grid grid-cols-2 gap-4"><ColourPicker title="PRIMARY" value={primary} setValue={setPrimary} options={COLOURS}/><ColourPicker title="SECONDARY" value={secondary} setValue={setSecondary} options={SEC_COLOURS}/></div>{summaries.length > 0 && <div className="mt-5"><Kicker>Existing clubs</Kicker><div className="mt-2 flex flex-wrap gap-2">{summaries.map((club) => <Btn key={club.id} onClick={() => onCreated(club.id)}>{club.clubName} · OVR {club.rating}</Btn>)}</div></div>}<div className="mt-6 flex gap-3"><Btn primary disabled={busy} onClick={create}>{busy ? "Creating..." : "Create club"}</Btn><Btn onClick={() => go({ name: "menu" })}>Back</Btn></div></Panel></div>;
}
function ColourPicker({ title, value, setValue, options }: { title: string; value: string; setValue: (value: string) => void; options: string[] }) { return <div><span className="font-pixel text-[8px] text-slate-400">{title}</span><div className="mt-2 flex flex-wrap gap-2">{options.map((colour) => <button key={colour} onClick={() => setValue(colour)} className="h-8 w-8 border-2 border-black" style={{ background: colour, outline: value === colour ? "2px solid #facc15" : "none" }} aria-label={`${title} ${colour}`}/>)}</div></div>; }

function ClubHome({ club, onTab }: { club: UltimateClubState; onTab: (tab: Tab) => void }) { const cards = getSquadCards(club); const rating = Math.round(cards.slice(0,15).reduce((s,c)=>s+c.ovr,0)/15); const claimed = club.challenges.filter(c=>!c.claimed&&c.progress>=c.target).length; return <div className="grid gap-4 lg:grid-cols-3"><Panel className="p-5 lg:col-span-2" accent={club.primary}><Kicker>Your Ultimate XV</Kicker><div className="mt-3 flex flex-wrap gap-2">{cards.slice(0,15).map(c=><CardMini key={c.instanceId} card={c}/>)}</div><div className="mt-5 flex flex-wrap gap-2"><Btn primary onClick={()=>onTab("play")}>Play Squad Battle</Btn><Btn onClick={()=>onTab("squad")}>Edit squad</Btn><Btn onClick={()=>onTab("packs")}>Open packs</Btn></div></Panel><Panel className="p-5"><Kicker>Club record</Kicker><div className="mt-3 grid grid-cols-2 gap-3 text-center"><Stat n={rating} label="OVR"/><Stat n={club.coins} label="COINS"/><Stat n={`${club.wins}-${club.draws}-${club.losses}`} label="W-D-L"/><Stat n={club.cards.length} label="CARDS"/></div><p className="mt-4 text-sm text-slate-400">{claimed ? `${claimed} challenge reward${claimed>1?"s":""} ready to claim.` : "Keep building through matches and challenges."}</p></Panel><Panel className="p-5 lg:col-span-3"><Kicker>Club activity</Kicker><ul className="mt-3 grid gap-1 md:grid-cols-2">{club.log.slice(0,8).map((item,i)=><li key={i} className="border-l-4 border-yellow-400/50 bg-black/30 px-3 py-1 text-sm text-slate-300">{item}</li>)}</ul></Panel></div>; }
function Stat({n,label}:{n:number|string;label:string}){return <div className="border border-white/10 bg-black/30 p-2"><p className="font-pixel text-lg text-yellow-300">{typeof n==="number"?n.toLocaleString():n}</p><p className="font-pixel mt-1 text-[7px] text-slate-400">{label}</p></div>}

function SquadBuilder({ club, busy, onSave, onSell }: { club: UltimateClubState; busy: boolean; onSave: (lineup: string[], bench: string[]) => Promise<void>; onSell: (id: string) => Promise<void> }) {
  const [lineup,setLineup]=useState(club.lineup); const [bench,setBench]=useState(club.bench); const [selected,setSelected]=useState<string|null>(null); const [notice,setNotice]=useState<string|null>(null);
  useEffect(()=>{setLineup(club.lineup);setBench(club.bench)},[club]);
  const byId=new Map(club.cards.map(c=>[c.instanceId,c]));
  const assign=(area:"lineup"|"bench", index:number)=>{if(!selected)return; const target=area==="lineup"?lineup:bench; const sourceLine=lineup.indexOf(selected); const sourceBench=bench.indexOf(selected); const displaced=target[index]; const newLine=[...lineup],newBench=[...bench]; if(sourceLine>=0)newLine[sourceLine]=displaced; else if(sourceBench>=0)newBench[sourceBench]=displaced; if(area==="lineup")newLine[index]=selected;else newBench[index]=selected; setLineup(newLine);setBench(newBench);setNotice("Card moved. Save your matchday 23 when ready.");};
  const squadIds=new Set([...lineup,...bench]);
  const cards=club.cards.filter(card=>!squadIds.has(card.instanceId)).sort((a,b)=>b.ovr-a.ovr);
  return <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]"><Panel className="p-4"><div className="flex items-center justify-between"><Kicker>Matchday 23</Kicker><Btn primary disabled={busy} onClick={()=>void onSave(lineup,bench)}>Save Squad</Btn></div>{notice&&<p className="mt-2 text-sm text-yellow-200">{notice}</p>}<p className="mt-2 text-slate-400">Select a player from the available collection, then click a starter or bench slot to swap them in. The selected 23 are never duplicated in the collection.</p><Kicker className="mt-4">Starting XV</Kicker><div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-5">{lineup.map((id,i)=><SquadSlot key={`l${i}`} label={`#${i+1}`} card={byId.get(id)} selected={selected===id} onClick={()=>selected?assign("lineup",i):setSelected(id)}/>)}</div><Kicker className="mt-4">Bench</Kicker><div className="mt-2 grid grid-cols-4 gap-2 md:grid-cols-8">{bench.map((id,i)=><SquadSlot key={`b${i}`} label={`B${i+1}`} card={byId.get(id)} selected={selected===id} onClick={()=>selected?assign("bench",i):setSelected(id)}/>)}</div></Panel><Panel className="p-4"><Kicker>Available collection · {cards.length} cards</Kicker><p className="mt-2 text-sm text-slate-400">Only cards outside your current starting XV and bench appear here. Select one to move it into your squad.</p><div className="mt-3 grid max-h-[560px] grid-cols-2 gap-2 overflow-y-auto pr-1 scroll md:grid-cols-3">{cards.map(card=><button key={card.instanceId} onClick={()=>setSelected(card.instanceId)} className={`text-left ${selected===card.instanceId?"outline outline-2 outline-yellow-300":""}`}><CardMini card={card} detail onSell={()=>{void onSell(card.instanceId);}}/></button>)}{cards.length===0&&<p className="col-span-full border border-white/10 p-4 text-center text-slate-500">Every owned card is in your matchday 23. Open a pack to grow the collection.</p>}</div></Panel></div>; }
function SquadSlot({label,card,selected,onClick}:{label:string;card?:UltimateCard;selected:boolean;onClick:()=>void}){
  const team=card?findTeam(card.teamId):undefined;
  return <button onClick={onClick} className={`min-h-[104px] border-2 p-1 text-left ${selected?"border-yellow-300 bg-yellow-400/10":"border-white/10 bg-black/30 hover:border-white/40"}`}>{card?<><div className="flex items-start gap-1"><PlayerSprite jersey={team?.primary??"#475569"} jersey2={team?.secondary??"#f8fafc"} number={card.position} name={card.name} scale={1.2} view="front"/><div className="min-w-0 flex-1"><div className="flex justify-between"><span className="font-pixel text-[7px] text-slate-400">{label}</span><span className="font-pixel text-[8px] text-yellow-300">{card.ovr}</span></div><p className="mt-1 truncate text-sm font-bold">{card.name}</p><p className="truncate text-[10px] text-slate-400">{card.clubName??card.teamName}</p><p className="truncate text-[10px] text-slate-500">{card.country}</p></div></div></>:<span className="text-slate-500">{label} EMPTY</span>}</button>
}

function PackRoom({club,busy,onOpen}:{club:UltimateClubState;busy:boolean;onOpen:(id:PackId)=>Promise<void>}){return <div className="grid gap-4 lg:grid-cols-[1fr_.9fr]"><Panel className="p-5"><Kicker>Packs</Kicker><p className="mt-2 text-slate-300">Open packs using match coins. Any 80+ pull gets a full walkout reveal.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{PACKS.map(pack=><div key={pack.id} className="border-2 p-4" style={{borderColor:pack.color,background:`${pack.color}18`}}><p className="font-pixel text-[9px]" style={{color:pack.color}}>{pack.name}</p><p className="mt-2 text-slate-300">{pack.description}</p><p className="mt-3 font-pixel text-sm text-yellow-300">{pack.cost.toLocaleString()} COINS</p><Btn primary className="mt-3 w-full !text-[8px]" disabled={busy||club.coins<pack.cost} onClick={()=>void onOpen(pack.id)}>Open pack</Btn></div>)}</div></Panel><Panel className="p-5"><Kicker>Quick sell</Kicker><p className="mt-2 text-slate-400">Sell spare players from the <b className="text-slate-200">Squad</b> tab’s available collection for their estimated coin value. Players in your starting XV or bench are protected and cannot be sold.</p><p className="mt-3 text-sm text-slate-300">Values scale with OVR: bronze ~30–100c, silver ~150–450c, gold ~500–1,700c, elite 1,900c+.</p></Panel></div>}
function PackReveal({cards,index,onNext}:{cards:UltimateCard[];index:number;onNext:()=>void}){
  const card=cards[index];
  const walkout=card.ovr>=80;
  const team=findTeam(card.teamId);
  const jersey=team?.primary ?? (walkout?"#6d28d9":"#475569");
  const jersey2=team?.secondary ?? "#f8fafc";
  const rarity=walkout?"#facc15":card.rarity==="gold"?"#facc15":card.rarity==="silver"?"#94a3b8":"#b7791f";
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-6"><div className={`pack-reveal relative w-[560px] max-w-full p-8 text-center ${walkout?"elite":""}`} style={{borderColor:rarity}}>
    <p className="font-pixel text-[9px] uppercase text-slate-400">{walkout?"WALKOUT! 80+ PLAYER":"PACK REVEAL"}</p>
    {walkout&&<p className="font-pixel mt-3 blink text-xs text-yellow-300">ELITE CARD INCOMING</p>}
    <div className="mx-auto mt-5 flex w-full max-w-md items-center gap-5 border-4 bg-gradient-to-b from-slate-800 to-slate-950 p-5 text-left" style={{borderColor:rarity}}>
      <div className="grid h-36 w-28 shrink-0 place-items-end overflow-hidden border-2 border-white/20 bg-black/35"><PlayerSprite jersey={jersey} jersey2={jersey2} number={card.position} name={card.name} scale={4} view="front" /></div>
      <div className="min-w-0 flex-1"><div className="flex items-start justify-between"><div><p className="font-pixel text-4xl" style={{color:rarity}}>{card.ovr}</p><p className="font-pixel mt-1 text-[8px] text-slate-400">{card.positionName.toUpperCase()}</p></div><span className="font-pixel text-[8px] uppercase" style={{color:rarity}}>{card.rarity}</span></div><p className="mt-4 truncate text-2xl font-black uppercase">{card.name}</p><p className="mt-2 text-slate-200"><span className="text-slate-500">CLUB </span>{card.clubName??card.teamName}</p><p className="text-slate-200"><span className="text-slate-500">COUNTRY </span>{card.country}</p></div>
    </div>
    <div className="mx-auto mt-4 grid max-w-md grid-cols-4 gap-1 text-left text-sm">{Object.entries(card.ratings).map(([k,v])=><span key={k} className="border border-white/10 bg-black/30 px-2 py-1"><b style={{color:rarity}}>{v}</b> {k.toUpperCase().slice(0,4)}</span>)}</div>
    <p className="mt-5 text-slate-400">Card {index+1} of {cards.length}</p><Btn primary className="mt-4" onClick={onNext}>{index<cards.length-1?"Reveal next card":"Add to club"}</Btn>
  </div></div>
}

function Challenges({club,busy,onClaim}:{club:UltimateClubState;busy:boolean;onClaim:(id:any)=>Promise<void>}){return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{club.challenges.map(ch=>{const complete=ch.progress>=ch.target;return <Panel key={ch.id} className="p-5" accent={complete&&!ch.claimed?"#facc15":undefined}><Kicker>{ch.claimed?"Claimed":complete?"Completed":"Objective"}</Kicker><h3 className="font-pixel mt-2 text-sm uppercase">{ch.title}</h3><p className="mt-2 text-slate-300">{ch.description}</p><div className="mt-4 h-3 border border-white/20 bg-black/50"><div className="h-full bg-yellow-400" style={{width:`${Math.min(100,ch.progress/ch.target*100)}%`}}/></div><p className="mt-2 text-sm text-slate-400">{ch.progress}/{ch.target} · reward <b className="text-yellow-300">{ch.reward} coins</b></p>{!ch.claimed&&<Btn primary className="mt-4" disabled={!complete||busy} onClick={()=>void onClaim(ch.id)}>Claim reward</Btn>}</Panel>})}</div>}

function SeasonHub({club,busy,onPlayNext,onOnline}:{club:UltimateClubState;busy:boolean;onPlayNext:()=>void;onOnline:(username:string)=>Promise<void>}){
  const [opponent,setOpponent]=useState("");
  const league=club.league!;
  const division=DIVISIONS[league.divisionIndex];
  const table=leagueTable(club);
  const match=currentLeagueMatch(club);
  const userPos=table.findIndex(e=>e.isUser)+1;
  const oppIndex=match?(match.home===-1?match.away:match.home)-1:null;
  return <div className="grid gap-4 lg:grid-cols-3">
    <Panel className="p-5 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><Kicker>{division.name} · Season {league.season}</Kicker><span className="font-pixel text-[8px] text-slate-400">Tier {division.tier} · Round {Math.min(league.round+1,league.rounds.length)}/{league.rounds.length}</span></div>
      <p className="mt-2 text-slate-300">Finish top 2 to earn promotion toward the URC Super League. Bottom 2 are relegated. Every league result pays coins.</p>
      {league.promotion==="up"&&<p className="mt-2 border border-green-400/60 bg-green-950/40 p-2 text-green-300">PROMOTED last season!</p>}
      {league.promotion==="down"&&<p className="mt-2 border border-red-400/60 bg-red-950/40 p-2 text-red-300">Relegated last season. Climb back up!</p>}
      <div className="mt-4 overflow-hidden border border-white/10">
        <table className="w-full text-sm"><thead className="font-pixel text-[7px] uppercase text-slate-500"><tr><th className="px-2 py-1 text-left">#</th><th className="text-left">Club</th><th className="text-right">P</th><th className="text-right">W</th><th className="text-right">D</th><th className="text-right">L</th><th className="text-right">PF</th><th className="text-right">PA</th><th className="px-2 text-right">Pts</th></tr></thead>
          <tbody className="divide-y divide-white/5">{table.map((row,i)=><tr key={row.teamKey} className={row.isUser?"bg-yellow-400/10":i<2?"bg-green-400/5":i>=table.length-2?"bg-red-400/5":""}><td className="px-2 py-1 text-slate-400">{i+1}</td><td className={row.isUser?"font-bold text-yellow-300":""}>{row.name}</td><td className="text-right tabular-nums">{row.played}</td><td className="text-right tabular-nums">{row.won}</td><td className="text-right tabular-nums">{row.drawn}</td><td className="text-right tabular-nums">{row.lost}</td><td className="text-right tabular-nums">{row.pf}</td><td className="text-right tabular-nums">{row.pa}</td><td className="px-2 text-right font-bold tabular-nums text-yellow-300">{row.pts}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {match?<>
          <span className="text-slate-300">Next: {club.clubName} v {oppIndex!==null?club.league!.opponents[oppIndex].name:""}</span>
          <Btn primary disabled={busy} onClick={onPlayNext}>Play league match</Btn>
        </>:<span className="font-pixel text-sm text-yellow-300">Season complete — final position {userPos}</span>}
      </div>
    </Panel>
    <Panel className="p-5"><Kicker>Ultimate Online</Kicker><p className="mt-2 text-slate-300">Invite another user by username to play with both players’ saved Ultimate squads.</p><input className="px-input mt-4" placeholder="Opponent username" value={opponent} onChange={e=>setOpponent(e.target.value)} autoCapitalize="none"/><Btn primary className="mt-3 w-full !text-[8px]" disabled={busy||!opponent.trim()} onClick={()=>void onOnline(opponent)}>Invite Ultimate opponent</Btn><p className="mt-3 text-sm text-slate-500">Your selected matchday 23 is locked into the invite when it is sent.</p></Panel>
  </div>;
}

function CardMini({card,detail=false,onSell}:{card:UltimateCard;detail?:boolean;onSell?:()=>void}){
  const rarity={bronze:"#b7791f",silver:"#94a3b8",gold:"#facc15",elite:"#a78bfa"}[card.rarity];
  const sourceTeam=findTeam(card.teamId);
  const jersey=sourceTeam?.primary ?? (card.rarity==="elite"?"#6d28d9":card.rarity==="gold"?"#a16207":card.rarity==="silver"?"#64748b":"#854d0e");
  const jersey2=sourceTeam?.secondary ?? "#f8fafc";
  const club=card.clubName ?? card.teamName;
  const value=cardValue(card);
  return <div className="relative min-w-0 overflow-hidden border-2 bg-gradient-to-b from-slate-800/90 to-black/90 p-2" style={{borderColor:rarity}}>
    <div className="absolute inset-x-0 top-0 h-1" style={{background:rarity}}/>
    <div className="flex items-start gap-1">
      <div className="grid h-11 w-9 shrink-0 place-items-end overflow-hidden border border-white/15 bg-black/40">
        <PlayerSprite jersey={jersey} jersey2={jersey2} number={card.position} name={card.name} scale={1.5} view="front" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-1"><span className="font-pixel text-[7px] text-slate-300">#{card.position}</span><span className="font-pixel text-[10px]" style={{color:rarity}}>{card.ovr}</span></div>
        <p className="mt-1 truncate text-sm font-bold leading-tight">{card.name}</p>
        <p className="font-pixel truncate text-[7px] text-slate-300">{card.positionName.toUpperCase()}</p>
      </div>
    </div>
    <div className="mt-2 border-t border-white/10 pt-1 text-[10px] leading-tight text-slate-300">
      <p className="truncate"><span className="text-slate-500">CLUB </span>{club}</p>
      <p className="truncate"><span className="text-slate-500">COUNTRY </span>{card.country}</p>
    </div>
    {detail&&<div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-0.5 border-t border-white/10 pt-1 text-[9px] text-slate-300"><span>PAC <b className="text-yellow-300">{card.ratings.pace}</b></span><span>STR <b className="text-yellow-300">{card.ratings.strength}</b></span><span>PHY <b className="text-yellow-300">{card.ratings.physicality}</b></span><span>SCR <b className="text-yellow-300">{card.ratings.scrummaging}</b></span><span>TCK <b className="text-yellow-300">{card.ratings.tackling}</b></span><span>HND <b className="text-yellow-300">{card.ratings.handling}</b></span><span>KCK <b className="text-yellow-300">{card.ratings.kicking}</b></span><span>EVA <b className="text-yellow-300">{card.ratings.evasion}</b></span><span>AGI <b className="text-yellow-300">{card.ratings.agility}</b></span><span>LD <b className="text-yellow-300">{card.ratings.leadership}</b></span><span>LO <b className="text-yellow-300">{card.ratings.lineout}</b></span><span>DSC <b className="text-yellow-300">{card.ratings.discipline}</b></span></div>}
    {onSell&&<button type="button" onClick={(e)=>{e.stopPropagation();onSell();}} className="mt-2 w-full border-2 border-yellow-400/70 bg-yellow-400/10 px-2 py-1 font-pixel text-[7px] text-yellow-300 hover:bg-yellow-400/20">QUICK SELL · {value.toLocaleString()}c</button>}
  </div>
}

function ResultOverlay({result,club,opponent,onClose}:{result:MatchResult;club:UltimateClubState;opponent:UltimateOpponent;onClose:()=>void}){const home=ultimateTeamData(club).team;const away=opponentToTeam(opponent).team;return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"><Panel className="max-h-[92vh] w-[1000px] max-w-full overflow-y-auto p-6 scroll"><Kicker>Ultimate match complete</Kicker><h2 className="font-pixel mt-2 text-lg text-yellow-300">{home.short} {result.homeScore} - {result.awayScore} {away.short}</h2><div className="mt-5"><MatchReport result={result} home={home} away={away} homeColor={home.primary} awayColor={away.primary}/></div><Btn primary className="mt-5" onClick={onClose}>Return to Ultimate Team</Btn></Panel></div>}

async function inviteUltimate(ultimateClubId:number,opponentUsername:string):Promise<{recipient?:string;error?:string}>{const res=await fetch("/api/online-friendlies",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({opponentUsername,matchType:"ultimate",ultimateClubId,stadiumId:"twickenham",halfSeconds:150})});return res.json().catch(()=>({error:"Could not send Ultimate invite."}));}
