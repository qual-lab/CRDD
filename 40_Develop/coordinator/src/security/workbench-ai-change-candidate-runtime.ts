/**
 * Workbenchの変更候補依頼を署名済みProject Runtimeへ接続する。
 *
 * @packageDocumentation
 * @responsibility 明示された書込みPathとexact Profileだけで一つの未信頼候補を生成し、自動採用せず結果へ返す。
 * @trace ARCH-000015 ARCH-000004
 * @boundary Workbench AI依頼とProject Runtime Single Task境界。
 * @effect 署名済みCoordinator Runtimeを通じて隔離Workspaceと外部Providerを実行し、候補をCandidate Storeへ保持し得る。
 * @security Repository全体を暗黙の書込み範囲にせず、候補Identityから採用Authorityを生成しない。
 */
import { randomUUID } from "node:crypto";

import {
  resolveAiProfileById,
  type AiProfileCatalogStore,
  type AiProfileCatalogSnapshot,
} from "../../../ai-runtime/src/index.ts";
import { gitRepositoryRevisionAdapter } from "../../../version-control/src/git/fixed-revision-adapter.ts";
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/repository-location.ts";
import type {
  CoordinatorAiRequestExecutor,
  CoordinatorAiRequestResult,
} from "../composition/workbench-ai-request-application.ts";
import {
  cancelRuntimeOwnedCoordinatorTask,
  startRuntimeOwnedCoordinatorTask,
} from "./coordinator-task-runtime.ts";
import {
  issueRuntimeOwnedVerifiedCoordinatorPackageCapability,
  revokeRuntimeOwnedVerifiedCoordinatorPackageCapability,
} from "./platform-provisioner-package-filesystem.ts";
import {
  type ProjectRuntimeSingleTaskDependencies,
  runProjectRuntimeSingleTaskAttempt,
} from "./project-runtime-single-task-adapter.ts";

/**
 * Repository単体Workbench用の変更候補Executorを生成する。
 *
 * @responsibility Root、Revision、Profile、Path Authorityおよび署名済みRuntime Capabilityを一依頼へ結合する。
 * @trace ARCH-000015 ARCH-000004
 * @input repositoryRootCapability: 検証済みRoot、profileCatalogStore: 採用済みProfile Catalog。
 * @returns Coordinator AI依頼Applicationへ接続可能な変更候補Executor。
 * @precondition Root CapabilityとCatalog Storeは現在Repositoryに対応する。
 * @postcondition 成功時も未信頼・未採用のCandidate IDだけを返し、所有正本を変更しない。
 * @effect Project Runtime Single Taskを最大一回開始する。
 * @failure 入力、Revision、Profile、署名またはcleanupを確認できなければ成功を返さない。
 * @invariant 指定Path、Profile ID、ProviderおよびRepository Revisionを暗黙に変更しない。
 * @boundary Workbench Production CompositionとProject Runtimeの境界。
 * @security 外部送信確認がなく、または許可Pathが空ならEffect 0で停止する。
 * @concurrency 一依頼一Task Attemptとし、取消を同じControl Capabilityへ転送する。
 */
export function createRuntimeOwnedWorkbenchAiChangeCandidateExecutor(
  repositoryRootCapability: VerifiedRepositoryRoot,
  profileCatalogStore: AiProfileCatalogStore,
): CoordinatorAiRequestExecutor {
  return createIsolatedWorkbenchAiChangeCandidateExecutorForDevelopment(
    repositoryRootCapability,
    profileCatalogStore,
    Object.freeze({
      observeRevision: gitRepositoryRevisionAdapter,
      issueRuntimeCapability: () =>
        issueRuntimeOwnedVerifiedCoordinatorPackageCapability({
          evaluationTime: new Date().toISOString(),
        }).capability,
      revokeRuntimeCapability:
        revokeRuntimeOwnedVerifiedCoordinatorPackageCapability,
      startTask: startRuntimeOwnedCoordinatorTask,
      cancelTask: cancelRuntimeOwnedCoordinatorTask,
    }),
  );
}

/**
 * 注入境界を用いてWorkbench変更候補Executorを構成する。
 *
 * @responsibility Productionと局所契約試験が同じ候補生成判断を利用できるようEffect Adapterを分離する。
 * @trace ARCH-000015 ARCH-000004
 * @input repositoryRootCapability、profileCatalogStore、Revision・Capability・Task Runtime依存。
 * @returns 注入依存だけを利用する変更候補Executor。
 * @precondition 依存は同じRuntime世代とRepositoryを表す。
 * @postcondition Production関数と同じ入力検査、未採用結果および失敗分類を返す。
 * @effect 注入されたTask Runtimeだけが外部Effectを発行し得る。
 * @failure 不正な注入結果を成功へ畳まない。
 * @invariant 候補を採用、CommitまたはPublishしない。
 * @boundary Coordinator判断と注入Effect Adapterの境界。
 * @security Test専用依存をProduction既定値へ混入させない。
 * @concurrency 一依頼一Task Attemptとし、Cancellation Signalをそのまま渡す。
 */
