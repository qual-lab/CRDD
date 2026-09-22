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

import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "../../src/security/candidate-store-kernel-lock.ts";
import {
  authenticateClaudeSubscription,
  beginClaudeSubscriptionAuthenticationRecovery,
  createClaudeSubscriptionAuthenticationPlan,
  createClaudeSubscriptionAuthenticationRecoveryRecord,
  setClaudeSubscriptionAuthenticationRecoveryCommandState,
  settleClaudeSubscriptionAuthenticationRecovery,
} from "../../src/security/claude-subscription-authentication.ts";

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

const result = await authenticateClaudeSubscription(
  providerHome,
  stableLogicalHomeBindingHash,
  {
    randomHex: () => token,
    acquireProviderHomeLock: (identityHash) => {
      heldLock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(identityHash);
      return heldLock;
    },
    beginRecovery: beginClaudeSubscriptionAuthenticationRecovery,
    setRecoveryCommandState:
      setClaudeSubscriptionAuthenticationRecoveryCommandState,
    completeRecovery: settleClaudeSubscriptionAuthenticationRecovery,
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
  },
);

controls.close();
process.stdout.write(
  `${JSON.stringify({ event: "result", status: result.status, reason: result.reason, recoveryId: "recoveryId" in result ? result.recoveryId : null, cleanupConfirmed: result.cleanupConfirmed })}\n`,
);
if (
  result.status !== "blocked" ||
  result.reason !== "claude_authentication_provider_home_lock_lost" ||
  !("recoveryId" in result) ||
  result.recoveryId !== recovery.recoveryId ||
  result.cleanupConfirmed !== false
)
  process.exit(73);
