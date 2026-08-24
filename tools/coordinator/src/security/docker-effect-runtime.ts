import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
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
import { describeEgressProxyTopology } from "./egress-proxy-policy.ts";
import { borrowOwnedDockerExecutionPaths } from "./execution-environment.ts";

export const DOCKER_EFFECT_RUNTIME_CONTRACT =
  "crdd-coordinator/docker-effect-runtime";
export const DOCKER_EFFECT_RUNTIME_CONTRACT_REVISION = 3;

const DOCKER_ROOT = "C:\\Program Files\\Docker\\Docker\\resources\\bin";
const DOCKER_EXECUTABLE = `${DOCKER_ROOT}\\docker.exe`;
const DOCKER_EXECUTABLE_BYTES = 41_631_088;
const DOCKER_EXECUTABLE_SHA256 =
  "C8EAA01D1E78CAECD65D730E670CBFE4DFCE006E1C6F18167C003587CB4BB610";
const DOCKER_ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";
const TASKKILL_EXECUTABLE = "C:\\Windows\\System32\\taskkill.exe";
const DOCKER_CONFIG_DIRECTORY = "docker-cli-config";
const SHORT_COMMAND_TIMEOUT_MS = 10_000;
const STDOUT_LIMIT_BYTES = 1_048_576;
const STDERR_LIMIT_BYTES = 262_144;
const PROVIDER_INPUT_LIMIT_BYTES = 128 * 1024;
const SAFE_IDENTIFIER =
  /^crdd-(?:internal|egress|proxy|claude|codex)-[a-f0-9]{16}$/u;
const SAFE_IMAGE_DIGEST = /^sha256:[a-f0-9]{64}$/u;
const SAFE_OWNERSHIP_LABEL = /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u;

type Command = Readonly<{ purpose: string; argv: readonly string[] }>;
type PreparedPlan = Readonly<{
  provider: "codex" | "claude";
  operationId: string;
  grantRef: string;
  profileId: string;
  activeMountCapability: object;
  authorityUseCapability: object;
  providerHomeSourcePath: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  selectionRecordId: string;
  selectedModel: string;
  selectedEffort: "low" | "medium" | "high";
  selectedModelTier: string;
  operationMode: "boolean_probe" | "isolated_task";
  taskRole: "executor" | "reviewer" | null;
  taskPacketRef: string | null;
  taskPacketHash: string | null;
  providerInput: string | null;
  workspaceSourcePath: string | null;
  workspaceMountMode: "read_write" | "read_only" | null;
  commands: readonly Command[];
}>;
type CommandExecution = Readonly<{
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  outputExceeded: boolean;
}>;
type CommandHandle = Readonly<{
  wait: (timeoutMs: number) => Promise<CommandExecution | null>;
  terminateAndWait: (graceMs: number) => Promise<boolean>;
}>;
type CliSnapshot = Readonly<{
  rootIdentity: string;
  executableIdentity: string;
  sha256: string;
}>;
type ExecutionContext = {
  planIdentity: string;
  configDirectory: string;
  configIdentity: string;
  cli: CliSnapshot;
  handles: Set<OwnedCommandHandle>;
};
type OwnedCommandHandle = CommandHandle & Readonly<{ closed: () => boolean }>;
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
}>;

function filesystemIdentity(target: string, expected: "file" | "directory") {
  const metadata = fs.lstatSync(target, { bigint: true });
  const validType =
    expected === "file" ? metadata.isFile() : metadata.isDirectory();
  if (
    !validType ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("docker_effect_filesystem_identity_invalid");
  }
  return `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`;
}

function readCliSnapshot(): CliSnapshot {
  if (fs.realpathSync(DOCKER_ROOT) !== DOCKER_ROOT)
    throw new Error("docker_effect_cli_untrusted");
  if (fs.realpathSync(DOCKER_EXECUTABLE) !== DOCKER_EXECUTABLE)
    throw new Error("docker_effect_cli_untrusted");
  const metadata = fs.lstatSync(DOCKER_EXECUTABLE);
  if (metadata.size !== DOCKER_EXECUTABLE_BYTES)
    throw new Error("docker_effect_cli_untrusted");
  const sha256 = createHash("sha256")
    .update(fs.readFileSync(DOCKER_EXECUTABLE))
    .digest("hex")
    .toUpperCase();
  if (sha256 !== DOCKER_EXECUTABLE_SHA256)
    throw new Error("docker_effect_cli_untrusted");
  return Object.freeze({
    rootIdentity: filesystemIdentity(DOCKER_ROOT, "directory"),
    executableIdentity: filesystemIdentity(DOCKER_EXECUTABLE, "file"),
    sha256,
  });
}

function verifyCliSnapshot(snapshot: CliSnapshot) {
  const current = readCliSnapshot();
  if (
    current.rootIdentity !== snapshot.rootIdentity ||
    current.executableIdentity !== snapshot.executableIdentity ||
    current.sha256 !== snapshot.sha256
  ) {
    throw new Error("docker_effect_cli_replaced");
  }
}

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

