/**
 * 本番Claude再認証をCommand実行中で保留する別Process Fixtureを提供する。
 *
 * @packageDocumentation
 * @responsibility 本番オーケストレーションがEffect前にin-flightを耐久化する順序と、Lock喪失後にidleへ戻さない契約を観測可能にする。
 * @trace ERB-IT-017
 * @level IT
 * @scope coordinator、claude-authentication、recovery、kernel-lock
 * @boundary ERB-IT-017=Integration: 本番認証関数・別Process・Filesystem・Windows Named Pipe境界
 */
import readline from "node:readline";
import fs from "node:fs";
import assert from "node:assert/strict";

import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "../../src/execution/kernel-lock.ts";
import {
  authenticateClaudeSubscription,
  beginClaudeSubscriptionAuthenticationRecovery,
  createClaudeSubscriptionAuthenticationPlan,
  createClaudeSubscriptionAuthenticationRecoveryRecord,
  setClaudeSubscriptionAuthenticationRecoveryCommandState,
  settleClaudeSubscriptionAuthenticationRecovery,
} from "../../src/execution/authority.ts";

const [stableLogicalHomeBindingHash, providerHome, token] =
  process.argv.slice(2);
if (!stableLogicalHomeBindingHash || !providerHome || !token) process.exit(70);

const suffix = stableLogicalHomeBindingHash.slice(0, 16);
const plan = createClaudeSubscriptionAuthenticationPlan(
  providerHome,
  suffix,
  token,
);
if (!plan) process.exit(71);
const recovery = createClaudeSubscriptionAuthenticationRecoveryRecord(
  providerHome,
  stableLogicalHomeBindingHash,
  plan,
);
if (!recovery) process.exit(72);

const controls = readline.createInterface({ input: process.stdin });
const controlIterator = controls[Symbol.asyncIterator]();
let heldLock: Readonly<{
  assertLive: () => boolean;
  release: () => boolean;
}> | null = null;
let commandCount = 0;
let receiptCallCount = 0;
let recoveryCallCount = 0;

const dependencies = {
  randomHex: () => token,
  acquireProviderHomeLock: (identityHash) => {
    heldLock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(identityHash);
    return heldLock;
  },
  beginRecovery: beginClaudeSubscriptionAuthenticationRecovery,
  setRecoveryCommandState:
    setClaudeSubscriptionAuthenticationRecoveryCommandState,
  completeRecovery: settleClaudeSubscriptionAuthenticationRecovery,
  recordCreatedResource: () => {
    receiptCallCount += 1;
    throw new Error("resource_receipt_after_lock_loss_forbidden");
  },
  recoveryCommands: () => {
    recoveryCallCount += 1;
    throw new Error("resource_recovery_after_lock_loss_forbidden");
  },
  run: async (command) => {
    commandCount += 1;
    if (commandCount !== 1) throw new Error("unexpected_second_command");
    const stored = JSON.parse(
      await fs.promises.readFile(recovery.recordPath, "utf8"),
    ) as Record<string, unknown>;
    if (
      stored.recoveryId !== recovery.recoveryId ||
      stored.commandState !== "in_flight" ||
      stored.commandPurpose !== command.purpose
    )
      throw new Error("command_intent_not_durable_before_run");
    process.stdout.write(
      `${JSON.stringify({ event: "in_flight", recoveryId: recovery.recoveryId, purpose: command.purpose })}\n`,
    );
    const lose = await controlIterator.next();
    if (lose.done || lose.value !== "LOSE" || !heldLock?.release())
      throw new Error("kernel_lock_loss_not_triggered");
    process.stdout.write(
      `${JSON.stringify({ event: "lock_lost", recoveryId: recovery.recoveryId })}\n`,
    );
    const finish = await controlIterator.next();
    if (finish.done || finish.value !== "FINISH")
      throw new Error("fixture_finish_not_authorized");
    return {
      status: 1,
      signal: null,
      stdout: "",
      stderr: "fixture_command_failed_after_lock_loss",
    };
  },
} satisfies NonNullable<Parameters<typeof authenticateClaudeSubscription>[2]>;
const result = await authenticateClaudeSubscription(
  providerHome,
  stableLogicalHomeBindingHash,
  dependencies,
);

controls.close();
const oracleControl = process.argv[5];
try {
  if (oracleControl === "receipt-negative-control")
    dependencies.recordCreatedResource();
  if (oracleControl === "recovery-negative-control")
    dependencies.recoveryCommands();
} catch {
  // 本番側が例外を吸収しても、独立した呼出し回数のOracleは拒否する。
}
assert.equal(receiptCallCount, 0, "receipt_call_after_lock_loss");
assert.equal(recoveryCallCount, 0, "recovery_call_after_lock_loss");
process.stdout.write(
  `${JSON.stringify({ event: "result", status: result.status, reason: result.reason, recoveryId: "recoveryId" in result ? result.recoveryId : null, cleanupConfirmed: result.cleanupConfirmed, receiptCallCount, recoveryCallCount })}\n`,
);
if (
  result.status !== "blocked" ||
  result.reason !== "claude_authentication_provider_home_lock_lost" ||
  !("recoveryId" in result) ||
  result.recoveryId !== recovery.recoveryId ||
  result.cleanupConfirmed !== false
)
  process.exit(73);
