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

test("manual release runs only from main and never reuses an existing tag", () => {
  const workflow = readFileSync(".github/workflows/windows.yml", "utf8");
  assert.match(
    workflow,
    /github\.event_name == 'workflow_dispatch' && inputs\.release/,
  );
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /already exists; bump package\.json/);
  assert.match(workflow, /--draft --target \$env:GITHUB_SHA/);
  assert.doesNotMatch(
    workflow,
    /gh release (view|edit|upload) \$env:GITHUB_REF_NAME/,
    "release steps must use the resolved RELEASE_TAG",
  );
});

test("a tag run leaves an already published release untouched", () => {
  const workflow = readFileSync(".github/workflows/windows.yml", "utf8");
  const release = workflow.slice(workflow.indexOf("\n  release:"));
  assert.match(release, /"RELEASE_PUBLISHED=true" >> \$env:GITHUB_ENV/);
  const guarded = release.match(/if: env\.RELEASE_PUBLISHED != 'true'/g) ?? [];
  const mutating = ["gh release create", "package:publish", "gh release edit"];
  for (const command of mutating) {
    const at = release.indexOf(command);
    const step = release.lastIndexOf("\n      - ", at);
    assert.match(
      release.slice(step, at),
      /if: env\.RELEASE_PUBLISHED != 'true'/,
      `${command} must be skipped for a published release`,
    );
  }
  assert.ok(guarded.length >= 3);
});
