import { shell } from "electron";
import { autoUpdater } from "electron-updater";
import {
  UpdateController,
  detectUpdateMode,
  type UpdaterAdapter,
} from "./update-controller";
import type { UpdateState } from "../shared/contracts";

interface CreateUpdaterOptions {
  currentVersion: string;
  isPackaged: boolean;
  isProcessing: () => boolean;
  beforeInstall: () => Promise<void>;
  onInstallReady: () => void;
  onState: (state: UpdateState) => void;
}

export function createUpdater(options: CreateUpdaterOptions): UpdateController {
  autoUpdater.logger = console;
  return new UpdateController({
    updater: autoUpdater as unknown as UpdaterAdapter,
    currentVersion: options.currentVersion,
    mode: detectUpdateMode(options.isPackaged, process.env),
    isProcessing: options.isProcessing,
    beforeInstall: options.beforeInstall,
    onInstallReady: options.onInstallReady,
    openExternal: (url) => shell.openExternal(url),
    onState: options.onState,
  });
}
