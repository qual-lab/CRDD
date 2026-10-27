/**
 * Runtime保存専用Kernelの実競合・解放・Owner終了を確認する。
 * @packageDocumentation
 * @responsibility 保存Ownerの実OS境界をDomain内へ閉じる。
 * @trace ERB-IT-003
 * @level IT
 * @scope Windows Named Pipe。AI・Dockerは使用しない。
 * @boundary Domain保存KernelとPlatform Access公開primitive。
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { acquireNamedPipeKernelLock } from "../../../platform-access/src/index.ts";
import { acquireRuntimeOwnedCoordinatorStateKernelLock } from "../../src/storage/runtime-kernel-lock.ts";

const ownerFixture = new URL(
  "../fixtures/runtime-kernel-owner.ts",
  import.meta.url,
);

/**
 * Coordinator Snapshotの短期排他をWindows実資源で確認する。
 * @responsibility 同じRootの競合、別Root・別Ownerとの独立、解放後の再取得を確認する。
 * @trace ERB-IT-003
 * @precondition Windowsの名前付きPipeを使用しDockerとProviderは使用しない。
 * @stimulus 同じRootと異なるRootでLockを取得し解放する。
 * @observation 取得結果、assertLive、解放と再取得を観測する。
 * @oracle 同じRootだけが競合し解放後は再取得できる。
 * @cleanup 取得した全Lockをfinallyで解放する。
 * @boundary ERB-IT-003=Direct Boundary: Domain保存Owner→Windows排他資源。
 */
test("Host Windows: Coordinator Snapshot排他はRootとOwnerを分離し解放後に再取得できる", {
  skip: process.platform !== "win32",
}, () => {
  for (const invalid of [null, {}, "", "A".repeat(64), "a".repeat(63)]) {
    assert.equal(acquireRuntimeOwnedCoordinatorStateKernelLock(invalid), null);
  }
  const hash = randomBytes(32).toString("hex");
  const first = acquireRuntimeOwnedCoordinatorStateKernelLock(hash);
  assert.ok(first);
  const other = acquireRuntimeOwnedCoordinatorStateKernelLock(
    randomBytes(32).toString("hex"),
  );
  const projectIdentity = createHash("sha256")
    .update("crdd-orchestrator-state-kernel-lock-v1\0")
    .update(hash)
    .digest("hex")
    .slice(0, 32);
  const project = acquireNamedPipeKernelLock(
    `\\\\.\\pipe\\CRDD.Coordinator.CoordinatorState.${projectIdentity}`,
  );
  try {
    assert.equal(first.assertLive(), true);
    assert.equal(acquireRuntimeOwnedCoordinatorStateKernelLock(hash), null);
    assert.ok(other);
    assert.ok(project);
    assert.equal(other.assertLive(), true);
    assert.equal(project.assertLive(), true);
  } finally {
    other?.release();
    project?.release();
    assert.equal(first.release(), true);
  }
  assert.equal(first.assertLive(), false);
  const reacquired = acquireRuntimeOwnedCoordinatorStateKernelLock(hash);
  assert.ok(reacquired);
  assert.equal(reacquired.release(), true);
});

/**
 * Windows kernel lockは不正Identity、同時取得と二重releaseを拒否するを検証する。
 *
 * @responsibility Windows kernel lockは不正Identity、同時取得と二重releaseを拒否するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows kernel lockは不正Identity、同時取得と二重releaseを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: domain-model Test Source→対象契約
 */
test("Windows kernel lockは不正Identity、同時取得と二重releaseを拒否する", () => {
  assert.equal(acquireRuntimeOwnedCoordinatorStateKernelLock("invalid"), null);
  if (process.platform !== "win32") return;
  const protectionHash = createHash("sha256")
    .update(randomBytes(32))
    .digest("hex");
  const first = acquireRuntimeOwnedCoordinatorStateKernelLock(protectionHash);
  assert.ok(first);
  assert.equal(
    acquireRuntimeOwnedCoordinatorStateKernelLock(protectionHash),
    null,
  );
  assert.equal(first.release(), true);
  assert.equal(first.release(), false);
  const next = acquireRuntimeOwnedCoordinatorStateKernelLock(protectionHash);
  assert.ok(next);
  assert.equal(next.release(), true);
});

/**
 * Windows kernel lockはowner process強制終了後にstale residueなしで再取得できるを検証する。
 *
 * @responsibility Windows kernel lockはowner process強制終了後にstale residueなしで再取得できるの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows kernel lockはowner process強制終了後にstale residueなしで再取得できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: domain-model Test Source→対象契約
 */
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
    acquireRuntimeOwnedCoordinatorStateKernelLock(protectionHash),
    null,
  );
  assert.equal(child.kill(), true);
  await once(child, "exit");
  const recovered =
    acquireRuntimeOwnedCoordinatorStateKernelLock(protectionHash);
  assert.ok(recovered);
  assert.equal(recovered.release(), true);
});
