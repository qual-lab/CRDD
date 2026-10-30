/**
 * Controller終端の状態・清掃・結果公開の共同条件を反証する。
 * @packageDocumentation
 * @responsibility 元回復参照と五清掃条件の終端投影を検査する。
 * @trace ERB-IT-004
 * @level UT
 * @scope 実宣言の純粋な値投影。実Process・Docker・保存なし。
 * @boundary Executor Controllerの終端結果。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import type { StartResult } from "../../src/index.ts";
import { createPreparationFailure } from "../../src/attempt/preparation.ts";
import {
  createStartResult,
  createCompletionResult,
} from "../../src/result/attempt.ts";

/**
 * 選択三項目の全存在／全不存在を型検査で固定する。
 * @responsibility 実Factoryが作らない部分的な選択情報を公開型が許容しない。
 * @trace ERB-IT-004
 * @precondition 型検査ではexpect-errorを必ず消費し、実行時は局所値だけを扱う。
 * @stimulus 全存在・全不存在と、六つの部分集合。
 * @observation 正例の型成立と、各部分集合のコンパイル拒否。
 * @oracle 一項目又は二項目だけの選択値はStartResultにならない。
 * @cleanup N/A: 外部資源なし。
 */
test("選択三項目の部分集合を明示結果型が拒否する", () => {
  const base = {
    status: "blocked" as const,
    reason: "synthetic",
    controlCapability: null,
    completion: null,
    operationId: null,
    recoveryId: null,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    dockerEffectStarted: false as const,
    providerRequestStarted: false as const,
    normalizedResult: null,
    rawOutputReported: false as const,
    untrustedProviderTextReported: false as const,
    credentialAbsenceVerified: false as const,
    hostPathReported: false as const,
    proxyCredentialReported: false as const,
  };
  const absent: StartResult = base;
  const present: StartResult = {
    ...base,
    selectionNotice: null,
    selectedModel: null,
    selectedEffort: null,
  };
  // @ts-expect-error 選択の通知だけを持つ結果は契約外。
  const noticeOnly: StartResult = { ...base, selectionNotice: null };
  // @ts-expect-error 選択モデルだけを持つ結果は契約外。
  const modelOnly: StartResult = { ...base, selectedModel: null };
  // @ts-expect-error 推論強度だけを持つ結果は契約外。
  const effortOnly: StartResult = { ...base, selectedEffort: null };
  // @ts-expect-error 推論強度を欠く選択は契約外。
  const noEffort: StartResult = {
    ...base,
    selectionNotice: null,
    selectedModel: null,
  };
  // @ts-expect-error モデルを欠く選択は契約外。
  const noModel: StartResult = {
    ...base,
    selectionNotice: null,
    selectedEffort: null,
  };
  // @ts-expect-error 通知を欠く選択は契約外。
  const noNotice: StartResult = {
    ...base,
    selectedModel: null,
    selectedEffort: null,
  };
  assert.equal(Object.hasOwn(absent, "selectedModel"), false);
  assert.equal(Object.hasOwn(present, "selectedModel"), true);
  void [noticeOnly, modelOnly, effortOnly, noEffort, noModel, noNotice];
});

/**
 * 明示型の開始成功結果で、実行Ownerの参照を保持する。
 * @responsibility Factoryが制御やPromiseを生成し直さないことを検査する。
 * @trace ERB-IT-004
 * @precondition 合成のControlと未実行Promise。
 * @stimulus 開始成功と既存選択metadataを渡す。
 * @observation status、exact参照、固定field、凍結。
 * @oracle 同じControlとPromiseを返し、Provider開始・清掃完了を推定しない。
 * @cleanup N/A: 実行も外部資源も作らない。
 */
test("開始成功と拒否は同じFactoryから生成し元のControlとPromiseを保つ", () => {
  const control = Object.freeze({});
  const completion = Promise.resolve(null as never);
  const started: StartResult = createStartResult({
    status: "started",
    controlCapability: control,
    completion,
    operationId: "OP-123456",
    recoveryId: "exact-recovery",
    preparationFailed: false,
    selection: { notice: null, model: "synthetic", effort: null },
  });
  assert.equal(started.status, "started");
  assert.equal(started.controlCapability, control);
  assert.equal(started.completion, completion);
  assert.equal(started.providerRequestStarted, false);
  assert.equal(started.normalizedResult, null);
  assert.equal(started.selectedModel, "synthetic");
  assert.equal(Object.isFrozen(started), true);
  assert.equal(Object.hasOwn(started, "cleanupConfirmed"), false);
  const blocked: StartResult = createStartResult({
    status: "blocked",
    reason: "synthetic",
  });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.completion, null);
  assert.equal(Object.hasOwn(blocked, "selectedModel"), false);
});

