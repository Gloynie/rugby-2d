import { readdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const AUDIO = /\.(mp3|m4a|aac|ogg|oga|wav|flac|opus)$/i;

/** Lists the audio files the player dropped into public/music/. */
export async function GET() {
  try {
    const dir = path.join(process.cwd(), "public", "music");
    const names = await readdir(dir);
    return Response.json({ listed: true, files: names.filter((n) => AUDIO.test(n)).sort() });
  } catch {
    // Folder missing or not readable (e.g. some serverless hosts) – the client will probe instead.
    return Response.json({ listed: false, files: [] });
  }
}
