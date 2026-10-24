import { RugbyEngine } from "../src/game/engine";
import { getTeam, getStadium } from "../src/game/data";
import { Renderer, renderStadiumThumb } from "../src/game/render";
import { Director } from "../src/game/director";
import { DEFAULT_BINDINGS } from "../src/game/controls";
import { IDLE_INPUT } from "../src/game/input";

// ---- minimal canvas mock ----
let calls = 0;
function makeCtx(canvas: any) {
  const ctx: any = {
    canvas, font: "", fillStyle: "", textAlign: "left", textBaseline: "top", globalAlpha: 1, imageSmoothingEnabled: true,
    fillRect: (x: number, y: number, w: number, h: number) => { calls++; if (![x, y, w, h].every(Number.isFinite)) throw new Error(`fillRect NaN ${x},${y},${w},${h}`); },
    fillText: (s: string, x: number, y: number) => { calls++; if (typeof s !== "string" || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`fillText bad ${s} ${x} ${y}`); },
    measureText: (s: string) => ({ width: s.length * 8 }),
    drawImage: (img: any, ...rest: number[]) => { calls++; if (!img) throw new Error("drawImage null"); if (!rest.every(Number.isFinite)) throw new Error("drawImage NaN " + rest.join(",")); },
    getImageData: (x: number, y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: () => {}, createPattern: () => ({}), clearRect: () => {}, save: () => {}, restore: () => {},
    // Gradient stubs so cinematic camera shots can be exercised headlessly.
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    closePath: () => {}, arc: () => {},
    translate: () => {}, rotate: () => {}, scale: () => {}, beginPath: () => {}, ellipse: () => {}, fill: () => {}, stroke: () => {},
    setLineDash: () => {}, lineTo: () => {}, moveTo: () => {},
  };
  return ctx;
}
(globalThis as any).document = {
  createElement: (tag: string) => {
    if (tag !== "canvas") throw new Error("only canvas");
    const c: any = { width: 0, height: 0 };
    c.getContext = () => makeCtx(c);
    return c;
  },
};
(globalThis as any).window = globalThis;

const canvas: any = document.createElement("canvas"); canvas.width = 1280; canvas.height = 720;
const engine = new RugbyEngine({ home: getTeam("nzl"), away: getTeam("rsa"), userTeam: null, halfSeconds: 60, difficulty: "normal" });
const stadium = getStadium("edenpark");
const renderer = new Renderer(canvas, stadium, engine, DEFAULT_BINDINGS);
const director = new Director(engine, stadium, { attract: false, competition: "Test Cup", bindings: DEFAULT_BINDINGS });
const scenes = new Set<string>();
let frames = 0; const dt = 1 / 60; let skipNext = false;
while (!director.done && frames < 60 * 600) {
  const f = director.update(dt, skipNext, false); skipNext = false;
  scenes.add(director.scene);
  if (f.stepEngine) { engine.update(dt, IDLE_INPUT); director.afterStep(); }
  renderer.render(engine, dt, f);
  if (f.stepEngine && renderer.lastSnapshot) director.record(renderer.lastSnapshot, dt);
  if (director.scene === "intro" && frames === 200) skipNext = true; // test skip
  frames++;
}
console.log("frames", frames, "done", director.done, "scenes", [...scenes].join(","), "score", engine.score, "tries", engine.tries, "drawcalls", calls);
if (!scenes.has("try")) console.log("WARN: no try scene exercised (random)");
if (!director.done) throw new Error("did not finish");
// user-controlled with HUD paths
const e2 = new RugbyEngine({ home: getTeam("eng"), away: getTeam("fra"), userTeam: 0, halfSeconds: 30, difficulty: "easy" });
const r2 = new Renderer(canvas, getStadium("twickenham"), e2, DEFAULT_BINDINGS);
const d2 = new Director(e2, getStadium("twickenham"), { attract: false, competition: "Six Nations", bindings: DEFAULT_BINDINGS, skipIntro: true });
for (let i = 0; i < 60 * 200 && !d2.done; i++) {
  const f = d2.update(dt, false, false);
  if (f.stepEngine) { e2.update(dt, { ...IDLE_INPUT, action: i % 40 === 0, option1: i % 50 === 0, moveX: 1, sprint: true, kickHeld: i % 300 < 20, passUp: i % 90 === 0 }); d2.afterStep(); }
  r2.render(e2, dt, f);
  if (f.stepEngine && r2.lastSnapshot) d2.record(r2.lastSnapshot, dt);
}
console.log("user match done", d2.done, e2.score);

// Card cutscene flow: force a card in open play and record every scene the director visits.
{
  const e3 = new RugbyEngine({ home: getTeam("nzl"), away: getTeam("rsa"), userTeam: 0, halfSeconds: 60, difficulty: "normal" });
  const r3 = new Renderer(canvas, getStadium("edenpark"), e3, DEFAULT_BINDINGS);
  const d3 = new Director(e3, getStadium("edenpark"), { attract: false, competition: "Rugby World Cup", bindings: DEFAULT_BINDINGS, skipIntro: true });
  const seen: string[] = [];
  let carded = false;
  for (let i = 0; i < 60 * 90 && !d3.done; i++) {
    const f = d3.update(dt, false, false);
    if (seen[seen.length - 1] !== d3.scene) seen.push(d3.scene);
    if (f.stepEngine) {
      e3.update(dt, { ...IDLE_INPUT, action: i % 40 === 0, moveX: 1 });
      if (!carded && i > 600 && e3.phase === "play") { carded = true; e3.showCard(e3.pl(1, 7), "yellow", "a high tackle"); }
      d3.afterStep();
    }
    r3.render(e3, dt, f);
    if (f.stepEngine && r3.lastSnapshot) d3.record(r3.lastSnapshot, dt);
    if (carded && seen.includes("card") && d3.scene === "live" && seen.length > 4) break;
  }
  const flow = seen.join(" > ");
  console.log("card flow:", flow);
  const want = ["stingerIn", "replay", "stingerOut", "card", "live"];
  let at = flow.indexOf("stingerIn");
  for (const w of want) { const j = flow.indexOf(w, at); if (j < 0) throw new Error("card cutscene missing step: " + w); at = j; }
  console.log("CARD_CUTSCENE_OK");
}
const thumb: any = document.createElement("canvas"); thumb.width = 320; thumb.height = 180;
renderStadiumThumb(thumb, getStadium("suncorp"));
console.log("RENDER OK");
