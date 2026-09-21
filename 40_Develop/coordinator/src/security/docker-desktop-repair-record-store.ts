/**
 * docker-desktop-repair-record-storeに属する責務をまとめる。
 *
 * @responsibility parseDockerDesktopRepairDirectoryNameを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  publishRepairHistoryFileUsingOperations,
  type RepairHistoryPublicationOperations,
} from "./docker-desktop-repair-history-publication.ts";
import { getPinnedPlatformProvisionerReleaseSignerSpkiDer } from "./platform-provisioner-release-trust.ts";
import { verifyHistoricalPlatformProvisionerManifestCandidate } from "./platform-provisioner-trust-core.ts";

export const DOCKER_DESKTOP_REPAIR_RECORD_SCHEMA =
  "crdd-coordinator/docker-desktop-repair-record/v4";
const OPERATION_PREFIX = "docker-desktop-repair-";
/**
 * Docker Desktop Repair Directory Nameを構造化値へ解析する。
 *
 * @responsibility Docker Desktop Repair Directory Nameの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns parseDockerDesktopRepairDirectoryNameの計算結果を返す。
 * @precondition 「value: unknown」がparseDockerDesktopRepairDirectoryNameの入力契約を満たす。
 * @postcondition parseDockerDesktopRepairDirectoryNameの責務を完了した結果だけを返す。
 * @effect N/A: parseDockerDesktopRepairDirectoryNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseDockerDesktopRepairDirectoryNameは独自の失敗分岐を所有しない。
 * @invariant parseDockerDesktopRepairDirectoryNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security parseDockerDesktopRepairDirectoryNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseDockerDesktopRepairDirectoryNameは共有非同期状態を持たない同期処理である。
 */
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
const HISTORY_POLICY_TRANSITION_SCHEMA =
  "crdd-coordinator/docker-desktop-repair-history/v3";
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
/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Stageの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair StageのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairStageが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairStageで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairStageの宣言は外部境界を開かない。
 * @security DockerDesktopRepairStageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairStageの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairStage =
  (typeof DOCKER_DESKTOP_REPAIR_STAGES)[number];
/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Tri 状態の値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Tri 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairTriStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairTriStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairTriStateの宣言は外部境界を開かない。
 * @security DockerDesktopRepairTriStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairTriStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairTriState = boolean | null;
/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Stale 状態の値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Stale 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairStaleStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairStaleStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairStaleStateの宣言は外部境界を開かない。
 * @security DockerDesktopRepairStaleStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairStaleStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairStaleState = "absent" | "retained" | "unknown";
/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Host Safetyの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Host SafetyのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairHostSafetyが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairHostSafetyで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairHostSafetyの宣言は外部境界を開かない。
 * @security DockerDesktopRepairHostSafetyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairHostSafetyの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairHostSafety =
  | "safe"
  | "manual_recovery_required"
  | "unknown";
/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Evidence 状態の値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Evidence 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairEvidenceStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairEvidenceStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairEvidenceStateの宣言は外部境界を開かない。
 * @security DockerDesktopRepairEvidenceStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairEvidenceStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairEvidenceState =
  | "preserved"
  | "not_preserved"
  | "unknown";
/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Dispositionの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair DispositionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairDispositionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairDispositionで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairDispositionの宣言は外部境界を開かない。
 * @security DockerDesktopRepairDispositionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairDispositionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairDisposition =
  | "not_applicable"
  | "pending_human_decision"
  | "known_effect_recovery_pending_human_decision"
  | "historical_effect_unknown_pending_human_decision"
  | "retained_by_human_decision"
  | "known_effect_recovery_retained_by_human_decision"
  | "historical_effect_unknown_retained_by_human_decision";
/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Effect Confirmationの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Effect ConfirmationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairEffectConfirmationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairEffectConfirmationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairEffectConfirmationの宣言は外部境界を開かない。
 * @security DockerDesktopRepairEffectConfirmationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairEffectConfirmationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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
/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Effect Actionの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Effect ActionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairEffectActionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairEffectActionで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairEffectActionの宣言は外部境界を開かない。
 * @security DockerDesktopRepairEffectActionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairEffectActionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairEffectAction =
  (typeof DOCKER_DESKTOP_REPAIR_EFFECT_ACTIONS)[number];
/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Effect Phaseの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Effect PhaseのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairEffectPhaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairEffectPhaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairEffectPhaseの宣言は外部境界を開かない。
 * @security DockerDesktopRepairEffectPhaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairEffectPhaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairEffectPhase = "intent_recorded" | "settled";
/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Effect Entryの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Effect EntryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairEffectEntryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairEffectEntryで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairEffectEntryの宣言は外部境界を開かない。
 * @security DockerDesktopRepairEffectEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairEffectEntryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairEffectEntry = Readonly<{
  sequence: number;
  action: DockerDesktopRepairEffectAction;
  phase: DockerDesktopRepairEffectPhase;
  issued: DockerDesktopRepairTriState;
  confirmation: DockerDesktopRepairEffectConfirmation;
}>;

/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Directory Identityの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Directory IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairDirectoryIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairDirectoryIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairDirectoryIdentityの宣言は外部境界を開かない。
 * @security DockerDesktopRepairDirectoryIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairDirectoryIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairDirectoryIdentity = Readonly<{
  dev: string;
  ino: string;
  birthtimeNs: string;
}>;

/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Ledger Snapshotの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Ledger SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairLedgerSnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairLedgerSnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairLedgerSnapshotの宣言は外部境界を開かない。
 * @security DockerDesktopRepairLedgerSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairLedgerSnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Operationの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair OperationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairOperationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairOperationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairOperationの宣言は外部境界を開かない。
 * @security DockerDesktopRepairOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairOperationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * docker-desktop-repair-record-storeで使用するCanonical Docker Desktop Repair History Modeの値契約を定義する。
 *
 * @responsibility Canonical Docker Desktop Repair History ModeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape CanonicalDockerDesktopRepairHistoryModeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CanonicalDockerDesktopRepairHistoryModeで宣言した値と責務の対応を維持する。
 * @boundary N/A: CanonicalDockerDesktopRepairHistoryModeの宣言は外部境界を開かない。
 * @security CanonicalDockerDesktopRepairHistoryModeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CanonicalDockerDesktopRepairHistoryModeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CanonicalDockerDesktopRepairHistoryMode =
  | "invalid"
  | "no_history"
  | "open_current"
  | "open_prior"
  | "closed";

/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Expected Closureの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Expected ClosureのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairExpectedClosureが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairExpectedClosureで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairExpectedClosureの宣言は外部境界を開かない。
 * @security DockerDesktopRepairExpectedClosureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairExpectedClosureの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairExpectedClosure = Readonly<{
  liveRunIdentity: DockerDesktopRepairDirectoryIdentity;
  staleState: "absent" | "retained";
}>;

/**
 * History Entryかを判定する。
 *
 * @responsibility History Entryの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input name: string
 * @returns isHistoryEntryの計算結果を返す。
 * @precondition 「name: string」がisHistoryEntryの入力契約を満たす。
 * @postcondition isHistoryEntryの責務を完了した結果だけを返す。
 * @effect N/A: isHistoryEntryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isHistoryEntryは独自の失敗分岐を所有しない。
 * @invariant isHistoryEntryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security isHistoryEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isHistoryEntryは共有非同期状態を持たない同期処理である。
 */
function isHistoryEntry(name: string) {
  return (
    HISTORY_FILES.includes(name) ||
    HISTORY_HANDOFF_FILE.test(name) ||
    knownHistoryPreparationTarget(name) !== null
  );
}

/**
 * history Preparation Nameを決定する。
 *
 * @responsibility history Preparation Nameの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input name: string
 * @returns historyPreparationNameの計算結果を返す。
 * @precondition 「name: string」がhistoryPreparationNameの入力契約を満たす。
 * @postcondition historyPreparationNameの責務を完了した結果だけを返す。
 * @effect N/A: historyPreparationNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: historyPreparationNameは独自の失敗分岐を所有しない。
 * @invariant historyPreparationNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security historyPreparationNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: historyPreparationNameは共有非同期状態を持たない同期処理である。
 */
function historyPreparationName(name: string) {
  return `.crdd-history-${createHash("sha256").update(name).digest("hex")}.prepare`;
}

/**
 * known History Target Namesを決定する。
 *
 * @responsibility known History Target Namesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns knownHistoryTargetNamesの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がknownHistoryTargetNamesの入力契約を満たす。
 * @postcondition knownHistoryTargetNamesの責務を完了した結果だけを返す。
 * @effect N/A: knownHistoryTargetNamesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: knownHistoryTargetNamesは独自の失敗分岐を所有しない。
 * @invariant knownHistoryTargetNamesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security knownHistoryTargetNamesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: knownHistoryTargetNamesは共有非同期状態を持たない同期処理である。
 */
function knownHistoryTargetNames() {
  return [
    ...HISTORY_FILES,
    ...Array.from(
      { length: MAXIMUM_HISTORY_HANDOFFS },
      (_unused, sequence) =>
        `historical-handoff-${String(sequence).padStart(2, "0")}.json`,
    ),
  ];
}

/**
 * known History Preparation Targetを決定する。
 *
 * @responsibility known History Preparation Targetの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input name: string
 * @returns knownHistoryPreparationTargetの計算結果を返す。
 * @precondition 「name: string」がknownHistoryPreparationTargetの入力契約を満たす。
 * @postcondition knownHistoryPreparationTargetの責務を完了した結果だけを返す。
 * @effect N/A: knownHistoryPreparationTargetは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: knownHistoryPreparationTargetは独自の失敗分岐を所有しない。
 * @invariant knownHistoryPreparationTargetは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security knownHistoryPreparationTargetはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: knownHistoryPreparationTargetは共有非同期状態を持たない同期処理である。
 */
function knownHistoryPreparationTarget(name: string) {
  return (
    knownHistoryTargetNames().find(
      (targetName) => historyPreparationName(targetName) === name,
    ) ?? null
  );
}

/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair 記録 Boundaryの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair 記録 BoundaryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairRecordBoundaryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairRecordBoundaryで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairRecordBoundaryの宣言は外部境界を開かない。
 * @security DockerDesktopRepairRecordBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairRecordBoundaryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * docker-desktop-repair-record-storeで使用するHistorical Release Identityの値契約を定義する。
 *
 * @responsibility Historical Release IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HistoricalReleaseIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HistoricalReleaseIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: HistoricalReleaseIdentityの宣言は外部境界を開かない。
 * @security HistoricalReleaseIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HistoricalReleaseIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HistoricalReleaseIdentity = Readonly<{
  manifestHash: string;
  releaseSequence: number;
  runtimeExecutionIdentitySha256: string | null;
  crddTree: string;
  packageContentRootSha256: string;
}>;

/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair History Verifierの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair History VerifierのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairHistoryVerifierが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairHistoryVerifierで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairHistoryVerifierの宣言は外部境界を開かない。
 * @security DockerDesktopRepairHistoryVerifierはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairHistoryVerifierの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairHistoryVerifier = (
  envelope: unknown,
) => HistoricalReleaseIdentity | null;

