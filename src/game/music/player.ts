import { useSyncExternalStore } from "react";
import * as audio from "../audio";
import { currentSettings, subscribeSettings, updateSettings } from "../settings";
import { addStored, listStored, removeStored } from "./library";
import {
  AUDIO_EXTENSIONS, CUSTOM_TRACKS, PLAYLIST, expectedFileName, matchEntry, parseFileName,
  type PlaylistEntry,
} from "./playlist";

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
  fileName: string;
  origin: "folder" | "local";
  storedId?: string;
  /** true when the file matched one of the names in playlist.ts */
  inPlaylist: boolean;
}

export interface CatalogueItem {
  title: string;
  artist: string;
  expectedFile: string;
  found: boolean;
  trackId: string | null;
}

export type MusicContext = "menu" | "match";

export interface MusicSnapshot {
  ready: boolean;
  tracks: MusicTrack[];
  catalogue: CatalogueItem[];
  index: number;
  current: MusicTrack | null;
  playing: boolean;
  time: number;
  duration: number;
  shuffle: boolean;
  context: MusicContext;
  /** true when no songs were found and the built-in synth theme is used instead */
  synth: boolean;
  /** browsers only allow sound after the first click / key press */
  needsGesture: boolean;
}

const EMPTY: MusicSnapshot = {
  ready: false, tracks: [], catalogue: [], index: -1, current: null, playing: false, time: 0, duration: 0,
  shuffle: false, context: "menu", synth: false, needsGesture: true,
};

const MATCH_VOLUME = 0.35;

class MusicPlayer {
  private el: HTMLAudioElement | null = null;
  private tracks: MusicTrack[] = [];
  private catalogue: CatalogueItem[] = [];
  private index = -1;
  private started = false;
  private ready = false;
  private armed = false;
  private userPaused = false;
  private suspended = false;
  private synthOn = false;
  private context: MusicContext = "menu";
  private errorStreak = 0;
  private recent: number[] = [];
  private urls: string[] = [];
  private initPromise: Promise<void> | null = null;
  private lastEmit = 0;
  private fadeRaf: number | null = null;
  private subs = new Set<() => void>();
  private snap: MusicSnapshot = EMPTY;

  subscribe = (fn: () => void): (() => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };
  getSnapshot = (): MusicSnapshot => this.snap;
  getServerSnapshot = (): MusicSnapshot => EMPTY;

  /** Called by the first user gesture so the browser allows audio to play. */
  unlock(): void { this.started = true; this.maybeAutoStart(); }
  /** Returns a promise that resolves once the library scan is done. */
  async onceReady(): Promise<void> { return this.init(); }

