import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  createWindowsDockerCliEnvironment,
  createWindowsDockerDesktopLauncherEnvironment,
  createWindowsNativeHelperEnvironment,
} from "../core/windows-child-environment.ts";
import { isSupportedWindowsAbsolutePathCandidate } from "./authority-root-path-lexical.ts";
import {
  consumeRuntimeOwnedRuntimeStateRootCapability,
  inspectRuntimeOwnedWindowsRuntimeState,
} from "./candidate-store-windows-adapter.ts";
import {
  acquireRuntimeOwnedDockerDesktopRepairNativeHelper,
  type DockerDesktopRepairNativeHelperOutcome,
  type DockerDesktopRepairNativeHelperSession,
} from "./docker-desktop-repair-native-helper.ts";
import {
  observeRuntimeOwnedDockerDesktopRepairPolicy,
  type DockerDesktopRepairPolicy,
} from "./docker-desktop-repair-policy.ts";
import {
  createDockerDesktopRepairOperation,
  type DockerDesktopRepairDirectoryIdentity,
  type DockerDesktopRepairEvidenceState,
  type DockerDesktopRepairHostSafety,
  type DockerDesktopRepairLedgerSnapshot,
  type DockerDesktopRepairOperation,
  type DockerDesktopRepairRecordBoundary,
  type DockerDesktopRepairStaleState,
  inventoryDockerDesktopRepairOperations,
  parseDockerDesktopRepairId,
  persistDockerDesktopRepairStage,
} from "./docker-desktop-repair-record-store.ts";
import { verifyBundledCoordinatorPackageFromFixedManifestCandidate } from "./platform-provisioner-package-filesystem.ts";

export const DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT =
  "crdd-coordinator/docker-desktop-runtime-repair";
export const DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION = 2;

const DOCKER_ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";
const DOCKER_ENGINE_PIPE = "\\\\.\\pipe\\dockerDesktopLinuxEngine";
const RUNTIME_STATE_SEGMENTS = Object.freeze([
  "Qual-Lab",
  "CRDD",
  "RuntimeState",
]);
const KNOWN_SOCKET_ERROR_CODES = Object.freeze(
  new Set(["EACCES", "EBUSY", "EPERM"]),
);
const ENGINE_WAIT_ATTEMPTS = 60;

type EngineObservation = "ready" | "known_unavailable" | "unknown";
type TaggedEffect = Readonly<{
  issued: boolean | null;
  confirmation: "confirmed" | "unknown";
}>;
type RenameOutcome = Readonly<{
  issued: boolean | null;
  confirmation: "confirmed" | "unknown";
  staleState: DockerDesktopRepairStaleState;
}>;

export type PreparedBoundary = DockerDesktopRepairRecordBoundary &
  Readonly<{
    runDirectory: string;
    socketPath: string;
    platformAccessArtifact: unknown;
    policy: DockerDesktopRepairPolicy;
  }>;

type MutableLedger = {
  processEffectIssued: boolean | null;
  filesystemEffectIssued: boolean | null;
  engineReady: boolean | null;
  staleState: DockerDesktopRepairStaleState;
  hostSafety: DockerDesktopRepairHostSafety;
  evidenceState: DockerDesktopRepairEvidenceState;
  disposition:
    | "not_applicable"
    | "pending_human_decision"
    | "retained_by_human_decision";
  nativeHelperCleanupConfirmed: boolean | null;
};

export type DockerDesktopRuntimeRepairReport = Readonly<{
  contract: typeof DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT;
  contractRevision: typeof DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION;
  status:
    | "blocked"
    | "recovered_pending_close"
    | "closed_retained"
    | "closed_no_stale";
  reason: string;
  repairId: string | null;
  operationState: string | null;
  manualRecoveryRequired: boolean;
  processEffectIssued: boolean | null;
  filesystemEffectIssued: boolean | null;
  engineReady: boolean | null;
  staleRuntimeDirectory: DockerDesktopRepairStaleState;
  evidenceState: DockerDesktopRepairEvidenceState;
  disposition:
    | "not_applicable"
    | "pending_human_decision"
    | "retained_by_human_decision";
  nativeHelperCleanupConfirmed: boolean | null;
  effectStateUnknown: boolean;
  newRepairPermitted: boolean;
  deletionPerformed: false;
  pathReported: false;
  credentialReported: false;
  providerEffectIssued: false;
}>;

