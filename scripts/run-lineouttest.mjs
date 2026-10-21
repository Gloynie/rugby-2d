import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({ entryPoints: ["scripts/lineouttest.ts"], bundle: true, platform: "node", format: "esm", outfile: "/tmp/lineouttest.mjs", logLevel: "error", alias: { "@": "./src" } });
process.exit(spawnSync("node", ["/tmp/lineouttest.mjs"], { stdio: "inherit" }).status ?? 1);
