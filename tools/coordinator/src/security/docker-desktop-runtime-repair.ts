import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  createWindowsDockerCliEnvironment,
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
  type DockerDesktopRepairEffectConfirmation,
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
export const DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION = 3;

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
    crddManifestHash: string;
    crddReleaseSequence: number;
    crddTree: string;
    packageContentRootSha256: string;
    policy: DockerDesktopRepairPolicy;
  }>;

type MutableLedger = {
  processEffectIssued: boolean | null;
  processEffectConfirmation: DockerDesktopRepairEffectConfirmation;
  filesystemEffectIssued: boolean | null;
  filesystemEffectConfirmation: DockerDesktopRepairEffectConfirmation;
  engineReady: boolean | null;
  staleState: DockerDesktopRepairStaleState;
  hostSafety: DockerDesktopRepairHostSafety;
  evidenceState: DockerDesktopRepairEvidenceState;
  disposition:
    | "not_applicable"
    | "pending_human_decision"
    | "historical_effect_unknown_pending_human_decision"
    | "retained_by_human_decision"
    | "historical_effect_unknown_retained_by_human_decision";
};

export type DockerDesktopRuntimeRepairReport = Readonly<{
  contract: typeof DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT;
  contractRevision: typeof DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION;
  status:
    | "blocked"
    | "recovered_pending_close"
    | "closed_retained"
    | "closed_historical_effect_unknown_retained"
    | "closed_no_stale";
  reason: string;
  repairId: string | null;
  operationState: string | null;
  manualRecoveryRequired: boolean;
  processEffectIssued: boolean | null;
  processEffectConfirmation: DockerDesktopRepairEffectConfirmation;
  filesystemEffectIssued: boolean | null;
  filesystemEffectConfirmation: DockerDesktopRepairEffectConfirmation;
  engineReady: boolean | null;
  staleRuntimeDirectory: DockerDesktopRepairStaleState;
  evidenceState: DockerDesktopRepairEvidenceState;
  disposition:
    | "not_applicable"
    | "pending_human_decision"
    | "historical_effect_unknown_pending_human_decision"
    | "retained_by_human_decision"
    | "historical_effect_unknown_retained_by_human_decision";
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
  awaitEngine: (
    boundary: PreparedBoundary,
    shouldStop: () => boolean,
  ) => Promise<EngineObservation>;
  identityAt: (target: string) => DockerDesktopRepairDirectoryIdentity | null;
}>;

