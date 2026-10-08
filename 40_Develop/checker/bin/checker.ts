#!/usr/bin/env node
/**
 * crdd-checkに属する責務をまとめる。
 *
 * @responsibility このFileに属する実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000001
 */

import { runChecker } from "../src/index.ts";

const result = runChecker({
  arguments: process.argv.slice(2),
  cwd: process.cwd(),
  writeOutput: (value) => process.stdout.write(value),
  writeError: (value) => process.stderr.write(value),
});
process.exitCode = result.exitCode;
