import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  publishRepairHistoryFileUsingOperations,
  type RepairHistoryPublicationOperations,
} from "./docker-desktop-repair-history-publication.ts";
import { getPinnedPlatformProvisionerReleaseSignerSpkiDer } from "./platform-provisioner-release-trust.ts";
import { verifyHistoricalPlatformProvisionerManifestCandidate } from "./platform-provisioner-trust-core.ts";

export const DOCKER_DESKTOP_REPAIR_RECORD_SCHEMA =
  "crdd-coordinator/docker-desktop-repair-record/v4";
const OPERATION_PREFIX = "docker-desktop-repair-";
export function parseDockerDesktopRepairDirectoryName(value: unknown) {
  return typeof value === "string"
    ? (/^docker-desktop-repair-([a-f0-9]{32})$/u.exec(value)?.[1] ?? null)
    : null;
}
const MAXIMUM_OPERATIONS = 64;
// 1 initial record + two records for each of the five Host Effects + stage
// transitions, recovery refinement and explicit close. Four records remain as
// safety margin; compaction and deletion are intentionally not recovery tools.
const MAXIMUM_RECORDS = 24;
const MAXIMUM_RECORD_BYTES = 65_536;
const HISTORY_ADOPTION_FILE = "historical-adoption.json";
const HISTORY_CLOSURE_FILE = "historical-closure.json";
const HISTORY_HANDOFF_FILE = /^historical-handoff-([0-9]{2})\.json$/u;
const MAXIMUM_HISTORY_HANDOFFS = 8;
const HISTORY_FILES: readonly string[] = Object.freeze([
  HISTORY_ADOPTION_FILE,
  HISTORY_CLOSURE_FILE,
]);
const HISTORY_SCHEMA = "crdd-coordinator/docker-desktop-repair-history/v1";
const HISTORY_ADOPTION_SCHEMA =
  "crdd-coordinator/docker-desktop-repair-history/v2";
const HISTORY_HANDOFF_SCHEMA =
  "crdd-coordinator/docker-desktop-repair-session-handoff/v1";

export const DOCKER_DESKTOP_REPAIR_STAGES = Object.freeze([
  "prepared",
  "processes_stopped",
  "renamed",
  "recovered_pending_disposition",
  "no_stale_known_effect_recovery_pending",
  "no_stale_historical_effect_unknown_pending",
  "closed_retained",
  "closed_no_stale_known_effect_retained",
  "closed_historical_effect_unknown_retained",
] as const);
export type DockerDesktopRepairStage =
  (typeof DOCKER_DESKTOP_REPAIR_STAGES)[number];
export type DockerDesktopRepairTriState = boolean | null;
export type DockerDesktopRepairStaleState = "absent" | "retained" | "unknown";
export type DockerDesktopRepairHostSafety =
  | "safe"
  | "manual_recovery_required"
  | "unknown";
export type DockerDesktopRepairEvidenceState =
  | "preserved"
  | "not_preserved"
  | "unknown";
export type DockerDesktopRepairDisposition =
  | "not_applicable"
  | "pending_human_decision"
  | "known_effect_recovery_pending_human_decision"
  | "historical_effect_unknown_pending_human_decision"
  | "retained_by_human_decision"
  | "known_effect_recovery_retained_by_human_decision"
  | "historical_effect_unknown_retained_by_human_decision";
export type DockerDesktopRepairEffectConfirmation =
  | "not_issued"
  | "confirmed"
  | "unknown";
export const DOCKER_DESKTOP_REPAIR_EFFECT_ACTIONS = Object.freeze([
  "official_shutdown",
  "native_termination",
  "wsl_termination",
  "runtime_directory_rename",
  "desktop_launch",
  "historical_process_reconciliation",
  "process_quiescence_reconciliation",
  "observed_desktop_recovery",
  "observed_runtime_directory_rename",
  "record_write",
] as const);
export type DockerDesktopRepairEffectAction =
  (typeof DOCKER_DESKTOP_REPAIR_EFFECT_ACTIONS)[number];
export type DockerDesktopRepairEffectPhase = "intent_recorded" | "settled";
export type DockerDesktopRepairEffectEntry = Readonly<{
  sequence: number;
  action: DockerDesktopRepairEffectAction;
  phase: DockerDesktopRepairEffectPhase;
  issued: DockerDesktopRepairTriState;
  confirmation: DockerDesktopRepairEffectConfirmation;
}>;

export type DockerDesktopRepairDirectoryIdentity = Readonly<{
  dev: string;
  ino: string;
  birthtimeNs: string;
}>;

export type DockerDesktopRepairLedgerSnapshot = Readonly<{
  processEffects: readonly DockerDesktopRepairEffectEntry[];
  processEffectIssued: DockerDesktopRepairTriState;
  processEffectConfirmation: DockerDesktopRepairEffectConfirmation;
  filesystemEffects: readonly DockerDesktopRepairEffectEntry[];
  filesystemEffectIssued: DockerDesktopRepairTriState;
  filesystemEffectConfirmation: DockerDesktopRepairEffectConfirmation;
  engineReady: DockerDesktopRepairTriState;
  staleState: DockerDesktopRepairStaleState;
  hostSafety: DockerDesktopRepairHostSafety;
  evidenceState: DockerDesktopRepairEvidenceState;
  disposition: DockerDesktopRepairDisposition;
  liveRunIdentity: DockerDesktopRepairDirectoryIdentity | null;
}>;

export type DockerDesktopRepairOperation = Readonly<{
  operationId: string;
  repairId: string;
  originLocalUserBindingHash?: string;
  operationDirectory: string;
  staleName: string;
  staleDirectory: string;
  runIdentity: DockerDesktopRepairDirectoryIdentity;
  stage: DockerDesktopRepairStage;
  sequence: number;
  previousRecordSha256: string;
  ledger: DockerDesktopRepairLedgerSnapshot;
  history?: Readonly<{
    adoptionSha256: string;
    handoffTipSha256?: string;
    handoffCount?: number;
    originLocalUserBindingHash?: string;
    currentLocalUserBindingHash?: string;
    currentSessionBound?: boolean;
    closed: boolean;
    liveRunIdentity: DockerDesktopRepairDirectoryIdentity | null;
    staleState: DockerDesktopRepairStaleState;
  }>;
}>;

function isHistoryEntry(name: string) {
  return (
    HISTORY_FILES.includes(name) ||
    HISTORY_HANDOFF_FILE.test(name) ||
    knownHistoryPreparationTarget(name) !== null
  );
}

function historyPreparationName(name: string) {
  return `.crdd-history-${createHash("sha256").update(name).digest("hex")}.prepare`;
}

function knownHistoryTargetNames() {
  return [
    ...HISTORY_FILES,
    ...Array.from(
      { length: MAXIMUM_HISTORY_HANDOFFS },
      (_, sequence) =>
        `historical-handoff-${String(sequence).padStart(2, "0")}.json`,
    ),
  ];
}

function knownHistoryPreparationTarget(name: string) {
  return (
    knownHistoryTargetNames().find(
      (targetName) => historyPreparationName(targetName) === name,
    ) ?? null
  );
}

export type DockerDesktopRepairRecordBoundary = Readonly<{
  runtimeStateRoot: string;
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
  runtimeStateBindingHash: string;
  dockerPolicySha256: string;
  crddManifestHash: string;
  crddReleaseSequence: number;
  runtimeExecutionIdentitySha256: string;
  localAppData: string;
  historicalV4?: Readonly<{
    crddTree: string;
    packageContentRootSha256: string;
  }>;
}>;

type HistoricalReleaseIdentity = Readonly<{
  manifestHash: string;
  releaseSequence: number;
  runtimeExecutionIdentitySha256: string | null;
  crddTree: string;
  packageContentRootSha256: string;
}>;

export type DockerDesktopRepairHistoryVerifier = (
  envelope: unknown,
) => HistoricalReleaseIdentity | null;

function verifyPinnedHistory(
  envelope: unknown,
): HistoricalReleaseIdentity | null {
  const verified = verifyHistoricalPlatformProvisionerManifestCandidate(
    envelope,
    getPinnedPlatformProvisionerReleaseSignerSpkiDer(),
  );
  return verified
    ? Object.freeze({
        manifestHash: verified.manifestHash,
        releaseSequence: verified.payload.releaseSequence,
        runtimeExecutionIdentitySha256:
          "runtimeExecutionIdentitySha256" in verified.payload
            ? String(verified.payload.runtimeExecutionIdentitySha256)
            : null,
        crddTree: verified.payload.crddTree,
        packageContentRootSha256: verified.payload.packageContentRootSha256,
      })
    : null;
}

type StoredRecord = Readonly<{
  schema: typeof DOCKER_DESKTOP_REPAIR_RECORD_SCHEMA;
  contractRevision: 5;
  operationId: string;
  sequence: number;
  stage: DockerDesktopRepairStage;
  previousRecordSha256: string;
  staleName: string;
  runIdentity: DockerDesktopRepairDirectoryIdentity;
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
  runtimeStateBindingHash: string;
  dockerPolicySha256: string;
  crddManifestHash: string;
  crddReleaseSequence: number;
  runtimeExecutionIdentitySha256: string;
  ledger: DockerDesktopRepairLedgerSnapshot;
}>;

type HistoricalV4StoredRecord = Readonly<{
  schema: typeof DOCKER_DESKTOP_REPAIR_RECORD_SCHEMA;
  contractRevision: 4;
  operationId: string;
  sequence: number;
  stage: DockerDesktopRepairStage;
  previousRecordSha256: string;
  staleName: string;
  runIdentity: DockerDesktopRepairDirectoryIdentity;
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
  runtimeStateBindingHash: string;
  dockerPolicySha256: string;
  crddManifestHash: string;
  crddReleaseSequence: number;
  crddTree: string;
  packageContentRootSha256: string;
  ledger: DockerDesktopRepairLedgerSnapshot;
}>;

type ReadableStoredRecord = StoredRecord | HistoricalV4StoredRecord;

function exactKeys(value: object, expectedItems: readonly string[]) {
  const actualItems = Reflect.ownKeys(value);
  return (
    actualItems.length === expectedItems.length &&
    expectedItems.every((key) => actualItems.includes(key))
  );
}

function hash64(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function operationId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/u.test(value);
}

function safeIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9][0-9]{0,39})$/u.test(value);
}

function validIdentity(
  value: unknown,
): value is DockerDesktopRepairDirectoryIdentity {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    exactKeys(value, ["dev", "ino", "birthtimeNs"]) &&
    safeIntegerString(Reflect.get(value, "dev")) &&
    safeIntegerString(Reflect.get(value, "ino")) &&
    safeIntegerString(Reflect.get(value, "birthtimeNs")) &&
    Reflect.get(value, "dev") !== "0" &&
    Reflect.get(value, "ino") !== "0" &&
    Reflect.get(value, "birthtimeNs") !== "0"
  );
}

