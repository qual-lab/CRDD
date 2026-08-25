import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const checkerRoot = path.dirname(fileURLToPath(import.meta.url));
const testFiles = fs
  .readdirSync(checkerRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

if (testFiles.length === 0) {
  process.stderr.write("Checker test files were not found.\n");
  process.exitCode = 1;
} else {
  const testProcess = spawnSync(process.execPath, ["--test", ...testFiles], {
    cwd: checkerRoot,
    stdio: "inherit",
  });
  if (testProcess.error) throw testProcess.error;
  if (testProcess.signal) {
    process.stderr.write(
      `Checker tests terminated by ${testProcess.signal}.\n`,
    );
    process.exitCode = 1;
  } else {
    process.exitCode = testProcess.status ?? 1;
  }
}
