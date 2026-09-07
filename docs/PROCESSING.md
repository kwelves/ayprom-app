# Processing compatibility

Reference: commit `cfa8c91`, original `enhance-product-photos-folder-for-all.mjs`.
Original file SHA-256: `bb5883533489c97188cad547df0afac421028a9edd1fb314c1b52ca22a5b9289`.
The production application, preview and CLI use one implementation in `src/processing/core.ts`. The original is retrieved from Git only by the regression harness.

## Unchanged stages, in order

1. Sharp metadata, no added EXIF auto-orientation.
2. ensureAlpha → normalize → CLAHE. Tile size max(8, round(minSide / 8)), maxSlope 3.
3. Highlight LUT: values ≤ knee unchanged; higher values mapped linearly into [knee, ceiling], rounded.
4. Adaptive sharpening: original and blurred RGBA; greyscale minus greyscale blur, energy scale 18; blur the energy map and explicitly convert to b-w. The exact original greyscale/channel handling is retained.
5. fineSigma clamp(minSide/300, 3, 8); regionSigma clamp(minSide/40, 25, 90); lowpassSigma clamp(minSide/220, 4, 10). Local sharpness percentiles 5% / 95%, range ≥ 1. Amount = min + (1-normalizedSharpness) × (max-min). RGB is rounded/clamped; original alpha retained.
6. Alpha bbox uses alpha > threshold. Fully transparent image keeps its full bounds; no invented object detection.
7. Padding per bbox axis, round(width × padding) and round(height × padding); clamp left/top and final width/height exactly as in the reference, including edge asymmetry.
8. Fit object into rounded canvas × fill ratio, scale = min(widthRatio,heightRatio); dimensions rounded, minimum 1; resize fit fill.
9. Rasterize original Figma SVG, extract x=3348 y=1984 width=3530 height=2657; resize to canvas with fit fill.
10. Transparent RGBA canvas; composite watermark, centered object, then rounded mask with dest-in. Radius round(min(canvasWidth,canvasHeight) × .05).
11. PNG compression level 9. JPEG flatten and WebP encoding happen only AFTER this identical compositing pipeline.

## Default preset

| Setting                  | Value                            |
| ------------------------ | -------------------------------- |
| Canvas width             | 1600                             |
| Canvas height            | round(1600 × 2657 / 3530) = 1204 |
| Fill                     | 0.82                             |
| Alpha threshold          | 16                               |
| Padding                  | 0.03                             |
| Sharpen min / max        | 0.4 / 2.8                        |
| Highlight knee / ceiling | 175 / 232                        |
| Corner radius ratio      | 0.05                             |

Reference watermark text/color/font/opacity CLI fields were dead parameters: the actual asset fixes geometry and 25% opacity. They are not exposed as misleading controls. There is no replacement watermark.

## Filesystem semantics

Original supported extensions: PNG, WebP, JPG, JPEG, AVIF, TIFF (not .tif or HEIC). Breadth-first directory scan; per-folder localeCompare with numeric=true and sensitivity=base. Exclude numeric PNG matching ^[1-9]\\d*\\.png$ unless force=true; preserve the exact rule. Ignore .enhance-product-photos- directories. Number each folder starting at 1.

Intentional safety changes: CLI and GUI default to Skip Existing. Existing selected sources cannot be overwritten, including with force. Custom output preserves the source root and subfolders; duplicate top-level names receive deterministic suffixes. Overlapping roots and source/output trees are rejected. Directory symlinks/junctions are not followed. Results are fully encoded before atomic publication; skip/rename uses same-directory hard links, overwrite uses rename. Filesystems without hard links report an error in skip/rename mode. In-place overwrite checks the protected source set.

Unlike the original, source copies are not created in a temporary directory: sources remain immutable and output uses unique temporary files. Current-file failures are isolated; successful outputs remain after cancel. Cancel waits for the current file and stops taking new files.

## Watermark cache

Cache key includes SHA-256 of the ORIGINAL asset and exact output dimensions. Cache only stores the result of the unchanged Figma rasterization. It contains no product photos. At most two in-memory entries. GUI disk cache is under userData. Cold rendering of the 10108 × 6571 SVG is expensive; warm previews reuse the rendered tile. Preview still processes the source with the original algorithm; the draft reduces canvas width only, not source-resolution enhancement.

## Regression

`npm run regression -- "D:/local-real-fixtures"` retrieves the immutable original from Git, runs it on copies, decodes original/new PNG into RGBA, compares dimensions and every channel, and writes a report under .tmp. A full Git checkout is needed.

Synthetic test images verify mechanics and preview/batch consistency; they do not establish equivalence on actual product photos. No standalone real fixtures were supplied initially. A real product photograph embedded in the original SVG was subsequently extracted locally with scripts/extract-fixture.mjs. This 2491x1875 photo produced identical RGBA under AyProm Standard (1600x1204), in addition to two matching synthetic cases. The conclusion applies to these fixtures only; see QA.md.
