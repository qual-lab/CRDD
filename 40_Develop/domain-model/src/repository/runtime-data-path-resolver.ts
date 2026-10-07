/**
 * Repository Runtime領域の読取り専用解決・観測。
 *
 * @responsibility 検証済みRoot、宣言用途、真正不存在・観測不能とCROSの用途限定Rootを区別する。
 * @trace ARCH-000011
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/repository-identity/index.ts";
import { CROS_DIRECTORY_ID } from "../configuration/runtime-data-contract.ts";
import {
  REPOSITORY_AREAS,
  AREA_PATH_KEYS,
} from "../configuration/runtime-data-paths.ts";
import type {
  RepositoryRuntimeArea,
  RepositoryRuntimeDataAreaObservation,
  CrosRootInput,
} from "./types.ts";

/**
 * Resolves only canonical paths. The caller remains responsible for proving
 *
 * @responsibility Repository Runtime Data Paths From Validated Rootの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input repositoryRoot: string
 * @returns resolveRepositoryRuntimeDataPathsFromValidatedRootの計算結果を返す。
 * @precondition 「repositoryRoot: string」がresolveRepositoryRuntimeDataPathsFromValidatedRootの入力契約を満たす。
 * @postcondition resolveRepositoryRuntimeDataPathsFromValidatedRootの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryRuntimeDataPathsFromValidatedRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryRuntimeDataPathsFromValidatedRootは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryRuntimeDataPathsFromValidatedRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryRuntimeDataPathsFromValidatedRootはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveRepositoryRuntimeDataPathsFromValidatedRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveRepositoryRuntimeDataPathsFromValidatedRootは共有非同期状態を持たない同期処理である。
 */
function resolveRepositoryRuntimeDataPathsFromValidatedRoot(
  repositoryRoot: string,
) {
  if (
    !path.isAbsolute(repositoryRoot) ||
    path.resolve(repositoryRoot) !== repositoryRoot
  )
    return null;
  const root = path.join(repositoryRoot, ".crdd");
  return Object.freeze({
    repositoryRoot,
    root,
    config: path.join(root, "config"),
    repositoryManifest: path.join(root, "config", "repository-manifest.json"),
    externalSendPolicy: path.join(root, "config", "external-send-policy.json"),
    projectRuntime: path.join(root, "project-runtime"),
    coordinator: path.join(root, "coordinator"),
    executionIntelligence: path.join(root, "execution-intelligence"),
    candidates: path.join(root, "candidates"),
    release: path.join(root, "release"),
    communication: path.join(root, "communication"),
    tests: path.join(root, "tests"),
    temporary: path.join(root, "tmp"),
    allowedTopLevelAreas: REPOSITORY_AREAS,
  });
}

/**
 * Protected signing-only resolver. It derives the root from this package's
 *
 * @responsibility Bundled Repository Runtime Data Paths For Protected Signingの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input N/A: 実行時引数を受け取らない。
 * @returns resolveBundledRepositoryRuntimeDataPathsForProtectedSigningの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がresolveBundledRepositoryRuntimeDataPathsForProtectedSigningの入力契約を満たす。
 * @postcondition resolveBundledRepositoryRuntimeDataPathsForProtectedSigningの責務を完了した結果だけを返す。
 * @effect resolveBundledRepositoryRuntimeDataPathsForProtectedSigningはFilesystemの読取りまたは書込みを実行する。
 * @failure resolveBundledRepositoryRuntimeDataPathsForProtectedSigningは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveBundledRepositoryRuntimeDataPathsForProtectedSigningは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: resolveBundledRepositoryRuntimeDataPathsForProtectedSigningはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveBundledRepositoryRuntimeDataPathsForProtectedSigningは共有非同期状態を持たない同期処理である。
 */
export function resolveBundledRepositoryRuntimeDataPathsForProtectedSigning() {
  try {
    const repositoryRoot = path.resolve(
      fileURLToPath(new URL("../../../../", import.meta.url)),
    );
    const relativeSegments = path
      .relative(path.parse(repositoryRoot).root, repositoryRoot)
      .split(path.sep)
      .filter(Boolean);
    let current = path.parse(repositoryRoot).root;
    for (const segment of relativeSegments) {
      current = path.join(current, segment);
      if (fs.lstatSync(current).isSymbolicLink()) return null;
    }
    const metadata = fs.lstatSync(repositoryRoot);
    const marker = fs.lstatSync(path.join(repositoryRoot, ".git"));
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(repositoryRoot) !== repositoryRoot ||
      marker.isSymbolicLink() ||
      (!marker.isDirectory() && !marker.isFile())
    )
      return null;
    return resolveRepositoryRuntimeDataPathsFromValidatedRoot(repositoryRoot);
  } catch {
    return null;
  }
}

