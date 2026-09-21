import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/repository-location.ts";
import { gitRepositoryLocalIgnoreAdapter } from "../../../version-control/src/git/repository-local-ignore-adapter.ts";
import {
  registerRepositoryLocalIgnore,
  type RepositoryLocalIgnoreAdapter,
} from "../../../version-control/src/repository-local-ignore.ts";
import { CROS_DIRECTORY_ID } from "../core/runtime-data-contract.ts";

export const REPOSITORY_MANIFEST_RELATIVE_PATH =
  ".crdd/config/repository-manifest.json" as const;
export const EXTERNAL_SEND_POLICY_RELATIVE_PATH =
  ".crdd/config/external-send-policy.json" as const;
export const VERIFICATION_RELATIVE_PATH = ".crdd/verification" as const;

const REPOSITORY_AREAS = Object.freeze([
  "config",
  "project-runtime",
  "execution",
  "verification",
  "candidates",
  "release",
  "communication",
  "tests",
  "tmp",
] as const);

/**
 * RepositoryRuntimeAreaが扱う値の構造を表す。
 *
 * @responsibility RepositoryRuntimeAreaに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000011
 * @shape RepositoryRuntimeAreaが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryRuntimeAreaで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryRuntimeAreaの宣言は外部境界を開かない。
 * @security N/A: RepositoryRuntimeAreaはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryRuntimeAreaの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryRuntimeArea = (typeof REPOSITORY_AREAS)[number];
const AREA_PATH_KEYS = Object.freeze({
  config: "config",
  "project-runtime": "projectRuntime",
  execution: "execution",
  verification: "verification",
  candidates: "candidates",
  release: "release",
  communication: "communication",
  tests: "tests",
  tmp: "temporary",
} as const);

/**
 * Resolves only canonical paths. The caller remains responsible for proving
 *
 * @responsibility resolveRepositoryRuntimeDataPathsFromValidatedRootに対応する入力処理と結果生成を所有する。
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
    execution: path.join(root, "execution"),
    verification: path.join(root, "verification"),
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
 * @responsibility resolveBundledRepositoryRuntimeDataPathsForProtectedSigningに対応する入力処理と結果生成を所有する。
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
 * resolveRepositoryRuntimeDataPathsの処理を実行する。
 *
 * @responsibility resolveRepositoryRuntimeDataPathsに対応する入力処理と結果生成を所有する。
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
 * @responsibility resolveRepositoryRuntimeDataPathsForInternalUseに対応する入力処理と結果生成を所有する。
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
 * ensureCanonicalDirectoryの処理を実行する。
 *
 * @responsibility ensureCanonicalDirectoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000011
 * @input target: string
 * @returns N/A: ensureCanonicalDirectoryは戻り値を返さない。
 * @precondition 「target: string」がensureCanonicalDirectoryの入力契約を満たす。
 * @postcondition ensureCanonicalDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect ensureCanonicalDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure ensureCanonicalDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureCanonicalDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: ensureCanonicalDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ensureCanonicalDirectoryは共有非同期状態を持たない同期処理である。
 */
function ensureCanonicalDirectory(target: string): void {
  try {
    fs.mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const metadata = fs.lstatSync(target);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(target) !== target
  )
    throw new Error("runtime_data_area_boundary_invalid");
}

/**
 * Creates or verifies one declared repository-local area. Consumers receive
 *
 * @responsibility ensureRepositoryRuntimeDataAreaに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000011
 * @input capability: VerifiedRepositoryRoot、area: RepositoryRuntimeArea
 * @returns ensureRepositoryRuntimeDataAreaの計算結果を返す。
 * @precondition 「capability: VerifiedRepositoryRoot、area: RepositoryRuntimeArea」がensureRepositoryRuntimeDataAreaの入力契約を満たす。
 * @postcondition ensureRepositoryRuntimeDataAreaの責務を完了した結果だけを返す。
 * @effect N/A: ensureRepositoryRuntimeDataAreaは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ensureRepositoryRuntimeDataAreaは独自の失敗分岐を所有しない。
 * @invariant ensureRepositoryRuntimeDataAreaは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ensureRepositoryRuntimeDataAreaはProcess内の同一Subsystemで完結する。
 * @security ensureRepositoryRuntimeDataAreaはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ensureRepositoryRuntimeDataAreaは共有非同期状態を持たない同期処理である。
 */
