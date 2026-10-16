import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({ entryPoints: ["scripts/musictest.ts"], bundle: true, platform: "node", format: "esm", outfile: "/tmp/musictest.mjs", logLevel: "error" });
const r = spawnSync("node", ["/tmp/musictest.mjs"], { stdio: "inherit" });
process.exit(r.status ?? 1);
