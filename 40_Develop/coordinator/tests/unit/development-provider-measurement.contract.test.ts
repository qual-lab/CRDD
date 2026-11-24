/**
 * coordinator:unit:development-provider-measurementの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:development-provider-measurementが所有する検証責務を実行する。
 * @trace PPR-UT-006
 * @level UT
 * @scope development、provider、measurement
 * @boundary PPR-UT-006=N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { compileFunction } from "node:vm";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";

/**
 * 計測CLIの全量入力と、出力失敗時の取得済み結果保持を検証する。
 * @responsibility 旧128KiB超の搬送と元Task結果・回復参照の保全を確認する。
 * @trace PPR-UT-006
 * @precondition 全I/OとProvider実行を局所代役にする。
 * @stimulus 正常File・Link、出力Directory差と書込み例外を与える。
 * @observation 元設定、実行回数、結果書込みとlistener解放。
 * @oracle 正常量は搬送、Linkは実行前拒否、出力失敗でも元結果保持・再実行なし。
 * @cleanup メモリ内代役だけ。
 * @boundary 計測CLIの内部設定読取り。
 */
test("計測CLIは全量入力を搬送し出力失敗でも元結果と回復参照を保持する", async () => {
  const source = fs.readFileSync(
    new URL("../../scripts/benchmark.ts", import.meta.url),
    "utf8",
  );
  const configuration = { description: "a".repeat(131_073) };
  const raw = JSON.stringify(configuration);
  const root = path.resolve("synthetic-unused-root");
  let link = false;
  let calls = 0;
  let writes = 0;
  let listeners = 0;
  let output = "";
  let finished = false;
  let outputFailure = "none";
  let measurement: Record<string, unknown> = { status: "completed" };
  const processStub = {
    versions: { node: process.versions.node },
    argv: ["node", "script"],
    cwd: () => root,
    pid: 1,
    on: () => listeners++,
    off: () => listeners--,
    stdout: {
      write: (text: string) => {
        output = text;
        return true;
      },
    },
    exitCode: 0,
  };
  const filesystem = {
    lstatSync: (target: string) => ({
      isDirectory: () => !target.endsWith(".json"),
      isFile: () => target.endsWith(".json"),
      isSymbolicLink: () => link && target.endsWith(".json"),
      size: Buffer.byteLength(raw),
      dev: finished && outputFailure === "directory" ? 2 : 1,
      ino: 1,
      birthtimeMs: 1,
    }),
    realpathSync: { native: (target: string) => target },
    readFileSync: () => raw,
    writeFileSync: () => {
      writes++;
      if (outputFailure === "write") throw Error("private path and details");
    },
  };
  const main = compileFunction(
    `return (${stripTypeScriptTypes(sourceDeclaration(source, "main"))});`,
    [
      "assertSupportedCoordinatorNodeRuntime",
      "process",
      "fs",
      "path",
      "resolveVerifiedRepositoryRootFromWorkingDirectory",
      "getRepository",
      "ensureRepositoryExecutionDataArea",
      "requireReadyRepositoryExecutionDataArea",
      "runDevelopmentProviderMeasurement",
      "AbortController",
    ],
  )(
    () => {},
    processStub,
    filesystem,
    path,
    () => ({}),
    () => ({ status: "completed", capability: {} }),
    () => ({}),
    () => ({ directory: root }),
    async (value: unknown) => {
      calls++;
      assert.deepEqual(value, configuration);
      finished = true;
      return measurement;
    },
    AbortController,
  ) as () => Promise<void>;
  await main();
  assert.equal(calls, 1);
  assert.equal(writes, 1);
  assert.equal(listeners, 0);
  link = true;
  await assert.rejects(main(), /measurement_request_invalid/u);
  assert.equal(calls, 1);
  link = false;
  measurement = {
    status: "blocked",
    reason: "original_task_failure",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    recoveryIds: ["exact-recovery-id"],
    results: [
      {
        result: {
          requestId: "exact-task-id",
          recoveryIds: ["exact-recovery-id"],
        },
      },
    ],
  };
  for (const fault of ["directory", "write"]) {
    outputFailure = fault;
    finished = false;
    const before: number = calls;
    await main();
    const report = JSON.parse(output);
    assert.equal(calls, before + 1);
    assert.equal(report.status, "blocked");
    assert.equal(report.reason, measurement.reason);
    assert.equal(report.cleanupConfirmed, false);
    assert.deepEqual(report.recoveryIds, ["exact-recovery-id"]);
    assert.deepEqual(report.results, measurement.results);
    assert.equal(report.outputConfirmed, false);
    assert.deepEqual(report.secondaryFailures, [
      "measurement_output_unconfirmed",
    ]);
    assert.equal(output.includes("private path"), false);
    assert.equal(listeners, 0);
    assert.equal(processStub.exitCode, 2);
  }
});

