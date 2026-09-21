import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { acquireRuntimeOwnedDockerRuntimeStateKernelLock } from "./candidate-store-kernel-lock.ts";
import {
  consumeRuntimeOwnedRuntimeStateRootCapability,
  inspectRuntimeOwnedWindowsRuntimeState,
} from "./candidate-store-windows-adapter.ts";
import { inspectRuntimeOwnedDevelopmentOperationContext } from "./development-measurement-session.ts";
import {
  dockerRecoveryCommitName,
  readCommittedDockerRecoveryJson,
  removeCommittedDockerRecoveryJson,
  writeCommittedDockerRecoveryJson,
} from "./docker-recovery-journal.ts";
import {
  EXTERNAL_SEND_CONSENT_LIFETIME_MS,
  EXTERNAL_SEND_CONSENT_SCHEMA,
  EXTERNAL_SEND_RUNTIME_SEMANTICS_ID,
  externalSendConsentActiveRecordName,
  isExternalSendConsentRecordShape,
  parseExternalSendConsentActiveEntryName,
} from "./external-send-consent-record.ts";
import type { ExternalSendPolicy } from "./external-send-policy-runtime.ts";

export const EXTERNAL_SEND_CONSENT_RUNTIME_CONTRACT =
  "crdd-coordinator/external-send-consent-runtime";
export const EXTERNAL_SEND_CONSENT_RUNTIME_CONTRACT_REVISION = 3;
export {
  EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX,
  EXTERNAL_SEND_RUNTIME_SEMANTICS_ID,
} from "./external-send-consent-record.ts";

const HEX64 = /^[a-f0-9]{64}$/u;

/**
 * VerifiedRootが扱う値の構造を表す。
 *
 * @responsibility VerifiedRootに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape VerifiedRootが表すProperty、識別子およびRelationを型として固定する。
 * @invariant VerifiedRootで宣言した値と責務の対応を維持する。
 * @boundary N/A: VerifiedRootの宣言は外部境界を開かない。
 * @security VerifiedRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility VerifiedRootの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type VerifiedRoot = NonNullable<
  ReturnType<typeof consumeRuntimeOwnedRuntimeStateRootCapability>
>;
/**
 * Lockが扱う値の構造を表す。
 *
 * @responsibility Lockに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape Lockが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Lockで宣言した値と責務の対応を維持する。
 * @boundary N/A: Lockの宣言は外部境界を開かない。
 * @security LockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Lockの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Lock = Readonly<{ release: () => boolean }>;
/**
 * ConsentDependenciesが扱う値の構造を表す。
 *
 * @responsibility ConsentDependenciesに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape ConsentDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ConsentDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: ConsentDependenciesの宣言は外部境界を開かない。
 * @security ConsentDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ConsentDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ConsentDependencies = Readonly<{
  observeRoot: (shouldInitializeIfMissing: boolean) => VerifiedRoot | null;
  acquireLock: (bindingHash: string) => Lock | null;
  now: () => number;
  nonce: () => string;
}>;

/**
 * compileExternalSendConsentBoundaryHashの処理を実行する。
 *
 * @responsibility compileExternalSendConsentBoundaryHashに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input policy: ExternalSendPolicy
 * @returns compileExternalSendConsentBoundaryHashの計算結果を返す。
 * @precondition 「policy: ExternalSendPolicy」がcompileExternalSendConsentBoundaryHashの入力契約を満たす。
 * @postcondition compileExternalSendConsentBoundaryHashの責務を完了した結果だけを返す。
 * @effect N/A: compileExternalSendConsentBoundaryHashは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: compileExternalSendConsentBoundaryHashは独自の失敗分岐を所有しない。
 * @invariant compileExternalSendConsentBoundaryHashは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: compileExternalSendConsentBoundaryHashはProcess内の同一Subsystemで完結する。
 * @security compileExternalSendConsentBoundaryHashはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: compileExternalSendConsentBoundaryHashは共有非同期状態を持たない同期処理である。
 */
