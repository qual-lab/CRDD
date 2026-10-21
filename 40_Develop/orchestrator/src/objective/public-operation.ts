/**
 * Objective公開実行と本番依存・開発用構築を所有する。
 * @responsibility Objective公開実行と本番依存・開発用構築を所有する。
 * @trace ARCH-000004
 */
import { observePlatformFamily } from "../../../platform-access/src/index.ts";
import {
  cancelRuntimeOwnedCoordinatorTask,
  captureRuntimeOwnedCoordinatorTaskResultDelivery,
  startRuntimeOwnedCoordinatorTask,
} from "../../../coordinator/src/task/execution.ts";
import type { OrchestratorExecutionPublicationObservation } from "../task/execution-contract.ts";
import { recordOrchestratorExecutionEvent } from "../task/intelligence-adapter.ts";
import { openRuntimeOwnedWindowsProjectDecisionStore } from "../storage/protected-decision.ts";
import {
  writeOrchestratorExecutionIntelligenceDiagnostic,
  writeOrchestratorRecoveryDiagnostic,
} from "../task/execution-diagnostics.ts";
import { createHash } from "node:crypto";
import {
  type OrchestratorObjectiveRequest,
  inspectOrchestratorObjectiveRequest,
} from "./request.ts";
import { deriveOrchestratorRepositoryBindingId } from "../identity/repository-binding.ts";
import {
  recoverRuntimeOwnedDockerTaskForCurrentConsumer,
  resolveRuntimeOwnedDockerTaskCurrentCorrelations,
} from "../../../coordinator/src/index.ts";
import { inspectRepositoryIdentityCandidate } from "../../../coordinator/src/repository-operation/binding.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import { createOrchestratorObjectiveResult } from "./plan.ts";
import { workspacePlanReadyForAcceptance } from "../workspace/operations.ts";
import {
  ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
  orchestratorDataBoundaryBlocked,
} from "../operation-result-contract.ts";
import { runOrchestratorSingleTaskAttempt } from "../task/execute-attempt.ts";
import { readOrchestratorSnapshot } from "../storage/current-state.ts";
import {
  collectDockerRecoveryAcknowledgementAfterProjectRecord,
  consumeDockerRecoveryReceiptAfterProjectSettlement,
  createProjectResultAcceptanceReader,
} from "../task/settle-docker-recovery.ts";
import { runOrchestratorObjective } from "./intake-dependencies.ts";
import { createOrchestratorWindowsPlatformAdapter } from "../platform/windows-adapter.ts";
import { RepositoryRuntimeDataAreaBlockedError } from "../../../domain-model/src/index.ts";
import { executeOrchestratorPublicDecision } from "../decision/public-operation.ts";
import { executeOrchestratorPublicStateQuery } from "../state/public-query.ts";

