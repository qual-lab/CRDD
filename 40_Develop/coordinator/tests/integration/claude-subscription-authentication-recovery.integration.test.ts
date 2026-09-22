/**
 * coordinator:integration:claude-subscription-authentication-recoveryの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Claude再認証の耐久Intentと別Process Kernel Lock再入場を検証する。
 * @trace ERB-IT-017
 * @level IT
 * @scope coordinator、claude-authentication、recovery、kernel-lock
 * @boundary ERB-IT-017=Integration: Filesystem耐久記録とWindows Named Pipe Kernel Lock境界
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "../../src/security/candidate-store-kernel-lock.ts";
import {
  authenticateClaudeSubscription,
  beginClaudeSubscriptionAuthenticationRecovery,
  createClaudeSubscriptionAuthenticationPlan,
  createClaudeSubscriptionAuthenticationRecoveryRecord,
  settleClaudeSubscriptionAuthenticationRecovery,
} from "../../src/security/claude-subscription-authentication.ts";

const hash = randomBytes(32).toString("hex");
const suffix = hash.slice(0, 16);
const token = "b".repeat(64);

function absenceError(purpose: string) {
  const resource = purpose.includes("network")
    ? purpose.includes("internal")
      ? `crdd-internal-${suffix}`
      : `crdd-egress-${suffix}`
    : purpose.includes("probe")
      ? `crdd-auth-${suffix}`
      : purpose.includes("login")
        ? `crdd-claude-${suffix}`
        : `crdd-proxy-${suffix}`;
  return purpose.includes("network")
    ? `Error response from daemon: network ${resource} not found`
    : `Error: No such container: ${resource}`;
}

/**
 * 別Process喪失後に同じRecovery IDとKernel Lockで再入場することを検証する。
 *
 * @responsibility 実Filesystem記録と実Kernel LockのProcess喪失後契約を検証する。
 * @trace ERB-IT-017
 * @precondition Repository-local試験一時Root内に専用Provider Homeを作成する。
 * @stimulus 子ProcessがLockとactive Intentを作成して解放処理なしで終了し、親Processが再入場する。
 * @observation 子終了、active記録、親Lock取得、cleanup順序、settled記録を観測する。
 * @oracle 同じRecovery IDで旧資源を処置して新規Lifecycleを完了し、記録をsettledへ閉じる。
 * @cleanup 試験専用Rootをfinallyで削除する。
 * @boundary ERB-IT-017=Integration: 別Process・Filesystem・Named Pipe境界
 */
test("Claude再認証はProcess喪失後に耐久Intentから再入場する", async () => {
  const root = path.resolve(
    "..",
    "..",
    ".crdd",
    "tmp",
    `claude-auth-${process.pid}`,
  );
  const providerHome = path.join(root, "ProviderHomes", "claude");
  fs.mkdirSync(providerHome, { recursive: true });
  const ownerFixture = fileURLToPath(
    new URL(
      "../fixtures/claude-subscription-authentication-recovery-owner.ts",
      import.meta.url,
    ),
  );
  try {
    const child = spawnSync(
      process.execPath,
      [ownerFixture, hash, providerHome, suffix, token],
      {
        cwd: path.dirname(ownerFixture),
        env: {},
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 15_000,
      },
    );
    assert.equal(child.status, 0, child.stderr);

    const purposes: string[] = [];
    const result = await authenticateClaudeSubscription(providerHome, hash, {
      randomHex: () => token,
      acquireProviderHomeLock: acquireRuntimeOwnedLogicalProviderHomeKernelLock,
      beginRecovery: beginClaudeSubscriptionAuthenticationRecovery,
      completeRecovery: settleClaudeSubscriptionAuthenticationRecovery,
      run: async (command) => {
        purposes.push(command.purpose);
        return {
          status: command.purpose.startsWith("confirm_") ? 1 : 0,
          signal: null,
          stdout: command.purpose.startsWith("observe_")
            ? `${suffix}\n`
            : command.purpose === "start_probe_attached"
              ? JSON.stringify({
                  loggedIn: true,
                  authMethod: "claude.ai",
                  apiProvider: "firstParty",
                  subscriptionType: "max",
                })
              : "",
          stderr: command.purpose.startsWith("confirm_")
            ? absenceError(command.purpose)
            : "",
        };
      },
    });
    assert.equal(result.status, "completed");
    assert.equal(result.recoveryId, null);
    assert.equal(
      purposes.filter((value) => value === "create_internal_network").length,
      1,
    );
    const plan = createClaudeSubscriptionAuthenticationPlan(
      providerHome,
      suffix,
      token,
    );
    assert.ok(plan);
    const record = createClaudeSubscriptionAuthenticationRecoveryRecord(
      providerHome,
      hash,
      plan,
    );
    assert.ok(record);
    const stored = JSON.parse(fs.readFileSync(record.recordPath, "utf8")) as {
      state?: unknown;
    };
    assert.equal(stored.state, "settled");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
