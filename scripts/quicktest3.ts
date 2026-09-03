import { RugbyEngine } from "../src/game/engine";
import { getTeam, getStadium, pickKits } from "../src/game/data";
import { GameRuntime } from "../src/game/runtime";
import { DEFAULT_BINDINGS } from "../src/game/controls";
import type { MatchConfig } from "../src/game/types";

const home = getTeam("rsa"), away = getTeam("nzl");
const stadium = getStadium("ellispark");
const kits = pickKits(home, away);
const config: MatchConfig = {
  home, away, userTeam: 0, halfSeconds: 15, difficulty: "normal",
  homeColor: kits.home, awayColor: kits.away, competition: "Friendly", stadiumId: stadium.id,
};

let raf: any = null;
const ctx: any = {
  canvas: { width: 1280, height: 720 }, imageSmoothingEnabled: false, font: "", fillStyle: "",
  textAlign: "left", textBaseline: "top", globalAlpha: 1,
  fillRect: () => {}, fillText: () => {}, measureText: (s: string) => ({ width: s.length * 8 }),
  drawImage: () => {}, getImageData: (x: number, y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  putImageData: () => {}, createPattern: () => ({}), clearRect: () => {}, save: () => {}, restore: () => {},
  translate: () => {}, rotate: () => {}, scale: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
  arc: () => {}, fill: () => {}, stroke: () => {}, setLineDash: () => {}, ellipse: () => {},
};
const canvas: any = { width: 1280, height: 720, getContext: () => ctx, style: {} };
(globalThis as any).document = { createElement: (tag: string) => { if (tag !== "canvas") throw new Error("unexpected element: " + tag); const c: any = { width: 0, height: 0, style: {} }; c.getContext = () => ctx; return c; }, fonts: { load: () => Promise.resolve([]) } };
(globalThis as any).window = { addEventListener: () => {}, removeEventListener: () => {} };
let perfNow = 0;
(globalThis as any).performance = { now: () => perfNow };
(globalThis as any).requestAnimationFrame = (fn: any) => { raf = fn; return 1; };
(globalThis as any).cancelAnimationFrame = () => {};
(globalThis as any).Image = class { onload: any; src: any; width = 0; height = 0 };

let finished = false;
const rt = new GameRuntime({
  canvas, config, stadium, bindings: DEFAULT_BINDINGS, competition: "Friendly",
  onFinish: (r) => { finished = true; console.log("ONFINISH score=", r.homeScore, r.awayScore, "tries=", r.homeTries, r.awayTries); },
  onPauseToggle: () => {},
});

async function run() {
  await rt.start();
  console.log("started: scene=", rt.director.scene);
  let frames = 0;
  let scenes = new Set<string>();
  while (!finished && frames < 60 * 90) {
    perfNow = frames * (1000 / 60);
    raf(performance.now());
    scenes.add(rt.director.scene);
    frames++;
    if (frames === 300) console.log("t=5s scene=", rt.director.scene);
    if (frames === 600) console.log("t=10s scene=", rt.director.scene);
    if (frames === 1500) console.log("t=25s scene=", rt.director.scene);
    if (frames === 2700) console.log("t=45s scene=", rt.director.scene);
    if (frames === 3600) console.log("t=60s scene=", rt.director.scene, "engine phase=", rt.engine.phase);
  }
  console.log("scenes visited:", [...scenes].join(","));
  if (!finished) throw new Error("never finished at frames=" + frames);
  console.log("QUICKMATCH OK");
}
run().catch((e) => { console.error("ERR", e.message); process.exit(1); });
