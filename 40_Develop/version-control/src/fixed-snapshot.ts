import fs from "node:fs";
import path from "node:path";

import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "./repository-location.ts";

export const FIXED_SNAPSHOT_CONTRACT = "crdd-version-control/fixed-snapshot/v1";
export const FIXED_SNAPSHOT_CONTRACT_REVISION = 1;

const candidateOutputs = new WeakMap<
  object,
  Readonly<{
    path: string;
    dev: bigint;
    ino: bigint;
    birthtimeNs: bigint;
    ownerCapability: object;
    ownerDirectory: Readonly<{
      path: string;
      dev: bigint;
      ino: bigint;
      birthtimeNs: bigint;
    }>;
  }>
>();
const CANDIDATE_OUTPUT_BRAND: unique symbol = Symbol("candidate-output");

/**
 * CandidateOutputCapabilityが扱う値の構造を表す。
 *
 * @responsibility CandidateOutputCapabilityに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape CandidateOutputCapabilityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CandidateOutputCapabilityで宣言した値と責務の対応を維持する。
 * @boundary N/A: CandidateOutputCapabilityの宣言は外部境界を開かない。
 * @security N/A: CandidateOutputCapabilityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CandidateOutputCapabilityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CandidateOutputCapability = Readonly<{
  contract: "crdd-version-control/candidate-output/v1";
  [CANDIDATE_OUTPUT_BRAND]: true;
}>;

/**
 * FixedSnapshotIdentityが扱う値の構造を表す。
 *
 * @responsibility FixedSnapshotIdentityに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape FixedSnapshotIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FixedSnapshotIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: FixedSnapshotIdentityの宣言は外部境界を開かない。
 * @security N/A: FixedSnapshotIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility FixedSnapshotIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type FixedSnapshotIdentity = Readonly<{
  contract: typeof FIXED_SNAPSHOT_CONTRACT;
  contractRevision: typeof FIXED_SNAPSHOT_CONTRACT_REVISION;
  status: "observed";
  revisionIdentity: string;
  snapshotIdentity: string;
  objectFormat: "sha1";
  observationComplete: true;
  repositoryPathReported: false;
}>;

/**
 * FixedSnapshotFileが扱う値の構造を表す。
 *
 * @responsibility FixedSnapshotFileに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape FixedSnapshotFileが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FixedSnapshotFileで宣言した値と責務の対応を維持する。
 * @boundary N/A: FixedSnapshotFileの宣言は外部境界を開かない。
 * @security N/A: FixedSnapshotFileはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility FixedSnapshotFileの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type FixedSnapshotFile = Readonly<{
  status: "read";
  revisionIdentity: string;
  relativePath: string;
  mode: "100644" | "100755";
  bytes: Buffer;
  sha256: string;
  repositoryPathReported: false;
}>;

/**
 * CandidateMaterializationが扱う値の構造を表す。
 *
 * @responsibility CandidateMaterializationに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape CandidateMaterializationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CandidateMaterializationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CandidateMaterializationの宣言は外部境界を開かない。
 * @security N/A: CandidateMaterializationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CandidateMaterializationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CandidateMaterialization = Readonly<{
  status: "materialized";
  baseRevisionIdentity: string;
  baseSnapshotIdentity: string;
  fileCount: number;
  byteLength: number;
  contentManifestHash: string;
  repositoryPathReported: false;
  workspacePathReported: false;
}>;

/**
 * CandidateMaterializationBlockedが扱う値の構造を表す。
 *
 * @responsibility CandidateMaterializationBlockedに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape CandidateMaterializationBlockedが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CandidateMaterializationBlockedで宣言した値と責務の対応を維持する。
 * @boundary N/A: CandidateMaterializationBlockedの宣言は外部境界を開かない。
 * @security N/A: CandidateMaterializationBlockedはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CandidateMaterializationBlockedの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CandidateMaterializationBlocked = Readonly<{
  status: "blocked";
  reason:
    | "fixed_snapshot_content_policy_rejected"
    | "candidate_output_invalid"
    | "candidate_materialization_failed"
    | "candidate_materialization_cleanup_unconfirmed";
  effectIssued: boolean;
  effectStateUnknown: boolean;
  cleanupConfirmed: boolean;
  repositoryPathReported: false;
  workspacePathReported: false;
}>;

/**
 * FixedSnapshotContentPolicyが扱う値の構造を表す。
 *
 * @responsibility FixedSnapshotContentPolicyに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape FixedSnapshotContentPolicyが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FixedSnapshotContentPolicyで宣言した値と責務の対応を維持する。
 * @boundary N/A: FixedSnapshotContentPolicyの宣言は外部境界を開かない。
 * @security N/A: FixedSnapshotContentPolicyはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility FixedSnapshotContentPolicyの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type FixedSnapshotContentPolicy = (
  relativePath: string,
  bytes: Uint8Array,
) => boolean;

/**
 * FixedSnapshotAdapterが扱う値の構造を表す。
 *
 * @responsibility FixedSnapshotAdapterに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000002
 * @shape FixedSnapshotAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FixedSnapshotAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: FixedSnapshotAdapterの宣言は外部境界を開かない。
 * @security N/A: FixedSnapshotAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility FixedSnapshotAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type FixedSnapshotAdapter = Readonly<{
  inspect(
    repositoryRoot: string,
    revision: string,
  ): FixedSnapshotIdentity | null;
  readFile(
    repositoryRoot: string,
    revision: string,
    relativePath: string,
  ): FixedSnapshotFile | null;
  materialize(
    repositoryRoot: string,
    revision: string,
    workspace: string,
    readPaths: readonly string[] | null,
    contentPolicy: FixedSnapshotContentPolicy | null,
  ): CandidateMaterialization | CandidateMaterializationBlocked | null;
}>;

/**
 * samePathの処理を実行する。
 *
 * @responsibility samePathに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input left: string、right: string
 * @returns booleanを返す。
 * @precondition 「left: string、right: string」がsamePathの入力契約を満たす。
 * @postcondition samePathの責務を完了した結果だけを返す。
 * @effect samePathは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: samePathは独自の失敗分岐を所有しない。
 * @invariant samePathは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: samePathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: samePathは共有非同期状態を持たない同期処理である。
 */
