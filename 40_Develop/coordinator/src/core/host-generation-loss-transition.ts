/**
 * HostGenerationLossEventが扱う値の構造を表す。
 *
 * @responsibility HostGenerationLossEventに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape HostGenerationLossEventが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostGenerationLossEventで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostGenerationLossEventの宣言は外部境界を開かない。
 * @security N/A: HostGenerationLossEventはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility HostGenerationLossEventの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type HostGenerationLossEvent =
  | "failure_detected"
  | "cleanup_confirmed_failure"
  | "cleanup_unknown";

/**
 * reduceHostGenerationLossTransitionの処理を実行する。
 *
 * @responsibility reduceHostGenerationLossTransitionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input event: HostGenerationLossEvent
 * @returns reduceHostGenerationLossTransitionの計算結果を返す。
 * @precondition 「event: HostGenerationLossEvent」がreduceHostGenerationLossTransitionの入力契約を満たす。
 * @postcondition reduceHostGenerationLossTransitionの責務を完了した結果だけを返す。
 * @effect N/A: reduceHostGenerationLossTransitionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reduceHostGenerationLossTransitionは独自の失敗分岐を所有しない。
 * @invariant reduceHostGenerationLossTransitionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reduceHostGenerationLossTransitionはProcess内の同一Subsystemで完結する。
 * @security N/A: reduceHostGenerationLossTransitionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: reduceHostGenerationLossTransitionは共有非同期状態を持たない同期処理である。
 */
export function reduceHostGenerationLossTransition(
  event: HostGenerationLossEvent,
) {
  return Object.freeze({
    retired: true,
    revokeEffectCapabilities: true,
    beginEffectDrain: event === "failure_detected",
    poisonProcess: event === "cleanup_unknown",
  });
}
