import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { isTrustedRendererUrl } from "../src/main/trusted-renderer";
test("renderer URL aliases resolve to same packaged file", async (t) => {
  const short = path.resolve("SHORT~1", "app.asar", "index.html");
  const long = path.resolve("Long path", "app.asar", "index.html");
  t.mock.method(fs, "realpath", async (value: string) =>
    value === short || value === long ? long : value,
  );
  assert.equal(
    await isTrustedRendererUrl(short, pathToFileURL(long).href),
    true,
  );
});
test("different local files and remote protocols are not trusted", async (t) => {
  const expected = path.resolve("app", "index.html"),
    other = path.resolve("other", "index.html");
  t.mock.method(fs, "realpath", async (value: string) => value);
  assert.equal(
    await isTrustedRendererUrl(expected, pathToFileURL(other).href),
    false,
  );
  assert.equal(
    await isTrustedRendererUrl(expected, "https://example.com/index.html"),
    false,
  );
  assert.equal(
    await isTrustedRendererUrl(expected, "data:text/html,test"),
    false,
  );
});
