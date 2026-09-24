/**
 * docker-effect-runtimeに属する責務をまとめる。
 *
 * @responsibility Commandを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  planClaudeIsolatedTask,
  planClaudeReadOnlyProbe,
} from "./claude-execution-plan.ts";
import {
  planCodexIsolatedTask,
  planCodexReadOnlyProbe,
} from "./codex-execution-plan.ts";
import { resolveFixedCodexExecutorSeccompProfile } from "./codex-executor-seccomp.ts";
import {
  DOCKER_CLI_EXECUTABLE,
  type DockerCliTrustSnapshot,
  describeDockerCliTrustContract,
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "./docker-cli-trust.ts";
import {
  createDockerProcessEnvironment,
  type OwnedCommandHandle,
  STDOUT_LIMIT_BYTES,
  startOwnedProcess,
} from "./docker-owned-process.ts";
import { inspectRuntimeOwnedDockerResourceReceipts } from "./docker-recovery-runtime.ts";
import { describeEgressProxyTopology } from "./egress-proxy-policy.ts";
import { borrowOwnedDockerExecutionPaths } from "./execution-environment.ts";

export const DOCKER_EFFECT_RUNTIME_CONTRACT =
  "crdd-coordinator/docker-effect-runtime";
export const DOCKER_EFFECT_RUNTIME_CONTRACT_REVISION = 9;

const DOCKER_ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";
const DOCKER_CONFIG_DIRECTORY = "docker-cli-config";
const SHORT_COMMAND_TIMEOUT_MS = 10_000;
const PROVIDER_INPUT_LIMIT_BYTES = 128 * 1024;
const SAFE_IDENTIFIER =
  /^crdd-(?:auth|internal|egress|proxy|claude|codex)-[a-f0-9]{16}$/u;
const SAFE_IMAGE_DIGEST = /^sha256:[a-f0-9]{64}$/u;
const SAFE_OWNERSHIP_LABEL = /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u;

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
  operationMode: "boolean_probe" | "isolated_task";
  taskRole: "executor" | "reviewer" | null;
  taskWorkload?: unknown;
  taskPacketRef: string | null;
  taskPacketHash: string | null;
  providerInput: string | null;
  workspaceSourcePath: string | null;
  workspaceMountMode: "read_write" | "read_only" | null;
  commands: readonly Command[];
}>;
/**
 * docker-effect-runtimeで使用するCli Snapshotの値契約を定義する。
 *
 * @responsibility Cli SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape CliSnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CliSnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: CliSnapshotの宣言は外部境界を開かない。
 * @security CliSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CliSnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CliSnapshot = DockerCliTrustSnapshot;
/**
 * docker-effect-runtimeで使用するExecution Contextの値契約を定義する。
 *
 * @responsibility Execution ContextのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ExecutionContextが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionContextで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionContextの宣言は外部境界を開かない。
 * @security ExecutionContextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ExecutionContextの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ExecutionContext = {
  planIdentity: string;
  configDirectory: string;
  configIdentity: string;
  cli: CliSnapshot;
  handles: Set<OwnedCommandHandle>;
};
/**
 * docker-effect-runtimeで使用するRuntime Dependenciesの値契約を定義する。
 *
 * @responsibility Runtime DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDependenciesの宣言は外部境界を開かない。
 * @security RuntimeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeDependencies = Readonly<{
  platform: string;
  borrowPaths: typeof borrowOwnedDockerExecutionPaths;
  readCli: () => CliSnapshot;
  verifyCli: (snapshot: CliSnapshot) => void;
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
  inspectReceipts?: typeof inspectRuntimeOwnedDockerResourceReceipts;
}>;

/**
 * filesystem Identityを決定する。
 *
 * @responsibility filesystem Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string、expected: "file" | "directory"
 * @returns filesystemIdentityの計算結果を返す。
 * @precondition 「target: string、expected: "file" | "directory"」がfilesystemIdentityの入力契約を満たす。
 * @postcondition filesystemIdentityの責務を完了した結果だけを返す。
 * @effect filesystemIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure filesystemIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant filesystemIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security filesystemIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: filesystemIdentityは共有非同期状態を持たない同期処理である。
 */
function filesystemIdentity(target: string, expected: "file" | "directory") {
  const metadata = fs.lstatSync(target, { bigint: true });
  const isValidType =
    expected === "file" ? metadata.isFile() : metadata.isDirectory();
  if (
    !isValidType ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("docker_effect_filesystem_identity_invalid");
  }
  return `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`;
}

/**
 * Cli Snapshotを読み取る。
 *
 * @responsibility Cli Snapshotの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns CliSnapshotを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がreadCliSnapshotの入力契約を満たす。
 * @postcondition readCliSnapshotの責務を完了した結果だけを返す。
 * @effect N/A: readCliSnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readCliSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readCliSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readCliSnapshotはProcess内の同一Subsystemで完結する。
 * @security readCliSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readCliSnapshotは共有非同期状態を持たない同期処理である。
 */
