/**
 * Provider計画を固定隔離実行へ投影し、元Runtimeの結果を相関する。
 *
 * @responsibility Model・Packet・Authorityの意味照合とDocker Isolationへの上位接続を所有する。
 * @trace ARCH-000008
 */
import { describeWorkbenchAiAdviceResultSchema } from "../workbench-ai/advice-result.ts";
import { createHash } from "node:crypto";
import {
  createDockerIsolationRuntime,
  planDockerIsolationCommands,
  dockerIsolationResourceIdentityIsValid,
  projectDockerProxyConfiguration,
  createDockerAuthenticationEnvironment,
  type DockerIsolationCommand,
  type DockerIsolationCommandInput,
  type DockerIsolationRuntimePlan,
  type DockerExecutionHooks,
} from "../../../docker-isolation/src/index.ts";
import { codexAdviceProviderInitRequired } from "../../../docker-isolation/src/index.ts";
import {
  describeProviderAuthentication,
  planProviderExecution,
} from "../../../ai-adapter/src/index.ts";
import { describeDockerIsolationExecutionEnvironment } from "../../../docker-isolation/src/index.ts";
import { inspectRuntimeOwnedDockerResourceReceipts } from "../task/recovery.ts";
import { describeEgressProxyTopology } from "../external-send/egress-proxy-policy.ts";
import { borrowOwnedDockerExecutionPaths } from "../host-execution/operation-workspace-lifecycle.ts";
import {
  describeDockerProviderAssets,
  describeDockerProviderExecutionLocations,
} from "../../../docker-isolation/src/index.ts";
import { bindWorkbenchAiProviderCommand } from "../workbench-ai/advice-execution-plan.ts";
import { hashWorkbenchAiProviderCommand } from "../workbench-ai/advice-packet.ts";

export const DOCKER_EFFECT_RUNTIME_CONTRACT =
  "crdd-coordinator/docker-effect-runtime";
export const DOCKER_EFFECT_RUNTIME_CONTRACT_REVISION = 10;

const PROVIDER_INPUT_LIMIT_BYTES = 128 * 1024;

/**
 * docker-effect-runtimeで使用するCommandの値契約を定義する。
 *
 * @responsibility CommandのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape Commandが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Commandで宣言した値と責務の対応を維持する。
 * @boundary N/A: Commandの宣言は外部境界を開かない。
 * @security CommandはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Commandの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Command = Readonly<{ purpose: string; argv: readonly string[] }>;
/**
 * docker-effect-runtimeで使用するPrepared Planの値契約を定義する。
 *
 * @responsibility Prepared PlanのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape PreparedPlanが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PreparedPlanで宣言した値と責務の対応を維持する。
 * @boundary N/A: PreparedPlanの宣言は外部境界を開かない。
 * @security PreparedPlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PreparedPlanの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PreparedPlan = Readonly<{
  provider: "codex" | "claude";
  operationId: string;
  grantRef: string;
  profileId: string;
  activeMountCapability: object;
  authorityUseCapability: object;
  providerHomeSourcePath: string;
  providerHomeIdentityHash: string;
  providerHomeProtectionHash: string;
  localUserBindingHash: string;
  stableLogicalHomeBindingHash: string;
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  selectionRecordId: string;
  subscriptionOffering: "chatgpt_subscription_oauth" | "claude_max";
  selectedModel: string;
  selectedEffort: "low" | "medium" | "high";
  selectedModelTier: string;
  operationMode: "boolean_probe" | "isolated_task" | "workbench_advice";
  taskRole: "executor" | "reviewer" | null;
  taskWorkload?: unknown;
  taskPacketRef: string | null;
  taskPacketHash: string | null;
  advicePacketRef?: string | null;
  advicePacketHash?: string | null;
  adviceCommandHash?: string | null;
  providerInput: string | null;
  workspaceSourcePath: string | null;
  workspaceProtection?: Readonly<{
    gitSourcePath: string;
    internalSourcePath: string;
  }>;
  workspaceMountMode: "read_write" | "read_only" | null;
  commands: readonly Command[];
}>;
/**
 * Arrayが完全一致するか判定する。
 *
 * @responsibility Arrayの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input leftItems: readonly string[]、rightItems: readonly string[]
 * @returns exactArrayの計算結果を返す。
 * @precondition 「leftItems: readonly string[]、rightItems: readonly string[]」がexactArrayの入力契約を満たす。
 * @postcondition exactArrayの責務を完了した結果だけを返す。
 * @effect N/A: exactArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactArrayは独自の失敗分岐を所有しない。
 * @invariant exactArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactArrayはProcess内の同一Subsystemで完結する。
 * @security exactArrayはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactArrayは共有非同期状態を持たない同期処理である。
 */
