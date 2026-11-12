/**
 * coordinator:unit:verification-safetyの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:verification-safetyが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope verification、result、safety
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { types } from "node:util";
import test from "node:test";
import fs from "node:fs";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { snapshotPlainArray } from "../../src/input/snapshot.ts";
import { createCandidateValidationFailureDiagnostic } from "../../src/execution/result.ts";

/**
 * 本番と検証Toolの診断が旧件数を欠測へ変換しない。
 * @responsibility 同じPath・所見の件数と相関を末尾まで保持する。
 * @trace AIT-UT-005
 * @precondition 実Source宣言を局所評価し実行基盤は使わない。
 * @stimulus 1001Pathの一致・末尾差・不正と65所見・不正数値を渡す。
 * @observation 診断件数・一致判定と固定Fixture条件。
 * @oracle 正常量は保持、不正は欠測、単一File以外はmetadata_invalid。
 * @cleanup N/A: メモリ内だけ。
 * @boundary 診断への投影。実AI・Docker・保存なし。
 */
test("候補拒否と検証Toolの診断は旧件数を欠測化しない", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/controller.ts", import.meta.url),
    "utf8",
  );
  const notices: Record<string, unknown>[] = [];
  const report = runInNewContext(
    `${["objectCapability", "samePaths", "reportCandidateValidationFailure"]
      .map((name) => sourceDeclaration(source, name))
      .join("\n")};reportCandidateValidationFailure`,
    {
      Object,
      Array,
      Buffer,
      snapshotPlainArray,
      createCandidateValidationFailureDiagnostic: (
        raw: Parameters<typeof createCandidateValidationFailureDiagnostic>[0],
      ) => createCandidateValidationFailureDiagnostic({ ...raw }),
      reportTaskDiagnostic: (
        _state: unknown,
        notice: Record<string, unknown>,
      ) => notices.push(notice),
    },
  ) as (...args: unknown[]) => void;
  const paths = Array.from({ length: 1001 }, (_, i) => `src/f-${i}.ts`);
  const candidate = {
    status: "candidate",
    candidateCapability: {},
    changedPaths: paths,
  };
  for (const [reported, expected] of [
    [paths, true],
    [[...paths.slice(0, -1), "src/other.ts"], false],
    [[null], null],
  ] as const) {
    report({}, { operationId: "synthetic" }, null, "codex", 0, candidate, {
      changedPaths: reported,
    });
    const diagnostic = notices.at(-1)?.diagnostic as Record<string, unknown>;
    assert.equal(diagnostic.candidatePathCount, 1001);
    assert.equal(diagnostic.reportedPathCount, expected === null ? null : 1001);
    assert.equal(diagnostic.pathsMatch, expected);
  }
  const general = fs.readFileSync(
    new URL("../../scripts/verify-general-task.ts", import.meta.url),
    "utf8",
  );
  const project = runInNewContext(
    `${[
      "TARGET_PATH",
      "BASE_CONTENT",
      "EXPECTED_CONTENT",
      "plainRecord",
      "sha256",
      "reviewerDiagnosisProjection",
    ]
      .map((name) => sourceDeclaration(general, name))
      .join("\n")};reviewerDiagnosisProjection`,
    { Object, Array, Reflect, Buffer, types, createHash, snapshotPlainArray },
  ) as (raw: unknown) => Record<string, unknown>;
  for (const count of [64, 65]) {
    assert.equal(
      project({
        reviewerResult: { decision: "changes_requested", findingCount: count },
      }).reviewerFindingCount,
      count,
    );
  }
  for (const count of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(
      createCandidateValidationFailureDiagnostic({
        captureStatus: "captured",
        pathsMatch: true,
        candidatePathCount: count,
        reportedPathCount: count,
        providerExecutionObservation: null,
      }),
      null,
    );
    assert.equal(
      project({
        reviewerResult: { decision: "changes_requested", findingCount: count },
      }).reviewerFindingCount,
      null,
    );
  }
  assert.equal(
    project({ reviewerProjectionEvidence: { files: [{}, {}] } })
      .reviewerProjectedTargetClassification,
    "metadata_invalid",
  );
});

import {
  evaluateVerificationSafetyObservation,
  salvageVerificationRecoveryPair,
  salvageVerificationNullableRecovery,
} from "../../scripts/verification-safety.ts";

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
 * 検証レポートへ回復IDの全量を保持する。
 * @responsibility 本番結果を検証Readerと複数結果集約で切り詰めない。
 * @trace AIT-UT-005
 * @precondition 合成した257件の正規Docker回復IDだけを使う。
 * @stimulus 全量・二分した結果と重複／単数相関不正を渡す。
 * @observation 厳密観測、救済読取りと集約の全ID・曖昧性。
 * @oracle 正常値は全文を保持し、不正相関は不明のまま維持する。
 * @cleanup N/A: Source宣言を局所評価するだけで外部実行しない。
 * @boundary 実検証Reader／集約関数。実AI・Dockerを使用しない。
 */
