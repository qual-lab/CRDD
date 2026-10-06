/**
 * project-runtime-durable-foundationに属する責務をまとめる。
 *
 * @responsibility StoreResultを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { normalizeRepositoryRelativePath } from "../../../project-runtime/src/boundary/repository-relative-path.ts";
import { acquireRuntimeOwnedProjectRuntimeStateKernelLock } from "./candidate-store-kernel-lock.ts";
import { readStableBoundedFileSnapshot } from "./bounded-file-snapshot.ts";
import {
  validProjectRuntimeResultRecord,
  type LegacyResultRecord,
  type IntegrationRecordBinding,
} from "./project-runtime-integration-record-adapter.ts";
import {
  historyRow,
  updateProjectRuntimeHistoryOwned,
  inspectProjectRuntimeHistorySettlement,
  type HistoryRow,
} from "./project-runtime-history.ts";
import {
  PROJECT_RUNTIME_ACCEPTANCE_DECISION_STORE_CONTRACT,
  validProjectRuntimeAcceptanceDecisionEnvelope,
  validProjectRuntimeAcceptanceDecisionRecord,
  type ProjectRuntimeAcceptanceDecisionEnvelope,
} from "./project-runtime-acceptance-decision-store.ts";
import { validProjectRuntimeDecisionRecoveryIntent } from "./project-runtime-decision-recovery-store.ts";

import type {
  ProjectQueueEntry,
  ProjectQueueState,
  ProjectRuntimeLease,
  ProjectRuntimeLeaseAcquisitionResolution,
  ProjectRuntimeLeaseKind,
  ProjectRuntimeLeaseOwnerObservation,
  ProjectRuntimeLeasePort,
  ProjectRuntimePersistencePorts,
  ProjectRuntimePortResult,
  ProjectRuntimeState,
  ProjectRuntimeStatePort,
  ProjectRuntimeAcceptanceDecisionStore,
  ProjectRuntimeDecisionRecoveryStore,
  ProjectRuntimeDecisionRecoveryIntent,
  ProjectTaskRecoveryObligation,
} from "../../../project-runtime/src/index.ts";
import {
  PROJECT_RUNTIME_INTEGRATION_CONTRACT,
  type ProjectRuntimeIntegrationRecordPort,
} from "../../../project-runtime/src/index.ts";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
  resolveRepositoryRuntimeDataPaths,
  observeRepositoryRuntimeDataArea,
  type RepositoryRuntimeDataAreaObservation,
} from "../../../runtime-data/src/index.ts";
import {
  verifyRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";

/**
 * 検証済みRootから名前付きPathだけを投影する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns 公開投影または無効Rootのnull。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
function resolveProjectRuntimeNamedPaths(workingDirectory: string) {
  const verified = verifyRepositoryRootFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? resolveRepositoryRuntimeDataPaths(verified.capability)
    : null;
}

/**
 * 既存の名前付き領域をEffect0で観測する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns readyまたは真正不存在のnot_observed。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
function observeProjectRuntimeArea(
  repositoryRoot: string,
  area: "project-runtime" | "tmp",
) {
  const verified = verifyRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed")
    throw new Error("project_runtime_repository_root_invalid");
  const observation = observeRepositoryRuntimeDataArea(
    verified.capability,
    area,
  );
  if (observation.status === "blocked") throw new Error(observation.reason);
  if (
    observation.status === "ready" &&
    observation.repositoryRoot !== repositoryRoot
  )
    throw new Error("project_runtime_repository_root_invalid");
  return observation;
}

/**
 * I/O対象の名前付き領域が現在も成立することを確認する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns 確認済みready観測。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
function assertProjectRuntimeArea(
  repositoryRoot: string,
  area: "project-runtime" | "tmp",
  directory: string,
) {
  const observation = observeProjectRuntimeArea(repositoryRoot, area);
  if (observation.status !== "ready" || observation.directory !== directory)
    throw new Error("project_runtime_storage_boundary_invalid");
  return observation;
}

/**
 * I/O前後の同じ境界観測を照合する。
 * @responsibility Runtime Data Ownerの名前付き境界を利用しprivate Rootを復元しない。
 * @trace ARCH-000004
 * @input 検証するRepository起点と宣言済み領域。
 * @returns N/A: 一致確認のみ。
 * @precondition Callerは既存のRepository/Lease結合を保持する。
 * @postcondition 観測不能を不存在または有効Authorityへ変換しない。
 * @effect VCSとFilesystemを読み取る。初期化、Lock、書込みは0。
 * @failure Root不正、Owner blocked、境界不一致で停止する。
 * @invariant Physical IdentityとRecovery Identityは変更しない。
 * @boundary Coordinator永続基盤からRuntime Data/Version Control公開入口。
 * @security 名前付きPathはAuthorityではなくI/O前の観測を必要とする。
 * @concurrency 観測した現在境界だけを返す。
 */
function assertProjectRuntimeAreaUnchanged(
  repositoryRoot: string,
  area: "project-runtime" | "tmp",
  initial: Exclude<RepositoryRuntimeDataAreaObservation, { status: "blocked" }>,
) {
  const current = observeProjectRuntimeArea(repositoryRoot, area);
  if (
    initial.status !== current.status ||
    (initial.status === "ready" &&
      (current.status !== "ready" ||
        current.directory !== initial.directory ||
        current.boundaryIdentity !== initial.boundaryIdentity))
  )
    throw new Error("project_runtime_storage_boundary_changed");
}

export const PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT =
  "crdd-coordinator/project-runtime-durable-foundation/v1" as const;

/**
 * project-runtime-durable-foundationで使用するStore 結果の値契約を定義する。
 *
 * @responsibility Store 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape StoreResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StoreResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: StoreResultの宣言は外部境界を開かない。
 * @security StoreResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StoreResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type StoreResult<T> = ProjectRuntimePortResult<T>;
/**
 * project-runtime-durable-foundationで使用するLease Kindの値契約を定義する。
 *
 * @responsibility Lease KindのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LeaseKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseKindの宣言は外部境界を開かない。
 * @security LeaseKindはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LeaseKind = ProjectRuntimeLeaseKind;

/**
 * project-runtime-durable-foundationで使用するActive Leaseの値契約を定義する。
 *
 * @responsibility Active LeaseのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ActiveLeaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ActiveLeaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: ActiveLeaseの宣言は外部境界を開かない。
 * @security ActiveLeaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ActiveLeaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ActiveLease = Readonly<{
  repositoryRoot: string;
  repositoryBindingId: string;
  projectId: string;
  queueId: string;
  kind: LeaseKind;
  ownerGeneration: string;
  lock: string;
  recoveryMarker: string;
  acquisitionMarker: string;
  lockOwnershipMarker: string;
  evidenceDirectory: string;
  identity: string;
  snapshotPhysicalIdentity?: string;
}>;

const activeLeases = new WeakMap<ProjectRuntimeLease, ActiveLease>();
const snapshotOwners = new WeakSet<object>();

/**
 * project-runtime-durable-foundationで使用するEnvelopeの値契約を定義する。
 *
 * @responsibility EnvelopeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Envelopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Envelopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: Envelopeの宣言は外部境界を開かない。
 * @security EnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Envelopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Envelope = Readonly<{
  schema: typeof PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT;
  schemaRevision: 1;
  recordKind: "project-state" | "queue-entry" | "lease-evidence";
  repositoryBindingId: string;
  projectId: string;
  createdGeneration: number;
  updatedGeneration: number;
  contentHash: string;
  content: unknown;
}>;

/**
 * 検証済みRepositoryに結合した保存試行用排他を取得する。
 *
 * @responsibility 起動Directoryから同じRootのOS排他へ接続する。
 * @trace ARCH-000004
 * @input workingDirectory: 対象Repository内の起動Directory。
 * @returns 保持確認・解放handle、または停止結果。
 * @precondition WindowsのRepositoryとして一意に解決できる。
 * @postcondition native realpathが取れなければ文字列Pathへfallbackしない。
 * @effect Filesystemを読み、WorkerとOS排他を取得する。保存Fileは作らない。
 * @failure Root不正、観測不能、競合と取得確認不能では停止する。
 * @invariant 排他取得だけで保存・移行・旧Writer停止を主張しない。
 * @boundary Repository検証からWindows短期排他への境界。
 * @security 呼出し元から任意のRoot Hashを受け取らない。
 * @concurrency 同Rootのcase差と配下起動を同じ排他へ結合する。
 */
export function acquireProjectRuntimeSnapshotPilotLock(
  workingDirectory: string,
): StoreResult<
  NonNullable<
    ReturnType<typeof acquireRuntimeOwnedProjectRuntimeStateKernelLock>
  > &
    Readonly<{ repositoryRoot: string; repositoryRootHash: string }>
> {
  try {
    const verified = verifyRepositoryRootFromWorkingDirectory(workingDirectory);
    const repositoryRoot =
      verified.status === "completed"
        ? resolveVerifiedRepositoryRoot(verified.capability)
        : null;
    if (!repositoryRoot || process.platform !== "win32")
      return blocked("project_runtime_snapshot_lock_root_invalid", false);
    const root = fs.realpathSync.native(repositoryRoot);
    assertDirectory(root);
    const identity = digest(
      `crdd-project-runtime-verified-root-v1\0${root.toLowerCase()}`,
    );
    const lock = acquireRuntimeOwnedProjectRuntimeStateKernelLock(identity);
    if (!lock)
      return blocked("project_runtime_snapshot_lock_unavailable", false);
    const owner = Object.freeze({
      ...lock,
      repositoryRoot: root,
      repositoryRootHash: identity,
    });
    snapshotOwners.add(owner);
    return completed("project_runtime_snapshot_lock_acquired", owner);
  } catch {
    return blocked("project_runtime_snapshot_lock_root_invalid", false);
  }
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const REVISION = /^[0-9a-f]{40,64}$/u;
const MAX_RECORD_BYTES = 16 * 1024 * 1024;
const STATE_QUEUE_SNAPSHOT_PILOT_SCHEMA =
  "crdd-coordinator/project-runtime-state-queue-snapshot-pilot/v1";
const SNAPSHOT_SCHEMA = "crdd-coordinator/project-runtime-snapshot/v1";
const SNAPSHOT_SCHEMA_V2 = "crdd-coordinator/project-runtime-snapshot/v2";
const PROJECT_QUEUE_STATES = new Set<ProjectQueueState>([
  "queued",
  "leased",
  "running",
  "waiting_foreground",
  "integration_pending",
  "replan_required",
  "human_decision_required",
  "recovery_required",
  "completed",
  "cancelled",
]);

/**
 * error Codeを決定する。
 *
 * @responsibility error Codeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns errorCodeの計算結果を返す。
 * @precondition 「error: unknown」がerrorCodeの入力契約を満たす。
 * @postcondition errorCodeの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeは独自の失敗分岐を所有しない。
 * @invariant errorCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorCodeはProcess内の同一Subsystemで完結する。
 * @security errorCodeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorCodeは共有非同期状態を持たない同期処理である。
 */
function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : null;
}

/**
 * Keysが完全一致するか判定する。
 *
 * @responsibility Keysの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: object、keys: readonly string[]
 * @returns exactKeysの計算結果を返す。
 * @precondition 「value: object、keys: readonly string[]」がexactKeysの入力契約を満たす。
 * @postcondition exactKeysの責務を完了した結果だけを返す。
 * @effect N/A: exactKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactKeysは独自の失敗分岐を所有しない。
 * @invariant exactKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactKeysはProcess内の同一Subsystemで完結する。
 * @security exactKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactKeysは共有非同期状態を持たない同期処理である。
 */
function exactKeys(value: object, keys: readonly string[]) {
  const actualValues = Object.keys(value).sort();
  const expectedValues = [...keys].sort();
  return (
    actualValues.length === expectedValues.length &&
    actualValues.every((key, index) => key === expectedValues[index])
  );
}

/**
 * ObjectをPlain Dataとして検証する。
 *
 * @responsibility Objectの許可Property、入れ子値、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がplainObjectの入力契約を満たす。
 * @postcondition plainObjectの責務を完了した結果だけを返す。
 * @effect N/A: plainObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: plainObjectは独自の失敗分岐を所有しない。
 * @invariant plainObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: plainObjectはProcess内の同一Subsystemで完結する。
 * @security plainObjectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: plainObjectは共有非同期状態を持たない同期処理である。
 */
function plainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * string Arrayを決定する。
 *
 * @responsibility string Arrayの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximum
 * @returns value is readonly string[]を返す。
 * @precondition 「value: unknown、maximum」がstringArrayの入力契約を満たす。
 * @postcondition stringArrayの責務を完了した結果だけを返す。
 * @effect N/A: stringArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: stringArrayは独自の失敗分岐を所有しない。
 * @invariant stringArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: stringArrayはProcess内の同一Subsystemで完結する。
 * @security stringArrayはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stringArrayは共有非同期状態を持たない同期処理である。
 */
function stringArray(
  value: unknown,
  maximum = 128,
): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every(
      (item) =>
        typeof item === "string" && item.length > 0 && item.length <= 512,
    )
  );
}

/**
 * nullable Idを決定する。
 *
 * @responsibility nullable Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns nullableIdの計算結果を返す。
 * @precondition 「value: unknown」がnullableIdの入力契約を満たす。
 * @postcondition nullableIdの責務を完了した結果だけを返す。
 * @effect N/A: nullableIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nullableIdは独自の失敗分岐を所有しない。
 * @invariant nullableIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nullableIdはProcess内の同一Subsystemで完結する。
 * @security nullableIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nullableIdは共有非同期状態を持たない同期処理である。
 */
function nullableId(value: unknown) {
  return value === null || validId(value);
}

/**
 * nullable 候補 Idを決定する。
 *
 * @responsibility nullable 候補 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns nullableCandidateIdの計算結果を返す。
 * @precondition 「value: unknown」がnullableCandidateIdの入力契約を満たす。
 * @postcondition nullableCandidateIdの責務を完了した結果だけを返す。
 * @effect N/A: nullableCandidateIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nullableCandidateIdは独自の失敗分岐を所有しない。
 * @invariant nullableCandidateIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nullableCandidateIdはProcess内の同一Subsystemで完結する。
 * @security nullableCandidateIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nullableCandidateIdは共有非同期状態を持たない同期処理である。
 */
function nullableCandidateId(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value))
  );
}

/**
 * nullable 回復 Idを決定する。
 *
 * @responsibility nullable 回復 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns nullableRecoveryIdの計算結果を返す。
 * @precondition 「value: unknown」がnullableRecoveryIdの入力契約を満たす。
 * @postcondition nullableRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: nullableRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nullableRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant nullableRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nullableRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security nullableRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nullableRecoveryIdは共有非同期状態を持たない同期処理である。
 */
function nullableRecoveryId(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value))
  );
}

/**
 * recovery Obligationsを決定する。
 *
 * @responsibility recovery Obligationsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is readonly ProjectTaskRecoveryObligation[]を返す。
 * @precondition 「value: unknown」がrecoveryObligationsの入力契約を満たす。
 * @postcondition recoveryObligationsの責務を完了した結果だけを返す。
 * @effect N/A: recoveryObligationsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryObligationsは独自の失敗分岐を所有しない。
 * @invariant recoveryObligationsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryObligationsはProcess内の同一Subsystemで完結する。
 * @security recoveryObligationsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoveryObligationsは共有非同期状態を持たない同期処理である。
 */
function recoveryObligations(
  value: unknown,
): value is readonly ProjectTaskRecoveryObligation[] {
  if (!Array.isArray(value) || value.length > 128) return false;
  const identities = new Set<string>();
  for (const entry of value) {
    const acknowledgementKeys = [
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "taskId",
      "attemptId",
      "operationId",
      "recoveryId",
      "settlementGeneration",
      "runtimeStateBinding",
      "receiptContentHash",
      "receiptContentIdentity",
    ];
    const acknowledgement = entry?.acknowledgement;
    const binding = plainObject(acknowledgement)
      ? acknowledgement.runtimeStateBinding
      : null;
    const isValidAcknowledgement =
      plainObject(acknowledgement) &&
      exactKeys(acknowledgement, acknowledgementKeys) &&
      [
        acknowledgement.repositoryBindingId,
        acknowledgement.projectId,
        acknowledgement.milestoneId,
        acknowledgement.taskId,
        acknowledgement.attemptId,
        acknowledgement.operationId,
      ].every(validId) &&
      nullableRecoveryId(acknowledgement.recoveryId) &&
      acknowledgement.recoveryId !== null &&
      Number.isSafeInteger(acknowledgement.settlementGeneration) &&
      Number(acknowledgement.settlementGeneration) > 0 &&
      plainObject(binding) &&
      exactKeys(binding, [
        "runtimeStateIdentityHash",
        "runtimeStateProtectionHash",
        "localUserBindingHash",
        "runtimeStateBindingHash",
      ]) &&
      Object.values(binding).every(
        (item) => typeof item === "string" && /^[a-f0-9]{64}$/u.test(item),
      ) &&
      typeof acknowledgement.receiptContentHash === "string" &&
      /^[a-f0-9]{64}$/u.test(acknowledgement.receiptContentHash) &&
      typeof acknowledgement.receiptContentIdentity === "string" &&
      acknowledgement.receiptContentIdentity.length > 0 &&
      acknowledgement.receiptContentIdentity.length <= 256;
    if (
      !plainObject(entry) ||
      !exactKeys(
        entry,
        entry.phase === "acknowledged"
          ? ["kind", "recoveryId", "phase", "acknowledgement"]
          : ["kind", "recoveryId", "phase"],
      ) ||
      ![
        "host",
        "docker",
        "candidate",
        "candidate_store",
        "runtime_process",
      ].includes(String(entry.kind)) ||
      !nullableRecoveryId(entry.recoveryId) ||
      entry.recoveryId === null ||
      !["required", "recovering", "settled", "acknowledged"].includes(
        String(entry.phase),
      ) ||
      (entry.phase === "acknowledged" &&
        (entry.kind !== "docker" ||
          !isValidAcknowledgement ||
          acknowledgement.recoveryId !== entry.recoveryId))
    )
      return false;
    const identity = `${entry.kind}\0${entry.recoveryId}`;
    if (identities.has(identity)) return false;
    identities.add(identity);
  }
  return true;
}

// Queue results may carry an exact opaque candidate or recovery reference.
// These references use the same closed character set as stable IDs, but can
// exceed the 128-character limit of ordinary project-local identifiers.
/**
 * 結果 Referenceが有効か判定する。
 *
 * @responsibility 結果 Referenceの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidResultReferenceの入力契約を満たす。
 * @postcondition validResultReferenceの責務を完了した結果だけを返す。
 * @effect N/A: validResultReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validResultReferenceは独自の失敗分岐を所有しない。
 * @invariant validResultReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validResultReferenceはProcess内の同一Subsystemで完結する。
 * @security validResultReferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validResultReferenceは共有非同期状態を持たない同期処理である。
 */
function validResultReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * nullable 結果 Referenceを決定する。
 *
 * @responsibility nullable 結果 Referenceの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns nullableResultReferenceの計算結果を返す。
 * @precondition 「value: unknown」がnullableResultReferenceの入力契約を満たす。
 * @postcondition nullableResultReferenceの責務を完了した結果だけを返す。
 * @effect N/A: nullableResultReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nullableResultReferenceは独自の失敗分岐を所有しない。
 * @invariant nullableResultReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nullableResultReferenceはProcess内の同一Subsystemで完結する。
 * @security nullableResultReferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nullableResultReferenceは共有非同期状態を持たない同期処理である。
 */
function nullableResultReference(value: unknown) {
  return value === null || validResultReference(value);
}

/**
 * Task Lifecycle Tupleが有効か判定する。
 *
 * @responsibility Task Lifecycle Tupleの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input task: ProjectRuntimeState["tasks"][number]
 * @returns validTaskLifecycleTupleの計算結果を返す。
 * @precondition 「task: ProjectRuntimeState["tasks"][number]」がvalidTaskLifecycleTupleの入力契約を満たす。
 * @postcondition validTaskLifecycleTupleの責務を完了した結果だけを返す。
 * @effect N/A: validTaskLifecycleTupleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTaskLifecycleTupleは独自の失敗分岐を所有しない。
 * @invariant validTaskLifecycleTupleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validTaskLifecycleTupleはProcess内の同一Subsystemで完結する。
 * @security validTaskLifecycleTupleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validTaskLifecycleTupleは共有非同期状態を持たない同期処理である。
 */
function validTaskLifecycleTuple(task: ProjectRuntimeState["tasks"][number]) {
  const isAttempt = task.attemptId !== null;
  const isOperation = task.operationId !== null;
  const isAuthority = task.authorityBindingId !== null;
  if (["planned", "waiting_dependency", "ready"].includes(task.state))
    return (
      task.startPhase === "none" && !isAttempt && !isOperation && !isAuthority
    );
  if (task.state === "starting" && task.startPhase === "reserved")
    return isAttempt && !isOperation && isAuthority;
  if (task.state === "starting" && task.startPhase === "handoff_prepared")
    return isAttempt && isOperation && isAuthority;
  if (task.state === "running")
    return (
      task.startPhase === "running" && isAttempt && isOperation && isAuthority
    );
  if (
    [
      "cleanup_pending",
      "completed",
      "failed",
      "cancelled",
      "recovery_required",
      "superseded",
    ].includes(task.state)
  )
    return (
      task.startPhase === "settled" && isAttempt && isOperation && isAuthority
    );
  return false;
}

/**
 * Project Runtime 状態が有効か判定する。
 *
 * @responsibility Project Runtime 状態の有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is ProjectRuntimeStateを返す。
 * @precondition 「value: unknown」がvalidProjectRuntimeStateの入力契約を満たす。
 * @postcondition validProjectRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: validProjectRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validProjectRuntimeStateは独自の失敗分岐を所有しない。
 * @invariant validProjectRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validProjectRuntimeStateはProcess内の同一Subsystemで完結する。
 * @security validProjectRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validProjectRuntimeStateは共有非同期状態を持たない同期処理である。
 */
function validProjectRuntimeState(
  value: unknown,
): value is ProjectRuntimeState {
  if (
    !plainObject(value) ||
    !exactKeys(value, [
      "contract",
      "projectId",
      "milestoneId",
      "repositoryRevision",
      "generation",
      "ownerGeneration",
      "decisionApplicationId",
      "maximumConcurrency",
      "milestone",
      "objectives",
      "tasks",
    ]) ||
    value.contract !== "crdd-coordinator/project-runtime-state/v1" ||
    !validId(value.projectId) ||
    !validId(value.milestoneId) ||
    typeof value.repositoryRevision !== "string" ||
    !REVISION.test(value.repositoryRevision) ||
    !Number.isSafeInteger(value.generation) ||
    Number(value.generation) < 1 ||
    !validId(value.ownerGeneration) ||
    !nullableId(value.decisionApplicationId) ||
    !Number.isSafeInteger(value.maximumConcurrency) ||
    Number(value.maximumConcurrency) < 1 ||
    Number(value.maximumConcurrency) > 5 ||
    !plainObject(value.milestone) ||
    !exactKeys(value.milestone, [
      "id",
      "acceptanceCriteria",
      "state",
      "criterionEvidenceIds",
    ]) ||
    value.milestone.id !== value.milestoneId ||
    !stringArray(value.milestone.acceptanceCriteria) ||
    !stringArray(value.milestone.criterionEvidenceIds) ||
    !new Set([
      "planned",
      "executing",
      "integrating",
      "human_decision_required",
      "recovery_required",
      "accepted",
      "returned",
      "cancelled",
    ]).has(String(value.milestone.state)) ||
    !Array.isArray(value.objectives) ||
    value.objectives.length < 1 ||
    value.objectives.length > 128 ||
    !Array.isArray(value.tasks) ||
    value.tasks.length < 1 ||
    value.tasks.length > 1024
  )
    return false;

  const objectiveIds = new Set<string>();
  for (const objective of value.objectives) {
    if (
      !plainObject(objective) ||
      !exactKeys(objective, ["definition", "state", "criterionEvidenceIds"]) ||
      !plainObject(objective.definition) ||
      !exactKeys(objective.definition, ["id", "acceptanceCriteria"]) ||
      !validId(objective.definition.id) ||
      objectiveIds.has(objective.definition.id) ||
      !stringArray(objective.definition.acceptanceCriteria) ||
      !stringArray(objective.criterionEvidenceIds) ||
      !new Set([
        "planned",
        "executing",
        "integration_pending",
        "accepted",
        "returned",
        "blocked",
        "cancelled",
      ]).has(String(objective.state))
    )
      return false;
    objectiveIds.add(objective.definition.id);
  }

  const taskIds = new Set<string>();
  const dependencies: Array<readonly string[]> = [];
  for (const task of value.tasks) {
    const definition = plainObject(task) ? task.definition : null;
    const taskDependencies = plainObject(definition)
      ? definition.dependencies
      : null;
    const allowedPaths = plainObject(definition)
      ? definition.allowedPaths
      : null;
    const conflictKeys = plainObject(definition)
      ? definition.conflictKeys
      : null;
    if (
      !plainObject(task) ||
      !exactKeys(task, [
        "definition",
        "state",
        "attemptId",
        "operationId",
        "authorityBindingId",
        "startPhase",
        "cleanupConfirmed",
        "recoveryObligations",
        "recoveryUnresolved",
        "candidateId",
        "retryCount",
        "supersededBy",
      ]) ||
      !plainObject(task.definition) ||
      !exactKeys(task.definition, [
        "id",
        "objectiveId",
        "dependencies",
        "allowedPaths",
        "conflictKeys",
      ]) ||
      !validId(task.definition.id) ||
      taskIds.has(task.definition.id) ||
      !validId(task.definition.objectiveId) ||
      !objectiveIds.has(task.definition.objectiveId) ||
      !stringArray(taskDependencies) ||
      !stringArray(allowedPaths) ||
      allowedPaths.length < 1 ||
      !stringArray(conflictKeys) ||
      !new Set([
        "planned",
        "waiting_dependency",
        "ready",
        "starting",
        "running",
        "cleanup_pending",
        "completed",
        "failed",
        "cancelled",
        "recovery_required",
        "superseded",
      ]).has(String(task.state)) ||
      !nullableId(task.attemptId) ||
      !nullableId(task.operationId) ||
      !nullableId(task.authorityBindingId) ||
      !["none", "reserved", "handoff_prepared", "running", "settled"].includes(
        String(task.startPhase),
      ) ||
      typeof task.cleanupConfirmed !== "boolean" ||
      !recoveryObligations(task.recoveryObligations) ||
      typeof task.recoveryUnresolved !== "boolean" ||
      (task.state === "recovery_required" &&
        task.recoveryObligations.length === 0 &&
        task.recoveryUnresolved !== true) ||
      (task.state !== "recovery_required" &&
        task.recoveryUnresolved === true) ||
      (task.state === "ready" &&
        task.recoveryObligations.some(
          (entry) =>
            entry.phase !==
            (entry.kind === "docker" ? "acknowledged" : "settled"),
        )) ||
      (!["ready", "recovery_required"].includes(String(task.state)) &&
        task.recoveryObligations.length > 0) ||
      !validTaskLifecycleTuple(
        task as unknown as ProjectRuntimeState["tasks"][number],
      ) ||
      !nullableCandidateId(task.candidateId) ||
      !Number.isSafeInteger(task.retryCount) ||
      Number(task.retryCount) < 0 ||
      !nullableId(task.supersededBy)
    )
      return false;
    taskIds.add(task.definition.id);
    dependencies.push(taskDependencies as readonly string[]);
  }
  return dependencies.every((items) => items.every((id) => taskIds.has(id)));
}

/**
 * Queue Entryが有効か判定する。
 *
 * @responsibility Queue Entryの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is ProjectQueueEntryを返す。
 * @precondition 「value: unknown」がvalidQueueEntryの入力契約を満たす。
 * @postcondition validQueueEntryの責務を完了した結果だけを返す。
 * @effect N/A: validQueueEntryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validQueueEntryは独自の失敗分岐を所有しない。
 * @invariant validQueueEntryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validQueueEntryはProcess内の同一Subsystemで完結する。
 * @security validQueueEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validQueueEntryは共有非同期状態を持たない同期処理である。
 */
function validQueueEntry(value: unknown): value is ProjectQueueEntry {
  return (
    plainObject(value) &&
    exactKeys(value, [
      "queueId",
      "projectId",
      "milestoneId",
      "requestHash",
      "originLane",
      "repositoryRevision",
      "scopeHash",
      "state",
      "generation",
      "ownerGeneration",
      "resumeCondition",
      "resultReference",
    ]) &&
    validId(value.queueId) &&
    validId(value.projectId) &&
    validId(value.milestoneId) &&
    typeof value.requestHash === "string" &&
    HASH.test(value.requestHash) &&
    (value.originLane === "interactive" || value.originLane === "scheduled") &&
    typeof value.repositoryRevision === "string" &&
    REVISION.test(value.repositoryRevision) &&
    typeof value.scopeHash === "string" &&
    HASH.test(value.scopeHash) &&
    PROJECT_QUEUE_STATES.has(value.state as ProjectQueueState) &&
    Number.isSafeInteger(value.generation) &&
    Number(value.generation) >= 1 &&
    nullableId(value.ownerGeneration) &&
    nullableId(value.resumeCondition) &&
    nullableResultReference(value.resultReference)
  );
}

/**
 * Lease Evidenceが有効か判定する。
 *
 * @responsibility Lease Evidenceの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns validLeaseEvidenceの計算結果を返す。
 * @precondition 「value: unknown」がvalidLeaseEvidenceの入力契約を満たす。
 * @postcondition validLeaseEvidenceの責務を完了した結果だけを返す。
 * @effect N/A: validLeaseEvidenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validLeaseEvidenceは独自の失敗分岐を所有しない。
 * @invariant validLeaseEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validLeaseEvidenceはProcess内の同一Subsystemで完結する。
 * @security validLeaseEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validLeaseEvidenceは共有非同期状態を持たない同期処理である。
 */
function validLeaseEvidence(value: unknown) {
  return (
    plainObject(value) &&
    exactKeys(value, [
      "kind",
      "queueId",
      "ownerGeneration",
      "ownerProcessId",
      "disposition",
    ]) &&
    (value.kind === "project-operation" ||
      value.kind === "canonical-adoption") &&
    validId(value.queueId) &&
    validId(value.ownerGeneration) &&
    Number.isSafeInteger(value.ownerProcessId) &&
    Number(value.ownerProcessId) > 0 &&
    (value.disposition === "acquired" ||
      value.disposition === "released" ||
      value.disposition === "recovered_after_owner_loss" ||
      value.disposition === "acquisition_unknown_closed")
  );
}

/**
 * completedを決定する。
 *
 * @responsibility completedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input reason: string、value: T
 * @returns StoreResult<T>を返す。
 * @precondition 「reason: string、value: T」がcompletedの入力契約を満たす。
 * @postcondition completedの責務を完了した結果だけを返す。
 * @effect N/A: completedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: completedは独自の失敗分岐を所有しない。
 * @invariant completedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: completedはProcess内の同一Subsystemで完結する。
 * @security completedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: completedは共有非同期状態を持たない同期処理である。
 */
function completed<T>(reason: string, value: T): StoreResult<T> {
  return Object.freeze({ status: "completed", reason, value });
}

/**
 * project-runtime-durable-foundationを停止結果として構築する。
 *
 * @responsibility project-runtime-durable-foundationの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: string、manualRecoveryRequired、recoveryId: string | null
 * @returns StoreResult<T>を返す。
 * @precondition 「reason: string、manualRecoveryRequired、recoveryId: string | null」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked<T>(
  reason: string,
  manualRecoveryRequired = false,
  recoveryId: string | null = null,
): StoreResult<T> {
  return Object.freeze({
    status: "blocked",
    reason,
    value: null,
    manualRecoveryRequired,
    recoveryId,
  });
}

/**
 * project-runtime-durable-foundationで使用するLease Acquisition Markerの値契約を定義する。
 *
 * @responsibility Lease Acquisition MarkerのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LeaseAcquisitionMarkerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseAcquisitionMarkerで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseAcquisitionMarkerの宣言は外部境界を開かない。
 * @security LeaseAcquisitionMarkerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseAcquisitionMarkerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LeaseAcquisitionMarker = Readonly<{
  kind: LeaseKind;
  queueId: string;
  ownerGeneration: string;
  ownerProcessId: number;
  recoveryId: string;
}>;

/**
 * lease Acquisition 回復 Idを決定する。
 *
 * @responsibility lease Acquisition 回復 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind
 * @returns leaseAcquisitionRecoveryIdの計算結果を返す。
 * @precondition 「repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind」がleaseAcquisitionRecoveryIdの入力契約を満たす。
 * @postcondition leaseAcquisitionRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseAcquisitionRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant leaseAcquisitionRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionRecoveryIdは共有非同期状態を持たない同期処理である。
 */
function leaseAcquisitionRecoveryId(
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
) {
  const identityInput =
    kind === "project-operation"
      ? `${repositoryBindingId}\0${kind}`
      : kind === "canonical-adoption"
        ? `${repositoryBindingId}\0${projectId}\0${kind}`
        : `${repositoryBindingId}\0${projectId}\0${queueId}\0${kind}`;
  return `lease-acquisition-${digest(identityInput).slice(0, 40)}`;
}

/**
 * lease Identityを決定する。
 *
 * @responsibility lease Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind
 * @returns leaseIdentityの計算結果を返す。
 * @precondition 「repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind」がleaseIdentityの入力契約を満たす。
 * @postcondition leaseIdentityの責務を完了した結果だけを返す。
 * @effect N/A: leaseIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseIdentityは独自の失敗分岐を所有しない。
 * @invariant leaseIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseIdentityはProcess内の同一Subsystemで完結する。
 * @security leaseIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseIdentityは共有非同期状態を持たない同期処理である。
 */
function leaseIdentity(
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
) {
  return kind === "project-operation"
    ? `${kind}-${repositoryBindingId}`
    : kind === "canonical-adoption"
      ? `${kind}-${repositoryBindingId}-${projectId}`
      : `${kind}-${projectId}-${queueId}`;
}

/**
 * lease Acquisition Temporary Prefixを決定する。
 *
 * @responsibility lease Acquisition Temporary Prefixの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input identity: string
 * @returns leaseAcquisitionTemporaryPrefixの計算結果を返す。
 * @precondition 「identity: string」がleaseAcquisitionTemporaryPrefixの入力契約を満たす。
 * @postcondition leaseAcquisitionTemporaryPrefixの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionTemporaryPrefixは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseAcquisitionTemporaryPrefixは独自の失敗分岐を所有しない。
 * @invariant leaseAcquisitionTemporaryPrefixは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionTemporaryPrefixはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionTemporaryPrefixはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionTemporaryPrefixは共有非同期状態を持たない同期処理である。
 */
function leaseAcquisitionTemporaryPrefix(identity: string) {
  return `.pending-${identity}-acquisition-`;
}

/**
 * lease Acquisition Temporary Filesを決定する。
 *
 * @responsibility lease Acquisition Temporary Filesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input directory: string、identity: string
 * @returns leaseAcquisitionTemporaryFilesの計算結果を返す。
 * @precondition 「directory: string、identity: string」がleaseAcquisitionTemporaryFilesの入力契約を満たす。
 * @postcondition leaseAcquisitionTemporaryFilesの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionTemporaryFilesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure leaseAcquisitionTemporaryFilesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant leaseAcquisitionTemporaryFilesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionTemporaryFilesはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionTemporaryFilesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionTemporaryFilesは共有非同期状態を持たない同期処理である。
 */
function leaseAcquisitionTemporaryFiles(directory: string, identity: string) {
  assertDirectory(directory);
  const prefix = leaseAcquisitionTemporaryPrefix(identity);
  const names = fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(prefix));
  if (names.some((name) => !name.endsWith(".tmp")))
    throw new Error("project_runtime_lease_acquisition_inventory_invalid");
  return Object.freeze(names);
}

/**
 * path Confirmed Absentを決定する。
 *
 * @responsibility path Confirmed Absentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: string
 * @returns pathConfirmedAbsentの計算結果を返す。
 * @precondition 「candidate: string」がpathConfirmedAbsentの入力契約を満たす。
 * @postcondition pathConfirmedAbsentの責務を完了した結果だけを返す。
 * @effect pathConfirmedAbsentはFilesystemの読取りまたは書込みを実行する。
 * @failure pathConfirmedAbsentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant pathConfirmedAbsentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security pathConfirmedAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: pathConfirmedAbsentは共有非同期状態を持たない同期処理である。
 */
function pathConfirmedAbsent(candidate: string) {
  try {
    fs.lstatSync(candidate);
    return false;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return true;
    throw error;
  }
}

/**
 * lease Acquisition Footprint Absentを決定する。
 *
 * @responsibility lease Acquisition Footprint Absentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input directory: string、identity: string、paths: readonly string[]
 * @returns leaseAcquisitionFootprintAbsentの計算結果を返す。
 * @precondition 「directory: string、identity: string、paths: readonly string[]」がleaseAcquisitionFootprintAbsentの入力契約を満たす。
 * @postcondition leaseAcquisitionFootprintAbsentの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionFootprintAbsentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseAcquisitionFootprintAbsentは独自の失敗分岐を所有しない。
 * @invariant leaseAcquisitionFootprintAbsentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionFootprintAbsentはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionFootprintAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionFootprintAbsentは共有非同期状態を持たない同期処理である。
 */
function leaseAcquisitionFootprintAbsent(
  directory: string,
  identity: string,
  paths: readonly string[],
) {
  return (
    paths.every(pathConfirmedAbsent) &&
    leaseAcquisitionTemporaryFiles(directory, identity).length === 0
  );
}

/**
 * Lease Acquisition Markerを読み取る。
 *
 * @responsibility Lease Acquisition Markerの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input marker: string
 * @returns LeaseAcquisitionMarkerを返す。
 * @precondition 「marker: string」がreadLeaseAcquisitionMarkerの入力契約を満たす。
 * @postcondition readLeaseAcquisitionMarkerの責務を完了した結果だけを返す。
 * @effect readLeaseAcquisitionMarkerはFilesystemの読取りまたは書込みを実行する。
 * @failure readLeaseAcquisitionMarkerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readLeaseAcquisitionMarkerは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readLeaseAcquisitionMarkerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readLeaseAcquisitionMarkerは共有非同期状態を持たない同期処理である。
 */
