/**
 * 共有状態の値・相関・Repository結合を純粋に検査する。
 * @responsibility 共有状態の値・相関・Repository結合を純粋に検査する。
 * @trace ARCH-000004
 * @boundary Coordinatorの状態値と意味Owner。
 * @security 保存・外部実行・Authorityの発行は行わない。
 */
import type { CoordinatorLeaseKind as LeaseKind } from "./persistence.ts";
import type { ProjectQueueEntry, SingleTaskRecord } from "../task/types.ts";
import { types as utilTypes } from "node:util";
import { createHash } from "node:crypto";

export const COORDINATOR_STATE_CONTRACT =
  "crdd-coordinator/project-state/v2" as const;

export const COORDINATOR_MAXIMUM_CONCURRENCY = 5;

export const COORDINATOR_MAXIMUM_OBJECTIVES = 128;

export const COORDINATOR_MAXIMUM_TASKS = 1024;

export const PROJECT_OBJECTIVE_STATES = Object.freeze([
  "planned",
  "executing",
  "integration_pending",
  "accepted",
  "returned",
  "blocked",
  "cancelled",
] as const);

export const PROJECT_TASK_STATES = Object.freeze([
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
] as const);

/**
 * Identityが有効か判定する。
 *
 * @responsibility Identityの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns 共有Identityの形式が成立した場合だけ文字列へ型を絞る。
 * @precondition 「value: unknown」がvalidIdentityの入力契約を満たす。
 * @postcondition validIdentityの責務を完了した結果だけを返す。
 * @effect N/A: validIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdentityは独自の失敗分岐を所有しない。
 * @invariant validIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: validIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validIdentityは共有非同期状態を持たない同期処理である。
 */
export function validIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Revisionが有効か判定する。
 *
 * @responsibility Revisionの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns validRevisionの計算結果を返す。
 * @precondition 「value: unknown」がvalidRevisionの入力契約を満たす。
 * @postcondition validRevisionの責務を完了した結果だけを返す。
 * @effect N/A: validRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRevisionは独自の失敗分岐を所有しない。
 * @invariant validRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRevisionはProcess内の同一Subsystemで完結する。
 * @security N/A: validRevisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validRevisionは共有非同期状態を持たない同期処理である。
 */
export function validRevision(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

/**
 * Coordinator 回復 Identityかを判定する。
 *
 * @responsibility Coordinator 回復 Identityの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisCoordinatorRecoveryIdentityの入力契約を満たす。
 * @postcondition isCoordinatorRecoveryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: isCoordinatorRecoveryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isCoordinatorRecoveryIdentityは独自の失敗分岐を所有しない。
 * @invariant isCoordinatorRecoveryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCoordinatorRecoveryIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: isCoordinatorRecoveryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isCoordinatorRecoveryIdentityは共有非同期状態を持たない同期処理である。
 */
export function isCoordinatorRecoveryIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Stringsを重複のない順序へ正規化する。
 *
 * @responsibility Stringsの重複判定、順序規則、結果集合境界を所有する。
 * @trace ARCH-000004
 * @input values: readonly string[]、maximum: number、kind: "identity_or_path" | "repository_path" | "human_text"
 * @returns readonly string[] | nullを返す。
 * @precondition 「values: readonly string[]、maximum: number、kind: "identity_or_path" | "repository_path" | "human_text"」がuniqueStringsの入力契約を満たす。
 * @postcondition uniqueStringsの責務を完了した結果だけを返す。
 * @effect N/A: uniqueStringsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: uniqueStringsは独自の失敗分岐を所有しない。
 * @invariant uniqueStringsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: uniqueStringsはProcess内の同一Subsystemで完結する。
 * @security N/A: uniqueStringsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: uniqueStringsは共有非同期状態を持たない同期処理である。
 */
export function uniqueStrings(
  values: readonly string[],
  maximum: number,
  kind: "identity_or_path" | "repository_path" | "human_text",
): readonly string[] | null {
  if (values.length > maximum) return null;
  const resultItems: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0 || value.length > 512)
      return null;
    const normalized =
      kind === "repository_path"
        ? normalizeRepositoryRelativePath(value)
        : kind === "identity_or_path"
          ? value.replaceAll("\\", "/")
          : value;
    if (normalized === null) return null;
    const key = kind === "human_text" ? normalized : normalized.toUpperCase();
    if (seen.has(key)) return null;
    seen.add(key);
    resultItems.push(normalized);
  }
  return Object.freeze(resultItems);
}

