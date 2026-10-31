/**
 * execution/validation.tsの値契約と判定を所有する。
 * @responsibility 移管元と同じ状態値・相関を扱い、保存・実行Effectを発行しない。
 * @trace ARCH-000004、ARCH-000008
 */
import {
  type CoordinatorStateTaskOperation,
  isDockerRestartCheckpointSettled,
  coordinatorTaskResourcesAreSettled,
} from "../../../domain-model/src/index.ts";
import { types as utilTypes } from "node:util";
import { parseDockerTaskRecoveryId } from "../../../docker-isolation/src/index.ts";
import {
  RECOVERY_START_FAILURE_STAGES,
  type RecoveryStartFailureDiagnostic,
} from "./types.ts";
import type { Recovery } from "./types.ts";

// 現行Hostの開始・在庫投影が返す有限理由だけを受ける。
// 旧保存方式のProducer不在理由を分類契約として保持しない。未知値は従来どおりunavailable。
const RECOVERY_START_REASON_CLASS = new Map<string, string>([
  [
    "docker_task_multiple_recovery_inventory_available",
    "docker_process_controller_recovery_conflict",
  ],
  [
    "docker_task_recovery_inventory_available",
    "docker_process_controller_recovery_conflict",
  ],
  ...[
    "docker_task_recovery_home_lock_release_unconfirmed",
    "docker_task_recovery_host_lock_release_unconfirmed",
    "docker_task_runtime_state_lock_release_unconfirmed",
    "docker_task_recovery_begin_failed_closed",
    "docker_task_recovery_failed_closed",
  ].map(
    (reason) =>
      [
        reason,
        "docker_process_controller_recovery_observation_unknown",
      ] as const,
  ),
]);

/**
 * 解放済みで五資源が既知終端の操作だけをHost不存在観測へ接続する。
 * @responsibility Host清掃欄が未要求でも観測可能な限定条件を判定する。
 * @trace ARCH-000008
 * @input operation: 現在Decoderが相関を確認したTask操作。
 * @returns 現在Host／markerの観測へ進める場合だけtrue。
 * @precondition 元token／Root結合、fresh排他と実不存在は別途確認する。
 * @postcondition trueをHost清掃・Task成功・履歴確定へ昇格しない。
 * @effect N/A: メモリ内の値判定だけ。
 * @failure 未解放・Owner有効／不明・未終端・遷移／再起動未解決はfalse。
 * @invariant 過去unknownを成功へ変換せずWorkspaceを再利用しない。
 * @boundary 保存済み終端条件と実Host観測。
 * @security 保存値だけでは処置Authorityを作らない。
 * @concurrency N/A: 実体・排他の前後照合は回収Ownerが担当する。
 */
export function coordinatorReleasedTaskCanObserveHostAbsence(
  operation: CoordinatorStateTaskOperation,
): boolean {
  return (
    operation.lease === "released" &&
    operation.execution.ownerEffect === "disabled" &&
    operation.execution.workspaceReusable === false &&
    operation.host.pendingTransitionJson === null &&
    (operation.dockerRestart === null ||
      isDockerRestartCheckpointSettled(operation.dockerRestart)) &&
    operation.resources.length === 5 &&
    operation.resources.every(
      (resource) =>
        resource.request === "identified" && resource.observation === "absent",
    ) &&
    coordinatorTaskResourcesAreSettled(operation)
  );
}

/**
 * own Data Valueを決定する。
 *
 * @responsibility own Data Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、key: string
 * @returns unknownを返す。
 * @precondition 「value: unknown、key: string」がownDataValueの入力契約を満たす。
 * @postcondition ownDataValueの責務を完了した結果だけを返す。
 * @effect N/A: ownDataValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownDataValueは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownDataValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security ownDataValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownDataValueは共有非同期状態を持たない同期処理である。
 */
export function ownDataValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Ready 回復を所有Snapshotへ変換する。
 *
 * @responsibility Ready 回復の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns Recovery | nullを返す。
 * @precondition 「value: unknown」がsnapshotReadyRecoveryの入力契約を満たす。
 * @postcondition snapshotReadyRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: snapshotReadyRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotReadyRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotReadyRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security snapshotReadyRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotReadyRecoveryは共有非同期状態を持たない同期処理である。
 */
export function snapshotReadyRecovery(value: unknown): Recovery | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).sort().join("\0") !==
        ["recoveryCapability", "recoveryId", "status"].sort().join("\0")
    )
      return null;
  } catch {
    return null;
  }
  const status = ownDataValue(value, "status");
  const recoveryId = ownDataValue(value, "recoveryId");
  const recoveryCapability = ownDataValue(value, "recoveryCapability");
  return status === "ready" &&
    typeof recoveryId === "string" &&
    recoveryCapability !== null &&
    typeof recoveryCapability === "object"
    ? Object.freeze({ status, recoveryId, recoveryCapability })
    : null;
}

/**
 * Blocked 回復 With Exact Idを所有Snapshotへ変換する。
 *
 * @responsibility Blocked 回復 With Exact Idの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedStableLogicalHomeBindingHash: string
 * @returns snapshotBlockedRecoveryWithExactIdの計算結果を返す。
 * @precondition 「value: unknown、expectedStableLogicalHomeBindingHash: string」がsnapshotBlockedRecoveryWithExactIdの入力契約を満たす。
 * @postcondition snapshotBlockedRecoveryWithExactIdの責務を完了した結果だけを返す。
 * @effect N/A: snapshotBlockedRecoveryWithExactIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotBlockedRecoveryWithExactIdは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotBlockedRecoveryWithExactIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security snapshotBlockedRecoveryWithExactIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotBlockedRecoveryWithExactIdは共有非同期状態を持たない同期処理である。
 */
