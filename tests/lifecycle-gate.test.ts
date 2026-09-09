import test from "node:test";
import assert from "node:assert/strict";
import { LifecycleGate } from "../src/main/lifecycle-gate";

test("shutdown gate rejects new worker jobs after update installation begins", () => {
  const lifecycle = new LifecycleGate();

  assert.doesNotThrow(() => lifecycle.assertAcceptingWork());
  lifecycle.beginShutdown();

  assert.equal(lifecycle.isClosing(), true);
  assert.throws(
    () => lifecycle.assertAcceptingWork(),
    /Приложение закрывается/,
  );
});
