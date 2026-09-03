import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({ entryPoints: ["scripts/career-test.ts"], bundle: true, platform: "node", format: "esm", outfile: "/tmp/career-test.mjs", logLevel: "error" });
const r = spawnSync("node", ["/tmp/career-test.mjs"], { stdio: "inherit" });
process.exit(r.status ?? 1);
