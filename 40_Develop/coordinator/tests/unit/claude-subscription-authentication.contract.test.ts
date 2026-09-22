/**
 * coordinator:unit:claude-subscription-authenticationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Claude再認証の固定Plan、成功条件、失敗停止およびcleanupを検証する。
 * @trace PRL-UT-001
 * @level UT
 * @scope coordinator、claude-authentication
 * @boundary PRL-UT-001=Unit: 認証Lifecycleの決定論的Process Adapter境界
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticateClaudeSubscription,
  createClaudeSubscriptionAuthenticationPlan,
} from "../../src/security/claude-subscription-authentication.ts";

const suffix = "0123456789abcdef";
const token = "a".repeat(64);

/**
 * 再認証PlanがRepositoryを接続せず固定Imageと限定Proxyだけを使うことを検証する。
 *
 * @responsibility 再認証の外部境界と非対象mountを検証する。
 * @trace PRL-UT-001
 * @precondition 検証済みProvider Home相当のfixture Pathを使う。
 * @stimulus 固定Planを生成する。
 * @observation Docker argv、Image digest、mountおよびCommand順序を観測する。
 * @oracle Repository/Workspace mountがなく、loginとnetwork-none probeが存在する。
 * @cleanup N/A: 純粋Plan生成で外部資源を作らない。
 * @boundary PRL-UT-001=Unit: Docker argv生成境界
 */
test("再認証Planは専用Provider Home以外をmountしない", () => {
  const plan = createClaudeSubscriptionAuthenticationPlan(
    "C:\\runtime-owned\\claude",
    suffix,
    token,
  );
  assert.ok(plan);
  const serialized = JSON.stringify(plan.commands);
  assert.match(serialized, /auth.*login.*--claudeai/u);
  assert.match(serialized, /auth.*status.*--json/u);
  assert.match(serialized, /--network=none/u);
  assert.doesNotMatch(serialized, /\/workspace|\/repository|C:\\project/u);
  assert.equal(
    plan.commands.some((command) => command.interactive),
    true,
  );
  assert.equal(plan.cleanupCommands.length, 5);
  assert.equal(plan.absenceCommands.length, 5);
});

/**
 * 再認証はClaude Max Probeとcleanupの両方でだけ完了することを検証する。
 *
 * @responsibility 認証成功、秘密非公開およびcleanup完了Gateを検証する。
 * @trace PRL-UT-001
 * @precondition 全Commandが成功し、ProbeがMax契約を返す。
 * @stimulus 注入Process境界で認証Lifecycleを実行する。
 * @observation 公開結果と全Commandの実行を観測する。
 * @oracle completed、認証確認、cleanup確認、Repository非接続になる。
 * @cleanup fixtureのcleanup Commandも注入境界で観測する。
 * @boundary PRL-UT-001=Unit: 認証Lifecycle完了境界
 */
test("再認証は事後Probeとcleanupの両方で完了する", async () => {
  const purposes: string[] = [];
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\claude",
    {
      randomHex: (bytes) => (bytes === 8 ? suffix : token),
      run: async (command) => {
        purposes.push(command.purpose);
        return {
          status: command.purpose.startsWith("confirm_") ? 1 : 0,
          signal: null,
          stdout:
            command.purpose === "start_probe_attached"
              ? JSON.stringify({
                  loggedIn: true,
                  authMethod: "claude.ai",
                  apiProvider: "firstParty",
                  subscriptionType: "max",
                })
              : "",
          stderr: "",
        };
      },
    },
  );
  assert.equal(result.status, "completed");
  assert.equal(result.authenticationConfirmed, true);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.repositoryMounted, false);
  assert.equal(result.rawProviderOutputReported, false);
  assert.deepEqual(purposes.slice(-10, -5), [
    "remove_probe",
    "remove_login",
    "remove_proxy",
    "remove_internal_network",
    "remove_egress_network",
  ]);
  assert.deepEqual(purposes.slice(-5), [
    "confirm_probe_absent",
    "confirm_login_absent",
    "confirm_proxy_absent",
    "confirm_internal_network_absent",
    "confirm_egress_network_absent",
  ]);
});

/**
 * 再認証失敗後も残りのEffectを止めてexact cleanupすることを検証する。
 *
 * @responsibility 部分失敗時の停止とcleanupを検証する。
 * @trace PRL-UT-001
 * @precondition Proxy開始だけを失敗させる。
 * @stimulus 注入Process境界で認証Lifecycleを実行する。
 * @observation 失敗理由、後続login非実行、全cleanup Commandを観測する。
 * @oracle blockedとなり、login Effectを開始せずcleanupを完了する。
 * @cleanup fixtureのcleanup Commandも注入境界で観測する。
 * @boundary PRL-UT-001=Unit: 部分失敗・回収境界
 */
test("再認証は途中失敗後にloginを開始せずcleanupする", async () => {
  const purposes: string[] = [];
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\claude",
    {
      randomHex: (bytes) => (bytes === 8 ? suffix : token),
      run: async (command) => {
        purposes.push(command.purpose);
        return {
          status:
            command.purpose.startsWith("confirm_") ||
            command.purpose === "start_proxy"
              ? 1
              : 0,
          signal: null,
          stdout: "",
          stderr: "",
        };
      },
    },
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "claude_authentication_start_proxy_failed");
  assert.equal(purposes.includes("start_login_attached"), false);
  assert.deepEqual(purposes.slice(-10, -5), [
    "remove_probe",
    "remove_login",
    "remove_proxy",
    "remove_internal_network",
    "remove_egress_network",
  ]);
});
