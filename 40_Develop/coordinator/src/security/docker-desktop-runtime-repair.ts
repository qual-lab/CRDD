/**
 * docker-desktop-runtime-repairに属する責務をまとめる。
 *
 * @responsibility EngineObservationを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
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
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "./docker-cli-trust.ts";
import { dockerDesktopCurrentArtifactTrustPolicySha256 } from "./docker-desktop-current-artifact-trust.ts";
import {
  createDockerDesktopRepairContinuation,
  type DockerDesktopRepairContinuation,
  type DockerDesktopRepairContinuationAction,
  dockerDesktopRepairContinuationPaths,
  inspectDockerDesktopRepairContinuation,
  persistDockerDesktopRepairContinuationIntent,
  persistDockerDesktopRepairContinuationRecovered,
  persistDockerDesktopRepairContinuationSettlement,
} from "./docker-desktop-repair-continuation-store.ts";
import {
  acquireRuntimeOwnedDockerDesktopRepairNativeHelper,
  type DockerDesktopRepairNativeHelperOutcome,
  type DockerDesktopRepairNativeHelperSession,
} from "./docker-desktop-repair-native-process.ts";
import {
  classifyCanonicalDockerDesktopRepairHistoricalOperation,
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
  parseDockerDesktopRepairId,
  persistDockerDesktopRepairHistoricalAdoption,
  persistDockerDesktopRepairHistoricalClosure,
  persistDockerDesktopRepairStage,
  requiredDockerDesktopRepairRecordsThroughSafeStage,
} from "./docker-desktop-repair-record-store.ts";
import { isDockerRestartEngineReady } from "./docker-restart-machine.ts";
import {
  loadHistoricalReleaseManifestEnvelopeForVerification,
  loadPlatformProvisionerManifestEnvelopeForVerification,
} from "./platform-provisioner-manifest-loader.ts";
import { verifyBundledCoordinatorPackageFromFixedManifestCandidate } from "./platform-provisioner-package-filesystem.ts";

export const DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT =
  "crdd-coordinator/docker-desktop-runtime-repair";
export const DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION = 6;

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
const MAXIMUM_RUNTIME_DIRECTORY_ENTRIES = 64;
const ENGINE_WAIT_ATTEMPTS = 60;
const HOST_EFFECT_ACTION_NAMES = new Set<DockerDesktopRepairEffectAction>([
  "official_shutdown",
  "native_termination",
  "wsl_termination",
  "runtime_directory_rename",
  "desktop_launch",
]);

/**
 * docker-desktop-runtime-repairで使用するEngine Observationの値契約を定義する。
 *
 * @responsibility Engine ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape EngineObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant EngineObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: EngineObservationの宣言は外部境界を開かない。
 * @security EngineObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility EngineObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type EngineObservation = "ready" | "known_unavailable" | "unknown";
/**
 * docker-desktop-runtime-repairで使用するPath Observationの値契約を定義する。
 *
 * @responsibility Path ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape PathObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PathObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: PathObservationの宣言は外部境界を開かない。
 * @security PathObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PathObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PathObservation = Readonly<{
  state: "confirmed_absent" | "present" | "unknown";
  identity: DockerDesktopRepairDirectoryIdentity | null;
}>;
/**
 * docker-desktop-runtime-repairで使用するTagged Effectの値契約を定義する。
 *
 * @responsibility Tagged EffectのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape TaggedEffectが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaggedEffectで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaggedEffectの宣言は外部境界を開かない。
 * @security TaggedEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility TaggedEffectの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaggedEffect = Readonly<{
  issued: boolean | null;
  confirmation: DockerDesktopRepairEffectConfirmation;
}>;
/**
 * docker-desktop-runtime-repairで使用するRename Outcomeの値契約を定義する。
 *
 * @responsibility Rename OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RenameOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RenameOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: RenameOutcomeの宣言は外部境界を開かない。
 * @security RenameOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RenameOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RenameOutcome = Readonly<{
  issued: boolean | null;
  confirmation: DockerDesktopRepairEffectConfirmation;
  staleState: DockerDesktopRepairStaleState;
}>;

/**
 * docker-desktop-runtime-repairで使用するPrepared Boundaryの値契約を定義する。
 *
 * @responsibility Prepared BoundaryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape PreparedBoundaryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PreparedBoundaryで宣言した値と責務の対応を維持する。
 * @boundary N/A: PreparedBoundaryの宣言は外部境界を開かない。
 * @security PreparedBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PreparedBoundaryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type PreparedBoundary = DockerDesktopRepairRecordBoundary &
  Readonly<{
    runDirectory: string;
    socketPath: string;
    platformAccessArtifact: unknown;
    crddManifestHash: string;
    crddReleaseSequence: number;
    runtimeExecutionIdentitySha256: string;
  }>;

/**
 * docker-desktop-runtime-repairで使用するMutable Ledgerの値契約を定義する。
 *
 * @responsibility Mutable LedgerのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape MutableLedgerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant MutableLedgerで宣言した値と責務の対応を維持する。
 * @boundary N/A: MutableLedgerの宣言は外部境界を開かない。
 * @security MutableLedgerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility MutableLedgerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * docker-desktop-runtime-repairで使用するDocker Desktop Runtime Repair Reportの値契約を定義する。
 *
 * @responsibility Docker Desktop Runtime Repair ReportのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRuntimeRepairReportが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRuntimeRepairReportで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRuntimeRepairReportの宣言は外部境界を開かない。
 * @security DockerDesktopRuntimeRepairReportはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRuntimeRepairReportの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * docker-desktop-runtime-repairで使用するRepair Dependenciesの値契約を定義する。
 *
 * @responsibility Repair DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RepairDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepairDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepairDependenciesの宣言は外部境界を開かない。
 * @security RepairDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RepairDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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
  observeRuntimeDirectoryLock?: (
    directory: string,
  ) => DockerDesktopRepairDirectoryIdentity | null;
  persistStage: typeof persistDockerDesktopRepairStage;
  officialShutdown: (
    boundary: PreparedBoundary,
    operation: DockerDesktopRepairOperation,
    session: DockerDesktopRepairNativeHelperSession,
  ) => TaggedEffect | Promise<TaggedEffect>;
  terminateDockerWsl: () => TaggedEffect;
  renameRunDirectory: (
    boundary: PreparedBoundary,
    operation: DockerDesktopRepairOperation,
  ) => RenameOutcome;
  renameRuntimeDirectory?: (
    source: string,
    target: string,
    expectedIdentity: DockerDesktopRepairDirectoryIdentity,
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

/**
 * initial Ledgerを決定する。
 *
 * @responsibility initial Ledgerの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns MutableLedgerを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がinitialLedgerの入力契約を満たす。
 * @postcondition initialLedgerの責務を完了した結果だけを返す。
 * @effect N/A: initialLedgerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: initialLedgerは独自の失敗分岐を所有しない。
 * @invariant initialLedgerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: initialLedgerはProcess内の同一Subsystemで完結する。
 * @security initialLedgerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: initialLedgerは共有非同期状態を持たない同期処理である。
 */
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

/**
 * ledger Fromを決定する。
 *
 * @responsibility ledger Fromの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input operation: DockerDesktopRepairOperation
 * @returns MutableLedgerを返す。
 * @precondition 「operation: DockerDesktopRepairOperation」がledgerFromの入力契約を満たす。
 * @postcondition ledgerFromの責務を完了した結果だけを返す。
 * @effect N/A: ledgerFromは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ledgerFromは独自の失敗分岐を所有しない。
 * @invariant ledgerFromは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ledgerFromはProcess内の同一Subsystemで完結する。
 * @security ledgerFromはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ledgerFromは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Ledgerを回復する。
 *
 * @responsibility Ledgerの回復Identity、再入場条件、回復不能時の境界を所有する。
 * @trace ARCH-000008
 * @input target: MutableLedger、operation: DockerDesktopRepairOperation
 * @returns N/A: restoreLedgerは戻り値を返さない。
 * @precondition 「target: MutableLedger、operation: DockerDesktopRepairOperation」がrestoreLedgerの入力契約を満たす。
 * @postcondition restoreLedgerの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: restoreLedgerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: restoreLedgerは独自の失敗分岐を所有しない。
 * @invariant restoreLedgerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: restoreLedgerはProcess内の同一Subsystemで完結する。
 * @security restoreLedgerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: restoreLedgerは共有非同期状態を持たない同期処理である。
 */
function restoreLedger(
  target: MutableLedger,
  operation: DockerDesktopRepairOperation,
) {
  Object.assign(target, ledgerFrom(operation));
}

/**
 * Ledgerを所有Snapshotへ変換する。
 *
 * @responsibility Ledgerの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input ledger: MutableLedger
 * @returns DockerDesktopRepairLedgerSnapshotを返す。
 * @precondition 「ledger: MutableLedger」がsnapshotLedgerの入力契約を満たす。
 * @postcondition snapshotLedgerの責務を完了した結果だけを返す。
 * @effect N/A: snapshotLedgerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: snapshotLedgerは独自の失敗分岐を所有しない。
 * @invariant snapshotLedgerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotLedgerはProcess内の同一Subsystemで完結する。
 * @security snapshotLedgerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotLedgerは共有非同期状態を持たない同期処理である。
 */
function snapshotLedger(
  ledger: MutableLedger,
): DockerDesktopRepairLedgerSnapshot {
  return Object.freeze({
    ...ledger,
    processEffects: Object.freeze([...ledger.processEffects]),
    filesystemEffects: Object.freeze([...ledger.filesystemEffects]),
  });
}

/**
 * mark Unknownを決定する。
 *
 * @responsibility mark Unknownの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input ledger: MutableLedger
 * @returns N/A: markUnknownは戻り値を返さない。
 * @precondition 「ledger: MutableLedger」がmarkUnknownの入力契約を満たす。
 * @postcondition markUnknownの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: markUnknownは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: markUnknownは独自の失敗分岐を所有しない。
 * @invariant markUnknownは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: markUnknownはProcess内の同一Subsystemで完結する。
 * @security markUnknownはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: markUnknownは共有非同期状態を持たない同期処理である。
 */
function markUnknown(ledger: MutableLedger) {
  ledger.hostSafety = "unknown";
}

/**
 * Issuedを統合する。
 *
 * @responsibility Issuedの統合順序、競合条件、統合結果の境界を所有する。
 * @trace ARCH-000008
 * @input isCurrent: boolean | null、isObserved: boolean | null
 * @returns boolean | nullを返す。
 * @precondition 「isCurrent: boolean | null、isObserved: boolean | null」がmergeIssuedの入力契約を満たす。
 * @postcondition mergeIssuedの責務を完了した結果だけを返す。
 * @effect N/A: mergeIssuedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: mergeIssuedは独自の失敗分岐を所有しない。
 * @invariant mergeIssuedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: mergeIssuedはProcess内の同一Subsystemで完結する。
 * @security mergeIssuedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: mergeIssuedは共有非同期状態を持たない同期処理である。
 */
function mergeIssued(
  isCurrent: boolean | null,
  isObserved: boolean | null,
): boolean | null {
  if (isCurrent === true || isObserved === true) return true;
  if (isCurrent === null || isObserved === null) return null;
  return false;
}

/**
 * refresh Effect Aggregateを決定する。
 *
 * @responsibility refresh Effect Aggregateの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input ledger: MutableLedger、kind: "process" | "filesystem"
 * @returns N/A: refreshEffectAggregateは戻り値を返さない。
 * @precondition 「ledger: MutableLedger、kind: "process" | "filesystem"」がrefreshEffectAggregateの入力契約を満たす。
 * @postcondition refreshEffectAggregateの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: refreshEffectAggregateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: refreshEffectAggregateは独自の失敗分岐を所有しない。
 * @invariant refreshEffectAggregateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: refreshEffectAggregateはProcess内の同一Subsystemで完結する。
 * @security refreshEffectAggregateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: refreshEffectAggregateは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Effectを追記する。
 *
 * @responsibility Effectの追記対象、順序、書込み失敗境界を所有する。
 * @trace ARCH-000008
 * @input ledger: MutableLedger、kind: "process" | "filesystem"、action: DockerDesktopRepairEffectAction、observed: TaggedEffect
 * @returns N/A: appendEffectは戻り値を返さない。
 * @precondition 「ledger: MutableLedger、kind: "process" | "filesystem"、action: DockerDesktopRepairEffectAction、observed: TaggedEffect」がappendEffectの入力契約を満たす。
 * @postcondition appendEffectの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: appendEffectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: appendEffectは独自の失敗分岐を所有しない。
 * @invariant appendEffectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: appendEffectはProcess内の同一Subsystemで完結する。
 * @security appendEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: appendEffectは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Process Effectを統合する。
 *
 * @responsibility Process Effectの統合順序、競合条件、統合結果の境界を所有する。
 * @trace ARCH-000008
 * @input ledger: MutableLedger、action: DockerDesktopRepairEffectAction、observed: TaggedEffect
 * @returns N/A: mergeProcessEffectは戻り値を返さない。
 * @precondition 「ledger: MutableLedger、action: DockerDesktopRepairEffectAction、observed: TaggedEffect」がmergeProcessEffectの入力契約を満たす。
 * @postcondition mergeProcessEffectの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: mergeProcessEffectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: mergeProcessEffectは独自の失敗分岐を所有しない。
 * @invariant mergeProcessEffectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: mergeProcessEffectはProcess内の同一Subsystemで完結する。
 * @security mergeProcessEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: mergeProcessEffectは共有非同期状態を持たない同期処理である。
 */
function mergeProcessEffect(
  ledger: MutableLedger,
  action: DockerDesktopRepairEffectAction,
  observed: TaggedEffect,
) {
  appendEffect(ledger, "process", action, observed);
}

/**
 * Filesystem Effectを統合する。
 *
 * @responsibility Filesystem Effectの統合順序、競合条件、統合結果の境界を所有する。
 * @trace ARCH-000008
 * @input ledger: MutableLedger、action: DockerDesktopRepairEffectAction、observed: TaggedEffect
 * @returns N/A: mergeFilesystemEffectは戻り値を返さない。
 * @precondition 「ledger: MutableLedger、action: DockerDesktopRepairEffectAction、observed: TaggedEffect」がmergeFilesystemEffectの入力契約を満たす。
 * @postcondition mergeFilesystemEffectの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: mergeFilesystemEffectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: mergeFilesystemEffectは独自の失敗分岐を所有しない。
 * @invariant mergeFilesystemEffectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: mergeFilesystemEffectはProcess内の同一Subsystemで完結する。
 * @security mergeFilesystemEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: mergeFilesystemEffectは共有非同期状態を持たない同期処理である。
 */
function mergeFilesystemEffect(
  ledger: MutableLedger,
  action: DockerDesktopRepairEffectAction,
  observed: TaggedEffect,
) {
  appendEffect(ledger, "filesystem", action, observed);
}

/**
 * record Host Effect Intentを決定する。
 *
 * @responsibility record Host Effect Intentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input ledger: MutableLedger、kind: "process" | "filesystem"、action: DockerDesktopRepairEffectAction
 * @returns recordHostEffectIntentの計算結果を返す。
 * @precondition 「ledger: MutableLedger、kind: "process" | "filesystem"、action: DockerDesktopRepairEffectAction」がrecordHostEffectIntentの入力契約を満たす。
 * @postcondition recordHostEffectIntentの責務を完了した結果だけを返す。
 * @effect N/A: recordHostEffectIntentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recordHostEffectIntentは独自の失敗分岐を所有しない。
 * @invariant recordHostEffectIntentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recordHostEffectIntentはProcess内の同一Subsystemで完結する。
 * @security recordHostEffectIntentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recordHostEffectIntentは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Host Effectを終端状態へ確定する。
 *
 * @responsibility Host Effectの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000008
 * @input ledger: MutableLedger、kind: "process" | "filesystem"、action: DockerDesktopRepairEffectAction、observed: TaggedEffect
 * @returns settleHostEffectの計算結果を返す。
 * @precondition 「ledger: MutableLedger、kind: "process" | "filesystem"、action: DockerDesktopRepairEffectAction、observed: TaggedEffect」がsettleHostEffectの入力契約を満たす。
 * @postcondition settleHostEffectの責務を完了した結果だけを返す。
 * @effect N/A: settleHostEffectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: settleHostEffectは独自の失敗分岐を所有しない。
 * @invariant settleHostEffectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: settleHostEffectはProcess内の同一Subsystemで完結する。
 * @security settleHostEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleHostEffectは共有非同期状態を持たない同期処理である。
 */
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

