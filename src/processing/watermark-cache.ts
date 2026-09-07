import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
const memory = new Map<string, Promise<Buffer>>();
export async function cachedWatermark(
  asset: string,
  width: number,
  height: number,
  render: () => Promise<Buffer>,
): Promise<Buffer> {
  const hash = createHash("sha256")
    .update(await fs.readFile(asset))
    .digest("hex");
  const key = hash + "-" + width + "x" + height;
  const existing = memory.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const directory = process.env.AYPROM_WATERMARK_CACHE;
    const file = directory ? path.join(directory, key + ".png") : undefined;
    if (file) {
      try {
        const cached = await fs.readFile(file);
        const meta = await sharp(cached).metadata();
        if (
          meta.width === width &&
          meta.height === height &&
          meta.format === "png"
        )
          return cached;
      } catch {}
    }
    const buffer = await render();
    if (file && directory) {
      const temp = file + "." + randomUUID() + ".tmp";
      try {
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(temp, buffer);
        await fs.rename(temp, file);
      } catch {
      } finally {
        await fs.rm(temp, { force: true }).catch(() => {});
      }
    }
    return buffer;
  })();
  memory.set(key, pending);
  if (memory.size > 2) memory.delete(memory.keys().next().value!);
  try {
    return await pending;
  } catch (error) {
    memory.delete(key);
    throw error;
  }
}