function exactArray(
  leftItems: readonly string[],
  rightItems: readonly string[],
) {
  return (
    leftItems.length === rightItems.length &&
    leftItems.every((value, i) => value === rightItems[i])
  );
}

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
function resolveIsolationCommandInput(
  plan: PreparedPlan,
  tmpSourcePath: string,
): DockerIsolationCommandInput | null {
  const adviceResult =
    plan.operationMode === "workbench_advice"
      ? planProviderExecution(
          {
            provider: plan.provider,
            purpose: "advice",
            input: {
              provider: plan.provider,
              exactModelId: plan.selectedModel,
              reasoningEffort: plan.selectedEffort,
            },
            resultSchema: describeWorkbenchAiAdviceResultSchema(),
          },
          describeDockerProviderExecutionLocations(plan.provider, "advice"),
        )
      : null;
  if (adviceResult?.status === "blocked") return null;
  const adviceCommand =
    adviceResult?.status === "ready"
      ? bindWorkbenchAiProviderCommand(adviceResult.plan)
      : null;
  const generated = planProviderExecution(
    {
      provider: plan.provider,
      purpose: plan.operationMode === "isolated_task" ? "task" : "probe",
      input:
        plan.operationMode === "isolated_task"
          ? {
              provider: plan.provider,
              mode: "isolated_task",
              taskRole: plan.taskRole,
              effort: plan.selectedEffort,
              ...(plan.provider === "claude"
                ? { taskWorkload: plan.taskWorkload }
                : {}),
            }
          : {
              provider: plan.provider,
              mode: "read_only_probe",
              ...(plan.provider === "codex"
                ? { effort: plan.selectedEffort }
                : {}),
            },
      ...(adviceCommand
        ? {}
        : {
            modelSelection: {
              provider: plan.provider,
              exactModelId: plan.selectedModel,
              reasoningEffort: plan.selectedEffort,
            },
          }),
    },
    describeDockerProviderExecutionLocations(
      plan.provider,
      plan.operationMode === "isolated_task" ? "task" : "probe",
    ),
  );
  if (generated.status !== "ready") return null;
  const providerPlan = generated.plan;
  const assets = describeDockerProviderAssets(plan.provider);
  const egress = describeEgressProxyTopology(plan.provider);
  if (
    providerPlan.status !== "candidate" ||
    egress.verificationAdapter.imageDigest !== plan.proxyImageDigest ||
    (adviceCommand?.fixedImageDigest ?? assets.fixedImageDigest) !==
      plan.providerImageDigest
  ) {
    return null;
  }
  const proxy = projectDockerProxyConfiguration(
    plan.commands,
    plan.proxyImageDigest,
  );
  if (!proxy || proxy.profile !== plan.provider) {
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
    },
  };
}

/**
 * 上位記述から下位Ownerの固定コマンド集合を取得する。
 *
 * @responsibility 元計画の照合と本番構築が同じDocker技術Ownerを使うよう接続する。
 * @trace ARCH-000008
 * @input plan: 上位計画。tmpSourcePath: 既存Ownerから借用した所在。
 * @returns 固定九purposeの構成、不正計画はnull。
 * @precondition Provider記述と固定配布物を照合する。
 * @postcondition Docker flagの重複Ownerを残さない。
 * @effect 固定Seccomp配布物を観測する。Process・Docker要求は発行しない。
 * @failure 記述・配布物の不整合はnull。
 * @invariant argv構築を実行許可・開始・清掃の証明にしない。
 * @boundary 上位意味照合から技術計画Ownerへの境界。
 * @security 内部構成は上位照合だけに利用し公開結果へ含めない。
 * @concurrency N/A: 同期の固定値照合。
 */