/**
 * docker-desktop-runtime-repairを診断結果として報告する。
 *
 * @responsibility docker-desktop-runtime-repairの公開field、相関Identity、機密を含めない結果境界を所有する。
 * @trace ARCH-000008
 * @input status: DockerDesktopRuntimeRepairReport["status"]、reason: string、ledger: MutableLedger、operation: DockerDesktopRepairOperation | null、nativeHelperCleanupConfirmed: boolean | null、isNewRepairPermitted
 * @returns DockerDesktopRuntimeRepairReportを返す。
 * @precondition 「status: DockerDesktopRuntimeRepairReport["status"]、reason: string、ledger: MutableLedger、operation: DockerDesktopRepairOperation | null、nativeHelperCleanupConfirmed: boolean | null、isNewRepairPermitted」がreportの入力契約を満たす。
 * @postcondition reportの責務を完了した結果だけを返す。
 * @effect N/A: reportは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reportは独自の失敗分岐を所有しない。
 * @invariant reportは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reportはProcess内の同一Subsystemで完結する。
 * @security reportはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reportは共有非同期状態を持たない同期処理である。
 */
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

/**
 * identityを決定する。
 *
 * @responsibility identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input metadata: fs.BigIntStats
 * @returns DockerDesktopRepairDirectoryIdentity | nullを返す。
 * @precondition 「metadata: fs.BigIntStats」がidentityの入力契約を満たす。
 * @postcondition identityの責務を完了した結果だけを返す。
 * @effect N/A: identityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: identityは独自の失敗分岐を所有しない。
 * @invariant identityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identityはProcess内の同一Subsystemで完結する。
 * @security identityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identityは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Pathを観測する。
 *
 * @responsibility Pathの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns PathObservationを返す。
 * @precondition 「target: string」がobservePathの入力契約を満たす。
 * @postcondition observePathの責務を完了した結果だけを返す。
 * @effect observePathはFilesystemの読取りまたは書込みを実行する。
 * @failure observePathは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observePathは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observePathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observePathは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Path Usingを観測する。
 *
 * @responsibility Path Usingの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、target: string
 * @returns PathObservationを返す。
 * @precondition 「dependencies: RepairDependencies、target: string」がobservePathUsingの入力契約を満たす。
 * @postcondition observePathUsingの責務を完了した結果だけを返す。
 * @effect N/A: observePathUsingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observePathUsingは独自の失敗分岐を所有しない。
 * @invariant observePathUsingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observePathUsingはProcess内の同一Subsystemで完結する。
 * @security observePathUsingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observePathUsingは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Identityが同一かを判定する。
 *
 * @responsibility Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000008
 * @input left: DockerDesktopRepairDirectoryIdentity、right: DockerDesktopRepairDirectoryIdentity
 * @returns sameIdentityの計算結果を返す。
 * @precondition 「left: DockerDesktopRepairDirectoryIdentity、right: DockerDesktopRepairDirectoryIdentity」がsameIdentityの入力契約を満たす。
 * @postcondition sameIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameIdentityは独自の失敗分岐を所有しない。
 * @invariant sameIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameIdentityはProcess内の同一Subsystemで完結する。
 * @security sameIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameIdentityは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Prepared Authorityが同一かを判定する。
 *
 * @responsibility Prepared Authorityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000008
 * @input left: PreparedBoundary、right: PreparedBoundary
 * @returns samePreparedAuthorityの計算結果を返す。
 * @precondition 「left: PreparedBoundary、right: PreparedBoundary」がsamePreparedAuthorityの入力契約を満たす。
 * @postcondition samePreparedAuthorityの責務を完了した結果だけを返す。
 * @effect N/A: samePreparedAuthorityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: samePreparedAuthorityは独自の失敗分岐を所有しない。
 * @invariant samePreparedAuthorityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: samePreparedAuthorityはProcess内の同一Subsystemで完結する。
 * @security samePreparedAuthorityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: samePreparedAuthorityは共有非同期状態を持たない同期処理である。
 */
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

/**
 * identity Atを決定する。
 *
 * @responsibility identity Atの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns identityAtの計算結果を返す。
 * @precondition 「target: string」がidentityAtの入力契約を満たす。
 * @postcondition identityAtの責務を完了した結果だけを返す。
 * @effect identityAtはFilesystemの読取りまたは書込みを実行する。
 * @failure identityAtは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant identityAtは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security identityAtはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identityAtは共有非同期状態を持たない同期処理である。
 */
function identityAt(target: string) {
  try {
    return identity(fs.lstatSync(target, { bigint: true }));
  } catch {
    return null;
  }
}

/**
 * prepared Boundaryを決定する。
 *
 * @responsibility prepared Boundaryの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns PreparedBoundary | nullを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がpreparedBoundaryの入力契約を満たす。
 * @postcondition preparedBoundaryの責務を完了した結果だけを返す。
 * @effect preparedBoundaryは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: preparedBoundaryは独自の失敗分岐を所有しない。
 * @invariant preparedBoundaryは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security preparedBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: preparedBoundaryは共有非同期状態を持たない同期処理である。
 */
function preparedBoundary(): PreparedBoundary | null {
  if (process.platform !== "win32") return null;
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
    dockerPolicySha256: dockerDesktopCurrentArtifactTrustPolicySha256,
    crddManifestHash: packageVerification.manifestHash,
    crddReleaseSequence: packageVerification.releaseSequence as number,
    runtimeExecutionIdentitySha256:
      packageVerification.runtimeExecutionIdentitySha256,
    localAppData,
    runDirectory,
    socketPath: path.win32.join(runDirectory, "dockerInference"),
    platformAccessArtifact: packageVerification.platformAccessArtifact,
  });
}

/**
 * Current Trusted Docker Cliを観測する。
 *
 * @responsibility Current Trusted Docker Cliの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns observeCurrentTrustedDockerCliの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がobserveCurrentTrustedDockerCliの入力契約を満たす。
 * @postcondition observeCurrentTrustedDockerCliの責務を完了した結果だけを返す。
 * @effect N/A: observeCurrentTrustedDockerCliは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeCurrentTrustedDockerCliは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeCurrentTrustedDockerCliは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeCurrentTrustedDockerCliはProcess内の同一Subsystemで完結する。
 * @security observeCurrentTrustedDockerCliはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeCurrentTrustedDockerCliは共有非同期状態を持たない同期処理である。
 */
function observeCurrentTrustedDockerCli() {
  try {
    return observeTrustedDockerCli();
  } catch {
    return null;
  }
}

/**
 * Known Unavailable Docker Server 出力かを判定する。
 *
 * @responsibility Known Unavailable Docker Server 出力の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input stdout: string
 * @returns isKnownUnavailableDockerServerOutputの計算結果を返す。
 * @precondition 「stdout: string」がisKnownUnavailableDockerServerOutputの入力契約を満たす。
 * @postcondition isKnownUnavailableDockerServerOutputの責務を完了した結果だけを返す。
 * @effect N/A: isKnownUnavailableDockerServerOutputは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isKnownUnavailableDockerServerOutputは独自の失敗分岐を所有しない。
 * @invariant isKnownUnavailableDockerServerOutputは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isKnownUnavailableDockerServerOutputはProcess内の同一Subsystemで完結する。
 * @security isKnownUnavailableDockerServerOutputはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isKnownUnavailableDockerServerOutputは共有非同期状態を持たない同期処理である。
 */
function isKnownUnavailableDockerServerOutput(stdout: string) {
  return (
    stdout === "" ||
    stdout === "\n" ||
    stdout === "\r\n" ||
    stdout === "null" ||
    stdout === "null\n" ||
    stdout === "null\r\n"
  );
}

/**
 * Engineを観測する。
 *
 * @responsibility Engineの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input boundary: PreparedBoundary
 * @returns EngineObservationを返す。
 * @precondition 「boundary: PreparedBoundary」がobserveEngineの入力契約を満たす。
 * @postcondition observeEngineの責務を完了した結果だけを返す。
 * @effect observeEngineはFilesystemの読取りまたは書込みを実行する。
 * @failure observeEngineは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeEngineは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observeEngineはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeEngineは共有非同期状態を持たない同期処理である。
 */
