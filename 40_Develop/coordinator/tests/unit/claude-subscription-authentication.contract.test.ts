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
  describeClaudeSubscriptionAuthenticationCli,
  isClaudeSubscriptionAuthenticationConfirmed,
} from "../../../ai-adapter/src/index.ts";

import {
  authenticateClaudeSubscription,
  CLAUDE_SUBSCRIPTION_AUTHENTICATION_INPUT_NOTICE,
  createClaudeSubscriptionAuthenticationPlan,
} from "../../src/provider/claude-subscription-authentication.ts";

const AUTHENTICATION_SUFFIX = "0123456789abcdef";
const token = "a".repeat(64);
const STABLE_LOGICAL_HOME_BINDING_HASH = `${AUTHENTICATION_SUFFIX}${AUTHENTICATION_SUFFIX}${AUTHENTICATION_SUFFIX}${AUTHENTICATION_SUFFIX}`;
const lifecycleDependencies = Object.freeze({
  acquireProviderHomeLock: () =>
    Object.freeze({ assertLive: () => true, release: () => true }),
  beginRecovery: () => "created" as const,
  setRecoveryCommandState: () => true,
  completeRecovery: () => true,
  recordCreatedResource: () => true,
  recoveryCommands: (
    _record: unknown,
    plan: NonNullable<
      ReturnType<typeof createClaudeSubscriptionAuthenticationPlan>
    >,
    index: number,
  ) => {
    const ownershipCommand = plan.ownershipCommands[index];
    const cleanupCommand = plan.cleanupCommands[index];
    const absenceCommand = plan.absenceCommands[index];
    return ownershipCommand && cleanupCommand && absenceCommand
      ? { ownershipCommand, cleanupCommand, absenceCommand }
      : null;
  },
});

/**
 * 回復投影の不一致を清掃成功や名前指定削除へ丸めない。
 * @responsibility 保存ID不存在＋同名存在、構成差、null Receipt＋同名存在の拒否を反証する。
 * @trace ERB-UT-016
 * @precondition 保存投影とDocker結果を模擬する。実保存・実Dockerの成立は主張しない。
 * @stimulus 元probeの予定実IDと現在観測の三不一致を与える。
 * @observation 発行用途、回復参照と清掃結果。
 * @oracle probe削除0・fresh create0・cleanup falseで同じ回復参照を保持する。
 * @cleanup N/A: 局所値だけを生成する。
 * @boundary ERB-UT-016=Unit: 上位のexact清掃拒否。
 */
test("再認証回復は保存ID差・構成差・null Receiptの同名存在を削除しない", async () => {
  const id = "c".repeat(64);
  for (const scenario of ["replacement", "configuration", "null"] as const) {
    const purposes: string[] = [];
    const result = await authenticateClaudeSubscription(
      "C:\\fixture\\ProviderHomes\\claude",
      STABLE_LOGICAL_HOME_BINDING_HASH,
      {
        ...lifecycleDependencies,
        randomHex: () => token,
        beginRecovery: () => "existing_idle",
        recoveryCommands: (_record, plan, index) => {
          const normal = lifecycleDependencies.recoveryCommands(
            _record,
            plan,
            index,
          );
          if (!normal || index !== 0) return normal;
          if (scenario === "null")
            return {
              ownershipCommand: normal.absenceCommand,
              cleanupCommand: null,
              absenceCommand: normal.absenceCommand,
            };
          return {
            ownershipCommand: {
              purpose: "observe_probe_owner",
              argv: ["container", "inspect", id],
              interactive: false,
            },
            cleanupCommand: {
              purpose: "remove_probe",
              argv: ["rm", "--force", id],
              interactive: false,
            },
            identityAbsenceCommand: {
              purpose: "confirm_probe_id_absent",
              argv: ["container", "inspect", id],
              interactive: false,
            },
            absenceCommand: normal.absenceCommand,
          };
        },
        run: async (command) => {
          purposes.push(command.purpose);
          if (
            command.purpose === "observe_probe_owner" ||
            command.purpose === "confirm_probe_id_absent"
          )
            return scenario === "configuration"
              ? {
                  status: 0,
                  signal: null,
                  stdout: "",
                  stderr: "",
                  error: new Error(
                    "docker_authentication_configuration_unconfirmed",
                  ),
                  processCompletionConfirmed: true,
                }
              : {
                  status: 1,
                  signal: null,
                  stdout: "[]",
                  stderr: `Error: No such container: ${id}`,
                  processCompletionConfirmed: true,
                };
          if (command.purpose === "confirm_probe_absent")
            return {
              status: 0,
              signal: null,
              stdout: '[{"Id":"replacement"}]',
              stderr: "",
              processCompletionConfirmed: true,
            };
          return {
            status: 1,
            signal: null,
            stdout: "[]",
            stderr: absenceError(command.purpose),
            processCompletionConfirmed: true,
          };
        },
      },
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.cleanupConfirmed, false);
    assert.ok("manualRecoveryRequired" in result && "recoveryId" in result);
    assert.equal(result.manualRecoveryRequired, true);
    assert.equal(
      result.recoveryId,
      `claude-auth.${STABLE_LOGICAL_HOME_BINDING_HASH}`,
    );
    assert.equal(purposes.includes("remove_probe"), false);
    assert.equal(
      purposes.some((purpose) => purpose.startsWith("create_")),
      false,
    );
  }
});

