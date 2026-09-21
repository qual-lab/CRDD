/**
 * Project Runtime Acceptance Decision Direct Boundaryの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility SPEC入力→Authority Port→Acceptance Decision Store→State Storeの結合境界を検証する。
 * @trace PRL-IT-008
 * @level IT
 * @scope project-runtime、acceptance-decision、authority、store、state
 * @boundary PRL-IT-008=Direct Boundary: SPEC入力→Acceptance Decision Port→Decision Store
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  PROJECT_RUNTIME_ACCEPTANCE_DECISION_CONTRACT,
  applyProjectRuntimeAcceptanceDecision,
  createProjectRuntimeState,
  observeProjectTaskStarted,
  prepareProjectTaskHandoff,
  recordProjectRuntimeAcceptanceDecision,
  reserveProjectTaskStart,
  settleProjectTask,
  type ProjectRuntimeAcceptanceDecisionRecord,
  type ProjectRuntimeAcceptanceDecisionRequest,
  type ProjectRuntimeAcceptanceDecisionStore,
  type ProjectRuntimePortResult,
  type ProjectRuntimeState,
  type ProjectRuntimeStatePort,
} from "../../src/index.ts";

const revision = "a".repeat(40);

/**
 * 完了Port結果を構築する。
 *
 * @responsibility Test Adapterが返す完了結果を同じPort契約で構築する。
 * @trace PRL-IT-008
 * @precondition valueが対象Portの値契約を満たす。
 * @stimulus valueを完了結果へ包む。
 * @observation status、reasonおよびvalueを返す。
 * @oracle statusが`completed`で入力値が保持される。
 * @cleanup N/A: Process内の不変値だけを使用する。
 * @boundary PRL-IT-008=Direct Boundary: Test Adapter→Project Runtime Port
 */
function completed<T>(value: T): ProjectRuntimePortResult<T> {
  return Object.freeze({ status: "completed", reason: "completed", value });
}

/**
 * 停止Port結果を構築する。
 *
 * @responsibility Test Adapterが返す停止結果を同じPort契約で構築する。
 * @trace PRL-IT-008
 * @precondition reasonが非空である。
 * @stimulus reasonを停止結果へ包む。
 * @observation status、reasonおよび回復要否を返す。
 * @oracle statusが`blocked`でvalueが`null`となる。
 * @cleanup N/A: Process内の不変値だけを使用する。
 * @boundary PRL-IT-008=Direct Boundary: Test Adapter→Project Runtime Port
 */
function blocked<T>(reason: string): ProjectRuntimePortResult<T> {
  return Object.freeze({
    status: "blocked",
    reason,
    value: null,
    manualRecoveryRequired: false,
    recoveryId: null,
  });
}

/**
 * Objectiveが統合待ちとなったProject状態を構築する。
 *
 * @responsibility Task完了とObjective受入前を分離した固定fixtureを構築する。
 * @trace PRL-IT-008
 * @precondition 固定Identityと一つのTaskを使用する。
 * @stimulus Taskを予約、handoff、開始、完了へ進める。
 * @observation Objectiveが`integration_pending`の状態を返す。
 * @oracle Task完了だけではObjectiveまたはMilestoneが受入済みにならない。
 * @cleanup N/A: Process内の不変値だけを使用する。
 * @boundary PRL-IT-008=Direct Boundary: State Machine fixture
 */
function acceptancePendingState(): ProjectRuntimeState {
  const created = createProjectRuntimeState({
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["milestone-criterion"],
    objectives: [
      { id: "objective-a", acceptanceCriteria: ["objective-criterion"] },
    ],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["result.txt"],
        conflictKeys: [],
      },
    ],
    ownerGeneration: "owner-a",
  });
  assert.ok(created.state);
  const reserved = reserveProjectTaskStart(
    created.state,
    created.state.generation,
    "task-a",
    "attempt-a",
    "authority-a",
  );
  assert.ok(reserved.state);
  const handed = prepareProjectTaskHandoff(
    reserved.state,
    reserved.state.generation,
    "task-a",
    "attempt-a",
    "operation-a",
  );
  assert.ok(handed.state);
  const running = observeProjectTaskStarted(
    handed.state,
    handed.state.generation,
    "task-a",
    "attempt-a",
    "operation-a",
  );
  assert.ok(running.state);
  const settled = settleProjectTask(running.state, running.state.generation, {
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "operation-a",
    authorityBindingId: "authority-a",
    outcome: "completed",
    cleanupConfirmed: true,
    recoveryObligations: [],
    recoveryUnresolved: false,
  });
  assert.ok(settled.state);
  return settled.state;
}

