/**
 * project-runtime-state-queryに属する責務をまとめる。
 *
 * @responsibility queryProjectRuntimeStateを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000005
 */
import { projectProjectRuntimeState } from "../core/project-runtime-state.ts";
import type { ProjectRuntimeStatePort } from "../ports/state-port.ts";
import {
  PROJECT_RUNTIME_STATE_QUERY_CONTRACT,
  type ProjectRuntimeStateQuery,
  type ProjectRuntimeStateQueryResult,
} from "../public-contract/project-state-query.ts";

/**
 * Read-only application entry. It cannot receive a state mutation capability.
 *
 * @responsibility project-runtime-state-queryの入力からquery Project Runtime 状態を導く規則と結果境界を所有する。
 * @trace ARCH-000005
 * @input state: Pick<ProjectRuntimeStatePort, "readState">、request: ProjectRuntimeStateQuery
 * @returns ProjectRuntimeStateQueryResultを返す。
 * @precondition 「state: Pick<ProjectRuntimeStatePort, "readState">、request: ProjectRuntimeStateQuery」がqueryProjectRuntimeStateの入力契約を満たす。
 * @postcondition queryProjectRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: queryProjectRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: queryProjectRuntimeStateは独自の失敗分岐を所有しない。
 * @invariant queryProjectRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: queryProjectRuntimeStateはProcess内の同一Subsystemで完結する。
 * @security N/A: queryProjectRuntimeStateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: queryProjectRuntimeStateは共有非同期状態を持たない同期処理である。
 */
export function queryProjectRuntimeState(
  state: Pick<ProjectRuntimeStatePort, "readState">,
  request: ProjectRuntimeStateQuery,
): ProjectRuntimeStateQueryResult {
  const observed = state.readState(request.projectId);
  if (observed.status !== "completed")
    return Object.freeze({
      contract: PROJECT_RUNTIME_STATE_QUERY_CONTRACT,
      status: "blocked",
      reason: "project_runtime_state_observation_unknown",
      requestId: request.requestId,
      projectId: request.projectId,
      repositoryRevision: request.repositoryRevision,
      observationState: "unknown",
      projection: null,
      cleanupConfirmed: true,
      manualRecoveryRequired: observed.manualRecoveryRequired,
      effectState: "no_effect",
    });
  if (observed.value === null)
    return Object.freeze({
      contract: PROJECT_RUNTIME_STATE_QUERY_CONTRACT,
      status: "completed",
      reason: "project_runtime_state_absent",
      requestId: request.requestId,
      projectId: request.projectId,
      repositoryRevision: request.repositoryRevision,
      observationState: "absent",
      projection: null,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect",
    });
  if (observed.value.repositoryRevision !== request.repositoryRevision)
    return Object.freeze({
      contract: PROJECT_RUNTIME_STATE_QUERY_CONTRACT,
      status: "blocked",
      reason: "project_runtime_state_revision_mismatch",
      requestId: request.requestId,
      projectId: request.projectId,
      repositoryRevision: request.repositoryRevision,
      observationState: "unknown",
      projection: null,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect",
    });
  return Object.freeze({
    contract: PROJECT_RUNTIME_STATE_QUERY_CONTRACT,
    status: "completed",
    reason: "project_runtime_state_observed",
    requestId: request.requestId,
    projectId: request.projectId,
    repositoryRevision: request.repositoryRevision,
    observationState: "observed",
    projection: projectProjectRuntimeState(observed.value),
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "no_effect",
  });
}
