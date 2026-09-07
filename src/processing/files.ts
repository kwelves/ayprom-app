import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { BatchRequest, ProgressEvent, ScanJob } from "../shared/contracts";

export const EXTENSIONS = new Set([
  ".png",
  ".webp",
  ".jpg",
  ".jpeg",
  ".avif",
  ".tiff",
]);
export const TEMP_PREFIX = ".enhance-product-photos-";
export const keyPath = (p: string) =>
  process.platform === "win32"
    ? path.resolve(p).toLowerCase()
    : path.resolve(p);
export const inside = (parent: string, child: string) => {
  const relative = path.relative(keyPath(parent), keyPath(child));
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
};
export const eligible = (name: string, force: boolean) =>
  EXTENSIONS.has(path.extname(name).toLowerCase()) &&
  (force || !/^[1-9]\d*\.png$/i.test(name));
export const sortFiles = (files: string[]) =>
  files.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
export interface Folder {
  dir: string;
  files: string[];
}
export interface Cancellation {
  cancelled: boolean;
}
export async function scanRoot(
  root: string,
  force: boolean,
  cancellation: Cancellation = { cancelled: false },
  emit: (event: ProgressEvent) => void = () => {},
): Promise<{ folders: Folder[]; visited: number }> {
  const stat = await fs.lstat(root);
  if (stat.isSymbolicLink())
    throw new Error("Символические ссылки не поддерживаются");
  if (stat.isFile())
    return {
      folders: eligible(path.basename(root), force)
        ? [{ dir: path.dirname(root), files: [path.basename(root)] }]
        : [],
      visited: 0,
    };
  if (!stat.isDirectory())
    throw new Error("Источник не является папкой или изображением");
  const queue = [root];
  const folders: Folder[] = [];
  let visited = 0,
    total = 0;
  emit({ type: "scan-started", root });
  for (
    let cursor = 0;
    cursor < queue.length && !cancellation.cancelled;
    cursor++
  ) {
    const dir = queue[cursor];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = sortFiles(
      entries
        .filter((e) => e.isFile() && eligible(e.name, force))
        .map((e) => e.name),
    );
    if (files.length) folders.push({ dir, files });
    total += files.length;
    for (const entry of entries)
      if (entry.isDirectory() && !entry.name.startsWith(TEMP_PREFIX))
        queue.push(path.join(dir, entry.name));
    visited++;
    if (visited % 20 === 0 || cursor === queue.length - 1)
      emit({ type: "scan-progress", root, total, folders: visited });
  }
  return { folders, visited };
}
export async function describeRoots(
  roots: string[],
  force: boolean,
): Promise<ScanJob[]> {
  const jobs: ScanJob[] = [];
  for (const root of roots) {
    try {
      const { folders, visited } = await scanRoot(root, force);
      jobs.push({
        id: keyPath(root),
        root,
        name: path.basename(root),
        total: folders.reduce((n, f) => n + f.files.length, 0),
        folders: Math.max(0, visited - 1),
        firstImage:
          folders[0] && path.join(folders[0].dir, folders[0].files[0]),
      });
    } catch (error) {
      jobs.push({
        id: keyPath(root),
        root,
        name: path.basename(root),
        total: 0,
        folders: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return jobs;
}
export function rootNames(roots: string[]): string[] {
  const used = new Set<string>();
  return roots.map((root) => {
    const normalized = path.resolve(root);
    const base =
      path.basename(normalized) ||
      path.parse(normalized).root.replace(/[\\/:]+/g, "") ||
      "Source";
    let name = base,
      n = 2;
    while (used.has(name.toLowerCase())) name = `${base} (${n++})`;
    used.add(name.toLowerCase());
    return name;
  });
}
export function outputDirectory(
  root: string,
  folder: string,
  output: string,
  rootName: string,
  sameSource: boolean,
): string {
  if (sameSource) return folder;
  if (
    !rootName ||
    rootName === "." ||
    rootName === ".." ||
    path.basename(rootName) !== rootName
  )
    throw new Error("Некорректное имя корня результата");
  const relative = path.relative(root, folder);
  if (!inside(root, folder)) throw new Error("Папка вне выбранного источника");
  return path.join(output, rootName, relative);
}
export async function assertNoSymlinks(target: string): Promise<void> {
  const absolute = path.resolve(target);
  const parts = absolute
    .slice(path.parse(absolute).root.length)
    .split(path.sep);
  let current = path.parse(absolute).root;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      if ((await fs.lstat(current)).isSymbolicLink())
        throw new Error(`Ссылка в пути не поддерживается: ${current}`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      throw e;
    }
  }
}
export async function validateRoots(request: BatchRequest): Promise<void> {
  const seen: string[] = [];
  for (const root of request.roots) {
    if (!path.isAbsolute(root))
      throw new Error("Нужен абсолютный путь источника");
    await assertNoSymlinks(root);
    const resolved = await fs.realpath(root);
    if (seen.some((p) => inside(p, resolved) || inside(resolved, p)))
      throw new Error("Источники дублируются или вложены друг в друга");
    seen.push(resolved);
    if (
      !request.sameSource &&
      (inside(resolved, request.output) || inside(request.output, resolved))
    )
      throw new Error("Выберите отдельную папку результата вне источников");
  }
  if (!path.isAbsolute(request.output))
    throw new Error("Нужен абсолютный путь результата");
  await assertNoSymlinks(request.output);
}
export async function writeOutput(
  buffer: Buffer,
  destination: string,
  conflict: BatchRequest["conflict"],
  protectedPaths: Set<string>,
): Promise<string | null> {
  await assertNoSymlinks(path.dirname(destination));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = path.join(
    path.dirname(destination),
    `${TEMP_PREFIX}${randomUUID()}.tmp`,
  );
  try {
    await fs.writeFile(temporary, buffer, { flag: "wx" });
    for (let index = 1; ; index++) {
      const ext = path.extname(destination);
      const candidate =
        index === 1
          ? destination
          : `${destination.slice(0, -ext.length)} (${index})${ext}`;
      if (protectedPaths.has(keyPath(candidate))) {
        if (conflict === "rename") continue;
        if (conflict === "skip") return null;
        throw new Error(
          "Перезапись исходного изображения запрещена; выберите уникальное имя или отдельную папку",
        );
      }
      await assertNoSymlinks(candidate);
      if (conflict === "overwrite") {
        await fs.rename(temporary, candidate);
        return candidate;
      }
      try {
        await fs.link(temporary, candidate);
        return candidate;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (conflict === "skip") return null;
      }
    }
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
