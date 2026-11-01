/**
 * 共通Lifecycleの実行・清掃・結果の順序を有限操作で確認する。
 * @responsibility 一次失敗・清掃待機・取消と認証の終了不明を反証する。
 * @trace ERB-IT-004
 * @level UT
 * @scope メモリ内の操作だけ。実AI・Docker・保存を使わない。
 * @boundary 技術生涯と上位の保存・Home解放。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { bindAuthenticationLifecycle } from "../../src/authentication/operations.ts";
import type {
  Authentication,
  AuthenticationResult,
} from "../../src/authentication/types.ts";
import { executeLifecycle } from "../../src/lifecycle/execute.ts";

/** falsyな例外も発生事実と値を分け、清掃例外による一次値上書きを拒否する。 */
test("共通Lifecycleはfalsy例外・二重例外・正常を取り違えない", async () => {
  for (const primary of [null, undefined, false, 0, ""]) {
    for (const secondary of [false, true]) {
      let cleaned = false;
      const result = await executeLifecycle(
        {
          async execute() {
            throw primary;
          },
          async cleanup() {
            cleaned = true;
            if (secondary) throw Error("secondary");
          },
          createResult(_context, failure, failed) {
            return { failure, failed };
          },
        },
        undefined,
      );
      assert.equal(cleaned, true);
      assert.equal(result.failed, true);
      assert.equal(result.failure, primary);
    }
  }
  const clean = await executeLifecycle(
    {
      async execute() {},
      async cleanup() {},
      createResult(_context, failure, failed) {
        return { failure, failed };
      },
    },
    undefined,
  );
  assert.deepEqual(clean, { failure: null, failed: false });
  const cleanupOnly = await executeLifecycle(
    {
      async execute() {},
      async cleanup() {
        throw undefined;
      },
      createResult(_context, failure, failed) {
        return { failure, failed };
      },
    },
    undefined,
  );
  assert.deepEqual(cleanupOnly, { failure: undefined, failed: true });
});

/** 最終command／清掃待機中の取消と、既存一次理由後の清掃例外を固定する。 */
test("認証は最終取消を反映し清掃例外で一次理由を上書きしない", async () => {
  for (const mode of [
    "cancel_execute",
    "cancel_cleanup",
    "primary_cleanup_error",
    "normal_cleanup_error",
  ]) {
    let release!: () => void;
    let ready!: () => void;
    const reached = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const primary =
      mode === "primary_cleanup_error"
        ? "provider_authentication_resource_receipt_unconfirmed"
        : "provider_authentication_completed";
    const core: Authentication = {
      projection: {
        provider: "claude",
        action: "status",
        ownershipLabel: "synthetic",
        resources: [],
      },
      async execute() {
        if (mode === "cancel_execute") {
          ready();
          await waiting;
        }
        return {
          reason: primary,
          authenticationStatus: "confirmed",
          authenticationConfirmed: true,
          providerEffectIssued: true,
          processCompletionConfirmed: true,
        };
      },
      async cleanup() {
        if (mode === "cancel_cleanup") {
          ready();
          await waiting;
        }
        if (mode.endsWith("error")) throw null;
        return { confirmed: true, processCompletionConfirmed: true };
      },
      isProcessCompletionConfirmed: () => true,
    };
    const executor = bindAuthenticationLifecycle(core);
    assert.ok(executor);
    const pending = executor.start({
      assertOwner: () => true,
      readResources: () => [],
    }).completion;
    if (mode.startsWith("cancel")) {
      await reached;
      executor.cancel();
      release();
    }
    const result = await pending;
    assert.equal(result.authenticationConfirmed, true);
    assert.equal(
      result.reason,
      mode.startsWith("cancel")
        ? "provider_authentication_cancelled"
        : mode === "primary_cleanup_error"
          ? primary
          : "provider_authentication_process_completion_unconfirmed",
    );
    assert.equal(result.cleanupConfirmed, mode.startsWith("cancel"));
  }
});

/** 清掃が終了する前に結果を公開せず、清掃例外で一次失敗を上書きしない。 */
test("共通Lifecycleは同じContextで清掃をjoinし一次失敗を保持する", async () => {
  const context = {},
    events: string[] = [];
  const primary = Error("primary"),
    secondary = Error("cleanup");
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const completion = executeLifecycle(
    {
      async execute(actual) {
        assert.equal(actual, context);
        events.push("execute");
        throw primary;
      },
      async cleanup(actual) {
        assert.equal(actual, context);
        events.push("cleanup");
        await waiting;
        throw secondary;
      },
      createResult(actual, failure) {
        assert.equal(actual, context);
        events.push("result");
        return failure;
      },
    },
    context,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ["execute", "cleanup"]);
  release();
  assert.equal(await completion, primary);
  assert.deepEqual(events, ["execute", "cleanup", "result"]);
});

/** 認証も一回のstart・取消を同じRuntimeに渡し、終了不明の後に清掃を発行しない。 */
test("認証の共通Lifecycleは正常・取消・終了不明・清掃失敗を区別する", async () => {
  for (const mode of [
    "normal",
    "cancel",
    "unknown",
    "cleanup_failed",
    "throw",
  ] as const) {
    let cleanups = 0;
    let observedSignal: AbortSignal | undefined;
    const result: AuthenticationResult = {
      reason: "provider_authentication_completed",
      authenticationStatus: "confirmed",
      authenticationConfirmed: true,
      providerEffectIssued: true,
      processCompletionConfirmed: mode !== "unknown",
    };
    const core: Authentication = {
      projection: {
        provider: "codex",
        action: "status",
        ownershipLabel: "synthetic",
        resources: [],
      },
      async execute(signal, current, callbacks) {
        assert.equal(current(), true);
        observedSignal = signal;
        callbacks?.onCommandSubmitting?.("synthetic");
        if (mode === "throw") throw Error("synthetic");
        await new Promise((resolve) => setImmediate(resolve));
        return {
          ...result,
          ...(signal?.aborted
            ? { reason: "provider_authentication_cancelled" }
            : {}),
        };
      },
      async cleanup(read, current) {
        cleanups++;
        assert.deepEqual(read(), []);
        assert.equal(current(), true);
        return {
          confirmed: mode !== "cleanup_failed",
          processCompletionConfirmed: true,
        };
      },
      isProcessCompletionConfirmed: () =>
        mode !== "unknown" && mode !== "throw",
    };
    const executor = bindAuthenticationLifecycle(core);
    assert.ok(executor);
    assert.equal(executor.recordProjection, core.projection);
    const notices: string[] = [];
    const started = executor.start(
      { assertOwner: () => true, readResources: () => [] },
      {
        onCommandSubmitting: (purpose) => {
          notices.push(purpose);
        },
      },
    );
    if (mode === "cancel") executor.cancel();
    assert.throws(
      () =>
        executor.start({ assertOwner: () => true, readResources: () => [] }),
      /already_started/,
    );
    const completed = await started.completion;
    assert.deepEqual(notices, ["synthetic"]);
    assert.equal(cleanups, mode === "unknown" || mode === "throw" ? 0 : 1);
    assert.equal(
      completed.cleanupConfirmed,
      mode === "normal" || mode === "cancel",
    );
    assert.equal(
      completed.processCompletionConfirmed,
      mode !== "unknown" && mode !== "throw",
    );
    if (mode === "cancel") {
      assert.equal(observedSignal?.aborted, true);
      assert.equal(completed.reason, "provider_authentication_cancelled");
    }
  }
});
