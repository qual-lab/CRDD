/**
 * execution-intelligence:integration:storeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility execution-intelligence:integration:storeが所有する検証責務を実行する。
 * @trace ERP-IT-001
 * @level IT
 * @scope execution、intelligence、store、immutable
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createExecutionIntelligenceRecorder,
  createTaskAttemptSettledEvent,
  readExecutionIntelligence,
  verifyExecutionIntelligenceRepositoryRoot,
  writeExecutionIntelligenceEvent,
  usageNotObserved,
  type VerifiedExecutionRepositoryRoot,
} from "../../src/index.ts";
import { createBoundExecutionIntelligenceRecorder } from "../../src/application/execution-intelligence-recorder.ts";
import {
  readExecutionIntelligenceWithRuntimeDataArea,
  writeExecutionIntelligenceEventWithRuntimeDataArea,
} from "../../src/store/execution-intelligence-store.ts";

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERP-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-execution-store-"));
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

/**
 * verifiedRootのTest準備責務を実行する。
 *
 * @responsibility verifiedRootがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERP-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus verifiedRootを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
function verifiedRoot(root: string): VerifiedExecutionRepositoryRoot {
  const observed = verifyExecutionIntelligenceRepositoryRoot(root);
  assert.equal(observed.status, "completed");
  if (observed.status !== "completed") throw new Error("root_not_verified");
  return observed.root;
}

/**
 * eventForTaskのTest準備責務を実行する。
 *
 * @responsibility eventForTaskがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERP-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus eventForTaskを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
function eventForTask(taskId: string) {
  return createTaskAttemptSettledEvent({
    occurredAt: "2026-09-05T00:00:01.000Z",
    identity: {
      projectId: "project-a",
      milestoneId: "milestone-a",
      objectiveId: "objective-a",
      taskId,
      attemptId: `attempt-${taskId}`,
      operationId: "operation-a",
    },
    outcome: {
      status: "completed",
      reason: "task_completed",
      effectState: "settled",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
    },
    execution: {
      role: "executor",
      provider: { state: "not_observed", reason: "provider_not_reported" },
      model: { state: "not_observed", reason: "model_not_reported" },
      inputStrategyRef: {
        state: "observed",
        value: "test/input/v1",
        source: "integration_fixture",
      },
      durationMs: {
        state: "observed",
        value: 10,
        source: "integration_clock",
      },
      usage: usageNotObserved("usage_not_reported"),
      humanActiveMs: {
        state: "not_observed",
        reason: "human_time_not_reported",
      },
    },
    quality: {
      state: "not_applicable",
      reason: "attempt_settlement_is_not_acceptance",
    },
  });
}

/**
 * eventのTest準備責務を実行する。
 *
 * @responsibility eventがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERP-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus eventを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
function event() {
  return eventForTask("task-a");
}

/**
 * operationDirectoryのTest準備責務を実行する。
 *
 * @responsibility operationDirectoryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERP-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus operationDirectoryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
function operationDirectory(root: string) {
  return path.join(root, ".crdd", "execution", "operation-a");
}

/**
 * eventDirectoryのTest準備責務を実行する。
 *
 * @responsibility eventDirectoryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERP-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus eventDirectoryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
function eventDirectory(root: string) {
  return path.join(operationDirectory(root), "events");
}

/**
 * Runtime Data Ignore失敗の意味を最終Publicationまで保持するを検証する。
 *
 * @responsibility Runtime Data Ignore失敗の意味を最終Publicationまで保持するの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Runtime Data Ignore失敗の意味を最終Publicationまで保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("Runtime Data Ignore失敗の意味を最終Publicationまで保持する", (t) => {
  const root = fixture(t);
  const publication = writeExecutionIntelligenceEventWithRuntimeDataArea(
    verifiedRoot(root),
    event(),
    (() =>
      Object.freeze({
        status: "blocked" as const,
        reason: "repository_runtime_data_ignore_registration_blocked" as const,
        effectIssued: true,
        effectStateUnknown: true,
        effectConfirmation: "unknown" as const,
        cleanupConfirmed: false,
        retryAllowed: false,
        recoveryReference: "repository-local-ignore.test-reference",
        repositoryPathReported: false as const,
      })) as never,
  );
  assert.deepEqual(publication, {
    status: "blocked",
    reason: "repository_runtime_data_ignore_registration_blocked",
    effectState: "unknown",
    effectIssued: true,
    effectStateUnknown: true,
    cleanupConfirmed: false,
    retryAllowed: false,
    manualRecoveryRequired: true,
    residualArtifactIds: [],
    recoveryReference: "repository-local-ignore.test-reference",
  });
  assert.equal(fs.existsSync(path.join(root, ".crdd", "execution")), false);
});

/**
 * Runtime Data Effect不明はcleanup済みでもRead／Writeで手動回復を保持するを検証する。
 *
 * @responsibility Runtime Data Effect不明はcleanup済みでもRead／Writeで手動回復を保持するの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Runtime Data Effect不明はcleanup済みでもRead／Writeで手動回復を保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("Runtime Data Effect不明はcleanup済みでもRead／Writeで手動回復を保持する", (t) => {
  const root = fixture(t);
  const recoveryReference = "repository-local-ignore.test-reference";
  /**
   * blockedAreaのTest準備責務を実行する。
   *
   * @responsibility blockedAreaがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERP-IT-001
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus blockedAreaを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
   */
  const blockedArea = (() =>
    Object.freeze({
      status: "blocked" as const,
      reason: "repository_runtime_data_ignore_registration_blocked" as const,
      effectIssued: true,
      effectStateUnknown: true,
      effectConfirmation: "unknown" as const,
      cleanupConfirmed: true,
      retryAllowed: false,
      recoveryReference,
      repositoryPathReported: false as const,
    })) as never;
  const expected = {
    status: "blocked",
    reason: "repository_runtime_data_ignore_registration_blocked",
    effectState: "unknown",
    effectIssued: true,
    effectStateUnknown: true,
    cleanupConfirmed: true,
    retryAllowed: false,
    manualRecoveryRequired: true,
    residualArtifactIds: [],
    recoveryReference,
  };
  assert.deepEqual(
    writeExecutionIntelligenceEventWithRuntimeDataArea(
      verifiedRoot(root),
      event(),
      blockedArea,
    ),
    expected,
  );
  assert.deepEqual(
    readExecutionIntelligenceWithRuntimeDataArea(
      verifiedRoot(root),
      blockedArea,
    ),
    expected,
  );
  assert.equal(fs.existsSync(path.join(root, ".crdd", "execution")), false);
});

