/**
 * Coordinatorが利用する固定Runtime領域の準備・観測。
 * @responsibility Lease・Workspace・EI接続・保護Mountの所在と失敗情報をOwner内部に閉じる。
 * @trace ARCH-000004
 * @boundary VCの検証済みRepositoryだけを受け、モデルの保存Protocolは実装しない。
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ExecutionStorageBlockedError } from "../../../execution-model/src/index.ts";
import {
  getRepositoryFromWorkingDirectory,
  type Repository,
  registerRepositoryLocalIgnore,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";

export const TESTS_RELATIVE_PATH = ".crdd/tests" as const;

export const REPOSITORY_AREAS = Object.freeze([
  "config",
  "domain-model",
  "execution-intelligence",
  "candidates",
  "workspaces",
  "release",
  "communication",
  "tests",
  "tmp",
] as const);

export const AREA_PATH_KEYS = Object.freeze({
  config: "config",
  "domain-model": "domainModel",
  "execution-intelligence": "executionIntelligence",
  candidates: "candidates",
  workspaces: "workspaces",
  release: "release",
  communication: "communication",
  tests: "tests",
  tmp: "temporary",
} as const);

/**
 * runtime-data-path-resolverで使用するRepository Runtime Areaの値契約を定義する。
 *
 * @responsibility Repository Runtime AreaのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape RepositoryExecutionAreaが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryExecutionAreaで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryExecutionAreaの宣言は外部境界を開かない。
 * @security N/A: RepositoryExecutionAreaはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryExecutionAreaの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryExecutionArea = (typeof REPOSITORY_AREAS)[number];

/**
 * 既存Runtime領域の読取り専用観測結果を定義する。
 * @responsibility 不存在、境界不正、観測不能、検証済み既存領域を区別する。
 * @trace ARCH-000011
 * @shape readyは名前付きareaと不透明な境界Identity、他状態は閉じたreasonを持つ。
 * @invariant private Runtime RootのPathや書込みAuthorityを公開しない。
 * @boundary Runtime Data Ownerと名前付き領域の利用側。
 * @security boundaryIdentityは置換検知用の非Authority参照である。
 * @compatibility areaの作成入口とは独立した読取り専用APIである。
 */
export type RepositoryExecutionDataAreaObservation =
  | Readonly<{
      status: "ready";
      repositoryRoot: string;
      directory: string;
      boundaryIdentity: string;
      effectIssued: false;
    }>
  | Readonly<{
      status: "not_observed";
      reason: "repository_runtime_data_area_absent";
      effectIssued: false;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "repository_runtime_data_root_capability_invalid"
        | "repository_runtime_data_area_boundary_invalid"
        | "repository_runtime_data_area_observation_failed";
      effectIssued: false;
    }>;

/**
 * Resolves only canonical paths. The caller remains responsible for proving
 *
 * @responsibility Repository Runtime Data Paths From Validated Rootの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input repositoryRoot: string
 * @returns resolveRepositoryExecutionDataPathsFromValidatedRootの計算結果を返す。
 * @precondition 「repositoryRoot: string」がresolveRepositoryExecutionDataPathsFromValidatedRootの入力契約を満たす。
 * @postcondition resolveRepositoryExecutionDataPathsFromValidatedRootの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryExecutionDataPathsFromValidatedRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryExecutionDataPathsFromValidatedRootは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryExecutionDataPathsFromValidatedRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryExecutionDataPathsFromValidatedRootはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveRepositoryExecutionDataPathsFromValidatedRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveRepositoryExecutionDataPathsFromValidatedRootは共有非同期状態を持たない同期処理である。
 */
function resolveRepositoryExecutionDataPathsFromValidatedRoot(
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
    domainModel: path.join(root, "domain-model"),
    executionIntelligence: path.join(root, "execution-intelligence"),
    candidates: path.join(root, "candidates"),
    workspaces: path.join(root, "workspaces"),
    release: path.join(root, "release"),
    communication: path.join(root, "communication"),
    tests: path.join(root, "tests"),
    temporary: path.join(root, "tmp"),
    allowedTopLevelAreas: REPOSITORY_AREAS,
  });
}

