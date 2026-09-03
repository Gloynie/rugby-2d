import type { Bindings } from "./controls";
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
  private bindings: Bindings;
  private onPause: () => void;
  private onToggleHelp: () => void;

  constructor(bindings: Bindings, onPause: () => void, onToggleHelp: () => void) {
    this.bindings = bindings;
    this.onPause = onPause;
    this.onToggleHelp = onToggleHelp;
  }

  setBindings(b: Bindings): void {
    this.bindings = b;
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
    const f: InputFrame = {
      moveX: (k.has(b.right) ? 1 : 0) - (k.has(b.left) ? 1 : 0),
      moveY: (k.has(b.down) ? 1 : 0) - (k.has(b.up) ? 1 : 0),
      sprint: k.has(b.sprint),
      kickHeld: k.has(b.kick),
      passUp: e.has(b.passUp),
      passDown: e.has(b.passDown),
      kickRelease: this.kickReleased,
      dropGoal: e.has(b.dropGoal),
      action: e.has(b.action),
      switchPlayer: e.has(b.switch),
      option1: e.has(b.opt1),
      option2: e.has(b.opt2),
      option3: e.has(b.opt3),
    };
    this.edges.clear();
    this.kickReleased = false;
    return f;
  }
}
