import type { ProcessingConfig } from "../../shared/contracts";
interface Props {
  value: ProcessingConfig;
  onChange(value: ProcessingConfig): void;
  disabled?: boolean;
}
const fields = [
  {
    key: "fillRatio",
    label: "Заполнение кадра",
    min: 0.05,
    max: 1,
    step: 0.01,
    hint: "Доля холста, в которую вписывается товар.",
  },
  {
    key: "canvasWidth",
    label: "Ширина холста",
    min: 128,
    max: 6000,
    step: 1,
    hint: "Высота рассчитывается по исходной пропорции Figma 3530:2657.",
  },
  {
    key: "paddingRatio",
    label: "Отступ при обрезке",
    min: 0,
    max: 0.5,
    step: 0.01,
    hint: "Дополнительная область вокруг границ непрозрачного товара.",
  },
  {
    key: "alphaThreshold",
    label: "Порог прозрачности",
    min: 0,
    max: 254,
    step: 1,
    hint: "Пиксели с alpha выше этого значения участвуют в определении границ.",
  },
] as const;
export function ProcessingControls({ value, onChange, disabled }: Props) {
  const scalar = (field: (typeof fields)[number]) => (
    <label key={field.key} className="control" title={field.hint}>
      <span>
        {field.label}
        <small>{field.hint}</small>
      </span>
      <div className="range-pair">
        <input
          aria-label={field.label}
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value[field.key]}
          onChange={(e) =>
            onChange({ ...value, [field.key]: Number(e.target.value) })
          }
        />
        <input
          aria-label={`${field.label}: значение`}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value[field.key]}
          onChange={(e) =>
            onChange({ ...value, [field.key]: Number(e.target.value) })
          }
        />
      </div>
    </label>
  );
  return (
    <fieldset disabled={disabled} className="controls">
      <h3>Композиция</h3>
      {scalar(fields[0])}
      {scalar(fields[1])}
      <p className="muted text-xs">
        Холст: {value.canvasWidth} ×{" "}
        {Math.round((value.canvasWidth * 2657) / 3530)} px
      </p>
      <details>
        <summary>Дополнительные настройки</summary>
        {scalar(fields[2])}
        {scalar(fields[3])}
        <h3>Адаптивная резкость</h3>
        {(["minAmount", "maxAmount"] as const).map((key, i) => (
          <label className="control" key={key}>
            <span>
              {i === 0 ? "Минимальная сила" : "Максимальная сила"}
              <small>
                {i === 0
                  ? "Для уже резких участков."
                  : "Для наименее резких участков."}
              </small>
            </span>
            <div className="range-pair">
              <input
                aria-label={key}
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={value.sharpen[key]}
                onChange={(e) =>
                  onChange({
                    ...value,
                    sharpen: {
                      ...value.sharpen,
                      [key]: Number(e.target.value),
                    },
                  })
                }
              />
              <input
                aria-label={`${key}: значение`}
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={value.sharpen[key]}
                onChange={(e) =>
                  onChange({
                    ...value,
                    sharpen: {
                      ...value.sharpen,
                      [key]: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
          </label>
        ))}
        <h3>Восстановление светов</h3>
        {(["knee", "ceiling"] as const).map((key, i) => (
          <label className="control" key={key}>
            <span>
              {i === 0 ? "Порог светов" : "Потолок светов"}
              <small>
                {i === 0
                  ? "Значения яркости выше порога сжимаются."
                  : "Максимальная яркость после сжатия светов."}
              </small>
            </span>
            <input
              type="number"
              aria-label={key}
              min="0"
              max="255"
              value={value.highlights[key]}
              onChange={(e) =>
                onChange({
                  ...value,
                  highlights: {
                    ...value.highlights,
                    [key]: Number(e.target.value),
                  },
                })
              }
            />
          </label>
        ))}
      </details>
    </fieldset>
  );
}
