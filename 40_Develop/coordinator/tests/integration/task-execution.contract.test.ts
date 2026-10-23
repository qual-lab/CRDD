/**
 * coordinator:integration:task-executionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:task-executionが所有する検証責務を実行する。
 * @trace PRL-IT-012
 * @level IT
 * @scope project、runtime、execution
 * @boundary PRL-IT-012=Related 2 Blocks: CLI・MCP Adapter→Coordinator Application Port→Core
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createCoordinatorExecutionHostPorts,
  createCoordinatorState,
  describeCoordinatorExecutionContract,
  type CoordinatorSingleTaskResult,
  type ProjectTaskDefinition,
  runCoordinatorOperation as runCoordinatorOperationWithPorts,
  runCoordinatorSingleTaskAttempt,
} from "../../src/index.ts";
import {
  createCurrentCoordinatorPersistencePorts as createCoordinatorPersistencePorts,
  initializeCoordinatorSnapshot,
} from "../../src/storage/current-state.ts";
import { createRuntimeProcessRecoveryIdentity } from "../../src/execution/process-safety-state.ts";
import {
  enqueueProjectOperation,
  readProjectOperationQueueState,
  readCoordinatorState,
  writeCoordinatorState,
} from "../fixtures/task-persistence-fixture.ts";
import { encodeCoordinatorStateValue } from "../../src/storage/model.ts";

import { registerSyntheticResults } from "../fixtures/task-result-fixture.ts";

const revision = "a".repeat(40);

/**
 * 通常Taskの結果集合を単一CASで受理し、応答喪失を元Task結果と分ける。
 * @responsibility 実Snapshot・履歴・配送待ちの本番Application接続を検証する。
 * @trace PRL-IT-012
 * @precondition 新版Git Root、Queueと模擬下位操作の確認済み履歴を用意する。
 * @stimulus 二結果、0件、読取り失敗、二重通知、保存前失敗、保存後応答喪失と二件目不正を実行する。
 * @observation Task起動数、受領保存、Operation／配送除去、Task終端と結果fieldを確認する。
 * @oracle 受領と全対象除去が一回で成立し、部分不正では一件目も受領せず再実行しない。
 * @cleanup 自己所有fixtureを終了hookで回収する。Docker/Providerは使用しない。
 * @boundary PRL-IT-012=Direct Boundary: Application→単一物理Writer→実Snapshot／履歴。
 */
