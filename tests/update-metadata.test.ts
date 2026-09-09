import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyAppUpdateYml,
  verifyLatestYml,
} from "../scripts/verify-update-metadata";

const sha512 =
  "t3/i2G+8W9EW1qBz60R+dqdK3T+g0LgB+XU1ljJBvjzc4dvK7WA7ePAg0IRbLUv8iSzrKn0cjx2Yq8SBLvWvIQ==";
const metadata = `version: 1.1.0
files:
  - url: AYPROM-Setup.exe
    sha512: ${sha512}
    size: 9
path: AYPROM-Setup.exe
sha512: ${sha512}
releaseDate: '2026-09-09T00:00:00.000Z'
`;

test("latest.yml must name and hash the installer from the same build", () => {
  assert.deepEqual(
    verifyLatestYml(metadata, Buffer.from("installer"), {
      expectedVersion: "1.1.0",
      expectedInstaller: "AYPROM-Setup.exe",
    }),
    {
      version: "1.1.0",
      installer: "AYPROM-Setup.exe",
      sha512,
    },
  );
});

test("latest.yml mismatch fails release verification", () => {
  assert.throws(
    () =>
      verifyLatestYml(metadata, Buffer.from("different"), {
        expectedVersion: "1.1.0",
        expectedInstaller: "AYPROM-Setup.exe",
      }),
    /SHA-512/,
  );
});

test("latest.yml files entry cannot disagree with the top-level installer", () => {
  const inconsistent = metadata.replace(
    "  - url: AYPROM-Setup.exe",
    "  - url: wrong-installer.exe",
  );
  assert.throws(
    () =>
      verifyLatestYml(inconsistent, Buffer.from("installer"), {
        expectedVersion: "1.1.0",
        expectedInstaller: "AYPROM-Setup.exe",
      }),
    /files\[0\]/,
  );
});

test("packaged update config is public GitHub HTTPS and contains no token", () => {
  const config = `owner: kwelves
repo: ayprom-app
provider: github
protocol: https
private: false
releaseType: draft
`;
  assert.doesNotThrow(() => verifyAppUpdateYml(config));
  assert.throws(
    () => verifyAppUpdateYml(`${config}token: github_pat_secret\n`),
    /token/i,
  );
});
