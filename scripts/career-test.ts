import { applyMatchResult, advanceWeek, createCareer, playerAction, simulateMatch, teamTalk } from "../src/lib/career";
import { getTeam } from "../src/game/data";

// 1. Create a career
let s = createCareer("ire", "sixnations", "tournament");
console.log("Created career. Team:", s.teamId, "Roster:", s.roster.length, "Fixtures:", s.schedule.length);

// 2. Simulate a match
const home = getTeam("ire"), away = getTeam("fra");
const result = simulateMatch(home, away);
console.log("Sim match:", result.homeScore, "-", result.awayScore, "tries", result.homeTries, result.awayTries, "events", result.events.length);

// 3. Apply result
const fixture = s.schedule.find((f) => f.user && !f.played)!;
s = applyMatchResult(s, fixture.id, result, 0);
console.log("After match: events[0]=", s.events[0]?.text);

// 4. Team talk
s = teamTalk(s, "motivate");
console.log("After talk: events[0]=", s.events[0]?.text);

// 5. Player action
s = playerAction(s, 9, "praise");
console.log("After praise: events[0]=", s.events[0]?.text);

// 6. Advance week
s = advanceWeek(s);
console.log("After advance: week=", s.week, "next user fixture=", s.schedule.find((f) => f.user && !f.played)?.week);

// 7. Play through the whole season
let guard = 0;
while (s.schedule.some((f) => f.user && !f.played) && guard < 20) {
  const fx = s.schedule.find((f) => f.user && !f.played)!;
  const h = getTeam(fx.home), a = getTeam(fx.away);
  const r = simulateMatch(h, a);
  s = applyMatchResult(s, fx.id, r, fx.home === s.teamId ? 0 : 1);
  s = advanceWeek(s);
  guard++;
}
const finalStanding = s.standings.find((st) => st.teamId === s.teamId);
const pos = s.standings.indexOf(finalStanding!) + 1;
console.log("Final season: pos", pos, "pts", finalStanding?.pts, "W/D/L", finalStanding?.w, finalStanding?.d, finalStanding?.l);
console.log("CAREER OK");