/**
 * 公開Objective実行が利用する依存契約を定義する。
 *
 * @responsibility Public Execution DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape PublicExecutionDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PublicExecutionDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: PublicExecutionDependenciesの宣言は外部境界を開かない。
 * @security N/A: PublicExecutionDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility PublicExecutionDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PublicExecutionDependencies = Readonly<{
  startTask: typeof startRuntimeOwnedCoordinatorTask;
  cancelTask: typeof cancelRuntimeOwnedCoordinatorTask;
  captureResultDelivery: typeof captureRuntimeOwnedCoordinatorTaskResultDelivery;
  frontProviderForTask: (
    requestedExecutorProvider: "auto" | "codex" | "claude",
  ) => "codex" | "claude";
  openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore;
  resolveTaskRecoveryCorrelations?: (
    correlationIds: readonly string[],
  ) => unknown;
  recordExecutionEvent: typeof recordOrchestratorExecutionEvent;
  observeExecutionEventPublication: (
    observation: OrchestratorExecutionPublicationObservation,
  ) => void;
}>;

/**
 * 開発用Objective構成が差し替える依存契約を定義する。
 *
 * @responsibility Orchestrator Public Development DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorPublicDevelopmentDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorPublicDevelopmentDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorPublicDevelopmentDependenciesの宣言は外部境界を開かない。
 * @security N/A: OrchestratorPublicDevelopmentDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorPublicDevelopmentDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorPublicDevelopmentDependencies = Omit<
  PublicExecutionDependencies,
  "recordExecutionEvent" | "observeExecutionEventPublication"
> &
  Partial<
    Pick<
      PublicExecutionDependencies,
      "recordExecutionEvent" | "observeExecutionEventPublication"
    >
  >;

const productionExecutionDependencies: PublicExecutionDependencies =
  Object.freeze({
    startTask: startRuntimeOwnedCoordinatorTask,
    cancelTask: cancelRuntimeOwnedCoordinatorTask,
    captureResultDelivery: captureRuntimeOwnedCoordinatorTaskResultDelivery,
    frontProviderForTask: () => "codex",
    openDecisionStore: openRuntimeOwnedWindowsProjectDecisionStore,
    recordExecutionEvent: recordOrchestratorExecutionEvent,
    observeExecutionEventPublication:
      writeOrchestratorExecutionIntelligenceDiagnostic,
  });

/**
 * 指定した構成要素を用途別の安定Identityへ変換する。
 *
 * @responsibility 入力した構成要素と用途prefixのHash生成を所有する。
 * @trace ARCH-000004
 * @input prefix: string、parts: readonly string[]
 * @returns stableの計算結果を返す。
 * @precondition 「prefix: string、parts: readonly string[]」がstableの入力契約を満たす。
 * @postcondition stableの責務を完了した結果だけを返す。
 * @effect N/A: stableは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: stableは独自の失敗分岐を所有しない。
 * @invariant stableは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: stableはProcess内の同一Subsystemで完結する。
 * @security N/A: stableはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: stableは共有非同期状態を持たない同期処理である。
 */
function stable(prefix: string, ...parts: readonly string[]) {
  return `${prefix}-${createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 40)}`;
}

/**
 * 公開Objectiveを既存のSingle Task入力へ変換する。
 *
 * @responsibility Orchestrator Coordinator Task Requestの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input request: OrchestratorObjectiveRequest、frontProvider: "codex" | "claude"
 * @returns buildOrchestratorCoordinatorTaskRequestの計算結果を返す。
 * @precondition 「request: OrchestratorObjectiveRequest、frontProvider: "codex" | "claude"」がbuildOrchestratorCoordinatorTaskRequestの入力契約を満たす。
 * @postcondition 明示Profile IDをexactに搬送し、省略時は既存の自動選択を維持する。
 * @effect N/A: buildOrchestratorCoordinatorTaskRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: buildOrchestratorCoordinatorTaskRequestは独自の失敗分岐を所有しない。
 * @invariant buildOrchestratorCoordinatorTaskRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: buildOrchestratorCoordinatorTaskRequestはProcess内の同一Subsystemで完結する。
 * @security Profile IDは選択希望だけを表し、Resolver／Grantの適合性検証または実行Authorityを代替しない。
 * @concurrency N/A: buildOrchestratorCoordinatorTaskRequestは共有非同期状態を持たない同期処理である。
 */
export function buildOrchestratorCoordinatorTaskRequest(
  request: OrchestratorObjectiveRequest,
  frontProvider: "codex" | "claude",
) {
  return Object.freeze({
    frontProvider,
    requestedExecutorProvider: request.requestedExecutorProvider ?? "auto",
    ...(request.requestedProfileId !== undefined
      ? { requestedProfileId: request.requestedProfileId }
      : {}),
    objective: request.objective,
    acceptanceCriteria: Object.freeze([...request.acceptanceCriteria]),
    allowedPaths: Object.freeze([...request.allowedPaths]),
    readPaths: Object.freeze([...request.readPaths]),
    workClass: "bounded_implementation" as const,
    planState: "complete" as const,
    risk: "low" as const,
    difficulty: "low" as const,
    decisionImpact: "limited" as const,
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  });
}

