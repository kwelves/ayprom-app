import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
export async function isTrustedRendererUrl(
  expectedPath: string,
  candidateUrl: string,
): Promise<boolean> {
  try {
    const url = new URL(candidateUrl);
    if (url.protocol !== "file:" || url.search || url.hash) return false;
    const [expected, candidate] = await Promise.all([
      fs.realpath(expectedPath),
      fs.realpath(fileURLToPath(url)),
    ]);
    const normalize = (value: string) =>
      process.platform === "win32"
        ? path.normalize(value).toLowerCase()
        : path.normalize(value);
    return normalize(expected) === normalize(candidate);
  } catch {
    return false;
  }
}
