/**
 * 人間判断の公開実行を現在の認証・保存へ接続する。
 * @responsibility 人間判断の公開実行を現在の認証・保存へ接続する。
 * @trace ARCH-000004
 */
import { deriveOrchestratorRepositoryBindingId } from "../identity/repository-binding.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import { createOrchestratorDecisionCapabilityAdapter } from "./capability-adapter.ts";
import { inspectOrchestratorDecisionRequest } from "./request.ts";
import {
  orchestratorDecisionRecordId,
  recoverOrchestratorHumanDecision,
  submitOrchestratorHumanDecision,
} from "./lifecycle.ts";
import {
  ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
  orchestratorDataBoundaryBlocked,
} from "../operation-result-contract.ts";
import {
  createOrchestratorSnapshotDecisionRecoveryStore as createOrchestratorDecisionRecoveryStore,
  createCurrentOrchestratorPersistencePorts as createOrchestratorPersistencePorts,
  maintainOrchestratorSnapshot,
} from "../storage/current-state.ts";
import { openRuntimeOwnedWindowsProjectDecisionStore } from "../storage/protected-decision.ts";
import { RepositoryRuntimeDataAreaBlockedError } from "../../../domain-model/src/index.ts";

/**
 * Orchestrator Public Decisionを実行する。
 *
 * @responsibility Orchestrator Public Decisionの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns executeOrchestratorPublicDecisionの計算結果を返す。
 * @precondition 「openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がexecuteOrchestratorPublicDecisionの入力契約を満たす。
 * @postcondition executeOrchestratorPublicDecisionの責務を完了した結果だけを返す。
 * @effect 認証済み主体と判断記録を観測し、判断の保存と許可済み処置を既存Ownerへ委譲する。
 * @failure executeOrchestratorPublicDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 判断の対象・世代・既存処置の相関を維持し、二重処置へ補正しない。
 * @boundary 公開判断入力→Principal観測・判断Store・処置委譲の境界を接続する。
 * @security 認証済み主体と判断対象の相関を確認し、判断Capabilityの発行・消費を既存Ownerへ限定する。
 * @concurrency 返却される非同期判断処理の完了・失敗を呼出し側へ搬送する。
 */
export function executeOrchestratorPublicDecision(
  openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore,
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  const request = inspectOrchestratorDecisionRequest(rawRequest);
  if (!request)
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_decision_input_invalid",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const { decisionId, projectId, milestoneId } = request;
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
  const protectedStore = openDecisionStore();
  if (
    protectedStore.status !== "completed" ||
    (authenticationContext !== undefined &&
      authenticationContext.principalId !== protectedStore.principalId)
  )
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_decision_store_unavailable",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown" as const,
    });
  const decisionCapability = createOrchestratorDecisionCapabilityAdapter();
  const recordId = orchestratorDecisionRecordId(
    decisionCapability,
    projectId,
    milestoneId,
    decisionId,
  );
  const observed = protectedStore.store.read(recordId) as Readonly<{
    status: "completed";
    value: Readonly<Record<string, unknown>> | null;
  }> | null;
  const record = observed?.status === "completed" ? observed.value : null;
  if (
    !record ||
    typeof record.queueId !== "string" ||
    typeof record.repositoryRevision !== "string"
  )
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_decision_not_observed",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const commonFields = {
    projectId,
    milestoneId,
    queueId: record.queueId,
    principalId: protectedStore.principalId,
    store: protectedStore.store,
    recoveryStore: createOrchestratorDecisionRecoveryStore(
      repositoryRoot,
      deriveOrchestratorRepositoryBindingId(repositoryRoot),
    ),
    capability: decisionCapability,
    persistence: createOrchestratorPersistencePorts(
      repositoryRoot,
      deriveOrchestratorRepositoryBindingId(repositoryRoot),
    ),
  } as const;
  const result =
    record.disposition === "prepared"
      ? recoverOrchestratorHumanDecision(commonFields, { recordId })
      : submitOrchestratorHumanDecision(commonFields, {
          decisionId,
          recordId,
          repositoryRevision: request.repositoryRevision,
          generation: request.generation,
          selectedOption: request.selectedOption,
          continuationCapability: request.continuationCapability,
        });
  if (result.status === "completed") {
    const maintained = maintainOrchestratorSnapshot(
      repositoryRoot,
      deriveOrchestratorRepositoryBindingId(repositoryRoot),
    );
    if (maintained.status !== "completed")
      return Object.freeze({
        ...result,
        status: "blocked" as const,
        reason: maintained.reason,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown" as const,
      });
  }
  return result;
}

/**
 * Production decision entry shared by the CLI and MCP process.
 *
 * @responsibility Orchestrator Public Decisionの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns runOrchestratorPublicDecisionの計算結果を返す。
 * @precondition 「rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がrunOrchestratorPublicDecisionの入力契約を満たす。
 * @postcondition runOrchestratorPublicDecisionの責務を完了した結果だけを返す。
 * @effect 認証済み主体と判断記録を観測し、判断の保存と許可済み処置を既存Ownerへ委譲する。
 * @failure runOrchestratorPublicDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 判断の対象・世代・既存処置の相関を維持し、二重処置へ補正しない。
 * @boundary 公開判断入力→Principal観測・判断Store・処置委譲の境界を接続する。
 * @security 認証済み主体と判断対象の相関を確認し、判断Capabilityの発行・消費を既存Ownerへ限定する。
 * @concurrency 返却される非同期判断処理の完了・失敗を呼出し側へ搬送する。
 */
export function runOrchestratorPublicDecision(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    return executeOrchestratorPublicDecision(
      openRuntimeOwnedWindowsProjectDecisionStore,
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
