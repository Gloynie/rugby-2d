/**
 * ──────────────────────────────────────────────────────────────────────────
 *  PIXELRUGGAS MUSIC PLAYLIST  –  this is where YOU add songs.
 * ──────────────────────────────────────────────────────────────────────────
 *  1. Put your .mp3 files in the folder   public/music/
 *  2. That's it – the game scans the folder and plays everything it finds.
 *
 *  The list below only holds the song NAMES (no audio is bundled with the game).
 *  A file is matched to a name when its filename contains the song title, so any of
 *  these work for "Rocketeer":
 *      Rocketeer - Far East Movement.mp3     ← recommended  ("Title - Artist.mp3")
 *      rocketeer.mp3
 *      Far East Movement - Rocketeer.mp3
 *
 *  Want a song that isn't in the list?  Either:
 *    • just drop the file into public/music/ (it shows up named after the file), or
 *    • add a line to CUSTOM_TRACKS below to give it a proper title/artist.
 *
 *  You can also add songs without touching any files: open  Music  in the main
 *  menu and press "Add MP3 files" – those are saved in your browser.
 * ──────────────────────────────────────────────────────────────────────────
 */

export interface PlaylistEntry {
  title: string;
  artist: string;
}

/** The songs this game is set up for. Order = default play order. */
export const PLAYLIST: PlaylistEntry[] = [
  { title: "Rocketeer", artist: "Far East Movement" },
  { title: "Monster", artist: "Alan Walker, Emyrson Flora" },
  { title: "Material Lover", artist: "Sienna Spiro" },
  { title: "Castles", artist: "Freya Ridings" },
  { title: "Fire is low", artist: "Freshlyground" },
  { title: "Cheek to Cheek", artist: "Dr. Victor and the Rasta Rebels" },
  { title: "Sweet Disposition", artist: "The Temper Trap" },
  { title: "ROCK3T", artist: "Mi Casa" },
  { title: "Saved by the Summer", artist: "Goodluck" },
  { title: "Children of the Sun", artist: "Daniel Baron" },
  { title: "Palace of Dreams", artist: "Lee Cole" },
  { title: "Weirdo", artist: "Jethro Tait" },
  { title: "Hearts Exposed", artist: "Craig Lucas" },
  { title: "Day Dream (Last Night)", artist: "Jimmy Nevis" },
  { title: "Me and My Broken Heart", artist: "Rixton" },
  { title: "Following the Sun", artist: "Super-Hi, NEEKA" },
  { title: "Missing Piece", artist: "Vance Joy" },
  { title: "Fly High", artist: "Toby Romeo" },
  { title: "Saturday Sun", artist: "Vance Joy" },
  { title: "Malibu", artist: "Miley Cyrus" },
  { title: "broken", artist: "lovelytheband" },
  { title: "Waves", artist: "Jeremy Loops" },
  { title: "Fade to Black", artist: "Tasha Baxter" },
  { title: "Make it Easy", artist: "Lloyd Cele" },
  { title: "Special Star", artist: "Mango Groove" },
  { title: "Colours", artist: "DJ Zinhle, Tamara Day" },
  { title: "Find my Way", artist: "Timo ODV" },
  { title: "Secrets", artist: "Jamali" },
  { title: "Cold Shoulder", artist: "Locnville, Sketchy Bongo" },
  { title: "Down South", artist: "Jeremy Loops, Motheo Moleko" },
];

/**
 * ➕ ADD YOUR OWN SONGS HERE (optional).
 * `file` is the exact filename inside public/music/ (include the extension).
 *
 *   { file: "my-song.mp3", title: "My Song", artist: "Me" },
 */
export const CUSTOM_TRACKS: { file: string; title: string; artist: string }[] = [
  // { file: "my-song.mp3", title: "My Song", artist: "Me" },
];

/** File extensions the player will pick up from public/music/. */
export const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|ogg|oga|wav|flac|opus)$/i;

/** The filename we look for first when the folder can't be listed. */
export function expectedFileName(e: PlaylistEntry): string {
  return `${e.title} - ${e.artist}.mp3`.replace(/[\\/:*?"<>|]/g, "");
}

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Find which PLAYLIST entry a filename belongs to (longest matching title wins). */
export function matchEntry(fileName: string): PlaylistEntry | null {
  const f = norm(fileName);
  let best: PlaylistEntry | null = null;
  let bestLen = 0;
  for (const e of PLAYLIST) {
    const t = norm(e.title);
    if (t.length >= 3 && f.includes(t) && t.length > bestLen) {
      best = e;
      bestLen = t.length;
    }
  }
  return best;
}

/** "My Song - Me.mp3" → { title: "My Song", artist: "Me" } for files that aren't in the playlist. */
export function parseFileName(fileName: string): PlaylistEntry {
  const base = fileName.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " ").trim();
  const m = /^(.+?)\s+-\s+(.+)$/.exec(base);
  if (m) return { title: m[1].trim(), artist: m[2].trim() };
  return { title: base || "Untitled", artist: "Your library" };
}