export type RepairDependencies = Readonly<{
  prepareBoundary: () => PreparedBoundary | null;
  acquireHelper: (
    boundary: PreparedBoundary,
  ) => Promise<DockerDesktopRepairNativeHelperOutcome>;
  inventory: typeof inventoryDockerDesktopRepairOperations;
  observeEngine: (boundary: PreparedBoundary) => EngineObservation;
  observeKnownSocketFailure: (
    boundary: PreparedBoundary,
  ) => DockerDesktopRepairDirectoryIdentity | null;
  persistStage: typeof persistDockerDesktopRepairStage;
  officialShutdown: (
    boundary: PreparedBoundary,
    operation: DockerDesktopRepairOperation,
  ) => TaggedEffect;
  terminateDockerWsl: () => TaggedEffect;
  renameRunDirectory: (
    boundary: PreparedBoundary,
    operation: DockerDesktopRepairOperation,
  ) => RenameOutcome;
  startDesktop: (boundary: PreparedBoundary) => TaggedEffect;
  awaitEngine: (
    boundary: PreparedBoundary,
    shouldStop: () => boolean,
  ) => Promise<EngineObservation>;
  identityAt: (target: string) => DockerDesktopRepairDirectoryIdentity | null;
}>;

function initialLedger(): MutableLedger {
  return {
    processEffectIssued: false,
    filesystemEffectIssued: false,
    engineReady: null,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "not_preserved",
    disposition: "not_applicable",
    // No helper has been started yet. `true` means there is no outstanding
    // helper resource to recover; a started helper overwrites this on release.
    nativeHelperCleanupConfirmed: true,
  };
}

function ledgerFrom(operation: DockerDesktopRepairOperation): MutableLedger {
  return { ...operation.ledger };
}

function snapshotLedger(
  ledger: MutableLedger,
): DockerDesktopRepairLedgerSnapshot {
  return Object.freeze({ ...ledger });
}

function markUnknown(ledger: MutableLedger) {
  ledger.hostSafety = "unknown";
}

function mergeIssued(
  current: boolean | null,
  observed: boolean | null,
): boolean | null {
  if (current === true || observed === true) return true;
  if (current === null || observed === null) return null;
  return false;
}

function report(
  status: DockerDesktopRuntimeRepairReport["status"],
  reason: string,
  ledger: MutableLedger,
  operation: DockerDesktopRepairOperation | null,
): DockerDesktopRuntimeRepairReport {
  const effectStateUnknown =
    ledger.processEffectIssued === null ||
    ledger.filesystemEffectIssued === null ||
    ledger.staleState === "unknown" ||
    ledger.hostSafety === "unknown" ||
    ledger.nativeHelperCleanupConfirmed === null;
  const hostMutationPossible =
    ledger.processEffectIssued !== false ||
    ledger.filesystemEffectIssued !== false;
  const manualRecoveryRequired =
    ledger.hostSafety !== "safe" ||
    (hostMutationPossible && status === "blocked") ||
    ledger.nativeHelperCleanupConfirmed === false;
  return Object.freeze({
    contract: DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT,
    contractRevision: DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION,
    status,
    reason,
    repairId: operation?.repairId ?? null,
    operationState: operation?.stage ?? null,
    manualRecoveryRequired,
    processEffectIssued: ledger.processEffectIssued,
    filesystemEffectIssued: ledger.filesystemEffectIssued,
    engineReady: ledger.engineReady,
    staleRuntimeDirectory: ledger.staleState,
    evidenceState: ledger.evidenceState,
    disposition: ledger.disposition,
    nativeHelperCleanupConfirmed: ledger.nativeHelperCleanupConfirmed,
    effectStateUnknown,
    newRepairPermitted:
      status === "closed_retained" || status === "closed_no_stale",
    deletionPerformed: false,
    pathReported: false,
    credentialReported: false,
    providerEffectIssued: false,
  });
}

function identity(
  metadata: fs.BigIntStats,
): DockerDesktopRepairDirectoryIdentity | null {
  return metadata.isDirectory() &&
    !metadata.isSymbolicLink() &&
    metadata.dev > 0n &&
    metadata.ino > 0n &&
    metadata.birthtimeNs > 0n
    ? Object.freeze({
        dev: String(metadata.dev),
        ino: String(metadata.ino),
        birthtimeNs: String(metadata.birthtimeNs),
      })
    : null;
}

function sameIdentity(
  left: DockerDesktopRepairDirectoryIdentity,
  right: DockerDesktopRepairDirectoryIdentity,
) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

function identityAt(target: string) {
  try {
    return identity(fs.lstatSync(target, { bigint: true }));
  } catch {
    return null;
  }
}

