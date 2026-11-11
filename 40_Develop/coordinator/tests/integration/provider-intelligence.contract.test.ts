/**
 * Coordinatorの開始・終了観測と上位最終判定をEIの実保存へ接続して確認する。
 * @packageDocumentation
 * @responsibility 計測・AI結果・Task結果の分離と、元回復参照・記録ID・保存失敗の非干渉を反証する。
 * @trace ERP-IT-008
 * @level IT
 * @scope 合成Git Repository、EI実Store、既存Sourceの有限境界注入。
 * @boundary 実AI・Dockerは実行せず、各fixtureの自己生成Rootだけを終了hookで回収する。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { stripTypeScriptTypes } from "node:module";
import { test, type TestContext } from "node:test";
import {
  getRepository,
  type Repository,
} from "../../../version-control/src/index.ts";
import {
  getExecution,
  listExecutions,
} from "../../../execution-intelligence/src/index.ts";
import { fixture } from "../../../execution-intelligence/tests/fixtures/store.ts";
import {
  requireReadyRepositoryRuntimeDataArea,
  RepositoryRuntimeDataAreaBlockedError,
} from "../../../domain-model/src/index.ts";
import {
  beginProviderExecutionRecording,
  captureProviderExecutionCompletion,
  finishProviderExecutionRecording,
  getExecutionIntelligenceStore,
} from "../../src/execution/intelligence.ts";
/** 新品Git Repositoryを既存fixtureへ結合し、Root検証後だけ返す。回収はfixture hookが所有する。
 * @trace ERP-IT-008
 */
function repository(t: TestContext): Repository {
  const s = fixture(t);
  execFileSync("git", ["init", "--quiet", s.directory], { windowsHide: true });
  const r = getRepository(s.directory);
  assert.equal(r.status, "completed");
  if (r.status !== "completed") throw Error("fixture_repository_invalid");
  return r.capability;
}

/** 実SourceのGroup開始区間へ有限な拒否を注入し、同一IDで一回診断して上位へ戻ることを確認する。
 * @trace ERP-IT-008
 */
test("Group開始の保存先拒否・例外・保存拒否は同じIDを診断し実行へ戻る", () => {
  const source = fs.readFileSync(
    new URL("../../src/objective/execute.ts", import.meta.url),
    "utf8",
  );
  const begin = source.indexOf("  let eiGroup:"),
    end = source.indexOf(
      "  const execution = await runCoordinatorObjective(",
      begin,
    );
  assert.ok(begin >= 0 && end > begin);
  const block = source
    .slice(begin, end)
    .replace(
      "let eiGroup: { store: StoreOptions; groupId: string } | null",
      "let eiGroup",
    );
  const expected = `group-${createHash("sha256").update("project-a\0request-a").digest("hex").slice(0, 40)}`;
  for (const mode of [
    "repository_blocked",
    "repository_throw",
    "store_blocked",
  ] as const) {
    const ids: string[] = [];
    const continued = vm.runInNewContext(`${block}\ntrue`, {
      request: { projectId: "project-a", requestId: "request-a" },
      repositoryRoot: "fixture",
      createHash,
      getRepository: () => {
        if (mode === "repository_throw") throw Error("fixture");
        return {
          status: mode === "repository_blocked" ? "blocked" : "completed",
          capability: {},
        };
      },
      getExecutionIntelligenceStore: () => ({
        directory: "fixture",
        retentionDays: 1,
      }),
      createGroup: (_store: unknown, input: { groupId: string }) => ({
        status: "blocked",
        recordId: input.groupId,
      }),
      reportExecutionRecording: (result: { recordId: string }) =>
        ids.push(result.recordId),
      reportExecutionRecordingUnavailable: (id: string) => ids.push(id),
    });
    assert.equal(continued, true);
    assert.deepEqual(ids, [expected], mode);
  }
});

