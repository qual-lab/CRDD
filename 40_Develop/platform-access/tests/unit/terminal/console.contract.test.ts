/**
 * 固定OS端末の取得・回収の技術反証。
 * @packageDocumentation
 * @responsibility callback開始・完了待ち・全close試行と結果相関を検証する。
 * @trace EST-UT-016
 * @level UT
 * @scope terminal、console、cleanup
 * @boundary EST-UT-016=Unit: 合成Adapter。実端末・同意・上位停止は対象外。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  withInteractiveConsoleOutcomeUsingAdapter,
  withInteractiveConsoleAsyncOutcomeUsingAdapter,
} from "../../../src/terminal/console.ts";

/**
 * Unit内だけで同期技術結果を従来の値へ投影する。
 * @responsibility 既存Boolean／nullの反証を維持する試験補助。
 * @trace EST-UT-016
 * @precondition 合成Adapterを渡す。
 * @stimulus 同期Outcomeを取得する。
 * @observation completedの場合だけvalueを返す。
 * @oracle 呼出し側のassertionで確認する。
 * @cleanup 下位の合成closeを観測する。
 * @boundary EST-UT-016=Unit: 同一Packageの合成Adapter。
 */
function withInteractiveConsoleUsingAdapter(
  ...args: Parameters<typeof withInteractiveConsoleOutcomeUsingAdapter>
) {
  const outcome = withInteractiveConsoleOutcomeUsingAdapter(...args);
  return outcome.status === "completed" ? outcome.value : null;
}
/**
 * Unit内だけで非同期技術結果を従来の値へ投影する。
 * @responsibility callbackの完了待ちを含む試験補助。
 * @trace EST-UT-016
 * @precondition 合成Adapterを渡す。
 * @stimulus 非同期Outcomeを待機する。
 * @observation completedの場合だけvalueを返す。
 * @oracle 呼出し側のassertionで確認する。
 * @cleanup 下位の合成closeを観測する。
 * @boundary EST-UT-016=Unit: 同一Packageの合成Adapter。
 */
async function withInteractiveConsoleAsyncUsingAdapter(
  ...args: Parameters<typeof withInteractiveConsoleAsyncOutcomeUsingAdapter>
) {
  const outcome = await withInteractiveConsoleAsyncOutcomeUsingAdapter(...args);
  return outcome.status === "completed" ? outcome.value : null;
}

/**
 * resolveDeferredBooleanのTest準備責務を実行する。
 *
 * @responsibility resolveDeferredBooleanがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-UT-016
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus resolveDeferredBooleanを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-UT-016=Unit: PA内の合成Adapter→取得・回収の技術結果
 */
function resolveDeferredBoolean(resolver: unknown, isResolved: boolean) {
  assert.equal(typeof resolver, "function");
  (resolver as (isSuccessful: boolean) => void)(isResolved);
}

/**
 * Console adapterは回収不明でも技術結果を保持するを検証する。
 *
 * @responsibility Console adapterは回収不明でも技術結果を保持するの合否判定を所有する。
 * @trace EST-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Console adapterは回収不明でも技術結果を保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-UT-016=Unit: PA内の合成Adapter→取得・回収の技術結果
 */
test("Console adapterは回収不明でも技術結果を保持する", async () => {
  const syncOutcome = withInteractiveConsoleOutcomeUsingAdapter(
    "win32",
    Object.freeze({
      open: (device: string) => (device.endsWith("CONIN$") ? 11 : 12),
      close: () => {
        throw new Error("fixture_close_failed");
      },
    }),
    () => "candidate",
  );
  assert.deepEqual(syncOutcome, {
    status: "cleanup_unknown",
    value: "candidate",
  });
  const asyncOutcome = await withInteractiveConsoleAsyncOutcomeUsingAdapter(
    "win32",
    Object.freeze({
      open: (device: string) => (device.endsWith("CONIN$") ? 11 : 12),
      close: () => {
        throw new Error("fixture_close_failed");
      },
    }),
    async () => Promise.resolve("candidate"),
  );
  assert.deepEqual(asyncOutcome, {
    status: "cleanup_unknown",
    value: "candidate",
  });
});

/**
 * Console非同期所有はoperationと全close失敗を構造化するを検証する。
 *
 * @responsibility Console非同期所有はoperationと全close失敗を構造化するの合否判定を所有する。
 * @trace EST-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Console非同期所有はoperationと全close失敗を構造化するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-UT-016=Unit: PA内の合成Adapter→取得・回収の技術結果
 */
