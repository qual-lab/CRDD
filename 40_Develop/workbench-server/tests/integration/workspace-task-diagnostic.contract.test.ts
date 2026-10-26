/**
 * Workspace試験の回復開始・候補検査診断を、同じTaskと有限な安全結果へ結合する。
 * @trace ERB-IT-021
 * @level IT
 * @scope 固定診断・stderr透過・終了時復元。外部AIと実Dockerは使用しない。
 * @boundary 受動通知→検証Toolの結果記録。
 */
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { captureWorkspaceTaskDiagnostic } from "../../scripts/workspace-task-diagnostic.ts";
import {
  inspectCandidateValidationFailureDiagnostic,
  PROVIDER_EXECUTION_OBSERVATION_KEYS,
} from "../../../coordinator/src/execution/result.ts";

const correlation = "operation-11111111-2222-3333-4444-555555555555";
const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
const event = (overrides: Record<string, unknown> = {}) => ({
  event: "coordinator_provider_recovery_start_failed",
  provider: "codex",
  taskRole: "executor",
  operationId: "OP-123456",
  taskAttempt: 0,
  recoveryCorrelationId: correlation,
  diagnostic: { stage: "operation_start_save", recoveryId },
  ...overrides,
});
const frame = (value: object) =>
  `[Coordinator lifecycle] ${JSON.stringify(value)}\n`;
const identity = {
  provider: "codex" as const,
  taskRole: "executor" as const,
  taskAttempt: 0 as const,
  operationId: "OP-123456",
  recoveryCorrelationId: correlation,
  recoveryId,
};

const candidateEvent = (overrides: Record<string, unknown> = {}) => ({
  ...event(),
  event: "coordinator_task_candidate_validation_failed",
  diagnostic: {
    captureStatus: "captured",
    pathsMatch: false,
    candidatePathCount: 0,
    reportedPathCount: 1,
    providerExecutionObservation: null,
  },
  ...overrides,
});

/** 候補診断は現在操作の完全相関と履歴だけの帰属を区別する。 */
test("候補collectorは既存一取得器で完全相関・履歴相関と独立欠測を区別する", () => {
  for (const mode of [
    "current",
    "history",
    "history-multiple",
    "recovery-missing",
    "candidate-missing",
  ] as const) {
    const stream = new Writable({
      write(_c, _e, done) {
        done();
      },
    });
    const original = stream.write;
    const collector = captureWorkspaceTaskDiagnostic(stream);
    if (mode !== "candidate-missing") stream.write(frame(candidateEvent()));
    if (mode === "candidate-missing") stream.write(frame(event()));
    const result = collector.finish(
      correlation,
      [recoveryId],
      mode === "recovery-missing",
      mode.startsWith("history") ? [] : [identity],
      true,
      mode.startsWith("history")
        ? [
            {
              operationId: identity.operationId,
              recoveryCorrelationId: correlation,
              recoveryId,
            },
            ...(mode === "history-multiple"
              ? [
                  {
                    operationId: identity.operationId,
                    recoveryCorrelationId: correlation,
                    recoveryId: recoveryId.replace(
                      "a".repeat(64),
                      "d".repeat(64),
                    ),
                  },
                ]
              : []),
          ]
        : [],
    );
    assert.equal(result.closed, true);
    assert.equal(stream.write, original);
    assert.equal(
      result.candidateValidation.captureStatus,
      mode.startsWith("history")
        ? "task_history_only"
        : mode === "candidate-missing"
          ? "missing"
          : "captured",
    );
    assert.equal(
      result.captureStatus,
      mode === "recovery-missing" ? "missing" : "captured",
    );
    assert.equal(
      result.candidateValidation.events.length,
      mode === "candidate-missing" ? 0 : 1,
    );
  }
});

