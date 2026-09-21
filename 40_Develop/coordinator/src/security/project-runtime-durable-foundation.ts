import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type {
  ProjectQueueEntry,
  ProjectQueueState,
  ProjectRuntimeLease,
  ProjectRuntimeLeaseAcquisitionResolution,
  ProjectRuntimeLeaseKind,
  ProjectRuntimeLeaseOwnerObservation,
  ProjectRuntimeLeasePort,
  ProjectRuntimePersistencePorts,
  ProjectRuntimePortResult,
  ProjectRuntimeState,
  ProjectRuntimeStatePort,
  ProjectTaskRecoveryObligation,
} from "../../../project-runtime/src/index.ts";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../runtime-data/src/index.ts";

export const PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT =
  "crdd-coordinator/project-runtime-durable-foundation/v1" as const;

/**
 * StoreResultが扱う値の構造を表す。
 *
 * @responsibility StoreResultに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape StoreResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StoreResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: StoreResultの宣言は外部境界を開かない。
 * @security StoreResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StoreResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type StoreResult<T> = ProjectRuntimePortResult<T>;
/**
 * LeaseKindが扱う値の構造を表す。
 *
 * @responsibility LeaseKindに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape LeaseKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseKindの宣言は外部境界を開かない。
 * @security LeaseKindはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LeaseKind = ProjectRuntimeLeaseKind;

/**
 * ActiveLeaseが扱う値の構造を表す。
 *
 * @responsibility ActiveLeaseに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ActiveLeaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ActiveLeaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: ActiveLeaseの宣言は外部境界を開かない。
 * @security ActiveLeaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ActiveLeaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ActiveLease = Readonly<{
  repositoryRoot: string;
  repositoryBindingId: string;
  projectId: string;
  queueId: string;
  kind: LeaseKind;
  ownerGeneration: string;
  lock: string;
  recoveryMarker: string;
  acquisitionMarker: string;
  lockOwnershipMarker: string;
  evidenceDirectory: string;
  identity: string;
}>;

const activeLeases = new WeakMap<ProjectRuntimeLease, ActiveLease>();

/**
 * Envelopeが扱う値の構造を表す。
 *
 * @responsibility Envelopeに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape Envelopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Envelopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: Envelopeの宣言は外部境界を開かない。
 * @security EnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Envelopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Envelope = Readonly<{
  schema: typeof PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT;
  schemaRevision: 1;
  recordKind: "project-state" | "queue-entry" | "lease-evidence";
  repositoryBindingId: string;
  projectId: string;
  createdGeneration: number;
  updatedGeneration: number;
  contentHash: string;
  content: unknown;
}>;

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const REVISION = /^[0-9a-f]{40,64}$/u;
const MAX_RECORD_BYTES = 16 * 1024 * 1024;
const PROJECT_QUEUE_STATES = new Set<ProjectQueueState>([
  "queued",
  "leased",
  "running",
  "waiting_foreground",
  "integration_pending",
  "replan_required",
  "human_decision_required",
  "recovery_required",
  "completed",
  "cancelled",
]);

/**
 * errorCodeの処理を実行する。
 *
 * @responsibility errorCodeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns errorCodeの計算結果を返す。
 * @precondition 「error: unknown」がerrorCodeの入力契約を満たす。
 * @postcondition errorCodeの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeは独自の失敗分岐を所有しない。
 * @invariant errorCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorCodeはProcess内の同一Subsystemで完結する。
 * @security errorCodeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorCodeは共有非同期状態を持たない同期処理である。
 */
function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : null;
}

/**
 * exactKeysの処理を実行する。
 *
 * @responsibility exactKeysに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: object、keys: readonly string[]
 * @returns exactKeysの計算結果を返す。
 * @precondition 「value: object、keys: readonly string[]」がexactKeysの入力契約を満たす。
 * @postcondition exactKeysの責務を完了した結果だけを返す。
 * @effect N/A: exactKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactKeysは独自の失敗分岐を所有しない。
 * @invariant exactKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactKeysはProcess内の同一Subsystemで完結する。
 * @security exactKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactKeysは共有非同期状態を持たない同期処理である。
 */
function exactKeys(value: object, keys: readonly string[]) {
  const actualValues = Object.keys(value).sort();
  const expectedValues = [...keys].sort();
  return (
    actualValues.length === expectedValues.length &&
    actualValues.every((key, index) => key === expectedValues[index])
  );
}

/**
 * plainObjectの処理を実行する。
 *
 * @responsibility plainObjectに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がplainObjectの入力契約を満たす。
 * @postcondition plainObjectの責務を完了した結果だけを返す。
 * @effect N/A: plainObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: plainObjectは独自の失敗分岐を所有しない。
 * @invariant plainObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: plainObjectはProcess内の同一Subsystemで完結する。
 * @security plainObjectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: plainObjectは共有非同期状態を持たない同期処理である。
 */
function plainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * stringArrayの処理を実行する。
 *
 * @responsibility stringArrayに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximum
 * @returns value is readonly string[]を返す。
 * @precondition 「value: unknown、maximum」がstringArrayの入力契約を満たす。
 * @postcondition stringArrayの責務を完了した結果だけを返す。
 * @effect N/A: stringArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: stringArrayは独自の失敗分岐を所有しない。
 * @invariant stringArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: stringArrayはProcess内の同一Subsystemで完結する。
 * @security stringArrayはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stringArrayは共有非同期状態を持たない同期処理である。
 */
function stringArray(
  value: unknown,
  maximum = 128,
): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every(
      (item) =>
        typeof item === "string" && item.length > 0 && item.length <= 512,
    )
  );
}

/**
 * nullableIdの処理を実行する。
 *
 * @responsibility nullableIdに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns nullableIdの計算結果を返す。
 * @precondition 「value: unknown」がnullableIdの入力契約を満たす。
 * @postcondition nullableIdの責務を完了した結果だけを返す。
 * @effect N/A: nullableIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nullableIdは独自の失敗分岐を所有しない。
 * @invariant nullableIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nullableIdはProcess内の同一Subsystemで完結する。
 * @security nullableIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nullableIdは共有非同期状態を持たない同期処理である。
 */
function nullableId(value: unknown) {
  return value === null || validId(value);
}

/**
 * nullableCandidateIdの処理を実行する。
 *
 * @responsibility nullableCandidateIdに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns nullableCandidateIdの計算結果を返す。
 * @precondition 「value: unknown」がnullableCandidateIdの入力契約を満たす。
 * @postcondition nullableCandidateIdの責務を完了した結果だけを返す。
 * @effect N/A: nullableCandidateIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nullableCandidateIdは独自の失敗分岐を所有しない。
 * @invariant nullableCandidateIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nullableCandidateIdはProcess内の同一Subsystemで完結する。
 * @security nullableCandidateIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nullableCandidateIdは共有非同期状態を持たない同期処理である。
 */
function nullableCandidateId(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value))
  );
}

/**
 * nullableRecoveryIdの処理を実行する。
 *
 * @responsibility nullableRecoveryIdに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns nullableRecoveryIdの計算結果を返す。
 * @precondition 「value: unknown」がnullableRecoveryIdの入力契約を満たす。
 * @postcondition nullableRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: nullableRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nullableRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant nullableRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nullableRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security nullableRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nullableRecoveryIdは共有非同期状態を持たない同期処理である。
 */
function nullableRecoveryId(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value))
  );
}

/**
 * recoveryObligationsの処理を実行する。
 *
 * @responsibility recoveryObligationsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is readonly ProjectTaskRecoveryObligation[]を返す。
 * @precondition 「value: unknown」がrecoveryObligationsの入力契約を満たす。
 * @postcondition recoveryObligationsの責務を完了した結果だけを返す。
 * @effect N/A: recoveryObligationsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryObligationsは独自の失敗分岐を所有しない。
 * @invariant recoveryObligationsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryObligationsはProcess内の同一Subsystemで完結する。
 * @security recoveryObligationsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoveryObligationsは共有非同期状態を持たない同期処理である。
 */
function recoveryObligations(
  value: unknown,
): value is readonly ProjectTaskRecoveryObligation[] {
  if (!Array.isArray(value) || value.length > 128) return false;
  const identities = new Set<string>();
  for (const entry of value) {
    const acknowledgementKeys = [
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "taskId",
      "attemptId",
      "operationId",
      "recoveryId",
      "settlementGeneration",
      "runtimeStateBinding",
      "receiptContentHash",
      "receiptContentIdentity",
    ];
    const acknowledgement = entry?.acknowledgement;
    const binding = plainObject(acknowledgement)
      ? acknowledgement.runtimeStateBinding
      : null;
    const isValidAcknowledgement =
      plainObject(acknowledgement) &&
      exactKeys(acknowledgement, acknowledgementKeys) &&
      [
        acknowledgement.repositoryBindingId,
        acknowledgement.projectId,
        acknowledgement.milestoneId,
        acknowledgement.taskId,
        acknowledgement.attemptId,
        acknowledgement.operationId,
      ].every(validId) &&
      nullableRecoveryId(acknowledgement.recoveryId) &&
      acknowledgement.recoveryId !== null &&
      Number.isSafeInteger(acknowledgement.settlementGeneration) &&
      Number(acknowledgement.settlementGeneration) > 0 &&
      plainObject(binding) &&
      exactKeys(binding, [
        "runtimeStateIdentityHash",
        "runtimeStateProtectionHash",
        "localUserBindingHash",
        "runtimeStateBindingHash",
      ]) &&
      Object.values(binding).every(
        (item) => typeof item === "string" && /^[a-f0-9]{64}$/u.test(item),
      ) &&
      typeof acknowledgement.receiptContentHash === "string" &&
      /^[a-f0-9]{64}$/u.test(acknowledgement.receiptContentHash) &&
      typeof acknowledgement.receiptContentIdentity === "string" &&
      acknowledgement.receiptContentIdentity.length > 0 &&
      acknowledgement.receiptContentIdentity.length <= 256;
    if (
      !plainObject(entry) ||
      !exactKeys(
        entry,
        entry.phase === "acknowledged"
          ? ["kind", "recoveryId", "phase", "acknowledgement"]
          : ["kind", "recoveryId", "phase"],
      ) ||
      ![
        "host",
        "docker",
        "candidate",
        "candidate_store",
        "runtime_process",
      ].includes(String(entry.kind)) ||
      !nullableRecoveryId(entry.recoveryId) ||
      entry.recoveryId === null ||
      !["required", "recovering", "settled", "acknowledged"].includes(
        String(entry.phase),
      ) ||
      (entry.phase === "acknowledged" &&
        (entry.kind !== "docker" ||
          !isValidAcknowledgement ||
          acknowledgement.recoveryId !== entry.recoveryId))
    )
      return false;
    const identity = `${entry.kind}\0${entry.recoveryId}`;
    if (identities.has(identity)) return false;
    identities.add(identity);
  }
  return true;
}

// Queue results may carry an exact opaque candidate or recovery reference.
// These references use the same closed character set as stable IDs, but can
// exceed the 128-character limit of ordinary project-local identifiers.
/**
 * validResultReferenceの処理を実行する。
 *
 * @responsibility validResultReferenceに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidResultReferenceの入力契約を満たす。
 * @postcondition validResultReferenceの責務を完了した結果だけを返す。
 * @effect N/A: validResultReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validResultReferenceは独自の失敗分岐を所有しない。
 * @invariant validResultReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validResultReferenceはProcess内の同一Subsystemで完結する。
 * @security validResultReferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validResultReferenceは共有非同期状態を持たない同期処理である。
 */
function validResultReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * nullableResultReferenceの処理を実行する。
 *
 * @responsibility nullableResultReferenceに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns nullableResultReferenceの計算結果を返す。
 * @precondition 「value: unknown」がnullableResultReferenceの入力契約を満たす。
 * @postcondition nullableResultReferenceの責務を完了した結果だけを返す。
 * @effect N/A: nullableResultReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nullableResultReferenceは独自の失敗分岐を所有しない。
 * @invariant nullableResultReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nullableResultReferenceはProcess内の同一Subsystemで完結する。
 * @security nullableResultReferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nullableResultReferenceは共有非同期状態を持たない同期処理である。
 */
function nullableResultReference(value: unknown) {
  return value === null || validResultReference(value);
}

/**
 * validTaskLifecycleTupleの処理を実行する。
 *
 * @responsibility validTaskLifecycleTupleに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input task: ProjectRuntimeState["tasks"][number]
 * @returns validTaskLifecycleTupleの計算結果を返す。
 * @precondition 「task: ProjectRuntimeState["tasks"][number]」がvalidTaskLifecycleTupleの入力契約を満たす。
 * @postcondition validTaskLifecycleTupleの責務を完了した結果だけを返す。
 * @effect N/A: validTaskLifecycleTupleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTaskLifecycleTupleは独自の失敗分岐を所有しない。
 * @invariant validTaskLifecycleTupleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validTaskLifecycleTupleはProcess内の同一Subsystemで完結する。
 * @security validTaskLifecycleTupleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validTaskLifecycleTupleは共有非同期状態を持たない同期処理である。
 */
function validTaskLifecycleTuple(task: ProjectRuntimeState["tasks"][number]) {
  const isAttempt = task.attemptId !== null;
  const isOperation = task.operationId !== null;
  const isAuthority = task.authorityBindingId !== null;
  if (["planned", "waiting_dependency", "ready"].includes(task.state))
    return (
      task.startPhase === "none" && !isAttempt && !isOperation && !isAuthority
    );
  if (task.state === "starting" && task.startPhase === "reserved")
    return isAttempt && !isOperation && isAuthority;
  if (task.state === "starting" && task.startPhase === "handoff_prepared")
    return isAttempt && isOperation && isAuthority;
  if (task.state === "running")
    return (
      task.startPhase === "running" && isAttempt && isOperation && isAuthority
    );
  if (
    [
      "cleanup_pending",
      "completed",
      "failed",
      "cancelled",
      "recovery_required",
      "superseded",
    ].includes(task.state)
  )
    return (
      task.startPhase === "settled" && isAttempt && isOperation && isAuthority
    );
  return false;
}

/**
 * validProjectRuntimeStateの処理を実行する。
 *
 * @responsibility validProjectRuntimeStateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is ProjectRuntimeStateを返す。
 * @precondition 「value: unknown」がvalidProjectRuntimeStateの入力契約を満たす。
 * @postcondition validProjectRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: validProjectRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validProjectRuntimeStateは独自の失敗分岐を所有しない。
 * @invariant validProjectRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validProjectRuntimeStateはProcess内の同一Subsystemで完結する。
 * @security validProjectRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validProjectRuntimeStateは共有非同期状態を持たない同期処理である。
 */
