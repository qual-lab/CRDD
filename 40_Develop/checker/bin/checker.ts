#!/usr/bin/env node
/**
 * crdd-checkに属する責務をまとめる。
 *
 * @responsibility このFileに属する実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000001
 */

import { runChecker, runSemanticCoverage } from "../src/index.ts";

const arguments_ = process.argv.slice(2);
const semantic = arguments_.includes("--semantic");
const run = semantic ? runSemanticCoverage : runChecker;
const result = run({
  arguments: semantic
    ? arguments_.filter((value) => value !== "--semantic")
    : arguments_,
  cwd: process.cwd(),
  writeOutput: (value) => process.stdout.write(value),
  writeError: (value) => process.stderr.write(value),
});
process.exitCode = result.exitCode;
