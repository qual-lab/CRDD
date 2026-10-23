/**
 * Coordinatorの現在状態・Queue・Leaseを単一Snapshotへ保存する。
 *
 * @responsibility 受付世代、保存比較交換、排他意図・根拠、終了整理と再入場を同じ保存Ownerへ結合する。
 * @trace ARCH-000004
 */
import { randomUUID } from "node:crypto";
import {
  COORDINATOR_DURABLE_FOUNDATION_CONTRACT,
  type CoordinatorSnapshot,
  digest,
  type Envelope,
  exactKeys,
  HASH,
  type LeaseEvidenceContent,
  type LeaseEvidenceEnvelope,
  type LeaseKind,
  leaseAcquisitionRecoveryId,
  leaseIdentity,
  MAX_RECORD_BYTES,
  plainObject,
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  validCoordinatorSnapshot,
  validCoordinatorState,
  validId,
  validLeaseEvidence,
  validQueueEntry,
  validResultReference,
  decodeCoordinatorUnifiedSnapshot,
  encodeCoordinatorStateValue,
  projectCoordinatorTaskSnapshot,
  validCoordinatorResultRecord,
} from "./model.ts";

export { COORDINATOR_DURABLE_FOUNDATION_CONTRACT } from "./model.ts";

import fs from "node:fs";
import path from "node:path";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  observeRepositoryRuntimeDataArea,
  type RepositoryRuntimeDataAreaObservation,
  requireReadyRepositoryRuntimeDataArea,
  RepositoryRuntimeDataAreaBlockedError,
  resolveRepositoryRuntimeDataPaths,
} from "../../../domain-model/src/index.ts";
import {
  verifyRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
} from "../../../version-control/src/index.ts";
import type { CoordinatorAcceptanceDecisionStore } from "../decision/types.ts";
import {
  COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT,
  type CoordinatorAcceptanceDecisionEnvelope,
  validCoordinatorAcceptanceDecisionRecord,
} from "../decision/records.ts";
import type { CoordinatorDecisionRecoveryIntent } from "../decision/records.ts";
import type { CoordinatorDecisionRecoveryStore } from "../decision/types.ts";
import { validCoordinatorDecisionRecoveryIntent } from "../decision/records.ts";
import {
  acquireCoordinatorStorageOwner,
  isLiveCoordinatorStorageOwner,
  readCoordinatorStorageSnapshotOwned,
  writeCoordinatorStorageTaskSnapshotOwned,
  type CoordinatorStorageOwner,
} from "./settlement-store.ts";
import { normalizeRepositoryRelativePath } from "../state/model.ts";
import type {
  CoordinatorLease,
  CoordinatorLeaseAcquisitionResolution,
  CoordinatorLeaseOwnerObservation,
  CoordinatorLeasePort,
} from "../state/persistence.ts";
import type { CoordinatorPortResult } from "../state/result.ts";
import type { ProjectQueueEntry, ProjectQueueState } from "../state/model.ts";
import type { CoordinatorState } from "../state/model.ts";
import type {
  CoordinatorPersistencePorts,
  CoordinatorStatePort,
} from "../state/persistence.ts";
import {
  inspectSingleTaskRecord,
  type SingleTaskRecord,
} from "../state/model.ts";
import { resolveCoordinatorWorkspaceTaskTarget } from "../workspace/operations.ts";
import {
  type CoordinatorWorkspace,
  validCoordinatorWorkspace,
} from "../workspace/record.ts";
import {
  type HistoryRow,
  historyRow,
  inspectCoordinatorHistorySettlement,
  updateCoordinatorHistoryOwned,
} from "./history.ts";
import type {
  CoordinatorIntegrationRecordPort,
  CoordinatorResultRecord,
  IntegrationRecordBinding,
} from "./result-record.ts";
import { COORDINATOR_INTEGRATION_CONTRACT } from "./result-record.ts";

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
function resolveCoordinatorNamedPaths(workingDirectory: string) {
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
function observeCoordinatorArea(
  repositoryRoot: string,
  area: "coordinator" | "tmp",
) {
  const verified = verifyRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed")
    throw new Error("orchestrator_repository_root_invalid");
  const observation = observeRepositoryRuntimeDataArea(
    verified.capability,
    area,
  );
  if (observation.status === "blocked") throw new Error(observation.reason);
  if (
    observation.status === "ready" &&
    observation.repositoryRoot !== repositoryRoot
  )
    throw new Error("orchestrator_repository_root_invalid");
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
function assertCoordinatorArea(
  repositoryRoot: string,
  area: "coordinator" | "tmp",
  directory: string,
) {
  const observation = observeCoordinatorArea(repositoryRoot, area);
  if (observation.status !== "ready" || observation.directory !== directory)
    throw new Error("orchestrator_storage_boundary_invalid");
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
function assertCoordinatorAreaUnchanged(
  repositoryRoot: string,
  area: "coordinator" | "tmp",
  initial: Exclude<RepositoryRuntimeDataAreaObservation, { status: "blocked" }>,
) {
  const current = observeCoordinatorArea(repositoryRoot, area);
  if (
    initial.status !== current.status ||
    (initial.status === "ready" &&
      (current.status !== "ready" ||
        current.directory !== initial.directory ||
        current.boundaryIdentity !== initial.boundaryIdentity))
  )
    throw new Error("orchestrator_storage_boundary_changed");
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
 * durable-foundationで使用するStore 結果の値契約を定義する。
 *
 * @responsibility Store 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape StoreResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StoreResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: StoreResultの宣言は外部境界を開かない。
 * @security StoreResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StoreResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type StoreResult<T> = CoordinatorPortResult<T>;

/**
 * durable-foundationで使用するActive Leaseの値契約を定義する。
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

const activeLeases = new WeakMap<CoordinatorLease, ActiveLease>();

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
export function acquireCoordinatorSnapshotPilotLock(
  workingDirectory: string,
): StoreResult<CoordinatorSnapshotOwner> {
  const owner = acquireCoordinatorStorageOwner(workingDirectory);
  return owner
    ? completed("orchestrator_snapshot_lock_acquired", owner)
    : blocked("orchestrator_snapshot_lock_unavailable", false);
}

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
 * durable-foundationを停止結果として構築する。
 *
 * @responsibility durable-foundationの停止理由、未発行Effect、公開結果境界を所有する。
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
    throw new Error("orchestrator_lease_acquisition_inventory_invalid");
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
    throw new Error("orchestrator_storage_boundary_invalid");
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
    throw new Error("orchestrator_storage_identity_invalid");
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
    throw new Error("orchestrator_storage_boundary_invalid");
  return target;
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
      const paths = resolveCoordinatorNamedPaths(activeLease.repositoryRoot);
      if (!paths) return false;
      const boundary = assertCoordinatorArea(
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
      assertCoordinatorAreaUnchanged(
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
    (recordKind === "project-state" && !validCoordinatorState(content)) ||
    (recordKind === "queue-entry" && !validQueueEntry(content)) ||
    (recordKind === "lease-evidence" && !validLeaseEvidence(content))
  )
    throw new Error("orchestrator_record_content_invalid");
  const serialized = encodeCoordinatorStateValue(content);
  const record = Object.freeze({
    schema: COORDINATOR_DURABLE_FOUNDATION_CONTRACT,
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
    throw new Error("orchestrator_record_invalid");
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
    throw new Error("orchestrator_record_envelope_invalid");
  const parsed = candidate as unknown as Envelope;
  if (
    parsed.schema !== COORDINATOR_DURABLE_FOUNDATION_CONTRACT ||
    parsed.schemaRevision !== 1 ||
    !validId(parsed.repositoryBindingId) ||
    !validId(parsed.projectId) ||
    !Number.isSafeInteger(parsed.createdGeneration) ||
    !Number.isSafeInteger(parsed.updatedGeneration) ||
    parsed.createdGeneration < 1 ||
    parsed.updatedGeneration < parsed.createdGeneration ||
    parsed.contentHash !== digest(encodeCoordinatorStateValue(parsed.content))
  )
    throw new Error("orchestrator_record_invalid");
  if (
    (parsed.recordKind === "project-state" &&
      !validCoordinatorState(parsed.content)) ||
    (parsed.recordKind === "queue-entry" && !validQueueEntry(parsed.content)) ||
    (parsed.recordKind === "lease-evidence" &&
      !validLeaseEvidence(parsed.content))
  )
    throw new Error("orchestrator_record_content_invalid");
  if (
    (parsed.recordKind === "project-state" ||
      parsed.recordKind === "queue-entry") &&
    (parsed.content as { generation: number }).generation !==
      parsed.updatedGeneration
  )
    throw new Error("orchestrator_record_generation_mismatch");
  return parsed;
}

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
    throw new Error("orchestrator_lease_evidence_inventory_mismatch");

  const read = (
    name: string,
    disposition: LeaseEvidenceContent["disposition"],
    isRequired: boolean,
  ): LeaseEvidenceEnvelope | null => {
    if (!fs.existsSync(path.join(directory, name))) {
      if (isRequired) throw new Error("orchestrator_lease_evidence_missing");
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
      throw new Error("orchestrator_lease_evidence_mismatch");
    const content = record.content as LeaseEvidenceContent;
    if (
      content.kind !== expected.kind ||
      content.queueId !== expected.queueId ||
      content.ownerGeneration !== expected.ownerGeneration ||
      content.disposition !== disposition
    )
      throw new Error("orchestrator_lease_evidence_mismatch");
    return record as LeaseEvidenceEnvelope;
  };

  const acquired = read(exactNames.acquired, "acquired", true);
  if (!acquired) throw new Error("orchestrator_lease_evidence_missing");
  const released = read(exactNames.released, "released", false);
  const recovered = read(
    exactNames.recovered,
    "recovered_after_owner_loss",
    false,
  );
  if (released && recovered)
    throw new Error("orchestrator_lease_evidence_disposition_conflict");
  for (const record of [released, recovered]) {
    if (
      record &&
      record.content.ownerProcessId !== acquired.content.ownerProcessId
    )
      throw new Error("orchestrator_lease_evidence_owner_mismatch");
  }
  return Object.freeze({ acquired, released, recovered });
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
export function readCoordinatorSnapshot(
  workingDirectory: string,
  binding: string,
): StoreResult<CoordinatorSnapshot | null> {
  if (!validId(binding)) return blocked("orchestrator_snapshot_input_invalid");
  const acquired = acquireCoordinatorSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const lock = acquired.value;
  const outcome = readCoordinatorSnapshotOwned(lock, binding);
  if (!lock.release())
    return blocked("orchestrator_snapshot_lock_release_unconfirmed", true);
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
export function initializeCoordinatorSnapshot(
  workingDirectory: string,
  binding: string,
): StoreResult<string> {
  if (!validId(binding)) return blocked("orchestrator_snapshot_input_invalid");
  const acquired = acquireCoordinatorSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const owner = acquired.value;
  let result: StoreResult<string>;
  let boundaryError: RepositoryRuntimeDataAreaBlockedError | null = null;
  try {
    const observed = readCoordinatorStorageSnapshotOwned(owner);
    if (
      observed.status !== "completed" &&
      observed.reason !== "coordinator_state_uninitialized"
    )
      result = blocked(observed.reason, true);
    else if (
      observed.value?.snapshot.repositoryBindingId !== null &&
      observed.value
    )
      result =
        observed.value.snapshot.repositoryBindingId === binding &&
        observed.value.snapshot.intakeEpoch
          ? completed(
              "orchestrator_snapshot_initialized",
              observed.value.snapshot.intakeEpoch,
            )
          : blocked("orchestrator_snapshot_binding_invalid");
    else {
      const revision = observed.value?.snapshot.revision ?? 0;
      const payload: CoordinatorSnapshot = {
        schema: COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
        schemaRevision: 4,
        repositoryRootHash: owner.repositoryRootHash,
        repositoryBindingId: binding,
        snapshotRevision: revision + 1,
        intakeEpoch: `epoch-${randomUUID()}`,
        intakeBindings: [],
        projects: [],
        workspaces: [],
        queueEntries: [],
        leaseEvidence: [],
        leaseIntents: [],
        results: [],
        historyPending: [],
        acceptanceDecisions: [],
        decisionRecoveries: [],
      };
      const saved = writeCoordinatorSnapshotOwned(
        owner,
        binding,
        encodeCoordinatorStateValue(payload),
        revision,
      );
      result =
        saved.status === "completed"
          ? completed(
              "orchestrator_snapshot_initialized",
              saved.value.intakeEpoch,
            )
          : saved;
    }
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      boundaryError = error;
    result = blocked("orchestrator_snapshot_initialization_unconfirmed", true);
  }
  const released = owner.release();
  if (boundaryError) {
    if (!released)
      boundaryError.cause = "coordinator_snapshot_lock_release_unconfirmed";
    throw boundaryError;
  }
  if (!released)
    return blocked("orchestrator_snapshot_lock_release_unconfirmed", true);
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
export type CoordinatorSnapshotOwner = CoordinatorStorageOwner;

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
export function isLiveCoordinatorSnapshotOwner(
  owner: unknown,
): owner is CoordinatorSnapshotOwner {
  return isLiveCoordinatorStorageOwner(owner);
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
export function writeCoordinatorSnapshotState(
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
  resultFacts: Parameters<CoordinatorStatePort["writeState"]>[2] = [],
): StoreResult<CoordinatorState> {
  let state: CoordinatorState;
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
      !validCoordinatorState(parsed) ||
      parsed.generation !== expectedGeneration + 1
    )
      throw new Error("snapshot_state_input_invalid");
    state = parsed;
  } catch {
    return blocked("orchestrator_state_generation_mismatch");
  }
  const acquired = acquireCoordinatorSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const lock = acquired.value;
  let outcome: StoreResult<CoordinatorState>;
  let boundaryError: RepositoryRuntimeDataAreaBlockedError | null = null;
  try {
    const observed = readCoordinatorSnapshotOwned(lock, binding, true);
    if (observed.status !== "completed") outcome = blocked(observed.reason);
    else if (observed.value === null)
      outcome = blocked("orchestrator_snapshot_absent");
    else {
      const current = observed.value;
      if (intake && !coordinatorSnapshotIntakeMatches(current, intake))
        throw new Error("orchestrator_intake_epoch_retired");
      const previous = current.projects.find(
        (item) => item.projectId === state.projectId,
      );
      if (
        previous?.generation === expectedGeneration + 1 &&
        encodeCoordinatorStateValue(previous) ===
          encodeCoordinatorStateValue(state)
      ) {
        const saved = writeCoordinatorSnapshotOwned(
          lock,
          binding,
          encodeCoordinatorStateValue(current),
          current.snapshotRevision - 1,
          resultFacts.map((fact) => ({ ...fact, projectId: state.projectId })),
        );
        outcome =
          saved.status === "completed"
            ? completed("orchestrator_state_durable", previous)
            : saved;
      } else if ((previous?.generation ?? 0) !== expectedGeneration)
        outcome = blocked("orchestrator_state_generation_conflict");
      else if (
        state.tasks.some((task) => {
          if (!previous) return task.resultAcceptances.length !== 0;
          const prior = previous?.tasks.find(
            (item) => item.definition.id === task.definition.id,
          );
          const isSameAttempt =
            prior?.attemptId === task.attemptId &&
            prior?.operationId === task.operationId;
          if (
            prior?.state === "failed" &&
            prior.supersededBy === null &&
            task.state === "superseded" &&
            task.resultAcceptances.length === 0 &&
            task.supersededBy !== null &&
            !previous.tasks.some(
              (item) => item.definition.id === task.supersededBy,
            ) &&
            state.tasks.some(
              (item) =>
                item.definition.id === task.supersededBy &&
                item.definition.objectiveId === prior.definition.objectiveId &&
                item.attemptId === null &&
                item.operationId === null &&
                item.resultAcceptances.length === 0 &&
                (item.state === "ready" || item.state === "waiting_dependency"),
            )
          )
            return false;
          if (!isSameAttempt || !prior?.resultAcceptances.length)
            return task.resultAcceptances.some(
              (item) => item.settlementGeneration !== state.generation,
            );
          return (
            prior.resultAcceptances.length !== task.resultAcceptances.length ||
            prior.resultAcceptances.some((item) => {
              const next = task.resultAcceptances.find(
                (value) => value.recoveryId === item.recoveryId,
              );
              return (
                !next ||
                Object.entries(item).some(
                  ([key, value]) => next[key as keyof typeof next] !== value,
                )
              );
            })
          );
        })
      )
        outcome = blocked("orchestrator_result_acceptance_conflict");
      else {
        const projects = previous
          ? current.projects.map((item) =>
              item.projectId === state.projectId ? state : item,
            )
          : [...current.projects, state];
        const saved = writeCoordinatorSnapshotOwned(
          lock,
          binding,
          encodeCoordinatorStateValue({
            ...current,
            snapshotRevision: current.snapshotRevision + 1,
            projects,
          }),
          current.snapshotRevision,
          resultFacts.map((fact) => ({ ...fact, projectId: state.projectId })),
        );
        outcome =
          saved.status === "completed"
            ? completed("orchestrator_state_durable", state)
            : saved;
      }
    }
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      boundaryError = error;
    outcome = blocked("orchestrator_state_observation_unknown");
  }
  const released = lock.release();
  if (boundaryError) {
    if (!released)
      boundaryError.cause = "coordinator_snapshot_lock_release_unconfirmed";
    throw boundaryError;
  }
  if (!released)
    return blocked("orchestrator_snapshot_lock_release_unconfirmed", true);
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
function readCoordinatorSnapshotOwned(
  lock: CoordinatorSnapshotOwner,
  binding: string,
  readMode: boolean | "history" = false,
): StoreResult<CoordinatorSnapshot | null> {
  if (!isLiveCoordinatorSnapshotOwner(lock))
    return blocked("orchestrator_snapshot_lock_owner_invalid", true);
  const observed = readCoordinatorStorageSnapshotOwned(lock, readMode);
  if (observed.status !== "completed")
    return observed.reason === "coordinator_state_uninitialized"
      ? completed("orchestrator_snapshot_absent", null)
      : blocked(observed.reason, true);
  if (!observed.value)
    return blocked("orchestrator_snapshot_invalid_or_unconfirmed", true);
  const decoded = decodeCoordinatorUnifiedSnapshot(
    Buffer.from(`${encodeCoordinatorStateValue(observed.value.snapshot)}\n`),
    lock.repositoryBinding,
  );
  if (!decoded)
    return blocked("orchestrator_snapshot_invalid_or_unconfirmed", true);
  const value = projectCoordinatorTaskSnapshot(
    decoded,
    lock.repositoryRootHash,
  );
  if (value && value.repositoryBindingId !== binding)
    return blocked("orchestrator_snapshot_binding_invalid", true);
  return completed(
    value ? "orchestrator_snapshot_observed" : "orchestrator_snapshot_absent",
    value,
  );
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
export function writeCoordinatorSnapshot(
  workingDirectory: string,
  binding: string,
  payloadJson: string,
  expectedRevision: number,
): StoreResult<CoordinatorSnapshot> {
  const acquired = acquireCoordinatorSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const lock = acquired.value;
  let boundaryError: RepositoryRuntimeDataAreaBlockedError | null = null;
  let outcome: StoreResult<CoordinatorSnapshot>;
  try {
    outcome = writeCoordinatorSnapshotOwned(
      lock,
      binding,
      payloadJson,
      expectedRevision,
    );
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      boundaryError = error;
    outcome = blocked("orchestrator_snapshot_invalid_or_unconfirmed", true);
  }
  const released = lock.release();
  if (boundaryError) {
    if (!released)
      boundaryError.cause = "coordinator_snapshot_lock_release_unconfirmed";
    throw boundaryError;
  }
  if (!released)
    return blocked("orchestrator_snapshot_lock_release_unconfirmed", true);
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
function writeCoordinatorSnapshotOwned(
  lock: CoordinatorSnapshotOwner,
  binding: string,
  payloadJson: string,
  expectedRevision: number,
  resultFacts: unknown = [],
): StoreResult<CoordinatorSnapshot> {
  try {
    if (
      !isLiveCoordinatorSnapshotOwner(lock) ||
      !validId(binding) ||
      typeof payloadJson !== "string" ||
      Buffer.byteLength(payloadJson, "utf8") > MAX_RECORD_BYTES ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0
    )
      return blocked("orchestrator_snapshot_input_invalid");
    const payload: unknown = JSON.parse(payloadJson);
    if (
      !validCoordinatorSnapshot(payload, binding, lock.repositoryRootHash) ||
      payload.snapshotRevision !== expectedRevision + 1
    )
      return blocked("orchestrator_snapshot_input_invalid");
    const observed = readCoordinatorStorageSnapshotOwned(lock, true);
    let current: CoordinatorSnapshot | null = null;
    if (observed.status === "completed" && observed.value) {
      const decoded = decodeCoordinatorUnifiedSnapshot(
        Buffer.from(
          `${encodeCoordinatorStateValue(observed.value.snapshot)}\n`,
        ),
        lock.repositoryBinding,
      );
      if (!decoded)
        return blocked("orchestrator_snapshot_invalid_or_unconfirmed", true);
      current = projectCoordinatorTaskSnapshot(
        decoded,
        lock.repositoryRootHash,
      );
      if (current && current.repositoryBindingId !== binding)
        return blocked("orchestrator_snapshot_binding_invalid", true);
      if (
        observed.value.snapshot.revision !== expectedRevision &&
        !(
          current &&
          current.snapshotRevision === payload.snapshotRevision &&
          encodeCoordinatorStateValue(current) ===
            encodeCoordinatorStateValue(payload)
        )
      )
        return blocked("orchestrator_snapshot_revision_conflict");
    } else if (observed.reason !== "coordinator_state_uninitialized")
      return blocked(observed.reason, true);
    if (
      current &&
      encodeCoordinatorStateValue(current) !==
        encodeCoordinatorStateValue(payload)
    )
      assertCoordinatorSnapshotTransition(current, payload, lock);
    if (
      !current &&
      !Object.values(payload)
        .filter(Array.isArray)
        .every((values) => values.length === 0)
    )
      return blocked("orchestrator_snapshot_initialization_required");
    const saved = writeCoordinatorStorageTaskSnapshotOwned(
      lock,
      payload,
      expectedRevision,
      resultFacts,
    );
    return saved.status === "completed" && saved.value
      ? completed("orchestrator_snapshot_durable", saved.value)
      : blocked(saved.reason, saved.filesystemEffectIssued);
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError) throw error;
    return blocked("orchestrator_snapshot_invalid_or_unconfirmed", true);
  }
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
function assertCoordinatorSnapshotTransition(
  current: CoordinatorSnapshot | null,
  payload: CoordinatorSnapshot,
  owner: CoordinatorSnapshotOwner,
): void {
  if (payload.snapshotRevision !== (current?.snapshotRevision ?? 0) + 1)
    throw new Error("snapshot_revision_conflict");
  for (const intent of payload.leaseIntents) {
    if (intent.phase !== "acquisition_reserved") continue;
    if (
      current?.leaseIntents.some(
        (item) =>
          encodeCoordinatorStateValue(item) ===
          encodeCoordinatorStateValue(intent),
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
      !coordinatorSnapshotLeaseResourcesAbsent(owner.repositoryRoot, identity)
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
        .map((queue) =>
          encodeCoordinatorStateValue([queue.projectId, queue.milestoneId]),
        ),
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
        !coordinatorQueueIsClosed(current, queueId, owner) ||
        !row ||
        inspectCoordinatorHistorySettlement(owner, row) === null
      )
        throw new Error("snapshot_retirement_unconfirmed");
    }
    if (retired.size > 0 !== (payload.intakeEpoch !== current.intakeEpoch))
      throw new Error("snapshot_intake_epoch_transition_invalid");
    if (
      current.schema === COORDINATOR_PROJECT_SNAPSHOT_SCHEMA &&
      payload.schema === COORDINATOR_PROJECT_SNAPSHOT_SCHEMA
    ) {
      for (const old of current.acceptanceDecisions) {
        if (
          retiredMilestones.has(
            encodeCoordinatorStateValue([
              old.record.projectId,
              old.record.milestoneId,
            ]),
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
            (item) =>
              encodeCoordinatorStateValue(item) ===
              encodeCoordinatorStateValue(old),
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
          (encodeCoordinatorStateValue(next) !==
            encodeCoordinatorStateValue(old) &&
            (next.generation !== old.generation + 1 ||
              [
                "recordId",
                "projectId",
                "milestoneId",
                "queueId",
                "expectedGeneration",
              ].some(
                (key) =>
                  next.value[key as keyof CoordinatorDecisionRecoveryIntent] !==
                  old.value[key as keyof CoordinatorDecisionRecoveryIntent],
              )))
        )
          throw new Error("snapshot_decision_recovery_transition_invalid");
      }
    }
    for (const collection of ["results", "leaseEvidence"] as const) {
      for (const old of current[collection])
        if (
          !payload[collection].some(
            (item) =>
              encodeCoordinatorStateValue(item) ===
              encodeCoordinatorStateValue(old),
          )
        )
          if (
            collection === "results"
              ? (!current.queueEntries.some(
                  (queue) =>
                    retired.has(queue.queueId) &&
                    queue.queueId ===
                      (old as CoordinatorResultRecord).queueId &&
                    queue.projectId === old.projectId &&
                    queue.milestoneId ===
                      (old as CoordinatorResultRecord).milestoneId,
                ) &&
                  !current.historyPending.some(
                    (row) =>
                      row.id === (old as CoordinatorResultRecord).identity &&
                      coordinatorStandaloneAdoptionIsClosed(
                        current,
                        row.id,
                        owner,
                      ) &&
                      inspectCoordinatorHistorySettlement(owner, row) !== null,
                  )) ||
                currentEvidenceIds.has(
                  (old as CoordinatorResultRecord).identity,
                ) ||
                payload.queueEntries.some(
                  (item) =>
                    item.resultReference ===
                    (old as CoordinatorResultRecord).identity,
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
                !coordinatorRejectedAdoptionEvidenceCanRetire(
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
                            !coordinatorAdoptionWasRejected(record) &&
                            coordinatorStandaloneAdoptionIsClosed(
                              current,
                              row.id,
                              owner,
                            ),
                        )) &&
                      inspectCoordinatorHistorySettlement(owner, row) !== null,
                  )
                )
          )
            throw new Error("snapshot_retained_obligation_removed");
    }
    for (const old of current.historyPending) {
      if (
        !payload.historyPending.some(
          (item) =>
            encodeCoordinatorStateValue(item) ===
            encodeCoordinatorStateValue(old),
        ) &&
        inspectCoordinatorHistorySettlement(owner, old) === null
      )
        throw new Error("snapshot_history_transfer_unconfirmed");
    }
    for (const old of current.leaseIntents) {
      if (
        payload.leaseIntents.some(
          (item) =>
            encodeCoordinatorStateValue(item) ===
            encodeCoordinatorStateValue(old),
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
        current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
        !end ||
        !coordinatorSnapshotLeaseResourcesAbsent(owner.repositoryRoot, identity)
      )
        throw new Error("snapshot_unsettled_lease_intent_removed");
    }
    for (const old of current.queueEntries) {
      if (retired.has(old.queueId)) continue;
      const next = payload.queueEntries.find(
        (item) => item.queueId === old.queueId,
      );
      if (
        old.singleTask &&
        (!next?.singleTask ||
          [
            "principalId",
            "mode",
            "profileId",
            "catalogRevision",
            "taskId",
            "attemptId",
            "operationId",
          ].some(
            (key) =>
              old.singleTask?.[key as keyof SingleTaskRecord] !==
              next.singleTask?.[key as keyof SingleTaskRecord],
          ) ||
          (old.singleTask.adviceOperation !== undefined &&
            encodeCoordinatorStateValue(old.singleTask.adviceOperation) !==
              encodeCoordinatorStateValue(next.singleTask.adviceOperation)) ||
          (old.singleTask.phase === "settled" &&
            (old.singleTask.status !== next.singleTask.status ||
              old.singleTask.reason !== next.singleTask.reason ||
              next.singleTask.phase !== "settled" ||
              (old.singleTask.cleanupConfirmed &&
                !next.singleTask.cleanupConfirmed) ||
              next.singleTask.recoveryIds.some(
                (id) => !old.singleTask?.recoveryIds.includes(id),
              ))))
      )
        throw new Error("snapshot_single_task_identity_invalid");
      if (
        old.singleTask &&
        next?.singleTask &&
        encodeCoordinatorStateValue(old.singleTask) !==
          encodeCoordinatorStateValue(next.singleTask)
      ) {
        const unstartedRejection =
          old.singleTask.phase === "accepted" &&
          next.singleTask.phase === "settled" &&
          next.singleTask.status === "blocked" &&
          next.singleTask.cleanupConfirmed &&
          next.singleTask.recoveryIds.length === 0 &&
          old.ownerGeneration === null &&
          next.ownerGeneration === null &&
          !current.leaseIntents.some(
            (intent) => intent.queueId === old.queueId,
          );
        const phases: Record<SingleTaskRecord["phase"], readonly string[]> = {
          accepted: ["starting"],
          starting: ["starting", "running", "settled"],
          running: ["settled"],
          settled: ["settled"],
        };
        if (
          !unstartedRejection &&
          (!phases[old.singleTask.phase].includes(next.singleTask.phase) ||
            !current.leaseIntents.some(
              (intent) =>
                intent.queueId === old.queueId &&
                intent.projectId === old.projectId &&
                intent.kind === "project-operation" &&
                intent.phase === "lock_owned" &&
                intent.ownerProcessId === process.pid &&
                intent.ownerGeneration === next.ownerGeneration,
            ))
        )
          throw new Error("snapshot_single_task_transition_invalid");
      }
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
        (encodeCoordinatorStateValue(next) !==
          encodeCoordinatorStateValue(old) &&
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
        next.milestoneId === old.milestoneId &&
        encodeCoordinatorStateValue(next.taskExecutionSelections) !==
          encodeCoordinatorStateValue(old.taskExecutionSelections)
      )
        throw new Error("snapshot_project_selection_changed");
      if (
        next &&
        next.milestoneId !== old.milestoneId &&
        current.queueEntries.some(
          (queue) =>
            !queue.singleTask &&
            queue.projectId === old.projectId &&
            !retired.has(queue.queueId),
        )
      )
        throw new Error("snapshot_project_milestone_still_referenced");
      if (
        !next ||
        (encodeCoordinatorStateValue(next) !==
          encodeCoordinatorStateValue(old) &&
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
function withCoordinatorSnapshotOperation<T>(
  workingDirectory: string,
  binding: string,
  operation: (
    current: CoordinatorSnapshot,
    owner: CoordinatorSnapshotOwner,
  ) => StoreResult<Readonly<{ next: CoordinatorSnapshot | null; value: T }>>,
  readMode: false | "history" = false,
): StoreResult<T> {
  if (!validId(binding)) return blocked("orchestrator_snapshot_input_invalid");
  const acquired = acquireCoordinatorSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed") return blocked(acquired.reason);
  const owner = acquired.value;
  let result: StoreResult<T>;
  try {
    const observed = readCoordinatorSnapshotOwned(owner, binding, readMode);
    if (observed.status !== "completed") result = observed;
    else if (observed.value === null)
      result = blocked("orchestrator_snapshot_absent");
    else {
      const applied = operation(observed.value, owner);
      if (applied.status !== "completed") result = applied;
      else if (applied.value.next === null)
        result = completed(applied.reason, applied.value.value);
      else {
        const saved = writeCoordinatorSnapshotOwned(
          owner,
          binding,
          encodeCoordinatorStateValue({
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
    result = blocked("orchestrator_snapshot_operation_invalid_or_unconfirmed");
  }
  try {
    if (!owner.release())
      return blocked("orchestrator_snapshot_lock_release_unconfirmed", true);
  } catch {
    return blocked("orchestrator_snapshot_lock_release_unconfirmed", true);
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
function coordinatorQueueIsClosed(
  current: CoordinatorSnapshot,
  queueId: string,
  owner: CoordinatorSnapshotOwner,
): boolean {
  try {
    if (current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA) return false;
    const queue = current.queueEntries.find((item) => item.queueId === queueId);
    if (
      !queue ||
      !["completed", "cancelled"].includes(queue.state) ||
      queue.ownerGeneration !== null
    )
      return false;
    if (queue.singleTask) {
      return (
        queue.singleTask.phase === "settled" &&
        queue.workspaceId == null &&
        queue.singleTask.cleanupConfirmed &&
        queue.singleTask.recoveryIds.length === 0 &&
        !current.leaseIntents.some((item) => item.queueId === queueId) &&
        coordinatorSnapshotLeaseResourcesAbsent(
          owner.repositoryRoot,
          leaseIdentity(
            current.repositoryBindingId,
            queue.projectId,
            queueId,
            "project-operation",
          ),
        )
      );
    }
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
        encodeCoordinatorStateValue([...receipt.value.changedPaths].sort()) !==
          encodeCoordinatorStateValue([...candidate.value.changedPaths].sort())
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
        !coordinatorSnapshotLeaseResourcesAbsent(
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
function coordinatorAdoptionWasRejected(
  record: CoordinatorResultRecord,
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
      "orchestrator_adoption_revision_or_scope_mismatch" &&
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
function coordinatorRejectedAdoptionEvidenceCanRetire(
  current: CoordinatorSnapshot,
  payload: CoordinatorSnapshot,
  evidence: LeaseEvidenceEnvelope,
  owner: CoordinatorSnapshotOwner,
): boolean {
  if (evidence.content.kind !== "canonical-adoption") return false;
  const record = current.results.find(
    (item) =>
      item.projectId === evidence.projectId &&
      item.identity === evidence.content.ownerGeneration &&
      coordinatorAdoptionWasRejected(item),
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
      coordinatorStandaloneAdoptionIsClosed(current, record.identity, owner) &&
      inspectCoordinatorHistorySettlement(owner, row) !== null,
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
function coordinatorStandaloneAdoptionIsClosed(
  current: CoordinatorSnapshot,
  identity: string,
  owner: CoordinatorSnapshotOwner,
): boolean {
  try {
    if (current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA) return false;
    const record = current.results.find(
      (item) => item.identity === identity && item.kind === "adoption",
    );
    const isRejected =
      record !== undefined && coordinatorAdoptionWasRejected(record);
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
            !coordinatorAdoptionWasRejected(other),
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
    return coordinatorSnapshotLeaseResourcesAbsent(
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
export function maintainCoordinatorSnapshot(
  workingDirectory: string,
  binding: string,
  now = Date.now(),
): StoreResult<number> {
  const prepared = withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      if (
        !Number.isSafeInteger(now) ||
        now < 0 ||
        current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA
      )
        return blocked("orchestrator_history_time_invalid");
      const rows = current.queueEntries
        .filter(
          (queue) =>
            !current.historyPending.some((row) => row.id === queue.queueId) &&
            coordinatorQueueIsClosed(current, queue.queueId, owner),
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
          !coordinatorStandaloneAdoptionIsClosed(
            current,
            record.identity,
            owner,
          )
        )
          continue;
        rows.push({
          id: record.identity,
          occurredAt: new Date(now).toISOString(),
          outcome: coordinatorAdoptionWasRejected(record)
            ? "failed"
            : "completed",
          primaryFailure: coordinatorAdoptionWasRejected(record)
            ? "execution"
            : null,
          cleanup: "confirmed",
        });
      }
      return completed("orchestrator_history_prepared", {
        next: rows.length
          ? { ...current, historyPending: [...current.historyPending, ...rows] }
          : null,
        value: rows.length,
      });
    },
    "history",
  );
  if (prepared.status !== "completed") return prepared;
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      if (current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA)
        return blocked("orchestrator_snapshot_schema_invalid");
      const trimmed = updateCoordinatorHistoryOwned(
        owner,
        current.historyPending.length
          ? encodeCoordinatorStateValue(current.historyPending)
          : null,
        now,
      );
      if (trimmed.status !== "completed") return blocked(trimmed.reason, true);
      const retired = new Set<string>();
      for (const row of current.historyPending) {
        if (
          !coordinatorQueueIsClosed(current, row.id, owner) &&
          !coordinatorStandaloneAdoptionIsClosed(current, row.id, owner)
        )
          continue;
        if (inspectCoordinatorHistorySettlement(owner, row, now) === null)
          return blocked("orchestrator_history_transfer_unconfirmed", true);
        retired.add(row.id);
      }
      return completed("orchestrator_terminal_records_retired", {
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
                  !coordinatorRejectedAdoptionEvidenceCanRetire(
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
                              !coordinatorAdoptionWasRejected(record),
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
    "history",
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
export function transferCoordinatorSnapshotHistory(
  workingDirectory: string,
  binding: string,
  now = Date.now(),
): StoreResult<Readonly<{ recorded: number; expired: number }>> {
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      let recorded = 0;
      let expired = 0;
      if (current.historyPending.length) {
        const saved = updateCoordinatorHistoryOwned(
          owner,
          encodeCoordinatorStateValue(current.historyPending),
          now,
        );
        if (saved.status !== "completed") return blocked(saved.reason, true);
      }
      for (const row of current.historyPending) {
        const disposition = inspectCoordinatorHistorySettlement(
          owner,
          row,
          now,
        );
        if (disposition === null)
          return blocked("orchestrator_history_transfer_unconfirmed", true);
        if (disposition === "recorded") recorded += 1;
        else expired += 1;
      }
      return completed("orchestrator_history_transferred", {
        next: current.historyPending.length
          ? { ...current, historyPending: [] }
          : null,
        value: { recorded, expired },
      });
    },
    "history",
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
export function createCoordinatorSnapshotAcceptanceDecisionStore(
  workingDirectory: string,
  binding: string,
): CoordinatorAcceptanceDecisionStore {
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
      return withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !validCoordinatorAcceptanceDecisionRecord(record) ||
            record.disposition !== "prepared"
          )
            return blocked("orchestrator_acceptance_record_invalid");
          if (
            current.acceptanceDecisions.some(
              (item) => item.recordId === record.recordId,
            )
          )
            return blocked("orchestrator_acceptance_record_exists");
          const entry: CoordinatorAcceptanceDecisionEnvelope = {
            contract: COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT,
            repositoryBindingId: binding,
            recordId: record.recordId,
            generation: 1,
            previousHash: null,
            record,
          };
          return completed("orchestrator_acceptance_record_created", {
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
      return withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !validId(recordId)
          )
            return blocked("orchestrator_acceptance_record_identity_invalid");
          const groups = current.acceptanceDecisions.filter(
            (item) => item.recordId === recordId,
          );
          return completed("orchestrator_acceptance_record_observed", {
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
      return withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !validCoordinatorAcceptanceDecisionRecord(expected) ||
            !validCoordinatorAcceptanceDecisionRecord(next) ||
            expected.recordId !== next.recordId ||
            expected.disposition !== "prepared" ||
            next.disposition !== "finalized"
          )
            return blocked("orchestrator_acceptance_record_transition_invalid");
          const first = current.acceptanceDecisions.find(
            (item) =>
              item.recordId === expected.recordId && item.generation === 1,
          );
          if (
            !first ||
            encodeCoordinatorStateValue(first.record) !==
              encodeCoordinatorStateValue(expected)
          )
            return blocked(
              "orchestrator_acceptance_record_generation_mismatch",
            );
          if (
            current.acceptanceDecisions.some(
              (item) =>
                item.recordId === expected.recordId && item.generation === 2,
            )
          )
            return blocked("orchestrator_acceptance_record_exists");
          const entry: CoordinatorAcceptanceDecisionEnvelope = {
            contract: COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT,
            repositoryBindingId: binding,
            recordId: expected.recordId,
            generation: 2,
            previousHash: digest(encodeCoordinatorStateValue(first)),
            record: next,
          };
          return completed("orchestrator_acceptance_record_finalized", {
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
export function createCoordinatorSnapshotDecisionRecoveryStore(
  workingDirectory: string,
  binding: string,
): CoordinatorDecisionRecoveryStore {
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
      return withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !validCoordinatorDecisionRecoveryIntent(intent)
          )
            return blocked("orchestrator_decision_recovery_invalid");
          if (
            current.decisionRecoveries.some(
              (item) => item.value.recoveryId === intent.recoveryId,
            )
          )
            return blocked("orchestrator_decision_recovery_exists");
          return completed("orchestrator_decision_recovery_created", {
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
      return withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !validId(recoveryId)
          )
            return blocked("orchestrator_decision_recovery_invalid");
          return completed("orchestrator_decision_recovery_observed", {
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
      return withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !validCoordinatorDecisionRecoveryIntent(expected) ||
            !validCoordinatorDecisionRecoveryIntent(next) ||
            expected.recoveryId !== next.recoveryId
          )
            return blocked("orchestrator_decision_recovery_invalid");
          const prior = current.decisionRecoveries.find(
            (item) => item.value.recoveryId === expected.recoveryId,
          );
          if (
            !prior ||
            encodeCoordinatorStateValue(prior.value) !==
              encodeCoordinatorStateValue(expected)
          )
            return blocked(
              "orchestrator_decision_recovery_generation_mismatch",
            );
          return completed("orchestrator_decision_recovery_updated", {
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
export function createCoordinatorSnapshotIntegrationRecordPort(
  binding: IntegrationRecordBinding,
): CoordinatorIntegrationRecordPort {
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
      return withCoordinatorSnapshotOperation(
        binding.workingDirectory,
        binding.repositoryBindingId,
        (current) => {
          const value: CoordinatorResultRecord = {
            contract: COORDINATOR_INTEGRATION_CONTRACT,
            kind: record.kind,
            repositoryBindingId: binding.repositoryBindingId,
            projectId: binding.projectId,
            milestoneId: binding.milestoneId,
            queueId: binding.queueId,
            identity: record.identity,
            contentHash: digest(encodeCoordinatorStateValue(record.value)),
            value: record.value,
          };
          if (!validCoordinatorResultRecord(value))
            return blocked("orchestrator_result_invalid");
          const queue = current.queueEntries.find(
            (item) => item.queueId === binding.queueId,
          );
          if (
            (value.kind === "integration" && (!queue || queue.singleTask)) ||
            (value.milestoneId === null && !queue?.singleTask) ||
            (queue &&
              (queue.projectId !== binding.projectId ||
                queue.milestoneId !== binding.milestoneId))
          )
            return blocked("orchestrator_result_binding_invalid");
          const old = current.results.find(
            (item) =>
              item.kind === value.kind &&
              item.projectId === value.projectId &&
              item.identity === value.identity,
          );
          if (
            old &&
            encodeCoordinatorStateValue(old) !==
              encodeCoordinatorStateValue(value)
          )
            return blocked("orchestrator_result_identity_conflict");
          return completed("orchestrator_result_durable", {
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
export function inspectCoordinatorSnapshotLeaseAcquisitionOwner(
  workingDirectory: string,
  binding: string,
): StoreResult<
  Readonly<{ acquisition: CoordinatorLeaseAcquisitionResolution | null }>
> {
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current) => {
      if (current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA)
        return blocked("orchestrator_snapshot_schema_invalid");
      const intents = current.leaseIntents.filter(
        (item) => item.kind === "project-operation",
      );
      const first = intents[0];
      if (!first)
        return completed("orchestrator_lease_acquisition_absent", {
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
          "orchestrator_lease_acquisition_owner_mismatch",
          true,
          first.recoveryId,
        );
      return completed("orchestrator_lease_acquisition_owner_observed", {
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
export function acquireCoordinatorSnapshotLease(
  workingDirectory: string,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
): StoreResult<CoordinatorLease> {
  if (
    ![binding, projectId, queueId].every(validId) ||
    (kind !== "project-operation" && kind !== "canonical-adoption")
  )
    return blocked("orchestrator_lease_identity_invalid");
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
  const reserved = withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      if (
        current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
        !validId(projectId) ||
        (kind === "project-operation"
          ? !current.queueEntries.some(
              (item) =>
                item.queueId === queueId && item.projectId === projectId,
            )
          : queueId !== "canonical")
      )
        return blocked("orchestrator_lease_binding_invalid");
      if (
        current.leaseIntents.some(
          (item) =>
            leaseIdentity(binding, item.projectId, item.queueId, item.kind) ===
            identity,
        )
      )
        return blocked("orchestrator_lease_unavailable");
      if (
        !coordinatorSnapshotLeaseResourcesAbsent(owner.repositoryRoot, identity)
      )
        return blocked("orchestrator_lease_preexisting_resource");
      const metadata = fs.lstatSync(owner.repositoryRoot);
      intentSaveRequested = true;
      return completed("orchestrator_lease_intent_durable", {
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
  const leasePaths = resolveCoordinatorNamedPaths(repositoryRoot);
  if (!leasePaths || leasePaths.repositoryRoot !== repositoryRoot)
    return blocked(
      "orchestrator_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  const lock = path.join(
    leasePaths.temporary,
    "orchestrator-leases",
    `${identity}.lock`,
  );
  let physicalIdentity: string;
  try {
    const resolved = resolveCoordinatorNamedPaths(workingDirectory);
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
      "orchestrator_repository_root_invalid",
    ).directory;
    const boundary = assertCoordinatorArea(repositoryRoot, "tmp", temporary);
    const locks = ensureDirectory(temporary, "orchestrator-leases");
    assertDirectory(locks);
    fs.mkdirSync(lock, { mode: 0o700 });
    assertDirectory(locks);
    assertDirectory(lock);
    const metadata = fs.lstatSync(lock);
    physicalIdentity = digest(
      JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
    );
    assertCoordinatorAreaUnchanged(repositoryRoot, "tmp", boundary);
  } catch {
    return blocked(
      "orchestrator_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  }
  const acquired = withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current) => {
      if (
        current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
        !current.leaseIntents.some(
          (item) =>
            encodeCoordinatorStateValue(item) ===
            encodeCoordinatorStateValue(intent),
        )
      )
        return blocked("orchestrator_lease_intent_mismatch", true, recoveryId);
      const metadata = fs.lstatSync(lock);
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        ) !== physicalIdentity
      )
        return blocked(
          "orchestrator_lease_physical_identity_changed",
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
      return completed("orchestrator_lease_acquired", {
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
      "orchestrator_lease_acquisition_recovery_required",
      true,
      recoveryId,
    );
  let released = false;
  let lease!: CoordinatorLease;
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
      if (released) return blocked("orchestrator_lease_already_released");
      const active = activeLeases.get(lease);
      if (!active || !activeLeaseIsObserved(active))
        return blocked("orchestrator_lease_release_unknown", true, recoveryId);
      const pending = withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !current.leaseIntents.some(
              (item) =>
                item.ownerGeneration === ownerGeneration &&
                item.phase === "lock_owned" &&
                item.physicalIdentity === physicalIdentity,
            )
          )
            return blocked(
              "orchestrator_lease_intent_mismatch",
              true,
              recoveryId,
            );
          return completed("orchestrator_lease_release_intent_durable", {
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
        return blocked("orchestrator_lease_release_unknown", true, recoveryId);
      }
      try {
        if (!activeLeaseIsObserved(active))
          throw new Error("lease_identity_changed");
        const boundary = assertCoordinatorArea(
          repositoryRoot,
          "tmp",
          leasePaths.temporary,
        );
        fs.rmdirSync(lock);
        assertCoordinatorAreaUnchanged(repositoryRoot, "tmp", boundary);
        if (!coordinatorSnapshotLeaseResourcesAbsent(repositoryRoot, identity))
          throw new Error("lease_release_unconfirmed");
      } catch {
        activeLeases.delete(lease);
        return blocked("orchestrator_lease_release_unknown", true, recoveryId);
      }
      activeLeases.delete(lease);
      const settled = withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !current.leaseIntents.some(
              (item) =>
                item.ownerGeneration === ownerGeneration &&
                item.phase === "release_pending" &&
                item.physicalIdentity === physicalIdentity,
            )
          )
            return blocked(
              "orchestrator_lease_intent_mismatch",
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
          return completed("orchestrator_lease_released", {
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
        return blocked("orchestrator_lease_release_unknown", true, recoveryId);
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
  return completed("orchestrator_lease_acquired", lease);
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
function coordinatorSnapshotLeaseResourcesAbsent(
  repositoryRoot: string,
  identity: string,
): boolean {
  assertDirectory(repositoryRoot);
  const boundary = observeCoordinatorArea(repositoryRoot, "tmp");
  if (boundary.status === "not_observed") {
    assertCoordinatorAreaUnchanged(repositoryRoot, "tmp", boundary);
    return true;
  }
  const parent = path.join(boundary.directory, "orchestrator-leases");
  if (pathConfirmedAbsent(parent)) {
    assertCoordinatorAreaUnchanged(repositoryRoot, "tmp", boundary);
    return true;
  }
  assertDirectory(parent);
  const isAbsent = leaseAcquisitionFootprintAbsent(parent, identity, [
    path.join(parent, `${identity}.lock`),
  ]);
  assertDirectory(repositoryRoot);
  assertDirectory(parent);
  assertCoordinatorAreaUnchanged(repositoryRoot, "tmp", boundary);
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
export function reconcileCoordinatorSnapshotLeaseOwnerLoss(
  workingDirectory: string,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
  observeOwner: CoordinatorLeaseOwnerObservation,
): StoreResult<
  Readonly<{ queue: ProjectQueueEntry | null; recoveryId: string | null }>
> {
  if (
    ![binding, projectId, queueId].every(validId) ||
    !["project-operation", "canonical-adoption"].includes(kind) ||
    typeof observeOwner !== "function"
  )
    return blocked("orchestrator_lease_recovery_input_invalid");
  const recoveryId = leaseAcquisitionRecoveryId(
    binding,
    projectId,
    queueId,
    kind,
  );
  const identity = leaseIdentity(binding, projectId, queueId, kind);
  const inspected = withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      if (current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA)
        return blocked("orchestrator_snapshot_schema_invalid");
      const queue =
        kind === "project-operation"
          ? (current.queueEntries.find((item) => item.queueId === queueId) ??
            null)
          : null;
      if (
        !validId(projectId) ||
        (kind === "project-operation"
          ? queue?.projectId !== projectId
          : queueId !== "canonical")
      )
        return blocked("orchestrator_lease_binding_invalid");
      const intents = current.leaseIntents.filter(
        (item) =>
          item.projectId === projectId &&
          item.queueId === queueId &&
          item.kind === kind,
      );
      const metadata = fs.lstatSync(owner.repositoryRoot);
      return completed("orchestrator_lease_recovery_inspected", {
        next: null,
        value: {
          intents,
          queue,
          intakeEpoch: current.intakeEpoch,
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
  const leasePaths = resolveCoordinatorNamedPaths(initial.repositoryRoot);
  if (!leasePaths || leasePaths.repositoryRoot !== initial.repositoryRoot)
    return blocked(
      "orchestrator_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  const lock = path.join(
    leasePaths.temporary,
    "orchestrator-leases",
    `${identity}.lock`,
  );
  const first = initial.intents[0];
  if (!first) {
    if (initial.queue?.ownerGeneration) {
      if (!["leased", "running"].includes(initial.queue.state)) {
        const settled = createCoordinatorSnapshotPersistencePorts(
          workingDirectory,
          binding,
          initial.intakeEpoch,
        ).state.settleQueueLeaseRelease(
          queueId,
          initial.queue.generation,
          initial.queue.ownerGeneration,
        );
        return settled.status === "completed"
          ? completed(settled.reason, {
              queue: settled.value,
              recoveryId: null,
            })
          : blocked(settled.reason, true, recoveryId);
      }
      return withCoordinatorSnapshotOperation(
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
            !coordinatorSnapshotLeaseResourcesAbsent(
              owner.repositoryRoot,
              identity,
            )
          )
            return blocked(
              "orchestrator_lease_recovery_state_mismatch",
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
          return completed("orchestrator_released_lease_reconciled", {
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
        !coordinatorSnapshotLeaseResourcesAbsent(
          initial.repositoryRoot,
          identity,
        ) ||
        initial.queue?.ownerGeneration
      )
        return blocked(
          "orchestrator_lease_recovery_state_mismatch",
          true,
          recoveryId,
        );
      return completed("orchestrator_lease_acquisition_resources_absent", {
        queue: initial.queue,
        recoveryId: null,
      });
    } catch {
      return blocked(
        "orchestrator_lease_recovery_observation_unknown",
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
      "orchestrator_lease_acquisition_owner_mismatch",
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
      "orchestrator_lease_owner_observation_unknown",
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
      "orchestrator_lease_owner_observation_unknown",
      true,
      recoveryId,
    );
  if (observation.status === "alive")
    return blocked("orchestrator_lease_owner_still_active");
  if (observation.status !== "absent")
    return blocked(
      "orchestrator_lease_owner_observation_unknown",
      true,
      recoveryId,
    );
  let physicalIdentity =
    ownIntents.find((item) => item.physicalIdentity !== null)
      ?.physicalIdentity ?? null;
  if (physicalIdentity === null) {
    try {
      if (
        !coordinatorSnapshotLeaseResourcesAbsent(
          initial.repositoryRoot,
          identity,
        )
      ) {
        if (first.phase !== "acquisition_reserved" || ownIntents.length !== 1)
          return blocked(
            "orchestrator_lease_physical_identity_unconfirmed",
            true,
            recoveryId,
          );
        const boundary = assertCoordinatorArea(
          initial.repositoryRoot,
          "tmp",
          leasePaths.temporary,
        );
        assertDirectory(path.dirname(lock));
        assertDirectory(lock);
        const metadata = fs.lstatSync(lock);
        if (fs.readdirSync(lock).length !== 0)
          return blocked(
            "orchestrator_lease_physical_identity_unconfirmed",
            true,
            recoveryId,
          );
        physicalIdentity = digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        );
        assertCoordinatorAreaUnchanged(initial.repositoryRoot, "tmp", boundary);
      }
    } catch {
      return blocked(
        "orchestrator_lease_recovery_observation_unknown",
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
  const reserved = withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      const metadata = fs.lstatSync(owner.repositoryRoot);
      if (
        current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
        owner.repositoryRoot !== initial.repositoryRoot ||
        digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        ) !== initial.rootIdentity ||
        encodeCoordinatorStateValue(
          current.leaseIntents.filter(
            (item) =>
              item.projectId === projectId &&
              item.queueId === queueId &&
              item.kind === kind,
          ),
        ) !== encodeCoordinatorStateValue(ownIntents) ||
        encodeCoordinatorStateValue(
          kind === "project-operation"
            ? (current.queueEntries.find((item) => item.queueId === queueId) ??
                null)
            : null,
        ) !== encodeCoordinatorStateValue(initial.queue)
      )
        return blocked(
          "orchestrator_lease_recovery_state_mismatch",
          true,
          recoveryId,
        );
      const existing = ownIntents.find(
        (item) => item.phase === "recovery_pending",
      );
      if (
        existing &&
        encodeCoordinatorStateValue(existing) !==
          encodeCoordinatorStateValue(pending)
      )
        return blocked("orchestrator_lease_intent_mismatch", true, recoveryId);
      return completed("orchestrator_lease_recovery_intent_durable", {
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
    const resolved = resolveCoordinatorNamedPaths(workingDirectory);
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
      !coordinatorSnapshotLeaseResourcesAbsent(initial.repositoryRoot, identity)
    ) {
      const boundary = assertCoordinatorArea(
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
          "orchestrator_lease_physical_identity_unconfirmed",
          true,
          recoveryId,
        );
      fs.rmdirSync(lock);
      assertCoordinatorAreaUnchanged(initial.repositoryRoot, "tmp", boundary);
    }
    if (
      !coordinatorSnapshotLeaseResourcesAbsent(initial.repositoryRoot, identity)
    )
      throw new Error("lease_release_unconfirmed");
  } catch {
    return blocked(
      "orchestrator_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  }
  const settled = withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      const metadata = fs.lstatSync(owner.repositoryRoot);
      if (
        current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
        owner.repositoryRoot !== initial.repositoryRoot ||
        digest(
          JSON.stringify([metadata.dev, metadata.ino, metadata.birthtimeMs]),
        ) !== initial.rootIdentity ||
        encodeCoordinatorStateValue(
          kind === "project-operation"
            ? (current.queueEntries.find((item) => item.queueId === queueId) ??
                null)
            : null,
        ) !== encodeCoordinatorStateValue(initial.queue) ||
        encodeCoordinatorStateValue(
          current.leaseIntents.filter(
            (item) =>
              item.projectId === projectId &&
              item.queueId === queueId &&
              item.kind === kind,
          ),
        ) !==
          encodeCoordinatorStateValue(
            ownIntents.some((item) => item.phase === "recovery_pending")
              ? ownIntents
              : [...ownIntents, pending],
          ) ||
        !coordinatorSnapshotLeaseResourcesAbsent(
          initial.repositoryRoot,
          identity,
        )
      )
        return blocked(
          "orchestrator_lease_recovery_state_mismatch",
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
          "orchestrator_lease_recovery_state_mismatch",
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
      return completed("orchestrator_lease_owner_loss_reconciled", {
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
function coordinatorSnapshotIntakeMatches(
  current: CoordinatorSnapshot,
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
export function inspectCoordinatorSnapshotIntake(
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
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current) =>
      coordinatorSnapshotIntakeMatches(current, intake)
        ? completed("orchestrator_intake_verified", {
            next: null,
            value: true as const,
          })
        : blocked("orchestrator_intake_epoch_retired"),
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
export function createCoordinatorSnapshotStatePort(
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
): CoordinatorStatePort {
  if (!validId(binding) || !validId(intakeEpoch))
    throw new Error("snapshot_port_binding_invalid");
  return Object.freeze({
    readWorkspaceTaskTarget: (queueId: string) =>
      resolveCoordinatorWorkspaceTaskTarget(workingDirectory, binding, queueId),
    writeState: (state, expectedGeneration, resultFacts) =>
      writeCoordinatorSnapshotState(
        workingDirectory,
        binding,
        encodeCoordinatorStateValue(state),
        expectedGeneration,
        intake,
        resultFacts,
      ),
    readState: (projectId) =>
      withCoordinatorSnapshotOperation(workingDirectory, binding, (current) => {
        if (!validId(projectId))
          return blocked("orchestrator_state_identity_invalid");
        return completed("orchestrator_state_observed", {
          next: null,
          value:
            current.projects.find((item) => item.projectId === projectId) ??
            null,
        });
      }),
    enqueueOperation: (input) =>
      withCoordinatorSnapshotOperation(workingDirectory, binding, (current) => {
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
            ? completed("orchestrator_queue_request_reused", {
                next: null,
                value: existing,
              })
            : blocked("orchestrator_queue_identity_conflict");
        }
        if (current.intakeEpoch !== intakeEpoch)
          return blocked("orchestrator_intake_epoch_retired");
        const value: ProjectQueueEntry = {
          ...input,
          workspaceId: input.workspaceId ?? null,
          state: "queued",
          generation: 1,
          ownerGeneration: null,
          resumeCondition: null,
          resultReference: null,
        };
        if (
          !validQueueEntry(value) ||
          value.singleTask !== undefined ||
          !current.projects.some((item) => item.projectId === value.projectId)
        )
          return blocked("orchestrator_queue_input_invalid");
        if (
          value.workspaceId != null &&
          (!current.queueEntries.some(
            (entry) =>
              entry.projectId === value.projectId &&
              entry.workspaceId === value.workspaceId,
          ) ||
            !current.workspaces.some(
              (entry) =>
                entry.workspaceId === value.workspaceId &&
                entry.phase === "ready" &&
                entry.holdUntil === null,
            ))
        )
          return blocked("orchestrator_workspace_not_ready");
        return completed("orchestrator_queue_entry_durable", {
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
      }),
    readQueue: (queueId) =>
      withCoordinatorSnapshotOperation(workingDirectory, binding, (current) => {
        if (!validId(queueId))
          return blocked("orchestrator_queue_input_invalid");
        const value = current.queueEntries.find(
          (item) => item.queueId === queueId,
        );
        return value
          ? completed("orchestrator_queue_observed", { next: null, value })
          : blocked("orchestrator_queue_observation_unknown");
      }),
    selectNextOperation: () =>
      withCoordinatorSnapshotOperation(workingDirectory, binding, (current) => {
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
              ? "orchestrator_active_operation_retained"
              : "orchestrator_interactive_queue_selected",
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
          return completed("orchestrator_scheduled_queue_selected", {
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
            ? "orchestrator_scheduled_queue_selected"
            : "orchestrator_queue_empty",
          { next: null, value },
        );
      }),
    updateQueue: (queueId, expectedGeneration, next) =>
      withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current, owner) => {
          const previous = current.queueEntries.find(
            (item) => item.queueId === queueId,
          );
          if (previous?.singleTask)
            return blocked("orchestrator_single_task_owner_required");
          if (
            !validId(queueId) ||
            !Number.isSafeInteger(expectedGeneration) ||
            expectedGeneration < 1 ||
            !previous ||
            previous.generation !== expectedGeneration
          )
            return blocked("orchestrator_queue_generation_conflict");
          if (next.resumeCondition !== null && !validId(next.resumeCondition))
            return blocked("orchestrator_queue_resume_condition_invalid");
          if (
            next.resultReference !== null &&
            !validResultReference(next.resultReference)
          )
            return blocked("orchestrator_queue_result_reference_invalid");
          if (
            !(
              QUEUE_TRANSITIONS[previous.state] as readonly ProjectQueueState[]
            ).includes(next.state)
          )
            return blocked("orchestrator_queue_transition_invalid");
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
            return blocked("orchestrator_queue_recovery_binding_invalid");
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
            return blocked("orchestrator_queue_owner_loss_reset_invalid");
          const activeLease = next.lease
            ? activeLeases.get(next.lease)
            : undefined;
          const isRequired =
            previous.ownerGeneration !== null ||
            next.state === "leased" ||
            next.state === "running";
          if (!isRequired && next.lease !== null)
            return blocked("orchestrator_queue_lease_invalid");
          if (
            isRequired &&
            (activeLease?.kind !== "project-operation" ||
              activeLease.repositoryRoot !== owner.repositoryRoot ||
              activeLease.repositoryBindingId !== binding ||
              activeLease.projectId !== previous.projectId ||
              activeLease.queueId !== queueId ||
              !activeLeaseIsObserved(activeLease))
          )
            return blocked("orchestrator_queue_lease_invalid");
          if (
            isRequired &&
            previous.ownerGeneration !== null &&
            previous.ownerGeneration !== activeLease?.ownerGeneration
          )
            return blocked("orchestrator_queue_owner_mismatch");
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
            return blocked("orchestrator_queue_record_mismatch");
          return completed("orchestrator_queue_state_durable", {
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
      withCoordinatorSnapshotOperation(workingDirectory, binding, (current) => {
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
          return blocked("orchestrator_queue_recovery_generation_conflict");
        if (
          previous.state !== "recovery_required" ||
          previous.ownerGeneration !== null ||
          previous.resumeCondition !== "exact_recovery" ||
          previous.resultReference !== recoveryId
        )
          return blocked("orchestrator_queue_recovery_identity_mismatch");
        const value: ProjectQueueEntry = {
          ...previous,
          state: "queued",
          generation: previous.generation + 1,
          ownerGeneration: null,
          resumeCondition: "exact_recovery_settled",
          resultReference: recoveryId,
        };
        return completed("orchestrator_queue_recovery_settled", {
          next: {
            ...current,
            queueEntries: current.queueEntries.map((item) =>
              item.queueId === queueId ? value : item,
            ),
          },
          value,
        });
      }),
    settleQueueLeaseRelease: (queueId, expectedGeneration, ownerGeneration) =>
      withCoordinatorSnapshotOperation(
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
              "orchestrator_queue_release_settlement_state_mismatch",
              true,
            );
          const paths = resolveCoordinatorNamedPaths(owner.repositoryRoot);
          if (!paths) throw new Error("orchestrator_repository_root_invalid");
          const runtime = paths.coordinator;
          const boundary = assertCoordinatorArea(
            owner.repositoryRoot,
            "coordinator",
            runtime,
          );
          const identity = leaseIdentity(
            binding,
            previous.projectId,
            queueId,
            "project-operation",
          );
          const locks =
            current.schema === COORDINATOR_PROJECT_SNAPSHOT_SCHEMA
              ? path.join(paths.temporary, "orchestrator-leases")
              : path.join(runtime, "work", "locks");
          if (
            !(current.schema === COORDINATOR_PROJECT_SNAPSHOT_SCHEMA
              ? coordinatorSnapshotLeaseResourcesAbsent(
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
              "orchestrator_queue_release_settlement_resource_present",
              true,
            );
          assertCoordinatorAreaUnchanged(
            owner.repositoryRoot,
            "coordinator",
            boundary,
          );
          const evidence =
            current.schema === COORDINATOR_PROJECT_SNAPSHOT_SCHEMA
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
            current.schema === COORDINATOR_PROJECT_SNAPSHOT_SCHEMA &&
            current.leaseIntents.some(
              (item) => item.ownerGeneration === ownerGeneration,
            )
          )
            return blocked("orchestrator_queue_release_intent_unsettled", true);
          if (!evidence.released || evidence.recovered)
            return blocked(
              "orchestrator_queue_release_evidence_mismatch",
              true,
            );
          const value = {
            ...previous,
            generation: previous.generation + 1,
            ownerGeneration: null,
          };
          return completed("orchestrator_queue_release_settled", {
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
 * 計画を生成せず単発Taskを同じ受付世代へ保存する。
 * @responsibility 入力同一性と実Workspace所属を既存Snapshotで確定する。
 * @trace ARCH-000004
 * @input 現在Root、binding、受付世代、単発Queue。
 * @returns 同一受付又は確定した新品Queue。
 * @precondition 上位で実Projectと主体を認可する。
 * @postcondition 保存確認より前に下位実行を開始しない。
 * @effect 既存state.jsonの更新のみ。
 * @failure 旧世代、別入力、無効Workspaceは停止。
 * @invariant Project計画・架空Milestoneを作らない。
 * @boundary 単発受付と既存Writer。
 * @security 本文・資格を保存しない。
 * @concurrency 既存Snapshot排他だけを使用する。
 */
export function enqueueCoordinatorSingleTask(
  workingDirectory: string,
  binding: string,
  intakeEpoch: string,
  input: ProjectQueueEntry,
): StoreResult<ProjectQueueEntry> {
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current) => {
      if (
        !validQueueEntry(input) ||
        !input.singleTask ||
        input.milestoneId !== null ||
        input.singleTask.phase !== "accepted" ||
        input.state !== "queued" ||
        input.generation !== 1 ||
        input.ownerGeneration !== null ||
        input.resultReference !== null ||
        input.resumeCondition !== null
      )
        return blocked("orchestrator_single_task_input_invalid");
      const existing = current.queueEntries.find(
        (entry) => entry.queueId === input.queueId,
      );
      if (existing) {
        const epoch = current.intakeBindings.find(
          (entry) => entry.queueId === input.queueId,
        )?.epoch;
        const keys = [
          "projectId",
          "milestoneId",
          "requestHash",
          "repositoryRevision",
          "scopeHash",
          "workspaceId",
        ] as const;
        const identityKeys = [
          "principalId",
          "mode",
          "profileId",
          "catalogRevision",
          "taskId",
          "attemptId",
          "operationId",
        ] as const;
        return epoch === intakeEpoch &&
          existing.singleTask &&
          keys.every((key) => existing[key] === input[key]) &&
          identityKeys.every(
            (key) => existing.singleTask?.[key] === input.singleTask?.[key],
          )
          ? completed("orchestrator_single_task_reused", {
              next: null,
              value: existing,
            })
          : blocked("orchestrator_queue_identity_conflict");
      }
      if (current.intakeEpoch !== intakeEpoch)
        return blocked("orchestrator_intake_epoch_retired");
      if (
        input.workspaceId != null &&
        (!current.queueEntries.some(
          (entry) =>
            entry.projectId === input.projectId &&
            entry.workspaceId === input.workspaceId,
        ) ||
          !current.workspaces.some(
            (entry) =>
              entry.workspaceId === input.workspaceId &&
              entry.phase === "ready" &&
              entry.holdUntil === null,
          ))
      )
        return blocked("orchestrator_workspace_not_ready");
      return completed("orchestrator_single_task_durable", {
        next: {
          ...current,
          queueEntries: [...current.queueEntries, input],
          intakeBindings: [
            ...current.intakeBindings,
            { queueId: input.queueId, epoch: intakeEpoch },
          ],
        },
        value: input,
      });
    },
  );
}

/**
 * 単発Taskの開始・終端を同じ実行Leaseと世代で保存する。
 * @responsibility 元ID、失敗・回復参照を保持して終端だけを更新する。
 * @trace ARCH-000004
 * @input Root、binding、Queue、期待世代、実Lease、次記録。
 * @returns 更新したQueue又は停止。
 * @precondition 呼出し元は同じTaskをjoinするOwner。
 * @postcondition 未解決cleanupを完了Queueへ変えない。
 * @effect 既存Snapshot更新。履歴は既存搬送へ渡す。
 * @failure 世代・Lease・識別子・遷移不一致で停止。
 * @invariant 本文・回答を保存せず採用を行わない。
 * @boundary 単発実行と既存Writer。
 * @security 保存値から実Leaseを復元しない。
 * @concurrency 既存operation LeaseとSnapshot短期排他。
 */
export function updateCoordinatorSingleTask(
  workingDirectory: string,
  binding: string,
  queueId: string,
  expectedGeneration: number,
  lease: CoordinatorLease,
  raw: unknown,
): StoreResult<ProjectQueueEntry> {
  const record = inspectSingleTaskRecord(raw);
  if (!record) return blocked("orchestrator_single_task_record_invalid");
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current, owner) => {
      const previous = current.queueEntries.find(
        (entry) => entry.queueId === queueId,
      );
      const active = activeLeases.get(lease);
      if (
        !previous?.singleTask ||
        previous.generation !== expectedGeneration ||
        active?.kind !== "project-operation" ||
        active.repositoryRoot !== owner.repositoryRoot ||
        active.repositoryBindingId !== binding ||
        active.projectId !== previous.projectId ||
        active.queueId !== queueId ||
        !activeLeaseIsObserved(active) ||
        (previous.ownerGeneration !== null &&
          previous.ownerGeneration !== active.ownerGeneration)
      )
        return blocked("orchestrator_single_task_owner_mismatch");
      const identityKeys = [
        "principalId",
        "mode",
        "profileId",
        "catalogRevision",
        "taskId",
        "attemptId",
        "operationId",
      ] as const;
      if (
        identityKeys.some((key) => previous.singleTask?.[key] !== record[key])
      )
        return blocked("orchestrator_single_task_identity_conflict");
      if (previous.singleTask.phase === "settled") {
        if (
          previous.singleTask.status !== record.status ||
          previous.singleTask.reason !== record.reason ||
          (previous.singleTask.cleanupConfirmed && !record.cleanupConfirmed) ||
          record.recoveryIds.some(
            (id) => !previous.singleTask?.recoveryIds.includes(id),
          )
        )
          return blocked("orchestrator_single_task_terminal_identity_conflict");
        if (
          encodeCoordinatorStateValue(previous.singleTask) ===
          encodeCoordinatorStateValue(record)
        )
          return completed("orchestrator_single_task_already_saved", {
            next: null,
            value: previous,
          });
      }
      const phases: Record<SingleTaskRecord["phase"], readonly string[]> = {
        accepted: ["starting"],
        starting: ["starting", "running", "settled"],
        running: ["settled"],
        settled: ["settled"],
      };
      if (!phases[previous.singleTask.phase].includes(record.phase))
        return blocked("orchestrator_single_task_transition_invalid");
      const terminal = record.phase === "settled";
      const clean =
        terminal && record.cleanupConfirmed && record.recoveryIds.length === 0;
      const value: ProjectQueueEntry = {
        ...previous,
        singleTask: record,
        generation: previous.generation + 1,
        ownerGeneration: active.ownerGeneration,
        state: !terminal
          ? "running"
          : !clean
            ? "recovery_required"
            : record.status === "cancelled"
              ? "cancelled"
              : "completed",
        resumeCondition: !terminal || clean ? null : "exact_recovery",
        resultReference: clean ? null : previous.resultReference,
      };
      const row = clean
        ? historyRow(
            {
              id: queueId,
              occurredAt: new Date().toISOString(),
              outcome:
                record.status === "completed"
                  ? "completed"
                  : record.status === "cancelled"
                    ? "cancelled"
                    : "failed",
              primaryFailure:
                record.status === "completed"
                  ? null
                  : record.status === "cancelled"
                    ? "cancel"
                    : "execution",
              cleanup: "confirmed",
            },
            Date.now(),
          )
        : null;
      return completed("orchestrator_single_task_saved", {
        next: {
          ...current,
          queueEntries: current.queueEntries.map((entry) =>
            entry.queueId === queueId ? value : entry,
          ),
          historyPending: row
            ? [
                ...current.historyPending.filter((item) => item.id !== queueId),
                row,
              ]
            : current.historyPending,
        },
        value,
      });
    },
  );
}

