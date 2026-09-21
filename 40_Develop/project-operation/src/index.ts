/**
 * Project Operationの部分状態投影と候補採否を提供する公開境界。
 *
 * @packageDocumentation
 * @responsibility 複数Sourceの不完全性を保つ読取り投影と、明示Authorityによる候補採否を分離する。
 * @trace ARCH-000005
 * @boundary Project Operation Subsystemと利用側の公開境界。
 * @effect N/A: 公開Symbolを明示再公開するだけである。
 * @security restricted Sourceの内容・Identityを公開結果へ露出せず、候補採用Authorityを生成しない。
 */
export {
  applyProjectOperationCandidateDecision,
  projectProjectOperationSources,
  type ProjectOperationCandidate,
  type ProjectOperationCandidateDecision,
  type ProjectOperationCandidateDecisionResult,
  type ProjectOperationProjection,
  type ProjectOperationProjectionItem,
  type ProjectOperationSource,
  type ProjectOperationSourceState,
} from "./project-operation.ts";
export {
  createFileProjectOperationCandidateStore,
  createFileProjectOperationOwnerWriter,
  executeProjectOperationCandidateDecision,
  type ProjectOperationAuthorityPort,
  type ProjectOperationCandidateStore,
  type ProjectOperationOwnerWriter,
} from "./candidate-store.ts";
