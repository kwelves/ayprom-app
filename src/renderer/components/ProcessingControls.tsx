import { ChevronRight } from "lucide-react";
import type { ProcessingConfig } from "../../shared/contracts";

interface Props {
  value: ProcessingConfig;
  onChange(value: ProcessingConfig): void;
  disabled?: boolean;
}

interface Scalar {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

const fields = {
  fillRatio: {
    label: "Заполнение кадра",
    min: 0.05,
    max: 1,
    step: 0.01,
    hint: "Доля холста, в которую вписывается товар.",
  },
  canvasWidth: {
    label: "Ширина холста",
    min: 128,
    max: 6000,
    step: 1,
    unit: "px",
    hint: "Высота рассчитывается по исходной пропорции Figma 3530:2657.",
  },
  paddingRatio: {
    label: "Отступ при обрезке",
    min: 0,
    max: 0.5,
    step: 0.01,
    hint: "Дополнительная область вокруг границ непрозрачного товара.",
  },
  alphaThreshold: {
    label: "Порог прозрачности",
    min: 0,
    max: 254,
    step: 1,
    hint: "Пиксели с alpha выше этого значения участвуют в определении границ.",
  },
} satisfies Record<string, Scalar>;

/** Slider + exact numeric entry for one value. */
export function RangeField({
  field,
  value,
  onChange,
  name,
}: {
  field: Scalar;
  value: number;
  onChange(value: number): void;
  name?: string;
}) {
  const fill = ((value - field.min) / (field.max - field.min)) * 100;
  const label = name ?? field.label;
  return (
    <div className="field range-field" title={field.hint}>
      <div className="field-label">
        <span>{field.label}</span>
      </div>
      <div className="range-pair">
        <input
          className="range"
          aria-label={label}
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          style={
            {
              "--fill": `${Math.min(100, Math.max(0, fill))}%`,
            } as React.CSSProperties
          }
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <label className="num-box">
          <input
            className="input input-num"
            aria-label={`${label}: значение`}
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            value={value}
            aria-invalid={value < field.min || value > field.max || undefined}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          {field.unit && <span className="num-unit">{field.unit}</span>}
        </label>
      </div>
      <p className="hint">{field.hint}</p>
    </div>
  );
}

export function ProcessingControls({ value, onChange, disabled }: Props) {
  const scalar = (key: keyof typeof fields) => (
    <RangeField
      key={key}
      field={fields[key]}
      value={value[key]}
      onChange={(next) => onChange({ ...value, [key]: next })}
    />
  );
  return (
    <fieldset disabled={disabled} className="inspector-section">
      <legend className="section-head">
        <h3>Композиция</h3>
      </legend>
      {scalar("fillRatio")}
      {scalar("canvasWidth")}
      <p className="canvas-readout">
        <span>Холст</span>
        <span className="num">
          {value.canvasWidth} × {Math.round((value.canvasWidth * 2657) / 3530)}{" "}
          px
        </span>
      </p>
      <details className="disclosure">
        <summary>
          <ChevronRight size={14} className="disclosure-chevron" />
          Дополнительные настройки
        </summary>
        <div className="disclosure-body stack">
          {scalar("paddingRatio")}
          {scalar("alphaThreshold")}
          <h4 className="subhead">Адаптивная резкость</h4>
          {(["minAmount", "maxAmount"] as const).map((key, i) => (
            <RangeField
              key={key}
              name={key}
              field={{
                label: i === 0 ? "Минимальная сила" : "Максимальная сила",
                hint:
                  i === 0
                    ? "Для уже резких участков."
                    : "Для наименее резких участков.",
                min: 0,
                max: 10,
                step: 0.1,
              }}
              value={value.sharpen[key]}
              onChange={(next) =>
                onChange({
                  ...value,
                  sharpen: { ...value.sharpen, [key]: next },
                })
              }
            />
          ))}
          <h4 className="subhead">Восстановление светов</h4>
          <div className="pair-grid">
            {(["knee", "ceiling"] as const).map((key, i) => (
              <label className="field" key={key}>
                <span className="field-label">
                  {i === 0 ? "Порог светов" : "Потолок светов"}
                </span>
                <input
                  className="input num"
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
                <span className="hint">
                  {i === 0
                    ? "Яркость выше порога сжимается."
                    : "Максимум яркости после сжатия."}
                </span>
              </label>
            ))}
          </div>
        </div>
      </details>
    </fieldset>
  );
}
