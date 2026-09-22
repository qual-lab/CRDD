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
  runDockerCommandWithAuthority,
} from "../../src/security/claude-subscription-authentication.ts";

const suffix = "0123456789abcdef";
const token = "a".repeat(64);
const stableLogicalHomeBindingHash = `${suffix}${suffix}${suffix}${suffix}`;
const lifecycleDependencies = Object.freeze({
  acquireProviderHomeLock: () =>
    Object.freeze({ assertLive: () => true, release: () => true }),
  beginRecovery: () => "created" as const,
  setRecoveryCommandState: () => true,
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
 * 実行中の非対話ProcessでLockを失った場合にProcess closeまで待つことを検証する。
 *
 * @responsibility Docker CLI共通実行境界の実行中Authority監視と終了確認を検証する。
 * @trace ERB-UT-016
 * @precondition 長時間動作する固定Node子Processと、実行中にfalseへ遷移するLock観測を使う。
 * @stimulus 非対話Command開始後にLock生存値をfalseへ変える。
 * @observation 戻り理由、経過時間および子Process close後の結果を観測する。
 * @oracle Lock喪失を返し、監視周期前に成功せず、子Process close後だけ完了する。
 * @cleanup 実行境界が子Processへ終了要求を発行してcloseを待つ。
 * @boundary ERB-UT-016=Unit: 実行中Process Authority監視境界
 */
test("再認証Docker Commandは実行中Lock喪失後に子Process closeを待つ", async () => {
  let live = true;
  const startedAt = Date.now();
  const timer = setTimeout(() => {
    live = false;
  }, 50);
  try {
    const result = await runDockerCommandWithAuthority(
      process.execPath,
      {
        purpose: "lock_loss_fixture",
        argv: ["--eval", "setTimeout(() => {}, 5000)"],
        interactive: false,
      },
      {},
      process.cwd(),
      () => live,
    );
    assert.equal(result.error?.message, "provider_home_lock_lost");
    assert.ok(Date.now() - startedAt >= 200);
    assert.notEqual(result.status, 0);
  } finally {
    clearTimeout(timer);
  }
});

/**
 * 回復在庫が不明な場合にLock解放だけでcleanup完了を返さないことを検証する。
 *
 * @responsibility Recovery inventory、資源不存在、settlement、Lock解放の積としてcleanup結果を固定する。
 * @trace ERB-UT-016
 * @precondition beginRecoveryはunknown、Lock releaseは成功を返す。
 * @stimulus 再認証Lifecycleを開始する。
 * @observation cleanup、手動回復、Effect不明およびRecovery IDを観測する。
 * @oracle cleanupConfirmed=falseで同じRecovery IDと回復義務を保持する。
 * @cleanup Docker Effectを発行しない。
 * @boundary ERB-UT-016=Unit: Recovery inventory不明境界
 */
test("再認証は回復在庫不明をcleanup完了へ畳まない", async () => {
  let runCount = 0;
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    stableLogicalHomeBindingHash,
    {
      ...lifecycleDependencies,
      beginRecovery: () => "unknown",
      randomHex: () => token,
      run: async () => {
        runCount += 1;
        throw new Error("unexpected_effect");
      },
    },
  );
  assert.equal(
    result.reason,
    "claude_authentication_recovery_inventory_unknown",
  );
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.effectStateUnknown, true);
  assert.equal(
    result.recoveryId,
    `claude-auth.${stableLogicalHomeBindingHash}`,
  );
  assert.equal(runCount, 0);
});

/**
 * 回復後のactive記録再作成失敗をcleanup完了へ畳まないことを検証する。
 *
 * @responsibility 回復済み記録と新しい認証Lifecycleの再入場境界を検証する。
 * @trace ERB-UT-016
 * @precondition 既存active記録の資源cleanupは完了するが、次のactive記録作成結果が不明になる。
 * @stimulus 同じProvider Homeの認証Lifecycleへ再入場する。
 * @observation cleanup、手動回復、Effect不明およびRecovery IDを観測する。
 * @oracle cleanupConfirmed=falseで同じRecovery IDを保持し、新しい認証Commandを発行しない。
 * @cleanup 所有資源の不存在確認まで完了し、追加Docker Effectを発行しない。
 * @boundary ERB-UT-016=Unit: Recovery再入場境界
 */
test("再認証は回復後の再入場失敗をcleanup完了へ畳まない", async () => {
  let beginCount = 0;
  let authenticationCommandCount = 0;
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    stableLogicalHomeBindingHash,
    {
      ...lifecycleDependencies,
      beginRecovery: () => {
        beginCount += 1;
        return beginCount === 1 ? "existing_idle" : "unknown";
      },
      randomHex: () => token,
      run: async (command) => {
        if (command.purpose === "start_internal_network")
          authenticationCommandCount += 1;
        return {
          status: command.purpose.startsWith("confirm_") ? 1 : 0,
          signal: null,
          stdout: command.purpose.startsWith("observe_")
            ? ownershipOutput(command.purpose)
            : "",
          stderr: command.purpose.startsWith("confirm_")
            ? absenceError(command.purpose)
            : "",
        };
      },
    },
  );
  assert.equal(result.reason, "claude_authentication_recovery_reentry_failed");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.effectStateUnknown, false);
  assert.equal(
    result.recoveryId,
    `claude-auth.${stableLogicalHomeBindingHash}`,
  );
  assert.equal(beginCount, 2);
  assert.equal(authenticationCommandCount, 0);
});

/**
 * 最終不存在観測後のLock喪失でsettledを書かないことを検証する。
 *
 * @responsibility cleanup観測と耐久settlementの間にあるLock生存Gateを検証する。
 * @trace ERB-UT-016
 * @precondition 全Docker資源の不存在確認は成功し、最後の確認中にLockを失う。
 * @stimulus 認証Lifecycleを完了直前まで進める。
 * @observation settlement呼出し回数、cleanup結果およびRecovery IDを観測する。
 * @oracle completeRecoveryを呼ばずactive記録と同じRecovery IDを保持する。
 * @cleanup Lock喪失後は追加Docker Effectを発行しない。
 * @boundary ERB-UT-016=Unit: cleanup完了からsettlementへのAuthority境界
 */
test("再認証は最終不存在確認後のLock喪失でsettledを書かない", async () => {
  let live = true;
  let settlementCount = 0;
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    stableLogicalHomeBindingHash,
    {
      ...lifecycleDependencies,
      acquireProviderHomeLock: () => ({
        assertLive: () => live,
        release: () => false,
      }),
      completeRecovery: () => {
        settlementCount += 1;
        return true;
      },
      randomHex: () => token,
      run: async (command) => {
        if (command.purpose === "confirm_egress_network_absent") live = false;
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
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "claude_authentication_provider_home_lock_lost");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(settlementCount, 0);
  assert.equal(
    result.recoveryId,
    `claude-auth.${stableLogicalHomeBindingHash}`,
  );
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
        return beginCount === 1 ? "existing_idle" : "created";
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