/**
 * Coordinator 状態 契約の公開契約を記述する。
 *
 * @responsibility Coordinator 状態 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCoordinatorStateContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCoordinatorStateContractの入力契約を満たす。
 * @postcondition describeCoordinatorStateContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCoordinatorStateContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCoordinatorStateContractは独自の失敗分岐を所有しない。
 * @invariant describeCoordinatorStateContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeCoordinatorStateContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeCoordinatorStateContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeCoordinatorStateContractは共有非同期状態を持たない同期処理である。
 */
export function describeCoordinatorStateContract() {
  return Object.freeze({
    contract: COORDINATOR_STATE_CONTRACT,
    maximumConcurrency: COORDINATOR_MAXIMUM_CONCURRENCY,
    capacityStates: Object.freeze([
      "starting",
      "running",
      "cleanup_pending",
      "recovery_required_without_cleanup",
    ]),
    lockContract:
      "project_operation_then_short_project_state_transaction_never_held_across_single_task_runtime",
    staleResult:
      "generation_attempt_and_operation_identity_mismatch_blocks_without_projection",
    acceptanceContract:
      "task_completion_then_objective_integration_then_milestone_integration",
  });
}

/**
 * 単発記録とQueueの共同状態を確認する。
 * @responsibility 未回収の完了表示と段階混同をcodecで拒否する。
 * @trace ARCH-000004
 * @input JSONから確認したQueueと単発記録。
 * @returns 共同状態が成立する場合のみtrue。
 * @precondition 単発記録の閉検査が成功している。
 * @postcondition Owner喪失を成功へ変換しない。
 * @effect なし。
 * @failure 不整合はfalse。
 * @invariant Project計画用Queueへ適用しない。
 * @boundary 既存Snapshot codec。
 * @security 状態名から実資源の不存在を推定しない。
 * @concurrency 同期値検査。
 */
export function singleTaskQueueIsConsistent(
  queue: Pick<
    ProjectQueueEntry,
    "state" | "ownerGeneration" | "resumeCondition" | "resultReference"
  >,
  record: SingleTaskRecord,
): boolean {
  if (
    queue.state === "recovery_required" &&
    queue.ownerGeneration === null &&
    ["owner_loss", "exact_recovery"].includes(queue.resumeCondition ?? "") &&
    record.phase !== "settled"
  )
    return true;
  if (record.phase === "accepted")
    return (
      queue.state === "queued" &&
      queue.ownerGeneration === null &&
      queue.resumeCondition === null &&
      queue.resultReference === null
    );
  if (record.phase !== "settled")
    return (
      queue.state === "running" &&
      queue.ownerGeneration !== null &&
      queue.resumeCondition === null
    );
  if (!record.cleanupConfirmed || record.recoveryIds.length > 0)
    return queue.state === "recovery_required";
  return (
    queue.state ===
      (record.status === "cancelled" ? "cancelled" : "completed") &&
    queue.resumeCondition === null
  );
}

/**
 * plain-data-snapshotで使用するArray Snapshotの値契約を定義する。
 *
 * @responsibility Array SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ArraySnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArraySnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArraySnapshotの宣言は外部境界を開かない。
 * @security N/A: ArraySnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArraySnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ArraySnapshot<T> =
  | Readonly<{ status: "ok"; value: readonly T[] }>
  | Readonly<{ status: "blocked"; value: null }>;

/**
 * Plain 記録かを判定する。
 *
 * @responsibility Plain 記録の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisPlainRecordの入力契約を満たす。
 * @postcondition isPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: isPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isPlainRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isPlainRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: isPlainRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isPlainRecordは共有非同期状態を持たない同期処理である。
 */
