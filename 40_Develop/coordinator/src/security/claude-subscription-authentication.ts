/**
 * Claude専用Provider Homeの人手再認証Lifecycleを所有する。
 *
 * @responsibility 固定Claude Image、限定Proxy、Repository非接続、認証後Probeおよびexact cleanupを一つのLifecycleへ閉じる。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @trace ARCH-000010
 * @trace ARCH-000015
 */
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

import { describeClaudeExecutionPlanContract } from "./claude-execution-plan.ts";
import { describeEgressProxyTopology } from "./egress-proxy-policy.ts";

export const CLAUDE_SUBSCRIPTION_AUTHENTICATION_CONTRACT =
  "crdd-coordinator/claude-subscription-authentication";
export const CLAUDE_SUBSCRIPTION_AUTHENTICATION_CONTRACT_REVISION = 1;

type Command = Readonly<{
  purpose: string;
  argv: readonly string[];
  interactive: boolean;
}>;

export type ClaudeAuthenticationPlan = Readonly<{
  provider: "claude";
  providerHomeSourcePath: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  ownershipLabel: string;
  internalNetworkName: string;
  egressNetworkName: string;
  proxyContainerName: string;
  loginContainerName: string;
  probeContainerName: string;
  commands: readonly Command[];
  cleanupCommands: readonly Command[];
  absenceCommands: readonly Command[];
}>;

type Execution = Readonly<{
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error?: Error;
}>;

type Dependencies = Readonly<{
  randomHex: (bytes: number) => string;
  run: (command: Command) => Promise<Execution>;
}>;

const DEFAULT_DEPENDENCIES: Dependencies = Object.freeze({
  randomHex: (bytes) => randomBytes(bytes).toString("hex"),
  run: async (command) => {
    if (!command.interactive) {
      const result = spawnSync("docker", command.argv, {
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 30_000,
        maxBuffer: 1_048_576,
      });
      return Object.freeze({
        status: result.status,
        signal: result.signal,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        ...(result.error ? { error: result.error } : {}),
      });
    }
    return await new Promise<Execution>((resolve) => {
      const child = spawn("docker", command.argv, {
        stdio: "inherit",
        shell: false,
        windowsHide: false,
      });
      child.once("error", (error) =>
        resolve({ status: null, signal: null, stdout: "", stderr: "", error }),
      );
      child.once("exit", (status, signal) =>
        resolve({ status, signal, stdout: "", stderr: "" }),
      );
    });
  },
});

/**
 * Claude再認証の固定Docker Planを構築する。
 *
 * @responsibility 認証Effectを固定Image、限定Egressおよび専用Provider Homeだけへ制限する。
 * @trace ARCH-000010
 * @input providerHomeSourcePath: 検証済み専用Provider Homeの絶対Path、suffix: Runtime生成hex
 * @returns 検証済み入力では固定Plan、不正入力ではnullを返す。
 * @precondition providerHomeSourcePathはPlatform Accessが選択Userから導いたPathである。
 * @postcondition PlanにRepository mount、host network、API keyまたは任意Commandを含めない。
 * @effect N/A: Plan生成だけを行う。
 * @failure 不正Path、suffixまたは固定配布契約の不一致をnullへ閉じる。
 * @invariant Claude Maxの公式CLI認証とnetwork-noneの事後Probeだけを許可する。
 * @boundary Host Docker CLIへ渡す引数の生成境界。
 * @security Provider Home Pathを結果以外へ公開せず、秘密値を読まない。
 * @concurrency Operationごとに乱数suffixでDocker資源を分離する。
 */