/**
 * 実公開Factoryの四開始経路で項目の有無と正本参照を確認する。
 * @responsibility 準備内部結果の展開が開始結果へ戻らないことを反証する。
 * @trace ERB-IT-004
 * @precondition 実createExecutor宣言と有限の準備・実行代役。
 * @stimulus Provider不正、準備拒否、実行拒否、開始成功を渡す。
 * @observation 開始結果の全キー、準備表示・選択値、Control、完了通知。
 * @oracle 既存の選択値／null／省略を維持し、準備内部項目を搬送しない。
 * @cleanup 代役Promiseの完了を待つ。外部Process・保存・Dockerは使わない。
 */
test("公開開始の四経路は選択と準備失敗だけを搬送し内部項目を漏らさない", async () => {
  const source = readFileSync(
    new URL("../../src/attempt/preparation.ts", import.meta.url),
    "utf8",
  );
  const control = Object.freeze({});
  const completionResult = createCompletionResult({
    status: "blocked",
    reason: "provider_result_invalid",
    operationId: "OP-123456",
    selectionRecordId: "selection",
    recoveryId: "exact-recovery",
    providerRequestStarted: false,
    cancellationRequested: false,
    processTreeTerminationConfirmed: true,
    containersAbsent: true,
    networksAbsent: true,
    mountLeaseReleased: true,
    recoveryCompleted: true,
    resultSha256: null,
    resultBytes: 0,
    normalizedResult: null,
    subscriptionAuthConfirmed: false,
    recoveryFinalizationCapability: {},
  });
  const completion = Promise.resolve(completionResult);
  const common = [
    "status",
    "reason",
    "controlCapability",
    "completion",
    "operationId",
    "recoveryId",
    "dockerEffectStarted",
    "providerRequestStarted",
    "normalizedResult",
    "rawOutputReported",
    "untrustedProviderTextReported",
    "credentialAbsenceVerified",
    "hostPathReported",
    "proxyCredentialReported",
  ];
  const blockedKeys = [...common, "cleanupConfirmed", "manualRecoveryRequired"];
  const selectionKeys = ["selectionNotice", "selectedModel", "selectedEffort"];
  const preparedCapability = {};
  for (const mode of [
    "invalid_provider",
    "preparation_blocked",
    "runtime_blocked",
    "started",
  ] as const) {
    let notified: unknown = null;
    const create = runInNewContext(
      `${sourceDeclaration(source, "createExecutor")}\ncreateExecutor`,
      {
        createStartResult,
        utilTypes: { isPromise: () => false },
        createAttemptPreparation: () => ({
          consume: () => null,
          prepare: () =>
            mode === "preparation_blocked"
              ? createPreparationFailure("synthetic")
              : {
                  status: "prepared",
                  preparedCapability,
                  selectionNotice: "selected",
                  selectedModel: "synthetic",
                  selectedEffort: "medium",
                },
        }),
        createExecutionRuntime: () => ({
          start: () =>
            mode === "runtime_blocked"
              ? createStartResult({
                  status: "blocked",
                  reason: "synthetic",
                  cleanupConfirmed: true,
                })
              : createStartResult({
                  status: "started",
                  controlCapability: control,
                  completion,
                  operationId: "OP-123456",
                  recoveryId: "exact-recovery",
                }),
          cancel: () => undefined,
        }),
      },
    ) as (options: unknown) => {
      start: (
        provider: unknown,
        input: unknown,
        register: unknown,
      ) => StartResult;
    };
    const executor = create({
      onCompleted: (value: unknown) => {
        notified = value;
      },
    });
    const result = executor.start(
      mode === "invalid_provider" ? "invalid" : "codex",
      { managementCapability: {} },
      () => undefined,
    );
    const expectedKeys =
      mode === "started"
        ? [
            ...common,
            "normalizedResultReportedAfterCleanupOnly",
            "preparationFailed",
            ...selectionKeys,
          ]
        : [
            ...blockedKeys,
            "preparationFailed",
            ...(mode === "invalid_provider" ? [] : selectionKeys),
          ];
    assert.deepEqual(Reflect.ownKeys(result).sort(), expectedKeys.sort(), mode);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(
      result.preparationFailed,
      mode === "invalid_provider" || mode === "preparation_blocked",
    );
    assert.equal(
      Object.hasOwn(result, "selectedModel"),
      mode !== "invalid_provider",
    );
    if (mode === "preparation_blocked") {
      assert.equal(result.selectedModel, null);
      assert.equal(result.selectedEffort, null);
      assert.equal(result.selectionNotice, null);
    } else if (mode !== "invalid_provider") {
      assert.equal(result.selectedModel, "synthetic");
      assert.equal(result.selectedEffort, "medium");
      assert.equal(result.selectionNotice, "selected");
    }
    if (result.status === "started") {
      assert.equal(result.controlCapability, control);
      assert.equal(await result.completion, completionResult);
      assert.equal(notified, completionResult);
    }
  }
  const extra = {
    status: "blocked" as const,
    reason: "synthetic",
    preparedCapability: {},
    grantRef: "must_not_escape",
    selectionRecordId: "must_not_escape",
    runtimeAuthorityIssued: true,
  };
  const rejected = createStartResult(extra);
  assert.deepEqual(Reflect.ownKeys(rejected).sort(), blockedKeys.sort());
});