function samePath(left: string, right: string): boolean {
  return process.platform === "win32"
    ? path.normalize(left).toLocaleLowerCase("en-US") ===
        path.normalize(right).toLocaleLowerCase("en-US")
    : path.normalize(left) === path.normalize(right);
}

/**
 * observeCandidateOutputの処理を実行する。
 *
 * @responsibility observeCandidateOutputに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input candidate: unknown
 * @returns observeCandidateOutputの計算結果を返す。
 * @precondition 「candidate: unknown」がobserveCandidateOutputの入力契約を満たす。
 * @postcondition observeCandidateOutputの責務を完了した結果だけを返す。
 * @effect observeCandidateOutputはFilesystemの読取りまたは書込みを実行する。
 * @failure observeCandidateOutputは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeCandidateOutputは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: observeCandidateOutputはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: observeCandidateOutputは共有非同期状態を持たない同期処理である。
 */
function observeCandidateOutput(candidate: unknown) {
  if (
    typeof candidate !== "string" ||
    !path.isAbsolute(candidate) ||
    /[\u0000-\u001f\u007f]/u.test(candidate)
  )
    return null;
  try {
    const resolved = path.resolve(candidate);
    const metadata = fs.lstatSync(resolved, { bigint: true });
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      !samePath(fs.realpathSync.native(resolved), resolved)
    )
      return null;
    return Object.freeze({
      path: resolved,
      dev: metadata.dev,
      ino: metadata.ino,
      birthtimeNs: metadata.birthtimeNs,
    });
  } catch {
    return null;
  }
}

/**
 * verifyCandidateOutputDirectoryの処理を実行する。
 *
 * @responsibility verifyCandidateOutputDirectoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input candidate: unknown、ownerCapability: unknown、ownerDirectory: unknown
 * @returns | Readonly<{ status: "completed"; capability: CandidateOutputCapability; pathReported: false; }> | Readonly<{ status: "blocked"; capability: null; pathReported: false; }>を返す。
 * @precondition 「candidate: unknown、ownerCapability: unknown、ownerDirectory: unknown」がverifyCandidateOutputDirectoryの入力契約を満たす。
 * @postcondition verifyCandidateOutputDirectoryの責務を完了した結果だけを返す。
 * @effect verifyCandidateOutputDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure verifyCandidateOutputDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyCandidateOutputDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: verifyCandidateOutputDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifyCandidateOutputDirectoryは共有非同期状態を持たない同期処理である。
 */
