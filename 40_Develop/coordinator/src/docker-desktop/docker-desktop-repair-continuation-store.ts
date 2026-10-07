/**
 * docker-desktop-repair-continuation-storeに属する責務をまとめる。
 *
 * @responsibility DockerDesktopRepairContinuationActionを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  type DockerDesktopRepairDirectoryIdentity,
  type DockerDesktopRepairEffectConfirmation,
  type DockerDesktopRepairOperation,
  type DockerDesktopRepairRecordBoundary,
  isDockerDesktopRepairContinuationAuthorityVerified,
} from "./docker-desktop-repair-record-store.ts";

export const DOCKER_DESKTOP_REPAIR_CONTINUATION_DIRECTORY =
  "runtime-continuation";
export const DOCKER_DESKTOP_REPAIR_CONTINUATION_SCHEMA =
  "crdd-coordinator/docker-desktop-repair-continuation/v1";

export const DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS = Object.freeze([
  "failed_launch_process_stop",
  "failed_launch_run_directory_rename",
  "secrets_engine_directory_rename",
  "desktop_relaunch",
] as const);
const LEGACY_DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS = Object.freeze([
  "failed_launch_run_directory_rename",
  "secrets_engine_directory_rename",
  "desktop_relaunch",
] as const);
/**
 * docker-desktop-repair-continuation-storeで使用するDocker Desktop Repair Continuation Actionの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Continuation ActionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairContinuationActionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairContinuationActionで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairContinuationActionの宣言は外部境界を開かない。
 * @security DockerDesktopRepairContinuationActionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairContinuationActionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairContinuationAction =
  (typeof DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS)[number];

export const DOCKER_DESKTOP_REPAIR_CONTINUATION_STAGES = Object.freeze([
  "prepared",
  "failed_launch_process_stop_intent",
  "failed_launch_process_stopped",
  "failed_run_rename_intent",
  "failed_run_renamed",
  "secrets_engine_rename_intent",
  "secrets_engine_renamed",
  "relaunch_intent",
  "relaunched",
  "recovered",
] as const);
/**
 * docker-desktop-repair-continuation-storeで使用するDocker Desktop Repair Continuation Stageの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Continuation StageのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairContinuationStageが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairContinuationStageで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairContinuationStageの宣言は外部境界を開かない。
 * @security DockerDesktopRepairContinuationStageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairContinuationStageの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairContinuationStage =
  (typeof DOCKER_DESKTOP_REPAIR_CONTINUATION_STAGES)[number];

/**
 * docker-desktop-repair-continuation-storeで使用するDocker Desktop Repair Continuation Effectの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair Continuation EffectのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairContinuationEffectが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairContinuationEffectで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairContinuationEffectの宣言は外部境界を開かない。
 * @security DockerDesktopRepairContinuationEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairContinuationEffectの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairContinuationEffect = Readonly<{
  phase: "intent_recorded" | "settled";
  issued: boolean | null;
  confirmation: DockerDesktopRepairEffectConfirmation;
}>;

/**
 * docker-desktop-repair-continuation-storeで使用するDocker Desktop Repair Continuationの値契約を定義する。
 *
 * @responsibility Docker Desktop Repair ContinuationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairContinuationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairContinuationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairContinuationの宣言は外部境界を開かない。
 * @security DockerDesktopRepairContinuationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerDesktopRepairContinuationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairContinuation = Readonly<{
  repairId: string;
  sequence: number;
  previousRecordSha256: string;
  stage: DockerDesktopRepairContinuationStage;
  operationTipSha256: string;
  operationSequence: number;
  failedRunIdentity: DockerDesktopRepairDirectoryIdentity;
  secretsEngineIdentity: DockerDesktopRepairDirectoryIdentity;
  failedRunStaleName: string;
  secretsEngineStaleName: string;
  effects: Readonly<
    Record<
      DockerDesktopRepairContinuationAction,
      DockerDesktopRepairContinuationEffect | null
    >
  >;
}>;

/**
 * docker-desktop-repair-continuation-storeで使用するStored Continuationの値契約を定義する。
 *
 * @responsibility Stored ContinuationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape StoredContinuationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StoredContinuationで宣言した値と責務の対応を維持する。
 * @boundary N/A: StoredContinuationの宣言は外部境界を開かない。
 * @security StoredContinuationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StoredContinuationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type StoredContinuation = Readonly<{
  schema: typeof DOCKER_DESKTOP_REPAIR_CONTINUATION_SCHEMA;
  contractRevision: 1;
  repairId: string;
  sequence: number;
  previousRecordSha256: string;
  stage: DockerDesktopRepairContinuationStage;
  operationTipSha256: string;
  operationSequence: number;
  failedRunIdentity: DockerDesktopRepairDirectoryIdentity;
  secretsEngineIdentity: DockerDesktopRepairDirectoryIdentity;
  failedRunStaleName: string;
  secretsEngineStaleName: string;
  runtimeStateIdentityHash: string;
  runtimeStateProtectionHash: string;
  localUserBindingHash: string;
  runtimeStateBindingHash: string;
  dockerPolicySha256: string;
  crddManifestHash: string;
  crddReleaseSequence: number;
  runtimeExecutionIdentitySha256: string;
  effects: DockerDesktopRepairContinuation["effects"];
}>;

const MAXIMUM_CONTINUATION_RECORDS = 10;
const MAXIMUM_CONTINUATION_RECORD_BYTES = 32_768;

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
 * Keysが完全一致するか判定する。
 *
 * @responsibility Keysの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: object、expectedKeys: readonly string[]
 * @returns exactKeysの計算結果を返す。
 * @precondition 「value: object、expectedKeys: readonly string[]」がexactKeysの入力契約を満たす。
 * @postcondition exactKeysの責務を完了した結果だけを返す。
 * @effect N/A: exactKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactKeysは独自の失敗分岐を所有しない。
 * @invariant exactKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security exactKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactKeysは共有非同期状態を持たない同期処理である。
 */
