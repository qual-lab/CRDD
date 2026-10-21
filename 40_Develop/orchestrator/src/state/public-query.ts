/**
 * 公開状態照会を現在の認証・Snapshot Readerへ接続する。
 * @responsibility 公開状態照会を現在の認証・Snapshot Readerへ接続する。
 * @trace ARCH-000004
 */
import { deriveOrchestratorRepositoryBindingId } from "../identity/repository-binding.ts";
import { inspectRepositoryIdentityCandidate } from "../../../coordinator/src/repository-operation/binding.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import {
  inspectOrchestratorStateQuery,
  ORCHESTRATOR_STATE_QUERY_CONTRACT,
} from "./query-contract.ts";
import { workspacePlanReadyForAcceptance } from "../workspace/operations.ts";
import {
  ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
  orchestratorDataBoundaryBlocked,
} from "../operation-result-contract.ts";
import { queryOrchestratorState } from "./query.ts";
import {
  createCurrentOrchestratorPersistencePorts as createOrchestratorPersistencePorts,
  readOrchestratorSnapshot,
} from "../storage/current-state.ts";
import { openRuntimeOwnedWindowsProjectDecisionStore } from "../storage/protected-decision.ts";
import { RepositoryRuntimeDataAreaBlockedError } from "../../../domain-model/src/index.ts";

/**
 * Read-only state entry shared by local transports. No mutation port is exposed.
 *
 * @responsibility Orchestrator Public 状態 Queryの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns executeOrchestratorPublicStateQueryの計算結果を返す。
 * @precondition 「openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がexecuteOrchestratorPublicStateQueryの入力契約を満たす。
 * @postcondition executeOrchestratorPublicStateQueryの責務を完了した結果だけを返す。
 * @effect Repositoryと保存済みSnapshotを観測する。Task実行や状態変更は行わない。
 * @failure executeOrchestratorPublicStateQueryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 読取りのみを行い、欠測・観測不能を正常な状態へ補完しない。
 * @boundary 公開照会入力→Repository・認証済み主体・保存済み状態の読取り境界を接続する。
 * @security 認証済み主体とRepository相関を確認し、認可した照会結果だけを返す。
 * @concurrency 返却される読取り処理の完了・失敗を呼出し側へ搬送する。
 */
export function executeOrchestratorPublicStateQuery(
  openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore,
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  const request = inspectOrchestratorStateQuery(rawRequest);
  if (!request)
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_state_query_invalid",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  let repositoryRoot: string;
  try {
    repositoryRoot =
      resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
  } catch {
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_repository_root_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  }
  const identity = inspectRepositoryIdentityCandidate(repositoryRoot);
  const adoptedPlan =
    identity && identity.commit !== request.repositoryRevision
      ? readOrchestratorSnapshot(
          repositoryRoot,
          deriveOrchestratorRepositoryBindingId(repositoryRoot),
        ).value?.projects.find(
          (plan) =>
            plan.projectId === request.projectId &&
            plan.repositoryRevision === request.repositoryRevision,
        )
      : null;
  if (
    !identity ||
    (identity.commit !== request.repositoryRevision &&
      (!adoptedPlan ||
        !workspacePlanReadyForAcceptance(
          repositoryRoot,
          deriveOrchestratorRepositoryBindingId(repositoryRoot),
          request.projectId,
          adoptedPlan.milestoneId,
          request.repositoryRevision,
          identity.commit,
        )))
  )
    return Object.freeze({
      contract: ORCHESTRATOR_STATE_QUERY_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_state_revision_mismatch",
      requestId: request.requestId,
      projectId: request.projectId,
      repositoryRevision: request.repositoryRevision,
      observationState: "unknown" as const,
      projection: null,
      intakeEpoch: null,
      cleanupConfirmed: true as const,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const authenticated = openDecisionStore();
  if (
    authenticated.status !== "completed" ||
    (authenticationContext !== undefined &&
      authenticationContext.principalId !== authenticated.principalId)
  )
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_authenticated_principal_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const snapshot = readOrchestratorSnapshot(
    repositoryRoot,
    deriveOrchestratorRepositoryBindingId(repositoryRoot),
  );
  if (
    snapshot.status !== "completed" ||
    snapshot.value === null ||
    snapshot.value.schemaRevision !== 3
  )
    return Object.freeze({
      contract: ORCHESTRATOR_STATE_QUERY_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_snapshot_not_initialized",
      requestId: request.requestId,
      projectId: request.projectId,
      repositoryRevision: request.repositoryRevision,
      observationState: "unknown" as const,
      projection: null,
      intakeEpoch: null,
      cleanupConfirmed: true as const,
      manualRecoveryRequired:
        snapshot.status === "blocked" && snapshot.manualRecoveryRequired,
      effectState: "no_effect" as const,
    });
  return queryOrchestratorState(
    createOrchestratorPersistencePorts(
      repositoryRoot,
      deriveOrchestratorRepositoryBindingId(repositoryRoot),
    ).state,
    request,
    snapshot.value.intakeEpoch,
  );
}

/**
 * Production read-only state entry shared by local transports.
 *
 * @responsibility Orchestrator Public 状態 Queryの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns runOrchestratorPublicStateQueryの計算結果を返す。
 * @precondition 「rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がrunOrchestratorPublicStateQueryの入力契約を満たす。
 * @postcondition runOrchestratorPublicStateQueryの責務を完了した結果だけを返す。
 * @effect Repositoryと保存済みSnapshotを観測する。Task実行や状態変更は行わない。
 * @failure runOrchestratorPublicStateQueryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 読取りのみを行い、欠測・観測不能を正常な状態へ補完しない。
 * @boundary 公開照会入力→Repository・認証済み主体・保存済み状態の読取り境界を接続する。
 * @security 認証済み主体とRepository相関を確認し、認可した照会結果だけを返す。
 * @concurrency 返却される読取り処理の完了・失敗を呼出し側へ搬送する。
 */
export function runOrchestratorPublicStateQuery(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    return executeOrchestratorPublicStateQuery(
      () =>
        openRuntimeOwnedWindowsProjectDecisionStore({
          initializeIfMissing: false,
        }),
      rawRequest,
      workingDirectory,
      authenticationContext,
    );
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      return orchestratorDataBoundaryBlocked(error);
    throw error;
  }
}
