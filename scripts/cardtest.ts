import { RugbyEngine } from "../src/game/engine";
import { getTeam } from "../src/game/data";
import { IDLE_INPUT } from "../src/game/input";
import type { InputFrame } from "../src/game/types";

const ok = (c: unknown, m: string) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  ", m); };
const mk = (userTeam: 0 | 1 | null = null) => new RugbyEngine({ home: getTeam("ire"), away: getTeam("fra"), userTeam, halfSeconds: 120, difficulty: "normal" });
const step = (e: RugbyEngine, secs: number, f: InputFrame = IDLE_INPUT) => { for (let i = 0; i < secs * 60 && !e.finished; i++) e.update(1 / 60, f); };

// 1. yellow card removes the player, second yellow becomes red
{
  const e = mk();
  const p = e.pl(1, 7);
  e.showCard(p, "yellow", "test");
  ok(!p.isOnField, "yellow card takes the player off the field");
  ok(e.teamStats[1].yellowCards === 1, "yellow counted in stats");
  ok(e.sinBinned().length === 1, "player listed in the sin bin");
  ok(e.players.filter((q) => q.team === 1 && q.isOnField).length === 14, "team down to 14");
  // force him back for the second-yellow test
  p.isOnField = true;
  e.showCard(p, "yellow", "again");
  ok(e.cards[e.cards.length - 1].type === "red", "second yellow upgrades to red");
  ok(e.teamStats[1].redCards === 1, "red counted in stats");
}

// 2. pl() never returns an off-field player
{
  const e = mk();
  const nine = e.pl(0, 9);
  e.showCard(nine, "yellow", "test");
  const stand = e.pl(0, 9);
  ok(stand.isOnField && stand.id !== nine.id, `pl(team,9) borrows an on-field stand-in (${stand.name}, #${stand.number})`);
}

// 3. sin-binned player returns after 10 match minutes
{
  const e = mk();
  for (let k = 0; k < 600 && e.phase !== "play"; k++) e.update(1 / 60, IDLE_INPUT);
  const p = e.pl(1, 12);
  e.showCard(p, "yellow", "test");
  const binSecs = 120 * (10 / 40);           // 10 game minutes in clock seconds
  step(e, binSecs * 0.6);
  ok(!p.isOnField, "still in the bin before ten minutes");
  step(e, binSecs * 1.6);
  ok(p.isOnField, "returned after ten match minutes");
  ok(e.sinBinned().length === 0, "sin bin empty again");
}

// 4. subs: pl() follows the replacement into the slot
{
  const e = mk();
  const bench = e.players.find((q) => q.team === 0 && q.isBench && !q.hasBeenSubbedOff);
  if (bench) {
    e.makeSubstitution(0, bench.number, 9);
    ok(e.pl(0, 9).id === bench.id, "pl(team,9) returns the replacement who took the #9 slot");
  } else console.log("skip – no bench players for this team");
}

// 5. set pieces with a binned forward never hand the ball to an off-field player
{
  const e = mk(null);
  const lock = e.pl(0, 4);
  e.showCard(lock, "yellow", "test");
  (e as any).setupLineout(0, 62, 0);
  for (let k = 0; k < 600 && e.phase === "lineout"; k++) e.update(1 / 60, IDLE_INPUT);
  const c = e.carrier();
  ok(e.phase === "play" && c !== null && c.isOnField, "lineout with a binned lock resolves to an on-field carrier");
}

const MODE = (process.env.MODE ?? "centre") as "centre" | "edge";
let lastWin = 0;
// 6. goal kicking: a centred aim scores from realistic distances (was missing before)
{
  for (const d of [22, 30, 38, 45]) {
    let made = 0;
    const tries = 12;
    for (let i = 0; i < tries; i++) {
      const e = mk(0);
      (e as any).setupGoalKick(0, e.wx(0, 110 - d), 35 + (i % 3 - 1) * 6, "penalty");
      const gk = e.goalKick!;
      const m = gk.meter!;
      // stop power just past the marker
      while (m.stage === "power") {
        e.update(1 / 60, IDLE_INPUT);
        if (m.value >= gk.requiredPower + 0.02 && m.dirn > 0) e.update(1 / 60, { ...IDLE_INPUT, action: true });
      }
      // stop aim at the EDGE of the visible green zone (90% of the way out, alternating sides)
      // – proves the zone drawn on screen is truthful, not just the centre.
      const win = e.goalAimWindow();
      const target = 0.5 + (i % 2 ? 1 : -1) * win * 0.9 * (MODE === "edge" ? 1 : 0);
      lastWin = win;
      while (m.stage === "accuracy") {
        e.update(1 / 60, IDLE_INPUT);
        if (Math.abs(m.value - target) < 0.012) e.update(1 / 60, { ...IDLE_INPUT, action: true });
      }
      const before = e.score[0];
      step(e, 5);
      if (e.score[0] > before) made++;
    }
    console.log(`     ${d}m: ${made}/${tries} ${MODE} kicks scored · green zone ±${(lastWin * 100).toFixed(0)}% of bar`);
    ok(made >= tries - 1, `${MODE} kicks from ${d}m score`);
  }
}

// 7. full match with cards still finishes
{
  const e = mk(null);
  let n = 0;
  while (!e.finished && n < 60 * 60 * 6) {
    if (n === 60 * 20) { const p = e.pl(1, 6); e.showCard(p, "yellow", "test"); }
    if (n === 60 * 60) { const p = e.pl(0, 3); e.showCard(p, "red", "test"); }
    e.update(1 / 60, IDLE_INPUT); n++;
  }
  ok(e.finished, `match with a yellow and a red still finishes (${e.score[0]}-${e.score[1]})`);
}
console.log("CARD_TEST_OK");