function exactKeys(value: object, expectedKeys: readonly string[]) {
  const actualKeys = Reflect.ownKeys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => actualKeys.includes(key))
  );
}

/**
 * ObjectをPlain Dataとして検証する。
 *
 * @responsibility Objectの許可Property、入れ子値、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がplainObjectの入力契約を満たす。
 * @postcondition plainObjectの責務を完了した結果だけを返す。
 * @effect N/A: plainObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: plainObjectは独自の失敗分岐を所有しない。
 * @invariant plainObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
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
  return (
    plainObject(value) &&
    exactKeys(value, ["dev", "ino", "birthtimeNs"]) &&
    [value.dev, value.ino, value.birthtimeNs].every(
      (item) => typeof item === "string" && /^[1-9][0-9]*$/u.test(item),
    )
  );
}

/**
 * Effectが有効か判定する。
 *
 * @responsibility Effectの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is DockerDesktopRepairContinuationEffectを返す。
 * @precondition 「value: unknown」がvalidEffectの入力契約を満たす。
 * @postcondition validEffectの責務を完了した結果だけを返す。
 * @effect N/A: validEffectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validEffectは独自の失敗分岐を所有しない。
 * @invariant validEffectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validEffectは共有非同期状態を持たない同期処理である。
 */
function validEffect(
  value: unknown,
): value is DockerDesktopRepairContinuationEffect {
  if (
    !plainObject(value) ||
    !exactKeys(value, ["phase", "issued", "confirmation"])
  )
    return false;
  if (value.phase === "intent_recorded")
    return value.issued === null && value.confirmation === "unknown";
  if (value.phase !== "settled") return false;
  return (
    [true, false, null].includes(value.issued as boolean | null) &&
    ["not_issued", "confirmed", "unknown"].includes(
      String(value.confirmation),
    ) &&
    (value.issued === false
      ? value.confirmation === "not_issued"
      : value.issued === true
        ? value.confirmation !== "not_issued"
        : value.confirmation === "unknown")
  );
}

/**
 * Effectsが有効か判定する。
 *
 * @responsibility Effectsの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is StoredContinuation["effects"]を返す。
 * @precondition 「value: unknown」がvalidEffectsの入力契約を満たす。
 * @postcondition validEffectsの責務を完了した結果だけを返す。
 * @effect N/A: validEffectsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validEffectsは独自の失敗分岐を所有しない。
 * @invariant validEffectsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validEffectsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validEffectsは共有非同期状態を持たない同期処理である。
 */
function validEffects(value: unknown): value is StoredContinuation["effects"] {
  const hasCurrentKeys =
    plainObject(value) &&
    exactKeys(value, DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS);
  const hasLegacyKeys =
    plainObject(value) &&
    exactKeys(value, LEGACY_DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS);
  return (
    plainObject(value) &&
    (hasCurrentKeys || hasLegacyKeys) &&
    (hasCurrentKeys
      ? DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS
      : LEGACY_DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS
    ).every((action) => value[action] === null || validEffect(value[action]))
  );
}

/**
 * expected Namesを決定する。
 *
 * @responsibility expected Namesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input operationId: string
 * @returns expectedNamesの計算結果を返す。
 * @precondition 「operationId: string」がexpectedNamesの入力契約を満たす。
 * @postcondition expectedNamesの責務を完了した結果だけを返す。
 * @effect N/A: expectedNamesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: expectedNamesは独自の失敗分岐を所有しない。
 * @invariant expectedNamesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security expectedNamesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: expectedNamesは共有非同期状態を持たない同期処理である。
 */
function expectedNames(operationId: string) {
  return Object.freeze({
    failedRunStaleName: `run.crdd-stale-${operationId}-restart`,
    secretsEngineStaleName: `docker-secrets-engine.crdd-stale-${operationId}`,
  });
}

/**
 * 継続記録のSession／Releaseが現在境界または検証済みHandoff chainに属するか判定する。
 *
 * @responsibility 継続記録の発行元を、現在Runtimeまたは修復Operationが検証した過去Session／Releaseへ限定する。
 * @trace ARCH-000008
 * @input value: StoredContinuation、boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation
 * @returns 発行元の完全なSession／Release tupleが許可済みの場合だけtrueを返す。
 * @precondition valueの構造、Hash形式およびOperation Identityは呼出し側で検証する。
 * @postcondition 部分一致ではなく四項目の完全一致だけを受理する。
 * @effect N/A: 入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 現在境界にも検証済みHandoff chainにも属さない値をfalseへ収束させる。
 * @invariant 過去Releaseは継続記録の検証根拠にだけ使い、現在の実行Authorityへ昇格しない。
 * @boundary N/A: Process内の検証済みIdentity比較で完結する。
 * @security 未検証Session、未署名Releaseまたは部分一致を継続Authorityとして受理しない。
 * @concurrency N/A: 共有非同期状態を持たない同期処理である。
 */
