/**
 * Filesystem Store Root CapabilityのPath境界を検証する。
 *
 * @packageDocumentation
 * @responsibility Root内の相対Pathだけを許可し、Root外・絶対Path・Link親を拒否する。
 * @trace RFD-UT-006
 * @level UT
 * @scope filesystem-store-root、path-authority、link-boundary
 * @boundary Application Store→Filesystem Path。
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Worker } from "node:worker_threads";

import {
  createFilesystemStoreRoot,
  observeFilesystemStoreLockOwnerAbsence,
  recoverFilesystemStoreLock,
  resolveFilesystemStorePath,
  withFilesystemStoreLock,
} from "../../src/filesystem-store-root/index.ts";

/**
 * Root外とLink経由のPathを拒否する。
 * @responsibility Store Root CapabilityがFilesystem Authorityを文字列入力へ拡大しないことを確認する。
 * @trace RFD-UT-006
 * @precondition 実Directory、外部DirectoryおよびRoot内Junctionを用意する。
 * @stimulus 正常相対Path、親移動、絶対PathおよびJunction配下を解決する。
 * @observation 戻りPathと拒否例外を観測する。
 * @oracle 正常PathだけがRoot配下へ解決され、他はすべて拒否される。
 * @cleanup 一時DirectoryとJunctionを削除する。
 * @boundary Filesystem Root Capability→Resolved Store Path。
 */
test("Root外・絶対Path・Link親を拒否する", (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-store-root-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, "root");
  const outside = path.join(base, "outside");
  fs.mkdirSync(root);
  fs.mkdirSync(outside);
  const capability = createFilesystemStoreRoot(root);
  assert.ok(capability);
  assert.equal(
    resolveFilesystemStorePath(capability, "state/value.json"),
    path.join(root, "state", "value.json"),
  );
  assert.throws(() => resolveFilesystemStorePath(capability, "../outside/x"));
  assert.throws(() => resolveFilesystemStorePath(capability, outside));
  const linked = path.join(root, "linked");
  fs.symlinkSync(outside, linked, "junction");
  assert.throws(() =>
    resolveFilesystemStorePath(capability, "linked/value.json"),
  );
  assert.throws(
    () =>
      resolveFilesystemStorePath(
        { root } as Parameters<typeof resolveFilesystemStorePath>[0],
        "state/forged.json",
      ),
    /filesystem_store_root_capability_invalid/,
  );
});

/**
 * 残存Lockをexact Recovery Identityでだけ回復する。
 * @responsibility 異常終了相当の残存Lockを競合や自動清掃へ畳まないことを確認する。
 * @trace RFD-UT-006
 * @precondition 検証済みRoot内に所有者不在のLock Recordを固定する。
 * @stimulus Lock取得、誤Identity観測、Owner不存在観測、exact回復、再取得を順に行う。
 * @observation 理由、Recovery Identity、削除Effectおよび再取得結果を観測する。
 * @oracle exact IdentityとOwner不存在確認が揃った場合だけ回復し、その後一度だけ取得できる。
 * @cleanup 一時Directoryを削除する。
 * @boundary Runtime Recovery Authority→Filesystem Lock。
 */
test("残存Lockをexact Recovery Identityでだけ回復する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-store-lock-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const capability = createFilesystemStoreRoot(root);
  assert.ok(capability);
  const lockPath = resolveFilesystemStorePath(capability, "locks/store.lock");
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(
    lockPath,
    `${JSON.stringify({ recoveryId: "filesystem-store-lock.fixed", ownerPid: 999999 })}\n`,
    "utf8",
  );
  const blocked = withFilesystemStoreLock(
    capability,
    "locks/store.lock",
    () => "unexpected",
  );
  assert.equal(blocked.acquired, false);
  if (blocked.acquired) return;
  assert.equal(blocked.reason, "filesystem_store_lock_recovery_required");
  if (blocked.reason !== "filesystem_store_lock_recovery_required") return;
  assert.equal(blocked.recoveryId, "filesystem-store-lock.fixed");
  assert.equal(
    observeFilesystemStoreLockOwnerAbsence(
      capability,
      "locks/store.lock",
      "filesystem-store-lock.other",
    ).status,
    "blocked",
  );
  const observation = observeFilesystemStoreLockOwnerAbsence(
    capability,
    "locks/store.lock",
    "filesystem-store-lock.fixed",
  );
  assert.equal(observation.status, "confirmed");
  if (observation.status !== "confirmed") return;
  assert.equal(
    recoverFilesystemStoreLock(
      capability,
      "locks/store.lock",
      observation.proof,
    ).status,
    "completed",
  );
  assert.deepEqual(
    withFilesystemStoreLock(capability, "locks/store.lock", () => "ok"),
    { acquired: true, cleanupConfirmed: true, value: "ok" },
  );
});