/** 無関係・不正・重複を受領済みへ畳まず、本文を結果へ複製しない。 */
test("候補collectorは不正・別相関・重複・超過を拒否する", () => {
  for (const scenario of [
    "foreign-task",
    "foreign-owner",
    "foreign-provider",
    "extra",
    "payload-extra",
    "duplicate",
    "history-duplicate",
    "missing-history",
    "overflow",
  ] as const) {
    const stream = new Writable({
      write(_c, _e, done) {
        done();
      },
    });
    const collector = captureWorkspaceTaskDiagnostic(stream);
    const value = candidateEvent(
      scenario === "foreign-task"
        ? {
            recoveryCorrelationId:
              "operation-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          }
        : scenario === "foreign-owner"
          ? { operationId: "OP-999999" }
          : scenario === "foreign-provider"
            ? { provider: "claude" }
            : scenario === "extra"
              ? { privateText: "DO_NOT_RETAIN" }
              : scenario === "payload-extra"
                ? {
                    diagnostic: {
                      ...candidateEvent().diagnostic,
                      privateText: "DO_NOT_RETAIN",
                    },
                  }
                : {},
    );
    stream.write(frame(value));
    if (scenario === "duplicate") stream.write(frame(value));
    if (scenario === "overflow")
      for (let i = 0; i < 16; i++)
        stream.write(
          frame(candidateEvent({ operationId: `OP-${123457 + i}` })),
        );
    const history = {
      operationId: identity.operationId,
      recoveryCorrelationId: correlation,
      recoveryId,
    };
    const result = collector.finish(
      correlation,
      [],
      false,
      ["history-duplicate", "missing-history"].includes(scenario)
        ? []
        : [identity],
      true,
      scenario === "history-duplicate" ? [history, history] : [],
    );
    assert.equal(
      result.candidateValidation.captureStatus,
      scenario === "overflow" ? "overflow" : "invalid",
    );
    assert.deepEqual(result.candidateValidation.events, []);
    assert.equal(result.closed, true);
    assert.equal(JSON.stringify(result).includes("DO_NOT_RETAIN"), false);
  }
});

/** 診断の件数・一致関係と既存コマンド観測を共通検査へ接続する。 */
test("診断frameは重複key・異なるevent・非objectを保持しない", () => {
  for (const value of [event(), candidateEvent()]) {
    for (const suffix of [
      ',"event":"wrong"}',
      ',"event":null}',
      "}",
      "[]",
      "null",
    ]) {
      const stream = new Writable({
        write(_c, _e, done) {
          done();
        },
      });
      const collector = captureWorkspaceTaskDiagnostic(stream);
      const json = JSON.stringify(value);
      const text = suffix.startsWith(",")
        ? json.slice(0, -1) + suffix
        : json.slice(0, json.indexOf(",")) + suffix;
      stream.write(`[Coordinator lifecycle] ${text}\n`);
      const result = collector.finish(
        correlation,
        [recoveryId],
        true,
        [identity],
        true,
      );
      assert.equal(
        value.event === event().event
          ? result.captureStatus
          : result.candidateValidation.captureStatus,
        "invalid",
      );
      assert.deepEqual(result.events, []);
      assert.deepEqual(result.candidateValidation.events, []);
      assert.equal(result.closed, true);
    }
  }
});

/** 診断の件数・一致関係と既存コマンド観測を共通検査へ接続する。 */
test("候補診断の閉形式は相関する件数と非秘密観測だけを受理する", () => {
  const observation: Record<string, unknown> = Object.fromEntries(
    [...PROVIDER_EXECUTION_OBSERVATION_KEYS].map((key) => [
      key,
      key.endsWith("Count") ? 0 : false,
    ]),
  );
  observation.transport = "fixed_cli_jsonl_v0_164_0";
  observation.turnCompleted = true;
  const valid = {
    ...candidateEvent().diagnostic,
    providerExecutionObservation: observation,
  };
  assert.ok(inspectCandidateValidationFailureDiagnostic(valid));
  for (const change of [
    { pathsMatch: true },
    { candidatePathCount: -1 },
    { reportedPathCount: 1001 },
    { captureStatus: "unavailable" },
    { pathsMatch: null },
    { privateText: "DO_NOT_RETAIN" },
    {
      providerExecutionObservation: {
        ...observation,
        command: "DO_NOT_RETAIN",
      },
    },
    {
      providerExecutionObservation: {
        ...observation,
        commandExecutionFailedCount: -1,
      },
    },
    {
      providerExecutionObservation: {
        ...observation,
        providerTextReported: true,
      },
    },
  ])
    assert.equal(
      inspectCandidateValidationFailureDiagnostic({ ...valid, ...change }),
      null,
    );
  assert.ok(
    inspectCandidateValidationFailureDiagnostic({
      ...valid,
      captureStatus: "unavailable",
      candidatePathCount: null,
      pathsMatch: null,
    }),
  );
});

/** 元write・callbackを透過し、検査済みイベントだけを同じTaskへ返す。 */
test("回復開始collectorは元stderrを透過し同じTaskだけ取得する", () => {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(chunk.toString());
      done();
    },
  });
  const original = stream.write;
  const collector = captureWorkspaceTaskDiagnostic(stream);
  assert.equal(collector.available, true);
  stream.write("arbitrary private output\n");
  stream.write(frame(event()));
  const result = collector.finish(correlation, [recoveryId], true, [identity]);
  assert.equal(result.captureStatus, "captured");
  assert.equal(result.closed, true);
  assert.deepEqual(result.events, [event()]);
  assert.equal(stream.write, original);
  assert.equal(chunks.join(""), `arbitrary private output\n${frame(event())}`);
  assert.equal(
    JSON.stringify(result).includes("arbitrary private output"),
    false,
  );
});

