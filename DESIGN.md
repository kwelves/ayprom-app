---
name: AYPROM
description: Calibrated workspace for batch product photography
colors:
  brand: "#053c95"
  accent: "#1b4fc3"
  accent-dark: "#346be2"
  accent-soft: "#e5efff"
  chrome: "#eef0f2"
  app: "#f3f4f5"
  panel: "#fcfdfd"
  stage: "#e8e9eb"
  line: "#dee0e2"
  fg-1: "#15181e"
  fg-2: "#3a3d44"
  fg-3: "#5f636a"
  success: "#1c7f4c"
  warning: "#a06604"
  danger: "#c2272a"
typography:
  ui:
    fontFamily: "Onest Variable, Segoe UI Variable Text, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Onest Variable"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.008em"
  stat:
    fontFamily: "Onest Variable"
    fontSize: "19px"
    fontWeight: 650
    fontFeature: "tnum"
    letterSpacing: "-0.018em"
  data:
    fontFamily: "JetBrains Mono Variable, Cascadia Mono, monospace"
    fontSize: "11px"
  wordmark:
    fontFamily: "Michroma"
    fontSize: "12px"
    letterSpacing: "0.1em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "14px"
spacing:
  base: "4px"
  scale: "2 4 8 12 16 20 24 32 40 48"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "40px"
  control:
    height: "32px"
    rounded: "{rounded.md}"
  segmented:
    height: "28px / 24px"
    thumb: "raised surface, spring 560/42"
---

# Design System: AYPROM

Source of truth for tokens: `src/renderer/styles/tokens.css`. This file explains the decisions; the CSS holds the values.

## North star: «Калиброванный стол»

AYPROM prepares batches of product photos for marketplaces. People judge color, edges and framing on this screen all day, so the interface behaves like calibrated studio gear: neutral surfaces with almost no chroma, one brand hue, measurements drawn as measurements.

The brand color comes from the real AYPROM mark: cobalt `#053C95` with an extended geometric wordmark and an underline rule. The previous teal accent did not belong to the brand and is retired.

## Color

- **Neutrals carry no cast.** Surfaces are OKLCH with chroma ≤ 0.006 at hue 260. A product shot on the stage looks the same as in the exported file.
- **One hue with agency.** Cobalt marks the current mode, selection, focus ring and the primary action. It never decorates.
- **Two cobalts.** `--brand` (#053C95) is reserved for the wordmark. `--accent` is one step brighter so white text on buttons stays above 7:1 (light) and 4.8:1 (dark).
- **Outcomes are semantic.** Green = done, amber = draft/cancelled/attention, red = failure. Each has a soft tint for backgrounds.
- **Contrast floor.** `--fg-3` and above pass 4.5:1 on panels in both themes. `--fg-4` is for icons, rules and disabled states only.
- **Dark theme is its own palette.** Not an inversion: darker stage than panels, lighter accent text, deeper shadows.

## Typography

One family, Onest (variable, self-hosted, full Cyrillic). The scale is fixed rem with a ~1.2 ratio: 11 / 12 / 13 (UI default) / 14 / 16 / 19 / 23 / 28.

- Counts and progress use tabular figures (`.num`).
- File paths use JetBrains Mono, and they are shortened in the middle (`D:\…\Осень\Косметика`) with the full path in `title`.
- Michroma is used only for the AYPROM wordmark, echoing the extended letters of the logo.
- No eyebrows, no all-caps labels.

## Layout

```
┌ Title bar 44px: wordmark · mode switch ·············· Локально · theme · version · [win caption]
├ Notices (errors, updates) — only when present
├ Workbench: Queue 320 │ Stage (fluid) │ Inspector 336
└ Process dock: state · readiness / live progress · primary action
```

- The title bar is the window caption. On Windows the native buttons draw over its right edge (`titleBarOverlay`), and `env(titlebar-area-*)` reserves their space.
- Panels are 14px-radius planes separated by 12px gutters. Hairline borders, no shadows.
- Shadows appear only on things that float: segmented thumbs, dialog, toast, result sheet.
- Breakpoints: ≥1600 wider columns; ≤1240 compact chips; ≤1080 queue stacks above the stage, compare collapses to the result, nav shows icons only.

## Components

| Component | Rule |
|---|---|
| Segmented | Radio group. Arrow keys move selection. Thumb glides with a spring. Used for theme, format, preview view and backdrop. |
| Queue row | Whole row selects. Tile shows state (folder, spinner, check, warning). Actions appear on hover/focus/selection. Selection is a cobalt tint plus a 1px inset ring. |
| Dropzone | Fills the queue when empty and lists formats; shrinks to one line after the first source. The whole queue panel accepts drops. |
| Stage | «Результат» or «Сравнение». Backdrop: checker, light, dark (stored per viewer). Canvas size badge on the result. Hold `\` or the button to see the original in place. |
| Draft preview | The fast draft renders blurred and sharpens when the full-quality pass lands. Blur means "not final". |
| Inspector | Sections: Пресет, Композиция, Формат, Сохранение. Range + exact number for every scalar. Advanced options sit in a disclosure. |
| Process dock | Idle: what is missing, as clickable readiness steps. Running: rolling digits, speed, time left, sweep on the bar, Stop. |
| Result sheet | One row: outcome, three stats that count up, actions. Errors in a disclosure. |
| History | Table: run, output folder, totals, duration, copy report. |
| Toast | Confirms silent actions (report copied). Auto-dismisses in 2.2 s. |

## Motion

Library: `motion` (motion.dev) for presence, layout and springs; CSS for hover, press and loops. Presets live in `src/renderer/ui/motion.ts`.

Bar: Emil Kowalski's standards (`.claude/skills/review-animations/STANDARDS.md`).

- **Focal moment: a run.** Start becomes Stop instantly (blur-masked swap, no wait), the bar sweeps, and on completion the result sheet arrives with numbers counting up and the queue tiles turn into checks.
- **No motion on high-frequency actions.** Mode switches (also on Ctrl+1/2/3) are instant. The live counter does not animate; it is sampled every 120 ms so it stays readable at hundreds of photos per second.
- **Continuity.** The nav pill and segmented thumbs travel between options. Theme changes cross-fade once through the View Transitions API.
- **Feedback.** Press scales to 0.97 over 160 ms. Hover is colour only; the slider thumb grows only under `(hover: hover) and (pointer: fine)`. Draft → full quality is a blur-to-sharp transition. Hold-to-compare swaps with no fade, like a blink comparator.
- **Timing.** 100–160 ms feedback, 200–240 ms state change, 300 ms reveal; nothing in UI exceeds 300 ms except the one-off count-up (≤ 800 ms). Exits are faster than entrances. Easing `cubic-bezier(0.23, 1, 0.32, 1)`; on-screen movement `cubic-bezier(0.77, 0, 0.175, 1)`.
- **Physicality.** Nothing starts below `scale(0.85)`. `motion` props animate a full `transform` string so the compositor runs them while a batch is busy.
- **Reduced motion.** `MotionConfig reducedMotion="user"` drops transforms; CSS animations collapse to 1 ms; the theme swap skips the view transition. Colour and opacity feedback stays.

## Don't

- Gradient text, glass panels, glow halos, colored side stripes on cards.
- Emoji or Unicode glyphs as icons. Icons come from Lucide at 1.9–2.1 stroke.
- Animating layout properties on large lists. Queue rows animate position only.
- Raw hex in components. Read semantic tokens.
- Inline `data:` assets: the CSP allows `'self'` only (`assetsInlineLimit: 0`).
