import path from "node:path";
import { STANDARD, DEFAULT_EXPORT } from "./shared/contracts";
import { processBatch } from "./processing/service";
const flags: Record<string, string | boolean> = {};
for (const arg of process.argv.slice(2))
  if (arg.startsWith("--")) {
    const [key, ...value] = arg.slice(2).split("=");
    flags[key] = value.length ? value.join("=") : true;
  }
const number = (key: string, fallback: number) =>
  flags[key] === undefined ? fallback : Number(flags[key]);
const cancellation = { cancelled: false };
process.on("SIGINT", () => {
  cancellation.cancelled = true;
});
const root =
  typeof flags.input === "string" ? path.resolve(flags.input) : process.cwd();
const output =
  typeof flags.output === "string" ? path.resolve(flags.output) : root;
const asset = path.resolve(__dirname, "../watermark-pattern-figma.svg");
void processBatch(
  {
    roots: [root],
    output,
    sameSource: flags.output === undefined,
    force: Boolean(flags.force),
    conflict:
      flags.conflict === "overwrite"
        ? "overwrite"
        : flags.conflict === "rename"
          ? "rename"
          : "skip",
    processing: {
      ...STANDARD,
      canvasWidth: number("canvas", 1600),
      fillRatio: number("fill", 0.82),
      alphaThreshold: number("alpha-threshold", 16),
      paddingRatio: number("padding", 0.03),
      sharpen: {
        minAmount: number("sharpen-min", 0.4),
        maxAmount: number("sharpen-max", 2.8),
      },
      highlights: {
        knee: number("highlight-knee", 175),
        ceiling: number("highlight-ceiling", 232),
      },
    },
    export: {
      ...DEFAULT_EXPORT,
      format:
        flags.format === "jpeg"
          ? "jpeg"
          : flags.format === "webp"
            ? "webp"
            : "png",
      quality: number("quality", 90),
    },
  },
  asset,
  cancellation,
  (event) => {
    if (event.type === "file-completed")
      console.log(`✓ ${event.path} → ${event.output}`);
    if (event.type === "file-skipped")
      console.log(`− ${event.path}: результат существует`);
    if (event.type === "file-error")
      console.error(`✗ ${event.path}: ${event.message}`);
  },
)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (result.failed || result.cancelled) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
