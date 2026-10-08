import { motion } from "motion/react";
import {
  CircleAlert,
  CircleCheck,
  CircleSlash,
  ClipboardCopy,
  History,
} from "lucide-react";
import type { Summary } from "../../shared/contracts";
import { clock, runDate, shortPath } from "../ui/format";
import { ease } from "../ui/motion";

export function HistoryView({
  history,
  onCopy,
  onStart,
}: {
  history: Summary[];
  onCopy(item: Summary): void;
  onStart(): void;
}) {
  const totals = history.reduce(
    (sum, item) => ({
      processed: sum.processed + item.processed,
      failed: sum.failed + item.failed,
    }),
    { processed: 0, failed: 0 },
  );
  return (
    <section className="history panel" aria-labelledby="history-title">
      <header className="history-head">
        <div>
          <h1 id="history-title">История операций</h1>
          <p className="panel-sub num">
            {history.length
              ? `${history.length} из 30 сохранённых запусков · ${totals.processed} фото обработано${totals.failed ? ` · ${totals.failed} с ошибками` : ""}`
              : "Последние результаты, ошибки и папки экспорта"}
          </p>
        </div>
      </header>

      {!history.length ? (
        <div className="history-empty">
          <span className="history-empty-icon">
            <History size={22} />
          </span>
          <h3>История пока пуста</h3>
          <p>Каждый завершённый запуск сохранится здесь вместе с отчётом.</p>
          <button type="button" className="btn btn-primary" onClick={onStart}>
            Перейти к обработке
          </button>
        </div>
      ) : (
        <div
          className="history-table"
          role="table"
          aria-label="Последние операции"
        >
          <div className="history-row history-row-head" role="row">
            <span role="columnheader">Запуск</span>
            <span role="columnheader">Папка результата</span>
            <span role="columnheader">Итог</span>
            <span role="columnheader" className="cell-end">
              Время
            </span>
            <span role="columnheader">
              <span className="sr-only">Действия</span>
            </span>
          </div>
          {history.map((item, index) => {
            const tone = item.cancelled
              ? "warning"
              : item.failed
                ? "danger"
                : "success";
            const Icon = item.cancelled
              ? CircleSlash
              : item.failed
                ? CircleAlert
                : CircleCheck;
            const date = new Date(item.date).toLocaleString("ru-RU");
            return (
              <motion.div
                role="row"
                key={item.id}
                className="history-row"
                initial={{ opacity: 0, y: 6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.3,
                    ease: ease.out,
                    delay: Math.min(index, 8) * 0.03,
                  },
                }}
              >
                <span role="cell" className="history-when">
                  <span className={`history-status tone-${tone}`}>
                    <Icon size={16} strokeWidth={2.1} />
                  </span>
                  <span className="min-w-0">
                    <strong className="num">{runDate(item.date)}</strong>
                    <span className={`history-state tone-${tone}`}>
                      {item.cancelled
                        ? "Отменено"
                        : item.failed
                          ? "С ошибками"
                          : "Завершено"}
                      <span className="history-format">
                        {item.format.toUpperCase()}
                      </span>
                    </span>
                  </span>
                </span>
                <span
                  role="cell"
                  className="history-path mono truncate"
                  title={item.output}
                >
                  {shortPath(item.output, 3)}
                </span>
                <span role="cell" className="history-counts num">
                  <span>
                    <b>{item.processed}</b> готово
                  </span>
                  <span>
                    <b>{item.skipped}</b> пропущено
                  </span>
                  <span className={item.failed ? "is-danger" : ""}>
                    <b>{item.failed}</b> ошибок
                  </span>
                </span>
                <span role="cell" className="history-time num cell-end">
                  {clock(item.elapsedMs)}
                </span>
                <span role="cell" className="cell-end">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Копировать отчёт"
                    aria-label={`Копировать отчёт от ${date}`}
                    onClick={() => onCopy(item)}
                  >
                    <ClipboardCopy size={15} />
                  </button>
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