function readLeaseAcquisitionMarker(marker: string): LeaseAcquisitionMarker {
  const parsed: unknown = JSON.parse(fs.readFileSync(marker, "utf8"));
  if (
    !plainObject(parsed) ||
    !exactKeys(parsed, [
      "kind",
      "queueId",
      "ownerGeneration",
      "ownerProcessId",
      "recoveryId",
    ]) ||
    (parsed.kind !== "project-operation" &&
      parsed.kind !== "canonical-adoption") ||
    !validId(parsed.queueId) ||
    !validId(parsed.ownerGeneration) ||
    !Number.isSafeInteger(parsed.ownerProcessId) ||
    Number(parsed.ownerProcessId) < 1 ||
    !validId(parsed.recoveryId)
  )
    throw new Error("project_runtime_lease_acquisition_marker_invalid");
  return Object.freeze({
    kind: parsed.kind,
    queueId: parsed.queueId,
    ownerGeneration: parsed.ownerGeneration,
    ownerProcessId: Number(parsed.ownerProcessId),
    recoveryId: parsed.recoveryId,
  });
}

/**
 * Lease Acquisition Markerを構築する。
 *
 * @responsibility Lease Acquisition Markerの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input directory: string、identity: string、value: LeaseAcquisitionMarker
 * @returns N/A: createLeaseAcquisitionMarkerは戻り値を返さない。
 * @precondition 「directory: string、identity: string、value: LeaseAcquisitionMarker」がcreateLeaseAcquisitionMarkerの入力契約を満たす。
 * @postcondition createLeaseAcquisitionMarkerの責務を完了して呼出し元へ制御を戻す。
 * @effect createLeaseAcquisitionMarkerはFilesystemの読取りまたは書込みを実行する。
 * @failure createLeaseAcquisitionMarkerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createLeaseAcquisitionMarkerは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createLeaseAcquisitionMarkerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createLeaseAcquisitionMarkerは共有非同期状態を持たない同期処理である。
 */
function createLeaseAcquisitionMarker(
  directory: string,
  identity: string,
  value: LeaseAcquisitionMarker,
) {
  const marker = path.join(directory, `${identity}.acquire-pending`);
  const temporary = path.join(
    directory,
    `${leaseAcquisitionTemporaryPrefix(identity)}${process.pid}-${value.ownerGeneration}-${randomUUID()}.tmp`,
  );
  const bytes = `${JSON.stringify(value)}\n`;
  let descriptor: number | null = null;
  let isPublished = false;
  try {
    descriptor = fs.openSync(
      temporary,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      0o600,
    );
    fs.writeFileSync(descriptor, bytes, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    if (fs.readFileSync(temporary, "utf8") !== bytes)
      throw new Error("project_runtime_lease_acquisition_marker_mismatch");
    const prepared = readLeaseAcquisitionMarker(temporary);
    if (
      prepared.kind !== value.kind ||
      prepared.queueId !== value.queueId ||
      prepared.ownerGeneration !== value.ownerGeneration ||
      prepared.ownerProcessId !== value.ownerProcessId ||
      prepared.recoveryId !== value.recoveryId
    )
      throw new Error("project_runtime_lease_acquisition_marker_mismatch");
    try {
      fs.linkSync(temporary, marker);
    } catch (error) {
      if (errorCode(error) === "EEXIST" || fs.existsSync(marker)) {
        const contention = new Error("project_runtime_lease_unavailable");
        Object.defineProperty(contention, "code", { value: "EEXIST" });
        throw contention;
      }
      throw error;
    }
    isPublished = true;
    if (fs.readFileSync(marker, "utf8") !== bytes)
      throw new Error("project_runtime_lease_acquisition_marker_mismatch");
  } catch (error) {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (!isPublished) {
      try {
        fs.rmSync(temporary, { force: true });
      } catch {}
    }
    throw error;
  }
  fs.rmSync(temporary);
  if (fs.existsSync(temporary))
    throw new Error(
      "project_runtime_lease_acquisition_temporary_release_unknown",
    );
  const observed = readLeaseAcquisitionMarker(marker);
  if (
    observed.kind !== value.kind ||
    observed.queueId !== value.queueId ||
    observed.ownerGeneration !== value.ownerGeneration ||
    observed.ownerProcessId !== value.ownerProcessId ||
    observed.recoveryId !== value.recoveryId
  )
    throw new Error("project_runtime_lease_acquisition_marker_mismatch");
}

/**
 * Lease Lock Ownership Markerを構築する。
 *
 * @responsibility Lease Lock Ownership Markerの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input marker: string、value: LeaseAcquisitionMarker
 * @returns N/A: createLeaseLockOwnershipMarkerは戻り値を返さない。
 * @precondition 「marker: string、value: LeaseAcquisitionMarker」がcreateLeaseLockOwnershipMarkerの入力契約を満たす。
 * @postcondition createLeaseLockOwnershipMarkerの責務を完了して呼出し元へ制御を戻す。
 * @effect createLeaseLockOwnershipMarkerはFilesystemの読取りまたは書込みを実行する。
 * @failure createLeaseLockOwnershipMarkerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createLeaseLockOwnershipMarkerは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createLeaseLockOwnershipMarkerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createLeaseLockOwnershipMarkerは共有非同期状態を持たない同期処理である。
 */
function createLeaseLockOwnershipMarker(
  marker: string,
  value: LeaseAcquisitionMarker,
) {
  const descriptor = fs.openSync(
    marker,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
    0o600,
  );
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  const observed = readLeaseAcquisitionMarker(marker);
  if (
    observed.kind !== value.kind ||
    observed.queueId !== value.queueId ||
    observed.ownerGeneration !== value.ownerGeneration ||
    observed.ownerProcessId !== value.ownerProcessId ||
    observed.recoveryId !== value.recoveryId
  )
    throw new Error("project_runtime_lease_lock_ownership_marker_mismatch");
}

/**
 * project-runtime-durable-foundationのHashを算出する。
 *
 * @responsibility project-runtime-durable-foundationの入力byte列、Hash algorithm、算出結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: string
 * @returns digestの計算結果を返す。
 * @precondition 「value: string」がdigestの入力契約を満たす。
 * @postcondition digestの責務を完了した結果だけを返す。
 * @effect N/A: digestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: digestは独自の失敗分岐を所有しない。
 * @invariant digestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: digestはProcess内の同一Subsystemで完結する。
 * @security digestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: digestは共有非同期状態を持たない同期処理である。
 */
function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Idが有効か判定する。
 *
 * @responsibility Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidIdの入力契約を満たす。
 * @postcondition validIdの責務を完了した結果だけを返す。
 * @effect N/A: validIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdは独自の失敗分岐を所有しない。
 * @invariant validIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdはProcess内の同一Subsystemで完結する。
 * @security validIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validIdは共有非同期状態を持たない同期処理である。
 */
function validId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

/**
 * Directoryを表明どおりか検査する。
 *
 * @responsibility Directoryの必須条件と違反時の停止境界を所有する。
 * @trace ARCH-000004
 * @input directory: string
 * @returns N/A: assertDirectoryは戻り値を返さない。
 * @precondition 「directory: string」がassertDirectoryの入力契約を満たす。
 * @postcondition assertDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect assertDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure assertDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant assertDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security assertDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: assertDirectoryは共有非同期状態を持たない同期処理である。
 */
function assertDirectory(directory: string) {
  const metadata = fs.lstatSync(directory);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(directory) !== directory
  ) {
    throw new Error("project_runtime_storage_boundary_invalid");
  }
}

/**
 * Directoryが成立する状態を確保する。
 *
 * @responsibility Directoryの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000004
 * @input parent: string、name: string
 * @returns ensureDirectoryの計算結果を返す。
 * @precondition 「parent: string、name: string」がensureDirectoryの入力契約を満たす。
 * @postcondition ensureDirectoryの責務を完了した結果だけを返す。
 * @effect ensureDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure ensureDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security ensureDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ensureDirectoryは共有非同期状態を持たない同期処理である。
 */
function ensureDirectory(parent: string, name: string) {
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(name) || name === "." || name === "..")
    throw new Error("project_runtime_storage_identity_invalid");
  const target = path.join(parent, name);
  try {
    fs.mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if (
      !(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "EEXIST"
      )
    )
      throw error;
  }
  assertDirectory(target);
  if (path.dirname(target) !== parent)
    throw new Error("project_runtime_storage_boundary_invalid");
  return target;
}

/**
 * storage Rootを決定する。
 *
 * @responsibility storage Rootの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string
 * @returns storageRootの計算結果を返す。
 * @precondition 「workingDirectory: string」がstorageRootの入力契約を満たす。
 * @postcondition storageRootの責務を完了した結果だけを返す。
 * @effect N/A: storageRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: storageRootは独自の失敗分岐を所有しない。
 * @invariant storageRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: storageRootはProcess内の同一Subsystemで完結する。
 * @security storageRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: storageRootは共有非同期状態を持たない同期処理である。
 */
function storageRoot(workingDirectory: string) {
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      workingDirectory,
      "project-runtime",
    ),
    "project_runtime_repository_root_invalid",
  );
  const repositoryRoot = area.repositoryRoot;
  assertDirectory(repositoryRoot);
  const runtime = area.directory;
  assertDirectory(runtime);
  return Object.freeze({ repositoryRoot, runtime });
}

/**
 * lock Rootを決定する。
 *
 * @responsibility lock Rootの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input runtime: string
 * @returns lockRootの計算結果を返す。
 * @precondition 「runtime: string」がlockRootの入力契約を満たす。
 * @postcondition lockRootの責務を完了した結果だけを返す。
 * @effect N/A: lockRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: lockRootは独自の失敗分岐を所有しない。
 * @invariant lockRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: lockRootはProcess内の同一Subsystemで完結する。
 * @security lockRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: lockRootは共有非同期状態を持たない同期処理である。
 */
function lockRoot(runtime: string) {
  return ensureDirectory(ensureDirectory(runtime, "work"), "locks");
}

/**
 * lease Evidence Rootを決定する。
 *
 * @responsibility lease Evidence Rootの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input runtime: string
 * @returns leaseEvidenceRootの計算結果を返す。
 * @precondition 「runtime: string」がleaseEvidenceRootの入力契約を満たす。
 * @postcondition leaseEvidenceRootの責務を完了した結果だけを返す。
 * @effect N/A: leaseEvidenceRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseEvidenceRootは独自の失敗分岐を所有しない。
 * @invariant leaseEvidenceRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseEvidenceRootはProcess内の同一Subsystemで完結する。
 * @security leaseEvidenceRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseEvidenceRootは共有非同期状態を持たない同期処理である。
 */
function leaseEvidenceRoot(runtime: string) {
  return ensureDirectory(ensureDirectory(runtime, "recovery"), "leases");
}

/**
 * Lease Is Observedが有効な状態か判定する。
 *
 * @responsibility Lease Is Observedの有効状態条件と判定結果境界を所有する。
 * @trace ARCH-000004
 * @input activeLease: ActiveLease
 * @returns activeLeaseIsObservedの計算結果を返す。
 * @precondition 「activeLease: ActiveLease」がactiveLeaseIsObservedの入力契約を満たす。
 * @postcondition activeLeaseIsObservedの責務を完了した結果だけを返す。
 * @effect activeLeaseIsObservedはFilesystemの読取りまたは書込みを実行する。
 * @failure activeLeaseIsObservedは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant activeLeaseIsObservedは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security activeLeaseIsObservedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: activeLeaseIsObservedは共有非同期状態を持たない同期処理である。
 */
function activeLeaseIsObserved(activeLease: ActiveLease) {
  try {
    assertDirectory(activeLease.lock);
    if (activeLease.snapshotPhysicalIdentity !== undefined) {
      const paths = resolveProjectRuntimeNamedPaths(activeLease.repositoryRoot);
      if (!paths) return false;
      const boundary = assertProjectRuntimeArea(
        activeLease.repositoryRoot,
        "tmp",
        paths.temporary,
      );
      for (const directory of [
        activeLease.repositoryRoot,
        boundary.directory,
        path.dirname(activeLease.lock),
      ]) {
        assertDirectory(directory);
        if (fs.realpathSync.native(directory) !== directory) return false;
      }
      const metadata = fs.lstatSync(activeLease.lock);
      assertProjectRuntimeAreaUnchanged(
        activeLease.repositoryRoot,
        "tmp",
        boundary,
      );
      return (
        digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        ) === activeLease.snapshotPhysicalIdentity
      );
    }
    return !fs.existsSync(activeLease.recoveryMarker);
  } catch {
    return false;
  }
}

/**
 * envelopeを決定する。
 *
 * @responsibility envelopeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input recordKind: Envelope["recordKind"]、repositoryBindingId: string、projectId: string、createdGeneration: number、updatedGeneration: number、content: unknown
 * @returns Envelopeを返す。
 * @precondition 「recordKind: Envelope["recordKind"]、repositoryBindingId: string、projectId: string、createdGeneration: number、updatedGeneration: number、content: unknown」がenvelopeの入力契約を満たす。
 * @postcondition envelopeの責務を完了した結果だけを返す。
 * @effect N/A: envelopeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure envelopeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant envelopeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: envelopeはProcess内の同一Subsystemで完結する。
 * @security envelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: envelopeは共有非同期状態を持たない同期処理である。
 */
function envelope(
  recordKind: Envelope["recordKind"],
  repositoryBindingId: string,
  projectId: string,
  createdGeneration: number,
  updatedGeneration: number,
  content: unknown,
): Envelope {
  if (
    (recordKind === "project-state" && !validProjectRuntimeState(content)) ||
    (recordKind === "queue-entry" && !validQueueEntry(content)) ||
    (recordKind === "lease-evidence" && !validLeaseEvidence(content))
  )
    throw new Error("project_runtime_record_content_invalid");
  const serialized = JSON.stringify(content);
  const record = Object.freeze({
    schema: PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT,
    schemaRevision: 1 as const,
    recordKind,
    repositoryBindingId,
    projectId,
    createdGeneration,
    updatedGeneration,
    contentHash: digest(serialized),
    content,
  });
  return record;
}

/**
 * storage Bytesを決定する。
 *
 * @responsibility storage Bytesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: Envelope
 * @returns storageBytesの計算結果を返す。
 * @precondition 「value: Envelope」がstorageBytesの入力契約を満たす。
 * @postcondition storageBytesの責務を完了した結果だけを返す。
 * @effect N/A: storageBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure storageBytesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant storageBytesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: storageBytesはProcess内の同一Subsystemで完結する。
 * @security storageBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: storageBytesは共有非同期状態を持たない同期処理である。
 */
function storageBytes(value: Envelope) {
  const bytes = `${JSON.stringify(value)}\n`;
  if (Buffer.byteLength(bytes, "utf8") > MAX_RECORD_BYTES)
    throw new Error("project_runtime_record_too_large");
  return bytes;
}

/**
 * atomic Create And Read Backを決定する。
 *
 * @responsibility atomic Create And Read Backの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input directory: string、name: string、value: Envelope
 * @returns N/A: atomicCreateAndReadBackは戻り値を返さない。
 * @precondition 「directory: string、name: string、value: Envelope」がatomicCreateAndReadBackの入力契約を満たす。
 * @postcondition atomicCreateAndReadBackの責務を完了して呼出し元へ制御を戻す。
 * @effect atomicCreateAndReadBackはFilesystemの読取りまたは書込みを実行する。
 * @failure atomicCreateAndReadBackは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant atomicCreateAndReadBackは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security atomicCreateAndReadBackはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: atomicCreateAndReadBackは共有非同期状態を持たない同期処理である。
 */
function atomicCreateAndReadBack(
  directory: string,
  name: string,
  value: Envelope,
) {
  const destination = path.join(directory, name);
  const temporary = path.join(directory, `.pending-${randomUUID()}.tmp`);
  const bytes = storageBytes(value);
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(
      temporary,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      0o600,
    );
    fs.writeFileSync(descriptor, bytes, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporary, destination);
    const observed = fs.readFileSync(destination, "utf8");
    if (observed !== bytes)
      throw new Error("project_runtime_record_readback_mismatch");
  } catch (error) {
    if (descriptor !== null) fs.closeSync(descriptor);
    try {
      fs.rmSync(temporary, { force: true });
    } catch {}
    throw error;
  }
}

/**
 * Envelope Fileを読み取る。
 *
 * @responsibility Envelope Fileの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input directory: string、name: string
 * @returns Envelopeを返す。
 * @precondition 「directory: string、name: string」がreadEnvelopeFileの入力契約を満たす。
 * @postcondition readEnvelopeFileの責務を完了した結果だけを返す。
 * @effect readEnvelopeFileはFilesystemの読取りまたは書込みを実行する。
 * @failure readEnvelopeFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readEnvelopeFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readEnvelopeFileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readEnvelopeFileは共有非同期状態を持たない同期処理である。
 */
function readEnvelopeFile(directory: string, name: string): Envelope {
  const location = path.join(directory, name);
  const metadata = fs.lstatSync(location);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size > MAX_RECORD_BYTES
  )
    throw new Error("project_runtime_record_invalid");
  const candidate: unknown = JSON.parse(fs.readFileSync(location, "utf8"));
  if (
    !plainObject(candidate) ||
    !exactKeys(candidate, [
      "schema",
      "schemaRevision",
      "recordKind",
      "repositoryBindingId",
      "projectId",
      "createdGeneration",
      "updatedGeneration",
      "contentHash",
      "content",
    ]) ||
    !["project-state", "queue-entry", "lease-evidence"].includes(
      String(candidate.recordKind),
    )
  )
    throw new Error("project_runtime_record_envelope_invalid");
  const parsed = candidate as unknown as Envelope;
  if (
    parsed.schema !== PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT ||
    parsed.schemaRevision !== 1 ||
    !validId(parsed.repositoryBindingId) ||
    !validId(parsed.projectId) ||
    !Number.isSafeInteger(parsed.createdGeneration) ||
    !Number.isSafeInteger(parsed.updatedGeneration) ||
    parsed.createdGeneration < 1 ||
    parsed.updatedGeneration < parsed.createdGeneration ||
    parsed.contentHash !== digest(JSON.stringify(parsed.content))
  )
    throw new Error("project_runtime_record_invalid");
  if (
    (parsed.recordKind === "project-state" &&
      !validProjectRuntimeState(parsed.content)) ||
    (parsed.recordKind === "queue-entry" && !validQueueEntry(parsed.content)) ||
    (parsed.recordKind === "lease-evidence" &&
      !validLeaseEvidence(parsed.content))
  )
    throw new Error("project_runtime_record_content_invalid");
  if (
    (parsed.recordKind === "project-state" ||
      parsed.recordKind === "queue-entry") &&
    (parsed.content as { generation: number }).generation !==
      parsed.updatedGeneration
  )
    throw new Error("project_runtime_record_generation_mismatch");
  return parsed;
}

/**
 * Envelopesを読み取る。
 *
 * @responsibility Envelopesの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input directory、prefix。requireObservedDirectoryは列挙済み対象の消失を拒否する移行準備用の指定。
 * @returns readonly Envelope[]を返す。
 * @precondition requireObservedDirectoryは呼出し元が対象を列挙済みの場合だけ指定する。
 * @postcondition readEnvelopesの責務を完了した結果だけを返す。
 * @effect readEnvelopesはFilesystemの読取りまたは書込みを実行する。
 * @failure readEnvelopesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readEnvelopesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readEnvelopesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readEnvelopesは共有非同期状態を持たない同期処理である。
 */
function readEnvelopes(
  directory: string,
  prefix: string,
  shouldRequireObservedDirectory = false,
): readonly Envelope[] {
  if (!shouldRequireObservedDirectory && !fs.existsSync(directory))
    return Object.freeze([]);
  assertDirectory(directory);
  const names = fs.readdirSync(directory);
  if (names.length > 4096)
    throw new Error("project_runtime_record_inventory_too_large");
  const generationName = /^generation-([1-9][0-9]*)\.json$/u;
  if (
    prefix === "generation-" &&
    names.some((name) => !generationName.test(name))
  )
    throw new Error("project_runtime_record_inventory_invalid");
  const records: Envelope[] = [];
  for (const name of names.filter((candidate) =>
    candidate.startsWith(prefix),
  )) {
    const parsed = readEnvelopeFile(directory, name);
    if (prefix === "generation-") {
      const match = generationName.exec(name);
      if (!match || Number(match[1]) !== parsed.updatedGeneration)
        throw new Error("project_runtime_record_generation_mismatch");
    }
    records.push(parsed);
  }
  if (prefix === "generation-") {
    const generations = records
      .map((record) => record.updatedGeneration)
      .sort((left, right) => left - right);
    if (
      new Set(generations).size !== generations.length ||
      generations.some((generation, index) => generation !== index + 1)
    )
      throw new Error("project_runtime_record_generation_discontinuous");
  }
  return Object.freeze(records);
}

/**
 * project-runtime-durable-foundationで使用するLease Evidence Contentの値契約を定義する。
 *
 * @responsibility Lease Evidence ContentのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LeaseEvidenceContentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseEvidenceContentで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseEvidenceContentの宣言は外部境界を開かない。
 * @security LeaseEvidenceContentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseEvidenceContentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LeaseEvidenceContent = Readonly<{
  kind: LeaseKind;
  queueId: string;
  ownerGeneration: string;
  ownerProcessId: number;
  disposition:
    | "acquired"
    | "released"
    | "recovered_after_owner_loss"
    | "acquisition_unknown_closed";
}>;

/**
 * project-runtime-durable-foundationで使用するLease Evidence Envelopeの値契約を定義する。
 *
 * @responsibility Lease Evidence EnvelopeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LeaseEvidenceEnvelopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseEvidenceEnvelopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseEvidenceEnvelopeの宣言は外部境界を開かない。
 * @security LeaseEvidenceEnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseEvidenceEnvelopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LeaseEvidenceEnvelope = Envelope &
  Readonly<{ recordKind: "lease-evidence"; content: LeaseEvidenceContent }>;

/**
 * Exact Lease Evidenceを読み取る。
 *
 * @responsibility Exact Lease Evidenceの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input directory: string、expected: Readonly<{ repositoryBindingId: string; projectId: string; queueId: string; kind: LeaseKind; identity: string; ownerGeneration: string; }>
 * @returns Readonly<{ acquired: LeaseEvidenceEnvelope; released: LeaseEvidenceEnvelope | null; recovered: LeaseEvidenceEnvelope | null; }>を返す。
 * @precondition 「directory: string、expected: Readonly<{ repositoryBindingId: string; projectId: string; queueId: string; kind: LeaseKind; identity: string; ownerGeneration: string; }>」がreadExactLeaseEvidenceの入力契約を満たす。
 * @postcondition readExactLeaseEvidenceの責務を完了した結果だけを返す。
 * @effect readExactLeaseEvidenceはFilesystemの読取りまたは書込みを実行する。
 * @failure readExactLeaseEvidenceは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readExactLeaseEvidenceは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readExactLeaseEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readExactLeaseEvidenceは共有非同期状態を持たない同期処理である。
 */
function readExactLeaseEvidence(
  directory: string,
  expected: Readonly<{
    repositoryBindingId: string;
    projectId: string;
    queueId: string;
    kind: LeaseKind;
    identity: string;
    ownerGeneration: string;
  }>,
): Readonly<{
  acquired: LeaseEvidenceEnvelope;
  released: LeaseEvidenceEnvelope | null;
  recovered: LeaseEvidenceEnvelope | null;
}> {
  assertDirectory(directory);
  const base = `${expected.identity}-${expected.ownerGeneration}`;
  const exactNames: Readonly<
    Record<"acquired" | "released" | "recovered", string>
  > = Object.freeze({
    acquired: `${base}.json`,
    released: `${base}-released.json`,
    recovered: `${base}-recovered.json`,
  });
  const allowed = new Set(Object.values(exactNames));
  const inventoryEntries = fs.readdirSync(directory);
  if (
    inventoryEntries.length > 4096 ||
    inventoryEntries.some((name) => name.startsWith(base) && !allowed.has(name))
  )
    throw new Error("project_runtime_lease_evidence_inventory_mismatch");

  const read = (
    name: string,
    disposition: LeaseEvidenceContent["disposition"],
    isRequired: boolean,
  ): LeaseEvidenceEnvelope | null => {
    if (!fs.existsSync(path.join(directory, name))) {
      if (isRequired) throw new Error("project_runtime_lease_evidence_missing");
      return null;
    }
    const record = readEnvelopeFile(directory, name);
    if (
      record.recordKind !== "lease-evidence" ||
      record.repositoryBindingId !== expected.repositoryBindingId ||
      record.projectId !== expected.projectId ||
      record.createdGeneration !== 1 ||
      record.updatedGeneration !== (disposition === "acquired" ? 1 : 2) ||
      !validLeaseEvidence(record.content)
    )
      throw new Error("project_runtime_lease_evidence_mismatch");
    const content = record.content as LeaseEvidenceContent;
    if (
      content.kind !== expected.kind ||
      content.queueId !== expected.queueId ||
      content.ownerGeneration !== expected.ownerGeneration ||
      content.disposition !== disposition
    )
      throw new Error("project_runtime_lease_evidence_mismatch");
    return record as LeaseEvidenceEnvelope;
  };

  const acquired = read(exactNames.acquired, "acquired", true);
  if (!acquired) throw new Error("project_runtime_lease_evidence_missing");
  const released = read(exactNames.released, "released", false);
  const recovered = read(
    exactNames.recovered,
    "recovered_after_owner_loss",
    false,
  );
  if (released && recovered)
    throw new Error("project_runtime_lease_evidence_disposition_conflict");
  for (const record of [released, recovered]) {
    if (
      record &&
      record.content.ownerProcessId !== acquired.content.ownerProcessId
    )
      throw new Error("project_runtime_lease_evidence_owner_mismatch");
  }
  return Object.freeze({ acquired, released, recovered });
}

/**
 * project-runtime-durable-foundationで使用するQueue Envelopeの値契約を定義する。
 *
 * @responsibility Queue EnvelopeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape QueueEnvelopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant QueueEnvelopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: QueueEnvelopeの宣言は外部境界を開かない。
 * @security QueueEnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility QueueEnvelopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type QueueEnvelope = Envelope & Readonly<{ content: ProjectQueueEntry }>;

/**
 * validated Queue Historyを決定する。
 *
 * @responsibility validated Queue Historyの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input records: readonly Envelope[]、repositoryBindingId: string、queueId: string、expectedProjectId: string
 * @returns readonly QueueEnvelope[] | nullを返す。
 * @precondition 「records: readonly Envelope[]、repositoryBindingId: string、queueId: string、expectedProjectId: string」がvalidatedQueueHistoryの入力契約を満たす。
 * @postcondition validatedQueueHistoryの責務を完了した結果だけを返す。
 * @effect N/A: validatedQueueHistoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validatedQueueHistoryは独自の失敗分岐を所有しない。
 * @invariant validatedQueueHistoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validatedQueueHistoryはProcess内の同一Subsystemで完結する。
 * @security validatedQueueHistoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validatedQueueHistoryは共有非同期状態を持たない同期処理である。
 */
function validatedQueueHistory(
  records: readonly Envelope[],
  repositoryBindingId: string,
  queueId: string,
  expectedProjectId?: string,
): readonly QueueEnvelope[] | null {
  const orderedItems = [...records].sort(
    (left, right) => left.updatedGeneration - right.updatedGeneration,
  );
  let projectId = expectedProjectId ?? null;
  const resultItems: QueueEnvelope[] = [];
  for (const record of orderedItems) {
    const content = record.content;
    if (
      record.recordKind !== "queue-entry" ||
      record.repositoryBindingId !== repositoryBindingId ||
      !validQueueEntry(content) ||
      content.queueId !== queueId ||
      content.generation !== record.updatedGeneration ||
      record.projectId !== content.projectId ||
      (projectId !== null && content.projectId !== projectId)
    )
      return null;
    projectId = content.projectId;
    resultItems.push(record as QueueEnvelope);
  }
  return Object.freeze(resultItems);
}

/**
 * 旧形式から抽出した状態・Queueと検証元を表す。
 *
 * @responsibility 移行準備の観測結果と移行確定の区別を所有する。
 * @trace ARCH-000004
 * @shape 最新Envelope集合、全世代の正規化Hashと未移行の表示。
 * @invariant 終端項目も含め、抽出結果だけでは移行完了を表示しない。
 * @boundary 旧保存Adapterと移行準備の内部境界。
 * @security N/A: この型は操作許可や削除Authorityを表さない。
 * @compatibility v1の旧世代入力に限定し、新Snapshotの固定Schemaにはしない。
 */
type LegacyProjectRuntimeInputs = Readonly<{
  states: readonly Envelope[];
  queues: readonly Envelope[];
  sourceRecords: readonly Readonly<{
    relativePath: string;
    normalizedEnvelopeHash: string;
  }>[];
  migrationCommitted: false;
}>;

/**
 * State／Queue部分形式の値契約を定義する。
 *
 * @responsibility 保存切替前の試行用payloadと改訂番号を所有する。
 * @trace ARCH-000004
 * @shape Repository結合、Snapshot改訂、StateとQueueの配列。
 * @invariant 完全なRuntime状態、Lease、Decisionまたは受領証明を表さない。
 * @boundary N/A: 型宣言は外部操作を行わない。
 * @security binding一致は呼出し元指定との一致だけでAuthorityではない。
 * @compatibility 本番Portへ公開せず、試行codecに限定する。
 */
type StateQueueSnapshotPilotPayload = Readonly<{
  schema: typeof STATE_QUEUE_SNAPSHOT_PILOT_SCHEMA;
  schemaRevision: 1;
  repositoryBindingId: string;
  snapshotRevision: number;
  projects: readonly ProjectRuntimeState[];
  queueEntries: readonly ProjectQueueEntry[];
}>;

/**
 * 一体保存する現在状態の閉じた値契約を定義する。
 * @responsibility 既存値と受付世代、途中Lease、履歴未確定搬送を保持する。
 * @trace ARCH-000004
 * @shape 保存情報、受付結合、Project、Queue、Lease、結果、未搬送終了要約。
 * @invariant 保護DecisionとOS handleを保存しない。保存と受付の世代を分離する。
 * @boundary Repository-localの現在状態。
 * @security Hashや状態名をAuthorityへ昇格しない。
 * @compatibility 既存Portの値を維持し、実データ切替は別処置とする。
 */
type ProjectRuntimeSnapshot = Readonly<{
  repositoryRootHash: string;
  repositoryBindingId: string;
  snapshotRevision: number;
  intakeEpoch: string;
  intakeBindings: readonly Readonly<{ queueId: string; epoch: string }>[];
  projects: readonly ProjectRuntimeState[];
  queueEntries: readonly ProjectQueueEntry[];
  leaseEvidence: readonly LeaseEvidenceEnvelope[];
  leaseIntents: readonly Readonly<{
    projectId: string;
    queueId: string;
    kind: LeaseKind;
    ownerGeneration: string;
    ownerProcessId: number;
    recoveryId: string;
    phase:
      | "acquisition_pending"
      | "acquisition_reserved"
      | "lock_owned"
      | "release_pending"
      | "recovery_pending";
    physicalIdentity?: string | null;
  }>[];
  results: readonly LegacyResultRecord[];
  historyPending: readonly HistoryRow[];
}> &
  (
    | Readonly<{ schema: typeof SNAPSHOT_SCHEMA; schemaRevision: 1 }>
    | Readonly<{
        schema: typeof SNAPSHOT_SCHEMA_V2;
        schemaRevision: 2;
        acceptanceDecisions: readonly ProjectRuntimeAcceptanceDecisionEnvelope[];
        decisionRecoveries: readonly Readonly<{
          generation: number;
          value: ProjectRuntimeDecisionRecoveryIntent;
        }>[];
      }>
  );

/**
 * 現在状態の全区画と既存結合を検証する。
 * @responsibility 部分codecを完全保存形式として受理しない。
 * @trace ARCH-000004
 * @input value: JSON値、binding: 期待Repository結合、rootHash: 取得済みRoot結合。
 * @returns 閉じたSnapshotとして有効か。
 * @precondition JSON値だけを渡す。
 * @postcondition 参照、証拠、受付結合、結果と終了要約を検証する。
 * @effect N/A: 値検証のみ。
 * @failure 不正形状・未知区画・孤立参照はfalse。
 * @invariant Owner状態や清掃を推定しない。
 * @boundary JSONから保存契約。
 * @security 既存保護情報を新規発行しない。
 * @concurrency N/A: 同期検証。
 */
