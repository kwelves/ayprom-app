import { useEffect, useRef } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from "motion/react";
import { ease } from "./motion";

const format = new Intl.NumberFormat("ru-RU");

/**
 * Live counter: only the digits that change roll in, so a fast-moving
 * progress count stays readable instead of flickering.
 */
export function Digits({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const text = format.format(value);
  const chars = Array.from(text);
  return (
    <span className={`digits num ${className}`} aria-label={text}>
      {chars.map((char, index) => {
        const place = chars.length - index;
        return (
          <span className="digit-slot" key={place} aria-hidden="true">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={char}
                className="digit"
                initial={{ y: "55%", opacity: 0, filter: "blur(2px)" }}
                animate={{
                  y: "0%",
                  opacity: 1,
                  filter: "blur(0px)",
                  transition: { duration: 0.26, ease: ease.out },
                }}
                exit={{
                  y: "-45%",
                  opacity: 0,
                  filter: "blur(2px)",
                  transition: { duration: 0.16, ease: ease.standard },
                }}
              >
                {char}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
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
      duration: Math.min(1.1, 0.45 + Math.log10(value + 1) * 0.22),
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
