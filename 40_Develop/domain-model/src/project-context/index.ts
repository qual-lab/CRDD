/**
 * Project Contextの意味変換と固定Markdown解析を提供する公開境界。
 *
 * @packageDocumentation
 * @responsibility Sourceの不完全性を保持した投影と明示された候補判断だけを公開する。
 * @trace ARCH-000005
 * @boundary 正本からの読取り投影と利用側の境界。
 * @effect N/A: 文字列と入力値を変換するだけで保存操作を発行しない。
 * @security 非開示Sourceを補完せず、採用Authorityを生成しない。
 */
export {
  applyProjectOperationCandidateDecision,
  projectProjectOperationSources,
} from "./project-operation.ts";
export { parseRepositoryProjectContextMarkdown } from "./repository-project-context.ts";
export { parseRepositoryReleaseProjectionMarkdown } from "./repository-release-projection.ts";
export { parseRepositoryQualityProjectionMarkdown } from "./repository-quality-projection.ts";
export type {
  ProjectOperationCandidate,
  ProjectOperationCandidateDecision,
  ProjectOperationCandidateDecisionResult,
  ProjectOperationProjection,
  ProjectOperationProjectionItem,
  ProjectOperationSource,
  ProjectOperationSourceState,
  RepositoryProjectContext,
  RepositoryProjectContextScene,
  RepositoryProjectContextSceneKey,
  RepositoryProjectContextTable,
  RepositoryReleaseDependency,
  RepositoryReleaseProjection,
  RepositoryReleaseScope,
  RepositoryQualityProjection,
} from "./types.ts";
