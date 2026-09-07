import { scanSchema, batchSchema, previewSchema } from "../shared/contracts";
import { describeRoots } from "./files";
import { processBatch, generatePreview } from "./service";
const port = process.parentPort;
if (!port)
  throw new Error("Processing worker must run in Electron utilityProcess");
const cancellation = { cancelled: false };
let started = false;
port.on(
  "message",
  async ({
    data,
  }: {
    data: { kind: string; request?: unknown; asset: string };
  }) => {
    if (data.kind === "cancel") {
      cancellation.cancelled = true;
      return;
    }
    if (started) return;
    started = true;
    try {
      let result: unknown;
      if (data.kind === "scan") {
        const r = scanSchema.parse(data.request);
        result = await describeRoots(r.roots, r.force);
      } else if (data.kind === "batch")
        result = await processBatch(
          batchSchema.parse(data.request),
          data.asset,
          cancellation,
          (event) => port.postMessage({ event }),
        );
      else if (data.kind === "preview")
        result = await generatePreview(
          previewSchema.parse(data.request),
          data.asset,
        );
      else throw new Error("Unknown worker request");
      port.postMessage({ result });
    } catch (error) {
      port.postMessage({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
