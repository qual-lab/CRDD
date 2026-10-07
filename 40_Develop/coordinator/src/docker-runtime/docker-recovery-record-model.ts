/**
 * Docker回復の記録内容を物理保存配置から分離して検証する。
 *
 * @responsibility 基本情報・Host結合・有限checkpointの構造検証を所有し、File操作とAuthority発行を行わない。
 * @trace ARCH-000008
 */

import { parseDockerRestartContinuationRecord } from "../docker-desktop/docker-restart-continuation-record.ts";
import { parseDockerRestartHandoffRecord } from "../docker-desktop/docker-restart-handoff-record.ts";
import { parseDockerRestartRecord } from "../docker-desktop/docker-restart-record.ts";
import { parseHostRecoveryToken } from "../host-runtime/host-recovery-record.ts";

const HEX64 = /^[a-f0-9]{64}$/u;
const SAFE_RESOURCE =
  /^crdd-(?:auth|internal|egress|proxy|claude|codex)-[a-f0-9]{16}$/u;
const CREATE_PURPOSES = new Set([
  "create_subscription_auth_probe",
  "create_internal_network",
  "create_egress_network",
  "create_proxy",
  "create_provider",
]);

/**
 * docker-recovery-runtime-internalで使用するRuntime 状態 Binding Evidenceの値契約を定義する。
 *
 * @responsibility Runtime 状態 Binding EvidenceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeStateBindingEvidenceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateBindingEvidenceで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateBindingEvidenceの宣言は外部境界を開かない。
 * @security RuntimeStateBindingEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateBindingEvidenceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RuntimeStateBindingEvidence = Readonly<{
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
  runtimeStateBindingHash: string;
}>;

/**
 * canonicalを決定する。
 *
 * @responsibility canonicalの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns canonicalの計算結果を返す。
 * @precondition 「value: unknown」がcanonicalの入力契約を満たす。
 * @postcondition canonicalの責務を完了した結果だけを返す。
 * @effect N/A: canonicalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalは独自の失敗分岐を所有しない。
 * @invariant canonicalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalはProcess内の同一Subsystemで完結する。
 * @security canonicalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalは共有非同期状態を持たない同期処理である。
 */
export function canonical(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

/**
 * Runtime 状態 Binding Evidenceが有効か判定する。
 *
 * @responsibility Runtime 状態 Binding Evidenceの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is RuntimeStateBindingEvidenceを返す。
 * @precondition 「value: unknown」がvalidRuntimeStateBindingEvidenceの入力契約を満たす。
 * @postcondition validRuntimeStateBindingEvidenceの責務を完了した結果だけを返す。
 * @effect N/A: validRuntimeStateBindingEvidenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRuntimeStateBindingEvidenceは独自の失敗分岐を所有しない。
 * @invariant validRuntimeStateBindingEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRuntimeStateBindingEvidenceはProcess内の同一Subsystemで完結する。
 * @security validRuntimeStateBindingEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validRuntimeStateBindingEvidenceは共有非同期状態を持たない同期処理である。
 */
export function validRuntimeStateBindingEvidence(
  value: unknown,
): value is RuntimeStateBindingEvidence {
  return (
    exactRecordKeys(value, [
      "runtimeStateIdentityHash",
      "runtimeStateProtectionHash",
      "localUserBindingHash",
      "runtimeStateBindingHash",
    ]) &&
    Object.values(value as Record<string, unknown>).every(
      (item) => typeof item === "string" && HEX64.test(item),
    )
  );
}

/**
 * 記録 Keysが完全一致するか判定する。
 *
 * @responsibility 記録 Keysの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、keys: readonly string[]
 * @returns exactRecordKeysの計算結果を返す。
 * @precondition 「value: unknown、keys: readonly string[]」がexactRecordKeysの入力契約を満たす。
 * @postcondition exactRecordKeysの責務を完了した結果だけを返す。
 * @effect N/A: exactRecordKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactRecordKeysは独自の失敗分岐を所有しない。
 * @invariant exactRecordKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactRecordKeysはProcess内の同一Subsystemで完結する。
 * @security exactRecordKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactRecordKeysは共有非同期状態を持たない同期処理である。
 */
export function exactRecordKeys(value: unknown, keys: readonly string[]) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value as Record<string, unknown>)
      .sort()
      .join("\0") === [...keys].sort().join("\0")
  );
}

