import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
const files = (await fs.readdir("release"))
    .filter((f) => f.endsWith(".exe"))
    .sort(),
  lines = [];
for (const file of files) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path.join("release", file)))
    hash.update(chunk);
  lines.push(hash.digest("hex") + "  " + file);
}
await fs.writeFile("release/SHA256SUMS.txt", lines.join("\n") + "\n");
console.log(lines.join("\n"));
