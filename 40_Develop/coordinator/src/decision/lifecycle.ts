/**
 * 人間判断の受付・対象確認・一回の適用・回復を所有する。
 *
 * @responsibility Principal観測と公開要求の認証・対象検証を既存の判断遷移・保存へ接続する。
 * @trace ARCH-000005
 */

import { completed } from "../state/result.ts";
import { blocked as storeBlocked } from "../state/result.ts";
import { withCoordinatorSnapshotOperation } from "../storage/state.ts";
import { encodeCoordinatorStateValue } from "../state/validation.ts";
import { COORDINATOR_PROJECT_SNAPSHOT_SCHEMA } from "../storage/state.ts";
import { digest } from "../state/validation.ts";
import { COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT } from "./records.ts";
import type { CoordinatorAcceptanceDecisionEnvelope } from "./records.ts";
import { validCoordinatorAcceptanceDecisionRecord } from "./records.ts";
import { validCoordinatorDecisionRecoveryIntent } from "./records.ts";
import type { CoordinatorAcceptanceDecisionStore } from "./types.ts";
import { createHash, randomBytes } from "node:crypto";
import type {
  CoordinatorDecisionCapabilityPort,
  CoordinatorDecisionStore,
  CoordinatorDecisionRecoveryStore,
} from "./types.ts";
import type { CoordinatorPersistencePorts } from "../state/persistence.ts";
import {
  type CoordinatorDecisionRecord,
  isCoordinatorDecisionRecord,
  type CoordinatorDecisionRecoveryIntent,
} from "./records.ts";
import {
  COORDINATOR_HUMAN_DECISION_CONTRACT,
  inspectCoordinatorDecisionRequest,
} from "./request.ts";
import { applyCoordinatorHumanDecision } from "./transition.ts";
import { deriveCoordinatorRepositoryBindingId } from "../state/validation.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import {
  COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
  coordinatorDataBoundaryBlocked,
} from "../state/result.ts";
import { createCurrentCoordinatorPersistencePorts as createCoordinatorPersistencePorts } from "../state/transaction.ts";
import { maintainCoordinatorSnapshot } from "../state/retirement.ts";
import { RepositoryRuntimeDataAreaBlockedError } from "../../../domain-model/src/index.ts";
import { openRuntimeOwnedWindowsProjectDecisionStore } from "../storage/decision.ts";

/**
 * hashを決定する。
 *
 * @responsibility hashの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000005
 * @input value: string
 * @returns hashの計算結果を返す。
 * @precondition 「value: string」がhashの入力契約を満たす。
 * @postcondition hashの責務を完了した結果だけを返す。
 * @effect N/A: hashは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hashは独自の失敗分岐を所有しない。
 * @invariant hashは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security hashはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hashは共有非同期状態を持たない同期処理である。
 */
function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * 上位の人間判断へ一回利用する秘密値と照合Hashを提供する。
 *
 * @responsibility Coordinator Decision Capability Adapterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000005
 * @input N/A: 実行時引数を受け取らない。
 * @returns CoordinatorDecisionCapabilityPortを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateCoordinatorDecisionCapabilityAdapterの入力契約を満たす。
 * @postcondition createCoordinatorDecisionCapabilityAdapterの責務を完了した結果だけを返す。
 * @effect N/A: createCoordinatorDecisionCapabilityAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createCoordinatorDecisionCapabilityAdapterは独自の失敗分岐を所有しない。
 * @invariant createCoordinatorDecisionCapabilityAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createCoordinatorDecisionCapabilityAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createCoordinatorDecisionCapabilityAdapterは共有非同期状態を持たない同期処理である。
 */
export function createCoordinatorDecisionCapabilityAdapter(): CoordinatorDecisionCapabilityPort {
  return Object.freeze({
    issue: () => {
      const secret = randomBytes(32).toString("base64url");
      return Object.freeze({ secret, hash: hash(secret) });
    },
    hash,
  });
}

/**
 * human-decisionで使用するCommonの値契約を定義する。
 *
 * @responsibility CommonのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000005
 * @shape Commonが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Commonで宣言した値と責務の対応を維持する。
 * @boundary N/A: Commonの宣言は外部境界を開かない。
 * @security N/A: CommonはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility Commonの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Common = Readonly<{
  projectId: string;
  milestoneId: string;
  queueId: string;
  principalId: string;
  store: CoordinatorDecisionStore;
  recoveryStore?: CoordinatorDecisionRecoveryStore;
  capability: CoordinatorDecisionCapabilityPort;
  persistence: CoordinatorPersistencePorts;
}>;

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

const REVISION = /^[0-9a-f]{40,64}$/u;

/**
 * Runtime Decision 記録 Idを公開結果へ投影する。
 *
 * @responsibility Runtime Decision 記録 Idの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000005
 * @input capability: CoordinatorDecisionCapabilityPort、projectId: string、milestoneId: string、decisionId: string
 * @returns coordinatorDecisionRecordIdの計算結果を返す。
 * @precondition 「capability: CoordinatorDecisionCapabilityPort、projectId: string、milestoneId: string、decisionId: string」がcoordinatorDecisionRecordIdの入力契約を満たす。
 * @postcondition coordinatorDecisionRecordIdの責務を完了した結果だけを返す。
 * @effect N/A: coordinatorDecisionRecordIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: coordinatorDecisionRecordIdは独自の失敗分岐を所有しない。
 * @invariant coordinatorDecisionRecordIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: coordinatorDecisionRecordIdはProcess内の同一Subsystemで完結する。
 * @security coordinatorDecisionRecordIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: coordinatorDecisionRecordIdは共有非同期状態を持たない同期処理である。
 */
export function coordinatorDecisionRecordId(
  capability: CoordinatorDecisionCapabilityPort,
  projectId: string,
  milestoneId: string,
  decisionId: string,
) {
  return `decision-${capability
    .hash([projectId, milestoneId, decisionId].join("\0"))
    .slice(0, 40)}`;
}

/**
 * Idが有効か判定する。
 *
 * @responsibility Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000005
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidIdの入力契約を満たす。
 * @postcondition validIdの責務を完了した結果だけを返す。
 * @effect N/A: validIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdは独自の失敗分岐を所有しない。
 * @invariant validIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdはProcess内の同一Subsystemで完結する。
 * @security N/A: validIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validIdは共有非同期状態を持たない同期処理である。
 */
function validId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

/**
 * storedを決定する。
 *
 * @responsibility storedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000005
 * @input raw: unknown、expected: CoordinatorDecisionRecord
 * @returns storedの計算結果を返す。
 * @precondition 「raw: unknown、expected: CoordinatorDecisionRecord」がstoredの入力契約を満たす。
 * @postcondition storedの責務を完了した結果だけを返す。
 * @effect N/A: storedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: storedは独自の失敗分岐を所有しない。
 * @invariant storedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: storedはProcess内の同一Subsystemで完結する。
 * @security N/A: storedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: storedは共有非同期状態を持たない同期処理である。
 */
