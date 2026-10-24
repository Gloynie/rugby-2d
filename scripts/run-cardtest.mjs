import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({ entryPoints: ["scripts/cardtest.ts"], bundle: true, platform: "node", format: "esm", outfile: "/tmp/cardtest.mjs", logLevel: "error", alias: { "@": "./src" } });
process.exit(spawnSync("node", ["/tmp/cardtest.mjs"], { stdio: "inherit" }).status ?? 1);
