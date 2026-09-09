import { _electron as electron, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url),
  root = path.resolve(".tmp", "presets-qa-" + Date.now());
await fs.mkdir(root, { recursive: true });
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const launch = () =>
  electron.launch({
    executablePath: require("electron"),
    args: [".", "--user-data-dir=" + path.join(root, "profile")],
    env,
    timeout: 60000,
  });
let app = await launch();
const checks = [];
try {
  let page = await app.firstWindow();
  await page.setViewportSize({ width: 1024, height: 700 });
  await expect(page.getByLabel("Пресет", { exact: true })).toHaveValue(
    "ayprom-standard",
  );
  await page.getByLabel("Заполнение кадра: значение").fill("0.7");
  await page.getByTitle("Дублировать", { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Preset QA");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("textbox")).toBeFocused();
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  const id = await page.getByLabel("Пресет", { exact: true }).inputValue();
  checks.push("Duplicate and keyboard focus trap");
  await page
    .getByRole("button", { name: "Переименовать", exact: true })
    .click();
  await dialog.getByRole("textbox").fill("Renamed QA");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByLabel("Ширина холста: значение").fill("200");
  await page.getByTitle("Сохранить изменения", { exact: true }).click();
  await page
    .getByLabel("Пресет", { exact: true })
    .selectOption("ayprom-standard");
  await expect(page.getByLabel("Заполнение кадра: значение")).toHaveValue(
    "0.7",
  );
  await page
    .getByTitle("Сбросить к сохранённым значениям", { exact: true })
    .click();
  await expect(page.getByLabel("Заполнение кадра: значение")).toHaveValue(
    "0.82",
  );
  await page.getByLabel("Пресет", { exact: true }).selectOption(id);
  await expect(page.getByLabel("Ширина холста: значение")).toHaveValue("200");
  await page.getByLabel("Ширина холста: значение").fill("300");
  await page
    .getByTitle("Сбросить к сохранённым значениям", { exact: true })
    .click();
  await expect(page.getByLabel("Ширина холста: значение")).toHaveValue("200");
  checks.push("Rename Save Reset and builtin session draft");
  await page.getByLabel("Тема", { exact: true }).selectOption("dark");
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const s = await window.ayprom.loadState();
        return (
          s.presets.some(
            (p) => p.name === "Renamed QA" && p.processing.canvasWidth === 200,
          ) && s.theme === "dark"
        );
      }),
    )
    .toBe(true);
  await app.close();
  app = await launch();
  page = await app.firstWindow();
  await page.setViewportSize({ width: 1024, height: 700 });
  await expect(
    page
      .getByLabel("Пресет", { exact: true })
      .locator("option")
      .filter({ hasText: "Renamed QA" }),
  ).toHaveCount(1);
  await expect(page.getByLabel("Тема", { exact: true })).toHaveValue("dark");
  await page.getByLabel("Пресет", { exact: true }).selectOption(id);
  await expect(page.getByLabel("Ширина холста: значение")).toHaveValue("200");
  checks.push("Preset and theme survive complete process restart");
  await page.getByTitle("Удалить пресет", { exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  await expect(page.getByLabel("Пресет", { exact: true })).toHaveValue(
    "ayprom-standard",
  );
  await expect(
    page.getByTitle("Удалить пресет", { exact: true }),
  ).toBeDisabled();
  checks.push("Delete custom; built-in delete disabled");
  await fs.writeFile(
    path.join(root, "report.json"),
    JSON.stringify({ checks }, null, 2),
  );
  console.log(JSON.stringify({ root, checks }, null, 2));
} finally {
  await app.close();
}