function observeEngine(boundary: PreparedBoundary): EngineObservation {
  const environment = createWindowsDockerCliEnvironment({
    dockerConfig: boundary.runtimeStateRoot,
    dockerHome: boundary.runtimeStateRoot,
  });
  if (!environment) return "unknown";
  const cli = observeCurrentTrustedDockerCli();
  if (!cli) return "unknown";
  const result = spawnSync(
    cli.executablePath,
    [
      "--host",
      DOCKER_ENGINE,
      "--config",
      boundary.runtimeStateRoot,
      "version",
      "--format",
      "{{json .Server}}",
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
  try {
    verifyTrustedDockerCliSnapshot(cli);
  } catch {
    return "unknown";
  }
  if (isDockerRestartEngineReady(result)) return "ready";
  return observeDockerDesktopUnavailableResult(result, () => {
    const handle = fs.openSync(DOCKER_ENGINE_PIPE, "r+");
    fs.closeSync(handle);
  });
}

/**
 * Docker Desktop Unavailable 結果を観測する。
 *
 * @responsibility Docker Desktop Unavailable 結果の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input result: Readonly<{ pid: number | undefined; error?: Error | undefined; signal: NodeJS.Signals | null; status: number | null; stdout: unknown; }>、probeEnginePipe: () => void
 * @returns EngineObservationを返す。
 * @precondition 「result: Readonly<{ pid: number | undefined; error?: Error | undefined; signal: NodeJS.Signals | null; status: number | null; stdout: unknown; }>、probeEnginePipe: () => void」がobserveDockerDesktopUnavailableResultの入力契約を満たす。
 * @postcondition observeDockerDesktopUnavailableResultの責務を完了した結果だけを返す。
 * @effect N/A: observeDockerDesktopUnavailableResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeDockerDesktopUnavailableResultは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeDockerDesktopUnavailableResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeDockerDesktopUnavailableResultはProcess内の同一Subsystemで完結する。
 * @security observeDockerDesktopUnavailableResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeDockerDesktopUnavailableResultは共有非同期状態を持たない同期処理である。
 */
function observeDockerDesktopUnavailableResult(
  result: Readonly<{
    pid: number | undefined;
    error?: Error | undefined;
    signal: NodeJS.Signals | null;
    status: number | null;
    stdout: unknown;
  }>,
  probeEnginePipe: () => void,
): EngineObservation {
  if (
    result.pid === undefined ||
    result.error ||
    result.signal !== null ||
    result.status === null ||
    result.status === 0 ||
    typeof result.stdout !== "string" ||
    !isKnownUnavailableDockerServerOutput(result.stdout)
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

/**
 * Docker Desktop Engine 結果を観測する。
 *
 * @responsibility Docker Desktop Engine 結果の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input result: Readonly<{ pid: number | undefined; error?: Error | undefined; signal: NodeJS.Signals | null; status: number | null; stdout: unknown; stderr: unknown; }>、expectedEngineVersion: string、probeEnginePipe: () => void
 * @returns EngineObservationを返す。
 * @precondition 「result: Readonly<{ pid: number | undefined; error?: Error | undefined; signal: NodeJS.Signals | null; status: number | null; stdout: unknown; stderr: unknown; }>、expectedEngineVersion: string、probeEnginePipe: () => void」がobserveDockerDesktopEngineResultの入力契約を満たす。
 * @postcondition observeDockerDesktopEngineResultの責務を完了した結果だけを返す。
 * @effect N/A: observeDockerDesktopEngineResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeDockerDesktopEngineResultは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeDockerDesktopEngineResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeDockerDesktopEngineResultはProcess内の同一Subsystemで完結する。
 * @security observeDockerDesktopEngineResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeDockerDesktopEngineResultは共有非同期状態を持たない同期処理である。
 */
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
    !isKnownUnavailableDockerServerOutput(result.stdout)
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

/**
 * docker-desktop-runtime-repairで使用するRuntime Directory Entry Observationの値契約を定義する。
 *
 * @responsibility Runtime Directory Entry ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeDirectoryEntryObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDirectoryEntryObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDirectoryEntryObservationの宣言は外部境界を開かない。
 * @security RuntimeDirectoryEntryObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDirectoryEntryObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeDirectoryEntryObservation = Readonly<{
  name: string;
  isDirectory: boolean;
  isSymbolicLink: boolean;
}>;

/**
 * docker-desktop-runtime-repairで使用するRuntime Directory Lock Observation Dependenciesの値契約を定義する。
 *
 * @responsibility Runtime Directory Lock Observation DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeDirectoryLockObservationDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDirectoryLockObservationDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDirectoryLockObservationDependenciesの宣言は外部境界を開かない。
 * @security RuntimeDirectoryLockObservationDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDirectoryLockObservationDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeDirectoryLockObservationDependencies = Readonly<{
  identityAt: (target: string) => DockerDesktopRepairDirectoryIdentity | null;
  readEntries: (
    directory: string,
  ) => readonly RuntimeDirectoryEntryObservation[];
  probeEntry: (target: string) => void;
}>;

/**
 * Runtime Directory Entriesが同一かを判定する。
 *
 * @responsibility Runtime Directory Entriesの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000008
 * @input beforeEntries: readonly RuntimeDirectoryEntryObservation[]、afterEntries: readonly RuntimeDirectoryEntryObservation[]
 * @returns sameRuntimeDirectoryEntriesの計算結果を返す。
 * @precondition 「beforeEntries: readonly RuntimeDirectoryEntryObservation[]、afterEntries: readonly RuntimeDirectoryEntryObservation[]」がsameRuntimeDirectoryEntriesの入力契約を満たす。
 * @postcondition sameRuntimeDirectoryEntriesの責務を完了した結果だけを返す。
 * @effect N/A: sameRuntimeDirectoryEntriesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameRuntimeDirectoryEntriesは独自の失敗分岐を所有しない。
 * @invariant sameRuntimeDirectoryEntriesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameRuntimeDirectoryEntriesはProcess内の同一Subsystemで完結する。
 * @security sameRuntimeDirectoryEntriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameRuntimeDirectoryEntriesは共有非同期状態を持たない同期処理である。
 */
function sameRuntimeDirectoryEntries(
  beforeEntries: readonly RuntimeDirectoryEntryObservation[],
  afterEntries: readonly RuntimeDirectoryEntryObservation[],
) {
  if (beforeEntries.length !== afterEntries.length) return false;
  return beforeEntries.every(
    (entry, index) =>
      entry.name === afterEntries[index]?.name &&
      entry.isDirectory === afterEntries[index]?.isDirectory &&
      entry.isSymbolicLink === afterEntries[index]?.isSymbolicLink,
  );
}

/**
 * Runtime Directory Entryが有効か判定する。
 *
 * @responsibility Runtime Directory Entryの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input entry: RuntimeDirectoryEntryObservation
 * @returns validRuntimeDirectoryEntryの計算結果を返す。
 * @precondition 「entry: RuntimeDirectoryEntryObservation」がvalidRuntimeDirectoryEntryの入力契約を満たす。
 * @postcondition validRuntimeDirectoryEntryの責務を完了した結果だけを返す。
 * @effect N/A: validRuntimeDirectoryEntryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRuntimeDirectoryEntryは独自の失敗分岐を所有しない。
 * @invariant validRuntimeDirectoryEntryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRuntimeDirectoryEntryはProcess内の同一Subsystemで完結する。
 * @security validRuntimeDirectoryEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validRuntimeDirectoryEntryは共有非同期状態を持たない同期処理である。
 */
function validRuntimeDirectoryEntry(entry: RuntimeDirectoryEntryObservation) {
  return (
    entry.name.length > 0 &&
    entry.name.length <= 255 &&
    entry.name !== "." &&
    entry.name !== ".." &&
    !entry.name.includes("/") &&
    !entry.name.includes("\\") &&
    !entry.isDirectory
  );
}

/**
 * Docker Desktop Runtime Directory Lock Using Dependenciesを観測する。
 *
 * @responsibility Docker Desktop Runtime Directory Lock Using Dependenciesの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input boundary: PreparedBoundary、dependencies: RuntimeDirectoryLockObservationDependencies
 * @returns observeDockerDesktopRuntimeDirectoryLockUsingDependenciesの計算結果を返す。
 * @precondition 「boundary: PreparedBoundary、dependencies: RuntimeDirectoryLockObservationDependencies」がobserveDockerDesktopRuntimeDirectoryLockUsingDependenciesの入力契約を満たす。
 * @postcondition observeDockerDesktopRuntimeDirectoryLockUsingDependenciesの責務を完了した結果だけを返す。
 * @effect N/A: observeDockerDesktopRuntimeDirectoryLockUsingDependenciesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeDockerDesktopRuntimeDirectoryLockUsingDependenciesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeDockerDesktopRuntimeDirectoryLockUsingDependenciesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeDockerDesktopRuntimeDirectoryLockUsingDependenciesはProcess内の同一Subsystemで完結する。
 * @security observeDockerDesktopRuntimeDirectoryLockUsingDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeDockerDesktopRuntimeDirectoryLockUsingDependenciesは共有非同期状態を持たない同期処理である。
 */
export function observeDockerDesktopRuntimeDirectoryLockUsingDependencies(
  boundary: PreparedBoundary,
  dependencies: RuntimeDirectoryLockObservationDependencies,
) {
  try {
    const beforeIdentity = dependencies.identityAt(boundary.runDirectory);
    if (!beforeIdentity) return null;
    const beforeEntries = [...dependencies.readEntries(boundary.runDirectory)]
      .map((entry) => Object.freeze({ ...entry }))
      .sort((left, right) => left.name.localeCompare(right.name, "en-US"));
    if (
      beforeEntries.length === 0 ||
      beforeEntries.length > MAXIMUM_RUNTIME_DIRECTORY_ENTRIES ||
      beforeEntries.some((entry) => !validRuntimeDirectoryEntry(entry))
    )
      return null;
    let wasLockObserved = false;
    for (const entry of beforeEntries) {
      try {
        dependencies.probeEntry(
          path.win32.join(boundary.runDirectory, entry.name),
        );
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "";
        if (!knownSocketErrorCodes.has(code)) return null;
        wasLockObserved = true;
      }
    }
    const afterEntries = [...dependencies.readEntries(boundary.runDirectory)]
      .map((entry) => Object.freeze({ ...entry }))
      .sort((left, right) => left.name.localeCompare(right.name, "en-US"));
    const afterIdentity = dependencies.identityAt(boundary.runDirectory);
    return wasLockObserved &&
      afterIdentity &&
      sameIdentity(beforeIdentity, afterIdentity) &&
      sameRuntimeDirectoryEntries(beforeEntries, afterEntries)
      ? beforeIdentity
      : null;
  } catch {
    return null;
  }
}

/**
 * Known Socket 失敗を観測する。
 *
 * @responsibility Known Socket 失敗の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input boundary: PreparedBoundary
 * @returns observeKnownSocketFailureの計算結果を返す。
 * @precondition 「boundary: PreparedBoundary」がobserveKnownSocketFailureの入力契約を満たす。
 * @postcondition observeKnownSocketFailureの責務を完了した結果だけを返す。
 * @effect observeKnownSocketFailureはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: observeKnownSocketFailureは独自の失敗分岐を所有しない。
 * @invariant observeKnownSocketFailureは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observeKnownSocketFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeKnownSocketFailureは共有非同期状態を持たない同期処理である。
 */
function observeKnownSocketFailure(boundary: PreparedBoundary) {
  return observeDockerDesktopRuntimeDirectoryLockUsingDependencies(boundary, {
    identityAt,
    readEntries: (directory) =>
      fs.readdirSync(directory, { withFileTypes: true }).map((entry) =>
        Object.freeze({
          name: entry.name,
          isDirectory: entry.isDirectory(),
          isSymbolicLink: entry.isSymbolicLink(),
        }),
      ),
    probeEntry: (target) => {
      // Windows AF_UNIX endpoints used by Docker Desktop can be reported by
      // Dirent as symbolic-link-like entries while lstat/open are denied by
      // the live endpoint.  We therefore never follow them for metadata here;
      // the exact parent identity, bounded stable entry set and known access
      // denial together form the observation.
      const handle = fs.openSync(target, "r");
      fs.closeSync(handle);
    },
  });
}

/**
 * Runtime Directory Lockを観測する。
 *
 * @responsibility Runtime Directory Lockの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input directory: string
 * @returns observeRuntimeDirectoryLockの計算結果を返す。
 * @precondition 「directory: string」がobserveRuntimeDirectoryLockの入力契約を満たす。
 * @postcondition observeRuntimeDirectoryLockの責務を完了した結果だけを返す。
 * @effect observeRuntimeDirectoryLockはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: observeRuntimeDirectoryLockは独自の失敗分岐を所有しない。
 * @invariant observeRuntimeDirectoryLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observeRuntimeDirectoryLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeRuntimeDirectoryLockは共有非同期状態を持たない同期処理である。
 */
function observeRuntimeDirectoryLock(directory: string) {
  return observeDockerDesktopRuntimeDirectoryLockUsingDependencies(
    { runDirectory: directory } as PreparedBoundary,
    {
      identityAt,
      readEntries: (targetDirectory) =>
        fs.readdirSync(targetDirectory, { withFileTypes: true }).map((entry) =>
          Object.freeze({
            name: entry.name,
            isDirectory: entry.isDirectory(),
            isSymbolicLink: entry.isSymbolicLink(),
          }),
        ),
      probeEntry: (target) => {
        const handle = fs.openSync(target, "r");
        fs.closeSync(handle);
      },
    },
  );
}

/**
 * official Shutdownを決定する。
 *
 * @responsibility official Shutdownの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input _boundary: PreparedBoundary、_operation: DockerDesktopRepairOperation、session: DockerDesktopRepairNativeHelperSession
 * @returns Promise<TaggedEffect>を返す。
 * @precondition 「_boundary: PreparedBoundary、_operation: DockerDesktopRepairOperation、session: DockerDesktopRepairNativeHelperSession」がofficialShutdownの入力契約を満たす。
 * @postcondition officialShutdownの責務を完了した結果だけを返す。
 * @effect N/A: officialShutdownは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: officialShutdownは独自の失敗分岐を所有しない。
 * @invariant officialShutdownは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: officialShutdownはProcess内の同一Subsystemで完結する。
 * @security officialShutdownはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency officialShutdownは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function officialShutdown(
  _boundary: PreparedBoundary,
  _operation: DockerDesktopRepairOperation,
  session: DockerDesktopRepairNativeHelperSession,
): Promise<TaggedEffect> {
  if (!("stopDesktop" in session) || typeof session.stopDesktop !== "function")
    return Object.freeze({ issued: false, confirmation: "not_issued" });
  const result = await session.stopDesktop();
  return Object.freeze({
    issued: result !== "not_issued",
    confirmation:
      result === "not_issued"
        ? "not_issued"
        : result === "command_completed"
          ? "confirmed"
          : "unknown",
  });
}

/**
 * Docker Wslを終了させる。
 *
 * @responsibility Docker Wslの終了Authority、対象Process、終了確認境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns TaggedEffectを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がterminateDockerWslの入力契約を満たす。
 * @postcondition terminateDockerWslの責務を完了した結果だけを返す。
 * @effect terminateDockerWslは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: terminateDockerWslは独自の失敗分岐を所有しない。
 * @invariant terminateDockerWslは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security terminateDockerWslはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: terminateDockerWslは共有非同期状態を持たない同期処理である。
 */
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

/**
 * rename Run Directoryを決定する。
 *
 * @responsibility rename Run Directoryの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input boundary: PreparedBoundary、operation: DockerDesktopRepairOperation
 * @returns RenameOutcomeを返す。
 * @precondition 「boundary: PreparedBoundary、operation: DockerDesktopRepairOperation」がrenameRunDirectoryの入力契約を満たす。
 * @postcondition renameRunDirectoryの責務を完了した結果だけを返す。
 * @effect renameRunDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure renameRunDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant renameRunDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security renameRunDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: renameRunDirectoryは共有非同期状態を持たない同期処理である。
 */
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

/**
 * rename Runtime Directoryを決定する。
 *
 * @responsibility rename Runtime Directoryの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input source: string、target: string、expectedIdentity: DockerDesktopRepairDirectoryIdentity
 * @returns RenameOutcomeを返す。
 * @precondition 「source: string、target: string、expectedIdentity: DockerDesktopRepairDirectoryIdentity」がrenameRuntimeDirectoryの入力契約を満たす。
 * @postcondition renameRuntimeDirectoryの責務を完了した結果だけを返す。
 * @effect renameRuntimeDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure renameRuntimeDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant renameRuntimeDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security renameRuntimeDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: renameRuntimeDirectoryは共有非同期状態を持たない同期処理である。
 */
function renameRuntimeDirectory(
  source: string,
  target: string,
  expectedIdentity: DockerDesktopRepairDirectoryIdentity,
): RenameOutcome {
  try {
    const before = observePath(source);
    const stale = observePath(target);
    if (
      before.state !== "present" ||
      !before.identity ||
      !sameIdentity(before.identity, expectedIdentity) ||
      stale.state !== "confirmed_absent"
    )
      return Object.freeze({
        issued: stale.state === "present" ? false : null,
        confirmation: stale.state === "present" ? "not_issued" : "unknown",
        staleState: "unknown" as const,
      });
    fs.renameSync(source, target);
    const after = observePath(target);
    const original = observePath(source);
    const confirmed =
      after.state === "present" &&
      after.identity !== null &&
      sameIdentity(after.identity, expectedIdentity) &&
      original.state === "confirmed_absent";
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

/**
 * Engineを完了まで待機する。
 *
 * @responsibility Engineの待機条件、完了観測、Timeout境界を所有する。
 * @trace ARCH-000008
 * @input boundary: PreparedBoundary、shouldStop: () => boolean、stopDetected: Promise<void>
 * @returns Promise<EngineObservation>を返す。
 * @precondition 「boundary: PreparedBoundary、shouldStop: () => boolean、stopDetected: Promise<void>」がawaitEngineの入力契約を満たす。
 * @postcondition awaitEngineの責務を完了した結果だけを返す。
 * @effect N/A: awaitEngineは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: awaitEngineは独自の失敗分岐を所有しない。
 * @invariant awaitEngineは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: awaitEngineはProcess内の同一Subsystemで完結する。
 * @security awaitEngineはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency awaitEngineは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * docker-desktop-runtime-repairを耐久保存する。
 *
 * @responsibility docker-desktop-runtime-repairの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、operation: DockerDesktopRepairOperation、stage: Parameters<RepairDependencies["persistStage"]>[2]、ledger: MutableLedger
 * @returns persistの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、operation: DockerDesktopRepairOperation、stage: Parameters<RepairDependencies["persistStage"]>[2]、ledger: MutableLedger」がpersistの入力契約を満たす。
 * @postcondition persistの責務を完了した結果だけを返す。
 * @effect N/A: persistは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: persistは独自の失敗分岐を所有しない。
 * @invariant persistは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: persistはProcess内の同一Subsystemで完結する。
 * @security persistはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: persistは共有非同期状態を持たない同期処理である。
 */
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

/**
 * inventory 状態を決定する。
 *
 * @responsibility inventory 状態の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary
 * @returns inventoryStateの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary」がinventoryStateの入力契約を満たす。
 * @postcondition inventoryStateの責務を完了した結果だけを返す。
 * @effect inventoryStateはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: inventoryStateは独自の失敗分岐を所有しない。
 * @invariant inventoryStateは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inventoryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inventoryStateは共有非同期状態を持たない同期処理である。
 */
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

/**
 * durable Inventory 状態を決定する。
 *
 * @responsibility durable Inventory 状態の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary
 * @returns durableInventoryStateの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary」がdurableInventoryStateの入力契約を満たす。
 * @postcondition durableInventoryStateの責務を完了した結果だけを返す。
 * @effect N/A: durableInventoryStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: durableInventoryStateは独自の失敗分岐を所有しない。
 * @invariant durableInventoryStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: durableInventoryStateはProcess内の同一Subsystemで完結する。
 * @security durableInventoryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: durableInventoryStateは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Process Cancellationを登録する。
 *
 * @responsibility Process Cancellationの登録条件、Identity、一意性境界を所有する。
 * @trace ARCH-000008
 * @input listener: () => void
 * @returns registerProcessCancellationの計算結果を返す。
 * @precondition 「listener: () => void」がregisterProcessCancellationの入力契約を満たす。
 * @postcondition registerProcessCancellationの責務を完了した結果だけを返す。
 * @effect registerProcessCancellationは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: registerProcessCancellationは独自の失敗分岐を所有しない。
 * @invariant registerProcessCancellationは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security registerProcessCancellationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: registerProcessCancellationは共有非同期状態を持たない同期処理である。
 */
function registerProcessCancellation(listener: () => void) {
  process.once("SIGINT", listener);
  process.once("SIGTERM", listener);
  return () => {
    process.removeListener("SIGINT", listener);
    process.removeListener("SIGTERM", listener);
  };
}

/**
 * attach Cancellationを決定する。
 *
 * @responsibility attach Cancellationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input session: DockerDesktopRepairNativeHelperSession、registerCancellation
 * @returns attachCancellationの計算結果を返す。
 * @precondition 「session: DockerDesktopRepairNativeHelperSession、registerCancellation」がattachCancellationの入力契約を満たす。
 * @postcondition attachCancellationの責務を完了した結果だけを返す。
 * @effect N/A: attachCancellationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: attachCancellationは独自の失敗分岐を所有しない。
 * @invariant attachCancellationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: attachCancellationはProcess内の同一Subsystemで完結する。
 * @security attachCancellationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency attachCancellationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * docker-desktop-runtime-repairで使用するEffect Boundary Verificationの値契約を定義する。
 *
 * @responsibility Effect Boundary VerificationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape EffectBoundaryVerificationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant EffectBoundaryVerificationで宣言した値と責務の対応を維持する。
 * @boundary N/A: EffectBoundaryVerificationの宣言は外部境界を開かない。
 * @security EffectBoundaryVerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility EffectBoundaryVerificationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type EffectBoundaryVerification =
  | "verified"
  | "cancelled"
  | "helper_lost"
  | "artifact_unknown"
  | "authority_changed";

/**
 * effect Boundary 失敗 Reasonを決定する。
 *
 * @responsibility effect Boundary 失敗 Reasonの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input state: Exclude<EffectBoundaryVerification, "verified">、isAfterIntent
 * @returns effectBoundaryFailureReasonの計算結果を返す。
 * @precondition 「state: Exclude<EffectBoundaryVerification, "verified">、isAfterIntent」がeffectBoundaryFailureReasonの入力契約を満たす。
 * @postcondition effectBoundaryFailureReasonの責務を完了した結果だけを返す。
 * @effect N/A: effectBoundaryFailureReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: effectBoundaryFailureReasonは独自の失敗分岐を所有しない。
 * @invariant effectBoundaryFailureReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: effectBoundaryFailureReasonはProcess内の同一Subsystemで完結する。
 * @security effectBoundaryFailureReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: effectBoundaryFailureReasonは共有非同期状態を持たない同期処理である。
 */
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

/**
 * 失敗 Reasonを耐久保存する。
 *
 * @responsibility 失敗 Reasonの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input status: string、isAfterIntent
 * @returns persistFailureReasonの計算結果を返す。
 * @precondition 「status: string、isAfterIntent」がpersistFailureReasonの入力契約を満たす。
 * @postcondition persistFailureReasonの責務を完了した結果だけを返す。
 * @effect N/A: persistFailureReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: persistFailureReasonは独自の失敗分岐を所有しない。
 * @invariant persistFailureReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: persistFailureReasonはProcess内の同一Subsystemで完結する。
 * @security persistFailureReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: persistFailureReasonは共有非同期状態を持たない同期処理である。
 */
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

/**
 * DockerDesktopRepairPersistenceErrorが担う状態と操作を提供する。
 *
 * @responsibility DockerDesktopRepairPersistenceErrorに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000008
 * @construction DockerDesktopRepairPersistenceErrorの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle DockerDesktopRepairPersistenceErrorが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: DockerDesktopRepairPersistenceErrorの宣言自体は実行時Effectを発行しない。
 * @failure N/A: DockerDesktopRepairPersistenceErrorの宣言自体は実行時失敗を所有しない。
 * @invariant DockerDesktopRepairPersistenceErrorで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairPersistenceErrorの宣言は外部境界を開かない。
 * @security DockerDesktopRepairPersistenceErrorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: DockerDesktopRepairPersistenceErrorは共有非同期状態を持たない同期処理である。
 */
class DockerDesktopRepairPersistenceError extends Error {
  readonly repairReason: string;

  constructor(repairReason: string) {
    super(repairReason);
    this.name = "DockerDesktopRepairPersistenceError";
    this.repairReason = repairReason;
  }
}

/**
 * throw Persistence 失敗を決定する。
 *
 * @responsibility throw Persistence 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input status: string
 * @returns neverを返す。
 * @precondition 「status: string」がthrowPersistenceFailureの入力契約を満たす。
 * @postcondition throwPersistenceFailureの責務を完了した結果だけを返す。
 * @effect N/A: throwPersistenceFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure throwPersistenceFailureは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant throwPersistenceFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: throwPersistenceFailureはProcess内の同一Subsystemで完結する。
 * @security throwPersistenceFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: throwPersistenceFailureは共有非同期状態を持たない同期処理である。
 */
function throwPersistenceFailure(status: string): never {
  throw new DockerDesktopRepairPersistenceError(persistFailureReason(status));
}

/**
 * Effect Boundary 状態を検証する。
 *
 * @responsibility Effect Boundary 状態の検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>
 * @returns Promise<EffectBoundaryVerification>を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>」がverifyEffectBoundaryStateの入力契約を満たす。
 * @postcondition verifyEffectBoundaryStateの責務を完了した結果だけを返す。
 * @effect N/A: verifyEffectBoundaryStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyEffectBoundaryStateは独自の失敗分岐を所有しない。
 * @invariant verifyEffectBoundaryStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyEffectBoundaryStateはProcess内の同一Subsystemで完結する。
 * @security verifyEffectBoundaryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency verifyEffectBoundaryStateは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * Effect Boundaryを検証する。
 *
 * @responsibility Effect Boundaryの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>
 * @returns verifyEffectBoundaryの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>」がverifyEffectBoundaryの入力契約を満たす。
 * @postcondition verifyEffectBoundaryの責務を完了した結果だけを返す。
 * @effect N/A: verifyEffectBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyEffectBoundaryは独自の失敗分岐を所有しない。
 * @invariant verifyEffectBoundaryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyEffectBoundaryはProcess内の同一Subsystemで完結する。
 * @security verifyEffectBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency verifyEffectBoundaryは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * 清掃 記録 Boundary 状態を検証する。
 *
 * @responsibility 清掃 記録 Boundary 状態の検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession
 * @returns Promise<EffectBoundaryVerification>を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession」がverifyCleanupRecordBoundaryStateの入力契約を満たす。
 * @postcondition verifyCleanupRecordBoundaryStateの責務を完了した結果だけを返す。
 * @effect N/A: verifyCleanupRecordBoundaryStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyCleanupRecordBoundaryStateは独自の失敗分岐を所有しない。
 * @invariant verifyCleanupRecordBoundaryStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyCleanupRecordBoundaryStateはProcess内の同一Subsystemで完結する。
 * @security verifyCleanupRecordBoundaryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency verifyCleanupRecordBoundaryStateは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * Helper Within Cancellationを観測する。
 *
 * @responsibility Helper Within Cancellationの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input observe: () => Promise<T>、cancellation: ReturnType<typeof attachCancellation>、session: DockerDesktopRepairNativeHelperSession
 * @returns Promise<T | null>を返す。
 * @precondition 「observe: () => Promise<T>、cancellation: ReturnType<typeof attachCancellation>、session: DockerDesktopRepairNativeHelperSession」がobserveHelperWithinCancellationの入力契約を満たす。
 * @postcondition observeHelperWithinCancellationの責務を完了した結果だけを返す。
 * @effect N/A: observeHelperWithinCancellationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeHelperWithinCancellationは独自の失敗分岐を所有しない。
 * @invariant observeHelperWithinCancellationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeHelperWithinCancellationはProcess内の同一Subsystemで完結する。
 * @security observeHelperWithinCancellationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency observeHelperWithinCancellationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * Processes Within Cancellationを観測する。
 *
 * @responsibility Processes Within Cancellationの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>
 * @returns inspectProcessesWithinCancellationの計算結果を返す。
 * @precondition 「session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>」がinspectProcessesWithinCancellationの入力契約を満たす。
 * @postcondition inspectProcessesWithinCancellationの責務を完了した結果だけを返す。
 * @effect N/A: inspectProcessesWithinCancellationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectProcessesWithinCancellationは独自の失敗分岐を所有しない。
 * @invariant inspectProcessesWithinCancellationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectProcessesWithinCancellationはProcess内の同一Subsystemで完結する。
 * @security inspectProcessesWithinCancellationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectProcessesWithinCancellationは共有非同期状態を持たない同期処理である。
 */
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

/**
 * docker-desktop-runtime-repairで使用するFresh Runtime 状態の値契約を定義する。
 *
 * @responsibility Fresh Runtime 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape FreshRuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FreshRuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: FreshRuntimeStateの宣言は外部境界を開かない。
 * @security FreshRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility FreshRuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type FreshRuntimeState = Readonly<{
  boundaryState: EffectBoundaryVerification;
  processes: "verified" | "absent" | "unknown";
  engine: EngineObservation;
  run: PathObservation;
  stale: PathObservation;
}>;

/**
 * Fresh Runtime 状態を観測する。
 *
 * @responsibility Fresh Runtime 状態の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation
 * @returns Promise<FreshRuntimeState>を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation」がobserveFreshRuntimeStateの入力契約を満たす。
 * @postcondition observeFreshRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: observeFreshRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeFreshRuntimeStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeFreshRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeFreshRuntimeStateはProcess内の同一Subsystemで完結する。
 * @security observeFreshRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency observeFreshRuntimeStateは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * fresh Ready 状態 Matchesを決定する。
 *
 * @responsibility fresh Ready 状態 Matchesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input state: FreshRuntimeState、expectedRunIdentity: DockerDesktopRepairDirectoryIdentity、staleIdentity: DockerDesktopRepairDirectoryIdentity | null
 * @returns freshReadyStateMatchesの計算結果を返す。
 * @precondition 「state: FreshRuntimeState、expectedRunIdentity: DockerDesktopRepairDirectoryIdentity、staleIdentity: DockerDesktopRepairDirectoryIdentity | null」がfreshReadyStateMatchesの入力契約を満たす。
 * @postcondition freshReadyStateMatchesの責務を完了した結果だけを返す。
 * @effect N/A: freshReadyStateMatchesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: freshReadyStateMatchesは独自の失敗分岐を所有しない。
 * @invariant freshReadyStateMatchesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: freshReadyStateMatchesはProcess内の同一Subsystemで完結する。
 * @security freshReadyStateMatchesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: freshReadyStateMatchesは共有非同期状態を持たない同期処理である。
 */
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

/**
 * historical Broken Runtime Can Be Retained For New Repairを決定する。
 *
 * @responsibility historical Broken Runtime Can Be Retained For New Repairの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input state: FreshRuntimeState、lockedRunIdentity: DockerDesktopRepairDirectoryIdentity | null、historicalStaleIdentity: DockerDesktopRepairDirectoryIdentity
 * @returns historicalBrokenRuntimeCanBeRetainedForNewRepairの計算結果を返す。
 * @precondition 「state: FreshRuntimeState、lockedRunIdentity: DockerDesktopRepairDirectoryIdentity | null、historicalStaleIdentity: DockerDesktopRepairDirectoryIdentity」がhistoricalBrokenRuntimeCanBeRetainedForNewRepairの入力契約を満たす。
 * @postcondition historicalBrokenRuntimeCanBeRetainedForNewRepairの責務を完了した結果だけを返す。
 * @effect N/A: historicalBrokenRuntimeCanBeRetainedForNewRepairは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: historicalBrokenRuntimeCanBeRetainedForNewRepairは独自の失敗分岐を所有しない。
 * @invariant historicalBrokenRuntimeCanBeRetainedForNewRepairは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: historicalBrokenRuntimeCanBeRetainedForNewRepairはProcess内の同一Subsystemで完結する。
 * @security historicalBrokenRuntimeCanBeRetainedForNewRepairはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: historicalBrokenRuntimeCanBeRetainedForNewRepairは共有非同期状態を持たない同期処理である。
 */
function historicalBrokenRuntimeCanBeRetainedForNewRepair(
  state: FreshRuntimeState,
  lockedRunIdentity: DockerDesktopRepairDirectoryIdentity | null,
  historicalStaleIdentity: DockerDesktopRepairDirectoryIdentity,
) {
  const isHistoricalStaleAbsentOrExactRetained =
    state.stale.state === "confirmed_absent" ||
    (state.stale.state === "present" &&
      state.stale.identity !== null &&
      sameIdentity(state.stale.identity, historicalStaleIdentity));
  return (
    state.boundaryState === "verified" &&
    state.engine === "known_unavailable" &&
    (state.processes === "verified" || state.processes === "absent") &&
    state.run.state === "present" &&
    state.run.identity !== null &&
    isHistoricalStaleAbsentOrExactRetained &&
    lockedRunIdentity !== null &&
    sameIdentity(lockedRunIdentity, state.run.identity)
  );
}

/**
 * historical Operation Has No Issued Host Effectを決定する。
 *
 * @responsibility historical Operation Has No Issued Host Effectの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input operation: DockerDesktopRepairOperation
 * @returns historicalOperationHasNoIssuedHostEffectの計算結果を返す。
 * @precondition 「operation: DockerDesktopRepairOperation」がhistoricalOperationHasNoIssuedHostEffectの入力契約を満たす。
 * @postcondition historicalOperationHasNoIssuedHostEffectの責務を完了した結果だけを返す。
 * @effect N/A: historicalOperationHasNoIssuedHostEffectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: historicalOperationHasNoIssuedHostEffectは独自の失敗分岐を所有しない。
 * @invariant historicalOperationHasNoIssuedHostEffectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: historicalOperationHasNoIssuedHostEffectはProcess内の同一Subsystemで完結する。
 * @security historicalOperationHasNoIssuedHostEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: historicalOperationHasNoIssuedHostEffectは共有非同期状態を持たない同期処理である。
 */
function historicalOperationHasNoIssuedHostEffect(
  operation: DockerDesktopRepairOperation,
) {
  const hostEffects = [
    ...operation.ledger.processEffects,
    ...operation.ledger.filesystemEffects,
  ].filter((entry) => HOST_EFFECT_ACTION_NAMES.has(entry.action));
  return (
    operation.ledger.processEffectIssued === false &&
    operation.ledger.processEffectConfirmation === "not_issued" &&
    hostEffects.every(
      (entry) =>
        entry.phase === "settled" &&
        entry.issued === false &&
        entry.confirmation === "not_issued",
    )
  );
}

/**
 * fresh Stopped 状態 Matchesを決定する。
 *
 * @responsibility fresh Stopped 状態 Matchesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input state: FreshRuntimeState、operation: DockerDesktopRepairOperation
 * @returns freshStoppedStateMatchesの計算結果を返す。
 * @precondition 「state: FreshRuntimeState、operation: DockerDesktopRepairOperation」がfreshStoppedStateMatchesの入力契約を満たす。
 * @postcondition freshStoppedStateMatchesの責務を完了した結果だけを返す。
 * @effect N/A: freshStoppedStateMatchesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: freshStoppedStateMatchesは独自の失敗分岐を所有しない。
 * @invariant freshStoppedStateMatchesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: freshStoppedStateMatchesはProcess内の同一Subsystemで完結する。
 * @security freshStoppedStateMatchesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: freshStoppedStateMatchesは共有非同期状態を持たない同期処理である。
 */
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

/**
 * fresh Quiescent Run 状態 Matchesを決定する。
 *
 * @responsibility fresh Quiescent Run 状態 Matchesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input state: FreshRuntimeState、operation: DockerDesktopRepairOperation
 * @returns freshQuiescentRunStateMatchesの計算結果を返す。
 * @precondition 「state: FreshRuntimeState、operation: DockerDesktopRepairOperation」がfreshQuiescentRunStateMatchesの入力契約を満たす。
 * @postcondition freshQuiescentRunStateMatchesの責務を完了した結果だけを返す。
 * @effect N/A: freshQuiescentRunStateMatchesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: freshQuiescentRunStateMatchesは独自の失敗分岐を所有しない。
 * @invariant freshQuiescentRunStateMatchesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: freshQuiescentRunStateMatchesはProcess内の同一Subsystemで完結する。
 * @security freshQuiescentRunStateMatchesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: freshQuiescentRunStateMatchesは共有非同期状態を持たない同期処理である。
 */
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

/**
 * After Live Boundaryを耐久保存する。
 *
 * @responsibility After Live Boundaryの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation、stage: Parameters<RepairDependencies["persistStage"]>[2]、ledger: MutableLedger、validateFresh: (state: FreshRuntimeState) => boolean
 * @returns persistAfterLiveBoundaryの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation、stage: Parameters<RepairDependencies["persistStage"]>[2]、ledger: MutableLedger、validateFresh: (state: FreshRuntimeState) => boolean」がpersistAfterLiveBoundaryの入力契約を満たす。
 * @postcondition persistAfterLiveBoundaryの責務を完了した結果だけを返す。
 * @effect N/A: persistAfterLiveBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure persistAfterLiveBoundaryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant persistAfterLiveBoundaryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: persistAfterLiveBoundaryはProcess内の同一Subsystemで完結する。
 * @security persistAfterLiveBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency persistAfterLiveBoundaryは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * Host Effect Intentを耐久保存する。
 *
 * @responsibility Host Effect Intentの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation、kind: "process" | "filesystem"、action: DockerDesktopRepairEffectAction、ledger: MutableLedger
 * @returns persistHostEffectIntentの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation、kind: "process" | "filesystem"、action: DockerDesktopRepairEffectAction、ledger: MutableLedger」がpersistHostEffectIntentの入力契約を満たす。
 * @postcondition persistHostEffectIntentの責務を完了した結果だけを返す。
 * @effect N/A: persistHostEffectIntentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: persistHostEffectIntentは独自の失敗分岐を所有しない。
 * @invariant persistHostEffectIntentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: persistHostEffectIntentはProcess内の同一Subsystemで完結する。
 * @security persistHostEffectIntentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency persistHostEffectIntentは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * durable Resume Allows Host Actionを決定する。
 *
 * @responsibility durable Resume Allows Host Actionの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input operation: DockerDesktopRepairOperation、action: Extract< DockerDesktopRepairEffectAction, | "official_shutdown" | "native_termination" | "wsl_termination" | "runtime_directory_rename" | "desktop_launch" >
 * @returns durableResumeAllowsHostActionの計算結果を返す。
 * @precondition 「operation: DockerDesktopRepairOperation、action: Extract< DockerDesktopRepairEffectAction, | "official_shutdown" | "native_termination" | "wsl_termination" | "runtime_directory_rename" | "desktop_launch" >」がdurableResumeAllowsHostActionの入力契約を満たす。
 * @postcondition durableResumeAllowsHostActionの責務を完了した結果だけを返す。
 * @effect N/A: durableResumeAllowsHostActionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: durableResumeAllowsHostActionは独自の失敗分岐を所有しない。
 * @invariant durableResumeAllowsHostActionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: durableResumeAllowsHostActionはProcess内の同一Subsystemで完結する。
 * @security durableResumeAllowsHostActionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: durableResumeAllowsHostActionは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Host Effect Settlementを耐久保存する。
 *
 * @responsibility Host Effect Settlementの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、_cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation、kind: "process" | "filesystem"、action: DockerDesktopRepairEffectAction、observed: TaggedEffect、ledger: MutableLedger
 * @returns persistHostEffectSettlementの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、_cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation、kind: "process" | "filesystem"、action: DockerDesktopRepairEffectAction、observed: TaggedEffect、ledger: MutableLedger」がpersistHostEffectSettlementの入力契約を満たす。
 * @postcondition persistHostEffectSettlementの責務を完了した結果だけを返す。
 * @effect N/A: persistHostEffectSettlementは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure persistHostEffectSettlementは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant persistHostEffectSettlementは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: persistHostEffectSettlementはProcess内の同一Subsystemで完結する。
 * @security persistHostEffectSettlementはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency persistHostEffectSettlementは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * Native Termination Observationを耐久保存する。
 *
 * @responsibility Native Termination Observationの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、operation: DockerDesktopRepairOperation、ledger: MutableLedger
 * @returns persistNativeTerminationObservationの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、operation: DockerDesktopRepairOperation、ledger: MutableLedger」がpersistNativeTerminationObservationの入力契約を満たす。
 * @postcondition persistNativeTerminationObservationの責務を完了した結果だけを返す。
 * @effect N/A: persistNativeTerminationObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure persistNativeTerminationObservationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant persistNativeTerminationObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: persistNativeTerminationObservationはProcess内の同一Subsystemで完結する。
 * @security persistNativeTerminationObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency persistNativeTerminationObservationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * docker-desktop-runtime-repairで使用するHost Effect Preconditionの値契約を定義する。
 *
 * @responsibility Host Effect PreconditionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HostEffectPreconditionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostEffectPreconditionで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostEffectPreconditionの宣言は外部境界を開かない。
 * @security HostEffectPreconditionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostEffectPreconditionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * host Effect Precondition Block Reasonを決定する。
 *
 * @responsibility host Effect Precondition Block Reasonの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input observation: HostEffectPrecondition、cancellation: ReturnType<typeof attachCancellation>
 * @returns hostEffectPreconditionBlockReasonの計算結果を返す。
 * @precondition 「observation: HostEffectPrecondition、cancellation: ReturnType<typeof attachCancellation>」がhostEffectPreconditionBlockReasonの入力契約を満たす。
 * @postcondition hostEffectPreconditionBlockReasonの責務を完了した結果だけを返す。
 * @effect N/A: hostEffectPreconditionBlockReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hostEffectPreconditionBlockReasonは独自の失敗分岐を所有しない。
 * @invariant hostEffectPreconditionBlockReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hostEffectPreconditionBlockReasonはProcess内の同一Subsystemで完結する。
 * @security hostEffectPreconditionBlockReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hostEffectPreconditionBlockReasonは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Host Effect Preconditionを観測する。
 *
 * @responsibility Host Effect Preconditionの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation、action: Extract< DockerDesktopRepairEffectAction, | "official_shutdown" | "native_termination" | "wsl_termination" | "runtime_directory_rename" | "desktop_launch" >
 * @returns Promise<HostEffectPrecondition>を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation、action: Extract< DockerDesktopRepairEffectAction, | "official_shutdown" | "native_termination" | "wsl_termination" | "runtime_directory_rename" | "desktop_launch" >」がobserveHostEffectPreconditionの入力契約を満たす。
 * @postcondition observeHostEffectPreconditionの責務を完了した結果だけを返す。
 * @effect observeHostEffectPreconditionはFilesystemの読取りまたは書込みを実行する。
 * @failure observeHostEffectPreconditionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeHostEffectPreconditionは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observeHostEffectPreconditionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency observeHostEffectPreconditionは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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
    ((action === "official_shutdown" && processes === "verified") ||
      (action === "native_termination" && processes === "verified") ||
      (action === "wsl_termination" && processes === "absent"))
  )
    return Object.freeze({ state: "proceed" as const, liveRunIdentity: null });
  if (
    (action === "official_shutdown" || action === "native_termination") &&
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

/**
 * Unissued Intent After Fresh Observationを終端状態へ確定する。
 *
 * @responsibility Unissued Intent After Fresh Observationの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation、kind: "process" | "filesystem"、action: DockerDesktopRepairEffectAction、ledger: MutableLedger、observation: HostEffectPrecondition
 * @returns settleUnissuedIntentAfterFreshObservationの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation、kind: "process" | "filesystem"、action: DockerDesktopRepairEffectAction、ledger: MutableLedger、observation: HostEffectPrecondition」がsettleUnissuedIntentAfterFreshObservationの入力契約を満たす。
 * @postcondition settleUnissuedIntentAfterFreshObservationの責務を完了した結果だけを返す。
 * @effect settleUnissuedIntentAfterFreshObservationはFilesystemの読取りまたは書込みを実行する。
 * @failure settleUnissuedIntentAfterFreshObservationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant settleUnissuedIntentAfterFreshObservationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security settleUnissuedIntentAfterFreshObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency settleUnissuedIntentAfterFreshObservationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * Historical Repairを観測する。
 *
 * @responsibility Historical Repairの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation
 * @returns observeHistoricalRepairの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation」がobserveHistoricalRepairの入力契約を満たす。
 * @postcondition observeHistoricalRepairの責務を完了した結果だけを返す。
 * @effect observeHistoricalRepairはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: observeHistoricalRepairは独自の失敗分岐を所有しない。
 * @invariant observeHistoricalRepairは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observeHistoricalRepairはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency observeHistoricalRepairは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function observeHistoricalRepair(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  cancellation: ReturnType<typeof attachCancellation>,
  operation: DockerDesktopRepairOperation,
) {
  const ledger = ledgerFrom(operation);
  const isOriginalTerminal = originalRepairChainIsTerminal(operation);
  if (operation.history?.closed || isOriginalTerminal) {
    const isRetained =
      operation.history?.staleState === "retained" ||
      operation.ledger.staleState === "retained";
    const liveRunIdentity =
      operation.history?.liveRunIdentity ??
      operation.ledger.liveRunIdentity ??
      operation.runIdentity;
    ledger.engineReady = operation.ledger.engineReady;
    ledger.staleState = isRetained ? "retained" : operation.ledger.staleState;
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
  const continuationState = inspectDockerDesktopRepairContinuation(
    boundary,
    operation,
  );
  if (continuationState.status === "invalid") {
    markUnknown(ledger);
    return {
      status: "blocked" as const,
      reason: "docker_desktop_repair_continuation_record_invalid",
      ledger,
      operation,
    };
  }
  if (continuationState.status === "valid") {
    const continuation = continuationState.continuation;
    const fresh = await observeFreshRuntimeState(
      dependencies,
      boundary,
      session,
      cancellation,
      operation,
    );
    const hasExactOriginalStale =
      fresh.stale.state === "present" &&
      fresh.stale.identity !== null &&
      sameIdentity(fresh.stale.identity, operation.runIdentity);
    const currentRun = fresh.run.identity;
    const isReady =
      continuation.stage === "recovered" &&
      continuationEffectsConfirmed(continuation) &&
      fresh.boundaryState === "verified" &&
      fresh.engine === "ready" &&
      fresh.processes === "verified" &&
      fresh.run.state === "present" &&
      currentRun !== null &&
      hasExactOriginalStale &&
      continuationRuntimeGenerationsMatch(dependencies, boundary, continuation);
    ledger.engineReady = fresh.engine === "ready";
    ledger.staleState = hasExactOriginalStale ? "retained" : "unknown";
    ledger.hostSafety = isReady ? "safe" : "manual_recovery_required";
    ledger.evidenceState = "preserved";
    ledger.liveRunIdentity = isReady ? currentRun : null;
    ledger.disposition = "historical_effect_unknown_pending_human_decision";
    if (
      !isReady &&
      (fresh.engine === "unknown" || fresh.processes === "unknown")
    )
      markUnknown(ledger);
    return {
      status: isReady
        ? ("historical_recovered_pending_close" as const)
        : ("blocked" as const),
      reason: isReady
        ? "docker_desktop_repair_continuation_current_state_verified"
        : "docker_desktop_repair_continuation_current_state_unconfirmed",
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

/**
 * original Repair Chain Is Terminalを決定する。
 *
 * @responsibility original Repair Chain Is Terminalの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input operation: DockerDesktopRepairOperation
 * @returns booleanを返す。
 * @precondition 「operation: DockerDesktopRepairOperation」がoriginalRepairChainIsTerminalの入力契約を満たす。
 * @postcondition originalRepairChainIsTerminalの責務を完了した結果だけを返す。
 * @effect N/A: originalRepairChainIsTerminalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: originalRepairChainIsTerminalは独自の失敗分岐を所有しない。
 * @invariant originalRepairChainIsTerminalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: originalRepairChainIsTerminalはProcess内の同一Subsystemで完結する。
 * @security originalRepairChainIsTerminalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: originalRepairChainIsTerminalは共有非同期状態を持たない同期処理である。
 */
function originalRepairChainIsTerminal(
  operation: DockerDesktopRepairOperation,
): boolean {
  return [
    "closed_retained",
    "closed_no_stale_known_effect_retained",
    "closed_historical_effect_unknown_retained",
  ].includes(operation.stage);
}

/**
 * docker-desktop-runtime-repairで使用するHistorical Adoption Routeの値契約を定義する。
 *
 * @responsibility Historical Adoption RouteのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HistoricalAdoptionRouteが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HistoricalAdoptionRouteで宣言した値と責務の対応を維持する。
 * @boundary N/A: HistoricalAdoptionRouteの宣言は外部境界を開かない。
 * @security HistoricalAdoptionRouteはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HistoricalAdoptionRouteの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HistoricalAdoptionRoute =
  | "invalid"
  | "initial_adoption"
  | "closed"
  | "current_session"
  | "session_handoff";

/**
 * Repair Operation Coreが同一かを判定する。
 *
 * @responsibility Repair Operation Coreの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000008
 * @input before: DockerDesktopRepairOperation、after: DockerDesktopRepairOperation、boundary: PreparedBoundary
 * @returns sameRepairOperationCoreの計算結果を返す。
 * @precondition 「before: DockerDesktopRepairOperation、after: DockerDesktopRepairOperation、boundary: PreparedBoundary」がsameRepairOperationCoreの入力契約を満たす。
 * @postcondition sameRepairOperationCoreの責務を完了した結果だけを返す。
 * @effect N/A: sameRepairOperationCoreは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameRepairOperationCoreは独自の失敗分岐を所有しない。
 * @invariant sameRepairOperationCoreは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameRepairOperationCoreはProcess内の同一Subsystemで完結する。
 * @security sameRepairOperationCoreはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameRepairOperationCoreは共有非同期状態を持たない同期処理である。
 */
function sameRepairOperationCore(
  before: DockerDesktopRepairOperation,
  after: DockerDesktopRepairOperation,
  boundary: PreparedBoundary,
) {
  return (
    classifyCanonicalDockerDesktopRepairHistoricalOperation(
      before,
      boundary,
    ) !== "invalid" &&
    classifyCanonicalDockerDesktopRepairHistoricalOperation(after, boundary) !==
      "invalid" &&
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

/**
 * Docker Desktop Repair Historical Adoption Routeを分類する。
 *
 * @responsibility Docker Desktop Repair Historical Adoption Routeの分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input operation: DockerDesktopRepairOperation、boundary: PreparedBoundary
 * @returns HistoricalAdoptionRouteを返す。
 * @precondition 「operation: DockerDesktopRepairOperation、boundary: PreparedBoundary」がclassifyDockerDesktopRepairHistoricalAdoptionRouteの入力契約を満たす。
 * @postcondition classifyDockerDesktopRepairHistoricalAdoptionRouteの責務を完了した結果だけを返す。
 * @effect N/A: classifyDockerDesktopRepairHistoricalAdoptionRouteは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyDockerDesktopRepairHistoricalAdoptionRouteは独自の失敗分岐を所有しない。
 * @invariant classifyDockerDesktopRepairHistoricalAdoptionRouteは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyDockerDesktopRepairHistoricalAdoptionRouteはProcess内の同一Subsystemで完結する。
 * @security classifyDockerDesktopRepairHistoricalAdoptionRouteはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyDockerDesktopRepairHistoricalAdoptionRouteは共有非同期状態を持たない同期処理である。
 */
export function classifyDockerDesktopRepairHistoricalAdoptionRoute(
  operation: DockerDesktopRepairOperation,
  boundary: PreparedBoundary,
): HistoricalAdoptionRoute {
  const mode = classifyCanonicalDockerDesktopRepairHistoricalOperation(
    operation,
    boundary,
  );
  if (mode === "no_history") return "initial_adoption";
  if (mode === "closed") return "closed";
  if (mode === "open_current") return "current_session";
  if (mode === "open_prior") return "session_handoff";
  return "invalid";
}

/**
 * Docker Desktop Repair Historical Adoption 結果の契約を検証する。
 *
 * @responsibility Docker Desktop Repair Historical Adoption 結果の必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input route: HistoricalAdoptionRoute、before: DockerDesktopRepairOperation、after: DockerDesktopRepairOperation、boundary: PreparedBoundary
 * @returns validateDockerDesktopRepairHistoricalAdoptionResultの計算結果を返す。
 * @precondition 「route: HistoricalAdoptionRoute、before: DockerDesktopRepairOperation、after: DockerDesktopRepairOperation、boundary: PreparedBoundary」がvalidateDockerDesktopRepairHistoricalAdoptionResultの入力契約を満たす。
 * @postcondition validateDockerDesktopRepairHistoricalAdoptionResultの責務を完了した結果だけを返す。
 * @effect N/A: validateDockerDesktopRepairHistoricalAdoptionResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateDockerDesktopRepairHistoricalAdoptionResultは独自の失敗分岐を所有しない。
 * @invariant validateDockerDesktopRepairHistoricalAdoptionResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateDockerDesktopRepairHistoricalAdoptionResultはProcess内の同一Subsystemで完結する。
 * @security validateDockerDesktopRepairHistoricalAdoptionResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateDockerDesktopRepairHistoricalAdoptionResultは共有非同期状態を持たない同期処理である。
 */
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
  const beforeMode = classifyCanonicalDockerDesktopRepairHistoricalOperation(
    before,
    boundary,
  );
  const afterMode = classifyCanonicalDockerDesktopRepairHistoricalOperation(
    after,
    boundary,
  );
  if (
    afterMode !== "open_current" ||
    (route === "initial_adoption"
      ? beforeMode !== "no_history"
      : beforeMode !== "open_prior")
  )
    return false;
  if (route === "initial_adoption")
    return (
      after.history.handoffCount === 0 &&
      after.history.handoffTipSha256 === after.history.adoptionSha256 &&
      after.history.originLocalUserBindingHash ===
        before.originLocalUserBindingHash &&
      afterMode === "open_current"
    );
  const prior = before.history;
  const priorHandoffCount = prior?.handoffCount;
  return (
    prior !== undefined &&
    beforeMode === "open_prior" &&
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
    afterMode === "open_current"
  );
}

/**
 * Docker Desktop Repair Historical Closure 結果の契約を検証する。
 *
 * @responsibility Docker Desktop Repair Historical Closure 結果の必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input before: DockerDesktopRepairOperation、after: DockerDesktopRepairOperation、boundary: PreparedBoundary、expected: Readonly<{ liveRunIdentity: DockerDesktopRepairDirectoryIdentity; staleState: "absent" | "retained"; }>
 * @returns validateDockerDesktopRepairHistoricalClosureResultの計算結果を返す。
 * @precondition 「before: DockerDesktopRepairOperation、after: DockerDesktopRepairOperation、boundary: PreparedBoundary、expected: Readonly<{ liveRunIdentity: DockerDesktopRepairDirectoryIdentity; staleState: "absent" | "retained"; }>」がvalidateDockerDesktopRepairHistoricalClosureResultの入力契約を満たす。
 * @postcondition validateDockerDesktopRepairHistoricalClosureResultの責務を完了した結果だけを返す。
 * @effect N/A: validateDockerDesktopRepairHistoricalClosureResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateDockerDesktopRepairHistoricalClosureResultは独自の失敗分岐を所有しない。
 * @invariant validateDockerDesktopRepairHistoricalClosureResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateDockerDesktopRepairHistoricalClosureResultはProcess内の同一Subsystemで完結する。
 * @security validateDockerDesktopRepairHistoricalClosureResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateDockerDesktopRepairHistoricalClosureResultは共有非同期状態を持たない同期処理である。
 */
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
  const beforeMode = classifyCanonicalDockerDesktopRepairHistoricalOperation(
    before,
    boundary,
  );
  const afterMode = classifyCanonicalDockerDesktopRepairHistoricalOperation(
    after,
    boundary,
    expected,
  );
  return (
    prior !== undefined &&
    closed !== undefined &&
    beforeMode === "open_current" &&
    prior.currentSessionBound === true &&
    closed.closed === true &&
    afterMode === "closed" &&
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

/**
 * continuation Effectを決定する。
 *
 * @responsibility continuation Effectの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input continuation: DockerDesktopRepairContinuation、action: DockerDesktopRepairContinuationAction
 * @returns continuationEffectの計算結果を返す。
 * @precondition 「continuation: DockerDesktopRepairContinuation、action: DockerDesktopRepairContinuationAction」がcontinuationEffectの入力契約を満たす。
 * @postcondition continuationEffectの責務を完了した結果だけを返す。
 * @effect N/A: continuationEffectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: continuationEffectは独自の失敗分岐を所有しない。
 * @invariant continuationEffectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: continuationEffectはProcess内の同一Subsystemで完結する。
 * @security continuationEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: continuationEffectは共有非同期状態を持たない同期処理である。
 */
function continuationEffect(
  continuation: DockerDesktopRepairContinuation,
  action: DockerDesktopRepairContinuationAction,
) {
  return continuation.effects[action];
}

/**
 * Retained Directoryが完全一致するか判定する。
 *
 * @responsibility Retained Directoryの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、source: string、target: string、identityValue: DockerDesktopRepairDirectoryIdentity
 * @returns exactRetainedDirectoryの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、source: string、target: string、identityValue: DockerDesktopRepairDirectoryIdentity」がexactRetainedDirectoryの入力契約を満たす。
 * @postcondition exactRetainedDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: exactRetainedDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactRetainedDirectoryは独自の失敗分岐を所有しない。
 * @invariant exactRetainedDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactRetainedDirectoryはProcess内の同一Subsystemで完結する。
 * @security exactRetainedDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactRetainedDirectoryは共有非同期状態を持たない同期処理である。
 */
function exactRetainedDirectory(
  dependencies: RepairDependencies,
  source: string,
  target: string,
  identityValue: DockerDesktopRepairDirectoryIdentity,
) {
  const sourceObservation = observePathUsing(dependencies, source);
  const targetObservation = observePathUsing(dependencies, target);
  return (
    sourceObservation.state === "confirmed_absent" &&
    targetObservation.state === "present" &&
    targetObservation.identity !== null &&
    sameIdentity(targetObservation.identity, identityValue)
  );
}

/**
 * retained Directory With Replacementを決定する。
 *
 * @responsibility retained Directory With Replacementの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、source: string、target: string、identityValue: DockerDesktopRepairDirectoryIdentity
 * @returns retainedDirectoryWithReplacementの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、source: string、target: string、identityValue: DockerDesktopRepairDirectoryIdentity」がretainedDirectoryWithReplacementの入力契約を満たす。
 * @postcondition retainedDirectoryWithReplacementの責務を完了した結果だけを返す。
 * @effect N/A: retainedDirectoryWithReplacementは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: retainedDirectoryWithReplacementは独自の失敗分岐を所有しない。
 * @invariant retainedDirectoryWithReplacementは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: retainedDirectoryWithReplacementはProcess内の同一Subsystemで完結する。
 * @security retainedDirectoryWithReplacementはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: retainedDirectoryWithReplacementは共有非同期状態を持たない同期処理である。
 */
function retainedDirectoryWithReplacement(
  dependencies: RepairDependencies,
  source: string,
  target: string,
  identityValue: DockerDesktopRepairDirectoryIdentity,
) {
  const sourceObservation = observePathUsing(dependencies, source);
  const targetObservation = observePathUsing(dependencies, target);
  return (
    sourceObservation.state === "present" &&
    sourceObservation.identity !== null &&
    !sameIdentity(sourceObservation.identity, identityValue) &&
    targetObservation.state === "present" &&
    targetObservation.identity !== null &&
    sameIdentity(targetObservation.identity, identityValue)
  );
}

/**
 * continuation Effects Confirmedを決定する。
 *
 * @responsibility continuation Effects Confirmedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input continuation: DockerDesktopRepairContinuation
 * @returns continuationEffectsConfirmedの計算結果を返す。
 * @precondition 「continuation: DockerDesktopRepairContinuation」がcontinuationEffectsConfirmedの入力契約を満たす。
 * @postcondition continuationEffectsConfirmedの責務を完了した結果だけを返す。
 * @effect continuationEffectsConfirmedはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: continuationEffectsConfirmedは独自の失敗分岐を所有しない。
 * @invariant continuationEffectsConfirmedは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security continuationEffectsConfirmedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: continuationEffectsConfirmedは共有非同期状態を持たない同期処理である。
 */
function continuationEffectsConfirmed(
  continuation: DockerDesktopRepairContinuation,
) {
  return (
    continuationEffect(continuation, "failed_launch_run_directory_rename")
      ?.phase === "settled" &&
    continuationEffect(continuation, "failed_launch_run_directory_rename")
      ?.issued === true &&
    continuationEffect(continuation, "failed_launch_run_directory_rename")
      ?.confirmation === "confirmed" &&
    continuationEffect(continuation, "secrets_engine_directory_rename")
      ?.phase === "settled" &&
    continuationEffect(continuation, "secrets_engine_directory_rename")
      ?.issued === true &&
    continuationEffect(continuation, "secrets_engine_directory_rename")
      ?.confirmation === "confirmed" &&
    continuationEffect(continuation, "desktop_relaunch")?.phase === "settled" &&
    continuationEffect(continuation, "desktop_relaunch")?.issued === true &&
    continuationEffect(continuation, "desktop_relaunch")?.confirmation ===
      "confirmed"
  );
}

/**
 * continuation Runtime Generations Matchを決定する。
 *
 * @responsibility continuation Runtime Generations Matchの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、continuation: DockerDesktopRepairContinuation
 * @returns continuationRuntimeGenerationsMatchの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、continuation: DockerDesktopRepairContinuation」がcontinuationRuntimeGenerationsMatchの入力契約を満たす。
 * @postcondition continuationRuntimeGenerationsMatchの責務を完了した結果だけを返す。
 * @effect N/A: continuationRuntimeGenerationsMatchは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: continuationRuntimeGenerationsMatchは独自の失敗分岐を所有しない。
 * @invariant continuationRuntimeGenerationsMatchは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: continuationRuntimeGenerationsMatchはProcess内の同一Subsystemで完結する。
 * @security continuationRuntimeGenerationsMatchはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: continuationRuntimeGenerationsMatchは共有非同期状態を持たない同期処理である。
 */
function continuationRuntimeGenerationsMatch(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  continuation: DockerDesktopRepairContinuation,
) {
  const paths = dockerDesktopRepairContinuationPaths(boundary, continuation);
  return (
    retainedDirectoryWithReplacement(
      dependencies,
      paths.failedRunDirectory,
      paths.failedRunStaleDirectory,
      continuation.failedRunIdentity,
    ) &&
    retainedDirectoryWithReplacement(
      dependencies,
      paths.secretsEngineDirectory,
      paths.secretsEngineStaleDirectory,
      continuation.secretsEngineIdentity,
    )
  );
}

/**
 * continuation Host Quiescenceを決定する。
 *
 * @responsibility continuation Host Quiescenceの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>
 * @returns continuationHostQuiescenceの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>」がcontinuationHostQuiescenceの入力契約を満たす。
 * @postcondition continuationHostQuiescenceの責務を完了した結果だけを返す。
 * @effect N/A: continuationHostQuiescenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: continuationHostQuiescenceは独自の失敗分岐を所有しない。
 * @invariant continuationHostQuiescenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: continuationHostQuiescenceはProcess内の同一Subsystemで完結する。
 * @security continuationHostQuiescenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency continuationHostQuiescenceは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function continuationHostQuiescence(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  cancellation: ReturnType<typeof attachCancellation>,
) {
  const engine = dependencies.observeEngine(boundary);
  const processes = await inspectProcessesWithinCancellation(
    session,
    cancellation,
  );
  if (engine === "unknown" || processes === "unknown") return "unknown";
  return engine === "known_unavailable" && processes === "absent"
    ? "verified"
    : "changed";
}

/**
 * continue Failed Docker Desktop Launchを決定する。
 *
 * @responsibility continue Failed Docker Desktop Launchの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation
 * @returns continueFailedDockerDesktopLaunchの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、cancellation: ReturnType<typeof attachCancellation>、operation: DockerDesktopRepairOperation」がcontinueFailedDockerDesktopLaunchの入力契約を満たす。
 * @postcondition continueFailedDockerDesktopLaunchの責務を完了した結果だけを返す。
 * @effect continueFailedDockerDesktopLaunchはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: continueFailedDockerDesktopLaunchは独自の失敗分岐を所有しない。
 * @invariant continueFailedDockerDesktopLaunchは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security continueFailedDockerDesktopLaunchはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency continueFailedDockerDesktopLaunchは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function continueFailedDockerDesktopLaunch(
  dependencies: RepairDependencies,
  boundary: PreparedBoundary,
  session: DockerDesktopRepairNativeHelperSession,
  cancellation: ReturnType<typeof attachCancellation>,
  operation: DockerDesktopRepairOperation,
) {
  const ledger = ledgerFrom(operation);
  const continuationState = inspectDockerDesktopRepairContinuation(
    boundary,
    operation,
  );
  if (continuationState.status === "invalid")
    return {
      status: "blocked" as const,
      reason: "docker_desktop_repair_continuation_record_invalid",
      ledger,
      operation,
    };
  let continuation = continuationState.continuation;
  const observeLock = dependencies.observeRuntimeDirectoryLock;
  const renameDirectory = dependencies.renameRuntimeDirectory;
  if (!observeLock || !renameDirectory)
    return {
      status: "blocked" as const,
      reason: "docker_desktop_repair_continuation_capability_unavailable",
      ledger,
      operation,
    };
  const staleOriginal = observePathUsing(
    dependencies,
    operation.staleDirectory,
  );
  if (
    staleOriginal.state !== "present" ||
    !staleOriginal.identity ||
    !sameIdentity(staleOriginal.identity, operation.runIdentity)
  ) {
    markUnknown(ledger);
    return {
      status: "blocked" as const,
      reason: "docker_desktop_stale_runtime_identity_unknown",
      ledger,
      operation,
    };
  }
  let engine = dependencies.observeEngine(boundary);
  let processes = await inspectProcessesWithinCancellation(
    session,
    cancellation,
  );
  if (!continuation) {
    const launch = operation.ledger.processEffects.find(
      (entry) => entry.action === "desktop_launch",
    );
    const failedRun = observePathUsing(dependencies, boundary.runDirectory);
    const secretsDirectory = path.win32.join(
      boundary.localAppData,
      "docker-secrets-engine",
    );
    const secrets = observePathUsing(dependencies, secretsDirectory);
    const failedRunLock = observeLock(boundary.runDirectory);
    const secretsLock = observeLock(secretsDirectory);
    if (
      operation.stage !== "renamed" ||
      launch?.phase !== "settled" ||
      launch.issued !== true ||
      launch.confirmation !== "confirmed" ||
      engine !== "known_unavailable" ||
      processes !== "absent" ||
      failedRun.state !== "present" ||
      !failedRun.identity ||
      sameIdentity(failedRun.identity, operation.runIdentity) ||
      !failedRunLock ||
      !sameIdentity(failedRunLock, failedRun.identity) ||
      secrets.state !== "present" ||
      !secrets.identity ||
      !secretsLock ||
      !sameIdentity(secretsLock, secrets.identity)
    ) {
      if (engine === "unknown" || processes === "unknown") markUnknown(ledger);
      return {
        status: "blocked" as const,
        reason: "docker_desktop_repair_continuation_precondition_unconfirmed",
        ledger,
        operation,
      };
    }
    const boundaryState = await verifyEffectBoundaryState(
      dependencies,
      boundary,
      session,
      cancellation,
    );
    if (boundaryState !== "verified") {
      markUnknown(ledger);
      return {
        status: "blocked" as const,
        reason: effectBoundaryFailureReason(boundaryState),
        ledger,
        operation,
      };
    }
    continuation = createDockerDesktopRepairContinuation(
      boundary,
      operation,
      failedRun.identity,
      secrets.identity,
    );
    if (!continuation) {
      markUnknown(ledger);
      return {
        status: "blocked" as const,
        reason: "docker_desktop_repair_continuation_record_unavailable",
        ledger,
        operation,
      };
    }
  }

  const paths = dockerDesktopRepairContinuationPaths(boundary, continuation);
  const renameSteps = [
    {
      action: "failed_launch_run_directory_rename" as const,
      source: paths.failedRunDirectory,
      target: paths.failedRunStaleDirectory,
      identity: continuation.failedRunIdentity,
    },
    {
      action: "secrets_engine_directory_rename" as const,
      source: paths.secretsEngineDirectory,
      target: paths.secretsEngineStaleDirectory,
      identity: continuation.secretsEngineIdentity,
    },
  ];
  for (const [stepIndex, step] of renameSteps.entries()) {
    let effect = continuationEffect(continuation, step.action);
    if (effect?.phase === "intent_recorded") {
      if (
        !exactRetainedDirectory(
          dependencies,
          step.source,
          step.target,
          step.identity,
        )
      ) {
        markUnknown(ledger);
        return {
          status: "blocked" as const,
          reason: "docker_desktop_repair_continuation_effect_unknown",
          ledger,
          operation,
        };
      }
      continuation =
        persistDockerDesktopRepairContinuationSettlement(
          boundary,
          operation,
          continuation,
          step.action,
          Object.freeze({ issued: true, confirmation: "confirmed" as const }),
        ) ?? continuation;
      effect = continuationEffect(continuation, step.action);
    }
    if (!effect) {
      const boundaryState = await verifyEffectBoundaryState(
        dependencies,
        boundary,
        session,
        cancellation,
      );
      const quiescence = await continuationHostQuiescence(
        dependencies,
        boundary,
        session,
        cancellation,
      );
      const source = observePathUsing(dependencies, step.source);
      const target = observePathUsing(dependencies, step.target);
      const lockedIdentity = observeLock(step.source);
      const isPriorRenameSequenceRetained = renameSteps
        .slice(0, stepIndex)
        .every((prior) =>
          exactRetainedDirectory(
            dependencies,
            prior.source,
            prior.target,
            prior.identity,
          ),
        );
      if (
        boundaryState !== "verified" ||
        quiescence !== "verified" ||
        cancellation.shouldStop() ||
        source.state !== "present" ||
        source.identity === null ||
        !sameIdentity(source.identity, step.identity) ||
        target.state !== "confirmed_absent" ||
        lockedIdentity === null ||
        !sameIdentity(lockedIdentity, step.identity) ||
        !isPriorRenameSequenceRetained
      ) {
        markUnknown(ledger);
        return {
          status: "blocked" as const,
          reason:
            boundaryState === "verified"
              ? cancellation.shouldStop()
                ? "docker_desktop_repair_cancelled_before_host_effect"
                : quiescence === "unknown"
                  ? "docker_desktop_repair_continuation_host_state_unknown"
                  : "docker_desktop_repair_continuation_effect_precondition_unconfirmed"
              : effectBoundaryFailureReason(boundaryState),
          ledger,
          operation,
        };
      }
      const intent = persistDockerDesktopRepairContinuationIntent(
        boundary,
        operation,
        continuation,
        step.action,
      );
      if (!intent) {
        markUnknown(ledger);
        return {
          status: "blocked" as const,
          reason: "docker_desktop_repair_continuation_record_update_failed",
          ledger,
          operation,
        };
      }
      continuation = intent;
      const finalBoundaryState = await verifyEffectBoundaryState(
        dependencies,
        boundary,
        session,
        cancellation,
      );
      const finalQuiescence = await continuationHostQuiescence(
        dependencies,
        boundary,
        session,
        cancellation,
      );
      const finalSource = observePathUsing(dependencies, step.source);
      const finalTarget = observePathUsing(dependencies, step.target);
      const finalLockedIdentity = observeLock(step.source);
      const isFinalPriorRenameSequenceRetained = renameSteps
        .slice(0, stepIndex)
        .every((prior) =>
          exactRetainedDirectory(
            dependencies,
            prior.source,
            prior.target,
            prior.identity,
          ),
        );
      if (
        finalBoundaryState !== "verified" ||
        finalQuiescence !== "verified" ||
        cancellation.shouldStop() ||
        finalSource.state !== "present" ||
        finalSource.identity === null ||
        !sameIdentity(finalSource.identity, step.identity) ||
        finalTarget.state !== "confirmed_absent" ||
        finalLockedIdentity === null ||
        !sameIdentity(finalLockedIdentity, step.identity) ||
        !isFinalPriorRenameSequenceRetained
      ) {
        markUnknown(ledger);
        return {
          status: "blocked" as const,
          reason:
            finalBoundaryState === "verified"
              ? finalQuiescence === "unknown"
                ? "docker_desktop_repair_continuation_host_state_unknown"
                : "docker_desktop_repair_continuation_effect_precondition_unconfirmed"
              : effectBoundaryFailureReason(finalBoundaryState),
          ledger,
          operation,
        };
      }
      const outcome = renameDirectory(step.source, step.target, step.identity);
      const settlement = persistDockerDesktopRepairContinuationSettlement(
        boundary,
        operation,
        continuation,
        step.action,
        Object.freeze({
          issued: outcome.issued,
          confirmation: outcome.confirmation,
        }),
      );
      if (!settlement) {
        markUnknown(ledger);
        return {
          status: "blocked" as const,
          reason: `docker_desktop_repair_continuation_${step.action}_settlement_unknown`,
          ledger,
          operation,
        };
      }
      continuation = settlement;
      effect = continuationEffect(continuation, step.action);
    }
    const wasRelaunched =
      continuationEffect(continuation, "desktop_relaunch")?.phase === "settled";
    const retainedMatches = wasRelaunched
      ? retainedDirectoryWithReplacement(
          dependencies,
          step.source,
          step.target,
          step.identity,
        )
      : exactRetainedDirectory(
          dependencies,
          step.source,
          step.target,
          step.identity,
        );
    if (
      effect?.phase !== "settled" ||
      effect.issued !== true ||
      effect.confirmation !== "confirmed" ||
      !retainedMatches
    ) {
      markUnknown(ledger);
      return {
        status: "blocked" as const,
        reason: "docker_desktop_repair_continuation_rename_unconfirmed",
        ledger,
        operation,
      };
    }
  }

  let relaunch = continuationEffect(continuation, "desktop_relaunch");
  if (relaunch?.phase === "intent_recorded") {
    engine = dependencies.observeEngine(boundary);
    processes = await inspectProcessesWithinCancellation(session, cancellation);
    if (engine !== "ready" || processes !== "verified") {
      markUnknown(ledger);
      return {
        status: "blocked" as const,
        reason: "docker_desktop_repair_continuation_relaunch_unknown",
        ledger,
        operation,
      };
    }
    continuation =
      persistDockerDesktopRepairContinuationSettlement(
        boundary,
        operation,
        continuation,
        "desktop_relaunch",
        Object.freeze({ issued: true, confirmation: "confirmed" as const }),
      ) ?? continuation;
    relaunch = continuationEffect(continuation, "desktop_relaunch");
  }
  if (!relaunch) {
    const boundaryState = await verifyEffectBoundaryState(
      dependencies,
      boundary,
      session,
      cancellation,
    );
    const quiescence = await continuationHostQuiescence(
      dependencies,
      boundary,
      session,
      cancellation,
    );
    const isRenameSequenceRetained = renameSteps.every((step) =>
      exactRetainedDirectory(
        dependencies,
        step.source,
        step.target,
        step.identity,
      ),
    );
    if (
      boundaryState !== "verified" ||
      quiescence !== "verified" ||
      cancellation.shouldStop() ||
      !isRenameSequenceRetained
    ) {
      markUnknown(ledger);
      return {
        status: "blocked" as const,
        reason:
          boundaryState === "verified"
            ? cancellation.shouldStop()
              ? "docker_desktop_repair_cancelled_before_host_effect"
              : quiescence === "unknown"
                ? "docker_desktop_repair_continuation_host_state_unknown"
                : "docker_desktop_repair_continuation_effect_precondition_unconfirmed"
            : effectBoundaryFailureReason(boundaryState),
        ledger,
        operation,
      };
    }
    const intent = persistDockerDesktopRepairContinuationIntent(
      boundary,
      operation,
      continuation,
      "desktop_relaunch",
    );
    if (!intent) {
      markUnknown(ledger);
      return {
        status: "blocked" as const,
        reason: "docker_desktop_repair_continuation_record_update_failed",
        ledger,
        operation,
      };
    }
    continuation = intent;
    const finalBoundaryState = await verifyEffectBoundaryState(
      dependencies,
      boundary,
      session,
      cancellation,
    );
    const finalQuiescence = await continuationHostQuiescence(
      dependencies,
      boundary,
      session,
      cancellation,
    );
    const isFinalRenameSequenceRetained = renameSteps.every((step) =>
      exactRetainedDirectory(
        dependencies,
        step.source,
        step.target,
        step.identity,
      ),
    );
    if (
      finalBoundaryState !== "verified" ||
      finalQuiescence !== "verified" ||
      cancellation.shouldStop() ||
      !isFinalRenameSequenceRetained
    ) {
      markUnknown(ledger);
      return {
        status: "blocked" as const,
        reason:
          finalBoundaryState === "verified"
            ? finalQuiescence === "unknown"
              ? "docker_desktop_repair_continuation_host_state_unknown"
              : "docker_desktop_repair_continuation_effect_precondition_unconfirmed"
            : effectBoundaryFailureReason(finalBoundaryState),
        ledger,
        operation,
      };
    }
    const started = await session.launchDesktop();
    const outcome: TaggedEffect = Object.freeze({
      issued: started !== "not_started",
      confirmation:
        started === "started"
          ? "confirmed"
          : started === "not_started"
            ? "not_issued"
            : "unknown",
    });
    const settlement = persistDockerDesktopRepairContinuationSettlement(
      boundary,
      operation,
      continuation,
      "desktop_relaunch",
      outcome,
    );
    if (!settlement) {
      markUnknown(ledger);
      return {
        status: "blocked" as const,
        reason:
          "docker_desktop_repair_continuation_desktop_relaunch_settlement_unknown",
        ledger,
        operation,
      };
    }
    continuation = settlement;
    if (started !== "started") {
      markUnknown(ledger);
      return {
        status: "blocked" as const,
        reason: "docker_desktop_repair_continuation_relaunch_unconfirmed",
        ledger,
        operation,
      };
    }
    relaunch = continuationEffect(continuation, "desktop_relaunch");
  }
  if (
    relaunch?.phase !== "settled" ||
    relaunch.issued !== true ||
    relaunch.confirmation !== "confirmed"
  ) {
    markUnknown(ledger);
    return {
      status: "blocked" as const,
      reason: "docker_desktop_repair_continuation_relaunch_unconfirmed",
      ledger,
      operation,
    };
  }
  engine = await dependencies.awaitEngine(
    boundary,
    cancellation.shouldStop,
    cancellation.stopDetected,
  );
  const fresh = await observeFreshRuntimeState(
    dependencies,
    boundary,
    session,
    cancellation,
    operation,
  );
  const liveRun = fresh.run.identity;
  if (
    engine !== "ready" ||
    fresh.boundaryState !== "verified" ||
    fresh.processes !== "verified" ||
    fresh.run.state !== "present" ||
    !liveRun ||
    !continuationEffectsConfirmed(continuation) ||
    !continuationRuntimeGenerationsMatch(dependencies, boundary, continuation)
  ) {
    if (engine === "unknown" || fresh.boundaryState !== "verified")
      markUnknown(ledger);
    else ledger.hostSafety = "manual_recovery_required";
    return {
      status: "blocked" as const,
      reason:
        engine === "known_unavailable"
          ? "docker_desktop_engine_restart_unconfirmed"
          : "docker_desktop_engine_state_unknown",
      ledger,
      operation,
    };
  }
  if (continuation.stage !== "recovered") {
    const recovered = persistDockerDesktopRepairContinuationRecovered(
      boundary,
      operation,
      continuation,
    );
    if (!recovered) {
      markUnknown(ledger);
      return {
        status: "blocked" as const,
        reason: "docker_desktop_repair_continuation_record_update_failed",
        ledger,
        operation,
      };
    }
    continuation = recovered;
  }
  ledger.engineReady = true;
  ledger.hostSafety = "safe";
  ledger.evidenceState = "preserved";
  ledger.liveRunIdentity = liveRun;
  ledger.staleState = "retained";
  ledger.disposition = operation.history
    ? "historical_effect_unknown_pending_human_decision"
    : "pending_human_decision";
  if (operation.history)
    return {
      status: "historical_recovered_pending_close" as const,
      reason: "docker_desktop_repair_continuation_recovered_pending_close",
      ledger,
      operation,
    };
  const pending = await persistAfterLiveBoundary(
    dependencies,
    boundary,
    session,
    cancellation,
    operation,
    "recovered_pending_disposition",
    ledger,
    (state) =>
      state.boundaryState === "verified" &&
      state.engine === "ready" &&
      state.processes === "verified" &&
      state.run.state === "present" &&
      state.run.identity !== null &&
      sameIdentity(state.run.identity, liveRun),
  );
  return pending
    ? {
        status: "recovered_pending_close" as const,
        reason: "docker_desktop_repair_continuation_recovered_pending_close",
        ledger,
        operation: pending,
      }
    : {
        status: "blocked" as const,
        reason: "docker_desktop_repair_record_update_failed",
        ledger,
        operation,
      };
}

/**
 * failed Launch Continuation Requiredを決定する。
 *
 * @responsibility failed Launch Continuation Requiredの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input operation: DockerDesktopRepairOperation
 * @returns failedLaunchContinuationRequiredの計算結果を返す。
 * @precondition 「operation: DockerDesktopRepairOperation」がfailedLaunchContinuationRequiredの入力契約を満たす。
 * @postcondition failedLaunchContinuationRequiredの責務を完了した結果だけを返す。
 * @effect failedLaunchContinuationRequiredはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: failedLaunchContinuationRequiredは独自の失敗分岐を所有しない。
 * @invariant failedLaunchContinuationRequiredは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security failedLaunchContinuationRequiredはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: failedLaunchContinuationRequiredは共有非同期状態を持たない同期処理である。
 */
function failedLaunchContinuationRequired(
  operation: DockerDesktopRepairOperation,
) {
  return (
    operation.stage === "renamed" &&
    operation.ledger.processEffects.some(
      (entry) =>
        entry.action === "desktop_launch" &&
        entry.phase === "settled" &&
        entry.issued === true &&
        entry.confirmation === "confirmed",
    )
  );
}

/**
 * Repairを実行する。
 *
 * @responsibility Repairの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、existing: DockerDesktopRepairOperation | null
 * @returns executeRepairの計算結果を返す。
 * @precondition 「dependencies: RepairDependencies、boundary: PreparedBoundary、session: DockerDesktopRepairNativeHelperSession、existing: DockerDesktopRepairOperation | null」がexecuteRepairの入力契約を満たす。
 * @postcondition executeRepairの責務を完了した結果だけを返す。
 * @effect executeRepairはFilesystemの読取りまたは書込みを実行する。
 * @failure executeRepairは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeRepairは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security executeRepairはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency executeRepairは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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
    if (operation?.history) {
      const continuation = inspectDockerDesktopRepairContinuation(
        boundary,
        operation,
      );
      if (
        !operation.history.closed &&
        operation.history.currentSessionBound === true &&
        operation.stage === "renamed" &&
        (continuation.status !== "absent" ||
          failedLaunchContinuationRequired(operation))
      )
        return continueFailedDockerDesktopLaunch(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
        );
      return observeHistoricalRepair(
        dependencies,
        boundary,
        session,
        cancellation,
        operation,
      );
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
      const shutdownWasConfirmed =
        settledShutdown?.issued === true &&
        settledShutdown.confirmation === "confirmed";
      const wasShutdownObservedNotNeeded =
        settledShutdown?.issued === false &&
        settledShutdown.confirmation === "not_issued";
      if (
        settledShutdown &&
        !shutdownWasConfirmed &&
        !wasShutdownObservedNotNeeded
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
      if (wasShutdownObservedNotNeeded) {
        const shutdownPrecondition = await observeHostEffectPrecondition(
          dependencies,
          boundary,
          session,
          cancellation,
          operation,
          "official_shutdown",
        );
        if (shutdownPrecondition.state !== "known_not_needed") {
          markUnknown(ledger);
          reason = hostEffectPreconditionBlockReason(
            shutdownPrecondition,
            cancellation,
          );
          return { status, reason, ledger, operation };
        }
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
          } else if (
            shutdownPrecondition.state === "known_not_needed" &&
            settled
          ) {
            // A fresh same-boundary observation proved that Docker Desktop has
            // no process to shut down. Continue the lifecycle without issuing
            // a redundant host effect; a resumed operation must prove this
            // state again above before trusting the durable settlement.
          } else {
            markUnknown(ledger);
            reason = hostEffectPreconditionBlockReason(
              shutdownPrecondition,
              cancellation,
            );
          }
          if (shutdownPrecondition.state !== "known_not_needed" || !settled)
            return { status, reason, ledger, operation };
        }
        if (
          shutdownPrecondition.state === "proceed" &&
          !cancellation.effectAllowed()
        ) {
          markUnknown(ledger);
          reason = "docker_desktop_repair_cancelled_before_host_effect";
          return { status, reason, ledger, operation };
        }
        if (shutdownPrecondition.state === "proceed") {
          const shutdown = await dependencies.officialShutdown(
            boundary,
            operation,
            session,
          );
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
          if (
            shutdown.issued !== true ||
            shutdown.confirmation !== "confirmed"
          ) {
            if (shutdown.confirmation === "unknown") markUnknown(ledger);
            reason = "docker_desktop_official_shutdown_unconfirmed";
            return { status, reason, ledger, operation };
          }
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

/**
 * repair Windows Docker Desktop Runtime Using Dependenciesを決定する。
 *
 * @responsibility repair Windows Docker Desktop Runtime Using Dependenciesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RepairDependencies
 * @returns Promise<DockerDesktopRuntimeRepairReport>を返す。
 * @precondition 「dependencies: RepairDependencies」がrepairWindowsDockerDesktopRuntimeUsingDependenciesの入力契約を満たす。
 * @postcondition repairWindowsDockerDesktopRuntimeUsingDependenciesの責務を完了した結果だけを返す。
 * @effect N/A: repairWindowsDockerDesktopRuntimeUsingDependenciesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure repairWindowsDockerDesktopRuntimeUsingDependenciesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant repairWindowsDockerDesktopRuntimeUsingDependenciesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: repairWindowsDockerDesktopRuntimeUsingDependenciesはProcess内の同一Subsystemで完結する。
 * @security repairWindowsDockerDesktopRuntimeUsingDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency repairWindowsDockerDesktopRuntimeUsingDependenciesは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * Windows Docker Desktop Repair Using Dependenciesを終了する。
 *
 * @responsibility Windows Docker Desktop Repair Using Dependenciesの終了条件、資源解放、終了不能時の境界を所有する。
 * @trace ARCH-000008
 * @input repairId: unknown、dependencies: RepairDependencies
 * @returns Promise<DockerDesktopRuntimeRepairReport>を返す。
 * @precondition 「repairId: unknown、dependencies: RepairDependencies」がcloseWindowsDockerDesktopRepairUsingDependenciesの入力契約を満たす。
 * @postcondition closeWindowsDockerDesktopRepairUsingDependenciesの責務を完了した結果だけを返す。
 * @effect N/A: closeWindowsDockerDesktopRepairUsingDependenciesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure closeWindowsDockerDesktopRepairUsingDependenciesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant closeWindowsDockerDesktopRepairUsingDependenciesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: closeWindowsDockerDesktopRepairUsingDependenciesはProcess内の同一Subsystemで完結する。
 * @security closeWindowsDockerDesktopRepairUsingDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency closeWindowsDockerDesktopRepairUsingDependenciesは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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
      if (dependencies.history) {
        const isOriginalTerminal = originalRepairChainIsTerminal(operation);
        let closureObservation: Readonly<{
          liveRunIdentity: DockerDesktopRepairDirectoryIdentity;
          staleState: "absent" | "retained";
          reason: string;
        }> | null = null;
        if (
          status === "historical_recovered_pending_close" &&
          ledger.liveRunIdentity &&
          (ledger.staleState === "retained" || ledger.staleState === "absent")
        ) {
          const expectedRun = ledger.liveRunIdentity;
          const expectedStale =
            ledger.staleState === "retained" ? operation.runIdentity : null;
          const fresh = isOriginalTerminal
            ? null
            : await observeFreshRuntimeState(
                dependencies,
                boundary,
                session,
                cancellation,
                operation,
              );
          const continuationForClose = isOriginalTerminal
            ? Object.freeze({ status: "absent" as const, continuation: null })
            : inspectDockerDesktopRepairContinuation(boundary, operation);
          const isContinuationReadyForClose =
            (continuationForClose.status === "absent" &&
              !failedLaunchContinuationRequired(operation)) ||
            (continuationForClose.status === "valid" &&
              continuationForClose.continuation.stage === "recovered" &&
              continuationEffectsConfirmed(continuationForClose.continuation) &&
              continuationRuntimeGenerationsMatch(
                dependencies,
                boundary,
                continuationForClose.continuation,
              ));
          if (
            !isOriginalTerminal &&
            (!fresh ||
              !freshReadyStateMatches(fresh, expectedRun, expectedStale) ||
              !isContinuationReadyForClose)
          ) {
            markUnknown(ledger);
            status = "blocked";
            reason = "docker_desktop_repair_close_precondition_unconfirmed";
          } else {
            closureObservation = Object.freeze({
              liveRunIdentity: expectedRun,
              staleState: ledger.staleState,
              reason:
                "docker_desktop_repair_historical_evidence_retention_closed",
            });
          }
        } else if (status === "blocked" && !isOriginalTerminal) {
          const fresh = await observeFreshRuntimeState(
            dependencies,
            boundary,
            session,
            cancellation,
            operation,
          );
          const lockedRunIdentity =
            fresh.boundaryState === "verified" &&
            fresh.engine === "known_unavailable" &&
            (fresh.processes === "verified" || fresh.processes === "absent")
              ? dependencies.observeKnownSocketFailure(boundary)
              : null;
          const currentBoundary = dependencies.prepareBoundary();
          const currentRun = observePathUsing(
            dependencies,
            boundary.runDirectory,
          );
          const currentStale = observePathUsing(
            dependencies,
            operation.staleDirectory,
          );
          const retainedHistoricalStaleState =
            currentStale.state === "confirmed_absent"
              ? ("absent" as const)
              : currentStale.state === "present" &&
                  currentStale.identity !== null &&
                  sameIdentity(currentStale.identity, operation.runIdentity)
                ? ("retained" as const)
                : null;
          const noHostEffectWasIssued =
            historicalOperationHasNoIssuedHostEffect(operation);
          if (
            noHostEffectWasIssued &&
            fresh.boundaryState === "verified" &&
            currentBoundary !== null &&
            samePreparedAuthority(boundary, currentBoundary) &&
            currentRun.state === "present" &&
            currentRun.identity !== null &&
            fresh.run.identity !== null &&
            sameIdentity(currentRun.identity, fresh.run.identity) &&
            retainedHistoricalStaleState !== null
          ) {
            ledger.engineReady = fresh.engine === "ready";
            ledger.staleState = retainedHistoricalStaleState;
            ledger.hostSafety = "manual_recovery_required";
            ledger.evidenceState = "preserved";
            ledger.liveRunIdentity = currentRun.identity;
            ledger.disposition =
              "historical_effect_unknown_retained_by_human_decision";
            closureObservation = Object.freeze({
              liveRunIdentity: currentRun.identity,
              staleState: retainedHistoricalStaleState,
              reason:
                "docker_desktop_repair_historical_no_host_effect_retained_for_new_repair",
            });
          } else if (
            historicalBrokenRuntimeCanBeRetainedForNewRepair(
              fresh,
              lockedRunIdentity,
              operation.runIdentity,
            ) &&
            currentBoundary !== null &&
            samePreparedAuthority(boundary, currentBoundary) &&
            currentRun.state === "present" &&
            currentRun.identity !== null &&
            fresh.run.identity !== null &&
            sameIdentity(currentRun.identity, fresh.run.identity) &&
            retainedHistoricalStaleState !== null
          ) {
            const isSupersededRun = !sameIdentity(
              currentRun.identity,
              operation.runIdentity,
            );
            ledger.engineReady = false;
            ledger.staleState = retainedHistoricalStaleState;
            ledger.hostSafety = "manual_recovery_required";
            ledger.evidenceState = "preserved";
            ledger.liveRunIdentity = currentRun.identity;
            ledger.disposition =
              "historical_effect_unknown_retained_by_human_decision";
            closureObservation = Object.freeze({
              liveRunIdentity: currentRun.identity,
              staleState: retainedHistoricalStaleState,
              reason: isSupersededRun
                ? "docker_desktop_repair_historical_superseded_state_retained_for_new_repair"
                : "docker_desktop_repair_historical_broken_state_retained_for_new_repair",
            });
          }
        }
        if (closureObservation) {
          const closingManifest = dependencies.history.loadCurrentManifest();
          const closed = dependencies.history.persistClosure(
            boundary,
            operation,
            closureObservation,
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
            reason = closureObservation.reason;
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

/**
 * Windows Docker Desktop Repair Using Dependenciesを引き継ぐ。
 *
 * @responsibility Windows Docker Desktop Repair Using Dependenciesの引継ぎ条件、Identity結合、拒否境界を所有する。
 * @trace ARCH-000008
 * @input repairId: unknown、originRoot: unknown、dependencies: RepairDependencies
 * @returns Promise<DockerDesktopRuntimeRepairReport>を返す。
 * @precondition 「repairId: unknown、originRoot: unknown、dependencies: RepairDependencies」がadoptWindowsDockerDesktopRepairUsingDependenciesの入力契約を満たす。
 * @postcondition adoptWindowsDockerDesktopRepairUsingDependenciesの責務を完了した結果だけを返す。
 * @effect N/A: adoptWindowsDockerDesktopRepairUsingDependenciesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure adoptWindowsDockerDesktopRepairUsingDependenciesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant adoptWindowsDockerDesktopRepairUsingDependenciesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: adoptWindowsDockerDesktopRepairUsingDependenciesはProcess内の同一Subsystemで完結する。
 * @security adoptWindowsDockerDesktopRepairUsingDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency adoptWindowsDockerDesktopRepairUsingDependenciesは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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
          const isOriginalWasTerminal =
            originalRepairChainIsTerminal(operation);
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
            let isHistoryReady = true;
            if (!adopted.history.closed && isOriginalWasTerminal) {
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
                isHistoryReady = false;
              } else {
                operation = closed;
              }
            }
            if (isHistoryReady) {
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
            const currentInventory = isHistoryReady
              ? isOriginalWasTerminal
                ? durableInventoryState(dependencies, boundary)
                : inventoryState(dependencies, boundary)
              : null;
            if (
              (isHistoryReady && !currentInventory) ||
              (isHistoryReady &&
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
  observeRuntimeDirectoryLock,
  persistStage: persistDockerDesktopRepairStage,
  officialShutdown,
  terminateDockerWsl,
  renameRunDirectory,
  renameRuntimeDirectory,
  awaitEngine,
  identityAt,
  observePath,
});

/**
 * Runtime 所有 Windows Docker Desktop Repairを引き継ぐ。
 *
 * @responsibility Runtime 所有 Windows Docker Desktop Repairの引継ぎ条件、Identity結合、拒否境界を所有する。
 * @trace ARCH-000008
 * @input repairId: string、originRoot: string
 * @returns adoptRuntimeOwnedWindowsDockerDesktopRepairの計算結果を返す。
 * @precondition 「repairId: string、originRoot: string」がadoptRuntimeOwnedWindowsDockerDesktopRepairの入力契約を満たす。
 * @postcondition adoptRuntimeOwnedWindowsDockerDesktopRepairの責務を完了した結果だけを返す。
 * @effect N/A: adoptRuntimeOwnedWindowsDockerDesktopRepairは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: adoptRuntimeOwnedWindowsDockerDesktopRepairは独自の失敗分岐を所有しない。
 * @invariant adoptRuntimeOwnedWindowsDockerDesktopRepairは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: adoptRuntimeOwnedWindowsDockerDesktopRepairはProcess内の同一Subsystemで完結する。
 * @security adoptRuntimeOwnedWindowsDockerDesktopRepairはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: adoptRuntimeOwnedWindowsDockerDesktopRepairは共有非同期状態を持たない同期処理である。
 */
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

/**
 * repair Runtime 所有 Windows Docker Desktop Runtimeを決定する。
 *
 * @responsibility repair Runtime 所有 Windows Docker Desktop Runtimeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns repairRuntimeOwnedWindowsDockerDesktopRuntimeの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がrepairRuntimeOwnedWindowsDockerDesktopRuntimeの入力契約を満たす。
 * @postcondition repairRuntimeOwnedWindowsDockerDesktopRuntimeの責務を完了した結果だけを返す。
 * @effect N/A: repairRuntimeOwnedWindowsDockerDesktopRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: repairRuntimeOwnedWindowsDockerDesktopRuntimeは独自の失敗分岐を所有しない。
 * @invariant repairRuntimeOwnedWindowsDockerDesktopRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: repairRuntimeOwnedWindowsDockerDesktopRuntimeはProcess内の同一Subsystemで完結する。
 * @security repairRuntimeOwnedWindowsDockerDesktopRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: repairRuntimeOwnedWindowsDockerDesktopRuntimeは共有非同期状態を持たない同期処理である。
 */
export function repairRuntimeOwnedWindowsDockerDesktopRuntime() {
  return repairWindowsDockerDesktopRuntimeUsingDependencies(
    productionDependencies,
  );
}

/**
 * Runtime 所有 Windows Docker Desktop Repairを終了する。
 *
 * @responsibility Runtime 所有 Windows Docker Desktop Repairの終了条件、資源解放、終了不能時の境界を所有する。
 * @trace ARCH-000008
 * @input repairId: unknown
 * @returns closeRuntimeOwnedWindowsDockerDesktopRepairの計算結果を返す。
 * @precondition 「repairId: unknown」がcloseRuntimeOwnedWindowsDockerDesktopRepairの入力契約を満たす。
 * @postcondition closeRuntimeOwnedWindowsDockerDesktopRepairの責務を完了した結果だけを返す。
 * @effect N/A: closeRuntimeOwnedWindowsDockerDesktopRepairは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: closeRuntimeOwnedWindowsDockerDesktopRepairは独自の失敗分岐を所有しない。
 * @invariant closeRuntimeOwnedWindowsDockerDesktopRepairは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: closeRuntimeOwnedWindowsDockerDesktopRepairはProcess内の同一Subsystemで完結する。
 * @security closeRuntimeOwnedWindowsDockerDesktopRepairはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: closeRuntimeOwnedWindowsDockerDesktopRepairは共有非同期状態を持たない同期処理である。
 */
export function closeRuntimeOwnedWindowsDockerDesktopRepair(repairId: unknown) {
  return closeWindowsDockerDesktopRepairUsingDependencies(
    repairId,
    productionDependencies,
  );
}

/**
 * Docker Desktop Runtime Repair 契約の公開契約を記述する。
 *
 * @responsibility Docker Desktop Runtime Repair 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDockerDesktopRuntimeRepairContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDockerDesktopRuntimeRepairContractの入力契約を満たす。
 * @postcondition describeDockerDesktopRuntimeRepairContractの責務を完了した結果だけを返す。
 * @effect describeDockerDesktopRuntimeRepairContractはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: describeDockerDesktopRuntimeRepairContractは独自の失敗分岐を所有しない。
 * @invariant describeDockerDesktopRuntimeRepairContractは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security describeDockerDesktopRuntimeRepairContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDockerDesktopRuntimeRepairContractは共有非同期状態を持たない同期処理である。
 */
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
      "official_fixed_paths_valid_docker_inc_publisher_and_same_operation_identity_hash",
    exactDockerVersionRequired: false,
    crossOperationArtifactHashPinning: false,
    sameOperationArtifactIdentityRequired: true,
    dockerInstallationAttestation: false,
    officialDockerDistributionAndUpdaterInTrustedComputingBase: true,
    wslTermination: "docker_desktop_distribution_only",
    filesystemEffects: Object.freeze([
      "bounded_protected_runtime_state_repair_records",
      "same_parent_run_directory_rename_without_deletion",
      "failed_launch_runtime_regions_same_parent_rename_without_deletion",
    ]),
    failedLaunchContinuation:
      "same_repair_id_append_only_run_generation_and_secrets_engine_repair",
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
