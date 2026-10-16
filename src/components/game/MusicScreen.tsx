"use client";

import { useRef, useState } from "react";
import { updateSettings, currentSettings } from "@/game/settings";
import { music, useMusic } from "@/game/music/player";
import NowPlaying, { Cover } from "./NowPlaying";
import { Btn, Kicker, Panel, ScreenHeader, Scroll } from "./ui";

export default function MusicScreen({ onBack }: { onBack: () => void }) {
  const m = useMusic();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [matchMusic, setMatchMusic] = useState(currentSettings().matchMusic);

  const found = m.catalogue.filter((c) => c.found).length;
  const extras = m.tracks.filter((t) => !t.inPlaylist);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const n = await music.addFiles(files);
    setBusy(false);
    setNote(n > 0 ? `Added ${n} song${n === 1 ? "" : "s"} – saved in this browser.` : "No audio files found in that selection (try .mp3).");
    if (input.current) input.current.value = "";
  };

  const playTrack = (id: string | null) => {
    if (!id) return;
    const i = m.tracks.findIndex((t) => t.id === id);
    if (i >= 0) music.playIndex(i, true);
  };

  const Row = ({ title, artist, ok, id, n, local, storedId }: { title: string; artist: string; ok: boolean; id: string | null; n: number; local?: boolean; storedId?: string }) => {
    const current = m.current?.id === id && id !== null;
    return (
      <div className={`group flex items-center gap-3 rounded-lg px-2 py-1.5 ${current ? "bg-yellow-400/15" : "hover:bg-white/5"} ${ok ? "" : "opacity-50"}`}>
        <span className="w-7 text-right text-sm tabular-nums text-slate-500">{n}</span>
        <button type="button" disabled={!ok} onClick={() => playTrack(id)} className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed">
          <Cover title={title} size={34} playing={current && m.playing} />
          <span className="min-w-0 flex-1">
            <span className={`block truncate font-display text-lg font-bold leading-tight ${current ? "text-yellow-300" : ""}`}>{title}</span>
            <span className="block truncate text-sm leading-tight text-slate-400">{artist}</span>
          </span>
        </button>
        {ok ? (
          <span className="rounded-full border border-green-400/40 bg-green-500/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-green-300">Ready</span>
        ) : (
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-400">Missing</span>
        )}
        {local && storedId && (
          <button type="button" title="Remove from this browser" onClick={() => void music.removeLocal(storedId)} className="rounded px-1.5 text-lg text-slate-500 hover:text-red-400">✕</button>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScreenHeader kicker="Soundtrack" title="Music" right={<Btn onClick={onBack}>Back</Btn>} />
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel className="flex min-h-0 flex-col p-4">
          <div className="mb-2 flex items-center justify-between">
            <Kicker>Playlist · {found} of {m.catalogue.length} ready</Kicker>
            {m.tracks.length > 0 && <span className="text-sm text-slate-400">{m.tracks.length} playable</span>}
          </div>
          <Scroll className="pr-1">
            {m.catalogue.map((c, i) => (
              <Row key={c.title} title={c.title} artist={c.artist} ok={c.found} id={c.trackId} n={i + 1}
                local={!!c.trackId && c.trackId.startsWith("l:")} storedId={c.trackId?.startsWith("l:") ? c.trackId.slice(2) : undefined} />
            ))}
            {extras.length > 0 && (
              <>
                <p className="mb-1 mt-4 px-2 font-display text-xs font-bold uppercase tracking-[0.28em] text-yellow-400">Your other songs</p>
                {extras.map((t, i) => (
                  <Row key={t.id} title={t.title} artist={t.artist} ok id={t.id} n={m.catalogue.length + i + 1} local={t.origin === "local"} storedId={t.storedId} />
                ))}
              </>
            )}
          </Scroll>
        </Panel>

        <div className="flex min-h-0 flex-col gap-4">
          <NowPlaying variant="full" />
          <Panel className="p-4">
            <Kicker>Add your songs</Kicker>
            <p className="mt-2 text-slate-300">
              Add MP3s straight from your computer – they stay in this browser and play with the rest of the playlist.
            </p>
            <input ref={input} type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac" multiple className="hidden" onChange={(e) => void addFiles(e.target.files)} />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Btn primary disabled={busy} onClick={() => input.current?.click()}>{busy ? "Adding…" : "Add MP3 files"}</Btn>
              {note && <span className="text-sm text-yellow-200">{note}</span>}
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-slate-300">
              <p className="font-display text-sm font-bold uppercase tracking-widest text-slate-200">Or drop files in the project</p>
              <p className="mt-1">
                Copy .mp3 files into <code className="rounded bg-white/10 px-1.5 text-yellow-200">public/music/</code> named like{" "}
                <code className="rounded bg-white/10 px-1.5 text-yellow-200">Song Title - Artist.mp3</code>, then refresh. New names can be added in{" "}
                <code className="rounded bg-white/10 px-1.5 text-yellow-200">src/game/music/playlist.ts</code>.
              </p>
            </div>
          </Panel>
          <Panel className="p-4">
            <Kicker>During matches</Kicker>
            <div className="mt-3 flex gap-2">
              {(["quiet", "off"] as const).map((v) => (
                <Btn key={v} primary={matchMusic === v} onClick={() => { setMatchMusic(v); updateSettings({ matchMusic: v }); }}>
                  {v === "quiet" ? "Quiet in background" : "Silent"}
                </Btn>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
