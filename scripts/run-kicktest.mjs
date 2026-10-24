import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({ entryPoints: ["scripts/kicktest.ts"], bundle: true, platform: "node", format: "esm", outfile: "/tmp/kicktest.mjs", logLevel: "error", alias: { "@": "./src" } });
process.exit(spawnSync("node", ["/tmp/kicktest.mjs"], { stdio: "inherit" }).status ?? 1);
