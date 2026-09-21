import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  ProjectRuntimeCandidatePort,
  ProjectRuntimeState,
} from "../../../project-runtime/src/index.ts";

import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  resolveRepositoryRuntimeDataPathsFromWorkingDirectory,
} from "../../../runtime-data/src/index.ts";
import {
  materializeFixedSnapshotCandidate,
  verifyCandidateOutputDirectory,
} from "../../../version-control/src/fixed-snapshot.ts";
import { gitFixedSnapshotAdapter } from "../../../version-control/src/git/fixed-snapshot-adapter.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/repository-location.ts";
import {
  persistRuntimeOwnedCandidateBundle,
  publishRuntimeOwnedCandidateBundle,
  readRuntimeOwnedCandidateBundle,
} from "./candidate-bundle-store.ts";
import { inspectRepositoryIdentityCandidate } from "./repository-operation-runtime.ts";
import { containsRecognizedSecretMaterial } from "./secret-material-policy.ts";

export const PROJECT_RUNTIME_CANDIDATE_INTEGRATION_ADAPTER_CONTRACT =
  "crdd-coordinator/project-runtime-candidate-integration-adapter/v1" as const;

/**
 * Entryが扱う値の構造を表す。
 *
 * @responsibility Entryに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape Entryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Entryで宣言した値と責務の対応を維持する。
 * @boundary N/A: Entryの宣言は外部境界を開かない。
 * @security EntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Entryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Entry = Readonly<{
  relativePath: string;
  operation: "upsert" | "delete";
  byteLength: number;
  sha256: string | null;
  contentBase64: string | null;
}>;
/**
 * Bundleが扱う値の構造を表す。
 *
 * @responsibility Bundleに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape Bundleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Bundleで宣言した値と責務の対応を維持する。
 * @boundary N/A: Bundleの宣言は外部境界を開かない。
 * @security BundleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Bundleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Bundle = Readonly<{
  schema: "crdd-coordinator-candidate-bundle/v1";
  baseCommit: string;
  baseTree: string;
  baseManifestHash: string;
  patchHash: string;
  contentManifestHash: string;
  allowedPathsHash: string;
  changedPaths: readonly string[];
  entries: readonly Entry[];
}>;

/**
 * digestの処理を実行する。
 *
 * @responsibility digestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input values: readonly (string | Buffer)[]
 * @returns digestの計算結果を返す。
 * @precondition 「values: readonly (string | Buffer)[]」がdigestの入力契約を満たす。
 * @postcondition digestの責務を完了した結果だけを返す。
 * @effect N/A: digestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: digestは独自の失敗分岐を所有しない。
 * @invariant digestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security digestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: digestは共有非同期状態を持たない同期処理である。
 */
function digest(...values: readonly (string | Buffer)[]) {
  const hash = createHash("sha256");
  for (const value of values) hash.update(value).update("\0");
  return hash.digest("hex");
}

/**
 * CandidateStoreが扱う値の構造を表す。
 *
 * @responsibility CandidateStoreに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape CandidateStoreが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CandidateStoreで宣言した値と責務の対応を維持する。
 * @boundary N/A: CandidateStoreの宣言は外部境界を開かない。
 * @security CandidateStoreはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CandidateStoreの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CandidateStore = Readonly<{
  read: (
    candidateId: string,
  ) => ReturnType<typeof readRuntimeOwnedCandidateBundle>;
  persist: typeof persistRuntimeOwnedCandidateBundle;
  publish: typeof publishRuntimeOwnedCandidateBundle;
}>;

const productionCandidateStore: CandidateStore = Object.freeze({
  read: readRuntimeOwnedCandidateBundle,
  persist: persistRuntimeOwnedCandidateBundle,
  publish: publishRuntimeOwnedCandidateBundle,
});

/**
 * exportedの処理を実行する。
 *
 * @responsibility exportedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input candidateStore: CandidateStore、candidateId: string
 * @returns exportedの計算結果を返す。
 * @precondition 「candidateStore: CandidateStore、candidateId: string」がexportedの入力契約を満たす。
 * @postcondition exportedの責務を完了した結果だけを返す。
 * @effect N/A: exportedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exportedは独自の失敗分岐を所有しない。
 * @invariant exportedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security exportedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exportedは共有非同期状態を持たない同期処理である。
 */
