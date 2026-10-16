import { PLAYLIST, expectedFileName, matchEntry, parseFileName } from "../src/game/music/playlist";

let fail = 0;
const check = (name: string, got: string | undefined, want: string | undefined) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${got ?? "(no match)"}${ok ? "" : `   (wanted ${want ?? "(no match)"})`}`);
};

// every expected filename must map back to its own entry
for (const e of PLAYLIST) check(`expected "${expectedFileName(e)}"`, matchEntry(expectedFileName(e))?.title, e.title);

// loose, user-style filenames
check("lowercase", matchEntry("rocketeer.mp3")?.title, "Rocketeer");
check("artist first", matchEntry("Far East Movement - Rocketeer.mp3")?.title, "Rocketeer");
check("broken vs long title", matchEntry("Rixton - Me and My Broken Heart.mp3")?.title, "Me and My Broken Heart");
check("short title", matchEntry("lovelytheband - broken.mp3")?.title, "broken");
check("dashes/underscores", matchEntry("vance_joy-saturday_sun.mp3")?.title, "Saturday Sun");
check("rock3t", matchEntry("Mi Casa - ROCK3T (Official).mp3")?.title, "ROCK3T");
check("unknown song", matchEntry("Some Random Track.mp3")?.title, undefined);
const p = parseFileName("My Song - Me.mp3");
check("parse title", p.title, "My Song");
check("parse artist", p.artist, "Me");
console.log(`${PLAYLIST.length} playlist entries, ${fail} failures`);
if (fail) process.exit(1);
