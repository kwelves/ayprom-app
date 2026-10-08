import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Columns2,
  Grid2x2,
  ImagePlus,
  Moon,
  Square,
  Sun,
  ScanLine,
} from "lucide-react";
import {
  processingSchema,
  exportSchema,
  type ProcessingConfig,
  type ExportSettings,
} from "../../shared/contracts";
import { baseName, shortPath } from "../ui/format";
import { Segmented } from "../ui/Segmented";
import { ease } from "../ui/motion";

type View = "result" | "compare";
type Backdrop = "checker" | "light" | "dark";
type Quality = "idle" | "draft" | "refining" | "full";

const CANVAS_RATIO = 2657 / 3530;
const BACKDROP_KEY = "ayprom.stage.backdrop";

function readBackdrop(): Backdrop {
  try {
    const value = localStorage.getItem(BACKDROP_KEY);
    return value === "light" || value === "dark" ? value : "checker";
  } catch {
    return "checker";
  }
}

const qualityLabel: Record<Quality, string> = {
  idle: "",
  draft: "Готовим черновик…",
  refining: "Уточняем качество…",
  full: "Полное качество",
};

export function Preview({
  title,
  input,
  config,
  settings,
  choose,
  compact = false,
  empty,
}: {
  empty: { title: string; text: string; action?: boolean };
  title: string;
  input: string;
  config: ProcessingConfig;
  settings: ExportSettings;
  choose(): void;
  compact?: boolean;
}) {
  const [images, setImages] = useState<{ before: string; after: string }>();
  const [quality, setQuality] = useState<Quality>("idle");
  const [error, setError] = useState("");
  const [view, setView] = useState<View>(compact ? "result" : "compare");
  const [backdrop, setBackdrop] = useState<Backdrop>(readBackdrop);
  const [peek, setPeek] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(BACKDROP_KEY, backdrop);
    } catch {
      /* per-viewer convenience only */
    }
  }, [backdrop]);

  useEffect(() => {
    const requestId = ++generation.current;
    let disposed = false;
    setError("");
    void window.ayprom.cancelPreview();
    if (
      !input ||
      !processingSchema.safeParse(config).success ||
      !exportSchema.safeParse(settings).success
    ) {
      setImages(undefined);
      setQuality("idle");
      return;
    }
    setQuality("draft");
    const run = async () => {
      try {
        const fast = await window.ayprom.preview({
          input,
          processing: config,
          export: settings,
          requestId,
          draft: true,
        });
        if (disposed || generation.current !== requestId) return;
        setImages(fast);
        setQuality("refining");
        const result = await window.ayprom.preview({
          input,
          processing: config,
          export: settings,
          requestId,
          draft: false,
        });
        if (!disposed && generation.current === result.requestId) {
          setImages(result);
          setQuality("full");
        }
      } catch (err) {
        if (!disposed && !String(err).includes("Preview cancelled")) {
          setError(String(err));
          setQuality("idle");
        }
      }
    };
    const timer = setTimeout(() => void run(), 300);
    return () => {
      disposed = true;
      clearTimeout(timer);
      void window.ayprom.cancelPreview();
    };
  }, [input, config, settings]);

  // Hold «\» to look at the original in place of the result.
  useEffect(() => {
    if (view !== "result" || !images) return;
    const down = (event: KeyboardEvent) => {
      if (event.key === "\\" && !event.repeat && !isTyping(event))
        setPeek(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "\\") setPeek(false);
    };
    const blur = () => setPeek(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [view, images]);

  const canvasHeight = Math.round(config.canvasWidth * CANVAS_RATIO);
  const busy = quality === "draft" || quality === "refining";
  const draftImage = quality !== "full";

  return (
    <section
      className={`stage ${compact ? "stage-compact" : ""}`}
      aria-labelledby="stage-title"
    >
      <header className="stage-head">
        <div className="stage-title min-w-0">
          <h1 id="stage-title">{title}</h1>
          {input && (
            <p className="stage-file truncate" title={input}>
              <span className="stage-file-name">{baseName(input)}</span>
              <span className="mono">{shortPath(input, 2)}</span>
            </p>
          )}
        </div>
        <div className="stage-tools">
          {input && (
            <>
              <Segmented
                label="Вид предпросмотра"
                size="sm"
                value={view}
                onChange={(next) => {
                  setPeek(false);
                  setView(next);
                }}
                options={[
                  {
                    value: "result",
                    label: "Результат",
                    icon: <Square size={13} />,
                  },
                  {
                    value: "compare",
                    label: "Сравнение",
                    icon: <Columns2 size={13} />,
                  },
                ]}
              />
              <Segmented
                label="Фон просмотра"
                size="sm"
                value={backdrop}
                onChange={(next: Backdrop) => setBackdrop(next)}
                options={[
                  {
                    value: "checker" as const,
                    label: "Фон: прозрачность",
                    icon: <Grid2x2 size={13} />,
                    iconOnly: true,
                  },
                  {
                    value: "light",
                    label: "Фон: светлый",
                    icon: <Sun size={13} />,
                    iconOnly: true,
                  },
                  {
                    value: "dark",
                    label: "Фон: тёмный",
                    icon: <Moon size={13} />,
                    iconOnly: true,
                  },
                ]}
              />
            </>
          )}
          {(input || !compact) && (
            <button type="button" className="btn btn-sm" onClick={choose}>
              <ImagePlus size={14} />
              {compact ? "Другое фото" : "Выбрать фото"}
            </button>
          )}
        </div>
      </header>

      {!input ? (
        <div className="stage-empty">
          <CanvasSpec width={config.canvasWidth} height={canvasHeight} />
          <div className="stage-empty-copy">
            <h3>{empty.title}</h3>
            <p>{empty.text}</p>
          </div>
          {empty.action && (
            <button type="button" className="btn btn-primary" onClick={choose}>
              <ImagePlus size={15} />
              Выбрать фото
            </button>
          )}
        </div>
      ) : (
        <div className={`stage-body view-${view}`}>
          {(["before", "after"] as const).map((side) => {
            const hidden = view === "result" && side === "before";
            if (hidden) return null;
            const isAfter = side === "after";
            const showBefore = isAfter && view === "result" && peek;
            return (
              <figure
                key={side}
                className={`plate backdrop-${backdrop} ${isAfter ? "plate-after" : ""}`}
              >
                <figcaption className="plate-label">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={showBefore ? "peek" : side}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.08 }}
                    >
                      {side === "before" || showBefore
                        ? "Исходник"
                        : "Результат"}
                    </motion.span>
                  </AnimatePresence>
                </figcaption>
                {isAfter && (
                  <span className="plate-dims num" aria-label="Размер холста">
                    {config.canvasWidth} × {canvasHeight}
                  </span>
                )}
                <div className="plate-image">
                  {images ? (
                    <div className="plate-layers">
                      <img
                        src={images[side]}
                        alt={isAfter ? "После обработки" : "До обработки"}
                        data-draft={draftImage || undefined}
                        className={showBefore ? "is-hidden" : ""}
                      />
                      {isAfter && view === "result" && (
                        <img
                          src={images.before}
                          alt=""
                          aria-hidden="true"
                          className={`peek ${showBefore ? "" : "is-hidden"}`}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="plate-skeleton" aria-hidden="true">
                      <ScanLine size={22} />
                    </div>
                  )}
                </div>
              </figure>
            );
          })}
        </div>
      )}

      {input && (
        <footer className="stage-foot">
          <p aria-live="polite" className={`quality quality-${quality}`}>
            <span className="quality-dot" aria-hidden="true" />
            {qualityLabel[quality] && <span>{qualityLabel[quality]}.</span>}
            <span className="muted">
              Сетка обозначает прозрачность и не попадёт в файл.
            </span>
          </p>
          {view === "result" && images && (
            <button
              type="button"
              className={`btn btn-sm btn-ghost peek-btn ${peek ? "is-on" : ""}`}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setPeek(true);
              }}
              onPointerUp={() => setPeek(false)}
              onPointerCancel={() => setPeek(false)}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") setPeek(true);
              }}
              onKeyUp={() => setPeek(false)}
              title="Удерживайте, чтобы увидеть исходник"
            >
              Сравнить с исходником <kbd>\</kbd>
            </button>
          )}
          {busy && <span className="sr-only">Предпросмотр обновляется</span>}
        </footer>
      )}
      {error && (
        <p role="alert" className="stage-error">
          {error}
        </p>
      )}
    </section>
  );
}

