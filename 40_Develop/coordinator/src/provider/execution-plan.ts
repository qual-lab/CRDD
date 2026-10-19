/**
 * Provider記述と操作相関をDocker Isolationの技術計画へ接続する。
 *
 * @responsibility 選定・操作・Mountを照合し、同じ乱数Ownerの取得順とDIの固定技術計画を結合する。
 * @trace ARCH-000015
 */
import {
  planDockerIsolationCommands,
  codexAdviceProviderInitRequired,
  createDockerIsolationRandomHex,
  createDockerIsolationResourceNames,
} from "../../../docker-isolation/src/index.ts";
import type {
  ProviderDockerOperationBinding,
  ProviderDockerMountGrant,
  ProviderDockerModelSelection,
  ProviderDockerTaskPacket,
} from "./execution-types.ts";
import {
  validateProviderModelId,
  prepareProviderEnvironment,
} from "../../../ai-adapter/src/index.ts";
import {
  planProviderExecution,
  describeProviderAuthentication,
} from "../../../ai-adapter/src/index.ts";
import { createDockerAuthenticationEnvironment } from "../../../docker-isolation/src/index.ts";
import { selectProviderModelCandidate } from "./model-selection.ts";
import { describeEgressProxyTopology } from "../external-send/egress-proxy-policy.ts";
import type { WorkbenchAiAdviceRuntimePacket } from "../workbench-ai/advice-packet.ts";
import {
  describeDockerProviderAssets,
  describeDockerProviderExecutionLocations,
} from "../../../docker-isolation/src/index.ts";

const codexAuthenticationCli = describeProviderAuthentication("codex");
const claudeAuthenticationCli = describeProviderAuthentication("claude");

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
  consumer: "coordinator_cli" | "workbench" | "orchestrator",
) {
  if (
    consumer !== "coordinator_cli" &&
    consumer !== "workbench" &&
    consumer !== "orchestrator"
  )
    return null;
  const generated = planProviderExecution(
    {
      provider,
      purpose: taskPacket ? "task" : "probe",
      input: taskPacket
        ? {
            provider,
            mode: "isolated_task",
            effort: consumedModelSelection.effort,
            taskRole: taskPacket.taskRole,
            ...(provider === "claude"
              ? { taskWorkload: taskPacket.taskWorkload }
              : {}),
          }
        : {
            provider,
            mode: "read_only_probe",
            ...(provider === "codex"
              ? { effort: consumedModelSelection.effort }
              : {}),
          },
      ...(advicePacket
        ? {}
        : {
            modelSelection: {
              provider,
              exactModelId: consumedModelSelection.model,
              reasoningEffort: consumedModelSelection.effort,
            },
          }),
    },
    describeDockerProviderExecutionLocations(
      provider,
      taskPacket ? "task" : "probe",
    ),
  );
  if (generated.status !== "ready") return null;
  const execution = generated.plan;
  const assets = describeDockerProviderAssets(provider);
  const codexAssets = describeDockerProviderAssets("codex");
  const codex = execution.provider === "codex" ? execution : null;
  const claude = execution.provider === "claude" ? execution : null;
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
    !validateProviderModelId(consumedModelSelection.model).value ||
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
    assets.fixedDigestImageRequired !== true ||
    egress.providerNetworkInternal !== true ||
    egress.providerDirectExternalNetwork !== false ||
    egress.proxyNetworks.length !== 2
  ) {
    return null;
  }
  const fixedEnvironment = prepareProviderEnvironment(
    provider,
    advicePacket?.providerCommand.environment ?? execution.environment,
  );
  const executorSeccompProfile =
    provider === "codex" &&
    codex?.status === "candidate" &&
    taskPacket?.taskRole === "executor"
      ? {
          sha256: codexAssets.identity.executorSeccompProfileSha256,
          bytes: codexAssets.identity.executorSeccompProfileBytes,
        }
      : null;
  const suffix = createDockerIsolationRandomHex(state, 8);
  const proxyToken = createDockerIsolationRandomHex(state, 32);
  if (
    fixedEnvironment.status !== "ready" ||
    (provider === "codex" &&
      taskPacket?.taskRole === "executor" &&
      !executorSeccompProfile) ||
    !suffix ||
    !proxyToken
  ) {
    return null;
  }
  const resourceNames = createDockerIsolationResourceNames(
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
    advicePacket?.providerCommand.fixedImageDigest ?? assets.fixedImageDigest;
  const proxyImageDigest = egress.verificationAdapter.imageDigest;
  const authenticationEnvironment = createDockerAuthenticationEnvironment(
    provider === "codex"
      ? codexAuthenticationCli.homeEnvironmentVariable
      : null,
  );
  if (!authenticationEnvironment) return null;
  const commands = planDockerIsolationCommands({
    authenticationContainerName: authContainerName,
    executionContainerName: providerContainerName,
    proxyContainerName,
    internalNetworkName,
    egressNetworkName,
    ownershipLabel,
    executionImageDigest: providerImageDigest,
    proxyImageDigest,
    homeSourcePath: providerHomeSourcePath,
    temporarySourcePath: binding.mounts.tmp,
    workspace: taskPacket
      ? {
          sourcePath: binding.mounts.workspace,
          readOnly: taskPacket.taskRole === "reviewer",
          ...(binding.workspaceProtection
            ? { protection: binding.workspaceProtection }
            : {}),
        }
      : null,
    authentication: {
      argv:
        provider === "codex"
          ? codexAuthenticationCli.statusArgv
          : claudeAuthenticationCli.statusArgv,
      environment: authenticationEnvironment,
    },
    execution: {
      argv: advicePacket?.providerCommand.argv ?? execution.argv,
      environment: Object.fromEntries(fixedEnvironment.entries),
      interactive: Boolean(taskPacket || advicePacket),
      initRequired:
        provider === "codex" &&
        codexAdviceProviderInitRequired(
          advicePacket ? "workbench_advice" : "isolated_task",
          providerImageDigest,
        ),
      seccompProfile: executorSeccompProfile,
    },
    proxy: {
      profile: provider,
      token: proxyToken,
      port: egress.containerPort,
      extendedProxyEnvironment: provider === "codex",
    },
  });
  if (!commands) return null;
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
    ...(binding.workspaceProtection
      ? { workspaceProtection: binding.workspaceProtection }
      : {}),
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