/**
 * Kernel Lock解放不明時もexact Recovery Identityを耐久保持する。
 * @responsibility 回復途中のEndpoint解放不明を完了へ畳まず、同じIdentityで再入場できることを確認する。
 * @trace RFD-UT-006
 * @precondition 所有者不在のLock Recordを用意し、一回だけWorkerのrelease messageを抑止する。
 * @stimulus exact回復、後続Owner取得、同じIdentityでの再観測・再回復を順に実行する。
 * @observation cleanup unknown結果、Recovery Obligation Record、後続Effectおよび最終不存在を観測する。
 * @oracle 解放不明ではexact ID付き義務が残り後続Effect 0、同じIDの再回復後だけ取得可能となる。
 * @cleanup Worker prototypeを復元し、一時Directoryを削除する。
 * @boundary Recovery Authority→Worker解放不明→耐久Recovery Obligation→再入場。
 */
test("Kernel Lock解放不明でもexact回復義務を耐久保持する", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-store-cleanup-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const capability = createFilesystemStoreRoot(root);
  assert.ok(capability);
  const lockPath = resolveFilesystemStorePath(capability, "locks/store.lock");
  const obligationPath = `${lockPath}.recovery-obligation`;
  const recoveryId = "filesystem-store-lock.cleanup-unknown";
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(
    lockPath,
    `${JSON.stringify({ recoveryId, ownerPid: 999999 })}\n`,
    "utf8",
  );
  const observation = observeFilesystemStoreLockOwnerAbsence(
    capability,
    "locks/store.lock",
    recoveryId,
  );
  assert.equal(observation.status, "confirmed");
  if (observation.status !== "confirmed") return;

  const originalPostMessage = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function suppressRelease(
    this: Worker,
    value: unknown,
  ): void {
    if (value !== "release") originalPostMessage.call(this, value);
  } as Worker["postMessage"];
  let interruptedRecovery: ReturnType<typeof recoverFilesystemStoreLock>;
  try {
    interruptedRecovery = recoverFilesystemStoreLock(
      capability,
      "locks/store.lock",
      observation.proof,
    );
  } finally {
    Worker.prototype.postMessage = originalPostMessage;
  }
  assert.deepEqual(interruptedRecovery, {
    status: "blocked",
    reason: "filesystem_store_lock_recovery_cleanup_unknown",
    recoveryId,
  });
  assert.equal(fs.existsSync(lockPath), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(obligationPath, "utf8")), {
    recoveryId,
    ownerPid: 999999,
  });

  const deadline = Date.now() + 5_000;
  let blocked: ReturnType<typeof withFilesystemStoreLock<string>>;
  while (true) {
    blocked = withFilesystemStoreLock(
      capability,
      "locks/store.lock",
      () => "unexpected",
    );
    if (
      !blocked.acquired &&
      blocked.reason === "filesystem_store_lock_recovery_required"
    )
      break;
    if (Date.now() >= deadline)
      throw new Error("cleanup obligation did not become observable");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(blocked.recoveryId, recoveryId);
  const resumedObservation = observeFilesystemStoreLockOwnerAbsence(
    capability,
    "locks/store.lock",
    recoveryId,
  );
  assert.equal(resumedObservation.status, "confirmed");
  if (resumedObservation.status !== "confirmed") return;
  assert.deepEqual(
    recoverFilesystemStoreLock(
      capability,
      "locks/store.lock",
      resumedObservation.proof,
    ),
    { status: "completed", reason: "filesystem_store_lock_recovered" },
  );
  assert.equal(fs.existsSync(obligationPath), false);
  assert.deepEqual(
    withFilesystemStoreLock(capability, "locks/store.lock", () => "ok"),
    { acquired: true, cleanupConfirmed: true, value: "ok" },
  );
});

