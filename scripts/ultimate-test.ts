import { RugbyEngine } from "../src/game/engine";
import { IDLE_INPUT } from "../src/game/input";
import {
  createAiOpponent,
  createUltimateClub,
  getSquadCards,
  openPack,
  opponentToTeam,
  quickSell,
  recordUltimateResult,
  startCup,
  ultimateTeamData,
} from "../src/lib/ultimate";

let club = createUltimateClub("Test Broncos");
const starterOvr = Math.round(getSquadCards(club).slice(0, 15).reduce((sum, card) => sum + card.ovr, 0) / 15);
console.log("starter squad", getSquadCards(club).length, "cards, OVR", starterOvr, "coins", club.coins);
if (getSquadCards(club).length !== 23 || starterOvr > 60) throw new Error("starter club should be a low-rated 23");

const packed = openPack(club, "bronze");
if (packed.error || !packed.cards) throw new Error(packed.error ?? "bronze pack failed");
club = packed.state;
console.log("bronze pack", packed.cards.map((card) => `${card.name} ${card.ovr}`).join(", "));

const ai = createAiOpponent("silver", 1122);
const home = ultimateTeamData(club);
const away = opponentToTeam(ai);
const engine = new RugbyEngine({
  home: home.team,
  away: away.team,
  userTeam: null,
  halfSeconds: 35,
  difficulty: "normal",
  homePlayerOverrides: home.overrides,
  awayPlayerOverrides: away.overrides,
});
let steps = 0;
while (!engine.finished && steps < 20000) { engine.update(1 / 60, IDLE_INPUT); steps++; }
if (!engine.finished) throw new Error("Ultimate Team engine match did not finish");
const result = engine.result();
console.log("UT match", result.homeScore, "-", result.awayScore, "ratings", result.playerRatings.length, "stats", result.stats[0].passes + result.stats[1].passes);
if (result.playerRatings.length !== 30) throw new Error("expected ratings for both Ultimate starting XVs");
const reward = recordUltimateResult(club, result, "friendly");
club = reward.state;
console.log("reward", reward.reward, "coins", club.coins, "record", `${club.wins}-${club.draws}-${club.losses}`);

const cup = startCup(club);
if (cup.error || !cup.state.cup) throw new Error(cup.error ?? "cup start failed");
const activeCup = cup.state.cup;
club = cup.state;
console.log("cup", activeCup.stage, "vs", activeCup.opponent.name);
const sellCandidates = club.cards.filter((card) => !club.lineup.includes(card.instanceId) && !club.bench.includes(card.instanceId)).slice(0, 1);
if (sellCandidates.length) {
  const sold = quickSell(club, sellCandidates.map((card) => card.instanceId));
  if (sold.error) throw new Error(sold.error);
  console.log("traded", sellCandidates.length, "for", sold.coinsEarned);
}
console.log("ULTIMATE_TEST_OK");