function stored(raw: unknown, expected?: CoordinatorDecisionRecord) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const value = raw as Record<string, unknown>;
  return (
    value.status === "completed" &&
    isCoordinatorDecisionRecord(value.value) &&
    (!expected || JSON.stringify(value.value) === JSON.stringify(expected))
  );
}

/**
 * human-decisionを停止結果として構築する。
 *
 * @responsibility human-decisionの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000005
 * @input reason: string、isRecovery
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string、isRecovery」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(reason: string, isRecovery = false) {
  return Object.freeze({
    contract: COORDINATOR_HUMAN_DECISION_CONTRACT,
    status: "blocked" as const,
    reason,
    cleanupConfirmed: !isRecovery,
    manualRecoveryRequired: isRecovery,
    effectState: isRecovery ? ("unknown" as const) : ("no_effect" as const),
  });
}

/**
 * recovery Identityを決定する。
 *
 * @responsibility recovery Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000005
 * @input capability: CoordinatorDecisionCapabilityPort、record: CoordinatorDecisionRecord
 * @returns recoveryIdentityの計算結果を返す。
 * @precondition 「capability: CoordinatorDecisionCapabilityPort、record: CoordinatorDecisionRecord」がrecoveryIdentityの入力契約を満たす。
 * @postcondition recoveryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: recoveryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryIdentityは独自の失敗分岐を所有しない。
 * @invariant recoveryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryIdentityはProcess内の同一Subsystemで完結する。
 * @security recoveryIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoveryIdentityは共有非同期状態を持たない同期処理である。
 */
function recoveryIdentity(
  capability: CoordinatorDecisionCapabilityPort,
  record: CoordinatorDecisionRecord,
) {
  return `decision-recovery-${capability
    .hash(
      [
        record.recordId,
        record.applicationId ?? "none",
        String(record.expectedGeneration),
        String(record.newGeneration ?? "none"),
      ].join("\0"),
    )
    .slice(0, 40)}`;
}

/**
 * recovery Storedを決定する。
 *
 * @responsibility recovery Storedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000005
 * @input raw: unknown、expected: CoordinatorDecisionRecoveryIntent
 * @returns recoveryStoredの計算結果を返す。
 * @precondition 「raw: unknown、expected: CoordinatorDecisionRecoveryIntent」がrecoveryStoredの入力契約を満たす。
 * @postcondition recoveryStoredの責務を完了した結果だけを返す。
 * @effect N/A: recoveryStoredは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryStoredは独自の失敗分岐を所有しない。
 * @invariant recoveryStoredは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryStoredはProcess内の同一Subsystemで完結する。
 * @security N/A: recoveryStoredはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoveryStoredは共有非同期状態を持たない同期処理である。
 */
function recoveryStored(
  raw: unknown,
  expected?: CoordinatorDecisionRecoveryIntent,
) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const value = (raw as Record<string, unknown>).value;
  return (
    (raw as Record<string, unknown>).status === "completed" &&
    Boolean(value) &&
    (!expected || JSON.stringify(value) === JSON.stringify(expected))
  );
}

/**
 * 回復 Intentを耐久保存する。
 *
 * @responsibility 回復 Intentの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、record: CoordinatorDecisionRecord、unknownBoundary: string
 * @returns persistRecoveryIntentの計算結果を返す。
 * @precondition 「commonFields: Common、record: CoordinatorDecisionRecord、unknownBoundary: string」がpersistRecoveryIntentの入力契約を満たす。
 * @postcondition persistRecoveryIntentの責務を完了した結果だけを返す。
 * @effect N/A: persistRecoveryIntentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure persistRecoveryIntentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant persistRecoveryIntentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: persistRecoveryIntentはProcess内の同一Subsystemで完結する。
 * @security N/A: persistRecoveryIntentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: persistRecoveryIntentは共有非同期状態を持たない同期処理である。
 */
function persistRecoveryIntent(
  commonFields: Common,
  record: CoordinatorDecisionRecord,
  unknownBoundary: string,
) {
  const recoveryId = recoveryIdentity(commonFields.capability, record);
  if (!commonFields.recoveryStore) return null;
  const intent: CoordinatorDecisionRecoveryIntent = Object.freeze({
    recoveryId,
    recordId: record.recordId,
    projectId: record.projectId,
    milestoneId: record.milestoneId,
    queueId: record.queueId,
    applicationId: record.applicationId,
    expectedGeneration: record.expectedGeneration,
    newGeneration: record.newGeneration,
    observedDisposition: record.disposition,
    unknownBoundary,
    disposition: "required",
  });
  try {
    const observed = commonFields.recoveryStore.read(recoveryId) as Readonly<{
      status: string;
      value: CoordinatorDecisionRecoveryIntent | null;
    }> | null;
    if (
      observed?.status === "completed" &&
      observed.value?.disposition === "required"
    )
      return observed.value;
    return recoveryStored(commonFields.recoveryStore.create(intent), intent)
      ? intent
      : null;
  } catch {
    return null;
  }
}

/**
 * recovery Blockedを決定する。
 *
 * @responsibility recovery Blockedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、record: CoordinatorDecisionRecord、unknownBoundary: string
 * @returns recoveryBlockedの計算結果を返す。
 * @precondition 「commonFields: Common、record: CoordinatorDecisionRecord、unknownBoundary: string」がrecoveryBlockedの入力契約を満たす。
 * @postcondition recoveryBlockedの責務を完了した結果だけを返す。
 * @effect N/A: recoveryBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryBlockedは独自の失敗分岐を所有しない。
 * @invariant recoveryBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryBlockedはProcess内の同一Subsystemで完結する。
 * @security N/A: recoveryBlockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoveryBlockedは共有非同期状態を持たない同期処理である。
 */
function recoveryBlocked(
  commonFields: Common,
  record: CoordinatorDecisionRecord,
  unknownBoundary: string,
) {
  const intent = persistRecoveryIntent(commonFields, record, unknownBoundary);
  return Object.freeze({
    ...blocked("orchestrator_decision_recovery_required", true),
    processRestartRequired: true,
    recoveryId: intent?.recoveryId ?? null,
  });
}

/**
 * 回復 Intentを終端状態へ確定する。
 *
 * @responsibility 回復 Intentの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、record: CoordinatorDecisionRecord
 * @returns settleRecoveryIntentの計算結果を返す。
 * @precondition 「commonFields: Common、record: CoordinatorDecisionRecord」がsettleRecoveryIntentの入力契約を満たす。
 * @postcondition settleRecoveryIntentの責務を完了した結果だけを返す。
 * @effect N/A: settleRecoveryIntentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure settleRecoveryIntentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant settleRecoveryIntentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: settleRecoveryIntentはProcess内の同一Subsystemで完結する。
 * @security N/A: settleRecoveryIntentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: settleRecoveryIntentは共有非同期状態を持たない同期処理である。
 */