function isPlainRecord(value: unknown): value is object {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * Data Descriptorかを判定する。
 *
 * @responsibility Data Descriptorの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input descriptor: PropertyDescriptor | undefined、shouldBeEnumerable
 * @returns descriptor is PropertyDescriptor & { value: unknown }を返す。
 * @precondition 「descriptor: PropertyDescriptor | undefined、shouldBeEnumerable」がisDataDescriptorの入力契約を満たす。
 * @postcondition isDataDescriptorの責務を完了した結果だけを返す。
 * @effect N/A: isDataDescriptorは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isDataDescriptorは独自の失敗分岐を所有しない。
 * @invariant isDataDescriptorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDataDescriptorはProcess内の同一Subsystemで完結する。
 * @security N/A: isDataDescriptorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isDataDescriptorは共有非同期状態を持たない同期処理である。
 */
function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
  shouldBeEnumerable = true,
): descriptor is PropertyDescriptor & { value: unknown } {
  return Boolean(
    descriptor !== undefined &&
      Object.hasOwn(descriptor, "value") &&
      descriptor.get === undefined &&
      descriptor.set === undefined &&
      (!shouldBeEnumerable || descriptor.enumerable === true),
  );
}

/**
 * Plain 記録を所有Snapshotへ変換する。
 *
 * @responsibility Plain 記録の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、expectedKeys: ReadonlySet<K>
 * @returns Readonly<Record<K, unknown>> | nullを返す。
 * @precondition 「value: unknown、expectedKeys: ReadonlySet<K>」がsnapshotPlainRecordの入力契約を満たす。
 * @postcondition snapshotPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: snapshotPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotPlainRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotPlainRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotPlainRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotPlainRecordは共有非同期状態を持たない同期処理である。
 */
export function snapshotPlainRecord<const K extends string>(
  value: unknown,
  expectedKeys: ReadonlySet<K>,
): Readonly<Record<K, unknown>> | null {
  try {
    if (!isPlainRecord(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== expectedKeys.size ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.has(key as K))
    )
      return null;
    const snapshot = Object.create(null) as Record<K, unknown>;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!isDataDescriptor(descriptor)) return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

/**
 * Plain Arrayを所有Snapshotへ変換する。
 *
 * @responsibility Plain Arrayの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximumLength: number
 * @returns ArraySnapshot<T>を返す。
 * @precondition 「value: unknown、maximumLength: number」がsnapshotPlainArrayの入力契約を満たす。
 * @postcondition snapshotPlainArrayの責務を完了した結果だけを返す。
 * @effect N/A: snapshotPlainArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotPlainArrayは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotPlainArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotPlainArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotPlainArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotPlainArrayは共有非同期状態を持たない同期処理である。
 */
export function snapshotPlainArray<T = unknown>(
  value: unknown,
  maximumLength: number,
): ArraySnapshot<T> {
  try {
    if (
      !Array.isArray(value) ||
      utilTypes.isProxy(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      !Number.isSafeInteger(maximumLength) ||
      maximumLength < 0
    )
      return Object.freeze({ status: "blocked", value: null });
    const initialLength = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !isDataDescriptor(initialLength, false) ||
      !Number.isSafeInteger(initialLength.value) ||
      initialLength.value < 0 ||
      initialLength.value > maximumLength
    )
      return Object.freeze({ status: "blocked", value: null });
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    const currentLength = (
      descriptors as unknown as Record<string, PropertyDescriptor | undefined>
    ).length;
    if (
      keys.length !== initialLength.value + 1 ||
      !isDataDescriptor(currentLength, false) ||
      currentLength.value !== initialLength.value
    )
      return Object.freeze({ status: "blocked", value: null });
    const snapshotItems: T[] = [];
    for (let index = 0; index < initialLength.value; index += 1) {
      const key = String(index);
      const descriptor = descriptors[key];
      if (!isDataDescriptor(descriptor))
        return Object.freeze({ status: "blocked", value: null });
      snapshotItems.push(descriptor.value as T);
    }
    return Object.freeze({
      status: "ok" as const,
      value: Object.freeze(snapshotItems),
    });
  } catch {
    return Object.freeze({ status: "blocked", value: null });
  }
}

/**
 * Normalize a bounded repository-relative path without consulting the Host filesystem.
 *
 * @responsibility Repository Relative Pathの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns string | nullを返す。
 * @precondition 「value: unknown」がnormalizeRepositoryRelativePathの入力契約を満たす。
 * @postcondition normalizeRepositoryRelativePathの責務を完了した結果だけを返す。
 * @effect N/A: normalizeRepositoryRelativePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeRepositoryRelativePathは独自の失敗分岐を所有しない。
 * @invariant normalizeRepositoryRelativePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeRepositoryRelativePathはProcess内の同一Subsystemで完結する。
 * @security N/A: normalizeRepositoryRelativePathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: normalizeRepositoryRelativePathは共有非同期状態を持たない同期処理である。
 */
export function normalizeRepositoryRelativePath(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 512 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    return null;
  const normalized = value.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:($|\/)/u.test(normalized) ||
    normalized
      .split("/")
      .some((segment) => segment === "" || segment === "." || segment === "..")
  )
    return null;
  return normalized;
}

