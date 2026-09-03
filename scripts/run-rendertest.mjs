import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({ entryPoints: ["scripts/rendertest.ts"], bundle: true, platform: "node", format: "esm", outfile: "/tmp/rendertest.mjs", logLevel: "error", alias: { "@": "./src" } });
const r = spawnSync("node", ["/tmp/rendertest.mjs"], { stdio: "inherit" });
process.exit(r.status ?? 1);
