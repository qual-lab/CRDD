import assert from "node:assert/strict";
import test from "node:test";
import { createIsolatedDevelopmentProviderMeasurementCandidate } from "../scripts/measure-development-providers.ts";
import { snapshotCoordinatorTaskRequest } from "../src/security/coordinator-task-request.ts";

type Dependencies = Parameters<
  typeof createIsolatedDevelopmentProviderMeasurementCandidate
>[0];
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
        completion: Promise.resolve({
          status: outcome === "success" ? "completed" : "blocked",
          cleanupConfirmed: outcome !== "cleanup_unknown",
          manualRecoveryRequired:
            outcome === "cleanup_unknown" || outcome === "manual_recovery",
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

test("比較は固定2Taskを一回ずつ実行し終了時にsessionを失効する", async () => {
  const value = fixture(["success", "success"]);
  const result = await value.runtime.run(
    {},
    "repository",
    new AbortController().signal,
  );
  assert.equal(result.status, "completed");
  assert.deepEqual(value.starts, ["codex", "claude"]);
  assert.equal(value.cancellationCount(), 1);
});

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
] as const) {
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
  });
}

test("取消済みならProviderを開始しない", async () => {
  const value = fixture(["success", "success"]);
  const abort = new AbortController();
  abort.abort();
  const result = await value.runtime.run({}, "repository", abort.signal);
  assert.equal(result.status, "blocked");
  assert.deepEqual(value.starts, []);
  assert.equal(value.cancellationCount(), 1);
});