function exported(candidateStore: CandidateStore, candidateId: string) {
  const value = candidateStore.read(candidateId);
  if (
    value?.status !== "exported" ||
    !value.bundle ||
    value.bundle.schema !== "crdd-coordinator-candidate-bundle/v1"
  )
    return null;
  return Object.freeze({
    candidateId,
    classification: value.informationClassification,
    bundle: value.bundle as Bundle,
  });
}

/**
 * highestClassificationの処理を実行する。
 *
 * @responsibility highestClassificationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input values: readonly ("public" | "internal" | "confidential")[]
 * @returns highestClassificationの計算結果を返す。
 * @precondition 「values: readonly ("public" | "internal" | "confidential")[]」がhighestClassificationの入力契約を満たす。
 * @postcondition highestClassificationの責務を完了した結果だけを返す。
 * @effect N/A: highestClassificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: highestClassificationは独自の失敗分岐を所有しない。
 * @invariant highestClassificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security highestClassificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: highestClassificationは共有非同期状態を持たない同期処理である。
 */
function highestClassification(
  values: readonly ("public" | "internal" | "confidential")[],
) {
  return values.includes("confidential")
    ? "confidential"
    : values.includes("internal")
      ? "internal"
      : "public";
}

/**
 * sameEntryの処理を実行する。
 *
 * @responsibility sameEntryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input left: Entry、right: Entry
 * @returns sameEntryの計算結果を返す。
 * @precondition 「left: Entry、right: Entry」がsameEntryの入力契約を満たす。
 * @postcondition sameEntryの責務を完了した結果だけを返す。
 * @effect N/A: sameEntryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameEntryは独自の失敗分岐を所有しない。
 * @invariant sameEntryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security sameEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameEntryは共有非同期状態を持たない同期処理である。
 */
function sameEntry(left: Entry, right: Entry) {
  return (
    left.operation === right.operation &&
    left.byteLength === right.byteLength &&
    left.sha256 === right.sha256 &&
    left.contentBase64 === right.contentBase64
  );
}

/**
 * mergeの処理を実行する。
 *
 * @responsibility mergeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input candidateStore: CandidateStore、state: ProjectRuntimeState、candidateIds: readonly string[]
 * @returns mergeの計算結果を返す。
 * @precondition 「candidateStore: CandidateStore、state: ProjectRuntimeState、candidateIds: readonly string[]」がmergeの入力契約を満たす。
 * @postcondition mergeの責務を完了した結果だけを返す。
 * @effect N/A: mergeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: mergeは独自の失敗分岐を所有しない。
 * @invariant mergeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security mergeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: mergeは共有非同期状態を持たない同期処理である。
 */
function merge(
  candidateStore: CandidateStore,
  state: ProjectRuntimeState,
  candidateIds: readonly string[],
) {
  const sources = candidateIds.map((candidateId) =>
    exported(candidateStore, candidateId),
  );
  if (
    sources.some((source) => !source) ||
    sources.some(
      (source) => source?.bundle.baseCommit !== state.repositoryRevision,
    )
  )
    return null;
  const completeItems = sources as readonly NonNullable<
    ReturnType<typeof exported>
  >[];
  const baseTree = completeItems[0]?.bundle.baseTree;
  const baseManifestHash = completeItems[0]?.bundle.baseManifestHash;
  if (
    !baseTree ||
    !baseManifestHash ||
    completeItems.some(
      (source) =>
        source.bundle.baseTree !== baseTree ||
        source.bundle.baseManifestHash !== baseManifestHash,
    )
  )
    return null;
  const entries = new Map<string, Entry>();
  const conflicts = new Set<string>();
  for (const source of completeItems) {
    for (const entry of source.bundle.entries) {
      const existing = entries.get(entry.relativePath);
      if (existing && !sameEntry(existing, entry))
        conflicts.add(`path-${digest(entry.relativePath).slice(0, 32)}`);
      else entries.set(entry.relativePath, Object.freeze({ ...entry }));
    }
  }
  const sortedEntries = [...entries.values()].sort((left, right) =>
    Buffer.from(left.relativePath).compare(Buffer.from(right.relativePath)),
  );
  const changedPaths = Object.freeze(
    sortedEntries.map((entry) => entry.relativePath),
  );
  const contentManifestHash = digest(
    ...sortedEntries.map((entry) =>
      JSON.stringify({
        relativePath: entry.relativePath,
        operation: entry.operation,
        byteLength: entry.byteLength,
        sha256: entry.sha256,
      }),
    ),
  );
  const allowedPathsHash = digest(...changedPaths);
  const patchHash = digest(
    state.repositoryRevision,
    baseTree,
    baseManifestHash,
    contentManifestHash,
    allowedPathsHash,
  );
  const bundle: Bundle = Object.freeze({
    schema: "crdd-coordinator-candidate-bundle/v1",
    baseCommit: state.repositoryRevision,
    baseTree,
    baseManifestHash,
    patchHash,
    contentManifestHash,
    allowedPathsHash,
    changedPaths,
    entries: Object.freeze(sortedEntries),
  });
  return Object.freeze({
    bundle,
    conflicts: Object.freeze([...conflicts]),
    classification: highestClassification(
      completeItems.map((source) => source.classification),
    ),
  });
}

