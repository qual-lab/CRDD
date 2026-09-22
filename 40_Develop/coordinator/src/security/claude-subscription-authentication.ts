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
import fs from "node:fs";
import path from "node:path";

import { describeClaudeExecutionPlanContract } from "./claude-execution-plan.ts";
import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "./candidate-store-kernel-lock.ts";
import {
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "./docker-cli-trust.ts";
import { createDockerProcessEnvironment } from "./docker-owned-process.ts";
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
  acquireProviderHomeLock: (
    identityHash: string,
  ) => Readonly<{ release: () => boolean }> | null;
  beginRecovery: (
    record: AuthenticationRecoveryRecord,
  ) => "created" | "existing" | "unknown";
  completeRecovery: (record: AuthenticationRecoveryRecord) => boolean;
}>;

type AuthenticationRecoveryRecord = Readonly<{
  contract: "crdd-coordinator/claude-subscription-authentication-recovery";
  contractRevision: 1;
  recoveryId: string;
  stableLogicalHomeBindingHash: string;
  suffix: string;
  resourceNames: readonly string[];
  recordPath: string;
}>;

function recoveryRecord(
  providerHomeSourcePath: string,
  stableLogicalHomeBindingHash: string,
  plan: ClaudeAuthenticationPlan,
): AuthenticationRecoveryRecord | null {
  if (
    !/^[a-f0-9]{64}$/u.test(stableLogicalHomeBindingHash) ||
    path.win32.basename(providerHomeSourcePath).toLowerCase() !== "claude" ||
    path.win32.basename(path.win32.dirname(providerHomeSourcePath)) !==
      "ProviderHomes"
  )
    return null;
  const runtimeRoot = path.win32.dirname(
    path.win32.dirname(providerHomeSourcePath),
  );
  const recordPath = path.win32.join(
    runtimeRoot,
    "Recovery",
    "claude-subscription-authentication",
    `${stableLogicalHomeBindingHash}.json`,
  );
  return Object.freeze({
    contract: "crdd-coordinator/claude-subscription-authentication-recovery",
    contractRevision: 1,
    recoveryId: `claude-auth.${stableLogicalHomeBindingHash}`,
    stableLogicalHomeBindingHash,
    suffix: plan.internalNetworkName.slice("crdd-internal-".length),
    resourceNames: Object.freeze([
      plan.probeContainerName,
      plan.loginContainerName,
      plan.proxyContainerName,
      plan.internalNetworkName,
      plan.egressNetworkName,
    ]),
    recordPath,
  });
}

function sameRecoveryRecord(
  value: unknown,
  expected: AuthenticationRecoveryRecord,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.contract === expected.contract &&
    record.contractRevision === expected.contractRevision &&
    record.recoveryId === expected.recoveryId &&
    record.stableLogicalHomeBindingHash ===
      expected.stableLogicalHomeBindingHash &&
    record.suffix === expected.suffix &&
    Array.isArray(record.resourceNames) &&
    record.resourceNames.length === expected.resourceNames.length &&
    record.resourceNames.every(
      (name, index) => name === expected.resourceNames[index],
    )
  );
}

function beginProductionRecovery(record: AuthenticationRecoveryRecord) {
  try {
    const temporary = `${record.recordPath}.pending`;
    if (fs.existsSync(record.recordPath)) {
      const existing = JSON.parse(
        fs.readFileSync(record.recordPath, "utf8"),
      ) as unknown;
      return sameRecoveryRecord(existing, record) ? "existing" : "unknown";
    }
    fs.mkdirSync(path.win32.dirname(record.recordPath), { recursive: true });
    if (fs.existsSync(temporary)) {
      const pending = JSON.parse(fs.readFileSync(temporary, "utf8")) as unknown;
      if (!sameRecoveryRecord(pending, record)) return "unknown";
      fs.renameSync(temporary, record.recordPath);
      return "existing";
    }
    fs.writeFileSync(
      temporary,
      `${JSON.stringify({
        contract: record.contract,
        contractRevision: record.contractRevision,
        recoveryId: record.recoveryId,
        stableLogicalHomeBindingHash: record.stableLogicalHomeBindingHash,
        suffix: record.suffix,
        resourceNames: record.resourceNames,
      })}\n`,
      { encoding: "utf8", flag: "wx", flush: true },
    );
    fs.renameSync(temporary, record.recordPath);
    return "created";
  } catch {
    return "unknown";
  }
}

function completeProductionRecovery(record: AuthenticationRecoveryRecord) {
  try {
    const existing = JSON.parse(
      fs.readFileSync(record.recordPath, "utf8"),
    ) as unknown;
    if (!sameRecoveryRecord(existing, record)) return false;
    fs.unlinkSync(record.recordPath);
    return !fs.existsSync(record.recordPath);
  } catch {
    return false;
  }
}