for (const mode of [
  "normal",
  "none",
  "read_failure",
  "double_notification",
  "save_failure",
  "second_result_invalid",
  "missing_capture",
  "wrong_operation",
  "duplicate_reference",
  "save_after_effect",
  "cancelled",
  "pending_reentry",
  "history_missing",
  "history_duplicate",
  "history_mismatch",
  "history_unconfirmed",
] as const) {
  test(`通常結果配送は上位実保存後だけ整理しTask結果を保持する ${mode}`, async (t) => {
    const { root, input } = fixture(t, [task("task-a")], 1);
    const persistence = createCoordinatorPersistencePorts(root, "binding-a");
    let starts = 0;
    let reads = 0;
    let completes = 0;
    const publication: {
      args?: Parameters<typeof persistence.state.writeState>;
    } = {};
    const outcome = await runCoordinatorOperationWithPorts(
      {
        ...createCoordinatorExecutionHostPorts({}),
        persistence: {
          ...persistence,
          state: {
            ...persistence.state,
            writeState: (state, generation, resultFacts) => {
              if (
                mode === "pending_reentry" &&
                state.tasks.some((item) => item.resultAcceptances.length > 0)
              ) {
                publication.args = [state, generation, resultFacts];
                const rename = t.mock.method(
                  fs,
                  "renameSync",
                  (source: fs.PathLike, target: fs.PathLike) => {
                    assert.equal(
                      path.basename(String(source)),
                      "state.pending.json",
                    );
                    assert.equal(path.basename(String(target)), "state.json");
                    throw new Error("fixture_receipt_publication_interrupted");
                  },
                );
                try {
                  return persistence.state.writeState(
                    state,
                    generation,
                    resultFacts,
                  );
                } finally {
                  rename.mock.restore();
                }
              }
              if (
                (mode === "save_failure" || mode === "save_after_effect") &&
                state.tasks.some((item) => item.resultAcceptances.length > 0)
              ) {
                if (mode === "save_after_effect")
                  assert.equal(
                    persistence.state.writeState(state, generation, resultFacts)
                      .status,
                    "completed",
                  );
                return {
                  status: "blocked",
                  reason: "fixture_ack_save_failure",
                  value: null,
                  manualRecoveryRequired: true,
                  recoveryId: null,
                };
              }
              return persistence.state.writeState(
                state,
                generation,
                resultFacts,
              );
            },
          },
        },
        resultDelivery: {
          repositoryBindingId: "binding-a",
        },
        runSingleTaskAttempt: async (attempt) => {
          starts += 1;
          let results: ReturnType<typeof registerSyntheticResults> = [];
          const delivery = Object.freeze({
            readResults: () => {
              reads += 1;
              if (mode === "none")
                return { status: "not_required" as const, results: null };
              if (mode === "read_failure")
                return { status: "blocked" as const, results: null };
              return {
                status: "completed" as const,
                results: results.map((result, index) => ({
                  ...result,
                  operationId:
                    mode === "wrong_operation"
                      ? "other-operation"
                      : attempt.operationId,
                  recoveryId:
                    mode === "duplicate_reference"
                      ? (results[0]?.recoveryId ?? "fixture-missing")
                      : result.recoveryId,
                  resultId:
                    mode === "second_result_invalid" && index === 1
                      ? "0".repeat(64)
                      : result.resultId,
                  consumer: "orchestrator" as const,
                })),
              };
            },
            complete: () => {
              completes += 1;
              throw new Error("removed_ack_relay_must_not_be_called");
            },
          });
          if (mode !== "missing_capture")
            attempt.observeResultDelivery?.(delivery);
          if (mode === "double_notification")
            attempt.observeResultDelivery?.(delivery);
          const result = await completed(attempt);
          if (mode !== "none")
            results = registerSyntheticResults(root, attempt.operationId);
          const history = path.join(
            root,
            ".crdd",
            "coordinator",
            "history.jsonl",
          );
          if (mode === "history_missing") fs.unlinkSync(history);
          if (mode === "history_duplicate") {
            const bytes = fs.readFileSync(history);
            fs.writeFileSync(history, Buffer.concat([bytes, bytes]));
          }
          if (mode === "history_mismatch") {
            const rows = fs
              .readFileSync(history, "utf8")
              .trim()
              .split("\n")
              .map((line) => ({
                ...JSON.parse(line),
                occurredAt: "2026-01-01T00:00:00.000Z",
              }));
            fs.writeFileSync(
              history,
              rows
                .map((row) => `${encodeCoordinatorStateValue(row)}\n`)
                .join(""),
            );
          }
          if (mode === "history_unconfirmed") {
            const file = path.join(root, ".crdd", "coordinator", "state.json");
            const state = JSON.parse(fs.readFileSync(file, "utf8"));
            for (const operation of state.operations)
              operation.history.confirmed = false;
            fs.writeFileSync(file, `${encodeCoordinatorStateValue(state)}\n`);
          }
          return mode === "cancelled"
            ? { ...result, status: "cancelled", reason: "fixture_cancelled" }
            : result;
        },
      },
      input,
    );
    assert.equal(starts, 1);
    assert.equal(completes, 0, JSON.stringify(outcome));
    if (mode === "pending_reentry") {
      assert.equal(outcome.status, "blocked");
      assert.ok(publication.args);
      const args = publication.args;
      const area = path.join(root, ".crdd", "coordinator");
      const file = path.join(area, "state.json");
      const pending = path.join(area, "state.pending.json");
      const marker = path.join(area, "state.lock");
      const before = fs.readFileSync(file);
      const intended = fs.readFileSync(pending);
      const markerBytes = fs.readFileSync(marker);
      const history = fs.readFileSync(path.join(area, "history.jsonl"));
      assert.equal(JSON.parse(before.toString()).resultReceipts.length, 0);
      assert.equal(JSON.parse(before.toString()).operations.length, 2);
      assert.equal(JSON.parse(intended.toString()).resultReceipts.length, 2);
      assert.equal(JSON.parse(intended.toString()).operations.length, 0);
      for (const fault of ["marker", "pending", "state", "facts"] as const) {
        if (fault === "marker") fs.writeFileSync(marker, "{}\n");
        if (fault === "pending") fs.writeFileSync(pending, "{}\n");
        if (fault === "state") {
          const value = JSON.parse(before.toString());
          value.revision += 1;
          fs.writeFileSync(file, `${encodeCoordinatorStateValue(value)}\n`);
        }
        const fixedState = fs.readFileSync(file);
        const fixedPending = fs.readFileSync(pending);
        const fixedMarker = fs.readFileSync(marker);
        const attempted =
          fault === "facts"
            ? persistence.state.writeState(
                args[0],
                args[1],
                args[2]?.map((fact) => ({
                  ...fact,
                  recoveryUnresolved: !fact.recoveryUnresolved,
                })),
              )
            : persistence.state.writeState(...args);
        assert.equal(attempted.status, "blocked", fault);
        assert.deepEqual(fs.readFileSync(file), fixedState);
        assert.deepEqual(fs.readFileSync(pending), fixedPending);
        assert.deepEqual(fs.readFileSync(marker), fixedMarker);
        fs.writeFileSync(file, before);
        fs.writeFileSync(pending, intended);
        fs.writeFileSync(marker, markerBytes);
      }
      const child = fileURLToPath(
        new URL(
          "../fixtures/task-result-publication-worker.ts",
          import.meta.url,
        ),
      );
      for (let replay = 0; replay < 2; replay++) {
        const processEnv = { ...process.env };
        delete processEnv.NODE_TEST_CONTEXT;
        const worker = spawn(process.execPath, [child], {
          env: processEnv,
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        });
        let output = "",
          errors = "";
        worker.stdout.on("data", (data) => {
          output += data.toString();
        });
        worker.stderr.on("data", (data) => {
          errors += data.toString();
        });
        const joined = once(worker, "close", {
          signal: AbortSignal.timeout(60_000),
        });
        worker.stdin.end(JSON.stringify({ root, args }));
        try {
          const [code] = await joined;
          assert.equal(code, 0, errors);
        } finally {
          if (worker.exitCode === null && worker.signalCode === null) {
            const closed = once(worker, "close");
            worker.kill();
            await closed;
          }
        }
        const saved = JSON.parse(output);
        assert.equal(saved.status, "completed", JSON.stringify(saved));
        assert.deepEqual(fs.readFileSync(file), intended);
        assert.deepEqual(
          fs.readFileSync(path.join(area, "history.jsonl")),
          history,
        );
        assert.equal(fs.existsSync(pending), false);
        assert.equal(fs.existsSync(marker), false);
      }
      assert.equal(starts, 1);
      return;
    }
    assert.equal(
      reads,
      mode === "double_notification" || mode === "missing_capture" ? 0 : 1,
    );
    assert.equal(
      outcome.status,
      mode === "cancelled"
        ? "cancelled"
        : mode === "normal" || mode === "none"
          ? "completed"
          : "blocked",
      JSON.stringify(outcome),
    );
    const stored = persistence.state.readState("project-a");
    assert.ok(stored.value);
    assert.equal(
      stored.value.tasks[0]?.state,
      mode === "cancelled"
        ? "cancelled"
        : mode === "normal" || mode === "none" || mode === "save_after_effect"
          ? "completed"
          : "running",
    );
    assert.equal(
      stored.value.tasks[0]?.resultAcceptances.length,
      mode === "normal" || mode === "save_after_effect" || mode === "cancelled"
        ? 2
        : 0,
    );
    assert.ok(
      Object.values(outcome).every((value) => typeof value !== "function"),
    );
    const savedRoot = JSON.parse(
      fs.readFileSync(
        path.join(root, ".crdd", "coordinator", "state.json"),
        "utf8",
      ),
    );
    const accepted =
      mode === "normal" || mode === "save_after_effect" || mode === "cancelled";
    assert.equal(savedRoot.resultReceipts.length, accepted ? 2 : 0);
    assert.equal(
      savedRoot.operations.length,
      mode === "none" || accepted ? 0 : 2,
    );
    assert.equal(
      savedRoot.pendingDeliveries.length,
      mode === "none" || accepted ? 0 : 2,
    );
  });
}

type BoundExecutionDependencies = Omit<
  Parameters<typeof runCoordinatorOperationWithPorts>[0],
  "persistence" | "clockIdentity" | "processSafety"
> &
  Readonly<{
    now?: () => Readonly<{ monotonicMs: number; iso: string }>;
    poisonAfterCleanupUnknown?: () => void;
  }>;
type BoundExecutionInput = Parameters<
  typeof runCoordinatorOperationWithPorts
>[1] &
  Readonly<{ workingDirectory: string; repositoryBindingId: string }>;

