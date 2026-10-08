import type { Transition, Variants } from "motion/react";

/** Motion presets shared by every component. Durations mirror tokens.css. */
export const ease = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
  standard: [0.2, 0, 0, 1],
} as const;

export const spring = {
  /** Selection thumbs, nav pill: quick, no visible overshoot. */
  snappy: { type: "spring", stiffness: 560, damping: 42, mass: 0.8 },
  /** Panels and sheets arriving into place. */
  gentle: { type: "spring", stiffness: 320, damping: 34, mass: 0.9 },
  /** List reflow after insert/remove. */
  layout: { type: "spring", stiffness: 420, damping: 40, mass: 0.9 },
} satisfies Record<string, Transition>;

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: ease.out } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: ease.standard } },
};

/** Content arriving from slightly below; exits faster than it enters. */
export const rise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: ease.out } },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.14, ease: ease.standard },
  },
};

/** Workspace switch: a short lateral shift preserves the tab order. */
export const workspace = {
  initial: (direction: number) => ({ opacity: 0, x: 12 * direction }),
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: ease.out },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: -8 * direction,
    transition: { duration: 0.12, ease: ease.standard },
  }),
} satisfies Variants;