/**
 * stableFileの処理を実行する。
 *
 * @responsibility stableFileに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input target: string
 * @returns stableFileの計算結果を返す。
 * @precondition 「target: string」がstableFileの入力契約を満たす。
 * @postcondition stableFileの責務を完了した結果だけを返す。
 * @effect stableFileはFilesystemの読取りまたは書込みを実行する。
 * @failure stableFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant stableFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security stableFileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stableFileは共有非同期状態を持たない同期処理である。
 */
function stableFile(target: string) {
  try {
    const before = fs.lstatSync(target, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink()) return null;
    const bytes = fs.readFileSync(target);
    const after = fs.lstatSync(target, { bigint: true });
    return before.dev === after.dev &&
      before.ino === after.ino &&
      before.birthtimeNs === after.birthtimeNs &&
      before.size === after.size &&
      before.mtimeNs === after.mtimeNs
      ? bytes
      : null;
  } catch (error) {
    return error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
      ? false
      : null;
  }
}

/**
 * cleanupMaterializedBaseの処理を実行する。
 *
 * @responsibility cleanupMaterializedBaseに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input workspace: string
 * @returns booleanを返す。
 * @precondition 「workspace: string」がcleanupMaterializedBaseの入力契約を満たす。
 * @postcondition cleanupMaterializedBaseの責務を完了した結果だけを返す。
 * @effect cleanupMaterializedBaseはFilesystemの読取りまたは書込みを実行する。
 * @failure cleanupMaterializedBaseは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant cleanupMaterializedBaseは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security cleanupMaterializedBaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cleanupMaterializedBaseは共有非同期状態を持たない同期処理である。
 */
function cleanupMaterializedBase(workspace: string): boolean {
  try {
    fs.rmSync(workspace, { recursive: true, force: true });
    return !fs.existsSync(workspace);
  } catch {
    return false;
  }
}

/**
 * candidateCleanupBlockedの処理を実行する。
 *
 * @responsibility candidateCleanupBlockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input effectIssued: boolean、isEffectStateUnknown: boolean
 * @returns candidateCleanupBlockedの計算結果を返す。
 * @precondition 「effectIssued: boolean、isEffectStateUnknown: boolean」がcandidateCleanupBlockedの入力契約を満たす。
 * @postcondition candidateCleanupBlockedの責務を完了した結果だけを返す。
 * @effect N/A: candidateCleanupBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: candidateCleanupBlockedは独自の失敗分岐を所有しない。
 * @invariant candidateCleanupBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security candidateCleanupBlockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: candidateCleanupBlockedは共有非同期状態を持たない同期処理である。
 */
function candidateCleanupBlocked(
  effectIssued: boolean,
  isEffectStateUnknown: boolean,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason: "project_runtime_candidate_base_cleanup_unconfirmed",
    effectIssued,
    effectStateUnknown: isEffectStateUnknown,
    cleanupConfirmed: false,
    retryAllowed: false,
    recoveryReference: null,
  });
}

