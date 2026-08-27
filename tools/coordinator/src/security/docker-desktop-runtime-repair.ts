import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  createWindowsDockerCliEnvironment,
  createWindowsNativeHelperEnvironment,
} from "../core/windows-child-environment.ts";
import {
  acquireHostOperationSupervisorLockUsingFactory,
  type HostOperationSupervisorLockOutcome,
} from "./candidate-store-kernel-lock.ts";
import {
  consumeRuntimeOwnedRuntimeStateRootCapability,
  inspectRuntimeOwnedWindowsRuntimeState,
} from "./candidate-store-windows-adapter.ts";
import { isSupportedWindowsAbsolutePathCandidate } from "./authority-root-path-lexical.ts";
import { verifyBundledCoordinatorPackageFromFixedManifestCandidate } from "./platform-provisioner-package-filesystem.ts";

export const DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT =
  "crdd-coordinator/docker-desktop-runtime-repair";
export const DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION = 1;

const REPAIR_ROOT_NAME = "crdd-coordinator-doctor-docker-desktop-repair";
const DOCKER_ROOT = "C:\\Program Files\\Docker\\Docker";
const DOCKER_CLI = `${DOCKER_ROOT}\\resources\\bin\\docker.exe`;
const DOCKER_DESKTOP_CLI = `${DOCKER_ROOT}\\DockerCli.exe`;
const DOCKER_DESKTOP_LAUNCHER = `${DOCKER_ROOT}\\Docker Desktop.exe`;
const DOCKER_ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";
const RUNTIME_STATE_SEGMENTS = Object.freeze([
  "Qual-Lab",
  "CRDD",
  "RuntimeState",
]);
const KNOWN_SOCKET_ERROR_CODES = Object.freeze(
  new Set(["EACCES", "EBUSY", "EPERM"]),
);
type ArtifactPolicy = Readonly<{ bytes: number; sha256: string }>;
const PROCESS_ALLOWLIST = Object.freeze(
  new Map<string, ArtifactPolicy>([
    [
      `${DOCKER_ROOT}\\Docker Desktop.exe`,
      Object.freeze({
        bytes: 6_559_088,
        sha256:
          "67A3FE3C788AC3DF4CB780B79F4DB2B08D6FDFEABC01A852E85F326D5C898DAA",
      }),
    ],
    [
      `${DOCKER_ROOT}\\frontend\\Docker Desktop.exe`,
      Object.freeze({
        bytes: 188_880_752,
        sha256:
          "B00C092EA4E79FB7754185000DEE845B84808C9B0E54A3F743DA4203972C1A71",
      }),
    ],
    [
      `${DOCKER_ROOT}\\resources\\com.docker.backend.exe`,
      Object.freeze({
        bytes: 175_319_408,
        sha256:
          "3E3C8F80C06A727AE0CFB1EF3323CE35735243EA5D9D6C871C433F0349D46EFE",
      }),
    ],
  ]),
);
const FIXED_ARTIFACTS = Object.freeze(
  new Map<string, ArtifactPolicy>([
    [
      DOCKER_CLI,
      Object.freeze({
        bytes: 41_631_088,
        sha256:
          "C8EAA01D1E78CAECD65D730E670CBFE4DFCE006E1C6F18167C003587CB4BB610",
      }),
    ],
    [
      DOCKER_DESKTOP_CLI,
      Object.freeze({
        bytes: 21_890_928,
        sha256:
          "B131B001B49170BE3E3628E3B2E3FE9DC906B453EECCC03A7A3AD5CA0E864762",
      }),
    ],
    [
      DOCKER_DESKTOP_LAUNCHER,
      Object.freeze({
        bytes: 6_559_088,
        sha256:
          "67A3FE3C788AC3DF4CB780B79F4DB2B08D6FDFEABC01A852E85F326D5C898DAA",
      }),
    ],
  ]),
);