/**
 * runCoordinatorOperationのTest準備責務を実行する。
 *
 * @responsibility runCoordinatorOperationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runCoordinatorOperationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function runCoordinatorOperation(
  dependencies: BoundExecutionDependencies,
  input: BoundExecutionInput,
) {
  const { workingDirectory, repositoryBindingId, ...applicationInput } = input;
  const { now, poisonAfterCleanupUnknown, ...applicationDependencies } =
    dependencies;
  return runCoordinatorOperationWithPorts(
    {
      ...applicationDependencies,
      ...createCoordinatorExecutionHostPorts({
        ...(now ? { now } : {}),
        ...(poisonAfterCleanupUnknown ? { poisonAfterCleanupUnknown } : {}),
      }),
      persistence: createCoordinatorPersistencePorts(
        workingDirectory,
        repositoryBindingId,
      ),
    },
    applicationInput,
  );
}

/**
 * hashのTest準備責務を実行する。
 *
 * @responsibility hashがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus hashを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * taskのTest準備責務を実行する。
 *
 * @responsibility taskがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus taskを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function task(
  id: string,
  dependencies: readonly string[] = [],
  allowedPaths: readonly string[] = [`work/${id}.txt`],
  conflictKeys: readonly string[] = [],
): ProjectTaskDefinition {
  return {
    id,
    objectiveId: "objective-a",
    dependencies,
    allowedPaths,
    conflictKeys,
  };
}

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function fixture(
  t: test.TestContext,
  tasks: readonly ProjectTaskDefinition[],
  maximumConcurrency = 5,
) {
  const tests = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  fs.mkdirSync(tests, { recursive: true });
  const root = fs.mkdtempSync(path.join(tests, "project-execution-"));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const initialized = initializeCoordinatorSnapshot(root, "binding-a");
  assert.equal(initialized.status, "completed", initialized.reason);
  const created = createCoordinatorState({
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    maximumConcurrency,
    milestoneAcceptanceCriteria: ["accepted"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["done"] }],
    tasks,
    ownerGeneration: "owner-a",
  });
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw new Error("fixture_failed");
  const saved = writeCoordinatorState(root, "binding-a", created.state, 0);
  assert.equal(saved.status, "completed", saved.reason);
  const queued = enqueueProjectOperation(root, "binding-a", {
    queueId: "queue-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    requestHash: hash("request"),
    originLane: "interactive",
    repositoryRevision: revision,
    scopeHash: hash("scope"),
  });
  assert.equal(queued.status, "completed", queued.reason);
  const input = {
    workingDirectory: root,
    repositoryBindingId: "binding-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    taskExecutions: tasks.map((entry) => ({
      taskId: entry.id,
      authorityBindingId: `authority-${entry.id}`,
      taskRequest: { taskId: entry.id },
      repositoryRoot: root,
    })),
    cancellationSignal: new AbortController().signal,
  };
  return { root, input };
}

/**
 * completedのTest準備責務を実行する。
 *
 * @responsibility completedがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus completedを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
async function completed(
  input: Parameters<
    Parameters<typeof runCoordinatorOperation>[0]["runSingleTaskAttempt"]
  >[0],
): Promise<CoordinatorSingleTaskResult> {
  assert.equal(await input.observeStarted?.(), true);
  return completedAfterStart(input);
}

/**
 * completedAfterStartのTest準備責務を実行する。
 *
 * @responsibility completedAfterStartがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus completedAfterStartを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function completedAfterStart(
  input: Parameters<
    Parameters<typeof runCoordinatorOperation>[0]["runSingleTaskAttempt"]
  >[0],
): CoordinatorSingleTaskResult {
  return {
    contract: "crdd-coordinator/orchestrator-single-task-adapter",
    attemptId: input.attemptId,
    operationId: input.operationId,
    authorityBindingId: input.authorityBindingId,
    repositoryRevision: input.repositoryRevision,
    status: "completed",
    reason: "task_completed",
    effectState: "settled",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
    candidateId: null,
    recoveryIds: [],
  };
}

/**
 * recordedのTest準備責務を実行する。
 *
 * @responsibility recordedがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus recordedを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function recorded(eventId: string) {
  return Object.freeze({
    status: "completed" as const,
    reason: "execution_event_recorded" as const,
    eventId,
    effectState: "settled" as const,
    cleanupConfirmed: true as const,
    retryAllowed: false as const,
    manualRecoveryRequired: false as const,
    residualArtifactIds: Object.freeze([]) as readonly [],
  });
}

/**
 * PR-N-01 connects one durable Project task to the Single Task boundaryを検証する。
 *
 * @responsibility PR-N-01 connects one durable Project task to the Single Task boundaryの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-N-01 connects one durable Project task to the Single Task boundaryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-N-01 connects one durable Project task to the Single Task boundary", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  let effects = 0;
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    input,
  );
  assert.equal(outcome.status, "completed", JSON.stringify(outcome));
  assert.equal(
    outcome.reason,
    "orchestrator_tasks_completed_integration_pending",
  );
  assert.equal(effects, 1);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  assert.ok(state.value);
  assert.equal(
    state.status === "completed" && state.value.tasks[0]?.state,
    "completed",
  );
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(
    queue.status === "completed" && queue.value.state,
    "integration_pending",
  );
  assert.equal(
    queue.status === "completed" && queue.value.ownerGeneration,
    null,
  );

  const replay = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    input,
  );
  assert.equal(replay.reason, "orchestrator_tasks_already_integration_pending");
  assert.equal(effects, 1);
});

/**
 * interactive Queue wins a fresh binding-wide selection before a scheduled caller can claimを検証する。
 *
 * @responsibility interactive Queue wins a fresh binding-wide selection before a scheduled caller can claimの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus interactive Queue wins a fresh binding-wide selection before a scheduled caller can claimの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("interactive Queue wins a fresh binding-wide selection before a scheduled caller can claim", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  assert.equal(
    enqueueProjectOperation(root, "binding-a", {
      queueId: "queue-scheduled",
      projectId: "project-a",
      milestoneId: "milestone-a",
      requestHash: hash("scheduled-request"),
      originLane: "scheduled",
      repositoryRevision: revision,
      scopeHash: hash("scheduled-scope"),
    }).status,
    "completed",
  );
  let effects = 0;
  const dependencies = {
    runSingleTaskAttempt: async (attempt: Parameters<typeof completed>[0]) => {
      effects += 1;
      return completed(attempt);
    },
  };
  const scheduled = await runCoordinatorOperation(dependencies, {
    ...input,
    queueId: "queue-scheduled",
  });
  assert.equal(scheduled.status, "blocked");
  assert.equal(scheduled.reason, "orchestrator_queue_claim_priority_changed");
  assert.equal(scheduled.effectState, "no_effect");
  assert.equal(effects, 0);
  const interactive = await runCoordinatorOperation(dependencies, input);
  assert.equal(interactive.status, "completed");
  assert.equal(effects, 1);
});

/**
 * PR-N-01 uses the existing Single Task adapter without widening its authorityを検証する。
 *
 * @responsibility PR-N-01 uses the existing Single Task adapter without widening its authorityの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-N-01 uses the existing Single Task adapter without widening its authorityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-N-01 uses the existing Single Task adapter without widening its authority", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  // Directの借用対象も、実在する固定HEADを持つRepositoryで検証する。
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgSign=false",
      "-c",
      "core.hooksPath=NUL",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  let starts = 0;
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: (attempt) =>
        runCoordinatorSingleTaskAttempt(
          {
            startTask: (
              _request,
              _root,
              _correlation,
              notifyStarted,
              workspaceTarget,
            ) => {
              starts += 1;
              assert.deepEqual(workspaceTarget, {
                workspaceId: null,
                ownerRepositoryRoot: attempt.ownerRepositoryRoot,
                executionTree: attempt.executionTree,
                baseCommit: null,
                head: null,
              });
              return {
                status: "started",
                controlCapability: {},
                completion: Promise.resolve().then(async () => {
                  assert.ok(notifyStarted);
                  assert.equal(
                    await notifyStarted({
                      event: "coordinator_provider_process_started",
                      taskRole: "executor",
                      provider: "claude",
                      operationId: "OP-execution-fixture",
                    }),
                    true,
                  );
                  return {
                    status: "completed",
                    reason: "coordinator_task_completed",
                    canonicalRepositoryChanged: false,
                    workspaceResult: {
                      workspaceId: null,
                      changedPaths: [],
                      canonicalRepositoryChanged: false,
                      changeAttribution: "unattributed",
                      workspaceDeletionIssued: false,
                    },
                    cleanupConfirmed: true,
                    manualRecoveryRequired: false,
                    processRestartRequired: false,
                    candidateId: null,
                    hostRecoveryId: null,
                    dockerRecoveryIds: [],
                    candidateRecoveryId: null,
                    candidateStoreRecoveryId: null,
                  };
                }),
              };
            },
            cancelTask: () => undefined,
          },
          attempt,
        ),
    },
    input,
  );
  assert.equal(outcome.status, "completed", outcome.reason);
  assert.equal(starts, 1);
});

/**
 * PR-N-02 runs at most five independent tasks and then drains the remainderを検証する。
 *
 * @responsibility PR-N-02 runs at most five independent tasks and then drains the remainderの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-N-02 runs at most five independent tasks and then drains the remainderの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-N-02 同じWorkspaceの独立Taskを並行上限によらず直列に完了する", async (t) => {
  const tasks = Array.from({ length: 7 }, (_unused, index) =>
    task(`task-${index + 1}`),
  );
  const { root, input } = fixture(t, tasks, 5);
  let active = 0;
  let maximumActive = 0;
  let preparedAtFirstEffect: number | null = null;
  const observedOperationIds = new Set<string>();
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        observedOperationIds.add(attempt.operationId);
        if (preparedAtFirstEffect === null) {
          const observed = readCoordinatorState(root, "binding-a", "project-a");
          assert.equal(observed.status, "completed");
          assert.ok(observed.value);
          preparedAtFirstEffect =
            observed.value?.tasks.filter(
              (entry) =>
                entry.state === "starting" &&
                entry.startPhase === "handoff_prepared",
            ).length ?? null;
        }
        assert.equal(await attempt.observeStarted?.(), true);
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return completedAfterStart(attempt);
      },
    },
    input,
  );
  assert.equal(outcome.status, "completed");
  assert.equal(preparedAtFirstEffect, 1);
  assert.equal(maximumActive, 1);
  assert.equal(outcome.completedTaskIds.length, 7);
  assert.equal(observedOperationIds.size, 7);
});

/**
 * PR-N-03 and PR-Q-01 enforce dependency and conflict reservations across wavesを検証する。
 *
 * @responsibility PR-N-03 and PR-Q-01 enforce dependency and conflict reservations across wavesの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-N-03 and PR-Q-01 enforce dependency and conflict reservations across wavesの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-N-03 and PR-Q-01 enforce dependency and conflict reservations across waves", async (t) => {
  const tasks = [
    task("task-a", [], ["shared"]),
    task("task-b", ["task-a"]),
    task("task-c", [], ["shared/file.txt"]),
    task("task-d", [], ["other.txt"]),
  ];
  const { input } = fixture(t, tasks, 5);
  const startedItems: string[] = [];
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        const taskId = (attempt.taskRequest as { taskId: string }).taskId;
        startedItems.push(taskId);
        await new Promise((resolve) => setTimeout(resolve, 2));
        return completed(attempt);
      },
    },
    input,
  );
  assert.equal(outcome.status, "completed");
  assert.deepEqual(startedItems, ["task-a", "task-b", "task-c", "task-d"]);
  assert.ok(
    outcome.completedTaskIds.indexOf("task-a") <
      outcome.completedTaskIds.indexOf("task-b"),
  );
  assert.ok(
    outcome.completedTaskIds.indexOf("task-a") <
      outcome.completedTaskIds.indexOf("task-c"),
  );
  assert.equal(new Set(outcome.completedTaskIds).size, 4);
});

/**
 * PR-A-03 rejects a result from another attempt without projecting successを検証する。
 *
 * @responsibility PR-A-03 rejects a result from another attempt without projecting successの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-03 rejects a result from another attempt without projecting successの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-03 rejects a result from another attempt without projecting success", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => ({
        ...(await completed(attempt)),
        attemptId: "another-attempt",
      }),
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.reason, "orchestrator_task_recovery_required");
  assert.equal(outcome.manualRecoveryRequired, true);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  assert.ok(state.value);
  assert.equal(
    state.status === "completed" && state.value.tasks[0]?.state,
    "recovery_required",
  );
});

/**
 * PR-A-03 rejects malformed and differently bound Single Task resultsを検証する。
 *
 * @responsibility PR-A-03 rejects malformed and differently bound Single Task resultsの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-03 rejects malformed and differently bound Single Task resultsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-03 rejects malformed and differently bound Single Task results", async (t) => {
  const cases = [
    ["contract", { contract: "wrong-contract" }],
    ["operation", { operationId: "other-operation" }],
    ["authority", { authorityBindingId: "other-authority" }],
    ["missing-recovery", { recoveryIds: undefined }],
    ["extra-field", { extra: true }],
  ] as const;
  for (const [name, override] of cases) {
    await t.test(name, async (subtest) => {
      const { root, input } = fixture(subtest, [task("task-a")], 1);
      const outcome = await runCoordinatorOperation(
        {
          runSingleTaskAttempt: async (attempt) =>
            ({
              ...(await completed(attempt)),
              ...override,
            }) as CoordinatorSingleTaskResult,
        },
        input,
      );
      assert.equal(outcome.status, "blocked");
      assert.equal(outcome.reason, "orchestrator_task_recovery_required");
      const state = readCoordinatorState(root, "binding-a", "project-a");
      assert.equal(state.status, "completed");
      assert.ok(state.value);
      assert.ok(state.value);
      assert.equal(
        state.status === "completed" && state.value?.tasks[0]?.state,
        "recovery_required",
      );
    });
  }
});

/**
 * PR-A-03 rejects recovery identifiers that durable Project State cannot storeを検証する。
 *
 * @responsibility PR-A-03 rejects recovery identifiers that durable Project State cannot storeの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-03 rejects recovery identifiers that durable Project State cannot storeの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-03 rejects recovery identifiers that durable Project State cannot store", async (t) => {
  for (const recoveryId of [
    "recovery/a",
    "recovery id",
    "recovery\u0001id",
    `r${"x".repeat(512)}`,
  ]) {
    await t.test(JSON.stringify(recoveryId).slice(0, 40), async (subtest) => {
      const { root, input } = fixture(subtest, [task("task-a")], 1);
      const outcome = await runCoordinatorOperation(
        {
          runSingleTaskAttempt: async (attempt) => ({
            ...(await completed(attempt)),
            status: "blocked",
            reason: "external_recovery_required",
            effectState: "unknown",
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            recoveryIds: [recoveryId],
          }),
        },
        input,
      );
      assert.equal(outcome.status, "blocked");
      assert.equal(outcome.reason, "orchestrator_task_recovery_required");
      const state = readCoordinatorState(root, "binding-a", "project-a");
      assert.equal(state.status, "completed");
      assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
      assert.equal(
        state.value?.tasks[0]?.recoveryObligations[0]?.kind,
        "runtime_process",
      );
    });
  }
});

/**
 * 下位Adapterがruntime_process義務を自己発行しても通常再入場へ採用しないを検証する。
 *
 * @responsibility 下位Adapterがruntime_process義務を自己発行しても通常再入場へ採用しないの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 下位Adapterがruntime_process義務を自己発行しても通常再入場へ採用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("下位Adapterがruntime_process義務を自己発行しても通常再入場へ採用しない", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const forged = `runtime-process.11111111-1111-4111-8111-111111111111.restart-${"a".repeat(40)}`;
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) =>
        ({
          ...(await completed(attempt)),
          status: "blocked",
          reason: "forged_process_recovery",
          effectState: "unknown",
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          processRestartRequired: true,
          candidateId: null,
          recoveryIds: [forged],
          recoveryObligations: [
            { kind: "runtime_process" as const, recoveryId: forged },
          ],
        }) as unknown as CoordinatorSingleTaskResult,
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(outcome.processRestartRequired, true);
  assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
  assert.equal(
    state.value?.tasks[0]?.recoveryObligations[0]?.kind,
    "runtime_process",
  );
});

/**
 * 開始後の候補回収IDだけでは外部Effectの不明状態を解消しないを検証する。
 *
 * @responsibility 開始後の候補回収IDだけでは外部Effectの不明状態を解消しないの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 開始後の候補回収IDだけでは外部Effectの不明状態を解消しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("開始後の候補回収IDだけでは外部Effectの不明状態を解消しない", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const candidateRecoveryId = "candidate.recovery-a";
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => ({
        ...(await completed(attempt)),
        status: "blocked",
        reason: "candidate_cleanup_unknown",
        effectState: "unknown",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        candidateId: null,
        recoveryIds: [candidateRecoveryId],
        recoveryObligations: [
          { kind: "candidate" as const, recoveryId: candidateRecoveryId },
        ],
      }),
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.processRestartRequired, true);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
  assert.deepEqual(
    state.value?.tasks[0]?.recoveryObligations.map((entry) => entry.kind),
    ["candidate", "runtime_process"],
  );
});

/**
 * PR-A-03 enforces result correlations and propagates process restartを検証する。
 *
 * @responsibility PR-A-03 enforces result correlations and propagates process restartの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-03 enforces result correlations and propagates process restartの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-03 enforces result correlations and propagates process restart", async (t) => {
  const cases = [
    {
      name: "completed-no-effect",
      override: { effectState: "no_effect" as const },
      restart: true,
    },
    {
      name: "completed-restart",
      override: { processRestartRequired: true },
      restart: true,
    },
    {
      name: "unknown-with-cleanup",
      override: {
        status: "blocked" as const,
        effectState: "unknown" as const,
        cleanupConfirmed: true,
        manualRecoveryRequired: true,
      },
      restart: true,
    },
    {
      name: "blocked-restart",
      override: {
        status: "blocked" as const,
        reason: "restart_required",
        effectState: "no_effect" as const,
        processRestartRequired: true,
      },
      restart: true,
    },
    {
      name: "cancelled-no-effect-after-start",
      override: {
        status: "cancelled" as const,
        reason: "cancelled_after_effect_start",
        effectState: "no_effect" as const,
      },
      restart: true,
    },
  ];
  for (const scenario of cases) {
    await t.test(scenario.name, async (subtest) => {
      const { root, input } = fixture(subtest, [task("task-a")], 1);
      const outcome = await runCoordinatorOperation(
        {
          runSingleTaskAttempt: async (attempt) => ({
            ...(await completed(attempt)),
            ...scenario.override,
          }),
        },
        input,
      );
      assert.equal(outcome.status, "blocked");
      assert.equal(outcome.manualRecoveryRequired, true);
      assert.equal(outcome.processRestartRequired, scenario.restart);
      const state = readCoordinatorState(root, "binding-a", "project-a");
      assert.ok(state.value);
      assert.equal(
        state.status === "completed" && state.value.tasks[0]?.state,
        "recovery_required",
      );
      if (scenario.restart && state.status === "completed") {
        assert.equal(state.value.tasks[0]?.recoveryUnresolved, true);
        assert.equal(
          state.value.tasks[0]?.recoveryObligations[0]?.kind,
          "runtime_process",
        );
        assert.match(
          state.value.tasks[0]?.recoveryObligations[0]?.recoveryId ?? "",
          /^runtime-process\.[0-9a-f-]{36}\.restart-[0-9a-f]{40}$/u,
        );
      }
    });
  }
});

/**
 * PR-A-03 stops later waves when a Task requires process restartを検証する。
 *
 * @responsibility PR-A-03 stops later waves when a Task requires process restartの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-03 stops later waves when a Task requires process restartの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-03 stops later waves when a Task requires process restart", async (t) => {
  const { input } = fixture(t, [task("task-a"), task("task-b")], 1);
  const startedItems: string[] = [];
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        startedItems.push((attempt.taskRequest as { taskId: string }).taskId);
        return {
          ...(await completed(attempt)),
          status: "blocked",
          reason: "restart_required",
          effectState: "no_effect",
          processRestartRequired: true,
        };
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.processRestartRequired, true);
  assert.deepEqual(startedItems, ["task-a"]);
});

/**
 * runtime_process義務は同じTask attemptとoperationにだけ結合するを検証する。
 *
 * @responsibility runtime_process義務は同じTask attemptとoperationにだけ結合するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus runtime_process義務は同じTask attemptとoperationにだけ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("runtime_process義務は同じTask attemptとoperationにだけ結合する", async (t) => {
  const { root, input } = fixture(t, [task("task-a"), task("task-b")], 2);
  let firstRecoveryId = "";
  const outcome = await runCoordinatorOperation(
    {
      poisonAfterCleanupUnknown: () => undefined,
      runSingleTaskAttempt: async (attempt) => {
        await attempt.observeStarted?.();
        if ((attempt.taskRequest as { taskId: string }).taskId === "task-a") {
          firstRecoveryId = createRuntimeProcessRecoveryIdentity(
            attempt.attemptId,
            attempt.operationId,
          );
          return {
            ...completedAfterStart(attempt),
            status: "blocked",
            reason: "restart_required",
            effectState: "unknown",
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            processRestartRequired: true,
          };
        }
        return {
          ...completedAfterStart(attempt),
          status: "blocked",
          reason: "cross_task_recovery_replay",
          effectState: "unknown",
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          processRestartRequired: true,
          recoveryIds: [firstRecoveryId],
          recoveryObligations: [
            { kind: "runtime_process" as const, recoveryId: firstRecoveryId },
          ],
        } as unknown as CoordinatorSingleTaskResult;
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.processRestartRequired, true);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  const first = state.value?.tasks.find(
    (entry) => entry.definition.id === "task-a",
  );
  const second = state.value?.tasks.find(
    (entry) => entry.definition.id === "task-b",
  );
  assert.equal(first?.recoveryObligations[0]?.recoveryId, firstRecoveryId);
  assert.notEqual(second?.recoveryObligations[0]?.recoveryId, firstRecoveryId);
  assert.deepEqual(second?.recoveryObligations, []);
  assert.equal(second?.attemptId, null);
});

/**
 * 下位実行へ委譲後のthrowは開始観測の有無にかかわらずProcessを再利用しないを検証する。
 *
 * @responsibility 下位実行へ委譲後のthrowは開始観測の有無にかかわらずProcessを再利用しないの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 下位実行へ委譲後のthrowは開始観測の有無にかかわらずProcessを再利用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("下位実行へ委譲後のthrowは開始観測の有無にかかわらずProcessを再利用しない", async (t) => {
  await t.test("after-start", async (subtest) => {
    const { root, input } = fixture(subtest, [task("task-a")], 1);
    let poisoned = 0;
    const outcome = await runCoordinatorOperation(
      {
        poisonAfterCleanupUnknown: () => {
          poisoned += 1;
        },
        runSingleTaskAttempt: async (attempt) => {
          assert.equal(await attempt.observeStarted?.(), true);
          throw new Error("runner_failed_after_effect_start");
        },
      },
      input,
    );
    assert.equal(outcome.processRestartRequired, true);
    assert.equal(poisoned, 1);
    const state = readCoordinatorState(root, "binding-a", "project-a");
    assert.equal(
      state.value?.tasks[0]?.recoveryObligations[0]?.kind,
      "runtime_process",
    );
  });
  await t.test("before-start-observation", async (subtest) => {
    const { root, input } = fixture(subtest, [task("task-a")], 1);
    let poisoned = 0;
    const outcome = await runCoordinatorOperation(
      {
        poisonAfterCleanupUnknown: () => {
          poisoned += 1;
        },
        runSingleTaskAttempt: async () => {
          throw new Error("runner_failed_before_effect_start");
        },
      },
      input,
    );
    assert.equal(outcome.processRestartRequired, true);
    assert.equal(poisoned, 1);
    assert.equal(outcome.effectState, "unknown");
    const state = readCoordinatorState(root, "binding-a", "project-a");
    assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
  });
});

/**
 * PR-A-04 releases the physical lease when a post-acquire Queue write becomes unobservableを検証する。
 *
 * @responsibility PR-A-04 releases the physical lease when a post-acquire Queue write becomes unobservableの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-04 releases the physical lease when a post-acquire Queue write becomes unobservableの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-04 releases the physical lease when a post-acquire Queue write becomes unobservable", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const location = path.join(root, ".crdd", "coordinator", "state.json");
  const original = fs.openSync;
  let isInjected = false;
  let outcome: Awaited<ReturnType<typeof runCoordinatorOperation>>;
  try {
    outcome = await runCoordinatorOperation(
      {
        runSingleTaskAttempt: async (attempt) => {
          Reflect.set(fs, "openSync", ((
            ...args: Parameters<typeof fs.openSync>
          ) => {
            if (!isInjected && String(args[0]) === location) {
              isInjected = true;
              Reflect.set(fs, "openSync", original);
              throw new Error("snapshot_read_unconfirmed");
            }
            return Reflect.apply(original, fs, args);
          }) as typeof fs.openSync);
          return completed(attempt);
        },
      },
      input,
    );
  } finally {
    Reflect.set(fs, "openSync", original);
  }
  assert.equal(isInjected, true);
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.manualRecoveryRequired, true);
  const locks = path.join(root, ".crdd", "tmp", "orchestrator-leases");
  assert.deepEqual(
    fs
      .readdirSync(locks)
      .filter((name) => name.startsWith("project-operation-project-a-queue-a")),
    [],
  );
  const before = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(before.status, "completed");
  assert.equal(
    before.status === "completed" && before.value.ownerGeneration,
    null,
  );
  const reconciled = createCoordinatorPersistencePorts(
    root,
    "binding-a",
  ).lease.reconcileOperationOwnerLoss("project-a", "queue-a", () => {
    throw new Error("released evidence must avoid owner observation");
  });
  assert.equal(reconciled.status, "completed");
  assert.equal(
    reconciled.status === "completed" && reconciled.value.ownerGeneration,
    null,
  );
});

/**
 * PR-A-03 treats a synchronous failure after delegation as an unknown handoffを検証する。
 *
 * @responsibility PR-A-03 treats a synchronous failure after delegation as an unknown handoffの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-03 treats a synchronous failure after delegation as an unknown handoffの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-03 treats a synchronous failure after delegation as an unknown handoff", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: () => {
        throw new Error("synchronous runner failure");
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.reason, "orchestrator_task_recovery_required");
  assert.equal(outcome.cleanupConfirmed, false);
  assert.equal(outcome.manualRecoveryRequired, true);
  assert.equal(outcome.effectState, "unknown");
  assert.equal(outcome.processRestartRequired, true);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  assert.ok(state.value);
  assert.equal(
    state.status === "completed" && state.value?.tasks[0]?.state,
    "recovery_required",
  );
  assert.equal(state.value?.tasks[0]?.recoveryUnresolved, true);
});

/**
 * PR-A-05 keeps capacity and conflict reserved when cleanup is unknownを検証する。
 *
 * @responsibility PR-A-05 keeps capacity and conflict reserved when cleanup is unknownの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-A-05 keeps capacity and conflict reserved when cleanup is unknownの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-A-05 keeps capacity and conflict reserved when cleanup is unknown", async (t) => {
  const { root, input } = fixture(
    t,
    [task("task-a", [], ["shared"]), task("task-b", [], ["shared/file.txt"])],
    1,
  );
  const startedItems: string[] = [];
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        startedItems.push((attempt.taskRequest as { taskId: string }).taskId);
        return {
          ...(await completed(attempt)),
          status: "blocked",
          reason: "cleanup_unknown",
          effectState: "unknown",
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        };
      },
    },
    input,
  );
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.manualRecoveryRequired, true);
  assert.deepEqual(startedItems, ["task-a"]);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.status, "completed");
  assert.ok(state.value);
  assert.equal(
    state.status === "completed" && state.value.tasks[0]?.state,
    "recovery_required",
  );
  assert.equal(
    state.status === "completed" && state.value.tasks[1]?.state,
    "ready",
  );
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(
    queue.status === "completed" && queue.value.state,
    "recovery_required",
  );
  assert.equal(
    queue.status === "completed" && queue.value.ownerGeneration,
    null,
  );
});

/**
 * PR-Q-04 cancels before Task effect and releases durable ownershipを検証する。
 *
 * @responsibility PR-Q-04 cancels before Task effect and releases durable ownershipの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus PR-Q-04 cancels before Task effect and releases durable ownershipの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("PR-Q-04 cancels before Task effect and releases durable ownership", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const controller = new AbortController();
  controller.abort();
  let effects = 0;
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    { ...input, cancellationSignal: controller.signal },
  );
  assert.equal(outcome.status, "cancelled", JSON.stringify(outcome));
  assert.equal(effects, 0);
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(queue.status === "completed" && queue.value.state, "cancelled");
  assert.equal(
    queue.status === "completed" && queue.value.ownerGeneration,
    null,
  );
});

/**
 * Windowsの符号付きFile IDでも状態保存・再読・開始前取消を維持する。
 * @responsibility 共通保存Readerの補正を実Coordinatorの終了条件へ接続する。
 * @trace PRL-IT-012
 * @precondition 自己生成Repository・既存Snapshot・Queueを使用する。
 * @stimulus lstat／fstatを符号付き64bit表現にし取消済み要求を実行する。
 * @observation 保存・再読結果、Task Effect数、Queue終端・Owner解放を確認する。
 * @oracle 取消済みとなりTask Effect0、Queue cancelled、Ownerなし。
 * @cleanup mockを復元し自己生成Repositoryを回収する。
 * @boundary Coordinator→Domain保存Reader→Filesystem。
 */
