import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

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
  type DockerDesktopRepairPolicy,
  observeRuntimeOwnedDockerDesktopRepairPolicy,
} from "./docker-desktop-repair-policy.ts";
import {
  classifyDockerDesktopRepairResume,
  createDockerDesktopRepairOperation,
  type DockerDesktopRepairDirectoryIdentity,
  type DockerDesktopRepairEffectAction,
  type DockerDesktopRepairEffectConfirmation,
  type DockerDesktopRepairEffectEntry,
  type DockerDesktopRepairEvidenceState,
  type DockerDesktopRepairHostSafety,
  type DockerDesktopRepairLedgerSnapshot,
  type DockerDesktopRepairOperation,
  type DockerDesktopRepairRecordBoundary,
  type DockerDesktopRepairStaleState,
  hasDockerDesktopRepairRecordCapacity,
  inspectDockerDesktopRepairHistoricalOperation,
  inventoryDockerDesktopRepairOperations,
  isCanonicalDockerDesktopRepairHistoricalOperationCore,
  parseDockerDesktopRepairId,
  persistDockerDesktopRepairHistoricalAdoption,
  persistDockerDesktopRepairHistoricalClosure,
  persistDockerDesktopRepairStage,
  requiredDockerDesktopRepairRecordsThroughSafeStage,
} from "./docker-desktop-repair-record-store.ts";
import {
  loadHistoricalReleaseManifestEnvelopeForVerification,
  loadPlatformProvisionerManifestEnvelopeForVerification,
} from "./platform-provisioner-manifest-loader.ts";
import { verifyBundledCoordinatorPackageFromFixedManifestCandidate } from "./platform-provisioner-package-filesystem.ts";

export const DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT =
  "crdd-coordinator/docker-desktop-runtime-repair";
export const DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION = 5;

const DOCKER_ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";
const DOCKER_ENGINE_PIPE = "\\\\.\\pipe\\dockerDesktopLinuxEngine";
const RUNTIME_STATE_SEGMENTS = Object.freeze([
  "Qual-Lab",
  "CRDD",
  "RuntimeState",
]);
const knownSocketErrorCodes = Object.freeze(
  new Set(["EACCES", "EBUSY", "EPERM"]),
);
const ENGINE_WAIT_ATTEMPTS = 60;
const HOST_EFFECT_ACTION_NAMES = new Set<DockerDesktopRepairEffectAction>([
  "official_shutdown",
  "native_termination",
  "wsl_termination",
  "runtime_directory_rename",
  "desktop_launch",
]);

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
    runtimeExecutionIdentitySha256: string;
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
    | "known_effect_recovery_pending_human_decision"
    | "historical_effect_unknown_pending_human_decision"
    | "retained_by_human_decision"
    | "known_effect_recovery_retained_by_human_decision"
    | "historical_effect_unknown_retained_by_human_decision";
  liveRunIdentity: DockerDesktopRepairDirectoryIdentity | null;
};

export type DockerDesktopRuntimeRepairReport = Readonly<{
  contract: typeof DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT;
  contractRevision: typeof DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION;
  status:
    | "blocked"
    | "recovered_pending_close"
    | "historical_recovered_pending_close"
    | "historical_closed_retained"
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
    | "unknown"
    | "pending_human_decision"
    | "known_effect_recovery_pending_human_decision"
    | "historical_effect_unknown_pending_human_decision"
    | "retained_by_human_decision"
    | "known_effect_recovery_retained_by_human_decision"
    | "historical_effect_unknown_retained_by_human_decision";
  nativeHelperCleanupConfirmed: boolean | null;
  effectStateUnknown: boolean;
  operatorActionRequired: boolean;
  newRepairPermitted: boolean;
  deletionPerformed: false;
  pathReported: false;
  credentialReported: false;
  providerEffectIssued: false;
}>;

export type RepairDependencies = Readonly<{
  history?: Readonly<{
    inspect: typeof inspectDockerDesktopRepairHistoricalOperation;
    persistAdoption: typeof persistDockerDesktopRepairHistoricalAdoption;
    persistClosure: typeof persistDockerDesktopRepairHistoricalClosure;
    loadOriginManifest: (root: string) => unknown;
    loadCurrentManifest: () => unknown;
  }>;
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
  isCurrent: boolean | null,
  isObserved: boolean | null,
): boolean | null {
  if (isCurrent === true || isObserved === true) return true;
  if (isCurrent === null || isObserved === null) return null;
  return false;
}

