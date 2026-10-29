/**
 * 選定済みProvider入力を固定Docker計画へ投影する。
 * @packageDocumentation
 * @responsibility Task進行・保存を持たず、元Capabilityの消費と技術構成だけを扱う。
 * @trace ARCH-000008
 * @trace ARCH-000015
 */
import { inspectExecutionSelection } from "../../../domain-model/src/index.ts";
import { hashExecutionSelection } from "../../../domain-model/src/index.ts";
import {
  type DockerNetworkPolicy,
  type DockerIsolationCommandInput,
  describeDockerProviderExecutionLocations,
  describeDockerProviderAssets,
  describeDockerProxyTopology,
  projectDockerProxyConfiguration,
  createDockerAuthenticationEnvironment,
  codexAdviceProviderInitRequired,
  dockerIsolationResourceIdentityIsValid,
  dockerIsolationCommandsMatch,
  createDockerIsolationRandomHex,
  createDockerIsolationResourceNames,
  planDockerIsolationCommands,
} from "../../../docker-isolation/src/index.ts";
import {
  planProviderExecution,
  resolveAiModelSelection,
  describeProviderAuthentication,
  validateProviderModelId,
  prepareProviderEnvironment,
  type ProviderAdvicePlan,
} from "../../../ai-adapter/src/index.ts";
import { describeAdviceResultSchema } from "../result/advice.ts";
import { createHash } from "node:crypto";
import type {
  PreparedPlan,
  ProviderAdvicePacket,
  ProviderAdviceCommand,
  ProviderDockerModelSelection,
  ProviderDockerTaskPacket,
  ProviderDockerOperationBinding,
  ProviderDockerMountGrant,
} from "./types.ts";

const PROVIDER_INPUT_LIMIT_BYTES = 128 * 1024;

/**
 * expected Commandsを決定する。
 *
 * @responsibility expected Commandsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input plan: PreparedPlan、tmpSourcePath: string
 * @returns readonly Command[] | nullを返す。
 * @precondition 「plan: PreparedPlan、tmpSourcePath: string」がexpectedCommandsの入力契約を満たす。
 * @postcondition expectedCommandsの責務を完了した結果だけを返す。
 * @effect N/A: expectedCommandsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: expectedCommandsは独自の失敗分岐を所有しない。
 * @invariant expectedCommandsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: expectedCommandsはProcess内の同一Subsystemで完結する。
 * @security expectedCommandsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: expectedCommandsは共有非同期状態を持たない同期処理である。
 */
