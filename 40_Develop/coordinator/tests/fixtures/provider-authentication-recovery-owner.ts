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
import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "../../src/execution/kernel-lock.ts";
import {
  beginProviderAuthenticationRecovery,
  createProviderAuthenticationPlan,
  createProviderAuthenticationRecoveryRecord,
} from "../../src/execution/authority.ts";

const [stableLogicalHomeBindingHash, providerHome, suffix, token] =
  process.argv.slice(2);
if (!stableLogicalHomeBindingHash || !providerHome || !suffix || !token)
  process.exit(70);
const lock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(
  stableLogicalHomeBindingHash,
);
if (!lock) process.exit(71);
const plan = createProviderAuthenticationPlan(
  "claude",
  "login",
  providerHome,
  suffix,
  token,
);
if (!plan) process.exit(72);
const record = createProviderAuthenticationRecoveryRecord(
  providerHome,
  stableLogicalHomeBindingHash,
  plan,
);
if (!record) process.exit(73);
if (beginProviderAuthenticationRecovery(record) !== "created") process.exit(74);
// 明示releaseを呼ばずProcess喪失を構築する。Lockサーバーの自然終了待ちはしない。
process.exit(0);
