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
import { createStartResult } from "../../src/attempt/result.ts";

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
 * 解決済み計画を同じ実行Ownerへ渡し、終了通知で元結果を変更しない。
 * @responsibility 上位の選定・準備を実行Factoryに戻さない。
 * @trace ERB-IT-004
 * @precondition 有限Runtime代役のみ。
 * @stimulus 開始拒否／成功を返す。
 * @observation 元計画・管理参照・Control・最終結果の同一性。
 * @oracle 準備callbackは呼ばず、完了結果をコピーしない。
 * @cleanup 合成Promiseの完了だけを待つ。
 */
test("公開開始は解決済み計画を渡し同じ終了結果を通知する", async () => {
  const source = readFileSync(
    new URL("../../src/attempt/execute.ts", import.meta.url),
    "utf8",
  );
  for (const mode of ["blocked", "started"]) {
    const plan = {},
      management = {},
      control = {},
      terminal = {};
    const callbacks = Object.freeze({ onCompleted: () => undefined });
    const reference = Object.freeze({
      recoveryId: `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`,
      recoveryCapability: Object.freeze({}),
    });
    const random = { randomBytes: () => Buffer.alloc(1) };
    const request = {};
    const prepared = plan;
    const started =
      mode === "blocked"
        ? createStartResult({ status: "blocked", reason: "synthetic" })
        : createStartResult({
            status: "started",
            controlCapability: control,
            completion: Promise.resolve(terminal) as never,
            operationId: "OP-123456",
            recoveryId: "exact",
          });
    const create = runInNewContext(
      `${sourceDeclaration(source, "createExecutor")}\ncreateExecutor`,
      {
        Object,
        createStartResult,
        utilTypes: { isPromise: () => false },
        createDockerIsolationRuntime: () => ({ acquireHomeLease: () => null }),
        bindIsolationRuntime: () => ({}),
        prepareAttempt: (source: unknown, input: unknown) => {
          assert.strictEqual(source, random);
          assert.strictEqual(input, request);
          return prepared;
        },
        start: (
          state: { callbacks: unknown },
          p: unknown,
          m: unknown,
          suppliedReference: unknown,
        ) => {
          assert.strictEqual(p, plan);
          assert.strictEqual(m, management);
          assert.strictEqual(suppliedReference, reference);
          assert.strictEqual(state.callbacks, callbacks);
          return started;
        },
        cancel: () => {},
        abandon: () => false,
      },
    );
    const executor = create(
      request,
      {
        borrowPaths: () => {
          throw Error("unexpected_path_borrow");
        },
        inspectReceipts: () => null,
      },
      random,
    );
    assert.equal("prepare" in executor, false);
    assert.equal(Object.isFrozen(executor.recordProjection), true);
    const result = executor.start(management, reference, callbacks);
    assert.equal(Object.hasOwn(result, "selectedModel"), false);
    assert.equal(Object.hasOwn(result, "preparationFailed"), false);
    if (result.status === "started") {
      assert.strictEqual(result.controlCapability, control);
      assert.strictEqual(await result.completion, terminal);
    } else assert.strictEqual(result, started);
  }
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
 * 五つの物理清掃条件と保存受理の全組合せを照合する。
 * @responsibility 一条件の欠測も成功や結果公開へ丸めないことを反証する。
 * @trace ERB-IT-004
 * @precondition 実Controllerの純粋な終端投影宣言だけを構文木から抽出する。
 * @stimulus 64組合せとcompleted／blocked／cancelledを渡す。
 * @observation 状態、元回復参照、本文とHash、回復Capabilityを照合する。
 * @oracle 全条件成立時だけ清掃確定し、本文公開はさらにcompletedを要する。
 * @cleanup N/A: 実Process、保存、Dockerを操作しない。
 * @boundary ERB-IT-004=Direct Boundary: Controller終端の相関不変条件。
 */
test("終端結果は技術清掃と上位保存の全64組合せを区別し、上位判断を所有しない", () => {
  const source = readFileSync(
    new URL("../../src/attempt/result.ts", import.meta.url),
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
    "homeLeaseReleased",
    "recoveryCompleted",
  ] as const;
  const value = Object.freeze({
    decision: "changes_requested",
    findingCount: 1,
  });
  const findings = Object.freeze([{ message: "Synthetic finding." }]);
  const capability = Object.freeze({});
  for (let bits = 0; bits < 64; bits++) {
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
      const clean = (bits & 23) === 23;
      assert.equal(result.cleanupConfirmed, clean);
      assert.equal(result.status, clean ? status : "blocked");
      assert.equal(result.recoveryId, "exact-recovery");
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
      assert.equal(result.recoveryFinalizationCapability, undefined);
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
