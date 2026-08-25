import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  acquireRuntimeOwnedCandidateStoreKernelLock,
  acquireRuntimeOwnedHostOperationKernelLock,
  acquireRuntimeOwnedInteractiveConsoleKernelLock,
} from "../src/security/candidate-store-kernel-lock.ts";

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

test("Windows対話Console lockは同時承認readerを一つへ限定する", () => {
  if (process.platform !== "win32") return;
  const first = acquireRuntimeOwnedInteractiveConsoleKernelLock();
  assert.ok(first);
  assert.equal(acquireRuntimeOwnedInteractiveConsoleKernelLock(), null);
  assert.equal(first.release(), true);
  const next = acquireRuntimeOwnedInteractiveConsoleKernelLock();
  assert.ok(next);
  assert.equal(next.release(), true);
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
