/**
 * plain-data-snapshotに属する責務をまとめる。
 *
 * @responsibility DataDescriptorを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000014
 */
import { types as utilTypes } from "node:util";

/**
 * plain-data-snapshotで使用するData Descriptorの値契約を定義する。
 *
 * @responsibility Data DescriptorのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape DataDescriptorが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DataDescriptorで宣言した値と責務の対応を維持する。
 * @boundary N/A: DataDescriptorの宣言は外部境界を開かない。
 * @security DataDescriptorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DataDescriptorの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DataDescriptor = PropertyDescriptor & { value: unknown };

/**
 * plain-data-snapshotで使用するPlain Array Snapshotの値契約を定義する。
 *
 * @responsibility Plain Array SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000014
 * @shape PlainArraySnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PlainArraySnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: PlainArraySnapshotの宣言は外部境界を開かない。
 * @security PlainArraySnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PlainArraySnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PlainArraySnapshot<T> =
  | Readonly<{ status: "ok"; reason: null; value: readonly T[] }>
  | Readonly<{
      status: "blocked";
      reason:
        | "not_plain_array"
        | "array_length_invalid"
        | "array_length_exceeded"
        | "array_shape_invalid"
        | "array_input_invalid";
      value: null;
    }>;

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
 * Plain 記録を所有Snapshotへ変換する。
 *
 * @responsibility Plain 記録の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000014
 * @input value: unknown、allowedKeys: ReadonlySet<K>
 * @returns Readonly<Record<K, unknown>> | nullを返す。
 * @precondition 「value: unknown、allowedKeys: ReadonlySet<K>」がsnapshotPlainRecordの入力契約を満たす。
 * @postcondition snapshotPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: snapshotPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotPlainRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotPlainRecordはProcess内の同一Subsystemで完結する。
 * @security snapshotPlainRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotPlainRecordは共有非同期状態を持たない同期処理である。
 */
export function snapshotPlainRecord<const K extends string>(
  value: unknown,
  allowedKeys: ReadonlySet<K>,
): Readonly<Record<K, unknown>> | null {
  try {
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
      keys.length !== allowedKeys.size ||
      keys.some((key) => typeof key !== "string" || !allowedKeys.has(key as K))
    )
      return null;
    const snapshot = Object.create(null) as Record<K, unknown>;
    for (const key of allowedKeys) {
      const descriptor = descriptors[key];
      if (!dataDescriptor(descriptor)) return null;
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
      utilTypes.isProxy(value) ||
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
