#!/usr/bin/env node

/**
 * 配布RepositoryからCRDD Checkerを起動する。
 *
 * @responsibility 配布入口をChecker本体のCLIへ接続し、Checker実装を複製しない。
 * @trace ARCH-000001
 */

import "../../40_Develop/checker/bin/crdd-check.ts";
