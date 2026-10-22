/**
 * coordinator:integration:kernel-lockの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:kernel-lockが所有する検証責務を実行する。
 * @trace ERB-IT-003
 * @level IT
 * @scope state、host、kernel、lock
 * @boundary ERB-IT-003=Direct Boundary: State／Host Owner→Kernel Lock
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  acquireRuntimeOwnedCoordinatorStateKernelLock,
  acquireRuntimeOwnedDockerRuntimeStateKernelLock,
  acquireRuntimeOwnedHostOperationKernelLock,
  acquireRuntimeOwnedHostOperationSupervisorLock,
  acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome,
  acquireRuntimeOwnedLogicalProviderHomeKernelLock,
  acquireRuntimeOwnedProjectStateKernelLock,
  describeKernelLockContract,
  prepareHostOperationSupervisorLockRequest,
} from "../../src/execution/kernel-lock.ts";

const FAST_SUPERVISOR_TIMING = Object.freeze({
  acquireTimeoutMs: 10,
  releaseTimeoutMs: 10,
});

/**
 * Coordinator Snapshotの短期排他をWindows実資源で確認する。
 * @responsibility 同じRootの競合、別Root・別Ownerとの独立、解放後の再取得を確認する。
 * @trace ERB-IT-003
 * @precondition Windowsの名前付きPipeを使用しDockerとProviderは使用しない。
 * @stimulus 同じRootと異なるRootでLockを取得し解放する。
 * @observation 取得結果、assertLive、解放と再取得を観測する。
 * @oracle 同じRootだけが競合し解放後は再取得できる。
 * @cleanup 取得した全Lockをfinallyで解放する。
 * @boundary ERB-IT-003=Direct Boundary: Coordinator Snapshot Owner→Windows排他資源。
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
  const project = acquireRuntimeOwnedProjectStateKernelLock(hash);
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
 * restart kernel domains retain live ownership across await and invalidate on releaseを検証する。
 *
 * @responsibility restart kernel domains retain live ownership across await and invalidate on releaseの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus restart kernel domains retain live ownership across await and invalidate on releaseの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("restart kernel domains retain live ownership across await and invalidate on release", {
  skip: process.platform !== "win32",
}, async () => {
  const hash = randomBytes(32).toString("hex");
  for (const acquire of [
    () => acquireRuntimeOwnedDockerRuntimeStateKernelLock(hash),
    () => acquireRuntimeOwnedLogicalProviderHomeKernelLock(hash),
    () =>
      acquireRuntimeOwnedHostOperationKernelLock(
        "crdd-coordinator-doctor-restart-fixture",
        "a".repeat(32),
      ),
  ]) {
    const lock = acquire();
    assert.ok(lock);
    try {
      assert.equal(lock.assertLive(), true);
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(lock.assertLive(), true);
    } finally {
      assert.equal(lock.release(), true);
    }
    assert.equal(lock.assertLive(), false);
  }
});

/**
 * acquireInteractiveConsoleLockForConcurrentTestRunのTest準備責務を実行する。
 *
 * @responsibility acquireInteractiveConsoleLockForConcurrentTestRunがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus acquireInteractiveConsoleLockForConcurrentTestRunを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
async function acquireInteractiveConsoleLockForConcurrentTestRun() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const outcome =
      await acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
    if (outcome.status !== "unavailable") return outcome;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
}

/**
 * 固定Supervisor: 不正root・nonce・待機値は技術要求を生成せず拒否するを検証する。
 *
 * @responsibility 固定Supervisor: 不正root・nonce・待機値は技術要求を生成せず拒否するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定Supervisor: 不正root・nonce・待機値は技術要求を生成せず拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("固定Supervisor: 不正root・nonce・待機値は技術要求を生成せず拒否する", {
  skip: process.platform !== "win32",
}, async () => {
  const rootName = "crdd-coordinator-doctor-VALID1";
  const nonce = "a".repeat(32);
  const invalidInputs = [
    { rootName: null, nonce, timing: FAST_SUPERVISOR_TIMING },
    { rootName: 1, nonce, timing: FAST_SUPERVISOR_TIMING },
    {
      rootName: "crdd-coordinator-doctor-12345",
      nonce,
      timing: FAST_SUPERVISOR_TIMING,
    },
    {
      rootName: `crdd-coordinator-doctor-${"a".repeat(65)}`,
      nonce,
      timing: FAST_SUPERVISOR_TIMING,
    },
    {
      rootName: "../crdd-coordinator-doctor-VALID1",
      nonce,
      timing: FAST_SUPERVISOR_TIMING,
    },
    { rootName, nonce: null, timing: FAST_SUPERVISOR_TIMING },
    { rootName, nonce: "a".repeat(31), timing: FAST_SUPERVISOR_TIMING },
    { rootName, nonce: "a".repeat(49), timing: FAST_SUPERVISOR_TIMING },
    { rootName, nonce: "A".repeat(32), timing: FAST_SUPERVISOR_TIMING },
    ...[0, 1001, 1.5, Number.NaN].map((acquireTimeoutMs) => ({
      rootName,
      nonce,
      timing: { acquireTimeoutMs, releaseTimeoutMs: 10 },
    })),
    ...[0, 5001, 1.5, Number.POSITIVE_INFINITY].map((releaseTimeoutMs) => ({
      rootName,
      nonce,
      timing: { acquireTimeoutMs: 10, releaseTimeoutMs },
    })),
  ];
  for (const input of invalidInputs) {
    assert.deepEqual(
      prepareHostOperationSupervisorLockRequest(
        input.rootName,
        input.nonce,
        input.timing,
      ),
      null,
    );
  }
  for (const [
    suffixLength,
    nonceLength,
    acquireTimeoutMs,
    releaseTimeoutMs,
  ] of [
    [6, 32, 1, 1],
    [64, 48, 1000, 5000],
  ] as const) {
    assert.ok(
      prepareHostOperationSupervisorLockRequest(
        `crdd-coordinator-doctor-${"a".repeat(suffixLength)}`,
        "a".repeat(nonceLength),
        { acquireTimeoutMs, releaseTimeoutMs },
      ),
    );
  }
});

/**
 * 追加境界: 公開lock入口は不正bindingを非取得にするを検証する。
 *
 * @responsibility 追加境界: 公開lock入口は不正bindingを非取得にするの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 追加境界: 公開lock入口は不正bindingを非取得にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("追加境界: 公開lock入口は不正bindingを非取得にする", () => {
  for (const invalid of [null, 42, "", "a".repeat(63), "A".repeat(64)]) {
    assert.equal(
      acquireRuntimeOwnedLogicalProviderHomeKernelLock(invalid),
      null,
    );
    assert.equal(
      acquireRuntimeOwnedDockerRuntimeStateKernelLock(invalid),
      null,
    );
    assert.equal(
      acquireRuntimeOwnedHostOperationKernelLock(invalid, "a".repeat(32)),
      null,
    );
  }
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
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
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
 * Host Operation lock Supervisorは往復、競合とexit確認済みreleaseを固定するを検証する。
 *
 * @responsibility Host Operation lock Supervisorは往復、競合とexit確認済みreleaseを固定するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Operation lock Supervisorは往復、競合とexit確認済みreleaseを固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("Host Operation lock Supervisorは往復、競合とexit確認済みreleaseを固定する", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const rootName = `crdd-coordinator-doctor-${randomBytes(6).toString("hex")}`;
  const nonce = randomBytes(16).toString("hex");
  const outcome = await acquireRuntimeOwnedHostOperationSupervisorLock(
    rootName,
    nonce,
  );
  assert.equal(outcome.status, "acquired");
  assert.ok(outcome.lock);
  assert.equal(await outcome.lock.confirmReady(), "ready");
  assert.equal(
    (await acquireRuntimeOwnedHostOperationSupervisorLock(rootName, nonce))
      .status,
    "unavailable",
  );
  assert.equal(await outcome.lock.release(), "released");
  assert.equal(await outcome.lock.confirmReady(), "cleanup_confirmed_failure");
  const next = await acquireRuntimeOwnedHostOperationSupervisorLock(
    rootName,
    nonce,
  );
  assert.equal(next.status, "acquired");
  assert.ok(next.lock);
  assert.equal(await next.lock.release(), "released");
});

/**
 * Windows対話Console lockは同時承認readerを一つへ限定するを検証する。
 *
 * @responsibility Windows対話Console lockは同時承認readerを一つへ限定するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows対話Console lockは同時承認readerを一つへ限定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("Windows対話Console lockは同時承認readerを一つへ限定する", async () => {
  if (process.platform !== "win32") return;
  const first = await acquireInteractiveConsoleLockForConcurrentTestRun();
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

/**
 * Windows対話Console lockは独立Processをrelease完了まで存続させるを検証する。
 *
 * @responsibility Windows対話Console lockは独立Processをrelease完了まで存続させるの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows対話Console lockは独立Processをrelease完了まで存続させるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("Windows対話Console lockは独立Processをrelease完了まで存続させる", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const fixture = fileURLToPath(
    new URL(
      "../fixtures/interactive-console-lock-liveness.ts",
      import.meta.url,
    ),
  );
  const child = spawn(process.execPath, [fixture], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const stdoutItems: Buffer[] = [];
  const stderrItems: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) =>
    stdoutItems.push(Buffer.from(chunk)),
  );
  child.stderr.on("data", (chunk: Buffer) =>
    stderrItems.push(Buffer.from(chunk)),
  );
  const [code, signal] = (await once(child, "exit")) as [
    number | null,
    NodeJS.Signals | null,
  ];
  assert.equal(signal, null);
  assert.equal(code, 0, Buffer.concat(stderrItems).toString("utf8"));
  assert.equal(Buffer.concat(stdoutItems).toString("utf8"), "LOCK_RELEASED\n");
});

/**
 * 対話Console専用lockの非同期cleanup契約は共通同期lockの意味を変更しないを検証する。
 *
 * @responsibility 対話Console専用lockの非同期cleanup契約は共通同期lockの意味を変更しないの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 対話Console専用lockの非同期cleanup契約は共通同期lockの意味を変更しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("対話Console専用lockの非同期cleanup契約は共通同期lockの意味を変更しない", () => {
  const contract = describeKernelLockContract();
  assert.equal(contract.acquireTimeoutMs, 5_000);
  assert.equal(contract.hostSupervisorAcquireTimeoutMs, 1_000);
  assert.equal(contract.releaseTimeoutMs, 5_000);
  assert.equal(contract.interactiveConsoleCleanupTimeoutMs, 1_000);
  assert.equal(contract.hostSupervisorReleaseTimeoutMs, 1_000);
  assert.equal(
    contract.interactiveConsoleLock,
    "dedicated_async_acquire_and_release_with_state_and_worker_exit_confirmation",
  );
  assert.deepEqual(contract.interactiveConsoleOutcomes, [
    "acquired",
    "unavailable",
    "cleanup_unknown_process_restart_required",
  ]);
  assert.equal(
    contract.interactiveConsoleWorkerKeepsProcessAliveUntilRelease,
    true,
  );
  assert.equal(contract.commonSynchronousLockMeaningChanged, false);
  assert.equal(
    contract.hostOperationCrossBoundaryReadiness,
    "dedicated_supervisor_process_round_trip_and_exit_confirmed_release_before_console_or_child_process",
  );
  assert.deepEqual(contract.hostOperationSupervisorOutcomes, [
    "acquired",
    "unavailable",
    "cleanup_confirmed_failure",
    "cleanup_unknown_process_restart_required",
  ]);
});

/**
 * Host Operation owner lockはprocess世代をまたぐ同時取得を拒否し強制終了後に回復するを検証する。
 *
 * @responsibility Host Operation owner lockはprocess世代をまたぐ同時取得を拒否し強制終了後に回復するの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Operation owner lockはprocess世代をまたぐ同時取得を拒否し強制終了後に回復するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * Host Operation Supervisorは親process強制終了後にlockをkernelに残さないを検証する。
 *
 * @responsibility Host Operation Supervisorは親process強制終了後にlockをkernelに残さないの合否判定を所有する。
 * @trace ERB-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Operation Supervisorは親process強制終了後にlockをkernelに残さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("Host Operation Supervisorは親process強制終了後にlockをkernelに残さない", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows Local Personal contract");
    return;
  }
  const rootName = "crdd-coordinator-doctor-SUP123";
  const nonce = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const child = spawn(
    process.execPath,
    [fileURLToPath(ownerFixture), "host-supervisor", rootName, nonce],
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
    (await acquireRuntimeOwnedHostOperationSupervisorLock(rootName, nonce))
      .status,
    "unavailable",
  );
  assert.equal(child.kill(), true);
  await once(child, "exit");
  const recovered = await acquireRuntimeOwnedHostOperationSupervisorLock(
    rootName,
    nonce,
  );
  assert.equal(recovered.status, "acquired");
  assert.ok(recovered.lock);
  assert.equal(await recovered.lock.release(), "released");
});

const ownerFixture = new URL(
  "../fixtures/kernel-lock-owner.ts",
  import.meta.url,
);

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
 * @boundary ERB-IT-003=Direct Boundary: coordinator Test Source→対象契約
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
