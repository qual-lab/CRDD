/**
 * coordinator:unit:claude-subscription-authenticationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Claude再認証の固定Plan、成功条件、失敗停止およびcleanupを検証する。
 * @trace ERB-UT-016
 * @level UT
 * @scope coordinator、claude-authentication
 * @boundary ERB-UT-016=Unit: 認証Lifecycleの決定論的Process Adapter境界
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticateClaudeSubscription,
  createClaudeSubscriptionAuthenticationPlan,
} from "../../src/security/claude-subscription-authentication.ts";

const suffix = "0123456789abcdef";
const token = "a".repeat(64);
const stableLogicalHomeBindingHash = `${suffix}${suffix}${suffix}${suffix}`;
const lifecycleDependencies = Object.freeze({
  acquireProviderHomeLock: () =>
    Object.freeze({ assertLive: () => true, release: () => true }),
  beginRecovery: () => "created" as const,
  completeRecovery: () => true,
});

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

function ownershipOutput(purpose: string) {
  return purpose.startsWith("observe_") ? `${suffix}\n` : "";
}

/**
 * 再認証PlanがRepositoryを接続せず固定Imageと限定Proxyだけを使うことを検証する。
 *
 * @responsibility 再認証の外部境界と非対象mountを検証する。
 * @trace ERB-UT-016
 * @precondition 検証済みProvider Home相当のfixture Pathを使う。
 * @stimulus 固定Planを生成する。
 * @observation Docker argv、Image digest、mountおよびCommand順序を観測する。
 * @oracle Repository/Workspace mountがなく、loginとnetwork-none probeが存在する。
 * @cleanup N/A: 純粋Plan生成で外部資源を作らない。
 * @boundary ERB-UT-016=Unit: Docker argv生成境界
 */
test("再認証Planは専用Provider Home以外をmountしない", () => {
  const plan = createClaudeSubscriptionAuthenticationPlan(
    "C:\\runtime-owned\\ProviderHomes\\claude",
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
  assert.equal(plan.ownershipCommands.length, 5);
  assert.equal(plan.absenceCommands.length, 5);
});

/**
 * 再認証はClaude Max Probeとcleanupの両方でだけ完了することを検証する。
 *
 * @responsibility 認証成功、秘密非公開およびcleanup完了Gateを検証する。
 * @trace ERB-UT-016
 * @precondition 全Commandが成功し、ProbeがMax契約を返す。
 * @stimulus 注入Process境界で認証Lifecycleを実行する。
 * @observation 公開結果と全Commandの実行を観測する。
 * @oracle completed、認証確認、cleanup確認、Repository非接続になる。
 * @cleanup fixtureのcleanup Commandも注入境界で観測する。
 * @boundary ERB-UT-016=Unit: 認証Lifecycle完了境界
 */
test("再認証は事後Probeとcleanupの両方で完了する", async () => {
  const purposes: string[] = [];
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    stableLogicalHomeBindingHash,
    {
      ...lifecycleDependencies,
      randomHex: (bytes) => (bytes === 8 ? suffix : token),
      run: async (command) => {
        purposes.push(command.purpose);
        return {
          status: command.purpose.startsWith("confirm_") ? 1 : 0,
          signal: null,
          stdout: command.purpose.startsWith("observe_")
            ? ownershipOutput(command.purpose)
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
    },
  );
  assert.equal(result.status, "completed");
  assert.equal(result.authenticationConfirmed, true);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.repositoryMounted, false);
  assert.equal(result.rawProviderOutputReported, false);
  assert.equal(
    purposes.filter((purpose) => purpose.startsWith("observe_")).length,
    5,
  );
  assert.equal(
    purposes.filter((purpose) => purpose.startsWith("remove_")).length,
    5,
  );
  assert.equal(
    purposes.filter((purpose) => purpose.startsWith("confirm_")).length,
    5,
  );
});

/**
 * 再認証失敗後も残りのEffectを止めてexact cleanupすることを検証する。
 *
 * @responsibility 部分失敗時の停止とcleanupを検証する。
 * @trace ERB-UT-016
 * @precondition Proxy開始だけを失敗させる。
 * @stimulus 注入Process境界で認証Lifecycleを実行する。
 * @observation 失敗理由、後続login非実行、全cleanup Commandを観測する。
 * @oracle blockedとなり、login Effectを開始せずcleanupを完了する。
 * @cleanup fixtureのcleanup Commandも注入境界で観測する。
 * @boundary ERB-UT-016=Unit: 部分失敗・回収境界
 */
test("再認証は途中失敗後にloginを開始せずcleanupする", async () => {
  const purposes: string[] = [];
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    stableLogicalHomeBindingHash,
    {
      ...lifecycleDependencies,
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
          stdout: ownershipOutput(command.purpose),
          stderr: command.purpose.startsWith("confirm_")
            ? absenceError(command.purpose)
            : "",
        };
      },
    },
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "claude_authentication_start_proxy_failed");
  assert.equal(purposes.includes("start_login_attached"), false);
  assert.equal(
    purposes.filter((purpose) => purpose.startsWith("remove_")).length,
    5,
  );
});