function settleRecoveryIntent(
  commonFields: Common,
  record: CoordinatorDecisionRecord,
) {
  if (!commonFields.recoveryStore) return true;
  const recoveryId = recoveryIdentity(commonFields.capability, record);
  try {
    const observed = commonFields.recoveryStore.read(recoveryId) as Readonly<{
      status: string;
      value: CoordinatorDecisionRecoveryIntent | null;
    }> | null;
    if (observed?.status !== "completed" || !observed.value) return true;
    if (observed.value.disposition === "settled") return true;
    const settled = Object.freeze({
      ...observed.value,
      disposition: "settled" as const,
    });
    return recoveryStored(
      commonFields.recoveryStore.compareAndSet(observed.value, settled),
      settled,
    );
  } catch {
    return false;
  }
}

/**
 * Issue a one-time continuation capability. Only its hash enters the protected store.
 *
 * @responsibility Coordinator Human Decisionの発行条件、Identity、非発行時のEffect 0境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、input: Readonly<{ decisionId: string; repositoryRevision: string; expectedGeneration: number; allowedOptions: readonly ("resume" | "cancel")[]; lifetimeMs: number; nowEpochMs?: number; }>
 * @returns issueCoordinatorHumanDecisionの計算結果を返す。
 * @precondition 「commonFields: Common、input: Readonly<{ decisionId: string; repositoryRevision: string; expectedGeneration: number; allowedOptions: readonly ("resume" | "cancel")[]; lifetimeMs: number; nowEpochMs?: number; }>」がissueCoordinatorHumanDecisionの入力契約を満たす。
 * @postcondition issueCoordinatorHumanDecisionの責務を完了した結果だけを返す。
 * @effect N/A: issueCoordinatorHumanDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure issueCoordinatorHumanDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant issueCoordinatorHumanDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: issueCoordinatorHumanDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: issueCoordinatorHumanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: issueCoordinatorHumanDecisionは共有非同期状態を持たない同期処理である。
 */