export function compileExternalSendConsentBoundaryHash(
  policy: ExternalSendPolicy,
) {
  return HEX64.test(policy.sourceFileHash)
    ? createHash("sha256")
        .update("crdd-external-send-consent-boundary-v2\0")
        .update(policy.policyId)
        .update("\0")
        .update(policy.sourceFileHash)
        .update("\0")
        .update(EXTERNAL_SEND_RUNTIME_SEMANTICS_ID)
        .digest("hex")
    : null;
}

/**
 * productionObserveRootの処理を実行する。
 *
 * @responsibility productionObserveRootに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input shouldInitializeIfMissing: boolean、developmentContext: unknown
 * @returns productionObserveRootの計算結果を返す。
 * @precondition 「shouldInitializeIfMissing: boolean、developmentContext: unknown」がproductionObserveRootの入力契約を満たす。
 * @postcondition productionObserveRootの責務を完了した結果だけを返す。
 * @effect N/A: productionObserveRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: productionObserveRootは独自の失敗分岐を所有しない。
 * @invariant productionObserveRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: productionObserveRootはProcess内の同一Subsystemで完結する。
 * @security productionObserveRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: productionObserveRootは共有非同期状態を持たない同期処理である。
 */
function productionObserveRoot(
  shouldInitializeIfMissing: boolean,
  developmentContext?: unknown,
) {
  const observation = inspectRuntimeOwnedWindowsRuntimeState(
    shouldInitializeIfMissing,
    new Date().toISOString(),
    developmentContext,
  );
  const root = consumeRuntimeOwnedRuntimeStateRootCapability(
    observation.rootCapability,
  );
  return observation.status === "candidate" && root ? root : null;
}

const productionDependencies: ConsentDependencies = Object.freeze({
  observeRoot: productionObserveRoot,
  acquireLock: acquireRuntimeOwnedDockerRuntimeStateKernelLock,
  now: Date.now,
  nonce: () => randomBytes(8).toString("hex"),
});

/**
 * sameRootの処理を実行する。
 *
 * @responsibility sameRootに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input left: VerifiedRoot、right: VerifiedRoot
 * @returns sameRootの計算結果を返す。
 * @precondition 「left: VerifiedRoot、right: VerifiedRoot」がsameRootの入力契約を満たす。
 * @postcondition sameRootの責務を完了した結果だけを返す。
 * @effect N/A: sameRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameRootは独自の失敗分岐を所有しない。
 * @invariant sameRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameRootはProcess内の同一Subsystemで完結する。
 * @security sameRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameRootは共有非同期状態を持たない同期処理である。
 */
function sameRoot(left: VerifiedRoot, right: VerifiedRoot) {
  return (
    left.rootPath === right.rootPath &&
    left.runtimeStateIdentityHash === right.runtimeStateIdentityHash &&
    left.runtimeStateProtectionHash === right.runtimeStateProtectionHash &&
    left.localUserBindingHash === right.localUserBindingHash &&
    left.stableLogicalHomeBindingHash === right.stableLogicalHomeBindingHash
  );
}

/**
 * expectedBoundaryの処理を実行する。
 *
 * @responsibility expectedBoundaryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input policy: ExternalSendPolicy、boundaryHash: string、root: VerifiedRoot
 * @returns expectedBoundaryの計算結果を返す。
 * @precondition 「policy: ExternalSendPolicy、boundaryHash: string、root: VerifiedRoot」がexpectedBoundaryの入力契約を満たす。
 * @postcondition expectedBoundaryの責務を完了した結果だけを返す。
 * @effect N/A: expectedBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: expectedBoundaryは独自の失敗分岐を所有しない。
 * @invariant expectedBoundaryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: expectedBoundaryはProcess内の同一Subsystemで完結する。
 * @security expectedBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: expectedBoundaryは共有非同期状態を持たない同期処理である。
 */