export function createIsolatedWorkbenchAiChangeCandidateExecutorForDevelopment(
  repositoryRootCapability: VerifiedRepositoryRoot,
  profileCatalogStore: AiProfileCatalogStore,
  dependencies: Readonly<{
    observeRevision: typeof gitRepositoryRevisionAdapter;
    issueRuntimeCapability: () => object | null;
    revokeRuntimeCapability: (capability: object) => boolean;
    startTask: ProjectRuntimeSingleTaskDependencies["startTask"];
    cancelTask: ProjectRuntimeSingleTaskDependencies["cancelTask"];
  }>,
): CoordinatorAiRequestExecutor {
  return async (request, cancellationSignal) => {
    if (
      request.mode !== "change_candidate" ||
      request.allowedPaths.length === 0 ||
      request.externalSendConfirmed !== true
    )
      return empty("blocked", "workbench_ai_change_candidate_input_invalid");
    const repositoryRoot = resolveVerifiedRepositoryRoot(
      repositoryRootCapability,
    );
    if (repositoryRoot === null)
      return empty("blocked", "workbench_ai_repository_root_unavailable");
    const revision = dependencies.observeRevision(repositoryRoot);
    if (revision === null || revision.observationComplete !== true)
      return empty("unknown", "workbench_ai_repository_revision_unknown");
    let profileSnapshot: AiProfileCatalogSnapshot;
    try {
      profileSnapshot = profileCatalogStore.snapshot();
    } catch {
      return empty("unknown", "workbench_ai_profile_snapshot_unavailable");
    }
    const profile = resolveAiProfileById(
      profileSnapshot.catalog,
      request.profileId,
    );
    if (profile === null || !profile.selectionRoles.includes("executor"))
      return empty(
        "blocked",
        "workbench_ai_profile_not_available_for_change_candidate",
      );
    if (cancellationSignal.aborted)
      return empty("blocked", "coordinator_ai_request_cancelled");
    const runtimeCapability = dependencies.issueRuntimeCapability();
    if (runtimeCapability === null)
      return empty("blocked", "coordinator_task_release_verification_required");
    const identity = randomUUID();
    let result: Awaited<ReturnType<typeof runProjectRuntimeSingleTaskAttempt>>;
    try {
      result = await runProjectRuntimeSingleTaskAttempt(
        {
          startTask: dependencies.startTask,
          cancelTask: dependencies.cancelTask,
        },
        {
          attemptId: `workbench-attempt-${identity}`,
          operationId: `workbench-operation-${identity}`,
          authorityBindingId: `workbench-authority-${identity}`,
          repositoryRevision: revision.revisionIdentity,
          runtimeExecutionCapability: runtimeCapability,
          repositoryRoot,
          cancellationSignal,
          taskRequest: Object.freeze({
            frontProvider: profile.provider,
            requestedExecutorProvider: profile.provider,
            requestedProfileId: profile.profileId,
            objective: request.prompt,
            acceptanceCriteria: Object.freeze([
              "Create an untrusted local change candidate only.",
              "Do not adopt, commit, publish, push, or modify the source repository.",
              "Modify only the explicitly allowed paths.",
            ]),
            allowedPaths: Object.freeze([...request.allowedPaths]),
            readPaths: Object.freeze([
              "PROJECT_CONTEXT.md",
              ...request.allowedPaths,
            ]),
            workClass: "bounded_implementation",
            planState: "complete",
            risk: "low",
            difficulty: "low",
            decisionImpact: "limited",
            isLocalCandidateOnly: true,
            hasUnresolvedDirection: false,
            requiresCrossContextAlignment: false,
          }),
        },
      );
    } finally {
      dependencies.revokeRuntimeCapability(runtimeCapability);
    }
    if (
      result.status === "completed" &&
      result.cleanupConfirmed === true &&
      result.manualRecoveryRequired === false &&
      result.effectState === "settled" &&
      result.candidateId !== null
    )
      return Object.freeze({
        ...empty("completed", null),
        candidate: Object.freeze({
          candidateId: result.candidateId,
          disposition: "untrusted_not_adopted" as const,
        }),
      });
    return empty(
      result.effectState === "unknown" || result.manualRecoveryRequired
        ? "unknown"
        : "blocked",
      result.reason,
    );
  };
}

function empty(
  status: "completed" | "blocked" | "unknown",
  reason: string | null,
): CoordinatorAiRequestResult {
  return Object.freeze({
    status,
    reason,
    facts: Object.freeze([]),
    sharedAnalysis: Object.freeze([]),
    additionalInferences: Object.freeze([]),
    nextOptions: Object.freeze([]),
    candidate: null,
  });
}