/**
 * 作成Receiptの保存未確認時に次の操作とidle遷移を止める。
 * @responsibility Process closeと耐久Receipt確定を混同しない。
 * @trace ERB-UT-016
 * @precondition 元Intentを模擬し外部Processは開始しない。
 * @stimulus create成功後のReceipt保存を拒否する。
 * @observation Command列、Intentと公開結果を得る。
 * @oracle create一回だけ、in_flight保持、cleanup未完了、同じ回復参照を返す。
 * @cleanup N/A: 局所値だけの試験。
 * @boundary ERB-UT-016=Unit: 認証結果と既存耐久記録の保存確定。
 */
test("再認証は作成Receipt保存未確認でidleと次Effectを拒否する", async () => {
  const purposes: string[] = [];
  let state = "idle";
  const result = await authenticateClaudeSubscription(
    "C:\\fixture\\ProviderHomes\\claude",
    STABLE_LOGICAL_HOME_BINDING_HASH,
    {
      ...lifecycleDependencies,
      randomHex: () => token,
      setRecoveryCommandState: (_record, next) => {
        if (next === "in_flight" && state !== "idle") return false;
        state = next;
        return true;
      },
      recordCreatedResource: () => false,
      run: async (command) => {
        purposes.push(command.purpose);
        return {
          status: 0,
          signal: null,
          stdout: "c".repeat(64),
          stderr: "",
          processCompletionConfirmed: true,
        };
      },
    },
  );
  assert.equal(state, "in_flight");
  assert.deepEqual(purposes, ["create_internal_network"]);
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "claude_authentication_resource_receipt_unconfirmed",
  );
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
});

