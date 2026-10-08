/**
 * execution-intelligence:integration:storeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility execution-intelligence:integration:storeが所有する検証責務を実行する。
 * @trace ERP-IT-001
 * @trace ERP-IT-002
 * @trace ERP-IT-003
 * @trace ERP-IT-005
 * @level IT
 * @scope execution、intelligence、store、immutable
 * @boundary ERP-IT-001=Related 2 Blocks: Producer→Writer→Store→Reader / ERP-IT-002=Direct Boundary: 複数Writer→同一Store / ERP-IT-003=Adjacent 1 Block: Writer→Filesystem publish→Reader / ERP-IT-005=Adjacent 1 Block: Event入口→Policy→Store
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

import path from "node:path";
import test from "node:test";
import { ensureRepositoryRuntimeDataArea } from "../../../domain-model/src/index.ts";

import {
  createExecutionIntelligenceRecorder,
  createTaskAttemptSettledEvent,
  readExecutionIntelligence,
  verifyExecutionIntelligenceRepositoryRoot,
  writeExecutionIntelligenceEvent,
  usageNotObserved,
  observed,
  type VerifiedExecutionRepositoryRoot,
} from "../../src/index.ts";
import { createBoundExecutionIntelligenceRecorder } from "../../src/record/create-recorder.ts";
import {
  readExecutionIntelligenceWithRuntimeDataArea,
  writeExecutionIntelligenceEventWithRuntimeDataArea,
} from "../../src/store/events.ts";

const testingRepositoryRoot = path.resolve(
  execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim(),
);
const testingArea = ensureRepositoryRuntimeDataArea(
  verifiedRoot(testingRepositoryRoot),
  "tests",
);
if (testingArea?.status !== "ready")
  throw new Error("test_runtime_area_unavailable");
const testRuntimeRoot = path.join(
  testingArea.directory,
  "execution-intelligence",
);
fs.mkdirSync(testRuntimeRoot, { recursive: true, mode: 0o700 });
if (
  !fs.lstatSync(testRuntimeRoot).isDirectory() ||
  fs.lstatSync(testRuntimeRoot).isSymbolicLink() ||
  path.resolve(fs.realpathSync.native(testRuntimeRoot)) !==
    path.resolve(testRuntimeRoot)
)
  throw new Error("test_runtime_area_invalid");

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
 * @boundary ERP-IT-001=Direct Boundary: execution-intelligence Test Source→対象契約
 */