type RepairReport = Readonly<{
  contract: typeof DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT;
  contractRevision: typeof DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION;
  status: "recovered" | "blocked";
  reason: string;
  manualRecoveryRequired: boolean;
  processEffectIssued: boolean;
  filesystemEffectIssued: boolean;
  engineReady: boolean;
  staleRuntimeDirectoryRetained: boolean;
  effectStateUnknown: boolean;
  pathReported: false;
  credentialReported: false;
  providerEffectIssued: false;
}>;

type PreparedBoundary = Readonly<{
  runtimeStateRoot: string;
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
  runtimeStateBindingHash: string;
  runDirectory: string;
  socketPath: string;
  staleDirectory: string;
  staleName: string;
  operationDirectory: string;
  operationId: string;
}>;

const runDirectoryIdentities = new WeakMap<
  object,
  Readonly<{ dev: bigint; ino: bigint; birthtimeNs: bigint }>
>();

type RepairDependencies = Readonly<{
  prepareBoundary: () => PreparedBoundary | null;
  acquireLock: () => Promise<HostOperationSupervisorLockOutcome>;
  engineAvailable: (boundary: PreparedBoundary) => boolean;
  knownSocketFailure: (boundary: PreparedBoundary) => boolean;
  persistState: (
    boundary: PreparedBoundary,
    state: "prepared" | "processes_stopped" | "renamed" | "recovered",
  ) => boolean;
  stopDesktop: (boundary: PreparedBoundary) => boolean;
  processesAbsent: () => boolean;
  forceStopVerifiedProcesses: () => boolean;
  terminateDockerWsl: () => boolean;
  renameRunDirectory: (boundary: PreparedBoundary) => boolean;
  startDesktop: (boundary: PreparedBoundary) => boolean;
  awaitEngine: (boundary: PreparedBoundary) => Promise<boolean>;
}>;

function report(
  status: "recovered" | "blocked",
  reason: string,
  effects: Readonly<{
    manualRecoveryRequired?: boolean;
    processEffectIssued?: boolean;
    filesystemEffectIssued?: boolean;
    engineReady?: boolean;
    staleRuntimeDirectoryRetained?: boolean;
    effectStateUnknown?: boolean;
  }> = Object.freeze({}),
): RepairReport {
  return Object.freeze({
    contract: DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT,
    contractRevision: DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION,
    status,
    reason,
    manualRecoveryRequired: effects.manualRecoveryRequired === true,
    processEffectIssued: effects.processEffectIssued === true,
    filesystemEffectIssued: effects.filesystemEffectIssued === true,
    engineReady: effects.engineReady === true,
    staleRuntimeDirectoryRetained:
      effects.staleRuntimeDirectoryRetained === true,
    effectStateUnknown: effects.effectStateUnknown === true,
    pathReported: false,
    credentialReported: false,
    providerEffectIssued: false,
  });
}

