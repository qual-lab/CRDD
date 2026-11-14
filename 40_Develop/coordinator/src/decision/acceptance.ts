/**
 * 明示受入判断の認証・対象検査と保存・状態反映を所有する。
 *
 * @responsibility 公開要求のPrincipal・Root・Revisionと判断の相関を確認し、既存の受入記録・状態反映へ接続する。
 * @trace ARCH-000004
 */

import { RepositoryDataBlockedError } from "../configuration/runtime-data.ts";
import {
  type DecisionRequest,
  ExecutionStorageBlockedError,
  isPrincipalId,
  readDecision,
  recordDecision,
} from "../../../execution-model/src/index.ts";
import {
  getRepository,
  readRepositorySnapshot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "../../../version-control/src/index.ts";
import { snapshotJsonValue } from "../input/snapshot.ts";
import {
  historyRepositoryInput,
  verifyRuntimePersistenceRepository,
} from "../execution/persistence.ts";
import { COORDINATOR_PUBLIC_RUNTIME_CONTRACT } from "../state/projection.ts";
import { coordinatorDataBoundaryBlocked } from "../state/result.ts";
import { deriveCoordinatorRepositoryBindingId } from "../state/validation.ts";
import { workspacePlanReadyForAcceptance } from "../workspace/operations.ts";
import {
  COORDINATOR_ACCEPTANCE_DECISION_CONTRACT,
  validRequest,
} from "./request.ts";

/**
 * 受入判断要求を理由付き停止結果へ変換する。
 *
 * @responsibility 停止理由、Record Identityおよび回復要否の公開境界を所有する。
 * @trace ARCH-000005
 * @input reason: string、recordId: string | null、manualRecoveryRequired: boolean
 * @returns CoordinatorAcceptanceDecisionResultを返す。
 * @precondition 呼出し元が失敗境界と回復要否を確定済みである。
 * @postcondition 秘密値を含まない一つの停止結果を返す。
 * @effect N/A: 入力から結果値を構築するだけで外部Effectを発行しない。
 * @failure N/A: 独自の失敗分岐を持たない。
 * @invariant Authority秘密値を結果へ含めない。
 * @boundary Application内部と公開結果の境界。
 * @security 秘密値とStore内容を公開しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function blocked(
  reason: string,
  recordId: string | null = null,
  manualRecoveryRequired = false,
) {
  return Object.freeze({
    contract: COORDINATOR_ACCEPTANCE_DECISION_CONTRACT,
    status: "blocked",
    reason,
    recordId,
    newGeneration: null,
    cleanupConfirmed: !manualRecoveryRequired,
    manualRecoveryRequired,
  });
}

/**
 * Public Acceptance Decisionを検証済みRepository、認証Principal、耐久Storeおよび状態Storeへ接続する。
 *
 * @responsibility SPEC-000002の明示判断だけを公開入口からAcceptance Decision Applicationへ搬送する。
 * @trace ARCH-000005
 * @input rawRequest: 未信頼要求、workingDirectory: Repository内Path、authenticationContext: 認証済みPrincipal。
 * @returns Acceptance Decision Applicationの公開結果を返す。
 * @precondition 認証ContextはRuntime-owned認証境界で構築される。
 * @postcondition 成功時は一つのDecision Recordと必要な状態更新だけを確定する。
 * @effect Repository-local Stateの判断・適用状態とHistoryを更新する。
 * @failure Root、Revision、Principal、AuthorityまたはStoreを確認できない場合はEffectを拡張せず停止する。
 * @invariant Task作成、Provider EffectおよびProjection由来Authorityを発行しない。
 * @boundary 公開Transport→Coordinatorの受入判断→Repository-local Storeの境界。
 * @security 認証Principalをexact比較し、非公開Store Pathや秘密値を結果へ含めない。
 * @concurrency State世代とDecision Recordの排他的世代作成で競合を拒否する。
 */
export function executeCoordinatorPublicAcceptanceDecision(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
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
    // 未信頼要求の副作用付きgetterをRoot照会・保存より前に拒否する。
    try {
      rawRequest = snapshotJsonValue(rawRequest);
    } catch {
      return blocked("orchestrator_acceptance_decision_request_invalid");
    }
    if (!validRequest(rawRequest))
      return blocked("orchestrator_acceptance_decision_request_invalid");
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
    const candidate = rawRequest;
    if (candidate.principalId !== authenticationContext.principalId)
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
    const repository = verifyRuntimePersistenceRepository(repositoryRoot);
    const observed = readDecision(
      repository,
      repositoryBindingId,
      candidate.decisionId,
    );
    if (observed.status !== "completed")
      return blocked(observed.reason, null, observed.manualRecoveryRequired);
    const existing = observed.value;
    // 適用済みの再送は新たな受入を行わない。Writerで元要求・回答の全文一致を確認する。
    const alreadyApplied = existing?.status === "applied";
    if (
      !identity ||
      (!alreadyApplied &&
        !(
          (candidate.decision !== "accept" &&
            identity.revisionIdentity === candidate.repositoryRevision) ||
          workspacePlanReadyForAcceptance(
            repositoryRoot,
            deriveCoordinatorRepositoryBindingId(repositoryRoot),
            candidate.projectId,
            candidate.milestoneId,
            candidate.repositoryRevision,
            identity.revisionIdentity,
          )
        ))
    )
      return Object.freeze({
        contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "orchestrator_acceptance_revision_mismatch",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    const now = new Date().toISOString();
    // 既存commandの意味を記録する質問。画面で事前提示済みという主張ではない。
    const request: DecisionRequest = {
      decisionId: rawRequest.decisionId,
      blockerId: rawRequest.blockerId,
      kind: "acceptance",
      respondentPrincipalId: authenticationContext.principalId,
      target: {
        projectId: rawRequest.projectId,
        milestoneId: rawRequest.milestoneId,
        kind: rawRequest.target,
        id: rawRequest.targetId,
        generation: rawRequest.expectedGeneration,
        repositoryRevision: rawRequest.repositoryRevision,
      },
      question: `SPEC-000002: ${rawRequest.target}「${rawRequest.targetId}」の成果を受け入れますか？`,
      options: [
        { value: "accept", label: "受け入れる" },
        { value: "return", label: "差し戻す" },
        { value: "wait", label: "判断を保留する" },
      ],
      requestedAt: existing?.requestedAt ?? now,
    };
    const saved = recordDecision(
      historyRepositoryInput(repository),
      repositoryBindingId,
      request,
      {
        principalId: authenticationContext.principalId,
        answeredAt: existing?.result?.answer.answeredAt ?? now,
        selectedOption: rawRequest.decision,
        reason: null,
        evidenceIds: rawRequest.criterionEvidenceIds,
      },
      alreadyApplied ? existing : null,
    );
    if (saved.status !== "completed")
      return blocked(
        saved.reason === "decision_identity_retired" ||
          saved.reason === "decision_identity_conflict" ||
          saved.reason === "decision_answer_conflict"
          ? "orchestrator_acceptance_decision_duplicate"
          : saved.reason,
        `acceptance-${rawRequest.decisionId}`,
        saved.manualRecoveryRequired,
      );
    const { decision, history } = saved.value;
    const applied = decision.result?.status === "applied";
    return Object.freeze({
      contract: COORDINATOR_ACCEPTANCE_DECISION_CONTRACT,
      status: applied ? ("completed" as const) : ("blocked" as const),
      reason:
        history.status !== "confirmed"
          ? "orchestrator_acceptance_state_saved_history_unconfirmed"
          : applied
            ? "orchestrator_acceptance_decision_recorded"
            : decision.result?.status === "unapplied"
              ? decision.result.reason
              : "orchestrator_acceptance_decision_not_applied",
      recordId: `acceptance-${decision.decisionId}`,
      newGeneration:
        decision.result?.status === "applied"
          ? decision.result.application.afterGeneration
          : null,
      decision,
      history,
      cleanupConfirmed: history.status === "confirmed",
      manualRecoveryRequired: history.status !== "confirmed",
    });
  } catch (error) {
    if (
      error instanceof ExecutionStorageBlockedError ||
      error instanceof RepositoryDataBlockedError
    )
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
 * 上位で確定した操作主体をPublic Acceptance Decisionへ渡す。
 *
 * @responsibility 上位の操作主体と要求内の主体の一致を確認する入口を提供する。
 * @trace ARCH-000005
 * @input rawRequest: 未信頼要求、workingDirectory: Repository内Path、authenticationContext: 認証済みPrincipal。
 * @returns executeCoordinatorPublicAcceptanceDecisionの結果を返す。
 * @precondition 呼出し側が操作主体の認証・認可を完了している。
 * @postcondition StoreやOSから操作主体を取得・補完しない。
 * @effect 同じStateの判断・適用結果・対象状態とHistoryを更新する。
 * @failure 操作主体未指定・要求との不一致またはRuntime Data観測不能を理由付き停止へ変換する。
 * @invariant 保存先の利用可否を本人認証として扱わない。
 * @boundary Local TransportとProduction Composition Rootの境界。
 * @security 外部要求のprincipalIdだけを信頼せず、上位の操作主体と照合する。
 * @concurrency 下位Storeの世代制御を維持する。
 */
export function acceptResult(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  return executeCoordinatorPublicAcceptanceDecision(
    rawRequest,
    workingDirectory,
    authenticationContext,
  );
}