function expectedBoundary(
  policy: ExternalSendPolicy,
  boundaryHash: string,
  root: VerifiedRoot,
) {
  return Object.freeze({
    consentBoundaryHash: boundaryHash,
    policyId: policy.policyId,
    sourceFileHash: policy.sourceFileHash,
    runtimeExternalSendSemanticsId: EXTERNAL_SEND_RUNTIME_SEMANTICS_ID,
    informationClassification: policy.informationClassification,
    providerBoundaries: Object.freeze(
      policy.destinations.map((destination) =>
        Object.freeze({
          provider: destination.provider,
          accountTenantBoundary: destination.accountTenantBoundary,
          subscriptionOffering: destination.subscriptionOffering,
          purposeOperations: Object.freeze([...destination.purposeOperations]),
          termsPolicyIdentity: destination.termsPolicyIdentity,
        }),
      ),
    ),
    localUserBindingHash: root.localUserBindingHash,
    runtimeStateIdentityHash: root.runtimeStateIdentityHash,
    runtimeStateProtectionHash: root.runtimeStateProtectionHash,
    runtimeStateBindingHash: root.stableLogicalHomeBindingHash,
    apiKeyFallbackAllowed: false,
    additionalPurchaseAllowed: false,
  });
}

/**
 * recordForの処理を実行する。
 *
 * @responsibility recordForに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input policy: ExternalSendPolicy、boundaryHash: string、root: VerifiedRoot、now: number、generation: string
 * @returns recordForの計算結果を返す。
 * @precondition 「policy: ExternalSendPolicy、boundaryHash: string、root: VerifiedRoot、now: number、generation: string」がrecordForの入力契約を満たす。
 * @postcondition recordForの責務を完了した結果だけを返す。
 * @effect N/A: recordForは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recordForは独自の失敗分岐を所有しない。
 * @invariant recordForは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recordForはProcess内の同一Subsystemで完結する。
 * @security recordForはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recordForは共有非同期状態を持たない同期処理である。
 */
function recordFor(
  policy: ExternalSendPolicy,
  boundaryHash: string,
  root: VerifiedRoot,
  now: number,
  generation: string,
) {
  return Object.freeze({
    schema: EXTERNAL_SEND_CONSENT_SCHEMA,
    ...expectedBoundary(policy, boundaryHash, root),
    generation,
    confirmedAtEpochMs: now,
    expiresAtEpochMs: now + EXTERNAL_SEND_CONSENT_LIFETIME_MS,
  });
}

/**
 * validRecordの処理を実行する。
 *
 * @responsibility validRecordに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input value: unknown、expected: ReturnType<typeof expectedBoundary>、now: number
 * @returns validRecordの計算結果を返す。
 * @precondition 「value: unknown、expected: ReturnType<typeof expectedBoundary>、now: number」がvalidRecordの入力契約を満たす。
 * @postcondition validRecordの責務を完了した結果だけを返す。
 * @effect N/A: validRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRecordは独自の失敗分岐を所有しない。
 * @invariant validRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRecordはProcess内の同一Subsystemで完結する。
 * @security validRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validRecordは共有非同期状態を持たない同期処理である。
 */
function validRecord(
  value: unknown,
  expected: ReturnType<typeof expectedBoundary>,
  now: number,
) {
  if (!isExternalSendConsentRecordShape(value)) return false;
  const record = value as Record<string, unknown>;
  const boundary = Object.fromEntries(
    Object.keys(expected).map((key) => [key, record[key]]),
  );
  return (
    JSON.stringify(boundary) === JSON.stringify(expected) &&
    typeof record.confirmedAtEpochMs === "number" &&
    Number.isSafeInteger(record.confirmedAtEpochMs) &&
    typeof record.expiresAtEpochMs === "number" &&
    Number.isSafeInteger(record.expiresAtEpochMs) &&
    record.confirmedAtEpochMs <= now &&
    record.expiresAtEpochMs > now
  );
}

/**
 * consentNameの処理を実行する。
 *
 * @responsibility consentNameに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input boundaryHash: string、generation: string
 * @returns consentNameの計算結果を返す。
 * @precondition 「boundaryHash: string、generation: string」がconsentNameの入力契約を満たす。
 * @postcondition consentNameの責務を完了した結果だけを返す。
 * @effect N/A: consentNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure consentNameは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant consentNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consentNameはProcess内の同一Subsystemで完結する。
 * @security consentNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consentNameは共有非同期状態を持たない同期処理である。
 */