/**
 * 受入判断Direct BoundaryのTest Harnessを構築する。
 *
 * @responsibility State、Authority、Decision Storeの観測回数と現在値を同じHarnessで管理する。
 * @trace PRL-IT-008
 * @precondition 初期状態が有効なProject Runtime Stateである。
 * @stimulus Applicationへ渡す限定Portを構築する。
 * @observation stateWrites、creates、finalizesおよびrecordsを公開する。
 * @oracle 未使用のQueue操作は停止し、Task／Provider操作を一切提供しない。
 * @cleanup N/A: Process内Mapだけを使用する。
 * @boundary PRL-IT-008=Direct Boundary: Acceptance Decision Application→Ports
 */
function harness(initial: ProjectRuntimeState) {
  let state = initial;
  let stateWrites = 0;
  let creates = 0;
  let finalizes = 0;
  const records = new Map<string, ProjectRuntimeAcceptanceDecisionRecord>();
  const statePort: ProjectRuntimeStatePort = {
    readState: () => completed(state),
    writeState: (next, expectedGeneration) => {
      if (state.generation !== expectedGeneration)
        return blocked("state_generation_mismatch");
      stateWrites += 1;
      state = next;
      return completed(state);
    },
    enqueueOperation: () => {
      throw new Error("unused");
    },
    readQueue: () => {
      throw new Error("unused");
    },
    selectNextOperation: () => {
      throw new Error("unused");
    },
    updateQueue: () => {
      throw new Error("unused");
    },
    settleQueueRecovery: () => {
      throw new Error("unused");
    },
    settleQueueLeaseRelease: () => {
      throw new Error("unused");
    },
  };
  const store: ProjectRuntimeAcceptanceDecisionStore = Object.freeze({
    read: (recordId) => completed(records.get(recordId) ?? null),
    create: (record) => {
      if (records.has(record.recordId)) return blocked("record_exists");
      creates += 1;
      records.set(record.recordId, record);
      return completed(record);
    },
    compareAndSet: (expected, next) => {
      if (
        JSON.stringify(records.get(expected.recordId)) !==
        JSON.stringify(expected)
      )
        return blocked("record_generation_mismatch");
      finalizes += 1;
      records.set(next.recordId, next);
      return completed(next);
    },
  });
  return {
    dependencies: Object.freeze({
      state: statePort,
      store,
      authority: Object.freeze({
        verify: (
          binding: Readonly<{
            sourceSpecId: string;
            projectId: string;
            principalId: string;
          }>,
        ) =>
          binding.sourceSpecId === "SPEC-000002" &&
          binding.projectId === "project-a" &&
          binding.principalId === "operator-a",
      }),
    }),
    current: () => ({ state, stateWrites, creates, finalizes, records }),
  };
}

/**
 * 受入判断要求を固定入力として構築する。
 *
 * @responsibility 各反例が変更する前のexactな正常入力を所有する。
 * @trace PRL-IT-008
 * @precondition expectedGenerationが現在状態と一致する。
 * @stimulus Objective受入要求を構築する。
 * @observation Applicationへ渡せる完全な要求を返す。
 * @oracle SourceはSPEC-000002、対象はObjective、Authorityは認証済みPrincipalへ結合される。
 * @cleanup N/A: Process内の不変値だけを使用する。
 * @boundary PRL-IT-008=Direct Boundary: Public Request→Application
 */
function request(
  expectedGeneration: number,
): ProjectRuntimeAcceptanceDecisionRequest {
  return Object.freeze({
    contract: PROJECT_RUNTIME_ACCEPTANCE_DECISION_CONTRACT,
    decisionId: "decision-a",
    sourceSpecId: "SPEC-000002",
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    expectedGeneration,
    target: "objective",
    targetId: "objective-a",
    decision: "accept",
    criterionEvidenceIds: Object.freeze(["evidence-a"]),
    principalId: "operator-a",
  });
}

/**
 * 状態Effect前に耐久化された準備Recordを構築する。
 *
 * @responsibility Exact再入場試験が使用する判断Identityと入力を一つのRecordへ固定する。
 * @trace PRL-IT-008
 * @precondition inputが有効なSPEC-000002受入判断要求である。
 * @stimulus inputを`prepared` Dispositionへ写像する。
 * @observation ApplicationのStore Portへ投入できる完全なRecordを返す。
 * @oracle Record ID、対象、世代、根拠およびPrincipalがinputと一致する。
 * @cleanup N/A: Process内の不変値だけを使用する。
 * @boundary PRL-IT-008=Direct Boundary: Recovery fixture→Acceptance Decision Store
 */
