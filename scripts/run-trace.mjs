import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({ entryPoints: ["scripts/trace.ts"], bundle: true, platform: "node", format: "esm", outfile: "/tmp/trace.mjs", logLevel: "error" });
const r = spawnSync("node", ["/tmp/trace.mjs"], { stdio: "inherit" });
process.exit(r.status ?? 1);
