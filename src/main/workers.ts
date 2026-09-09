import { app, utilityProcess, type UtilityProcess } from "electron";
import path from "node:path";
import type { ProgressEvent } from "../shared/contracts";
export interface RunningWorker<T> {
  child: UtilityProcess;
  promise: Promise<T>;
  cancel(): void;
}
export function runWorker<T>(
  kind: "scan" | "batch" | "preview",
  request: unknown,
  asset: string,
  onEvent: (event: ProgressEvent) => void = () => {},
): RunningWorker<T> {
  const child = utilityProcess.fork(
    path.join(__dirname, "../processing/worker.cjs"),
    [],
    {
      serviceName: `AYPROM ${kind}`,
      stdio: "pipe",
      env: {
        ...process.env,
        AYPROM_WATERMARK_CACHE: path.join(
          app.getPath("userData"),
          "watermark-cache",
        ),
      },
    },
  );
  let settled = false;
  const promise = new Promise<T>((resolve, reject) => {
    child.once("spawn", () => child.postMessage({ kind, request, asset }));
    child.on(
      "message",
      (message: { event?: ProgressEvent; error?: string; result?: T }) => {
        if (message.event) onEvent(message.event);
        if ("result" in message || message.error) {
          settled = true;
          if (message.error) reject(new Error(message.error));
          else resolve(message.result as T);
          child.kill();
        }
      },
    );
    child.once("exit", (code) => {
      if (!settled)
        reject(
          new Error(
            kind === "preview"
              ? "Preview cancelled"
              : `Процесс обработки завершился неожиданно (код ${code})`,
          ),
        );
    });
    child.stderr?.on("data", (chunk) =>
      console.error(`[${kind}] ${String(chunk).slice(0, 2000)}`),
    );
  });
  return {
    child,
    promise,
    cancel: () => child.postMessage({ kind: "cancel" }),
  };
}
