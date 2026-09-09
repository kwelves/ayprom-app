---
name: AYPROM
description: Precise local workspace for product photography
colors:
  primary: "#087c72"
  primary-soft: "#dff1ee"
  canvas: "#eef1f3"
  work: "#f7f8f9"
  panel: "#ffffff"
  text-strong: "#172022"
  text: "#293437"
  text-muted: "#647276"
  border: "#d7dde0"
  success: "#18734a"
  danger: "#b33131"
typography:
  title:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 680
    lineHeight: 1.25
    letterSpacing: "-0.018em"
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.48
  label:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.4
rounded:
  sm: "5px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.panel}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "9px 17px"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "6px 8px"
---

# Design System: AYPROM

## Overview

**Creative North Star: "The Photographic Light Table"**

AYPROM is a calm, technical Windows workspace. Neutral planes keep attention on product imagery while precise dividers, compact controls and a single teal accent make hierarchy immediate. The system favors daily-operational density over landing-page spectacle.

**Key Characteristics:**

- Compact mode rail, central work surface, contextual inspector and persistent action dock.
- Purposeful motion for selection, preview, processing and feedback only.
- Light and dark palettes designed as distinct tonal systems.

## Colors

Teal marks agency and active state; cool neutrals carry structure; semantic colors are reserved for outcomes.

**The One Accent Rule.** Teal identifies the current mode, selection, focus and primary action. It is not decoration.

## Typography

The Windows system family keeps controls native and legible. Weight and spacing create hierarchy; large display typography is intentionally absent.

## Layout

The default composition uses a 188px navigation rail, fluid central workspace and 318px inspector. Below 1150px the rail collapses to icons; below 960px preview comparisons prioritize the processed result. The process dock remains visible at every supported size.

## Elevation & Depth

Structure is primarily tonal and divided by one-pixel borders. Shadow is reserved for modal surfaces; ordinary panels do not combine borders and shadows.

## Shapes

Controls use 5–8px radii. Larger work surfaces use 12px. Pills are limited to compact status labels.

## Components

Buttons respond on hover and press with property-specific transitions. Queue rows reveal actions on intent and use an inset accent for selection. Inputs use subdued fills and a two-pixel visible focus ring. Progress is linear and continuous.

## Do's and Don'ts

### Do:

- **Do** keep the primary processing action visible and singular.
- **Do** use tabular figures for progress and counts.
- **Do** state errors with a recovery path.

### Don't:

- **Don't** add gradients, glow, glass panels or decorative loops.
- **Don't** animate layout for large lists.
- **Don't** use emoji or Unicode glyphs as interface icons.
