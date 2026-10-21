// Deterministic pass benchmark: repeatedly put the ball in a user player's hands mid-pitch
// with teammates alongside, pass, and record what happens to it. Isolates the passing
// system from everything else so changes are measurable.
import { RugbyEngine } from "../src/game/engine";
import { getTeam } from "../src/game/data";
import type { InputFrame } from "../src/game/types";
import { IDLE_INPUT } from "../src/game/input";

const TRIALS = Number(process.env.TRIALS ?? 400);
let completed = 0, forward = 0, nosupport = 0, intercepted = 0, knock = 0, other = 0;
let rs = Number(process.env.SEED ?? 42);
const rng = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };

for (let i = 0; i < TRIALS; i++) {
  const e = new RugbyEngine({ home: getTeam("ire"), away: getTeam("fra"), userTeam: 0, halfSeconds: 300, difficulty: "normal" });
  e.rng = rng;
  // get into open play
  for (let k = 0; k < 240 && e.phase !== "play"; k++) e.update(1 / 60, { ...IDLE_INPUT, action: k === 5 });
  if (e.phase !== "play") { other++; continue; }
  // hand the ball to our fly-half at a realistic attacking spot, with support arranged as the
  // engine's own support AI would have it (let it settle for a moment first)
  const ten = e.pl(0, 10);
  ten.pos.x = 50 + rng() * 20; ten.pos.y = 20 + rng() * 30; ten.down = 0; ten.busy = 0;
  e.giveBallTo(ten);
  for (let k = 0; k < 30; k++) e.update(1 / 60, { ...IDLE_INPUT, moveX: 1 });
  if (e.ball.carrier !== ten.id || e.phase !== "play") { other++; continue; }
  const side = rng() < 0.5;
  const f: InputFrame = { ...IDLE_INPUT, moveX: 1, passUp: side, passDown: !side };
  e.update(1 / 60, f);
  const msg0 = e.commentary[0] ?? "";
  if (/No support/i.test(msg0)) { nosupport++; continue; }
  if (/FORWARD PASS/i.test(msg0) || e.phase !== "play") { forward++; continue; }
  // follow the ball
  let result = "other";
  for (let k = 0; k < 150; k++) {
    e.update(1 / 60, { ...IDLE_INPUT });
    const m = e.commentary[0] ?? "";
    if (/FORWARD PASS/i.test(m)) { result = "forward"; break; }
    if (/KNOCK ON/i.test(m)) { result = "knock"; break; }
    if (e.ball.carrier !== null) { result = e.players[e.ball.carrier].team === 0 ? "completed" : "intercepted"; break; }
    if (e.phase !== "play") { result = "other"; break; }
  }
  if (result === "completed") completed++; else if (result === "intercepted") intercepted++;
  else if (result === "forward") forward++; else if (result === "knock") knock++; else other++;
}
const n = TRIALS;
const pct = (x: number) => `${((x / n) * 100).toFixed(1)}%`;
console.log(`trials=${n}  completed=${pct(completed)}  intercepted=${pct(intercepted)}  forward=${pct(forward)}  nosupport=${pct(nosupport)}  knock=${pct(knock)}  other=${pct(other)}`);
