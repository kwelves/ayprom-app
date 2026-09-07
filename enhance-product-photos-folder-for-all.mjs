/**
 * Приводит фото товаров после фотосессии к единому виду для каталога.
 *
 * Ожидает на входе PNG/WebP с уже удалённым (прозрачным) фоном — сам скрипт
 * фон не трогает. На каждое фото:
 *   1. Автояркость/контраст (normalize) + локальный контраст (clahe, тянет
 *      детали из засветов и теней) + компрессия светов (soft-knee: значения
 *      выше порога поджимаются к потолку) — normalize/clahe сами по себе
 *      выбитые в чистый белый пересветы не лечат (иногда даже усиливают
 *      клиппинг), нужен отдельный шаг именно для этого — актуально для
 *      кадров, снятых почти "в контровом свете".
 *   2. Адаптивная резкость: со съёмки на телефон обычно резкий только
 *      передний план, а дальняя часть детали смазана (маленькая глубина
 *      резкости камеры). Скрипт строит карту локальной чёткости (по
 *      плотности мелкой текстуры на градациях серого) и накладывает
 *      unsharp-mask с силой, обратной этой карте — размытые зоны получают
 *      заметно больше резкости, уже чёткие почти не трогаются, так что вся
 *      деталь выглядит равномерно резкой.
 *   3. Обрезка по границам непрозрачных пикселей и вписывание в холст с
 *      пропорциями утверждённого макета Figma, так чтобы деталь занимала
 *      одну и ту же долю кадра на всех
 *      фото — это и решает разброс "деталь на 30% / 90% кадра".
 *   4. Диагональный полупрозрачный водяной знак из утверждённого Figma-макета,
 *      наложенный под деталью (сначала водяной знак, затем деталь
 *      поверх — сквозь полупрозрачные края детали слегка проступает).
 *      Итоговый PNG сохраняет прозрачный фон.
 *
 * Использование:
 *   node enhance-product-photos-folder-for-all.mjs
 *     [--canvas=1600] [--fill=0.82] [--sharpen-min=0.4] [--sharpen-max=2.8]
 *     [--highlight-knee=175] [--highlight-ceiling=232] [--force]
 *
 * По умолчанию файлы вида "1.png", "2.png" и т. д. считаются уже готовым
 * результатом прошлого запуска и пропускаются, чтобы не обрабатывать их
 * повторно. Флаг --force отключает эту защиту и обрабатывает такие файлы
 * тоже — используйте, если исходники изначально сохранены с такими же
 * именами (например "число.png" из фотосессии).
 *
 * Запускается из корневой папки с фотографиями. Рекурсивно обходит все
 * вложенные папки; оригиналы остаются без изменений, результаты сохраняются
 * рядом с ними как 1.png, 2.png, и т. д.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DEFAULT_CANVAS_SIZE = 1600;
const DEFAULT_FILL_RATIO = 0.82;
const DEFAULT_ALPHA_THRESHOLD = 16;
const DEFAULT_PADDING_RATIO = 0.03;
const DEFAULT_WATERMARK_TEXT = "AYPROM";
const DEFAULT_WATERMARK_OPACITY = 0.25;
const DEFAULT_WATERMARK_COLOR = "#1d4ed8";
const DEFAULT_WATERMARK_FONT_RATIO = 0.081;
const DEFAULT_CORNER_RADIUS_RATIO = 0.05;
const DEFAULT_SHARPEN_MIN = 0.4;
const DEFAULT_SHARPEN_MAX = 2.8;
const DEFAULT_HIGHLIGHT_KNEE = 175;
const DEFAULT_HIGHLIGHT_CEILING = 232;

const SUPPORTED_EXTENSIONS = new Set([".png", ".webp", ".jpg", ".jpeg", ".avif", ".tiff"]);
const TEMP_DIR_PREFIX = ".enhance-product-photos-";
const WATERMARK_FIGMA_TEMPLATE_FILE = "watermark-pattern-figma.svg";
const WATERMARK_FIGMA_TEMPLATE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  WATERMARK_FIGMA_TEMPLATE_FILE
);
const FIGMA_REFERENCE_WIDTH = 3530;
const FIGMA_REFERENCE_HEIGHT = 2657;

function parseFlags(args) {
  const flags = {};
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [key, value] = arg.slice(2).split("=");
    flags[key] = value ?? true;
  }
  return flags;
}

function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Значения ниже knee не трогает; значения от knee до 255 поджимает в
// диапазон [knee, ceiling] — так пересвеченные/клиппированные участки
// перестают быть плоским чистым белым пятном, не искажая нормальные тона.
function buildHighlightLut(knee, ceiling) {
  const lut = new Uint8Array(256);
  for (let value = 0; value < 256; value++) {
    if (value <= knee) {
      lut[value] = value;
    } else {
      const t = (value - knee) / (255 - knee);
      lut[value] = Math.round(knee + t * (ceiling - knee));
    }
  }
  return lut;
}

// normalize()/clahe() растягивают контраст, но не лечат пересветы: если
// исходник уже клиппирован в чистый белый, растягивать там нечего, а иногда
// это даже усиливает клиппинг. Отдельно поджимаем верх диапазона по LUT —
// актуально для кадров, снятых почти "в контровом свете".
async function recoverHighlights(buffer, options) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const lut = buildHighlightLut(options.knee, options.ceiling);

  for (let i = 0; i < width * height; i++) {
    const base = i * channels;
    data[base] = lut[data[base]];
    data[base + 1] = lut[data[base + 1]];
    data[base + 2] = lut[data[base + 2]];
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

// Значение под которым лежат p% пикселей однобайтового (0-255) буфера —
// устойчивее к отдельным выбросам (шум/JPEG-артефакты), чем голый min/max.
function percentile(buffer, p) {
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < buffer.length; i++) histogram[buffer[i]]++;
  const target = buffer.length * p;
  let cumulative = 0;
  for (let value = 0; value < 256; value++) {
    cumulative += histogram[value];
    if (cumulative >= target) return value;
  }
  return 255;
}

// Строит карту "насколько резко" по плотности мелкой текстуры (яркость минус
// сильно смазанная версия яркости, fineSigma) — усредняет её по региону
// (regionSigma), так отдельные резкие точки на смазанном фоне не путают со
// сфокусированной зоной, — и на её основе накладывает unsharp mask с силой
// от minAmount (уже резкие места) до maxAmount (самые смазанные по кадру).
//
// Важно: любой одноканальный raw-буфер, собранный вручную (не из файла),
// нужно после sharp-операций явно возвращать в .toColourspace("b-w") перед
// .raw() — иначе sharp молча отдаёт 3 канала (sRGB) вместо 1, и последующее
// чтение буфера как одноканального съезжает по смещениям на мусорные данные.
async function adaptiveSharpen(buffer, width, height, options) {
  const { data: origData } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const lowpassData = await sharp(buffer).ensureAlpha().blur(options.lowpassSigma).raw().toBuffer();

  const grey = await sharp(buffer).greyscale().raw().toBuffer();
  const greyLow = await sharp(buffer).greyscale().blur(options.fineSigma).raw().toBuffer();

  const energy = Buffer.alloc(width * height);
  for (let i = 0; i < energy.length; i++) {
    energy[i] = Math.min(255, Math.abs(grey[i] - greyLow[i]) * options.energyScale);
  }

  const localSharpness = await sharp(energy, { raw: { width, height, channels: 1 } })
    .blur(options.regionSigma)
    .toColourspace("b-w")
    .raw()
    .toBuffer();

  const low = percentile(localSharpness, 0.05);
  const high = percentile(localSharpness, 0.95);
  const range = Math.max(1, high - low);

  const output = Buffer.alloc(origData.length);
  const pixelCount = width * height;
  for (let i = 0; i < pixelCount; i++) {
    const norm = clamp((localSharpness[i] - low) / range, 0, 1);
    const amount = options.minAmount + (1 - norm) * (options.maxAmount - options.minAmount);

    const base = i * 4;
    for (let channel = 0; channel < 3; channel++) {
      const original = origData[base + channel];
      const detail = original - lowpassData[base + channel];
      output[base + channel] = Math.round(clamp(original + amount * detail, 0, 255));
    }
    output[base + 3] = origData[base + 3];
  }

  return sharp(output, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

// Сканирует альфа-канал, чтобы найти прямоугольник, в который вписана
// непрозрачная деталь — по нему и нормализуем заполнение кадра.
async function computeAlphaBoundingBox(buffer, threshold) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * channels;
    for (let x = 0; x < width; x++) {
      const alpha = data[rowOffset + x * channels + 3];
      if (alpha <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    imageWidth: width,
    imageHeight: height,
  };
}

// Шаблон экспортирован из Figma: в нём уже зафиксированы точные позиции,
// поворот -15° и общая прозрачность 25%. Вырезаем область референса без
// изображения товара, чтобы оставить только готовую сетку водяного знака.
async function buildWatermarkTile(canvasWidth, canvasHeight) {
  return sharp(WATERMARK_FIGMA_TEMPLATE_PATH)
    .extract({ left: 3348, top: 1984, width: FIGMA_REFERENCE_WIDTH, height: FIGMA_REFERENCE_HEIGHT })
    .resize(canvasWidth, canvasHeight, { fit: "fill" })
    .png()
    .toBuffer();
}

function buildRoundedCornerMask(canvasWidth, canvasHeight, radius) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}">
  <rect width="${canvasWidth}" height="${canvasHeight}" rx="${radius}" ry="${radius}" fill="white"/>
</svg>`;
}

async function processImage(inputPath, outputPath, options) {
  const meta = await sharp(inputPath).metadata();
  const minSide = Math.max(1, Math.min(meta.width ?? 0, meta.height ?? 0));
  const tileSize = Math.max(8, Math.round(minSide / 8));

  const toneCorrected = await sharp(inputPath)
    .ensureAlpha()
    .normalize()
    .clahe({ width: tileSize, height: tileSize, maxSlope: 3 })
    .png()
    .toBuffer();

  const highlightCorrected = await recoverHighlights(toneCorrected, options.highlights);

  const sharpenGeometry = {
    fineSigma: clamp(minSide / 300, 3, 8),
    energyScale: 18,
    regionSigma: clamp(minSide / 40, 25, 90),
    lowpassSigma: clamp(minSide / 220, 4, 10),
    minAmount: options.sharpen.minAmount,
    maxAmount: options.sharpen.maxAmount,
  };
  const correctedBuffer = await adaptiveSharpen(highlightCorrected, meta.width, meta.height, sharpenGeometry);

  const bbox = await computeAlphaBoundingBox(correctedBuffer, options.alphaThreshold);

  let objectBuffer = correctedBuffer;
  if (bbox && !(bbox.width === bbox.imageWidth && bbox.height === bbox.imageHeight)) {
    const padX = Math.round(bbox.width * options.paddingRatio);
    const padY = Math.round(bbox.height * options.paddingRatio);
    const left = Math.max(0, bbox.left - padX);
    const top = Math.max(0, bbox.top - padY);
    const width = Math.min(bbox.imageWidth - left, bbox.width + padX * 2);
    const height = Math.min(bbox.imageHeight - top, bbox.height + padY * 2);
    objectBuffer = await sharp(correctedBuffer).extract({ left, top, width, height }).png().toBuffer();
  }

  const objectMeta = await sharp(objectBuffer).metadata();
  const targetInnerWidth = Math.round(options.canvasWidth * options.fillRatio);
  const targetInnerHeight = Math.round(options.canvasHeight * options.fillRatio);
  const scale = Math.min(targetInnerWidth / objectMeta.width, targetInnerHeight / objectMeta.height);
  const resizedWidth = Math.max(1, Math.round(objectMeta.width * scale));
  const resizedHeight = Math.max(1, Math.round(objectMeta.height * scale));

  const resizedObject = await sharp(objectBuffer)
    .resize(resizedWidth, resizedHeight, { fit: "fill" })
    .png()
    .toBuffer();

  const watermarkBuffer = await buildWatermarkTile(options.canvasWidth, options.canvasHeight);
  const cornerRadius = Math.round(Math.min(options.canvasWidth, options.canvasHeight) * DEFAULT_CORNER_RADIUS_RATIO);
  const roundedCornerMask = Buffer.from(buildRoundedCornerMask(options.canvasWidth, options.canvasHeight, cornerRadius));

  const left = Math.round((options.canvasWidth - resizedWidth) / 2);
  const top = Math.round((options.canvasHeight - resizedHeight) / 2);

  // Холст остаётся полностью прозрачным. На него накладываются только
  // полупрозрачные логотипы и товар; белые области в просмотрщике — прозрачность.
  await sharp({
    create: {
      width: options.canvasWidth,
      height: options.canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: watermarkBuffer, top: 0, left: 0 },
      { input: resizedObject, top, left },
      { input: roundedCornerMask, top: 0, left: 0, blend: "dest-in" },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

async function findImageFolders(rootDir, options) {
  const folders = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const currentDir = queue.shift();
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    const files = entries
      .filter(
        (entry) =>
          entry.isFile() &&
          SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) &&
          (options.force || !/^[1-9]\d*\.png$/i.test(entry.name))
      )
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    if (files.length > 0) folders.push({ dir: currentDir, files });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(TEMP_DIR_PREFIX)) {
        queue.push(path.join(currentDir, entry.name));
      }
    }
  }

  return folders;
}

async function processFolder(inputDir, files, options) {
  const tempDir = await fs.mkdtemp(path.join(inputDir, TEMP_DIR_PREFIX));
  console.log(`\n${inputDir}\n  Создание копий и обработка ${files.length} фото`);

  let done = 0;
  let failed = 0;
  for (const [index, file] of files.entries()) {
    const inputPath = path.join(tempDir, file);
    const outputPath = path.join(inputDir, `${index + 1}.png`);
    try {
      await fs.copyFile(path.join(inputDir, file), inputPath);
      await processImage(inputPath, outputPath, options);
      done++;
      console.log(`    ✓ ${file}`);
    } catch (error) {
      failed++;
      console.error(`    ✗ ${file}: ${error.message}`);
    }
  }

  if (failed === 0) {
    await fs.rm(tempDir, { recursive: true, force: true });
  } else {
    console.error(`  Временные копии сохранены для проверки: ${tempDir}`);
  }

  return { done, failed };
}

async function main() {
  const args = process.argv.slice(2);
  const flags = parseFlags(args);
  const rootDir = process.cwd();
  const canvasWidth = Number(flags.canvas) || DEFAULT_CANVAS_SIZE;
  const options = {
    canvasWidth,
    canvasHeight: Math.round(canvasWidth * FIGMA_REFERENCE_HEIGHT / FIGMA_REFERENCE_WIDTH),
    fillRatio: Number(flags.fill) || DEFAULT_FILL_RATIO,
    alphaThreshold: Number(flags["alpha-threshold"]) || DEFAULT_ALPHA_THRESHOLD,
    paddingRatio: Number(flags.padding) || DEFAULT_PADDING_RATIO,
    sharpen: {
      minAmount: Number(flags["sharpen-min"]) || DEFAULT_SHARPEN_MIN,
      maxAmount: Number(flags["sharpen-max"]) || DEFAULT_SHARPEN_MAX,
    },
    highlights: {
      knee: Number(flags["highlight-knee"]) || DEFAULT_HIGHLIGHT_KNEE,
      ceiling: Number(flags["highlight-ceiling"]) || DEFAULT_HIGHLIGHT_CEILING,
    },
    watermark: {
      text: flags["watermark-text"] || DEFAULT_WATERMARK_TEXT,
      opacity: Number(flags["watermark-opacity"]) || DEFAULT_WATERMARK_OPACITY,
      color: flags["watermark-color"] || DEFAULT_WATERMARK_COLOR,
      fontSizeRatio: Number(flags["watermark-font-ratio"]) || DEFAULT_WATERMARK_FONT_RATIO,
    },
  };
  const folders = await findImageFolders(rootDir, { force: Boolean(flags.force) });
  if (folders.length === 0) {
    console.log(`В папке ${rootDir} и её вложенных папках не найдено поддерживаемых изображений.`);
    return;
  }
  console.log(`Найдено папок с исходными фото: ${folders.length}`);

  let done = 0;
  let failed = 0;
  for (const { dir, files } of folders) {
    const result = await processFolder(dir, files, options);
    done += result.done;
    failed += result.failed;
  }

  console.log(`\nГотово: ${done} успешно, ${failed} с ошибками.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