export function createClaudeSubscriptionAuthenticationPlan(
  providerHomeSourcePath: string,
  suffix: string,
  proxyToken: string,
): ClaudeAuthenticationPlan | null {
  if (
    !/^[a-f0-9]{16}$/u.test(suffix) ||
    providerHomeSourcePath.length === 0 ||
    /[\0\r\n,]/u.test(providerHomeSourcePath) ||
    !/^[a-f0-9]{64}$/u.test(proxyToken)
  )
    return null;
  const claude = describeClaudeExecutionPlanContract();
  const egress = describeEgressProxyTopology("claude");
  const providerImageDigest = claude.distribution.binding.fixedImageDigest;
  const proxyImageDigest = egress.verificationAdapter.imageDigest;
  if (
    !/^sha256:[a-f0-9]{64}$/u.test(providerImageDigest) ||
    !/^sha256:[a-f0-9]{64}$/u.test(proxyImageDigest) ||
    egress.providerNetworkInternal !== true ||
    egress.providerDirectExternalNetwork !== false
  )
    return null;
  const internalNetworkName = `crdd-internal-${suffix}`;
  const egressNetworkName = `crdd-egress-${suffix}`;
  const proxyContainerName = `crdd-proxy-${suffix}`;
  const loginContainerName = `crdd-claude-${suffix}`;
  const probeContainerName = `crdd-auth-${suffix}`;
  const ownershipLabel = `crdd.coordinator.authentication=${suffix}`;
  const proxyUrl = `http://crdd:${proxyToken}@proxy:18080`;
  const homeMount = `type=bind,src=${providerHomeSourcePath},dst=/provider-home,bind-propagation=rprivate`;
  const fixedEnvironment = [
    "--env",
    "HOME=/provider-home",
    "--env",
    "TMPDIR=/tmp",
    "--env",
    `HTTPS_PROXY=${proxyUrl}`,
    "--env",
    "DISABLE_AUTOUPDATER=1",
    "--env",
    "DISABLE_UPDATES=1",
    "--env",
    "DISABLE_TELEMETRY=1",
    "--env",
    "DISABLE_ERROR_REPORTING=1",
    "--env",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1",
  ];
  const command = (
    purpose: string,
    argv: readonly string[],
    interactive = false,
  ) => Object.freeze({ purpose, argv: Object.freeze([...argv]), interactive });
  const commands = Object.freeze([
    command("create_internal_network", [
      "network",
      "create",
      "--driver=bridge",
      "--internal",
      "--label",
      ownershipLabel,
      internalNetworkName,
    ]),
    command("create_egress_network", [
      "network",
      "create",
      "--driver=bridge",
      "--label",
      ownershipLabel,
      egressNetworkName,
    ]),
    command("create_proxy", [
      "create",
      "--pull=never",
      "--network",
      internalNetworkName,
      "--network-alias",
      "proxy",
      "--read-only",
      "--name",
      proxyContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=64",
      "--user=65534:65534",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=16777216",
      "--env",
      `CRDD_PROXY_AUTH=${proxyToken}`,
      "--env",
      "CRDD_PROXY_PROFILE=claude",
      proxyImageDigest,
    ]),
    command("connect_proxy_egress", [
      "network",
      "connect",
      egressNetworkName,
      proxyContainerName,
    ]),
    command("start_proxy", ["start", proxyContainerName]),
    command("create_login", [
      "create",
      "--interactive",
      "--tty",
      "--pull=never",
      "--network",
      internalNetworkName,
      "--read-only",
      "--name",
      loginContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=64",
      "--user=65534:65534",
      "--workdir=/work",
      ...fixedEnvironment,
      "--mount",
      homeMount,
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=33554432",
      providerImageDigest,
      "auth",
      "login",
      "--claudeai",
    ]),
    command(
      "start_login_attached",
      ["start", "--attach", "--interactive", loginContainerName],
      true,
    ),
    command("create_probe", [
      "create",
      "--pull=never",
      "--network=none",
      "--read-only",
      "--name",
      probeContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=32",
      "--user=65534:65534",
      "--env",
      "HOME=/provider-home",
      "--mount",
      `${homeMount},readonly`,
      providerImageDigest,
      "auth",
      "status",
      "--json",
    ]),
    command("start_probe_attached", ["start", "--attach", probeContainerName]),
  ]);
  const cleanupCommands = Object.freeze([
    command("remove_probe", ["rm", "--force", probeContainerName]),
    command("remove_login", ["rm", "--force", loginContainerName]),
    command("remove_proxy", ["rm", "--force", proxyContainerName]),
    command("remove_internal_network", ["network", "rm", internalNetworkName]),
    command("remove_egress_network", ["network", "rm", egressNetworkName]),
  ]);
  const absenceCommands = Object.freeze([
    command("confirm_probe_absent", [
      "container",
      "inspect",
      probeContainerName,
    ]),
    command("confirm_login_absent", [
      "container",
      "inspect",
      loginContainerName,
    ]),
    command("confirm_proxy_absent", [
      "container",
      "inspect",
      proxyContainerName,
    ]),
    command("confirm_internal_network_absent", [
      "network",
      "inspect",
      internalNetworkName,
    ]),
    command("confirm_egress_network_absent", [
      "network",
      "inspect",
      egressNetworkName,
    ]),
  ]);
  return Object.freeze({
    provider: "claude",
    providerHomeSourcePath,
    providerImageDigest,
    proxyImageDigest,
    ownershipLabel,
    internalNetworkName,
    egressNetworkName,
    proxyContainerName,
    loginContainerName,
    probeContainerName,
    commands,
    cleanupCommands,
    absenceCommands,
  });
}