/**
 * Pinned Historyを検証する。
 *
 * @responsibility Pinned Historyの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input envelope: unknown
 * @returns HistoricalReleaseIdentity | nullを返す。
 * @precondition 「envelope: unknown」がverifyPinnedHistoryの入力契約を満たす。
 * @postcondition verifyPinnedHistoryの責務を完了した結果だけを返す。
 * @effect N/A: verifyPinnedHistoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyPinnedHistoryは独自の失敗分岐を所有しない。
 * @invariant verifyPinnedHistoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security verifyPinnedHistoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyPinnedHistoryは共有非同期状態を持たない同期処理である。
 */
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

/**
 * docker-desktop-repair-record-storeで使用するStored 記録の値契約を定義する。
 *
 * @responsibility Stored 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape StoredRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StoredRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: StoredRecordの宣言は外部境界を開かない。
 * @security StoredRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StoredRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * docker-desktop-repair-record-storeで使用するHistorical V4 Stored 記録の値契約を定義する。
 *
 * @responsibility Historical V4 Stored 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HistoricalV4StoredRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HistoricalV4StoredRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: HistoricalV4StoredRecordの宣言は外部境界を開かない。
 * @security HistoricalV4StoredRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HistoricalV4StoredRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * docker-desktop-repair-record-storeで使用するReadable Stored 記録の値契約を定義する。
 *
 * @responsibility Readable Stored 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ReadableStoredRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ReadableStoredRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: ReadableStoredRecordの宣言は外部境界を開かない。
 * @security ReadableStoredRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ReadableStoredRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ReadableStoredRecord = StoredRecord | HistoricalV4StoredRecord;

/**
 * Keysが完全一致するか判定する。
 *
 * @responsibility Keysの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: object、expectedItems: readonly string[]
 * @returns exactKeysの計算結果を返す。
 * @precondition 「value: object、expectedItems: readonly string[]」がexactKeysの入力契約を満たす。
 * @postcondition exactKeysの責務を完了した結果だけを返す。
 * @effect N/A: exactKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactKeysは独自の失敗分岐を所有しない。
 * @invariant exactKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security exactKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactKeysは共有非同期状態を持たない同期処理である。
 */
function exactKeys(value: object, expectedItems: readonly string[]) {
  const actualItems = Reflect.ownKeys(value);
  return (
    actualItems.length === expectedItems.length &&
    expectedItems.every((key) => actualItems.includes(key))
  );
}

/**
 * Own Data Valuesが完全一致するか判定する。
 *
 * @responsibility Own Data Valuesの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedItems: readonly string[]
 * @returns Readonly<Record<string, unknown>> | nullを返す。
 * @precondition 「value: unknown、expectedItems: readonly string[]」がexactOwnDataValuesの入力契約を満たす。
 * @postcondition exactOwnDataValuesの責務を完了した結果だけを返す。
 * @effect N/A: exactOwnDataValuesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure exactOwnDataValuesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant exactOwnDataValuesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security exactOwnDataValuesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactOwnDataValuesは共有非同期状態を持たない同期処理である。
 */
function exactOwnDataValues(
  value: unknown,
  expectedItems: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      !exactKeys(value, expectedItems)
    )
      return null;
    const result: Record<string, unknown> = Object.create(null);
    for (const key of expectedItems) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Only Own Data Descriptorsを含むか判定する。
 *
 * @responsibility Only Own Data Descriptorsの探索範囲、包含条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、seen
 * @returns booleanを返す。
 * @precondition 「value: unknown、seen」がcontainsOnlyOwnDataDescriptorsの入力契約を満たす。
 * @postcondition containsOnlyOwnDataDescriptorsの責務を完了した結果だけを返す。
 * @effect N/A: containsOnlyOwnDataDescriptorsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure containsOnlyOwnDataDescriptorsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant containsOnlyOwnDataDescriptorsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security containsOnlyOwnDataDescriptorsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: containsOnlyOwnDataDescriptorsは共有非同期状態を持たない同期処理である。
 */
function containsOnlyOwnDataDescriptors(
  value: unknown,
  seen = new Set<object>(),
): boolean {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function")
  )
    return true;
  if (seen.has(value)) return false;
  seen.add(value);
  try {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) return false;
      if (!containsOnlyOwnDataDescriptors(descriptor.value, seen)) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    seen.delete(value);
  }
}

/**
 * dense Own Data Array Valuesを決定する。
 *
 * @responsibility dense Own Data Array Valuesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、maximumLength: number
 * @returns readonly unknown[] | nullを返す。
 * @precondition 「value: unknown、maximumLength: number」がdenseOwnDataArrayValuesの入力契約を満たす。
 * @postcondition denseOwnDataArrayValuesの責務を完了した結果だけを返す。
 * @effect N/A: denseOwnDataArrayValuesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure denseOwnDataArrayValuesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant denseOwnDataArrayValuesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security denseOwnDataArrayValuesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: denseOwnDataArrayValuesは共有非同期状態を持たない同期処理である。
 */
function denseOwnDataArrayValues(
  value: unknown,
  maximumLength: number,
): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    )
      return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !lengthDescriptor ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximumLength
    )
      return null;
    const indexKeys = Array.from(
      { length: lengthDescriptor.value },
      (_unused, index) => String(index),
    );
    if (!exactKeys(value, [...indexKeys, "length"])) return null;
    const resultItems: unknown[] = [];
    for (const key of indexKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) return null;
      resultItems.push(descriptor.value);
    }
    return resultItems;
  } catch {
    return null;
  }
}

/**
 * hash64を決定する。
 *
 * @responsibility hash64の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がhash64の入力契約を満たす。
 * @postcondition hash64の責務を完了した結果だけを返す。
 * @effect N/A: hash64は入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hash64は独自の失敗分岐を所有しない。
 * @invariant hash64は入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security hash64はAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hash64は共有非同期状態を持たない同期処理である。
 */
function hash64(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

/**
 * operation Idを決定する。
 *
 * @responsibility operation Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がoperationIdの入力契約を満たす。
 * @postcondition operationIdの責務を完了した結果だけを返す。
 * @effect N/A: operationIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: operationIdは独自の失敗分岐を所有しない。
 * @invariant operationIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security operationIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: operationIdは共有非同期状態を持たない同期処理である。
 */
function operationId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/u.test(value);
}

/**
 * Integer Stringを安全条件の下で処理する。
 *
 * @responsibility Integer Stringの安全条件、拒否条件、終了結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がsafeIntegerStringの入力契約を満たす。
 * @postcondition safeIntegerStringの責務を完了した結果だけを返す。
 * @effect N/A: safeIntegerStringは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: safeIntegerStringは独自の失敗分岐を所有しない。
 * @invariant safeIntegerStringは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security safeIntegerStringはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: safeIntegerStringは共有非同期状態を持たない同期処理である。
 */
function safeIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9][0-9]{0,39})$/u.test(value);
}

/**
 * Identityが有効か判定する。
 *
 * @responsibility Identityの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is DockerDesktopRepairDirectoryIdentityを返す。
 * @precondition 「value: unknown」がvalidIdentityの入力契約を満たす。
 * @postcondition validIdentityの責務を完了した結果だけを返す。
 * @effect N/A: validIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdentityは独自の失敗分岐を所有しない。
 * @invariant validIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validIdentityは共有非同期状態を持たない同期処理である。
 */
function validIdentity(
  value: unknown,
): value is DockerDesktopRepairDirectoryIdentity {
  const fields = exactOwnDataValues(value, ["dev", "ino", "birthtimeNs"]);
  return (
    fields !== null &&
    safeIntegerString(fields.dev) &&
    safeIntegerString(fields.ino) &&
    safeIntegerString(fields.birthtimeNs) &&
    fields.dev !== "0" &&
    fields.ino !== "0" &&
    fields.birthtimeNs !== "0"
  );
}

/**
 * Tri 状態が有効か判定する。
 *
 * @responsibility Tri 状態の有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is DockerDesktopRepairTriStateを返す。
 * @precondition 「value: unknown」がvalidTriStateの入力契約を満たす。
 * @postcondition validTriStateの責務を完了した結果だけを返す。
 * @effect N/A: validTriStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTriStateは独自の失敗分岐を所有しない。
 * @invariant validTriStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validTriStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validTriStateは共有非同期状態を持たない同期処理である。
 */
function validTriState(value: unknown): value is DockerDesktopRepairTriState {
  return value === true || value === false || value === null;
}

/**
 * Ledgerが有効か判定する。
 *
 * @responsibility Ledgerの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is DockerDesktopRepairLedgerSnapshotを返す。
 * @precondition 「value: unknown」がvalidLedgerの入力契約を満たす。
 * @postcondition validLedgerの責務を完了した結果だけを返す。
 * @effect N/A: validLedgerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validLedgerは独自の失敗分岐を所有しない。
 * @invariant validLedgerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validLedgerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validLedgerは共有非同期状態を持たない同期処理である。
 */
function validLedger(
  value: unknown,
): value is DockerDesktopRepairLedgerSnapshot {
  const fields = exactOwnDataValues(value, [
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
  ]);
  if (!fields) return false;
  const processEffects = fields.processEffects;
  const filesystemEffects = fields.filesystemEffects;
  return (
    validEffectEntries(processEffects, "process") &&
    validEffectEntries(filesystemEffects, "filesystem") &&
    validTriState(fields.processEffectIssued) &&
    ["not_issued", "confirmed", "unknown"].includes(
      String(fields.processEffectConfirmation),
    ) &&
    validTriState(fields.filesystemEffectIssued) &&
    ["not_issued", "confirmed", "unknown"].includes(
      String(fields.filesystemEffectConfirmation),
    ) &&
    validTriState(fields.engineReady) &&
    ["absent", "retained", "unknown"].includes(String(fields.staleState)) &&
    ["safe", "manual_recovery_required", "unknown"].includes(
      String(fields.hostSafety),
    ) &&
    ["preserved", "not_preserved", "unknown"].includes(
      String(fields.evidenceState),
    ) &&
    [
      "not_applicable",
      "pending_human_decision",
      "known_effect_recovery_pending_human_decision",
      "historical_effect_unknown_pending_human_decision",
      "retained_by_human_decision",
      "known_effect_recovery_retained_by_human_decision",
      "historical_effect_unknown_retained_by_human_decision",
    ].includes(String(fields.disposition)) &&
    (fields.liveRunIdentity === null ||
      validIdentity(fields.liveRunIdentity)) &&
    aggregateMatches(
      processEffects,
      fields.processEffectIssued,
      fields.processEffectConfirmation,
    ) &&
    aggregateMatches(
      filesystemEffects,
      fields.filesystemEffectIssued,
      fields.filesystemEffectConfirmation,
    )
  );
}

