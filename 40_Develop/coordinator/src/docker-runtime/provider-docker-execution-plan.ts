/**
 * Provider記述をCoordinatorの共通Docker実行計画へ結合する。
 *
 * @responsibility 選定・操作・Mountの相関検査と、固定資源・command構築の共通順序を所有する。
 * @trace ARCH-000015
 */
import {
  buildProviderDockerCommandPlan,
  createProviderDockerMount,
} from "./provider-docker-command-plan.ts";
import {
  createProviderDockerRandomHex,
  createProviderDockerResourceNames,
} from "./provider-docker-resource-plan.ts";
import type {
  ProviderDockerOperationBinding,
  ProviderDockerMountGrant,
  ProviderDockerModelSelection,
  ProviderDockerTaskPacket,
} from "./types.ts";
import {
  normalizeProviderExactModelId,
  prepareProviderFixedEnvironment,
} from "../../../ai-adapter/src/index.ts";
import {
  planCodexIsolatedTask,
  planCodexReadOnlyProbe,
  codexAdviceProviderInitRequired,
  describeCodexSubscriptionAuthenticationCli,
} from "../../../ai-adapter/src/codex/index.ts";
import {
  planClaudeIsolatedTask,
  planClaudeReadOnlyProbe,
  buildClaudeExecutionArguments,
  describeClaudeSubscriptionAuthenticationCli,
} from "../../../ai-adapter/src/claude/index.ts";
import { resolveFixedCodexExecutorSeccompProfile } from "../provider/codex-executor-seccomp.ts";
import { selectProviderModelCandidate } from "../provider/provider-model-selection-runtime.ts";
import { describeEgressProxyTopology } from "../external-send/egress-proxy-policy.ts";
import type { WorkbenchAiAdviceRuntimePacket } from "../workbench-ai/workbench-ai-advice-runtime-packet.ts";

const PROVIDER_HOME_DESTINATION = "/provider-home";
const TMP_DESTINATION = "/tmp";
const WORKSPACE_DESTINATION = "/work";
const codexAuthenticationCli = describeCodexSubscriptionAuthenticationCli();
const claudeAuthenticationCli = describeClaudeSubscriptionAuthenticationCli();

/**
 * 消費済みPacketとMountを固定ProviderのDocker計画へ結合する。
 *
 * @responsibility 両Providerの共通相関検査・資源命名・command構築を一箇所で行う。
 * @trace ARCH-000015
 * @input 固定Provider、乱数・Seccomp確認、操作・Grant、選定、二時刻、Taskまたは助言Packet、回復参照と本番組立てが固定した利用側。
 * @returns Providerで識別できる不変計画、または不成立時のnull。
 * @precondition 呼出し側がMountとPacketの取得・消費を完了している。
 * @postcondition 既存の選定Identity・Mount条件とProvider差を保ち、Docker要求を発行しない。
 * @effect 乱数を取得し、Codex Executor時だけ固定Seccomp Fileを既存確認操作で読む。
 * @failure 相関不一致や固定条件不足はnull、取得操作の例外は準備Ownerへ搬送する。
 * @invariant CLI固有計画はAI Adapterから取得し、Authorityを新設しない。
 * @boundary AI Adapterの固定記述とCoordinatorのMount・Egress・実行計画の接続境界。
 * @security 認証状態、選定、Packet、Mountと操作の結合を省略しない。
 * @concurrency 同期計画構築だけを行い、候補Storeの所有・一回消費は変更しない。
 */
