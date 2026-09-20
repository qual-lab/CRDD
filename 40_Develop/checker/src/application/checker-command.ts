import {
  runCurrentProfileChecker,
  type CheckerResult,
  type CheckerRunRequest,
} from "../profiles/current-profile.ts";

export type { CheckerResult, CheckerRunRequest };

/**
 * Checkerの公開Use Case入口。
 *
 * CLIや配布入口はこの関数だけを呼び、CRDD公式の工程別検査は
 * profiles/current-profile.tsが所有する。
 */
export function runChecker(request: CheckerRunRequest): CheckerResult {
  return runCurrentProfileChecker(request);
}
