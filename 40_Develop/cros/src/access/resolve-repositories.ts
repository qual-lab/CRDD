/**
 * 現行CROSのSession・Exposureから参照可能なRepositoryを選ぶ。
 * @responsibility 純粋Domain集約とは分離して、既存の認可集合解決を所有する。
 * @trace ARCH-000013
 */
import type {
  CrosExposure,
  CrosRepository,
  CrosSession,
} from "./session-context.ts";

/**
 * Session Grantから利用可能なRepository集合を解決する。
 *
 * @responsibility Workspace、Registry Revision、Repository Revisionおよびactive状態を全件に適用する。
 * @trace ARCH-000013
 * @input session、Exposure SnapshotおよびRepository登録Snapshotを受け取る。
 * @returns 現在のSessionから利用可能なRepositoryだけを返す。
 * @precondition ExposureとRepositoryは同じRegistry観測から取得する。
 * @postcondition 結果の全Repositoryに一致するactive Exposureが存在する。
 * @effect N/A: 入力Snapshotを変更しない。
 * @failure inactive Sessionは空集合を返し、Grant外Identityを開示しない。
 * @invariant systemAdminだけではRepositoryを追加しない。
 * @boundary Session→Workspace Exposure→Repository集合の直接境界。
 * @security 不一致またはGrant外のRepository Identityを結果へ含めない。
 * @concurrency SessionとRegistry Revisionを一つのSnapshotとして扱う。
 */
export function resolveAuthorizedRepositories(
  session: CrosSession,
  exposures: readonly CrosExposure[],
  repositories: readonly CrosRepository[],
): readonly CrosRepository[] {
  if (!session.active) return Object.freeze([]);
  const allowedRepositoryIds = new Set(
    exposures
      .filter(
        (exposure) =>
          exposure.active &&
          exposure.registryRevision === session.exposureRegistryRevision &&
          session.workspaceIds.includes(exposure.workspaceId) &&
          repositories.some(
            (repository) =>
              repository.repositoryId === exposure.repositoryId &&
              repository.revision === exposure.repositoryRevision,
          ),
      )
      .map((exposure) => exposure.repositoryId),
  );
  return Object.freeze(
    repositories
      .filter((repository) => allowedRepositoryIds.has(repository.repositoryId))
      .sort((left, right) =>
        left.repositoryId.localeCompare(right.repositoryId),
      ),
  );
}
