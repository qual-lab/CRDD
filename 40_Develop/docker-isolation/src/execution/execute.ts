/**
 * 一回のDocker技術実行と所有資源の終端を調整する。
 *
 * @responsibility 固定コマンド、Process、実ID清掃、元結果の相関を同じRuntimeで所有する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import { acquireNamedPipeKernelLock } from "../../../platform-access/src/index.ts";
import fs from "node:fs";
import { types as utilTypes } from "node:util";
import {
  type DockerCliTrustSnapshot,
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
  describeDockerCliTrustContract,
} from "../docker-cli/trust.ts";
import { createDockerProcessEnvironment } from "../docker-cli/environment.ts";
import { dockerResourceConfigurationMatches } from "../cleanup/plan.ts";
import {
  createDockerCliConfig,
  verifyDockerCliConfig,
} from "../docker-cli/config.ts";
import {
  type DockerIsolationCommand,
  type DockerIsolationCommandInput,
  planDockerIsolationCommands,
} from "./plan.ts";
import {
  type OwnedCommandHandle,
  startOwnedWindowsProcess,
} from "../process/start.ts";
import { STDOUT_LIMIT_BYTES } from "./result.ts";
import { captureDockerProcessEnvironment } from "../process/environment.ts";
import {
  startDockerCommandSession,
  type DockerExecutionCallbacks,
  type DockerCommandSession,
  type DockerSessionCleanup,
} from "./session.ts";

const DOCKER_CLI_EXECUTABLE =
  "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
const DOCKER_ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";
const SHORT_COMMAND_TIMEOUT_MS = 10_000;

/**
 * 固定Docker CLIの現在実体を観測する。
 * @responsibility CLI観測失敗を既存の有限理由へ変換する。
 * @trace ARCH-000008
 * @input N/A: 固定観測だけを呼ぶ。
 * @returns 検証したDocker CLI snapshot。
 * @precondition 固定本番compositionだけが使用する。
 * @postcondition 元の技術検証条件と失敗分類を維持する。
 * @effect 既存のFilesystem・署名観測を発行する。
 * @failure 観測例外はdocker_effect_cli_untrusted。
 * @invariant 上位からCLI実行物・環境・OSを受け取らない。
 * @boundary DI本番入口と固定技術観測。
 * @security Secretや生出力を結果へ複製しない。
 * @concurrency 同期観測と、同じ操作内の実体再確認を分ける。
 */
function readCliSnapshot(): DockerCliTrustSnapshot {
  try {
    return observeTrustedDockerCli();
  } catch {
    throw new Error("docker_effect_cli_untrusted");
  }
}

/**
 * 同じ操作のDocker CLI実体を再確認する。
 * @responsibility 初回snapshotとの差や再観測失敗を既存理由へ変換する。
 * @trace ARCH-000008
 * @input snapshot: 同操作の初回観測。
 * @returns N/A: 正常確認だけ復帰する。
 * @precondition 固定本番compositionだけが使用する。
 * @postcondition 元の技術検証条件と失敗分類を維持する。
 * @effect 既存CLIの同一性を再観測する。
 * @failure 再確認例外はdocker_effect_cli_replaced。
 * @invariant 上位からCLI実行物・環境・OSを受け取らない。
 * @boundary DI本番入口と固定技術観測。
 * @security Secretや生出力を結果へ複製しない。
 * @concurrency 同期観測と、同じ操作内の実体再確認を分ける。
 */
function verifyCliSnapshot(snapshot: DockerCliTrustSnapshot) {
  try {
    verifyTrustedDockerCliSnapshot(snapshot);
  } catch {
    throw new Error("docker_effect_cli_replaced");
  }
}

/**
 * 固定本番実行環境の非秘密契約を返す。
 * @responsibility CLI・Engine・環境・Process終端方式の説明OwnerをDIへ閉じる。
 * @trace ARCH-000008
 * @input N/A: 実環境の観測や外部入力なし。
 * @returns 既存の固定技術説明。
 * @precondition 固定本番compositionだけが使用する。
 * @postcondition 元の技術検証条件と失敗分類を維持する。
 * @effect N/A: 不変値の投影だけ。
 * @failure N/A: 観測を発行しない。
 * @invariant 上位からCLI実行物・環境・OSを受け取らない。
 * @boundary DI本番入口と固定技術観測。
 * @security Secretや生出力を結果へ複製しない。
 * @concurrency 同期観測と、同じ操作内の実体再確認を分ける。
 */
export function describeDockerIsolationExecutionEnvironment() {
  return Object.freeze({
    dockerCli: Object.freeze({
      ...describeDockerCliTrustContract(),
      shellAllowed: false,
    }),
    engine: DOCKER_ENGINE,
    environment: "runtime_owned_minimal_replacement",
    processTreeTermination: "taskkill_exact_pid_tree_then_close",
  });
}