function isTyping(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  return (
    !!target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  );
}

/** The canvas the batch will produce, drawn to scale with dimension lines. */
function CanvasSpec({ width, height }: { width: number; height: number }) {
  const w = 220;
  const h = Math.round(w * CANVAS_RATIO);
  return (
    <svg
      className="canvas-spec"
      viewBox={`0 0 ${w + 64} ${h + 56}`}
      width={w + 64}
      height={h + 56}
      role="img"
      aria-label={`Холст результата ${width} на ${height} пикселей`}
    >
      <g transform="translate(40 16)">
        <rect className="spec-canvas" width={w} height={h} rx="3" />
        <rect
          className="spec-fill"
          x={w * 0.09}
          y={h * 0.09}
          width={w * 0.82}
          height={h * 0.82}
          rx="2"
        />
        <path
          className="spec-cross"
          d={`M${w / 2 - 6} ${h / 2}h12M${w / 2} ${h / 2 - 6}v12`}
        />
        {/* width */}
        <path
          className="spec-dim"
          d={`M0 ${h + 14}h${w}M0 ${h + 9}v10M${w} ${h + 9}v10`}
        />
        <text className="spec-text" x={w / 2} y={h + 32} textAnchor="middle">
          {width} px
        </text>
        {/* height */}
        <path className="spec-dim" d={`M-14 0v${h}M-19 0h10M-19 ${h}h10`} />
        <text
          className="spec-text"
          x={-22}
          y={h / 2}
          textAnchor="middle"
          transform={`rotate(-90 -22 ${h / 2})`}
        >
          {height} px
        </text>
      </g>
    </svg>
  );
}
