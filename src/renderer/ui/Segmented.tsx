import { useId, useRef, type ReactNode } from "react";
import { motion } from "motion/react";
import { spring } from "./motion";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Render only the icon; the label stays as the accessible name. */
  iconOnly?: boolean;
  title?: string;
}

/**
 * Radio group with a gliding thumb. Arrow keys move the selection the way a
 * native radio group does; only the checked option is in the tab order.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
  stretch = false,
  disabled = false,
  className = "",
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange(value: T): void;
  label: string;
  size?: "sm" | "md";
  stretch?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={`segmented segmented-${size} ${stretch ? "is-stretch" : ""} ${className}`}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.iconOnly ? option.label : undefined}
            title={option.title ?? (option.iconOnly ? option.label : undefined)}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            className={`segment ${checked ? "is-checked" : ""}`}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(index, 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(index, -1);
              }
            }}
          >
            {checked && (
              <motion.span
                layoutId={`${id}-thumb`}
                className="segment-thumb"
                transition={spring.snappy}
              />
            )}
            <span className="segment-content">
              {option.icon}
              {!option.iconOnly && <span>{option.label}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