function fixture(t: test.TestContext, shouldPrepareWriterArea = false) {
  const root = fs.mkdtempSync(
    path.join(testRuntimeRoot, "crdd-execution-store-"),
  );
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  if (shouldPrepareWriterArea) {
    assert.equal(
      ensureRepositoryRuntimeDataArea(
        verifiedRoot(root),
        "execution-intelligence",
      )?.status,
      "ready",
    );
  }
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
 * @boundary ERP-IT-001=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-IT-001=Direct Boundary: execution-intelligence Test Source→対象契約
 */
function eventForTask(taskId: string) {
  return createTaskAttemptSettledEvent({
    occurredAt: new Date(
      Math.floor(Date.now() / 86_400_000) * 86_400_000,
    ).toISOString(),
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
 * @boundary ERP-IT-001=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @boundary ERP-IT-001=Direct Boundary: execution-intelligence Test Source→対象契約
 */
function operationDirectory(root: string) {
  return path.join(root, ".crdd", "execution-intelligence");
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
 * @boundary ERP-IT-001=Direct Boundary: execution-intelligence Test Source→対象契約
 */
function eventDirectory(root: string) {
  return operationDirectory(root);
}

/**
 * JSONL読取りは初期状態でEffectを発行せず未所有pendingを隠さない。
 * @responsibility JSONL保存・読取り・保持の実境界における合否判定を所有する。
 * @trace ERP-IT-002
 * @precondition 独立したRepository fixtureと固定した時点を使用する。
 * @stimulus 公開入口または同じ実装のClock注入入口を呼ぶ。
 * @observation 結果と実Filesystemの保存内容を観測する。
 * @oracle 事前の独立した日時境界と未回復条件へ照合する。
 * @cleanup fixtureの登録済みhookで試験領域を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: Writer／Reader→JSONL Filesystem
 */
test("JSONL読取りは初期状態でEffectを発行せず未所有pendingを隠さない", (t) => {
  const root = fixture(t),
    capability = verifiedRoot(root);
  const initial = readExecutionIntelligence(capability);
  assert.equal(initial.status, "completed");
  if (initial.status === "completed") {
    assert.equal(initial.observationState, "not_observed");
    assert.equal(initial.reason, "execution_events_not_observed");
  }
  assert.equal(fs.existsSync(path.join(root, ".crdd")), false);
  assert.equal(
    ensureRepositoryRuntimeDataArea(capability, "execution-intelligence")
      ?.status,
    "ready",
  );
  const areaWithoutHistory = readExecutionIntelligence(capability);
  assert.equal(areaWithoutHistory.status, "completed");
  if (areaWithoutHistory.status === "completed")
    assert.equal(areaWithoutHistory.observationState, "not_observed");
  assert.equal(
    writeExecutionIntelligenceEvent(capability, event()).status,
    "completed",
  );
  fs.writeFileSync(
    path.join(eventDirectory(root), "history.pending.jsonl"),
    "unowned",
  );
  const before = fs.readFileSync(
    path.join(eventDirectory(root), "history.jsonl"),
  );
  const result = readExecutionIntelligence(capability);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.equal(result.effectState, "unknown");
    assert.deepEqual(result.residualArtifactIds, ["history.pending.jsonl"]);
  }
  assert.deepEqual(
    fs.readFileSync(path.join(eventDirectory(root), "history.jsonl")),
    before,
  );
  assert.equal(
    fs.readFileSync(
      path.join(eventDirectory(root), "history.pending.jsonl"),
      "utf8",
    ),
    "unowned",
  );
});

/**
 * 期間抽出は半開区間を守り物理履歴を削除しない。
 * @responsibility JSONL保存・読取り・保持の実境界における合否判定を所有する。
 * @trace ERP-IT-002
 * @precondition 独立したRepository fixtureと固定した時点を使用する。
 * @stimulus 公開入口または同じ実装のClock注入入口を呼ぶ。
 * @observation 結果と実Filesystemの保存内容を観測する。
 * @oracle 事前の独立した日時境界と未回復条件へ照合する。
 * @cleanup fixtureの登録済みhookで試験領域を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: Writer／Reader→JSONL Filesystem
 */
test("期間抽出は半開区間を守り物理履歴を削除しない", (t) => {
  const root = fixture(t),
    capability = verifiedRoot(root),
    base = event();
  const at = Date.parse(base.occurredAt);
  const entries = [-1, 0, 1].map((offset) => ({
    ...eventForTask(`period-${offset}`),
    occurredAt: new Date(at + offset).toISOString(),
  }));
  for (const entry of entries)
    assert.equal(
      writeExecutionIntelligenceEvent(capability, entry).status,
      "completed",
    );
  const before = fs.readFileSync(
    path.join(eventDirectory(root), "history.jsonl"),
  );
  const period = {
    fromInclusive: new Date(at).toISOString(),
    toExclusive: new Date(at + 1).toISOString(),
  };
  const result = readExecutionIntelligence(capability, { period });
  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0]?.occurredAt, base.occurredAt);
    assert.deepEqual(result.period, period);
    assert.equal(Object.keys(result.hashes).length, 1);
  }
  assert.deepEqual(
    fs.readFileSync(path.join(eventDirectory(root), "history.jsonl")),
    before,
  );
  assert.equal(
    readExecutionIntelligence(capability, {
      period: { fromInclusive: "invalid", toExclusive: period.toExclusive },
    }).status,
    "blocked",
  );
});

/**
 * 保持境界は30日一致を残し期限切れ通常記録を拒否する。
 * @responsibility JSONL保存・読取り・保持の実境界における合否判定を所有する。
 * @trace ERP-IT-002
 * @precondition 独立したRepository fixtureと固定した時点を使用する。
 * @stimulus 公開入口または同じ実装のClock注入入口を呼ぶ。
 * @observation 結果と実Filesystemの保存内容を観測する。
 * @oracle 事前の独立した日時境界と未回復条件へ照合する。
 * @cleanup fixtureの登録済みhookで試験領域を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: Writer／Reader→JSONL Filesystem
 */
test("保持境界は30日一致を残し期限切れ通常記録を拒否する", (t) => {
  const root = fixture(t),
    capability = verifiedRoot(root),
    base = event();
  const at = Date.parse(base.occurredAt),
    day = 86_400_000;
  const initial = writeExecutionIntelligenceEventWithRuntimeDataArea(
    capability,
    base,
    ensureRepositoryRuntimeDataArea,
    () => at,
  );
  assert.equal(initial.status, "completed");
  assert.equal(
    writeExecutionIntelligenceEventWithRuntimeDataArea(
      capability,
      base,
      ensureRepositoryRuntimeDataArea,
      () => at + 30 * day,
    ).status,
    "completed",
  );
  const before = fs.readFileSync(
    path.join(eventDirectory(root), "history.jsonl"),
  );
  const expired = writeExecutionIntelligenceEventWithRuntimeDataArea(
    capability,
    base,
    ensureRepositoryRuntimeDataArea,
    () => at + 30 * day + 1,
  );
  assert.equal(expired.status, "blocked");
  assert.equal(expired.reason, "execution_event_retention_expired");
  assert.deepEqual(
    fs.readFileSync(path.join(eventDirectory(root), "history.jsonl")),
    before,
  );
});

/**
 * 通常期限切れを清掃しても未回復の観測を失わない。
 * @responsibility JSONL保存・読取り・保持の実境界における合否判定を所有する。
 * @trace ERP-IT-002
 * @precondition 独立したRepository fixtureと固定した時点を使用する。
 * @stimulus 公開入口または同じ実装のClock注入入口を呼ぶ。
 * @observation 結果と実Filesystemの保存内容を観測する。
 * @oracle 事前の独立した日時境界と未回復条件へ照合する。
 * @cleanup fixtureの登録済みhookで試験領域を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: Writer／Reader→JSONL Filesystem
 */
test("通常期限切れを清掃しても未回復の観測を失わない", (t) => {
  const root = fixture(t),
    capability = verifiedRoot(root),
    base = event(),
    at = Date.parse(base.occurredAt),
    day = 86_400_000;
  const unresolved = {
    ...eventForTask("unresolved"),
    outcome: {
      ...base.outcome,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown" as const,
    },
  };
  assert.equal(
    writeExecutionIntelligenceEventWithRuntimeDataArea(
      capability,
      base,
      ensureRepositoryRuntimeDataArea,
      () => at,
    ).status,
    "completed",
  );
  assert.equal(
    writeExecutionIntelligenceEventWithRuntimeDataArea(
      capability,
      unresolved,
      ensureRepositoryRuntimeDataArea,
      () => at,
    ).status,
    "completed",
  );
  const later = {
    ...eventForTask("later"),
    occurredAt: new Date(at + 31 * day).toISOString(),
  };
  assert.equal(
    writeExecutionIntelligenceEventWithRuntimeDataArea(
      capability,
      later,
      ensureRepositoryRuntimeDataArea,
      () => at + 31 * day,
    ).status,
    "completed",
  );
  const result = readExecutionIntelligence(capability);
  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.equal(result.events.length, 2);
    assert.equal(
      result.events.some((entry) => entry.eventId === base.eventId),
      false,
    );
    assert.equal(
      result.events.some((entry) => entry.eventId === unresolved.eventId),
      true,
    );
  }
});

/**
 * 汎用Operationは公開Recorderから実績診断と部分使用量を不変保存する。
 * @responsibility 公開利用側と設定・旧領域境界の検証を所有する。
 * @trace ERP-IT-001
 * @precondition 独立したRepository fixtureを使用する。
 * @stimulus 公開RecorderとJSONL保存・読取りを実行する。
 * @observation 永続Event、診断、設定処置、終了後fileを観測する。
 * @oracle 実行前に用意した入力と設定を独立した期待値にする。
 * @cleanup fixture hookで登録した試験資源を清掃する。
 * @boundary ERP-IT-001=Related 2 Blocks: Recorder→Writer→Filesystem→Reader
 */