import { ExecutionStorageBlockedError } from "../../../execution-model/src/index.ts";
import { RepositoryDataBlockedError } from "../../src/lifecycle/host.ts";
import {
  createIsolatedDevelopmentProviderMeasurementCandidate,
  projectDevelopmentMeasurementEntryFailure,
} from "../../scripts/benchmark.ts";

type Dependencies = Parameters<
  typeof createIsolatedDevelopmentProviderMeasurementCandidate
>[0];

/**
 * Development Measurement入口はRuntime Data停止理由を保持するを検証する。
 *
 * @responsibility Development Measurement入口はRuntime Data停止理由を保持するの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Development Measurement入口はRuntime Data停止理由を保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PPR-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
test("Development Measurement入口はRuntime Data停止理由を保持する", () => {
  for (const ErrorType of [
    ExecutionStorageBlockedError,
    RepositoryDataBlockedError,
  ]) {
    const error = new ErrorType({
      status: "blocked",
      reason: "repository_runtime_data_ignore_registration_blocked",
      effectIssued: true,
      effectStateUnknown: true,
      effectConfirmation: "unknown",
      cleanupConfirmed: false,
      retryAllowed: false,
      recoveryReference: "repository-local-ignore.test-reference",
      repositoryPathReported: false,
    });
    assert.deepEqual(projectDevelopmentMeasurementEntryFailure(error), {
      status: "blocked",
      reason: "repository_runtime_data_ignore_registration_blocked",
      effectIssued: true,
      effectStateUnknown: true,
      cleanupConfirmed: false,
      retryAllowed: false,
      recoveryReference: "repository-local-ignore.test-reference",
    });
  }
});

/**
 * 通常Task計測の独立した局所準備。
 * @responsibility 可変な時計・Source・結果・TimerをCaseごとに分離する。
 * @trace PPR-UT-006
 * @precondition 外部I/Oと実Taskは使用しない。
 * @stimulus 任意の通常Task結果列を渡す。
 * @observation 実行ID、元結果、取消SignalとTimer解放を返す。
 * @oracle 各Caseで独立に期待値を固定する。
 * @cleanup メモリ内代役だけ。
 * @boundary Scriptと完成Task操作。
 */
function fixture(outcomes: readonly string[]) {
  const starts: string[] = [];
  const returned: unknown[] = [];
  const capability = Object.freeze({
    contract: "crdd-version-control/repository-location/v1" as const,
  });
  let sourceCalls = 0;
  let time = 0;
  let wall = 100;
  let cleared = 0;
  let cancelTimer: (() => void) | null = null;
  let changeSource = false;
  let missingSource = false;
  let runOverride: Dependencies["runTask"] | null = null;
  const configuration = {
    projectId: "PRJ-000001",
    principalId: "local:test",
    expiresAtMs: 1100,
    expectedSourceSha256: "c".repeat(64),
    tasks: [
      { requestId: "task-one", choice: { provider: "codex" } },
      { requestId: "task-two", choice: { provider: "claude" } },
    ],
  };
  const dependencies = {
    now: () => time++,
    wallNow: () => wall,
    getRepository: () => ({
      status: "completed",
      reason: "repository_root_verified",
      capability,
    }),
    observeSource: () => {
      sourceCalls++;
      if (missingSource) return null;
      return Object.freeze({
        scope: "crdd-development-source-snapshot/v6",
        sourceSha256:
          changeSource && sourceCalls > 1 ? "d".repeat(64) : "c".repeat(64),
        sourceIdentitySha256: "e".repeat(64),
        fileCount: 1,
        totalBytes: 1,
      });
    },
    setTimer: ((callback: () => void, delay: number) => {
      assert.equal(delay, 1000);
      cancelTimer = callback;
      return 1;
    }) as unknown as Dependencies["setTimer"],
    clearTimer: (() => {
      cleared++;
    }) as Dependencies["clearTimer"],
    runTask: async (context, command, signal) => {
      assert.equal(context.rootCapability, capability);
      assert.equal(context.principalId, configuration.principalId);
      assert.equal(context.projectId, configuration.projectId);
      assert.equal(context.authorize(), true);
      starts.push(String((command as { requestId: string }).requestId));
      if (runOverride) return runOverride(context, command, signal);
      const outcome = outcomes[starts.length - 1];
      if (outcome === "throw" || outcome === "reject")
        throw Error("private details");
      const result = Object.freeze({
        status:
          outcome === "success"
            ? ("completed" as const)
            : outcome === "unknown"
              ? ("unknown" as const)
              : ("blocked" as const),
        requestId: starts.at(-1) ?? null,
        reason: "normal_task_result",
        cleanupConfirmed: outcome !== "cleanup_unknown",
        recoveryIds: outcome === "manual_recovery" ? ["exact-recovery-id"] : [],
        secondaryFailures:
          outcome === "secondary" ? ["normal_close_failed"] : [],
      });
      returned.push(result);
      return result;
    },
  } satisfies Dependencies;
  return {
    runtime:
      createIsolatedDevelopmentProviderMeasurementCandidate(dependencies),
    dependencies,
    configuration,
    starts,
    returned,
    cleared: () => cleared,
    sourceCalls: () => sourceCalls,
    fireDeadline: () => {
      wall = 1100;
      assert.ok(cancelTimer);
      cancelTimer();
    },
    changeSource: () => {
      changeSource = true;
    },
    missingSource: () => {
      missingSource = true;
    },
    overrideRun: (run: Dependencies["runTask"]) => {
      runOverride = run;
    },
  };
}

