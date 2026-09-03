/* Headless AI-vs-AI simulation to sanity check the engine. Run: node scripts/run-sim.mjs */
import { RugbyEngine } from "../src/game/engine";
import { getTeam } from "../src/game/data";
import type { InputFrame } from "../src/game/types";

const idle: InputFrame = {
  moveX: 0, moveY: 0, sprint: false, kickHeld: false, passUp: false, passDown: false,
  kickRelease: false, dropGoal: false, action: false, switchPlayer: false,
  option1: false, option2: false, option3: false,
};

function run(homeId: string, awayId: string, halfSeconds: number, verbose: boolean) {
  const engine = new RugbyEngine({
    home: getTeam(homeId),
    away: getTeam(awayId),
    userTeam: null,
    halfSeconds,
    difficulty: "normal",
  });
  const phases: Record<string, number> = {};
  let steps = 0;
  let lastMsg = "";
  const maxSteps = 60 * (halfSeconds * 2 + 400);
  let maxBallX = -1;
  let minBallX = 999;
  while (!engine.finished && steps < maxSteps) {
    engine.update(1 / 60, idle);
    steps++;
    phases[engine.phase] = (phases[engine.phase] ?? 0) + 1;
    maxBallX = Math.max(maxBallX, engine.ball.pos.x);
    minBallX = Math.min(minBallX, engine.ball.pos.x);
    if (verbose && engine.commentary[0] && engine.commentary[0] !== lastMsg) {
      lastMsg = engine.commentary[0];
      console.log(`[${engine.gameClock()}] ${lastMsg}`);
    }
    for (const p of engine.players) {
      if (!Number.isFinite(p.pos.x) || !Number.isFinite(p.pos.y)) throw new Error(`NaN position for ${p.name}`);
    }
    if (!Number.isFinite(engine.ball.pos.x)) throw new Error("NaN ball");
  }
  const r = engine.result();
  console.log(
    `${homeId} ${r.homeScore} - ${r.awayScore} ${awayId} | tries ${r.homeTries}-${r.awayTries} | finished=${engine.finished} steps=${steps} ballX[${minBallX.toFixed(1)}, ${maxBallX.toFixed(1)}]`,
  );
  console.log("phases:", Object.entries(phases).map(([k, v]) => `${k}=${(v / 60).toFixed(0)}s`).join(" "));
  console.log("events:", r.events.map((e) => `${e.minute}' ${e.type} ${e.player} (${e.team})`).join(", "));
  if (!engine.finished) throw new Error("Match did not finish");
  return r;
}

const verbose = process.argv.includes("-v");
run("ire", "fra", 150, verbose);
run("nzl", "rsa", 150, false);
run("leinster", "bulls", 120, false);
run("eng", "por", 120, false);
console.log("OK");