function refreshEffectAggregate(
  ledger: MutableLedger,
  kind: "process" | "filesystem",
) {
  const entries =
    kind === "process" ? ledger.processEffects : ledger.filesystemEffects;
  const isIssued = entries.reduce<boolean | null>(
    (isCurrent, entry) => mergeIssued(isCurrent, entry.issued),
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
    ledger.processEffectIssued = isIssued;
    ledger.processEffectConfirmation = confirmation;
  } else {
    ledger.filesystemEffectIssued = isIssued;
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
    issued: observed.issued,
    confirmation: observed.confirmation,
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
  isNewRepairPermitted = false,
): DockerDesktopRuntimeRepairReport {
  const isEffectStateUnknown =
    ledger.processEffectIssued === null ||
    ledger.processEffectConfirmation === "unknown" ||
    ledger.filesystemEffectIssued === null ||
    ledger.filesystemEffectConfirmation === "unknown" ||
    ledger.staleState === "unknown" ||
    ledger.hostSafety === "unknown" ||
    nativeHelperCleanupConfirmed === null;
  const isHostMutationPossible =
    ledger.processEffectIssued !== false ||
    ledger.filesystemEffectIssued !== false;
  const manualRecoveryRequired =
    ledger.hostSafety !== "safe" ||
    (isHostMutationPossible && status === "blocked") ||
    nativeHelperCleanupConfirmed === false;
  const operatorActionRequired =
    manualRecoveryRequired ||
    [
      "docker_desktop_repair_record_capacity_unavailable",
      "docker_desktop_repair_operation_capacity_unavailable",
    ].includes(reason);
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
    effectStateUnknown: isEffectStateUnknown,
    operatorActionRequired,
    newRepairPermitted: isNewRepairPermitted,
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
    left.runtimeExecutionIdentitySha256 === right.runtimeExecutionIdentitySha256
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
    packageVerification.runtimeExecutionIdentityRuntimeOwned !== true ||
    packageVerification.crddDistributionConfirmed !== true ||
    typeof packageVerification.manifestHash !== "string" ||
    !Number.isSafeInteger(packageVerification.releaseSequence) ||
    typeof packageVerification.runtimeExecutionIdentitySha256 !== "string" ||
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
    runtimeExecutionIdentitySha256:
      packageVerification.runtimeExecutionIdentitySha256,
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
  return observeDockerDesktopEngineResult(
    result,
    boundary.policy.engineVersion,
    () => {
      const handle = fs.openSync(DOCKER_ENGINE_PIPE, "r+");
      fs.closeSync(handle);
    },
  );
}

export function observeDockerDesktopEngineResult(
  result: Readonly<{
    pid: number | undefined;
    error?: Error | undefined;
    signal: NodeJS.Signals | null;
    status: number | null;
    stdout: unknown;
    stderr: unknown;
  }>,
  expectedEngineVersion: string,
  probeEnginePipe: () => void,
): EngineObservation {
  if (
    !result.error &&
    result.signal === null &&
    result.status === 0 &&
    typeof result.stdout === "string" &&
    typeof result.stderr === "string" &&
    result.stderr.length === 0 &&
    result.stdout.trim() === expectedEngineVersion
  )
    return "ready";
  if (
    result.pid === undefined ||
    result.error ||
    result.signal !== null ||
    result.status === null ||
    result.status === 0 ||
    typeof result.stdout !== "string" ||
    (result.stdout !== "" && result.stdout !== "\n" && result.stdout !== "\r\n")
  )
    return "unknown";
  try {
    probeEnginePipe();
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
    return knownSocketErrorCodes.has(code)
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
  if (!hasDockerDesktopRepairRecordCapacity(operation, 1))
    return Object.freeze({
      status: "capacity_unavailable" as const,
      operation: null,
    });
  const candidateLedger: MutableLedger = {
    ...ledger,
    processEffects: [...ledger.processEffects],
    filesystemEffects: [...ledger.filesystemEffects],
  };
  mergeFilesystemEffect(
    candidateLedger,
    "record_write",
    Object.freeze({ issued: true, confirmation: "unknown" }),
  );
  const candidateSnapshot = snapshotLedger(candidateLedger);
  let updated = dependencies.persistStage(
    boundary,
    operation,
    stage,
    candidateSnapshot,
  );
  if (!updated) {
    const fresh = dependencies.inventory(boundary);
    updated =
      fresh.status === "verified"
        ? (fresh.operations.find(
            (candidate) =>
              candidate.operationId === operation.operationId &&
              candidate.sequence === operation.sequence + 1 &&
              candidate.stage === stage &&
              sameIdentity(candidate.runIdentity, operation.runIdentity) &&
              JSON.stringify(candidate.ledger) ===
                JSON.stringify(candidateSnapshot),
          ) ?? null)
        : null;
    if (!updated)
      return Object.freeze({
        status: "durability_unknown" as const,
        operation: null,
      });
  }
  restoreLedger(ledger, updated);
  const recordWrite = ledger.filesystemEffects.at(-1);
  if (recordWrite?.action !== "record_write") {
    markUnknown(ledger);
    return Object.freeze({
      status: "durability_unknown" as const,
      operation: null,
    });
  }
  return Object.freeze({ status: "persisted" as const, operation: updated });
}

function inventoryState(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
) {
  const inventory = dependencies.inventory(boundary);
  if (inventory.status !== "verified") return null;
  const unfinishedItems = inventory.operations.filter((operation) =>
    operation.history
      ? !operation.history.closed
      : operation.stage !== "closed_retained" &&
        operation.stage !== "closed_no_stale_known_effect_retained" &&
        operation.stage !== "closed_historical_effect_unknown_retained",
  );
  if (unfinishedItems.length > 1) return null;
  for (const operation of inventory.operations) {
    if (operation.history?.closed) {
      const stale = observePathUsing(dependencies, operation.staleDirectory);
      if (
        operation.history.staleState === "retained"
          ? stale.state !== "present" ||
            !stale.identity ||
            !sameIdentity(stale.identity, operation.runIdentity)
          : operation.history.staleState !== "absent" ||
            stale.state !== "confirmed_absent"
      )
        return null;
      continue;
    }
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
      (operation.stage === "no_stale_known_effect_recovery_pending" ||
        operation.stage === "closed_no_stale_known_effect_retained" ||
        operation.stage === "no_stale_historical_effect_unknown_pending" ||
        operation.stage === "closed_historical_effect_unknown_retained") &&
      observePathUsing(dependencies, operation.staleDirectory).state !==
        "confirmed_absent"
    )
      return null;
  }
  return Object.freeze({ inventory, unfinished: unfinishedItems[0] ?? null });
}

function durableInventoryState(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
) {
  const inventory = dependencies.inventory(boundary);
  if (inventory.status !== "verified") return null;
  const unfinishedItems = inventory.operations.filter((operation) =>
    operation.history
      ? !operation.history.closed
      : classifyDockerDesktopRepairResume(operation).state !== "terminal",
  );
  return unfinishedItems.length > 1
    ? null
    : Object.freeze({ inventory, unfinished: unfinishedItems[0] ?? null });
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
  let wasCancelled = false;
  let helperFailed = false;
  let resolveStop!: () => void;
  const stopDetected = new Promise<void>((resolve) => {
    resolveStop = resolve;
  });
  const cancel = () => {
    wasCancelled = true;
    resolveStop();
  };
  const helperFailure = () => {
    helperFailed = true;
    resolveStop();
  };
  const removeFailure = session.onFailureDetected(helperFailure);
  const removeCancellation = registerCancellation(cancel);
  return Object.freeze({
    shouldStop: () => wasCancelled || helperFailed || !session.assertLive(),
    effectAllowed: () => !wasCancelled && !helperFailed && session.assertLive(),
    helperAvailable: () => !helperFailed && session.assertLive(),
    stopDetected,
    dispose: () => {
      removeFailure();
      removeCancellation();
    },
  });
}

type EffectBoundaryVerification =
  | "verified"
  | "cancelled"
  | "helper_lost"
  | "artifact_unknown"
  | "authority_changed";

function effectBoundaryFailureReason(
  state: Exclude<EffectBoundaryVerification, "verified">,
  isAfterIntent = false,
) {
  if (state === "cancelled")
    return isAfterIntent
      ? "docker_desktop_repair_cancelled_after_intent"
      : "docker_desktop_repair_cancelled";
  if (state === "helper_lost")
    return "docker_desktop_repair_native_helper_lost";
  if (state === "artifact_unknown")
    return "docker_desktop_repair_helper_artifact_unknown";
  return isAfterIntent
    ? "docker_desktop_repair_authority_changed_after_intent"
    : "docker_desktop_repair_authority_changed";
}

function persistFailureReason(status: string, isAfterIntent = false) {
  if (status === "capacity_unavailable")
    return "docker_desktop_repair_record_capacity_unavailable";
  if (status === "durability_unknown")
    return "docker_desktop_repair_record_durability_unknown";
  if (
    status === "cancelled" ||
    status === "helper_lost" ||
    status === "artifact_unknown" ||
    status === "authority_changed"
  )
    return effectBoundaryFailureReason(
      status as Exclude<EffectBoundaryVerification, "verified">,
      isAfterIntent,
    );
  if (status === "boundary_unavailable")
    return "docker_desktop_repair_boundary_unavailable";
  return "docker_desktop_repair_record_update_failed";
}

class DockerDesktopRepairPersistenceError extends Error {
  readonly repairReason: string;

  constructor(repairReason: string) {
    super(repairReason);
    this.name = "DockerDesktopRepairPersistenceError";
    this.repairReason = repairReason;
  }
}

function throwPersistenceFailure(status: string): never {
  throw new DockerDesktopRepairPersistenceError(persistFailureReason(status));
}

async function verifyEffectBoundaryState(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  cancellation: ReturnType<typeof attachCancellation>,
): Promise<EffectBoundaryVerification> {
  if (!cancellation.effectAllowed())
    return cancellation.helperAvailable() ? "cancelled" : "helper_lost";
  const artifacts = await observeHelperWithinCancellation(
    () => session.verifyArtifacts(),
    cancellation,
    session,
  );
  if (artifacts !== "verified") {
    if (!cancellation.effectAllowed())
      return cancellation.helperAvailable() ? "cancelled" : "helper_lost";
    return "artifact_unknown";
  }
  const current = dependencies.prepareBoundary();
  if (!cancellation.effectAllowed())
    return cancellation.helperAvailable() ? "cancelled" : "helper_lost";
  return current !== null && samePreparedAuthority(boundary, current)
    ? "verified"
    : "authority_changed";
}

async function verifyEffectBoundary(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  cancellation: ReturnType<typeof attachCancellation>,
) {
  return (
    (await verifyEffectBoundaryState(
      dependencies,
      boundary,
      session,
      cancellation,
    )) === "verified"
  );
}

async function verifyCleanupRecordBoundaryState(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
): Promise<EffectBoundaryVerification> {
  if (!session.assertLive()) return "helper_lost";
  const artifacts = await session.verifyArtifacts();
  if (!session.assertLive()) return "helper_lost";
  if (artifacts !== "verified") return "artifact_unknown";
  const current = dependencies.prepareBoundary();
  if (!session.assertLive()) return "helper_lost";
  return current !== null && samePreparedAuthority(boundary, current)
    ? "verified"
    : "authority_changed";
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

type FreshRuntimeState = Readonly<{
  boundaryState: EffectBoundaryVerification;
  processes: "verified" | "absent" | "unknown";
  engine: EngineObservation;
  run: PathObservation;
  stale: PathObservation;
}>;

async function observeFreshRuntimeState(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  cancellation: ReturnType<typeof attachCancellation>,
  operation: DockerDesktopRepairOperation,
): Promise<FreshRuntimeState> {
  const unavailable = (boundaryState: EffectBoundaryVerification) =>
    Object.freeze({
      boundaryState,
      processes: "unknown" as const,
      engine: "unknown" as const,
      run: Object.freeze({ state: "unknown" as const, identity: null }),
      stale: Object.freeze({ state: "unknown" as const, identity: null }),
    });
  if (!cancellation.effectAllowed())
    return unavailable(
      cancellation.helperAvailable() ? "cancelled" : "helper_lost",
    );
  const artifacts = await observeHelperWithinCancellation(
    () => session.verifyArtifacts(),
    cancellation,
    session,
  );
  if (artifacts !== "verified")
    return unavailable(
      cancellation.effectAllowed()
        ? "artifact_unknown"
        : cancellation.helperAvailable()
          ? "cancelled"
          : "helper_lost",
    );
  const processes = await inspectProcessesWithinCancellation(
    session,
    cancellation,
  );
  if (!cancellation.effectAllowed())
    return unavailable(
      cancellation.helperAvailable() ? "cancelled" : "helper_lost",
    );
  let current: PreparedBoundary | null = null;
  try {
    current = dependencies.prepareBoundary();
  } catch {
    current = null;
  }
  if (!current || !samePreparedAuthority(boundary, current))
    return unavailable("authority_changed");
  const engine = dependencies.observeEngine(boundary);
  const repairRun = observePathUsing(dependencies, boundary.runDirectory);
  const stale = observePathUsing(dependencies, operation.staleDirectory);
  if (!cancellation.effectAllowed())
    return unavailable(
      cancellation.helperAvailable() ? "cancelled" : "helper_lost",
    );
  return Object.freeze({
    boundaryState: "verified" as const,
    processes: processes ?? "unknown",
    engine,
    run: repairRun,
    stale,
  });
}

function freshReadyStateMatches(
  state: FreshRuntimeState,
  expectedRunIdentity: DockerDesktopRepairDirectoryIdentity,
  staleIdentity: DockerDesktopRepairDirectoryIdentity | null,
) {
  return (
    state.boundaryState === "verified" &&
    state.engine === "ready" &&
    state.processes === "verified" &&
    state.run.state === "present" &&
    state.run.identity !== null &&
    sameIdentity(state.run.identity, expectedRunIdentity) &&
    (staleIdentity === null
      ? state.stale.state === "confirmed_absent"
      : state.stale.state === "present" &&
        state.stale.identity !== null &&
        sameIdentity(state.stale.identity, staleIdentity))
  );
}

function freshStoppedStateMatches(
  state: FreshRuntimeState,
  operation: DockerDesktopRepairOperation,
) {
  return (
    state.boundaryState === "verified" &&
    state.engine === "known_unavailable" &&
    state.processes === "absent" &&
    state.run.state === "confirmed_absent" &&
    state.stale.state === "present" &&
    state.stale.identity !== null &&
    sameIdentity(state.stale.identity, operation.runIdentity)
  );
}

function freshQuiescentRunStateMatches(
  state: FreshRuntimeState,
  operation: DockerDesktopRepairOperation,
) {
  return (
    state.boundaryState === "verified" &&
    state.engine === "known_unavailable" &&
    state.processes === "absent" &&
    state.run.state === "present" &&
    state.run.identity !== null &&
    sameIdentity(state.run.identity, operation.runIdentity) &&
    state.stale.state === "confirmed_absent"
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
  validateFresh?: (state: FreshRuntimeState) => boolean,
) {
  const fresh = validateFresh
    ? await observeFreshRuntimeState(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
      )
    : null;
  const boundaryState = fresh
    ? fresh.boundaryState
    : await verifyEffectBoundaryState(
        dependencies,
        boundary,
        session,
        cancellation,
      );
  if (boundaryState !== "verified")
    throw new DockerDesktopRepairPersistenceError(
      effectBoundaryFailureReason(boundaryState),
    );
  if (fresh && validateFresh && !validateFresh(fresh))
    throw new DockerDesktopRepairPersistenceError(
      "docker_desktop_repair_current_state_changed_before_record",
    );
  const persisted = persist(dependencies, boundary, operation, stage, ledger);
  if (persisted.status !== "persisted")
    throwPersistenceFailure(persisted.status);
  return persisted.operation;
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
  if (!HOST_EFFECT_ACTION_NAMES.has(action))
    return Object.freeze({ status: "invalid" as const, operation: null });
  if (
    !hasDockerDesktopRepairRecordCapacity(
      operation,
      requiredDockerDesktopRepairRecordsThroughSafeStage(
        action as Parameters<
          typeof requiredDockerDesktopRepairRecordsThroughSafeStage
        >[0],
      ),
    )
  )
    return Object.freeze({
      status: "capacity_unavailable" as const,
      operation: null,
    });
  if (!recordHostEffectIntent(ledger, kind, action))
    return Object.freeze({ status: "invalid" as const, operation: null });
  const boundaryState = await verifyEffectBoundaryState(
    dependencies,
    boundary,
    session,
    cancellation,
  );
  if (boundaryState !== "verified")
    return Object.freeze({
      status: boundaryState,
      operation: null,
    });
  const persisted = persist(
    dependencies,
    boundary,
    operation,
    operation.stage,
    ledger,
  );
  return persisted;
}

function durableResumeAllowsHostAction(
  operation: DockerDesktopRepairOperation,
  action: Extract<
    DockerDesktopRepairEffectAction,
    | "official_shutdown"
    | "native_termination"
    | "wsl_termination"
    | "runtime_directory_rename"
    | "desktop_launch"
  >,
) {
  const classification = classifyDockerDesktopRepairResume(operation);
  return (
    classification.state === "next_host_action" &&
    classification.action === action
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
  if (!settleHostEffect(ledger, kind, action, observed))
    throwPersistenceFailure("invalid");
  const boundaryState = await verifyCleanupRecordBoundaryState(
    dependencies,
    boundary,
    session,
  );
  if (boundaryState !== "verified")
    throw new DockerDesktopRepairPersistenceError(
      effectBoundaryFailureReason(boundaryState),
    );
  const persisted = persist(
    dependencies,
    boundary,
    operation,
    operation.stage,
    ledger,
  );
  if (persisted.status !== "persisted")
    throwPersistenceFailure(persisted.status);
  return persisted.operation;
}

async function persistNativeTerminationObservation(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  operation: DockerDesktopRepairOperation,
  ledger: MutableLedger,
) {
  if (
    !settleHostEffect(
      ledger,
      "process",
      "native_termination",
      Object.freeze({ issued: false, confirmation: "not_issued" }),
    )
  )
    throwPersistenceFailure("invalid");
  mergeProcessEffect(ledger, "process_quiescence_reconciliation", {
    issued: null,
    confirmation: "unknown",
  });
  const boundaryState = await verifyCleanupRecordBoundaryState(
    dependencies,
    boundary,
    session,
  );
  if (boundaryState !== "verified")
    throw new DockerDesktopRepairPersistenceError(
      effectBoundaryFailureReason(boundaryState),
    );
  const persisted = persist(
    dependencies,
    boundary,
    operation,
    operation.stage,
    ledger,
  );
  if (persisted.status !== "persisted")
    throwPersistenceFailure(persisted.status);
  return persisted.operation;
}

type HostEffectPrecondition = Readonly<{
  state:
    | "proceed"
    | "recovered"
    | "known_not_needed"
    | "authority_changed"
    | "cancelled"
    | "helper_lost"
    | "artifact_unknown"
    | "unknown";
  liveRunIdentity: DockerDesktopRepairDirectoryIdentity | null;
}>;

function hostEffectPreconditionBlockReason(
  observation: HostEffectPrecondition,
  cancellation: ReturnType<typeof attachCancellation>,
) {
  if (observation.state === "helper_lost")
    return "docker_desktop_repair_native_helper_lost";
  if (observation.state === "artifact_unknown")
    return "docker_desktop_repair_helper_artifact_unknown";
  if (observation.state !== "cancelled")
    return observation.state === "authority_changed"
      ? "docker_desktop_repair_authority_changed"
      : "docker_desktop_repair_pre_effect_state_unknown";
  return cancellation.helperAvailable()
    ? "docker_desktop_repair_cancelled_after_process_effect"
    : "docker_desktop_repair_native_helper_lost";
}

async function observeHostEffectPrecondition(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  cancellation: ReturnType<typeof attachCancellation>,
  operation: DockerDesktopRepairOperation,
  action: Extract<
    DockerDesktopRepairEffectAction,
    | "official_shutdown"
    | "native_termination"
    | "wsl_termination"
    | "runtime_directory_rename"
    | "desktop_launch"
  >,
): Promise<HostEffectPrecondition> {
  const boundaryState = await verifyEffectBoundaryState(
    dependencies,
    boundary,
    session,
    cancellation,
  );
  if (boundaryState !== "verified")
    return Object.freeze({
      state:
        boundaryState === "authority_changed"
          ? ("authority_changed" as const)
          : boundaryState === "cancelled"
            ? ("cancelled" as const)
            : boundaryState === "helper_lost"
              ? ("helper_lost" as const)
              : ("artifact_unknown" as const),
      liveRunIdentity: null,
    });
  const processes = await inspectProcessesWithinCancellation(
    session,
    cancellation,
  );
  if (!cancellation.effectAllowed())
    return Object.freeze({
      state: "cancelled" as const,
      liveRunIdentity: null,
    });
  let current: PreparedBoundary | null = null;
  try {
    current = dependencies.prepareBoundary();
  } catch {
    current = null;
  }
  if (!current || !samePreparedAuthority(boundary, current))
    return Object.freeze({
      state: "authority_changed" as const,
      liveRunIdentity: null,
    });
  const engine = dependencies.observeEngine(boundary);
  const repairRun = observePathUsing(dependencies, boundary.runDirectory);
  const stale = observePathUsing(dependencies, operation.staleDirectory);
  if (!cancellation.effectAllowed())
    return Object.freeze({
      state: "cancelled" as const,
      liveRunIdentity: null,
    });
  if (action === "desktop_launch" && operation.stage === "renamed") {
    if (
      engine === "ready" &&
      processes === "verified" &&
      repairRun.state === "present" &&
      repairRun.identity !== null &&
      !sameIdentity(repairRun.identity, operation.runIdentity) &&
      stale.state === "present" &&
      stale.identity !== null &&
      sameIdentity(stale.identity, operation.runIdentity)
    )
      return Object.freeze({
        state: "recovered" as const,
        liveRunIdentity: repairRun.identity,
      });
    if (
      engine === "known_unavailable" &&
      processes === "absent" &&
      repairRun.state === "confirmed_absent" &&
      stale.state === "present" &&
      stale.identity !== null &&
      sameIdentity(stale.identity, operation.runIdentity)
    )
      return Object.freeze({
        state: "proceed" as const,
        liveRunIdentity: null,
      });
    return Object.freeze({ state: "unknown" as const, liveRunIdentity: null });
  }
  if (
    engine === "ready" &&
    processes === "verified" &&
    repairRun.state === "present" &&
    repairRun.identity !== null &&
    sameIdentity(repairRun.identity, operation.runIdentity) &&
    stale.state === "confirmed_absent"
  )
    return Object.freeze({
      state: "recovered" as const,
      liveRunIdentity: repairRun.identity,
    });
  const isExactUnavailableRun =
    engine === "known_unavailable" &&
    repairRun.state === "present" &&
    repairRun.identity !== null &&
    sameIdentity(repairRun.identity, operation.runIdentity) &&
    stale.state === "confirmed_absent";
  if (
    isExactUnavailableRun &&
    ((action === "official_shutdown" &&
      (processes === "verified" || processes === "absent")) ||
      (action === "native_termination" && processes === "verified") ||
      (action === "wsl_termination" && processes === "absent"))
  )
    return Object.freeze({ state: "proceed" as const, liveRunIdentity: null });
  if (
    action === "native_termination" &&
    isExactUnavailableRun &&
    processes === "absent"
  )
    return Object.freeze({
      state: "known_not_needed" as const,
      liveRunIdentity: null,
    });
  if (
    action === "runtime_directory_rename" &&
    operation.stage === "processes_stopped" &&
    isExactUnavailableRun &&
    processes === "absent"
  )
    return Object.freeze({ state: "proceed" as const, liveRunIdentity: null });
  return Object.freeze({ state: "unknown" as const, liveRunIdentity: null });
}

async function settleUnissuedIntentAfterFreshObservation(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  cancellation: ReturnType<typeof attachCancellation>,
  operation: DockerDesktopRepairOperation,
  kind: "process" | "filesystem",
  action: DockerDesktopRepairEffectAction,
  ledger: MutableLedger,
  observation: HostEffectPrecondition,
) {
  const settled = await persistHostEffectSettlement(
    dependencies,
    boundary,
    session,
    cancellation,
    operation,
    kind,
    action,
    Object.freeze({ issued: false, confirmation: "not_issued" }),
    ledger,
  );
  if (!settled || observation.state !== "recovered") return settled;
  const wasRenamed = operation.stage === "renamed";
  if (!observation.liveRunIdentity)
    throw new DockerDesktopRepairPersistenceError(
      "docker_desktop_repair_current_state_changed_before_record",
    );
  const expectedRunIdentity = wasRenamed
    ? observation.liveRunIdentity
    : operation.runIdentity;
  const expectedStaleIdentity = wasRenamed ? operation.runIdentity : null;
  const fresh = await observeFreshRuntimeState(
    dependencies,
    boundary,
    session,
    cancellation,
    settled,
  );
  if (
    !freshReadyStateMatches(fresh, expectedRunIdentity, expectedStaleIdentity)
  )
    throw new DockerDesktopRepairPersistenceError(
      "docker_desktop_repair_current_state_changed_before_record",
    );
  mergeProcessEffect(ledger, "observed_desktop_recovery", {
    issued: false,
    confirmation: "not_issued",
  });
  ledger.engineReady = true;
  ledger.hostSafety = "safe";
  ledger.evidenceState = "preserved";
  ledger.liveRunIdentity = fresh.run.identity;
  ledger.staleState = wasRenamed ? "retained" : "absent";
  ledger.disposition = wasRenamed
    ? "pending_human_decision"
    : "known_effect_recovery_pending_human_decision";
  return persistAfterLiveBoundary(
    dependencies,
    boundary,
    session,
    cancellation,
    settled,
    wasRenamed
      ? "recovered_pending_disposition"
      : "no_stale_known_effect_recovery_pending",
    ledger,
    (state) =>
      freshReadyStateMatches(state, expectedRunIdentity, expectedStaleIdentity),
  );
}

async function observeHistoricalRepair(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  cancellation: ReturnType<typeof attachCancellation>,
  operation: DockerDesktopRepairOperation,
) {
  const ledger = ledgerFrom(operation);
  const originalTerminal = originalRepairChainIsTerminal(operation);
  if (operation.history?.closed || originalTerminal) {
    const retained =
      operation.history?.staleState === "retained" ||
      operation.ledger.staleState === "retained";
    const liveRunIdentity =
      operation.history?.liveRunIdentity ??
      operation.ledger.liveRunIdentity ??
      operation.runIdentity;
    ledger.engineReady = operation.ledger.engineReady;
    ledger.staleState = retained ? "retained" : operation.ledger.staleState;
    ledger.hostSafety = operation.ledger.hostSafety;
    ledger.evidenceState = "preserved";
    ledger.liveRunIdentity = liveRunIdentity;
    ledger.disposition = operation.history?.closed
      ? "historical_effect_unknown_retained_by_human_decision"
      : operation.ledger.disposition;
    return {
      status: operation.history?.closed
        ? ("historical_closed_retained" as const)
        : ("historical_recovered_pending_close" as const),
      reason: operation.history?.closed
        ? "docker_desktop_repair_historical_evidence_retention_closed"
        : "docker_desktop_repair_historical_terminal_evidence_verified",
      ledger,
      operation,
    };
  }
  const fresh = await observeFreshRuntimeState(
    dependencies,
    boundary,
    session,
    cancellation,
    operation,
  );
  ledger.engineReady =
    fresh.engine === "ready"
      ? true
      : fresh.engine === "known_unavailable"
        ? false
        : null;
  const hasExactStale =
    fresh.stale.state === "present" &&
    fresh.stale.identity !== null &&
    sameIdentity(fresh.stale.identity, operation.runIdentity);
  const isStaleExpected = operation.history?.closed
    ? operation.history.staleState === "retained"
    : ["renamed", "recovered_pending_disposition", "closed_retained"].includes(
        operation.stage,
      ) || operation.ledger.staleState === "retained";
  const hasNoStale =
    !isStaleExpected && fresh.stale.state === "confirmed_absent";
  ledger.staleState = hasExactStale
    ? "retained"
    : hasNoStale
      ? "absent"
      : "unknown";
  const currentRun = fresh.run.identity;
  const expectedRun = operation.history?.closed
    ? operation.history.liveRunIdentity
    : hasNoStale
      ? operation.runIdentity
      : null;
  const isReady =
    fresh.boundaryState === "verified" &&
    fresh.engine === "ready" &&
    fresh.processes === "verified" &&
    fresh.run.state === "present" &&
    currentRun !== null &&
    (hasExactStale || hasNoStale) &&
    (expectedRun
      ? sameIdentity(currentRun, expectedRun)
      : !sameIdentity(currentRun, operation.runIdentity));
  ledger.hostSafety = isReady ? "safe" : "manual_recovery_required";
  ledger.evidenceState = "preserved";
  ledger.liveRunIdentity = isReady ? currentRun : null;
  ledger.disposition = operation.history?.closed
    ? "historical_effect_unknown_retained_by_human_decision"
    : "historical_effect_unknown_pending_human_decision";
  const status: DockerDesktopRuntimeRepairReport["status"] = !isReady
    ? "blocked"
    : operation.history?.closed
      ? "historical_closed_retained"
      : "historical_recovered_pending_close";
  const reason =
    fresh.boundaryState !== "verified"
      ? effectBoundaryFailureReason(fresh.boundaryState)
      : isReady
        ? "docker_desktop_repair_historical_current_state_verified"
        : "docker_desktop_repair_historical_current_state_unconfirmed";
  return { status, reason, ledger, operation };
}

function originalRepairChainIsTerminal(
  operation: DockerDesktopRepairOperation,
): boolean {
  return [
    "closed_retained",
    "closed_no_stale_known_effect_retained",
    "closed_historical_effect_unknown_retained",
  ].includes(operation.stage);
}

type HistoricalAdoptionRoute =
  | "invalid"
  | "initial_adoption"
  | "closed"
  | "current_session"
  | "session_handoff";

const SHA256_HEX = /^[a-f0-9]{64}$/u;

function validRepairDirectoryIdentity(
  value: DockerDesktopRepairDirectoryIdentity | null,
) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Object.keys(descriptors).sort().join("\0") !==
    ["birthtimeNs", "dev", "ino"].join("\0")
  )
    return false;
  const validComponent = (key: "dev" | "ino" | "birthtimeNs") => {
    const descriptor = descriptors[key];
    return (
      descriptor !== undefined &&
      "value" in descriptor &&
      typeof descriptor.value === "string" &&
      /^(?:0|[1-9][0-9]{0,39})$/u.test(descriptor.value) &&
      descriptor.value !== "0"
    );
  };
  return (
    validComponent("dev") &&
    validComponent("ino") &&
    validComponent("birthtimeNs")
  );
}

function validRepairHistorySessionFields(
  history: NonNullable<DockerDesktopRepairOperation["history"]>,
  boundary: PreparedBoundary,
) {
  if (
    !SHA256_HEX.test(history.adoptionSha256) ||
    !SHA256_HEX.test(history.handoffTipSha256 ?? "") ||
    !Number.isSafeInteger(history.handoffCount) ||
    (history.handoffCount ?? -1) < 0 ||
    (history.handoffCount ?? 9) > 8 ||
    !SHA256_HEX.test(history.originLocalUserBindingHash ?? "") ||
    !SHA256_HEX.test(history.currentLocalUserBindingHash ?? "") ||
    typeof history.currentSessionBound !== "boolean" ||
    history.currentSessionBound !==
      (history.currentLocalUserBindingHash === boundary.localUserBindingHash)
  )
    return false;
  return history.handoffCount === 0
    ? history.handoffTipSha256 === history.adoptionSha256
    : history.handoffTipSha256 !== history.adoptionSha256;
}

function validOpenRepairHistory(
  history: NonNullable<DockerDesktopRepairOperation["history"]>,
  boundary: PreparedBoundary,
) {
  return (
    history.closed === false &&
    validRepairHistorySessionFields(history, boundary) &&
    history.liveRunIdentity === null &&
    history.staleState === "unknown"
  );
}

function validClosedRepairHistory(
  history: NonNullable<DockerDesktopRepairOperation["history"]>,
  boundary: PreparedBoundary,
) {
  if (
    history.closed !== true ||
    !SHA256_HEX.test(history.adoptionSha256) ||
    !validRepairDirectoryIdentity(history.liveRunIdentity) ||
    (history.staleState !== "absent" && history.staleState !== "retained")
  )
    return false;
  const sessionFields = [
    history.handoffTipSha256,
    history.handoffCount,
    history.originLocalUserBindingHash,
    history.currentLocalUserBindingHash,
    history.currentSessionBound,
  ];
  return sessionFields.every((value) => value === undefined)
    ? true
    : sessionFields.every((value) => value !== undefined) &&
        validRepairHistorySessionFields(history, boundary);
}

function sameRepairOperationCore(
  before: DockerDesktopRepairOperation,
  after: DockerDesktopRepairOperation,
  boundary: PreparedBoundary,
) {
  return (
    isCanonicalDockerDesktopRepairHistoricalOperationCore(before, boundary) &&
    isCanonicalDockerDesktopRepairHistoricalOperationCore(after, boundary) &&
    before.operationId === after.operationId &&
    before.repairId === after.repairId &&
    before.originLocalUserBindingHash === after.originLocalUserBindingHash &&
    before.operationDirectory === after.operationDirectory &&
    before.staleName === after.staleName &&
    before.staleDirectory === after.staleDirectory &&
    sameIdentity(before.runIdentity, after.runIdentity) &&
    before.stage === after.stage &&
    before.sequence === after.sequence &&
    before.previousRecordSha256 === after.previousRecordSha256 &&
    isDeepStrictEqual(before.ledger, after.ledger)
  );
}

export function classifyDockerDesktopRepairHistoricalAdoptionRoute(
  operation: DockerDesktopRepairOperation,
  boundary: PreparedBoundary,
): HistoricalAdoptionRoute {
  if (
    !isCanonicalDockerDesktopRepairHistoricalOperationCore(operation, boundary)
  )
    return "invalid";
  if (!operation.history) return "initial_adoption";
  if (operation.history.closed)
    return validClosedRepairHistory(operation.history, boundary)
      ? "closed"
      : "invalid";
  if (!validOpenRepairHistory(operation.history, boundary)) return "invalid";
  if (
    operation.history.currentSessionBound === true &&
    operation.history.currentLocalUserBindingHash ===
      boundary.localUserBindingHash
  )
    return "current_session";
  if (
    operation.history.currentSessionBound === false &&
    operation.history.currentLocalUserBindingHash !==
      boundary.localUserBindingHash
  )
    return "session_handoff";
  return "invalid";
}

export function validateDockerDesktopRepairHistoricalAdoptionResult(
  route: HistoricalAdoptionRoute,
  before: DockerDesktopRepairOperation,
  after: DockerDesktopRepairOperation,
  boundary: PreparedBoundary,
) {
  if (
    (route !== "initial_adoption" && route !== "session_handoff") ||
    !sameRepairOperationCore(before, after, boundary) ||
    !after.history ||
    after.history.closed ||
    after.history.currentSessionBound !== true ||
    after.history.currentLocalUserBindingHash !== boundary.localUserBindingHash
  )
    return false;
  if (route === "initial_adoption")
    return (
      after.history.handoffCount === 0 &&
      after.history.handoffTipSha256 === after.history.adoptionSha256 &&
      after.history.originLocalUserBindingHash ===
        before.originLocalUserBindingHash &&
      validOpenRepairHistory(after.history, boundary)
    );
  const prior = before.history;
  const priorHandoffCount = prior?.handoffCount;
  return (
    prior !== undefined &&
    validOpenRepairHistory(prior, boundary) &&
    typeof priorHandoffCount === "number" &&
    prior.currentSessionBound === false &&
    prior.currentLocalUserBindingHash !== boundary.localUserBindingHash &&
    after.history.adoptionSha256 === prior.adoptionSha256 &&
    after.history.originLocalUserBindingHash ===
      prior.originLocalUserBindingHash &&
    after.history.handoffCount === priorHandoffCount + 1 &&
    after.history.handoffTipSha256 !== prior.handoffTipSha256 &&
    isDeepStrictEqual(after.history.liveRunIdentity, prior.liveRunIdentity) &&
    after.history.staleState === prior.staleState &&
    validOpenRepairHistory(after.history, boundary)
  );
}

export function validateDockerDesktopRepairHistoricalClosureResult(
  before: DockerDesktopRepairOperation,
  after: DockerDesktopRepairOperation,
  boundary: PreparedBoundary,
  expected: Readonly<{
    liveRunIdentity: DockerDesktopRepairDirectoryIdentity;
    staleState: "absent" | "retained";
  }>,
) {
  const prior = before.history;
  const closed = after.history;
  return (
    validRepairDirectoryIdentity(expected.liveRunIdentity) &&
    prior !== undefined &&
    closed !== undefined &&
    validOpenRepairHistory(prior, boundary) &&
    prior.currentSessionBound === true &&
    closed.closed === true &&
    validClosedRepairHistory(closed, boundary) &&
    sameRepairOperationCore(before, after, boundary) &&
    closed.adoptionSha256 === prior.adoptionSha256 &&
    closed.handoffTipSha256 === prior.handoffTipSha256 &&
    closed.handoffCount === prior.handoffCount &&
    closed.originLocalUserBindingHash === prior.originLocalUserBindingHash &&
    closed.currentLocalUserBindingHash === prior.currentLocalUserBindingHash &&
    closed.currentSessionBound === prior.currentSessionBound &&
    isDeepStrictEqual(closed.liveRunIdentity, expected.liveRunIdentity) &&
    closed.staleState === expected.staleState
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
  const cancellation = attachCancellation(
    session,
    dependencies.registerCancellation,
  );
  let status: DockerDesktopRuntimeRepairReport["status"] = "blocked";
  let reason = "docker_desktop_repair_failed_closed";
  let isDurableEffectBoundaryEntered = operation !== null;
  try {
    if (cancellation.shouldStop()) {
      markUnknown(ledger);
      reason = "docker_desktop_repair_native_helper_lost";
      return { status, reason, ledger, operation };
    }
    if (operation?.history)
      return observeHistoricalRepair(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
      );
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
      isDurableEffectBoundaryEntered = true;
      const shutdownBoundary = await verifyEffectBoundaryState(
        dependencies,
        boundary,
        session,
        cancellation,
      );
      if (shutdownBoundary !== "verified") {
        markUnknown(ledger);
        reason = effectBoundaryFailureReason(shutdownBoundary);
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
        const adoptionOperation = operation;
        const fresh = await observeFreshRuntimeState(
          dependencies,
          boundary,
          session,
          cancellation,
          adoptionOperation,
        );
        if (
          freshStoppedStateMatches(fresh, adoptionOperation) &&
          settleHostEffect(ledger, "filesystem", "runtime_directory_rename", {
            issued: true,
            confirmation: "confirmed",
          })
        ) {
          const settledAdoption = await persistAfterLiveBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
            operation,
            "processes_stopped",
            ledger,
            (state) => freshStoppedStateMatches(state, adoptionOperation),
          );
          if (!settledAdoption) {
            markUnknown(ledger);
            reason = "docker_desktop_repair_rename_adoption_record_unknown";
            return { status, reason, ledger, operation };
          }
          operation = settledAdoption;
          if (cancellation.shouldStop()) {
            reason = "docker_desktop_repair_cancelled_after_rename_adoption";
            return { status, reason, ledger, operation };
          }
          ledger.staleState = "retained";
          const settledAdoptionOperation = operation;
          const adoptedStage = await persistAfterLiveBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
            operation,
            "renamed",
            ledger,
            (state) =>
              freshStoppedStateMatches(state, settledAdoptionOperation),
          );
          if (!adoptedStage) {
            reason = "docker_desktop_repair_rename_adoption_stage_unknown";
            return { status, reason, ledger, operation };
          }
          operation = adoptedStage;
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
      operation.stage === "no_stale_known_effect_recovery_pending" ||
      operation.stage === "no_stale_historical_effect_unknown_pending"
    ) {
      const isHistoricalNoStale =
        operation.stage === "no_stale_historical_effect_unknown_pending";
      const isKnownNoStale =
        operation.stage === "no_stale_known_effect_recovery_pending";
      const isNoStale = isHistoricalNoStale || isKnownNoStale;
      const fresh = await observeFreshRuntimeState(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
      );
      const engine = fresh.engine;
      const processes = fresh.processes;
      const runObservation = fresh.run;
      const staleObservation = fresh.stale;
      const repairRun = runObservation.identity;
      const stale = staleObservation.identity;
      if (
        engine !== "ready" ||
        processes !== "verified" ||
        runObservation.state !== "present" ||
        !repairRun ||
        !sameIdentity(
          repairRun,
          isNoStale
            ? operation.runIdentity
            : (ledger.liveRunIdentity ?? operation.runIdentity),
        ) ||
        (isNoStale
          ? staleObservation.state !== "confirmed_absent"
          : staleObservation.state !== "present" ||
            !stale ||
            !sameIdentity(stale, operation.runIdentity)) ||
        fresh.boundaryState !== "verified"
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_pending_current_state_unconfirmed";
        return { status, reason, ledger, operation };
      }
      ledger.engineReady = true;
      ledger.staleState = isNoStale ? "absent" : "retained";
      ledger.disposition = isHistoricalNoStale
        ? "historical_effect_unknown_pending_human_decision"
        : isKnownNoStale
          ? "known_effect_recovery_pending_human_decision"
          : "pending_human_decision";
      status = "recovered_pending_close";
      reason = "docker_desktop_runtime_recovered_pending_close";
      return { status, reason, ledger, operation };
    }

    if (existing?.stage === "prepared" && operation.stage === "prepared") {
      const hostProcessEffects = ledger.processEffects.filter((entry) =>
        ["official_shutdown", "native_termination", "wsl_termination"].includes(
          entry.action,
        ),
      );
      const isKnownProcessEffect = hostProcessEffects.length > 0;
      const isUnknownProcessHistory = ledger.processEffects.some(
        (entry) =>
          [
            "historical_process_reconciliation",
            "process_quiescence_reconciliation",
            "official_shutdown",
            "native_termination",
            "wsl_termination",
          ].includes(entry.action) &&
          (entry.phase !== "settled" ||
            entry.issued === null ||
            entry.confirmation === "unknown"),
      );
      const historicalObservationRecorded = ledger.processEffects.some(
        (entry) => entry.action === "historical_process_reconciliation",
      );
      const desktopRecoveryRecorded = ledger.processEffects.some(
        (entry) => entry.action === "observed_desktop_recovery",
      );
      const fresh = await observeFreshRuntimeState(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
      );
      const currentEngine = fresh.engine;
      const runObservation = fresh.run;
      const staleObservation = fresh.stale;
      const repairRun = runObservation.identity;
      const stale = staleObservation.identity;
      const currentProcesses = fresh.processes;
      if (
        currentEngine === "ready" &&
        currentProcesses === "verified" &&
        repairRun &&
        sameIdentity(repairRun, operation.runIdentity) &&
        staleObservation.state === "confirmed_absent"
      ) {
        let isObservationChanged = false;
        if (
          !isKnownProcessEffect &&
          !isUnknownProcessHistory &&
          !historicalObservationRecorded
        ) {
          mergeProcessEffect(ledger, "historical_process_reconciliation", {
            issued: null,
            confirmation: "unknown",
          });
          isObservationChanged = true;
        } else if (!historicalObservationRecorded && !desktopRecoveryRecorded) {
          mergeProcessEffect(ledger, "observed_desktop_recovery", {
            issued: false,
            confirmation: "not_issued",
          });
          isObservationChanged = true;
        }
        if (isObservationChanged) {
          const observationOperation = operation;
          const observed = await persistAfterLiveBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
            operation,
            "prepared",
            ledger,
            (state) =>
              freshReadyStateMatches(
                state,
                observationOperation.runIdentity,
                null,
              ),
          );
          if (!observed) {
            reason = "docker_desktop_repair_record_update_failed";
            return { status, reason, ledger, operation };
          }
          operation = observed;
        }
        ledger.engineReady = true;
        ledger.hostSafety = "safe";
        ledger.evidenceState = "preserved";
        ledger.staleState = "absent";
        ledger.liveRunIdentity = operation.runIdentity;
        ledger.disposition =
          isKnownProcessEffect && !isUnknownProcessHistory
            ? "known_effect_recovery_pending_human_decision"
            : "historical_effect_unknown_pending_human_decision";
        const pendingOperation = operation;
        const closed = await persistAfterLiveBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          isKnownProcessEffect && !isUnknownProcessHistory
            ? "no_stale_known_effect_recovery_pending"
            : "no_stale_historical_effect_unknown_pending",
          ledger,
          (state) =>
            freshReadyStateMatches(state, pendingOperation.runIdentity, null),
        );
        if (!closed) {
          reason = "docker_desktop_repair_record_update_failed";
          return { status, reason, ledger, operation };
        }
        operation = closed;
        status = "recovered_pending_close";
        reason =
          isKnownProcessEffect && !isUnknownProcessHistory
            ? "docker_desktop_repair_no_stale_known_effect_recovery_pending_close"
            : "docker_desktop_repair_no_stale_historical_effect_unknown_pending_close";
        return { status, reason, ledger, operation };
      }
      if (
        currentEngine === "known_unavailable" &&
        currentProcesses === "absent" &&
        runObservation.state === "confirmed_absent" &&
        stale &&
        sameIdentity(stale, operation.runIdentity)
      ) {
        if (!isKnownProcessEffect && !isUnknownProcessHistory) {
          mergeProcessEffect(ledger, "historical_process_reconciliation", {
            issued: null,
            confirmation: "unknown",
          });
          const reconciliationOperation = operation;
          const reconciled = await persistAfterLiveBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
            operation,
            "prepared",
            ledger,
            (state) => freshStoppedStateMatches(state, reconciliationOperation),
          );
          if (!reconciled) {
            reason = "docker_desktop_repair_record_update_failed";
            return { status, reason, ledger, operation };
          }
          operation = reconciled;
        }
        mergeFilesystemEffect(ledger, "observed_runtime_directory_rename", {
          issued: true,
          confirmation: "confirmed",
        });
        ledger.staleState = "retained";
        const observedRenameOperation = operation;
        const renamed = await persistAfterLiveBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "renamed",
          ledger,
          (state) => freshStoppedStateMatches(state, observedRenameOperation),
        );
        if (!renamed) {
          reason = "docker_desktop_repair_record_update_failed";
          return { status, reason, ledger, operation };
        }
        operation = renamed;
      } else if (
        currentEngine !== "known_unavailable" ||
        (currentProcesses !== "absent" && currentProcesses !== "verified") ||
        !repairRun ||
        !sameIdentity(repairRun, operation.runIdentity) ||
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
      if (
        settledShutdown &&
        (settledShutdown.issued !== true ||
          settledShutdown.confirmation !== "confirmed")
      ) {
        reason = "docker_desktop_official_shutdown_unconfirmed";
        return { status, reason, ledger, operation };
      }
      if (cancellation.shouldStop()) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_cancelled";
        return { status, reason, ledger, operation };
      }
      const shutdownBoundary = await verifyEffectBoundaryState(
        dependencies,
        boundary,
        session,
        cancellation,
      );
      if (shutdownBoundary !== "verified") {
        markUnknown(ledger);
        reason = effectBoundaryFailureReason(shutdownBoundary);
        return { status, reason, ledger, operation };
      }
      if (!settledShutdown) {
        if (!durableResumeAllowsHostAction(operation, "official_shutdown")) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_durable_resume_mismatch";
          return { status, reason, ledger, operation };
        }
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
        if (shutdownIntent.status === "capacity_unavailable") {
          reason = "docker_desktop_repair_record_capacity_unavailable";
          return { status, reason, ledger, operation };
        }
        const shutdownPostIntentBoundary =
          shutdownIntent.status === "persisted"
            ? await verifyEffectBoundaryState(
                dependencies,
                boundary,
                session,
                cancellation,
              )
            : null;
        if (
          shutdownIntent.status !== "persisted" ||
          shutdownPostIntentBoundary !== "verified"
        ) {
          markUnknown(ledger);
          reason =
            shutdownIntent.status === "persisted" && shutdownPostIntentBoundary
              ? effectBoundaryFailureReason(
                  shutdownPostIntentBoundary as Exclude<
                    EffectBoundaryVerification,
                    "verified"
                  >,
                  true,
                )
              : persistFailureReason(shutdownIntent.status);
          return {
            status,
            reason,
            ledger,
            operation: shutdownIntent.operation ?? operation,
          };
        }
        operation = shutdownIntent.operation;
        const shutdownPrecondition = await observeHostEffectPrecondition(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "official_shutdown",
        );
        if (shutdownPrecondition.state !== "proceed") {
          const settled = await settleUnissuedIntentAfterFreshObservation(
            dependencies,
            boundary,
            session,
            cancellation,
            operation,
            "process",
            "official_shutdown",
            ledger,
            shutdownPrecondition,
          );
          if (settled) operation = settled;
          if (shutdownPrecondition.state === "recovered" && settled) {
            status = "recovered_pending_close";
            reason = "docker_desktop_runtime_recovered_pending_close";
          } else {
            markUnknown(ledger);
            reason = hostEffectPreconditionBlockReason(
              shutdownPrecondition,
              cancellation,
            );
          }
          return { status, reason, ledger, operation };
        }
        if (!cancellation.effectAllowed()) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_cancelled_before_host_effect";
          return { status, reason, ledger, operation };
        }
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
        if (shutdown.issued !== true || shutdown.confirmation !== "confirmed") {
          if (shutdown.confirmation === "unknown") markUnknown(ledger);
          reason = "docker_desktop_official_shutdown_unconfirmed";
          return { status, reason, ledger, operation };
        }
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
        const nativeBoundary = await verifyEffectBoundaryState(
          dependencies,
          boundary,
          session,
          cancellation,
        );
        if (nativeBoundary !== "verified") {
          markUnknown(ledger);
          reason = effectBoundaryFailureReason(nativeBoundary);
          return { status, reason, ledger, operation };
        }
        if (!durableResumeAllowsHostAction(operation, "native_termination")) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_durable_resume_mismatch";
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
        if (terminationIntent.status === "capacity_unavailable") {
          reason = "docker_desktop_repair_record_capacity_unavailable";
          return { status, reason, ledger, operation };
        }
        const nativePostIntentBoundary =
          terminationIntent.status === "persisted"
            ? await verifyEffectBoundaryState(
                dependencies,
                boundary,
                session,
                cancellation,
              )
            : null;
        if (
          terminationIntent.status !== "persisted" ||
          nativePostIntentBoundary !== "verified"
        ) {
          markUnknown(ledger);
          reason =
            terminationIntent.status === "persisted" && nativePostIntentBoundary
              ? effectBoundaryFailureReason(
                  nativePostIntentBoundary as Exclude<
                    EffectBoundaryVerification,
                    "verified"
                  >,
                  true,
                )
              : persistFailureReason(terminationIntent.status);
          return {
            status,
            reason,
            ledger,
            operation: terminationIntent.operation ?? operation,
          };
        }
        operation = terminationIntent.operation;
        const terminationPrecondition = await observeHostEffectPrecondition(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "native_termination",
        );
        if (terminationPrecondition.state === "known_not_needed") {
          const settled = await persistHostEffectSettlement(
            dependencies,
            boundary,
            session,
            cancellation,
            operation,
            "process",
            "native_termination",
            Object.freeze({ issued: false, confirmation: "not_issued" }),
            ledger,
          );
          if (!settled) {
            markUnknown(ledger);
            reason = "docker_desktop_repair_effect_settlement_unknown";
            return { status, reason, ledger, operation };
          }
          operation = settled;
        } else if (terminationPrecondition.state !== "proceed") {
          const settled = await settleUnissuedIntentAfterFreshObservation(
            dependencies,
            boundary,
            session,
            cancellation,
            operation,
            "process",
            "native_termination",
            ledger,
            terminationPrecondition,
          );
          if (settled) operation = settled;
          if (terminationPrecondition.state === "recovered" && settled) {
            status = "recovered_pending_close";
            reason = "docker_desktop_runtime_recovered_pending_close";
          } else {
            markUnknown(ledger);
            reason = hostEffectPreconditionBlockReason(
              terminationPrecondition,
              cancellation,
            );
          }
          return { status, reason, ledger, operation };
        }
        if (
          terminationPrecondition.state === "proceed" &&
          !cancellation.effectAllowed()
        ) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_cancelled_before_host_effect";
          return { status, reason, ledger, operation };
        }
        const termination =
          terminationPrecondition.state === "proceed"
            ? await session.terminateProcesses()
            : "absent";
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
        const terminationSettled =
          termination === "not_issued_unknown"
            ? await persistNativeTerminationObservation(
                dependencies,
                boundary,
                session,
                operation,
                ledger,
              )
            : terminationPrecondition.state === "known_not_needed"
              ? operation
              : await persistHostEffectSettlement(
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
      if (processes === "absent" && !settledTermination) {
        mergeProcessEffect(ledger, "native_termination", {
          issued: false,
          confirmation: "not_issued",
        });
        const absentOperation = operation;
        const observedAbsent = await persistAfterLiveBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "prepared",
          ledger,
          (state) => freshQuiescentRunStateMatches(state, absentOperation),
        );
        if (!observedAbsent) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_process_observation_record_unknown";
          return { status, reason, ledger, operation };
        }
        operation = observedAbsent;
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
        const wslBoundary = await verifyEffectBoundaryState(
          dependencies,
          boundary,
          session,
          cancellation,
        );
        if (wslBoundary !== "verified") {
          markUnknown(ledger);
          reason = effectBoundaryFailureReason(wslBoundary);
          return { status, reason, ledger, operation };
        }
        if (!durableResumeAllowsHostAction(operation, "wsl_termination")) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_durable_resume_mismatch";
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
        if (wslIntent.status === "capacity_unavailable") {
          reason = "docker_desktop_repair_record_capacity_unavailable";
          return { status, reason, ledger, operation };
        }
        const wslPostIntentBoundary =
          wslIntent.status === "persisted"
            ? await verifyEffectBoundaryState(
                dependencies,
                boundary,
                session,
                cancellation,
              )
            : null;
        if (
          wslIntent.status !== "persisted" ||
          wslPostIntentBoundary !== "verified"
        ) {
          markUnknown(ledger);
          reason =
            wslIntent.status === "persisted" && wslPostIntentBoundary
              ? effectBoundaryFailureReason(
                  wslPostIntentBoundary as Exclude<
                    EffectBoundaryVerification,
                    "verified"
                  >,
                  true,
                )
              : persistFailureReason(wslIntent.status);
          return {
            status,
            reason,
            ledger,
            operation: wslIntent.operation ?? operation,
          };
        }
        operation = wslIntent.operation;
        const wslPrecondition = await observeHostEffectPrecondition(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "wsl_termination",
        );
        if (wslPrecondition.state !== "proceed") {
          const settled = await settleUnissuedIntentAfterFreshObservation(
            dependencies,
            boundary,
            session,
            cancellation,
            operation,
            "process",
            "wsl_termination",
            ledger,
            wslPrecondition,
          );
          if (settled) operation = settled;
          if (wslPrecondition.state === "recovered" && settled) {
            status = "recovered_pending_close";
            reason = "docker_desktop_runtime_recovered_pending_close";
          } else {
            markUnknown(ledger);
            reason = hostEffectPreconditionBlockReason(
              wslPrecondition,
              cancellation,
            );
          }
          return { status, reason, ledger, operation };
        }
        if (!cancellation.effectAllowed()) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_cancelled_before_host_effect";
          return { status, reason, ledger, operation };
        }
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
      const stoppedBoundary = await verifyEffectBoundaryState(
        dependencies,
        boundary,
        session,
        cancellation,
      );
      if (stoppedBoundary !== "verified") {
        markUnknown(ledger);
        reason = effectBoundaryFailureReason(stoppedBoundary);
        return { status, reason, ledger, operation };
      }
      const quiescentOperation = operation;
      const stopped = await persistAfterLiveBoundary(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
        "processes_stopped",
        ledger,
        (state) => freshQuiescentRunStateMatches(state, quiescentOperation),
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
      const fresh = await observeFreshRuntimeState(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
      );
      const resumedEngine = fresh.engine;
      const resumedProcesses = fresh.processes;
      const resumedRunObservation = fresh.run;
      const resumedStaleObservation = fresh.stale;
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
        mergeProcessEffect(ledger, "observed_desktop_recovery", {
          issued: false,
          confirmation: "not_issued",
        });
        ledger.staleState = "absent";
        ledger.hostSafety = "safe";
        ledger.liveRunIdentity = operation.runIdentity;
        ledger.disposition = "known_effect_recovery_pending_human_decision";
        const recoveryOperation = operation;
        const pending = await persistAfterLiveBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "no_stale_known_effect_recovery_pending",
          ledger,
          (state) =>
            freshReadyStateMatches(state, recoveryOperation.runIdentity, null),
        );
        if (!pending) {
          reason = "docker_desktop_repair_record_update_failed";
          return { status, reason, ledger, operation };
        }
        operation = pending;
        status = "recovered_pending_close";
        reason =
          "docker_desktop_repair_no_stale_known_effect_recovery_pending_close";
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
        const stoppedOperation = operation;
        const renamed = await persistAfterLiveBoundary(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "renamed",
          ledger,
          (state) => freshStoppedStateMatches(state, stoppedOperation),
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
      const renameBoundary = await verifyEffectBoundaryState(
        dependencies,
        boundary,
        session,
        cancellation,
      );
      if (renameBoundary !== "verified") {
        markUnknown(ledger);
        reason = effectBoundaryFailureReason(renameBoundary);
        return { status, reason, ledger, operation };
      }
      if (
        !durableResumeAllowsHostAction(operation, "runtime_directory_rename")
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_durable_resume_mismatch";
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
      if (renameIntent.status === "capacity_unavailable") {
        reason = "docker_desktop_repair_record_capacity_unavailable";
        return { status, reason, ledger, operation };
      }
      const renamePostIntentBoundary =
        renameIntent.status === "persisted"
          ? await verifyEffectBoundaryState(
              dependencies,
              boundary,
              session,
              cancellation,
            )
          : null;
      if (
        renameIntent.status !== "persisted" ||
        renamePostIntentBoundary !== "verified"
      ) {
        markUnknown(ledger);
        reason =
          renameIntent.status === "persisted" && renamePostIntentBoundary
            ? effectBoundaryFailureReason(
                renamePostIntentBoundary as Exclude<
                  EffectBoundaryVerification,
                  "verified"
                >,
                true,
              )
            : persistFailureReason(renameIntent.status);
        return {
          status,
          reason,
          ledger,
          operation: renameIntent.operation ?? operation,
        };
      }
      operation = renameIntent.operation;
      const renamePrecondition = await observeHostEffectPrecondition(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
        "runtime_directory_rename",
      );
      if (renamePrecondition.state !== "proceed") {
        const settled = await settleUnissuedIntentAfterFreshObservation(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "filesystem",
          "runtime_directory_rename",
          ledger,
          renamePrecondition,
        );
        if (settled) operation = settled;
        if (renamePrecondition.state === "recovered" && settled) {
          status = "recovered_pending_close";
          reason = "docker_desktop_runtime_recovered_pending_close";
        } else {
          markUnknown(ledger);
          reason = hostEffectPreconditionBlockReason(
            renamePrecondition,
            cancellation,
          );
        }
        return { status, reason, ledger, operation };
      }
      if (!cancellation.effectAllowed()) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_cancelled_before_host_effect";
        return { status, reason, ledger, operation };
      }
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
      const renamedBoundary = await verifyEffectBoundaryState(
        dependencies,
        boundary,
        session,
        cancellation,
      );
      if (renamedBoundary !== "verified") {
        markUnknown(ledger);
        reason = effectBoundaryFailureReason(renamedBoundary);
        return { status, reason, ledger, operation };
      }
      const renamedOperation = operation;
      const renamed = await persistAfterLiveBoundary(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
        "renamed",
        ledger,
        (state) => freshStoppedStateMatches(state, renamedOperation),
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
      const isAlreadyRecovered =
        engine === "ready" &&
        liveRunObservation.state === "present" &&
        liveRun !== null &&
        liveProcesses === "verified" &&
        !sameIdentity(liveRun, operation.runIdentity);
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
        !isAlreadyRecovered &&
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
      if (cancellation.shouldStop() && !isAlreadyRecovered && !settledLaunch) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_cancelled";
        return { status, reason, ledger, operation };
      }
      if (!isAlreadyRecovered && !settledLaunch) {
        const launchBoundary = await verifyEffectBoundaryState(
          dependencies,
          boundary,
          session,
          cancellation,
        );
        if (launchBoundary !== "verified") {
          markUnknown(ledger);
          reason = effectBoundaryFailureReason(launchBoundary);
          return { status, reason, ledger, operation };
        }
        if (!durableResumeAllowsHostAction(operation, "desktop_launch")) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_durable_resume_mismatch";
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
        if (launchIntent.status === "capacity_unavailable") {
          reason = "docker_desktop_repair_record_capacity_unavailable";
          return { status, reason, ledger, operation };
        }
        const launchPostIntentBoundary =
          launchIntent.status === "persisted"
            ? await verifyEffectBoundaryState(
                dependencies,
                boundary,
                session,
                cancellation,
              )
            : null;
        if (
          launchIntent.status !== "persisted" ||
          launchPostIntentBoundary !== "verified"
        ) {
          markUnknown(ledger);
          reason =
            launchIntent.status === "persisted" && launchPostIntentBoundary
              ? effectBoundaryFailureReason(
                  launchPostIntentBoundary as Exclude<
                    EffectBoundaryVerification,
                    "verified"
                  >,
                  true,
                )
              : persistFailureReason(launchIntent.status);
          return {
            status,
            reason,
            ledger,
            operation: launchIntent.operation ?? operation,
          };
        }
        operation = launchIntent.operation;
        const launchPrecondition = await observeHostEffectPrecondition(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "desktop_launch",
        );
        if (launchPrecondition.state !== "proceed") {
          const settled = await settleUnissuedIntentAfterFreshObservation(
            dependencies,
            boundary,
            session,
            cancellation,
            operation,
            "process",
            "desktop_launch",
            ledger,
            launchPrecondition,
          );
          if (settled) operation = settled;
          if (launchPrecondition.state === "recovered" && settled) {
            status = "recovered_pending_close";
            reason = "docker_desktop_runtime_recovered_pending_close";
          } else {
            markUnknown(ledger);
            reason = hostEffectPreconditionBlockReason(
              launchPrecondition,
              cancellation,
            );
          }
          return { status, reason, ledger, operation };
        }
        if (!cancellation.effectAllowed()) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_cancelled_before_host_effect";
          return { status, reason, ledger, operation };
        }
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
      } else if (!isAlreadyRecovered && settledLaunch) {
        engine = await dependencies.awaitEngine(
          boundary,
          cancellation.shouldStop,
          cancellation.stopDetected,
        );
      }
      if (engine !== "ready" || !cancellation.helperAvailable()) {
        if (engine === "unknown") markUnknown(ledger);
        else ledger.hostSafety = "manual_recovery_required";
        reason =
          engine === "known_unavailable"
            ? "docker_desktop_engine_restart_unconfirmed"
            : "docker_desktop_engine_state_unknown";
        return { status, reason, ledger, operation };
      }
      const fresh = await observeFreshRuntimeState(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
      );
      engine = fresh.engine;
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
        fresh.boundaryState !== "verified" ||
        fresh.processes !== "verified"
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_started_package_identity_unknown";
        return { status, reason, ledger, operation };
      }
      ledger.hostSafety = "safe";
      ledger.evidenceState = "preserved";
      ledger.disposition = "pending_human_decision";
      const recoveredRunObservation = fresh.run;
      const recoveredRun = recoveredRunObservation.identity;
      if (recoveredRunObservation.state !== "present" || !recoveredRun) {
        markUnknown(ledger);
        reason = "docker_desktop_recovered_run_identity_unknown";
        return { status, reason, ledger, operation };
      }
      if (isAlreadyRecovered && !settledLaunch) {
        mergeProcessEffect(ledger, "observed_desktop_recovery", {
          issued: false,
          confirmation: "not_issued",
        });
      }
      ledger.liveRunIdentity = recoveredRun;
      const recoveredOperation = operation;
      const pending = await persistAfterLiveBoundary(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
        "recovered_pending_disposition",
        ledger,
        (state) =>
          freshReadyStateMatches(
            state,
            recoveredRun,
            recoveredOperation.runIdentity,
          ),
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
  } catch (error) {
    markUnknown(ledger);
    if (isDurableEffectBoundaryEntered) markUnknown(ledger);
    reason =
      error instanceof DockerDesktopRepairPersistenceError
        ? error.repairReason
        : "docker_desktop_repair_failed_closed";
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
    const repairHelper = await dependencies.acquireHelper(boundary);
    if (repairHelper.status !== "acquired" || !repairHelper.session) {
      helperCleanupConfirmed = repairHelper.status !== "cleanup_unknown";
      if (repairHelper.status === "cleanup_unknown") markUnknown(ledger);
      return report(
        status,
        repairHelper.status === "unavailable"
          ? "docker_desktop_repair_lock_unavailable"
          : repairHelper.status === "protocol_failed"
            ? "docker_desktop_repair_helper_protocol_failed"
            : "docker_desktop_repair_lock_cleanup_unknown",
        ledger,
        null,
        helperCleanupConfirmed,
      );
    }
    session = repairHelper.session;
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
  let finalBoundaryConfirmed = false;
  try {
    if (boundary !== null) {
      const current = dependencies.prepareBoundary();
      finalBoundaryConfirmed =
        current !== null && samePreparedAuthority(boundary, current);
    }
  } catch {
    finalBoundaryConfirmed = false;
  }
  if (
    [
      "recovered_pending_close",
      "historical_recovered_pending_close",
      "historical_closed_retained",
    ].includes(status) &&
    !finalBoundaryConfirmed
  ) {
    markUnknown(ledger);
    status = "blocked";
    reason = "docker_desktop_repair_terminal_boundary_changed";
  }
  const isTerminal = (
    [
      "closed_retained",
      "closed_no_stale_known_effect_retained",
      "closed_historical_effect_unknown_retained",
      "historical_closed_retained",
    ] as readonly string[]
  ).includes(status);
  return report(
    status,
    reason,
    ledger,
    operation,
    helperCleanupConfirmed,
    isTerminal && helperCleanupConfirmed === true,
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
    const repairHelper = await dependencies.acquireHelper(boundary);
    if (repairHelper.status !== "acquired" || !repairHelper.session) {
      helperCleanupConfirmed = repairHelper.status !== "cleanup_unknown";
      if (repairHelper.status === "cleanup_unknown") markUnknown(ledger);
      return report(
        status,
        repairHelper.status === "unavailable"
          ? "docker_desktop_repair_lock_unavailable"
          : repairHelper.status === "protocol_failed"
            ? "docker_desktop_repair_helper_protocol_failed"
            : "docker_desktop_repair_lock_cleanup_unknown",
        ledger,
        null,
        helperCleanupConfirmed,
      );
    }
    const activeSession = repairHelper.session;
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
    } else if (operation.history) {
      const observed = await observeHistoricalRepair(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
      );
      Object.assign(ledger, observed.ledger);
      status = observed.status;
      reason = observed.reason;
      if (
        status === "historical_recovered_pending_close" &&
        dependencies.history &&
        ledger.liveRunIdentity &&
        (ledger.staleState === "retained" || ledger.staleState === "absent")
      ) {
        const originalTerminal = originalRepairChainIsTerminal(operation);
        const expectedRun = ledger.liveRunIdentity;
        const expectedStale =
          ledger.staleState === "retained" ? operation.runIdentity : null;
        const closingManifest = dependencies.history.loadCurrentManifest();
        const fresh = originalTerminal
          ? null
          : await observeFreshRuntimeState(
              dependencies,
              boundary,
              session,
              cancellation,
              operation,
            );
        if (
          !originalTerminal &&
          (!fresh || !freshReadyStateMatches(fresh, expectedRun, expectedStale))
        ) {
          markUnknown(ledger);
          status = "blocked";
          reason = "docker_desktop_repair_close_precondition_unconfirmed";
        } else {
          const closed = dependencies.history.persistClosure(
            boundary,
            operation,
            { liveRunIdentity: expectedRun, staleState: ledger.staleState },
            closingManifest,
          );
          if (!closed?.history?.closed) {
            markUnknown(ledger);
            status = "blocked";
            reason = "docker_desktop_repair_historical_closure_write_unknown";
          } else {
            operation = closed;
            status = "historical_closed_retained";
            ledger.disposition =
              "historical_effect_unknown_retained_by_human_decision";
            reason =
              "docker_desktop_repair_historical_evidence_retention_closed";
          }
        }
      }
    } else if (
      operation.stage === "closed_retained" ||
      operation.stage === "closed_no_stale_known_effect_retained" ||
      operation.stage === "closed_historical_effect_unknown_retained"
    ) {
      restoreLedger(ledger, operation);
      const fresh = await observeFreshRuntimeState(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
      );
      const engine = fresh.engine;
      const processes = fresh.processes;
      const runObservation = fresh.run;
      const staleObservation = fresh.stale;
      const repairRun = runObservation.identity;
      const stale = staleObservation.identity;
      const isHistoricalNoStale =
        operation.stage === "closed_historical_effect_unknown_retained";
      const isKnownNoStale =
        operation.stage === "closed_no_stale_known_effect_retained";
      const isNoStale = isHistoricalNoStale || isKnownNoStale;
      if (
        engine !== "ready" ||
        processes !== "verified" ||
        runObservation.state !== "present" ||
        !repairRun ||
        !sameIdentity(
          repairRun,
          isNoStale
            ? operation.runIdentity
            : (ledger.liveRunIdentity ?? operation.runIdentity),
        ) ||
        (isNoStale
          ? staleObservation.state !== "confirmed_absent"
          : staleObservation.state !== "present" ||
            !stale ||
            !sameIdentity(stale, operation.runIdentity)) ||
        fresh.boundaryState !== "verified"
      ) {
        markUnknown(ledger);
        reason = "docker_desktop_repair_terminal_current_state_unconfirmed";
      } else {
        status = isHistoricalNoStale
          ? "closed_historical_effect_unknown_retained"
          : "closed_retained";
        reason = "docker_desktop_repair_evidence_retention_already_closed";
      }
    } else if (
      operation.stage !== "recovered_pending_disposition" &&
      operation.stage !== "no_stale_known_effect_recovery_pending" &&
      operation.stage !== "no_stale_historical_effect_unknown_pending"
    ) {
      restoreLedger(ledger, operation);
      reason = "docker_desktop_repair_close_state_invalid";
    } else {
      restoreLedger(ledger, operation);
      const isHistoricalNoStale =
        operation.stage === "no_stale_historical_effect_unknown_pending";
      const isKnownNoStale =
        operation.stage === "no_stale_known_effect_recovery_pending";
      const isNoStale = isHistoricalNoStale || isKnownNoStale;
      const fresh = await observeFreshRuntimeState(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
      );
      const staleObservation = fresh.stale;
      const stale = staleObservation.identity;
      const engine = fresh.engine;
      const processes = fresh.processes;
      const runObservation = fresh.run;
      const repairRun = runObservation.identity;
      if (
        (isNoStale
          ? staleObservation.state !== "confirmed_absent"
          : staleObservation.state !== "present" ||
            !stale ||
            !sameIdentity(stale, operation.runIdentity)) ||
        engine !== "ready" ||
        processes !== "verified" ||
        fresh.boundaryState !== "verified" ||
        runObservation.state !== "present" ||
        !repairRun ||
        !sameIdentity(
          repairRun,
          isNoStale
            ? operation.runIdentity
            : (ledger.liveRunIdentity ?? operation.runIdentity),
        )
      ) {
        if (engine === "unknown" || processes === "unknown")
          markUnknown(ledger);
        reason = "docker_desktop_repair_close_precondition_unconfirmed";
      } else {
        ledger.engineReady = true;
        ledger.staleState = isNoStale ? "absent" : "retained";
        ledger.hostSafety = "safe";
        ledger.evidenceState = "preserved";
        ledger.disposition = isHistoricalNoStale
          ? "historical_effect_unknown_retained_by_human_decision"
          : isKnownNoStale
            ? "known_effect_recovery_retained_by_human_decision"
            : "retained_by_human_decision";
        if (!hasDockerDesktopRepairRecordCapacity(operation, 1)) {
          reason = "docker_desktop_repair_record_capacity_unavailable";
        } else {
          const closeOperation = operation;
          const closed = await persistAfterLiveBoundary(
            dependencies,
            boundary,
            session,
            cancellation,
            operation,
            isHistoricalNoStale
              ? "closed_historical_effect_unknown_retained"
              : isKnownNoStale
                ? "closed_no_stale_known_effect_retained"
                : "closed_retained",
            ledger,
            (state) =>
              freshReadyStateMatches(
                state,
                isNoStale
                  ? closeOperation.runIdentity
                  : (ledger.liveRunIdentity ?? closeOperation.runIdentity),
                isNoStale ? null : closeOperation.runIdentity,
              ),
          );
          if (!closed) {
            reason = "docker_desktop_repair_record_update_failed";
          } else {
            operation = closed;
            status = isHistoricalNoStale
              ? "closed_historical_effect_unknown_retained"
              : "closed_retained";
            reason = "docker_desktop_repair_evidence_retention_closed";
          }
        }
      }
    }
  } catch (error) {
    markUnknown(ledger);
    reason =
      error instanceof DockerDesktopRepairPersistenceError
        ? error.repairReason
        : "docker_desktop_repair_close_failed_closed";
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
  let terminalBoundaryConfirmed = false;
  try {
    if (boundary !== null) {
      const current = dependencies.prepareBoundary();
      terminalBoundaryConfirmed =
        current !== null && samePreparedAuthority(boundary, current);
    }
  } catch {
    terminalBoundaryConfirmed = false;
  }
  if (
    [
      "closed_retained",
      "closed_no_stale_known_effect_retained",
      "closed_historical_effect_unknown_retained",
      "historical_closed_retained",
    ].includes(status) &&
    !terminalBoundaryConfirmed
  ) {
    markUnknown(ledger);
    status = "blocked";
    reason = "docker_desktop_repair_terminal_boundary_changed";
  }
  const isTerminal = (
    [
      "closed_retained",
      "closed_no_stale_known_effect_retained",
      "closed_historical_effect_unknown_retained",
      "historical_closed_retained",
    ] as readonly string[]
  ).includes(status);
  return report(
    status,
    reason,
    ledger,
    operation,
    helperCleanupConfirmed,
    isTerminal && helperCleanupConfirmed === true,
  );
}

