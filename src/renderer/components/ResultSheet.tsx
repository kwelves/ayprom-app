import { motion } from "motion/react";
import {
  CircleAlert,
  CircleCheck,
  CircleSlash,
  ClipboardCopy,
  FolderOpen,
  ListRestart,
  X,
} from "lucide-react";
import type { Summary } from "../../shared/contracts";
import { CountUp } from "../ui/Digits";
import { shortPath } from "../ui/format";
import { spring } from "../ui/motion";

/** Completion report. Appears once per run; the numbers count up into place. */
export function ResultSheet({
  summary,
  onOpen,
  onCopy,
  onReset,
  onClose,
}: {
  summary: Summary;
  onOpen(): void;
  onCopy(): void;
  onReset(): void;
  onClose(): void;
}) {
  const tone = summary.cancelled
    ? "warning"
    : summary.failed
      ? "danger"
      : "success";
  const Icon = summary.cancelled
    ? CircleSlash
    : summary.failed
      ? CircleAlert
      : CircleCheck;
  const stats = [
    { label: "Готово", value: summary.processed },
    { label: "Пропущено", value: summary.skipped },
    { label: "Ошибок", value: summary.failed, danger: summary.failed > 0 },
  ];
  return (
    <motion.section
      className={`result tone-${tone}`}
      aria-live="polite"
      aria-labelledby="result-title"
      initial={{ opacity: 0, y: -10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
    >
      <div className="result-head">
        <motion.span
          className="result-icon"
          initial={{ scale: 0.5, rotate: -20 }}
          animate={{
            scale: 1,
            rotate: 0,
            transition: { ...spring.snappy, delay: 0.08 },
          }}
        >
          <Icon size={19} strokeWidth={2.1} />
        </motion.span>
        <div className="min-w-0">
          <h2 id="result-title">
            {summary.cancelled
              ? "Обработка отменена"
              : summary.failed
                ? "Готово с ошибками"
                : "Обработка завершена"}
          </h2>
          <p className="result-sub num" title={summary.output}>
            {summary.format.toUpperCase()} ·{" "}
            {(summary.elapsedMs / 1000).toFixed(1)} с ·{" "}
            <span className="mono">{shortPath(summary.output, 2)}</span>
          </p>
        </div>
      </div>

      <div className="result-head">
        <dl className="result-stats">
          {stats.map((stat) => (
            <div key={stat.label} className={stat.danger ? "is-danger" : ""}>
              <dt>{stat.label}</dt>
              <dd>
                <CountUp value={stat.value} />
              </dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          className="icon-btn result-close"
          aria-label="Скрыть отчёт"
          title="Скрыть отчёт"
          onClick={onClose}
        >
          <X size={15} />
        </button>
      </div>

      <div className="result-foot">
        {!!summary.errors.length && (
          <details className="disclosure disclosure-danger">
            <summary>
              Показать ошибки{" "}
              <span className="num">({summary.errors.length})</span>
            </summary>
            <div className="disclosure-body">
              {summary.errors.map((entry, index) => (
                <p className="mono" key={index}>
                  {entry.path}: {entry.message}
                </p>
              ))}
            </div>
          </details>
        )}
        <div className="result-actions">
          <button type="button" className="btn btn-sm" onClick={onOpen}>
            <FolderOpen size={14} />
            Открыть папку
          </button>
          <button type="button" className="btn btn-sm" onClick={onCopy}>
            <ClipboardCopy size={14} />
            Копировать отчёт
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={onReset}
          >
            <ListRestart size={14} />
            Новая очередь
          </button>
        </div>
      </div>
    </motion.section>
  );
}