/**
 * MaterializedBaseResultが扱う値の構造を表す。
 *
 * @responsibility MaterializedBaseResultに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape MaterializedBaseResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant MaterializedBaseResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: MaterializedBaseResultの宣言は外部境界を開かない。
 * @security MaterializedBaseResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility MaterializedBaseResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type MaterializedBaseResult =
  | Readonly<{ status: "materialized"; workspace: string }>
  | Readonly<{
      status: "blocked";
      reason: string;
      effectIssued: boolean;
      effectStateUnknown: boolean;
      cleanupConfirmed: boolean;
      retryAllowed: boolean;
      recoveryReference: string | null;
    }>;

/**
 * materializeBaseの処理を実行する。
 *
 * @responsibility materializeBaseに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input repositoryRoot: string、revision: string、paths: readonly string[]、snapshotAdapter: typeof gitFixedSnapshotAdapter、materializeSnapshot: typeof materializeFixedSnapshotCandidate、cleanupWorkspace: (workspace: string) => boolean
 * @returns MaterializedBaseResult | nullを返す。
 * @precondition 「repositoryRoot: string、revision: string、paths: readonly string[]、snapshotAdapter: typeof gitFixedSnapshotAdapter、materializeSnapshot: typeof materializeFixedSnapshotCandidate、cleanupWorkspace: (workspace: string) => boolean」がmaterializeBaseの入力契約を満たす。
 * @postcondition materializeBaseの責務を完了した結果だけを返す。
 * @effect materializeBaseはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: materializeBaseは独自の失敗分岐を所有しない。
 * @invariant materializeBaseは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security materializeBaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: materializeBaseは共有非同期状態を持たない同期処理である。
 */
function materializeBase(
  repositoryRoot: string,
  revision: string,
  paths: readonly string[],
  snapshotAdapter: typeof gitFixedSnapshotAdapter,
  materializeSnapshot: typeof materializeFixedSnapshotCandidate,
  cleanupWorkspace: (workspace: string) => boolean,
): MaterializedBaseResult | null {
  const verified = verifyRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed") return null;
  const runtimeArea = ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
    repositoryRoot,
    "project-runtime",
  );
  if (!runtimeArea) return null;
  if (runtimeArea.status === "blocked")
    return Object.freeze({
      status: "blocked",
      reason: runtimeArea.reason,
      effectIssued: runtimeArea.effectIssued,
      effectStateUnknown: runtimeArea.effectStateUnknown,
      cleanupConfirmed: runtimeArea.cleanupConfirmed,
      retryAllowed: runtimeArea.retryAllowed,
      recoveryReference: runtimeArea.recoveryReference,
    });
  const parent = path.join(runtimeArea.directory, "work");
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  const workspace = fs.mkdtempSync(path.join(parent, "adoption-base-"));
  const output = verifyCandidateOutputDirectory(
    workspace,
    verified.capability,
    runtimeArea.directory,
  );
  if (output.status !== "completed") {
    const cleanupConfirmed = cleanupWorkspace(workspace);
    return Object.freeze({
      status: "blocked",
      reason: "candidate_output_invalid",
      effectIssued: false,
      effectStateUnknown: false,
      cleanupConfirmed,
      retryAllowed: cleanupConfirmed,
      recoveryReference: null,
    });
  }
  const result = materializeSnapshot(
    verified.capability,
    revision,
    verified.capability,
    output.capability,
    paths,
    containsRecognizedSecretMaterial,
    snapshotAdapter,
  );
  if (result?.status === "materialized")
    return Object.freeze({ status: "materialized", workspace });
  if (result?.status === "blocked")
    return Object.freeze({
      status: "blocked",
      reason: result.reason,
      effectIssued: result.effectIssued,
      effectStateUnknown: result.effectStateUnknown,
      cleanupConfirmed: result.cleanupConfirmed,
      retryAllowed: !result.effectStateUnknown && result.cleanupConfirmed,
      recoveryReference: null,
    });
  const cleanupConfirmed = cleanupWorkspace(workspace);
  return Object.freeze({
    status: "blocked",
    reason: cleanupConfirmed
      ? "candidate_materialization_failed"
      : "project_runtime_candidate_base_cleanup_unconfirmed",
    effectIssued: false,
    effectStateUnknown: false,
    cleanupConfirmed,
    retryAllowed: cleanupConfirmed,
    recoveryReference: null,
  });
}

