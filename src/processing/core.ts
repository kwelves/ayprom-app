// Mechanically extracted from the original reference. See docs/PROCESSING.md.
import sharp from "sharp";
import { cachedWatermark } from "./watermark-cache";
import { processingSchema, type ProcessingConfig } from "../shared/contracts";
const FIGMA_REFERENCE_WIDTH = 3530;
const FIGMA_REFERENCE_HEIGHT = 2657;
const DEFAULT_CORNER_RADIUS_RATIO = 0.05;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Значения ниже knee не трогает; значения от knee до 255 поджимает в
// диапазон [knee, ceiling] — так пересвеченные/клиппированные участки
// перестают быть плоским чистым белым пятном, не искажая нормальные тона.
function buildHighlightLut(knee: number, ceiling: number) {
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
async function recoverHighlights(
  buffer: Buffer,
  options: { knee: number; ceiling: number },
) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
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
function percentile(buffer: Buffer, p: number) {
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
async function adaptiveSharpen(
  buffer: Buffer,
  width: number,
  height: number,
  options: {
    lowpassSigma: number;
    fineSigma: number;
    energyScale: number;
    regionSigma: number;
    minAmount: number;
    maxAmount: number;
  },
) {
  const { data: origData } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const lowpassData = await sharp(buffer)
    .ensureAlpha()
    .blur(options.lowpassSigma)
    .raw()
    .toBuffer();

  const grey = await sharp(buffer).greyscale().raw().toBuffer();
  const greyLow = await sharp(buffer)
    .greyscale()
    .blur(options.fineSigma)
    .raw()
    .toBuffer();

  const energy = Buffer.alloc(width * height);
  for (let i = 0; i < energy.length; i++) {
    energy[i] = Math.min(
      255,
      Math.abs(grey[i] - greyLow[i]) * options.energyScale,
    );
  }

  const localSharpness = await sharp(energy, {
    raw: { width, height, channels: 1 },
  })
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
    const amount =
      options.minAmount + (1 - norm) * (options.maxAmount - options.minAmount);

    const base = i * 4;
    for (let channel = 0; channel < 3; channel++) {
      const original = origData[base + channel];
      const detail = original - lowpassData[base + channel];
      output[base + channel] = Math.round(
        clamp(original + amount * detail, 0, 255),
      );
    }
    output[base + 3] = origData[base + 3];
  }

  return sharp(output, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

// Сканирует альфа-канал, чтобы найти прямоугольник, в который вписана
// непрозрачная деталь — по нему и нормализуем заполнение кадра.
async function computeAlphaBoundingBox(buffer: Buffer, threshold: number) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
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
async function buildWatermarkTile(
  canvasWidth: number,
  canvasHeight: number,
  watermarkPath: string,
) {
  return cachedWatermark(watermarkPath, canvasWidth, canvasHeight, () =>
    sharp(watermarkPath)
      .extract({
        left: 3348,
        top: 1984,
        width: FIGMA_REFERENCE_WIDTH,
        height: FIGMA_REFERENCE_HEIGHT,
      })
      .resize(canvasWidth, canvasHeight, { fit: "fill" })
      .png()
      .toBuffer(),
  );
}

function buildRoundedCornerMask(
  canvasWidth: number,
  canvasHeight: number,
  radius: number,
) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}">
  <rect width="${canvasWidth}" height="${canvasHeight}" rx="${radius}" ry="${radius}" fill="white"/>
</svg>`;
}

export async function renderImage(
  inputPath: string,
  config: ProcessingConfig,
  watermarkPath: string,
): Promise<Buffer> {
  const options = {
    ...processingSchema.parse(config),
    canvasHeight: Math.round(
      (config.canvasWidth * FIGMA_REFERENCE_HEIGHT) / FIGMA_REFERENCE_WIDTH,
    ),
  };
  const meta = await sharp(inputPath).metadata();
  if (!meta.width || !meta.height)
    throw new Error("Не удалось определить размер изображения");
  const minSide = Math.max(1, Math.min(meta.width ?? 0, meta.height ?? 0));
  const tileSize = Math.max(8, Math.round(minSide / 8));

  const toneCorrected = await sharp(inputPath)
    .ensureAlpha()
    .normalize()
    .clahe({ width: tileSize, height: tileSize, maxSlope: 3 })
    .png()
    .toBuffer();

  const highlightCorrected = await recoverHighlights(
    toneCorrected,
    options.highlights,
  );

  const sharpenGeometry = {
    fineSigma: clamp(minSide / 300, 3, 8),
    energyScale: 18,
    regionSigma: clamp(minSide / 40, 25, 90),
    lowpassSigma: clamp(minSide / 220, 4, 10),
    minAmount: options.sharpen.minAmount,
    maxAmount: options.sharpen.maxAmount,
  };
  const correctedBuffer = await adaptiveSharpen(
    highlightCorrected,
    meta.width!,
    meta.height!,
    sharpenGeometry,
  );

  const bbox = await computeAlphaBoundingBox(
    correctedBuffer,
    options.alphaThreshold,
  );

  let objectBuffer = correctedBuffer;
  if (
    bbox &&
    !(bbox.width === bbox.imageWidth && bbox.height === bbox.imageHeight)
  ) {
    const padX = Math.round(bbox.width * options.paddingRatio);
    const padY = Math.round(bbox.height * options.paddingRatio);
    const left = Math.max(0, bbox.left - padX);
    const top = Math.max(0, bbox.top - padY);
    const width = Math.min(bbox.imageWidth - left, bbox.width + padX * 2);
    const height = Math.min(bbox.imageHeight - top, bbox.height + padY * 2);
    objectBuffer = await sharp(correctedBuffer)
      .extract({ left, top, width, height })
      .png()
      .toBuffer();
  }

  const objectMeta = await sharp(objectBuffer).metadata();
  const targetInnerWidth = Math.round(options.canvasWidth * options.fillRatio);
  const targetInnerHeight = Math.round(
    options.canvasHeight * options.fillRatio,
  );
  const scale = Math.min(
    targetInnerWidth / objectMeta.width!,
    targetInnerHeight / objectMeta.height!,
  );
  const resizedWidth = Math.max(1, Math.round(objectMeta.width! * scale));
  const resizedHeight = Math.max(1, Math.round(objectMeta.height! * scale));

  const resizedObject = await sharp(objectBuffer)
    .resize(resizedWidth, resizedHeight, { fit: "fill" })
    .png()
    .toBuffer();

  const watermarkBuffer = await buildWatermarkTile(
    options.canvasWidth,
    options.canvasHeight,
    watermarkPath,
  );
  const cornerRadius = Math.round(
    Math.min(options.canvasWidth, options.canvasHeight) *
      DEFAULT_CORNER_RADIUS_RATIO,
  );
  const roundedCornerMask = Buffer.from(
    buildRoundedCornerMask(
      options.canvasWidth,
      options.canvasHeight,
      cornerRadius,
    ),
  );

  const left = Math.round((options.canvasWidth - resizedWidth) / 2);
  const top = Math.round((options.canvasHeight - resizedHeight) / 2);

  // Холст остаётся полностью прозрачным. На него накладываются только
  // полупрозрачные логотипы и товар; белые области в просмотрщике — прозрачность.
  return sharp({
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
    .toBuffer();
}