/**
 * Repository Runtime Data Pathsを一意に解決する。
 *
 * @responsibility Repository Runtime Data Pathsの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input capability: Repository
 * @returns resolveRepositoryExecutionDataPathsの計算結果を返す。
 * @precondition 「capability: Repository」がresolveRepositoryExecutionDataPathsの入力契約を満たす。
 * @postcondition resolveRepositoryExecutionDataPathsの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryExecutionDataPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryExecutionDataPathsは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryExecutionDataPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryExecutionDataPathsはProcess内の同一Subsystemで完結する。
 * @security resolveRepositoryExecutionDataPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRepositoryExecutionDataPathsは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryExecutionDataPaths(capability: Repository) {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  if (repositoryRoot === null) return null;
  const resolved =
    resolveRepositoryExecutionDataPathsFromValidatedRoot(repositoryRoot);
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
 * @input capability: Repository
 * @returns resolveRepositoryExecutionDataPathsForInternalUseの計算結果を返す。
 * @precondition 「capability: Repository」がresolveRepositoryExecutionDataPathsForInternalUseの入力契約を満たす。
 * @postcondition resolveRepositoryExecutionDataPathsForInternalUseの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryExecutionDataPathsForInternalUseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryExecutionDataPathsForInternalUseは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryExecutionDataPathsForInternalUseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryExecutionDataPathsForInternalUseはProcess内の同一Subsystemで完結する。
 * @security resolveRepositoryExecutionDataPathsForInternalUseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRepositoryExecutionDataPathsForInternalUseは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryExecutionDataPathsForInternalUse(
  capability: Repository,
) {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null
    ? null
    : resolveRepositoryExecutionDataPathsFromValidatedRoot(repositoryRoot);
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
export function observeRepositoryExecutionDataArea(
  capability: Repository,
  area: RepositoryExecutionArea,
): RepositoryExecutionDataAreaObservation {
  try {
    const paths = resolveRepositoryExecutionDataPathsForInternalUse(capability);
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
 * @returns resolveRepositoryExecutionDataPathsFromWorkingDirectoryの計算結果を返す。
 * @precondition 「workingDirectory: unknown」がresolveRepositoryExecutionDataPathsFromWorkingDirectoryの入力契約を満たす。
 * @postcondition resolveRepositoryExecutionDataPathsFromWorkingDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryExecutionDataPathsFromWorkingDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryExecutionDataPathsFromWorkingDirectoryは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryExecutionDataPathsFromWorkingDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryExecutionDataPathsFromWorkingDirectoryはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveRepositoryExecutionDataPathsFromWorkingDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveRepositoryExecutionDataPathsFromWorkingDirectoryは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryExecutionDataPathsFromWorkingDirectory(
  workingDirectory: unknown,
) {
  const verified = getRepositoryFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? resolveRepositoryExecutionDataPaths(verified.capability)
    : null;
}

/**
 * AI書込みから守る内部Directoryだけを観測又は準備する。
 * @responsibility raw Rootを公開せず空の保護Mount先を既存Ownerで扱う。
 * @trace ARCH-000011
 * @input 検証済み実行Treeとobserve／prepareの明示操作。
 * @returns ready／absent／blocked。Pathや書込みAuthorityは返さない。
 * @precondition 呼出し元が借用Treeの利用許可を保持する。
 * @postcondition 観測は作成0、準備も既存内容を変更しない。
 * @effect prepare時の真正不存在に限りRoot直下のDirectory一件を作成する。
 * @failure 型不正・link・観測不能はblocked、旧Pathへfallbackしない。
 * @invariant 状態初期化、子領域、Lockや台帳を追加しない。
 * @boundary 実行Treeと内部状態の保護Mount先。
 * @security raw Rootを一般保存先として利用側へ渡さない。
 * @concurrency 既存の上位利用調停下で呼び、将来の置換不存在は保証しない。
 */