function validTriState(value: unknown): value is DockerDesktopRepairTriState {
  return value === true || value === false || value === null;
}

function validLedger(
  value: unknown,
): value is DockerDesktopRepairLedgerSnapshot {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    !exactKeys(value, [
      "processEffects",
      "processEffectIssued",
      "processEffectConfirmation",
      "filesystemEffects",
      "filesystemEffectIssued",
      "filesystemEffectConfirmation",
      "engineReady",
      "staleState",
      "hostSafety",
      "evidenceState",
      "disposition",
      "liveRunIdentity",
    ])
  )
    return false;
  const processEffects = Reflect.get(value, "processEffects");
  const filesystemEffects = Reflect.get(value, "filesystemEffects");
  return (
    validEffectEntries(processEffects, "process") &&
    validEffectEntries(filesystemEffects, "filesystem") &&
    validTriState(Reflect.get(value, "processEffectIssued")) &&
    ["not_issued", "confirmed", "unknown"].includes(
      String(Reflect.get(value, "processEffectConfirmation")),
    ) &&
    validTriState(Reflect.get(value, "filesystemEffectIssued")) &&
    ["not_issued", "confirmed", "unknown"].includes(
      String(Reflect.get(value, "filesystemEffectConfirmation")),
    ) &&
    validTriState(Reflect.get(value, "engineReady")) &&
    ["absent", "retained", "unknown"].includes(
      String(Reflect.get(value, "staleState")),
    ) &&
    ["safe", "manual_recovery_required", "unknown"].includes(
      String(Reflect.get(value, "hostSafety")),
    ) &&
    ["preserved", "not_preserved", "unknown"].includes(
      String(Reflect.get(value, "evidenceState")),
    ) &&
    [
      "not_applicable",
      "pending_human_decision",
      "known_effect_recovery_pending_human_decision",
      "historical_effect_unknown_pending_human_decision",
      "retained_by_human_decision",
      "known_effect_recovery_retained_by_human_decision",
      "historical_effect_unknown_retained_by_human_decision",
    ].includes(String(Reflect.get(value, "disposition"))) &&
    (Reflect.get(value, "liveRunIdentity") === null ||
      validIdentity(Reflect.get(value, "liveRunIdentity"))) &&
    aggregateMatches(
      processEffects,
      Reflect.get(value, "processEffectIssued"),
      Reflect.get(value, "processEffectConfirmation"),
    ) &&
    aggregateMatches(
      filesystemEffects,
      Reflect.get(value, "filesystemEffectIssued"),
      Reflect.get(value, "filesystemEffectConfirmation"),
    )
  );
}

function validEffectEntries(
  value: unknown,
  kind: "process" | "filesystem",
): value is readonly DockerDesktopRepairEffectEntry[] {
  if (
    !(
      Array.isArray(value) &&
      value.length <= MAXIMUM_RECORDS * 2 &&
      value.every(
        (entry, index) =>
          !!entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          Object.getPrototypeOf(entry) === Object.prototype &&
          exactKeys(entry, [
            "sequence",
            "action",
            "phase",
            "issued",
            "confirmation",
          ]) &&
          Reflect.get(entry, "sequence") === index &&
          DOCKER_DESKTOP_REPAIR_EFFECT_ACTIONS.includes(
            Reflect.get(entry, "action") as DockerDesktopRepairEffectAction,
          ) &&
          ["intent_recorded", "settled"].includes(
            String(Reflect.get(entry, "phase")),
          ) &&
          (Reflect.get(entry, "phase") === "settled" ||
            (Reflect.get(entry, "issued") === null &&
              Reflect.get(entry, "confirmation") === "unknown")) &&
          (Reflect.get(entry, "action") !== "record_write" ||
            Reflect.get(entry, "phase") === "settled") &&
          validTriState(Reflect.get(entry, "issued")) &&
          ["not_issued", "confirmed", "unknown"].includes(
            String(Reflect.get(entry, "confirmation")),
          ) &&
          confirmationCompatible(
            Reflect.get(entry, "issued") as DockerDesktopRepairTriState,
            Reflect.get(
              entry,
              "confirmation",
            ) as DockerDesktopRepairEffectConfirmation,
          ),
      )
    )
  )
    return false;
  const entries = value as readonly DockerDesktopRepairEffectEntry[];
  const processActions = [
    "official_shutdown",
    "native_termination",
    "wsl_termination",
    "desktop_launch",
    "historical_process_reconciliation",
    "process_quiescence_reconciliation",
    "observed_desktop_recovery",
  ] as const;
  const filesystemActions = [
    "runtime_directory_rename",
    "observed_runtime_directory_rename",
    "record_write",
  ] as const;
  if (
    entries.some((entry) =>
      kind === "process"
        ? !processActions.includes(
            entry.action as (typeof processActions)[number],
          )
        : !filesystemActions.includes(
            entry.action as (typeof filesystemActions)[number],
          ),
    )
  )
    return false;
  const hostActions = entries.filter(
    (entry) => entry.action !== "record_write",
  );
  if (
    new Set(hostActions.map((entry) => entry.action)).size !==
    hostActions.length
  )
    return false;
  const processOrder = new Map<string, number>([
    ["official_shutdown", 0],
    ["native_termination", 1],
    ["wsl_termination", 2],
    ["historical_process_reconciliation", 3],
    ["process_quiescence_reconciliation", 3],
    ["observed_desktop_recovery", 4],
    ["desktop_launch", 4],
  ]);
  let previousOrder = -1;
  for (const entry of hostActions) {
    const order =
      kind === "process" ? (processOrder.get(entry.action) ?? -1) : 0;
    if (order < previousOrder) return false;
    previousOrder = order;
  }
  return (
    hostActions.filter((entry) => entry.phase === "intent_recorded").length <= 1
  );
}

function aggregateEffectEntries(
  entries: readonly DockerDesktopRepairEffectEntry[],
) {
  const isIssued = entries.some((entry) => entry.issued === true)
    ? true
    : entries.some((entry) => entry.issued === null)
      ? null
      : false;
  const confirmation =
    entries.length === 0 || entries.every((entry) => entry.issued === false)
      ? "not_issued"
      : entries.some(
            (entry) =>
              entry.issued === null || entry.confirmation === "unknown",
          )
        ? "unknown"
        : "confirmed";
  return { issued: isIssued, confirmation } as const;
}

function aggregateMatches(
  entries: readonly DockerDesktopRepairEffectEntry[],
  issued: unknown,
  confirmation: unknown,
) {
  const aggregate = aggregateEffectEntries(entries);
  return aggregate.issued === issued && aggregate.confirmation === confirmation;
}

function validStoredRecord(
  value: unknown,
  boundary: DockerDesktopRepairRecordBoundary,
): value is ReadableStoredRecord {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    !exactKeys(
      value,
      Reflect.get(value, "contractRevision") === 4
        ? [
            "schema",
            "contractRevision",
            "operationId",
            "sequence",
            "stage",
            "previousRecordSha256",
            "staleName",
            "runIdentity",
            "runtimeStateIdentityHash",
            "runtimeStateProtectionHash",
            "localUserBindingHash",
            "runtimeStateBindingHash",
            "dockerPolicySha256",
            "crddManifestHash",
            "crddReleaseSequence",
            "crddTree",
            "packageContentRootSha256",
            "ledger",
          ]
        : [
            "schema",
            "contractRevision",
            "operationId",
            "sequence",
            "stage",
            "previousRecordSha256",
            "staleName",
            "runIdentity",
            "runtimeStateIdentityHash",
            "runtimeStateProtectionHash",
            "localUserBindingHash",
            "runtimeStateBindingHash",
            "dockerPolicySha256",
            "crddManifestHash",
            "crddReleaseSequence",
            "runtimeExecutionIdentitySha256",
            "ledger",
          ],
    )
  )
    return false;
  const id = Reflect.get(value, "operationId");
  const sequence = Reflect.get(value, "sequence");
  const stage = Reflect.get(value, "stage");
  return (
    Reflect.get(value, "schema") === DOCKER_DESKTOP_REPAIR_RECORD_SCHEMA &&
    (Reflect.get(value, "contractRevision") === 5 ||
      Reflect.get(value, "contractRevision") === 4) &&
    operationId(id) &&
    Number.isSafeInteger(sequence) &&
    Number(sequence) >= 0 &&
    Number(sequence) < MAXIMUM_RECORDS &&
    DOCKER_DESKTOP_REPAIR_STAGES.includes(stage as DockerDesktopRepairStage) &&
    hash64(Reflect.get(value, "previousRecordSha256")) &&
    Reflect.get(value, "staleName") === `run.crdd-stale-${id}` &&
    validIdentity(Reflect.get(value, "runIdentity")) &&
    Reflect.get(value, "runtimeStateIdentityHash") ===
      boundary.runtimeStateIdentityHash &&
    Reflect.get(value, "runtimeStateProtectionHash") ===
      boundary.runtimeStateProtectionHash &&
    Reflect.get(value, "localUserBindingHash") ===
      boundary.localUserBindingHash &&
    Reflect.get(value, "runtimeStateBindingHash") ===
      boundary.runtimeStateBindingHash &&
    Reflect.get(value, "dockerPolicySha256") === boundary.dockerPolicySha256 &&
    Reflect.get(value, "crddManifestHash") === boundary.crddManifestHash &&
    Reflect.get(value, "crddReleaseSequence") ===
      boundary.crddReleaseSequence &&
    (Reflect.get(value, "contractRevision") === 5
      ? Reflect.get(value, "runtimeExecutionIdentitySha256") ===
        boundary.runtimeExecutionIdentitySha256
      : boundary.historicalV4 !== undefined &&
        Reflect.get(value, "crddTree") === boundary.historicalV4.crddTree &&
        Reflect.get(value, "packageContentRootSha256") ===
          boundary.historicalV4.packageContentRootSha256) &&
    validLedger(Reflect.get(value, "ledger"))
  );
}

function confirmationCompatible(
  isIssued: DockerDesktopRepairTriState,
  confirmation: DockerDesktopRepairEffectConfirmation,
) {
  if (isIssued === false) return confirmation === "not_issued";
  if (isIssued === true) return confirmation !== "not_issued";
  return confirmation === "unknown";
}

function legalEffectEntriesTransition(
  previous: readonly DockerDesktopRepairEffectEntry[],
  nextItems: readonly DockerDesktopRepairEffectEntry[],
) {
  if (nextItems.length < previous.length) return false;
  return previous.every((entry, index) => {
    const candidate = nextItems[index];
    if (
      !candidate ||
      candidate.sequence !== entry.sequence ||
      candidate.action !== entry.action
    )
      return false;
    if (candidate.phase === entry.phase) {
      if (candidate.issued !== entry.issued) return false;
      return (
        candidate.confirmation === entry.confirmation ||
        (entry.action === "record_write" &&
          entry.confirmation === "unknown" &&
          candidate.confirmation === "confirmed")
      );
    }
    return (
      entry.phase === "intent_recorded" &&
      candidate.phase === "settled" &&
      confirmationCompatible(candidate.issued, candidate.confirmation)
    );
  });
}