export function verifyCandidateOutputDirectory(
  candidate: unknown,
  ownerCapability: unknown,
  ownerDirectory: unknown,
):
  | Readonly<{
      status: "completed";
      capability: CandidateOutputCapability;
      pathReported: false;
    }>
  | Readonly<{
      status: "blocked";
      capability: null;
      pathReported: false;
    }> {
  const observed = observeCandidateOutput(candidate);
  const observedOwner = observeCandidateOutput(ownerDirectory);
  let isEmpty = false;
  try {
    isEmpty = observed !== null && fs.readdirSync(observed.path).length === 0;
  } catch {
    isEmpty = false;
  }
  if (
    observed === null ||
    !isEmpty ||
    observedOwner === null ||
    !ownerCapability ||
    typeof ownerCapability !== "object" ||
    (() => {
      const relative = path.relative(observedOwner.path, observed.path);
      return relative.startsWith("..") || path.isAbsolute(relative);
    })()
  )
    return Object.freeze({
      status: "blocked" as const,
      capability: null,
      pathReported: false as const,
    });
  const capability = Object.freeze({
    contract: "crdd-version-control/candidate-output/v1" as const,
    [CANDIDATE_OUTPUT_BRAND]: true as const,
  });
  candidateOutputs.set(
    capability,
    Object.freeze({
      ...observed,
      ownerCapability,
      ownerDirectory: observedOwner,
    }),
  );
  return Object.freeze({
    status: "completed" as const,
    capability,
    pathReported: false as const,
  });
}

/**
 * resolveCandidateOutputDirectoryの処理を実行する。
 *
 * @responsibility resolveCandidateOutputDirectoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input capability: CandidateOutputCapability、ownerCapability: object
 * @returns string | nullを返す。
 * @precondition 「capability: CandidateOutputCapability、ownerCapability: object」がresolveCandidateOutputDirectoryの入力契約を満たす。
 * @postcondition resolveCandidateOutputDirectoryの責務を完了した結果だけを返す。
 * @effect resolveCandidateOutputDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure resolveCandidateOutputDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveCandidateOutputDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security resolveCandidateOutputDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveCandidateOutputDirectoryは共有非同期状態を持たない同期処理である。
 */
function resolveCandidateOutputDirectory(
  capability: CandidateOutputCapability,
  ownerCapability: object,
): string | null {
  const stored = candidateOutputs.get(capability);
  const observed = stored ? observeCandidateOutput(stored.path) : null;
  const observedOwner = stored
    ? observeCandidateOutput(stored.ownerDirectory.path)
    : null;
  try {
    return observed !== null &&
      stored !== undefined &&
      stored.ownerCapability === ownerCapability &&
      observedOwner !== null &&
      observedOwner.dev === stored.ownerDirectory.dev &&
      observedOwner.ino === stored.ownerDirectory.ino &&
      observedOwner.birthtimeNs === stored.ownerDirectory.birthtimeNs &&
      observed.dev === stored.dev &&
      observed.ino === stored.ino &&
      observed.birthtimeNs === stored.birthtimeNs &&
      fs.readdirSync(observed.path).length === 0
      ? observed.path
      : null;
  } catch {
    return null;
  }
}

/**
 * blockedMaterializationの処理を実行する。
 *
 * @responsibility blockedMaterializationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input reason: CandidateMaterializationBlocked["reason"]、effectIssued: boolean、isEffectStateUnknown: boolean、cleanupConfirmed: boolean
 * @returns CandidateMaterializationBlockedを返す。
 * @precondition 「reason: CandidateMaterializationBlocked["reason"]、effectIssued: boolean、isEffectStateUnknown: boolean、cleanupConfirmed: boolean」がblockedMaterializationの入力契約を満たす。
 * @postcondition blockedMaterializationの責務を完了した結果だけを返す。
 * @effect N/A: blockedMaterializationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedMaterializationは独自の失敗分岐を所有しない。
 * @invariant blockedMaterializationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedMaterializationはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedMaterializationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedMaterializationは共有非同期状態を持たない同期処理である。
 */
function blockedMaterialization(
  reason: CandidateMaterializationBlocked["reason"],
  effectIssued: boolean,
  isEffectStateUnknown: boolean,
  cleanupConfirmed: boolean,
): CandidateMaterializationBlocked {
  return Object.freeze({
    status: "blocked",
    reason,
    effectIssued,
    effectStateUnknown: isEffectStateUnknown,
    cleanupConfirmed,
    repositoryPathReported: false,
    workspacePathReported: false,
  });
}

/**
 * inspectFixedSnapshotの処理を実行する。
 *
 * @responsibility inspectFixedSnapshotに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot、revision: string、adapter: FixedSnapshotAdapter
 * @returns FixedSnapshotIdentity | nullを返す。
 * @precondition 「capability: VerifiedRepositoryRoot、revision: string、adapter: FixedSnapshotAdapter」がinspectFixedSnapshotの入力契約を満たす。
 * @postcondition inspectFixedSnapshotの責務を完了した結果だけを返す。
 * @effect N/A: inspectFixedSnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectFixedSnapshotは独自の失敗分岐を所有しない。
 * @invariant inspectFixedSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectFixedSnapshotはProcess内の同一Subsystemで完結する。
 * @security inspectFixedSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectFixedSnapshotは共有非同期状態を持たない同期処理である。
 */
