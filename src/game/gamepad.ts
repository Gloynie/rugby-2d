/**
 * Gamepad support. Polls the Web Gamepad API and converts it into the same
 * action set the keyboard uses, so the engine does not need to care which one is in play.
 */

import type { Action } from "./controls";

/** Standard-layout button indices, named for readability. */
export const PAD_BUTTONS: { index: number; label: string; short: string }[] = [
  { index: 0, label: "A / Cross", short: "A" },
  { index: 1, label: "B / Circle", short: "B" },
  { index: 2, label: "X / Square", short: "X" },
  { index: 3, label: "Y / Triangle", short: "Y" },
  { index: 4, label: "Left bumper", short: "LB" },
  { index: 5, label: "Right bumper", short: "RB" },
  { index: 6, label: "Left trigger", short: "LT" },
  { index: 7, label: "Right trigger", short: "RT" },
  { index: 8, label: "Back / Share", short: "BACK" },
  { index: 9, label: "Start / Options", short: "START" },
  { index: 10, label: "Left stick press", short: "L3" },
  { index: 11, label: "Right stick press", short: "R3" },
  { index: 12, label: "D-pad up", short: "DUP" },
  { index: 13, label: "D-pad down", short: "DDN" },
  { index: 14, label: "D-pad left", short: "DLF" },
  { index: 15, label: "D-pad right", short: "DRT" },
];

export function padButtonLabel(index: number): string {
  return PAD_BUTTONS.find((b) => b.index === index)?.short ?? `B${index}`;
}

/** Actions that can be bound to a controller button (movement uses the stick / d-pad). */
export type PadAction = Exclude<Action, "up" | "down" | "left" | "right">;

export type PadBindings = Record<PadAction, number>;

export const PAD_ACTIONS: { id: PadAction; label: string; desc: string }[] = [
  { id: "action", label: "Action", desc: "Tackle · dive · kick-off · goal meter · skip replay" },
  { id: "sprint", label: "Sprint", desc: "Hold to accelerate" },
  { id: "passUp", label: "Pass up", desc: "Pass to a team-mate up the screen" },
  { id: "passDown", label: "Pass down", desc: "Pass to a team-mate down the screen" },
  { id: "kick", label: "Kick", desc: "Hold to charge a punt, tap for a grubber" },
  { id: "dropGoal", label: "Drop goal", desc: "Attempt a drop goal" },
  { id: "switch", label: "Switch player", desc: "Take the nearest defender" },
  { id: "opt1", label: "Penalty – at goal", desc: "Shot at goal" },
  { id: "opt2", label: "Penalty – to touch", desc: "Kick for a lineout" },
  { id: "opt3", label: "Penalty – tap", desc: "Quick tap and go" },
  { id: "pause", label: "Pause", desc: "Open the match menu" },
  { id: "help", label: "Toggle help", desc: "Show / hide on-screen controls" },
];

export const DEFAULT_PAD_BINDINGS: PadBindings = {
  action: 0,      // A
  sprint: 7,      // RT
  passUp: 3,      // Y
  passDown: 2,    // X
  kick: 1,        // B
  dropGoal: 5,    // RB
  switch: 4,      // LB
  opt1: 12,       // D-pad up
  opt2: 14,       // D-pad left
  opt3: 15,       // D-pad right
  pause: 9,       // Start
  help: 8,        // Back
};

const PAD_KEY = "pixelruggas.pad.v1";
export const STICK_DEADZONE = 0.28;

export function loadPadBindings(): PadBindings {
  if (typeof window === "undefined") return { ...DEFAULT_PAD_BINDINGS };
  try {
    const raw = window.localStorage.getItem(PAD_KEY);
    if (!raw) return { ...DEFAULT_PAD_BINDINGS };
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    const out = { ...DEFAULT_PAD_BINDINGS };
    for (const a of PAD_ACTIONS) {
      const v = parsed[a.id];
      if (typeof v === "number" && v >= 0 && v < 32) out[a.id] = v;
    }
    return out;
  } catch {
    return { ...DEFAULT_PAD_BINDINGS };
  }
}

export function savePadBindings(b: PadBindings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAD_KEY, JSON.stringify(b));
  } catch {
    /* storage unavailable */
  }
}

export interface PadSnapshot {
  connected: boolean;
  id: string;
  /** buttons currently held */
  held: Set<number>;
  /** buttons pressed since the previous poll */
  pressed: Set<number>;
  moveX: number;
  moveY: number;
}

const EMPTY_PAD: PadSnapshot = { connected: false, id: "", held: new Set(), pressed: new Set(), moveX: 0, moveY: 0 };

/**
 * Reads the first connected pad. Call `poll()` once per frame; `pressed` only
 * contains buttons that went down on that exact frame so taps fire once.
 */
export class GamepadReader {
  private prevHeld = new Set<number>();
  private snap: PadSnapshot = EMPTY_PAD;

  poll(): PadSnapshot {
    if (typeof navigator === "undefined" || !navigator.getGamepads) {
      this.snap = EMPTY_PAD;
      return this.snap;
    }
    const pads = navigator.getGamepads();
    let pad: Gamepad | null = null;
    for (const p of pads) {
      if (p && p.connected) {
        pad = p;
        break;
      }
    }
    if (!pad) {
      this.prevHeld.clear();
      this.snap = EMPTY_PAD;
      return this.snap;
    }

    const held = new Set<number>();
    pad.buttons.forEach((btn, i) => {
      if (btn.pressed || btn.value > 0.5) held.add(i);
    });

    const pressed = new Set<number>();
    for (const b of held) if (!this.prevHeld.has(b)) pressed.add(b);
    this.prevHeld = new Set(held);

    // Left stick, falling back to the d-pad.
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    let moveX = Math.abs(ax) > STICK_DEADZONE ? ax : 0;
    let moveY = Math.abs(ay) > STICK_DEADZONE ? ay : 0;
    if (held.has(14)) moveX = -1;
    if (held.has(15)) moveX = 1;
    if (held.has(12)) moveY = -1;
    if (held.has(13)) moveY = 1;

    this.snap = { connected: true, id: pad.id, held, pressed, moveX, moveY };
    return this.snap;
  }

  get snapshot(): PadSnapshot {
    return this.snap;
  }
}

/** True if any pad is currently plugged in (used for the on-screen hints). */
export function anyPadConnected(): boolean {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return false;
  for (const p of navigator.getGamepads()) if (p && p.connected) return true;
  return false;
}
