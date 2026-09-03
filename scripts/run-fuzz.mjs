import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({ entryPoints: ["scripts/fuzz.ts"], bundle: true, platform: "node", format: "esm", outfile: "/tmp/fuzz.mjs", logLevel: "error", alias: { "@": "./src" } });
const r = spawnSync("node", ["/tmp/fuzz.mjs"], { stdio: "inherit" });
process.exit(r.status ?? 1);