function expectedCommands(
  plan: PreparedPlan,
  tmpSourcePath: string,
): readonly Command[] | null {
  const input = resolveIsolationCommandInput(plan, tmpSourcePath);
  return input ? planDockerIsolationCommands(input) : null;
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
function validatePlan(plan: PreparedPlan, tmpSourcePath: string) {
  const isAdvicePlan = plan.operationMode === "workbench_advice";
  const expectedAdviceResult = isAdvicePlan
    ? planProviderExecution(
        {
          provider: plan.provider,
          purpose: "advice",
          input: {
            provider: plan.provider,
            exactModelId: plan.selectedModel,
            reasoningEffort: plan.selectedEffort,
          },
          resultSchema: describeWorkbenchAiAdviceResultSchema(),
        },
        describeDockerProviderExecutionLocations(plan.provider, "advice"),
      )
    : null;
  if (expectedAdviceResult?.status === "blocked") return false;
  const expectedAdviceCommand =
    expectedAdviceResult?.status === "ready"
      ? bindWorkbenchAiProviderCommand(expectedAdviceResult.plan)
      : null;
  const expectedAdviceCommandHash = expectedAdviceCommand
    ? hashWorkbenchAiProviderCommand(expectedAdviceCommand)
    : null;
  const isProviderBindingValid =
    (isAdvicePlan &&
      /^PROFILE-[0-9]{6,}$/u.test(plan.profileId) &&
      plan.subscriptionOffering ===
        (plan.provider === "codex"
          ? "chatgpt_subscription_oauth"
          : "claude_max")) ||
    (plan.provider === "claude" &&
      /^PROFILE-20000[12]$/u.test(plan.profileId) &&
      plan.subscriptionOffering === "claude_max" &&
      plan.selectedModel === "opus") ||
    (plan.provider === "codex" &&
      plan.subscriptionOffering === "chatgpt_subscription_oauth" &&
      ((plan.operationMode === "isolated_task" &&
        /^PROFILE-10000[34]$/u.test(plan.profileId) &&
        plan.selectedModel === "gpt-5.5") ||
        (plan.operationMode === "boolean_probe" &&
          /^PROFILE-10000[12]$/u.test(plan.profileId) &&
          plan.selectedModel === "gpt-5.6-sol")));
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
    !["preferred", "upper_allowed"].includes(plan.selectedModelTier) ||
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
  const expectedCommandPlans = expectedCommands(plan, tmpSourcePath);
  return (
    expectedCommandPlans !== null &&
    plan.commands.length === expectedCommandPlans.length &&
    plan.commands.every(
      (command, index) =>
        command.purpose === expectedCommandPlans[index]?.purpose &&
        exactArray(command.argv, expectedCommandPlans[index]?.argv ?? []),
    )
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
function planIdentity(plan: PreparedPlan) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        operationId: plan.operationId,
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

/**
 * 上位の計画投影を同じ下位Runtimeへ結合する。
 *
 * @responsibility 元計画の所属と意味を検証し、技術入力・元結果だけを搬送する。
 * @trace ARCH-000008
 * @input runtime: 固定下位API。borrowPaths: 既存Ownerの所在借用。
 * @returns 元計画の開始・清掃・元結果照合操作。
 * @precondition 同じ下位Runtimeを操作の生涯で保持する。
 * @postcondition raw Process・Filesystem primitiveを上位へ戻さない。
 * @effect N/A: 結合時には外部資源を取得しない。
 * @failure 元計画不一致は開始前拒否し、下位清掃失敗は未確認として返す。
 * @invariant ModelやTaskの意味とDocker技術所有を混在させない。
 * @boundary 上位の意味検証と下位の固定実行API。
 * @security 元Owner・計画Hash・元結果を別Authorityへ読み替えない。
 * @concurrency 下位の終了待機を完了するまで元Runtimeを保持する。
 */
export function bindDockerIsolationRuntime(
  runtime: ReturnType<typeof createDockerIsolationRuntime>,
  borrowPaths: typeof borrowOwnedDockerExecutionPaths,
) {
  /**
   * 上位の検証済み計画をDocker技術入力へ投影する。
   *
   * @responsibility Model・Task・許可の相関を上位で検証し、技術値だけを下位へ渡す。
   * @trace ARCH-000008
   * @input plan: 元計画。managementCapability: 元の現在Owner。
   * @returns 同じ計画のHash、固定技術構成、限定stdin。
   * @precondition 既存Ownerの所在借用と元計画の完全照合が成立する。
   * @postcondition 上位のState・Packet・Authorityを下位へ渡さない。
   * @effect 既存Ownerの所在・固定配布物を観測する。Docker要求は発行しない。
   * @failure 所在不明・不正計画・構成不能では例外で停止する。
   * @invariant 元のHashを新しい実行許可へ昇格しない。
   * @boundary Coordinatorの意味検証とDocker Isolationの技術構成の間。
   * @security Secretは限定stdinとContainer内payloadだけへ搬送し、診断しない。
   * @concurrency 同じOwnerを操作直前に観測し、下位も借用所在を再照合する。
   */
  function project(
    plan: PreparedPlan,
    managementCapability: object,
  ): DockerIsolationRuntimePlan {
    const paths = borrowPaths(managementCapability);
    if (!validatePlan(plan, paths.tmp))
      throw new Error("docker_effect_plan_invalid");
    const configuration = resolveIsolationCommandInput(plan, paths.tmp);
    if (!configuration) throw new Error("docker_effect_plan_invalid");
    return Object.freeze({
      identity: planIdentity(plan),
      configuration,
      stdin: plan.providerInput,
    });
  }

  /**
   * 元計画に所属する操作だけを技術Ownerで開始する。
   *
   * @responsibility command objectの同一性を照合して固定purposeを下位へ渡す。
   * @trace ARCH-000008
   * @input command、plan、managementCapability: 元の操作とOwner。
   * @returns 下位Ownerの元Handle。
   * @precondition commandは元計画の同じobjectである。
   * @postcondition raw argvを下位の公開開始入力へ渡さない。
   * @effect 下位Ownerへ固定Docker操作を委譲する。
   * @failure 不明Owner・別command・不正計画は開始前に拒否する。
   * @invariant Task・Provider判断と技術Process所有を複製しない。
   * @boundary 上位計画の所属照合から下位技術操作への境界。
   * @security コピーしたcommandや任意Docker操作を受理しない。
   * @concurrency 元の操作相関を同じ生涯で維持する。
   */
  function startCommand(
    command: Command,
    plan: PreparedPlan,
    managementCapability: unknown,
  ) {
    if (!managementCapability || typeof managementCapability !== "object")
      throw new Error("docker_effect_management_required");
    const expected = plan.commands.find(
      (candidate) => candidate.purpose === command.purpose,
    );
    if (!expected || expected !== command)
      throw new Error("docker_effect_command_not_owned");
    return runtime.startCommand(
      expected.purpose as DockerIsolationCommand["purpose"],
      project(plan, managementCapability),
      managementCapability,
    );
  }

  /**
   * 同じ計画の資源回収を技術Ownerへ委譲する。
   *
   * @responsibility 元の相関とReceipt Ownerを維持し、清掃結果を上書きしない。
   * @trace ARCH-000008
   * @input plan、recoveryCapability、managementCapability: 元の計画とOwner。
   * @returns 技術Ownerの元清掃結果、または明示未確認。
   * @precondition 同じ計画と回復Ownerを用いる。
   * @postcondition 観測不能を不存在や成功へ変換しない。
   * @effect 所有Process・Docker資源の回収を下位へ委譲する。
   * @failure 投影不能・清掃例外は明示未確認として返す。
   * @invariant 名前だけの削除や過去unknownの成功化を追加しない。
   * @boundary 上位相関と下位の資源終端の間。
   * @security 回復Identityや根拠から新しいAuthorityを作らない。
   * @concurrency 下位の終了待機と清掃観測を待つ。
   */
  async function cleanupOwnedResources(
    plan: PreparedPlan,
    recoveryCapability: object,
    managementCapability: unknown,
  ) {
    try {
      if (!managementCapability || typeof managementCapability !== "object")
        throw new Error("docker_effect_management_required");
      return await runtime.cleanupOwnedResources(
        project(plan, managementCapability),
        recoveryCapability,
        managementCapability,
      );
    } catch {
      return Object.freeze({
        confirmed: false,
        processTreeTerminated: false,
        containersAbsent: false,
        networksAbsent: false,
        resourceObservations: null,
      });
    }
  }

  /**
   * 下位の元清掃結果を上位の元計画へ相関する。
   *
   * @responsibility 完了後の所在再取得を要求せず、元結果と元Hashを照合する。
   * @trace ARCH-000008
   * @input result、plan、recoveryCapability、managementCapability: 元結果と対象相関。
   * @returns 元結果の五資源観測。不一致・不明はnull。
   * @precondition 同じ下位Runtimeが返した結果objectを使う。
   * @postcondition コピー・別操作・別計画を拒否する。
   * @effect N/A: HashとProcess内元結果の照合だけで外部操作を発行しない。
   * @failure 元計画の取込み失敗・相関不一致はnull。
   * @invariant 表示・任意保存・所在清掃後のPathを完了条件にしない。
   * @boundary 技術清掃結果から上位保存Ownerへの境界。
   * @security 成功booleanだけをLease解放や処置許可にしない。
   * @concurrency N/A: 同期照合で追加待機を作らない。
   */
  function verifyCleanupOutcome(
    result: unknown,
    plan: PreparedPlan,
    recoveryCapability: unknown,
    managementCapability: unknown,
  ) {
    try {
      return runtime.verifyCleanupOutcome(
        result,
        planIdentity(plan),
        recoveryCapability,
        managementCapability,
      );
    } catch {
      return null;
    }
  }

  /**
   * 上位の元計画を一回の下位Sessionへ接続する。
   * @responsibility Task・許可の投影だけを行い、技術反復を下位へ委譲する。
   * @trace ARCH-000008
   * @input plan、recoveryCapability、managementCapability、hooks: 元相関と有限接続。
   * @returns 下位の元cancel／completion。
   * @precondition 同じOwnerと上位計画を用いる。
   * @postcondition raw HandleやOS手順を返さない。
   * @effect 固定Runtimeへ実行・取消・回収を委譲する。
   * @failure 投影不正は要求前に例外で停止する。
   * @invariant 新Authority・Store・回復管理を作らない。
   * @boundary 上位計画の意味と下位の技術生涯。
   * @security 任意primitiveを本番入口へ公開しない。
   * @concurrency 実行開始前に不透明cancelを受け取る。
   */
  function startExecution(
    plan: PreparedPlan,
    recoveryCapability: object,
    managementCapability: object,
    hooks: DockerExecutionHooks,
  ) {
    return runtime.startExecution(
      project(plan, managementCapability),
      recoveryCapability,
      managementCapability,
      hooks,
    );
  }

  return Object.freeze({
    startExecution,
    startCommand,
    cleanupOwnedResources,
    verifyCleanupOutcome,
  });
}

const productionRuntime = bindDockerIsolationRuntime(
  createDockerIsolationRuntime({
    borrowPaths: borrowOwnedDockerExecutionPaths,
    inspectReceipts: inspectRuntimeOwnedDockerResourceReceipts,
  }),
  borrowOwnedDockerExecutionPaths,
);

/**
 * 本番の元計画を固定隔離Sessionで実行する。
 * @responsibility 本番Ownerを維持して下位APIだけを接続する。
 * @trace ARCH-000008
 * @input plan、recoveryCapability、managementCapability、hooks: 元計画と有限同期接続。
 * @returns 本番下位の元Session。
 * @precondition 上位許可と元相関を確認している。
 * @postcondition raw Process・CLI構成を上位へ戻さない。
 * @effect 下位の固定実行と回収を委譲する。
 * @failure 不正投影は要求前停止。
 * @invariant Candidateを本番結果へ昇格しない。
 * @boundary CoordinatorとDocker Isolation本番Runtime。
 * @security 本番primitiveの差替え入力を受けない。
 * @concurrency 返却後に実行し、取消は同じSessionへ結合する。
 */
export function startRuntimeOwnedDockerExecution(
  plan: PreparedPlan,
  recoveryCapability: object,
  managementCapability: object,
  hooks: DockerExecutionHooks,
) {
  return productionRuntime.startExecution(
    plan,
    recoveryCapability,
    managementCapability,
    hooks,
  );
}

/**
 * Runtime 所有 Docker Commandを開始する。
 *
 * @responsibility Runtime 所有 Docker Commandの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000008
 * @input command: Command、plan: PreparedPlan、managementCapability: unknown
 * @returns startRuntimeOwnedDockerCommandの計算結果を返す。
 * @precondition 「command: Command、plan: PreparedPlan、managementCapability: unknown」がstartRuntimeOwnedDockerCommandの入力契約を満たす。
 * @postcondition startRuntimeOwnedDockerCommandの責務を完了した結果だけを返す。
 * @effect N/A: startRuntimeOwnedDockerCommandは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: startRuntimeOwnedDockerCommandは独自の失敗分岐を所有しない。
 * @invariant startRuntimeOwnedDockerCommandは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: startRuntimeOwnedDockerCommandはProcess内の同一Subsystemで完結する。
 * @security startRuntimeOwnedDockerCommandはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: startRuntimeOwnedDockerCommandは共有非同期状態を持たない同期処理である。
 */
export function startRuntimeOwnedDockerCommand(
  command: Command,
  plan: PreparedPlan,
  managementCapability: unknown,
) {
  return productionRuntime.startCommand(command, plan, managementCapability);
}

/**
 * Runtime 所有 Docker Resourcesを清掃する。
 *
 * @responsibility Runtime 所有 Docker Resourcesの清掃対象、完了観測、残存時の失敗境界を所有する。
 * @trace ARCH-000008
 * @input plan: PreparedPlan、recoveryCapability: object、managementCapability: unknown
 * @returns cleanupRuntimeOwnedDockerResourcesの計算結果を返す。
 * @precondition 「plan: PreparedPlan、recoveryCapability: object、managementCapability: unknown」がcleanupRuntimeOwnedDockerResourcesの入力契約を満たす。
 * @postcondition cleanupRuntimeOwnedDockerResourcesの責務を完了した結果だけを返す。
 * @effect N/A: cleanupRuntimeOwnedDockerResourcesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cleanupRuntimeOwnedDockerResourcesは独自の失敗分岐を所有しない。
 * @invariant cleanupRuntimeOwnedDockerResourcesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cleanupRuntimeOwnedDockerResourcesはProcess内の同一Subsystemで完結する。
 * @security cleanupRuntimeOwnedDockerResourcesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cleanupRuntimeOwnedDockerResourcesは共有非同期状態を持たない同期処理である。
 */
export function cleanupRuntimeOwnedDockerResources(
  plan: PreparedPlan,
  recoveryCapability: object,
  managementCapability: unknown,
) {
  return productionRuntime.cleanupOwnedResources(
    plan,
    recoveryCapability,
    managementCapability,
  );
}

/**
 * 本番Docker清掃結果を同じ操作・計画へ照合する。
 *
 * @responsibility 本番Effect Ownerの実返却だけから五purposeの終端観測を返す。
 * @trace ARCH-000008
 * @input result、plan、recoveryCapability、managementCapability: 本番清掃結果と対象相関。
 * @returns 同じ本番結果の観測、またはnull。
 * @precondition 本番清掃結果と元の計画・Capabilityを渡す。
 * @postcondition 模擬Runtimeやコピーした成功結果を拒否する。
 * @effect N/A: 本番Ownerの保持値の照合だけを行う。
 * @failure 相関が成立しない場合はnullを返す。
 * @invariant 新しい処置AuthorityやLease解放根拠を生成しない。
 * @boundary 本番Effect Ownerから終端保存利用側への根拠搬送。
 * @security Provider本文やHost Pathを返さない。
 * @concurrency N/A: 同期照合であり外部待機を行わない。
 */
export function verifyRuntimeOwnedDockerCleanupOutcome(
  result: unknown,
  plan: PreparedPlan,
  recoveryCapability: unknown,
  managementCapability: unknown,
) {
  return productionRuntime.verifyCleanupOutcome(
    result,
    plan,
    recoveryCapability,
    managementCapability,
  );
}

/**
 * Docker Effect Runtime 契約の公開契約を記述する。
 *
 * @responsibility Docker Effect Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDockerEffectRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDockerEffectRuntimeContractの入力契約を満たす。
 * @postcondition describeDockerEffectRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeDockerEffectRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeDockerEffectRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeDockerEffectRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeDockerEffectRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeDockerEffectRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDockerEffectRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeDockerEffectRuntimeContract() {
  const environment = describeDockerIsolationExecutionEnvironment();
  return Object.freeze({
    contract: DOCKER_EFFECT_RUNTIME_CONTRACT,
    contractRevision: DOCKER_EFFECT_RUNTIME_CONTRACT_REVISION,
    dockerCli: environment.dockerCli,
    engine: environment.engine,
    environment: environment.environment,
    commandPlan:
      "exact_nine_command_subscription_preflight_provider_probe_isolated_task_or_workbench_advice",
    taskInput: "runtime_owned_task_or_advice_stdin_only_not_docker_argv",
    cleanup:
      "durable_create_receipt_exact_docker_id_name_label_image_and_network_configuration_then_exact_id_and_name_absence",
    processTreeTermination: environment.processTreeTermination,
    callerCommandAllowed: false,
    providerEffectAllowed: true,
  });
}