/**
 * Effect Entriesが有効か判定する。
 *
 * @responsibility Effect Entriesの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、kind: "process" | "filesystem"
 * @returns value is readonly DockerDesktopRepairEffectEntry[]を返す。
 * @precondition 「value: unknown、kind: "process" | "filesystem"」がvalidEffectEntriesの入力契約を満たす。
 * @postcondition validEffectEntriesの責務を完了した結果だけを返す。
 * @effect validEffectEntriesはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: validEffectEntriesは独自の失敗分岐を所有しない。
 * @invariant validEffectEntriesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validEffectEntriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validEffectEntriesは共有非同期状態を持たない同期処理である。
 */
function validEffectEntries(
  value: unknown,
  kind: "process" | "filesystem",
): value is readonly DockerDesktopRepairEffectEntry[] {
  const rawEntries = denseOwnDataArrayValues(value, MAXIMUM_RECORDS * 2);
  if (!rawEntries) return false;
  const entries: DockerDesktopRepairEffectEntry[] = [];
  for (const [index, entry] of rawEntries.entries()) {
    const fields = exactOwnDataValues(entry, [
      "sequence",
      "action",
      "phase",
      "issued",
      "confirmation",
    ]);
    if (
      !fields ||
      fields.sequence !== index ||
      !DOCKER_DESKTOP_REPAIR_EFFECT_ACTIONS.includes(
        fields.action as DockerDesktopRepairEffectAction,
      ) ||
      !["intent_recorded", "settled"].includes(String(fields.phase)) ||
      (fields.phase !== "settled" &&
        (fields.issued !== null || fields.confirmation !== "unknown")) ||
      (fields.action === "record_write" && fields.phase !== "settled") ||
      !validTriState(fields.issued) ||
      !["not_issued", "confirmed", "unknown"].includes(
        String(fields.confirmation),
      ) ||
      !confirmationCompatible(
        fields.issued as DockerDesktopRepairTriState,
        fields.confirmation as DockerDesktopRepairEffectConfirmation,
      )
    )
      return false;
    entries.push(fields as DockerDesktopRepairEffectEntry);
  }
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

/**
 * Effect Entriesを集約する。
 *
 * @responsibility Effect Entriesの集約入力、重複処理、集約結果の境界を所有する。
 * @trace ARCH-000008
 * @input entries: readonly DockerDesktopRepairEffectEntry[]
 * @returns aggregateEffectEntriesの計算結果を返す。
 * @precondition 「entries: readonly DockerDesktopRepairEffectEntry[]」がaggregateEffectEntriesの入力契約を満たす。
 * @postcondition aggregateEffectEntriesの責務を完了した結果だけを返す。
 * @effect N/A: aggregateEffectEntriesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: aggregateEffectEntriesは独自の失敗分岐を所有しない。
 * @invariant aggregateEffectEntriesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security aggregateEffectEntriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: aggregateEffectEntriesは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Matchesを集約する。
 *
 * @responsibility Matchesの集約入力、重複処理、集約結果の境界を所有する。
 * @trace ARCH-000008
 * @input entries: readonly DockerDesktopRepairEffectEntry[]、issued: unknown、confirmation: unknown
 * @returns aggregateMatchesの計算結果を返す。
 * @precondition 「entries: readonly DockerDesktopRepairEffectEntry[]、issued: unknown、confirmation: unknown」がaggregateMatchesの入力契約を満たす。
 * @postcondition aggregateMatchesの責務を完了した結果だけを返す。
 * @effect N/A: aggregateMatchesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: aggregateMatchesは独自の失敗分岐を所有しない。
 * @invariant aggregateMatchesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security aggregateMatchesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: aggregateMatchesは共有非同期状態を持たない同期処理である。
 */
function aggregateMatches(
  entries: readonly DockerDesktopRepairEffectEntry[],
  issued: unknown,
  confirmation: unknown,
) {
  const aggregate = aggregateEffectEntries(entries);
  return aggregate.issued === issued && aggregate.confirmation === confirmation;
}

/**
 * Stored 記録が有効か判定する。
 *
 * @responsibility Stored 記録の有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、boundary: DockerDesktopRepairRecordBoundary
 * @returns value is ReadableStoredRecordを返す。
 * @precondition 「value: unknown、boundary: DockerDesktopRepairRecordBoundary」がvalidStoredRecordの入力契約を満たす。
 * @postcondition validStoredRecordの責務を完了した結果だけを返す。
 * @effect N/A: validStoredRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validStoredRecordは独自の失敗分岐を所有しない。
 * @invariant validStoredRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validStoredRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validStoredRecordは共有非同期状態を持たない同期処理である。
 */
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

/**
 * confirmation Compatibleを決定する。
 *
 * @responsibility confirmation Compatibleの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input isIssued: DockerDesktopRepairTriState、confirmation: DockerDesktopRepairEffectConfirmation
 * @returns confirmationCompatibleの計算結果を返す。
 * @precondition 「isIssued: DockerDesktopRepairTriState、confirmation: DockerDesktopRepairEffectConfirmation」がconfirmationCompatibleの入力契約を満たす。
 * @postcondition confirmationCompatibleの責務を完了した結果だけを返す。
 * @effect N/A: confirmationCompatibleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: confirmationCompatibleは独自の失敗分岐を所有しない。
 * @invariant confirmationCompatibleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security confirmationCompatibleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: confirmationCompatibleは共有非同期状態を持たない同期処理である。
 */
function confirmationCompatible(
  isIssued: DockerDesktopRepairTriState,
  confirmation: DockerDesktopRepairEffectConfirmation,
) {
  if (isIssued === false) return confirmation === "not_issued";
  if (isIssued === true) return confirmation !== "not_issued";
  return confirmation === "unknown";
}

/**
 * legal Effect Entries Transitionを決定する。
 *
 * @responsibility legal Effect Entries Transitionの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input previous: readonly DockerDesktopRepairEffectEntry[]、nextItems: readonly DockerDesktopRepairEffectEntry[]
 * @returns legalEffectEntriesTransitionの計算結果を返す。
 * @precondition 「previous: readonly DockerDesktopRepairEffectEntry[]、nextItems: readonly DockerDesktopRepairEffectEntry[]」がlegalEffectEntriesTransitionの入力契約を満たす。
 * @postcondition legalEffectEntriesTransitionの責務を完了した結果だけを返す。
 * @effect N/A: legalEffectEntriesTransitionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: legalEffectEntriesTransitionは独自の失敗分岐を所有しない。
 * @invariant legalEffectEntriesTransitionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security legalEffectEntriesTransitionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: legalEffectEntriesTransitionは共有非同期状態を持たない同期処理である。
 */
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

/**
 * changed Effect Countを決定する。
 *
 * @responsibility changed Effect Countの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input previous: readonly DockerDesktopRepairEffectEntry[]、nextItems: readonly DockerDesktopRepairEffectEntry[]
 * @returns changedEffectCountの計算結果を返す。
 * @precondition 「previous: readonly DockerDesktopRepairEffectEntry[]、nextItems: readonly DockerDesktopRepairEffectEntry[]」がchangedEffectCountの入力契約を満たす。
 * @postcondition changedEffectCountの責務を完了した結果だけを返す。
 * @effect N/A: changedEffectCountは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: changedEffectCountは独自の失敗分岐を所有しない。
 * @invariant changedEffectCountは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security changedEffectCountはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: changedEffectCountは共有非同期状態を持たない同期処理である。
 */
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

/**
 * 記録 Write Deltaが有効か判定する。
 *
 * @responsibility 記録 Write Deltaの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input previous: readonly DockerDesktopRepairEffectEntry[]、nextItems: readonly DockerDesktopRepairEffectEntry[]
 * @returns validRecordWriteDeltaの計算結果を返す。
 * @precondition 「previous: readonly DockerDesktopRepairEffectEntry[]、nextItems: readonly DockerDesktopRepairEffectEntry[]」がvalidRecordWriteDeltaの入力契約を満たす。
 * @postcondition validRecordWriteDeltaの責務を完了した結果だけを返す。
 * @effect N/A: validRecordWriteDeltaは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRecordWriteDeltaは独自の失敗分岐を所有しない。
 * @invariant validRecordWriteDeltaは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validRecordWriteDeltaはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validRecordWriteDeltaは共有非同期状態を持たない同期処理である。
 */
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

/**
 * legal Ledger Transitionを決定する。
 *
 * @responsibility legal Ledger Transitionの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input previous: DockerDesktopRepairLedgerSnapshot | null、next: DockerDesktopRepairLedgerSnapshot
 * @returns legalLedgerTransitionの計算結果を返す。
 * @precondition 「previous: DockerDesktopRepairLedgerSnapshot | null、next: DockerDesktopRepairLedgerSnapshot」がlegalLedgerTransitionの入力契約を満たす。
 * @postcondition legalLedgerTransitionの責務を完了した結果だけを返す。
 * @effect N/A: legalLedgerTransitionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: legalLedgerTransitionは独自の失敗分岐を所有しない。
 * @invariant legalLedgerTransitionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security legalLedgerTransitionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: legalLedgerTransitionは共有非同期状態を持たない同期処理である。
 */
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
    ((previousShutdown.issued === true &&
      previousShutdown.confirmation === "confirmed") ||
      (previousShutdown.issued === false &&
        previousShutdown.confirmation === "not_issued")) &&
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

/**
 * effect Entryを決定する。
 *
 * @responsibility effect Entryの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input ledger: DockerDesktopRepairLedgerSnapshot、action: DockerDesktopRepairEffectAction
 * @returns effectEntryの計算結果を返す。
 * @precondition 「ledger: DockerDesktopRepairLedgerSnapshot、action: DockerDesktopRepairEffectAction」がeffectEntryの入力契約を満たす。
 * @postcondition effectEntryの責務を完了した結果だけを返す。
 * @effect N/A: effectEntryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: effectEntryは独自の失敗分岐を所有しない。
 * @invariant effectEntryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security effectEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: effectEntryは共有非同期状態を持たない同期処理である。
 */
function effectEntry(
  ledger: DockerDesktopRepairLedgerSnapshot,
  action: DockerDesktopRepairEffectAction,
) {
  return [...ledger.processEffects, ...ledger.filesystemEffects].find(
    (entry) => entry.action === action,
  );
}

/**
 * Settledかを判定する。
 *
 * @responsibility Settledの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input ledger: DockerDesktopRepairLedgerSnapshot、action: DockerDesktopRepairEffectAction
 * @returns isSettledの計算結果を返す。
 * @precondition 「ledger: DockerDesktopRepairLedgerSnapshot、action: DockerDesktopRepairEffectAction」がisSettledの入力契約を満たす。
 * @postcondition isSettledの責務を完了した結果だけを返す。
 * @effect N/A: isSettledは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSettledは独自の失敗分岐を所有しない。
 * @invariant isSettledは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security isSettledはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSettledは共有非同期状態を持たない同期処理である。
 */
function isSettled(
  ledger: DockerDesktopRepairLedgerSnapshot,
  action: DockerDesktopRepairEffectAction,
) {
  return effectEntry(ledger, action)?.phase === "settled";
}

/**
 * Settled Confirmedかを判定する。
 *
 * @responsibility Settled Confirmedの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input ledger: DockerDesktopRepairLedgerSnapshot、action: DockerDesktopRepairEffectAction
 * @returns isSettledConfirmedの計算結果を返す。
 * @precondition 「ledger: DockerDesktopRepairLedgerSnapshot、action: DockerDesktopRepairEffectAction」がisSettledConfirmedの入力契約を満たす。
 * @postcondition isSettledConfirmedの責務を完了した結果だけを返す。
 * @effect N/A: isSettledConfirmedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSettledConfirmedは独自の失敗分岐を所有しない。
 * @invariant isSettledConfirmedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security isSettledConfirmedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSettledConfirmedは共有非同期状態を持たない同期処理である。
 */
function isSettledConfirmed(
  ledger: DockerDesktopRepairLedgerSnapshot,
  action: DockerDesktopRepairEffectAction,
) {
  const entry = effectEntry(ledger, action);
  return entry?.phase === "settled" && entry.confirmation === "confirmed";
}

/**
 * Settled Not Issuedかを判定する。
 *
 * @responsibility Settled Not Issuedの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input ledger: DockerDesktopRepairLedgerSnapshot、action: DockerDesktopRepairEffectAction
 * @returns isSettledNotIssuedの計算結果を返す。
 * @precondition 「ledger: DockerDesktopRepairLedgerSnapshot、action: DockerDesktopRepairEffectAction」がisSettledNotIssuedの入力契約を満たす。
 * @postcondition isSettledNotIssuedの責務を完了した結果だけを返す。
 * @effect N/A: isSettledNotIssuedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSettledNotIssuedは独自の失敗分岐を所有しない。
 * @invariant isSettledNotIssuedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security isSettledNotIssuedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isSettledNotIssuedは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Unknown Reconciliationが存在するかを判定する。
 *
 * @responsibility Unknown Reconciliationの存在条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input ledger: DockerDesktopRepairLedgerSnapshot
 * @returns hasUnknownReconciliationの計算結果を返す。
 * @precondition 「ledger: DockerDesktopRepairLedgerSnapshot」がhasUnknownReconciliationの入力契約を満たす。
 * @postcondition hasUnknownReconciliationの責務を完了した結果だけを返す。
 * @effect N/A: hasUnknownReconciliationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hasUnknownReconciliationは独自の失敗分岐を所有しない。
 * @invariant hasUnknownReconciliationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security hasUnknownReconciliationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hasUnknownReconciliationは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Unknown Host Effectが存在するかを判定する。
 *
 * @responsibility Unknown Host Effectの存在条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input ledger: DockerDesktopRepairLedgerSnapshot
 * @returns hasUnknownHostEffectの計算結果を返す。
 * @precondition 「ledger: DockerDesktopRepairLedgerSnapshot」がhasUnknownHostEffectの入力契約を満たす。
 * @postcondition hasUnknownHostEffectの責務を完了した結果だけを返す。
 * @effect N/A: hasUnknownHostEffectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hasUnknownHostEffectは独自の失敗分岐を所有しない。
 * @invariant hasUnknownHostEffectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security hasUnknownHostEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hasUnknownHostEffectは共有非同期状態を持たない同期処理である。
 */
function hasUnknownHostEffect(ledger: DockerDesktopRepairLedgerSnapshot) {
  return [...ledger.processEffects, ...ledger.filesystemEffects].some(
    (entry) =>
      HOST_EFFECT_ACTIONS.has(entry.action) &&
      (entry.phase !== "settled" || entry.confirmation === "unknown"),
  );
}

/**
 * Known Process Prefixが有効か判定する。
 *
 * @responsibility Known Process Prefixの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input ledger: DockerDesktopRepairLedgerSnapshot
 * @returns validKnownProcessPrefixの計算結果を返す。
 * @precondition 「ledger: DockerDesktopRepairLedgerSnapshot」がvalidKnownProcessPrefixの入力契約を満たす。
 * @postcondition validKnownProcessPrefixの責務を完了した結果だけを返す。
 * @effect N/A: validKnownProcessPrefixは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validKnownProcessPrefixは独自の失敗分岐を所有しない。
 * @invariant validKnownProcessPrefixは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validKnownProcessPrefixはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validKnownProcessPrefixは共有非同期状態を持たない同期処理である。
 */
function validKnownProcessPrefix(ledger: DockerDesktopRepairLedgerSnapshot) {
  const shutdown = effectEntry(ledger, "official_shutdown");
  const native = effectEntry(ledger, "native_termination");
  const wsl = effectEntry(ledger, "wsl_termination");
  if (!shutdown) return !native && !wsl;
  const isShutdownKnown =
    isSettledConfirmed(ledger, "official_shutdown") ||
    isSettledNotIssued(ledger, "official_shutdown");
  if (native && !isShutdownKnown) return false;
  if (
    wsl &&
    (!isShutdownKnown ||
      !native ||
      native.phase === "intent_recorded" ||
      native.confirmation === "unknown")
  )
    return false;
  return true;
}

/**
 * settled Stopped Prefixを決定する。
 *
 * @responsibility settled Stopped Prefixの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input ledger: DockerDesktopRepairLedgerSnapshot
 * @returns settledStoppedPrefixの計算結果を返す。
 * @precondition 「ledger: DockerDesktopRepairLedgerSnapshot」がsettledStoppedPrefixの入力契約を満たす。
 * @postcondition settledStoppedPrefixの責務を完了した結果だけを返す。
 * @effect N/A: settledStoppedPrefixは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: settledStoppedPrefixは独自の失敗分岐を所有しない。
 * @invariant settledStoppedPrefixは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security settledStoppedPrefixはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settledStoppedPrefixは共有非同期状態を持たない同期処理である。
 */
function settledStoppedPrefix(ledger: DockerDesktopRepairLedgerSnapshot) {
  return (
    validKnownProcessPrefix(ledger) &&
    isSettled(ledger, "official_shutdown") &&
    isSettledConfirmed(ledger, "wsl_termination") &&
    !hasUnknownReconciliation(ledger)
  );
}

/**
 * stage Ledger Compatibleを決定する。
 *
 * @responsibility stage Ledger Compatibleの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input stage: DockerDesktopRepairStage、ledger: DockerDesktopRepairLedgerSnapshot
 * @returns stageLedgerCompatibleの計算結果を返す。
 * @precondition 「stage: DockerDesktopRepairStage、ledger: DockerDesktopRepairLedgerSnapshot」がstageLedgerCompatibleの入力契約を満たす。
 * @postcondition stageLedgerCompatibleの責務を完了した結果だけを返す。
 * @effect stageLedgerCompatibleはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: stageLedgerCompatibleは独自の失敗分岐を所有しない。
 * @invariant stageLedgerCompatibleは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security stageLedgerCompatibleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stageLedgerCompatibleは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Bytesを安定Identityへ変換する。
 *
 * @responsibility Bytesの正規化条件、一意性、変換不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns stableBytesの計算結果を返す。
 * @precondition 「target: string」がstableBytesの入力契約を満たす。
 * @postcondition stableBytesの責務を完了した結果だけを返す。
 * @effect stableBytesはFilesystemの読取りまたは書込みを実行する。
 * @failure stableBytesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant stableBytesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security stableBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stableBytesは共有非同期状態を持たない同期処理である。
 */
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

/**
 * legal Transitionを決定する。
 *
 * @responsibility legal Transitionの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input previous: DockerDesktopRepairStage | null、next: DockerDesktopRepairStage
 * @returns legalTransitionの計算結果を返す。
 * @precondition 「previous: DockerDesktopRepairStage | null、next: DockerDesktopRepairStage」がlegalTransitionの入力契約を満たす。
 * @postcondition legalTransitionの責務を完了した結果だけを返す。
 * @effect legalTransitionはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: legalTransitionは独自の失敗分岐を所有しない。
 * @invariant legalTransitionは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security legalTransitionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: legalTransitionは共有非同期状態を持たない同期処理である。
 */
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

/**
 * changed Semantic Actionsを決定する。
 *
 * @responsibility changed Semantic Actionsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input previous: DockerDesktopRepairLedgerSnapshot | null、next: DockerDesktopRepairLedgerSnapshot
 * @returns changedSemanticActionsの計算結果を返す。
 * @precondition 「previous: DockerDesktopRepairLedgerSnapshot | null、next: DockerDesktopRepairLedgerSnapshot」がchangedSemanticActionsの入力契約を満たす。
 * @postcondition changedSemanticActionsの責務を完了した結果だけを返す。
 * @effect N/A: changedSemanticActionsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: changedSemanticActionsは独自の失敗分岐を所有しない。
 * @invariant changedSemanticActionsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security changedSemanticActionsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: changedSemanticActionsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * legal Repair 記録 Transitionを決定する。
 *
 * @responsibility legal Repair 記録 Transitionの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input previousStage: DockerDesktopRepairStage | null、previousLedger: DockerDesktopRepairLedgerSnapshot | null、nextStage: DockerDesktopRepairStage、nextLedger: DockerDesktopRepairLedgerSnapshot
 * @returns legalRepairRecordTransitionの計算結果を返す。
 * @precondition 「previousStage: DockerDesktopRepairStage | null、previousLedger: DockerDesktopRepairLedgerSnapshot | null、nextStage: DockerDesktopRepairStage、nextLedger: DockerDesktopRepairLedgerSnapshot」がlegalRepairRecordTransitionの入力契約を満たす。
 * @postcondition legalRepairRecordTransitionの責務を完了した結果だけを返す。
 * @effect legalRepairRecordTransitionはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: legalRepairRecordTransitionは独自の失敗分岐を所有しない。
 * @invariant legalRepairRecordTransitionは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security legalRepairRecordTransitionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: legalRepairRecordTransitionは共有非同期状態を持たない同期処理である。
 */
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

/**
 * to Operationを決定する。
 *
 * @responsibility to Operationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、record: ReadableStoredRecord、recordSha256: string
 * @returns DockerDesktopRepairOperationを返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、record: ReadableStoredRecord、recordSha256: string」がtoOperationの入力契約を満たす。
 * @postcondition toOperationの責務を完了した結果だけを返す。
 * @effect N/A: toOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: toOperationは独自の失敗分岐を所有しない。
 * @invariant toOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security toOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: toOperationは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Canonical Repair History Session Fieldsが有効か判定する。
 *
 * @responsibility Canonical Repair History Session Fieldsの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input history: Readonly<Record<string, unknown>>、boundary: DockerDesktopRepairRecordBoundary
 * @returns validCanonicalRepairHistorySessionFieldsの計算結果を返す。
 * @precondition 「history: Readonly<Record<string, unknown>>、boundary: DockerDesktopRepairRecordBoundary」がvalidCanonicalRepairHistorySessionFieldsの入力契約を満たす。
 * @postcondition validCanonicalRepairHistorySessionFieldsの責務を完了した結果だけを返す。
 * @effect N/A: validCanonicalRepairHistorySessionFieldsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validCanonicalRepairHistorySessionFieldsは独自の失敗分岐を所有しない。
 * @invariant validCanonicalRepairHistorySessionFieldsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validCanonicalRepairHistorySessionFieldsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validCanonicalRepairHistorySessionFieldsは共有非同期状態を持たない同期処理である。
 */
function validCanonicalRepairHistorySessionFields(
  history: Readonly<Record<string, unknown>>,
  boundary: DockerDesktopRepairRecordBoundary,
) {
  const handoffCount = history.handoffCount;
  const adoptionSha256 = history.adoptionSha256;
  const handoffTipSha256 = history.handoffTipSha256;
  const originLocalUserBindingHash = history.originLocalUserBindingHash;
  const currentLocalUserBindingHash = history.currentLocalUserBindingHash;
  const currentSessionBound = history.currentSessionBound;
  return (
    hash64(adoptionSha256) &&
    hash64(handoffTipSha256) &&
    Number.isSafeInteger(handoffCount) &&
    Number(handoffCount) >= 0 &&
    Number(handoffCount) <= MAXIMUM_HISTORY_HANDOFFS &&
    hash64(originLocalUserBindingHash) &&
    hash64(currentLocalUserBindingHash) &&
    typeof currentSessionBound === "boolean" &&
    currentSessionBound ===
      (currentLocalUserBindingHash === boundary.localUserBindingHash) &&
    (handoffCount === 0
      ? handoffTipSha256 === adoptionSha256
      : handoffTipSha256 !== adoptionSha256)
  );
}

/**
 * Canonical Repair Historyを分類する。
 *
 * @responsibility Canonical Repair Historyの分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、boundary: DockerDesktopRepairRecordBoundary、expectedClosure: DockerDesktopRepairExpectedClosure | undefined
 * @returns Exclude< CanonicalDockerDesktopRepairHistoryMode, "invalid" | "no_history" > | nullを返す。
 * @precondition 「value: unknown、boundary: DockerDesktopRepairRecordBoundary、expectedClosure: DockerDesktopRepairExpectedClosure | undefined」がclassifyCanonicalRepairHistoryの入力契約を満たす。
 * @postcondition classifyCanonicalRepairHistoryの責務を完了した結果だけを返す。
 * @effect N/A: classifyCanonicalRepairHistoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyCanonicalRepairHistoryは独自の失敗分岐を所有しない。
 * @invariant classifyCanonicalRepairHistoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security classifyCanonicalRepairHistoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyCanonicalRepairHistoryは共有非同期状態を持たない同期処理である。
 */
function classifyCanonicalRepairHistory(
  value: unknown,
  boundary: DockerDesktopRepairRecordBoundary,
  expectedClosure: DockerDesktopRepairExpectedClosure | undefined,
): Exclude<
  CanonicalDockerDesktopRepairHistoryMode,
  "invalid" | "no_history"
> | null {
  const sessionKeys = [
    "adoptionSha256",
    "handoffTipSha256",
    "handoffCount",
    "originLocalUserBindingHash",
    "currentLocalUserBindingHash",
    "currentSessionBound",
    "closed",
    "liveRunIdentity",
    "staleState",
  ] as const;
  const legacyClosedKeys = [
    "adoptionSha256",
    "closed",
    "liveRunIdentity",
    "staleState",
  ] as const;
  const sessionFields = exactOwnDataValues(value, sessionKeys);
  const legacyFields = sessionFields
    ? null
    : exactOwnDataValues(value, legacyClosedKeys);
  const history = sessionFields ?? legacyFields;
  if (!history || !containsOnlyOwnDataDescriptors(value)) return null;
  if (history.closed === false) {
    if (
      !sessionFields ||
      !validCanonicalRepairHistorySessionFields(history, boundary) ||
      history.liveRunIdentity !== null ||
      history.staleState !== "unknown" ||
      expectedClosure !== undefined
    )
      return null;
    return history.currentSessionBound === true ? "open_current" : "open_prior";
  }
  if (history.closed !== true || !hash64(history.adoptionSha256)) return null;
  const hasSessionFields = sessionFields !== null;
  if (
    hasSessionFields &&
    !validCanonicalRepairHistorySessionFields(history, boundary)
  )
    return null;
  if (
    !validIdentity(history.liveRunIdentity) ||
    (history.staleState !== "absent" && history.staleState !== "retained")
  )
    return null;
  if (expectedClosure !== undefined) {
    const closure = exactOwnDataValues(expectedClosure, [
      "liveRunIdentity",
      "staleState",
    ]);
    if (
      !closure ||
      !containsOnlyOwnDataDescriptors(expectedClosure) ||
      !validIdentity(closure.liveRunIdentity) ||
      (closure.staleState !== "absent" && closure.staleState !== "retained") ||
      !isDeepStrictEqual(history.liveRunIdentity, closure.liveRunIdentity) ||
      history.staleState !== closure.staleState
    )
      return null;
  }
  return "closed";
}

/**
 * Canonical Docker Desktop Repair Historical Operation Uncheckedを分類する。
 *
 * @responsibility Canonical Docker Desktop Repair Historical Operation Uncheckedの分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、boundary: DockerDesktopRepairRecordBoundary、expectedClosure: DockerDesktopRepairExpectedClosure
 * @returns CanonicalDockerDesktopRepairHistoryModeを返す。
 * @precondition 「value: unknown、boundary: DockerDesktopRepairRecordBoundary、expectedClosure: DockerDesktopRepairExpectedClosure」がclassifyCanonicalDockerDesktopRepairHistoricalOperationUncheckedの入力契約を満たす。
 * @postcondition classifyCanonicalDockerDesktopRepairHistoricalOperationUncheckedの責務を完了した結果だけを返す。
 * @effect N/A: classifyCanonicalDockerDesktopRepairHistoricalOperationUncheckedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyCanonicalDockerDesktopRepairHistoricalOperationUncheckedは独自の失敗分岐を所有しない。
 * @invariant classifyCanonicalDockerDesktopRepairHistoricalOperationUncheckedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security classifyCanonicalDockerDesktopRepairHistoricalOperationUncheckedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyCanonicalDockerDesktopRepairHistoricalOperationUncheckedは共有非同期状態を持たない同期処理である。
 */
function classifyCanonicalDockerDesktopRepairHistoricalOperationUnchecked(
  value: unknown,
  boundary: DockerDesktopRepairRecordBoundary,
  expectedClosure?: DockerDesktopRepairExpectedClosure,
): CanonicalDockerDesktopRepairHistoryMode {
  if (!value || typeof value !== "object") return "invalid";
  const hasHistory = Object.hasOwn(value, "history");
  const operation = exactOwnDataValues(value, [
    "operationId",
    "repairId",
    "originLocalUserBindingHash",
    "operationDirectory",
    "staleName",
    "staleDirectory",
    "runIdentity",
    "stage",
    "sequence",
    "previousRecordSha256",
    "ledger",
    ...(hasHistory ? ["history"] : []),
  ]);
  if (!operation || !containsOnlyOwnDataDescriptors(value)) return "invalid";
  const id = operation.operationId;
  const staleName = `run.crdd-stale-${String(id)}`;
  const sequence = operation.sequence;
  const isOperationCoreValid =
    operationId(id) &&
    operation.repairId === `docker-desktop-repair.${id}` &&
    hash64(operation.originLocalUserBindingHash) &&
    operation.operationDirectory ===
      path.win32.join(boundary.runtimeStateRoot, `${OPERATION_PREFIX}${id}`) &&
    operation.staleName === staleName &&
    operation.staleDirectory ===
      path.win32.join(boundary.localAppData, "Docker", staleName) &&
    validIdentity(operation.runIdentity) &&
    DOCKER_DESKTOP_REPAIR_STAGES.includes(
      operation.stage as DockerDesktopRepairStage,
    ) &&
    Number.isSafeInteger(sequence) &&
    Number(sequence) >= 0 &&
    Number(sequence) < MAXIMUM_RECORDS &&
    hash64(operation.previousRecordSha256) &&
    validLedger(operation.ledger);
  if (!isOperationCoreValid) return "invalid";
  if (!hasHistory)
    return expectedClosure === undefined ? "no_history" : "invalid";
  return (
    classifyCanonicalRepairHistory(
      operation.history,
      boundary,
      expectedClosure,
    ) ?? "invalid"
  );
}

/**
 * Canonical Docker Desktop Repair Historical Operationを分類する。
 *
 * @responsibility Canonical Docker Desktop Repair Historical Operationの分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、boundary: DockerDesktopRepairRecordBoundary、expectedClosure: DockerDesktopRepairExpectedClosure
 * @returns CanonicalDockerDesktopRepairHistoryModeを返す。
 * @precondition 「value: unknown、boundary: DockerDesktopRepairRecordBoundary、expectedClosure: DockerDesktopRepairExpectedClosure」がclassifyCanonicalDockerDesktopRepairHistoricalOperationの入力契約を満たす。
 * @postcondition classifyCanonicalDockerDesktopRepairHistoricalOperationの責務を完了した結果だけを返す。
 * @effect N/A: classifyCanonicalDockerDesktopRepairHistoricalOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure classifyCanonicalDockerDesktopRepairHistoricalOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant classifyCanonicalDockerDesktopRepairHistoricalOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security classifyCanonicalDockerDesktopRepairHistoricalOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyCanonicalDockerDesktopRepairHistoricalOperationは共有非同期状態を持たない同期処理である。
 */
export function classifyCanonicalDockerDesktopRepairHistoricalOperation(
  value: unknown,
  boundary: DockerDesktopRepairRecordBoundary,
  expectedClosure?: DockerDesktopRepairExpectedClosure,
): CanonicalDockerDesktopRepairHistoryMode {
  try {
    return classifyCanonicalDockerDesktopRepairHistoricalOperationUnchecked(
      value,
      boundary,
      expectedClosure,
    );
  } catch {
    return "invalid";
  }
}

/**
 * Original Operationを読み取る。
 *
 * @responsibility Original Operationの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、directoryName: string、historyAllowed、logonMode: "current" | "terminal" | "closed_history"
 * @returns readOriginalOperationの計算結果を返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、directoryName: string、historyAllowed、logonMode: "current" | "terminal" | "closed_history"」がreadOriginalOperationの入力契約を満たす。
 * @postcondition readOriginalOperationの責務を完了した結果だけを返す。
 * @effect readOriginalOperationはFilesystemの読取りまたは書込みを実行する。
 * @failure readOriginalOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readOriginalOperationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readOriginalOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readOriginalOperationは共有非同期状態を持たない同期処理である。
 */
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
        !(
          entry.isDirectory() &&
          entry.name === "runtime-continuation" &&
          !entry.isSymbolicLink()
        ) &&
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

/**
 * Matches Boundaryを解放する。
 *
 * @responsibility Matches Boundaryの所有権、解放条件、終了後不存在の確認境界を所有する。
 * @trace ARCH-000008
 * @input release: HistoricalReleaseIdentity、boundary: DockerDesktopRepairRecordBoundary
 * @returns releaseMatchesBoundaryの計算結果を返す。
 * @precondition 「release: HistoricalReleaseIdentity、boundary: DockerDesktopRepairRecordBoundary」がreleaseMatchesBoundaryの入力契約を満たす。
 * @postcondition releaseMatchesBoundaryの責務を完了した結果だけを返す。
 * @effect N/A: releaseMatchesBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: releaseMatchesBoundaryは独自の失敗分岐を所有しない。
 * @invariant releaseMatchesBoundaryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security releaseMatchesBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: releaseMatchesBoundaryは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Not After Boundaryを解放する。
 *
 * @responsibility Not After Boundaryの所有権、解放条件、終了後不存在の確認境界を所有する。
 * @trace ARCH-000008
 * @input release: HistoricalReleaseIdentity、boundary: DockerDesktopRepairRecordBoundary
 * @returns releaseNotAfterBoundaryの計算結果を返す。
 * @precondition 「release: HistoricalReleaseIdentity、boundary: DockerDesktopRepairRecordBoundary」がreleaseNotAfterBoundaryの入力契約を満たす。
 * @postcondition releaseNotAfterBoundaryの責務を完了した結果だけを返す。
 * @effect N/A: releaseNotAfterBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: releaseNotAfterBoundaryは独自の失敗分岐を所有しない。
 * @invariant releaseNotAfterBoundaryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security releaseNotAfterBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: releaseNotAfterBoundaryは共有非同期状態を持たない同期処理である。
 */
function releaseNotAfterBoundary(
  release: HistoricalReleaseIdentity,
  boundary: DockerDesktopRepairRecordBoundary,
) {
  return (
    release.releaseSequence < boundary.crddReleaseSequence ||
    releaseMatchesBoundary(release, boundary)
  );
}

/**
 * historical Boundaryを決定する。
 *
 * @responsibility historical Boundaryの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、release: HistoricalReleaseIdentity、dockerPolicySha256
 * @returns DockerDesktopRepairRecordBoundaryを返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、release: HistoricalReleaseIdentity、dockerPolicySha256」がhistoricalBoundaryの入力契約を満たす。
 * @postcondition historicalBoundaryの責務を完了した結果だけを返す。
 * @effect N/A: historicalBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: historicalBoundaryは独自の失敗分岐を所有しない。
 * @invariant historicalBoundaryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security historicalBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: historicalBoundaryは共有非同期状態を持たない同期処理である。
 */
function historicalBoundary(
  boundary: DockerDesktopRepairRecordBoundary,
  release: HistoricalReleaseIdentity,
  dockerPolicySha256 = boundary.dockerPolicySha256,
): DockerDesktopRepairRecordBoundary {
  // Host, selected user and root protection remain current. The signed release
  // tuple and its recorded policy are historical facts; adoption separately
  // binds all later actions to the current policy.
  const { historicalV4: ignoredValue, ...current } = boundary;
  return release.runtimeExecutionIdentitySha256 === null
    ? Object.freeze({
        ...current,
        dockerPolicySha256,
        crddManifestHash: release.manifestHash,
        crddReleaseSequence: release.releaseSequence,
        historicalV4: {
          crddTree: release.crddTree,
          packageContentRootSha256: release.packageContentRootSha256,
        },
      })
    : Object.freeze({
        ...current,
        dockerPolicySha256,
        crddManifestHash: release.manifestHash,
        crddReleaseSequence: release.releaseSequence,
        runtimeExecutionIdentitySha256: release.runtimeExecutionIdentitySha256,
      });
}

/**
 * original Docker Policy Sha256を決定する。
 *
 * @responsibility original Docker Policy Sha256の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input runtimeStateRoot: string、directoryName: string
 * @returns originalDockerPolicySha256の計算結果を返す。
 * @precondition 「runtimeStateRoot: string、directoryName: string」がoriginalDockerPolicySha256の入力契約を満たす。
 * @postcondition originalDockerPolicySha256の責務を完了した結果だけを返す。
 * @effect N/A: originalDockerPolicySha256は入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure originalDockerPolicySha256は入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant originalDockerPolicySha256は入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security originalDockerPolicySha256はAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: originalDockerPolicySha256は共有非同期状態を持たない同期処理である。
 */
function originalDockerPolicySha256(
  runtimeStateRoot: string,
  directoryName: string,
) {
  try {
    const bytes = stableBytes(
      path.win32.join(
        runtimeStateRoot,
        directoryName,
        "repair-00-prepared.json",
      ),
    );
    const parsed = parseHistoryBytes(bytes);
    return parsed && hash64(parsed.dockerPolicySha256)
      ? String(parsed.dockerPolicySha256)
      : null;
  } catch {
    return null;
  }
}

/**
 * History Bytesを構造化値へ解析する。
 *
 * @responsibility History Bytesの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input bytes: Buffer | null
 * @returns Record<string, unknown> | nullを返す。
 * @precondition 「bytes: Buffer | null」がparseHistoryBytesの入力契約を満たす。
 * @postcondition parseHistoryBytesの責務を完了した結果だけを返す。
 * @effect N/A: parseHistoryBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseHistoryBytesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseHistoryBytesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security parseHistoryBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseHistoryBytesは共有非同期状態を持たない同期処理である。
 */
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

/**
 * history File Presentを決定する。
 *
 * @responsibility history File Presentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input directory: string、name: string
 * @returns boolean | nullを返す。
 * @precondition 「directory: string、name: string」がhistoryFilePresentの入力契約を満たす。
 * @postcondition historyFilePresentの責務を完了した結果だけを返す。
 * @effect historyFilePresentはFilesystemの読取りまたは書込みを実行する。
 * @failure historyFilePresentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant historyFilePresentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security historyFilePresentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: historyFilePresentは共有非同期状態を持たない同期処理である。
 */
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

/**
 * docker-desktop-repair-record-storeで使用するHistory Preparation 状態の値契約を定義する。
 *
 * @responsibility History Preparation 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape HistoryPreparationStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HistoryPreparationStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: HistoryPreparationStateの宣言は外部境界を開かない。
 * @security HistoryPreparationStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HistoryPreparationStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HistoryPreparationState = Readonly<{
  targetName: string;
  preparationName: string;
  state: "prepared" | "published_residue";
}>;

/**
 * Regular File Identityが同一かを判定する。
 *
 * @responsibility Regular File Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000008
 * @input left: string、right: string
 * @returns sameRegularFileIdentityの計算結果を返す。
 * @precondition 「left: string、right: string」がsameRegularFileIdentityの入力契約を満たす。
 * @postcondition sameRegularFileIdentityの責務を完了した結果だけを返す。
 * @effect sameRegularFileIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure sameRegularFileIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant sameRegularFileIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security sameRegularFileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameRegularFileIdentityは共有非同期状態を持たない同期処理である。
 */
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

/**
 * History Preparationsを分類する。
 *
 * @responsibility History Preparationsの分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input directory: string
 * @returns readonly HistoryPreparationState[] | nullを返す。
 * @precondition 「directory: string」がclassifyHistoryPreparationsの入力契約を満たす。
 * @postcondition classifyHistoryPreparationsの責務を完了した結果だけを返す。
 * @effect classifyHistoryPreparationsはFilesystemの読取りまたは書込みを実行する。
 * @failure classifyHistoryPreparationsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant classifyHistoryPreparationsは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security classifyHistoryPreparationsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyHistoryPreparationsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * history Publication Stable Bytesを決定する。
 *
 * @responsibility history Publication Stable Bytesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns historyPublicationStableBytesの計算結果を返す。
 * @precondition 「target: string」がhistoryPublicationStableBytesの入力契約を満たす。
 * @postcondition historyPublicationStableBytesの責務を完了した結果だけを返す。
 * @effect historyPublicationStableBytesはFilesystemの読取りまたは書込みを実行する。
 * @failure historyPublicationStableBytesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant historyPublicationStableBytesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security historyPublicationStableBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: historyPublicationStableBytesは共有非同期状態を持たない同期処理である。
 */
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

/**
 * history Publication Presentを決定する。
 *
 * @responsibility history Publication Presentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns boolean | nullを返す。
 * @precondition 「target: string」がhistoryPublicationPresentの入力契約を満たす。
 * @postcondition historyPublicationPresentの責務を完了した結果だけを返す。
 * @effect N/A: historyPublicationPresentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure historyPublicationPresentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant historyPublicationPresentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security historyPublicationPresentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: historyPublicationPresentは共有非同期状態を持たない同期処理である。
 */
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

/**
 * history Publication Same Identityを決定する。
 *
 * @responsibility history Publication Same Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input left: string、right: string
 * @returns historyPublicationSameIdentityの計算結果を返す。
 * @precondition 「left: string、right: string」がhistoryPublicationSameIdentityの入力契約を満たす。
 * @postcondition historyPublicationSameIdentityの責務を完了した結果だけを返す。
 * @effect N/A: historyPublicationSameIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure historyPublicationSameIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant historyPublicationSameIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security historyPublicationSameIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: historyPublicationSameIdentityは共有非同期状態を持たない同期処理である。
 */
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

/**
 * history Publication Directory Identityを決定する。
 *
 * @responsibility history Publication Directory Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input directory: string
 * @returns historyPublicationDirectoryIdentityの計算結果を返す。
 * @precondition 「directory: string」がhistoryPublicationDirectoryIdentityの入力契約を満たす。
 * @postcondition historyPublicationDirectoryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: historyPublicationDirectoryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: historyPublicationDirectoryIdentityは独自の失敗分岐を所有しない。
 * @invariant historyPublicationDirectoryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security historyPublicationDirectoryIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: historyPublicationDirectoryIdentityは共有非同期状態を持たない同期処理である。
 */
function historyPublicationDirectoryIdentity(directory: string) {
  const metadata = historyPublicationFs.lstatSync(directory, { bigint: true });
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

/**
 * history Publication Same Directory Identityを決定する。
 *
 * @responsibility history Publication Same Directory Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input left: unknown、right: unknown
 * @returns historyPublicationSameDirectoryIdentityの計算結果を返す。
 * @precondition 「left: unknown、right: unknown」がhistoryPublicationSameDirectoryIdentityの入力契約を満たす。
 * @postcondition historyPublicationSameDirectoryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: historyPublicationSameDirectoryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: historyPublicationSameDirectoryIdentityは独自の失敗分岐を所有しない。
 * @invariant historyPublicationSameDirectoryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security historyPublicationSameDirectoryIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: historyPublicationSameDirectoryIdentityは共有非同期状態を持たない同期処理である。
 */
function historyPublicationSameDirectoryIdentity(
  left: unknown,
  right: unknown,
) {
  if (!left || !right || typeof left !== "object" || typeof right !== "object")
    return false;
  return (
    Reflect.get(left, "dev") === Reflect.get(right, "dev") &&
    Reflect.get(left, "ino") === Reflect.get(right, "ino") &&
    Reflect.get(left, "birthtimeNs") === Reflect.get(right, "birthtimeNs")
  );
}

/**
 * History Publication Settlement For Current Invocationを確認する。
 *
 * @responsibility History Publication Settlement For Current Invocationの確認根拠、成立条件、観測不能境界を所有する。
 * @trace ARCH-000008
 * @input directory: string、initialDirectoryIdentity: unknown
 * @returns confirmHistoryPublicationSettlementForCurrentInvocationの計算結果を返す。
 * @precondition 「directory: string、initialDirectoryIdentity: unknown」がconfirmHistoryPublicationSettlementForCurrentInvocationの入力契約を満たす。
 * @postcondition confirmHistoryPublicationSettlementForCurrentInvocationの責務を完了した結果だけを返す。
 * @effect confirmHistoryPublicationSettlementForCurrentInvocationはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: confirmHistoryPublicationSettlementForCurrentInvocationは独自の失敗分岐を所有しない。
 * @invariant confirmHistoryPublicationSettlementForCurrentInvocationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security confirmHistoryPublicationSettlementForCurrentInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: confirmHistoryPublicationSettlementForCurrentInvocationは共有非同期状態を持たない同期処理である。
 */
function confirmHistoryPublicationSettlementForCurrentInvocation(
  directory: string,
  initialDirectoryIdentity: unknown,
) {
  if (process.platform !== "win32") {
    const descriptor = historyPublicationFs.openSync(directory, "r");
    try {
      historyPublicationFs.fsyncSync(descriptor);
    } finally {
      historyPublicationFs.closeSync(descriptor);
    }
  }
  return historyPublicationSameDirectoryIdentity(
    initialDirectoryIdentity,
    historyPublicationDirectoryIdentity(directory),
  );
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
    captureDirectoryIdentity: historyPublicationDirectoryIdentity,
    confirmPublicationSettlementForCurrentInvocation:
      confirmHistoryPublicationSettlementForCurrentInvocation,
    observeBeforeLink: () => {},
    injectFault: () => {},
  });

/**
 * Operationを読み取る。
 *
 * @responsibility Operationの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、directoryName: string、verifyHistory: DockerDesktopRepairHistoryVerifier、shouldAllowPendingSessionHandoff、shouldAllowKnownHistoryPreparation
 * @returns DockerDesktopRepairOperation | nullを返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、directoryName: string、verifyHistory: DockerDesktopRepairHistoryVerifier、shouldAllowPendingSessionHandoff、shouldAllowKnownHistoryPreparation」がreadOperationの入力契約を満たす。
 * @postcondition readOperationの責務を完了した結果だけを返す。
 * @effect N/A: readOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readOperationは独自の失敗分岐を所有しない。
 * @invariant readOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readOperationは共有非同期状態を持たない同期処理である。
 */
function readOperation(
  boundary: DockerDesktopRepairRecordBoundary,
  directoryName: string,
  verifyHistory: DockerDesktopRepairHistoryVerifier,
  shouldAllowPendingSessionHandoff = false,
  shouldAllowKnownHistoryPreparation = false,
): DockerDesktopRepairOperation | null {
  if (!parseDockerDesktopRepairDirectoryName(directoryName)) return null;
  const directory = path.win32.join(boundary.runtimeStateRoot, directoryName);
  const preparationStates = classifyHistoryPreparations(directory);
  if (
    preparationStates === null ||
    (!shouldAllowKnownHistoryPreparation && preparationStates.length > 0)
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
          shouldAllowKnownHistoryPreparation,
          "terminal",
        );
  const adoptionBytes = stableBytes(
    path.win32.join(directory, HISTORY_ADOPTION_FILE),
  );
  const adoption = parseHistoryBytes(adoptionBytes);
  const isAdoptionV1 =
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
  const isAdoptionV2 =
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
  const isAdoptionV3 =
    adoption?.schema === HISTORY_POLICY_TRANSITION_SCHEMA &&
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
      "originDockerPolicySha256",
      "dockerPolicySha256",
      "originManifest",
      "adoptingManifest",
    ]);
  if (
    !adoptionBytes ||
    !adoption ||
    (!isAdoptionV1 && !isAdoptionV2 && !isAdoptionV3) ||
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
  const recordedOriginPolicySha256 = originalDockerPolicySha256(
    boundary.runtimeStateRoot,
    directoryName,
  );
  const historyPolicySha256 =
    isAdoptionV2 || isAdoptionV3
      ? String(adoption.dockerPolicySha256)
      : recordedOriginPolicySha256;
  if (!historyPolicySha256) return null;
  let historySession =
    isAdoptionV2 || isAdoptionV3
      ? String(adoption.adoptingLocalUserBindingHash)
      : boundary.localUserBindingHash;
  const visitedSessions = new Set<string>();
  if (isAdoptionV2 || isAdoptionV3) {
    if (
      !hash64(adoption.originLocalUserBindingHash) ||
      !hash64(adoption.adoptingLocalUserBindingHash) ||
      adoption.runtimeStateIdentityHash !== boundary.runtimeStateIdentityHash ||
      adoption.runtimeStateProtectionHash !==
        boundary.runtimeStateProtectionHash ||
      adoption.runtimeStateBindingHash !== boundary.runtimeStateBindingHash ||
      !hash64(adoption.dockerPolicySha256) ||
      (isAdoptionV3 && !hash64(adoption.originDockerPolicySha256))
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
      handoff.dockerPolicySha256 !== historyPolicySha256
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
    const isClosureV1 =
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
    const isClosureV2 =
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
      (!isClosureV1 && !isClosureV2) ||
      closure.kind !== "closure" ||
      closure.repairId !== adoption.repairId ||
      closure.adoptionSha256 !== adoptionSha256 ||
      !validIdentity(closure.liveRunIdentity) ||
      (closure.staleState !== "absent" && closure.staleState !== "retained")
    )
      return null;
    if (
      isClosureV2 &&
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
  // A terminal history is immutable evidence and cannot issue Host Effects, so
  // it remains readable under the policy that governed it. An open operation
  // must match the current policy before it can be resumed.
  if (!closurePresent && historyPolicySha256 !== boundary.dockerPolicySha256)
    return null;
  // Only a fully validated closure permits reading a prior login's chain.
  // No operation is returned until its original chain and receipt anchors match.
  const operation = readOriginalOperation(
    historicalBoundary(
      boundary,
      origin,
      isAdoptionV3
        ? String(adoption.originDockerPolicySha256)
        : historyPolicySha256,
    ),
    directoryName,
    true,
    isAdoptionV2 || isAdoptionV3 || closurePresent
      ? "closed_history"
      : "current",
  );
  if (
    !operation ||
    operation.repairId !== adoption.repairId ||
    operation.sequence + 1 !== adoption.originalRecordCount ||
    operation.previousRecordSha256 !== adoption.originalTipSha256
  )
    return null;
  if (
    (isAdoptionV2 || isAdoptionV3) &&
    operation.originLocalUserBindingHash !== adoption.originLocalUserBindingHash
  )
    return null;
  const isCurrentSessionBound =
    historySession === boundary.localUserBindingHash;
  if (
    !closurePresent &&
    !isCurrentSessionBound &&
    !shouldAllowPendingSessionHandoff
  )
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
      currentSessionBound: isCurrentSessionBound,
      closed: closurePresent,
      liveRunIdentity,
      staleState,
    }),
  });
}

