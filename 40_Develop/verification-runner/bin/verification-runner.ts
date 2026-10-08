#!/usr/bin/env node
/**
 * regression-runnerに属する責務をまとめる。
 *
 * @responsibility このFileに属する実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000003
 */

import { runRegression } from "../src/index.ts";

const result = runRegression({
  arguments: process.argv.slice(2),
  emit: (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`),
});
process.exitCode = result.exitCode;
