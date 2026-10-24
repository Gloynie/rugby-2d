"use client";

import type { Stadium, TeamData } from "@/game/types";
import { Flag, flagFor } from "./Flags";

/** Approximate centre of each rugby nation we ship, in degrees. */
const COORDS: Record<string, { lat: number; lon: number }> = {
  england: { lat: 52.5, lon: -1.5 }, france: { lat: 46.5, lon: 2.5 }, ireland: { lat: 53.2, lon: -8 },
  italy: { lat: 42.8, lon: 12.5 }, scotland: { lat: 56.5, lon: -4 }, wales: { lat: 52.3, lon: -3.7 },
  "new zealand": { lat: -41.5, lon: 172.8 }, "south africa": { lat: -29, lon: 24 },
  australia: { lat: -25, lon: 134 }, argentina: { lat: -35, lon: -64 }, japan: { lat: 36, lon: 138 },
  fiji: { lat: -18, lon: 178 }, georgia: { lat: 42, lon: 43.5 }, samoa: { lat: -13.6, lon: -172.5 },
  tonga: { lat: -21, lon: -175 }, portugal: { lat: 39.5, lon: -8 }, "pacific islands": { lat: -15, lon: -170 },
};

const SIZE = 240;
const R = 104;
const CX = SIZE / 2;
const CY = SIZE / 2;

/** Orthographic projection of a lat/lon onto the globe, facing the marked point. */
function project(lat: number, lon: number, centreLat: number, centreLon: number): { x: number; y: number; visible: boolean } {
  const φ1 = (centreLat * Math.PI) / 180;
  const λ0 = (centreLon * Math.PI) / 180;
  const φ = (lat * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;
  const cosc =
    Math.sin(φ1) * Math.sin(φ) + Math.cos(φ1) * Math.cos(φ) * Math.cos(λ - λ0);
  if (cosc < 0.08) return { x: 0, y: 0, visible: false };
  const x = R * Math.cos(φ) * Math.sin(λ - λ0);
  const y = -R * (Math.cos(φ1) * Math.sin(φ) - Math.sin(φ1) * Math.cos(φ) * Math.cos(λ - λ0));
  return { x: CX + x, y: CY + y, visible: true };
}

/**
 * A globe showing where the highlighted team comes from, plus its home ground. All rugby
 * nations are plotted, so switching team visibly swings the marker around the world.
 */
export function GlobePanel({ team, stadium }: { team: TeamData; stadium: Stadium | null }) {
  const c = COORDS[team.country.toLowerCase()] ?? { lat: 0, lon: 0 };
  const marker = project(c.lat, c.lon, c.lat, c.lon);
  const others = Object.entries(COORDS).filter(([name]) => name !== team.country.toLowerCase());

  return (
    <aside className="flex flex-col gap-3 border-2 border-black bg-black/55 p-4 shadow-[3px_3px_0_#000]">
      <div className="flex items-center gap-2.5">
        <Flag id={flagFor(team.country)} size={34} title={team.country} />
        <div className="min-w-0">
          <p className="font-pixel truncate text-[10px] uppercase leading-tight">{team.name}</p>
          <p className="truncate text-sm text-slate-400">{team.country}</p>
        </div>
      </div>

      <div className="relative mx-auto">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="overflow-visible">
          <defs>
            <radialGradient id="globeFill" cx="35%" cy="30%">
              <stop offset="0%" stopColor="#123a5c" />
              <stop offset="70%" stopColor="#0a1c30" />
              <stop offset="100%" stopColor="#050d18" />
            </radialGradient>
            <clipPath id="globeClip">
              <circle cx={CX} cy={CY} r={R} />
            </clipPath>
          </defs>

          <circle cx={CX} cy={CY} r={R + 6} fill="rgba(74,222,128,0.10)" />
          <circle cx={CX} cy={CY} r={R} fill="url(#globeFill)" stroke="rgba(148,163,184,0.5)" strokeWidth="1.5" />

          <g clipPath="url(#globeClip)">
            {/* graticule */}
            {[-60, -30, 0, 30, 60].map((lat) => {
              const y = CY - R * Math.sin((lat * Math.PI) / 180);
              const w = Math.sqrt(Math.max(0, R * R - (y - CY) ** 2));
              return <line key={`lat${lat}`} x1={CX - w} y1={y} x2={CX + w} y2={y} stroke="rgba(148,163,184,0.22)" strokeWidth="1" />;
            })}
            {[0, 45, 90, 135].map((lon) => {
              const rx = Math.abs(R * Math.cos((lon * Math.PI) / 180));
              return <ellipse key={`lon${lon}`} cx={CX} cy={CY} rx={Math.max(0.5, rx)} ry={R} fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth="1" />;
            })}

            {/* other rugby nations */}
            {others.map(([name, co]) => {
              const p = project(co.lat, co.lon, c.lat, c.lon);
              if (!p.visible) return null;
              return <circle key={name} cx={p.x} cy={p.y} r="2.2" fill="rgba(203,213,225,0.55)" />;
            })}

            {/* the selected nation */}
            <circle cx={marker.x} cy={marker.y} r="10" fill="rgba(250,204,21,0.22)" />
            <circle cx={marker.x} cy={marker.y} r="5" fill="#facc15" stroke="#000" strokeWidth="1.2" />
          </g>

          {/* spinning highlight so the globe reads as animated */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(250,204,21,0.55)" strokeWidth="2" strokeDasharray="4 10">
            <animateTransform attributeName="transform" type="rotate" from={`0 ${CX} ${CY}`} to={`360 ${CX} ${CY}`} dur="18s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      <div className="border-t border-white/10 pt-2">
        <p className="font-pixel text-[7px] uppercase tracking-widest text-slate-400">Home ground</p>
        <p className="mt-1 text-base leading-snug text-slate-200">
          {stadium ? `${stadium.name.split(",")[0]} · ${stadium.city}` : "Neutral venues"}
        </p>
        {stadium && <p className="text-sm text-slate-500">{stadium.capacity.toLocaleString()} capacity</p>}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-2">
        <span className="font-pixel text-[7px] uppercase tracking-widest text-slate-400">Overall</span>
        <span className="font-pixel text-[14px] text-yellow-300">{team.rating}</span>
      </div>
    </aside>
  );
}
