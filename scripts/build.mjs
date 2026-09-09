import { build } from "esbuild";
import { build as viteBuild } from "vite";
import { mkdir } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: {
    "main/index": "src/main/index.ts",
    "preload/index": "src/preload/index.ts",
    "processing/worker": "src/processing/worker.ts",
    cli: "src/cli.ts",
  },
  outdir: "dist",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron", "electron-updater", "sharp"],
  sourcemap: false,
});
await viteBuild();
