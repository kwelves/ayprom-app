import sharp from "sharp";
import path from "node:path";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { renderImage } from "./core";
import {
  exportSchema,
  batchSchema,
  type ExportSettings,
  type BatchRequest,
  type ProgressEvent,
  type Summary,
  type PreviewRequest,
} from "../shared/contracts";
import {
  scanRoot,
  validateRoots,
  rootNames,
  outputDirectory,
  keyPath,
  writeOutput,
  type Cancellation,
} from "./files";

sharp.concurrency(1);
sharp.cache({ memory: 64, files: 10, items: 30 });
export async function assertWatermark(asset: string): Promise<void> {
  try {
    await fs.access(asset);
  } catch {
    throw new Error(
      "Не найден watermark-pattern-figma.svg. Для AyProm Standard нужен оригинальный Figma asset.",
    );
  }
}
export async function encodeImage(
  rgba: Buffer,
  settings: ExportSettings,
): Promise<Buffer> {
  const value = exportSchema.parse(settings);
  if (value.format === "png") return rgba;
  if (value.format === "jpeg")
    return sharp(rgba)
      .flatten({ background: value.background })
      .jpeg({ quality: value.quality, progressive: value.progressive })
      .toBuffer();
  return sharp(rgba)
    .webp({
      quality: value.quality,
      lossless: value.lossless,
      alphaQuality: value.alphaQuality,
    })
    .toBuffer();
}
export async function processBatch(
  value: BatchRequest,
  asset: string,
  cancellation: Cancellation,
  emit: (e: ProgressEvent) => void,
): Promise<Summary> {
  const request = batchSchema.parse(value);
  const start = Date.now();
  await validateRoots(request);
  await assertWatermark(asset);
  const summary: Summary = {
    id: randomUUID(),
    date: new Date().toISOString(),
    processed: 0,
    skipped: 0,
    failed: 0,
    total: 0,
    cancelled: false,
    elapsedMs: 0,
    output: request.sameSource ? request.roots.join("; ") : request.output,
    format: request.export.format,
    errors: [],
  };
  const names = rootNames(request.roots);
  for (const [rootIndex, root] of request.roots.entries()) {
    if (cancellation.cancelled) break;
    try {
      const { folders } = await scanRoot(
        root,
        request.force,
        cancellation,
        emit,
      );
      const rootIsFile = (await fs.stat(root)).isFile();
      const sourceRoot = rootIsFile ? path.dirname(root) : root;
      const protectedPaths = new Set(
        folders.flatMap((f) =>
          f.files.map((file) => keyPath(path.join(f.dir, file))),
        ),
      );
      const total = folders.reduce((n, f) => n + f.files.length, 0);
      summary.total += total;
      let done = 0;
      emit({
        type: "job-started",
        root,
        total,
        destination: request.sameSource
          ? sourceRoot
          : path.join(request.output, names[rootIndex]),
      });
      for (const folder of folders) {
        if (cancellation.cancelled) break;
        const destinationDir = outputDirectory(
          sourceRoot,
          folder.dir,
          request.output,
          names[rootIndex],
          request.sameSource,
        );
        for (const [index, file] of folder.files.entries()) {
          if (cancellation.cancelled) break;
          const input = path.join(folder.dir, file);
          const destination = path.join(
            destinationDir,
            `${index + 1}.${request.export.format === "jpeg" ? "jpg" : request.export.format}`,
          );
          emit({ type: "file-started", root, path: input });
          try {
            // Read and finish the current image before honouring cancellation. No unsafe interruption of writes.
            const rendered = await renderImage(
              input,
              request.processing,
              asset,
            );
            const encoded = await encodeImage(rendered, request.export);
            const output = await writeOutput(
              encoded,
              destination,
              request.conflict,
              protectedPaths,
            );
            if (output) summary.processed++;
            else summary.skipped++;
            emit({
              type: output ? "file-completed" : "file-skipped",
              root,
              path: input,
              output: output ?? destination,
              done: ++done,
              total,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            summary.failed++;
            summary.errors.push({ path: input, message });
            emit({
              type: "file-error",
              root,
              path: input,
              message,
              done: ++done,
              total,
            });
          }
        }
      }
      emit({ type: "job-completed", root, cancelled: cancellation.cancelled });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failed++;
      summary.errors.push({ path: root, message });
      emit({
        type: "file-error",
        root,
        path: root,
        message,
        done: 0,
        total: 0,
      });
    }
  }
  summary.cancelled = cancellation.cancelled;
  summary.elapsedMs = Date.now() - start;
  emit({ type: "completed", summary });
  return summary;
}
export async function generatePreview(request: PreviewRequest, asset: string) {
  await assertWatermark(asset);
  const config = request.draft
    ? {
        ...request.processing,
        canvasWidth: Math.min(480, request.processing.canvasWidth),
      }
    : request.processing;
  const rendered = await renderImage(request.input, config, asset);
  const encoded = await encodeImage(rendered, request.export);
  const before = await sharp(request.input)
    .resize({
      width: 1000,
      height: 1000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  const mime =
    request.export.format === "jpeg"
      ? "image/jpeg"
      : `image/${request.export.format}`;
  return {
    requestId: request.requestId,
    before: `data:image/png;base64,${before.toString("base64")}`,
    after: `data:${mime};base64,${encoded.toString("base64")}`,
  };
}
