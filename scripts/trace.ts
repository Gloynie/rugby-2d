import { RugbyEngine } from "../src/game/engine";
import { getTeam } from "../src/game/data";
import type { InputFrame } from "../src/game/types";
const idle: InputFrame = { moveX: 0, moveY: 0, sprint: false, kickHeld: false, passUp: false, passDown: false, kickRelease: false, dropGoal: false, action: false, switchPlayer: false, option1: false, option2: false, option3: false };
const e = new RugbyEngine({ home: getTeam("ire"), away: getTeam("fra"), userTeam: null, halfSeconds: 150, difficulty: "normal" });
let steps = 0;
const acc: Record<string, number> = {};
let passes = 0, kicks = 0, lastFlight = "none", lastCarrier: number | null = null, carries = 0;
let tackleAttempts = 0;
const origAttempt = (e as any).attemptTackle.bind(e);
(e as any).attemptTackle = (t: any, c: any, b: number) => { tackleAttempts++; return origAttempt(t, c, b); };
const stopReasons: Record<string, number> = {};
let lastPhase = e.phase;
while (!e.finished && steps < 60 * 400) {
  e.update(1 / 60, idle); steps++;
  if (e.phase === "play") {
    const b = e.ball;
    const k = b.carrier !== null ? "carried" : b.flight === "pass" ? "passFlight" : b.flight === "kick" ? "kickFlight" : "loose";
    acc[k] = (acc[k] ?? 0) + 1;
    if (b.flight === "pass" && lastFlight !== "pass") passes++;
    if (b.flight === "kick" && lastFlight !== "kick") kicks++;
    if (b.carrier !== null && b.carrier !== lastCarrier) carries++;
    lastFlight = b.flight; lastCarrier = b.carrier;
  }
  if (e.phase === "whistle" && lastPhase !== "whistle") { const m = e.commentary[0]?.split(" – ")[0] ?? "?"; stopReasons[m] = (stopReasons[m] ?? 0) + 1; }
  lastPhase = e.phase;
}
console.log(Object.entries(acc).map(([k, v]) => `${k}=${(v / 60).toFixed(0)}s`).join(" "));
console.log({ passes, kicks, carries, tackleAttempts, score: e.score, tries: e.tries });
console.log(stopReasons);
