import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { StateStore } from "../src/main/store";
import { initialState, factoryPreset } from "../src/shared/contracts";
test("presets persist and built-in protected", async (t) => {
  const p = await fs.mkdtemp(path.join(os.tmpdir(), "ayprom-store-"));
  t.after(() => fs.rm(p, { recursive: true, force: true }));
  const a = new StateStore(p),
    state = initialState();
  state.theme = "dark";
  state.presets = [
    factoryPreset(),
    { ...factoryPreset(), id: "custom", name: "Custom", builtIn: false },
  ];
  await a.save(state);
  const loaded = await new StateStore(p).load();
  assert.equal(loaded.theme, "dark");
  assert.equal(loaded.presets.length, 1);
  assert.equal(loaded.presets[0].id, "custom");
});
test("corrupt store recovery", async (t) => {
  const p = await fs.mkdtemp(path.join(os.tmpdir(), "ayprom-recovery-"));
  t.after(() => fs.rm(p, { recursive: true, force: true }));
  await fs.writeFile(path.join(p, "state.json"), "broken");
  const state = await new StateStore(p).load();
  assert.ok(state.warning);
  assert.ok((await fs.readdir(p)).some((n) => n.includes("recovery")));
});