export function resolveIsolationCommandInput(
  plan: PreparedPlan,
  tmpSourcePath: string,
): DockerIsolationCommandInput | null {
  const selected = resolveAiModelSelection({
    provider: plan.provider,
    modelIdentifier: plan.selectedModel,
    reasoningEffort: plan.selectedEffort,
    purpose: plan.operationMode === "isolated_task" ? "task" : "advice",
  });
  if (plan.operationMode !== "boolean_probe" && selected.status !== "resolved")
    return null;
  const adviceResult =
    plan.operationMode === "workbench_advice" && selected.status === "resolved"
      ? planProviderExecution(
          {
            provider: plan.provider,
            purpose: "advice",
            modelSelection: {
              provider: selected.value.provider,
              modelIdentifier: selected.value.modelIdentifier,
              identifierKind: selected.value.identifierKind,
              reasoningEffort: selected.value.reasoningEffort,
            },
            resultSchema: describeAdviceResultSchema(),
          },
          describeDockerProviderExecutionLocations(plan.provider, "advice"),
        )
      : null;
  if (adviceResult?.status === "blocked") return null;
  const adviceCommand =
    adviceResult?.status === "ready"
      ? bindProviderAdviceCommand(adviceResult.plan, plan.networkPolicy)
      : null;
  const generated =
    plan.operationMode === "isolated_task" && selected.status === "resolved"
      ? planProviderExecution(
          {
            provider: plan.provider,
            purpose: "task",
            input: {
              provider: plan.provider,
              mode: "isolated_task",
              taskRole: plan.taskRole,
              effort: plan.selectedEffort,
              ...(plan.provider === "claude"
                ? { taskWorkload: plan.taskWorkload }
                : {}),
            },
            modelSelection: {
              provider: selected.value.provider,
              modelIdentifier: selected.value.modelIdentifier,
              identifierKind: selected.value.identifierKind,
              reasoningEffort: selected.value.reasoningEffort,
            },
          },
          describeDockerProviderExecutionLocations(plan.provider, "task"),
        )
      : planProviderExecution(
          {
            provider: plan.provider,
            purpose: "probe",
            input: {
              provider: plan.provider,
              mode: "read_only_probe",
              ...(plan.provider === "codex"
                ? { effort: plan.selectedEffort }
                : {}),
            },
          },
          describeDockerProviderExecutionLocations(plan.provider, "probe"),
        );
  if (generated.status !== "ready") return null;
  const providerPlan = generated.plan;
  const assets = describeDockerProviderAssets(plan.provider);
  const egress = describeDockerProxyTopology(plan.provider);
  if (
    providerPlan.status !== "candidate" ||
    egress.imageDigest !== plan.proxyImageDigest ||
    (adviceCommand?.fixedImageDigest ?? assets.fixedImageDigest) !==
      plan.providerImageDigest
  ) {
    return null;
  }
  const proxy = projectDockerProxyConfiguration(
    plan.commands,
    plan.proxyImageDigest,
  );
  if (
    !proxy ||
    proxy.profile !== plan.provider ||
    JSON.stringify(proxy.networkPolicy) !== JSON.stringify(plan.networkPolicy)
  ) {
    return null;
  }
  const providerIdentity = assets.identity;
  const authenticationEnvironment = createDockerAuthenticationEnvironment(
    plan.provider === "codex"
      ? describeProviderAuthentication("codex").homeEnvironmentVariable
      : null,
  );
  if (!authenticationEnvironment) return null;
  const codexSeccompIdentity =
    "executorSeccompProfileSha256" in providerIdentity &&
    "executorSeccompProfileBytes" in providerIdentity
      ? providerIdentity
      : null;
  const codexExecutorSeccompProfile =
    plan.provider === "codex" &&
    plan.operationMode === "isolated_task" &&
    plan.taskRole === "executor" &&
    codexSeccompIdentity
      ? {
          sha256: codexSeccompIdentity.executorSeccompProfileSha256,
          bytes: codexSeccompIdentity.executorSeccompProfileBytes,
        }
      : null;
  if (
    plan.provider === "codex" &&
    plan.operationMode === "isolated_task" &&
    plan.taskRole === "executor" &&
    !codexExecutorSeccompProfile
  ) {
    return null;
  }
  return {
    authenticationContainerName: plan.authContainerName,
    executionContainerName: plan.providerContainerName,
    proxyContainerName: plan.proxyContainerName,
    internalNetworkName: plan.internalNetworkName,
    egressNetworkName: plan.egressNetworkName,
    ownershipLabel: plan.ownershipLabel,
    executionImageDigest: plan.providerImageDigest,
    proxyImageDigest: plan.proxyImageDigest,
    homeSourcePath: plan.providerHomeSourcePath,
    temporarySourcePath: tmpSourcePath,
    workspace:
      plan.operationMode === "isolated_task" && plan.workspaceSourcePath
        ? {
            sourcePath: plan.workspaceSourcePath,
            readOnly: plan.workspaceMountMode === "read_only",
            ...(plan.workspaceProtection
              ? { protection: plan.workspaceProtection }
              : {}),
          }
        : null,
    authentication: {
      argv:
        plan.provider === "codex"
          ? describeProviderAuthentication("codex").statusArgv
          : describeProviderAuthentication("claude").statusArgv,
      environment: authenticationEnvironment,
    },
    execution: {
      argv: adviceCommand?.argv ?? providerPlan.argv,
      environment: adviceCommand?.environment ?? providerPlan.environment,
      interactive:
        plan.operationMode === "isolated_task" || adviceCommand !== null,
      initRequired: codexAdviceProviderInitRequired(
        plan.operationMode,
        plan.providerImageDigest,
      ),
      seccompProfile: codexExecutorSeccompProfile,
    },
    proxy: {
      profile: plan.provider,
      token: proxy.token,
      port: egress.containerPort,
      extendedProxyEnvironment: plan.provider === "codex",
      networkPolicy: proxy.networkPolicy,
    },
  };
}

