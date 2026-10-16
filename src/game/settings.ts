/** Persisted player settings shared by audio, the renderer and the menus. */
export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  quality: "low" | "high";
  /** What the music does while a match is being played. */
  matchMusic: "off" | "quiet";
  /** Smooth (soft) upscaling instead of hard-edged pixels. */
  smooth: boolean;
  shuffle: boolean;
}

export const SETTINGS_KEY = "pixelruggas.settings.v1";

export const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
  quality: "high",
  matchMusic: "off",
  smooth: false,
  shuffle: false,
};

let cache: GameSettings | null = null;
const listeners = new Set<(s: GameSettings) => void>();

function read(): GameSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const p = JSON.parse(raw) as Partial<GameSettings>;
    return {
      musicVolume: typeof p.musicVolume === "number" ? Math.min(1, Math.max(0, p.musicVolume)) : DEFAULT_SETTINGS.musicVolume,
      sfxVolume: typeof p.sfxVolume === "number" ? Math.min(1, Math.max(0, p.sfxVolume)) : DEFAULT_SETTINGS.sfxVolume,
      quality: p.quality === "low" ? "low" : "high",
      matchMusic: p.matchMusic === "off" ? "off" : "quiet",
      smooth: typeof p.smooth === "boolean" ? p.smooth : DEFAULT_SETTINGS.smooth,
      shuffle: typeof p.shuffle === "boolean" ? p.shuffle : DEFAULT_SETTINGS.shuffle,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function currentSettings(): GameSettings {
  if (!cache) cache = read();
  return cache;
}

function applyToDocument(s: GameSettings): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.smooth = s.smooth ? "1" : "0";
}

export function saveSettings(next: GameSettings): void {
  cache = next;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable – keep the in-memory copy */
  }
  applyToDocument(next);
  listeners.forEach((fn) => fn(next));
}

export function updateSettings(patch: Partial<GameSettings>): GameSettings {
  const next = { ...currentSettings(), ...patch };
  saveSettings(next);
  return next;
}

export function subscribeSettings(fn: (s: GameSettings) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Call once on the client at boot. */
export function initSettings(): GameSettings {
  const s = currentSettings();
  applyToDocument(s);
  return s;
}