export async function repairWindowsDockerDesktopRuntimeUsingDependencies(
  dependencies: RepairDependencies,
): Promise<RepairReport> {
  const boundary = dependencies.prepareBoundary();
  if (!boundary)
    return report("blocked", "docker_desktop_repair_boundary_unavailable");
  const lockOutcome = await dependencies.acquireLock();
  if (lockOutcome.status !== "acquired" || !lockOutcome.lock)
    return report(
      "blocked",
      lockOutcome.status === "cleanup_unknown"
        ? "docker_desktop_repair_lock_cleanup_unknown"
        : "docker_desktop_repair_lock_unavailable",
      { manualRecoveryRequired: lockOutcome.status === "cleanup_unknown" },
    );
  const lock = lockOutcome.lock;
  let result: RepairReport = report(
    "blocked",
    "docker_desktop_repair_failed_closed",
  );
  try {
    const execute = async (): Promise<RepairReport> => {
      if ((await lock.confirmReady()) !== "ready")
        return report("blocked", "docker_desktop_repair_lock_cleanup_unknown", {
          manualRecoveryRequired: true,
        });
      if (dependencies.engineAvailable(boundary))
        return report("blocked", "docker_desktop_engine_already_available", {
          engineReady: true,
        });
      if (!dependencies.knownSocketFailure(boundary))
        return report(
          "blocked",
          "docker_desktop_known_socket_failure_unconfirmed",
        );
      if (dependencies.engineAvailable(boundary))
        return report(
          "blocked",
          "docker_desktop_engine_recovered_before_effect",
          {
            engineReady: true,
          },
        );
      if (!dependencies.persistState(boundary, "prepared"))
        return report("blocked", "docker_desktop_repair_record_unavailable", {
          filesystemEffectIssued: true,
          manualRecoveryRequired: true,
        });
      const shutdownEffectIssued = dependencies.stopDesktop(boundary);
      let processesAbsent = dependencies.processesAbsent();
      if (!processesAbsent) {
        if (!dependencies.forceStopVerifiedProcesses())
          return report(
            "blocked",
            "docker_desktop_process_identity_unconfirmed",
            {
              processEffectIssued: shutdownEffectIssued,
              filesystemEffectIssued: true,
              manualRecoveryRequired: true,
            },
          );
        processesAbsent = dependencies.processesAbsent();
      }
      if (!processesAbsent)
        return report(
          "blocked",
          "docker_desktop_process_termination_unconfirmed",
          {
            processEffectIssued: true,
            filesystemEffectIssued: true,
            manualRecoveryRequired: true,
          },
        );
      if (!dependencies.terminateDockerWsl())
        return report("blocked", "docker_desktop_wsl_termination_unconfirmed", {
          processEffectIssued: true,
          filesystemEffectIssued: true,
          manualRecoveryRequired: true,
        });
      if (!dependencies.persistState(boundary, "processes_stopped"))
        return report("blocked", "docker_desktop_repair_record_update_failed", {
          processEffectIssued: true,
          filesystemEffectIssued: true,
          manualRecoveryRequired: true,
        });
      if (!dependencies.renameRunDirectory(boundary))
        return report("blocked", "docker_desktop_runtime_rename_failed", {
          processEffectIssued: true,
          filesystemEffectIssued: true,
          manualRecoveryRequired: true,
        });
      if (!dependencies.persistState(boundary, "renamed"))
        return report("blocked", "docker_desktop_repair_record_update_failed", {
          processEffectIssued: true,
          filesystemEffectIssued: true,
          staleRuntimeDirectoryRetained: true,
          manualRecoveryRequired: true,
        });
      if (!dependencies.startDesktop(boundary))
        return report("blocked", "docker_desktop_restart_failed", {
          processEffectIssued: true,
          filesystemEffectIssued: true,
          staleRuntimeDirectoryRetained: true,
          manualRecoveryRequired: true,
        });
      if (!(await dependencies.awaitEngine(boundary)))
        return report("blocked", "docker_desktop_engine_restart_unconfirmed", {
          processEffectIssued: true,
          filesystemEffectIssued: true,
          staleRuntimeDirectoryRetained: true,
          manualRecoveryRequired: true,
        });
      if (!dependencies.persistState(boundary, "recovered"))
        return report("blocked", "docker_desktop_repair_record_update_failed", {
          processEffectIssued: true,
          filesystemEffectIssued: true,
          engineReady: true,
          staleRuntimeDirectoryRetained: true,
          manualRecoveryRequired: true,
        });
      return report("recovered", "docker_desktop_runtime_repaired", {
        processEffectIssued: true,
        filesystemEffectIssued: true,
        engineReady: true,
        staleRuntimeDirectoryRetained: true,
      });
    };
    try {
      result = await execute();
    } catch {
      result = report("blocked", "docker_desktop_repair_failed_closed", {
        manualRecoveryRequired: true,
        effectStateUnknown: true,
      });
    }
  } finally {
    const released = await lock.release();
    if (released !== "released") {
      result = report("blocked", "docker_desktop_repair_lock_cleanup_unknown", {
        processEffectIssued: result.processEffectIssued,
        filesystemEffectIssued: result.filesystemEffectIssued,
        engineReady: result.engineReady,
        staleRuntimeDirectoryRetained: result.staleRuntimeDirectoryRetained,
        effectStateUnknown: result.effectStateUnknown,
        manualRecoveryRequired: true,
      });
    }
  }
  return result;
}