function validProjectRuntimeState(
  value: unknown,
): value is ProjectRuntimeState {
  if (
    !plainObject(value) ||
    !exactKeys(value, [
      "contract",
      "projectId",
      "milestoneId",
      "repositoryRevision",
      "generation",
      "ownerGeneration",
      "decisionApplicationId",
      "maximumConcurrency",
      "milestone",
      "objectives",
      "tasks",
    ]) ||
    value.contract !== "crdd-coordinator/project-runtime-state/v1" ||
    !validId(value.projectId) ||
    !validId(value.milestoneId) ||
    typeof value.repositoryRevision !== "string" ||
    !REVISION.test(value.repositoryRevision) ||
    !Number.isSafeInteger(value.generation) ||
    Number(value.generation) < 1 ||
    !validId(value.ownerGeneration) ||
    !nullableId(value.decisionApplicationId) ||
    !Number.isSafeInteger(value.maximumConcurrency) ||
    Number(value.maximumConcurrency) < 1 ||
    Number(value.maximumConcurrency) > 5 ||
    !plainObject(value.milestone) ||
    !exactKeys(value.milestone, [
      "id",
      "acceptanceCriteria",
      "state",
      "criterionEvidenceIds",
    ]) ||
    value.milestone.id !== value.milestoneId ||
    !stringArray(value.milestone.acceptanceCriteria) ||
    !stringArray(value.milestone.criterionEvidenceIds) ||
    !new Set([
      "planned",
      "executing",
      "integrating",
      "human_decision_required",
      "recovery_required",
      "accepted",
      "cancelled",
    ]).has(String(value.milestone.state)) ||
    !Array.isArray(value.objectives) ||
    value.objectives.length < 1 ||
    value.objectives.length > 128 ||
    !Array.isArray(value.tasks) ||
    value.tasks.length < 1 ||
    value.tasks.length > 1024
  )
    return false;

  const objectiveIds = new Set<string>();
  for (const objective of value.objectives) {
    if (
      !plainObject(objective) ||
      !exactKeys(objective, ["definition", "state", "criterionEvidenceIds"]) ||
      !plainObject(objective.definition) ||
      !exactKeys(objective.definition, ["id", "acceptanceCriteria"]) ||
      !validId(objective.definition.id) ||
      objectiveIds.has(objective.definition.id) ||
      !stringArray(objective.definition.acceptanceCriteria) ||
      !stringArray(objective.criterionEvidenceIds) ||
      !new Set([
        "planned",
        "executing",
        "integration_pending",
        "accepted",
        "blocked",
        "cancelled",
      ]).has(String(objective.state))
    )
      return false;
    objectiveIds.add(objective.definition.id);
  }

  const taskIds = new Set<string>();
  const dependencies: Array<readonly string[]> = [];
  for (const task of value.tasks) {
    const definition = plainObject(task) ? task.definition : null;
    const taskDependencies = plainObject(definition)
      ? definition.dependencies
      : null;
    const allowedPaths = plainObject(definition)
      ? definition.allowedPaths
      : null;
    const conflictKeys = plainObject(definition)
      ? definition.conflictKeys
      : null;
    if (
      !plainObject(task) ||
      !exactKeys(task, [
        "definition",
        "state",
        "attemptId",
        "operationId",
        "authorityBindingId",
        "startPhase",
        "cleanupConfirmed",
        "recoveryObligations",
        "recoveryUnresolved",
        "candidateId",
        "retryCount",
        "supersededBy",
      ]) ||
      !plainObject(task.definition) ||
      !exactKeys(task.definition, [
        "id",
        "objectiveId",
        "dependencies",
        "allowedPaths",
        "conflictKeys",
      ]) ||
      !validId(task.definition.id) ||
      taskIds.has(task.definition.id) ||
      !validId(task.definition.objectiveId) ||
      !objectiveIds.has(task.definition.objectiveId) ||
      !stringArray(taskDependencies) ||
      !stringArray(allowedPaths) ||
      allowedPaths.length < 1 ||
      !stringArray(conflictKeys) ||
      !new Set([
        "planned",
        "waiting_dependency",
        "ready",
        "starting",
        "running",
        "cleanup_pending",
        "completed",
        "failed",
        "cancelled",
        "recovery_required",
        "superseded",
      ]).has(String(task.state)) ||
      !nullableId(task.attemptId) ||
      !nullableId(task.operationId) ||
      !nullableId(task.authorityBindingId) ||
      !["none", "reserved", "handoff_prepared", "running", "settled"].includes(
        String(task.startPhase),
      ) ||
      typeof task.cleanupConfirmed !== "boolean" ||
      !recoveryObligations(task.recoveryObligations) ||
      typeof task.recoveryUnresolved !== "boolean" ||
      (task.state === "recovery_required" &&
        task.recoveryObligations.length === 0 &&
        task.recoveryUnresolved !== true) ||
      (task.state !== "recovery_required" &&
        task.recoveryUnresolved === true) ||
      (task.state === "ready" &&
        task.recoveryObligations.some(
          (entry) =>
            entry.phase !==
            (entry.kind === "docker" ? "acknowledged" : "settled"),
        )) ||
      (!["ready", "recovery_required"].includes(String(task.state)) &&
        task.recoveryObligations.length > 0) ||
      !validTaskLifecycleTuple(
        task as unknown as ProjectRuntimeState["tasks"][number],
      ) ||
      !nullableCandidateId(task.candidateId) ||
      !Number.isSafeInteger(task.retryCount) ||
      Number(task.retryCount) < 0 ||
      !nullableId(task.supersededBy)
    )
      return false;
    taskIds.add(task.definition.id);
    dependencies.push(taskDependencies as readonly string[]);
  }
  return dependencies.every((items) => items.every((id) => taskIds.has(id)));
}

/**
 * validQueueEntryの処理を実行する。
 *
 * @responsibility validQueueEntryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is ProjectQueueEntryを返す。
 * @precondition 「value: unknown」がvalidQueueEntryの入力契約を満たす。
 * @postcondition validQueueEntryの責務を完了した結果だけを返す。
 * @effect N/A: validQueueEntryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validQueueEntryは独自の失敗分岐を所有しない。
 * @invariant validQueueEntryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validQueueEntryはProcess内の同一Subsystemで完結する。
 * @security validQueueEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validQueueEntryは共有非同期状態を持たない同期処理である。
 */
function validQueueEntry(value: unknown): value is ProjectQueueEntry {
  return (
    plainObject(value) &&
    exactKeys(value, [
      "queueId",
      "projectId",
      "milestoneId",
      "requestHash",
      "originLane",
      "repositoryRevision",
      "scopeHash",
      "state",
      "generation",
      "ownerGeneration",
      "resumeCondition",
      "resultReference",
    ]) &&
    validId(value.queueId) &&
    validId(value.projectId) &&
    validId(value.milestoneId) &&
    typeof value.requestHash === "string" &&
    HASH.test(value.requestHash) &&
    (value.originLane === "interactive" || value.originLane === "scheduled") &&
    typeof value.repositoryRevision === "string" &&
    REVISION.test(value.repositoryRevision) &&
    typeof value.scopeHash === "string" &&
    HASH.test(value.scopeHash) &&
    PROJECT_QUEUE_STATES.has(value.state as ProjectQueueState) &&
    Number.isSafeInteger(value.generation) &&
    Number(value.generation) >= 1 &&
    nullableId(value.ownerGeneration) &&
    nullableId(value.resumeCondition) &&
    nullableResultReference(value.resultReference)
  );
}

/**
 * validLeaseEvidenceの処理を実行する。
 *
 * @responsibility validLeaseEvidenceに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns validLeaseEvidenceの計算結果を返す。
 * @precondition 「value: unknown」がvalidLeaseEvidenceの入力契約を満たす。
 * @postcondition validLeaseEvidenceの責務を完了した結果だけを返す。
 * @effect N/A: validLeaseEvidenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validLeaseEvidenceは独自の失敗分岐を所有しない。
 * @invariant validLeaseEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validLeaseEvidenceはProcess内の同一Subsystemで完結する。
 * @security validLeaseEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validLeaseEvidenceは共有非同期状態を持たない同期処理である。
 */
function validLeaseEvidence(value: unknown) {
  return (
    plainObject(value) &&
    exactKeys(value, [
      "kind",
      "queueId",
      "ownerGeneration",
      "ownerProcessId",
      "disposition",
    ]) &&
    (value.kind === "project-operation" ||
      value.kind === "canonical-adoption") &&
    validId(value.queueId) &&
    validId(value.ownerGeneration) &&
    Number.isSafeInteger(value.ownerProcessId) &&
    Number(value.ownerProcessId) > 0 &&
    (value.disposition === "acquired" ||
      value.disposition === "released" ||
      value.disposition === "recovered_after_owner_loss")
  );
}

/**
 * completedの処理を実行する。
 *
 * @responsibility completedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input reason: string、value: T
 * @returns StoreResult<T>を返す。
 * @precondition 「reason: string、value: T」がcompletedの入力契約を満たす。
 * @postcondition completedの責務を完了した結果だけを返す。
 * @effect N/A: completedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: completedは独自の失敗分岐を所有しない。
 * @invariant completedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: completedはProcess内の同一Subsystemで完結する。
 * @security completedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: completedは共有非同期状態を持たない同期処理である。
 */
function completed<T>(reason: string, value: T): StoreResult<T> {
  return Object.freeze({ status: "completed", reason, value });
}

/**
 * blockedの処理を実行する。
 *
 * @responsibility blockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input reason: string、manualRecoveryRequired、recoveryId: string | null
 * @returns StoreResult<T>を返す。
 * @precondition 「reason: string、manualRecoveryRequired、recoveryId: string | null」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked<T>(
  reason: string,
  manualRecoveryRequired = false,
  recoveryId: string | null = null,
): StoreResult<T> {
  return Object.freeze({
    status: "blocked",
    reason,
    value: null,
    manualRecoveryRequired,
    recoveryId,
  });
}

/**
 * LeaseAcquisitionMarkerが扱う値の構造を表す。
 *
 * @responsibility LeaseAcquisitionMarkerに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape LeaseAcquisitionMarkerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseAcquisitionMarkerで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseAcquisitionMarkerの宣言は外部境界を開かない。
 * @security LeaseAcquisitionMarkerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseAcquisitionMarkerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LeaseAcquisitionMarker = Readonly<{
  kind: LeaseKind;
  queueId: string;
  ownerGeneration: string;
  ownerProcessId: number;
  recoveryId: string;
}>;

/**
 * leaseAcquisitionRecoveryIdの処理を実行する。
 *
 * @responsibility leaseAcquisitionRecoveryIdに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind
 * @returns leaseAcquisitionRecoveryIdの計算結果を返す。
 * @precondition 「repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind」がleaseAcquisitionRecoveryIdの入力契約を満たす。
 * @postcondition leaseAcquisitionRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseAcquisitionRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant leaseAcquisitionRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionRecoveryIdは共有非同期状態を持たない同期処理である。
 */
function leaseAcquisitionRecoveryId(
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
) {
  const identityInput =
    kind === "project-operation"
      ? `${repositoryBindingId}\0${kind}`
      : kind === "canonical-adoption"
        ? `${repositoryBindingId}\0${projectId}\0${kind}`
        : `${repositoryBindingId}\0${projectId}\0${queueId}\0${kind}`;
  return `lease-acquisition-${digest(identityInput).slice(0, 40)}`;
}

/**
 * leaseIdentityの処理を実行する。
 *
 * @responsibility leaseIdentityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind
 * @returns leaseIdentityの計算結果を返す。
 * @precondition 「repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind」がleaseIdentityの入力契約を満たす。
 * @postcondition leaseIdentityの責務を完了した結果だけを返す。
 * @effect N/A: leaseIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseIdentityは独自の失敗分岐を所有しない。
 * @invariant leaseIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseIdentityはProcess内の同一Subsystemで完結する。
 * @security leaseIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseIdentityは共有非同期状態を持たない同期処理である。
 */
function leaseIdentity(
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
) {
  return kind === "project-operation"
    ? `${kind}-${repositoryBindingId}`
    : kind === "canonical-adoption"
      ? `${kind}-${repositoryBindingId}-${projectId}`
      : `${kind}-${projectId}-${queueId}`;
}

/**
 * leaseAcquisitionTemporaryPrefixの処理を実行する。
 *
 * @responsibility leaseAcquisitionTemporaryPrefixに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input identity: string
 * @returns leaseAcquisitionTemporaryPrefixの計算結果を返す。
 * @precondition 「identity: string」がleaseAcquisitionTemporaryPrefixの入力契約を満たす。
 * @postcondition leaseAcquisitionTemporaryPrefixの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionTemporaryPrefixは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseAcquisitionTemporaryPrefixは独自の失敗分岐を所有しない。
 * @invariant leaseAcquisitionTemporaryPrefixは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionTemporaryPrefixはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionTemporaryPrefixはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionTemporaryPrefixは共有非同期状態を持たない同期処理である。
 */
function leaseAcquisitionTemporaryPrefix(identity: string) {
  return `.pending-${identity}-acquisition-`;
}

/**
 * leaseAcquisitionTemporaryFilesの処理を実行する。
 *
 * @responsibility leaseAcquisitionTemporaryFilesに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input directory: string、identity: string
 * @returns leaseAcquisitionTemporaryFilesの計算結果を返す。
 * @precondition 「directory: string、identity: string」がleaseAcquisitionTemporaryFilesの入力契約を満たす。
 * @postcondition leaseAcquisitionTemporaryFilesの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionTemporaryFilesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure leaseAcquisitionTemporaryFilesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant leaseAcquisitionTemporaryFilesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionTemporaryFilesはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionTemporaryFilesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionTemporaryFilesは共有非同期状態を持たない同期処理である。
 */
function leaseAcquisitionTemporaryFiles(directory: string, identity: string) {
  assertDirectory(directory);
  const prefix = leaseAcquisitionTemporaryPrefix(identity);
  const names = fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(prefix));
  if (names.some((name) => !name.endsWith(".tmp")))
    throw new Error("project_runtime_lease_acquisition_inventory_invalid");
  return Object.freeze(names);
}

/**
 * pathConfirmedAbsentの処理を実行する。
 *
 * @responsibility pathConfirmedAbsentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input candidate: string
 * @returns pathConfirmedAbsentの計算結果を返す。
 * @precondition 「candidate: string」がpathConfirmedAbsentの入力契約を満たす。
 * @postcondition pathConfirmedAbsentの責務を完了した結果だけを返す。
 * @effect pathConfirmedAbsentはFilesystemの読取りまたは書込みを実行する。
 * @failure pathConfirmedAbsentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant pathConfirmedAbsentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security pathConfirmedAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: pathConfirmedAbsentは共有非同期状態を持たない同期処理である。
 */
function pathConfirmedAbsent(candidate: string) {
  try {
    fs.lstatSync(candidate);
    return false;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return true;
    throw error;
  }
}

/**
 * leaseAcquisitionFootprintAbsentの処理を実行する。
 *
 * @responsibility leaseAcquisitionFootprintAbsentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input directory: string、identity: string、paths: readonly string[]
 * @returns leaseAcquisitionFootprintAbsentの計算結果を返す。
 * @precondition 「directory: string、identity: string、paths: readonly string[]」がleaseAcquisitionFootprintAbsentの入力契約を満たす。
 * @postcondition leaseAcquisitionFootprintAbsentの責務を完了した結果だけを返す。
 * @effect N/A: leaseAcquisitionFootprintAbsentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseAcquisitionFootprintAbsentは独自の失敗分岐を所有しない。
 * @invariant leaseAcquisitionFootprintAbsentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseAcquisitionFootprintAbsentはProcess内の同一Subsystemで完結する。
 * @security leaseAcquisitionFootprintAbsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseAcquisitionFootprintAbsentは共有非同期状態を持たない同期処理である。
 */
function leaseAcquisitionFootprintAbsent(
  directory: string,
  identity: string,
  paths: readonly string[],
) {
  return (
    paths.every(pathConfirmedAbsent) &&
    leaseAcquisitionTemporaryFiles(directory, identity).length === 0
  );
}

/**
 * readLeaseAcquisitionMarkerの処理を実行する。
 *
 * @responsibility readLeaseAcquisitionMarkerに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input marker: string
 * @returns LeaseAcquisitionMarkerを返す。
 * @precondition 「marker: string」がreadLeaseAcquisitionMarkerの入力契約を満たす。
 * @postcondition readLeaseAcquisitionMarkerの責務を完了した結果だけを返す。
 * @effect readLeaseAcquisitionMarkerはFilesystemの読取りまたは書込みを実行する。
 * @failure readLeaseAcquisitionMarkerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readLeaseAcquisitionMarkerは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readLeaseAcquisitionMarkerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readLeaseAcquisitionMarkerは共有非同期状態を持たない同期処理である。
 */
function readLeaseAcquisitionMarker(marker: string): LeaseAcquisitionMarker {
  const parsed: unknown = JSON.parse(fs.readFileSync(marker, "utf8"));
  if (
    !plainObject(parsed) ||
    !exactKeys(parsed, [
      "kind",
      "queueId",
      "ownerGeneration",
      "ownerProcessId",
      "recoveryId",
    ]) ||
    (parsed.kind !== "project-operation" &&
      parsed.kind !== "canonical-adoption") ||
    !validId(parsed.queueId) ||
    !validId(parsed.ownerGeneration) ||
    !Number.isSafeInteger(parsed.ownerProcessId) ||
    Number(parsed.ownerProcessId) < 1 ||
    !validId(parsed.recoveryId)
  )
    throw new Error("project_runtime_lease_acquisition_marker_invalid");
  return Object.freeze({
    kind: parsed.kind,
    queueId: parsed.queueId,
    ownerGeneration: parsed.ownerGeneration,
    ownerProcessId: Number(parsed.ownerProcessId),
    recoveryId: parsed.recoveryId,
  });
}

/**
 * createLeaseAcquisitionMarkerの処理を実行する。
 *
 * @responsibility createLeaseAcquisitionMarkerに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input directory: string、identity: string、value: LeaseAcquisitionMarker
 * @returns N/A: createLeaseAcquisitionMarkerは戻り値を返さない。
 * @precondition 「directory: string、identity: string、value: LeaseAcquisitionMarker」がcreateLeaseAcquisitionMarkerの入力契約を満たす。
 * @postcondition createLeaseAcquisitionMarkerの責務を完了して呼出し元へ制御を戻す。
 * @effect createLeaseAcquisitionMarkerはFilesystemの読取りまたは書込みを実行する。
 * @failure createLeaseAcquisitionMarkerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createLeaseAcquisitionMarkerは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createLeaseAcquisitionMarkerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createLeaseAcquisitionMarkerは共有非同期状態を持たない同期処理である。
 */