/**
 * Docker観測失敗を資源不存在へ畳まないことを検証する。
 *
 * @responsibility cleanup確認が明示的な不存在だけを受理することを検証する。
 * @trace ERB-UT-016
 * @precondition 認証Probeは成功し、不存在確認の一件だけがEngine接続失敗を返す。
 * @stimulus 注入Process境界で認証Lifecycleを実行する。
 * @observation cleanup確認と公開結果を観測する。
 * @oracle 認証済みでもcleanup未確認としてblockedになる。
 * @cleanup fixtureは外部資源を作らない。
 * @boundary ERB-UT-016=Unit: Docker不存在観測境界
 */
test("再認証はDocker観測失敗を資源不存在として受理しない", async () => {
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    stableLogicalHomeBindingHash,
    {
      ...lifecycleDependencies,
      randomHex: (bytes) => (bytes === 8 ? suffix : token),
      run: async (command) => ({
        status: command.purpose.startsWith("confirm_") ? 1 : 0,
        signal: null,
        stdout: command.purpose.startsWith("observe_")
          ? ownershipOutput(command.purpose)
          : command.purpose === "start_probe_attached"
            ? JSON.stringify({
                loggedIn: true,
                authMethod: "claude.ai",
                apiProvider: "firstParty",
                subscriptionType: "max",
              })
            : "",
        stderr:
          command.purpose === "confirm_proxy_absent"
            ? "error during connect: engine unavailable"
            : command.purpose.startsWith("confirm_")
              ? absenceError(command.purpose)
              : "",
      }),
    },
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    "authenticationConfirmed" in result
      ? result.authenticationConfirmed
      : false,
    true,
  );
  assert.equal(result.cleanupConfirmed, false);
});

/**
 * 同名の非所有Docker資源を削除しないことを検証する。
 *
 * @responsibility 名前一致と所有権一致を分けるcleanup境界を検証する。
 * @trace ERB-UT-016
 * @precondition Proxyの所有labelだけが期待値と異なる。
 * @stimulus 認証Lifecycleのcleanupを実行する。
 * @observation Proxy削除Commandと公開結果を観測する。
 * @oracle 非所有Proxyへ削除Effectを発行せずblockedになる。
 * @cleanup fixtureは外部資源を作らない。
 * @boundary ERB-UT-016=Unit: Docker資源所有権判定境界
 */
test("再認証は同名の非所有Docker資源を削除しない", async () => {
  const purposes: string[] = [];
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    stableLogicalHomeBindingHash,
    {
      ...lifecycleDependencies,
      randomHex: () => token,
      run: async (command) => {
        purposes.push(command.purpose);
        return {
          status: command.purpose.startsWith("confirm_") ? 1 : 0,
          signal: null,
          stdout:
            command.purpose === "observe_proxy_owner"
              ? "foreign\n"
              : command.purpose.startsWith("observe_")
                ? ownershipOutput(command.purpose)
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
    },
  );
  assert.equal(result.status, "blocked");
  assert.equal(purposes.includes("remove_proxy"), false);
  assert.equal(result.cleanupConfirmed, false);
});

/**
 * Provider Home Lock喪失後に新しいEffectを発行しないことを検証する。
 *
 * @responsibility 長時間対話を含む認証LifecycleのLock生存Gateを検証する。
 * @trace ERB-UT-016
 * @precondition Proxy開始直後にLock生存確認が失敗する。
 * @stimulus 認証Lifecycleを継続させる。
 * @observation 後続Command、cleanup、Recovery結果を観測する。
 * @oracle loginと競合cleanupを発行せず同じRecovery IDを保持する。
 * @cleanup Lock喪失後のcleanup Effectは発行しない。
 * @boundary ERB-UT-016=Unit: Provider Home Lock生存判定境界
 */
test("再認証はProvider Home Lock喪失後のEffectを停止する", async () => {
  const purposes: string[] = [];
  let live = true;
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    stableLogicalHomeBindingHash,
    {
      ...lifecycleDependencies,
      acquireProviderHomeLock: () => ({
        assertLive: () => live,
        release: () => false,
      }),
      randomHex: () => token,
      run: async (command) => {
        purposes.push(command.purpose);
        if (command.purpose === "start_proxy") live = false;
        return { status: 0, signal: null, stdout: "", stderr: "" };
      },
    },
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "claude_authentication_provider_home_lock_lost");
  assert.equal(purposes.includes("create_login"), false);
  assert.equal(
    purposes.some((purpose) => purpose.startsWith("remove_")),
    false,
  );
  assert.equal(
    result.recoveryId,
    `claude-auth.${stableLogicalHomeBindingHash}`,
  );
  assert.equal(result.manualRecoveryRequired, true);
});

