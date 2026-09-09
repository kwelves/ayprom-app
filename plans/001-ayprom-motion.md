# AYPROM motion audit and implementation brief

## Existing system

The original renderer has almost no authored motion: button background changes, a one-pixel active press and instant workspace/state swaps. Feedback is functional but queue insertion, preview replacement, processing start/completion and errors appear without spatial or temporal continuity.

## Opportunities selected

1. Workspace content cross-fades with a small horizontal offset (160–220 ms) so mode changes remain spatially legible.
2. New queue rows enter once with opacity and translateY (180 ms); removal responds immediately and does not delay the data mutation.
3. Inspector disclosure uses a native details state with a rotating chevron and short content reveal; it remains keyboard-operable.
4. Preview image replacement cross-fades while a compact busy indicator communicates draft/full-quality work.
5. Processing and completion use continuous progress plus one restrained result reveal; errors use an immediate high-contrast surface, not shake.
6. Drag-over changes border, background and icon position to confirm the target.
7. Hover, press, focus and disabled transitions are property-specific and under 180 ms.

## Rejected

- Staggered page entrances: slows a daily tool.
- Spring/bounce on ordinary controls: no physical gesture supplies momentum.
- Animated layout height for queue/history lists: expensive at large counts.
- Looping decorative motion and glowing progress: distracts from processing state.
- Global transition rules: create accidental motion and keyboard latency.

## Reduced motion

With prefers-reduced-motion, translations and rotations are removed. Short opacity/color feedback remains where it communicates state; smooth scrolling is disabled.