function validProjectRuntimeSnapshot(
  value: unknown,
  binding: string,
  rootHash: string,
): value is ProjectRuntimeSnapshot {
  try {
    if (
      !plainObject(value) ||
      !exactKeys(value, [
        "schema",
        "schemaRevision",
        "repositoryRootHash",
        "repositoryBindingId",
        "snapshotRevision",
        "intakeEpoch",
        "intakeBindings",
        "projects",
        "queueEntries",
        "leaseEvidence",
        "leaseIntents",
        "results",
        "historyPending",
        ...(value.schema === SNAPSHOT_SCHEMA_V2
          ? ["acceptanceDecisions", "decisionRecoveries"]
          : []),
      ]) ||
      !(
        (value.schema === SNAPSHOT_SCHEMA && value.schemaRevision === 1) ||
        (value.schema === SNAPSHOT_SCHEMA_V2 && value.schemaRevision === 2)
      ) ||
      value.repositoryBindingId !== binding ||
      value.repositoryRootHash !== rootHash ||
      !validId(binding) ||
      !HASH.test(rootHash) ||
      !validId(value.intakeEpoch) ||
      !Number.isSafeInteger(value.snapshotRevision) ||
      Number(value.snapshotRevision) < 1
    )
      return false;
    for (const key of [
      "intakeBindings",
      "projects",
      "queueEntries",
      "leaseEvidence",
      "leaseIntents",
      "results",
      "historyPending",
    ])
      if (!Array.isArray(value[key])) return false;
    if (
      !(value.projects as unknown[]).every(validProjectRuntimeState) ||
      !(value.queueEntries as unknown[]).every(validQueueEntry)
    )
      return false;
    const snapshot = value as unknown as ProjectRuntimeSnapshot;
    const projects = new Set(snapshot.projects.map((item) => item.projectId));
    const queues = new Map(
      snapshot.queueEntries.map((item) => [item.queueId, item]),
    );
    if (
      projects.size !== snapshot.projects.length ||
      queues.size !== snapshot.queueEntries.length ||
      snapshot.queueEntries.some((item) => !projects.has(item.projectId))
    )
      return false;
    const intake = new Set<string>();
    for (const item of snapshot.intakeBindings) {
      if (
        !plainObject(item) ||
        !exactKeys(item, ["queueId", "epoch"]) ||
        !validId(item.epoch) ||
        !queues.has(item.queueId) ||
        intake.has(item.queueId)
      )
        return false;
      intake.add(item.queueId);
    }
    if (intake.size !== queues.size) return false;
    const evidenceGroups = new Map<string, LeaseEvidenceEnvelope[]>();
    for (const record of snapshot.leaseEvidence) {
      if (
        !plainObject(record) ||
        !exactKeys(record, [
          "schema",
          "schemaRevision",
          "recordKind",
          "repositoryBindingId",
          "projectId",
          "createdGeneration",
          "updatedGeneration",
          "contentHash",
          "content",
        ]) ||
        record.schema !== PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT ||
        record.schemaRevision !== 1 ||
        record.recordKind !== "lease-evidence" ||
        record.repositoryBindingId !== binding ||
        !validId(record.projectId) ||
        !validLeaseEvidence(record.content) ||
        record.createdGeneration !== 1 ||
        record.updatedGeneration !==
          (record.content.disposition === "acquired" ? 1 : 2) ||
        record.contentHash !== digest(JSON.stringify(record.content)) ||
        !(record.content.kind === "canonical-adoption"
          ? record.content.queueId === "canonical"
          : queues.get(record.content.queueId)?.projectId === record.projectId)
      )
        return false;
      const key = `${leaseIdentity(binding, record.projectId, record.content.queueId, record.content.kind)}\0${record.content.ownerGeneration}`;
      const groups = evidenceGroups.get(key) ?? [];
      groups.push(record);
      evidenceGroups.set(key, groups);
    }
    for (const groups of evidenceGroups.values()) {
      const acquired = groups.find(
        (item) => item.content.disposition === "acquired",
      );
      if (
        (!acquired &&
          !(
            snapshot.schema === SNAPSHOT_SCHEMA_V2 &&
            groups.length === 1 &&
            groups[0]?.content.disposition === "acquisition_unknown_closed"
          )) ||
        groups.length > 2 ||
        new Set(groups.map((item) => item.content.disposition)).size !==
          groups.length ||
        groups.some(
          (item) =>
            item.projectId !== groups[0]?.projectId ||
            item.content.queueId !== groups[0]?.content.queueId ||
            item.content.ownerProcessId !== groups[0]?.content.ownerProcessId ||
            (acquired &&
              item.content.disposition === "acquisition_unknown_closed"),
        )
      )
        return false;
    }
    const intents = new Set<string>();
    const intentOwners = new Map<string, string>();
    for (const item of snapshot.leaseIntents) {
      if (
        !plainObject(item) ||
        !exactKeys(item, [
          "projectId",
          "queueId",
          "kind",
          "ownerGeneration",
          "ownerProcessId",
          "recoveryId",
          "phase",
          ...(snapshot.schema === SNAPSHOT_SCHEMA_V2
            ? ["physicalIdentity"]
            : []),
        ]) ||
        !validId(item.projectId) ||
        !(item.kind === "canonical-adoption"
          ? item.queueId === "canonical"
          : queues.get(item.queueId)?.projectId === item.projectId) ||
        (item.kind !== "project-operation" &&
          item.kind !== "canonical-adoption") ||
        !validId(item.ownerGeneration) ||
        !Number.isSafeInteger(item.ownerProcessId) ||
        item.ownerProcessId < 1 ||
        item.recoveryId !==
          leaseAcquisitionRecoveryId(
            binding,
            item.projectId,
            item.queueId,
            item.kind,
          ) ||
        ![
          "acquisition_pending",
          "acquisition_reserved",
          "lock_owned",
          "release_pending",
          "recovery_pending",
        ].includes(item.phase)
      )
        return false;
      if (
        snapshot.schema === SNAPSHOT_SCHEMA_V2 &&
        !(
          ((item.phase === "acquisition_pending" ||
            item.phase === "acquisition_reserved" ||
            item.phase === "recovery_pending") &&
            item.physicalIdentity === null) ||
          (item.phase !== "acquisition_pending" &&
            item.phase !== "acquisition_reserved" &&
            typeof item.physicalIdentity === "string" &&
            HASH.test(item.physicalIdentity))
        )
      )
        return false;
      const key = `${leaseIdentity(binding, item.projectId, item.queueId, item.kind)}\0${item.ownerGeneration}\0${item.phase}`;
      const leaseKey = leaseIdentity(
        binding,
        item.projectId,
        item.queueId,
        item.kind,
      );
      const ownerKey = `${item.ownerGeneration}\0${item.ownerProcessId}\0${item.queueId}\0${item.projectId}`;
      const evidence = evidenceGroups.get(
        `${leaseKey}\0${item.ownerGeneration}`,
      );
      if (
        evidence?.some(
          (record) =>
            record.projectId !== item.projectId ||
            record.content.queueId !== item.queueId ||
            record.content.ownerProcessId !== item.ownerProcessId,
        )
      )
        return false;
      if (intentOwners.has(leaseKey) && intentOwners.get(leaseKey) !== ownerKey)
        return false;
      intentOwners.set(leaseKey, ownerKey);
      if (intents.has(key)) return false;
      intents.add(key);
    }
    const results = new Set<string>();
    for (const item of snapshot.results) {
      if (
        !validProjectRuntimeResultRecord(item) ||
        item.repositoryBindingId !== binding ||
        (queues.has(item.queueId) &&
          (queues.get(item.queueId)?.projectId !== item.projectId ||
            queues.get(item.queueId)?.milestoneId !== item.milestoneId))
      )
        return false;
      const key = `${item.kind}\0${item.projectId}\0${item.identity}`;
      if (results.has(key)) return false;
      results.add(key);
    }
    const history = new Set<string>();
    for (const item of snapshot.historyPending) {
      historyRow(item, Date.now());
      if (history.has(item.id)) return false;
      history.add(item.id);
    }
    if (snapshot.schema === SNAPSHOT_SCHEMA_V2) {
      for (const groups of evidenceGroups.values()) {
        const acquired = groups.find(
          (item) => item.content.disposition === "acquired",
        );
        if (
          groups.length === 1 &&
          acquired &&
          !snapshot.leaseIntents.some(
            (item) =>
              item.projectId === acquired.projectId &&
              item.queueId === acquired.content.queueId &&
              item.kind === acquired.content.kind &&
              item.ownerGeneration === acquired.content.ownerGeneration &&
              item.ownerProcessId === acquired.content.ownerProcessId &&
              item.phase === "lock_owned",
          )
        )
          return false;
      }
      if (
        !Array.isArray(snapshot.acceptanceDecisions) ||
        !Array.isArray(snapshot.decisionRecoveries)
      )
        return false;
      const decisions = new Map<
        string,
        ProjectRuntimeAcceptanceDecisionEnvelope[]
      >();
      for (const item of snapshot.acceptanceDecisions) {
        if (
          !plainObject(item) ||
          !exactKeys(item, [
            "contract",
            "repositoryBindingId",
            "recordId",
            "generation",
            "previousHash",
            "record",
          ]) ||
          !validId(item.recordId) ||
          !validProjectRuntimeAcceptanceDecisionEnvelope(
            item,
            binding,
            item.recordId,
          ) ||
          !plainObject(item.record) ||
          !exactKeys(item.record, [
            "recordId",
            "decisionId",
            "sourceSpecId",
            "projectId",
            "milestoneId",
            "repositoryRevision",
            "expectedGeneration",
            "target",
            "targetId",
            "decision",
            "criterionEvidenceIds",
            "principalId",
            "disposition",
            "newGeneration",
          ]) ||
          !projects.has(item.record.projectId)
        )
          return false;
        const groups = decisions.get(item.recordId) ?? [];
        groups.push(item);
        decisions.set(item.recordId, groups);
      }
      for (const groups of decisions.values()) {
        const first = groups.find((item) => item.generation === 1);
        const second = groups.find((item) => item.generation === 2);
        if (
          !first ||
          groups.length > 2 ||
          new Set(groups.map((item) => item.generation)).size !==
            groups.length ||
          (second && second.previousHash !== digest(JSON.stringify(first)))
        )
          return false;
      }
      const recoveries = new Set<string>();
      for (const item of snapshot.decisionRecoveries) {
        if (
          !plainObject(item) ||
          !exactKeys(item, ["generation", "value"]) ||
          !Number.isSafeInteger(item.generation) ||
          Number(item.generation) < 1 ||
          !validProjectRuntimeDecisionRecoveryIntent(item.value) ||
          !plainObject(item.value) ||
          !exactKeys(item.value, [
            "recoveryId",
            "recordId",
            "projectId",
            "milestoneId",
            "queueId",
            "applicationId",
            "expectedGeneration",
            "newGeneration",
            "observedDisposition",
            "unknownBoundary",
            "disposition",
          ]) ||
          queues.get(item.value.queueId)?.projectId !== item.value.projectId ||
          queues.get(item.value.queueId)?.milestoneId !==
            item.value.milestoneId ||
          recoveries.has(item.value.recoveryId)
        )
          return false;
        recoveries.add(item.value.recoveryId);
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 保存Envelopeを復号し全区画とHashを検証する。
 * @responsibility 不正・部分Snapshotを保存入力から拒否する。
 * @trace ARCH-000004
 * @input bytes: UTF-8 JSON、bindingとrootHash: 期待結合。
 * @returns 検証済みSnapshot、または例外。
 * @precondition 実体Rootを別途確認する。
 * @postcondition 未知区画、内容Hashと結合を検証済み。
 * @effect N/A: 復号のみ。
 * @failure 不正入力と16MiB超過で例外。
 * @invariant 受理だけで実移行を表示しない。
 * @boundary Byte文字列と保存契約。
 * @security Authorityを生成しない。
 * @concurrency N/A: 純粋復号。
 */
function decodeProjectRuntimeSnapshot(
  bytes: string,
  binding: string,
  rootHash: string,
): ProjectRuntimeSnapshot {
  if (
    typeof bytes !== "string" ||
    Buffer.byteLength(bytes, "utf8") > MAX_RECORD_BYTES
  )
    throw new Error("snapshot_bytes_invalid");
  const value: unknown = JSON.parse(bytes);
  if (
    !plainObject(value) ||
    !exactKeys(value, ["payload", "contentHash", "baseRevision", "baseHash"]) ||
    !validProjectRuntimeSnapshot(value.payload, binding, rootHash) ||
    value.contentHash !== digest(JSON.stringify(value.payload)) ||
    value.baseRevision !== value.payload.snapshotRevision - 1 ||
    (value.baseRevision === 0
      ? value.baseHash !== null
      : typeof value.baseHash !== "string" || !HASH.test(value.baseHash))
  )
    throw new Error("snapshot_invalid");
  return value.payload;
}

/**
 * 統合保存の現在値を変更せず読み取る。
 * @responsibility 真正不存在と未確定保存・観測不能を区別する。
 * @trace ARCH-000004
 * @input workingDirectory: Repository内の起点、binding: 期待する保存結合。
 * @returns 検証済みSnapshot、真正不存在のnull、または停止。
 * @precondition 本番切替は呼出し側が別途管理する。
 * @postcondition Root・全区画・Hashと排他解放を確認した時だけ成功する。
 * @effect Fileの読取りと短期排他のみ。保存領域を作成しない。
 * @failure alias、途中消失、pending、破損と結合不明を拒否する。
 * @invariant 新版破損を旧形式へのFallback許可にしない。
 * @boundary Repository-localの統合保存から内部Portへの境界。
 * @security 読取りだけでAuthorityや手動Recovery義務を発行しない。
 * @concurrency 同Rootの短期OS排他を取得し解放確認まで成功を保留する。
 */
export function readProjectRuntimeSnapshot(
  workingDirectory: string,
  binding: string,
): StoreResult<ProjectRuntimeSnapshot | null> {
  if (!validId(binding))
    return blocked("project_runtime_snapshot_input_invalid");
  const acquired = acquireProjectRuntimeSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const lock = acquired.value;
  const outcome = readProjectRuntimeSnapshotOwned(lock, binding);
  if (!lock.release())
    return blocked("project_runtime_snapshot_lock_release_unconfirmed", true);
  return outcome;
}

/**
 * 清掃済みの保存領域を新版の現在状態として初期化する。
 * @responsibility 明示的な切替でだけ受付世代を発行する。
 * @trace ARCH-000004
 * @input workingDirectory: 検証対象Root、binding: Repository結合。
 * @returns 確定保存した受付世代、または保全停止。
 * @precondition 旧記録の清掃はフロントAIが完了している。
 * @postcondition 同時初期化でも保存済みの一世代だけを返す。
 * @effect 新品領域にstate.jsonを作成する。
 * @failure 旧記録、履歴、pending、破損、観測不能は初期化しない。
 * @invariant QueryやRequest受付による暗黙初期化を行わない。
 * @boundary Repository-localの切替と現在状態。
 * @security 候補、認証、保護Decision、Evidenceを削除しない。
 * @concurrency 同Rootの短期Ownerで検査と保存を直列化する。
 */
export function initializeProjectRuntimeSnapshot(
  workingDirectory: string,
  binding: string,
): StoreResult<string> {
  if (!validId(binding))
    return blocked("project_runtime_snapshot_input_invalid");
  const acquired = acquireProjectRuntimeSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const owner = acquired.value;
  let result: StoreResult<string>;
  try {
    const observed = readProjectRuntimeSnapshotOwned(owner, binding);
    if (observed.status !== "completed") result = observed;
    else if (observed.value !== null)
      result =
        observed.value.schema === SNAPSHOT_SCHEMA_V2
          ? completed(
              "project_runtime_snapshot_initialized",
              observed.value.intakeEpoch,
            )
          : blocked("project_runtime_snapshot_schema_invalid");
    else {
      const { runtime } = storageRoot(owner.repositoryRoot);
      if (fs.readdirSync(runtime).some((name) => name !== "state.lock"))
        result = blocked("project_runtime_snapshot_fresh_area_required");
      else {
        const payload: ProjectRuntimeSnapshot = {
          schema: SNAPSHOT_SCHEMA_V2,
          schemaRevision: 2,
          repositoryRootHash: owner.repositoryRootHash,
          repositoryBindingId: binding,
          snapshotRevision: 1,
          intakeEpoch: `epoch-${randomUUID()}`,
          intakeBindings: [],
          projects: [],
          queueEntries: [],
          leaseEvidence: [],
          leaseIntents: [],
          results: [],
          historyPending: [],
          acceptanceDecisions: [],
          decisionRecoveries: [],
        };
        const saved = writeProjectRuntimeSnapshotOwned(
          owner,
          binding,
          JSON.stringify(payload),
          0,
        );
        result =
          saved.status === "completed"
            ? completed(
                "project_runtime_snapshot_initialized",
                saved.value.intakeEpoch,
              )
            : saved;
      }
    }
  } catch {
    result = blocked("project_runtime_snapshot_initialization_unconfirmed");
  }
  try {
    if (!owner.release())
      return blocked("project_runtime_snapshot_lock_release_unconfirmed", true);
  } catch {
    return blocked("project_runtime_snapshot_lock_release_unconfirmed", true);
  }
  return result;
}

/**
 * 取得済み排他Ownerの値契約を定義する。
 * @responsibility 保存の内部処置へRoot結合と生存確認を渡す。
 * @trace ARCH-000004
 * @shape OS排他handle、repositoryRoot、repositoryRootHash。
 * @invariant 呼出し元指定のHashを取得済みOwnerとして扱わない。
 * @boundary 保存処置のProcess内境界。
 * @security JSONから構築せず検証済み取得結果だけを用いる。
 * @compatibility 既存の短期排他取得結果と同じ値契約。
 */
export type ProjectRuntimeSnapshotOwner = NonNullable<
  ReturnType<typeof acquireRuntimeOwnedProjectRuntimeStateKernelLock>
> &
  Readonly<{ repositoryRoot: string; repositoryRootHash: string }>;

/**
 * 借用する保存Ownerの実発行と生存を確認する。
 * @responsibility 値が同じだけの偽造handleを拒否する。
 * @trace ARCH-000004
 * @input owner: 未検証handle。
 * @returns 発行済みで現在保持中ならtrue。
 * @precondition 同じModuleの発行集合を用いる。
 * @postcondition 解放済みと偽造値を拒否する。
 * @effect Rootの読取りだけを行う。
 * @failure 観測不能はfalse。
 * @invariant JSONや構造的な型から排他を生成しない。
 * @boundary 保存Ownerと履歴借用入口。
 * @security Root以外の書込み許可を与えない。
 * @concurrency 取得・解放は呼出し側が所有する。
 */
export function isLiveProjectRuntimeSnapshotOwner(
  owner: unknown,
): owner is ProjectRuntimeSnapshotOwner {
  if (!owner || typeof owner !== "object" || !snapshotOwners.has(owner))
    return false;
  const issued = owner as ProjectRuntimeSnapshotOwner;
  try {
    return (
      issued.assertLive() &&
      fs.realpathSync.native(issued.repositoryRoot) === issued.repositoryRoot &&
      !fs.lstatSync(issued.repositoryRoot).isSymbolicLink()
    );
  } catch {
    return false;
  }
}

/**
 * 統合保存上のProject状態だけを同じ排他内で更新する。
 * @responsibility 既存State世代の比較と他区画の保全を接続する。
 * @trace ARCH-000004
 * @input workingDirectory、binding、stateJson、expectedGeneration。
 * @returns 保存済みProject状態、または記録を保全した停止。
 * @precondition 全入力を照合したSnapshotが既に存在する。
 * @postcondition Snapshot改訂とState世代を別々に検証し、解放確認後に成功する。
 * @effect 統合state.jsonと固定pendingだけを更新する。
 * @failure 入力不正、不存在、世代競合、pendingまたは保存不明で停止する。
 * @invariant Queue、受付結合、Lease、結果と未搬送履歴を変更しない。
 * @boundary 明示的な接続試行から統合保存への境界。本番Factoryは切り替えない。
 * @security 旧形式Fallback、初期化、Authority発行と旧記録削除を行わない。
 * @concurrency 読取り・比較・保存まで一つの短期Ownerを保持し外部待機しない。
 */
export function writeProjectRuntimeSnapshotState(
  workingDirectory: string,
  binding: string,
  stateJson: string,
  expectedGeneration: number,
  intake?: Readonly<{
    epoch: string;
    queueId: string;
    requestHash: string;
    projectId: string;
    milestoneId: string;
  }>,
): StoreResult<ProjectRuntimeState> {
  let state: ProjectRuntimeState;
  try {
    if (
      !validId(binding) ||
      typeof stateJson !== "string" ||
      Buffer.byteLength(stateJson, "utf8") > MAX_RECORD_BYTES ||
      !Number.isSafeInteger(expectedGeneration) ||
      expectedGeneration < 0
    )
      throw new Error("snapshot_state_input_invalid");
    const parsed: unknown = JSON.parse(stateJson);
    if (
      !validProjectRuntimeState(parsed) ||
      parsed.generation !== expectedGeneration + 1
    )
      throw new Error("snapshot_state_input_invalid");
    state = parsed;
  } catch {
    return blocked("project_runtime_state_generation_mismatch");
  }
  const acquired = acquireProjectRuntimeSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const lock = acquired.value;
  let outcome: StoreResult<ProjectRuntimeState>;
  try {
    const observed = readProjectRuntimeSnapshotOwned(lock, binding);
    if (observed.status !== "completed") outcome = blocked(observed.reason);
    else if (observed.value === null)
      outcome = blocked("project_runtime_snapshot_absent");
    else {
      const current = observed.value;
      if (intake && !projectRuntimeSnapshotIntakeMatches(current, intake))
        throw new Error("project_runtime_intake_epoch_retired");
      const previous = current.projects.find(
        (item) => item.projectId === state.projectId,
      );
      if ((previous?.generation ?? 0) !== expectedGeneration)
        outcome = blocked("project_runtime_state_generation_conflict");
      else {
        const projects = previous
          ? current.projects.map((item) =>
              item.projectId === state.projectId ? state : item,
            )
          : [...current.projects, state];
        const saved = writeProjectRuntimeSnapshotOwned(
          lock,
          binding,
          JSON.stringify({
            ...current,
            snapshotRevision: current.snapshotRevision + 1,
            projects,
          }),
          current.snapshotRevision,
        );
        outcome =
          saved.status === "completed"
            ? completed("project_runtime_state_durable", state)
            : saved;
      }
    }
  } catch {
    outcome = blocked("project_runtime_state_observation_unknown");
  }
  if (!lock.release())
    return blocked("project_runtime_snapshot_lock_release_unconfirmed", true);
  return outcome;
}

/**
 * 同じ排他Owner内で現在値を読み取る。
 * @responsibility 自己再取得せず、読取りと保存の一連の処置を支える。
 * @trace ARCH-000004
 * @input lock: 取得済みOwner、binding: 期待する保存結合。
 * @returns 検証済みSnapshot、真正不存在、または停止。
 * @precondition 呼出し側が短期排他を取得し解放を担当する。
 * @postcondition pendingを確定・回収せず現在値だけを返す。
 * @effect File読取りのみ。保存領域を作成しない。
 * @failure Root・親・File・内容の不正または観測不能で停止する。
 * @invariant 取得・解放を内部で繰り返さない。
 * @boundary 排他Owner内の保存読取り。
 * @security 旧形式への自動Fallbackをしない。
 * @concurrency 取得済み短期排他の保持を呼出し側が管理する。
 */
function readProjectRuntimeSnapshotOwned(
  lock: ProjectRuntimeSnapshotOwner,
  binding: string,
): StoreResult<ProjectRuntimeSnapshot | null> {
  let outcome: StoreResult<ProjectRuntimeSnapshot | null>;
  try {
    const resolved = resolveProjectRuntimeNamedPaths(lock.repositoryRoot);
    if (
      !resolved ||
      resolved.repositoryRoot !== lock.repositoryRoot ||
      !lock.assertLive()
    )
      throw new Error("snapshot_root_changed");
    const root = lock.repositoryRoot;
    const boundary = observeProjectRuntimeArea(root, "project-runtime");
    const parents = [root, resolved.projectRuntime];
    const isAbsent = boundary.status === "not_observed";
    if (isAbsent) outcome = completed("project_runtime_snapshot_absent", null);
    else {
      const pending = path.join(resolved.projectRuntime, "state.pending.json");
      let pendingExists = true;
      try {
        fs.lstatSync(pending);
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
        pendingExists = false;
      }
      for (const parent of parents) assertDirectory(parent);
      if (pendingExists) throw new Error("snapshot_pending_unsettled");
      const current = path.join(resolved.projectRuntime, "state.json");
      let stat: fs.Stats | null = null;
      try {
        stat = fs.lstatSync(current);
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
        for (const parent of parents) assertDirectory(parent);
      }
      if (stat === null)
        outcome = completed("project_runtime_snapshot_absent", null);
      else {
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)
          throw new Error("snapshot_file_invalid");
        const observed = readStableBoundedFileSnapshot(
          current,
          MAX_RECORD_BYTES,
        );
        for (const parent of parents) assertDirectory(parent);
        if (fs.lstatSync(current).nlink !== 1 || !lock.assertLive())
          throw new Error("snapshot_observation_changed");
        const bytes = new TextDecoder("utf-8", { fatal: true }).decode(
          observed.bytes,
        );
        outcome = completed(
          "project_runtime_snapshot_observed",
          decodeProjectRuntimeSnapshot(bytes, binding, lock.repositoryRootHash),
        );
      }
    }
    assertProjectRuntimeAreaUnchanged(root, "project-runtime", boundary);
  } catch {
    outcome = blocked("project_runtime_snapshot_invalid_or_unconfirmed", true);
  }
  return outcome;
}

/**
 * 一体保存の変更と中断再入場を実行する。
 * @responsibility 固定pendingを先に処置し期待改訂番号で保存を確定する。
 * @trace ARCH-000004
 * @input workingDirectory、binding、payloadJson、expectedRevision。
 * @returns 保存したSnapshotまたは保全停止。
 * @precondition 明示接続した呼出し側が旧Writer停止と全入力照合を担当する。
 * @postcondition read-backとpending不存在を確認した時だけ成功を返す。
 * @effect Repository-localのstate.lock、state.pending.json、state.jsonを更新する。
 * @failure 排他、Root、世代、Hash、保存または回収不明で停止する。
 * @invariant 実データの旧Writerを自動切替せず、旧記録を削除しない。
 * @boundary 現在状態のFilesystem保存。
 * @security 保護Decisionと任意Pathを受け取らない。
 * @concurrency 同Rootの短期OS排他だけを保持し外部待機しない。
 */
export function writeProjectRuntimeSnapshot(
  workingDirectory: string,
  binding: string,
  payloadJson: string,
  expectedRevision: number,
): StoreResult<ProjectRuntimeSnapshot> {
  const acquired = acquireProjectRuntimeSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const lock = acquired.value;
  const outcome = writeProjectRuntimeSnapshotOwned(
    lock,
    binding,
    payloadJson,
    expectedRevision,
  );
  if (!lock.release())
    return blocked("project_runtime_snapshot_lock_release_unconfirmed", true);
  return outcome;
}

/**
 * 同じ排他Owner内で保存と中断再入場を処置する。
 * @responsibility 操作固有の更新から同じOwnerの保存確定へ接続する。
 * @trace ARCH-000004
 * @input lock: 取得済みOwner、binding、payloadJson、expectedRevision。
 * @returns 保存結果または記録を保全した停止。
 * @precondition 呼出し側が短期排他を取得し解放を担当する。
 * @postcondition 現在File読戻しとpending不存在を確認した時だけ保存成功。
 * @effect 固定marker・pending・現在Fileの保存を行う。
 * @failure Root・世代・記録・保存・観測の不明時は保全停止する。
 * @invariant 自己再取得せず、既存の遷移検査を維持する。
 * @boundary 排他Owner内の保存更新。
 * @security 旧Writerの自動切替や記録削除を発行しない。
 * @concurrency 外部待機を行わず短期排他の保持範囲で保存する。
 */
function writeProjectRuntimeSnapshotOwned(
  lock: ProjectRuntimeSnapshotOwner,
  binding: string,
  payloadJson: string,
  expectedRevision: number,
): StoreResult<ProjectRuntimeSnapshot> {
  let outcome: StoreResult<ProjectRuntimeSnapshot>;
  let filesystemEffectIssued = false;
  try {
    if (
      !validId(binding) ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      typeof payloadJson !== "string" ||
      Buffer.byteLength(payloadJson, "utf8") > MAX_RECORD_BYTES
    )
      throw new Error("snapshot_input_invalid");
    const payload: unknown = JSON.parse(payloadJson);
    if (
      !validProjectRuntimeSnapshot(payload, binding, lock.repositoryRootHash) ||
      payload.snapshotRevision !== expectedRevision + 1
    )
      throw new Error("snapshot_input_invalid");
    const resolved = resolveProjectRuntimeNamedPaths(lock.repositoryRoot);
    if (
      !resolved ||
      resolved.repositoryRoot !== lock.repositoryRoot ||
      !lock.assertLive()
    )
      throw new Error("snapshot_root_changed");
    const { runtime, repositoryRoot: root } = storageRoot(lock.repositoryRoot);
    if (root !== lock.repositoryRoot || !lock.assertLive())
      throw new Error("snapshot_root_changed");
    const boundary = assertProjectRuntimeArea(root, "project-runtime", runtime);
    const currentPath = path.join(runtime, "state.json");
    const pendingPath = path.join(runtime, "state.pending.json");
    const markerPath = path.join(runtime, "state.lock");
    const marker = `${JSON.stringify({ schema: "crdd-coordinator/project-runtime-state-lock/v1", repositoryRootHash: lock.repositoryRootHash })}\n`;
    /**
     * 正規Fileの真正不存在と安定読取りを区別する。
     * @responsibility aliasと途中消失を空値へ畳まない。
     * @trace ARCH-000004
     * @input location: 固定保存File。
     * @returns UTF-8本文または真正不存在のnull。
     * @precondition 親領域を確認済み。
     * @postcondition hardlinkと不正UTF-8を拒否する。
     * @effect 読取りのみ。
     * @failure 観測不能で例外。
     * @invariant 不明と不存在を区別する。
     * @boundary Filesystem。
     * @security 固定Pathだけを読む。
     * @concurrency Root排他下で実行する。
     */
    const read = (location: string): string | null => {
      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(location);
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
        assertDirectory(lock.repositoryRoot);
        assertProjectRuntimeAreaUnchanged(root, "project-runtime", boundary);
        return null;
      }
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)
        throw new Error("snapshot_file_invalid");
      const observed = readStableBoundedFileSnapshot(
        location,
        MAX_RECORD_BYTES,
      );
      assertDirectory(root);
      assertProjectRuntimeAreaUnchanged(root, "project-runtime", boundary);
      if (fs.lstatSync(location).nlink !== 1)
        throw new Error("snapshot_link_changed");
      return new TextDecoder("utf-8", { fatal: true }).decode(observed.bytes);
    };
    /**
     * 新規の固定候補を書き込みFile確定を要求する。
     * @responsibility 部分書込みを成功として返さない。
     * @trace ARCH-000004
     * @input location: 固定Path、bytes: 検証済み本文。
     * @returns N/A: 戻り値なし。
     * @precondition 短期排他を保持し対象は不存在。
     * @postcondition 同handleでfsyncを要求済み。
     * @effect 固定Fileを新規作成する。
     * @failure 作成・書込み・fsync失敗で例外。
     * @invariant 既存Fileを上書きしない。
     * @boundary Filesystem。
     * @security mode0700親内のFileを0600で作る。
     * @concurrency wxで競合作成を拒否する。
     */
    const create = (location: string, bytes: string): void => {
      if (!lock.assertLive()) throw new Error("snapshot_lock_lost");
      filesystemEffectIssued = true;
      const fd = fs.openSync(location, "wx", 0o600);
      try {
        fs.writeFileSync(fd, bytes, "utf8");
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    };
    const existingMarker = read(markerPath);
    if (existingMarker === null) create(markerPath, marker);
    if (read(markerPath) !== marker)
      throw new Error("snapshot_lock_marker_invalid");
    let currentBytes = read(currentPath);
    let current =
      currentBytes === null
        ? null
        : decodeProjectRuntimeSnapshot(
            currentBytes,
            binding,
            lock.repositoryRootHash,
          );
    const pendingBytes = read(pendingPath);
    if (pendingBytes !== null) {
      filesystemEffectIssued = true;
      const candidate = decodeProjectRuntimeSnapshot(
        pendingBytes,
        binding,
        lock.repositoryRootHash,
      );
      const pending = JSON.parse(pendingBytes) as {
        baseRevision: number;
        baseHash: string | null;
      };
      const hash = currentBytes === null ? null : digest(currentBytes);
      if (
        hash === pending.baseHash &&
        (current?.snapshotRevision ?? 0) === pending.baseRevision
      ) {
        assertProjectRuntimeSnapshotTransition(current, candidate, lock);
        const fd = fs.openSync(pendingPath, "r+");
        try {
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
        if (!lock.assertLive() || read(pendingPath) !== pendingBytes)
          throw new Error("snapshot_pending_changed");
        filesystemEffectIssued = true;
        fs.renameSync(pendingPath, currentPath);
        currentBytes = read(currentPath);
        if (currentBytes !== pendingBytes)
          throw new Error("snapshot_readback_invalid");
        current = candidate;
      } else if (
        hash === digest(pendingBytes) &&
        current?.snapshotRevision === candidate.snapshotRevision
      ) {
        const fd = fs.openSync(currentPath, "r+");
        try {
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
        if (!lock.assertLive() || read(pendingPath) !== pendingBytes)
          throw new Error("snapshot_pending_changed");
        filesystemEffectIssued = true;
        fs.unlinkSync(pendingPath);
      } else throw new Error("snapshot_pending_conflict");
      if (read(pendingPath) !== null)
        throw new Error("snapshot_pending_remains");
    }
    const candidateBytes = `${JSON.stringify({ payload, contentHash: digest(JSON.stringify(payload)), baseRevision: expectedRevision, baseHash: current?.snapshotRevision === payload.snapshotRevision ? (JSON.parse(currentBytes ?? "null") as { baseHash: string | null }).baseHash : currentBytes === null ? null : digest(currentBytes) })}\n`;
    if (Buffer.byteLength(candidateBytes, "utf8") > MAX_RECORD_BYTES)
      throw new Error("snapshot_size_invalid");
    if (currentBytes === candidateBytes)
      outcome = completed("project_runtime_snapshot_durable", payload);
    else {
      if ((current?.snapshotRevision ?? 0) !== expectedRevision)
        throw new Error("snapshot_revision_conflict");
      assertProjectRuntimeSnapshotTransition(current, payload, lock);
      create(pendingPath, candidateBytes);
      if (!lock.assertLive()) throw new Error("snapshot_lock_lost");
      const pending = read(pendingPath);
      if (pending !== candidateBytes)
        throw new Error("snapshot_pending_readback_invalid");
      filesystemEffectIssued = true;
      fs.renameSync(pendingPath, currentPath);
      if (read(currentPath) !== candidateBytes || read(pendingPath) !== null)
        throw new Error("snapshot_readback_invalid");
      outcome = completed("project_runtime_snapshot_durable", payload);
    }
  } catch {
    outcome = blocked(
      "project_runtime_snapshot_invalid_or_unconfirmed",
      filesystemEffectIssued,
    );
  }
  return outcome;
}

/**
 * 保存候補への遷移で未解決記録と受付結合を保全する。
 * @responsibility 通常保存と中断再入場に同じ遷移制約を適用する。
 * @trace ARCH-000004
 * @input current: 現在値または初期不存在、payload: 検証済み候補。
 * @returns N/A: 違反時に例外を返す。
 * @precondition 双方の構造と結合は検証済み。
 * @postcondition 改訂番号、記録世代と未解決区画の維持を確認済み。
 * @effect N/A: 値の比較のみ。
 * @failure 記録の除去、結合変更または世代飛越を拒否する。
 * @invariant pendingで通常保存の保全制約を迂回しない。
 * @boundary 現在値から候補への保存遷移。
 * @security Hash一致を遷移許可と同一視しない。
 * @concurrency N/A: 排他を所有する呼出し側で実行する。
 */
function assertProjectRuntimeSnapshotTransition(
  current: ProjectRuntimeSnapshot | null,
  payload: ProjectRuntimeSnapshot,
  owner: ProjectRuntimeSnapshotOwner,
): void {
  if (payload.snapshotRevision !== (current?.snapshotRevision ?? 0) + 1)
    throw new Error("snapshot_revision_conflict");
  for (const intent of payload.leaseIntents) {
    if (intent.phase !== "acquisition_reserved") continue;
    if (
      current?.leaseIntents.some(
        (item) => JSON.stringify(item) === JSON.stringify(intent),
      )
    )
      continue;
    const identity = leaseIdentity(
      payload.repositoryBindingId,
      intent.projectId,
      intent.queueId,
      intent.kind,
    );
    if (
      intent.physicalIdentity !== null ||
      intent.ownerProcessId !== process.pid ||
      payload.leaseIntents.filter(
        (item) =>
          leaseIdentity(
            payload.repositoryBindingId,
            item.projectId,
            item.queueId,
            item.kind,
          ) === identity,
      ).length !== 1 ||
      current?.leaseIntents.some(
        (item) =>
          leaseIdentity(
            payload.repositoryBindingId,
            item.projectId,
            item.queueId,
            item.kind,
          ) === identity,
      ) ||
      !projectRuntimeSnapshotLeaseResourcesAbsent(
        owner.repositoryRoot,
        identity,
      )
    )
      throw new Error("snapshot_acquisition_reservation_invalid");
  }
  if (current) {
    if (payload.schema !== current.schema)
      throw new Error("snapshot_schema_transition_invalid");
    const retired = new Set(
      current.queueEntries
        .filter(
          (queue) =>
            !payload.queueEntries.some(
              (item) => item.queueId === queue.queueId,
            ),
        )
        .map((item) => item.queueId),
    );
    const retiredMilestones = new Set(
      current.queueEntries
        .filter(
          (queue) =>
            retired.has(queue.queueId) &&
            !payload.queueEntries.some(
              (item) =>
                item.projectId === queue.projectId &&
                item.milestoneId === queue.milestoneId,
            ),
        )
        .map((queue) => JSON.stringify([queue.projectId, queue.milestoneId])),
    );
    const currentEvidenceIds = new Set(
      [...current.projects, ...payload.projects].flatMap((project) => [
        ...project.milestone.criterionEvidenceIds,
        ...project.objectives.flatMap(
          (objective) => objective.criterionEvidenceIds,
        ),
      ]),
    );
    for (const queueId of retired) {
      const row = current.historyPending.find((item) => item.id === queueId);
      if (
        !projectRuntimeQueueIsClosed(current, queueId, owner) ||
        !row ||
        inspectProjectRuntimeHistorySettlement(owner, row) === null
      )
        throw new Error("snapshot_retirement_unconfirmed");
    }
    if (retired.size > 0 !== (payload.intakeEpoch !== current.intakeEpoch))
      throw new Error("snapshot_intake_epoch_transition_invalid");
    if (
      current.schema === SNAPSHOT_SCHEMA_V2 &&
      payload.schema === SNAPSHOT_SCHEMA_V2
    ) {
      for (const old of current.acceptanceDecisions) {
        if (
          retiredMilestones.has(
            JSON.stringify([old.record.projectId, old.record.milestoneId]),
          ) &&
          current.acceptanceDecisions.some(
            (item) =>
              item.recordId === old.recordId &&
              item.generation === 2 &&
              item.record.disposition === "finalized",
          ) &&
          !payload.decisionRecoveries.some(
            (item) => item.value.recordId === old.recordId,
          )
        )
          continue;
        if (
          !payload.acceptanceDecisions.some(
            (item) => JSON.stringify(item) === JSON.stringify(old),
          )
        )
          throw new Error("snapshot_acceptance_decision_removed");
      }
      for (const old of current.decisionRecoveries) {
        if (
          retired.has(old.value.queueId) &&
          old.value.disposition === "settled" &&
          !payload.decisionRecoveries.some(
            (item) => item.value.recoveryId === old.value.recoveryId,
          )
        )
          continue;
        const next = payload.decisionRecoveries.find(
          (item) => item.value.recoveryId === old.value.recoveryId,
        );
        if (
          !next ||
          (JSON.stringify(next) !== JSON.stringify(old) &&
            (next.generation !== old.generation + 1 ||
              [
                "recordId",
                "projectId",
                "milestoneId",
                "queueId",
                "expectedGeneration",
              ].some(
                (key) =>
                  next.value[
                    key as keyof ProjectRuntimeDecisionRecoveryIntent
                  ] !==
                  old.value[key as keyof ProjectRuntimeDecisionRecoveryIntent],
              )))
        )
          throw new Error("snapshot_decision_recovery_transition_invalid");
      }
    }
    for (const collection of ["results", "leaseEvidence"] as const) {
      for (const old of current[collection])
        if (
          !payload[collection].some(
            (item) => JSON.stringify(item) === JSON.stringify(old),
          )
        )
          if (
            collection === "results"
              ? (!current.queueEntries.some(
                  (queue) =>
                    retired.has(queue.queueId) &&
                    queue.queueId === (old as LegacyResultRecord).queueId &&
                    queue.projectId === old.projectId &&
                    queue.milestoneId ===
                      (old as LegacyResultRecord).milestoneId,
                ) &&
                  !current.historyPending.some(
                    (row) =>
                      row.id === (old as LegacyResultRecord).identity &&
                      projectRuntimeStandaloneAdoptionIsClosed(
                        current,
                        row.id,
                        owner,
                      ) &&
                      inspectProjectRuntimeHistorySettlement(owner, row) !==
                        null,
                  )) ||
                currentEvidenceIds.has((old as LegacyResultRecord).identity) ||
                payload.queueEntries.some(
                  (item) =>
                    item.resultReference ===
                    (old as LegacyResultRecord).identity,
                )
              : !current.queueEntries.some(
                  (queue) =>
                    (old as LeaseEvidenceEnvelope).content.kind ===
                      "project-operation" &&
                    retired.has(queue.queueId) &&
                    queue.queueId ===
                      (old as LeaseEvidenceEnvelope).content.queueId &&
                    queue.projectId === old.projectId,
                ) &&
                !projectRuntimeRejectedAdoptionEvidenceCanRetire(
                  current,
                  payload,
                  old as LeaseEvidenceEnvelope,
                  owner,
                ) &&
                !(
                  (old as LeaseEvidenceEnvelope).content.kind ===
                    "canonical-adoption" &&
                  !payload.queueEntries.some(
                    (queue) => queue.projectId === old.projectId,
                  ) &&
                  !payload.leaseIntents.some(
                    (intent) => intent.projectId === old.projectId,
                  ) &&
                  !payload.results.some(
                    (record) =>
                      record.kind === "adoption" &&
                      record.projectId === old.projectId,
                  ) &&
                  current.historyPending.some(
                    (row) =>
                      (current.queueEntries.some(
                        (queue) =>
                          retired.has(queue.queueId) &&
                          queue.projectId === old.projectId,
                      ) ||
                        current.results.some(
                          (record) =>
                            record.identity === row.id &&
                            record.projectId === old.projectId &&
                            !projectRuntimeAdoptionWasRejected(record) &&
                            projectRuntimeStandaloneAdoptionIsClosed(
                              current,
                              row.id,
                              owner,
                            ),
                        )) &&
                      inspectProjectRuntimeHistorySettlement(owner, row) !==
                        null,
                  )
                )
          )
            throw new Error("snapshot_retained_obligation_removed");
    }
    for (const old of current.historyPending) {
      if (
        !payload.historyPending.some(
          (item) => JSON.stringify(item) === JSON.stringify(old),
        ) &&
        inspectProjectRuntimeHistorySettlement(owner, old) === null
      )
        throw new Error("snapshot_history_transfer_unconfirmed");
    }
    for (const old of current.leaseIntents) {
      if (
        payload.leaseIntents.some(
          (item) => JSON.stringify(item) === JSON.stringify(old),
        )
      )
        continue;
      const end = payload.leaseEvidence.find(
        (item) =>
          item.projectId === old.projectId &&
          item.content.queueId === old.queueId &&
          item.content.kind === old.kind &&
          item.content.ownerGeneration === old.ownerGeneration &&
          item.content.ownerProcessId === old.ownerProcessId &&
          item.content.disposition !== "acquired",
      );
      const identity = leaseIdentity(
        payload.repositoryBindingId,
        old.projectId,
        old.queueId,
        old.kind,
      );
      if (end && end.content.disposition !== "released") {
        const recovery = current.leaseIntents.find(
          (item) =>
            item.projectId === old.projectId &&
            item.queueId === old.queueId &&
            item.kind === old.kind &&
            item.ownerGeneration === old.ownerGeneration &&
            item.ownerProcessId === old.ownerProcessId &&
            item.phase === "recovery_pending",
        );
        const owned = current.leaseIntents.find(
          (item) =>
            item.projectId === old.projectId &&
            item.queueId === old.queueId &&
            item.kind === old.kind &&
            item.ownerGeneration === old.ownerGeneration &&
            item.phase === "lock_owned",
        );
        if (
          !recovery ||
          recovery.recoveryId !== old.recoveryId ||
          (end.content.disposition === "acquisition_unknown_closed"
            ? owned !== undefined ||
              (recovery.physicalIdentity !== null &&
                !current.leaseIntents.some(
                  (item) =>
                    item.projectId === old.projectId &&
                    item.queueId === old.queueId &&
                    item.kind === old.kind &&
                    item.ownerGeneration === old.ownerGeneration &&
                    item.phase === "acquisition_reserved",
                ))
            : !owned || recovery.physicalIdentity !== owned.physicalIdentity)
        )
          throw new Error("snapshot_recovery_intent_unconfirmed");
      }
      if (
        current.schema !== SNAPSHOT_SCHEMA_V2 ||
        !end ||
        !projectRuntimeSnapshotLeaseResourcesAbsent(
          owner.repositoryRoot,
          identity,
        )
      )
        throw new Error("snapshot_unsettled_lease_intent_removed");
    }
    for (const old of current.queueEntries) {
      if (retired.has(old.queueId)) continue;
      const next = payload.queueEntries.find(
        (item) => item.queueId === old.queueId,
      );
      if (
        !next ||
        [
          "projectId",
          "milestoneId",
          "requestHash",
          "originLane",
          "repositoryRevision",
          "scopeHash",
        ].some(
          (key) =>
            next[key as keyof ProjectQueueEntry] !==
            old[key as keyof ProjectQueueEntry],
        ) ||
        (JSON.stringify(next) !== JSON.stringify(old) &&
          next.generation !== old.generation + 1) ||
        current.intakeBindings.find((item) => item.queueId === old.queueId)
          ?.epoch !==
          payload.intakeBindings.find((item) => item.queueId === old.queueId)
            ?.epoch
      )
        throw new Error("snapshot_queue_generation_invalid");
    }
    for (const old of current.projects) {
      const next = payload.projects.find(
        (item) => item.projectId === old.projectId,
      );
      if (
        next &&
        next.milestoneId !== old.milestoneId &&
        current.queueEntries.some(
          (queue) =>
            queue.projectId === old.projectId && !retired.has(queue.queueId),
        )
      )
        throw new Error("snapshot_project_milestone_still_referenced");
      if (
        !next ||
        (JSON.stringify(next) !== JSON.stringify(old) &&
          next.generation !== old.generation + 1)
      )
        throw new Error("snapshot_project_generation_invalid");
    }
  }
}

/**
 * 保存操作の読取り・値更新・確定を一つのOwnerへ閉じる。
 * @responsibility 内部の同期処置だけを同じ短期排他へ接続する。
 * @trace ARCH-000004
 * @input workingDirectory、binding、Module内部の同期操作。
 * @returns 操作値、または元の停止結果。
 * @precondition 初期Snapshotは全入力照合によって別途確定している。
 * @postcondition 保存・解放確認後だけ成功し、変更しない読取りは保存しない。
 * @effect 操作が変更を返した場合に限り固定Snapshotを保存する。
 * @failure 操作例外、保存停止、解放未確認を停止へ戻す。
 * @invariant 外部公開callback、非同期待機と旧形式Fallbackを持たない。
 * @boundary 保存Module内部の操作とFilesystem。
 * @security Ownerを呼出し側へ公開せず、Authorityを新規発行しない。
 * @concurrency 一回取得し、全処置結果から一回の解放確認へ戻す。
 */
function withProjectRuntimeSnapshotOperation<T>(
  workingDirectory: string,
  binding: string,
  operation: (
    current: ProjectRuntimeSnapshot,
    owner: ProjectRuntimeSnapshotOwner,
  ) => StoreResult<Readonly<{ next: ProjectRuntimeSnapshot | null; value: T }>>,
): StoreResult<T> {
  if (!validId(binding))
    return blocked("project_runtime_snapshot_input_invalid");
  const acquired = acquireProjectRuntimeSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const owner = acquired.value;
  let result: StoreResult<T>;
  try {
    const observed = readProjectRuntimeSnapshotOwned(owner, binding);
    if (observed.status !== "completed") result = observed;
    else if (observed.value === null)
      result = blocked("project_runtime_snapshot_absent");
    else {
      const applied = operation(observed.value, owner);
      if (applied.status !== "completed") result = applied;
      else if (applied.value.next === null)
        result = completed(applied.reason, applied.value.value);
      else {
        const saved = writeProjectRuntimeSnapshotOwned(
          owner,
          binding,
          JSON.stringify({
            ...applied.value.next,
            snapshotRevision: observed.value.snapshotRevision + 1,
          }),
          observed.value.snapshotRevision,
        );
        result =
          saved.status === "completed"
            ? completed(applied.reason, applied.value.value)
            : saved;
      }
    }
  } catch {
    result = blocked(
      "project_runtime_snapshot_operation_invalid_or_unconfirmed",
    );
  }
  try {
    if (!owner.release())
      return blocked("project_runtime_snapshot_lock_release_unconfirmed", true);
  } catch {
    return blocked("project_runtime_snapshot_lock_release_unconfirmed", true);
  }
  return result;
}

/**
 * 一件の仕事について終了後の参照と実資源を照合する。
 * @responsibility 状態名だけで終了記録を削除しない。
 * @trace ARCH-000004
 * @input current、Queue ID、取得済み保存Owner。
 * @returns 現在の仕事が閉じている場合だけtrue。
 * @precondition Snapshotは全体検証済み。
 * @postcondition 判断待ち・未解決回復・Lease残存を拒否済み。
 * @effect 所有するLeaseの不存在を読み取る。
 * @failure 観測不能はfalse。
 * @invariant Candidate本体と保護Authorityを削除しない。
 * @boundary 現在状態と実行排他。
 * @security 終了済みを認証・採用許可にしない。
 * @concurrency 同じ短期Ownerで評価する。
 */
function projectRuntimeQueueIsClosed(
  current: ProjectRuntimeSnapshot,
  queueId: string,
  owner: ProjectRuntimeSnapshotOwner,
): boolean {
  try {
    if (current.schema !== SNAPSHOT_SCHEMA_V2) return false;
    const queue = current.queueEntries.find((item) => item.queueId === queueId);
    if (
      !queue ||
      !["completed", "cancelled"].includes(queue.state) ||
      queue.ownerGeneration !== null
    )
      return false;
    const project = current.projects.find(
      (item) => item.projectId === queue.projectId,
    );
    if (
      !project ||
      project.milestoneId !== queue.milestoneId ||
      !["accepted", "cancelled"].includes(project.milestone.state) ||
      project.tasks.some(
        (task) =>
          !["completed", "failed", "cancelled", "superseded"].includes(
            task.state,
          ) ||
          !task.cleanupConfirmed ||
          task.recoveryUnresolved ||
          task.recoveryObligations.some((item) => item.phase !== "settled"),
      )
    )
      return false;
    if (
      current.leaseIntents.some((item) => item.projectId === queue.projectId) ||
      current.decisionRecoveries.some(
        (item) =>
          item.value.queueId === queueId &&
          item.value.disposition !== "settled",
      )
    )
      return false;
    if (project.tasks.some((task) => task.candidateId !== null)) {
      const receipt = current.results.find(
        (item) =>
          item.queueId === queueId &&
          item.kind === "adoption" &&
          item.identity === queue.resultReference,
      );
      const candidate = current.results.find(
        (item) => item.queueId === queueId && item.kind === "integration",
      );
      if (
        !receipt ||
        !candidate ||
        !plainObject(receipt.value) ||
        !plainObject(candidate.value) ||
        receipt.value.status !== "completed" ||
        receipt.value.cleanupConfirmed !== true ||
        receipt.value.beforeRevision !== candidate.value.baseRevision ||
        !Array.isArray(receipt.value.changedPaths) ||
        !Array.isArray(candidate.value.changedPaths) ||
        JSON.stringify([...receipt.value.changedPaths].sort()) !==
          JSON.stringify([...candidate.value.changedPaths].sort())
      )
        return false;
    }
    const decisions = current.acceptanceDecisions.filter(
      (item) =>
        item.record.projectId === queue.projectId &&
        item.record.milestoneId === queue.milestoneId,
    );
    if (
      decisions.some(
        (item) =>
          !decisions.some(
            (next) =>
              next.recordId === item.recordId &&
              next.generation === 2 &&
              next.record.disposition === "finalized",
          ),
      )
    )
      return false;
    for (const kind of ["project-operation", "canonical-adoption"] as const)
      if (
        !projectRuntimeSnapshotLeaseResourcesAbsent(
          owner.repositoryRoot,
          leaseIdentity(
            current.repositoryBindingId,
            queue.projectId,
            kind === "project-operation" ? queueId : "canonical",
            kind,
          ),
        )
      )
        return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * 採用呼出し前に確定した拒否記録の閉じた値を確認する。
 * @responsibility 拒否を成功Receiptや未知Effectから区別する。
 * @trace ARCH-000004
 * @input 検証済み採用Record。
 * @returns exact Ownerに結合した既知拒否か。
 * @precondition 値はJSONとして検証済みである。
 * @postcondition 固定理由と全fieldが一致した場合だけtrue。
 * @effect N/A: 局所値だけを検査する。
 * @failure 不正値はfalse。
 * @invariant Receipt不存在からEffect 0を推定しない。
 * @boundary 採用Applicationと保存結果。
 * @security Callerの追加fieldを採用しない。
 * @concurrency N/A: 同期純粋処理。
 */
function projectRuntimeAdoptionWasRejected(
  record: LegacyResultRecord,
): boolean {
  return (
    record.kind === "adoption" &&
    plainObject(record.value) &&
    exactKeys(record.value, [
      "status",
      "reason",
      "ownerGeneration",
      "effectIssued",
      "cleanupConfirmed",
    ]) &&
    record.value.status === "rejected" &&
    record.value.reason ===
      "project_runtime_adoption_revision_or_scope_mismatch" &&
    record.value.ownerGeneration === record.identity &&
    record.value.effectIssued === false &&
    record.value.cleanupConfirmed === true
  );
}

/**
 * 既知拒否の終了証拠をexact Owner単位で整理できるか確認する。
 * @responsibility 拒否結果、終了証拠、履歴確定と除去候補を結合する。
 * @trace ARCH-000004
 * @input 現在値、保存候補、終了証拠と取得済みOwner。
 * @returns 全終了条件が成立した場合だけtrue。
 * @precondition 同Rootの短期排他を保持する。
 * @postcondition 別Owner世代の証拠を除去しない。
 * @effect 実Leaseと履歴確定を読む。
 * @failure 観測不能はfalse。
 * @invariant 未知Effectと解放未確認を整理しない。
 * @boundary 採用終了から履歴と現在保存。
 * @security 履歴は再実行Authorityを持たない。
 * @concurrency 同じ保存Owner内で評価する。
 */
function projectRuntimeRejectedAdoptionEvidenceCanRetire(
  current: ProjectRuntimeSnapshot,
  payload: ProjectRuntimeSnapshot,
  evidence: LeaseEvidenceEnvelope,
  owner: ProjectRuntimeSnapshotOwner,
): boolean {
  if (evidence.content.kind !== "canonical-adoption") return false;
  const record = current.results.find(
    (item) =>
      item.projectId === evidence.projectId &&
      item.identity === evidence.content.ownerGeneration &&
      projectRuntimeAdoptionWasRejected(item),
  );
  const row =
    record &&
    current.historyPending.find((item) => item.id === record.identity);
  return Boolean(
    record &&
      row &&
      row.outcome === "failed" &&
      row.primaryFailure === "execution" &&
      !payload.results.some((item) => item.identity === record.identity) &&
      projectRuntimeStandaloneAdoptionIsClosed(
        current,
        record.identity,
        owner,
      ) &&
      inspectProjectRuntimeHistorySettlement(owner, row) !== null,
  );
}

/**
 * 通常Queueを持たない採用結果の終了条件を確認する。
 * @responsibility 実適用Receipt、参照と実Leaseの現在観測から整理可能性を決める。
 * @trace ARCH-000004
 * @input 検証済み保存値、Receipt Identity、取得済みOwner。
 * @returns 全条件が成立した場合だけtrue。
 * @precondition Ownerは同じRepositoryへ結合している。
 * @postcondition 使用中・参照中・未確定結果を退役対象にしない。
 * @effect 所有する実Leaseの不存在を読む。
 * @failure 不正Receiptと観測不能はfalse。
 * @invariant Receiptを再適用Authorityへ変換しない。
 * @boundary 独立候補採用と現在保存の境界。
 * @security Candidate本文や秘密値を履歴へ複製しない。
 * @concurrency 同じ短期Owner内で評価する。
 */
function projectRuntimeStandaloneAdoptionIsClosed(
  current: ProjectRuntimeSnapshot,
  identity: string,
  owner: ProjectRuntimeSnapshotOwner,
): boolean {
  try {
    if (current.schema !== SNAPSHOT_SCHEMA_V2) return false;
    const record = current.results.find(
      (item) => item.identity === identity && item.kind === "adoption",
    );
    const isRejected =
      record !== undefined && projectRuntimeAdoptionWasRejected(record);
    if (
      !record ||
      !plainObject(record.value) ||
      (!isRejected &&
        (!exactKeys(record.value, [
          "status",
          "receiptId",
          "beforeRevision",
          "afterRevision",
          "changedPaths",
          "cleanupConfirmed",
        ]) ||
          record.value.status !== "completed" ||
          record.value.receiptId !== identity ||
          record.value.cleanupConfirmed !== true ||
          typeof record.value.beforeRevision !== "string" ||
          !/^[0-9a-f]{40,64}$/u.test(record.value.beforeRevision) ||
          typeof record.value.afterRevision !== "string" ||
          !/^[0-9a-f]{40,64}$/u.test(record.value.afterRevision) ||
          !Array.isArray(record.value.changedPaths) ||
          record.value.changedPaths.length === 0 ||
          record.value.changedPaths.some(
            (item) =>
              typeof item !== "string" ||
              normalizeRepositoryRelativePath(item) === null,
          ))) ||
      current.queueEntries.some(
        (queue) => queue.projectId === record.projectId,
      ) ||
      current.leaseIntents.some(
        (intent) => intent.projectId === record.projectId,
      ) ||
      (isRejected &&
        current.results.some(
          (other) =>
            other.projectId === record.projectId &&
            other.kind === "adoption" &&
            !projectRuntimeAdoptionWasRejected(other),
        )) ||
      current.decisionRecoveries.some(
        (item) =>
          item.value.projectId === record.projectId &&
          item.value.disposition !== "settled",
      ) ||
      current.projects.some(
        (project) =>
          project.milestone.criterionEvidenceIds.includes(identity) ||
          project.objectives.some((objective) =>
            objective.criterionEvidenceIds.includes(identity),
          ),
      )
    )
      return false;
    const evidence = current.leaseEvidence.filter(
      (item) =>
        item.projectId === record.projectId &&
        item.content.kind === "canonical-adoption" &&
        (!isRejected || item.content.ownerGeneration === identity),
    );
    if (
      !evidence.length ||
      evidence.some(
        (item) =>
          !evidence.some(
            (end) =>
              end.content.ownerGeneration === item.content.ownerGeneration &&
              end.content.ownerProcessId === item.content.ownerProcessId &&
              end.content.disposition !== "acquired",
          ),
      )
    )
      return false;
    return projectRuntimeSnapshotLeaseResourcesAbsent(
      owner.repositoryRoot,
      leaseIdentity(
        current.repositoryBindingId,
        record.projectId,
        "canonical",
        "canonical-adoption",
      ),
    );
  } catch {
    return false;
  }
}

/**
 * 終了要約の生成、履歴確定、受付世代切替を接続する。
 * @responsibility 閉じたQueueと専属の終了証拠を現在状態から退役する。
 * @trace ARCH-000004
 * @input Repository Root、binding、評価時刻。
 * @returns 退役件数または保全停止。
 * @precondition 本番の終了処置後に呼ぶ。Queryからは呼ばない。
 * @postcondition 履歴確定後だけQueueを除き、同じ保存で受付世代を切り替える。
 * @effect 固定history.jsonlとstate.jsonを保存する。
 * @failure 保存失敗時は同じ終了時刻の要約を再送可能に保持する。
 * @invariant 最新Project、結果、受入判断、候補、保護Authorityは保持する。
 * @boundary 終了処置から現在状態と30日履歴。
 * @security 未解決状態を期間だけで退役しない。
 * @concurrency 各段階を同Rootの短期Ownerで直列化する。
 */
export function maintainProjectRuntimeSnapshot(
  workingDirectory: string,
  binding: string,
  now = Date.now(),
): StoreResult<number> {
  const prepared = withProjectRuntimeSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      if (
        !Number.isSafeInteger(now) ||
        now < 0 ||
        current.schema !== SNAPSHOT_SCHEMA_V2
      )
        return blocked("project_runtime_history_time_invalid");
      const rows = current.queueEntries
        .filter(
          (queue) =>
            !current.historyPending.some((row) => row.id === queue.queueId) &&
            projectRuntimeQueueIsClosed(current, queue.queueId, owner),
        )
        .map(
          (queue): HistoryRow => ({
            id: queue.queueId,
            occurredAt: new Date(now).toISOString(),
            outcome: queue.state === "cancelled" ? "cancelled" : "completed",
            primaryFailure: queue.state === "cancelled" ? "cancel" : null,
            cleanup: "confirmed",
          }),
        );
      for (const record of current.results) {
        if (
          current.historyPending.some((row) => row.id === record.identity) ||
          !projectRuntimeStandaloneAdoptionIsClosed(
            current,
            record.identity,
            owner,
          )
        )
          continue;
        rows.push({
          id: record.identity,
          occurredAt: new Date(now).toISOString(),
          outcome: projectRuntimeAdoptionWasRejected(record)
            ? "failed"
            : "completed",
          primaryFailure: projectRuntimeAdoptionWasRejected(record)
            ? "execution"
            : null,
          cleanup: "confirmed",
        });
      }
      return completed("project_runtime_history_prepared", {
        next: rows.length
          ? { ...current, historyPending: [...current.historyPending, ...rows] }
          : null,
        value: rows.length,
      });
    },
  );
  if (prepared.status !== "completed") return prepared;
  return withProjectRuntimeSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      if (current.schema !== SNAPSHOT_SCHEMA_V2)
        return blocked("project_runtime_snapshot_schema_invalid");
      const trimmed = updateProjectRuntimeHistoryOwned(owner, null, now);
      if (trimmed.status !== "completed") return blocked(trimmed.reason, true);
      const retired = new Set<string>();
      for (const row of current.historyPending) {
        if (
          !projectRuntimeQueueIsClosed(current, row.id, owner) &&
          !projectRuntimeStandaloneAdoptionIsClosed(current, row.id, owner)
        )
          continue;
        const saved = updateProjectRuntimeHistoryOwned(
          owner,
          JSON.stringify(row),
          now,
        );
        if (
          saved.status !== "completed" ||
          inspectProjectRuntimeHistorySettlement(owner, row, now) === null
        )
          return blocked("project_runtime_history_transfer_unconfirmed", true);
        retired.add(row.id);
      }
      return completed("project_runtime_terminal_records_retired", {
        next: retired.size
          ? {
              ...current,
              intakeEpoch: current.queueEntries.some((queue) =>
                retired.has(queue.queueId),
              )
                ? `epoch-${randomUUID()}`
                : current.intakeEpoch,
              queueEntries: current.queueEntries.filter(
                (item) => !retired.has(item.queueId),
              ),
              intakeBindings: current.intakeBindings.filter(
                (item) => !retired.has(item.queueId),
              ),
              leaseEvidence: current.leaseEvidence.filter(
                (item) =>
                  !current.queueEntries.some(
                    (queue) =>
                      item.content.kind === "project-operation" &&
                      retired.has(queue.queueId) &&
                      queue.queueId === item.content.queueId &&
                      queue.projectId === item.projectId,
                  ) &&
                  !projectRuntimeRejectedAdoptionEvidenceCanRetire(
                    current,
                    {
                      ...current,
                      results: current.results.filter(
                        (record) => !retired.has(record.identity),
                      ),
                    },
                    item,
                    owner,
                  ) &&
                  !(
                    item.content.kind === "canonical-adoption" &&
                    !current.results.some(
                      (record) =>
                        record.kind === "adoption" &&
                        record.projectId === item.projectId &&
                        ((!retired.has(record.identity) &&
                          !current.queueEntries.some(
                            (queue) =>
                              retired.has(queue.queueId) &&
                              queue.queueId === record.queueId &&
                              queue.projectId === record.projectId &&
                              queue.milestoneId === record.milestoneId,
                          )) ||
                          current.projects.some(
                            (project) =>
                              project.milestone.criterionEvidenceIds.includes(
                                record.identity,
                              ) ||
                              project.objectives.some((objective) =>
                                objective.criterionEvidenceIds.includes(
                                  record.identity,
                                ),
                              ),
                          ) ||
                          current.queueEntries.some(
                            (queue) =>
                              !retired.has(queue.queueId) &&
                              queue.resultReference === record.identity,
                          )),
                    ) &&
                    !current.queueEntries.some(
                      (queue) =>
                        queue.projectId === item.projectId &&
                        !retired.has(queue.queueId),
                    ) &&
                    current.historyPending.some(
                      (row) =>
                        retired.has(row.id) &&
                        (current.queueEntries.some(
                          (queue) =>
                            queue.queueId === row.id &&
                            queue.projectId === item.projectId,
                        ) ||
                          current.results.some(
                            (record) =>
                              record.identity === row.id &&
                              record.projectId === item.projectId &&
                              !projectRuntimeAdoptionWasRejected(record),
                          )),
                    )
                  ),
              ),
              decisionRecoveries: current.decisionRecoveries.filter(
                (item) => !retired.has(item.value.queueId),
              ),
              results: current.results.filter(
                (item) =>
                  (!current.queueEntries.some(
                    (queue) =>
                      retired.has(queue.queueId) &&
                      queue.queueId === item.queueId &&
                      queue.projectId === item.projectId &&
                      queue.milestoneId === item.milestoneId,
                  ) &&
                    !retired.has(item.identity)) ||
                  current.projects.some(
                    (project) =>
                      project.milestone.criterionEvidenceIds.includes(
                        item.identity,
                      ) ||
                      project.objectives.some((objective) =>
                        objective.criterionEvidenceIds.includes(item.identity),
                      ),
                  ) ||
                  current.queueEntries.some(
                    (queue) =>
                      !retired.has(queue.queueId) &&
                      queue.resultReference === item.identity,
                  ),
              ),
              acceptanceDecisions: current.acceptanceDecisions.filter(
                (item) =>
                  !current.queueEntries.some(
                    (queue) =>
                      retired.has(queue.queueId) &&
                      queue.projectId === item.record.projectId &&
                      queue.milestoneId === item.record.milestoneId,
                  ) ||
                  current.queueEntries.some(
                    (queue) =>
                      !retired.has(queue.queueId) &&
                      queue.projectId === item.record.projectId &&
                      queue.milestoneId === item.record.milestoneId,
                  ),
              ),
              historyPending: current.historyPending.filter(
                (row) => !retired.has(row.id),
              ),
            }
          : null,
        value: retired.size,
      });
    },
  );
}

/**
 * 未搬送の終了要約を同じOwnerで履歴へ搬送する。
 * @responsibility 履歴確定と現在値からの除去を別の確定として接続する。
 * @trace ARCH-000004
 * @input workingDirectory、binding、固定する評価時刻。
 * @returns 保存済みと期限処置の件数、または保全停止。
 * @precondition 検証済みSnapshotの終了要約だけを扱う。
 * @postcondition 履歴を確認できた要約だけを現在値から除去する。
 * @effect 履歴と現在状態の固定pendingを順に保存する。
 * @failure 履歴失敗では現在値を保持し、現在値保存失敗では再送可能な要約を保持する。
 * @invariant Queue、Project、回復義務、候補本体を除去しない。
 * @boundary 現在状態と30日保持の履歴。
 * @security 期限超過を未解決状態の削除へ広げない。
 * @concurrency 同じ実発行Ownerを借用し自己再取得しない。
 */
export function transferProjectRuntimeSnapshotHistory(
  workingDirectory: string,
  binding: string,
  now = Date.now(),
): StoreResult<Readonly<{ recorded: number; expired: number }>> {
  return withProjectRuntimeSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      let recorded = 0;
      let expired = 0;
      for (const row of current.historyPending) {
        const saved = updateProjectRuntimeHistoryOwned(
          owner,
          JSON.stringify(row),
          now,
        );
        if (saved.status !== "completed") return blocked(saved.reason, true);
        const disposition = inspectProjectRuntimeHistorySettlement(
          owner,
          row,
          now,
        );
        if (disposition === null)
          return blocked("project_runtime_history_transfer_unconfirmed", true);
        if (disposition === "recorded") recorded += 1;
        else expired += 1;
      }
      return completed("project_runtime_history_transferred", {
        next: current.historyPending.length
          ? { ...current, historyPending: [] }
          : null,
        value: { recorded, expired },
      });
    },
  );
}

