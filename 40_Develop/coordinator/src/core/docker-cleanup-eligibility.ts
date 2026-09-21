/**
 * DockerCleanupHandoffCandidateが扱う値の構造を表す。
 *
 * @responsibility DockerCleanupHandoffCandidateに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape DockerCleanupHandoffCandidateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerCleanupHandoffCandidateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerCleanupHandoffCandidateの宣言は外部境界を開かない。
 * @security N/A: DockerCleanupHandoffCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DockerCleanupHandoffCandidateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerCleanupHandoffCandidate = Readonly<{
  state: string;
  recoveryId: string;
  capability: object;
}>;

/**
 * DockerCleanupFinalizationCandidateが扱う値の構造を表す。
 *
 * @responsibility DockerCleanupFinalizationCandidateに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape DockerCleanupFinalizationCandidateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerCleanupFinalizationCandidateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerCleanupFinalizationCandidateの宣言は外部境界を開かない。
 * @security N/A: DockerCleanupFinalizationCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DockerCleanupFinalizationCandidateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerCleanupFinalizationCandidate = Readonly<{
  recoveryId: string;
  capability: object;
}>;

/**
 * RawDockerRecoveryProjectionが扱う値の構造を表す。
 *
 * @responsibility RawDockerRecoveryProjectionに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape RawDockerRecoveryProjectionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RawDockerRecoveryProjectionで宣言した値と責務の対応を維持する。
 * @boundary N/A: RawDockerRecoveryProjectionの宣言は外部境界を開かない。
 * @security N/A: RawDockerRecoveryProjectionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RawDockerRecoveryProjectionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RawDockerRecoveryProjection = Readonly<{
  singularPresent: boolean;
  singular: unknown;
  pluralPresent: boolean;
  plural: unknown;
}>;

const MAX_RECOVERY_IDS = 128;
const MAX_RECOVERY_ID_LENGTH = 512;

/**
 * recoveryIdの処理を実行する。
 *
 * @responsibility recoveryIdに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がrecoveryIdの入力契約を満たす。
 * @postcondition recoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: recoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryIdは独自の失敗分岐を所有しない。
 * @invariant recoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryIdはProcess内の同一Subsystemで完結する。
 * @security N/A: recoveryIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoveryIdは共有非同期状態を持たない同期処理である。
 */
function recoveryId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_RECOVERY_ID_LENGTH
  );
}

/**
 * exactDenseStringArrayの処理を実行する。
 *
 * @responsibility exactDenseStringArrayに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns exactDenseStringArrayの計算結果を返す。
 * @precondition 「value: unknown」がexactDenseStringArrayの入力契約を満たす。
 * @postcondition exactDenseStringArrayの責務を完了した結果だけを返す。
 * @effect N/A: exactDenseStringArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactDenseStringArrayは独自の失敗分岐を所有しない。
 * @invariant exactDenseStringArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactDenseStringArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: exactDenseStringArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: exactDenseStringArrayは共有非同期状態を持たない同期処理である。
 */
function exactDenseStringArray(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length > MAX_RECOVERY_IDS
  )
    return null;
  const ownKeys = Reflect.ownKeys(value);
  const expectedKeys = new Set<PropertyKey>([
    "length",
    ...Array.from({ length: value.length }, (_value, index) => String(index)),
  ]);
  if (
    ownKeys.length !== expectedKeys.size ||
    ownKeys.some((key) => !expectedKeys.has(key))
  )
    return null;
  const resultItems: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      !descriptor ||
      !("value" in descriptor) ||
      !recoveryId(descriptor.value)
    )
      return null;
    resultItems.push(descriptor.value);
  }
  if (new Set(resultItems).size !== resultItems.length) return null;
  return Object.freeze(resultItems);
}

/**
 * exactPlainRecordの処理を実行する。
 *
 * @responsibility exactPlainRecordに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedKeys: readonly string[]
 * @returns Readonly<Record<string, unknown>> | nullを返す。
 * @precondition 「value: unknown、expectedKeys: readonly string[]」がexactPlainRecordの入力契約を満たす。
 * @postcondition exactPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: exactPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactPlainRecordは独自の失敗分岐を所有しない。
 * @invariant exactPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactPlainRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: exactPlainRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: exactPlainRecordは共有非同期状態を持たない同期処理である。
 */
function exactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  if (
    !value ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value)
  )
    return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  )
    return null;
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      !descriptor ||
      !("value" in descriptor) ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      descriptor.enumerable !== true
    )
      return null;
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

/**
 * exactPlainRecordArrayの処理を実行する。
 *
 * @responsibility exactPlainRecordArrayに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedRecordKeys: readonly string[]
 * @returns exactPlainRecordArrayの計算結果を返す。
 * @precondition 「value: unknown、expectedRecordKeys: readonly string[]」がexactPlainRecordArrayの入力契約を満たす。
 * @postcondition exactPlainRecordArrayの責務を完了した結果だけを返す。
 * @effect N/A: exactPlainRecordArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactPlainRecordArrayは独自の失敗分岐を所有しない。
 * @invariant exactPlainRecordArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactPlainRecordArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: exactPlainRecordArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: exactPlainRecordArrayは共有非同期状態を持たない同期処理である。
 */
function exactPlainRecordArray(
  value: unknown,
  expectedRecordKeys: readonly string[],
) {
  if (
    !value ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length > MAX_RECOVERY_IDS
  )
    return null;
  const keys = Reflect.ownKeys(value);
  const expectedKeys = new Set<PropertyKey>([
    "length",
    ...Array.from({ length: value.length }, (_value, index) => String(index)),
  ]);
  if (
    keys.length !== expectedKeys.size ||
    keys.some((key) => !expectedKeys.has(key))
  )
    return null;
  const snapshotItems: Readonly<Record<string, unknown>>[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor)) return null;
    const record = exactPlainRecord(descriptor.value, expectedRecordKeys);
    if (!record) return null;
    snapshotItems.push(record);
  }
  return Object.freeze(snapshotItems);
}

/**
 * snapshotInputの処理を実行する。
 *
 * @responsibility snapshotInputに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns snapshotInputの計算結果を返す。
 * @precondition 「value: unknown」がsnapshotInputの入力契約を満たす。
 * @postcondition snapshotInputの責務を完了した結果だけを返す。
 * @effect N/A: snapshotInputは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: snapshotInputは独自の失敗分岐を所有しない。
 * @invariant snapshotInputは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotInputはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotInputはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotInputは共有非同期状態を持たない同期処理である。
 */
function snapshotInput(value: unknown) {
  const input = exactPlainRecord(value, ["raw", "handoffs", "finalizations"]);
  if (!input) return null;
  const raw = exactPlainRecord(input.raw, [
    "singularPresent",
    "singular",
    "pluralPresent",
    "plural",
  ]);
  const handoffs = exactPlainRecordArray(input.handoffs, [
    "state",
    "recoveryId",
    "capability",
  ]);
  const finalizations = exactPlainRecordArray(input.finalizations, [
    "recoveryId",
    "capability",
  ]);
  return raw && handoffs && finalizations
    ? Object.freeze({ raw, handoffs, finalizations })
    : null;
}

/**
 * canonicalRawIdsの処理を実行する。
 *
 * @responsibility canonicalRawIdsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input raw: RawDockerRecoveryProjection
 * @returns canonicalRawIdsの計算結果を返す。
 * @precondition 「raw: RawDockerRecoveryProjection」がcanonicalRawIdsの入力契約を満たす。
 * @postcondition canonicalRawIdsの責務を完了した結果だけを返す。
 * @effect N/A: canonicalRawIdsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalRawIdsは独自の失敗分岐を所有しない。
 * @invariant canonicalRawIdsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalRawIdsはProcess内の同一Subsystemで完結する。
 * @security N/A: canonicalRawIdsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: canonicalRawIdsは共有非同期状態を持たない同期処理である。
 */
