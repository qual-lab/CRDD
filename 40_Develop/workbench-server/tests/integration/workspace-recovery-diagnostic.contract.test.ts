/**
 * Workspace試験の回復開始診断を、同じTaskと有限な安全結果へ結合する。
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
import { captureWorkspaceRecoveryDiagnostic } from "../../scripts/workspace-recovery-diagnostic.ts";

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
  const collector = captureWorkspaceRecoveryDiagnostic(stream);
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
    const collector = captureWorkspaceRecoveryDiagnostic(stream);
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
      const second = captureWorkspaceRecoveryDiagnostic(stream);
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
    const collector = captureWorkspaceRecoveryDiagnostic(stream);
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
    const collector = captureWorkspaceRecoveryDiagnostic(stream);
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
    const end = source.indexOf("\n            }\n          } finally", begin);
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
    const collector = captureWorkspaceRecoveryDiagnostic(stream);
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
    const stream = new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    });
    const collector = captureWorkspaceRecoveryDiagnostic(stream);
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
  const collector = captureWorkspaceRecoveryDiagnostic(stream);
  const foreignWrite = (() => true) as typeof stream.write;
  stream.write = foreignWrite;
  const result = collector.finish(correlation, [], false);
  assert.equal(result.closed, false);
  assert.equal(result.captureStatus, "invalid");
  assert.equal(stream.write, foreignWrite);
  const next = captureWorkspaceRecoveryDiagnostic(stream);
  assert.equal(next.available, false);
  assert.equal(
    next.finish(correlation, [], false).captureStatus,
    "collector_unavailable",
  );
});

/** writeの復元代入自体が失敗しても同じProcessのlatchを解除しない。 */
test("回復開始collectorは復元代入の拒否と無反映を保持する", () => {
  const source = fs.readFileSync(
    new URL("../../scripts/workspace-recovery-diagnostic.ts", import.meta.url),
    "utf8",
  );
  const begin = source.indexOf(
    "export function captureWorkspaceRecoveryDiagnostic(",
  );
  const body = stripTypeScriptTypes(source.slice(begin)).replace(
    "export function",
    "function",
  );
  for (const mode of ["throw", "ignored"]) {
    const create = runInNewContext(
      `let installed=false;const marker='marker';${body};captureWorkspaceRecoveryDiagnostic`,
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
