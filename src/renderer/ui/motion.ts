import type { Transition } from "motion/react";

/**
 * Motion presets shared by every component. Durations mirror tokens.css.
 *
 * Rules (Emil Kowalski's standards, see .claude/skills/review-animations):
 * UI motion stays under 300 ms, enters with a strong ease-out, exits faster,
 * never starts from scale(0), and animates a full `transform` string so the
 * compositor runs it even while a batch keeps the main thread busy.
 */
export const ease = {
  out: [0.23, 1, 0.32, 1],
  inOut: [0.77, 0, 0.175, 1],
  standard: [0.2, 0, 0, 1],
} as const;

export const spring = {
  /** Selection thumbs, nav pill: settles in ~180 ms, no overshoot. */
  snappy: { type: "spring", duration: 0.22, bounce: 0 },
  /** Dialog and result sheet arriving into place. */
  gentle: { type: "spring", duration: 0.28, bounce: 0.06 },
  /** List reflow after insert/remove. */
  layout: { type: "spring", duration: 0.26, bounce: 0 },
} satisfies Record<string, Transition>;

const lift = (px: number) => `translateY(${px}px)`;

/** Content arriving from slightly below; exits faster than it enters. */
export const rise = {
  initial: { opacity: 0, transform: lift(6) },
  animate: {
    opacity: 1,
    transform: lift(0),
    transition: { duration: 0.2, ease: ease.out },
  },
  exit: {
    opacity: 0,
    transform: lift(4),
    transition: { duration: 0.12, ease: ease.standard },
  },
};

/**
 * Two states of one region replacing each other (dock idle ↔ running).
 * No wait between them: the new state answers the press immediately, and a
 * 2 px blur merges the overlap into one change instead of a double image.
 */
export const swap = {
  initial: { opacity: 0, filter: "blur(2px)", transform: lift(4) },
  animate: {
    opacity: 1,
    filter: "blur(0px)",
    transform: lift(0),
    transition: { duration: 0.2, ease: ease.out },
  },
  exit: {
    opacity: 0,
    filter: "blur(2px)",
    transition: { duration: 0.1, ease: ease.standard },
  },
};