function preparedBoundary(): PreparedBoundary | null {
  if (process.platform !== "win32") return null;
  const policy = observeRuntimeOwnedDockerDesktopRepairPolicy();
  if (!policy) return null;
  const packageVerification =
    verifyBundledCoordinatorPackageFromFixedManifestCandidate({
      evaluationTime: new Date().toISOString(),
    });
  if (
    packageVerification.status !== "candidate" ||
    packageVerification.runtimeOwnedReleaseTrustConfirmed !== true ||
    packageVerification.releaseIdentityRuntimeOwned !== true ||
    packageVerification.crddDistributionConfirmed !== true ||
    !packageVerification.platformAccessArtifact
  )
    return null;
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
    !identityAt(localAppData)
  )
    return null;
  const runDirectory = path.win32.join(localAppData, "Docker", "run");
  return Object.freeze({
    runtimeStateRoot: root.rootPath,
    runtimeStateIdentityHash: root.runtimeStateIdentityHash,
    runtimeStateProtectionHash: root.runtimeStateProtectionHash,
    localUserBindingHash: root.localUserBindingHash,
    runtimeStateBindingHash: root.stableLogicalHomeBindingHash,
    dockerPolicySha256: policy.policySha256,
    localAppData,
    runDirectory,
    socketPath: path.win32.join(runDirectory, "dockerInference"),
    platformAccessArtifact: packageVerification.platformAccessArtifact,
    policy,
  });
}

function dockerConfig(operation: DockerDesktopRepairOperation) {
  return path.win32.join(operation.operationDirectory, "docker-config");
}