/**
 * 固定Filesystem・Processを所有する本番隔離Runtimeを構築する。
 *
 * @responsibility 上位の借用所在とHost観測だけを受けて技術操作を下位で完結する。
 * @trace ARCH-000008
 * @input dependencies: 既存Ownerの借用所在と元Receiptの観測だけ。
 * @returns 開始・清掃・元結果照合の固定操作。
 * @precondition 利用許可・回復相関を上位Ownerが確認する。CLI・環境・OSはDIが固定する。
 * @postcondition 任意Process・Filesystem primitiveを本番入力へ公開しない。
 * @effect N/A: 構築時に資源を取得しない。
 * @failure 操作時の不明・差替えは新Effect前に拒否する。
 * @invariant TaskやProviderの意味・永続Stateを下位へ持込まない。
 * @boundary 検査済みOwner投影と固定技術実行。
 * @security shell・ambient環境・任意実行物を本番Callerへ委ねない。
 * @concurrency 元Handleの終端と実資源の清掃を同じRuntimeで所有する。
 */
export function createDockerIsolationRuntime(
  dependencies: DockerIsolationRuntimeOptions,
): DockerIsolationRuntime {
  if (
    !dependencies ||
    typeof dependencies !== "object" ||
    utilTypes.isProxy(dependencies)
  )
    throw new Error("docker_isolation_runtime_input_invalid");
  const descriptors = Object.getOwnPropertyDescriptors(dependencies);
  if (Object.hasOwn(descriptors, "platform"))
    throw new Error("docker_isolation_platform_input_forbidden");
  const receiptDescriptor = Object.hasOwn(descriptors, "inspectReceipts")
    ? descriptors.inspectReceipts
    : undefined;
  if (
    (Object.getPrototypeOf(dependencies) !== Object.prototype &&
      Object.getPrototypeOf(dependencies) !== null) ||
    !Object.hasOwn(descriptors, "borrowPaths") ||
    Reflect.ownKeys(descriptors).some(
      (key) =>
        typeof key !== "string" ||
        (key !== "borrowPaths" && key !== "inspectReceipts") ||
        !Object.hasOwn(descriptors[key] ?? {}, "value"),
    ) ||
    typeof descriptors.borrowPaths?.value !== "function" ||
    (receiptDescriptor?.value !== undefined &&
      typeof receiptDescriptor.value !== "function")
  )
    throw new Error("docker_isolation_runtime_input_invalid");
  const borrowPaths = descriptors.borrowPaths
    ?.value as DockerIsolationDependencies<DockerCliTrustSnapshot>["borrowPaths"];
  const inspectReceipts =
    receiptDescriptor?.value as DockerIsolationDependencies<DockerCliTrustSnapshot>["inspectReceipts"];
  const runtime = createDockerIsolationRuntimeCandidate({
    borrowPaths,
    inspectReceipts,
    platform: process.platform,
    readCli: readCliSnapshot,
    verifyCli: verifyCliSnapshot,
    environment: createDockerProcessEnvironment,
    createConfig: createDockerCliConfig,
    verifyConfig: verifyDockerCliConfig,
    configEntries: (directory) => fs.readdirSync(directory),
    removeConfig: (directory) => fs.rmdirSync(directory),
    startProcess: (executable, argv, environment, stdin) =>
      startOwnedWindowsProcess(executable, argv, environment, stdin),
  });
  return Object.freeze({ ...runtime, acquireHomeLease });
}

/**
 * 同じ論理Homeを複数実行が同時使用しないよう既存OS排他を取得する。
 * @responsibility 技術LeaseをExecutorの生涯へ渡し、保存やTask状態を所有しない。
 * @trace ARCH-000008
 * @input 検証済みHome bindingのSHA-256。
 * @returns 保持中の元Lease又はnull。
 * @effect 既存のWindows Named Pipe排他を取得する。
 * @invariant 名前空間とHash導出を変更しない。
 */
function acquireHomeLease(bindingHash: string) {
  if (
    process.platform !== "win32" ||
    typeof bindingHash !== "string" ||
    !/^[a-f0-9]{64}$/u.test(bindingHash)
  )
    return null;
  const identity = createHash("sha256")
    .update("crdd-logical-provider-home-kernel-lock-v1\0")
    .update(bindingHash)
    .digest("hex")
    .slice(0, 32);
  return acquireNamedPipeKernelLock(
    `\\\\.\\pipe\\CRDD.Coordinator.ProviderHome.${identity}`,
  );
}

/**
 * 実行資源の技術計画。相関値は許可ではない。
 *
 * @responsibility 起動構成と限定stdinを同じ一回の実行へ結合する。
 * @trace ARCH-000004
 * @shape 上位相関Hash、Docker技術構成、限定stdin。
 * @invariant Task・Provider・Authority・保存Ownerの意味を持たない。
 * @boundary 上位の検証済み計画から隔離資源Ownerへの境界。
 * @security stdinと内部構成を診断へ複製しない。
 * @compatibility 同じ操作と構成以外の再利用を拒否する。
 */
export type DockerIsolationRuntimePlan = Readonly<{
  identity: string;
  configuration: DockerIsolationCommandInput;
  stdin: string | null;
}>;

/**
 * 本番隔離Runtimeが借用する所在とReceipt観測だけを表す。
 * @responsibility 既存依存契約の必要断面を再利用する。
 * @trace ARCH-000008
 * @invariant Process primitiveやCLI構成を上位へ公開しない。
 */
export type DockerIsolationRuntimeOptions = Pick<
  DockerIsolationDependencies<DockerCliTrustSnapshot>,
  "borrowPaths" | "inspectReceipts"
>;

/**
 * 固定隔離Runtimeの開始・清掃・照合操作を表す。
 * @responsibility 下位の技術操作を名前付きの契約で上位へ接続する。
 * @trace ARCH-000008
 * @invariant 上位のTask状態や保存方式を所有しない。
 */
