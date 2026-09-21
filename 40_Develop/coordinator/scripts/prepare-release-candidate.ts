/**
 * prepare-release-candidateに属する責務をまとめる。
 *
 * @responsibility PreparationInputを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ensureRepositoryRuntimeDataArea } from "../../runtime-data/src/index.ts";
import {
  inspectFixedSnapshot,
  materializeFixedSnapshotCandidate,
  verifyCandidateOutputDirectory,
} from "../../version-control/src/fixed-snapshot.ts";
import { gitFixedSnapshotAdapter } from "../../version-control/src/git/fixed-snapshot-adapter.ts";
import { verifyRepositoryRoot } from "../../version-control/src/repository-location.ts";

export const RELEASE_CANDIDATE_PREPARATION_CONTRACT =
  "crdd-coordinator/release-candidate-preparation";
export const RELEASE_CANDIDATE_PREPARATION_CONTRACT_REVISION = 1;

const REVISION = /^[a-f0-9]{40}$/u;
const CANDIDATE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/u;

/**
 * prepare-release-candidateで使用するPreparation 入力の値契約を定義する。
 *
 * @responsibility Preparation 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape PreparationInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PreparationInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: PreparationInputの宣言は外部境界を開かない。
 * @security N/A: PreparationInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility PreparationInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PreparationInput = Readonly<{
  repositoryRoot: string;
  revision: string;
  candidateName: string;
}>;

/**
 * prepare-release-candidateを停止結果として構築する。
 *
 * @responsibility prepare-release-candidateの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: string、residuePresent、materialization: Readonly<{ effectIssued: boolean; effectStateUnknown: boolean; cleanupConfirmed: boolean; retryAllowed: boolean; recoveryReference: string | null; }>
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string、residuePresent、materialization: Readonly<{ effectIssued: boolean; effectStateUnknown: boolean; cleanupConfirmed: boolean; retryAllowed: boolean; recoveryReference: string | null; }>」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(
  reason: string,
  residuePresent = false,
  materialization: Readonly<{
    effectIssued: boolean;
    effectStateUnknown: boolean;
    cleanupConfirmed: boolean;
    retryAllowed: boolean;
    recoveryReference: string | null;
  }> = Object.freeze({
    effectIssued: false,
    effectStateUnknown: false,
    cleanupConfirmed: true,
    retryAllowed: false,
    recoveryReference: null,
  }),
) {
  return Object.freeze({
    contract: RELEASE_CANDIDATE_PREPARATION_CONTRACT,
    contractRevision: RELEASE_CANDIDATE_PREPARATION_CONTRACT_REVISION,
    status: "blocked" as const,
    reason,
    residuePresent,
    ...materialization,
    candidateCreated: false,
    externalGitCliUsed: false,
    shellUsed: false,
    repositoryPathReported: false,
    candidatePathReported: false,
  });
}

/**
 * Directoryを安定Identityへ変換する。
 *
 * @responsibility Directoryの正規化条件、一意性、変換不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input target: string
 * @returns stableDirectoryの計算結果を返す。
 * @precondition 「target: string」がstableDirectoryの入力契約を満たす。
 * @postcondition stableDirectoryの責務を完了した結果だけを返す。
 * @effect stableDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure stableDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant stableDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: stableDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: stableDirectoryは共有非同期状態を持たない同期処理である。
 */
function stableDirectory(target: string) {
  const metadata = fs.lstatSync(target);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error("release_candidate_directory_invalid");
  }
  return fs.realpathSync.native(target);
}

/**
 * Release 候補を実行前候補として準備する。
 *
 * @responsibility Release 候補の準備条件、候補Identity、Effect前の拒否境界を所有する。
 * @trace ARCH-000004
 * @input input: PreparationInput
 * @returns prepareReleaseCandidateの計算結果を返す。
 * @precondition 「input: PreparationInput」がprepareReleaseCandidateの入力契約を満たす。
 * @postcondition prepareReleaseCandidateの責務を完了した結果だけを返す。
 * @effect prepareReleaseCandidateはFilesystemの読取りまたは書込みを実行する。
 * @failure prepareReleaseCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant prepareReleaseCandidateは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: prepareReleaseCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: prepareReleaseCandidateは共有非同期状態を持たない同期処理である。
 */