function consentName(boundaryHash: string, generation: string) {
  const name = externalSendConsentActiveRecordName(boundaryHash, generation);
  if (!name) throw new Error("external_send_consent_identity_invalid");
  return name;
}

/**
 * consentPathsの処理を実行する。
 *
 * @responsibility consentPathsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input root: VerifiedRoot、name: string
 * @returns consentPathsの計算結果を返す。
 * @precondition 「root: VerifiedRoot、name: string」がconsentPathsの入力契約を満たす。
 * @postcondition consentPathsの責務を完了した結果だけを返す。
 * @effect N/A: consentPathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consentPathsは独自の失敗分岐を所有しない。
 * @invariant consentPathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consentPathsはProcess内の同一Subsystemで完結する。
 * @security consentPathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consentPathsは共有非同期状態を持たない同期処理である。
 */
function consentPaths(root: VerifiedRoot, name: string) {
  const file = path.join(root.rootPath, name);
  return Object.freeze({
    file,
    commit: path.join(root.rootPath, dockerRecoveryCommitName(name)),
  });
}

/**
 * exactRegularFileOrMissingの処理を実行する。
 *
 * @responsibility exactRegularFileOrMissingに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input file: string
 * @returns exactRegularFileOrMissingの計算結果を返す。
 * @precondition 「file: string」がexactRegularFileOrMissingの入力契約を満たす。
 * @postcondition exactRegularFileOrMissingの責務を完了した結果だけを返す。
 * @effect exactRegularFileOrMissingはFilesystemの読取りまたは書込みを実行する。
 * @failure exactRegularFileOrMissingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant exactRegularFileOrMissingは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security exactRegularFileOrMissingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactRegularFileOrMissingは共有非同期状態を持たない同期処理である。
 */
function exactRegularFileOrMissing(file: string) {
  try {
    const stat = fs.lstatSync(file);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch (error) {
    return (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    );
  }
}

/**
 * pathMissingの処理を実行する。
 *
 * @responsibility pathMissingに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input file: string
 * @returns pathMissingの計算結果を返す。
 * @precondition 「file: string」がpathMissingの入力契約を満たす。
 * @postcondition pathMissingの責務を完了した結果だけを返す。
 * @effect pathMissingはFilesystemの読取りまたは書込みを実行する。
 * @failure pathMissingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant pathMissingは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security pathMissingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: pathMissingは共有非同期状態を持たない同期処理である。
 */
function pathMissing(file: string) {
  try {
    fs.lstatSync(file);
    return false;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    )
      return true;
    throw error;
  }
}

// Removing this one fixed pair only reduces authority. Commit is removed
// first so a crash cannot leave an old record authoritative.
/**
 * activeNamesの処理を実行する。
 *
 * @responsibility activeNamesに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input root: VerifiedRoot
 * @returns activeNamesの計算結果を返す。
 * @precondition 「root: VerifiedRoot」がactiveNamesの入力契約を満たす。
 * @postcondition activeNamesの責務を完了した結果だけを返す。
 * @effect activeNamesはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: activeNamesは独自の失敗分岐を所有しない。
 * @invariant activeNamesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security activeNamesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: activeNamesは共有非同期状態を持たない同期処理である。
 */
function activeNames(root: VerifiedRoot) {
  const names = new Set<string>();
  for (const entry of fs.readdirSync(root.rootPath)) {
    const parsed = parseExternalSendConsentActiveEntryName(entry);
    if (parsed) names.add(parsed.recordName);
  }
  return [...names];
}

/**
 * revokePairの処理を実行する。
 *
 * @responsibility revokePairに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input root: VerifiedRoot
 * @returns revokePairの計算結果を返す。
 * @precondition 「root: VerifiedRoot」がrevokePairの入力契約を満たす。
 * @postcondition revokePairの責務を完了した結果だけを返す。
 * @effect revokePairはFilesystemの読取りまたは書込みを実行する。
 * @failure revokePairは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant revokePairは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security revokePairはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: revokePairは共有非同期状態を持たない同期処理である。
 */