export type HomeLease = Readonly<{ release: () => boolean }>;

/**
 * Docker実行とHome技術排他の有限操作。
 * @responsibility Taskや保存方式を持たず、元Handleの取得・実行・回収だけを扱う。
 * @trace ARCH-000008
 */
export type DockerIsolationRuntime = Readonly<{
  acquireHomeLease: (bindingHash: string) => HomeLease | null;
  startCommand: (
    purpose: DockerIsolationCommand["purpose"],
    plan: DockerIsolationRuntimePlan,
    managementCapability: unknown,
  ) => OwnedCommandHandle;
  cleanupOwnedResources: (
    plan: DockerIsolationRuntimePlan,
    recoveryCapability: object,
    managementCapability: unknown,
  ) => Promise<DockerSessionCleanup>;
  verifyCleanupOutcome: (
    result: unknown,
    callerIdentity: string,
    recoveryCapability: unknown,
    managementCapability: unknown,
  ) => readonly DockerResourceCleanupObservation[] | null;
  startExecution: (
    plan: DockerIsolationRuntimePlan,
    recoveryCapability: object,
    managementCapability: unknown,
    hooks: DockerExecutionCallbacks,
  ) => DockerCommandSession;
}>;

/**
 * 五資源の作成要求と実IDの検査済み投影。
 *
 * @responsibility 明示未要求と作成結果不明を区別した読取り値を搬送する。
 * @trace ARCH-000008
 * @shape 各作成purposeにsubmittedと実Docker IDまたはnull。
 * @invariant nullを未要求または不存在へ補完しない。
 * @boundary 既存保存Ownerから技術清掃への用途限定投影。
 * @security 記録の読取り・Lock操作・新しいAuthorityは所有しない。
 * @compatibility 固定五purposeのReceiptを受理する。
 */
export type DockerResourceReceipts = Readonly<
  Record<
    | "create_provider"
    | "create_proxy"
    | "create_subscription_auth_probe"
    | "create_internal_network"
    | "create_egress_network",
    Readonly<{ submitted: boolean; dockerId: string | null }>
  >
>;

/**
 * 一資源の終了観測。清掃のboolから再構成しない。
 *
 * @responsibility 明示未要求、不存在、観測不能を別の値として返す。
 * @trace ARCH-000008
 * @shape purpose、予定名、実IDと三値の終了観測。
 * @invariant 不明を成功や未要求へ変換しない。
 * @boundary 技術清掃と上位の結果保存の間。
 * @security Path・本文・Secret・処置許可を含めない。
 * @compatibility 既存資源別終端観測と同じfieldを保持する。
 */
export type DockerResourceCleanupObservation = Readonly<{
  purpose: keyof DockerResourceReceipts;
  plannedResourceName: string;
  dockerId: string | null;
  observation: "not_requested" | "absent" | "unknown";
}>;

/**
 * 技術Runtimeを既存Ownerの観測と実行primitiveへ接続する。
 *
 * @responsibility 上位Stateを参照せず、所在・CLI・Receiptの用途限定観測を受ける。
 * @trace ARCH-000008
 * @shape Host観測、借用所在、限定Receipt読取りと技術実行primitive。
 * @invariant Task操作、Lock取得／解放、Store参照を受けない。
 * @boundary 検証済み実行構成と下位のEffect発行順序。
 * @security 例外・観測不能で新Effectを停止し、任意Docker argvは受けない。
 * @compatibility 既存技術primitiveの差替えは試験用であり、実結果の根拠を共有しない。
 */
export type DockerIsolationDependencies<Cli extends object> = Readonly<{
  platform: string;
  borrowPaths: (owner: object) => Readonly<{ tmp: string; management: string }>;
  readCli: () => Cli;
  verifyCli: (snapshot: Cli) => void;
  environment: () => Readonly<Record<string, string>>;
  createConfig: (
    managementPath: string,
  ) => Readonly<{ directory: string; identity: string }>;
  verifyConfig: (directory: string, identity: string) => void;
  configEntries: (directory: string) => readonly string[];
  removeConfig: (directory: string) => void;
  startProcess: (
    executable: string,
    argv: readonly string[],
    environment: Readonly<Record<string, string>>,
    stdin: string | null,
  ) => OwnedCommandHandle;
  inspectReceipts?:
    | ((owner: object) => DockerResourceReceipts | null)
    | undefined;
}>;

/**
 * 一操作の生きたProcessと実行用configの所在。
 *
 * @responsibility 同じ技術計画のProcess所有と終了までの借用を保持する。
 * @trace ARCH-000008
 * @shape 計画Hash、config実体、CLI観測と所有Handle集合。
 * @invariant 永続State・履歴・上位Attemptを保持しない。
 * @boundary Process内の一操作の資源所有。
 * @security 生きたHandleを別操作へ移譲しない。
 * @compatibility Runtimeごとに独立し、結果objectを他Runtimeと共有しない。
 */
type ExecutionContext<Cli extends object> = {
  planIdentity: string;
  configDirectory: string;
  configIdentity: string;
  cli: Cli;
  handles: Set<OwnedCommandHandle>;
};