/**
 * Host Snapshotの契約を検証する。
 *
 * @responsibility Host Snapshotの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、initialToken: string
 * @returns validateHostSnapshotの計算結果を返す。
 * @precondition 「value: unknown、initialToken: string」がvalidateHostSnapshotの入力契約を満たす。
 * @postcondition validateHostSnapshotの責務を完了した結果だけを返す。
 * @effect N/A: validateHostSnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateHostSnapshotは独自の失敗分岐を所有しない。
 * @invariant validateHostSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateHostSnapshotはProcess内の同一Subsystemで完結する。
 * @security validateHostSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateHostSnapshotは共有非同期状態を持たない同期処理である。
 */
export function validateHostSnapshot(value: unknown, initialToken: string) {
  if (
    !exactRecordKeys(value, [
      "token",
      "recordHash",
      "directoryIdentity",
      "markerIdentity",
      "record",
    ])
  )
    return false;
  const snapshot = value as Record<string, unknown>;
  const parsed = parseHostRecoveryToken(initialToken);
  const record = snapshot.record;
  const hostRecord = record as Record<string, unknown>;
  const rootIdentity = hostRecord?.rootIdentity;
  const childIdentities = hostRecord?.childIdentities;
  const identityValid = (identity: unknown, isChild: boolean) =>
    exactRecordKeys(
      identity,
      isChild
        ? ["pathName", "dev", "ino", "birthtimeNs"]
        : ["dev", "ino", "birthtimeNs"],
    ) &&
    ["dev", "ino", "birthtimeNs"].every(
      (key) =>
        typeof (identity as Record<string, unknown>)[key] === "string" &&
        /^\d+$/u.test(String((identity as Record<string, unknown>)[key])),
    ) &&
    (!isChild ||
      (typeof (identity as Record<string, unknown>).pathName === "string" &&
        /^[A-Za-z0-9_-]{1,80}$/u.test(
          String((identity as Record<string, unknown>).pathName),
        )));
  return (
    snapshot.token === initialToken &&
    snapshot.recordHash === parsed.recordHash &&
    typeof snapshot.directoryIdentity === "string" &&
    /^\d+:\d+:\d+$/u.test(snapshot.directoryIdentity) &&
    typeof snapshot.markerIdentity === "string" &&
    /^\d+:\d+:\d+$/u.test(snapshot.markerIdentity) &&
    exactRecordKeys(record, [
      "schema",
      "state",
      "rootName",
      "rootIdentity",
      "childIdentities",
      "createdAt",
    ]) &&
    hostRecord.schema === "crdd-coordinator-host-recovery/v1" &&
    hostRecord.rootName === parsed.rootName &&
    ["host_only", "docker_submission_started"].includes(
      String(hostRecord.state),
    ) &&
    typeof hostRecord.createdAt === "string" &&
    identityValid(rootIdentity, false) &&
    childIdentities !== null &&
    typeof childIdentities === "object" &&
    !Array.isArray(childIdentities) &&
    Object.keys(childIdentities as Record<string, unknown>).length <= 8 &&
    Object.values(childIdentities as Record<string, unknown>).every(
      (identity) => identityValid(identity, true),
    ) &&
    Object.hasOwn(childIdentities as Record<string, unknown>, "management")
  );
}

