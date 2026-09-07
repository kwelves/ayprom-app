import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { renderImage } from "../src/processing/core";
import { STANDARD } from "../src/shared/contracts";
import { scanRoot } from "../src/processing/files";
// The reference is immutable Git history, never a second maintained implementation.
const input = process.argv[2];
if (!input) {
  console.log(
    "NOT RUN: укажите папку реальных фото: npm run regression -- <folder>. Без fixtures equivalence не подтверждена.",
  );
  process.exit(2);
}
const directory = path.resolve(input);
const run = path.resolve(".tmp", "regression-" + Date.now());
await fs.mkdir(run, { recursive: true });
const legacy = execFileSync(
  "git",
  ["show", "cfa8c91:enhance-product-photos-folder-for-all.mjs"],
  { encoding: "utf8" },
);
await fs.writeFile(path.join(run, "reference.mjs"), legacy);
await fs.copyFile(
  "watermark-pattern-figma.svg",
  path.join(run, "watermark-pattern-figma.svg"),
);
const scanned = await scanRoot(directory, true);
const report: object[] = [];
let index = 0;
for (const folder of scanned.folders)
  for (const file of folder.files) {
    const source = path.join(folder.dir, file),
      caseDir = path.join(run, String(++index));
    await fs.mkdir(caseDir);
    await fs.copyFile(
      source,
      path.join(caseDir, "fixture" + path.extname(file)),
    );
    execFileSync(process.execPath, [path.join(run, "reference.mjs")], {
      cwd: caseDir,
      stdio: "pipe",
      timeout: 300000,
    });
    const actual = await renderImage(
      source,
      STANDARD,
      path.resolve("watermark-pattern-figma.svg"),
    );
    const expected = await sharp(path.join(caseDir, "1.png"))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const decoded = await sharp(actual)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const sameGeometry =
      JSON.stringify(expected.info) === JSON.stringify(decoded.info);
    let differences = 0,
      maxDelta = 0;
    for (let i = 0; i < expected.data.length; i++) {
      const delta = Math.abs(expected.data[i] - decoded.data[i]);
      if (delta) {
        differences++;
        maxDelta = Math.max(maxDelta, delta);
      }
    }
    report.push({
      source,
      sameGeometry,
      differingChannels: differences,
      maxDelta,
    });
    if (!sameGeometry || differences) process.exitCode = 1;
  }
await fs.writeFile(
  path.join(run, "report.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    {
      images: index,
      report: path.join(run, "report.json"),
      equal: !process.exitCode,
    },
    null,
    2,
  ),
);
if (!index) process.exitCode = 2;