/**
 * 通常Taskを二回だけ実行し、元結果を外側計測へ保持する。
 * @responsibility 旧Session・会計を再構築せず完成操作を利用する。
 * @trace PPR-UT-006
 * @precondition 二つの別IDと明示主体を渡す。
 * @stimulus 完了二件とcleanな不成功を実行する。
 * @observation 実行ID、元参照、Source回数、Timer解放。
 * @oracle cleanな不成功を再送せず別IDへ進む。
 * @cleanup Timer代役の解放を確認。
 * @boundary Script→runTask。
 */
test("通常Task二件を一回ずつ計測し元結果を保持する", async () => {
  for (const outcomes of [
    ["success", "success"],
    ["clean_failure", "success"],
  ]) {
    const value = fixture(outcomes);
    const result = await value.runtime.run(
      value.configuration,
      "repository",
      new AbortController().signal,
    );
    assert.deepEqual(value.starts, ["task-one", "task-two"]);
    assert.equal(
      result.status,
      outcomes[0] === "success" ? "completed" : "blocked",
    );
    assert.equal(result.contractRevision, 4);
    assert.equal(result.results[0]?.result, value.returned[0]);
    assert.equal(result.sourceBefore?.sourceSha256, "c".repeat(64));
    assert.equal(value.sourceCalls(), 2);
    assert.equal(value.cleared(), 1);
    assert.equal(Object.hasOwn(result, "invocationAccounting"), false);
    assert.equal(Object.hasOwn(result, "executionTiming"), false);
  }
});

/**
 * 不明・回収・終了失敗を次のTaskへ伝播させない。
 * @responsibility exact回復参照と一次結果を保持する。
 * @trace PPR-UT-006
 * @precondition 独立した故障結果を渡す。
 * @stimulus 各失敗で実行する。
 * @observation 二件目未実行と元結果・回復集合。
 * @oracle 終了不明を成功やcleanな業務失敗へ変換しない。
 * @cleanup Timer代役の解放を確認。
 * @boundary Script→runTask最終結果。
 */
test("回収不明・回復参照・終了失敗・例外で後続を停止する", async () => {
  for (const fault of [
    "cleanup_unknown",
    "manual_recovery",
    "secondary",
    "unknown",
    "throw",
    "reject",
  ]) {
    const value = fixture([fault, "success"]);
    const result = await value.runtime.run(
      value.configuration,
      "repository",
      new AbortController().signal,
    );
    assert.equal(result.status, "blocked");
    assert.deepEqual(value.starts, ["task-one"]);
    assert.equal(value.cleared(), 1);
    assert.equal(JSON.stringify(result).includes("private details"), false);
    if (fault === "manual_recovery")
      assert.deepEqual(result.recoveryIds, ["exact-recovery-id"]);
    if (value.returned.length)
      assert.equal(result.results[0]?.result, value.returned[0]);
  }
});

/**
 * 不正・旧形式・取消済み要求はTaskへ渡さない。
 * @responsibility 主体・ID・Sourceの暗黙補完を禁止する。
 * @trace PPR-UT-006
 * @precondition 同じ局所準備を各Caseで新規構築する。
 * @stimulus 欠測・旧形式・重複ID・取消・Source欠測を与える。
 * @observation Task開始0。
 * @oracle 無効入力に互換変換を追加しない。
 * @cleanup 開始済みTimerがなければ解放を捏造しない。
 * @boundary 計測Script受付。
 */
