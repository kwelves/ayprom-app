import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("release workflow pre-creates one draft before parallel target publishing", () => {
  const workflow = readFileSync(".github/workflows/windows.yml", "utf8");
  const createDraft = workflow.indexOf("gh release create");
  const publish = workflow.indexOf("npm run package:publish");

  assert.ok(createDraft >= 0, "workflow must pre-create the draft release");
  assert.ok(
    createDraft < publish,
    "draft must exist before electron-builder publishes",
  );
  assert.equal(workflow.match(/gh release create/g)?.length, 1);
});