function exactPath(target: string) {
  try {
    const normalized = path.win32.normalize(target);
    const metadata = fs.lstatSync(normalized);
    return (
      !metadata.isSymbolicLink() &&
      fs.realpathSync.native(normalized).toLocaleLowerCase("en-US") ===
        normalized.toLocaleLowerCase("en-US")
    );
  } catch {
    return false;
  }
}

function fixedArtifact(target: string, expected: ArtifactPolicy) {
  let handle: number | null = null;
  try {
    const pathBefore = fs.lstatSync(target, { bigint: true });
    if (
      !pathBefore.isFile() ||
      pathBefore.isSymbolicLink() ||
      pathBefore.size !== BigInt(expected.bytes) ||
      !exactPath(target)
    )
      return false;
    handle = fs.openSync(target, "r");
    const before = fs.fstatSync(handle, { bigint: true });
    if (
      before.dev !== pathBefore.dev ||
      before.ino !== pathBefore.ino ||
      before.birthtimeNs !== pathBefore.birthtimeNs ||
      before.size !== pathBefore.size
    )
      return false;
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    for (;;) {
      const bytes = fs.readSync(handle, buffer, 0, buffer.length, null);
      if (bytes === 0) break;
      hash.update(buffer.subarray(0, bytes));
    }
    const after = fs.fstatSync(handle, { bigint: true });
    const pathAfter = fs.lstatSync(target, { bigint: true });
    return (
      after.dev === before.dev &&
      after.ino === before.ino &&
      after.birthtimeNs === before.birthtimeNs &&
      after.size === before.size &&
      pathAfter.dev === before.dev &&
      pathAfter.ino === before.ino &&
      pathAfter.birthtimeNs === before.birthtimeNs &&
      pathAfter.size === before.size &&
      exactPath(target) &&
      hash.digest("hex").toUpperCase() === expected.sha256
    );
  } catch {
    return false;
  } finally {
    if (handle !== null) fs.closeSync(handle);
  }
}

function preparedBoundary(): PreparedBoundary | null {
  if (process.platform !== "win32") return null;
  const packageVerification =
    verifyBundledCoordinatorPackageFromFixedManifestCandidate({
      evaluationTime: new Date().toISOString(),
    });
  if (
    packageVerification.status !== "candidate" ||
    packageVerification.runtimeOwnedReleaseTrustConfirmed !== true ||
    packageVerification.releaseIdentityRuntimeOwned !== true ||
    packageVerification.crddDistributionConfirmed !== true
  )
    return null;
  for (const [target, expected] of FIXED_ARTIFACTS) {
    if (!fixedArtifact(target, expected)) return null;
  }
  const observation = inspectRuntimeOwnedWindowsRuntimeState(
    false,
    new Date().toISOString(),
  );
  if (
    observation.status !== "candidate" ||
    observation.selectedUserBindingVerified !== true ||
    observation.protectionVerified !== true ||
    !observation.rootCapability
  )
    return null;
  const root = consumeRuntimeOwnedRuntimeStateRootCapability(
    observation.rootCapability,
  );
  if (!root) return null;
  let localAppData = root.rootPath;
  for (const segment of [...RUNTIME_STATE_SEGMENTS].reverse()) {
    if (
      path.win32.basename(localAppData).toLocaleLowerCase("en-US") !==
      segment.toLocaleLowerCase("en-US")
    )
      return null;
    localAppData = path.win32.dirname(localAppData);
  }
  if (
    !isSupportedWindowsAbsolutePathCandidate(localAppData) ||
    !exactPath(localAppData)
  )
    return null;
  const operationId = randomBytes(16).toString("hex");
  const runDirectory = path.win32.join(localAppData, "Docker", "run");
  const staleName = `run.crdd-stale-${operationId}`;
  const staleDirectory = path.win32.join(localAppData, "Docker", staleName);
  const operationDirectory = path.win32.join(
    root.rootPath,
    `docker-desktop-repair-${operationId}`,
  );
  return Object.freeze({
    runtimeStateRoot: root.rootPath,
    runtimeStateIdentityHash: root.runtimeStateIdentityHash,
    runtimeStateProtectionHash: root.runtimeStateProtectionHash,
    localUserBindingHash: root.localUserBindingHash,
    runtimeStateBindingHash: root.stableLogicalHomeBindingHash,
    runDirectory,
    socketPath: path.win32.join(runDirectory, "dockerInference"),
    staleDirectory,
    staleName,
    operationDirectory,
    operationId,
  });
}