test("Windowsの上位bit付きIDでも状態保存・再読と開始前取消が成立する", {
  skip: process.platform !== "win32",
}, async (t) => {
  for (const name of ["lstatSync", "fstatSync"] as const) {
    const original = fs[name];
    t.mock.method(fs, name, (...args: unknown[]) => {
      const metadata = Reflect.apply(original, fs, args) as fs.BigIntStats;
      if (typeof metadata.ino === "bigint")
        metadata.ino = BigInt.asIntN(64, metadata.ino | (1n << 63n));
      return metadata;
    });
  }
  const { root, input } = fixture(t, [task("task-a")], 1);
  const controller = new AbortController();
  controller.abort();
  let effects = 0;
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
    },
    { ...input, cancellationSignal: controller.signal },
  );
  assert.equal(outcome.status, "cancelled", outcome.reason);
  assert.equal(effects, 0);
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed", queue.reason);
  if (queue.status !== "completed") throw new Error("queue_read_failed");
  assert.equal(queue.value.state, "cancelled");
  assert.equal(queue.value.ownerGeneration, null);
});

/**
 * 開始準備の保存後、委譲直前の取消はTask Effectを発行しない。
 *
 * @responsibility 耐久的な開始準備とTask委譲の間の取消を閉じる。
 * @trace PRL-IT-012
 * @precondition 単一Taskを持つ自己生成Repositoryを使用する。
 * @stimulus 開始準備が保存された後の時刻取得で取消を通知する。
 * @observation 保存状態、Task呼出し回数、終了結果、回復義務を観測する。
 * @oracle 委譲0回、取消完了、片付け確認済み、合成回復義務なしとなる。
 * @cleanup 登録済みhookが自己生成Repositoryを清掃する。
 * @boundary PRL-IT-012=Related 2 Blocks: 開始準備の保存→Task委譲。
 */