/** 欠測・拒否・過大・別相関・重複を成功診断へ丸めない。 */
test("回復開始collectorは欠測・不正・過大・別Taskを区別する", () => {
  for (const scenario of [
    "empty-success",
    "missing",
    "split",
    "coalesced",
    "unknown-stage",
    "extra",
    "foreign-correlation",
    "foreign-recovery",
    "duplicate",
    "overflow",
    "oversized",
    "double-install",
  ]) {
    const stream = new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    });
    const original = stream.write;
    const collector = captureWorkspaceTaskDiagnostic(stream);
    let expected = "invalid";
    if (scenario === "empty-success") expected = "captured";
    else if (scenario === "missing" || scenario === "split") {
      expected = "missing";
      if (scenario === "split") {
        const text = frame(event());
        stream.write(text.slice(0, 10));
        stream.write(text.slice(10));
      }
    } else if (scenario === "coalesced")
      stream.write(`${frame(event())}other\n`);
    else if (scenario === "unknown-stage")
      stream.write(
        frame(event({ diagnostic: { stage: "secret", recoveryId } })),
      );
    else if (scenario === "extra")
      stream.write(frame(event({ path: "private" })));
    else if (scenario === "foreign-correlation")
      stream.write(
        frame(
          event({
            recoveryCorrelationId: correlation.replace("11111111", "99999999"),
          }),
        ),
      );
    else if (scenario === "foreign-recovery")
      stream.write(
        frame(
          event({
            diagnostic: {
              stage: "home_lock",
              recoveryId: recoveryId.replace("a".repeat(64), "d".repeat(64)),
            },
          }),
        ),
      );
    else if (scenario === "duplicate") {
      stream.write(frame(event()));
      stream.write(frame(event()));
    } else if (scenario === "overflow") {
      expected = "overflow";
      for (let n = 0; n < 17; n++)
        stream.write(frame(event({ operationId: `OP-${123456 + n}` })));
    } else if (scenario === "oversized") {
      expected = "overflow";
      stream.write(frame(event({ padding: "x".repeat(5000) })));
    } else if (scenario === "double-install") {
      expected = "captured";
      const second = captureWorkspaceTaskDiagnostic(stream);
      assert.equal(second.available, false);
      assert.equal(
        second.finish(correlation, [], true).captureStatus,
        "collector_unavailable",
      );
    }
    const result = collector.finish(
      correlation,
      [recoveryId],
      !["empty-success", "double-install"].includes(scenario),
      [identity],
    );
    assert.equal(result.captureStatus, expected, scenario);
    assert.deepEqual(result.events, [], scenario);
    assert.equal(result.closed, true, scenario);
    assert.equal(stream.write, original, scenario);
  }
});

