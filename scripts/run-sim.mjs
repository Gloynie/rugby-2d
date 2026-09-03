import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({
  entryPoints: ["scripts/simulate.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "/tmp/sim.mjs",
  logLevel: "error",
});
const r = spawnSync("node", ["/tmp/sim.mjs", ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(r.status ?? 1);
