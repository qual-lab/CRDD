/**
 * Workbench検証Scriptが所有する固定配置の観測。
 * @responsibility 自己生成試験領域の所在だけを扱い、モデルの状態・保存を実装しない。
 * @trace ARCH-000012
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  resolveVerifiedRepositoryRoot,
  type Repository,
} from "../../version-control/src/index.ts";

/**
 * runtime-data-path-resolverで使用するRepository Runtime Areaの値契約を定義する。
 *
 * @responsibility Repository Runtime AreaのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape RepositoryRuntimeAreaが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryRuntimeAreaで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryRuntimeAreaの宣言は外部境界を開かない。
 * @security N/A: RepositoryRuntimeAreaはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryRuntimeAreaの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RepositoryRuntimeArea = "tests";

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
export type RepositoryRuntimeDataAreaObservation =
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
    domainModel: path.join(root, "domain-model"),
    workspaces: path.join(root, "workspaces"),
    tests: path.join(root, "tests"),
    temporary: path.join(root, "tmp"),
    locks: path.join(root, "lock"),
  });
}

/**
 * Repository Runtime Data Pathsを一意に解決する。
 *
 * @responsibility Repository Runtime Data Pathsの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000011
 * @input capability: Repository
 * @returns resolveRepositoryRuntimeDataPathsの計算結果を返す。
 * @precondition 「capability: Repository」がresolveRepositoryRuntimeDataPathsの入力契約を満たす。
 * @postcondition resolveRepositoryRuntimeDataPathsの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryRuntimeDataPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryRuntimeDataPathsは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryRuntimeDataPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryRuntimeDataPathsはProcess内の同一Subsystemで完結する。
 * @security resolveRepositoryRuntimeDataPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRepositoryRuntimeDataPathsは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryRuntimeDataPaths(capability: Repository) {
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
 * @input capability: Repository
 * @returns resolveRepositoryRuntimeDataPathsForInternalUseの計算結果を返す。
 * @precondition 「capability: Repository」がresolveRepositoryRuntimeDataPathsForInternalUseの入力契約を満たす。
 * @postcondition resolveRepositoryRuntimeDataPathsForInternalUseの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryRuntimeDataPathsForInternalUseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRepositoryRuntimeDataPathsForInternalUseは独自の失敗分岐を所有しない。
 * @invariant resolveRepositoryRuntimeDataPathsForInternalUseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRepositoryRuntimeDataPathsForInternalUseはProcess内の同一Subsystemで完結する。
 * @security resolveRepositoryRuntimeDataPathsForInternalUseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRepositoryRuntimeDataPathsForInternalUseは共有非同期状態を持たない同期処理である。
 */
export function resolveRepositoryRuntimeDataPathsForInternalUse(
  capability: Repository,
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
  capability: Repository,
  area: RepositoryRuntimeArea,
): RepositoryRuntimeDataAreaObservation {
  try {
    const paths = resolveRepositoryRuntimeDataPathsForInternalUse(capability);
    if (!paths || area !== "tests")
      return Object.freeze({
        status: "blocked",
        reason: "repository_runtime_data_root_capability_invalid",
        effectIssued: false,
      });
    const directory = paths.tests;
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
