/**
 * 単発Task Ownerを既存の助言RuntimeとWorkspace実行へ接続する。
 * @responsibility 専門Packageの実装を一度だけ組み立て、旧Bundle生成へ配送しない。
 * @trace ARCH-000004
 * @trace ARCH-000015
 */
import {
  resolveAiProfileById,
  type AiProfileCatalogStore,
} from "../../../ai-adapter/src/index.ts";
import {
  resolveVerifiedRepositoryRoot,
  gitRepositoryRevisionAdapter,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  startRuntimeOwnedCoordinatorTask,
  cancelRuntimeOwnedCoordinatorTask,
} from "../execution/task.ts";
import { runRepositoryAdvice } from "../execution/advice.ts";
import { recoverProviderAdviceHostOperation } from "../execution/provider-execution.ts";
import {
  createOrchestratorTaskRequests,
  type SingleTaskOutcome,
} from "./requests.ts";
import { deriveOrchestratorRepositoryBindingId } from "../state/binding.ts";
import { runOrchestratorSingleTaskAttempt } from "./execute-attempt.ts";
import { initializeOrchestratorSnapshot } from "../storage/current-state.ts";
import { observeLeaseOwner } from "../platform/windows-adapter.ts";
import {
  recoverRuntimeOwnedDockerTaskForCurrentConsumer,
  resolveRuntimeOwnedDockerTaskCurrentCorrelations,
} from "../execution/recovery.ts";
import { observeRuntimeOwnedTransientTaskCompletion } from "../storage/settlement-store.ts";

/**
 * Repositoryと認可済み主体に固定した単発受付を構成する。
 * @responsibility Profile改訂再確認、用途別実行、cleanupの結果搬送。
 * @trace ARCH-000004
 * @input 検証済みRoot、Profile Store、実Project／主体、現在認可。
 * @returns 既存Writerへ接続する開始・観測・取消Owner。
 * @precondition 検証済みRepository内で既存Snapshotを準備できる。
 * @postcondition 編集は借用Workspace、助言は固定Contextだけを使用する。
 * @effect 構築時に既存Snapshotを初期化・確認する。明示開始時だけ外部Providerを利用する。
 * @failure Profile改訂・Root・認可が変われば外部Effect前に停止。
 * @invariant 自動Commit・Candidate固定・Merge・Promotionを行わない。
 * @boundary 公開Task OwnerとCoordinator技術Runtime。
 * @security Prompt・Context・助言本文は永続化しない。
 * @concurrency 各要求が独立した実行閉包と取消Signalを持つ。
 */
