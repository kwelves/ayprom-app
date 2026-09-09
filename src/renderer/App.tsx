import { useEffect, useMemo, useRef, useState } from "react";
import {
  Aperture,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  FolderOpen,
  FolderOutput,
  History,
  Images,
  Layers3,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  SunMoon,
  RefreshCw,
  X,
} from "lucide-react";
import {
  BRAND,
  STANDARD,
  exportSchema,
  initialState,
  processingSchema,
  type AppState,
  type ProcessingConfig,
  type Summary,
  type UpdateState,
} from "../shared/contracts";
import { ExportControls } from "./components/ExportControls";
import { PresetControls } from "./components/PresetControls";
import { Preview } from "./components/Preview";
import { ProcessingControls } from "./components/ProcessingControls";
import { Queue, type QueueJob } from "./components/Queue";
import { UpdateNotice } from "./components/UpdateNotice";

type Workspace = "batch" | "manual" | "history";
const workspaceMeta = {
  batch: {
    label: "Обработка",
    title: "Пакетная обработка",
    description:
      "Очередь, контроль результата и экспорт в одном рабочем пространстве.",
    icon: Layers3,
  },
  manual: {
    label: "Настройка",
    title: "Ручная настройка",
    description: "Проверьте композицию и качество на одном изображении.",
    icon: SlidersHorizontal,
  },
  history: {
    label: "История",
    title: "История операций",
    description: "Последние результаты, ошибки и папки экспорта.",
    icon: History,
  },
} satisfies Record<
  Workspace,
  { label: string; title: string; description: string; icon: typeof Images }
>;

