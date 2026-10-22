/**
 * state-queryに属する責務をまとめる。
 *
 * @responsibility queryCoordinatorStateを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000005
 */
import { projectCoordinatorState } from "./projection.ts";
import type { CoordinatorStatePort } from "./persistence.ts";
import {
  COORDINATOR_STATE_QUERY_CONTRACT,
  type CoordinatorStateQuery,
  type CoordinatorStateQueryResult,
} from "./query-contract.ts";

/**
 * Read-only application entry. It cannot receive a state mutation capability.
 *
 * @responsibility state-queryの入力からquery Coordinator 状態を導く規則と結果境界を所有する。
 * @trace ARCH-000005
 * @input state: Pick<CoordinatorStatePort, "readState">、request: CoordinatorStateQuery
 * @returns CoordinatorStateQueryResultを返す。
 * @precondition 「state: Pick<CoordinatorStatePort, "readState">、request: CoordinatorStateQuery」がqueryCoordinatorStateの入力契約を満たす。
 * @postcondition queryCoordinatorStateの責務を完了した結果だけを返す。
 * @effect N/A: queryCoordinatorStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: queryCoordinatorStateは独自の失敗分岐を所有しない。
 * @invariant queryCoordinatorStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: queryCoordinatorStateはProcess内の同一Subsystemで完結する。
 * @security N/A: queryCoordinatorStateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: queryCoordinatorStateは共有非同期状態を持たない同期処理である。
 */
export function queryCoordinatorState(
  state: Pick<CoordinatorStatePort, "readState">,
  request: CoordinatorStateQuery,
  intakeEpoch: string,
): CoordinatorStateQueryResult {
  const observed = state.readState(request.projectId);
  if (observed.status !== "completed")
    return Object.freeze({
      contract: COORDINATOR_STATE_QUERY_CONTRACT,
      status: "blocked",
      reason: "orchestrator_state_observation_unknown",
      requestId: request.requestId,
      projectId: request.projectId,
      repositoryRevision: request.repositoryRevision,
      observationState: "unknown",
      projection: null,
      intakeEpoch: null,
      cleanupConfirmed: true,
      manualRecoveryRequired: observed.manualRecoveryRequired,
      effectState: "no_effect",
    });
  if (observed.value === null)
    return Object.freeze({
      contract: COORDINATOR_STATE_QUERY_CONTRACT,
      status: "completed",
      reason: "orchestrator_state_absent",
      requestId: request.requestId,
      projectId: request.projectId,
      repositoryRevision: request.repositoryRevision,
      observationState: "absent",
      projection: null,
      intakeEpoch,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect",
    });
  if (observed.value.repositoryRevision !== request.repositoryRevision)
    return Object.freeze({
      contract: COORDINATOR_STATE_QUERY_CONTRACT,
      status: "blocked",
      reason: "orchestrator_state_revision_mismatch",
      requestId: request.requestId,
      projectId: request.projectId,
      repositoryRevision: request.repositoryRevision,
      observationState: "unknown",
      projection: null,
      intakeEpoch: null,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect",
    });
  return Object.freeze({
    contract: COORDINATOR_STATE_QUERY_CONTRACT,
    status: "completed",
    reason: "orchestrator_state_observed",
    requestId: request.requestId,
    projectId: request.projectId,
    repositoryRevision: request.repositoryRevision,
    observationState: "observed",
    projection: projectCoordinatorState(observed.value),
    intakeEpoch,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "no_effect",
  });
}
