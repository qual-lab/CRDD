/**
 * AI Adapterの実行仕様をDocker Isolationの構成と単段Sessionへ接続する。
 * @packageDocumentation
 * @responsibility 専門Packageの正規構成を結合し、開始・清掃・元結果相関を下位へ委譲する。
 * @trace ARCH-000008
 */
import {
  type DockerIsolationRuntime,
  type HomeLease,
  type DockerIsolationRuntimePlan,
  type DockerNetworkPolicy,
  type DockerExecutionCallbacks,
  bindAdviceCommand,
  hashAdviceCommand,
  type DockerIsolationCommandInput,
  bindProviderCommand,
  describeDockerProviderExecutionLocations,
  dockerIsolationCommandsMatch,
} from "../../../docker-isolation/src/index.ts";
import type { AttemptPlan, PreparedAdviceCommand } from "./types.ts";
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import { isAttemptPlanValid, parseModelSelection } from "./validation.ts";
import {
  planProviderExecution,
  prepareProviderEnvironment,
  resolveAiModelSelection,
  describeProviderAuthentication,
  type ProviderAdvicePlan,
  type AiModelSelection,
  describeAdviceResultSchema,
} from "../../../ai-adapter/src/index.ts";

const PROVIDER_INPUT_LIMIT_BYTES = 128 * 1024;

/**
 * 固定選定から助言Commandと完全Hashを副作用なしで構築する。
 * @responsibility Provider仕様・Docker実行位置・固定Image・Hashの結合を一箇所にする。
 * @trace ARCH-000015
 * @input selection: 上位が確定した技術五項目。networkPolicy: 既存の検査済み通信条件又はnull。
 * @returns 正規Commandと同内容Hash、不一致・構築不能時はnull。
 * @effect N/A: 純粋な値構築だけ。Home・Mount・乱数・Processを取得しない。
 * @failure 不正選定・用途・Hash不能は拒否し、選定値を補完しない。
 * @invariant Packet・承認判断を持たず、実行前にも同じ正本から再構築する。
 */
export function prepareAdviceCommand(
  input: Readonly<{
    selection: AiModelSelection;
    networkPolicy: DockerNetworkPolicy | null;
  }>,
): PreparedAdviceCommand | null {
  const selection = parseModelSelection(input.selection);
  if (
    selection?.purpose !== "advice" ||
    (input.networkPolicy !== null &&
      input.networkPolicy.provider !== selection.provider)
  )
    return null;
  const execution = resolveProviderExecution({
    provider: selection.provider,
    executionSelection: selection,
    operationMode: "workbench_advice",
    taskRole: null,
  });
  if (!execution) return null;
  const command = bindAdviceCommand(
    execution as ProviderAdvicePlan,
    input.networkPolicy,
  );
  const commandHash = hashAdviceCommand(command);
  return commandHash ? Object.freeze({ command, commandHash }) : null;
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
export function bindIsolationRuntime(
  runtime: Pick<
    DockerIsolationRuntime,
    "startExecution" | "cleanupOwnedResources" | "verifyCleanupOutcome"
  >,
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
   * @boundary Executor内部の試行構成とDocker Isolationの実行入力。
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
    hooks: DockerExecutionCallbacks,
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
    cleanupOwnedResources,
    verifyCleanupOutcome,
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
  if (!isAttemptPlanValid(plan)) return null;
  const isAdvicePlan = plan.operationMode === "workbench_advice";
  const preparedAdvice = isAdvicePlan
    ? prepareAdviceCommand({
        selection: plan.executionSelection,
        networkPolicy: plan.networkPolicy,
      })
    : null;
  const execution = isAdvicePlan
    ? preparedAdvice?.command
    : resolveProviderExecution(plan);
  if (!execution) return null;
  const expectedAdviceCommandHash = preparedAdvice?.commandHash ?? null;
  const fixedSelection = plan.executionSelection;
  const isProviderBindingValid =
    fixedSelection.purpose === (isAdvicePlan ? "advice" : "task") &&
    (!("identifierKind" in execution) ||
      fixedSelection.identifierKind === execution.identifierKind);
  if (
    !isProviderBindingValid ||
    !["low", "medium", "high"].includes(
      plan.executionSelection.reasoningEffort,
    ) ||
    plan.providerHomeSourcePath.length === 0 ||
    /[\0\r\n,]/u.test(plan.providerHomeSourcePath)
  ) {
    return null;
  }
  const isTaskPlan = plan.operationMode === "isolated_task";
  if (
    ((isTaskPlan || isAdvicePlan) &&
      Buffer.byteLength(plan.providerInput ?? "", "utf8") >
        PROVIDER_INPUT_LIMIT_BYTES) ||
    (isTaskPlan && /[\0\r\n,]/u.test(plan.workspaceSourcePath ?? "")) ||
    (isAdvicePlan && plan.adviceCommandHash !== expectedAdviceCommandHash)
  )
    return null;
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
 * 開始・清掃を同じ試行構成へ相関するHashを計算する。
 * @responsibility 選定・用途・Command等の既存fieldと順序を維持して識別値を導出する。
 * @trace ARCH-000008
 * @input 同じFactoryが保持した技術構成。
 * @returns SHA-256の16進文字列。
 * @effect N/A: メモリ内の直列化とHash計算のみ。
 * @invariant 対象fieldとJSON順序を変更しない。
 * @boundary 下位Sessionと元の開始・清掃結果の相関。
 * @security Hashの一致を実行許可や清掃完了の証拠にしない。
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