export function ensureRepositoryRuntimeDataArea(
  capability: VerifiedRepositoryRoot,
  area: RepositoryRuntimeArea,
) {
  return ensureRepositoryRuntimeDataAreaWithAdapter(
    capability,
    area,
    gitRepositoryLocalIgnoreAdapter,
  );
}

/**
 * Internal test seam for exact Ignore lifecycle failure injection.
 *
 * @responsibility ensureRepositoryRuntimeDataAreaWithAdapterに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000011
 * @input capability: VerifiedRepositoryRoot、area: RepositoryRuntimeArea、ignoreAdapter: RepositoryLocalIgnoreAdapter
 * @returns ensureRepositoryRuntimeDataAreaWithAdapterの計算結果を返す。
 * @precondition 「capability: VerifiedRepositoryRoot、area: RepositoryRuntimeArea、ignoreAdapter: RepositoryLocalIgnoreAdapter」がensureRepositoryRuntimeDataAreaWithAdapterの入力契約を満たす。
 * @postcondition ensureRepositoryRuntimeDataAreaWithAdapterの責務を完了した結果だけを返す。
 * @effect N/A: ensureRepositoryRuntimeDataAreaWithAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ensureRepositoryRuntimeDataAreaWithAdapterは独自の失敗分岐を所有しない。
 * @invariant ensureRepositoryRuntimeDataAreaWithAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ensureRepositoryRuntimeDataAreaWithAdapterはProcess内の同一Subsystemで完結する。
 * @security ensureRepositoryRuntimeDataAreaWithAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ensureRepositoryRuntimeDataAreaWithAdapterは共有非同期状態を持たない同期処理である。
 */
export function ensureRepositoryRuntimeDataAreaWithAdapter(
  capability: VerifiedRepositoryRoot,
  area: RepositoryRuntimeArea,
  ignoreAdapter: RepositoryLocalIgnoreAdapter,
) {
  const paths = resolveRepositoryRuntimeDataPathsForInternalUse(capability);
  if (!paths || !REPOSITORY_AREAS.includes(area)) return null;
  const ignore = registerRepositoryLocalIgnore(
    capability,
    ".crdd/",
    ignoreAdapter,
  );
  if (ignore.status !== "registered")
    return Object.freeze({
      status: "blocked" as const,
      reason: "repository_runtime_data_ignore_registration_blocked" as const,
      effectIssued: ignore.effectIssued,
      effectStateUnknown: ignore.effectStateUnknown,
      effectConfirmation: ignore.effectConfirmation,
      cleanupConfirmed: ignore.cleanupConfirmed,
      retryAllowed: ignore.retryAllowed,
      recoveryReference: ignore.recoveryReference,
      repositoryPathReported: false as const,
    });
  ensureCanonicalDirectory(paths.root);
  const directory = paths[AREA_PATH_KEYS[area]];
  ensureCanonicalDirectory(directory);
  return Object.freeze({
    status: "ready" as const,
    repositoryRoot: paths.repositoryRoot,
    directory,
  });
}

/**
 * RepositoryRuntimeDataAreaBlockedErrorが担う状態と操作を提供する。
 *
 * @responsibility RepositoryRuntimeDataAreaBlockedErrorに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000011
 * @construction RepositoryRuntimeDataAreaBlockedErrorの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle RepositoryRuntimeDataAreaBlockedErrorが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: RepositoryRuntimeDataAreaBlockedErrorの宣言自体は実行時Effectを発行しない。
 * @failure N/A: RepositoryRuntimeDataAreaBlockedErrorの宣言自体は実行時失敗を所有しない。
 * @invariant RepositoryRuntimeDataAreaBlockedErrorで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryRuntimeDataAreaBlockedErrorの宣言は外部境界を開かない。
 * @security N/A: RepositoryRuntimeDataAreaBlockedErrorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: RepositoryRuntimeDataAreaBlockedErrorは共有非同期状態を持たない同期処理である。
 */
export class RepositoryRuntimeDataAreaBlockedError extends Error {
  readonly reason: string;
  readonly effectIssued: boolean;
  readonly effectStateUnknown: boolean;
  readonly cleanupConfirmed: boolean;
  readonly retryAllowed: boolean;
  readonly recoveryReference: string | null;
  readonly repositoryPathReported = false as const;

