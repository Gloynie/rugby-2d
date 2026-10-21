import { RugbyEngine } from "../src/game/engine";
import { getTeam } from "../src/game/data";
import { IDLE_INPUT } from "../src/game/input";
import type { InputFrame } from "../src/game/types";

const setup = (userTeam: 0 | 1 | null, team: 0 | 1 = 0, rng = 0) => {
  const e = new RugbyEngine({ home: getTeam("ire"), away: getTeam("fra"), userTeam, halfSeconds: 300, difficulty: "normal" });
  e.rng = () => rng;
  (e as unknown as { setupLineout(t: 0 | 1, x: number, side: number): void }).setupLineout(team, 62, 0);
  return e;
};
const frame = (patch: Partial<InputFrame> = {}): InputFrame => ({ ...IDLE_INPUT, ...patch });
const wait = (e: RugbyEngine, seconds: number, f = frame()) => {
  for (let i = 0; i < seconds * 60 && !e.finished; i++) e.update(1 / 60, f);
};
const tap = (e: RugbyEngine, f: Partial<InputFrame>) => { e.update(1 / 60, frame(f)); e.update(0.22, frame()); };
const finishLineout = (e: RugbyEngine) => {
  for (let i = 0; i < 600 && e.phase === "lineout"; i++) e.update(1 / 60, frame());
};
const assert = (ok: unknown, msg: string) => { if (!ok) throw new Error(msg); };

// Human calls never auto-expire.
{
  const e = setup(0);
  wait(e, 5);
  assert(e.phase === "lineout" && e.lineout?.stage === "numbers", "human lineout auto-confirmed");
}

// 5 men, front, short: should reach play and keep the ball.
{
  const e = setup(0, 0, 0);
  tap(e, { moveX: -1 }); tap(e, { moveX: -1 }); // 7 -> 5
  assert(e.lineout?.numbers === 5, "numbers selection failed");
  tap(e, { action: true });                      // target stage
  tap(e, { option1: true });                     // front
  tap(e, { action: true });                      // play stage
  tap(e, { option2: true });                     // short
  tap(e, { action: true });                      // ready
  finishLineout(e);
  assert(e.phase === "play", "short lineout did not resume play");
  assert(e.lineout === null, "lineout state not cleared");
  assert(e.ball.carrier !== null && e.players[e.ball.carrier].team === 0, "short ball lost despite guaranteed rng");
  assert(e.teamStats[0].lineoutsWon === 1, "lineout stat not credited");
}

// 7 men, back, maul: number 8 should emerge carrying after gaining ground.
{
  const e = setup(0, 0, 0);
  tap(e, { action: true }); // confirm 7
  tap(e, { option3: true }); tap(e, { action: true }); // back
  tap(e, { option3: true }); tap(e, { action: true }); // maul
  finishLineout(e);
  assert(e.phase === "play", "maul did not resume play");
  assert(e.ball.carrier === e.pl(0, 8).id, "number eight did not emerge from maul");
}

// CPU chooses and resolves without input.
{
  const e = setup(null, 1, 0);
  finishLineout(e);
  assert(e.phase === "play", "CPU lineout did not resolve");
  assert(e.teamStats[1].lineoutsWon === 1, "CPU lineout winner stat missing");
}

// High rng steals the throw.
{
  const e = setup(null, 0, 0.999);
  finishLineout(e);
  assert(e.phase === "play", "stolen lineout did not resume play");
  assert(e.teamStats[1].lineoutsWon === 1, "defence did not get stolen-lineout stat");
  assert(e.ball.carrier !== null && e.players[e.ball.carrier].team === 1, "defence did not receive stolen ball");
}

console.log("LINEOUT_TEST_OK");
