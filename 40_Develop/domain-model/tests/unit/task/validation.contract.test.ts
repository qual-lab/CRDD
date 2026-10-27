/**
 * Domainの結果受理値とDescriptor境界を検証する。
 * @packageDocumentation
 * @responsibility 閉じた本文とprototype継承の拒否を反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 結果受理decoder、plain data。
 * @boundary 値だけ。Coordinator・保存I/O・実行資源を使用しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { types as utilTypes } from "node:util";
import vm from "node:vm";
import { it } from "node:test";
import { decodeProjectResultAcceptance } from "../../../src/index.ts";
import { sourceDeclaration } from "../../support/source-declaration.ts";
/**
 * 新形式の結果受理本文の閉集合を検証する。
 * @responsibility 十一項目、初回世代、識別子、Hashと旧形式拒否を確認する。
 * @trace PRL-UT-006
 * @precondition 実行資源を持たない固定本文を使用する。
 * @stimulus 正常本文と各項目の欠落・不正値・追加項目、隔離realm内のDescriptor継承値と旧判定変異を検査する。
 * @observation decoderの返却値と入力の保持を観測する。
 * @oracle 正常値だけ固定値を返し、未評価や旧形式を補完しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary PRL-UT-006=Direct Boundary: Test Source→受理本文decoder。
 */
it("結果受理本文は十一項目を固定し旧領収書を受け付けない", () => {
  const acceptance = {
    repositoryBindingId: "repository-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: "logical-operation-a",
    recoveryId: "recovery-a",
    settlementGeneration: 7,
    repositoryBinding: "a".repeat(64),
    resultId: "b".repeat(64),
    consumer: "orchestrator",
  };
  const decoded = decodeProjectResultAcceptance(acceptance);
  assert.ok(decoded);
  assert.deepEqual({ ...decoded }, acceptance);
  assert.equal(Object.getPrototypeOf(decoded), null);
  assert.ok(Object.isFrozen(decoded));
  assert.equal(decoded?.settlementGeneration, 7);
  for (const key of Object.keys(acceptance)) {
    const missing: Record<string, unknown> = { ...acceptance };
    delete missing[key];
    assert.equal(decodeProjectResultAcceptance(missing), null, key);
  }
  for (const key of [
    "repositoryBindingId",
    "projectId",
    "milestoneId",
    "taskId",
    "attemptId",
    "operationId",
    "recoveryId",
  ]) {
    for (const invalid of ["", "x".repeat(1025), null, 1])
      assert.equal(
        decodeProjectResultAcceptance({ ...acceptance, [key]: invalid }),
        null,
      );
  }
  for (const key of ["repositoryBinding", "resultId"]) {
    for (const invalid of ["", "A".repeat(64), "a".repeat(63), null])
      assert.equal(
        decodeProjectResultAcceptance({ ...acceptance, [key]: invalid }),
        null,
      );
  }
  for (const settlementGeneration of [
    0,
    -1,
    1.5,
    Number.NaN,
    Number.MAX_SAFE_INTEGER + 1,
    "7",
  ])
    assert.equal(
      decodeProjectResultAcceptance({ ...acceptance, settlementGeneration }),
      null,
    );
  for (const consumer of ["workbench", "cli", null])
    assert.equal(
      decodeProjectResultAcceptance({ ...acceptance, consumer }),
      null,
    );
  for (const key of [
    "extra",
    "runtimeStateBinding",
    "receiptContentHash",
    "receiptContentIdentity",
  ])
    assert.equal(
      decodeProjectResultAcceptance({ ...acceptance, [key]: "legacy" }),
      null,
    );
  let isGetterCalled = false;
  const accessor = Object.defineProperty({ ...acceptance }, "resultId", {
    enumerable: true,
    get() {
      isGetterCalled = true;
      return acceptance.resultId;
    },
  });
  assert.equal(decodeProjectResultAcceptance(accessor), null);
  assert.equal(isGetterCalled, false);
  assert.equal(decodeProjectResultAcceptance(new Proxy(acceptance, {})), null);
  assert.equal(acceptance.settlementGeneration, 7);
  const hostValue = Object.getOwnPropertyDescriptor(Object.prototype, "value");
  const helperSource = fs.readFileSync(
    new URL("../../../src/state/validation.ts", import.meta.url),
    "utf8",
  );
  const executable = [
    "isPlainRecord",
    "isDataDescriptor",
    "snapshotPlainRecord",
    "snapshotPlainArray",
  ]
    .map((name) => sourceDeclaration(helperSource, name))
    .join("\n");
  const stimulus = `
    const accessor = Object.defineProperty({}, "resultId", { get: undefined, set: undefined, enumerable: true });
    let getterCalls = 0;
    const getterInput = Object.defineProperty({}, "resultId", { get() { getterCalls++; return "valid"; }, enumerable: true });
    const originalValue = Object.getOwnPropertyDescriptor(Object.prototype, "value");
    try {
      Object.defineProperty(Object.prototype, "value", { value: "inherited", configurable: true });
      const keys = new Set(["resultId"]);
      JSON.stringify({
        accessorRejected: snapshotPlainRecord(accessor, keys) === null,
        getterRejected: snapshotPlainRecord(getterInput, keys) === null,
        dataAccepted: snapshotPlainRecord({ resultId: "valid" }, keys)?.resultId === "valid",
        getterCalls,
      });
    } finally {
      delete Object.prototype.value;
      if (originalValue) Object.defineProperty(Object.prototype, "value", originalValue);
    }
  `;
  const observed = JSON.parse(
    vm.runInNewContext(
      `${executable}\n${stimulus}`,
      { utilTypes },
      { timeout: 1000 },
    ),
  );
  assert.deepEqual(observed, {
    accessorRejected: true,
    getterRejected: true,
    dataAccepted: true,
    getterCalls: 0,
  });
  const predicate = 'Object.hasOwn(descriptor, "value")';
  assert.equal(executable.split(predicate).length, 2);
  const mutant = executable.replace(predicate, '"value" in descriptor');
  const mutantObserved = JSON.parse(
    vm.runInNewContext(
      `${mutant}\n${stimulus}`,
      { utilTypes },
      { timeout: 1000 },
    ),
  );
  assert.equal(mutantObserved.accessorRejected, false);
  assert.deepEqual(
    Object.getOwnPropertyDescriptor(Object.prototype, "value"),
    hostValue,
  );
});