/**
 * Docker 回復 Baseの契約を検証する。
 *
 * @responsibility Docker 回復 Baseの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、nonce: string
 * @returns validateDockerRecoveryBaseの計算結果を返す。
 * @precondition 「value: unknown、nonce: string」がvalidateDockerRecoveryBaseの入力契約を満たす。
 * @postcondition validateDockerRecoveryBaseの責務を完了した結果だけを返す。
 * @effect N/A: validateDockerRecoveryBaseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validateDockerRecoveryBaseは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateDockerRecoveryBaseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateDockerRecoveryBaseはProcess内の同一Subsystemで完結する。
 * @security validateDockerRecoveryBaseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateDockerRecoveryBaseは共有非同期状態を持たない同期処理である。
 */
export function validateDockerRecoveryBase(value: unknown, nonce: string) {
  const record = value as Record<string, unknown>;
  const baseKeys = [
    "schema",
    "operationNonce",
    "provider",
    "operationId",
    "grantRef",
    "profileId",
    "stableLogicalHomeBindingHash",
    "providerHomeIdentityHash",
    "providerHomeProtectionHash",
    "localUserBindingHash",
    "runtimeStateBinding",
    "ownershipLabel",
    "resources",
    "images",
    "operationMode",
    "workspaceMountMode",
    "initialHostRecoveryId",
    "initialHostRecovery",
    "hostPaths",
  ];
  const hasCorrelation = Object.hasOwn(record ?? {}, "recoveryCorrelationId");
  if (
    !exactRecordKeys(
      value,
      hasCorrelation ? [...baseKeys, "recoveryCorrelationId"] : baseKeys,
    )
  )
    return false;
  const base = value as Record<string, unknown>;
  const resources = base.resources;
  const images = base.images;
  const hostPaths = base.hostPaths;
  const runtimeStateBinding = base.runtimeStateBinding;
  const initialToken = String(base.initialHostRecoveryId ?? "");
  try {
    parseHostRecoveryToken(initialToken);
  } catch {
    return false;
  }
  return (
    base.schema === "crdd-coordinator-task-docker-recovery/v1" &&
    base.operationNonce === nonce &&
    (base.provider === "codex" || base.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(String(base.operationId ?? "")) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(String(base.grantRef ?? "")) &&
    /^PROFILE-[0-9]{6,}$/u.test(String(base.profileId ?? "")) &&
    [
      base.stableLogicalHomeBindingHash,
      base.providerHomeIdentityHash,
      base.providerHomeProtectionHash,
      base.localUserBindingHash,
    ].every((item) => typeof item === "string" && HEX64.test(item)) &&
    validRuntimeStateBindingEvidence(runtimeStateBinding) &&
    (runtimeStateBinding as RuntimeStateBindingEvidence)
      .localUserBindingHash === base.localUserBindingHash &&
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(
      String(base.ownershipLabel ?? ""),
    ) &&
    exactRecordKeys(resources, [
      "auth",
      "provider",
      "proxy",
      "internal",
      "egress",
    ]) &&
    Object.values(resources as Record<string, unknown>).every(
      (item) => typeof item === "string" && SAFE_RESOURCE.test(item),
    ) &&
    exactRecordKeys(images, ["provider", "proxy"]) &&
    Object.values(images as Record<string, unknown>).every(
      (item) => typeof item === "string" && /^sha256:[a-f0-9]{64}$/u.test(item),
    ) &&
    (base.operationMode === "boolean_probe" ||
      base.operationMode === "isolated_task" ||
      base.operationMode === "workbench_advice") &&
    (base.workspaceMountMode === null ||
      base.workspaceMountMode === "read_only" ||
      base.workspaceMountMode === "read_write") &&
    (!hasCorrelation ||
      (typeof base.recoveryCorrelationId === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
          base.recoveryCorrelationId,
        ))) &&
    validateHostSnapshot(base.initialHostRecovery, initialToken) &&
    exactRecordKeys(hostPaths, ["root", "marker"]) &&
    typeof (hostPaths as Record<string, unknown>).root === "string" &&
    typeof (hostPaths as Record<string, unknown>).marker === "string"
  );
}