/**
 * Planの契約を検証する。
 *
 * @responsibility Planの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input plan: PreparedPlan、tmpSourcePath: string
 * @returns validatePlanの計算結果を返す。
 * @precondition 「plan: PreparedPlan、tmpSourcePath: string」がvalidatePlanの入力契約を満たす。
 * @postcondition validatePlanの責務を完了した結果だけを返す。
 * @effect N/A: validatePlanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validatePlanは独自の失敗分岐を所有しない。
 * @invariant validatePlanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validatePlanはProcess内の同一Subsystemで完結する。
 * @security validatePlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validatePlanは共有非同期状態を持たない同期処理である。
 */
export function validatePlan(plan: PreparedPlan, tmpSourcePath: string) {
  const isAdvicePlan = plan.operationMode === "workbench_advice";
  const selected = resolveAiModelSelection({
    provider: plan.provider,
    modelIdentifier: plan.selectedModel,
    reasoningEffort: plan.selectedEffort,
    purpose: "advice",
  });
  if (isAdvicePlan && selected.status !== "resolved") return false;
  const expectedAdviceResult =
    isAdvicePlan && selected.status === "resolved"
      ? planProviderExecution(
          {
            provider: plan.provider,
            purpose: "advice",
            modelSelection: {
              provider: selected.value.provider,
              modelIdentifier: selected.value.modelIdentifier,
              identifierKind: selected.value.identifierKind,
              reasoningEffort: selected.value.reasoningEffort,
            },
            resultSchema: describeAdviceResultSchema(),
          },
          describeDockerProviderExecutionLocations(plan.provider, "advice"),
        )
      : null;
  if (expectedAdviceResult?.status === "blocked") return false;
  const expectedAdviceCommand =
    expectedAdviceResult?.status === "ready"
      ? bindProviderAdviceCommand(expectedAdviceResult.plan, plan.networkPolicy)
      : null;
  const expectedAdviceCommandHash = expectedAdviceCommand
    ? hashProviderAdviceCommand(expectedAdviceCommand)
    : null;
  const fixedSelection = inspectExecutionSelection(plan.executionSelection);
  const isProviderBindingValid =
    fixedSelection !== null &&
    fixedSelection.provider === plan.provider &&
    fixedSelection.modelIdentifier === plan.selectedModel &&
    fixedSelection.reasoningEffort === plan.selectedEffort &&
    fixedSelection.purpose === (isAdvicePlan ? "advice" : "task") &&
    plan.subscriptionOffering ===
      (plan.provider === "codex" ? "chatgpt_subscription_oauth" : "claude_max");
  if (
    !/^OP-[0-9]{6,}$/u.test(plan.operationId) ||
    !/^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(plan.grantRef) ||
    !isProviderBindingValid ||
    !/^MODELSEL-[A-Z0-9-]{8,80}$/u.test(plan.selectionRecordId) ||
    !dockerIsolationResourceIdentityIsValid({
      authenticationContainerName: plan.authContainerName,
      executionContainerName: plan.providerContainerName,
      proxyContainerName: plan.proxyContainerName,
      internalNetworkName: plan.internalNetworkName,
      egressNetworkName: plan.egressNetworkName,
      ownershipLabel: plan.ownershipLabel,
      executionImageDigest: plan.providerImageDigest,
      proxyImageDigest: plan.proxyImageDigest,
    }) ||
    !["low", "medium", "high"].includes(plan.selectedEffort) ||
    plan.providerHomeSourcePath.length === 0 ||
    !/^[a-f0-9]{64}$/u.test(plan.providerHomeIdentityHash) ||
    !/^[a-f0-9]{64}$/u.test(plan.providerHomeProtectionHash) ||
    !/^[a-f0-9]{64}$/u.test(plan.localUserBindingHash) ||
    !/^[a-f0-9]{64}$/u.test(plan.stableLogicalHomeBindingHash) ||
    /[\0\r\n,]/u.test(plan.providerHomeSourcePath)
  ) {
    return false;
  }
  const isTaskPlan = plan.operationMode === "isolated_task";
  if (
    (plan.operationMode !== "boolean_probe" && !isTaskPlan && !isAdvicePlan) ||
    (isTaskPlan &&
      ((plan.taskRole !== "executor" && plan.taskRole !== "reviewer") ||
        !/^TASKPKT-[A-F0-9]{32}$/u.test(plan.taskPacketRef ?? "") ||
        !/^[a-f0-9]{64}$/u.test(plan.taskPacketHash ?? "") ||
        typeof plan.providerInput !== "string" ||
        plan.providerInput.length === 0 ||
        Buffer.byteLength(plan.providerInput, "utf8") >
          PROVIDER_INPUT_LIMIT_BYTES ||
        typeof plan.workspaceSourcePath !== "string" ||
        plan.workspaceSourcePath.length === 0 ||
        /[\0\r\n,]/u.test(plan.workspaceSourcePath) ||
        plan.workspaceMountMode !==
          (plan.taskRole === "executor" ? "read_write" : "read_only"))) ||
    (isAdvicePlan &&
      (plan.taskRole !== null ||
        plan.taskPacketRef !== null ||
        plan.taskPacketHash !== null ||
        !/^ADVICEPKT-[A-F0-9]{32}$/u.test(plan.advicePacketRef ?? "") ||
        !/^[a-f0-9]{64}$/u.test(plan.advicePacketHash ?? "") ||
        plan.adviceCommandHash !== expectedAdviceCommandHash ||
        typeof plan.providerInput !== "string" ||
        plan.providerInput.length === 0 ||
        Buffer.byteLength(plan.providerInput, "utf8") >
          PROVIDER_INPUT_LIMIT_BYTES ||
        plan.workspaceSourcePath !== null ||
        plan.workspaceMountMode !== null)) ||
    (!isTaskPlan &&
      !isAdvicePlan &&
      (plan.taskRole !== null ||
        plan.taskPacketRef !== null ||
        plan.taskPacketHash !== null ||
        (plan.advicePacketRef ?? null) !== null ||
        (plan.advicePacketHash ?? null) !== null ||
        (plan.adviceCommandHash ?? null) !== null ||
        plan.providerInput !== null ||
        plan.workspaceSourcePath !== null ||
        plan.workspaceMountMode !== null))
  ) {
    return false;
  }
  const configuration = resolveIsolationCommandInput(plan, tmpSourcePath);
  return (
    configuration !== null &&
    dockerIsolationCommandsMatch(configuration, plan.commands)
  );
}

