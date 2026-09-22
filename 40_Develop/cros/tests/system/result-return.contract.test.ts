/**
 * 委譲結果の元Task／正本への帰還境界を検証する。
 *
 * @packageDocumentation
 * @responsibility 作成側、Revision、変更、Evidence、帰還先、Authorityおよび再送を一つのSystem Scenarioで相関する。
 * @trace EST-ST-011
 * @level ST
 * @scope cros、delegation、result-return、correlation
 * @boundary EST-ST-011=System/E2E: Delegated Runtime→Result Return→Origin Task／Canonical Owner。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  type DelegatedResult,
  settleDelegatedResult,
} from "../../src/index.ts";

const DELEGATED_RESULT: DelegatedResult = Object.freeze({
  resultId: "result-1",
  taskId: "task-1",
  requestId: "request-1",
  producerId: "executor-1",
  targetRevision: "r1",
  authority: "candidate-return",
  changesHash: "changes-sha256",
  evidenceIds: Object.freeze(["evidence-1"]),
  complete: true,
});
const ORIGIN_TASK = Object.freeze({
  exists: true,
  taskId: "task-1",
  requestId: "request-1",
  revision: "r1",
  authority: "candidate-return",
});

/**
 * 正常、拒否、帰還先消失、Revision競合、部分結果および再送を検証する。
 * @responsibility 帰還結果の全相関Identityと重複Effect 0をSystem境界で確認する。
 * @trace EST-ST-011
 * @precondition 固定Task、Request、Revision、作成側、変更HashおよびEvidenceを用意する。
 * @stimulus 正常帰還と五つの反例を同じ帰還判定へ渡す。
 * @observation 相関Identity、状態、理由およびEffect件数を観測する。
 * @oracle 正常完成時だけ元TaskへEffect 1、それ以外はEffect 0でIdentityを付け替えない。
 * @cleanup 重複適用と別正本への反映が0であることを確認する。
 * @boundary EST-ST-011=System/E2E: Delegated Runtime→Result Return→Origin Task／Canonical Owner。
 */
test("委譲結果を相関付きで元Taskへ一度だけ帰還させる", () => {
  const accepted = settleDelegatedResult(
    DELEGATED_RESULT,
    ORIGIN_TASK,
    new Set(),
  );
  const rejected = settleDelegatedResult(
    { ...DELEGATED_RESULT, authority: "other" },
    ORIGIN_TASK,
    new Set(),
  );
  const missing = settleDelegatedResult(
    DELEGATED_RESULT,
    { ...ORIGIN_TASK, exists: false },
    new Set(),
  );
  const conflicting = settleDelegatedResult(
    DELEGATED_RESULT,
    { ...ORIGIN_TASK, revision: "r2" },
    new Set(),
  );
  const partial = settleDelegatedResult(
    { ...DELEGATED_RESULT, complete: false },
    ORIGIN_TASK,
    new Set(),
  );
  const replay = settleDelegatedResult(
    DELEGATED_RESULT,
    ORIGIN_TASK,
    new Set(["result-1"]),
  );
  assert.deepEqual(
    [accepted, rejected, missing, conflicting, partial, replay].map((entry) => [
      entry.status,
      entry.effectCount,
    ]),
    [
      ["accepted", 1],
      ["blocked", 0],
      ["blocked", 0],
      ["blocked", 0],
      ["partial", 0],
      ["blocked", 0],
    ],
  );
  assert.equal(accepted.taskId, DELEGATED_RESULT.taskId);
  assert.equal(accepted.requestId, DELEGATED_RESULT.requestId);
  assert.equal(accepted.resultId, DELEGATED_RESULT.resultId);
});