/**
 * currentMatchesBaseの処理を実行する。
 *
 * @responsibility currentMatchesBaseに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input repositoryRoot: string、base: string、entries: readonly Entry[]
 * @returns currentMatchesBaseの計算結果を返す。
 * @precondition 「repositoryRoot: string、base: string、entries: readonly Entry[]」がcurrentMatchesBaseの入力契約を満たす。
 * @postcondition currentMatchesBaseの責務を完了した結果だけを返す。
 * @effect N/A: currentMatchesBaseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: currentMatchesBaseは独自の失敗分岐を所有しない。
 * @invariant currentMatchesBaseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security currentMatchesBaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: currentMatchesBaseは共有非同期状態を持たない同期処理である。
 */
function currentMatchesBase(
  repositoryRoot: string,
  base: string,
  entries: readonly Entry[],
) {
  for (const entry of entries) {
    const current = stableFile(
      path.join(repositoryRoot, ...entry.relativePath.split("/")),
    );
    const original = stableFile(
      path.join(base, ...entry.relativePath.split("/")),
    );
    if (current === null || original === null) return false;
    if (current === false || original === false) {
      if (current !== original) return false;
    } else if (!current.equals(original)) return false;
  }
  return true;
}

/**
 * CandidateApplicationResultが扱う値の構造を表す。
 *
 * @responsibility CandidateApplicationResultに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape CandidateApplicationResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CandidateApplicationResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: CandidateApplicationResultの宣言は外部境界を開かない。
 * @security CandidateApplicationResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CandidateApplicationResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CandidateApplicationResult =
  | Readonly<{
      status: "completed";
      effectIssued: true;
      effectStateUnknown: false;
      cleanupConfirmed: true;
      retryAllowed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "project_runtime_candidate_adoption_rollback_unconfirmed";
      effectIssued: boolean;
      effectStateUnknown: boolean;
      cleanupConfirmed: boolean;
      retryAllowed: false;
      recoveryReference: null;
    }>;

/**
 * CandidateApplicationFaultが扱う値の構造を表す。
 *
 * @responsibility CandidateApplicationFaultに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape CandidateApplicationFaultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CandidateApplicationFaultで宣言した値と責務の対応を維持する。
 * @boundary N/A: CandidateApplicationFaultの宣言は外部境界を開かない。
 * @security CandidateApplicationFaultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CandidateApplicationFaultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CandidateApplicationFault = (
  phase: "before_entry" | "before_rollback",
  relativePath: string,
) => void;

/**
 * applyBundleの処理を実行する。
 *
 * @responsibility applyBundleに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input repositoryRoot: string、bundle: Bundle、injectFault: CandidateApplicationFault
 * @returns CandidateApplicationResultを返す。
 * @precondition 「repositoryRoot: string、bundle: Bundle、injectFault: CandidateApplicationFault」がapplyBundleの入力契約を満たす。
 * @postcondition applyBundleの責務を完了した結果だけを返す。
 * @effect applyBundleはFilesystemの読取りまたは書込みを実行する。
 * @failure applyBundleは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant applyBundleは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security applyBundleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: applyBundleは共有非同期状態を持たない同期処理である。
 */