/**
 * 通常Operation完了後のKernel解放不明を二重Effectへ変えない。
 * @responsibility Effect済み・cleanup不明・exact Recovery Identityを判別可能な結果と耐久状態へ保持する。
 * @trace RFD-UT-006
 * @precondition 検証済みRootを用意し、一回だけWorkerのrelease messageを抑止する。
 * @stimulus Effectを伴うOperation、後続取得、同じIDのcleanup再入場、再取得を順に行う。
 * @observation Operation回数、構造化結果、Lock／Obligation Record、後続Effectおよび最終不存在を観測する。
 * @oracle Operationは一回だけ完了し、cleanup解消前は後続Effect 0、同じIDのcleanup後だけ新取得できる。
 * @cleanup Worker prototypeを復元し、一時Directoryを削除する。
 * @boundary Store Operation→Worker解放不明→耐久Recovery Obligation→cleanup再入場。
 */
test("通常Operation後の解放不明を同じIDでcleanup再入場する", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-store-effect-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const capability = createFilesystemStoreRoot(root);
  assert.ok(capability);
  const lockPath = resolveFilesystemStorePath(capability, "locks/store.lock");
  const obligationPath = `${lockPath}.recovery-obligation`;
  const effectPath = path.join(root, "effect");
  let operationCount = 0;
  const originalPostMessage = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function suppressRelease(
    this: Worker,
    value: unknown,
  ): void {
    if (value !== "release") originalPostMessage.call(this, value);
  } as Worker["postMessage"];
  let interrupted: ReturnType<typeof withFilesystemStoreLock<string>>;
  try {
    interrupted = withFilesystemStoreLock(
      capability,
      "locks/store.lock",
      () => {
        operationCount += 1;
        fs.writeFileSync(effectPath, "issued\n", { flag: "wx" });
        return "effect-issued";
      },
    );
  } finally {
    Worker.prototype.postMessage = originalPostMessage;
  }
  assert.equal(interrupted.acquired, true);
  if (!interrupted.acquired || interrupted.cleanupConfirmed) return;
  assert.equal(interrupted.operationCompleted, true);
  if (!interrupted.operationCompleted) return;
  assert.equal(
    interrupted.reason,
    "filesystem_store_lock_operation_completed_cleanup_unknown",
  );
  assert.equal(interrupted.value, "effect-issued");
  assert.equal(operationCount, 1);
  assert.equal(fs.readFileSync(effectPath, "utf8"), "issued\n");
  assert.equal(fs.existsSync(lockPath), true);
  assert.equal(fs.existsSync(obligationPath), true);

  const deadline = Date.now() + 5_000;
  let blocked: ReturnType<typeof withFilesystemStoreLock<string>>;
  while (true) {
    blocked = withFilesystemStoreLock(capability, "locks/store.lock", () => {
      operationCount += 1;
      return "unexpected";
    });
    if (
      !blocked.acquired &&
      blocked.reason === "filesystem_store_lock_recovery_required"
    )
      break;
    if (Date.now() >= deadline)
      throw new Error("operation cleanup obligation did not become observable");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(blocked.recoveryId, interrupted.recoveryId);
  assert.equal(operationCount, 1);
  const observation = observeFilesystemStoreLockOwnerAbsence(
    capability,
    "locks/store.lock",
    interrupted.recoveryId,
  );
  assert.equal(observation.status, "confirmed");
  if (observation.status !== "confirmed") return;
  assert.deepEqual(
    recoverFilesystemStoreLock(
      capability,
      "locks/store.lock",
      observation.proof,
    ),
    { status: "completed", reason: "filesystem_store_lock_recovered" },
  );
  assert.equal(fs.existsSync(lockPath), false);
  assert.equal(fs.existsSync(obligationPath), false);
  assert.deepEqual(
    withFilesystemStoreLock(capability, "locks/store.lock", () => "next"),
    { acquired: true, cleanupConfirmed: true, value: "next" },
  );
  assert.equal(operationCount, 1);
});

