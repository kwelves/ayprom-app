#!/usr/bin/env node
// CLI wrapper. Original reference: Git commit cfa8c91.
try {
  await import("./dist/cli.cjs");
} catch (error) {
  console.error(
    "CLI не собран. Выполните npm install и npm run build в папке проекта.",
  );
  console.error(error.message);
  process.exitCode = 1;
}
