import {
  updateStateSchema,
  type UpdateMode,
  type UpdateState,
} from "../shared/contracts";

export const OFFICIAL_RELEASES_URL =
  "https://github.com/kwelves/ayprom-app/releases";

export function detectUpdateMode(
  isPackaged: boolean,
  environment: NodeJS.ProcessEnv,
): UpdateMode {
  if (!isPackaged) return "development";
  return environment.PORTABLE_EXECUTABLE_FILE ||
    environment.PORTABLE_EXECUTABLE_DIR
    ? "portable"
    : "installed";
}

interface VersionInfo {
  version: string;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdaterAdapter {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(event: "update-available", listener: (info: VersionInfo) => void): unknown;
  on(
    event: "update-not-available",
    listener: (info: VersionInfo) => void,
  ): unknown;
  on(
    event: "download-progress",
    listener: (progress: DownloadProgress) => void,
  ): unknown;
  on(
    event: "update-downloaded",
    listener: (info: VersionInfo) => void,
  ): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
}

interface UpdateControllerOptions {
  updater: UpdaterAdapter;
  currentVersion: string;
  mode: UpdateMode;
  isProcessing: () => boolean;
  beforeInstall: () => Promise<void>;
  onInstallReady: () => void;
  openExternal: (url: string) => Promise<unknown>;
  onState: (state: UpdateState) => void;
}

export class UpdateController {
  private state: UpdateState;
  private availableVersion = "";

  constructor(private readonly options: UpdateControllerOptions) {
    this.state =
      options.mode === "portable"
        ? {
            status: "unsupported-portable",
            mode: "portable",
            currentVersion: options.currentVersion,
          }
        : {
            status: "idle",
            mode: options.mode,
            currentVersion: options.currentVersion,
          };
    if (options.mode !== "installed") return;

    options.updater.autoDownload = false;
    options.updater.autoInstallOnAppQuit = false;
    options.updater.on("update-available", (info) => {
      this.availableVersion = info.version;
      this.setState({
        status: "available",
        mode: "installed",
        currentVersion: options.currentVersion,
        availableVersion: info.version,
      });
    });
    options.updater.on("update-not-available", () => {
      this.setState({
        status: "up-to-date",
        mode: "installed",
        currentVersion: options.currentVersion,
      });
    });
    options.updater.on("download-progress", (progress) => {
      this.setState({
        status: "downloading",
        mode: "installed",
        currentVersion: options.currentVersion,
        availableVersion: this.availableVersion,
        progress: Math.min(100, Math.max(0, progress.percent)),
        bytesPerSecond: Math.max(0, progress.bytesPerSecond),
        transferred: Math.max(0, progress.transferred),
        total: Math.max(0, progress.total),
      });
    });
    options.updater.on("update-downloaded", (info) => {
      this.availableVersion = info.version;
      this.setState({
        status: "downloaded",
        mode: "installed",
        currentVersion: options.currentVersion,
        availableVersion: info.version,
      });
    });
    options.updater.on("error", (error) => {
      const message = (error?.message || String(error)).slice(0, 500);
      this.setState({
        status: "error",
        mode: "installed",
        currentVersion: options.currentVersion,
        error: message || "Неизвестная ошибка обновления",
      });
    });
  }

  getState(): UpdateState {
    return structuredClone(this.state);
  }

  async checkForUpdates(): Promise<UpdateState> {
    if (this.options.mode !== "installed") return this.getState();
    if (
      this.state.status === "checking" ||
      this.state.status === "available" ||
      this.state.status === "downloading" ||
      this.state.status === "downloaded"
    )
      return this.getState();
    this.setState({
      status: "checking",
      mode: "installed",
      currentVersion: this.options.currentVersion,
    });
    try {
      await this.options.updater.checkForUpdates();
    } catch (error) {
      this.setError(error);
    }
    return this.getState();
  }

  async downloadUpdate(): Promise<UpdateState> {
    if (this.options.mode !== "installed") return this.getState();
    if (this.state.status !== "available") {
      throw new Error("Обновление ещё не найдено");
    }
    this.setState({
      status: "downloading",
      mode: "installed",
      currentVersion: this.options.currentVersion,
      availableVersion: this.state.availableVersion,
      progress: 0,
      bytesPerSecond: 0,
      transferred: 0,
      total: 0,
    });
    try {
      await this.options.updater.downloadUpdate();
    } catch (error) {
      this.setError(error);
    }
    return this.getState();
  }

  async installUpdate(): Promise<void> {
    if (this.options.mode !== "installed" || this.state.status !== "downloaded")
      throw new Error("Обновление не готово к установке");
    if (this.options.isProcessing())
      throw new Error("Дождитесь завершения обработки фотографий");
    await this.options.beforeInstall();
    if (this.options.isProcessing())
      throw new Error("Дождитесь завершения обработки фотографий");
    this.options.onInstallReady();
    this.options.updater.quitAndInstall(false, true);
  }

  async openReleases(): Promise<void> {
    await this.options.openExternal(OFFICIAL_RELEASES_URL);
  }

  private setError(error: unknown) {
    const message = (
      error instanceof Error ? error.message : String(error)
    ).slice(0, 500);
    this.setState({
      status: "error",
      mode: "installed",
      currentVersion: this.options.currentVersion,
      error: message || "Неизвестная ошибка обновления",
    });
  }

  private setState(state: UpdateState) {
    this.state = updateStateSchema.parse(state);
    this.options.onState(this.getState());
  }
}
