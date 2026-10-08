import { AnimatePresence, motion } from "motion/react";
import type { ExportSettings } from "../../shared/contracts";
import { Segmented } from "../ui/Segmented";
import { ease } from "../ui/motion";

const formatNote = {
  png: "Без потерь · прозрачный фон · исходная компрессия PNG",
  jpeg: "Без прозрачности: фон заливается выбранным цветом.",
  webp: "Компактный файл с прозрачностью для веба и маркетплейсов.",
} as const;

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
    <fieldset disabled={disabled} className="inspector-section">
      <legend className="section-head">
        <h3>Формат результата</h3>
      </legend>
      <Segmented
        label="Формат результата"
        stretch
        disabled={disabled}
        value={value.format}
        onChange={(format) => onChange({ ...value, format })}
        options={[
          { value: "png", label: "PNG" },
          { value: "jpeg", label: "JPEG" },
          { value: "webp", label: "WebP" },
        ]}
      />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={value.format}
          className="stack"
          initial={{ opacity: 0, y: 4 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: 0.22, ease: ease.out },
          }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
        >
          <p className="hint">{formatNote[value.format]}</p>
          {value.format !== "png" && (
            <label className="field field-inline">
              <span className="field-label">Качество</span>
              <input
                className="input input-num"
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
              <label className="field field-inline">
                <span className="field-label">Цвет фона</span>
                <span className="color-field">
                  <span className="mono">{value.background.toUpperCase()}</span>
                  <input
                    aria-label="Цвет фона"
                    type="color"
                    value={value.background}
                    onChange={(e) =>
                      onChange({ ...value, background: e.target.value })
                    }
                  />
                </span>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={value.progressive}
                  onChange={(e) =>
                    onChange({ ...value, progressive: e.target.checked })
                  }
                />
                <span>Progressive JPEG</span>
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
                <span>Без потерь</span>
              </label>
              <label className="field field-inline">
                <span className="field-label">Качество alpha</span>
                <input
                  className="input input-num"
                  aria-label="Качество alpha"
                  type="number"
                  min="0"
                  max="100"
                  value={value.alphaQuality}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      alphaQuality: Number(e.target.value),
                    })
                  }
                />
              </label>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </fieldset>
  );
}