/**
 * Repository Runtime Data Pathsを一意に解決する。
 *
 * @responsibility Repository Runtime Data Pathsの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input capability: VerifiedRepositoryRoot
 * @returns resolveRepositoryRuntimeDataPathsの計算結果を返す。
 * @precondition 「capability: VerifiedRepositoryRoot」がresolveRepositoryRuntimeDataPathsの入力契約を満たす。
 * @postcondition resolveRepositoryRuntimeDataPathsの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryRuntimeDataPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryRuntimeDataPathsは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryRuntimeDataPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryRuntimeDataPathsはProcess内の同一Subsystemで完結する。
 * @security resolveRepositoryRuntimeDataPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRepositoryRuntimeDataPathsは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryRuntimeDataPaths(
  capability: VerifiedRepositoryRoot,
) {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  if (repositoryRoot === null) return null;
  const resolved =
    resolveRepositoryRuntimeDataPathsFromValidatedRoot(repositoryRoot);
  if (!resolved) return null;
  const { root: internalRoot, ...publicPaths } = resolved;
  if (path.dirname(internalRoot) !== resolved.repositoryRoot) return null;
  return Object.freeze(publicPaths);
}

/**
 * Runtime Data implementation-only path set; omitted from the public index.
 *
 * @responsibility Repository Runtime Data Paths For Internal Useの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input capability: VerifiedRepositoryRoot
 * @returns resolveRepositoryRuntimeDataPathsForInternalUseの計算結果を返す。
 * @precondition 「capability: VerifiedRepositoryRoot」がresolveRepositoryRuntimeDataPathsForInternalUseの入力契約を満たす。
 * @postcondition resolveRepositoryRuntimeDataPathsForInternalUseの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryRuntimeDataPathsForInternalUseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryRuntimeDataPathsForInternalUseは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryRuntimeDataPathsForInternalUseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryRuntimeDataPathsForInternalUseはProcess内の同一Subsystemで完結する。
 * @security resolveRepositoryRuntimeDataPathsForInternalUseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRepositoryRuntimeDataPathsForInternalUseは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryRuntimeDataPathsForInternalUse(
  capability: VerifiedRepositoryRoot,
) {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null
    ? null
    : resolveRepositoryRuntimeDataPathsFromValidatedRoot(repositoryRoot);
}

/**
 * private Rootと名前付き領域の既存境界をOwner内で観測する。
 * @responsibility 利用側によるParent Rootの復元を不要にし、真正不存在と観測障害を分ける。
 * @trace ARCH-000011
 * @input capability: 検証済みRepository Root能力、area: 宣言済み領域名。
 * @returns ready、not_observed、blockedの閉じた観測結果。
 * @precondition Callerは公開されたRepository Root能力を渡す。
 * @postcondition readyではRootとareaのlstat/realpath相関を確認済みである。
 * @effect Filesystem metadataとVCS境界を読む。Ignore登録、mkdir、Lock、書込みは0。
 * @failure 無効能力、link/type不正、観測障害を閉じたreasonで返す。
 * @invariant ENOENTだけをnot_observedとし、時刻やmtimeをIdentityに使わない。
 * @boundary private Runtime Rootと公開された名前付きareaの観測境界。
 * @security raw Root、秘密値、回復Authorityを公開しない。
 * @concurrency 開始・終了の不透明Identity比較で境界置換を検出できる。将来の状態を保証しない。
 */
