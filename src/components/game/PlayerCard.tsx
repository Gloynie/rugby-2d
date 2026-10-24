"use client";

import { findTeam } from "@/game/data";
import type { UltimateCard } from "@/lib/ultimate";
import { Flag, flagFor } from "./Flags";
import { Crest, PlayerSprite } from "./ui";

/** Tiered looks: each rarity gets its own panel tint, trim and label. */
const TIERS = {
  bronze: { trim: "#b7791f", glow: "rgba(183,121,31,0.35)", panel: "linear-gradient(180deg,#3b2a12 0%,#1a120a 100%)", label: "Bronze" },
  silver: { trim: "#cbd5e1", glow: "rgba(203,213,225,0.35)", panel: "linear-gradient(180deg,#2e3a4a 0%,#111827 100%)", label: "Silver" },
  gold:   { trim: "#facc15", glow: "rgba(250,204,21,0.40)",  panel: "linear-gradient(180deg,#4a3a0a 0%,#1c1506 100%)", label: "Gold" },
  elite:  { trim: "#c4b5fd", glow: "rgba(167,139,250,0.45)", panel: "linear-gradient(180deg,#3b2a6a 0%,#140d2b 100%)", label: "Elite" },
} as const;

/** The six stats shown on the face of the card – forwards and backs show different sets. */
function faceStats(card: UltimateCard): [string, number][] {
  const r = card.ratings;
  return card.position <= 8
    ? [["STR", r.strength], ["SCR", r.scrummaging], ["TCK", r.tackling], ["PHY", r.physicality], ["LNO", r.lineout], ["HND", r.handling]]
    : [["PAC", r.pace], ["EVA", r.evasion], ["HND", r.handling], ["KCK", r.kicking], ["AGI", r.agility], ["TCK", r.tackling]];
}

const POS_TAG = ["", "LH", "HK", "TH", "LK", "LK", "BF", "OF", "N8", "SH", "FH", "LW", "IC", "OC", "RW", "FB"];

interface Props {
  card: UltimateCard;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  onClick?: () => void;
  /** optional footer action (e.g. quick sell) rendered below the card face */
  footer?: React.ReactNode;
}

/**
 * Ultimate Team player card. Portrait layout in the game's pixel chrome:
 * rating + position in the corner, hero sprite on a rarity panel, name plate,
 * six key stats, and club crest + nation along the base.
 */
export default function PlayerCard({ card, size = "md", selected, onClick, footer }: Props) {
  const tier = TIERS[card.rarity];
  const team = findTeam(card.teamId);
  const jersey = team?.primary ?? "#475569";
  const jersey2 = team?.secondary ?? "#f8fafc";
  const dims = size === "lg" ? { w: 190, sprite: 3.2, ovr: 26, name: 9 } : size === "sm" ? { w: 118, sprite: 1.8, ovr: 15, name: 6 } : { w: 150, sprite: 2.4, ovr: 20, name: 7 };
  const stats = faceStats(card);
  const walkout = card.ovr >= 80;

  return (
    <div className="inline-flex flex-col" style={{ width: dims.w }}>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`on-dark group relative w-full overflow-hidden border-2 text-left transition-transform duration-100 ${onClick ? "hover:-translate-y-0.5" : ""} ${selected ? "outline outline-2 outline-offset-2 outline-yellow-300" : ""}`}
        style={{ borderColor: tier.trim, background: tier.panel, boxShadow: `3px 3px 0 #000, 0 0 14px ${tier.glow}` }}
        title={`${card.name} · ${card.positionName} · ${card.clubName ?? card.teamName}`}
      >
        {/* subtle diagonal sheen for gold/elite */}
        {walkout && <span className="pointer-events-none absolute -inset-y-4 -left-10 w-16 rotate-12 bg-white/10" aria-hidden />}

        {/* top row: rating / position + tier label */}
        <div className="flex items-start justify-between px-2 pt-1.5">
          <div className="leading-none">
            <p className="font-pixel" style={{ fontSize: dims.ovr, color: tier.trim, textShadow: "2px 2px 0 #000" }}>{card.ovr}</p>
            <p className="font-pixel mt-1 text-[7px] text-slate-200">{POS_TAG[card.position] ?? card.positionName.slice(0, 2).toUpperCase()}</p>
          </div>
          <span className="font-pixel mt-0.5 text-[6px] uppercase tracking-widest" style={{ color: tier.trim }}>{tier.label}</span>
        </div>

        {/* hero sprite on a dark stage */}
        <div className="relative mx-2 mt-1 flex items-end justify-center border border-black/60 bg-black/35" style={{ height: dims.sprite * 30 }}>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2" style={{ background: `linear-gradient(180deg, transparent, ${tier.glow})` }} aria-hidden />
          <PlayerSprite jersey={jersey} jersey2={jersey2} number={card.position} name={card.name} scale={dims.sprite} view="front" pose="idle" className="relative" />
        </div>

        {/* name plate */}
        <div className="mx-2 mt-1.5 border-y border-white/10 py-1 text-center">
          <p className="font-pixel truncate uppercase text-white" style={{ fontSize: dims.name }}>{card.name}</p>
        </div>

        {/* six stats */}
        <div className="mx-2 mt-1.5 grid grid-cols-3 gap-x-1.5 gap-y-1">
          {stats.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between">
              <span className="font-pixel text-[6px] text-slate-400">{k}</span>
              <span className="font-pixel text-[8px]" style={{ color: v >= 80 ? tier.trim : "#e5e7eb" }}>{v}</span>
            </div>
          ))}
        </div>

        {/* base: crest + nation */}
        <div className="mt-2 flex items-center gap-1.5 border-t border-black/60 bg-black/30 px-2 py-1.5">
          {team ? <Crest team={team} size={14} /> : <span className="h-3.5 w-3.5 bg-slate-600" />}
          <span className="min-w-0 flex-1 truncate font-pixel text-[6px] uppercase text-slate-200">{card.clubName ?? card.teamName}</span>
          <Flag id={flagFor(card.country)} size={14} title={card.country} />
        </div>
      </button>
      {footer}
    </div>
  );
}