function initialLedger(): MutableLedger {
  return {
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffectIssued: false,
    filesystemEffectConfirmation: "not_issued",
    engineReady: null,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "not_preserved",
    disposition: "not_applicable",
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

function mergeConfirmation(
  current: DockerDesktopRepairEffectConfirmation,
  issued: boolean | null,
  observed: TaggedEffect,
): DockerDesktopRepairEffectConfirmation {
  if (current === "confirmed") return "confirmed";
  if (issued === false && observed.issued === false) return "not_issued";
  return observed.confirmation === "confirmed" && observed.issued === true
    ? "confirmed"
    : "unknown";
}

function mergeProcessEffect(ledger: MutableLedger, observed: TaggedEffect) {
  ledger.processEffectConfirmation = mergeConfirmation(
    ledger.processEffectConfirmation,
    ledger.processEffectIssued,
    observed,
  );
  ledger.processEffectIssued = mergeIssued(
    ledger.processEffectIssued,
    observed.issued,
  );
}

function mergeFilesystemEffect(ledger: MutableLedger, observed: TaggedEffect) {
  ledger.filesystemEffectConfirmation = mergeConfirmation(
    ledger.filesystemEffectConfirmation,
    ledger.filesystemEffectIssued,
    observed,
  );
  ledger.filesystemEffectIssued = mergeIssued(
    ledger.filesystemEffectIssued,
    observed.issued,
  );
}

function report(
  status: DockerDesktopRuntimeRepairReport["status"],
  reason: string,
  ledger: MutableLedger,
  operation: DockerDesktopRepairOperation | null,
  nativeHelperCleanupConfirmed: boolean | null = true,
  newRepairPermitted = false,
): DockerDesktopRuntimeRepairReport {
  const effectStateUnknown =
    ledger.processEffectIssued === null ||
    ledger.filesystemEffectIssued === null ||
    ledger.staleState === "unknown" ||
    ledger.hostSafety === "unknown" ||
    nativeHelperCleanupConfirmed === null;
  const hostMutationPossible =
    ledger.processEffectIssued !== false ||
    ledger.filesystemEffectIssued !== false;
  const manualRecoveryRequired =
    ledger.hostSafety !== "safe" ||
    (hostMutationPossible && status === "blocked") ||
    nativeHelperCleanupConfirmed === false;
  return Object.freeze({
    contract: DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT,
    contractRevision: DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION,
    status,
    reason,
    repairId: operation?.repairId ?? null,
    operationState: operation?.stage ?? null,
    manualRecoveryRequired,
    processEffectIssued: ledger.processEffectIssued,
    processEffectConfirmation: ledger.processEffectConfirmation,
    filesystemEffectIssued: ledger.filesystemEffectIssued,
    filesystemEffectConfirmation: ledger.filesystemEffectConfirmation,
    engineReady: ledger.engineReady,
    staleRuntimeDirectory: ledger.staleState,
    evidenceState: ledger.evidenceState,
    disposition: ledger.disposition,
    nativeHelperCleanupConfirmed,
    effectStateUnknown,
    newRepairPermitted,
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

function samePreparedAuthority(
  left: PreparedBoundary,
  right: PreparedBoundary,
) {
  return (
    left.runtimeStateIdentityHash === right.runtimeStateIdentityHash &&
    left.runtimeStateProtectionHash === right.runtimeStateProtectionHash &&
    left.localUserBindingHash === right.localUserBindingHash &&
    left.runtimeStateBindingHash === right.runtimeStateBindingHash &&
    left.dockerPolicySha256 === right.dockerPolicySha256 &&
    left.crddManifestHash === right.crddManifestHash &&
    left.crddReleaseSequence === right.crddReleaseSequence &&
    left.crddTree === right.crddTree &&
    left.packageContentRootSha256 === right.packageContentRootSha256
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
    typeof packageVerification.manifestHash !== "string" ||
    !Number.isSafeInteger(packageVerification.releaseSequence) ||
    typeof packageVerification.crddTree !== "string" ||
    typeof packageVerification.packageContentRootSha256 !== "string" ||
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
    crddManifestHash: packageVerification.manifestHash,
    crddReleaseSequence: packageVerification.releaseSequence as number,
    crddTree: packageVerification.crddTree,
    packageContentRootSha256: packageVerification.packageContentRootSha256,
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
  mergeFilesystemEffect(
    ledger,
    Object.freeze({ issued: true, confirmation: "unknown" }),
  );
  const updated = dependencies.persistStage(
    boundary,
    operation,
    stage,
    snapshotLedger(ledger),
  );
  if (!updated) {
    ledger.evidenceState = "unknown";
    markUnknown(ledger);
    return null;
  }
  ledger.filesystemEffectConfirmation = "confirmed";
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
      operation.stage !== "closed_historical_effect_unknown_retained" &&
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
      (operation.stage === "closed_reconciled_no_stale" ||
        operation.stage === "no_stale_historical_effect_unknown_pending" ||
        operation.stage === "closed_historical_effect_unknown_retained") &&
      dependencies.identityAt(operation.staleDirectory) !== null
    )
      return null;
  }
  return Object.freeze({ inventory, unfinished: unfinished[0] ?? null });
}

function attachCancellation(session: DockerDesktopRepairNativeHelperSession) {
  let cancelled = false;
  let helperFailed = false;
  const cancel = () => {
    cancelled = true;
  };
  const helperFailure = () => {
    helperFailed = true;
  };
  const removeFailure = session.onFailureDetected(helperFailure);
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  return Object.freeze({
    shouldStop: () => cancelled || helperFailed || !session.assertLive(),
    effectAllowed: () => !cancelled && !helperFailed && session.assertLive(),
    helperAvailable: () => !helperFailed && session.assertLive(),
    dispose: () => {
      removeFailure();
      process.removeListener("SIGINT", cancel);
      process.removeListener("SIGTERM", cancel);
    },
  });
}

async function verifyEffectBoundary(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
) {
  const current = dependencies.prepareBoundary();
  return (
    current !== null &&
    samePreparedAuthority(boundary, current) &&
    (await session.verifyArtifacts()) === "verified" &&
    session.assertLive()
  );
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
      if (
        !cancellation.effectAllowed() ||
        !(await verifyEffectBoundary(dependencies, boundary, session))
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_authority_changed";
        return { status, reason, ledger, operation };
      }
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

    if (
      operation.stage === "recovered_pending_disposition" ||
      operation.stage === "no_stale_historical_effect_unknown_pending"
    ) {
      const historicalNoStale =
        operation.stage === "no_stale_historical_effect_unknown_pending";
      const engine = dependencies.observeEngine(boundary);
      const processes = await session.inspectProcesses();
      const run = dependencies.identityAt(boundary.runDirectory);
      const stale = dependencies.identityAt(operation.staleDirectory);
      if (
        engine !== "ready" ||
        processes !== "verified" ||
        !run ||
        (historicalNoStale
          ? stale !== null
          : !stale || !sameIdentity(stale, operation.runIdentity)) ||
        !(await verifyEffectBoundary(dependencies, boundary, session))
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_pending_current_state_unconfirmed";
        return { status, reason, ledger, operation };
      }
      ledger.engineReady = true;
      ledger.staleState = historicalNoStale ? "absent" : "retained";
      ledger.disposition = historicalNoStale
        ? "historical_effect_unknown_pending_human_decision"
        : "pending_human_decision";
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
        ledger.processEffectConfirmation = "unknown";
        ledger.hostSafety = "safe";
        ledger.staleState = "absent";
        ledger.disposition = "historical_effect_unknown_pending_human_decision";
        const closed = persist(
          dependencies,
          boundary,
          operation,
          "no_stale_historical_effect_unknown_pending",
          ledger,
        );
        if (!closed) {
          reason = "docker_desktop_repair_record_update_failed";
          return { status, reason, ledger, operation };
        }
        operation = closed;
        status = "recovered_pending_close";
        reason =
          "docker_desktop_repair_no_stale_historical_effect_unknown_pending_close";
        return { status, reason, ledger, operation };
      }
      if (!run && stale && sameIdentity(stale, operation.runIdentity)) {
        ledger.filesystemEffectIssued = true;
        ledger.filesystemEffectConfirmation = "confirmed";
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
      if (
        !cancellation.effectAllowed() ||
        !(await verifyEffectBoundary(dependencies, boundary, session))
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_authority_changed";
        return { status, reason, ledger, operation };
      }
      const shutdown = dependencies.officialShutdown(boundary, operation);
      mergeProcessEffect(ledger, shutdown);
      if (!cancellation.helperAvailable()) {
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
        if (termination === "terminated") {
          ledger.processEffectIssued = true;
          ledger.processEffectConfirmation = "confirmed";
        } else if (termination === "absent") {
          mergeProcessEffect(ledger, shutdown);
        } else {
          if (termination === "partial_or_unknown") {
            ledger.processEffectIssued = true;
          } else if (ledger.processEffectIssued === false) {
            ledger.processEffectIssued = null;
          }
          ledger.processEffectConfirmation = "unknown";
          markUnknown(ledger);
          reason = "docker_desktop_process_termination_unknown";
          if (
            cancellation.helperAvailable() &&
            (await verifyEffectBoundary(dependencies, boundary, session))
          ) {
            operation =
              persist(dependencies, boundary, operation, "prepared", ledger) ??
              operation;
          }
          return { status, reason, ledger, operation };
        }
      }
      if (cancellation.shouldStop()) {
        const cleanupObservation = cancellation.helperAvailable()
          ? await session.inspectProcesses()
          : "unknown";
        if (cleanupObservation !== "absent") markUnknown(ledger);
        if (
          cancellation.helperAvailable() &&
          (await verifyEffectBoundary(dependencies, boundary, session))
        ) {
          operation =
            persist(dependencies, boundary, operation, "prepared", ledger) ??
            operation;
        }
        reason = "docker_desktop_repair_cancelled_after_process_effect";
        return { status, reason, ledger, operation };
      }
      if (
        !cancellation.effectAllowed() ||
        !(await verifyEffectBoundary(dependencies, boundary, session))
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_authority_changed";
        return { status, reason, ledger, operation };
      }
      const wsl = dependencies.terminateDockerWsl();
      mergeProcessEffect(ledger, wsl);
      if (wsl.confirmation !== "confirmed" || !cancellation.helperAvailable()) {
        markUnknown(ledger);
        reason = "docker_desktop_wsl_termination_unconfirmed";
        return { status, reason, ledger, operation };
      }
      if ((await session.inspectProcesses()) !== "absent") {
        if (ledger.processEffectIssued === false)
          ledger.processEffectIssued = null;
        ledger.processEffectConfirmation = "unknown";
        markUnknown(ledger);
        reason = "docker_desktop_process_quiescence_unconfirmed";
        return { status, reason, ledger, operation };
      }
      if ((await session.verifyArtifacts()) !== "verified") {
        markUnknown(ledger);
        reason = "docker_desktop_package_identity_changed";
        return { status, reason, ledger, operation };
      }
      if (!(await verifyEffectBoundary(dependencies, boundary, session))) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_authority_changed";
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
      const resumedEngine = dependencies.observeEngine(boundary);
      const resumedProcesses = await session.inspectProcesses();
      const resumedRun = dependencies.identityAt(boundary.runDirectory);
      const resumedStale = dependencies.identityAt(operation.staleDirectory);
      if (resumedEngine === "ready" && resumedRun && !resumedStale) {
        ledger.engineReady = true;
        ledger.processEffectIssued = null;
        ledger.processEffectConfirmation = "unknown";
        ledger.staleState = "absent";
        ledger.hostSafety = "safe";
        ledger.disposition = "historical_effect_unknown_pending_human_decision";
        const pending = persist(
          dependencies,
          boundary,
          operation,
          "no_stale_historical_effect_unknown_pending",
          ledger,
        );
        if (!pending) {
          reason = "docker_desktop_repair_record_update_failed";
          return { status, reason, ledger, operation };
        }
        operation = pending;
        status = "recovered_pending_close";
        reason =
          "docker_desktop_repair_no_stale_historical_effect_unknown_pending_close";
        return { status, reason, ledger, operation };
      }
      if (
        resumedEngine === "ready" &&
        resumedRun &&
        resumedStale &&
        sameIdentity(resumedStale, operation.runIdentity) &&
        resumedProcesses === "verified"
      ) {
        ledger.engineReady = true;
        ledger.filesystemEffectIssued = true;
        ledger.filesystemEffectConfirmation = "confirmed";
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
        resumedEngine !== "known_unavailable" ||
        resumedProcesses !== "absent" ||
        !resumedRun ||
        !sameIdentity(resumedRun, operation.runIdentity) ||
        resumedStale
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_processes_stopped_resume_unknown";
        return { status, reason, ledger, operation };
      }
    }

    if (operation.stage === "processes_stopped") {
      if (cancellation.shouldStop()) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_cancelled";
        return { status, reason, ledger, operation };
      }
      if (
        !cancellation.effectAllowed() ||
        !(await verifyEffectBoundary(dependencies, boundary, session))
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_authority_changed";
        return { status, reason, ledger, operation };
      }
      const rename = dependencies.renameRunDirectory(boundary, operation);
      mergeFilesystemEffect(ledger, rename);
      ledger.staleState = rename.staleState;
      if (
        rename.confirmation !== "confirmed" ||
        !cancellation.helperAvailable()
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_runtime_rename_unconfirmed";
        return { status, reason, ledger, operation };
      }
      if (!(await verifyEffectBoundary(dependencies, boundary, session))) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_authority_changed";
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
      let engine = dependencies.observeEngine(boundary);
      const liveRun = dependencies.identityAt(boundary.runDirectory);
      const liveProcesses = await session.inspectProcesses();
      const alreadyRecovered =
        engine === "ready" && liveRun !== null && liveProcesses === "verified";
      if (
        !alreadyRecovered &&
        (engine !== "known_unavailable" ||
          liveRun !== null ||
          liveProcesses !== "absent")
      ) {
        if (engine === "unknown" || liveProcesses === "unknown")
          markUnknown(ledger);
        reason = "docker_desktop_renamed_resume_state_unknown";
        return { status, reason, ledger, operation };
      }
      if (cancellation.shouldStop() && !alreadyRecovered) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_cancelled";
        return { status, reason, ledger, operation };
      }
      if (!alreadyRecovered) {
        if (
          !cancellation.effectAllowed() ||
          !(await verifyEffectBoundary(dependencies, boundary, session))
        ) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_authority_changed";
          return { status, reason, ledger, operation };
        }
        const started = await session.launchDesktop();
        mergeProcessEffect(
          ledger,
          Object.freeze({
            issued: started === "started" ? true : null,
            confirmation: started === "started" ? "confirmed" : "unknown",
          }),
        );
        if (started !== "started" || !cancellation.helperAvailable()) {
          markUnknown(ledger);
          reason = "docker_desktop_restart_unconfirmed";
          return { status, reason, ledger, operation };
        }
        engine = await dependencies.awaitEngine(
          boundary,
          () => !cancellation.helperAvailable(),
        );
      }
      ledger.engineReady =
        engine === "ready"
          ? true
          : engine === "known_unavailable"
            ? false
            : null;
      if (engine !== "ready" || !cancellation.helperAvailable()) {
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
      if (!(await verifyEffectBoundary(dependencies, boundary, session))) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_authority_changed";
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
      if (ledger.processEffectIssued === null)
        ledger.processEffectConfirmation = "unknown";
      ledger.filesystemEffectIssued =
        ledger.filesystemEffectIssued === false
          ? null
          : ledger.filesystemEffectIssued;
      if (ledger.filesystemEffectIssued === null)
        ledger.filesystemEffectConfirmation = "unknown";
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
  let helperCleanupConfirmed: boolean | null = null;
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
      helperCleanupConfirmed = helper.status === "unavailable";
      if (helper.status === "cleanup_unknown") markUnknown(ledger);
      return report(
        status,
        helper.status === "unavailable"
          ? "docker_desktop_repair_lock_unavailable"
          : "docker_desktop_repair_lock_cleanup_unknown",
        ledger,
        null,
        helperCleanupConfirmed,
      );
    }
    session = helper.session;
    const inventory = inventoryState(dependencies, boundary);
    if (!inventory) {
      markUnknown(ledger);
      reason = "docker_desktop_repair_inventory_unknown";
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
      if (ledger.processEffectIssued === null)
        ledger.processEffectConfirmation = "unknown";
      ledger.filesystemEffectIssued =
        ledger.filesystemEffectIssued === false
          ? null
          : ledger.filesystemEffectIssued;
      if (ledger.filesystemEffectIssued === null)
        ledger.filesystemEffectConfirmation = "unknown";
    }
    reason = "docker_desktop_repair_failed_closed";
  } finally {
    if (session) {
      try {
        const released = await session.release();
        helperCleanupConfirmed = released === "released";
        if (released !== "released") {
          markUnknown(ledger);
          status = "blocked";
          reason = "docker_desktop_repair_lock_cleanup_unknown";
        }
      } catch {
        helperCleanupConfirmed = false;
        markUnknown(ledger);
        status = "blocked";
        reason = "docker_desktop_repair_lock_cleanup_unknown";
      }
    }
  }
  const terminal = (
    [
      "closed_retained",
      "closed_historical_effect_unknown_retained",
      "closed_no_stale",
    ] as readonly string[]
  ).includes(status);
  return report(
    status,
    reason,
    ledger,
    operation,
    helperCleanupConfirmed,
    terminal && helperCleanupConfirmed === true,
  );
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
  let helperCleanupConfirmed: boolean | null = null;
  let cancellation: ReturnType<typeof attachCancellation> | null = null;
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
      helperCleanupConfirmed = helper.status === "unavailable";
      if (helper.status === "cleanup_unknown") markUnknown(ledger);
      return report(
        status,
        helper.status === "unavailable"
          ? "docker_desktop_repair_lock_unavailable"
          : "docker_desktop_repair_lock_cleanup_unknown",
        ledger,
        null,
        helperCleanupConfirmed,
      );
    }
    session = helper.session;
    cancellation = attachCancellation(session);
    const inventory = inventoryState(dependencies, boundary);
    operation =
      inventory?.inventory.operations.find(
        (candidate) => candidate.operationId === expectedId,
      ) ?? null;
    if (!inventory || !operation) {
      markUnknown(ledger);
      reason = "docker_desktop_repair_close_inventory_unknown";
    } else if (
      inventory.unfinished &&
      inventory.unfinished.operationId !== operation.operationId
    ) {
      Object.assign(ledger, operation.ledger);
      reason = "docker_desktop_repair_another_operation_unfinished";
    } else if (
      operation.stage === "closed_retained" ||
      operation.stage === "closed_historical_effect_unknown_retained"
    ) {
      Object.assign(ledger, operation.ledger);
      const engine = dependencies.observeEngine(boundary);
      const processes = await session.inspectProcesses();
      const run = dependencies.identityAt(boundary.runDirectory);
      const stale = dependencies.identityAt(operation.staleDirectory);
      const historicalNoStale =
        operation.stage === "closed_historical_effect_unknown_retained";
      if (
        engine !== "ready" ||
        processes !== "verified" ||
        !run ||
        (historicalNoStale ? stale !== null : !stale) ||
        (await session.verifyArtifacts()) !== "verified"
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_terminal_current_state_unconfirmed";
      } else {
        status = historicalNoStale
          ? "closed_historical_effect_unknown_retained"
          : "closed_retained";
        reason = "docker_desktop_repair_evidence_retention_already_closed";
      }
    } else if (
      operation.stage !== "recovered_pending_disposition" &&
      operation.stage !== "no_stale_historical_effect_unknown_pending"
    ) {
      Object.assign(ledger, operation.ledger);
      reason = "docker_desktop_repair_close_state_invalid";
    } else {
      Object.assign(ledger, operation.ledger);
      const historicalNoStale =
        operation.stage === "no_stale_historical_effect_unknown_pending";
      const stale = dependencies.identityAt(operation.staleDirectory);
      const engine = dependencies.observeEngine(boundary);
      const processes = await session.inspectProcesses();
      if (
        (historicalNoStale
          ? stale !== null
          : !stale || !sameIdentity(stale, operation.runIdentity)) ||
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
        ledger.staleState = historicalNoStale ? "absent" : "retained";
        ledger.hostSafety = "safe";
        ledger.evidenceState = "preserved";
        ledger.disposition = historicalNoStale
          ? "historical_effect_unknown_retained_by_human_decision"
          : "retained_by_human_decision";
        if (
          !cancellation.effectAllowed() ||
          !(await verifyEffectBoundary(dependencies, boundary, session))
        ) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_authority_changed";
        } else {
          const closed = persist(
            dependencies,
            boundary,
            operation,
            historicalNoStale
              ? "closed_historical_effect_unknown_retained"
              : "closed_retained",
            ledger,
          );
          if (!closed) {
            reason = "docker_desktop_repair_record_update_failed";
          } else {
            operation = closed;
            status = historicalNoStale
              ? "closed_historical_effect_unknown_retained"
              : "closed_retained";
            reason = "docker_desktop_repair_evidence_retention_closed";
          }
        }
      }
    }
  } catch {
    markUnknown(ledger);
    reason = "docker_desktop_repair_close_failed_closed";
  } finally {
    cancellation?.dispose();
    if (session) {
      try {
        const released = await session.release();
        helperCleanupConfirmed = released === "released";
        if (released !== "released") {
          markUnknown(ledger);
          status = "blocked";
          reason = "docker_desktop_repair_lock_cleanup_unknown";
        }
      } catch {
        helperCleanupConfirmed = false;
        markUnknown(ledger);
        status = "blocked";
        reason = "docker_desktop_repair_lock_cleanup_unknown";
      }
    }
  }
  const terminal = (
    [
      "closed_retained",
      "closed_historical_effect_unknown_retained",
      "closed_no_stale",
    ] as readonly string[]
  ).includes(status);
  return report(
    status,
    reason,
    ledger,
    operation,
    helperCleanupConfirmed,
    terminal && helperCleanupConfirmed === true,
  );
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
    purpose: "windows_known_failure_last_resort_only",
    automaticFallback: false,
    engineObservation: "ready_known_unavailable_unknown",
    selectedUserAndKnownFolder:
      "native_runtime_state_binding_then_fixed_local_app_data_derivation",
    lockAndPackageExclusion:
      "signed_native_helper_global_selected_user_mutex_and_deny_write_delete_handles",
    processTermination:
      "same_verified_kernel_process_handle_query_terminate_wait_close",
    desktopLaunch:
      "native_create_process_exact_launcher_handle_identity_and_minimal_known_folder_environment",
    dockerIdentityCoverage:
      "direct_effect_executable_set_and_engine_response_version_only",
    dockerInstallationAttestation: false,
    officialDockerDistributionAndUpdaterInTrustedComputingBase: true,
    wslTermination: "docker_desktop_distribution_only",
    filesystemEffects: Object.freeze([
      "bounded_protected_runtime_state_repair_records",
      "same_parent_run_directory_rename_without_deletion",
    ]),
    recordLifecycle: Object.freeze([
      "active",
      "recovered_pending_disposition",
      "no_stale_historical_effect_unknown_pending",
      "closed_retained",
      "closed_historical_effect_unknown_retained",
    ]),
    staleDirectoryDeletion: false,
    providerEffectIssued: false,
  });
}
