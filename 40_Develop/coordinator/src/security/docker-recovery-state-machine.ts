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
 * 全ての回復排他の解放を試み、最初の未確認理由を返す。
 *
 * @responsibility 一つの失敗で後続解放を省略せず、同期返値trueだけを成功とする。
 * @trace ARCH-000008
 * @input attempts: readonly Readonly<{ release: () => boolean; reason: string; }>[]
 * @returns 最初の失敗理由、または全てtrueだった場合のnull。
 * @precondition 「attempts: readonly Readonly<{ release: () => boolean; reason: string; }>[]」がreleaseRecoverySynchronizationsの入力契約を満たす。
 * @postcondition releaseRecoverySynchronizationsの責務を完了した結果だけを返す。
 * @effect 各attemptの解放処理を順に一回呼び出す。
 * @failure false、非booleanおよび例外を対応する失敗理由として保持する。
 * @invariant releaseRecoverySynchronizationsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 各排他Ownerの同期返値。全OS資源の不存在をこの集約だけでは証明しない。
 * @security releaseRecoverySynchronizationsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency Promiseやthenableを待機・実行せず失敗とする。
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
      if (attempt.release() !== true) firstFailure ??= attempt.reason;
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

/**
 * Coordinator現在状態の保存途中から予定できる次処置を分類する。
 *
 * @responsibility 元版・次版のexact内容結合と初回条件を照合し、不明な状態を停止へ分類する。
 * @trace ARCH-000008
 * @input current: 正規Fileの閉じた観測、pending: 検証済みSnapshotの版・結合・exact bytes Hash、repositoryBinding: 期待するRepository結合、rootState: 初回Root条件の観測。
 * @returns publish_pending、remove_pendingまたはblockedという処置候補を返す。
 * @precondition 呼出し側がSnapshot全体を検証し、Hashをexact UTF-8 bytesから取得している。
 * @postcondition 元版結合または確定済み同内容の確認なしに処置候補を返さない。
 * @effect N/A: File、Lock、Process、Dockerを操作しない純粋な判定である。
 * @failure 不正な版、結合差、同版異内容、既知元版喪失、観測不能はblockedへ分類する。
 * @invariant 正規Fileの観測不能を不存在へ変換せず、履歴から旧状態を復元しない。
 * @boundary 検証済みSnapshotのIdentityと再入場処置候補の境界。全Snapshotの妥当性検証は所有しない。
 * @security 返却値は保存・削除・次EffectのAuthorityでも、cleanup成立の証明でもない。
 * @concurrency N/A: 排他を取得しない。利用側が同じ短期排他内でfresh観測と実処置を所有する。
 */
export function classifyCoordinatorSnapshotReentry(
  current:
    | Readonly<{
        status: "present";
        revision: number;
        repositoryBinding: string;
        payloadSha256: string;
      }>
    | Readonly<{ status: "absent" }>
    | Readonly<{ status: "unknown" }>,
  pending: Readonly<{
    revision: number;
    previous: Readonly<{ revision: number; payloadSha256: string }> | null;
    repositoryBinding: string;
    payloadSha256: string;
  }>,
  repositoryBinding: string,
  rootState: "new" | "existing" | "unknown",
) {
  if (
    repositoryBinding.length === 0 ||
    pending.repositoryBinding !== repositoryBinding ||
    !Number.isSafeInteger(pending.revision) ||
    pending.revision < 1 ||
    !/^[a-f0-9]{64}$/.test(pending.payloadSha256) ||
    (pending.previous === null
      ? pending.revision !== 1
      : !Number.isSafeInteger(pending.previous.revision) ||
        pending.previous.revision < 1 ||
        pending.previous.revision >= Number.MAX_SAFE_INTEGER ||
        pending.revision !== pending.previous.revision + 1 ||
        !/^[a-f0-9]{64}$/.test(pending.previous.payloadSha256))
  )
    return "blocked" as const;
  if (current.status === "unknown" || rootState === "unknown")
    return "blocked" as const;
  if (current.status === "absent")
    return pending.previous === null && rootState === "new"
      ? ("publish_pending" as const)
      : ("blocked" as const);
  if (
    current.repositoryBinding !== repositoryBinding ||
    !Number.isSafeInteger(current.revision) ||
    current.revision < 1 ||
    !/^[a-f0-9]{64}$/.test(current.payloadSha256)
  )
    return "blocked" as const;
  if (
    current.revision === pending.revision &&
    current.payloadSha256 === pending.payloadSha256
  )
    return "remove_pending" as const;
  if (
    pending.previous !== null &&
    current.revision === pending.previous.revision &&
    current.payloadSha256 === pending.previous.payloadSha256
  )
    return "publish_pending" as const;
  return "blocked" as const;
}