const HOST_EFFECT_ACTIONS = new Set<DockerDesktopRepairEffectAction>([
  "official_shutdown",
  "native_termination",
  "wsl_termination",
  "runtime_directory_rename",
  "desktop_launch",
]);

const OBSERVATION_ACTIONS = new Set<DockerDesktopRepairEffectAction>([
  "historical_process_reconciliation",
  "process_quiescence_reconciliation",
  "observed_desktop_recovery",
  "observed_runtime_directory_rename",
]);

function changedEffectCount(
  previous: readonly DockerDesktopRepairEffectEntry[],
  nextItems: readonly DockerDesktopRepairEffectEntry[],
) {
  let changed = nextItems.length - previous.length;
  for (let index = 0; index < previous.length; index += 1) {
    const before = previous[index];
    const after = nextItems[index];
    if (
      before &&
      after &&
      (before.phase !== after.phase ||
        before.issued !== after.issued ||
        before.confirmation !== after.confirmation)
    )
      changed += 1;
  }
  return changed;
}

function validRecordWriteDelta(
  previous: readonly DockerDesktopRepairEffectEntry[],
  nextItems: readonly DockerDesktopRepairEffectEntry[],
) {
  const beforeItems = previous.filter(
    (entry) => entry.action === "record_write",
  );
  const afterItems = nextItems.filter(
    (entry) => entry.action === "record_write",
  );
  if (afterItems.length !== beforeItems.length + 1) return false;
  for (let index = 0; index < beforeItems.length; index += 1) {
    const prior = beforeItems[index];
    const current = afterItems[index];
    if (!prior || !current || prior.sequence !== current.sequence) return false;
    const isLastPrior = index === beforeItems.length - 1;
    if (
      current.issued !== true ||
      current.phase !== "settled" ||
      current.confirmation !==
        (isLastPrior && prior.confirmation === "unknown"
          ? "confirmed"
          : prior.confirmation)
    )
      return false;
  }
  const appended = afterItems.at(-1);
  return (
    appended?.phase === "settled" &&
    appended.issued === true &&
    appended.confirmation === "unknown"
  );
}

function legalLedgerTransition(
  previous: DockerDesktopRepairLedgerSnapshot | null,
  next: DockerDesktopRepairLedgerSnapshot,
) {
  if (
    !validLedger(next) ||
    !confirmationCompatible(
      next.processEffectIssued,
      next.processEffectConfirmation,
    ) ||
    !confirmationCompatible(
      next.filesystemEffectIssued,
      next.filesystemEffectConfirmation,
    )
  )
    return false;
  if (!previous)
    return (
      next.processEffects.length === 0 &&
      next.filesystemEffects.length === 1 &&
      next.filesystemEffects[0]?.action === "record_write" &&
      next.filesystemEffects[0]?.phase === "settled" &&
      next.filesystemEffects[0]?.issued === true &&
      next.filesystemEffects[0]?.confirmation === "unknown"
    );
  if (
    !legalEffectEntriesTransition(
      previous.processEffects,
      next.processEffects,
    ) ||
    !legalEffectEntriesTransition(
      previous.filesystemEffects,
      next.filesystemEffects,
    ) ||
    !validRecordWriteDelta(previous.filesystemEffects, next.filesystemEffects)
  )
    return false;
  const previousFilesystemItems = previous.filesystemEffects.filter(
    (entry) => entry.action !== "record_write",
  );
  const nextFilesystemItems = next.filesystemEffects.filter(
    (entry) => entry.action !== "record_write",
  );
  const processChanges = changedEffectCount(
    previous.processEffects,
    next.processEffects,
  );
  const filesystemChanges = changedEffectCount(
    previousFilesystemItems,
    nextFilesystemItems,
  );
  const previousNative = previous.processEffects.find(
    (entry) => entry.action === "native_termination",
  );
  const nextNative = next.processEffects.find(
    (entry) => entry.action === "native_termination",
  );
  const appendedReconciliation = next.processEffects
    .slice(previous.processEffects.length)
    .find((entry) => entry.action === "process_quiescence_reconciliation");
  const isAtomicNotIssuedUnknown =
    processChanges === 2 &&
    filesystemChanges === 0 &&
    previousNative?.phase === "intent_recorded" &&
    nextNative?.phase === "settled" &&
    nextNative.issued === false &&
    nextNative.confirmation === "not_issued" &&
    appendedReconciliation?.phase === "settled" &&
    appendedReconciliation.issued === null &&
    appendedReconciliation.confirmation === "unknown";
  const simpleNativeNotIssued =
    processChanges === 1 &&
    filesystemChanges === 0 &&
    previousNative?.phase === "intent_recorded" &&
    nextNative?.phase === "settled" &&
    nextNative.issued === false &&
    nextNative.confirmation === "not_issued";
  const previousShutdown = previous.processEffects.find(
    (entry) => entry.action === "official_shutdown",
  );
  const previousWsl = previous.processEffects.find(
    (entry) => entry.action === "wsl_termination",
  );
  const directNativeKnownAbsent =
    processChanges === 1 &&
    filesystemChanges === 0 &&
    !previousNative &&
    !previousWsl &&
    previousShutdown?.phase === "settled" &&
    previousShutdown.issued === true &&
    previousShutdown.confirmation === "confirmed" &&
    nextNative?.phase === "settled" &&
    nextNative.issued === false &&
    nextNative.confirmation === "not_issued";
  if (
    previousNative?.phase === "intent_recorded" &&
    nextNative?.phase === "settled" &&
    nextNative.issued === false &&
    !isAtomicNotIssuedUnknown &&
    !simpleNativeNotIssued
  )
    return false;
  if (processChanges + filesystemChanges > 1 && !isAtomicNotIssuedUnknown)
    return false;
  const appendedItems = [
    ...next.processEffects.slice(previous.processEffects.length),
    ...nextFilesystemItems.slice(previousFilesystemItems.length),
  ];
  if (
    appendedItems.some(
      (entry) =>
        (HOST_EFFECT_ACTIONS.has(entry.action) &&
          entry.phase !== "intent_recorded" &&
          !(
            directNativeKnownAbsent && entry.action === "native_termination"
          )) ||
        (OBSERVATION_ACTIONS.has(entry.action) && entry.phase !== "settled"),
    )
  )
    return false;
  const unsettledItems = [
    ...next.processEffects,
    ...nextFilesystemItems,
  ].filter((entry) => entry.phase === "intent_recorded");
  if (unsettledItems.length > 1) return false;
  const previousUnsettled = [
    ...previous.processEffects,
    ...previousFilesystemItems,
  ].find((entry) => entry.phase === "intent_recorded");
  if (previousUnsettled) {
    const settled = [...next.processEffects, ...nextFilesystemItems].find(
      (entry) => entry.action === previousUnsettled.action,
    );
    if (settled?.phase !== "settled") return false;
  }
  const nextUnsettled = unsettledItems[0];
  if (nextUnsettled) {
    const owningEntries = next.processEffects.includes(nextUnsettled)
      ? next.processEffects
      : nextFilesystemItems;
    if (owningEntries.at(-1) !== nextUnsettled) return false;
  }
  return true;
}

function effectEntry(
  ledger: DockerDesktopRepairLedgerSnapshot,
  action: DockerDesktopRepairEffectAction,
) {
  return [...ledger.processEffects, ...ledger.filesystemEffects].find(
    (entry) => entry.action === action,
  );
}

function isSettled(
  ledger: DockerDesktopRepairLedgerSnapshot,
  action: DockerDesktopRepairEffectAction,
) {
  return effectEntry(ledger, action)?.phase === "settled";
}

function isSettledConfirmed(
  ledger: DockerDesktopRepairLedgerSnapshot,
  action: DockerDesktopRepairEffectAction,
) {
  const entry = effectEntry(ledger, action);
  return entry?.phase === "settled" && entry.confirmation === "confirmed";
}

function isSettledNotIssued(
  ledger: DockerDesktopRepairLedgerSnapshot,
  action: DockerDesktopRepairEffectAction,
) {
  const entry = effectEntry(ledger, action);
  return (
    entry?.phase === "settled" &&
    entry.issued === false &&
    entry.confirmation === "not_issued"
  );
}

function hasUnknownReconciliation(ledger: DockerDesktopRepairLedgerSnapshot) {
  return ledger.processEffects.some(
    (entry) =>
      [
        "historical_process_reconciliation",
        "process_quiescence_reconciliation",
      ].includes(entry.action) &&
      (entry.issued === null || entry.confirmation === "unknown"),
  );
}

function hasUnknownHostEffect(ledger: DockerDesktopRepairLedgerSnapshot) {
  return [...ledger.processEffects, ...ledger.filesystemEffects].some(
    (entry) =>
      HOST_EFFECT_ACTIONS.has(entry.action) &&
      (entry.phase !== "settled" || entry.confirmation === "unknown"),
  );
}

function validKnownProcessPrefix(ledger: DockerDesktopRepairLedgerSnapshot) {
  const shutdown = effectEntry(ledger, "official_shutdown");
  const native = effectEntry(ledger, "native_termination");
  const wsl = effectEntry(ledger, "wsl_termination");
  if (!shutdown) return !native && !wsl;
  if (
    native &&
    (shutdown.phase !== "settled" ||
      shutdown.issued !== true ||
      shutdown.confirmation !== "confirmed")
  )
    return false;
  if (
    wsl &&
    (shutdown.phase !== "settled" ||
      shutdown.issued !== true ||
      shutdown.confirmation !== "confirmed" ||
      !native ||
      native.phase === "intent_recorded" ||
      native.confirmation === "unknown")
  )
    return false;
  return true;
}

function settledStoppedPrefix(ledger: DockerDesktopRepairLedgerSnapshot) {
  return (
    validKnownProcessPrefix(ledger) &&
    isSettled(ledger, "official_shutdown") &&
    isSettledConfirmed(ledger, "wsl_termination") &&
    !hasUnknownReconciliation(ledger)
  );
}