export function createRepositoryTaskRequests(
  rootCapability: VerifiedRepositoryRoot,
  profiles: AiProfileCatalogStore,
  projectId: string,
  principalId: string,
  authorize: () => boolean,
  consumer: "workbench" | "coordinator_cli" = "workbench",
) {
  const root = resolveVerifiedRepositoryRoot(rootCapability);
  if (root === null) throw new Error("orchestrator_task_root_invalid");
  const initialized = initializeOrchestratorSnapshot(
    root,
    deriveOrchestratorRepositoryBindingId(root),
  );
  if (initialized.status !== "completed")
    throw new Error("orchestrator_task_state_initialization_blocked");
  return createOrchestratorTaskRequests({
    root,
    binding: deriveOrchestratorRepositoryBindingId(root),
    projectId,
    principalId,
    authorize,
    observeLeaseOwner,
    recover: async (record) => {
      const observed = resolveRuntimeOwnedDockerTaskCurrentCorrelations(
        [record.operationId],
        rootCapability,
        consumer,
      );
      if (observed.status !== "completed")
        return {
          cleanupConfirmed: false,
          recoveryIds: record.recoveryIds,
          reason: observed.reason,
        };
      const unresolved = new Set(record.recoveryIds);
      for (const entry of observed.bindings) {
        const result = await recoverRuntimeOwnedDockerTaskForCurrentConsumer(
          entry.recoveryId,
          rootCapability,
        );
        if (result.status !== "recovered" || !result.taskRecoveryCompleted) {
          unresolved.add(entry.recoveryId);
          return {
            cleanupConfirmed: false,
            recoveryIds: [...unresolved],
            reason: result.reason,
          };
        }
        unresolved.delete(entry.recoveryId);
      }
      for (const recoveryId of unresolved) {
        if (
          recoveryId.startsWith("docker-task.") &&
          observeRuntimeOwnedTransientTaskCompletion(
            rootCapability,
            recoveryId,
            record.operationId,
            consumer,
          ).completionConfirmed
        )
          unresolved.delete(recoveryId);
      }
      const hostId =
        record.adviceOperation?.hostRecoveryId ??
        record.recoveryIds.find((id) => id.startsWith("host."));
      if (hostId) {
        const host = recoverProviderAdviceHostOperation(hostId);
        if (!host.cleanupConfirmed) {
          unresolved.add(hostId);
          return {
            cleanupConfirmed: false,
            recoveryIds: [...unresolved],
            reason: host.reason,
          };
        }
        unresolved.delete(hostId);
      } else if (observed.bindings.length === 0 && record.phase !== "settled") {
        return {
          cleanupConfirmed: false,
          recoveryIds: [...unresolved],
          reason: "orchestrator_task_operation_creation_unconfirmed",
        };
      }
      return {
        cleanupConfirmed: unresolved.size === 0,
        recoveryIds: [...unresolved],
        reason: "orchestrator_task_recovery_observed",
      };
    },
    observeRevision: () =>
      gitRepositoryRevisionAdapter(root)?.revisionIdentity ?? null,
    resolveProfile: (id, mode) => {
      const snapshot = profiles.snapshot().value;
      if (!snapshot) return null;
      const profile = resolveAiProfileById(snapshot.catalog, id).value;
      return profile?.selectionRoles.includes(
        mode === "read_only_advice" ? "coordinator" : "executor",
      )
        ? { catalogRevision: snapshot.revision }
        : null;
    },
    execute: async (
      command,
      execution,
      signal,
      started,
      operationCreated,
    ): Promise<SingleTaskOutcome> => {
      const snapshot = profiles.snapshot().value;
      const profile = snapshot
        ? resolveAiProfileById(snapshot.catalog, command.profileId).value
        : null;
      const empty = (reason: string): SingleTaskOutcome => ({
        mode: command.mode,
        status: "blocked",
        reason,
        cleanupConfirmed: true,
        recoveryIds: [],
        advice: null,
        workspaceResult: null,
      });
      if (
        !authorize() ||
        !snapshot ||
        snapshot.revision !== execution.record.catalogRevision ||
        !profile ||
        resolveVerifiedRepositoryRoot(rootCapability) !== root
      )
        return empty("orchestrator_task_profile_or_access_changed");
      if (signal.aborted)
        return {
          ...empty("orchestrator_task_cancelled_before_execution"),
          status: "cancelled",
        };
      if (command.mode === "read_only_advice") {
        const executed = await runRepositoryAdvice(
          rootCapability,
          {
            ...profiles,
            snapshot: () =>
              Object.freeze({
                status: "read" as const,
                value: snapshot,
                error: null,
              }),
          },
          { ...command, mode: "read_only_advice" },
          signal,
          {
            recoveryCorrelationId: execution.record.operationId,
            observeOperation: operationCreated,
            observeStarted: started,
          },
        );
        const { result, cleanupConfirmed } = executed;
        return {
          mode: command.mode,
          status: !cleanupConfirmed
            ? "unknown"
            : result.status === "completed"
              ? "completed"
              : signal.aborted
                ? "cancelled"
                : result.status,
          reason: result.reason,
          cleanupConfirmed,
          recoveryIds: executed.hostRecoveryId ? [executed.hostRecoveryId] : [],
          advice:
            result.status === "completed"
              ? {
                  facts: result.facts,
                  sharedAnalysis: result.sharedAnalysis,
                  additionalInferences: result.additionalInferences,
                  nextOptions: result.nextOptions,
                }
              : null,
          workspaceResult: null,
        };
      }
      const result = await runOrchestratorSingleTaskAttempt(
        {
          startTask: (request, capability, correlation, observer, target) =>
            startRuntimeOwnedCoordinatorTask(
              request,
              capability,
              correlation,
              observer,
              consumer,
              target,
            ),
          cancelTask: cancelRuntimeOwnedCoordinatorTask,
        },
        {
          attemptId: execution.record.attemptId,
          operationId: execution.record.operationId,
          authorityBindingId: execution.record.taskId,
          repositoryRevision: execution.repositoryRevision,
          repositoryRoot: root,
          cancellationSignal: signal,
          observeStarted: started,
          workspaceId: execution.target.workspaceId,
          ownerRepositoryRoot: root,
          executionTree: execution.target.executionTree,
          workspaceBaseCommit: execution.target.baseCommit,
          workspaceHead: execution.target.head,
          taskRequest: {
            frontProvider: profile.provider,
            requestedExecutorProvider: profile.provider,
            requestedProfileId: profile.profileId,
            expectedNetworkPolicyHash: command.expectedNetworkPolicyHash,
            objective: command.prompt,
            acceptanceCriteria: [
              "Edit the selected working tree only. Do not commit, merge, push, stash, reset, clean, or promote changes.",
              "Preserve existing staged and unselected changes. Report unexpected changed paths.",
            ],
            allowedPaths: command.allowedPaths,
            readPaths: ["PROJECT_CONTEXT.md", ...command.allowedPaths],
            workClass: "bounded_implementation",
            planState: "complete",
            risk: "low",
            difficulty: "low",
            decisionImpact: "limited",
            isLocalCandidateOnly: true,
            hasUnresolvedDirection: false,
            requiresCrossContextAlignment: false,
          },
        },
      );
      if (result.candidateId !== null)
        return {
          ...empty("orchestrator_legacy_candidate_result_rejected"),
          status: "unknown",
          cleanupConfirmed: false,
          recoveryIds: result.recoveryIds,
        };
      return {
        mode: command.mode,
        status: result.effectState === "unknown" ? "unknown" : result.status,
        reason: result.reason,
        cleanupConfirmed: result.cleanupConfirmed,
        recoveryIds: result.recoveryIds,
        advice: null,
        workspaceResult: result.workspaceResult ?? null,
      };
    },
  });
}