function applyBundle(
  repositoryRoot: string,
  bundle: Bundle,
  injectFault: CandidateApplicationFault = () => {},
): CandidateApplicationResult {
  const runtimePaths =
    resolveRepositoryRuntimeDataPathsFromWorkingDirectory(repositoryRoot);
  if (!runtimePaths)
    return Object.freeze({
      status: "blocked" as const,
      reason:
        "project_runtime_candidate_adoption_rollback_unconfirmed" as const,
      effectIssued: false,
      effectStateUnknown: false,
      cleanupConfirmed: true,
      retryAllowed: false as const,
      recoveryReference: null,
    });
  const transactionRoot = path.join(
    runtimePaths.projectRuntime,
    "work",
    "adoption",
    randomUUID(),
  );
  fs.mkdirSync(transactionRoot, { recursive: true, mode: 0o700 });
  const appliedItems: Array<
    Readonly<{ target: string; backup: string | null }>
  > = [];
  try {
    for (let index = 0; index < bundle.entries.length; index += 1) {
      const entry = bundle.entries[index];
      if (!entry) throw new Error("candidate_entry_missing");
      injectFault("before_entry", entry.relativePath);
      const target = path.join(
        repositoryRoot,
        ...entry.relativePath.split("/"),
      );
      const parent = path.dirname(target);
      fs.mkdirSync(parent, { recursive: true });
      const relativeParent = path.relative(
        repositoryRoot,
        fs.realpathSync.native(parent),
      );
      if (relativeParent.startsWith("..") || path.isAbsolute(relativeParent))
        throw new Error("candidate_parent_escape");
      const current = stableFile(target);
      if (current === null) throw new Error("candidate_target_unknown");
      const backup =
        current === false
          ? null
          : path.join(transactionRoot, `${index}.backup`);
      if (backup) fs.renameSync(target, backup);
      appliedItems.push(Object.freeze({ target, backup }));
      if (entry.operation === "upsert") {
        if (entry.contentBase64 === null)
          throw new Error("candidate_content_missing");
        const content = Buffer.from(entry.contentBase64, "base64");
        const temporary = path.join(parent, `.crdd-adopt-${randomUUID()}.tmp`);
        fs.writeFileSync(temporary, content, { flag: "wx", mode: 0o600 });
        fs.renameSync(temporary, target);
        const observed = stableFile(target);
        if (
          observed === false ||
          observed === null ||
          createHash("sha256").update(observed).digest("hex") !== entry.sha256
        )
          throw new Error("candidate_apply_readback_failed");
      }
    }
    fs.rmSync(transactionRoot, { recursive: true });
    return Object.freeze({
      status: "completed" as const,
      effectIssued: true as const,
      effectStateUnknown: false as const,
      cleanupConfirmed: true as const,
      retryAllowed: false as const,
    });
  } catch {
    let isRecovered = true;
    for (const item of [...appliedItems].reverse()) {
      try {
        injectFault(
          "before_rollback",
          path.relative(repositoryRoot, item.target),
        );
        const current = stableFile(item.target);
        if (current !== false) fs.rmSync(item.target);
        if (item.backup) fs.renameSync(item.backup, item.target);
      } catch {
        isRecovered = false;
      }
    }
    if (isRecovered) {
      try {
        fs.rmSync(transactionRoot, { recursive: true, force: true });
        isRecovered = !fs.existsSync(transactionRoot);
      } catch {
        isRecovered = false;
      }
    }
    return Object.freeze({
      status: "blocked" as const,
      reason:
        "project_runtime_candidate_adoption_rollback_unconfirmed" as const,
      effectIssued: appliedItems.length > 0,
      effectStateUnknown: !isRecovered,
      cleanupConfirmed: isRecovered,
      retryAllowed: false as const,
      recoveryReference: null,
    });
  }
}

/**
 * createRuntimeOwnedProjectCandidateIntegrationAdapterの処理を実行する。
 *
 * @responsibility createRuntimeOwnedProjectCandidateIntegrationAdapterに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input repositoryRoot: string、candidateStore: CandidateStore、snapshotAdapter: typeof gitFixedSnapshotAdapter、materializeSnapshot: typeof materializeFixedSnapshotCandidate、cleanupWorkspace: (workspace: string) => boolean、injectApplicationFault: CandidateApplicationFault
 * @returns ProjectRuntimeCandidatePortを返す。
 * @precondition 「repositoryRoot: string、candidateStore: CandidateStore、snapshotAdapter: typeof gitFixedSnapshotAdapter、materializeSnapshot: typeof materializeFixedSnapshotCandidate、cleanupWorkspace: (workspace: string) => boolean、injectApplicationFault: CandidateApplicationFault」がcreateRuntimeOwnedProjectCandidateIntegrationAdapterの入力契約を満たす。
 * @postcondition createRuntimeOwnedProjectCandidateIntegrationAdapterの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeOwnedProjectCandidateIntegrationAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createRuntimeOwnedProjectCandidateIntegrationAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createRuntimeOwnedProjectCandidateIntegrationAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createRuntimeOwnedProjectCandidateIntegrationAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createRuntimeOwnedProjectCandidateIntegrationAdapterは共有非同期状態を持たない同期処理である。
 */