/**
 * Docker不存在を表す固定stderrを構築する。
 *
 * @responsibility 再認証単体試験の資源種別と固定不存在文を対応付ける。
 * @trace ERB-UT-016
 * @precondition purposeは固定認証Planの確認用途である。
 * @stimulus purposeから対象資源名とDocker不存在文を導く。
 * @observation NetworkまたはContainer用の固定stderrを返す。
 * @oracle 実装が受理するexact不存在形式と一致する。
 * @cleanup N/A: 外部資源を作成しない純粋fixtureである。
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
function absenceError(purpose: string) {
  const resource = purpose.includes("network")
    ? purpose.includes("internal")
      ? `crdd-internal-${AUTHENTICATION_SUFFIX}`
      : `crdd-egress-${AUTHENTICATION_SUFFIX}`
    : purpose.includes("probe")
      ? `crdd-auth-${AUTHENTICATION_SUFFIX}`
      : purpose.includes("login")
        ? `crdd-claude-${AUTHENTICATION_SUFFIX}`
        : `crdd-proxy-${AUTHENTICATION_SUFFIX}`;
  return purpose.includes("network")
    ? `Error response from daemon: network ${resource} not found`
    : `Error: No such container: ${resource}`;
}

/**
 * Docker所有Labelの固定観測出力を構築する。
 *
 * @responsibility 所有確認用途だけへ期待suffixを返すfixture境界を所有する。
 * @trace ERB-UT-016
 * @precondition purposeは固定認証Planの用途である。
 * @stimulus purposeが所有観測用途かを判定する。
 * @observation 所有観測ではsuffix行、それ以外では空文字列を返す。
 * @oracle 所有確認用途以外へ所有Labelを混入しない。
 * @cleanup N/A: 外部資源を作成しない純粋fixtureである。
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
function ownershipOutput(purpose: string) {
  return purpose.startsWith("observe_") ? `${AUTHENTICATION_SUFFIX}\n` : "";
}

/**
 * 秘密code入力前の固定案内が非表示と一回入力を明示することを検証する。
 *
 * @responsibility Human-only認証の誤った重複入力を防ぐ表示契約を検証する。
 * @trace ERB-UT-016
 * @precondition 案内は秘密値を受け取らない固定文字列である。
 * @stimulus 公開された入力案内を取得する。
 * @observation 非表示、一度だけ、結果まで再入力しないという三条件を観測する。
 * @oracle 三条件が同じ案内に存在し、秘密code値やProvider出力を補間しない。
 * @cleanup N/A: 固定文字列の検査で外部資源を作らない。
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("再認証は秘密codeの非表示と一回入力を事前案内する", () => {
  assert.match(
    CLAUDE_SUBSCRIPTION_AUTHENTICATION_INPUT_NOTICE,
    /画面に表示されません/u,
  );
  assert.match(
    CLAUDE_SUBSCRIPTION_AUTHENTICATION_INPUT_NOTICE,
    /一度だけ貼り付け/u,
  );
  assert.match(
    CLAUDE_SUBSCRIPTION_AUTHENTICATION_INPUT_NOTICE,
    /結果が出るまで再入力しない/u,
  );
});

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
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("再認証Planは専用Provider Home以外をmountしない", () => {
  const cli = describeClaudeSubscriptionAuthenticationCli();
  assert.deepEqual(cli.loginArgv, ["auth", "login", "--claudeai"]);
  assert.deepEqual(cli.statusArgv, ["auth", "status", "--json"]);
  assert.equal(cli.homeDirectoryName, "claude");
  assert.ok(Object.isFrozen(cli));
  assert.ok(Object.isFrozen(cli.loginArgv));
  assert.ok(Object.isFrozen(cli.statusArgv));
  assert.ok(Object.isFrozen(cli.environment));
  assert.deepEqual(cli.environment, {
    DISABLE_AUTOUPDATER: "1",
    DISABLE_UPDATES: "1",
    DISABLE_TELEMETRY: "1",
    DISABLE_ERROR_REPORTING: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  });
  const plan = createClaudeSubscriptionAuthenticationPlan(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    AUTHENTICATION_SUFFIX,
    token,
  );
  assert.ok(plan);
  const serialized = JSON.stringify(plan.commands);
  assert.match(serialized, /auth.*login.*--claudeai/u);
  assert.match(serialized, /auth.*status.*--json/u);
  assert.match(serialized, /--network=none/u);
  assert.match(serialized, /http:\/\/crdd:[a-f0-9]{64}@proxy:8080/u);
  assert.doesNotMatch(serialized, /proxy:18080/u);
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
 * 分離したClaude認証判定が四つの成立条件を保持することを検証する。
 *
 * @responsibility Provider固有の出力解釈を実行・回収の成功条件と混同しない。
 * @trace ERB-UT-016
 * @precondition 入力は未信頼なProbe出力文字列である。
 * @stimulus 正常値、各Propertyの不一致、欠落および不正JSONを渡す。
 * @observation 固定四条件の一致時だけtrueとなることを観測する。
 * @oracle 部分成立、別認証方式、別Offeringおよび解析不能を受理しない。
 * @cleanup N/A: 純粋判定だけを呼び外部資源を作成しない。
 * @boundary ERB-UT-016=Direct Boundary: Coordinator試験からAI AdapterのProbe判定。
 */
