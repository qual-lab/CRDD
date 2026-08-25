import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  acquireInteractiveConsoleKernelLockOutcomeUsingFactory,
  acquireRuntimeOwnedCandidateStoreKernelLock,
  acquireRuntimeOwnedHostOperationKernelLock,
  acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome,
  describeCandidateStoreKernelLockContract,
} from "../src/security/candidate-store-kernel-lock.ts";

function interactiveLockWorkerScenario(initialState: 1 | -1) {
  const listeners = new Map<string, (value: unknown) => void>();
  return Object.freeze({
    factory: (_pipeName: string, sharedState: SharedArrayBuffer) => {
      const state = new Int32Array(sharedState);
      Atomics.store(state, 0, initialState);
      Atomics.notify(state, 0);
      return Object.freeze({
        unref: () => undefined,
        postMessage: () => {
          Atomics.store(state, 0, 2);
          Atomics.notify(state, 0);
          queueMicrotask(() => listeners.get("exit")?.(0));
        },
        terminate: async () => {
          queueMicrotask(() => listeners.get("exit")?.(0));
          return 0;
        },
        once: (event: "error" | "exit", listener: (value: never) => void) => {
          listeners.set(event, listener as (value: unknown) => void);
        },
      });
    },
  });
}

test("Windows kernel lockは不正Identity、同時取得と二重releaseを拒否する", () => {
  assert.equal(acquireRuntimeOwnedCandidateStoreKernelLock("invalid"), null);
  if (process.platform !== "win32") return;
  const protectionHash = createHash("sha256")
    .update(randomBytes(32))
    .digest("hex");
  const first = acquireRuntimeOwnedCandidateStoreKernelLock(protectionHash);
  assert.ok(first);
  assert.equal(
    acquireRuntimeOwnedCandidateStoreKernelLock(protectionHash),
    null,
  );
  assert.equal(first.release(), true);
  assert.equal(first.release(), false);
  const next = acquireRuntimeOwnedCandidateStoreKernelLock(protectionHash);
  assert.ok(next);
  assert.equal(next.release(), true);
});

test("Windows対話Console lockは同時承認readerを一つへ限定する", async () => {
  if (process.platform !== "win32") return;
  const first = await acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
  assert.equal(first.status, "acquired");
  assert.ok(first.lock);
  const competing =
    await acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
  assert.equal(competing.status, "unavailable");
  assert.equal(await first.lock.release(), "released");
  const next = await acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
  assert.equal(next.status, "acquired");
  assert.ok(next.lock);
  assert.equal(await next.lock.release(), "released");
});

test("対話Console専用lockは終了確認済み非取得とcleanup不明を分離する", async () => {
  if (process.platform !== "win32") return;
  const unavailable =
    await acquireInteractiveConsoleKernelLockOutcomeUsingFactory(
      interactiveLockWorkerScenario(-1).factory,
    );
  assert.deepEqual(unavailable, { status: "unavailable", lock: null });

  const acquired = await acquireInteractiveConsoleKernelLockOutcomeUsingFactory(
    interactiveLockWorkerScenario(1).factory,
  );
  assert.equal(acquired.status, "acquired");
  assert.ok(acquired.lock);
  assert.equal(await acquired.lock.release(), "released");

  const timedOut = await acquireInteractiveConsoleKernelLockOutcomeUsingFactory(
    () =>
      Object.freeze({
        unref: () => undefined,
        postMessage: () => undefined,
        terminate: async () => 0,
        once: () => undefined,
      }),
  );
  assert.deepEqual(timedOut, { status: "cleanup_unknown", lock: null });
});

test("対話Console専用lockの非同期cleanup契約は共通同期lockの意味を変更しない", () => {
  const contract = describeCandidateStoreKernelLockContract();
  assert.equal(
    contract.interactiveConsoleLock,
    "dedicated_async_acquire_and_release_with_state_and_worker_exit_confirmation",
  );
  assert.deepEqual(contract.interactiveConsoleOutcomes, [
    "acquired",
    "unavailable",
    "cleanup_unknown_process_restart_required",
  ]);
  assert.equal(contract.commonSynchronousLockMeaningChanged, false);
});

test("Host Operation owner lockはprocess世代をまたぐ同時取得を拒否し強制終了後に回復する", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const rootName = "crdd-coordinator-doctor-ABC123";
  const nonce = "11111111-2222-4333-8444-555555555555";
  const child = spawn(
    process.execPath,
    [fileURLToPath(ownerFixture), "host", rootName, nonce],
    {
      env: {},
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  context.after(() => {
    if (child.exitCode === null) child.kill();
  });
  let stdout = "";
  while (!stdout.includes("READY\n")) {
    const [chunk] = (await once(child.stdout, "data")) as [Buffer];
    stdout += chunk.toString("utf8");
  }
  assert.equal(
    acquireRuntimeOwnedHostOperationKernelLock(rootName, nonce),
    null,
  );
  assert.equal(child.kill(), true);
  await once(child, "exit");
  const recovered = acquireRuntimeOwnedHostOperationKernelLock(rootName, nonce);
  assert.ok(recovered);
  assert.equal(recovered.release(), true);
});

const ownerFixture = new URL(
  "./fixtures/candidate-store-lock-owner.ts",
  import.meta.url,
);

test("Windows kernel lockはowner process強制終了後にstale residueなしで再取得できる", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const protectionHash = createHash("sha256")
    .update(randomBytes(32))
    .digest("hex");
  const child = spawn(
    process.execPath,
    [fileURLToPath(ownerFixture), protectionHash],
    {
      env: {},
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  context.after(() => {
    if (child.exitCode === null) child.kill();
  });
  let stdout = "";
  while (!stdout.includes("READY\n")) {
    const [chunk] = (await once(child.stdout, "data")) as [Buffer];
    stdout += chunk.toString("utf8");
  }
  assert.equal(
    acquireRuntimeOwnedCandidateStoreKernelLock(protectionHash),
    null,
  );
  assert.equal(child.kill(), true);
  await once(child, "exit");
  const recovered = acquireRuntimeOwnedCandidateStoreKernelLock(protectionHash);
  assert.ok(recovered);
  assert.equal(recovered.release(), true);
});
