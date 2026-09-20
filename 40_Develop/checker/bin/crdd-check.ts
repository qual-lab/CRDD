#!/usr/bin/env node

import { runChecker } from "../src/index.ts";

const result = runChecker({
  arguments: process.argv.slice(2),
  cwd: process.cwd(),
  writeOutput: (value) => process.stdout.write(value),
  writeError: (value) => process.stderr.write(value),
});
process.exitCode = result.exitCode;
