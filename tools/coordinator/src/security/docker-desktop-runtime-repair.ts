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
  hasDockerDesktopRepairRecordCapacity,
  type DockerDesktopRepairDirectoryIdentity,
  type DockerDesktopRepairEvidenceState,
  type DockerDesktopRepairEffectEntry,
  type DockerDesktopRepairEffectAction,
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
export const DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION = 4;

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
type PathObservation = Readonly<{
  state: "confirmed_absent" | "present" | "unknown";
  identity: DockerDesktopRepairDirectoryIdentity | null;
}>;
type TaggedEffect = Readonly<{
  issued: boolean | null;
  confirmation: DockerDesktopRepairEffectConfirmation;
}>;
type RenameOutcome = Readonly<{
  issued: boolean | null;
  confirmation: DockerDesktopRepairEffectConfirmation;
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
  processEffects: DockerDesktopRepairEffectEntry[];
  processEffectIssued: boolean | null;
  processEffectConfirmation: DockerDesktopRepairEffectConfirmation;
  filesystemEffects: DockerDesktopRepairEffectEntry[];
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
  liveRunIdentity: DockerDesktopRepairDirectoryIdentity | null;
};

export type DockerDesktopRuntimeRepairReport = Readonly<{
  contract: typeof DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT;
  contractRevision: typeof DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION;
  status:
    | "blocked"
    | "recovered_pending_close"
    | "closed_retained"
    | "closed_historical_effect_unknown_retained";
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
    stopDetected: Promise<void>,
  ) => Promise<EngineObservation>;
  identityAt: (target: string) => DockerDesktopRepairDirectoryIdentity | null;
  observePath?: (target: string) => PathObservation;
  registerCancellation?: (listener: () => void) => () => void;
}>;

function initialLedger(): MutableLedger {
  return {
    processEffects: [],
    processEffectIssued: false,
    processEffectConfirmation: "not_issued",
    filesystemEffects: [],
    filesystemEffectIssued: false,
    filesystemEffectConfirmation: "not_issued",
    engineReady: null,
    staleState: "absent",
    hostSafety: "safe",
    evidenceState: "not_preserved",
    disposition: "not_applicable",
    liveRunIdentity: null,
  };
}

function ledgerFrom(operation: DockerDesktopRepairOperation): MutableLedger {
  const ledger: MutableLedger = {
    ...operation.ledger,
    processEffects: [...operation.ledger.processEffects],
    filesystemEffects: [...operation.ledger.filesystemEffects],
  };
  const last = ledger.filesystemEffects.at(-1);
  if (
    last?.action === "record_write" &&
    last.issued === true &&
    last.confirmation === "unknown"
  ) {
    ledger.filesystemEffects[last.sequence] = Object.freeze({
      ...last,
      confirmation: "confirmed",
    });
    refreshEffectAggregate(ledger, "filesystem");
    ledger.evidenceState = "preserved";
  }
  return ledger;
}

function restoreLedger(
  target: MutableLedger,
  operation: DockerDesktopRepairOperation,
) {
  Object.assign(target, ledgerFrom(operation));
}

function snapshotLedger(
  ledger: MutableLedger,
): DockerDesktopRepairLedgerSnapshot {
  return Object.freeze({
    ...ledger,
    processEffects: Object.freeze([...ledger.processEffects]),
    filesystemEffects: Object.freeze([...ledger.filesystemEffects]),
  });
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

function refreshEffectAggregate(
  ledger: MutableLedger,
  kind: "process" | "filesystem",
) {
  const entries =
    kind === "process" ? ledger.processEffects : ledger.filesystemEffects;
  const issued = entries.reduce<boolean | null>(
    (current, entry) => mergeIssued(current, entry.issued),
    false,
  );
  const confirmation: DockerDesktopRepairEffectConfirmation =
    entries.length === 0 || entries.every((entry) => entry.issued === false)
      ? "not_issued"
      : entries.some(
            (entry) =>
              entry.issued === null || entry.confirmation === "unknown",
          )
        ? "unknown"
        : "confirmed";
  if (kind === "process") {
    ledger.processEffectIssued = issued;
    ledger.processEffectConfirmation = confirmation;
  } else {
    ledger.filesystemEffectIssued = issued;
    ledger.filesystemEffectConfirmation = confirmation;
  }
}

function appendEffect(
  ledger: MutableLedger,
  kind: "process" | "filesystem",
  action: DockerDesktopRepairEffectAction,
  observed: TaggedEffect,
) {
  const entries =
    kind === "process" ? ledger.processEffects : ledger.filesystemEffects;
  entries.push(
    Object.freeze({
      sequence: entries.length,
      action,
      phase: "settled" as const,
      ...observed,
    }),
  );
  refreshEffectAggregate(ledger, kind);
}

function mergeProcessEffect(
  ledger: MutableLedger,
  action: DockerDesktopRepairEffectAction,
  observed: TaggedEffect,
) {
  appendEffect(ledger, "process", action, observed);
}

function mergeFilesystemEffect(
  ledger: MutableLedger,
  action: DockerDesktopRepairEffectAction,
  observed: TaggedEffect,
) {
  appendEffect(ledger, "filesystem", action, observed);
}

function recordHostEffectIntent(
  ledger: MutableLedger,
  kind: "process" | "filesystem",
  action: DockerDesktopRepairEffectAction,
) {
  const entries =
    kind === "process" ? ledger.processEffects : ledger.filesystemEffects;
  if (entries.some((entry) => entry.action === action)) return false;
  entries.push(
    Object.freeze({
      sequence: entries.length,
      action,
      phase: "intent_recorded" as const,
      issued: null,
      confirmation: "unknown" as const,
    }),
  );
  refreshEffectAggregate(ledger, kind);
  return true;
}

function settleHostEffect(
  ledger: MutableLedger,
  kind: "process" | "filesystem",
  action: DockerDesktopRepairEffectAction,
  observed: TaggedEffect,
) {
  const entries =
    kind === "process" ? ledger.processEffects : ledger.filesystemEffects;
  const index = entries.findIndex((entry) => entry.action === action);
  const entry = entries[index];
  if (entry?.phase !== "intent_recorded") return false;
  entries[index] = Object.freeze({
    sequence: entry.sequence,
    action,
    phase: "settled" as const,
    ...observed,
  });
  refreshEffectAggregate(ledger, kind);
  return true;
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
    ledger.processEffectConfirmation === "unknown" ||
    ledger.filesystemEffectIssued === null ||
    ledger.filesystemEffectConfirmation === "unknown" ||
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

function observePath(target: string): PathObservation {
  try {
    const observed = identity(fs.lstatSync(target, { bigint: true }));
    return observed
      ? Object.freeze({ state: "present" as const, identity: observed })
      : Object.freeze({ state: "unknown" as const, identity: null });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    return code === "ENOENT"
      ? Object.freeze({ state: "confirmed_absent" as const, identity: null })
      : Object.freeze({ state: "unknown" as const, identity: null });
  }
}

function observePathUsing(
  dependencies: RepairDependencies,
  target: string,
): PathObservation {
  if (dependencies.observePath) return dependencies.observePath(target);
  const observed = dependencies.identityAt(target);
  return observed
    ? Object.freeze({ state: "present" as const, identity: observed })
    : Object.freeze({ state: "unknown" as const, identity: null });
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
    return Object.freeze({ issued: false, confirmation: "not_issued" });
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
      result.pid === undefined
        ? "not_issued"
        : result.status === 0 && result.signal === null && !result.error
          ? "confirmed"
          : "unknown",
  });
}