function revokePair(root: VerifiedRoot) {
  const names = activeNames(root);
  if (names.length > 1) return false;
  const name = names[0];
  if (!name) return true;
  const target = consentPaths(root, name);
  if (
    !exactRegularFileOrMissing(target.file) ||
    !exactRegularFileOrMissing(target.commit)
  )
    return false;
  if (!pathMissing(target.file) && !pathMissing(target.commit)) {
    try {
      removeCommittedDockerRecoveryJson(target.file, name);
      return pathMissing(target.file) && pathMissing(target.commit);
    } catch {
      // Invalid fixed-pair data is not authority. Fall through to bounded
      // authority-reducing deletion after exact file-type checks above.
    }
  }
  if (!pathMissing(target.commit)) fs.rmSync(target.commit);
  if (!pathMissing(target.file)) fs.rmSync(target.file);
  return pathMissing(target.file) && pathMissing(target.commit);
}

/**
 * withConsentLockの処理を実行する。
 *
 * @responsibility withConsentLockに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input dependencies: ConsentDependencies、root: VerifiedRoot、operation: () => T
 * @returns withConsentLockの計算結果を返す。
 * @precondition 「dependencies: ConsentDependencies、root: VerifiedRoot、operation: () => T」がwithConsentLockの入力契約を満たす。
 * @postcondition withConsentLockの責務を完了した結果だけを返す。
 * @effect N/A: withConsentLockは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure withConsentLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant withConsentLockは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: withConsentLockはProcess内の同一Subsystemで完結する。
 * @security withConsentLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: withConsentLockは共有非同期状態を持たない同期処理である。
 */
function withConsentLock<T>(
  dependencies: ConsentDependencies,
  root: VerifiedRoot,
  operation: () => T,
) {
  const lock = dependencies.acquireLock(root.stableLogicalHomeBindingHash);
  if (!lock) return null;
  let result: T | null = null;
  let hasFailed = false;
  try {
    const rebound = dependencies.observeRoot(false);
    if (!rebound || !sameRoot(root, rebound)) hasFailed = true;
    else result = operation();
  } catch {
    hasFailed = true;
  }
  let released = false;
  try {
    released = lock.release();
  } catch {
    released = false;
  }
  return hasFailed || !released ? null : result;
}

/**
 * createRuntimeの処理を実行する。
 *
 * @responsibility createRuntimeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input dependencies: ConsentDependencies
 * @returns createRuntimeの計算結果を返す。
 * @precondition 「dependencies: ConsentDependencies」がcreateRuntimeの入力契約を満たす。
 * @postcondition createRuntimeの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeはProcess内の同一Subsystemで完結する。
 * @security createRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createRuntimeは共有非同期状態を持たない同期処理である。
 */