test("汎用Operationは公開Recorderから実績診断と部分使用量を不変保存する", (t) => {
  const root = fixture(t),
    created = createExecutionIntelligenceRecorder(root),
    base = event();
  assert.equal(created.status, "completed");
  if (created.status !== "completed") throw new Error("recorder_not_ready");
  const execution = {
    ...base.execution,
    provider: observed("provider-a", "runtime_assignment"),
    model: observed("model-a", "runtime_assignment"),
    profileId: observed("profile-a", "runtime_assignment"),
    profileRevision: observed("revision-a", "runtime_assignment"),
    reasoningEffort: observed("low", "runtime_assignment"),
    overrideApplied: observed(true, "runtime_assignment"),
    parentExecutionId: observed("parent-a", "runtime_parent"),
    diagnostic: observed(
      {
        stage: "schema_validation" as const,
        category: "invalid_response" as const,
        httpStatus: 200,
        type: null,
        code: null,
        finishReason: "stop" as const,
        refusal: false,
      },
      "sanitized_adapter",
    ),
    usage: {
      ...usageNotObserved("missing"),
      inputTokens: observed(12, "provider_usage"),
      outputTokens: observed(8, "provider_usage"),
    },
  };
  const result = created.recorder.recordOperation({
    occurredAt: base.occurredAt,
    identity: {
      projectId: "project-a",
      operationId: "generic-a",
      executionId: "execution-a",
    },
    execution,
    outcome: {
      ...base.outcome,
      status: "blocked",
      reason: "response_invalid",
      effectState: "no_effect",
    },
    quality: base.quality,
  });
  assert.equal(result.status, "completed");
  const read = readExecutionIntelligence(verifiedRoot(root));
  assert.equal(read.status, "completed");
  if (read.status === "completed") {
    assert.equal(read.events.length, 1);
    assert.equal(read.events[0]?.eventType, "operation_settled");
    assert.deepEqual(read.events[0]?.execution, execution);
    assert.deepEqual(Object.keys(read.events[0]?.identity ?? {}).sort(), [
      "executionId",
      "operationId",
      "projectId",
    ]);
  }
});

/**
 * 設定した保持日数を使用し不正設定では既存履歴を変更しない。
 * @responsibility 公開利用側と設定・旧領域境界の検証を所有する。
 * @trace ERP-IT-001
 * @precondition 独立したRepository fixtureを使用する。
 * @stimulus 公開RecorderとJSONL保存・読取りを実行する。
 * @observation 永続Event、診断、設定処置、終了後fileを観測する。
 * @oracle 実行前に用意した入力と設定を独立した期待値にする。
 * @cleanup fixture hookで登録した試験資源を清掃する。
 * @boundary ERP-IT-001=Related 2 Blocks: Recorder→Writer→Filesystem→Reader
 */
test("設定した保持日数を使用し不正設定では既存履歴を変更しない", (t) => {
  const root = fixture(t),
    capability = verifiedRoot(root),
    base = event(),
    at = Date.parse(base.occurredAt);
  assert.equal(
    writeExecutionIntelligenceEventWithRuntimeDataArea(
      capability,
      base,
      ensureRepositoryRuntimeDataArea,
      () => at,
    ).status,
    "completed",
  );
  fs.mkdirSync(path.join(root, ".crdd", "config"));
  fs.writeFileSync(
    path.join(root, ".crdd", "config", "orchestrator.json"),
    "invalid-other-tool-setting",
  );
  const configPath = path.join(
    root,
    ".crdd",
    "config",
    "execution-intelligence.json",
  );
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      schemaRevision: 1,
      historyRetentionDays: 1,
    }),
  );
  const later = {
    ...eventForTask("configured-later"),
    occurredAt: new Date(at + 2 * 86_400_000).toISOString(),
  };
  assert.equal(
    writeExecutionIntelligenceEventWithRuntimeDataArea(
      capability,
      later,
      ensureRepositoryRuntimeDataArea,
      () => at + 2 * 86_400_000,
    ).status,
    "completed",
  );
  const read = readExecutionIntelligence(capability);
  if (read.status !== "completed") throw new Error("read_failed");
  assert.equal(read.events.length, 1);
  assert.equal(read.events[0]?.eventId, later.eventId);
  const before = fs.readFileSync(
    path.join(eventDirectory(root), "history.jsonl"),
  );
  fs.writeFileSync(configPath, "{}");
  const blocked = writeExecutionIntelligenceEventWithRuntimeDataArea(
    capability,
    later,
    ensureRepositoryRuntimeDataArea,
    () => at + 2 * 86_400_000,
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.reason, "tool_runtime_config_invalid");
  assert.deepEqual(
    fs.readFileSync(path.join(eventDirectory(root), "history.jsonl")),
    before,
  );
  assert.equal(
    fs.existsSync(path.join(eventDirectory(root), "history.pending.jsonl")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(eventDirectory(root), "history.lock")),
    false,
  );
});

/**
 * 旧領域は読取り移行変換削除せず新領域だけを使用する。
 * @responsibility 公開利用側と設定・旧領域境界の検証を所有する。
 * @trace ERP-IT-001
 * @precondition 独立したRepository fixtureを使用する。
 * @stimulus 公開RecorderとJSONL保存・読取りを実行する。
 * @observation 永続Event、診断、設定処置、終了後fileを観測する。
 * @oracle 実行前に用意した入力と設定を独立した期待値にする。
 * @cleanup fixture hookで登録した試験資源を清掃する。
 * @boundary ERP-IT-001=Related 2 Blocks: Recorder→Writer→Filesystem→Reader
 */
