/**
 * coordinator:unit:development-provider-measurementの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:development-provider-measurementが所有する検証責務を実行する。
 * @trace PPR-UT-006
 * @level UT
 * @scope development、provider、measurement
 * @boundary N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createIsolatedDevelopmentProviderMeasurementCandidate,
  projectDevelopmentMeasurementEntryFailure,
} from "../../scripts/measure-development-providers.ts";
import { RepositoryRuntimeDataAreaBlockedError } from "../../../runtime-data/src/index.ts";
import { snapshotCoordinatorTaskRequest } from "../../src/security/coordinator-task-request.ts";

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
 * @boundary N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
 */
test("Development Measurement入口はRuntime Data停止理由を保持する", () => {
  const error = new RepositoryRuntimeDataAreaBlockedError({
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
});
/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PPR-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
 */
function fixture(outcomes: readonly string[]) {
  const capability = Object.freeze({});
  const starts: string[] = [];
  let cancellationCount = 0;
  let time = 0;
  const tasks = ["codex", "claude"].map((provider) => {
    const parsed = snapshotCoordinatorTaskRequest({
      frontProvider: provider === "codex" ? "claude" : "codex",
      requestedExecutorProvider: provider,
      objective: "Update fixture",
      acceptanceCriteria: ["Expected content"],
      allowedPaths: ["fixture.txt"],
      readPaths: ["fixture.txt"],
      workClass: "bounded_implementation",
      planState: "complete",
      risk: "low",
      difficulty: "low",
      decisionImpact: "limited",
      isLocalCandidateOnly: true,
      hasUnresolvedDirection: false,
      requiresCrossContextAlignment: false,
    });
    assert.equal(parsed?.status, "accepted");
    if (parsed?.status !== "accepted") throw new Error("fixture_invalid");
    return parsed.request;
  });
  const dependencies = {
    request: async () => ({ status: "authorized", capability }),
    tasks: (candidate: object) => {
      assert.equal(candidate, capability);
      return tasks;
    },
    inspect: () => ({ invocationCount: starts.length * 2 }),
    cancel: (candidate: object) => {
      assert.equal(candidate, capability);
      cancellationCount += 1;
      return true;
    },
    now: () => time++,
    start: (
      task: Record<string, unknown>,
      _root: string,
      candidate: object,
    ) => {
      assert.equal(candidate, capability);
      const outcome = outcomes[starts.length];
      starts.push(String(task.requestedExecutorProvider));
      if (outcome === "throw") throw new Error("private details");
      return {
        readExecutionTiming: () => ({ finished: true }),
        completion:
          outcome === "reject"
            ? Promise.reject(new Error("private details"))
            : Promise.resolve({
                status: outcome === "success" ? "completed" : "blocked",
                cleanupConfirmed: outcome !== "cleanup_unknown",
                manualRecoveryRequired:
                  outcome === "cleanup_unknown" ||
                  outcome === "manual_recovery",
                taskResult: { processRestartRequired: outcome === "restart" },
              }),
      };
    },
  };
  return {
    runtime: createIsolatedDevelopmentProviderMeasurementCandidate(
      dependencies as unknown as Dependencies,
    ),
    starts,
    cancellationCount: () => cancellationCount,
  };
}

/**
 * 比較は固定2Taskを一回ずつ実行し終了時にsessionを失効するを検証する。
 *
 * @responsibility 比較は固定2Taskを一回ずつ実行し終了時にsessionを失効するの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 比較は固定2Taskを一回ずつ実行し終了時にsessionを失効するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
 */
test("比較は固定2Taskを一回ずつ実行し終了時にsessionを失効する", async () => {
  const value = fixture(["success", "success"]);
  const result = await value.runtime.run(
    {},
    "repository",
    new AbortController().signal,
  );
  assert.equal(result.status, "completed");
  assert.equal(Reflect.get(result, "contractRevision"), 2);
  assert.deepEqual(value.starts, ["codex", "claude"]);
  assert.equal(value.cancellationCount(), 1);
});

/**
 * cleanな業務失敗は同じTaskを再試行せず別の承認済みTaskと比較するを検証する。
 *
 * @responsibility cleanな業務失敗は同じTaskを再試行せず別の承認済みTaskと比較するの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cleanな業務失敗は同じTaskを再試行せず別の承認済みTaskと比較するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
 */
test("cleanな業務失敗は同じTaskを再試行せず別の承認済みTaskと比較する", async () => {
  const value = fixture(["clean_failure", "success"]);
  const result = await value.runtime.run(
    {},
    "repository",
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.deepEqual(value.starts, ["codex", "claude"]);
  assert.equal(value.cancellationCount(), 1);
});

for (const failure of [
  "cleanup_unknown",
  "manual_recovery",
  "restart",
  "throw",
  "reject",
] as const) {
  /**
   * ${failure}なら次Taskを開始せず終了するを検証する。
   *
   * @responsibility ${failure}なら次Taskを開始せず終了するの合否判定を所有する。
   * @trace PPR-UT-006
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus ${failure}なら次Taskを開始せず終了するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
   */
  test(`${failure}なら次Taskを開始せず終了する`, async () => {
    const value = fixture([failure, "success"]);
    const result = await value.runtime.run(
      {},
      "repository",
      new AbortController().signal,
    );
    assert.equal(result.status, "blocked");
    assert.deepEqual(value.starts, ["codex"]);
    assert.equal(value.cancellationCount(), 1);
    assert.equal(JSON.stringify(result).includes("private details"), false);
    if (failure === "manual_recovery")
      assert.equal(Reflect.get(result, "manualRecoveryRequired"), true);
    if (failure === "reject")
      assert.deepEqual(Reflect.get(result, "incompleteTaskTiming"), {
        finished: true,
      });
  });
}

/**
 * 取消済みならProviderを開始しないを検証する。
 *
 * @responsibility 取消済みならProviderを開始しないの合否判定を所有する。
 * @trace PPR-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 取消済みならProviderを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 欠測・現行性・競合・可視性の判定規則は外部実行境界を持たない。
 */
test("取消済みならProviderを開始しない", async () => {
  const value = fixture(["success", "success"]);
  const abort = new AbortController();
  abort.abort();
  const result = await value.runtime.run({}, "repository", abort.signal);
  assert.equal(result.status, "blocked");
  assert.deepEqual(value.starts, []);
  assert.equal(value.cancellationCount(), 1);
});
