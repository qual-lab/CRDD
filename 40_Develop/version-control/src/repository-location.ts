/**
 * repository-locationに属する責務をまとめる。
 *
 * @responsibility VerifiedRepositoryRootを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000002
 */
import fs from "node:fs";
import path from "node:path";

import { resolveRepositoryGitLayout } from "./git/repository-layout.ts";

export const REPOSITORY_LOCATION_CONTRACT =
  "crdd-version-control/repository-location/v1" as const;
export const REPOSITORY_LOCATION_CONTRACT_REVISION = 1 as const;

const roots = new WeakMap<object, string>();

/**
 * repository-locationで使用するVerified Repository Rootの値契約を定義する。
 *
 * @responsibility Verified Repository RootのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape VerifiedRepositoryRootが表すProperty、識別子およびRelationを型として固定する。
 * @invariant VerifiedRepositoryRootで宣言した値と責務の対応を維持する。
 * @boundary N/A: VerifiedRepositoryRootの宣言は外部境界を開かない。
 * @security N/A: VerifiedRepositoryRootはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility VerifiedRepositoryRootの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type VerifiedRepositoryRoot = Readonly<{
  contract: typeof REPOSITORY_LOCATION_CONTRACT;
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
  const normalizedLeft = path.normalize(left);
  const normalizedRight = path.normalize(right);
  return process.platform === "win32"
    ? normalizedLeft.toLocaleLowerCase("en-US") ===
        normalizedRight.toLocaleLowerCase("en-US")
    : normalizedLeft === normalizedRight;
}

/**
 * Missingかを判定する。
 *
 * @responsibility Missingの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000002
 * @input error: unknown
 * @returns booleanを返す。
 * @precondition 「error: unknown」がisMissingの入力契約を満たす。
 * @postcondition isMissingの責務を完了した結果だけを返す。
 * @effect N/A: isMissingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isMissingは独自の失敗分岐を所有しない。
 * @invariant isMissingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isMissingはProcess内の同一Subsystemで完結する。
 * @security N/A: isMissingはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isMissingは共有非同期状態を持たない同期処理である。
 */
function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

/**
 * Absolute Directoryが有効か判定する。
 *
 * @responsibility Absolute Directoryの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000002
 * @input candidate: unknown
 * @returns candidate is stringを返す。
 * @precondition 「candidate: unknown」がvalidAbsoluteDirectoryの入力契約を満たす。
 * @postcondition validAbsoluteDirectoryの責務を完了した結果だけを返す。
 * @effect validAbsoluteDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure validAbsoluteDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validAbsoluteDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: validAbsoluteDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validAbsoluteDirectoryは共有非同期状態を持たない同期処理である。
 */
function validAbsoluteDirectory(candidate: unknown): candidate is string {
  if (
    typeof candidate !== "string" ||
    candidate.length === 0 ||
    !path.isAbsolute(candidate) ||
    /[\u0000-\u001f\u007f]/u.test(candidate)
  )
    return false;
  try {
    const resolved = path.resolve(candidate);
    const metadata = fs.lstatSync(resolved);
    return (
      metadata.isDirectory() &&
      !metadata.isSymbolicLink() &&
      samePath(fs.realpathSync.native(resolved), resolved)
    );
  } catch {
    return false;
  }
}

/**
 * Exact Repository Rootを観測する。
 *
 * @responsibility Exact Repository Rootの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input candidate: unknown
 * @returns string | nullを返す。
 * @precondition 「candidate: unknown」がobserveExactRepositoryRootの入力契約を満たす。
 * @postcondition observeExactRepositoryRootの責務を完了した結果だけを返す。
 * @effect N/A: observeExactRepositoryRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeExactRepositoryRootは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeExactRepositoryRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeExactRepositoryRootはProcess内の同一Subsystemで完結する。
 * @security N/A: observeExactRepositoryRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: observeExactRepositoryRootは共有非同期状態を持たない同期処理である。
 */
function observeExactRepositoryRoot(candidate: unknown): string | null {
  if (!validAbsoluteDirectory(candidate)) return null;
  try {
    const root = path.resolve(candidate);
    const layout = resolveRepositoryGitLayout(root);
    return samePath(layout.root.realPath, root) ? layout.root.realPath : null;
  } catch {
    return null;
  }
}

/**
 * Capabilityを発行する。
 *
 * @responsibility Capabilityの発行条件、Identity、非発行時のEffect 0境界を所有する。
 * @trace ARCH-000002
 * @input root: string
 * @returns VerifiedRepositoryRootを返す。
 * @precondition 「root: string」がissueCapabilityの入力契約を満たす。
 * @postcondition issueCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: issueCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: issueCapabilityは独自の失敗分岐を所有しない。
 * @invariant issueCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: issueCapabilityはProcess内の同一Subsystemで完結する。
 * @security N/A: issueCapabilityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: issueCapabilityは共有非同期状態を持たない同期処理である。
 */
function issueCapability(root: string): VerifiedRepositoryRoot {
  const capability = Object.freeze({
    contract: REPOSITORY_LOCATION_CONTRACT,
  });
  roots.set(capability, root);
  return capability;
}

/**
 * Repository Rootを検証する。
 *
 * @responsibility Repository Rootの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000002
 * @input candidate: unknown
 * @returns | Readonly<{ status: "completed"; reason: "repository_root_verified"; capability: VerifiedRepositoryRoot; }> | Readonly<{ status: "blocked"; reason: "repository_root_invalid"; capability: null; }>を返す。
 * @precondition 「candidate: unknown」がverifyRepositoryRootの入力契約を満たす。
 * @postcondition verifyRepositoryRootの責務を完了した結果だけを返す。
 * @effect N/A: verifyRepositoryRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyRepositoryRootは独自の失敗分岐を所有しない。
 * @invariant verifyRepositoryRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRepositoryRootはProcess内の同一Subsystemで完結する。
 * @security N/A: verifyRepositoryRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifyRepositoryRootは共有非同期状態を持たない同期処理である。
 */
