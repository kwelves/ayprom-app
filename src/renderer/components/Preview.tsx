import { useEffect, useRef, useState } from "react";
import { ImagePlus, ScanLine } from "lucide-react";
import {
  processingSchema,
  exportSchema,
  type ProcessingConfig,
  type ExportSettings,
} from "../../shared/contracts";
export function Preview({
  input,
  config,
  settings,
  choose,
  compact = false,
}: {
  input: string;
  config: ProcessingConfig;
  settings: ExportSettings;
  choose(): void;
  compact?: boolean;
}) {
  const [images, setImages] = useState<{ before: string; after: string }>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const generation = useRef(0);
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
      return;
    }
    setStatus("Готовим черновик…");
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
        setStatus("Уточняем качество…");
        const result = await window.ayprom.preview({
          input,
          processing: config,
          export: settings,
          requestId,
          draft: false,
        });
        if (!disposed && generation.current === result.requestId) {
          setImages(result);
          setStatus("Полное качество");
        }
      } catch (err) {
        if (!disposed && !String(err).includes("Preview cancelled")) {
          setError(String(err));
          setStatus("");
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
  return (
    <section className={`preview ${compact ? "preview-compact" : ""}`}>
      <div className="section-title">
        <div>
          <h2>{compact ? "Контроль результата" : "До и после"}</h2>
          <p className="muted truncate" title={input}>
            {input || "Выберите изображение для настройки"}
          </p>
        </div>
        <button onClick={choose}>
          <ImagePlus size={16} />
          {compact ? "Другое фото" : "Выбрать фото"}
        </button>
      </div>
      {!input ? (
        <div className="preview-empty">
          <ScanLine size={34} />
          <h3>
            {compact
              ? "Нет доступного предпросмотра"
              : "Выберите контрольное фото"}
          </h3>
          <p>
            {compact
              ? "В источнике не найдено подходящее изображение."
              : "Изменения появятся здесь автоматически."}
          </p>
          <button className="primary" onClick={choose}>
            Выбрать фото
          </button>
        </div>
      ) : (
        <>
          <div className="comparison">
            {(["before", "after"] as const).map((side, index) => (
              <div key={side}>
                <span className="image-label">
                  {index === 0 ? "Исходник" : "Результат"}
                </span>
                <div className="checkerboard">
                  {images ? (
                    <img
                      src={images[side]}
                      alt={index === 0 ? "До обработки" : "После обработки"}
                    />
                  ) : (
                    <span>Подготовка просмотра…</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p aria-live="polite" className="preview-status">
            <span
              className={
                status && status !== "Полное качество"
                  ? "busy-indicator"
                  : "ready-indicator"
              }
            />
            {status}. Сетка обозначает прозрачность и не попадёт в файл.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
