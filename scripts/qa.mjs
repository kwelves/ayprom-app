import { _electron as electron, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
const require = createRequire(import.meta.url);
const version = JSON.parse(
  await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
).version;
const target = process.argv[2];
const root = path.resolve(".tmp", "qa-" + Date.now());
await fs.mkdir(root, { recursive: true });
const source = path.join(root, "Products");
const output = path.join(root, "Output");
await fs.mkdir(path.join(source, "Nested"), { recursive: true });
await fs.mkdir(output);
const photo = path.join(source, "sample.png");
if (process.argv[3]) await fs.copyFile(path.resolve(process.argv[3]), photo);
else
  await sharp({
    create: {
      width: 96,
      height: 72,
      channels: 4,
      background: { r: 130, g: 155, b: 175, alpha: 0.8 },
    },
  })
    .png()
    .toFile(photo);
await fs.copyFile(photo, path.join(source, "Nested", "second.png"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.AYPROM_DISABLE_UPDATE_CHECK = "1";
const application = await electron.launch({
  executablePath: target ? path.resolve(target) : require("electron"),
  args: target
    ? ["--user-data-dir=" + path.join(root, "profile")]
    : [".", "--user-data-dir=" + path.join(root, "profile")],
  env,
  timeout: 60000,
});
const report = {
  root,
  target: target ?? "development build",
  fixture: process.argv[3] ?? "synthetic",
  checks: [],
  errors: [],
};
try {
  const page = await application.firstWindow();
  page.on("pageerror", (e) => report.errors.push(String(e)));
  await expect(
    page.getByRole("heading", { name: "Пакетная обработка" }),
  ).toBeVisible();
  report.checks.push("Renderer loaded");
  await expect(page.locator(".app-version")).toContainText(`Версия ${version}`);
  const updateState = await page.evaluate(() => window.ayprom.getUpdateState());
  if (updateState.currentVersion !== version)
    throw Error("Updater version does not match package version");
  report.checks.push("Version and typed updater bridge");
  const security = await page.evaluate(() => ({
    node: typeof window.process,
    bridge: typeof window.ayprom.scan,
  }));
  if (security.node !== "undefined" || security.bridge !== "function")
    throw Error("Security boundary failed");
  report.checks.push("Node isolation and typed bridge");
  await page.getByLabel("Тема", { exact: true }).selectOption("dark");
  await page.screenshot({ path: path.join(root, "dark.png"), fullPage: true });
  await page.getByLabel("Тема", { exact: true }).selectOption("light");
  await application.evaluate(({ dialog }, source) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [source],
    });
  }, source);
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByText("2 изображений", { exact: false })).toBeVisible({
    timeout: 30000,
  });
  report.checks.push("Native input dialog and recursive utility scan");
  await page.getByLabel("Ширина холста: значение").fill("160");
  await page.getByTitle("Создать пресет с текущими настройками").click();
  await page.getByRole("dialog").getByRole("textbox").fill("QA preset");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  await expect(page.getByLabel("Пресет", { exact: true })).toHaveValue(/.+/);
  report.checks.push("Custom preset creation");
  await application.evaluate(({ dialog }, output) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [output],
    });
  }, output);
  await page
    .getByRole("button", { name: "Выбрать папку результата", exact: true })
    .click();
  await page.screenshot({
    path: path.join(root, "light-queue.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Запустить обработку", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Обработка завершена", exact: true }),
  ).toBeVisible({ timeout: 180000 });
  const result = await sharp(path.join(output, "Products", "1.png")).metadata();
  if (result.width !== 160) throw Error("Unexpected canvas");
  await fs.access(path.join(output, "Products", "Nested", "1.png"));
  report.checks.push(
    "Renderer -> preload -> main -> utility -> Sharp -> nested PNG output",
  );
  await page
    .getByRole("button", { name: "Предпросмотр Products", exact: true })
    .click();
  await expect(page.getByAltText("После обработки")).toBeVisible({
    timeout: 180000,
  });
  await expect(page.getByText("Полное качество", { exact: false })).toBeVisible(
    { timeout: 180000 },
  );
  await page.screenshot({
    path: path.join(root, "preview.png"),
    fullPage: true,
  });
  report.checks.push("Shared engine live preview");
  await page.getByLabel("Заполнение кадра: значение").fill("0.75");
  await page.getByLabel("Заполнение кадра: значение").fill("0.7");
  await expect(page.getByText("Полное качество", { exact: false })).toBeVisible(
    { timeout: 180000 },
  );
  report.checks.push("Latest preview after rapid setting updates");
  await page.getByRole("button", { name: "История", exact: true }).click();
  await expect(page.locator(".history-counts").first()).toContainText(
    "2 готово",
  );
  report.checks.push("Session history");
  const profile = await application.evaluate(({ app }) =>
    app.getPath("userData"),
  );
  const saved = JSON.parse(
    await fs.readFile(path.join(profile, "state.json"), "utf8"),
  );
  if (!saved.presets.some((p) => p.name === "QA preset"))
    throw Error("Preset persistence missing");
  report.checks.push("Preset saved in userData");
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(900, 650),
  );
  await page.screenshot({ path: path.join(root, "small.png"), fullPage: true });
  report.checks.push("900x650 layout");

  await page.getByRole("button", { name: "Обработка", exact: true }).click();
  await page
    .getByRole("button", { name: "Новая очередь", exact: true })
    .click();
  const cdp = await page.context().newCDPSession(page);
  const zone = await page.locator(".dropzone").boundingBox();
  for (const type of ["dragEnter", "dragOver", "drop"])
    await cdp.send("Input.dispatchDragEvent", {
      type,
      x: zone.x + zone.width / 2,
      y: zone.y + zone.height / 2,
      data: { items: [], files: [source], dragOperationsMask: 1 },
    });
  await expect(
    page.getByRole("button", { name: "Убрать Products", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  report.checks.push("Chromium file-backed folder drop through webUtils");
  await page
    .getByRole("button", { name: "Убрать Products", exact: true })
    .click();
  for (const type of ["dragEnter", "dragOver", "drop"])
    await cdp.send("Input.dispatchDragEvent", {
      type,
      x: zone.x + zone.width / 2,
      y: zone.y + zone.height / 2,
      data: {
        items: [],
        files: [photo, path.join(source, "Nested", "second.png")],
        dragOperationsMask: 1,
      },
    });
  await expect(
    page.getByRole("button", { name: "Убрать sample.png", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole("button", { name: "Убрать second.png", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  report.checks.push("Multiple file drop and queue removal");
  await page
    .getByRole("button", { name: "Запустить обработку", exact: true })
    .click();
  await page.getByRole("button", { name: "Остановить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Обработка отменена", exact: true }),
  ).toBeVisible({ timeout: 180000 });
  report.checks.push("Real batch cancellation from renderer");

  if (report.errors.length) throw Error(report.errors.join("\n"));
} finally {
  await fs.writeFile(
    path.join(root, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await application.close();
}