function observeEngine(boundary: PreparedBoundary): EngineObservation {
  const cli = boundary.policy.artifacts.get("docker_cli");
  if (!cli) return "unknown";
  const environment = createWindowsDockerCliEnvironment({
    dockerConfig: boundary.runtimeStateRoot,
    dockerHome: boundary.runtimeStateRoot,
  });
  if (!environment) return "unknown";
  const result = spawnSync(
    cli.path,
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
  if (
    !result.error &&
    result.signal === null &&
    result.status === 0 &&
    typeof result.stdout === "string" &&
    typeof result.stderr === "string" &&
    result.stderr.length === 0 &&
    result.stdout.trim() === boundary.policy.engineVersion
  )
    return "ready";
  if (
    result.pid === undefined ||
    result.error ||
    result.signal !== null ||
    result.status === null ||
    result.status === 0 ||
    typeof result.stdout !== "string" ||
    result.stdout.length !== 0
  )
    return "unknown";
  try {
    const handle = fs.openSync(DOCKER_ENGINE_PIPE, "r+");
    fs.closeSync(handle);
    return "unknown";
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    return code === "ENOENT" ? "known_unavailable" : "unknown";
  }
}

function observeKnownSocketFailure(boundary: PreparedBoundary) {
  try {
    const runIdentity = identityAt(boundary.runDirectory);
    if (!runIdentity) return null;
    const handle = fs.openSync(boundary.socketPath, "r");
    fs.closeSync(handle);
    return null;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    return KNOWN_SOCKET_ERROR_CODES.has(code)
      ? identityAt(boundary.runDirectory)
      : null;
  }
}

function officialShutdown(
  boundary: PreparedBoundary,
  operation: DockerDesktopRepairOperation,
): TaggedEffect {
  const cli = boundary.policy.artifacts.get("desktop_cli");
  const config = dockerConfig(operation);
  const environment = createWindowsDockerCliEnvironment({
    dockerConfig: config,
    dockerHome: config,
  });
  if (!cli || !environment)
    return Object.freeze({ issued: false, confirmation: "unknown" });
  const result = spawnSync(cli.path, ["-Shutdown"], {
    env: environment,
    shell: false,
    windowsHide: true,
    encoding: "buffer",
    timeout: 30_000,
    maxBuffer: 4_096,
  });
  return Object.freeze({
    issued: result.pid !== undefined,
    confirmation:
      result.status === 0 && result.signal === null && !result.error
        ? "confirmed"
        : "unknown",
  });
}

function terminateDockerWsl(): TaggedEffect {
  const environment = createWindowsNativeHelperEnvironment();
  const systemRoot = environment?.SystemRoot;
  if (!environment || !systemRoot)
    return Object.freeze({ issued: false, confirmation: "unknown" });
  const executable = path.win32.join(systemRoot, "System32", "wsl.exe");
  const result = spawnSync(executable, ["--terminate", "docker-desktop"], {
    env: environment,
    shell: false,
    windowsHide: true,
    encoding: "buffer",
    timeout: 15_000,
    maxBuffer: 16_384,
  });
  return Object.freeze({
    issued: result.pid !== undefined,
    confirmation:
      result.status === 0 && result.signal === null && !result.error
        ? "confirmed"
        : "unknown",
  });
}

function renameRunDirectory(
  boundary: PreparedBoundary,
  operation: DockerDesktopRepairOperation,
): RenameOutcome {
  try {
    const before = identityAt(boundary.runDirectory);
    if (
      !before ||
      !sameIdentity(before, operation.runIdentity) ||
      fs.existsSync(operation.staleDirectory)
    )
      return Object.freeze({
        issued: false,
        confirmation: "unknown",
        staleState: "absent" as const,
      });
    fs.renameSync(boundary.runDirectory, operation.staleDirectory);
    const after = identityAt(operation.staleDirectory);
    const confirmed =
      after !== null &&
      sameIdentity(after, operation.runIdentity) &&
      !fs.existsSync(boundary.runDirectory);
    return Object.freeze({
      issued: true,
      confirmation: confirmed ? "confirmed" : "unknown",
      staleState: confirmed ? ("retained" as const) : ("unknown" as const),
    });
  } catch {
    return Object.freeze({
      issued: null,
      confirmation: "unknown",
      staleState: "unknown" as const,
    });
  }
}

function startDesktop(boundary: PreparedBoundary): TaggedEffect {
  const launcher = boundary.policy.artifacts.get("launcher");
  const environment = createWindowsDockerDesktopLauncherEnvironment(
    boundary.localAppData,
  );
  if (!launcher || !environment)
    return Object.freeze({ issued: false, confirmation: "unknown" });
  try {
    const child = spawn(launcher.path, ["--minimized"], {
      env: environment,
      shell: false,
      windowsHide: true,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return Object.freeze({
      issued: child.pid !== undefined,
      confirmation: child.pid === undefined ? "unknown" : "confirmed",
    });
  } catch {
    return Object.freeze({ issued: false, confirmation: "unknown" });
  }
}

async function awaitEngine(
  boundary: PreparedBoundary,
  shouldStop: () => boolean,
): Promise<EngineObservation> {
  for (let attempt = 0; attempt < ENGINE_WAIT_ATTEMPTS; attempt += 1) {
    if (shouldStop()) return "unknown";
    const observed = observeEngine(boundary);
    if (observed === "ready") return "ready";
    if (observed === "unknown") return "unknown";
    await new Promise((resolve) => {
      setTimeout(resolve, 1_000);
    });
  }
  return "known_unavailable";
}

function persist(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  operation: DockerDesktopRepairOperation,
  stage: Parameters<RepairDependencies["persistStage"]>[2],
  ledger: MutableLedger,
) {
  ledger.filesystemEffectIssued = mergeIssued(
    ledger.filesystemEffectIssued,
    true,
  );
  const updated = dependencies.persistStage(
    boundary,
    operation,
    stage,
    snapshotLedger(ledger),
  );
  if (!updated) {
    ledger.filesystemEffectIssued = null;
    ledger.evidenceState = "unknown";
    markUnknown(ledger);
    return null;
  }
  ledger.evidenceState = "preserved";
  return updated;
}

function inventoryState(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
) {
  const inventory = dependencies.inventory(boundary);
  if (inventory.status !== "verified") return null;
  const unfinished = inventory.operations.filter(
    (operation) =>
      operation.stage !== "closed_retained" &&
      operation.stage !== "closed_reconciled_no_stale",
  );
  if (unfinished.length > 1) return null;
  for (const operation of inventory.operations) {
    if (
      operation.stage === "closed_retained" ||
      operation.stage === "recovered_pending_disposition" ||
      operation.stage === "renamed"
    ) {
      const observed = dependencies.identityAt(operation.staleDirectory);
      if (!observed || !sameIdentity(observed, operation.runIdentity))
        return null;
    }
    if (
      operation.stage === "closed_reconciled_no_stale" &&
      dependencies.identityAt(operation.staleDirectory) !== null
    )
      return null;
  }
  return Object.freeze({ inventory, unfinished: unfinished[0] ?? null });
}

function attachCancellation(session: DockerDesktopRepairNativeHelperSession) {
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };
  const removeFailure = session.onFailureDetected(cancel);
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  return Object.freeze({
    shouldStop: () => cancelled || !session.assertLive(),
    dispose: () => {
      removeFailure();
      process.removeListener("SIGINT", cancel);
      process.removeListener("SIGTERM", cancel);
    },
  });
}

async function executeRepair(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  existing: DockerDesktopRepairOperation | null,
) {
  let operation = existing;
  const ledger = operation ? ledgerFrom(operation) : initialLedger();
  const cancellation = attachCancellation(session);
  let status: DockerDesktopRuntimeRepairReport["status"] = "blocked";
  let reason = "docker_desktop_repair_failed_closed";
  let durableEffectBoundaryEntered = operation !== null;
  try {
    if (cancellation.shouldStop()) {
      markUnknown(ledger);
      reason = "docker_desktop_repair_native_helper_lost";
      return { status, reason, ledger, operation };
    }
    if (!operation) {
      const firstEngine = dependencies.observeEngine(boundary);
      ledger.engineReady =
        firstEngine === "ready"
          ? true
          : firstEngine === "known_unavailable"
            ? false
            : null;
      if (firstEngine === "ready") {
        reason = "docker_desktop_engine_already_available";
        return { status, reason, ledger, operation };
      }
      if (firstEngine !== "known_unavailable") {
        reason = "docker_desktop_engine_state_unknown";
        return { status, reason, ledger, operation };
      }
      const runIdentity = dependencies.observeKnownSocketFailure(boundary);
      if (!runIdentity) {
        reason = "docker_desktop_known_socket_failure_unconfirmed";
        return { status, reason, ledger, operation };
      }
      const secondEngine = dependencies.observeEngine(boundary);
      ledger.engineReady =
        secondEngine === "ready"
          ? true
          : secondEngine === "known_unavailable"
            ? false
            : null;
      if (secondEngine === "ready") {
        reason = "docker_desktop_engine_recovered_before_effect";
        return { status, reason, ledger, operation };
      }
      if (secondEngine !== "known_unavailable") {
        reason = "docker_desktop_engine_state_unknown";
        return { status, reason, ledger, operation };
      }
      operation = createDockerDesktopRepairOperation(
        boundary,
        runIdentity,
        snapshotLedger(ledger),
      );
      durableEffectBoundaryEntered = true;
      const prepared = persist(
        dependencies,
        boundary,
        operation,
        "prepared",
        ledger,
      );
      if (!prepared) {
        reason = "docker_desktop_repair_record_unavailable";
        return { status, reason, ledger, operation };
      }
      operation = prepared;
    }

    if (operation.stage === "recovered_pending_disposition") {
      ledger.disposition = "pending_human_decision";
      status = "recovered_pending_close";
      reason = "docker_desktop_runtime_recovered_pending_close";
      return { status, reason, ledger, operation };
    }

    if (operation.stage === "prepared") {
      const currentEngine = dependencies.observeEngine(boundary);
      ledger.engineReady =
        currentEngine === "ready"
          ? true
          : currentEngine === "known_unavailable"
            ? false
            : null;
      const run = dependencies.identityAt(boundary.runDirectory);
      const stale = dependencies.identityAt(operation.staleDirectory);
      if (
        currentEngine === "ready" &&
        run &&
        sameIdentity(run, operation.runIdentity) &&
        !stale
      ) {
        // A previous process may have stopped Docker after recording only the
        // prepared stage. Reconciliation proves the current safe state, not
        // that no prior Process Effect occurred.
        ledger.processEffectIssued = null;
        ledger.hostSafety = "safe";
        ledger.staleState = "absent";
        ledger.disposition = "not_applicable";
        const closed = persist(
          dependencies,
          boundary,
          operation,
          "closed_reconciled_no_stale",
          ledger,
        );
        if (!closed) {
          reason = "docker_desktop_repair_record_update_failed";
          return { status, reason, ledger, operation };
        }
        operation = closed;
        status = "closed_no_stale";
        reason = "docker_desktop_repair_reconciled_without_stale_runtime";
        return { status, reason, ledger, operation };
      }
      if (!run && stale && sameIdentity(stale, operation.runIdentity)) {
        ledger.filesystemEffectIssued = true;
        ledger.staleState = "retained";
        const renamed = persist(
          dependencies,
          boundary,
          operation,
          "renamed",
          ledger,
        );
        if (!renamed) {
          reason = "docker_desktop_repair_record_update_failed";
          return { status, reason, ledger, operation };
        }
        operation = renamed;
      } else if (
        currentEngine !== "known_unavailable" ||
        !run ||
        !sameIdentity(run, operation.runIdentity) ||
        stale
      ) {
        markUnknown(ledger);
        ledger.staleState = stale ? "unknown" : ledger.staleState;
        reason = "docker_desktop_repair_resume_state_unknown";
        return { status, reason, ledger, operation };
      }
    }

    if (operation.stage === "prepared") {
      if (cancellation.shouldStop()) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_cancelled";
        return { status, reason, ledger, operation };
      }
      const shutdown = dependencies.officialShutdown(boundary, operation);
      ledger.processEffectIssued = mergeIssued(
        ledger.processEffectIssued,
        shutdown.issued,
      );
      if (cancellation.shouldStop()) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_native_helper_lost";
        return { status, reason, ledger, operation };
      }
      const processes = await session.inspectProcesses();
      if (processes === "unknown") {
        markUnknown(ledger);
        reason = "docker_desktop_process_inventory_unknown";
        return { status, reason, ledger, operation };
      }
      if (processes === "verified") {
        const termination = await session.terminateProcesses();
        if (termination === "terminated") ledger.processEffectIssued = true;
        else if (termination === "absent") {
          ledger.processEffectIssued = mergeIssued(
            ledger.processEffectIssued,
            shutdown.issued,
          );
        } else {
          ledger.processEffectIssued = null;
          markUnknown(ledger);
          reason = "docker_desktop_process_termination_unknown";
          return { status, reason, ledger, operation };
        }
      }
      if (cancellation.shouldStop()) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_native_helper_lost";
        return { status, reason, ledger, operation };
      }
      const wsl = dependencies.terminateDockerWsl();
      ledger.processEffectIssued = mergeIssued(
        ledger.processEffectIssued,
        wsl.issued,
      );
      if (wsl.confirmation !== "confirmed" || cancellation.shouldStop()) {
        markUnknown(ledger);
        reason = "docker_desktop_wsl_termination_unconfirmed";
        return { status, reason, ledger, operation };
      }
      if ((await session.inspectProcesses()) !== "absent") {
        ledger.processEffectIssued = null;
        markUnknown(ledger);
        reason = "docker_desktop_process_quiescence_unconfirmed";
        return { status, reason, ledger, operation };
      }
      if ((await session.verifyArtifacts()) !== "verified") {
        markUnknown(ledger);
        reason = "docker_desktop_package_identity_changed";
        return { status, reason, ledger, operation };
      }
      const stopped = persist(
        dependencies,
        boundary,
        operation,
        "processes_stopped",
        ledger,
      );
      if (!stopped) {
        reason = "docker_desktop_repair_record_update_failed";
        return { status, reason, ledger, operation };
      }
      operation = stopped;
    }

    if (operation.stage === "processes_stopped") {
      if (cancellation.shouldStop()) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_cancelled";
        return { status, reason, ledger, operation };
      }
      const rename = dependencies.renameRunDirectory(boundary, operation);
      ledger.filesystemEffectIssued = mergeIssued(
        ledger.filesystemEffectIssued,
        rename.issued,
      );
      ledger.staleState = rename.staleState;
      if (rename.confirmation !== "confirmed" || cancellation.shouldStop()) {
        markUnknown(ledger);
        reason = "docker_desktop_runtime_rename_unconfirmed";
        return { status, reason, ledger, operation };
      }
      const renamed = persist(
        dependencies,
        boundary,
        operation,
        "renamed",
        ledger,
      );
      if (!renamed) {
        reason = "docker_desktop_repair_record_update_failed";
        return { status, reason, ledger, operation };
      }
      operation = renamed;
    }

    if (operation.stage === "renamed") {
      const stale = dependencies.identityAt(operation.staleDirectory);
      if (!stale || !sameIdentity(stale, operation.runIdentity)) {
        ledger.staleState = "unknown";
        markUnknown(ledger);
        reason = "docker_desktop_stale_runtime_identity_unknown";
        return { status, reason, ledger, operation };
      }
      if ((await session.verifyArtifacts()) !== "verified") {
        markUnknown(ledger);
        reason = "docker_desktop_package_identity_changed";
        return { status, reason, ledger, operation };
      }
      if (cancellation.shouldStop()) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_cancelled";
        return { status, reason, ledger, operation };
      }
      const started = dependencies.startDesktop(boundary);
      ledger.processEffectIssued = mergeIssued(
        ledger.processEffectIssued,
        started.issued,
      );
      if (started.confirmation !== "confirmed" || cancellation.shouldStop()) {
        markUnknown(ledger);
        reason = "docker_desktop_restart_unconfirmed";
        return { status, reason, ledger, operation };
      }
      const engine = await dependencies.awaitEngine(
        boundary,
        cancellation.shouldStop,
      );
      ledger.engineReady =
        engine === "ready"
          ? true
          : engine === "known_unavailable"
            ? false
            : null;
      if (engine !== "ready" || cancellation.shouldStop()) {
        if (engine === "unknown") markUnknown(ledger);
        else ledger.hostSafety = "manual_recovery_required";
        reason =
          engine === "known_unavailable"
            ? "docker_desktop_engine_restart_unconfirmed"
            : "docker_desktop_engine_state_unknown";
        return { status, reason, ledger, operation };
      }
      if (
        (await session.verifyArtifacts()) !== "verified" ||
        (await session.inspectProcesses()) !== "verified"
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_started_package_identity_unknown";
        return { status, reason, ledger, operation };
      }
      ledger.hostSafety = "safe";
      ledger.evidenceState = "preserved";
      ledger.disposition = "pending_human_decision";
      if (cancellation.shouldStop()) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_cancelled";
        return { status, reason, ledger, operation };
      }
      const pending = persist(
        dependencies,
        boundary,
        operation,
        "recovered_pending_disposition",
        ledger,
      );
      if (!pending) {
        reason = "docker_desktop_repair_record_update_failed";
        return { status, reason, ledger, operation };
      }
      operation = pending;
      status = "recovered_pending_close";
      reason = "docker_desktop_runtime_recovered_pending_close";
    }
    return { status, reason, ledger, operation };
  } catch {
    markUnknown(ledger);
    if (durableEffectBoundaryEntered) {
      ledger.processEffectIssued =
        ledger.processEffectIssued === false
          ? null
          : ledger.processEffectIssued;
      ledger.filesystemEffectIssued =
        ledger.filesystemEffectIssued === false
          ? null
          : ledger.filesystemEffectIssued;
    }
    reason = "docker_desktop_repair_failed_closed";
    return { status, reason, ledger, operation };
  } finally {
    cancellation.dispose();
  }
}

