#!/usr/bin/env node
/**
 * crdd-checkに属する責務をまとめる。
 *
 * @responsibility このFileに属する実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000001
 */

import {
  runChecker,
  runSemanticCoverage,
  runTestCatalog,
} from "../src/index.ts";

const arguments_ = process.argv.slice(2);
const semantic = arguments_.includes("--semantic");
const catalog = arguments_.includes("--test-catalog");
const run = catalog
  ? runTestCatalog
  : semantic
    ? runSemanticCoverage
    : runChecker;
const result = run({
  arguments:
    semantic || catalog
      ? arguments_.filter(
          (value) => value !== (catalog ? "--test-catalog" : "--semantic"),
        )
      : arguments_,
  cwd: process.cwd(),
  writeOutput: (value) => process.stdout.write(value),
  writeError: (value) => process.stderr.write(value),
});
process.exitCode = result.exitCode;
