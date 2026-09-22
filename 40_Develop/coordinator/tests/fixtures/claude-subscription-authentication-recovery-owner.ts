/**
 * Claude再認証のProcess喪失Fixtureを実行する。
 *
 * @packageDocumentation
 * @responsibility 実Kernel Lockとactive回復記録を作成し、解放処理なしのProcess終了状態を構築する。
 * @trace ERB-IT-017
 * @level IT
 * @scope coordinator、claude-authentication、recovery、kernel-lock
 * @boundary ERB-IT-017=Integration: 別Process・Filesystem・Windows Named Pipe境界
 */
import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "../../src/security/candidate-store-kernel-lock.ts";
import {
  beginClaudeSubscriptionAuthenticationRecovery,
  createClaudeSubscriptionAuthenticationPlan,
  createClaudeSubscriptionAuthenticationRecoveryRecord,
} from "../../src/security/claude-subscription-authentication.ts";

const [stableLogicalHomeBindingHash, providerHome, suffix, token] =
  process.argv.slice(2);
if (!stableLogicalHomeBindingHash || !providerHome || !suffix || !token)
  process.exit(70);
const lock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(
  stableLogicalHomeBindingHash,
);
if (!lock) process.exit(71);
const plan = createClaudeSubscriptionAuthenticationPlan(
  providerHome,
  suffix,
  token,
);
if (!plan) process.exit(72);
const record = createClaudeSubscriptionAuthenticationRecoveryRecord(
  providerHome,
  stableLogicalHomeBindingHash,
  plan,
);
if (!record) process.exit(73);
if (beginClaudeSubscriptionAuthenticationRecovery(record) !== "created")
  process.exit(74);