test("旧領域は読取り移行変換削除せず新領域だけを使用する", (t) => {
  const root = fixture(t),
    capability = verifiedRoot(root);
  const legacy = path.join(root, ".crdd", "execution", "operation-a", "events");
  fs.mkdirSync(legacy, { recursive: true });
  const old = path.join(legacy, "opaque.json");
  fs.writeFileSync(old, "opaque legacy bytes");
  const initial = readExecutionIntelligence(capability);
  assert.equal(initial.status, "completed");
  if (initial.status === "completed") assert.equal(initial.events.length, 0);
  assert.equal(fs.existsSync(eventDirectory(root)), false);
  assert.equal(
    writeExecutionIntelligenceEvent(capability, event()).status,
    "completed",
  );
  assert.equal(fs.readFileSync(old, "utf8"), "opaque legacy bytes");
  assert.deepEqual(fs.readdirSync(eventDirectory(root)), ["history.jsonl"]);
});

/**
 * 読取り障害を空履歴へ畳まない。
 * @responsibility 観測不能と不存在の区別を検証する。
 * @trace ERP-IT-002
 * @precondition 正常なJSONL履歴を保存する。
 * @stimulus history.jsonl metadataの権限障害を注入する。
 * @observation 公開Readerの状態と既存bytesを確認する。
 * @oracle 空履歴completedではなくblockedで、履歴変更は0。
 * @cleanup 元のFilesystem関数を必ず復元しfixtureを清掃する。
 * @boundary ERP-IT-002=Direct Boundary: Reader→Filesystem metadata
 */
test("Readerのmetadata観測不能は不存在にしない", (t) => {
  const root = fixture(t),
    capability = verifiedRoot(root);
  assert.equal(
    writeExecutionIntelligenceEvent(capability, event()).status,
    "completed",
  );
  const history = path.join(eventDirectory(root), "history.jsonl"),
    before = fs.readFileSync(history),
    original = fs.lstatSync;
  Reflect.set(fs, "lstatSync", ((target: fs.PathLike, ...args: unknown[]) => {
    if (path.resolve(String(target)) === path.resolve(history))
      throw Object.assign(new Error("injected_metadata_unobservable"), {
        code: "EACCES",
      });
    return Reflect.apply(original, fs, [target, ...args]);
  }) as typeof fs.lstatSync);
  try {
    const result = readExecutionIntelligence(capability);
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "execution_event_store_observation_failed");
  } finally {
    Reflect.set(fs, "lstatSync", original);
  }
  assert.deepEqual(fs.readFileSync(history), before);
});

/**
 * Reader終了前のarea置換はOwnerのIdentity照合で拒否する。
 * @responsibility 完全な旧snapshotを読めても現在境界の成立と誤認しないことを検証する。
 * @trace ERP-IT-002
 * @precondition exact fixtureに正常な履歴を保存する。
 * @stimulus Readerのdescriptor閉鎖時にareaを別Directoryへ置換する。
 * @observation 公開結果、旧履歴bytes、新area内容を確認する。
 * @oracle boundary_changedで停止し、Readerが新areaへ履歴・Lockを生成しない。
 * @cleanup 注入関数を復元し、fixture内の新旧areaを清掃する。
 * @boundary ERP-IT-002=Direct Boundary: Reader→Owner observer／Filesystem
 */
test("Reader途中のarea置換を完了へ畳まない", (t) => {
  const root = fixture(t),
    capability = verifiedRoot(root);
  assert.equal(
    writeExecutionIntelligenceEvent(capability, event()).status,
    "completed",
  );
  const area = eventDirectory(root),
    history = path.join(area, "history.jsonl"),
    before = fs.readFileSync(history),
    prior = path.join(root, "prior-reader-area");
  const originalOpen = fs.openSync,
    originalClose = fs.closeSync;
  let readerDescriptor: number | null = null,
    wasAreaSwapped = false;
  fs.openSync = ((target: fs.PathLike, ...args: unknown[]) => {
    const descriptor = Reflect.apply(originalOpen, fs, [
      target,
      ...args,
    ]) as number;
    if (
      path.resolve(String(target)) === path.resolve(history) &&
      args[0] === "r"
    )
      readerDescriptor = descriptor;
    return descriptor;
  }) as typeof fs.openSync;
  fs.closeSync = ((descriptor: number) => {
    originalClose(descriptor);
    if (descriptor === readerDescriptor && !wasAreaSwapped) {
      wasAreaSwapped = true;
      fs.renameSync(area, prior);
      fs.mkdirSync(area);
    }
  }) as typeof fs.closeSync;
  try {
    const result = readExecutionIntelligence(capability);
    assert.equal(wasAreaSwapped, true);
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "execution_store_boundary_changed");
    if (result.status === "blocked") assert.equal(result.effectIssued, false);
  } finally {
    fs.openSync = originalOpen;
    fs.closeSync = originalClose;
  }
  assert.deepEqual(fs.readFileSync(path.join(prior, "history.jsonl")), before);
  assert.deepEqual(fs.readdirSync(area), []);
});

/**
 * Runtime Data Ignore失敗の意味を最終Publicationまで保持するを検証する。
 *
 * @responsibility Runtime Data Ignore失敗の意味を最終Publicationまで保持するの合否判定を所有する。
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Runtime Data Ignore失敗の意味を最終Publicationまで保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
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
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "execution-intelligence")),
    false,
  );
});

/**
 * Runtime Data Effect不明はcleanup済みでもRead／Writeで手動回復を保持するを検証する。
 *
 * @responsibility Runtime Data Effect不明はcleanup済みでもRead／Writeで手動回復を保持するの合否判定を所有する。
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Runtime Data Effect不明はcleanup済みでもRead／Writeで手動回復を保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
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
   * @boundary ERP-IT-001=Direct Boundary: execution-intelligence Test Source→対象契約
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
    ).status,
    "completed",
  );
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "execution-intelligence")),
    false,
  );
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
 * @boundary ERP-IT-001=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recorderはtop-level Accessorを実行せずStore Effect 0で拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
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
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "execution-intelligence")),
    false,
  );
});

/**
 * Recorderは生成後のStore例外を入力不正やEffect 0へ偽装しないを検証する。
 *
 * @responsibility Recorderは生成後のStore例外を入力不正やEffect 0へ偽装しないの合否判定を所有する。
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Recorderは生成後のStore例外を入力不正やEffect 0へ偽装しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
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
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "execution-intelligence")),
    false,
  );
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
 * @boundary ERP-IT-001=Direct Boundary: execution-intelligence Test Source→対象契約
 */