function stageLedgerCompatible(
  stage: DockerDesktopRepairStage,
  ledger: DockerDesktopRepairLedgerSnapshot,
) {
  const isUnsettled = [
    ...ledger.processEffects,
    ...ledger.filesystemEffects,
  ].some((entry) => entry.phase === "intent_recorded");
  const effect = (action: DockerDesktopRepairEffectAction) =>
    effectEntry(ledger, action);
  const settledConfirmed = (action: DockerDesktopRepairEffectAction) =>
    isSettledConfirmed(ledger, action);
  if (
    effect("runtime_directory_rename") &&
    effect("observed_runtime_directory_rename")
  )
    return false;
  if (!validKnownProcessPrefix(ledger)) return false;
  const reconciliationIndex = ledger.processEffects.findIndex((entry) =>
    [
      "historical_process_reconciliation",
      "process_quiescence_reconciliation",
    ].includes(entry.action),
  );
  if (
    reconciliationIndex >= 0 &&
    (ledger.processEffects
      .slice(reconciliationIndex + 1)
      .some((entry) => HOST_EFFECT_ACTIONS.has(entry.action)) ||
      effect("runtime_directory_rename"))
  )
    return false;
  if (
    isUnsettled &&
    !["prepared", "processes_stopped", "renamed"].includes(stage)
  )
    return false;
  if (
    stage === "prepared" &&
    (ledger.processEffects.some((entry) => entry.action === "desktop_launch") ||
      ledger.filesystemEffects.some(
        (entry) => entry.action === "runtime_directory_rename",
      ))
  )
    return false;
  const semanticFilesystemItems = ledger.filesystemEffects.filter(
    (entry) => entry.action !== "record_write",
  );
  const recordWriteCount =
    ledger.filesystemEffects.length - semanticFilesystemItems.length;
  if (
    stage === "prepared" &&
    recordWriteCount === 1 &&
    ledger.processEffects.length === 0 &&
    semanticFilesystemItems.length === 0 &&
    (ledger.engineReady !== false ||
      ledger.staleState !== "absent" ||
      ledger.hostSafety !== "safe" ||
      ledger.evidenceState !== "not_preserved" ||
      ledger.disposition !== "not_applicable" ||
      ledger.liveRunIdentity !== null)
  )
    return false;
  if (stage === "prepared" && effect("observed_runtime_directory_rename"))
    return false;
  if (
    stage === "processes_stopped" &&
    ledger.processEffects.some((entry) => entry.action === "desktop_launch")
  )
    return false;
  if (stage === "processes_stopped" && !settledStoppedPrefix(ledger))
    return false;
  if (
    stage === "processes_stopped" &&
    (ledger.engineReady !== false ||
      ledger.staleState !== "absent" ||
      ledger.hostSafety !== "safe" ||
      ledger.evidenceState !== "preserved" ||
      ledger.disposition !== "not_applicable" ||
      ledger.liveRunIdentity !== null)
  )
    return false;
  if (stage === "renamed") {
    const isHostRename = settledConfirmed("runtime_directory_rename");
    const isObservedRename = settledConfirmed(
      "observed_runtime_directory_rename",
    );
    if (isHostRename === isObservedRename) return false;
    if (isHostRename && !settledStoppedPrefix(ledger)) return false;
    if (
      isObservedRename &&
      !effect("historical_process_reconciliation") &&
      !settledStoppedPrefix(ledger)
    )
      return false;
    if (
      ledger.engineReady !== false ||
      ledger.staleState !== "retained" ||
      ledger.hostSafety !== "safe" ||
      ledger.evidenceState !== "preserved" ||
      ledger.disposition !== "not_applicable" ||
      ledger.liveRunIdentity !== null
    )
      return false;
  }
  if (stage === "recovered_pending_disposition")
    return (
      settledConfirmed("desktop_launch") !==
        isSettledNotIssued(ledger, "observed_desktop_recovery") &&
      (settledConfirmed("runtime_directory_rename") ||
        settledConfirmed("observed_runtime_directory_rename")) &&
      ledger.engineReady === true &&
      ledger.liveRunIdentity !== null &&
      ledger.staleState === "retained" &&
      ledger.hostSafety === "safe" &&
      ledger.evidenceState === "preserved" &&
      ledger.disposition === "pending_human_decision"
    );
  if (stage === "closed_retained")
    return (
      settledConfirmed("desktop_launch") !==
        isSettledNotIssued(ledger, "observed_desktop_recovery") &&
      (settledConfirmed("runtime_directory_rename") ||
        settledConfirmed("observed_runtime_directory_rename")) &&
      ledger.engineReady === true &&
      ledger.liveRunIdentity !== null &&
      ledger.staleState === "retained" &&
      ledger.hostSafety === "safe" &&
      ledger.evidenceState === "preserved" &&
      ledger.disposition === "retained_by_human_decision"
    );
  if (stage === "no_stale_known_effect_recovery_pending")
    return (
      isSettledNotIssued(ledger, "observed_desktop_recovery") &&
      !effect("desktop_launch") &&
      isSettled(ledger, "official_shutdown") &&
      !hasUnknownHostEffect(ledger) &&
      !hasUnknownReconciliation(ledger) &&
      ledger.engineReady === true &&
      ledger.liveRunIdentity !== null &&
      ledger.staleState === "absent" &&
      ledger.hostSafety === "safe" &&
      ledger.evidenceState === "preserved" &&
      ledger.disposition === "known_effect_recovery_pending_human_decision"
    );
  if (stage === "closed_no_stale_known_effect_retained")
    return (
      isSettledNotIssued(ledger, "observed_desktop_recovery") &&
      !effect("desktop_launch") &&
      isSettled(ledger, "official_shutdown") &&
      !hasUnknownHostEffect(ledger) &&
      !hasUnknownReconciliation(ledger) &&
      ledger.engineReady === true &&
      ledger.liveRunIdentity !== null &&
      ledger.staleState === "absent" &&
      ledger.hostSafety === "safe" &&
      ledger.evidenceState === "preserved" &&
      ledger.disposition === "known_effect_recovery_retained_by_human_decision"
    );
  if (stage === "no_stale_historical_effect_unknown_pending")
    return (
      ledger.engineReady === true &&
      ledger.liveRunIdentity !== null &&
      ledger.processEffectIssued !== false &&
      ledger.processEffectConfirmation === "unknown" &&
      ledger.staleState === "absent" &&
      ledger.hostSafety === "safe" &&
      ledger.evidenceState === "preserved" &&
      ledger.disposition === "historical_effect_unknown_pending_human_decision"
    );
  if (stage === "closed_historical_effect_unknown_retained")
    return (
      ledger.engineReady === true &&
      ledger.liveRunIdentity !== null &&
      ledger.processEffectIssued !== false &&
      ledger.processEffectConfirmation === "unknown" &&
      ledger.staleState === "absent" &&
      ledger.hostSafety === "safe" &&
      ledger.evidenceState === "preserved" &&
      ledger.disposition ===
        "historical_effect_unknown_retained_by_human_decision"
    );
  return true;
}

function stableBytes(target: string) {
  let handle: number | null = null;
  try {
    const before = fs.lstatSync(target, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size < 1n ||
      before.size > BigInt(MAXIMUM_RECORD_BYTES)
    )
      return null;
    handle = fs.openSync(target, "r");
    const opened = fs.fstatSync(handle, { bigint: true });
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.birthtimeNs !== before.birthtimeNs ||
      opened.size !== before.size
    )
      return null;
    const bytes = Buffer.alloc(Number(opened.size));
    if (fs.readSync(handle, bytes, 0, bytes.length, 0) !== bytes.length)
      return null;
    const after = fs.fstatSync(handle, { bigint: true });
    const pathAfter = fs.lstatSync(target, { bigint: true });
    return after.dev === opened.dev &&
      after.ino === opened.ino &&
      after.birthtimeNs === opened.birthtimeNs &&
      after.size === opened.size &&
      pathAfter.dev === opened.dev &&
      pathAfter.ino === opened.ino &&
      pathAfter.birthtimeNs === opened.birthtimeNs &&
      pathAfter.size === opened.size
      ? bytes
      : null;
  } catch {
    return null;
  } finally {
    if (handle !== null) fs.closeSync(handle);
  }
}

function legalTransition(
  previous: DockerDesktopRepairStage | null,
  next: DockerDesktopRepairStage,
) {
  if (previous === null) return next === "prepared";
  const allowed = {
    prepared: [
      "prepared",
      "processes_stopped",
      "renamed",
      "no_stale_known_effect_recovery_pending",
      "no_stale_historical_effect_unknown_pending",
    ],
    processes_stopped: [
      "processes_stopped",
      "renamed",
      "no_stale_known_effect_recovery_pending",
      "no_stale_historical_effect_unknown_pending",
    ],
    renamed: ["renamed", "recovered_pending_disposition"],
    recovered_pending_disposition: ["closed_retained"],
    no_stale_known_effect_recovery_pending: [
      "closed_no_stale_known_effect_retained",
    ],
    no_stale_historical_effect_unknown_pending: [
      "closed_historical_effect_unknown_retained",
    ],
    closed_retained: [],
    closed_no_stale_known_effect_retained: [],
    closed_historical_effect_unknown_retained: [],
  } as const satisfies Readonly<
    Record<DockerDesktopRepairStage, readonly DockerDesktopRepairStage[]>
  >;
  return (allowed[previous] as readonly DockerDesktopRepairStage[]).includes(
    next,
  );
}

function changedSemanticActions(
  previous: DockerDesktopRepairLedgerSnapshot | null,
  next: DockerDesktopRepairLedgerSnapshot,
) {
  if (!previous) return [] as DockerDesktopRepairEffectAction[];
  const changedItems: DockerDesktopRepairEffectAction[] = [];
  const compare = (
    beforeItems: readonly DockerDesktopRepairEffectEntry[],
    afterItems: readonly DockerDesktopRepairEffectEntry[],
  ) => {
    for (let index = 0; index < afterItems.length; index += 1) {
      const candidate = afterItems[index];
      if (!candidate || candidate.action === "record_write") continue;
      const prior = beforeItems[index];
      if (
        !prior ||
        prior.phase !== candidate.phase ||
        prior.issued !== candidate.issued ||
        prior.confirmation !== candidate.confirmation
      )
        changedItems.push(candidate.action);
    }
  };
  compare(previous.processEffects, next.processEffects);
  compare(
    previous.filesystemEffects.filter(
      (entry) => entry.action !== "record_write",
    ),
    next.filesystemEffects.filter((entry) => entry.action !== "record_write"),
  );
  return changedItems;
}

