# AYPROM

AYPROM is a local Windows desktop tool for preparing batches of product photography. Its primary users repeatedly add folders, verify the result on a representative image, choose a processing preset and export destination, then run and monitor a safe batch.

## Product contract

- The renderer is a professional workspace, not a dashboard or landing page.
- Queue, selected source, preview, preset, destination and current processing status must be legible within seconds.
- Processing, preview, history, presets, persistence, cancellation and file-safety behavior remain unchanged.
- The original Figma watermark and Sharp pipeline remain the compatibility reference.
- Light, dark and system themes are first-class.

## Visual direction

The interface uses a restrained photographic light-table metaphor: neutral canvas surfaces, precise dividers, compact controls and a single teal AYPROM accent. The composition is a compact mode rail, a large central work surface, a contextual inspector and a persistent action/status dock. It follows Windows desktop conventions while applying Apple-derived principles of clarity, hierarchy, immediate feedback and spatial consistency.

Density is high enough for daily production work. Surfaces are layered with borders or restrained shadows, never both by default. Typography uses the Windows system stack with tabular figures for counts. Motion is short, interruptible and limited to state changes.

## Interaction priorities

1. Add or select work.
2. Confirm the representative result and active preset.
3. Confirm export destination and conflict policy.
4. Start processing.
5. Track progress, failures and completion.

Advanced image parameters stay one level deeper. Cancellation is available during processing but visually secondary. Errors state the problem and preserve a clear recovery path.
