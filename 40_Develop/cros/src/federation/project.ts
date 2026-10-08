/**
 * CROSのProject Context Federation。
 *
 * @packageDocumentation
 * @responsibility Sessionで利用可能なRepositoryだけをProject単位へ統合し、欠測とIdentity競合を保持したPortfolio Projectionを返す。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @boundary Workspace Exposure、Repository登録、Project Operation Project ContextおよびConsumer Projectionの境界。
 * @effect N/A: 検証済みSnapshotから読取り専用Projectionだけを生成する。
 * @security Grant外RepositoryのIdentity、存在および件数を結果へ含めない。
 */
import type { RepositoryProjectContext } from "../../../domain-model/src/index.ts";

import type {
  CrosExposure,
  CrosRepository,
  CrosSession,
} from "../access/session-context.ts";

/**
 * Federationへ渡せるRepository Project Context内容を定義する。
 *
 * @responsibility Repository登録の汎用contentからProject Contextの公開位置を固定する。
 * @trace ARCH-000005
 * @shape projectContextを任意Propertyとして持つ読取り内容を表す。
 * @invariant Project Context欠落を空の正常Contextへ変換しない。
 * @boundary Repository登録とProject Federationの型境界。
 * @security Project Context以外のcontent PropertyをFederationへ公開しない。
 * @compatibility 既存Repository登録はprojectContextなしでも保持できる。
 */
type ProjectContextContent = Readonly<Record<string, unknown>> &
  Readonly<{ projectContext?: RepositoryProjectContext }>;

/**
 * Portfolio内の一Repository Sourceを定義する。
 *
 * @responsibility Repository Relation、Revision、状態および検証済みProject Contextを同じSourceへ閉じる。
 * @trace ARCH-000005
 * @shape Repository Identity、Revision、状態、RoleおよびContextを表す。
 * @invariant completeだけがcontextとrepositoryRoleを持つ。
 * @boundary Project FederationとPortfolio ConsumerのSource境界。
 * @security 利用可能と確認されたRepositoryだけを表す。
 * @compatibility 新状態追加時は全Consumerの不完全性表示を再評価する。
 */
export type FederatedProjectSource = Readonly<{
  repositoryId: string;
  revision: string;
  state: "complete" | "missing" | "conflicting";
  repositoryRole: string | null;
  context: RepositoryProjectContext | null;
}>;

/**
 * 一ProjectのFederation結果を定義する。
 *
 * @responsibility Project Identity、全Sourceおよび統合状態を一つの読取りProjectionへ閉じる。
 * @trace ARCH-000005
 * @shape projectId、stateおよびsourcesを表す。
 * @invariant completeは全Sourceがcompleteの場合だけ成立する。
 * @boundary Project FederationとProject／Portfolio表示の結果境界。
 * @security 非開示Sourceの欠落枠を生成しない。
 * @compatibility Source順序はrepositoryIdの昇順で安定する。
 */
export type FederatedProjectProjection = Readonly<{
  projectId: string;
  state: "complete" | "partial" | "conflicting";
  sources: readonly FederatedProjectSource[];
}>;

/**
 * Portfolio Federation結果を定義する。
 *
 * @responsibility 許可済みProject集合と読取り専用性を公開結果へ固定する。
 * @trace ARCH-000005
 * @shape projectsとretainedAsSourceOfTruthを表す。
 * @invariant ProjectionをCROS固有の永続正本として保持しない。
 * @boundary CROS Project FederationとWorkbench／MCPの境界。
 * @security 許可済みRepositoryから導出できないProjectを含めない。
 * @compatibility Project順序はprojectIdの昇順で安定する。
 */
export type PortfolioProjection = Readonly<{
  projects: readonly FederatedProjectProjection[];
  retainedAsSourceOfTruth: false;
}>;

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

/**
 * 許可済みRepository Project ContextをPortfolioへ統合する。
 *
 * @responsibility RepositoryごとのProject ContextをProject単位へまとめ、欠落とIdentity競合をSource別に保持する。
 * @trace ARCH-000005
 * @input repositoriesにresolveAuthorizedRepositoriesの結果を受け取る。
 * @returns Project別Source Coverageを持つ読取り専用PortfolioProjectionを返す。
 * @precondition 入力は現在のRequest Access Contextで利用可能と確認済みである。
 * @postcondition 各Repositoryは宣言したprojectIdのSourceとして一度だけ現れる。
 * @effect N/A: Project Context、Repository登録および正本を変更しない。
 * @failure Context欠落はmissing、Identity不一致はconflictingとして部分結果へ保持する。
 * @invariant 欠測を空の正常値へ、競合を探索順の勝者へ変換しない。
 * @boundary 許可済みRepository Project Context→Project Federation→Portfolio Projection。
 * @security 入力にないRepository、Projectまたは期待Contextを推測しない。
 * @concurrency 一つのRepository Registry Snapshotを同期変換する。
 */
export function createPortfolioProjection(
  repositories: readonly CrosRepository[],
): PortfolioProjection {
  const projects = new Map<string, FederatedProjectSource[]>();
  for (const repository of repositories) {
    const content = repository.content as ProjectContextContent;
    const context = content.projectContext;
    const identitiesMatch =
      context?.projectId === repository.projectId &&
      context.repositoryId === repository.repositoryId;
    const source: FederatedProjectSource = Object.freeze({
      repositoryId: repository.repositoryId,
      revision: repository.revision,
      state:
        context === undefined
          ? "missing"
          : identitiesMatch
            ? "complete"
            : "conflicting",
      repositoryRole: identitiesMatch ? context.repositoryRole : null,
      context: identitiesMatch ? context : null,
    });
    const existingSources = projects.get(repository.projectId) ?? [];
    existingSources.push(source);
    projects.set(repository.projectId, existingSources);
  }
  const projectedProjects = [...projects.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([projectId, sources]) => {
      const sortedSources = sources.sort((left, right) =>
        left.repositoryId.localeCompare(right.repositoryId),
      );
      const state = sortedSources.some(
        (source) => source.state === "conflicting",
      )
        ? "conflicting"
        : sortedSources.every((source) => source.state === "complete")
          ? "complete"
          : "partial";
      return Object.freeze({
        projectId,
        state,
        sources: Object.freeze(sortedSources),
      });
    });
  return Object.freeze({
    projects: Object.freeze(projectedProjects),
    retainedAsSourceOfTruth: false,
  });
}