function createLeaseAcquisitionMarker(
  directory: string,
  identity: string,
  value: LeaseAcquisitionMarker,
) {
  const marker = path.join(directory, `${identity}.acquire-pending`);
  const temporary = path.join(
    directory,
    `${leaseAcquisitionTemporaryPrefix(identity)}${process.pid}-${value.ownerGeneration}-${randomUUID()}.tmp`,
  );
  const bytes = `${JSON.stringify(value)}\n`;
  let descriptor: number | null = null;
  let isPublished = false;
  try {
    descriptor = fs.openSync(
      temporary,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      0o600,
    );
    fs.writeFileSync(descriptor, bytes, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    if (fs.readFileSync(temporary, "utf8") !== bytes)
      throw new Error("project_runtime_lease_acquisition_marker_mismatch");
    const prepared = readLeaseAcquisitionMarker(temporary);
    if (
      prepared.kind !== value.kind ||
      prepared.queueId !== value.queueId ||
      prepared.ownerGeneration !== value.ownerGeneration ||
      prepared.ownerProcessId !== value.ownerProcessId ||
      prepared.recoveryId !== value.recoveryId
    )
      throw new Error("project_runtime_lease_acquisition_marker_mismatch");
    try {
      fs.linkSync(temporary, marker);
    } catch (error) {
      if (errorCode(error) === "EEXIST" || fs.existsSync(marker)) {
        const contention = new Error("project_runtime_lease_unavailable");
        Object.defineProperty(contention, "code", { value: "EEXIST" });
        throw contention;
      }
      throw error;
    }
    isPublished = true;
    if (fs.readFileSync(marker, "utf8") !== bytes)
      throw new Error("project_runtime_lease_acquisition_marker_mismatch");
  } catch (error) {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (!isPublished) {
      try {
        fs.rmSync(temporary, { force: true });
      } catch {}
    }
    throw error;
  }
  fs.rmSync(temporary);
  if (fs.existsSync(temporary))
    throw new Error(
      "project_runtime_lease_acquisition_temporary_release_unknown",
    );
  const observed = readLeaseAcquisitionMarker(marker);
  if (
    observed.kind !== value.kind ||
    observed.queueId !== value.queueId ||
    observed.ownerGeneration !== value.ownerGeneration ||
    observed.ownerProcessId !== value.ownerProcessId ||
    observed.recoveryId !== value.recoveryId
  )
    throw new Error("project_runtime_lease_acquisition_marker_mismatch");
}

/**
 * createLeaseLockOwnershipMarkerの処理を実行する。
 *
 * @responsibility createLeaseLockOwnershipMarkerに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input marker: string、value: LeaseAcquisitionMarker
 * @returns N/A: createLeaseLockOwnershipMarkerは戻り値を返さない。
 * @precondition 「marker: string、value: LeaseAcquisitionMarker」がcreateLeaseLockOwnershipMarkerの入力契約を満たす。
 * @postcondition createLeaseLockOwnershipMarkerの責務を完了して呼出し元へ制御を戻す。
 * @effect createLeaseLockOwnershipMarkerはFilesystemの読取りまたは書込みを実行する。
 * @failure createLeaseLockOwnershipMarkerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createLeaseLockOwnershipMarkerは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createLeaseLockOwnershipMarkerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createLeaseLockOwnershipMarkerは共有非同期状態を持たない同期処理である。
 */
function createLeaseLockOwnershipMarker(
  marker: string,
  value: LeaseAcquisitionMarker,
) {
  const descriptor = fs.openSync(
    marker,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
    0o600,
  );
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  const observed = readLeaseAcquisitionMarker(marker);
  if (
    observed.kind !== value.kind ||
    observed.queueId !== value.queueId ||
    observed.ownerGeneration !== value.ownerGeneration ||
    observed.ownerProcessId !== value.ownerProcessId ||
    observed.recoveryId !== value.recoveryId
  )
    throw new Error("project_runtime_lease_lock_ownership_marker_mismatch");
}

/**
 * digestの処理を実行する。
 *
 * @responsibility digestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: string
 * @returns digestの計算結果を返す。
 * @precondition 「value: string」がdigestの入力契約を満たす。
 * @postcondition digestの責務を完了した結果だけを返す。
 * @effect N/A: digestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: digestは独自の失敗分岐を所有しない。
 * @invariant digestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: digestはProcess内の同一Subsystemで完結する。
 * @security digestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: digestは共有非同期状態を持たない同期処理である。
 */
function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * validIdの処理を実行する。
 *
 * @responsibility validIdに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidIdの入力契約を満たす。
 * @postcondition validIdの責務を完了した結果だけを返す。
 * @effect N/A: validIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdは独自の失敗分岐を所有しない。
 * @invariant validIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdはProcess内の同一Subsystemで完結する。
 * @security validIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validIdは共有非同期状態を持たない同期処理である。
 */
function validId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

/**
 * assertDirectoryの処理を実行する。
 *
 * @responsibility assertDirectoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input directory: string
 * @returns N/A: assertDirectoryは戻り値を返さない。
 * @precondition 「directory: string」がassertDirectoryの入力契約を満たす。
 * @postcondition assertDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect assertDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure assertDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant assertDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security assertDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: assertDirectoryは共有非同期状態を持たない同期処理である。
 */
function assertDirectory(directory: string) {
  const metadata = fs.lstatSync(directory);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(directory) !== directory
  ) {
    throw new Error("project_runtime_storage_boundary_invalid");
  }
}

/**
 * ensureDirectoryの処理を実行する。
 *
 * @responsibility ensureDirectoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input parent: string、name: string
 * @returns ensureDirectoryの計算結果を返す。
 * @precondition 「parent: string、name: string」がensureDirectoryの入力契約を満たす。
 * @postcondition ensureDirectoryの責務を完了した結果だけを返す。
 * @effect ensureDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure ensureDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security ensureDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ensureDirectoryは共有非同期状態を持たない同期処理である。
 */
function ensureDirectory(parent: string, name: string) {
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(name) || name === "." || name === "..")
    throw new Error("project_runtime_storage_identity_invalid");
  const target = path.join(parent, name);
  try {
    fs.mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if (
      !(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "EEXIST"
      )
    )
      throw error;
  }
  assertDirectory(target);
  if (path.dirname(target) !== parent)
    throw new Error("project_runtime_storage_boundary_invalid");
  return target;
}

/**
 * storageRootの処理を実行する。
 *
 * @responsibility storageRootに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string
 * @returns storageRootの計算結果を返す。
 * @precondition 「workingDirectory: string」がstorageRootの入力契約を満たす。
 * @postcondition storageRootの責務を完了した結果だけを返す。
 * @effect N/A: storageRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: storageRootは独自の失敗分岐を所有しない。
 * @invariant storageRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: storageRootはProcess内の同一Subsystemで完結する。
 * @security storageRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: storageRootは共有非同期状態を持たない同期処理である。
 */
function storageRoot(workingDirectory: string) {
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      workingDirectory,
      "project-runtime",
    ),
    "project_runtime_repository_root_invalid",
  );
  const repositoryRoot = area.repositoryRoot;
  assertDirectory(repositoryRoot);
  const runtime = area.directory;
  assertDirectory(runtime);
  return Object.freeze({ repositoryRoot, runtime });
}

/**
 * lockRootの処理を実行する。
 *
 * @responsibility lockRootに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input runtime: string
 * @returns lockRootの計算結果を返す。
 * @precondition 「runtime: string」がlockRootの入力契約を満たす。
 * @postcondition lockRootの責務を完了した結果だけを返す。
 * @effect N/A: lockRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: lockRootは独自の失敗分岐を所有しない。
 * @invariant lockRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: lockRootはProcess内の同一Subsystemで完結する。
 * @security lockRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: lockRootは共有非同期状態を持たない同期処理である。
 */
function lockRoot(runtime: string) {
  return ensureDirectory(ensureDirectory(runtime, "work"), "locks");
}

/**
 * leaseEvidenceRootの処理を実行する。
 *
 * @responsibility leaseEvidenceRootに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input runtime: string
 * @returns leaseEvidenceRootの計算結果を返す。
 * @precondition 「runtime: string」がleaseEvidenceRootの入力契約を満たす。
 * @postcondition leaseEvidenceRootの責務を完了した結果だけを返す。
 * @effect N/A: leaseEvidenceRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: leaseEvidenceRootは独自の失敗分岐を所有しない。
 * @invariant leaseEvidenceRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: leaseEvidenceRootはProcess内の同一Subsystemで完結する。
 * @security leaseEvidenceRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: leaseEvidenceRootは共有非同期状態を持たない同期処理である。
 */
function leaseEvidenceRoot(runtime: string) {
  return ensureDirectory(ensureDirectory(runtime, "recovery"), "leases");
}

/**
 * activeLeaseIsObservedの処理を実行する。
 *
 * @responsibility activeLeaseIsObservedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input activeLease: ActiveLease
 * @returns activeLeaseIsObservedの計算結果を返す。
 * @precondition 「activeLease: ActiveLease」がactiveLeaseIsObservedの入力契約を満たす。
 * @postcondition activeLeaseIsObservedの責務を完了した結果だけを返す。
 * @effect activeLeaseIsObservedはFilesystemの読取りまたは書込みを実行する。
 * @failure activeLeaseIsObservedは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant activeLeaseIsObservedは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security activeLeaseIsObservedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: activeLeaseIsObservedは共有非同期状態を持たない同期処理である。
 */
function activeLeaseIsObserved(activeLease: ActiveLease) {
  try {
    assertDirectory(activeLease.lock);
    return !fs.existsSync(activeLease.recoveryMarker);
  } catch {
    return false;
  }
}

/**
 * envelopeの処理を実行する。
 *
 * @responsibility envelopeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input recordKind: Envelope["recordKind"]、repositoryBindingId: string、projectId: string、createdGeneration: number、updatedGeneration: number、content: unknown
 * @returns Envelopeを返す。
 * @precondition 「recordKind: Envelope["recordKind"]、repositoryBindingId: string、projectId: string、createdGeneration: number、updatedGeneration: number、content: unknown」がenvelopeの入力契約を満たす。
 * @postcondition envelopeの責務を完了した結果だけを返す。
 * @effect N/A: envelopeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure envelopeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant envelopeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: envelopeはProcess内の同一Subsystemで完結する。
 * @security envelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: envelopeは共有非同期状態を持たない同期処理である。
 */
function envelope(
  recordKind: Envelope["recordKind"],
  repositoryBindingId: string,
  projectId: string,
  createdGeneration: number,
  updatedGeneration: number,
  content: unknown,
): Envelope {
  if (
    (recordKind === "project-state" && !validProjectRuntimeState(content)) ||
    (recordKind === "queue-entry" && !validQueueEntry(content)) ||
    (recordKind === "lease-evidence" && !validLeaseEvidence(content))
  )
    throw new Error("project_runtime_record_content_invalid");
  const serialized = JSON.stringify(content);
  const record = Object.freeze({
    schema: PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT,
    schemaRevision: 1 as const,
    recordKind,
    repositoryBindingId,
    projectId,
    createdGeneration,
    updatedGeneration,
    contentHash: digest(serialized),
    content,
  });
  return record;
}

/**
 * storageBytesの処理を実行する。
 *
 * @responsibility storageBytesに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: Envelope
 * @returns storageBytesの計算結果を返す。
 * @precondition 「value: Envelope」がstorageBytesの入力契約を満たす。
 * @postcondition storageBytesの責務を完了した結果だけを返す。
 * @effect N/A: storageBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure storageBytesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant storageBytesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: storageBytesはProcess内の同一Subsystemで完結する。
 * @security storageBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: storageBytesは共有非同期状態を持たない同期処理である。
 */
function storageBytes(value: Envelope) {
  const bytes = `${JSON.stringify(value)}\n`;
  if (Buffer.byteLength(bytes, "utf8") > MAX_RECORD_BYTES)
    throw new Error("project_runtime_record_too_large");
  return bytes;
}

/**
 * atomicCreateAndReadBackの処理を実行する。
 *
 * @responsibility atomicCreateAndReadBackに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input directory: string、name: string、value: Envelope
 * @returns N/A: atomicCreateAndReadBackは戻り値を返さない。
 * @precondition 「directory: string、name: string、value: Envelope」がatomicCreateAndReadBackの入力契約を満たす。
 * @postcondition atomicCreateAndReadBackの責務を完了して呼出し元へ制御を戻す。
 * @effect atomicCreateAndReadBackはFilesystemの読取りまたは書込みを実行する。
 * @failure atomicCreateAndReadBackは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant atomicCreateAndReadBackは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security atomicCreateAndReadBackはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: atomicCreateAndReadBackは共有非同期状態を持たない同期処理である。
 */
function atomicCreateAndReadBack(
  directory: string,
  name: string,
  value: Envelope,
) {
  const destination = path.join(directory, name);
  const temporary = path.join(directory, `.pending-${randomUUID()}.tmp`);
  const bytes = storageBytes(value);
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(
      temporary,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      0o600,
    );
    fs.writeFileSync(descriptor, bytes, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporary, destination);
    const observed = fs.readFileSync(destination, "utf8");
    if (observed !== bytes)
      throw new Error("project_runtime_record_readback_mismatch");
  } catch (error) {
    if (descriptor !== null) fs.closeSync(descriptor);
    try {
      fs.rmSync(temporary, { force: true });
    } catch {}
    throw error;
  }
}

/**
 * readEnvelopeFileの処理を実行する。
 *
 * @responsibility readEnvelopeFileに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input directory: string、name: string
 * @returns Envelopeを返す。
 * @precondition 「directory: string、name: string」がreadEnvelopeFileの入力契約を満たす。
 * @postcondition readEnvelopeFileの責務を完了した結果だけを返す。
 * @effect readEnvelopeFileはFilesystemの読取りまたは書込みを実行する。
 * @failure readEnvelopeFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readEnvelopeFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readEnvelopeFileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readEnvelopeFileは共有非同期状態を持たない同期処理である。
 */
function readEnvelopeFile(directory: string, name: string): Envelope {
  const location = path.join(directory, name);
  const metadata = fs.lstatSync(location);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size > MAX_RECORD_BYTES
  )
    throw new Error("project_runtime_record_invalid");
  const candidate: unknown = JSON.parse(fs.readFileSync(location, "utf8"));
  if (
    !plainObject(candidate) ||
    !exactKeys(candidate, [
      "schema",
      "schemaRevision",
      "recordKind",
      "repositoryBindingId",
      "projectId",
      "createdGeneration",
      "updatedGeneration",
      "contentHash",
      "content",
    ]) ||
    !["project-state", "queue-entry", "lease-evidence"].includes(
      String(candidate.recordKind),
    )
  )
    throw new Error("project_runtime_record_envelope_invalid");
  const parsed = candidate as unknown as Envelope;
  if (
    parsed.schema !== PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT ||
    parsed.schemaRevision !== 1 ||
    !validId(parsed.repositoryBindingId) ||
    !validId(parsed.projectId) ||
    !Number.isSafeInteger(parsed.createdGeneration) ||
    !Number.isSafeInteger(parsed.updatedGeneration) ||
    parsed.createdGeneration < 1 ||
    parsed.updatedGeneration < parsed.createdGeneration ||
    parsed.contentHash !== digest(JSON.stringify(parsed.content))
  )
    throw new Error("project_runtime_record_invalid");
  if (
    (parsed.recordKind === "project-state" &&
      !validProjectRuntimeState(parsed.content)) ||
    (parsed.recordKind === "queue-entry" && !validQueueEntry(parsed.content)) ||
    (parsed.recordKind === "lease-evidence" &&
      !validLeaseEvidence(parsed.content))
  )
    throw new Error("project_runtime_record_content_invalid");
  if (
    (parsed.recordKind === "project-state" ||
      parsed.recordKind === "queue-entry") &&
    (parsed.content as { generation: number }).generation !==
      parsed.updatedGeneration
  )
    throw new Error("project_runtime_record_generation_mismatch");
  return parsed;
}

/**
 * readEnvelopesの処理を実行する。
 *
 * @responsibility readEnvelopesに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input directory: string、prefix: string
 * @returns readonly Envelope[]を返す。
 * @precondition 「directory: string、prefix: string」がreadEnvelopesの入力契約を満たす。
 * @postcondition readEnvelopesの責務を完了した結果だけを返す。
 * @effect readEnvelopesはFilesystemの読取りまたは書込みを実行する。
 * @failure readEnvelopesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readEnvelopesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readEnvelopesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readEnvelopesは共有非同期状態を持たない同期処理である。
 */
