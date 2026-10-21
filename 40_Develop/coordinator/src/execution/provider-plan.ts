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
  createDockerAuthenticationEnvironment,
  describeDockerProxyTopology,
  describeDockerProviderAssets,
  describeDockerProviderExecutionLocations,
  parseDockerNetworkPolicy,
  type DockerNetworkPolicy,
} from "../../../docker-isolation/src/index.ts";
import type {
  ProviderDockerOperationBinding,
  ProviderDockerMountGrant,
  ProviderDockerModelSelection,
  ProviderDockerTaskPacket,
} from "./provider-types.ts";
import {
  validateProviderModelId,
  prepareProviderEnvironment,
  planProviderExecution,
  describeProviderAuthentication,
  type AiReasoningEffort,
  type ResolvedAiProfileIdentity,
  providerProfileMatchesExecutionIdentity,
  type ProviderAdvicePlan,
} from "../../../ai-adapter/src/index.ts";
import { selectProviderModelCandidate } from "./model-selection.ts";
import type { ProviderAdvicePacket } from "./provider-packet.ts";
import { describeAdviceResultSchema } from "./task-structured-result.ts";
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
  const egress = describeDockerProxyTopology(provider);
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

export const PROVIDER_ADVICE_EXECUTION_PLAN_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-execution-plan";
export const PROVIDER_ADVICE_EXECUTION_PLAN_CONTRACT_REVISION = 1;

const SHA256 = /^[a-f0-9]{64}$/u;
const EXECUTION_INPUT_KEYS = Object.freeze([
  "catalogRevision",
  "exactModelId",
  "networkPolicy",
  "offering",
  "profileId",
  "projectionHash",
  "provider",
  "providerPrompt",
  "reasoningEffort",
  "taskHash",
]);

