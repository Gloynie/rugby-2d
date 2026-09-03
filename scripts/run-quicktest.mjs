import { build } from "esbuild";
import { spawnSync } from "node:child_process";
const entry = process.argv[2] || "scripts/quicktest.ts";
await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile: "/tmp/qt.mjs", logLevel: "error" });
const r = spawnSync("node", ["/tmp/qt.mjs"], { stdio: "inherit" });
process.exit(r.status ?? 1);