  // ---------------------------------------------------------------- setup
  init(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.ensureElement();
        this.armOnGesture();
        this.applyVolume();
        subscribeSettings(() => this.applyContext());
        await this.scan();
        this.ready = true;
        this.emit();
        this.maybeAutoStart();
      })();
    }
    return this.initPromise;
  }

  private armOnGesture(): void {
    if (this.armed) return;
    this.armed = true;
    const go = () => {
      window.removeEventListener("pointerdown", go, true);
      window.removeEventListener("keydown", go, true);
      this.started = true;
      this.emit();
      this.maybeAutoStart();
    };
    window.addEventListener("pointerdown", go, true);
    window.addEventListener("keydown", go, true);
  }

  private ensureElement(): HTMLAudioElement {
    if (this.el) return this.el;
    const el = new Audio();
    el.preload = "auto";
    // Kept in the document (hidden) so browser media controls and dev tools can see it.
    el.setAttribute("data-pixelruggas-music", "");
    el.style.display = "none";
    if (typeof document !== "undefined") document.body.appendChild(el);
    this.el = el;
    el.addEventListener("play", () => this.emit());
    el.addEventListener("pause", () => this.emit());
    el.addEventListener("loadedmetadata", () => this.emit());
    el.addEventListener("playing", () => {
      this.errorStreak = 0;
    });
    el.addEventListener("timeupdate", () => {
      const now = performance.now();
      if (now - this.lastEmit > 250) this.emit();
    });
    el.addEventListener("ended", () => this.next(false));
    el.addEventListener("error", () => this.onError());
    return el;
  }

  private onError(): void {
    const el = this.el;
    if (!el || !el.getAttribute("src")) return;
    this.errorStreak++;
    if (this.errorStreak > Math.max(1, this.tracks.length)) {
      this.emit();
      return;
    }
    this.next(false);
  }

  // ---------------------------------------------------------------- library scan
  private async scan(): Promise<void> {
    this.urls.forEach((u) => URL.revokeObjectURL(u));
    this.urls = [];

    let files: string[] = [];
    let listed = false;
    try {
      const r = await fetch("/api/music", { cache: "no-store" });
      if (r.ok) {
        const d = (await r.json()) as { files?: string[]; listed?: boolean };
        files = d.files ?? [];
        listed = !!d.listed;
      }
    } catch {
      /* offline – fall through to probing */
    }
    if (!listed) {
      // The server could not list the folder: look for the conventional filenames instead.
      const probes = [...PLAYLIST.map(expectedFileName), ...CUSTOM_TRACKS.map((c) => c.file)];
      const hits = await Promise.all(
        probes.map(async (name) => {
          try {
            const r = await fetch(`/music/${encodeURIComponent(name)}`, { method: "HEAD", cache: "no-store" });
            return r.ok ? name : null;
          } catch {
            return null;
          }
        }),
      );
      files = hits.filter((n): n is string => !!n);
    }

    const used = new Set<string>();
    const tracks: MusicTrack[] = [];
    const catalogue: CatalogueItem[] = [];
    const folderTrack = (file: string, e: PlaylistEntry, inPlaylist: boolean): MusicTrack => ({
      id: `f:${file}`, title: e.title, artist: e.artist,
      // When the server can read the folder, stream through the API (works for files added at any time).
      src: listed ? `/api/music/file?name=${encodeURIComponent(file)}` : `/music/${encodeURIComponent(file)}`,
      fileName: file, origin: "folder", inPlaylist,
    });

    for (const e of PLAYLIST) {
      const file = files.find((f) => !used.has(f) && matchEntry(f) === e);
      if (file) {
        used.add(file);
        const t = folderTrack(file, e, true);
        tracks.push(t);
        catalogue.push({ ...e, expectedFile: expectedFileName(e), found: true, trackId: t.id });
      } else {
        catalogue.push({ ...e, expectedFile: expectedFileName(e), found: false, trackId: null });
      }
    }
    for (const c of CUSTOM_TRACKS) {
      if (files.includes(c.file) && !used.has(c.file)) {
        used.add(c.file);
        tracks.push(folderTrack(c.file, c, false));
      }
    }
    for (const f of files) {
      if (used.has(f) || !AUDIO_EXTENSIONS.test(f)) continue;
      used.add(f);
      tracks.push(folderTrack(f, parseFileName(f), false));
    }

    // songs added through the game (kept in this browser only)
    for (const s of await listStored()) {
      const e = matchEntry(s.name);
      const meta = e ?? parseFileName(s.name);
      const url = URL.createObjectURL(s.blob);
      this.urls.push(url);
      const t: MusicTrack = {
        id: `l:${s.id}`, title: meta.title, artist: meta.artist, src: url, fileName: s.name,
        origin: "local", storedId: s.id, inPlaylist: !!e,
      };
      tracks.push(t);
      if (e) {
        const item = catalogue.find((c) => c.title === e.title && c.artist === e.artist);
        if (item && !item.found) {
          item.found = true;
          item.trackId = t.id;
        }
      }
    }

    const curId = this.tracks[this.index]?.id;
    this.tracks = tracks;
    this.catalogue = catalogue;
    this.index = curId ? tracks.findIndex((t) => t.id === curId) : -1;

    // keep the current song playing if its (blob) address changed during the rescan
    const el = this.el;
    const cur = this.tracks[this.index];
    if (el && cur && el.getAttribute("src") !== cur.src) {
      const pos = el.currentTime;
      const wasPlaying = !el.paused;
      el.src = cur.src;
      el.currentTime = pos;
      if (wasPlaying) void el.play().catch(() => undefined);
    }
  }

  async refresh(): Promise<void> {
    const hadCurrent = this.index >= 0;
    await this.scan();
    if (hadCurrent && this.index === -1) {
      this.el?.pause();
      this.el?.removeAttribute("src");
      if (!this.userPaused && this.tracks.length) this.next(false);
    }
    if (this.tracks.length && this.synthOn) this.stopSynth();
    this.emit();
    this.maybeAutoStart();
  }

  async addFiles(list: FileList | File[]): Promise<number> {
    let added = 0;
    for (const f of Array.from(list)) {
      if (!(f.type.startsWith("audio/") || AUDIO_EXTENSIONS.test(f.name))) continue;
      if (await addStored(f)) added++;
    }
    if (added) {
      const hadTracks = this.tracks.length > 0;
      await this.refresh();
      if (!hadTracks) {
        this.userPaused = false;
        this.started = true;
        this.maybeAutoStart();
      }
    }
    return added;
  }

  async removeLocal(storedId: string): Promise<void> {
    await removeStored(storedId);
    await this.refresh();
  }

  // ---------------------------------------------------------------- transport
  private randomIndex(): number {
    return Math.floor(Math.random() * Math.max(1, this.tracks.length));
  }

  private pickNext(): number {
    const n = this.tracks.length;
    if (n === 0) return -1;
    if (n === 1) return 0;
    if (true) {
      const avoid = new Set(this.recent.slice(-Math.min(3, n - 1)));
      avoid.add(this.index);
      let c = this.randomIndex();
      for (let tries = 0; tries < 16 && avoid.has(c); tries++) c = this.randomIndex();
      return avoid.has(c) ? (this.index + 1) % n : c;
    }
    return (this.index + 1) % n;
  }

  playIndex(i: number, byUser = true): void {
    const t = this.tracks[i];
    if (!t) return;
    this.stopSynth();
    const el = this.ensureElement();
    if (byUser) {
      this.userPaused = false;
      this.started = true;
    }
    this.suspended = false;
    this.index = i;
    this.recent.push(i);
    if (this.recent.length > 60) this.recent.shift();
    if (el.getAttribute("src") !== t.src) el.src = t.src;
    el.currentTime = 0;
    // Start silent and fade up so songs never slam in.
    this.setElementVolume(0);
    void el.play().then(() => this.fadeTo(this.targetVolume(), 800)).catch(() => this.emit());
    this.setMediaSession(t);
    this.emit();
  }

  play(): void {
    this.userPaused = false;
    this.started = true;
    if (this.tracks.length === 0) {
      this.startSynth();
      this.emit();
      return;
    }
    if (this.index < 0 || !this.el?.getAttribute("src")) {
      this.playIndex(true ? this.randomIndex() : Math.max(0, this.index), true);
      return;
    }
    void this.ensureElement().play().catch(() => undefined);
    this.emit();
  }

  pause(): void {
    this.userPaused = true;
    this.fadeTo(0, 400, () => {
      this.el?.pause();
      this.stopSynth();
      this.emit();
    });
    this.emit();
  }

  toggle(): void {
    if (this.snap.playing) this.pause();
    else this.play();
  }

  next(byUser = true): void {
    const i = this.pickNext();
    if (i >= 0) this.playIndex(i, byUser);
  }

  prev(): void {
    const el = this.el;
    if (el && el.currentTime > 3) {
      el.currentTime = 0;
      this.emit();
      return;
    }
    if (this.recent.length > 1) {
      this.recent.pop();
      const back = this.recent.pop() as number;
      this.playIndex(back, true);
      return;
    }
    const n = this.tracks.length;
    if (n) this.playIndex((this.index - 1 + n) % n, true);
  }

  seek(fraction: number): void {
    const el = this.el;
    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      el.currentTime = Math.min(1, Math.max(0, fraction)) * el.duration;
      this.emit();
    }
  }

  /** Shuffle is always on – kept so older callers do not break. */
  setShuffle(_v: boolean): void { /* always shuffling */ }

  // ---------------------------------------------------------------- context (menu vs match)
  setContext(ctx: MusicContext): void {
    this.context = ctx;
    this.applyContext();
  }

  private applyContext(): void {
    const s = currentSettings();
    const silent = this.context === "match" && (s.matchMusic === "off" || this.tracks.length === 0);
    const active = this.synthOn || (!!this.el && !this.el.paused);
    if (silent) {
      if (active) {
        this.suspended = true;
        // Fade out over ~0.7s, then pause – no abrupt cut when a match kicks off.
        this.fadeTo(0, 700, () => {
          this.el?.pause();
          this.stopSynth();
        });
      }
    } else if (this.suspended) {
      this.suspended = false;
      if (!this.userPaused) {
        this.setElementVolume(0);
        this.maybeAutoStart();
        this.fadeTo(this.targetVolume(), 900);
      }
    } else {
      this.maybeAutoStart();
      this.fadeTo(this.targetVolume(), 600);
    }
    audio.applyAudioSettings({ musicVolume: this.targetVolume(), sfxVolume: s.sfxVolume });
    this.emit();
  }

  /** Volume the music should settle at for the current context. */
  private targetVolume(): number {
    const s = currentSettings();
    const factor = this.context === "match" ? MATCH_VOLUME : 1;
    return Math.min(1, Math.max(0, s.musicVolume * factor));
  }

  private setElementVolume(v: number): void {
    if (this.el) this.el.volume = Math.min(1, Math.max(0, v));
  }

  /** Smoothly ramp the element volume. Any in-flight fade is cancelled. */
  private fadeTo(to: number, ms: number, done?: () => void): void {
    if (this.fadeRaf !== null) {
      cancelAnimationFrame(this.fadeRaf);
      this.fadeRaf = null;
    }
    const el = this.el;
    if (!el) {
      done?.();
      return;
    }
    const from = el.volume;
    if (ms <= 0 || Math.abs(to - from) < 0.01) {
      this.setElementVolume(to);
      done?.();
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      // ease-in-out so the ramp feels natural rather than linear
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.setElementVolume(from + (to - from) * e);
      if (k < 1) {
        this.fadeRaf = requestAnimationFrame(step);
      } else {
        this.fadeRaf = null;
        done?.();
      }
    };
    this.fadeRaf = requestAnimationFrame(step);
  }

  private applyVolume(): void {
    const s = currentSettings();
    this.setElementVolume(this.targetVolume());
    audio.applyAudioSettings({ musicVolume: this.targetVolume(), sfxVolume: s.sfxVolume });
  }

  private maybeAutoStart(): void {
    if (!this.ready || !this.started || this.userPaused || this.suspended) return;
    if (this.context === "match" && currentSettings().matchMusic === "off") return;
    if (this.tracks.length === 0) {
      if (this.context === "menu" && !this.synthOn) {
        this.startSynth();
        this.emit();
      }
      return;
    }
    if (this.synthOn) this.stopSynth();
    const el = this.el;
    if (el && !el.paused) return;
    if (this.index >= 0 && el?.getAttribute("src")) {
      void el.play().catch(() => undefined);
      this.emit();
      return;
    }
    this.playIndex(true ? this.randomIndex() : 0, false);
  }

  private startSynth(): void {
    audio.startMenuMusic();
    this.synthOn = true;
  }

  private stopSynth(): void {
    if (this.synthOn) {
      audio.stopMenuMusic();
      this.synthOn = false;
    }
  }

  private setMediaSession(t: MusicTrack): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: "PixelRuggas" });
      navigator.mediaSession.setActionHandler("play", () => this.play());
      navigator.mediaSession.setActionHandler("pause", () => this.pause());
      navigator.mediaSession.setActionHandler("nexttrack", () => this.next());
      navigator.mediaSession.setActionHandler("previoustrack", () => this.prev());
    } catch {
      /* media session unsupported */
    }
  }

  private emit(): void {
    const el = this.el;
    this.lastEmit = performance.now();
    this.snap = {
      ready: this.ready,
      tracks: this.tracks,
      catalogue: this.catalogue,
      index: this.index,
      current: this.tracks[this.index] ?? null,
      playing: this.synthOn || (!!el && !el.paused && !el.ended),
      time: el?.currentTime ?? 0,
      duration: el && Number.isFinite(el.duration) ? el.duration : 0,
      shuffle: true,
      context: this.context,
      synth: this.synthOn || (this.ready && this.tracks.length === 0),
      needsGesture: !this.started,
    };
    this.subs.forEach((fn) => fn());
  }
}

export const music = new MusicPlayer();

export function useMusic(): MusicSnapshot {
  return useSyncExternalStore(music.subscribe, music.getSnapshot, music.getServerSnapshot);
}