function readCliSnapshot(): CliSnapshot {
  try {
    return observeTrustedDockerCli();
  } catch {
    throw new Error("docker_effect_cli_untrusted");
  }
}

/**
 * Cli Snapshotを検証する。
 *
 * @responsibility Cli Snapshotの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input snapshot: CliSnapshot
 * @returns N/A: verifyCliSnapshotは戻り値を返さない。
 * @precondition 「snapshot: CliSnapshot」がverifyCliSnapshotの入力契約を満たす。
 * @postcondition verifyCliSnapshotの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: verifyCliSnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyCliSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyCliSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyCliSnapshotはProcess内の同一Subsystemで完結する。
 * @security verifyCliSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyCliSnapshotは共有非同期状態を持たない同期処理である。
 */
function verifyCliSnapshot(snapshot: CliSnapshot) {
  try {
    verifyTrustedDockerCliSnapshot(snapshot);
  } catch {
    throw new Error("docker_effect_cli_replaced");
  }
}

/**
 * Config Directoryを構築する。
 *
 * @responsibility Config Directoryの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input managementPath: string
 * @returns createConfigDirectoryの計算結果を返す。
 * @precondition 「managementPath: string」がcreateConfigDirectoryの入力契約を満たす。
 * @postcondition createConfigDirectoryの責務を完了した結果だけを返す。
 * @effect createConfigDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure createConfigDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createConfigDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createConfigDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createConfigDirectoryは共有非同期状態を持たない同期処理である。
 */
function createConfigDirectory(managementPath: string) {
  const directory = path.join(managementPath, DOCKER_CONFIG_DIRECTORY);
  fs.mkdirSync(directory, { recursive: false, mode: 0o700 });
  const realDirectory = fs.realpathSync(directory);
  if (realDirectory !== directory)
    throw new Error("docker_effect_config_replaced");
  return Object.freeze({
    directory: realDirectory,
    identity: filesystemIdentity(realDirectory, "directory"),
  });
}

/**
 * Config Directoryを検証する。
 *
 * @responsibility Config Directoryの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input directory: string、identity: string
 * @returns N/A: verifyConfigDirectoryは戻り値を返さない。
 * @precondition 「directory: string、identity: string」がverifyConfigDirectoryの入力契約を満たす。
 * @postcondition verifyConfigDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect verifyConfigDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure verifyConfigDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyConfigDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security verifyConfigDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyConfigDirectoryは共有非同期状態を持たない同期処理である。
 */