for (const kind of ["execution", "group"] as const) {
  /** DMの準備失敗を実Error契約で渡し、元Effect・回復参照と別EI ID、出版0、非throwを確認する。
   * @trace ERP-IT-008
   */
  test(`保存先の既知Effectと元回復参照を別の${kind} IDとともに保持する`, () => {
    const source = fs.readFileSync(
      new URL("../../src/execution/intelligence.ts", import.meta.url),
      "utf8",
    );
    const script = stripTypeScriptTypes(source)
      .replace(/^import[\s\S]*?;\s*$/gm, "")
      .replace(/^export /gm, "");
    const diagnostics: Array<Record<string, unknown>> = [];
    let writes = 0;
    const harness = vm.runInNewContext(
      `${script}\n({beginProviderExecutionRecording,getExecutionIntelligenceStore,reportExecutionRecordingUnavailable})`,
      {
        readExecutionIntelligenceConfig: () => ({
          status: "ready",
          config: { historyRetentionDays: 30 },
        }),
        ensureRepositoryRuntimeDataArea: () => ({
          status: "blocked",
          reason: "repository_runtime_data_ignore_registration_blocked",
          effectIssued: true,
          effectStateUnknown: false,
          cleanupConfirmed: false,
          retryAllowed: true,
          recoveryReference: "fixture-original-recovery",
        }),
        requireReadyRepositoryRuntimeDataArea,
        RepositoryRuntimeDataAreaBlockedError,
        createExecution: () => {
          writes++;
          throw Error("unreachable");
        },
        writeCoordinatorExecutionIntelligenceDiagnostic: (
          result: Record<string, unknown>,
        ) => diagnostics.push(result),
      },
    ) as {
      beginProviderExecutionRecording: typeof beginProviderExecutionRecording;
      getExecutionIntelligenceStore: typeof getExecutionIntelligenceStore;
      reportExecutionRecordingUnavailable: (
        id: string,
        error?: unknown,
      ) => void;
    };
    let expected = "execution-fixture";
    if (kind === "execution") {
      assert.equal(
        harness.beginProviderExecutionRecording(
          {} as Repository,
          "fixture",
          "codex",
        ),
        null,
      );
    } else {
      const groupSource = fs.readFileSync(
        new URL("../../src/objective/execute.ts", import.meta.url),
        "utf8",
      );
      const begin = groupSource.indexOf("  let eiGroup:"),
        end = groupSource.indexOf(
          "  const execution = await runCoordinatorObjective(",
          begin,
        );
      assert.ok(begin >= 0 && end > begin);
      const block = stripTypeScriptTypes(groupSource.slice(begin, end));
      expected = `group-${createHash("sha256").update("project-a\0request-a").digest("hex").slice(0, 40)}`;
      assert.equal(
        vm.runInNewContext(`${block}\ntrue`, {
          request: { projectId: "project-a", requestId: "request-a" },
          repositoryRoot: "fixture",
          createHash,
          getRepository: () => ({ status: "completed", capability: {} }),
          getExecutionIntelligenceStore: harness.getExecutionIntelligenceStore,
          reportExecutionRecordingUnavailable:
            harness.reportExecutionRecordingUnavailable,
          createGroup: () => {
            writes++;
            throw Error("unreachable");
          },
        }),
        true,
      );
    }
    assert.equal(writes, 0);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0]?.recordId, expected);
    assert.equal(
      diagnostics[0]?.recoveryReference,
      "fixture-original-recovery",
    );
    assert.equal(diagnostics[0]?.effectIssued, true);
    assert.equal(diagnostics[0]?.effectStateUnknown, false);
    assert.equal(diagnostics[0]?.effectState, "settled");
    assert.equal(diagnostics[0]?.cleanupConfirmed, false);
    assert.equal(diagnostics[0]?.retryAllowed, true);
    assert.equal(diagnostics[0]?.manualRecoveryRequired, true);
  });
}

