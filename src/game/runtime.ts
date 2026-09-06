import * as audio from "./audio";
import type { Bindings } from "./controls";
import { Director } from "./director";
import { RugbyEngine } from "./engine";
import { IDLE_INPUT, InputManager } from "./input";
import { Renderer } from "./render";
import type { InputFrame, MatchConfig, MatchResult, Stadium } from "./types";

const STEP = 1 / 60;

export interface RuntimeOptions {
  canvas: HTMLCanvasElement;
  config: MatchConfig;
  stadium: Stadium;
  bindings: Bindings;
  competition: string;
  attract?: boolean;
  skipIntro?: boolean;
  /** Latest input relayed from the invited online opponent. */
  remoteInput?: () => InputFrame;
  /** Called after each authoritative engine step (used to publish online snapshots). */
  onStep?: (engine: RugbyEngine) => void;
  onFinish?: (result: MatchResult) => void;
  onPauseToggle?: () => void;
}

let fontPromise: Promise<void> | null = null;
export function loadPixelFonts(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return Promise.resolve();
  if (!fontPromise) {
    const load = Promise.all([document.fonts.load('8px "PressStart2P"'), document.fonts.load('16px "VT323"')]).then(() => undefined);
    const timeout = new Promise<void>((res) => setTimeout(res, 1500));
    fontPromise = Promise.race([load, timeout]).catch(() => undefined);
  }
  return fontPromise;
}

export class GameRuntime {
  engine: RugbyEngine;
  renderer: Renderer;
  director: Director;
  input: InputManager | null;
  paused = false;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private stopped = false;
  private finished = false;
  private prevPhase = "";
  private prevTries = 0;
  private prevScore = 0;
  private prevCeremonyCue = "";

  constructor(private opts: RuntimeOptions) {
    this.engine = new RugbyEngine(opts.config);
    this.renderer = new Renderer(opts.canvas, opts.stadium, this.engine, opts.bindings);
    this.director = new Director(this.engine, opts.stadium, {
      attract: !!opts.attract,
      competition: opts.competition,
      bindings: opts.bindings,
      skipIntro: opts.skipIntro,
    });
    this.input = opts.attract
      ? null
      : new InputManager(
          opts.bindings,
          () => opts.onPauseToggle?.(),
          () => {
            this.renderer.showHelp = !this.renderer.showHelp;
          },
        );
  }

  async start(): Promise<void> {
    await loadPixelFonts();
    if (this.stopped) return;
    this.input?.attach();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.input?.detach();
  }

  setPaused(v: boolean): void {
    this.paused = v;
    if (!v) this.last = performance.now();
  }

  setBindings(b: Bindings): void {
    this.input?.setBindings(b);
    this.renderer.bindings = b;
  }

  private checkAudio(): void {
    const e = this.engine;
    const d = this.director;
    const ceremonyCue = d.ceremonyCue();
    if (ceremonyCue && ceremonyCue !== this.prevCeremonyCue) {
      audio.playAnthemCue(ceremonyCue === "home-anthem" ? 0 : 1);
    }
    this.prevCeremonyCue = ceremonyCue ?? "";
    // Start crowd when match is live
    if (d.scene === "live" && !audio.getCrowdActive()) {
      audio.startCrowd();
    }
    // Stop crowd when not in match scenes
    if (d.scene !== "live" && d.scene !== "try" && d.scene !== "replay" && audio.getCrowdActive()) {
      audio.stopCrowd();
    }
    // Phase transitions for sounds
    if (e.phase !== this.prevPhase) {
      if (e.phase === "tackle" && this.prevPhase === "play") {
        audio.playTackle();
      }
      this.prevPhase = e.phase;
    }
    // Try scored
    const totalTries = e.tries[0] + e.tries[1];
    if (totalTries > this.prevTries) {
      this.prevTries = totalTries;
      audio.playWhistle();
      setTimeout(() => audio.playCheer(), 300);
    }
    // Goal scored (conversion/penalty/drop goal)
    const totalScore = e.score[0] + e.score[1];
    if (totalScore > this.prevScore && totalTries === this.prevTries) {
      this.prevScore = totalScore;
      audio.playGoal();
    }
    this.prevScore = totalScore;
  }

  private loop = (now: number): void => {
    if (this.stopped) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const skip = this.input ? this.input.consumeSkip() : false;
    const inputFrame = this.input ? this.input.frame() : IDLE_INPUT;
    const frame = this.director.update(dt, skip && !this.paused, this.paused, inputFrame);
    this.checkAudio();
    let stepped = false;
    if (frame.stepEngine && !this.paused) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 4) {
        this.engine.update(
          STEP,
          inputFrame,
          this.opts.remoteInput?.() ?? null,
        );
        this.director.afterStep();
        this.opts.onStep?.(this.engine);
        this.acc -= STEP;
        n++;
        stepped = true;
      }
      if (n === 4) this.acc = 0;
    } else {
      this.acc = 0;
    }
    this.renderer.render(this.engine, this.paused ? 0 : dt, frame);
    if (stepped && this.renderer.lastSnapshot) this.director.record(this.renderer.lastSnapshot, dt);
    if (this.director.done && !this.finished) {
      this.finished = true;
      this.opts.onFinish?.(this.engine.result());
    }
    this.raf = requestAnimationFrame(this.loop);
  };
}
