import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
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
}: {
  input: string;
  config: ProcessingConfig;
  settings: ExportSettings;
  choose(): void;
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
    setStatus("Обновление…");
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
        setStatus("Быстрый просмотр · уточнение…");
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
    <section className="preview">
      <div className="section-title">
        <div>
          <h2>До и после</h2>
          <p className="muted truncate" title={input}>
            {input || "Выберите изображение для настройки"}
          </p>
        </div>
        <button onClick={choose}>
          <ImagePlus size={16} />
          Выбрать фото
        </button>
      </div>
      {!input ? (
        <div className="preview-empty">
          <ImagePlus size={42} />
          <h3>Настройте результат на одном фото</h3>
          <p>Изменения автоматически появятся здесь.</p>
          <button className="primary" onClick={choose}>
            Выбрать изображение
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
          <p aria-live="polite" className="muted text-xs">
            {status} · Шахматная сетка показывает прозрачность и не сохраняется
            в файл.
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
