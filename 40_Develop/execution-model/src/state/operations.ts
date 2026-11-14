/**
 * Stateの主体IDと記録値の構築・捕捉・変換を所有する。
 * @responsibility モデル候補・保存・Authorityに依存せず同じ値処理を提供する。
 * @trace ARCH-000004、ARCH-000008
 */
import { createHash } from "node:crypto";
import { STORAGE_CONTRACT } from "./types.ts";
import { types } from "node:util";
import type {
  LeaseKind,
  LeaseEvidenceContent,
  LeaseEvidenceEnvelope,
  ArraySnapshot,
  DataDescriptor,
  PlainArraySnapshot,
} from "./types.ts";

/** ローカル主体とAM主体を混同しない固定namespace。 */
const LOCAL_EMAIL_PREFIX = "local.email.";

/**
 * 明示メールからローカル主体IDを構築する。
 * @responsibility 同じ入力検査とprefixを使い、本人認証・正規化・OS探索を行わない。
 * @trace ARCH-000008
 * @input email: 入口が明示したローカル利用者のメール。
 * @returns 同じメールを保持する主体ID、又は入力不正のnull。
 * @precondition 主体を決める入口がメールを明示する。
 * @postcondition メール本文をHash化・正規化・補完しない。
 * @effect N/A: 同期の値構築だけ。
 * @failure 型・形式不正はnull。別主体へfallbackしない。
 * @invariant 保存やOSから主体を勝手に解決しない。
 * @boundary ローカル主体の値契約。AM認証の証明ではない。
 * @security IDの構築を認証・認可の証明にしない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function createLocalPrincipalId(email: unknown): string | null {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@<>\\\u0000-\u001f\u007f]+@[^\s@<>\\\u0000-\u001f\u007f]+$/u.test(
      email,
    )
  )
    return null;
  return `${LOCAL_EMAIL_PREFIX}${email}`;
}

/** 主体の形式だけを確認する。予約prefixから既存形式へfallbackしない。 */
export function isPrincipalId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.startsWith(LOCAL_EMAIL_PREFIX))
    return (
      createLocalPrincipalId(value.slice(LOCAL_EMAIL_PREFIX.length)) === value
    );
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value);
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
export function encodeStateValue(value: unknown, depth = 0): string {
  if (depth > 32 || types.isProxy(value))
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
      items.push(encodeStateValue(descriptor.value, depth + 1));
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
        `${JSON.stringify(key)}:${encodeStateValue(descriptors[key]?.value, depth + 1)}`,
    )
    .join(",")}}`;
}

/**
 * 記録 Keysが完全一致するか判定する。
 *
 * @responsibility 記録 Keysの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、keys: readonly string[]
 * @returns hasExecutionStateRecordKeysの計算結果を返す。
 * @precondition 「value: unknown、keys: readonly string[]」がhasExecutionStateRecordKeysの入力契約を満たす。
 * @postcondition hasExecutionStateRecordKeysの責務を完了した結果だけを返す。
 * @effect N/A: hasExecutionStateRecordKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hasExecutionStateRecordKeysは独自の失敗分岐を所有しない。
 * @invariant hasExecutionStateRecordKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hasExecutionStateRecordKeysはProcess内の同一Subsystemで完結する。
 * @security hasExecutionStateRecordKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hasExecutionStateRecordKeysは共有非同期状態を持たない同期処理である。
 */
export function hasExecutionStateRecordKeys(
  value: unknown,
  keys: readonly string[],
) {
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

/**
 * Plain 記録を所有Snapshotへ変換する。
 *
 * @responsibility Plain 記録の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、expectedKeys: ReadonlySet<K>
 * @returns Readonly<Record<K, unknown>> | nullを返す。
 * @precondition 「value: unknown、expectedKeys: ReadonlySet<K>」がsnapshotStateRecordの入力契約を満たす。
 * @postcondition snapshotStateRecordの責務を完了した結果だけを返す。
 * @effect N/A: snapshotStateRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotStateRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotStateRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotStateRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotStateRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotStateRecordは共有非同期状態を持たない同期処理である。
 */
export function snapshotStateRecord<const K extends string>(
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
export function isPlainRecord(value: unknown): value is object {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      types.isProxy(value)
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
export function isDataDescriptor(
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
 * data Descriptorを決定する。
 *
 * @responsibility data Descriptorの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000014
 * @input descriptor: PropertyDescriptor | undefined、shouldBeEnumerable
 * @returns descriptor is DataDescriptorを返す。
 * @precondition 「descriptor: PropertyDescriptor | undefined、shouldBeEnumerable」がdataDescriptorの入力契約を満たす。
 * @postcondition dataDescriptorの責務を完了した結果だけを返す。
 * @effect N/A: dataDescriptorは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: dataDescriptorは独自の失敗分岐を所有しない。
 * @invariant dataDescriptorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: dataDescriptorはProcess内の同一Subsystemで完結する。
 * @security dataDescriptorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dataDescriptorは共有非同期状態を持たない同期処理である。
 */
function dataDescriptor(
  descriptor: PropertyDescriptor | undefined,
  shouldBeEnumerable = true,
): descriptor is DataDescriptor {
  return Boolean(
    descriptor &&
      Object.hasOwn(descriptor, "value") &&
      descriptor.get === undefined &&
      descriptor.set === undefined &&
      (!shouldBeEnumerable || descriptor.enumerable === true),
  );
}

/**
 * Plain Arrayを所有Snapshotへ変換する。
 *
 * @responsibility Plain Arrayの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown、maximumLength: number
 * @returns PlainArraySnapshot<T>を返す。
 * @precondition 「value: unknown、maximumLength: number」がsnapshotPlainArrayの入力契約を満たす。
 * @postcondition snapshotPlainArrayの責務を完了した結果だけを返す。
 * @effect N/A: snapshotPlainArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotPlainArrayは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotPlainArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotPlainArrayはProcess内の同一Subsystemで完結する。
 * @security snapshotPlainArrayはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotPlainArrayは共有非同期状態を持たない同期処理である。
 */
export function snapshotPlainArray<T = unknown>(
  value: unknown,
  maximumLength: number,
): PlainArraySnapshot<T> {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      types.isProxy(value) ||
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      return Object.freeze({
        status: "blocked",
        reason: "not_plain_array",
        value: null,
      });
    }
    const initialLength = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !dataDescriptor(initialLength, false) ||
      !Number.isSafeInteger(initialLength.value) ||
      initialLength.value < 0
    )
      return Object.freeze({
        status: "blocked",
        reason: "array_length_invalid",
        value: null,
      });
    if (initialLength.value > maximumLength) {
      return Object.freeze({
        status: "blocked",
        reason: "array_length_exceeded",
        value: null,
      });
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    const currentLength = (
      descriptors as unknown as Record<string, PropertyDescriptor | undefined>
    ).length;
    if (
      keys.length !== initialLength.value + 1 ||
      !dataDescriptor(currentLength, false) ||
      currentLength.value !== initialLength.value
    ) {
      return Object.freeze({
        status: "blocked",
        reason: "array_shape_invalid",
        value: null,
      });
    }
    const snapshotItems: T[] = [];
    for (let index = 0; index < initialLength.value; index += 1) {
      const key = String(index);
      const descriptor = descriptors[key];
      if (!dataDescriptor(descriptor)) {
        return Object.freeze({
          status: "blocked",
          reason: "array_shape_invalid",
          value: null,
        });
      }
      snapshotItems.push(descriptor.value as T);
    }
    return Object.freeze({
      status: "ok",
      reason: null,
      value: Object.freeze(snapshotItems),
    });
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "array_input_invalid",
      value: null,
    });
  }
}

/**
 * HostのFilesystemを参照せずRepository相対Pathを正規化する。
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

/**
 * ObjectをPlain Dataとして検証する。
 *
 * @responsibility Objectの許可Property、入れ子値、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がisStateObjectの入力契約を満たす。
 * @postcondition isStateObjectの責務を完了した結果だけを返す。
 * @effect N/A: isStateObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isStateObjectは独自の失敗分岐を所有しない。
 * @invariant isStateObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isStateObjectはProcess内の同一Subsystemで完結する。
 * @security isStateObjectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isStateObjectは共有非同期状態を持たない同期処理である。
 */
export function isStateObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Keysが完全一致するか判定する。
 *
 * @responsibility Keysの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: object、keys: readonly string[]
 * @returns hasStateKeysの計算結果を返す。
 * @precondition 「value: object、keys: readonly string[]」がhasStateKeysの入力契約を満たす。
 * @postcondition hasStateKeysの責務を完了した結果だけを返す。
 * @effect N/A: hasStateKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hasStateKeysは独自の失敗分岐を所有しない。
 * @invariant hasStateKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hasStateKeysはProcess内の同一Subsystemで完結する。
 * @security hasStateKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hasStateKeysは共有非同期状態を持たない同期処理である。
 */
export function hasStateKeys(value: object, keys: readonly string[]) {
  const actualValues = Object.keys(value).sort();
  const expectedValues = [...keys].sort();
  return (
    actualValues.length === expectedValues.length &&
    actualValues.every((key, index) => key === expectedValues[index])
  );
}

export const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

export const HASH = /^[0-9a-f]{64}$/u;

export const REVISION = /^[0-9a-f]{40,64}$/u;

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
 * string Arrayを決定する。
 *
 * @responsibility string Arrayの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is readonly string[]を返す。
 * @precondition 「value: unknown」がstringArrayの入力契約を満たす。
 * @postcondition stringArrayの責務を完了した結果だけを返す。
 * @effect N/A: stringArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: stringArrayは独自の失敗分岐を所有しない。
 * @invariant stringArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: stringArrayはProcess内の同一Subsystemで完結する。
 * @security stringArrayはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stringArrayは共有非同期状態を持たない同期処理である。
 */
export function stringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.length > 0)
  );
}

/**
 * Plain Arrayを所有Snapshotへ変換する。
 *
 * @responsibility Plain Arrayの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximumLength: number
 * @returns ArraySnapshot<T>を返す。
 * @precondition 「value: unknown、maximumLength: number」がsnapshotStateArrayの入力契約を満たす。
 * @postcondition snapshotStateArrayの責務を完了した結果だけを返す。
 * @effect N/A: snapshotStateArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotStateArrayは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotStateArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotStateArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotStateArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotStateArrayは共有非同期状態を持たない同期処理である。
 */
export function snapshotStateArray<T = unknown>(
  value: unknown,
  maximumLength: number,
): ArraySnapshot<T> {
  try {
    if (
      !Array.isArray(value) ||
      types.isProxy(value) ||
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
 * 既存Lease証拠の閉形式・本文Hash・世代を生成する。
 * @responsibility 旧Envelopeのlease-evidence枝だけを同じ値で生成する。
 * @trace ARCH-000004
 * @input binding、Project ID、更新世代、既存Lease証拠本文。
 * @returns 外側だけfreezeした同じ証拠。
 * @precondition N/A: 本文は既存validatorで検査する。
 * @postcondition 本文参照をclone・deep-freezeしない。
 * @effect N/A: 値操作だけ。
 * @failure 不正本文は元の固定例外。
 * @invariant HashをAuthority・実解放の証明にしない。
 * @boundary このFileの取得・解放・回復終了候補だけ。
 * @security 保存又は実操作を公開しない。
 * @concurrency N/A: 同期の局所値操作。
 */
export function createLeaseEvidence(
  binding: string,
  projectId: string,
  updatedGeneration: number,
  content: LeaseEvidenceContent,
): LeaseEvidenceEnvelope {
  if (!validLeaseEvidence(content))
    throw new Error("orchestrator_record_content_invalid");
  const serialized = encodeStateValue(content);
  return Object.freeze({
    schema: STORAGE_CONTRACT,
    schemaRevision: 1 as const,
    recordKind: "lease-evidence" as const,
    repositoryBindingId: binding,
    projectId,
    createdGeneration: 1,
    updatedGeneration,
    contentHash: hashStateText(serialized),
    content,
  });
}

/**
 * Lease Evidenceが有効か判定する。
 *
 * @responsibility Lease Evidenceの有効条件、拒否条件、判定結果境界を所有する。
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
export function validLeaseEvidence(value: unknown) {
  return (
    isStateObject(value) &&
    hasStateKeys(value, [
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
      value.disposition === "recovered_after_owner_loss" ||
      value.disposition === "acquisition_unknown_closed")
  );
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
export function hashExecutionStateContent(value: unknown): string {
  return createHash("sha256")
    .update(`${encodeStateValue(value)}\n`, "utf8")
    .digest("hex");
}

/**
 * durable-foundationのHashを算出する。
 *
 * @responsibility durable-foundationの入力byte列、Hash algorithm、算出結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: string
 * @returns hashStateTextの計算結果を返す。
 * @precondition 「value: string」がhashStateTextの入力契約を満たす。
 * @postcondition hashStateTextの責務を完了した結果だけを返す。
 * @effect N/A: hashStateTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hashStateTextは独自の失敗分岐を所有しない。
 * @invariant hashStateTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hashStateTextはProcess内の同一Subsystemで完結する。
 * @security hashStateTextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hashStateTextは共有非同期状態を持たない同期処理である。
 */
export function hashStateText(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
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
  return `lease-acquisition-${hashStateText(identityInput).slice(0, 40)}`;
}
