/**
 * 認証・認可済みの採用判断を検査して保存Portへ渡す。
 *
 * @responsibility 対象と判断の相関を確認し、保存済み判断の結果を返す。
 * @trace ARCH-000004
 */

import type {
  CoordinatorAcceptanceDecisionResult,
  CoordinatorAcceptanceDecisionDependencies,
  CoordinatorAcceptanceDecisionAuthorityBinding,
} from "./types.ts";
import {
  COORDINATOR_ACCEPTANCE_DECISION_CONTRACT,
  type CoordinatorAcceptanceDecisionRequest,
  validRequest,
} from "./request.ts";
import type { CoordinatorAcceptanceDecisionRecord } from "./records.ts";
import { applyCoordinatorAcceptanceDecision } from "../state/model.ts";

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
): CoordinatorAcceptanceDecisionResult {
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
 * 耐久化済みの準備Recordが再入場要求と同一かを判定する。
 *
 * @responsibility 再入場を同じ判断Identity、対象、世代、根拠およびPrincipalへ限定する。
 * @trace ARCH-000005
 * @input record: 既存Record、input: 再入場要求。
 * @returns 全Propertyが一致する場合だけtrueを返す。
 * @precondition recordとinputは各境界で構造検証済みである。
 * @postcondition 比較以外の状態を変更しない。
 * @effect N/A: Plain Dataを比較するだけである。
 * @failure N/A: 不一致はfalseへ閉じる。
 * @invariant 別の判断、根拠またはPrincipalを既存Recordへ結合しない。
 * @boundary 耐久Recordと再入場要求の相関境界。
 * @security Principal以外のCredential値を扱わない。
 * @concurrency N/A: 不変値の同期比較だけを行う。
 */
function samePreparedDecision(
  record: CoordinatorAcceptanceDecisionRecord,
  input: CoordinatorAcceptanceDecisionRequest,
): boolean {
  return (
    record.disposition === "prepared" &&
    record.decisionId === input.decisionId &&
    record.sourceSpecId === input.sourceSpecId &&
    record.projectId === input.projectId &&
    record.milestoneId === input.milestoneId &&
    record.repositoryRevision === input.repositoryRevision &&
    record.expectedGeneration === input.expectedGeneration &&
    record.target === input.target &&
    record.targetId === input.targetId &&
    record.decision === input.decision &&
    record.principalId === input.principalId &&
    JSON.stringify(record.criterionEvidenceIds) ===
      JSON.stringify(input.criterionEvidenceIds)
  );
}

/**
 * 準備Recordの判断が現在状態へ既に適用済みかを判定する。
 *
 * @responsibility 観測不能後の再入場で状態Effectを重複発行せず、適用済み判断だけを確定可能にする。
 * @trace ARCH-000005
 * @input state: 現在状態、record: 同一性確認済み準備Record。
 * @returns 判断結果と世代が一致する場合だけtrueを返す。
 * @precondition recordはsamePreparedDecisionで再入場要求と一致している。
 * @postcondition 判定以外の状態を変更しない。
 * @effect N/A: 現在状態を読むだけである。
 * @failure N/A: 不一致または対象不存在はfalseへ閉じる。
 * @invariant accept／returnは次世代、waitは元世代だけを適用済みとみなす。
 * @boundary 耐久RecordとCoordinator Stateの相関境界。
 * @security Authorityを生成せず、検証済みRecordの意味だけを照合する。
 * @concurrency 世代一致を必須として競合更新を適用済みへ誤認しない。
 */
function decisionAlreadyApplied(
  state: Readonly<{
    generation: number;
    milestone: Readonly<{ state: string }>;
    objectives: readonly Readonly<{
      definition: Readonly<{ id: string }>;
      state: string;
    }>[];
  }>,
  record: CoordinatorAcceptanceDecisionRecord,
): boolean {
  if (record.target === "objective") {
    const objective = state.objectives.find(
      ({ definition }) => definition.id === record.targetId,
    );
    const expectedState =
      record.decision === "accept"
        ? "accepted"
        : record.decision === "return"
          ? "returned"
          : "integration_pending";
    const expectedGeneration =
      record.expectedGeneration + (record.decision === "wait" ? 0 : 1);
    return (
      state.generation === expectedGeneration &&
      objective?.state === expectedState
    );
  }
  const expectedState =
    record.decision === "accept"
      ? "accepted"
      : record.decision === "return"
        ? "returned"
        : "integrating";
  const expectedGeneration =
    record.expectedGeneration + (record.decision === "wait" ? 0 : 1);
  return (
    state.generation === expectedGeneration &&
    state.milestone.state === expectedState
  );
}

/**
 * Project運営者の受入判断をAuthority検証し、一つのRecordと状態へ適用する。
 *
 * @responsibility exactなProject、対象、世代、SourceおよびAuthorityだけを処置し、Decision Recordを状態Effectより先に耐久化する。
 * @trace ARCH-000005
 * @input dependencies: CoordinatorAcceptanceDecisionDependencies、input: CoordinatorAcceptanceDecisionRequest
 * @returns CoordinatorAcceptanceDecisionResultを返す。
 * @precondition Composition Rootが検証済みRepositoryに結合したState、AuthorityおよびStore Portを供給する。
 * @postcondition 成功時は一つのRecordが`finalized`となり、受入・差戻しだけが対応状態を更新する。
 * @effect Decision Storeへ一つの論理Recordを作成し、必要な場合だけCoordinator Stateを一度更新する。
 * @failure 不正入力、Authority不一致、重複、古い世代またはStore／State観測不能を理由別に停止する。
 * @invariant Task作成、Provider Effect、Projection Authority生成および下位完了からの自動受入を行わない。
 * @boundary Project運営者Authority→Acceptance Decision Port→Decision Store／State StoreのDirect Boundary。
 * @security 認証済みPrincipalのIdentityだけを検証Portへ渡し、Authority秘密値をRecordや結果へ保存しない。
 * @concurrency State世代とRecord IDの比較交換により重複・競合判断を拒否する。
 */
export function recordCoordinatorAcceptanceDecision(
  dependencies: CoordinatorAcceptanceDecisionDependencies,
  input: unknown,
): CoordinatorAcceptanceDecisionResult {
  if (!validRequest(input))
    return blocked("orchestrator_acceptance_decision_request_invalid");
  const recordId = `acceptance-${input.decisionId}`;
  const existing = dependencies.store.read(recordId);
  if (existing.status !== "completed")
    return blocked(
      "orchestrator_acceptance_decision_observation_unknown",
      recordId,
      existing.manualRecoveryRequired,
    );
  if (existing.value?.disposition === "finalized")
    return blocked("orchestrator_acceptance_decision_duplicate", recordId);
  const observed = dependencies.state.readState(input.projectId);
  if (observed.status !== "completed" || !observed.value)
    return blocked(
      "orchestrator_acceptance_state_observation_unknown",
      recordId,
      observed.status === "blocked" && observed.manualRecoveryRequired,
    );
  const state = observed.value;
  const preparedRecord = existing.value;
  if (
    state.projectId !== input.projectId ||
    state.milestoneId !== input.milestoneId ||
    state.repositoryRevision !== input.repositoryRevision
  )
    return blocked("orchestrator_acceptance_decision_target_mismatch");
  if (preparedRecord && !samePreparedDecision(preparedRecord, input))
    return blocked("orchestrator_acceptance_decision_duplicate", recordId);
  const binding: CoordinatorAcceptanceDecisionAuthorityBinding = Object.freeze({
    sourceSpecId: "SPEC-000002",
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    repositoryRevision: input.repositoryRevision,
    expectedGeneration: input.expectedGeneration,
    target: input.target,
    targetId: input.targetId,
    decision: input.decision,
    principalId: input.principalId,
  });
  let isAuthorized = false;
  try {
    isAuthorized = dependencies.authority.verify(binding);
  } catch {
    isAuthorized = false;
  }
  if (!isAuthorized)
    return blocked("orchestrator_acceptance_decision_authority_invalid");
  const prepared: CoordinatorAcceptanceDecisionRecord =
    preparedRecord ??
    Object.freeze({
      recordId,
      decisionId: input.decisionId,
      sourceSpecId: "SPEC-000002",
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      repositoryRevision: input.repositoryRevision,
      expectedGeneration: input.expectedGeneration,
      target: input.target,
      targetId: input.targetId,
      decision: input.decision,
      criterionEvidenceIds: Object.freeze([...input.criterionEvidenceIds]),
      principalId: input.principalId,
      disposition: "prepared",
      newGeneration: null,
    });
  if (!preparedRecord) {
    if (state.generation !== input.expectedGeneration)
      return blocked("orchestrator_acceptance_decision_target_mismatch");
    const created = dependencies.store.create(prepared);
    if (created.status !== "completed")
      return blocked(
        "orchestrator_acceptance_decision_record_unknown",
        recordId,
        true,
      );
  }
  let nextState = state;
  if (!decisionAlreadyApplied(state, prepared)) {
    if (state.generation !== input.expectedGeneration)
      return blocked(
        "orchestrator_acceptance_decision_recovery_state_unknown",
        recordId,
        true,
      );
    const transition = applyCoordinatorAcceptanceDecision(
      state,
      input.expectedGeneration,
      input,
    );
    if (transition.status !== "completed") return blocked(transition.reason);
    nextState = transition.state;
  }
  if (nextState !== state) {
    const written = dependencies.state.writeState(
      nextState,
      input.expectedGeneration,
    );
    if (written.status !== "completed")
      return blocked(
        "orchestrator_acceptance_state_write_unknown",
        recordId,
        true,
      );
  }
  const finalized: CoordinatorAcceptanceDecisionRecord = Object.freeze({
    ...prepared,
    disposition: "finalized",
    newGeneration: nextState.generation,
  });
  const committed = dependencies.store.compareAndSet(prepared, finalized);
  if (committed.status !== "completed")
    return blocked(
      "orchestrator_acceptance_decision_finalize_unknown",
      recordId,
      true,
    );
  return Object.freeze({
    contract: COORDINATOR_ACCEPTANCE_DECISION_CONTRACT,
    status: "completed",
    reason: "orchestrator_acceptance_decision_recorded",
    recordId,
    newGeneration: finalized.newGeneration,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
  });
}
