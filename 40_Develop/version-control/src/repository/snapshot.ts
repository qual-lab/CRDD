/**
 * 固定Snapshotの検査・読取り・許可出力先への実体化を所有する。
 * @responsibility 固定Snapshotの検査・読取り・許可出力先への実体化を所有する。
 * @trace ARCH-000002
 */
import fs from "node:fs";
import path from "node:path";
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "./location.ts";
import {
  inspectGitCommitTreeCandidate,
  materializeGitCommitTreeCandidate,
  materializeGitReleaseCandidateTree,
  readGitCommitFileCandidate,
} from "../git/objects.ts";
import { resolveRepositoryGitLayout } from "./layout.ts";

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
 * fixed-snapshotで使用する候補 出力 Capabilityの値契約を定義する。
 *
 * @responsibility 候補 出力 CapabilityのProperty、Identity、状態制約を型境界として所有する。
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
 * fixed-snapshotで使用するFixed Snapshot Identityの値契約を定義する。
 *
 * @responsibility Fixed Snapshot IdentityのProperty、Identity、状態制約を型境界として所有する。
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
 * fixed-snapshotで使用するFixed Snapshot Fileの値契約を定義する。
 *
 * @responsibility Fixed Snapshot FileのProperty、Identity、状態制約を型境界として所有する。
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
 * fixed-snapshotで使用する候補 Materializationの値契約を定義する。
 *
 * @responsibility 候補 MaterializationのProperty、Identity、状態制約を型境界として所有する。
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
 * fixed-snapshotで使用する候補 Materialization Blockedの値契約を定義する。
 *
 * @responsibility 候補 Materialization BlockedのProperty、Identity、状態制約を型境界として所有する。
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
 * fixed-snapshotで使用するFixed Snapshot Content Policyの値契約を定義する。
 *
 * @responsibility Fixed Snapshot Content PolicyのProperty、Identity、状態制約を型境界として所有する。
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
 * fixed-snapshotで使用するFixed Snapshot Adapterの値契約を定義する。
 *
 * @responsibility Fixed Snapshot AdapterのProperty、Identity、状態制約を型境界として所有する。
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
    maximumBytes?: number,
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
 * Pathが同一かを判定する。
 *
 * @responsibility Pathの同一性Propertyと一致／不一致境界を所有する。
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
 * 候補 出力を観測する。
 *
 * @responsibility 候補 出力の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input candidate: unknown
 * @returns observeCandidateOutputの計算結果を返す。
 * @precondition 「candidate: unknown」がobserveCandidateOutputの入力契約を満たす。
 * @postcondition observeCandidateOutputの責務を完了した結果だけを返す。
 * @effect 出力先のFilesystem実体を読み取る。書込みは行わない。
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
 * 候補 出力 Directoryを検証する。
 *
 * @responsibility 候補 出力 Directoryの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000002
 * @input candidate: unknown、ownerCapability: unknown、ownerDirectory: unknown
 * @returns | Readonly<{ status: "completed"; capability: CandidateOutputCapability; pathReported: false; }> | Readonly<{ status: "blocked"; capability: null; pathReported: false; }>を返す。
 * @precondition 「candidate: unknown、ownerCapability: unknown、ownerDirectory: unknown」がverifyCandidateOutputDirectoryの入力契約を満たす。
 * @postcondition verifyCandidateOutputDirectoryの責務を完了した結果だけを返す。
 * @effect 出力先の実体を読み取り、Process内のopaque能力へ結合する。Fileの書込みは行わない。
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
 * 候補 出力 Directoryを一意に解決する。
 *
 * @responsibility 候補 出力 Directoryの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000002
 * @input capability: CandidateOutputCapability、ownerCapability: object
 * @returns string | nullを返す。
 * @precondition 「capability: CandidateOutputCapability、ownerCapability: object」がresolveCandidateOutputDirectoryの入力契約を満たす。
 * @postcondition resolveCandidateOutputDirectoryの責務を完了した結果だけを返す。
 * @effect 出力先のFilesystem実体を再確認する。書込みは行わない。
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
 * Materializationを停止結果として構築する。
 *
 * @responsibility Materializationの停止理由、未発行Effect、公開結果境界を所有する。
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
 * Fixed Snapshotを観測する。
 *
 * @responsibility Fixed Snapshotの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot、revision: string、adapter: FixedSnapshotAdapter
 * @returns FixedSnapshotIdentity | nullを返す。
 * @precondition 「capability: VerifiedRepositoryRoot、revision: string、adapter: FixedSnapshotAdapter」がinspectFixedSnapshotの入力契約を満たす。
 * @postcondition inspectFixedSnapshotの責務を完了した結果だけを返す。
 * @effect 指定Adapterへ固定内容の読取り検査を委譲する。
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
 * Fixed Snapshot Fileを読み取る。
 *
 * @responsibility Fixed Snapshot Fileの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot、revision: string、relativePath: string、adapter: FixedSnapshotAdapter、maximumBytes?: number（省略時64KiB、明示時1byteから64MiB）
 * @returns FixedSnapshotFile | nullを返す。
 * @precondition 「capability: VerifiedRepositoryRoot、revision: string、relativePath: string、adapter: FixedSnapshotAdapter」がreadFixedSnapshotFileの入力契約を満たす。
 * @postcondition readFixedSnapshotFileの責務を完了した結果だけを返す。
 * @effect 指定Adapterへ固定Fileの有界読取りを委譲する。
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
  maximumBytes?: number,
): FixedSnapshotFile | null {
  if (
    maximumBytes !== undefined &&
    (typeof maximumBytes !== "number" ||
      !Number.isSafeInteger(maximumBytes) ||
      maximumBytes < 1 ||
      maximumBytes > 64 * 1024 * 1024)
  )
    return null;
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null
    ? null
    : maximumBytes === undefined
      ? adapter.readFile(repositoryRoot, revision, relativePath)
      : adapter.readFile(repositoryRoot, revision, relativePath, maximumBytes);
}

