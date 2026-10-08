/**
 * orchestrator-state-queryに属する責務をまとめる。
 *
 * @responsibility queryOrchestratorStateを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000005
 */
import { projectOrchestratorState } from "./transitions.ts";
import type { OrchestratorStatePort } from "./persistence.ts";
import {
  ORCHESTRATOR_STATE_QUERY_CONTRACT,
  type OrchestratorStateQuery,
  type OrchestratorStateQueryResult,
} from "./query-contract.ts";

/**
 * Read-only application entry. It cannot receive a state mutation capability.
 *
 * @responsibility orchestrator-state-queryの入力からquery Orchestrator 状態を導く規則と結果境界を所有する。
 * @trace ARCH-000005
 * @input state: Pick<OrchestratorStatePort, "readState">、request: OrchestratorStateQuery
 * @returns OrchestratorStateQueryResultを返す。
 * @precondition 「state: Pick<OrchestratorStatePort, "readState">、request: OrchestratorStateQuery」がqueryOrchestratorStateの入力契約を満たす。
 * @postcondition queryOrchestratorStateの責務を完了した結果だけを返す。
 * @effect N/A: queryOrchestratorStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: queryOrchestratorStateは独自の失敗分岐を所有しない。
 * @invariant queryOrchestratorStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: queryOrchestratorStateはProcess内の同一Subsystemで完結する。
 * @security N/A: queryOrchestratorStateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: queryOrchestratorStateは共有非同期状態を持たない同期処理である。
 */
export function queryOrchestratorState(
  state: Pick<OrchestratorStatePort, "readState">,
  request: OrchestratorStateQuery,
  intakeEpoch: string,
): OrchestratorStateQueryResult {
  const observed = state.readState(request.projectId);
  if (observed.status !== "completed")
    return Object.freeze({
      contract: ORCHESTRATOR_STATE_QUERY_CONTRACT,
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
      contract: ORCHESTRATOR_STATE_QUERY_CONTRACT,
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
      contract: ORCHESTRATOR_STATE_QUERY_CONTRACT,
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
    contract: ORCHESTRATOR_STATE_QUERY_CONTRACT,
    status: "completed",
    reason: "orchestrator_state_observed",
    requestId: request.requestId,
    projectId: request.projectId,
    repositoryRevision: request.repositoryRevision,
    observationState: "observed",
    projection: projectOrchestratorState(observed.value),
    intakeEpoch,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "no_effect",
  });
}
