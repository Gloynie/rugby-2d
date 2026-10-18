/**
 * ──────────────────────────────────────────────────────────────────────────
 *  ROSTER OVERRIDES — set a team's exact starting XV here.
 * ──────────────────────────────────────────────────────────────────────────
 *  Anything listed below REPLACES the first 15 players of that team's shipped squad,
 *  in shirt-number order (1 loosehead → 15 fullback). The rest of the squad (bench and
 *  wider group) is kept as-is.
 *
 *  Why a separate file: real team sheets change every week and I cannot fetch live
 *  data, so this is the single place to keep lineups current. To update a team, copy
 *  the 15 names from the latest team sheet into its entry. If a team is not listed it
 *  simply uses the shipped squad.
 *
 *  Keys are the team ids used in internationals.ts / clubs.ts (eng, fra, ire, nzl, rsa,
 *  leinster, bulls, crusaders, ...).
 *
 *  These entries reflect recent selections known to me; they are a best effort, not a
 *  guaranteed match for any specific fixture — please spot-check the sides you care about.
 * ──────────────────────────────────────────────────────────────────────────
 */

export const ROSTER_OVERRIDES: Record<string, string[]> = {
  // ---- Tier 1 nations ----
  rsa: [
    "Ox Nché", "Malcolm Marx", "Thomas du Toit",
    "Eben Etzebeth", "Ruan Nortje",
    "Siya Kolisi", "Pieter-Steph du Toit", "Jasper Wiese",
    "Grant Williams", "Handré Pollard",
    "Kurt-Lee Arendse", "Damian de Allende", "Jesse Kriel", "Cheslin Kolbe", "Aphelele Fassi",
  ],
  nzl: [
    "Ethan de Groot", "Codie Taylor", "Tyrel Lomax",
    "Scott Barrett", "Tupou Vaa'i",
    "Wallace Sititi", "Ardie Savea", "Simon Parker",
    "Cam Roigard", "Beauden Barrett",
    "Caleb Clarke", "Jordie Barrett", "Billy Proctor", "Sevu Reece", "Will Jordan",
  ],
  ire: [
    "Andrew Porter", "Dan Sheehan", "Tadhg Furlong",
    "Joe McCarthy", "Tadhg Beirne",
    "Ryan Baird", "Josh van der Flier", "Caelan Doris",
    "Jamison Gibson-Park", "Sam Prendergast",
    "James Lowe", "Bundee Aki", "Garry Ringrose", "Mack Hansen", "Hugo Keenan",
  ],
  fra: [
    "Jean-Baptiste Gros", "Peato Mauvaka", "Uini Atonio",
    "Thibaud Flament", "Mickaël Guillard",
    "François Cros", "Paul Boudehent", "Grégory Alldritt",
    "Antoine Dupont", "Thomas Ramos",
    "Louis Bielle-Biarrey", "Yoram Moefana", "Gaël Fickou", "Damian Penaud", "Léo Barré",
  ],
  eng: [
    "Ellis Genge", "Jamie George", "Will Stuart",
    "Maro Itoje", "Ollie Chessum",
    "Tom Curry", "Ben Earl", "Tom Willis",
    "Alex Mitchell", "Fin Smith",
    "Tommy Freeman", "Fraser Dingwall", "Ollie Lawrence", "Tom Roebuck", "Freddie Steward",
  ],
  sco: [
    "Pierre Schoeman", "Ewan Ashman", "Zander Fagerson",
    "Scott Cummings", "Grant Gilchrist",
    "Jamie Ritchie", "Rory Darge", "Jack Dempsey",
    "Ben White", "Finn Russell",
    "Duhan van der Merwe", "Sione Tuipulotu", "Huw Jones", "Darcy Graham", "Blair Kinghorn",
  ],
  aus: [
    "James Slipper", "Billy Pollard", "Taniela Tupou",
    "Nick Frost", "Will Skelton",
    "Rob Valetini", "Fraser McReight", "Harry Wilson",
    "Jake Gordon", "Tom Lynagh",
    "Max Jorgensen", "Len Ikitau", "Joseph-Aukuso Suaalii", "Harry Potter", "Tom Wright",
  ],
  arg: [
    "Thomas Gallo", "Julián Montoya", "Joel Sclavi",
    "Guido Petti", "Pedro Rubiolo",
    "Pablo Matera", "Marcos Kremer", "Joaquín Oviedo",
    "Gonzalo García", "Tomás Albornoz",
    "Mateo Carreras", "Santiago Chocobares", "Lucio Cinti", "Rodrigo Isgró", "Juan Cruz Mallía",
  ],
  wal: [
    "Nicky Smith", "Dewi Lake", "Archie Griffin",
    "Dafydd Jenkins", "Adam Beard",
    "Aaron Wainwright", "Jac Morgan", "Taulupe Faletau",
    "Tomos Williams", "Gareth Anscombe",
    "Josh Adams", "Ben Thomas", "Max Llewellyn", "Tom Rogers", "Blair Murray",
  ],
  ita: [
    "Danilo Fischetti", "Giacomo Nicotera", "Simone Ferrari",
    "Niccolò Cannone", "Federico Ruzza",
    "Sebastian Negri", "Michele Lamaro", "Ross Vintcent",
    "Alessandro Garbisi", "Paolo Garbisi",
    "Monty Ioane", "Tommaso Menoncello", "Juan Ignacio Brex", "Louis Lynagh", "Ange Capuozzo",
  ],

  // ---- Add any club or nation below in the same shape ----
  // leinster: [ ...15 names... ],
  // bulls: [ ...15 names... ],
};

/** Apply overrides to a squad: swaps in the XV, keeps the remaining players. */
export function applyRosterOverride(teamId: string, players: string[]): string[] {
  const xv = ROSTER_OVERRIDES[teamId];
  if (!xv || xv.length !== 15) return players;
  // Keep anyone from the shipped squad who is not already in the new XV.
  const rest = players.filter((n) => !xv.includes(n));
  return [...xv, ...rest];
}
