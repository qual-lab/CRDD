/**
 * 受入判断を現在の認証・Repository・保存へ接続する。
 * @responsibility 受入判断を現在の認証・Repository・保存へ接続する。
 * @trace ARCH-000004
 */
import {
  orchestratorDataBoundaryBlocked,
  ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
} from "../operation-result-contract.ts";
import { deriveOrchestratorRepositoryBindingId } from "../identity/repository-binding.ts";
import { inspectRepositoryIdentityCandidate } from "../../../version-control/src/index.ts";
import { RepositoryRuntimeDataAreaBlockedError } from "../../../domain-model/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import { createOrchestratorAcceptanceAuthorityAdapter } from "./authority-adapter.ts";
import { workspacePlanReadyForAcceptance } from "../workspace/operations.ts";
import { recordOrchestratorAcceptanceDecision } from "./record-acceptance.ts";
import {
  createOrchestratorSnapshotAcceptanceDecisionStore as createOrchestratorAcceptanceDecisionStore,
  createCurrentOrchestratorPersistencePorts as createOrchestratorPersistencePorts,
  maintainOrchestratorSnapshot,
} from "../storage/current-state.ts";
import { openRuntimeOwnedWindowsProjectDecisionStore } from "../storage/protected-decision.ts";

/**
 * Public Acceptance Decisionを検証済みRepository、認証Principal、耐久Storeおよび状態Storeへ接続する。
 *
 * @responsibility SPEC-000002の明示判断だけを公開入口からAcceptance Decision Applicationへ搬送する。
 * @trace ARCH-000005
 * @input rawRequest: 未信頼要求、workingDirectory: Repository内Path、authenticationContext: 認証済みPrincipal。
 * @returns Acceptance Decision Applicationの公開結果を返す。
 * @precondition 認証ContextはRuntime-owned認証境界で構築される。
 * @postcondition 成功時は一つのDecision Recordと必要な状態更新だけを確定する。
 * @effect Repository-local Acceptance Decision StoreとOrchestrator Stateだけを更新する。
 * @failure Root、Revision、Principal、AuthorityまたはStoreを確認できない場合はEffectを拡張せず停止する。
 * @invariant Task作成、Provider EffectおよびProjection由来Authorityを発行しない。
 * @boundary 公開Transport→Orchestratorの受入判断→Repository-local Storeの境界。
 * @security 認証Principalをexact比較し、非公開Store Pathや秘密値を結果へ含めない。
 * @concurrency State世代とDecision Recordの排他的世代作成で競合を拒否する。
 */
export function executeOrchestratorPublicAcceptanceDecision(
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
        contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
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
          deriveOrchestratorRepositoryBindingId(repositoryRoot),
          candidate.projectId,
          candidate.milestoneId,
          candidate.repositoryRevision,
          identity.commit,
        )
      )
    )
      return Object.freeze({
        contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
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
        contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "orchestrator_authenticated_principal_not_verified",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    const repositoryBindingId =
      deriveOrchestratorRepositoryBindingId(repositoryRoot);
    const result = recordOrchestratorAcceptanceDecision(
      Object.freeze({
        state: createOrchestratorPersistencePorts(
          repositoryRoot,
          repositoryBindingId,
        ).state,
        authority: createOrchestratorAcceptanceAuthorityAdapter(
          authenticated.principalId,
        ),
        store: createOrchestratorAcceptanceDecisionStore(
          repositoryRoot,
          repositoryBindingId,
        ),
      }),
      rawRequest,
    );
    if (result.status === "completed") {
      const maintenance = maintainOrchestratorSnapshot(
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
      return orchestratorDataBoundaryBlocked(error);
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
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
 * @returns executeOrchestratorPublicAcceptanceDecisionの結果を返す。
 * @precondition Runtime-owned Windows Decision StoreがLocal Principalを検証できる。
 * @postcondition Production入口は検証済みPrincipalだけをCoreへ渡す。
 * @effect Acceptance Decision Recordと必要なOrchestrator Stateだけを更新する。
 * @failure 認証またはRuntime Data観測不能を理由付き停止へ変換する。
 * @invariant Test専用認証をProduction入口へ使用しない。
 * @boundary Local TransportとProduction Composition Rootの境界。
 * @security Store自体を公開せずPrincipal観測結果だけをAuthorityへ渡す。
 * @concurrency 下位Storeの世代制御を維持する。
 */
export function runOrchestratorPublicAcceptanceDecision(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  return executeOrchestratorPublicAcceptanceDecision(
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