function canonicalRawIds(raw: RawDockerRecoveryProjection) {
  if (!raw.singularPresent || !raw.pluralPresent) return null;
  const singular =
    raw.singular === null
      ? null
      : recoveryId(raw.singular)
        ? raw.singular
        : undefined;
  if (singular === undefined) return null;
  const pluralItems = exactDenseStringArray(raw.plural);
  if (!pluralItems) return null;
  if (pluralItems.length === 0 && singular !== null) return null;
  if (pluralItems.length === 1 && singular !== pluralItems[0]) return null;
  if (pluralItems.length > 1 && singular !== null) return null;
  return Object.freeze(pluralItems);
}

/**
 * evaluateの処理を実行する。
 *
 * @responsibility evaluateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input inputValue: unknown
 * @returns evaluateの計算結果を返す。
 * @precondition 「inputValue: unknown」がevaluateの入力契約を満たす。
 * @postcondition evaluateの責務を完了した結果だけを返す。
 * @effect N/A: evaluateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateは独自の失敗分岐を所有しない。
 * @invariant evaluateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateはProcess内の同一Subsystemで完結する。
 * @security N/A: evaluateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: evaluateは共有非同期状態を持たない同期処理である。
 */
function evaluate(inputValue: unknown) {
  const input = snapshotInput(inputValue);
  if (!input) return Object.freeze({ eligible: false, reason: "raw_invalid" });
  const rawIds = canonicalRawIds(input.raw as RawDockerRecoveryProjection);
  if (!rawIds) return Object.freeze({ eligible: false, reason: "raw_invalid" });
  const pendingItems = input.handoffs.filter(
    (handoff) => handoff.state !== "finalized",
  );
  const pendingIds = new Set<string>();
  const pendingCapabilities = new Set<object>();
  for (const handoff of pendingItems) {
    if (
      handoff.state !== "finalizable" ||
      !recoveryId(handoff.recoveryId) ||
      typeof handoff.capability !== "object" ||
      handoff.capability === null ||
      pendingIds.has(handoff.recoveryId) ||
      pendingCapabilities.has(handoff.capability)
    )
      return Object.freeze({ eligible: false, reason: "handoff_invalid" });
    const exactItems = input.finalizations.filter(
      (candidate) =>
        candidate.recoveryId === handoff.recoveryId &&
        candidate.capability === handoff.capability,
    );
    const isConflicting = input.finalizations.some(
      (candidate) =>
        (candidate.recoveryId === handoff.recoveryId ||
          candidate.capability === handoff.capability) &&
        (candidate.recoveryId !== handoff.recoveryId ||
          candidate.capability !== handoff.capability),
    );
    if (exactItems.length !== 1 || isConflicting)
      return Object.freeze({
        eligible: false,
        reason: "finalization_mismatch",
      });
    pendingIds.add(handoff.recoveryId);
    pendingCapabilities.add(handoff.capability);
  }
  if (
    input.finalizations.length !== pendingItems.length ||
    rawIds.length !== pendingIds.size ||
    rawIds.some((id) => !pendingIds.has(id))
  )
    return Object.freeze({ eligible: false, reason: "set_mismatch" });
  return Object.freeze({ eligible: true, reason: "exact_match" });
}

/**
 * evaluateManagedDockerCleanupEligibilityの処理を実行する。
 *
 * @responsibility evaluateManagedDockerCleanupEligibilityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input input: unknown
 * @returns evaluateManagedDockerCleanupEligibilityの計算結果を返す。
 * @precondition 「input: unknown」がevaluateManagedDockerCleanupEligibilityの入力契約を満たす。
 * @postcondition evaluateManagedDockerCleanupEligibilityの責務を完了した結果だけを返す。
 * @effect N/A: evaluateManagedDockerCleanupEligibilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure evaluateManagedDockerCleanupEligibilityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant evaluateManagedDockerCleanupEligibilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateManagedDockerCleanupEligibilityはProcess内の同一Subsystemで完結する。
 * @security N/A: evaluateManagedDockerCleanupEligibilityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: evaluateManagedDockerCleanupEligibilityは共有非同期状態を持たない同期処理である。
 */
export function evaluateManagedDockerCleanupEligibility(input: unknown) {
  try {
    return evaluate(input);
  } catch {
    return Object.freeze({ eligible: false, reason: "raw_invalid" });
  }
}

import { types as utilTypes } from "node:util";
