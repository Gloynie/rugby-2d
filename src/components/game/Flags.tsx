"use client";

/**
 * Procedural SVG flags + national crests. Drawn in code (no image assets) so every nation
 * gets a crisp flag at any size, in the game's flat pixel-friendly style.
 * Designs follow the real national flags as closely as a 30x20 grid allows.
 */

export type FlagId =
  | "england" | "france" | "ireland" | "italy" | "scotland" | "wales"
  | "newzealand" | "southafrica" | "australia" | "argentina" | "japan"
  | "fiji" | "georgia" | "samoa" | "tonga" | "portugal" | "pacific" | "default";

/** Country name → flag id. Matches the `country` field on TeamData. */
const COUNTRY_MAP: Record<string, FlagId> = {
  england: "england", france: "france", ireland: "ireland", italy: "italy",
  scotland: "scotland", wales: "wales", "new zealand": "newzealand",
  "south africa": "southafrica", australia: "australia", argentina: "argentina",
  japan: "japan", fiji: "fiji", georgia: "georgia", samoa: "samoa", tonga: "tonga",
  portugal: "portugal", "pacific islands": "pacific",
};

export function flagFor(country: string | undefined): FlagId {
  if (!country) return "default";
  return COUNTRY_MAP[country.trim().toLowerCase()] ?? "default";
}

const W = 30;
const H = 20;

/** Simplified Union Jack for use inside a canton (w x h box at x,y). */
function UnionJack({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#012169" />
      <path d={`M${x} ${y} L${x + w} ${y + h} M${x + w} ${y} L${x} ${y + h}`} stroke="#fff" strokeWidth={w * 0.16} />
      <path d={`M${x} ${y} L${x + w} ${y + h} M${x + w} ${y} L${x} ${y + h}`} stroke="#C8102E" strokeWidth={w * 0.05} />
      <rect x={x + w * 0.38} y={y} width={w * 0.24} height={h} fill="#fff" />
      <rect x={x} y={y + h * 0.36} width={w} height={h * 0.28} fill="#fff" />
      <rect x={x + w * 0.43} y={y} width={w * 0.14} height={h} fill="#C8102E" />
      <rect x={x} y={y + h * 0.41} width={w} height={h * 0.18} fill="#C8102E" />
    </g>
  );
}

function star(cx: number, cy: number, r: number, fill: string, stroke?: string) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return <polygon points={pts.join(" ")} fill={fill} stroke={stroke} strokeWidth={stroke ? 0.5 : 0} />;
}

