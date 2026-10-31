/**
 * 元の単段計画とDocker Isolationの固定技術Runtimeを結合する。
 * @packageDocumentation
 * @responsibility Task状態を受けず、計画所属・元結果・元Receiptだけを照合する。
 * @trace ARCH-000008
 */
import {
  type DockerIsolationRuntime,
  type HomeLease,
  type DockerIsolationRuntimePlan,
  type DockerIsolationCommand,
  describeDockerIsolationExecutionEnvironment,
  type DockerExecutionHooks,
  type DockerSessionCleanup,
  type DockerCommandSession,
  bindAdviceCommand,
  hashAdviceCommand,
  type DockerIsolationCommandInput,
  bindProviderCommand,
  describeDockerProviderExecutionLocations,
  dockerIsolationResourceIdentityIsValid,
  dockerIsolationCommandsMatch,
} from "../../../docker-isolation/src/index.ts";
import type { AttemptPlan, AttemptDiagnosticNotice } from "./types.ts";
import { projectDockerExecutionBoundary } from "../../../docker-isolation/src/index.ts";
import { projectCodexExecutionBoundary } from "../../../ai-adapter/src/index.ts";
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import { parseModelSelection } from "./validation.ts";
import {
  planProviderExecution,
  prepareProviderEnvironment,
  resolveAiModelSelection,
  describeProviderAuthentication,
  type ProviderAdvicePlan,
  describeAdviceResultSchema,
} from "../../../ai-adapter/src/index.ts";
import { PURPOSES } from "../result/constants.ts";

/** 固定隔離実装の内部接続。公開APIや業務操作の差替え口ではない。 */
export interface IsolationRuntime {
  acquireHomeLease(bindingHash: string): HomeLease | null;
  startExecution(
    plan: AttemptPlan,
    recovery: object,
    management: object,
    hooks: DockerExecutionHooks,
  ): DockerCommandSession;
  cleanupOwnedResources(
    plan: AttemptPlan,
    recovery: object,
    management: unknown,
  ): Promise<DockerSessionCleanup>;
  verifyCleanupOutcome(
    result: unknown,
    plan: AttemptPlan,
    recovery: unknown,
    management: unknown,
  ): DockerSessionCleanup["resourceObservations"];
}
const ISOLATION_CONTRACT = "crdd-executor/isolation";

const ISOLATION_CONTRACT_REVISION = 10;