function preparedRecord(
  input: ProjectRuntimeAcceptanceDecisionRequest,
): ProjectRuntimeAcceptanceDecisionRecord {
  return Object.freeze({
    recordId: `acceptance-${input.decisionId}`,
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
}

/**
 * SPEC-000002のexactな対象・世代・Authorityだけを一度記録することを検証する。
 *
 * @responsibility 正常なDirect BoundaryでDecision Record一件と対象状態更新一件だけが発生することを判定する。
 * @trace PRL-IT-008
 * @precondition Objectiveが統合待ちで、Authority Portがexact Bindingを許可する。
 * @stimulus Objective受入を一度要求する。
 * @observation 結果、Record、State、各Effect件数を観測する。
 * @oracle Recordはfinalized、Objectiveはacceptedで、Task／Provider依存は存在しない。
 * @cleanup N/A: Process内Mapだけを使用する。
 * @boundary PRL-IT-008=Direct Boundary: SPEC入力→Acceptance Decision Port→Decision Store
 */
test("SPEC-000002のexactな対象・世代・Authorityだけを一度記録する", () => {
  const fixture = harness(acceptancePendingState());
  const result = recordProjectRuntimeAcceptanceDecision(
    fixture.dependencies,
    request(fixture.current().state.generation),
  );
  assert.equal(result.status, "completed");
  assert.equal(result.recordId, "acceptance-decision-a");
  assert.equal(fixture.current().state.objectives[0]?.state, "accepted");
  assert.equal(fixture.current().stateWrites, 1);
  assert.equal(fixture.current().creates, 1);
  assert.equal(fixture.current().finalizes, 1);
  assert.equal(
    fixture.current().records.get("acceptance-decision-a")?.disposition,
    "finalized",
  );
});

/**
 * Projection Source、古い世代、権限不一致および重複判断をEffect 0で拒否することを検証する。
 *
 * @responsibility PRL-IT-008が要求するSource、世代、Authority、重複の反例を同じDirect Boundaryで判定する。
 * @trace PRL-IT-008
 * @precondition 各反例は一つの正常要求Propertyだけを変更する。
 * @stimulus SPEC-000006、古い世代、不正Principalおよび同じDecision IDを順に要求する。
 * @observation 理由code、State Write、Record CreateおよびFinalize件数を観測する。
 * @oracle 前三反例は全Effect 0、重複判断は最初の一件以外を追加しない。
 * @cleanup N/A: Process内Mapだけを使用する。
 * @boundary PRL-IT-008=Direct Boundary: SPEC入力→Acceptance Decision Port→Decision Store
 */
test("Projection Source、古い世代、権限不一致および重複判断をEffect 0で拒否する", () => {
  for (const mutate of [
    (value: ProjectRuntimeAcceptanceDecisionRequest) => ({
      ...value,
      sourceSpecId: "SPEC-000006",
    }),
    (value: ProjectRuntimeAcceptanceDecisionRequest) => ({
      ...value,
      expectedGeneration: value.expectedGeneration - 1,
    }),
    (value: ProjectRuntimeAcceptanceDecisionRequest) => ({
      ...value,
      principalId: "operator-b",
    }),
  ]) {
    const fixture = harness(acceptancePendingState());
    const result = recordProjectRuntimeAcceptanceDecision(
      fixture.dependencies,
      mutate(request(fixture.current().state.generation)),
    );
    assert.equal(result.status, "blocked");
    assert.equal(fixture.current().stateWrites, 0);
    assert.equal(fixture.current().creates, 0);
    assert.equal(fixture.current().finalizes, 0);
  }

  const fixture = harness(acceptancePendingState());
  const exact = request(fixture.current().state.generation);
  assert.equal(
    recordProjectRuntimeAcceptanceDecision(fixture.dependencies, exact).status,
    "completed",
  );
  const duplicate = recordProjectRuntimeAcceptanceDecision(
    fixture.dependencies,
    exact,
  );
  assert.equal(
    duplicate.reason,
    "project_runtime_acceptance_decision_duplicate",
  );
  assert.equal(fixture.current().stateWrites, 1);
  assert.equal(fixture.current().creates, 1);
  assert.equal(fixture.current().finalizes, 1);
});

/**
 * 状態Effect前に停止した同一判断をexact再入場で一度だけ完了できることを検証する。
 *
 * @responsibility 準備Recordだけが残った状態から、同じ判断が状態更新と確定を重複なく再開することを判定する。
 * @trace PRL-IT-008
 * @precondition Storeに入力と同一の`prepared` Recordがあり、Stateは未適用である。
 * @stimulus 同じDecision ID、対象、世代、根拠およびPrincipalで再入場する。
 * @observation State Write、Record Create、Finalizeおよび最終Dispositionを観測する。
 * @oracle Recordを再作成せず、Stateを一度更新して既存Recordを`finalized`へ進める。
 * @cleanup N/A: Process内Mapだけを使用する。
 * @boundary PRL-IT-008=Recovery Boundary: Prepared Record→State Effect→Finalize
 */
test("状態Effect前に停止した同一判断をexact再入場で一度だけ完了する", () => {
  const fixture = harness(acceptancePendingState());
  const exact = request(fixture.current().state.generation);
  fixture.current().records.set("acceptance-decision-a", preparedRecord(exact));

  const recovered = recordProjectRuntimeAcceptanceDecision(
    fixture.dependencies,
    exact,
  );

  assert.equal(recovered.status, "completed");
  assert.equal(fixture.current().state.objectives[0]?.state, "accepted");
  assert.equal(fixture.current().stateWrites, 1);
  assert.equal(fixture.current().creates, 0);
  assert.equal(fixture.current().finalizes, 1);
  assert.equal(
    fixture.current().records.get("acceptance-decision-a")?.disposition,
    "finalized",
  );
});

/**
 * 状態Effect後に停止した同一判断を再発行せず確定できることを検証する。
 *
 * @responsibility State更新済みかつ準備Record残存時に、再入場が二重State Effectを発行しないことを判定する。
 * @trace PRL-IT-008
 * @precondition Storeに`prepared` Recordがあり、Stateには同じ判断が適用済みである。
 * @stimulus 同じ判断Identityで再入場する。
 * @observation State Write、Record Create、Finalizeおよび最終世代を観測する。
 * @oracle State Writeは0、Record Createは0、Finalizeだけが1となる。
 * @cleanup N/A: Process内Mapだけを使用する。
 * @boundary PRL-IT-008=Recovery Boundary: Applied State＋Prepared Record→Finalize
 */
test("状態Effect後に停止した同一判断を再発行せず確定する", () => {
  const pending = acceptancePendingState();
  const exact = request(pending.generation);
  const applied = applyProjectRuntimeAcceptanceDecision(
    pending,
    exact.expectedGeneration,
    exact,
  );
  assert.ok(applied.state);
  const fixture = harness(applied.state);
  fixture.current().records.set("acceptance-decision-a", preparedRecord(exact));

  const recovered = recordProjectRuntimeAcceptanceDecision(
    fixture.dependencies,
    exact,
  );

  assert.equal(recovered.status, "completed");
  assert.equal(fixture.current().stateWrites, 0);
  assert.equal(fixture.current().creates, 0);
  assert.equal(fixture.current().finalizes, 1);
  assert.equal(recovered.newGeneration, applied.state.generation);
});

/**
 * 別判断による準備Recordの横取りをEffect 0で拒否することを検証する。
 *
 * @responsibility Exact再入場を同じ根拠とPrincipalへ限定し、別入力を既存Recordへ結合しないことを判定する。
 * @trace PRL-IT-008
 * @precondition Storeに元要求の`prepared` Recordが存在する。
 * @stimulus Evidenceだけを変更した要求で同じDecision IDへ再入場する。
 * @observation 理由code、State Write、Record CreateおよびFinalize件数を観測する。
 * @oracle duplicateとして停止し、全Effectが0となる。
 * @cleanup N/A: Process内Mapだけを使用する。
 * @boundary PRL-IT-008=Recovery Boundary: Mismatched Request→Effect 0
 */
test("別判断による準備Recordの横取りをEffect 0で拒否する", () => {
  const fixture = harness(acceptancePendingState());
  const exact = request(fixture.current().state.generation);
  fixture.current().records.set("acceptance-decision-a", preparedRecord(exact));

  const rejected = recordProjectRuntimeAcceptanceDecision(
    fixture.dependencies,
    Object.freeze({
      ...exact,
      criterionEvidenceIds: Object.freeze(["evidence-b"]),
    }),
  );

  assert.equal(rejected.status, "blocked");
  assert.equal(
    rejected.reason,
    "project_runtime_acceptance_decision_duplicate",
  );
  assert.equal(fixture.current().stateWrites, 0);
  assert.equal(fixture.current().creates, 0);
  assert.equal(fixture.current().finalizes, 0);
});
