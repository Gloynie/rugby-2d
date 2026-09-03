import { COMPETITIONS } from "../src/game/data";
import { applyUserResult, createTournament, nextUserFixture, tableFor } from "../src/lib/tournament";

for (const comp of COMPETITIONS) {
  const team = comp.teamIds[0];
  let s = createTournament(comp, team);
  let played = 0;
  while (s.stage !== "finished" && played < 60) {
    const n = nextUserFixture(s);
    if (!n) break;
    s = applyUserResult(s, { homeScore: 30, awayScore: 10, homeTries: 4, awayTries: 1 });
    played++;
  }
  const t = tableFor(s, comp.format === "worldcup" ? s.pools![0] : comp.teamIds);
  console.log(`${comp.id}: played=${played} stage=${s.stage} champion=${s.champion} pos=${s.userPosition} ko=${s.knockout.map(k => k.name + ":" + k.fixtures.length).join(",")} top=${t[0].teamId} ${t[0].pts}pts`);
  if (s.stage !== "finished") throw new Error("not finished " + comp.id);
}
// user losing everything
const s0 = createTournament(COMPETITIONS[0], "ire");
let s = s0, played = 0;
while (s.stage !== "finished" && played < 60) { const n = nextUserFixture(s); if (!n) break; s = applyUserResult(s, { homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0 }); played++; }
console.log("draw-all rwc:", played, s.stage, s.userPosition, s.champion);
console.log("TOURNEY OK");