function legalRepairRecordTransition(
  previousStage: DockerDesktopRepairStage | null,
  previousLedger: DockerDesktopRepairLedgerSnapshot | null,
  nextStage: DockerDesktopRepairStage,
  nextLedger: DockerDesktopRepairLedgerSnapshot,
) {
  if (
    !legalTransition(previousStage, nextStage) ||
    !legalLedgerTransition(previousLedger, nextLedger) ||
    !stageLedgerCompatible(nextStage, nextLedger)
  )
    return false;
  if (!previousLedger)
    return previousStage === null && nextStage === "prepared";
  const isControlsUnchanged =
    previousLedger.engineReady === nextLedger.engineReady &&
    previousLedger.staleState === nextLedger.staleState &&
    previousLedger.hostSafety === nextLedger.hostSafety &&
    (previousLedger.evidenceState === nextLedger.evidenceState ||
      (previousLedger.evidenceState === "not_preserved" &&
        nextLedger.evidenceState === "preserved")) &&
    previousLedger.disposition === nextLedger.disposition &&
    JSON.stringify(previousLedger.liveRunIdentity) ===
      JSON.stringify(nextLedger.liveRunIdentity);
  const changedItems = changedSemanticActions(previousLedger, nextLedger);
  const primary = changedItems[0];
  const isSameStage = previousStage === nextStage;
  if (isSameStage && !isControlsUnchanged) return false;
  if (changedItems.length === 0) return !isSameStage;
  if (
    changedItems.length === 2 &&
    changedItems[0] === "native_termination" &&
    changedItems[1] === "process_quiescence_reconciliation"
  )
    return isSameStage && nextStage === "prepared";
  if (changedItems.length !== 1 || !primary) return false;
  const phase = effectEntry(nextLedger, primary)?.phase;
  if (HOST_EFFECT_ACTIONS.has(primary)) {
    const owner: Partial<
      Record<DockerDesktopRepairEffectAction, DockerDesktopRepairStage>
    > = {
      official_shutdown: "prepared",
      native_termination: "prepared",
      wsl_termination: "prepared",
      runtime_directory_rename: "processes_stopped",
      desktop_launch: "renamed",
    };
    return isSameStage && owner[primary] === nextStage && phase !== undefined;
  }
  if (primary === "historical_process_reconciliation")
    return isSameStage && nextStage === "prepared";
  if (primary === "process_quiescence_reconciliation")
    return isSameStage && nextStage === "prepared";
  if (primary === "observed_runtime_directory_rename")
    return (
      (previousStage === "prepared" || previousStage === "processes_stopped") &&
      nextStage === "renamed"
    );
  if (primary === "observed_desktop_recovery")
    return (
      (previousStage === "prepared" && nextStage === "prepared") ||
      (previousStage === "processes_stopped" &&
        nextStage === "no_stale_known_effect_recovery_pending") ||
      (previousStage === "renamed" &&
        nextStage === "recovered_pending_disposition")
    );
  return false;
}

function toOperation(
  boundary: DockerDesktopRepairRecordBoundary,
  record: ReadableStoredRecord,
  recordSha256: string,
): DockerDesktopRepairOperation {
  const operationDirectory = path.win32.join(
    boundary.runtimeStateRoot,
    `${OPERATION_PREFIX}${record.operationId}`,
  );
  return Object.freeze({
    operationId: record.operationId,
    repairId: `docker-desktop-repair.${record.operationId}`,
    originLocalUserBindingHash: record.localUserBindingHash,
    operationDirectory,
    staleName: record.staleName,
    staleDirectory: path.win32.join(
      boundary.localAppData,
      "Docker",
      record.staleName,
    ),
    runIdentity: record.runIdentity,
    stage: record.stage,
    sequence: record.sequence,
    previousRecordSha256: recordSha256,
    ledger: record.ledger,
  });
}