/**
 * Docker Desktop Repair Historical Operationを観測する。
 *
 * @responsibility Docker Desktop Repair Historical Operationの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、repairId: string、originManifest: unknown、verifyHistory: DockerDesktopRepairHistoryVerifier
 * @returns DockerDesktopRepairOperation | nullを返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、repairId: string、originManifest: unknown、verifyHistory: DockerDesktopRepairHistoryVerifier」がinspectDockerDesktopRepairHistoricalOperationの入力契約を満たす。
 * @postcondition inspectDockerDesktopRepairHistoricalOperationの責務を完了した結果だけを返す。
 * @effect N/A: inspectDockerDesktopRepairHistoricalOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectDockerDesktopRepairHistoricalOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectDockerDesktopRepairHistoricalOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inspectDockerDesktopRepairHistoricalOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectDockerDesktopRepairHistoricalOperationは共有非同期状態を持たない同期処理である。
 */
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
    const originPolicySha256 = originalDockerPolicySha256(
      boundary.runtimeStateRoot,
      directoryName,
    );
    return origin &&
      originPolicySha256 &&
      releaseNotAfterBoundary(origin, boundary)
      ? readOriginalOperation(
          historicalBoundary(boundary, origin, originPolicySha256),
          directoryName,
          false,
          "terminal",
        )
      : null;
  } catch {
    return null;
  }
}

