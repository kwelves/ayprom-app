import { z } from "zod";
import { version } from "../../package.json";

export const BRAND = {
  name: "AYPROM",
  id: "com.ayprom.photo-processor",
  version,
};
export const processingSchema = z
  .object({
    canvasWidth: z.number().int().min(128).max(6000),
    fillRatio: z.number().min(0.05).max(1),
    alphaThreshold: z.number().int().min(0).max(254),
    paddingRatio: z.number().min(0).max(0.5),
    sharpen: z
      .object({
        minAmount: z.number().min(0).max(10),
        maxAmount: z.number().min(0).max(10),
      })
      .refine(
        (v) => v.minAmount <= v.maxAmount,
        "Минимальная резкость больше максимальной",
      ),
    highlights: z
      .object({
        knee: z.number().int().min(0).max(254),
        ceiling: z.number().int().min(1).max(255),
      })
      .refine((v) => v.knee <= v.ceiling, "Потолок светов ниже порога"),
  })
  .strict();
export type ProcessingConfig = z.infer<typeof processingSchema>;
export const STANDARD: ProcessingConfig = {
  canvasWidth: 1600,
  fillRatio: 0.82,
  alphaThreshold: 16,
  paddingRatio: 0.03,
  sharpen: { minAmount: 0.4, maxAmount: 2.8 },
  highlights: { knee: 175, ceiling: 232 },
};
export const exportSchema = z
  .object({
    format: z.enum(["png", "jpeg", "webp"]),
    quality: z.number().int().min(1).max(100),
    lossless: z.boolean(),
    alphaQuality: z.number().int().min(0).max(100),
    background: z.string().regex(/^#[0-9a-f]{6}$/i),
    progressive: z.boolean(),
  })
  .strict();
export type ExportSettings = z.infer<typeof exportSchema>;
export const DEFAULT_EXPORT: ExportSettings = {
  format: "png",
  quality: 90,
  lossless: false,
  alphaQuality: 100,
  background: "#ffffff",
  progressive: true,
};
export const presetSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(80),
    builtIn: z.boolean(),
    processing: processingSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type ProcessingPreset = z.infer<typeof presetSchema>;
export const factoryPreset = (): ProcessingPreset => ({
  schemaVersion: 1,
  id: "ayprom-standard",
  name: "AYPROM Standard",
  builtIn: true,
  processing: structuredClone(STANDARD),
  createdAt: "2026-09-08T00:00:00.000Z",
  updatedAt: "2026-09-08T00:00:00.000Z",
});
export function migratePreset(value: unknown): ProcessingPreset {
  return presetSchema.parse(value);
}
export const pathSchema = z
  .string()
  .min(1)
  .max(32767)
  .refine((v) => !v.includes("\0"), "Некорректный путь");
export const scanSchema = z
  .object({ roots: z.array(pathSchema).min(1).max(500), force: z.boolean() })
  .strict();
export const batchSchema = scanSchema
  .extend({
    output: pathSchema,
    sameSource: z.boolean(),
    conflict: z.enum(["skip", "overwrite", "rename"]),
    processing: processingSchema,
    export: exportSchema,
  })
  .strict();
export type BatchRequest = z.infer<typeof batchSchema>;
export const previewSchema = z
  .object({
    input: pathSchema,
    processing: processingSchema,
    export: exportSchema,
    draft: z.boolean(),
    requestId: z.number().int().nonnegative(),
  })
  .strict();
export type PreviewRequest = z.infer<typeof previewSchema>;
export interface ScanJob {
  id: string;
  root: string;
  name: string;
  total: number;
  folders: number;
  firstImage?: string;
  error?: string;
}
export interface FileFailure {
  path: string;
  message: string;
}
export interface Summary {
  id: string;
  date: string;
  processed: number;
  skipped: number;
  failed: number;
  total: number;
  cancelled: boolean;
  elapsedMs: number;
  output: string;
  format: ExportSettings["format"];
  errors: FileFailure[];
}
export type ProgressEvent =
  | { type: "scan-started"; root: string }
  | { type: "scan-progress"; root: string; folders: number; total: number }
  | { type: "job-started"; root: string; total: number; destination: string }
  | { type: "file-started"; root: string; path: string }
  | {
      type: "file-completed" | "file-skipped";
      root: string;
      path: string;
      output: string;
      done: number;
      total: number;
    }
  | {
      type: "file-error";
      root: string;
      path: string;
      message: string;
      done: number;
      total: number;
    }
  | { type: "job-completed"; root: string; cancelled: boolean }
  | { type: "completed"; summary: Summary };
export const updateModeSchema = z.enum([
  "installed",
  "portable",
  "development",
]);
export type UpdateMode = z.infer<typeof updateModeSchema>;
const updateStateBase = {
  mode: updateModeSchema,
  currentVersion: z.string().min(1).max(64),
};
export const updateStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("idle"), ...updateStateBase }).strict(),
  z.object({ status: z.literal("checking"), ...updateStateBase }).strict(),
  z.object({ status: z.literal("up-to-date"), ...updateStateBase }).strict(),
  z
    .object({
      status: z.literal("available"),
      ...updateStateBase,
      availableVersion: z.string().min(1).max(64),
    })
    .strict(),
  z
    .object({
      status: z.literal("downloading"),
      ...updateStateBase,
      availableVersion: z.string().min(1).max(64),
      progress: z.number().min(0).max(100),
      bytesPerSecond: z.number().nonnegative(),
      transferred: z.number().nonnegative(),
      total: z.number().nonnegative(),
    })
    .strict(),
  z
    .object({
      status: z.literal("downloaded"),
      ...updateStateBase,
      availableVersion: z.string().min(1).max(64),
    })
    .strict(),
  z
    .object({
      status: z.literal("error"),
      ...updateStateBase,
      error: z.string().min(1).max(500),
    })
    .strict(),
  z
    .object({
      status: z.literal("unsupported-portable"),
      mode: z.literal("portable"),
      currentVersion: z.string().min(1).max(64),
    })
    .strict(),
]);
export type UpdateState = z.infer<typeof updateStateSchema>;
export const updateActionPayloadSchema = z.undefined();
export const stateSchema = z.object({
  schemaVersion: z.literal(1),
  presets: z.array(presetSchema).max(200),
  theme: z.enum(["system", "light", "dark"]),
  lastOutput: z.string().max(32767),
  export: exportSchema,
  window: z.object({
    width: z.number().int().min(800).max(7680),
    height: z.number().int().min(600).max(4320),
  }),
});
export type AppState = z.infer<typeof stateSchema> & {
  history: Summary[];
  warning?: string;
};
export const initialState = (): AppState => ({
  schemaVersion: 1,
  presets: [],
  theme: "system",
  lastOutput: "",
  export: { ...DEFAULT_EXPORT },
  window: { width: 1280, height: 860 },
  history: [],
});
export interface DesktopAPI {
  selectInputs(files?: boolean): Promise<string[]>;
  selectOutput(): Promise<string | null>;
  pathsForFiles(files: File[]): string[];
  scan(request: z.infer<typeof scanSchema>): Promise<ScanJob[]>;
  process(request: BatchRequest): Promise<Summary>;
  cancel(): Promise<void>;
  preview(
    request: PreviewRequest,
  ): Promise<{ before: string; after: string; requestId: number }>;
  cancelPreview(): Promise<void>;
  loadState(): Promise<AppState>;
  saveState(state: Omit<AppState, "history" | "warning">): Promise<void>;
  openOutput(path: string): Promise<void>;
  copyReport(text: string): Promise<void>;
  getUpdateState(): Promise<UpdateState>;
  checkForUpdates(): Promise<UpdateState>;
  downloadUpdate(): Promise<UpdateState>;
  installUpdate(): Promise<void>;
  openUpdateReleases(): Promise<void>;
  onUpdateState(callback: (state: UpdateState) => void): () => void;
  onProgress(callback: (event: ProgressEvent) => void): () => void;
}
export const summarySchema = z.object({
  id: z.string(),
  date: z.string().datetime(),
  processed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  cancelled: z.boolean(),
  elapsedMs: z.number().nonnegative(),
  output: z.string(),
  format: z.enum(["png", "jpeg", "webp"]),
  errors: z.array(z.object({ path: z.string(), message: z.string() })),
});
