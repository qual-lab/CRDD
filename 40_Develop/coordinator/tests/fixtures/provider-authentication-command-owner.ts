/**
 * 実認証通知の保存後、有限Process待機中のOwner喪失を別Processで再現する。
 * @responsibility 元in-flightと回復参照を保ち、喪失後の記録・次Effectを拒否する。
 * @trace ERB-IT-017
 * @level IT
 * @scope 実記録・Kernel Lock、有限CLI／Process。実Docker・AIは使わない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import readline from "node:readline";
import { mock } from "node:test";
import {
  createAuthenticationFixture,
  prepareAuthenticationProjection,
} from "../support/authentication.ts";
import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "../../src/execution/kernel-lock.ts";
import {
  authenticateProvider,
  beginProviderAuthenticationRecovery,
  createProviderAuthenticationRecoveryRecord,
  readProviderAuthenticationResources,
  recordProviderAuthenticationResource,
  setProviderAuthenticationRecoveryCommandState,
  settleProviderAuthenticationRecovery,
} from "../../src/execution/authority.ts";

const [hash, home, token] = process.argv.slice(2);
if (!hash || !home || !token) process.exit(70);
const projection = prepareAuthenticationProjection(
  "claude",
  "login",
  home,
  hash.slice(0, 16),
  token,
);
assert.ok(projection);
const recovery = createProviderAuthenticationRecoveryRecord(
  home,
  hash,
  projection,
);
assert.ok(recovery);
const f = await createAuthenticationFixture({ mock }, "claude", "login");
const controls = readline.createInterface({ input: process.stdin });
const input = controls[Symbol.asyncIterator]();
let held: ReturnType<typeof acquireRuntimeOwnedLogicalProviderHomeKernelLock> =
  null;
let waiting = false,
  receiptCalls = 0,
  recoveryCalls = 0;
f.f.waitGate = async (argv) => {
  if (waiting || !argv.includes("create")) return;
  waiting = true;
  const stored = JSON.parse(fs.readFileSync(recovery.recordPath, "utf8"));
  assert.equal(stored.commandState, "in_flight");
  assert.equal(stored.commandPurpose, "create_internal_network");
  assert.equal(stored.resources.checkpoints[0].submission, "intent_saved");
  process.stdout.write(
    `${JSON.stringify({
      event: "in_flight",
      recoveryId: recovery.recoveryId,
      purpose: stored.commandPurpose,
    })}\n`,
  );
  const lose = await input.next();
  assert.equal(lose.value, "LOSE");
  assert.ok(held?.release());
  process.stdout.write(
    JSON.stringify({ event: "lock_lost", recoveryId: recovery.recoveryId }) +
      "\n",
  );
  const finish = await input.next();
  assert.equal(finish.value, "FINISH");
  throw Error("finite_wait_failed_after_owner_loss");
};
const result = await authenticateProvider("claude", "login", home, hash, {
  ...f.dependencies,
  randomHex: () => token,
  acquireProviderHomeLock: (value) => {
    held = acquireRuntimeOwnedLogicalProviderHomeKernelLock(value);
    return held;
  },
  beginRecovery: beginProviderAuthenticationRecovery,
  setRecoveryCommandState: setProviderAuthenticationRecoveryCommandState,
  readResources: readProviderAuthenticationResources,
  recordResource: (record, event) => {
    receiptCalls++;
    return recordProviderAuthenticationResource(record, event);
  },
  completeRecovery: (record) => {
    recoveryCalls++;
    return settleProviderAuthenticationRecovery(record);
  },
});
controls.close();
mock.restoreAll();
if (process.argv[5] === "receipt-negative-control") receiptCalls++;
if (process.argv[5] === "recovery-negative-control") recoveryCalls++;
assert.equal(receiptCalls, 0, "receipt_call_after_lock_loss");
assert.equal(recoveryCalls, 0, "recovery_call_after_lock_loss");
assert.equal(result.status, "blocked");
assert.equal(result.reason, "provider_authentication_provider_home_lock_lost");
assert.equal(result.cleanupConfirmed, false);
process.stdout.write(
  `${JSON.stringify({
    event: "result",
    status: result.status,
    reason: result.reason,
    recoveryId: "recoveryId" in result ? result.recoveryId : null,
    cleanupConfirmed: result.cleanupConfirmed,
    receiptCallCount: receiptCalls,
    recoveryCallCount: recoveryCalls,
  })}\n`,
);