/**
 * exact Recovery Identity確定後の観測者cleanup不明でもIdentityを保持する。
 * @responsibility 有効なLock／Obligation Recordから確定したRecovery IDを後続の解放不明で失わないことを確認する。
 * @trace RFD-UT-006
 * @precondition 有効なLock RecordまたはRecovery Obligationと、一回だけrelease通知を抑止するWorker境界を用意する。
 * @stimulus 各Recordを持つStoreへLock取得を要求する。
 * @observation 公開理由、Recovery IDおよびOperation Effectを観測する。
 * @oracle 両経路とも同じexact ID付きrecovery_requiredとなり、Operation Effectは0である。
 * @cleanup Worker prototypeを復元し、一時Directoryを削除する。
 * @boundary 耐久Recovery Record→観測者Kernel解放不明→公開Recovery結果。
 */
test("確定済みRecovery IDを観測者cleanup不明でも保持する", (t) => {
  const originalPostMessage = Worker.prototype.postMessage;
  t.after(() => {
    Worker.prototype.postMessage = originalPostMessage;
  });
  for (const recordKind of ["lock", "obligation"] as const) {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), `crdd-store-observer-${recordKind}-`),
    );
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const capability = createFilesystemStoreRoot(root);
    assert.ok(capability);
    const lockPath = resolveFilesystemStorePath(capability, "locks/store.lock");
    const recoveryId = `filesystem-store-lock.observer-${recordKind}`;
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(
      recordKind === "lock" ? lockPath : `${lockPath}.recovery-obligation`,
      `${JSON.stringify({ recoveryId, ownerPid: 999999 })}\n`,
      "utf8",
    );
    Worker.prototype.postMessage = function suppressRelease(
      this: Worker,
      value: unknown,
    ): void {
      if (value !== "release") originalPostMessage.call(this, value);
    } as Worker["postMessage"];
    let operationCount = 0;
    const result = withFilesystemStoreLock(
      capability,
      "locks/store.lock",
      () => {
        operationCount += 1;
        return "unexpected";
      },
    );
    Worker.prototype.postMessage = originalPostMessage;
    assert.deepEqual(result, {
      acquired: false,
      reason: "filesystem_store_lock_recovery_required",
      recoveryId,
    });
    assert.equal(operationCount, 0);
  }
});

/**
 * cleanup再入場AuthorityをRootとLock Pathへ結合する。
 * @responsibility 同じRecovery IDの複製だけで別StoreのOwner不存在Proofを発行しないことを確認する。
 * @trace RFD-UT-006
 * @precondition Root Aでcurrent Processのcleanup不明を発生させ、そのRecordをRoot Bへ複製する。
 * @stimulus Root Bで同じRecovery IDのOwner不存在を観測する。
 * @observation Proof発行状態と拒否理由を観測する。
 * @oracle Root Bはowner_presentで停止し、Root A用のProcess-local Authorityを流用しない。
 * @cleanup Worker prototypeを復元し、両一時Directoryを削除する。
 * @boundary Root A cleanup Authority→Root B Filesystem Store境界。
 */
test("cleanup再入場Authorityを別Rootへ流用しない", (t) => {
  const rootA = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-store-scope-a-"));
  const rootB = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-store-scope-b-"));
  t.after(() => fs.rmSync(rootA, { recursive: true, force: true }));
  t.after(() => fs.rmSync(rootB, { recursive: true, force: true }));
  const capabilityA = createFilesystemStoreRoot(rootA);
  const capabilityB = createFilesystemStoreRoot(rootB);
  assert.ok(capabilityA);
  assert.ok(capabilityB);
  const lockPathA = resolveFilesystemStorePath(capabilityA, "locks/store.lock");
  const lockPathB = resolveFilesystemStorePath(capabilityB, "locks/store.lock");
  const originalPostMessage = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function suppressRelease(
    this: Worker,
    value: unknown,
  ): void {
    if (value !== "release") originalPostMessage.call(this, value);
  } as Worker["postMessage"];
  let interrupted: ReturnType<typeof withFilesystemStoreLock<string>>;
  try {
    interrupted = withFilesystemStoreLock(
      capabilityA,
      "locks/store.lock",
      () => "effect-issued",
    );
  } finally {
    Worker.prototype.postMessage = originalPostMessage;
  }
  assert.equal(interrupted.acquired, true);
  if (!interrupted.acquired || interrupted.cleanupConfirmed) return;
  fs.mkdirSync(path.dirname(lockPathB), { recursive: true });
  fs.copyFileSync(lockPathA, lockPathB);
  fs.copyFileSync(
    `${lockPathA}.recovery-obligation`,
    `${lockPathB}.recovery-obligation`,
  );
  assert.deepEqual(
    observeFilesystemStoreLockOwnerAbsence(
      capabilityB,
      "locks/store.lock",
      interrupted.recoveryId,
    ),
    {
      status: "blocked",
      reason: "filesystem_store_lock_owner_present",
    },
  );
});

