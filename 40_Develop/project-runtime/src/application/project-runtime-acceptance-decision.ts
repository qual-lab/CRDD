/**
 * Objective／Milestone受入判断の公開Application境界。
 *
 * @responsibility SPEC-000002由来の明示判断だけをAuthority検証し、一つのDecision Recordと対応状態へ適用する。
 * @trace ARCH-000005
 */
import { applyProjectRuntimeAcceptanceDecision } from "../core/project-runtime-state.ts";
import type {
  ProjectRuntimeAcceptanceDecision,
  ProjectRuntimeAcceptanceTarget,
} from "../core/project-runtime-state.ts";
import type {
  ProjectRuntimeAcceptanceDecisionAuthorityBinding,
  ProjectRuntimeAcceptanceDecisionAuthorityPort,
  ProjectRuntimeAcceptanceDecisionRecord,
  ProjectRuntimeAcceptanceDecisionStore,
} from "../ports/acceptance-decision-port.ts";
import type { ProjectRuntimeStatePort } from "../ports/state-port.ts";

export const PROJECT_RUNTIME_ACCEPTANCE_DECISION_CONTRACT =
  "crdd-coordinator/project-runtime-acceptance-decision/v1" as const;

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const REVISION = /^[0-9a-f]{40,64}$/u;

/**
 * 受入判断Applicationの入力を定義する。
 *
 * @responsibility Source、対象、世代、判断、根拠および認証済みPrincipalを一つの要求へ結合する。
 * @trace ARCH-000005
 * @shape 受入判断に必要な入力Propertyを表す。
 * @invariant `SPEC-000002`だけをSourceとして許可し、Projection由来Sourceを受理しない。
 * @boundary Public Application入力とProject Runtime Coreの境界。
 * @security 秘密値を入力として受けず、認証済みPrincipalのIdentityだけをAuthority検証へ渡す。
 * @compatibility 利用側はContract Revision 1の宣言済みPropertyだけへ依存する。
 */
export type ProjectRuntimeAcceptanceDecisionRequest = Readonly<{
  contract: typeof PROJECT_RUNTIME_ACCEPTANCE_DECISION_CONTRACT;
  decisionId: string;
  sourceSpecId: string;
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  expectedGeneration: number;
  target: ProjectRuntimeAcceptanceTarget;
  targetId: string;
  decision: ProjectRuntimeAcceptanceDecision;
  criterionEvidenceIds: readonly string[];
  principalId: string;
}>;

/**
 * 受入判断Applicationの依存Portを定義する。
 *
 * @responsibility State、AuthorityおよびDecision Storeだけを依存として固定し、Task／Provider Portを除外する。
 * @trace ARCH-000005
 * @shape 三つの限定Portを表す。
 * @invariant Task作成またはProvider Effectを発行できる依存を追加しない。
 * @boundary Project Runtime CoreとHost Adapterの境界。
 * @security Authority検証はHost Portだけが所有する。
 * @compatibility 利用側は宣言済みPort契約だけを実装する。
 */
export type ProjectRuntimeAcceptanceDecisionDependencies = Readonly<{
  state: ProjectRuntimeStatePort;
  authority: ProjectRuntimeAcceptanceDecisionAuthorityPort;
  store: ProjectRuntimeAcceptanceDecisionStore;
}>;

/**
 * 受入判断Applicationの公開結果を定義する。
 *
 * @responsibility 完了／停止、理由、Record Identity、世代および回復要否を公開する。
 * @trace ARCH-000005
 * @shape 利用側が次の処置を選ぶための非秘密結果を表す。
 * @invariant Authority秘密値や生Store内容を公開しない。
 * @boundary Project Runtime CoreとTransportの結果境界。
 * @security 秘密値、絶対Pathまたは非公開Store情報を含めない。
 * @compatibility 利用側は宣言済み結果Fieldだけへ依存する。
 */
export type ProjectRuntimeAcceptanceDecisionResult = Readonly<{
  contract: typeof PROJECT_RUNTIME_ACCEPTANCE_DECISION_CONTRACT;
  status: "completed" | "blocked";
  reason: string;
  recordId: string | null;
  newGeneration: number | null;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
}>;

