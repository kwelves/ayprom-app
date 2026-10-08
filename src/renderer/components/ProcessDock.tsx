import { AnimatePresence, motion } from "motion/react";
import { Check, Circle, FolderOutput, Play, Square } from "lucide-react";
import { Digits } from "../ui/Digits";
import { clock, eta, plural, shortPath } from "../ui/format";
import { Meter } from "../ui/Meter";
import { ease, spring } from "../ui/motion";

export interface Readiness {
  sources: boolean;
  settings: boolean;
  output: boolean;
}

export function ProcessDock({
  busy,
  cancelling,
  canProcess,
  ready,
  done,
  total,
  elapsed,
  preset,
  destination,
  onStart,
  onCancel,
  onAddSources,
  onChooseOutput,
}: {
  busy: boolean;
  cancelling: boolean;
  canProcess: boolean;
  ready: Readiness;
  done: number;
  total: number;
  elapsed: number;
  preset: string;
  destination: string;
  onStart(): void;
  onCancel(): void;
  onAddSources(): void;
  onChooseOutput(): void;
}) {
  const rate = elapsed > 1500 && done > 0 ? done / (elapsed / 1000) : 0;
  const remaining = rate > 0 ? ((total - done) / rate) * 1000 : 0;
  const count = Math.max(total, 1);

  return (
    <footer className={`dock ${busy ? "is-busy" : ""}`}>
      <AnimatePresence mode="wait" initial={false}>
        {busy ? (
          <motion.div
            key="run"
            className="dock-run"
            initial={{ opacity: 0, y: 6 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { duration: 0.28, ease: ease.out },
            }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.14 } }}
          >
            <div className="dock-count">
              <strong className="dock-title">
                {cancelling ? (
                  "Завершаем текущее фото"
                ) : (
                  <>
                    <span className="sr-only">
                      Обработка {done} из {total}
                    </span>
                    <span aria-hidden="true" className="dock-digits">
                      <Digits value={done} />
                      <span className="dock-of">из {total}</span>
                    </span>
                  </>
                )}
              </strong>
              <p className="dock-sub num" title={destination}>
                <span>{clock(elapsed)}</span>
                {rate > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{rate.toFixed(rate < 10 ? 1 : 0)} фото/с</span>
                    <span aria-hidden="true">·</span>
                    <span>осталось {eta(remaining)}</span>
                  </>
                )}
              </p>
            </div>
            <Meter
              className="dock-meter"
              label="Общий прогресс"
              value={done}
              max={count}
            />
            <span className="dock-percent num" aria-hidden="true">
              {Math.floor((done / count) * 100)}%
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            className="dock-idle"
            initial={{ opacity: 0, y: 6 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { duration: 0.28, ease: ease.out },
            }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.14 } }}
          >
            <div className="dock-count min-w-0">
              <strong className="dock-title">
                {canProcess
                  ? `${total || 1} ${plural(total || 1, ["фото готово", "фото готовы", "фото готово"])} к обработке`
                  : !ready.sources
                    ? "Добавьте фотографии"
                    : !ready.output
                      ? "Укажите папку результата"
                      : "Проверьте параметры"}
              </strong>
              <p className="dock-sub truncate" title={destination}>
                {preset} · {shortPath(destination, 2) || destination}
              </p>
            </div>
            <ol className="readiness" aria-label="Готовность к запуску">
              <Step
                done={ready.sources}
                label="Источники"
                onClick={onAddSources}
              />
              <Step done={ready.settings} label="Параметры" />
              <Step
                done={ready.output}
                label="Папка результата"
                onClick={onChooseOutput}
                icon={<FolderOutput size={13} />}
              />
            </ol>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="dock-action">
        <AnimatePresence mode="popLayout" initial={false}>
          {busy ? (
            <motion.button
              key="stop"
              type="button"
              className="btn btn-lg btn-danger"
              disabled={cancelling}
              onClick={onCancel}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1, transition: spring.snappy }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
            >
              <Square size={14} fill="currentColor" />
              {cancelling ? "Останавливаем…" : "Остановить"}
            </motion.button>
          ) : (
            <motion.button
              key="start"
              type="button"
              className="btn btn-lg btn-primary start-btn"
              disabled={!canProcess}
              onClick={onStart}
              title="Запустить · Ctrl+Enter"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1, transition: spring.snappy }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
            >
              <Play size={15} fill="currentColor" />
              Запустить обработку
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </footer>
  );
}

function Step({
  done,
  label,
  onClick,
  icon,
}: {
  done: boolean;
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  const content = (
    <>
      <span className="step-mark" aria-hidden="true">
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.span
              key="done"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: spring.snappy }}
              exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.08 } }}
            >
              <Check size={11} strokeWidth={3} />
            </motion.span>
          ) : (
            <motion.span
              key="todo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
            >
              {icon ?? <Circle size={9} strokeWidth={2.5} />}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span>{label}</span>
      <span className="sr-only">{done ? ": готово" : ": требуется"}</span>
    </>
  );
  return (
    <li className={`step ${done ? "is-done" : ""}`}>
      {!done && onClick ? (
        <button type="button" className="step-btn" onClick={onClick}>
          {content}
        </button>
      ) : (
        <span className="step-btn">{content}</span>
      )}
    </li>
  );
}
