import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
const version = JSON.parse(
  await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
).version;
const executable = path.resolve(
  process.argv[2] ?? `release/AYPROM-Portable-${version}.exe`,
);
const root = path.resolve(".tmp", "portable-qa-" + Date.now()),
  profile = path.join(root, "profile"),
  source = path.join(root, "Source"),
  output = path.join(root, "Output");
await fs.mkdir(source, { recursive: true });
await fs.mkdir(profile);
await fs.mkdir(output);
const input = path.join(source, "fixture.png");
if (process.argv[3]) await fs.copyFile(path.resolve(process.argv[3]), input);
else
  await sharp({
    create: {
      width: 96,
      height: 72,
      channels: 4,
      background: { r: 120, g: 165, b: 190, alpha: 0.8 },
    },
  })
    .png()
    .toFile(input);
const canvasWidth = process.argv[3] ? 1600 : 160;
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const processHandle = spawn(
  executable,
  ["--remote-debugging-port=0", "--user-data-dir=" + profile],
  { env, windowsHide: true, stdio: "ignore" },
);
processHandle.on("error", (error) => console.error(error));
let browser;
const report = {
  executable,
  root,
  fixture: process.argv[3] ?? "synthetic",
  canvasWidth,
  checks: [],
  errors: [],
};
try {
  let port;
  for (let i = 0; i < 90; i++) {
    try {
      port = (
        await fs.readFile(path.join(profile, "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
      break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!port) throw Error("Portable did not expose Chromium after extraction");
  browser = await chromium.connectOverCDP("http://127.0.0.1:" + port);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.waitForEvent("page"));
  page.on("pageerror", (error) => report.errors.push(String(error)));
  await expect(
    page.getByRole("heading", { name: "Пакетная обработка" }),
  ).toBeVisible();
  report.checks.push("Actual portable launcher extracted and opened renderer");
  const result = await page.evaluate(
    async ({ source, output, input, canvasWidth }) => {
      const state = await window.ayprom.loadState();
      const jobs = await window.ayprom.scan({ roots: [source], force: false });
      const processing = {
        canvasWidth,
        fillRatio: 0.82,
        alphaThreshold: 16,
        paddingRatio: 0.03,
        sharpen: { minAmount: 0.4, maxAmount: 2.8 },
        highlights: { knee: 175, ceiling: 232 },
      };
      const summaries = [];
      for (const format of ["png", "jpeg", "webp"])
        summaries.push(
          await window.ayprom.process({
            roots: [source],
            output,
            sameSource: false,
            force: false,
            conflict: "skip",
            processing,
            export: { ...state.export, format },
          }),
        );
      const preview = await window.ayprom.preview({
        input,
        processing,
        export: state.export,
        draft: false,
        requestId: 1,
      });
      return {
        jobs,
        summaries,
        preview: preview.after.startsWith("data:image/png;"),
      };
    },
    { source, output, input, canvasWidth },
  );
  if (
    result.jobs[0].total !== 1 ||
    result.summaries.some((s) => s.processed !== 1 || s.failed) ||
    !result.preview
  )
    throw Error(JSON.stringify(result));
  for (const name of ["1.png", "1.jpg", "1.webp"]) {
    const meta = await sharp(path.join(output, "Source", name)).metadata();
    if (meta.width !== canvasWidth) throw Error("Invalid output " + name);
  }
  report.checks.push(
    "Packaged Sharp and original watermark available",
    "PNG/JPEG/WebP processed through bridge and utility",
    "Full preview generated",
  );
  await page.screenshot({
    path: path.join(root, "portable.png"),
    fullPage: true,
  });
  await page.close();
  if (report.errors.length) throw Error(report.errors.join("\n"));
} finally {
  if (browser) await browser.close();
  await fs.writeFile(
    path.join(root, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (processHandle.exitCode === null) processHandle.kill();
}
