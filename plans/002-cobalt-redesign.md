# AYPROM redesign: calibrated table, cobalt brand

## Why

The previous pass used a teal accent that does not exist in the AYPROM brand. The real mark (`assets/app-icon.png`) is cobalt `#053C95` with an extended wordmark and an underline rule. Layout spent 188 px on a three-item sidebar, the preview was a small pair of thumbnails, and the dock only said "ready" or "not ready" without saying why.

## Decisions

1. **Integrated title bar.** Wordmark, mode switch and theme live in the window caption (`titleBarOverlay` on Windows). The sidebar is gone; the stage gets the width.
2. **Stage first.** One large preview with «Результат / Сравнение», backdrop choice and hold-to-compare (`\`). Canvas size badge on the result. Empty stage draws the target canvas to scale.
3. **Readiness, not a disabled button.** The dock lists Источники / Параметры / Папка результата; missing steps are clickable.
4. **Live run.** Rolling digits, speed, time left, percent; Start morphs into Stop.
5. **Compact result.** One row with counted-up stats; errors in a disclosure; toast confirms copy.
6. **History as a table.** Run, output folder, totals, duration, copy.
7. **Tokens.** OKLCH neutrals with chroma ≤ 0.006; Onest + JetBrains Mono self-hosted; one motion preset module.

## Motion thesis

- Focal: the processing run (see 4–5).
- Continuity: directional mode switch, gliding nav pill and segmented thumbs, queue rows animate position on insert/remove.
- Feedback: press scale, colour-only hover, draft preview blurred until full quality.
- Budget: transforms and opacity only on lists; blur limited to the preview image and digits.
- Reduced motion: `MotionConfig reducedMotion="user"`, CSS animations collapse.

## Rejected

- Before/after wipe slider: the result is re-framed onto a new canvas, so a wipe compares unrelated pixels. Side-by-side plus in-place hold is honest.
- Thumbnails in the queue: no safe image path under the current CSP without a new IPC channel.
- Custom select popovers: native selects keep keyboard and screen-reader behaviour for free.