function probeConfirmed(stdout: string) {
  try {
    const value = JSON.parse(stdout) as Record<string, unknown>;
    return (
      value.loggedIn === true &&
      value.authMethod === "claude.ai" &&
      value.apiProvider === "firstParty" &&
      value.subscriptionType === "max"
    );
  } catch {
    return false;
  }
}

/**
 * Claude専用Provider Homeを人手で再認証する。
 *
 * @responsibility Planの順序実行、対話境界、事後認証確認およびexact cleanupを所有する。
 * @trace ARCH-000010
 * @input providerHomeSourcePath: 検証済み専用Provider Home、dependencies: Test差替え可能なProcess境界
 * @returns 秘密値や生Provider出力を含まない固定結果を返す。
 * @precondition 呼出し元が署名済み配布と対話端末を確認済みである。
 * @postcondition 成功はClaude Max認証確認と全Docker資源cleanup確認の両方を必要とする。
 * @effect Docker Process、Networkおよび専用Provider HomeのOAuth credentialを変更する。
 * @failure 任意段階の失敗を自動再試行せず、cleanup結果付きでblockedへ閉じる。
 * @invariant Repository、Workspace、host credentialおよびAPI keyを接続しない。
 * @boundary 人間端末、Docker Engine、限定Proxy、Claude認証Endpointの外部境界。
 * @security OAuth対話はTTYへ直接接続し、生出力、token、URLまたはPathを結果へ保存しない。
 * @concurrency Docker資源をOperation固有suffixで分離し、終了時にexact nameだけを清掃する。
 */
export async function authenticateClaudeSubscription(
  providerHomeSourcePath: string,
  dependencies: Dependencies = DEFAULT_DEPENDENCIES,
) {
  const suffix = dependencies.randomHex(8);
  const proxyToken = dependencies.randomHex(32);
  const plan = createClaudeSubscriptionAuthenticationPlan(
    providerHomeSourcePath,
    suffix,
    proxyToken,
  );
  if (!plan)
    return Object.freeze({
      status: "blocked",
      reason: "claude_authentication_plan_invalid",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  let reason = "claude_subscription_authentication_completed";
  let completed = false;
  let providerEffectIssued = false;
  try {
    for (const command of plan.commands) {
      const result = await dependencies.run(command);
      providerEffectIssued = true;
      if (result.error || result.signal !== null || result.status !== 0) {
        reason = `claude_authentication_${command.purpose}_failed`;
        break;
      }
      if (command.purpose === "start_probe_attached") {
        if (!probeConfirmed(result.stdout)) {
          reason = "claude_subscription_authentication_not_confirmed";
          break;
        }
        completed = true;
      }
    }
  } catch {
    reason = "claude_subscription_authentication_failed_closed";
  }
  let cleanupConfirmed = true;
  for (const command of plan.cleanupCommands) {
    try {
      const result = await dependencies.run(command);
      // rm/network rm return non-zero when an earlier create never occurred.
      if (result.error || result.signal !== null) cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
  }
  for (const command of plan.absenceCommands) {
    try {
      const result = await dependencies.run(command);
      if (result.error || result.signal !== null || result.status === 0)
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
  }
  return Object.freeze({
    contract: CLAUDE_SUBSCRIPTION_AUTHENTICATION_CONTRACT,
    contractRevision: CLAUDE_SUBSCRIPTION_AUTHENTICATION_CONTRACT_REVISION,
    status: completed && cleanupConfirmed ? "completed" : "blocked",
    reason:
      completed && cleanupConfirmed
        ? "claude_subscription_authentication_completed"
        : reason,
    provider: "claude",
    offering: "claude_max",
    humanInteractive: true,
    repositoryMounted: false,
    workspaceMounted: false,
    providerEffectIssued,
    authenticationConfirmed: completed,
    cleanupConfirmed,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}
