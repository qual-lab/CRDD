/**
 * 現在状態の読取り専用照会と公開要求の対象確認を所有する。
 *
 * @responsibility Principal・Root・Revisionを確認し、既存Snapshot Readerと状態投影へ接続する。状態変更は行わない。
 * @trace ARCH-000005
 */

import {
  ExecutionStorageBlockedError,
  isPrincipalId,
  type ProjectExecutionState,
  readState,
  readProjectExecutionState,
} from "../../../execution-model/src/index.ts";
import {
  getRepository,
  readRepositorySnapshot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "../../../version-control/src/index.ts";
import { verifyRuntimePersistenceRepository } from "../execution/persistence.ts";
import { workspacePlanReadyForAcceptance } from "../workspace/operations.ts";
import type { CoordinatorStatePort } from "./persistence.ts";
import { projectCoordinatorState } from "./projection.ts";

import { coordinatorDataBoundaryBlocked, type StoreResult } from "./result.ts";

import { deriveCoordinatorRepositoryBindingId } from "./validation.ts";

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

/**
 * Read-only state entry shared by local transports. No mutation port is exposed.
 *
 * @responsibility Coordinator Public 状態 Queryの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、workingDirectory、authenticationContext: 入口が認証・認可したPrincipal。
 * @returns executeCoordinatorPublicStateQueryの計算結果を返す。
 * @precondition 入口が現在の認証・認可を確認する。Decision Storeの所在や可用性を本人確認へ使わない。
 * @postcondition executeCoordinatorPublicStateQueryの責務を完了した結果だけを返す。
 * @effect Repositoryと保存済みSnapshotを観測する。Task実行や状態変更は行わない。
 * @failure executeCoordinatorPublicStateQueryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 読取りのみを行い、欠測・観測不能を正常な状態へ補完しない。
 * @boundary 公開照会入力→Repository・認証済み主体・保存済み状態の読取り境界を接続する。
 * @security 認証済み主体とRepository相関を確認し、認可した照会結果だけを返す。
 * @concurrency 返却される読取り処理の完了・失敗を呼出し側へ搬送する。
 */
export function executeCoordinatorPublicStateQuery(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  const request = inspectCoordinatorStateQuery(rawRequest);
  if (!request)
    return Object.freeze({
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_state_query_invalid",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  if (
    authenticationContext === undefined ||
    !isPrincipalId(authenticationContext.principalId)
  )
    return Object.freeze({
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_authenticated_principal_not_verified",
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
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_repository_root_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  }
  const identity = readRepositorySnapshot(
    getRepository(repositoryRoot).capability,
  );
  const adoptedPlan =
    identity && identity.revisionIdentity !== request.repositoryRevision
      ? readState(
          verifyRuntimePersistenceRepository(repositoryRoot),
          deriveCoordinatorRepositoryBindingId(repositoryRoot),
          "execution",
        ).value?.projects.find(
          (plan) =>
            plan.projectId === request.projectId &&
            plan.repositoryRevision === request.repositoryRevision,
        )
      : null;
  if (
    !identity ||
    (identity.revisionIdentity !== request.repositoryRevision &&
      (!adoptedPlan ||
        !workspacePlanReadyForAcceptance(
          repositoryRoot,
          deriveCoordinatorRepositoryBindingId(repositoryRoot),
          request.projectId,
          adoptedPlan.milestoneId,
          request.repositoryRevision,
          identity.revisionIdentity,
        )))
  )
    return Object.freeze({
      contract: COORDINATOR_STATE_QUERY_CONTRACT,
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
  const snapshot = readState(
    verifyRuntimePersistenceRepository(repositoryRoot),
    deriveCoordinatorRepositoryBindingId(repositoryRoot),
    "execution",
  );
  if (
    snapshot.status !== "completed" ||
    snapshot.value === null ||
    snapshot.value.schemaRevision !== 7
  )
    return Object.freeze({
      contract: COORDINATOR_STATE_QUERY_CONTRACT,
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
  const current = snapshot.value;
  return queryCoordinatorState(
    {
      readState: (projectId) =>
        Object.freeze({
          status: "completed",
          reason: "orchestrator_state_observed",
          value:
            current.projects.find(
              (project) => project.projectId === projectId,
            ) ?? null,
        }),
    },
    request,
    current.intakeEpoch,
  );
}

/**
 * Production read-only state entry shared by local transports.
 *
 * @responsibility Coordinator Public 状態 Queryの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns queryStateの計算結果を返す。
 * @precondition 「rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がqueryStateの入力契約を満たす。
 * @postcondition queryStateの責務を完了した結果だけを返す。
 * @effect Repositoryと保存済みSnapshotを観測する。Task実行や状態変更は行わない。
 * @failure queryStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 読取りのみを行い、欠測・観測不能を正常な状態へ補完しない。
 * @boundary 公開照会入力→Repository・認証済み主体・保存済み状態の読取り境界を接続する。
 * @security 認証済み主体とRepository相関を確認し、認可した照会結果だけを返す。
 * @concurrency 返却される読取り処理の完了・失敗を呼出し側へ搬送する。
 */
export function queryState(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    return executeCoordinatorPublicStateQuery(
      rawRequest,
      workingDirectory,
      authenticationContext,
    );
  } catch (error) {
    if (error instanceof ExecutionStorageBlockedError)
      return coordinatorDataBoundaryBlocked(error);
    throw error;
  }
}

/**
 * 新版の現在状態からProjectを読み取る。
 * @responsibility Docker回復の利用側にも同じ保存値を提供する。
 * @trace ARCH-000004
 * @input Repository Root、binding、Project ID。
 * @returns Project状態または観測停止。
 * @precondition 呼出し権限は上位で検証する。
 * @postcondition 不存在と未初期化を区別する。
 * @effect 読取りと短期排他のみ。
 * @failure 旧版、pending、破損は停止する。
 * @invariant 読取りによる初期化やFallbackをしない。
 * @boundary 保存と回復利用側。
 * @security 保存値はAuthorityではない。
 * @concurrency 同Owner下でProject値を確定する。
 */
export function readCurrentCoordinatorState(
  workingDirectory: string,
  binding: string,
  projectId: string,
): StoreResult<ProjectExecutionState | null> {
  return readProjectExecutionState(
    verifyRuntimePersistenceRepository(workingDirectory),
    binding,
    projectId,
  );
}

import {
  COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
  COORDINATOR_STATE_QUERY_CONTRACT,
  inspectCoordinatorStateQuery,
} from "./projection.ts";
import type {
  CoordinatorStateQuery,
  CoordinatorStateQueryResult,
} from "./types.ts";