function terminateDockerWsl(): TaggedEffect {
  const environment = createWindowsNativeHelperEnvironment();
  const systemRoot = environment?.SystemRoot;
  if (!environment || !systemRoot)
    return Object.freeze({ issued: false, confirmation: "not_issued" });
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
      result.pid === undefined
        ? "not_issued"
        : result.status === 0 && result.signal === null && !result.error
          ? "confirmed"
          : "unknown",
  });
}

function renameRunDirectory(
  boundary: PreparedBoundary,
  operation: DockerDesktopRepairOperation,
): RenameOutcome {
  try {
    const beforeObservation = observePath(boundary.runDirectory);
    const before = beforeObservation.identity;
    if (
      beforeObservation.state !== "present" ||
      !before ||
      !sameIdentity(before, operation.runIdentity)
    )
      return Object.freeze({
        issued: null,
        confirmation: "unknown",
        staleState: "unknown" as const,
      });
    const staleObservation = observePath(operation.staleDirectory);
    if (staleObservation.state !== "confirmed_absent") {
      const stale = staleObservation.identity;
      return Object.freeze({
        issued: staleObservation.state === "present" ? false : null,
        confirmation:
          staleObservation.state === "present" ? "not_issued" : "unknown",
        staleState:
          stale && sameIdentity(stale, operation.runIdentity)
            ? ("retained" as const)
            : ("unknown" as const),
      });
    }
    fs.renameSync(boundary.runDirectory, operation.staleDirectory);
    const afterObservation = observePath(operation.staleDirectory);
    const runObservation = observePath(boundary.runDirectory);
    const after = afterObservation.identity;
    const confirmed =
      afterObservation.state === "present" &&
      after !== null &&
      sameIdentity(after, operation.runIdentity) &&
      runObservation.state === "confirmed_absent";
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
  stopDetected: Promise<void>,
): Promise<EngineObservation> {
  for (let attempt = 0; attempt < ENGINE_WAIT_ATTEMPTS; attempt += 1) {
    if (shouldStop()) return "unknown";
    const observed = observeEngine(boundary);
    if (observed === "ready") return "ready";
    if (observed === "unknown") return "unknown";
    await Promise.race([
      new Promise<void>((resolve) => {
        setTimeout(resolve, 1_000);
      }),
      stopDetected,
    ]);
    if (shouldStop()) return "unknown";
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
    "record_write",
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
  const recordWrite = ledger.filesystemEffects.at(-1);
  if (recordWrite?.action !== "record_write") {
    markUnknown(ledger);
    return null;
  }
  ledger.filesystemEffects[recordWrite.sequence] = Object.freeze({
    ...recordWrite,
    confirmation: "confirmed",
  });
  refreshEffectAggregate(ledger, "filesystem");
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
      operation.stage !== "closed_historical_effect_unknown_retained",
  );
  if (unfinished.length > 1) return null;
  for (const operation of inventory.operations) {
    if (
      operation.stage === "closed_retained" ||
      operation.stage === "recovered_pending_disposition" ||
      operation.stage === "renamed"
    ) {
      const observed = observePathUsing(dependencies, operation.staleDirectory);
      if (
        observed.state !== "present" ||
        !observed.identity ||
        !sameIdentity(observed.identity, operation.runIdentity)
      )
        return null;
    }
    if (
      (operation.stage === "no_stale_historical_effect_unknown_pending" ||
        operation.stage === "closed_historical_effect_unknown_retained") &&
      observePathUsing(dependencies, operation.staleDirectory).state !==
        "confirmed_absent"
    )
      return null;
  }
  return Object.freeze({ inventory, unfinished: unfinished[0] ?? null });
}

function registerProcessCancellation(listener: () => void) {
  process.once("SIGINT", listener);
  process.once("SIGTERM", listener);
  return () => {
    process.removeListener("SIGINT", listener);
    process.removeListener("SIGTERM", listener);
  };
}

function attachCancellation(
  session: DockerDesktopRepairNativeHelperSession,
  registerCancellation = registerProcessCancellation,
) {
  let cancelled = false;
  let helperFailed = false;
  let resolveStop!: () => void;
  const stopDetected = new Promise<void>((resolve) => {
    resolveStop = resolve;
  });
  const cancel = () => {
    cancelled = true;
    resolveStop();
  };
  const helperFailure = () => {
    helperFailed = true;
    resolveStop();
  };
  const removeFailure = session.onFailureDetected(helperFailure);
  const removeCancellation = registerCancellation(cancel);
  return Object.freeze({
    shouldStop: () => cancelled || helperFailed || !session.assertLive(),
    effectAllowed: () => !cancelled && !helperFailed && session.assertLive(),
    helperAvailable: () => !helperFailed && session.assertLive(),
    stopDetected,
    dispose: () => {
      removeFailure();
      removeCancellation();
    },
  });
}

async function verifyEffectBoundary(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  cancellation: ReturnType<typeof attachCancellation>,
) {
  if (!cancellation.effectAllowed()) return false;
  const artifacts = await observeHelperWithinCancellation(
    () => session.verifyArtifacts(),
    cancellation,
    session,
  );
  if (artifacts !== "verified") return false;
  const current = dependencies.prepareBoundary();
  return (
    current !== null &&
    samePreparedAuthority(boundary, current) &&
    cancellation.effectAllowed()
  );
}

async function verifyCleanupRecordBoundary(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
) {
  if (!session.assertLive()) return false;
  const artifacts = await session.verifyArtifacts();
  const current = dependencies.prepareBoundary();
  return (
    artifacts === "verified" &&
    current !== null &&
    samePreparedAuthority(boundary, current) &&
    session.assertLive()
  );
}

async function observeHelperWithinCancellation<T>(
  observe: () => Promise<T>,
  cancellation: ReturnType<typeof attachCancellation>,
  session: DockerDesktopRepairNativeHelperSession,
): Promise<T | null> {
  if (cancellation.shouldStop()) {
    await session.abort();
    return null;
  }
  const outcome = await Promise.race([
    observe().then((value) => ({ status: "observed" as const, value })),
    cancellation.stopDetected.then(() => ({ status: "stopped" as const })),
  ]);
  if (outcome.status === "observed") return outcome.value;
  await session.abort();
  return null;
}

function inspectProcessesWithinCancellation(
  session: DockerDesktopRepairNativeHelperSession,
  cancellation: ReturnType<typeof attachCancellation>,
) {
  return observeHelperWithinCancellation(
    () => session.inspectProcesses(),
    cancellation,
    session,
  );
}

async function persistAfterLiveBoundary(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  cancellation: ReturnType<typeof attachCancellation>,
  operation: DockerDesktopRepairOperation,
  stage: Parameters<RepairDependencies["persistStage"]>[2],
  ledger: MutableLedger,
) {
  return (await verifyEffectBoundary(
    dependencies,
    boundary,
    session,
    cancellation,
  ))
    ? persist(dependencies, boundary, operation, stage, ledger)
    : null;
}

async function persistHostEffectIntent(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  cancellation: ReturnType<typeof attachCancellation>,
  operation: DockerDesktopRepairOperation,
  kind: "process" | "filesystem",
  action: DockerDesktopRepairEffectAction,
  ledger: MutableLedger,
) {
  const requiredThroughSafeStage: Readonly<
    Partial<Record<DockerDesktopRepairEffectAction, number>>
  > = Object.freeze({
    official_shutdown: 13,
    native_termination: 11,
    wsl_termination: 9,
    runtime_directory_rename: 6,
    desktop_launch: 3,
  });
  if (
    !hasDockerDesktopRepairRecordCapacity(
      operation,
      requiredThroughSafeStage[action] ?? 2,
    )
  )
    return null;
  if (!recordHostEffectIntent(ledger, kind, action)) return null;
  return persistAfterLiveBoundary(
    dependencies,
    boundary,
    session,
    cancellation,
    operation,
    operation.stage,
    ledger,
  );
}

async function persistHostEffectSettlement(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  _cancellation: ReturnType<typeof attachCancellation>,
  operation: DockerDesktopRepairOperation,
  kind: "process" | "filesystem",
  action: DockerDesktopRepairEffectAction,
  observed: TaggedEffect,
  ledger: MutableLedger,
) {
  if (!settleHostEffect(ledger, kind, action, observed)) return null;
  return (await verifyCleanupRecordBoundary(dependencies, boundary, session))
    ? persist(dependencies, boundary, operation, operation.stage, ledger)
    : null;
}

async function executeRepair(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  existing: DockerDesktopRepairOperation | null,
) {
  let operation = existing;
  const ledger = operation ? ledgerFrom(operation) : initialLedger();
  const cancellation = attachCancellation(
    session,
    dependencies.registerCancellation,
  );
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
        !(await verifyEffectBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
        ))
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_authority_changed";
        return { status, reason, ledger, operation };
      }
      const prepared = await persistAfterLiveBoundary(
        dependencies,
        boundary,
        session,
        cancellation,
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

    const unsettledProcess = ledger.processEffects.find(
      (entry) => entry.phase === "intent_recorded",
    );
    const unsettledFilesystem = ledger.filesystemEffects.find(
      (entry) => entry.phase === "intent_recorded",
    );
    if (unsettledProcess || unsettledFilesystem) {
      if (
        unsettledFilesystem?.action === "runtime_directory_rename" &&
        !unsettledProcess
      ) {
        const engine = dependencies.observeEngine(boundary);
        const processes = await inspectProcessesWithinCancellation(
          session,
          cancellation,
        );
        const run = observePathUsing(dependencies, boundary.runDirectory);
        const stale = observePathUsing(dependencies, operation.staleDirectory);
        if (
          engine === "known_unavailable" &&
          processes === "absent" &&
          run.state === "confirmed_absent" &&
          stale.state === "present" &&
          stale.identity !== null &&
          sameIdentity(stale.identity, operation.runIdentity) &&
          settleHostEffect(ledger, "filesystem", "runtime_directory_rename", {
            issued: true,
            confirmation: "confirmed",
          })
        ) {
          ledger.staleState = "retained";
          const adopted = await persistAfterLiveBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
            operation,
            "renamed",
            ledger,
          );
          if (!adopted) {
            markUnknown(ledger);
            reason = "docker_desktop_repair_rename_adoption_record_unknown";
            return { status, reason, ledger, operation };
          }
          operation = adopted;
        } else {
          markUnknown(ledger);
          reason = "docker_desktop_repair_unsettled_effect_manual_recovery";
          return { status, reason, ledger, operation };
        }
      } else {
        markUnknown(ledger);
        reason = "docker_desktop_repair_unsettled_effect_manual_recovery";
        return { status, reason, ledger, operation };
      }
    }

    if (
      operation.stage === "recovered_pending_disposition" ||
      operation.stage === "no_stale_historical_effect_unknown_pending"
    ) {
      const historicalNoStale =
        operation.stage === "no_stale_historical_effect_unknown_pending";
      const engine = dependencies.observeEngine(boundary);
      const processes = await inspectProcessesWithinCancellation(
        session,
        cancellation,
      );
      const runObservation = observePathUsing(
        dependencies,
        boundary.runDirectory,
      );
      const staleObservation = observePathUsing(
        dependencies,
        operation.staleDirectory,
      );
      const run = runObservation.identity;
      const stale = staleObservation.identity;
      if (
        engine !== "ready" ||
        processes !== "verified" ||
        runObservation.state !== "present" ||
        !run ||
        !sameIdentity(
          run,
          historicalNoStale
            ? operation.runIdentity
            : (ledger.liveRunIdentity ?? operation.runIdentity),
        ) ||
        (historicalNoStale
          ? staleObservation.state !== "confirmed_absent"
          : staleObservation.state !== "present" ||
            !stale ||
            !sameIdentity(stale, operation.runIdentity)) ||
        !(await verifyEffectBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
        ))
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

    if (
      existing?.stage === "prepared" &&
      operation.stage === "prepared" &&
      !ledger.processEffects.some((entry) =>
        ["official_shutdown", "native_termination", "wsl_termination"].includes(
          entry.action,
        ),
      )
    ) {
      const currentEngine = dependencies.observeEngine(boundary);
      ledger.engineReady =
        currentEngine === "ready"
          ? true
          : currentEngine === "known_unavailable"
            ? false
            : null;
      const runObservation = observePathUsing(
        dependencies,
        boundary.runDirectory,
      );
      const staleObservation = observePathUsing(
        dependencies,
        operation.staleDirectory,
      );
      const run = runObservation.identity;
      const stale = staleObservation.identity;
      const currentProcesses = await inspectProcessesWithinCancellation(
        session,
        cancellation,
      );
      if (
        currentEngine === "ready" &&
        currentProcesses === "verified" &&
        run &&
        sameIdentity(run, operation.runIdentity) &&
        staleObservation.state === "confirmed_absent"
      ) {
        // A previous process may have stopped Docker after recording only the
        // prepared stage. Reconciliation proves the current safe state, not
        // that no prior Process Effect occurred.
        mergeProcessEffect(ledger, "historical_process_reconciliation", {
          issued: null,
          confirmation: "unknown",
        });
        ledger.hostSafety = "safe";
        ledger.staleState = "absent";
        ledger.liveRunIdentity = operation.runIdentity;
        ledger.disposition = "historical_effect_unknown_pending_human_decision";
        const closed = await persistAfterLiveBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
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
      if (
        currentEngine === "known_unavailable" &&
        currentProcesses === "absent" &&
        runObservation.state === "confirmed_absent" &&
        stale &&
        sameIdentity(stale, operation.runIdentity)
      ) {
        mergeFilesystemEffect(ledger, "observed_runtime_directory_rename", {
          issued: true,
          confirmation: "confirmed",
        });
        ledger.staleState = "retained";
        const renamed = await persistAfterLiveBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
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
        currentProcesses !== "absent" ||
        !run ||
        !sameIdentity(run, operation.runIdentity) ||
        staleObservation.state !== "confirmed_absent"
      ) {
        markUnknown(ledger);
        ledger.staleState = stale ? "unknown" : ledger.staleState;
        reason = "docker_desktop_repair_resume_state_unknown";
        return { status, reason, ledger, operation };
      }
    }

    if (operation.stage === "prepared") {
      const settledShutdown = ledger.processEffects.find(
        (entry) => entry.action === "official_shutdown",
      );
      const settledTermination = ledger.processEffects.find(
        (entry) => entry.action === "native_termination",
      );
      const settledWsl = ledger.processEffects.find(
        (entry) => entry.action === "wsl_termination",
      );
      if (
        [settledShutdown, settledTermination, settledWsl].some(
          (entry) =>
            entry &&
            (entry.phase !== "settled" || entry.confirmation === "unknown"),
        ) ||
        (settledTermination && !settledShutdown) ||
        (settledWsl && !settledShutdown)
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_settled_prefix_invalid";
        return { status, reason, ledger, operation };
      }
      if (cancellation.shouldStop()) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_cancelled";
        return { status, reason, ledger, operation };
      }
      if (
        !cancellation.effectAllowed() ||
        !(await verifyEffectBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
        ))
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_authority_changed";
        return { status, reason, ledger, operation };
      }
      if (!settledShutdown) {
        const shutdownIntent = await persistHostEffectIntent(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "process",
          "official_shutdown",
          ledger,
        );
        if (
          !shutdownIntent ||
          !(await verifyEffectBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
          ))
        ) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_authority_changed_after_intent";
          return {
            status,
            reason,
            ledger,
            operation: shutdownIntent ?? operation,
          };
        }
        operation = shutdownIntent;
        const shutdown = dependencies.officialShutdown(boundary, operation);
        const shutdownSettlement = await persistHostEffectSettlement(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "process",
          "official_shutdown",
          shutdown,
          ledger,
        );
        if (!shutdownSettlement) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_effect_settlement_unknown";
          return { status, reason, ledger, operation };
        }
        operation = shutdownSettlement;
      }
      if (!cancellation.helperAvailable()) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_native_helper_lost";
        return { status, reason, ledger, operation };
      }
      const processes = await inspectProcessesWithinCancellation(
        session,
        cancellation,
      );
      if (processes === "unknown") {
        markUnknown(ledger);
        reason = "docker_desktop_process_inventory_unknown";
        return { status, reason, ledger, operation };
      }
      if (processes === "verified") {
        if (settledTermination) {
          markUnknown(ledger);
          reason = "docker_desktop_processes_reappeared_after_settlement";
          return { status, reason, ledger, operation };
        }
        if (
          !(await verifyEffectBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
          ))
        ) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_authority_changed";
          return { status, reason, ledger, operation };
        }
        const terminationIntent = await persistHostEffectIntent(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "process",
          "native_termination",
          ledger,
        );
        if (
          !terminationIntent ||
          !(await verifyEffectBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
          ))
        ) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_authority_changed_after_intent";
          return {
            status,
            reason,
            ledger,
            operation: terminationIntent ?? operation,
          };
        }
        operation = terminationIntent;
        const termination = await session.terminateProcesses();
        const terminationEffect: TaggedEffect =
          termination === "terminated"
            ? { issued: true, confirmation: "confirmed" }
            : termination === "absent"
              ? { issued: false, confirmation: "not_issued" }
              : termination === "not_issued_unknown"
                ? { issued: false, confirmation: "not_issued" }
                : {
                    issued: termination === "partial_or_unknown" ? true : null,
                    confirmation: "unknown",
                  };
        const terminationSettled = await persistHostEffectSettlement(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "process",
          "native_termination",
          terminationEffect,
          ledger,
        );
        if (!terminationSettled) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_effect_settlement_unknown";
          return { status, reason, ledger, operation };
        }
        operation = terminationSettled;
        if (termination === "not_issued_unknown") {
          mergeProcessEffect(ledger, "process_quiescence_reconciliation", {
            issued: null,
            confirmation: "unknown",
          });
          const observed = await persistAfterLiveBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
            operation,
            "prepared",
            ledger,
          );
          operation = observed ?? operation;
          markUnknown(ledger);
          reason = "docker_desktop_process_state_unknown_without_effect";
          return { status, reason, ledger, operation };
        }
        if (termination !== "terminated" && termination !== "absent") {
          markUnknown(ledger);
          reason = "docker_desktop_process_termination_unknown";
          if (
            cancellation.helperAvailable() &&
            (await verifyEffectBoundary(
              dependencies,
              boundary,
              session,
              cancellation,
            ))
          ) {
            operation =
              (await persistAfterLiveBoundary(
                dependencies,
                boundary,
                session,
                cancellation,
                operation,
                "prepared",
                ledger,
              )) ?? operation;
          }
          return { status, reason, ledger, operation };
        }
      }
      if (cancellation.shouldStop()) {
        const cleanupObservation = cancellation.helperAvailable()
          ? await inspectProcessesWithinCancellation(session, cancellation)
          : "unknown";
        if (cleanupObservation !== "absent") markUnknown(ledger);
        if (
          cancellation.helperAvailable() &&
          (await verifyEffectBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
          ))
        ) {
          operation =
            (await persistAfterLiveBoundary(
              dependencies,
              boundary,
              session,
              cancellation,
              operation,
              "prepared",
              ledger,
            )) ?? operation;
        }
        reason = "docker_desktop_repair_cancelled_after_process_effect";
        return { status, reason, ledger, operation };
      }
      let observedWsl = settledWsl;
      if (!observedWsl) {
        if (
          !cancellation.effectAllowed() ||
          !(await verifyEffectBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
          ))
        ) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_authority_changed";
          return { status, reason, ledger, operation };
        }
        const wslIntent = await persistHostEffectIntent(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "process",
          "wsl_termination",
          ledger,
        );
        if (
          !wslIntent ||
          !(await verifyEffectBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
          ))
        ) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_authority_changed_after_intent";
          return { status, reason, ledger, operation: wslIntent ?? operation };
        }
        operation = wslIntent;
        const wsl = dependencies.terminateDockerWsl();
        const wslSettlement = await persistHostEffectSettlement(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "process",
          "wsl_termination",
          wsl,
          ledger,
        );
        if (!wslSettlement) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_effect_settlement_unknown";
          return { status, reason, ledger, operation };
        }
        operation = wslSettlement;
        observedWsl = ledger.processEffects.find(
          (entry) => entry.action === "wsl_termination",
        );
      }
      if (
        observedWsl?.confirmation !== "confirmed" ||
        !cancellation.helperAvailable()
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_wsl_termination_unconfirmed";
        return { status, reason, ledger, operation };
      }
      if (
        (await inspectProcessesWithinCancellation(session, cancellation)) !==
        "absent"
      ) {
        mergeProcessEffect(ledger, "process_quiescence_reconciliation", {
          issued: null,
          confirmation: "unknown",
        });
        markUnknown(ledger);
        reason = "docker_desktop_process_quiescence_unconfirmed";
        return { status, reason, ledger, operation };
      }
      if (
        (await observeHelperWithinCancellation(
          () => session.verifyArtifacts(),
          cancellation,
          session,
        )) !== "verified"
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_package_identity_changed";
        return { status, reason, ledger, operation };
      }
      if (
        !(await verifyEffectBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
        ))
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_authority_changed";
        return { status, reason, ledger, operation };
      }
      const stopped = await persistAfterLiveBoundary(
        dependencies,
        boundary,
        session,
        cancellation,
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

    if (
      existing?.stage === "processes_stopped" &&
      operation.stage === "processes_stopped"
    ) {
      const resumedEngine = dependencies.observeEngine(boundary);
      const resumedProcesses = await inspectProcessesWithinCancellation(
        session,
        cancellation,
      );
      const resumedRunObservation = observePathUsing(
        dependencies,
        boundary.runDirectory,
      );
      const resumedStaleObservation = observePathUsing(
        dependencies,
        operation.staleDirectory,
      );
      const resumedRun = resumedRunObservation.identity;
      const resumedStale = resumedStaleObservation.identity;
      if (
        resumedEngine === "ready" &&
        resumedProcesses === "verified" &&
        resumedRun &&
        sameIdentity(resumedRun, operation.runIdentity) &&
        resumedStaleObservation.state === "confirmed_absent"
      ) {
        ledger.engineReady = true;
        mergeProcessEffect(ledger, "historical_process_reconciliation", {
          issued: null,
          confirmation: "unknown",
        });
        ledger.staleState = "absent";
        ledger.hostSafety = "safe";
        ledger.liveRunIdentity = operation.runIdentity;
        ledger.disposition = "historical_effect_unknown_pending_human_decision";
        const pending = await persistAfterLiveBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
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
        resumedEngine === "known_unavailable" &&
        resumedRunObservation.state === "confirmed_absent" &&
        resumedStale &&
        sameIdentity(resumedStale, operation.runIdentity) &&
        resumedProcesses === "absent"
      ) {
        ledger.engineReady = false;
        const settledRename = ledger.filesystemEffects.find(
          (entry) => entry.action === "runtime_directory_rename",
        );
        if (
          settledRename &&
          (settledRename.phase !== "settled" ||
            settledRename.confirmation !== "confirmed")
        ) {
          markUnknown(ledger);
          reason = "docker_desktop_runtime_rename_history_unknown";
          return { status, reason, ledger, operation };
        }
        if (!settledRename)
          mergeFilesystemEffect(ledger, "observed_runtime_directory_rename", {
            issued: true,
            confirmation: "confirmed",
          });
        ledger.staleState = "retained";
        const renamed = await persistAfterLiveBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
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
        resumedStaleObservation.state !== "confirmed_absent"
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
        !(await verifyEffectBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
        ))
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_authority_changed";
        return { status, reason, ledger, operation };
      }
      const renameIntent = await persistHostEffectIntent(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
        "filesystem",
        "runtime_directory_rename",
        ledger,
      );
      if (
        !renameIntent ||
        !(await verifyEffectBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
        ))
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_authority_changed_after_intent";
        return { status, reason, ledger, operation: renameIntent ?? operation };
      }
      operation = renameIntent;
      const rename = dependencies.renameRunDirectory(boundary, operation);
      const renameSettled = await persistHostEffectSettlement(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
        "filesystem",
        "runtime_directory_rename",
        rename,
        ledger,
      );
      if (!renameSettled) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_effect_settlement_unknown";
        return { status, reason, ledger, operation };
      }
      operation = renameSettled;
      ledger.staleState = rename.staleState;
      const renamedRunObservation = observePathUsing(
        dependencies,
        boundary.runDirectory,
      );
      const renamedStaleObservation = observePathUsing(
        dependencies,
        operation.staleDirectory,
      );
      if (
        rename.confirmation !== "confirmed" ||
        renamedRunObservation.state !== "confirmed_absent" ||
        renamedStaleObservation.state !== "present" ||
        !renamedStaleObservation.identity ||
        !sameIdentity(
          renamedStaleObservation.identity,
          operation.runIdentity,
        ) ||
        !cancellation.helperAvailable()
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_runtime_rename_unconfirmed";
        return { status, reason, ledger, operation };
      }
      if (
        !(await verifyEffectBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
        ))
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_authority_changed";
        return { status, reason, ledger, operation };
      }
      const renamed = await persistAfterLiveBoundary(
        dependencies,
        boundary,
        session,
        cancellation,
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
      const staleObservation = observePathUsing(
        dependencies,
        operation.staleDirectory,
      );
      const stale = staleObservation.identity;
      if (
        staleObservation.state !== "present" ||
        !stale ||
        !sameIdentity(stale, operation.runIdentity)
      ) {
        ledger.staleState = "unknown";
        markUnknown(ledger);
        reason = "docker_desktop_stale_runtime_identity_unknown";
        return { status, reason, ledger, operation };
      }
      if (
        (await observeHelperWithinCancellation(
          () => session.verifyArtifacts(),
          cancellation,
          session,
        )) !== "verified"
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_package_identity_changed";
        return { status, reason, ledger, operation };
      }
      let engine = dependencies.observeEngine(boundary);
      const liveRunObservation = observePathUsing(
        dependencies,
        boundary.runDirectory,
      );
      const liveRun = liveRunObservation.identity;
      const liveProcesses = await inspectProcessesWithinCancellation(
        session,
        cancellation,
      );
      const alreadyRecovered =
        engine === "ready" &&
        liveRunObservation.state === "present" &&
        liveRun !== null &&
        liveProcesses === "verified";
      const settledLaunch = ledger.processEffects.find(
        (entry) => entry.action === "desktop_launch",
      );
      if (
        settledLaunch &&
        (settledLaunch.phase !== "settled" ||
          settledLaunch.issued !== true ||
          settledLaunch.confirmation !== "confirmed")
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_launch_history_unknown";
        return { status, reason, ledger, operation };
      }
      if (
        !alreadyRecovered &&
        !settledLaunch &&
        (engine !== "known_unavailable" ||
          liveRunObservation.state !== "confirmed_absent" ||
          liveProcesses !== "absent")
      ) {
        if (engine === "unknown" || liveProcesses === "unknown")
          markUnknown(ledger);
        reason = "docker_desktop_renamed_resume_state_unknown";
        return { status, reason, ledger, operation };
      }
      if (cancellation.shouldStop() && !alreadyRecovered && !settledLaunch) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_cancelled";
        return { status, reason, ledger, operation };
      }
      if (!alreadyRecovered && !settledLaunch) {
        if (
          !cancellation.effectAllowed() ||
          !(await verifyEffectBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
          ))
        ) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_authority_changed";
          return { status, reason, ledger, operation };
        }
        const launchIntent = await persistHostEffectIntent(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "process",
          "desktop_launch",
          ledger,
        );
        if (
          !launchIntent ||
          !(await verifyEffectBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
          ))
        ) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_authority_changed_after_intent";
          return {
            status,
            reason,
            ledger,
            operation: launchIntent ?? operation,
          };
        }
        operation = launchIntent;
        const started = await session.launchDesktop();
        const launchEffect: TaggedEffect = Object.freeze({
          issued:
            started === "not_started"
              ? false
              : started === "started" || started === "partial_or_unknown"
                ? true
                : null,
          confirmation:
            started === "not_started"
              ? "not_issued"
              : started === "started"
                ? "confirmed"
                : "unknown",
        });
        const launchSettled = await persistHostEffectSettlement(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "process",
          "desktop_launch",
          launchEffect,
          ledger,
        );
        if (!launchSettled) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_effect_settlement_unknown";
          return { status, reason, ledger, operation };
        }
        operation = launchSettled;
        if (started !== "started" || !cancellation.helperAvailable()) {
          markUnknown(ledger);
          reason = "docker_desktop_restart_unconfirmed";
          return { status, reason, ledger, operation };
        }
        engine = await dependencies.awaitEngine(
          boundary,
          cancellation.shouldStop,
          cancellation.stopDetected,
        );
      } else if (!alreadyRecovered && settledLaunch) {
        engine = await dependencies.awaitEngine(
          boundary,
          cancellation.shouldStop,
          cancellation.stopDetected,
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
        (await observeHelperWithinCancellation(
          () => session.verifyArtifacts(),
          cancellation,
          session,
        )) !== "verified" ||
        (await inspectProcessesWithinCancellation(session, cancellation)) !==
          "verified"
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_started_package_identity_unknown";
        return { status, reason, ledger, operation };
      }
      ledger.hostSafety = "safe";
      ledger.evidenceState = "preserved";
      ledger.disposition = "pending_human_decision";
      const recoveredRunObservation = observePathUsing(
        dependencies,
        boundary.runDirectory,
      );
      const recoveredRun = recoveredRunObservation.identity;
      if (recoveredRunObservation.state !== "present" || !recoveredRun) {
        markUnknown(ledger);
        reason = "docker_desktop_recovered_run_identity_unknown";
        return { status, reason, ledger, operation };
      }
      ledger.liveRunIdentity = recoveredRun;
      if (
        !(await verifyEffectBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
        ))
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_authority_changed";
        return { status, reason, ledger, operation };
      }
      const pending = await persistAfterLiveBoundary(
        dependencies,
        boundary,
        session,
        cancellation,
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
    if (durableEffectBoundaryEntered) markUnknown(ledger);
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
      helperCleanupConfirmed = helper.status !== "cleanup_unknown";
      if (helper.status === "cleanup_unknown") markUnknown(ledger);
      return report(
        status,
        helper.status === "unavailable"
          ? "docker_desktop_repair_lock_unavailable"
          : helper.status === "protocol_failed"
            ? "docker_desktop_repair_helper_protocol_failed"
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
    } else if (
      inventory.unfinished === null &&
      inventory.inventory.operations.length >= 64
    ) {
      reason = "docker_desktop_repair_operation_capacity_unavailable";
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
    reason = "docker_desktop_repair_failed_closed";
  } finally {
    if (session) {
      try {
        const released = await session.release();
        helperCleanupConfirmed = released.cleanup === "confirmed";
        if (released.cleanup === "unknown" || released.protocol === "failed") {
          status = "blocked";
          if (released.cleanup === "unknown") {
            markUnknown(ledger);
            reason = "docker_desktop_repair_lock_cleanup_unknown";
          } else {
            reason = "docker_desktop_repair_helper_protocol_failed";
          }
        }
      } catch {
        helperCleanupConfirmed = false;
        markUnknown(ledger);
        status = "blocked";
        reason = "docker_desktop_repair_lock_cleanup_unknown";
      }
    }
  }
  const finalBoundaryConfirmed =
    boundary !== null &&
    (() => {
      const current = dependencies.prepareBoundary();
      return current !== null && samePreparedAuthority(boundary, current);
    })();
  if (status === "recovered_pending_close" && !finalBoundaryConfirmed) {
    markUnknown(ledger);
    status = "blocked";
    reason = "docker_desktop_repair_terminal_boundary_changed";
  }
  const terminal = (
    [
      "closed_retained",
      "closed_historical_effect_unknown_retained",
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
  let boundary: PreparedBoundary | null = null;
  try {
    const expectedId = parseDockerDesktopRepairId(repairId);
    boundary = dependencies.prepareBoundary();
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
      helperCleanupConfirmed = helper.status !== "cleanup_unknown";
      if (helper.status === "cleanup_unknown") markUnknown(ledger);
      return report(
        status,
        helper.status === "unavailable"
          ? "docker_desktop_repair_lock_unavailable"
          : helper.status === "protocol_failed"
            ? "docker_desktop_repair_helper_protocol_failed"
            : "docker_desktop_repair_lock_cleanup_unknown",
        ledger,
        null,
        helperCleanupConfirmed,
      );
    }
    const activeSession = helper.session;
    session = activeSession;
    cancellation = attachCancellation(
      activeSession,
      dependencies.registerCancellation,
    );
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
      restoreLedger(ledger, operation);
      reason = "docker_desktop_repair_another_operation_unfinished";
    } else if (
      operation.stage === "closed_retained" ||
      operation.stage === "closed_historical_effect_unknown_retained"
    ) {
      restoreLedger(ledger, operation);
      const engine = dependencies.observeEngine(boundary);
      const processes = await inspectProcessesWithinCancellation(
        session,
        cancellation,
      );
      const runObservation = observePathUsing(
        dependencies,
        boundary.runDirectory,
      );
      const staleObservation = observePathUsing(
        dependencies,
        operation.staleDirectory,
      );
      const run = runObservation.identity;
      const stale = staleObservation.identity;
      const historicalNoStale =
        operation.stage === "closed_historical_effect_unknown_retained";
      if (
        engine !== "ready" ||
        processes !== "verified" ||
        runObservation.state !== "present" ||
        !run ||
        !sameIdentity(
          run,
          historicalNoStale
            ? operation.runIdentity
            : (ledger.liveRunIdentity ?? operation.runIdentity),
        ) ||
        (historicalNoStale
          ? staleObservation.state !== "confirmed_absent"
          : staleObservation.state !== "present" ||
            !stale ||
            !sameIdentity(stale, operation.runIdentity)) ||
        !(await verifyEffectBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
        ))
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
      restoreLedger(ledger, operation);
      reason = "docker_desktop_repair_close_state_invalid";
    } else {
      restoreLedger(ledger, operation);
      const historicalNoStale =
        operation.stage === "no_stale_historical_effect_unknown_pending";
      const staleObservation = observePathUsing(
        dependencies,
        operation.staleDirectory,
      );
      const stale = staleObservation.identity;
      const engine = dependencies.observeEngine(boundary);
      const processes = await inspectProcessesWithinCancellation(
        session,
        cancellation,
      );
      const runObservation = observePathUsing(
        dependencies,
        boundary.runDirectory,
      );
      const run = runObservation.identity;
      if (
        (historicalNoStale
          ? staleObservation.state !== "confirmed_absent"
          : staleObservation.state !== "present" ||
            !stale ||
            !sameIdentity(stale, operation.runIdentity)) ||
        engine !== "ready" ||
        processes !== "verified" ||
        (await observeHelperWithinCancellation(
          () => activeSession.verifyArtifacts(),
          cancellation,
          session,
        )) !== "verified" ||
        runObservation.state !== "present" ||
        !run ||
        !sameIdentity(
          run,
          historicalNoStale
            ? operation.runIdentity
            : (ledger.liveRunIdentity ?? operation.runIdentity),
        )
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
        if (!hasDockerDesktopRepairRecordCapacity(operation, 1)) {
          reason = "docker_desktop_repair_record_capacity_unavailable";
        } else if (
          !cancellation.effectAllowed() ||
          !(await verifyEffectBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
          ))
        ) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_authority_changed";
        } else {
          const closed = await persistAfterLiveBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
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
        helperCleanupConfirmed = released.cleanup === "confirmed";
        if (released.cleanup === "unknown" || released.protocol === "failed") {
          status = "blocked";
          if (released.cleanup === "unknown") {
            markUnknown(ledger);
            reason = "docker_desktop_repair_lock_cleanup_unknown";
          } else {
            reason = "docker_desktop_repair_helper_protocol_failed";
          }
        }
      } catch {
        helperCleanupConfirmed = false;
        markUnknown(ledger);
        status = "blocked";
        reason = "docker_desktop_repair_lock_cleanup_unknown";
      }
    }
  }
  const terminalBoundaryConfirmed =
    boundary !== null &&
    (() => {
      const current = dependencies.prepareBoundary();
      return current !== null && samePreparedAuthority(boundary, current);
    })();
  if (
    ["closed_retained", "closed_historical_effect_unknown_retained"].includes(
      status,
    ) &&
    !terminalBoundaryConfirmed
  ) {
    markUnknown(ledger);
    status = "blocked";
    reason = "docker_desktop_repair_terminal_boundary_changed";
  }
  const terminal = (
    [
      "closed_retained",
      "closed_historical_effect_unknown_retained",
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
  observePath,
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
    hostEffectLifecycle:
      "fresh_boundary_durable_intent_fresh_boundary_exact_once_effect_settlement",
    unsettledIntentReissued: false,
    currentStateUsedAsHistoricalIssuanceProof: false,
    staleDirectoryDeletion: false,
    providerEffectIssued: false,
  });
}
