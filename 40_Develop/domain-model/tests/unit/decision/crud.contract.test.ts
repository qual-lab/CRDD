/**
 * 判断記録の固定CRUD候補を検証する。
 * @packageDocumentation
 * @responsibility 二世代・exact比較・対象外保持と既存拒否理由を反証する。
 * @trace PRL-UT-007
 * @level UT
 * @scope 合成Snapshot上の受入判断・判断回復の六操作。
 * @boundary 値操作だけ。実保存・現在認可・人間判断の真正性は別試験が所有する。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  prepareCoordinatorAcceptanceDecisionCreation,
  projectCoordinatorAcceptanceDecisionRecord,
  prepareCoordinatorAcceptanceDecisionFinalization,
  prepareCoordinatorDecisionRecoveryCreation,
  projectCoordinatorDecisionRecoveryRecord,
  prepareCoordinatorDecisionRecoveryUpdate,
  validCoordinatorAcceptanceDecisionRecord,
  validCoordinatorDecisionRecoveryIntent,
  encodeRuntimeStateValue,
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  type CoordinatorSnapshot,
  type CoordinatorAcceptanceDecisionRecord,
  type CoordinatorDecisionRecoveryIntent,
} from "../../../src/index.ts";

/**
 * 局所候補の検査に必要な既存値だけを組み立てる。
 * @responsibility 固定の判断・回復値と空の共通Snapshotを用意する。
 * @trace PRL-UT-007
 * @precondition N/A: 外部入力なし。
 * @stimulus 六操作の共通前提を作成する。
 * @observation 型付きSnapshot・判断・回復値を返す。
 * @oracle 判断値は既存validatorを通り、Snapshotは値操作の入力形状を持つ。
 * @cleanup N/A: メモリ値だけ。
 * @boundary 全体codec・実保存・認可の成立は主張しない。
 */
function fixture() {
  const current: CoordinatorSnapshot = {
    schema: COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
    schemaRevision: 5,
    repositoryRootHash: "a".repeat(64),
    repositoryBindingId: "binding-a",
    snapshotRevision: 1,
    intakeEpoch: "epoch-a",
    intakeBindings: [],
    projects: [],
    queueEntries: [],
    workspaces: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    acceptanceDecisions: [],
    decisionRecoveries: [],
  };
  const record: CoordinatorAcceptanceDecisionRecord = {
    recordId: "record-a",
    decisionId: "decision-a",
    sourceSpecId: "SPEC-000002",
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: "b".repeat(40),
    expectedGeneration: 1,
    target: "objective",
    targetId: "objective-a",
    decision: "accept",
    criterionEvidenceIds: ["criterion-a"],
    principalId: "operator-a",
    disposition: "prepared",
    newGeneration: null,
  };
  const intent: CoordinatorDecisionRecoveryIntent = {
    recoveryId: "recovery-a",
    recordId: "record-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    applicationId: "application-a",
    expectedGeneration: 1,
    newGeneration: 2,
    observedDisposition: "prepared",
    unknownBoundary: "project_readback",
    disposition: "required",
  };
  assert.equal(validCoordinatorAcceptanceDecisionRecord(record), true);
  assert.equal(validCoordinatorDecisionRecoveryIntent(intent), true);
  return { current, record, intent };
}

/**
 * 受入判断を初回から二世代へ固定する。
 * @responsibility Envelope全文Hash・優先順・重複と比較競合を保持する。
 * @trace PRL-UT-007
 * @precondition 合成したprepared判断と値Snapshotを使用する。
 * @stimulus 作成・読取り・確定と各既存拒否条件を評価する。
 * @observation 結果封筒、二世代、対象外参照と入力本文。
 * @oracle 読取りは候補なし、作成と確定は他区画不変で二世代を結び、禁止条件を拒否する。
 * @cleanup N/A: 外部資源なし。
 * @boundary 局所候補の検査。耐久保存・Authorityは含まない。
 */
