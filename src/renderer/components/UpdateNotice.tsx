import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Download,
  ExternalLink,
  RefreshCw,
  RotateCw,
  X,
} from "lucide-react";
import type { UpdateState } from "../../shared/contracts";
import { describeUpdateState, type UpdateAction } from "../update-view";

export function UpdateNotice({
  state,
  processing,
  onError,
}: {
  state: UpdateState;
  processing: boolean;
  onError: (error: unknown) => void;
}) {
  const [dismissed, setDismissed] = useState("");
  const key = `${state.status}:${"availableVersion" in state ? state.availableVersion : ""}`;
  const view = useMemo(
    () => describeUpdateState(state, processing),
    [state, processing],
  );
  useEffect(() => {
    if (state.status === "available" || state.status === "downloaded")
      setDismissed("");
  }, [key, state.status]);
  if (!view) return null;
  if (dismissed === key) {
    if (state.status !== "available" && state.status !== "downloaded")
      return null;
    return (
      <section className="update-reminder" aria-label="Обновление AYPROM">
        <span>
          {state.status === "downloaded"
            ? `AYPROM ${state.availableVersion} готов к установке`
            : `Доступен AYPROM ${state.availableVersion}`}
        </span>
        <button className="compact-button" onClick={() => setDismissed("")}>
          Показать
        </button>
      </section>
    );
  }

  const run = (action: UpdateAction) => {
    if (action === "dismiss") {
      setDismissed(key);
      return;
    }
    const task =
      action === "check"
        ? window.ayprom.checkForUpdates()
        : action === "download"
          ? window.ayprom.downloadUpdate()
          : action === "install"
            ? window.ayprom.installUpdate()
            : window.ayprom.openUpdateReleases();
    void task.catch(onError);
  };
  const Icon =
    state.status === "error"
      ? CircleAlert
      : state.status === "downloaded" || state.status === "up-to-date"
        ? CheckCircle2
        : state.status === "downloading"
          ? Download
          : RefreshCw;
  const actionIcon = (action: UpdateAction) =>
    action === "download"
      ? Download
      : action === "install"
        ? RotateCw
        : action === "releases"
          ? ExternalLink
          : action === "dismiss"
            ? X
            : RefreshCw;

  return (
    <section
      className={`update-notice update-${view.tone}`}
      aria-live="polite"
      aria-label="Обновление AYPROM"
    >
      <Icon className="update-notice-icon" size={18} />
      <div className="update-notice-copy">
        <strong>{view.title}</strong>
        {view.detail && <p>{view.detail}</p>}
        {view.progress !== undefined && (
          <progress
            aria-label="Загрузка обновления"
            value={view.progress}
            max={100}
          />
        )}
      </div>
      <div className="update-notice-actions">
        {[view.primary, view.secondary].filter(Boolean).map((button) => {
          const action = button!;
          const ActionIcon = actionIcon(action.action);
          return (
            <button
              key={action.action}
              className={
                action === view.primary && action.action !== "releases"
                  ? "primary compact-button"
                  : "compact-button"
              }
              disabled={action.disabled}
              onClick={() => run(action.action)}
            >
              <ActionIcon size={14} />
              {action.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