test("検証Readerと集約は257件の回復IDを容量だけで拒否・切詰めしない", () => {
  const ids = Array.from(
    { length: 257 },
    (_, index) =>
      `docker-task.${index.toString(16).padStart(64, "0")}.${"2".repeat(64)}.${"3".repeat(64)}`,
  );
  const input = exact({
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    dockerRecoveryIds: ids,
  });
  const observed = evaluateVerificationSafetyObservation(input, SCHEMA);
  assert.equal(observed.status, "exact");
  assert.deepEqual(observed.recoveryIds, ids);
  const pair = SCHEMA.recoveryPairs[1];
  assert.ok(pair);
  const salvaged = salvageVerificationRecoveryPair(input, pair);
  assert.equal(salvaged.ambiguous, false);
  assert.deepEqual(salvaged.plural, ids);
  assert.equal(
    salvageVerificationRecoveryPair(
      { ...input, dockerRecoveryIds: [...ids, ids[0]] },
      pair,
    ).ambiguous,
    true,
  );
  assert.equal(
    salvageVerificationRecoveryPair(
      { ...input, dockerRecoveryId: ids[0] },
      pair,
    ).ambiguous,
    true,
  );
  const generalSource = fs.readFileSync(
    new URL("../../scripts/verify-general-task.ts", import.meta.url),
    "utf8",
  );
  const collect = runInNewContext(
    sourceDeclaration(generalSource, "collectRecoveryIds") +
      ";collectRecoveryIds",
    {
      Object,
      Set,
      salvageVerificationRecoveryPair,
      salvageVerificationNullableRecovery,
    },
  ) as (
    values: readonly unknown[],
    singular: string,
    kind: string,
    plural: string,
  ) => { ids: readonly string[]; ambiguous: boolean };
  const rows = [ids.slice(0, 129), ids.slice(129)].map((values) => ({
    ...input,
    dockerRecoveryIds: values,
    candidateRecoveryId: null,
    candidateRecoveryIds: [],
    candidateStoreRecoveryId: null,
    candidateStoreRecoveryIds: [],
  }));
  const collected = collect(
    rows,
    "dockerRecoveryId",
    "docker",
    "dockerRecoveryIds",
  );
  assert.equal(collected.ambiguous, false);
  assert.deepEqual(Array.from(collected.ids), ids);
  const routeSource = fs.readFileSync(
    new URL("../../scripts/verify-route-matrix.ts", import.meta.url),
    "utf8",
  );
  const aggregate = runInNewContext(
    ["RECOVERY_PAIRS", "sanitizedRouteRecovery", "aggregateRouteRecovery"]
      .map((name) => sourceDeclaration(routeSource, name))
      .join("\n") + ";aggregateRouteRecovery",
    { Object, Set, salvageVerificationRecoveryPair },
  ) as (values: readonly unknown[]) => {
    dockerRecoveryIds: readonly string[];
    recoveryIdentityAmbiguous: boolean;
  };
  const aggregated = aggregate(rows);
  assert.equal(aggregated.recoveryIdentityAmbiguous, false);
  assert.deepEqual(Array.from(aggregated.dockerRecoveryIds), ids);
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
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("安全観測はexact booleanとRecovery集合だけを確定する", () => {
  const none = evaluateVerificationSafetyObservation(exact(), SCHEMA);
  assert.equal(none.status, "exact");
  assert.deepEqual(none.recoveryIds, []);

  const recovery = evaluateVerificationSafetyObservation(
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
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
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
        evaluateVerificationSafetyObservation(candidate, SCHEMA).status,
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
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("cleanup・manual recovery・effect unknownの相関矛盾を拒否する", () => {
  for (const candidate of [
    exact({ cleanupConfirmed: false }),
    exact({ hostRecoveryId: hostA }),
    exact({ dockerRecoveryIds: Object.freeze([dockerA]) }),
    exact({ effectStateUnknown: true, manualRecoveryRequired: true }),
  ]) {
    assert.equal(
      evaluateVerificationSafetyObservation(candidate, SCHEMA).status,
      "unknown",
    );
  }

  const childPoison = evaluateVerificationSafetyObservation(
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
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
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
      evaluateVerificationSafetyObservation(
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
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
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
      evaluateVerificationSafetyObservation(
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
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
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
      evaluateVerificationSafetyObservation(candidate, SCHEMA).status,
      "unknown",
    );
  }
});

/**
 * partial salvageはown-dataのcanonical IDだけを保持することを検証する。
 *
 * @responsibility partial salvageはown-dataのcanonical IDだけを保持する条件の合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus partial salvageへ正規IDと不正な値を混在させる。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("partial salvageはown-dataのcanonical IDだけを保持する", () => {
  const mixed = salvageVerificationRecoveryPair(
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
  const partial = salvageVerificationRecoveryPair(accessor, {
    singularField: "hostRecoveryId",
    pluralField: "hostRecoveryIds",
    kind: "host",
  });
  assert.equal(partial.singular, hostB);
  assert.deepEqual(partial.plural, [hostB]);
  assert.equal(partial.ambiguous, true);
});
