import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source)
  throw new Error("Usage: node scripts/build-icon.mjs <source-image>");

const outputDirectory = path.resolve("assets");
await fs.mkdir(outputDirectory, { recursive: true });
const background = { r: 16, g: 71, b: 154, alpha: 1 };
const render = (size) =>
  sharp(source)
    .rotate()
    .resize(size, size, {
      fit: "contain",
      background,
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: size <= 500,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

await sharp(source)
  .rotate()
  .resize(512, 512, {
    fit: "contain",
    background,
    kernel: sharp.kernel.lanczos3,
  })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(path.join(outputDirectory, "app-icon.png"));

const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = await Promise.all(sizes.map(render));
const directorySize = 6 + images.length * 16;
const header = Buffer.alloc(directorySize);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = directorySize;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  const size = sizes[index];
  header.writeUInt8(size === 256 ? 0 : size, entry);
  header.writeUInt8(size === 256 ? 0 : size, entry + 1);
  header.writeUInt8(0, entry + 2);
  header.writeUInt8(0, entry + 3);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await fs.writeFile(
  path.join(outputDirectory, "app.ico"),
  Buffer.concat([header, ...images]),
);
console.log(
  JSON.stringify(
    {
      source: path.resolve(source),
      png: "assets/app-icon.png",
      ico: "assets/app.ico",
      sizes,
    },
    null,
    2,
  ),
);