function verifyConfigDirectory(directory: string, identity: string) {
  if (
    fs.realpathSync(directory) !== directory ||
    filesystemIdentity(directory, "directory") !== identity
  ) {
    throw new Error("docker_effect_config_replaced");
  }
}

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
function expectedCommands(
  plan: PreparedPlan,
  tmpSourcePath: string,
): readonly Command[] | null {
  const providerPlan =
    plan.provider === "codex"
      ? plan.operationMode === "isolated_task"
        ? planCodexIsolatedTask({
            provider: "codex",
            mode: "isolated_task",
            effort: plan.selectedEffort,
            taskRole: plan.taskRole,
          })
        : planCodexReadOnlyProbe({
            provider: "codex",
            mode: "read_only_probe",
            effort: plan.selectedEffort,
          })
      : plan.operationMode === "isolated_task"
        ? planClaudeIsolatedTask({
            provider: "claude",
            mode: "isolated_task",
            taskRole: plan.taskRole,
            effort: plan.selectedEffort,
            taskWorkload: plan.taskWorkload,
          })
        : planClaudeReadOnlyProbe({
            provider: "claude",
            mode: "read_only_probe",
          });
  const egress = describeEgressProxyTopology(plan.provider);
  if (
    providerPlan.status !== "candidate" ||
    egress.verificationAdapter.imageDigest !== plan.proxyImageDigest ||
    providerPlan.distributionBinding.fixedImageDigest !==
      plan.providerImageDigest
  ) {
    return null;
  }
  const proxyCommand = plan.commands[4];
  const proxyAuth = proxyCommand?.argv.find((value) =>
    value.startsWith("CRDD_PROXY_AUTH="),
  );
  const proxyProfile = proxyCommand?.argv.find((value) =>
    value.startsWith("CRDD_PROXY_PROFILE="),
  );
  const proxyToken = proxyAuth?.slice("CRDD_PROXY_AUTH=".length) ?? "";
  if (
    !proxyAuth ||
    proxyProfile !== `CRDD_PROXY_PROFILE=${plan.provider}` ||
    !/^[a-f0-9]{64}$/u.test(proxyToken)
  ) {
    return null;
  }
  const providerEnvironmentEntries = [
    "--env",
    "HOME=/provider-home",
    "--env",
    "TMPDIR=/tmp",
    "--env",
    `HTTPS_PROXY=http://crdd:${proxyToken}@proxy:${egress.containerPort}`,
    ...(plan.provider === "codex"
      ? [
          "--env",
          `HTTP_PROXY=http://crdd:${proxyToken}@proxy:${egress.containerPort}`,
          "--env",
          `ALL_PROXY=http://crdd:${proxyToken}@proxy:${egress.containerPort}`,
          "--env",
          "NO_PROXY=",
        ]
      : []),
    ...Object.entries(providerPlan.environment).flatMap(([name, value]) => [
      "--env",
      `${name}=${value}`,
    ]),
  ];
  const providerHomeMount = `type=bind,src=${plan.providerHomeSourcePath},dst=/provider-home,bind-propagation=rprivate`;
  const tmpMount = `type=bind,src=${tmpSourcePath},dst=/tmp,bind-propagation=rprivate`;
  const workspaceMount =
    plan.operationMode === "isolated_task" && plan.workspaceSourcePath
      ? `type=bind,src=${plan.workspaceSourcePath},dst=/work,bind-propagation=rprivate${
          plan.workspaceMountMode === "read_only" ? ",readonly" : ""
        }`
      : null;
  const providerIdentity = providerPlan.distributionBinding.identity;
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
      ? resolveFixedCodexExecutorSeccompProfile(
          codexSeccompIdentity.executorSeccompProfileSha256,
          codexSeccompIdentity.executorSeccompProfileBytes,
        )
      : null;
  if (
    plan.provider === "codex" &&
    plan.operationMode === "isolated_task" &&
    plan.taskRole === "executor" &&
    !codexExecutorSeccompProfile
  ) {
    return null;
  }
  const commands = [
    [
      "create",
      "--pull=never",
      "--network=none",
      "--read-only",
      "--name",
      plan.authContainerName,
      "--label",
      plan.ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=32",
      "--user=65534:65534",
      "--env",
      "HOME=/provider-home",
      ...(plan.provider === "codex"
        ? ["--env", "CODEX_HOME=/provider-home"]
        : []),
      "--mount",
      `${providerHomeMount},readonly`,
      plan.providerImageDigest,
      ...(plan.provider === "codex"
        ? ["login", "status"]
        : ["auth", "status", "--json"]),
    ],
    ["start", "--attach", plan.authContainerName],
    [
      "network",
      "create",
      "--driver=bridge",
      "--internal",
      "--label",
      plan.ownershipLabel,
      plan.internalNetworkName,
    ],
    [
      "network",
      "create",
      "--driver=bridge",
      "--label",
      plan.ownershipLabel,
      plan.egressNetworkName,
    ],
    [
      "create",
      "--pull=never",
      "--network",
      plan.internalNetworkName,
      "--network-alias",
      "proxy",
      "--read-only",
      "--name",
      plan.proxyContainerName,
      "--label",
      plan.ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=64",
      "--user=65534:65534",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=16777216",
      "--env",
      proxyAuth,
      "--env",
      proxyProfile,
      plan.proxyImageDigest,
    ],
    ["network", "connect", plan.egressNetworkName, plan.proxyContainerName],
    [
      "create",
      ...(plan.operationMode === "isolated_task" ? ["--interactive"] : []),
      "--pull=never",
      "--network",
      plan.internalNetworkName,
      "--read-only",
      "--name",
      plan.providerContainerName,
      "--label",
      plan.ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      ...(codexExecutorSeccompProfile
        ? [`--security-opt=seccomp=${codexExecutorSeccompProfile}`]
        : []),
      "--pids-limit=64",
      "--user=65534:65534",
      "--workdir=/work",
      ...providerEnvironmentEntries,
      "--mount",
      providerHomeMount,
      "--mount",
      tmpMount,
      ...(workspaceMount ? ["--mount", workspaceMount] : []),
      plan.providerImageDigest,
      ...(plan.provider === "claude"
        ? ["--model", plan.selectedModel, "--effort", plan.selectedEffort]
        : []),
      ...providerPlan.argv,
    ],
    ["start", plan.proxyContainerName],
    [
      "start",
      "--attach",
      ...(plan.operationMode === "isolated_task" ? ["--interactive"] : []),
      plan.providerContainerName,
    ],
  ];
  const purposes = [
    "create_subscription_auth_probe",
    "start_subscription_auth_probe_attached",
    "create_internal_network",
    "create_egress_network",
    "create_proxy",
    "connect_proxy_egress",
    "create_provider",
    "start_proxy",
    "start_provider_attached",
  ];
  return Object.freeze(
    commands.map((argv, index) =>
      Object.freeze({
        purpose: purposes[index] ?? "",
        argv: Object.freeze(argv),
      }),
    ),
  );
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
  const isProviderBindingValid =
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
    !SAFE_IMAGE_DIGEST.test(plan.providerImageDigest) ||
    !SAFE_IMAGE_DIGEST.test(plan.proxyImageDigest) ||
    !SAFE_OWNERSHIP_LABEL.test(plan.ownershipLabel) ||
    !["low", "medium", "high"].includes(plan.selectedEffort) ||
    !["preferred", "upper_allowed"].includes(plan.selectedModelTier) ||
    [
      plan.providerContainerName,
      plan.authContainerName,
      plan.proxyContainerName,
      plan.internalNetworkName,
      plan.egressNetworkName,
    ].some((value) => !SAFE_IDENTIFIER.test(value)) ||
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
    (plan.operationMode !== "boolean_probe" && !isTaskPlan) ||
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
    (!isTaskPlan &&
      (plan.taskRole !== null ||
        plan.taskPacketRef !== null ||
        plan.taskPacketHash !== null ||
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
        ownershipLabel: plan.ownershipLabel,
        commands: plan.commands,
      }),
    )
    .digest("hex");
}