function createRuntime(dependencies: ConsentDependencies) {
  /**
   * resolveの処理を実行する。
   *
   * @responsibility resolveに対応する入力処理と結果生成を所有する。
   * @trace ARCH-000015
   * @input policy: ExternalSendPolicy
   * @returns resolveの計算結果を返す。
   * @precondition 「policy: ExternalSendPolicy」がresolveの入力契約を満たす。
   * @postcondition resolveの責務を完了した結果だけを返す。
   * @effect N/A: resolveは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure resolveは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant resolveは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: resolveはProcess内の同一Subsystemで完結する。
   * @security resolveはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: resolveは共有非同期状態を持たない同期処理である。
   */
  function resolve(policy: ExternalSendPolicy) {
    try {
      const boundaryHash = compileExternalSendConsentBoundaryHash(policy);
      if (!boundaryHash)
        return Object.freeze({
          status: "recovery_required" as const,
          boundaryHash,
        });
      // A verified empty RuntimeState root is distinguishable from an
      // unavailable root. Initializing the fixed protected root here avoids
      // treating observation failure as consent absence.
      const root = dependencies.observeRoot(true);
      if (!root)
        return Object.freeze({
          status: "recovery_required" as const,
          boundaryHash,
        });
      return (
        withConsentLock(dependencies, root, () => {
          const names = activeNames(root);
          if (names.length > 1)
            return Object.freeze({
              status: "recovery_required" as const,
              boundaryHash,
            });
          const currentName = names[0];
          if (!currentName)
            return Object.freeze({ status: "absent" as const, boundaryHash });
          const target = consentPaths(root, currentName);
          const filePresent = !pathMissing(target.file);
          const commitPresent = !pathMissing(target.commit);
          if (!filePresent || !commitPresent) {
            return revokePair(root)
              ? Object.freeze({ status: "absent" as const, boundaryHash })
              : Object.freeze({
                  status: "recovery_required" as const,
                  boundaryHash,
                });
          }
          let record: unknown;
          try {
            record = readCommittedDockerRecoveryJson(
              target.file,
              currentName,
            ).value;
          } catch {
            return revokePair(root)
              ? Object.freeze({ status: "absent" as const, boundaryHash })
              : Object.freeze({
                  status: "recovery_required" as const,
                  boundaryHash,
                });
          }
          const currentIdentity =
            parseExternalSendConsentActiveEntryName(currentName);
          if (currentIdentity?.boundaryHash !== boundaryHash)
            return revokePair(root)
              ? Object.freeze({
                  status: "needs_confirmation" as const,
                  boundaryHash,
                })
              : Object.freeze({
                  status: "recovery_required" as const,
                  boundaryHash,
                });
          const isCurrent =
            currentIdentity?.generation ===
              (record as Record<string, unknown>).generation &&
            validRecord(
              record,
              expectedBoundary(policy, boundaryHash, root),
              dependencies.now(),
            );
          if (isCurrent)
            return Object.freeze({
              status: "confirmed" as const,
              boundaryHash,
            });
          return revokePair(root)
            ? Object.freeze({
                status: "needs_confirmation" as const,
                boundaryHash,
              })
            : Object.freeze({
                status: "recovery_required" as const,
                boundaryHash,
              });
        }) ??
        Object.freeze({ status: "recovery_required" as const, boundaryHash })
      );
    } catch {
      return Object.freeze({
        status: "recovery_required" as const,
        boundaryHash: null,
      });
    }
  }

  /**
   * persistの処理を実行する。
   *
   * @responsibility persistに対応する入力処理と結果生成を所有する。
   * @trace ARCH-000015
   * @input policy: ExternalSendPolicy
   * @returns persistの計算結果を返す。
   * @precondition 「policy: ExternalSendPolicy」がpersistの入力契約を満たす。
   * @postcondition persistの責務を完了した結果だけを返す。
   * @effect N/A: persistは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure persistは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant persistは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: persistはProcess内の同一Subsystemで完結する。
   * @security persistはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: persistは共有非同期状態を持たない同期処理である。
   */
  function persist(policy: ExternalSendPolicy) {
    try {
      const boundaryHash = compileExternalSendConsentBoundaryHash(policy);
      const root = dependencies.observeRoot(true);
      if (!boundaryHash || !root)
        return Object.freeze({ status: "recovery_required" as const });
      return (
        withConsentLock(dependencies, root, () => {
          if (!revokePair(root))
            return Object.freeze({ status: "recovery_required" as const });
          const record = recordFor(
            policy,
            boundaryHash,
            root,
            dependencies.now(),
            dependencies.nonce(),
          );
          if (!/^[a-f0-9]{16}$/u.test(record.generation))
            return Object.freeze({ status: "recovery_required" as const });
          const name = consentName(boundaryHash, record.generation);
          writeCommittedDockerRecoveryJson(root.rootPath, name, name, record);
          const rebound = dependencies.observeRoot(false);
          if (!rebound || !sameRoot(root, rebound))
            return Object.freeze({ status: "recovery_required" as const });
          const stored = readCommittedDockerRecoveryJson(
            consentPaths(root, name).file,
            name,
          );
          return validRecord(
            stored.value,
            expectedBoundary(policy, boundaryHash, root),
            dependencies.now(),
          )
            ? Object.freeze({ status: "confirmed" as const, boundaryHash })
            : Object.freeze({ status: "recovery_required" as const });
        }) ?? Object.freeze({ status: "recovery_required" as const })
      );
    } catch {
      return Object.freeze({ status: "recovery_required" as const });
    }
  }

  /**
   * revokeの処理を実行する。
   *
   * @responsibility revokeに対応する入力処理と結果生成を所有する。
   * @trace ARCH-000015
   * @input N/A: 実行時引数を受け取らない。
   * @returns revokeの計算結果を返す。
   * @precondition 「N/A: 実行時引数を受け取らない。」がrevokeの入力契約を満たす。
   * @postcondition revokeの責務を完了した結果だけを返す。
   * @effect N/A: revokeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure revokeは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant revokeは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: revokeはProcess内の同一Subsystemで完結する。
   * @security revokeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: revokeは共有非同期状態を持たない同期処理である。
   */
  function revoke() {
    try {
      // Explicit revoke may create the fixed protected RuntimeState root, but
      // it never treats an unobservable root as proof of residue zero.
      const root = dependencies.observeRoot(true);
      if (!root) return Object.freeze({ status: "recovery_required" as const });
      return (
        withConsentLock(dependencies, root, () =>
          revokePair(root)
            ? Object.freeze({ status: "revoked" as const })
            : Object.freeze({ status: "recovery_required" as const }),
        ) ?? Object.freeze({ status: "recovery_required" as const })
      );
    } catch {
      return Object.freeze({ status: "recovery_required" as const });
    }
  }

  return Object.freeze({ resolve, persist, revoke });
}