test("旧形式・重複ID・欠測・取消済み・Source不明は実行前に拒否する", async () => {
  for (const fault of [
    "legacy",
    "duplicate",
    "principal",
    "expired",
    "source",
    "cancel",
  ]) {
    const value = fixture(["success", "success"]);
    const abort = new AbortController();
    let input: unknown = value.configuration;
    if (fault === "legacy") input = { repositoryRoot: "repository", tasks: [] };
    if (fault === "duplicate") {
      const first = value.configuration.tasks[0];
      assert.ok(first);
      value.configuration.tasks[1] = first;
    }
    if (fault === "principal") value.configuration.principalId = "";
    if (fault === "expired") value.configuration.expiresAtMs = 100;
    if (fault === "source") value.missingSource();
    if (fault === "cancel") abort.abort();
    const result = await value.runtime.run(input, "repository", abort.signal);
    assert.equal(result.status, "blocked");
    assert.deepEqual(value.starts, []);
  }
});

/**
 * 取消は同じSignalへ配送し、通常Taskの最終返却より早く終了しない。
 * @responsibility 外部Abortと期限をjoin前の完了に読み替えない。
 * @trace PPR-UT-006
 * @precondition runTask最終返却を手動で保留する。
 * @stimulus 外部取消又は期限到達を通知してから返却を解放する。
 * @observation Signal、結果閲覧認可、外側Promise、Timer解放、元結果と回復参照。
 * @oracle 取消後も閲覧認可と元結果を保持し、返却待機して二件目を開始しない。
 * @cleanup 保留したPromiseを必ず完了させる。
 * @boundary Script取消→完成Taskの取消join。
 */
test("外部取消と期限は通常Taskの最終返却を待つ", async () => {
  for (const mode of [
    "abort",
    "deadline",
    "abort-completed",
    "deadline-completed",
  ]) {
    const value = fixture([]);
    const abort = new AbortController();
    let release: (() => void) | undefined;
    let observed: AbortSignal | undefined;
    let authorization: (() => boolean) | undefined;
    const finalResult = Object.freeze({
      status: mode.endsWith("completed")
        ? ("completed" as const)
        : ("cancelled" as const),
      requestId: "task-one",
      reason: "task_cancelled",
      cleanupConfirmed: mode.endsWith("completed"),
      recoveryIds: mode.endsWith("completed")
        ? []
        : ["exact-cancelled-task-recovery"],
      secondaryFailures: [],
    });
    value.overrideRun(async (context, _command, signal) => {
      observed = signal;
      authorization = context.authorize;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      // 通常Taskのwaitは終了待機後にも閲覧認可を確認する。
      assert.equal(context.authorize(), true);
      return finalResult;
    });
    let settled = false;
    const completion = value.runtime
      .run(value.configuration, "repository", abort.signal)
      .finally(() => {
        settled = true;
      });
    assert.ok(release);
    if (mode.startsWith("abort")) abort.abort();
    else value.fireDeadline();
    assert.equal(observed?.aborted, true);
    assert.equal(authorization?.(), true);
    await Promise.resolve();
    assert.equal(settled, false);
    assert.equal(value.cleared(), 0);
    release();
    const result = await completion;
    assert.equal(result.status, "blocked");
    assert.equal(result.results[0]?.result, finalResult);
    assert.deepEqual(result.recoveryIds, finalResult.recoveryIds);
    assert.equal(result.cleanupConfirmed, finalResult.cleanupConfirmed);
    assert.deepEqual(value.starts, ["task-one"]);
    assert.equal(value.cleared(), 1);
  }
});

/**
 * Source前後差と時計失敗でも元Task結果を失わない。
 * @responsibility 計測不成立とTaskのcleanup結果を分ける。
 * @trace PPR-UT-006
 * @precondition 通常Taskは既知の完了結果を返す。
 * @stimulus Source差又は終了時計例外を与える。
 * @observation 元結果、計測状態、回収確認。
 * @oracle 計測失敗をTask失敗や回復参照欠測へ変換しない。
 * @cleanup Timer代役を解放する。
 * @boundary 観測と実行結果。
 */
test("Source差と終了時計失敗は計測だけを不成立にする", async () => {
  for (const fault of ["source", "clock"]) {
    const value = fixture(["success", "success"]);
    if (fault === "source") value.changeSource();
    else {
      let calls = 0;
      value.dependencies.now = () => {
        if (calls++) throw Error("clock");
        return 0;
      };
    }
    const result = await value.runtime.run(
      value.configuration,
      "repository",
      new AbortController().signal,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(result.results[0]?.result, value.returned[0]);
    assert.equal(value.cleared(), 1);
  }
});