function verifyConfigDirectory(directory: string, identity: string) {
  if (
    fs.realpathSync(directory) !== directory ||
    filesystemIdentity(directory, "directory") !== identity
  ) {
    throw new Error("docker_effect_config_replaced");
  }
}

function dockerEnvironment() {
  return Object.freeze({
    SystemRoot: "C:\\Windows",
    WINDIR: "C:\\Windows",
    SystemDrive: "C:",
    DOCKER_CLI_HINTS: "false",
  });
}

function buffersToExecution(
  child: ChildProcess,
  stdoutChunks: Buffer[],
  stderrChunks: Buffer[],
  outputExceeded: () => boolean,
) {
  return new Promise<CommandExecution>((resolve) => {
    let settled = false;
    const settle = (status: number | null, signal: string | null) => {
      if (settled) return;
      settled = true;
      resolve(
        Object.freeze({
          status,
          signal,
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: Buffer.concat(stderrChunks).toString("utf8"),
          outputExceeded: outputExceeded(),
        }),
      );
    };
    child.once("error", () => settle(null, null));
    child.once("close", (status, signal) => settle(status, signal));
  });
}

function bounded<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function startOwnedProcess(
  executable: string,
  argv: readonly string[],
  environment: Readonly<Record<string, string>>,
  stdin: string | null,
): OwnedCommandHandle {
  const child = spawn(executable, [...argv], {
    windowsHide: true,
    shell: false,
    env: environment,
    stdio: [stdin === null ? "ignore" : "pipe", "pipe", "pipe"],
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let exceeded = false;
  let transportFailed = false;
  let closed = false;
  let terminationRequested = false;
  if (!child.stdout || !child.stderr)
    throw new Error("docker_effect_stdio_unavailable");
  if (stdin !== null) {
    if (!child.stdin) throw new Error("docker_effect_stdin_unavailable");
    child.stdin.once("error", () => {
      transportFailed = true;
    });
    child.stdin.end(stdin, "utf8");
  }
  const append = (chunk: Buffer | string, stdout: boolean) => {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (stdout) stdoutBytes += value.byteLength;
    else stderrBytes += value.byteLength;
    if (stdoutBytes > STDOUT_LIMIT_BYTES || stderrBytes > STDERR_LIMIT_BYTES) {
      exceeded = true;
      void terminateAndWait(5_000);
      return;
    }
    (stdout ? stdoutChunks : stderrChunks).push(value);
  };
  child.stdout.on("data", (chunk) => append(chunk, true));
  child.stderr.on("data", (chunk) => append(chunk, false));
  child.once("close", () => {
    closed = true;
  });
  const completion = buffersToExecution(
    child,
    stdoutChunks,
    stderrChunks,
    () => exceeded || transportFailed,
  );

  async function terminateAndWait(graceMs: number) {
    if (!closed && !terminationRequested) {
      terminationRequested = true;
      const pid = child.pid;
      if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0)
        return false;
      const killer = spawn(
        TASKKILL_EXECUTABLE,
        ["/PID", String(pid), "/T", "/F"],
        {
          windowsHide: true,
          shell: false,
          env: dockerEnvironment(),
          stdio: "ignore",
        },
      );
      await bounded(
        new Promise<void>((resolve) => {
          killer.once("error", () => resolve());
          killer.once("close", () => resolve());
        }),
        graceMs,
        undefined,
      );
    }
    await bounded(completion, graceMs, null);
    return closed;
  }

  return Object.freeze({
    wait: (timeoutMs: number) => bounded(completion, timeoutMs, null),
    terminateAndWait,
    closed: () => closed,
  });
}

function exactArray(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length && left.every((value, i) => value === right[i])
  );
}

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
  const proxyCommand = plan.commands[2];
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
  const providerEnvironment = [
    "--env",
    "HOME=/provider-home",
    "--env",
    "TMPDIR=/tmp",
    "--env",
    `HTTPS_PROXY=http://crdd:${proxyToken}@proxy:8080`,
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
  const commands = [
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
      "--pids-limit=64",
      "--user=65534:65534",
      "--workdir=/work",
      ...providerEnvironment,
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

function validatePlan(plan: PreparedPlan, tmpSourcePath: string) {
  const isProviderBindingValid =
    (plan.provider === "claude" &&
      /^PROFILE-20000[12]$/u.test(plan.profileId) &&
      plan.selectedModel === "opus") ||
    (plan.provider === "codex" &&
      /^PROFILE-10000[12]$/u.test(plan.profileId) &&
      plan.selectedModel === "gpt-5.6-sol");
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
      plan.proxyContainerName,
      plan.internalNetworkName,
      plan.egressNetworkName,
    ].some((value) => !SAFE_IDENTIFIER.test(value)) ||
    plan.providerHomeSourcePath.length === 0 ||
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
  const expected = expectedCommands(plan, tmpSourcePath);
  return (
    expected !== null &&
    plan.commands.length === expected.length &&
    plan.commands.every(
      (command, index) =>
        command.purpose === expected[index]?.purpose &&
        exactArray(command.argv, expected[index]?.argv ?? []),
    )
  );
}

function planIdentity(plan: PreparedPlan) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        operationId: plan.operationId,
        selectionRecordId: plan.selectionRecordId,
        operationMode: plan.operationMode,
        taskRole: plan.taskRole,
        taskPacketHash: plan.taskPacketHash,
        ownershipLabel: plan.ownershipLabel,
        commands: plan.commands,
      }),
    )
    .digest("hex");
}

