/**
 * execution-environmentに属する責務をまとめる。
 *
 * @responsibility FilesystemIdentityを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */

import {
  parseHostRecoveryToken,
  inspectExecutionSelection,
  snapshotPlainRecord,
  hashExecutionSelection,
  type ExecutionSelection,
} from "../../../domain-model/src/index.ts";

import {
  type WorkspaceInventoryEntry as InventoryEntry,
  inspectWorkspaceInventory as inventory,
  isWorkspaceRelativePath as validRelativePath,
  verifyRepositoryRoot,
  readWorkspaceFileContent as stableFileContent,
  inspectGitRepositoryLayoutCandidate,
  inspectRepositoryIdentityCandidate,
  observeRepositoryRevision,
  gitRepositoryRevisionAdapter,
  inspectRepositoryFormat,
  gitRepositoryFormatAdapter,
  type VerifiedRepositoryRoot,
  resolveVerifiedRepositoryRoot,
  observeRepositoryStorageIdentity,
} from "../../../version-control/src/index.ts";
import { createHash, randomUUID } from "node:crypto";
import {
  containsRecognizedSecretMaterial,
  checkRepositoryRuntimeDataProtectionDirectory,
} from "../../../domain-model/src/index.ts";
import path from "node:path";
import type { Operation } from "./controller.ts";
import { types } from "node:util";
import fs from "node:fs";
import os from "node:os";
import { initializeWindowsHostRecordNamespace } from "../../../platform-access/src/index.ts";
import { loadHostRecoveryRecordByToken } from "./recovery.ts";
import { formatHostRecoveryToken } from "./result.ts";
import {
  acquireRuntimeOwnedHostOperationSupervisorLock,
  acquireRuntimeOwnedHostOperationKernelLock,
} from "./kernel-lock.ts";
import {
  poisonRuntimeProcessAfterCleanupUnknown,
  beginRuntimeProcessEffectDrain,
  endRuntimeProcessEffectDrain,
} from "./process-safety-state.ts";

/**
 * Coordinatorが管理する操作領域の全Pathを定義する。
 * @responsibility 作業・Home・記録と管理領域の所在を上位Ownerに閉じる。
 * @trace ARCH-000008
 * @invariant Executorへは必要な借用Pathだけを別途投影する。
 */
type OperationPaths = Readonly<{
  workspace: string;
  providerHome: string;
  tmp: string;
  events: string;
  projection: string;
  management: string;
}>;

export const REPOSITORY_WORKSPACE_RUNTIME_CONTRACT =
  "crdd-coordinator/repository-workspace-runtime";

export const REPOSITORY_WORKSPACE_RUNTIME_CONTRACT_REVISION = 7;

const MAXIMUM_FILE_BYTES = 64 * 1024 * 1024;

const MAXIMUM_CHANGED_PATHS = 1_000;

const MAXIMUM_ALLOWED_PATHS = 64;

const MAXIMUM_REVIEW_PROJECTION_BYTES = 1024 * 1024;

const MAXIMUM_REVIEW_PROJECTION_FILES = 256;

/**
 * 借用Treeの最終観測を内容なしで投影する。
 * @responsibility 全終端の変更情報を同じ意味で返す。
 * @trace ARCH-000004
 * @input 元Workspace capability又は未確定、検証済み対象。
 * @returns 欠測をnullのまま保持した観測値。
 * @precondition 呼出し元が対象の実行許可を確認済み。
 * @postcondition Treeの現存・成果採用・回収成功を主張しない。
 * @effect Git／Filesystem読取りだけ。
 * @failure 観測不能は変更Path null。
 * @invariant 一次失敗や回復状態を変更しない。
 * @boundary 終了処理から認可済み上位結果。
 * @security 内容・Host Pathを含めない。
 * @concurrency 他の編集との帰属は未確定。
 */
export function projectBorrowedExecutionResult(
  capability: object | undefined,
  target: BorrowedExecutionTarget,
): CoordinatorWorkspaceResult {
  const observedPaths = capability
    ? observeBorrowedExecutionChanges(capability)
    : null;
  const changedPaths =
    observedPaths !== null && observedPaths.length > MAXIMUM_CHANGED_PATHS
      ? null
      : observedPaths;
  return Object.freeze({
    workspaceId: target.workspaceId,
    changedPaths,
    canonicalRepositoryChanged:
      target.executionTree === target.ownerRepositoryRoot
        ? changedPaths === null
          ? null
          : changedPaths.length > 0
        : false,
    changeAttribution: "unattributed",
    workspaceDeletionIssued: false,
  });
}

/**
 * repository-workspace-runtimeで使用するWorkspace 記録の値契約を定義する。
 *
 * @responsibility Workspace 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000013
 * @shape WorkspaceRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant WorkspaceRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: WorkspaceRecordの宣言は外部境界を開かない。
 * @security WorkspaceRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility WorkspaceRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type WorkspaceRecord = Readonly<{
  managementCapability: object;
  mountCapability: object;
  repositoryBindingCapability: object;
  operationId: string;
  baseCommit: string;
  baseTree: string;
  baseManifestHash: string;
  baseEntries: ReadonlyMap<string, InventoryEntry>;
  sourceTree?: string;
}>;

/**
 * repository-workspace-runtimeで使用する候補 記録の値契約を定義する。
 *
 * @responsibility 候補 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000013
 * @shape CandidateRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CandidateRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: CandidateRecordの宣言は外部境界を開かない。
 * @security CandidateRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CandidateRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CandidateRecord = Readonly<{
  workspaceRecord: WorkspaceRecord;
  allowedPathsHash: string;
  contentManifestHash: string;
  patchHash: string;
  changedPaths: readonly string[];
}>;

const workspaces = new WeakMap<object, WorkspaceRecord>();

const candidates = new WeakMap<object, CandidateRecord>();

/**
 * 借用開始時からの変更を内容の複製なしで観測する。
 * @responsibility 既存dirtyと今回区間の差を分離する。
 * @trace ARCH-000004
 * @input 元workspaceCapability。
 * @returns 変更Path集合又は観測不能のnull。
 * @precondition 借用結合済みである。
 * @postcondition AI由来・採用・Commitを主張しない。
 * @effect 借用Treeを読み取るだけ。
 * @failure 失効・走査失敗はnull。
 * @invariant 変更の巻戻し・Tree削除なし。
 * @boundary Task終了後の観測。
 * @security 内容を返さない。
 * @concurrency 同時編集の帰属は判定しない。
 */
export function observeBorrowedExecutionChanges(capability: object) {
  try {
    const record = workspaces.get(capability);
    if (
      !record?.sourceTree ||
      readBorrowedExecutionBinding(record.managementCapability)?.target
        .executionTree !== record.sourceTree
    )
      return null;
    return Object.freeze(
      changedPaths(
        record.baseEntries,
        entryMap(inventory(record.sourceTree, true)),
      ),
    );
  } catch {
    return null;
  }
}

/**
 * manifest Hashを決定する。
 *
 * @responsibility manifest Hashの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000013
 * @input entries: readonly InventoryEntry[]
 * @returns manifestHashの計算結果を返す。
 * @precondition 「entries: readonly InventoryEntry[]」がmanifestHashの入力契約を満たす。
 * @postcondition manifestHashの責務を完了した結果だけを返す。
 * @effect N/A: manifestHashは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: manifestHashは独自の失敗分岐を所有しない。
 * @invariant manifestHashは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: manifestHashはProcess内の同一Subsystemで完結する。
 * @security manifestHashはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: manifestHashは共有非同期状態を持たない同期処理である。
 */
function manifestHash(entries: readonly InventoryEntry[]) {
  const hash = createHash("sha256").update("crdd-workspace-inventory-v1\0");
  for (const entry of entries) {
    hash
      .update(entry.relativePath)
      .update("\0")
      .update(entry.byteLength.toString())
      .update("\0")
      .update(entry.sha256)
      .update("\0");
  }
  return hash.digest("hex");
}

/**
 * entry Mapを決定する。
 *
 * @responsibility entry Mapの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000013
 * @input entries: readonly InventoryEntry[]
 * @returns entryMapの計算結果を返す。
 * @precondition 「entries: readonly InventoryEntry[]」がentryMapの入力契約を満たす。
 * @postcondition entryMapの責務を完了した結果だけを返す。
 * @effect N/A: entryMapは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: entryMapは独自の失敗分岐を所有しない。
 * @invariant entryMapは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: entryMapはProcess内の同一Subsystemで完結する。
 * @security entryMapはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: entryMapは共有非同期状態を持たない同期処理である。
 */
function entryMap(entries: readonly InventoryEntry[]) {
  return new Map(entries.map((entry) => [entry.relativePath, entry]));
}

/**
 * Pathsが許可範囲内か判定する。
 *
 * @responsibility Pathsの許可条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000013
 * @input rawAllowedPaths: unknown
 * @returns allowedPathsの計算結果を返す。
 * @precondition 「rawAllowedPaths: unknown」がallowedPathsの入力契約を満たす。
 * @postcondition allowedPathsの責務を完了した結果だけを返す。
 * @effect N/A: allowedPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure allowedPathsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant allowedPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: allowedPathsはProcess内の同一Subsystemで完結する。
 * @security allowedPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: allowedPathsは共有非同期状態を持たない同期処理である。
 */
function allowedPaths(rawAllowedPaths: unknown) {
  if (
    !Array.isArray(rawAllowedPaths) ||
    rawAllowedPaths.length > MAXIMUM_ALLOWED_PATHS
  )
    return null;
  const normalizedAllowedPaths: string[] = [];
  try {
    const descriptors = Object.getOwnPropertyDescriptors(rawAllowedPaths);
    for (let index = 0; index < rawAllowedPaths.length; index += 1) {
      const descriptor = descriptors[index.toString()];
      if (
        !descriptor ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string"
      )
        return null;
      const isDirectory = descriptor.value.endsWith("/");
      const relativePath = isDirectory
        ? descriptor.value.slice(0, -1)
        : descriptor.value;
      if (!validRelativePath(relativePath)) return null;
      normalizedAllowedPaths.push(
        isDirectory ? `${relativePath}/` : relativePath,
      );
    }
  } catch {
    return null;
  }
  const uniqueAllowedPaths = [...new Set(normalizedAllowedPaths)].sort(
    (left, right) => Buffer.from(left).compare(Buffer.from(right)),
  );
  return uniqueAllowedPaths.length === normalizedAllowedPaths.length &&
    uniqueAllowedPaths.length > 0
    ? Object.freeze(uniqueAllowedPaths)
    : null;
}

/**
 * Allowedかを判定する。
 *
 * @responsibility Allowedの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000013
 * @input relativePath: string、paths: readonly string[]
 * @returns isAllowedの計算結果を返す。
 * @precondition 「relativePath: string、paths: readonly string[]」がisAllowedの入力契約を満たす。
 * @postcondition isAllowedの責務を完了した結果だけを返す。
 * @effect N/A: isAllowedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isAllowedは独自の失敗分岐を所有しない。
 * @invariant isAllowedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isAllowedはProcess内の同一Subsystemで完結する。
 * @security isAllowedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isAllowedは共有非同期状態を持たない同期処理である。
 */
function isAllowed(relativePath: string, paths: readonly string[]) {
  return paths.some((allowedPath) =>
    allowedPath.endsWith("/")
      ? relativePath.startsWith(allowedPath)
      : relativePath === allowedPath,
  );
}

/**
 * changed Pathsを決定する。
 *
 * @responsibility changed Pathsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000013
 * @input baseEntries: ReadonlyMap<string, InventoryEntry>、currentEntries: ReadonlyMap<string, InventoryEntry>
 * @returns changedPathsの計算結果を返す。
 * @precondition 「baseEntries: ReadonlyMap<string, InventoryEntry>、currentEntries: ReadonlyMap<string, InventoryEntry>」がchangedPathsの入力契約を満たす。
 * @postcondition changedPathsの責務を完了した結果だけを返す。
 * @effect N/A: changedPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: changedPathsは独自の失敗分岐を所有しない。
 * @invariant changedPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: changedPathsはProcess内の同一Subsystemで完結する。
 * @security changedPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: changedPathsは共有非同期状態を持たない同期処理である。
 */
function changedPaths(
  baseEntries: ReadonlyMap<string, InventoryEntry>,
  currentEntries: ReadonlyMap<string, InventoryEntry>,
) {
  const paths = new Set([...baseEntries.keys(), ...currentEntries.keys()]);
  return [...paths]
    .filter((relativePath) => {
      const before = baseEntries.get(relativePath);
      const after = currentEntries.get(relativePath);
      return (
        !before ||
        !after ||
        before.byteLength !== after.byteLength ||
        before.sha256 !== after.sha256
      );
    })
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
}

/**
 * Runtime 所有 Repository WorkspaceをFilesystem上の候補として具体化する。
 *
 * @responsibility Runtime 所有 Repository Workspaceの入力Snapshot、書込み範囲、部分生成の失敗境界を所有する。
 * @trace ARCH-000013
 * @input repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawReadPaths: unknown
 * @returns bindRuntimeOwnedExecutionSnapshotの計算結果を返す。
 * @precondition 「repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawReadPaths: unknown」がbindRuntimeOwnedExecutionSnapshotの入力契約を満たす。
 * @postcondition bindRuntimeOwnedExecutionSnapshotの責務を完了した結果だけを返す。
 * @effect 借用Tree・Git・Inventoryを読取り、既存Operation内の空マスクを準備し、開始時Snapshotを私有WeakMapへ登録する。
 * @failure bindRuntimeOwnedExecutionSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant bindRuntimeOwnedExecutionSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: bindRuntimeOwnedExecutionSnapshotはProcess内の同一Subsystemで完結する。
 * @security bindRuntimeOwnedExecutionSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: bindRuntimeOwnedExecutionSnapshotは共有非同期状態を持たない同期処理である。
 */
