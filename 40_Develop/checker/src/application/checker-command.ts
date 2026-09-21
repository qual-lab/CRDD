import {
  runCurrentProfileChecker,
  type CheckerResult,
  type CheckerRunRequest,
} from "../profiles/current-profile.ts";

export type { CheckerResult, CheckerRunRequest };

/**
 * Checkerの公開Use Case入口。
 *
 * @responsibility runCheckerに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000001
 * @input request: CheckerRunRequest
 * @returns CheckerResultを返す。
 * @precondition 「request: CheckerRunRequest」がrunCheckerの入力契約を満たす。
 * @postcondition runCheckerの責務を完了した結果だけを返す。
 * @effect N/A: runCheckerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runCheckerは独自の失敗分岐を所有しない。
 * @invariant runCheckerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runCheckerはProcess内の同一Subsystemで完結する。
 * @security N/A: runCheckerはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runCheckerは共有非同期状態を持たない同期処理である。
 */
export function runChecker(request: CheckerRunRequest): CheckerResult {
  return runCurrentProfileChecker(request);
}
