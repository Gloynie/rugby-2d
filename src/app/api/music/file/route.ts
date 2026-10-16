import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
};

/**
 * Streams a song from public/music/ at request time (with Range support so the seek bar works).
 * Serving through a route means songs you add while the game is running play straight away –
 * no restart or rebuild needed.
 */
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const base = path.basename(name);
  const type = TYPES[path.extname(base).toLowerCase()];
  if (!base || base !== name || !type) return new Response("Not found", { status: 404 });

  try {
    const buf = await readFile(path.join(process.cwd(), "public", "music", base));
    const size = buf.length;
    const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-store" };

    const range = req.headers.get("range");
    const m = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : size - 1;
      if (!m[1] && m[2]) {
        start = Math.max(0, size - parseInt(m[2], 10));
        end = size - 1;
      }
      end = Math.min(end, size - 1);
      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      const chunk = buf.subarray(start, end + 1);
      return new Response(new Uint8Array(chunk), {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(chunk.length) },
      });
    }
    return new Response(new Uint8Array(buf), { headers: { ...headers, "Content-Length": String(size) } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