export function bindRuntimeOwnedExecutionSnapshot(
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
  rawReadPaths?: unknown,
  borrowedTarget?: unknown,
) {
  try {
    if (
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object" ||
      !mountCapability ||
      typeof mountCapability !== "object"
    ) {
      return null;
    }
    const source = borrowRuntimeOwnedRepositorySource(
      repositoryBindingCapability,
      managementCapability,
    );
    const binding = verifyOwnedOperationManagementMountBinding(
      managementCapability,
      mountCapability,
    );
    if (!source || source.operationId !== binding.operationId) return null;
    const readPaths =
      rawReadPaths === undefined ? null : allowedPaths(rawReadPaths);
    if (rawReadPaths !== undefined && !readPaths) return null;
    const verified = verifyRepositoryRoot(source.repositoryRoot);
    if (verified.status !== "completed") return null;
    if (borrowedTarget !== undefined) {
      const target = bindBorrowedExecutionTarget(
        managementCapability,
        mountCapability,
        source.repositoryRoot,
        borrowedTarget,
      );
      if (!target) return null;
      const baseInventory = inventory(target.executionTree, true);
      const baseManifestHash = manifestHash(baseInventory);
      const workspaceCapability = Object.freeze({});
      workspaces.set(
        workspaceCapability,
        Object.freeze({
          managementCapability,
          mountCapability,
          repositoryBindingCapability,
          operationId: binding.operationId,
          baseCommit: source.revision,
          baseTree: baseManifestHash,
          baseManifestHash,
          baseEntries: entryMap(baseInventory),
          sourceTree: target.executionTree,
        }),
      );
      return Object.freeze({
        status: "materialized" as const,
        borrowed: true,
        workspaceCapability,
        baseCommit: source.revision,
        baseTree: baseManifestHash,
        baseManifestHash,
        fileCount: baseInventory.length,
        readProjectionHash: null,
        pathReported: false,
      });
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * current Workspace 記録を決定する。
 *
 * @responsibility current Workspace 記録の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000013
 * @input workspaceCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown
 * @returns currentWorkspaceRecordの計算結果を返す。
 * @precondition 「workspaceCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown」がcurrentWorkspaceRecordの入力契約を満たす。
 * @postcondition currentWorkspaceRecordの責務を完了した結果だけを返す。
 * @effect N/A: currentWorkspaceRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: currentWorkspaceRecordは独自の失敗分岐を所有しない。
 * @invariant currentWorkspaceRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: currentWorkspaceRecordはProcess内の同一Subsystemで完結する。
 * @security currentWorkspaceRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: currentWorkspaceRecordは共有非同期状態を持たない同期処理である。
 */
function currentWorkspaceRecord(
  workspaceCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
) {
  if (
    !workspaceCapability ||
    typeof workspaceCapability !== "object" ||
    !repositoryBindingCapability ||
    typeof repositoryBindingCapability !== "object" ||
    !managementCapability ||
    typeof managementCapability !== "object" ||
    !mountCapability ||
    typeof mountCapability !== "object"
  ) {
    return null;
  }
  const workspaceRecord = workspaces.get(workspaceCapability);
  if (
    !workspaceRecord ||
    workspaceRecord.managementCapability !== managementCapability ||
    workspaceRecord.mountCapability !== mountCapability ||
    workspaceRecord.repositoryBindingCapability !== repositoryBindingCapability
  ) {
    return null;
  }
  const repository = verifyRuntimeOwnedRepositoryBindingCapability(
    repositoryBindingCapability,
    managementCapability,
  );
  const binding = verifyOwnedOperationManagementMountBinding(
    managementCapability,
    mountCapability,
  );
  const borrowed = workspaceRecord.sourceTree
    ? readBorrowedExecutionBinding(managementCapability)
    : null;
  if (
    workspaceRecord.sourceTree &&
    borrowed?.target.executionTree !== workspaceRecord.sourceTree
  )
    return null;
  return repository?.revision === workspaceRecord.baseCommit &&
    binding.operationId === workspaceRecord.operationId
    ? Object.freeze({
        workspaceRecord,
        workspace: workspaceRecord.sourceTree ?? binding.mounts.workspace,
      })
    : null;
}

/**
 * Runtime 所有 候補 Revisionを固定Snapshotとして取得する。
 *
 * @responsibility Runtime 所有 候補 Revisionの観測範囲、Snapshot Identity、変更検出境界を所有する。
 * @trace ARCH-000013
 * @input workspaceCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawAllowedPaths: unknown
 * @returns captureExecutionChangeSnapshotの計算結果を返す。
 * @precondition 「workspaceCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawAllowedPaths: unknown」がcaptureExecutionChangeSnapshotの入力契約を満たす。
 * @postcondition captureExecutionChangeSnapshotの責務を完了した結果だけを返す。
 * @effect 現在Treeを読取り、変更Hashと範囲を私有WeakMapへ登録する。Commit・採用・Tree書込みは行わない。
 * @failure captureExecutionChangeSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant captureExecutionChangeSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: captureExecutionChangeSnapshotはProcess内の同一Subsystemで完結する。
 * @security captureExecutionChangeSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: captureExecutionChangeSnapshotは共有非同期状態を持たない同期処理である。
 */
export function captureExecutionChangeSnapshot(
  workspaceCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
  rawAllowedPaths: unknown,
) {
  try {
    const current = currentWorkspaceRecord(
      workspaceCapability,
      repositoryBindingCapability,
      managementCapability,
      mountCapability,
    );
    const normalizedAllowedPaths = allowedPaths(rawAllowedPaths);
    if (!current || !normalizedAllowedPaths) return null;
    const currentInventory = inventory(
      current.workspace,
      Boolean(current.workspaceRecord.sourceTree),
    );
    const currentEntries = entryMap(currentInventory);
    const changes = changedPaths(
      current.workspaceRecord.baseEntries,
      currentEntries,
    );
    if (
      changes.length > MAXIMUM_CHANGED_PATHS ||
      (!current.workspaceRecord.sourceTree &&
        changes.some(
          (relativePath) => !isAllowed(relativePath, normalizedAllowedPaths),
        ))
    ) {
      return null;
    }
    for (const relativePath of current.workspaceRecord.sourceTree
      ? []
      : changes) {
      const inventoryEntry = currentEntries.get(relativePath);
      if (!inventoryEntry) {
        if (containsRecognizedSecretMaterial(relativePath, "")) {
          return Object.freeze({
            status: "blocked" as const,
            reason: "candidate_recognized_secret_rejected" as const,
            pathReported: false,
            canonicalRepositoryChanged: false,
          });
        }
        continue;
      }
      const observed = stableFileContent(
        path.join(current.workspace, ...relativePath.split("/")),
        MAXIMUM_FILE_BYTES,
      );
      if (
        observed.byteLength !== inventoryEntry.byteLength ||
        observed.sha256 !== inventoryEntry.sha256
      ) {
        return null;
      }
      if (containsRecognizedSecretMaterial(relativePath, observed.content)) {
        return Object.freeze({
          status: "blocked" as const,
          reason: "candidate_recognized_secret_rejected" as const,
          pathReported: false,
          canonicalRepositoryChanged: false,
        });
      }
    }
    const contentManifestHash = manifestHash(currentInventory);
    const allowedPathsHash = createHash("sha256")
      .update("crdd-allowed-paths-v1\0")
      .update(normalizedAllowedPaths.join("\0"))
      .digest("hex");
    const patchHash = createHash("sha256")
      .update("crdd-candidate-revision-v1\0")
      .update(current.workspaceRecord.baseCommit)
      .update("\0")
      .update(current.workspaceRecord.baseTree)
      .update("\0")
      .update(current.workspaceRecord.baseManifestHash)
      .update("\0")
      .update(contentManifestHash)
      .update("\0")
      .update(allowedPathsHash)
      .update("\0")
      .update(changes.join("\0"))
      .digest("hex");
    const candidateCapability = Object.freeze({});
    const record = Object.freeze({
      workspaceRecord: current.workspaceRecord,
      allowedPathsHash,
      contentManifestHash,
      patchHash,
      changedPaths: Object.freeze(changes),
    });
    candidates.set(candidateCapability, record);
    return Object.freeze({
      status: "candidate" as const,
      operationId: current.workspaceRecord.operationId,
      baseCommit: current.workspaceRecord.baseCommit,
      baseTree: current.workspaceRecord.baseTree,
      patchHash,
      contentManifestHash,
      allowedPathsHash,
      changedPaths: record.changedPaths,
      ...(current.workspaceRecord.sourceTree
        ? {
            unexpectedPaths: Object.freeze(
              changes.filter(
                (relativePath) =>
                  !isAllowed(relativePath, normalizedAllowedPaths),
              ),
            ),
          }
        : {}),
      candidateCapability,
      pathReported: false,
      canonicalRepositoryChanged: false,
    });
  } catch {
    return null;
  }
}

/**
 * Runtime 所有 候補 Read Contentを公開結果へ投影する。
 *
 * @responsibility Runtime 所有 候補 Read Contentの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000013
 * @input workspaceCapability: unknown、candidateCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawReadPaths: unknown
 * @returns projectReviewerReadContentの計算結果を返す。
 * @precondition 「workspaceCapability: unknown、candidateCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawReadPaths: unknown」がprojectReviewerReadContentの入力契約を満たす。
 * @postcondition projectReviewerReadContentの責務を完了した結果だけを返す。
 * @effect N/A: projectReviewerReadContentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure projectReviewerReadContentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant projectReviewerReadContentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectReviewerReadContentはProcess内の同一Subsystemで完結する。
 * @security projectReviewerReadContentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectReviewerReadContentは共有非同期状態を持たない同期処理である。
 */
export function projectReviewerReadContent(
  workspaceCapability: unknown,
  candidateCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
  rawReadPaths: unknown,
) {
  try {
    if (!candidateCapability || typeof candidateCapability !== "object")
      return null;
    const current = currentWorkspaceRecord(
      workspaceCapability,
      repositoryBindingCapability,
      managementCapability,
      mountCapability,
    );
    const candidate = candidates.get(candidateCapability);
    const readPaths = allowedPaths(rawReadPaths);
    if (!current || !candidate || !readPaths) return null;
    if (candidate.workspaceRecord !== current.workspaceRecord) return null;

    const currentInventory = inventory(
      current.workspace,
      Boolean(current.workspaceRecord.sourceTree),
    );
    if (manifestHash(currentInventory) !== candidate.contentManifestHash)
      return Object.freeze({
        status: "blocked" as const,
        reason: "candidate_read_projection_identity_mismatch" as const,
      });

    const selectedEntries = currentInventory.filter((entry) =>
      isAllowed(entry.relativePath, readPaths),
    );
    if (selectedEntries.length > MAXIMUM_REVIEW_PROJECTION_FILES)
      return Object.freeze({
        status: "blocked" as const,
        reason: "candidate_read_projection_budget_exceeded" as const,
      });

    let totalBytes = 0;
    const files: Readonly<Record<string, unknown>>[] = [];
    for (const entry of selectedEntries) {
      totalBytes += entry.byteLength;
      if (totalBytes > MAXIMUM_REVIEW_PROJECTION_BYTES)
        return Object.freeze({
          status: "blocked" as const,
          reason: "candidate_read_projection_budget_exceeded" as const,
        });
      const observed = stableFileContent(
        path.join(current.workspace, ...entry.relativePath.split("/")),
        MAXIMUM_REVIEW_PROJECTION_BYTES,
      );
      if (
        observed.byteLength !== entry.byteLength ||
        observed.sha256 !== entry.sha256
      ) {
        return Object.freeze({
          status: "blocked" as const,
          reason: "candidate_read_projection_identity_mismatch" as const,
        });
      }
      const content = new TextDecoder("utf-8", { fatal: true }).decode(
        observed.content,
      );
      if (containsRecognizedSecretMaterial(entry.relativePath, content))
        return Object.freeze({
          status: "blocked" as const,
          reason:
            "candidate_read_projection_recognized_secret_rejected" as const,
        });
      files.push(
        Object.freeze({
          path: entry.relativePath,
          state: "present",
          byteLength: entry.byteLength,
          sha256: entry.sha256,
          encoding: "utf-8",
          content,
        }),
      );
    }
    for (const readPath of readPaths) {
      if (
        !readPath.endsWith("/") &&
        !selectedEntries.some((entry) => entry.relativePath === readPath)
      ) {
        files.push(Object.freeze({ path: readPath, state: "absent" }));
      }
    }
    files.sort((left, right) =>
      Buffer.from(String(left.path)).compare(Buffer.from(String(right.path))),
    );
    const projectionHash = createHash("sha256")
      .update("crdd-candidate-read-projection-v1\0")
      .update(candidate.patchHash)
      .update("\0")
      .update(JSON.stringify(files))
      .digest("hex");
    return Object.freeze({
      status: "projected" as const,
      candidatePatchHash: candidate.patchHash,
      candidateContentManifestHash: candidate.contentManifestHash,
      projectionHash,
      totalBytes,
      files: Object.freeze(files),
    });
  } catch {
    return null;
  }
}

/**
 * Runtime 所有 候補 Revisionを検証する。
 *
 * @responsibility Runtime 所有 候補 Revisionの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000013
 * @input candidateCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown
 * @returns verifyExecutionChangeSnapshotの計算結果を返す。
 * @precondition 「candidateCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown」がverifyExecutionChangeSnapshotの入力契約を満たす。
 * @postcondition verifyExecutionChangeSnapshotの責務を完了した結果だけを返す。
 * @effect Operation・Repository結合と現在Treeを再読取りし、既存Snapshotと照合する。保存・Git変更は行わない。
 * @failure verifyExecutionChangeSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyExecutionChangeSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyExecutionChangeSnapshotはProcess内の同一Subsystemで完結する。
 * @security verifyExecutionChangeSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyExecutionChangeSnapshotは共有非同期状態を持たない同期処理である。
 */
export function verifyExecutionChangeSnapshot(
  candidateCapability: unknown,
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
  mountCapability: unknown,
) {
  try {
    if (!candidateCapability || typeof candidateCapability !== "object")
      return null;
    const record = candidates.get(candidateCapability);
    if (
      !record ||
      record.workspaceRecord.repositoryBindingCapability !==
        repositoryBindingCapability ||
      record.workspaceRecord.managementCapability !== managementCapability ||
      record.workspaceRecord.mountCapability !== mountCapability ||
      !verifyRuntimeOwnedRepositoryBindingCapability(
        repositoryBindingCapability,
        managementCapability,
      )
    ) {
      return null;
    }
    const binding = verifyOwnedOperationManagementMountBinding(
      managementCapability,
      mountCapability,
    );
    if (
      record.workspaceRecord.sourceTree &&
      readBorrowedExecutionBinding(managementCapability as object)?.target
        .executionTree !== record.workspaceRecord.sourceTree
    )
      return null;
    const currentInventory = inventory(
      record.workspaceRecord.sourceTree ?? binding.mounts.workspace,
      Boolean(record.workspaceRecord.sourceTree),
    );
    if (manifestHash(currentInventory) !== record.contentManifestHash)
      return null;
    return Object.freeze({
      status: "verified" as const,
      operationId: record.workspaceRecord.operationId,
      baseCommit: record.workspaceRecord.baseCommit,
      baseTree: record.workspaceRecord.baseTree,
      patchHash: record.patchHash,
      contentManifestHash: record.contentManifestHash,
      allowedPathsHash: record.allowedPathsHash,
      changedPaths: record.changedPaths,
      pathReported: false,
      canonicalRepositoryChanged: false,
    });
  } catch {
    return null;
  }
}

/**
 * Repository Workspace Runtime 契約の公開契約を記述する。
 *
 * @responsibility Repository Workspace Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000013
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeExecutionChangeSnapshotContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeExecutionChangeSnapshotContractの入力契約を満たす。
 * @postcondition describeExecutionChangeSnapshotContractの責務を完了した結果だけを返す。
 * @effect N/A: describeExecutionChangeSnapshotContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeExecutionChangeSnapshotContractは独自の失敗分岐を所有しない。
 * @invariant describeExecutionChangeSnapshotContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeExecutionChangeSnapshotContractはProcess内の同一Subsystemで完結する。
 * @security describeExecutionChangeSnapshotContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeExecutionChangeSnapshotContractは共有非同期状態を持たない同期処理である。
 */
export function describeExecutionChangeSnapshotContract() {
  return Object.freeze({
    contract: REPOSITORY_WORKSPACE_RUNTIME_CONTRACT,
    contractRevision: REPOSITORY_WORKSPACE_RUNTIME_CONTRACT_REVISION,
    source: "caller_resolved_execution_tree_including_existing_dirty_changes",
    providerReadProjection:
      "explicit_file_or_directory_prefix_plus_write_scope",
    reviewerReadProjection:
      "candidate_identity_bound_explicit_utf8_content_maximum_1_mib_without_provider_filesystem_tool",
    reviewerContentProjection:
      "candidate_identity_bound_utf8_content_for_explicit_read_paths_with_secret_and_size_guards",
    recognizedSecretMaterial:
      "rejected_before_reviewer_content_delivery_development_env_may_be_visible_to_executor",
    completeSecretAbsenceVerified: false,
    providerGitMetadataVisible: false,
    workspaceWrite: "caller_resolved_execution_tree",
    allowedPathGuard: "post_execution_scope_observation_not_write_acl",
    candidateRevision: Object.freeze([
      "base_commit",
      "base_tree",
      "patch_hash",
      "content_manifest_hash",
      "allowed_paths_hash",
    ]),
    approvedCandidateTransfer:
      "caller_owned_execution_tree_without_bundle_store",
    canonicalRepositoryWriteAllowed: true,
    pathReported: false,
  });
}

/**
 * coordinator-task-runtimeで使用するProduction Operation 失敗の値契約を定義する。
 *
 * @responsibility Production Operation 失敗のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProductionOperationFailureが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProductionOperationFailureで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProductionOperationFailureの宣言は外部境界を開かない。
 * @security ProductionOperationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProductionOperationFailureの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProductionOperationFailure = Readonly<{
  reason: string;
  hostRecoveryId: string | null;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
}>;

const productionOperationFailures = new WeakMap<
  object,
  ProductionOperationFailure
>();

/**
 * production Operation 失敗を決定する。
 *
 * @responsibility production Operation 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns productionOperationFailureの計算結果を返す。
 * @precondition 「error: unknown」がproductionOperationFailureの入力契約を満たす。
 * @postcondition productionOperationFailureの責務を完了した結果だけを返す。
 * @effect N/A: productionOperationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: productionOperationFailureは独自の失敗分岐を所有しない。
 * @invariant productionOperationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: productionOperationFailureはProcess内の同一Subsystemで完結する。
 * @security productionOperationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: productionOperationFailureは共有非同期状態を持たない同期処理である。
 */
export function productionOperationFailure(error: unknown) {
  return error && typeof error === "object"
    ? (productionOperationFailures.get(error) ?? null)
    : null;
}

/**
 * throw Production Operation 失敗を決定する。
 *
 * @responsibility throw Production Operation 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input details: ProductionOperationFailure
 * @returns neverを返す。
 * @precondition 「details: ProductionOperationFailure」がthrowProductionOperationFailureの入力契約を満たす。
 * @postcondition throwProductionOperationFailureの責務を完了した結果だけを返す。
 * @effect N/A: throwProductionOperationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure throwProductionOperationFailureは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant throwProductionOperationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: throwProductionOperationFailureはProcess内の同一Subsystemで完結する。
 * @security throwProductionOperationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: throwProductionOperationFailureは共有非同期状態を持たない同期処理である。
 */
export function throwProductionOperationFailure(
  details: ProductionOperationFailure,
): never {
  const error = new Error("coordinator_task_operation_creation_failed");
  productionOperationFailures.set(error, Object.freeze(details));
  throw error;
}

/**
 * Production Operation Rootを構築する。
 *
 * @responsibility Production Operation Rootの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input createOperation: () => Operation、poisonAfterCleanupUnknown: () => void
 * @returns createProductionOperationRootの計算結果を返す。
 * @precondition 「createOperation: () => Operation、poisonAfterCleanupUnknown: () => void」がcreateProductionOperationRootの入力契約を満たす。
 * @postcondition createProductionOperationRootの責務を完了した結果だけを返す。
 * @effect N/A: createProductionOperationRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createProductionOperationRootは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createProductionOperationRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createProductionOperationRootはProcess内の同一Subsystemで完結する。
 * @security createProductionOperationRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProductionOperationRootは共有非同期状態を持たない同期処理である。
 */
export function createProductionOperationRoot(
  createOperation: () => Operation,
  poisonAfterCleanupUnknown: () => void,
) {
  try {
    return createOperation();
  } catch (error) {
    const creation =
      classifyOwnedOperationDirectoryCreationFailure(error) ??
      classifyOwnedCoordinatorOperationCreationFailure(error);
    if (!creation) throw error;
    if (!creation.cleanupConfirmed) poisonAfterCleanupUnknown();
    throwProductionOperationFailure(
      Object.freeze({
        reason: creation.cleanupConfirmed
          ? "coordinator_task_operation_initialization_failed_cleanup_confirmed"
          : "coordinator_task_operation_initialization_cleanup_unknown_process_restart_required",
        hostRecoveryId: creation.hostRecoveryId,
        cleanupConfirmed: creation.cleanupConfirmed,
        manualRecoveryRequired: creation.manualRecoveryRequired,
      }),
    );
  }
}

/**
 * Test-only seam for the exact production operation-root failure wrapper.
 *
 * @responsibility Isolated Coordinator Task Operation Creation 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input createOperation: () => Operation
 * @returns createIsolatedCoordinatorTaskOperationCreationCandidateの計算結果を返す。
 * @precondition 「createOperation: () => Operation」がcreateIsolatedCoordinatorTaskOperationCreationCandidateの入力契約を満たす。
 * @postcondition createIsolatedCoordinatorTaskOperationCreationCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedCoordinatorTaskOperationCreationCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedCoordinatorTaskOperationCreationCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedCoordinatorTaskOperationCreationCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedCoordinatorTaskOperationCreationCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedCoordinatorTaskOperationCreationCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedCoordinatorTaskOperationCreationCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedCoordinatorTaskOperationCreationCandidate(
  createOperation: () => Operation,
) {
  let isPoisoned = false;
  return Object.freeze({
    productionAuthority: false as const,
    create: () =>
      createProductionOperationRoot(createOperation, () => {
        isPoisoned = true;
      }),
    classify: productionOperationFailure,
    isProcessPoisoned: () => isPoisoned,
  });
}

/**
 * 借用先の内部入力を表す。
 * @responsibility 上位が解決した所属Root、実行先、期待改訂を受け取る。
 * @trace ARCH-000004
 * @shape workspaceIdは上位の非Authority相関値。実行先は実PathとGit同一性で検査する。
 * @invariant PathやIDだけでは実行許可にならない。
 * @boundary Coordinatorから単発実行への内部入力。
 * @security 外部SurfaceへHost Pathを返さない。
 * @compatibility 旧複製入口とは明示的に区別する。
 */
export type BorrowedExecutionTarget = Readonly<{
  workspaceId: string | null;
  ownerRepositoryRoot: string;
  executionTree: string;
  baseCommit: string | null;
  head: string | null;
}>;

/**
 * 一つの実行中Operationに限る借用対象を保持する。
 * @responsibility 元Treeの同一性と自己所有の保護Mount材料を結合する。
 * @trace ARCH-000004
 * @shape 対象、Filesystem同一性、二つの空placeholder。
 * @invariant 永続状態と清掃所有集合を追加しない。
 * @boundary Operation内だけ。
 * @security Host Pathは公開しない。
 * @compatibility 新Workspace入口の短命データ。
 */
type BorrowedBinding = Readonly<{
  target: BorrowedExecutionTarget;
  dev: number;
  ino: number;
  protection: Readonly<{ gitSourcePath: string; internalSourcePath: string }>;
}>;

const borrowed = new WeakMap<object, BorrowedBinding>();

const commit = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

/**
 * 実行前の対象を読取りだけで検証する。
 * @responsibility arbitrary Path・不明なGit所属・HEAD差を拒否する。
 * @trace ARCH-000004
 * @input ownerRootと内部対象。
 * @returns 固定した対象又はnull。
 * @precondition 上位が既存の利用調停を保持する。
 * @postcondition dirtyを消さず、Sourceを書き換えない。
 * @effect GitとFilesystemの読取りのみ。
 * @failure 欠測・link・別HEAD・別Rootはnull。
 * @invariant 新しいRegistry・排他・回復を生成しない。
 * @boundary Owner Rootと実行Tree。
 * @security getter・Proxyを評価しない。
 * @concurrency 呼出しの都度freshに検証する。
 */
export function inspectBorrowedExecutionTarget(
  ownerRoot: unknown,
  raw: unknown,
): BorrowedExecutionTarget | null {
  try {
    if (
      typeof ownerRoot !== "string" ||
      !raw ||
      typeof raw !== "object" ||
      types.isProxy(raw) ||
      Array.isArray(raw)
    )
      return null;
    const keys = [
      "workspaceId",
      "ownerRepositoryRoot",
      "executionTree",
      "baseCommit",
      "head",
    ] as const;
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    if (
      Reflect.ownKeys(raw).length !== keys.length ||
      keys.some(
        (key) => !descriptors[key] || !Object.hasOwn(descriptors[key], "value"),
      )
    )
      return null;
    const target = Object.fromEntries(
      keys.map((key) => [key, descriptors[key]?.value]),
    ) as BorrowedExecutionTarget;
    if (
      target.ownerRepositoryRoot !== ownerRoot ||
      typeof target.executionTree !== "string"
    )
      return null;
    const root = verifyRepositoryRoot(ownerRoot);
    const layout = inspectGitRepositoryLayoutCandidate({
      repositoryRoot: ownerRoot,
    });
    if (
      root.status !== "completed" ||
      layout.status !== "candidate" ||
      layout.layout?.kind === "linked_worktree"
    )
      return null;
    // Workspace IDは上位の相関値だけ。配置検索・方式選択には使わない。
    if (
      !(
        target.workspaceId === null || typeof target.workspaceId === "string"
      ) ||
      !(
        target.baseCommit === null ||
        (typeof target.baseCommit === "string" &&
          commit.test(target.baseCommit))
      ) ||
      !(
        target.head === null ||
        (typeof target.head === "string" && commit.test(target.head))
      )
    )
      return null;
    const executionLayout = inspectGitRepositoryLayoutCandidate({
      repositoryRoot: target.executionTree,
    });
    const identity = inspectRepositoryIdentityCandidate(target.executionTree);
    const ownerIdentity = inspectRepositoryIdentityCandidate(ownerRoot);
    if (
      executionLayout.status !== "candidate" ||
      !executionLayout.layout ||
      !layout.layout ||
      !ownerIdentity ||
      identity?.logicalRepositoryIdentity !==
        ownerIdentity.logicalRepositoryIdentity ||
      !identity ||
      (target.head !== null && identity.commit !== target.head) ||
      (target.executionTree !== ownerRoot && target.head === null) ||
      (target.executionTree !== ownerRoot &&
        !target.executionTree.startsWith(ownerRoot + path.sep))
    )
      return null;
    const tree = fs.lstatSync(target.executionTree);
    const git = fs.lstatSync(path.join(target.executionTree, ".git"));
    if (
      !tree.isDirectory() ||
      tree.isSymbolicLink() ||
      fs.realpathSync.native(target.executionTree) !== target.executionTree ||
      git.isSymbolicLink() ||
      !(git.isDirectory() || git.isFile())
    )
      return null;
    const executionRoot = verifyRepositoryRoot(target.executionTree);
    if (
      executionRoot.status !== "completed" ||
      checkRepositoryRuntimeDataProtectionDirectory(
        executionRoot.capability,
        "observe",
      ) === "blocked"
    )
      return null;
    return Object.freeze(target);
  } catch {
    return null;
  }
}

/**
 * 元Operationへ借用対象と自己所有placeholderを短期結合する。
 * @responsibility 清掃先を変更せず、Provider用実行先だけを提供する。
 * @trace ARCH-000004 ARCH-000008
 * @input 正真正の管理・Mount参照と検証対象。
 * @returns 対象又はnull。
 * @precondition 通常Sourceの走査が別途成立する。
 * @postcondition 借用TreeをOperationの所有集合へ登録しない。
 * @effect Operation所有projection内に空placeholderを作る。
 * @failure 不明な対象・既存placeholder・作成失敗は拒否。
 * @invariant Workspaceの作成・削除・Git変更なし。
 * @boundary Host一時物と借用Tree。
 * @security 認証Homeや共有GitをMountしない。
 * @concurrency 既存Operation一件に一対象。
 */
export function bindBorrowedExecutionTarget(
  management: object,
  mount: object,
  ownerRoot: string,
  raw: unknown,
) {
  const target = inspectBorrowedExecutionTarget(ownerRoot, raw);
  if (!target || borrowed.has(management)) return null;
  const binding = verifyOwnedOperationManagementMountBinding(management, mount);
  // 空のMount先だけを初期化する。状態・履歴をこのTreeへ保存しない。
  const executionRoot = verifyRepositoryRoot(target.executionTree);
  if (
    executionRoot.status !== "completed" ||
    checkRepositoryRuntimeDataProtectionDirectory(
      executionRoot.capability,
      "prepare",
    ) !== "ready"
  )
    return null;
  const directory = path.join(binding.mounts.projection, "workspace-masks");
  fs.mkdirSync(directory);
  const gitSourcePath = path.join(directory, "git");
  const internalSourcePath = path.join(directory, "internal");
  if (fs.lstatSync(path.join(target.executionTree, ".git")).isDirectory())
    fs.mkdirSync(gitSourcePath);
  else fs.writeFileSync(gitSourcePath, "", { flag: "wx" });
  fs.mkdirSync(internalSourcePath);
  const metadata = fs.lstatSync(target.executionTree);
  borrowed.set(
    management,
    Object.freeze({
      target,
      dev: metadata.dev,
      ino: metadata.ino,
      protection: Object.freeze({ gitSourcePath, internalSourcePath }),
    }),
  );
  return target;
}

/**
 * Provider使用直前に同じ借用対象を再観測する。
 * @responsibility 旧一時workspaceへ戻らず、元実体とGit相関を確認する。
 * @trace ARCH-000004
 * @input 元管理参照。
 * @returns 未結合はnull、失効は例外、結合済みは内部対象。
 * @precondition 管理参照の生存は呼出し元が別途確認する。
 * @postcondition Pathや新しい実体で古い結合を上書きしない。
 * @effect Filesystem／Git読取り。
 * @failure 失効・観測不能はthrow。
 * @invariant 保存Root・削除集合を変更しない。
 * @boundary CoordinatorからProvider計画。
 * @security 所在は内部だけで使う。
 * @concurrency キャッシュだけで実行へ進まない。
 */
export function readBorrowedExecutionBinding(
  management: object,
  verifyProtection = false,
) {
  const record = borrowed.get(management);
  if (!record) return null;
  const target = inspectBorrowedExecutionTarget(
    record.target.ownerRepositoryRoot,
    record.target,
  );
  const stat = target ? fs.lstatSync(target.executionTree) : null;
  if (!target || stat?.dev !== record.dev || stat.ino !== record.ino)
    throw new Error("coordinator_workspace_target_changed");
  if (verifyProtection) {
    const git = fs.lstatSync(record.protection.gitSourcePath);
    const internal = fs.lstatSync(record.protection.internalSourcePath);
    const targetGit = fs.lstatSync(path.join(target.executionTree, ".git"));
    if (
      git.isSymbolicLink() ||
      internal.isSymbolicLink() ||
      git.isDirectory() !== targetGit.isDirectory() ||
      (git.isDirectory()
        ? fs.readdirSync(record.protection.gitSourcePath).length !== 0
        : !git.isFile() || git.size !== 0) ||
      !internal.isDirectory() ||
      fs.readdirSync(record.protection.internalSourcePath).length !== 0
    )
      throw new Error("coordinator_workspace_protection_changed");
  }
  return record;
}

/**
 * host-generation-loss-transitionで使用するHost Generation Loss Eventの値契約を定義する。
 *
 * @responsibility Host Generation Loss EventのProperty、Identity、状態制約を型境界として所有する。
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
 * reduce Host Generation Loss Transitionを決定する。
 *
 * @responsibility reduce Host Generation Loss Transitionの導出に必要な入力、判定規則、返却結果の境界を所有する。
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

/**
 * coordinator-operation-creation-internalで使用するCreation 失敗の値契約を定義する。
 *
 * @responsibility Creation 失敗のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CreationFailureが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CreationFailureで宣言した値と責務の対応を維持する。
 * @boundary N/A: CreationFailureの宣言は外部境界を開かない。
 * @security CreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CreationFailureの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CreationFailure = Readonly<{
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  hostRecoveryId: string | null;
}>;

const failures = new WeakMap<object, CreationFailure>();

/**
 * coordinator-operation-creation-internalを失敗として終了させる。
 *
 * @responsibility coordinator-operation-creation-internalの失敗条件、診断情報、終了結果境界を所有する。
 * @trace ARCH-000004
 * @input cause: unknown、cleanupConfirmed: boolean、hostRecoveryId: string | null
 * @returns neverを返す。
 * @precondition 「cause: unknown、cleanupConfirmed: boolean、hostRecoveryId: string | null」がfailの入力契約を満たす。
 * @postcondition failの責務を完了した結果だけを返す。
 * @effect N/A: failは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure failは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant failは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: failはProcess内の同一Subsystemで完結する。
 * @security failはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: failは共有非同期状態を持たない同期処理である。
 */
function fail(
  cause: unknown,
  cleanupConfirmed: boolean,
  hostRecoveryId: string | null,
): never {
  const error = new Error("coordinator_operation_creation_failed", { cause });
  failures.set(
    error,
    Object.freeze({
      cleanupConfirmed,
      manualRecoveryRequired: !cleanupConfirmed,
      hostRecoveryId,
    }),
  );
  throw error;
}

/**
 * 所有 Coordinator Operation Creation 失敗を分類する。
 *
 * @responsibility 所有 Coordinator Operation Creation 失敗の分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns classifyOwnedCoordinatorOperationCreationFailureの計算結果を返す。
 * @precondition 「error: unknown」がclassifyOwnedCoordinatorOperationCreationFailureの入力契約を満たす。
 * @postcondition classifyOwnedCoordinatorOperationCreationFailureの責務を完了した結果だけを返す。
 * @effect N/A: classifyOwnedCoordinatorOperationCreationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyOwnedCoordinatorOperationCreationFailureは独自の失敗分岐を所有しない。
 * @invariant classifyOwnedCoordinatorOperationCreationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyOwnedCoordinatorOperationCreationFailureはProcess内の同一Subsystemで完結する。
 * @security classifyOwnedCoordinatorOperationCreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyOwnedCoordinatorOperationCreationFailureは共有非同期状態を持たない同期処理である。
 */
export function classifyOwnedCoordinatorOperationCreationFailure(
  error: unknown,
) {
  if (!error || typeof error !== "object") return null;
  return (
    failures.get(error) ??
    classifyOwnedOperationDirectoryCreationFailure(error) ??
    null
  );
}

/**
 * coordinator-operation-creation-internalで使用するDependenciesの値契約を定義する。
 *
 * @responsibility DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Dependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Dependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: Dependenciesの宣言は外部境界を開かない。
 * @security DependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Dependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Dependencies = Readonly<{
  createDirectories: typeof createOwnedOperationDirectories;
  getHostRecoveryId: typeof getOwnedHostRecoveryId;
  initializeCapabilities: (
    owned: ReturnType<typeof createOwnedOperationDirectories>,
  ) => Readonly<{
    mountCapability: object;
    managementCapability: object;
    operationId: string;
  }>;
  cleanupDirectories: typeof cleanupOwnedOperationDirectories;
}>;

/**
 * Transactionalを構築する。
 *
 * @responsibility Transactionalの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: Dependencies
 * @returns createTransactionalの計算結果を返す。
 * @precondition 「dependencies: Dependencies」がcreateTransactionalの入力契約を満たす。
 * @postcondition createTransactionalの責務を完了した結果だけを返す。
 * @effect 注入された領域作成・Capability初期化を順番に呼ぶ。途中失敗時は作成済み領域の回収を試みる。
 * @failure createTransactionalは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createTransactionalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createTransactionalはProcess内の同一Subsystemで完結する。
 * @security createTransactionalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createTransactionalは共有非同期状態を持たない同期処理である。
 */
function createTransactional(dependencies: Dependencies) {
  const owned = dependencies.createDirectories();
  let hostRecoveryId: string | null = null;
  try {
    hostRecoveryId = dependencies.getHostRecoveryId(owned);
    return Object.freeze({
      owned,
      ...dependencies.initializeCapabilities(owned),
      hostRecoveryId,
    });
  } catch (cause) {
    try {
      dependencies.cleanupDirectories(owned);
    } catch {
      fail(cause, false, hostRecoveryId);
    }
    fail(cause, true, null);
  }
}

/**
 * 通常の作成OwnerでWindows共有管理境界を先に保護検証する。
 *
 * @responsibility Root・marker生成前に固定改訂Native初期化を確認し、未確認の共有Effectを保持する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input N/A: 通常producerと同じOS一時親だけを採用する。
 * @returns 既存の所有Operation Directory。
 * @precondition Task／doctor／Workbenchの通常作成Ownerから呼ぶ。
 * @postcondition Windowsは保護初期化確認後だけRoot／markerを生成する。
 * @effect Windowsの出所照合済みNative観測・固定共有child作成と、既存のOperation作成。
 * @failure 出所・親・初期化不明は清掃未確認・IDなし。下位のrollback分類は維持する。
 * @invariant 共有DirectoryのACL修復・rollback・別親fallbackを行わない。
 * @boundary 通常作成Owner→固定改訂Native→既存Node作成primitive。
 * @security 明示試験親や未照合試験依存を本番入力として受け付けない。
 * @concurrency 同期作成前検査。初期化とRoot生成の間に連続Native handle保持を主張しない。
 */
function createProtectedRuntimeOwnedOperationDirectories() {
  if (process.platform !== "win32") return createOwnedOperationDirectories();
  let parent: string;
  try {
    parent = fs.realpathSync(os.tmpdir());
    const metadata = fs.lstatSync(parent);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      throw new Error("temporary_parent_must_be_real_directory");
  } catch (cause) {
    fail(cause, true, null);
  }
  const initialization = initializeWindowsHostRecordNamespace(parent);
  if (initialization.status !== "initialized") {
    fail(
      new Error("host_recovery_namespace_initialization_failed", {
        cause: initialization,
      }),
      false,
      null,
    );
  }
  return createOwnedOperationDirectories(parent);
}

/**
 * 所有 Host 回復 Idを取得する。
 *
 * @responsibility 所有 Host 回復 Idの参照条件、返却値、未検出結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns stringを返す。
 * @precondition 「owned: unknown」がgetOwnedHostRecoveryIdの入力契約を満たす。
 * @postcondition getOwnedHostRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: getOwnedHostRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure getOwnedHostRecoveryIdは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant getOwnedHostRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: getOwnedHostRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security getOwnedHostRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: getOwnedHostRecoveryIdは共有非同期状態を持たない同期処理である。
 */
export function getOwnedHostRecoveryId(owned: unknown): string {
  const identity = ownedIdentity(owned);
  if (!identity?.hostRecovery?.recordHash)
    throw new Error("owned_operation_directory_identity_required");
  validatePrivateHostRecoveryRecord(identity, "host_only");
  return expectedHostRecoveryToken(identity);
}

/**
 * 所有 Operation Directoriesを清掃する。
 *
 * @responsibility 所有 Operation Directoriesの清掃対象、完了観測、残存時の失敗境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns N/A: cleanupOwnedOperationDirectoriesは戻り値を返さない。
 * @precondition 「owned: unknown」がcleanupOwnedOperationDirectoriesの入力契約を満たす。
 * @postcondition cleanupOwnedOperationDirectoriesの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: cleanupOwnedOperationDirectoriesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure cleanupOwnedOperationDirectoriesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant cleanupOwnedOperationDirectoriesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cleanupOwnedOperationDirectoriesはProcess内の同一Subsystemで完結する。
 * @security cleanupOwnedOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cleanupOwnedOperationDirectoriesは共有非同期状態を持たない同期処理である。
 */
export function cleanupOwnedOperationDirectories(owned: unknown): void {
  const currentIdentity = ownedIdentity(owned);
  if (!isObject(owned) || !currentIdentity)
    throw new Error("owned_operation_directory_identity_required");
  if (
    ownedOperationGeneration(owned, currentIdentity, true).generationLock !==
    null
  )
    throw new Error("owned_operation_async_cleanup_required");
  const identity = removeOwnedOperationRootForCleanup(owned);
  if (
    !revokeOwnedOperationGeneration(identity.root, identity.hostRecovery.nonce)
  )
    throw new Error("owned_operation_generation_release_unconfirmed");
  removeOwnedOperationRecoveryRecord(identity);
}

const productionDependencies: Dependencies = Object.freeze({
  createDirectories: createProtectedRuntimeOwnedOperationDirectories,
  getHostRecoveryId: getOwnedHostRecoveryId,
  initializeCapabilities: (owned) => {
    const contextCapability = createOwnedOperationContextCapability(owned);
    const mountCapability = createOwnedMountCapability(owned);
    const managementCapability = createOwnedOperationManagementCapability(
      contextCapability,
      mountCapability,
    );
    const operation =
      verifyOwnedOperationManagementCapability(managementCapability);
    return Object.freeze({
      mountCapability,
      managementCapability,
      operationId: operation.operationId,
    });
  },
  cleanupDirectories: cleanupOwnedOperationDirectories,
});

/**
 * Runtime 所有 Coordinator Operationを構築する。
 *
 * @responsibility Runtime 所有 Coordinator Operationの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns createRuntimeOwnedCoordinatorOperationの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateRuntimeOwnedCoordinatorOperationの入力契約を満たす。
 * @postcondition createRuntimeOwnedCoordinatorOperationの責務を完了した結果だけを返す。
 * @effect 固定本番依存でHost一時領域を作成し管理Capabilityを初期化する。Windowsでは作成前に既存Native保護境界を検査する。
 * @failure 作成失敗を例外で返し、既知cleanupと不明、取得済み元Host回復参照を私有分類へ保持する。
 * @invariant createRuntimeOwnedCoordinatorOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeOwnedCoordinatorOperationはProcess内の同一Subsystemで完結する。
 * @security createRuntimeOwnedCoordinatorOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createRuntimeOwnedCoordinatorOperationは共有非同期状態を持たない同期処理である。
 */
export function createRuntimeOwnedCoordinatorOperation() {
  return createTransactional(productionDependencies);
}

/**
 * Isolated Coordinator Operation Creation 候補を構築する。
 *
 * @responsibility Isolated Coordinator Operation Creation 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: Dependencies
 * @returns createIsolatedCoordinatorOperationCreationCandidateの計算結果を返す。
 * @precondition 「dependencies: Dependencies」がcreateIsolatedCoordinatorOperationCreationCandidateの入力契約を満たす。
 * @postcondition createIsolatedCoordinatorOperationCreationCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedCoordinatorOperationCreationCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedCoordinatorOperationCreationCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedCoordinatorOperationCreationCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedCoordinatorOperationCreationCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedCoordinatorOperationCreationCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedCoordinatorOperationCreationCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedCoordinatorOperationCreationCandidate(
  dependencies: Dependencies,
) {
  return Object.freeze({
    productionAuthority: false as const,
    create: () => createTransactional(Object.freeze(dependencies)),
  });
}

/**
 * Host 回復 状態を状態遷移させる。
 *
 * @responsibility Host 回復 状態の遷移前提、次状態、無効遷移の拒否境界を所有する。
 * @trace ARCH-000008
 * @input hostRecoveryId: string、expectedState: string、nextState: string、mountCapability: unknown
 * @returns stringを返す。
 * @precondition 「hostRecoveryId: string、expectedState: string、nextState: string、mountCapability: unknown」がtransitionHostRecoveryStateの入力契約を満たす。
 * @postcondition transitionHostRecoveryStateの責務を完了した結果だけを返す。
 * @effect transitionHostRecoveryStateはFilesystemの読取りまたは書込みを実行する。
 * @failure transitionHostRecoveryStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant transitionHostRecoveryStateは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security transitionHostRecoveryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: transitionHostRecoveryStateは共有非同期状態を持たない同期処理である。
 */
export function transitionHostRecoveryState(
  hostRecoveryId: string,
  expectedState: string,
  nextState: string,
  mountCapability: unknown,
  expectedRoot: string | null = null,
): string {
  if (
    expectedState === "host_only" &&
    nextState === "docker_submission_started"
  )
    return transitionOwnedDockerSubmissionState(
      mountCapability,
      hostRecoveryId,
      "begin",
    );
  if (
    expectedState === "docker_submission_started" &&
    nextState === "host_only"
  )
    return transitionOwnedDockerSubmissionState(
      mountCapability,
      hostRecoveryId,
      "cancel",
    );
  if (
    expectedState !== "docker_submission_started" ||
    nextState !== "docker_absent_confirmed"
  )
    throw new Error("host_recovery_state_invalid");
  const root =
    mountCapability === null
      ? expectedRoot
      : path.dirname(verifyOwnedMountCapability(mountCapability).management);
  if (!root || (expectedRoot !== null && expectedRoot !== root))
    throw new Error("host_recovery_root_mismatch");
  const loaded = loadHostRecoveryRecordByToken(hostRecoveryId, root);
  if (loaded.record.state !== expectedState)
    throw new Error("host_recovery_state_invalid");
  const updated = { ...loaded.record, state: nextState };
  const serialized = `${JSON.stringify(updated)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const temporary = `${loaded.marker}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, serialized, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.renameSync(temporary, loaded.marker);
  const updatedToken = formatHostRecoveryToken(
    loaded.parsed.rootName,
    loaded.parsed.nonce,
    recordHash,
  );
  if (mountCapability !== null)
    adoptOwnedHostRecoveryRecordTransition(
      mountCapability,
      hostRecoveryId,
      updatedToken,
    );
  return updatedToken;
}

export const CREDENTIAL_ENV_NAMES = Object.freeze([
  "ANTHROPIC_API_KEY",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CODEX_API_KEY",
  "CODEX_ACCESS_TOKEN",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "GIT_ASKPASS",
  "OPENAI_API_KEY",
  "SSH_AUTH_SOCK",
]);

const WINDOWS_RUNTIME_ENV = Object.freeze([
  "COMSPEC",
  "PATHEXT",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "WINDIR",
]);

const POSIX_RUNTIME_ENV = Object.freeze([
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "SHELL",
]);

const OWNED_PREFIX = "crdd-coordinator-doctor-";

const HOST_RECOVERY_DIRECTORY = "crdd-coordinator-recovery-v1";

/**
 * execution-environmentで使用するFilesystem Identityの値契約を定義する。
 *
 * @responsibility Filesystem IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape FilesystemIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FilesystemIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: FilesystemIdentityの宣言は外部境界を開かない。
 * @security FilesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility FilesystemIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type FilesystemIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;

/**
 * execution-environmentで使用するSerializable Identityの値契約を定義する。
 *
 * @responsibility Serializable IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape SerializableIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SerializableIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: SerializableIdentityの宣言は外部境界を開かない。
 * @security SerializableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SerializableIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SerializableIdentity = Readonly<{
  dev: string;
  ino: string;
  birthtimeNs: string;
}>;

/**
 * execution-environmentで使用するDirectory Snapshotの値契約を定義する。
 *
 * @responsibility Directory SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DirectorySnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DirectorySnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: DirectorySnapshotの宣言は外部境界を開かない。
 * @security DirectorySnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DirectorySnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DirectorySnapshot = Readonly<{
  parent: string;
  root: string;
  name: string;
  filesystem: FilesystemIdentity;
}>;

/**
 * execution-environmentで使用するOperation Directoriesの値契約を定義する。
 *
 * @responsibility Operation DirectoriesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OperationDirectoriesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationDirectoriesで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationDirectoriesの宣言は外部境界を開かない。
 * @security OperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OperationDirectoriesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OperationDirectories = Readonly<{
  root: string;
  providerHome: string;
  workspace: string;
  tmp: string;
  events: string;
  projection: string;
  management: string;
}>;

/**
 * execution-environmentで使用するChild Snapshotsの値契約を定義する。
 *
 * @responsibility Child SnapshotsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ChildSnapshotsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ChildSnapshotsで宣言した値と責務の対応を維持する。
 * @boundary N/A: ChildSnapshotsの宣言は外部境界を開かない。
 * @security ChildSnapshotsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ChildSnapshotsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ChildSnapshots = Readonly<{
  workspace: DirectorySnapshot;
  providerHome: DirectorySnapshot;
  tmp: DirectorySnapshot;
  events: DirectorySnapshot;
  projection: DirectorySnapshot;
  management: DirectorySnapshot;
}>;

/**
 * execution-environmentで使用する回復 状態の値契約を定義する。
 *
 * @responsibility 回復 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RecoveryStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RecoveryStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RecoveryStateの宣言は外部境界を開かない。
 * @security RecoveryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RecoveryStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RecoveryState =
  | "initializing"
  | "host_only"
  | "docker_submission_started"
  | "docker_absent_confirmed";

/**
 * execution-environmentで使用するHost 回復 状態の値契約を定義する。
 *
 * @responsibility Host 回復 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HostRecoveryStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostRecoveryStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostRecoveryStateの宣言は外部境界を開かない。
 * @security HostRecoveryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostRecoveryStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostRecoveryState = Readonly<{
  directory: string;
  directoryIdentity: FilesystemIdentity;
  record: string;
  recordIdentity: FilesystemIdentity | null;
  nonce: string;
  state: RecoveryState;
  recordHash: string | null;
}>;

/**
 * execution-environmentで使用する所有 Identityの値契約を定義する。
 *
 * @responsibility 所有 IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedIdentityの宣言は外部境界を開かない。
 * @security OwnedIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OwnedIdentity = Readonly<{
  operationId: string;
  parent: string;
  root: string;
  prefix: string;
  filesystem: FilesystemIdentity;
  createdAt: string;
  hostRecovery: HostRecoveryState;
  children?: ChildSnapshots;
  mounts?: Readonly<{
    workspace: DirectorySnapshot;
    providerHome: DirectorySnapshot;
    tmp: DirectorySnapshot;
  }>;
}>;

/**
 * execution-environmentで使用する所有 Operation Directoriesの値契約を定義する。
 *
 * @responsibility 所有 Operation DirectoriesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedOperationDirectoriesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedOperationDirectoriesで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedOperationDirectoriesの宣言は外部境界を開かない。
 * @security OwnedOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedOperationDirectoriesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OwnedOperationDirectories = {
  parent: string;
  root: string;
  directories: OperationDirectories | null;
  hostRecoveryId: string | null;
};

/**
 * execution-environmentで使用するHost 記録 Childの値契約を定義する。
 *
 * @responsibility Host 記録 ChildのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HostRecordChildが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostRecordChildで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostRecordChildの宣言は外部境界を開かない。
 * @security HostRecordChildはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostRecordChildの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostRecordChild = SerializableIdentity & Readonly<{ pathName: string }>;

/**
 * execution-environmentで使用するHost 回復 記録の値契約を定義する。
 *
 * @responsibility Host 回復 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HostRecoveryRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostRecoveryRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostRecoveryRecordの宣言は外部境界を開かない。
 * @security HostRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostRecoveryRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostRecoveryRecord = Readonly<{
  schema: "crdd-coordinator-host-recovery/v1";
  state: RecoveryState;
  rootName: string;
  rootIdentity: SerializableIdentity | null;
  childIdentities: Readonly<Record<string, HostRecordChild>>;
  createdAt: string;
}>;

const ownedIdentities = new WeakMap<object, OwnedIdentity>();

/**
 * execution-environmentで使用する所有 Operation Directory Creation 失敗の値契約を定義する。
 *
 * @responsibility 所有 Operation Directory Creation 失敗のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedOperationDirectoryCreationFailureが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedOperationDirectoryCreationFailureで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedOperationDirectoryCreationFailureの宣言は外部境界を開かない。
 * @security OwnedOperationDirectoryCreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedOperationDirectoryCreationFailureの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OwnedOperationDirectoryCreationFailure = Readonly<{
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  hostRecoveryId: string | null;
}>;

const ownedOperationDirectoryCreationFailures = new WeakMap<
  object,
  OwnedOperationDirectoryCreationFailure
>();

/**
 * execution-environmentで使用するHost 回復 Initialization 失敗の値契約を定義する。
 *
 * @responsibility Host 回復 Initialization 失敗のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HostRecoveryInitializationFailureが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostRecoveryInitializationFailureで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostRecoveryInitializationFailureの宣言は外部境界を開かない。
 * @security HostRecoveryInitializationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostRecoveryInitializationFailureの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostRecoveryInitializationFailure = Readonly<{
  cleanupConfirmed: boolean;
  hostRecoveryId: string | null;
}>;

const hostRecoveryInitializationFailures = new WeakMap<
  object,
  HostRecoveryInitializationFailure
>();

/**
 * throw Host 回復 Initialization 失敗を決定する。
 *
 * @responsibility throw Host 回復 Initialization 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input cause: unknown、details: HostRecoveryInitializationFailure
 * @returns neverを返す。
 * @precondition 「cause: unknown、details: HostRecoveryInitializationFailure」がthrowHostRecoveryInitializationFailureの入力契約を満たす。
 * @postcondition throwHostRecoveryInitializationFailureの責務を完了した結果だけを返す。
 * @effect N/A: throwHostRecoveryInitializationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure throwHostRecoveryInitializationFailureは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant throwHostRecoveryInitializationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: throwHostRecoveryInitializationFailureはProcess内の同一Subsystemで完結する。
 * @security throwHostRecoveryInitializationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: throwHostRecoveryInitializationFailureは共有非同期状態を持たない同期処理である。
 */
function throwHostRecoveryInitializationFailure(
  cause: unknown,
  details: HostRecoveryInitializationFailure,
): never {
  const error = new Error("host_recovery_initialization_failed", { cause });
  hostRecoveryInitializationFailures.set(error, Object.freeze(details));
  throw error;
}

/**
 * host 回復 Initialization 失敗を決定する。
 *
 * @responsibility host 回復 Initialization 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns hostRecoveryInitializationFailureの計算結果を返す。
 * @precondition 「error: unknown」がhostRecoveryInitializationFailureの入力契約を満たす。
 * @postcondition hostRecoveryInitializationFailureの責務を完了した結果だけを返す。
 * @effect N/A: hostRecoveryInitializationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hostRecoveryInitializationFailureは独自の失敗分岐を所有しない。
 * @invariant hostRecoveryInitializationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hostRecoveryInitializationFailureはProcess内の同一Subsystemで完結する。
 * @security hostRecoveryInitializationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hostRecoveryInitializationFailureは共有非同期状態を持たない同期処理である。
 */
function hostRecoveryInitializationFailure(error: unknown) {
  return error && typeof error === "object"
    ? (hostRecoveryInitializationFailures.get(error) ?? null)
    : null;
}

/**
 * throw 所有 Operation Directory Creation 失敗を決定する。
 *
 * @responsibility throw 所有 Operation Directory Creation 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input cause: unknown、details: OwnedOperationDirectoryCreationFailure
 * @returns neverを返す。
 * @precondition 「cause: unknown、details: OwnedOperationDirectoryCreationFailure」がthrowOwnedOperationDirectoryCreationFailureの入力契約を満たす。
 * @postcondition throwOwnedOperationDirectoryCreationFailureの責務を完了した結果だけを返す。
 * @effect N/A: throwOwnedOperationDirectoryCreationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure throwOwnedOperationDirectoryCreationFailureは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant throwOwnedOperationDirectoryCreationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: throwOwnedOperationDirectoryCreationFailureはProcess内の同一Subsystemで完結する。
 * @security throwOwnedOperationDirectoryCreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: throwOwnedOperationDirectoryCreationFailureは共有非同期状態を持たない同期処理である。
 */
function throwOwnedOperationDirectoryCreationFailure(
  cause: unknown,
  details: OwnedOperationDirectoryCreationFailure,
): never {
  const error = new Error("owned_operation_directory_creation_failed", {
    cause,
  });
  ownedOperationDirectoryCreationFailures.set(error, Object.freeze(details));
  throw error;
}

/**
 * 所有 Operation Directory Creation 失敗を分類する。
 *
 * @responsibility 所有 Operation Directory Creation 失敗の分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns classifyOwnedOperationDirectoryCreationFailureの計算結果を返す。
 * @precondition 「error: unknown」がclassifyOwnedOperationDirectoryCreationFailureの入力契約を満たす。
 * @postcondition classifyOwnedOperationDirectoryCreationFailureの責務を完了した結果だけを返す。
 * @effect N/A: classifyOwnedOperationDirectoryCreationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyOwnedOperationDirectoryCreationFailureは独自の失敗分岐を所有しない。
 * @invariant classifyOwnedOperationDirectoryCreationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyOwnedOperationDirectoryCreationFailureはProcess内の同一Subsystemで完結する。
 * @security classifyOwnedOperationDirectoryCreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyOwnedOperationDirectoryCreationFailureは共有非同期状態を持たない同期処理である。
 */
export function classifyOwnedOperationDirectoryCreationFailure(error: unknown) {
  return error && typeof error === "object"
    ? (ownedOperationDirectoryCreationFailures.get(error) ?? null)
    : null;
}

/**
 * Isolated 所有 Operation Directory Creation 失敗 候補を構築する。
 *
 * @responsibility Isolated 所有 Operation Directory Creation 失敗 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns createIsolatedOwnedOperationDirectoryCreationFailureCandidateの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateIsolatedOwnedOperationDirectoryCreationFailureCandidateの入力契約を満たす。
 * @postcondition createIsolatedOwnedOperationDirectoryCreationFailureCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedOwnedOperationDirectoryCreationFailureCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedOwnedOperationDirectoryCreationFailureCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedOwnedOperationDirectoryCreationFailureCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedOwnedOperationDirectoryCreationFailureCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedOwnedOperationDirectoryCreationFailureCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedOwnedOperationDirectoryCreationFailureCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedOwnedOperationDirectoryCreationFailureCandidate() {
  return Object.freeze({
    productionAuthority: false as const,
    fail: (details: OwnedOperationDirectoryCreationFailure): never =>
      throwOwnedOperationDirectoryCreationFailure(
        new Error("isolated_owned_operation_directory_creation_failed"),
        Object.freeze(details),
      ),
  });
}

/**
 * execution-environmentで使用するMount Capability Identityの値契約を定義する。
 *
 * @responsibility Mount Capability IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape MountCapabilityIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant MountCapabilityIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: MountCapabilityIdentityの宣言は外部境界を開かない。
 * @security MountCapabilityIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility MountCapabilityIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type MountCapabilityIdentity = Readonly<{
  owned: object;
  children: ChildSnapshots;
}>;

const mountCapabilities = new WeakMap<object, MountCapabilityIdentity>();

/**
 * execution-environmentで使用するOperation Context Identityの値契約を定義する。
 *
 * @responsibility Operation Context IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OperationContextIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationContextIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationContextIdentityの宣言は外部境界を開かない。
 * @security OperationContextIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OperationContextIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OperationContextIdentity = Readonly<{
  owned: object;
  operationId: string;
  createdAt: string;
}>;

/**
 * execution-environmentで使用する所有 Operation Contextの値契約を定義する。
 *
 * @responsibility 所有 Operation ContextのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedOperationContextが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedOperationContextで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedOperationContextの宣言は外部境界を開かない。
 * @security OwnedOperationContextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedOperationContextの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OwnedOperationContext = Readonly<{
  operationId: string;
  createdAt: string;
}>;

const operationContextCapabilities = new WeakMap<
  object,
  OperationContextIdentity
>();

const operationContextAliases = new WeakMap<object, Set<object>>();

/**
 * execution-environmentで使用するOperation Management Identityの値契約を定義する。
 *
 * @responsibility Operation Management IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OperationManagementIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationManagementIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationManagementIdentityの宣言は外部境界を開かない。
 * @security OperationManagementIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OperationManagementIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OperationManagementIdentity = Readonly<{
  owned: object;
  operationId: string;
  createdAt: string;
  executionSelections?: Readonly<
    Partial<
      Record<
        "executor0" | "reviewer0" | "executor1" | "reviewer1" | "advice0",
        Readonly<{
          selectionRecordId: string;
          selection: ExecutionSelection;
          selectionHash: string;
          taskAttempt: 0 | 1;
        }>
      >
    >
  >;
}>;

/**
 * execution-environmentで使用する所有 Operation Management Bindingの値契約を定義する。
 *
 * @responsibility 所有 Operation Management BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedOperationManagementBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedOperationManagementBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedOperationManagementBindingの宣言は外部境界を開かない。
 * @security OwnedOperationManagementBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedOperationManagementBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OwnedOperationManagementBinding = Readonly<{
  operationId: string;
  createdAt: string;
  managementScopeBound: true;
}>;

const operationManagementCapabilities = new WeakMap<
  object,
  OperationManagementIdentity
>();

/**
 * execution-environmentで使用するOperation Generation 状態の値契約を定義する。
 *
 * @responsibility Operation Generation 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OperationGenerationStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OperationGenerationStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: OperationGenerationStateの宣言は外部境界を開かない。
 * @security OperationGenerationStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OperationGenerationStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OperationGenerationState = {
  owned: object;
  root: string;
  nonce: string;
  currentRecordHash: string;
  retired: boolean;
  lossOutcome: "cleanup_confirmed_failure" | "cleanup_unknown" | null;
  generationLock: NonNullable<
    Awaited<
      ReturnType<typeof acquireRuntimeOwnedHostOperationSupervisorLock>
    >["lock"]
  > | null;
};

const operationGenerationsByKey = new Map<string, OperationGenerationState>();

const operationGenerationByRoot = new Map<string, OperationGenerationState>();

/**
 * execution-environmentで使用するHost 清掃 Capability Identityの値契約を定義する。
 *
 * @responsibility Host 清掃 Capability IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HostCleanupCapabilityIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostCleanupCapabilityIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostCleanupCapabilityIdentityの宣言は外部境界を開かない。
 * @security HostCleanupCapabilityIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostCleanupCapabilityIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostCleanupCapabilityIdentity = Readonly<{
  owned: object;
  operationId: string;
  createdAt: string;
  root: string;
  nonce: string;
  recordHash: string;
  subject: object;
}>;

const hostCleanupCapabilities = new WeakMap<
  object,
  HostCleanupCapabilityIdentity
>();

/**
 * Objectかを判定する。
 *
 * @responsibility Objectの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisObjectの入力契約を満たす。
 * @postcondition isObjectの責務を完了した結果だけを返す。
 * @effect N/A: isObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isObjectは独自の失敗分岐を所有しない。
 * @invariant isObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isObjectはProcess内の同一Subsystemで完結する。
 * @security isObjectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isObjectは共有非同期状態を持たない同期処理である。
 */
function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * Operation Idを構築する。
 *
 * @responsibility Operation Idの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns stringを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateOperationIdの入力契約を満たす。
 * @postcondition createOperationIdの責務を完了した結果だけを返す。
 * @effect N/A: createOperationIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createOperationIdは独自の失敗分岐を所有しない。
 * @invariant createOperationIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOperationIdはProcess内の同一Subsystemで完結する。
 * @security createOperationIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOperationIdは共有非同期状態を持たない同期処理である。
 */
function createOperationId(): string {
  const decimal = BigInt(`0x${randomUUID().replaceAll("-", "")}`).toString(10);
  return `OP-${decimal.padStart(6, "0")}`;
}

/**
 * 所有 Operation Context Capabilitiesを失効させる。
 *
 * @responsibility 所有 Operation Context Capabilitiesの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000008
 * @input owned: object
 * @returns N/A: revokeOwnedOperationContextCapabilitiesは戻り値を返さない。
 * @precondition 「owned: object」がrevokeOwnedOperationContextCapabilitiesの入力契約を満たす。
 * @postcondition revokeOwnedOperationContextCapabilitiesの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: revokeOwnedOperationContextCapabilitiesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeOwnedOperationContextCapabilitiesは独自の失敗分岐を所有しない。
 * @invariant revokeOwnedOperationContextCapabilitiesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeOwnedOperationContextCapabilitiesはProcess内の同一Subsystemで完結する。
 * @security revokeOwnedOperationContextCapabilitiesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeOwnedOperationContextCapabilitiesは共有非同期状態を持たない同期処理である。
 */
function revokeOwnedOperationContextCapabilities(owned: object): void {
  const aliases = operationContextAliases.get(owned);
  if (aliases) {
    for (const alias of aliases) {
      operationContextCapabilities.delete(alias);
      mountCapabilities.delete(alias);
      operationManagementCapabilities.delete(alias);
    }
    operationContextAliases.delete(owned);
  }
}

/**
 * 所有 Operation Effect Capabilitiesを失効させる。
 *
 * @responsibility 所有 Operation Effect Capabilitiesの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000008
 * @input owned: object
 * @returns voidを返す。
 * @precondition 「owned: object」がrevokeOwnedOperationEffectCapabilitiesの入力契約を満たす。
 * @postcondition revokeOwnedOperationEffectCapabilitiesの責務を完了した結果だけを返す。
 * @effect N/A: revokeOwnedOperationEffectCapabilitiesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeOwnedOperationEffectCapabilitiesは独自の失敗分岐を所有しない。
 * @invariant revokeOwnedOperationEffectCapabilitiesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeOwnedOperationEffectCapabilitiesはProcess内の同一Subsystemで完結する。
 * @security revokeOwnedOperationEffectCapabilitiesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeOwnedOperationEffectCapabilitiesは共有非同期状態を持たない同期処理である。
 */
function revokeOwnedOperationEffectCapabilities(owned: object): void {
  const aliases = operationContextAliases.get(owned);
  if (!aliases) return;
  for (const alias of aliases) {
    operationContextCapabilities.delete(alias);
    mountCapabilities.delete(alias);
  }
}

/**
 * operation Generation Keyを決定する。
 *
 * @responsibility operation Generation Keyの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input root: string、nonce: string
 * @returns stringを返す。
 * @precondition 「root: string、nonce: string」がoperationGenerationKeyの入力契約を満たす。
 * @postcondition operationGenerationKeyの責務を完了した結果だけを返す。
 * @effect N/A: operationGenerationKeyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: operationGenerationKeyは独自の失敗分岐を所有しない。
 * @invariant operationGenerationKeyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: operationGenerationKeyはProcess内の同一Subsystemで完結する。
 * @security operationGenerationKeyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: operationGenerationKeyは共有非同期状態を持たない同期処理である。
 */
function operationGenerationKey(root: string, nonce: string): string {
  return `${root}\0${nonce}`;
}

/**
 * 所有 Operation Generationを登録する。
 *
 * @responsibility 所有 Operation Generationの登録条件、Identity、一意性境界を所有する。
 * @trace ARCH-000008
 * @input owned: object、identity: OwnedIdentity
 * @returns N/A: registerOwnedOperationGenerationは戻り値を返さない。
 * @precondition 「owned: object、identity: OwnedIdentity」がregisterOwnedOperationGenerationの入力契約を満たす。
 * @postcondition registerOwnedOperationGenerationの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: registerOwnedOperationGenerationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure registerOwnedOperationGenerationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant registerOwnedOperationGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: registerOwnedOperationGenerationはProcess内の同一Subsystemで完結する。
 * @security registerOwnedOperationGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: registerOwnedOperationGenerationは共有非同期状態を持たない同期処理である。
 */
function registerOwnedOperationGeneration(
  owned: object,
  identity: OwnedIdentity,
): void {
  const recordHash = identity.hostRecovery.recordHash;
  if (!recordHash) throw new Error("owned_operation_generation_conflict");
  const key = operationGenerationKey(
    identity.root,
    identity.hostRecovery.nonce,
  );
  if (
    operationGenerationsByKey.has(key) ||
    operationGenerationByRoot.has(identity.root)
  )
    throw new Error("owned_operation_generation_conflict");
  const state: OperationGenerationState = {
    owned,
    root: identity.root,
    nonce: identity.hostRecovery.nonce,
    currentRecordHash: recordHash,
    retired: false,
    lossOutcome: null,
    generationLock: null,
  };
  operationGenerationsByKey.set(key, state);
  operationGenerationByRoot.set(identity.root, state);
}

/**
 * 所有 Operation Generationを失効させる。
 *
 * @responsibility 所有 Operation Generationの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000008
 * @input root: string、nonce: string
 * @returns revokeOwnedOperationGenerationの計算結果を返す。
 * @precondition 「root: string、nonce: string」がrevokeOwnedOperationGenerationの入力契約を満たす。
 * @postcondition revokeOwnedOperationGenerationの責務を完了した結果だけを返す。
 * @effect N/A: revokeOwnedOperationGenerationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: revokeOwnedOperationGenerationは独自の失敗分岐を所有しない。
 * @invariant revokeOwnedOperationGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeOwnedOperationGenerationはProcess内の同一Subsystemで完結する。
 * @security revokeOwnedOperationGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokeOwnedOperationGenerationは共有非同期状態を持たない同期処理である。
 */
function revokeOwnedOperationGeneration(root: string, nonce: string) {
  const key = operationGenerationKey(root, nonce);
  const state = operationGenerationsByKey.get(key);
  if (!state) return true;
  if (state.generationLock) return false;
  revokeOwnedOperationContextCapabilities(state.owned);
  ownedIdentities.delete(state.owned);
  operationGenerationsByKey.delete(key);
  if (operationGenerationByRoot.get(root) === state)
    operationGenerationByRoot.delete(root);
  return true;
}

/**
 * 所有 Operation Generation Asyncを失効させる。
 *
 * @responsibility 所有 Operation Generation Asyncの失効Authority、対象Identity、再利用防止境界を所有する。
 * @trace ARCH-000008
 * @input root: string、nonce: string
 * @returns revokeOwnedOperationGenerationAsyncの計算結果を返す。
 * @precondition 「root: string、nonce: string」がrevokeOwnedOperationGenerationAsyncの入力契約を満たす。
 * @postcondition revokeOwnedOperationGenerationAsyncの責務を完了した結果だけを返す。
 * @effect N/A: revokeOwnedOperationGenerationAsyncは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure revokeOwnedOperationGenerationAsyncは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant revokeOwnedOperationGenerationAsyncは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: revokeOwnedOperationGenerationAsyncはProcess内の同一Subsystemで完結する。
 * @security revokeOwnedOperationGenerationAsyncはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency revokeOwnedOperationGenerationAsyncは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function revokeOwnedOperationGenerationAsync(
  root: string,
  nonce: string,
) {
  const key = operationGenerationKey(root, nonce);
  const state = operationGenerationsByKey.get(key);
  if (!state) return "released" as const;
  revokeOwnedOperationContextCapabilities(state.owned);
  let generationRelease:
    | "released"
    | "cleanup_confirmed_failure"
    | "cleanup_unknown" = "released";
  if (state.generationLock) {
    try {
      generationRelease = await state.generationLock.release();
    } catch {
      generationRelease = "cleanup_unknown";
    }
    if (generationRelease !== "cleanup_unknown") state.generationLock = null;
  }
  if (generationRelease !== "cleanup_unknown") {
    ownedIdentities.delete(state.owned);
    operationGenerationsByKey.delete(key);
    if (operationGenerationByRoot.get(root) === state)
      operationGenerationByRoot.delete(root);
  } else {
    state.retired = true;
    poisonRuntimeProcessAfterCleanupUnknown();
  }
  return generationRelease;
}

/**
 * execution-environmentで使用するHost Operation 回復 Generationの値契約を定義する。
 *
 * @responsibility Host Operation 回復 GenerationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HostOperationRecoveryGenerationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostOperationRecoveryGenerationで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostOperationRecoveryGenerationの宣言は外部境界を開かない。
 * @security HostOperationRecoveryGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostOperationRecoveryGenerationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostOperationRecoveryGeneration = Readonly<{
  root: string;
  nonce: string;
  lock: NonNullable<
    ReturnType<typeof acquireRuntimeOwnedHostOperationKernelLock>
  >;
}>;

const hostOperationRecoveryGenerations = new WeakMap<
  object,
  HostOperationRecoveryGeneration
>();

/**
 * Host Operation 回復 Generationを取得する。
 *
 * @responsibility Host Operation 回復 Generationの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000008
 * @input token: exact参照、expectedRoot: 元Ownerまたは現在操作が固定したRoot。
 * @returns 同Rootの既存世代排他、または確認不能のnull。
 * @precondition 「token: unknown」がacquireHostOperationRecoveryGenerationの入力契約を満たす。
 * @postcondition acquireHostOperationRecoveryGenerationの責務を完了した結果だけを返す。
 * @effect 同Rootのmarker読取りと既存OS排他Workerの取得だけ。
 * @failure acquireHostOperationRecoveryGenerationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant acquireHostOperationRecoveryGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: acquireHostOperationRecoveryGenerationはProcess内の同一Subsystemで完結する。
 * @security acquireHostOperationRecoveryGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: acquireHostOperationRecoveryGenerationは共有非同期状態を持たない同期処理である。
 */
export function acquireHostOperationRecoveryGeneration(
  token: unknown,
  expectedRoot: unknown,
) {
  try {
    const loaded = loadHostRecoveryRecordByToken(token, expectedRoot);
    const root = path.join(loaded.parent, loaded.parsed.rootName);
    return acquireHostOperationRecoveryGenerationByIdentity(
      root,
      loaded.parsed.nonce,
    );
  } catch {
    return null;
  }
}

/**
 * Host Operation 回復 Generation By Identityを取得する。
 *
 * @responsibility Host Operation 回復 Generation By Identityの取得条件、所有権、失敗時の非取得境界を所有する。
 * @trace ARCH-000008
 * @input root: unknown、nonce: unknown
 * @returns acquireHostOperationRecoveryGenerationByIdentityの計算結果を返す。
 * @precondition 「root: unknown、nonce: unknown」がacquireHostOperationRecoveryGenerationByIdentityの入力契約を満たす。
 * @postcondition acquireHostOperationRecoveryGenerationByIdentityの責務を完了した結果だけを返す。
 * @effect acquireHostOperationRecoveryGenerationByIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure acquireHostOperationRecoveryGenerationByIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant acquireHostOperationRecoveryGenerationByIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security acquireHostOperationRecoveryGenerationByIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: acquireHostOperationRecoveryGenerationByIdentityは共有非同期状態を持たない同期処理である。
 */
export function acquireHostOperationRecoveryGenerationByIdentity(
  root: unknown,
  nonce: unknown,
) {
  try {
    if (
      typeof root !== "string" ||
      !path.isAbsolute(root) ||
      path.dirname(root) !== fs.realpathSync(path.dirname(root)) ||
      typeof nonce !== "string"
    )
      return null;
    const lock = acquireRuntimeOwnedHostOperationKernelLock(
      path.basename(root),
      nonce,
    );
    if (!lock) return null;
    const capability = Object.freeze({});
    hostOperationRecoveryGenerations.set(
      capability,
      Object.freeze({ root, nonce, lock }),
    );
    return capability;
  } catch {
    return null;
  }
}

/**
 * Host Operation 回復 Generationを解放する。
 *
 * @responsibility Host Operation 回復 Generationの所有権、解放条件、終了後不存在の確認境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns releaseHostOperationRecoveryGenerationの計算結果を返す。
 * @precondition 「capability: unknown」がreleaseHostOperationRecoveryGenerationの入力契約を満たす。
 * @postcondition releaseHostOperationRecoveryGenerationの責務を完了した結果だけを返す。
 * @effect N/A: releaseHostOperationRecoveryGenerationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure releaseHostOperationRecoveryGenerationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant releaseHostOperationRecoveryGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: releaseHostOperationRecoveryGenerationはProcess内の同一Subsystemで完結する。
 * @security releaseHostOperationRecoveryGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: releaseHostOperationRecoveryGenerationは共有非同期状態を持たない同期処理である。
 */
export function releaseHostOperationRecoveryGeneration(capability: unknown) {
  if (!isObject(capability)) return false;
  const generation = hostOperationRecoveryGenerations.get(capability);
  if (!generation) return false;
  hostOperationRecoveryGenerations.delete(capability);
  try {
    return generation.lock.release();
  } catch {
    return false;
  }
}

/**
 * Host Operation 回復 Generationを検証する。
 *
 * @responsibility Host Operation 回復 Generationの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown、root: string、nonce: string
 * @returns N/A: verifyHostOperationRecoveryGenerationは戻り値を返さない。
 * @precondition 「capability: unknown、root: string、nonce: string」がverifyHostOperationRecoveryGenerationの入力契約を満たす。
 * @postcondition verifyHostOperationRecoveryGenerationの責務を完了して呼出し元へ制御を戻す。
 * @effect 私有世代Mapと既存Lockの生存観測だけ。新しい排他や処置を発行しない。
 * @failure Map／Root／nonce差、Lock失効・観測例外は処置前に例外で停止する。
 * @invariant verifyHostOperationRecoveryGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary package内部のHost世代と保持中OS排他の観測。公開Root入口へ出さない。
 * @security verifyHostOperationRecoveryGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency 取得時だけでなく各保存／処置直前に同じ世代の保持を確認する。
 */
export function verifyHostOperationRecoveryGeneration(
  capability: unknown,
  root: string,
  nonce: string,
) {
  const generation = isObject(capability)
    ? (hostOperationRecoveryGenerations.get(capability) ?? null)
    : null;
  if (
    !generation ||
    generation.root !== root ||
    generation.nonce !== nonce ||
    generation.lock.assertLive() !== true
  )
    throw new Error("host_recovery_generation_active");
}

/**
 * genuine回復世代が保持する管理領域だけを短命に借用する。
 * @responsibility marker・Root・記録済み子実体を同世代へ結合し、生managementを復元しない。
 * @trace ARCH-000008
 * @input token: exact Host参照。capability: 取得済みHost回復世代。
 * @returns 管理Directoryと同期再確認、またはnull。
 * @precondition Docker要求を開始した元世代が失効し、回復排他を保持している。
 * @postcondition Rootや子を作成・変更せず、借用値だけで処置Authorityを発行しない。
 * @effect 同じmarker、Rootとmanagement実体の読取りだけ。
 * @failure 別世代、state差、欠測、link、canonical差と実体差はnull／false。
 * @invariant 任意Path・旧management Capability・別親探索を受理しない。
 * @boundary Host世代の保持とDocker用短命設定の借用所在。
 * @security 返却はPackage内部だけ。Root barrelへ公開しない。
 * @concurrency 使用直前ごとに同じtoken・排他・Root／子実体を再確認する。
 */
export function borrowHostRecoveryManagementDirectory(
  token: unknown,
  capability: unknown,
) {
  const generation = isObject(capability)
    ? hostOperationRecoveryGenerations.get(capability)
    : null;
  if (!generation) return null;
  const root = generation.root;
  const nonce = generation.nonce;
  const directory = path.join(root, "management");
  /**
   * 借用中の同じHost管理領域を現在観測で照合する。
   * @responsibility 保持排他・marker・Root・子Directoryの共同現在性を判定する。
   * @trace ARCH-000008
   * @input N/A: 元token、世代と固定子所在をclosureに保持する。
   * @returns 全条件が現在成立する場合だけtrue。
   * @precondition genuine世代から作った借用closureである。
   * @postcondition 不明をPath存在や処置許可へ変換しない。
   * @effect 固定所在とmarkerの読取りだけ。
   * @failure 欠測、差替え、例外または失効はfalse。
   * @invariant 更新済みtokenを黙って採用せず別子を探索しない。
   * @boundary 同じHost世代から固定management実体の再観測。
   * @security 記録のpathNameだけから任意所在を借用しない。
   * @concurrency 各下位要求・設定作成直前に同期実行する。
   */
  function assertCurrent() {
    try {
      verifyHostOperationRecoveryGeneration(capability, root, nonce);
      const loaded = loadHostRecoveryRecord(token, root);
      const child = loaded.record.childIdentities.management;
      if (
        loaded.parsed.nonce !== nonce ||
        loaded.record.state !== "docker_submission_started" ||
        !loaded.record.rootIdentity ||
        child?.pathName !== "management" ||
        path.dirname(directory) !== root ||
        fs.realpathSync(root) !== root ||
        fs.realpathSync(directory) !== directory ||
        fs.lstatSync(root).isSymbolicLink() ||
        fs.lstatSync(directory).isSymbolicLink() ||
        !identityMatchesRecord(root, loaded.record.rootIdentity) ||
        !identityMatchesRecord(directory, child)
      )
        return false;
      verifyHostOperationRecoveryGeneration(capability, root, nonce);
      return true;
    } catch {
      return false;
    }
  }
  return assertCurrent() ? Object.freeze({ directory, assertCurrent }) : null;
}

/**
 * retire 所有 Operation Generationを決定する。
 *
 * @responsibility retire 所有 Operation Generationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input root: string、nonce: string
 * @returns voidを返す。
 * @precondition 「root: string、nonce: string」がretireOwnedOperationGenerationの入力契約を満たす。
 * @postcondition retireOwnedOperationGenerationの責務を完了した結果だけを返す。
 * @effect N/A: retireOwnedOperationGenerationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: retireOwnedOperationGenerationは独自の失敗分岐を所有しない。
 * @invariant retireOwnedOperationGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: retireOwnedOperationGenerationはProcess内の同一Subsystemで完結する。
 * @security retireOwnedOperationGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: retireOwnedOperationGenerationは共有非同期状態を持たない同期処理である。
 */
function retireOwnedOperationGeneration(root: string, nonce: string): void {
  const state = operationGenerationsByKey.get(
    operationGenerationKey(root, nonce),
  );
  if (!state) return;
  state.retired = true;
  revokeOwnedOperationContextCapabilities(state.owned);
}

/**
 * owned Operation Generationを決定する。
 *
 * @responsibility owned Operation Generationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: object、identity: OwnedIdentity、shouldAllowRetired
 * @returns OperationGenerationStateを返す。
 * @precondition 「owned: object、identity: OwnedIdentity、shouldAllowRetired」がownedOperationGenerationの入力契約を満たす。
 * @postcondition ownedOperationGenerationの責務を完了した結果だけを返す。
 * @effect N/A: ownedOperationGenerationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownedOperationGenerationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownedOperationGenerationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownedOperationGenerationはProcess内の同一Subsystemで完結する。
 * @security ownedOperationGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownedOperationGenerationは共有非同期状態を持たない同期処理である。
 */
function ownedOperationGeneration(
  owned: object,
  identity: OwnedIdentity,
  shouldAllowRetired = false,
): OperationGenerationState {
  const state = operationGenerationsByKey.get(
    operationGenerationKey(identity.root, identity.hostRecovery.nonce),
  );
  if (
    !state ||
    state.owned !== owned ||
    operationGenerationByRoot.get(identity.root) !== state ||
    state.currentRecordHash !== identity.hostRecovery.recordHash ||
    (!shouldAllowRetired && state.retired)
  )
    throw new Error("owned_operation_identity_replaced");
  if (
    !shouldAllowRetired &&
    state.generationLock &&
    !state.generationLock.assertLive()
  ) {
    state.retired = true;
    revokeOwnedOperationEffectCapabilities(state.owned);
    throw new Error("owned_operation_generation_liveness_lost");
  }
  return state;
}

/**
 * operation Identity Replacementを決定する。
 *
 * @responsibility operation Identity Replacementの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns booleanを返す。
 * @precondition 「error: unknown」がoperationIdentityReplacementの入力契約を満たす。
 * @postcondition operationIdentityReplacementの責務を完了した結果だけを返す。
 * @effect N/A: operationIdentityReplacementは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: operationIdentityReplacementは独自の失敗分岐を所有しない。
 * @invariant operationIdentityReplacementは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: operationIdentityReplacementはProcess内の同一Subsystemで完結する。
 * @security operationIdentityReplacementはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: operationIdentityReplacementは共有非同期状態を持たない同期処理である。
 */
function operationIdentityReplacement(error: unknown): boolean {
  const message = errorMessage(error);
  return (
    errorCode(error) === "ENOENT" ||
    message === "owned_operation_identity_replaced" ||
    message === "owned_operation_mount_replaced"
  );
}

/**
 * 所有 Operation Identityの契約を検証する。
 *
 * @responsibility 所有 Operation Identityの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: object、identity: OwnedIdentity、shouldAllowRetired
 * @returns ChildSnapshotsを返す。
 * @precondition 「owned: object、identity: OwnedIdentity、shouldAllowRetired」がvalidateOwnedOperationIdentityの入力契約を満たす。
 * @postcondition validateOwnedOperationIdentityの責務を完了した結果だけを返す。
 * @effect validateOwnedOperationIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure validateOwnedOperationIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateOwnedOperationIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validateOwnedOperationIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateOwnedOperationIdentityは共有非同期状態を持たない同期処理である。
 */
function validateOwnedOperationIdentity(
  owned: object,
  identity: OwnedIdentity,
  shouldAllowRetired = false,
): ChildSnapshots {
  try {
    ownedOperationGeneration(owned, identity, shouldAllowRetired);
    if (
      !identity.children ||
      ownString(owned, "root") !== identity.root ||
      ownString(owned, "parent") !== identity.parent ||
      fs.realpathSync(identity.root) !== identity.root ||
      fs.realpathSync(identity.parent) !== identity.parent ||
      path.dirname(identity.root) !== identity.parent ||
      !path.basename(identity.root).startsWith(identity.prefix) ||
      !sameFilesystemIdentity(
        readFilesystemIdentity(identity.root),
        identity.filesystem,
      )
    ) {
      throw new Error("owned_operation_identity_replaced");
    }
    for (const snapshot of Object.values(identity.children))
      validateDirectorySnapshot(snapshot);
    return identity.children;
  } catch (error) {
    if (operationIdentityReplacement(error)) {
      retireOwnedOperationGeneration(
        identity.root,
        identity.hostRecovery.nonce,
      );
      throw new Error("owned_operation_identity_replaced");
    }
    throw new Error("owned_operation_identity_observation_blocked");
  }
}

/**
 * own Valueを決定する。
 *
 * @responsibility own Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: object、key: string
 * @returns unknownを返す。
 * @precondition 「value: object、key: string」がownValueの入力契約を満たす。
 * @postcondition ownValueの責務を完了した結果だけを返す。
 * @effect N/A: ownValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownValueは独自の失敗分岐を所有しない。
 * @invariant ownValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownValueはProcess内の同一Subsystemで完結する。
 * @security ownValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownValueは共有非同期状態を持たない同期処理である。
 */
function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (
    !descriptor ||
    !("value" in descriptor) ||
    descriptor.get ||
    descriptor.set
  )
    return undefined;
  return descriptor.value;
}

/**
 * own Stringを決定する。
 *
 * @responsibility own Stringの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、key: string
 * @returns string | nullを返す。
 * @precondition 「value: unknown、key: string」がownStringの入力契約を満たす。
 * @postcondition ownStringの責務を完了した結果だけを返す。
 * @effect N/A: ownStringは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownStringは独自の失敗分岐を所有しない。
 * @invariant ownStringは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownStringはProcess内の同一Subsystemで完結する。
 * @security ownStringはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownStringは共有非同期状態を持たない同期処理である。
 */
function ownString(value: unknown, key: string): string | null {
  if (!isObject(value)) return null;
  const candidate = ownValue(value, key);
  return typeof candidate === "string" ? candidate : null;
}

/**
 * error Codeを決定する。
 *
 * @responsibility error Codeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorCodeの入力契約を満たす。
 * @postcondition errorCodeの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeは独自の失敗分岐を所有しない。
 * @invariant errorCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorCodeはProcess内の同一Subsystemで完結する。
 * @security errorCodeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorCodeは共有非同期状態を持たない同期処理である。
 */
function errorCode(error: unknown): string | null {
  return ownString(error, "code");
}

/**
 * error Messageを決定する。
 *
 * @responsibility error Messageの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorMessageの入力契約を満たす。
 * @postcondition errorMessageの責務を完了した結果だけを返す。
 * @effect N/A: errorMessageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorMessageは独自の失敗分岐を所有しない。
 * @invariant errorMessageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorMessageはProcess内の同一Subsystemで完結する。
 * @security errorMessageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorMessageは共有非同期状態を持たない同期処理である。
 */
function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : ownString(error, "message");
}

/**
 * Filesystem Entryを観測する。
 *
 * @responsibility Filesystem Entryの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns "present" | "confirmed_absent" | "unknown"を返す。
 * @precondition 「target: string」がobserveFilesystemEntryの入力契約を満たす。
 * @postcondition observeFilesystemEntryの責務を完了した結果だけを返す。
 * @effect observeFilesystemEntryはFilesystemの読取りまたは書込みを実行する。
 * @failure observeFilesystemEntryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeFilesystemEntryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observeFilesystemEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeFilesystemEntryは共有非同期状態を持たない同期処理である。
 */
function observeFilesystemEntry(
  target: string,
): "present" | "confirmed_absent" | "unknown" {
  try {
    fs.lstatSync(target);
    return "present";
  } catch (error) {
    return errorCode(error) === "ENOENT" ? "confirmed_absent" : "unknown";
  }
}

/**
 * require Confirmed Absentを決定する。
 *
 * @responsibility require Confirmed Absentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string、reason: string
 * @returns N/A: requireConfirmedAbsentは戻り値を返さない。
 * @precondition 「target: string、reason: string」がrequireConfirmedAbsentの入力契約を満たす。
 * @postcondition requireConfirmedAbsentの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: requireConfirmedAbsentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireConfirmedAbsentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireConfirmedAbsentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireConfirmedAbsentはProcess内の同一Subsystemで完結する。
 * @security requireConfirmedAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: requireConfirmedAbsentは共有非同期状態を持たない同期処理である。
 */
function requireConfirmedAbsent(target: string, reason: string): void {
  if (observeFilesystemEntry(target) !== "confirmed_absent")
    throw new Error(reason);
}

/**
 * Plain 記録かを判定する。
 *
 * @responsibility Plain 記録の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がisPlainRecordの入力契約を満たす。
 * @postcondition isPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: isPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isPlainRecordは独自の失敗分岐を所有しない。
 * @invariant isPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isPlainRecordはProcess内の同一Subsystemで完結する。
 * @security isPlainRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isPlainRecordは共有非同期状態を持たない同期処理である。
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Serializable Identityを固定Schemaへ正規化する。
 *
 * @responsibility Serializable Identityの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns SerializableIdentityを返す。
 * @precondition 「value: unknown」がnormalizeSerializableIdentityの入力契約を満たす。
 * @postcondition normalizeSerializableIdentityの責務を完了した結果だけを返す。
 * @effect N/A: normalizeSerializableIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeSerializableIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeSerializableIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeSerializableIdentityはProcess内の同一Subsystemで完結する。
 * @security normalizeSerializableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeSerializableIdentityは共有非同期状態を持たない同期処理である。
 */
function normalizeSerializableIdentity(value: unknown): SerializableIdentity {
  if (!isPlainRecord(value)) throw new Error("host_recovery_record_mismatch");
  const dev = ownString(value, "dev");
  const ino = ownString(value, "ino");
  const birthtimeNs = ownString(value, "birthtimeNs");
  if (!dev || !ino || !birthtimeNs)
    throw new Error("host_recovery_record_mismatch");
  return Object.freeze({ dev, ino, birthtimeNs });
}

/**
 * 回復 状態を固定Schemaへ正規化する。
 *
 * @responsibility 回復 状態の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns RecoveryStateを返す。
 * @precondition 「value: unknown」がnormalizeRecoveryStateの入力契約を満たす。
 * @postcondition normalizeRecoveryStateの責務を完了した結果だけを返す。
 * @effect N/A: normalizeRecoveryStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeRecoveryStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeRecoveryStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeRecoveryStateはProcess内の同一Subsystemで完結する。
 * @security normalizeRecoveryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeRecoveryStateは共有非同期状態を持たない同期処理である。
 */
function normalizeRecoveryState(value: unknown): RecoveryState {
  if (
    value !== "initializing" &&
    value !== "host_only" &&
    value !== "docker_submission_started" &&
    value !== "docker_absent_confirmed"
  ) {
    throw new Error("host_recovery_record_mismatch");
  }
  return value;
}

/**
 * Host 回復 記録を固定Schemaへ正規化する。
 *
 * @responsibility Host 回復 記録の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns HostRecoveryRecordを返す。
 * @precondition 「value: unknown」がnormalizeHostRecoveryRecordの入力契約を満たす。
 * @postcondition normalizeHostRecoveryRecordの責務を完了した結果だけを返す。
 * @effect N/A: normalizeHostRecoveryRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeHostRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeHostRecoveryRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeHostRecoveryRecordはProcess内の同一Subsystemで完結する。
 * @security normalizeHostRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeHostRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function normalizeHostRecoveryRecord(value: unknown): HostRecoveryRecord {
  if (!isPlainRecord(value)) throw new Error("host_recovery_record_mismatch");
  const schema = ownString(value, "schema");
  const rootName = ownString(value, "rootName");
  const createdAt = ownString(value, "createdAt");
  const childValues = ownValue(value, "childIdentities");
  if (
    schema !== "crdd-coordinator-host-recovery/v1" ||
    !rootName ||
    !createdAt ||
    !isPlainRecord(childValues)
  ) {
    throw new Error("host_recovery_record_mismatch");
  }
  const childIdentities: Record<string, HostRecordChild> = {};
  for (const [name, childValue] of Object.entries(childValues)) {
    if (!isPlainRecord(childValue))
      throw new Error("host_recovery_record_mismatch");
    const pathName = ownString(childValue, "pathName");
    if (!pathName) throw new Error("host_recovery_record_mismatch");
    childIdentities[name] = Object.freeze({
      pathName,
      ...normalizeSerializableIdentity(childValue),
    });
  }
  const state = normalizeRecoveryState(ownValue(value, "state"));
  const rootIdentityValue = ownValue(value, "rootIdentity");
  const rootIdentity =
    rootIdentityValue === null
      ? null
      : normalizeSerializableIdentity(rootIdentityValue);
  if (
    (state === "initializing" && rootIdentity !== null) ||
    (state !== "initializing" && rootIdentity === null) ||
    (state === "initializing" && Object.keys(childIdentities).length !== 0)
  )
    throw new Error("host_recovery_record_mismatch");
  return Object.freeze({
    schema,
    state,
    rootName,
    rootIdentity,
    childIdentities: Object.freeze(childIdentities),
    createdAt,
  });
}

/**
 * owned Identityを決定する。
 *
 * @responsibility owned Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns OwnedIdentity | nullを返す。
 * @precondition 「value: unknown」がownedIdentityの入力契約を満たす。
 * @postcondition ownedIdentityの責務を完了した結果だけを返す。
 * @effect N/A: ownedIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownedIdentityは独自の失敗分岐を所有しない。
 * @invariant ownedIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownedIdentityはProcess内の同一Subsystemで完結する。
 * @security ownedIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownedIdentityは共有非同期状態を持たない同期処理である。
 */
function ownedIdentity(value: unknown): OwnedIdentity | null {
  return isObject(value) ? (ownedIdentities.get(value) ?? null) : null;
}

/**
 * require 所有 Identityを決定する。
 *
 * @responsibility require 所有 Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: object
 * @returns OwnedIdentityを返す。
 * @precondition 「value: object」がrequireOwnedIdentityの入力契約を満たす。
 * @postcondition requireOwnedIdentityの責務を完了した結果だけを返す。
 * @effect N/A: requireOwnedIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireOwnedIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireOwnedIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireOwnedIdentityはProcess内の同一Subsystemで完結する。
 * @security requireOwnedIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: requireOwnedIdentityは共有非同期状態を持たない同期処理である。
 */
function requireOwnedIdentity(value: object): OwnedIdentity {
  const identity = ownedIdentities.get(value);
  if (!identity) throw new Error("owned_operation_directory_identity_required");
  return identity;
}

/**
 * Filesystem Identityを読み取る。
 *
 * @responsibility Filesystem Identityの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input root: string
 * @returns FilesystemIdentityを返す。
 * @precondition 「root: string」がreadFilesystemIdentityの入力契約を満たす。
 * @postcondition readFilesystemIdentityの責務を完了した結果だけを返す。
 * @effect readFilesystemIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure readFilesystemIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readFilesystemIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readFilesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readFilesystemIdentityは共有非同期状態を持たない同期処理である。
 */
function readFilesystemIdentity(root: string): FilesystemIdentity {
  const metadata = fs.lstatSync(root, { bigint: true });
  // Windowsの64bit File IDはNodeのBigInt64Arrayで負値になり得る。
  const ino =
    process.platform === "win32" &&
    typeof metadata.ino === "bigint" &&
    metadata.ino >= -(1n << 63n) &&
    metadata.ino < 0n
      ? BigInt.asUintN(64, metadata.ino)
      : metadata.ino;
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    typeof ino !== "bigint" ||
    metadata.dev <= 0n ||
    ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("owned_operation_directory_identity_unavailable");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

/**
 * File Identityを読み取る。
 *
 * @responsibility File Identityの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns FilesystemIdentityを返す。
 * @precondition 「target: string」がreadFileIdentityの入力契約を満たす。
 * @postcondition readFileIdentityの責務を完了した結果だけを返す。
 * @effect readFileIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure readFileIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readFileIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readFileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readFileIdentityは共有非同期状態を持たない同期処理である。
 */
function readFileIdentity(target: string): FilesystemIdentity {
  const metadata = fs.lstatSync(target, { bigint: true });
  const ino =
    process.platform === "win32" &&
    typeof metadata.ino === "bigint" &&
    metadata.ino >= -(1n << 63n) &&
    metadata.ino < 0n
      ? BigInt.asUintN(64, metadata.ino)
      : metadata.ino;
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    typeof ino !== "bigint" ||
    metadata.dev <= 0n ||
    ino <= 0n ||
    metadata.birthtimeNs <= 0n
  )
    throw new Error("owned_operation_file_identity_unavailable");
  return Object.freeze({
    dev: metadata.dev,
    ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

/**
 * Open File Identityを読み取る。
 *
 * @responsibility Open File Identityの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input handle: number
 * @returns FilesystemIdentityを返す。
 * @precondition 「handle: number」がreadOpenFileIdentityの入力契約を満たす。
 * @postcondition readOpenFileIdentityの責務を完了した結果だけを返す。
 * @effect readOpenFileIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure readOpenFileIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readOpenFileIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readOpenFileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readOpenFileIdentityは共有非同期状態を持たない同期処理である。
 */
function readOpenFileIdentity(handle: number): FilesystemIdentity {
  const metadata = fs.fstatSync(handle, { bigint: true });
  const ino =
    process.platform === "win32" &&
    typeof metadata.ino === "bigint" &&
    metadata.ino >= -(1n << 63n) &&
    metadata.ino < 0n
      ? BigInt.asUintN(64, metadata.ino)
      : metadata.ino;
  if (
    !metadata.isFile() ||
    typeof ino !== "bigint" ||
    metadata.dev <= 0n ||
    ino <= 0n ||
    metadata.birthtimeNs <= 0n
  )
    throw new Error("owned_operation_file_identity_unavailable");
  return Object.freeze({
    dev: metadata.dev,
    ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

/**
 * Host 回復 Token From Markerが完全一致するか判定する。
 *
 * @responsibility Host 回復 Token From Markerの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input target: string、expectedRootName: string、nonce: string、allowedItems: readonly Readonly<{ identity: FilesystemIdentity; serialized: string; }>[]
 * @returns string | nullを返す。
 * @precondition 「target: string、expectedRootName: string、nonce: string、allowedItems: readonly Readonly<{ identity: FilesystemIdentity; serialized: string; }>[]」がexactHostRecoveryTokenFromMarkerの入力契約を満たす。
 * @postcondition exactHostRecoveryTokenFromMarkerの責務を完了した結果だけを返す。
 * @effect exactHostRecoveryTokenFromMarkerはFilesystemの読取りまたは書込みを実行する。
 * @failure exactHostRecoveryTokenFromMarkerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant exactHostRecoveryTokenFromMarkerは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security exactHostRecoveryTokenFromMarkerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactHostRecoveryTokenFromMarkerは共有非同期状態を持たない同期処理である。
 */
function exactHostRecoveryTokenFromMarker(
  target: string,
  expectedRootName: string,
  nonce: string,
  allowedItems: readonly Readonly<{
    identity: FilesystemIdentity;
    serialized: string;
  }>[],
): string | null {
  try {
    if (observeFilesystemEntry(target) !== "present") return null;
    const firstIdentity = readFileIdentity(target);
    const firstSerialized = fs.readFileSync(target, "utf8");
    if (
      !allowedItems.some(
        (candidate) =>
          sameFilesystemIdentity(firstIdentity, candidate.identity) &&
          firstSerialized === candidate.serialized,
      )
    )
      return null;
    const record = normalizeHostRecoveryRecord(JSON.parse(firstSerialized));
    if (record.rootName !== expectedRootName) return null;
    const secondIdentity = readFileIdentity(target);
    const secondSerialized = fs.readFileSync(target, "utf8");
    if (
      !sameFilesystemIdentity(firstIdentity, secondIdentity) ||
      firstSerialized !== secondSerialized
    )
      return null;
    const recordHash = createHash("sha256")
      .update(firstSerialized)
      .digest("hex");
    return `host.${expectedRootName}.${nonce}.${recordHash}`;
  } catch {
    return null;
  }
}

/**
 * Filesystem Identityが同一かを判定する。
 *
 * @responsibility Filesystem Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000008
 * @input left: FilesystemIdentity、right: FilesystemIdentity
 * @returns booleanを返す。
 * @precondition 「left: FilesystemIdentity、right: FilesystemIdentity」がsameFilesystemIdentityの入力契約を満たす。
 * @postcondition sameFilesystemIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameFilesystemIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameFilesystemIdentityは独自の失敗分岐を所有しない。
 * @invariant sameFilesystemIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameFilesystemIdentityはProcess内の同一Subsystemで完結する。
 * @security sameFilesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameFilesystemIdentityは共有非同期状態を持たない同期処理である。
 */
function sameFilesystemIdentity(
  left: FilesystemIdentity,
  right: FilesystemIdentity,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

/**
 * directory Snapshotを決定する。
 *
 * @responsibility directory Snapshotの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input directory: string、parent: string、name: string
 * @returns DirectorySnapshotを返す。
 * @precondition 「directory: string、parent: string、name: string」がdirectorySnapshotの入力契約を満たす。
 * @postcondition directorySnapshotの責務を完了した結果だけを返す。
 * @effect directorySnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure directorySnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant directorySnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security directorySnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: directorySnapshotは共有非同期状態を持たない同期処理である。
 */
function directorySnapshot(
  directory: string,
  parent: string,
  name: string,
): DirectorySnapshot {
  const realParent = fs.realpathSync(parent);
  const realDirectory = fs.realpathSync(directory);
  if (
    path.dirname(realDirectory) !== realParent ||
    path.basename(realDirectory) !== name
  ) {
    throw new Error("owned_operation_mount_boundary_failed");
  }
  return Object.freeze({
    parent: realParent,
    root: realDirectory,
    name,
    filesystem: readFilesystemIdentity(realDirectory),
  });
}

/**
 * Directory Snapshotの契約を検証する。
 *
 * @responsibility Directory Snapshotの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input snapshot: DirectorySnapshot
 * @returns stringを返す。
 * @precondition 「snapshot: DirectorySnapshot」がvalidateDirectorySnapshotの入力契約を満たす。
 * @postcondition validateDirectorySnapshotの責務を完了した結果だけを返す。
 * @effect validateDirectorySnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure validateDirectorySnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateDirectorySnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validateDirectorySnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateDirectorySnapshotは共有非同期状態を持たない同期処理である。
 */
function validateDirectorySnapshot(snapshot: DirectorySnapshot): string {
  const realParent = fs.realpathSync(snapshot.parent);
  const realDirectory = fs.realpathSync(snapshot.root);
  const filesystem = readFilesystemIdentity(snapshot.root);
  if (
    realParent !== snapshot.parent ||
    realDirectory !== snapshot.root ||
    path.dirname(realDirectory) !== realParent ||
    path.basename(realDirectory) !== snapshot.name ||
    !sameFilesystemIdentity(filesystem, snapshot.filesystem)
  ) {
    throw new Error("owned_operation_mount_replaced");
  }
  return snapshot.root;
}

/**
 * copy If Presentを決定する。
 *
 * @responsibility copy If Presentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: Record<string, string>、source: unknown、name: string
 * @returns N/A: copyIfPresentは戻り値を返さない。
 * @precondition 「target: Record<string, string>、source: unknown、name: string」がcopyIfPresentの入力契約を満たす。
 * @postcondition copyIfPresentの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: copyIfPresentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: copyIfPresentは独自の失敗分岐を所有しない。
 * @invariant copyIfPresentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: copyIfPresentはProcess内の同一Subsystemで完結する。
 * @security copyIfPresentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: copyIfPresentは共有非同期状態を持たない同期処理である。
 */
function copyIfPresent(
  target: Record<string, string>,
  source: unknown,
  name: string,
): void {
  const candidate = ownString(source, name);
  if (candidate !== null) target[name] = candidate;
}

/**
 * serializable Identityを決定する。
 *
 * @responsibility serializable Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns SerializableIdentityを返す。
 * @precondition 「target: string」がserializableIdentityの入力契約を満たす。
 * @postcondition serializableIdentityの責務を完了した結果だけを返す。
 * @effect serializableIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: serializableIdentityは独自の失敗分岐を所有しない。
 * @invariant serializableIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security serializableIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: serializableIdentityは共有非同期状態を持たない同期処理である。
 */
function serializableIdentity(target: string): SerializableIdentity {
  const identity = readFilesystemIdentity(target);
  return {
    dev: identity.dev.toString(),
    ino: identity.ino.toString(),
    birthtimeNs: identity.birthtimeNs.toString(),
  };
}

/**
 * identity Matches 記録を決定する。
 *
 * @responsibility identity Matches 記録の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string、record: SerializableIdentity
 * @returns booleanを返す。
 * @precondition 「target: string、record: SerializableIdentity」がidentityMatchesRecordの入力契約を満たす。
 * @postcondition identityMatchesRecordの責務を完了した結果だけを返す。
 * @effect identityMatchesRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure identityMatchesRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant identityMatchesRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security identityMatchesRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identityMatchesRecordは共有非同期状態を持たない同期処理である。
 */
function identityMatchesRecord(
  target: string,
  record: SerializableIdentity,
): boolean {
  try {
    const identity = readFilesystemIdentity(target);
    return (
      identity.dev === BigInt(record.dev) &&
      identity.ino === BigInt(record.ino) &&
      identity.birthtimeNs === BigInt(record.birthtimeNs)
    );
  } catch {
    return false;
  }
}

/**
 * 共有回復記録Directoryの初期化依存を定義する。
 *
 * @responsibility 存在観測、mkdir、freshな境界とIdentity検証を分ける。
 * @trace ARCH-000008
 * @shape 三つの局所呼出しと検証済みDirectory／Identityを持つ。
 * @invariant 削除、marker読取り、Token発行の依存を含めない。
 * @boundary Coordinator内の共有管理資源初期化。
 * @security 本番は固定PathのFilesystem依存、試験は非Authority依存だけを渡す。
 * @compatibility 既存の存在観測とInitializationFailure分類を使用する。
 */
type SharedHostRecoveryDirectoryDependencies = Readonly<{
  observe: () => "present" | "confirmed_absent" | "unknown";
  create: () => void;
  validate: () => Readonly<{
    directory: string;
    identity: FilesystemIdentity;
  }>;
}>;

/**
 * 共有回復記録Directoryを削除せず初期化・再利用する。
 *
 * @responsibility mkdirの存在競合をfresh検証へ戻し、不明を停止分類へ接続する。
 * @trace ARCH-000008
 * @input 存在観測、作成と検証の依存。
 * @returns freshに検証した共有DirectoryとIdentity。
 * @precondition 依存は同じ固定Directoryを扱う。
 * @postcondition 成功時は検証結果だけを返し、失敗時は清掃未確認を保持する。
 * @effect 渡された観測・mkdir・検証だけを実行する。
 * @failure 観測不明、mkdir失敗、境界・Identity検証失敗をInitializationFailureへ包む。
 * @invariant 共有Directoryと他Taskの記録を削除せず、回復Tokenを生成しない。
 * @boundary 共有管理資源の初期化settlement。
 * @security EEXISTを由来またはAuthorityの証明にしない。
 * @concurrency 他Taskのmkdirと競合した場合も同じfresh検証を要求する。
 */
function initializeSharedHostRecoveryDirectory(
  dependencies: SharedHostRecoveryDirectoryDependencies,
) {
  try {
    const before = dependencies.observe();
    if (before === "unknown")
      throw new Error("host_recovery_directory_observation_unknown");
    if (before === "confirmed_absent") {
      try {
        dependencies.create();
      } catch (error) {
        if (
          !error ||
          typeof error !== "object" ||
          !("code" in error) ||
          error.code !== "EEXIST"
        )
          throw error;
      }
    }
    return dependencies.validate();
  } catch (error) {
    throwHostRecoveryInitializationFailure(error, {
      cleanupConfirmed: false,
      hostRecoveryId: null,
    });
  }
}

/**
 * 固定した共有回復記録Directoryを作成または再検証する。
 *
 * @responsibility 本番Filesystem依存を共有初期化settlementへ接続する。
 * @trace ARCH-000008
 * @input 検証済みtemporary parentの実Path。
 * @returns 共有Directoryの実PathとFilesystem Identity。
 * @precondition 呼出し元がparentを実Directoryへ解決済みである。
 * @postcondition 固定child、実Directory、fresh Identityが成立した場合だけ返す。
 * @effect 固定childの存在・実Path・属性・Identityを読み、未存在ならmkdirを要求する。
 * @failure 初期化・観測・検証の失敗は清掃未確認、回復IDなしで停止する。
 * @invariant Operation失敗時も共有Directoryを削除しない。
 * @boundary OS管理temporary parent内の共有管理資源。
 * @security alias、別parent、非Directory、symbolic linkを拒否し、markerを信頼し直さない。
 * @concurrency mkdir競合後もfreshな同じ境界検証を行う。連続OS排他は本関数の保証ではない。
 */
function ensureHostRecoveryDirectory(
  parent: string,
): Readonly<{ directory: string; identity: FilesystemIdentity }> {
  const directory = path.join(parent, HOST_RECOVERY_DIRECTORY);
  return initializeSharedHostRecoveryDirectory({
    observe: () => observeFilesystemEntry(directory),
    create: () => fs.mkdirSync(directory, { mode: 0o700 }),
    validate: () => {
      const real = fs.realpathSync(directory);
      const metadata = fs.lstatSync(real);
      const identity = readFilesystemIdentity(real);
      if (
        real !== directory ||
        path.dirname(real) !== parent ||
        !metadata.isDirectory() ||
        metadata.isSymbolicLink()
      )
        throw new Error("host_recovery_directory_untrusted");
      return { directory: real, identity };
    },
  });
}

/**
 * 共有回復Directoryの非Authority局所試験入口を構築する。
 *
 * @responsibility 本番と同じ初期化settlementへ試験依存を渡す。
 * @trace ARCH-000008
 * @input Filesystem・Processを持たない試験用の観測、作成、検証依存。
 * @returns 初期化と内部失敗分類を確認する非Authority候補。
 * @precondition 本番Authorityの発行または公開APIとして使用しない。
 * @postcondition productionAuthority=falseで同じsettlementだけを返す。
 * @effect N/A: 構築時は依存呼出しや外部操作を行わない。
 * @failure 初期化呼出しの失敗は本番と同じ分類を保持する。
 * @invariant 公開indexへexportせず、削除Capability・Tokenを発行しない。
 * @boundary 同Subsystem内の内部試験支援。
 * @security 戻り値は本番の所有・非使用・清掃を証明しない。
 * @concurrency N/A: 同期局所候補であり非同期資源を持たない。
 */
export function createIsolatedSharedHostRecoveryDirectoryCandidate(
  dependencies: SharedHostRecoveryDirectoryDependencies,
) {
  return Object.freeze({
    productionAuthority: false as const,
    initialize: () => initializeSharedHostRecoveryDirectory(dependencies),
    classifyFailure: hostRecoveryInitializationFailure,
  });
}

/**
 * host 記録 Contentを決定する。
 *
 * @responsibility host 記録 Contentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input identity: OwnedIdentity、state: RecoveryState
 * @returns HostRecoveryRecordを返す。
 * @precondition 「identity: OwnedIdentity、state: RecoveryState」がhostRecordContentの入力契約を満たす。
 * @postcondition hostRecordContentの責務を完了した結果だけを返す。
 * @effect N/A: hostRecordContentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hostRecordContentは独自の失敗分岐を所有しない。
 * @invariant hostRecordContentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hostRecordContentはProcess内の同一Subsystemで完結する。
 * @security hostRecordContentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hostRecordContentは共有非同期状態を持たない同期処理である。
 */
function hostRecordContent(
  identity: OwnedIdentity,
  state: RecoveryState,
): HostRecoveryRecord {
  return {
    schema: "crdd-coordinator-host-recovery/v1",
    state,
    rootName: path.basename(identity.root),
    rootIdentity: serializableIdentity(identity.root),
    childIdentities: Object.fromEntries(
      Object.entries(identity.children ?? {}).map(([name, snapshot]) => [
        name,
        {
          pathName: snapshot.name,
          ...serializableIdentity(snapshot.root),
        },
      ]),
    ),
    createdAt: identity.createdAt,
  };
}

/**
 * Initializing Host 回復 記録を書き込む。
 *
 * @responsibility Initializing Host 回復 記録の書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input target: string、rootName: string、nonce: string、createdAt: string
 * @returns Readonly<{ recordHash: string; recordIdentity: FilesystemIdentity; serialized: string; token: string; }>を返す。
 * @precondition 「target: string、rootName: string、nonce: string、createdAt: string」がwriteInitializingHostRecoveryRecordの入力契約を満たす。
 * @postcondition writeInitializingHostRecoveryRecordの責務を完了した結果だけを返す。
 * @effect writeInitializingHostRecoveryRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure writeInitializingHostRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeInitializingHostRecoveryRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security writeInitializingHostRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeInitializingHostRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function writeInitializingHostRecoveryRecord(
  target: string,
  rootName: string,
  nonce: string,
  createdAt: string,
): Readonly<{
  recordHash: string;
  recordIdentity: FilesystemIdentity;
  serialized: string;
  token: string;
}> {
  const record: HostRecoveryRecord = Object.freeze({
    schema: "crdd-coordinator-host-recovery/v1",
    state: "initializing",
    rootName,
    rootIdentity: null,
    childIdentities: Object.freeze({}),
    createdAt,
  });
  const serialized = `${JSON.stringify(record)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const token = `host.${rootName}.${nonce}.${recordHash}`;
  let handle: number | null = null;
  let recordIdentity: FilesystemIdentity | null = null;
  let entryCreated = false;
  try {
    handle = fs.openSync(target, "wx", 0o600);
    entryCreated = true;
    recordIdentity = readOpenFileIdentity(handle);
    fs.writeFileSync(handle, serialized, "utf8");
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = null;
    if (
      !sameFilesystemIdentity(readFileIdentity(target), recordIdentity) ||
      fs.readFileSync(target, "utf8") !== serialized
    )
      throw new Error("host_recovery_record_replaced");
  } catch (error) {
    let cleanupConfirmed = !entryCreated;
    let handleSettled = handle === null;
    if (handle !== null) {
      try {
        fs.closeSync(handle);
        handle = null;
        handleSettled = true;
      } catch {
        handleSettled = false;
      }
    }
    if (recordIdentity && handleSettled) {
      try {
        const observation = observeFilesystemEntry(target);
        if (observation === "present") {
          if (!sameFilesystemIdentity(readFileIdentity(target), recordIdentity))
            throw new Error("host_recovery_record_replaced");
          fs.rmSync(target);
        } else if (observation === "unknown") {
          throw new Error("host_recovery_record_observation_unknown");
        }
        requireConfirmedAbsent(
          target,
          "host_recovery_record_cleanup_unconfirmed",
        );
        cleanupConfirmed = true;
      } catch {
        cleanupConfirmed = false;
      }
    }
    if (!cleanupConfirmed || !handleSettled)
      throwHostRecoveryInitializationFailure(error, {
        cleanupConfirmed: false,
        hostRecoveryId: exactHostRecoveryTokenFromMarker(
          target,
          rootName,
          nonce,
          recordIdentity
            ? [Object.freeze({ identity: recordIdentity, serialized })]
            : [],
        ),
      });
    throw error;
  }
  if (!recordIdentity)
    throw new Error("host_recovery_record_identity_unavailable");
  return Object.freeze({
    recordHash,
    recordIdentity,
    serialized,
    token,
  });
}

/**
 * Host 回復 記録を書き込む。
 *
 * @responsibility Host 回復 記録の書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input owned: object、identity: OwnedIdentity、state: RecoveryState
 * @returns stringを返す。
 * @precondition 「owned: object、identity: OwnedIdentity、state: RecoveryState」がwriteHostRecoveryRecordの入力契約を満たす。
 * @postcondition writeHostRecoveryRecordの責務を完了した結果だけを返す。
 * @effect writeHostRecoveryRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure writeHostRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeHostRecoveryRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security writeHostRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeHostRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function writeHostRecoveryRecord(
  owned: object,
  identity: OwnedIdentity,
  state: RecoveryState,
): string {
  const previous = readCurrentOwnedHostRecord(identity);
  if (
    !identity.hostRecovery.recordIdentity ||
    createHash("sha256").update(previous.serialized).digest("hex") !==
      identity.hostRecovery.recordHash ||
    previous.record.state !== identity.hostRecovery.state
  )
    throw new Error("host_recovery_record_mismatch");
  const record = hostRecordContent(identity, state);
  const serialized = `${JSON.stringify(record)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const target = identity.hostRecovery.record;
  const temporary = `${target}.${randomUUID()}.tmp`;
  let temporaryHandle: number | null = null;
  let temporaryIdentity: FilesystemIdentity | null = null;
  let temporaryCreated = false;
  let wasRenamed = false;
  try {
    temporaryHandle = fs.openSync(temporary, "wx", 0o600);
    temporaryCreated = true;
    temporaryIdentity = readOpenFileIdentity(temporaryHandle);
    fs.writeFileSync(temporaryHandle, serialized, "utf8");
    fs.fsyncSync(temporaryHandle);
    fs.closeSync(temporaryHandle);
    temporaryHandle = null;
    fs.renameSync(temporary, target);
    wasRenamed = true;
    if (
      !temporaryIdentity ||
      !sameFilesystemIdentity(readFileIdentity(target), temporaryIdentity)
    )
      throw new Error("host_recovery_record_replaced");
    if (fs.readFileSync(target, "utf8") !== serialized)
      throw new Error("host_recovery_record_replaced");
  } catch (error) {
    let cleanupConfirmed = !temporaryCreated;
    let handleSettled = temporaryHandle === null;
    if (temporaryHandle !== null) {
      try {
        fs.closeSync(temporaryHandle);
        temporaryHandle = null;
        handleSettled = true;
      } catch {
        handleSettled = false;
      }
    }
    const cleanupTarget = wasRenamed ? target : temporary;
    if (temporaryIdentity && handleSettled) {
      try {
        const observation = observeFilesystemEntry(cleanupTarget);
        if (observation === "present") {
          if (
            !sameFilesystemIdentity(
              readFileIdentity(cleanupTarget),
              temporaryIdentity,
            )
          )
            throw new Error("host_recovery_record_replaced");
          fs.rmSync(cleanupTarget);
        } else if (observation === "unknown") {
          throw new Error("host_recovery_record_observation_unknown");
        }
        requireConfirmedAbsent(
          cleanupTarget,
          "host_recovery_record_cleanup_unconfirmed",
        );
        cleanupConfirmed = true;
      } catch {
        cleanupConfirmed = false;
      }
    }
    const retainedRecoveryId = exactHostRecoveryTokenFromMarker(
      target,
      path.basename(identity.root),
      identity.hostRecovery.nonce,
      [
        Object.freeze({
          identity: identity.hostRecovery.recordIdentity,
          serialized: previous.serialized,
        }),
        ...(temporaryIdentity
          ? [Object.freeze({ identity: temporaryIdentity, serialized })]
          : []),
      ],
    );
    const originalRecoveryId = expectedHostRecoveryToken(identity);
    if (
      !cleanupConfirmed ||
      !handleSettled ||
      retainedRecoveryId !== originalRecoveryId
    )
      throwHostRecoveryInitializationFailure(error, {
        cleanupConfirmed: false,
        hostRecoveryId: retainedRecoveryId,
      });
    throw error;
  }
  const updated = Object.freeze({
    ...identity,
    hostRecovery: Object.freeze({
      ...identity.hostRecovery,
      state,
      recordHash,
      recordIdentity: readFileIdentity(target),
    }),
  });
  ownedIdentities.set(owned, updated);
  return `host.${path.basename(identity.root)}.${identity.hostRecovery.nonce}.${recordHash}`;
}

/**
 * Operation Directoriesを構築する。
 *
 * @responsibility Operation Directoriesの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input rootDirectory: string
 * @returns OperationDirectoriesを返す。
 * @precondition 「rootDirectory: string」がcreateOperationDirectoriesの入力契約を満たす。
 * @postcondition createOperationDirectoriesの責務を完了した結果だけを返す。
 * @effect createOperationDirectoriesはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: createOperationDirectoriesは独自の失敗分岐を所有しない。
 * @invariant createOperationDirectoriesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOperationDirectoriesは共有非同期状態を持たない同期処理である。
 */
export function createOperationDirectories(
  rootDirectory: string,
): OperationDirectories {
  const directories = {
    root: rootDirectory,
    providerHome: path.join(rootDirectory, "provider-home"),
    workspace: path.join(rootDirectory, "workspace"),
    tmp: path.join(rootDirectory, "tmp"),
    events: path.join(rootDirectory, "events"),
    projection: path.join(rootDirectory, "projection"),
    management: path.join(rootDirectory, "management"),
  };
  for (const directory of Object.values(directories))
    fs.mkdirSync(directory, { recursive: true });
  return directories;
}

/**
 * 所有 Operation Directoriesを構築する。
 *
 * @responsibility 所有 Operation Directoriesの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input temporaryParent: string
 * @returns OwnedOperationDirectories & { directories: OperationDirectories }を返す。
 * @precondition 「temporaryParent: string」がcreateOwnedOperationDirectoriesの入力契約を満たす。
 * @postcondition createOwnedOperationDirectoriesの責務を完了した結果だけを返す。
 * @effect N/A: createOwnedOperationDirectoriesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createOwnedOperationDirectoriesは独自の失敗分岐を所有しない。
 * @invariant createOwnedOperationDirectoriesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOwnedOperationDirectoriesはProcess内の同一Subsystemで完結する。
 * @security createOwnedOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedOperationDirectoriesは共有非同期状態を持たない同期処理である。
 */
export function createOwnedOperationDirectories(
  temporaryParent?: string,
): OwnedOperationDirectories & { directories: OperationDirectories };

/**
 * 所有 Operation Directoriesを構築する。
 *
 * @responsibility 所有 Operation Directoriesの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input temporaryParent: string
 * @returns OwnedOperationDirectoriesを返す。
 * @precondition 「temporaryParent: string」がcreateOwnedOperationDirectoriesの入力契約を満たす。
 * @postcondition createOwnedOperationDirectoriesの責務を完了した結果だけを返す。
 * @effect createOwnedOperationDirectoriesはFilesystemの読取りまたは書込みを実行する。
 * @failure createOwnedOperationDirectoriesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createOwnedOperationDirectoriesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createOwnedOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedOperationDirectoriesは共有非同期状態を持たない同期処理である。
 */
export function createOwnedOperationDirectories(
  temporaryParent: string = os.tmpdir(),
): OwnedOperationDirectories {
  let parent: string | null = null;
  let createdRoot: string | null = null;
  let createdRootIdentity: FilesystemIdentity | null = null;
  let realRoot: string | null = null;
  let owned: OwnedOperationDirectories | null = null;
  let initializingRecord: Readonly<{
    path: string;
    identity: FilesystemIdentity;
    serialized: string;
    token: string;
  }> | null = null;
  try {
    parent = fs.realpathSync(temporaryParent);
    const parentMetadata = fs.lstatSync(parent);
    if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()) {
      throw new Error("temporary_parent_must_be_real_directory");
    }
    const recovery = ensureHostRecoveryDirectory(parent);
    const nonce = randomUUID();
    const rootName = `${OWNED_PREFIX}${nonce}`;
    const createdAt = new Date().toISOString();
    const recoveryRecord = path.join(
      recovery.directory,
      `host-${createHash("sha256").update(nonce).digest("hex")}.json`,
    );
    const initializing = writeInitializingHostRecoveryRecord(
      recoveryRecord,
      rootName,
      nonce,
      createdAt,
    );
    initializingRecord = Object.freeze({
      path: recoveryRecord,
      identity: initializing.recordIdentity,
      serialized: initializing.serialized,
      token: initializing.token,
    });
    const candidateRoot = path.join(parent, rootName);
    fs.mkdirSync(candidateRoot);
    createdRoot = candidateRoot;
    createdRootIdentity = readFilesystemIdentity(createdRoot);
    realRoot = fs.realpathSync(createdRoot);
    if (
      path.dirname(realRoot) !== parent ||
      !path.basename(realRoot).startsWith(OWNED_PREFIX)
    ) {
      throw new Error("owned_operation_directory_boundary_failed");
    }
    owned = {
      parent,
      root: realRoot,
      directories: null,
      hostRecoveryId: null,
    };
    ownedIdentities.set(
      owned,
      Object.freeze({
        operationId: createOperationId(),
        parent,
        root: realRoot,
        prefix: OWNED_PREFIX,
        filesystem: readFilesystemIdentity(realRoot),
        createdAt,
        hostRecovery: Object.freeze({
          directory: recovery.directory,
          directoryIdentity: recovery.identity,
          record: recoveryRecord,
          recordIdentity: initializing.recordIdentity,
          nonce,
          state: "initializing",
          recordHash: initializing.recordHash,
        }),
      }),
    );
    owned.directories = createOperationDirectories(realRoot);
    const identity = requireOwnedIdentity(owned);
    if (!owned.directories)
      throw new Error("owned_operation_directory_identity_required");
    const children = Object.freeze({
      workspace: directorySnapshot(
        owned.directories.workspace,
        realRoot,
        "workspace",
      ),
      providerHome: directorySnapshot(
        owned.directories.providerHome,
        realRoot,
        "provider-home",
      ),
      tmp: directorySnapshot(owned.directories.tmp, realRoot, "tmp"),
      events: directorySnapshot(owned.directories.events, realRoot, "events"),
      projection: directorySnapshot(
        owned.directories.projection,
        realRoot,
        "projection",
      ),
      management: directorySnapshot(
        owned.directories.management,
        realRoot,
        "management",
      ),
    });
    ownedIdentities.set(
      owned,
      Object.freeze({
        ...identity,
        children,
        mounts: Object.freeze({
          workspace: children.workspace,
          providerHome: children.providerHome,
          tmp: children.tmp,
        }),
      }),
    );
    owned.hostRecoveryId = writeHostRecoveryRecord(
      owned,
      requireOwnedIdentity(owned),
      "host_only",
    );
    registerOwnedOperationGeneration(owned, requireOwnedIdentity(owned));
    return owned;
  } catch (error) {
    const nestedFailure = hostRecoveryInitializationFailure(error);
    let cleanupConfirmed = nestedFailure?.cleanupConfirmed ?? true;
    let rootCleanupConfirmed = createdRoot === null;
    let markerCleanupConfirmed = initializingRecord === null;
    if (cleanupConfirmed) {
      try {
        if (realRoot !== null && owned && ownedIdentity(owned)) {
          rollbackInitializingOperationDirectories(owned);
          rootCleanupConfirmed = true;
          markerCleanupConfirmed = true;
        } else if (
          createdRoot !== null &&
          createdRootIdentity !== null &&
          parent !== null
        ) {
          const metadata = fs.lstatSync(createdRoot);
          if (
            metadata.isSymbolicLink() ||
            !metadata.isDirectory() ||
            fs.realpathSync(createdRoot) !== createdRoot ||
            path.dirname(createdRoot) !== parent ||
            !path.basename(createdRoot).startsWith(OWNED_PREFIX) ||
            !sameFilesystemIdentity(
              readFilesystemIdentity(createdRoot),
              createdRootIdentity,
            )
          )
            throw new Error("owned_operation_directory_boundary_failed");
          fs.rmSync(createdRoot, { recursive: true, force: false });
          requireConfirmedAbsent(
            createdRoot,
            "owned_operation_directory_cleanup_incomplete",
          );
          rootCleanupConfirmed = true;
        }
      } catch {
        rootCleanupConfirmed = false;
      }
      if (rootCleanupConfirmed && !owned && initializingRecord) {
        try {
          const observation = observeFilesystemEntry(initializingRecord.path);
          if (observation === "present") {
            if (
              !sameFilesystemIdentity(
                readFileIdentity(initializingRecord.path),
                initializingRecord.identity,
              )
            )
              throw new Error("host_recovery_record_replaced");
            fs.rmSync(initializingRecord.path);
          } else if (observation === "unknown") {
            throw new Error("host_recovery_record_observation_unknown");
          }
          requireConfirmedAbsent(
            initializingRecord.path,
            "host_recovery_record_cleanup_unconfirmed",
          );
          markerCleanupConfirmed = true;
        } catch {
          markerCleanupConfirmed = false;
        }
      }
    }
    cleanupConfirmed =
      cleanupConfirmed && rootCleanupConfirmed && markerCleanupConfirmed;
    let retainedRecoveryId = nestedFailure?.hostRecoveryId ?? null;
    if (!nestedFailure && initializingRecord) {
      try {
        const parsed = parseHostRecoveryToken(initializingRecord.token);
        retainedRecoveryId = sameFilesystemIdentity(
          readFileIdentity(initializingRecord.path),
          initializingRecord.identity,
        )
          ? exactHostRecoveryTokenFromMarker(
              initializingRecord.path,
              parsed.rootName,
              parsed.nonce,
              [
                Object.freeze({
                  identity: initializingRecord.identity,
                  serialized: initializingRecord.serialized,
                }),
              ],
            )
          : null;
      } catch {
        retainedRecoveryId = null;
      }
    }
    throwOwnedOperationDirectoryCreationFailure(error, {
      cleanupConfirmed,
      manualRecoveryRequired: !cleanupConfirmed,
      hostRecoveryId: !cleanupConfirmed ? retainedRecoveryId : null,
    });
  }
}

/**
 * 所有 Transition Inputsが有効な状態か判定する。
 *
 * @responsibility 所有 Transition Inputsの有効状態条件と判定結果境界を所有する。
 * @trace ARCH-000008
 * @input mountCapability: unknown、currentToken: unknown、expectedState: "host_only" | "docker_submission_started"
 * @returns Readonly<{ loaded: ReturnType<typeof loadHostRecoveryRecord>; state: OperationGenerationState; identity: OwnedIdentity; }>を返す。
 * @precondition 「mountCapability: unknown、currentToken: unknown、expectedState: "host_only" | "docker_submission_started"」がactiveOwnedTransitionInputsの入力契約を満たす。
 * @postcondition activeOwnedTransitionInputsの責務を完了した結果だけを返す。
 * @effect N/A: activeOwnedTransitionInputsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure activeOwnedTransitionInputsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant activeOwnedTransitionInputsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: activeOwnedTransitionInputsはProcess内の同一Subsystemで完結する。
 * @security activeOwnedTransitionInputsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: activeOwnedTransitionInputsは共有非同期状態を持たない同期処理である。
 */
function activeOwnedTransitionInputs(
  mountCapability: unknown,
  currentToken: unknown,
  expectedState: "host_only" | "docker_submission_started",
): Readonly<{
  loaded: ReturnType<typeof loadHostRecoveryRecord>;
  state: OperationGenerationState;
  identity: OwnedIdentity;
}> {
  const mount = isObject(mountCapability)
    ? (mountCapabilities.get(mountCapability) ?? null)
    : null;
  if (!mount) throw new Error("owned_operation_mount_capability_required");
  return activeOwnedTransitionInputsForOwned(
    mount.owned,
    currentToken,
    expectedState,
    "owned_operation_mount_capability_required",
  );
}

/**
 * 所有 Transition Inputs For 所有が有効な状態か判定する。
 *
 * @responsibility 所有 Transition Inputs For 所有の有効状態条件と判定結果境界を所有する。
 * @trace ARCH-000008
 * @input owned: object、currentToken: unknown、expectedState: "host_only" | "docker_submission_started"、bindingError
 * @returns Readonly<{ loaded: ReturnType<typeof loadHostRecoveryRecord>; state: OperationGenerationState; identity: OwnedIdentity; }>を返す。
 * @precondition 「owned: object、currentToken: unknown、expectedState: "host_only" | "docker_submission_started"、bindingError」がactiveOwnedTransitionInputsForOwnedの入力契約を満たす。
 * @postcondition activeOwnedTransitionInputsForOwnedの責務を完了した結果だけを返す。
 * @effect N/A: activeOwnedTransitionInputsForOwnedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure activeOwnedTransitionInputsForOwnedは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant activeOwnedTransitionInputsForOwnedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: activeOwnedTransitionInputsForOwnedはProcess内の同一Subsystemで完結する。
 * @security activeOwnedTransitionInputsForOwnedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: activeOwnedTransitionInputsForOwnedは共有非同期状態を持たない同期処理である。
 */
function activeOwnedTransitionInputsForOwned(
  owned: object,
  currentToken: unknown,
  expectedState: "host_only" | "docker_submission_started",
  bindingError = "owned_operation_management_binding_required",
): Readonly<{
  loaded: ReturnType<typeof loadHostRecoveryRecord>;
  state: OperationGenerationState;
  identity: OwnedIdentity;
}> {
  const identity = ownedIdentities.get(owned);
  if (!identity) throw new Error(bindingError);
  validateOwnedOperationIdentity(owned, identity);
  const parsed = parseHostRecoveryToken(currentToken);
  const state = operationGenerationByRoot.get(identity.root);
  if (!state || state.owned !== owned || state.retired)
    throw new Error(bindingError);
  if (
    parsed.rootName !== path.basename(identity.root) ||
    parsed.nonce !== state.nonce ||
    parsed.recordHash !== state.currentRecordHash ||
    identity.hostRecovery.state !== expectedState
  )
    throw new Error("host_recovery_generation_mismatch");
  const record = validatePrivateHostRecoveryRecord(identity, expectedState);
  const loaded = Object.freeze({
    parsed,
    parent: identity.parent,
    recovery: Object.freeze({ directory: identity.root }),
    marker: identity.hostRecovery.record,
    record,
  });
  return Object.freeze({ loaded, state, identity });
}

/**
 * replace Host 回復 記録 状態を決定する。
 *
 * @responsibility replace Host 回復 記録 状態の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input loaded: ReturnType<typeof loadHostRecoveryRecord>、nextState: RecoveryState
 * @returns Readonly<{ recordHash: string; recordIdentity: FilesystemIdentity; token: string; }>を返す。
 * @precondition 「loaded: ReturnType<typeof loadHostRecoveryRecord>、nextState: RecoveryState」がreplaceHostRecoveryRecordStateの入力契約を満たす。
 * @postcondition replaceHostRecoveryRecordStateの責務を完了した結果だけを返す。
 * @effect replaceHostRecoveryRecordStateはFilesystemの読取りまたは書込みを実行する。
 * @failure replaceHostRecoveryRecordStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant replaceHostRecoveryRecordStateは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security replaceHostRecoveryRecordStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: replaceHostRecoveryRecordStateは共有非同期状態を持たない同期処理である。
 */
function replaceHostRecoveryRecordState(
  loaded: ReturnType<typeof loadHostRecoveryRecord>,
  nextState: RecoveryState,
): Readonly<{
  recordHash: string;
  recordIdentity: FilesystemIdentity;
  token: string;
}> {
  const updatedRecord = { ...loaded.record, state: nextState };
  const serialized = `${JSON.stringify(updatedRecord)}\n`;
  const recordHash = createHash("sha256").update(serialized).digest("hex");
  const temporary = `${loaded.marker}.${randomUUID()}.tmp`;
  const temporaryHandle = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(temporaryHandle, serialized, "utf8");
    fs.fsyncSync(temporaryHandle);
  } finally {
    fs.closeSync(temporaryHandle);
  }
  fs.renameSync(temporary, loaded.marker);
  if (fs.readFileSync(loaded.marker, "utf8") !== serialized)
    throw new Error("host_recovery_record_replaced");
  return Object.freeze({
    recordHash,
    recordIdentity: readFileIdentity(loaded.marker),
    token: `host.${loaded.parsed.rootName}.${loaded.parsed.nonce}.${recordHash}`,
  });
}

/**
 * 所有 Docker Submission 状態を状態遷移させる。
 *
 * @responsibility 所有 Docker Submission 状態の遷移前提、次状態、無効遷移の拒否境界を所有する。
 * @trace ARCH-000008
 * @input mountCapability: unknown、currentToken: unknown、action: unknown
 * @returns stringを返す。
 * @precondition 「mountCapability: unknown、currentToken: unknown、action: unknown」がtransitionOwnedDockerSubmissionStateの入力契約を満たす。
 * @postcondition transitionOwnedDockerSubmissionStateの責務を完了した結果だけを返す。
 * @effect N/A: transitionOwnedDockerSubmissionStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure transitionOwnedDockerSubmissionStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant transitionOwnedDockerSubmissionStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: transitionOwnedDockerSubmissionStateはProcess内の同一Subsystemで完結する。
 * @security transitionOwnedDockerSubmissionStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: transitionOwnedDockerSubmissionStateは共有非同期状態を持たない同期処理である。
 */
export function transitionOwnedDockerSubmissionState(
  mountCapability: unknown,
  currentToken: unknown,
  action: unknown,
): string {
  const expectedState =
    action === "begin" ? "host_only" : "docker_submission_started";
  const nextState =
    action === "begin" ? "docker_submission_started" : "host_only";
  if (action !== "begin" && action !== "cancel")
    throw new Error("host_recovery_state_invalid");
  const { loaded, state, identity } = activeOwnedTransitionInputs(
    mountCapability,
    currentToken,
    expectedState,
  );
  const updated = replaceHostRecoveryRecordState(loaded, nextState);
  ownedIdentities.set(
    state.owned,
    Object.freeze({
      ...identity,
      hostRecovery: Object.freeze({
        ...identity.hostRecovery,
        state: nextState,
        recordHash: updated.recordHash,
        recordIdentity: updated.recordIdentity,
      }),
    }),
  );
  state.currentRecordHash = updated.recordHash;
  return updated.token;
}

/**
 * owned Operation From Management Capabilityを決定する。
 *
 * @responsibility owned Operation From Management Capabilityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns ownedOperationFromManagementCapabilityの計算結果を返す。
 * @precondition 「managementCapability: unknown」がownedOperationFromManagementCapabilityの入力契約を満たす。
 * @postcondition ownedOperationFromManagementCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: ownedOperationFromManagementCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownedOperationFromManagementCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownedOperationFromManagementCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownedOperationFromManagementCapabilityはProcess内の同一Subsystemで完結する。
 * @security ownedOperationFromManagementCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownedOperationFromManagementCapabilityは共有非同期状態を持たない同期処理である。
 */
function ownedOperationFromManagementCapability(managementCapability: unknown) {
  const binding = isObject(managementCapability)
    ? (operationManagementCapabilities.get(managementCapability) ?? null)
    : null;
  if (!binding) throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(binding.owned);
  if (
    !identity ||
    identity.operationId !== binding.operationId ||
    identity.createdAt !== binding.createdAt
  ) {
    throw new Error("owned_operation_management_binding_required");
  }
  validateOwnedOperationIdentity(binding.owned, identity);
  return Object.freeze({ binding, identity });
}

/**
 * 所有 Host Operation Generation Lockを有効化する。
 *
 * @responsibility 所有 Host Operation Generation Lockの有効化条件、状態遷移、失敗時の非発効境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns activateOwnedHostOperationGenerationLockの計算結果を返す。
 * @precondition 「managementCapability: unknown」がactivateOwnedHostOperationGenerationLockの入力契約を満たす。
 * @postcondition activateOwnedHostOperationGenerationLockの責務を完了した結果だけを返す。
 * @effect 固定Supervisorを取得し、失効した取得のLockだけを解放する。
 * @failure activateOwnedHostOperationGenerationLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 待機前の世代・記録Hashとfresh観測が一致する場合だけLockを搬送する。
 * @boundary Supervisor取得とOperation世代・耐久記録の再検証の境界。
 * @security activateOwnedHostOperationGenerationLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency activateOwnedHostOperationGenerationLockは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function activateOwnedHostOperationGenerationLock(
  managementCapability: unknown,
) {
  const { binding, identity } =
    ownedOperationFromManagementCapability(managementCapability);
  const state = ownedOperationGeneration(binding.owned, identity);
  if (state.generationLock)
    throw new Error("owned_operation_generation_lock_already_active");
  const recordHash = state.currentRecordHash;
  return settleHostOperationLockAcquisition({
    before: Object.freeze({
      binding,
      identity,
      generation: state,
      recordHash,
      retired: state.retired,
      lock: state.generationLock,
    }),
    acquire: () =>
      acquireRuntimeOwnedHostOperationSupervisorLock(
        path.basename(identity.root),
        identity.hostRecovery.nonce,
      ),
    readCurrent: () => {
      const after =
        ownedOperationFromManagementCapability(managementCapability);
      const current = ownedOperationGeneration(
        after.binding.owned,
        after.identity,
      );
      validatePrivateHostRecoveryRecord(
        after.identity,
        after.identity.hostRecovery.state,
      );
      return Object.freeze({
        binding: after.binding,
        identity: after.identity,
        generation: current,
        recordHash: current.currentRecordHash,
        retired: current.retired,
        lock: current.generationLock,
      });
    },
    publish: (lock) => {
      state.generationLock = lock;
    },
    retainUnknown: (lock) => {
      state.generationLock = lock;
      state.retired = true;
      revokeOwnedOperationContextCapabilities(state.owned);
    },
    poison: poisonRuntimeProcessAfterCleanupUnknown,
  });
}

/**
 * Host Lock取得の依存と、取得後に再確認する所有境界を定義する。
 *
 * @responsibility 取得・再検証・公開・不明時保持を同じ取得処理へ結合する。
 * @trace ARCH-000008
 * @shape Supervisor取得結果と同期の再検証・所有権搬送callbackを持つ。
 * @invariant publishとretainUnknownは再検証成功時だけ呼ばれる。
 * @boundary Supervisorの非同期取得とOperation世代の同期公開の境界。
 * @security 試験依存は本番Authorityへ昇格しない。
 * @compatibility 公開CLI・結果Schema・Lock protocolを変更しない。
 */
type HostOperationLockActivationDependencies = Readonly<{
  before: HostOperationLockActivationSnapshot;
  acquire: () => ReturnType<
    typeof acquireRuntimeOwnedHostOperationSupervisorLock
  >;
  readCurrent: () => HostOperationLockActivationSnapshot;
  publish: (
    lock: NonNullable<OperationGenerationState["generationLock"]>,
  ) => void;
  retainUnknown: (lock: OperationGenerationState["generationLock"]) => void;
  poison: () => void;
}>;

/**
 * 取得前後で比較する所有者・世代と記録Hashの値を定義する。
 *
 * @responsibility 可変generation参照と捕捉済みHash値を分けて保持する。
 * @trace ARCH-000008
 * @shape 所有binding、identity、generation参照、Hash、失効とLockの値を持つ。
 * @invariant Hash値はgenerationが後に変更されても変わらない。
 * @boundary 待機前の捕捉値と待機後のfresh観測値の境界。
 * @security この値だけでは本番Capabilityまたは回復Authorityを発行しない。
 * @compatibility 内部取得比較に限定し公開Schemaへ追加しない。
 */
type HostOperationLockActivationSnapshot = Readonly<{
  binding: object;
  identity: object;
  generation: object;
  recordHash: string;
  retired: boolean;
  lock: OperationGenerationState["generationLock"];
}>;

/**
 * 後着したHost Lockを、現在も有効な取得元へだけ搬送する。
 *
 * @responsibility 取得待機後の失効・置換を拒否し、新取得Lockの回収責務を保持する。
 * @trace ARCH-000008
 * @input dependencies: 取得、fresh再検証、所有権搬送、process停止の依存。
 * @returns activated、既存取得失敗分類、または後着Lockの回収不明を返す。
 * @precondition 再検証と所有権搬送は同期処理であり、同じ取得元を検査する。
 * @postcondition 不一致時は取得Lockだけを一回解放し、旧世代へ代入しない。
 * @effect 注入されたSupervisor取得・解放とprocess停止だけを行う。
 * @failure 再検証throwは不一致。解放throw・不明はcleanup_unknownへ閉じる。
 * @invariant 再検証と公開の間にawaitを置かず、既存Lockを解放・置換しない。
 * @boundary 非同期取得結果とOperationの現在世代の境界。
 * @security Lock解放確認をRoot清掃成立またはRecovery Authorityにしない。
 * @concurrency 取得Promiseと後着Lockの終端まで待ち、回収をfire-and-forgetにしない。
 */
async function settleHostOperationLockAcquisition(
  dependencies: HostOperationLockActivationDependencies,
) {
  const before = Object.freeze({ ...dependencies.before });
  let outcome: Awaited<
    ReturnType<HostOperationLockActivationDependencies["acquire"]>
  >;
  try {
    outcome = await dependencies.acquire();
  } catch {
    outcome = { status: "cleanup_unknown", lock: null };
  }
  if (!outcome.lock && outcome.status !== "cleanup_unknown") {
    return outcome.status;
  }
  let isCurrent = false;
  try {
    const current = dependencies.readCurrent();
    isCurrent =
      current.binding === before.binding &&
      current.identity === before.identity &&
      current.generation === before.generation &&
      current.recordHash === before.recordHash &&
      current.retired === false &&
      current.lock === null;
  } catch {}
  if (isCurrent && outcome.status === "acquired" && outcome.lock) {
    dependencies.publish(outcome.lock);
    return "activated" as const;
  }
  if (isCurrent && outcome.status === "cleanup_unknown") {
    dependencies.retainUnknown(outcome.lock);
    dependencies.poison();
    return "cleanup_unknown" as const;
  }
  if (!outcome.lock) {
    dependencies.poison();
    return "cleanup_unknown" as const;
  }
  let released: Awaited<ReturnType<typeof outcome.lock.release>> =
    "cleanup_unknown";
  try {
    released = await outcome.lock.release();
  } catch {}
  if (released === "cleanup_unknown" || outcome.status === "cleanup_unknown") {
    dependencies.poison();
    return "cleanup_unknown" as const;
  }
  return "cleanup_confirmed_failure" as const;
}

/**
 * 本番と同じ取得settlementを使う、非Authorityの試験候補を構築する。
 *
 * @responsibility 後着Lockの再検証・解放を外部Effectなしの依存で検証可能にする。
 * @trace ARCH-000008
 * @input dependencies: 試験が所有する取得・再検証・搬送・停止依存。
 * @returns productionAuthority=falseのactivate入口を返す。
 * @precondition 本番Capability、OS Lockおよび回復Authorityを発行しない依存を使用する。
 * @postcondition activateは本番と同じsettlement関数を呼ぶ。
 * @effect N/A: 候補の構築だけでは依存を実行しない。
 * @failure 実行時の失敗はsettlementの分類へ従う。
 * @invariant 本番のOperation世代Map・公開入口を変更しない。
 * @boundary 試験依存と本番取得settlementの境界。
 * @security 候補の結果を実OS排他・清掃成立の証明にしない。
 * @concurrency 返すactivateは取得と後着回収の完了まで待つ。
 */
export function createIsolatedHostOperationLockActivationCandidate(
  dependencies: HostOperationLockActivationDependencies,
) {
  return Object.freeze({
    productionAuthority: false as const,
    activate: () => settleHostOperationLockAcquisition(dependencies),
  });
}

/**
 * 所有 Host Operation Generation Lock Readinessを確認する。
 *
 * @responsibility 所有 Host Operation Generation Lock Readinessの確認根拠、成立条件、観測不能境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns confirmOwnedHostOperationGenerationLockReadinessの計算結果を返す。
 * @precondition 「managementCapability: unknown」がconfirmOwnedHostOperationGenerationLockReadinessの入力契約を満たす。
 * @postcondition confirmOwnedHostOperationGenerationLockReadinessの責務を完了した結果だけを返す。
 * @effect N/A: confirmOwnedHostOperationGenerationLockReadinessは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure confirmOwnedHostOperationGenerationLockReadinessは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant confirmOwnedHostOperationGenerationLockReadinessは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: confirmOwnedHostOperationGenerationLockReadinessはProcess内の同一Subsystemで完結する。
 * @security confirmOwnedHostOperationGenerationLockReadinessはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency confirmOwnedHostOperationGenerationLockReadinessは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function confirmOwnedHostOperationGenerationLockReadiness(
  managementCapability: unknown,
) {
  try {
    const before = ownedOperationFromManagementCapability(managementCapability);
    const generation = ownedOperationGeneration(
      before.binding.owned,
      before.identity,
    );
    const lock = generation.generationLock;
    if (!lock) return "cleanup_confirmed_failure" as const;
    const readiness = await lock.confirmReady();
    if (readiness !== "ready") {
      if (readiness === "cleanup_unknown") {
        generation.retired = true;
        revokeOwnedOperationContextCapabilities(generation.owned);
        poisonRuntimeProcessAfterCleanupUnknown();
      } else generation.generationLock = null;
      return readiness;
    }
    const after = ownedOperationFromManagementCapability(managementCapability);
    const current = ownedOperationGeneration(
      after.binding.owned,
      after.identity,
    );
    const isCurrent =
      before.binding.owned === after.binding.owned &&
      current === generation &&
      current.generationLock === lock &&
      current.retired === false;
    if (!isCurrent)
      throw new Error("owned_operation_generation_readiness_replaced");
    validatePrivateHostRecoveryRecord(
      after.identity,
      after.identity.hostRecovery.state,
    );
    return "ready" as const;
  } catch {
    try {
      const { binding, identity } =
        ownedOperationFromManagementCapabilityForCleanup(managementCapability);
      const generation = ownedOperationGeneration(
        binding.owned,
        identity,
        true,
      );
      generation.retired = true;
      revokeOwnedOperationContextCapabilities(generation.owned);
      const lock = generation.generationLock;
      if (!lock) return "cleanup_confirmed_failure" as const;
      const released = await lock.release();
      if (released === "cleanup_unknown") {
        poisonRuntimeProcessAfterCleanupUnknown();
        return "cleanup_unknown" as const;
      }
      generation.generationLock = null;
      return "cleanup_confirmed_failure" as const;
    } catch {
      poisonRuntimeProcessAfterCleanupUnknown();
      return "cleanup_unknown" as const;
    }
  }
}

/**
 * owned Operation From Management Capability For 清掃を決定する。
 *
 * @responsibility owned Operation From Management Capability For 清掃の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns ownedOperationFromManagementCapabilityForCleanupの計算結果を返す。
 * @precondition 「managementCapability: unknown」がownedOperationFromManagementCapabilityForCleanupの入力契約を満たす。
 * @postcondition ownedOperationFromManagementCapabilityForCleanupの責務を完了した結果だけを返す。
 * @effect N/A: ownedOperationFromManagementCapabilityForCleanupは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownedOperationFromManagementCapabilityForCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownedOperationFromManagementCapabilityForCleanupは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownedOperationFromManagementCapabilityForCleanupはProcess内の同一Subsystemで完結する。
 * @security ownedOperationFromManagementCapabilityForCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownedOperationFromManagementCapabilityForCleanupは共有非同期状態を持たない同期処理である。
 */
function ownedOperationFromManagementCapabilityForCleanup(
  managementCapability: unknown,
) {
  const binding = isObject(managementCapability)
    ? (operationManagementCapabilities.get(managementCapability) ?? null)
    : null;
  if (!binding) throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(binding.owned);
  if (!identity) throw new Error("owned_operation_management_binding_required");
  return Object.freeze({ binding, identity });
}

/**
 * 所有 Host Operation Generation Lossを観測する。
 *
 * @responsibility 所有 Host Operation Generation Lossの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns observeOwnedHostOperationGenerationLossの計算結果を返す。
 * @precondition 「managementCapability: unknown」がobserveOwnedHostOperationGenerationLossの入力契約を満たす。
 * @postcondition observeOwnedHostOperationGenerationLossの責務を完了した結果だけを返す。
 * @effect N/A: observeOwnedHostOperationGenerationLossは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeOwnedHostOperationGenerationLossは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeOwnedHostOperationGenerationLossは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeOwnedHostOperationGenerationLossはProcess内の同一Subsystemで完結する。
 * @security observeOwnedHostOperationGenerationLossはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency observeOwnedHostOperationGenerationLossは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function observeOwnedHostOperationGenerationLoss(
  managementCapability: unknown,
) {
  const { binding, identity } =
    ownedOperationFromManagementCapability(managementCapability);
  const generation = ownedOperationGeneration(binding.owned, identity);
  const lock = generation.generationLock;
  if (!lock) throw new Error("owned_operation_generation_lock_required");
  let drainToken: object | null = null;
  let resolveDetected!: () => void;
  const detected = new Promise<void>((resolve) => {
    resolveDetected = resolve;
  });
  lock.onFailureDetected(() => {
    const transition = reduceHostGenerationLossTransition("failure_detected");
    generation.retired = transition.retired;
    if (transition.revokeEffectCapabilities)
      revokeOwnedOperationEffectCapabilities(generation.owned);
    if (transition.beginEffectDrain)
      drainToken ??= beginRuntimeProcessEffectDrain();
    resolveDetected();
  });
  return Object.freeze({
    detected,
    outcome: lock.loss.then((outcome) => {
      const transition = reduceHostGenerationLossTransition(outcome);
      generation.retired = transition.retired;
      generation.lossOutcome = outcome;
      if (transition.revokeEffectCapabilities)
        revokeOwnedOperationEffectCapabilities(generation.owned);
      if (transition.poisonProcess) poisonRuntimeProcessAfterCleanupUnknown();
      return outcome;
    }),
    releaseDrain: () => {
      if (!drainToken) return false;
      const token = drainToken;
      drainToken = null;
      return endRuntimeProcessEffectDrain(token);
    },
  });
}

/**
 * abandon 所有 Host Operation Generation Lockを決定する。
 *
 * @responsibility abandon 所有 Host Operation Generation Lockの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns abandonOwnedHostOperationGenerationLockの計算結果を返す。
 * @precondition 「managementCapability: unknown」がabandonOwnedHostOperationGenerationLockの入力契約を満たす。
 * @postcondition abandonOwnedHostOperationGenerationLockの責務を完了した結果だけを返す。
 * @effect N/A: abandonOwnedHostOperationGenerationLockは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure abandonOwnedHostOperationGenerationLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant abandonOwnedHostOperationGenerationLockは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: abandonOwnedHostOperationGenerationLockはProcess内の同一Subsystemで完結する。
 * @security abandonOwnedHostOperationGenerationLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency abandonOwnedHostOperationGenerationLockは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function abandonOwnedHostOperationGenerationLock(
  managementCapability: unknown,
) {
  try {
    const { binding, identity } =
      ownedOperationFromManagementCapability(managementCapability);
    const state = ownedOperationGeneration(binding.owned, identity, true);
    if (!state.generationLock) return true;
    const released = await state.generationLock.release();
    if (released === "released") {
      state.generationLock = null;
      return true;
    }
    state.retired = true;
    revokeOwnedOperationContextCapabilities(state.owned);
    if (released === "cleanup_unknown")
      poisonRuntimeProcessAfterCleanupUnknown();
    return false;
  } catch {
    return false;
  }
}

/**
 * 所有 Docker Submission By Managementを状態遷移させる。
 *
 * @responsibility 所有 Docker Submission By Managementの遷移前提、次状態、無効遷移の拒否境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown、currentToken: unknown、action: "begin" | "cancel"
 * @returns transitionOwnedDockerSubmissionByManagementの計算結果を返す。
 * @precondition 「managementCapability: unknown、currentToken: unknown、action: "begin" | "cancel"」がtransitionOwnedDockerSubmissionByManagementの入力契約を満たす。
 * @postcondition transitionOwnedDockerSubmissionByManagementの責務を完了した結果だけを返す。
 * @effect N/A: transitionOwnedDockerSubmissionByManagementは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: transitionOwnedDockerSubmissionByManagementは独自の失敗分岐を所有しない。
 * @invariant transitionOwnedDockerSubmissionByManagementは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: transitionOwnedDockerSubmissionByManagementはProcess内の同一Subsystemで完結する。
 * @security transitionOwnedDockerSubmissionByManagementはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: transitionOwnedDockerSubmissionByManagementは共有非同期状態を持たない同期処理である。
 */
function transitionOwnedDockerSubmissionByManagement(
  managementCapability: unknown,
  currentToken: unknown,
  action: "begin" | "cancel",
) {
  const { binding } =
    ownedOperationFromManagementCapability(managementCapability);
  const expectedState =
    action === "begin" ? "host_only" : "docker_submission_started";
  const nextState =
    action === "begin" ? "docker_submission_started" : "host_only";
  const { loaded, state, identity } = activeOwnedTransitionInputsForOwned(
    binding.owned,
    currentToken,
    expectedState,
  );
  const updated = replaceHostRecoveryRecordState(loaded, nextState);
  ownedIdentities.set(
    state.owned,
    Object.freeze({
      ...identity,
      hostRecovery: Object.freeze({
        ...identity.hostRecovery,
        state: nextState,
        recordHash: updated.recordHash,
        recordIdentity: updated.recordIdentity,
      }),
    }),
  );
  state.currentRecordHash = updated.recordHash;
  return updated.token;
}

/**
 * 所有 Docker Submission 回復を開始する。
 *
 * @responsibility 所有 Docker Submission 回復の開始条件、初期状態、開始失敗境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown、operationId: unknown
 * @returns beginOwnedDockerSubmissionRecoveryの計算結果を返す。
 * @precondition 「managementCapability: unknown、operationId: unknown」がbeginOwnedDockerSubmissionRecoveryの入力契約を満たす。
 * @postcondition beginOwnedDockerSubmissionRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: beginOwnedDockerSubmissionRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure beginOwnedDockerSubmissionRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant beginOwnedDockerSubmissionRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: beginOwnedDockerSubmissionRecoveryはProcess内の同一Subsystemで完結する。
 * @security beginOwnedDockerSubmissionRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: beginOwnedDockerSubmissionRecoveryは共有非同期状態を持たない同期処理である。
 */
export function beginOwnedDockerSubmissionRecovery(
  managementCapability: unknown,
  operationId: unknown,
) {
  const { binding, identity } =
    ownedOperationFromManagementCapability(managementCapability);
  if (operationId !== binding.operationId)
    throw new Error("owned_operation_management_binding_required");
  return transitionOwnedDockerSubmissionByManagement(
    managementCapability,
    expectedHostRecoveryToken(identity),
    "begin",
  );
}

/**
 * 所有 Host 回復 Id By Management Capabilityを取得する。
 *
 * @responsibility 所有 Host 回復 Id By Management Capabilityの参照条件、返却値、未検出結果の境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns getOwnedHostRecoveryIdByManagementCapabilityの計算結果を返す。
 * @precondition 「managementCapability: unknown」がgetOwnedHostRecoveryIdByManagementCapabilityの入力契約を満たす。
 * @postcondition getOwnedHostRecoveryIdByManagementCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: getOwnedHostRecoveryIdByManagementCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: getOwnedHostRecoveryIdByManagementCapabilityは独自の失敗分岐を所有しない。
 * @invariant getOwnedHostRecoveryIdByManagementCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: getOwnedHostRecoveryIdByManagementCapabilityはProcess内の同一Subsystemで完結する。
 * @security getOwnedHostRecoveryIdByManagementCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: getOwnedHostRecoveryIdByManagementCapabilityは共有非同期状態を持たない同期処理である。
 */
export function getOwnedHostRecoveryIdByManagementCapability(
  managementCapability: unknown,
) {
  const { identity } =
    ownedOperationFromManagementCapability(managementCapability);
  validatePrivateHostRecoveryRecord(identity, identity.hostRecovery.state);
  return expectedHostRecoveryToken(identity);
}

/**
 * 同じ操作Ownerが保持するHost記録の現在投影を読み取る。
 *
 * @responsibility 任意PathやOS一時Rootの逆算を使わず、所有済みHostの相関を搬送する。
 * @trace ARCH-000008
 * @input managementCapability: 同じProcessで発行済みの操作管理Capability。
 * @returns 検証済みHost Snapshotと、そのOwnerが保持するRoot・Marker Path。
 * @precondition 管理Capabilityが現在の所有者に結合している。
 * @postcondition 記録Hash・実体Identity・現在状態を確認した値だけを返す。
 * @effect 所有済みHost記録とFilesystem metadataの読取りのみ。
 * @failure 未発行Capability、記録差替え、Hash・実体不一致は例外として返す。
 * @invariant 保存・回復・削除のAuthorityを新設しない。
 * @boundary Coordinator内部のHost Ownerから現在状態構築への読取り搬送。
 * @security Pathは所有者由来の観測値であり、呼出し側の任意Pathを受け付けない。
 * @concurrency 読取り前後で現在記録を検証し、保存直前の検証は利用側Writerが行う。
 */
export function borrowOwnedHostRecoverySnapshot(managementCapability: unknown) {
  const { identity } =
    ownedOperationFromManagementCapability(managementCapability);
  const record = validatePrivateHostRecoveryRecord(
    identity,
    identity.hostRecovery.state,
  );
  const directory = fs.lstatSync(identity.root, { bigint: true });
  const marker = fs.lstatSync(identity.hostRecovery.record, { bigint: true });
  if (
    !directory.isDirectory() ||
    directory.isSymbolicLink() ||
    !marker.isFile() ||
    marker.isSymbolicLink()
  )
    throw new Error("host_recovery_record_mismatch");
  validatePrivateHostRecoveryRecord(identity, identity.hostRecovery.state);
  return Object.freeze({
    snapshot: Object.freeze({
      token: expectedHostRecoveryToken(identity),
      recordHash: identity.hostRecovery.recordHash,
      directoryIdentity: `${directory.dev}:${directory.ino}:${directory.birthtimeNs}`,
      markerIdentity: `${marker.dev}:${marker.ino}:${marker.birthtimeNs}`,
      record,
    }),
    hostPaths: Object.freeze({
      root: identity.root,
      marker: identity.hostRecovery.record,
    }),
  });
}

/**
 * 所有 Host 清掃 Capabilityを発行する。
 *
 * @responsibility 所有 Host 清掃 Capabilityの発行条件、Identity、非発行時のEffect 0境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown、subject: unknown
 * @returns issueOwnedHostCleanupCapabilityの計算結果を返す。
 * @precondition 「managementCapability: unknown、subject: unknown」がissueOwnedHostCleanupCapabilityの入力契約を満たす。
 * @postcondition issueOwnedHostCleanupCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: issueOwnedHostCleanupCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure issueOwnedHostCleanupCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant issueOwnedHostCleanupCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: issueOwnedHostCleanupCapabilityはProcess内の同一Subsystemで完結する。
 * @security issueOwnedHostCleanupCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: issueOwnedHostCleanupCapabilityは共有非同期状態を持たない同期処理である。
 */
export function issueOwnedHostCleanupCapability(
  managementCapability: unknown,
  subject: unknown,
) {
  const { binding, identity } =
    ownedOperationFromManagementCapability(managementCapability);
  if (!isObject(subject))
    throw new Error("owned_host_cleanup_subject_required");
  const generation = ownedOperationGeneration(binding.owned, identity);
  validatePrivateHostRecoveryRecord(identity, identity.hostRecovery.state);
  const capability = Object.freeze({});
  hostCleanupCapabilities.set(
    capability,
    Object.freeze({
      owned: binding.owned,
      operationId: binding.operationId,
      createdAt: binding.createdAt,
      root: identity.root,
      nonce: identity.hostRecovery.nonce,
      recordHash: generation.currentRecordHash,
      subject,
    }),
  );
  return capability;
}

/**
 * 所有 Host 回復 Id For 清掃を一回限りで消費する。
 *
 * @responsibility 所有 Host 回復 Id For 清掃の消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
 * @trace ARCH-000008
 * @input cleanupCapability: unknown、subject: unknown
 * @returns consumeOwnedHostRecoveryIdForCleanupの計算結果を返す。
 * @precondition 「cleanupCapability: unknown、subject: unknown」がconsumeOwnedHostRecoveryIdForCleanupの入力契約を満たす。
 * @postcondition consumeOwnedHostRecoveryIdForCleanupの責務を完了した結果だけを返す。
 * @effect N/A: consumeOwnedHostRecoveryIdForCleanupは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure consumeOwnedHostRecoveryIdForCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant consumeOwnedHostRecoveryIdForCleanupは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeOwnedHostRecoveryIdForCleanupはProcess内の同一Subsystemで完結する。
 * @security consumeOwnedHostRecoveryIdForCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeOwnedHostRecoveryIdForCleanupは共有非同期状態を持たない同期処理である。
 */
export function consumeOwnedHostRecoveryIdForCleanup(
  cleanupCapability: unknown,
  subject: unknown,
) {
  const capability = isObject(cleanupCapability) ? cleanupCapability : null;
  const binding = capability
    ? (hostCleanupCapabilities.get(capability) ?? null)
    : null;
  if (!capability || !binding || binding.subject !== subject)
    throw new Error("owned_host_cleanup_capability_required");
  hostCleanupCapabilities.delete(capability);
  const identity = ownedIdentities.get(binding.owned);
  if (
    !identity ||
    identity.operationId !== binding.operationId ||
    identity.createdAt !== binding.createdAt ||
    identity.root !== binding.root ||
    identity.hostRecovery.nonce !== binding.nonce
  )
    throw new Error("owned_host_cleanup_identity_changed");
  const generation = ownedOperationGeneration(binding.owned, identity, true);
  if (
    generation.currentRecordHash !== binding.recordHash ||
    (generation.retired &&
      generation.lossOutcome !== "cleanup_confirmed_failure")
  )
    throw new Error("owned_host_cleanup_generation_unavailable");
  validateOwnedOperationIdentity(binding.owned, identity, true);
  validatePrivateHostRecoveryRecord(identity, identity.hostRecovery.state);
  return expectedHostRecoveryToken(identity);
}

/**
 * 所有 Docker Submission 回復を完了状態へ遷移させる。
 *
 * @responsibility 所有 Docker Submission 回復の完了条件、終了後状態、未完了境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown、recoveryToken: unknown
 * @returns completeOwnedDockerSubmissionRecoveryの計算結果を返す。
 * @precondition 「managementCapability: unknown、recoveryToken: unknown」がcompleteOwnedDockerSubmissionRecoveryの入力契約を満たす。
 * @postcondition completeOwnedDockerSubmissionRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: completeOwnedDockerSubmissionRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: completeOwnedDockerSubmissionRecoveryは独自の失敗分岐を所有しない。
 * @invariant completeOwnedDockerSubmissionRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: completeOwnedDockerSubmissionRecoveryはProcess内の同一Subsystemで完結する。
 * @security completeOwnedDockerSubmissionRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: completeOwnedDockerSubmissionRecoveryは共有非同期状態を持たない同期処理である。
 */
export function completeOwnedDockerSubmissionRecovery(
  managementCapability: unknown,
  recoveryToken: unknown,
) {
  return transitionOwnedDockerSubmissionByManagement(
    managementCapability,
    recoveryToken,
    "cancel",
  );
}

/**
 * 所有 Docker Absence For 回復を確認する。
 *
 * @responsibility 所有 Docker Absence For 回復の確認根拠、成立条件、観測不能境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown、recoveryGenerationCapability: unknown
 * @returns confirmOwnedDockerAbsenceForRecoveryの計算結果を返す。
 * @precondition 「token: unknown、recoveryGenerationCapability: unknown」がconfirmOwnedDockerAbsenceForRecoveryの入力契約を満たす。
 * @postcondition confirmOwnedDockerAbsenceForRecoveryの責務を完了した結果だけを返す。
 * @effect confirmOwnedDockerAbsenceForRecoveryはFilesystemの読取りまたは書込みを実行する。
 * @failure confirmOwnedDockerAbsenceForRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant confirmOwnedDockerAbsenceForRecoveryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security confirmOwnedDockerAbsenceForRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: confirmOwnedDockerAbsenceForRecoveryは共有非同期状態を持たない同期処理である。
 */
export function confirmOwnedDockerAbsenceForRecovery(
  token: unknown,
  recoveryGenerationCapability: unknown = null,
) {
  const generation = isObject(recoveryGenerationCapability)
    ? hostOperationRecoveryGenerations.get(recoveryGenerationCapability)
    : null;
  if (!generation) throw new Error("host_recovery_generation_invalid");
  const loaded = loadHostRecoveryRecord(token, generation.root);
  if (loaded.record.state !== "docker_submission_started")
    throw new Error("host_recovery_state_invalid");
  const root = path.join(loaded.parent, loaded.parsed.rootName);
  verifyHostOperationRecoveryGeneration(
    recoveryGenerationCapability,
    root,
    loaded.parsed.nonce,
  );
  if (operationGenerationByRoot.has(root))
    throw new Error("host_recovery_generation_active");
  if (
    observeFilesystemEntry(root) !== "present" ||
    fs.realpathSync(root) !== root ||
    path.dirname(root) !== loaded.parent ||
    !loaded.record.rootIdentity ||
    !identityMatchesRecord(root, loaded.record.rootIdentity)
  )
    throw new Error("host_recovery_root_replaced");
  const updated = replaceHostRecoveryRecordState(
    loaded,
    "docker_absent_confirmed",
  );
  return updated.token;
}

/**
 * 所有 Host 回復 記録 Transitionを引き継ぐ。
 *
 * @responsibility 所有 Host 回復 記録 Transitionの引継ぎ条件、Identity結合、拒否境界を所有する。
 * @trace ARCH-000008
 * @input mountCapability: unknown、previousToken: unknown、nextToken: unknown
 * @returns N/A: adoptOwnedHostRecoveryRecordTransitionは戻り値を返さない。
 * @precondition 「mountCapability: unknown、previousToken: unknown、nextToken: unknown」がadoptOwnedHostRecoveryRecordTransitionの入力契約を満たす。
 * @postcondition adoptOwnedHostRecoveryRecordTransitionの責務を完了して呼出し元へ制御を戻す。
 * @effect adoptOwnedHostRecoveryRecordTransitionはFilesystemの読取りまたは書込みを実行する。
 * @failure adoptOwnedHostRecoveryRecordTransitionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant adoptOwnedHostRecoveryRecordTransitionは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security adoptOwnedHostRecoveryRecordTransitionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: adoptOwnedHostRecoveryRecordTransitionは共有非同期状態を持たない同期処理である。
 */
export function adoptOwnedHostRecoveryRecordTransition(
  mountCapability: unknown,
  previousToken: unknown,
  nextToken: unknown,
): void {
  const previous = parseHostRecoveryToken(previousToken);
  const mount = isObject(mountCapability)
    ? (mountCapabilities.get(mountCapability) ?? null)
    : null;
  const identity = mount ? ownedIdentities.get(mount.owned) : null;
  if (!mount || !identity)
    throw new Error("owned_operation_mount_capability_required");
  validateOwnedOperationIdentity(mount.owned, identity);
  const loaded = loadHostRecoveryRecord(nextToken, identity.root);
  const root = path.join(loaded.parent, loaded.parsed.rootName);
  const state = operationGenerationByRoot.get(root);
  if (!state || !mount || mount.owned !== state.owned || state.retired)
    throw new Error("owned_operation_mount_capability_required");
  validateOwnedOperationIdentity(state.owned, identity);
  const expectedSerialized = `${JSON.stringify(
    hostRecordContent(identity, "docker_absent_confirmed"),
  )}\n`;
  const expectedRecordHash = createHash("sha256")
    .update(expectedSerialized)
    .digest("hex");
  if (
    previous.rootName !== loaded.parsed.rootName ||
    previous.nonce !== loaded.parsed.nonce ||
    previous.nonce !== state.nonce ||
    previous.recordHash !== state.currentRecordHash ||
    loaded.parsed.recordHash === previous.recordHash ||
    loaded.parsed.recordHash !== expectedRecordHash ||
    loaded.marker !== identity.hostRecovery.record ||
    identity.hostRecovery.state !== "docker_submission_started" ||
    loaded.record.state !== "docker_absent_confirmed"
  )
    throw new Error("host_recovery_generation_mismatch");
  ownedIdentities.set(
    state.owned,
    Object.freeze({
      ...identity,
      hostRecovery: Object.freeze({
        ...identity.hostRecovery,
        state: "docker_absent_confirmed",
        recordHash: loaded.parsed.recordHash,
        recordIdentity: readFileIdentity(loaded.marker),
      }),
    }),
  );
  state.currentRecordHash = loaded.parsed.recordHash;
}

/**
 * Current 所有 Host 記録を読み取る。
 *
 * @responsibility Current 所有 Host 記録の読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input identity: OwnedIdentity
 * @returns Readonly<{ record: HostRecoveryRecord; serialized: string }>を返す。
 * @precondition 「identity: OwnedIdentity」がreadCurrentOwnedHostRecordの入力契約を満たす。
 * @postcondition readCurrentOwnedHostRecordの責務を完了した結果だけを返す。
 * @effect readCurrentOwnedHostRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure readCurrentOwnedHostRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readCurrentOwnedHostRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readCurrentOwnedHostRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readCurrentOwnedHostRecordは共有非同期状態を持たない同期処理である。
 */
function readCurrentOwnedHostRecord(
  identity: OwnedIdentity,
): Readonly<{ record: HostRecoveryRecord; serialized: string }> {
  const metadata = fs.lstatSync(identity.hostRecovery.record);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    !identity.hostRecovery.recordIdentity ||
    !sameFilesystemIdentity(
      readFileIdentity(identity.hostRecovery.record),
      identity.hostRecovery.recordIdentity,
    )
  )
    throw new Error("host_recovery_record_replaced");
  const serialized = fs.readFileSync(identity.hostRecovery.record, "utf8");
  const record: unknown = JSON.parse(serialized);
  const normalized = normalizeHostRecoveryRecord(record);
  if (normalized.rootName !== path.basename(identity.root))
    throw new Error("host_recovery_record_mismatch");
  return { record: normalized, serialized };
}

/**
 * expected Host 回復 Tokenを決定する。
 *
 * @responsibility expected Host 回復 Tokenの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input identity: OwnedIdentity
 * @returns stringを返す。
 * @precondition 「identity: OwnedIdentity」がexpectedHostRecoveryTokenの入力契約を満たす。
 * @postcondition expectedHostRecoveryTokenの責務を完了した結果だけを返す。
 * @effect N/A: expectedHostRecoveryTokenは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: expectedHostRecoveryTokenは独自の失敗分岐を所有しない。
 * @invariant expectedHostRecoveryTokenは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: expectedHostRecoveryTokenはProcess内の同一Subsystemで完結する。
 * @security expectedHostRecoveryTokenはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: expectedHostRecoveryTokenは共有非同期状態を持たない同期処理である。
 */
function expectedHostRecoveryToken(identity: OwnedIdentity): string {
  return `host.${path.basename(identity.root)}.${identity.hostRecovery.nonce}.${identity.hostRecovery.recordHash}`;
}

/**
 * Private Host 回復 記録の契約を検証する。
 *
 * @responsibility Private Host 回復 記録の必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input identity: OwnedIdentity、expectedState: RecoveryState
 * @returns HostRecoveryRecordを返す。
 * @precondition 「identity: OwnedIdentity、expectedState: RecoveryState」がvalidatePrivateHostRecoveryRecordの入力契約を満たす。
 * @postcondition validatePrivateHostRecoveryRecordの責務を完了した結果だけを返す。
 * @effect N/A: validatePrivateHostRecoveryRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validatePrivateHostRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validatePrivateHostRecoveryRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validatePrivateHostRecoveryRecordはProcess内の同一Subsystemで完結する。
 * @security validatePrivateHostRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validatePrivateHostRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function validatePrivateHostRecoveryRecord(
  identity: OwnedIdentity,
  expectedState: RecoveryState,
): HostRecoveryRecord {
  const { record, serialized } = readCurrentOwnedHostRecord(identity);
  const actualHash = createHash("sha256").update(serialized).digest("hex");
  if (
    actualHash !== identity.hostRecovery.recordHash ||
    record.state !== expectedState ||
    identity.hostRecovery.state !== expectedState ||
    record.rootName !== path.basename(identity.root)
  ) {
    throw new Error("host_recovery_record_mismatch");
  }
  if (
    !record.rootIdentity ||
    !identityMatchesRecord(identity.root, record.rootIdentity)
  )
    throw new Error("host_recovery_record_mismatch");
  for (const [name, snapshot] of Object.entries(identity.children ?? {})) {
    const recorded = record.childIdentities?.[name];
    if (!recorded || recorded.pathName !== snapshot.name)
      throw new Error("host_recovery_record_mismatch");
    if (
      BigInt(recorded.dev) !== snapshot.filesystem.dev ||
      BigInt(recorded.ino) !== snapshot.filesystem.ino ||
      BigInt(recorded.birthtimeNs) !== snapshot.filesystem.birthtimeNs
    )
      throw new Error("host_recovery_record_mismatch");
  }
  return record;
}

/**
 * rollback Initializing Operation Directoriesを決定する。
 *
 * @responsibility rollback Initializing Operation Directoriesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns voidを返す。
 * @precondition 「owned: unknown」がrollbackInitializingOperationDirectoriesの入力契約を満たす。
 * @postcondition rollbackInitializingOperationDirectoriesの責務を完了した結果だけを返す。
 * @effect rollbackInitializingOperationDirectoriesはFilesystemの読取りまたは書込みを実行する。
 * @failure rollbackInitializingOperationDirectoriesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant rollbackInitializingOperationDirectoriesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security rollbackInitializingOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: rollbackInitializingOperationDirectoriesは共有非同期状態を持たない同期処理である。
 */
function rollbackInitializingOperationDirectories(owned: unknown): void {
  const identity = ownedIdentity(owned);
  if (identity?.hostRecovery.state !== "initializing") {
    cleanupOwnedOperationDirectories(owned);
    return;
  }
  const realRoot = fs.realpathSync(identity.root);
  if (
    realRoot !== identity.root ||
    fs.realpathSync(identity.parent) !== identity.parent ||
    path.dirname(realRoot) !== identity.parent ||
    !path.basename(realRoot).startsWith(identity.prefix) ||
    !sameFilesystemIdentity(
      readFilesystemIdentity(realRoot),
      identity.filesystem,
    )
  )
    throw new Error("owned_operation_directory_replaced");
  const allowed = new Set([
    "workspace",
    "provider-home",
    "tmp",
    "events",
    "projection",
    "management",
  ]);
  for (const entry of fs.readdirSync(realRoot, { withFileTypes: true })) {
    if (
      !allowed.has(entry.name) ||
      !entry.isDirectory() ||
      entry.isSymbolicLink()
    ) {
      throw new Error("owned_operation_unknown_child");
    }
  }
  fs.rmSync(realRoot, { recursive: true, force: false });
  requireConfirmedAbsent(
    realRoot,
    "owned_operation_directory_cleanup_incomplete",
  );
  if (isObject(owned)) {
    revokeOwnedOperationContextCapabilities(owned);
    ownedIdentities.delete(owned);
  }
  if (
    !revokeOwnedOperationGeneration(identity.root, identity.hostRecovery.nonce)
  )
    throw new Error("owned_operation_generation_release_unconfirmed");
  removeOwnedOperationRecoveryRecord(identity);
}

/**
 * 所有 Mount Capabilityを構築する。
 *
 * @responsibility 所有 Mount Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns Readonly<{ kind: "owned_operation_mounts" }>を返す。
 * @precondition 「owned: unknown」がcreateOwnedMountCapabilityの入力契約を満たす。
 * @postcondition createOwnedMountCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: createOwnedMountCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createOwnedMountCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createOwnedMountCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOwnedMountCapabilityはProcess内の同一Subsystemで完結する。
 * @security createOwnedMountCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedMountCapabilityは共有非同期状態を持たない同期処理である。
 */
export function createOwnedMountCapability(
  owned: unknown,
): Readonly<{ kind: "owned_operation_mounts" }> {
  const identity = ownedIdentity(owned);
  if (!identity?.children || !isObject(owned)) {
    throw new Error("owned_operation_mount_identity_required");
  }
  const children = validateOwnedOperationIdentity(owned, identity);
  const capability = Object.freeze({ kind: "owned_operation_mounts" });
  mountCapabilities.set(capability, Object.freeze({ owned, children }));
  const aliases = operationContextAliases.get(owned) ?? new Set<object>();
  aliases.add(capability);
  operationContextAliases.set(owned, aliases);
  return capability;
}

/**
 * 所有 Mount Capabilityを検証する。
 *
 * @responsibility 所有 Mount Capabilityの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns 上位が所有する全操作Pathを返す。
 * @precondition 「capability: unknown」がverifyOwnedMountCapabilityの入力契約を満たす。
 * @postcondition verifyOwnedMountCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: verifyOwnedMountCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyOwnedMountCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyOwnedMountCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyOwnedMountCapabilityはProcess内の同一Subsystemで完結する。
 * @security verifyOwnedMountCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyOwnedMountCapabilityは共有非同期状態を持たない同期処理である。
 */
export function verifyOwnedMountCapability(
  capability: unknown,
): OperationPaths {
  const mount = isObject(capability)
    ? (mountCapabilities.get(capability) ?? null)
    : null;
  if (!mount) throw new Error("owned_operation_mount_capability_required");
  const identity = ownedIdentities.get(mount.owned);
  if (!identity) throw new Error("owned_operation_mount_capability_required");
  const children = validateOwnedOperationIdentity(mount.owned, identity);
  if (children !== mount.children)
    throw new Error("owned_operation_mount_capability_required");
  return Object.freeze({
    workspace: validateDirectorySnapshot(children.workspace),
    providerHome: validateDirectorySnapshot(children.providerHome),
    tmp: validateDirectorySnapshot(children.tmp),
    events: validateDirectorySnapshot(children.events),
    projection: validateDirectorySnapshot(children.projection),
    management: validateDirectorySnapshot(children.management),
  });
}

/**
 * 所有 Operation Context Capabilityを構築する。
 *
 * @responsibility 所有 Operation Context Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns Readonly<{ kind: "owned_operation_context" }>を返す。
 * @precondition 「owned: unknown」がcreateOwnedOperationContextCapabilityの入力契約を満たす。
 * @postcondition createOwnedOperationContextCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: createOwnedOperationContextCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createOwnedOperationContextCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createOwnedOperationContextCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOwnedOperationContextCapabilityはProcess内の同一Subsystemで完結する。
 * @security createOwnedOperationContextCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedOperationContextCapabilityは共有非同期状態を持たない同期処理である。
 */
export function createOwnedOperationContextCapability(
  owned: unknown,
): Readonly<{ kind: "owned_operation_context" }> {
  const identity = ownedIdentity(owned);
  if (!identity?.children || !isObject(owned)) {
    throw new Error("owned_operation_context_identity_required");
  }
  validateOwnedOperationIdentity(owned, identity);
  const capability = Object.freeze({ kind: "owned_operation_context" });
  operationContextCapabilities.set(
    capability,
    Object.freeze({
      owned,
      operationId: identity.operationId,
      createdAt: identity.createdAt,
    }),
  );
  const aliases = operationContextAliases.get(owned) ?? new Set<object>();
  aliases.add(capability);
  operationContextAliases.set(owned, aliases);
  return capability;
}

/**
 * 所有 Operation Context Capabilityを検証する。
 *
 * @responsibility 所有 Operation Context Capabilityの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns OwnedOperationContextを返す。
 * @precondition 「capability: unknown」がverifyOwnedOperationContextCapabilityの入力契約を満たす。
 * @postcondition verifyOwnedOperationContextCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: verifyOwnedOperationContextCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyOwnedOperationContextCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyOwnedOperationContextCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyOwnedOperationContextCapabilityはProcess内の同一Subsystemで完結する。
 * @security verifyOwnedOperationContextCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyOwnedOperationContextCapabilityは共有非同期状態を持たない同期処理である。
 */
export function verifyOwnedOperationContextCapability(
  capability: unknown,
): OwnedOperationContext {
  const capabilityObject = isObject(capability) ? capability : null;
  const context = capabilityObject
    ? (operationContextCapabilities.get(capabilityObject) ?? null)
    : null;
  if (!context) throw new Error("owned_operation_context_capability_required");
  const identity = ownedIdentities.get(context.owned);
  if (
    !identity?.children ||
    identity.operationId !== context.operationId ||
    identity.createdAt !== context.createdAt
  ) {
    if (capabilityObject) operationContextCapabilities.delete(capabilityObject);
    throw new Error("owned_operation_context_capability_revoked");
  }
  validateOwnedOperationIdentity(context.owned, identity);
  return Object.freeze({
    operationId: context.operationId,
    createdAt: context.createdAt,
  });
}

/**
 * 所有 Operation Management Capabilityを構築する。
 *
 * @responsibility 所有 Operation Management Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input operationContextCapability: unknown、mountCapability: unknown
 * @returns Readonly<{ kind: "owned_operation_management_binding" }>を返す。
 * @precondition 「operationContextCapability: unknown、mountCapability: unknown」がcreateOwnedOperationManagementCapabilityの入力契約を満たす。
 * @postcondition createOwnedOperationManagementCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: createOwnedOperationManagementCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createOwnedOperationManagementCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createOwnedOperationManagementCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOwnedOperationManagementCapabilityはProcess内の同一Subsystemで完結する。
 * @security createOwnedOperationManagementCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedOperationManagementCapabilityは共有非同期状態を持たない同期処理である。
 */
export function createOwnedOperationManagementCapability(
  operationContextCapability: unknown,
  mountCapability: unknown,
): Readonly<{ kind: "owned_operation_management_binding" }> {
  const context = isObject(operationContextCapability)
    ? (operationContextCapabilities.get(operationContextCapability) ?? null)
    : null;
  const mount = isObject(mountCapability)
    ? (mountCapabilities.get(mountCapability) ?? null)
    : null;
  if (!context || !mount || context.owned !== mount.owned)
    throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(context.owned);
  if (!identity) throw new Error("owned_operation_management_binding_required");
  const children = validateOwnedOperationIdentity(context.owned, identity);
  if (
    children !== mount.children ||
    identity.operationId !== context.operationId ||
    identity.createdAt !== context.createdAt
  ) {
    throw new Error("owned_operation_management_binding_required");
  }
  validateDirectorySnapshot(children.management);
  const capability = Object.freeze({
    kind: "owned_operation_management_binding" as const,
  });
  operationManagementCapabilities.set(
    capability,
    Object.freeze({
      owned: context.owned,
      operationId: context.operationId,
      createdAt: context.createdAt,
    }),
  );
  const aliases =
    operationContextAliases.get(context.owned) ?? new Set<object>();
  aliases.add(capability);
  operationContextAliases.set(context.owned, aliases);
  return capability;
}

/**
 * 所有 Operation Management Capabilityを検証する。
 *
 * @responsibility 所有 Operation Management Capabilityの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input capability: unknown
 * @returns OwnedOperationManagementBindingを返す。
 * @precondition 「capability: unknown」がverifyOwnedOperationManagementCapabilityの入力契約を満たす。
 * @postcondition verifyOwnedOperationManagementCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: verifyOwnedOperationManagementCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyOwnedOperationManagementCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyOwnedOperationManagementCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyOwnedOperationManagementCapabilityはProcess内の同一Subsystemで完結する。
 * @security verifyOwnedOperationManagementCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyOwnedOperationManagementCapabilityは共有非同期状態を持たない同期処理である。
 */
export function verifyOwnedOperationManagementCapability(
  capability: unknown,
): OwnedOperationManagementBinding {
  const binding = isObject(capability)
    ? (operationManagementCapabilities.get(capability) ?? null)
    : null;
  if (!binding) throw new Error("owned_operation_management_binding_required");
  const identity = ownedIdentities.get(binding.owned);
  if (
    !identity ||
    identity.operationId !== binding.operationId ||
    identity.createdAt !== binding.createdAt
  ) {
    throw new Error("owned_operation_management_binding_required");
  }
  validateOwnedOperationIdentity(binding.owned, identity);
  return Object.freeze({
    operationId: binding.operationId,
    createdAt: binding.createdAt,
    managementScopeBound: true as const,
  });
}

/**
 * 消費した完全選定を既存Operation Ownerへ結合する。
 * @responsibility Executorへ保存元を渡さず同じOwnerで保存Identityを維持する。
 * @trace ARCH-000015
 * @input 現在の管理参照、選定ID、完全選定と試行番号。
 * @returns 元Ownerへの結合が成立した場合だけtrue。
 * @precondition 上位の選定Capability消費後に呼ぶ。
 * @postcondition 既存WeakMapの同じ管理recordの固定五用途だけに不変値を保持する。
 * @effect Process内の既存recordを更新する。保存・資源取得なし。
 * @failure 別Owner・不正値・異なる再結合はfalse。
 * @invariant 新しいMap・永続状態・Authorityを追加しない。
 * @boundary Coordinator内の選定OwnerとOperation保存Owner。
 * @security 選定Hashを権限へ変換しない。
 * @concurrency 同期結合しOperationの既存失効と共に解放する。
 */
export function bindOwnedOperationExecutionSelection(
  management: unknown,
  selectionRecordId: string,
  candidate: unknown,
  taskAttempt: 0 | 1,
): boolean {
  try {
    verifyOwnedOperationManagementCapability(management);
    const binding = operationManagementCapabilities.get(management as object);
    const selection = inspectExecutionSelection(candidate);
    const selectionHash = hashExecutionSelection(selection);
    if (
      !binding ||
      !selection ||
      !selectionHash ||
      !/^MODELSEL-[A-Z0-9-]{8,80}$/u.test(selectionRecordId) ||
      (taskAttempt !== 0 && taskAttempt !== 1)
    )
      return false;
    const slot =
      selection.purpose === "advice" &&
      selection.role === "advice" &&
      taskAttempt === 0
        ? "advice0"
        : selection.purpose === "task" && selection.role === "executor"
          ? taskAttempt === 0
            ? "executor0"
            : "executor1"
          : selection.purpose === "task" &&
              selection.role === "independent_reviewer"
            ? taskAttempt === 0
              ? "reviewer0"
              : "reviewer1"
            : null;
    if (!slot) return false;
    const next = Object.freeze({
      selectionRecordId,
      selection,
      selectionHash,
      taskAttempt,
    });
    if (binding.executionSelections?.[slot])
      return (
        JSON.stringify(binding.executionSelections[slot]) ===
        JSON.stringify(next)
      );
    operationManagementCapabilities.set(
      management as object,
      Object.freeze({
        ...binding,
        executionSelections: Object.freeze({
          ...binding.executionSelections,
          [slot]: next,
        }),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * 元Operationに結合した完全選定だけを保存Ownerへ貸し出す。
 * @responsibility 管理参照・選定ID・完全Hash・試行番号・exact六技術項目の一致を要求する。
 * @trace ARCH-000015
 * @input 現在の管理参照と技術計画の非Authority相関。
 * @returns 元の完全選定又はnull。
 * @precondition 同じOperation Ownerが現在も有効である。
 * @postcondition 下位から完全選定を再受理しない。
 * @effect 元OwnerのFilesystem実体確認だけ。
 * @failure 欠測・失効・別相関はnull。
 * @invariant 記録を新しい実行許可へ昇格しない。
 * @boundary Coordinatorの実行と保存Identityの組立て。
 * @security 公開Rootへ返却しない。
 * @concurrency 同期借用。新しい排他を作らない。
 */
export function borrowOwnedOperationExecutionSelection(
  management: unknown,
  selectionRecordId: string,
  selectionHash: string,
  taskAttempt: 0 | 1,
  technicalSelection: unknown,
) {
  try {
    verifyOwnedOperationManagementCapability(management);
    const keys = new Set([
      "provider",
      "modelIdentifier",
      "identifierKind",
      "reasoningEffort",
      "purpose",
      "role",
    ]);
    const technical = snapshotPlainRecord(technicalSelection, keys);
    if (!technical || Object.keys(technical).length !== keys.size) return null;
    const selections = operationManagementCapabilities.get(
      management as object,
    )?.executionSelections;
    for (const value of Object.values(selections ?? {})) {
      if (
        value.selectionRecordId === selectionRecordId &&
        value.selectionHash === selectionHash &&
        value.taskAttempt === taskAttempt &&
        [...keys].every(
          (key) =>
            technical[key] === value.selection[key as keyof ExecutionSelection],
        )
      )
        return value.selection;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 所有 Operation Management Mount Bindingを検証する。
 *
 * @responsibility 所有 Operation Management Mount Bindingの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown、mountCapability: unknown
 * @returns 操作ID、作成時刻と上位の全操作Pathを返す。
 * @precondition 「managementCapability: unknown、mountCapability: unknown」がverifyOwnedOperationManagementMountBindingの入力契約を満たす。
 * @postcondition verifyOwnedOperationManagementMountBindingの責務を完了した結果だけを返す。
 * @effect N/A: verifyOwnedOperationManagementMountBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyOwnedOperationManagementMountBindingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyOwnedOperationManagementMountBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyOwnedOperationManagementMountBindingはProcess内の同一Subsystemで完結する。
 * @security verifyOwnedOperationManagementMountBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyOwnedOperationManagementMountBindingは共有非同期状態を持たない同期処理である。
 */
export function verifyOwnedOperationManagementMountBinding(
  managementCapability: unknown,
  mountCapability: unknown,
): Readonly<{
  operationId: string;
  createdAt: string;
  mounts: OperationPaths;
}> {
  const management = isObject(managementCapability)
    ? (operationManagementCapabilities.get(managementCapability) ?? null)
    : null;
  const mount = isObject(mountCapability)
    ? (mountCapabilities.get(mountCapability) ?? null)
    : null;
  if (!management || !mount || management.owned !== mount.owned) {
    throw new Error("owned_operation_management_mount_binding_required");
  }
  const identity = ownedIdentities.get(management.owned);
  if (
    !identity ||
    identity.operationId !== management.operationId ||
    identity.createdAt !== management.createdAt
  ) {
    throw new Error("owned_operation_management_mount_binding_required");
  }
  const children = validateOwnedOperationIdentity(management.owned, identity);
  if (children !== mount.children) {
    throw new Error("owned_operation_management_mount_binding_required");
  }
  return Object.freeze({
    operationId: management.operationId,
    createdAt: management.createdAt,
    mounts: Object.freeze({
      workspace: validateDirectorySnapshot(children.workspace),
      providerHome: validateDirectorySnapshot(children.providerHome),
      tmp: validateDirectorySnapshot(children.tmp),
      events: validateDirectorySnapshot(children.events),
      projection: validateDirectorySnapshot(children.projection),
      management: validateDirectorySnapshot(children.management),
    }),
  });
}

/**
 * 所有 Docker Execution Pathsを一時参照として取得する。
 *
 * @responsibility 所有 Docker Execution Pathsの参照条件、lifetime、所有権を移さない境界を所有する。
 * @trace ARCH-000008
 * @input managementCapability: unknown
 * @returns Readonly<{ tmp: string; management: string }>を返す。
 * @precondition 「managementCapability: unknown」がborrowOwnedDockerExecutionPathsの入力契約を満たす。
 * @postcondition borrowOwnedDockerExecutionPathsの責務を完了した結果だけを返す。
 * @effect N/A: borrowOwnedDockerExecutionPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure borrowOwnedDockerExecutionPathsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant borrowOwnedDockerExecutionPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: borrowOwnedDockerExecutionPathsはProcess内の同一Subsystemで完結する。
 * @security borrowOwnedDockerExecutionPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: borrowOwnedDockerExecutionPathsは共有非同期状態を持たない同期処理である。
 */
export function borrowOwnedDockerExecutionPaths(
  managementCapability: unknown,
): Readonly<{ tmp: string; management: string }> {
  const { binding } =
    ownedOperationFromManagementCapability(managementCapability);
  const identity = ownedIdentities.get(binding.owned);
  if (!identity?.children)
    throw new Error("owned_operation_management_binding_required");
  const children = validateOwnedOperationIdentity(binding.owned, identity);
  return Object.freeze({
    tmp: validateDirectorySnapshot(children.tmp),
    management: validateDirectorySnapshot(children.management),
  });
}

/**
 * 所有 Child Setの契約を検証する。
 *
 * @responsibility 所有 Child Setの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input root: string、children: ChildSnapshots
 * @returns N/A: validateOwnedChildSetは戻り値を返さない。
 * @precondition 「root: string、children: ChildSnapshots」がvalidateOwnedChildSetの入力契約を満たす。
 * @postcondition validateOwnedChildSetの責務を完了して呼出し元へ制御を戻す。
 * @effect validateOwnedChildSetはFilesystemの読取りまたは書込みを実行する。
 * @failure validateOwnedChildSetは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateOwnedChildSetは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validateOwnedChildSetはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateOwnedChildSetは共有非同期状態を持たない同期処理である。
 */
function validateOwnedChildSet(root: string, children: ChildSnapshots): void {
  const known = new Set(
    Object.values(children).map((snapshot) => snapshot.name),
  );
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!known.has(entry.name))
      throw new Error("owned_operation_unknown_child");
  }
  for (const snapshot of Object.values(children)) {
    try {
      const metadata = fs.lstatSync(snapshot.root);
      if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error("owned_operation_child_replaced");
      validateDirectorySnapshot(snapshot);
    } catch (error) {
      if (errorCode(error) === "ENOENT") continue;
      const message = errorMessage(error);
      if (
        message &&
        [
          "owned_operation_child_replaced",
          "owned_operation_mount_replaced",
        ].includes(message)
      )
        throw new Error("owned_operation_child_replaced");
      throw error;
    }
  }
}

/**
 * require No Active Docker Bindingを決定する。
 *
 * @responsibility require No Active Docker Bindingの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input root: string、managementName: string | undefined
 * @returns voidを返す。
 * @precondition 「root: string、managementName: string | undefined」がrequireNoActiveDockerBindingの入力契約を満たす。
 * @postcondition requireNoActiveDockerBindingの責務を完了した結果だけを返す。
 * @effect N/A: requireNoActiveDockerBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireNoActiveDockerBindingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireNoActiveDockerBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireNoActiveDockerBindingはProcess内の同一Subsystemで完結する。
 * @security requireNoActiveDockerBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: requireNoActiveDockerBindingは共有非同期状態を持たない同期処理である。
 */
function requireNoActiveDockerBinding(
  root: string,
  managementName: string | undefined,
): void {
  if (!managementName) return;
  const activeDockerBinding = path.join(
    root,
    managementName,
    "active-docker-task-v1.json",
  );
  for (const candidate of [
    activeDockerBinding,
    `${activeDockerBinding}.crdd-commit.json`,
  ]) {
    const observation = observeFilesystemEntry(candidate);
    if (observation === "unknown")
      throw new Error("host_recovery_root_observation_unknown");
    if (observation === "present")
      throw new Error("host_recovery_requires_docker_absence");
  }
}

/**
 * 所有 Operation Root For 清掃を除去する。
 *
 * @responsibility 所有 Operation Root For 清掃の対象Identity、除去条件、終了後状態の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns removeOwnedOperationRootForCleanupの計算結果を返す。
 * @precondition 「owned: unknown」がremoveOwnedOperationRootForCleanupの入力契約を満たす。
 * @postcondition removeOwnedOperationRootForCleanupの責務を完了した結果だけを返す。
 * @effect removeOwnedOperationRootForCleanupはFilesystemの読取りまたは書込みを実行する。
 * @failure removeOwnedOperationRootForCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant removeOwnedOperationRootForCleanupは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security removeOwnedOperationRootForCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: removeOwnedOperationRootForCleanupは共有非同期状態を持たない同期処理である。
 */
function removeOwnedOperationRootForCleanup(owned: unknown) {
  const identity = ownedIdentity(owned);
  if (!identity) {
    throw new Error("owned_operation_directory_identity_required");
  }
  try {
    if (!isObject(owned)) throw new Error("owned_operation_directory_replaced");
    ownedOperationGeneration(owned, identity, true);
    if (
      ownString(owned, "root") !== identity.root ||
      ownString(owned, "parent") !== identity.parent
    ) {
      throw new Error("owned_operation_directory_replaced");
    }
    const realRoot = fs.realpathSync(identity.root);
    const realParent = fs.realpathSync(identity.parent);
    const currentFilesystem = readFilesystemIdentity(identity.root);
    if (
      realRoot !== identity.root ||
      realParent !== identity.parent ||
      path.dirname(realRoot) !== realParent ||
      !path.basename(realRoot).startsWith(identity.prefix) ||
      !sameFilesystemIdentity(currentFilesystem, identity.filesystem)
    ) {
      throw new Error("owned_operation_directory_replaced");
    }
    if (identity.children)
      validateOwnedChildSet(identity.root, identity.children);
    requireNoActiveDockerBinding(
      identity.root,
      identity.children?.management.name,
    );
  } catch (error) {
    const message = errorMessage(error);
    if (
      isObject(owned) &&
      message &&
      [
        "owned_operation_directory_replaced",
        "owned_operation_child_replaced",
      ].includes(message)
    ) {
      retireOwnedOperationGeneration(
        identity.root,
        identity.hostRecovery.nonce,
      );
    }
    if (
      message &&
      [
        "owned_operation_directory_replaced",
        "owned_operation_child_replaced",
        "owned_operation_unknown_child",
        "host_recovery_requires_docker_absence",
        "host_recovery_root_observation_unknown",
      ].includes(message)
    )
      throw error;
    throw new Error("owned_operation_directory_replaced");
  }
  validatePrivateHostRecoveryRecord(identity, "host_only");
  fs.rmSync(identity.root, { recursive: true, force: false });
  requireConfirmedAbsent(
    identity.root,
    "owned_operation_directory_cleanup_incomplete",
  );
  return identity;
}

/**
 * 所有 Operation 回復 記録を除去する。
 *
 * @responsibility 所有 Operation 回復 記録の対象Identity、除去条件、終了後状態の境界を所有する。
 * @trace ARCH-000008
 * @input identity: OwnedIdentity
 * @returns N/A: removeOwnedOperationRecoveryRecordは戻り値を返さない。
 * @precondition 「identity: OwnedIdentity」がremoveOwnedOperationRecoveryRecordの入力契約を満たす。
 * @postcondition removeOwnedOperationRecoveryRecordの責務を完了して呼出し元へ制御を戻す。
 * @effect removeOwnedOperationRecoveryRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure removeOwnedOperationRecoveryRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant removeOwnedOperationRecoveryRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security removeOwnedOperationRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: removeOwnedOperationRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function removeOwnedOperationRecoveryRecord(identity: OwnedIdentity) {
  try {
    const recoveryDirectory = fs.realpathSync(identity.hostRecovery.directory);
    if (
      !sameFilesystemIdentity(
        readFilesystemIdentity(recoveryDirectory),
        identity.hostRecovery.directoryIdentity,
      )
    )
      throw new Error("host_recovery_directory_replaced");
    const marker = fs.lstatSync(identity.hostRecovery.record);
    if (
      !marker.isFile() ||
      marker.isSymbolicLink() ||
      !identity.hostRecovery.recordIdentity ||
      !sameFilesystemIdentity(
        readFileIdentity(identity.hostRecovery.record),
        identity.hostRecovery.recordIdentity,
      )
    )
      throw new Error("host_recovery_record_replaced");
    fs.rmSync(identity.hostRecovery.record);
    requireConfirmedAbsent(
      identity.hostRecovery.record,
      "host_recovery_record_observation_unknown",
    );
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }
}

/**
 * 所有 Operation Directories Asyncを清掃する。
 *
 * @responsibility 所有 Operation Directories Asyncの清掃対象、完了観測、残存時の失敗境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns cleanupOwnedOperationDirectoriesAsyncの計算結果を返す。
 * @precondition 「owned: unknown」がcleanupOwnedOperationDirectoriesAsyncの入力契約を満たす。
 * @postcondition cleanupOwnedOperationDirectoriesAsyncの責務を完了した結果だけを返す。
 * @effect N/A: cleanupOwnedOperationDirectoriesAsyncは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure cleanupOwnedOperationDirectoriesAsyncは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant cleanupOwnedOperationDirectoriesAsyncは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cleanupOwnedOperationDirectoriesAsyncはProcess内の同一Subsystemで完結する。
 * @security cleanupOwnedOperationDirectoriesAsyncはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency cleanupOwnedOperationDirectoriesAsyncは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function cleanupOwnedOperationDirectoriesAsync(owned: unknown) {
  const identity = removeOwnedOperationRootForCleanup(owned);
  const release = await revokeOwnedOperationGenerationAsync(
    identity.root,
    identity.hostRecovery.nonce,
  );
  if (release === "cleanup_unknown")
    throw new Error("owned_operation_generation_release_unconfirmed");
  removeOwnedOperationRecoveryRecord(identity);
  if (release === "cleanup_confirmed_failure")
    return createOwnedOperationCleanupOutcome(
      "protocol_failure_cleanup_confirmed",
      owned,
      identity,
    );
  return createOwnedOperationCleanupOutcome("completed", owned, identity);
}

/**
 * execution-environmentで使用する所有 Operation 清掃 Statusの値契約を定義する。
 *
 * @responsibility 所有 Operation 清掃 StatusのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedOperationCleanupStatusが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedOperationCleanupStatusで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedOperationCleanupStatusの宣言は外部境界を開かない。
 * @security OwnedOperationCleanupStatusはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedOperationCleanupStatusの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type OwnedOperationCleanupStatus =
  | "completed"
  | "protocol_failure_cleanup_confirmed";

const ownedOperationCleanupOutcomes = new WeakMap<
  object,
  Readonly<{
    status: OwnedOperationCleanupStatus;
    owned: unknown;
    operationId: string;
    root: string;
    nonce: string;
  }>
>();

/**
 * 所有 Operation 清掃 Outcomeを構築する。
 *
 * @responsibility 所有 Operation 清掃 Outcomeの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input status: 清掃結果、owned: 実際の対象、identity: 清掃前に検証した内部Identity。
 * @returns createOwnedOperationCleanupOutcomeの計算結果を返す。
 * @precondition 「status: OwnedOperationCleanupStatus」がcreateOwnedOperationCleanupOutcomeの入力契約を満たす。
 * @postcondition createOwnedOperationCleanupOutcomeの責務を完了した結果だけを返す。
 * @effect N/A: createOwnedOperationCleanupOutcomeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createOwnedOperationCleanupOutcomeは独自の失敗分岐を所有しない。
 * @invariant createOwnedOperationCleanupOutcomeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOwnedOperationCleanupOutcomeはProcess内の同一Subsystemで完結する。
 * @security createOwnedOperationCleanupOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOwnedOperationCleanupOutcomeは共有非同期状態を持たない同期処理である。
 */
function createOwnedOperationCleanupOutcome(
  status: OwnedOperationCleanupStatus,
  owned: unknown,
  identity: OwnedIdentity,
) {
  const outcome = Object.freeze({ kind: "owned_operation_cleanup_outcome" });
  ownedOperationCleanupOutcomes.set(
    outcome,
    Object.freeze({
      status,
      owned,
      operationId: identity.operationId,
      root: identity.root,
      nonce: identity.hostRecovery.nonce,
    }),
  );
  return outcome;
}

/**
 * 所有 Operation 清掃 Outcomeを検証する。
 *
 * @responsibility 所有 Operation 清掃 Outcomeの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input outcome: 真正な清掃結果、expectedOwned: 指定した場合は同じ清掃対象を要求する。
 * @returns OwnedOperationCleanupStatus | nullを返す。
 * @precondition 「outcome: unknown」がverifyOwnedOperationCleanupOutcomeの入力契約を満たす。
 * @postcondition verifyOwnedOperationCleanupOutcomeの責務を完了した結果だけを返す。
 * @effect N/A: verifyOwnedOperationCleanupOutcomeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyOwnedOperationCleanupOutcomeは独自の失敗分岐を所有しない。
 * @invariant 結果に保持した操作・Root・nonce結合を失わず、別対象の真正結果を一致へ分類しない。
 * @boundary N/A: verifyOwnedOperationCleanupOutcomeはProcess内の同一Subsystemで完結する。
 * @security verifyOwnedOperationCleanupOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyOwnedOperationCleanupOutcomeは共有非同期状態を持たない同期処理である。
 */
export function verifyOwnedOperationCleanupOutcome(
  outcome: unknown,
  expectedOwned?: unknown,
): OwnedOperationCleanupStatus | null {
  const record = isObject(outcome)
    ? ownedOperationCleanupOutcomes.get(outcome)
    : null;
  return record &&
    (expectedOwned === undefined || record.owned === expectedOwned)
    ? record.status
    : null;
}

/**
 * 清掃前Ownerから同じ操作の清掃結果照合を固定する。
 * @responsibility Owner失効後も元操作・Root・nonceに一致する真正結果だけを受理する。
 * @trace ARCH-000008
 * @input managementCapability: 清掃前に有効な管理Owner。
 * @returns 真正結果の内部照合関数、またはnull。
 * @precondition 同じHost操作Ownerが有効である。
 * @postcondition 返却関数はProvider・Filesystem処置を許可しない。
 * @effect 準備時のHost Identity検証だけ。
 * @failure 不正・失効Ownerはnull。別結果は照合null。
 * @invariant Root・nonce・操作IDを利用側入力から再構成しない。
 * @boundary Host清掃Ownerから終端保存の結果照合。
 * @security Path・内部Identityを公開しない。
 * @concurrency 保存Ownerが清掃前に取得して同じAttemptで使用する。
 */
export function captureOwnedOperationCleanupVerification(
  managementCapability: unknown,
) {
  try {
    verifyOwnedOperationManagementCapability(managementCapability);
    const binding = isObject(managementCapability)
      ? operationManagementCapabilities.get(managementCapability)
      : null;
    const identity = binding ? ownedIdentities.get(binding.owned) : null;
    if (!binding || !identity) return null;
    /**
     * 固定した元操作へ真正清掃結果を照合する。
     * @responsibility 失効後も対象の取り違えを拒否する。
     * @trace ARCH-000008
     * @input outcome: 清掃Ownerのopaque結果。
     * @returns 同じ対象の清掃statusだけ、またはnull。
     * @precondition 清掃前の照合Context内で使用する。
     * @postcondition 別対象や偽造結果は受理しない。
     * @effect N/A: 内部WeakMapの照合だけ。
     * @failure 不一致はnull。
     * @invariant 既知の操作・Root・nonceを変更しない。
     * @boundary Host結果と終端保存。
     * @security 新しい処置Authorityを発行しない。
     * @concurrency N/A: 同期の値照合だけ。
     */
    return (outcome: unknown) => {
      const record = isObject(outcome)
        ? ownedOperationCleanupOutcomes.get(outcome)
        : null;
      return record &&
        record.owned === binding.owned &&
        record.operationId === identity.operationId &&
        record.root === identity.root &&
        record.nonce === identity.hostRecovery.nonce
        ? record.status
        : null;
    };
  } catch {
    return null;
  }
}

/**
 * Host 回復 記録を読み込む。
 *
 * @responsibility Host 回復 記録の読取り元、Schema検証、読取不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns Readonly<{ parsed: Readonly<{ rootName: string; nonce: string; recordHash: string }>; parent: string; recovery: Readonly<{ directory: string }>; marker: string; record: HostRecoveryRecord; }>を返す。
 * @precondition 「token: unknown」がloadHostRecoveryRecordの入力契約を満たす。
 * @postcondition loadHostRecoveryRecordの責務を完了した結果だけを返す。
 * @effect N/A: loadHostRecoveryRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: loadHostRecoveryRecordは独自の失敗分岐を所有しない。
 * @invariant loadHostRecoveryRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: loadHostRecoveryRecordはProcess内の同一Subsystemで完結する。
 * @security loadHostRecoveryRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: loadHostRecoveryRecordは共有非同期状態を持たない同期処理である。
 */
function loadHostRecoveryRecord(
  token: unknown,
  expectedRoot: unknown,
): Readonly<{
  parsed: Readonly<{ rootName: string; nonce: string; recordHash: string }>;
  parent: string;
  recovery: Readonly<{ directory: string }>;
  marker: string;
  record: HostRecoveryRecord;
}> {
  const loaded = loadHostRecoveryRecordByToken(token, expectedRoot);
  return {
    parsed: loaded.parsed,
    parent: loaded.parent,
    recovery: { directory: loaded.directory },
    marker: loaded.marker,
    record: normalizeHostRecoveryRecord(loaded.record),
  };
}

/**
 * recover 所有 Operation Directoriesを決定する。
 *
 * @responsibility recover 所有 Operation Directoriesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input token: exact参照、suppliedRecoveryGenerationCapability: 既存世代Owner、expectedRoot: 世代Ownerを渡さない場合の固定Root。
 * @returns Readonly<{ status: "recovered" | "blocked"; reason: string; recoveryId: string | null; }>を返す。
 * @precondition 「token: unknown、suppliedRecoveryGenerationCapability: unknown」がrecoverOwnedOperationDirectoriesの入力契約を満たす。
 * @postcondition recoverOwnedOperationDirectoriesの責務を完了した結果だけを返す。
 * @effect recoverOwnedOperationDirectoriesはFilesystemの読取りまたは書込みを実行する。
 * @failure recoverOwnedOperationDirectoriesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant recoverOwnedOperationDirectoriesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security recoverOwnedOperationDirectoriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoverOwnedOperationDirectoriesは共有非同期状態を持たない同期処理である。
 */
export function recoverOwnedOperationDirectories(
  token: unknown,
  suppliedRecoveryGenerationCapability: unknown = null,
  expectedRoot: unknown = null,
): Readonly<{
  status: "recovered" | "blocked";
  reason: string;
  recoveryId: string | null;
}> {
  let recoveryGeneration: Readonly<{ root: string; nonce: string }> | null =
    null;
  let verifiedRecoveryId: string | null = null;
  let markerPendingAfterRelease: string | null = null;
  const ownedRecoveryGenerationCapability = suppliedRecoveryGenerationCapability
    ? null
    : acquireHostOperationRecoveryGeneration(token, expectedRoot);
  const recoveryGenerationCapability =
    suppliedRecoveryGenerationCapability ?? ownedRecoveryGenerationCapability;
  const result = (() => {
    try {
      const generation = isObject(recoveryGenerationCapability)
        ? hostOperationRecoveryGenerations.get(recoveryGenerationCapability)
        : null;
      if (!generation) throw new Error("host_recovery_generation_invalid");
      if (expectedRoot !== null && expectedRoot !== generation.root)
        throw new Error("host_recovery_root_mismatch");
      verifyHostOperationRecoveryGeneration(
        recoveryGenerationCapability,
        generation.root,
        parseHostRecoveryToken(token).nonce,
      );
      const { parsed, parent, marker, record } = loadHostRecoveryRecord(
        token,
        generation.root,
      );
      verifiedRecoveryId = typeof token === "string" ? token : null;
      if (record.state === "docker_submission_started")
        throw new Error("host_recovery_requires_docker_absence");
      if (
        !["initializing", "host_only", "docker_absent_confirmed"].includes(
          record.state,
        )
      )
        throw new Error("host_recovery_state_invalid");
      const root = path.join(parent, parsed.rootName);
      recoveryGeneration = Object.freeze({ root, nonce: parsed.nonce });
      verifyHostOperationRecoveryGeneration(
        recoveryGenerationCapability,
        root,
        parsed.nonce,
      );
      const activeGeneration = operationGenerationByRoot.get(root);
      if (
        activeGeneration &&
        (activeGeneration.nonce !== parsed.nonce ||
          activeGeneration.currentRecordHash !== parsed.recordHash)
      )
        throw new Error("host_recovery_generation_mismatch");
      let reason = "host_root_already_absent";
      const rootObservation = observeFilesystemEntry(root);
      if (rootObservation === "unknown")
        throw new Error("host_recovery_root_observation_unknown");
      if (record.state === "initializing" && rootObservation === "present")
        throw new Error("host_recovery_initialization_root_identity_unknown");
      if (rootObservation === "present") {
        if (
          fs.realpathSync(root) !== root ||
          path.dirname(root) !== parent ||
          !record.rootIdentity ||
          !identityMatchesRecord(root, record.rootIdentity)
        )
          throw new Error("host_recovery_root_replaced");
        const known = new Set(
          Object.values(record.childIdentities).map((child) => child.pathName),
        );
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
          if (!known.has(entry.name))
            throw new Error("host_recovery_unknown_child");
        }
        for (const child of Object.values(record.childIdentities)) {
          const target = path.join(root, child.pathName);
          try {
            const metadata = fs.lstatSync(target);
            if (
              !metadata.isDirectory() ||
              metadata.isSymbolicLink() ||
              fs.realpathSync(target) !== target ||
              path.dirname(target) !== root ||
              !identityMatchesRecord(target, child)
            )
              throw new Error("host_recovery_child_replaced");
          } catch (error) {
            if (errorCode(error) === "ENOENT") continue;
            throw error;
          }
        }
        requireNoActiveDockerBinding(
          root,
          record.childIdentities.management?.pathName,
        );
        fs.rmSync(root, { recursive: true, force: false });
        requireConfirmedAbsent(root, "host_recovery_cleanup_incomplete");
        reason = "host_cleanup_recovered";
      }
      if (!revokeOwnedOperationGeneration(root, parsed.nonce))
        throw new Error("host_recovery_generation_release_unconfirmed");
      if (ownedRecoveryGenerationCapability) markerPendingAfterRelease = marker;
      else fs.rmSync(marker);
      return { status: "recovered" as const, reason, recoveryId: null };
    } catch (error) {
      const allowed = new Set([
        "host_recovery_token_invalid",
        "host_recovery_record_replaced",
        "host_recovery_record_mismatch",
        "host_recovery_requires_docker_absence",
        "host_recovery_state_invalid",
        "host_recovery_root_replaced",
        "host_recovery_child_replaced",
        "host_recovery_unknown_child",
        "host_recovery_cleanup_incomplete",
        "host_recovery_root_observation_unknown",
        "host_recovery_initialization_root_identity_unknown",
        "host_recovery_generation_mismatch",
        "host_recovery_generation_active",
        "host_recovery_generation_release_unconfirmed",
      ]);
      const message = errorMessage(error);
      if (
        recoveryGeneration &&
        message &&
        [
          "host_recovery_root_replaced",
          "host_recovery_child_replaced",
        ].includes(message)
      ) {
        const { root, nonce } = recoveryGeneration;
        retireOwnedOperationGeneration(root, nonce);
      }
      return {
        status: "blocked" as const,
        reason:
          message && allowed.has(message) ? message : "host_recovery_failed",
        recoveryId: verifiedRecoveryId,
      };
    }
  })();
  if (
    ownedRecoveryGenerationCapability &&
    !releaseHostOperationRecoveryGeneration(ownedRecoveryGenerationCapability)
  )
    return {
      status: "blocked",
      reason: "host_recovery_generation_release_unconfirmed",
      recoveryId: verifiedRecoveryId,
    };
  if (result.status === "recovered" && markerPendingAfterRelease) {
    try {
      const markerObservation = observeFilesystemEntry(
        markerPendingAfterRelease,
      );
      if (markerObservation === "unknown")
        throw new Error("host_recovery_record_observation_unknown");
      if (markerObservation === "present") {
        const loaded = loadHostRecoveryRecord(token, recoveryGeneration?.root);
        if (loaded.marker !== markerPendingAfterRelease)
          throw new Error("host_recovery_record_replaced");
        fs.rmSync(markerPendingAfterRelease);
        requireConfirmedAbsent(
          markerPendingAfterRelease,
          "host_recovery_record_observation_unknown",
        );
      }
    } catch {
      return {
        status: "blocked",
        reason: "host_recovery_record_replaced",
        recoveryId: verifiedRecoveryId,
      };
    }
  }
  return result;
}

/**
 * Provider Environmentを構築する。
 *
 * @responsibility Provider Environmentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input baseEnvironment: unknown、directories: OperationDirectories
 * @returns Record<string, string>を返す。
 * @precondition 「baseEnvironment: unknown、directories: OperationDirectories」がcreateProviderEnvironmentの入力契約を満たす。
 * @postcondition createProviderEnvironmentの責務を完了した結果だけを返す。
 * @effect N/A: createProviderEnvironmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createProviderEnvironmentは独自の失敗分岐を所有しない。
 * @invariant createProviderEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createProviderEnvironmentはProcess内の同一Subsystemで完結する。
 * @security createProviderEnvironmentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProviderEnvironmentは共有非同期状態を持たない同期処理である。
 */
export function createProviderEnvironment(
  baseEnvironment: unknown,
  directories: OperationDirectories,
): Record<string, string> {
  const environment: Record<string, string> = {};
  copyIfPresent(environment, baseEnvironment, "PATH");
  copyIfPresent(environment, baseEnvironment, "Path");
  for (const name of WINDOWS_RUNTIME_ENV)
    copyIfPresent(environment, baseEnvironment, name);
  for (const name of POSIX_RUNTIME_ENV)
    copyIfPresent(environment, baseEnvironment, name);
  environment.HOME = directories.providerHome;
  environment.USERPROFILE = directories.providerHome;
  environment.TEMP = directories.tmp;
  environment.TMP = directories.tmp;
  environment.GIT_CONFIG_NOSYSTEM = "1";
  environment.GIT_TERMINAL_PROMPT = "0";
  return environment;
}

/**
 * Filesystem Policyの公開契約を記述する。
 *
 * @responsibility Filesystem Policyの公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input directories: OperationDirectories
 * @returns describeFilesystemPolicyの計算結果を返す。
 * @precondition 「directories: OperationDirectories」がdescribeFilesystemPolicyの入力契約を満たす。
 * @postcondition describeFilesystemPolicyの責務を完了した結果だけを返す。
 * @effect N/A: describeFilesystemPolicyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeFilesystemPolicyは独自の失敗分岐を所有しない。
 * @invariant describeFilesystemPolicyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeFilesystemPolicyはProcess内の同一Subsystemで完結する。
 * @security describeFilesystemPolicyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeFilesystemPolicyは共有非同期状態を持たない同期処理である。
 */
export function describeFilesystemPolicy(directories: OperationDirectories) {
  return {
    coordinatorRuntime: {
      write: [
        directories.events,
        directories.projection,
        directories.management,
      ],
    },
    repositoryAdapter: { write: [directories.workspace] },
    providerProcess: {
      write: [directories.workspace, directories.providerHome, directories.tmp],
      deny: [
        directories.events,
        directories.projection,
        directories.management,
      ],
    },
    credentialBroker: {
      credentialStoreAccess: "read-minimum",
      exposeCredentialStorePathToProvider: false,
    },
  };
}

/**
 * credential Environment Names Presentを決定する。
 *
 * @responsibility credential Environment Names Presentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input environment: unknown
 * @returns readonly string[]を返す。
 * @precondition 「environment: unknown」がcredentialEnvironmentNamesPresentの入力契約を満たす。
 * @postcondition credentialEnvironmentNamesPresentの責務を完了した結果だけを返す。
 * @effect N/A: credentialEnvironmentNamesPresentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: credentialEnvironmentNamesPresentは独自の失敗分岐を所有しない。
 * @invariant credentialEnvironmentNamesPresentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: credentialEnvironmentNamesPresentはProcess内の同一Subsystemで完結する。
 * @security credentialEnvironmentNamesPresentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: credentialEnvironmentNamesPresentは共有非同期状態を持たない同期処理である。
 */
export function credentialEnvironmentNamesPresent(
  environment: unknown,
): readonly string[] {
  return CREDENTIAL_ENV_NAMES.filter((name) => {
    const value = ownString(environment, name);
    return value !== null && value.length > 0;
  });
}

export const REPOSITORY_OPERATION_RUNTIME_CONTRACT =
  "crdd-coordinator/repository-operation-runtime";

export const REPOSITORY_OPERATION_RUNTIME_CONTRACT_REVISION = 2;

/**
 * repository-operation-runtimeで使用するBindingの値契約を定義する。
 *
 * @responsibility BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000009
 * @shape Bindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Bindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: Bindingの宣言は外部境界を開かない。
 * @security BindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Bindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Binding = Readonly<{
  managementCapability: object;
  operationId: string;
  repositoryRoot: string;
  verifiedRoot: VerifiedRepositoryRoot;
  repositoryKind: string;
  logicalRepositoryIdentity: string;
  repositoryInstanceIdentity: string;
  revision: string;
}>;

const bindings = new WeakMap<object, Binding>();

const capabilities = new WeakMap<object, Binding>();

/**
 * repository-operation-runtimeを観測する。
 *
 * @responsibility repository-operation-runtimeの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000009
 * @input repositoryRoot: string
 * @returns observeの計算結果を返す。
 * @precondition 「repositoryRoot: string」がobserveの入力契約を満たす。
 * @postcondition observeの責務を完了した結果だけを返す。
 * @effect Version Controlで現在のGit管理情報を読取る。書込み・外部Git CLI起動は行わない。
 * @failure observeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 単発Operation結合とVersion ControlのRepository観測。
 * @security observeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeは共有非同期状態を持たない同期処理である。
 */
function observe(repositoryRoot: string) {
  const verified = verifyRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed")
    throw new Error("repository_root_invalid");
  const observed = observeRepositoryRevision(
    verified.capability,
    gitRepositoryRevisionAdapter,
  );
  if (!observed) throw new Error("repository_revision_invalid");
  return Object.freeze({
    verifiedRoot: verified.capability,
    repositoryKind: observed.repositoryForm,
    logicalRepositoryIdentity: observed.repositoryIdentity,
    repositoryInstanceIdentity: observed.repositoryInstanceIdentity,
    revision: observed.revisionIdentity,
  });
}

/**
 * Repository Object Format 候補を観測する。
 *
 * @responsibility Repository Object Format 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000009
 * @input repositoryRoot: unknown
 * @returns inspectRepositoryObjectFormatCandidateの計算結果を返す。
 * @precondition 「repositoryRoot: unknown」がinspectRepositoryObjectFormatCandidateの入力契約を満たす。
 * @postcondition inspectRepositoryObjectFormatCandidateの責務を完了した結果だけを返す。
 * @effect Version ControlでGit形式を読取る。RuntimeのSHA-1限定判断は本Moduleが行う。
 * @failure inspectRepositoryObjectFormatCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectRepositoryObjectFormatCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRepositoryObjectFormatCandidateはProcess内の同一Subsystemで完結する。
 * @security inspectRepositoryObjectFormatCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRepositoryObjectFormatCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectRepositoryObjectFormatCandidate(
  repositoryRoot: unknown,
) {
  try {
    if (
      typeof repositoryRoot !== "string" ||
      !path.isAbsolute(repositoryRoot) ||
      repositoryRoot.length > 4_096 ||
      /[\0-\x1f\x7f]/u.test(repositoryRoot)
    ) {
      return null;
    }
    const format = inspectRepositoryFormat(
      repositoryRoot,
      gitRepositoryFormatAdapter,
    );
    if (!format) return null;
    return Object.freeze({
      status: "candidate" as const,
      objectFormat: format.objectFormat,
      runtimeSupported: format.objectFormat === "sha1",
      revisionReported: false,
      repositoryPathReported: false,
    });
  } catch {
    return null;
  }
}

/**
 * Runtime 所有 Repository OperationをIdentityへ結合する。
 *
 * @responsibility Runtime 所有 Repository Operationの結合条件、相関Identity、不一致の拒否境界を所有する。
 * @trace ARCH-000009
 * @input managementCapability: unknown、repositoryRoot: unknown
 * @returns bindRuntimeOwnedRepositoryOperationの計算結果を返す。
 * @precondition 「managementCapability: unknown、repositoryRoot: unknown」がbindRuntimeOwnedRepositoryOperationの入力契約を満たす。
 * @postcondition bindRuntimeOwnedRepositoryOperationの責務を完了した結果だけを返す。
 * @effect Repositoryを読取り、同じOperationの結合を二つの私有WeakMapへ同期登録する。Filesystem書込みは行わない。
 * @failure bindRuntimeOwnedRepositoryOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant bindRuntimeOwnedRepositoryOperationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security bindRuntimeOwnedRepositoryOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: bindRuntimeOwnedRepositoryOperationは共有非同期状態を持たない同期処理である。
 */
export function bindRuntimeOwnedRepositoryOperation(
  managementCapability: unknown,
  repositoryRoot: unknown,
) {
  try {
    if (
      !managementCapability ||
      typeof managementCapability !== "object" ||
      typeof repositoryRoot !== "string" ||
      !path.isAbsolute(repositoryRoot) ||
      repositoryRoot.length > 4_096 ||
      /[\0-\x1f\x7f]/u.test(repositoryRoot)
    ) {
      return null;
    }
    if (bindings.has(managementCapability)) return null;
    const operation =
      verifyOwnedOperationManagementCapability(managementCapability);
    const observation = observe(repositoryRoot);
    if (!/^[0-9a-f]{40}$/u.test(observation.revision)) return null;
    const binding = Object.freeze({
      managementCapability,
      operationId: operation.operationId,
      repositoryRoot: fs.realpathSync.native(repositoryRoot),
      ...observation,
    });
    const capability = Object.freeze({});
    bindings.set(managementCapability, binding);
    capabilities.set(capability, binding);
    return Object.freeze({
      operationId: binding.operationId,
      revision: binding.revision,
      repositoryBindingCapability: capability,
      repositoryBound: true as const,
      pathReported: false,
    });
  } catch {
    return null;
  }
}

/**
 * current Bindingを決定する。
 *
 * @responsibility current Bindingの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000009
 * @input managementCapability: unknown
 * @returns currentBindingの計算結果を返す。
 * @precondition 「managementCapability: unknown」がcurrentBindingの入力契約を満たす。
 * @postcondition currentBindingの責務を完了した結果だけを返す。
 * @effect N/A: currentBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: currentBindingは独自の失敗分岐を所有しない。
 * @invariant currentBindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: currentBindingはProcess内の同一Subsystemで完結する。
 * @security currentBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: currentBindingは共有非同期状態を持たない同期処理である。
 */
function currentBinding(managementCapability: unknown) {
  if (!managementCapability || typeof managementCapability !== "object")
    return null;
  const binding = bindings.get(managementCapability);
  if (!binding) return null;
  const operation =
    verifyOwnedOperationManagementCapability(managementCapability);
  if (operation.operationId !== binding.operationId) return null;
  const current = observe(binding.repositoryRoot);
  return current.repositoryKind === binding.repositoryKind &&
    current.logicalRepositoryIdentity === binding.logicalRepositoryIdentity &&
    current.repositoryInstanceIdentity === binding.repositoryInstanceIdentity &&
    current.revision === binding.revision
    ? binding
    : null;
}

/**
 * Runtime 所有 Repository Operationを検証する。
 *
 * @responsibility Runtime 所有 Repository Operationの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000009
 * @input managementCapability: unknown
 * @returns verifyRuntimeOwnedRepositoryOperationの計算結果を返す。
 * @precondition 「managementCapability: unknown」がverifyRuntimeOwnedRepositoryOperationの入力契約を満たす。
 * @postcondition verifyRuntimeOwnedRepositoryOperationの責務を完了した結果だけを返す。
 * @effect N/A: verifyRuntimeOwnedRepositoryOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyRuntimeOwnedRepositoryOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyRuntimeOwnedRepositoryOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRuntimeOwnedRepositoryOperationはProcess内の同一Subsystemで完結する。
 * @security verifyRuntimeOwnedRepositoryOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRuntimeOwnedRepositoryOperationは共有非同期状態を持たない同期処理である。
 */
export function verifyRuntimeOwnedRepositoryOperation(
  managementCapability: unknown,
) {
  try {
    const binding = currentBinding(managementCapability);
    return binding
      ? Object.freeze({
          operationId: binding.operationId,
          revision: binding.revision,
          repositoryBound: true as const,
          revisionCurrent: true as const,
        })
      : null;
  } catch {
    return null;
  }
}

/**
 * Coordinatorの保存先選択へ、現在のRepository結合を内部借用する。
 * @responsibility 操作Ownerへ結合したRoot・論理Identity・実体Identity・発行revisionを再観測して返す。
 * @trace ARCH-000009
 * @input managementCapability: 同じRuntimeが所有する操作管理Capability。
 * @returns 内部保存用のRoot・結合・再検証手段、または借用不能のnull。
 * @precondition 操作がRepositoryへ結合され、現在のOwnerと発行revisionを確認できる。
 * @postcondition caller supplied Path、cwd、過去のJSONから保存先を選択しない。
 * @effect FilesystemとVersion Controlの現在Identityを読取り、書込みは行わない。
 * @failure 不正Capability、Owner失効、Repository実体・revision差、観測不能はnullを返す。
 * @invariant 発行時結合を現在観測で置換せず、元Ownerと同じ結合だけを借用する。
 * @boundary Repository Operation OwnerからCoordinator内部の保存先選択への境界。
 * @security 返却Path・Identityは書込み、削除、RecoveryまたはProvider起動のAuthorityではなく、外部公開しない。
 * @concurrency 保存直前・直後の再検証と実効排他はWriterが所有する。借用だけでLockを取得しない。
 */
export function borrowRuntimeOwnedCoordinatorStateRepository(
  managementCapability: unknown,
) {
  try {
    const binding = currentBinding(managementCapability);
    if (!binding) return null;
    const repository = {
      operationId: binding.operationId,
      repositoryRoot: binding.repositoryRoot,
      logicalRepositoryIdentity: binding.logicalRepositoryIdentity,
      repositoryInstanceIdentity: binding.repositoryInstanceIdentity,
      repositoryBinding: deriveCoordinatorRepositoryStateBinding(
        binding.repositoryRoot,
        binding.logicalRepositoryIdentity,
        binding.repositoryInstanceIdentity,
      ),
      revision: binding.revision,
      /**
       * 同じ操作OwnerとRepository結合が現在も成立するか再観測する。
       * @responsibility 借用後のOwner・実体・revision変化をWriterへ返す。
       * @trace ARCH-000009
       * @input N/A: 発行時の内部結合を閉包から参照する。
       * @returns 同じ結合を再確認できた場合だけtrue。
       * @precondition 借用元のRuntime内で使用する。
       * @postcondition 観測不能を現在一致へ分類しない。
       * @effect Repositoryと操作Ownerの現在状態を読取る。
       * @failure 観測失敗と結合失効はfalse。
       * @invariant 他のOwnerやRepositoryへ再結合しない。
       * @boundary 保存利用側と現在のRepository結合観測。
       * @security trueはFile書込みAuthorityやcleanup許可ではない。
       * @concurrency 保存用Lockの代わりにはせず、WriterがI/O境界で呼ぶ。
       */
      revalidate() {
        try {
          return currentBinding(managementCapability) === binding;
        } catch {
          return false;
        }
      },
    };
    return Object.freeze(
      Object.defineProperties(repository, {
        purpose: { value: "execution" as const },
        root: { value: binding.verifiedRoot },
      }),
    ) as Readonly<
      typeof repository & {
        purpose: "execution";
        root: VerifiedRepositoryRoot;
      }
    >;
  } catch {
    return null;
  }
}

/**
 * 既存Coordinator保存結合のHashを同じ符号化で導出する。
 * @responsibility 通常操作と再入場のRepository・Lock結合を共通化する。
 * @trace ARCH-000009
 * @input repositoryRoot: 検証済みRoot、logicalIdentity: 論理Identity、instanceIdentity: 実体Identity。
 * @returns 既存domain prefixと順序を維持したSHA-256。
 * @precondition 入力は既存Repository観測で確定している。
 * @postcondition 保存先とLock名の既存結合を変更しない。
 * @effect N/A: 局所Hash計算だけ。
 * @failure N/A: 観測不能は呼出し元が計算前に拒否する。
 * @invariant Path・論理・実体の順序とUTF-8符号化を維持する。
 * @boundary Repository観測と現在状態の結合。
 * @security Hashは処置Authorityではない。
 * @concurrency N/A: 同期の値計算だけ。
 */
function deriveCoordinatorRepositoryStateBinding(
  repositoryRoot: string,
  logicalIdentity: string,
  instanceIdentity: string,
) {
  return createHash("sha256")
    .update("crdd-coordinator-repository-state-binding-v1\0")
    .update(
      JSON.stringify([repositoryRoot, logicalIdentity, instanceIdentity]),
      "utf8",
    )
    .digest("hex");
}

/**
 * 業務保存を現在Repositoryの実体へ結合する。
 * @responsibility 保存Ownerに実行Commitを要求せず、Root・Git実体の再確認を提供する。
 * @trace ARCH-000009
 * @input rootCapability: 検証済みRoot。
 * @returns 保存専用の内部結合、又はnull。
 * @precondition 実行要求のRevision確認には使用しない。
 * @postcondition 既存技術保存と同じ物理結合Hashを使う。
 * @effect RootとGit実体の読取りだけ。
 * @failure 未検証Root・実体変更・観測不能はnull。
 * @invariant 不明なHEADを不存在や固定Revisionへ補完しない。
 * @boundary 業務保存とVersion Control。
 * @security Provider・回収Authorityを発行しない。
 * @concurrency 短期保存Ownerが再確認を呼ぶ。
 */
export function borrowRuntimeOwnedCoordinatorStorageRepository(
  rootCapability: unknown,
) {
  try {
    const capability = rootCapability as VerifiedRepositoryRoot;
    const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
    const observed = observeRepositoryStorageIdentity(capability);
    if (!repositoryRoot || !observed) return null;
    const repository = {
      repositoryRoot,
      repositoryBinding: deriveCoordinatorRepositoryStateBinding(
        repositoryRoot,
        observed.repositoryIdentity,
        observed.repositoryInstanceIdentity,
      ),
      revalidate: () => {
        const fresh = observeRepositoryStorageIdentity(capability);
        return (
          fresh !== null &&
          fresh.repositoryForm === observed.repositoryForm &&
          fresh.repositoryIdentity === observed.repositoryIdentity &&
          fresh.repositoryInstanceIdentity ===
            observed.repositoryInstanceIdentity
        );
      },
    };
    return Object.freeze(
      Object.defineProperties(repository, {
        purpose: { value: "storage" as const },
        root: { value: capability },
      }),
    ) as Readonly<
      typeof repository & {
        purpose: "storage";
        root: VerifiedRepositoryRoot;
      }
    >;
  } catch {
    return null;
  }
}

/**
 * 検証済みRootを再入場の現在状態読取りへ借用する。
 * @responsibility 新ProcessのRoot論理・実体・現在Revisionを内部Readerへ固定する。
 * @trace ARCH-000009
 * @input rootCapability: 既存Version Control Ownerが検証したRoot。
 * @returns 内部読取り結合、またはnull。
 * @precondition 呼出し元のCLIまたは上位組立てが対象Rootを固定している。
 * @postcondition 操作管理Capability、書込み・回収Authorityを生成しない。
 * @effect 現在RootとGit Identityの読取りだけ。
 * @failure 偽Root、失効、観測不能はnull。
 * @invariant 過去の保存値やAppDataからRootを復元しない。
 * @boundary 検証済みRepository Rootと再入場Reader。
 * @security 全Snapshotは内部限定で、公開は既存診断投影が所有する。
 * @concurrency Readerの前後で同じ実体と捕捉した現在Revisionを再確認する。
 */
export function borrowRuntimeOwnedCoordinatorRecoveryRepository(
  rootCapability: unknown,
) {
  try {
    if (!rootCapability || typeof rootCapability !== "object") return null;
    const repositoryRoot = resolveVerifiedRepositoryRoot(
      rootCapability as VerifiedRepositoryRoot,
    );
    if (!repositoryRoot) return null;
    const initial = observe(repositoryRoot);
    const repository = {
      repositoryRoot,
      repositoryBinding: deriveCoordinatorRepositoryStateBinding(
        repositoryRoot,
        initial.logicalRepositoryIdentity,
        initial.repositoryInstanceIdentity,
      ),
      /**
       * 再入場Readerが捕捉した現在Rootを再確認する。
       * @responsibility 読取り途中の実体・Revision変更を拒否する。
       * @trace ARCH-000009
       * @input N/A: 検証済みRootと初回観測を閉包から使う。
       * @returns 同じ観測を確認できた場合だけtrue。
       * @precondition 同じ借用の読取り中だけ使用する。
       * @postcondition 過去操作のAuthorityを復元しない。
       * @effect RootとGit Identityを読取る。
       * @failure 観測不能または変化はfalse。
       * @invariant 別Rootへ再結合しない。
       * @boundary 再入場Readerと現在Repository。
       * @security 成功は削除やProvider起動の許可ではない。
       * @concurrency 更新排他は既存Readerが別途所有する。
       */
      revalidate() {
        try {
          if (
            resolveVerifiedRepositoryRoot(
              rootCapability as VerifiedRepositoryRoot,
            ) !== repositoryRoot
          )
            return false;
          const current = observe(repositoryRoot);
          return (
            current.repositoryKind === initial.repositoryKind &&
            current.logicalRepositoryIdentity ===
              initial.logicalRepositoryIdentity &&
            current.repositoryInstanceIdentity ===
              initial.repositoryInstanceIdentity &&
            current.revision === initial.revision
          );
        } catch {
          return false;
        }
      },
    };
    return Object.freeze(
      Object.defineProperties(repository, {
        purpose: { value: "recovery" as const },
        root: { value: rootCapability },
      }),
    ) as Readonly<
      typeof repository & {
        purpose: "recovery";
        root: VerifiedRepositoryRoot;
      }
    >;
  } catch {
    return null;
  }
}

/**
 * 清掃前のRepository結合を終端保存に限って固定する。
 * @responsibility 通常Ownerの失効と独立した現在Repository実体の再検証を所有する。
 * @trace ARCH-000009
 * @input managementCapability: 清掃前の現在Owner。既存の操作結合を内部から取得する。
 * @returns 同じRepositoryの内部保存結合、またはnull。
 * @precondition 操作Ownerが現在のRepository実体と発行revisionへ結合している。
 * @postcondition 通常Ownerの検証・失効条件は変更しない。
 * @effect Repository実体を読取り、作成・削除は行わない。
 * @failure 結合・実体不一致と観測不能はnullまたは再検証false。
 * @invariant revision変化から旧操作Authorityを復元しない。
 * @boundary Repository OperationからCoordinatorの終端保存だけ。
 * @security Pathは内部限定。返却値をProvider起動や一般書込みに用いない。
 * @concurrency Writerは既存短期排他下で実体を再検証する。
 */
export function borrowRuntimeOwnedCoordinatorSettlementRepository(
  managementCapability: unknown,
) {
  const ordinary =
    borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
  const binding =
    ordinary && managementCapability && typeof managementCapability === "object"
      ? bindings.get(managementCapability)
      : null;
  if (
    !binding ||
    !ordinary ||
    binding.managementCapability !== managementCapability
  )
    return null;
  const repository: Omit<typeof ordinary, "purpose" | "root"> = {
    ...ordinary,
    /**
     * 終端保存先の現在実体だけを再確認する。
     * @responsibility 失効済み操作権限を復活させず保存先置換を拒否する。
     * @trace ARCH-000009
     * @input N/A: 発行時の内部結合を使用する。
     * @returns 現在実体一致だけtrue。
     * @precondition 終端限定Writerからだけ使用する。
     * @postcondition 同じ論理・実体Identityを維持する。
     * @effect 現在Repositoryの読取り。
     * @failure 観測不能はfalse。
     * @invariant 旧revision一致を清掃や再実行の根拠にしない。
     * @boundary 終端WriterとRepository実体。
     * @security 新しい操作Authorityを返さない。
     * @concurrency 短期排他はWriterが所有する。
     */
    revalidate() {
      try {
        const current = observe(binding.repositoryRoot);
        return (
          current.repositoryKind === binding.repositoryKind &&
          current.logicalRepositoryIdentity ===
            binding.logicalRepositoryIdentity &&
          current.repositoryInstanceIdentity ===
            binding.repositoryInstanceIdentity
        );
      } catch {
        return false;
      }
    },
  };
  return Object.freeze(
    Object.defineProperties(repository, {
      purpose: { value: "settlement" as const },
      root: { value: ordinary.root },
    }),
  ) as Readonly<
    Omit<typeof repository, "purpose" | "root"> & {
      purpose: "settlement";
      root: VerifiedRepositoryRoot;
    }
  >;
}

/**
 * Runtime 所有 Repository Binding Capabilityを検証する。
 *
 * @responsibility Runtime 所有 Repository Binding Capabilityの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000009
 * @input repositoryBindingCapability: unknown、managementCapability: unknown
 * @returns verifyRuntimeOwnedRepositoryBindingCapabilityの計算結果を返す。
 * @precondition 「repositoryBindingCapability: unknown、managementCapability: unknown」がverifyRuntimeOwnedRepositoryBindingCapabilityの入力契約を満たす。
 * @postcondition verifyRuntimeOwnedRepositoryBindingCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: verifyRuntimeOwnedRepositoryBindingCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyRuntimeOwnedRepositoryBindingCapabilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyRuntimeOwnedRepositoryBindingCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRuntimeOwnedRepositoryBindingCapabilityはProcess内の同一Subsystemで完結する。
 * @security verifyRuntimeOwnedRepositoryBindingCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRuntimeOwnedRepositoryBindingCapabilityは共有非同期状態を持たない同期処理である。
 */
export function verifyRuntimeOwnedRepositoryBindingCapability(
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
) {
  try {
    if (
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object"
    ) {
      return null;
    }
    const binding = capabilities.get(repositoryBindingCapability);
    return binding?.managementCapability === managementCapability &&
      currentBinding(managementCapability) === binding
      ? Object.freeze({
          operationId: binding.operationId,
          revision: binding.revision,
          repositoryBound: true as const,
          revisionCurrent: true as const,
        })
      : null;
  } catch {
    return null;
  }
}

/**
 * Runtime 所有 Repository Sourceを一時参照として取得する。
 *
 * @responsibility Runtime 所有 Repository Sourceの参照条件、lifetime、所有権を移さない境界を所有する。
 * @trace ARCH-000009
 * @input repositoryBindingCapability: unknown、managementCapability: unknown
 * @returns borrowRuntimeOwnedRepositorySourceの計算結果を返す。
 * @precondition 「repositoryBindingCapability: unknown、managementCapability: unknown」がborrowRuntimeOwnedRepositorySourceの入力契約を満たす。
 * @postcondition borrowRuntimeOwnedRepositorySourceの責務を完了した結果だけを返す。
 * @effect N/A: borrowRuntimeOwnedRepositorySourceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure borrowRuntimeOwnedRepositorySourceは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant borrowRuntimeOwnedRepositorySourceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: borrowRuntimeOwnedRepositorySourceはProcess内の同一Subsystemで完結する。
 * @security borrowRuntimeOwnedRepositorySourceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: borrowRuntimeOwnedRepositorySourceは共有非同期状態を持たない同期処理である。
 */
export function borrowRuntimeOwnedRepositorySource(
  repositoryBindingCapability: unknown,
  managementCapability: unknown,
) {
  try {
    if (
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object"
    ) {
      return null;
    }
    const binding = capabilities.get(repositoryBindingCapability);
    if (
      !binding ||
      binding.managementCapability !== managementCapability ||
      currentBinding(managementCapability) !== binding ||
      binding.revision.length !== 40
    ) {
      return null;
    }
    return Object.freeze({
      operationId: binding.operationId,
      repositoryRoot: binding.repositoryRoot,
      revision: binding.revision,
    });
  } catch {
    return null;
  }
}

/**
 * Repository Operation Runtime 契約の公開契約を記述する。
 *
 * @responsibility Repository Operation Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000009
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeRepositoryOperationRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeRepositoryOperationRuntimeContractの入力契約を満たす。
 * @postcondition describeRepositoryOperationRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeRepositoryOperationRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeRepositoryOperationRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeRepositoryOperationRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeRepositoryOperationRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeRepositoryOperationRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeRepositoryOperationRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeRepositoryOperationRuntimeContract() {
  return Object.freeze({
    contract: REPOSITORY_OPERATION_RUNTIME_CONTRACT,
    contractRevision: REPOSITORY_OPERATION_RUNTIME_CONTRACT_REVISION,
    repositoryIdentity:
      "logical_common_git_metadata_plus_worktree_instance_filesystem_identity",
    revision: "exact_head_object_id_reobserved_before_effect_and_result",
    supportedRefs: Object.freeze([
      "loose_heads_tags",
      "packed_heads_tags",
      "detached_head",
    ]),
    pathReported: false,
    callerRevisionAccepted: false,
    internalSourceBorrow:
      "same_runtime_owned_binding_and_current_revision_only",
    runtimeSupportedObjectFormats: Object.freeze(["sha1"]),
    unsupportedObjectFormatResult: "fail_closed_before_operation_effect",
    providerEffectAllowed: false,
  });
}

import type { CoordinatorWorkspaceResult } from "../../../domain-model/src/index.ts";
