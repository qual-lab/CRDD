/**
 * 元の単段計画とDocker Isolationの固定技術Runtimeを結合する。
 * @packageDocumentation
 * @responsibility Task状態を受けず、計画所属・元結果・元Receiptだけを照合する。
 * @trace ARCH-000008
 */
import {
  type createDockerIsolationRuntime,
  type DockerIsolationRuntimePlan,
  type DockerIsolationCommand,
  describeDockerIsolationExecutionEnvironment,
} from "../../../docker-isolation/src/index.ts";
import {
  validatePlan,
  resolveIsolationCommandInput,
  planIdentity,
} from "./plan.ts";
import type {
  PreparedPlan as isolationExecutionPreparedPlan,
  Command as isolationExecutionCommand,
} from "./types.ts";
import type { DockerExecutionHooks } from "../../../docker-isolation/src/index.ts";

export const DOCKER_EFFECT_RUNTIME_CONTRACT =
  "crdd-coordinator/docker-effect-runtime";

export const DOCKER_EFFECT_RUNTIME_CONTRACT_REVISION = 10;

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
    plan: isolationExecutionPreparedPlan,
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
    command: isolationExecutionCommand,
    plan: isolationExecutionPreparedPlan,
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
    plan: isolationExecutionPreparedPlan,
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
    plan: isolationExecutionPreparedPlan,
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
    plan: isolationExecutionPreparedPlan,
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
