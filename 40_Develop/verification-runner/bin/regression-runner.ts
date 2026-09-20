#!/usr/bin/env node

import { runRegression } from "../src/index.ts";

const result = runRegression({
  arguments: process.argv.slice(2),
  emit: (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`),
});
process.exitCode = result.exitCode;