/**
 * 技術構成と上位相関を同じ操作の検査値へ結合する。
 *
 * @responsibility 構成・入力が差し替わった場合の再利用を拒否する。
 * @trace ARCH-000008
 * @input plan: 相関値、技術構成、限定stdin。
 * @returns 内部照合だけに使うSHA-256。
 * @precondition 呼出し側が元の相関値を保持している。
 * @postcondition 上位意味のHashを処置許可へ昇格しない。
 * @effect N/A: 値のHash計算だけで外部処置を発行しない。
 * @failure 不正な値構造は呼出し側で停止する。
 * @invariant 生入力のHashと内部計画をログへ公開しない。
 * @boundary N/A: 同期のProcess内計算。
 * @security HashだけでOwner・Lease・CLI信頼を証明しない。
 * @concurrency N/A: 共有状態を変更しない同期処理。
 */
function planIdentity(plan: DockerIsolationRuntimePlan) {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

/**
 * 固定技術計画の開始・待機・清掃を所有するRuntimeを構築する。
 *
 * @responsibility 上位の判断を取り込まず、実Effectと終端観測を一つのOwnerへ結合する。
 * @trace ARCH-000004
 * @input dependencies: 既存Ownerの観測と技術実行primitive。
 * @returns 開始、清掃、元清掃結果の照合操作。
 * @precondition 本番Factoryだけが固定primitiveを組み立て、外部からの差替えは試験候補に限定する。
 * @postcondition 任意argv入力やコピーされた清掃結果を受理しない。
 * @effect N/A: 構築だけでは外部処置を発行しない。
 * @failure 操作中の観測不能は清掃未確認として保持する。
 * @invariant Runtime間・操作間でHandleと根拠を共有しない。
 * @boundary 上位Ownerの用途限定観測とDocker技術処置の境界。
 * @security 未要求・不存在・不明を分離し、名前だけで削除しない。
 * @concurrency 所有Process終端と資源観測の後にだけ清掃確認を返す。
 */
export function createDockerIsolationRuntimeCandidate<Cli extends object>(
  dependencies: DockerIsolationDependencies<Cli>,
): Omit<DockerIsolationRuntime, "acquireHomeLease"> {
  const contexts = new WeakMap<object, ExecutionContext<Cli>>();
  const stoppedAttempts = new WeakMap<object, Set<string>>();
  const cleanupResults = new WeakMap<
    object,
    Readonly<{
      managementCapability: object;
      recoveryCapability: object;
      planIdentity: string;
      callerIdentity: string;
      observations: readonly DockerResourceCleanupObservation[];
    }>
  >();

  /**
   * 同じ技術計画の実行Contextを借用・準備する。
   *
   * @responsibility 所在・CLI・config実体の照合と一操作のHandle所有を結合する。
   * @trace ARCH-000008
   * @input plan、managementCapability: 技術計画と既存Owner。
   * @returns 同じ操作の実行Context。
   * @precondition 上位が現在Ownerと所在借用を検証している。
   * @postcondition 構成差・不正入力・観測不能では実行Contextを再利用しない。
   * @effect 既存OwnerとCLIを観測し、初回だけ検証済みbinding配下に実行用configを作成する。
   * @failure 入力不正・CLI／config差替え・未対応OSは例外で停止する。
   * @invariant Task・永続State・新しいLockを保持しない。
   * @boundary 既存Host観測から技術実行用configへの境界。
   * @security 借用PathやHashを実行許可に読み替えない。
   * @concurrency 外部待機前に同期でContextを固定し、同じOwnerの構成差を拒否する。
   */
  function contextFor(
    plan: DockerIsolationRuntimePlan,
    managementCapability: object,
  ) {
    const paths = dependencies.borrowPaths(managementCapability);
    if (
      !/^[a-f0-9]{64}$/u.test(plan.identity) ||
      (plan.stdin !== null &&
        (typeof plan.stdin !== "string" ||
          plan.stdin.length === 0 ||
          Buffer.byteLength(plan.stdin, "utf8") > 128 * 1024)) ||
      (plan.stdin !== null) !== plan.configuration.execution.interactive ||
      plan.configuration.temporarySourcePath !== paths.tmp
    )
      throw new Error("docker_effect_plan_invalid");
    const identity = planIdentity(plan);
    const current = contexts.get(managementCapability);
    if (current) {
      if (current.planIdentity !== identity)
        throw new Error("docker_effect_plan_replaced");
      dependencies.verifyCli(current.cli);
      dependencies.verifyConfig(
        current.configDirectory,
        current.configIdentity,
      );
      return current;
    }
    if (!planDockerIsolationCommands(plan.configuration))
      throw new Error("docker_effect_plan_invalid");
    if (dependencies.platform !== "win32")
      throw new Error("docker_effect_platform_unsupported");
    const cli = dependencies.readCli();
    const config = dependencies.createConfig(paths.management);
    const context: ExecutionContext<Cli> = {
      planIdentity: identity,
      configDirectory: config.directory,
      configIdentity: config.identity,
      cli,
      handles: new Set(),
    };
    contexts.set(managementCapability, context);
    return context;
  }

  /**
   * 閉じたpurposeのDocker操作を開始する。
   *
   * @responsibility 下位が再構築した固定argvだけを検証済みCLIへ発行する。
   * @trace ARCH-000008
   * @input purpose、plan、managementCapability: 固定操作と技術計画、元Owner。
   * @returns 開始・待機・終端観測を持つ所有Handle。
   * @precondition 固定構成、Owner、CLI実体と最小環境が操作直前に成立する。
   * @postcondition 呼出し側のraw argvを実行せず、Handleを同じ操作へ所有する。
   * @effect 固定Docker CLIのProcessを開始し、実行purposeだけに限定stdinを渡す。
   * @failure 不正purpose・停止済み操作・CLI／所在不明は新しい開始前に拒否する。
   * @invariant Handle取得をDocker作成成立・Provider開始へ昇格しない。
   * @boundary 技術計画から固定Docker CLI Processへの境界。
   * @security shell・ambient環境・任意Docker flagを受けない。
   * @concurrency 清掃開始後の新規開始を拒否し、元Handleの終了観測を維持する。
   */
  function startCommand(
    purpose: DockerIsolationCommand["purpose"],
    plan: DockerIsolationRuntimePlan,
    managementCapability: unknown,
  ): OwnedCommandHandle {
    if (!managementCapability || typeof managementCapability !== "object")
      throw new Error("docker_effect_management_required");
    if (stoppedAttempts.get(managementCapability)?.has(planIdentity(plan)))
      throw new Error("docker_effect_attempt_stopped");
    const command = planDockerIsolationCommands(plan.configuration)?.find(
      (candidate) => candidate.purpose === purpose,
    );
    if (!command) throw new Error("docker_effect_command_not_owned");
    const environment = captureDockerProcessEnvironment(
      dependencies.environment(),
    );
    const context = contextFor(plan, managementCapability);
    dependencies.verifyCli(context.cli);
    dependencies.verifyConfig(context.configDirectory, context.configIdentity);
    const handle = dependencies.startProcess(
      DOCKER_CLI_EXECUTABLE,
      [
        "--host",
        DOCKER_ENGINE,
        "--config",
        context.configDirectory,
        ...command.argv,
      ],
      environment,
      command.purpose === "start_provider_attached" ? plan.stdin : null,
    );
    context.handles.add(handle);
    return handle;
  }

  /**
   * 固定観測・清掃の短期Docker要求を実行する。
   *
   * @responsibility 短期Handleの所有、有界待機、未終了時の終端とcloseを管理する。
   * @trace ARCH-000008
   * @input context、argv: 元ContextとPackage内部で構築した観測・清掃引数。
   * @returns 元コマンド結果、または有界待機の観測不能null。
   * @precondition CLI実体と最小環境を各spawn直前に再照合する。
   * @postcondition close確認済みHandleだけを所有集合から除く。
   * @effect 固定Docker CLIの観測・清掃要求を発行し、必要なら所有Process treeを終端する。
   * @failure CLI差替え・開始例外は伝播し、待機不能を成功へ変換しない。
   * @invariant 短期結果をProcess tree不存在の単独根拠にしない。
   * @boundary Package内部のDocker観測・処置と所有Processの境界。
   * @security 外部から自由argvを受ける公開APIにしない。
   * @concurrency 待機期限後も未終了Handleの所有を保持する。
   */
  async function runShort(
    context: ExecutionContext<Cli>,
    argv: readonly string[],
  ) {
    const environment = captureDockerProcessEnvironment(
      dependencies.environment(),
    );
    dependencies.verifyCli(context.cli);
    dependencies.verifyConfig(context.configDirectory, context.configIdentity);
    const handle = dependencies.startProcess(
      DOCKER_CLI_EXECUTABLE,
      ["--host", DOCKER_ENGINE, "--config", context.configDirectory, ...argv],
      environment,
      null,
    );
    context.handles.add(handle);
    const result = await handle.wait(SHORT_COMMAND_TIMEOUT_MS);
    if (!handle.closed()) await handle.terminateAndWait(5_000);
    if (handle.closed()) context.handles.delete(handle);
    return result;
  }

  /**
   * 記録された実Docker IDの構成と所有相関を観測する。
   *
   * @responsibility 実ID・名前・Label・Image・Networkと固定隔離構成を同時に照合する。
   * @trace ARCH-000008
   * @input context、kind、dockerId、expectedName、ownershipLabel、expectedImage、shouldBeInternal、purpose、plan: exact資源と期待構成。
   * @returns owned、foreign、unknownの三値。
   * @precondition 実IDは既存Ownerが検査した作成Receiptに由来する。
   * @postcondition 観測不能をownedまたは不存在へ補完しない。
   * @effect 固定Docker inspectを実IDで実行する。
   * @failure 不正応答・出力超過・観測失敗はunknown、相関／構成不一致はforeign。
   * @invariant 名前やLabel単独で削除許可を作らない。
   * @boundary Docker実資源から固定構成照合への境界。
   * @security User・read-only・cap-drop・no-new-privileges・Mount modeを保持する。
   * @concurrency 毎回現在の実体を観測し、履歴値だけで構成一致を主張しない。
   */
  async function inspectExactResource(
    context: ExecutionContext<Cli>,
    kind: "container" | "network",
    dockerId: string,
    expectedName: string,
    ownershipLabel: string,
    expectedImage: string | null,
    shouldBeInternal: boolean | null,
    purpose:
      | "create_subscription_auth_probe"
      | "create_internal_network"
      | "create_egress_network"
      | "create_proxy"
      | "create_provider",
    plan: DockerIsolationRuntimePlan,
  ) {
    const result = await runShort(
      context,
      kind === "container"
        ? ["container", "inspect", dockerId]
        : ["network", "inspect", dockerId],
    );
    if (
      result?.status !== 0 ||
      result.signal !== null ||
      result.outputExceeded ||
      result.stderr.length !== 0 ||
      Buffer.byteLength(result.stdout, "utf8") > STDOUT_LIMIT_BYTES
    )
      return "unknown" as const;
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      return "unknown" as const;
    }
    if (!Array.isArray(parsed) || parsed.length !== 1)
      return "foreign" as const;
    return dockerResourceConfigurationMatches(parsed[0], {
      kind,
      dockerId,
      expectedName,
      ownershipLabel,
      expectedImage,
      shouldBeInternal,
      purpose,
      expectedNetworks:
        kind === "network"
          ? []
          : purpose === "create_subscription_auth_probe"
            ? ["none"]
            : purpose === "create_proxy"
              ? [
                  plan.configuration.egressNetworkName,
                  plan.configuration.internalNetworkName,
                ].sort()
              : [plan.configuration.internalNetworkName],
      workspaceMounted: plan.configuration.workspace !== null,
      workspaceReadOnly: plan.configuration.workspace?.readOnly === true,
      initRequired: plan.configuration.execution.initRequired,
      ...(purpose === "create_provider" &&
      plan.configuration.workspace?.protection
        ? {
            workspaceProtected: true,
            workspaceProtection: plan.configuration.workspace.protection,
          }
        : {}),
    })
      ? ("owned" as const)
      : ("foreign" as const);
  }

  /**
   * 実Docker IDと予定名の不存在を別々に観測する。
   *
   * @responsibility IDの不在と同名資源の不在を成功応答で確認する。
   * @trace ARCH-000008
   * @input context、kind、dockerId、expectedName: 元資源のIDと名。
   * @returns 双方の明示不存在を確認した場合だけtrue。
   * @precondition 同じ元ContextのCLIと構成を使用する。
   * @postcondition 通信失敗・出力超過・不正終了を空集合へ変換しない。
   * @effect 固定Docker lsで実IDとexact名の現在値を読む。
   * @failure 片方でも観測不能または残存ならfalse。
   * @invariant falseは不存在を意味せず、上位が未確認として扱う。
   * @boundary Docker資源清掃後の現在観測。
   * @security 別ID・同名差替えを回収成功へ混入しない。
   * @concurrency 清掃後に再観測し、削除要求の受理だけで完了しない。
   */
  async function exactResourceAbsent(
    context: ExecutionContext<Cli>,
    kind: "container" | "network",
    dockerId: string,
    expectedName: string,
  ) {
    const result = await runShort(
      context,
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--no-trunc",
            "--filter",
            `id=${dockerId}`,
            "--format",
            "{{.ID}}",
          ]
        : [
            "network",
            "ls",
            "--no-trunc",
            "--filter",
            `id=${dockerId}`,
            "--format",
            "{{.ID}}",
          ],
    );
    if (
      result?.status !== 0 ||
      result.signal !== null ||
      result.outputExceeded ||
      result.stderr.length !== 0 ||
      result.stdout.trim() !== ""
    )
      return false;
    const named = await runShort(
      context,
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--no-trunc",
            "--filter",
            `name=^/${expectedName}$`,
            "--format",
            "{{.ID}}",
          ]
        : [
            "network",
            "ls",
            "--no-trunc",
            "--filter",
            `name=^${expectedName}$`,
            "--format",
            "{{.ID}}",
          ],
    );
    return (
      named?.status === 0 &&
      named.signal === null &&
      !named.outputExceeded &&
      named.stderr.length === 0 &&
      named.stdout.trim() === ""
    );
  }

  /**
   * 検査済み実IDの資源だけを回収する。
   *
   * @responsibility 要求状態・実ID・構成・処置・終了後不存在を同じ資源へ結合する。
   * @trace ARCH-000008
   * @input context、kind、state、expectedName、ownershipLabel、expectedImage、shouldBeInternal、purpose、plan: 元資源のReceiptと技術構成。
   * @returns 明示未要求または検査・処置・不存在成立時だけtrue。
   * @precondition 同じOwnerのReceiptを用い、要求済みなら実IDを持つ。
   * @postcondition 実ID不明・他Owner・構成不一致の資源を処置しない。
   * @effect owned確認後だけ実Docker IDを指定してContainer／Networkを削除する。
   * @failure 作成結果不明・観測失敗・削除失敗・残存はfalse。
   * @invariant 名前だけの強制削除や作成結果の再構成を行わない。
   * @boundary 検査済みDocker資源の処置と終了後観測。
   * @security 他OwnerのID・構成を取り込まず、実IDと名前の双方を再観測する。
   * @concurrency 検査後に処置し、結果を再観測する。競合や不明は成功にしない。
   */
  async function removeExactResource(
    context: ExecutionContext<Cli>,
    kind: "container" | "network",
    state: Readonly<{ submitted: boolean; dockerId: string | null }>,
    expectedName: string,
    ownershipLabel: string,
    expectedImage: string | null,
    shouldBeInternal: boolean | null,
    purpose:
      | "create_subscription_auth_probe"
      | "create_internal_network"
      | "create_egress_network"
      | "create_proxy"
      | "create_provider",
    plan: DockerIsolationRuntimePlan,
  ) {
    if (!state.submitted) return state.dockerId === null;
    if (!state.dockerId) return false;
    const before = await inspectExactResource(
      context,
      kind,
      state.dockerId,
      expectedName,
      ownershipLabel,
      expectedImage,
      shouldBeInternal,
      purpose,
      plan,
    );
    if (before !== "owned") return false;
    const removal = await runShort(
      context,
      kind === "container"
        ? ["container", "rm", "--force", state.dockerId]
        : ["network", "rm", state.dockerId],
    );
    return (
      removal?.status === 0 &&
      removal.signal === null &&
      !removal.outputExceeded &&
      (await exactResourceAbsent(context, kind, state.dockerId, expectedName))
    );
  }

  /**
   * 所有 Resourcesを清掃する。
   *
   * @responsibility 所有 Resourcesの清掃対象、完了観測、残存時の失敗境界を所有する。
   * @trace ARCH-000008
   * @input plan: DockerIsolationRuntimePlan、recoveryCapability: object、managementCapability: unknown
   * @returns cleanupOwnedResourcesの計算結果を返す。
   * @precondition planと現在管理Ownerが一致し、本番Receipt読取りは五purposeを明示評価する。
   * @postcondition cleanupOwnedResourcesの責務を完了した結果だけを返す。
   * @effect 所有handleを終端し、検証済みexact Docker資源を回収する。全回収確認後だけ所有configを除去する。
   * @failure cleanupOwnedResourcesは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant Receipt欠測を未要求・不存在へ補完せず、別Identityや観測不能を回収成功にしない。
   * @boundary Docker Isolation所有のProcess、Docker資源とconfigの回収境界。
   * @security cleanupOwnedResourcesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency cleanupOwnedResourcesは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
   */
  async function cleanupOwnedResources(
    plan: DockerIsolationRuntimePlan,
    recoveryCapability: object,
    managementCapability: unknown,
    sessionReceipts?: DockerResourceReceipts,
  ) {
    if (
      !recoveryCapability ||
      typeof recoveryCapability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object"
    ) {
      return Object.freeze({
        confirmed: false,
        processTreeTerminated: false,
        containersAbsent: false,
        networksAbsent: false,
        resourceObservations: null,
      });
    }
    let context: ExecutionContext<Cli>;
    try {
      context = contextFor(plan, managementCapability);
    } catch {
      return Object.freeze({
        confirmed: false,
        processTreeTerminated: false,
        containersAbsent: false,
        networksAbsent: false,
        resourceObservations: null,
      });
    }
    const stoppedPlans =
      stoppedAttempts.get(managementCapability) ?? new Set<string>();
    stoppedPlans.add(context.planIdentity);
    stoppedAttempts.set(managementCapability, stoppedPlans);
    let processTreeTerminated = true;
    for (const handle of [...context.handles]) {
      if (!(await handle.terminateAndWait(5_000)) || !handle.closed())
        processTreeTerminated = false;
    }
    const receipts =
      sessionReceipts ??
      (dependencies.inspectReceipts
        ? dependencies.inspectReceipts(recoveryCapability)
        : null);
    const providerReceipt = receipts?.create_provider;
    const authReceipt = receipts?.create_subscription_auth_probe;
    const proxyReceipt = receipts?.create_proxy;
    const internalReceipt = receipts?.create_internal_network;
    const egressReceipt = receipts?.create_egress_network;
    if (
      !providerReceipt ||
      !authReceipt ||
      !proxyReceipt ||
      !internalReceipt ||
      !egressReceipt
    ) {
      return Object.freeze({
        confirmed: false,
        processTreeTerminated,
        containersAbsent: false,
        networksAbsent: false,
        resourceObservations: null,
      });
    }
    const providerAbsent = await removeExactResource(
      context,
      "container",
      providerReceipt,
      plan.configuration.executionContainerName,
      plan.configuration.ownershipLabel,
      plan.configuration.executionImageDigest,
      null,
      "create_provider",
      plan,
    );
    const authAbsent = await removeExactResource(
      context,
      "container",
      authReceipt,
      plan.configuration.authenticationContainerName,
      plan.configuration.ownershipLabel,
      plan.configuration.executionImageDigest,
      null,
      "create_subscription_auth_probe",
      plan,
    );
    const proxyAbsent = await removeExactResource(
      context,
      "container",
      proxyReceipt,
      plan.configuration.proxyContainerName,
      plan.configuration.ownershipLabel,
      plan.configuration.proxyImageDigest,
      null,
      "create_proxy",
      plan,
    );
    const internalAbsent = await removeExactResource(
      context,
      "network",
      internalReceipt,
      plan.configuration.internalNetworkName,
      plan.configuration.ownershipLabel,
      null,
      true,
      "create_internal_network",
      plan,
    );
    const egressAbsent = await removeExactResource(
      context,
      "network",
      egressReceipt,
      plan.configuration.egressNetworkName,
      plan.configuration.ownershipLabel,
      null,
      false,
      "create_egress_network",
      plan,
    );
    const containersAbsent = providerAbsent && authAbsent && proxyAbsent;
    const networksAbsent = internalAbsent && egressAbsent;
    let configRemoved = false;
    processTreeTerminated =
      processTreeTerminated &&
      [...context.handles].every((handle) => handle.closed());
    if (
      processTreeTerminated &&
      containersAbsent &&
      networksAbsent &&
      dependencies.configEntries(context.configDirectory).length === 0
    ) {
      dependencies.verifyConfig(
        context.configDirectory,
        context.configIdentity,
      );
      dependencies.removeConfig(context.configDirectory);
      contexts.delete(managementCapability);
      configRemoved = true;
    }
    const confirmed =
      processTreeTerminated &&
      containersAbsent &&
      networksAbsent &&
      configRemoved;
    const resourceObservations: readonly DockerResourceCleanupObservation[] =
      Object.freeze(
        (
          [
            [
              "create_egress_network",
              plan.configuration.egressNetworkName,
              egressReceipt,
              egressAbsent,
            ],
            [
              "create_internal_network",
              plan.configuration.internalNetworkName,
              internalReceipt,
              internalAbsent,
            ],
            [
              "create_provider",
              plan.configuration.executionContainerName,
              providerReceipt,
              providerAbsent,
            ],
            [
              "create_proxy",
              plan.configuration.proxyContainerName,
              proxyReceipt,
              proxyAbsent,
            ],
            [
              "create_subscription_auth_probe",
              plan.configuration.authenticationContainerName,
              authReceipt,
              authAbsent,
            ],
          ] as const
        ).map(([purpose, plannedResourceName, receipt, isAbsent]) =>
          Object.freeze({
            purpose,
            plannedResourceName,
            dockerId: receipt.dockerId,
            observation:
              !receipt.submitted && receipt.dockerId === null
                ? "not_requested"
                : isAbsent
                  ? "absent"
                  : "unknown",
          }),
        ),
      );
    const result = Object.freeze({
      confirmed,
      processTreeTerminated,
      containersAbsent,
      networksAbsent,
      resourceObservations,
    });
    if (confirmed) {
      cleanupResults.set(
        result,
        Object.freeze({
          managementCapability,
          recoveryCapability,
          planIdentity: context.planIdentity,
          callerIdentity: plan.identity,
          observations: resourceObservations,
        }),
      );
    }
    return result;
  }

  /**
   * 同じ操作・計画の実清掃結果から終端観測を取得する。
   *
   * @responsibility このRuntimeが返した清掃結果のobject同一性と操作相関を照合する。
   * @trace ARCH-000008
   * @input result、callerIdentity、recoveryCapability、managementCapability: 元の実結果と上位相関、Owner。
   * @returns 同じ計画の五purpose観測。不一致ならnull。
   * @precondition 結果は同じRuntimeの実清掃返却である。
   * @postcondition コピー・別操作・別計画の結果を受理しない。
   * @effect N/A: 内部WeakMapの読取りだけで外部処置を発行しない。
   * @failure 未登録・不一致の結果はnullへ閉じる。
   * @invariant 清掃結果の保持は実行Authorityを発行しない。
   * @boundary Runtime自身の返却と利用側の終端照合の境界。
   * @security 模擬Runtimeと本番Runtimeの根拠集合を共有しない。
   * @concurrency N/A: awaitを含まない同期照合である。
   */
  function verifyCleanupOutcome(
    result: unknown,
    callerIdentity: string,
    recoveryCapability: unknown,
    managementCapability: unknown,
  ) {
    if (!result || typeof result !== "object") return null;
    const recorded = cleanupResults.get(result);
    if (
      !recorded ||
      recorded.managementCapability !== managementCapability ||
      recorded.recoveryCapability !== recoveryCapability ||
      recorded.callerIdentity !== callerIdentity ||
      !stoppedAttempts
        .get(recorded.managementCapability)
        ?.has(recorded.planIdentity)
    )
      return null;
    return recorded.observations;
  }

  /**
   * 同じ固定Runtimeで九目的のSessionを開始する。
   * @responsibility Handle・取消・清掃を上位から隠して同じ技術Ownerへ閉じる。
   * @trace ARCH-000008
   * @input plan、recoveryCapability、managementCapability: 元計画とOwner。hooks: 有限同期接続。
   * @returns 不透明cancelとcompletion。
   * @precondition 上位が相関・許可を検査している。
   * @postcondition 元清掃と元Runtimeによる照合結果だけを返す。
   * @effect 固定Docker実行と所有資源回収を行う。
   * @failure 起動・Gate・観測不明も同じ清掃へ収束する。
   * @invariant 上位の意味・Store・OS選択を受け取らない。
   * @boundary 検証済み技術構成と有限Gate。
   * @security 本番primitiveはFactory内の固定値。
   * @concurrency Session返却後に開始し、取消と終端を一回化する。
   */
  function startExecution(
    plan: DockerIsolationRuntimePlan,
    recoveryCapability: object,
    managementCapability: unknown,
    hooks: DockerExecutionCallbacks,
  ) {
    const commands = planDockerIsolationCommands(plan.configuration);
    return startDockerCommandSession(
      commands?.map((command) => command.purpose) ?? [],
      {
        startCommand: (purpose) =>
          startCommand(purpose, plan, managementCapability),
        cleanup: (receipts) =>
          cleanupOwnedResources(
            plan,
            recoveryCapability,
            managementCapability,
            receipts,
          ),
        verifyCleanup: (result) =>
          verifyCleanupOutcome(
            result,
            plan.identity,
            recoveryCapability,
            managementCapability,
          ),
      },
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