export async function adoptWindowsDockerDesktopRepairUsingDependencies(
  repairId: unknown,
  originRoot: unknown,
  dependencies: RepairDependencies,
): Promise<DockerDesktopRuntimeRepairReport> {
  const ledger = initialLedger();
  let boundary: PreparedBoundary | null = null;
  let operation: DockerDesktopRepairOperation | null = null;
  let session: DockerDesktopRepairNativeHelperSession | null = null;
  let cancellation: ReturnType<typeof attachCancellation> | null = null;
  let helperCleanupConfirmed: boolean | null = true;
  let status: DockerDesktopRuntimeRepairReport["status"] = "blocked";
  let reason = "docker_desktop_repair_historical_adoption_unavailable";
  try {
    if (
      !parseDockerDesktopRepairId(repairId) ||
      typeof repairId !== "string" ||
      typeof originRoot !== "string" ||
      !isSupportedWindowsAbsolutePathCandidate(originRoot) ||
      !dependencies.history
    )
      return report(status, reason, ledger, null);
    boundary = dependencies.prepareBoundary();
    if (!boundary) return report(status, reason, ledger, null);
    const acquired = await dependencies.acquireHelper(boundary);
    if (acquired.status !== "acquired" || !acquired.session) {
      helperCleanupConfirmed = acquired.status !== "cleanup_unknown";
      if (!helperCleanupConfirmed) markUnknown(ledger);
      return report(
        status,
        "docker_desktop_repair_historical_helper_unavailable",
        ledger,
        null,
        helperCleanupConfirmed,
      );
    }
    session = acquired.session;
    cancellation = attachCancellation(
      session,
      dependencies.registerCancellation,
    );
    const originManifest = dependencies.history.loadOriginManifest(originRoot);
    const currentManifest = dependencies.history.loadCurrentManifest();
    operation = dependencies.history.inspect(
      boundary,
      repairId,
      originManifest,
    );
    if (!operation) {
      reason = "docker_desktop_repair_historical_provenance_invalid";
    } else {
      restoreLedger(ledger, operation);
      const adoptionRoute = classifyDockerDesktopRepairHistoricalAdoptionRoute(
        operation,
        boundary,
      );
      if (adoptionRoute === "invalid") {
        reason = "docker_desktop_repair_historical_state_invalid";
        markUnknown(ledger);
      } else {
        const verified = await verifyEffectBoundaryState(
          dependencies,
          boundary,
          session,
          cancellation,
        );
        if (verified !== "verified") {
          reason = effectBoundaryFailureReason(verified);
          markUnknown(ledger);
        } else {
          const originalWasTerminal = originalRepairChainIsTerminal(operation);
          const operationBeforeAdoption = operation;
          const adopted =
            adoptionRoute === "initial_adoption" ||
            adoptionRoute === "session_handoff"
              ? dependencies.history.persistAdoption(
                  boundary,
                  operation,
                  originManifest,
                  currentManifest,
                )
              : operation;
          if (
            !adopted?.history ||
            ((adoptionRoute === "initial_adoption" ||
              adoptionRoute === "session_handoff") &&
              !validateDockerDesktopRepairHistoricalAdoptionResult(
                adoptionRoute,
                operationBeforeAdoption,
                adopted,
                boundary,
              ))
          ) {
            reason = "docker_desktop_repair_historical_adoption_write_unknown";
            markUnknown(ledger);
          } else {
            operation = adopted;
            let historyReady = true;
            if (!adopted.history.closed && originalWasTerminal) {
              const liveRunIdentity =
                adopted.ledger.liveRunIdentity ?? adopted.runIdentity;
              const staleState =
                adopted.ledger.staleState === "retained"
                  ? "retained"
                  : "absent";
              const closed = dependencies.history.persistClosure(
                boundary,
                adopted,
                { liveRunIdentity, staleState },
                currentManifest,
              );
              if (
                !closed?.history?.closed ||
                !validateDockerDesktopRepairHistoricalClosureResult(
                  adopted,
                  closed,
                  boundary,
                  { liveRunIdentity, staleState },
                )
              ) {
                reason =
                  "docker_desktop_repair_historical_closure_write_unknown";
                markUnknown(ledger);
                historyReady = false;
              } else {
                operation = closed;
              }
            }
            if (historyReady) {
              const observed = await observeHistoricalRepair(
                dependencies,
                boundary,
                session,
                cancellation,
                operation,
              );
              Object.assign(ledger, observed.ledger);
              status = observed.status;
              reason = observed.reason;
            }
            // Targeted adoption may unblock provenance one record at a time, but
            // it cannot declare the whole inventory safe while others are unknown.
            const currentInventory = historyReady
              ? originalWasTerminal
                ? durableInventoryState(dependencies, boundary)
                : inventoryState(dependencies, boundary)
              : null;
            if (
              (historyReady && !currentInventory) ||
              (historyReady &&
                currentInventory?.unfinished &&
                currentInventory.unfinished.operationId !==
                  operation.operationId)
            ) {
              status = "blocked";
              reason = "docker_desktop_repair_historical_inventory_incomplete";
              ledger.hostSafety = "manual_recovery_required";
            }
          }
        }
      }
    }
  } catch {
    markUnknown(ledger);
    status = "blocked";
    reason = "docker_desktop_repair_historical_adoption_failed_closed";
  } finally {
    cancellation?.dispose();
    if (session) {
      try {
        const released = await session.release();
        helperCleanupConfirmed = released.cleanup === "confirmed";
        if (!helperCleanupConfirmed || released.protocol === "failed") {
          status = "blocked";
          markUnknown(ledger);
          reason = "docker_desktop_repair_historical_helper_cleanup_unknown";
        }
      } catch {
        helperCleanupConfirmed = false;
        status = "blocked";
        markUnknown(ledger);
        reason = "docker_desktop_repair_historical_helper_cleanup_unknown";
      }
    }
  }
  try {
    const current = dependencies.prepareBoundary();
    if (!boundary || !current || !samePreparedAuthority(boundary, current)) {
      status = "blocked";
      markUnknown(ledger);
      reason = "docker_desktop_repair_terminal_boundary_changed";
    }
  } catch {
    status = "blocked";
    markUnknown(ledger);
    reason = "docker_desktop_repair_terminal_boundary_changed";
  }
  return report(
    status,
    reason,
    ledger,
    operation,
    helperCleanupConfirmed,
    status === "historical_closed_retained" && helperCleanupConfirmed === true,
  );
}

