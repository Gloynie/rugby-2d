export type Action =
  | "up" | "down" | "left" | "right" | "sprint"
  | "passUp" | "passDown" | "kick" | "dropGoal"
  | "action" | "switch"
  | "opt1" | "opt2" | "opt3"
  | "pause" | "help";

export type Bindings = Record<Action, string>;

export const ACTIONS: { id: Action; label: string; desc: string; group: string }[] = [
  { id: "up", label: "Move up", desc: "Run up the screen", group: "Movement" },
  { id: "down", label: "Move down", desc: "Run down the screen", group: "Movement" },
  { id: "left", label: "Move left", desc: "Run left", group: "Movement" },
  { id: "right", label: "Move right", desc: "Run right", group: "Movement" },
  { id: "sprint", label: "Sprint", desc: "Hold to sprint – drains stamina", group: "Movement" },
  { id: "passUp", label: "Pass up", desc: "Pass to a team-mate up the screen (always backwards)", group: "Attack" },
  { id: "passDown", label: "Pass down", desc: "Pass to a team-mate down the screen (always backwards)", group: "Attack" },
  { id: "kick", label: "Kick", desc: "Hold to charge a punt, tap for a grubber", group: "Attack" },
  { id: "dropGoal", label: "Drop goal", desc: "Attempt a drop goal", group: "Attack" },
  { id: "action", label: "Action", desc: "Tackle · dive for the line · take kick-off · goal-kick meter · skip replay", group: "General" },
  { id: "switch", label: "Switch player", desc: "Take control of the nearest defender", group: "Defence" },
  { id: "opt1", label: "Penalty – kick at goal", desc: "Choose the shot at goal", group: "Penalties" },
  { id: "opt2", label: "Penalty – kick to touch", desc: "Kick for a lineout", group: "Penalties" },
  { id: "opt3", label: "Penalty – tap and go", desc: "Quick tap", group: "Penalties" },
  { id: "pause", label: "Pause", desc: "Open the match menu", group: "General" },
  { id: "help", label: "Toggle help", desc: "Show / hide the on-screen controls", group: "General" },
];

export const DEFAULT_BINDINGS: Bindings = {
  up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", sprint: "ShiftLeft",
  passUp: "KeyW", passDown: "KeyS", kick: "KeyA", dropGoal: "KeyD",
  action: "Space", switch: "KeyQ",
  opt1: "Digit1", opt2: "Digit2", opt3: "Digit3",
  pause: "Escape", help: "KeyH",
};

export const PRESETS: { id: string; name: string; bindings: Bindings }[] = [
  { id: "arrows", name: "Arrows + WASD", bindings: { ...DEFAULT_BINDINGS } },
  {
    id: "wasd",
    name: "WASD + IJKL",
    bindings: {
      ...DEFAULT_BINDINGS,
      up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", sprint: "ShiftLeft",
      passUp: "KeyI", passDown: "KeyK", kick: "KeyJ", dropGoal: "KeyL", action: "Space", switch: "KeyE",
    },
  },
  {
    id: "numpad",
    name: "Arrows + Numpad",
    bindings: {
      ...DEFAULT_BINDINGS,
      sprint: "ControlRight", passUp: "Numpad8", passDown: "Numpad2", kick: "Numpad4", dropGoal: "Numpad6",
      action: "Numpad0", switch: "Numpad5",
    },
  },
];

const STORAGE_KEY = "rugby2d.controls.v1";

export function loadBindings(): Bindings {
  if (typeof window === "undefined") return { ...DEFAULT_BINDINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BINDINGS };
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    const out: Bindings = { ...DEFAULT_BINDINGS };
    for (const a of ACTIONS) {
      const v = parsed[a.id];
      if (typeof v === "string" && v.length > 0 && v.length < 32) out[a.id] = v;
    }
    return out;
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

export function saveBindings(b: Bindings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    /* ignore quota errors */
  }
}

const SPECIAL: Record<string, [string, string]> = {
  Space: ["SPACE", "SPACE"],
  ShiftLeft: ["L-SHIFT", "SHIFT"],
  ShiftRight: ["R-SHIFT", "R-SHIFT"],
  ControlLeft: ["L-CTRL", "CTRL"],
  ControlRight: ["R-CTRL", "R-CTRL"],
  AltLeft: ["L-ALT", "ALT"],
  AltRight: ["R-ALT", "R-ALT"],
  Enter: ["ENTER", "ENTER"],
  NumpadEnter: ["NUM ENTER", "N-ENTER"],
  Escape: ["ESC", "ESC"],
  Tab: ["TAB", "TAB"],
  Backspace: ["BACKSPACE", "BKSP"],
  CapsLock: ["CAPS", "CAPS"],
  ArrowUp: ["↑", "UP"],
  ArrowDown: ["↓", "DOWN"],
  ArrowLeft: ["←", "LEFT"],
  ArrowRight: ["→", "RIGHT"],
  Comma: [",", ","],
  Period: [".", "."],
  Slash: ["/", "/"],
  Semicolon: [";", ";"],
  Quote: ["'", "'"],
  BracketLeft: ["[", "["],
  BracketRight: ["]", "]"],
  Backslash: ["\\", "\\"],
  Minus: ["-", "-"],
  Equal: ["=", "="],
  Backquote: ["`", "`"],
  NumpadAdd: ["NUM +", "N+"],
  NumpadSubtract: ["NUM -", "N-"],
  NumpadMultiply: ["NUM *", "N*"],
  NumpadDivide: ["NUM /", "N/"],
  NumpadDecimal: ["NUM .", "N."],
};

/** Human readable key name. `compact` variant avoids glyphs missing from the pixel font. */
export function keyLabel(code: string, compact = false): string {
  const sp = SPECIAL[code];
  if (sp) return compact ? sp[1] : sp[0];
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1];
  m = /^Digit(\d)$/.exec(code);
  if (m) return m[1];
  m = /^Numpad(\d)$/.exec(code);
  if (m) return compact ? `N${m[1]}` : `NUM ${m[1]}`;
  m = /^F(\d{1,2})$/.exec(code);
  if (m) return `F${m[1]}`;
  return code.toUpperCase().slice(0, 8);
}

/** Keys that are never allowed to be bound (browser-critical). */
export const UNBINDABLE = new Set(["MetaLeft", "MetaRight", "F5", "F11", "F12", "ContextMenu"]);