/**
 * plan Identityを決定する。
 *
 * @responsibility plan Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input plan: PreparedPlan
 * @returns planIdentityの計算結果を返す。
 * @precondition 「plan: PreparedPlan」がplanIdentityの入力契約を満たす。
 * @postcondition planIdentityの責務を完了した結果だけを返す。
 * @effect N/A: planIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: planIdentityは独自の失敗分岐を所有しない。
 * @invariant planIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: planIdentityはProcess内の同一Subsystemで完結する。
 * @security planIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: planIdentityは共有非同期状態を持たない同期処理である。
 */
export function planIdentity(plan: PreparedPlan) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        operationId: plan.operationId,
        executionSelection: plan.executionSelection,
        taskAttempt: plan.taskAttempt,
        selectionRecordId: plan.selectionRecordId,
        operationMode: plan.operationMode,
        taskRole: plan.taskRole,
        taskPacketHash: plan.taskPacketHash,
        taskWorkload: plan.taskWorkload,
        advicePacketHash: plan.advicePacketHash ?? null,
        adviceCommandHash: plan.adviceCommandHash ?? null,
        ownershipLabel: plan.ownershipLabel,
        commands: plan.commands,
      }),
    )
    .digest("hex");
}

export const PROVIDER_ADVICE_RUNTIME_PACKET_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-runtime-packet";

export const PROVIDER_ADVICE_RUNTIME_PACKET_CONTRACT_REVISION = 2;

