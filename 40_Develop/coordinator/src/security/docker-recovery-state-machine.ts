/**
 * docker-recovery-state-machineに属する責務をまとめる。
 *
 * @responsibility releaseRecoverySynchronizationsを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
export const DOCKER_RECOVERY_STATE_MACHINE_CONTRACT =
  "crdd-coordinator/docker-recovery-state-machine";
export const DOCKER_RECOVERY_STATE_MACHINE_CONTRACT_REVISION = 2;

/**
 * 回復 Synchronizationsを解放する。
 *
 * @responsibility 回復 Synchronizationsの所有権、解放条件、終了後不存在の確認境界を所有する。
 * @trace ARCH-000008
 * @input attempts: readonly Readonly<{ release: () => boolean; reason: string; }>[]
 * @returns releaseRecoverySynchronizationsの計算結果を返す。
 * @precondition 「attempts: readonly Readonly<{ release: () => boolean; reason: string; }>[]」がreleaseRecoverySynchronizationsの入力契約を満たす。
 * @postcondition releaseRecoverySynchronizationsの責務を完了した結果だけを返す。
 * @effect N/A: releaseRecoverySynchronizationsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure releaseRecoverySynchronizationsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant releaseRecoverySynchronizationsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: releaseRecoverySynchronizationsはProcess内の同一Subsystemで完結する。
 * @security releaseRecoverySynchronizationsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: releaseRecoverySynchronizationsは共有非同期状態を持たない同期処理である。
 */
export function releaseRecoverySynchronizations(
  attempts: readonly Readonly<{
    release: () => boolean;
    reason: string;
  }>[],
) {
  let firstFailure: string | null = null;
  for (const attempt of attempts) {
    try {
      if (!attempt.release()) firstFailure ??= attempt.reason;
    } catch {
      firstFailure ??= attempt.reason;
    }
  }
  return firstFailure;
}

/**
 * Committed Pair Delete 状態を分類する。
 *
 * @responsibility Committed Pair Delete 状態の分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input contentPresent: boolean、commitPresent: boolean
 * @returns classifyCommittedPairDeleteStateの計算結果を返す。
 * @precondition 「contentPresent: boolean、commitPresent: boolean」がclassifyCommittedPairDeleteStateの入力契約を満たす。
 * @postcondition classifyCommittedPairDeleteStateの責務を完了した結果だけを返す。
 * @effect N/A: classifyCommittedPairDeleteStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyCommittedPairDeleteStateは独自の失敗分岐を所有しない。
 * @invariant classifyCommittedPairDeleteStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyCommittedPairDeleteStateはProcess内の同一Subsystemで完結する。
 * @security classifyCommittedPairDeleteStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyCommittedPairDeleteStateは共有非同期状態を持たない同期処理である。
 */
export function classifyCommittedPairDeleteState(
  contentPresent: boolean,
  commitPresent: boolean,
) {
  if (contentPresent && commitPresent) return "remove_content" as const;
  if (!contentPresent && commitPresent) return "remove_commit" as const;
  if (!contentPresent && !commitPresent) return "complete" as const;
  return "third_state" as const;
}

/**
 * Committed Pair Move 状態を分類する。
 *
 * @responsibility Committed Pair Move 状態の分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input sourceContentPresent: boolean、sourceCommitPresent: boolean、targetContentPresent: boolean、targetCommitPresent: boolean
 * @returns classifyCommittedPairMoveStateの計算結果を返す。
 * @precondition 「sourceContentPresent: boolean、sourceCommitPresent: boolean、targetContentPresent: boolean、targetCommitPresent: boolean」がclassifyCommittedPairMoveStateの入力契約を満たす。
 * @postcondition classifyCommittedPairMoveStateの責務を完了した結果だけを返す。
 * @effect N/A: classifyCommittedPairMoveStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyCommittedPairMoveStateは独自の失敗分岐を所有しない。
 * @invariant classifyCommittedPairMoveStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyCommittedPairMoveStateはProcess内の同一Subsystemで完結する。
 * @security classifyCommittedPairMoveStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyCommittedPairMoveStateは共有非同期状態を持たない同期処理である。
 */