/**
 * 統合保存上の受入判断Storeを構築する。
 * @responsibility 二世代の判断記録を同じ短期排他で作成・読取り・比較交換する。
 * @trace ARCH-000005
 * @input workingDirectory: 検証するRepository、binding: 期待結合。
 * @returns 既存の受入判断Store Port。
 * @precondition 全入力照合済みv2保存がある。
 * @postcondition 期待値不一致と重複作成を拒否し、他区画を保持する。
 * @effect 操作時に統合保存を更新する。
 * @failure 未知版、破損、不存在、比較不一致は停止する。
 * @invariant 第2世代単独を許さず、JSONから人間承認を生成しない。
 * @boundary 受入判断PortとRepository内現在状態。
 * @security 保護Authorityや秘密値を移さない。
 * @concurrency 読取りと比較交換を同じ保存Ownerへ閉じる。
 */
export function createProjectRuntimeSnapshotAcceptanceDecisionStore(
  workingDirectory: string,
  binding: string,
): ProjectRuntimeAcceptanceDecisionStore {
  return Object.freeze({
    /**
     * 受入判断の初回記録を作成する。
     * @responsibility 同Identityの二重作成を拒否する。
     * @trace ARCH-000005
     * @input record: preparedの判断記録。
     * @returns 確定した記録または停止。
     * @precondition v2保存が存在する。
     * @postcondition 第1世代だけを追加する。
     * @effect 統合保存を更新する。
     * @failure 不正値と重複を拒否する。
     * @invariant 他区画を変更しない。
     * @boundary 判断Portと保存。
     * @security 承認Authorityを新設しない。
     * @concurrency 同じ保存Ownerで処置する。
     */
    create(record) {
      return withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== SNAPSHOT_SCHEMA_V2 ||
            !validProjectRuntimeAcceptanceDecisionRecord(record) ||
            record.disposition !== "prepared"
          )
            return blocked("project_runtime_acceptance_record_invalid");
          if (
            current.acceptanceDecisions.some(
              (item) => item.recordId === record.recordId,
            )
          )
            return blocked("project_runtime_acceptance_record_exists");
          const entry: ProjectRuntimeAcceptanceDecisionEnvelope = {
            contract: PROJECT_RUNTIME_ACCEPTANCE_DECISION_STORE_CONTRACT,
            repositoryBindingId: binding,
            recordId: record.recordId,
            generation: 1,
            previousHash: null,
            record,
          };
          return completed("project_runtime_acceptance_record_created", {
            next: {
              ...current,
              acceptanceDecisions: [...current.acceptanceDecisions, entry],
            },
            value: record,
          });
        },
      );
    },
    /**
     * 照合済みの最新受入判断を返す。
     * @responsibility 二世代の結合を維持する。
     * @trace ARCH-000005
     * @input recordId: 対象判断。
     * @returns 最新記録、真正不存在または停止。
     * @precondition v2保存が存在する。
     * @postcondition 保存値を変更しない。
     * @effect 保存を読み取る。
     * @failure 不正Identityと未知版を拒否する。
     * @invariant 不明を不存在へ丸めない。
     * @boundary 判断Portと保存。
     * @security Authorityを発行しない。
     * @concurrency 短期保存Ownerを保持する。
     */
    read(recordId) {
      return withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (current.schema !== SNAPSHOT_SCHEMA_V2 || !validId(recordId))
            return blocked(
              "project_runtime_acceptance_record_identity_invalid",
            );
          const groups = current.acceptanceDecisions.filter(
            (item) => item.recordId === recordId,
          );
          return completed("project_runtime_acceptance_record_observed", {
            next: null,
            value:
              groups.find((item) => item.generation === 2)?.record ??
              groups.find((item) => item.generation === 1)?.record ??
              null,
          });
        },
      );
    },
    /**
     * 受入判断を確定する。
     * @responsibility preparedの完全一致を前提に第2世代を追加する。
     * @trace ARCH-000005
     * @input expectedとnext: 期待値と確定値。
     * @returns 確定記録または停止。
     * @precondition 期待値が現在の第1世代と一致する。
     * @postcondition 第1世代のHashへ結合する。
     * @effect 統合保存を更新する。
     * @failure 比較競合と二重確定を拒否する。
     * @invariant 第2世代を単独作成しない。
     * @boundary 判断Portと保存。
     * @security Authorityを発行しない。
     * @concurrency 比較と確定を同じOwnerで行う。
     */
    compareAndSet(expected, next) {
      return withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== SNAPSHOT_SCHEMA_V2 ||
            !validProjectRuntimeAcceptanceDecisionRecord(expected) ||
            !validProjectRuntimeAcceptanceDecisionRecord(next) ||
            expected.recordId !== next.recordId ||
            expected.disposition !== "prepared" ||
            next.disposition !== "finalized"
          )
            return blocked(
              "project_runtime_acceptance_record_transition_invalid",
            );
          const first = current.acceptanceDecisions.find(
            (item) =>
              item.recordId === expected.recordId && item.generation === 1,
          );
          if (
            !first ||
            JSON.stringify(first.record) !== JSON.stringify(expected)
          )
            return blocked(
              "project_runtime_acceptance_record_generation_mismatch",
            );
          if (
            current.acceptanceDecisions.some(
              (item) =>
                item.recordId === expected.recordId && item.generation === 2,
            )
          )
            return blocked("project_runtime_acceptance_record_exists");
          const entry: ProjectRuntimeAcceptanceDecisionEnvelope = {
            contract: PROJECT_RUNTIME_ACCEPTANCE_DECISION_STORE_CONTRACT,
            repositoryBindingId: binding,
            recordId: expected.recordId,
            generation: 2,
            previousHash: digest(JSON.stringify(first)),
            record: next,
          };
          return completed("project_runtime_acceptance_record_finalized", {
            next: {
              ...current,
              acceptanceDecisions: [...current.acceptanceDecisions, entry],
            },
            value: next,
          });
        },
      );
    },
  });
}

/**
 * 統合保存上の判断回復Storeを構築する。
 * @responsibility exactな回復記録の現在値と比較交換世代を保持する。
 * @trace ARCH-000008
 * @input workingDirectory: 検証するRepository、binding: 期待結合。
 * @returns 既存の判断回復Store Port。
 * @precondition 旧入力の全連鎖を照合したv2保存がある。
 * @postcondition 回復Identityと期待値の完全一致を維持する。
 * @effect 操作時に統合保存を更新する。
 * @failure 不正入力、未知版、比較競合、保存未確定は停止する。
 * @invariant 保存改訂を記録比較交換の代替にしない。
 * @boundary 判断回復PortとRepository内現在状態。
 * @security 保存状態から回復Authorityを新設しない。
 * @concurrency 現在値の確認と確定を同じOwnerで行う。
 */
export function createProjectRuntimeSnapshotDecisionRecoveryStore(
  workingDirectory: string,
  binding: string,
): ProjectRuntimeDecisionRecoveryStore {
  return Object.freeze({
    /**
     * 判断回復の初回意図を保存する。
     * @responsibility 同回復Identityの二重作成を拒否する。
     * @trace ARCH-000008
     * @input intent: 回復意図。
     * @returns 確定意図または停止。
     * @precondition v2保存と対象Queueがある。
     * @postcondition 記録世代1を追加する。
     * @effect 統合保存を更新する。
     * @failure 不正値と重複を拒否する。
     * @invariant 元の回復Identityを維持する。
     * @boundary 回復Portと保存。
     * @security 回復Authorityを新設しない。
     * @concurrency 同じ保存Ownerで処置する。
     */
    create(intent) {
      return withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== SNAPSHOT_SCHEMA_V2 ||
            !validProjectRuntimeDecisionRecoveryIntent(intent)
          )
            return blocked("project_runtime_decision_recovery_invalid");
          if (
            current.decisionRecoveries.some(
              (item) => item.value.recoveryId === intent.recoveryId,
            )
          )
            return blocked("project_runtime_decision_recovery_exists");
          return completed("project_runtime_decision_recovery_created", {
            next: {
              ...current,
              decisionRecoveries: [
                ...current.decisionRecoveries,
                { generation: 1, value: intent },
              ],
            },
            value: intent,
          });
        },
      );
    },
    /**
     * exactな判断回復を読み取る。
     * @responsibility 最新値と真正不存在を区別する。
     * @trace ARCH-000008
     * @input recoveryId: 対象回復。
     * @returns 現在値、真正不存在または停止。
     * @precondition v2保存が存在する。
     * @postcondition 記録を変更しない。
     * @effect 保存を読み取る。
     * @failure 不正値と未知版を拒否する。
     * @invariant 観測不能を不存在へ丸めない。
     * @boundary 回復Portと保存。
     * @security Authorityを発行しない。
     * @concurrency 短期保存Ownerを保持する。
     */
    read(recoveryId) {
      return withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (current.schema !== SNAPSHOT_SCHEMA_V2 || !validId(recoveryId))
            return blocked("project_runtime_decision_recovery_invalid");
          return completed("project_runtime_decision_recovery_observed", {
            next: null,
            value:
              current.decisionRecoveries.find(
                (item) => item.value.recoveryId === recoveryId,
              )?.value ?? null,
          });
        },
      );
    },
    /**
     * 判断回復の現在値を比較交換する。
     * @responsibility 期待値の完全一致と記録世代を維持する。
     * @trace ARCH-000008
     * @input expectedとnext: 期待値と更新値。
     * @returns 更新値または停止。
     * @precondition 同じ回復Identityを扱う。
     * @postcondition 記録世代を一つ進める。
     * @effect 統合保存を更新する。
     * @failure 比較競合と結合差を拒否する。
     * @invariant 保存改訂をCASの代替にしない。
     * @boundary 回復Portと保存。
     * @security Authorityを発行しない。
     * @concurrency 比較と確定を同じOwnerで行う。
     */
    compareAndSet(expected, next) {
      return withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== SNAPSHOT_SCHEMA_V2 ||
            !validProjectRuntimeDecisionRecoveryIntent(expected) ||
            !validProjectRuntimeDecisionRecoveryIntent(next) ||
            expected.recoveryId !== next.recoveryId
          )
            return blocked("project_runtime_decision_recovery_invalid");
          const prior = current.decisionRecoveries.find(
            (item) => item.value.recoveryId === expected.recoveryId,
          );
          if (
            !prior ||
            JSON.stringify(prior.value) !== JSON.stringify(expected)
          )
            return blocked(
              "project_runtime_decision_recovery_generation_mismatch",
            );
          return completed("project_runtime_decision_recovery_updated", {
            next: {
              ...current,
              decisionRecoveries: current.decisionRecoveries.map((item) =>
                item === prior
                  ? { generation: prior.generation + 1, value: next }
                  : item,
              ),
            },
            value: next,
          });
        },
      );
    },
  });
}

/**
 * 候補公開と採用結果の保存Portを統合保存へ結合する。
 * @responsibility 同Identityの再送を同内容に限定し、後処理の結果を耐久化する。
 * @trace ARCH-000005
 * @input binding: Repository・Project・Milestone・Queueの固定結合。
 * @returns 既存の結果保存Port。
 * @precondition 全入力照合済み保存と対象Queueがある。
 * @postcondition 保存を受領や実適用の許可へ読み替えない。
 * @effect 新しい結果だけを同じ排他内で保存する。
 * @failure 不正値、結合差、異内容再送、保存失敗は停止する。
 * @invariant 採用後の保存失敗から候補を再適用しない。
 * @boundary 結果保存PortとRepository内現在状態。
 * @security 新しいAuthorityや既読状態を作成しない。
 * @concurrency 読取り、同Identity照合、更新を同じOwnerで行う。
 */