function readEnvelopes(directory: string, prefix: string): readonly Envelope[] {
  if (!fs.existsSync(directory)) return Object.freeze([]);
  assertDirectory(directory);
  const names = fs.readdirSync(directory);
  if (names.length > 4096)
    throw new Error("project_runtime_record_inventory_too_large");
  const generationName = /^generation-([1-9][0-9]*)\.json$/u;
  if (
    prefix === "generation-" &&
    names.some((name) => !generationName.test(name))
  )
    throw new Error("project_runtime_record_inventory_invalid");
  const records: Envelope[] = [];
  for (const name of names.filter((candidate) =>
    candidate.startsWith(prefix),
  )) {
    const parsed = readEnvelopeFile(directory, name);
    if (prefix === "generation-") {
      const match = generationName.exec(name);
      if (!match || Number(match[1]) !== parsed.updatedGeneration)
        throw new Error("project_runtime_record_generation_mismatch");
    }
    records.push(parsed);
  }
  if (prefix === "generation-") {
    const generations = records
      .map((record) => record.updatedGeneration)
      .sort((left, right) => left - right);
    if (
      new Set(generations).size !== generations.length ||
      generations.some((generation, index) => generation !== index + 1)
    )
      throw new Error("project_runtime_record_generation_discontinuous");
  }
  return Object.freeze(records);
}

/**
 * LeaseEvidenceContentが扱う値の構造を表す。
 *
 * @responsibility LeaseEvidenceContentに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape LeaseEvidenceContentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseEvidenceContentで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseEvidenceContentの宣言は外部境界を開かない。
 * @security LeaseEvidenceContentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseEvidenceContentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LeaseEvidenceContent = Readonly<{
  kind: LeaseKind;
  queueId: string;
  ownerGeneration: string;
  ownerProcessId: number;
  disposition: "acquired" | "released" | "recovered_after_owner_loss";
}>;

/**
 * LeaseEvidenceEnvelopeが扱う値の構造を表す。
 *
 * @responsibility LeaseEvidenceEnvelopeに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape LeaseEvidenceEnvelopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseEvidenceEnvelopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseEvidenceEnvelopeの宣言は外部境界を開かない。
 * @security LeaseEvidenceEnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseEvidenceEnvelopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LeaseEvidenceEnvelope = Envelope &
  Readonly<{ recordKind: "lease-evidence"; content: LeaseEvidenceContent }>;

/**
 * readExactLeaseEvidenceの処理を実行する。
 *
 * @responsibility readExactLeaseEvidenceに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input directory: string、expected: Readonly<{ repositoryBindingId: string; projectId: string; queueId: string; kind: LeaseKind; identity: string; ownerGeneration: string; }>
 * @returns Readonly<{ acquired: LeaseEvidenceEnvelope; released: LeaseEvidenceEnvelope | null; recovered: LeaseEvidenceEnvelope | null; }>を返す。
 * @precondition 「directory: string、expected: Readonly<{ repositoryBindingId: string; projectId: string; queueId: string; kind: LeaseKind; identity: string; ownerGeneration: string; }>」がreadExactLeaseEvidenceの入力契約を満たす。
 * @postcondition readExactLeaseEvidenceの責務を完了した結果だけを返す。
 * @effect readExactLeaseEvidenceはFilesystemの読取りまたは書込みを実行する。
 * @failure readExactLeaseEvidenceは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readExactLeaseEvidenceは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readExactLeaseEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readExactLeaseEvidenceは共有非同期状態を持たない同期処理である。
 */
function readExactLeaseEvidence(
  directory: string,
  expected: Readonly<{
    repositoryBindingId: string;
    projectId: string;
    queueId: string;
    kind: LeaseKind;
    identity: string;
    ownerGeneration: string;
  }>,
): Readonly<{
  acquired: LeaseEvidenceEnvelope;
  released: LeaseEvidenceEnvelope | null;
  recovered: LeaseEvidenceEnvelope | null;
}> {
  assertDirectory(directory);
  const base = `${expected.identity}-${expected.ownerGeneration}`;
  const exactNames: Readonly<
    Record<"acquired" | "released" | "recovered", string>
  > = Object.freeze({
    acquired: `${base}.json`,
    released: `${base}-released.json`,
    recovered: `${base}-recovered.json`,
  });
  const allowed = new Set(Object.values(exactNames));
  const inventoryEntries = fs.readdirSync(directory);
  if (
    inventoryEntries.length > 4096 ||
    inventoryEntries.some((name) => name.startsWith(base) && !allowed.has(name))
  )
    throw new Error("project_runtime_lease_evidence_inventory_mismatch");

  const read = (
    name: string,
    disposition: LeaseEvidenceContent["disposition"],
    isRequired: boolean,
  ): LeaseEvidenceEnvelope | null => {
    if (!fs.existsSync(path.join(directory, name))) {
      if (isRequired) throw new Error("project_runtime_lease_evidence_missing");
      return null;
    }
    const record = readEnvelopeFile(directory, name);
    if (
      record.recordKind !== "lease-evidence" ||
      record.repositoryBindingId !== expected.repositoryBindingId ||
      record.projectId !== expected.projectId ||
      record.createdGeneration !== 1 ||
      record.updatedGeneration !== (disposition === "acquired" ? 1 : 2) ||
      !validLeaseEvidence(record.content)
    )
      throw new Error("project_runtime_lease_evidence_mismatch");
    const content = record.content as LeaseEvidenceContent;
    if (
      content.kind !== expected.kind ||
      content.queueId !== expected.queueId ||
      content.ownerGeneration !== expected.ownerGeneration ||
      content.disposition !== disposition
    )
      throw new Error("project_runtime_lease_evidence_mismatch");
    return record as LeaseEvidenceEnvelope;
  };

  const acquired = read(exactNames.acquired, "acquired", true);
  if (!acquired) throw new Error("project_runtime_lease_evidence_missing");
  const released = read(exactNames.released, "released", false);
  const recovered = read(
    exactNames.recovered,
    "recovered_after_owner_loss",
    false,
  );
  if (released && recovered)
    throw new Error("project_runtime_lease_evidence_disposition_conflict");
  for (const record of [released, recovered]) {
    if (
      record &&
      record.content.ownerProcessId !== acquired.content.ownerProcessId
    )
      throw new Error("project_runtime_lease_evidence_owner_mismatch");
  }
  return Object.freeze({ acquired, released, recovered });
}

/**
 * QueueEnvelopeが扱う値の構造を表す。
 *
 * @responsibility QueueEnvelopeに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape QueueEnvelopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant QueueEnvelopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: QueueEnvelopeの宣言は外部境界を開かない。
 * @security QueueEnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility QueueEnvelopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type QueueEnvelope = Envelope & Readonly<{ content: ProjectQueueEntry }>;

/**
 * validatedQueueHistoryの処理を実行する。
 *
 * @responsibility validatedQueueHistoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input records: readonly Envelope[]、repositoryBindingId: string、queueId: string、expectedProjectId: string
 * @returns readonly QueueEnvelope[] | nullを返す。
 * @precondition 「records: readonly Envelope[]、repositoryBindingId: string、queueId: string、expectedProjectId: string」がvalidatedQueueHistoryの入力契約を満たす。
 * @postcondition validatedQueueHistoryの責務を完了した結果だけを返す。
 * @effect N/A: validatedQueueHistoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validatedQueueHistoryは独自の失敗分岐を所有しない。
 * @invariant validatedQueueHistoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validatedQueueHistoryはProcess内の同一Subsystemで完結する。
 * @security validatedQueueHistoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validatedQueueHistoryは共有非同期状態を持たない同期処理である。
 */
function validatedQueueHistory(
  records: readonly Envelope[],
  repositoryBindingId: string,
  queueId: string,
  expectedProjectId?: string,
): readonly QueueEnvelope[] | null {
  const orderedItems = [...records].sort(
    (left, right) => left.updatedGeneration - right.updatedGeneration,
  );
  let projectId = expectedProjectId ?? null;
  const resultItems: QueueEnvelope[] = [];
  for (const record of orderedItems) {
    const content = record.content;
    if (
      record.recordKind !== "queue-entry" ||
      record.repositoryBindingId !== repositoryBindingId ||
      !validQueueEntry(content) ||
      content.queueId !== queueId ||
      content.generation !== record.updatedGeneration ||
      record.projectId !== content.projectId ||
      (projectId !== null && content.projectId !== projectId)
    )
      return null;
    projectId = content.projectId;
    resultItems.push(record as QueueEnvelope);
  }
  return Object.freeze(resultItems);
}

/**
 * withMutationLockの処理を実行する。
 *
 * @responsibility withMutationLockに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input runtime: string、identity: string、operation: () => StoreResult<T>
 * @returns withMutationLockの計算結果を返す。
 * @precondition 「runtime: string、identity: string、operation: () => StoreResult<T>」がwithMutationLockの入力契約を満たす。
 * @postcondition withMutationLockの責務を完了した結果だけを返す。
 * @effect withMutationLockはFilesystemの読取りまたは書込みを実行する。
 * @failure withMutationLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant withMutationLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security withMutationLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: withMutationLockは共有非同期状態を持たない同期処理である。
 */
function withMutationLock<T>(
  runtime: string,
  identity: string,
  operation: () => StoreResult<T>,
) {
  const locks = lockRoot(runtime);
  const lock = path.join(locks, `${identity}.lock`);
  try {
    fs.mkdirSync(lock, { mode: 0o700 });
  } catch (error) {
    return errorCode(error) === "EEXIST"
      ? blocked<T>("project_runtime_lock_unavailable")
      : blocked<T>("project_runtime_mutation_observation_unknown", true);
  }
  let result: StoreResult<T>;
  try {
    assertDirectory(lock);
    result = operation();
  } catch {
    result = blocked<T>("project_runtime_mutation_observation_unknown", true);
  }
  try {
    fs.rmdirSync(lock);
    if (fs.existsSync(lock))
      return blocked<T>("project_runtime_mutation_lock_release_unknown", true);
  } catch {
    return blocked<T>("project_runtime_mutation_lock_release_unknown", true);
  }
  return result;
}

/**
 * writeProjectRuntimeStateの処理を実行する。
 *
 * @responsibility writeProjectRuntimeStateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、state: ProjectRuntimeState、expectedGeneration: number
 * @returns StoreResult<ProjectRuntimeState>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、state: ProjectRuntimeState、expectedGeneration: number」がwriteProjectRuntimeStateの入力契約を満たす。
 * @postcondition writeProjectRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: writeProjectRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure writeProjectRuntimeStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeProjectRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeProjectRuntimeStateはProcess内の同一Subsystemで完結する。
 * @security writeProjectRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeProjectRuntimeStateは共有非同期状態を持たない同期処理である。
 */
export function writeProjectRuntimeState(
  workingDirectory: string,
  repositoryBindingId: string,
  state: ProjectRuntimeState,
  expectedGeneration: number,
): StoreResult<ProjectRuntimeState> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validProjectRuntimeState(state) ||
      state.generation !== expectedGeneration + 1
    )
      return blocked("project_runtime_state_generation_mismatch");
    const { runtime } = storageRoot(workingDirectory);
    const states = ensureDirectory(runtime, "state");
    const project = ensureDirectory(states, state.projectId);
    return withMutationLock(runtime, `state-${state.projectId}`, () => {
      const existingItems = readEnvelopes(project, "generation-");
      const latest = existingItems.reduce(
        (maximum, item) => Math.max(maximum, item.updatedGeneration),
        0,
      );
      if (latest !== expectedGeneration)
        return blocked("project_runtime_state_generation_conflict");
      const record = envelope(
        "project-state",
        repositoryBindingId,
        state.projectId,
        1,
        state.generation,
        state,
      );
      atomicCreateAndReadBack(
        project,
        `generation-${state.generation}.json`,
        record,
      );
      return completed("project_runtime_state_durable", state);
    });
  } catch {
    return blocked("project_runtime_state_observation_unknown", true);
  }
}

/**
 * readProjectRuntimeStateの処理を実行する。
 *
 * @responsibility readProjectRuntimeStateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、projectId: string
 * @returns StoreResult<ProjectRuntimeState | null>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、projectId: string」がreadProjectRuntimeStateの入力契約を満たす。
 * @postcondition readProjectRuntimeStateの責務を完了した結果だけを返す。
 * @effect N/A: readProjectRuntimeStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readProjectRuntimeStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readProjectRuntimeStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readProjectRuntimeStateはProcess内の同一Subsystemで完結する。
 * @security readProjectRuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readProjectRuntimeStateは共有非同期状態を持たない同期処理である。
 */
export function readProjectRuntimeState(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
): StoreResult<ProjectRuntimeState | null> {
  try {
    if (!validId(repositoryBindingId) || !validId(projectId))
      return blocked("project_runtime_state_identity_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const project = path.join(runtime, "state", projectId);
    const records = readEnvelopes(project, "generation-");
    if (records.length === 0)
      return completed("project_runtime_state_absent", null);
    if (
      records.some(
        (record) =>
          record.recordKind !== "project-state" ||
          record.repositoryBindingId !== repositoryBindingId ||
          record.projectId !== projectId,
      )
    )
      return blocked("project_runtime_state_record_mismatch", true);
    const orderedRecords = [...records].sort(
      (left, right) => left.updatedGeneration - right.updatedGeneration,
    );
    const latest = orderedRecords.at(-1);
    if (!latest)
      return blocked("project_runtime_state_observation_unknown", true);
    const state = latest.content;
    if (
      !validProjectRuntimeState(state) ||
      state.projectId !== projectId ||
      state.generation !== latest.updatedGeneration
    )
      return blocked("project_runtime_state_record_mismatch", true);
    return completed("project_runtime_state_observed", state);
  } catch {
    return blocked("project_runtime_state_observation_unknown", true);
  }
}

/**
 * enqueueProjectOperationの処理を実行する。
 *
 * @responsibility enqueueProjectOperationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、input: Omit< ProjectQueueEntry, | "state" | "generation" | "ownerGeneration" | "resumeCondition" | "resultReference" >
 * @returns StoreResult<ProjectQueueEntry>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、input: Omit< ProjectQueueEntry, | "state" | "generation" | "ownerGeneration" | "resumeCondition" | "resultReference" >」がenqueueProjectOperationの入力契約を満たす。
 * @postcondition enqueueProjectOperationの責務を完了した結果だけを返す。
 * @effect N/A: enqueueProjectOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure enqueueProjectOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant enqueueProjectOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: enqueueProjectOperationはProcess内の同一Subsystemで完結する。
 * @security enqueueProjectOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: enqueueProjectOperationは共有非同期状態を持たない同期処理である。
 */
export function enqueueProjectOperation(
  workingDirectory: string,
  repositoryBindingId: string,
  input: Omit<
    ProjectQueueEntry,
    | "state"
    | "generation"
    | "ownerGeneration"
    | "resumeCondition"
    | "resultReference"
  >,
): StoreResult<ProjectQueueEntry> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(input.queueId) ||
      !validId(input.projectId) ||
      !validId(input.milestoneId) ||
      !HASH.test(input.requestHash) ||
      !HASH.test(input.scopeHash) ||
      !REVISION.test(input.repositoryRevision)
    )
      return blocked("project_runtime_queue_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const queue = ensureDirectory(runtime, "queues");
    const entryDirectory = ensureDirectory(queue, input.queueId);
    return withMutationLock(runtime, "queue-mutation", () => {
      const observedItems = readEnvelopes(entryDirectory, "generation-");
      const existingItems = validatedQueueHistory(
        observedItems,
        repositoryBindingId,
        input.queueId,
        input.projectId,
      );
      if (existingItems === null)
        return blocked("project_runtime_queue_record_mismatch", true);
      if (existingItems.length > 0) {
        const currentEnvelope = existingItems.at(-1);
        if (!currentEnvelope)
          return blocked("project_runtime_queue_observation_unknown", true);
        const current = currentEnvelope.content;
        if (
          currentEnvelope.recordKind !== "queue-entry" ||
          !validQueueEntry(current) ||
          current.generation !== currentEnvelope.updatedGeneration ||
          current.queueId !== input.queueId ||
          currentEnvelope.repositoryBindingId !== repositoryBindingId ||
          currentEnvelope.projectId !== input.projectId
        )
          return blocked("project_runtime_queue_record_mismatch", true);
        return current.requestHash === input.requestHash &&
          current.projectId === input.projectId &&
          current.milestoneId === input.milestoneId
          ? completed("project_runtime_queue_request_reused", current)
          : blocked("project_runtime_queue_identity_conflict");
      }
      const value: ProjectQueueEntry = Object.freeze({
        ...input,
        state: "queued",
        generation: 1,
        ownerGeneration: null,
        resumeCondition: null,
        resultReference: null,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        "generation-1.json",
        envelope(
          "queue-entry",
          repositoryBindingId,
          input.projectId,
          1,
          1,
          value,
        ),
      );
      return completed("project_runtime_queue_entry_durable", value);
    });
  } catch {
    return blocked("project_runtime_queue_observation_unknown", true);
  }
}

