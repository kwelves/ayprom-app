import { AlertTriangle, Folder, ImageIcon, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import type { ScanJob } from "../../shared/contracts";

export type QueueJob = ScanJob & {
  done?: number;
  status?: string;
  current?: string;
  destination?: string;
  errors?: string[];
};

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
  return (
    <section className="queue">
      <div className="section-title">
        <div>
          <h2>Очередь</h2>
          <p>
            {jobs.length
              ? `${jobs.length} источников · ${total} изображений`
              : "Добавьте папки или отдельные изображения"}
          </p>
        </div>
        <button disabled={busy || scanning} onClick={() => add()}>
          <Folder size={15} />
          Добавить
        </button>
      </div>
      <div
        className={`dropzone ${drag ? "dragging" : ""} ${scanning ? "scanning" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy && !scanning) setDrag(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDrag(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDrag(false);
          if (!busy && !scanning)
            add(
              window.ayprom.pathsForFiles(Array.from(event.dataTransfer.files)),
            );
        }}
      >
        <div className="dropzone-icon">
          <Upload size={21} />
        </div>
        <div>
          <strong>
            {scanning
              ? "Сканируем источники…"
              : drag
                ? "Добавить в очередь"
                : "Перетащите сюда папки или фото"}
          </strong>
          <span>PNG · WebP · JPEG · AVIF · TIFF</span>
        </div>
      </div>
      {!jobs.length && !scanning ? (
        <div className="queue-empty">
          <ImageIcon size={24} />
          <p>Очередь пуста</p>
          <span>Вложенные папки будут добавлены автоматически.</span>
        </div>
      ) : (
        <div className="queue-list" aria-label="Источники обработки">
          {jobs.map((job) => {
            const selected = job.id === selectedId;
            const hasError = Boolean(job.error || job.errors?.length);
            return (
              <article
                key={job.id}
                className={`queue-item ${selected ? "is-selected" : ""}`}
                aria-current={selected ? "true" : undefined}
                onClick={() => select(job.id)}
              >
                <div className="folder-icon">
                  {hasError ? (
                    <AlertTriangle size={18} />
                  ) : (
                    <Folder size={18} />
                  )}
                </div>
                <div className="queue-item-main">
                  <div className="queue-item-title">
                    <strong className="truncate" title={job.root}>
                      {job.name}
                    </strong>
                    <span
                      className={`status-badge ${hasError ? "status-error" : job.status === "Завершено" ? "status-success" : ""}`}
                    >
                      {job.error ? "Ошибка" : (job.status ?? "Готово")}
                    </span>
                  </div>
                  <p className="path-line" title={job.root}>
                    {job.root}
                  </p>
                  <div className="queue-meta">
                    <span>
                      {job.done ?? 0} / {job.total} фото
                    </span>
                    <span>{job.folders} папок</span>
                  </div>
                  {job.status && (
                    <progress
                      aria-label={`Прогресс ${job.name}`}
                      value={job.done ?? 0}
                      max={Math.max(1, job.total)}
                    />
                  )}
                  {job.current && (
                    <p className="path-line" title={job.current}>
                      {job.current}
                    </p>
                  )}
                  {job.destination && (
                    <p className="path-line" title={job.destination}>
                      Результат: {job.destination}
                    </p>
                  )}
                  {job.error && <p className="inline-error">{job.error}</p>}
                  {!!job.errors?.length && (
                    <details className="error-details">
                      <summary>Ошибки ({job.errors.length})</summary>
                      {job.errors.map((error, index) => (
                        <p key={index}>{error}</p>
                      ))}
                    </details>
                  )}
                </div>
                <div className="queue-actions">
                  <button
                    className="icon-button"
                    title="Открыть в настройке"
                    aria-label={`Предпросмотр ${job.name}`}
                    disabled={!job.firstImage}
                    onClick={(event) => {
                      event.stopPropagation();
                      preview(job.firstImage!);
                    }}
                  >
                    <ImageIcon size={15} />
                  </button>
                  <button
                    className="icon-button danger-action"
                    title="Убрать из очереди"
                    aria-label={`Убрать ${job.name}`}
                    disabled={busy || scanning}
                    onClick={(event) => {
                      event.stopPropagation();
                      remove(job.id);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