test("受入判断の三操作は二世代と元Envelope Hashを保持する", () => {
  const { current, record } = fixture();
  const before = JSON.stringify({ current, record });
  assert.deepEqual(
    projectCoordinatorAcceptanceDecisionRecord(current, record.recordId),
    {
      status: "completed",
      reason: "orchestrator_acceptance_record_observed",
      value: { next: null, value: null },
    },
  );
  const created = prepareCoordinatorAcceptanceDecisionCreation(
    current,
    "binding-a",
    record,
  );
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw Error("creation_refused");
  const first = created.value.next;
  assert.equal(Object.isFrozen(created), true);
  assert.equal(Object.isFrozen(created.value), false);
  assert.equal(first.projects, current.projects);
  assert.equal(first.decisionRecoveries, current.decisionRecoveries);
  assert.equal(created.value.value, record);
  assert.equal(first.acceptanceDecisions[0]?.previousHash, null);
  assert.equal(
    projectCoordinatorAcceptanceDecisionRecord(first, record.recordId).value
      ?.value,
    record,
  );
  const finalized: CoordinatorAcceptanceDecisionRecord = {
    ...record,
    disposition: "finalized",
    newGeneration: 2,
  };
  const committed = prepareCoordinatorAcceptanceDecisionFinalization(
    first,
    "binding-a",
    record,
    finalized,
  );
  assert.equal(committed.status, "completed");
  if (committed.status !== "completed") throw Error("finalization_refused");
  const second = committed.value.next;
  assert.equal(second.acceptanceDecisions.length, 2);
  assert.equal(
    second.acceptanceDecisions[1]?.previousHash,
    createHash("sha256")
      .update(encodeRuntimeStateValue(first.acceptanceDecisions[0]))
      .digest("hex"),
  );
  assert.equal(second.acceptanceDecisions[1]?.generation, 2);
  assert.equal(second.projects, first.projects);
  assert.equal(
    projectCoordinatorAcceptanceDecisionRecord(second, record.recordId).value
      ?.value,
    finalized,
  );
  assert.equal(
    prepareCoordinatorAcceptanceDecisionCreation(first, "binding-a", record)
      .reason,
    "orchestrator_acceptance_record_exists",
  );
  assert.equal(
    prepareCoordinatorAcceptanceDecisionCreation(
      current,
      "binding-a",
      finalized,
    ).reason,
    "orchestrator_acceptance_record_invalid",
  );
  assert.deepEqual(
    prepareCoordinatorAcceptanceDecisionCreation(current, "binding-a", {
      ...record,
      recordId: "",
    }),
    {
      status: "blocked",
      reason: "orchestrator_acceptance_record_invalid",
      value: null,
      manualRecoveryRequired: false,
      recoveryId: null,
    },
  );
  assert.equal(
    projectCoordinatorAcceptanceDecisionRecord(current, "").reason,
    "orchestrator_acceptance_record_identity_invalid",
  );
  assert.equal(
    prepareCoordinatorAcceptanceDecisionFinalization(
      current,
      "binding-a",
      record,
      finalized,
    ).reason,
    "orchestrator_acceptance_record_generation_mismatch",
  );
  assert.equal(
    prepareCoordinatorAcceptanceDecisionFinalization(
      first,
      "binding-a",
      { ...record, principalId: "operator-b" },
      finalized,
    ).reason,
    "orchestrator_acceptance_record_generation_mismatch",
  );
  assert.equal(
    prepareCoordinatorAcceptanceDecisionFinalization(
      first,
      "binding-a",
      record,
      {
        ...finalized,
        recordId: "record-b",
      },
    ).reason,
    "orchestrator_acceptance_record_transition_invalid",
  );
  assert.equal(
    prepareCoordinatorAcceptanceDecisionFinalization(
      second,
      "binding-a",
      record,
      finalized,
    ).reason,
    "orchestrator_acceptance_record_exists",
  );
  assert.equal(JSON.stringify({ current, record }), before);
});

/**
 * 判断回復のexact本文を同じ参照で比較更新する。
 * @responsibility 重複、別ID、元本文差を拒否し、対象外の実体を保持する。
 * @trace PRL-UT-007
 * @precondition 合成したrequired回復記録を使用する。
 * @stimulus 作成・読取り・更新と不正入力・期待値差を評価する。
 * @observation 世代、対象外entry、返却参照と入力本文。
 * @oracle 同じ回復だけが世代を一つ進め、真正不存在と不正IDを区別する。
 * @cleanup N/A: 外部資源なし。
 * @boundary 値更新のみで実Recoveryの実行・成立を示さない。
 */
test("判断回復の三操作はexact期待本文と対象外entryを保持する", () => {
  const { current, intent } = fixture();
  const before = JSON.stringify({ current, intent });
  const other = {
    generation: 3,
    value: { ...intent, recoveryId: "recovery-b" },
  };
  const base: CoordinatorSnapshot = { ...current, decisionRecoveries: [other] };
  assert.deepEqual(
    projectCoordinatorDecisionRecoveryRecord(base, intent.recoveryId),
    {
      status: "completed",
      reason: "orchestrator_decision_recovery_observed",
      value: { next: null, value: null },
    },
  );
  const created = prepareCoordinatorDecisionRecoveryCreation(base, intent);
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw Error("creation_refused");
  const first = created.value.next;
  assert.equal(first.acceptanceDecisions, base.acceptanceDecisions);
  assert.equal(
    projectCoordinatorDecisionRecoveryRecord(first, intent.recoveryId).value
      ?.value,
    intent,
  );
  const next: CoordinatorDecisionRecoveryIntent = {
    ...intent,
    disposition: "settled",
  };
  const updated = prepareCoordinatorDecisionRecoveryUpdate(first, intent, next);
  assert.equal(updated.status, "completed");
  if (updated.status !== "completed") throw Error("update_refused");
  assert.equal(updated.value.next.decisionRecoveries[0], other);
  assert.equal(updated.value.next.decisionRecoveries[1]?.generation, 2);
  assert.equal(
    projectCoordinatorDecisionRecoveryRecord(
      updated.value.next,
      intent.recoveryId,
    ).value?.value,
    next,
  );
  assert.equal(
    prepareCoordinatorDecisionRecoveryCreation(first, intent).reason,
    "orchestrator_decision_recovery_exists",
  );
  assert.equal(
    prepareCoordinatorDecisionRecoveryCreation(base, {
      ...intent,
      recoveryId: "",
    }).reason,
    "orchestrator_decision_recovery_invalid",
  );
  assert.equal(
    projectCoordinatorDecisionRecoveryRecord(first, "").reason,
    "orchestrator_decision_recovery_invalid",
  );
  assert.equal(
    prepareCoordinatorDecisionRecoveryUpdate(base, intent, next).reason,
    "orchestrator_decision_recovery_generation_mismatch",
  );
  assert.equal(
    prepareCoordinatorDecisionRecoveryUpdate(
      first,
      { ...intent, unknownBoundary: "other" },
      next,
    ).reason,
    "orchestrator_decision_recovery_generation_mismatch",
  );
  assert.equal(
    prepareCoordinatorDecisionRecoveryUpdate(first, intent, {
      ...next,
      recoveryId: "recovery-c",
    }).reason,
    "orchestrator_decision_recovery_invalid",
  );
  assert.equal(JSON.stringify({ current, intent }), before);
});