export function createProjectRuntimeSnapshotIntegrationRecordPort(
  binding: IntegrationRecordBinding,
): ProjectRuntimeIntegrationRecordPort {
  return Object.freeze({
    /**
     * 同Identity・同内容に限定して結果を保存する。
     * @responsibility 候補公開と採用結果の不変な保存を所有する。
     * @trace ARCH-000005
     * @input record: 既存結果Portの値。
     * @returns 保存確定または停止。
     * @precondition 対象Queueと結合が一致する。
     * @postcondition 同内容再送で保存を増やさない。
     * @effect 新しい結果を統合保存へ追加する。
     * @failure 異内容再送を拒否する。
     * @invariant 保存失敗から再適用しない。
     * @boundary 結果Portと保存。
     * @security 既読やAuthorityを新設しない。
     * @concurrency 照合と更新を同じOwnerで行う。
     */
    write(record) {
      return withProjectRuntimeSnapshotOperation(
        binding.workingDirectory,
        binding.repositoryBindingId,
        (current) => {
          const value: LegacyResultRecord = {
            contract: PROJECT_RUNTIME_INTEGRATION_CONTRACT,
            kind: record.kind,
            repositoryBindingId: binding.repositoryBindingId,
            projectId: binding.projectId,
            milestoneId: binding.milestoneId,
            queueId: binding.queueId,
            identity: record.identity,
            contentHash: digest(JSON.stringify(record.value)),
            value: record.value,
          };
          if (!validProjectRuntimeResultRecord(value))
            return blocked("project_runtime_result_invalid");
          const queue = current.queueEntries.find(
            (item) => item.queueId === binding.queueId,
          );
          if (
            (value.kind === "integration" && !queue) ||
            (queue &&
              (queue.projectId !== binding.projectId ||
                queue.milestoneId !== binding.milestoneId))
          )
            return blocked("project_runtime_result_binding_invalid");
          const old = current.results.find(
            (item) =>
              item.kind === value.kind &&
              item.projectId === value.projectId &&
              item.identity === value.identity,
          );
          if (old && JSON.stringify(old) !== JSON.stringify(value))
            return blocked("project_runtime_result_identity_conflict");
          return completed("project_runtime_result_durable", {
            next: old
              ? null
              : { ...current, results: [...current.results, value] },
            value: { written: true as const },
          });
        },
      );
    },
  });
}

/**
 * 新版の未終了取得意図から、操作LeaseのOwner参照を取得する。
 * @responsibility 記録の取得とOS上のOwner生死判定を分離する。
 * @trace ARCH-000004
 * @input workingDirectory: Repository内起点、binding: 対象Repository結合。
 * @returns 同一Ownerに結合した取得参照、真正な参照不存在、または停止。
 * @precondition 新版v2の現在状態が確定している。
 * @postcondition 記録の読取りだけでOwner死亡や回収成功を表示しない。
 * @effect 短期排他を取得してSnapshotを読む。状態を保存しない。
 * @failure 複数Owner、Queue結合差、未知Schemaと観測不能を拒否する。
 * @invariant 別ProjectのLeaseや採用Leaseを操作Ownerとして返さない。
 * @boundary 現在Snapshotから既存Lease PortのOwner参照へ。
 * @security JSONから実行用opaque LeaseやAuthorityを復元しない。
 * @concurrency 同じ短期Owner内でQueueと取得意図を照合し、解放確認後に返す。
 */
export function inspectProjectRuntimeSnapshotLeaseAcquisitionOwner(
  workingDirectory: string,
  binding: string,
): StoreResult<
  Readonly<{ acquisition: ProjectRuntimeLeaseAcquisitionResolution | null }>
> {
  return withProjectRuntimeSnapshotOperation(
    workingDirectory,
    binding,
    (current) => {
      if (current.schema !== SNAPSHOT_SCHEMA_V2)
        return blocked("project_runtime_snapshot_schema_invalid");
      const intents = current.leaseIntents.filter(
        (item) => item.kind === "project-operation",
      );
      const first = intents[0];
      if (!first)
        return completed("project_runtime_lease_acquisition_absent", {
          next: null,
          value: { acquisition: null },
        });
      const queue = current.queueEntries.find(
        (item) => item.queueId === first.queueId,
      );
      if (
        !queue ||
        queue.projectId !== first.projectId ||
        (queue.ownerGeneration !== null &&
          queue.ownerGeneration !== first.ownerGeneration) ||
        intents.some(
          (item) =>
            item.projectId !== first.projectId ||
            item.queueId !== first.queueId ||
            item.ownerGeneration !== first.ownerGeneration ||
            item.ownerProcessId !== first.ownerProcessId ||
            item.recoveryId !== first.recoveryId,
        )
      )
        return blocked(
          "project_runtime_lease_acquisition_owner_mismatch",
          true,
          first.recoveryId,
        );
      return completed("project_runtime_lease_acquisition_owner_observed", {
        next: null,
        value: {
          acquisition: Object.freeze({
            repositoryBindingId: binding,
            projectId: first.projectId,
            queueId: first.queueId,
            ownerGeneration: first.ownerGeneration,
            ownerProcessId: first.ownerProcessId,
            recoveryId: first.recoveryId,
          }),
        },
      });
    },
  );
}

/**
 * 統合保存の取得意図と短命な実排他を結合する。
 * @responsibility 記録の確定と物理取得を分け、同Ownerのopaque Leaseだけを返す。
 * @trace ARCH-000004
 * @input workingDirectory、binding、projectId、queueId、kind。
 * @returns 実排他を取得したLease、またはexact取得回復参照付き停止。
 * @precondition v2保存と対象Project／Queueがある。
 * @postcondition 意図と取得証拠の確定後にだけLeaseを返す。
 * @effect 取得意図を保存し、Repository内tmpへ短命な排他Directoryを作成する。
 * @failure 部分取得は意図を保全し、未取得や清掃済みへ丸めない。
 * @invariant 短期保存排他を長期実行や外部待機へ持ち越さない。
 * @boundary 現在状態、実Filesystem排他、Process内opaque Lease。
 * @security JSONからLeaseを復元しない。
 * @concurrency Repository単位／Project単位の既存Lease Identityを維持する。
 */
export function acquireProjectRuntimeSnapshotLease(
  workingDirectory: string,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
): StoreResult<ProjectRuntimeLease> {
  if (
    ![binding, projectId, queueId].every(validId) ||
    (kind !== "project-operation" && kind !== "canonical-adoption")
  )
    return blocked("project_runtime_lease_identity_invalid");
  const identity = leaseIdentity(binding, projectId, queueId, kind);
  const recoveryId = leaseAcquisitionRecoveryId(
    binding,
    projectId,
    queueId,
    kind,
  );
  const ownerGeneration = randomUUID();
  const intent = {
    projectId,
    queueId,
    kind,
    ownerGeneration,
    ownerProcessId: process.pid,
    recoveryId,
    phase: "acquisition_reserved" as const,
    physicalIdentity: null,
  };
  let intentSaveRequested = false;
  const reserved = withProjectRuntimeSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      if (
        current.schema !== SNAPSHOT_SCHEMA_V2 ||
        !validId(projectId) ||
        (kind === "project-operation"
          ? !current.projects.some((item) => item.projectId === projectId) ||
            !current.queueEntries.some(
              (item) =>
                item.queueId === queueId && item.projectId === projectId,
            )
          : queueId !== "canonical")
      )
        return blocked("project_runtime_lease_binding_invalid");
      if (
        current.leaseIntents.some(
          (item) =>
            leaseIdentity(binding, item.projectId, item.queueId, item.kind) ===
            identity,
        )
      )
        return blocked("project_runtime_lease_unavailable");
      if (
        !projectRuntimeSnapshotLeaseResourcesAbsent(
          owner.repositoryRoot,
          identity,
        )
      )
        return blocked("project_runtime_lease_preexisting_resource");
      const metadata = fs.lstatSync(owner.repositoryRoot);
      intentSaveRequested = true;
      return completed("project_runtime_lease_intent_durable", {
        next: { ...current, leaseIntents: [...current.leaseIntents, intent] },
        value: {
          repositoryRoot: owner.repositoryRoot,
          rootIdentity: digest(
            JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
          ),
        },
      });
    },
  );
  if (reserved.status !== "completed")
    return intentSaveRequested && reserved.manualRecoveryRequired
      ? blocked(reserved.reason, true, recoveryId)
      : reserved;
  const { repositoryRoot, rootIdentity } = reserved.value;
  const leasePaths = resolveProjectRuntimeNamedPaths(repositoryRoot);
  if (!leasePaths || leasePaths.repositoryRoot !== repositoryRoot)
    return blocked(
      "project_runtime_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  const lock = path.join(
    leasePaths.temporary,
    "project-runtime-leases",
    `${identity}.lock`,
  );
  let physicalIdentity: string;
  try {
    const resolved = resolveProjectRuntimeNamedPaths(workingDirectory);
    const rootMetadata = fs.lstatSync(repositoryRoot);
    if (
      !resolved ||
      resolved.repositoryRoot !== repositoryRoot ||
      !rootMetadata.isDirectory() ||
      rootMetadata.isSymbolicLink() ||
      fs.realpathSync.native(repositoryRoot) !== repositoryRoot ||
      digest(
        JSON.stringify([
          rootMetadata.dev,
          rootMetadata.ino,
          rootMetadata.birthtimeMs,
        ]),
      ) !== rootIdentity
    )
      throw new Error("lease_root_changed");
    const temporary = requireReadyRepositoryRuntimeDataArea(
      ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
        repositoryRoot,
        "tmp",
      ),
      "project_runtime_repository_root_invalid",
    ).directory;
    const boundary = assertProjectRuntimeArea(repositoryRoot, "tmp", temporary);
    const locks = ensureDirectory(temporary, "project-runtime-leases");
    assertDirectory(locks);
    fs.mkdirSync(lock, { mode: 0o700 });
    assertDirectory(locks);
    assertDirectory(lock);
    const metadata = fs.lstatSync(lock);
    physicalIdentity = digest(
      JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
    );
    assertProjectRuntimeAreaUnchanged(repositoryRoot, "tmp", boundary);
  } catch {
    return blocked(
      "project_runtime_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  }
  const acquired = withProjectRuntimeSnapshotOperation(
    workingDirectory,
    binding,
    (current) => {
      if (
        current.schema !== SNAPSHOT_SCHEMA_V2 ||
        !current.leaseIntents.some(
          (item) => JSON.stringify(item) === JSON.stringify(intent),
        )
      )
        return blocked(
          "project_runtime_lease_intent_mismatch",
          true,
          recoveryId,
        );
      const metadata = fs.lstatSync(lock);
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        ) !== physicalIdentity
      )
        return blocked(
          "project_runtime_lease_physical_identity_changed",
          true,
          recoveryId,
        );
      const evidence = envelope("lease-evidence", binding, projectId, 1, 1, {
        kind,
        queueId,
        ownerGeneration,
        ownerProcessId: process.pid,
        disposition: "acquired",
      }) as LeaseEvidenceEnvelope;
      return completed("project_runtime_lease_acquired", {
        next: {
          ...current,
          leaseIntents: [
            ...current.leaseIntents,
            { ...intent, phase: "lock_owned" as const, physicalIdentity },
          ],
          leaseEvidence: [...current.leaseEvidence, evidence],
        },
        value: true,
      });
    },
  );
  if (acquired.status !== "completed")
    return blocked(
      "project_runtime_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  let released = false;
  let lease!: ProjectRuntimeLease;
  lease = Object.freeze({
    kind,
    ownerGeneration,
    /**
     * 同じ実排他を解放して終了を保存する。
     * @responsibility 解放意図、実体照合、不存在確認、終了証拠の順を守る。
     * @trace ARCH-000004
     * @input N/A: opaque Leaseの取得時結合を使う。
     * @returns 解放確定またはexact回復参照付き停止。
     * @precondition 同じ実体を保持するLeaseである。
     * @postcondition 成功時は実排他が不在でintentが終了している。
     * @effect 同じ排他Directoryを解放し保存を更新する。
     * @failure 別実体、観測不能、保存失敗を保全停止する。
     * @invariant 要求発行を解放完了にしない。
     * @boundary opaque Lease、Filesystem、統合保存。
     * @security 別Ownerの実体を処置しない。
     * @concurrency 短期保存Ownerを物理操作の前後で分離する。
     */
    release(): StoreResult<Readonly<{ released: true }>> {
      if (released) return blocked("project_runtime_lease_already_released");
      const active = activeLeases.get(lease);
      if (!active || !activeLeaseIsObserved(active))
        return blocked(
          "project_runtime_lease_release_unknown",
          true,
          recoveryId,
        );
      const pending = withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== SNAPSHOT_SCHEMA_V2 ||
            !current.leaseIntents.some(
              (item) =>
                item.ownerGeneration === ownerGeneration &&
                item.phase === "lock_owned" &&
                item.physicalIdentity === physicalIdentity,
            )
          )
            return blocked(
              "project_runtime_lease_intent_mismatch",
              true,
              recoveryId,
            );
          return completed("project_runtime_lease_release_intent_durable", {
            next: {
              ...current,
              leaseIntents: [
                ...current.leaseIntents,
                {
                  ...intent,
                  phase: "release_pending" as const,
                  physicalIdentity,
                },
              ],
            },
            value: true,
          });
        },
      );
      if (pending.status !== "completed") {
        activeLeases.delete(lease);
        return blocked(
          "project_runtime_lease_release_unknown",
          true,
          recoveryId,
        );
      }
      try {
        if (!activeLeaseIsObserved(active))
          throw new Error("lease_identity_changed");
        const boundary = assertProjectRuntimeArea(
          repositoryRoot,
          "tmp",
          leasePaths.temporary,
        );
        fs.rmdirSync(lock);
        assertProjectRuntimeAreaUnchanged(repositoryRoot, "tmp", boundary);
        if (
          !projectRuntimeSnapshotLeaseResourcesAbsent(repositoryRoot, identity)
        )
          throw new Error("lease_release_unconfirmed");
      } catch {
        activeLeases.delete(lease);
        return blocked(
          "project_runtime_lease_release_unknown",
          true,
          recoveryId,
        );
      }
      activeLeases.delete(lease);
      const settled = withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== SNAPSHOT_SCHEMA_V2 ||
            !current.leaseIntents.some(
              (item) =>
                item.ownerGeneration === ownerGeneration &&
                item.phase === "release_pending" &&
                item.physicalIdentity === physicalIdentity,
            )
          )
            return blocked(
              "project_runtime_lease_intent_mismatch",
              true,
              recoveryId,
            );
          const evidence = envelope(
            "lease-evidence",
            binding,
            projectId,
            1,
            2,
            {
              kind,
              queueId,
              ownerGeneration,
              ownerProcessId: process.pid,
              disposition: "released",
            },
          ) as LeaseEvidenceEnvelope;
          return completed("project_runtime_lease_released", {
            next: {
              ...current,
              leaseIntents: current.leaseIntents.filter(
                (item) =>
                  !(
                    item.ownerGeneration === ownerGeneration &&
                    item.kind === kind &&
                    item.projectId === projectId &&
                    item.queueId === queueId
                  ),
              ),
              leaseEvidence: [...current.leaseEvidence, evidence],
            },
            value: { released: true as const },
          });
        },
      );
      if (settled.status !== "completed")
        return blocked(
          "project_runtime_lease_release_unknown",
          true,
          recoveryId,
        );
      released = true;
      return settled;
    },
  });
  activeLeases.set(lease, {
    repositoryRoot,
    repositoryBindingId: binding,
    projectId,
    queueId,
    kind,
    ownerGeneration,
    lock,
    recoveryMarker: "",
    acquisitionMarker: "",
    lockOwnershipMarker: "",
    evidenceDirectory: "",
    identity,
    snapshotPhysicalIdentity: physicalIdentity,
  });
  return completed("project_runtime_lease_acquired", lease);
}

/**
 * 新版Leaseの実排他を、親の真正不存在も含めて観測する。
 * @responsibility 不存在と不正親・観測不能を区別する。
 * @trace ARCH-000004
 * @input repositoryRoot: 検証済みRoot、identity: 実排他の固定Identity。
 * @returns 実排他と取得途中Fileが真正に不在か。
 * @precondition 呼出し側がRoot実体と対象intentを照合する。
 * @postcondition FileやDirectoryを作成せず観測結果だけを返す。
 * @effect Repository内の正規親と対象のmetadataを読む。
 * @failure alias、不正形状、読取り拒否は例外として呼出し側へ返す。
 * @invariant 親の不存在と観測不能を同一視しない。
 * @boundary Repository Rootからtmp内の短命な実排他へ。
 * @security Root外の実体へ辿らない。
 * @concurrency Rootと最後の既知親を不存在判定前に再確認する。
 */
function projectRuntimeSnapshotLeaseResourcesAbsent(
  repositoryRoot: string,
  identity: string,
): boolean {
  assertDirectory(repositoryRoot);
  const boundary = observeProjectRuntimeArea(repositoryRoot, "tmp");
  if (boundary.status === "not_observed") {
    assertProjectRuntimeAreaUnchanged(repositoryRoot, "tmp", boundary);
    return true;
  }
  const parent = path.join(boundary.directory, "project-runtime-leases");
  if (pathConfirmedAbsent(parent)) {
    assertProjectRuntimeAreaUnchanged(repositoryRoot, "tmp", boundary);
    return true;
  }
  assertDirectory(parent);
  const isAbsent = leaseAcquisitionFootprintAbsent(parent, identity, [
    path.join(parent, `${identity}.lock`),
  ]);
  assertDirectory(repositoryRoot);
  assertDirectory(parent);
  assertProjectRuntimeAreaUnchanged(repositoryRoot, "tmp", boundary);
  return isAbsent;
}

/**
 * 新版LeaseのOwner喪失を現在観測から終了処置する。
 * @responsibility 過去の取得結果と現在の資源不存在を分けて保存する。
 * @trace ARCH-000004
 * @input Repository起点、binding、Project、Queue、Lease種別、既存Owner観測。
 * @returns 終了後のQueueと回復参照、または同じ参照付き停止。
 * @precondition v2現在状態と対象の取得意図が検証できる。
 * @postcondition 回収確認だけでTask成功や採用成功を表示しない。
 * @effect 回収意図を保存し、同じ空の実排他を解放して終了を保存する。
 * @failure Owner存続、観測不能、対象変更、由来未確定実体では処置しない。
 * @invariant 取得未確定を取得成功へ書き換えない。
 * @boundary Snapshot、Process観測、Repository内の実排他。
 * @security 他Owner、他Root、候補と保護判断へ処置を広げない。
 * @concurrency 外部観測を短期排他の外で行い、対象を再照合する。
 */
export function reconcileProjectRuntimeSnapshotLeaseOwnerLoss(
  workingDirectory: string,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  observeOwner: ProjectRuntimeLeaseOwnerObservation,
): StoreResult<
  Readonly<{ queue: ProjectQueueEntry | null; recoveryId: string | null }>
> {
  if (
    ![binding, projectId, queueId].every(validId) ||
    !["project-operation", "canonical-adoption"].includes(kind) ||
    typeof observeOwner !== "function"
  )
    return blocked("project_runtime_lease_recovery_input_invalid");
  const recoveryId = leaseAcquisitionRecoveryId(
    binding,
    projectId,
    queueId,
    kind,
  );
  const identity = leaseIdentity(binding, projectId, queueId, kind);
  const inspected = withProjectRuntimeSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      if (current.schema !== SNAPSHOT_SCHEMA_V2)
        return blocked("project_runtime_snapshot_schema_invalid");
      const queue =
        kind === "project-operation"
          ? (current.queueEntries.find((item) => item.queueId === queueId) ??
            null)
          : null;
      if (
        !validId(projectId) ||
        (kind === "project-operation"
          ? !current.projects.some((item) => item.projectId === projectId) ||
            queue?.projectId !== projectId
          : queueId !== "canonical")
      )
        return blocked("project_runtime_lease_binding_invalid");
      const intents = current.leaseIntents.filter(
        (item) =>
          item.projectId === projectId &&
          item.queueId === queueId &&
          item.kind === kind,
      );
      const metadata = fs.lstatSync(owner.repositoryRoot);
      return completed("project_runtime_lease_recovery_inspected", {
        next: null,
        value: {
          intents,
          queue,
          repositoryRoot: owner.repositoryRoot,
          rootIdentity: digest(
            JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
          ),
        },
      });
    },
  );
  if (inspected.status !== "completed")
    return blocked(inspected.reason, true, recoveryId);
  const initial = inspected.value;
  const leasePaths = resolveProjectRuntimeNamedPaths(initial.repositoryRoot);
  if (!leasePaths || leasePaths.repositoryRoot !== initial.repositoryRoot)
    return blocked(
      "project_runtime_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  const lock = path.join(
    leasePaths.temporary,
    "project-runtime-leases",
    `${identity}.lock`,
  );
  const first = initial.intents[0];
  if (!first) {
    if (initial.queue?.ownerGeneration) {
      return withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current, owner) => {
          const queue = current.queueEntries.find(
            (item) => item.queueId === queueId,
          );
          const released = current.leaseEvidence.find(
            (item) =>
              item.projectId === projectId &&
              item.content.queueId === queueId &&
              item.content.kind === kind &&
              item.content.ownerGeneration === queue?.ownerGeneration &&
              item.content.disposition === "released",
          );
          if (
            !queue ||
            queue.generation !== initial.queue?.generation ||
            queue.ownerGeneration !== initial.queue?.ownerGeneration ||
            !["leased", "running"].includes(queue.state) ||
            !released ||
            current.leaseIntents.some(
              (item) =>
                item.projectId === projectId &&
                item.queueId === queueId &&
                item.kind === kind,
            ) ||
            !projectRuntimeSnapshotLeaseResourcesAbsent(
              owner.repositoryRoot,
              identity,
            )
          )
            return blocked(
              "project_runtime_lease_recovery_state_mismatch",
              true,
              recoveryId,
            );
          const next: ProjectQueueEntry = {
            ...queue,
            generation: queue.generation + 1,
            state: "recovery_required",
            ownerGeneration: null,
            resumeCondition: "owner_loss",
            resultReference: recoveryId,
          };
          return completed("project_runtime_released_lease_reconciled", {
            next: {
              ...current,
              queueEntries: current.queueEntries.map((item) =>
                item.queueId === queueId ? next : item,
              ),
            },
            value: { queue: next, recoveryId: null },
          });
        },
      );
    }
    try {
      if (
        !projectRuntimeSnapshotLeaseResourcesAbsent(
          initial.repositoryRoot,
          identity,
        ) ||
        initial.queue?.ownerGeneration
      )
        return blocked(
          "project_runtime_lease_recovery_state_mismatch",
          true,
          recoveryId,
        );
      return completed("project_runtime_lease_acquisition_resources_absent", {
        queue: initial.queue,
        recoveryId: null,
      });
    } catch {
      return blocked(
        "project_runtime_lease_recovery_observation_unknown",
        true,
        recoveryId,
      );
    }
  }
  const ownIntents = initial.intents;
  if (
    ownIntents.some(
      (item) =>
        item.ownerGeneration !== first.ownerGeneration ||
        item.ownerProcessId !== first.ownerProcessId ||
        item.recoveryId !== first.recoveryId,
    ) ||
    (initial.queue?.ownerGeneration !== null &&
      initial.queue?.ownerGeneration !== undefined &&
      initial.queue.ownerGeneration !== first.ownerGeneration)
  )
    return blocked(
      "project_runtime_lease_acquisition_owner_mismatch",
      true,
      recoveryId,
    );
  let observation: unknown;
  try {
    observation = observeOwner(
      Object.freeze({
        ownerProcessId: first.ownerProcessId,
        ownerGeneration: first.ownerGeneration,
      }),
    );
  } catch {
    return blocked(
      "project_runtime_lease_owner_observation_unknown",
      true,
      recoveryId,
    );
  }
  if (
    !plainObject(observation) ||
    !exactKeys(observation, ["status", "ownerProcessId", "ownerGeneration"]) ||
    observation.ownerProcessId !== first.ownerProcessId ||
    observation.ownerGeneration !== first.ownerGeneration
  )
    return blocked(
      "project_runtime_lease_owner_observation_unknown",
      true,
      recoveryId,
    );
  if (observation.status === "alive")
    return blocked("project_runtime_lease_owner_still_active");
  if (observation.status !== "absent")
    return blocked(
      "project_runtime_lease_owner_observation_unknown",
      true,
      recoveryId,
    );
  let physicalIdentity =
    ownIntents.find((item) => item.physicalIdentity !== null)
      ?.physicalIdentity ?? null;
  if (physicalIdentity === null) {
    try {
      if (
        !projectRuntimeSnapshotLeaseResourcesAbsent(
          initial.repositoryRoot,
          identity,
        )
      ) {
        if (first.phase !== "acquisition_reserved" || ownIntents.length !== 1)
          return blocked(
            "project_runtime_lease_physical_identity_unconfirmed",
            true,
            recoveryId,
          );
        const boundary = assertProjectRuntimeArea(
          initial.repositoryRoot,
          "tmp",
          leasePaths.temporary,
        );
        assertDirectory(path.dirname(lock));
        assertDirectory(lock);
        const metadata = fs.lstatSync(lock);
        if (fs.readdirSync(lock).length !== 0)
          return blocked(
            "project_runtime_lease_physical_identity_unconfirmed",
            true,
            recoveryId,
          );
        physicalIdentity = digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        );
        assertProjectRuntimeAreaUnchanged(
          initial.repositoryRoot,
          "tmp",
          boundary,
        );
      }
    } catch {
      return blocked(
        "project_runtime_lease_recovery_observation_unknown",
        true,
        recoveryId,
      );
    }
  }
  const pending = {
    ...first,
    phase: "recovery_pending" as const,
    physicalIdentity,
  };
  const reserved = withProjectRuntimeSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      const metadata = fs.lstatSync(owner.repositoryRoot);
      if (
        current.schema !== SNAPSHOT_SCHEMA_V2 ||
        owner.repositoryRoot !== initial.repositoryRoot ||
        digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        ) !== initial.rootIdentity ||
        JSON.stringify(
          current.leaseIntents.filter(
            (item) =>
              item.projectId === projectId &&
              item.queueId === queueId &&
              item.kind === kind,
          ),
        ) !== JSON.stringify(ownIntents) ||
        JSON.stringify(
          kind === "project-operation"
            ? (current.queueEntries.find((item) => item.queueId === queueId) ??
                null)
            : null,
        ) !== JSON.stringify(initial.queue)
      )
        return blocked(
          "project_runtime_lease_recovery_state_mismatch",
          true,
          recoveryId,
        );
      const existing = ownIntents.find(
        (item) => item.phase === "recovery_pending",
      );
      if (existing && JSON.stringify(existing) !== JSON.stringify(pending))
        return blocked(
          "project_runtime_lease_intent_mismatch",
          true,
          recoveryId,
        );
      return completed("project_runtime_lease_recovery_intent_durable", {
        next: existing
          ? null
          : { ...current, leaseIntents: [...current.leaseIntents, pending] },
        value: true,
      });
    },
  );
  if (reserved.status !== "completed")
    return blocked(reserved.reason, true, recoveryId);
  try {
    const resolved = resolveProjectRuntimeNamedPaths(workingDirectory);
    const rootMetadata = fs.lstatSync(initial.repositoryRoot);
    if (
      !resolved ||
      resolved.repositoryRoot !== initial.repositoryRoot ||
      !rootMetadata.isDirectory() ||
      rootMetadata.isSymbolicLink() ||
      fs.realpathSync.native(initial.repositoryRoot) !==
        initial.repositoryRoot ||
      digest(
        JSON.stringify([
          rootMetadata.dev,
          rootMetadata.ino,
          rootMetadata.birthtimeMs,
        ]),
      ) !== initial.rootIdentity
    )
      throw new Error("lease_root_changed");
    // 不存在と観測不能を区別し、親にaliasがある場合も処置しない。
    if (
      !projectRuntimeSnapshotLeaseResourcesAbsent(
        initial.repositoryRoot,
        identity,
      )
    ) {
      const boundary = assertProjectRuntimeArea(
        initial.repositoryRoot,
        "tmp",
        leasePaths.temporary,
      );
      assertDirectory(path.dirname(lock));
      assertDirectory(lock);
      const metadata = fs.lstatSync(lock);
      if (
        physicalIdentity === null ||
        digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        ) !== physicalIdentity ||
        fs.readdirSync(lock).length !== 0
      )
        return blocked(
          "project_runtime_lease_physical_identity_unconfirmed",
          true,
          recoveryId,
        );
      fs.rmdirSync(lock);
      assertProjectRuntimeAreaUnchanged(
        initial.repositoryRoot,
        "tmp",
        boundary,
      );
    }
    if (
      !projectRuntimeSnapshotLeaseResourcesAbsent(
        initial.repositoryRoot,
        identity,
      )
    )
      throw new Error("lease_release_unconfirmed");
  } catch {
    return blocked(
      "project_runtime_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  }
  const settled = withProjectRuntimeSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      const metadata = fs.lstatSync(owner.repositoryRoot);
      if (
        current.schema !== SNAPSHOT_SCHEMA_V2 ||
        owner.repositoryRoot !== initial.repositoryRoot ||
        digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        ) !== initial.rootIdentity ||
        JSON.stringify(
          kind === "project-operation"
            ? (current.queueEntries.find((item) => item.queueId === queueId) ??
                null)
            : null,
        ) !== JSON.stringify(initial.queue) ||
        JSON.stringify(
          current.leaseIntents.filter(
            (item) =>
              item.projectId === projectId &&
              item.queueId === queueId &&
              item.kind === kind,
          ),
        ) !==
          JSON.stringify(
            ownIntents.some((item) => item.phase === "recovery_pending")
              ? ownIntents
              : [...ownIntents, pending],
          ) ||
        !projectRuntimeSnapshotLeaseResourcesAbsent(
          initial.repositoryRoot,
          identity,
        )
      )
        return blocked(
          "project_runtime_lease_recovery_state_mismatch",
          true,
          recoveryId,
        );
      const acquired = current.leaseEvidence.find(
        (item) =>
          item.projectId === projectId &&
          item.content.queueId === queueId &&
          item.content.kind === kind &&
          item.content.ownerGeneration === first.ownerGeneration &&
          item.content.disposition === "acquired",
      );
      const ended = current.leaseEvidence.find(
        (item) =>
          item.projectId === projectId &&
          item.content.queueId === queueId &&
          item.content.kind === kind &&
          item.content.ownerGeneration === first.ownerGeneration &&
          item.content.disposition !== "acquired",
      );
      if (ended)
        return blocked(
          "project_runtime_lease_recovery_state_mismatch",
          true,
          recoveryId,
        );
      const evidence = envelope("lease-evidence", binding, projectId, 1, 2, {
        kind,
        queueId,
        ownerGeneration: first.ownerGeneration,
        ownerProcessId: first.ownerProcessId,
        disposition: acquired
          ? "recovered_after_owner_loss"
          : "acquisition_unknown_closed",
      }) as LeaseEvidenceEnvelope;
      const queue: ProjectQueueEntry | null =
        initial.queue === null
          ? null
          : Object.freeze({
              ...initial.queue,
              generation: initial.queue.generation + 1,
              ...(initial.queue.ownerGeneration === null
                ? {}
                : {
                    state: "recovery_required" as const,
                    ownerGeneration: null,
                    resumeCondition: "owner_loss" as const,
                  }),
              resultReference: recoveryId,
            });
      return completed("project_runtime_lease_owner_loss_reconciled", {
        next: {
          ...current,
          leaseIntents: current.leaseIntents.filter(
            (item) =>
              !(
                item.projectId === projectId &&
                item.queueId === queueId &&
                item.kind === kind &&
                item.ownerGeneration === first.ownerGeneration
              ),
          ),
          leaseEvidence: [...current.leaseEvidence, evidence],
          queueEntries:
            queue === null
              ? current.queueEntries
              : current.queueEntries.map((item) =>
                  item.queueId === queueId ? queue : item,
                ),
        },
        value: { queue, recoveryId },
      });
    },
  );
  return settled.status === "completed"
    ? settled
    : blocked(settled.reason, true, recoveryId);
}

/**
 * 発行時の受付結合を現在の保存値へ照合する。
 * @responsibility 新規受付と退役前の同内容再入場を区別する。
 * @trace ARCH-000004
 * @input current: 保存値、intake: 発行時世代と依頼結合。
 * @returns 受付可能ならtrue。
 * @precondition currentは検証済み。
 * @postcondition 退役済み世代を現在世代へ付け替えない。
 * @effect N/A: 値比較のみ。
 * @failure 異内容、異結合、退役済み世代の再入場はfalse。
 * @invariant 同じProject名だけで再入場を許可しない。
 * @boundary Requestと保存契約。
 * @security 受付世代は実行Authorityではない。
 * @concurrency 同Ownerで保存直前にも使用する。
 */
function projectRuntimeSnapshotIntakeMatches(
  current: ProjectRuntimeSnapshot,
  intake: Readonly<{
    epoch: string;
    queueId: string;
    requestHash: string;
    projectId: string;
    milestoneId: string;
  }>,
): boolean {
  if (
    !validId(intake.epoch) ||
    !validId(intake.queueId) ||
    !HASH.test(intake.requestHash) ||
    !validId(intake.projectId) ||
    !validId(intake.milestoneId)
  )
    return false;
  const queue = current.queueEntries.find(
    (item) => item.queueId === intake.queueId,
  );
  if (!queue) return current.intakeEpoch === intake.epoch;
  return (
    current.intakeBindings.some(
      (item) => item.queueId === intake.queueId && item.epoch === intake.epoch,
    ) &&
    queue.requestHash === intake.requestHash &&
    queue.projectId === intake.projectId &&
    queue.milestoneId === intake.milestoneId
  );
}

/**
 * State作成より前に、発行時の受付結合を確認する。
 * @responsibility 拒否する依頼からProject状態を生成しない。
 * @trace ARCH-000004
 * @input Repository Root、binding、依頼の発行時結合。
 * @returns 検証成功または停止。
 * @precondition Rootと呼出し主体は上位で検証済み。
 * @postcondition 状態を書き換えず受付を評価する。
 * @effect 短期排他と読取りのみ。
 * @failure 旧世代、異内容、未初期化は停止。
 * @invariant この確認だけを後続保存の保証にしない。
 * @boundary 本番入口と現在状態。
 * @security 認証または権限を発行しない。
 * @concurrency 保存時も同じ判定を再実行する。
 */
export function inspectProjectRuntimeSnapshotIntake(
  workingDirectory: string,
  binding: string,
  intake: Readonly<{
    epoch: string;
    queueId: string;
    requestHash: string;
    projectId: string;
    milestoneId: string;
  }>,
): StoreResult<true> {
  return withProjectRuntimeSnapshotOperation(
    workingDirectory,
    binding,
    (current) =>
      projectRuntimeSnapshotIntakeMatches(current, intake)
        ? completed("project_runtime_intake_verified", {
            next: null,
            value: true as const,
          })
        : blocked("project_runtime_intake_epoch_retired"),
  );
}

/**
 * 統合保存用State／Queueの全操作を構成する。
 * @responsibility 既存Portの世代・選択・実行Owner・回復契約を同じ保存Ownerへ接続する。
 * @trace ARCH-000004
 * @input workingDirectory、binding、Request発行時に取得したintakeEpoch。
 * @returns State／Queue Port。既存本番Factoryは変更しない。
 * @precondition 全入力照合済みSnapshotと有効な発行時受付世代がある。
 * @postcondition 各操作が同じ排他内の比較と保存確認を使用する。
 * @effect 操作時にだけ統合Snapshotを読取り・保存する。
 * @failure 世代・受付・Owner・回復不一致は保全停止する。
 * @invariant 保存改訂をState／Queue世代や実資源の証明にしない。
 * @boundary Coreの既存State Portと統合保存。
 * @security 過去Requestを現在世代へ自動付替えしない。
 * @concurrency 選択から待機Queue更新まで自己再取得せず一つの短期Ownerに閉じる。
 */
