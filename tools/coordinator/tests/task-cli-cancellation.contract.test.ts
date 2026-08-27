import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createScanner, SyntaxKind } from "typescript/unstable/ast";

import { createTaskCliCancellationLatch } from "../src/core/task-cli-cancellation.ts";

test("CLI取消latchは重複signalを同じPromiseと一つのobserverへ収束する", async () => {
  let cancelEffects = 0;
  const receipt = Object.freeze({ status: "requested" });
  const latch = createTaskCliCancellationLatch(() => {
    cancelEffects += 1;
    return Promise.resolve(receipt);
  });
  const first = latch.request();
  const duplicate = latch.request();
  assert.strictEqual(duplicate, first);
  assert.strictEqual(await first, receipt);
  assert.equal(cancelEffects, 1);
  assert.equal(latch.observerCount(), 1);
});

test("CLI取消latchは同期throwと非同期rejectを未処理rejectionへ流さない", async () => {
  for (const requestCancellation of [
    () => {
      throw new Error("fixed_sync_throw");
    },
    () => Promise.reject(new Error("fixed_async_reject")),
  ]) {
    const latch = createTaskCliCancellationLatch(requestCancellation);
    const observed = latch.request();
    assert.strictEqual(latch.request(), observed);
    await assert.rejects(observed);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(latch.observerCount(), 1);
  }
});

test("CLI取消latchはnever receiptも重複Effectなしで保持する", () => {
  let cancelEffects = 0;
  const never = new Promise<never>(() => undefined);
  const latch = createTaskCliCancellationLatch(() => {
    cancelEffects += 1;
    return never;
  });
  assert.strictEqual(latch.request(), never);
  assert.strictEqual(latch.request(), never);
  assert.equal(cancelEffects, 1);
  assert.equal(latch.observerCount(), 1);
});

test("CLI相当のvoid取消はstrict独立Processで未処理rejectionを作らない", () => {
  const fixture = path.join(
    import.meta.dirname,
    "fixtures",
    "task-cli-cancellation-strict-probe.ts",
  );
  for (const scenario of ["sync_throw", "async_reject", "malformed", "never"]) {
    const child = spawnSync(
      process.execPath,
      ["--unhandled-rejections=strict", fixture, scenario],
      {
        cwd: path.resolve(import.meta.dirname, ".."),
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    assert.equal(child.error, undefined, scenario);
    assert.equal(child.status, 0, `${scenario}: ${child.stderr}`);
    assert.equal(child.signal, null, scenario);
    assert.equal(child.stderr, "", scenario);
    const lines = child.stdout.trimEnd().split("\n");
    assert.equal(lines.length, 1, scenario);
    assert.deepEqual(JSON.parse(lines[0] ?? "null"), {
      scenario,
      cancellationEffects: 1,
      observerCount: 1,
      sigintListeners: 0,
      sigtermListeners: 0,
      outputCount: 1,
    });
  }
});

function tokenValues(source: string) {
  const scanner = createScanner(true, undefined, source);
  const values: string[] = [];
  for (;;) {
    const kind = scanner.scan();
    if (kind === SyntaxKind.EndOfFile) return values;
    values.push(
      kind === SyntaxKind.StringLiteral ||
        kind === SyntaxKind.NoSubstitutionTemplateLiteral
        ? scanner.getTokenValue()
        : scanner.getTokenText(),
    );
  }
}

function countSequence(tokens: readonly string[], expected: readonly string[]) {
  let count = 0;
  for (let index = 0; index <= tokens.length - expected.length; index += 1)
    if (expected.every((value, offset) => tokens[index + offset] === value))
      count += 1;
  return count;
}

test("公開CLIは単一latchと同一listenerを両signal・finally解除へ構文結合する", () => {
  const source = fs.readFileSync(
    path.join(import.meta.dirname, "..", "bin", "coordinator.ts"),
    "utf8",
  );
  const taskFunctionStart = source.indexOf("async function runTaskCommand");
  const bindingStart = source.indexOf(
    "  const cancellation =",
    taskFunctionStart,
  );
  const taskTryStart = source.indexOf("  try {", bindingStart);
  const finallyStart = source.indexOf("  } finally {", taskTryStart);
  const taskFunctionEnd = source.indexOf(
    "\n}\n\nfunction runCandidateCommand",
    finallyStart,
  );
  assert.ok(taskFunctionStart > 0);
  assert.ok(bindingStart > taskFunctionStart);
  assert.ok(taskTryStart > bindingStart);
  assert.ok(finallyStart > taskTryStart);
  assert.ok(taskFunctionEnd > finallyStart);
  const tokens = [
    ...tokenValues(source.slice(0, taskFunctionStart)),
    ...tokenValues(source.slice(bindingStart, taskTryStart)),
    ...tokenValues(source.slice(finallyStart, taskFunctionEnd)),
  ];
  assert.equal(
    countSequence(tokens, [
      "import",
      "{",
      "createTaskCliCancellationLatch",
      "}",
      "from",
      "../src/core/task-cli-cancellation.ts",
    ]),
    1,
  );
  assert.equal(
    countSequence(tokens, [
      "const",
      "cancellation",
      "=",
      "createTaskCliCancellationLatch",
      "(",
      "(",
      ")",
      "=>",
      "cancelRuntimeOwnedCoordinatorTask",
      "(",
      "started",
      ".",
      "controlCapability",
      ")",
      ",",
      ")",
    ]),
    1,
  );
  assert.equal(
    countSequence(tokens, [
      "const",
      "cancel",
      "=",
      "(",
      ")",
      "=>",
      "void",
      "cancellation",
      ".",
      "request",
      "(",
      ")",
    ]),
    1,
  );
  for (const method of ["on", "removeListener"])
    for (const signal of ["SIGINT", "SIGTERM"])
      assert.equal(
        countSequence(tokens, [
          "process",
          ".",
          method,
          "(",
          signal,
          ",",
          "cancel",
          ")",
        ]),
        1,
      );
  assert.equal(
    tokens.filter((token) => token === "createTaskCliCancellationLatch").length,
    2,
  );
  assert.equal(
    tokens.filter((token) => token === "cancelRuntimeOwnedCoordinatorTask")
      .length,
    2,
  );
});