function runWriter(root: string, reason: string, operationId = "operation-a") {
  return new Promise<Readonly<{ exitCode: number | null; result: unknown }>>(
    (resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          path.resolve("tests/fixtures/execution-intelligence-store-writer.ts"),
          root,
          reason,
          operationId,
        ],
        {
          cwd: path.resolve("."),
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8").on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.setEncoding("utf8").on("data", (chunk) => {
        stderr += chunk;
      });
      child.once("error", () => reject(new Error("writer_spawn_failed")));
      child.once("close", (exitCode, signal) => {
        try {
          resolve({
            exitCode,
            result: decodeWriterResult(stdout, stderr, exitCode, signal),
          });
        } catch (error) {
          reject(error);
        }
      });
    },
  );
}

/**
 * 子Processの終了観測を安全な診断と結果へ変換する。
 *
 * @responsibility 出力欠落・不正JSON・Process失敗を未捕捉例外にせず分類する。
 * @trace ERP-IT-001
 * @precondition 呼出し側が終了後の出力と終了状態を渡す。
 * @stimulus 終了観測を変換する。
 * @observation 分類、終了コード、signal、出力byte数だけを診断へ残す。
 * @oracle 生の出力、Path、Error本文を診断に複製しない。
 * @cleanup 資源を生成しない。
 * @boundary ERP-IT-001=Direct Boundary: child Process出力→Test判定
 */
function decodeWriterResult(
  stdout: string,
  stderr: string,
  exitCode: number | null,
  signal: NodeJS.Signals | null,
): unknown {
  const detail = `exitCode=${exitCode};signal=${signal ?? "none"};stdoutBytes=${Buffer.byteLength(stdout)};stderrBytes=${Buffer.byteLength(stderr)}`;
  if (!stdout.trim()) throw new Error(`writer_output_missing;${detail}`);
  let result: unknown;
  try {
    result = JSON.parse(stdout) as unknown;
  } catch {
    throw new Error(`writer_output_invalid_json;${detail}`);
  }
  if (
    typeof result !== "object" ||
    result === null ||
    !("status" in result) ||
    (result.status !== "completed" && result.status !== "blocked")
  ) {
    throw new Error(`writer_output_invalid_result;${detail}`);
  }
  if (exitCode !== 0 || signal !== null) {
    const isRootVerificationFailure =
      "stage" in result &&
      result.stage === "root_verification" &&
      "reason" in result &&
      result.reason === "execution_repository_root_invalid";
    throw new Error(
      `${isRootVerificationFailure ? "writer_root_verification_failed" : "writer_process_failed"};${detail}`,
    );
  }
  if (stderr) throw new Error(`writer_stderr_present;${detail}`);
  return result;
}

/**
 * 全Writerの終了後に結果または最初の失敗を返す。
 *
 * @responsibility childが残る間にfixture cleanupへ進めない。
 * @trace ERP-IT-001
 * @precondition 呼出し側が開始済みWriterのPromiseを渡す。
 * @stimulus 全Promiseのsettledを待機する。
 * @observation 全childのcloseまたはspawn失敗を取得する。
 * @oracle 成功条件を緩めず、全終了後に失敗を再伝播する。
 * @cleanup 呼出し側のfixture hookは返却後に資源を清掃する。
 * @boundary ERP-IT-001=Direct Boundary: child Process終了→Test cleanup
 */
async function waitForAllWriters(
  writers: readonly ReturnType<typeof runWriter>[],
) {
  const settledResults = await Promise.allSettled(writers);
  const results: Awaited<ReturnType<typeof runWriter>>[] = [];
  for (const entry of settledResults) {
    if (entry.status === "rejected") throw entry.reason;
    results.push(entry.value);
  }
  return results;
}

/**
 * 試験Processの失敗を安全な診断で閉じることを検証する。
 *
 * @responsibility 空出力、不正JSON、Root拒否の診断契約を判定する。
 * @trace ERP-IT-001
 * @precondition 局所値と所有するfixtureを使用する。
 * @stimulus 出力変換とRoot拒否fixtureを実行する。
 * @observation rejectの分類、終了コード、出力byte数を取得する。
 * @oracle 未捕捉例外や生の出力漏えいなしに拒否する。
 * @cleanup fixture hookが所有資源を清掃する。
 * @boundary ERP-IT-001=Direct Boundary: child Process出力→Test判定
 */
test("試験Processの空出力・不正JSON・Root拒否は安全な診断で閉じる", async (t) => {
  assert.throws(
    () => decodeWriterResult("", "private-stderr", 4, null),
    /^Error: writer_output_missing;exitCode=4;signal=none;stdoutBytes=0;stderrBytes=14$/u,
  );
  assert.throws(
    () => decodeWriterResult("private-stdout", "", 0, null),
    /^Error: writer_output_invalid_json;exitCode=0;signal=none;stdoutBytes=14;stderrBytes=0$/u,
  );
  assert.throws(
    () => decodeWriterResult("null", "", 0, null),
    /writer_output_invalid_result/u,
  );
  const root = fixture(t);
  const notRepository = path.join(root, "not-repository");
  fs.mkdirSync(notRepository);
  await assert.rejects(
    runWriter(notRepository, "task_completed"),
    /writer_root_verification_failed;exitCode=4;signal=none;stdoutBytes=[1-9][0-9]*;stderrBytes=0/u,
  );
  assert.deepEqual(fs.readdirSync(notRepository), []);
});

/**
 * writes immutable events under repository-local .crdd and reads a summaryを検証する。
 *
 * @responsibility writes immutable events under repository-local .crdd and reads a summaryの合否判定を所有する。
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus writes immutable events under repository-local .crdd and reads a summaryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
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
    fs.existsSync(path.join(eventDirectory(root), "history.jsonl")),
    true,
  );
});

/**
 * rejects conflicting content for the same exact identityを検証する。
 *
 * @responsibility rejects conflicting content for the same exact identityの合否判定を所有する。
 * @trace ERP-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus rejects conflicting content for the same exact identityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-003=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Accessorを含むEventは永続化前に拒否してStoreを作らないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
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
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "execution-intelligence")),
    false,
  );
});

/**
 * 許可外のProvider生出力をStore Effect前に拒否する。
 *
 * @responsibility Execution Intelligenceへ保存できない生Provider出力を入口で拒否し、診断やStoreへ複製しない。
 * @trace ERP-IT-005
 * @precondition 検証済みRepository Rootと、Canonical Eventへ許可外fieldを加えた固定入力を使用する。
 * @stimulus `rawProviderOutput`を含むEventの永続化を要求する。
 * @observation 構造化された拒否理由、Effect状態およびRepository-local Storeの不存在を観測する。
 * @oracle `execution_event_invalid`で拒否し、生出力を返却せずStore Effect 0となる。
 * @cleanup Test終了時に一時Repositoryを削除する。
 * @boundary ERP-IT-005=Direct Boundary: execution-intelligence Test Source→対象契約
 */
