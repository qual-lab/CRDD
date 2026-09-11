import { projectProjectRuntimeState } from "../core/project-runtime-state.ts";
import type { ProjectRuntimeStatePort } from "../ports/state-port.ts";
import {
  PROJECT_RUNTIME_STATE_QUERY_CONTRACT,
  type ProjectRuntimeStateQuery,
  type ProjectRuntimeStateQueryResult,
} from "../public-contract/project-state-query.ts";

/** Read-only application entry. It cannot receive a state mutation capability. */
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