export function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Workspace>("batch");
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selected, setSelected] = useState("ayprom-standard");
  const [drafts, setDrafts] = useState<Record<string, ProcessingConfig>>({});
  const [input, setInput] = useState("");
  const [sameSource, setSameSource] = useState(false);
  const [force, setForce] = useState(false);
  const [conflict, setConflict] = useState<"skip" | "overwrite" | "rename">(
    "skip",
  );
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Summary>();
  const [elapsed, setElapsed] = useState(0);
  const [updateState, setUpdateState] = useState<UpdateState>({
    status: "idle",
    mode: "development",
    currentVersion: BRAND.version,
  });
  const started = useRef(0);
  const config =
    drafts[selected] ??
    state.presets.find((p) => p.id === selected)?.processing ??
    STANDARD;
  const changeConfig = (value: ProcessingConfig) =>
    setDrafts((d) => ({ ...d, [selected]: value }));
  const fail = (value: unknown) =>
    setError(value instanceof Error ? value.message : String(value));

  useEffect(() => {
    void window.ayprom
      .loadState()
      .then((value) => {
        setState(value);
        setError(value.warning ?? "");
        setLoaded(true);
      })
      .catch(fail);
  }, []);
  useEffect(() => {
    const unsubscribe = window.ayprom.onUpdateState(setUpdateState);
    void window.ayprom.getUpdateState().then(setUpdateState).catch(fail);
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(
      () => void window.ayprom.saveState(state).catch(fail),
      350,
    );
    return () => clearTimeout(timer);
  }, [state, loaded]);
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        state.theme === "system"
          ? query.matches
            ? "dark"
            : "light"
          : state.theme;
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [state.theme]);
  useEffect(
    () =>
      window.ayprom.onProgress((event) => {
        if (
          event.type === "completed" ||
          event.type.startsWith("scan-") ||
          !("root" in event)
        )
          return;
        setJobs((previous) =>
          previous.map((job) => {
            if (job.root !== event.root) return job;
            if (event.type === "job-started")
              return {
                ...job,
                total: event.total,
                status: "Обработка",
                destination: event.destination,
              };
            if (event.type === "file-started")
              return { ...job, current: event.path };
            if (event.type === "file-error")
              return {
                ...job,
                done: event.done,
                errors: [
                  ...(job.errors ?? []),
                  `${event.path}: ${event.message}`,
                ],
                status: event.total === 0 ? "Ошибка" : job.status,
              };
            if (
              event.type === "file-completed" ||
              event.type === "file-skipped"
            )
              return { ...job, done: event.done };
            if (event.type === "job-completed")
              return {
                ...job,
                status: event.cancelled
                  ? "Отменено"
                  : job.errors?.length
                    ? "С ошибками"
                    : "Завершено",
                current: "",
              };
            return job;
          }),
        );
      }),
    [],
  );
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(
      () => setElapsed(Date.now() - started.current),
      1000,
    );
    return () => clearInterval(timer);
  }, [busy]);

  async function add(paths?: string[]) {
    try {
      const chosen = paths ?? (await window.ayprom.selectInputs());
      if (!chosen.length) return;
      setScanning(true);
      setError("");
      const fresh = await window.ayprom.scan({ roots: chosen, force });
      setJobs((previous) => {
        const existing = new Set(previous.map((j) => j.id));
        return [...previous, ...fresh.filter((j) => !existing.has(j.id))];
      });
      setSelectedJob((current) => current || fresh[0]?.id || "");
    } catch (cause) {
      fail(cause);
    } finally {
      setScanning(false);
    }
  }
  async function changeForce(value: boolean) {
    setForce(value);
    if (!jobs.length) return;
    setScanning(true);
    try {
      const rescanned = await window.ayprom.scan({
        roots: jobs.map((j) => j.root),
        force: value,
      });
      setJobs(rescanned);
      setSelectedJob((current) =>
        rescanned.some((j) => j.id === current)
          ? current
          : (rescanned[0]?.id ?? ""),
      );
    } catch (cause) {
      fail(cause);
    } finally {
      setScanning(false);
    }
  }
  async function choosePreview() {
    try {
      const files = await window.ayprom.selectInputs(true);
      if (files[0]) {
        setInput(files[0]);
        setTab("manual");
      }
    } catch (cause) {
      fail(cause);
    }
  }
  async function processQueue() {
    setError("");
    setSummary(undefined);
    setBusy(true);
    setCancelling(false);
    started.current = Date.now();
    setElapsed(0);
    try {
      let queue = jobs;
      if (!queue.length && input) {
        queue = await window.ayprom.scan({ roots: [input], force });
        setJobs(queue);
        setSelectedJob(queue[0]?.id ?? "");
      }
      setJobs((previous) =>
        previous.map((job) => ({
          ...job,
          done: 0,
          status: "Ожидает",
          errors: [],
          current: "",
        })),
      );
      const result = await window.ayprom.process({
        roots: queue.map((j) => j.root),
        force,
        output: sameSource ? (queue[0]?.root ?? "") : state.lastOutput,
        sameSource,
        conflict,
        processing: config,
        export: state.export,
      });
      setSummary(result);
      setState((previous) => ({
        ...previous,
        history: [result, ...previous.history].slice(0, 30),
      }));
      if (result.cancelled)
        setJobs((previous) =>
          previous.map((job) =>
            job.status === "Ожидает" ? { ...job, status: "Отменено" } : job,
          ),
        );
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
      setCancelling(false);
    }
  }

  const valid = processingSchema.safeParse(config);
  const exportValid = exportSchema.safeParse(state.export);
  const total = jobs.reduce((sum, job) => sum + job.total, 0);
  const done = jobs.reduce((sum, job) => sum + (job.done ?? 0), 0);
  const selectedQueueJob = useMemo(
    () => jobs.find((job) => job.id === selectedJob) ?? jobs[0],
    [jobs, selectedJob],
  );
  const activePreset =
    selected === "ayprom-standard"
      ? "AYPROM Standard"
      : (state.presets.find((p) => p.id === selected)?.name ??
        "Пользовательский");
  const destination = sameSource
    ? "Рядом с исходниками"
    : state.lastOutput || "Папка не выбрана";
  const canProcess =
    loaded &&
    !busy &&
    !scanning &&
    valid.success &&
    exportValid.success &&
    (jobs.some((job) => job.total > 0) || (!jobs.length && !!input)) &&
    (sameSource || !!state.lastOutput);

  if (!loaded)
    return (
      <main className="loading">
        <Aperture className="loading-mark" size={30} />
        <strong>Запуск {BRAND.name}</strong>
        {error && <p className="error">{error}</p>}
      </main>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Навигация приложения">
        <div className="brand" aria-label="AYPROM">
          <div className="brand-mark">
            <Aperture size={22} />
          </div>
          <div className="brand-type">
            <strong>AYPROM</strong>
            <small>PHOTO WORKSPACE</small>
          </div>
        </div>
        <nav aria-label="Рабочие режимы">
          {(
            Object.entries(workspaceMeta) as [
              Workspace,
              (typeof workspaceMeta)[Workspace],
            ][]
          ).map(([id, item]) => (
            <button
              key={id}
              aria-label={item.label}
              aria-current={tab === id ? "page" : undefined}
              className={tab === id ? "nav-active" : ""}
              onClick={() => setTab(id)}
              title={item.title}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="privacy-note">
            <ShieldCheck size={15} />
            <span>Обработка только на этом устройстве</span>
          </div>
          <label className="theme-control">
            <SunMoon size={15} />
            <span className="sr-only">Тема</span>
            <select
              aria-label="Тема"
              value={state.theme}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  theme: e.target.value as AppState["theme"],
                }))
              }
            >
              <option value="system">Системная тема</option>
              <option value="light">Светлая тема</option>
              <option value="dark">Тёмная тема</option>
            </select>
          </label>
          <div className="update-meta">
            <span className="app-version">
              Версия {updateState.currentVersion}
            </span>
            {updateState.mode === "installed" && (
              <button
                className="update-check-button"
                aria-label="Проверить обновления"
                title="Проверить обновления"
                disabled={
                  updateState.status === "checking" ||
                  updateState.status === "available" ||
                  updateState.status === "downloading" ||
                  updateState.status === "downloaded"
                }
                onClick={() => void window.ayprom.checkForUpdates().catch(fail)}
              >
                <RefreshCw size={14} />
                <span>Проверить обновления</span>
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <div>
            <h1>{workspaceMeta[tab].title}</h1>
            <p>{workspaceMeta[tab].description}</p>
          </div>
          {tab !== "history" && (
            <div className="header-context" aria-label="Текущие параметры">
              <span>
                <Images size={14} />
                {total} фото
              </span>
              <span>
                <SlidersHorizontal size={14} />
                {activePreset}
              </span>
              <span>
                <FolderOutput size={14} />
                {state.export.format.toUpperCase()}
              </span>
            </div>
          )}
        </header>
        {error && (
          <div className="error-banner" role="alert">
            <CircleAlert size={17} />
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Закрыть сообщение"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <UpdateNotice state={updateState} processing={busy} onError={fail} />
        <div
          className={`content ${tab === "history" ? "history-content" : ""}`}
        >
          <main className="main-panel">
            <div className="workspace-view" key={tab}>
              {tab === "batch" && (
                <div className="batch-workspace">
                  <Queue
                    jobs={jobs}
                    selectedId={selectedQueueJob?.id ?? ""}
                    busy={busy}
                    scanning={scanning}
                    add={(paths) => void add(paths)}
                    select={setSelectedJob}
                    remove={(id) => {
                      setJobs((current) =>
                        current.filter((job) => job.id !== id),
                      );
                      if (selectedJob === id)
                        setSelectedJob(
                          jobs.find((job) => job.id !== id)?.id ?? "",
                        );
                    }}
                    preview={(path) => {
                      setInput(path);
                      setTab("manual");
                    }}
                  />
                  {!!jobs.length && (
                    <Preview
                      input={selectedQueueJob?.firstImage ?? ""}
                      config={config}
                      settings={state.export}
                      choose={() => void choosePreview()}
                      compact
                    />
                  )}
                </div>
              )}
              {tab === "manual" && (
                <Preview
                  input={input}
                  config={config}
                  settings={state.export}
                  choose={() => void choosePreview()}
                />
              )}
              {tab === "history" && (
                <section className="history">
                  <div className="section-title">
                    <div>
                      <h2>Последние операции</h2>
                      <p>{state.history.length} из 30 сохранённых запусков</p>
                    </div>
                  </div>
                  {!state.history.length && (
                    <div className="empty-state">
                      <Clock3 size={30} />
                      <h3>История пока пуста</h3>
                      <p>Завершённые запуски появятся здесь.</p>
                      <button onClick={() => setTab("batch")}>
                        Перейти к обработке
                      </button>
                    </div>
                  )}
                  <div className="history-list">
                    {state.history.map((item) => (
                      <article key={item.id} className="history-item">
                        <div className="history-main">
                          <div className="history-status">
                            <CheckCircle2 size={18} />
                          </div>
                          <div className="min-w-0">
                            <strong>
                              {new Date(item.date).toLocaleString("ru-RU")}
                            </strong>
                            <p className="muted truncate" title={item.output}>
                              {item.output}
                            </p>
                          </div>
                        </div>
                        <div className="history-counts">
                          <span>
                            <b>{item.processed}</b> готово
                          </span>
                          <span>
                            <b>{item.skipped}</b> пропущено
                          </span>
                          <span className={item.failed ? "error" : ""}>
                            <b>{item.failed}</b> ошибок
                          </span>
                        </div>
                        <span
                          className={`status-badge ${item.failed ? "status-error" : "status-success"}`}
                        >
                          {item.cancelled
                            ? "Отменено"
                            : item.failed
                              ? "С ошибками"
                              : "Завершено"}
                        </span>
                        <button
                          className="icon-button"
                          title="Копировать отчёт"
                          aria-label={`Копировать отчёт от ${new Date(item.date).toLocaleString("ru-RU")}`}
                          onClick={() =>
                            void window.ayprom
                              .copyReport(JSON.stringify(item, null, 2))
                              .catch(fail)
                          }
                        >
                          <Copy size={15} />
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {summary && tab !== "history" && (
                <section className="result" aria-live="polite">
                  <div className="result-heading">
                    <div className="result-icon">
                      {summary.failed ? (
                        <CircleAlert size={20} />
                      ) : (
                        <CheckCircle2 size={20} />
                      )}
                    </div>
                    <div>
                      <h2>
                        {summary.cancelled
                          ? "Обработка отменена"
                          : summary.failed
                            ? "Готово с ошибками"
                            : "Обработка завершена"}
                      </h2>
                      <p>
                        {summary.format.toUpperCase()} за{" "}
                        {(summary.elapsedMs / 1000).toFixed(1)} с
                      </p>
                    </div>
                  </div>
                  <div className="result-stats">
                    <div>
                      <strong>{summary.processed}</strong>
                      <span>Готово</span>
                    </div>
                    <div>
                      <strong>{summary.skipped}</strong>
                      <span>Пропущено</span>
                    </div>
                    <div>
                      <strong>{summary.failed}</strong>
                      <span>Ошибок</span>
                    </div>
                  </div>
                  <p className="path-line" title={summary.output}>
                    {summary.output}
                  </p>
                  {!!summary.errors.length && (
                    <details className="error-details">
                      <summary>
                        Показать ошибки ({summary.errors.length})
                      </summary>
                      {summary.errors.map((entry, index) => (
                        <p className="error text-xs break-all" key={index}>
                          {entry.path}: {entry.message}
                        </p>
                      ))}
                    </details>
                  )}
                  <div className="result-actions">
                    <button
                      onClick={() =>
                        void window.ayprom
                          .openOutput(
                            sameSource ? jobs[0].root : state.lastOutput,
                          )
                          .catch(fail)
                      }
                    >
                      <FolderOpen size={15} />
                      Открыть папку
                    </button>
                    <button
                      onClick={() =>
                        void window.ayprom
                          .copyReport(JSON.stringify(summary, null, 2))
                          .catch(fail)
                      }
                    >
                      <Copy size={15} />
                      Копировать отчёт
                    </button>
                    <button
                      onClick={() => {
                        setJobs([]);
                        setSelectedJob("");
                        setSummary(undefined);
                        setTab("batch");
                      }}
                    >
                      Новая очередь
                    </button>
                  </div>
                </section>
              )}
            </div>
          </main>
          {tab !== "history" && (
            <aside className="settings-panel" aria-label="Инспектор настроек">
              <div className="inspector-heading">
                <div>
                  <h2>Параметры</h2>
                  <p>Для всей текущей очереди</p>
                </div>
                <span className="format-indicator">
                  {state.export.format.toUpperCase()}
                </span>
              </div>
              <PresetControls
                presets={state.presets}
                selected={selected}
                select={setSelected}
                value={config}
                change={changeConfig}
                save={(presets) => setState((s) => ({ ...s, presets }))}
                disabled={busy}
              />
              <ProcessingControls
                value={config}
                onChange={changeConfig}
                disabled={busy}
              />
              {!valid.success && (
                <p className="inline-error">
                  {valid.error.issues.map((i) => i.message).join("; ")}
                </p>
              )}
              <ExportControls
                value={state.export}
                onChange={(value) => setState((s) => ({ ...s, export: value }))}
                disabled={busy}
              />
              {!exportValid.success && (
                <p className="inline-error">Проверьте параметры экспорта.</p>
              )}
              <fieldset
                disabled={busy || scanning}
                className="controls output-controls"
              >
                <legend>Сохранение</legend>
                <button
                  className="path-button"
                  onClick={() =>
                    void window.ayprom
                      .selectOutput()
                      .then((output) => {
                        if (output) {
                          setState((s) => ({ ...s, lastOutput: output }));
                          setSameSource(false);
                        }
                      })
                      .catch(fail)
                  }
                >
                  <FolderOpen size={15} />
                  <span className="truncate" title={state.lastOutput}>
                    {state.lastOutput || "Выбрать папку результата"}
                  </span>
                </button>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={sameSource}
                    onChange={(e) => setSameSource(e.target.checked)}
                  />
                  <span>Сохранять рядом с исходниками</span>
                </label>
                <label className="control">
                  <span>Если файл существует</span>
                  <select
                    aria-label="Конфликты файлов"
                    value={conflict}
                    onChange={(e) =>
                      setConflict(e.target.value as typeof conflict)
                    }
                  >
                    <option value="skip">Пропустить</option>
                    <option value="rename">Создать уникальное имя</option>
                    <option value="overwrite">Перезаписать результат</option>
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={(e) => void changeForce(e.target.checked)}
                  />
                  <span>Повторно обрабатывать числовые PNG</span>
                </label>
                <p className="control-note">
                  Оригиналы не перезаписываются. Структура вложенных папок
                  сохраняется.
                </p>
              </fieldset>
            </aside>
          )}
        </div>
        <footer className="process-bar">
          <div className="process-state">
            <div
              className={`state-dot ${busy ? "is-busy" : canProcess ? "is-ready" : ""}`}
            />
            <div className="min-w-0">
              <strong>
                {busy
                  ? cancelling
                    ? "Завершаем текущее фото"
                    : `Обработка ${done} из ${total}`
                  : canProcess
                    ? `${total || 1} фото готово к обработке`
                    : total
                      ? "Укажите папку результата"
                      : "Добавьте фотографии"}
              </strong>
              <p title={destination}>
                {busy
                  ? `${Math.floor(elapsed / 1000)} с · ${destination}`
                  : `${activePreset} · ${destination}`}
              </p>
            </div>
          </div>
          {busy && (
            <progress
              aria-label="Общий прогресс"
              value={done}
              max={Math.max(1, total)}
            />
          )}
          {busy ? (
            <button
              className="cancel-button"
              disabled={cancelling}
              onClick={() => {
                setCancelling(true);
                void window.ayprom.cancel().catch(fail);
              }}
            >
              <Square size={15} />
              {cancelling ? "Останавливаем…" : "Остановить"}
            </button>
          ) : (
            <button
              className="primary process-button"
              disabled={!canProcess}
              onClick={() => void processQueue()}
            >
              <Play size={16} fill="currentColor" />
              Запустить обработку
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