/**
 * 旧Ownerが別世代のLockを削除しない。
 * @responsibility 解放時のIdentity照合により、差し替わったLock世代の所有権を侵害しないことを確認する。
 * @trace RFD-UT-006
 * @precondition 検証済みRootと一つのLock Pathを用意する。
 * @stimulus Lock保持中にPathを別Recovery IdentityのRecordへ置換して操作を完了する。
 * @observation 操作完了後のLock Recordを再読する。
 * @oracle 旧Ownerのfinallyは別世代Recordを削除しない。
 * @cleanup 一時Directoryを削除する。
 * @boundary Store Lock Owner→Filesystem Lock世代。
 */
test("旧Ownerは差し替わった別世代Lockを削除しない", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-store-generation-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const capability = createFilesystemStoreRoot(root);
  assert.ok(capability);
  const lockPath = resolveFilesystemStorePath(capability, "locks/store.lock");
  const replacement = {
    recoveryId: "filesystem-store-lock.replacement",
    ownerPid: process.pid,
  };
  const result = withFilesystemStoreLock(capability, "locks/store.lock", () => {
    fs.rmSync(lockPath);
    fs.writeFileSync(lockPath, `${JSON.stringify(replacement)}\n`, "utf8");
    return "completed";
  });
  assert.equal(result.acquired, true);
  if (!result.acquired || result.cleanupConfirmed) return;
  assert.equal(result.operationCompleted, true);
  assert.equal(
    result.reason,
    "filesystem_store_lock_operation_completed_cleanup_unknown",
  );
  if (result.operationCompleted) assert.equal(result.value, "completed");
  assert.match(result.recoveryId, /^filesystem-store-lock\./u);
  assert.deepEqual(JSON.parse(fs.readFileSync(lockPath, "utf8")), replacement);
});

/**
 * 稼働中OwnerのLockを回復せず、Process終了後だけexact世代を回復する。
 * @responsibility Owner不存在Proofを別Processの実状態からだけ発行することを確認する。
 * @trace RFD-UT-006
 * @precondition 子Processが検証済みRoot内のLockを保持する。
 * @stimulus 稼働中観測、子Process終了、終了後観測、exact回復を順に実行する。
 * @observation Owner状態、Proof発行、削除Effectおよび再取得結果を観測する。
 * @oracle 稼働中はEffect 0、終了後の同じ世代だけ回復完了となる。
 * @cleanup 子Processと一時Directoryを必ず終了・削除する。
 * @boundary 別Node Process→OS Process観測→Filesystem Lock Recovery。
 */
