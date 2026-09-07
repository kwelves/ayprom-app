import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  getMakeNsisPath,
  getNsisPluginsPath,
} = require("app-builder-lib/out/toolsets/windows");
const root = path.resolve(".tmp", `installer-qa-${Date.now()}`);
await fs.mkdir(root, { recursive: true });
const compiler = await getMakeNsisPath();
const plugins = await getNsisPluginsPath();
const executable = path.join(root, "shortcuts-qa.exe");
execFileSync(
  compiler.path,
  [
    "/V2",
    `/DQA_OUTPUT=${executable}`,
    `/DQA_INCLUDES=${path.resolve("node_modules/app-builder-lib/templates/nsis/include")}`,
    `/DQA_PLUGINS=${path.join(plugins, "x86-unicode")}`,
    `/DQA_INSTALLER=${path.resolve("build/installer.nsh")}`,
    path.resolve("tests/installer-shortcuts.nsi"),
  ],
  {
    env: { ...process.env, ...compiler.env },
    windowsHide: true,
    stdio: "pipe",
  },
);
for (const args of [[], ["--no-desktop-shortcut"]]) {
  execFileSync(executable, args, { windowsHide: true, timeout: 30000 });
}
const report = {
  checks: [
    "Default selection creates a shortcut",
    "--no-desktop-shortcut initializes the unchecked state",
    "Explicit checked choice creates and recreates a real .lnk",
    "Explicit unchecked choice removes the app .lnk on reinstall",
    "Silent update preserves absent and existing shortcuts",
  ],
  errors: [],
  scope:
    "Actual compiled NSIS include and filesystem operations; wizard mouse interaction is not tested.",
};
await fs.writeFile(
  path.join(root, "report.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify({ root, ...report }, null, 2));
