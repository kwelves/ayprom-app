import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { Check, Circle, FolderOutput, Play, Square } from "lucide-react";
import { Digits } from "../ui/Digits";
import { clock, count, eta, plural, shortPath } from "../ui/format";
import { Meter } from "../ui/Meter";
import { ease, swap } from "../ui/motion";

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
  const span = Math.max(total, 1);

  return (
    <footer className={`dock ${busy ? "is-busy" : ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        {busy ? (
          <Swap key="run" className="dock-run">
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
                      <span className="dock-of">из {count(total)}</span>
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
              max={span}
            />
            <span className="dock-percent num" aria-hidden="true">
              {Math.floor((done / span) * 100)}%
            </span>
          </Swap>
        ) : (
          <Swap key="idle" className="dock-idle">
            <div className="dock-count min-w-0">
              <strong className="dock-title">
                {canProcess
                  ? `${count(total || 1)} ${plural(total || 1, ["фото готово", "фото готовы", "фото готово"])} к обработке`
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
          </Swap>
        )}
      </AnimatePresence>

      <div className="dock-action">
        {/* One element for Start and Stop: the press gets an immediate answer
            and there is never a leaving button lying over the new one. */}
        <button
          type="button"
          className={
            busy ? "btn btn-lg btn-danger" : "btn btn-lg btn-primary start-btn"
          }
          disabled={busy ? cancelling : !canProcess}
          onClick={busy ? onCancel : onStart}
          title={busy ? undefined : "Запустить · Ctrl+Enter"}
        >
          {busy ? (
            <>
              <Square size={14} fill="currentColor" />
              {cancelling ? "Останавливаем…" : "Остановить"}
            </>
          ) : (
            <>
              <Play size={15} fill="currentColor" />
              Запустить обработку
            </>
          )}
        </button>
      </div>
    </footer>
  );
}

/**
 * One state of the dock. While it animates out it is inert, so a leaving
 * state can never take a click meant for the one replacing it.
 */
function Swap({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const present = useIsPresent();
  return (
    <motion.div
      className={className}
      inert={!present}
      style={{ pointerEvents: present ? undefined : "none" }}
      {...swap}
    >
      {children}
    </motion.div>
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
              initial={{ transform: "scale(0.85)", opacity: 0 }}
              animate={{
                transform: "scale(1)",
                opacity: 1,
                transition: { duration: 0.18, ease: ease.out },
              }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
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