/**
 * readProjectOperationQueueStateの処理を実行する。
 *
 * @responsibility readProjectOperationQueueStateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、queueId: string
 * @returns StoreResult<ProjectQueueEntry>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、queueId: string」がreadProjectOperationQueueStateの入力契約を満たす。
 * @postcondition readProjectOperationQueueStateの責務を完了した結果だけを返す。
 * @effect N/A: readProjectOperationQueueStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readProjectOperationQueueStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readProjectOperationQueueStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readProjectOperationQueueStateはProcess内の同一Subsystemで完結する。
 * @security readProjectOperationQueueStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readProjectOperationQueueStateは共有非同期状態を持たない同期処理である。
 */
export function readProjectOperationQueueState(
  workingDirectory: string,
  repositoryBindingId: string,
  queueId: string,
): StoreResult<ProjectQueueEntry> {
  try {
    if (!validId(repositoryBindingId) || !validId(queueId))
      return blocked("project_runtime_queue_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const entryDirectory = path.join(runtime, "queues", queueId);
    const existingItems = validatedQueueHistory(
      readEnvelopes(entryDirectory, "generation-"),
      repositoryBindingId,
      queueId,
    );
    if (existingItems === null)
      return blocked("project_runtime_queue_record_mismatch", true);
    const currentEnvelope = existingItems.at(-1);
    if (!currentEnvelope)
      return blocked("project_runtime_queue_observation_unknown", true);
    const current = currentEnvelope.content;
    if (
      currentEnvelope.recordKind !== "queue-entry" ||
      !validQueueEntry(current) ||
      current.generation !== currentEnvelope.updatedGeneration ||
      current.queueId !== queueId ||
      currentEnvelope.repositoryBindingId !== repositoryBindingId ||
      currentEnvelope.projectId !== current.projectId
    )
      return blocked("project_runtime_queue_record_mismatch", true);
    return completed("project_runtime_queue_observed", current);
  } catch {
    return blocked("project_runtime_queue_observation_unknown", true);
  }
}

/**
 * Select the next unowned operation without preempting active work.
 *
 * @responsibility selectNextProjectOperationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string
 * @returns StoreResult<ProjectQueueEntry | null>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string」がselectNextProjectOperationの入力契約を満たす。
 * @postcondition selectNextProjectOperationの責務を完了した結果だけを返す。
 * @effect selectNextProjectOperationはFilesystemの読取りまたは書込みを実行する。
 * @failure selectNextProjectOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant selectNextProjectOperationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security selectNextProjectOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: selectNextProjectOperationは共有非同期状態を持たない同期処理である。
 */
export function selectNextProjectOperation(
  workingDirectory: string,
  repositoryBindingId: string,
): StoreResult<ProjectQueueEntry | null> {
  try {
    if (!validId(repositoryBindingId))
      return blocked("project_runtime_queue_selection_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const queueRoot = path.join(runtime, "queues");
    if (!fs.existsSync(queueRoot))
      return completed("project_runtime_queue_empty", null);
    assertDirectory(queueRoot);
    const names = fs.readdirSync(queueRoot).sort();
    if (names.length > 4096 || names.some((name) => !validId(name)))
      return blocked("project_runtime_queue_inventory_invalid", true);
    const entries: ProjectQueueEntry[] = [];
    for (const name of names) {
      const entryDirectory = path.join(queueRoot, name);
      assertDirectory(entryDirectory);
      const records = readEnvelopes(entryDirectory, "generation-");
      const observedBinding = records[0]?.repositoryBindingId;
      if (
        !observedBinding ||
        validatedQueueHistory(records, observedBinding, name) === null
      )
        return blocked("project_runtime_queue_record_mismatch", true);
      // A Project binding owns only its own queue. Another valid binding is
      // isolated rather than reinterpreted as corruption of the caller's
      // queue population.
      if (observedBinding !== repositoryBindingId) continue;
      const observed = readProjectOperationQueueState(
        workingDirectory,
        repositoryBindingId,
        name,
      );
      if (observed.status !== "completed")
        return blocked(observed.reason, observed.manualRecoveryRequired);
      entries.push(observed.value);
    }
    // Queue priority applies only between operations that are not yet owned.
    // Once any operation is leased or running, selecting a second queue would
    // violate the Project concurrency boundary before task scheduling can
    // reject it.  Keep later arrivals effect-free until the active owner has
    // reached a terminal/recoverable state and released its lease.
    const active = entries.find((entry) => entry.ownerGeneration !== null);
    if (active) {
      for (const scheduled of entries.filter(
        (entry) =>
          entry.originLane === "scheduled" &&
          entry.state === "queued" &&
          entry.ownerGeneration === null,
      )) {
        const parked = updateProjectOperationQueueState(
          workingDirectory,
          repositoryBindingId,
          scheduled.queueId,
          scheduled.generation,
          {
            state: "waiting_foreground",
            lease: null,
            resumeCondition: "active_operation_pending",
            resultReference: null,
          },
        );
        if (parked.status !== "completed")
          return blocked(parked.reason, parked.manualRecoveryRequired);
      }
      return completed("project_runtime_active_operation_retained", null);
    }
    const interactive = entries.find(
      (entry) =>
        entry.originLane === "interactive" &&
        entry.state === "queued" &&
        entry.ownerGeneration === null,
    );
    if (interactive) {
      for (const scheduled of entries.filter(
        (entry) =>
          entry.originLane === "scheduled" &&
          entry.state === "queued" &&
          entry.ownerGeneration === null,
      )) {
        const parked = updateProjectOperationQueueState(
          workingDirectory,
          repositoryBindingId,
          scheduled.queueId,
          scheduled.generation,
          {
            state: "waiting_foreground",
            lease: null,
            resumeCondition: "interactive_queue_pending",
            resultReference: null,
          },
        );
        if (parked.status !== "completed")
          return blocked(parked.reason, parked.manualRecoveryRequired);
      }
      return completed(
        "project_runtime_interactive_queue_selected",
        interactive,
      );
    }
    const waiting = entries.find(
      (entry) =>
        entry.originLane === "scheduled" &&
        entry.state === "waiting_foreground" &&
        entry.ownerGeneration === null,
    );
    if (waiting) {
      const woken = updateProjectOperationQueueState(
        workingDirectory,
        repositoryBindingId,
        waiting.queueId,
        waiting.generation,
        {
          state: "queued",
          lease: null,
          resumeCondition: null,
          resultReference: null,
        },
      );
      return woken.status === "completed"
        ? completed("project_runtime_scheduled_queue_selected", woken.value)
        : blocked(woken.reason, woken.manualRecoveryRequired);
    }
    const scheduled = entries.find(
      (entry) =>
        entry.originLane === "scheduled" &&
        entry.state === "queued" &&
        entry.ownerGeneration === null,
    );
    return completed(
      scheduled
        ? "project_runtime_scheduled_queue_selected"
        : "project_runtime_queue_empty",
      scheduled ?? null,
    );
  } catch {
    return blocked("project_runtime_queue_selection_observation_unknown", true);
  }
}

const QUEUE_TRANSITIONS = Object.freeze({
  queued: Object.freeze(["leased", "waiting_foreground", "cancelled"]),
  leased: Object.freeze([
    "running",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  running: Object.freeze([
    "integration_pending",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  waiting_foreground: Object.freeze(["queued", "cancelled"]),
  integration_pending: Object.freeze([
    "completed",
    "replan_required",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  replan_required: Object.freeze([
    "queued",
    "human_decision_required",
    "recovery_required",
    "cancelled",
  ]),
  human_decision_required: Object.freeze([
    "replan_required",
    "recovery_required",
    "cancelled",
  ]),
  recovery_required: Object.freeze([
    "queued",
    "recovery_required",
    "cancelled",
  ]),
  completed: Object.freeze([]),
  cancelled: Object.freeze([]),
} satisfies Record<ProjectQueueState, readonly ProjectQueueState[]>);

/**
 * updateProjectOperationQueueStateの処理を実行する。
 *
 * @responsibility updateProjectOperationQueueStateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、queueId: string、expectedGeneration: number、next: Readonly<{ state: ProjectQueueState; lease: ProjectRuntimeLease | null; resumeCondition: string | null; resultReference: string | null; }>
 * @returns StoreResult<ProjectQueueEntry>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、queueId: string、expectedGeneration: number、next: Readonly<{ state: ProjectQueueState; lease: ProjectRuntimeLease | null; resumeCondition: string | null; resultReference: string | null; }>」がupdateProjectOperationQueueStateの入力契約を満たす。
 * @postcondition updateProjectOperationQueueStateの責務を完了した結果だけを返す。
 * @effect N/A: updateProjectOperationQueueStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure updateProjectOperationQueueStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant updateProjectOperationQueueStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: updateProjectOperationQueueStateはProcess内の同一Subsystemで完結する。
 * @security updateProjectOperationQueueStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: updateProjectOperationQueueStateは共有非同期状態を持たない同期処理である。
 */
export function updateProjectOperationQueueState(
  workingDirectory: string,
  repositoryBindingId: string,
  queueId: string,
  expectedGeneration: number,
  next: Readonly<{
    state: ProjectQueueState;
    lease: ProjectRuntimeLease | null;
    resumeCondition: string | null;
    resultReference: string | null;
  }>,
): StoreResult<ProjectQueueEntry> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(queueId) ||
      !Number.isSafeInteger(expectedGeneration) ||
      expectedGeneration < 1
    )
      return blocked("project_runtime_queue_update_invalid");
    if (next.resumeCondition !== null && !validId(next.resumeCondition))
      return blocked("project_runtime_queue_resume_condition_invalid");
    if (
      next.resultReference !== null &&
      !validResultReference(next.resultReference)
    )
      return blocked("project_runtime_queue_result_reference_invalid");
    const { repositoryRoot, runtime } = storageRoot(workingDirectory);
    const entryDirectory = path.join(runtime, "queues", queueId);
    return withMutationLock(runtime, "queue-mutation", () => {
      const existingItems = validatedQueueHistory(
        readEnvelopes(entryDirectory, "generation-"),
        repositoryBindingId,
        queueId,
      );
      if (existingItems === null)
        return blocked("project_runtime_queue_record_mismatch", true);
      const currentEnvelope = existingItems.at(-1);
      if (
        !currentEnvelope ||
        currentEnvelope.updatedGeneration !== expectedGeneration
      )
        return blocked("project_runtime_queue_generation_conflict");
      const current = currentEnvelope.content;
      if (
        !validQueueEntry(current) ||
        current.generation !== currentEnvelope.updatedGeneration ||
        current.queueId !== queueId ||
        currentEnvelope.projectId !== current.projectId
      )
        return blocked("project_runtime_queue_record_mismatch", true);
      const allowedTransitions: readonly ProjectQueueState[] =
        QUEUE_TRANSITIONS[current.state] ?? [];
      if (!allowedTransitions.includes(next.state))
        return blocked("project_runtime_queue_transition_invalid");
      if (
        current.state === "recovery_required" &&
        next.state === "recovery_required" &&
        !(
          current.ownerGeneration === null &&
          current.resumeCondition === "owner_loss" &&
          next.lease === null &&
          next.resumeCondition === "exact_recovery" &&
          next.resultReference !== null
        )
      )
        return blocked("project_runtime_queue_recovery_binding_invalid");
      if (
        current.state === "recovery_required" &&
        next.state === "queued" &&
        !(
          current.ownerGeneration === null &&
          current.resumeCondition === "owner_loss" &&
          current.resultReference !== null &&
          next.lease === null &&
          next.resumeCondition === null &&
          next.resultReference === null
        )
      )
        return blocked("project_runtime_queue_owner_loss_reset_invalid");
      const activeLease = next.lease ? activeLeases.get(next.lease) : undefined;
      const nextLeaseRequired = ["leased", "running"].includes(next.state);
      const leaseRequired =
        current.ownerGeneration !== null || nextLeaseRequired;
      if (!leaseRequired && next.lease !== null)
        return blocked("project_runtime_queue_lease_invalid");
      if (leaseRequired) {
        if (
          activeLease?.kind !== "project-operation" ||
          activeLease.repositoryRoot !== repositoryRoot ||
          activeLease.repositoryBindingId !== repositoryBindingId ||
          activeLease.projectId !== current.projectId ||
          activeLease.queueId !== queueId ||
          !activeLeaseIsObserved(activeLease)
        )
          return blocked("project_runtime_queue_lease_invalid");
        if (
          current.ownerGeneration !== null &&
          current.ownerGeneration !== activeLease.ownerGeneration
        )
          return blocked("project_runtime_queue_owner_mismatch");
      }
      // A terminal Queue record is first a durable terminal intent. Its owner
      // remains attached until the physical lock and release evidence have been
      // observed by settleProjectOperationQueueLeaseRelease().
      const ownerGeneration = leaseRequired
        ? (activeLease?.ownerGeneration ?? null)
        : null;
      const value: ProjectQueueEntry = Object.freeze({
        ...current,
        state: next.state,
        ownerGeneration,
        resumeCondition: next.resumeCondition,
        resultReference: next.resultReference,
        generation: current.generation + 1,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        `generation-${value.generation}.json`,
        envelope(
          "queue-entry",
          repositoryBindingId,
          current.projectId,
          1,
          value.generation,
          value,
        ),
      );
      return completed("project_runtime_queue_state_durable", value);
    });
  } catch {
    return blocked("project_runtime_queue_observation_unknown", true);
  }
}

/**
 * Resume a Queue only after its exact Runtime-owned recovery reference has
 *
 * @responsibility settleProjectOperationQueueRecoveryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、queueId: string、expectedGeneration: number、recoveryId: string
 * @returns StoreResult<ProjectQueueEntry>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、queueId: string、expectedGeneration: number、recoveryId: string」がsettleProjectOperationQueueRecoveryの入力契約を満たす。
 * @postcondition settleProjectOperationQueueRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: settleProjectOperationQueueRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure settleProjectOperationQueueRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant settleProjectOperationQueueRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: settleProjectOperationQueueRecoveryはProcess内の同一Subsystemで完結する。
 * @security settleProjectOperationQueueRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleProjectOperationQueueRecoveryは共有非同期状態を持たない同期処理である。
 */
export function settleProjectOperationQueueRecovery(
  workingDirectory: string,
  repositoryBindingId: string,
  queueId: string,
  expectedGeneration: number,
  recoveryId: string,
): StoreResult<ProjectQueueEntry> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(queueId) ||
      !Number.isSafeInteger(expectedGeneration) ||
      expectedGeneration < 1 ||
      !validResultReference(recoveryId)
    )
      return blocked("project_runtime_queue_recovery_settlement_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const entryDirectory = path.join(runtime, "queues", queueId);
    return withMutationLock(runtime, "queue-mutation", () => {
      const historyEntries = validatedQueueHistory(
        readEnvelopes(entryDirectory, "generation-"),
        repositoryBindingId,
        queueId,
      );
      const currentEnvelope = historyEntries?.at(-1);
      if (
        !currentEnvelope ||
        currentEnvelope.updatedGeneration !== expectedGeneration ||
        !validQueueEntry(currentEnvelope.content)
      )
        return blocked("project_runtime_queue_recovery_generation_conflict");
      const current = currentEnvelope.content;
      if (
        current.state !== "recovery_required" ||
        current.ownerGeneration !== null ||
        current.resumeCondition !== "exact_recovery" ||
        current.resultReference !== recoveryId
      )
        return blocked("project_runtime_queue_recovery_identity_mismatch");
      const value: ProjectQueueEntry = Object.freeze({
        ...current,
        state: "queued" as const,
        generation: current.generation + 1,
        ownerGeneration: null,
        resumeCondition: "exact_recovery_settled",
        resultReference: recoveryId,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        `generation-${value.generation}.json`,
        envelope(
          "queue-entry",
          repositoryBindingId,
          current.projectId,
          1,
          value.generation,
          value,
        ),
      );
      return completed("project_runtime_queue_recovery_settled", value);
    });
  } catch {
    return blocked("project_runtime_queue_recovery_settlement_unknown", true);
  }
}

/**
 * acquireProjectRuntimeLeaseの処理を実行する。
 *
 * @responsibility acquireProjectRuntimeLeaseに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind
 * @returns StoreResult<ProjectRuntimeLease>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、projectId: string、queueId: string、kind: LeaseKind」がacquireProjectRuntimeLeaseの入力契約を満たす。
 * @postcondition acquireProjectRuntimeLeaseの責務を完了した結果だけを返す。
 * @effect acquireProjectRuntimeLeaseはFilesystemの読取りまたは書込みを実行する。
 * @failure acquireProjectRuntimeLeaseは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant acquireProjectRuntimeLeaseは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security acquireProjectRuntimeLeaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: acquireProjectRuntimeLeaseは共有非同期状態を持たない同期処理である。
 */
export function acquireProjectRuntimeLease(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
): StoreResult<ProjectRuntimeLease> {
  let acquisitionMarker: string | null = null;
  let isAcquisitionMarkerOwned = false;
  let lockOwnershipMarker: string | null = null;
  let isLockOwnershipMarkerOwned = false;
  let lock: string | null = null;
  let isLockOwned = false;
  let acquiredEvidence: string | null = null;
  let recoveryId: string | null = null;
  try {
    if (![repositoryBindingId, projectId, queueId].every(validId))
      return blocked("project_runtime_lease_identity_invalid");
    const { repositoryRoot, runtime } = storageRoot(workingDirectory);
    const locks = lockRoot(runtime);
    const identity = leaseIdentity(
      repositoryBindingId,
      projectId,
      queueId,
      kind,
    );
    lock = path.join(locks, `${identity}.lock`);
    const recoveryMarker = path.join(locks, `${identity}.release-unknown`);
    acquisitionMarker = path.join(locks, `${identity}.acquire-pending`);
    lockOwnershipMarker = path.join(locks, `${identity}.acquire-lock-owned`);
    recoveryId = leaseAcquisitionRecoveryId(
      repositoryBindingId,
      projectId,
      queueId,
      kind,
    );
    if (fs.existsSync(recoveryMarker))
      return blocked(
        "project_runtime_lease_recovery_required",
        true,
        recoveryId,
      );
    if (leaseAcquisitionTemporaryFiles(locks, identity).length > 0)
      return blocked("project_runtime_lease_unavailable");
    if (fs.existsSync(acquisitionMarker))
      return blocked("project_runtime_lease_unavailable");
    if (fs.existsSync(lockOwnershipMarker))
      return blocked("project_runtime_lease_unavailable");
    const ownerGeneration = randomUUID();
    const evidence = leaseEvidenceRoot(runtime);
    try {
      createLeaseAcquisitionMarker(
        locks,
        identity,
        Object.freeze({
          kind,
          queueId,
          ownerGeneration,
          ownerProcessId: process.pid,
          recoveryId,
        }),
      );
      isAcquisitionMarkerOwned = true;
      fs.mkdirSync(lock, { mode: 0o700 });
      isLockOwned = true;
      createLeaseLockOwnershipMarker(
        lockOwnershipMarker,
        Object.freeze({
          kind,
          queueId,
          ownerGeneration,
          ownerProcessId: process.pid,
          recoveryId,
        }),
      );
      isLockOwnershipMarkerOwned = true;
    } catch (error) {
      if (!isAcquisitionMarkerOwned) {
        if (errorCode(error) === "EEXIST")
          return blocked("project_runtime_lease_unavailable");
        try {
          if (fs.existsSync(acquisitionMarker)) {
            const competing = readLeaseAcquisitionMarker(acquisitionMarker);
            if (
              competing.kind === kind &&
              competing.recoveryId === recoveryId &&
              (competing.ownerProcessId !== process.pid ||
                (kind === "project-operation" && competing.queueId !== queueId))
            )
              return blocked("project_runtime_lease_unavailable");
            if (competing.ownerProcessId === process.pid)
              return blocked(
                "project_runtime_lease_acquisition_recovery_required",
                true,
                recoveryId,
              );
          }
          if (
            leaseAcquisitionFootprintAbsent(locks, identity, [
              lock,
              recoveryMarker,
              acquisitionMarker,
              lockOwnershipMarker,
            ])
          )
            return blocked("project_runtime_lease_acquisition_rolled_back");
        } catch {}
        return blocked(
          "project_runtime_lease_acquisition_recovery_required",
          true,
          recoveryId,
        );
      }
      throw error;
    }
    assertDirectory(lock);
    acquiredEvidence = path.join(
      evidence,
      `${identity}-${ownerGeneration}.json`,
    );
    atomicCreateAndReadBack(
      evidence,
      `${identity}-${ownerGeneration}.json`,
      envelope("lease-evidence", repositoryBindingId, projectId, 1, 1, {
        kind,
        queueId,
        ownerGeneration,
        ownerProcessId: process.pid,
        disposition: "acquired",
      }),
    );
    const acquiredLock = lock;
    const ownedAcquisitionMarker = acquisitionMarker;
    const ownedLockOwnershipMarker = lockOwnershipMarker;
    const exactRecoveryId = recoveryId;
    let released = false;
    let lease!: ProjectRuntimeLease;
    lease = Object.freeze({
      kind,
      ownerGeneration,
      release: () => {
        if (released)
          return blocked<Readonly<{ released: true }>>(
            "project_runtime_lease_already_released",
          );
        try {
          const markerDescriptor = fs.openSync(
            recoveryMarker,
            fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
            0o600,
          );
          try {
            fs.writeFileSync(markerDescriptor, `${ownerGeneration}\n`, "utf8");
            fs.fsyncSync(markerDescriptor);
          } finally {
            fs.closeSync(markerDescriptor);
          }
          if (
            fs.readFileSync(recoveryMarker, "utf8") !== `${ownerGeneration}\n`
          )
            throw new Error("project_runtime_lease_recovery_marker_mismatch");
          assertDirectory(acquiredLock);
          fs.rmdirSync(acquiredLock);
          if (fs.existsSync(acquiredLock))
            throw new Error("project_runtime_lease_lock_release_unknown");
          atomicCreateAndReadBack(
            evidence,
            `${identity}-${ownerGeneration}-released.json`,
            envelope("lease-evidence", repositoryBindingId, projectId, 1, 2, {
              kind,
              queueId,
              ownerGeneration,
              ownerProcessId: process.pid,
              disposition: "released",
            }),
          );
          fs.rmSync(recoveryMarker);
          if (fs.existsSync(recoveryMarker))
            throw new Error(
              "project_runtime_lease_recovery_marker_release_unknown",
            );
          if (fs.existsSync(ownedLockOwnershipMarker)) {
            const ownership = readLeaseAcquisitionMarker(
              ownedLockOwnershipMarker,
            );
            if (
              ownership.kind !== kind ||
              ownership.queueId !== queueId ||
              ownership.ownerGeneration !== ownerGeneration ||
              ownership.ownerProcessId !== process.pid ||
              ownership.recoveryId !== exactRecoveryId
            )
              throw new Error(
                "project_runtime_lease_lock_ownership_marker_mismatch",
              );
            fs.rmSync(ownedLockOwnershipMarker);
          }
          if (fs.existsSync(ownedLockOwnershipMarker))
            throw new Error(
              "project_runtime_lease_lock_ownership_marker_release_unknown",
            );
          if (fs.existsSync(ownedAcquisitionMarker)) {
            const pending = readLeaseAcquisitionMarker(ownedAcquisitionMarker);
            if (
              pending.kind !== kind ||
              pending.queueId !== queueId ||
              pending.ownerGeneration !== ownerGeneration ||
              pending.ownerProcessId !== process.pid ||
              pending.recoveryId !== exactRecoveryId
            )
              throw new Error(
                "project_runtime_lease_acquisition_marker_mismatch",
              );
            fs.rmSync(ownedAcquisitionMarker);
          }
          if (fs.existsSync(ownedAcquisitionMarker))
            throw new Error(
              "project_runtime_lease_acquisition_marker_release_unknown",
            );
          released = true;
          activeLeases.delete(lease);
          return completed<Readonly<{ released: true }>>(
            "project_runtime_lease_released",
            Object.freeze({ released: true as const }),
          );
        } catch {
          activeLeases.delete(lease);
          return blocked<Readonly<{ released: true }>>(
            "project_runtime_lease_release_unknown",
            true,
          );
        }
      },
    });
    activeLeases.set(
      lease,
      Object.freeze({
        repositoryRoot,
        repositoryBindingId,
        projectId,
        queueId,
        kind,
        ownerGeneration,
        lock: acquiredLock,
        recoveryMarker,
        acquisitionMarker: ownedAcquisitionMarker,
        lockOwnershipMarker: ownedLockOwnershipMarker,
        evidenceDirectory: evidence,
        identity,
      }),
    );
    return completed("project_runtime_lease_acquired", lease);
  } catch {
    let cleanupConfirmed = true;
    try {
      if (isLockOwned && lock !== null && fs.existsSync(lock))
        fs.rmdirSync(lock);
      if (lock !== null && fs.existsSync(lock)) cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    try {
      if (
        cleanupConfirmed &&
        acquiredEvidence !== null &&
        fs.existsSync(acquiredEvidence)
      )
        fs.rmSync(acquiredEvidence);
      if (acquiredEvidence !== null && fs.existsSync(acquiredEvidence))
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    try {
      if (
        cleanupConfirmed &&
        isLockOwnershipMarkerOwned &&
        lockOwnershipMarker !== null &&
        fs.existsSync(lockOwnershipMarker)
      )
        fs.rmSync(lockOwnershipMarker);
      if (lockOwnershipMarker !== null && fs.existsSync(lockOwnershipMarker))
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    try {
      if (
        cleanupConfirmed &&
        isAcquisitionMarkerOwned &&
        acquisitionMarker !== null &&
        fs.existsSync(acquisitionMarker)
      )
        fs.rmSync(acquisitionMarker);
      if (acquisitionMarker !== null && fs.existsSync(acquisitionMarker))
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    try {
      if (
        lock !== null &&
        leaseAcquisitionTemporaryFiles(
          path.dirname(lock),
          path.basename(lock, ".lock"),
        ).length > 0
      )
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
    return cleanupConfirmed
      ? blocked("project_runtime_lease_acquisition_rolled_back")
      : blocked(
          "project_runtime_lease_acquisition_recovery_required",
          true,
          recoveryId,
        );
  }
}

/**
 * inspectProjectRuntimeLeaseAcquisitionOwnerの処理を実行する。
 *
 * @responsibility inspectProjectRuntimeLeaseAcquisitionOwnerに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string
 * @returns StoreResult< Readonly<{ acquisition: ProjectRuntimeLeaseAcquisitionResolution | null }> >を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string」がinspectProjectRuntimeLeaseAcquisitionOwnerの入力契約を満たす。
 * @postcondition inspectProjectRuntimeLeaseAcquisitionOwnerの責務を完了した結果だけを返す。
 * @effect inspectProjectRuntimeLeaseAcquisitionOwnerはFilesystemの読取りまたは書込みを実行する。
 * @failure inspectProjectRuntimeLeaseAcquisitionOwnerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectProjectRuntimeLeaseAcquisitionOwnerは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inspectProjectRuntimeLeaseAcquisitionOwnerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectProjectRuntimeLeaseAcquisitionOwnerは共有非同期状態を持たない同期処理である。
 */
export function inspectProjectRuntimeLeaseAcquisitionOwner(
  workingDirectory: string,
  repositoryBindingId: string,
): StoreResult<
  Readonly<{ acquisition: ProjectRuntimeLeaseAcquisitionResolution | null }>
> {
  const recoveryId = validId(repositoryBindingId)
    ? leaseAcquisitionRecoveryId(
        repositoryBindingId,
        "inspection",
        "inspection",
        "project-operation",
      )
    : null;
  try {
    if (!validId(repositoryBindingId))
      return blocked("project_runtime_lease_recovery_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    const locks = lockRoot(runtime);
    const identity = leaseIdentity(
      repositoryBindingId,
      "inspection",
      "inspection",
      "project-operation",
    );
    const acquisitionMarker = path.join(locks, `${identity}.acquire-pending`);
    const temporaryFiles = leaseAcquisitionTemporaryFiles(locks, identity);
    const associatedPaths = Object.freeze([
      path.join(locks, `${identity}.lock`),
      path.join(locks, `${identity}.release-unknown`),
      acquisitionMarker,
      path.join(locks, `${identity}.acquire-lock-owned`),
    ]);
    if (leaseAcquisitionFootprintAbsent(locks, identity, associatedPaths))
      return completed(
        "project_runtime_lease_acquisition_resources_absent",
        Object.freeze({ acquisition: null }),
      );
    if (temporaryFiles.length > 1)
      return blocked(
        "project_runtime_lease_acquisition_recovery_cleanup_unknown",
        true,
        recoveryId,
      );
    const candidates = [
      ...(fs.existsSync(acquisitionMarker) ? [acquisitionMarker] : []),
      ...temporaryFiles.map((name) => path.join(locks, name)),
    ];
    if (candidates.length === 0)
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        recoveryId,
      );
    let markers: readonly LeaseAcquisitionMarker[];
    try {
      markers = Object.freeze(candidates.map(readLeaseAcquisitionMarker));
    } catch {
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        recoveryId,
      );
    }
    const first = markers[0];
    if (
      first?.kind !== "project-operation" ||
      markers.some(
        (marker) =>
          marker.kind !== first.kind ||
          marker.queueId !== first.queueId ||
          marker.ownerGeneration !== first.ownerGeneration ||
          marker.ownerProcessId !== first.ownerProcessId ||
          marker.recoveryId !== first.recoveryId,
      ) ||
      first.recoveryId !== recoveryId
    )
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        recoveryId,
      );
    const queueDirectory = path.join(runtime, "queues", first.queueId);
    let historyEntries: readonly QueueEnvelope[] | null;
    try {
      historyEntries = validatedQueueHistory(
        readEnvelopes(queueDirectory, "generation-"),
        repositoryBindingId,
        first.queueId,
      );
    } catch {
      historyEntries = null;
    }
    const queue = historyEntries?.at(-1)?.content;
    if (
      !queue ||
      (queue.ownerGeneration === null && queue.state !== "queued") ||
      (queue.ownerGeneration !== null &&
        queue.ownerGeneration !== first.ownerGeneration)
    )
      return blocked(
        "project_runtime_lease_acquisition_queue_identity_mismatch",
        true,
        recoveryId,
      );
    return completed(
      "project_runtime_lease_acquisition_owner_observed",
      Object.freeze({
        acquisition: Object.freeze({
          repositoryBindingId,
          projectId: queue.projectId,
          queueId: queue.queueId,
          ownerGeneration: first.ownerGeneration,
          ownerProcessId: first.ownerProcessId,
          recoveryId: first.recoveryId,
        }),
      }),
    );
  } catch {
    return blocked(
      "project_runtime_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  }
}

/**
 * settleProjectOperationQueueLeaseReleaseの処理を実行する。
 *
 * @responsibility settleProjectOperationQueueLeaseReleaseに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、queueId: string、expectedGeneration: number、ownerGeneration: string
 * @returns StoreResult<ProjectQueueEntry>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、queueId: string、expectedGeneration: number、ownerGeneration: string」がsettleProjectOperationQueueLeaseReleaseの入力契約を満たす。
 * @postcondition settleProjectOperationQueueLeaseReleaseの責務を完了した結果だけを返す。
 * @effect settleProjectOperationQueueLeaseReleaseはFilesystemの読取りまたは書込みを実行する。
 * @failure settleProjectOperationQueueLeaseReleaseは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant settleProjectOperationQueueLeaseReleaseは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security settleProjectOperationQueueLeaseReleaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleProjectOperationQueueLeaseReleaseは共有非同期状態を持たない同期処理である。
 */
export function settleProjectOperationQueueLeaseRelease(
  workingDirectory: string,
  repositoryBindingId: string,
  queueId: string,
  expectedGeneration: number,
  ownerGeneration: string,
): StoreResult<ProjectQueueEntry> {
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(queueId) ||
      !validId(ownerGeneration) ||
      !Number.isSafeInteger(expectedGeneration) ||
      expectedGeneration < 1
    )
      return blocked("project_runtime_queue_release_settlement_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    return withMutationLock(runtime, "queue-mutation", () => {
      const entryDirectory = path.join(runtime, "queues", queueId);
      const historyEntries = validatedQueueHistory(
        readEnvelopes(entryDirectory, "generation-"),
        repositoryBindingId,
        queueId,
      );
      const currentEnvelope = historyEntries?.at(-1);
      const current = currentEnvelope?.content;
      if (
        !currentEnvelope ||
        !current ||
        current.generation !== expectedGeneration ||
        current.ownerGeneration !== ownerGeneration ||
        current.state === "leased" ||
        current.state === "running"
      )
        return blocked(
          "project_runtime_queue_release_settlement_state_mismatch",
          true,
        );
      const identity = leaseIdentity(
        repositoryBindingId,
        current.projectId,
        queueId,
        "project-operation",
      );
      const locks = lockRoot(runtime);
      if (
        fs.existsSync(path.join(locks, `${identity}.lock`)) ||
        fs.existsSync(path.join(locks, `${identity}.release-unknown`)) ||
        fs.existsSync(path.join(locks, `${identity}.acquire-pending`)) ||
        fs.existsSync(path.join(locks, `${identity}.acquire-lock-owned`))
      )
        return blocked(
          "project_runtime_queue_release_settlement_resource_present",
          true,
        );
      const evidence = leaseEvidenceRoot(runtime);
      const leaseEvidence = readExactLeaseEvidence(evidence, {
        repositoryBindingId,
        projectId: current.projectId,
        queueId,
        kind: "project-operation",
        identity,
        ownerGeneration,
      });
      if (!leaseEvidence.released || leaseEvidence.recovered)
        return blocked("project_runtime_queue_release_evidence_mismatch", true);
      const value: ProjectQueueEntry = Object.freeze({
        ...current,
        generation: current.generation + 1,
        ownerGeneration: null,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        `generation-${value.generation}.json`,
        envelope(
          "queue-entry",
          repositoryBindingId,
          current.projectId,
          1,
          value.generation,
          value,
        ),
      );
      return completed("project_runtime_queue_release_settled", value);
    });
  } catch {
    return blocked(
      "project_runtime_queue_release_settlement_observation_unknown",
      true,
    );
  }
}

/**
 * LeaseOwnerObserverが扱う値の構造を表す。
 *
 * @responsibility LeaseOwnerObserverに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape LeaseOwnerObserverが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LeaseOwnerObserverで宣言した値と責務の対応を維持する。
 * @boundary N/A: LeaseOwnerObserverの宣言は外部境界を開かない。
 * @security LeaseOwnerObserverはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility LeaseOwnerObserverの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type LeaseOwnerObserver = (
  owner: Readonly<{
    ownerProcessId: number;
    ownerGeneration: string;
  }>,
) => unknown;

/**
 * reconcileUnboundLeaseAcquisitionの処理を実行する。
 *
 * @responsibility reconcileUnboundLeaseAcquisitionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input runtime: string、repositoryBindingId: string、projectId: string、requestedQueueId: string、kind: LeaseKind、observeOwner: LeaseOwnerObserver、shouldRetainAcquisitionMarkerForCaller
 * @returns StoreResult<Readonly<{ recoveryId: string }>>を返す。
 * @precondition 「runtime: string、repositoryBindingId: string、projectId: string、requestedQueueId: string、kind: LeaseKind、observeOwner: LeaseOwnerObserver、shouldRetainAcquisitionMarkerForCaller」がreconcileUnboundLeaseAcquisitionの入力契約を満たす。
 * @postcondition reconcileUnboundLeaseAcquisitionの責務を完了した結果だけを返す。
 * @effect reconcileUnboundLeaseAcquisitionはFilesystemの読取りまたは書込みを実行する。
 * @failure reconcileUnboundLeaseAcquisitionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant reconcileUnboundLeaseAcquisitionは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security reconcileUnboundLeaseAcquisitionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reconcileUnboundLeaseAcquisitionは共有非同期状態を持たない同期処理である。
 */
function reconcileUnboundLeaseAcquisition(
  runtime: string,
  repositoryBindingId: string,
  projectId: string,
  requestedQueueId: string,
  kind: LeaseKind,
  observeOwner: LeaseOwnerObserver,
  shouldRetainAcquisitionMarkerForCaller = false,
): StoreResult<Readonly<{ recoveryId: string }>> {
  const identity = leaseIdentity(
    repositoryBindingId,
    projectId,
    requestedQueueId,
    kind,
  );
  const expectedRecoveryId = leaseAcquisitionRecoveryId(
    repositoryBindingId,
    projectId,
    requestedQueueId,
    kind,
  );
  const locks = lockRoot(runtime);
  const lock = path.join(locks, `${identity}.lock`);
  const releaseMarker = path.join(locks, `${identity}.release-unknown`);
  const acquisitionMarker = path.join(locks, `${identity}.acquire-pending`);
  const lockOwnershipMarker = path.join(
    locks,
    `${identity}.acquire-lock-owned`,
  );
  const temporaryFiles = leaseAcquisitionTemporaryFiles(locks, identity);
  if (temporaryFiles.length > 1)
    return blocked(
      "project_runtime_lease_acquisition_recovery_cleanup_unknown",
      true,
      expectedRecoveryId,
    );
  const temporaryMarker =
    temporaryFiles.length === 1
      ? path.join(locks, temporaryFiles[0] as string)
      : null;
  if (temporaryMarker !== null) {
    let prepared: LeaseAcquisitionMarker;
    try {
      prepared = readLeaseAcquisitionMarker(temporaryMarker);
    } catch {
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
    }
    if (
      prepared.kind !== kind ||
      (kind === "project-operation" && prepared.queueId !== requestedQueueId) ||
      prepared.recoveryId !== expectedRecoveryId
    )
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
    if (fs.existsSync(acquisitionMarker)) {
      if (
        fs.readFileSync(acquisitionMarker, "utf8") !==
        fs.readFileSync(temporaryMarker, "utf8")
      )
        return blocked(
          "project_runtime_lease_acquisition_recovery_evidence_mismatch",
          true,
          expectedRecoveryId,
        );
    } else {
      let rawPreparedOwnerObservation: unknown;
      try {
        rawPreparedOwnerObservation = observeOwner(
          Object.freeze({
            ownerProcessId: prepared.ownerProcessId,
            ownerGeneration: prepared.ownerGeneration,
          }),
        );
      } catch {
        return blocked(
          "project_runtime_lease_owner_observation_unknown",
          true,
          expectedRecoveryId,
        );
      }
      if (
        !plainObject(rawPreparedOwnerObservation) ||
        !exactKeys(rawPreparedOwnerObservation, [
          "status",
          "ownerProcessId",
          "ownerGeneration",
        ]) ||
        rawPreparedOwnerObservation.ownerProcessId !==
          prepared.ownerProcessId ||
        rawPreparedOwnerObservation.ownerGeneration !== prepared.ownerGeneration
      )
        return blocked(
          "project_runtime_lease_owner_observation_unknown",
          true,
          expectedRecoveryId,
        );
      if (rawPreparedOwnerObservation.status === "alive")
        return blocked("project_runtime_lease_owner_still_active");
      if (rawPreparedOwnerObservation.status !== "absent")
        return blocked(
          "project_runtime_lease_owner_observation_unknown",
          true,
          expectedRecoveryId,
        );
      try {
        fs.linkSync(temporaryMarker, acquisitionMarker);
      } catch (error) {
        if (errorCode(error) !== "EEXIST")
          return blocked(
            "project_runtime_lease_acquisition_recovery_cleanup_unknown",
            true,
            expectedRecoveryId,
          );
      }
      if (
        !fs.existsSync(acquisitionMarker) ||
        fs.readFileSync(acquisitionMarker, "utf8") !==
          fs.readFileSync(temporaryMarker, "utf8")
      )
        return blocked(
          "project_runtime_lease_acquisition_recovery_evidence_mismatch",
          true,
          expectedRecoveryId,
        );
    }
  }
  if (!fs.existsSync(acquisitionMarker))
    return blocked(
      "project_runtime_lease_acquisition_recovery_state_mismatch",
      true,
      expectedRecoveryId,
    );
  let pending: LeaseAcquisitionMarker;
  try {
    pending = readLeaseAcquisitionMarker(acquisitionMarker);
  } catch {
    return blocked(
      "project_runtime_lease_acquisition_recovery_evidence_mismatch",
      true,
      expectedRecoveryId,
    );
  }
  const evidenceQueueId = pending.queueId;
  if (
    pending.kind !== kind ||
    (kind === "project-operation" && evidenceQueueId !== requestedQueueId) ||
    pending.recoveryId !== expectedRecoveryId
  )
    return blocked(
      "project_runtime_lease_acquisition_recovery_evidence_mismatch",
      true,
      expectedRecoveryId,
    );
  if (fs.existsSync(lockOwnershipMarker)) {
    let ownership: LeaseAcquisitionMarker;
    try {
      ownership = readLeaseAcquisitionMarker(lockOwnershipMarker);
    } catch {
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
    }
    if (
      ownership.kind !== pending.kind ||
      ownership.queueId !== pending.queueId ||
      ownership.ownerGeneration !== pending.ownerGeneration ||
      ownership.ownerProcessId !== pending.ownerProcessId ||
      ownership.recoveryId !== pending.recoveryId
    )
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
  } else if (fs.existsSync(lock)) {
    return blocked(
      "project_runtime_lease_acquisition_recovery_cleanup_unknown",
      true,
      expectedRecoveryId,
    );
  }
  let rawObservation: unknown;
  try {
    rawObservation = observeOwner(
      Object.freeze({
        ownerProcessId: pending.ownerProcessId,
        ownerGeneration: pending.ownerGeneration,
      }),
    );
  } catch {
    return blocked(
      "project_runtime_lease_owner_observation_unknown",
      true,
      expectedRecoveryId,
    );
  }
  if (
    !plainObject(rawObservation) ||
    !exactKeys(rawObservation, [
      "status",
      "ownerProcessId",
      "ownerGeneration",
    ]) ||
    rawObservation.ownerProcessId !== pending.ownerProcessId ||
    rawObservation.ownerGeneration !== pending.ownerGeneration
  )
    return blocked(
      "project_runtime_lease_owner_observation_unknown",
      true,
      expectedRecoveryId,
    );
  if (rawObservation.status === "alive")
    return blocked("project_runtime_lease_owner_still_active");
  if (rawObservation.status !== "absent")
    return blocked(
      "project_runtime_lease_owner_observation_unknown",
      true,
      expectedRecoveryId,
    );

  if (fs.existsSync(releaseMarker)) {
    if (
      fs.readFileSync(releaseMarker, "utf8") !== `${pending.ownerGeneration}\n`
    )
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
  } else {
    const descriptor = fs.openSync(
      releaseMarker,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
      0o600,
    );
    try {
      fs.writeFileSync(descriptor, `${pending.ownerGeneration}\n`, "utf8");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    if (
      fs.readFileSync(releaseMarker, "utf8") !== `${pending.ownerGeneration}\n`
    )
      throw new Error("project_runtime_lease_recovery_marker_mismatch");
  }
  if (fs.existsSync(lock)) {
    assertDirectory(lock);
    fs.rmdirSync(lock);
  }
  if (fs.existsSync(lock))
    throw new Error("project_runtime_lease_lock_release_unknown");

  const evidence = leaseEvidenceRoot(runtime);
  const base = `${identity}-${pending.ownerGeneration}`;
  const acquiredPath = path.join(evidence, `${base}.json`);
  const releasedPath = path.join(evidence, `${base}-released.json`);
  const recoveredPath = path.join(evidence, `${base}-recovered.json`);
  if (!fs.existsSync(acquiredPath)) {
    if (fs.existsSync(releasedPath) || fs.existsSync(recoveredPath))
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
  } else {
    let observed = readExactLeaseEvidence(evidence, {
      repositoryBindingId,
      projectId,
      queueId: evidenceQueueId,
      kind,
      identity,
      ownerGeneration: pending.ownerGeneration,
    });
    if (observed.acquired.content.ownerProcessId !== pending.ownerProcessId)
      return blocked(
        "project_runtime_lease_acquisition_recovery_evidence_mismatch",
        true,
        expectedRecoveryId,
      );
    if (!observed.released && !observed.recovered) {
      atomicCreateAndReadBack(
        evidence,
        `${base}-recovered.json`,
        envelope("lease-evidence", repositoryBindingId, projectId, 1, 2, {
          kind,
          queueId: evidenceQueueId,
          ownerGeneration: pending.ownerGeneration,
          ownerProcessId: pending.ownerProcessId,
          disposition: "recovered_after_owner_loss",
        }),
      );
      observed = readExactLeaseEvidence(evidence, {
        repositoryBindingId,
        projectId,
        queueId: evidenceQueueId,
        kind,
        identity,
        ownerGeneration: pending.ownerGeneration,
      });
    }
    if (!observed.released && !observed.recovered)
      throw new Error("project_runtime_lease_recovery_evidence_mismatch");
  }
  fs.rmSync(releaseMarker);
  if (fs.existsSync(lockOwnershipMarker)) fs.rmSync(lockOwnershipMarker);
  if (!shouldRetainAcquisitionMarkerForCaller) fs.rmSync(acquisitionMarker);
  if (temporaryMarker !== null) fs.rmSync(temporaryMarker);
  if (
    fs.existsSync(lock) ||
    fs.existsSync(releaseMarker) ||
    fs.existsSync(lockOwnershipMarker) ||
    (shouldRetainAcquisitionMarkerForCaller
      ? !fs.existsSync(acquisitionMarker)
      : fs.existsSync(acquisitionMarker)) ||
    leaseAcquisitionTemporaryFiles(locks, identity).length > 0
  )
    throw new Error(
      "project_runtime_lease_acquisition_recovery_cleanup_unknown",
    );
  return completed(
    "project_runtime_lease_acquisition_resources_recovered",
    Object.freeze({ recoveryId: expectedRecoveryId }),
  );
}

/**
 * reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossの処理を実行する。
 *
 * @responsibility reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、projectId: string、observeOwner: LeaseOwnerObserver
 * @returns StoreResult<Readonly<{ recoveryId: string | null }>>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、projectId: string、observeOwner: LeaseOwnerObserver」がreconcileCanonicalAdoptionLeaseAcquisitionOwnerLossの入力契約を満たす。
 * @postcondition reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossの責務を完了した結果だけを返す。
 * @effect N/A: reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossはProcess内の同一Subsystemで完結する。
 * @security reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reconcileCanonicalAdoptionLeaseAcquisitionOwnerLossは共有非同期状態を持たない同期処理である。
 */
export function reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
  observeOwner: LeaseOwnerObserver,
): StoreResult<Readonly<{ recoveryId: string | null }>> {
  const recoveryId =
    validId(repositoryBindingId) && validId(projectId)
      ? leaseAcquisitionRecoveryId(
          repositoryBindingId,
          projectId,
          "canonical",
          "canonical-adoption",
        )
      : null;
  try {
    if (
      !validId(repositoryBindingId) ||
      !validId(projectId) ||
      typeof observeOwner !== "function"
    )
      return blocked("project_runtime_lease_recovery_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    return withMutationLock<Readonly<{ recoveryId: string | null }>>(
      runtime,
      "queue-mutation",
      () => {
        const identity = leaseIdentity(
          repositoryBindingId,
          projectId,
          "canonical",
          "canonical-adoption",
        );
        const locks = lockRoot(runtime);
        if (
          leaseAcquisitionFootprintAbsent(
            locks,
            identity,
            Object.freeze([
              path.join(locks, `${identity}.lock`),
              path.join(locks, `${identity}.release-unknown`),
              path.join(locks, `${identity}.acquire-pending`),
              path.join(locks, `${identity}.acquire-lock-owned`),
            ]),
          )
        )
          return completed(
            "project_runtime_lease_acquisition_resources_absent",
            Object.freeze({ recoveryId: null }),
          );
        return reconcileUnboundLeaseAcquisition(
          runtime,
          repositoryBindingId,
          projectId,
          "canonical",
          "canonical-adoption",
          observeOwner,
        );
      },
    );
  } catch {
    return blocked(
      "project_runtime_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  }
}

/**
 * reconcileProjectRuntimeLeaseOwnerLossの処理を実行する。
 *
 * @responsibility reconcileProjectRuntimeLeaseOwnerLossに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string、projectId: string、queueId: string、observeOwner: LeaseOwnerObserver
 * @returns StoreResult<ProjectQueueEntry>を返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、projectId: string、queueId: string、observeOwner: LeaseOwnerObserver」がreconcileProjectRuntimeLeaseOwnerLossの入力契約を満たす。
 * @postcondition reconcileProjectRuntimeLeaseOwnerLossの責務を完了した結果だけを返す。
 * @effect reconcileProjectRuntimeLeaseOwnerLossはFilesystemの読取りまたは書込みを実行する。
 * @failure reconcileProjectRuntimeLeaseOwnerLossは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant reconcileProjectRuntimeLeaseOwnerLossは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security reconcileProjectRuntimeLeaseOwnerLossはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reconcileProjectRuntimeLeaseOwnerLossは共有非同期状態を持たない同期処理である。
 */
export function reconcileProjectRuntimeLeaseOwnerLoss(
  workingDirectory: string,
  repositoryBindingId: string,
  projectId: string,
  queueId: string,
  observeOwner: LeaseOwnerObserver,
): StoreResult<ProjectQueueEntry> {
  const recoveryId = [repositoryBindingId, projectId, queueId].every(validId)
    ? leaseAcquisitionRecoveryId(
        repositoryBindingId,
        projectId,
        queueId,
        "project-operation",
      )
    : null;
  try {
    if (
      ![repositoryBindingId, projectId, queueId].every(validId) ||
      typeof observeOwner !== "function"
    )
      return blocked("project_runtime_lease_recovery_input_invalid");
    const { runtime } = storageRoot(workingDirectory);
    return withMutationLock(runtime, "queue-mutation", () => {
      const entryDirectory = path.join(runtime, "queues", queueId);
      const historyEntries = validatedQueueHistory(
        readEnvelopes(entryDirectory, "generation-"),
        repositoryBindingId,
        queueId,
        projectId,
      );
      const currentEnvelope = historyEntries?.at(-1);
      const current = currentEnvelope?.content;
      if (!currentEnvelope || !current)
        return blocked("project_runtime_lease_recovery_state_mismatch");
      const identity = leaseIdentity(
        repositoryBindingId,
        projectId,
        queueId,
        "project-operation",
      );
      const locks = lockRoot(runtime);
      const lock = path.join(locks, `${identity}.lock`);
      const recoveryMarker = path.join(locks, `${identity}.release-unknown`);
      const acquisitionMarker = path.join(locks, `${identity}.acquire-pending`);
      const lockOwnershipMarker = path.join(
        locks,
        `${identity}.acquire-lock-owned`,
      );
      const acquisitionMarkerPresent = fs.existsSync(acquisitionMarker);
      if (current.ownerGeneration === null) {
        if (current.state !== "queued")
          return blocked("project_runtime_lease_recovery_state_mismatch");
        const temporaryFiles = leaseAcquisitionTemporaryFiles(locks, identity);
        const footprintAbsent = leaseAcquisitionFootprintAbsent(
          locks,
          identity,
          Object.freeze([
            lock,
            recoveryMarker,
            acquisitionMarker,
            lockOwnershipMarker,
          ]),
        );
        if (footprintAbsent)
          return completed(
            "project_runtime_lease_acquisition_resources_absent",
            current,
          );
        if (!acquisitionMarkerPresent && temporaryFiles.length === 0)
          return blocked(
            "project_runtime_lease_acquisition_recovery_evidence_mismatch",
            true,
            recoveryId,
          );
        const recovered = reconcileUnboundLeaseAcquisition(
          runtime,
          repositoryBindingId,
          projectId,
          queueId,
          "project-operation",
          observeOwner,
          true,
        );
        if (recovered.status !== "completed") return recovered;
        if (current.resultReference === recovered.value.recoveryId) {
          fs.rmSync(acquisitionMarker);
          if (fs.existsSync(acquisitionMarker))
            throw new Error(
              "project_runtime_lease_acquisition_marker_release_unknown",
            );
          return completed(
            "project_runtime_lease_acquisition_recovered",
            current,
          );
        }
        const value: ProjectQueueEntry = Object.freeze({
          ...current,
          generation: current.generation + 1,
          resultReference: recovered.value.recoveryId,
        });
        atomicCreateAndReadBack(
          entryDirectory,
          `generation-${value.generation}.json`,
          envelope(
            "queue-entry",
            repositoryBindingId,
            projectId,
            1,
            value.generation,
            value,
          ),
        );
        fs.rmSync(acquisitionMarker);
        if (fs.existsSync(acquisitionMarker))
          throw new Error(
            "project_runtime_lease_acquisition_marker_release_unknown",
          );
        return completed("project_runtime_lease_acquisition_recovered", value);
      }
      const lockPresent = fs.existsSync(lock);
      if (lockPresent) assertDirectory(lock);
      const lockOwnershipMarkerPresent = fs.existsSync(lockOwnershipMarker);
      if (lockPresent && !lockOwnershipMarkerPresent)
        return blocked(
          "project_runtime_lease_acquisition_recovery_evidence_mismatch",
          true,
        );
      const markerPresent = fs.existsSync(recoveryMarker);
      if (acquisitionMarkerPresent) {
        const pending = readLeaseAcquisitionMarker(acquisitionMarker);
        if (
          pending.kind !== "project-operation" ||
          pending.queueId !== queueId ||
          pending.ownerGeneration !== current.ownerGeneration ||
          pending.recoveryId !==
            leaseAcquisitionRecoveryId(
              repositoryBindingId,
              projectId,
              queueId,
              "project-operation",
            )
        )
          return blocked(
            "project_runtime_lease_acquisition_recovery_evidence_mismatch",
            true,
          );
      }
      if (
        markerPresent &&
        fs.readFileSync(recoveryMarker, "utf8") !==
          `${current.ownerGeneration}\n`
      )
        return blocked(
          "project_runtime_lease_recovery_evidence_mismatch",
          true,
        );
      const evidence = leaseEvidenceRoot(runtime);
      const leaseEvidence = readExactLeaseEvidence(evidence, {
        repositoryBindingId,
        projectId,
        queueId,
        kind: "project-operation",
        identity,
        ownerGeneration: current.ownerGeneration,
      });
      const acquiredContent = leaseEvidence.acquired.content;
      if (lockOwnershipMarkerPresent) {
        const ownership = readLeaseAcquisitionMarker(lockOwnershipMarker);
        if (
          ownership.kind !== "project-operation" ||
          ownership.queueId !== queueId ||
          ownership.ownerGeneration !== current.ownerGeneration ||
          ownership.ownerProcessId !== acquiredContent.ownerProcessId ||
          ownership.recoveryId !==
            leaseAcquisitionRecoveryId(
              repositoryBindingId,
              projectId,
              queueId,
              "project-operation",
            )
        )
          return blocked(
            "project_runtime_lease_acquisition_recovery_evidence_mismatch",
            true,
          );
      }
      if (acquisitionMarkerPresent) {
        const pending = readLeaseAcquisitionMarker(acquisitionMarker);
        if (pending.ownerProcessId !== acquiredContent.ownerProcessId)
          return blocked(
            "project_runtime_lease_acquisition_recovery_evidence_mismatch",
            true,
          );
      }
      if (leaseEvidence.released) {
        if (lockPresent)
          return blocked(
            "project_runtime_lease_recovery_evidence_mismatch",
            true,
          );
        if (markerPresent) fs.rmSync(recoveryMarker);
        if (lockOwnershipMarkerPresent) fs.rmSync(lockOwnershipMarker);
        if (acquisitionMarkerPresent) fs.rmSync(acquisitionMarker);
        if (fs.existsSync(recoveryMarker))
          throw new Error(
            "project_runtime_lease_recovery_marker_release_unknown",
          );
        if (fs.existsSync(acquisitionMarker))
          throw new Error(
            "project_runtime_lease_acquisition_marker_release_unknown",
          );
        if (fs.existsSync(lockOwnershipMarker))
          throw new Error(
            "project_runtime_lease_lock_ownership_marker_release_unknown",
          );
        const value: ProjectQueueEntry = Object.freeze({
          ...current,
          state:
            current.state === "leased" || current.state === "running"
              ? "recovery_required"
              : current.state,
          generation: current.generation + 1,
          ownerGeneration: null,
          resumeCondition:
            current.state === "leased" || current.state === "running"
              ? "owner_loss"
              : current.resumeCondition,
          resultReference:
            current.state === "leased" || current.state === "running"
              ? `lease-recovery-${digest(
                  `${projectId}\0${queueId}\0${current.ownerGeneration}`,
                ).slice(0, 40)}`
              : current.resultReference,
        });
        atomicCreateAndReadBack(
          entryDirectory,
          `generation-${value.generation}.json`,
          envelope(
            "queue-entry",
            repositoryBindingId,
            projectId,
            1,
            value.generation,
            value,
          ),
        );
        return completed("project_runtime_lease_release_reconciled", value);
      }
      if (leaseEvidence.recovered) {
        if (lockPresent || markerPresent)
          return blocked(
            "project_runtime_lease_recovery_evidence_mismatch",
            true,
          );
        if (acquisitionMarkerPresent) fs.rmSync(acquisitionMarker);
        if (lockOwnershipMarkerPresent) fs.rmSync(lockOwnershipMarker);
        if (fs.existsSync(acquisitionMarker))
          throw new Error(
            "project_runtime_lease_acquisition_marker_release_unknown",
          );
        if (fs.existsSync(lockOwnershipMarker))
          throw new Error(
            "project_runtime_lease_lock_ownership_marker_release_unknown",
          );
        const value: ProjectQueueEntry = Object.freeze({
          ...current,
          state: "recovery_required",
          generation: current.generation + 1,
          ownerGeneration: null,
          resumeCondition: "owner_loss",
          resultReference: `lease-recovery-${digest(
            `${projectId}\0${queueId}\0${current.ownerGeneration}`,
          ).slice(0, 40)}`,
        });
        atomicCreateAndReadBack(
          entryDirectory,
          `generation-${value.generation}.json`,
          envelope(
            "queue-entry",
            repositoryBindingId,
            projectId,
            1,
            value.generation,
            value,
          ),
        );
        return completed("project_runtime_lease_owner_loss_reconciled", value);
      }
      let rawObservation: unknown;
      try {
        rawObservation = observeOwner(
          Object.freeze({
            ownerProcessId: acquiredContent.ownerProcessId,
            ownerGeneration: current.ownerGeneration,
          }),
        );
      } catch {
        return blocked("project_runtime_lease_owner_observation_unknown", true);
      }
      if (
        !plainObject(rawObservation) ||
        !exactKeys(rawObservation, [
          "status",
          "ownerProcessId",
          "ownerGeneration",
        ]) ||
        rawObservation.ownerProcessId !== acquiredContent.ownerProcessId ||
        rawObservation.ownerGeneration !== current.ownerGeneration
      )
        return blocked("project_runtime_lease_owner_observation_unknown", true);
      if (rawObservation.status === "alive")
        return blocked("project_runtime_lease_owner_still_active");
      if (rawObservation.status !== "absent")
        return blocked("project_runtime_lease_owner_observation_unknown", true);

      if (!lockPresent && !markerPresent)
        return blocked("project_runtime_lease_owner_resource_unknown", true);
      if (!markerPresent) {
        const markerDescriptor = fs.openSync(
          recoveryMarker,
          fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
          0o600,
        );
        try {
          fs.writeFileSync(
            markerDescriptor,
            `${current.ownerGeneration}\n`,
            "utf8",
          );
          fs.fsyncSync(markerDescriptor);
        } finally {
          fs.closeSync(markerDescriptor);
        }
      }
      if (lockPresent) fs.rmdirSync(lock);
      if (fs.existsSync(lock))
        throw new Error("project_runtime_lease_lock_release_unknown");
      const recoveredName = `${identity}-${current.ownerGeneration}-recovered.json`;
      if (!leaseEvidence.recovered)
        atomicCreateAndReadBack(
          evidence,
          recoveredName,
          envelope("lease-evidence", repositoryBindingId, projectId, 1, 2, {
            kind: "project-operation",
            queueId,
            ownerGeneration: current.ownerGeneration,
            ownerProcessId: acquiredContent.ownerProcessId,
            disposition: "recovered_after_owner_loss",
          }),
        );
      const recoveredEvidence = readExactLeaseEvidence(evidence, {
        repositoryBindingId,
        projectId,
        queueId,
        kind: "project-operation",
        identity,
        ownerGeneration: current.ownerGeneration,
      });
      if (!recoveredEvidence.recovered || recoveredEvidence.released)
        throw new Error("project_runtime_lease_recovery_evidence_mismatch");
      fs.rmSync(recoveryMarker);
      if (fs.existsSync(recoveryMarker))
        throw new Error(
          "project_runtime_lease_recovery_marker_release_unknown",
        );
      if (acquisitionMarkerPresent) fs.rmSync(acquisitionMarker);
      if (lockOwnershipMarkerPresent) fs.rmSync(lockOwnershipMarker);
      if (fs.existsSync(acquisitionMarker))
        throw new Error(
          "project_runtime_lease_acquisition_marker_release_unknown",
        );
      if (fs.existsSync(lockOwnershipMarker))
        throw new Error(
          "project_runtime_lease_lock_ownership_marker_release_unknown",
        );
      const value: ProjectQueueEntry = Object.freeze({
        ...current,
        state: "recovery_required",
        generation: current.generation + 1,
        ownerGeneration: null,
        resumeCondition: "owner_loss",
        resultReference: `lease-recovery-${digest(
          `${projectId}\0${queueId}\0${current.ownerGeneration}`,
        ).slice(0, 40)}`,
      });
      atomicCreateAndReadBack(
        entryDirectory,
        `generation-${value.generation}.json`,
        envelope(
          "queue-entry",
          repositoryBindingId,
          projectId,
          1,
          value.generation,
          value,
        ),
      );
      return completed("project_runtime_lease_owner_loss_reconciled", value);
    });
  } catch {
    return blocked(
      "project_runtime_lease_recovery_observation_unknown",
      true,
      recoveryId,
    );
  }
}

/**
 * Bind repository-local infrastructure once at the composition root. Project
 *
 * @responsibility createProjectRuntimePersistencePortsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: string、repositoryBindingId: string
 * @returns ProjectRuntimePersistencePortsを返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string」がcreateProjectRuntimePersistencePortsの入力契約を満たす。
 * @postcondition createProjectRuntimePersistencePortsの責務を完了した結果だけを返す。
 * @effect N/A: createProjectRuntimePersistencePortsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createProjectRuntimePersistencePortsは独自の失敗分岐を所有しない。
 * @invariant createProjectRuntimePersistencePortsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createProjectRuntimePersistencePortsはProcess内の同一Subsystemで完結する。
 * @security createProjectRuntimePersistencePortsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProjectRuntimePersistencePortsは共有非同期状態を持たない同期処理である。
 */
export function createProjectRuntimePersistencePorts(
  workingDirectory: string,
  repositoryBindingId: string,
): ProjectRuntimePersistencePorts {
  const statePort: ProjectRuntimeStatePort = Object.freeze({
    writeState: (state, expectedGeneration) =>
      writeProjectRuntimeState(
        workingDirectory,
        repositoryBindingId,
        state,
        expectedGeneration,
      ),
    readState: (projectId) =>
      readProjectRuntimeState(workingDirectory, repositoryBindingId, projectId),
    enqueueOperation: (input) =>
      enqueueProjectOperation(workingDirectory, repositoryBindingId, input),
    readQueue: (queueId) =>
      readProjectOperationQueueState(
        workingDirectory,
        repositoryBindingId,
        queueId,
      ),
    selectNextOperation: () =>
      selectNextProjectOperation(workingDirectory, repositoryBindingId),
    updateQueue: (queueId, expectedGeneration, next) =>
      updateProjectOperationQueueState(
        workingDirectory,
        repositoryBindingId,
        queueId,
        expectedGeneration,
        next,
      ),
    settleQueueRecovery: (queueId, expectedGeneration, recoveryId) =>
      settleProjectOperationQueueRecovery(
        workingDirectory,
        repositoryBindingId,
        queueId,
        expectedGeneration,
        recoveryId,
      ),
    settleQueueLeaseRelease: (queueId, expectedGeneration, ownerGeneration) =>
      settleProjectOperationQueueLeaseRelease(
        workingDirectory,
        repositoryBindingId,
        queueId,
        expectedGeneration,
        ownerGeneration,
      ),
  });
  const leasePort: ProjectRuntimeLeasePort = Object.freeze({
    acquire: (projectId, queueId, kind) =>
      acquireProjectRuntimeLease(
        workingDirectory,
        repositoryBindingId,
        projectId,
        queueId,
        kind,
      ),
    inspectAcquisitionOwner: () =>
      inspectProjectRuntimeLeaseAcquisitionOwner(
        workingDirectory,
        repositoryBindingId,
      ),
    reconcileOperationOwnerLoss: (
      projectId,
      queueId,
      observeOwner: ProjectRuntimeLeaseOwnerObservation,
    ) =>
      reconcileProjectRuntimeLeaseOwnerLoss(
        workingDirectory,
        repositoryBindingId,
        projectId,
        queueId,
        observeOwner,
      ),
    reconcileAdoptionOwnerLoss: (
      projectId,
      observeOwner: ProjectRuntimeLeaseOwnerObservation,
    ) =>
      reconcileCanonicalAdoptionLeaseAcquisitionOwnerLoss(
        workingDirectory,
        repositoryBindingId,
        projectId,
        observeOwner,
      ),
  });
  return Object.freeze({
    state: statePort,
    lease: leasePort,
  });
}

/**
 * describeProjectRuntimeDurableFoundationの処理を実行する。
 *
 * @responsibility describeProjectRuntimeDurableFoundationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProjectRuntimeDurableFoundationの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProjectRuntimeDurableFoundationの入力契約を満たす。
 * @postcondition describeProjectRuntimeDurableFoundationの責務を完了した結果だけを返す。
 * @effect N/A: describeProjectRuntimeDurableFoundationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProjectRuntimeDurableFoundationは独自の失敗分岐を所有しない。
 * @invariant describeProjectRuntimeDurableFoundationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProjectRuntimeDurableFoundationはProcess内の同一Subsystemで完結する。
 * @security describeProjectRuntimeDurableFoundationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProjectRuntimeDurableFoundationは共有非同期状態を持たない同期処理である。
 */
export function describeProjectRuntimeDurableFoundation() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_DURABLE_FOUNDATION_CONTRACT,
    recordStrategy:
      "immutable_generation_records_with_fsynced_create_and_exact_readback",
    queueMutation: "short_exclusive_repository_local_lock",
    operationLease:
      "exclusive_lock_with_owner_generation_and_no_stale_takeover",
    adoptionLease: "separate_exclusive_lock_with_no_stale_takeover",
    staleLockDisposition: "blocked_manual_reconciliation_required_before_reuse",
    externalWaitWhileMutationLockHeld: false,
    upperProjectRuntimeCapabilityComplete: false,
  });
}
