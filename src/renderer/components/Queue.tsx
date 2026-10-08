import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Check,
  Folder,
  FolderPlus,
  ImageIcon,
  LoaderCircle,
  ScanEye,
  Trash2,
} from "lucide-react";
import type { ScanJob } from "../../shared/contracts";
import { count, plural, shortPath } from "../ui/format";
import { Meter } from "../ui/Meter";
import { ease, spring } from "../ui/motion";

export type QueueJob = ScanJob & {
  done?: number;
  status?: string;
  current?: string;
  destination?: string;
  errors?: string[];
};

const FORMATS = ["PNG", "WebP", "JPEG", "AVIF", "TIFF"];

function statusOf(job: QueueJob) {
  if (job.error) return { tone: "danger", label: "Ошибка" } as const;
  switch (job.status) {
    case "Обработка":
      return { tone: "accent", label: "Обработка" } as const;
    case "Завершено":
      return { tone: "success", label: "Готово" } as const;
    case "С ошибками":
      return { tone: "danger", label: "С ошибками" } as const;
    case "Отменено":
      return { tone: "warning", label: "Отменено" } as const;
    case "Ожидает":
      return { tone: "neutral", label: "В очереди" } as const;
    default:
      return undefined;
  }
}

export function Queue({
  jobs,
  selectedId,
  busy,
  scanning,
  add,
  select,
  remove,
  preview,
}: {
  jobs: QueueJob[];
  selectedId: string;
  busy: boolean;
  scanning: boolean;
  add(paths?: string[]): void;
  select(id: string): void;
  remove(id: string): void;
  preview(path: string): void;
}) {
  const [drag, setDrag] = useState(false);
  const total = jobs.reduce((sum, job) => sum + job.total, 0);
  const locked = busy || scanning;
  const empty = !jobs.length && !scanning;
  const dropProps = {
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      if (!locked) setDrag(true);
    },
    onDragLeave: (event: React.DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node))
        setDrag(false);
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDrag(false);
      if (!locked)
        add(window.ayprom.pathsForFiles(Array.from(event.dataTransfer.files)));
    },
  };

  return (
    <section
      className={`queue panel ${drag ? "is-dragging" : ""}`}
      aria-labelledby="queue-title"
      {...dropProps}
    >
      <header className="panel-head">
        <div className="min-w-0">
          <h2 id="queue-title">Очередь</h2>
          <p className="panel-sub num">
            {jobs.length
              ? `${jobs.length} ${plural(jobs.length, ["источник", "источника", "источников"])} · ${count(total)} фото`
              : "Папки и отдельные фото"}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          disabled={locked}
          onClick={() => add()}
          title="Добавить папки · Ctrl+O"
        >
          <FolderPlus size={14} />
          Добавить
        </button>
      </header>

      <div className="queue-body">
        {!empty && (
          <ul className="queue-list" aria-label="Источники обработки">
            <AnimatePresence initial={false}>
              {jobs.map((job) => {
                const selected = job.id === selectedId;
                const status = statusOf(job);
                const running = job.status === "Обработка";
                const done = job.done ?? 0;
                return (
                  <motion.li
                    key={job.id}
                    layout="position"
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { duration: 0.22, ease: ease.out },
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.97,
                      transition: { duration: 0.12, ease: ease.standard },
                    }}
                    transition={spring.layout}
                    className={`queue-item ${selected ? "is-selected" : ""} ${status ? `tone-${status.tone}` : ""}`}
                  >
                    <button
                      type="button"
                      className="queue-hit"
                      aria-current={selected ? "true" : undefined}
                      aria-label={job.name}
                      onClick={() => select(job.id)}
                    />
                    <span className="queue-tile" aria-hidden="true">
                      {job.error ? (
                        <AlertTriangle size={16} />
                      ) : running ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : job.status === "Завершено" ? (
                        <Check size={16} strokeWidth={2.4} />
                      ) : (
                        <Folder size={16} />
                      )}
                    </span>
                    <div className="queue-main">
                      <div className="queue-line">
                        <strong className="truncate" title={job.root}>
                          {job.name}
                        </strong>
                        {status && (
                          <span className={`badge badge-${status.tone}`}>
                            {status.label}
                          </span>
                        )}
                      </div>
                      <p className="queue-meta num">
                        <span>
                          {job.status
                            ? `${count(done)} / ${count(job.total)}`
                            : count(job.total)}{" "}
                          фото
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {count(job.folders)}{" "}
                          {plural(job.folders, ["папка", "папки", "папок"])}
                        </span>
                      </p>
                      <p className="queue-path mono truncate" title={job.root}>
                        {shortPath(job.root)}
                      </p>
                      {job.status && job.status !== "Ожидает" && (
                        <Meter
                          size="sm"
                          label={`Прогресс ${job.name}`}
                          value={done}
                          max={Math.max(1, job.total)}
                          tone={
                            job.errors?.length
                              ? "danger"
                              : job.status === "Завершено"
                                ? "success"
                                : "accent"
                          }
                        />
                      )}
                      {running && job.current && (
                        <p
                          className="queue-path mono truncate"
                          title={job.current}
                        >
                          {shortPath(job.current, 1)}
                        </p>
                      )}
                      {job.destination && !running && (
                        <p
                          className="queue-path mono truncate"
                          title={job.destination}
                        >
                          → {shortPath(job.destination)}
                        </p>
                      )}
                      {job.error && (
                        <p className="inline-error clamp-3" title={job.error}>
                          {job.error}
                        </p>
                      )}
                      {!!job.errors?.length && (
                        <details className="disclosure disclosure-danger">
                          <summary>
                            Ошибки{" "}
                            <span className="num">({job.errors.length})</span>
                          </summary>
                          <div className="disclosure-body">
                            {job.errors.map((error, index) => (
                              <p className="mono" key={index}>
                                {error}
                              </p>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                    <div className="queue-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        title="Открыть в ручной настройке"
                        aria-label={`Предпросмотр ${job.name}`}
                        disabled={!job.firstImage}
                        onClick={() => preview(job.firstImage!)}
                      >
                        <ScanEye size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn is-danger"
                        title="Убрать из очереди"
                        aria-label={`Убрать ${job.name}`}
                        disabled={locked}
                        onClick={() => remove(job.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        <div
          className={`dropzone ${empty ? "is-hero" : ""} ${drag ? "is-active" : ""} ${scanning ? "is-scanning" : ""}`}
          role="button"
          tabIndex={locked ? -1 : 0}
          aria-disabled={locked || undefined}
          aria-label="Добавить папки или фото в очередь"
          onClick={() => !locked && add()}
          onKeyDown={(event) => {
            if (!locked && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              add();
            }
          }}
        >
          <span className="dropzone-icon" aria-hidden="true">
            {scanning ? (
              <LoaderCircle size={20} className="spin" />
            ) : (
              <ImageIcon size={20} />
            )}
          </span>
          <span className="dropzone-copy">
            <strong>
              {scanning
                ? "Сканируем источники…"
                : drag
                  ? "Отпустите, чтобы добавить"
                  : empty
                    ? "Перетащите папки с фото"
                    : "Добавить ещё"}
            </strong>
            <span>
              {empty && !scanning
                ? "или нажмите, чтобы выбрать. Вложенные папки войдут автоматически."
                : "Перетащите папки или фото сюда"}
            </span>
          </span>
          {empty && !scanning && (
            <span
              className="dropzone-formats"
              aria-label="Поддерживаемые форматы"
            >
              {FORMATS.map((format) => (
                <span key={format}>{format}</span>
              ))}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
