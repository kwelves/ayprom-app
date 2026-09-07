import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  clipboard,
  session,
} from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  BRAND,
  batchSchema,
  scanSchema,
  previewSchema,
  pathSchema,
  stateSchema,
  type Summary,
  type ScanJob,
} from "../shared/contracts";
import { StateStore } from "./store";
import { runWorker, type RunningWorker } from "./workers";

app.setName(BRAND.name);
let window: BrowserWindow;
let store: StateStore;
let batch: RunningWorker<Summary> | undefined;
let preview: RunningWorker<unknown> | undefined;
const scanning = new Set<RunningWorker<ScanJob[]>>();
const rendererPath = path.join(__dirname, "../renderer/index.html");
const assetPath = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, "watermark-pattern-figma.svg")
    : path.join(app.getAppPath(), "watermark-pattern-figma.svg");
function handle(name: string, action: (payload: unknown) => unknown) {
  ipcMain.handle(name, (event, payload: unknown) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== pathToFileURL(rendererPath).href
    )
      throw new Error("Недоверенный IPC отправитель");
    return action(payload);
  });
}
async function main() {
  await app.whenReady();
  store = new StateStore(app.getPath("userData"));
  const state = await store.load();
  session.defaultSession.setPermissionRequestHandler(
    (_wc, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
    callback({
      cancel:
        !details.url.startsWith("file:") &&
        !details.url.startsWith("data:") &&
        !details.url.startsWith("devtools:"),
    }),
  );
  window = new BrowserWindow({
    width: state.window.width,
    height: state.window.height,
    minWidth: 900,
    minHeight: 650,
    title: BRAND.name,
    backgroundColor: "#11151b",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  handle("inputs", async (value) => {
    const files = z.boolean().optional().parse(value);
    const result = await dialog.showOpenDialog(window, {
      properties: files
        ? ["openFile", "multiSelections"]
        : ["openDirectory", "multiSelections"],
      filters: files
        ? [
            {
              name: "Изображения",
              extensions: ["png", "webp", "jpg", "jpeg", "avif", "tiff"],
            },
          ]
        : [],
    });
    return result.canceled ? [] : result.filePaths;
  });
  handle("output", async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  handle("scan", async (value) => {
    if (scanning.size >= 2)
      throw new Error("Дождитесь завершения сканирования");
    const worker = runWorker<ScanJob[]>(
      "scan",
      scanSchema.parse(value),
      assetPath(),
    );
    scanning.add(worker);
    try {
      return await worker.promise;
    } finally {
      scanning.delete(worker);
    }
  });
  handle("batch", async (value) => {
    if (batch) throw new Error("Обработка уже запущена");
    const request = batchSchema.parse(value);
    batch = runWorker<Summary>("batch", request, assetPath(), (event) => {
      if (!window.isDestroyed()) window.webContents.send("progress", event);
    });
    try {
      const result = await batch.promise;
      await store.addHistory(result);
      return result;
    } finally {
      batch = undefined;
    }
  });
  handle("cancel", () => batch?.cancel());
  handle("preview", async (value) => {
    const request = previewSchema.parse(value);
    preview?.child.kill();
    const worker = runWorker("preview", request, assetPath());
    preview = worker;
    try {
      return await worker.promise;
    } finally {
      if (preview === worker) preview = undefined;
    }
  });
  handle("cancel-preview", () => {
    preview?.child.kill();
    preview = undefined;
  });
  handle("load-state", () => store.get());
  handle("save-state", (value) => store.save(stateSchema.parse(value)));
  handle("open-output", async (value) => {
    const target = pathSchema.parse(value);
    if (!path.isAbsolute(target)) throw new Error("Нужен абсолютный путь");
    const directory = (await fs.stat(target)).isDirectory()
      ? target
      : path.dirname(target);
    const error = await shell.openPath(directory);
    if (error) throw new Error(error);
  });
  handle("copy-report", (value) =>
    clipboard.writeText(z.string().max(1_000_000).parse(value)),
  );
  let closing = false;
  window.on("close", (event) => {
    if (closing) return;
    event.preventDefault();
    void (async () => {
      if (batch) {
        const answer = await dialog.showMessageBox(window, {
          type: "question",
          message: "Остановить обработку и закрыть приложение?",
          detail: "Текущее изображение будет безопасно сохранено.",
          buttons: ["Продолжить работу", "Остановить и закрыть"],
          defaultId: 0,
          cancelId: 0,
        });
        if (answer.response !== 1) return;
        batch.cancel();
        await batch.promise.catch(() => {});
      }
      preview?.child.kill();
      for (const worker of scanning) worker.child.kill();
      const [width, height] = window.getSize();
      await store
        .save({ ...store.get(), window: { width, height } })
        .catch(console.error);
      await store.flush().catch(console.error);
      closing = true;
      window.close();
    })();
  });
  await window.loadFile(rendererPath);
  window.show();
}
app.on("window-all-closed", () => app.quit());
void main().catch((error) => {
  dialog.showErrorBox(BRAND.name, String(error));
  app.quit();
});