/**
 * repository Path Withinを決定する。
 *
 * @responsibility repository Path Withinの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: string、roots: readonly string[]
 * @returns repositoryPathWithinの計算結果を返す。
 * @precondition 「candidate: string、roots: readonly string[]」がrepositoryPathWithinの入力契約を満たす。
 * @postcondition repositoryPathWithinの責務を完了した結果だけを返す。
 * @effect N/A: repositoryPathWithinは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: repositoryPathWithinは独自の失敗分岐を所有しない。
 * @invariant repositoryPathWithinは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: repositoryPathWithinはProcess内の同一Subsystemで完結する。
 * @security N/A: repositoryPathWithinはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: repositoryPathWithinは共有非同期状態を持たない同期処理である。
 */
export function repositoryPathWithin(
  candidate: string,
  roots: readonly string[],
) {
  const normalizedCandidate = normalizeRepositoryRelativePath(candidate);
  if (normalizedCandidate === null) return false;
  const candidateKey = normalizedCandidate.toUpperCase();
  return roots.some((rootValue) => {
    const root = normalizeRepositoryRelativePath(rootValue);
    if (root === null) return false;
    const rootKey = root.toUpperCase();
    return candidateKey === rootKey || candidateKey.startsWith(`${rootKey}/`);
  });
}

/**
 * 検証済みRepository Rootの保存Bindingを得る。
 * @responsibility 従来のstable(binding, root)と同じbyte列・長さを保つ。
 * @trace ARCH-000004
 * @input 検証済みのexact Root文字列。
 * @returns 既存形式のbinding ID。
 * @precondition 呼出側が今回要求の入力範囲を確定している。
 * @postcondition 確認できた値だけを返し、観測不能を成功へ変換しない。
 * @effect N/A: 純粋計算だけ。
 * @failure N/A: 固定文字列をHash化する。
 * @invariant 現在状態と履歴の観測を独立保持する。
 * @boundary Coordinator活動Ownerと内部Consumer。
 * @security 資格、内部Pathと保存Bindingを公開しない。
 * @concurrency 一回の要求を同期観測し、共有Cacheを持たない。
 */
export function deriveCoordinatorRepositoryBindingId(root: string): string {
  return `binding-${createHash("sha256").update(root).digest("hex").slice(0, 40)}`;
}

/**
 * 宣言したJSON値を再帰的なkey順序で一意に符号化する。
 * @responsibility 不正型・accessor・Proxy・過剰深度を拒否し、配列順は保持する。
 * @trace ARCH-000008
 * @input value: 保存候補のplain JSON値、depth: 内部再帰深度。
 * @returns sorted-key JSON本文。
 * @precondition N/A: 不正値も受け取り拒否する。
 * @postcondition 同じ値のobject key順に依存しない本文を返す。
 * @effect N/A: メモリ内の値だけを扱う。
 * @failure 不正型、循環・過剰深度、accessorとProxyでは例外。
 * @invariant 配列の意味順序は並べ替えない。
 * @boundary 呼出し側の値と保存byte列。
 * @security getterやProxy trapを評価しない。
 * @concurrency N/A: 同期の値変換で共有状態を更新しない。
 */
