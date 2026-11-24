/**
 * Node操作取得・必須保存通知・実Machine・wx解放の相関を検証する。
 * @responsibility 未処置・取消・処置不明・清掃不明を分離する。
 * @trace ERB-IT-014
 * @level IT
 * @scope 実Docker・Native・外部AIなし。
 * @boundary 修復入口→実Machine→有限技術操作代役。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  type RepairInput,
  runRepairSessionWithDependencies,
} from "../../src/docker-desktop/repair-session.ts";
import type {
  DesktopOperations,
  RepairCheckpoint,
} from "../../src/docker-desktop/types.ts";
import {
  decodeRepairCheckpoint,
  validateRepairCheckpointTransition,
} from "../../src/docker-desktop/validation.ts";

function fixture(change = "") {
  const counts = {
    acquire: 0,
    prepare: 0,
    prepared: 0,
    notifications: 0,
    effects: 0,
    close: 0,
  };
  const controller = new AbortController();
  let saved: RepairCheckpoint | null = null;
  const desktop: DesktopOperations = {
    verify: () => change !== "dead",
    command: async () => {
      counts.effects++;
      throw Error("unused CLI");
    },
    close: async () => {
      counts.close++;
      return change !== "close";
    },
  };
  const input: RepairInput = {
    operationNonce: "1".repeat(64),
    signal: controller.signal,
    resume: null,
    canIssueEffect: () => change !== "boundary",
    onPrepared(value) {
      counts.prepared++;
      if (change === "prepared") throw Error("save");
      saved = value;
    },
    onCheckpoint(value) {
      counts.notifications++;
      if (change === "checkpoint") throw Error("save");
      assert.ok(saved);
      assert.equal(validateRepairCheckpointTransition(saved, value), true);
      assert.ok(decodeRepairCheckpoint(value));
      saved = value;
    },
  };
  const dependencies: Parameters<typeof runRepairSessionWithDependencies>[1] = {
    async acquire() {
      counts.acquire++;
      if (change === "acquire") throw Error("acquire");
      return {
        operations: change === "unavailable" ? null : desktop,
        cleanupConfirmed: change !== "acquire-cleanup",
      };
    },
    async prepare(operations, nonce) {
      counts.prepare++;
      assert.equal(operations, desktop);
      assert.equal(nonce, input.operationNonce);
      if (change === "prepare") return null;
      return {
        cleanupFailure: () =>
          change === "observation-cleanup"
            ? "observation_cleanup_unknown"
            : null,
        technical: {
          async observe(checkpoint) {
            return {
              ...checkpoint,
              engine: "ready",
              hostSafety: "safe",
              stale: "absent",
              directories: Object.fromEntries(
                Object.entries(checkpoint.directories).map(
                  ([name, directory]) => [
                    name,
                    {
                      ...directory,
                      source: { state: "absent", identity: null },
                      retained: { state: "absent", identity: null },
                    },
                  ],
                ),
              ) as RepairCheckpoint["directories"],
            };
          },
          precondition: async () => "not_required",
          execute: async () => {
            counts.effects++;
            throw Error("unexpected effect");
          },
          awaitEngine: async () => ({ state: "ready", continuation: null }),
        },
      };
    },
  };
  return {
    counts,
    input,
    dependencies,
    controller,
    saved: () => saved,
    desktop,
  };
}

test("現在確認が元Requestを変更しても捕捉済みSignalをCLIへ渡す", async () => {
  const f = fixture();
  const replacement = new AbortController();
  const request = {
    ...f.input,
    canIssueEffect() {
      request.signal = replacement.signal;
      return true;
    },
  };
  const acquire = f.dependencies.acquire;
  let received: AbortSignal | null = null;
  const result = await runRepairSessionWithDependencies(request, {
    ...f.dependencies,
    acquire(signal) {
      received = signal;
      return acquire(signal);
    },
  });
  assert.equal(received, f.controller.signal);
  assert.equal(result.preparation, "prepared");
});
test("初回・再入場でNative識別値を使わず同じCheckpointを保存する", async () => {
  const f = fixture();
  const first = await runRepairSessionWithDependencies(f.input, f.dependencies);
  assert.equal(first.preparation, "prepared");
  assert.equal(first.machine?.status, "recovered");
  assert.equal(first.checkpoint?.cleanup, "confirmed");
  assert.equal(first.finalCheckpointConfirmed, false);
  assert.equal(f.counts.effects, 0);
  assert.equal(f.counts.close, 1);
  assert.ok(first.checkpoint);
  assert.equal("scopeSha256" in first, false);
  assert.equal("ownerBindingSha256" in first, false);
  const resumed = await runRepairSessionWithDependencies(
    { ...f.input, resume: first.checkpoint },
    f.dependencies,
  );
  assert.equal(resumed.machine?.status, "recovered");
  assert.equal(f.counts.close, 2);
});
for (const change of [
  "boundary",
  "dead",
  "unavailable",
  "acquire",
  "acquire-cleanup",
  "prepare",
  "prepared",
  "checkpoint",
  "close",
  "observation-cleanup",
]) {
  test("準備・保存・取得・解放の失敗を成功へ変えない: " + change, async () => {
    const f = fixture(change);
    const result = await runRepairSessionWithDependencies(
      f.input,
      f.dependencies,
    );
    assert.equal(f.counts.effects, 0);
    if (
      [
        "boundary",
        "dead",
        "unavailable",
        "acquire",
        "prepare",
        "prepared",
      ].includes(change)
    )
      assert.notEqual(result.preparation, "prepared");
    if (["close", "acquire-cleanup", "acquire"].includes(change))
      assert.equal(
        result.lifecycle?.cleanupConfirmed === false ||
          result.checkpoint?.cleanup === "unknown",
        true,
      );
    if (change === "observation-cleanup")
      assert.equal(
        result.lifecycle?.observationCleanupFailure,
        "observation_cleanup_unknown",
      );
    if (change === "boundary") assert.equal(f.counts.acquire, 0);
    if (!["boundary", "unavailable", "acquire"].includes(change))
      assert.equal(f.counts.close, 1);
  });
}
test("旧Native相関field・旧resumeを互換読替えせず取得前に拒否する", async () => {
  const f = fixture();
  for (const value of [
    { ...f.input, ownerBindingSha256: "a".repeat(64) },
    { ...f.input, scopeSha256: "b".repeat(64) },
    {
      ...f.input,
      resume: {
        ownerBindingSha256: "a".repeat(64),
        scopeSha256: "b".repeat(64),
        checkpoint: null,
      },
    },
  ]) {
    const result = await runRepairSessionWithDependencies(
      value as unknown as RepairInput,
      f.dependencies,
    );
    assert.equal(result.preparation, "input_rejected");
  }
  assert.equal(f.counts.acquire, 0);
});
test("開始前取消と遅延取得中取消は後続処置を発行しない", async () => {
  const early = fixture();
  early.controller.abort();
  await runRepairSessionWithDependencies(early.input, early.dependencies);
  assert.equal(early.counts.acquire, 0);
  const late = fixture();
  let fulfill:
    | ((value: Awaited<ReturnType<typeof late.dependencies.acquire>>) => void)
    | undefined;
  const acquisition = new Promise<
    Awaited<ReturnType<typeof late.dependencies.acquire>>
  >((r) => {
    fulfill = r;
  });
  const output = runRepairSessionWithDependencies(late.input, {
    ...late.dependencies,
    acquire: () => acquisition,
  });
  late.controller.abort();
  assert.ok(fulfill);
  fulfill({ operations: late.desktop, cleanupConfirmed: true });
  const result = await output;
  assert.equal(result.lifecycle?.failure, "cancelled");
  assert.equal(late.counts.close, 1);
  assert.equal(late.counts.effects, 0);
});
