import { motion } from "motion/react";
import {
  History,
  Layers3,
  Monitor,
  Moon,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import type { AppState, UpdateState } from "../../shared/contracts";
import { Segmented } from "../ui/Segmented";
import { spring } from "../ui/motion";

export type Workspace = "batch" | "manual" | "history";

export const workspaces = {
  batch: {
    label: "Обработка",
    title: "Пакетная обработка",
    icon: Layers3,
    shortcut: "Ctrl+1",
  },
  manual: {
    label: "Настройка",
    title: "Ручная настройка",
    icon: SlidersHorizontal,
    shortcut: "Ctrl+2",
  },
  history: {
    label: "История",
    title: "История операций",
    icon: History,
    shortcut: "Ctrl+3",
  },
} as const satisfies Record<
  Workspace,
  { label: string; title: string; icon: typeof Layers3; shortcut: string }
>;

export const workspaceOrder = Object.keys(workspaces) as Workspace[];

/**
 * Window chrome. On Windows the native caption buttons are drawn over the
 * right edge (titleBarOverlay); env(titlebar-area-*) reserves their space.
 */
export function TitleBar({
  tab,
  onTab,
  theme,
  onTheme,
  update,
  onCheckUpdates,
  busy,
}: {
  tab: Workspace;
  onTab(tab: Workspace): void;
  theme: AppState["theme"];
  onTheme(theme: AppState["theme"]): void;
  update: UpdateState;
  onCheckUpdates(): void;
  busy: boolean;
}) {
  const checking =
    update.status === "checking" ||
    update.status === "available" ||
    update.status === "downloading" ||
    update.status === "downloaded";
  return (
    <header className="titlebar">
      <div className="wordmark" aria-label="AYPROM">
        <span className="wordmark-type" aria-hidden="true">
          AYPROM
        </span>
        <span className="wordmark-rule" aria-hidden="true" />
      </div>

      <nav className="modes" aria-label="Рабочие режимы">
        {workspaceOrder.map((id) => {
          const item = workspaces[id];
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`mode ${active ? "is-active" : ""}`}
              title={`${item.title} · ${item.shortcut}`}
              onClick={() => onTab(id)}
            >
              {active && (
                <motion.span
                  layoutId="mode-pill"
                  className="mode-pill"
                  transition={spring.snappy}
                />
              )}
              <span className="mode-content">
                <item.icon size={15} strokeWidth={1.9} />
                <span>{item.label}</span>
                {id === "batch" && busy && (
                  <span className="mode-live" aria-hidden="true" />
                )}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="titlebar-drag" />

      <div className="titlebar-tools">
        <span
          className="local-chip"
          title="Фотографии обрабатываются только на этом устройстве и никуда не отправляются"
        >
          <ShieldCheck size={14} strokeWidth={2} />
          <span>Локально</span>
        </span>
        <Segmented
          label="Тема"
          size="sm"
          value={theme}
          onChange={onTheme}
          options={[
            {
              value: "system",
              label: "Системная тема",
              icon: <Monitor size={14} />,
              iconOnly: true,
            },
            {
              value: "light",
              label: "Светлая тема",
              icon: <Sun size={14} />,
              iconOnly: true,
            },
            {
              value: "dark",
              label: "Тёмная тема",
              icon: <Moon size={14} />,
              iconOnly: true,
            },
          ]}
        />
        <div className="version">
          <span className="app-version num">
            <span className="sr-only">Версия </span>
            {update.currentVersion}
          </span>
          {update.mode === "installed" && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Проверить обновления"
              title="Проверить обновления"
              disabled={checking}
              onClick={onCheckUpdates}
            >
              <RefreshCw
                size={14}
                className={update.status === "checking" ? "spin" : ""}
              />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