export function issueCoordinatorHumanDecision(
  commonFields: Common,
  input: Readonly<{
    decisionId: string;
    repositoryRevision: string;
    expectedGeneration: number;
    allowedOptions: readonly ("resume" | "cancel")[];
    lifetimeMs: number;
    nowEpochMs?: number;
  }>,
) {
  if (
    ![
      commonFields.projectId,
      commonFields.milestoneId,
      commonFields.queueId,
      commonFields.principalId,
      input.decisionId,
    ].every(validId) ||
    !REVISION.test(input.repositoryRevision) ||
    !Number.isSafeInteger(input.expectedGeneration) ||
    input.expectedGeneration < 1 ||
    input.allowedOptions.length === 0 ||
    new Set(input.allowedOptions).size !== input.allowedOptions.length ||
    !input.allowedOptions.every(
      (option) => option === "resume" || option === "cancel",
    ) ||
    !Number.isSafeInteger(input.lifetimeMs) ||
    input.lifetimeMs < 1_000 ||
    input.lifetimeMs > 86_400_000
  )
    return blocked("orchestrator_decision_request_invalid");
  const now = input.nowEpochMs ?? Date.now();
  const capability = commonFields.capability.issue();
  const recordId = coordinatorDecisionRecordId(
    commonFields.capability,
    commonFields.projectId,
    commonFields.milestoneId,
    input.decisionId,
  );
  const record: CoordinatorDecisionRecord = Object.freeze({
    recordId,
    decisionId: input.decisionId,
    projectId: commonFields.projectId,
    milestoneId: commonFields.milestoneId,
    queueId: commonFields.queueId,
    repositoryRevision: input.repositoryRevision,
    expectedGeneration: input.expectedGeneration,
    principalId: commonFields.principalId,
    allowedOptions: Object.freeze([...input.allowedOptions]),
    capabilityHash: capability.hash,
    expiresAtEpochMs: now + input.lifetimeMs,
    disposition: "pending",
    applicationId: null,
    selectedOption: null,
    newGeneration: null,
    replacementRequestId: null,
  });
  try {
    if (!stored(commonFields.store.create(record), record))
      return recoveryBlocked(commonFields, record, "continuation_issue");
  } catch {
    return recoveryBlocked(commonFields, record, "continuation_issue");
  }
  return Object.freeze({
    contract: COORDINATOR_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason: "orchestrator_human_decision_issued",
    decisionId: input.decisionId,
    recordId,
    continuationCapability: capability.secret,
    allowedOptions: record.allowedOptions,
    expiresAtEpochMs: record.expiresAtEpochMs,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}

/**
 * Apply a decision by protected-store prepare -> repository generation -> protected-store finalize.
 *
 * @responsibility human-decisionの入力からsubmit Coordinator Human Decisionを導く規則と結果境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、input: Readonly<{ decisionId: string; recordId: string; repositoryRevision: string; generation: number; selectedOption: "resume" | "cancel"; continuationCapability: string; nowEpochMs?: number; }>
 * @returns submitCoordinatorHumanDecisionの計算結果を返す。
 * @precondition 「commonFields: Common、input: Readonly<{ decisionId: string; recordId: string; repositoryRevision: string; generation: number; selectedOption: "resume" | "cancel"; continuationCapability: string; nowEpochMs?: number; }>」がsubmitCoordinatorHumanDecisionの入力契約を満たす。
 * @postcondition submitCoordinatorHumanDecisionの責務を完了した結果だけを返す。
 * @effect N/A: submitCoordinatorHumanDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure submitCoordinatorHumanDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant submitCoordinatorHumanDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: submitCoordinatorHumanDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: submitCoordinatorHumanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: submitCoordinatorHumanDecisionは共有非同期状態を持たない同期処理である。
 */
export function submitCoordinatorHumanDecision(
  commonFields: Common,
  input: Readonly<{
    decisionId: string;
    recordId: string;
    repositoryRevision: string;
    generation: number;
    selectedOption: "resume" | "cancel";
    continuationCapability: string;
    nowEpochMs?: number;
  }>,
) {
  if (
    ![
      commonFields.projectId,
      commonFields.milestoneId,
      commonFields.queueId,
      commonFields.principalId,
      input.decisionId,
      input.recordId,
    ].every(validId) ||
    !REVISION.test(input.repositoryRevision) ||
    !Number.isSafeInteger(input.generation) ||
    input.generation < 1 ||
    (input.selectedOption !== "resume" && input.selectedOption !== "cancel") ||
    typeof input.continuationCapability !== "string" ||
    input.continuationCapability.length > 512
  )
    return blocked("orchestrator_decision_input_invalid");
  let record: CoordinatorDecisionRecord;
  try {
    const observed = commonFields.store.read(input.recordId);
    if (
      !observed ||
      typeof observed !== "object" ||
      !isCoordinatorDecisionRecord((observed as Record<string, unknown>).value)
    )
      return blocked("orchestrator_decision_not_observed");
    record = (observed as { value: CoordinatorDecisionRecord }).value;
  } catch {
    return blocked("orchestrator_decision_store_observation_unknown", true);
  }
  const now = input.nowEpochMs ?? Date.now();
  if (record.disposition === "finalized")
    return blocked("orchestrator_decision_already_consumed");
  if (record.disposition === "pending" && record.expiresAtEpochMs < now) {
    const expired = Object.freeze({
      ...record,
      disposition: "expired" as const,
    });
    try {
      if (!stored(commonFields.store.compareAndSet(record, expired), expired))
        return recoveryBlocked(commonFields, record, "continuation_expiry");
    } catch {
      return recoveryBlocked(commonFields, record, "continuation_expiry");
    }
    return blocked("orchestrator_decision_expired");
  }
  if (
    record.disposition !== "pending" ||
    record.decisionId !== input.decisionId ||
    record.projectId !== commonFields.projectId ||
    record.milestoneId !== commonFields.milestoneId ||
    record.queueId !== commonFields.queueId ||
    record.repositoryRevision !== input.repositoryRevision ||
    record.expectedGeneration !== input.generation ||
    record.principalId !== commonFields.principalId ||
    !record.allowedOptions.includes(input.selectedOption) ||
    record.capabilityHash !==
      commonFields.capability.hash(input.continuationCapability)
  )
    return blocked("orchestrator_decision_binding_mismatch_or_expired");
  const stateRead = commonFields.persistence.state.readState(
    commonFields.projectId,
  );
  const queueRead = commonFields.persistence.state.readQueue(
    commonFields.queueId,
  );
  if (
    stateRead.status !== "completed" ||
    !stateRead.value ||
    queueRead.status !== "completed"
  )
    return blocked(
      "orchestrator_decision_repository_observation_unknown",
      true,
    );
  if (
    stateRead.value.milestoneId !== commonFields.milestoneId ||
    stateRead.value.repositoryRevision !== input.repositoryRevision ||
    stateRead.value.generation !== input.generation ||
    queueRead.value.state !== "human_decision_required" ||
    queueRead.value.ownerGeneration !== null
  )
    return blocked("orchestrator_decision_stale");
  const applicationId = `decision-application-${commonFields.capability
    .hash(
      [record.recordId, String(input.generation), input.selectedOption].join(
        "\0",
      ),
    )
    .slice(0, 40)}`;
  const prepared = Object.freeze({
    ...record,
    disposition: "prepared" as const,
    applicationId,
    selectedOption: input.selectedOption,
    newGeneration: input.generation + 1,
  });
  try {
    if (!stored(commonFields.store.compareAndSet(record, prepared), prepared))
      return recoveryBlocked(commonFields, record, "continuation_prepare");
  } catch {
    return recoveryBlocked(commonFields, record, "continuation_prepare");
  }
  const transition = applyCoordinatorHumanDecision(
    stateRead.value,
    input.generation,
    input.selectedOption,
    applicationId,
  );
  if (transition.status !== "completed" || !transition.state)
    return recoveryBlocked(commonFields, prepared, "project_transition");
  const written = commonFields.persistence.state.writeState(
    transition.state,
    input.generation,
  );
  if (written.status !== "completed")
    return recoveryBlocked(commonFields, prepared, "project_write");
  const readback = commonFields.persistence.state.readState(
    commonFields.projectId,
  );
  if (
    readback.status !== "completed" ||
    !readback.value ||
    readback.value.generation !== input.generation + 1 ||
    readback.value.decisionApplicationId !== applicationId ||
    readback.value.milestone.state !==
      (input.selectedOption === "resume" ? "executing" : "cancelled")
  )
    return recoveryBlocked(commonFields, prepared, "project_readback");
  const finalized = Object.freeze({
    ...prepared,
    disposition: "finalized" as const,
  });
  try {
    if (
      !stored(commonFields.store.compareAndSet(prepared, finalized), finalized)
    )
      return recoveryBlocked(commonFields, prepared, "continuation_finalize");
  } catch {
    return recoveryBlocked(commonFields, prepared, "continuation_finalize");
  }
  const queueUpdate = commonFields.persistence.state.updateQueue(
    commonFields.queueId,
    queueRead.value.generation,
    {
      state:
        input.selectedOption === "resume" ? "replan_required" : "cancelled",
      lease: null,
      resumeCondition:
        input.selectedOption === "resume" ? "human_decision_applied" : null,
      resultReference: record.recordId,
    },
  );
  if (queueUpdate.status !== "completed")
    return recoveryBlocked(commonFields, finalized, "queue_update");
  return Object.freeze({
    contract: COORDINATOR_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason:
      input.selectedOption === "resume"
        ? "orchestrator_decision_applied_resume_pending"
        : "orchestrator_decision_applied_cancelled",
    decisionId: record.decisionId,
    applicationId,
    generation: input.generation + 1,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}

/**
 * Replace a capability only after the former hash is durably invalidated.
 *
 * @responsibility human-decisionの入力からreplace Coordinator Human Decisionを導く規則と結果境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、input: Readonly<{ recordId: string; replacementRequestId: string; lifetimeMs: number; nowEpochMs?: number; }>
 * @returns replaceCoordinatorHumanDecisionの計算結果を返す。
 * @precondition 「commonFields: Common、input: Readonly<{ recordId: string; replacementRequestId: string; lifetimeMs: number; nowEpochMs?: number; }>」がreplaceCoordinatorHumanDecisionの入力契約を満たす。
 * @postcondition replaceCoordinatorHumanDecisionの責務を完了した結果だけを返す。
 * @effect N/A: replaceCoordinatorHumanDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure replaceCoordinatorHumanDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant replaceCoordinatorHumanDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: replaceCoordinatorHumanDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: replaceCoordinatorHumanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: replaceCoordinatorHumanDecisionは共有非同期状態を持たない同期処理である。
 */
export function replaceCoordinatorHumanDecision(
  commonFields: Common,
  input: Readonly<{
    recordId: string;
    replacementRequestId: string;
    lifetimeMs: number;
    nowEpochMs?: number;
  }>,
) {
  if (
    !validId(input.recordId) ||
    !validId(input.replacementRequestId) ||
    !Number.isSafeInteger(input.lifetimeMs) ||
    input.lifetimeMs < 1_000 ||
    input.lifetimeMs > 86_400_000
  )
    return blocked("orchestrator_decision_replacement_input_invalid");
  let record: CoordinatorDecisionRecord;
  try {
    const observed = commonFields.store.read(input.recordId) as Readonly<{
      status: string;
      value: CoordinatorDecisionRecord | null;
    }> | null;
    if (observed?.status !== "completed" || !observed.value)
      return blocked("orchestrator_decision_not_observed");
    record = observed.value;
  } catch {
    return blocked("orchestrator_decision_store_observation_unknown", true);
  }
  if (
    record.projectId !== commonFields.projectId ||
    record.milestoneId !== commonFields.milestoneId ||
    record.queueId !== commonFields.queueId ||
    record.principalId !== commonFields.principalId
  )
    return blocked("orchestrator_decision_replacement_binding_mismatch");
  if (
    record.disposition === "pending" &&
    record.replacementRequestId === input.replacementRequestId
  )
    return blocked("orchestrator_decision_replacement_already_issued");
  if (record.disposition !== "pending")
    return blocked("orchestrator_decision_replacement_not_applicable");
  const invalidated = Object.freeze({
    ...record,
    disposition: "invalidated" as const,
    replacementRequestId: input.replacementRequestId,
  });
  try {
    if (
      !stored(
        commonFields.store.compareAndSet(record, invalidated),
        invalidated,
      )
    )
      return recoveryBlocked(commonFields, record, "replacement_invalidation");
  } catch {
    return recoveryBlocked(commonFields, record, "replacement_invalidation");
  }
  const capability = commonFields.capability.issue();
  const replacement: CoordinatorDecisionRecord = Object.freeze({
    ...invalidated,
    capabilityHash: capability.hash,
    expiresAtEpochMs: (input.nowEpochMs ?? Date.now()) + input.lifetimeMs,
    disposition: "pending",
    applicationId: null,
    selectedOption: null,
    newGeneration: null,
  });
  try {
    if (
      !stored(
        commonFields.store.compareAndSet(invalidated, replacement),
        replacement,
      )
    )
      return recoveryBlocked(commonFields, invalidated, "replacement_issue");
  } catch {
    return recoveryBlocked(commonFields, invalidated, "replacement_issue");
  }
  return Object.freeze({
    contract: COORDINATOR_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason: "orchestrator_human_decision_replaced",
    decisionId: replacement.decisionId,
    recordId: replacement.recordId,
    replacementRequestId: input.replacementRequestId,
    continuationCapability: capability.secret,
    allowedOptions: replacement.allowedOptions,
    expiresAtEpochMs: replacement.expiresAtEpochMs,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}

/**
 * Invalidate an unused capability after a fresh parent lifecycle observation.
 *
 * @responsibility human-decisionの入力からinvalidate Coordinator Human Decisionを導く規則と結果境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、input: Readonly<{ recordId: string; reason: "project_advanced" | "milestone_accepted" | "milestone_cancelled"; }>
 * @returns invalidateCoordinatorHumanDecisionの計算結果を返す。
 * @precondition 「commonFields: Common、input: Readonly<{ recordId: string; reason: "project_advanced" | "milestone_accepted" | "milestone_cancelled"; }>」がinvalidateCoordinatorHumanDecisionの入力契約を満たす。
 * @postcondition invalidateCoordinatorHumanDecisionの責務を完了した結果だけを返す。
 * @effect N/A: invalidateCoordinatorHumanDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure invalidateCoordinatorHumanDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant invalidateCoordinatorHumanDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: invalidateCoordinatorHumanDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: invalidateCoordinatorHumanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: invalidateCoordinatorHumanDecisionは共有非同期状態を持たない同期処理である。
 */
export function invalidateCoordinatorHumanDecision(
  commonFields: Common,
  input: Readonly<{
    recordId: string;
    reason: "project_advanced" | "milestone_accepted" | "milestone_cancelled";
  }>,
) {
  if (!validId(input.recordId))
    return blocked("orchestrator_decision_invalidation_input_invalid");
  let record: CoordinatorDecisionRecord;
  try {
    const observed = commonFields.store.read(input.recordId) as Readonly<{
      status: string;
      value: CoordinatorDecisionRecord | null;
    }> | null;
    if (observed?.status !== "completed" || !observed.value)
      return blocked("orchestrator_decision_not_observed");
    record = observed.value;
  } catch {
    return blocked("orchestrator_decision_store_observation_unknown", true);
  }
  if (record.disposition === "prepared")
    return recoverCoordinatorHumanDecision(commonFields, {
      recordId: input.recordId,
    });
  if (["invalidated", "expired", "finalized"].includes(record.disposition))
    return Object.freeze({
      contract: COORDINATOR_HUMAN_DECISION_CONTRACT,
      status: "completed" as const,
      reason: "orchestrator_decision_already_settled",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "settled" as const,
    });
  if (record.disposition !== "pending")
    return blocked("orchestrator_decision_invalidation_not_applicable");
  const state = commonFields.persistence.state.readState(
    commonFields.projectId,
  );
  if (state.status !== "completed" || !state.value)
    return recoveryBlocked(
      commonFields,
      record,
      "invalidation_project_observation",
    );
  const isParentProvesInvalidation =
    state.value.generation !== record.expectedGeneration ||
    (input.reason === "milestone_accepted" &&
      state.value.milestone.state === "accepted") ||
    (input.reason === "milestone_cancelled" &&
      state.value.milestone.state === "cancelled");
  if (!isParentProvesInvalidation)
    return blocked("orchestrator_decision_invalidation_not_proven");
  const invalidated = Object.freeze({
    ...record,
    disposition: "invalidated" as const,
  });
  try {
    if (
      !stored(
        commonFields.store.compareAndSet(record, invalidated),
        invalidated,
      )
    )
      return recoveryBlocked(commonFields, record, "invalidation_update");
  } catch {
    return recoveryBlocked(commonFields, record, "invalidation_update");
  }
  return Object.freeze({
    contract: COORDINATOR_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason: "orchestrator_decision_invalidated",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}

/**
 * Reconcile a prepared decision after process loss without replaying its authority.
 *
 * @responsibility human-decisionの入力からrecover Coordinator Human Decisionを導く規則と結果境界を所有する。
 * @trace ARCH-000005
 * @input commonFields: Common、input: Readonly<{ recordId: string }>
 * @returns recoverCoordinatorHumanDecisionの計算結果を返す。
 * @precondition 「commonFields: Common、input: Readonly<{ recordId: string }>」がrecoverCoordinatorHumanDecisionの入力契約を満たす。
 * @postcondition recoverCoordinatorHumanDecisionの責務を完了した結果だけを返す。
 * @effect N/A: recoverCoordinatorHumanDecisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure recoverCoordinatorHumanDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant recoverCoordinatorHumanDecisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoverCoordinatorHumanDecisionはProcess内の同一Subsystemで完結する。
 * @security N/A: recoverCoordinatorHumanDecisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoverCoordinatorHumanDecisionは共有非同期状態を持たない同期処理である。
 */
export function recoverCoordinatorHumanDecision(
  commonFields: Common,
  input: Readonly<{ recordId: string }>,
) {
  if (!validId(input.recordId))
    return blocked("orchestrator_decision_recovery_input_invalid");
  let record: CoordinatorDecisionRecord;
  try {
    const observed = commonFields.store.read(input.recordId);
    if (
      !observed ||
      typeof observed !== "object" ||
      !isCoordinatorDecisionRecord((observed as Record<string, unknown>).value)
    )
      return blocked("orchestrator_decision_not_observed");
    record = (observed as { value: CoordinatorDecisionRecord }).value;
  } catch {
    return blocked("orchestrator_decision_store_observation_unknown", true);
  }
  if (record.disposition === "finalized")
    return Object.freeze({
      contract: COORDINATOR_HUMAN_DECISION_CONTRACT,
      status: "completed" as const,
      reason: "orchestrator_decision_recovery_already_finalized",
      decisionId: record.decisionId,
      applicationId: record.applicationId,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "settled" as const,
    });
  if (
    record.disposition !== "prepared" ||
    record.projectId !== commonFields.projectId ||
    record.milestoneId !== commonFields.milestoneId ||
    record.queueId !== commonFields.queueId ||
    record.principalId !== commonFields.principalId ||
    record.applicationId === null ||
    record.selectedOption === null ||
    record.newGeneration !== record.expectedGeneration + 1
  )
    return blocked("orchestrator_decision_recovery_not_applicable");
  const state = commonFields.persistence.state.readState(
    commonFields.projectId,
  );
  if (state.status !== "completed" || !state.value)
    return recoveryBlocked(
      commonFields,
      record,
      "recovery_project_observation",
    );
  let next: CoordinatorDecisionRecord;
  if (
    state.value.generation === record.newGeneration &&
    state.value.decisionApplicationId === record.applicationId &&
    state.value.milestone.state ===
      (record.selectedOption === "resume" ? "executing" : "cancelled")
  ) {
    next = Object.freeze({ ...record, disposition: "finalized" as const });
  } else if (
    state.value.generation === record.expectedGeneration &&
    state.value.decisionApplicationId === null &&
    state.value.milestone.state === "human_decision_required"
  ) {
    next = Object.freeze({ ...record, disposition: "invalidated" as const });
  } else {
    return recoveryBlocked(commonFields, record, "recovery_identity_mismatch");
  }
  try {
    if (!stored(commonFields.store.compareAndSet(record, next), next))
      return recoveryBlocked(
        commonFields,
        record,
        "recovery_continuation_update",
      );
  } catch {
    return recoveryBlocked(
      commonFields,
      record,
      "recovery_continuation_update",
    );
  }
  if (next.disposition === "invalidated")
    return blocked("orchestrator_decision_recovery_invalidated");
  const queueRead = commonFields.persistence.state.readQueue(
    commonFields.queueId,
  );
  if (queueRead.status !== "completed")
    return recoveryBlocked(commonFields, next, "recovery_queue_observation");
  if (queueRead.value.state === "human_decision_required") {
    const queueUpdate = commonFields.persistence.state.updateQueue(
      commonFields.queueId,
      queueRead.value.generation,
      {
        state:
          record.selectedOption === "resume" ? "replan_required" : "cancelled",
        lease: null,
        resumeCondition:
          record.selectedOption === "resume" ? "human_decision_applied" : null,
        resultReference: record.recordId,
      },
    );
    if (queueUpdate.status !== "completed")
      return recoveryBlocked(commonFields, next, "recovery_queue_update");
  }
  if (!settleRecoveryIntent(commonFields, next))
    return recoveryBlocked(commonFields, next, "recovery_intent_settlement");
  return Object.freeze({
    contract: COORDINATOR_HUMAN_DECISION_CONTRACT,
    status: "completed" as const,
    reason: "orchestrator_decision_recovery_finalized",
    decisionId: record.decisionId,
    applicationId: record.applicationId,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "settled" as const,
  });
}

/**
 * Runtime所有の判断Storeを開き、Client Principalを観測する。
 *
 * @responsibility 保護Storeの確認結果をPrincipal観測結果へ投影する。
 * @trace ARCH-000004
 * @input N/A: 呼出し引数を受け取らない。
 * @returns 検証できたPrincipal ID、またはunknownを返す。
 * @precondition Runtime所有Storeを確認できる実行環境である。
 * @postcondition 下位Storeがcompletedの場合だけverifiedを返す。
 * @effect 下位Adapterを通じて保護Storeと実行環境を確認し、既存契約に従い未作成Storeを初期化し得る。
 * @failure Storeを確認できなければunknownを返し、検証済みと扱わない。
 * @invariant 観測不能を不存在または認証成功へ変換しない。
 * @boundary 保護された判断Storeから公開Principal観測への境界。
 * @security 秘密値や判断Authorityは返さず、検証済みPrincipal IDだけを公開する。
 * @concurrency 下位Storeの排他・検証契約を変更せず、呼出しごとに観測する。
 */
export function observeRuntimeOwnedProjectClientPrincipal() {
  const observed = openRuntimeOwnedWindowsProjectDecisionStore();
  return observed.status === "completed"
    ? Object.freeze({
        status: "verified" as const,
        principalId: observed.principalId,
      })
    : Object.freeze({ status: "unknown" as const });
}

/**
 * Coordinator Public Decisionを実行する。
 *
 * @responsibility Coordinator Public Decisionの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns executeCoordinatorPublicDecisionの計算結果を返す。
 * @precondition 「openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore、rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がexecuteCoordinatorPublicDecisionの入力契約を満たす。
 * @postcondition executeCoordinatorPublicDecisionの責務を完了した結果だけを返す。
 * @effect 認証済み主体と判断記録を観測し、判断の保存と許可済み処置を既存Ownerへ委譲する。
 * @failure executeCoordinatorPublicDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 判断の対象・世代・既存処置の相関を維持し、二重処置へ補正しない。
 * @boundary 公開判断入力→Principal観測・判断Store・処置委譲の境界を接続する。
 * @security 認証済み主体と判断対象の相関を確認し、判断Capabilityの発行・消費を既存Ownerへ限定する。
 * @concurrency 返却される非同期判断処理の完了・失敗を呼出し側へ搬送する。
 */
export function executeCoordinatorPublicDecision(
  openDecisionStore: typeof openRuntimeOwnedWindowsProjectDecisionStore,
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  const request = inspectCoordinatorDecisionRequest(rawRequest);
  if (!request)
    return Object.freeze({
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_decision_input_invalid",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const { decisionId, projectId, milestoneId } = request;
  let repositoryRoot: string;
  try {
    repositoryRoot =
      resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
  } catch {
    return Object.freeze({
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_repository_root_not_verified",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  }
  const protectedStore = openDecisionStore();
  if (
    protectedStore.status !== "completed" ||
    (authenticationContext !== undefined &&
      authenticationContext.principalId !== protectedStore.principalId)
  )
    return Object.freeze({
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_decision_store_unavailable",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown" as const,
    });
  const decisionCapability = createCoordinatorDecisionCapabilityAdapter();
  const recordId = coordinatorDecisionRecordId(
    decisionCapability,
    projectId,
    milestoneId,
    decisionId,
  );
  const observed = protectedStore.store.read(recordId) as Readonly<{
    status: "completed";
    value: Readonly<Record<string, unknown>> | null;
  }> | null;
  const record = observed?.status === "completed" ? observed.value : null;
  if (
    !record ||
    typeof record.queueId !== "string" ||
    typeof record.repositoryRevision !== "string"
  )
    return Object.freeze({
      contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
      status: "blocked" as const,
      reason: "orchestrator_decision_not_observed",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect" as const,
    });
  const commonFields = {
    projectId,
    milestoneId,
    queueId: record.queueId,
    principalId: protectedStore.principalId,
    store: protectedStore.store,
    recoveryStore: createCoordinatorSnapshotDecisionRecoveryStore(
      repositoryRoot,
      deriveCoordinatorRepositoryBindingId(repositoryRoot),
    ),
    capability: decisionCapability,
    persistence: createCoordinatorPersistencePorts(
      repositoryRoot,
      deriveCoordinatorRepositoryBindingId(repositoryRoot),
    ),
  } as const;
  const result =
    record.disposition === "prepared"
      ? recoverCoordinatorHumanDecision(commonFields, { recordId })
      : submitCoordinatorHumanDecision(commonFields, {
          decisionId,
          recordId,
          repositoryRevision: request.repositoryRevision,
          generation: request.generation,
          selectedOption: request.selectedOption,
          continuationCapability: request.continuationCapability,
        });
  if (result.status === "completed") {
    const maintained = maintainCoordinatorSnapshot(
      repositoryRoot,
      deriveCoordinatorRepositoryBindingId(repositoryRoot),
    );
    if (maintained.status !== "completed")
      return Object.freeze({
        ...result,
        status: "blocked" as const,
        reason: maintained.reason,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        effectState: "unknown" as const,
      });
  }
  return result;
}

/**
 * Production decision entry shared by the CLI and MCP process.
 *
 * @responsibility Coordinator Public Decisionの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>
 * @returns runCoordinatorPublicDecisionの計算結果を返す。
 * @precondition 「rawRequest: unknown、workingDirectory、authenticationContext: Readonly<{ principalId: string }>」がrunCoordinatorPublicDecisionの入力契約を満たす。
 * @postcondition runCoordinatorPublicDecisionの責務を完了した結果だけを返す。
 * @effect 認証済み主体と判断記録を観測し、判断の保存と許可済み処置を既存Ownerへ委譲する。
 * @failure runCoordinatorPublicDecisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 判断の対象・世代・既存処置の相関を維持し、二重処置へ補正しない。
 * @boundary 公開判断入力→Principal観測・判断Store・処置委譲の境界を接続する。
 * @security 認証済み主体と判断対象の相関を確認し、判断Capabilityの発行・消費を既存Ownerへ限定する。
 * @concurrency 返却される非同期判断処理の完了・失敗を呼出し側へ搬送する。
 */
export function runCoordinatorPublicDecision(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    return executeCoordinatorPublicDecision(
      openRuntimeOwnedWindowsProjectDecisionStore,
      rawRequest,
      workingDirectory,
      authenticationContext,
    );
  } catch (error) {
    if (error instanceof RepositoryRuntimeDataAreaBlockedError)
      return coordinatorDataBoundaryBlocked(error);
    throw error;
  }
}

/**
 * 統合保存上の受入判断Storeを構築する。
 * @responsibility 二世代の判断記録を同じ短期排他で作成・読取り・比較交換する。
 * @trace ARCH-000005
 * @input workingDirectory: 検証するRepository、binding: 期待結合。
 * @returns 既存の受入判断Store Port。
 * @precondition 全入力照合済みv2保存がある。
 * @postcondition 期待値不一致と重複作成を拒否し、他区画を保持する。
 * @effect 操作時に統合保存を更新する。
 * @failure 未知版、破損、不存在、比較不一致は停止する。
 * @invariant 第2世代単独を許さず、JSONから人間承認を生成しない。
 * @boundary 受入判断PortとRepository内現在状態。
 * @security 保護Authorityや秘密値を移さない。
 * @concurrency 読取りと比較交換を同じ保存Ownerへ閉じる。
 */
export function createCoordinatorSnapshotAcceptanceDecisionStore(
  workingDirectory: string,
  binding: string,
): CoordinatorAcceptanceDecisionStore {
  return Object.freeze({
    /**
     * 受入判断の初回記録を作成する。
     * @responsibility 同Identityの二重作成を拒否する。
     * @trace ARCH-000005
     * @input record: preparedの判断記録。
     * @returns 確定した記録または停止。
     * @precondition v2保存が存在する。
     * @postcondition 第1世代だけを追加する。
     * @effect 統合保存を更新する。
     * @failure 不正値と重複を拒否する。
     * @invariant 他区画を変更しない。
     * @boundary 判断Portと保存。
     * @security 承認Authorityを新設しない。
     * @concurrency 同じ保存Ownerで処置する。
     */
    create(record) {
      return withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !validCoordinatorAcceptanceDecisionRecord(record) ||
            record.disposition !== "prepared"
          )
            return storeBlocked("orchestrator_acceptance_record_invalid");
          if (
            current.acceptanceDecisions.some(
              (item) => item.recordId === record.recordId,
            )
          )
            return storeBlocked("orchestrator_acceptance_record_exists");
          const entry: CoordinatorAcceptanceDecisionEnvelope = {
            contract: COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT,
            repositoryBindingId: binding,
            recordId: record.recordId,
            generation: 1,
            previousHash: null,
            record,
          };
          return completed("orchestrator_acceptance_record_created", {
            next: {
              ...current,
              acceptanceDecisions: [...current.acceptanceDecisions, entry],
            },
            value: record,
          });
        },
      );
    },
    /**
     * 照合済みの最新受入判断を返す。
     * @responsibility 二世代の結合を維持する。
     * @trace ARCH-000005
     * @input recordId: 対象判断。
     * @returns 最新記録、真正不存在または停止。
     * @precondition v2保存が存在する。
     * @postcondition 保存値を変更しない。
     * @effect 保存を読み取る。
     * @failure 不正Identityと未知版を拒否する。
     * @invariant 不明を不存在へ丸めない。
     * @boundary 判断Portと保存。
     * @security Authorityを発行しない。
     * @concurrency 短期保存Ownerを保持する。
     */
    read(recordId) {
      return withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !validId(recordId)
          )
            return storeBlocked(
              "orchestrator_acceptance_record_identity_invalid",
            );
          const groups = current.acceptanceDecisions.filter(
            (item) => item.recordId === recordId,
          );
          return completed("orchestrator_acceptance_record_observed", {
            next: null,
            value:
              groups.find((item) => item.generation === 2)?.record ??
              groups.find((item) => item.generation === 1)?.record ??
              null,
          });
        },
      );
    },
    /**
     * 受入判断を確定する。
     * @responsibility preparedの完全一致を前提に第2世代を追加する。
     * @trace ARCH-000005
     * @input expectedとnext: 期待値と確定値。
     * @returns 確定記録または停止。
     * @precondition 期待値が現在の第1世代と一致する。
     * @postcondition 第1世代のHashへ結合する。
     * @effect 統合保存を更新する。
     * @failure 比較競合と二重確定を拒否する。
     * @invariant 第2世代を単独作成しない。
     * @boundary 判断Portと保存。
     * @security Authorityを発行しない。
     * @concurrency 比較と確定を同じOwnerで行う。
     */
    compareAndSet(expected, next) {
      return withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !validCoordinatorAcceptanceDecisionRecord(expected) ||
            !validCoordinatorAcceptanceDecisionRecord(next) ||
            expected.recordId !== next.recordId ||
            expected.disposition !== "prepared" ||
            next.disposition !== "finalized"
          )
            return storeBlocked(
              "orchestrator_acceptance_record_transition_invalid",
            );
          const first = current.acceptanceDecisions.find(
            (item) =>
              item.recordId === expected.recordId && item.generation === 1,
          );
          if (
            !first ||
            encodeCoordinatorStateValue(first.record) !==
              encodeCoordinatorStateValue(expected)
          )
            return storeBlocked(
              "orchestrator_acceptance_record_generation_mismatch",
            );
          if (
            current.acceptanceDecisions.some(
              (item) =>
                item.recordId === expected.recordId && item.generation === 2,
            )
          )
            return storeBlocked("orchestrator_acceptance_record_exists");
          const entry: CoordinatorAcceptanceDecisionEnvelope = {
            contract: COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT,
            repositoryBindingId: binding,
            recordId: expected.recordId,
            generation: 2,
            previousHash: digest(encodeCoordinatorStateValue(first)),
            record: next,
          };
          return completed("orchestrator_acceptance_record_finalized", {
            next: {
              ...current,
              acceptanceDecisions: [...current.acceptanceDecisions, entry],
            },
            value: next,
          });
        },
      );
    },
  });
}

/**
 * 統合保存上の判断回復Storeを構築する。
 * @responsibility exactな回復記録の現在値と比較交換世代を保持する。
 * @trace ARCH-000008
 * @input workingDirectory: 検証するRepository、binding: 期待結合。
 * @returns 既存の判断回復Store Port。
 * @precondition 旧入力の全連鎖を照合したv2保存がある。
 * @postcondition 回復Identityと期待値の完全一致を維持する。
 * @effect 操作時に統合保存を更新する。
 * @failure 不正入力、未知版、比較競合、保存未確定は停止する。
 * @invariant 保存改訂を記録比較交換の代替にしない。
 * @boundary 判断回復PortとRepository内現在状態。
 * @security 保存状態から回復Authorityを新設しない。
 * @concurrency 現在値の確認と確定を同じOwnerで行う。
 */
export function createCoordinatorSnapshotDecisionRecoveryStore(
  workingDirectory: string,
  binding: string,
): CoordinatorDecisionRecoveryStore {
  return Object.freeze({
    /**
     * 判断回復の初回意図を保存する。
     * @responsibility 同回復Identityの二重作成を拒否する。
     * @trace ARCH-000008
     * @input intent: 回復意図。
     * @returns 確定意図または停止。
     * @precondition v2保存と対象Queueがある。
     * @postcondition 記録世代1を追加する。
     * @effect 統合保存を更新する。
     * @failure 不正値と重複を拒否する。
     * @invariant 元の回復Identityを維持する。
     * @boundary 回復Portと保存。
     * @security 回復Authorityを新設しない。
     * @concurrency 同じ保存Ownerで処置する。
     */
    create(intent) {
      return withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !validCoordinatorDecisionRecoveryIntent(intent)
          )
            return storeBlocked("orchestrator_decision_recovery_invalid");
          if (
            current.decisionRecoveries.some(
              (item) => item.value.recoveryId === intent.recoveryId,
            )
          )
            return storeBlocked("orchestrator_decision_recovery_exists");
          return completed("orchestrator_decision_recovery_created", {
            next: {
              ...current,
              decisionRecoveries: [
                ...current.decisionRecoveries,
                { generation: 1, value: intent },
              ],
            },
            value: intent,
          });
        },
      );
    },
    /**
     * exactな判断回復を読み取る。
     * @responsibility 最新値と真正不存在を区別する。
     * @trace ARCH-000008
     * @input recoveryId: 対象回復。
     * @returns 現在値、真正不存在または停止。
     * @precondition v2保存が存在する。
     * @postcondition 記録を変更しない。
     * @effect 保存を読み取る。
     * @failure 不正値と未知版を拒否する。
     * @invariant 観測不能を不存在へ丸めない。
     * @boundary 回復Portと保存。
     * @security Authorityを発行しない。
     * @concurrency 短期保存Ownerを保持する。
     */
    read(recoveryId) {
      return withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !validId(recoveryId)
          )
            return storeBlocked("orchestrator_decision_recovery_invalid");
          return completed("orchestrator_decision_recovery_observed", {
            next: null,
            value:
              current.decisionRecoveries.find(
                (item) => item.value.recoveryId === recoveryId,
              )?.value ?? null,
          });
        },
      );
    },
    /**
     * 判断回復の現在値を比較交換する。
     * @responsibility 期待値の完全一致と記録世代を維持する。
     * @trace ARCH-000008
     * @input expectedとnext: 期待値と更新値。
     * @returns 更新値または停止。
     * @precondition 同じ回復Identityを扱う。
     * @postcondition 記録世代を一つ進める。
     * @effect 統合保存を更新する。
     * @failure 比較競合と結合差を拒否する。
     * @invariant 保存改訂をCASの代替にしない。
     * @boundary 回復Portと保存。
     * @security Authorityを発行しない。
     * @concurrency 比較と確定を同じOwnerで行う。
     */
    compareAndSet(expected, next) {
      return withCoordinatorSnapshotOperation(
        workingDirectory,
        binding,
        (current) => {
          if (
            current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA ||
            !validCoordinatorDecisionRecoveryIntent(expected) ||
            !validCoordinatorDecisionRecoveryIntent(next) ||
            expected.recoveryId !== next.recoveryId
          )
            return storeBlocked("orchestrator_decision_recovery_invalid");
          const prior = current.decisionRecoveries.find(
            (item) => item.value.recoveryId === expected.recoveryId,
          );
          if (
            !prior ||
            encodeCoordinatorStateValue(prior.value) !==
              encodeCoordinatorStateValue(expected)
          )
            return storeBlocked(
              "orchestrator_decision_recovery_generation_mismatch",
            );
          return completed("orchestrator_decision_recovery_updated", {
            next: {
              ...current,
              decisionRecoveries: current.decisionRecoveries.map((item) =>
                item === prior
                  ? { generation: prior.generation + 1, value: next }
                  : item,
              ),
            },
            value: next,
          });
        },
      );
    },
  });
}