function storedContinuationMatchesVerifiedAuthority(
  value: StoredContinuation,
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
) {
  const currentMatches =
    value.localUserBindingHash === boundary.localUserBindingHash &&
    value.crddManifestHash === boundary.crddManifestHash &&
    value.crddReleaseSequence === boundary.crddReleaseSequence &&
    value.runtimeExecutionIdentitySha256 ===
      boundary.runtimeExecutionIdentitySha256;
  if (!operation.history) return currentMatches;
  return isDockerDesktopRepairContinuationAuthorityVerified(
    boundary,
    operation,
    Object.freeze({
      localUserBindingHash: value.localUserBindingHash,
      manifestHash: value.crddManifestHash,
      releaseSequence: value.crddReleaseSequence,
      runtimeExecutionIdentitySha256: value.runtimeExecutionIdentitySha256,
    }),
  );
}

/**
 * Stored Continuationが有効か判定する。
 *
 * @responsibility Stored Continuationの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation
 * @returns value is StoredContinuationを返す。
 * @precondition 「value: unknown、boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation」がvalidStoredContinuationの入力契約を満たす。
 * @postcondition validStoredContinuationの責務を完了した結果だけを返す。
 * @effect N/A: validStoredContinuationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validStoredContinuationは独自の失敗分岐を所有しない。
 * @invariant validStoredContinuationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validStoredContinuationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validStoredContinuationは共有非同期状態を持たない同期処理である。
 */
function validStoredContinuation(
  value: unknown,
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
): value is StoredContinuation {
  if (
    !plainObject(value) ||
    !exactKeys(value, [
      "schema",
      "contractRevision",
      "repairId",
      "sequence",
      "previousRecordSha256",
      "stage",
      "operationTipSha256",
      "operationSequence",
      "failedRunIdentity",
      "secretsEngineIdentity",
      "failedRunStaleName",
      "secretsEngineStaleName",
      "runtimeStateIdentityHash",
      "runtimeStateProtectionHash",
      "localUserBindingHash",
      "runtimeStateBindingHash",
      "dockerPolicySha256",
      "crddManifestHash",
      "crddReleaseSequence",
      "runtimeExecutionIdentitySha256",
      "effects",
    ])
  )
    return false;
  const names = expectedNames(operation.operationId);
  return (
    value.schema === DOCKER_DESKTOP_REPAIR_CONTINUATION_SCHEMA &&
    value.contractRevision === 1 &&
    value.repairId === operation.repairId &&
    Number.isSafeInteger(value.sequence) &&
    Number(value.sequence) >= 0 &&
    Number(value.sequence) < MAXIMUM_CONTINUATION_RECORDS &&
    hash64(value.previousRecordSha256) &&
    DOCKER_DESKTOP_REPAIR_CONTINUATION_STAGES.includes(
      value.stage as DockerDesktopRepairContinuationStage,
    ) &&
    hash64(value.operationTipSha256) &&
    Number.isSafeInteger(value.operationSequence) &&
    Number(value.operationSequence) >= 0 &&
    Number(value.operationSequence) <= operation.sequence &&
    (value.operationSequence !== operation.sequence ||
      value.operationTipSha256 === operation.previousRecordSha256) &&
    validIdentity(value.failedRunIdentity) &&
    validIdentity(value.secretsEngineIdentity) &&
    value.failedRunStaleName === names.failedRunStaleName &&
    value.secretsEngineStaleName === names.secretsEngineStaleName &&
    value.runtimeStateIdentityHash === boundary.runtimeStateIdentityHash &&
    value.runtimeStateProtectionHash === boundary.runtimeStateProtectionHash &&
    value.runtimeStateBindingHash === boundary.runtimeStateBindingHash &&
    value.dockerPolicySha256 === boundary.dockerPolicySha256 &&
    storedContinuationMatchesVerifiedAuthority(
      value as StoredContinuation,
      boundary,
      operation,
    ) &&
    validEffects(value.effects)
  );
}

/**
 * effect Equalsを決定する。
 *
 * @responsibility effect Equalsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input left: DockerDesktopRepairContinuationEffect | null、right: DockerDesktopRepairContinuationEffect | null
 * @returns effectEqualsの計算結果を返す。
 * @precondition 「left: DockerDesktopRepairContinuationEffect | null、right: DockerDesktopRepairContinuationEffect | null」がeffectEqualsの入力契約を満たす。
 * @postcondition effectEqualsの責務を完了した結果だけを返す。
 * @effect N/A: effectEqualsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: effectEqualsは独自の失敗分岐を所有しない。
 * @invariant effectEqualsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security effectEqualsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: effectEqualsは共有非同期状態を持たない同期処理である。
 */