test("Console非同期所有はoperationと全close失敗を構造化する", async () => {
  const closedDescriptors: number[] = [];
  const cleanupUnknown = await withInteractiveConsoleAsyncOutcomeUsingAdapter(
    "win32",
    Object.freeze({
      open: (_name: string, flags: "r" | "r+" | "w") => (flags === "r" ? 1 : 2),
      close: (descriptor: number) => {
        closedDescriptors.push(descriptor);
        if (descriptor === 1) throw new Error("fixture_close_failed");
      },
      validate: () => true,
    }),
    async () => "completed",
  );
  assert.deepEqual(cleanupUnknown, {
    status: "cleanup_unknown",
    value: "completed",
  });
  assert.deepEqual(closedDescriptors, [1, 2]);

  const operationFailed = await withInteractiveConsoleAsyncOutcomeUsingAdapter(
    "win32",
    Object.freeze({
      open: (_name: string, flags: "r" | "r+" | "w") => (flags === "r" ? 1 : 2),
      close: () => undefined,
      validate: () => true,
    }),
    async () => {
      throw new Error("fixture_operation_failed");
    },
  );
  assert.deepEqual(operationFailed, {
    status: "operation_failed",
    value: null,
  });

  for (const validation of [
    () => false,
    () => {
      throw new Error("fixture_validation_failed");
    },
  ]) {
    const validationClosedDescriptors: number[] = [];
    let operationCount = 0;
    const unavailable = await withInteractiveConsoleAsyncOutcomeUsingAdapter(
      "win32",
      Object.freeze({
        open: (_name: string, flags: "r" | "r+" | "w") =>
          flags === "r" ? 1 : 2,
        close: (descriptor: number) => {
          validationClosedDescriptors.push(descriptor);
        },
        validate: validation,
      }),
      async () => {
        operationCount += 1;
        return "unexpected";
      },
    );
    assert.deepEqual(unavailable, { status: "unavailable", value: null });
    assert.equal(operationCount, 0);
    assert.deepEqual(validationClosedDescriptors, [1, 2]);
  }
});

/**
 * 対話ConsoleのOS device openと全失敗位置を一つのprimitiveで閉じるを検証する。
 *
 * @responsibility 対話ConsoleのOS device openと全失敗位置を一つのprimitiveで閉じるの合否判定を所有する。
 * @trace EST-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 対話ConsoleのOS device openと全失敗位置を一つのprimitiveで閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-UT-016=Unit: PA内の合成Adapter→取得・回収の技術結果
 */