/**
 * an embedded TypeScript application can record and read through one public recorderを検証する。
 *
 * @responsibility an embedded TypeScript application can record and read through one public recorderの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus an embedded TypeScript application can record and read through one public recorderの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("an embedded TypeScript application can record and read through one public recorder", (t) => {
  const root = fixture(t);
  const created = createExecutionIntelligenceRecorder(root);
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw new Error("recorder_not_ready");
  const source = event();
  const publication = created.recorder.recordTaskAttempt({
    occurredAt: source.occurredAt,
    identity: source.identity,
    execution: source.execution,
    outcome: source.outcome,
    quality: source.quality,
  });
  assert.equal(publication.status, "completed");
  const observedResult = created.recorder.read();
  assert.equal(observedResult.status, "completed");
  if (observedResult.status !== "completed")
    throw new Error("events_not_observed");
  assert.equal(observedResult.events.length, 1);
  assert.equal(observedResult.events[0]?.eventId, source.eventId);
});

/**
 * Recorderはtop-level Accessorを実行せずStore Effect 0で拒否するを検証する。
 *
 * @responsibility Recorderはtop-level Accessorを実行せずStore Effect 0で拒否するの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recorderはtop-level Accessorを実行せずStore Effect 0で拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("Recorderはtop-level Accessorを実行せずStore Effect 0で拒否する", (t) => {
  const root = fixture(t);
  const created = createExecutionIntelligenceRecorder(root);
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw new Error("recorder_not_ready");
  const source = event();
  let getterCalls = 0;
  const result = created.recorder.recordTaskAttempt({
    occurredAt: source.occurredAt,
    get identity() {
      getterCalls += 1;
      return source.identity;
    },
    execution: source.execution,
    outcome: source.outcome,
    quality: source.quality,
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.effectState, "no_effect");
  assert.equal(getterCalls, 0);
  assert.equal(fs.existsSync(path.join(root, ".crdd", "execution")), false);
});

/**
 * Recorderは生成後のStore例外を入力不正やEffect 0へ偽装しないを検証する。
 *
 * @responsibility Recorderは生成後のStore例外を入力不正やEffect 0へ偽装しないの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recorderは生成後のStore例外を入力不正やEffect 0へ偽装しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("Recorderは生成後のStore例外を入力不正やEffect 0へ偽装しない", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  let storeCalls = 0;
  const recorder = createBoundExecutionIntelligenceRecorder(capability, () => {
    storeCalls += 1;
    throw new Error("store_boundary_failed");
  });
  const source = event();
  assert.throws(
    () =>
      recorder.recordTaskAttempt({
        occurredAt: source.occurredAt,
        identity: source.identity,
        execution: source.execution,
        outcome: source.outcome,
        quality: source.quality,
      }),
    /store_boundary_failed/u,
  );
  assert.equal(storeCalls, 1);
  assert.equal(fs.existsSync(path.join(root, ".crdd", "execution")), false);
});

/**
 * runWriterのTest準備責務を実行する。
 *
 * @responsibility runWriterがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERP-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runWriterを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
function runWriter(root: string, reason: string) {
  return new Promise<Readonly<{ exitCode: number | null; result: unknown }>>(
    (resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          path.resolve("tests/fixtures/execution-intelligence-store-writer.ts"),
          root,
          reason,
        ],
        { cwd: path.resolve("."), stdio: ["ignore", "pipe", "pipe"] },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8").on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.setEncoding("utf8").on("data", (chunk) => {
        stderr += chunk;
      });
      child.once("error", reject);
      child.once("close", (exitCode) => {
        if (stderr) reject(new Error(stderr));
        else resolve({ exitCode, result: JSON.parse(stdout) as unknown });
      });
    },
  );
}

/**
 * writes immutable events under repository-local .crdd and reads a summaryを検証する。
 *
 * @responsibility writes immutable events under repository-local .crdd and reads a summaryの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus writes immutable events under repository-local .crdd and reads a summaryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("writes immutable events under repository-local .crdd and reads a summary", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const created = event();
  assert.equal(
    writeExecutionIntelligenceEvent(capability, created).status,
    "completed",
  );
  assert.equal(
    writeExecutionIntelligenceEvent(capability, created).status,
    "completed",
  );
  const observedResult = readExecutionIntelligence(capability);
  assert.equal(observedResult.status, "completed");
  if (observedResult.status !== "completed")
    throw new Error("observation_failed");
  assert.equal(observedResult.events.length, 1);
  assert.equal(observedResult.summary.eventCount, 1);
  assert.equal(
    fs.existsSync(path.join(eventDirectory(root), `${created.eventId}.json`)),
    true,
  );
});

/**
 * rejects conflicting content for the same exact identityを検証する。
 *
 * @responsibility rejects conflicting content for the same exact identityの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus rejects conflicting content for the same exact identityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("rejects conflicting content for the same exact identity", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const created = event();
  assert.equal(
    writeExecutionIntelligenceEvent(capability, created).status,
    "completed",
  );
  const changed = {
    ...created,
    outcome: { ...created.outcome, reason: "different_reason" },
  };
  assert.equal(
    writeExecutionIntelligenceEvent(capability, changed).reason,
    "execution_event_identity_conflict",
  );
});

/**
 * Accessorを含むEventは永続化前に拒否してStoreを作らないを検証する。
 *
 * @responsibility Accessorを含むEventは永続化前に拒否してStoreを作らないの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Accessorを含むEventは永続化前に拒否してStoreを作らないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("Accessorを含むEventは永続化前に拒否してStoreを作らない", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const base = event();
  let getterCalls = 0;
  const result = writeExecutionIntelligenceEvent(capability, {
    ...base,
    outcome: {
      ...base.outcome,
      get status() {
        getterCalls += 1;
        return getterCalls < 3 ? "completed" : "forged";
      },
    },
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "execution_event_invalid");
  assert.equal(result.effectState, "no_effect");
  assert.equal(getterCalls, 0);
  assert.equal(fs.existsSync(path.join(root, ".crdd", "execution")), false);
});

/**
 * fails closed when stored content is corruptを検証する。
 *
 * @responsibility fails closed when stored content is corruptの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus fails closed when stored content is corruptの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("fails closed when stored content is corrupt", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const created = event();
  assert.equal(
    writeExecutionIntelligenceEvent(capability, created).status,
    "completed",
  );
  fs.writeFileSync(
    path.join(eventDirectory(root), `${created.eventId}.json`),
    "{}\n",
    "utf8",
  );
  assert.deepEqual(readExecutionIntelligence(capability), {
    status: "blocked",
    reason: "execution_event_store_observation_failed",
    effectState: "no_effect",
    effectIssued: false,
    effectStateUnknown: false,
    cleanupConfirmed: true,
    retryAllowed: false,
    manualRecoveryRequired: false,
    residualArtifactIds: [],
    recoveryReference: null,
  });
});

/**
 * does not replace a non-directory repository-local boundaryを検証する。
 *
 * @responsibility does not replace a non-directory repository-local boundaryの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus does not replace a non-directory repository-local boundaryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("does not replace a non-directory repository-local boundary", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  fs.writeFileSync(path.join(root, ".crdd"), "occupied\n", "utf8");
  const result = writeExecutionIntelligenceEvent(capability, event());
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "execution_event_store_unavailable");
  assert.equal(result.effectState, "no_effect");
  assert.equal(fs.readFileSync(path.join(root, ".crdd"), "utf8"), "occupied\n");
});

/**
 * does not hide an unknown residual file from the store resultを検証する。
 *
 * @responsibility does not hide an unknown residual file from the store resultの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus does not hide an unknown residual file from the store resultの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("does not hide an unknown residual file from the store result", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  assert.equal(
    writeExecutionIntelligenceEvent(capability, event()).status,
    "completed",
  );
  fs.writeFileSync(
    path.join(eventDirectory(root), "unknown.pending"),
    "residual\n",
    "utf8",
  );
  assert.deepEqual(readExecutionIntelligence(capability), {
    status: "blocked",
    reason: "execution_event_store_observation_failed",
    effectState: "no_effect",
    effectIssued: false,
    effectStateUnknown: false,
    cleanupConfirmed: true,
    retryAllowed: false,
    manualRecoveryRequired: false,
    residualArtifactIds: [],
    recoveryReference: null,
  });
});

/**
 * 物理保持削除を公開せず自己申告のEvidenceでEventを変更しないを検証する。
 *
 * @responsibility 物理保持削除を公開せず自己申告のEvidenceでEventを変更しないの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 物理保持削除を公開せず自己申告のEvidenceでEventを変更しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("物理保持削除を公開せず自己申告のEvidenceでEventを変更しない", async (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const created = event();
  writeExecutionIntelligenceEvent(capability, created);
  const observedResult = readExecutionIntelligence(capability);
  assert.equal(observedResult.status, "completed");
  if (observedResult.status !== "completed")
    throw new Error("observation_failed");
  const before = fs.readFileSync(
    path.join(eventDirectory(root), `${created.eventId}.json`),
  );
  const publicApi = await import("../../src/index.ts");
  assert.equal("applyExecutionIntelligenceRetention" in publicApi, false);
  const afterResult = readExecutionIntelligence(capability);
  assert.equal(afterResult.status, "completed");
  if (afterResult.status === "completed")
    assert.equal(afterResult.events.length, 1);
  assert.deepEqual(
    fs.readFileSync(path.join(eventDirectory(root), `${created.eventId}.json`)),
    before,
  );
});

/**
 * Repository RootはexactなVCS worktreeだけを実行時能力にするを検証する。
 *
 * @responsibility Repository RootはexactなVCS worktreeだけを実行時能力にするの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository RootはexactなVCS worktreeだけを実行時能力にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("Repository RootはexactなVCS worktreeだけを実行時能力にする", (t) => {
  const root = fixture(t);
  const child = path.join(root, "child");
  fs.mkdirSync(child);
  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(root).status,
    "completed",
  );
  assert.deepEqual(verifyExecutionIntelligenceRepositoryRoot(child), {
    status: "blocked",
    reason: "execution_repository_root_invalid",
  });
  const nonRepository = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-execution-nonrepo-"),
  );
  t.after(() => fs.rmSync(nonRepository, { recursive: true, force: true }));
  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(nonRepository).status,
    "blocked",
  );
  for (const boundaryKind of ["file", "directory"] as const) {
    const fakeRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), `crdd-execution-fake-git-${boundaryKind}-`),
    );
    t.after(() => fs.rmSync(fakeRoot, { recursive: true, force: true }));
    const fakeBoundary = path.join(fakeRoot, ".git");
    if (boundaryKind === "file")
      fs.writeFileSync(fakeBoundary, "gitdir: nowhere\n", "utf8");
    else fs.mkdirSync(fakeBoundary);
    assert.deepEqual(createExecutionIntelligenceRecorder(fakeRoot), {
      status: "blocked",
      reason: "execution_repository_root_invalid",
    });
    assert.equal(fs.existsSync(path.join(fakeRoot, ".crdd")), false);
  }
  const forged = Object.freeze({
    contract: "crdd-version-control/repository-location/v1" as const,
  });
  assert.equal(
    writeExecutionIntelligenceEvent(forged, event()).status,
    "blocked",
  );
});

/**
 * 能力発行後にGit境界が失効した場合はStore Effect 0で拒否するを検証する。
 *
 * @responsibility 能力発行後にGit境界が失効した場合はStore Effect 0で拒否するの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 能力発行後にGit境界が失効した場合はStore Effect 0で拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("能力発行後にGit境界が失効した場合はStore Effect 0で拒否する", (t) => {
  for (const replacement of [
    "absent",
    "fake_file",
    "fake_directory",
  ] as const) {
    const root = fixture(t);
    const created = createExecutionIntelligenceRecorder(root);
    assert.equal(created.status, "completed");
    if (created.status !== "completed") throw new Error("recorder_not_ready");
    const gitBoundary = path.join(root, ".git");
    fs.rmSync(gitBoundary, { recursive: true, force: true });
    if (replacement === "fake_file")
      fs.writeFileSync(gitBoundary, "gitdir: nowhere\n", "utf8");
    if (replacement === "fake_directory") fs.mkdirSync(gitBoundary);

    const result = created.recorder.recordEvent(eventForTask(replacement));
    assert.equal(result.status, "blocked");
    assert.equal(result.effectState, "no_effect");
    assert.equal(fs.existsSync(path.join(root, ".crdd")), false);
  }
});

/**
 * 並行Processの同一Eventは冪等で、異なる内容は上書きしないを検証する。
 *
 * @responsibility 並行Processの同一Eventは冪等で、異なる内容は上書きしないの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 並行Processの同一Eventは冪等で、異なる内容は上書きしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("並行Processの同一Eventは冪等で、異なる内容は上書きしない", async (t) => {
  const sameRoot = fixture(t);
  const sameResults = await Promise.all([
    runWriter(sameRoot, "task_completed"),
    runWriter(sameRoot, "task_completed"),
  ]);
  assert.ok(
    sameResults.every((entry) => entry.exitCode === 0),
    JSON.stringify(sameResults),
  );
  assert.ok(
    sameResults.every(
      (entry) => (entry.result as { status: string }).status === "completed",
    ),
    JSON.stringify(sameResults),
  );

  const conflictRoot = fixture(t);
  const conflictResults = await Promise.all([
    runWriter(conflictRoot, "task_completed_a"),
    runWriter(conflictRoot, "task_completed_b"),
  ]);
  const statuses = conflictResults.map(
    (entry) => (entry.result as { status: string }).status,
  );
  assert.equal(statuses.filter((status) => status === "completed").length, 1);
  assert.equal(statuses.filter((status) => status === "blocked").length, 1);
  const conflictEventDirectory = eventDirectory(conflictRoot);
  assert.equal(
    fs
      .readdirSync(conflictEventDirectory)
      .filter((name) => name.endsWith(".json")).length,
    1,
  );
  assert.equal(
    fs.existsSync(
      path.join(operationDirectory(conflictRoot), ".mutation-lock"),
    ),
    false,
  );
});

/**
 * 通常Repository・linked worktree・submoduleのexact Rootを区別するを検証する。
 *
 * @responsibility 通常Repository・linked worktree・submoduleのexact Rootを区別するの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 通常Repository・linked worktree・submoduleのexact Rootを区別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("通常Repository・linked worktree・submoduleのexact Rootを区別する", (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-execution-layout-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const primary = path.join(base, "primary");
  const source = path.join(base, "source");
  const linked = path.join(base, "linked");
  fs.mkdirSync(primary);
  execFileSync("git", ["init", "--quiet", primary], { windowsHide: true });
  fs.writeFileSync(path.join(primary, "README.md"), "primary\n", "utf8");
  execFileSync("git", ["-C", primary, "add", "README.md"], {
    windowsHide: true,
  });
  execFileSync(
    "git",
    [
      "-C",
      primary,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=crdd-test@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  execFileSync(
    "git",
    ["-C", primary, "worktree", "add", "--quiet", "-b", "linked", linked],
    { windowsHide: true },
  );

  fs.mkdirSync(source);
  execFileSync("git", ["init", "--quiet", source], { windowsHide: true });
  fs.writeFileSync(path.join(source, "README.md"), "source\n", "utf8");
  execFileSync("git", ["-C", source, "add", "README.md"], {
    windowsHide: true,
  });
  execFileSync(
    "git",
    [
      "-C",
      source,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=crdd-test@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
    { windowsHide: true },
  );
  execFileSync(
    "git",
    [
      "-c",
      "protocol.file.allow=always",
      "-C",
      primary,
      "submodule",
      "add",
      "--quiet",
      source,
      "dependency",
    ],
    { windowsHide: true },
  );

  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(primary).status,
    "completed",
  );
  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(linked).status,
    "completed",
  );
  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(path.join(primary, "dependency"))
      .status,
    "completed",
  );
  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(base).status,
    "blocked",
  );
});

for (const fault of [
  "open",
  "write",
  "flush",
  "publish",
  "readback",
] as const) {
  /**
   * Storeの${fault}失敗を成功へ丸めず資源を回収するを検証する。
   *
   * @responsibility Storeの${fault}失敗を成功へ丸めず資源を回収するの合否判定を所有する。
   * @trace ERP-IT-001
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Storeの${fault}失敗を成功へ丸めず資源を回収するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
   */
  test(`Storeの${fault}失敗を成功へ丸めず資源を回収する`, (t) => {
    const root = fixture(t);
    const capability = verifiedRoot(root);
    const originalOpen = fs.openSync;
    const originalWrite = fs.writeFileSync;
    const originalFsync = fs.fsyncSync;
    const originalLink = fs.linkSync;
    const originalRead = fs.readFileSync;
    let hasObservedOwnerWrite = false;
    let hasObservedOwnerFlush = false;
    fs.openSync = ((target: fs.PathLike, ...args: unknown[]) => {
      if (fault === "open" && String(target).includes("execution-pending-"))
        throw new Error("injected_open_failure");
      return Reflect.apply(originalOpen, fs, [target, ...args]);
    }) as typeof fs.openSync;
    fs.writeFileSync = ((target: unknown, ...args: unknown[]) => {
      if (typeof target === "number") {
        if (!hasObservedOwnerWrite) hasObservedOwnerWrite = true;
        else if (fault === "write") throw new Error("injected_write_failure");
      }
      return Reflect.apply(originalWrite, fs, [target, ...args]);
    }) as typeof fs.writeFileSync;
    fs.fsyncSync = ((descriptor: number) => {
      if (!hasObservedOwnerFlush) hasObservedOwnerFlush = true;
      else if (fault === "flush") throw new Error("injected_flush_failure");
      return originalFsync(descriptor);
    }) as typeof fs.fsyncSync;
    fs.linkSync = ((existingPath: fs.PathLike, newPath: fs.PathLike) => {
      if (fault === "publish") throw new Error("injected_publish_failure");
      return originalLink(existingPath, newPath);
    }) as typeof fs.linkSync;
    fs.readFileSync = ((
      target: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ) => {
      if (
        fault === "readback" &&
        path.basename(String(target)).startsWith("execution-") &&
        String(target).endsWith(".json")
      )
        throw new Error("injected_readback_failure");
      return Reflect.apply(originalRead, fs, [target, ...args]);
    }) as typeof fs.readFileSync;
    t.after(() => {
      fs.openSync = originalOpen;
      fs.writeFileSync = originalWrite;
      fs.fsyncSync = originalFsync;
      fs.linkSync = originalLink;
      fs.readFileSync = originalRead;
    });

    const result = writeExecutionIntelligenceEvent(capability, event());
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, true);
    assert.deepEqual(result.residualArtifactIds, []);
    assert.equal(
      fs.existsSync(path.join(operationDirectory(root), ".mutation-lock")),
      false,
    );
  });
}