/**
 * Docker 回復 Base Commitの契約を検証する。
 *
 * @responsibility Docker 回復 Base Commitの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、nonce: string、baseHash: string、recoveryId: string
 * @returns validateDockerRecoveryBaseCommitの計算結果を返す。
 * @precondition 「value: unknown、nonce: string、baseHash: string、recoveryId: string」がvalidateDockerRecoveryBaseCommitの入力契約を満たす。
 * @postcondition validateDockerRecoveryBaseCommitの責務を完了した結果だけを返す。
 * @effect N/A: validateDockerRecoveryBaseCommitは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateDockerRecoveryBaseCommitは独自の失敗分岐を所有しない。
 * @invariant validateDockerRecoveryBaseCommitは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateDockerRecoveryBaseCommitはProcess内の同一Subsystemで完結する。
 * @security validateDockerRecoveryBaseCommitはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateDockerRecoveryBaseCommitは共有非同期状態を持たない同期処理である。
 */
export function validateDockerRecoveryBaseCommit(
  value: unknown,
  nonce: string,
  baseHash: string,
  recoveryId: string,
) {
  const record = value as Record<string, unknown>;
  const keys = [
    "schema",
    "operationNonce",
    "stableLogicalHomeBindingHash",
    "baseHash",
    "recoveryId",
  ];
  const hasCorrelation = Object.hasOwn(record ?? {}, "recoveryCorrelationId");
  return (
    exactRecordKeys(
      value,
      hasCorrelation ? [...keys, "recoveryCorrelationId"] : keys,
    ) &&
    record.schema === "crdd-coordinator-task-docker-base-commit/v1" &&
    record.operationNonce === nonce &&
    record.baseHash === baseHash &&
    record.recoveryId === recoveryId &&
    (!hasCorrelation ||
      (typeof record.recoveryCorrelationId === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
          record.recoveryCorrelationId,
        )))
  );
}

/**
 * Operation 記録の契約を検証する。
 *
 * @responsibility Operation 記録の必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input name: string、value: unknown、recoveryId: string、nonce: string、baseHash: string
 * @returns validateOperationRecordの計算結果を返す。
 * @precondition 「name: string、value: unknown、recoveryId: string、nonce: string、baseHash: string」がvalidateOperationRecordの入力契約を満たす。
 * @postcondition validateOperationRecordの責務を完了した結果だけを返す。
 * @effect N/A: validateOperationRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateOperationRecordは独自の失敗分岐を所有しない。
 * @invariant validateOperationRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateOperationRecordはProcess内の同一Subsystemで完結する。
 * @security validateOperationRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateOperationRecordは共有非同期状態を持たない同期処理である。
 */