function effectEquals(
  left: DockerDesktopRepairContinuationEffect | null,
  right: DockerDesktopRepairContinuationEffect | null,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Docker Desktop Repair Continuationが完全一致するか判定する。
 *
 * @responsibility 呼出し側が保持するContinuationと、Storeから検証済みで再読取りした最新Continuationの完全一致条件を所有する。
 * @trace ARCH-000008
 * @input left: DockerDesktopRepairContinuation、right: DockerDesktopRepairContinuation
 * @returns 全PropertyとEffectが一致する場合だけtrueを返す。
 * @precondition leftとrightはDockerDesktopRepairContinuationの型契約を満たす。
 * @postcondition 比較対象を変更せず、完全一致の真偽だけを返す。
 * @effect N/A: 入力と局所値だけを比較し、外部または共有Effectを発行しない。
 * @failure N/A: 不一致はfalseとして返し、例外へ昇格しない。
 * @invariant 一部Propertyだけの一致から同一Continuationと推定しない。
 * @boundary Filesystemから再読取りした値とProcess内の呼出し値を接続する境界。
 * @security 未検証の呼出し値を耐久記録の最新Tipへ昇格しない。
 * @concurrency N/A: 共有非同期状態を持たない同期比較である。
 */
function continuationEquals(
  left: DockerDesktopRepairContinuation,
  right: DockerDesktopRepairContinuation,
) {
  return (
    left.repairId === right.repairId &&
    left.sequence === right.sequence &&
    left.previousRecordSha256 === right.previousRecordSha256 &&
    left.stage === right.stage &&
    left.operationTipSha256 === right.operationTipSha256 &&
    left.operationSequence === right.operationSequence &&
    JSON.stringify(left.failedRunIdentity) ===
      JSON.stringify(right.failedRunIdentity) &&
    JSON.stringify(left.secretsEngineIdentity) ===
      JSON.stringify(right.secretsEngineIdentity) &&
    left.failedRunStaleName === right.failedRunStaleName &&
    left.secretsEngineStaleName === right.secretsEngineStaleName &&
    DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS.every((action) =>
      effectEquals(left.effects[action], right.effects[action]),
    )
  );
}

/**
 * legal Transitionを決定する。
 *
 * @responsibility legal Transitionの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input previous: StoredContinuation | null、next: StoredContinuation
 * @returns legalTransitionの計算結果を返す。
 * @precondition 「previous: StoredContinuation | null、next: StoredContinuation」がlegalTransitionの入力契約を満たす。
 * @postcondition legalTransitionの責務を完了した結果だけを返す。
 * @effect legalTransitionはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: legalTransitionは独自の失敗分岐を所有しない。
 * @invariant legalTransitionは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security legalTransitionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: legalTransitionは共有非同期状態を持たない同期処理である。
 */
function legalTransition(
  previous: StoredContinuation | null,
  next: StoredContinuation,
) {
  if (!previous)
    return (
      next.sequence === 0 &&
      next.stage === "prepared" &&
      DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS.every(
        (action) => next.effects[action] === null,
      )
    );
  if (
    next.sequence !== previous.sequence + 1 ||
    next.previousRecordSha256.length !== 64 ||
    next.operationTipSha256 !== previous.operationTipSha256 ||
    next.operationSequence !== previous.operationSequence ||
    JSON.stringify(next.failedRunIdentity) !==
      JSON.stringify(previous.failedRunIdentity) ||
    JSON.stringify(next.secretsEngineIdentity) !==
      JSON.stringify(previous.secretsEngineIdentity) ||
    next.failedRunStaleName !== previous.failedRunStaleName ||
    next.secretsEngineStaleName !== previous.secretsEngineStaleName
  )
    return false;
  const transitions: readonly Readonly<{
    from: DockerDesktopRepairContinuationStage;
    to: DockerDesktopRepairContinuationStage;
    action: DockerDesktopRepairContinuationAction | null;
    phase: "intent_recorded" | "settled" | null;
  }>[] = [
    {
      from: "prepared",
      to: "failed_launch_process_stop_intent",
      action: "failed_launch_process_stop",
      phase: "intent_recorded",
    },
    {
      from: "failed_launch_process_stop_intent",
      to: "failed_launch_process_stopped",
      action: "failed_launch_process_stop",
      phase: "settled",
    },
    {
      from: "failed_launch_process_stopped",
      to: "failed_run_rename_intent",
      action: "failed_launch_run_directory_rename",
      phase: "intent_recorded",
    },
    {
      from: "failed_run_rename_intent",
      to: "failed_run_renamed",
      action: "failed_launch_run_directory_rename",
      phase: "settled",
    },
    {
      from: "failed_run_renamed",
      to: "secrets_engine_rename_intent",
      action: "secrets_engine_directory_rename",
      phase: "intent_recorded",
    },
    {
      from: "secrets_engine_rename_intent",
      to: "secrets_engine_renamed",
      action: "secrets_engine_directory_rename",
      phase: "settled",
    },
    {
      from: "secrets_engine_renamed",
      to: "relaunch_intent",
      action: "desktop_relaunch",
      phase: "intent_recorded",
    },
    {
      from: "relaunch_intent",
      to: "relaunched",
      action: "desktop_relaunch",
      phase: "settled",
    },
    { from: "relaunched", to: "recovered", action: null, phase: null },
  ];
  const isLegacyPreparedTransition =
    previous.stage === "prepared" &&
    next.stage === "failed_run_rename_intent" &&
    !("failed_launch_process_stop" in previous.effects) &&
    !("failed_launch_process_stop" in next.effects);
  const expected = isLegacyPreparedTransition
    ? {
        from: "prepared" as const,
        to: "failed_run_rename_intent" as const,
        action: "failed_launch_run_directory_rename" as const,
        phase: "intent_recorded" as const,
      }
    : transitions.find(
        (candidate) =>
          candidate.from === previous.stage && candidate.to === next.stage,
      );
  if (!expected) return false;
  const changedActions = DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS.filter(
    (action) =>
      !effectEquals(
        previous.effects[action] ?? null,
        next.effects[action] ?? null,
      ),
  );
  if (expected.action === null) return changedActions.length === 0;
  return (
    changedActions.length === 1 &&
    changedActions[0] === expected.action &&
    next.effects[expected.action]?.phase === expected.phase
  );
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
  try {
    const metadata = fs.lstatSync(target, { bigint: true });
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.size <= 0n ||
      metadata.size > BigInt(MAXIMUM_CONTINUATION_RECORD_BYTES)
    )
      return null;
    const bytes = fs.readFileSync(target);
    const after = fs.lstatSync(target, { bigint: true });
    return metadata.dev === after.dev &&
      metadata.ino === after.ino &&
      metadata.size === after.size &&
      metadata.mtimeNs === after.mtimeNs
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * to Continuationを決定する。
 *
 * @responsibility to Continuationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input record: StoredContinuation、recordSha256: string
 * @returns DockerDesktopRepairContinuationを返す。
 * @precondition 「record: StoredContinuation、recordSha256: string」がtoContinuationの入力契約を満たす。
 * @postcondition toContinuationの責務を完了した結果だけを返す。
 * @effect N/A: toContinuationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: toContinuationは独自の失敗分岐を所有しない。
 * @invariant toContinuationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security toContinuationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: toContinuationは共有非同期状態を持たない同期処理である。
 */
function toContinuation(
  record: StoredContinuation,
  recordSha256: string,
): DockerDesktopRepairContinuation {
  const legacyProcessStop = Object.freeze({
    phase: "settled" as const,
    issued: false,
    confirmation: "not_issued" as const,
  });
  return Object.freeze({
    repairId: record.repairId,
    sequence: record.sequence,
    previousRecordSha256: recordSha256,
    stage:
      record.stage === "prepared" &&
      !("failed_launch_process_stop" in record.effects)
        ? "failed_launch_process_stopped"
        : record.stage,
    operationTipSha256: record.operationTipSha256,
    operationSequence: record.operationSequence,
    failedRunIdentity: record.failedRunIdentity,
    secretsEngineIdentity: record.secretsEngineIdentity,
    failedRunStaleName: record.failedRunStaleName,
    secretsEngineStaleName: record.secretsEngineStaleName,
    effects: Object.freeze({
      ...record.effects,
      failed_launch_process_stop:
        "failed_launch_process_stop" in record.effects
          ? record.effects.failed_launch_process_stop
          : legacyProcessStop,
    }),
  });
}

/**
 * continuation Directoryを決定する。
 *
 * @responsibility continuation Directoryの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input operation: DockerDesktopRepairOperation
 * @returns continuationDirectoryの計算結果を返す。
 * @precondition 「operation: DockerDesktopRepairOperation」がcontinuationDirectoryの入力契約を満たす。
 * @postcondition continuationDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: continuationDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: continuationDirectoryは独自の失敗分岐を所有しない。
 * @invariant continuationDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security continuationDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: continuationDirectoryは共有非同期状態を持たない同期処理である。
 */
function continuationDirectory(operation: DockerDesktopRepairOperation) {
  return path.win32.join(
    operation.operationDirectory,
    DOCKER_DESKTOP_REPAIR_CONTINUATION_DIRECTORY,
  );
}

/**
 * Docker Desktop Repair Continuationを読み取る。
 *
 * @responsibility Docker Desktop Repair Continuationの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation
 * @returns DockerDesktopRepairContinuation | nullを返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation」がreadDockerDesktopRepairContinuationの入力契約を満たす。
 * @postcondition readDockerDesktopRepairContinuationの責務を完了した結果だけを返す。
 * @effect readDockerDesktopRepairContinuationはFilesystemの読取りまたは書込みを実行する。
 * @failure readDockerDesktopRepairContinuationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readDockerDesktopRepairContinuationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readDockerDesktopRepairContinuationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readDockerDesktopRepairContinuationは共有非同期状態を持たない同期処理である。
 */
export function readDockerDesktopRepairContinuation(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
): DockerDesktopRepairContinuation | null {
  const directory = continuationDirectory(operation);
  try {
    const metadata = fs.lstatSync(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    const names = fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
    if (
      names.length < 1 ||
      names.length > MAXIMUM_CONTINUATION_RECORDS ||
      fs
        .readdirSync(directory, { withFileTypes: true })
        .some((entry) => !entry.isFile())
    )
      return null;
    let previous: StoredContinuation | null = null;
    let previousHash = "0".repeat(64);
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      const match = /^continuation-([0-9]{2})-([a-z_]+)\.json$/u.exec(
        name ?? "",
      );
      if (!match || Number(match[1]) !== index) return null;
      const bytes = stableBytes(path.win32.join(directory, name ?? ""));
      if (!bytes?.toString("utf8").endsWith("\n")) return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(bytes.toString("utf8"));
      } catch {
        return null;
      }
      if (
        !validStoredContinuation(parsed, boundary, operation) ||
        parsed.stage !== match[2] ||
        parsed.previousRecordSha256 !== previousHash ||
        !legalTransition(previous, parsed)
      )
        return null;
      previousHash = createHash("sha256").update(bytes).digest("hex");
      previous = parsed;
    }
    return previous ? toContinuation(previous, previousHash) : null;
  } catch {
    return null;
  }
}

/**
 * Docker Desktop Repair Continuationを観測する。
 *
 * @responsibility Docker Desktop Repair Continuationの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation
 * @returns inspectDockerDesktopRepairContinuationの計算結果を返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation」がinspectDockerDesktopRepairContinuationの入力契約を満たす。
 * @postcondition inspectDockerDesktopRepairContinuationの責務を完了した結果だけを返す。
 * @effect inspectDockerDesktopRepairContinuationはFilesystemの読取りまたは書込みを実行する。
 * @failure inspectDockerDesktopRepairContinuationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectDockerDesktopRepairContinuationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inspectDockerDesktopRepairContinuationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectDockerDesktopRepairContinuationは共有非同期状態を持たない同期処理である。
 */
export function inspectDockerDesktopRepairContinuation(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
) {
  const directory = continuationDirectory(operation);
  try {
    const metadata = fs.lstatSync(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      return Object.freeze({ status: "invalid" as const, continuation: null });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    return Object.freeze({
      status: code === "ENOENT" ? ("absent" as const) : ("invalid" as const),
      continuation: null,
    });
  }
  const continuation = readDockerDesktopRepairContinuation(boundary, operation);
  return continuation
    ? Object.freeze({ status: "valid" as const, continuation })
    : Object.freeze({ status: "invalid" as const, continuation: null });
}

/**
 * Docker Desktop Repair Continuation Directory Validかを判定する。
 *
 * @responsibility Docker Desktop Repair Continuation Directory Validの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation
 * @returns isDockerDesktopRepairContinuationDirectoryValidの計算結果を返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation」がisDockerDesktopRepairContinuationDirectoryValidの入力契約を満たす。
 * @postcondition isDockerDesktopRepairContinuationDirectoryValidの責務を完了した結果だけを返す。
 * @effect N/A: isDockerDesktopRepairContinuationDirectoryValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isDockerDesktopRepairContinuationDirectoryValidは独自の失敗分岐を所有しない。
 * @invariant isDockerDesktopRepairContinuationDirectoryValidは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security isDockerDesktopRepairContinuationDirectoryValidはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isDockerDesktopRepairContinuationDirectoryValidは共有非同期状態を持たない同期処理である。
 */
export function isDockerDesktopRepairContinuationDirectoryValid(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
) {
  return readDockerDesktopRepairContinuation(boundary, operation) !== null;
}

/**
 * docker-desktop-repair-continuation-storeを耐久保存する。
 *
 * @responsibility docker-desktop-repair-continuation-storeの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、previous: DockerDesktopRepairContinuation | null、stage: DockerDesktopRepairContinuationStage、failedRunIdentity: DockerDesktopRepairDirectoryIdentity、secretsEngineIdentity: DockerDesktopRepairDirectoryIdentity、effects: DockerDesktopRepairContinuation["effects"]
 * @returns persistの計算結果を返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、previous: DockerDesktopRepairContinuation | null、stage: DockerDesktopRepairContinuationStage、failedRunIdentity: DockerDesktopRepairDirectoryIdentity、secretsEngineIdentity: DockerDesktopRepairDirectoryIdentity、effects: DockerDesktopRepairContinuation["effects"]」がpersistの入力契約を満たす。
 * @postcondition persistの責務を完了した結果だけを返す。
 * @effect persistはFilesystemの読取りまたは書込みを実行する。
 * @failure persistは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant persistは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security persistはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: persistは共有非同期状態を持たない同期処理である。
 */
function persist(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
  previous: DockerDesktopRepairContinuation | null,
  stage: DockerDesktopRepairContinuationStage,
  failedRunIdentity: DockerDesktopRepairDirectoryIdentity,
  secretsEngineIdentity: DockerDesktopRepairDirectoryIdentity,
  effects: DockerDesktopRepairContinuation["effects"],
) {
  if (
    operation.history &&
    !isDockerDesktopRepairContinuationAuthorityVerified(
      boundary,
      operation,
      Object.freeze({
        localUserBindingHash: boundary.localUserBindingHash,
        manifestHash: boundary.crddManifestHash,
        releaseSequence: boundary.crddReleaseSequence,
        runtimeExecutionIdentitySha256: boundary.runtimeExecutionIdentitySha256,
      }),
    )
  )
    return null;
  if (previous) {
    const observedPrevious = readDockerDesktopRepairContinuation(
      boundary,
      operation,
    );
    if (!observedPrevious || !continuationEquals(previous, observedPrevious))
      return null;
  }
  const directory = continuationDirectory(operation);
  const sequence = (previous?.sequence ?? -1) + 1;
  const names = expectedNames(operation.operationId);
  const record: StoredContinuation = Object.freeze({
    schema: DOCKER_DESKTOP_REPAIR_CONTINUATION_SCHEMA,
    contractRevision: 1,
    repairId: operation.repairId,
    sequence,
    previousRecordSha256: previous?.previousRecordSha256 ?? "0".repeat(64),
    stage,
    operationTipSha256: operation.previousRecordSha256,
    operationSequence: operation.sequence,
    failedRunIdentity,
    secretsEngineIdentity,
    ...names,
    runtimeStateIdentityHash: boundary.runtimeStateIdentityHash,
    runtimeStateProtectionHash: boundary.runtimeStateProtectionHash,
    localUserBindingHash: boundary.localUserBindingHash,
    runtimeStateBindingHash: boundary.runtimeStateBindingHash,
    dockerPolicySha256: boundary.dockerPolicySha256,
    crddManifestHash: boundary.crddManifestHash,
    crddReleaseSequence: boundary.crddReleaseSequence,
    runtimeExecutionIdentitySha256: boundary.runtimeExecutionIdentitySha256,
    effects,
  });
  const priorRecord = previous
    ? ({
        ...record,
        sequence: previous.sequence,
        previousRecordSha256: "0".repeat(64),
        stage: previous.stage,
        effects: previous.effects,
      } as StoredContinuation)
    : null;
  if (
    sequence < 0 ||
    sequence >= MAXIMUM_CONTINUATION_RECORDS ||
    !validStoredContinuation(record, boundary, operation) ||
    !legalTransition(priorRecord, record)
  )
    return null;
  try {
    if (sequence === 0) fs.mkdirSync(directory, { recursive: false });
    const serialized = Buffer.from(`${JSON.stringify(record)}\n`, "utf8");
    const target = path.win32.join(
      directory,
      `continuation-${String(sequence).padStart(2, "0")}-${stage}.json`,
    );
    const temporary = path.win32.join(
      directory,
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
    return toContinuation(
      record,
      createHash("sha256").update(committed).digest("hex"),
    );
  } catch {
    return null;
  }
}

const emptyEffects = () =>
  Object.freeze({
    failed_launch_process_stop: null,
    failed_launch_run_directory_rename: null,
    secrets_engine_directory_rename: null,
    desktop_relaunch: null,
  });

/**
 * Docker Desktop Repair Continuationを構築する。
 *
 * @responsibility Docker Desktop Repair Continuationの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、failedRunIdentity: DockerDesktopRepairDirectoryIdentity、secretsEngineIdentity: DockerDesktopRepairDirectoryIdentity
 * @returns createDockerDesktopRepairContinuationの計算結果を返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、failedRunIdentity: DockerDesktopRepairDirectoryIdentity、secretsEngineIdentity: DockerDesktopRepairDirectoryIdentity」がcreateDockerDesktopRepairContinuationの入力契約を満たす。
 * @postcondition createDockerDesktopRepairContinuationの責務を完了した結果だけを返す。
 * @effect N/A: createDockerDesktopRepairContinuationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDockerDesktopRepairContinuationは独自の失敗分岐を所有しない。
 * @invariant createDockerDesktopRepairContinuationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createDockerDesktopRepairContinuationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDockerDesktopRepairContinuationは共有非同期状態を持たない同期処理である。
 */
export function createDockerDesktopRepairContinuation(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
  failedRunIdentity: DockerDesktopRepairDirectoryIdentity,
  secretsEngineIdentity: DockerDesktopRepairDirectoryIdentity,
) {
  return persist(
    boundary,
    operation,
    null,
    "prepared",
    failedRunIdentity,
    secretsEngineIdentity,
    emptyEffects(),
  );
}

/**
 * Docker Desktop Repair Continuation Intentを耐久保存する。
 *
 * @responsibility Docker Desktop Repair Continuation Intentの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、continuation: DockerDesktopRepairContinuation、action: DockerDesktopRepairContinuationAction
 * @returns persistDockerDesktopRepairContinuationIntentの計算結果を返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、continuation: DockerDesktopRepairContinuation、action: DockerDesktopRepairContinuationAction」がpersistDockerDesktopRepairContinuationIntentの入力契約を満たす。
 * @postcondition persistDockerDesktopRepairContinuationIntentの責務を完了した結果だけを返す。
 * @effect persistDockerDesktopRepairContinuationIntentはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: persistDockerDesktopRepairContinuationIntentは独自の失敗分岐を所有しない。
 * @invariant persistDockerDesktopRepairContinuationIntentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security persistDockerDesktopRepairContinuationIntentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: persistDockerDesktopRepairContinuationIntentは共有非同期状態を持たない同期処理である。
 */
export function persistDockerDesktopRepairContinuationIntent(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
  continuation: DockerDesktopRepairContinuation,
  action: DockerDesktopRepairContinuationAction,
) {
  const mapping = {
    failed_launch_process_stop: "failed_launch_process_stop_intent",
    failed_launch_run_directory_rename: "failed_run_rename_intent",
    secrets_engine_directory_rename: "secrets_engine_rename_intent",
    desktop_relaunch: "relaunch_intent",
  } as const;
  return persist(
    boundary,
    operation,
    continuation,
    mapping[action],
    continuation.failedRunIdentity,
    continuation.secretsEngineIdentity,
    Object.freeze({
      ...continuation.effects,
      [action]: Object.freeze({
        phase: "intent_recorded" as const,
        issued: null,
        confirmation: "unknown" as const,
      }),
    }),
  );
}

/**
 * Docker Desktop Repair Continuation Settlementを耐久保存する。
 *
 * @responsibility Docker Desktop Repair Continuation Settlementの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、continuation: DockerDesktopRepairContinuation、action: DockerDesktopRepairContinuationAction、outcome: Readonly<{ issued: boolean | null; confirmation: DockerDesktopRepairEffectConfirmation; }>
 * @returns persistDockerDesktopRepairContinuationSettlementの計算結果を返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、continuation: DockerDesktopRepairContinuation、action: DockerDesktopRepairContinuationAction、outcome: Readonly<{ issued: boolean | null; confirmation: DockerDesktopRepairEffectConfirmation; }>」がpersistDockerDesktopRepairContinuationSettlementの入力契約を満たす。
 * @postcondition persistDockerDesktopRepairContinuationSettlementの責務を完了した結果だけを返す。
 * @effect persistDockerDesktopRepairContinuationSettlementはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: persistDockerDesktopRepairContinuationSettlementは独自の失敗分岐を所有しない。
 * @invariant persistDockerDesktopRepairContinuationSettlementは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security persistDockerDesktopRepairContinuationSettlementはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: persistDockerDesktopRepairContinuationSettlementは共有非同期状態を持たない同期処理である。
 */
export function persistDockerDesktopRepairContinuationSettlement(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
  continuation: DockerDesktopRepairContinuation,
  action: DockerDesktopRepairContinuationAction,
  outcome: Readonly<{
    issued: boolean | null;
    confirmation: DockerDesktopRepairEffectConfirmation;
  }>,
) {
  const mapping = {
    failed_launch_process_stop: "failed_launch_process_stopped",
    failed_launch_run_directory_rename: "failed_run_renamed",
    secrets_engine_directory_rename: "secrets_engine_renamed",
    desktop_relaunch: "relaunched",
  } as const;
  return persist(
    boundary,
    operation,
    continuation,
    mapping[action],
    continuation.failedRunIdentity,
    continuation.secretsEngineIdentity,
    Object.freeze({
      ...continuation.effects,
      [action]: Object.freeze({ phase: "settled" as const, ...outcome }),
    }),
  );
}

/**
 * Docker Desktop Repair Continuation Recoveredを耐久保存する。
 *
 * @responsibility Docker Desktop Repair Continuation Recoveredの保存Identity、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、continuation: DockerDesktopRepairContinuation
 * @returns persistDockerDesktopRepairContinuationRecoveredの計算結果を返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、operation: DockerDesktopRepairOperation、continuation: DockerDesktopRepairContinuation」がpersistDockerDesktopRepairContinuationRecoveredの入力契約を満たす。
 * @postcondition persistDockerDesktopRepairContinuationRecoveredの責務を完了した結果だけを返す。
 * @effect N/A: persistDockerDesktopRepairContinuationRecoveredは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: persistDockerDesktopRepairContinuationRecoveredは独自の失敗分岐を所有しない。
 * @invariant persistDockerDesktopRepairContinuationRecoveredは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security persistDockerDesktopRepairContinuationRecoveredはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: persistDockerDesktopRepairContinuationRecoveredは共有非同期状態を持たない同期処理である。
 */
export function persistDockerDesktopRepairContinuationRecovered(
  boundary: DockerDesktopRepairRecordBoundary,
  operation: DockerDesktopRepairOperation,
  continuation: DockerDesktopRepairContinuation,
) {
  if (
    !DOCKER_DESKTOP_REPAIR_CONTINUATION_ACTIONS.every((action) => {
      const effect = continuation.effects[action];
      if (action === "failed_launch_process_stop")
        return (
          effect?.phase === "settled" &&
          ((effect.issued === true && effect.confirmation === "confirmed") ||
            (effect.issued === false && effect.confirmation === "not_issued"))
        );
      return (
        effect?.phase === "settled" &&
        effect.issued === true &&
        effect.confirmation === "confirmed"
      );
    })
  )
    return null;
  return persist(
    boundary,
    operation,
    continuation,
    "recovered",
    continuation.failedRunIdentity,
    continuation.secretsEngineIdentity,
    continuation.effects,
  );
}

/**
 * docker Desktop Repair Continuation Pathsを決定する。
 *
 * @responsibility docker Desktop Repair Continuation Pathsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input boundary: DockerDesktopRepairRecordBoundary、continuation: DockerDesktopRepairContinuation
 * @returns dockerDesktopRepairContinuationPathsの計算結果を返す。
 * @precondition 「boundary: DockerDesktopRepairRecordBoundary、continuation: DockerDesktopRepairContinuation」がdockerDesktopRepairContinuationPathsの入力契約を満たす。
 * @postcondition dockerDesktopRepairContinuationPathsの責務を完了した結果だけを返す。
 * @effect N/A: dockerDesktopRepairContinuationPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: dockerDesktopRepairContinuationPathsは独自の失敗分岐を所有しない。
 * @invariant dockerDesktopRepairContinuationPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security dockerDesktopRepairContinuationPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dockerDesktopRepairContinuationPathsは共有非同期状態を持たない同期処理である。
 */
export function dockerDesktopRepairContinuationPaths(
  boundary: DockerDesktopRepairRecordBoundary,
  continuation: DockerDesktopRepairContinuation,
) {
  return Object.freeze({
    failedRunDirectory: path.win32.join(boundary.localAppData, "Docker", "run"),
    failedRunStaleDirectory: path.win32.join(
      boundary.localAppData,
      "Docker",
      continuation.failedRunStaleName,
    ),
    secretsEngineDirectory: path.win32.join(
      boundary.localAppData,
      "docker-secrets-engine",
    ),
    secretsEngineStaleDirectory: path.win32.join(
      boundary.localAppData,
      continuation.secretsEngineStaleName,
    ),
  });
}