const PROVIDER_INPUT_LIMIT_BYTES = 128 * 1024;

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
export function bindIsolationRuntime(
  runtime: Omit<DockerIsolationRuntime, "acquireHomeLease">,
  borrowPaths: (managementCapability: object) => Readonly<{ tmp: string }>,
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
    plan: AttemptPlan,
    managementCapability: object,
  ): DockerIsolationRuntimePlan {
    const paths = borrowPaths(managementCapability);
    const configuration = resolveValidatedPlan(plan, paths.tmp);
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
    command: DockerIsolationCommand,
    plan: AttemptPlan,
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
    plan: AttemptPlan,
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
    plan: AttemptPlan,
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
    plan: AttemptPlan,
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

/**
 * Docker Effect Runtime 契約の公開契約を記述する。
 *
 * @responsibility Docker Effect Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeIsolationContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeIsolationContractの入力契約を満たす。
 * @postcondition describeIsolationContractの責務を完了した結果だけを返す。
 * @effect N/A: describeIsolationContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeIsolationContractは独自の失敗分岐を所有しない。
 * @invariant describeIsolationContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeIsolationContractはProcess内の同一Subsystemで完結する。
 * @security describeIsolationContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeIsolationContractは共有非同期状態を持たない同期処理である。
 */
export function describeIsolationContract() {
  const environment = describeDockerIsolationExecutionEnvironment();
  return Object.freeze({
    contract: ISOLATION_CONTRACT,
    contractRevision: ISOLATION_CONTRACT_REVISION,
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

/**
 * 同じ有限入力からProvider仕様を一箇所で取得する。
 * @responsibility Task・Advice・Probeの要求結合を共有し、Provider規則はAI Adapterへ委譲する。
 * @trace ARCH-000015
 * @input 用途・Provider・固定Model・推論強度・役割・作業量。
 * @returns 正規Provider計画又はnull。
 * @precondition 操作・選定・Packet相関は呼出しOwnerが確認する。
 * @postcondition AdviceをProbeの副経路にしない。
 * @effect N/A: 純粋な計画要求だけ。
 * @failure 未対応の選定・用途はnull。
 * @invariant 準備時と開始前照合で別の引数生成を持たない。
 * @boundary AI Adapter仕様とExecutorの一試行結合。
 * @security 実行Authority・本文を発行しない。
 * @concurrency N/A: 状態を持たない。
 */
export function resolveProviderExecution(
  plan: Pick<
    AttemptPlan,
    | "provider"
    | "executionSelection"
    | "operationMode"
    | "taskRole"
    | "taskWorkload"
  >,
) {
  const purpose =
    plan.operationMode === "isolated_task"
      ? "task"
      : plan.operationMode === "workbench_advice"
        ? "advice"
        : "probe";
  const selected = resolveAiModelSelection({
    provider: plan.provider,
    modelIdentifier: plan.executionSelection.modelIdentifier,
    reasoningEffort: plan.executionSelection.reasoningEffort,
    purpose: purpose === "probe" ? "task" : purpose,
  });
  if (purpose !== "probe" && selected.status !== "resolved") return null;
  const locations = describeDockerProviderExecutionLocations(
    plan.provider,
    purpose,
  );
  const modelSelection =
    selected.status === "resolved"
      ? {
          provider: selected.value.provider,
          modelIdentifier: selected.value.modelIdentifier,
          identifierKind: selected.value.identifierKind,
          reasoningEffort: selected.value.reasoningEffort,
        }
      : null;
  const result =
    purpose === "advice" && modelSelection
      ? planProviderExecution(
          {
            provider: plan.provider,
            purpose: "advice",
            modelSelection,
            resultSchema: describeAdviceResultSchema(),
          },
          locations,
        )
      : purpose === "task" && modelSelection
        ? planProviderExecution(
            {
              provider: plan.provider,
              purpose: "task",
              modelSelection,
              input: {
                provider: plan.provider,
                mode: "isolated_task",
                taskRole: plan.taskRole,
                effort: plan.executionSelection.reasoningEffort,
                ...(plan.provider === "claude"
                  ? { taskWorkload: plan.taskWorkload }
                  : {}),
              },
            },
            locations,
          )
        : planProviderExecution(
            {
              provider: plan.provider,
              purpose: "probe",
              input: {
                provider: plan.provider,
                mode: "read_only_probe",
                ...(plan.provider === "codex"
                  ? { effort: plan.executionSelection.reasoningEffort }
                  : {}),
              },
            },
            locations,
          );
  return result.status === "ready" ? result.plan : null;
}

/**
 * Provider仕様とDIの正規構築処理を結合する。
 * @responsibility 準備と開始前照合で同じ組立経路を使い、Docker詳細を再定義しない。
 * @trace ARCH-000008
 * @input 元plan、現在のtmp所在、初回のみのproxyToken。
 * @returns 正規技術構成又はnull。
 * @precondition 元操作・Capability・選定の意味は上位が検査する。
 * @postcondition DIへ本文・Authority・Recoveryを渡さない。
 * @effect N/A: 仕様と構成の値組立だけ。
 * @failure Provider仕様又はDI構成の拒否はnull。
 * @invariant Provider規則はAI Adapter、Docker規則はDIが所有する。
 * @boundary 二つの専門OwnerとExecutorの一試行。
 * @security Command一致を実行許可の代わりにしない。
 * @concurrency N/A: 共有状態なし。
 */
export function resolveIsolationCommandInput(
  plan: Omit<AttemptPlan, "authorityUseCapability">,
  tmpSourcePath: string,
  proxyToken?: string,
  execution = resolveProviderExecution(plan),
): DockerIsolationCommandInput | null {
  if (!execution) return null;
  const environment = prepareProviderEnvironment(
    plan.provider,
    execution.environment,
  );
  if (environment.status !== "ready") return null;
  const purpose =
    plan.operationMode === "isolated_task"
      ? "task"
      : plan.operationMode === "workbench_advice"
        ? "advice"
        : "probe";
  const authentication = describeProviderAuthentication(plan.provider);
  return bindProviderCommand({
    provider: plan.provider,
    purpose,
    role: plan.taskRole,
    execution: {
      provider: execution.provider,
      argv: execution.argv,
      environment: Object.fromEntries(environment.entries),
    },
    authentication: {
      argv: authentication.statusArgv,
      homeEnvironmentVariable:
        "homeEnvironmentVariable" in authentication
          ? authentication.homeEnvironmentVariable
          : null,
    },
    resources: {
      authenticationContainerName: plan.authContainerName,
      executionContainerName: plan.providerContainerName,
      proxyContainerName: plan.proxyContainerName,
      internalNetworkName: plan.internalNetworkName,
      egressNetworkName: plan.egressNetworkName,
      ownershipLabel: plan.ownershipLabel,
      executionImageDigest: plan.providerImageDigest,
      proxyImageDigest: plan.proxyImageDigest,
    },
    homeSourcePath: plan.providerHomeSourcePath,
    temporarySourcePath: tmpSourcePath,
    workspace:
      purpose === "task" && plan.workspaceSourcePath
        ? {
            sourcePath: plan.workspaceSourcePath,
            readOnly: plan.workspaceMountMode === "read_only",
            ...(plan.workspaceProtection
              ? { protection: plan.workspaceProtection }
              : {}),
          }
        : null,
    networkPolicy: plan.networkPolicy,
    ...(proxyToken === undefined
      ? { mode: "verify" as const, commands: plan.commands }
      : { mode: "create" as const, proxyToken }),
  });
}

/**
 * 元試行の意味を照合し、正規Docker構成を一回で取得する。
 * @responsibility 技術選定・入力・MountとDIの完全Command照合を接続する。Packet相関は上位Ownerが検査する。
 * @trace ARCH-000008
 * @input 元planと現在の借用tmp所在。
 * @returns 全条件が成立した正規構成、又はnull。
 * @precondition 実行時は私有準備Ownerの一回消費を先に確認する。
 * @postcondition 失敗した構成を下位Runtimeへ渡さない。
 * @effect 固定Seccompの実体読取りだけ。Docker・Processは起動しない。
 * @failure 意味相関・固定構成・九Commandの差はnull。
 * @invariant 構築と検査に同じ正規処理を使い、二つのCompilerを持たない。
 * @boundary Executorの元試行とDocker技術構成。
 * @security 構成一致からAuthorityを発行しない。
 * @concurrency 同期照合。追加状態・Lockを持たない。
 */
export function resolveValidatedPlan(
  plan: AttemptPlan,
  tmpSourcePath: string,
): DockerIsolationCommandInput | null {
  const isAdvicePlan = plan.operationMode === "workbench_advice";
  const execution = resolveProviderExecution(plan);
  if (!execution) return null;
  const expectedAdviceExecution = isAdvicePlan ? execution : null;
  const expectedAdviceCommand = expectedAdviceExecution
    ? bindAdviceCommand(
        expectedAdviceExecution as ProviderAdvicePlan,
        plan.networkPolicy,
      )
    : null;
  const expectedAdviceCommandHash = expectedAdviceCommand
    ? hashAdviceCommand(expectedAdviceCommand)
    : null;
  const fixedSelection = parseModelSelection(plan.executionSelection);
  const isProviderBindingValid =
    fixedSelection !== null &&
    fixedSelection.provider === plan.provider &&
    fixedSelection.modelIdentifier ===
      plan.executionSelection.modelIdentifier &&
    fixedSelection.reasoningEffort ===
      plan.executionSelection.reasoningEffort &&
    fixedSelection.purpose === (isAdvicePlan ? "advice" : "task") &&
    (!("identifierKind" in execution) ||
      fixedSelection.identifierKind === execution.identifierKind) &&
    plan.subscriptionOffering ===
      describeProviderAuthentication(plan.provider).offering;
  if (
    !/^OP-[0-9]{6,}$/u.test(plan.operationId) ||
    !/^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(plan.grantRef) ||
    !isProviderBindingValid ||
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
    !["low", "medium", "high"].includes(
      plan.executionSelection.reasoningEffort,
    ) ||
    plan.providerHomeSourcePath.length === 0 ||
    !/^[a-f0-9]{64}$/u.test(plan.providerHomeIdentityHash) ||
    !/^[a-f0-9]{64}$/u.test(plan.providerHomeProtectionHash) ||
    !/^[a-f0-9]{64}$/u.test(plan.localUserBindingHash) ||
    !/^[a-f0-9]{64}$/u.test(plan.stableLogicalHomeBindingHash) ||
    /[\0\r\n,]/u.test(plan.providerHomeSourcePath)
  ) {
    return null;
  }
  const isTaskPlan = plan.operationMode === "isolated_task";
  if (
    (plan.operationMode !== "boolean_probe" && !isTaskPlan && !isAdvicePlan) ||
    (isTaskPlan &&
      ((plan.taskRole !== "executor" && plan.taskRole !== "reviewer") ||
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
        (plan.adviceCommandHash ?? null) !== null ||
        plan.providerInput !== null ||
        plan.workspaceSourcePath !== null ||
        plan.workspaceMountMode !== null))
  ) {
    return null;
  }
  const configuration = resolveIsolationCommandInput(
    plan,
    tmpSourcePath,
    undefined,
    execution,
  );
  return configuration !== null &&
    dockerIsolationCommandsMatch(configuration, plan.commands)
    ? configuration
    : null;
}

/**
 * plan Identityを決定する。
 *
 * @responsibility plan Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input plan: AttemptPlan
 * @returns planIdentityの計算結果を返す。
 * @precondition 「plan: AttemptPlan」がplanIdentityの入力契約を満たす。
 * @postcondition planIdentityの責務を完了した結果だけを返す。
 * @effect N/A: planIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: planIdentityは独自の失敗分岐を所有しない。
 * @invariant planIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: planIdentityはProcess内の同一Subsystemで完結する。
 * @security planIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: planIdentityは共有非同期状態を持たない同期処理である。
 */
export function planIdentity(plan: AttemptPlan) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        operationId: plan.operationId,
        executionSelection: plan.executionSelection,
        operationMode: plan.operationMode,
        taskRole: plan.taskRole,
        taskWorkload: plan.taskWorkload,
        adviceCommandHash: plan.adviceCommandHash ?? null,
        adviceAllowedReferences: plan.adviceAllowedReferences ?? null,
        ownershipLabel: plan.ownershipLabel,
        commands: plan.commands,
      }),
    )
    .digest("hex");
}

