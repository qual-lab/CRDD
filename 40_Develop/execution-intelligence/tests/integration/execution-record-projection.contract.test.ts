/**
 * execution-intelligence:integration:record-projection-correlationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Event相関と事実／評価候補分離をProjector境界で検証する。
 * @trace PPR-IT-003
 * @trace PPR-IT-004
 * @level IT
 * @scope execution-intelligence、event-source、correlation、candidate
 * @boundary PPR-IT-003=Direct Boundary、PPR-IT-004=Adjacent 1 Block。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  createTaskAttemptSettledEvent,
  notObserved,
  observed,
  projectExecutionRecords,
  usageNotObserved,
} from "../../src/index.ts";

/**
 * 固定Identityの実行Eventを構築する。
 *
 * @responsibility 相関試験へProject・Attempt差だけが異なる有効Eventを供給する。
 * @trace PPR-IT-003
 * @trace PPR-IT-004
 * @precondition projectId、attemptIdおよびstatusを受け取る。
 * @stimulus Canonical Event生成を呼び出す。
 * @observation 生成済みEventを呼出し元へ返す。
 * @oracle Event検査を通過する固定入力を返す。
 * @cleanup N/A: Helperは外部資源を作成しない。
 * @boundary PPR-IT-003=Direct Boundary、PPR-IT-004=Adjacent 1 Block。
 */
function event(
  projectId: string,
  attemptId: string,
  status: "completed" | "blocked" = "completed",
) {
  return createTaskAttemptSettledEvent({
    occurredAt: "2026-09-22T10:00:00.000Z",
    identity: {
      projectId,
      milestoneId: "milestone-a",
      objectiveId: "objective-a",
      taskId: "task-a",
      attemptId,
      operationId: `operation-${attemptId}`,
    },
    execution: {
      role: "executor",
      provider: observed("codex", "fixture"),
      model: observed("gpt", "fixture"),
      inputStrategyRef: notObserved("not_required"),
      durationMs: observed(10, "fixture"),
      usage: usageNotObserved("not_reported"),
      humanActiveMs: observed(0, "fixture"),
    },
    outcome: {
      status,
      reason: status === "completed" ? "completed" : "provider_failed",
      effectState: status === "completed" ? "settled" : "unknown",
      cleanupConfirmed: status === "completed",
      manualRecoveryRequired: status !== "completed",
      processRestartRequired: false,
    },
    quality: notObserved("not_evaluated"),
  });
}

/**
 * 別Project・別Attempt・観測時点不明Eventを対象事実へ混在させない。
 *
 * @responsibility Event Sourceから対象ProjectへのIdentity相関を検証する。
 * @trace PPR-IT-003
 * @precondition 対象Event、別Project、別AttemptおよびObserved At欠落反例を用意する。
 * @stimulus 対象Projectと許可AttemptでProjectionを生成する。
 * @observation facts、excluded state、reasonおよびeventIdを観測する。
 * @oracle 対象Eventだけをfactsへ含め、他をoutsideまたはunknownへ分ける。
 * @cleanup N/A: Testは外部資源を作成しない。
 * @boundary PPR-IT-003=Direct Boundary: Event Source→Projectorを結合する。
 */
test("別Project・別Attempt・観測時点不明Eventを対象事実へ混在させない", () => {
  const valid = event("project-a", "attempt-a");
  const result = projectExecutionRecords({
    projectId: "project-a",
    attemptIds: ["attempt-a"],
    events: [
      valid,
      event("project-b", "attempt-a"),
      event("project-a", "attempt-b"),
      { ...valid, occurredAt: null },
    ],
  });
  assert.ok(result);
  assert.deepEqual(
    result.facts.map((entry) => entry.eventId),
    [valid.eventId],
  );
  assert.deepEqual(
    result.excluded.map((entry) => [entry.state, entry.reason]),
    [
      ["outside_project", "project_identity_mismatch"],
      ["outside_attempt", "attempt_identity_mismatch"],
      ["unknown", "event_contract_or_observed_at_unknown"],
    ],
  );
});

/**
 * 事実Eventと未採用評価候補を別field・別状態で返す。
 *
 * @responsibility 事実Store相当の入力とCandidate分類結果の責務分離を検証する。
 * @trace PPR-IT-004
 * @precondition blocked事実Eventを対象Projectionへ含める。
 * @stimulus 同一入力集合からProjectionを生成する。
 * @observation facts、evaluation status、basisEventIdsおよびAuthorityを観測する。
 * @oracle Eventはfactsに残り、候補はproposalかつAuthorityなしで別fieldへ返る。
 * @cleanup N/A: Testは外部資源を作成しない。
 * @boundary PPR-IT-004=Adjacent 1 Block: 事実入力→Candidate分類→Projectorを結合する。
 */
test("事実Eventと未採用評価候補を別field・別状態で返す", () => {
  const blocked = event("project-a", "attempt-a", "blocked");
  const result = projectExecutionRecords({
    projectId: "project-a",
    attemptIds: ["attempt-a"],
    events: [blocked],
  });
  assert.ok(result);
  assert.equal(result.facts[0]?.eventId, blocked.eventId);
  assert.equal(result.evaluation.status, "proposal");
  assert.equal(result.evaluation.authorityConferred, false);
  assert.equal(result.authorityConferred, false);
  assert.deepEqual(result.evaluation.candidates[0]?.basisEventIds, [
    blocked.eventId,
  ]);
});