/**
 * Provider Commandの完全性Hashを生成する。
 *
 * @responsibility Provider実行に影響する全宣言値を決定論的SHA-256へ固定する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input command: 検証対象のProvider Command。
 * @returns 小文字16進SHA-256、直列化不能時はnullを返す。
 * @precondition commandは上位計画から渡されるが完全性は未確定である。
 * @postcondition 同じ宣言値には同じHashを返す。
 * @effect N/A: 局所計算だけを行う。
 * @failure 直列化失敗をnullへ閉じる。
 * @invariant Prompt本文をCommand Hashへ含めない。
 * @boundary Provider Command宣言とRuntime Packet Identityの間。
 * @security 任意Objectのgetter例外を外へ公開しない。
 * @concurrency N/A: 共有状態を変更しない同期処理である。
 */
export function hashProviderAdviceCommand(command: ProviderAdviceCommand) {
  try {
    return createHash("sha256")
      .update(
        JSON.stringify({
          contract: command.contract,
          contractRevision: command.contractRevision,
          provider: command.provider,
          command: command.command,
          argv: command.argv,
          environment: command.environment,
          fixedImageDigest: command.fixedImageDigest,
          networkPolicy: command.networkPolicy,
          modelIdentifier: command.modelIdentifier,
          identifierKind: command.identifierKind,
          catalogIdentity: command.catalogIdentity,
          reasoningEffort: command.reasoningEffort,
          promptTransport: command.promptTransport,
          resultTransport: command.resultTransport,
          providerHomeMountRequired: command.providerHomeMountRequired,
          repositoryMounted: command.repositoryMounted,
          workspaceMountRequired: command.workspaceMountRequired,
          toolsAllowed: command.toolsAllowed,
          sessionPersistenceAllowed: command.sessionPersistenceAllowed,
        }),
        "utf8",
      )
      .digest("hex");
  } catch {
    return null;
  }
}

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
  advicePacket: ProviderAdvicePacket | null,
  recoveryCorrelationId: string | null,
  consumer: "coordinator_cli" | "workbench" | "orchestrator",
) {
  if (
    consumer !== "coordinator_cli" &&
    consumer !== "workbench" &&
    consumer !== "orchestrator"
  )
    return null;
  const selected = resolveAiModelSelection({
    provider,
    modelIdentifier: consumedModelSelection.model,
    reasoningEffort: consumedModelSelection.effort,
    purpose: "task",
  });
  if (taskPacket && selected.status !== "resolved") return null;
  const generated =
    taskPacket && selected.status === "resolved"
      ? planProviderExecution(
          {
            provider,
            purpose: "task",
            input: {
              provider,
              mode: "isolated_task",
              effort: consumedModelSelection.effort,
              taskRole: taskPacket.taskRole,
              ...(provider === "claude"
                ? { taskWorkload: taskPacket.taskWorkload }
                : {}),
            },
            modelSelection: {
              provider: selected.value.provider,
              modelIdentifier: selected.value.modelIdentifier,
              identifierKind: selected.value.identifierKind,
              reasoningEffort: selected.value.reasoningEffort,
            },
          },
          describeDockerProviderExecutionLocations(provider, "task"),
        )
      : planProviderExecution(
          {
            provider,
            purpose: "probe",
            input: {
              provider,
              mode: "read_only_probe",
              ...(provider === "codex"
                ? { effort: consumedModelSelection.effort }
                : {}),
            },
          },
          describeDockerProviderExecutionLocations(provider, "probe"),
        );
  if (generated.status !== "ready") return null;
  const execution = generated.plan;
  const assets = describeDockerProviderAssets(provider);
  const codexAssets = describeDockerProviderAssets("codex");
  const codex = execution.provider === "codex" ? execution : null;
  const claude = execution.provider === "claude" ? execution : null;
  const egress = describeDockerProxyTopology(provider);
  const selection = inspectExecutionSelection(
    consumedModelSelection.executionSelection,
  );
  if (
    !selection ||
    selection.provider !== provider ||
    hashExecutionSelection(selection) !==
      consumedModelSelection.selectionHash ||
    consumedModelSelection.executorProvider !== provider ||
    consumedModelSelection.operationId !== binding.operationId ||
    activation.grant.provider !== provider ||
    activation.grant.operationId !== binding.operationId ||
    consumedModelSelection.effort !== selection.reasoningEffort ||
    consumedModelSelection.model !== selection.modelIdentifier ||
    consumedModelSelection.selectionNotice.length === 0 ||
    !/^MODELSEL-[A-Z0-9-]{8,80}$/.test(
      consumedModelSelection.selectionRecordId,
    ) ||
    execution?.status !== "candidate" ||
    !validateProviderModelId(consumedModelSelection.model).value ||
    (provider === "codex" &&
      (taskPacket !== null || advicePacket !== null) &&
      (codex?.status !== "candidate" ||
        consumedModelSelection.model !==
          (advicePacket?.providerCommand.modelIdentifier ??
            codex.exactModel))) ||
    execution.provider !== provider ||
    (taskPacket !== null && advicePacket !== null) ||
    (taskPacket !== null &&
      (taskPacket.operationId !== binding.operationId ||
        taskPacket.promptTransport !== "provider_stdin_only" ||
        taskPacket.selectionHash !== hashExecutionSelection(selection) ||
        taskPacket.taskAttempt !== consumedModelSelection.taskAttempt ||
        selection.role !==
          (taskPacket.taskRole === "executor"
            ? "executor"
            : "independent_reviewer"))) ||
    (advicePacket !== null &&
      (advicePacket.operationId !== binding.operationId ||
        hashExecutionSelection(advicePacket.executionSelection) !==
          hashExecutionSelection(selection) ||
        selection.role !== "advice" ||
        advicePacket.provider !== provider ||
        advicePacket.providerCommand.provider !== provider ||
        (provider === "claude" &&
          advicePacket.providerCommand.modelIdentifier !==
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
  const proxyImageDigest = egress.imageDigest;
  const authenticationEnvironment = createDockerAuthenticationEnvironment(
    provider === "codex"
      ? codexAuthenticationCli.homeEnvironmentVariable
      : null,
  );
  if (!authenticationEnvironment) return null;
  if (
    taskPacket &&
    (!taskPacket.networkPolicy ||
      taskPacket.networkPolicy.provider !== provider)
  )
    return null;
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
      networkPolicy:
        taskPacket?.networkPolicy ??
        advicePacket?.providerCommand.networkPolicy ??
        null,
    },
  });
  if (!commands) return null;
  const plan = {
    provider,
    operationId: binding.operationId,
    recoveryCorrelationId,
    consumer,
    grantRef: activation.grant.grantRef,
    executionSelection: consumedModelSelection.executionSelection,
    taskAttempt: consumedModelSelection.taskAttempt,
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
    networkPolicy:
      taskPacket?.networkPolicy ??
      advicePacket?.providerCommand.networkPolicy ??
      null,
    selectionRecordId: consumedModelSelection.selectionRecordId,
    subscriptionOffering:
      provider === "codex"
        ? ("chatgpt_subscription_oauth" as const)
        : ("claude_max" as const),
    selectedModel: consumedModelSelection.model,
    selectedEffort: consumedModelSelection.executionSelection.reasoningEffort,
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

/**
 * CLI計画を助言Packetの既存技術契約へ結合する。
 * @responsibility Imageと非共有条件の所有を上位に閉じる。
 * @trace ARCH-000015
 * @input plan: AI Adapterが生成した検証済み助言CLI計画。
 * @returns 固定ImageとMount意図を結合した同じ閉じたCommand。
 * @precondition 信頼した構成側がDocker側の実行位置で生成している。
 * @postcondition CLI引数・環境・Modelを改変しない。
 * @effect N/A: 不変値の構築だけ。
 * @failure N/A: 対応Providerの固定データだけを利用する。
 * @invariant 取得を実Image検証や送信許可にしない。
 * @boundary ProviderのCLI記述と隔離実行の技術相関。
 * @security Prompt・秘密・Host Rootを追加しない。
 * @concurrency N/A: 同期値だけ。
 */
export function bindProviderAdviceCommand(
  plan: ProviderAdvicePlan,
  networkPolicy: DockerNetworkPolicy | null = null,
): ProviderAdviceCommand {
  return Object.freeze({
    ...plan,
    networkPolicy,
    fixedImageDigest:
      plan.provider === "codex"
        ? describeDockerProviderAssets("codex").adviceIdentity.fixedImageDigest
        : describeDockerProviderAssets("claude").fixedImageDigest,
    providerHomeMountRequired: true as const,
    repositoryMounted: false as const,
    workspaceMountRequired: false as const,
  });
}
