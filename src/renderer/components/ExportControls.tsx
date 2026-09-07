import type { ExportSettings } from "../../shared/contracts";
export function ExportControls({
  value,
  onChange,
  disabled,
}: {
  value: ExportSettings;
  onChange(value: ExportSettings): void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="controls">
      <h3>Формат результата</h3>
      <div className="format-tabs">
        {(["png", "jpeg", "webp"] as const).map((format) => (
          <button
            key={format}
            aria-pressed={value.format === format}
            className={value.format === format ? "selected" : ""}
            onClick={() => onChange({ ...value, format })}
          >
            {format.toUpperCase()}
          </button>
        ))}
      </div>
      {value.format !== "png" && (
        <label className="control">
          <span>Качество</span>
          <input
            aria-label="Качество"
            type="number"
            min="1"
            max="100"
            value={value.quality}
            onChange={(e) =>
              onChange({ ...value, quality: Number(e.target.value) })
            }
          />
        </label>
      )}
      {value.format === "jpeg" && (
        <>
          <label className="control">
            <span>
              Цвет фона<small>JPEG не поддерживает прозрачность.</small>
            </span>
            <input
              aria-label="Цвет фона"
              type="color"
              value={value.background}
              onChange={(e) =>
                onChange({ ...value, background: e.target.value })
              }
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={value.progressive}
              onChange={(e) =>
                onChange({ ...value, progressive: e.target.checked })
              }
            />
            Progressive JPEG
          </label>
        </>
      )}
      {value.format === "webp" && (
        <>
          <label className="check">
            <input
              type="checkbox"
              checked={value.lossless}
              onChange={(e) =>
                onChange({ ...value, lossless: e.target.checked })
              }
            />
            Без потерь
          </label>
          <label className="control">
            <span>Качество alpha</span>
            <input
              aria-label="Качество alpha"
              type="number"
              min="0"
              max="100"
              value={value.alphaQuality}
              onChange={(e) =>
                onChange({ ...value, alphaQuality: Number(e.target.value) })
              }
            />
          </label>
        </>
      )}
      {value.format === "png" && (
        <p className="muted text-xs">
          Без потерь · прозрачный фон · исходная компрессия PNG
        </p>
      )}
    </fieldset>
  );
}