/**
 * 同じProvider Homeの並行再認証をEffect前に拒否することを検証する。
 *
 * @responsibility Provider Home Kernel Lockの排他境界を検証する。
 * @trace ERB-UT-016
 * @precondition 同じ論理Provider HomeのLockが既に保持されている。
 * @stimulus 再認証Lifecycleを開始する。
 * @observation Docker Adapter呼出し回数と公開結果を観測する。
 * @oracle Docker Effect 0のblockedになる。
 * @cleanup fixtureは外部資源を作らない。
 * @boundary ERB-UT-016=Unit: Provider Home並行書込み境界
 */
test("再認証は同じProvider Homeの後発操作をEffect前に拒否する", async () => {
  let runCount = 0;
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    stableLogicalHomeBindingHash,
    {
      ...lifecycleDependencies,
      acquireProviderHomeLock: () => null,
      randomHex: () => token,
      run: async () => {
        runCount += 1;
        throw new Error("unexpected_effect");
      },
    },
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "claude_authentication_provider_home_active_or_unknown",
  );
  assert.equal(result.providerEffectIssued, false);
  assert.equal(runCount, 0);
});

/**
 * Process loss後の耐久記録から同じ資源を回収して再入場できることを検証する。
 *
 * @responsibility exact Recovery Identityによるfresh Process再入場を検証する。
 * @trace ERB-UT-016
 * @precondition 同じProvider Homeの耐久Intentが既に存在する。
 * @stimulus fresh Lifecycleを開始する。
 * @observation 旧資源cleanup、記録settlement、新規Effectの順序を観測する。
 * @oracle 旧資源不存在を確認してから同じIdentityで新規認証を実行する。
 * @cleanup fixtureのcleanup Commandも注入境界で観測する。
 * @boundary ERB-UT-016=Unit: Process loss後のRecovery再入場境界
 */
test("再認証は耐久Intentから旧資源を回収してfresh Processで再入場する", async () => {
  const purposes: string[] = [];
  const journalEvents: string[] = [];
  let beginCount = 0;
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    stableLogicalHomeBindingHash,
    {
      ...lifecycleDependencies,
      beginRecovery: () => {
        beginCount += 1;
        journalEvents.push(`begin-${beginCount}`);
        return beginCount === 1 ? "existing" : "created";
      },
      completeRecovery: () => {
        journalEvents.push("complete");
        return true;
      },
      randomHex: () => token,
      run: async (command) => {
        purposes.push(command.purpose);
        return {
          status: command.purpose.startsWith("confirm_") ? 1 : 0,
          signal: null,
          stdout: command.purpose.startsWith("observe_")
            ? ownershipOutput(command.purpose)
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
    },
  );
  assert.equal(result.status, "completed");
  assert.deepEqual(journalEvents, [
    "begin-1",
    "complete",
    "begin-2",
    "complete",
  ]);
  assert.deepEqual(
    purposes
      .slice(0, purposes.indexOf("create_internal_network"))
      .filter((purpose) => purpose.startsWith("remove_")),
    [
      "remove_probe",
      "remove_login",
      "remove_proxy",
      "remove_internal_network",
      "remove_egress_network",
    ],
  );
  assert.equal(purposes.includes("create_internal_network"), true);
});