function engineAvailable(boundary: PreparedBoundary) {
  const environment = createWindowsDockerCliEnvironment({
    dockerConfig: boundary.runtimeStateRoot,
    dockerHome: boundary.runtimeStateRoot,
  });
  if (!environment) return false;
  const result = spawnSync(
    DOCKER_CLI,
    [
      "--host",
      DOCKER_ENGINE,
      "--config",
      boundary.runtimeStateRoot,
      "version",
      "--format",
      "{{.Server.Version}}",
    ],
    {
      env: environment,
      shell: false,
      windowsHide: true,
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 4_096,
    },
  );
  return result.status === 0 && /^\d+\.\d+\.\d+\s*$/u.test(result.stdout);
}

function knownSocketFailure(boundary: PreparedBoundary) {
  try {
    const run = fs.lstatSync(boundary.runDirectory, { bigint: true });
    if (
      !run.isDirectory() ||
      run.isSymbolicLink() ||
      run.dev <= 0n ||
      run.ino <= 0n ||
      run.birthtimeNs <= 0n ||
      !exactPath(path.win32.dirname(boundary.runDirectory)) ||
      fs.existsSync(boundary.staleDirectory)
    )
      return false;
    const handle = fs.openSync(boundary.socketPath, "r");
    fs.closeSync(handle);
    return false;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (!KNOWN_SOCKET_ERROR_CODES.has(code)) return false;
    try {
      const run = fs.lstatSync(boundary.runDirectory, { bigint: true });
      if (
        !run.isDirectory() ||
        run.isSymbolicLink() ||
        run.dev <= 0n ||
        run.ino <= 0n ||
        run.birthtimeNs <= 0n
      )
        return false;
      runDirectoryIdentities.set(
        boundary,
        Object.freeze({
          dev: run.dev,
          ino: run.ino,
          birthtimeNs: run.birthtimeNs,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}

function stableFile(target: string) {
  const before = fs.lstatSync(target, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) return null;
  const serialized = fs.readFileSync(target, "utf8");
  const after = fs.lstatSync(target, { bigint: true });
  return before.dev === after.dev &&
    before.ino === after.ino &&
    before.birthtimeNs === after.birthtimeNs &&
    before.size === after.size
    ? Object.freeze({ serialized, identity: before })
    : null;
}

function persistState(
  boundary: PreparedBoundary,
  state: "prepared" | "processes_stopped" | "renamed" | "recovered",
) {
  try {
    if (state === "prepared") {
      fs.mkdirSync(boundary.operationDirectory, { recursive: false });
      fs.mkdirSync(path.join(boundary.operationDirectory, "docker-config"), {
        recursive: false,
      });
    }
    const record = Object.freeze({
      contract: DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT,
      contractRevision: DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION,
      operationId: boundary.operationId,
      state,
      staleName: boundary.staleName,
      runtimeStateIdentityHash: boundary.runtimeStateIdentityHash,
      runtimeStateProtectionHash: boundary.runtimeStateProtectionHash,
      localUserBindingHash: boundary.localUserBindingHash,
      runtimeStateBindingHash: boundary.runtimeStateBindingHash,
      staleDirectoryRetained: state === "renamed" || state === "recovered",
    });
    const stateOrder = Object.freeze({
      prepared: "00",
      processes_stopped: "01",
      renamed: "02",
      recovered: "03",
    });
    const target = path.join(
      boundary.operationDirectory,
      `repair-${stateOrder[state]}-${state}.json`,
    );
    const serialized = `${JSON.stringify(record)}\n`;
    const temporary = path.join(
      boundary.operationDirectory,
      `.crdd-${state}-${randomBytes(16).toString("hex")}.tmp`,
    );
    const handle = fs.openSync(temporary, "wx", 0o600);
    try {
      fs.writeFileSync(handle, serialized, "utf8");
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    const temporaryRecord = stableFile(temporary);
    if (!temporaryRecord || temporaryRecord.serialized !== serialized)
      return false;
    fs.renameSync(temporary, target);
    const committed = stableFile(target);
    return (
      committed !== null &&
      committed.serialized === serialized &&
      committed.identity.dev === temporaryRecord.identity.dev &&
      committed.identity.ino === temporaryRecord.identity.ino &&
      committed.identity.birthtimeNs === temporaryRecord.identity.birthtimeNs
    );
  } catch {
    return false;
  }
}

function stopDesktop(boundary: PreparedBoundary) {
  const environment = createWindowsDockerCliEnvironment({
    dockerConfig: path.join(boundary.operationDirectory, "docker-config"),
    dockerHome: path.join(boundary.operationDirectory, "docker-config"),
  });
  if (!environment) return false;
  const result = spawnSync(DOCKER_DESKTOP_CLI, ["-Shutdown"], {
    env: environment,
    shell: false,
    windowsHide: true,
    encoding: "buffer",
    timeout: 30_000,
    maxBuffer: 4_096,
  });
  return result.pid !== undefined;
}

function powershellProcessSnapshot() {
  const environment = createWindowsNativeHelperEnvironment();
  const systemRoot = environment?.SystemRoot;
  if (!environment || !systemRoot) return null;
  const executable = path.win32.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  if (!exactPath(executable)) return null;
  const source =
    "$ErrorActionPreference='Stop';" +
    "$items=@(Get-Process -Name 'Docker Desktop','com.docker.backend','vpnkit' -ErrorAction SilentlyContinue);" +
    "foreach($item in $items){$value=$item.Path;if($null -eq $value){$value=''};[Console]::Out.WriteLine(([string]$item.Id)+'|'+$value)}";
  const encoded = Buffer.from(source, "utf16le").toString("base64");
  const result = spawnSync(
    executable,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
    {
      env: environment,
      shell: false,
      windowsHide: true,
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 65_536,
    },
  );
  if (result.status !== 0 || result.stderr.length !== 0) return null;
  const values = [];
  for (const line of result.stdout.split(/\r?\n/u).filter(Boolean)) {
    const matched = /^([1-9][0-9]{0,9})\|([^|\r\n]*)$/u.exec(line);
    if (!matched) return null;
    const pid = Number(matched[1]);
    const executablePath = matched[2];
    values.push({
      pid,
      path:
        executablePath && executablePath.length > 0
          ? path.win32.normalize(executablePath)
          : null,
    });
  }
  return values;
}

function verifiedProcesses() {
  const processes = powershellProcessSnapshot();
  if (!processes) return null;
  for (const process of processes) {
    if (!Number.isSafeInteger(process.pid) || process.pid < 1 || !process.path)
      return null;
    const expected = [...PROCESS_ALLOWLIST].find(
      ([candidate]) =>
        candidate.toLocaleLowerCase("en-US") ===
        process.path?.toLocaleLowerCase("en-US"),
    )?.[1];
    if (!expected || !fixedArtifact(process.path, expected)) return null;
  }
  return processes;
}

function forceStopVerifiedProcesses() {
  const processes = verifiedProcesses();
  if (!processes) return false;
  const environment = createWindowsNativeHelperEnvironment();
  const systemRoot = environment?.SystemRoot;
  if (!environment || !systemRoot) return false;
  const taskkill = path.win32.join(systemRoot, "System32", "taskkill.exe");
  if (!exactPath(taskkill)) return false;
  for (const process of processes) {
    const result = spawnSync(taskkill, ["/PID", String(process.pid), "/F"], {
      env: environment,
      shell: false,
      windowsHide: true,
      encoding: "buffer",
      timeout: 10_000,
      maxBuffer: 16_384,
    });
    if (result.status !== 0) return false;
  }
  return true;
}

function terminateDockerWsl() {
  const environment = createWindowsNativeHelperEnvironment();
  const systemRoot = environment?.SystemRoot;
  if (!environment || !systemRoot) return false;
  const executable = path.win32.join(systemRoot, "System32", "wsl.exe");
  if (!exactPath(executable)) return false;
  const result = spawnSync(executable, ["--terminate", "docker-desktop"], {
    env: environment,
    shell: false,
    windowsHide: true,
    encoding: "buffer",
    timeout: 15_000,
    maxBuffer: 16_384,
  });
  return result.status === 0;
}

function renameRunDirectory(boundary: PreparedBoundary) {
  try {
    const expected = runDirectoryIdentities.get(boundary);
    const before = fs.lstatSync(boundary.runDirectory, { bigint: true });
    if (
      !expected ||
      !before.isDirectory() ||
      before.isSymbolicLink() ||
      before.dev <= 0n ||
      before.ino <= 0n ||
      before.birthtimeNs <= 0n ||
      before.dev !== expected.dev ||
      before.ino !== expected.ino ||
      before.birthtimeNs !== expected.birthtimeNs ||
      fs.existsSync(boundary.staleDirectory)
    )
      return false;
    fs.renameSync(boundary.runDirectory, boundary.staleDirectory);
    const after = fs.lstatSync(boundary.staleDirectory, { bigint: true });
    const matched =
      after.isDirectory() &&
      !after.isSymbolicLink() &&
      after.dev === before.dev &&
      after.ino === before.ino &&
      after.birthtimeNs === before.birthtimeNs &&
      !fs.existsSync(boundary.runDirectory);
    if (matched) runDirectoryIdentities.delete(boundary);
    return matched;
  } catch {
    return false;
  }
}

function startDesktop(boundary: PreparedBoundary) {
  const environment = createWindowsNativeHelperEnvironment();
  if (!environment) return false;
  const localAppData = path.win32.dirname(
    path.win32.dirname(boundary.runDirectory),
  );
  const childEnvironment = Object.freeze({
    ...environment,
    LOCALAPPDATA: localAppData,
    TEMP: path.win32.join(localAppData, "Temp"),
    TMP: path.win32.join(localAppData, "Temp"),
  });
  try {
    const child = spawn(DOCKER_DESKTOP_LAUNCHER, ["--minimized"], {
      env: childEnvironment,
      shell: false,
      windowsHide: true,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return child.pid !== undefined;
  } catch {
    return false;
  }
}

async function awaitEngine(boundary: PreparedBoundary) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (engineAvailable(boundary)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

const productionDependencies: RepairDependencies = Object.freeze({
  prepareBoundary: preparedBoundary,
  acquireLock: () =>
    acquireHostOperationSupervisorLockUsingFactory(
      REPAIR_ROOT_NAME,
      randomUUID(),
      spawn,
    ),
  engineAvailable,
  knownSocketFailure,
  persistState,
  stopDesktop,
  processesAbsent: () => {
    const processes = verifiedProcesses();
    return processes !== null && processes.length === 0;
  },
  forceStopVerifiedProcesses,
  terminateDockerWsl,
  renameRunDirectory,
  startDesktop,
  awaitEngine,
});

export function repairRuntimeOwnedWindowsDockerDesktopRuntime() {
  return repairWindowsDockerDesktopRuntimeUsingDependencies(
    productionDependencies,
  );
}

export function describeDockerDesktopRuntimeRepairContract() {
  return Object.freeze({
    contract: DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT,
    contractRevision: DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION,
    platform: "windows",
    invocation: "explicit_doctor_only",
    automaticFallback: false,
    knownFailure: "inaccessible_docker_inference_runtime_socket",
    selectedUserAndKnownFolder:
      "native_runtime_state_binding_then_fixed_local_app_data_derivation",
    engineMustBeUnavailable: true,
    processTermination:
      "official_shutdown_then_exact_path_hash_allowlisted_bounded_force_stop",
    wslTermination: "docker_desktop_distribution_only",
    filesystemEffect: "same_parent_run_directory_rename_without_deletion",
    staleDirectoryRetention: "retained_for_explicit_later_disposition",
    protectedRootsModified: false,
    providerEffectIssued: false,
  });
}