/**
 * History Fileを書き込む。
 *
 * @responsibility History Fileの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input directory: string、name: string、bytes: Buffer
 * @returns writeHistoryFileの計算結果を返す。
 * @precondition 「directory: string、name: string、bytes: Buffer」がwriteHistoryFileの入力契約を満たす。
 * @postcondition writeHistoryFileの責務を完了した結果だけを返す。
 * @effect N/A: writeHistoryFileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: writeHistoryFileは独自の失敗分岐を所有しない。
 * @invariant writeHistoryFileは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security writeHistoryFileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeHistoryFileは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Published History Residuesを終端状態へ確定する。
 *
 * @responsibility Published History Residuesの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000008
 * @input directory: string
 * @returns settlePublishedHistoryResiduesの計算結果を返す。
 * @precondition 「directory: string」がsettlePublishedHistoryResiduesの入力契約を満たす。
 * @postcondition settlePublishedHistoryResiduesの責務を完了した結果だけを返す。
 * @effect N/A: settlePublishedHistoryResiduesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: settlePublishedHistoryResiduesは独自の失敗分岐を所有しない。
 * @invariant settlePublishedHistoryResiduesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security settlePublishedHistoryResiduesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settlePublishedHistoryResiduesは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Docker Desktop Repair Historical Adoptionを耐久保存する。
 *
 * @responsibility Docker Desktop Repair Historical Adoptionの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、originManifest: unknown、adoptingManifest: unknown、verifyHistory: DockerDesktopRepairHistoryVerifier
 * @returns DockerDesktopRepairOperation | nullを返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、originManifest: unknown、adoptingManifest: unknown、verifyHistory: DockerDesktopRepairHistoryVerifier」がpersistDockerDesktopRepairHistoricalAdoptionの入力契約を満たす。
 * @postcondition persistDockerDesktopRepairHistoricalAdoptionの責務を完了した結果だけを返す。
 * @effect N/A: persistDockerDesktopRepairHistoricalAdoptionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure persistDockerDesktopRepairHistoricalAdoptionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant persistDockerDesktopRepairHistoricalAdoptionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security persistDockerDesktopRepairHistoricalAdoptionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: persistDockerDesktopRepairHistoricalAdoptionは共有非同期状態を持たない同期処理である。
 */
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
        schema: HISTORY_POLICY_TRANSITION_SCHEMA,
        kind: "adoption",
        repairId: operation.repairId,
        originalRecordCount: operation.sequence + 1,
        originalTipSha256: operation.previousRecordSha256,
        originLocalUserBindingHash: operation.originLocalUserBindingHash,
        adoptingLocalUserBindingHash: boundary.localUserBindingHash,
        runtimeStateIdentityHash: boundary.runtimeStateIdentityHash,
        runtimeStateProtectionHash: boundary.runtimeStateProtectionHash,
        runtimeStateBindingHash: boundary.runtimeStateBindingHash,
        originDockerPolicySha256: originalDockerPolicySha256(
          boundary.runtimeStateRoot,
          directoryName,
        ),
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
      !hash64(value.originDockerPolicySha256) ||
      !adopting ||
      !releaseMatchesBoundary(adopting, boundary)
    )
      return null;
    const origin = value && verifyHistory(value.originManifest);
    const current =
      origin && releaseNotAfterBoundary(origin, boundary)
        ? readOriginalOperation(
            historicalBoundary(
              boundary,
              origin,
              String(value.originDockerPolicySha256),
            ),
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

/**
 * Docker Desktop Repair Historical Closureを耐久保存する。
 *
 * @responsibility Docker Desktop Repair Historical Closureの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、observation: Readonly<{ liveRunIdentity: DockerDesktopRepairDirectoryIdentity; staleState: "absent" | "retained"; }>、closingManifest: unknown、verifyHistory: DockerDesktopRepairHistoryVerifier
 * @returns DockerDesktopRepairOperation | nullを返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、observation: Readonly<{ liveRunIdentity: DockerDesktopRepairDirectoryIdentity; staleState: "absent" | "retained"; }>、closingManifest: unknown、verifyHistory: DockerDesktopRepairHistoryVerifier」がpersistDockerDesktopRepairHistoricalClosureの入力契約を満たす。
 * @postcondition persistDockerDesktopRepairHistoricalClosureの責務を完了した結果だけを返す。
 * @effect N/A: persistDockerDesktopRepairHistoricalClosureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure persistDockerDesktopRepairHistoricalClosureは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant persistDockerDesktopRepairHistoricalClosureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security persistDockerDesktopRepairHistoricalClosureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: persistDockerDesktopRepairHistoricalClosureは共有非同期状態を持たない同期処理である。
 */
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

/**
 * inventory Docker Desktop Repair Operationsを決定する。
 *
 * @responsibility inventory Docker Desktop Repair Operationsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、verifyHistory: DockerDesktopRepairHistoryVerifier
 * @returns inventoryDockerDesktopRepairOperationsの計算結果を返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、verifyHistory: DockerDesktopRepairHistoryVerifier」がinventoryDockerDesktopRepairOperationsの入力契約を満たす。
 * @postcondition inventoryDockerDesktopRepairOperationsの責務を完了した結果だけを返す。
 * @effect N/A: inventoryDockerDesktopRepairOperationsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inventoryDockerDesktopRepairOperationsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inventoryDockerDesktopRepairOperationsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inventoryDockerDesktopRepairOperationsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inventoryDockerDesktopRepairOperationsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * can Create Docker Desktop Repair Operationを決定する。
 *
 * @responsibility can Create Docker Desktop Repair Operationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary
 * @returns canCreateDockerDesktopRepairOperationの計算結果を返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary」がcanCreateDockerDesktopRepairOperationの入力契約を満たす。
 * @postcondition canCreateDockerDesktopRepairOperationの責務を完了した結果だけを返す。
 * @effect N/A: canCreateDockerDesktopRepairOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canCreateDockerDesktopRepairOperationは独自の失敗分岐を所有しない。
 * @invariant canCreateDockerDesktopRepairOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security canCreateDockerDesktopRepairOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canCreateDockerDesktopRepairOperationは共有非同期状態を持たない同期処理である。
 */
export function canCreateDockerDesktopRepairOperation(
  boundary: DockerDesktopRepairRecordBoundary,
) {
  const inventory = inventoryDockerDesktopRepairOperations(boundary);
  return (
    inventory.status === "verified" &&
    inventory.operations.length < MAXIMUM_OPERATIONS
  );
}

/**
 * Docker Desktop Repair 記録 Capacityが存在するかを判定する。
 *
 * @responsibility Docker Desktop Repair 記録 Capacityの存在条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input operation: DockerDesktopRepairOperation、requiredRecords: number
 * @returns hasDockerDesktopRepairRecordCapacityの計算結果を返す。
 * @precondition 「operation: DockerDesktopRepairOperation、requiredRecords: number」がhasDockerDesktopRepairRecordCapacityの入力契約を満たす。
 * @postcondition hasDockerDesktopRepairRecordCapacityの責務を完了した結果だけを返す。
 * @effect N/A: hasDockerDesktopRepairRecordCapacityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hasDockerDesktopRepairRecordCapacityは独自の失敗分岐を所有しない。
 * @invariant hasDockerDesktopRepairRecordCapacityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security hasDockerDesktopRepairRecordCapacityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hasDockerDesktopRepairRecordCapacityは共有非同期状態を持たない同期処理である。
 */
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

/**
 * docker-desktop-repair-record-storeで使用するDocker Desktop Repair Resume Classificationの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Resume ClassificationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairResumeClassificationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairResumeClassificationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairResumeClassificationの宣言は外部境界を開かない。
 * @security DockerDesktopRepairResumeClassificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairResumeClassificationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * Docker Desktop Repair Resumeを分類する。
 *
 * @responsibility Docker Desktop Repair Resumeの分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input operation: DockerDesktopRepairOperation
 * @returns DockerDesktopRepairResumeClassificationを返す。
 * @precondition 「operation: DockerDesktopRepairOperation」がclassifyDockerDesktopRepairResumeの入力契約を満たす。
 * @postcondition classifyDockerDesktopRepairResumeの責務を完了した結果だけを返す。
 * @effect classifyDockerDesktopRepairResumeはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: classifyDockerDesktopRepairResumeは独自の失敗分岐を所有しない。
 * @invariant classifyDockerDesktopRepairResumeは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security classifyDockerDesktopRepairResumeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyDockerDesktopRepairResumeは共有非同期状態を持たない同期処理である。
 */
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
    if (
      !isSettledConfirmed(ledger, "official_shutdown") &&
      !isSettledNotIssued(ledger, "official_shutdown")
    )
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

/**
 * required Docker Desktop Repair Records Through Safe Stageを決定する。
 *
 * @responsibility required Docker Desktop Repair Records Through Safe Stageの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input action: Extract< DockerDesktopRepairEffectAction, | "official_shutdown" | "native_termination" | "wsl_termination" | "runtime_directory_rename" | "desktop_launch" >
 * @returns requiredDockerDesktopRepairRecordsThroughSafeStageの計算結果を返す。
 * @precondition 「action: Extract< DockerDesktopRepairEffectAction, | "official_shutdown" | "native_termination" | "wsl_termination" | "runtime_directory_rename" | "desktop_launch" >」がrequiredDockerDesktopRepairRecordsThroughSafeStageの入力契約を満たす。
 * @postcondition requiredDockerDesktopRepairRecordsThroughSafeStageの責務を完了した結果だけを返す。
 * @effect requiredDockerDesktopRepairRecordsThroughSafeStageはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: requiredDockerDesktopRepairRecordsThroughSafeStageは独自の失敗分岐を所有しない。
 * @invariant requiredDockerDesktopRepairRecordsThroughSafeStageは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security requiredDockerDesktopRepairRecordsThroughSafeStageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: requiredDockerDesktopRepairRecordsThroughSafeStageは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Docker Desktop Repair Operationを構築する。
 *
 * @responsibility Docker Desktop Repair Operationの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、runIdentity: DockerDesktopRepairDirectoryIdentity、ledger: DockerDesktopRepairLedgerSnapshot
 * @returns createDockerDesktopRepairOperationの計算結果を返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、runIdentity: DockerDesktopRepairDirectoryIdentity、ledger: DockerDesktopRepairLedgerSnapshot」がcreateDockerDesktopRepairOperationの入力契約を満たす。
 * @postcondition createDockerDesktopRepairOperationの責務を完了した結果だけを返す。
 * @effect N/A: createDockerDesktopRepairOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDockerDesktopRepairOperationは独自の失敗分岐を所有しない。
 * @invariant createDockerDesktopRepairOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createDockerDesktopRepairOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDockerDesktopRepairOperationは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Docker Desktop Repair Stageを耐久保存する。
 *
 * @responsibility Docker Desktop Repair Stageの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、stage: DockerDesktopRepairStage、ledger: DockerDesktopRepairLedgerSnapshot
 * @returns persistDockerDesktopRepairStageの計算結果を返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、stage: DockerDesktopRepairStage、ledger: DockerDesktopRepairLedgerSnapshot」がpersistDockerDesktopRepairStageの入力契約を満たす。
 * @postcondition persistDockerDesktopRepairStageの責務を完了した結果だけを返す。
 * @effect persistDockerDesktopRepairStageはFilesystemの読取りまたは書込みを実行する。
 * @failure persistDockerDesktopRepairStageは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant persistDockerDesktopRepairStageは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security persistDockerDesktopRepairStageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: persistDockerDesktopRepairStageは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Docker Desktop Repair Idを構造化値へ解析する。
 *
 * @responsibility Docker Desktop Repair Idの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns parseDockerDesktopRepairIdの計算結果を返す。
 * @precondition 「value: unknown」がparseDockerDesktopRepairIdの入力契約を満たす。
 * @postcondition parseDockerDesktopRepairIdの責務を完了した結果だけを返す。
 * @effect N/A: parseDockerDesktopRepairIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseDockerDesktopRepairIdは独自の失敗分岐を所有しない。
 * @invariant parseDockerDesktopRepairIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security parseDockerDesktopRepairIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseDockerDesktopRepairIdは共有非同期状態を持たない同期処理である。
 */
export function parseDockerDesktopRepairId(value: unknown) {
  const matched =
    typeof value === "string"
      ? /^docker-desktop-repair\.([a-f0-9]{32})$/u.exec(value)
      : null;
  return matched?.[1] ?? null;
}

/**
 * Docker Desktop Repair 記録 Store 契約の公開契約を記述する。
 *
 * @responsibility Docker Desktop Repair 記録 Store 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDockerDesktopRepairRecordStoreContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDockerDesktopRepairRecordStoreContractの入力契約を満たす。
 * @postcondition describeDockerDesktopRepairRecordStoreContractの責務を完了した結果だけを返す。
 * @effect N/A: describeDockerDesktopRepairRecordStoreContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeDockerDesktopRepairRecordStoreContractは独自の失敗分岐を所有しない。
 * @invariant describeDockerDesktopRepairRecordStoreContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security describeDockerDesktopRepairRecordStoreContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDockerDesktopRepairRecordStoreContractは共有非同期状態を持たない同期処理である。
 */
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