for (const [lower, upper, expected] of [
  [true, false, true],
  [undefined, false, false],
  [undefined, undefined, null],
] as const) {
  /** 下位・上位の真偽と欠測を対照し、下位trueを消さず、欠測をfalseへ補完しないことを確認する。
   * @trace ERP-IT-008
   */
  test(`Process再起動の観測を失わず欠測と区別する: ${lower}/${upper}`, (t) => {
    const r = repository(t),
      recording = beginProviderExecutionRecording(
        r,
        "restart-observation",
        "codex",
      );
    assert.ok(recording);
    captureProviderExecutionCompletion(recording, {
      status: "completed",
      reason: "provider_done",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      ...(lower !== undefined ? { processRestartRequired: lower } : {}),
    });
    finishProviderExecutionRecording(recording, {
      status: "completed",
      reason: "task_done",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      ...(upper !== undefined ? { processRestartRequired: upper } : {}),
    });
    const read = getExecution(recording.store, recording.executionId);
    if (read.status !== "completed") throw Error("fixture_read_failed");
    assert.equal(
      read.value?.completion?.diagnostic?.processRestartRequired,
      expected,
    );
    assert.equal(
      read.value?.completion?.retention,
      expected === false ? "standard" : "unresolved",
    );
  });
}
/** 実保存へ開始・終了を接続し、選定設定とProvider実測欠測を別の根拠として確認する。
 * @trace ERP-IT-008
 */
test("要求直前のIDをCompletionへ接続し、Provider実時間は欠測を保つ", (t) => {
  const r = repository(t);
  assert.equal(getExecutionIntelligenceStore(r, false), null);
  const recording = beginProviderExecutionRecording(
    r,
    "operation-a",
    "codex",
    {
      projectId: "p",
      taskId: "t",
      attemptId: "a",
    },
    { modelIdentifier: "fixture-model", reasoningEffort: "high" },
  );
  assert.ok(recording);
  captureProviderExecutionCompletion(recording, {
    status: "completed",
    reason: "done",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
  });
  finishProviderExecutionRecording(recording, {
    status: "completed",
    reason: "done",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
  });
  const read = getExecution(recording.store, recording.executionId);
  assert.equal(read.status, "completed");
  if (read.status === "completed") {
    assert.equal(read.value?.metadata?.taskId, "t");
    assert.deepEqual(
      { ...read.value?.configuration?.model },
      {
        state: "observed",
        value: "fixture-model",
        source: "executor_request_selection",
      },
    );
    assert.equal(
      read.value?.completion?.providerDurationMs?.state,
      "not_observed",
    );
    assert.equal(read.value?.completion?.elapsedMs.state, "observed");
    assert.equal(read.value?.completion?.retention, "standard");
  }
});
/** 未開始と旧形式拒否を対照し、既存履歴の保全と記録失敗の非伝播を確認する。
 * @trace ERP-IT-008
 */
test("AI未要求では記録しない。EIの旧形式拒否・例外は通知へ伝播しない", (t) => {
  const r = repository(t),
    store = getExecutionIntelligenceStore(r, true);
  assert.ok(store);
  finishProviderExecutionRecording(null, {
    status: "blocked",
    reason: "before_provider",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
  });
  const empty = listExecutions(store);
  assert.equal(empty.status, "completed");
  if (empty.status === "completed") assert.equal(empty.value.total, 0);
  const history = path.join(store.directory, "history.jsonl"),
    old = '{"contract":"crdd/execution-intelligence-event/v2"}\n';
  fs.writeFileSync(history, old);
  assert.equal(
    beginProviderExecutionRecording(r, "operation-a", "codex"),
    null,
  );
  assert.equal(fs.readFileSync(history, "utf8"), old);
  assert.deepEqual(fs.readdirSync(store.directory), ["history.jsonl"]);
});
/** 下位清掃不明とCompletion欠測を対照し、未解決保持とopenが残ることを確認する。
 * @trace ERP-IT-008
 */