/** 同じ参照でも各Identityの差を拒否し、ID前診断をexactと表示しない。 */
test("回復開始collectorは完全IdentityとTask相関のみを区別する", () => {
  for (const overrides of [
    {},
    { provider: "claude" },
    { taskRole: "reviewer" },
    { taskAttempt: 1 },
    { operationId: "OP-999999" },
  ]) {
    const stream = new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    });
    const collector = captureWorkspaceTaskDiagnostic(stream);
    stream.write(frame(event(overrides)));
    const result = collector.finish(correlation, [recoveryId], true, [
      identity,
    ]);
    assert.equal(
      result.captureStatus,
      Object.keys(overrides).length ? "invalid" : "captured",
    );
  }
  for (const diagnostic of [
    { stage: "home_lock", recoveryId: null },
    { stage: "operation_start_save", recoveryId },
  ]) {
    const stream = new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    });
    const collector = captureWorkspaceTaskDiagnostic(stream);
    stream.write(frame(event({ diagnostic })));
    const result = collector.finish(correlation, [recoveryId], true, []);
    assert.equal(result.captureStatus, "task_only");
    assert.equal(result.events.length, 1);
  }
  {
    const source = fs.readFileSync(
      new URL("../../scripts/verify-workspace-ai.ts", import.meta.url),
      "utf8",
    );
    const begin = source.indexOf(
      "for (const operation of read.value.snapshot.operations) {",
    );
    const end = source.indexOf("const historyFile =", begin);
    assert.ok(begin > 0 && end > begin);
    const identities = runInNewContext(
      `const identities=[];${stripTypeScriptTypes(source.slice(begin, end))};identities`,
      {
        read: {
          value: {
            snapshot: {
              operations: [
                {
                  kind: "docker_task",
                  recoveryId,
                  identityJson: JSON.stringify({
                    ...identity,
                    recoveryCorrelationId:
                      "operation-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                    executionSelection: { role: "executor" },
                  }),
                },
              ],
            },
          },
        },
        correlationId: correlation,
      },
    );
    assert.equal(identities.length, 1);
    const stream = new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    });
    const collector = captureWorkspaceTaskDiagnostic(stream);
    stream.write(frame(event()));
    const result = collector.finish(
      correlation,
      [recoveryId],
      true,
      identities,
    );
    assert.equal(result.captureStatus, "invalid");
    assert.deepEqual(result.events, []);
  }
  {
    const source = fs.readFileSync(
      new URL("../../scripts/verify-workspace-ai.ts", import.meta.url),
      "utf8",
    );
    const begin = source.indexOf("const historyFile =");
    const end = source.indexOf("\n            }\n          } finally", begin);
    assert.ok(begin > 0 && end > begin);
    const result = runInNewContext(
      `const historyIdentities=[];${stripTypeScriptTypes(source.slice(begin, end))};historyIdentities`,
      {
        root: "synthetic",
        path: { join: (...parts: string[]) => parts.join("/") },
        fs: {
          existsSync: () => true,
          lstatSync: () => ({ isSymbolicLink: () => false, nlink: 1 }),
        },
        assert,
        MAX_COORDINATOR_STATE_BYTES: 4096,
        readStableBoundedFileSnapshot: () => ({
          bytes: Buffer.from("synthetic"),
        }),
        decodeCoordinatorHistoryRows: () => [
          {
            recoveryId,
            line: JSON.stringify({
              summary: {
                schema: "crdd-coordinator/operation-summary/v4",
                operationId: identity.operationId,
                recoveryCorrelationId: correlation,
              },
            }),
          },
        ],
      },
    );
    assert.equal(result.length, 1);
    assert.deepEqual(Object.keys(result[0]).sort(), [
      "operationId",
      "recoveryCorrelationId",
      "recoveryId",
    ]);
    assert.equal(result[0].recoveryCorrelationId, correlation);
  }
  {
    const stream = new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    });
    const collector = captureWorkspaceTaskDiagnostic(stream);
    stream.write(frame(event({ provider: "claude", taskRole: "reviewer" })));
    const result = collector.finish(correlation, [recoveryId], true, [
      { ...identity, provider: "claude", taskRole: "reviewer" },
    ]);
    assert.equal(result.captureStatus, "captured");
  }
});

/** 復元できない場合は同Processで新しい取得を許可しない。 */
test("回復開始collectorは復元不能後の再設置を拒否する", () => {
  const stream = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const collector = captureWorkspaceTaskDiagnostic(stream);
  const foreignWrite = (() => true) as typeof stream.write;
  stream.write = foreignWrite;
  const result = collector.finish(correlation, [], false);
  assert.equal(result.closed, false);
  assert.equal(result.captureStatus, "invalid");
  assert.equal(stream.write, foreignWrite);
  const next = captureWorkspaceTaskDiagnostic(stream);
  assert.equal(next.available, false);
  assert.equal(
    next.finish(correlation, [], false).captureStatus,
    "collector_unavailable",
  );
});

/** writeの復元代入自体が失敗しても同じProcessのlatchを解除しない。 */
test("回復開始collectorは復元代入の拒否と無反映を保持する", () => {
  const source = fs.readFileSync(
    new URL("../../scripts/workspace-task-diagnostic.ts", import.meta.url),
    "utf8",
  );
  const begin = source.indexOf(
    "export function captureWorkspaceTaskDiagnostic(",
  );
  const body = stripTypeScriptTypes(source.slice(begin)).replace(
    "export function",
    "function",
  );
  for (const mode of ["throw", "ignored"]) {
    const create = runInNewContext(
      `let installed=false;const marker='marker';${body};captureWorkspaceTaskDiagnostic`,
      { Buffer },
    );
    let current = () => true;
    let assignments = 0;
    const stream = {};
    Object.defineProperty(stream, "write", {
      get: () => current,
      set: (value: () => boolean) => {
        if (++assignments > 1) {
          if (mode === "throw") throw new Error("restore denied");
          return;
        }
        current = value;
      },
    });
    const collector = create(stream);
    assert.equal(collector.available, true);
    const result = collector.finish(null, [], false);
    assert.equal(result.closed, false);
    assert.equal(result.captureStatus, "invalid");
    assert.equal(create(stream).available, false);
  }
});