const productionRuntime = createRuntime(productionDependencies);

/**
 * runtimeForOperationの処理を実行する。
 *
 * @responsibility runtimeForOperationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input managementCapability: unknown
 * @returns runtimeForOperationの計算結果を返す。
 * @precondition 「managementCapability: unknown」がruntimeForOperationの入力契約を満たす。
 * @postcondition runtimeForOperationの責務を完了した結果だけを返す。
 * @effect N/A: runtimeForOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runtimeForOperationは独自の失敗分岐を所有しない。
 * @invariant runtimeForOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runtimeForOperationはProcess内の同一Subsystemで完結する。
 * @security runtimeForOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runtimeForOperationは共有非同期状態を持たない同期処理である。
 */
function runtimeForOperation(managementCapability: unknown) {
  const development =
    inspectRuntimeOwnedDevelopmentOperationContext(managementCapability);
  if (!development) return productionRuntime;
  return createRuntime({
    ...productionDependencies,
    observeRoot: (shouldInitializeIfMissing) =>
      development.checkNewWork()
        ? productionObserveRoot(
            shouldInitializeIfMissing,
            development.newWorkContext,
          )
        : null,
  });
}
/**
 * resolveRuntimeOwnedExternalSendConsentの処理を実行する。
 *
 * @responsibility resolveRuntimeOwnedExternalSendConsentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input policy: ExternalSendPolicy、managementCapability: unknown
 * @returns resolveRuntimeOwnedExternalSendConsentの計算結果を返す。
 * @precondition 「policy: ExternalSendPolicy、managementCapability: unknown」がresolveRuntimeOwnedExternalSendConsentの入力契約を満たす。
 * @postcondition resolveRuntimeOwnedExternalSendConsentの責務を完了した結果だけを返す。
 * @effect N/A: resolveRuntimeOwnedExternalSendConsentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRuntimeOwnedExternalSendConsentは独自の失敗分岐を所有しない。
 * @invariant resolveRuntimeOwnedExternalSendConsentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRuntimeOwnedExternalSendConsentはProcess内の同一Subsystemで完結する。
 * @security resolveRuntimeOwnedExternalSendConsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRuntimeOwnedExternalSendConsentは共有非同期状態を持たない同期処理である。
 */