export function checkRepositoryRuntimeDataProtectionDirectory(
  capability: Repository,
  operation: "observe" | "prepare",
): "ready" | "absent" | "blocked" {
  try {
    if (operation !== "observe" && operation !== "prepare") return "blocked";
    const paths = resolveRepositoryExecutionDataPathsForInternalUse(capability);
    if (!paths) return "blocked";
    let metadata: fs.Stats;
    try {
      metadata = fs.lstatSync(paths.root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return "blocked";
      if (operation === "observe") return "absent";
      fs.mkdirSync(paths.root);
      metadata = fs.lstatSync(paths.root);
    }
    return metadata.isDirectory() &&
      !metadata.isSymbolicLink() &&
      fs.realpathSync.native(paths.root) === paths.root
      ? "ready"
      : "blocked";
  } catch {
    return "blocked";
  }
}

/**
 * Canonical Directoryが成立する状態を確保する。
 *
 * @responsibility Canonical Directoryの成立条件、作成または再利用、失敗時の非成立境界を所有する。
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
 * 宣言済みRuntime領域を、ローカル除外の確定後だけ作成する。
 * @responsibility VCの完成した登録結果を受け、保存領域の判断と失敗情報を保持する。
 * @trace ARCH-000011
 * @effect 除外登録後に既存のRepository内領域を作成する。
 * @failure 除外のEffect不明・回収不明はblockedのまま返し、領域を作らない。
 */
export function ensureRepositoryExecutionDataArea(
  capability: Repository,
  area: RepositoryExecutionArea,
) {
  const paths = resolveRepositoryExecutionDataPathsForInternalUse(capability);
  if (!paths || !REPOSITORY_AREAS.includes(area)) return null;
  const ignore = registerRepositoryLocalIgnore(capability, ".crdd/");
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
 * Repository Runtime Data Area From Working Directoryが成立する状態を確保する。
 *
 * @responsibility Repository Runtime Data Area From Working Directoryの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000011
 * @input workingDirectory: unknown、area: RepositoryExecutionArea
 * @returns ensureRepositoryExecutionDataAreaFromWorkingDirectoryの計算結果を返す。
 * @precondition 「workingDirectory: unknown、area: RepositoryExecutionArea」がensureRepositoryExecutionDataAreaFromWorkingDirectoryの入力契約を満たす。
 * @postcondition ensureRepositoryExecutionDataAreaFromWorkingDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryは独自の失敗分岐を所有しない。
 * @invariant ensureRepositoryExecutionDataAreaFromWorkingDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryはProcess内の同一Subsystemで完結する。
 * @security N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ensureRepositoryExecutionDataAreaFromWorkingDirectoryは共有非同期状態を持たない同期処理である。
 */
export function ensureRepositoryExecutionDataAreaFromWorkingDirectory(
  workingDirectory: unknown,
  area: RepositoryExecutionArea,
) {
  const verified = getRepositoryFromWorkingDirectory(workingDirectory);
  return verified.status === "completed"
    ? ensureRepositoryExecutionDataArea(verified.capability, area)
    : null;
}

/**
 * require Ready Repository Runtime Data Areaを決定する。
 *
 * @responsibility require Ready Repository Runtime Data Areaの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000011
 * @input result: ReturnType<typeof ensureRepositoryExecutionDataArea>、invalidReason: string
 * @returns requireReadyRepositoryExecutionDataAreaの計算結果を返す。
 * @precondition 「result: ReturnType<typeof ensureRepositoryExecutionDataArea>、invalidReason: string」がrequireReadyRepositoryExecutionDataAreaの入力契約を満たす。
 * @postcondition requireReadyRepositoryExecutionDataAreaの責務を完了した結果だけを返す。
 * @effect N/A: requireReadyRepositoryExecutionDataAreaは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requireReadyRepositoryExecutionDataAreaは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requireReadyRepositoryExecutionDataAreaは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requireReadyRepositoryExecutionDataAreaはProcess内の同一Subsystemで完結する。
 * @security N/A: requireReadyRepositoryExecutionDataAreaはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: requireReadyRepositoryExecutionDataAreaは共有非同期状態を持たない同期処理である。
 */
export function requireReadyRepositoryExecutionDataArea(
  result: ReturnType<typeof ensureRepositoryExecutionDataArea>,
  invalidReason: string,
) {
  if (result?.status === "ready") return result;
  if (result?.status === "blocked")
    throw new ExecutionStorageBlockedError(result);
  throw new Error(invalidReason);
}