/**
 * 読取り助言の固定Provider実行計画で使用するProviderAdviceExecutionInputの構造を固定する。
 *
 * @responsibility 読取り助言の固定Provider実行計画が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type ProviderAdviceExecutionInput = Readonly<{
  networkPolicy: DockerNetworkPolicy;
  catalogRevision: number;
  provider: "codex" | "claude";
  providerPrompt: string;
  taskHash: string;
  projectionHash: string;
  profileId: string;
  exactModelId: string;
  reasoningEffort: AiReasoningEffort;
  offering: "chatgpt_subscription_oauth" | "claude_max";
}>;

/**
 * 読取り助言の固定Provider実行計画で使用するProviderAdviceExecutionPlanの構造を固定する。
 *
 * @responsibility 読取り助言の固定Provider実行計画が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type ProviderAdviceExecutionPlan = Readonly<{
  contract: typeof PROVIDER_ADVICE_EXECUTION_PLAN_CONTRACT;
  contractRevision: typeof PROVIDER_ADVICE_EXECUTION_PLAN_CONTRACT_REVISION;
  mode: "workbench_advice";
  catalogRevision: number;
  provider: ProviderAdviceExecutionInput["provider"];
  profileId: string;
  exactModelId: string;
  reasoningEffort: ProviderAdviceExecutionInput["reasoningEffort"];
  offering: ProviderAdviceExecutionInput["offering"];
  providerPrompt: string;
  promptTransport: "stdin";
  taskHash: string;
  projectionHash: string;
  repositoryMounted: false;
  workspaceMounted: false;
  toolsAllowed: false;
  sessionPersistenceAllowed: false;
  apiKeyFallbackAllowed: false;
  paidApiFallbackAllowed: false;
  providerCommand: ProviderAdviceCommand;
}>;

/**
 * 読取り助言の固定Provider実行計画で使用するProviderAdvicePlanPreparationの構造を固定する。
 *
 * @responsibility 読取り助言の固定Provider実行計画が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type ProviderAdvicePlanPreparation = Readonly<
  | {
      status: "prepared";
      reason: null;
      executionPlan: ProviderAdviceExecutionPlan;
    }
  | {
      status: "blocked";
      reason: "workbench_ai_advice_execution_plan_invalid";
      executionPlan: null;
    }
>;

/**
 * 読取り助言の固定Provider実行計画を生成する。
 *
 * @responsibility Catalogと完全一致する実行IdentityだけをRepository非共有・標準入力搬送の計画へ変換する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input input: Provider Adapterが生成した閉じた実行入力、catalog: 採用済みAI Profile Catalog。
 * @returns 検証済み実行計画、またはEffect前の拒否結果。
 * @precondition catalogは呼出し側が指定する改訂に対応する候補である。
 * @postcondition preparedの場合もProvider Effect Authority、認証成立または実行完了を主張しない。
 * @effect N/A: 入力検査と固定値生成だけを行う。
 * @failure Catalog不一致、未知Property、不正HashまたはProvider境界不整合をadvicePlanRejectedで返す。
 * @invariant Provider、Model、推論強度、OfferingおよびTask Identityを補完・変更しない。
 * @boundary 検証済みProfile IdentityとProvider固有実行境界の間。
 * @security Repository、Workspace、Tool、Session、API Keyおよび有料Fallbackを計画上で禁止する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function prepareProviderAdvicePlan(
  input: ProviderAdviceExecutionInput,
  profile: ResolvedAiProfileIdentity,
): ProviderAdvicePlanPreparation {
  const keys = Object.keys(input).sort();
  const networkPolicy = parseDockerNetworkPolicy(input.networkPolicy);
  if (
    !networkPolicy ||
    networkPolicy.provider !== input.provider ||
    keys.length !== EXECUTION_INPUT_KEYS.length ||
    !keys.every((key, index) => key === EXECUTION_INPUT_KEYS[index]) ||
    !Number.isSafeInteger(input.catalogRevision) ||
    input.catalogRevision < 0 ||
    input.providerPrompt.trim().length === 0 ||
    !SHA256.test(input.taskHash) ||
    !SHA256.test(input.projectionHash)
  )
    return advicePlanRejected();

  if (
    !profile.selectionRoles.includes("coordinator") ||
    !providerProfileMatchesExecutionIdentity(profile, {
      profileId: input.profileId,
      provider: input.provider,
      exactModelId: input.exactModelId,
      reasoningEffort: input.reasoningEffort,
      offering: input.offering,
    })
  )
    return advicePlanRejected();

  const generated = planProviderExecution(
    {
      provider: input.provider,
      purpose: "advice",
      input: {
        provider: input.provider,
        exactModelId: input.exactModelId,
        reasoningEffort: input.reasoningEffort,
      },
      resultSchema: describeAdviceResultSchema(),
    },
    describeDockerProviderExecutionLocations(input.provider, "advice"),
  );
  if (generated.status !== "ready") return advicePlanRejected();
  return Object.freeze({
    status: "prepared" as const,
    reason: null,
    executionPlan: Object.freeze({
      contract: PROVIDER_ADVICE_EXECUTION_PLAN_CONTRACT,
      contractRevision: PROVIDER_ADVICE_EXECUTION_PLAN_CONTRACT_REVISION,
      mode: "workbench_advice" as const,
      catalogRevision: input.catalogRevision,
      provider: input.provider,
      profileId: input.profileId,
      exactModelId: input.exactModelId,
      reasoningEffort: input.reasoningEffort,
      offering: input.offering,
      providerPrompt: input.providerPrompt,
      promptTransport: "stdin" as const,
      taskHash: input.taskHash,
      projectionHash: input.projectionHash,
      repositoryMounted: false as const,
      workspaceMounted: false as const,
      toolsAllowed: false as const,
      sessionPersistenceAllowed: false as const,
      apiKeyFallbackAllowed: false as const,
      paidApiFallbackAllowed: false as const,
      providerCommand: bindProviderAdviceCommand(generated.plan, networkPolicy),
    }),
  });
}

/**
 * 読取り助言実行計画の拒否結果を生成する。
 *
 * @responsibility すべての計画不整合をEffect 0の同一公開結果へ閉じる。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input N/A: 固定拒否結果だけを生成する。
 * @returns 実行計画を含まないadvicePlanRejected結果。
 * @precondition N/A: 呼出し条件を持たない。
 * @postcondition executionPlanは常にnullである。
 * @effect N/A: 固定値を生成するだけである。
 * @failure N/A: この関数自身は失敗分岐を持たない。
 * @invariant 不正入力の詳細や秘密値を公開理由へ含めない。
 * @boundary 内部検証理由と公開拒否結果の境界。
 * @security Prompt、Profile詳細およびHashを結果へ複製しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function advicePlanRejected(): ProviderAdvicePlanPreparation {
  return Object.freeze({
    status: "blocked" as const,
    reason: "workbench_ai_advice_execution_plan_invalid" as const,
    executionPlan: null,
  });
}

/**
 * 助言CLI計画に隔離実行の固定Image・共有範囲を結合する。
 * @responsibility Image相関をAI AdapterでなくCoordinatorの技術Packetへ保持する。
 * @trace ARCH-000015
 * @shape ProviderAdvicePlanと固定Image・Home必要・Repository／Workspace非共有。
 * @invariant Image・argv・環境を同じPacket Hashへ結合する。
 * @boundary AIのCLI記述とDockerの配置を結合する上位境界。
 * @security 起動・送信許可を生成しない。
 * @compatibility 既存のPacket field・Hash対象を維持する。
 */
export type ProviderAdviceCommand = ProviderAdvicePlan &
  Readonly<{
    fixedImageDigest: string;
    networkPolicy: DockerNetworkPolicy | null;
    providerHomeMountRequired: true;
    repositoryMounted: false;
    workspaceMountRequired: false;
  }>;

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
