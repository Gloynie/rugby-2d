import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({ entryPoints: ["scripts/spritesheet.ts"], bundle: true, platform: "node", format: "esm", outfile: "/tmp/sheet.mjs", logLevel: "error", alias: { "@": "./src" } });
const r = spawnSync("node", ["/tmp/sheet.mjs"], { stdio: "inherit" });
process.exit(r.status ?? 1);