/**
 * Plan Validかを判定する。
 *
 * @responsibility Plan Validの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input plan: AttemptPlan
 * @returns isPlanValidの計算結果を返す。
 * @precondition 「plan: AttemptPlan」がisPlanValidの入力契約を満たす。
 * @postcondition isPlanValidの責務を完了した結果だけを返す。
 * @effect N/A: isPlanValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isPlanValidは独自の失敗分岐を所有しない。
 * @invariant isPlanValidは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security isPlanValidはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isPlanValidは共有非同期状態を持たない同期処理である。
 */
export function isPlanValid(plan: AttemptPlan) {
  const isTaskPlan = plan.operationMode === "isolated_task";
  const isAdvicePlan = plan.operationMode === "workbench_advice";
  return (
    (plan.provider === "codex" || plan.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(plan.operationId) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(plan.grantRef) &&
    parseModelSelection(plan.executionSelection)?.provider === plan.provider &&
    plan.subscriptionOffering ===
      describeProviderAuthentication(plan.provider).offering &&
    plan.activeMountCapability !== null &&
    typeof plan.activeMountCapability === "object" &&
    (plan.operationMode === "boolean_probe" || isTaskPlan || isAdvicePlan) &&
    (isTaskPlan
      ? (plan.taskRole === "executor" || plan.taskRole === "reviewer") &&
        typeof plan.providerInput === "string" &&
        plan.providerInput.length > 0 &&
        typeof plan.workspaceSourcePath === "string" &&
        plan.workspaceSourcePath.length > 0 &&
        plan.workspaceMountMode ===
          (plan.taskRole === "executor" ? "read_write" : "read_only")
      : isAdvicePlan
        ? plan.taskRole === null &&
          /^[a-f0-9]{64}$/u.test(plan.adviceCommandHash ?? "") &&
          typeof plan.providerInput === "string" &&
          plan.providerInput.length > 0 &&
          plan.workspaceSourcePath === null &&
          plan.workspaceMountMode === null
        : plan.taskRole === null &&
          (plan.adviceCommandHash ?? null) === null &&
          plan.providerInput === null &&
          plan.workspaceSourcePath === null &&
          plan.workspaceMountMode === null) &&
    dockerIsolationResourceIdentityIsValid({
      authenticationContainerName: plan.authContainerName,
      executionContainerName: plan.providerContainerName,
      proxyContainerName: plan.proxyContainerName,
      internalNetworkName: plan.internalNetworkName,
      egressNetworkName: plan.egressNetworkName,
      ownershipLabel: plan.ownershipLabel,
      executionImageDigest: plan.providerImageDigest,
      proxyImageDigest: plan.proxyImageDigest,
    }) &&
    /^[a-f0-9]{64}$/u.test(plan.providerHomeIdentityHash) &&
    /^[a-f0-9]{64}$/u.test(plan.providerHomeProtectionHash) &&
    /^[a-f0-9]{64}$/u.test(plan.localUserBindingHash) &&
    /^[a-f0-9]{64}$/u.test(plan.stableLogicalHomeBindingHash) &&
    Array.isArray(plan.commands) &&
    plan.commands.length === PURPOSES.length &&
    plan.commands.every(
      (command, index) =>
        command.purpose === PURPOSES[index] &&
        Array.isArray(command.argv) &&
        command.argv.length > 0 &&
        command.argv.every(
          (value: unknown) =>
            typeof value === "string" &&
            value.length > 0 &&
            !value.includes("\0"),
        ),
    )
  );
}

/**
 * 保持中のHome技術Leaseを一回解放する。
 * @responsibility Promise・例外・falseを解放成功へ変換しない。
 * @trace ARCH-000008
 * @precondition 呼出し元が実行終了又は開始前拒否を確認している。
 * @postcondition 同じ呼出し内で解放を再試行しない。
 * @effect 元Home Leaseのreleaseを一回だけ呼ぶ。
 */
export function releaseAttemptHomeLease(homeLease: HomeLease): boolean {
  try {
    const released: unknown = homeLease.release();
    if (utilTypes.isPromise(released)) void released.catch(() => {});
    return released === true;
  } catch {
    return false;
  }
}

/**
 * provider Boundary Configurationを決定する。
 *
 * @responsibility provider Boundary Configurationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input plan: AttemptPlan
 * @returns Extract< ProviderBoundaryDiagnosticNotice, { event: "coordinator_provider_boundary_configured" } >を返す。
 * @precondition 「plan: AttemptPlan」がproviderBoundaryConfigurationの入力契約を満たす。
 * @postcondition providerBoundaryConfigurationの責務を完了した結果だけを返す。
 * @effect N/A: providerBoundaryConfigurationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: providerBoundaryConfigurationは独自の失敗分岐を所有しない。
 * @invariant providerBoundaryConfigurationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security providerBoundaryConfigurationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: providerBoundaryConfigurationは共有非同期状態を持たない同期処理である。
 */
export function providerBoundaryConfiguration(
  plan: AttemptPlan,
): Extract<
  AttemptDiagnosticNotice,
  { event: "coordinator_provider_boundary_configured" }
> {
  const docker = projectDockerExecutionBoundary(
    plan.commands,
    plan.providerImageDigest,
  );
  const codex =
    plan.provider === "codex"
      ? projectCodexExecutionBoundary(docker?.payloadArgv ?? [])
      : null;
  return Object.freeze({
    event: "coordinator_provider_boundary_configured" as const,
    taskRole: plan.taskRole,
    provider: plan.provider,
    operationId: plan.operationId,
    approvalModeConfigured: codex?.approvalModeConfigured ?? "not_applicable",
    sandboxModeConfigured: codex?.sandboxModeConfigured ?? "not_applicable",
    workspaceMountModeConfigured: plan.workspaceMountMode,
    networkPolicyHash: plan.networkPolicy?.policyHash ?? null,
    rootFilesystemReadOnlyConfigured:
      docker?.rootFilesystemReadOnlyConfigured ?? false,
    nonRootUserConfigured: docker?.nonRootUserConfigured ?? false,
    workdirConfigured: docker?.workdirConfigured ?? false,
  });
}