export async function repairWindowsDockerDesktopRuntimeUsingDependencies(
  dependencies: RepairDependencies,
): Promise<DockerDesktopRuntimeRepairReport> {
  const ledger = initialLedger();
  let boundary: PreparedBoundary | null = null;
  let session: DockerDesktopRepairNativeHelperSession | null = null;
  let operation: DockerDesktopRepairOperation | null = null;
  let status: DockerDesktopRuntimeRepairReport["status"] = "blocked";
  let reason = "docker_desktop_repair_failed_closed";
  try {
    boundary = dependencies.prepareBoundary();
    if (!boundary) {
      return report(
        status,
        "docker_desktop_repair_boundary_unavailable",
        ledger,
        null,
      );
    }
    const helper = await dependencies.acquireHelper(boundary);
    if (helper.status !== "acquired" || !helper.session) {
      ledger.nativeHelperCleanupConfirmed = helper.status === "unavailable";
      if (helper.status === "cleanup_unknown") markUnknown(ledger);
      return report(
        status,
        helper.status === "unavailable"
          ? "docker_desktop_repair_lock_unavailable"
          : "docker_desktop_repair_lock_cleanup_unknown",
        ledger,
        null,
      );
    }
    session = helper.session;
    const inventory = inventoryState(dependencies, boundary);
    if (!inventory) {
      markUnknown(ledger);
      reason = "docker_desktop_repair_inventory_unknown";
    } else if (
      inventory.unfinished?.stage === "recovered_pending_disposition"
    ) {
      operation = inventory.unfinished;
      Object.assign(ledger, operation.ledger);
      ledger.disposition = "pending_human_decision";
      status = "recovered_pending_close";
      reason = "docker_desktop_runtime_recovered_pending_close";
    } else {
      const executed = await executeRepair(
        dependencies,
        boundary,
        session,
        inventory.unfinished,
      );
      status = executed.status;
      reason = executed.reason;
      operation = executed.operation;
      Object.assign(ledger, executed.ledger);
    }
  } catch {
    markUnknown(ledger);
    // Package/boundary/helper acquisition failures do not imply a Docker
    // process or filesystem mutation. Once an operation exists its durable
    // ledger is the conservative source of truth.
    if (operation) {
      ledger.processEffectIssued =
        ledger.processEffectIssued === false
          ? null
          : ledger.processEffectIssued;
      ledger.filesystemEffectIssued =
        ledger.filesystemEffectIssued === false
          ? null
          : ledger.filesystemEffectIssued;
    }
    reason = "docker_desktop_repair_failed_closed";
  } finally {
    if (session) {
      try {
        const released = await session.release();
        ledger.nativeHelperCleanupConfirmed = released === "released";
        if (released !== "released") {
          markUnknown(ledger);
          status = "blocked";
          reason = "docker_desktop_repair_lock_cleanup_unknown";
        }
      } catch {
        ledger.nativeHelperCleanupConfirmed = false;
        markUnknown(ledger);
        status = "blocked";
        reason = "docker_desktop_repair_lock_cleanup_unknown";
      }
    }
  }
  return report(status, reason, ledger, operation);
}

