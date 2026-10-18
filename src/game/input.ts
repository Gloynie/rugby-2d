import type { Bindings } from "./controls";
import { GamepadReader, loadPadBindings, type PadBindings } from "./gamepad";
import type { InputFrame } from "./types";

const ALWAYS_PREVENT = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"]);

export const IDLE_INPUT: InputFrame = {
  moveX: 0, moveY: 0, sprint: false, kickHeld: false, passUp: false, passDown: false,
  kickRelease: false, dropGoal: false, action: false, switchPlayer: false,
  option1: false, option2: false, option3: false,
};

export class InputManager {
  private keys = new Set<string>();
  private edges = new Set<string>();
  private kickReleased = false;
  private skipEdge = false;
  private padKickWasHeld = false;
  private bindings: Bindings;
  private onPause: () => void;
  private onToggleHelp: () => void;
  private pad = new GamepadReader();
  private padBindings: PadBindings = loadPadBindings();
  /** true while a controller is plugged in – used for on-screen prompts */
  padConnected = false;

  constructor(bindings: Bindings, onPause: () => void, onToggleHelp: () => void) {
    this.bindings = bindings;
    this.onPause = onPause;
    this.onToggleHelp = onToggleHelp;
  }

  setBindings(b: Bindings): void {
    this.bindings = b;
  }

  setPadBindings(b: PadBindings): void {
    this.padBindings = b;
  }

  private isBound(code: string): boolean {
    for (const k in this.bindings) if (this.bindings[k as keyof Bindings] === code) return true;
    return false;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (ALWAYS_PREVENT.has(e.code) || this.isBound(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === this.bindings.pause) {
      this.onPause();
      return;
    }
    if (e.code === this.bindings.help) {
      this.onToggleHelp();
      return;
    }
    this.keys.add(e.code);
    this.edges.add(e.code);
    if (e.code === "Enter" || e.code === "Space" || e.code === this.bindings.action) this.skipEdge = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (ALWAYS_PREVENT.has(e.code) || this.isBound(e.code)) e.preventDefault();
    if (e.code === this.bindings.kick && this.keys.has(e.code)) this.kickReleased = true;
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.edges.clear();
  };

  attach(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }

  /** True once per press of Enter / Space / action – used to skip cinematics. */
  consumeSkip(): boolean {
    const s = this.skipEdge;
    this.skipEdge = false;
    return s;
  }

  /** Build the frame for this simulation step and clear one-shot edges. */
  frame(): InputFrame {
    const k = this.keys;
    const e = this.edges;
    const b = this.bindings;
    // Controller is polled every frame and merged on top of the keyboard, so either works.
    const g = this.pad.poll();
    const pb = this.padBindings;
    this.padConnected = g.connected;
    const padHeld = (a: keyof PadBindings) => g.held.has(pb[a]);
    const padTap = (a: keyof PadBindings) => g.pressed.has(pb[a]);

    // The pad's pause / help buttons fire the same callbacks as the keyboard.
    if (padTap("pause")) this.onPause();
    if (padTap("help")) this.onToggleHelp();
    // Releasing the kick button must still trigger the punt.
    if (this.padKickWasHeld && !padHeld("kick")) this.kickReleased = true;
    this.padKickWasHeld = padHeld("kick");
    if (padTap("action")) this.skipEdge = true;

    const keyX = (k.has(b.right) ? 1 : 0) - (k.has(b.left) ? 1 : 0);
    const keyY = (k.has(b.down) ? 1 : 0) - (k.has(b.up) ? 1 : 0);
    const f: InputFrame = {
      moveX: keyX !== 0 ? keyX : g.moveX,
      moveY: keyY !== 0 ? keyY : g.moveY,
      sprint: k.has(b.sprint) || padHeld("sprint"),
      kickHeld: k.has(b.kick) || padHeld("kick"),
      passUp: e.has(b.passUp) || padTap("passUp"),
      passDown: e.has(b.passDown) || padTap("passDown"),
      kickRelease: this.kickReleased,
      dropGoal: e.has(b.dropGoal) || padTap("dropGoal"),
      action: e.has(b.action) || padTap("action"),
      switchPlayer: e.has(b.switch) || padTap("switch"),
      option1: e.has(b.opt1) || padTap("opt1"),
      option2: e.has(b.opt2) || padTap("opt2"),
      option3: e.has(b.opt3) || padTap("opt3"),
    };
    this.edges.clear();
    this.kickReleased = false;
    return f;
  }
}