export function snapshotBlockedRecoveryWithExactId(
  value: unknown,
  expectedStableLogicalHomeBindingHash: string,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (utilTypes.isProxy(value)) return null;
  let hasOwner = false;
  try {
    const keys = Object.keys(value).sort().join("\0");
    hasOwner =
      keys ===
      [
        "reason",
        "recoveryId",
        "status",
        "recoveryCapability",
        "manualRecoveryRequired",
      ]
        .sort()
        .join("\0");
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      (keys !== ["reason", "recoveryId", "status"].sort().join("\0") &&
        !hasOwner)
    )
      return null;
  } catch {
    return null;
  }
  const status = ownDataValue(value, "status");
  const reason = ownDataValue(value, "reason");
  const recoveryId = resolveRecoveryReference(
    ownDataValue(value, "recoveryId"),
  );
  const parsed = parseDockerTaskRecoveryId(recoveryId);
  const capability = ownDataValue(value, "recoveryCapability");
  if (
    hasOwner &&
    (!capability ||
      typeof capability !== "object" ||
      utilTypes.isProxy(capability) ||
      ownDataValue(value, "manualRecoveryRequired") !== true)
  )
    return null;
  return status === "blocked" &&
    typeof reason === "string" &&
    recoveryId &&
    parsed?.stableLogicalHomeBindingHash ===
      expectedStableLogicalHomeBindingHash
    ? Object.freeze({
        status,
        reason,
        recoveryId,
        recoveryCapability: capability ?? null,
      })
    : null;
}

/**
 * 技術結果の固定field集合を動的Propertyなしに捕捉する。
 * @responsibility 既存診断shapeの受理順序を変えず値を局所化する。
 * @trace ARCH-000008
 * @input 未検査値とこのModule内の固定Key集合。
 * @returns 凍結した浅い値又はnull。
 * @precondition 永続化・保存Schemaの判断は行わない。
 * @postcondition getter・Proxy・継承値を評価しない。
 * @effect N/A: 同期の検査のみ。
 * @failure 不正shape・取得不能はnull。
 * @invariant 観測不能を成功へ補完しない。
 * @boundary 結果・診断の内部捕捉。
 * @security 任意のfieldを公開結果へ混入させない。
 * @concurrency N/A: 共有状態なし。
 */
function snapshotRecoveryRecord<const K extends string>(
  value: unknown,
  allowedKeys: ReadonlySet<K>,
): Readonly<Record<K, unknown>> | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      utilTypes.isProxy(value) ||
      Array.isArray(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== allowedKeys.size ||
      keys.some((key) => typeof key !== "string" || !allowedKeys.has(key as K))
    )
      return null;
    const snapshot = Object.create(null) as Record<K, unknown>;
    for (const key of allowedKeys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      )
        return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

/** 診断の未知値・余分な内容を拒否し、Authorityを伴わない値へ閉じる。 */
export function inspectRecoveryStartFailureDiagnostic(
  raw: unknown,
): RecoveryStartFailureDiagnostic | null {
  const value = snapshotRecoveryRecord(raw, new Set(["stage", "recoveryId"]));
  if (
    !value ||
    !RECOVERY_START_FAILURE_STAGES.includes(
      value.stage as RecoveryStartFailureDiagnostic["stage"],
    ) ||
    (value.recoveryId !== null && !parseDockerTaskRecoveryId(value.recoveryId))
  )
    return null;
  return Object.freeze({
    stage: value.stage as RecoveryStartFailureDiagnostic["stage"],
    recoveryId: value.recoveryId as string | null,
  });
}

/**
 * public Docker 回復 Start Reasonを決定する。
 *
 * @responsibility public Docker 回復 Start Reasonの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input reason: unknown
 * @returns resolveRecoveryStartReasonの計算結果を返す。
 * @precondition 「reason: unknown」がresolveRecoveryStartReasonの入力契約を満たす。
 * @postcondition resolveRecoveryStartReasonの責務を完了した結果だけを返す。
 * @effect N/A: resolveRecoveryStartReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRecoveryStartReasonは独自の失敗分岐を所有しない。
 * @invariant resolveRecoveryStartReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRecoveryStartReasonはProcess内の同一Subsystemで完結する。
 * @security resolveRecoveryStartReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRecoveryStartReasonは共有非同期状態を持たない同期処理である。
 */
export function resolveRecoveryStartReason(reason: unknown) {
  if (typeof reason === "string") {
    const classified = RECOVERY_START_REASON_CLASS.get(reason);
    if (classified) return classified;
  }
  return "docker_process_controller_recovery_unavailable";
}

/**
 * public Verified Docker 回復 Idを決定する。
 *
 * @responsibility public Verified Docker 回復 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns resolveRecoveryReferenceの計算結果を返す。
 * @precondition 「value: unknown」がresolveRecoveryReferenceの入力契約を満たす。
 * @postcondition resolveRecoveryReferenceの責務を完了した結果だけを返す。
 * @effect N/A: resolveRecoveryReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRecoveryReferenceは独自の失敗分岐を所有しない。
 * @invariant resolveRecoveryReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRecoveryReferenceはProcess内の同一Subsystemで完結する。
 * @security resolveRecoveryReferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRecoveryReferenceは共有非同期状態を持たない同期処理である。
 */
export function resolveRecoveryReference(value: unknown) {
  return parseDockerTaskRecoveryId(value)?.token ?? null;
}