test("Cleanup未確認の結果は保持し、Completion欠測はopenのまま残す", (t) => {
  const r = repository(t),
    first = beginProviderExecutionRecording(r, "first", "claude"),
    second = beginProviderExecutionRecording(r, "second", "claude");
  assert.ok(first);
  assert.ok(second);
  captureProviderExecutionCompletion(first, {
    status: "blocked",
    reason: "cleanup_unknown",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
  });
  finishProviderExecutionRecording(first, {
    status: "blocked",
    reason: "cleanup_unknown",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
  });
  const a = getExecution(first.store, first.executionId),
    b = getExecution(second.store, second.executionId);
  if (a.status !== "completed" || b.status !== "completed")
    throw Error("fixture_read_failed");
  assert.equal(a.value?.completion?.retention, "unresolved");
  assert.equal(b.value?.state, "open");
});
for (const final of [
  {
    name: "normal",
    status: "completed",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
  },
  {
    name: "host_cleanup_failed",
    status: "blocked",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: false,
  },
  {
    name: "cancellation_protocol_failed",
    status: "blocked",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: true,
  },
  {
    name: "process_poisoned",
    status: "blocked",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: true,
  },
]) {
  /** 下位AI成功後の上位結果を変え、AI時刻とTask判定を混ぜず一回保存することを確認する。
   * @trace ERP-IT-008
   */
  test(`AI成功後の${final.name}を計測と分けて最終保存する`, (t) => {
    const r = repository(t),
      recording = beginProviderExecutionRecording(r, final.name, "codex");
    assert.ok(recording);
    captureProviderExecutionCompletion(recording, {
      status: "completed",
      reason: "provider_done",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
    });
    const observed = recording.observation;
    assert.ok(observed);
    const before = getExecution(recording.store, recording.executionId);
    assert.equal(before.status === "completed" && before.value?.state, "open");
    finishProviderExecutionRecording(recording, {
      ...final,
      reason: final.name,
    });
    const read = getExecution(recording.store, recording.executionId);
    assert.equal(read.status, "completed");
    if (read.status === "completed") {
      assert.equal(read.value?.completion?.outcome.status, "completed");
      assert.equal(
        read.value?.completion?.diagnostic?.taskStatus,
        final.status,
      );
      assert.equal(read.value?.completion?.endedAt, observed.endedAt);
      assert.deepEqual(
        { ...read.value?.completion?.elapsedMs },
        { ...observed.elapsedMs },
      );
      assert.equal(
        read.value?.completion?.retention,
        final.name === "normal" ? "standard" : "unresolved",
      );
    }
    const history = path.join(recording.store.directory, "history.jsonl"),
      bytes = fs.readFileSync(history);
    finishProviderExecutionRecording(recording, {
      ...final,
      reason: "duplicate",
    });
    assert.deepEqual(fs.readFileSync(history), bytes);
  });
}
/** 複数AIの個別結果と共通Task診断を別々に読み戻し、未観測の終了を創作しないことを確認する。
 * @trace ERP-IT-008
 */
test("複数AIの個別結果と共通Task結果を混同せず、capture欠測はopenを保つ", (t) => {
  const r = repository(t),
    a = beginProviderExecutionRecording(r, "executor", "codex"),
    b = beginProviderExecutionRecording(r, "reviewer", "claude"),
    missing = beginProviderExecutionRecording(r, "missing", "codex");
  assert.ok(a);
  assert.ok(b);
  assert.ok(missing);
  captureProviderExecutionCompletion(a, {
    status: "completed",
    reason: "executor_done",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
  });
  captureProviderExecutionCompletion(b, {
    status: "blocked",
    reason: "reviewer_failed",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
  });
  for (const recording of [a, b, missing])
    finishProviderExecutionRecording(recording, {
      status: "blocked",
      reason: "task_failed",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
    });
  const ra = getExecution(a.store, a.executionId),
    rb = getExecution(b.store, b.executionId),
    rm = getExecution(missing.store, missing.executionId);
  if (
    ra.status !== "completed" ||
    rb.status !== "completed" ||
    rm.status !== "completed"
  )
    throw Error("fixture_read_failed");
  assert.equal(ra.value?.completion?.outcome.status, "completed");
  assert.equal(rb.value?.completion?.outcome.status, "blocked");
  assert.equal(ra.value?.completion?.diagnostic?.taskStatus, "blocked");
  assert.equal(rb.value?.completion?.diagnostic?.taskStatus, "blocked");
  assert.equal(rm.value?.state, "open");
});
