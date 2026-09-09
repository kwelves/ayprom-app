import type { UpdateState } from "../shared/contracts";

export type UpdateAction =
  "check" | "download" | "install" | "releases" | "dismiss";

interface UpdateButton {
  action: UpdateAction;
  label: string;
  disabled?: boolean;
}

export interface UpdatePresentation {
  tone: "neutral" | "accent" | "success" | "error";
  title: string;
  detail?: string;
  progress?: number;
  primary?: UpdateButton;
  secondary?: UpdateButton;
}

export function describeUpdateState(
  state: UpdateState,
  processing: boolean,
): UpdatePresentation | null {
  switch (state.status) {
    case "idle":
      return null;
    case "checking":
      return { tone: "neutral", title: "Проверяем обновления…" };
    case "up-to-date":
      return {
        tone: "success",
        title: "Установлена актуальная версия",
        secondary: { action: "dismiss", label: "Закрыть" },
      };
    case "available":
      return {
        tone: "accent",
        title: `Доступен AYPROM ${state.availableVersion}`,
        primary: { action: "download", label: "Скачать", disabled: false },
        secondary: { action: "dismiss", label: "Позже" },
      };
    case "downloading":
      return {
        tone: "accent",
        title: `Загрузка обновления · ${Math.round(state.progress)}%`,
        progress: state.progress,
      };
    case "downloaded":
      return {
        tone: "success",
        title: `AYPROM ${state.availableVersion} готов к установке`,
        detail: processing
          ? "Установка станет доступна после завершения обработки."
          : undefined,
        primary: {
          action: "install",
          label: "Перезапустить и обновить",
          disabled: processing,
        },
        secondary: { action: "dismiss", label: "Позже" },
      };
    case "error":
      return {
        tone: "error",
        title: "Не удалось обновить AYPROM",
        detail: state.error,
        primary: { action: "check", label: "Повторить", disabled: false },
        secondary: { action: "dismiss", label: "Закрыть" },
      };
    case "unsupported-portable":
      return {
        tone: "neutral",
        title: "Portable-версия обновляется вручную",
        primary: {
          action: "releases",
          label: "Открыть Releases",
          disabled: false,
        },
      };
  }
}
