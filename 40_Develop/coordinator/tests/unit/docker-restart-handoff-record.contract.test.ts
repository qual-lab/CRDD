/**
 * coordinator:unit:docker-restart-handoff-recordの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:docker-restart-handoff-recordが所有する検証責務を実行する。
 * @trace ERP-UT-006
 * @level UT
 * @scope docker、restart、handoff、record
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createDockerRestartHandoffRecord,
  parseDockerRestartHandoffRecord,
  validateDockerRestartHandoffChain,
} from "../../src/security/docker-restart-handoff-record.ts";
import {
  createDockerRestartRecord,
  type DockerRestartBinding,
  dockerRestartPhases,
} from "../../src/security/docker-restart-record.ts";

/**
 * hのTest準備責務を実行する。
 *
 * @responsibility hがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERP-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus hを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
const h = (n: number) => n.toString(16).padStart(64, "0");
const binding: DockerRestartBinding = {
  recoveryId: `docker-task.${h(1)}.${h(1)}.${h(1)}`,
  operationNonce: h(1),
  runtimeExecutionIdentitySha256: h(1),
  localUserBindingHash: h(1),
  runtimeStateIdentityHash: h(1),
  runtimeStateProtectionHash: h(1),
  stableLogicalHomeBindingHash: h(1),
  pendingSubmissionSha256: h(1),
};
const originRecords = [createDockerRestartRecord(binding, "stop_intent")];

/**
 * migration codec preserves a closed continuation boundary without legacy acceptanceを検証する。
 *
 * @responsibility migration codec preserves a closed continuation boundary without legacy acceptanceの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus migration codec preserves a closed continuation boundary without legacy acceptanceの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("migration codec preserves a closed continuation boundary without legacy acceptance", () => {
  const original = createDockerRestartHandoffRecord(
    originRecords,
    binding,
    [],
    h(2),
  );
  const value = {
    ...JSON.parse(original.toString()),
    contractRevision: 2,
    continuationCount: 1,
    continuationTipSha256: h(4),
  };
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  assert.equal(parseDockerRestartHandoffRecord(bytes)?.continuationCount, 1);
  assert.equal(
    parseDockerRestartHandoffRecord(
      Buffer.from(`${JSON.stringify({ ...value, continuationCount: 5 })}\n`),
    )?.continuationCount,
    5,
  );
  assert.equal(
    validateDockerRestartHandoffChain(originRecords, binding, [bytes], h(2)),
    null,
  );
  assert.equal(parseDockerRestartHandoffRecord(original)?.contractRevision, 1);
  for (const mutation of [
    { continuationCount: -1 },
    { continuationCount: 6 },
    { continuationCount: 0.5 },
    { continuationCount: 0 },
    { continuationTipSha256: null },
    { continuationTipSha256: "invalid" },
  ]) {
    assert.equal(
      parseDockerRestartHandoffRecord(
        Buffer.from(`${JSON.stringify({ ...value, ...mutation })}\n`),
      ),
      null,
    );
  }
});
/**
 * partial v1 history can be linked without changing its bytes or issuing authorityを検証する。
 *
 * @responsibility partial v1 history can be linked without changing its bytes or issuing authorityの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus partial v1 history can be linked without changing its bytes or issuing authorityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("partial v1 history can be linked without changing its bytes or issuing authority", () => {
  const saved = Buffer.from(originRecords[0] as Buffer);
  const first = createDockerRestartHandoffRecord(
    originRecords,
    binding,
    [],
    h(2),
  );
  const second = createDockerRestartHandoffRecord(
    originRecords,
    binding,
    [first],
    h(3),
  );
  assert.equal(
    validateDockerRestartHandoffChain(
      originRecords,
      binding,
      [first, second],
      h(3),
    )?.length,
    2,
  );
  assert.deepEqual(originRecords[0], saved);
  assert.equal(
    Object.hasOwn(parseDockerRestartHandoffRecord(first) ?? {}, "authority"),
    false,
  );
});
/**
 * closed canonical codec rejects malformed values and unsupported revisionを検証する。
 *
 * @responsibility closed canonical codec rejects malformed values and unsupported revisionの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus closed canonical codec rejects malformed values and unsupported revisionの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("closed canonical codec rejects malformed values and unsupported revision", () => {
  const first = createDockerRestartHandoffRecord(
    originRecords,
    binding,
    [],
    h(2),
  );
  for (const bytes of [
    Buffer.alloc(0),
    Buffer.alloc(4097),
    Buffer.from([255]),
    Buffer.from("null"),
    Buffer.from("[]"),
    Buffer.concat([first, Buffer.from("\n")]),
  ])
    assert.equal(parseDockerRestartHandoffRecord(bytes), null);
  for (const [key, value] of [
    ["originRecordRevision", 2],
    ["sequence", 8],
    ["sequence", -1],
    ["sequence", 0.5],
    ["toRuntimeIdentitySha256", "bad"],
    ["extra", true],
    ["previousHandoffSha256", h(9)],
  ] as const) {
    const record = JSON.parse(first.toString());
    record[key] = value;
    assert.equal(
      parseDockerRestartHandoffRecord(
        Buffer.from(`${JSON.stringify(record)}\n`),
      ),
      null,
    );
  }
});
/**
 * exact originRecords, tip, current identity and every target binding field are requiredを検証する。
 *
 * @responsibility exact originRecords, tip, current identity and every target binding field are requiredの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus exact originRecords, tip, current identity and every target binding field are requiredの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("exact originRecords, tip, current identity and every target binding field are required", () => {
  const first = createDockerRestartHandoffRecord(
    originRecords,
    binding,
    [],
    h(2),
  );
  for (const key of Object.keys(binding) as (keyof DockerRestartBinding)[]) {
    assert.equal(
      validateDockerRestartHandoffChain(
        originRecords,
        { ...binding, [key]: h(9) },
        [first],
        h(2),
      ),
      null,
    );
  }
  assert.equal(
    validateDockerRestartHandoffChain(originRecords, binding, [first], h(3)),
    null,
  );
  const extendedRecords = [
    ...originRecords,
    createDockerRestartRecord(binding, "stopped", originRecords[0]),
  ];
  assert.equal(
    validateDockerRestartHandoffChain(extendedRecords, binding, [first], h(2)),
    null,
  );
  assert.equal(
    validateDockerRestartHandoffChain([], binding, [first], h(2)),
    null,
  );
});
/**
 * duplicates, branches, gaps and cyclic runtime adoption are rejectedを検証する。
 *
 * @responsibility duplicates, branches, gaps and cyclic runtime adoption are rejectedの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus duplicates, branches, gaps and cyclic runtime adoption are rejectedの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("duplicates, branches, gaps and cyclic runtime adoption are rejected", () => {
  const a = createDockerRestartHandoffRecord(originRecords, binding, [], h(2));
  const b = createDockerRestartHandoffRecord(originRecords, binding, [a], h(3));
  const branch = createDockerRestartHandoffRecord(
    originRecords,
    binding,
    [],
    h(4),
  );
  for (const records of [[a, a], [b], [branch, b], [b, a]])
    assert.equal(
      validateDockerRestartHandoffChain(originRecords, binding, records, h(3)),
      null,
    );
  assert.throws(() =>
    createDockerRestartHandoffRecord(originRecords, binding, [a, b], h(1)),
  );
  assert.throws(() =>
    createDockerRestartHandoffRecord(originRecords, binding, [a], h(2)),
  );
  assert.throws(() =>
    createDockerRestartHandoffRecord(originRecords, binding, [a, a], h(3)),
  );
});
/**
 * eight handoffs are bounded and completed originRecords uses no partial handoffを検証する。
 *
 * @responsibility eight handoffs are bounded and completed originRecords uses no partial handoffの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus eight handoffs are bounded and completed originRecords uses no partial handoffの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("eight handoffs are bounded and completed originRecords uses no partial handoff", () => {
  const records: Buffer[] = [];
  for (let n = 2; n <= 9; n++)
    records.push(
      createDockerRestartHandoffRecord(originRecords, binding, records, h(n)),
    );
  assert.equal(
    validateDockerRestartHandoffChain(originRecords, binding, records, h(9))
      ?.length,
    8,
  );
  assert.throws(() =>
    createDockerRestartHandoffRecord(originRecords, binding, records, h(10)),
  );
  assert.equal(
    validateDockerRestartHandoffChain(
      originRecords,
      binding,
      [...records, records[7] as Buffer],
      h(9),
    ),
    null,
  );
  const completeRecords: Buffer[] = [];
  for (const phase of dockerRestartPhases)
    completeRecords.push(
      createDockerRestartRecord(binding, phase, completeRecords.at(-1)),
    );
  assert.throws(() =>
    createDockerRestartHandoffRecord(completeRecords, binding, [], h(2)),
  );
});