test("別Processの終了確認後だけ残存Lockを回復する", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-store-process-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const readyFile = path.join(root, "ready");
  const worker = path.resolve("tests/fixtures/filesystem-store-lock-owner.ts");
  const child = spawn(process.execPath, [worker, root, readyFile], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });
  const deadline = Date.now() + 5_000;
  while (!fs.existsSync(readyFile)) {
    if (child.exitCode !== null)
      throw new Error(`lock owner exited before ready: ${child.exitCode}`);
    if (Date.now() >= deadline) throw new Error("lock owner ready timeout");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const capability = createFilesystemStoreRoot(root);
  assert.ok(capability);
  const blocked = withFilesystemStoreLock(
    capability,
    "locks/store.lock",
    () => "unexpected",
  );
  assert.equal(blocked.acquired, false);
  if (blocked.acquired) return;
  assert.equal(blocked.reason, "filesystem_store_lock_unavailable");
  assert.equal(
    observeFilesystemStoreLockOwnerAbsence(
      capability,
      "locks/store.lock",
      "filesystem-store-lock.unavailable-owner",
    ).status,
    "blocked",
  );
  child.kill();
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => resolve());
  });
  const stale = withFilesystemStoreLock(
    capability,
    "locks/store.lock",
    () => "unexpected",
  );
  assert.equal(stale.acquired, false);
  if (
    stale.acquired ||
    stale.reason !== "filesystem_store_lock_recovery_required"
  )
    return;
  const observation = observeFilesystemStoreLockOwnerAbsence(
    capability,
    "locks/store.lock",
    stale.recoveryId,
  );
  assert.equal(observation.status, "confirmed");
  if (observation.status !== "confirmed") return;
  assert.equal(
    recoverFilesystemStoreLock(
      capability,
      "locks/store.lock",
      observation.proof,
    ).status,
    "completed",
  );
  assert.deepEqual(
    withFilesystemStoreLock(capability, "locks/store.lock", () => "ok"),
    { acquired: true, cleanupConfirmed: true, value: "ok" },
  );
});

/**
 * 同じLock targetのPath aliasを一つのKernel Identityへ結合する。
 * @responsibility dot segmentを含む別表記から同じFilesystem Lockの排他境界を迂回できないことを確認する。
 * @trace RFD-UT-006
 * @precondition 子Processがcanonical表記でLockを保持する。
 * @stimulus 親Processがdot segmentを含むalias表記で同じLockを取得する。
 * @observation 競合理由と親Operation Effectを観測する。
 * @oracle alias表記もunavailableとなり、親Operation Effectは0である。
 * @cleanup 子Processを終了し、一時Directoryを削除する。
 * @boundary 別Node Process→Path正規化→OS Kernel Lock。
 */
test("Path aliasを別ProcessのKernel Lock迂回に使えない", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-store-alias-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const readyFile = path.join(root, "ready");
  const worker = path.resolve("tests/fixtures/filesystem-store-lock-owner.ts");
  const child = spawn(process.execPath, [worker, root, readyFile], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });
  const deadline = Date.now() + 5_000;
  while (!fs.existsSync(readyFile)) {
    if (child.exitCode !== null)
      throw new Error(`lock owner exited before ready: ${child.exitCode}`);
    if (Date.now() >= deadline) throw new Error("lock owner ready timeout");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const capability = createFilesystemStoreRoot(root);
  assert.ok(capability);
  let operationCount = 0;
  const blocked = withFilesystemStoreLock(
    capability,
    "locks/./store.lock",
    () => {
      operationCount += 1;
      return "unexpected";
    },
  );
  assert.deepEqual(blocked, {
    acquired: false,
    reason: "filesystem_store_lock_unavailable",
  });
  assert.equal(operationCount, 0);
  child.kill();
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => resolve());
  });
});

/**
 * 不完全なLock RecordをRecovery Authorityへ昇格しない。
 * @responsibility 空・部分・破損Recordをexact Recovery Identity付き義務へ誤分類しないことを確認する。
 * @trace RFD-UT-006
 * @precondition Kernel Lockの所有者がいないRootへ不完全Recordを配置する。
 * @stimulus 各Recordに対してStore Lock取得を試みる。
 * @observation 拒否理由とOperation Effectを観測する。
 * @oracle 全件がobservation_unknownとなり、Operationは実行されずRecovery IDも発行されない。
 * @cleanup 各Recordと一時Directoryを削除する。
 * @boundary 不完全Filesystem Record→Store Lock公開結果。
 */
test("不完全なLock RecordはRecovery Identityを発行しない", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-store-invalid-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const capability = createFilesystemStoreRoot(root);
  assert.ok(capability);
  const lockPath = resolveFilesystemStorePath(capability, "locks/store.lock");
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  for (const content of [
    "",
    '{"recoveryId":"filesystem-store-lock.partial"}\n',
    "{invalid\n",
  ]) {
    fs.writeFileSync(lockPath, content, "utf8");
    let effectIssued = false;
    const result: Readonly<{
      acquired: boolean;
      reason?: string;
      recoveryId?: string;
      value?: boolean;
    }> = withFilesystemStoreLock<boolean>(
      capability,
      "locks/store.lock",
      () => {
        effectIssued = true;
        return true;
      },
    );
    assert.deepEqual(result, {
      acquired: false,
      reason: "filesystem_store_lock_observation_unknown",
    });
    assert.equal(effectIssued, false);
    fs.rmSync(lockPath);
  }
});

