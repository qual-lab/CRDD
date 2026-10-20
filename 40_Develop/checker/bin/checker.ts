#!/usr/bin/env node
/**
 * CheckerをProcessの標準入出力へ接続する。
 *
 * @responsibility argv・cwd・標準streamを単一受付へ渡し、終了codeを設定する。
 * @trace ARCH-000001
 * @trace ARCH-000003
 * @trace ARCH-000008
 */

import { runCheckerCommand } from "../src/cli/command.ts";

const result = runCheckerCommand({
  arguments: process.argv.slice(2),
  cwd: process.cwd(),
  writeOutput: (value) => process.stdout.write(value),
  writeError: (value) => process.stderr.write(value),
});
process.exitCode = result.exitCode;