export function prepareReleaseCandidate(input: PreparationInput) {
  let preparingRoot: string | null = null;
  try {
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Reflect.ownKeys(input).length !== 3 ||
      !Reflect.ownKeys(input).every(
        (key) =>
          typeof key === "string" &&
          ["repositoryRoot", "revision", "candidateName"].includes(key),
      ) ||
      typeof input.repositoryRoot !== "string" ||
      !path.isAbsolute(input.repositoryRoot) ||
      typeof input.revision !== "string" ||
      !REVISION.test(input.revision) ||
      typeof input.candidateName !== "string" ||
      !CANDIDATE_NAME.test(input.candidateName)
    ) {
      return blocked("release_candidate_input_invalid");
    }

    const repositoryRoot = stableDirectory(input.repositoryRoot);
    if (repositoryRoot !== path.resolve(input.repositoryRoot)) {
      return blocked("release_candidate_repository_alias_rejected");
    }
    const verifiedRuntimeRoot = verifyRepositoryRoot(repositoryRoot);
    if (verifiedRuntimeRoot.status !== "completed")
      return blocked("release_candidate_runtime_data_path_invalid");
    const inspected = inspectFixedSnapshot(
      verifiedRuntimeRoot.capability,
      input.revision,
      gitFixedSnapshotAdapter,
    );
    if (inspected?.status !== "observed") {
      return blocked("release_candidate_revision_invalid");
    }

    const releaseArea = ensureRepositoryRuntimeDataArea(
      verifiedRuntimeRoot.capability,
      "release",
    );
    if (releaseArea?.status === "blocked")
      return blocked(releaseArea.reason, false, {
        effectIssued: releaseArea.effectIssued,
        effectStateUnknown: releaseArea.effectStateUnknown,
        cleanupConfirmed: releaseArea.cleanupConfirmed,
        retryAllowed: releaseArea.retryAllowed,
        recoveryReference: releaseArea.recoveryReference,
      });
    if (
      releaseArea?.status !== "ready" ||
      releaseArea.repositoryRoot !== repositoryRoot
    )
      return blocked("release_candidate_runtime_data_path_invalid");
    const stagingRoot = releaseArea.directory;
    const candidateRoot = path.join(stagingRoot, input.candidateName);
    preparingRoot = path.join(stagingRoot, `${input.candidateName}.preparing`);
    if (fs.existsSync(candidateRoot) || fs.existsSync(preparingRoot)) {
      return blocked("release_candidate_destination_exists");
    }

    fs.mkdirSync(preparingRoot);
    if (stableDirectory(preparingRoot) !== preparingRoot) {
      throw new Error("release_candidate_preparing_alias_rejected");
    }
    const output = verifyCandidateOutputDirectory(
      preparingRoot,
      releaseArea,
      releaseArea.directory,
    );
    if (output.status !== "completed")
      return blocked("release_candidate_destination_invalid", true);
    const materialized = materializeFixedSnapshotCandidate(
      verifiedRuntimeRoot.capability,
      input.revision,
      releaseArea,
      output.capability,
      null,
      null,
      gitFixedSnapshotAdapter,
    );
    if (!materialized)
      return blocked("release_candidate_materialization_failed", true);
    if (materialized.status === "blocked")
      return blocked(
        materialized.reason,
        !materialized.cleanupConfirmed,
        Object.freeze({
          effectIssued: materialized.effectIssued,
          effectStateUnknown: materialized.effectStateUnknown,
          cleanupConfirmed: materialized.cleanupConfirmed,
          retryAllowed:
            !materialized.effectStateUnknown && materialized.cleanupConfirmed,
          recoveryReference:
            materialized.effectStateUnknown || !materialized.cleanupConfirmed
              ? `release-candidate.${input.candidateName}`
              : null,
        }),
      );
    if (
      materialized.baseRevisionIdentity !== inspected.revisionIdentity ||
      materialized.baseSnapshotIdentity !== inspected.snapshotIdentity
    ) {
      return blocked("release_candidate_identity_mismatch", true);
    }

    fs.renameSync(preparingRoot, candidateRoot);
    preparingRoot = null;
    if (stableDirectory(candidateRoot) !== candidateRoot) {
      return blocked("release_candidate_publication_unconfirmed", true);
    }
    const inspectedAfter = inspectFixedSnapshot(
      verifiedRuntimeRoot.capability,
      input.revision,
      gitFixedSnapshotAdapter,
    );
    if (
      inspectedAfter?.status !== "observed" ||
      inspectedAfter.revisionIdentity !== inspected.revisionIdentity ||
      inspectedAfter.snapshotIdentity !== inspected.snapshotIdentity
    ) {
      return blocked(
        "release_candidate_source_changed_after_publication",
        true,
      );
    }

    return Object.freeze({
      contract: RELEASE_CANDIDATE_PREPARATION_CONTRACT,
      contractRevision: RELEASE_CANDIDATE_PREPARATION_CONTRACT_REVISION,
      status: "prepared" as const,
      reason: "release_candidate_prepared",
      commit: inspected.revisionIdentity,
      tree: inspected.snapshotIdentity,
      fileCount: materialized.fileCount,
      byteLength: materialized.byteLength,
      contentManifestHash: materialized.contentManifestHash,
      residuePresent: false,
      candidateCreated: true,
      externalGitCliUsed: false,
      shellUsed: false,
      repositoryPathReported: false,
      candidatePathReported: false,
    });
  } catch {
    return blocked(
      "release_candidate_preparation_failed_closed",
      preparingRoot !== null && fs.existsSync(preparingRoot),
    );
  }
}

