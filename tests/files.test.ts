import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  eligible,
  sortFiles,
  scanRoot,
  rootNames,
  outputDirectory,
  inside,
  writeOutput,
  keyPath,
  validateRoots,
} from "../src/processing/files";
import { STANDARD, DEFAULT_EXPORT } from "../src/shared/contracts";
async function temporary(t: { after(fn: () => Promise<void>): void }) {
  const p = await fs.mkdtemp(path.join(os.tmpdir(), "ayprom-test-"));
  t.after(() => fs.rm(p, { recursive: true, force: true }));
  return p;
}
test("original extensions preserved", () => {
  for (const e of ["png", "webp", "jpg", "jpeg", "avif", "tiff", "PNG"])
    assert.equal(eligible("product." + e, false), true);
  for (const e of ["svg", "gif", "heic", "tif", "txt"])
    assert.equal(eligible("product." + e, false), false);
});
test("exact numeric exclusion and force", () => {
  assert.equal(eligible("1.png", false), false);
  assert.equal(eligible("001.png", false), true);
  assert.equal(eligible("0.png", false), true);
  assert.equal(eligible("1.webp", false), true);
  assert.equal(eligible("1.png", true), true);
});
test("natural sort", () =>
  assert.deepEqual(sortFiles(["photo10.png", "photo2.png", "photo1.png"]), [
    "photo1.png",
    "photo2.png",
    "photo10.png",
  ]));
test("recursive scan skips temp and unsupported", async (t) => {
  const p = await temporary(t);
  await fs.mkdir(path.join(p, "nested"));
  await fs.mkdir(path.join(p, ".enhance-product-photos-old"));
  for (const n of [
    "a.png",
    "1.png",
    "notes.txt",
    "nested/b.jpg",
    ".enhance-product-photos-old/c.png",
  ])
    await fs.writeFile(path.join(p, n), "x");
  const r = await scanRoot(p, false);
  assert.equal(r.folders.length, 2);
  assert.equal(r.folders.flatMap((f) => f.files).length, 2);
});
test("cancelled scan takes no folder", async (t) =>
  assert.equal(
    (await scanRoot(await temporary(t), false, { cancelled: true })).folders
      .length,
    0,
  ));
test("empty folder supported", async (t) =>
  assert.equal((await scanRoot(await temporary(t), false)).folders.length, 0));
test("same root names separated", () =>
  assert.deepEqual(rootNames(["/a/Product", "/b/Product", "/c/Product (2)"]), [
    "Product",
    "Product (2)",
    "Product (2) (2)",
  ]));
test("nested mapping and same source", () => {
  const root = path.resolve("Products"),
    folder = path.join(root, "PTO", "ZF"),
    out = path.resolve("Processed");
  assert.equal(
    outputDirectory(root, folder, out, "Products", false),
    path.join(out, "Products", "PTO", "ZF"),
  );
  assert.equal(outputDirectory(root, folder, out, "Products", true), folder);
});
test("path traversal rejected", () => {
  assert.equal(inside("/a/products", "/a/products-old"), false);
  assert.throws(() =>
    outputDirectory(
      path.resolve("A"),
      path.resolve("B"),
      path.resolve("Out"),
      "A",
      false,
    ),
  );
});
test("skip rename overwrite and cleanup", async (t) => {
  const p = await temporary(t),
    dest = path.join(p, "1.png");
  await fs.writeFile(dest, "original");
  assert.equal(
    await writeOutput(Buffer.from("new"), dest, "skip", new Set()),
    null,
  );
  assert.equal(await fs.readFile(dest, "utf8"), "original");
  assert.equal(
    await writeOutput(Buffer.from("new"), dest, "rename", new Set()),
    path.join(p, "1 (2).png"),
  );
  await writeOutput(Buffer.from("overwrite"), dest, "overwrite", new Set());
  assert.equal(await fs.readFile(dest, "utf8"), "overwrite");
  assert.equal(
    (await fs.readdir(p)).some((f) => f.endsWith(".tmp")),
    false,
  );
});
test("force cannot overwrite source", async (t) => {
  const p = await temporary(t),
    dest = path.join(p, "1.png");
  await fs.writeFile(dest, "source");
  await assert.rejects(
    writeOutput(
      Buffer.from("new"),
      dest,
      "overwrite",
      new Set([keyPath(dest)]),
    ),
    /исходного/,
  );
  assert.equal(await fs.readFile(dest, "utf8"), "source");
});
test("overlapping roots and nested output rejected", async (t) => {
  const p = await temporary(t);
  await fs.mkdir(path.join(p, "child"));
  const r = {
    roots: [p],
    output: path.join(p, "child"),
    sameSource: false,
    force: false,
    conflict: "skip" as const,
    processing: STANDARD,
    export: DEFAULT_EXPORT,
  };
  await assert.rejects(validateRoots(r), /отдельную/);
  await assert.rejects(
    validateRoots({
      ...r,
      roots: [p, path.join(p, "child")],
      sameSource: true,
    }),
    /вложены/,
  );
});

test("root names normalize traversal and drive roots", () => {
  assert.equal(
    rootNames([path.resolve("Products") + path.sep + ".."])[0],
    path.basename(process.cwd()),
  );
  assert.ok(rootNames([path.parse(process.cwd()).root])[0].length > 0);
});
test("root mapping rejects malicious root label", () => {
  const root = path.resolve("Products"),
    output = path.resolve("Output");
  for (const label of ["..", ".", "../escape"])
    assert.throws(() => outputDirectory(root, root, output, label, false));
});

test("short Windows path aliases cannot hide nested output", async (t) => {
  const p = await temporary(t),
    canonical = p + "-long-name";
  const realpath = fs.realpath;
  t.mock.method(fs, "realpath", async (target: string) => {
    const resolved = await realpath(target);
    return inside(p, resolved)
      ? path.join(canonical, path.relative(p, resolved))
      : resolved;
  });
  await assert.rejects(
    validateRoots({
      roots: [p],
      output: path.join(p, "not-created", "child"),
      sameSource: false,
      force: false,
      conflict: "skip",
      processing: STANDARD,
      export: DEFAULT_EXPORT,
    }),
    /отдельную/,
  );
});