/**
 * Runtimeを構築する。
 *
 * @responsibility Runtimeの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RuntimeDependencies
 * @returns createRuntimeの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateRuntimeの入力契約を満たす。
 * @postcondition createRuntimeの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeはProcess内の同一Subsystemで完結する。
 * @security createRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency createRuntimeは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function createRuntime(dependencies: RuntimeDependencies) {
  const contexts = new WeakMap<object, ExecutionContext>();

  /**
   * context Forを決定する。
   *
   * @responsibility context Forの導出に必要な入力、判定規則、返却結果の境界を所有する。
   * @trace ARCH-000008
   * @input plan: PreparedPlan、managementCapability: object
   * @returns contextForの計算結果を返す。
   * @precondition 「plan: PreparedPlan、managementCapability: object」がcontextForの入力契約を満たす。
   * @postcondition contextForの責務を完了した結果だけを返す。
   * @effect N/A: contextForは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure contextForは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant contextForは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: contextForはProcess内の同一Subsystemで完結する。
   * @security contextForはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: contextForは共有非同期状態を持たない同期処理である。
   */
  function contextFor(plan: PreparedPlan, managementCapability: object) {
    const paths = dependencies.borrowPaths(managementCapability);
    if (!validatePlan(plan, paths.tmp))
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
    if (dependencies.platform !== "win32")
      throw new Error("docker_effect_platform_unsupported");
    const cli = dependencies.readCli();
    const config = dependencies.createConfig(paths.management);
    const context: ExecutionContext = {
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
   * Commandを開始する。
   *
   * @responsibility Commandの開始条件、Effect発行、開始失敗時の終了境界を所有する。
   * @trace ARCH-000008
   * @input command: Command、plan: PreparedPlan、managementCapability: unknown
   * @returns OwnedCommandHandleを返す。
   * @precondition 「command: Command、plan: PreparedPlan、managementCapability: unknown」がstartCommandの入力契約を満たす。
   * @postcondition startCommandの責務を完了した結果だけを返す。
   * @effect N/A: startCommandは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure startCommandは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant startCommandは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: startCommandはProcess内の同一Subsystemで完結する。
   * @security startCommandはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: startCommandは共有非同期状態を持たない同期処理である。
   */
  function startCommand(
    command: Command,
    plan: PreparedPlan,
    managementCapability: unknown,
  ): OwnedCommandHandle {
    if (!managementCapability || typeof managementCapability !== "object")
      throw new Error("docker_effect_management_required");
    const context = contextFor(plan, managementCapability);
    const expected = plan.commands.find(
      (candidate) => candidate.purpose === command.purpose,
    );
    if (!expected || expected !== command)
      throw new Error("docker_effect_command_not_owned");
    dependencies.verifyCli(context.cli);
    const handle = dependencies.startProcess(
      DOCKER_CLI_EXECUTABLE,
      [
        "--host",
        DOCKER_ENGINE,
        "--config",
        context.configDirectory,
        ...command.argv,
      ],
      createDockerProcessEnvironment(),
      command.purpose === "start_provider_attached" ? plan.providerInput : null,
    );
    context.handles.add(handle);
    return handle;
  }

  /**
   * Shortを実行する。
   *
   * @responsibility Shortの実行条件、Effect範囲、終了結果の境界を所有する。
   * @trace ARCH-000008
   * @input context: ExecutionContext、argv: readonly string[]
   * @returns runShortの計算結果を返す。
   * @precondition 「context: ExecutionContext、argv: readonly string[]」がrunShortの入力契約を満たす。
   * @postcondition runShortの責務を完了した結果だけを返す。
   * @effect N/A: runShortは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: runShortは独自の失敗分岐を所有しない。
   * @invariant runShortは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: runShortはProcess内の同一Subsystemで完結する。
   * @security runShortはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency runShortは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
   */
  async function runShort(context: ExecutionContext, argv: readonly string[]) {
    dependencies.verifyCli(context.cli);
    const handle = dependencies.startProcess(
      DOCKER_CLI_EXECUTABLE,
      ["--host", DOCKER_ENGINE, "--config", context.configDirectory, ...argv],
      createDockerProcessEnvironment(),
      null,
    );
    context.handles.add(handle);
    const result = await handle.wait(SHORT_COMMAND_TIMEOUT_MS);
    if (!handle.closed()) await handle.terminateAndWait(5_000);
    if (handle.closed()) context.handles.delete(handle);
    return result;
  }

  /**
   * Exact Resourceを観測する。
   *
   * @responsibility Exact Resourceの観測対象、取得根拠、観測不能結果の境界を所有する。
   * @trace ARCH-000008
   * @input context: ExecutionContext、kind: "container" | "network"、dockerId: string、expectedName: string、ownershipLabel: string、expectedImage: string | null、shouldBeInternal: boolean | null、purpose: | "create_subscription_auth_probe" | "create_internal_network" | "create_egress_network" | "create_proxy" | "create_provider"、plan: PreparedPlan
   * @returns inspectExactResourceの計算結果を返す。
   * @precondition 「context: ExecutionContext、kind: "container" | "network"、dockerId: string、expectedName: string、ownershipLabel: string、expectedImage: string | null、shouldBeInternal: boolean | null、purpose: | "create_subscription_auth_probe" | "create_internal_network" | "create_egress_network" | "create_proxy" | "create_provider"、plan: PreparedPlan」がinspectExactResourceの入力契約を満たす。
   * @postcondition inspectExactResourceの責務を完了した結果だけを返す。
   * @effect N/A: inspectExactResourceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure inspectExactResourceは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant inspectExactResourceは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: inspectExactResourceはProcess内の同一Subsystemで完結する。
   * @security inspectExactResourceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency inspectExactResourceは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
   */
  async function inspectExactResource(
    context: ExecutionContext,
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
    plan: PreparedPlan,
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
    const resource = parsed[0] as Record<string, unknown>;
    const labels =
      kind === "container"
        ? (resource.Config as Record<string, unknown> | undefined)?.Labels
        : resource.Labels;
    const labelValue = ownershipLabel.slice(ownershipLabel.indexOf("=") + 1);
    const name = kind === "container" ? resource.Name : resource.Name;
    const normalizedName =
      kind === "container" && typeof name === "string" && name.startsWith("/")
        ? name.slice(1)
        : name;
    const configurationMatches = (() => {
      if (kind === "network")
        return resource.Driver === "bridge" && resource.Scope === "local";
      const config = resource.Config as Record<string, unknown> | undefined;
      const hostConfig = resource.HostConfig as
        | Record<string, unknown>
        | undefined;
      const networkSettings = resource.NetworkSettings as
        | Record<string, unknown>
        | undefined;
      const networks = networkSettings?.Networks;
      const networkNames =
        networks && typeof networks === "object" && !Array.isArray(networks)
          ? Object.keys(networks as Record<string, unknown>).sort()
          : [];
      const expectedNetworks =
        purpose === "create_subscription_auth_probe"
          ? ["none"]
          : purpose === "create_proxy"
            ? [plan.egressNetworkName, plan.internalNetworkName].sort()
            : [plan.internalNetworkName];
      const droppedCapabilities = Array.isArray(hostConfig?.CapDrop)
        ? hostConfig.CapDrop.map(String)
        : [];
      const capAdd = hostConfig?.CapAdd;
      const securityOptions = Array.isArray(hostConfig?.SecurityOpt)
        ? hostConfig.SecurityOpt.map(String)
        : [];
      const expectedPids =
        purpose === "create_subscription_auth_probe" ? 32 : 64;
      const bindMounts = Array.isArray(resource.Mounts)
        ? (resource.Mounts as Array<Record<string, unknown>>).filter(
            (mount) => mount.Type === "bind",
          )
        : [];
      const expectedMounts =
        purpose === "create_subscription_auth_probe"
          ? [{ destination: "/provider-home", readWrite: false }]
          : purpose === "create_provider"
            ? [
                { destination: "/provider-home", readWrite: true },
                { destination: "/tmp", readWrite: true },
                ...(plan.operationMode === "isolated_task"
                  ? [
                      {
                        destination: "/work",
                        readWrite: plan.workspaceMountMode !== "read_only",
                      },
                    ]
                  : []),
              ]
            : [];
      const observedMounts = bindMounts
        .map((mount) => ({
          destination: mount.Destination,
          readWrite: mount.RW,
          propagation: mount.Propagation,
        }))
        .sort((left, right) =>
          String(left.destination).localeCompare(String(right.destination)),
        );
      const sortedExpectedMounts = [...expectedMounts].sort((left, right) =>
        left.destination.localeCompare(right.destination),
      );
      const mountsMatch =
        observedMounts.length === sortedExpectedMounts.length &&
        observedMounts.every(
          (mount, index) =>
            mount.destination === sortedExpectedMounts[index]?.destination &&
            mount.readWrite === sortedExpectedMounts[index]?.readWrite &&
            mount.propagation === "rprivate",
        );
      const tmpfs = hostConfig?.Tmpfs;
      const proxyTmpfsMatches =
        purpose !== "create_proxy" ||
        (tmpfs !== null &&
          typeof tmpfs === "object" &&
          !Array.isArray(tmpfs) &&
          Object.keys(tmpfs as Record<string, unknown>).length === 1 &&
          typeof (tmpfs as Record<string, unknown>)["/tmp"] === "string" &&
          String((tmpfs as Record<string, unknown>)["/tmp"]).includes(
            "noexec",
          ) &&
          String((tmpfs as Record<string, unknown>)["/tmp"]).includes(
            "nosuid",
          ) &&
          String((tmpfs as Record<string, unknown>)["/tmp"]).includes(
            "size=16777216",
          ));
      return (
        config?.User === "65534:65534" &&
        hostConfig?.ReadonlyRootfs === true &&
        hostConfig?.Privileged === false &&
        droppedCapabilities.length === 1 &&
        droppedCapabilities[0]?.toUpperCase() === "ALL" &&
        (capAdd === null || (Array.isArray(capAdd) && capAdd.length === 0)) &&
        securityOptions.some((option) =>
          option.startsWith("no-new-privileges"),
        ) &&
        hostConfig?.PidsLimit === expectedPids &&
        networkNames.length === expectedNetworks.length &&
        networkNames.every(
          (value, index) => value === expectedNetworks[index],
        ) &&
        mountsMatch &&
        proxyTmpfsMatches
      );
    })();
    if (
      resource.Id !== dockerId ||
      normalizedName !== expectedName ||
      !labels ||
      typeof labels !== "object" ||
      (labels as Record<string, unknown>)["crdd.coordinator.runtime"] !==
        labelValue ||
      (kind === "container" &&
        (resource.Config as Record<string, unknown> | undefined)?.Image !==
          expectedImage) ||
      (kind === "network" && resource.Internal !== shouldBeInternal) ||
      !configurationMatches
    )
      return "foreign" as const;
    return "owned" as const;
  }

  /**
   * 候補 Resource By Nameを除去する。
   *
   * @responsibility 候補 Resource By Nameの対象Identity、除去条件、終了後状態の境界を所有する。
   * @trace ARCH-000008
   * @input context: ExecutionContext、kind: "container" | "network"、name: string、ownershipLabel: string
   * @returns removeCandidateResourceByNameの計算結果を返す。
   * @precondition 「context: ExecutionContext、kind: "container" | "network"、name: string、ownershipLabel: string」がremoveCandidateResourceByNameの入力契約を満たす。
   * @postcondition removeCandidateResourceByNameの責務を完了した結果だけを返す。
   * @effect N/A: removeCandidateResourceByNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: removeCandidateResourceByNameは独自の失敗分岐を所有しない。
   * @invariant removeCandidateResourceByNameは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: removeCandidateResourceByNameはProcess内の同一Subsystemで完結する。
   * @security removeCandidateResourceByNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency removeCandidateResourceByNameは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
   */
  async function removeCandidateResourceByName(
    context: ExecutionContext,
    kind: "container" | "network",
    name: string,
    ownershipLabel: string,
  ) {
    const labelValue = ownershipLabel.slice(ownershipLabel.indexOf("=") + 1);
    const list = await runShort(
      context,
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--filter",
            `name=^/${name}$`,
            "--format",
            '{{.Names}}|{{.Label "crdd.coordinator.runtime"}}',
          ]
        : [
            "network",
            "ls",
            "--filter",
            `name=^${name}$`,
            "--format",
            '{{.Name}}|{{.Label "crdd.coordinator.runtime"}}',
          ],
    );
    if (
      list?.status !== 0 ||
      list.signal !== null ||
      list.outputExceeded ||
      list.stderr.length !== 0
    )
      return false;
    const lines = list.stdout.trim() ? list.stdout.trim().split(/\r?\n/u) : [];
    if (lines.length === 0) return true;
    if (lines.length !== 1 || lines[0] !== `${name}|${labelValue}`)
      return false;
    const removal = await runShort(
      context,
      kind === "container"
        ? ["container", "rm", "--force", name]
        : ["network", "rm", name],
    );
    if (
      removal?.status !== 0 ||
      removal.signal !== null ||
      removal.outputExceeded
    )
      return false;
    const after = await runShort(
      context,
      kind === "container"
        ? [
            "container",
            "ls",
            "--all",
            "--filter",
            `name=^/${name}$`,
            "--format",
            '{{.Names}}|{{.Label "crdd.coordinator.runtime"}}',
          ]
        : [
            "network",
            "ls",
            "--filter",
            `name=^${name}$`,
            "--format",
            '{{.Name}}|{{.Label "crdd.coordinator.runtime"}}',
          ],
    );
    return (
      after?.status === 0 &&
      after.stderr.length === 0 &&
      after.stdout.trim() === ""
    );
  }

  /**
   * Resource Absentが完全一致するか判定する。
   *
   * @responsibility Resource Absentの比較対象、完全一致条件、判定結果境界を所有する。
   * @trace ARCH-000008
   * @input context: ExecutionContext、kind: "container" | "network"、dockerId: string、expectedName: string
   * @returns exactResourceAbsentの計算結果を返す。
   * @precondition 「context: ExecutionContext、kind: "container" | "network"、dockerId: string、expectedName: string」がexactResourceAbsentの入力契約を満たす。
   * @postcondition exactResourceAbsentの責務を完了した結果だけを返す。
   * @effect N/A: exactResourceAbsentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: exactResourceAbsentは独自の失敗分岐を所有しない。
   * @invariant exactResourceAbsentは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: exactResourceAbsentはProcess内の同一Subsystemで完結する。
   * @security exactResourceAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency exactResourceAbsentは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
   */
  async function exactResourceAbsent(
    context: ExecutionContext,
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
   * Exact Resourceを除去する。
   *
   * @responsibility Exact Resourceの対象Identity、除去条件、終了後状態の境界を所有する。
   * @trace ARCH-000008
   * @input context: ExecutionContext、kind: "container" | "network"、state: Readonly<{ submitted: boolean; dockerId: string | null }>、expectedName: string、ownershipLabel: string、expectedImage: string | null、shouldBeInternal: boolean | null、purpose: | "create_subscription_auth_probe" | "create_internal_network" | "create_egress_network" | "create_proxy" | "create_provider"、plan: PreparedPlan
   * @returns removeExactResourceの計算結果を返す。
   * @precondition 「context: ExecutionContext、kind: "container" | "network"、state: Readonly<{ submitted: boolean; dockerId: string | null }>、expectedName: string、ownershipLabel: string、expectedImage: string | null、shouldBeInternal: boolean | null、purpose: | "create_subscription_auth_probe" | "create_internal_network" | "create_egress_network" | "create_proxy" | "create_provider"、plan: PreparedPlan」がremoveExactResourceの入力契約を満たす。
   * @postcondition removeExactResourceの責務を完了した結果だけを返す。
   * @effect N/A: removeExactResourceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: removeExactResourceは独自の失敗分岐を所有しない。
   * @invariant removeExactResourceは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: removeExactResourceはProcess内の同一Subsystemで完結する。
   * @security removeExactResourceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency removeExactResourceは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
   */
  async function removeExactResource(
    context: ExecutionContext,
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
    plan: PreparedPlan,
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
   * @input plan: PreparedPlan、recoveryCapability: object、managementCapability: unknown
   * @returns cleanupOwnedResourcesの計算結果を返す。
   * @precondition 「plan: PreparedPlan、recoveryCapability: object、managementCapability: unknown」がcleanupOwnedResourcesの入力契約を満たす。
   * @postcondition cleanupOwnedResourcesの責務を完了した結果だけを返す。
   * @effect N/A: cleanupOwnedResourcesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure cleanupOwnedResourcesは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant cleanupOwnedResourcesは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: cleanupOwnedResourcesはProcess内の同一Subsystemで完結する。
   * @security cleanupOwnedResourcesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency cleanupOwnedResourcesは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
   */
  async function cleanupOwnedResources(
    plan: PreparedPlan,
    recoveryCapability: object,
    managementCapability: unknown,
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
      });
    }
    let context: ExecutionContext;
    try {
      context = contextFor(plan, managementCapability);
    } catch {
      return Object.freeze({
        confirmed: false,
        processTreeTerminated: false,
        containersAbsent: false,
        networksAbsent: false,
      });
    }
    let processTreeTerminated = true;
    for (const handle of [...context.handles]) {
      if (!(await handle.terminateAndWait(5_000)) || !handle.closed())
        processTreeTerminated = false;
    }
    const receipts = dependencies.inspectReceipts
      ? dependencies.inspectReceipts(recoveryCapability)
      : null;
    if (!dependencies.inspectReceipts) {
      const providerAbsent = await removeCandidateResourceByName(
        context,
        "container",
        plan.providerContainerName,
        plan.ownershipLabel,
      );
      const authAbsent = await removeCandidateResourceByName(
        context,
        "container",
        plan.authContainerName,
        plan.ownershipLabel,
      );
      const proxyAbsent = await removeCandidateResourceByName(
        context,
        "container",
        plan.proxyContainerName,
        plan.ownershipLabel,
      );
      const internalAbsent = await removeCandidateResourceByName(
        context,
        "network",
        plan.internalNetworkName,
        plan.ownershipLabel,
      );
      const egressAbsent = await removeCandidateResourceByName(
        context,
        "network",
        plan.egressNetworkName,
        plan.ownershipLabel,
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
      return Object.freeze({
        confirmed:
          processTreeTerminated &&
          containersAbsent &&
          networksAbsent &&
          configRemoved,
        processTreeTerminated,
        containersAbsent,
        networksAbsent,
      });
    }
    if (!receipts) {
      return Object.freeze({
        confirmed: false,
        processTreeTerminated,
        containersAbsent: false,
        networksAbsent: false,
      });
    }
    const providerAbsent = await removeExactResource(
      context,
      "container",
      receipts.create_provider ??
        Object.freeze({ submitted: false, dockerId: null }),
      plan.providerContainerName,
      plan.ownershipLabel,
      plan.providerImageDigest,
      null,
      "create_provider",
      plan,
    );
    const authAbsent = await removeExactResource(
      context,
      "container",
      receipts.create_subscription_auth_probe ??
        Object.freeze({ submitted: false, dockerId: null }),
      plan.authContainerName,
      plan.ownershipLabel,
      plan.providerImageDigest,
      null,
      "create_subscription_auth_probe",
      plan,
    );
    const proxyAbsent = await removeExactResource(
      context,
      "container",
      receipts.create_proxy ??
        Object.freeze({ submitted: false, dockerId: null }),
      plan.proxyContainerName,
      plan.ownershipLabel,
      plan.proxyImageDigest,
      null,
      "create_proxy",
      plan,
    );
    const internalAbsent = await removeExactResource(
      context,
      "network",
      receipts.create_internal_network ??
        Object.freeze({ submitted: false, dockerId: null }),
      plan.internalNetworkName,
      plan.ownershipLabel,
      null,
      true,
      "create_internal_network",
      plan,
    );
    const egressAbsent = await removeExactResource(
      context,
      "network",
      receipts.create_egress_network ??
        Object.freeze({ submitted: false, dockerId: null }),
      plan.egressNetworkName,
      plan.ownershipLabel,
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
    return Object.freeze({
      confirmed,
      processTreeTerminated,
      containersAbsent,
      networksAbsent,
    });
  }

  return Object.freeze({ startCommand, cleanupOwnedResources });
}

const productionRuntime = createRuntime(
  Object.freeze({
    platform: process.platform,
    borrowPaths: borrowOwnedDockerExecutionPaths,
    readCli: readCliSnapshot,
    verifyCli: verifyCliSnapshot,
    createConfig: createConfigDirectory,
    verifyConfig: verifyConfigDirectory,
    configEntries: (directory) => fs.readdirSync(directory),
    removeConfig: (directory) => fs.rmdirSync(directory),
    startProcess: startOwnedProcess,
    inspectReceipts: inspectRuntimeOwnedDockerResourceReceipts,
  }),
);

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
 * Isolated Docker Effect Runtime 候補を構築する。
 *
 * @responsibility Isolated Docker Effect Runtime 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RuntimeDependencies
 * @returns createIsolatedDockerEffectRuntimeCandidateの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateIsolatedDockerEffectRuntimeCandidateの入力契約を満たす。
 * @postcondition createIsolatedDockerEffectRuntimeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedDockerEffectRuntimeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedDockerEffectRuntimeCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedDockerEffectRuntimeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedDockerEffectRuntimeCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedDockerEffectRuntimeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedDockerEffectRuntimeCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedDockerEffectRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  const runtime = createRuntime(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    startCommand: runtime.startCommand,
    cleanupOwnedResources: runtime.cleanupOwnedResources,
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
  return Object.freeze({
    contract: DOCKER_EFFECT_RUNTIME_CONTRACT,
    contractRevision: DOCKER_EFFECT_RUNTIME_CONTRACT_REVISION,
    dockerCli: Object.freeze({
      ...describeDockerCliTrustContract(),
      shellAllowed: false,
    }),
    engine: DOCKER_ENGINE,
    environment: "runtime_owned_minimal_replacement",
    commandPlan:
      "exact_nine_command_subscription_preflight_provider_probe_or_isolated_task",
    taskInput: "runtime_owned_stdin_only_not_docker_argv",
    cleanup:
      "durable_create_receipt_exact_docker_id_name_label_image_and_network_configuration_then_exact_id_and_name_absence",
    processTreeTermination: "taskkill_exact_pid_tree_then_close",
    callerCommandAllowed: false,
    providerEffectAllowed: true,
  });
}