export function createProjectRuntimeSnapshotStatePort(
  workingDirectory: string,
  binding: string,
  intakeEpoch: string,
  intake?: Readonly<{
    epoch: string;
    queueId: string;
    requestHash: string;
    projectId: string;
    milestoneId: string;
  }>,
): ProjectRuntimeStatePort {
  if (!validId(binding) || !validId(intakeEpoch))
    throw new Error("snapshot_port_binding_invalid");
  return Object.freeze({
    writeState: (state, expectedGeneration) =>
      writeProjectRuntimeSnapshotState(
        workingDirectory,
        binding,
        JSON.stringify(state),
        expectedGeneration,
        intake,
      ),
    readState: (projectId) =>
      withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (!validId(projectId))
            return blocked("project_runtime_state_identity_invalid");
          return completed("project_runtime_state_observed", {
            next: null,
            value:
              current.projects.find((item) => item.projectId === projectId) ??
              null,
          });
        },
      ),
    enqueueOperation: (input) =>
      withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          const existing = current.queueEntries.find(
            (item) => item.queueId === input.queueId,
          );
          if (existing) {
            const epoch = current.intakeBindings.find(
              (item) => item.queueId === input.queueId,
            )?.epoch;
            return epoch === intakeEpoch &&
              existing.requestHash === input.requestHash &&
              existing.projectId === input.projectId &&
              existing.milestoneId === input.milestoneId
              ? completed("project_runtime_queue_request_reused", {
                  next: null,
                  value: existing,
                })
              : blocked("project_runtime_queue_identity_conflict");
          }
          if (current.intakeEpoch !== intakeEpoch)
            return blocked("project_runtime_intake_epoch_retired");
          const value: ProjectQueueEntry = {
            ...input,
            state: "queued",
            generation: 1,
            ownerGeneration: null,
            resumeCondition: null,
            resultReference: null,
          };
          if (
            !validQueueEntry(value) ||
            !current.projects.some((item) => item.projectId === value.projectId)
          )
            return blocked("project_runtime_queue_input_invalid");
          return completed("project_runtime_queue_entry_durable", {
            next: {
              ...current,
              queueEntries: [...current.queueEntries, value],
              intakeBindings: [
                ...current.intakeBindings,
                { queueId: value.queueId, epoch: intakeEpoch },
              ],
            },
            value,
          });
        },
      ),
    readQueue: (queueId) =>
      withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (!validId(queueId))
            return blocked("project_runtime_queue_input_invalid");
          const value = current.queueEntries.find(
            (item) => item.queueId === queueId,
          );
          return value
            ? completed("project_runtime_queue_observed", { next: null, value })
            : blocked("project_runtime_queue_observation_unknown");
        },
      ),
    selectNextOperation: () =>
      withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          const orderedTasks = [...current.queueEntries].sort((a, b) =>
            a.queueId < b.queueId ? -1 : a.queueId > b.queueId ? 1 : 0,
          );
          const isActive = orderedTasks.some(
            (item) => item.ownerGeneration !== null,
          );
          const interactive = orderedTasks.find(
            (item) =>
              item.originLane === "interactive" &&
              item.state === "queued" &&
              item.ownerGeneration === null,
          );
          if (isActive || interactive) {
            const reason = isActive
              ? "active_operation_pending"
              : "interactive_queue_pending";
            let hasChanged = false;
            const queueEntries = current.queueEntries.map((item) => {
              if (
                item.originLane !== "scheduled" ||
                item.state !== "queued" ||
                item.ownerGeneration !== null
              )
                return item;
              hasChanged = true;
              return {
                ...item,
                state: "waiting_foreground" as const,
                generation: item.generation + 1,
                resumeCondition: reason,
                resultReference: null,
              };
            });
            return completed(
              isActive
                ? "project_runtime_active_operation_retained"
                : "project_runtime_interactive_queue_selected",
              {
                next: hasChanged ? { ...current, queueEntries } : null,
                value: isActive ? null : (interactive ?? null),
              },
            );
          }
          const waiting = orderedTasks.find(
            (item) =>
              item.originLane === "scheduled" &&
              item.state === "waiting_foreground" &&
              item.ownerGeneration === null,
          );
          if (waiting) {
            const value = {
              ...waiting,
              state: "queued" as const,
              generation: waiting.generation + 1,
              resumeCondition: null,
              resultReference: null,
            };
            return completed("project_runtime_scheduled_queue_selected", {
              next: {
                ...current,
                queueEntries: current.queueEntries.map((item) =>
                  item.queueId === value.queueId ? value : item,
                ),
              },
              value,
            });
          }
          const value =
            orderedTasks.find(
              (item) =>
                item.originLane === "scheduled" &&
                item.state === "queued" &&
                item.ownerGeneration === null,
            ) ?? null;
          return completed(
            value
              ? "project_runtime_scheduled_queue_selected"
              : "project_runtime_queue_empty",
            { next: null, value },
          );
        },
      ),
    updateQueue: (queueId, expectedGeneration, next) =>
      withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current, owner) => {
          const previous = current.queueEntries.find(
            (item) => item.queueId === queueId,
          );
          if (
            !validId(queueId) ||
            !Number.isSafeInteger(expectedGeneration) ||
            expectedGeneration < 1 ||
            !previous ||
            previous.generation !== expectedGeneration
          )
            return blocked("project_runtime_queue_generation_conflict");
          if (next.resumeCondition !== null && !validId(next.resumeCondition))
            return blocked("project_runtime_queue_resume_condition_invalid");
          if (
            next.resultReference !== null &&
            !validResultReference(next.resultReference)
          )
            return blocked("project_runtime_queue_result_reference_invalid");
          if (
            !(
              QUEUE_TRANSITIONS[previous.state] as readonly ProjectQueueState[]
            ).includes(next.state)
          )
            return blocked("project_runtime_queue_transition_invalid");
          if (
            previous.state === "recovery_required" &&
            next.state === "recovery_required" &&
            !(
              previous.ownerGeneration === null &&
              previous.resumeCondition === "owner_loss" &&
              next.lease === null &&
              next.resumeCondition === "exact_recovery" &&
              next.resultReference !== null
            )
          )
            return blocked("project_runtime_queue_recovery_binding_invalid");
          if (
            previous.state === "recovery_required" &&
            next.state === "queued" &&
            !(
              previous.ownerGeneration === null &&
              previous.resumeCondition === "owner_loss" &&
              previous.resultReference !== null &&
              next.lease === null &&
              next.resumeCondition === null &&
              next.resultReference === null
            )
          )
            return blocked("project_runtime_queue_owner_loss_reset_invalid");
          const activeLease = next.lease
            ? activeLeases.get(next.lease)
            : undefined;
          const isRequired =
            previous.ownerGeneration !== null ||
            next.state === "leased" ||
            next.state === "running";
          if (!isRequired && next.lease !== null)
            return blocked("project_runtime_queue_lease_invalid");
          if (
            isRequired &&
            (activeLease?.kind !== "project-operation" ||
              activeLease.repositoryRoot !== owner.repositoryRoot ||
              activeLease.repositoryBindingId !== binding ||
              activeLease.projectId !== previous.projectId ||
              activeLease.queueId !== queueId ||
              !activeLeaseIsObserved(activeLease))
          )
            return blocked("project_runtime_queue_lease_invalid");
          if (
            isRequired &&
            previous.ownerGeneration !== null &&
            previous.ownerGeneration !== activeLease?.ownerGeneration
          )
            return blocked("project_runtime_queue_owner_mismatch");
          const value: ProjectQueueEntry = {
            ...previous,
            state: next.state,
            generation: previous.generation + 1,
            ownerGeneration: isRequired
              ? (activeLease?.ownerGeneration ?? null)
              : null,
            resumeCondition: next.resumeCondition,
            resultReference: next.resultReference,
          };
          if (!validQueueEntry(value))
            return blocked("project_runtime_queue_record_mismatch");
          return completed("project_runtime_queue_state_durable", {
            next: {
              ...current,
              queueEntries: current.queueEntries.map((item) =>
                item.queueId === queueId ? value : item,
              ),
            },
            value,
          });
        },
      ),
    settleQueueRecovery: (queueId, expectedGeneration, recoveryId) =>
      withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          const previous = current.queueEntries.find(
            (item) => item.queueId === queueId,
          );
          if (
            !validId(queueId) ||
            !validResultReference(recoveryId) ||
            !Number.isSafeInteger(expectedGeneration) ||
            expectedGeneration < 1 ||
            !previous ||
            previous.generation !== expectedGeneration
          )
            return blocked(
              "project_runtime_queue_recovery_generation_conflict",
            );
          if (
            previous.state !== "recovery_required" ||
            previous.ownerGeneration !== null ||
            previous.resumeCondition !== "exact_recovery" ||
            previous.resultReference !== recoveryId
          )
            return blocked("project_runtime_queue_recovery_identity_mismatch");
          const value: ProjectQueueEntry = {
            ...previous,
            state: "queued",
            generation: previous.generation + 1,
            ownerGeneration: null,
            resumeCondition: "exact_recovery_settled",
            resultReference: recoveryId,
          };
          return completed("project_runtime_queue_recovery_settled", {
            next: {
              ...current,
              queueEntries: current.queueEntries.map((item) =>
                item.queueId === queueId ? value : item,
              ),
            },
            value,
          });
        },
      ),
    settleQueueLeaseRelease: (queueId, expectedGeneration, ownerGeneration) =>
      withProjectRuntimeSnapshotOperation(
        workingDirectory,
        binding,
        (current, owner) => {
          const previous = current.queueEntries.find(
            (item) => item.queueId === queueId,
          );
          if (
            !validId(queueId) ||
            !validId(ownerGeneration) ||
            !Number.isSafeInteger(expectedGeneration) ||
            expectedGeneration < 1 ||
            !previous ||
            previous.generation !== expectedGeneration ||
            previous.ownerGeneration !== ownerGeneration ||
            previous.state === "leased" ||
            previous.state === "running"
          )
            return blocked(
              "project_runtime_queue_release_settlement_state_mismatch",
              true,
            );
          const paths = resolveProjectRuntimeNamedPaths(owner.repositoryRoot);
          if (!paths)
            throw new Error("project_runtime_repository_root_invalid");
          const runtime = paths.projectRuntime;
          const boundary = assertProjectRuntimeArea(
            owner.repositoryRoot,
            "project-runtime",
            runtime,
          );
          const identity = leaseIdentity(
            binding,
            previous.projectId,
            queueId,
            "project-operation",
          );
          const locks =
            current.schema === SNAPSHOT_SCHEMA_V2
              ? path.join(paths.temporary, "project-runtime-leases")
              : path.join(runtime, "work", "locks");
          if (
            !(current.schema === SNAPSHOT_SCHEMA_V2
              ? projectRuntimeSnapshotLeaseResourcesAbsent(
                  owner.repositoryRoot,
                  identity,
                )
              : leaseAcquisitionFootprintAbsent(
                  locks,
                  identity,
                  [
                    ".lock",
                    ".release-unknown",
                    ".acquire-pending",
                    ".acquire-lock-owned",
                  ].map((suffix) => path.join(locks, `${identity}${suffix}`)),
                ))
          )
            return blocked(
              "project_runtime_queue_release_settlement_resource_present",
              true,
            );
          assertProjectRuntimeAreaUnchanged(
            owner.repositoryRoot,
            "project-runtime",
            boundary,
          );
          const evidence =
            current.schema === SNAPSHOT_SCHEMA_V2
              ? {
                  released: current.leaseEvidence.find(
                    (item) =>
                      item.projectId === previous.projectId &&
                      item.content.queueId === queueId &&
                      item.content.kind === "project-operation" &&
                      item.content.ownerGeneration === ownerGeneration &&
                      item.content.disposition === "released",
                  ),
                  recovered: current.leaseEvidence.find(
                    (item) =>
                      item.projectId === previous.projectId &&
                      item.content.queueId === queueId &&
                      item.content.kind === "project-operation" &&
                      item.content.ownerGeneration === ownerGeneration &&
                      item.content.disposition === "recovered_after_owner_loss",
                  ),
                }
              : readExactLeaseEvidence(
                  path.join(runtime, "recovery", "leases"),
                  {
                    repositoryBindingId: binding,
                    projectId: previous.projectId,
                    queueId,
                    kind: "project-operation",
                    identity,
                    ownerGeneration,
                  },
                );
          if (
            current.schema === SNAPSHOT_SCHEMA_V2 &&
            current.leaseIntents.some(
              (item) => item.ownerGeneration === ownerGeneration,
            )
          )
            return blocked(
              "project_runtime_queue_release_intent_unsettled",
              true,
            );
          if (!evidence.released || evidence.recovered)
            return blocked(
              "project_runtime_queue_release_evidence_mismatch",
              true,
            );
          const value = {
            ...previous,
            generation: previous.generation + 1,
            ownerGeneration: null,
          };
          return completed("project_runtime_queue_release_settled", {
            next: {
              ...current,
              queueEntries: current.queueEntries.map((item) =>
                item.queueId === queueId ? value : item,
              ),
            },
            value,
          });
        },
      ),
  });
}

/**
 * 閉じたState／Queue部分形式と参照関係を確認する。
 *
 * @responsibility 既存値制約、ID重複とRepository結合の拒否を所有する。
 * @trace ARCH-000004
 * @input value: JSONから得た通常データ。expectedBinding: 呼出し元が要求する結合。
 * @returns 試行payloadとして受理できるか。
 * @precondition 呼出し元がJSON.parseした値だけを渡す。
 * @postcondition 不明項目、重複、孤立Queueまたは不正値を受理しない。
 * @effect N/A: 純粋な値検証で書込みしない。
 * @failure 不正形状と結合不一致はfalse。
 * @invariant Snapshot改訂と各Recordのgenerationを同一視しない。
 * @boundary JSON値から内部の試行契約への境界。
 * @security Hashや結合を実体Identity・Authorityの証明にしない。
 * @concurrency N/A: 共有状態を操作しない。
 */
function validStateQueueSnapshotPilotPayload(
  value: unknown,
  expectedBinding: string,
): value is StateQueueSnapshotPilotPayload {
  if (
    !validId(expectedBinding) ||
    !plainObject(value) ||
    !exactKeys(value, [
      "schema",
      "schemaRevision",
      "repositoryBindingId",
      "snapshotRevision",
      "projects",
      "queueEntries",
    ]) ||
    value.schema !== STATE_QUEUE_SNAPSHOT_PILOT_SCHEMA ||
    value.schemaRevision !== 1 ||
    value.repositoryBindingId !== expectedBinding ||
    !Number.isSafeInteger(value.snapshotRevision) ||
    Number(value.snapshotRevision) < 1 ||
    !Array.isArray(value.projects) ||
    value.projects.length > 4096 ||
    !Array.isArray(value.queueEntries) ||
    value.queueEntries.length > 4096 ||
    !value.projects.every(validProjectRuntimeState) ||
    !value.queueEntries.every(validQueueEntry)
  )
    return false;
  const projectIds = new Set(value.projects.map((entry) => entry.projectId));
  const queueIds = new Set(value.queueEntries.map((entry) => entry.queueId));
  return (
    projectIds.size === value.projects.length &&
    queueIds.size === value.queueEntries.length &&
    value.queueEntries.every((entry) => projectIds.has(entry.projectId))
  );
}

/**
 * JSON入力から検証済みState／Queue試行Envelopeを作る。
 *
 * @responsibility JSONを検証後にHash付きの部分形式へ符号化する。
 * @trace ARCH-000004
 * @input payloadJson: 通常JSON文字列。expectedRepositoryBindingId: 期待結合。
 * @returns Hash付きJSON文字列、または停止結果。
 * @precondition 実体Repositoryの結合検証は呼出し元が別途行う。
 * @postcondition Schemaと全payloadをHash対象とし、未知項目を落として正当化しない。
 * @effect N/A: 保存、Lock、移行と外部送信を行わない。
 * @failure 不正JSON、結合、値または16MiB超過を拒否する。
 * @invariant 完全state.jsonとして保存できる形式ではない。
 * @boundary 文字列入力だけを受け、getterやtoJSONを実行しない。
 * @security Lease、DecisionとAuthorityを生成しない。
 * @concurrency N/A: 外部状態を読書きしない純粋codec。
 */
export function encodeProjectRuntimeStateQueueSnapshotPilot(
  payloadJson: string,
  expectedRepositoryBindingId: string,
): StoreResult<string> {
  try {
    if (
      typeof payloadJson !== "string" ||
      Buffer.byteLength(payloadJson, "utf8") > MAX_RECORD_BYTES
    )
      return blocked("project_runtime_snapshot_pilot_invalid", false);
    const payload: unknown = JSON.parse(payloadJson);
    if (
      !validStateQueueSnapshotPilotPayload(payload, expectedRepositoryBindingId)
    )
      return blocked("project_runtime_snapshot_pilot_invalid", false);
    const bytes = `${JSON.stringify({ payload, contentHash: digest(JSON.stringify(payload)) })}\n`;
    if (Buffer.byteLength(bytes, "utf8") > MAX_RECORD_BYTES)
      return blocked("project_runtime_snapshot_pilot_invalid", false);
    return completed("project_runtime_snapshot_pilot_encoded", bytes);
  } catch {
    return blocked("project_runtime_snapshot_pilot_invalid", false);
  }
}

/**
 * 試行EnvelopeのHash・Schema・結合を復号時に再検証する。
 *
 * @responsibility 破損・未知項目を拒否して独立した値を返す。
 * @trace ARCH-000004
 * @input bytes: Hash付きJSON文字列。expectedRepositoryBindingId: 期待結合。
 * @returns State／Queue部分payload、または停止結果。
 * @precondition 完全な移行入力や保存保証として利用しない。
 * @postcondition parse前のByte上限とparse後の閉じたSchemaを確認する。
 * @effect N/A: Filesystemと共有状態を変更しない。
 * @failure JSON、Hash、結合、参照、上限の不正を拒否する。
 * @invariant 過去QueueのMilestone／Revision差だけで履歴を失わない。
 * @boundary 文字列から独立した内部値への境界。
 * @security 受理はAuthority、移行確定またはRepository実体証明ではない。
 * @concurrency N/A: 排他やWriter停止を証明しない。
 */
export function decodeProjectRuntimeStateQueueSnapshotPilot(
  bytes: string,
  expectedRepositoryBindingId: string,
): StoreResult<StateQueueSnapshotPilotPayload> {
  try {
    if (
      typeof bytes !== "string" ||
      Buffer.byteLength(bytes, "utf8") > MAX_RECORD_BYTES
    )
      return blocked("project_runtime_snapshot_pilot_invalid", false);
    const envelope: unknown = JSON.parse(bytes);
    if (
      !plainObject(envelope) ||
      !exactKeys(envelope, ["payload", "contentHash"]) ||
      !validStateQueueSnapshotPilotPayload(
        envelope.payload,
        expectedRepositoryBindingId,
      ) ||
      envelope.contentHash !== digest(JSON.stringify(envelope.payload))
    )
      return blocked("project_runtime_snapshot_pilot_invalid", false);
    return completed(
      "project_runtime_snapshot_pilot_decoded",
      envelope.payload,
    );
  } catch {
    return blocked("project_runtime_snapshot_pilot_invalid", false);
  }
}

/**
 * 旧形式の状態とQueueを全世代検証し、集約保存の入力候補を読み取る。
 *
 * @responsibility 旧記録の欠番・内容・結合を検証し、最新値と導出元を返す。
 * @trace ARCH-000004
 * @input workingDirectory: 検証対象Repository内のDirectory。
 * @returns 最新State、Queueと全世代の正規化Envelope Hash。移行済み結果ではない。
 * @precondition 対象がVersion Control Repositoryとして一意に解決できる。
 * @postcondition 一件でも不正・観測不能なら候補を返さず停止する。
 * @effect Filesystemの読取りだけ。Directoryの作成、切替、回収はしない。
 * @failure 不正Root、記録の欠番、内容不一致、読取不能を拒否する。
 * @invariant 終端Queueも残し、再受付防止情報や回復義務を落とさない。
 * @boundary Repository-localな旧State／Queueから移行準備への境界。
 * @security 保護されたDecision、Lease、結果を移行済みと扱わず、Authorityを発行しない。
 * @concurrency 排他を取得しない読取り候補。旧Writer停止や一貫Snapshotの証明には使わない。
 */
export function readLegacyProjectRuntimeStateAndQueueInputs(
  workingDirectory: string,
): StoreResult<LegacyProjectRuntimeInputs> {
  try {
    const paths = resolveProjectRuntimeNamedPaths(workingDirectory);
    if (!paths) return blocked("project_runtime_repository_root_invalid");
    assertDirectory(paths.repositoryRoot);
    const states: Envelope[] = [];
    const queues: Envelope[] = [];
    const sourceRecords: Readonly<{
      relativePath: string;
      normalizedEnvelopeHash: string;
    }>[] = [];
    const boundary = observeProjectRuntimeArea(
      paths.repositoryRoot,
      "project-runtime",
    );
    if (boundary.status === "not_observed") {
      assertProjectRuntimeAreaUnchanged(
        paths.repositoryRoot,
        "project-runtime",
        boundary,
      );
      return completed(
        "project_runtime_legacy_inputs_observed",
        Object.freeze({
          states: Object.freeze(states),
          queues: Object.freeze(queues),
          sourceRecords: Object.freeze(sourceRecords),
          migrationCommitted: false as const,
        }),
      );
    }
    for (const area of ["state", "queues"] as const) {
      const directory = path.join(paths.projectRuntime, area);
      try {
        fs.lstatSync(directory);
      } catch (error) {
        if (errorCode(error) === "ENOENT") {
          assertDirectory(paths.projectRuntime);
          continue;
        }
        throw error;
      }
      assertProjectRuntimeAreaUnchanged(
        paths.repositoryRoot,
        "project-runtime",
        boundary,
      );
      assertDirectory(directory);
      const names = fs.readdirSync(directory).sort();
      if (names.length > 4096 || names.some((name) => !validId(name)))
        throw new Error("project_runtime_legacy_inventory_invalid");
      for (const name of names) {
        const records = [
          ...readEnvelopes(path.join(directory, name), "generation-", true),
        ].sort(
          (left, right) => left.updatedGeneration - right.updatedGeneration,
        );
        const latest = records.at(-1);
        if (!latest) {
          if (area === "queues")
            throw new Error("project_runtime_legacy_queue_empty");
          continue;
        }
        if (area === "queues") {
          if (
            validatedQueueHistory(records, latest.repositoryBindingId, name) ===
            null
          )
            throw new Error("project_runtime_legacy_queue_mismatch");
          queues.push(latest);
        } else {
          if (
            records.some(
              (record) =>
                record.recordKind !== "project-state" ||
                record.repositoryBindingId !== latest.repositoryBindingId ||
                record.projectId !== name ||
                !validProjectRuntimeState(record.content) ||
                record.content.projectId !== name,
            )
          )
            throw new Error("project_runtime_legacy_state_mismatch");
          states.push(latest);
        }
        for (const record of records) {
          sourceRecords.push(
            Object.freeze({
              relativePath: `${area}/${name}/generation-${record.updatedGeneration}.json`,
              normalizedEnvelopeHash: digest(JSON.stringify(record)),
            }),
          );
        }
      }
    }
    assertProjectRuntimeAreaUnchanged(
      paths.repositoryRoot,
      "project-runtime",
      boundary,
    );
    return completed(
      "project_runtime_legacy_inputs_observed",
      Object.freeze({
        states: Object.freeze(states),
        queues: Object.freeze(queues),
        sourceRecords: Object.freeze(sourceRecords),
        migrationCommitted: false as const,
      }),
    );
  } catch {
    return blocked("project_runtime_legacy_inputs_invalid_or_unknown");
  }
}

/**
 * 旧Lease保存の全入力と物理残存を定義する。
 *
 * @responsibility 取得・解放証拠と途中残存を区別して保持する。
 * @trace ARCH-000004
 * @shape evidence、footprints、sourceRecords、migrationCommitted。
 * @invariant File読取りだけでOwner終了・排他・移行成立を表示しない。footprintsのRepository・Project結合は後続の統合照合まで未確定。
 * @boundary 旧保存から移行準備への内部境界。
 * @security 保護DecisionとAuthorityを含めない。
 * @compatibility 既存Lease handleとWriterを変更しない。
 */
type LegacyLeaseInputs = Readonly<{
  evidence: readonly LeaseEvidenceEnvelope[];
  footprints: readonly Readonly<{
    relativePath: string;
    kind: "lock" | "acquisition" | "ownership" | "release" | "temporary";
    value: LeaseAcquisitionMarker | string | null;
  }>[];
  sourceRecords: readonly Readonly<{ relativePath: string; sha256: string }>[];
  migrationCommitted: false;
}>;

/**
 * 旧Lease証拠と途中残存を、変更せず全件抽出する。
 *
 * @responsibility 保存統合で失ってはいけないLease入力の検証と保全を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: 対象Repository内の起点。
 * @returns 証拠・途中残存・元Byte列Hash、または停止結果。
 * @precondition Version Control Rootが一意に検証できる。
 * @postcondition acquiredと終了証拠の結合を確認する。途中残存は収集だけを行い有効Leaseへ採用しない。
 * @effect Filesystemの読取りのみ。作成・削除・Process操作なし。
 * @failure 不正親、列挙後消失、未知項目、Hash・Owner差、観測不能で停止する。
 * @invariant 過去の解放証拠だけで現在のOwner不存在を推定しない。
 * @boundary Repository-localの旧recovery/leasesとwork/locks。
 * @security 外部hardlink・aliasを拒否し、本文を診断出力しない。
 * @concurrency 各読取り時点の確認。旧Writer停止と一貫Snapshotは別途必要。
 */
export function readLegacyProjectRuntimeLeaseInputs(
  workingDirectory: string,
): StoreResult<LegacyLeaseInputs> {
  try {
    const paths = resolveProjectRuntimeNamedPaths(workingDirectory);
    if (!paths) throw new Error("legacy_lease_root_invalid");
    const root = paths.repositoryRoot;
    assertDirectory(root);
    const boundary = observeProjectRuntimeArea(root, "project-runtime");
    const observedParents = [root];
    /**
     * 親領域の真正不存在だけを許可する。
     * @responsibility 初回lstat後の失敗を不存在へ畳まない。
     * @trace ARCH-000004
     * @input directory: Root内の親Path。
     * @returns 正規Directoryならtrue、真正不存在ならfalse。
     * @precondition 祖先を順に確認する。
     * @postcondition 不存在の場合も確認済み祖先が正規である。
     * @effect 読取りのみ。
     * @failure 観測不能・途中消失・aliasで例外。
     * @invariant 空結果を不明の代用にしない。
     * @boundary Filesystem。
     * @security Rootの外を列挙しない。
     * @concurrency Writer停止を証明しない。
     */
    const parentExists = (directory: string): boolean => {
      try {
        fs.lstatSync(directory);
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
        for (const parent of observedParents) assertDirectory(parent);
        return false;
      }
      assertDirectory(directory);
      observedParents.push(directory);
      return true;
    };
    const evidence: LeaseEvidenceEnvelope[] = [];
    const footprints: LegacyLeaseInputs["footprints"][number][] = [];
    const sourceRecords: LegacyLeaseInputs["sourceRecords"][number][] = [];
    /**
     * 読取り済み入力を変更不能な結果へまとめる。
     * @responsibility 移行未実施の入力だけを返す。
     * @trace ARCH-000004
     * @input N/A: 同期読取り内の局所配列を参照する。
     * @returns 旧証拠と残存情報の読取り結果。
     * @precondition 各入力の検証が成功している。
     * @postcondition migrationCommittedはfalseである。
     * @effect N/A: 結果構築だけを行う。
     * @failure N/A: 不正入力は呼出し前に拒否する。
     * @invariant 読取りを移行完了へ昇格しない。
     * @boundary 局所配列から返却値。
     * @security 本文の外部送信を行わない。
     * @concurrency N/A: 同期処理内で完結する。
     */
    const result = () => {
      assertProjectRuntimeAreaUnchanged(root, "project-runtime", boundary);
      return completed(
        "project_runtime_legacy_leases_observed",
        Object.freeze({
          evidence: Object.freeze(evidence),
          footprints: Object.freeze(footprints),
          sourceRecords: Object.freeze(sourceRecords),
          migrationCommitted: false as const,
        }),
      );
    };
    if (boundary.status === "not_observed") return result();
    observedParents.push(boundary.directory);
    /**
     * 一つの旧Fileを同handleで読取り、元bytesを記録する。
     * @responsibility 安定したUTF-8入力と導出元Hashを返す。
     * @trace ARCH-000004
     * @input location: 列挙済みのexact File。
     * @returns UTF-8本文。
     * @precondition 正規の親Directoryを確認済み。
     * @postcondition 元bytesのHashと相対Pathを記録済み。
     * @effect 読取りのみ。
     * @failure 不正UTF-8、観測不能、読取り中変更で例外。
     * @invariant 正規化Hashと元bytes Hashを混同しない。
     * @boundary FilesystemからJSON復号。
     * @security 本文をlogや外部へ複製しない。
     * @concurrency 親とFileを再確認する。
     */
    const read = (location: string): string => {
      const snapshot = readStableBoundedFileSnapshot(
        location,
        MAX_RECORD_BYTES,
      );
      for (const parent of observedParents) assertDirectory(parent);
      sourceRecords.push(
        Object.freeze({
          relativePath: path
            .relative(paths.projectRuntime, location)
            .split(path.sep)
            .join("/"),
          sha256: createHash("sha256").update(snapshot.bytes).digest("hex"),
        }),
      );
      return new TextDecoder("utf-8", { fatal: true }).decode(snapshot.bytes);
    };
    const recovery = path.join(paths.projectRuntime, "recovery");
    if (parentExists(recovery)) {
      const directory = path.join(recovery, "leases");
      if (parentExists(directory)) {
        const names = fs.readdirSync(directory).sort();
        for (const name of names) {
          const location = path.join(directory, name);
          if (!name.endsWith(".json") || fs.lstatSync(location).nlink !== 1)
            throw new Error("legacy_lease_file_invalid");
          const value: unknown = JSON.parse(read(location));
          if (
            !plainObject(value) ||
            !exactKeys(value, [
              "schema",
              "schemaRevision",
              "recordKind",
              "repositoryBindingId",
              "projectId",
              "createdGeneration",
              "updatedGeneration",
              "contentHash",
              "content",
            ]) ||
            value.schema !== PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT ||
            value.schemaRevision !== 1 ||
            value.recordKind !== "lease-evidence" ||
            !validId(value.repositoryBindingId) ||
            !validId(value.projectId) ||
            !validLeaseEvidence(value.content)
          )
            throw new Error("legacy_lease_record_invalid");
          const record = value as unknown as LeaseEvidenceEnvelope;
          const content = record.content;
          const suffix =
            content.disposition === "acquired"
              ? ""
              : content.disposition === "released"
                ? "-released"
                : "-recovered";
          const expectedName = `${leaseIdentity(record.repositoryBindingId, record.projectId, content.queueId, content.kind)}-${content.ownerGeneration}${suffix}.json`;
          if (
            name !== expectedName ||
            record.createdGeneration !== 1 ||
            record.updatedGeneration !==
              (content.disposition === "acquired" ? 1 : 2) ||
            record.contentHash !== digest(JSON.stringify(content)) ||
            fs.lstatSync(location).nlink !== 1
          )
            throw new Error("legacy_lease_record_mismatch");
          evidence.push(Object.freeze(record));
        }
        assertDirectory(directory);
        if (
          JSON.stringify(fs.readdirSync(directory).sort()) !==
          JSON.stringify(names)
        )
          throw new Error("legacy_lease_inventory_changed");
      }
    }
    const groups = new Map<string, LeaseEvidenceEnvelope[]>();
    for (const record of evidence) {
      const key = `${leaseIdentity(record.repositoryBindingId, record.projectId, record.content.queueId, record.content.kind)}\0${record.content.ownerGeneration}`;
      const groupRecords = groups.get(key) ?? [];
      groupRecords.push(record);
      groups.set(key, groupRecords);
    }
    for (const groupRecords of groups.values()) {
      const acquired = groupRecords.find(
        (item) => item.content.disposition === "acquired",
      );
      if (
        !acquired ||
        groupRecords.length > 2 ||
        new Set(groupRecords.map((item) => item.content.disposition)).size !==
          groupRecords.length ||
        groupRecords.some(
          (item) =>
            item.repositoryBindingId !== acquired.repositoryBindingId ||
            item.projectId !== acquired.projectId ||
            item.content.queueId !== acquired.content.queueId ||
            item.content.ownerProcessId !== acquired.content.ownerProcessId,
        )
      )
        throw new Error("legacy_lease_group_mismatch");
    }
    const work = path.join(paths.projectRuntime, "work");
    if (parentExists(work)) {
      const locks = path.join(work, "locks");
      if (parentExists(locks)) {
        const names = fs.readdirSync(locks).sort();
        const fileIdentities = new Map<
          string,
          { dev: number; ino: number; nlink: number }
        >();
        for (const name of names) {
          if (!/^[A-Za-z0-9._-]{1,512}$/u.test(name))
            throw new Error("legacy_lease_name_invalid");
          const location = path.join(locks, name);
          const stat = fs.lstatSync(location);
          if (stat.isSymbolicLink()) throw new Error("legacy_lease_alias");
          const relativePath = `work/locks/${name}`;
          if (stat.isDirectory()) {
            if (!name.endsWith(".lock"))
              throw new Error("legacy_lease_directory_invalid");
            assertDirectory(location);
            if (fs.readdirSync(location).length !== 0)
              throw new Error("legacy_lease_lock_contents_invalid");
            footprints.push(
              Object.freeze({ relativePath, kind: "lock", value: null }),
            );
            continue;
          }
          if (!stat.isFile()) throw new Error("legacy_lease_type_invalid");
          const text = read(location);
          fileIdentities.set(name, {
            dev: stat.dev,
            ino: stat.ino,
            nlink: stat.nlink,
          });
          if (name.endsWith(".release-unknown")) {
            const owner = text.endsWith("\n") ? text.slice(0, -1) : "";
            if (!validId(owner) || stat.nlink !== 1)
              throw new Error("legacy_lease_release_invalid");
            footprints.push(
              Object.freeze({ relativePath, kind: "release", value: owner }),
            );
          } else {
            const kind = name.endsWith(".acquire-pending")
              ? "acquisition"
              : name.endsWith(".acquire-lock-owned")
                ? "ownership"
                : /^\.pending-.+-acquisition-.+\.tmp$/u.test(name)
                  ? "temporary"
                  : null;
            const parsed: unknown = JSON.parse(text);
            if (
              !kind ||
              !plainObject(parsed) ||
              !exactKeys(parsed, [
                "kind",
                "queueId",
                "ownerGeneration",
                "ownerProcessId",
                "recoveryId",
              ]) ||
              (parsed.kind !== "project-operation" &&
                parsed.kind !== "canonical-adoption") ||
              !validId(parsed.queueId) ||
              !validId(parsed.ownerGeneration) ||
              !validId(parsed.recoveryId) ||
              !Number.isSafeInteger(parsed.ownerProcessId) ||
              Number(parsed.ownerProcessId) < 1
            )
              throw new Error("legacy_lease_marker_invalid");
            footprints.push(
              Object.freeze({
                relativePath,
                kind,
                value: Object.freeze(parsed as LeaseAcquisitionMarker),
              }),
            );
          }
        }
        for (const [name, file] of fileIdentities) {
          const current = fs.lstatSync(path.join(locks, name));
          if (
            !current.isFile() ||
            current.isSymbolicLink() ||
            current.dev !== file.dev ||
            current.ino !== file.ino ||
            current.nlink !== file.nlink
          )
            throw new Error("legacy_lease_file_changed");
          const aliases = [...fileIdentities.values()].filter(
            (other) => file.dev === other.dev && file.ino === other.ino,
          );
          if (file.nlink !== aliases.length)
            throw new Error("legacy_lease_external_hardlink");
        }
        assertDirectory(locks);
        if (
          JSON.stringify(fs.readdirSync(locks).sort()) !== JSON.stringify(names)
        )
          throw new Error("legacy_lease_inventory_changed");
      }
    }
    for (const parent of observedParents) assertDirectory(parent);
    return result();
  } catch {
    return blocked("project_runtime_legacy_leases_invalid_or_unknown");
  }
}

/**
 * with Mutation Lockを決定する。
 *
 * @responsibility with Mutation Lockの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input runtime: string、identity: string、operation: () => StoreResult<T>
 * @returns withMutationLockの計算結果を返す。
 * @precondition 「runtime: string、identity: string、operation: () => StoreResult<T>」がwithMutationLockの入力契約を満たす。
 * @postcondition withMutationLockの責務を完了した結果だけを返す。
 * @effect withMutationLockはFilesystemの読取りまたは書込みを実行する。
 * @failure withMutationLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant withMutationLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security withMutationLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: withMutationLockは共有非同期状態を持たない同期処理である。
 */
function withMutationLock<T>(
  runtime: string,
  identity: string,
  operation: () => StoreResult<T>,
) {
  const locks = lockRoot(runtime);
  const lock = path.join(locks, `${identity}.lock`);
  try {
    fs.mkdirSync(lock, { mode: 0o700 });
  } catch (error) {
    return errorCode(error) === "EEXIST"
      ? blocked<T>("project_runtime_lock_unavailable")
      : blocked<T>("project_runtime_mutation_observation_unknown", true);
  }
  let result: StoreResult<T>;
  try {
    assertDirectory(lock);
    result = operation();
  } catch {
    result = blocked<T>("project_runtime_mutation_observation_unknown", true);
  }
  try {
    fs.rmdirSync(lock);
    if (fs.existsSync(lock))
      return blocked<T>("project_runtime_mutation_lock_release_unknown", true);
  } catch {
    return blocked<T>("project_runtime_mutation_lock_release_unknown", true);
  }
  return result;
}

/**
 * Project Runtime 状態を書き込む。
 *
 * @responsibility Project Runtime 状態の書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、state: ProjectRuntimeState、expectedGeneration: number
 * @returns StoreResult<ProjectRuntimeState>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、state: ProjectRuntimeState、expectedGeneration: number」がwriteProjectRuntimeStateの入力契約を満たす。
 * @postcondition writeProjectRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: writeProjectRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure writeProjectRuntimeStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeProjectRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeProjectRuntimeStateはProcess内の同一Subsystemで完結する。
 * @security writeProjectRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeProjectRuntimeStateは共有非同期状態を持たない同期処理である。
 */
export function writeProjectRuntimeState(
  workingDirectory: string,
  repositoryBindingId: string,
  state: ProjectRuntimeState,
  expectedGeneration: number,
): StoreResult<ProjectRuntimeState> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validProjectRuntimeState(state) ||
      state.generation !== expectedGeneration + 1
    )
      return blocked("project_runtime_state_generation_mismatch");
    const { runtime } = storageRoot(workingDirectory);
    const states = ensureDirectory(runtime, "state");
    const project = ensureDirectory(states, state.projectId);
    return withMutationLock(runtime, `state-${state.projectId}`, () => {
      const existingItems = readEnvelopes(project, "generation-");
      const latest = existingItems.reduce(
        (maximum, item) => Math.max(maximum, item.updatedGeneration),
        0,
      );
      if (latest !== expectedGeneration)
        return blocked("project_runtime_state_generation_conflict");
      const record = envelope(
        "project-state",
        repositoryBindingId,
        state.projectId,
        1,
        state.generation,
        state,
      );
      atomicCreateAndReadBack(
        project,
        `generation-${state.generation}.json`,
        record,
      );
      return completed("project_runtime_state_durable", state);
    });
  } catch {
    return blocked("project_runtime_state_observation_unknown", true);
  }
}

/**
 * Project Runtime 状態を読み取る。
 *
 * @responsibility Project Runtime 状態の読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、projectId: string
 * @returns StoreResult<ProjectRuntimeState | null>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、projectId: string」がreadProjectRuntimeStateの入力契約を満たす。
 * @postcondition readProjectRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: readProjectRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readProjectRuntimeStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readProjectRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readProjectRuntimeStateはProcess内の同一Subsystemで完結する。
 * @security readProjectRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readProjectRuntimeStateは共有非同期状態を持たない同期処理である。
 */
