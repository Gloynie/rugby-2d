import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({ entryPoints: ["scripts/passtest.ts"], bundle: true, platform: "node", format: "esm", outfile: "/tmp/passtest.mjs", logLevel: "error", alias: { "@": "./src" } });
process.exit(spawnSync("node", ["/tmp/passtest.mjs"], { stdio: "inherit" }).status ?? 1);
