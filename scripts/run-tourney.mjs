import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({ entryPoints: ["scripts/tourney.ts"], bundle: true, platform: "node", format: "esm", outfile: "/tmp/tourney.mjs", logLevel: "error", alias: { "@": "./src" } });
const r = spawnSync("node", ["/tmp/tourney.mjs"], { stdio: "inherit" });
process.exit(r.status ?? 1);