function createProductionDependencies(): Dependencies {
  const dockerCli = observeTrustedDockerCli();
  const environment = createDockerProcessEnvironment();
  return Object.freeze({
    randomHex: (bytes) => randomBytes(bytes).toString("hex"),
    acquireProviderHomeLock: acquireRuntimeOwnedLogicalProviderHomeKernelLock,
    beginRecovery: beginProductionRecovery,
    completeRecovery: completeProductionRecovery,
    run: async (command) => {
      const executable = verifyTrustedDockerCliSnapshot(dockerCli);
      if (!command.interactive) {
        const result = spawnSync(executable, command.argv, {
          encoding: "utf8",
          env: environment,
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
        const child = spawn(executable, command.argv, {
          env: environment,
          stdio: "inherit",
          shell: false,
          windowsHide: false,
        });
        child.once("error", (error) =>
          resolve({
            status: null,
            signal: null,
            stdout: "",
            stderr: "",
            error,
          }),
        );
        child.once("exit", (status, signal) =>
          resolve({ status, signal, stdout: "", stderr: "" }),
        );
      });
    },
  });
}

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

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function explicitDockerAbsence(command: Command, result: Execution) {
  if (
    result.error ||
    result.signal !== null ||
    result.status !== 1 ||
    result.stdout.trim().length !== 0
  )
    return false;
  const resourceName = command.argv.at(-1);
  if (!resourceName) return false;
  const exactName = escapeRegularExpression(resourceName);
  const normalized = result.stderr.trim();
  if (command.purpose.includes("network"))
    return new RegExp(
      `^(?:Error response from daemon: )?(?:network ${exactName} not found|No such network: ${exactName})$`,
      "u",
    ).test(normalized);
  return new RegExp(
    `^(?:(?:Error response from daemon|Error): )?No such (?:object|container): ${exactName}$`,
    "u",
  ).test(normalized);
}

async function cleanAuthenticationResources(
  plan: ClaudeAuthenticationPlan,
  dependencies: Dependencies,
) {
  let cleanupConfirmed = true;
  for (const command of plan.cleanupCommands) {
    try {
      const result = await dependencies.run(command);
      // An uncreated resource may make removal fail; exact observation below
      // is the authority for absence.
      if (result.error || result.signal !== null) cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
  }
  for (const command of plan.absenceCommands) {
    try {
      const result = await dependencies.run(command);
      if (!explicitDockerAbsence(command, result)) cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
  }
  return cleanupConfirmed;
}

/**
 * Claude専用Provider Homeを人手で再認証する。
 *
 * @responsibility Planの順序実行、対話境界、事後認証確認およびexact cleanupを所有する。
 * @trace ARCH-000010
 * @input providerHomeSourcePath: 検証済み専用Provider Home、stableLogicalHomeBindingHash: Provider Homeの安定Identity、dependencies: Test差替え可能なProcess境界
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
  stableLogicalHomeBindingHash: string,
  dependencies?: Dependencies,
) {
  let activeDependencies: Dependencies;
  try {
    activeDependencies = dependencies ?? createProductionDependencies();
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "claude_authentication_docker_boundary_unavailable",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  }
  if (!/^[a-f0-9]{64}$/u.test(stableLogicalHomeBindingHash))
    return Object.freeze({
      status: "blocked",
      reason: "claude_authentication_provider_home_identity_invalid",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  const providerHomeLock = activeDependencies.acquireProviderHomeLock(
    stableLogicalHomeBindingHash,
  );
  if (!providerHomeLock)
    return Object.freeze({
      status: "blocked",
      reason: "claude_authentication_provider_home_active_or_unknown",
      cleanupConfirmed: true,
      providerEffectIssued: false,
    });
  const suffix = stableLogicalHomeBindingHash.slice(0, 16);
  const proxyToken = activeDependencies.randomHex(32);
  const plan = createClaudeSubscriptionAuthenticationPlan(
    providerHomeSourcePath,
    suffix,
    proxyToken,
  );
  const recovery = plan
    ? recoveryRecord(providerHomeSourcePath, stableLogicalHomeBindingHash, plan)
    : null;
  if (!plan || !recovery) {
    const lockReleased = providerHomeLock.release();
    return Object.freeze({
      status: "blocked",
      reason: "claude_authentication_plan_invalid",
      cleanupConfirmed: lockReleased,
      providerEffectIssued: false,
    });
  }
  let recoveryState = activeDependencies.beginRecovery(recovery);
  if (recoveryState === "unknown") {
    const lockReleased = providerHomeLock.release();
    return Object.freeze({
      status: "blocked",
      reason: "claude_authentication_recovery_inventory_unknown",
      cleanupConfirmed: lockReleased,
      providerEffectIssued: false,
      recoveryId: recovery.recoveryId,
      manualRecoveryRequired: true,
      effectStateUnknown: true,
    });
  }
  if (recoveryState === "existing") {
    const recovered = await cleanAuthenticationResources(
      plan,
      activeDependencies,
    );
    if (!recovered || !activeDependencies.completeRecovery(recovery)) {
      const lockReleased = providerHomeLock.release();
      return Object.freeze({
        status: "blocked",
        reason: "claude_authentication_recovery_unconfirmed",
        cleanupConfirmed: recovered && lockReleased,
        providerEffectIssued: false,
        recoveryId: recovery.recoveryId,
        manualRecoveryRequired: true,
        effectStateUnknown: true,
      });
    }
    recoveryState = activeDependencies.beginRecovery(recovery);
    if (recoveryState !== "created") {
      const lockReleased = providerHomeLock.release();
      return Object.freeze({
        status: "blocked",
        reason: "claude_authentication_recovery_reentry_failed",
        cleanupConfirmed: lockReleased,
        providerEffectIssued: false,
        recoveryId: recovery.recoveryId,
        manualRecoveryRequired: true,
        effectStateUnknown: false,
      });
    }
  }
  let reason = "claude_subscription_authentication_completed";
  let completed = false;
  let providerEffectIssued = false;
  try {
    for (const command of plan.commands) {
      const result = await activeDependencies.run(command);
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
  let cleanupConfirmed = await cleanAuthenticationResources(
    plan,
    activeDependencies,
  );
  if (cleanupConfirmed)
    cleanupConfirmed = activeDependencies.completeRecovery(recovery);
  const lockReleased = providerHomeLock.release();
  cleanupConfirmed = cleanupConfirmed && lockReleased;
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
    recoveryId: cleanupConfirmed ? null : recovery.recoveryId,
    manualRecoveryRequired: !cleanupConfirmed,
    effectStateUnknown: !cleanupConfirmed,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}
