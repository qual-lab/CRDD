/**
 * Stateの主体IDと記録値の構築・捕捉・変換を所有する。
 * @responsibility モデル候補・保存・Authorityに依存せず同じ値処理を提供する。
 * @trace ARCH-000004、ARCH-000008
 */

import { types } from "node:util";

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
