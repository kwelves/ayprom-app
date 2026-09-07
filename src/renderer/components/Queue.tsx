import { Folder, Trash2, ImageIcon, Upload } from "lucide-react";
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
  busy,
  scanning,
  add,
  remove,
  preview,
}: {
  jobs: QueueJob[];
  busy: boolean;
  scanning: boolean;
  add(paths?: string[]): void;
  remove(id: string): void;
  preview(path: string): void;
}) {
  const [drag, setDrag] = useState(false);
  return (
    <section>
      <div className="section-title">
        <div>
          <h2>Очередь обработки</h2>
          <p className="muted">
            {jobs.length
              ? `${jobs.length} источников · ${jobs.reduce((n, j) => n + j.total, 0)} изображений`
              : "Добавьте папки с фотографиями товаров"}
          </p>
        </div>
        <button disabled={busy || scanning} onClick={() => add()}>
          <Folder size={16} />
          Выбрать папки
        </button>
      </div>
      <div
        className={`dropzone ${drag ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy && !scanning) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!busy && !scanning)
            add(window.ayprom.pathsForFiles(Array.from(e.dataTransfer.files)));
        }}
      >
        <Upload size={28} />
        <strong>
          {scanning
            ? "Сканирование папок…"
            : "Перетащите папки или изображения"}
        </strong>
        <span>PNG, WebP, JPEG, AVIF, TIFF · вложенные папки включены</span>
      </div>
      <div className="queue-list">
        {jobs.map((job) => (
          <article key={job.id} className="queue-item">
            <div className="folder-icon">
              <Folder size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <strong className="truncate" title={job.root}>
                  {job.name}
                </strong>
                <span
                  className={`badge ${job.error || job.errors?.length ? "bad" : ""}`}
                >
                  {job.error ? "Ошибка" : (job.status ?? "Ожидает")}
                </span>
              </div>
              <p className="muted truncate text-xs" title={job.root}>
                {job.root}
              </p>
              <div className="flex items-center gap-3 text-xs muted">
                <span>
                  {job.done ?? 0}/{job.total} фото
                </span>
                <span>{job.folders} вложенных папок</span>
              </div>
              {job.status && (
                <progress value={job.done ?? 0} max={Math.max(1, job.total)} />
              )}
              <p className="text-xs muted truncate" title={job.current}>
                {job.current}
              </p>
              {job.destination && (
                <p className="text-xs muted truncate" title={job.destination}>
                  → {job.destination}
                </p>
              )}
              {job.error && <p className="error text-xs">{job.error}</p>}
              {!!job.errors?.length && (
                <details className="error text-xs">
                  <summary>Ошибки: {job.errors.length}</summary>
                  {job.errors.map((error, i) => (
                    <p key={i}>{error}</p>
                  ))}
                  <button
                    onClick={() =>
                      void window.ayprom.copyReport(job.errors!.join("\n"))
                    }
                  >
                    Копировать ошибки
                  </button>
                </details>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                className="icon-button"
                title="Предпросмотр первого фото"
                aria-label={`Предпросмотр ${job.name}`}
                disabled={!job.firstImage}
                onClick={() => preview(job.firstImage!)}
              >
                <ImageIcon size={16} />
              </button>
              <button
                className="icon-button"
                title="Убрать из очереди"
                aria-label={`Убрать ${job.name}`}
                disabled={busy || scanning}
                onClick={() => remove(job.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
