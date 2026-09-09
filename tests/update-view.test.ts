import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describeUpdateState } from "../src/renderer/update-view";
import { UpdateNotice } from "../src/renderer/components/UpdateNotice";
import type { UpdateState } from "../src/shared/contracts";

const base = { mode: "installed", currentVersion: "1.1.0" } as const;

test("available update presents download without automatic installation", () => {
  const state: UpdateState = {
    ...base,
    status: "available",
    availableVersion: "1.1.1",
  };
  assert.deepEqual(describeUpdateState(state, false), {
    tone: "accent",
    title: "Доступен AYPROM 1.1.1",
    primary: { action: "download", label: "Скачать", disabled: false },
    secondary: { action: "dismiss", label: "Позже" },
  });
});

test("download view uses actual rounded progress", () => {
  const state: UpdateState = {
    ...base,
    status: "downloading",
    availableVersion: "1.1.1",
    progress: 47.4,
    bytesPerSecond: 2048,
    transferred: 470,
    total: 1000,
  };
  assert.equal(
    describeUpdateState(state, false)?.title,
    "Загрузка обновления · 47%",
  );
});

test("ready update defers restart while processing", () => {
  const state: UpdateState = {
    ...base,
    status: "downloaded",
    availableVersion: "1.1.1",
  };
  const view = describeUpdateState(state, true);
  assert.equal(view?.title, "AYPROM 1.1.1 готов к установке");
  assert.deepEqual(view?.primary, {
    action: "install",
    label: "Перезапустить и обновить",
    disabled: true,
  });
  assert.equal(
    view?.detail,
    "Установка станет доступна после завершения обработки.",
  );
});

test("portable view offers only the official Releases page", () => {
  const state: UpdateState = {
    status: "unsupported-portable",
    mode: "portable",
    currentVersion: "1.1.0",
  };
  const view = describeUpdateState(state, false);
  assert.equal(view?.title, "Portable-версия обновляется вручную");
  assert.deepEqual(view?.primary, {
    action: "releases",
    label: "Открыть Releases",
    disabled: false,
  });
});

test("renderer notice exposes available and safely deferred update actions", () => {
  const available = renderToStaticMarkup(
    createElement(UpdateNotice, {
      state: {
        ...base,
        status: "available",
        availableVersion: "1.1.1",
      },
      processing: false,
      onError: () => {},
    }),
  );
  assert.match(available, /Доступен AYPROM 1\.1\.1/);
  assert.match(available, />Скачать</);
  assert.match(available, />Позже</);

  const deferred = renderToStaticMarkup(
    createElement(UpdateNotice, {
      state: {
        ...base,
        status: "downloaded",
        availableVersion: "1.1.1",
      },
      processing: true,
      onError: () => {},
    }),
  );
  assert.match(deferred, /Перезапустить и обновить/);
  assert.match(deferred, /disabled=""/);
});
