import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({ entryPoints: ["scripts/dbtest.ts"], bundle: true, platform: "node", format: "esm", outfile: "/tmp/dbtest.mjs", logLevel: "error" });
const r = spawnSync("node", ["/tmp/dbtest.mjs"], { stdio: "inherit" });
process.exit(r.status ?? 1);