test("開始準備保存後の取消はTaskを委譲せず終了する", async (t) => {
  const { root, input } = fixture(t, [task("task-a")], 1);
  const controller = new AbortController();
  let effects = 0;
  let preparedObserved = false;
  let tick = 0;
  const events: unknown[] = [];
  const outcome = await runCoordinatorOperation(
    {
      now: () => {
        const current = readCoordinatorState(root, "binding-a", "project-a");
        if (
          current.value?.tasks.some(
            (entry) =>
              entry.state === "starting" &&
              entry.startPhase === "handoff_prepared",
          )
        ) {
          preparedObserved = true;
          controller.abort();
        }
        return { monotonicMs: tick++, iso: "2026-10-15T00:00:00.000Z" };
      },
      runSingleTaskAttempt: async (attempt) => {
        effects += 1;
        return completed(attempt);
      },
      executionObservation: {
        recordTaskAttempt: (event) => {
          events.push(event);
          return recorded("cancel-before-delegation");
        },
      },
    },
    { ...input, cancellationSignal: controller.signal },
  );
  assert.equal(preparedObserved, true);
  assert.equal(outcome.status, "cancelled", JSON.stringify(outcome));
  assert.equal(outcome.cleanupConfirmed, true);
  assert.equal(outcome.manualRecoveryRequired, false);
  assert.equal(outcome.processRestartRequired, false);
  assert.equal(effects, 0);
  const state = readCoordinatorState(root, "binding-a", "project-a");
  assert.equal(state.value?.tasks[0]?.state, "cancelled");
  assert.deepEqual(state.value?.tasks[0]?.recoveryObligations, []);
  assert.equal(outcome.effectState, "no_effect");
  assert.equal(events.length, 1);
  const event = events[0] as {
    outcome: { reason: string; effectState: string };
  };
  assert.equal(event.outcome.reason, "single_task_cancelled_before_delegation");
  assert.equal(event.outcome.effectState, "no_effect");
  const queue = readProjectOperationQueueState(root, "binding-a", "queue-a");
  assert.equal(queue.status, "completed");
  assert.equal(queue.status === "completed" && queue.value.state, "cancelled");
});

