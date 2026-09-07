import test from "node:test";
import assert from "node:assert/strict";
import {
  STANDARD,
  DEFAULT_EXPORT,
  factoryPreset,
  migratePreset,
  processingSchema,
  exportSchema,
  batchSchema,
  previewSchema,
  presetSchema,
} from "../src/shared/contracts";
test("factory matches reference", () => {
  assert.deepEqual(STANDARD, {
    canvasWidth: 1600,
    fillRatio: 0.82,
    alphaThreshold: 16,
    paddingRatio: 0.03,
    sharpen: { minAmount: 0.4, maxAmount: 2.8 },
    highlights: { knee: 175, ceiling: 232 },
  });
  assert.equal(Math.round((1600 * 2657) / 3530), 1204);
});
test("preset serialization", () =>
  assert.deepEqual(
    migratePreset(JSON.parse(JSON.stringify(factoryPreset()))),
    factoryPreset(),
  ));
test("unknown schema rejected", () =>
  assert.throws(() => migratePreset({ ...factoryPreset(), schemaVersion: 2 })));
test("factory immutable across instances", () => {
  const a = factoryPreset();
  a.processing.sharpen.minAmount = 5;
  assert.equal(factoryPreset().processing.sharpen.minAmount, 0.4);
});
test("blank preset rejected", () =>
  assert.equal(
    presetSchema.safeParse({ ...factoryPreset(), name: "  " }).success,
    false,
  ));
test("preset does not contain paths", () =>
  assert.equal(
    presetSchema.safeParse({ ...factoryPreset(), input: "C:/photos" }).success,
    false,
  ));
for (const value of [-1, 0, 1.1, NaN, Infinity])
  test("invalid fill " + value, () =>
    assert.equal(
      processingSchema.safeParse({ ...STANDARD, fillRatio: value }).success,
      false,
    ),
  );
test("zero padding supported", () =>
  assert.equal(
    processingSchema.parse({ ...STANDARD, paddingRatio: 0 }).paddingRatio,
    0,
  ));
test("inverted sharpening rejected", () =>
  assert.equal(
    processingSchema.safeParse({
      ...STANDARD,
      sharpen: { minAmount: 4, maxAmount: 2 },
    }).success,
    false,
  ));
test("inverted highlights rejected", () =>
  assert.equal(
    processingSchema.safeParse({
      ...STANDARD,
      highlights: { knee: 240, ceiling: 200 },
    }).success,
    false,
  ));
test("unbounded canvas rejected", () =>
  assert.equal(
    processingSchema.safeParse({ ...STANDARD, canvasWidth: 100000 }).success,
    false,
  ));
test("export codec validation", () => {
  for (const format of ["png", "jpeg", "webp"])
    assert.equal(
      exportSchema.safeParse({ ...DEFAULT_EXPORT, format }).success,
      true,
    );
  assert.equal(
    exportSchema.safeParse({ ...DEFAULT_EXPORT, format: "svg" }).success,
    false,
  );
});
test("export quality and background validation", () => {
  assert.equal(
    exportSchema.safeParse({ ...DEFAULT_EXPORT, quality: 101 }).success,
    false,
  );
  assert.equal(
    exportSchema.safeParse({ ...DEFAULT_EXPORT, background: "url(x)" }).success,
    false,
  );
});
test("invalid IPC batch rejected", () =>
  assert.equal(
    batchSchema.safeParse({
      roots: [],
      output: "C:/output",
      sameSource: false,
      force: false,
      conflict: "skip",
      processing: STANDARD,
      export: DEFAULT_EXPORT,
    }).success,
    false,
  ));
test("IPC NUL path rejected", () =>
  assert.equal(
    previewSchema.safeParse({
      input: "a\0b",
      processing: STANDARD,
      export: DEFAULT_EXPORT,
      draft: false,
      requestId: 1,
    }).success,
    false,
  ));