export function buildProviderDockerExecutionPlan(
  provider: "codex" | "claude",
  state: Readonly<{
    randomBytes: (size: number) => Buffer;
    verifyExecutorSeccompProfile?: (
      expectedSha256: string,
      expectedBytes: number,
    ) => string | null;
  }>,
  binding: ProviderDockerOperationBinding,
  activation: Readonly<{
    grant: ProviderDockerMountGrant;
    activeMountCapability: object;
  }>,
  consumedModelSelection: ProviderDockerModelSelection,
  providerHomeSourcePath: string,
  preparedWallClockMs: number,
  preparedMonotonicMs: number,
  taskPacket: ProviderDockerTaskPacket | null,
  advicePacket: WorkbenchAiAdviceRuntimePacket | null,
  recoveryCorrelationId: string | null,
  consumer: "coordinator_cli" | "workbench" | "project_runtime",
) {
  if (
    consumer !== "coordinator_cli" &&
    consumer !== "workbench" &&
    consumer !== "project_runtime"
  )
    return null;
  const codex =
    provider === "codex"
      ? taskPacket
        ? planCodexIsolatedTask({
            provider,
            mode: "isolated_task",
            effort: consumedModelSelection.effort,
            taskRole: taskPacket.taskRole,
          })
        : planCodexReadOnlyProbe({
            provider,
            mode: "read_only_probe",
            effort: consumedModelSelection.effort,
          })
      : null;
  const claude =
    provider === "claude"
      ? taskPacket
        ? planClaudeIsolatedTask({
            provider,
            mode: "isolated_task",
            taskRole: taskPacket.taskRole,
            effort: consumedModelSelection.effort,
            taskWorkload: taskPacket.taskWorkload,
          })
        : planClaudeReadOnlyProbe({ provider, mode: "read_only_probe" })
      : null;
  const execution = codex ?? claude;
  const egress = describeEgressProxyTopology(provider);
  const selection = selectProviderModelCandidate(consumedModelSelection.basis);
  if (
    selection.status !== "candidate" ||
    selection.provider !== provider ||
    selection.speedMode !== "normal" ||
    !selection.selectionNotice ||
    consumedModelSelection.executorProvider !== provider ||
    consumedModelSelection.operationId !== binding.operationId ||
    consumedModelSelection.profileId !== activation.grant.profileId ||
    consumedModelSelection.effort !== selection.effort ||
    consumedModelSelection.modelTier !== selection.modelTier ||
    consumedModelSelection.speedMode !== selection.speedMode ||
    consumedModelSelection.selectionNotice.length === 0 ||
    !/^MODELSEL-[A-Z0-9-]{8,80}$/.test(
      consumedModelSelection.selectionRecordId,
    ) ||
    execution?.status !== "candidate" ||
    !normalizeProviderExactModelId(consumedModelSelection.model) ||
    (provider === "codex" &&
      (codex?.status !== "candidate" ||
        consumedModelSelection.model !==
          (advicePacket?.providerCommand.exactModelId ?? codex.exactModel))) ||
    execution.provider !== provider ||
    (taskPacket !== null && advicePacket !== null) ||
    (taskPacket !== null &&
      (taskPacket.operationId !== binding.operationId ||
        taskPacket.promptTransport !== "provider_stdin_only")) ||
    (advicePacket !== null &&
      (advicePacket.operationId !== binding.operationId ||
        advicePacket.profileId !== activation.grant.profileId ||
        advicePacket.provider !== provider ||
        advicePacket.providerCommand.provider !== provider ||
        (provider === "claude" &&
          advicePacket.providerCommand.exactModelId !==
            consumedModelSelection.model) ||
        advicePacket.providerCommand.reasoningEffort !==
          consumedModelSelection.effort ||
        advicePacket.repositoryMounted !== false ||
        advicePacket.workspaceMounted !== false ||
        advicePacket.toolsAllowed !== false ||
        advicePacket.sessionPersistenceAllowed !== false)) ||
    execution.distributionBinding.fixedDigestImageRequired !== true ||
    egress.providerNetworkInternal !== true ||
    egress.providerDirectExternalNetwork !== false ||
    egress.proxyNetworks.length !== 2
  ) {
    return null;
  }
  const fixedEnvironmentEntries =
    prepareProviderFixedEnvironment(
      provider,
      advicePacket?.providerCommand.environment ?? execution.environment,
    )?.flatMap(([name, value]) => ["--env", `${name}=${value}`]) ?? null;
  const executorSeccompProfile =
    provider === "codex" &&
    codex?.status === "candidate" &&
    taskPacket?.taskRole === "executor"
      ? (
          state.verifyExecutorSeccompProfile ??
          resolveFixedCodexExecutorSeccompProfile
        )(
          codex.distributionBinding.identity.executorSeccompProfileSha256,
          codex.distributionBinding.identity.executorSeccompProfileBytes,
        )
      : null;
  const providerHomeMount = createProviderDockerMount(
    providerHomeSourcePath,
    PROVIDER_HOME_DESTINATION,
  );
  const tmpMount = createProviderDockerMount(
    binding.mounts.tmp,
    TMP_DESTINATION,
  );
  const workspaceMount = taskPacket
    ? createProviderDockerMount(binding.mounts.workspace, WORKSPACE_DESTINATION)
    : null;
  const suffix = createProviderDockerRandomHex(state, 8);
  const proxyToken = createProviderDockerRandomHex(state, 32);
  if (
    !fixedEnvironmentEntries ||
    (provider === "codex" &&
      taskPacket?.taskRole === "executor" &&
      !executorSeccompProfile) ||
    !providerHomeMount ||
    !tmpMount ||
    (taskPacket !== null && !workspaceMount) ||
    !suffix ||
    !proxyToken
  ) {
    return null;
  }
  const resourceNames = createProviderDockerResourceNames(
    provider,
    activation.grant.providerHomeIdentityHash,
    suffix,
  );
  if (!resourceNames) return null;
  const {
    internalNetworkName,
    egressNetworkName,
    proxyContainerName,
    authContainerName,
    providerContainerName,
    ownershipLabel,
  } = resourceNames;
  const providerImageDigest =
    advicePacket?.providerCommand.fixedImageDigest ??
    execution.distributionBinding.fixedImageDigest;
  const proxyImageDigest = egress.verificationAdapter.imageDigest;
  const proxyUrl = `http://crdd:${proxyToken}@proxy:${egress.containerPort}`;
  const providerEnvironmentEntries = [
    "--env",
    `HOME=${PROVIDER_HOME_DESTINATION}`,
    "--env",
    `TMPDIR=${TMP_DESTINATION}`,
    "--env",
    `HTTPS_PROXY=${proxyUrl}`,
    ...(provider === "codex"
      ? [
          "--env",
          `HTTP_PROXY=${proxyUrl}`,
          "--env",
          `ALL_PROXY=${proxyUrl}`,
          "--env",
          "NO_PROXY=",
        ]
      : []),
    ...fixedEnvironmentEntries,
  ];
  const commands = buildProviderDockerCommandPlan({
    provider,
    authContainerName,
    providerContainerName,
    proxyContainerName,
    internalNetworkName,
    egressNetworkName,
    ownershipLabel,
    providerImageDigest,
    proxyImageDigest,
    providerHomeMount,
    tmpMount,
    workspaceMount,
    proxyToken,
    providerEnvironmentEntries,
    authenticationEnvironmentArguments:
      provider === "codex"
        ? [
            "--env",
            `${codexAuthenticationCli.homeEnvironmentVariable}=${PROVIDER_HOME_DESTINATION}`,
          ]
        : [],
    authenticationArgv:
      provider === "codex"
        ? codexAuthenticationCli.statusArgv
        : claudeAuthenticationCli.statusArgv,
    providerArgv:
      advicePacket?.providerCommand.argv ??
      (provider === "claude"
        ? buildClaudeExecutionArguments(
            consumedModelSelection.model,
            selection.effort,
            execution.argv,
          )
        : execution.argv),
    interactive: Boolean(taskPacket || advicePacket),
    taskRole: taskPacket?.taskRole ?? null,
    initRequired:
      provider === "codex" &&
      codexAdviceProviderInitRequired(
        advicePacket ? "workbench_advice" : "isolated_task",
        providerImageDigest,
      ),
    executorSeccompProfile,
  });
  const plan = {
    provider,
    operationId: binding.operationId,
    recoveryCorrelationId,
    consumer,
    grantRef: activation.grant.grantRef,
    profileId: activation.grant.profileId,
    activeMountCapability: activation.activeMountCapability,
    providerHomeSourcePath,
    providerHomeIdentityHash: activation.grant.providerHomeIdentityHash,
    providerHomeProtectionHash: activation.grant.providerHomeProtectionHash,
    localUserBindingHash: activation.grant.localUserBindingHash,
    stableLogicalHomeBindingHash: activation.grant.stableLogicalHomeBindingHash,
    preparedWallClockMs,
    preparedMonotonicMs,
    authContainerName,
    providerContainerName,
    proxyContainerName,
    internalNetworkName,
    egressNetworkName,
    ownershipLabel,
    providerImageDigest,
    proxyImageDigest,
    selectionRecordId: consumedModelSelection.selectionRecordId,
    subscriptionOffering:
      provider === "codex"
        ? ("chatgpt_subscription_oauth" as const)
        : ("claude_max" as const),
    selectedModel: consumedModelSelection.model,
    selectedEffort: selection.effort,
    selectedModelTier: selection.modelTier,
    selectionNotice: consumedModelSelection.selectionNotice,
    operationMode: taskPacket
      ? ("isolated_task" as const)
      : advicePacket
        ? ("workbench_advice" as const)
        : ("boolean_probe" as const),
    taskRole: taskPacket?.taskRole ?? null,
    taskPacketRef: taskPacket?.taskPacketRef ?? null,
    taskPacketHash: taskPacket?.taskPacketHash ?? null,
    advicePacketRef: advicePacket?.packetRef ?? null,
    advicePacketHash: advicePacket?.packetHash ?? null,
    adviceCommandHash: advicePacket?.commandHash ?? null,
    providerInput: taskPacket?.prompt ?? advicePacket?.providerPrompt ?? null,
    workspaceSourcePath: taskPacket ? binding.mounts.workspace : null,
    workspaceMountMode: taskPacket
      ? taskPacket.taskRole === "executor"
        ? ("read_write" as const)
        : ("read_only" as const)
      : null,
    commands,
  };
  return provider === "codex"
    ? Object.freeze({
        ...plan,
        provider: "codex" as const,
        subscriptionOffering: "chatgpt_subscription_oauth" as const,
      })
    : Object.freeze({
        ...plan,
        provider: "claude" as const,
        subscriptionOffering: "claude_max" as const,
        taskWorkload:
          claude && "taskWorkload" in claude ? claude.taskWorkload : null,
      });
}