export function observeRepositoryRuntimeDataArea(
  capability: VerifiedRepositoryRoot,
  area: RepositoryRuntimeArea,
): RepositoryRuntimeDataAreaObservation {
  try {
    const paths = resolveRepositoryRuntimeDataPathsForInternalUse(capability);
    if (!paths || !REPOSITORY_AREAS.includes(area))
      return Object.freeze({
        status: "blocked",
        reason: "repository_runtime_data_root_capability_invalid",
        effectIssued: false,
      });
    const directory = paths[AREA_PATH_KEYS[area]];
    const identities: string[] = [];
    for (const target of [paths.root, directory]) {
      let metadata: fs.BigIntStats;
      try {
        metadata = fs.lstatSync(target, { bigint: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return Object.freeze({
            status: "not_observed",
            reason: "repository_runtime_data_area_absent",
            effectIssued: false,
          });
        throw error;
      }
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync.native(target) !== target
      )
        return Object.freeze({
          status: "blocked",
          reason: "repository_runtime_data_area_boundary_invalid",
          effectIssued: false,
        });
      const canonical = fs.lstatSync(fs.realpathSync.native(target), {
        bigint: true,
      });
      if (canonical.dev !== metadata.dev || canonical.ino !== metadata.ino)
        return Object.freeze({
          status: "blocked",
          reason: "repository_runtime_data_area_boundary_invalid",
          effectIssued: false,
        });
      identities.push(metadata.dev.toString(), metadata.ino.toString());
    }
    const boundaryIdentity = createHash("sha256")
      .update(identities.join("\0"))
      .digest("hex");
    return Object.freeze({
      status: "ready",
      repositoryRoot: paths.repositoryRoot,
      directory,
      boundaryIdentity,
      effectIssued: false,
    });
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "repository_runtime_data_area_observation_failed",
      effectIssued: false,
    });
  }
}

/**
 * Repository Runtime Data Paths From Working Directoryを一意に解決する。
 *
 * @responsibility Repository Runtime Data Paths From Working Directoryの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input workingDirectory: unknown
 * @returns resolveRepositoryRuntimeDataPathsFromWorkingDirectoryの計算結果を返す。
 * @precondition 「workingDirectory: unknown」がresolveRepositoryRuntimeDataPathsFromWorkingDirectoryの入力契約を満たす。
 * @postcondition resolveRepositoryRuntimeDataPathsFromWorkingDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryRuntimeDataPathsFromWorkingDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryRuntimeDataPathsFromWorkingDirectoryは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryRuntimeDataPathsFromWorkingDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryRuntimeDataPathsFromWorkingDirectoryはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveRepositoryRuntimeDataPathsFromWorkingDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveRepositoryRuntimeDataPathsFromWorkingDirectoryは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryRuntimeDataPathsFromWorkingDirectory(
  workingDirectory: unknown,
) {
  const verified = verifyRepositoryRootFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? resolveRepositoryRuntimeDataPaths(verified.capability)
    : null;
}

/**
 * Cros Runtime Rootsを一意に解決する。
 *
 * @responsibility Cros Runtime Rootsの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input input: CrosRootInput
 * @returns resolveCrosRuntimeRootsの計算結果を返す。
 * @precondition 「input: CrosRootInput」がresolveCrosRuntimeRootsの入力契約を満たす。
 * @postcondition resolveCrosRuntimeRootsの責務を完了した結果だけを返す。
 * @effect N/A: resolveCrosRuntimeRootsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveCrosRuntimeRootsは独自の失敗分岐を所有しない。
 * @invariant resolveCrosRuntimeRootsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveCrosRuntimeRootsはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveCrosRuntimeRootsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveCrosRuntimeRootsは共有非同期状態を持たない同期処理である。
 */
export function resolveCrosRuntimeRoots(input: CrosRootInput) {
  if (
    !CROS_DIRECTORY_ID.test(input.trustDomainId) ||
    !CROS_DIRECTORY_ID.test(input.publisher) ||
    input.application !== "cros"
  )
    return null;
  const pathSegments = [
    input.publisher,
    input.application,
    input.trustDomainId,
  ];
  if (input.platform === "win32") {
    if (!input.localAppData || !path.win32.isAbsolute(input.localAppData))
      return null;
    const root = path.win32.join(input.localAppData, ...pathSegments);
    return Object.freeze({
      platform: "win32" as const,
      config: root,
      state: root,
      temporary: path.win32.join(root, "tmp"),
    });
  }
  if (!input.homeDirectory || !path.posix.isAbsolute(input.homeDirectory))
    return null;
  const configBase =
    input.xdgConfigHome ?? path.posix.join(input.homeDirectory, ".config");
  const stateBase =
    input.xdgStateHome ??
    path.posix.join(input.homeDirectory, ".local", "state");
  if (!path.posix.isAbsolute(configBase) || !path.posix.isAbsolute(stateBase))
    return null;
  const config = path.posix.join(configBase, ...pathSegments);
  const state = path.posix.join(stateBase, ...pathSegments);
  const temporary = input.xdgRuntimeDirectory
    ? path.posix.join(input.xdgRuntimeDirectory, ...pathSegments)
    : null;
  if (
    input.xdgRuntimeDirectory &&
    !path.posix.isAbsolute(input.xdgRuntimeDirectory)
  )
    return null;
  return Object.freeze({
    platform: "linux" as const,
    config,
    state,
    temporary,
  });
}