/**
 * argument Valueを決定する。
 *
 * @responsibility argument Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input args: readonly string[]、name: string
 * @returns argumentValueの計算結果を返す。
 * @precondition 「args: readonly string[]、name: string」がargumentValueの入力契約を満たす。
 * @postcondition argumentValueの責務を完了した結果だけを返す。
 * @effect N/A: argumentValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: argumentValueは独自の失敗分岐を所有しない。
 * @invariant argumentValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: argumentValueはProcess内の同一Subsystemで完結する。
 * @security N/A: argumentValueはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: argumentValueは共有非同期状態を持たない同期処理である。
 */
function argumentValue(args: readonly string[], name: string) {
  const index = args.indexOf(name);
  if (
    index < 0 ||
    index + 1 >= args.length ||
    args.lastIndexOf(name) !== index
  ) {
    return null;
  }
  return args[index + 1] ?? null;
}

/**
 * Release 候補 Argumentsを構造化値へ解析する。
 *
 * @responsibility Release 候補 Argumentsの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000004
 * @input args: readonly string[]
 * @returns parseReleaseCandidateArgumentsの計算結果を返す。
 * @precondition 「args: readonly string[]」がparseReleaseCandidateArgumentsの入力契約を満たす。
 * @postcondition parseReleaseCandidateArgumentsの責務を完了した結果だけを返す。
 * @effect N/A: parseReleaseCandidateArgumentsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseReleaseCandidateArgumentsは独自の失敗分岐を所有しない。
 * @invariant parseReleaseCandidateArgumentsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseReleaseCandidateArgumentsはProcess内の同一Subsystemで完結する。
 * @security N/A: parseReleaseCandidateArgumentsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseReleaseCandidateArgumentsは共有非同期状態を持たない同期処理である。
 */
export function parseReleaseCandidateArguments(args: readonly string[]) {
  if (
    args.length !== 6 ||
    !["--repository-root", "--revision", "--candidate-name"].every((name) =>
      args.includes(name),
    )
  ) {
    return null;
  }
  const repositoryRoot = argumentValue(args, "--repository-root");
  const revision = argumentValue(args, "--revision");
  const candidateName = argumentValue(args, "--candidate-name");
  return repositoryRoot && revision && candidateName
    ? Object.freeze({ repositoryRoot, revision, candidateName })
    : null;
}

/**
 * prepare-release-candidateのCommand処理を開始する。
 *
 * @responsibility prepare-release-candidateの引数受付、終了Code、診断出力境界を所有する。
 * @trace ARCH-000004
 * @input args
 * @returns N/A: mainは戻り値を返さない。
 * @precondition 「args」がmainの入力契約を満たす。
 * @postcondition mainの責務を完了して呼出し元へ制御を戻す。
 * @effect mainは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: mainは独自の失敗分岐を所有しない。
 * @invariant mainは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: mainはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: mainは共有非同期状態を持たない同期処理である。
 */
export function main(args = process.argv.slice(2)) {
  const input = parseReleaseCandidateArguments(args);
  const result = input
    ? prepareReleaseCandidate(input)
    : blocked("release_candidate_arguments_invalid");
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "prepared" ? 0 : 2;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
