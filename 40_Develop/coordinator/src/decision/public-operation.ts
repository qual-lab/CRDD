/**
 * 人間判断の公開実行を現在の認証・保存へ接続する。
 * @responsibility 人間判断の公開実行を現在の認証・保存へ接続する。
 * @trace ARCH-000004
 */

import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  inspectRepositoryIdentityCandidate,
} from "../../../version-control/src/index.ts";
import {
  COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
  coordinatorDataBoundaryBlocked,
} from "../state/result.ts";
import { workspacePlanReadyForAcceptance } from "../workspace/operations.ts";
import { deriveCoordinatorRepositoryBindingId } from "../state/model.ts";
import { recordCoordinatorAcceptanceDecision } from "./acceptance.ts";
import {
  createCurrentCoordinatorPersistencePorts as createCoordinatorPersistencePorts,
  createCoordinatorSnapshotAcceptanceDecisionStore as createCoordinatorAcceptanceDecisionStore,
  maintainCoordinatorSnapshot,
  createCoordinatorSnapshotDecisionRecoveryStore as createCoordinatorDecisionRecoveryStore,
} from "../storage/current-state.ts";
import {
  createCoordinatorAcceptanceAuthorityAdapter,
  inspectCoordinatorDecisionRequest,
} from "./request.ts";
import { RepositoryRuntimeDataAreaBlockedError } from "../../../domain-model/src/index.ts";
import { openRuntimeOwnedWindowsProjectDecisionStore } from "../storage/protected-decision.ts";
import {
  createCoordinatorDecisionCapabilityAdapter,
  coordinatorDecisionRecordId,
  recoverCoordinatorHumanDecision,
  submitCoordinatorHumanDecision,
} from "./lifecycle.ts";

/**
 * Public Acceptance Decisionを検証済みRepository、認証Principal、耐久Storeおよび状態Storeへ接続する。
 *
 * @responsibility SPEC-000002の明示判断だけを公開入口からAcceptance Decision Applicationへ搬送する。
 * @trace ARCH-000005
 * @input rawRequest: 未信頼要求、workingDirectory: Repository内Path、authenticationContext: 認証済みPrincipal。
 * @returns Acceptance Decision Applicationの公開結果を返す。
 * @precondition 認証ContextはRuntime-owned認証境界で構築される。
 * @postcondition 成功時は一つのDecision Recordと必要な状態更新だけを確定する。
 * @effect Repository-local Acceptance Decision StoreとCoordinator Stateだけを更新する。
 * @failure Root、Revision、Principal、AuthorityまたはStoreを確認できない場合はEffectを拡張せず停止する。
 * @invariant Task作成、Provider EffectおよびProjection由来Authorityを発行しない。
 * @boundary 公開Transport→Coordinatorの受入判断→Repository-local Storeの境界。
 * @security 認証Principalをexact比較し、非公開Store Pathや秘密値を結果へ含めない。
 * @concurrency State世代とDecision Recordの排他的世代作成で競合を拒否する。
 */