export function classifyCommittedPairMoveState(
  sourceContentPresent: boolean,
  sourceCommitPresent: boolean,
  targetContentPresent: boolean,
  targetCommitPresent: boolean,
) {
  if (
    sourceContentPresent &&
    sourceCommitPresent &&
    !targetContentPresent &&
    !targetCommitPresent
  )
    return "move_content" as const;
  if (
    !sourceContentPresent &&
    sourceCommitPresent &&
    targetContentPresent &&
    !targetCommitPresent
  )
    return "move_commit" as const;
  if (
    !sourceContentPresent &&
    !sourceCommitPresent &&
    targetContentPresent &&
    targetCommitPresent
  )
    return "complete" as const;
  return "third_state" as const;
}

/**
 * 清掃 Directory 状態を分類する。
 *
 * @responsibility 清掃 Directory 状態の分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input directoryPresent: boolean、unknownEntryPresent: boolean、hasIdentityOrContentMismatch: boolean、expectedEntryCount: number
 * @returns classifyCleanupDirectoryStateの計算結果を返す。
 * @precondition 「directoryPresent: boolean、unknownEntryPresent: boolean、hasIdentityOrContentMismatch: boolean、expectedEntryCount: number」がclassifyCleanupDirectoryStateの入力契約を満たす。
 * @postcondition classifyCleanupDirectoryStateの責務を完了した結果だけを返す。
 * @effect N/A: classifyCleanupDirectoryStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyCleanupDirectoryStateは独自の失敗分岐を所有しない。
 * @invariant classifyCleanupDirectoryStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyCleanupDirectoryStateはProcess内の同一Subsystemで完結する。
 * @security classifyCleanupDirectoryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyCleanupDirectoryStateは共有非同期状態を持たない同期処理である。
 */
export function classifyCleanupDirectoryState(
  directoryPresent: boolean,
  unknownEntryPresent: boolean,
  hasIdentityOrContentMismatch: boolean,
  expectedEntryCount: number,
) {
  if (
    unknownEntryPresent ||
    hasIdentityOrContentMismatch ||
    !Number.isSafeInteger(expectedEntryCount) ||
    expectedEntryCount < 0
  )
    return "third_state" as const;
  if (!directoryPresent) return "complete" as const;
  return expectedEntryCount === 0
    ? ("remove_directory" as const)
    : ("remove_expected_entries" as const);
}

/**
 * Docker 回復 状態 Machine 契約の公開契約を記述する。
 *
 * @responsibility Docker 回復 状態 Machine 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDockerRecoveryStateMachineContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDockerRecoveryStateMachineContractの入力契約を満たす。
 * @postcondition describeDockerRecoveryStateMachineContractの責務を完了した結果だけを返す。
 * @effect N/A: describeDockerRecoveryStateMachineContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeDockerRecoveryStateMachineContractは独自の失敗分岐を所有しない。
 * @invariant describeDockerRecoveryStateMachineContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeDockerRecoveryStateMachineContractはProcess内の同一Subsystemで完結する。
 * @security describeDockerRecoveryStateMachineContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDockerRecoveryStateMachineContractは共有非同期状態を持たない同期処理である。
 */
export function describeDockerRecoveryStateMachineContract() {
  return Object.freeze({
    deleteKnownStates: Object.freeze([
      "remove_content",
      "remove_commit",
      "complete",
    ]),
    moveKnownStates: Object.freeze(["move_content", "move_commit", "complete"]),
    cleanupSuccessResidue: 0,
    thirdStateTreatment: "preserve_evidence_and_fail_closed",
    lockReleaseTreatment: "attempt_all_and_report_first_failure",
  });
}
