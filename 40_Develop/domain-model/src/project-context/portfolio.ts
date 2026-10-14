/**
 * 認可済みProject ContextをProject別の表示投影へ集約する。
 * @responsibility 認可を行わず、出所・改訂・欠測・Identity競合を保持する。
 * @trace ARCH-000005
 */
import type { RepositoryProjectContext } from "./types.ts";

/**
 * 呼出し側が現在要求で認可済みと保証する中立な情報源。
 * @responsibility Repositoryの宣言Identity・改訂と解析済みContextだけを搬送する。
 * @trace ARCH-000005
 * @shape projectId、repositoryId、state、revision、contextの5項目。
 * @invariant completeだけが本文と版を持つ。非completeは本文と版がnullで、状態から未提供・未確認・競合を区別する。
 * @boundary 認可済み呼出し側からDomainの純粋集約へ渡す。
 * @security Credential・Exposure・Binding・Root・元contentを含めず、認可能力ではない。
 * @compatibility 呼出し側が認可・読取り状態を担当し、Domainは探索やfallbackを行わない。missingはFilesystem不存在証明ではない。
 */
export type ProjectContextSource = Readonly<{
  projectId: string;
  repositoryId: string;
}> &
  Readonly<
    | { state: "complete"; revision: string; context: RepositoryProjectContext }
    | {
        state: "missing" | "unavailable" | "conflicting";
        revision: null;
        context: null;
      }
  >;

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
  revision: string | null;
  state: "complete" | "missing" | "conflicting" | "unavailable";
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
 * 許可済みRepository Project ContextをPortfolioへ統合する。
 *
 * @responsibility RepositoryごとのProject ContextをProject単位へまとめ、欠落とIdentity競合をSource別に保持する。
 * @trace ARCH-000005
 * @input repositoriesに呼出し側が現在要求で認可済みと保証した中立Source集合を受け取る。
 * @returns Project別Source Coverageを持つ読取り専用PortfolioProjectionを返す。
 * @precondition 入力は現在のRequest Access Contextで利用可能と確認済みである。
 * @postcondition 各Repositoryは宣言したprojectIdのSourceとして一度だけ現れる。
 * @effect N/A: Project Context、Repository登録および正本を変更しない。
 * @failure 未提供・未確認・Identity競合を別状態で保持する。不可能な状態・本文・版の組合せは例外。
 * @invariant 欠測を空の正常値へ、競合を探索順の勝者へ変換しない。
 * @boundary 許可済みRepository Project Context→Project Federation→Portfolio Projection。
 * @security 入力にないRepository、Projectまたは期待Contextを推測しない。
 * @concurrency 入力Sourceを同期変換する。複数読取りの原子的Snapshot保証は追加しない。
 */
export function createPortfolioProjection(
  repositories: readonly ProjectContextSource[],
): PortfolioProjection {
  const projects = new Map<string, FederatedProjectSource[]>();
  for (const repository of repositories) {
    if (
      !["complete", "missing", "unavailable", "conflicting"].includes(
        repository.state,
      ) ||
      (repository.state === "complete"
        ? repository.context === null || typeof repository.revision !== "string"
        : repository.context !== null || repository.revision !== null)
    )
      throw new Error("project_context_source_invalid");
    const context = repository.context;
    const identitiesMatch =
      context?.projectId === repository.projectId &&
      context.repositoryId === repository.repositoryId;
    const state =
      repository.state === "complete"
        ? identitiesMatch
          ? "complete"
          : "conflicting"
        : repository.state;
    const source: FederatedProjectSource = Object.freeze({
      repositoryId: repository.repositoryId,
      revision: state === "complete" ? repository.revision : null,
      state,
      repositoryRole:
        state === "complete" && context !== null
          ? context.repositoryRole
          : null,
      context: state === "complete" ? context : null,
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
