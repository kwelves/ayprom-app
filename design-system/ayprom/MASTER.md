# Design System Master File

> **LOGIC:** When building a specific screen, first check `design-system/ayprom/pages/<screen>.md`.
> If that file exists, its rules override this Master file. Otherwise follow the rules below.

**Project:** AYPROM
**Product type:** Desktop productivity tool (batch product-photo processing, Windows)
**Stack:** React 19 + plain CSS tokens + `motion` (Electron renderer)
**Hand-authored from the shipped system.** Values: `src/renderer/styles/tokens.css`. Rationale: `DESIGN.md`. The generic `--design-system` output (violet, Poppins) does not apply; never regenerate this file with `--force`.

---

## Global Rules

### Color Palette (light / dark)

| Role | Light | Dark | CSS Variable |
|------|-------|------|--------------|
| Brand (wordmark only) | `#053C95` | `#053C95` | `--brand` |
| Accent / primary action | `#1B4FC3` | `#346BE2` | `--accent` |
| Accent text | `#194AB7` | `#8CB3FF` | `--accent-text` |
| Accent soft (selection) | `#E5EFFF` | `#162544` | `--accent-soft` |
| Window chrome | `#EEF0F2` | `#121315` | `--bg-chrome` |
| App background | `#F3F4F5` | `#0F1012` | `--bg-app` |
| Panel | `#FCFDFD` | `#141517` | `--bg-panel` |
| Photo stage | `#E8E9EB` | `#0A0B0C` | `--bg-stage` |
| Hairline | `#DEE0E2` | `#242528` | `--line` |
| Text strong / body / muted | `#15181E` / `#3A3D44` / `#5F636A` | `#F2F3F5` / `#CBCED2` / `#989BA1` | `--fg-1/2/3` |
| Success / Warning / Danger | `#1C7F4C` / `#A06604` / `#C2272A` | `#55C483` / `#E9B452` / `#F5746D` | `--success/--warning/--danger` |

Neutrals are near-zero chroma so product photos are judged without a cast. Cobalt is the only hue with agency.

### Typography

- UI: **Onest Variable** (self-hosted, Cyrillic). Scale 11/12/13/14/16/19/23/28 px, default 13.
- Data/paths: **JetBrains Mono Variable**, 11 px, middle-truncated.
- Wordmark only: **Michroma**, 12 px, tracking 0.1em.
- Counts: `font-variant-numeric: tabular-nums`.

### Spacing / Shape / Depth

- 4 px grid: 2 4 8 12 16 20 24 32 40 48.
- Radius: 4 / 6 / 8 / 12 / 14 (panels).
- Elevation: hairline borders for panels; shadows only for floating elements (thumb, dialog, toast, result).

## Component Specs

- **Button** heights 28/32/40; primary = cobalt fill + white text; press scale 0.985.
- **Segmented** = radio group, arrow keys, gliding thumb (spring 560/42).
- **Range + number** pair for every scalar; filled track via `--fill`.
- **Queue row** selects on click; actions visible on hover/focus/selection; status tile.
- **Stage** with view (result/compare), backdrop (checker/light/dark), hold `\` to compare.
- **Process dock** with readiness steps (idle) or live progress (running).

## Style Guidelines

Style: calibrated professional tool (Swiss-minimal discipline, Windows-native density). Measurements drawn as measurements. No gradients-as-decoration, glass, glow, or card grids.

## Motion

- Library: `motion/react`; presets in `src/renderer/ui/motion.ts`.
- 90–140 ms feedback, 200–320 ms state, 480 ms reveal; exits faster than entrances.
- Easing `cubic-bezier(0.16, 1, 0.3, 1)`; springs for thumbs and layout.
- Focal sequence: a processing run (start→stop morph, digit roll, bar sweep, result count-up).
- `prefers-reduced-motion`: transforms removed, colour/opacity feedback kept.

## Anti-Patterns (Do NOT Use)

- Teal or any second accent hue
- Gradient text, glassmorphism, glow halos, colored side stripes
- Emoji or Unicode glyphs as icons (Lucide only)
- CDN fonts or `data:` assets (CSP `'self'`)
- Raw hex in components
- Layout animation on long lists

## Pre-Delivery Checklist

- [ ] Light and dark screenshots at 1440×900 and 900×650
- [ ] Text contrast ≥ 4.5:1 (`--fg-3` is the floor for text)
- [ ] Keyboard: tab order, arrow keys in segmented controls, Escape closes dialog, visible focus ring
- [ ] Reduced-motion path checked
- [ ] Contracts in `CLAUDE.md` intact; `npm test`, `npm run typecheck`, `npm run build` pass