/** A single flag drawn as inline SVG. `size` sets the width; height follows 3:2. */
export function Flag({ id, size = 30, title }: { id: FlagId; size?: number; title?: string }) {
  const h = Math.round((size * H) / W);
  const svg = (children: React.ReactNode) => (
    <svg
      width={size}
      height={h}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={title ?? id}
      className="shrink-0"
      style={{ display: "block", imageRendering: "pixelated" }}
    >
      {children}
      <rect x="0.4" y="0.4" width={W - 0.8} height={H - 0.8} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="0.8" />
    </svg>
  );

  switch (id) {
    case "france":
      return svg(<><rect width="10" height={H} fill="#002395" /><rect x="10" width="10" height={H} fill="#fff" /><rect x="20" width="10" height={H} fill="#ED2939" /></>);
    case "ireland":
      return svg(<><rect width="10" height={H} fill="#169B62" /><rect x="10" width="10" height={H} fill="#fff" /><rect x="20" width="10" height={H} fill="#FF883E" /></>);
    case "italy":
      return svg(<><rect width="10" height={H} fill="#008C45" /><rect x="10" width="10" height={H} fill="#F4F5F0" /><rect x="20" width="10" height={H} fill="#CD212A" /></>);
    case "portugal":
      // Green 2/5, red 3/5, yellow armillary sphere with the Portuguese shield.
      return svg(<>
        <rect width="12" height={H} fill="#046A38" /><rect x="12" width="18" height={H} fill="#DA291C" />
        <circle cx="12" cy="10" r="4.6" fill="#FFE900" stroke="#000" strokeWidth="0.6" />
        <rect x="10.2" y="6.6" width="3.6" height="6.8" rx="1" fill="#fff" stroke="#DA291C" strokeWidth="0.7" />
        <circle cx="12" cy="8.6" r="0.8" fill="#0247FE" /><circle cx="12" cy="11" r="0.8" fill="#0247FE" />
      </>);
    case "england":
      return svg(<><rect width={W} height={H} fill="#fff" /><rect x="13" width="4" height={H} fill="#CE1124" /><rect y="8" width={W} height="4" fill="#CE1124" /></>);
    case "scotland":
      return svg(<><rect width={W} height={H} fill="#0065BF" /><path d="M0 0 L30 20 M30 0 L0 20" stroke="#fff" strokeWidth="3.6" /></>);
    case "georgia":
      // Five-cross flag: big central cross, four small crosses in the cantons.
      return svg(<>
        <rect width={W} height={H} fill="#fff" />
        <rect x="13" width="4" height={H} fill="#FF0000" /><rect y="8" width={W} height="4" fill="#FF0000" />
        {[[6.5, 4], [23.5, 4], [6.5, 16], [23.5, 16]].map(([cx, cy], i) => (
          <g key={i} fill="#FF0000">
            <rect x={cx - 0.8} y={cy - 2.2} width="1.6" height="4.4" />
            <rect x={cx - 2.2} y={cy - 0.8} width="4.4" height="1.6" />
          </g>
        ))}
      </>);
    case "tonga":
      return svg(<><rect width={W} height={H} fill="#C10000" /><rect width="12" height="10" fill="#fff" /><rect x="5" y="1.5" width="2" height="7" fill="#C10000" /><rect x="2.5" y="4" width="7" height="2" fill="#C10000" /></>);
    case "samoa":
      // Red field, blue canton with the Southern Cross (five white stars).
      return svg(<>
        <rect width={W} height={H} fill="#CE1126" /><rect width="13" height="10" fill="#002B7F" />
        {star(6.5, 7.5, 2.2, "#fff")}
        {star(3, 3, 1.1, "#fff")}{star(10, 3.4, 1.1, "#fff")}{star(9.6, 7, 1.1, "#fff")}{star(4.6, 5.6, 1.1, "#fff")}
      </>);
    case "wales":
      // White over green with a red dragon (stylised silhouette facing the hoist).
      return svg(<>
        <rect width={W} height="10" fill="#fff" /><rect y="10" width={W} height="10" fill="#00A651" />
        <path
          d="M8 14.6 L11 12.4 L13.4 13 L15.6 10.6 L17.8 11 L20.6 9.2 L21.6 10.8 L19.4 12.6 L20.8 13.4 L18.6 14 L18.8 16 L16.8 15.2 L14.8 16.4 L13.4 15 L10.8 15.8 L9.4 15.4 Z"
          fill="#D21034"
        />
        <path d="M20.6 9.2 L23 8 L21.8 10.4 Z" fill="#D21034" />
      </>);
    case "newzealand":
      // Blue ensign: Union canton, four red stars (white fimbriation) on the fly.
      return svg(<>
        <rect width={W} height={H} fill="#00247D" />
        <UnionJack x={0} y={0} w={15} h={10} />
        {star(23, 3.6, 1.9, "#CC0000", "#fff")}
        {star(25.4, 9, 1.9, "#CC0000", "#fff")}
        {star(21.6, 12.4, 1.9, "#CC0000", "#fff")}
        {star(19.8, 16.6, 1.9, "#CC0000", "#fff")}
      </>);
    case "australia":
      // Blue ensign: Union canton, large Federation star below it, Southern Cross on the fly.
      return svg(<>
        <rect width={W} height={H} fill="#00247D" />
        <UnionJack x={0} y={0} w={15} h={10} />
        {star(7.5, 15.4, 3, "#fff")}
        {star(23, 3, 1.6, "#fff")}
        {star(25.6, 7.6, 1.6, "#fff")}
        {star(23.2, 11.6, 1.6, "#fff")}
        {star(21.4, 7.4, 1, "#fff")}
        {star(24.4, 15.4, 1.6, "#fff")}
      </>);
    case "fiji":
      // Light blue ensign: Union canton, Fiji shield on the fly.
      return svg(<>
        <rect width={W} height={H} fill="#68BFE5" />
        <UnionJack x={0} y={0} w={15} h={10} />
        <path d="M19 6 h9 v7 c0 3 -2 4.6 -4.5 5.4 C21 17.6 19 16 19 13 Z" fill="#fff" stroke="#00247D" strokeWidth="0.7" />
        <rect x="19" y="6" width="9" height="2.6" fill="#C8102E" />
        <ellipse cx="23.5" cy="7.3" rx="1.8" ry="0.9" fill="#F7D038" />
        <rect x="22.8" y="8.6" width="1.4" height="8" fill="#C8102E" />
        <rect x="19.8" y="11.4" width="7.4" height="1.4" fill="#C8102E" />
      </>);
    case "pacific":
      return svg(<>
        <rect width={W} height={H} fill="#0E4C92" />
        {[[7, 6], [15, 4], [23, 7], [11, 13], [20, 15]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="1.3" fill="#fff" />
        ))}
      </>);
    case "argentina":
      return svg(<>
        <rect width={W} height="6.7" fill="#74ACDF" /><rect y="6.7" width={W} height="6.6" fill="#fff" /><rect y="13.3" width={W} height="6.7" fill="#74ACDF" />
        <circle cx="15" cy="10" r="2.7" fill="#F6B40E" stroke="#8a5a00" strokeWidth="0.6" />
        <circle cx="15" cy="10" r="1.1" fill="#F6B40E" stroke="#8a5a00" strokeWidth="0.5" />
      </>);
    case "japan":
      return svg(<><rect width={W} height={H} fill="#fff" /><circle cx="15" cy="10" r="5.6" fill="#BC002D" /></>);
    case "southafrica":
      // Red over blue, green Y with gold fimbriation, black hoist triangle.
      return svg(<>
        <rect width={W} height={H} fill="#fff" />
        <rect width={W} height="7" fill="#E03C31" />
        <rect y="13" width={W} height="7" fill="#001489" />
        {/* gold Y, green Y inset inside it, black hoist triangle innermost */}
        <path d="M0 1 L7 1 L13 8.4 L30 8.4 L30 11.6 L13 11.6 L7 19 L0 19 Z" fill="#FFB612" />
        <path d="M0 2.8 L6 2.8 L12 9.3 L30 9.3 L30 10.7 L12 10.7 L6 17.2 L0 17.2 Z" fill="#007749" />
        <path d="M0 4.6 L5 10 L0 15.4 Z" fill="#000" />
      </>);
    default:
      return svg(<><rect width={W} height={H} fill="#334155" /></>);
  }
}

/** Small national crest badge used beside club names and on player cards. */
export function NationBadge({ country, size = 18 }: { country: string; size?: number }) {
  return <Flag id={flagFor(country)} size={size} title={country} />;
}