export function executeCoordinatorPublicAcceptanceDecision(
  authenticate: () =>
    | Readonly<{ status: "completed"; principalId: string }>
    | Readonly<{ status: "blocked"; principalId: null }>,
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
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
    const identity = inspectRepositoryIdentityCandidate(repositoryRoot);
    const candidate =
      rawRequest && typeof rawRequest === "object"
        ? (rawRequest as Readonly<{
            repositoryRevision?: unknown;
            projectId?: unknown;
            milestoneId?: unknown;
            principalId?: unknown;
            decision?: unknown;
          }>)
        : null;
    if (
      !identity ||
      typeof candidate?.repositoryRevision !== "string" ||
      typeof candidate.projectId !== "string" ||
      typeof candidate.milestoneId !== "string" ||
      !(
        (candidate.decision !== "accept" &&
          identity.commit === candidate.repositoryRevision) ||
        workspacePlanReadyForAcceptance(
          repositoryRoot,
          deriveCoordinatorRepositoryBindingId(repositoryRoot),
          candidate.projectId,
          candidate.milestoneId,
          candidate.repositoryRevision,
          identity.commit,
        )
      )
    )
      return Object.freeze({
        contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "orchestrator_acceptance_revision_mismatch",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    const authenticated = authenticate();
    if (
      authenticated.status !== "completed" ||
      authenticationContext === undefined ||
      authenticationContext.principalId !== authenticated.principalId ||
      candidate.principalId !== authenticated.principalId ||
      typeof candidate.projectId !== "string"
    )
      return Object.freeze({
        contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "orchestrator_authenticated_principal_not_verified",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    const repositoryBindingId =
      deriveCoordinatorRepositoryBindingId(repositoryRoot);
    const result = recordCoordinatorAcceptanceDecision(
      Object.freeze({
        state: createCoordinatorPersistencePorts(
          repositoryRoot,
          repositoryBindingId,
        ).state,
        authority: createCoordinatorAcceptanceAuthorityAdapter(
          authenticated.principalId,
        ),
        store: createCoordinatorAcceptanceDecisionStore(
          repositoryRoot,
          repositoryBindingId,
        ),
      }),
      rawRequest,
    );
    if (result.status === "completed") {
      const maintenance = maintainCoordinatorSnapshot(
        repositoryRoot,
        repositoryBindingId,
      );
      if (maintenance.status !== "completed")
        return Object.freeze({
          ...result,
          status: "blocked" as const,
          reason: maintenance.reason,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        });
    }
    return result;
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      return coordinatorDataBoundaryBlocked(error);
    return Object.freeze({
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_acceptance_boundary_unknown",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown" as const,
    });
  }
}

/**
 * Production認証境界を用いてPublic Acceptance Decisionを実行する。
 *
 * @responsibility Runtime-owned Principal観測を公開Acceptance Decision入口へ固定する。
 * @trace ARCH-000005
 * @input rawRequest: 未信頼要求、workingDirectory: Repository内Path、authenticationContext: 認証済みPrincipal。
 * @returns executeCoordinatorPublicAcceptanceDecisionの結果を返す。
 * @precondition Runtime-owned Windows Decision StoreがLocal Principalを検証できる。
 * @postcondition Production入口は検証済みPrincipalだけをCoreへ渡す。
 * @effect Acceptance Decision Recordと必要なCoordinator Stateだけを更新する。
 * @failure 認証またはRuntime Data観測不能を理由付き停止へ変換する。
 * @invariant Test専用認証をProduction入口へ使用しない。
 * @boundary Local TransportとProduction Composition Rootの境界。
 * @security Store自体を公開せずPrincipal観測結果だけをAuthorityへ渡す。
 * @concurrency 下位Storeの世代制御を維持する。
 */
export function runCoordinatorPublicAcceptanceDecision(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  return executeCoordinatorPublicAcceptanceDecision(
    () => {
      const observed = openRuntimeOwnedWindowsProjectDecisionStore();
      return observed.status === "completed"
        ? Object.freeze({
            status: "completed" as const,
            principalId: observed.principalId,
          })
        : Object.freeze({ status: "blocked" as const, principalId: null });
    },
    rawRequest,
    workingDirectory,
    authenticationContext,
  );
}

/**
 * Runtime所有の判断Storeを開き、Client Principalを観測する。
 *
 * @responsibility 保護Storeの確認結果をPrincipal観測結果へ投影する。
 * @trace ARCH-000004
 * @input N/A: 呼出し引数を受け取らない。
 * @returns 検証できたPrincipal ID、またはunknownを返す。
 * @precondition Runtime所有Storeを確認できる実行環境である。
 * @postcondition 下位Storeがcompletedの場合だけverifiedを返す。
 * @effect 下位Adapterを通じて保護Storeと実行環境を確認し、既存契約に従い未作成Storeを初期化し得る。
 * @failure Storeを確認できなければunknownを返し、検証済みと扱わない。
 * @invariant 観測不能を不存在または認証成功へ変換しない。
 * @boundary 保護された判断Storeから公開Principal観測への境界。
 * @security 秘密値や判断Authorityは返さず、検証済みPrincipal IDだけを公開する。
 * @concurrency 下位Storeの排他・検証契約を変更せず、呼出しごとに観測する。
 */
export function observeRuntimeOwnedProjectClientPrincipal() {
  const observed = openRuntimeOwnedWindowsProjectDecisionStore();
  return observed.status === "completed"
    ? Object.freeze({
        status: "verified" as const,
        principalId: observed.principalId,
      })
    : Object.freeze({ status: "unknown" as const });
}

/**
 * Coordinator Public Decisionを実行する。
 *
 * @responsibility Coordinator Public Decisionの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns executeCoordinatorPublicDecisionの計算結果を返す。
 * @precondition 「openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がexecuteCoordinatorPublicDecisionの入力契約を満たす。
 * @postcondition executeCoordinatorPublicDecisionの責務を完了した結果だけを返す。
 * @effect 認証済み主体と判断記録を観測し、判断の保存と許可済み処置を既存Ownerへ委譲する。
 * @failure executeCoordinatorPublicDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 判断の対象・世代・既存処置の相関を維持し、二重処置へ補正しない。
 * @boundary 公開判断入力→Principal観測・判断Store・処置委譲の境界を接続する。
 * @security 認証済み主体と判断対象の相関を確認し、判断Capabilityの発行・消費を既存Ownerへ限定する。
 * @concurrency 返却される非同期判断処理の完了・失敗を呼出し側へ搬送する。
 */
export function executeCoordinatorPublicDecision(
  openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore,
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  const request = inspectCoordinatorDecisionRequest(rawRequest);
  if (!request)
    return Object.freeze({
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
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
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
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
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_decision_store_unavailable",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown" as const,
    });
  const decisionCapability = createCoordinatorDecisionCapabilityAdapter();
  const recordId = coordinatorDecisionRecordId(
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
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
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
    recoveryStore: createCoordinatorDecisionRecoveryStore(
      repositoryRoot,
      deriveCoordinatorRepositoryBindingId(repositoryRoot),
    ),
    capability: decisionCapability,
    persistence: createCoordinatorPersistencePorts(
      repositoryRoot,
      deriveCoordinatorRepositoryBindingId(repositoryRoot),
    ),
  } as const;
  const result =
    record.disposition === "prepared"
      ? recoverCoordinatorHumanDecision(commonFields, { recordId })
      : submitCoordinatorHumanDecision(commonFields, {
          decisionId,
          recordId,
          repositoryRevision: request.repositoryRevision,
          generation: request.generation,
          selectedOption: request.selectedOption,
          continuationCapability: request.continuationCapability,
        });
  if (result.status === "completed") {
    const maintained = maintainCoordinatorSnapshot(
      repositoryRoot,
      deriveCoordinatorRepositoryBindingId(repositoryRoot),
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
 * @responsibility Coordinator Public Decisionの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns runCoordinatorPublicDecisionの計算結果を返す。
 * @precondition 「rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がrunCoordinatorPublicDecisionの入力契約を満たす。
 * @postcondition runCoordinatorPublicDecisionの責務を完了した結果だけを返す。
 * @effect 認証済み主体と判断記録を観測し、判断の保存と許可済み処置を既存Ownerへ委譲する。
 * @failure runCoordinatorPublicDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 判断の対象・世代・既存処置の相関を維持し、二重処置へ補正しない。
 * @boundary 公開判断入力→Principal観測・判断Store・処置委譲の境界を接続する。
 * @security 認証済み主体と判断対象の相関を確認し、判断Capabilityの発行・消費を既存Ownerへ限定する。
 * @concurrency 返却される非同期判断処理の完了・失敗を呼出し側へ搬送する。
 */
export function runCoordinatorPublicDecision(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    return executeCoordinatorPublicDecision(
      openRuntimeOwnedWindowsProjectDecisionStore,
      rawRequest,
      workingDirectory,
      authenticationContext,
    );
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      return coordinatorDataBoundaryBlocked(error);
    throw error;
  }
}
