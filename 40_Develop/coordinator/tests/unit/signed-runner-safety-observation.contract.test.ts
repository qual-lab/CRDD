/**
 * coordinator:unit:signed-runner-safety-observationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:signed-runner-safety-observationが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope signed、runner、safety、observation
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSignedRunnerSafetyObservation,
  salvageSignedRunnerRecoveryPair,
} from "../../src/security/signed-runner-safety-observation.ts";

const hostA = `host.crdd-coordinator-doctor-a.12345678-1234-4234-8234-123456789abc.${"a".repeat(64)}`;
const hostB = `host.crdd-coordinator-doctor-b.12345678-1234-4234-8234-123456789abc.${"b".repeat(64)}`;
const dockerA = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;

const SCHEMA = Object.freeze({
  booleanFields: Object.freeze([
    "cleanupConfirmed",
    "manualRecoveryRequired",
    "processRestartRequired",
    "effectStateUnknown",
  ]),
  nullableRecoveryFields: Object.freeze([]),
  recoveryPairs: Object.freeze([
    Object.freeze({
      singularField: "hostRecoveryId",
      pluralField: "hostRecoveryIds",
      kind: "host" as const,
    }),
    Object.freeze({
      singularField: "dockerRecoveryId",
      pluralField: "dockerRecoveryIds",
      kind: "docker" as const,
    }),
  ]),
  effectUnknownField: "effectStateUnknown",
});

/**
 * exactのTest準備責務を実行する。
 *
 * @responsibility exactがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus exactを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
function exact(overrides: Readonly<Record<string, unknown>> = {}) {
  return Object.freeze({
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
    effectStateUnknown: false,
    hostRecoveryId: null,
    dockerRecoveryId: null,
    hostRecoveryIds: Object.freeze([]),
    dockerRecoveryIds: Object.freeze([]),
    ...overrides,
  });
}

/**
 * 安全観測はexact booleanとRecovery集合だけを確定するを検証する。
 *
 * @responsibility 安全観測はexact booleanとRecovery集合だけを確定するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 安全観測はexact booleanとRecovery集合だけを確定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("安全観測はexact booleanとRecovery集合だけを確定する", () => {
  const none = evaluateSignedRunnerSafetyObservation(exact(), SCHEMA);
  assert.equal(none.status, "exact");
  assert.deepEqual(none.recoveryIds, []);

  const recovery = evaluateSignedRunnerSafetyObservation(
    exact({
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      hostRecoveryId: null,
      hostRecoveryIds: Object.freeze([hostA, hostB]),
      dockerRecoveryId: dockerA,
      dockerRecoveryIds: Object.freeze([dockerA]),
    }),
    SCHEMA,
  );
  assert.equal(recovery.status, "exact");
  assert.deepEqual(recovery.recoveryIds, [hostA, hostB, dockerA]);
});

/**
 * booleanの欠落・null・文字列は安全状態不明に閉じるを検証する。
 *
 * @responsibility booleanの欠落・null・文字列は安全状態不明に閉じるの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus booleanの欠落・null・文字列は安全状態不明に閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("booleanの欠落・null・文字列は安全状態不明に閉じる", () => {
  for (const field of SCHEMA.booleanFields) {
    const missing = { ...exact() } as Record<string, unknown>;
    delete missing[field];
    for (const candidate of [
      missing,
      { ...exact(), [field]: null },
      { ...exact(), [field]: "false" },
    ]) {
      assert.equal(
        evaluateSignedRunnerSafetyObservation(candidate, SCHEMA).status,
        "unknown",
        field,
      );
    }
  }
});

/**
 * cleanup・manual recovery・effect unknownの相関矛盾を拒否するを検証する。
 *
 * @responsibility cleanup・manual recovery・effect unknownの相関矛盾を拒否するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cleanup・manual recovery・effect unknownの相関矛盾を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("cleanup・manual recovery・effect unknownの相関矛盾を拒否する", () => {
  for (const candidate of [
    exact({ cleanupConfirmed: false }),
    exact({ hostRecoveryId: hostA }),
    exact({ dockerRecoveryIds: Object.freeze([dockerA]) }),
    exact({ effectStateUnknown: true, manualRecoveryRequired: true }),
  ]) {
    assert.equal(
      evaluateSignedRunnerSafetyObservation(candidate, SCHEMA).status,
      "unknown",
    );
  }

  const childPoison = evaluateSignedRunnerSafetyObservation(
    exact({ processRestartRequired: true }),
    SCHEMA,
  );
  assert.equal(childPoison.status, "exact");
  assert.equal(childPoison.booleans?.processRestartRequired, true);
});

/**
 * Recovery配列の疎・accessor・Proxy・重複・非文字列を拒否するを検証する。
 *
 * @responsibility Recovery配列の疎・accessor・Proxy・重複・非文字列を拒否するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recovery配列の疎・accessor・Proxy・重複・非文字列を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Recovery配列の疎・accessor・Proxy・重複・非文字列を拒否する", () => {
  const sparseItems = Array<string>(1);
  const accessorItems: string[] = [];
  Object.defineProperty(accessorItems, "0", {
    enumerable: true,
    configurable: true,
    get: () => dockerA,
  });
  accessorItems.length = 1;
  const proxyItems = new Proxy([dockerA], {});
  for (const valueItems of [
    sparseItems,
    accessorItems,
    proxyItems,
    [dockerA, dockerA],
    [1],
  ]) {
    assert.equal(
      evaluateSignedRunnerSafetyObservation(
        exact({
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          dockerRecoveryIds: valueItems,
        }),
        SCHEMA,
      ).status,
      "unknown",
    );
  }
});

/**
 * Recovery pairは0件・1件・N件のcanonical関係だけを受理するを検証する。
 *
 * @responsibility Recovery pairは0件・1件・N件のcanonical関係だけを受理するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recovery pairは0件・1件・N件のcanonical関係だけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Recovery pairは0件・1件・N件のcanonical関係だけを受理する", () => {
  for (const candidate of [
    exact({ hostRecoveryId: hostA, hostRecoveryIds: Object.freeze([]) }),
    exact({
      hostRecoveryId: hostA,
      hostRecoveryIds: Object.freeze([hostB]),
    }),
    exact({
      hostRecoveryId: hostA,
      hostRecoveryIds: Object.freeze([hostA, hostB]),
    }),
    exact({
      hostRecoveryId: null,
      hostRecoveryIds: Object.freeze([hostA]),
    }),
  ]) {
    assert.equal(
      evaluateSignedRunnerSafetyObservation(
        Object.freeze({
          ...candidate,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        }),
        SCHEMA,
      ).status,
      "unknown",
    );
  }
});

/**
 * Recordのgetter・Proxy・独自prototypeを観測済みにしないを検証する。
 *
 * @responsibility Recordのgetter・Proxy・独自prototypeを観測済みにしないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recordのgetter・Proxy・独自prototypeを観測済みにしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Recordのgetter・Proxy・独自prototypeを観測済みにしない", () => {
  const getter = { ...exact() } as Record<string, unknown>;
  Object.defineProperty(getter, "cleanupConfirmed", {
    enumerable: true,
    get: () => true,
  });
  for (const candidate of [
    getter,
    new Proxy(exact(), {}),
    Object.assign(Object.create({ inherited: true }), exact()),
  ]) {
    assert.equal(
      evaluateSignedRunnerSafetyObservation(candidate, SCHEMA).status,
      "unknown",
    );
  }
});

/**
 * partial salvageはown-dataのcanonical IDだけをboundedに保持するを検証する。
 *
 * @responsibility partial salvageはown-dataのcanonical IDだけをboundedに保持するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus partial salvageはown-dataのcanonical IDだけをboundedに保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("partial salvageはown-dataのcanonical IDだけをboundedに保持する", () => {
  const mixed = salvageSignedRunnerRecoveryPair(
    Object.freeze({
      hostRecoveryId: hostA,
      hostRecoveryIds: Object.freeze([hostA, "x".repeat(1_025)]),
    }),
    Object.freeze({
      singularField: "hostRecoveryId",
      pluralField: "hostRecoveryIds",
      kind: "host" as const,
    }),
  );
  assert.equal(mixed.singular, hostA);
  assert.deepEqual(mixed.plural, [hostA]);
  assert.equal(mixed.ambiguous, true);

  const accessor = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(accessor, "hostRecoveryId", {
    enumerable: true,
    get: () => hostA,
  });
  Object.defineProperty(accessor, "hostRecoveryIds", {
    enumerable: true,
    value: Object.freeze([hostB]),
  });
  const partial = salvageSignedRunnerRecoveryPair(accessor, {
    singularField: "hostRecoveryId",
    pluralField: "hostRecoveryIds",
    kind: "host",
  });
  assert.equal(partial.singular, hostB);
  assert.deepEqual(partial.plural, [hostB]);
  assert.equal(partial.ambiguous, true);
});