const productionDependencies: RepairDependencies = Object.freeze({
  history: Object.freeze({
    inspect: inspectDockerDesktopRepairHistoricalOperation,
    persistAdoption: persistDockerDesktopRepairHistoricalAdoption,
    persistClosure: persistDockerDesktopRepairHistoricalClosure,
    loadOriginManifest: (root: string) =>
      loadHistoricalReleaseManifestEnvelopeForVerification(root).envelope,
    loadCurrentManifest: () =>
      loadPlatformProvisionerManifestEnvelopeForVerification(
        path.resolve(import.meta.dirname, "../../../.."),
      ).envelope,
  }),
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

export function adoptRuntimeOwnedWindowsDockerDesktopRepair(
  repairId: string,
  originRoot: string,
) {
  return adoptWindowsDockerDesktopRepairUsingDependencies(
    repairId,
    originRoot,
    productionDependencies,
  );
}

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
      "no_stale_known_effect_recovery_pending",
      "no_stale_historical_effect_unknown_pending",
      "closed_retained",
      "closed_no_stale_known_effect_retained",
      "closed_historical_effect_unknown_retained",
    ]),
    hostEffectLifecycle:
      "fresh_boundary_durable_intent_fresh_boundary_exact_once_effect_settlement",
    unsettledIntentReissued: false,
    historicalAdoption:
      "explicit_id_and_signed_origin_manifest_same_user_root_policy_immutable_v4_chain_observe_and_close_only",
    historicalReceiptFiles: Object.freeze([
      "historical-adoption.json",
      "historical-closure.json",
    ]),
    currentStateUsedAsHistoricalIssuanceProof: false,
    staleDirectoryDeletion: false,
    providerEffectIssued: false,
  });
}