export function encodeCoordinatorStateValue(value: unknown, depth = 0): string {
  if (depth > 32 || utilTypes.isProxy(value))
    throw new Error("coordinator_state_value_invalid");
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return JSON.stringify(value);
  if (!value || typeof value !== "object")
    throw new Error("coordinator_state_value_invalid");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    Object.values(descriptors).some((d) => !Object.hasOwn(d, "value"))
  )
    throw new Error("coordinator_state_value_invalid");
  if (Array.isArray(value)) {
    if (
      keys.length !== value.length + 1 ||
      !Object.hasOwn(descriptors, "length")
    )
      throw new Error("coordinator_state_value_invalid");
    const items: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor) throw new Error("coordinator_state_value_invalid");
      items.push(encodeCoordinatorStateValue(descriptor.value, depth + 1));
    }
    return `[${items.join(",")}]`;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new Error("coordinator_state_value_invalid");
  return `{${Object.keys(descriptors)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${encodeCoordinatorStateValue(descriptors[key]?.value, depth + 1)}`,
    )
    .join(",")}}`;
}

/**
 * 現在状態と固定情報に使用する内容Hashを導出する。
 * @responsibility 宣言したsorted-key UTF-8本文と一つのLFへ結合する。
 * @trace ARCH-000008
 * @input value: plain JSON値。
 * @returns 内容のSHA-256。
 * @precondition 値が固定encodingで表現可能。
 * @postcondition objectの挿入順に依存しない。
 * @effect N/A: メモリ内のHash計算だけ。
 * @failure 不正値はencoderの例外を返す。
 * @invariant 可変SnapshotのHashと固定操作情報のHashを混同しない。
 * @boundary 保存内容の相関。
 * @security HashをAuthorityとして発行しない。
 * @concurrency N/A: 共有状態なし。
 */
export function coordinatorStateContentHash(value: unknown): string {
  return createHash("sha256")
    .update(`${encodeCoordinatorStateValue(value)}\n`, "utf8")
    .digest("hex");
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
 * この保存モデルが受け取るSHA-256文字列を検査する。
 * @responsibility 一般Helperを公開せず、保存値の固定文法だけを検査する。
 * @trace ARCH-000008
 * @input value: 未信頼値。
 * @returns 小文字64桁hexの場合だけtrue。
 * @precondition 任意の値を受け取り、ObjectのPropertyを読まない。
 * @postcondition trueの場合だけ元の値を文字列として扱える。
 * @effect N/A: 共有状態や外部資源を変更しない。
 * @failure 不正文法・非文字列はfalse。強制変換や例外を使わない。
 * @invariant 大小文字・空白・桁数を補正しない。
 * @boundary N/A: 同一モデル内の値検査だけ。
 * @security Hash文法の一致から回復資格や真正性を推定しない。
 * @concurrency N/A: 同期局所処理で共有状態を持たない。
 */
export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

export const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

export const HASH = /^[0-9a-f]{64}$/u;

export const REVISION = /^[0-9a-f]{40,64}$/u;

/**
 * Keysが完全一致するか判定する。
 *
 * @responsibility Keysの比較対象、完全一致条件、判定結果境界を所有する。
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
export function exactKeys(value: object, keys: readonly string[]) {
  const actualValues = Object.keys(value).sort();
  const expectedValues = [...keys].sort();
  return (
    actualValues.length === expectedValues.length &&
    actualValues.every((key, index) => key === expectedValues[index])
  );
}

/**
 * ObjectをPlain Dataとして検証する。
 *
 * @responsibility Objectの許可Property、入れ子値、拒否境界を所有する。
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
export function plainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * string Arrayを決定する。
 *
 * @responsibility string Arrayの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
export function stringArray(
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
 * nullable Idを決定する。
 *
 * @responsibility nullable Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
export function nullableId(value: unknown) {
  return value === null || validId(value);
}

/**
 * nullable 候補 Idを決定する。
 *
 * @responsibility nullable 候補 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
export function nullableCandidateId(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value))
  );
}

/**
 * nullable 回復 Idを決定する。
 *
 * @responsibility nullable 回復 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
export function nullableRecoveryId(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value))
  );
}

// Queue results may carry an exact opaque candidate or recovery reference.
// These references use the same closed character set as stable IDs, but can
// exceed the 128-character limit of ordinary project-local identifiers.

/**
 * 結果 Referenceが有効か判定する。
 *
 * @responsibility 結果 Referenceの有効条件、拒否条件、判定結果境界を所有する。
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
export function validResultReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * nullable 結果 Referenceを決定する。
 *
 * @responsibility nullable 結果 Referenceの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
export function nullableResultReference(value: unknown) {
  return value === null || validResultReference(value);
}

/**
 * lease Acquisition 回復 Idを決定する。
 *
 * @responsibility lease Acquisition 回復 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
export function leaseAcquisitionRecoveryId(
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
 * lease Identityを決定する。
 *
 * @responsibility lease Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
export function leaseIdentity(
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
 * durable-foundationのHashを算出する。
 *
 * @responsibility durable-foundationの入力byte列、Hash algorithm、算出結果の境界を所有する。
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
export function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Idが有効か判定する。
 *
 * @responsibility Idの有効条件、拒否条件、判定結果境界を所有する。
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
export function validId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}
