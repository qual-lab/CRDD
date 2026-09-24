/**
 * repository-layout-adapterに属する責務をまとめる。
 *
 * @responsibility readExactRepositoryRootを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000002
 */
import path from "node:path";
import { types as utilTypes } from "node:util";

import {
  resolveRepositoryGitLayout,
  summarizeRepositoryGitLayout,
} from "./repository-layout.ts";

export const GIT_REPOSITORY_LAYOUT_ADAPTER_CONTRACT =
  "crdd-version-control/git-repository-layout-adapter/v1" as const;
export const GIT_REPOSITORY_LAYOUT_ADAPTER_CONTRACT_REVISION = 1 as const;

const MAX_PATH_CHARACTERS = 4096;

/**
 * Exact Repository Rootを読み取る。
 *
 * @responsibility Exact Repository Rootの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000002
 * @input value: unknown
 * @returns string | nullを返す。
 * @precondition 「value: unknown」がreadExactRepositoryRootの入力契約を満たす。
 * @postcondition readExactRepositoryRootの責務を完了した結果だけを返す。
 * @effect N/A: readExactRepositoryRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readExactRepositoryRootは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readExactRepositoryRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: readExactRepositoryRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readExactRepositoryRootは共有非同期状態を持たない同期処理である。
 */
function readExactRepositoryRoot(value: unknown): string | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      utilTypes.isProxy(value) ||
      Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).length !== 1) return null;
    const descriptor = descriptors.repositoryRoot;
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, "value") ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      descriptor.enumerable !== true
    )
      return null;
    const candidate = descriptor.value;
    return typeof candidate === "string" &&
      candidate.length > 0 &&
      candidate.length <= MAX_PATH_CHARACTERS &&
      path.isAbsolute(candidate) &&
      !/[\u0000-\u001f\u007f]/u.test(candidate)
      ? candidate
      : null;
  } catch {
    return null;
  }
}

/**
 * responseを決定する。
 *
 * @responsibility responseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000002
 * @input status: S、reason: string、layout: T | null
 * @returns responseの計算結果を返す。
 * @precondition 「status: S、reason: string、layout: T | null」がresponseの入力契約を満たす。
 * @postcondition responseの責務を完了した結果だけを返す。
 * @effect N/A: responseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: responseは独自の失敗分岐を所有しない。
 * @invariant responseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: responseはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: responseは共有非同期状態を持たない同期処理である。
 */
function response<const S extends string, T>(
  status: S,
  reason: string,
  layout: T | null = null,
) {
  return Object.freeze({
    status,
    reason,
    layout,
    pathsRecorded: false,
    gitMetadataWriteIssued: false,
    runtimeCapabilityIssued: false,
  });
}

/**
 * Git Repository Layout 候補を観測する。
 *
 * @responsibility Git Repository Layout 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input rawInput: unknown
 * @returns inspectGitRepositoryLayoutCandidateの計算結果を返す。
 * @precondition 「rawInput: unknown」がinspectGitRepositoryLayoutCandidateの入力契約を満たす。
 * @postcondition inspectGitRepositoryLayoutCandidateの責務を完了した結果だけを返す。
 * @effect N/A: inspectGitRepositoryLayoutCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectGitRepositoryLayoutCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectGitRepositoryLayoutCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: inspectGitRepositoryLayoutCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectGitRepositoryLayoutCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectGitRepositoryLayoutCandidate(rawInput: unknown) {
  const repositoryRoot = readExactRepositoryRoot(rawInput);
  if (repositoryRoot === null)
    return response("blocked", "repository_git_layout_input_invalid");
  try {
    const layout = resolveRepositoryGitLayout(repositoryRoot);
    return response(
      "candidate",
      "repository_git_layout_resolved_candidate",
      summarizeRepositoryGitLayout(layout),
    );
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error ? error.code : null;
    const message = error instanceof Error ? error.message : "";
    if (code === "ENOENT")
      return response("blocked", "repository_worktree_required");
    if (
      [
        "repository_git_marker_link_rejected",
        "repository_git_file_invalid",
        "repository_git_marker_invalid",
        "repository_git_config_unsupported",
      ].includes(message)
    )
      return response("blocked", message);
    return response("blocked", "repository_git_layout_invalid");
  }
}

/**
 * Git Repository Layout Adapter 契約の公開契約を記述する。
 *
 * @responsibility Git Repository Layout Adapter 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000002
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeGitRepositoryLayoutAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeGitRepositoryLayoutAdapterContractの入力契約を満たす。
 * @postcondition describeGitRepositoryLayoutAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describeGitRepositoryLayoutAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeGitRepositoryLayoutAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describeGitRepositoryLayoutAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: describeGitRepositoryLayoutAdapterContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeGitRepositoryLayoutAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describeGitRepositoryLayoutAdapterContract() {
  return Object.freeze({
    contract: GIT_REPOSITORY_LAYOUT_ADAPTER_CONTRACT,
    contractRevision: GIT_REPOSITORY_LAYOUT_ADAPTER_CONTRACT_REVISION,
    supportedWorktreeForms: Object.freeze([
      "normal_worktree",
      "linked_worktree",
      "gitfile_worktree_without_core_worktree",
      "gitfile_worktree_with_matching_core_worktree",
    ]),
    supportedRepositoryFormat: "version_0_without_extensions_or_includes",
    gitCliAuthorityRequired: false,
    bareRepositorySupported: false,
    referencedSubmodulesModified: false,
    referencedRepositoriesModified: false,
    multiRepositoryWriteOperationSupported: false,
    commonGitDirectoryExcludeBackend: true,
    filesystemResolutionCore: "implemented",
    repositoryIdentityVerification: "repository_location_port",
    metadataPlacementLayoutVerification: "implemented_narrow_parser",
    metadataWriteIntegration: "repository_local_ignore_port",
    runtimeCapabilityIssued: false,
  });
}
