/**
 * Rule診断を呼出し単位で収集する。
 *
 * @responsibility 追加順と重複を保持する局所配列と追加操作を生成する。
 * @trace ARCH-000001
 */
import type { CheckerFinding, FindingSink } from "./types.ts";

/**
 * 一回のRule検査に使う診断収集先を作る。
 *
 * @responsibility 新しい配列と、その配列へ診断を追加する同期callbackを返す。
 * @trace ARCH-000001
 * @input N/A: 実行時引数を受け取らない。
 * @returns Readonly<{ findings: CheckerFinding[]; add: FindingSink; }>を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateFindingCollectorの入力契約を満たす。
 * @postcondition 追加順・重複・診断Objectをそのまま保持する。
 * @effect 呼出しごとの返却配列にaddが追記する。外部I/O・呼出し間共有状態は持たない。
 * @failure N/A: createFindingCollectorは独自の失敗分岐を所有しない。
 * @invariant 並替え・重複除去・copy・診断field追加を行わない。
 * @boundary N/A: createFindingCollectorはProcess内の同一Subsystemで完結する。
 * @security N/A: createFindingCollectorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createFindingCollectorは共有非同期状態を持たない同期処理である。
 */
export function createFindingCollector(): Readonly<{
  findings: CheckerFinding[];
  add: FindingSink;
}> {
  const findings: CheckerFinding[] = [];
  return {
    findings,
    add: (finding) => findings.push(finding),
  };
}