function readOriginalOperation(
  boundary: DockerDesktopRepairRecordBoundary,
  directoryName: string,
  historyAllowed = false,
  logonMode: "current" | "terminal" | "closed_history" = "current",
) {
  const operationId = parseDockerDesktopRepairDirectoryName(directoryName);
  if (!operationId) return null;
  const directory = path.win32.join(boundary.runtimeStateRoot, directoryName);
  try {
    const metadata = fs.lstatSync(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    if (
      entries.length < 1 ||
      entries.length >
        MAXIMUM_RECORDS + (historyAllowed ? MAXIMUM_HISTORY_HANDOFFS + 4 : 1)
    )
      return null;
    const records = entries
      .filter(
        (entry) =>
          entry.isFile() && !(historyAllowed && isHistoryEntry(entry.name)),
      )
      .map((entry) => entry.name)
      .sort();
    const nonRecords = entries.filter(
      (entry) =>
        !(entry.isDirectory() && entry.name === "docker-config") &&
        !entry.isFile(),
    );
    if (
      nonRecords.length > 0 ||
      records.length < 1 ||
      records.length > MAXIMUM_RECORDS
    )
      return null;
    let previousHash = "0".repeat(64);
    let previousStage: DockerDesktopRepairStage | null = null;
    let previousLedger: DockerDesktopRepairLedgerSnapshot | null = null;
    let last: ReadableStoredRecord | null = null;
    let recordBoundary = boundary;
    for (let index = 0; index < records.length; index += 1) {
      const name = records[index];
      const match = /^repair-([0-9]{2})-([a-z_]+)\.json$/u.exec(name ?? "");
      if (!match || Number(match[1]) !== index) return null;
      const bytes = stableBytes(path.win32.join(directory, name ?? ""));
      if (!bytes?.toString("utf8").endsWith("\n")) return null;
      let value: unknown;
      try {
        value = JSON.parse(bytes.toString("utf8"));
      } catch {
        return null;
      }
      if (index === 0 && logonMode !== "current") {
        const first = parseHistoryBytes(bytes);
        if (!first || !hash64(first.localUserBindingHash)) return null;
        // Bind the entire chain to ONE historical login, not each record's claim.
        // Stable user, protected root, policy and release checks remain current.
        recordBoundary = {
          ...boundary,
          localUserBindingHash: first.localUserBindingHash,
        };
      }
      if (
        !validStoredRecord(value, recordBoundary) ||
        value.operationId !== operationId ||
        value.sequence !== index ||
        value.stage !== match[2] ||
        value.previousRecordSha256 !== previousHash ||
        !legalRepairRecordTransition(
          previousStage,
          previousLedger,
          value.stage,
          value.ledger,
        )
      )
        return null;
      previousHash = createHash("sha256").update(bytes).digest("hex");
      previousStage = value.stage;
      previousLedger = value.ledger;
      last = value;
    }
    const operation = last ? toOperation(boundary, last, previousHash) : null;
    if (
      operation &&
      logonMode === "terminal" &&
      recordBoundary.localUserBindingHash !== boundary.localUserBindingHash &&
      classifyDockerDesktopRepairResume(operation).state !== "terminal"
    )
      return null;
    return operation;
  } catch {
    return null;
  }
}

function releaseMatchesBoundary(
  release: HistoricalReleaseIdentity,
  boundary: DockerDesktopRepairRecordBoundary,
) {
  return (
    release.manifestHash === boundary.crddManifestHash &&
    release.releaseSequence === boundary.crddReleaseSequence &&
    ((release.runtimeExecutionIdentitySha256 !== null &&
      release.runtimeExecutionIdentitySha256 ===
        boundary.runtimeExecutionIdentitySha256) ||
      (release.runtimeExecutionIdentitySha256 === null &&
        release.crddTree === boundary.historicalV4?.crddTree &&
        release.packageContentRootSha256 ===
          boundary.historicalV4?.packageContentRootSha256))
  );
}

function releaseNotAfterBoundary(
  release: HistoricalReleaseIdentity,
  boundary: DockerDesktopRepairRecordBoundary,
) {
  return (
    release.releaseSequence < boundary.crddReleaseSequence ||
    releaseMatchesBoundary(release, boundary)
  );
}

function historicalBoundary(
  boundary: DockerDesktopRepairRecordBoundary,
  release: HistoricalReleaseIdentity,
): DockerDesktopRepairRecordBoundary {
  // Only the signed release tuple changes. Host, selected user, root protection
  // and policy MUST still match the current verified boundary in every record.
  const { historicalV4: _ignored, ...current } = boundary;
  return release.runtimeExecutionIdentitySha256 === null
    ? Object.freeze({
        ...current,
        crddManifestHash: release.manifestHash,
        crddReleaseSequence: release.releaseSequence,
        historicalV4: {
          crddTree: release.crddTree,
          packageContentRootSha256: release.packageContentRootSha256,
        },
      })
    : Object.freeze({
        ...current,
        crddManifestHash: release.manifestHash,
        crddReleaseSequence: release.releaseSequence,
        runtimeExecutionIdentitySha256: release.runtimeExecutionIdentitySha256,
      });
}

function parseHistoryBytes(
  bytes: Buffer | null,
): Record<string, unknown> | null {
  if (!bytes?.toString("utf8").endsWith("\n")) return null;
  try {
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    return parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Object.getPrototypeOf(parsed) === Object.prototype
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function historyFilePresent(directory: string, name: string): boolean | null {
  try {
    fs.lstatSync(path.win32.join(directory, name));
    return true;
  } catch (error) {
    return error &&
      typeof error === "object" &&
      Reflect.get(error, "code") === "ENOENT"
      ? false
      : null;
  }
}

type HistoryPreparationState = Readonly<{
  targetName: string;
  preparationName: string;
  state: "prepared" | "published_residue";
}>;

function sameRegularFileIdentity(left: string, right: string) {
  try {
    const leftMetadata = fs.lstatSync(left, { bigint: true });
    const rightMetadata = fs.lstatSync(right, { bigint: true });
    return (
      leftMetadata.isFile() &&
      !leftMetadata.isSymbolicLink() &&
      rightMetadata.isFile() &&
      !rightMetadata.isSymbolicLink() &&
      leftMetadata.dev === rightMetadata.dev &&
      leftMetadata.ino === rightMetadata.ino &&
      leftMetadata.birthtimeNs === rightMetadata.birthtimeNs
    );
  } catch {
    return false;
  }
}

function classifyHistoryPreparations(
  directory: string,
): readonly HistoryPreparationState[] | null {
  try {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const preparations = entries.filter((entry) =>
      entry.name.startsWith(".crdd-history-"),
    );
    const states: HistoryPreparationState[] = [];
    for (const entry of preparations) {
      const targetName = knownHistoryPreparationTarget(entry.name);
      if (!targetName || !entry.isFile()) return null;
      const preparation = path.win32.join(directory, entry.name);
      const preparationBytes = stableBytes(preparation);
      if (!preparationBytes) return null;
      const target = path.win32.join(directory, targetName);
      const targetPresent = historyFilePresent(directory, targetName);
      if (targetPresent === null) return null;
      if (!targetPresent) {
        states.push({
          targetName,
          preparationName: entry.name,
          state: "prepared",
        });
        continue;
      }
      const targetBytes = stableBytes(target);
      if (
        !targetBytes?.equals(preparationBytes) ||
        !sameRegularFileIdentity(target, preparation)
      )
        return null;
      states.push({
        targetName,
        preparationName: entry.name,
        state: "published_residue",
      });
    }
    return Object.freeze(states);
  } catch {
    return null;
  }
}

const historyPublicationFs = Object.freeze({
  closeSync: fs.closeSync.bind(fs),
  fstatSync: fs.fstatSync.bind(fs),
  fsyncSync: fs.fsyncSync.bind(fs),
  linkSync: fs.linkSync.bind(fs),
  lstatSync: fs.lstatSync.bind(fs),
  openSync: fs.openSync.bind(fs),
  readSync: fs.readSync.bind(fs),
  unlinkSync: fs.unlinkSync.bind(fs),
  writeFileSync: fs.writeFileSync.bind(fs),
});

function historyPublicationStableBytes(target: string) {
  let handle: number | null = null;
  try {
    const before = historyPublicationFs.lstatSync(target, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size < 1n ||
      before.size > BigInt(MAXIMUM_RECORD_BYTES)
    )
      return null;
    handle = historyPublicationFs.openSync(target, "r");
    const opened = historyPublicationFs.fstatSync(handle, { bigint: true });
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.birthtimeNs !== before.birthtimeNs ||
      opened.size !== before.size
    )
      return null;
    const bytes = Buffer.alloc(Number(opened.size));
    if (
      historyPublicationFs.readSync(handle, bytes, 0, bytes.length, 0) !==
      bytes.length
    )
      return null;
    const after = historyPublicationFs.fstatSync(handle, { bigint: true });
    const pathAfter = historyPublicationFs.lstatSync(target, { bigint: true });
    return after.dev === opened.dev &&
      after.ino === opened.ino &&
      after.birthtimeNs === opened.birthtimeNs &&
      after.size === opened.size &&
      pathAfter.dev === opened.dev &&
      pathAfter.ino === opened.ino &&
      pathAfter.birthtimeNs === opened.birthtimeNs &&
      pathAfter.size === opened.size
      ? bytes
      : null;
  } catch {
    return null;
  } finally {
    if (handle !== null) historyPublicationFs.closeSync(handle);
  }
}

function historyPublicationPresent(target: string): boolean | null {
  try {
    historyPublicationFs.lstatSync(target);
    return true;
  } catch (error) {
    return error &&
      typeof error === "object" &&
      Reflect.get(error, "code") === "ENOENT"
      ? false
      : null;
  }
}

function historyPublicationSameIdentity(left: string, right: string) {
  try {
    const leftMetadata = historyPublicationFs.lstatSync(left, { bigint: true });
    const rightMetadata = historyPublicationFs.lstatSync(right, {
      bigint: true,
    });
    return (
      leftMetadata.isFile() &&
      !leftMetadata.isSymbolicLink() &&
      rightMetadata.isFile() &&
      !rightMetadata.isSymbolicLink() &&
      leftMetadata.dev === rightMetadata.dev &&
      leftMetadata.ino === rightMetadata.ino &&
      leftMetadata.birthtimeNs === rightMetadata.birthtimeNs
    );
  } catch {
    return false;
  }
}

function historyPublicationCommitDirectory(directory: string) {
  if (process.platform === "win32") {
    const metadata = historyPublicationFs.lstatSync(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      throw new Error("docker_desktop_repair_history_directory_invalid");
    return;
  }
  const descriptor = historyPublicationFs.openSync(directory, "r");
  try {
    historyPublicationFs.fsyncSync(descriptor);
  } finally {
    historyPublicationFs.closeSync(descriptor);
  }
}

const productionHistoryPublicationOperations: RepairHistoryPublicationOperations =
  Object.freeze({
    present: historyPublicationPresent,
    stableBytes: historyPublicationStableBytes,
    sameRegularFileIdentity: historyPublicationSameIdentity,
    openExclusive: (target) =>
      historyPublicationFs.openSync(target, "wx", 0o600),
    write: (descriptor, bytes) =>
      historyPublicationFs.writeFileSync(descriptor, bytes),
    sync: historyPublicationFs.fsyncSync,
    close: historyPublicationFs.closeSync,
    link: historyPublicationFs.linkSync,
    unlink: historyPublicationFs.unlinkSync,
    commitDirectory: historyPublicationCommitDirectory,
    observeBeforeLink: () => {},
    injectFault: () => {},
  });

function readOperation(
  boundary: DockerDesktopRepairRecordBoundary,
  directoryName: string,
  verifyHistory: DockerDesktopRepairHistoryVerifier,
  allowPendingSessionHandoff = false,
  allowKnownHistoryPreparation = false,
): DockerDesktopRepairOperation | null {
  if (!parseDockerDesktopRepairDirectoryName(directoryName)) return null;
  const directory = path.win32.join(boundary.runtimeStateRoot, directoryName);
  const preparationStates = classifyHistoryPreparations(directory);
  if (
    preparationStates === null ||
    (!allowKnownHistoryPreparation && preparationStates.length > 0)
  )
    return null;
  const adoptionPresent = historyFilePresent(directory, HISTORY_ADOPTION_FILE);
  const closurePresent = historyFilePresent(directory, HISTORY_CLOSURE_FILE);
  if (adoptionPresent === null || closurePresent === null) return null;
  if (!adoptionPresent)
    return closurePresent
      ? null
      : readOriginalOperation(
          boundary,
          directoryName,
          allowKnownHistoryPreparation,
          "terminal",
        );
  const adoptionBytes = stableBytes(
    path.win32.join(directory, HISTORY_ADOPTION_FILE),
  );
  const adoption = parseHistoryBytes(adoptionBytes);
  const adoptionV1 =
    adoption?.schema === HISTORY_SCHEMA &&
    exactKeys(adoption, [
      "schema",
      "kind",
      "repairId",
      "originalRecordCount",
      "originalTipSha256",
      "originManifest",
      "adoptingManifest",
    ]);
  const adoptionV2 =
    adoption?.schema === HISTORY_ADOPTION_SCHEMA &&
    exactKeys(adoption, [
      "schema",
      "kind",
      "repairId",
      "originalRecordCount",
      "originalTipSha256",
      "originLocalUserBindingHash",
      "adoptingLocalUserBindingHash",
      "runtimeStateIdentityHash",
      "runtimeStateProtectionHash",
      "runtimeStateBindingHash",
      "dockerPolicySha256",
      "originManifest",
      "adoptingManifest",
    ]);
  if (
    !adoptionBytes ||
    !adoption ||
    (!adoptionV1 && !adoptionV2) ||
    adoption.kind !== "adoption" ||
    !hash64(adoption.originalTipSha256)
  )
    return null;
  const origin = verifyHistory(adoption.originManifest);
  const adopting = verifyHistory(adoption.adoptingManifest);
  if (
    !origin ||
    !adopting ||
    !releaseNotAfterBoundary(adopting, boundary) ||
    !releaseNotAfterBoundary(origin, historicalBoundary(boundary, adopting))
  )
    return null;
  const adoptionSha256 = createHash("sha256")
    .update(adoptionBytes)
    .digest("hex");
  const historyEntries = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => HISTORY_HANDOFF_FILE.test(entry.name));
  if (
    historyEntries.some((entry) => !entry.isFile()) ||
    historyEntries.length > MAXIMUM_HISTORY_HANDOFFS
  )
    return null;
  const handoffNames = historyEntries.map((entry) => entry.name).sort();
  let handoffTipSha256 = adoptionSha256;
  let previousRelease = adopting;
  let historySession = adoptionV2
    ? String(adoption.adoptingLocalUserBindingHash)
    : boundary.localUserBindingHash;
  const visitedSessions = new Set<string>();
  if (adoptionV2) {
    if (
      !hash64(adoption.originLocalUserBindingHash) ||
      !hash64(adoption.adoptingLocalUserBindingHash) ||
      adoption.runtimeStateIdentityHash !== boundary.runtimeStateIdentityHash ||
      adoption.runtimeStateProtectionHash !==
        boundary.runtimeStateProtectionHash ||
      adoption.runtimeStateBindingHash !== boundary.runtimeStateBindingHash ||
      adoption.dockerPolicySha256 !== boundary.dockerPolicySha256
    )
      return null;
    visitedSessions.add(String(adoption.originLocalUserBindingHash));
    visitedSessions.add(historySession);
  } else if (handoffNames.length > 0) return null;
  for (let index = 0; index < handoffNames.length; index += 1) {
    const name = handoffNames[index];
    const match = HISTORY_HANDOFF_FILE.exec(name ?? "");
    if (!match || Number(match[1]) !== index) return null;
    const bytes = stableBytes(path.win32.join(directory, name ?? ""));
    const handoff = parseHistoryBytes(bytes);
    if (
      !bytes ||
      !handoff ||
      !exactKeys(handoff, [
        "schema",
        "kind",
        "repairId",
        "sequence",
        "previousHandoffSha256",
        "fromLocalUserBindingHash",
        "toLocalUserBindingHash",
        "runtimeStateIdentityHash",
        "runtimeStateProtectionHash",
        "runtimeStateBindingHash",
        "dockerPolicySha256",
        "adoptingManifest",
      ]) ||
      handoff.schema !== HISTORY_HANDOFF_SCHEMA ||
      handoff.kind !== "session_handoff" ||
      handoff.repairId !== adoption.repairId ||
      handoff.sequence !== index ||
      handoff.previousHandoffSha256 !== handoffTipSha256 ||
      handoff.fromLocalUserBindingHash !== historySession ||
      !hash64(handoff.toLocalUserBindingHash) ||
      handoff.toLocalUserBindingHash === historySession ||
      visitedSessions.has(String(handoff.toLocalUserBindingHash)) ||
      handoff.runtimeStateIdentityHash !== boundary.runtimeStateIdentityHash ||
      handoff.runtimeStateProtectionHash !==
        boundary.runtimeStateProtectionHash ||
      handoff.runtimeStateBindingHash !== boundary.runtimeStateBindingHash ||
      handoff.dockerPolicySha256 !== boundary.dockerPolicySha256
    )
      return null;
    const handoffRelease = verifyHistory(handoff.adoptingManifest);
    if (
      !handoffRelease ||
      !releaseNotAfterBoundary(handoffRelease, boundary) ||
      !releaseNotAfterBoundary(
        previousRelease,
        historicalBoundary(boundary, handoffRelease),
      )
    )
      return null;
    previousRelease = handoffRelease;
    historySession = String(handoff.toLocalUserBindingHash);
    visitedSessions.add(historySession);
    handoffTipSha256 = createHash("sha256").update(bytes).digest("hex");
  }
  let liveRunIdentity: DockerDesktopRepairDirectoryIdentity | null = null;
  let staleState: DockerDesktopRepairStaleState = "unknown";
  if (closurePresent) {
    const closure = parseHistoryBytes(
      stableBytes(path.win32.join(directory, HISTORY_CLOSURE_FILE)),
    );
    const closureV1 =
      closure?.schema === HISTORY_SCHEMA &&
      exactKeys(closure, [
        "schema",
        "kind",
        "repairId",
        "adoptionSha256",
        "liveRunIdentity",
        "staleState",
        "closingManifest",
      ]);
    const closureV2 =
      closure?.schema === HISTORY_ADOPTION_SCHEMA &&
      exactKeys(closure, [
        "schema",
        "kind",
        "repairId",
        "adoptionSha256",
        "handoffTipSha256",
        "closingLocalUserBindingHash",
        "liveRunIdentity",
        "staleState",
        "closingManifest",
      ]);
    if (
      !closure ||
      (!closureV1 && !closureV2) ||
      closure.kind !== "closure" ||
      closure.repairId !== adoption.repairId ||
      closure.adoptionSha256 !== adoptionSha256 ||
      !validIdentity(closure.liveRunIdentity) ||
      (closure.staleState !== "absent" && closure.staleState !== "retained")
    )
      return null;
    if (
      closureV2 &&
      (closure.handoffTipSha256 !== handoffTipSha256 ||
        closure.closingLocalUserBindingHash !== historySession)
    )
      return null;
    const closing = verifyHistory(closure.closingManifest);
    if (
      !closing ||
      !releaseNotAfterBoundary(closing, boundary) ||
      !releaseNotAfterBoundary(
        previousRelease,
        historicalBoundary(boundary, closing),
      )
    )
      return null;
    liveRunIdentity = closure.liveRunIdentity;
    staleState = closure.staleState;
  }
  // Only a fully validated closure permits reading a prior login's chain.
  // No operation is returned until its original chain and receipt anchors match.
  const operation = readOriginalOperation(
    historicalBoundary(boundary, origin),
    directoryName,
    true,
    adoptionV2 || closurePresent ? "closed_history" : "current",
  );
  if (
    !operation ||
    operation.repairId !== adoption.repairId ||
    operation.sequence + 1 !== adoption.originalRecordCount ||
    operation.previousRecordSha256 !== adoption.originalTipSha256
  )
    return null;
  if (
    adoptionV2 &&
    operation.originLocalUserBindingHash !== adoption.originLocalUserBindingHash
  )
    return null;
  const currentSessionBound = historySession === boundary.localUserBindingHash;
  if (!closurePresent && !currentSessionBound && !allowPendingSessionHandoff)
    return null;
  // Original stage and ledger are never rewritten or upgraded to confirmed.
  return Object.freeze({
    ...operation,
    history: Object.freeze({
      adoptionSha256,
      handoffTipSha256,
      handoffCount: handoffNames.length,
      originLocalUserBindingHash:
        operation.originLocalUserBindingHash ?? boundary.localUserBindingHash,
      currentLocalUserBindingHash: historySession,
      currentSessionBound,
      closed: closurePresent,
      liveRunIdentity,
      staleState,
    }),
  });
}

export function inspectDockerDesktopRepairHistoricalOperation(
  boundary: DockerDesktopRepairRecordBoundary,
  repairId: string,
  originManifest: unknown,
  verifyHistory: DockerDesktopRepairHistoryVerifier = verifyPinnedHistory,
): DockerDesktopRepairOperation | null {
  const parsedId = /^docker-desktop-repair\.([a-f0-9]{32})$/u.exec(
    repairId,
  )?.[1];
  if (!parsedId) return null;
  try {
    const names = fs
      .readdirSync(boundary.runtimeStateRoot, { withFileTypes: true })
      .filter((entry) => entry.name.startsWith(OPERATION_PREFIX));
    if (
      names.length > MAXIMUM_OPERATIONS ||
      names.some(
        (entry) =>
          !entry.isDirectory() ||
          !parseDockerDesktopRepairDirectoryName(entry.name),
      )
    )
      return null;
    const directoryName = `${OPERATION_PREFIX}${parsedId}`;
    const directory = path.win32.join(boundary.runtimeStateRoot, directoryName);
    if (
      historyFilePresent(directory, HISTORY_ADOPTION_FILE) !== false ||
      historyFilePresent(directory, HISTORY_CLOSURE_FILE) !== false
    )
      return readOperation(boundary, directoryName, verifyHistory, true);
    const origin = verifyHistory(originManifest);
    return origin && releaseNotAfterBoundary(origin, boundary)
      ? readOriginalOperation(
          historicalBoundary(boundary, origin),
          directoryName,
          false,
          "terminal",
        )
      : null;
  } catch {
    return null;
  }
}

function writeHistoryFile(directory: string, name: string, bytes: Buffer) {
  const target = path.win32.join(directory, name);
  const preparation = path.win32.join(directory, historyPreparationName(name));
  return publishRepairHistoryFileUsingOperations(
    productionHistoryPublicationOperations,
    directory,
    target,
    preparation,
    bytes,
    MAXIMUM_RECORD_BYTES,
  );
}

function settlePublishedHistoryResidues(directory: string) {
  const states = classifyHistoryPreparations(directory);
  if (states === null) return false;
  for (const state of states) {
    if (state.state !== "published_residue") continue;
    const bytes = stableBytes(path.win32.join(directory, state.targetName));
    if (!bytes || !writeHistoryFile(directory, state.targetName, bytes))
      return false;
  }
  return true;
}

export function persistDockerDesktopRepairHistoricalAdoption(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
  originManifest: unknown,
  adoptingManifest: unknown,
  verifyHistory: DockerDesktopRepairHistoryVerifier = verifyPinnedHistory,
): DockerDesktopRepairOperation | null {
  try {
    const directoryName = `${OPERATION_PREFIX}${operation.operationId}`;
    const existing = readOperation(
      boundary,
      directoryName,
      verifyHistory,
      true,
      true,
    );
    if (
      existing &&
      !settlePublishedHistoryResidues(existing.operationDirectory)
    )
      return null;
    if (existing?.history) {
      if (existing.history.closed || existing.history.currentSessionBound)
        return readOperation(boundary, directoryName, verifyHistory, true);
      if (
        existing.history.handoffCount === undefined ||
        existing.history.handoffTipSha256 === undefined ||
        existing.history.currentLocalUserBindingHash === undefined ||
        existing.history.handoffCount >= MAXIMUM_HISTORY_HANDOFFS
      )
        return null;
      const adopting = verifyHistory(adoptingManifest);
      if (!adopting || !releaseMatchesBoundary(adopting, boundary)) return null;
      const sequence = existing.history.handoffCount;
      const bytes = Buffer.from(
        `${JSON.stringify({
          schema: HISTORY_HANDOFF_SCHEMA,
          kind: "session_handoff",
          repairId: existing.repairId,
          sequence,
          previousHandoffSha256: existing.history.handoffTipSha256,
          fromLocalUserBindingHash:
            existing.history.currentLocalUserBindingHash,
          toLocalUserBindingHash: boundary.localUserBindingHash,
          runtimeStateIdentityHash: boundary.runtimeStateIdentityHash,
          runtimeStateProtectionHash: boundary.runtimeStateProtectionHash,
          runtimeStateBindingHash: boundary.runtimeStateBindingHash,
          dockerPolicySha256: boundary.dockerPolicySha256,
          adoptingManifest,
        })}\n`,
        "utf8",
      );
      if (
        !writeHistoryFile(
          existing.operationDirectory,
          `historical-handoff-${String(sequence).padStart(2, "0")}.json`,
          bytes,
        )
      )
        return null;
      return readOperation(boundary, directoryName, verifyHistory);
    }
    // Snapshot caller data before verification; getters or later mutation never
    // get a second opportunity to alter the bytes being written.
    const bytes = Buffer.from(
      `${JSON.stringify({
        schema: HISTORY_ADOPTION_SCHEMA,
        kind: "adoption",
        repairId: operation.repairId,
        originalRecordCount: operation.sequence + 1,
        originalTipSha256: operation.previousRecordSha256,
        originLocalUserBindingHash: operation.originLocalUserBindingHash,
        adoptingLocalUserBindingHash: boundary.localUserBindingHash,
        runtimeStateIdentityHash: boundary.runtimeStateIdentityHash,
        runtimeStateProtectionHash: boundary.runtimeStateProtectionHash,
        runtimeStateBindingHash: boundary.runtimeStateBindingHash,
        dockerPolicySha256: boundary.dockerPolicySha256,
        originManifest,
        adoptingManifest,
      })}\n`,
      "utf8",
    );
    const value = parseHistoryBytes(bytes);
    const adopting = value && verifyHistory(value.adoptingManifest);
    if (
      !value ||
      !hash64(value.originLocalUserBindingHash) ||
      !adopting ||
      !releaseMatchesBoundary(adopting, boundary)
    )
      return null;
    const origin = value && verifyHistory(value.originManifest);
    const current =
      origin && releaseNotAfterBoundary(origin, boundary)
        ? readOriginalOperation(
            historicalBoundary(boundary, origin),
            directoryName,
            true,
            "terminal",
          )
        : null;
    if (
      !current ||
      current.previousRecordSha256 !== operation.previousRecordSha256 ||
      current.sequence !== operation.sequence
    )
      return null;
    if (
      !writeHistoryFile(
        current.operationDirectory,
        HISTORY_ADOPTION_FILE,
        bytes,
      )
    )
      return null;
    return readOperation(boundary, directoryName, verifyHistory);
  } catch {
    return null;
  }
}

export function persistDockerDesktopRepairHistoricalClosure(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
  observation: Readonly<{
    liveRunIdentity: DockerDesktopRepairDirectoryIdentity;
    staleState: "absent" | "retained";
  }>,
  closingManifest: unknown,
  verifyHistory: DockerDesktopRepairHistoryVerifier = verifyPinnedHistory,
): DockerDesktopRepairOperation | null {
  try {
    const current = readOperation(
      boundary,
      `${OPERATION_PREFIX}${operation.operationId}`,
      verifyHistory,
      false,
      true,
    );
    if (current && !settlePublishedHistoryResidues(current.operationDirectory))
      return null;
    if (
      !current?.history ||
      current.history.adoptionSha256 !== operation.history?.adoptionSha256 ||
      current.history.currentSessionBound !== true ||
      !current.history.handoffTipSha256 ||
      current.previousRecordSha256 !== operation.previousRecordSha256 ||
      !validIdentity(observation.liveRunIdentity) ||
      (observation.staleState !== "absent" &&
        observation.staleState !== "retained")
    )
      return null;
    const bytes = Buffer.from(
      `${JSON.stringify({
        schema: HISTORY_ADOPTION_SCHEMA,
        kind: "closure",
        repairId: current.repairId,
        adoptionSha256: current.history.adoptionSha256,
        handoffTipSha256: current.history.handoffTipSha256,
        closingLocalUserBindingHash: boundary.localUserBindingHash,
        liveRunIdentity: observation.liveRunIdentity,
        staleState: observation.staleState,
        closingManifest,
      })}\n`,
      "utf8",
    );
    const value = parseHistoryBytes(bytes);
    const closing = value && verifyHistory(value.closingManifest);
    if (
      !closing ||
      !releaseMatchesBoundary(closing, boundary) ||
      !writeHistoryFile(current.operationDirectory, HISTORY_CLOSURE_FILE, bytes)
    )
      return null;
    return readOperation(
      boundary,
      `${OPERATION_PREFIX}${current.operationId}`,
      verifyHistory,
    );
  } catch {
    return null;
  }
}

export function inventoryDockerDesktopRepairOperations(
  boundary: DockerDesktopRepairRecordBoundary,
  verifyHistory: DockerDesktopRepairHistoryVerifier = verifyPinnedHistory,
) {
  try {
    const names = fs
      .readdirSync(boundary.runtimeStateRoot, { withFileTypes: true })
      .filter((entry) => entry.name.startsWith(OPERATION_PREFIX));
    if (names.length > MAXIMUM_OPERATIONS)
      return Object.freeze({ status: "unknown" as const, operations: [] });
    const operations: DockerDesktopRepairOperation[] = [];
    for (const entry of names) {
      if (!entry.isDirectory())
        return Object.freeze({ status: "unknown" as const, operations: [] });
      const operation = readOperation(boundary, entry.name, verifyHistory);
      if (!operation)
        return Object.freeze({ status: "unknown" as const, operations: [] });
      operations.push(operation);
    }
    return Object.freeze({
      status: "verified" as const,
      operations: Object.freeze(operations),
    });
  } catch {
    return Object.freeze({ status: "unknown" as const, operations: [] });
  }
}

export function canCreateDockerDesktopRepairOperation(
  boundary: DockerDesktopRepairRecordBoundary,
) {
  const inventory = inventoryDockerDesktopRepairOperations(boundary);
  return (
    inventory.status === "verified" &&
    inventory.operations.length < MAXIMUM_OPERATIONS
  );
}

export function hasDockerDesktopRepairRecordCapacity(
  operation: DockerDesktopRepairOperation,
  requiredRecords: number,
) {
  return (
    Number.isSafeInteger(requiredRecords) &&
    requiredRecords >= 0 &&
    MAXIMUM_RECORDS - (operation.sequence + 1) >= requiredRecords
  );
}

export type DockerDesktopRepairResumeClassification = Readonly<{
  state:
    | "manual_block"
    | "stage_only"
    | "observe_current"
    | "next_host_action"
    | "pending"
    | "terminal";
  action:
    | "official_shutdown"
    | "native_termination"
    | "wsl_termination"
    | "runtime_directory_rename"
    | "desktop_launch"
    | null;
  nextStage: DockerDesktopRepairStage | null;
}>;

export function classifyDockerDesktopRepairResume(
  operation: DockerDesktopRepairOperation,
): DockerDesktopRepairResumeClassification {
  const result = (
    state: DockerDesktopRepairResumeClassification["state"],
    action: DockerDesktopRepairResumeClassification["action"] = null,
    nextStage: DockerDesktopRepairStage | null = null,
  ) => Object.freeze({ state, action, nextStage });
  if (operation.history)
    return result(operation.history.closed ? "terminal" : "observe_current");
  if (
    (operation.stage === "no_stale_known_effect_recovery_pending" ||
      operation.stage === "closed_no_stale_known_effect_retained") &&
    (hasUnknownHostEffect(operation.ledger) ||
      hasUnknownReconciliation(operation.ledger))
  )
    return result("manual_block");
  if (
    [
      "closed_retained",
      "closed_no_stale_known_effect_retained",
      "closed_historical_effect_unknown_retained",
    ].includes(operation.stage)
  )
    return result("terminal");
  if (
    [
      "recovered_pending_disposition",
      "no_stale_known_effect_recovery_pending",
      "no_stale_historical_effect_unknown_pending",
    ].includes(operation.stage)
  )
    return result("pending");
  const ledger = operation.ledger;
  const unsettled = [
    ...ledger.processEffects,
    ...ledger.filesystemEffects,
  ].find((entry) => entry.phase === "intent_recorded");
  if (unsettled)
    return result(
      unsettled.action === "runtime_directory_rename"
        ? "observe_current"
        : "manual_block",
    );
  if (hasUnknownReconciliation(ledger)) return result("observe_current");
  if (operation.stage === "prepared") {
    const shutdown = effectEntry(ledger, "official_shutdown");
    const native = effectEntry(ledger, "native_termination");
    const wsl = effectEntry(ledger, "wsl_termination");
    if (!shutdown) return result("next_host_action", "official_shutdown");
    if (!isSettledConfirmed(ledger, "official_shutdown"))
      return result("manual_block");
    if (!native) return result("next_host_action", "native_termination");
    if (
      !isSettledConfirmed(ledger, "native_termination") &&
      !isSettledNotIssued(ledger, "native_termination")
    )
      return result("manual_block");
    if (!wsl) return result("next_host_action", "wsl_termination");
    if (!isSettledConfirmed(ledger, "wsl_termination"))
      return result("manual_block");
    return result("stage_only", null, "processes_stopped");
  }
  if (operation.stage === "processes_stopped") {
    const rename = effectEntry(ledger, "runtime_directory_rename");
    if (!rename) return result("next_host_action", "runtime_directory_rename");
    if (!isSettledConfirmed(ledger, "runtime_directory_rename"))
      return result("manual_block");
    return result("stage_only", null, "renamed");
  }
  if (operation.stage === "renamed") {
    const launch = effectEntry(ledger, "desktop_launch");
    return launch
      ? result("observe_current")
      : result("next_host_action", "desktop_launch");
  }
  return result("manual_block");
}

export function requiredDockerDesktopRepairRecordsThroughSafeStage(
  action: Extract<
    DockerDesktopRepairEffectAction,
    | "official_shutdown"
    | "native_termination"
    | "wsl_termination"
    | "runtime_directory_rename"
    | "desktop_launch"
  >,
) {
  const orderedEffects = [
    "official_shutdown",
    "native_termination",
    "wsl_termination",
    "runtime_directory_rename",
    "desktop_launch",
  ] as const;
  const index = orderedEffects.indexOf(action);
  const remainingEffectRecords = (orderedEffects.length - index) * 2;
  const remainingStageRecords =
    action === "desktop_launch"
      ? 1
      : action === "runtime_directory_rename"
        ? 2
        : 3;
  return remainingEffectRecords + remainingStageRecords;
}

export function createDockerDesktopRepairOperation(
  boundary: DockerDesktopRepairRecordBoundary,
  runIdentity: DockerDesktopRepairDirectoryIdentity,
  ledger: DockerDesktopRepairLedgerSnapshot,
) {
  const id = randomBytes(16).toString("hex");
  return Object.freeze({
    operationId: id,
    repairId: `docker-desktop-repair.${id}`,
    originLocalUserBindingHash: boundary.localUserBindingHash,
    operationDirectory: path.win32.join(
      boundary.runtimeStateRoot,
      `${OPERATION_PREFIX}${id}`,
    ),
    staleName: `run.crdd-stale-${id}`,
    staleDirectory: path.win32.join(
      boundary.localAppData,
      "Docker",
      `run.crdd-stale-${id}`,
    ),
    runIdentity,
    stage: "prepared" as const,
    sequence: -1,
    previousRecordSha256: "0".repeat(64),
    ledger,
  });
}

export function persistDockerDesktopRepairStage(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
  stage: DockerDesktopRepairStage,
  ledger: DockerDesktopRepairLedgerSnapshot,
) {
  if (operation.history) return null;
  try {
    const sequence = operation.sequence + 1;
    const isLedgerValid = validLedger(ledger);
    const isTransitionValid = legalRepairRecordTransition(
      operation.sequence < 0 ? null : operation.stage,
      operation.sequence < 0 ? null : operation.ledger,
      stage,
      ledger,
    );
    if (
      sequence < 0 ||
      sequence >= MAXIMUM_RECORDS ||
      (sequence === 0 && !canCreateDockerDesktopRepairOperation(boundary)) ||
      !isLedgerValid ||
      !isTransitionValid
    )
      return null;
    if (sequence === 0) {
      fs.mkdirSync(operation.operationDirectory, { recursive: false });
      fs.mkdirSync(
        path.win32.join(operation.operationDirectory, "docker-config"),
        {
          recursive: false,
        },
      );
    }
    const record: StoredRecord = Object.freeze({
      schema: DOCKER_DESKTOP_REPAIR_RECORD_SCHEMA,
      contractRevision: 5,
      operationId: operation.operationId,
      sequence,
      stage,
      previousRecordSha256: operation.previousRecordSha256,
      staleName: operation.staleName,
      runIdentity: operation.runIdentity,
      runtimeStateIdentityHash: boundary.runtimeStateIdentityHash,
      runtimeStateProtectionHash: boundary.runtimeStateProtectionHash,
      localUserBindingHash: boundary.localUserBindingHash,
      runtimeStateBindingHash: boundary.runtimeStateBindingHash,
      dockerPolicySha256: boundary.dockerPolicySha256,
      crddManifestHash: boundary.crddManifestHash,
      crddReleaseSequence: boundary.crddReleaseSequence,
      runtimeExecutionIdentitySha256: boundary.runtimeExecutionIdentitySha256,
      ledger,
    });
    const serialized = Buffer.from(`${JSON.stringify(record)}\n`, "utf8");
    const target = path.win32.join(
      operation.operationDirectory,
      `repair-${String(sequence).padStart(2, "0")}-${stage}.json`,
    );
    const temporary = path.win32.join(
      operation.operationDirectory,
      `.crdd-${randomBytes(16).toString("hex")}.tmp`,
    );
    const handle = fs.openSync(temporary, "wx", 0o600);
    try {
      fs.writeFileSync(handle, serialized);
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    const temporaryBytes = stableBytes(temporary);
    if (!temporaryBytes?.equals(serialized)) return null;
    fs.renameSync(temporary, target);
    const committed = stableBytes(target);
    if (!committed?.equals(serialized)) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(committed.toString("utf8"));
    } catch {
      return null;
    }
    if (!validStoredRecord(parsed, boundary)) return null;
    const recordSha256 = createHash("sha256").update(committed).digest("hex");
    return Object.freeze({
      ...operation,
      stage,
      sequence,
      previousRecordSha256: recordSha256,
      ledger,
    });
  } catch {
    return null;
  }
}

export function parseDockerDesktopRepairId(value: unknown) {
  const matched =
    typeof value === "string"
      ? /^docker-desktop-repair\.([a-f0-9]{32})$/u.exec(value)
      : null;
  return matched?.[1] ?? null;
}

export function describeDockerDesktopRepairRecordStoreContract() {
  return Object.freeze({
    schema: DOCKER_DESKTOP_REPAIR_RECORD_SCHEMA,
    operationLimit: MAXIMUM_OPERATIONS,
    recordLimit: MAXIMUM_RECORDS,
    recordBytesLimit: MAXIMUM_RECORD_BYTES,
    exactHashChain: true,
    hostEffectLifecycle: "durable_intent_then_exact_once_settlement",
    recordWriteLifecycle:
      "self_non_recursive_issued_unknown_then_fresh_read_confirmed",
    normalPathRecordCount: 15,
    recoveryMarginRecordCount: 9,
    recordLimitKind: "defensive_hard_cap",
    recoveryMarginIsSemanticReachabilityClaim: false,
    legacyRevisionsAutomaticallyMigrated: false,
    unfinishedOperationBlocksNewRepair: true,
    staleDirectoryDeletion: false,
    closedRetainedRequiresExplicitHumanCommand: true,
  });
}