test("許可外のProvider生出力をStore Effect前に拒否する", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const result = writeExecutionIntelligenceEvent(capability, {
    ...event(),
    rawProviderOutput: "forbidden-provider-output",
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "execution_event_invalid");
  assert.equal(result.effectState, "no_effect");
  assert.equal(
    JSON.stringify(result).includes("forbidden-provider-output"),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(root, ".crdd", "execution-intelligence")),
    false,
  );
});

/**
 * fails closed when stored content is corruptを検証する。
 *
 * @responsibility fails closed when stored content is corruptの合否判定を所有する。
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus fails closed when stored content is corruptの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
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
    path.join(eventDirectory(root), "history.jsonl"),
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
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus does not replace a non-directory repository-local boundaryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus does not hide an unknown residual file from the store resultの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 物理保持削除を公開せず自己申告のEvidenceでEventを変更しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
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
    path.join(eventDirectory(root), "history.jsonl"),
  );
  const publicApi = await import("../../src/index.ts");
  assert.equal("applyExecutionIntelligenceRetention" in publicApi, false);
  const afterResult = readExecutionIntelligence(capability);
  assert.equal(afterResult.status, "completed");
  if (afterResult.status === "completed")
    assert.equal(afterResult.events.length, 1);
  assert.deepEqual(
    fs.readFileSync(path.join(eventDirectory(root), "history.jsonl")),
    before,
  );
});

/**
 * Repository RootはexactなVCS worktreeだけを実行時能力にするを検証する。
 *
 * @responsibility Repository RootはexactなVCS worktreeだけを実行時能力にするの合否判定を所有する。
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository RootはexactなVCS worktreeだけを実行時能力にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
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
    path.join(testRuntimeRoot, "crdd-execution-nonrepo-"),
  );
  t.after(() => fs.rmSync(nonRepository, { recursive: true, force: true }));
  assert.equal(
    verifyExecutionIntelligenceRepositoryRoot(nonRepository).status,
    "blocked",
  );
  for (const boundaryKind of ["file", "directory"] as const) {
    const fakeRoot = fs.mkdtempSync(
      path.join(testRuntimeRoot, `crdd-execution-fake-git-${boundaryKind}-`),
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
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 能力発行後にGit境界が失効した場合はStore Effect 0で拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
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
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 並行Processの同一Eventは冪等で、異なる内容は上書きしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
 */