export function validateOperationRecord(
  name: string,
  value: unknown,
  recoveryId: string,
  nonce: string,
  baseHash: string,
) {
  if (/^engine-handoff-0[0-7]\.json$/u.test(name)) {
    const record = parseDockerRestartHandoffRecord(
      Buffer.from(canonical(value)),
    );
    return (
      record !== null &&
      name === `engine-handoff-${String(record.sequence).padStart(2, "0")}.json`
    );
  }
  if (/^engine-continuation-0[0-4]\.json$/u.test(name)) {
    const record = parseDockerRestartContinuationRecord(
      Buffer.from(canonical(value)),
    )?.record;
    return (
      record !== undefined &&
      record.recoveryId === recoveryId &&
      record.operationNonce === nonce &&
      name ===
        `engine-continuation-${String(record.sequence).padStart(2, "0")}.json`
    );
  }
  if (/^engine-restart-0[0-4]\.json$/u.test(name)) {
    const restart = parseDockerRestartRecord(Buffer.from(canonical(value)));
    return (
      restart !== null &&
      restart.recoveryId === recoveryId &&
      restart.operationNonce === nonce &&
      name ===
        `engine-restart-${String(restart.sequence).padStart(2, "0")}.json`
    );
  }
  if (name === "base.json") return validateDockerRecoveryBase(value, nonce);
  if (name === "base-commit.json")
    return validateDockerRecoveryBaseCommit(value, nonce, baseHash, recoveryId);
  if (/^submission-/u.test(name))
    return (
      exactRecordKeys(value, ["schema", "purpose", "recoveryId"]) &&
      (value as Record<string, unknown>).schema ===
        "crdd-coordinator-docker-resource-submission/v1" &&
      (value as Record<string, unknown>).recoveryId === recoveryId &&
      CREATE_PURPOSES.has(String((value as Record<string, unknown>).purpose)) &&
      name ===
        `submission-${String((value as Record<string, unknown>).purpose)}.json`
    );
  if (/^receipt-/u.test(name)) {
    const record = value as Record<string, unknown>;
    const commonMatches =
      record.recoveryId === recoveryId &&
      CREATE_PURPOSES.has(String(record.purpose)) &&
      name === `receipt-${String(record.purpose)}.json` &&
      HEX64.test(String(record.dockerId));
    const legacyMatches =
      exactRecordKeys(value, ["schema", "purpose", "dockerId", "recoveryId"]) &&
      record.schema === "crdd-coordinator-docker-resource-receipt/v1";
    const currentMatches =
      exactRecordKeys(value, [
        "schema",
        "purpose",
        "dockerId",
        "recoveryId",
        "source",
      ]) &&
      record.schema === "crdd-coordinator-docker-resource-receipt/v2" &&
      ["docker_create_result", "runtime_reconciliation"].includes(
        String(record.source),
      );
    return commonMatches && (legacyMatches || currentMatches);
  }
  if (
    /^restart-fence-/u.test(name) &&
    (value as Record<string, unknown>)?.schema ===
      "crdd-coordinator-docker-engine-restart-fence/v2"
  ) {
    const record = value as Record<string, unknown>;
    return (
      exactRecordKeys(record, [
        "schema",
        "purpose",
        "recoveryId",
        "origin",
        "restartRecordSha256",
        "pendingSubmissionSha256",
        "exactResourceAbsent",
      ]) &&
      record.recoveryId === recoveryId &&
      record.origin === "engine_restart" &&
      HEX64.test(String(record.restartRecordSha256)) &&
      HEX64.test(String(record.pendingSubmissionSha256)) &&
      record.exactResourceAbsent === true &&
      CREATE_PURPOSES.has(String(record.purpose)) &&
      name === `restart-fence-${String(record.purpose)}.json`
    );
  }
  if (/^restart-fence-/u.test(name))
    return (
      exactRecordKeys(value, [
        "schema",
        "purpose",
        "recoveryId",
        "repairId",
        "repairRecordSha256",
        "exactResourceAbsent",
      ]) &&
      (value as Record<string, unknown>).schema ===
        "crdd-coordinator-docker-engine-restart-fence/v1" &&
      (value as Record<string, unknown>).recoveryId === recoveryId &&
      /^docker-desktop-repair\.[a-f0-9]{32}$/u.test(
        String((value as Record<string, unknown>).repairId),
      ) &&
      HEX64.test(
        String((value as Record<string, unknown>).repairRecordSha256),
      ) &&
      (value as Record<string, unknown>).exactResourceAbsent === true &&
      CREATE_PURPOSES.has(String((value as Record<string, unknown>).purpose)) &&
      name ===
        `restart-fence-${String((value as Record<string, unknown>).purpose)}.json`
    );
  const record = value as Record<string, unknown>;
  if (name === "docker-absence.json")
    return (
      exactRecordKeys(value, [
        "schema",
        "recoveryId",
        "allExactResourcesAbsent",
      ]) &&
      record.schema === "crdd-coordinator-docker-absence/v1" &&
      record.recoveryId === recoveryId &&
      record.allExactResourcesAbsent === true
    );
  if (name === "docker-absence-crash.json")
    return (
      exactRecordKeys(value, [
        "schema",
        "recoveryId",
        "allExactResourcesAbsent",
        "evidence",
      ]) &&
      record.schema === "crdd-coordinator-docker-absence/v1" &&
      record.recoveryId === recoveryId &&
      record.allExactResourcesAbsent === true &&
      record.evidence === "crash_recovery_exact_id_and_configuration"
    );
  if (name === "mount-completion.json" || name === "mount-crash-absence.json")
    return (
      exactRecordKeys(value, ["schema", "recoveryId", "evidence"]) &&
      record.schema === "crdd-coordinator-provider-home-mount-completion/v1" &&
      record.recoveryId === recoveryId &&
      record.evidence ===
        (name === "mount-completion.json"
          ? "process_local_capability_completed"
          : "process_generation_absent_plus_exact_docker_absent")
    );
  if (/^host-(?:begin|complete|crash-absence)-intent\.json$/u.test(name))
    return (
      exactRecordKeys(value, [
        "currentToken",
        "expectedToken",
        "rootName",
        "nonce",
        "currentState",
        "nextState",
        "recordBefore",
      ]) &&
      typeof record.currentToken === "string" &&
      typeof record.expectedToken === "string" &&
      typeof record.rootName === "string" &&
      typeof record.nonce === "string" &&
      record.recordBefore !== null &&
      typeof record.recordBefore === "object" &&
      !Array.isArray(record.recordBefore)
    );
  if (/^host-(?:begin|complete|crash-absence)-receipt\.json$/u.test(name))
    return (
      exactRecordKeys(value, ["previous", "observed"]) &&
      typeof record.previous === "string" &&
      typeof record.observed === "string"
    );
  if (name === "host-cleanup-intent.json")
    return (
      exactRecordKeys(value, [
        "schema",
        "recoveryId",
        "currentHostRecoveryId",
      ]) &&
      record.schema === "crdd-coordinator-host-cleanup-intent/v1" &&
      record.recoveryId === recoveryId &&
      typeof record.currentHostRecoveryId === "string"
    );
  if (name === "host-precleanup-finalization-intent.json")
    return (
      exactRecordKeys(value, [
        "schema",
        "recoveryId",
        "operationNonce",
        "baseHash",
        "stableLogicalHomeBindingHash",
        "initialHostRecoveryId",
        "hostRootAbsent",
        "hostMarkerAbsent",
        "submissionAbsent",
      ]) &&
      record.schema ===
        "crdd-coordinator-host-precleanup-finalization-intent/v1" &&
      record.recoveryId === recoveryId &&
      record.operationNonce === nonce &&
      record.baseHash === baseHash &&
      typeof record.stableLogicalHomeBindingHash === "string" &&
      HEX64.test(String(record.stableLogicalHomeBindingHash)) &&
      typeof record.initialHostRecoveryId === "string" &&
      record.hostRootAbsent === true &&
      record.hostMarkerAbsent === true &&
      record.submissionAbsent === true
    );
  if (name === "host-cleanup-receipt.json")
    return (
      exactRecordKeys(value, [
        "schema",
        "recoveryId",
        "hostRootAbsent",
        "hostMarkerAbsent",
      ]) &&
      record.schema === "crdd-coordinator-host-cleanup-receipt/v1" &&
      record.recoveryId === recoveryId &&
      record.hostRootAbsent === true &&
      record.hostMarkerAbsent === true
    );
  if (name === "lease-release-receipt.json")
    return (
      exactRecordKeys(value, ["schema", "recoveryId", "pointerAbsent"]) &&
      record.schema === "crdd-coordinator-provider-home-lease-release/v1" &&
      record.recoveryId === recoveryId &&
      record.pointerAbsent === true
    );
  if (name === "normal-run-complete.json")
    return (
      exactRecordKeys(value, ["schema", "recoveryId", "hostSuccessor"]) &&
      record.schema === "crdd-coordinator-docker-run-completion/v1" &&
      record.recoveryId === recoveryId &&
      typeof record.hostSuccessor === "string"
    );
  return false;
}