/**
 * 二回復者と後続Ownerの競合で新世代Lockを削除しない。
 * @responsibility Recoveryと次世代取得を同じKernel排他へ閉じることを別Processで反証する。
 * @trace RFD-UT-006
 * @precondition 所有者不在のexact Lock Recordと三つの待機Processを用意する。
 * @stimulus 二回復者と後続Ownerを同じBarrierから同時に開始する。
 * @observation 回復結果、後続OwnerのLock Recordおよび全Process終了を観測する。
 * @oracle 回復完了は最大一件で、後続Owner保持中の新世代Recordが旧Recoveryで削除されない。
 * @cleanup 後続Ownerを解放し、全Processと一時Directoryを回収する。
 * @boundary 複数Node Process→OS Kernel Lock→Filesystem Lock世代。
 */
test("二回復者と後続OwnerをKernel Lockで直列化する", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-store-race-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const capability = createFilesystemStoreRoot(root);
  assert.ok(capability);
  const lockPath = resolveFilesystemStorePath(capability, "locks/store.lock");
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const staleId = "filesystem-store-lock.race-stale";
  fs.writeFileSync(
    lockPath,
    `${JSON.stringify({ recoveryId: staleId, ownerPid: 999999 })}\n`,
    "utf8",
  );
  const fixture = path.resolve(
    "tests/fixtures/filesystem-store-lock-contender.ts",
  );
  const goFile = path.join(root, "go");
  const releaseFile = path.join(root, "release");
  const childProcesses = [
    ["recover", "recovery-a"],
    ["recover", "recovery-b"],
    ["owner", "owner"],
  ].map(([mode, name]) => {
    const ready = path.join(root, `${name}.ready`);
    const result = path.join(root, `${name}.result`);
    const child = spawn(
      process.execPath,
      [
        fixture,
        mode as string,
        root,
        staleId,
        ready,
        goFile,
        result,
        releaseFile,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    return { child, ready, result };
  });
  t.after(() => {
    for (const { child } of childProcesses)
      if (child.exitCode === null) child.kill();
  });
  const deadline = Date.now() + 10_000;
  while (childProcesses.some(({ ready }) => !fs.existsSync(ready))) {
    if (Date.now() >= deadline) throw new Error("contender ready timeout");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  fs.writeFileSync(goFile, "go\n", { flag: "wx" });
  while (!fs.existsSync(childProcesses[2]?.result ?? "")) {
    if (Date.now() >= deadline) throw new Error("next owner acquire timeout");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const nextRecord = JSON.parse(fs.readFileSync(lockPath, "utf8")) as {
    recoveryId: string;
  };
  assert.notEqual(nextRecord.recoveryId, staleId);
  for (const contender of childProcesses.slice(0, 2)) {
    while (!fs.existsSync(contender.result)) {
      if (Date.now() >= deadline) throw new Error("recoverer result timeout");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  assert.equal(
    childProcesses
      .slice(0, 2)
      .map(({ result }) => JSON.parse(fs.readFileSync(result, "utf8")))
      .filter((result) => result.status === "completed").length,
    1,
  );
  assert.equal(
    (JSON.parse(fs.readFileSync(lockPath, "utf8")) as { recoveryId: string })
      .recoveryId,
    nextRecord.recoveryId,
  );
  fs.writeFileSync(releaseFile, "release\n", { flag: "wx" });
  await Promise.all(
    childProcesses.map(
      ({ child }) =>
        new Promise<void>((resolve, reject) => {
          if (child.exitCode !== null) {
            if (child.exitCode === 0) resolve();
            else reject(new Error(`contender exit ${child.exitCode}`));
            return;
          }
          child.once("error", reject);
          child.once("exit", (code) =>
            code === 0
              ? resolve()
              : reject(new Error(`contender exit ${code}`)),
          );
        }),
    ),
  );
});