/**
 * 取得意図すらない単発受付だけを未開始の拒否として閉じる。
 * @responsibility Lease競合拒否と取得結果不明を区別する。
 * @trace ARCH-000004
 * @input Repository、binding、受付ID、期待世代と固定理由。
 * @returns 同じ受付の終端、又は処置しない停止。
 * @precondition Providerと実Leaseの取得を開始していない。
 * @postcondition 取得意図があればcleanupを確定しない。
 * @effect 既存Writerと履歴搬送待ちだけ。
 * @failure 取得意図・段階・世代が異なれば停止する。
 * @invariant 新しいLeaseや回復参照を捏造しない。
 * @boundary 受付Ownerと既存保存。
 * @security 本文を保存しない。
 * @concurrency 既存Snapshotの短期排他で照合する。
 */
export function closeUnstartedCoordinatorSingleTask(
  workingDirectory: string,
  binding: string,
  queueId: string,
  expectedGeneration: number,
  reason: string,
): StoreResult<ProjectQueueEntry> {
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current) => {
      const previous = current.queueEntries.find(
        (entry) => entry.queueId === queueId,
      );
      if (
        !previous?.singleTask ||
        previous.generation !== expectedGeneration ||
        previous.singleTask.phase !== "accepted" ||
        previous.ownerGeneration !== null ||
        current.leaseIntents.some((intent) => intent.queueId === queueId)
      )
        return blocked("orchestrator_single_task_unstarted_unconfirmed");
      const record = inspectSingleTaskRecord({
        ...previous.singleTask,
        phase: "settled",
        status: "blocked",
        reason,
        cleanupConfirmed: true,
      });
      if (!record) return blocked("orchestrator_single_task_record_invalid");
      const value: ProjectQueueEntry = {
        ...previous,
        singleTask: record,
        generation: previous.generation + 1,
        state: "completed",
        resumeCondition: null,
      };
      const row = historyRow(
        {
          id: queueId,
          occurredAt: new Date().toISOString(),
          outcome: "failed",
          primaryFailure: "execution",
          cleanup: "confirmed",
        },
        Date.now(),
      );
      return completed("orchestrator_single_task_not_started", {
        next: {
          ...current,
          queueEntries: current.queueEntries.map((entry) =>
            entry.queueId === queueId ? value : entry,
          ),
          historyPending: row
            ? [...current.historyPending, row]
            : current.historyPending,
        },
        value,
      });
    },
  );
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
export function createCurrentCoordinatorPersistencePorts(
  workingDirectory: string,
  binding: string,
): CoordinatorPersistencePorts {
  const acquired = acquireCoordinatorSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed")
    throw new Error("orchestrator_snapshot_not_initialized");
  const observed = readCoordinatorSnapshotOwned(acquired.value, binding, true);
  if (!acquired.value.release())
    throw new Error("orchestrator_snapshot_lock_release_unconfirmed");
  if (
    observed.status !== "completed" ||
    !observed.value ||
    observed.value.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA
  )
    throw new Error("orchestrator_snapshot_not_initialized");
  return createCoordinatorSnapshotPersistencePorts(
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
export function readCurrentCoordinatorState(
  workingDirectory: string,
  binding: string,
  projectId: string,
): StoreResult<CoordinatorState | null> {
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current) =>
      current.schema === COORDINATOR_PROJECT_SNAPSHOT_SCHEMA &&
      validId(projectId)
        ? completed("orchestrator_state_observed", {
            next: null,
            value:
              current.projects.find((item) => item.projectId === projectId) ??
              null,
          })
        : blocked("orchestrator_snapshot_schema_invalid"),
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
export function createCoordinatorSnapshotPersistencePorts(
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
): CoordinatorPersistencePorts {
  const state = createCoordinatorSnapshotStatePort(
    workingDirectory,
    repositoryBindingId,
    intakeEpoch,
    intake,
  );
  const lease: CoordinatorLeasePort = Object.freeze({
    acquire: (projectId, queueId, kind) =>
      acquireCoordinatorSnapshotLease(
        workingDirectory,
        repositoryBindingId,
        projectId,
        queueId,
        kind,
      ),
    inspectAcquisitionOwner: () =>
      inspectCoordinatorSnapshotLeaseAcquisitionOwner(
        workingDirectory,
        repositoryBindingId,
      ),
    reconcileOperationOwnerLoss: (projectId, queueId, observeOwner) => {
      const result = reconcileCoordinatorSnapshotLeaseOwnerLoss(
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
          "orchestrator_lease_recovery_queue_mismatch",
          result.value.recoveryId !== null,
          result.value.recoveryId,
        );
      return completed(result.reason, queue);
    },
    reconcileAdoptionOwnerLoss: (projectId, observeOwner) => {
      const result = reconcileCoordinatorSnapshotLeaseOwnerLoss(
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
 * 既存操作Leaseに結合したWorkspace現在値を保存する。
 * @responsibility 同対象世代比較、Queue対象結合と終了後整理を一つのSnapshotへ閉じる。
 * @trace ARCH-000004
 * @input 所属Root、Repository結合、実在Project／Queue、Lease世代、期待Workspace世代と次値。
 * @returns 確定した現在値又はblocked。
 * @precondition 呼出し元は既存project-operation Leaseを保持する。
 * @postcondition 同じLease・Queue・対象・世代だけを更新する。
 * @effect 既存state.jsonを原子的保存し読戻す。Gitは実行しない。
 * @failure 対象不一致・使用中・未解決・保存不明は停止。
 * @invariant 新台帳・Lockを追加せず、Taskの現在値を重複保存しない。
 * @boundary Workspace操作と既存Snapshot Writer。
 * @security 状態名だけを削除許可としない。
 * @concurrency 既存短期Snapshot排他だけを保持する。
 */
export function writeCoordinatorWorkspaceRecord(
  workingDirectory: string,
  binding: string,
  projectId: string,
  queueId: string,
  ownerGeneration: string,
  workspaceId: string,
  expectedGeneration: number,
  nextRecord: CoordinatorWorkspace | null,
): StoreResult<CoordinatorWorkspace | null> {
  return withCoordinatorSnapshotOperation(
    workingDirectory,
    binding,
    (current) => {
      const queue = current.queueEntries.find(
        (entry) => entry.queueId === queueId && entry.projectId === projectId,
      );
      const owned = current.leaseIntents.some(
        (intent) =>
          intent.projectId === projectId &&
          intent.queueId === queueId &&
          intent.kind === "project-operation" &&
          intent.phase === "lock_owned" &&
          intent.ownerGeneration === ownerGeneration &&
          intent.ownerProcessId === process.pid,
      );
      if (!queue || !owned)
        return blocked("orchestrator_workspace_lease_mismatch");
      const previous = current.workspaces.find(
        (entry) => entry.workspaceId === workspaceId,
      );
      if ((previous?.generation ?? 0) !== expectedGeneration)
        return blocked("orchestrator_workspace_generation_conflict");
      if (queue.workspaceId != null && queue.workspaceId !== workspaceId)
        return blocked("orchestrator_workspace_target_mismatch");
      if (
        nextRecord &&
        (!validCoordinatorWorkspace(nextRecord) ||
          nextRecord.workspaceId !== workspaceId ||
          nextRecord.generation !== expectedGeneration + 1)
      )
        return blocked("orchestrator_workspace_record_invalid");
      // binding-wide操作Leaseを維持し、既存Task／回復参照から非使用を導く。
      const affectedProjects = new Set(
        current.queueEntries
          .filter((entry) => entry.workspaceId === workspaceId)
          .map((entry) => entry.projectId),
      );
      affectedProjects.add(projectId);
      const singleTaskBusy = current.queueEntries.some(
        (entry) =>
          affectedProjects.has(entry.projectId) &&
          entry.singleTask &&
          (entry.singleTask.phase !== "settled" ||
            !entry.singleTask.cleanupConfirmed ||
            entry.singleTask.recoveryIds.length > 0),
      );
      const busy =
        singleTaskBusy ||
        current.projects
          .filter((entry) => affectedProjects.has(entry.projectId))
          .some((entry) =>
            entry.tasks.some(
              (task) =>
                [
                  "starting",
                  "running",
                  "cleanup_pending",
                  "recovery_required",
                ].includes(task.state) ||
                task.recoveryUnresolved ||
                task.recoveryObligations.some(
                  (obligation) =>
                    !["settled", "acknowledged"].includes(obligation.phase),
                ),
            ),
          );
      if (busy) return blocked("orchestrator_workspace_in_use_or_unresolved");
      if (
        (nextRecord?.phase === "discarding" || nextRecord === null) &&
        current.queueEntries.some(
          (entry) =>
            entry.workspaceId === workspaceId &&
            entry.queueId !== queueId &&
            !["completed", "cancelled"].includes(entry.state),
        )
      )
        return blocked("orchestrator_workspace_other_queue_pending");
      if (
        nextRecord?.phase === "discarding" &&
        previous?.holdUntil !== null &&
        previous?.holdUntil !== undefined
      )
        return blocked("orchestrator_workspace_held");
      if (
        nextRecord === null &&
        (previous?.lastResult?.worktreeRemoved !== true ||
          previous.lastResult.branchRemoved !== true ||
          previous.lastResult.workspaceDirectoryRetained !== false)
      )
        return blocked("orchestrator_workspace_disposal_unconfirmed");
      const workspaces = current.workspaces.filter(
        (entry) => entry.workspaceId !== workspaceId,
      );
      if (nextRecord) workspaces.push(nextRecord);
      return completed("orchestrator_workspace_record_saved", {
        next: {
          ...current,
          workspaces,
          queueEntries: current.queueEntries.map((entry) =>
            entry.queueId === queueId ||
            (nextRecord === null && entry.workspaceId === workspaceId)
              ? {
                  ...entry,
                  workspaceId: nextRecord === null ? null : workspaceId,
                  ...(nextRecord === null &&
                  !["completed", "cancelled"].includes(entry.state)
                    ? { state: "cancelled" as const, resumeCondition: null }
                    : {}),
                  generation: entry.generation + 1,
                }
              : entry,
          ),
          historyPending:
            nextRecord === null
              ? [
                  ...current.historyPending,
                  historyRow(
                    {
                      id: `workspace-${workspaceId}`,
                      occurredAt: new Date().toISOString(),
                      outcome: "cancelled",
                      primaryFailure: previous?.primaryFailure
                        ? "cleanup"
                        : null,
                      cleanup: "confirmed",
                    },
                    Date.now(),
                  ),
                ]
              : current.historyPending,
        },
        value: nextRecord,
      });
    },
  );
}

/**
 * Coordinator Durable Foundationの公開契約を記述する。
 *
 * @responsibility Coordinator Durable Foundationの公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCoordinatorDurableFoundationの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCoordinatorDurableFoundationの入力契約を満たす。
 * @postcondition describeCoordinatorDurableFoundationの責務を完了した結果だけを返す。
 * @effect N/A: describeCoordinatorDurableFoundationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCoordinatorDurableFoundationは独自の失敗分岐を所有しない。
 * @invariant describeCoordinatorDurableFoundationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeCoordinatorDurableFoundationはProcess内の同一Subsystemで完結する。
 * @security describeCoordinatorDurableFoundationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeCoordinatorDurableFoundationは共有非同期状態を持たない同期処理である。
 */
export function describeCoordinatorDurableFoundation() {
  return Object.freeze({
    contract: COORDINATOR_DURABLE_FOUNDATION_CONTRACT,
    recordStrategy:
      "single_current_snapshot_with_pending_atomic_replace_and_exact_readback",
    queueMutation: "short_exclusive_repository_local_lock",
    operationLease:
      "exclusive_lock_with_owner_generation_and_no_stale_takeover",
    adoptionLease: "separate_exclusive_lock_with_no_stale_takeover",
    staleLockDisposition: "blocked_manual_reconciliation_required_before_reuse",
    externalWaitWhileMutationLockHeld: false,
    taskManagementCapabilityComplete: false,
  });
}
