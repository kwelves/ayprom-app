import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
const svg = await fs.readFile("watermark-pattern-figma.svg", "utf8");
const start = svg.indexOf('id="image1_0_1"');
if (start < 0) throw Error("Reference image not found in original Figma SVG");
const end = svg.indexOf("/>", start),
  tag = svg.slice(start, end);
const encoded = tag.match(
  /(?:xlink:)?href="data:image\/png;base64,([^"]+)"/,
)?.[1];
if (!encoded) throw Error("Embedded reference PNG missing");
const buffer = Buffer.from(encoded, "base64"),
  meta = await sharp(buffer).metadata();
if (meta.width !== 2491 || meta.height !== 1875)
  throw Error("Unexpected reference dimensions");
const directory = path.resolve(".tmp", "embedded-fixture");
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(path.join(directory, "figma-reference.png"), buffer);
console.log(
  "Extracted real Figma reference photo: " +
    path.join(directory, "figma-reference.png"),
);