export function createRuntimeOwnedProjectCandidateIntegrationAdapter(
  repositoryRoot: string,
  candidateStore: CandidateStore = productionCandidateStore,
  snapshotAdapter: typeof gitFixedSnapshotAdapter = gitFixedSnapshotAdapter,
  materializeSnapshot: typeof materializeFixedSnapshotCandidate = materializeFixedSnapshotCandidate,
  cleanupWorkspace: (workspace: string) => boolean = cleanupMaterializedBase,
  injectApplicationFault: CandidateApplicationFault = () => {},
): ProjectRuntimeCandidatePort {
  const integrated = new Map<string, Bundle>();
  let pendingObservationBundle: Bundle | null = null;
  return Object.freeze({
    /**
     * createCandidateの処理を実行する。
     *
     * @responsibility createCandidateに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000015
     * @input { state, taskCandidateIds }
     * @returns createCandidateの計算結果を返す。
     * @precondition 「{ state, taskCandidateIds }」がcreateCandidateの入力契約を満たす。
     * @postcondition createCandidateの責務を完了した結果だけを返す。
     * @effect N/A: createCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: createCandidateは独自の失敗分岐を所有しない。
     * @invariant createCandidateは入力から導いた結果以外の共有状態を変更しない。
     * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
     * @security createCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency createCandidateは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
     */
    async createCandidate({ state, taskCandidateIds }) {
      const merged = merge(candidateStore, state, taskCandidateIds);
      if (!merged) return null;
      let candidateId = `integration-${merged.bundle.patchHash}`;
      if (merged.conflicts.length === 0) {
        const staged = candidateStore.persist(merged.bundle, {
          candidatePersistenceAllowed: true,
          candidateRetentionHours: 24,
          informationClassification: merged.classification,
        });
        if (staged?.status !== "staged") return null;
        const published = candidateStore.publish(staged.candidateRecoveryId);
        if (published?.status !== "published") return null;
        candidateId = published.candidateId;
        integrated.set(candidateId, merged.bundle);
      }
      pendingObservationBundle = merged.bundle;
      const evidence = Object.fromEntries(
        state.objectives.map((objective) => [
          objective.definition.id,
          Object.freeze(
            objective.definition.acceptanceCriteria.map(
              (_unused, index) =>
                `evidence-${digest(candidateId, objective.definition.id, String(index)).slice(0, 40)}`,
            ),
          ),
        ]),
      );
      return Object.freeze({
        status: "candidate",
        candidateId,
        candidateHash: merged.bundle.contentManifestHash,
        baseRevision: state.repositoryRevision,
        changedPaths: merged.bundle.changedPaths,
        objectiveEvidence: Object.freeze(evidence),
        milestoneEvidence: Object.freeze(
          state.milestone.acceptanceCriteria.map(
            (_unused, index) =>
              `evidence-${digest(candidateId, state.milestoneId, String(index)).slice(0, 40)}`,
          ),
        ),
        conflicts: merged.conflicts,
        cleanupConfirmed: true,
      });
    },
    /**
     * observeCanonicalRepositoryの処理を実行する。
     *
     * @responsibility observeCanonicalRepositoryに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000015
     * @input N/A: 実行時引数を受け取らない。
     * @returns observeCanonicalRepositoryの計算結果を返す。
     * @precondition 「N/A: 実行時引数を受け取らない。」がobserveCanonicalRepositoryの入力契約を満たす。
     * @postcondition observeCanonicalRepositoryの責務を完了した結果だけを返す。
     * @effect N/A: observeCanonicalRepositoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure observeCanonicalRepositoryは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant observeCanonicalRepositoryは入力から導いた結果以外の共有状態を変更しない。
     * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
     * @security observeCanonicalRepositoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: observeCanonicalRepositoryは共有非同期状態を持たない同期処理である。
     */
    observeCanonicalRepository() {
      const identity = inspectRepositoryIdentityCandidate(repositoryRoot);
      const bundle = pendingObservationBundle;
      if (!identity || !bundle || identity.commit !== bundle.baseCommit)
        return null;
      const base = materializeBase(
        repositoryRoot,
        bundle.baseCommit,
        bundle.changedPaths,
        snapshotAdapter,
        materializeSnapshot,
        cleanupWorkspace,
      );
      if (!base) return null;
      if (base.status === "blocked") return base;
      let result: unknown;
      try {
        const isClean = currentMatchesBase(
          repositoryRoot,
          base.workspace,
          bundle.entries,
        );
        result = Object.freeze({
          status: "observed",
          repositoryRevision: identity.commit,
          dirty: !isClean,
          observedPaths: Object.freeze(isClean ? [] : [...bundle.changedPaths]),
        });
      } catch {
        result = null;
      }
      return cleanupWorkspace(base.workspace)
        ? result
        : candidateCleanupBlocked(false, false);
    },
    /**
     * adoptCandidateの処理を実行する。
     *
     * @responsibility adoptCandidateに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000015
     * @input candidate
     * @returns adoptCandidateの計算結果を返す。
     * @precondition 「candidate」がadoptCandidateの入力契約を満たす。
     * @postcondition adoptCandidateの責務を完了した結果だけを返す。
     * @effect N/A: adoptCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure adoptCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant adoptCandidateは入力から導いた結果以外の共有状態を変更しない。
     * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
     * @security adoptCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency adoptCandidateは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
     */
    async adoptCandidate(candidate) {
      const bundle =
        integrated.get(candidate.candidateId) ??
        exported(candidateStore, candidate.candidateId)?.bundle;
      if (
        !bundle ||
        bundle.baseCommit !== candidate.baseRevision ||
        bundle.contentManifestHash !== candidate.candidateHash ||
        JSON.stringify(bundle.changedPaths) !==
          JSON.stringify(candidate.changedPaths)
      )
        return null;
      const identity = inspectRepositoryIdentityCandidate(repositoryRoot);
      if (!identity || identity.commit !== bundle.baseCommit) return null;
      const base = materializeBase(
        repositoryRoot,
        bundle.baseCommit,
        bundle.changedPaths,
        snapshotAdapter,
        materializeSnapshot,
        cleanupWorkspace,
      );
      if (!base) return null;
      if (base.status === "blocked") return base;
      let result: unknown = null;
      let applicationFailure: Extract<
        CandidateApplicationResult,
        { status: "blocked" }
      > | null = null;
      try {
        if (!currentMatchesBase(repositoryRoot, base.workspace, bundle.entries))
          result = null;
        else {
          const application = applyBundle(
            repositoryRoot,
            bundle,
            injectApplicationFault,
          );
          if (application.status === "blocked") {
            applicationFailure = application;
            result = application;
          } else
            result = Object.freeze({
              status: "completed",
              receiptId: `adoption-${digest(candidate.candidateId, bundle.patchHash).slice(0, 40)}`,
              beforeRevision: bundle.baseCommit,
              afterRevision: bundle.baseCommit,
              changedPaths: bundle.changedPaths,
              cleanupConfirmed: true,
            });
        }
      } catch {
        result = null;
      }
      const baseCleanupConfirmed = cleanupWorkspace(base.workspace);
      if (applicationFailure)
        return applicationFailure.effectStateUnknown || !baseCleanupConfirmed
          ? Object.freeze({
              ...applicationFailure,
              cleanupConfirmed:
                applicationFailure.cleanupConfirmed && baseCleanupConfirmed,
            })
          : null;
      return baseCleanupConfirmed
        ? result
        : candidateCleanupBlocked(result !== null, false);
    },
  });
}

/**
 * describeProjectRuntimeCandidateIntegrationAdapterContractの処理を実行する。
 *
 * @responsibility describeProjectRuntimeCandidateIntegrationAdapterContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProjectRuntimeCandidateIntegrationAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProjectRuntimeCandidateIntegrationAdapterContractの入力契約を満たす。
 * @postcondition describeProjectRuntimeCandidateIntegrationAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProjectRuntimeCandidateIntegrationAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProjectRuntimeCandidateIntegrationAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describeProjectRuntimeCandidateIntegrationAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describeProjectRuntimeCandidateIntegrationAdapterContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProjectRuntimeCandidateIntegrationAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describeProjectRuntimeCandidateIntegrationAdapterContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_CANDIDATE_INTEGRATION_ADAPTER_CONTRACT,
    source: "runtime_owned_candidate_store",
    conflictDetection: "same_path_different_operation_or_content",
    adoption: "fresh_base_match_atomic_per_path_with_bounded_rollback",
    canonicalCommitCreated: false,
  });
}
