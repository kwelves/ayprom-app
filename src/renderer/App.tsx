import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Check, ChevronDown, CircleAlert, FolderOpen, X } from "lucide-react";
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
import { HistoryView } from "./components/HistoryView";
import { PresetControls } from "./components/PresetControls";
import { Preview } from "./components/Preview";
import { ProcessDock } from "./components/ProcessDock";
import { ProcessingControls } from "./components/ProcessingControls";
import { Queue, type QueueJob } from "./components/Queue";
import { ResultSheet } from "./components/ResultSheet";
import {
  TitleBar,
  workspaceOrder,
  workspaces,
  type Workspace,
} from "./components/TitleBar";
import { UpdateNotice } from "./components/UpdateNotice";
import { ease, rise, spring } from "./ui/motion";

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
  const [toast, setToast] = useState<{ id: number; text: string }>();
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
  const notify = (text: string) => setToast({ id: Date.now(), text });

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
  // The window caption follows the theme; save it without the debounce.
  const savedTheme = useRef(state.theme);
  useEffect(() => {
    if (!loaded || savedTheme.current === state.theme) return;
    savedTheme.current = state.theme;
    void window.ayprom.saveState(state).catch(fail);
  }, [state.theme, loaded]);
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme =
        state.theme === "system"
          ? query.matches
            ? "dark"
            : "light"
          : state.theme;
    };
    // One composited cross-fade of the whole window instead of hundreds of
    // per-element colour transitions. Theme changes are rare, so it earns it.
    const swap = () => {
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!document.startViewTransition || reduce || !root.dataset.theme)
        apply();
      else document.startViewTransition(apply);
    };
    swap();
    query.addEventListener("change", swap);
    return () => query.removeEventListener("change", swap);
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
      500,
    );
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(undefined), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

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
  function chooseOutput() {
    void window.ayprom
      .selectOutput()
      .then((output) => {
        if (output) {
          setState((s) => ({ ...s, lastOutput: output }));
          setSameSource(false);
        }
      })
      .catch(fail);
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
  const copyReport = (value: unknown) =>
    void window.ayprom
      .copyReport(JSON.stringify(value, null, 2))
      .then(() => notify("Отчёт скопирован в буфер обмена"))
      .catch(fail);

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
  const ready = {
    sources: jobs.some((job) => job.total > 0) || (!jobs.length && !!input),
    settings: valid.success && exportValid.success,
    output: sameSource || !!state.lastOutput,
  };
  const canProcess =
    loaded &&
    !busy &&
    !scanning &&
    ready.sources &&
    ready.settings &&
    ready.output;

  // Keyboard: Ctrl+1…3 switch modes, Ctrl+O adds folders, Ctrl+Enter runs.
  const keys = useRef({ canProcess, busy, scanning, tab });
  keys.current = { canProcess, busy, scanning, tab };
  const actions = useRef({ add, processQueue });
  actions.current = { add, processQueue };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      const index = ["1", "2", "3"].indexOf(event.key);
      if (index >= 0) {
        event.preventDefault();
        setTab(workspaceOrder[index]);
      } else if (event.key.toLowerCase() === "o" || event.key === "щ") {
        event.preventDefault();
        if (!keys.current.busy && !keys.current.scanning) {
          setTab("batch");
          void actions.current.add();
        }
      } else if (event.key === "Enter" && keys.current.canProcess) {
        event.preventDefault();
        void actions.current.processQueue();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTab]);

  if (!loaded)
    return (
      <main className="boot">
        <div className="boot-mark" aria-hidden="true">
          <span>AYPROM</span>
          <span className="boot-rule" />
        </div>
        <strong className="sr-only">Запуск {BRAND.name}</strong>
        {error && <p className="error">{error}</p>}
      </main>
    );

  const result = summary && tab !== "history" && (
    <ResultSheet
      key={summary.id}
      summary={summary}
      onOpen={() =>
        void window.ayprom
          .openOutput(sameSource ? jobs[0].root : state.lastOutput)
          .catch(fail)
      }
      onCopy={() => copyReport(summary)}
      onReset={() => {
        setJobs([]);
        setSelectedJob("");
        setSummary(undefined);
        setTab("batch");
      }}
      onClose={() => setSummary(undefined)}
    />
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="app" data-tab={tab}>
        <TitleBar
          tab={tab}
          onTab={setTab}
          theme={state.theme}
          onTheme={(theme) => setState((s) => ({ ...s, theme }))}
          update={updateState}
          onCheckUpdates={() =>
            void window.ayprom.checkForUpdates().catch(fail)
          }
          busy={busy}
        />

        <div className="notices">
          <AnimatePresence initial={false}>
            {error && (
              <motion.div
                key="error"
                className="notice tone-error"
                role="alert"
                initial={{ opacity: 0, transform: "translateY(-4px)" }}
                animate={{
                  opacity: 1,
                  transform: "translateY(0px)",
                  transition: spring.gentle,
                }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              >
                <span className="notice-icon">
                  <CircleAlert size={16} />
                </span>
                <p className="notice-copy">
                  <strong>{error}</strong>
                </p>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Закрыть сообщение"
                  onClick={() => setError("")}
                >
                  <X size={15} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <UpdateNotice state={updateState} processing={busy} onError={fail} />
        </div>

        <div className={`workbench layout-${tab}`}>
          {/* Mode switches are frequent and keyboard-driven: no transition. */}
          <div key={tab} className="workbench-main">
            {tab === "batch" && (
              <Queue
                jobs={jobs}
                selectedId={selectedQueueJob?.id ?? ""}
                busy={busy}
                scanning={scanning}
                add={(paths) => void add(paths)}
                select={setSelectedJob}
                remove={(id) => {
                  setJobs((current) => current.filter((job) => job.id !== id));
                  if (selectedJob === id)
                    setSelectedJob(jobs.find((job) => job.id !== id)?.id ?? "");
                }}
                preview={(path) => {
                  setInput(path);
                  setTab("manual");
                }}
              />
            )}
            {tab === "history" ? (
              <HistoryView
                history={state.history}
                onCopy={copyReport}
                onStart={() => setTab("batch")}
              />
            ) : (
              <div className="stage-col">
                <AnimatePresence initial={false}>{result}</AnimatePresence>
                <Preview
                  title={workspaces[tab].title}
                  input={
                    tab === "batch"
                      ? (selectedQueueJob?.firstImage ?? "")
                      : input
                  }
                  config={config}
                  settings={state.export}
                  choose={() => void choosePreview()}
                  compact={tab === "batch"}
                  empty={
                    tab === "batch"
                      ? jobs.length
                        ? {
                            title: "Нет доступного предпросмотра",
                            text: "В источнике не найдено подходящее изображение.",
                            action: true,
                          }
                        : {
                            title: "Здесь появится контроль результата",
                            text: "Добавьте папки в очередь — первое фото источника покажет, каким получится весь пакет.",
                          }
                      : {
                          title: "Выберите контрольное фото",
                          text: "Результат пересчитывается сразу после каждого изменения параметров.",
                          action: true,
                        }
                  }
                />
              </div>
            )}
          </div>

          {tab !== "history" && (
            <aside className="inspector panel" aria-label="Инспектор настроек">
              <header className="panel-head">
                <div>
                  <h2>Параметры</h2>
                  <p className="panel-sub">Для всей текущей очереди</p>
                </div>
              </header>
              <div className="inspector-scroll">
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
                  onChange={(value) =>
                    setState((s) => ({ ...s, export: value }))
                  }
                  disabled={busy}
                />
                {!exportValid.success && (
                  <p className="inline-error">Проверьте параметры экспорта.</p>
                )}
                <fieldset
                  disabled={busy || scanning}
                  className="inspector-section"
                >
                  <legend className="section-head">
                    <h3>Сохранение</h3>
                  </legend>
                  <button
                    type="button"
                    className={`path-picker ${state.lastOutput && !sameSource ? "is-set" : ""}`}
                    aria-label={
                      state.lastOutput
                        ? `Папка результата: ${state.lastOutput}`
                        : "Выбрать папку результата"
                    }
                    onClick={chooseOutput}
                  >
                    <span className="path-picker-icon">
                      {state.lastOutput && !sameSource ? (
                        <Check size={14} strokeWidth={2.4} />
                      ) : (
                        <FolderOpen size={15} />
                      )}
                    </span>
                    <span className="path-picker-text">
                      <strong>
                        {state.lastOutput
                          ? "Папка результата"
                          : "Выбрать папку результата"}
                      </strong>
                      <span className="mono truncate" title={state.lastOutput}>
                        {state.lastOutput || "Оригиналы не перезаписываются"}
                      </span>
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
                  <label className="field">
                    <span className="field-label">Если файл существует</span>
                    <span className="select-wrap">
                      <select
                        className="select"
                        aria-label="Конфликты файлов"
                        value={conflict}
                        onChange={(e) =>
                          setConflict(e.target.value as typeof conflict)
                        }
                      >
                        <option value="skip">Пропустить</option>
                        <option value="rename">Создать уникальное имя</option>
                        <option value="overwrite">
                          Перезаписать результат
                        </option>
                      </select>
                      <ChevronDown size={15} />
                    </span>
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={force}
                      onChange={(e) => void changeForce(e.target.checked)}
                    />
                    <span>Повторно обрабатывать числовые PNG</span>
                  </label>
                  <p className="hint">
                    Оригиналы не перезаписываются. Структура вложенных папок
                    сохраняется.
                  </p>
                </fieldset>
              </div>
            </aside>
          )}
        </div>

        <ProcessDock
          busy={busy}
          cancelling={cancelling}
          canProcess={canProcess}
          ready={ready}
          done={done}
          total={total}
          elapsed={elapsed}
          preset={activePreset}
          destination={destination}
          onStart={() => void processQueue()}
          onCancel={() => {
            setCancelling(true);
            void window.ayprom.cancel().catch(fail);
          }}
          onAddSources={() => {
            setTab("batch");
            void add();
          }}
          onChooseOutput={chooseOutput}
        />

        <div className="toast-region" aria-live="polite">
          <AnimatePresence>
            {toast && (
              <motion.div
                key="toast"
                className="toast"
                {...rise}
                exit={{
                  opacity: 0,
                  transform: "translateY(4px)",
                  transition: { duration: 0.12, ease: ease.standard },
                }}
              >
                <Check size={14} strokeWidth={2.4} />
                {toast.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