export async function closeWindowsDockerDesktopRepairUsingDependencies(
  repairId: unknown,
  dependencies: RepairDependencies,
): Promise<DockerDesktopRuntimeRepairReport> {
  const ledger = initialLedger();
  let operation: DockerDesktopRepairOperation | null = null;
  let session: DockerDesktopRepairNativeHelperSession | null = null;
  let status: DockerDesktopRuntimeRepairReport["status"] = "blocked";
  let reason = "docker_desktop_repair_close_failed_closed";
  try {
    const expectedId = parseDockerDesktopRepairId(repairId);
    const boundary = dependencies.prepareBoundary();
    if (!expectedId || !boundary) {
      return report(
        status,
        "docker_desktop_repair_close_boundary_unavailable",
        ledger,
        null,
      );
    }
    const helper = await dependencies.acquireHelper(boundary);
    if (helper.status !== "acquired" || !helper.session) {
      ledger.nativeHelperCleanupConfirmed = helper.status === "unavailable";
      if (helper.status === "cleanup_unknown") markUnknown(ledger);
      return report(
        status,
        helper.status === "unavailable"
          ? "docker_desktop_repair_lock_unavailable"
          : "docker_desktop_repair_lock_cleanup_unknown",
        ledger,
        null,
      );
    }
    session = helper.session;
    const inventory = inventoryState(dependencies, boundary);
    operation =
      inventory?.inventory.operations.find(
        (candidate) => candidate.operationId === expectedId,
      ) ?? null;
    if (!inventory || !operation) {
      markUnknown(ledger);
      reason = "docker_desktop_repair_close_inventory_unknown";
    } else if (operation.stage === "closed_retained") {
      Object.assign(ledger, operation.ledger);
      status = "closed_retained";
      reason = "docker_desktop_repair_evidence_retention_already_closed";
    } else if (operation.stage !== "recovered_pending_disposition") {
      Object.assign(ledger, operation.ledger);
      reason = "docker_desktop_repair_close_state_invalid";
    } else {
      Object.assign(ledger, operation.ledger);
      const stale = dependencies.identityAt(operation.staleDirectory);
      const engine = dependencies.observeEngine(boundary);
      const processes = await session.inspectProcesses();
      if (
        !stale ||
        !sameIdentity(stale, operation.runIdentity) ||
        engine !== "ready" ||
        processes !== "verified" ||
        (await session.verifyArtifacts()) !== "verified" ||
        !dependencies.identityAt(boundary.runDirectory)
      ) {
        if (engine === "unknown" || processes === "unknown")
          markUnknown(ledger);
        reason = "docker_desktop_repair_close_precondition_unconfirmed";
      } else {
        ledger.engineReady = true;
        ledger.staleState = "retained";
        ledger.hostSafety = "safe";
        ledger.evidenceState = "preserved";
        ledger.disposition = "retained_by_human_decision";
        ledger.nativeHelperCleanupConfirmed = true;
        const closed = persist(
          dependencies,
          boundary,
          operation,
          "closed_retained",
          ledger,
        );
        if (!closed) {
          reason = "docker_desktop_repair_record_update_failed";
        } else {
          operation = closed;
          status = "closed_retained";
          reason = "docker_desktop_repair_evidence_retention_closed";
        }
      }
    }
  } catch {
    markUnknown(ledger);
    reason = "docker_desktop_repair_close_failed_closed";
  } finally {
    if (session) {
      try {
        const released = await session.release();
        ledger.nativeHelperCleanupConfirmed = released === "released";
        if (released !== "released") {
          markUnknown(ledger);
          status = "blocked";
          reason = "docker_desktop_repair_lock_cleanup_unknown";
        }
      } catch {
        ledger.nativeHelperCleanupConfirmed = false;
        markUnknown(ledger);
        status = "blocked";
        reason = "docker_desktop_repair_lock_cleanup_unknown";
      }
    }
  }
  return report(status, reason, ledger, operation);
}

