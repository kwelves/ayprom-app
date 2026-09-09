import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

interface VerifyOptions {
  expectedVersion: string;
  expectedInstaller: string;
}

function topLevelValue(content: string, key: string): string {
  const line = content
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(`${key}:`));
  if (!line) throw new Error(`latest.yml: отсутствует ${key}`);
  return line
    .slice(key.length + 1)
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function firstFileValue(content: string, key: "url" | "sha512" | "size") {
  const lines = content.split(/\r?\n/);
  const filesIndex = lines.findIndex((line) => line === "files:");
  if (filesIndex < 0) throw new Error("latest.yml: отсутствует files[]");
  const endIndex = lines.findIndex(
    (line, index) => index > filesIndex && /^\S/.test(line),
  );
  const block = lines.slice(
    filesIndex + 1,
    endIndex === -1 ? undefined : endIndex,
  );
  const expression =
    key === "url"
      ? /^\s*-\s+url:\s*(.+)$/
      : new RegExp(`^\\s+${key}:\\s*(.+)$`);
  const match = block.map((line) => line.match(expression)).find(Boolean);
  if (!match?.[1]) throw new Error(`latest.yml: отсутствует files[0].${key}`);
  return match[1].trim().replace(/^['"]|['"]$/g, "");
}

export function verifyLatestYml(
  content: string,
  installer: Buffer,
  options: VerifyOptions,
) {
  const version = topLevelValue(content, "version");
  const installerName = topLevelValue(content, "path");
  const sha512 = topLevelValue(content, "sha512");
  const fileInstallerName = firstFileValue(content, "url");
  const fileSha512 = firstFileValue(content, "sha512");
  const fileSize = Number(firstFileValue(content, "size"));
  if (version !== options.expectedVersion)
    throw new Error(`latest.yml: ожидалась версия ${options.expectedVersion}`);
  if (installerName !== options.expectedInstaller)
    throw new Error(
      `latest.yml: ожидался installer ${options.expectedInstaller}`,
    );
  if (fileInstallerName !== options.expectedInstaller)
    throw new Error(
      `latest.yml: files[0].url должен быть ${options.expectedInstaller}`,
    );
  const actualHash = createHash("sha512").update(installer).digest("base64");
  if (sha512 !== actualHash || fileSha512 !== actualHash)
    throw new Error(
      "latest.yml: SHA-512 не соответствует installer из этой сборки",
    );
  if (fileSize !== installer.length)
    throw new Error("latest.yml: files[0].size не соответствует installer");
  return { version, installer: installerName, sha512 };
}

export function verifyAppUpdateYml(content: string) {
  if (
    /(?:^|\n)\s*(?:token|authorization|password)\s*:/i.test(content) ||
    /(?:ghp_|github_pat_)[A-Za-z0-9_]+/i.test(content)
  )
    throw new Error(
      "app-update.yml: token или credential не должен попадать в приложение",
    );
  const expected = {
    provider: "github",
    owner: "kwelves",
    repo: "ayprom-app",
    protocol: "https",
    private: "false",
  } as const;
  for (const [key, value] of Object.entries(expected))
    if (topLevelValue(content, key) !== value)
      throw new Error(`app-update.yml: ожидалось ${key}: ${value}`);
}

async function main() {
  const releaseDirectory = path.resolve(process.argv[2] ?? "release");
  const packageData = JSON.parse(
    await fs.readFile(path.resolve("package.json"), "utf8"),
  ) as { version: string };
  const expectedInstaller = "AYPROM-Setup.exe";
  const [content, installer, appUpdate] = await Promise.all([
    fs.readFile(path.join(releaseDirectory, "latest.yml"), "utf8"),
    fs.readFile(path.join(releaseDirectory, expectedInstaller)),
    fs.readFile(
      path.join(
        releaseDirectory,
        "win-unpacked",
        "resources",
        "app-update.yml",
      ),
      "utf8",
    ),
  ]);
  const result = verifyLatestYml(content, installer, {
    expectedVersion: packageData.version,
    expectedInstaller,
  });
  verifyAppUpdateYml(appUpdate);
  console.log(
    `update metadata PASS: ${result.version}, ${result.installer}, SHA-512 совпадает, public GitHub config без token`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  await main();
