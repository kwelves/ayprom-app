import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { renderImage } from "../src/processing/core";
import {
  processBatch,
  encodeImage,
  assertWatermark,
  generatePreview,
} from "../src/processing/service";
import {
  STANDARD,
  DEFAULT_EXPORT,
  type ProgressEvent,
} from "../src/shared/contracts";
const asset = path.resolve("watermark-pattern-figma.svg"),
  config = { ...STANDARD, canvasWidth: 160 };
async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const p = await fs.mkdtemp(path.join(os.tmpdir(), "ayprom-image-test-"));
  t.after(() => fs.rm(p, { recursive: true, force: true }));
  const input = path.join(p, "input");
  await fs.mkdir(input);
  const photo = path.join(input, "fixture.png");
  await sharp({
    create: {
      width: 64,
      height: 48,
      channels: 4,
      background: { r: 170, g: 180, b: 190, alpha: 0.7 },
    },
  })
    .png()
    .toFile(photo);
  return { p, input, photo, output: path.join(p, "output") };
}
test("original watermark SHA256 locked", async () => {
  assert.equal(
    createHash("sha256")
      .update(await fs.readFile(asset))
      .digest("hex"),
    "46ad8e02d90b818720daa5004d206e7db9545c6c82985136b5f3c3463ccf3df8",
  );
});
test("missing watermark fails clearly", async () =>
  assert.rejects(assertWatermark("missing-watermark.svg"), /оригинальный/));
test("synthetic pipeline geometry alpha corners and codecs", async (t) => {
  const f = await fixture(t),
    png = await renderImage(f.photo, config, asset),
    meta = await sharp(png).metadata();
  assert.equal(meta.width, 160);
  assert.equal(meta.height, 120);
  assert.equal(meta.hasAlpha, true);
  assert.equal((await sharp(png).ensureAlpha().raw().toBuffer())[3], 0);
  for (const format of ["png", "jpeg", "webp"] as const) {
    const encoded = await encodeImage(png, {
        ...DEFAULT_EXPORT,
        format,
        lossless: true,
      }),
      m = await sharp(encoded).metadata();
    assert.equal(m.format, format);
    assert.equal(m.hasAlpha, format !== "jpeg");
    if (format === "jpeg") {
      const raw = await sharp(encoded).raw().toBuffer();
      assert.ok(raw[0] > 245 && raw[1] > 245 && raw[2] > 245);
    }
  }
});
test("mixed errors isolated and source unchanged", async (t) => {
  const f = await fixture(t),
    original = await fs.readFile(f.photo);
  await fs.writeFile(path.join(f.input, "broken.png"), "not an image");
  const events: ProgressEvent[] = [];
  const result = await processBatch(
    {
      roots: [f.input],
      output: f.output,
      sameSource: false,
      force: false,
      conflict: "skip",
      processing: config,
      export: DEFAULT_EXPORT,
    },
    asset,
    { cancelled: false },
    (e) => events.push(e),
  );
  assert.equal(result.processed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.total, 2);
  assert.deepEqual(await fs.readFile(f.photo), original);
  assert.ok(events.some((e) => e.type === "file-error"));
});
test("cancel after current file takes no next image", async (t) => {
  const f = await fixture(t);
  await fs.copyFile(f.photo, path.join(f.input, "second.png"));
  const cancel = { cancelled: false };
  const result = await processBatch(
    {
      roots: [f.input],
      output: f.output,
      sameSource: false,
      force: false,
      conflict: "skip",
      processing: config,
      export: DEFAULT_EXPORT,
    },
    asset,
    cancel,
    (e) => {
      if (e.type === "file-completed") cancel.cancelled = true;
    },
  );
  assert.equal(result.processed, 1);
  assert.equal(result.cancelled, true);
  assert.equal(result.failed, 0);
});
test("synthetic full preview and final engine share RGBA", async (t) => {
  const f = await fixture(t),
    preview = await generatePreview(
      {
        input: f.photo,
        processing: config,
        export: DEFAULT_EXPORT,
        draft: false,
        requestId: 8,
      },
      asset,
    ),
    result = await renderImage(f.photo, config, asset);
  assert.deepEqual(
    await sharp(Buffer.from(preview.after.split(",")[1], "base64"))
      .raw()
      .toBuffer(),
    await sharp(result).raw().toBuffer(),
  );
});