test("並行Processの同一Eventは冪等で、異なる内容は上書きしない", async (t) => {
  // 初期のRoot・ignore設定変更と、確定済み保存境界の並行保存を分離する。
  // historyは事前作成せず、Eventの初回公開自体は並行Writerが実行する。
  const multipleRoot = fixture(t, true);
  const multipleResults = await waitForAllWriters([
    runWriter(multipleRoot, "completed", "operation-one"),
    runWriter(multipleRoot, "completed", "operation-two"),
    runWriter(multipleRoot, "completed", "operation-three"),
  ]);
  assert.ok(
    multipleResults.every(
      (entry) => (entry.result as { status: string }).status === "completed",
    ),
    JSON.stringify(multipleResults),
  );
  const shared = readExecutionIntelligence(verifiedRoot(multipleRoot));
  assert.equal(shared.status, "completed");
  if (shared.status === "completed")
    assert.deepEqual(
      shared.events.map((entry) => entry.identity.operationId).sort(),
      ["operation-one", "operation-three", "operation-two"],
    );
  const sameRoot = fixture(t, true);
  const sameResults = await waitForAllWriters([
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

  const conflictRoot = fixture(t, true);
  const conflictResults = await waitForAllWriters([
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
      .filter((name) => name.endsWith(".jsonl")).length,
    1,
  );
  assert.equal(
    fs.existsSync(path.join(operationDirectory(conflictRoot), "history.lock")),
    false,
  );
});

/**
 * 通常Repository・linked worktree・submoduleのexact Rootを区別するを検証する。
 *
 * @responsibility 通常Repository・linked worktree・submoduleのexact Rootを区別するの合否判定を所有する。
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 通常Repository・linked worktree・submoduleのexact Rootを区別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
 */
test("通常Repository・linked worktree・submoduleのexact Rootを区別する", (t) => {
  const base = fs.mkdtempSync(
    path.join(testRuntimeRoot, "crdd-execution-layout-"),
  );
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
  "short_write",
  "pending_mismatch",
  "published_mismatch",
  "published_mismatch_cleanup",
] as const) {
  /**
   * 公開前後の完成bytes照合と相関参照を検証する。
   *
   * @responsibility 既存履歴を守り、公開後の不明をEffect0へ丸めない。
   * @trace ERP-IT-003
   * @precondition 既存のhistoryがある所有fixtureを使用する。
   * @stimulus 無例外short writeまたは完成bytes照合不一致を注入する。
   * @observation 旧bytes、公開状態、回復参照、lock/pendingの終了状態を取得する。
   * @oracle 公開前は旧bytes不変、公開後はunknownと同event相関を保持する。
   * @cleanup 元のFilesystem関数を復元しfixture hookで清掃する。
   * @boundary ERP-IT-003=Adjacent 1 Block: Writer→Filesystem publish→結果搬送
   */
  test(`完成bytes照合の${fault}は公開段階と相関参照を保持する`, (t) => {
    const root = fixture(t);
    const capability = verifiedRoot(root);
    const priorEvent = eventForTask("prior");
    const created = eventForTask("incoming");
    assert.equal(
      writeExecutionIntelligenceEvent(capability, priorEvent).status,
      "completed",
    );
    const historyPath = path.join(eventDirectory(root), "history.jsonl");
    const oldBytes = fs.readFileSync(historyPath);
    const originalOpen = fs.openSync;
    const originalWrite = fs.writeFileSync;
    const originalRead = fs.readFileSync;
    const originalRename = fs.renameSync;
    const originalUnlink = fs.unlinkSync;
    let pendingDescriptor: number | null = null;
    let wasHistoryPublished = false;
    fs.openSync = ((target: fs.PathLike, ...args: unknown[]) => {
      const descriptor = Reflect.apply(originalOpen, fs, [
        target,
        ...args,
      ]) as number;
      if (String(target).endsWith("history.pending.jsonl"))
        pendingDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    fs.writeFileSync = ((target: unknown, ...args: unknown[]) => {
      if (target === pendingDescriptor && fault === "short_write") {
        const bytes = args[0] as Buffer;
        return originalWrite(
          target as number,
          bytes.subarray(0, bytes.length - 1),
        );
      }
      return Reflect.apply(originalWrite, fs, [target, ...args]);
    }) as typeof fs.writeFileSync;
    fs.readFileSync = ((
      target: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ) => {
      const bytes = Reflect.apply(originalRead, fs, [target, ...args]);
      if (
        (fault === "pending_mismatch" &&
          String(target).endsWith("history.pending.jsonl")) ||
        (fault.startsWith("published_mismatch") &&
          wasHistoryPublished &&
          String(target) === historyPath)
      ) {
        return Buffer.concat([bytes as Buffer, Buffer.from("mismatch")]);
      }
      return bytes;
    }) as typeof fs.readFileSync;
    fs.renameSync = ((source: fs.PathLike, target: fs.PathLike) => {
      originalRename(source, target);
      if (String(target) === historyPath) wasHistoryPublished = true;
    }) as typeof fs.renameSync;
    fs.unlinkSync = ((target: fs.PathLike) => {
      if (
        fault === "published_mismatch_cleanup" &&
        String(target).endsWith("history.lock")
      )
        throw new Error("injected_lock_cleanup_failure");
      return originalUnlink(target);
    }) as typeof fs.unlinkSync;
    let result: ReturnType<typeof writeExecutionIntelligenceEvent>;
    try {
      result = writeExecutionIntelligenceEvent(capability, created);
    } finally {
      fs.openSync = originalOpen;
      fs.writeFileSync = originalWrite;
      fs.readFileSync = originalRead;
      fs.renameSync = originalRename;
      fs.unlinkSync = originalUnlink;
    }
    assert.equal(result.status, "blocked");
    assert.equal(
      fs.existsSync(path.join(eventDirectory(root), "history.pending.jsonl")),
      false,
    );
    if (fault.startsWith("published_mismatch")) {
      assert.equal(wasHistoryPublished, true);
      assert.equal(result.effectState, "unknown");
      assert.equal(result.effectIssued, true);
      assert.equal(result.effectStateUnknown, true);
      assert.equal(result.manualRecoveryRequired, true);
      assert.equal(result.recoveryReference, created.eventId);
      const actualEvents = fs
        .readFileSync(historyPath, "utf8")
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line) as { eventId: string });
      assert.deepEqual(
        actualEvents.map((entry) => entry.eventId),
        [priorEvent.eventId, created.eventId],
      );
    } else {
      assert.equal(wasHistoryPublished, false);
      assert.equal(result.effectState, "no_effect");
      assert.equal(result.effectIssued, false);
      assert.equal(result.effectStateUnknown, false);
      assert.equal(result.recoveryReference, null);
      assert.deepEqual(fs.readFileSync(historyPath), oldBytes);
    }
    const isCleanupFailure = fault === "published_mismatch_cleanup";
    assert.equal(result.cleanupConfirmed, !isCleanupFailure);
    assert.equal(
      fs.existsSync(path.join(eventDirectory(root), "history.lock")),
      isCleanupFailure,
    );
    assert.deepEqual(
      result.residualArtifactIds,
      isCleanupFailure ? ["history.lock"] : [],
    );
  });
}

for (const diagnosticField of [
  "stage",
  "category",
  "type",
  "code",
  "finishReason",
] as const) {
  /**
   * 診断の非primitive hook入力を保存前に拒否する。
   *
   * @responsibility hook実行とsentinel保存が発生しないことを判定する。
   * @trace ERP-IT-005
   * @precondition 未初期化の所有fixtureと診断fieldを使用する。
   * @stimulus toString/toJSON hookを持つobjectを診断fieldへ入力する。
   * @observation hook回数、停止結果、初期化前後のRoot内容を取得する。
   * @oracle Effect0で停止し、hook実行0、保存file不存在を観測する。
   * @cleanup fixture hookが作成資源を清掃する。
   * @boundary ERP-IT-005=Adjacent 1 Block: Event入力→validator→Store
   */
  test(`診断${diagnosticField}のhook入力はEffect0で拒否しsentinelを保存しない`, (t) => {
    const root = fixture(t);
    const capability = verifiedRoot(root);
    const base = event();
    const beforeNames = fs.readdirSync(root);
    let hookCalls = 0;
    const hookValue = {
      toString() {
        hookCalls += 1;
        return "sensitive_sentinel";
      },
      toJSON() {
        hookCalls += 1;
        return "sensitive_sentinel";
      },
    };
    const result = writeExecutionIntelligenceEvent(capability, {
      ...base,
      execution: {
        ...base.execution,
        diagnostic: {
          state: "observed",
          source: "test_adapter",
          value: {
            stage: "schema_validation",
            category: "invalid_response",
            httpStatus: 200,
            type: null,
            code: null,
            finishReason: "stop",
            refusal: false,
            [diagnosticField]: hookValue,
          },
        },
      },
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "execution_event_invalid");
    assert.equal(result.effectState, "no_effect");
    assert.equal(result.effectIssued, false);
    assert.equal(hookCalls, 0);
    assert.deepEqual(fs.readdirSync(root), beforeNames);
    assert.equal(fs.existsSync(path.join(root, ".crdd")), false);
  });
}

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
   * @trace ERP-IT-002
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus Storeの${fault}失敗を成功へ丸めず資源を回収するの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
   */
  test(`Storeの${fault}失敗を成功へ丸めず資源を回収する`, (t) => {
    const root = fixture(t);
    const capability = verifiedRoot(root);
    const originalOpen = fs.openSync;
    const originalWrite = fs.writeFileSync;
    const originalFsync = fs.fsyncSync;
    const originalLink = fs.renameSync;
    const originalRead = fs.readFileSync;
    let pendingDescriptor: number | null = null;
    fs.openSync = ((target: fs.PathLike, ...args: unknown[]) => {
      if (fault === "open" && String(target).endsWith("history.pending.jsonl"))
        throw new Error("injected_open_failure");
      const descriptor = Reflect.apply(originalOpen, fs, [
        target,
        ...args,
      ]) as number;
      if (String(target).endsWith("history.pending.jsonl"))
        pendingDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    fs.writeFileSync = ((target: unknown, ...args: unknown[]) => {
      if (target === pendingDescriptor && fault === "write")
        throw new Error("injected_write_failure");
      return Reflect.apply(originalWrite, fs, [target, ...args]);
    }) as typeof fs.writeFileSync;
    fs.fsyncSync = ((descriptor: number) => {
      if (descriptor === pendingDescriptor && fault === "flush")
        throw new Error("injected_flush_failure");
      return originalFsync(descriptor);
    }) as typeof fs.fsyncSync;
    fs.renameSync = ((existingPath: fs.PathLike, newPath: fs.PathLike) => {
      if (fault === "publish" && String(newPath).endsWith("history.jsonl"))
        throw new Error("injected_publish_failure");
      return originalLink(existingPath, newPath);
    }) as typeof fs.renameSync;
    fs.readFileSync = ((
      target: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ) => {
      if (
        fault === "readback" &&
        path.basename(String(target)).startsWith("history.") &&
        String(target).endsWith(".jsonl")
      )
        throw new Error("injected_readback_failure");
      return Reflect.apply(originalRead, fs, [target, ...args]);
    }) as typeof fs.readFileSync;
    t.after(() => {
      fs.openSync = originalOpen;
      fs.writeFileSync = originalWrite;
      fs.fsyncSync = originalFsync;
      fs.renameSync = originalLink;
      fs.readFileSync = originalRead;
    });

    const result = writeExecutionIntelligenceEvent(capability, event());
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, true);
    assert.deepEqual(result.residualArtifactIds, []);
    assert.equal(
      fs.existsSync(path.join(operationDirectory(root), "history.lock")),
      false,
    );
  });
}

/**
 * 一時fileの回収不明はexactな残存Identityを返すを検証する。
 *
 * @responsibility 一時fileの回収不明はexactな残存Identityを返すの合否判定を所有する。
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 一時fileの回収不明はexactな残存Identityを返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
 */
test("一時fileの回収不明はexactな残存Identityを返す", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const originalUnlink = fs.unlinkSync;
  const originalRename = fs.renameSync;
  fs.renameSync = ((source: fs.PathLike, target: fs.PathLike) => {
    if (String(target).endsWith("history.jsonl"))
      throw new Error("injected_publish_failure");
    return originalRename(source, target);
  }) as typeof fs.renameSync;
  fs.unlinkSync = ((target: fs.PathLike) => {
    if (String(target).endsWith("history.pending.jsonl"))
      throw new Error("injected_pending_cleanup_failure");
    return originalUnlink(target);
  }) as typeof fs.unlinkSync;
  t.after(() => {
    fs.unlinkSync = originalUnlink;
    fs.renameSync = originalRename;
  });
  const result = writeExecutionIntelligenceEvent(capability, event());
  assert.equal(result.status, "blocked");
  assert.equal(result.effectState, "unknown");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.residualArtifactIds.length, 1);
  assert.match(
    result.residualArtifactIds[0] ?? "",
    /^history\.pending\.jsonl$/u,
  );
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
 * @boundary ERP-IT-001=Direct Boundary: execution-intelligence Test Source→対象契約
 */
test("所有不明の残存Lockを自動奪取しない", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  fs.mkdirSync(eventDirectory(root), { recursive: true });
  const lockDirectory = path.join(operationDirectory(root), "history.lock");
  // 未所有のlock fileを残し、自動奪取しない。
  fs.writeFileSync(
    lockDirectory,
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
 * @boundary ERP-IT-001=Direct Boundary: execution-intelligence Test Source→対象契約
 */
test("Lock所有者の初期化失敗は回収済みとして閉じる", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const originalOpen = fs.openSync;
  fs.openSync = ((target: fs.PathLike, ...args: unknown[]) => {
    if (path.basename(String(target)) === "history.lock")
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
  assert.equal(result.reason, "execution_event_store_unavailable");
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
 * @boundary ERP-IT-001=Direct Boundary: execution-intelligence Test Source→対象契約
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
    if (path.basename(String(target)) === "history.lock")
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
  assert.deepEqual(result.residualArtifactIds, ["history.lock"]);
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
 * @boundary ERP-IT-001=Direct Boundary: execution-intelligence Test Source→対象契約
 */
test("Lock解放不明はEvent成立と残存Lockを分けて返す", (t) => {
  const root = fixture(t);
  const capability = verifiedRoot(root);
  const originalUnlink = fs.unlinkSync;
  fs.unlinkSync = ((target: fs.PathLike) => {
    if (path.basename(String(target)) === "history.lock")
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
  assert.deepEqual(result.residualArtifactIds, ["history.lock"]);
});

/**
 * Repository Rootへのlink経由は実行時能力にしないを検証する。
 *
 * @responsibility Repository Rootへのlink経由は実行時能力にしないの合否判定を所有する。
 * @trace ERP-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository Rootへのlink経由は実行時能力にしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-IT-002=Direct Boundary: execution-intelligence Test Source→対象契約
 */
test("Repository Rootへのlink経由は実行時能力にしない", (t) => {
  const root = fixture(t);
  const link = path.join(
    testRuntimeRoot,
    `crdd-execution-link-${randomUUID()}`,
  );
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