test("認証Probe判定は四条件の完全一致だけを受理する", () => {
  const confirmed = {
    loggedIn: true,
    authMethod: "claude.ai",
    apiProvider: "firstParty",
    subscriptionType: "max",
  };
  assert.equal(
    isClaudeSubscriptionAuthenticationConfirmed(JSON.stringify(confirmed)),
    true,
  );
  for (const [key, value] of Object.entries(confirmed)) {
    const missing = { ...confirmed } as Record<string, unknown>;
    delete missing[key];
    assert.equal(
      isClaudeSubscriptionAuthenticationConfirmed(JSON.stringify(missing)),
      false,
    );
    assert.equal(
      isClaudeSubscriptionAuthenticationConfirmed(
        JSON.stringify({
          ...confirmed,
          [key]: typeof value === "boolean" ? false : "other",
        }),
      ),
      false,
    );
  }
  for (const invalid of ["", "not-json", "null", "[]", "{}"]) {
    assert.equal(isClaudeSubscriptionAuthenticationConfirmed(invalid), false);
  }
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
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("再認証は事後Probeとcleanupの両方で完了する", async () => {
  const purposes: string[] = [];
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    STABLE_LOGICAL_HOME_BINDING_HASH,
    {
      ...lifecycleDependencies,
      randomHex: (bytes) => (bytes === 8 ? AUTHENTICATION_SUFFIX : token),
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
              : command.purpose.startsWith("confirm_")
                ? "[]\n"
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
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("再認証は途中失敗後にloginを開始せずcleanupする", async () => {
  const purposes: string[] = [];
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    STABLE_LOGICAL_HOME_BINDING_HASH,
    {
      ...lifecycleDependencies,
      randomHex: (bytes) => (bytes === 8 ? AUTHENTICATION_SUFFIX : token),
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
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("再認証はDocker観測失敗を資源不存在として受理しない", async () => {
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    STABLE_LOGICAL_HOME_BINDING_HASH,
    {
      ...lifecycleDependencies,
      randomHex: (bytes) => (bytes === 8 ? AUTHENTICATION_SUFFIX : token),
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
 * Docker不存在stderrに任意stdoutを組み合わせた結果を拒否することを検証する。
 *
 * @responsibility 空配列以外の観測内容を資源不存在へ畳まない境界を検証する。
 * @trace ERB-UT-016
 * @precondition 認証Probeは成功し、不存在確認の一件が正しいstderrと非空の任意stdoutを返す。
 * @stimulus 注入Process境界で認証Lifecycleを実行する。
 * @observation cleanup確認と公開結果を観測する。
 * @oracle 明示stderrがあっても任意stdoutを伴う結果はcleanup未確認になる。
 * @cleanup fixtureは外部資源を作らない。
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("再認証は空配列以外のstdoutを資源不存在として受理しない", async () => {
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    STABLE_LOGICAL_HOME_BINDING_HASH,
    {
      ...lifecycleDependencies,
      randomHex: (bytes) => (bytes === 8 ? AUTHENTICATION_SUFFIX : token),
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
            : command.purpose === "confirm_proxy_absent"
              ? '[{"unexpected":true}]'
              : "[]",
        stderr: command.purpose.startsWith("confirm_")
          ? absenceError(command.purpose)
          : "",
      }),
    },
  );
  assert.equal(result.status, "blocked");
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
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("再認証は同名の非所有Docker資源を削除しない", async () => {
  const purposes: string[] = [];
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    STABLE_LOGICAL_HOME_BINDING_HASH,
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
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("再認証はProvider Home Lock喪失後のEffectを停止する", async () => {
  const purposes: string[] = [];
  let isLive = true;
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    STABLE_LOGICAL_HOME_BINDING_HASH,
    {
      ...lifecycleDependencies,
      acquireProviderHomeLock: () => ({
        assertLive: () => isLive,
        release: () => false,
      }),
      randomHex: () => token,
      run: async (command) => {
        purposes.push(command.purpose);
        if (command.purpose === "start_proxy") isLive = false;
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
    `claude-auth.${STABLE_LOGICAL_HOME_BINDING_HASH}`,
  );
  assert.equal(result.manualRecoveryRequired, true);
});

/**
 * Process終了不明では後続Docker操作・Idle保存・Home解放をしない。
 * @responsibility 下位終了観測を認証Lifecycleの停止条件へ接続する。
 * @trace ERB-UT-016
 * @precondition 実Processを使わない下位結果Fixture。
 * @stimulus 最初の固定操作へ終了未確認を返す。
 * @observation 発行用途、保存状態、解放回数と公開回復結果。
 * @oracle 一回発行、in_flight保持、後続0、解放0、exact回復参照を保持。
 * @cleanup N/A: 実資源・Lockを取得しない。
 * @boundary 認証Lifecycleと下位Process結果。
 */
test("再認証はProcess終了不明で後続とIdle保存とHome解放を拒否する", async () => {
  const purposes: string[] = [];
  const states: string[] = [];
  let releases = 0;
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    STABLE_LOGICAL_HOME_BINDING_HASH,
    {
      ...lifecycleDependencies,
      randomHex: () => token,
      acquireProviderHomeLock: () => ({
        assertLive: () => true,
        release: () => {
          releases += 1;
          return true;
        },
      }),
      setRecoveryCommandState: (_record, state) => {
        states.push(state);
        return true;
      },
      run: async (command) => {
        purposes.push(command.purpose);
        return {
          status: null,
          signal: null,
          stdout: "",
          stderr: "",
          processCompletionConfirmed: false,
        };
      },
    },
  );
  assert.deepEqual(purposes, ["create_internal_network"]);
  assert.deepEqual(states, ["in_flight"]);
  assert.equal(releases, 0);
  assert.equal(
    result.reason,
    "claude_authentication_process_completion_unconfirmed",
  );
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.providerEffectIssued, true);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(
    result.recoveryId,
    `claude-auth.${STABLE_LOGICAL_HOME_BINDING_HASH}`,
  );
});

/**
 * 清掃の終了不明を同じ耐久Intentに保持する。
 * @responsibility remove／不存在観測も終了確認後だけidleへ戻す。
 * @trace ERB-UT-016
 * @precondition 状態記録とDocker結果の局所Fixture。
 * @stimulus 固定清掃用途へ未終了結果または例外を返す。
 * @observation 最後のin_flight用途、後続回数、完了保存とHome解放。
 * @oracle 後続0、in_flight保持、完了保存0、Home解放0、fresh再発行0。
 * @cleanup N/A: 実資源なし。
 * @boundary 清掃と既存回復記録。
 */
test("再認証は清掃removeと不存在観測の終了不明を耐久保持する", async () => {
  for (const target of ["remove_login", "confirm_proxy_absent"]) {
    for (const throws of [false, true]) {
      const calls: string[] = [];
      const states: Array<{ state: string; purpose: string | null }> = [];
      let releases = 0;
      let completed = 0;
      let state: "idle" | "in_flight" = "idle";
      const dependencies = {
        ...lifecycleDependencies,
        randomHex: () => token,
        beginRecovery: () =>
          state === "in_flight"
            ? ("existing_in_flight" as const)
            : ("created" as const),
        acquireProviderHomeLock: () => ({
          assertLive: () => true,
          release: () => {
            releases += 1;
            return true;
          },
        }),
        setRecoveryCommandState: (
          _record: unknown,
          next: "idle" | "in_flight",
          purpose: string | null,
        ) => {
          state = next;
          states.push({ state: next, purpose });
          return true;
        },
        completeRecovery: () => {
          completed += 1;
          return true;
        },
        run: async (command: { purpose: string }) => {
          calls.push(command.purpose);
          if (command.purpose === target) {
            if (throws) throw Error("unknown");
            return {
              status: null,
              signal: null,
              stdout: "",
              stderr: "",
              processCompletionConfirmed: false,
            };
          }
          if (command.purpose.startsWith("observe_"))
            return {
              status: 0,
              signal: null,
              stdout: AUTHENTICATION_SUFFIX,
              stderr: "",
              processCompletionConfirmed: true,
            };
          if (command.purpose.startsWith("confirm_"))
            return {
              status: 1,
              signal: null,
              stdout: "",
              stderr: absenceError(command.purpose),
              processCompletionConfirmed: true,
            };
          return {
            status: command.purpose === "create_internal_network" ? 1 : 0,
            signal: null,
            stdout: "",
            stderr: "",
            processCompletionConfirmed: true,
          };
        },
      };
      const result = await authenticateClaudeSubscription(
        "C:\\runtime-owned\\ProviderHomes\\claude",
        STABLE_LOGICAL_HOME_BINDING_HASH,
        dependencies,
      );
      assert.equal(calls.at(-1), target);
      assert.deepEqual(states.at(-1), { state: "in_flight", purpose: target });
      assert.equal(releases, 0);
      assert.equal(completed, 0);
      assert.equal(result.cleanupConfirmed, false);
      assert.ok("manualRecoveryRequired" in result);
      assert.equal(result.manualRecoveryRequired, true);
      const count = calls.length;
      const fresh = await authenticateClaudeSubscription(
        "C:\\runtime-owned\\ProviderHomes\\claude",
        STABLE_LOGICAL_HOME_BINDING_HASH,
        dependencies,
      );
      assert.equal(
        fresh.reason,
        "claude_authentication_prior_command_in_flight",
      );
      assert.equal(calls.length, count);
    }
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
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("再認証は回復在庫不明をcleanup完了へ畳まない", async () => {
  let runCount = 0;
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    STABLE_LOGICAL_HOME_BINDING_HASH,
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
    `claude-auth.${STABLE_LOGICAL_HOME_BINDING_HASH}`,
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
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("再認証は回復後の再入場失敗をcleanup完了へ畳まない", async () => {
  let beginCount = 0;
  let authenticationCommandCount = 0;
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    STABLE_LOGICAL_HOME_BINDING_HASH,
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
    `claude-auth.${STABLE_LOGICAL_HOME_BINDING_HASH}`,
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
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("再認証は最終不存在確認後のLock喪失でsettledを書かない", async () => {
  let isLive = true;
  let settlementCount = 0;
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    STABLE_LOGICAL_HOME_BINDING_HASH,
    {
      ...lifecycleDependencies,
      acquireProviderHomeLock: () => ({
        assertLive: () => isLive,
        release: () => false,
      }),
      completeRecovery: () => {
        settlementCount += 1;
        return true;
      },
      randomHex: () => token,
      run: async (command) => {
        if (command.purpose === "confirm_egress_network_absent") isLive = false;
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
    `claude-auth.${STABLE_LOGICAL_HOME_BINDING_HASH}`,
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
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("再認証は同じProvider Homeの後発操作をEffect前に拒否する", async () => {
  let runCount = 0;
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    STABLE_LOGICAL_HOME_BINDING_HASH,
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
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("再認証は耐久Intentから旧資源を回収してfresh Processで再入場する", async () => {
  const purposes: string[] = [];
  const journalEvents: string[] = [];
  let beginCount = 0;
  const result = await authenticateClaudeSubscription(
    "C:\\runtime-owned\\ProviderHomes\\claude",
    STABLE_LOGICAL_HOME_BINDING_HASH,
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
