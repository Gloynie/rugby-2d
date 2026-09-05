import { build } from "esbuild";
import { spawnSync } from "node:child_process";

await build({
  entryPoints: ["scripts/ultimate-test.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "/tmp/ultimate-test.mjs",
  logLevel: "error",
  alias: { "@": "./src" },
});
const result = spawnSync("node", ["/tmp/ultimate-test.mjs"], { stdio: "inherit" });
process.exit(result.status ?? 1);