test("対話ConsoleのOS device openと全失敗位置を一つのprimitiveで閉じる", async () => {
  /**
   * scenarioのTest準備責務を実行する。
   *
   * @responsibility scenarioがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace EST-UT-016
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus scenarioを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary EST-UT-016=Unit: PA内の合成Adapter→取得・回収の技術結果
   */
  function scenario(
    options: { failOpenAt?: number; failClose?: ReadonlySet<number> } = {},
  ) {
    const deviceOpenRecords: Array<Readonly<[string, "r" | "r+" | "w"]>> = [];
    const closedDescriptors: number[] = [];
    return {
      deviceOpenRecords,
      closedDescriptors,
      adapter: Object.freeze({
        open: (device: string, flags: "r" | "r+" | "w") => {
          deviceOpenRecords.push(Object.freeze([device, flags]));
          if (deviceOpenRecords.length === options.failOpenAt) {
            throw new Error("open failed");
          }
          return 10 + deviceOpenRecords.length;
        },
        close: (descriptor: number) => {
          closedDescriptors.push(descriptor);
          if (options.failClose?.has(descriptor)) {
            throw new Error("close failed");
          }
        },
      }),
    };
  }

  const windows = scenario();
  assert.deepEqual(
    withInteractiveConsoleUsingAdapter(
      "win32",
      windows.adapter,
      (handles) => handles,
    ),
    { input: 11, output: 12 },
  );
  assert.deepEqual(windows.deviceOpenRecords, [
    ["\\\\.\\CONIN$", "r"],
    ["\\\\.\\CONOUT$", "r+"],
  ]);
  assert.deepEqual(windows.closedDescriptors, [11, 12]);

  const posix = scenario();
  assert.equal(
    withInteractiveConsoleUsingAdapter("linux", posix.adapter, () => true),
    true,
  );
  assert.deepEqual(posix.deviceOpenRecords, [
    ["/dev/tty", "r"],
    ["/dev/tty", "w"],
  ]);
  assert.deepEqual(posix.closedDescriptors, [11, 12]);

  const windowsAsync = scenario();
  assert.deepEqual(
    await withInteractiveConsoleAsyncOutcomeUsingAdapter(
      "win32",
      windowsAsync.adapter,
      async () => "completed",
    ),
    { status: "completed", value: "completed" },
  );
  assert.deepEqual(windowsAsync.deviceOpenRecords, [
    ["\\\\.\\CONIN$", "r"],
    ["\\\\.\\CONOUT$", "r+"],
  ]);
  assert.deepEqual(windowsAsync.closedDescriptors, [11, 12]);

  const posixAsync = scenario();
  assert.deepEqual(
    await withInteractiveConsoleAsyncOutcomeUsingAdapter(
      "linux",
      posixAsync.adapter,
      async () => "completed",
    ),
    { status: "completed", value: "completed" },
  );
  assert.deepEqual(posixAsync.deviceOpenRecords, [
    ["/dev/tty", "r"],
    ["/dev/tty", "w"],
  ]);
  assert.deepEqual(posixAsync.closedDescriptors, [11, 12]);

  const inputOpenFailure = scenario({ failOpenAt: 1 });
  assert.equal(
    withInteractiveConsoleUsingAdapter(
      "win32",
      inputOpenFailure.adapter,
      () => true,
    ),
    null,
  );
  assert.deepEqual(inputOpenFailure.closedDescriptors, []);

  const outputOpenFailure = scenario({ failOpenAt: 2 });
  assert.equal(
    withInteractiveConsoleUsingAdapter(
      "win32",
      outputOpenFailure.adapter,
      () => true,
    ),
    null,
  );
  assert.deepEqual(outputOpenFailure.closedDescriptors, [11]);

  const operationFailure = scenario();
  assert.equal(
    withInteractiveConsoleUsingAdapter(
      "win32",
      operationFailure.adapter,
      () => {
        throw new Error("operation failed");
      },
    ),
    null,
  );
  assert.deepEqual(operationFailure.closedDescriptors, [11, 12]);

  const validationFailure = scenario();
  let operationCalls = 0;
  assert.equal(
    withInteractiveConsoleUsingAdapter(
      "win32",
      Object.freeze({
        ...validationFailure.adapter,
        validate: () => false,
      }),
      () => {
        operationCalls += 1;
        return true;
      },
    ),
    null,
  );
  assert.equal(operationCalls, 0);
  assert.deepEqual(validationFailure.closedDescriptors, [11, 12]);

  const validationOutcome = scenario();
  assert.deepEqual(
    withInteractiveConsoleOutcomeUsingAdapter(
      "win32",
      Object.freeze({
        ...validationOutcome.adapter,
        validate: () => false,
      }),
      () => true,
    ),
    { status: "unavailable", value: null },
  );
  assert.deepEqual(validationOutcome.closedDescriptors, [11, 12]);

  for (const failedDescriptor of [11, 12]) {
    const closeFailure = scenario({
      failClose: new Set([failedDescriptor]),
    });
    assert.equal(
      withInteractiveConsoleUsingAdapter(
        "win32",
        closeFailure.adapter,
        () => true,
      ),
      null,
    );
    assert.deepEqual(closeFailure.closedDescriptors, [11, 12]);
    const structuredCloseFailure = scenario({
      failClose: new Set([failedDescriptor]),
    });
    assert.deepEqual(
      withInteractiveConsoleOutcomeUsingAdapter(
        "win32",
        structuredCloseFailure.adapter,
        () => true,
      ),
      { status: "cleanup_unknown", value: true },
    );
    assert.deepEqual(structuredCloseFailure.closedDescriptors, [11, 12]);
  }
});

/**
 * 非同期対話処理が完了するまで両OS deviceを保持してから回収するを検証する。
 *
 * @responsibility 非同期対話処理が完了するまで両OS deviceを保持してから回収するの合否判定を所有する。
 * @trace EST-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 非同期対話処理が完了するまで両OS deviceを保持してから回収するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-UT-016=Unit: PA内の合成Adapter→取得・回収の技術結果
 */
test("非同期対話処理が完了するまで両OS deviceを保持してから回収する", async () => {
  const closedDescriptors: number[] = [];
  let completeOperation: ((isSuccessful: boolean) => void) | null = null;
  const adapter = Object.freeze({
    open: (device: string) => (device.endsWith("CONIN$") ? 11 : 12),
    close: (descriptor: number) => {
      closedDescriptors.push(descriptor);
    },
  });
  const pendingOperation = withInteractiveConsoleAsyncUsingAdapter(
    "win32",
    adapter,
    () =>
      new Promise<boolean>((resolve) => {
        completeOperation = resolve;
      }),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(closedDescriptors, []);
  resolveDeferredBoolean(completeOperation, true);
  assert.equal(await pendingOperation, true);
  assert.deepEqual(closedDescriptors, [11, 12]);

  closedDescriptors.length = 0;
  assert.equal(
    await withInteractiveConsoleAsyncUsingAdapter(
      "win32",
      adapter,
      async () => {
        throw new Error("operation failed");
      },
    ),
    null,
  );
  assert.deepEqual(closedDescriptors, [11, 12]);

  const closeFailureClosedDescriptors: number[] = [];
  const closeFailureAdapter = Object.freeze({
    ...adapter,
    close: (descriptor: number) => {
      closeFailureClosedDescriptors.push(descriptor);
      if (descriptor === 11) throw new Error("close failed");
    },
  });
  assert.equal(
    await withInteractiveConsoleAsyncUsingAdapter(
      "win32",
      closeFailureAdapter,
      async () => true,
    ),
    null,
  );
  assert.deepEqual(closeFailureClosedDescriptors, [11, 12]);
});
