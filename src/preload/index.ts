import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { DesktopAPI, ProgressEvent } from "../shared/contracts";
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