/**
 * Production composition shared by the CLI and MCP transports.
 *
 * @responsibility Orchestrator Public Objectiveの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input runtimeDependencies: PublicExecutionDependencies、rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns executeOrchestratorPublicObjectiveの計算結果を返す。
 * @precondition 「runtimeDependencies: PublicExecutionDependencies、rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がexecuteOrchestratorPublicObjectiveの入力契約を満たす。
 * @postcondition executeOrchestratorPublicObjectiveの責務を完了した結果だけを返す。
 * @effect Repository・判断記録を観測し、受付状態の保存と認可済みTask実行を既存Ownerへ委譲する。
 * @failure executeOrchestratorPublicObjectiveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 予約・開始・結果保存・配送の順序と同じ要求Identityを維持する。
 * @boundary 公開Objective入力→認証・保存・実行依存の境界を接続する。
 * @security 認証済み主体・Repository・要求範囲を既存境界で検証し、現在の許可外へ実行を拡張しない。
 * @concurrency 取消Signalと実行・保存・結果搬送の非同期完了を既存Lifecycleへ接続する。
 */
async function executeOrchestratorPublicObjective(
  runtimeDependencies: PublicExecutionDependencies,
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  const request = inspectOrchestratorObjectiveRequest(rawRequest);
  if (!request)
    return Object.freeze({
      contract: ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_objective_request_invalid",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  if (request.adoptResult)
    return createOrchestratorObjectiveResult(request, {
      status: "blocked",
      reason: "orchestrator_explicit_workspace_adoption_required",
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
  const authenticated = runtimeDependencies.openDecisionStore();
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
  const observedPlatform = observePlatformFamily();
  const platform =
    observedPlatform.status === "observed" &&
    observedPlatform.platformFamily === "windows"
      ? createOrchestratorWindowsPlatformAdapter()
      : null;
  const observeLeaseOwner = (
    owner: Readonly<{
      ownerProcessId: number;
      ownerGeneration: string;
    }>,
  ) => {
    const lockLease = platform?.operations.lock_lease as
      | Readonly<{ observeLeaseOwner: (value: typeof owner) => unknown }>
      | undefined;
    return (
      lockLease?.observeLeaseOwner(owner) ??
      Object.freeze({
        status: "unknown",
        ownerProcessId: owner.ownerProcessId,
        ownerGeneration: owner.ownerGeneration,
      })
    );
  };
  const execution = await runOrchestratorObjective(
    {
      authenticatedPrincipalId: authenticated.principalId,
      /**
       * Project Bindingを検証する。
       *
       * @responsibility Project Bindingの検証根拠、成立条件、観測不能時の拒否境界を所有する。
       * @trace ARCH-000004
       * @input input
       * @returns verifyProjectBindingの計算結果を返す。
       * @precondition 「input」がverifyProjectBindingの入力契約を満たす。
       * @postcondition verifyProjectBindingの責務を完了した結果だけを返す。
       * @effect N/A: verifyProjectBindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
       * @failure N/A: verifyProjectBindingは独自の失敗分岐を所有しない。
       * @invariant verifyProjectBindingは入力から導いた結果以外の共有状態を変更しない。
       * @boundary N/A: verifyProjectBindingはProcess内の同一Subsystemで完結する。
       * @security N/A: verifyProjectBindingはAuthority、秘密値または信頼判断を扱わない。
       * @concurrency N/A: verifyProjectBindingは共有非同期状態を持たない同期処理である。
       */
      verifyProjectBinding(input) {
        if (
          identity?.status !== "candidate" ||
          (identity.commit !== input.repositoryRevision &&
            !workspacePlanReadyForAcceptance(
              repositoryRoot,
              deriveOrchestratorRepositoryBindingId(repositoryRoot),
              input.projectId,
              input.milestoneId,
              input.repositoryRevision,
              identity.commit,
            ))
        )
          return Object.freeze({
            status: "blocked",
            reason: "orchestrator_repository_revision_mismatch",
          });
        return Object.freeze({
          status: "verified",
          repositoryBindingId:
            deriveOrchestratorRepositoryBindingId(repositoryRoot),
          repositoryRevision: input.repositoryRevision,
          workingDirectory: repositoryRoot,
          repositoryRoot,
          bindingCapability: Object.freeze({}),
        });
      },
      /**
       * plan Objectiveを決定する。
       *
       * @responsibility plan Objectiveの導出に必要な入力、判定規則、返却結果の境界を所有する。
       * @trace ARCH-000004
       * @input request: OrchestratorObjectiveRequest
       * @returns planObjectiveの計算結果を返す。
       * @precondition 「request: OrchestratorObjectiveRequest」がplanObjectiveの入力契約を満たす。
       * @postcondition planObjectiveの責務を完了した結果だけを返す。
       * @effect N/A: planObjectiveは入力と局所値だけを扱い、外部または共有Effectを発行しない。
       * @failure N/A: planObjectiveは独自の失敗分岐を所有しない。
       * @invariant planObjectiveは入力から導いた結果以外の共有状態を変更しない。
       * @boundary N/A: planObjectiveはProcess内の同一Subsystemで完結する。
       * @security N/A: planObjectiveはAuthority、秘密値または信頼判断を扱わない。
       * @concurrency N/A: planObjectiveは共有非同期状態を持たない同期処理である。
       */
      planObjective(request: OrchestratorObjectiveRequest) {
        const objectiveId = stable(
          "objective",
          request.projectId,
          request.milestoneId,
          request.requestId,
        );
        const taskId = stable("task", objectiveId);
        return Object.freeze({
          milestoneAcceptanceCriteria: Object.freeze([
            ...request.acceptanceCriteria,
          ]),
          objectives: Object.freeze([
            {
              id: objectiveId,
              acceptanceCriteria: Object.freeze([
                ...request.acceptanceCriteria,
              ]),
            },
          ]),
          tasks: Object.freeze([
            {
              id: taskId,
              objectiveId,
              dependencies: Object.freeze([]),
              allowedPaths: Object.freeze([...request.allowedPaths]),
              conflictKeys: Object.freeze([...request.allowedPaths]),
            },
          ]),
        });
      },
      /**
       * Task Executionsを構築する。
       *
       * @responsibility Task Executionsの構築入力、生成結果、不正入力の拒否境界を所有する。
       * @trace ARCH-000004
       * @input request、_bindingCapability、state
       * @returns createTaskExecutionsの計算結果を返す。
       * @precondition 「request、_bindingCapability、state」がcreateTaskExecutionsの入力契約を満たす。
       * @postcondition createTaskExecutionsの責務を完了した結果だけを返す。
       * @effect N/A: createTaskExecutionsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
       * @failure N/A: createTaskExecutionsは独自の失敗分岐を所有しない。
       * @invariant createTaskExecutionsは入力から導いた結果以外の共有状態を変更しない。
       * @boundary N/A: createTaskExecutionsはProcess内の同一Subsystemで完結する。
       * @security N/A: createTaskExecutionsはAuthority、秘密値または信頼判断を扱わない。
       * @concurrency N/A: createTaskExecutionsは共有非同期状態を持たない同期処理である。
       */
      createTaskExecutions(request, _bindingCapability, state) {
        return state.tasks
          .filter((task) => task.state !== "superseded")
          .map((task) => {
            const objective = state.objectives.find(
              (candidate) =>
                candidate.definition.id === task.definition.objectiveId,
            );
            return Object.freeze({
              taskId: task.definition.id,
              repositoryRoot,
              taskRequest: buildOrchestratorCoordinatorTaskRequest(
                Object.freeze({
                  ...request,
                  acceptanceCriteria: Object.freeze([
                    ...(objective?.definition.acceptanceCriteria ?? []),
                  ]),
                  allowedPaths: Object.freeze([
                    ...task.definition.allowedPaths,
                  ]),
                }),
                runtimeDependencies.frontProviderForTask(
                  request.requestedExecutorProvider ?? "auto",
                ),
              ),
            });
          });
      },
      observeLeaseOwner,
      recoverTaskRecovery: (recoveryId, signal) => {
        const root = verifyRepositoryRoot(repositoryRoot);
        return recoverRuntimeOwnedDockerTaskForCurrentConsumer(
          recoveryId,
          root.status === "completed" ? root.capability : null,
          signal,
        );
      },
      acknowledgeTaskRecovery: (settlement) =>
        consumeDockerRecoveryReceiptAfterProjectSettlement(settlement, {
          workingDirectory,
          repositoryRoot,
          repositoryBindingId:
            deriveOrchestratorRepositoryBindingId(repositoryRoot),
        }),
      finalizeTaskRecoveryAcknowledgement: (settlement) =>
        collectDockerRecoveryAcknowledgementAfterProjectRecord(settlement, {
          workingDirectory,
          repositoryRoot,
          repositoryBindingId:
            deriveOrchestratorRepositoryBindingId(repositoryRoot),
        }),
      resolveTaskRecoveryCorrelations:
        runtimeDependencies.resolveTaskRecoveryCorrelations ??
        ((ids) => {
          const root = verifyRepositoryRoot(repositoryRoot);
          return resolveRuntimeOwnedDockerTaskCurrentCorrelations(
            ids,
            root.status === "completed" ? root.capability : null,
          );
        }),
      observeRecoveryTransition: writeOrchestratorRecoveryDiagnostic,
      execution: {
        resultDelivery: {
          repositoryBindingId:
            deriveOrchestratorRepositoryBindingId(repositoryRoot),
          createAcceptanceReader: (acceptance) =>
            createProjectResultAcceptanceReader({
              workingDirectory: repositoryRoot,
              repositoryBindingId: acceptance.repositoryBindingId,
              projectId: acceptance.projectId,
              milestoneId: acceptance.milestoneId,
              taskId: acceptance.taskId,
              attemptId: acceptance.attemptId,
              operationId: acceptance.operationId,
              recoveryId: acceptance.recoveryId,
            }),
        },
        runSingleTaskAttempt: (input) =>
          runOrchestratorSingleTaskAttempt(
            {
              startTask: (
                taskRequest,
                root,
                correlation,
                observer,
                workspaceTarget,
              ) =>
                runtimeDependencies.startTask(
                  taskRequest,
                  root,
                  correlation,
                  observer,
                  "orchestrator",
                  workspaceTarget,
                ),
              cancelTask: runtimeDependencies.cancelTask,
              captureResultDelivery: runtimeDependencies.captureResultDelivery,
            },
            input,
          ),
        executionObservation: {
          recordTaskAttempt: (observation) =>
            runtimeDependencies.recordExecutionEvent(
              repositoryRoot,
              observation,
            ),
          observePublication:
            runtimeDependencies.observeExecutionEventPublication,
        },
      },
    },
    request,
    cancellationSignal,
  );
  if (
    execution.projection?.milestoneState === "accepted" &&
    execution.reason === "orchestrator_tasks_already_integration_pending"
  )
    return createOrchestratorObjectiveResult(request, {
      ...execution,
      status: "completed",
      reason: "orchestrator_objective_already_accepted",
    });
  if (
    execution.queueId &&
    execution.projection?.milestoneState !== "accepted" &&
    [
      "orchestrator_tasks_completed_integration_pending",
      "orchestrator_tasks_already_integration_pending",
    ].includes(execution.reason)
  ) {
    const snapshot = readOrchestratorSnapshot(
      repositoryRoot,
      deriveOrchestratorRepositoryBindingId(repositoryRoot),
    );
    const queue =
      snapshot.status === "completed"
        ? snapshot.value?.queueEntries.find(
            (q) =>
              q.queueId === execution.queueId &&
              q.projectId === request.projectId &&
              q.milestoneId === request.milestoneId,
          )
        : null;
    if (
      !queue ||
      (queue.workspaceId !== request.workspaceId &&
        !(queue.workspaceId == null && request.workspaceId === undefined))
    )
      return createOrchestratorObjectiveResult(request, {
        ...execution,
        status: "blocked",
        reason: "orchestrator_workspace_target_unconfirmed",
        cleanupConfirmed: false,
      });
    const ready = workspacePlanReadyForAcceptance(
      repositoryRoot,
      deriveOrchestratorRepositoryBindingId(repositoryRoot),
      request.projectId,
      request.milestoneId,
      request.repositoryRevision,
      identity?.commit ?? "",
    );
    return createOrchestratorObjectiveResult(request, {
      ...execution,
      status: "blocked",
      reason:
        queue.workspaceId != null && !ready
          ? "orchestrator_workspace_adoption_required"
          : "orchestrator_quality_acceptance_required",
    });
  }
  return execution;
}

/**
 * Orchestrator Public Objectiveを実行する。
 *
 * @responsibility Orchestrator Public Objectiveの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns runOrchestratorPublicObjectiveの計算結果を返す。
 * @precondition 「rawRequest: unknown、cancellationSignal: AbortSignal、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がrunOrchestratorPublicObjectiveの入力契約を満たす。
 * @postcondition runOrchestratorPublicObjectiveの責務を完了した結果だけを返す。
 * @effect Repository・判断記録を観測し、受付状態の保存と認可済みTask実行を既存Ownerへ委譲する。
 * @failure runOrchestratorPublicObjectiveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 予約・開始・結果保存・配送の順序と同じ要求Identityを維持する。
 * @boundary 公開Objective入力→認証・保存・実行依存の境界を接続する。
 * @security 認証済み主体・Repository・要求範囲を既存境界で検証し、現在の許可外へ実行を拡張しない。
 * @concurrency 取消Signalと実行・保存・結果搬送の非同期完了を既存Lifecycleへ接続する。
 */
export function runOrchestratorPublicObjective(
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    return Promise.resolve(
      executeOrchestratorPublicObjective(
        productionExecutionDependencies,
        rawRequest,
        cancellationSignal,
        workingDirectory,
        authenticationContext,
      ),
    ).catch((error: unknown) => {
      if (error instanceof RepositoryRuntimeDataAreaBlockedError)
        return orchestratorDataBoundaryBlocked(error);
      throw error;
    });
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      return Promise.resolve(orchestratorDataBoundaryBlocked(error));
    throw error;
  }
}

/**
 * Development-only composition. The supplied starter still needs its own admitted capability.
 *
 * @responsibility Development Orchestrator Public Objective 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: OrchestratorPublicDevelopmentDependencies
 * @returns createDevelopmentOrchestratorPublicObjectiveCandidateの計算結果を返す。
 * @precondition 「dependencies: OrchestratorPublicDevelopmentDependencies」がcreateDevelopmentOrchestratorPublicObjectiveCandidateの入力契約を満たす。
 * @postcondition createDevelopmentOrchestratorPublicObjectiveCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createDevelopmentOrchestratorPublicObjectiveCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDevelopmentOrchestratorPublicObjectiveCandidateは独自の失敗分岐を所有しない。
 * @invariant createDevelopmentOrchestratorPublicObjectiveCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDevelopmentOrchestratorPublicObjectiveCandidateはProcess内の同一Subsystemで完結する。
 * @security N/A: createDevelopmentOrchestratorPublicObjectiveCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createDevelopmentOrchestratorPublicObjectiveCandidateは共有非同期状態を持たない同期処理である。
 */
export function createDevelopmentOrchestratorPublicObjectiveCandidate(
  dependencies: OrchestratorPublicDevelopmentDependencies,
) {
  const fixed = Object.freeze({
    ...dependencies,
    recordExecutionEvent:
      dependencies.recordExecutionEvent ?? recordOrchestratorExecutionEvent,
    observeExecutionEventPublication:
      dependencies.observeExecutionEventPublication ??
      writeOrchestratorExecutionIntelligenceDiagnostic,
  });
  return Object.freeze({
    productionAuthority: false,
    run: (
      rawRequest: unknown,
      cancellationSignal: AbortSignal,
      workingDirectory: string,
      authenticationContext?: Readonly<{ principalId: string }>,
    ) =>
      executeOrchestratorPublicObjective(
        fixed,
        rawRequest,
        cancellationSignal,
        workingDirectory,
        authenticationContext,
      ),
    runDecision: (
      rawRequest: unknown,
      workingDirectory: string,
      authenticationContext?: Readonly<{ principalId: string }>,
    ) =>
      executeOrchestratorPublicDecision(
        fixed.openDecisionStore,
        rawRequest,
        workingDirectory,
        authenticationContext,
      ),
    runStateQuery: (
      rawRequest: unknown,
      workingDirectory: string,
      authenticationContext?: Readonly<{ principalId: string }>,
    ) =>
      executeOrchestratorPublicStateQuery(
        fixed.openDecisionStore,
        rawRequest,
        workingDirectory,
        authenticationContext,
      ),
  });
}
