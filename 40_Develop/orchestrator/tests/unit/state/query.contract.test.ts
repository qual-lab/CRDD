/**
 * orchestrator:unit:state-queryの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility orchestrator:unit:state-queryが所有する検証責務を実行する。
 * @trace PPR-UT-006
 * @level UT
 * @scope project、runtime、state、query、public
 * @boundary PPR-UT-006=N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  createOrchestratorState,
  type OrchestratorState,
} from "../../../src/state/transitions.ts";
import {
  inspectOrchestratorStateQuery,
  inspectOrchestratorStateQueryResult,
} from "../../../src/state/query-contract.ts";
import { queryOrchestratorState } from "../../../src/state/query.ts";
import type { OrchestratorStatePort } from "../../../src/state/persistence.ts";

const revision = "a".repeat(40);
const request = Object.freeze({
  requestId: "query-a",
  projectId: "project-a",
  repositoryRevision: revision,
});

/**
 * runtimeStateのTest準備責務を実行する。
 *
 * @responsibility runtimeStateがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runtimeStateを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
function runtimeState(): OrchestratorState {
  const created = createOrchestratorState({
    projectId: request.projectId,
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["Objectiveが受理される"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["Taskが完了する"] }],
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
  assert.equal(created.status, "completed");
  assert.ok(created.state);
  return created.state;
}

/**
 * readerのTest準備責務を実行する。
 *
 * @responsibility readerがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus readerを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
function reader(
  result: ReturnType<OrchestratorStatePort["readState"]>,
): Pick<OrchestratorStatePort, "readState"> {
  return Object.freeze({ readState: () => result });
}

/**
 * 状態参照は閉じた要求だけを受け入れるを検証する。
 *
 * @responsibility 状態参照は閉じた要求だけを受け入れるの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 状態参照は閉じた要求だけを受け入れるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("状態参照は閉じた要求だけを受け入れる", () => {
  assert.deepEqual(inspectOrchestratorStateQuery(request), request);
  assert.equal(
    inspectOrchestratorStateQuery({ ...request, unexpected: true }),
    null,
  );
});

/**
 * 状態参照はOrchestratorのcanonical投影だけを返すを検証する。
 *
 * @responsibility 状態参照はOrchestratorのcanonical投影だけを返すの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 状態参照はOrchestratorのcanonical投影だけを返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("状態参照はOrchestratorのcanonical投影だけを返す", () => {
  const result = queryOrchestratorState(
    reader({ status: "completed", reason: "observed", value: runtimeState() }),
    request,
    "fixture-epoch",
  );
  assert.equal(result.status, "completed");
  assert.equal(result.observationState, "observed");
  assert.equal(result.projection?.projectId, request.projectId);
  assert.equal(result.effectState, "no_effect");
  assert.deepEqual(inspectOrchestratorStateQueryResult(result), result);
});

/**
 * 状態不存在は失敗や成功推定ではなくabsent観測として返すを検証する。
 *
 * @responsibility 状態不存在は失敗や成功推定ではなくabsent観測として返すの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 状態不存在は失敗や成功推定ではなくabsent観測として返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("状態不存在は失敗や成功推定ではなくabsent観測として返す", () => {
  const result = queryOrchestratorState(
    reader({ status: "completed", reason: "absent", value: null }),
    request,
    "fixture-epoch",
  );
  assert.equal(result.status, "completed");
  assert.equal(result.observationState, "absent");
  assert.equal(result.projection, null);
});

/**
 * 異なるRepository改訂版の状態を現在値として返さないを検証する。
 *
 * @responsibility 異なるRepository改訂版の状態を現在値として返さないの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 異なるRepository改訂版の状態を現在値として返さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("異なるRepository改訂版の状態を現在値として返さない", () => {
  const result = queryOrchestratorState(
    reader({
      status: "completed",
      reason: "observed",
      value: { ...runtimeState(), repositoryRevision: "b".repeat(40) },
    }),
    request,
    "fixture-epoch",
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "orchestrator_state_revision_mismatch");
  assert.equal(result.observationState, "unknown");
  assert.equal(result.projection, null);
});

/**
 * 観測不能と既存Recovery義務をEffect発行と混同しないを検証する。
 *
 * @responsibility 観測不能と既存Recovery義務をEffect発行と混同しないの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 観測不能と既存Recovery義務をEffect発行と混同しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: orchestrator Test Source→対象契約
 */
test("観測不能と既存Recovery義務をEffect発行と混同しない", () => {
  const result = queryOrchestratorState(
    reader({
      status: "blocked",
      reason: "store_unavailable",
      value: null,
      manualRecoveryRequired: true,
      recoveryId: "recovery-a",
    }),
    request,
    "fixture-epoch",
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.observationState, "unknown");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.effectState, "no_effect");
});