export function verifyRepositoryRoot(candidate: unknown):
  | Readonly<{
      status: "completed";
      reason: "repository_root_verified";
      capability: VerifiedRepositoryRoot;
    }>
  | Readonly<{
      status: "blocked";
      reason: "repository_root_invalid";
      capability: null;
    }> {
  const root = observeExactRepositoryRoot(candidate);
  return root === null
    ? Object.freeze({
        status: "blocked" as const,
        reason: "repository_root_invalid" as const,
        capability: null,
      })
    : Object.freeze({
        status: "completed" as const,
        reason: "repository_root_verified" as const,
        capability: issueCapability(root),
      });
}

/**
 * Selects the nearest enclosing repository. A present but invalid repository
 *
 * @responsibility Repository Root From Working Directoryの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000002
 * @input workingDirectory: unknown
 * @returns ReturnType<typeof verifyRepositoryRoot>を返す。
 * @precondition 「workingDirectory: unknown」がverifyRepositoryRootFromWorkingDirectoryの入力契約を満たす。
 * @postcondition verifyRepositoryRootFromWorkingDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: verifyRepositoryRootFromWorkingDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyRepositoryRootFromWorkingDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyRepositoryRootFromWorkingDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRepositoryRootFromWorkingDirectoryはProcess内の同一Subsystemで完結する。
 * @security N/A: verifyRepositoryRootFromWorkingDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifyRepositoryRootFromWorkingDirectoryは共有非同期状態を持たない同期処理である。
 */
export function verifyRepositoryRootFromWorkingDirectory(
  workingDirectory: unknown,
): ReturnType<typeof verifyRepositoryRoot> {
  try {
    return verifyRepositoryRoot(
      resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory),
    );
  } catch {
    return verifyRepositoryRoot(null);
  }
}

/**
 * Verified Repository Rootを一意に解決する。
 *
 * @responsibility Verified Repository Rootの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot
 * @returns string | nullを返す。
 * @precondition 「capability: VerifiedRepositoryRoot」がresolveVerifiedRepositoryRootの入力契約を満たす。
 * @postcondition resolveVerifiedRepositoryRootの責務を完了した結果だけを返す。
 * @effect N/A: resolveVerifiedRepositoryRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveVerifiedRepositoryRootは独自の失敗分岐を所有しない。
 * @invariant resolveVerifiedRepositoryRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveVerifiedRepositoryRootはProcess内の同一Subsystemで完結する。
 * @security resolveVerifiedRepositoryRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveVerifiedRepositoryRootは共有非同期状態を持たない同期処理である。
 */
export function resolveVerifiedRepositoryRoot(
  capability: VerifiedRepositoryRoot,
): string | null {
  const stored = roots.get(capability);
  if (stored === undefined) return null;
  const observed = observeExactRepositoryRoot(stored);
  return observed !== null && samePath(observed, stored) ? stored : null;
}

/**
 * Verified Repository Root From Working Directoryを一意に解決する。
 *
 * @responsibility Verified Repository Root From Working Directoryの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000002
 * @input workingDirectory: unknown
 * @returns stringを返す。
 * @precondition 「workingDirectory: unknown」がresolveVerifiedRepositoryRootFromWorkingDirectoryの入力契約を満たす。
 * @postcondition resolveVerifiedRepositoryRootFromWorkingDirectoryの責務を完了した結果だけを返す。
 * @effect resolveVerifiedRepositoryRootFromWorkingDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure resolveVerifiedRepositoryRootFromWorkingDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveVerifiedRepositoryRootFromWorkingDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: resolveVerifiedRepositoryRootFromWorkingDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveVerifiedRepositoryRootFromWorkingDirectoryは共有非同期状態を持たない同期処理である。
 */
export function resolveVerifiedRepositoryRootFromWorkingDirectory(
  workingDirectory: unknown,
): string {
  if (!validAbsoluteDirectory(workingDirectory))
    throw new Error("repository_working_directory_invalid");
  let current = path.resolve(workingDirectory);
  for (;;) {
    const marker = path.join(current, ".git");
    try {
      fs.lstatSync(marker);
    } catch (error) {
      if (!isMissing(error))
        throw new Error("repository_root_observation_failed");
      const parent = path.dirname(current);
      if (parent === current)
        throw new Error("verified_repository_root_required");
      current = parent;
      continue;
    }
    if (observeExactRepositoryRoot(current) === null)
      throw new Error("repository_boundary_invalid");
    return current;
  }
}

/**
 * Repository Location 契約の公開契約を記述する。
 *
 * @responsibility Repository Location 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000002
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeRepositoryLocationContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeRepositoryLocationContractの入力契約を満たす。
 * @postcondition describeRepositoryLocationContractの責務を完了した結果だけを返す。
 * @effect N/A: describeRepositoryLocationContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeRepositoryLocationContractは独自の失敗分岐を所有しない。
 * @invariant describeRepositoryLocationContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeRepositoryLocationContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeRepositoryLocationContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeRepositoryLocationContractは共有非同期状態を持たない同期処理である。
 */
export function describeRepositoryLocationContract() {
  return Object.freeze({
    contract: REPOSITORY_LOCATION_CONTRACT,
    contractRevision: REPOSITORY_LOCATION_CONTRACT_REVISION,
    selection: "nearest_enclosing_verified_repository_root",
    workingDirectoryIsRepositoryAuthority: false,
    invalidNestedBoundaryTraversalAllowed: false,
    pathReported: false,
    filesystemEffectIssued: false,
  });
}
