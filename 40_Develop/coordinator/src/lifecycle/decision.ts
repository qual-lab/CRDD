/**
 * 継続判断・成果受入と、Repositoryの外部送信判断を扱う。
 * @responsibility 判断の対象照合・結果投影・送信方針の開始時捕捉を所有し、保存と技術的な通信制限は専門Ownerへ委譲する。
 * @trace ARCH-000004
 * @trace ARCH-000005
 * @trace ARCH-000015
 * @boundary 公開判断操作、Repository単位のWriter、固定した送信方針の照合。
 */

import { createHash } from "node:crypto";
import {
  EXTERNAL_SEND_POLICY_RELATIVE_PATH,
  readNetworkPolicy,
} from "../../../configuration-model/src/index.ts";
import {
  type AcceptanceDecision,
  type AcceptanceTarget,
  answerDecision,
  applyDecision,
  closeDecision,
  type Decision,
  type DecisionRequest,
  ExecutionStorageBlockedError,
  isPrincipalId,
  readDecision,
  recordDecision,
  requestDecision,
} from "../../../execution-model/src/index.ts";
import {
  getRepository,
  readCommitFile,
  readRepositorySnapshot,
  type Repository,
  resolveVerifiedRepositoryRoot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "../../../version-control/src/index.ts";
import {
  borrowRepositorySource,
  verifyOwnedOperationManagementCapability,
  verifyRepositoryBindingCapability,
  coordinatorDataBoundaryBlocked,
  RepositoryDataBlockedError,
  historyRepositoryInput,
  resolveExecutionStorageDirectory,
} from "./host.ts";
import {
  COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
  deriveCoordinatorRepositoryBindingId,
  parseUnambiguousJsonDocument,
  snapshotJsonValue,
  snapshotPlainArray,
  snapshotPlainRecord,
  validIdentity,
  validRevision,
} from "./validation.ts";
import { workspacePlanReadyForAcceptance } from "./workspace.ts";

/** 認証済み入口が同じ対象へ搬送する判断操作。Bearerや自由入力の主体を含まない。 */
export type CoordinatorDecisionRequest = Readonly<{
  operation: "request" | "answer" | "apply" | "close";
  decisionId: string;
  projectId: string;
  milestoneId: string;
  generation: number;
  repositoryRevision: string;
}> &
  (
    | Readonly<{
        operation: "request";
        blockerId: string;
        queueId: string;
        question: string;
        allowedOptions: readonly ("resume" | "cancel")[];
      }>
    | Readonly<{
        operation: "answer";
        selectedOption: "resume" | "cancel";
        comment?: string;
      }>
    | Readonly<{ operation: "apply" }>
    | Readonly<{
        operation: "close";
        status: "invalidated";
        reason: string;
      }>
  );

/** 状態と履歴の確定を区別する非秘密な公開結果。 */
export type CoordinatorDecisionResult = Readonly<{
  contract: typeof COORDINATOR_HUMAN_DECISION_CONTRACT;
  status: "completed" | "blocked";
  reason: string;
  decisionId: string | null;
  recoveryId: string | null;
  decision: Decision | null;
  history:
    | Readonly<{ status: "confirmed" }>
    | Readonly<{ status: "unconfirmed"; reason: string }>
    | null;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  effectState: "settled" | "no_effect" | "unknown";
}>;

export const COORDINATOR_HUMAN_DECISION_CONTRACT =
  "crdd-coordinator/human-decision/v2" as const;

/** 判断本文の非空・制御文字条件だけを確認する。 */
function validDecisionRequestText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

/** getterやProxyを評価せず既存codecで入力をコピーし、失敗時は値を返さない。 */
function captureDecisionRequestRecord(
  value: unknown,
): Record<string, unknown> | null {
  try {
    const result = snapshotJsonValue(value);
    return result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** fieldの欠測と余分なfieldを同じ閉集合で拒否する。 */
function keys(value: object, names: readonly string[]): boolean {
  return Object.keys(value).sort().join() === [...names].sort().join();
}

/**
 * 認証主体を含まない判断操作だけを閉形式で取得する。
 * @responsibility 旧Bearer・再発行fieldを黙って無視せず拒否する。
 * @trace ARCH-000004、ARCH-000008
 * @input value: 未信頼JSON値。
 * @returns 正規化した操作又はnull。
 * @precondition 認証・認可は信頼入口で別途確認する。
 * @postcondition getter等を評価せず、未知fieldを捨てない。
 * @effect N/A: 値検査のみ。
 * @failure 不正形・未知操作・対象不足はnull。
 * @invariant 入力をAuthorityへ変換しない。
 * @boundary Transportと判断値。
 * @security 主体・秘密値を推測又は補完しない。
 * @concurrency 同期の局所計算のみ。
 */
export function inspectCoordinatorDecisionRequest(
  value: unknown,
): CoordinatorDecisionRequest | null {
  const v = captureDecisionRequestRecord(value);
  const common = [
    "operation",
    "decisionId",
    "projectId",
    "milestoneId",
    "generation",
    "repositoryRevision",
  ];
  if (
    !v ||
    ![v.decisionId, v.projectId, v.milestoneId].every(validIdentity) ||
    !Number.isSafeInteger(v.generation) ||
    Number(v.generation) < 1 ||
    typeof v.repositoryRevision !== "string" ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(v.repositoryRevision)
  )
    return null;
  if (v.operation === "request") {
    if (
      !keys(v, [
        ...common,
        "blockerId",
        "queueId",
        "question",
        "allowedOptions",
      ]) ||
      !validIdentity(v.blockerId) ||
      !validIdentity(v.queueId) ||
      !validDecisionRequestText(v.question) ||
      !Array.isArray(v.allowedOptions) ||
      v.allowedOptions.length < 1 ||
      v.allowedOptions.length > 2 ||
      new Set(v.allowedOptions).size !== v.allowedOptions.length ||
      !v.allowedOptions.every((x) => x === "resume" || x === "cancel")
    )
      return null;
  } else if (v.operation === "answer") {
    if (
      !keys(v, [
        ...common,
        "selectedOption",
        ...(Object.hasOwn(v, "comment") ? ["comment"] : []),
      ]) ||
      (v.selectedOption !== "resume" && v.selectedOption !== "cancel") ||
      (Object.hasOwn(v, "comment") &&
        (typeof v.comment !== "string" ||
          /[\r\n\u0000-\u001f\u007f]/u.test(v.comment)))
    )
      return null;
  } else if (v.operation === "apply") {
    if (!keys(v, common)) return null;
  } else if (v.operation === "close") {
    if (
      !keys(v, [...common, "status", "reason"]) ||
      v.status !== "invalidated" ||
      !validDecisionRequestText(v.reason)
    )
      return null;
  } else return null;
  if (Array.isArray(v.allowedOptions)) Object.freeze(v.allowedOptions);
  return Object.freeze(v) as CoordinatorDecisionRequest;
}

/**
 * 公開判断結果の状態・履歴・回復要否を相関検査する。
 * @responsibility EMが検査した判断を再解釈せず、公開封筒と履歴・回復の相関を確認する。
 * @trace ARCH-000004、ARCH-000008
 * @input value: 正式なsubmitDecisionから搬送された結果。内部のDecisionはEMの保存結果。
 * @returns 質問・回答・適用を省略せず、同じ判断と確定情報を持つ独立結果又はnull。
 * @precondition 判断モデルはEMで受付済み。配送結果を認証・認可として使わない。
 * @postcondition 未知fieldと矛盾した確定表示を拒否する。
 * @effect N/A: 値検査のみ。
 * @failure 不正形・判断と履歴の矛盾はnull。
 * @invariant 適用・履歴確定・実行再開を同一視しない。
 * @boundary Process結果と利用側表示。
 * @security 秘密値・Host Pathを追加しない。
 * @concurrency 同期の局所計算のみ。
 */
function confirmDecisionResult(
  value: CoordinatorDecisionResult,
): CoordinatorDecisionResult | null {
  const v = captureDecisionRequestRecord(value);
  if (
    !v ||
    !keys(v, [
      "contract",
      "status",
      "reason",
      "decisionId",
      "recoveryId",
      "decision",
      "history",
      "cleanupConfirmed",
      "manualRecoveryRequired",
      "effectState",
    ]) ||
    v.contract !== COORDINATOR_HUMAN_DECISION_CONTRACT ||
    (v.status !== "completed" && v.status !== "blocked") ||
    !validDecisionRequestText(v.reason) ||
    typeof v.cleanupConfirmed !== "boolean" ||
    typeof v.manualRecoveryRequired !== "boolean" ||
    typeof v.effectState !== "string" ||
    !["settled", "no_effect", "unknown"].includes(v.effectState) ||
    (v.decisionId !== null && !validIdentity(v.decisionId)) ||
    (v.recoveryId !== null &&
      (!validDecisionRequestText(v.recoveryId) ||
        Buffer.byteLength(v.recoveryId, "utf8") > 512))
  )
    return null;
  if (v.decision === null) {
    if (v.history !== null || v.status !== "blocked") return null;
    if (
      v.effectState !== "unknown" &&
      v.manualRecoveryRequired !== !v.cleanupConfirmed
    )
      return null;
    if (
      v.effectState === "unknown" &&
      (v.cleanupConfirmed !== false || v.manualRecoveryRequired !== true)
    )
      return null;
  } else {
    if (
      !v.decision ||
      typeof v.decision !== "object" ||
      Array.isArray(v.decision) ||
      v.decisionId === null ||
      (v.decision as Decision).decisionId !== v.decisionId ||
      v.effectState !== "settled"
    )
      return null;
    Object.freeze(v.decision);
    const h = v.history as { status?: unknown; reason?: unknown } | null;
    if (
      !h ||
      (h.status === "confirmed"
        ? !keys(h, ["status"])
        : h.status !== "unconfirmed" ||
          !keys(h, ["status", "reason"]) ||
          !validDecisionRequestText(h.reason))
    )
      return null;
    if (
      v.cleanupConfirmed !== (h.status === "confirmed") ||
      v.manualRecoveryRequired !== (h.status === "unconfirmed")
    )
      return null;
  }
  return v as CoordinatorDecisionResult;
}

export const COORDINATOR_ACCEPTANCE_DECISION_CONTRACT =
  "crdd-coordinator/acceptance-decision/v1" as const;

/**
 * 受入判断Applicationの入力を定義する。
 *
 * @responsibility Source、対象、世代、判断、根拠および認証済みPrincipalを一つの要求へ結合する。
 * @trace ARCH-000005
 * @shape 受入判断に必要な入力Propertyを表す。
 * @invariant `SPEC-000002`だけをSourceとして許可し、Projection由来Sourceを受理しない。
 * @boundary Public Application入力とCoordinator Coreの境界。
 * @security 秘密値を入力として受けず、認証済みPrincipalのIdentityだけをAuthority検証へ渡す。
 * @compatibility 利用側はContract Revision 1の宣言済みPropertyだけへ依存する。
 */
export type CoordinatorAcceptanceDecisionRequest = Readonly<{
  contract: typeof COORDINATOR_ACCEPTANCE_DECISION_CONTRACT;
  decisionId: string;
  blockerId: string;
  sourceSpecId: string;
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  expectedGeneration: number;
  target: AcceptanceTarget;
  targetId: string;
  decision: AcceptanceDecision;
  criterionEvidenceIds: readonly string[];
  principalId: string;
}>;

/**
 * 受入判断要求の構造と固定語彙を検証する。
 *
 * @responsibility 不正Source、Identity、世代、判断、根拠およびPrincipalをEffect前に拒否する。
 * @trace ARCH-000005
 * @input input: CoordinatorAcceptanceDecisionRequest
 * @returns 有効な要求なら`true`、それ以外は`false`を返す。
 * @precondition 未信頼のTransport入力を型境界の内側で再検証する。
 * @postcondition 検証結果以外の状態を変更しない。
 * @effect N/A: 入力値だけを検証する。
 * @failure 不正入力は例外へ変えず`false`へ閉じる。
 * @invariant Projection用SPEC-000006／000007を受入判断Sourceへ昇格しない。
 * @boundary Transport入力とCoordinator Applicationの境界。
 * @security 認証済みPrincipalのIdentity以外のAuthority情報を出力または記録しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function validRequest(
  input: unknown,
): input is CoordinatorAcceptanceDecisionRequest {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    return false;
  const candidate = input as Partial<CoordinatorAcceptanceDecisionRequest>;
  return (
    isPrincipalId(candidate.principalId) &&
    candidate.contract === COORDINATOR_ACCEPTANCE_DECISION_CONTRACT &&
    candidate.sourceSpecId === "SPEC-000002" &&
    [
      candidate.decisionId,
      candidate.blockerId,
      candidate.projectId,
      candidate.milestoneId,
      candidate.targetId,
    ].every(validIdentity) &&
    validRevision(candidate.repositoryRevision) &&
    Number.isSafeInteger(candidate.expectedGeneration) &&
    Number(candidate.expectedGeneration) >= 1 &&
    (candidate.target === "objective" || candidate.target === "milestone") &&
    (candidate.decision === "accept" ||
      candidate.decision === "return" ||
      candidate.decision === "wait") &&
    Array.isArray(candidate.criterionEvidenceIds) &&
    candidate.criterionEvidenceIds.every(validIdentity) &&
    new Set(candidate.criterionEvidenceIds).size ===
      candidate.criterionEvidenceIds.length
  );
}

/** 非秘密な停止結果だけを返し、状態保存不明を未実施へ丸めない。 */
function continuationBlocked(
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
export function submitDecision(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
): CoordinatorDecisionResult {
  const result = executeDecision(
    rawRequest,
    workingDirectory,
    authenticationContext,
  );
  return (
    confirmDecisionResult(result) ??
    continuationBlocked("coordinator_decision_result_unconfirmed", null, true)
  );
}

/** 同じ認証主体・対象とDomainの保存操作を接続する。 @trace ARCH-000008 */
function executeDecision(
  rawRequest: unknown,
  workingDirectory: string,
  authenticationContext?: Readonly<{ principalId: string }>,
): CoordinatorDecisionResult {
  if (
    !authenticationContext ||
    !isPrincipalId(authenticationContext.principalId)
  )
    return continuationBlocked(
      "coordinator_authenticated_principal_not_verified",
    );
  const input = inspectCoordinatorDecisionRequest(rawRequest);
  if (!input) return continuationBlocked("coordinator_decision_input_invalid");
  try {
    let root: string;
    try {
      root =
        resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
    } catch {
      return continuationBlocked(
        "coordinator_repository_root_not_verified",
        input.decisionId,
      );
    }
    const repository = resolveExecutionStorageDirectory(root);
    const binding = deriveCoordinatorRepositoryBindingId(root);
    const observed = readDecision(repository, binding, input.decisionId);
    if (observed.status !== "completed")
      return continuationBlocked(
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
      return continuationBlocked(
        "coordinator_decision_target_or_principal_mismatch",
        input.decisionId,
      );
    const now = new Date().toISOString();
    let result: ReturnType<typeof requestDecision>;
    if (input.operation === "request") {
      const identity = readRepositorySnapshot(getRepository(root).capability);
      if (!identity || identity.revisionIdentity !== input.repositoryRevision)
        return continuationBlocked(
          "coordinator_decision_revision_mismatch",
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
        return continuationBlocked(
          "coordinator_decision_not_observed",
          input.decisionId,
        );
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
      return continuationBlocked(
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
          ? "coordinator_decision_state_saved_history_unconfirmed"
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
    if (
      error instanceof ExecutionStorageBlockedError ||
      error instanceof RepositoryDataBlockedError
    ) {
      const failure = coordinatorDataBoundaryBlocked(error);
      return {
        ...continuationBlocked(failure.reason, input.decisionId),
        recoveryId: failure.recoveryIds[0] ?? null,
        cleanupConfirmed: failure.cleanupConfirmed,
        manualRecoveryRequired: failure.manualRecoveryRequired,
        effectState: failure.effectState,
      };
    }
    return continuationBlocked(
      "coordinator_decision_observation_unknown",
      input.decisionId,
      true,
    );
  }
}

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
function acceptanceBlocked(
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
 * @precondition 認証Contextは呼出し元の認証境界で構築される。
 * @postcondition 成功時は一つのDecision Recordと必要な状態更新だけを確定する。
 * @effect Repository-local Stateの判断・適用状態とHistoryを更新する。
 * @failure Root、Revision、Principal、AuthorityまたはStoreを確認できない場合はEffectを拡張せず停止する。
 * @invariant Task作成、Provider EffectおよびProjection由来Authorityを発行しない。
 * @boundary 公開Transport→Coordinatorの受入判断→Repository-local Storeの境界。
 * @security 認証Principalをexact比較し、非公開Store Pathや秘密値を結果へ含めない。
 * @concurrency State世代とDecision Recordの排他的世代作成で競合を拒否する。
 */
export function acceptResult(
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
        reason: "coordinator_authenticated_principal_not_verified",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    // 未信頼要求の副作用付きgetterをRoot照会・保存より前に拒否する。
    try {
      rawRequest = snapshotJsonValue(rawRequest);
    } catch {
      return acceptanceBlocked(
        "coordinator_acceptance_decision_request_invalid",
      );
    }
    if (!validRequest(rawRequest))
      return acceptanceBlocked(
        "coordinator_acceptance_decision_request_invalid",
      );
    let repositoryRoot: string;
    try {
      repositoryRoot =
        resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
    } catch {
      return Object.freeze({
        contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "coordinator_repository_root_not_verified",
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
        reason: "coordinator_authenticated_principal_not_verified",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    const repositoryBindingId =
      deriveCoordinatorRepositoryBindingId(repositoryRoot);
    const repository = resolveExecutionStorageDirectory(repositoryRoot);
    const observed = readDecision(
      repository,
      repositoryBindingId,
      candidate.decisionId,
    );
    if (observed.status !== "completed")
      return acceptanceBlocked(
        observed.reason,
        null,
        observed.manualRecoveryRequired,
      );
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
            repositoryBindingId,
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
        reason: "coordinator_acceptance_revision_mismatch",
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
      return acceptanceBlocked(
        saved.reason === "decision_identity_retired" ||
          saved.reason === "decision_identity_conflict" ||
          saved.reason === "decision_answer_conflict"
          ? "coordinator_acceptance_decision_duplicate"
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
          ? "coordinator_acceptance_state_saved_history_unconfirmed"
          : applied
            ? "coordinator_acceptance_decision_recorded"
            : decision.result?.status === "unapplied"
              ? decision.result.reason
              : "coordinator_acceptance_decision_not_applied",
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
      reason: "coordinator_acceptance_boundary_unknown",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown" as const,
    });
  }
}

export const EXTERNAL_SEND_POLICY_FILE = EXTERNAL_SEND_POLICY_RELATIVE_PATH;

const TOP_LEVEL_KEYS = new Set([
  "schema",
  "enabled",
  "policyId",
  "informationClassification",
  "decisionAuthority",
  "candidatePersistenceAllowed",
  "candidateRetentionHours",
  "candidatePhysicalDeletion",
  "destinations",
]);
const DESTINATION_KEYS = new Set([
  "provider",
  "accountTenantBoundary",
  "subscriptionOffering",
  "purposeOperations",
  "retentionDeletion",
  "secondaryUseTraining",
  "onwardTransferSubprocessing",
  "termsPolicyIdentity",
  "boundaryResolution",
]);
const PURPOSES = Object.freeze([
  "task_execution",
  "independent_review",
  "bounded_remediation",
]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._/:@+-]{0,255}$/u;

/**
 * external-send-policy-runtimeで使用するProviderの値契約を定義する。
 *
 * @responsibility ProviderのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Provider = "codex" | "claude";
/**
 * external-send-policy-runtimeで使用するDestinationの値契約を定義する。
 *
 * @responsibility DestinationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape Destinationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Destinationで宣言した値と責務の対応を維持する。
 * @boundary N/A: Destinationの宣言は外部境界を開かない。
 * @security DestinationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Destinationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Destination = Readonly<{
  provider: Provider;
  accountTenantBoundary: string;
  subscriptionOffering: "chatgpt_subscription_oauth" | "claude_max";
  purposeOperations: readonly string[];
  retentionDeletion: string;
  secondaryUseTraining: string;
  onwardTransferSubprocessing: string;
  termsPolicyIdentity: string;
  boundaryResolution: "authorized_repository_request";
}>;
/**
 * external-send-policy-runtimeで使用するExternal Send Policyの値契約を定義する。
 *
 * @responsibility External Send PolicyのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape ExternalSendPolicyが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExternalSendPolicyで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExternalSendPolicyの宣言は外部境界を開かない。
 * @security ExternalSendPolicyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ExternalSendPolicyの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExternalSendPolicy = Readonly<{
  schema: "crdd-coordinator/external-send-policy/v2";
  enabled: boolean;
  policyId: string;
  informationClassification: "public" | "internal" | "confidential";
  decisionAuthority: "authenticated_local_user";
  candidatePersistenceAllowed: boolean;
  candidateRetentionHours: number;
  candidatePhysicalDeletion: "next_safe_runtime_entry_after_expiry_or_explicit_discard";
  destinations: readonly Destination[];
  policyHash: string;
  sourceRevision: string;
  sourceFileHash: string;
}>;
/**
 * external-send-policy-runtimeで使用するPolicy 記録の値契約を定義する。
 *
 * @responsibility Policy 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape PolicyRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PolicyRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: PolicyRecordの宣言は外部境界を開かない。
 * @security PolicyRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PolicyRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PolicyRecord = Readonly<{
  managementCapability: object;
  repositoryBindingCapability: object;
  operationId: string;
  policy: ResolvedExternalSendPolicy;
}>;

/**
 * 同じRepository設定から固定したProvider別通信条件。
 * @responsibility 役割では分けずProvider固有集合だけを分離する。
 * @trace ARCH-000015
 * @shape codexとclaudeの不変Policy。
 * @invariant File Hashを同意の意味へ混入させない。
 * @boundary 設定Readerから既存同意・実行への値搬送。
 * @security 値はAuthorityではなく実行条件。
 * @compatibility loginでは使用しない。
 */

/**
 * Git固定の送信方針と現在通信Snapshotの結合。
 * @responsibility 既存policyHashの意味を変えず別の通信相関を保持する。
 * @trace ARCH-000015
 * @shape ExternalSendPolicyとRepository追加Host。
 * @invariant 同意後に設定を再読しない。
 * @boundary 非公開Policy Recordと同意・Grant。
 * @security 追加Hostだけで実行許可を発行しない。
 * @compatibility 旧送信方針のHash・Revisionは不変更。
 */
export type ResolvedExternalSendPolicy = ExternalSendPolicy &
  Readonly<{ additionalHosts: readonly string[] }>;

/**
 * 選択Repositoryの現在通信先を一回だけ固定する。
 * @responsibility Domain読取りとDI技術構成を同じRootへ接続する。
 * @trace ARCH-000015
 * @input repositoryRoot: 検証済みRepository Root。
 * @returns readyとProvider別Policy、又は固定blocked。
 * @precondition 呼出し元で対象Repositoryへの現在認可を確認する。
 * @postcondition 他Repositoryの設定・Provider Homeを参照しない。
 * @effect Domain Readerによる読取りだけ。書込み・Docker・Networkなし。
 * @failure 読取り不能・不正Hostはblocked。
 * @invariant 同じ追加配列を両Providerへ一回ずつ適用する。
 * @boundary Workbench・Taskの準備と専門Package。
 * @security Path・本文・File Hash・秘密を返さず、許可を発行しない。
 * @concurrency 返却後のFile変更を現在Snapshotへ反映しない。
 */
export function readRepositoryNetworkHosts(repositoryRoot: Repository) {
  const read = readNetworkPolicy(resolveVerifiedRepositoryRoot(repositoryRoot));
  if (read.status !== "ready")
    return Object.freeze({ status: "blocked" as const, reason: read.reason });
  return Object.freeze({
    status: "ready" as const,
    additionalHosts: Object.freeze([...read.policy.allowedHosts]),
  });
}

const policies = new WeakMap<object, PolicyRecord>();

/**
 * Identifierを安全条件の下で処理する。
 *
 * @responsibility Identifierの安全条件、拒否条件、終了結果境界を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns safeIdentifierの計算結果を返す。
 * @precondition 「value: unknown」がsafeIdentifierの入力契約を満たす。
 * @postcondition safeIdentifierの責務を完了した結果だけを返す。
 * @effect N/A: safeIdentifierは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: safeIdentifierは独自の失敗分岐を所有しない。
 * @invariant safeIdentifierは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: safeIdentifierはProcess内の同一Subsystemで完結する。
 * @security safeIdentifierはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: safeIdentifierは共有非同期状態を持たない同期処理である。
 */
function safeIdentifier(value: unknown) {
  return typeof value === "string" && SAFE_ID.test(value) ? value : null;
}

/**
 * Destinationを固定Schemaへ正規化する。
 *
 * @responsibility Destinationの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000015
 * @input raw: unknown
 * @returns Destination | nullを返す。
 * @precondition 「raw: unknown」がnormalizeDestinationの入力契約を満たす。
 * @postcondition normalizeDestinationの責務を完了した結果だけを返す。
 * @effect N/A: normalizeDestinationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeDestinationは独自の失敗分岐を所有しない。
 * @invariant normalizeDestinationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeDestinationはProcess内の同一Subsystemで完結する。
 * @security normalizeDestinationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeDestinationは共有非同期状態を持たない同期処理である。
 */
function normalizeDestination(raw: unknown): Destination | null {
  const value = snapshotPlainRecord(raw, DESTINATION_KEYS);
  const purposes = value
    ? snapshotPlainArray<string>(value.purposeOperations, PURPOSES.length)
    : null;
  const provider = value?.provider;
  const offering = value?.subscriptionOffering;
  const expected =
    provider === "codex"
      ? Object.freeze({
          accountTenantBoundary:
            "selected_user_dedicated_provider_home_session",
          subscriptionOffering: "chatgpt_subscription_oauth",
          retentionDeletion:
            "provider_terms_and_settings_apply_runtime_not_verified",
          secondaryUseTraining:
            "provider_terms_and_settings_apply_runtime_not_verified",
          onwardTransferSubprocessing:
            "provider_terms_and_settings_apply_runtime_not_verified",
          termsPolicyIdentity: "openai-consumer-terms-runtime-not-verified",
        })
      : provider === "claude"
        ? Object.freeze({
            accountTenantBoundary:
              "selected_user_dedicated_provider_home_session",
            subscriptionOffering: "claude_max",
            retentionDeletion:
              "provider_terms_and_settings_apply_runtime_not_verified",
            secondaryUseTraining:
              "provider_terms_and_settings_apply_runtime_not_verified",
            onwardTransferSubprocessing:
              "provider_terms_and_settings_apply_runtime_not_verified",
            termsPolicyIdentity:
              "anthropic-consumer-terms-runtime-not-verified",
          })
        : null;
  if (
    !value ||
    !expected ||
    value.accountTenantBoundary !== expected.accountTenantBoundary ||
    value.subscriptionOffering !== expected.subscriptionOffering ||
    value.retentionDeletion !== expected.retentionDeletion ||
    value.secondaryUseTraining !== expected.secondaryUseTraining ||
    value.onwardTransferSubprocessing !==
      expected.onwardTransferSubprocessing ||
    value.termsPolicyIdentity !== expected.termsPolicyIdentity ||
    value.boundaryResolution !== "authorized_repository_request" ||
    purposes?.status !== "ok" ||
    purposes.value.length !== PURPOSES.length ||
    purposes.value.some((item, index) => item !== PURPOSES[index]) ||
    !safeIdentifier(value.accountTenantBoundary)
  ) {
    return null;
  }
  return Object.freeze({
    provider: provider as Provider,
    accountTenantBoundary: value.accountTenantBoundary as string,
    subscriptionOffering: offering as Destination["subscriptionOffering"],
    purposeOperations: PURPOSES,
    retentionDeletion: value.retentionDeletion as string,
    secondaryUseTraining: value.secondaryUseTraining as string,
    onwardTransferSubprocessing: value.onwardTransferSubprocessing as string,
    termsPolicyIdentity: value.termsPolicyIdentity as string,
    boundaryResolution: "authorized_repository_request",
  });
}

/**
 * canonical Policy Payloadを決定する。
 *
 * @responsibility canonical Policy Payloadの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input policy: Omit<ExternalSendPolicy, "policyHash">
 * @returns canonicalPolicyPayloadの計算結果を返す。
 * @precondition 「policy: Omit<ExternalSendPolicy, "policyHash">」がcanonicalPolicyPayloadの入力契約を満たす。
 * @postcondition canonicalPolicyPayloadの責務を完了した結果だけを返す。
 * @effect N/A: canonicalPolicyPayloadは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalPolicyPayloadは独自の失敗分岐を所有しない。
 * @invariant canonicalPolicyPayloadは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalPolicyPayloadはProcess内の同一Subsystemで完結する。
 * @security canonicalPolicyPayloadはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalPolicyPayloadは共有非同期状態を持たない同期処理である。
 */
function canonicalPolicyPayload(
  policy: Omit<ExternalSendPolicy, "policyHash">,
) {
  return JSON.stringify({
    schema: policy.schema,
    enabled: policy.enabled,
    policyId: policy.policyId,
    informationClassification: policy.informationClassification,
    decisionAuthority: policy.decisionAuthority,
    candidatePersistenceAllowed: policy.candidatePersistenceAllowed,
    candidateRetentionHours: policy.candidateRetentionHours,
    candidatePhysicalDeletion: policy.candidatePhysicalDeletion,
    destinations: policy.destinations.map((destination) => ({
      provider: destination.provider,
      accountTenantBoundary: destination.accountTenantBoundary,
      subscriptionOffering: destination.subscriptionOffering,
      purposeOperations: destination.purposeOperations,
      retentionDeletion: destination.retentionDeletion,
      secondaryUseTraining: destination.secondaryUseTraining,
      onwardTransferSubprocessing: destination.onwardTransferSubprocessing,
      termsPolicyIdentity: destination.termsPolicyIdentity,
      boundaryResolution: destination.boundaryResolution,
    })),
    sourceRevision: policy.sourceRevision,
    sourceFileHash: policy.sourceFileHash,
  });
}

/**
 * External Send Policy 候補を機械利用可能な契約へ変換する。
 *
 * @responsibility External Send Policy 候補の入力Schema、決定論的変換、変換不能時の拒否境界を所有する。
 * @trace ARCH-000015
 * @input raw: unknown、sourceRevision: string、sourceFileHash: string
 * @returns ExternalSendPolicy | nullを返す。
 * @precondition 「raw: unknown、sourceRevision: string、sourceFileHash: string」がcompileExternalSendPolicyCandidateの入力契約を満たす。
 * @postcondition compileExternalSendPolicyCandidateの責務を完了した結果だけを返す。
 * @effect N/A: compileExternalSendPolicyCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: compileExternalSendPolicyCandidateは独自の失敗分岐を所有しない。
 * @invariant compileExternalSendPolicyCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: compileExternalSendPolicyCandidateはProcess内の同一Subsystemで完結する。
 * @security compileExternalSendPolicyCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: compileExternalSendPolicyCandidateは共有非同期状態を持たない同期処理である。
 */
export function compileExternalSendPolicyCandidate(
  raw: unknown,
  sourceRevision: string,
  sourceFileHash: string,
): ExternalSendPolicy | null {
  const value = snapshotPlainRecord(raw, TOP_LEVEL_KEYS);
  const destinationValues = value
    ? snapshotPlainArray(value.destinations, 2)
    : null;
  const destinations =
    destinationValues?.status === "ok"
      ? destinationValues.value.map(normalizeDestination)
      : null;
  if (
    value?.schema !== "crdd-coordinator/external-send-policy/v2" ||
    typeof value.enabled !== "boolean" ||
    !safeIdentifier(value.policyId) ||
    !["public", "internal", "confidential"].includes(
      value.informationClassification as string,
    ) ||
    value.decisionAuthority !== "authenticated_local_user" ||
    typeof value.candidatePersistenceAllowed !== "boolean" ||
    !Number.isSafeInteger(value.candidateRetentionHours) ||
    (value.candidateRetentionHours as number) < 1 ||
    (value.candidateRetentionHours as number) > 168 ||
    value.candidatePhysicalDeletion !==
      "next_safe_runtime_entry_after_expiry_or_explicit_discard" ||
    !destinations ||
    destinations.length !== 2 ||
    destinations.some((item) => item === null) ||
    destinations[0]?.provider !== "codex" ||
    destinations[1]?.provider !== "claude"
  ) {
    return null;
  }
  const withoutHash = Object.freeze({
    schema: "crdd-coordinator/external-send-policy/v2" as const,
    enabled: value.enabled,
    policyId: value.policyId as string,
    informationClassification: value.informationClassification as
      | "public"
      | "internal"
      | "confidential",
    decisionAuthority: "authenticated_local_user" as const,
    candidatePersistenceAllowed: value.candidatePersistenceAllowed,
    candidateRetentionHours: value.candidateRetentionHours as number,
    candidatePhysicalDeletion:
      "next_safe_runtime_entry_after_expiry_or_explicit_discard" as const,
    destinations: Object.freeze(destinations as Destination[]),
    sourceRevision,
    sourceFileHash,
  });
  return Object.freeze({
    ...withoutHash,
    policyHash: createHash("sha256")
      .update("crdd-external-send-policy-v2\0")
      .update(canonicalPolicyPayload(withoutHash))
      .digest("hex"),
  });
}

/**
 * Runtime 所有 External Send Policyを一意に解決する。
 *
 * @responsibility Runtime 所有 External Send Policyの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000015
 * @input managementCapability: unknown、repositoryBindingCapability: unknown
 * @returns resolveExternalSendPolicyの計算結果を返す。
 * @precondition 「managementCapability: unknown、repositoryBindingCapability: unknown」がresolveExternalSendPolicyの入力契約を満たす。
 * @postcondition resolveExternalSendPolicyの責務を完了した結果だけを返す。
 * @effect 固定版の送信方針と現在のRepository通信設定を読み、既存の非公開PolicyRecordへ保持する。
 * @failure resolveExternalSendPolicyは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveExternalSendPolicyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 固定Git Snapshot、現在Filesystemおよび外部送信前の同意入力。
 * @security resolveExternalSendPolicyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveExternalSendPolicyは共有非同期状態を持たない同期処理である。
 */
export function resolveExternalSendPolicy(
  managementCapability: unknown,
  repositoryBindingCapability: unknown,
) {
  try {
    if (
      !managementCapability ||
      typeof managementCapability !== "object" ||
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object"
    ) {
      return null;
    }
    const operation =
      verifyOwnedOperationManagementCapability(managementCapability);
    const source = borrowRepositorySource(
      repositoryBindingCapability,
      managementCapability,
    );
    const repository = verifyRepositoryBindingCapability(
      repositoryBindingCapability,
      managementCapability,
    );
    if (
      !source ||
      !repository ||
      source.operationId !== operation.operationId ||
      source.revision !== repository.revision
    ) {
      return null;
    }
    const verified = getRepository(source.repositoryRoot);
    if (verified.status !== "completed") return null;
    const file = readCommitFile(verified.capability, {
      commit: source.revision,
      path: EXTERNAL_SEND_POLICY_FILE,
    });
    if (file?.mode !== "100644") return null;
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
      file.bytes,
    );
    const policy = compileExternalSendPolicyCandidate(
      parseUnambiguousJsonDocument(decoded),
      source.revision,
      file.sha256,
    );
    const network = readRepositoryNetworkHosts(verified.capability);
    const reverified = verifyRepositoryBindingCapability(
      repositoryBindingCapability,
      managementCapability,
    );
    if (
      !policy ||
      network.status !== "ready" ||
      reverified?.revision !== policy.sourceRevision
    )
      return null;
    if (!policy.enabled) {
      return Object.freeze({
        status: "disabled" as const,
        capability: null,
        policyId: policy.policyId,
        policyHash: policy.policyHash,
        sourceRevision: policy.sourceRevision,
        hostPathReported: false,
        rawPolicyReported: false,
      });
    }
    const capability = Object.freeze({});
    policies.set(
      capability,
      Object.freeze({
        managementCapability,
        repositoryBindingCapability,
        operationId: operation.operationId,
        policy: Object.freeze({
          ...policy,
          additionalHosts: network.additionalHosts,
        }),
      }),
    );
    return Object.freeze({
      status: "resolved" as const,
      capability,
      policyId: policy.policyId,
      policyHash: policy.policyHash,
      informationClassification: policy.informationClassification,
      candidatePersistenceAllowed: policy.candidatePersistenceAllowed,
      candidateRetentionHours: policy.candidateRetentionHours,
      candidatePhysicalDeletion: policy.candidatePhysicalDeletion,
      sourceRevision: policy.sourceRevision,
      hostPathReported: false,
      rawPolicyReported: false,
    });
  } catch {
    return null;
  }
}

/**
 * Runtime 所有 External Send Policyを検証する。
 *
 * @responsibility Runtime 所有 External Send Policyの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000015
 * @input capability: unknown、managementCapability: unknown、repositoryBindingCapability: unknown
 * @returns verifyExternalSendPolicyの計算結果を返す。
 * @precondition 「capability: unknown、managementCapability: unknown、repositoryBindingCapability: unknown」がverifyExternalSendPolicyの入力契約を満たす。
 * @postcondition verifyExternalSendPolicyの責務を完了した結果だけを返す。
 * @effect N/A: verifyExternalSendPolicyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyExternalSendPolicyは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyExternalSendPolicyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyExternalSendPolicyはProcess内の同一Subsystemで完結する。
 * @security verifyExternalSendPolicyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyExternalSendPolicyは共有非同期状態を持たない同期処理である。
 */
export function verifyExternalSendPolicy(
  capability: unknown,
  managementCapability: unknown,
  repositoryBindingCapability: unknown,
) {
  try {
    if (!capability || typeof capability !== "object") return null;
    const record = policies.get(capability);
    if (
      !record ||
      record.managementCapability !== managementCapability ||
      record.repositoryBindingCapability !== repositoryBindingCapability
    ) {
      return null;
    }
    const repository = verifyRepositoryBindingCapability(
      repositoryBindingCapability,
      managementCapability,
    );
    return repository?.revision === record.policy.sourceRevision
      ? record.policy
      : null;
  } catch {
    return null;
  }
}