export function readProjectRuntimeState(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
): StoreResult<ProjectRuntimeState | null> {
  try {
    if (!validId(repositoryBindingId) || !validId(projectId))
      return blocked("project_runtime_state_identity_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const project = path.join(runtime, "state", projectId);
    const records = readEnvelopes(project, "generation-");
    if (records.length === 0)
      return completed("project_runtime_state_absent", null);
    if (
      records.some(
        (record) =>
          record.recordKind !== "project-state" ||
          record.repositoryBindingId !== repositoryBindingId ||
          record.projectId !== projectId,
      )
    )
      return blocked("project_runtime_state_record_mismatch", true);
    const orderedRecords = [...records].sort(
      (left, right) => left.updatedGeneration - right.updatedGeneration,
    );
    const latest = orderedRecords.at(-1);
    if (!latest)
      return blocked("project_runtime_state_observation_unknown", true);
    const state = latest.content;
    if (
      !validProjectRuntimeState(state) ||
      state.projectId !== projectId ||
      state.generation !== latest.updatedGeneration
    )
      return blocked("project_runtime_state_record_mismatch", true);
    return completed("project_runtime_state_observed", state);
  } catch {
    return blocked("project_runtime_state_observation_unknown", true);
  }
}

/**
 * enqueue Project Operationを決定する。
 *
 * @responsibility enqueue Project Operationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、input: Omit< ProjectQueueEntry, | "state" | "generation" | "ownerGeneration" | "resumeCondition" | "resultReference" >
 * @returns StoreResult<ProjectQueueEntry>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、input: Omit< ProjectQueueEntry, | "state" | "generation" | "ownerGeneration" | "resumeCondition" | "resultReference" >」がenqueueProjectOperationの入力契約を満たす。
 * @postcondition enqueueProjectOperationの責務を完了した結果だけを返す。
 * @effect N/A: enqueueProjectOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure enqueueProjectOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant enqueueProjectOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: enqueueProjectOperationはProcess内の同一Subsystemで完結する。
 * @security enqueueProjectOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: enqueueProjectOperationは共有非同期状態を持たない同期処理である。
 */
export function enqueueProjectOperation(
  workingDirectory: string,
  repositoryBindingId: string,
  input: Omit<
    ProjectQueueEntry,
    | "state"
    | "generation"
    | "ownerGeneration"
    | "resumeCondition"
    | "resultReference"
  >,
): StoreResult<ProjectQueueEntry> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(input.queueId) ||
      !validId(input.projectId) ||
      !validId(input.milestoneId) ||
      !HASH.test(input.requestHash) ||
      !HASH.test(input.scopeHash) ||
      !REVISION.test(input.repositoryRevision)
    )
      return blocked("project_runtime_queue_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const queue = ensureDirectory(runtime, "queues");
    const entryDirectory = ensureDirectory(queue, input.queueId);
    return withMutationLock(runtime, "queue-mutation", () => {
      const observedItems = readEnvelopes(entryDirectory, "generation-");
      const existingItems = validatedQueueHistory(
        observedItems,
        repositoryBindingId,
        input.queueId,
        input.projectId,
      );
      if (existingItems === null)
        return blocked("project_runtime_queue_record_mismatch", true);
      if (existingItems.length > 0) {
        const currentEnvelope = existingItems.at(-1);
        if (!currentEnvelope)
          return blocked("project_runtime_queue_observation_unknown", true);
        const current = currentEnvelope.content;
        if (
          currentEnvelope.recordKind !== "queue-entry" ||
          !validQueueEntry(current) ||
          current.generation !== currentEnvelope.updatedGeneration ||
          current.queueId !== input.queueId ||
          currentEnvelope.repositoryBindingId !== repositoryBindingId ||
          currentEnvelope.projectId !== input.projectId
        )
          return blocked("project_runtime_queue_record_mismatch", true);
        return current.requestHash === input.requestHash &&
          current.projectId === input.projectId &&
          current.milestoneId === input.milestoneId
          ? completed("project_runtime_queue_request_reused", current)
          : blocked("project_runtime_queue_identity_conflict");
      }
      const value: ProjectQueueEntry = Object.freeze({
        ...input,
        state: "queued",
        generation: 1,
        ownerGeneration: null,
        resumeCondition: null,
        resultReference: null,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        "generation-1.json",
        envelope(
          "queue-entry",
          repositoryBindingId,
          input.projectId,
          1,
          1,
          value,
        ),
      );
      return completed("project_runtime_queue_entry_durable", value);
    });
  } catch {
    return blocked("project_runtime_queue_observation_unknown", true);
  }
}

/**
 * Project Operation Queue 状態を読み取る。
 *
 * @responsibility Project Operation Queue 状態の読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、queueId: string
 * @returns StoreResult<ProjectQueueEntry>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、queueId: string」がreadProjectOperationQueueStateの入力契約を満たす。
 * @postcondition readProjectOperationQueueStateの責務を完了した結果だけを返す。
 * @effect N/A: readProjectOperationQueueStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readProjectOperationQueueStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readProjectOperationQueueStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readProjectOperationQueueStateはProcess内の同一Subsystemで完結する。
 * @security readProjectOperationQueueStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readProjectOperationQueueStateは共有非同期状態を持たない同期処理である。
 */
