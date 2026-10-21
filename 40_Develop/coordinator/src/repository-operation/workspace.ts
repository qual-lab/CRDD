/**
 * repository-workspace-runtimeに属する責務をまとめる。
 *
 * @responsibility InventoryEntryを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000013
 */
import { createHash } from "node:crypto";
import path from "node:path";
import type { CoordinatorWorkspaceResult } from "../task/types.ts";
import type { BorrowedWorkspaceTarget } from "./borrowed-workspace.ts";

import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  inspectWorkspaceInventory as inventory,
  readWorkspaceFileContent as stableFileContent,
  isWorkspaceRelativePath as validRelativePath,
  type WorkspaceInventoryEntry as InventoryEntry,
} from "../../../version-control/src/index.ts";

import { verifyOwnedOperationManagementMountBinding } from "../host-execution/operation-workspace-lifecycle.ts";
import {
  borrowRuntimeOwnedRepositorySource,
  verifyRuntimeOwnedRepositoryBindingCapability,
} from "./binding.ts";
import { containsRecognizedSecretMaterial } from "../authority/secret-material-policy.ts";
import {
  bindBorrowedWorkspaceTarget,
  readBorrowedWorkspaceBinding,
} from "./borrowed-workspace.ts";

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
export function projectBorrowedWorkspaceResult(
  capability: object | undefined,
  target: BorrowedWorkspaceTarget,
): CoordinatorWorkspaceResult {
  const observedPaths = capability
    ? observeBorrowedWorkspaceChanges(capability)
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
export function observeBorrowedWorkspaceChanges(capability: object) {
  try {
    const record = workspaces.get(capability);
    if (
      !record?.sourceTree ||
      readBorrowedWorkspaceBinding(record.managementCapability)?.target
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
 * @returns materializeRuntimeOwnedRepositoryWorkspaceの計算結果を返す。
 * @precondition 「repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawReadPaths: unknown」がmaterializeRuntimeOwnedRepositoryWorkspaceの入力契約を満たす。
 * @postcondition materializeRuntimeOwnedRepositoryWorkspaceの責務を完了した結果だけを返す。
 * @effect N/A: materializeRuntimeOwnedRepositoryWorkspaceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure materializeRuntimeOwnedRepositoryWorkspaceは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant materializeRuntimeOwnedRepositoryWorkspaceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: materializeRuntimeOwnedRepositoryWorkspaceはProcess内の同一Subsystemで完結する。
 * @security materializeRuntimeOwnedRepositoryWorkspaceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: materializeRuntimeOwnedRepositoryWorkspaceは共有非同期状態を持たない同期処理である。
 */
export function materializeRuntimeOwnedRepositoryWorkspace(
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
      const target = bindBorrowedWorkspaceTarget(
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
    ? readBorrowedWorkspaceBinding(managementCapability)
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
 * @returns captureRuntimeOwnedCandidateRevisionの計算結果を返す。
 * @precondition 「workspaceCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawAllowedPaths: unknown」がcaptureRuntimeOwnedCandidateRevisionの入力契約を満たす。
 * @postcondition captureRuntimeOwnedCandidateRevisionの責務を完了した結果だけを返す。
 * @effect N/A: captureRuntimeOwnedCandidateRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure captureRuntimeOwnedCandidateRevisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant captureRuntimeOwnedCandidateRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: captureRuntimeOwnedCandidateRevisionはProcess内の同一Subsystemで完結する。
 * @security captureRuntimeOwnedCandidateRevisionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: captureRuntimeOwnedCandidateRevisionは共有非同期状態を持たない同期処理である。
 */
export function captureRuntimeOwnedCandidateRevision(
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
 * @returns orchestratorOwnedCandidateReadContentの計算結果を返す。
 * @precondition 「workspaceCapability: unknown、candidateCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown、rawReadPaths: unknown」がorchestratorOwnedCandidateReadContentの入力契約を満たす。
 * @postcondition orchestratorOwnedCandidateReadContentの責務を完了した結果だけを返す。
 * @effect N/A: orchestratorOwnedCandidateReadContentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure orchestratorOwnedCandidateReadContentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant orchestratorOwnedCandidateReadContentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: orchestratorOwnedCandidateReadContentはProcess内の同一Subsystemで完結する。
 * @security orchestratorOwnedCandidateReadContentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: orchestratorOwnedCandidateReadContentは共有非同期状態を持たない同期処理である。
 */
export function orchestratorOwnedCandidateReadContent(
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
 * @returns verifyRuntimeOwnedCandidateRevisionの計算結果を返す。
 * @precondition 「candidateCapability: unknown、repositoryBindingCapability: unknown、managementCapability: unknown、mountCapability: unknown」がverifyRuntimeOwnedCandidateRevisionの入力契約を満たす。
 * @postcondition verifyRuntimeOwnedCandidateRevisionの責務を完了した結果だけを返す。
 * @effect N/A: verifyRuntimeOwnedCandidateRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyRuntimeOwnedCandidateRevisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyRuntimeOwnedCandidateRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRuntimeOwnedCandidateRevisionはProcess内の同一Subsystemで完結する。
 * @security verifyRuntimeOwnedCandidateRevisionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRuntimeOwnedCandidateRevisionは共有非同期状態を持たない同期処理である。
 */
export function verifyRuntimeOwnedCandidateRevision(
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
      readBorrowedWorkspaceBinding(managementCapability as object)?.target
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
 * @returns describeRepositoryWorkspaceRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeRepositoryWorkspaceRuntimeContractの入力契約を満たす。
 * @postcondition describeRepositoryWorkspaceRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeRepositoryWorkspaceRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeRepositoryWorkspaceRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeRepositoryWorkspaceRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeRepositoryWorkspaceRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeRepositoryWorkspaceRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeRepositoryWorkspaceRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeRepositoryWorkspaceRuntimeContract() {
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
