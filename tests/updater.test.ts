import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  OFFICIAL_RELEASES_URL,
  UpdateController,
  detectUpdateMode,
  type UpdaterAdapter,
} from "../src/main/update-controller";
import type { UpdateMode, UpdateState } from "../src/shared/contracts";

class FakeUpdater extends EventEmitter implements UpdaterAdapter {
  autoDownload = true;
  autoInstallOnAppQuit = true;
  checks = 0;
  downloads = 0;
  installs: Array<[boolean, boolean]> = [];

  async checkForUpdates() {
    this.checks += 1;
  }

  async downloadUpdate() {
    this.downloads += 1;
    return [];
  }

  quitAndInstall(isSilent = false, isForceRunAfter = false) {
    this.installs.push([isSilent, isForceRunAfter]);
  }
}

function setup(mode: UpdateMode = "installed") {
  const updater = new FakeUpdater();
  const states: UpdateState[] = [];
  const opened: string[] = [];
  let processing = false;
  let prepared = 0;
  let installReady = 0;
  const controller = new UpdateController({
    updater,
    currentVersion: "1.1.0",
    mode,
    isProcessing: () => processing,
    beforeInstall: async () => {
      prepared += 1;
    },
    onInstallReady: () => {
      installReady += 1;
    },
    openExternal: async (url) => {
      opened.push(url);
    },
    onState: (state) => states.push(state),
  });
  return {
    updater,
    controller,
    states,
    opened,
    setProcessing: (value: boolean) => {
      processing = value;
    },
    prepared: () => prepared,
    installReady: () => installReady,
  };
}

test("installed updater starts idle and never downloads or installs implicitly", () => {
  const { controller, updater } = setup();
  assert.deepEqual(controller.getState(), {
    status: "idle",
    mode: "installed",
    currentVersion: "1.1.0",
  });
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
});

test("runtime mode detects electron-builder portable environment", () => {
  assert.equal(
    detectUpdateMode(true, { PORTABLE_EXECUTABLE_FILE: "C:/AYPROM.exe" }),
    "portable",
  );
  assert.equal(detectUpdateMode(true, {}), "installed");
  assert.equal(
    detectUpdateMode(false, { PORTABLE_EXECUTABLE_FILE: "C:/AYPROM.exe" }),
    "development",
  );
});

test("manual check transitions through checking to up-to-date", async () => {
  const { controller, updater, states } = setup();
  await controller.checkForUpdates();
  assert.equal(updater.checks, 1);
  assert.equal(states.at(-1)?.status, "checking");

  updater.emit("update-not-available", { version: "1.1.0" });
  assert.deepEqual(controller.getState(), {
    status: "up-to-date",
    mode: "installed",
    currentVersion: "1.1.0",
  });
});

test("recheck cannot overwrite an available or downloaded update", async () => {
  const { controller, updater } = setup();
  updater.emit("update-available", { version: "1.1.1" });
  await controller.checkForUpdates();
  assert.equal(updater.checks, 0);
  assert.equal(controller.getState().status, "available");

  updater.emit("update-downloaded", { version: "1.1.1" });
  await controller.checkForUpdates();
  assert.equal(updater.checks, 0);
  assert.equal(controller.getState().status, "downloaded");
});

test("available update can report real download progress and completion", async () => {
  const { controller, updater } = setup();
  updater.emit("update-available", { version: "1.1.1" });
  assert.deepEqual(controller.getState(), {
    status: "available",
    mode: "installed",
    currentVersion: "1.1.0",
    availableVersion: "1.1.1",
  });

  await controller.downloadUpdate();
  assert.equal(updater.downloads, 1);
  updater.emit("download-progress", {
    percent: 47.4,
    bytesPerSecond: 2048,
    transferred: 470,
    total: 1000,
  });
  assert.deepEqual(controller.getState(), {
    status: "downloading",
    mode: "installed",
    currentVersion: "1.1.0",
    availableVersion: "1.1.1",
    progress: 47.4,
    bytesPerSecond: 2048,
    transferred: 470,
    total: 1000,
  });

  updater.emit("update-downloaded", { version: "1.1.1" });
  assert.deepEqual(controller.getState(), {
    status: "downloaded",
    mode: "installed",
    currentVersion: "1.1.0",
    availableVersion: "1.1.1",
  });
});

test("updater errors become renderer-safe state", () => {
  const { controller, updater } = setup();
  updater.emit("error", new Error("GitHub unavailable"));
  assert.deepEqual(controller.getState(), {
    status: "error",
    mode: "installed",
    currentVersion: "1.1.0",
    error: "GitHub unavailable",
  });
});

test("portable mode never invokes electron-updater and only opens official Releases", async () => {
  const { controller, updater, opened } = setup("portable");
  assert.deepEqual(controller.getState(), {
    status: "unsupported-portable",
    mode: "portable",
    currentVersion: "1.1.0",
  });
  await controller.checkForUpdates();
  await controller.downloadUpdate();
  assert.equal(updater.checks, 0);
  assert.equal(updater.downloads, 0);

  await controller.openReleases();
  assert.deepEqual(opened, [OFFICIAL_RELEASES_URL]);
  assert.equal(
    OFFICIAL_RELEASES_URL,
    "https://github.com/kwelves/ayprom-app/releases",
  );
});

test("downloaded update cannot interrupt photo processing", async () => {
  const fixture = setup();
  fixture.updater.emit("update-downloaded", { version: "1.1.1" });
  fixture.setProcessing(true);
  await assert.rejects(
    fixture.controller.installUpdate(),
    /Дождитесь завершения обработки/,
  );
  assert.equal(fixture.prepared(), 0);
  assert.deepEqual(fixture.updater.installs, []);
});

test("downloaded update installs only after explicit safe action", async () => {
  const fixture = setup();
  fixture.updater.emit("update-downloaded", { version: "1.1.1" });
  await fixture.controller.installUpdate();
  assert.equal(fixture.prepared(), 1);
  assert.equal(fixture.installReady(), 1);
  assert.deepEqual(fixture.updater.installs, [[false, true]]);
});

test("batch starting during install preparation still prevents restart", async () => {
  const updater = new FakeUpdater();
  let processing = false;
  let releasePreparation!: () => void;
  const preparation = new Promise<void>((resolve) => {
    releasePreparation = resolve;
  });
  let installReady = 0;
  const controller = new UpdateController({
    updater,
    currentVersion: "1.1.0",
    mode: "installed",
    isProcessing: () => processing,
    beforeInstall: () => preparation,
    onInstallReady: () => {
      installReady += 1;
    },
    openExternal: async () => {},
    onState: () => {},
  });
  updater.emit("update-downloaded", { version: "1.1.1" });

  const attempt = controller.installUpdate();
  await Promise.resolve();
  processing = true;
  releasePreparation();

  await assert.rejects(attempt, /Дождитесь завершения обработки/);
  assert.equal(installReady, 0);
  assert.deepEqual(updater.installs, []);
});
