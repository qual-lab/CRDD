import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverCheckerTestFiles,
  requireCheckerTestFiles,
} from "./test-discovery.ts";

const checkerRoot = path.dirname(fileURLToPath(import.meta.url));
const testFiles = requireCheckerTestFiles(
  discoverCheckerTestFiles(checkerRoot),
);

const testProcess = spawnSync(process.execPath, ["--test", ...testFiles], {
  cwd: checkerRoot,
  stdio: "inherit",
});
if (testProcess.error) throw testProcess.error;
if (testProcess.signal) {
  process.stderr.write(`Checker tests terminated by ${testProcess.signal}.\n`);
  process.exitCode = 1;
} else {
  process.exitCode = testProcess.status ?? 1;
}
