/**
 * 判断要求・回答・明示適用・閉鎖を同じDomain Stateへ接続する。
 * @responsibility 認証済み主体と対象を照合し、旧Host Store・Bearerを使わず保存する。
 * @trace ARCH-000004、ARCH-000005
 * @boundary 信頼された入口とRepository-localの単一Writer。
 */
import {
  answerDecision,
  applyDecision,
  closeDecision,
  type DecisionRequest,
  ExecutionStorageBlockedError,
  isPrincipalId,
  readDecision,
  requestDecision,
} from "../../../execution-model/src/index.ts";
import {
  getRepository,
  readRepositorySnapshot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "../../../version-control/src/index.ts";
import {
  historyRepositoryInput,
  verifyRuntimePersistenceRepository,
} from "../execution/persistence.ts";
import { coordinatorDataBoundaryBlocked } from "../state/result.ts";
import { deriveCoordinatorRepositoryBindingId } from "../state/validation.ts";
import {
  COORDINATOR_HUMAN_DECISION_CONTRACT,
  type CoordinatorDecisionResult,
  inspectCoordinatorDecisionRequest,
} from "./request.ts";

/** 非秘密な停止結果だけを返し、状態保存不明を未実施へ丸めない。 */
function blocked(
  reason: string,
  decisionId: string | null = null,
  recovery = false,
  recoveryId: string | null = null,
): CoordinatorDecisionResult {
  return {
    contract: COORDINATOR_HUMAN_DECISION_CONTRACT,
    status: "blocked",
    reason,
    decisionId,
    recoveryId,
    decision: null,
    history: null,
    cleanupConfirmed: !recovery,
    manualRecoveryRequired: recovery,
    effectState: recovery ? "unknown" : "no_effect",
  };
}

/**
 * 同じ認証主体と対象へ結合した判断操作を実行する。
 * @responsibility 現在の入口認可と、Domainが持つ値・State・Historyの責務を分離する。
 * @trace ARCH-000004、ARCH-000005
 * @input rawRequest: 閉形式の操作、workingDirectory: Repository起点、authenticationContext: 認証・認可済み主体。
 * @returns 判断・適用・履歴・回復要否を区別した非秘密結果。
 * @precondition 呼出し元が現在の内容認可を確認している。
 * @postcondition 回答からProviderを再送せず、resumeは再計画待ちに進めるだけ。
 * @effect 認可済みRepositoryのState一回保存と既存History出版。
 * @failure 別主体・対象・世代・Queue・保存不明は停止する。
 * @invariant 旧Bearer・Host Store・再発行・保存済み認可を使用しない。
 * @boundary 公開操作とDomainの用途固定Writer。
 * @security 主体は引数の認証Contextだけから搬送する。
 * @concurrency Domainの同Owner内検査・CAS・解放確認を使用する。
 */
export function executeCoordinatorPublicDecision(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
): CoordinatorDecisionResult {
  if (
    !authenticationContext ||
    !isPrincipalId(authenticationContext.principalId)
  )
    return blocked("orchestrator_authenticated_principal_not_verified");
  const input = inspectCoordinatorDecisionRequest(rawRequest);
  if (!input) return blocked("orchestrator_decision_input_invalid");
  try {
    let root: string;
    try {
      root =
        resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
    } catch {
      return blocked(
        "orchestrator_repository_root_not_verified",
        input.decisionId,
      );
    }
    const repository = verifyRuntimePersistenceRepository(root);
    const binding = deriveCoordinatorRepositoryBindingId(root);
    const observed = readDecision(repository, binding, input.decisionId);
    if (observed.status !== "completed")
      return blocked(
        observed.reason,
        input.decisionId,
        observed.manualRecoveryRequired,
        observed.recoveryId,
      );
    const existing = observed.value;
    if (
      existing &&
      (existing.kind !== "continuation" ||
        existing.respondentPrincipalId !== authenticationContext.principalId ||
        existing.target.projectId !== input.projectId ||
        existing.target.milestoneId !== input.milestoneId ||
        existing.target.generation !== input.generation ||
        existing.target.repositoryRevision !== input.repositoryRevision)
    )
      return blocked(
        "orchestrator_decision_target_or_principal_mismatch",
        input.decisionId,
      );
    const now = new Date().toISOString();
    let result: ReturnType<typeof requestDecision>;
    if (input.operation === "request") {
      const identity = readRepositorySnapshot(getRepository(root).capability);
      if (!identity || identity.revisionIdentity !== input.repositoryRevision)
        return blocked(
          "orchestrator_decision_revision_mismatch",
          input.decisionId,
        );
      const requestedAt = existing?.requestedAt ?? now;
      const request: DecisionRequest = {
        decisionId: input.decisionId,
        blockerId: input.blockerId,
        kind: "continuation",
        respondentPrincipalId: authenticationContext.principalId,
        target: {
          projectId: input.projectId,
          milestoneId: input.milestoneId,
          kind: "milestone",
          id: input.milestoneId,
          generation: input.generation,
          repositoryRevision: input.repositoryRevision,
        },
        queueId: input.queueId,
        question: input.question,
        options: input.allowedOptions.map((value) => ({
          value,
          label: value === "resume" ? "再計画して継続" : "取り消す",
        })),
        requestedAt,
      };
      result = requestDecision(
        historyRepositoryInput(repository),
        binding,
        request,
      );
    } else {
      if (!existing)
        return blocked("orchestrator_decision_not_observed", input.decisionId);
      if (input.operation === "answer")
        result = answerDecision(
          historyRepositoryInput(repository),
          binding,
          input.decisionId,
          {
            principalId: authenticationContext.principalId,
            answeredAt: existing.result?.answer.answeredAt ?? now,
            selectedOption: input.selectedOption,
            reason: input.comment?.trim() ? input.comment : null,
            evidenceIds: [],
          },
          existing,
        );
      else if (input.operation === "apply")
        result = applyDecision(
          historyRepositoryInput(repository),
          binding,
          input.decisionId,
          existing,
        );
      else
        result = closeDecision(
          historyRepositoryInput(repository),
          binding,
          input.decisionId,
          input.status,
          input.reason,
          existing,
        );
    }
    if (result.status !== "completed")
      return blocked(
        result.reason,
        input.decisionId,
        result.manualRecoveryRequired,
        result.recoveryId,
      );
    const { decision, history } = result.value;
    return {
      contract: COORDINATOR_HUMAN_DECISION_CONTRACT,
      status:
        input.operation === "answer" && decision.result?.status === "unapplied"
          ? "blocked"
          : "completed",
      reason:
        history.status !== "confirmed"
          ? "orchestrator_decision_state_saved_history_unconfirmed"
          : result.reason,
      decisionId: input.decisionId,
      recoveryId: null,
      decision,
      history,
      cleanupConfirmed: history.status === "confirmed",
      manualRecoveryRequired: history.status !== "confirmed",
      effectState: "settled",
    };
  } catch (error) {
    if (error instanceof ExecutionStorageBlockedError) {
      const failure = coordinatorDataBoundaryBlocked(error);
      return {
        ...blocked(failure.reason, input.decisionId),
        recoveryId: failure.recoveryIds[0] ?? null,
        cleanupConfirmed: failure.cleanupConfirmed,
        manualRecoveryRequired: failure.manualRecoveryRequired,
        effectState: failure.effectState,
      };
    }
    return blocked(
      "orchestrator_decision_observation_unknown",
      input.decisionId,
      true,
    );
  }
}

/**
 * CLI・MCP等の認証済み入口を同じ判断操作へ接続する。
 * @responsibility 起点・主体をそのまま搬送し、認証やStoreを独自に追加しない。
 * @trace ARCH-000004
 * @input request/workingDirectory/authenticationContext: 信頼入口の操作と認証主体。
 * @returns 判断の確定・履歴・回復結果。
 * @precondition 現在認可は入口で確認済み。
 * @postcondition Host Store・秘密値を開かず同じ操作を一回だけ呼ぶ。
 * @effect 下位の同一State／History操作に従う。
 * @failure 下位の観測不能を成功にしない。
 * @invariant AI再試行・自動回復は行わない。
 * @boundary TransportとCoordinator操作。
 * @security 入力からPrincipalを自己解決しない。
 * @concurrency 同期保存Ownerを下位に一元化する。
 */
export function submitDecision(
  request: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  return executeCoordinatorPublicDecision(
    request,
    workingDirectory,
    authenticationContext,
  );
}