/**
 * 開始拒否の清掃・回復参照・下位義務を全組合せで照合する。
 * @responsibility Effect前拒否を清掃成功や回復不要と混同しない。
 * @trace ERB-IT-004
 * @precondition 合成のreasonと回復参照だけを使用する。
 * @stimulus 三条件の八組合せを渡す。
 * @observation 清掃・manualRecoveryRequired・元参照・非公開field。
 * @oracle 下位義務、清掃不明、回復参照ありのいずれでもmanualを維持する。
 * @cleanup N/A: 値生成だけ。
 * @boundary ERB-IT-004=Direct Boundary: 開始拒否結果。
 */
test("開始拒否は清掃と元回復参照と下位義務を独立に保持する", () => {
  for (const clean of [false, true])
    for (const id of [null, "exact-recovery"])
      for (const lowerManual of [false, true]) {
        const result = createStartResult({
          status: "blocked",
          reason: "synthetic",
          cleanupConfirmed: clean,
          recoveryId: id,
          manualRecoveryRequired: lowerManual,
        });
        assert.ok(result.status === "blocked");
        assert.equal(result.cleanupConfirmed, clean);
        assert.equal(result.recoveryId, id);
        assert.equal(
          result.manualRecoveryRequired,
          lowerManual || !clean || id !== null,
        );
        assert.equal(result.dockerEffectStarted, false);
        assert.equal(result.completion, null);
        assert.equal(result.normalizedResult, null);
      }
});

/**
 * 五つの清掃条件の全組合せと三終端状態を照合する。
 * @responsibility 一条件の欠測も成功や結果公開へ丸めないことを反証する。
 * @trace ERB-IT-004
 * @precondition 実Controllerの純粋な終端投影宣言だけを構文木から抽出する。
 * @stimulus 32組合せとcompleted／blocked／cancelledを渡す。
 * @observation 状態、元回復参照、本文とHash、回復Capabilityを照合する。
 * @oracle 全条件成立時だけ清掃確定し、本文公開はさらにcompletedを要する。
 * @cleanup N/A: 実Process、保存、Dockerを操作しない。
 * @boundary ERB-IT-004=Direct Boundary: Controller終端の相関不変条件。
 */
test("終端結果は五清掃条件の全32組合せと三状態を混同しない", () => {
  const source = readFileSync(
    new URL("../../src/result/attempt.ts", import.meta.url),
    "utf8",
  );
  const project = runInNewContext(
    `${sourceDeclaration(source, "createCompletionResult")}\ncreateCompletionResult`,
  ) as (...args: unknown[]) => Record<string, unknown>;
  const keys = [
    "processTreeTerminationConfirmed",
    "containersAbsent",
    "networksAbsent",
    "mountLeaseReleased",
    "recoveryCompleted",
  ] as const;
  const value = Object.freeze({
    decision: "changes_requested",
    findingCount: 1,
  });
  const findings = Object.freeze([{ message: "Synthetic finding." }]);
  const capability = Object.freeze({});
  for (let bits = 0; bits < 32; bits++) {
    const flags = Object.fromEntries(
      keys.map((key, index) => [key, !!(bits & (1 << index))]),
    );
    for (const status of ["completed", "blocked", "cancelled"] as const) {
      const result = project({
        status,
        reason: null,
        operationId: "OP-000001",
        selectionRecordId: "selection",
        recoveryId: "exact-recovery",
        ...flags,
        providerRequestStarted: true,
        cancellationRequested: status === "cancelled",
        resultSha256: "hash",
        resultBytes: 4,
        normalizedResult: value,
        reviewFindings: findings,
        providerExecutionObservation: value,
        providerTurnObservation: value,
        subscriptionAuthConfirmed: true,
        recoveryFinalizationCapability: capability,
      });
      const clean = bits === 31;
      assert.equal(result.cleanupConfirmed, clean);
      assert.equal(result.status, clean ? status : "blocked");
      assert.equal(result.recoveryId, clean ? null : "exact-recovery");
      assert.equal(result.manualRecoveryRequired, !clean);
      assert.equal(
        result.normalizedResult,
        clean && status === "completed" ? value : null,
      );
      assert.equal(
        result.resultSha256,
        clean && status === "completed" ? "hash" : null,
      );
      assert.equal(result.resultBytes, clean && status === "completed" ? 4 : 0);
      assert.equal(
        result.recoveryFinalizationCapability,
        clean ? capability : null,
      );
      assert.equal(
        result.providerExecutionObservation,
        clean && status === "completed" ? value : null,
      );
      assert.equal(
        result.providerTurnObservation,
        clean && status === "completed" ? value : null,
      );
      assert.equal(
        result.reviewFindings,
        clean && status === "completed" ? findings : null,
      );
      assert.equal("remediationCapability" in result, false);
      assert.equal(result.rawOutputReported, false);
    }
  }
});