/**
 * contract remains a partial Coordinator capabilityを検証する。
 *
 * @responsibility contract remains a partial Coordinator capabilityの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus contract remains a partial Coordinator capabilityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("contract remains a partial Coordinator task-management capability", () => {
  assert.deepEqual(describeCoordinatorExecutionContract(), {
    contract: "crdd-coordinator/orchestrator-execution/v1",
    maximumConcurrency: 5,
    externalWaitWhileMutationLockHeld: false,
    cleanupUnknownDisposition: "durable_recovery_and_reservation_retained",
    staleOrOwnedQueueDisposition: "effect_zero_manual_reconciliation",
    taskManagementCapabilityComplete: false,
  });
});

/**
 * Task試行の終了を非Authorityの実行Eventとして一度記録するを検証する。
 *
 * @responsibility Task試行の終了を非Authorityの実行Eventとして一度記録するの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Task試行の終了を非Authorityの実行Eventとして一度記録するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("Task試行の終了を非Authorityの実行Eventとして一度記録する", async (t) => {
  const { input } = fixture(t, [task("task-a")]);
  const events: unknown[] = [];
  let clock = 0;
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: completed,
      executionObservation: {
        recordTaskAttempt: (event) => {
          events.push(event);
          return recorded("event-test");
        },
      },
      now: () => ({
        monotonicMs: clock++ * 25,
        iso: "2026-09-05T00:00:01.000Z",
      }),
    },
    input,
  );
  assert.equal(outcome.status, "completed");
  assert.equal(events.length, 1);
  const event = events[0] as {
    identity: { objectiveId: string; taskId: string };
    outcome: { status: string };
    startedAtMs: number;
    endedAtMs: number;
  };
  assert.equal(event.identity.objectiveId, "objective-a");
  assert.equal(event.identity.taskId, "task-a");
  assert.equal(event.outcome.status, "completed");
  assert.equal(event.endedAtMs - event.startedAtMs, 25);
});

for (const mismatchedField of [
  "attemptId",
  "operationId",
  "authorityBindingId",
  "repositoryRevision",
] as const) {
  /**
   * 別Task結果の${mismatchedField}を実行Eventへ転記しないを検証する。
   *
   * @responsibility 別Task結果の${mismatchedField}を実行Eventへ転記しないの合否判定を所有する。
   * @trace PRL-IT-012
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 別Task結果の${mismatchedField}を実行Eventへ転記しないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
   */
  test(`別Task結果の${mismatchedField}を実行Eventへ転記しない`, async (t) => {
    const { input } = fixture(t, [task("task-a")]);
    const events: unknown[] = [];
    await runCoordinatorOperation(
      {
        runSingleTaskAttempt: async (attempt) => ({
          ...completedAfterStart(attempt),
          [mismatchedField]:
            mismatchedField === "repositoryRevision"
              ? "b".repeat(40)
              : `other-${mismatchedField}`,
          executorProvider: "codex" as const,
        }),
        executionObservation: {
          recordTaskAttempt: (event) => {
            events.push(event);
            return recorded("event-mismatch-test");
          },
        },
      },
      input,
    );
    assert.equal(events.length, 1);
    const observed = events[0] as {
      outcome: { status: string; reason: string };
      provider?: "codex" | "claude";
    };
    assert.deepEqual(observed.outcome, {
      status: "unknown",
      reason: "task_attempt_result_not_observable",
      effectState: "unknown",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      processRestartRequired: true,
    });
    assert.equal(observed.provider, undefined);
  });
}