/**
 * 受入判断要求を理由付き停止結果へ変換する。
 *
 * @responsibility 停止理由、Record Identityおよび回復要否の公開境界を所有する。
 * @trace ARCH-000005
 * @input reason: string、recordId: string | null、manualRecoveryRequired: boolean
 * @returns ProjectRuntimeAcceptanceDecisionResultを返す。
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
): ProjectRuntimeAcceptanceDecisionResult {
  return Object.freeze({
    contract: PROJECT_RUNTIME_ACCEPTANCE_DECISION_CONTRACT,
    status: "blocked",
    reason,
    recordId,
    newGeneration: null,
    cleanupConfirmed: !manualRecoveryRequired,
    manualRecoveryRequired,
  });
}

/**
 * 受入判断要求の構造と固定語彙を検証する。
 *
 * @responsibility 不正Source、Identity、世代、判断、根拠およびPrincipalをEffect前に拒否する。
 * @trace ARCH-000005
 * @input input: ProjectRuntimeAcceptanceDecisionRequest
 * @returns 有効な要求なら`true`、それ以外は`false`を返す。
 * @precondition 未信頼のTransport入力を型境界の内側で再検証する。
 * @postcondition 検証結果以外の状態を変更しない。
 * @effect N/A: 入力値だけを検証する。
 * @failure 不正入力は例外へ変えず`false`へ閉じる。
 * @invariant Projection用SPEC-000006／000007を受入判断Sourceへ昇格しない。
 * @boundary Transport入力とProject Runtime Applicationの境界。
 * @security 認証済みPrincipalのIdentity以外のAuthority情報を出力または記録しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function validRequest(
  input: unknown,
): input is ProjectRuntimeAcceptanceDecisionRequest {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    return false;
  const candidate = input as Partial<ProjectRuntimeAcceptanceDecisionRequest>;
  return (
    candidate.contract === PROJECT_RUNTIME_ACCEPTANCE_DECISION_CONTRACT &&
    candidate.sourceSpecId === "SPEC-000002" &&
    [
      candidate.decisionId,
      candidate.projectId,
      candidate.milestoneId,
      candidate.targetId,
      candidate.principalId,
    ].every((value) => typeof value === "string" && ID.test(value)) &&
    typeof candidate.repositoryRevision === "string" &&
    REVISION.test(candidate.repositoryRevision) &&
    Number.isSafeInteger(candidate.expectedGeneration) &&
    Number(candidate.expectedGeneration) >= 1 &&
    (candidate.target === "objective" || candidate.target === "milestone") &&
    (candidate.decision === "accept" ||
      candidate.decision === "return" ||
      candidate.decision === "wait") &&
    Array.isArray(candidate.criterionEvidenceIds) &&
    candidate.criterionEvidenceIds.every(
      (value) => typeof value === "string" && ID.test(value),
    ) &&
    new Set(candidate.criterionEvidenceIds).size ===
      candidate.criterionEvidenceIds.length
  );
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
  record: ProjectRuntimeAcceptanceDecisionRecord,
  input: ProjectRuntimeAcceptanceDecisionRequest,
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
 * @boundary 耐久RecordとProject Runtime Stateの相関境界。
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
  record: ProjectRuntimeAcceptanceDecisionRecord,
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
 * @input dependencies: ProjectRuntimeAcceptanceDecisionDependencies、input: ProjectRuntimeAcceptanceDecisionRequest
 * @returns ProjectRuntimeAcceptanceDecisionResultを返す。
 * @precondition Composition Rootが検証済みRepositoryに結合したState、AuthorityおよびStore Portを供給する。
 * @postcondition 成功時は一つのRecordが`finalized`となり、受入・差戻しだけが対応状態を更新する。
 * @effect Decision Storeへ一つの論理Recordを作成し、必要な場合だけProject Runtime Stateを一度更新する。
 * @failure 不正入力、Authority不一致、重複、古い世代またはStore／State観測不能を理由別に停止する。
 * @invariant Task作成、Provider Effect、Projection Authority生成および下位完了からの自動受入を行わない。
 * @boundary Project運営者Authority→Acceptance Decision Port→Decision Store／State StoreのDirect Boundary。
 * @security 認証済みPrincipalのIdentityだけを検証Portへ渡し、Authority秘密値をRecordや結果へ保存しない。
 * @concurrency State世代とRecord IDの比較交換により重複・競合判断を拒否する。
 */
export function recordProjectRuntimeAcceptanceDecision(
  dependencies: ProjectRuntimeAcceptanceDecisionDependencies,
  input: unknown,
): ProjectRuntimeAcceptanceDecisionResult {
  if (!validRequest(input))
    return blocked("project_runtime_acceptance_decision_request_invalid");
  const recordId = `acceptance-${input.decisionId}`;
  const existing = dependencies.store.read(recordId);
  if (existing.status !== "completed")
    return blocked(
      "project_runtime_acceptance_decision_observation_unknown",
      recordId,
      existing.manualRecoveryRequired,
    );
  if (existing.value?.disposition === "finalized")
    return blocked("project_runtime_acceptance_decision_duplicate", recordId);
  const observed = dependencies.state.readState(input.projectId);
  if (observed.status !== "completed" || !observed.value)
    return blocked(
      "project_runtime_acceptance_state_observation_unknown",
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
    return blocked("project_runtime_acceptance_decision_target_mismatch");
  if (preparedRecord && !samePreparedDecision(preparedRecord, input))
    return blocked("project_runtime_acceptance_decision_duplicate", recordId);
  const binding: ProjectRuntimeAcceptanceDecisionAuthorityBinding =
    Object.freeze({
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
  let authorized = false;
  try {
    authorized = dependencies.authority.verify(binding);
  } catch {
    authorized = false;
  }
  if (!authorized)
    return blocked("project_runtime_acceptance_decision_authority_invalid");
  const prepared: ProjectRuntimeAcceptanceDecisionRecord =
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
      return blocked("project_runtime_acceptance_decision_target_mismatch");
    const created = dependencies.store.create(prepared);
    if (created.status !== "completed")
      return blocked(
        "project_runtime_acceptance_decision_record_unknown",
        recordId,
        true,
      );
  }
  let nextState = state;
  if (!decisionAlreadyApplied(state, prepared)) {
    if (state.generation !== input.expectedGeneration)
      return blocked(
        "project_runtime_acceptance_decision_recovery_state_unknown",
        recordId,
        true,
      );
    const transition = applyProjectRuntimeAcceptanceDecision(
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
        "project_runtime_acceptance_state_write_unknown",
        recordId,
        true,
      );
  }
  const finalized: ProjectRuntimeAcceptanceDecisionRecord = Object.freeze({
    ...prepared,
    disposition: "finalized",
    newGeneration: nextState.generation,
  });
  const committed = dependencies.store.compareAndSet(prepared, finalized);
  if (committed.status !== "completed")
    return blocked(
      "project_runtime_acceptance_decision_finalize_unknown",
      recordId,
      true,
    );
  return Object.freeze({
    contract: PROJECT_RUNTIME_ACCEPTANCE_DECISION_CONTRACT,
    status: "completed",
    reason: "project_runtime_acceptance_decision_recorded",
    recordId,
    newGeneration: finalized.newGeneration,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
  });
}
