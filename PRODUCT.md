# AYPROM

AYPROM is a local Windows desktop tool for preparing batches of product photography. Its primary users repeatedly add folders, verify the result on a representative image, choose a processing preset and export destination, then run and monitor a safe batch.

## Product contract

- The renderer is a professional workspace, not a dashboard or landing page.
- Queue, selected source, preview, preset, destination and current processing status must be legible within seconds.
- Processing, preview, history, presets, persistence, cancellation and file-safety behavior remain unchanged.
- The original Figma watermark and Sharp pipeline remain the compatibility reference.
- Light, dark and system themes are first-class.

## Visual direction

A calibrated studio workspace in the AYPROM brand. Surfaces are near-zero-chroma neutrals so photos are judged without a color cast. AYPROM Cobalt (#053C95, from the brand mark) is the only accent: current mode, selection, focus and the primary action. The composition is an integrated title bar with the mode switch, a queue, a large preview stage, a parameter inspector and a process dock. Measurements (canvas size, dimension lines) are drawn as measurements.

Onest is the single UI family, with tabular figures for counts and JetBrains Mono for paths. Panels separate with hairlines; only floating elements cast shadows. Motion explains state: the run is the one authored sequence, everything else is short feedback. Full rules live in DESIGN.md.

## Interaction priorities

1. Add or select work.
2. Confirm the representative result and active preset.
3. Confirm export destination and conflict policy.
4. Start processing.
5. Track progress, failures and completion.

Advanced image parameters stay one level deeper. Cancellation is available during processing but visually secondary. Errors state the problem and preserve a clear recovery path.