/**
 * 実行Event記録と二次診断の失敗はTask結果を変えないを検証する。
 *
 * @responsibility 実行Event記録と二次診断の失敗はTask結果を変えないの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行Event記録と二次診断の失敗はTask結果を変えないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("実行Event記録と二次診断の失敗はTask結果を変えない", async (t) => {
  const { input } = fixture(t, [task("task-a")]);
  const publications: unknown[] = [];
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: completed,
      executionObservation: {
        recordTaskAttempt: () => {
          throw new Error("recorder_failed");
        },
        observePublication: (observation) => {
          publications.push(observation);
          throw new Error("diagnostic_failed");
        },
      },
    },
    input,
  );
  assert.equal(outcome.status, "completed");
  assert.deepEqual(publications, [
    {
      status: "unknown",
      reason: "execution_event_recorder_threw",
      effectState: "unknown",
      cleanupConfirmed: false,
    },
  ]);
});

/**
 * 記録未設定を記録成功へ丸めないを検証する。
 *
 * @responsibility 記録未設定を記録成功へ丸めないの合否判定を所有する。
 * @trace PRL-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 記録未設定を記録成功へ丸めないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("記録未設定を記録成功へ丸めない", async (t) => {
  const { input } = fixture(t, [task("task-a")]);
  const publications: unknown[] = [];
  const outcome = await runCoordinatorOperation(
    {
      runSingleTaskAttempt: completed,
      executionObservation: {
        observePublication: (observation) => publications.push(observation),
      },
    },
    input,
  );
  assert.equal(outcome.status, "completed");
  assert.equal(
    (publications[0] as { status: string }).status,
    "not_configured",
  );
});

for (const invalidClock of [
  { started: 20, ended: 10 },
  { started: Number.NaN, ended: 10 },
  { started: 10, ended: Number.POSITIVE_INFINITY },
]) {
  /**
   * 不正な時間差を0msの観測値へ補正しないを検証する。
   *
   * @responsibility 不正な時間差を0msの観測値へ補正しないの合否判定を所有する。
   * @trace PRL-IT-012
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus 不正な時間差を0msの観測値へ補正しないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary PRL-IT-012=Direct Boundary: coordinator Test Source→対象契約
   */
  test("不正な時間差を0msの観測値へ補正しない", async (t) => {
    const { input } = fixture(t, [task("task-a")]);
    const events: unknown[] = [];
    let invocation = 0;
    await runCoordinatorOperation(
      {
        runSingleTaskAttempt: completed,
        executionObservation: {
          recordTaskAttempt: (event) => {
            events.push(event);
            return recorded("event-clock-test");
          },
        },
        now: () => {
          invocation += 1;
          return {
            monotonicMs:
              invocation === 1 ? invalidClock.started : invalidClock.ended,
            iso: "2026-09-05T00:00:01.000Z",
          };
        },
      },
      input,
    );
    assert.equal(events.length, 1);
    const observed = events[0] as { startedAtMs: number; endedAtMs: number };
    assert.equal(observed.startedAtMs, invalidClock.started);
    assert.equal(observed.endedAtMs, invalidClock.ended);
  });
}
