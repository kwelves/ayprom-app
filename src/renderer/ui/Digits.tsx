import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { ease } from "./motion";

const format = new Intl.NumberFormat("ru-RU");

/**
 * Live progress count. It changes many times per second, so it does not
 * animate (rolling digits would never be readable); instead the shown value
 * is sampled at most every 120 ms with tabular figures, which keeps the
 * number still enough to read.
 */
export function Digits({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const last = useRef(0);
  useEffect(() => {
    const wait = 120 - (performance.now() - last.current);
    if (wait <= 0) {
      last.current = performance.now();
      setShown(value);
      return;
    }
    const timer = setTimeout(() => {
      last.current = performance.now();
      setShown(value);
    }, wait);
    return () => clearTimeout(timer);
  }, [value]);
  return <span className={`num ${className}`}>{format.format(shown)}</span>;
}

/** Result statistic that counts up once when it first appears. */
export function CountUp({
  value,
  decimals = 0,
  className = "",
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const formatter = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduced || value === 0) {
      node.textContent = formatter.format(value);
      return;
    }
    const controls = animate(0, value, {
      duration: Math.min(0.8, 0.4 + Math.log10(value + 1) * 0.12),
      ease: ease.out,
      onUpdate: (latest) => {
        node.textContent = formatter.format(latest);
      },
    });
    return () => controls.stop();
  }, [value, decimals, reduced]);
  return (
    <span ref={ref} className={`num ${className}`}>
      {formatter.format(value)}
    </span>
  );
}