export function resolveRuntimeOwnedExternalSendConsent(
  policy: ExternalSendPolicy,
  managementCapability?: unknown,
) {
  return runtimeForOperation(managementCapability).resolve(policy);
}
/**
 * persistRuntimeOwnedExternalSendConsentの処理を実行する。
 *
 * @responsibility persistRuntimeOwnedExternalSendConsentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input policy: ExternalSendPolicy、managementCapability: unknown
 * @returns persistRuntimeOwnedExternalSendConsentの計算結果を返す。
 * @precondition 「policy: ExternalSendPolicy、managementCapability: unknown」がpersistRuntimeOwnedExternalSendConsentの入力契約を満たす。
 * @postcondition persistRuntimeOwnedExternalSendConsentの責務を完了した結果だけを返す。
 * @effect N/A: persistRuntimeOwnedExternalSendConsentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: persistRuntimeOwnedExternalSendConsentは独自の失敗分岐を所有しない。
 * @invariant persistRuntimeOwnedExternalSendConsentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: persistRuntimeOwnedExternalSendConsentはProcess内の同一Subsystemで完結する。
 * @security persistRuntimeOwnedExternalSendConsentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: persistRuntimeOwnedExternalSendConsentは共有非同期状態を持たない同期処理である。
 */
export function persistRuntimeOwnedExternalSendConsent(
  policy: ExternalSendPolicy,
  managementCapability?: unknown,
) {
  return runtimeForOperation(managementCapability).persist(policy);
}
export const revokeRuntimeOwnedExternalSendConsent = productionRuntime.revoke;

/**
 * createIsolatedExternalSendConsentRuntimeCandidateの処理を実行する。
 *
 * @responsibility createIsolatedExternalSendConsentRuntimeCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input dependencies: ConsentDependencies
 * @returns createIsolatedExternalSendConsentRuntimeCandidateの計算結果を返す。
 * @precondition 「dependencies: ConsentDependencies」がcreateIsolatedExternalSendConsentRuntimeCandidateの入力契約を満たす。
 * @postcondition createIsolatedExternalSendConsentRuntimeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedExternalSendConsentRuntimeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedExternalSendConsentRuntimeCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedExternalSendConsentRuntimeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedExternalSendConsentRuntimeCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedExternalSendConsentRuntimeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedExternalSendConsentRuntimeCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedExternalSendConsentRuntimeCandidate(
  dependencies: ConsentDependencies,
) {
  return createRuntime(dependencies);
}

/**
 * describeExternalSendConsentRuntimeContractの処理を実行する。
 *
 * @responsibility describeExternalSendConsentRuntimeContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeExternalSendConsentRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeExternalSendConsentRuntimeContractの入力契約を満たす。
 * @postcondition describeExternalSendConsentRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeExternalSendConsentRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeExternalSendConsentRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeExternalSendConsentRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeExternalSendConsentRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeExternalSendConsentRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeExternalSendConsentRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeExternalSendConsentRuntimeContract() {
  return Object.freeze({
    contract: EXTERNAL_SEND_CONSENT_RUNTIME_CONTRACT,
    contractRevision: EXTERNAL_SEND_CONSENT_RUNTIME_CONTRACT_REVISION,
    lifecycle:
      "one_active_initial_consent_boundary_reused_until_replaced_expired_or_revoked",
    binding: Object.freeze([
      "policy_id",
      "policy_source_file_hash",
      "runtime_external_send_semantics_id",
      "selected_local_user",
      "protected_runtime_state_identity",
      "all_policy_provider_boundaries",
      "subscription_offering",
      "purpose_operations",
      "information_classification",
      "terms_policy_identity",
    ]),
    runtimeExternalSendSemanticsId: EXTERNAL_SEND_RUNTIME_SEMANTICS_ID,
    operationPreviewPersistent: false,
    lifetimeDays: 180,
    reapproval:
      "active_policy_boundary_change_expiry_revocation_missing_record_different_selected_user_or_runtime_state_binding_change",
    invalidation:
      "once_observed_invalid_active_generation_is_revoked_and_never_reused",
    explicitRevokeRootObservation:
      "verified_protected_root_initialization_allowed_unavailable_never_means_revoked",
    corruptionRecovery:
      "exact_fixed_pair_safe_revoke_else_manual_recovery_required",
    exactProviderAccountOrTenantIdentityVerified: false,
    apiKeyFallbackAllowed: false,
    additionalPurchaseAllowed: false,
    callerSuppliedPathAccepted: false,
    rawPathReported: false,
  });
}
