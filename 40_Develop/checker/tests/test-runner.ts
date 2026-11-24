import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverCheckerTestFiles,
  requireCheckerTestFiles,
} from "./support/test-discovery.ts";

const checkerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const testFiles = requireCheckerTestFiles(
  discoverCheckerTestFiles(checkerRoot),
);

const coverage = process.argv[2] === "--coverage";
const options = coverage
  ? ["--experimental-test-coverage", "--test-coverage-include=src/**/*.ts"]
  : [];
const testProcess = spawnSync(
  process.execPath,
  [...options, "--test", ...testFiles],
  {
    cwd: checkerRoot,
    stdio: "inherit",
  },
);
if (testProcess.error) throw testProcess.error;
if (testProcess.signal) {
  process.stderr.write(`Checker tests terminated by ${testProcess.signal}.\n`);
  process.exitCode = 1;
} else {
  process.exitCode = testProcess.status ?? 1;
}