const productionDependencies: RepairDependencies = Object.freeze({
  prepareBoundary: preparedBoundary,
  acquireHelper: (boundary) =>
    acquireRuntimeOwnedDockerDesktopRepairNativeHelper(
      boundary.platformAccessArtifact,
    ),
  inventory: inventoryDockerDesktopRepairOperations,
  observeEngine,
  observeKnownSocketFailure,
  persistStage: persistDockerDesktopRepairStage,
  officialShutdown,
  terminateDockerWsl,
  renameRunDirectory,
  startDesktop,
  awaitEngine,
  identityAt,
});

export function repairRuntimeOwnedWindowsDockerDesktopRuntime() {
  return repairWindowsDockerDesktopRuntimeUsingDependencies(
    productionDependencies,
  );
}

export function closeRuntimeOwnedWindowsDockerDesktopRepair(repairId: unknown) {
  return closeWindowsDockerDesktopRepairUsingDependencies(
    repairId,
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
    engineObservation: "ready_known_unavailable_unknown",
    selectedUserAndKnownFolder:
      "native_runtime_state_binding_then_fixed_local_app_data_derivation",
    lockAndPackageExclusion:
      "signed_native_helper_global_selected_user_mutex_and_deny_write_delete_handles",
    processTermination:
      "same_verified_kernel_process_handle_query_terminate_wait_close",
    wslTermination: "docker_desktop_distribution_only",
    filesystemEffects: Object.freeze([
      "bounded_protected_runtime_state_repair_records",
      "same_parent_run_directory_rename_without_deletion",
    ]),
    recordLifecycle: Object.freeze([
      "active",
      "recovered_pending_disposition",
      "closed_retained",
    ]),
    staleDirectoryDeletion: false,
    providerEffectIssued: false,
  });
}
