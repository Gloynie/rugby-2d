"use client";

import type { MatchResult, TeamData } from "@/game/types";
import { Kicker, Panel } from "./ui";

const REPORT_ROWS: { key: keyof MatchResult["stats"][0]; label: string; format?: (value: number, total?: number) => string }[] = [
  { key: "tries", label: "Tries" },
  { key: "penalties", label: "Penalty goals" },
  { key: "dropGoals", label: "Drop goals" },
  { key: "conversions", label: "Conversions" },
  { key: "scrumsWon", label: "Scrums won" },
  { key: "lineoutsWon", label: "Lineouts won" },
  { key: "tackles", label: "Tackles made" },
  { key: "lineBreaks", label: "Line breaks" },
  { key: "metresMade", label: "Metres made", format: (value) => `${Math.round(value)}m` },
  { key: "passes", label: "Passes" },
  { key: "possessionSeconds", label: "Possession", format: (value, total) => `${Math.round((value / Math.max(1, total ?? 1)) * 100)}%` },
  { key: "territorySeconds", label: "Territory", format: (value, total) => `${Math.round((value / Math.max(1, total ?? 1)) * 100)}%` },
];

const percentageTotal = (result: MatchResult, key: "possessionSeconds" | "territorySeconds") =>
  result.stats[0][key] + result.stats[1][key];

export default function MatchReport({ result, home, away, homeColor, awayColor }: { result: MatchResult; home: TeamData; away: TeamData; homeColor: string; awayColor: string }) {
  const [homeStats, awayStats] = result.stats;
  const ratings0 = result.playerRatings.filter((p) => p.team === 0);
  const ratings1 = result.playerRatings.filter((p) => p.team === 1);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="p-4">
        <Kicker>Match stats</Kicker>
        <div className="mt-3 space-y-1">
          {REPORT_ROWS.map((row) => {
            const total = row.key === "possessionSeconds" || row.key === "territorySeconds" ? percentageTotal(result, row.key) : undefined;
            const h = homeStats[row.key] as number;
            const a = awayStats[row.key] as number;
            const print = row.format ?? ((value: number) => String(value));
            return (
              <div key={row.key} className="grid grid-cols-[48px_1fr_48px] items-center gap-2 text-sm">
                <span className="text-right font-bold tabular-nums" style={{ color: h > a ? homeColor : "#cbd5e1" }}>{print(h, total)}</span>
                <span className="text-center text-slate-400">{row.label}</span>
                <span className="font-bold tabular-nums" style={{ color: a > h ? awayColor : "#cbd5e1" }}>{print(a, total)}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between border-t border-white/10 pt-2 font-pixel text-[8px]">
          <span style={{ color: homeColor }}>{home.short}</span>
          <span className="text-slate-500">TEAM TOTALS</span>
          <span style={{ color: awayColor }}>{away.short}</span>
        </div>
      </Panel>

      <Panel className="p-4">
        <Kicker>Player ratings /10</Kicker>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <RatingList title={home.short} color={homeColor} ratings={ratings0} />
          <RatingList title={away.short} color={awayColor} ratings={ratings1} />
        </div>
      </Panel>
    </div>
  );
}

function RatingList({ title, color, ratings }: { title: string; color: string; ratings: MatchResult["playerRatings"] }) {
  return (
    <div>
      <p className="font-pixel mb-1 text-[8px]" style={{ color }}>{title}</p>
      <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1 scroll">
        {ratings.map((p) => (
          <div key={p.id} className="grid grid-cols-[20px_1fr_28px] gap-1 border-b border-white/5 py-1 text-xs">
            <span className="text-slate-500">{p.number}</span>
            <span className="truncate text-slate-200">{p.name}</span>
            <span className={`font-pixel text-[8px] ${p.rating >= 8 ? "text-green-300" : p.rating < 5.5 ? "text-red-300" : "text-yellow-200"}`}>{p.rating.toFixed(1)}</span>
          </div>
        ))}
        {ratings.length === 0 && <p className="text-sm text-slate-500">No ratings available.</p>}
      </div>
    </div>
  );
}
