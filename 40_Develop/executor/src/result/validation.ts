/**
 * Executorが返せる失敗理由の固定集合を照合する。
 * @packageDocumentation
 * @responsibility 共有する理由語彙の照合だけを所有し、成功・取消・上位保存を再検査しない。
 * @trace ARCH-000008
 * @boundary Provider結果と上位の受入・保存の間。
 */
import { ATTEMPT_COMPLETION_REASONS } from "./constants.ts";
import type { AttemptFailureReason } from "./types.ts";

const BLOCKED_COMPLETION_REASONS = new Set<string>(ATTEMPT_COMPLETION_REASONS);

/**
 * 値がExecutorの固定失敗理由か判定する。
 *
 * @responsibility 下位結果の未知文字列をOwner Registry由来の固定理由から分離する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns 固定Registryにexact一致する場合だけtrueを返す。
 * @precondition N/A: 任意の観測値を受け取る。
 * @postcondition trueの場合、値をAttemptFailureReasonとして扱える。
 * @effect N/A: 不変Registryを参照するだけである。
 * @failure N/A: 不正値はfalseへ閉じる。
 * @invariant prefix、正規表現または部分一致で理由を許可しない。
 * @boundary 下位Provider結果からDocker Process Controller公開結果への診断境界。
 * @security 生出力または自由文を公開理由へ昇格しない。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
export function isAttemptFailureReason(
  value: unknown,
): value is AttemptFailureReason {
  return typeof value === "string" && BLOCKED_COMPLETION_REASONS.has(value);
}
