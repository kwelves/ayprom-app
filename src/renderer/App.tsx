import { useEffect, useRef, useState } from "react";
import {
  Aperture,
  Layers,
  SlidersHorizontal,
  History,
  FolderOpen,
  Play,
  Square,
  CheckCircle2,
  SunMoon,
  Copy,
  X,
} from "lucide-react";
import {
  BRAND,
  STANDARD,
  initialState,
  processingSchema,
  exportSchema,
  type AppState,
  type ProcessingConfig,
  type Summary,
} from "../shared/contracts";
import { Queue, type QueueJob } from "./components/Queue";
import { Preview } from "./components/Preview";
import { ProcessingControls } from "./components/ProcessingControls";
import { ExportControls } from "./components/ExportControls";
import { PresetControls } from "./components/PresetControls";

export function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"batch" | "manual" | "history">("batch");
  const [jobs, setJobs] = useState<QueueJob[]>([]);
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
  const started = useRef(0);
  const config =
    drafts[selected] ??
    state.presets.find((p) => p.id === selected)?.processing ??
    STANDARD;
  const changeConfig = (value: ProcessingConfig) =>
    setDrafts((d) => ({ ...d, [selected]: value }));
  const fail = (err: unknown) =>
    setError(err instanceof Error ? err.message : String(err));
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
    if (!loaded) return;
    const timer = setTimeout(() => {
      void window.ayprom.saveState(state).catch(fail);
    }, 350);
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
        if (event.type === "completed" || event.type.startsWith("scan-"))
          return;
        if (!("root" in event)) return;
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
    } catch (err) {
      fail(err);
    } finally {
      setScanning(false);
    }
  }
  async function changeForce(value: boolean) {
    setForce(value);
    if (!jobs.length) return;
    setScanning(true);
    try {
      setJobs(
        await window.ayprom.scan({
          roots: jobs.map((j) => j.root),
          force: value,
        }),
      );
    } catch (err) {
      fail(err);
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
    } catch (err) {
      fail(err);
    }
  }
  async function process() {
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
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
      setCancelling(false);
    }
  }
  const valid = processingSchema.safeParse(config);
  const exportValid = exportSchema.safeParse(state.export);
  const total = jobs.reduce((sum, job) => sum + job.total, 0);
  const done = jobs.reduce((sum, job) => sum + (job.done ?? 0), 0);
  const canProcess =
    loaded &&
    !busy &&
    !scanning &&
    valid.success &&
    exportValid.success &&
    (jobs.some((j) => j.total > 0) || (!jobs.length && !!input)) &&
    (sameSource || !!state.lastOutput);
  if (!loaded)
    return (
      <main className="loading">
        Загрузка {BRAND.name}…{error && <p className="error">{error}</p>}
      </main>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Aperture size={27} />
          </div>
          <div>
            <strong>AyProm</strong>
            <small>PHOTO PROCESSOR</small>
          </div>
        </div>
        <div className="workspace-label">РАБОЧАЯ ОБЛАСТЬ</div>
        <nav>
          {(
            [
              { id: "batch", label: "Обработка", icon: Layers },
              {
                id: "manual",
                label: "Ручная настройка",
                icon: SlidersHorizontal,
              },
              { id: "history", label: "История", icon: History },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "nav-active" : ""}
              onClick={() => setTab(item.id)}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="local-dot" />
          Все фото остаются на устройстве
          <label className="theme-control">
            <SunMoon size={16} />
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
              <option value="system">Как в системе</option>
              <option value="light">Светлая</option>
              <option value="dark">Тёмная</option>
            </select>
          </label>
          <p className="text-xs muted">Версия {BRAND.version}</p>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div>
            <div className="eyebrow">СТУДИЯ ТОВАРНЫХ ФОТОГРАФИЙ</div>
            <h1>
              {tab === "manual"
                ? "Каждая деталь под контролем"
                : tab === "history"
                  ? "История обработки"
                  : "Единый стиль. Вся коллекция."}
            </h1>
            <p className="muted">
              {tab === "manual"
                ? "Настройте фото и примените результат ко всей очереди."
                : "Композиция, свет, резкость и фирменный watermark — локально."}
            </p>
          </div>
          <span className="version-badge">WINDOWS · LOCAL</span>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button aria-label="Закрыть сообщение" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        <div
          className={`content ${tab === "history" ? "history-content" : ""}`}
        >
          <main className="main-panel">
            {tab === "batch" && (
              <Queue
                jobs={jobs}
                busy={busy}
                scanning={scanning}
                add={(paths) => void add(paths)}
                remove={(id) =>
                  setJobs((j) => j.filter((job) => job.id !== id))
                }
                preview={(path) => {
                  setInput(path);
                  setTab("manual");
                }}
              />
            )}{" "}
            {tab === "manual" && (
              <Preview
                input={input}
                config={config}
                settings={state.export}
                choose={() => void choosePreview()}
              />
            )}{" "}
            {tab === "history" && (
              <section>
                <h2>Последние 30 операций</h2>
                {!state.history.length && (
                  <p className="muted mt-6">
                    Завершённые операции появятся здесь.
                  </p>
                )}
                {state.history.map((item) => (
                  <article key={item.id} className="history-item">
                    <div className="flex justify-between">
                      <strong>
                        {new Date(item.date).toLocaleString("ru-RU")}
                      </strong>
                      <span className="badge">
                        {item.cancelled
                          ? "Отменено"
                          : item.failed
                            ? "С ошибками"
                            : "Завершено"}
                      </span>
                    </div>
                    <p>
                      {item.processed} обработано · {item.skipped} пропущено ·{" "}
                      {item.failed} ошибок
                    </p>
                    <p className="muted truncate" title={item.output}>
                      {item.output}
                    </p>
                    <button
                      onClick={() =>
                        void window.ayprom
                          .copyReport(JSON.stringify(item, null, 2))
                          .catch(fail)
                      }
                    >
                      <Copy size={14} />
                      Копировать отчёт
                    </button>
                  </article>
                ))}
              </section>
            )}
            {summary && (
              <section className="result">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={22} />
                  <h2>
                    {summary.cancelled
                      ? "Обработка отменена"
                      : summary.failed
                        ? "Завершено с ошибками"
                        : "Обработка завершена"}
                  </h2>
                </div>
                <div className="result-stats">
                  <div>
                    <strong>{summary.processed}</strong>
                    <span>Обработано</span>
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
                <p className="muted text-xs">
                  {summary.format.toUpperCase()} ·{" "}
                  {(summary.elapsedMs / 1000).toFixed(1)} с
                </p>
                <p className="muted truncate text-xs" title={summary.output}>
                  {summary.output}
                </p>
                {summary.errors.length > 0 && (
                  <details>
                    <summary>Подробности ошибок</summary>
                    {summary.errors.map((e, i) => (
                      <p className="error text-xs break-all" key={i}>
                        {e.path}: {e.message}
                      </p>
                    ))}
                  </details>
                )}
                <div className="flex flex-wrap gap-2 mt-4">
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
                      setSummary(undefined);
                      setTab("batch");
                    }}
                  >
                    Новая очередь
                  </button>
                </div>
              </section>
            )}
          </main>
          {tab !== "history" && (
            <aside className="settings-panel">
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
                <p className="error text-xs">
                  {valid.error.issues.map((i) => i.message).join("; ")}
                </p>
              )}
              <ExportControls
                value={state.export}
                onChange={(value) => setState((s) => ({ ...s, export: value }))}
                disabled={busy}
              />
              {!exportValid.success && (
                <p className="error text-xs">Проверьте настройки экспорта.</p>
              )}
              <fieldset disabled={busy || scanning} className="controls">
                <h3>Куда сохранить</h3>
                <button
                  className="w-full justify-start"
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
                  <FolderOpen size={16} />
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
                  Рядом с исходниками
                </label>
                <label className="control">
                  <span>Если файл уже существует</span>
                  <select
                    aria-label="Конфликты файлов"
                    value={conflict}
                    onChange={(e) =>
                      setConflict(e.target.value as typeof conflict)
                    }
                  >
                    <option value="skip">Пропустить</option>
                    <option value="rename">Уникальное имя</option>
                    <option value="overwrite">Перезаписать результат</option>
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={(e) => void changeForce(e.target.checked)}
                  />
                  Обрабатывать числовые PNG повторно
                </label>
                <p className="muted text-xs">
                  Оригиналы защищены от перезаписи. Вложенная структура
                  сохраняется.
                </p>
              </fieldset>
            </aside>
          )}
        </div>
        <footer className="process-bar">
          <div className="flex-1 min-w-0">
            <strong>
              {busy
                ? cancelling
                  ? "Остановка после текущего фото…"
                  : `Обработка ${done} из ${total}`
                : total
                  ? `${total} фотографий в очереди`
                  : "Готово к работе"}
            </strong>
            {busy ? (
              <>
                <progress value={done} max={Math.max(1, total)} />
                <span className="muted text-xs">
                  {Math.floor(elapsed / 1000)} с
                </span>
              </>
            ) : (
              <p className="muted text-xs">
                {state.lastOutput || "Выберите источники и папку результата"}
              </p>
            )}
          </div>
          {busy ? (
            <button
              disabled={cancelling}
              onClick={() => {
                setCancelling(true);
                void window.ayprom.cancel().catch(fail);
              }}
            >
              <Square size={16} />
              Отменить
            </button>
          ) : (
            <button
              className="primary process-button"
              disabled={!canProcess}
              onClick={() => void process()}
            >
              <Play size={17} />
              {tab === "manual"
                ? "Обработать с этими настройками"
                : "Обработать"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
