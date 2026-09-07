import { useEffect, useRef, useState } from "react";
import { Copy, RotateCcw, Save, Trash2, Plus } from "lucide-react";
import {
  factoryPreset,
  processingSchema,
  type ProcessingConfig,
  type ProcessingPreset,
} from "../../shared/contracts";
export function PresetControls({
  presets,
  selected,
  select,
  value,
  change,
  save,
  disabled,
}: {
  presets: ProcessingPreset[];
  selected: string;
  select(id: string): void;
  value: ProcessingConfig;
  change(value: ProcessingConfig): void;
  save(value: ProcessingPreset[]): void;
  disabled: boolean;
}) {
  const all = [factoryPreset(), ...presets];
  const current = all.find((p) => p.id === selected) ?? all[0];
  const [action, setAction] = useState<"create" | "rename" | "delete" | null>(
    null,
  );
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!action) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const elements = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "input:not(:disabled), button:not(:disabled)",
        ) ?? [],
      );
    elements()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = elements(),
        first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [action]);

  const dirty = JSON.stringify(current.processing) !== JSON.stringify(value);
  function submit() {
    if (action === "delete") {
      save(presets.filter((p) => p.id !== selected));
      select("ayprom-standard");
      setAction(null);
      return;
    }
    if (!name.trim() || name.trim().length > 80) {
      setError("Введите название от 1 до 80 символов");
      return;
    }
    if (!processingSchema.safeParse(value).success) {
      setError("Сначала исправьте параметры обработки");
      return;
    }
    if (action === "rename")
      save(
        presets.map((p) =>
          p.id === selected
            ? { ...p, name: name.trim(), updatedAt: new Date().toISOString() }
            : p,
        ),
      );
    else {
      const now = new Date().toISOString();
      const preset: ProcessingPreset = {
        id: crypto.randomUUID(),
        schemaVersion: 1,
        builtIn: false,
        name: name.trim(),
        processing: structuredClone(value),
        createdAt: now,
        updatedAt: now,
      };
      save([...presets, preset]);
      select(preset.id);
    }
    setAction(null);
  }
  const open = (next: typeof action, suggested = "") => {
    setAction(next);
    setName(suggested);
    setError("");
  };
  return (
    <fieldset disabled={disabled} className="controls">
      <div className="flex justify-between items-center">
        <h3>Пресет</h3>
        {dirty && <span className="badge">Изменён</span>}
      </div>
      <select
        aria-label="Пресет"
        value={current.id}
        onChange={(e) => select(e.target.value)}
      >
        {all.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.builtIn ? " · встроенный" : ""}
          </option>
        ))}
      </select>
      <div className="preset-actions">
        <button
          title="Создать пресет с текущими настройками"
          onClick={() => open("create")}
        >
          <Plus size={14} />
          Новый
        </button>
        <button
          title="Дублировать"
          onClick={() => open("create", `${current.name} — копия`)}
        >
          <Copy size={14} />
        </button>
        <button
          title="Сохранить изменения"
          disabled={
            current.builtIn ||
            !dirty ||
            !processingSchema.safeParse(value).success
          }
          onClick={() =>
            save(
              presets.map((p) =>
                p.id === selected
                  ? {
                      ...p,
                      processing: structuredClone(value),
                      updatedAt: new Date().toISOString(),
                    }
                  : p,
              ),
            )
          }
        >
          <Save size={14} />
        </button>
        <button
          title="Сбросить к сохранённым значениям"
          onClick={() => change(structuredClone(current.processing))}
        >
          <RotateCcw size={14} />
        </button>
        <button
          title="Удалить пресет"
          disabled={current.builtIn}
          onClick={() => open("delete")}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          className="text-button"
          onClick={() => open("create", current.name)}
        >
          Сохранить как…
        </button>
        <button
          className="text-button"
          disabled={current.builtIn}
          onClick={() => open("rename", current.name)}
        >
          Переименовать
        </button>
      </div>
      {dirty && (
        <p className="muted text-xs">
          Черновик остаётся в этой сессии при переключении пресетов. Сохраните
          его перед закрытием.
        </p>
      )}
      {action && (
        <div className="modal-backdrop">
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preset-dialog-title"
            className="modal"
            onKeyDown={(e) => {
              if (e.key === "Escape") setAction(null);
            }}
          >
            <h2 id="preset-dialog-title">
              {action === "delete"
                ? `Удалить «${current.name}»?`
                : action === "rename"
                  ? "Переименовать пресет"
                  : "Сохранить новый пресет"}
            </h2>
            {action !== "delete" && (
              <label>
                Название
                <input
                  autoFocus
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                />
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setAction(null)}>Отмена</button>
              <button className="primary" onClick={submit}>
                {action === "delete" ? "Удалить" : "Сохранить"}
              </button>
            </div>
          </section>
        </div>
      )}
    </fieldset>
  );
}