  constructor(
    result: Exclude<
      ReturnType<typeof ensureRepositoryRuntimeDataAreaWithAdapter>,
      null | { status: "ready" }
    >,
  ) {
    super(result.reason);
    this.name = "RepositoryRuntimeDataAreaBlockedError";
    this.reason = result.reason;
    this.effectIssued = result.effectIssued;
    this.effectStateUnknown = result.effectStateUnknown;
    this.cleanupConfirmed = result.cleanupConfirmed;
    this.retryAllowed = result.retryAllowed;
    this.recoveryReference = result.recoveryReference;
  }
}

/**
 * requireReadyRepositoryRuntimeDataAreaの処理を実行する。
 *
 * @responsibility requireReadyRepositoryRuntimeDataAreaに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000011
 * @input result: ReturnType<typeof ensureRepositoryRuntimeDataArea>、invalidReason: string
 * @returns requireReadyRepositoryRuntimeDataAreaの計算結果を返す。
 * @precondition 「result: ReturnType<typeof ensureRepositoryRuntimeDataArea>、invalidReason: string」がrequireReadyRepositoryRuntimeDataAreaの入力契約を満たす。
 * @postcondition requireReadyRepositoryRuntimeDataAreaの責務を完了した結果だけを返す。
 * @effect N/A: requireReadyRepositoryRuntimeDataAreaは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireReadyRepositoryRuntimeDataAreaは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireReadyRepositoryRuntimeDataAreaは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireReadyRepositoryRuntimeDataAreaはProcess内の同一Subsystemで完結する。
 * @security N/A: requireReadyRepositoryRuntimeDataAreaはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: requireReadyRepositoryRuntimeDataAreaは共有非同期状態を持たない同期処理である。
 */
export function requireReadyRepositoryRuntimeDataArea(
  result: ReturnType<typeof ensureRepositoryRuntimeDataArea>,
  invalidReason: string,
) {
  if (result?.status === "ready") return result;
  if (result?.status === "blocked")
    throw new RepositoryRuntimeDataAreaBlockedError(result);
  throw new Error(invalidReason);
}

/**
 * ensureRepositoryRuntimeDataAreaFromWorkingDirectoryの処理を実行する。
 *
 * @responsibility ensureRepositoryRuntimeDataAreaFromWorkingDirectoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000011
 * @input workingDirectory: unknown、area: RepositoryRuntimeArea
 * @returns ensureRepositoryRuntimeDataAreaFromWorkingDirectoryの計算結果を返す。
 * @precondition 「workingDirectory: unknown、area: RepositoryRuntimeArea」がensureRepositoryRuntimeDataAreaFromWorkingDirectoryの入力契約を満たす。
 * @postcondition ensureRepositoryRuntimeDataAreaFromWorkingDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: ensureRepositoryRuntimeDataAreaFromWorkingDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ensureRepositoryRuntimeDataAreaFromWorkingDirectoryは独自の失敗分岐を所有しない。
 * @invariant ensureRepositoryRuntimeDataAreaFromWorkingDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ensureRepositoryRuntimeDataAreaFromWorkingDirectoryはProcess内の同一Subsystemで完結する。
 * @security N/A: ensureRepositoryRuntimeDataAreaFromWorkingDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ensureRepositoryRuntimeDataAreaFromWorkingDirectoryは共有非同期状態を持たない同期処理である。
 */
export function ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
  workingDirectory: unknown,
  area: RepositoryRuntimeArea,
) {
  const verified = verifyRepositoryRootFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? ensureRepositoryRuntimeDataArea(verified.capability, area)
    : null;
}

/**
 * resolveRepositoryRuntimeDataPathsFromWorkingDirectoryの処理を実行する。
 *
 * @responsibility resolveRepositoryRuntimeDataPathsFromWorkingDirectoryに対応する入力処理と結果生成を所有する。
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
 * CrosRootInputが扱う値の構造を表す。
 *
 * @responsibility CrosRootInputに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000011
 * @shape CrosRootInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CrosRootInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: CrosRootInputの宣言は外部境界を開かない。
 * @security N/A: CrosRootInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CrosRootInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CrosRootInput = Readonly<{
  platform: "win32" | "linux";
  trustDomainId: string;
  publisher: string;
  application: "cros";
  localAppData?: string;
  xdgConfigHome?: string;
  xdgStateHome?: string;
  xdgRuntimeDirectory?: string;
  homeDirectory?: string;
}>;

/**
 * resolveCrosRuntimeRootsの処理を実行する。
 *
 * @responsibility resolveCrosRuntimeRootsに対応する入力処理と結果生成を所有する。
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