function createRuntime(dependencies: RuntimeDependencies) {
  const contexts = new WeakMap<object, ExecutionContext>();

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

  function startCommand(
    command: Command,
    plan: PreparedPlan,
    managementCapability: unknown,
  ): CommandHandle {
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
      DOCKER_EXECUTABLE,
      [
        "--host",
        DOCKER_ENGINE,
        "--config",
        context.configDirectory,
        ...command.argv,
      ],
      dockerEnvironment(),
      command.purpose === "start_provider_attached" ? plan.providerInput : null,
    );
    context.handles.add(handle);
    return handle;
  }

  async function runShort(context: ExecutionContext, argv: readonly string[]) {
    dependencies.verifyCli(context.cli);
    const handle = dependencies.startProcess(
      DOCKER_EXECUTABLE,
      ["--host", DOCKER_ENGINE, "--config", context.configDirectory, ...argv],
      dockerEnvironment(),
      null,
    );
    context.handles.add(handle);
    const result = await handle.wait(SHORT_COMMAND_TIMEOUT_MS);
    if (result === null) await handle.terminateAndWait(5_000);
    context.handles.delete(handle);
    return result;
  }

  async function inspectOwned(
    context: ExecutionContext,
    kind: "container" | "network",
    name: string,
    ownershipLabel: string,
  ) {
    const labelValue = ownershipLabel.slice(ownershipLabel.indexOf("=") + 1);
    const argv =
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
          ];
    const result = await runShort(context, argv);
    if (
      result?.status !== 0 ||
      result.signal !== null ||
      result.outputExceeded ||
      result.stderr.length !== 0
    ) {
      return "unknown" as const;
    }
    const lines = result.stdout.trim().length
      ? result.stdout.trim().split(/\r?\n/u)
      : [];
    if (lines.length === 0) return "absent" as const;
    return lines.length === 1 && lines[0] === `${name}|${labelValue}`
      ? ("owned" as const)
      : ("foreign" as const);
  }

  async function removeOwned(
    context: ExecutionContext,
    kind: "container" | "network",
    name: string,
    ownershipLabel: string,
  ) {
    const before = await inspectOwned(context, kind, name, ownershipLabel);
    if (before === "foreign" || before === "unknown") return false;
    if (before === "owned") {
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
      ) {
        return false;
      }
    }
    return (
      (await inspectOwned(context, kind, name, ownershipLabel)) === "absent"
    );
  }

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
    const providerAbsent = await removeOwned(
      context,
      "container",
      plan.providerContainerName,
      plan.ownershipLabel,
    );
    const proxyAbsent = await removeOwned(
      context,
      "container",
      plan.proxyContainerName,
      plan.ownershipLabel,
    );
    const internalAbsent = await removeOwned(
      context,
      "network",
      plan.internalNetworkName,
      plan.ownershipLabel,
    );
    const egressAbsent = await removeOwned(
      context,
      "network",
      plan.egressNetworkName,
      plan.ownershipLabel,
    );
    const containersAbsent = providerAbsent && proxyAbsent;
    const networksAbsent = internalAbsent && egressAbsent;
    let configRemoved = false;
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
  }),
);

export function startRuntimeOwnedDockerCommand(
  command: Command,
  plan: PreparedPlan,
  managementCapability: unknown,
) {
  return productionRuntime.startCommand(command, plan, managementCapability);
}

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

export function describeDockerEffectRuntimeContract() {
  return Object.freeze({
    contract: DOCKER_EFFECT_RUNTIME_CONTRACT,
    contractRevision: DOCKER_EFFECT_RUNTIME_CONTRACT_REVISION,
    dockerCli: Object.freeze({
      absolutePath: DOCKER_EXECUTABLE,
      bytes: DOCKER_EXECUTABLE_BYTES,
      sha256: DOCKER_EXECUTABLE_SHA256,
      pathLookupAllowed: false,
      shellAllowed: false,
    }),
    engine: DOCKER_ENGINE,
    environment: "runtime_owned_minimal_replacement",
    commandPlan: "exact_seven_command_provider_probe_or_isolated_task",
    taskInput: "runtime_owned_stdin_only_not_docker_argv",
    cleanup: "ownership_label_then_exact_name_absence",
    processTreeTermination: "taskkill_exact_pid_tree_then_close",
    callerCommandAllowed: false,
    providerEffectAllowed: true,
  });
}