export function inspectFixedSnapshot(
  capability: VerifiedRepositoryRoot,
  revision: string,
  adapter: FixedSnapshotAdapter,
): FixedSnapshotIdentity | null {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null
    ? null
    : adapter.inspect(repositoryRoot, revision);
}

/**
 * readFixedSnapshotFileの処理を実行する。
 *
 * @responsibility readFixedSnapshotFileに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot、revision: string、relativePath: string、adapter: FixedSnapshotAdapter
 * @returns FixedSnapshotFile | nullを返す。
 * @precondition 「capability: VerifiedRepositoryRoot、revision: string、relativePath: string、adapter: FixedSnapshotAdapter」がreadFixedSnapshotFileの入力契約を満たす。
 * @postcondition readFixedSnapshotFileの責務を完了した結果だけを返す。
 * @effect readFixedSnapshotFileはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: readFixedSnapshotFileは独自の失敗分岐を所有しない。
 * @invariant readFixedSnapshotFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readFixedSnapshotFileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readFixedSnapshotFileは共有非同期状態を持たない同期処理である。
 */
export function readFixedSnapshotFile(
  capability: VerifiedRepositoryRoot,
  revision: string,
  relativePath: string,
  adapter: FixedSnapshotAdapter,
): FixedSnapshotFile | null {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null
    ? null
    : adapter.readFile(repositoryRoot, revision, relativePath);
}

/**
 * materializeFixedSnapshotCandidateの処理を実行する。
 *
 * @responsibility materializeFixedSnapshotCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot、revision: string、ownerCapability: object、outputCapability: CandidateOutputCapability、readPaths: readonly string[] | null、contentPolicy: FixedSnapshotContentPolicy | null、adapter: FixedSnapshotAdapter
 * @returns CandidateMaterialization | CandidateMaterializationBlocked | nullを返す。
 * @precondition 「capability: VerifiedRepositoryRoot、revision: string、ownerCapability: object、outputCapability: CandidateOutputCapability、readPaths: readonly string[] | null、contentPolicy: FixedSnapshotContentPolicy | null、adapter: FixedSnapshotAdapter」がmaterializeFixedSnapshotCandidateの入力契約を満たす。
 * @postcondition materializeFixedSnapshotCandidateの責務を完了した結果だけを返す。
 * @effect materializeFixedSnapshotCandidateはFilesystemの読取りまたは書込みを実行する。
 * @failure materializeFixedSnapshotCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant materializeFixedSnapshotCandidateは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security materializeFixedSnapshotCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: materializeFixedSnapshotCandidateは共有非同期状態を持たない同期処理である。
 */
export function materializeFixedSnapshotCandidate(
  capability: VerifiedRepositoryRoot,
  revision: string,
  ownerCapability: object,
  outputCapability: CandidateOutputCapability,
  readPaths: readonly string[] | null,
  contentPolicy: FixedSnapshotContentPolicy | null,
  adapter: FixedSnapshotAdapter,
): CandidateMaterialization | CandidateMaterializationBlocked | null {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  const workspace = resolveCandidateOutputDirectory(
    outputCapability,
    ownerCapability,
  );
  if (repositoryRoot === null) return null;
  if (workspace === null)
    return blockedMaterialization(
      "candidate_output_invalid",
      false,
      false,
      true,
    );
  let result:
    | CandidateMaterialization
    | CandidateMaterializationBlocked
    | null = null;
  try {
    result = adapter.materialize(
      repositoryRoot,
      revision,
      workspace,
      readPaths,
      contentPolicy,
    );
    if (result?.status === "materialized") return result;
  } catch {
    result = null;
  }
  let effectIssued = true;
  try {
    effectIssued = fs.readdirSync(workspace).length > 0;
  } catch {
    effectIssued = true;
  }
  try {
    fs.rmSync(workspace, { recursive: true });
    if (fs.existsSync(workspace))
      throw new Error("candidate_output_cleanup_failed");
  } catch {
    return blockedMaterialization(
      "candidate_materialization_cleanup_unconfirmed",
      effectIssued,
      true,
      false,
    );
  }
  return blockedMaterialization(
    result?.status === "blocked"
      ? result.reason
      : "candidate_materialization_failed",
    effectIssued,
    false,
    true,
  );
}