export function readProjectOperationQueueState(
  workingDirectory: string,
  repositoryBindingId: string,
  queueId: string,
): StoreResult<ProjectQueueEntry> {
  try {
    if (!validId(repositoryBindingId) || !validId(queueId))
      return blocked("project_runtime_queue_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const entryDirectory = path.join(runtime, "queues", queueId);
    const existingItems = validatedQueueHistory(
      readEnvelopes(entryDirectory, "generation-"),
      repositoryBindingId,
      queueId,
    );
    if (existingItems === null)
      return blocked("project_runtime_queue_record_mismatch", true);
    const currentEnvelope = existingItems.at(-1);
    if (!currentEnvelope)
      return blocked("project_runtime_queue_observation_unknown", true);
    const current = currentEnvelope.content;
    if (
      currentEnvelope.recordKind !== "queue-entry" ||
      !validQueueEntry(current) ||
      current.generation !== currentEnvelope.updatedGeneration ||
      current.queueId !== queueId ||
      currentEnvelope.repositoryBindingId !== repositoryBindingId ||
      currentEnvelope.projectId !== current.projectId
    )
      return blocked("project_runtime_queue_record_mismatch", true);
    return completed("project_runtime_queue_observed", current);
  } catch {
    return blocked("project_runtime_queue_observation_unknown", true);
  }
}

/**
 * Select the next unowned operation without preempting active work.
 *
 * @responsibility Next Project Operationの候補集合、選択理由、選択不能時の境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string
 * @returns StoreResult<ProjectQueueEntry | null>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string」がselectNextProjectOperationの入力契約を満たす。
 * @postcondition selectNextProjectOperationの責務を完了した結果だけを返す。
 * @effect selectNextProjectOperationはFilesystemの読取りまたは書込みを実行する。
 * @failure selectNextProjectOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant selectNextProjectOperationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security selectNextProjectOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: selectNextProjectOperationは共有非同期状態を持たない同期処理である。
 */
export function selectNextProjectOperation(
  workingDirectory: string,
  repositoryBindingId: string,
): StoreResult<ProjectQueueEntry | null> {
  try {
    if (!validId(repositoryBindingId))
      return blocked("project_runtime_queue_selection_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const queueRoot = path.join(runtime, "queues");
    if (!fs.existsSync(queueRoot))
      return completed("project_runtime_queue_empty", null);
    assertDirectory(queueRoot);
    const names = fs.readdirSync(queueRoot).sort();
    if (names.length > 4096 || names.some((name) => !validId(name)))
      return blocked("project_runtime_queue_inventory_invalid", true);
    const entries: ProjectQueueEntry[] = [];
    for (const name of names) {
      const entryDirectory = path.join(queueRoot, name);
      assertDirectory(entryDirectory);
      const records = readEnvelopes(entryDirectory, "generation-");
      const observedBinding = records[0]?.repositoryBindingId;
      if (
        !observedBinding ||
        validatedQueueHistory(records, observedBinding, name) === null
      )
        return blocked("project_runtime_queue_record_mismatch", true);
      // A Project binding owns only its own queue. Another valid binding is
      // isolated rather than reinterpreted as corruption of the caller's
      // queue population.
      if (observedBinding !== repositoryBindingId) continue;
      const observed = readProjectOperationQueueState(
        workingDirectory,
        repositoryBindingId,
        name,
      );
      if (observed.status !== "completed")
        return blocked(observed.reason, observed.manualRecoveryRequired);
      entries.push(observed.value);
    }
    // Queue priority applies only between operations that are not yet owned.
    // Once any operation is leased or running, selecting a second queue would
    // violate the Project concurrency boundary before task scheduling can
    // reject it.  Keep later arrivals effect-free until the active owner has
    // reached a terminal/recoverable state and released its lease.
    const active = entries.find((entry) => entry.ownerGeneration !== null);
    if (active) {
      for (const scheduled of entries.filter(
        (entry) =>
          entry.originLane === "scheduled" &&
          entry.state === "queued" &&
          entry.ownerGeneration === null,
      )) {
        const parked = updateProjectOperationQueueState(
          workingDirectory,
          repositoryBindingId,
          scheduled.queueId,
          scheduled.generation,
          {
            state: "waiting_foreground",
            lease: null,
            resumeCondition: "active_operation_pending",
            resultReference: null,
          },
        );
        if (parked.status !== "completed")
          return blocked(parked.reason, parked.manualRecoveryRequired);
      }
      return completed("project_runtime_active_operation_retained", null);
    }
    const interactive = entries.find(
      (entry) =>
        entry.originLane === "interactive" &&
        entry.state === "queued" &&
        entry.ownerGeneration === null,
    );
    if (interactive) {
      for (const scheduled of entries.filter(
        (entry) =>
          entry.originLane === "scheduled" &&
          entry.state === "queued" &&
          entry.ownerGeneration === null,
      )) {
        const parked = updateProjectOperationQueueState(
          workingDirectory,
          repositoryBindingId,
          scheduled.queueId,
          scheduled.generation,
          {
            state: "waiting_foreground",
            lease: null,
            resumeCondition: "interactive_queue_pending",
            resultReference: null,
          },
        );
        if (parked.status !== "completed")
          return blocked(parked.reason, parked.manualRecoveryRequired);
      }
      return completed(
        "project_runtime_interactive_queue_selected",
        interactive,
      );
    }
    const waiting = entries.find(
      (entry) =>
        entry.originLane === "scheduled" &&
        entry.state === "waiting_foreground" &&
        entry.ownerGeneration === null,
    );
    if (waiting) {
      const woken = updateProjectOperationQueueState(
        workingDirectory,
        repositoryBindingId,
        waiting.queueId,
        waiting.generation,
        {
          state: "queued",
          lease: null,
          resumeCondition: null,
          resultReference: null,
        },
      );
      return woken.status === "completed"
        ? completed("project_runtime_scheduled_queue_selected", woken.value)
        : blocked(woken.reason, woken.manualRecoveryRequired);
    }
    const scheduled = entries.find(
      (entry) =>
        entry.originLane === "scheduled" &&
        entry.state === "queued" &&
        entry.ownerGeneration === null,
    );
    return completed(
      scheduled
        ? "project_runtime_scheduled_queue_selected"
        : "project_runtime_queue_empty",
      scheduled ?? null,
    );
  } catch {
    return blocked("project_runtime_queue_selection_observation_unknown", true);
  }
}

const QUEUE_TRANSITIONS = Object.freeze({
  queued: Object.freeze(["leased", "waiting_foreground", "cancelled"]),
  leased: Object.freeze([
    "running",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  running: Object.freeze([
    "integration_pending",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  waiting_foreground: Object.freeze(["queued", "cancelled"]),
  integration_pending: Object.freeze([
    "completed",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  replan_required: Object.freeze([
    "queued",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  human_decision_required: Object.freeze([
    "replan_required",
    "recovery_required",
    "cancelled",
  ]),
  recovery_required: Object.freeze([
    "queued",
    "recovery_required",
    "cancelled",
  ]),
  completed: Object.freeze([]),
  cancelled: Object.freeze([]),
} satisfies Record<ProjectQueueState, readonly ProjectQueueState[]>);

/**
 * Project Operation Queue 状態を更新する。
 *
 * @responsibility Project Operation Queue 状態の更新対象、競合条件、更新結果の境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、queueId: string、expectedGeneration: number、next: Readonly<{ state: ProjectQueueState; lease: ProjectRuntimeLease | null; resumeCondition: string | null; resultReference: string | null; }>
 * @returns StoreResult<ProjectQueueEntry>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、queueId: string、expectedGeneration: number、next: Readonly<{ state: ProjectQueueState; lease: ProjectRuntimeLease | null; resumeCondition: string | null; resultReference: string | null; }>」がupdateProjectOperationQueueStateの入力契約を満たす。
 * @postcondition updateProjectOperationQueueStateの責務を完了した結果だけを返す。
 * @effect N/A: updateProjectOperationQueueStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure updateProjectOperationQueueStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant updateProjectOperationQueueStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: updateProjectOperationQueueStateはProcess内の同一Subsystemで完結する。
 * @security updateProjectOperationQueueStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: updateProjectOperationQueueStateは共有非同期状態を持たない同期処理である。
 */
export function updateProjectOperationQueueState(
  workingDirectory: string,
  repositoryBindingId: string,
  queueId: string,
  expectedGeneration: number,
  next: Readonly<{
    state: ProjectQueueState;
    lease: ProjectRuntimeLease | null;
    resumeCondition: string | null;
    resultReference: string | null;
  }>,
): StoreResult<ProjectQueueEntry> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(queueId) ||
      !Number.isSafeInteger(expectedGeneration) ||
      expectedGeneration < 1
    )
      return blocked("project_runtime_queue_update_invalid");
    if (next.resumeCondition !== null && !validId(next.resumeCondition))
      return blocked("project_runtime_queue_resume_condition_invalid");
    if (
      next.resultReference !== null &&
      !validResultReference(next.resultReference)
    )
      return blocked("project_runtime_queue_result_reference_invalid");
    const { repositoryRoot, runtime } = storageRoot(workingDirectory);
    const entryDirectory = path.join(runtime, "queues", queueId);
    return withMutationLock(runtime, "queue-mutation", () => {
      const existingItems = validatedQueueHistory(
        readEnvelopes(entryDirectory, "generation-"),
        repositoryBindingId,
        queueId,
      );
      if (existingItems === null)
        return blocked("project_runtime_queue_record_mismatch", true);
      const currentEnvelope = existingItems.at(-1);
      if (
        !currentEnvelope ||
        currentEnvelope.updatedGeneration !== expectedGeneration
      )
        return blocked("project_runtime_queue_generation_conflict");
      const current = currentEnvelope.content;
      if (
        !validQueueEntry(current) ||
        current.generation !== currentEnvelope.updatedGeneration ||
        current.queueId !== queueId ||
        currentEnvelope.projectId !== current.projectId
      )
        return blocked("project_runtime_queue_record_mismatch", true);
      const allowedTransitions: readonly ProjectQueueState[] =
        QUEUE_TRANSITIONS[current.state] ?? [];
      if (!allowedTransitions.includes(next.state))
        return blocked("project_runtime_queue_transition_invalid");
      if (
        current.state === "recovery_required" &&
        next.state === "recovery_required" &&
        !(
          current.ownerGeneration === null &&
          current.resumeCondition === "owner_loss" &&
          next.lease === null &&
          next.resumeCondition === "exact_recovery" &&
          next.resultReference !== null
        )
      )
        return blocked("project_runtime_queue_recovery_binding_invalid");
      if (
        current.state === "recovery_required" &&
        next.state === "queued" &&
        !(
          current.ownerGeneration === null &&
          current.resumeCondition === "owner_loss" &&
          current.resultReference !== null &&
          next.lease === null &&
          next.resumeCondition === null &&
          next.resultReference === null
        )
      )
        return blocked("project_runtime_queue_owner_loss_reset_invalid");
      const activeLease = next.lease ? activeLeases.get(next.lease) : undefined;
      const nextLeaseRequired = ["leased", "running"].includes(next.state);
      const leaseRequired =
        current.ownerGeneration !== null || nextLeaseRequired;
      if (!leaseRequired && next.lease !== null)
        return blocked("project_runtime_queue_lease_invalid");
      if (leaseRequired) {
        if (
          activeLease?.kind !== "project-operation" ||
          activeLease.repositoryRoot !== repositoryRoot ||
          activeLease.repositoryBindingId !== repositoryBindingId ||
          activeLease.projectId !== current.projectId ||
          activeLease.queueId !== queueId ||
          !activeLeaseIsObserved(activeLease)
        )
          return blocked("project_runtime_queue_lease_invalid");
        if (
          current.ownerGeneration !== null &&
          current.ownerGeneration !== activeLease.ownerGeneration
        )
          return blocked("project_runtime_queue_owner_mismatch");
      }
      // A terminal Queue record is first a durable terminal intent. Its owner
      // remains attached until the physical lock and release evidence have been
      // observed by settleProjectOperationQueueLeaseRelease().
      const ownerGeneration = leaseRequired
        ? (activeLease?.ownerGeneration ?? null)
        : null;
      const value: ProjectQueueEntry = Object.freeze({
        ...current,
        state: next.state,
        ownerGeneration,
        resumeCondition: next.resumeCondition,
        resultReference: next.resultReference,
        generation: current.generation + 1,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        `generation-${value.generation}.json`,
        envelope(
          "queue-entry",
          repositoryBindingId,
          current.projectId,
          1,
          value.generation,
          value,
        ),
      );
      return completed("project_runtime_queue_state_durable", value);
    });
  } catch {
    return blocked("project_runtime_queue_observation_unknown", true);
  }
}

/**
 * Resume a Queue only after its exact Runtime-owned recovery reference has
 *
 * @responsibility Project Operation Queue 回復の確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、queueId: string、expectedGeneration: number、recoveryId: string
 * @returns StoreResult<ProjectQueueEntry>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、queueId: string、expectedGeneration: number、recoveryId: string」がsettleProjectOperationQueueRecoveryの入力契約を満たす。
 * @postcondition settleProjectOperationQueueRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: settleProjectOperationQueueRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure settleProjectOperationQueueRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant settleProjectOperationQueueRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: settleProjectOperationQueueRecoveryはProcess内の同一Subsystemで完結する。
 * @security settleProjectOperationQueueRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleProjectOperationQueueRecoveryは共有非同期状態を持たない同期処理である。
 */
export function settleProjectOperationQueueRecovery(
  workingDirectory: string,
  repositoryBindingId: string,
  queueId: string,
  expectedGeneration: number,
  recoveryId: string,
): StoreResult<ProjectQueueEntry> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(queueId) ||
      !Number.isSafeInteger(expectedGeneration) ||
      expectedGeneration < 1 ||
      !validResultReference(recoveryId)
    )
      return blocked("project_runtime_queue_recovery_settlement_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const entryDirectory = path.join(runtime, "queues", queueId);
    return withMutationLock(runtime, "queue-mutation", () => {
      const historyEntries = validatedQueueHistory(
        readEnvelopes(entryDirectory, "generation-"),
        repositoryBindingId,
        queueId,
      );
      const currentEnvelope = historyEntries?.at(-1);
      if (
        !currentEnvelope ||
        currentEnvelope.updatedGeneration !== expectedGeneration ||
        !validQueueEntry(currentEnvelope.content)
      )
        return blocked("project_runtime_queue_recovery_generation_conflict");
      const current = currentEnvelope.content;
      if (
        current.state !== "recovery_required" ||
        current.ownerGeneration !== null ||
        current.resumeCondition !== "exact_recovery" ||
        current.resultReference !== recoveryId
      )
        return blocked("project_runtime_queue_recovery_identity_mismatch");
      const value: ProjectQueueEntry = Object.freeze({
        ...current,
        state: "queued" as const,
        generation: current.generation + 1,
        ownerGeneration: null,
        resumeCondition: "exact_recovery_settled",
        resultReference: recoveryId,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        `generation-${value.generation}.json`,
        envelope(
          "queue-entry",
          repositoryBindingId,
          current.projectId,
          1,
          value.generation,
          value,
        ),
      );
      return completed("project_runtime_queue_recovery_settled", value);
    });
  } catch {
    return blocked("project_runtime_queue_recovery_settlement_unknown", true);
  }
}

/**
 * Project Runtime Leaseを取得する。
 *
 * @responsibility Project Runtime Leaseの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind
 * @returns StoreResult<ProjectRuntimeLease>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind」がacquireProjectRuntimeLeaseの入力契約を満たす。
 * @postcondition acquireProjectRuntimeLeaseの責務を完了した結果だけを返す。
 * @effect acquireProjectRuntimeLeaseはFilesystemの読取りまたは書込みを実行する。
 * @failure acquireProjectRuntimeLeaseは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant acquireProjectRuntimeLeaseは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security acquireProjectRuntimeLeaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: acquireProjectRuntimeLeaseは共有非同期状態を持たない同期処理である。
 */
export function acquireProjectRuntimeLease(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
): StoreResult<ProjectRuntimeLease> {
  let acquisitionMarker: string | null = null;
  let isAcquisitionMarkerOwned = false;
  let lockOwnershipMarker: string | null = null;
  let isLockOwnershipMarkerOwned = false;
  let lock: string | null = null;
  let isLockOwned = false;
  let acquiredEvidence: string | null = null;
  let recoveryId: string | null = null;
  try {
    if (![repositoryBindingId, projectId, queueId].every(validId))
      return blocked("project_runtime_lease_identity_invalid");
    const { repositoryRoot, runtime } = storageRoot(workingDirectory);
    const locks = lockRoot(runtime);
    const identity = leaseIdentity(
      repositoryBindingId,
      projectId,
      queueId,
      kind,
    );
    lock = path.join(locks, `${identity}.lock`);
    const recoveryMarker = path.join(locks, `${identity}.release-unknown`);
    acquisitionMarker = path.join(locks, `${identity}.acquire-pending`);
    lockOwnershipMarker = path.join(locks, `${identity}.acquire-lock-owned`);
    recoveryId = leaseAcquisitionRecoveryId(
      repositoryBindingId,
      projectId,
      queueId,
      kind,
    );
    if (fs.existsSync(recoveryMarker))
      return blocked(
        "project_runtime_lease_recovery_required",
        true,
        recoveryId,
      );
    if (leaseAcquisitionTemporaryFiles(locks, identity).length > 0)
      return blocked("project_runtime_lease_unavailable");
    if (fs.existsSync(acquisitionMarker))
      return blocked("project_runtime_lease_unavailable");
    if (fs.existsSync(lockOwnershipMarker))
      return blocked("project_runtime_lease_unavailable");
    const ownerGeneration = randomUUID();
    const evidence = leaseEvidenceRoot(runtime);
    try {
      createLeaseAcquisitionMarker(
        locks,
        identity,
        Object.freeze({
          kind,
          queueId,
          ownerGeneration,
          ownerProcessId: process.pid,
          recoveryId,
        }),
      );
      isAcquisitionMarkerOwned = true;
      fs.mkdirSync(lock, { mode: 0o700 });
      isLockOwned = true;
      createLeaseLockOwnershipMarker(
        lockOwnershipMarker,
        Object.freeze({
          kind,
          queueId,
          ownerGeneration,
          ownerProcessId: process.pid,
          recoveryId,
        }),
      );
      isLockOwnershipMarkerOwned = true;
    } catch (error) {
      if (!isAcquisitionMarkerOwned) {
        if (errorCode(error) === "EEXIST")
          return blocked("project_runtime_lease_unavailable");
        try {
          if (fs.existsSync(acquisitionMarker)) {
            const competing = readLeaseAcquisitionMarker(acquisitionMarker);
            if (
              competing.kind === kind &&
              competing.recoveryId === recoveryId &&
              (competing.ownerProcessId !== process.pid ||
                (kind === "project-operation" && competing.queueId !== queueId))
            )
              return blocked("project_runtime_lease_unavailable");
            if (competing.ownerProcessId === process.pid)
              return blocked(
                "project_runtime_lease_acquisition_recovery_required",
                true,
                recoveryId,
              );
          }
          if (
            leaseAcquisitionFootprintAbsent(locks, identity, [
              lock,
              recoveryMarker,
              acquisitionMarker,
              lockOwnershipMarker,
            ])
          )
            return blocked("project_runtime_lease_acquisition_rolled_back");
        } catch {}
        return blocked(
          "project_runtime_lease_acquisition_recovery_required",
          true,
          recoveryId,
        );
      }
      throw error;
    }
    assertDirectory(lock);
    acquiredEvidence = path.join(
      evidence,
      `${identity}-${ownerGeneration}.json`,
    );
    atomicCreateAndReadBack(
      evidence,
      `${identity}-${ownerGeneration}.json`,
      envelope("lease-evidence", repositoryBindingId, projectId, 1, 1, {
        kind,
        queueId,
        ownerGeneration,
        ownerProcessId: process.pid,
        disposition: "acquired",
      }),
    );
    const acquiredLock = lock;
    const ownedAcquisitionMarker = acquisitionMarker;
    const ownedLockOwnershipMarker = lockOwnershipMarker;
    const exactRecoveryId = recoveryId;
    let released = false;
    let lease!: ProjectRuntimeLease;
    lease = Object.freeze({
      kind,
      ownerGeneration,
      release: () => {
        if (released)
          return blocked<Readonly<{ released: true }>>(
            "project_runtime_lease_already_released",
          );
        try {
          const markerDescriptor = fs.openSync(
            recoveryMarker,
            fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
            0o600,
          );
          try {
            fs.writeFileSync(markerDescriptor, `${ownerGeneration}\n`, "utf8");
            fs.fsyncSync(markerDescriptor);
          } finally {
            fs.closeSync(markerDescriptor);
          }
          if (
            fs.readFileSync(recoveryMarker, "utf8") !== `${ownerGeneration}\n`
          )
            throw new Error("project_runtime_lease_recovery_marker_mismatch");
          assertDirectory(acquiredLock);
          fs.rmdirSync(acquiredLock);
          if (fs.existsSync(acquiredLock))
            throw new Error("project_runtime_lease_lock_release_unknown");
          atomicCreateAndReadBack(
            evidence,
            `${identity}-${ownerGeneration}-released.json`,
            envelope("lease-evidence", repositoryBindingId, projectId, 1, 2, {
              kind,
              queueId,
              ownerGeneration,
              ownerProcessId: process.pid,
              disposition: "released",
            }),
          );
          fs.rmSync(recoveryMarker);
          if (fs.existsSync(recoveryMarker))
            throw new Error(
              "project_runtime_lease_recovery_marker_release_unknown",
            );
          if (fs.existsSync(ownedLockOwnershipMarker)) {
            const ownership = readLeaseAcquisitionMarker(
              ownedLockOwnershipMarker,
            );
            if (
              ownership.kind !== kind ||
              ownership.queueId !== queueId ||
              ownership.ownerGeneration !== ownerGeneration ||
              ownership.ownerProcessId !== process.pid ||
              ownership.recoveryId !== exactRecoveryId
            )
              throw new Error(
                "project_runtime_lease_lock_ownership_marker_mismatch",
              );
            fs.rmSync(ownedLockOwnershipMarker);
          }
          if (fs.existsSync(ownedLockOwnershipMarker))
            throw new Error(
              "project_runtime_lease_lock_ownership_marker_release_unknown",
            );
          if (fs.existsSync(ownedAcquisitionMarker)) {
            const pending = readLeaseAcquisitionMarker(ownedAcquisitionMarker);
            if (
              pending.kind !== kind ||
              pending.queueId !== queueId ||
              pending.ownerGeneration !== ownerGeneration ||
              pending.ownerProcessId !== process.pid ||
              pending.recoveryId !== exactRecoveryId
            )
              throw new Error(
                "project_runtime_lease_acquisition_marker_mismatch",
              );
            fs.rmSync(ownedAcquisitionMarker);
          }
          if (fs.existsSync(ownedAcquisitionMarker))
            throw new Error(
              "project_runtime_lease_acquisition_marker_release_unknown",
            );
          released = true;
          activeLeases.delete(lease);
          return completed<Readonly<{ released: true }>>(
            "project_runtime_lease_released",
            Object.freeze({ released: true as const }),
          );
        } catch {
          activeLeases.delete(lease);
          return blocked<Readonly<{ released: true }>>(
            "project_runtime_lease_release_unknown",
            true,
          );
        }
      },
    });
    activeLeases.set(
      lease,
      Object.freeze({
        repositoryRoot,
        repositoryBindingId,
        projectId,
        queueId,
        kind,
        ownerGeneration,
        lock: acquiredLock,
        recoveryMarker,
        acquisitionMarker: ownedAcquisitionMarker,
        lockOwnershipMarker: ownedLockOwnershipMarker,
        evidenceDirectory: evidence,
        identity,
      }),
    );
    return completed("project_runtime_lease_acquired", lease);
  } catch {
    let cleanupConfirmed = true;
    try {
      if (isLockOwned && lock !== null && fs.existsSync(lock))
        fs.rmdirSync(lock);
      if (lock !== null && fs.existsSync(lock)) cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    try {
      if (
        cleanupConfirmed &&
        acquiredEvidence !== null &&
        fs.existsSync(acquiredEvidence)
      )
        fs.rmSync(acquiredEvidence);
      if (acquiredEvidence !== null && fs.existsSync(acquiredEvidence))
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    try {
      if (
        cleanupConfirmed &&
        isLockOwnershipMarkerOwned &&
        lockOwnershipMarker !== null &&
        fs.existsSync(lockOwnershipMarker)
      )
        fs.rmSync(lockOwnershipMarker);
      if (lockOwnershipMarker !== null && fs.existsSync(lockOwnershipMarker))
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    try {
      if (
        cleanupConfirmed &&
        isAcquisitionMarkerOwned &&
        acquisitionMarker !== null &&
        fs.existsSync(acquisitionMarker)
      )
        fs.rmSync(acquisitionMarker);
      if (acquisitionMarker !== null && fs.existsSync(acquisitionMarker))
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    try {
      if (
        lock !== null &&
        leaseAcquisitionTemporaryFiles(
          path.dirname(lock),
          path.basename(lock, ".lock"),
        ).length > 0
      )
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    return cleanupConfirmed
      ? blocked("project_runtime_lease_acquisition_rolled_back")
      : blocked(
          "project_runtime_lease_acquisition_recovery_required",
          true,
          recoveryId,
        );
  }
}

/**
 * Project Runtime Lease Acquisition 所有者を観測する。
 *
 * @responsibility Project Runtime Lease Acquisition 所有者の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string
 * @returns StoreResult< Readonly<{ acquisition: ProjectRuntimeLeaseAcquisitionResolution | null }> >を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string」がinspectProjectRuntimeLeaseAcquisitionOwnerの入力契約を満たす。
 * @postcondition inspectProjectRuntimeLeaseAcquisitionOwnerの責務を完了した結果だけを返す。
 * @effect inspectProjectRuntimeLeaseAcquisitionOwnerはFilesystemの読取りまたは書込みを実行する。
 * @failure inspectProjectRuntimeLeaseAcquisitionOwnerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectProjectRuntimeLeaseAcquisitionOwnerは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inspectProjectRuntimeLeaseAcquisitionOwnerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectProjectRuntimeLeaseAcquisitionOwnerは共有非同期状態を持たない同期処理である。
 */
export function inspectProjectRuntimeLeaseAcquisitionOwner(
  workingDirectory: string,
  repositoryBindingId: string,
): StoreResult<
  Readonly<{ acquisition: ProjectRuntimeLeaseAcquisitionResolution | null }>
> {
  const recoveryId = validId(repositoryBindingId)
    ? leaseAcquisitionRecoveryId(
        repositoryBindingId,
        "inspection",
        "inspection",
        "project-operation",
      )
    : null;
  try {
    if (!validId(repositoryBindingId))
      return blocked("project_runtime_lease_recovery_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const locks = lockRoot(runtime);
    const identity = leaseIdentity(
      repositoryBindingId,
      "inspection",
      "inspection",
      "project-operation",
    );
    const acquisitionMarker = path.join(locks, `${identity}.acquire-pending`);
    const temporaryFiles = leaseAcquisitionTemporaryFiles(locks, identity);
    const associatedPaths = Object.freeze([
      path.join(locks, `${identity}.lock`),
      path.join(locks, `${identity}.release-unknown`),
      acquisitionMarker,
      path.join(locks, `${identity}.acquire-lock-owned`),
    ]);
    if (leaseAcquisitionFootprintAbsent(locks, identity, associatedPaths))
      return completed(
        "project_runtime_lease_acquisition_resources_absent",
        Object.freeze({ acquisition: null }),
      );
    if (temporaryFiles.length > 1)
      return blocked(
        "project_runtime_lease_acquisition_recovery_cleanup_unknown",
        true,
        recoveryId,
      );
    const candidates = [
      ...(fs.existsSync(acquisitionMarker) ? [acquisitionMarker] : []),
      ...temporaryFiles.map((name) => path.join(locks, name)),
    ];
    if (candidates.length === 0)
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        recoveryId,
      );
    let markers: readonly LeaseAcquisitionMarker[];
    try {
      markers = Object.freeze(candidates.map(readLeaseAcquisitionMarker));
    } catch {
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        recoveryId,
      );
    }
    const first = markers[0];
    if (
      first?.kind !== "project-operation" ||
      markers.some(
        (marker) =>
          marker.kind !== first.kind ||
          marker.queueId !== first.queueId ||
          marker.ownerGeneration !== first.ownerGeneration ||
          marker.ownerProcessId !== first.ownerProcessId ||
          marker.recoveryId !== first.recoveryId,
      ) ||
      first.recoveryId !== recoveryId
    )
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        recoveryId,
      );
    const queueDirectory = path.join(runtime, "queues", first.queueId);
    let historyEntries: readonly QueueEnvelope[] | null;
    try {
      historyEntries = validatedQueueHistory(
        readEnvelopes(queueDirectory, "generation-"),
        repositoryBindingId,
        first.queueId,
      );
    } catch {
      historyEntries = null;
    }
    const queue = historyEntries?.at(-1)?.content;
    if (
      !queue ||
      (queue.ownerGeneration === null && queue.state !== "queued") ||
      (queue.ownerGeneration !== null &&
        queue.ownerGeneration !== first.ownerGeneration)
    )
      return blocked(
        "project_runtime_lease_acquisition_queue_identity_mismatch",
        true,
        recoveryId,
      );
    return completed(
      "project_runtime_lease_acquisition_owner_observed",
      Object.freeze({
        acquisition: Object.freeze({
          repositoryBindingId,
          projectId: queue.projectId,
          queueId: queue.queueId,
          ownerGeneration: first.ownerGeneration,
          ownerProcessId: first.ownerProcessId,
          recoveryId: first.recoveryId,
        }),
      }),
    );
  } catch {
    return blocked(
      "project_runtime_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  }
}

/**
 * Project Operation Queue Lease Releaseを終端状態へ確定する。
 *
 * @responsibility Project Operation Queue Lease Releaseの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、queueId: string、expectedGeneration: number、ownerGeneration: string
 * @returns StoreResult<ProjectQueueEntry>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、queueId: string、expectedGeneration: number、ownerGeneration: string」がsettleProjectOperationQueueLeaseReleaseの入力契約を満たす。
 * @postcondition settleProjectOperationQueueLeaseReleaseの責務を完了した結果だけを返す。
 * @effect settleProjectOperationQueueLeaseReleaseはFilesystemの読取りまたは書込みを実行する。
 * @failure settleProjectOperationQueueLeaseReleaseは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant settleProjectOperationQueueLeaseReleaseは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security settleProjectOperationQueueLeaseReleaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleProjectOperationQueueLeaseReleaseは共有非同期状態を持たない同期処理である。
 */
export function settleProjectOperationQueueLeaseRelease(
  workingDirectory: string,
  repositoryBindingId: string,
  queueId: string,
  expectedGeneration: number,
  ownerGeneration: string,
): StoreResult<ProjectQueueEntry> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(queueId) ||
      !validId(ownerGeneration) ||
      !Number.isSafeInteger(expectedGeneration) ||
      expectedGeneration < 1
    )
      return blocked("project_runtime_queue_release_settlement_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    return withMutationLock(runtime, "queue-mutation", () => {
      const entryDirectory = path.join(runtime, "queues", queueId);
      const historyEntries = validatedQueueHistory(
        readEnvelopes(entryDirectory, "generation-"),
        repositoryBindingId,
        queueId,
      );
      const currentEnvelope = historyEntries?.at(-1);
      const current = currentEnvelope?.content;
      if (
        !currentEnvelope ||
        !current ||
        current.generation !== expectedGeneration ||
        current.ownerGeneration !== ownerGeneration ||
        current.state === "leased" ||
        current.state === "running"
      )
        return blocked(
          "project_runtime_queue_release_settlement_state_mismatch",
          true,
        );
      const identity = leaseIdentity(
        repositoryBindingId,
        current.projectId,
        queueId,
        "project-operation",
      );
      const locks = lockRoot(runtime);
      if (
        fs.existsSync(path.join(locks, `${identity}.lock`)) ||
        fs.existsSync(path.join(locks, `${identity}.release-unknown`)) ||
        fs.existsSync(path.join(locks, `${identity}.acquire-pending`)) ||
        fs.existsSync(path.join(locks, `${identity}.acquire-lock-owned`))
      )
        return blocked(
          "project_runtime_queue_release_settlement_resource_present",
          true,
        );
      const evidence = leaseEvidenceRoot(runtime);
      const leaseEvidence = readExactLeaseEvidence(evidence, {
        repositoryBindingId,
        projectId: current.projectId,
        queueId,
        kind: "project-operation",
        identity,
        ownerGeneration,
      });
      if (!leaseEvidence.released || leaseEvidence.recovered)
        return blocked("project_runtime_queue_release_evidence_mismatch", true);
      const value: ProjectQueueEntry = Object.freeze({
        ...current,
        generation: current.generation + 1,
        ownerGeneration: null,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        `generation-${value.generation}.json`,
        envelope(
          "queue-entry",
          repositoryBindingId,
          current.projectId,
          1,
          value.generation,
          value,
        ),
      );
      return completed("project_runtime_queue_release_settled", value);
    });
  } catch {
    return blocked(
      "project_runtime_queue_release_settlement_observation_unknown",
      true,
    );
  }
}

/**
 * project-runtime-durable-foundationで使用するLease 所有者 Observerの値契約を定義する。
 *
 * @responsibility Lease 所有者 ObserverのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape LeaseOwnerObserverが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseOwnerObserverで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseOwnerObserverの宣言は外部境界を開かない。
 * @security LeaseOwnerObserverはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseOwnerObserverの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LeaseOwnerObserver = (
  owner: Readonly<{
    ownerProcessId: number;
    ownerGeneration: string;
  }>,
) => unknown;

/**
 * reconcile Unbound Lease Acquisitionを決定する。
 *
 * @responsibility reconcile Unbound Lease Acquisitionの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input runtime: string、repositoryBindingId: string、projectId: string、requestedQueueId: string、kind: LeaseKind、observeOwner: LeaseOwnerObserver、shouldRetainAcquisitionMarkerForCaller
 * @returns StoreResult<Readonly<{ recoveryId: string }>>を返す。
 * @precondition 「runtime: string、repositoryBindingId: string、projectId: string、requestedQueueId: string、kind: LeaseKind、observeOwner: LeaseOwnerObserver、shouldRetainAcquisitionMarkerForCaller」がreconcileUnboundLeaseAcquisitionの入力契約を満たす。
 * @postcondition reconcileUnboundLeaseAcquisitionの責務を完了した結果だけを返す。
 * @effect reconcileUnboundLeaseAcquisitionはFilesystemの読取りまたは書込みを実行する。
 * @failure reconcileUnboundLeaseAcquisitionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant reconcileUnboundLeaseAcquisitionは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security reconcileUnboundLeaseAcquisitionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reconcileUnboundLeaseAcquisitionは共有非同期状態を持たない同期処理である。
 */
function reconcileUnboundLeaseAcquisition(
  runtime: string,
  repositoryBindingId: string,
  projectId: string,
  requestedQueueId: string,
  kind: LeaseKind,
  observeOwner: LeaseOwnerObserver,
  shouldRetainAcquisitionMarkerForCaller = false,
): StoreResult<Readonly<{ recoveryId: string }>> {
  const identity = leaseIdentity(
    repositoryBindingId,
    projectId,
    requestedQueueId,
    kind,
  );
  const expectedRecoveryId = leaseAcquisitionRecoveryId(
    repositoryBindingId,
    projectId,
    requestedQueueId,
    kind,
  );
  const locks = lockRoot(runtime);
  const lock = path.join(locks, `${identity}.lock`);
  const releaseMarker = path.join(locks, `${identity}.release-unknown`);
  const acquisitionMarker = path.join(locks, `${identity}.acquire-pending`);
  const lockOwnershipMarker = path.join(
    locks,
    `${identity}.acquire-lock-owned`,
  );
  const temporaryFiles = leaseAcquisitionTemporaryFiles(locks, identity);
  if (temporaryFiles.length > 1)
    return blocked(
      "project_runtime_lease_acquisition_recovery_cleanup_unknown",
      true,
      expectedRecoveryId,
    );
  const temporaryMarker =
    temporaryFiles.length === 1
      ? path.join(locks, temporaryFiles[0] as string)
      : null;
  if (temporaryMarker !== null) {
    let prepared: LeaseAcquisitionMarker;
    try {
      prepared = readLeaseAcquisitionMarker(temporaryMarker);
    } catch {
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
    }
    if (
      prepared.kind !== kind ||
      (kind === "project-operation" && prepared.queueId !== requestedQueueId) ||
      prepared.recoveryId !== expectedRecoveryId
    )
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
    if (fs.existsSync(acquisitionMarker)) {
      if (
        fs.readFileSync(acquisitionMarker, "utf8") !==
        fs.readFileSync(temporaryMarker, "utf8")
      )
        return blocked(
          "project_runtime_lease_acquisition_recovery_evidence_mismatch",
          true,
          expectedRecoveryId,
        );
    } else {
      let rawPreparedOwnerObservation: unknown;
      try {
        rawPreparedOwnerObservation = observeOwner(
          Object.freeze({
            ownerProcessId: prepared.ownerProcessId,
            ownerGeneration: prepared.ownerGeneration,
          }),
        );
      } catch {
        return blocked(
          "project_runtime_lease_owner_observation_unknown",
          true,
          expectedRecoveryId,
        );
      }
      if (
        !plainObject(rawPreparedOwnerObservation) ||
        !exactKeys(rawPreparedOwnerObservation, [
          "status",
          "ownerProcessId",
          "ownerGeneration",
        ]) ||
        rawPreparedOwnerObservation.ownerProcessId !==
          prepared.ownerProcessId ||
        rawPreparedOwnerObservation.ownerGeneration !== prepared.ownerGeneration
      )
        return blocked(
          "project_runtime_lease_owner_observation_unknown",
          true,
          expectedRecoveryId,
        );
      if (rawPreparedOwnerObservation.status === "alive")
        return blocked("project_runtime_lease_owner_still_active");
      if (rawPreparedOwnerObservation.status !== "absent")
        return blocked(
          "project_runtime_lease_owner_observation_unknown",
          true,
          expectedRecoveryId,
        );
      try {
        fs.linkSync(temporaryMarker, acquisitionMarker);
      } catch (error) {
        if (errorCode(error) !== "EEXIST")
          return blocked(
            "project_runtime_lease_acquisition_recovery_cleanup_unknown",
            true,
            expectedRecoveryId,
          );
      }
      if (
        !fs.existsSync(acquisitionMarker) ||
        fs.readFileSync(acquisitionMarker, "utf8") !==
          fs.readFileSync(temporaryMarker, "utf8")
      )
        return blocked(
          "project_runtime_lease_acquisition_recovery_evidence_mismatch",
          true,
          expectedRecoveryId,
        );
    }
  }
  if (!fs.existsSync(acquisitionMarker))
    return blocked(
      "project_runtime_lease_acquisition_recovery_state_mismatch",
      true,
      expectedRecoveryId,
    );
  let pending: LeaseAcquisitionMarker;
  try {
    pending = readLeaseAcquisitionMarker(acquisitionMarker);
  } catch {
    return blocked(
      "project_runtime_lease_acquisition_recovery_evidence_mismatch",
      true,
      expectedRecoveryId,
    );
  }
  const evidenceQueueId = pending.queueId;
  if (
    pending.kind !== kind ||
    (kind === "project-operation" && evidenceQueueId !== requestedQueueId) ||
    pending.recoveryId !== expectedRecoveryId
  )
    return blocked(
      "project_runtime_lease_acquisition_recovery_evidence_mismatch",
      true,
      expectedRecoveryId,
    );
  if (fs.existsSync(lockOwnershipMarker)) {
    let ownership: LeaseAcquisitionMarker;
    try {
      ownership = readLeaseAcquisitionMarker(lockOwnershipMarker);
    } catch {
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
    }
    if (
      ownership.kind !== pending.kind ||
      ownership.queueId !== pending.queueId ||
      ownership.ownerGeneration !== pending.ownerGeneration ||
      ownership.ownerProcessId !== pending.ownerProcessId ||
      ownership.recoveryId !== pending.recoveryId
    )
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
  } else if (fs.existsSync(lock)) {
    return blocked(
      "project_runtime_lease_acquisition_recovery_cleanup_unknown",
      true,
      expectedRecoveryId,
    );
  }
  let rawObservation: unknown;
  try {
    rawObservation = observeOwner(
      Object.freeze({
        ownerProcessId: pending.ownerProcessId,
        ownerGeneration: pending.ownerGeneration,
      }),
    );
  } catch {
    return blocked(
      "project_runtime_lease_owner_observation_unknown",
      true,
      expectedRecoveryId,
    );
  }
  if (
    !plainObject(rawObservation) ||
    !exactKeys(rawObservation, [
      "status",
      "ownerProcessId",
      "ownerGeneration",
    ]) ||
    rawObservation.ownerProcessId !== pending.ownerProcessId ||
    rawObservation.ownerGeneration !== pending.ownerGeneration
  )
    return blocked(
      "project_runtime_lease_owner_observation_unknown",
      true,
      expectedRecoveryId,
    );
  if (rawObservation.status === "alive")
    return blocked("project_runtime_lease_owner_still_active");
  if (rawObservation.status !== "absent")
    return blocked(
      "project_runtime_lease_owner_observation_unknown",
      true,
      expectedRecoveryId,
    );

  if (fs.existsSync(releaseMarker)) {
    if (
      fs.readFileSync(releaseMarker, "utf8") !== `${pending.ownerGeneration}\n`
    )
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
  } else {
    const descriptor = fs.openSync(
      releaseMarker,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      0o600,
    );
    try {
      fs.writeFileSync(descriptor, `${pending.ownerGeneration}\n`, "utf8");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    if (
      fs.readFileSync(releaseMarker, "utf8") !== `${pending.ownerGeneration}\n`
    )
      throw new Error("project_runtime_lease_recovery_marker_mismatch");
  }
  if (fs.existsSync(lock)) {
    assertDirectory(lock);
    fs.rmdirSync(lock);
  }
  if (fs.existsSync(lock))
    throw new Error("project_runtime_lease_lock_release_unknown");

  const evidence = leaseEvidenceRoot(runtime);
  const base = `${identity}-${pending.ownerGeneration}`;
  const acquiredPath = path.join(evidence, `${base}.json`);
  const releasedPath = path.join(evidence, `${base}-released.json`);
  const recoveredPath = path.join(evidence, `${base}-recovered.json`);
  if (!fs.existsSync(acquiredPath)) {
    if (fs.existsSync(releasedPath) || fs.existsSync(recoveredPath))
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
  } else {
    let observed = readExactLeaseEvidence(evidence, {
      repositoryBindingId,
      projectId,
      queueId: evidenceQueueId,
      kind,
      identity,
      ownerGeneration: pending.ownerGeneration,
    });
    if (observed.acquired.content.ownerProcessId !== pending.ownerProcessId)
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
    if (!observed.released && !observed.recovered) {
      atomicCreateAndReadBack(
        evidence,
        `${base}-recovered.json`,
        envelope("lease-evidence", repositoryBindingId, projectId, 1, 2, {
          kind,
          queueId: evidenceQueueId,
          ownerGeneration: pending.ownerGeneration,
          ownerProcessId: pending.ownerProcessId,
          disposition: "recovered_after_owner_loss",
        }),
      );
      observed = readExactLeaseEvidence(evidence, {
        repositoryBindingId,
        projectId,
        queueId: evidenceQueueId,
        kind,
        identity,
        ownerGeneration: pending.ownerGeneration,
      });
    }
    if (!observed.released && !observed.recovered)
      throw new Error("project_runtime_lease_recovery_evidence_mismatch");
  }
  fs.rmSync(releaseMarker);
  if (fs.existsSync(lockOwnershipMarker)) fs.rmSync(lockOwnershipMarker);
  if (!shouldRetainAcquisitionMarkerForCaller) fs.rmSync(acquisitionMarker);
  if (temporaryMarker !== null) fs.rmSync(temporaryMarker);
  if (
    fs.existsSync(lock) ||
    fs.existsSync(releaseMarker) ||
    fs.existsSync(lockOwnershipMarker) ||
    (shouldRetainAcquisitionMarkerForCaller
      ? !fs.existsSync(acquisitionMarker)
      : fs.existsSync(acquisitionMarker)) ||
    leaseAcquisitionTemporaryFiles(locks, identity).length > 0
  )
    throw new Error(
      "project_runtime_lease_acquisition_recovery_cleanup_unknown",
    );
  return completed(
    "project_runtime_lease_acquisition_resources_recovered",
    Object.freeze({ recoveryId: expectedRecoveryId }),
  );
}

/**
 * reconcile Canonical Adoption Lease Acquisition 所有者 Lossを決定する。
 *
 * @responsibility reconcile Canonical Adoption Lease Acquisition 所有者 Lossの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、projectId: string、observeOwner: LeaseOwnerObserver
 * @returns StoreResult<Readonly<{ recoveryId: string | null }>>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、projectId: string、observeOwner: LeaseOwnerObserver」がreconcileCanonicalAdoptionLeaseAcquisitionOwnerLossの入力契約を満たす。
 * @postcondition reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossの責務を完了した結果だけを返す。
 * @effect N/A: reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossはProcess内の同一Subsystemで完結する。
 * @security reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossは共有非同期状態を持たない同期処理である。
 */
export function reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
  observeOwner: LeaseOwnerObserver,
): StoreResult<Readonly<{ recoveryId: string | null }>> {
  const recoveryId =
    validId(repositoryBindingId) && validId(projectId)
      ? leaseAcquisitionRecoveryId(
          repositoryBindingId,
          projectId,
          "canonical",
          "canonical-adoption",
        )
      : null;
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(projectId) ||
      typeof observeOwner !== "function"
    )
      return blocked("project_runtime_lease_recovery_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    return withMutationLock<Readonly<{ recoveryId: string | null }>>(
      runtime,
      "queue-mutation",
      () => {
        const identity = leaseIdentity(
          repositoryBindingId,
          projectId,
          "canonical",
          "canonical-adoption",
        );
        const locks = lockRoot(runtime);
        if (
          leaseAcquisitionFootprintAbsent(
            locks,
            identity,
            Object.freeze([
              path.join(locks, `${identity}.lock`),
              path.join(locks, `${identity}.release-unknown`),
              path.join(locks, `${identity}.acquire-pending`),
              path.join(locks, `${identity}.acquire-lock-owned`),
            ]),
          )
        )
          return completed(
            "project_runtime_lease_acquisition_resources_absent",
            Object.freeze({ recoveryId: null }),
          );
        return reconcileUnboundLeaseAcquisition(
          runtime,
          repositoryBindingId,
          projectId,
          "canonical",
          "canonical-adoption",
          observeOwner,
        );
      },
    );
  } catch {
    return blocked(
      "project_runtime_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  }
}

/**
 * reconcile Project Runtime Lease 所有者 Lossを決定する。
 *
 * @responsibility reconcile Project Runtime Lease 所有者 Lossの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、projectId: string、queueId: string、observeOwner: LeaseOwnerObserver
 * @returns StoreResult<ProjectQueueEntry>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、projectId: string、queueId: string、observeOwner: LeaseOwnerObserver」がreconcileProjectRuntimeLeaseOwnerLossの入力契約を満たす。
 * @postcondition reconcileProjectRuntimeLeaseOwnerLossの責務を完了した結果だけを返す。
 * @effect reconcileProjectRuntimeLeaseOwnerLossはFilesystemの読取りまたは書込みを実行する。
 * @failure reconcileProjectRuntimeLeaseOwnerLossは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant reconcileProjectRuntimeLeaseOwnerLossは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security reconcileProjectRuntimeLeaseOwnerLossはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reconcileProjectRuntimeLeaseOwnerLossは共有非同期状態を持たない同期処理である。
 */
export function reconcileProjectRuntimeLeaseOwnerLoss(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  observeOwner: LeaseOwnerObserver,
): StoreResult<ProjectQueueEntry> {
  const recoveryId = [repositoryBindingId, projectId, queueId].every(validId)
    ? leaseAcquisitionRecoveryId(
        repositoryBindingId,
        projectId,
        queueId,
        "project-operation",
      )
    : null;
  try {
    if (
      ![repositoryBindingId, projectId, queueId].every(validId) ||
      typeof observeOwner !== "function"
    )
      return blocked("project_runtime_lease_recovery_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    return withMutationLock(runtime, "queue-mutation", () => {
      const entryDirectory = path.join(runtime, "queues", queueId);
      const historyEntries = validatedQueueHistory(
        readEnvelopes(entryDirectory, "generation-"),
        repositoryBindingId,
        queueId,
        projectId,
      );
      const currentEnvelope = historyEntries?.at(-1);
      const current = currentEnvelope?.content;
      if (!currentEnvelope || !current)
        return blocked("project_runtime_lease_recovery_state_mismatch");
      const identity = leaseIdentity(
        repositoryBindingId,
        projectId,
        queueId,
        "project-operation",
      );
      const locks = lockRoot(runtime);
      const lock = path.join(locks, `${identity}.lock`);
      const recoveryMarker = path.join(locks, `${identity}.release-unknown`);
      const acquisitionMarker = path.join(locks, `${identity}.acquire-pending`);
      const lockOwnershipMarker = path.join(
        locks,
        `${identity}.acquire-lock-owned`,
      );
      const acquisitionMarkerPresent = fs.existsSync(acquisitionMarker);
      if (current.ownerGeneration === null) {
        if (current.state !== "queued")
          return blocked("project_runtime_lease_recovery_state_mismatch");
        const temporaryFiles = leaseAcquisitionTemporaryFiles(locks, identity);
        const footprintAbsent = leaseAcquisitionFootprintAbsent(
          locks,
          identity,
          Object.freeze([
            lock,
            recoveryMarker,
            acquisitionMarker,
            lockOwnershipMarker,
          ]),
        );
        if (footprintAbsent)
          return completed(
            "project_runtime_lease_acquisition_resources_absent",
            current,
          );
        if (!acquisitionMarkerPresent && temporaryFiles.length === 0)
          return blocked(
            "project_runtime_lease_acquisition_recovery_evidence_mismatch",
            true,
            recoveryId,
          );
        const recovered = reconcileUnboundLeaseAcquisition(
          runtime,
          repositoryBindingId,
          projectId,
          queueId,
          "project-operation",
          observeOwner,
          true,
        );
        if (recovered.status !== "completed") return recovered;
        if (current.resultReference === recovered.value.recoveryId) {
          fs.rmSync(acquisitionMarker);
          if (fs.existsSync(acquisitionMarker))
            throw new Error(
              "project_runtime_lease_acquisition_marker_release_unknown",
            );
          return completed(
            "project_runtime_lease_acquisition_recovered",
            current,
          );
        }
        const value: ProjectQueueEntry = Object.freeze({
          ...current,
          generation: current.generation + 1,
          resultReference: recovered.value.recoveryId,
        });
        atomicCreateAndReadBack(
          entryDirectory,
          `generation-${value.generation}.json`,
          envelope(
            "queue-entry",
            repositoryBindingId,
            projectId,
            1,
            value.generation,
            value,
          ),
        );
        fs.rmSync(acquisitionMarker);
        if (fs.existsSync(acquisitionMarker))
          throw new Error(
            "project_runtime_lease_acquisition_marker_release_unknown",
          );
        return completed("project_runtime_lease_acquisition_recovered", value);
      }
      const lockPresent = fs.existsSync(lock);
      if (lockPresent) assertDirectory(lock);
      const lockOwnershipMarkerPresent = fs.existsSync(lockOwnershipMarker);
      if (lockPresent && !lockOwnershipMarkerPresent)
        return blocked(
          "project_runtime_lease_acquisition_recovery_evidence_mismatch",
          true,
        );
      const markerPresent = fs.existsSync(recoveryMarker);
      if (acquisitionMarkerPresent) {
        const pending = readLeaseAcquisitionMarker(acquisitionMarker);
        if (
          pending.kind !== "project-operation" ||
          pending.queueId !== queueId ||
          pending.ownerGeneration !== current.ownerGeneration ||
          pending.recoveryId !==
            leaseAcquisitionRecoveryId(
              repositoryBindingId,
              projectId,
              queueId,
              "project-operation",
            )
        )
          return blocked(
            "project_runtime_lease_acquisition_recovery_evidence_mismatch",
            true,
          );
      }
      if (
        markerPresent &&
        fs.readFileSync(recoveryMarker, "utf8") !==
          `${current.ownerGeneration}\n`
      )
        return blocked(
          "project_runtime_lease_recovery_evidence_mismatch",
          true,
        );
      const evidence = leaseEvidenceRoot(runtime);
      const leaseEvidence = readExactLeaseEvidence(evidence, {
        repositoryBindingId,
        projectId,
        queueId,
        kind: "project-operation",
        identity,
        ownerGeneration: current.ownerGeneration,
      });
      const acquiredContent = leaseEvidence.acquired.content;
      if (lockOwnershipMarkerPresent) {
        const ownership = readLeaseAcquisitionMarker(lockOwnershipMarker);
        if (
          ownership.kind !== "project-operation" ||
          ownership.queueId !== queueId ||
          ownership.ownerGeneration !== current.ownerGeneration ||
          ownership.ownerProcessId !== acquiredContent.ownerProcessId ||
          ownership.recoveryId !==
            leaseAcquisitionRecoveryId(
              repositoryBindingId,
              projectId,
              queueId,
              "project-operation",
            )
        )
          return blocked(
            "project_runtime_lease_acquisition_recovery_evidence_mismatch",
            true,
          );
      }
      if (acquisitionMarkerPresent) {
        const pending = readLeaseAcquisitionMarker(acquisitionMarker);
        if (pending.ownerProcessId !== acquiredContent.ownerProcessId)
          return blocked(
            "project_runtime_lease_acquisition_recovery_evidence_mismatch",
            true,
          );
      }
      if (leaseEvidence.released) {
        if (lockPresent)
          return blocked(
            "project_runtime_lease_recovery_evidence_mismatch",
            true,
          );
        if (markerPresent) fs.rmSync(recoveryMarker);
        if (lockOwnershipMarkerPresent) fs.rmSync(lockOwnershipMarker);
        if (acquisitionMarkerPresent) fs.rmSync(acquisitionMarker);
        if (fs.existsSync(recoveryMarker))
          throw new Error(
            "project_runtime_lease_recovery_marker_release_unknown",
          );
        if (fs.existsSync(acquisitionMarker))
          throw new Error(
            "project_runtime_lease_acquisition_marker_release_unknown",
          );
        if (fs.existsSync(lockOwnershipMarker))
          throw new Error(
            "project_runtime_lease_lock_ownership_marker_release_unknown",
          );
        const value: ProjectQueueEntry = Object.freeze({
          ...current,
          state:
            current.state === "leased" || current.state === "running"
              ? "recovery_required"
              : current.state,
          generation: current.generation + 1,
          ownerGeneration: null,
          resumeCondition:
            current.state === "leased" || current.state === "running"
              ? "owner_loss"
              : current.resumeCondition,
          resultReference:
            current.state === "leased" || current.state === "running"
              ? `lease-recovery-${digest(
                  `${projectId}\0${queueId}\0${current.ownerGeneration}`,
                ).slice(0, 40)}`
              : current.resultReference,
        });
        atomicCreateAndReadBack(
          entryDirectory,
          `generation-${value.generation}.json`,
          envelope(
            "queue-entry",
            repositoryBindingId,
            projectId,
            1,
            value.generation,
            value,
          ),
        );
        return completed("project_runtime_lease_release_reconciled", value);
      }
      if (leaseEvidence.recovered) {
        if (lockPresent || markerPresent)
          return blocked(
            "project_runtime_lease_recovery_evidence_mismatch",
            true,
          );
        if (acquisitionMarkerPresent) fs.rmSync(acquisitionMarker);
        if (lockOwnershipMarkerPresent) fs.rmSync(lockOwnershipMarker);
        if (fs.existsSync(acquisitionMarker))
          throw new Error(
            "project_runtime_lease_acquisition_marker_release_unknown",
          );
        if (fs.existsSync(lockOwnershipMarker))
          throw new Error(
            "project_runtime_lease_lock_ownership_marker_release_unknown",
          );
        const value: ProjectQueueEntry = Object.freeze({
          ...current,
          state: "recovery_required",
          generation: current.generation + 1,
          ownerGeneration: null,
          resumeCondition: "owner_loss",
          resultReference: `lease-recovery-${digest(
            `${projectId}\0${queueId}\0${current.ownerGeneration}`,
          ).slice(0, 40)}`,
        });
        atomicCreateAndReadBack(
          entryDirectory,
          `generation-${value.generation}.json`,
          envelope(
            "queue-entry",
            repositoryBindingId,
            projectId,
            1,
            value.generation,
            value,
          ),
        );
        return completed("project_runtime_lease_owner_loss_reconciled", value);
      }
      let rawObservation: unknown;
      try {
        rawObservation = observeOwner(
          Object.freeze({
            ownerProcessId: acquiredContent.ownerProcessId,
            ownerGeneration: current.ownerGeneration,
          }),
        );
      } catch {
        return blocked("project_runtime_lease_owner_observation_unknown", true);
      }
      if (
        !plainObject(rawObservation) ||
        !exactKeys(rawObservation, [
          "status",
          "ownerProcessId",
          "ownerGeneration",
        ]) ||
        rawObservation.ownerProcessId !== acquiredContent.ownerProcessId ||
        rawObservation.ownerGeneration !== current.ownerGeneration
      )
        return blocked("project_runtime_lease_owner_observation_unknown", true);
      if (rawObservation.status === "alive")
        return blocked("project_runtime_lease_owner_still_active");
      if (rawObservation.status !== "absent")
        return blocked("project_runtime_lease_owner_observation_unknown", true);

      if (!lockPresent && !markerPresent)
        return blocked("project_runtime_lease_owner_resource_unknown", true);
      if (!markerPresent) {
        const markerDescriptor = fs.openSync(
          recoveryMarker,
          fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
          0o600,
        );
        try {
          fs.writeFileSync(
            markerDescriptor,
            `${current.ownerGeneration}\n`,
            "utf8",
          );
          fs.fsyncSync(markerDescriptor);
        } finally {
          fs.closeSync(markerDescriptor);
        }
      }
      if (lockPresent) fs.rmdirSync(lock);
      if (fs.existsSync(lock))
        throw new Error("project_runtime_lease_lock_release_unknown");
      const recoveredName = `${identity}-${current.ownerGeneration}-recovered.json`;
      if (!leaseEvidence.recovered)
        atomicCreateAndReadBack(
          evidence,
          recoveredName,
          envelope("lease-evidence", repositoryBindingId, projectId, 1, 2, {
            kind: "project-operation",
            queueId,
            ownerGeneration: current.ownerGeneration,
            ownerProcessId: acquiredContent.ownerProcessId,
            disposition: "recovered_after_owner_loss",
          }),
        );
      const recoveredEvidence = readExactLeaseEvidence(evidence, {
        repositoryBindingId,
        projectId,
        queueId,
        kind: "project-operation",
        identity,
        ownerGeneration: current.ownerGeneration,
      });
      if (!recoveredEvidence.recovered || recoveredEvidence.released)
        throw new Error("project_runtime_lease_recovery_evidence_mismatch");
      fs.rmSync(recoveryMarker);
      if (fs.existsSync(recoveryMarker))
        throw new Error(
          "project_runtime_lease_recovery_marker_release_unknown",
        );
      if (acquisitionMarkerPresent) fs.rmSync(acquisitionMarker);
      if (lockOwnershipMarkerPresent) fs.rmSync(lockOwnershipMarker);
      if (fs.existsSync(acquisitionMarker))
        throw new Error(
          "project_runtime_lease_acquisition_marker_release_unknown",
        );
      if (fs.existsSync(lockOwnershipMarker))
        throw new Error(
          "project_runtime_lease_lock_ownership_marker_release_unknown",
        );
      const value: ProjectQueueEntry = Object.freeze({
        ...current,
        state: "recovery_required",
        generation: current.generation + 1,
        ownerGeneration: null,
        resumeCondition: "owner_loss",
        resultReference: `lease-recovery-${digest(
          `${projectId}\0${queueId}\0${current.ownerGeneration}`,
        ).slice(0, 40)}`,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        `generation-${value.generation}.json`,
        envelope(
          "queue-entry",
          repositoryBindingId,
          projectId,
          1,
          value.generation,
          value,
        ),
      );
      return completed("project_runtime_lease_owner_loss_reconciled", value);
    });
  } catch {
    return blocked(
      "project_runtime_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  }
}

/**
 * Bind repository-local infrastructure once at the composition root. Project
 *
 * @responsibility Project Runtime Persistence Portsの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string
 * @returns ProjectRuntimePersistencePortsを返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string」がcreateProjectRuntimePersistencePortsの入力契約を満たす。
 * @postcondition createProjectRuntimePersistencePortsの責務を完了した結果だけを返す。
 * @effect N/A: createProjectRuntimePersistencePortsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createProjectRuntimePersistencePortsは独自の失敗分岐を所有しない。
 * @invariant createProjectRuntimePersistencePortsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createProjectRuntimePersistencePortsはProcess内の同一Subsystemで完結する。
 * @security createProjectRuntimePersistencePortsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProjectRuntimePersistencePortsは共有非同期状態を持たない同期処理である。
 */
export function createProjectRuntimePersistencePorts(
  workingDirectory: string,
  repositoryBindingId: string,
): ProjectRuntimePersistencePorts {
  const statePort: ProjectRuntimeStatePort = Object.freeze({
    writeState: (state, expectedGeneration) =>
      writeProjectRuntimeState(
        workingDirectory,
        repositoryBindingId,
        state,
        expectedGeneration,
      ),
    readState: (projectId) =>
      readProjectRuntimeState(workingDirectory, repositoryBindingId, projectId),
    enqueueOperation: (input) =>
      enqueueProjectOperation(workingDirectory, repositoryBindingId, input),
    readQueue: (queueId) =>
      readProjectOperationQueueState(
        workingDirectory,
        repositoryBindingId,
        queueId,
      ),
    selectNextOperation: () =>
      selectNextProjectOperation(workingDirectory, repositoryBindingId),
    updateQueue: (queueId, expectedGeneration, next) =>
      updateProjectOperationQueueState(
        workingDirectory,
        repositoryBindingId,
        queueId,
        expectedGeneration,
        next,
      ),
    settleQueueRecovery: (queueId, expectedGeneration, recoveryId) =>
      settleProjectOperationQueueRecovery(
        workingDirectory,
        repositoryBindingId,
        queueId,
        expectedGeneration,
        recoveryId,
      ),
    settleQueueLeaseRelease: (queueId, expectedGeneration, ownerGeneration) =>
      settleProjectOperationQueueLeaseRelease(
        workingDirectory,
        repositoryBindingId,
        queueId,
        expectedGeneration,
        ownerGeneration,
      ),
  });
  const leasePort: ProjectRuntimeLeasePort = Object.freeze({
    acquire: (projectId, queueId, kind) =>
      acquireProjectRuntimeLease(
        workingDirectory,
        repositoryBindingId,
        projectId,
        queueId,
        kind,
      ),
    inspectAcquisitionOwner: () =>
      inspectProjectRuntimeLeaseAcquisitionOwner(
        workingDirectory,
        repositoryBindingId,
      ),
    reconcileOperationOwnerLoss: (
      projectId,
      queueId,
      observeOwner: ProjectRuntimeLeaseOwnerObservation,
    ) =>
      reconcileProjectRuntimeLeaseOwnerLoss(
        workingDirectory,
        repositoryBindingId,
        projectId,
        queueId,
        observeOwner,
      ),
    reconcileAdoptionOwnerLoss: (
      projectId,
      observeOwner: ProjectRuntimeLeaseOwnerObservation,
    ) =>
      reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
        workingDirectory,
        repositoryBindingId,
        projectId,
        observeOwner,
      ),
  });
  return Object.freeze({
    state: statePort,
    lease: leasePort,
  });
}

/**
 * 受付以外の既存操作を現在の保存世代へ接続する。
 * @responsibility 読取り・採用・判断・回復の本番利用側を新版へ結合する。
 * @trace ARCH-000004
 * @input Repository Rootと保存binding。
 * @returns 新版のPersistence Port。
 * @precondition 明示的な初期化が完了している。
 * @postcondition 新版不存在または不正では旧形式を使用しない。
 * @effect Snapshot読取りと短期排他。
 * @failure 不存在、破損、pending、旧版では例外。
 * @invariant Objective受付は発行時世代を指定する専用入口を使用する。
 * @boundary 本番Compositionと保存Port。
 * @security 認証・採用Authorityを生成しない。
 * @concurrency 構築時の世代を固定し、各変更時に再確認する。
 */
export function createCurrentProjectRuntimePersistencePorts(
  workingDirectory: string,
  binding: string,
): ProjectRuntimePersistencePorts {
  const observed = readProjectRuntimeSnapshot(workingDirectory, binding);
  if (
    observed.status !== "completed" ||
    !observed.value ||
    observed.value.schema !== SNAPSHOT_SCHEMA_V2
  )
    throw new Error("project_runtime_snapshot_not_initialized");
  return createProjectRuntimeSnapshotPersistencePorts(
    workingDirectory,
    binding,
    observed.value.intakeEpoch,
  );
}

/**
 * 新版の現在状態からProjectを読み取る。
 * @responsibility Docker回復の利用側にも同じ保存値を提供する。
 * @trace ARCH-000004
 * @input Repository Root、binding、Project ID。
 * @returns Project状態または観測停止。
 * @precondition 呼出し権限は上位で検証する。
 * @postcondition 不存在と未初期化を区別する。
 * @effect 読取りと短期排他のみ。
 * @failure 旧版、pending、破損は停止する。
 * @invariant 読取りによる初期化やFallbackをしない。
 * @boundary 保存と回復利用側。
 * @security 保存値はAuthorityではない。
 * @concurrency 同Owner下でProject値を確定する。
 */
export function readCurrentProjectRuntimeState(
  workingDirectory: string,
  binding: string,
  projectId: string,
): StoreResult<ProjectRuntimeState | null> {
  return withProjectRuntimeSnapshotOperation(
    workingDirectory,
    binding,
    (current) =>
      current.schema === SNAPSHOT_SCHEMA_V2 && validId(projectId)
        ? completed("project_runtime_state_observed", {
            next: null,
            value:
              current.projects.find((item) => item.projectId === projectId) ??
              null,
          })
        : blocked("project_runtime_snapshot_schema_invalid"),
  );
}

/**
 * 統合保存の状態操作と排他操作を一組として接続する。
 *
 * @responsibility 既存Persistence Portを新版の保存・取得・回復へ結合する。
 * @trace ARCH-000004
 * @input 検証済みRepository Root、binding、Request発行時のintakeEpoch。
 * @returns 既存のState PortとLease Port。
 * @precondition 操作前に新版Snapshotを初期化し、発行時の受付世代を固定する。
 * @postcondition 停止理由とexact回復参照を変更せず既存利用側へ返す。
 * @effect 構築時はなし。操作時の保存・実排他は各接続先が所有する。
 * @failure Operation回復のQueue欠落・結合不一致は停止する。
 * @invariant Adoption回復を通常Queueの更新へ変換しない。
 * @boundary CoreのPersistence PortとRepository内の統合保存。
 * @security 旧形式Fallback、暗黙初期化、受付世代の自動付替えを行わない。
 * @concurrency 各操作が既存の短期保存Ownerと実行Leaseの分離を維持する。
 */
export function createProjectRuntimeSnapshotPersistencePorts(
  workingDirectory: string,
  repositoryBindingId: string,
  intakeEpoch: string,
  intake?: Readonly<{
    epoch: string;
    queueId: string;
    requestHash: string;
    projectId: string;
    milestoneId: string;
  }>,
): ProjectRuntimePersistencePorts {
  const state = createProjectRuntimeSnapshotStatePort(
    workingDirectory,
    repositoryBindingId,
    intakeEpoch,
    intake,
  );
  const lease: ProjectRuntimeLeasePort = Object.freeze({
    acquire: (projectId, queueId, kind) =>
      acquireProjectRuntimeSnapshotLease(
        workingDirectory,
        repositoryBindingId,
        projectId,
        queueId,
        kind,
      ),
    inspectAcquisitionOwner: () =>
      inspectProjectRuntimeSnapshotLeaseAcquisitionOwner(
        workingDirectory,
        repositoryBindingId,
      ),
    reconcileOperationOwnerLoss: (projectId, queueId, observeOwner) => {
      const result = reconcileProjectRuntimeSnapshotLeaseOwnerLoss(
        workingDirectory,
        repositoryBindingId,
        projectId,
        queueId,
        "project-operation",
        observeOwner,
      );
      if (result.status !== "completed") return result;
      const queue = result.value.queue;
      if (!queue || queue.projectId !== projectId || queue.queueId !== queueId)
        return blocked(
          "project_runtime_lease_recovery_queue_mismatch",
          result.value.recoveryId !== null,
          result.value.recoveryId,
        );
      return completed(result.reason, queue);
    },
    reconcileAdoptionOwnerLoss: (projectId, observeOwner) => {
      const result = reconcileProjectRuntimeSnapshotLeaseOwnerLoss(
        workingDirectory,
        repositoryBindingId,
        projectId,
        "canonical",
        "canonical-adoption",
        observeOwner,
      );
      if (result.status !== "completed") return result;
      return completed(result.reason, { recoveryId: result.value.recoveryId });
    },
  });
  return Object.freeze({ state, lease });
}

/**
 * Project Runtime Durable Foundationの公開契約を記述する。
 *
 * @responsibility Project Runtime Durable Foundationの公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProjectRuntimeDurableFoundationの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProjectRuntimeDurableFoundationの入力契約を満たす。
 * @postcondition describeProjectRuntimeDurableFoundationの責務を完了した結果だけを返す。
 * @effect N/A: describeProjectRuntimeDurableFoundationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProjectRuntimeDurableFoundationは独自の失敗分岐を所有しない。
 * @invariant describeProjectRuntimeDurableFoundationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProjectRuntimeDurableFoundationはProcess内の同一Subsystemで完結する。
 * @security describeProjectRuntimeDurableFoundationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProjectRuntimeDurableFoundationは共有非同期状態を持たない同期処理である。
 */
export function describeProjectRuntimeDurableFoundation() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT,
    recordStrategy:
      "immutable_generation_records_with_fsynced_create_and_exact_readback",
    queueMutation: "short_exclusive_repository_local_lock",
    operationLease:
      "exclusive_lock_with_owner_generation_and_no_stale_takeover",
    adoptionLease: "separate_exclusive_lock_with_no_stale_takeover",
    staleLockDisposition: "blocked_manual_reconciliation_required_before_reuse",
    externalWaitWhileMutationLockHeld: false,
    upperProjectRuntimeCapabilityComplete: false,
  });
}