/**
 * 一時fileの回収不明はexactな残存Identityを返すを検証する。
 *
 * @responsibility 一時fileの回収不明はexactな残存Identityを返すの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 一時fileの回収不明はexactな残存Identityを返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("一時fileの回収不明はexactな残存Identityを返す", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const originalUnlink = fs.unlinkSync;
  fs.unlinkSync = ((target: fs.PathLike) => {
    if (String(target).includes("execution-pending-"))
      throw new Error("injected_pending_cleanup_failure");
    return originalUnlink(target);
  }) as typeof fs.unlinkSync;
  t.after(() => {
    fs.unlinkSync = originalUnlink;
  });
  const result = writeExecutionIntelligenceEvent(capability, event());
  assert.equal(result.status, "blocked");
  assert.equal(result.effectState, "settled");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.residualArtifactIds.length, 1);
  assert.match(result.residualArtifactIds[0] ?? "", /^\.execution-pending-/u);
});

/**
 * 所有不明の残存Lockを自動奪取しないを検証する。
 *
 * @responsibility 所有不明の残存Lockを自動奪取しないの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 所有不明の残存Lockを自動奪取しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("所有不明の残存Lockを自動奪取しない", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  fs.mkdirSync(eventDirectory(root), { recursive: true });
  const lockDirectory = path.join(operationDirectory(root), ".mutation-lock");
  fs.mkdirSync(lockDirectory);
  fs.writeFileSync(
    path.join(lockDirectory, "owner.json"),
    '{"contract":"crdd/execution-store-lock/v1","identity":"unknown"}\n',
    "utf8",
  );
  const result = writeExecutionIntelligenceEvent(capability, event());
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "execution_store_lock_unavailable");
  assert.equal(result.effectState, "no_effect");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.retryAllowed, true);
  assert.equal(fs.existsSync(lockDirectory), true);
});

/**
 * Lock所有者の初期化失敗は回収済みとして閉じるを検証する。
 *
 * @responsibility Lock所有者の初期化失敗は回収済みとして閉じるの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Lock所有者の初期化失敗は回収済みとして閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("Lock所有者の初期化失敗は回収済みとして閉じる", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const originalOpen = fs.openSync;
  fs.openSync = ((target: fs.PathLike, ...args: unknown[]) => {
    if (path.basename(String(target)) === "owner.json")
      throw new Error("injected_lock_owner_open_failure");
    return Reflect.apply(originalOpen, fs, [target, ...args]);
  }) as typeof fs.openSync;
  let result: ReturnType<typeof writeExecutionIntelligenceEvent>;
  try {
    result = writeExecutionIntelligenceEvent(capability, event());
  } finally {
    fs.openSync = originalOpen;
  }
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "execution_store_lock_initialization_failed");
  assert.equal(result.effectState, "no_effect");
  assert.equal(result.cleanupConfirmed, true);
  assert.deepEqual(result.residualArtifactIds, []);
});

/**
 * Lock所有者の初期化と回収が失敗した場合は残存Lockを返すを検証する。
 *
 * @responsibility Lock所有者の初期化と回収が失敗した場合は残存Lockを返すの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Lock所有者の初期化と回収が失敗した場合は残存Lockを返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("Lock所有者の初期化と回収が失敗した場合は残存Lockを返す", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  assert.equal(
    writeExecutionIntelligenceEvent(capability, eventForTask("setup")).status,
    "completed",
  );
  const originalFsync = fs.fsyncSync;
  const originalUnlink = fs.unlinkSync;
  fs.fsyncSync = (() => {
    throw new Error("injected_lock_owner_flush_failure");
  }) as typeof fs.fsyncSync;
  fs.unlinkSync = ((target: fs.PathLike) => {
    if (path.basename(String(target)) === "owner.json")
      throw new Error("injected_lock_owner_cleanup_failure");
    return originalUnlink(target);
  }) as typeof fs.unlinkSync;
  let result: ReturnType<typeof writeExecutionIntelligenceEvent>;
  try {
    result = writeExecutionIntelligenceEvent(capability, event());
  } finally {
    fs.fsyncSync = originalFsync;
    fs.unlinkSync = originalUnlink;
  }
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "execution_store_lock_initialization_failed");
  assert.equal(result.effectState, "no_effect");
  assert.equal(result.cleanupConfirmed, false);
  assert.deepEqual(result.residualArtifactIds, [
    "execution-store-mutation-lock",
  ]);
});

/**
 * Lock解放不明はEvent成立と残存Lockを分けて返すを検証する。
 *
 * @responsibility Lock解放不明はEvent成立と残存Lockを分けて返すの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Lock解放不明はEvent成立と残存Lockを分けて返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("Lock解放不明はEvent成立と残存Lockを分けて返す", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const originalUnlink = fs.unlinkSync;
  fs.unlinkSync = ((target: fs.PathLike) => {
    if (path.basename(String(target)) === "owner.json")
      throw new Error("injected_lock_release_failure");
    return originalUnlink(target);
  }) as typeof fs.unlinkSync;
  t.after(() => {
    fs.unlinkSync = originalUnlink;
  });
  const result = writeExecutionIntelligenceEvent(capability, event());
  assert.equal(result.status, "blocked");
  assert.equal(result.effectState, "settled");
  assert.equal(result.cleanupConfirmed, false);
  assert.deepEqual(result.residualArtifactIds, [
    "execution-store-mutation-lock",
  ]);
});

/**
 * Repository Rootへのlink経由は実行時能力にしないを検証する。
 *
 * @responsibility Repository Rootへのlink経由は実行時能力にしないの合否判定を所有する。
 * @trace ERP-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository Rootへのlink経由は実行時能力にしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Producer→Writer→Store→Reader
 */
test("Repository Rootへのlink経由は実行時能力にしない", (t) => {
  const root = fixture(t);
  const link = path.join(os.tmpdir(), `crdd-execution-link-${randomUUID()}`);
  t.after(() => fs.rmSync(link, { recursive: true, force: true }));
  try {
    fs.symlinkSync(
      root,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") {
      t.skip("symlink_or_junction_creation_not_permitted");
      return;
    }
    throw error;
  }
  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(link).status,
    "blocked",
  );
});
