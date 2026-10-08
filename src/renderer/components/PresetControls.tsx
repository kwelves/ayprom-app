import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  Copy,
  PencilLine,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  factoryPreset,
  processingSchema,
  type ProcessingConfig,
  type ProcessingPreset,
} from "../../shared/contracts";
import { ease, spring } from "../ui/motion";

type Action = "create" | "rename" | "delete";

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
  const [action, setAction] = useState<Action | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const dirty = JSON.stringify(current.processing) !== JSON.stringify(value);
  const valid = processingSchema.safeParse(value).success;

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
    if (!valid) {
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
  const open = (next: Action, suggested = "") => {
    setAction(next);
    setName(suggested);
    setError("");
  };

  return (
    <fieldset disabled={disabled} className="inspector-section">
      <legend className="section-head">
        <h3>Пресет</h3>
        <AnimatePresence initial={false}>
          {dirty && (
            <motion.span
              className="badge badge-warning"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={spring.snappy}
            >
              Изменён
            </motion.span>
          )}
        </AnimatePresence>
      </legend>
      <div className="preset-row">
        <span className="select-wrap">
          <select
            className="select"
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
          <ChevronDown size={15} />
        </span>
        <div
          className="toolbar"
          role="toolbar"
          aria-label="Действия с пресетом"
        >
          <button
            type="button"
            className="icon-btn icon-btn-md"
            title="Создать пресет с текущими настройками"
            aria-label="Создать пресет с текущими настройками"
            onClick={() => open("create")}
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-md"
            title="Дублировать"
            aria-label="Дублировать пресет"
            onClick={() => open("create", `${current.name} (копия)`)}
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-md"
            title="Сохранить изменения"
            aria-label="Сохранить изменения пресета"
            disabled={current.builtIn || !dirty || !valid}
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
            type="button"
            className="icon-btn icon-btn-md"
            title="Сбросить к сохранённым значениям"
            aria-label="Сбросить к сохранённым значениям"
            disabled={!dirty}
            onClick={() => change(structuredClone(current.processing))}
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-md"
            title="Переименовать"
            aria-label="Переименовать"
            disabled={current.builtIn}
            onClick={() => open("rename", current.name)}
          >
            <PencilLine size={14} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-md is-danger"
            title="Удалить пресет"
            aria-label="Удалить пресет"
            disabled={current.builtIn}
            onClick={() => open("delete")}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {dirty && (
          <motion.div
            className="preset-draft"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: ease.out }}
          >
            <p className="hint">
              Черновик сохраняется до закрытия приложения.{" "}
              <button
                type="button"
                className="btn-link"
                onClick={() => open("create", current.name)}
              >
                Сохранить как…
              </button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      {createPortal(
        <AnimatePresence>
          {action && (
            <PresetDialog
              key="dialog"
              action={action}
              presetName={current.name}
              name={name}
              error={error}
              setName={setName}
              close={() => setAction(null)}
              submit={submit}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </fieldset>
  );
}

function PresetDialog({
  action,
  presetName,
  name,
  error,
  setName,
  close,
  submit,
}: {
  action: Action;
  presetName: string;
  name: string;
  error: string;
  setName(value: string): void;
  close(): void;
  submit(): void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
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
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
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
  }, []);

  const title =
    action === "delete"
      ? `Удалить «${presetName}»?`
      : action === "rename"
        ? "Переименовать пресет"
        : "Сохранить новый пресет";

  return (
    <motion.div
      className="scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.18 } }}
      exit={{ opacity: 0, transition: { duration: 0.14 } }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <motion.section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-dialog-title"
        className="dialog"
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
        exit={{
          opacity: 0,
          y: 4,
          scale: 0.98,
          transition: { duration: 0.12, ease: ease.standard },
        }}
      >
        <h2 id="preset-dialog-title">{title}</h2>
        {action === "delete" ? (
          <p className="dialog-text">
            Пресет исчезнет из списка. Уже обработанные файлы не изменятся.
          </p>
        ) : (
          <label className="field">
            <span className="field-label">Название</span>
            <input
              className="input"
              autoFocus
              maxLength={80}
              value={name}
              aria-invalid={!!error || undefined}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </label>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={close}>
            Отмена
          </button>
          <button
            type="button"
            className={`btn ${action === "delete" ? "btn-danger-solid" : "btn-primary"}`}
            onClick={submit}
          >
            {action === "delete" ? "Удалить" : "Сохранить"}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}