/**
 * Fixed Snapshot 候補をFilesystem上の候補として具体化する。
 *
 * @responsibility Fixed Snapshot 候補の入力Snapshot、書込み範囲、部分生成の失敗境界を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot、revision: string、ownerCapability: object、outputCapability: CandidateOutputCapability、readPaths: readonly string[] | null、contentPolicy: FixedSnapshotContentPolicy | null、adapter: FixedSnapshotAdapter
 * @returns CandidateMaterialization | CandidateMaterializationBlocked | nullを返す。
 * @precondition 「capability: VerifiedRepositoryRoot、revision: string、ownerCapability: object、outputCapability: CandidateOutputCapability、readPaths: readonly string[] | null、contentPolicy: FixedSnapshotContentPolicy | null、adapter: FixedSnapshotAdapter」がmaterializeFixedSnapshotCandidateの入力契約を満たす。
 * @postcondition materializeFixedSnapshotCandidateの責務を完了した結果だけを返す。
 * @effect 検証済み出力先への生成をAdapterへ委譲し、失敗時は同出力先の自己生成物を回収し得る。
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

export const gitFixedSnapshotAdapter: FixedSnapshotAdapter = Object.freeze({
  /**
   * fixed-snapshot-adapterを観測する。
   *
   * @responsibility fixed-snapshot-adapterの観測対象、取得根拠、観測不能結果の境界を所有する。
   * @trace ARCH-000002
   * @input repositoryRoot、revision
   * @returns inspectの計算結果を返す。
   * @precondition 「repositoryRoot、revision」がinspectの入力契約を満たす。
   * @postcondition inspectの責務を完了した結果だけを返す。
   * @effect Git配置と固定Objectを読み取る。書込みは行わない。
   * @failure N/A: inspectは独自の失敗分岐を所有しない。
   * @invariant inspectは入力から導いた結果以外の共有状態を変更しない。
   * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
   * @security N/A: inspectはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: inspectは共有非同期状態を持たない同期処理である。
   */
  inspect(repositoryRoot, revision) {
    const layout = resolveRepositoryGitLayout(repositoryRoot);
    const result = inspectGitCommitTreeCandidate({
      commonDirectory: layout.commonDirectory.realPath,
      revision,
    });
    return result?.status === "candidate"
      ? Object.freeze({
          contract: "crdd-version-control/fixed-snapshot/v1" as const,
          contractRevision: 1 as const,
          status: "observed" as const,
          revisionIdentity: result.commit,
          snapshotIdentity: result.tree,
          objectFormat: "sha1" as const,
          observationComplete: true as const,
          repositoryPathReported: false as const,
        })
      : null;
  },
  /**
   * Fileを読み取る。
   *
   * @responsibility Fileの読取り元、上限、読取不能時の結果境界を所有する。
   * @trace ARCH-000002
   * @input repositoryRoot、revision、relativePath
   * @returns readFileの計算結果を返す。
   * @precondition 「repositoryRoot、revision、relativePath」がreadFileの入力契約を満たす。
   * @postcondition readFileの責務を完了した結果だけを返す。
   * @effect Git配置と固定Blobを読み取る。書込みは行わない。
   * @failure N/A: readFileは独自の失敗分岐を所有しない。
   * @invariant readFileは入力から導いた結果以外の共有状態を変更しない。
   * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
   * @security N/A: readFileはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: readFileは共有非同期状態を持たない同期処理である。
   */
  readFile(repositoryRoot, revision, relativePath, maximumBytes) {
    const layout = resolveRepositoryGitLayout(repositoryRoot);
    const result = readGitCommitFileCandidate({
      commonDirectory: layout.commonDirectory.realPath,
      revision,
      relativePath,
      ...(maximumBytes === undefined ? {} : { maximumBytes }),
    });
    return result?.status === "read"
      ? Object.freeze({
          status: "read" as const,
          revisionIdentity: result.revision,
          relativePath: result.relativePath,
          mode: result.mode,
          bytes: result.bytes,
          sha256: result.sha256,
          repositoryPathReported: false as const,
        })
      : null;
  },
  /**
   * fixed-snapshot-adapterをFilesystem上の候補として具体化する。
   *
   * @responsibility fixed-snapshot-adapterの入力Snapshot、書込み範囲、部分生成の失敗境界を所有する。
   * @trace ARCH-000002
   * @input repositoryRoot、revision、workspace、readPaths、contentPolicy
   * @returns materializeの計算結果を返す。
   * @precondition 「repositoryRoot、revision、workspace、readPaths、contentPolicy」がmaterializeの入力契約を満たす。
   * @postcondition materializeの責務を完了した結果だけを返す。
   * @effect 固定内容を許可された出力先へ生成する。元Repositoryの作業Treeは変更しない。
   * @failure N/A: materializeは独自の失敗分岐を所有しない。
   * @invariant materializeは入力から導いた結果以外の共有状態を変更しない。
   * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
   * @security N/A: materializeはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: materializeは共有非同期状態を持たない同期処理である。
   */
  materialize(repositoryRoot, revision, workspace, readPaths, contentPolicy) {
    const layout = resolveRepositoryGitLayout(repositoryRoot);
    const input = {
      commonDirectory: layout.commonDirectory.realPath,
      revision,
      workspace,
      ...(readPaths === null ? {} : { readPaths }),
    };
    const result =
      contentPolicy === null
        ? materializeGitReleaseCandidateTree(input)
        : materializeGitCommitTreeCandidate(input, contentPolicy);
    if (result?.status === "blocked")
      return Object.freeze({
        status: "blocked" as const,
        reason: "fixed_snapshot_content_policy_rejected" as const,
        effectIssued: false,
        effectStateUnknown: false,
        cleanupConfirmed: true,
        repositoryPathReported: false as const,
        workspacePathReported: false as const,
      });
    return result?.status === "materialized"
      ? Object.freeze({
          status: "materialized" as const,
          baseRevisionIdentity: result.baseCommit,
          baseSnapshotIdentity: result.baseTree,
          fileCount: result.fileCount,
          byteLength: result.byteLength,
          contentManifestHash: result.contentManifestHash,
          repositoryPathReported: false as const,
          workspacePathReported: false as const,
        })
      : null;
  },
});

/**
 * Repository Fixed Snapshotを観測する。
 *
 * @responsibility Repository Fixed Snapshotの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot、revision: string
 * @returns inspectRepositoryFixedSnapshotの計算結果を返す。
 * @precondition 「capability: VerifiedRepositoryRoot、revision: string」がinspectRepositoryFixedSnapshotの入力契約を満たす。
 * @postcondition inspectRepositoryFixedSnapshotの責務を完了した結果だけを返す。
 * @effect 指定AdapterへRepositoryの固定内容の読取り検査を委譲する。
 * @failure N/A: inspectRepositoryFixedSnapshotは独自の失敗分岐を所有しない。
 * @invariant inspectRepositoryFixedSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 指定Adapterの固定内容観測と検査結果の境界。
 * @security inspectRepositoryFixedSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRepositoryFixedSnapshotは共有非同期状態を持たない同期処理である。
 */
export function inspectRepositoryFixedSnapshot(
  capability: VerifiedRepositoryRoot,
  revision: string,
) {
  return inspectFixedSnapshot(capability, revision, gitFixedSnapshotAdapter);
}
