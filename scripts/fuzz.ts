import { RugbyEngine } from "../src/game/engine";
import { getTeam } from "../src/game/data";
import type { InputFrame, Difficulty } from "../src/game/types";

function rnd(p: number) { return Math.random() < p; }
const diffs: Difficulty[] = ["easy", "normal", "hard"];
const pairs: [string, string][] = [["eng", "nzl"], ["rsa", "arg"], ["bath", "saracens"], ["chiefs", "crusaders"], ["wal", "sco"]];
let totalTries = 0, totalEvents = 0;
for (let m = 0; m < 5; m++) {
  const [h, a] = pairs[m];
  const e = new RugbyEngine({ home: getTeam(h), away: getTeam(a), userTeam: m % 2 === 0 ? 0 : 1, halfSeconds: 90, difficulty: diffs[m % 3] });
  let steps = 0; let kickHeld = false; let holdLeft = 0;
  const phases: Record<string, number> = {};
  while (!e.finished && steps < 60 * 600) {
    if (holdLeft > 0) { holdLeft--; if (holdLeft === 0) kickHeld = false; }
    else if (rnd(0.01)) { kickHeld = true; holdLeft = 10 + Math.floor(Math.random() * 60); }
    const f: InputFrame = {
      moveX: rnd(0.7) ? (rnd(0.6) ? 1 : -1) : 0, moveY: rnd(0.5) ? (rnd(0.5) ? 1 : -1) : 0,
      sprint: rnd(0.5), kickHeld, passUp: rnd(0.02), passDown: rnd(0.02), kickRelease: !kickHeld && rnd(0.01),
      dropGoal: rnd(0.003), action: rnd(0.05), switchPlayer: rnd(0.01), option1: rnd(0.05), option2: rnd(0.05), option3: rnd(0.05),
    };
    e.update(1 / 60, f); steps++;
    phases[e.phase] = (phases[e.phase] ?? 0) + 1;
    for (const p of e.players) if (!Number.isFinite(p.pos.x + p.pos.y)) throw new Error("NaN player");
    if (!Number.isFinite(e.ball.pos.x + e.ball.pos.y + e.ball.pos.z)) throw new Error("NaN ball");
    if (e.controlled >= 0 && e.players[e.controlled].team !== e.userTeam) throw new Error("controlled wrong team");
  }
  if (!e.finished) throw new Error("did not finish: phase " + e.phase + " " + JSON.stringify(phases));
  const r = e.result(); totalTries += r.homeTries + r.awayTries; totalEvents += r.events.length;
  console.log(`${h} ${r.homeScore}-${r.awayScore} ${a} user=${e.userTeam} diff=${diffs[m % 3]} steps=${steps} phases=${Object.keys(phases).join(",")}`);
}
console.log("FUZZ OK tries=", totalTries, "events=", totalEvents);
