import { contextBridge, ipcRenderer, webUtils } from "electron";
import {
  updateStateSchema,
  type DesktopAPI,
  type ProgressEvent,
  type UpdateState,
} from "../shared/contracts";
const api: DesktopAPI = {
  selectInputs: (files) => ipcRenderer.invoke("inputs", files),
  selectOutput: () => ipcRenderer.invoke("output"),
  pathsForFiles: (files) =>
    files.map((file) => webUtils.getPathForFile(file)).filter(Boolean),
  scan: (request) => ipcRenderer.invoke("scan", request),
  process: (request) => ipcRenderer.invoke("batch", request),
  cancel: () => ipcRenderer.invoke("cancel"),
  preview: (request) => ipcRenderer.invoke("preview", request),
  cancelPreview: () => ipcRenderer.invoke("cancel-preview"),
  loadState: () => ipcRenderer.invoke("load-state"),
  saveState: (state) => ipcRenderer.invoke("save-state", state),
  openOutput: (path) => ipcRenderer.invoke("open-output", path),
  copyReport: (text) => ipcRenderer.invoke("copy-report", text),
  getUpdateState: () =>
    ipcRenderer
      .invoke("update-state")
      .then((value) => updateStateSchema.parse(value)),
  checkForUpdates: () =>
    ipcRenderer
      .invoke("update-check")
      .then((value) => updateStateSchema.parse(value)),
  downloadUpdate: () =>
    ipcRenderer
      .invoke("update-download")
      .then((value) => updateStateSchema.parse(value)),
  installUpdate: () => ipcRenderer.invoke("update-install"),
  openUpdateReleases: () => ipcRenderer.invoke("update-open-releases"),
  onUpdateState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, value: UpdateState) =>
      callback(updateStateSchema.parse(value));
    ipcRenderer.on("update-state-changed", listener);
    return () => {
      ipcRenderer.removeListener("update-state-changed", listener);
    };
  },
  onProgress: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      value: ProgressEvent,
    ) => callback(value);
    ipcRenderer.on("progress", listener);
    return () => {
      ipcRenderer.removeListener("progress", listener);
    };
  },
};
contextBridge.exposeInMainWorld("ayprom", api);
