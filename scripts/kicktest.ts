// Kicking skill benchmark: simulate a real player with imperfect timing on both meters and
// report the conversion rate by distance. sigma is the player's timing error (0..1 of the bar).
import { RugbyEngine } from "../src/game/engine";
import { getTeam } from "../src/game/data";
import { IDLE_INPUT } from "../src/game/input";

const gauss = (() => { let s = 98765; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; return () => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r()); })();

function kick(dist: number, sigma: number): boolean {
  const e = new RugbyEngine({ home: getTeam("ire"), away: getTeam("fra"), userTeam: 0, halfSeconds: 300, difficulty: "normal" });
  (e as any).setupGoalKick(0, e.wx(0, 110 - dist), 35, "penalty");
  const gk = e.goalKick!;
  const m = gk.meter!;
  // The player aims for the centre of the green zone but is out by ~N(sigma).
  const aimTarget = Math.min(0.98, Math.max(0.02, 0.5 + gauss() * sigma));
  for (let i = 0; i < 4000 && !gk.launched && !e.finished; i++) {
    e.update(1 / 60, IDLE_INPUT);
    if (m.stage === "power") {
      // power: stop once the bar is past the marker (with timing error)
      if (m.value >= Math.min(0.99, gk.requiredPower + gauss() * sigma)) e.update(1 / 60, { ...IDLE_INPUT, action: true });
    } else if (m.stage === "accuracy") {
      if (Math.abs(m.value - aimTarget) < 0.01) e.update(1 / 60, { ...IDLE_INPUT, action: true });
    }
  }
  const before = e.score[0];
  for (let i = 0; i < 400 && !e.finished; i++) e.update(1 / 60, IDLE_INPUT);
  return e.score[0] > before;
}

const N = 40;
for (const sigma of [0.05, 0.1, 0.18]) {
  const line: string[] = [];
  for (const d of [22, 30, 38, 45, 52]) {
    let made = 0;
    for (let i = 0; i < N; i++) if (kick(d, sigma)) made++;
    line.push(`${d}m ${Math.round((made / N) * 100)}%`);
  }
  console.log(`timing error ±${sigma.toFixed(2)}: ${line.join("  ")}`);
}
console.log("KICK_TEST_OK");
