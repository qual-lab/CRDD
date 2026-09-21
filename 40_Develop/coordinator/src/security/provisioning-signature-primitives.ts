import { createHash, createPublicKey, verify } from "node:crypto";
import { types as utilTypes } from "node:util";

export const PROVISIONING_SIGNATURE_PRIMITIVES_CONTRACT =
  "crdd-coordinator/provisioning-signature-primitives";
export const PROVISIONING_SIGNATURE_PRIMITIVES_CONTRACT_REVISION = 1;
export const PROVISIONING_SIGNATURE_ENVELOPE_TOPOLOGY =
  "payload_and_multiple_signatures_separated_target";
export const PROVISIONING_SIGNATURE_INPUT_LIMITS = Object.freeze({
  canonicalBytes: 131_072,
  depth: 64,
  nodes: 4_096,
  stringBytes: 65_536,
  spkiDerBytes: 128,
  signatureBytes: 64,
});

const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get;
const VERIFY_KEYS = new Set(["spkiDer", "message", "signature"]);
const BASE64URL_VERIFY_KEYS = new Set([
  "spkiDer",
  "message",
  "signatureBase64url",
]);
const P256_ORDER = BigInt(
  "0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
);
const P256_HALF_ORDER = P256_ORDER >> 1n;
const UNPADDED_BASE64URL = /^[A-Za-z0-9_-]+$/u;
const INVALID = Symbol("invalid");

/**
 * InputBudgetExceededが担う状態と操作を提供する。
 *
 * @responsibility InputBudgetExceededに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000014
 * @construction InputBudgetExceededの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle InputBudgetExceededが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: InputBudgetExceededの宣言自体は実行時Effectを発行しない。
 * @failure N/A: InputBudgetExceededの宣言自体は実行時失敗を所有しない。
 * @invariant InputBudgetExceededで宣言した値と責務の対応を維持する。
 * @boundary N/A: InputBudgetExceededの宣言は外部境界を開かない。
 * @security InputBudgetExceededはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: InputBudgetExceededは共有非同期状態を持たない同期処理である。
 */
class InputBudgetExceeded extends Error {}

/**
 * JsonPrimitiveが扱う値の構造を表す。
 *
 * @responsibility JsonPrimitiveに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000014
 * @shape JsonPrimitiveが表すProperty、識別子およびRelationを型として固定する。
 * @invariant JsonPrimitiveで宣言した値と責務の対応を維持する。
 * @boundary N/A: JsonPrimitiveの宣言は外部境界を開かない。
 * @security JsonPrimitiveはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility JsonPrimitiveの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type JsonPrimitive = null | boolean | number | string;
/**
 * JsonObjectが扱う値の構造を表す。
 *
 * @responsibility JsonObjectに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000014
 * @shape JsonObjectが表すProperty、識別子およびRelationを型として固定する。
 * @invariant JsonObjectで宣言した値と責務の対応を維持する。
 * @boundary N/A: JsonObjectの宣言は外部境界を開かない。
 * @security JsonObjectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility JsonObjectの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
interface JsonObject {
  readonly [key: string]: JsonValue;
}
/**
 * JsonArrayが扱う値の構造を表す。
 *
 * @responsibility JsonArrayに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000014
 * @shape JsonArrayが表すProperty、識別子およびRelationを型として固定する。
 * @invariant JsonArrayで宣言した値と責務の対応を維持する。
 * @boundary N/A: JsonArrayの宣言は外部境界を開かない。
 * @security JsonArrayはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility JsonArrayの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
interface JsonArray extends ReadonlyArray<JsonValue> {}
/**
 * JsonValueが扱う値の構造を表す。
 *
 * @responsibility JsonValueに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000014
 * @shape JsonValueが表すProperty、識別子およびRelationを型として固定する。
 * @invariant JsonValueで宣言した値と責務の対応を維持する。
 * @boundary N/A: JsonValueの宣言は外部境界を開かない。
 * @security JsonValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility JsonValueの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * isJsonArrayの処理を実行する。
 *
 * @responsibility isJsonArrayに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: JsonValue
 * @returns value is JsonArrayを返す。
 * @precondition 「value: JsonValue」がisJsonArrayの入力契約を満たす。
 * @postcondition isJsonArrayの責務を完了した結果だけを返す。
 * @effect N/A: isJsonArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isJsonArrayは独自の失敗分岐を所有しない。
 * @invariant isJsonArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isJsonArrayはProcess内の同一Subsystemで完結する。
 * @security isJsonArrayはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isJsonArrayは共有非同期状態を持たない同期処理である。
 */
function isJsonArray(value: JsonValue): value is JsonArray {
  return Array.isArray(value);
}

/**
 * SnapshotStateが扱う値の構造を表す。
 *
 * @responsibility SnapshotStateに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000014
 * @shape SnapshotStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SnapshotStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: SnapshotStateの宣言は外部境界を開かない。
 * @security SnapshotStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SnapshotStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SnapshotState = {
  nodes: number;
  ancestors: WeakSet<object>;
};

/**
 * blockedの処理を実行する。
 *
 * @responsibility blockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input reason: string
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(reason: string) {
  return Object.freeze({
    status: "blocked",
    reason,
    cryptographicMatch: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}

/**
 * ownedBufferの処理を実行する。
 *
 * @responsibility ownedBufferに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: unknown、maximumLength: number
 * @returns ownedBufferの計算結果を返す。
 * @precondition 「value: unknown、maximumLength: number」がownedBufferの入力契約を満たす。
 * @postcondition ownedBufferの責務を完了した結果だけを返す。
 * @effect N/A: ownedBufferは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownedBufferは独自の失敗分岐を所有しない。
 * @invariant ownedBufferは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownedBufferはProcess内の同一Subsystemで完結する。
 * @security ownedBufferはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownedBufferは共有非同期状態を持たない同期処理である。
 */
function ownedBuffer(value: unknown, maximumLength: number) {
  if (!Buffer.isBuffer(value)) return null;
  if (typeof TYPED_ARRAY_BYTE_LENGTH !== "function") return null;
  const rawLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, value, []);
  if (
    typeof rawLength !== "number" ||
    !Number.isSafeInteger(rawLength) ||
    rawLength < 0
  ) {
    return null;
  }
  const length = rawLength;
  if (length > maximumLength) return null;
  const copy = Buffer.allocUnsafe(length);
  Uint8Array.prototype.set.call(copy, value);
  return copy;
}

/**
 * hasLoneSurrogateの処理を実行する。
 *
 * @responsibility hasLoneSurrogateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: string
 * @returns hasLoneSurrogateの計算結果を返す。
 * @precondition 「value: string」がhasLoneSurrogateの入力契約を満たす。
 * @postcondition hasLoneSurrogateの責務を完了した結果だけを返す。
 * @effect N/A: hasLoneSurrogateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hasLoneSurrogateは独自の失敗分岐を所有しない。
 * @invariant hasLoneSurrogateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hasLoneSurrogateはProcess内の同一Subsystemで完結する。
 * @security hasLoneSurrogateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hasLoneSurrogateは共有非同期状態を持たない同期処理である。
 */
function hasLoneSurrogate(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return true;
  }
  return false;
}

/**
 * dataDescriptorの処理を実行する。
 *
 * @responsibility dataDescriptorに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input descriptor: PropertyDescriptor | undefined、shouldBeEnumerable
 * @returns descriptor is PropertyDescriptor & { value: unknown }を返す。
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
): descriptor is PropertyDescriptor & { value: unknown } {
  return Boolean(
    descriptor &&
      Object.hasOwn(descriptor, "value") &&
      descriptor.get === undefined &&
      descriptor.set === undefined &&
      (!shouldBeEnumerable || descriptor.enumerable === true),
  );
}

/**
 * snapshotJsonValueの処理を実行する。
 *
 * @responsibility snapshotJsonValueに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: unknown、state: SnapshotState、depth
 * @returns JsonValue | typeof INVALIDを返す。
 * @precondition 「value: unknown、state: SnapshotState、depth」がsnapshotJsonValueの入力契約を満たす。
 * @postcondition snapshotJsonValueの責務を完了した結果だけを返す。
 * @effect N/A: snapshotJsonValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotJsonValueは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotJsonValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotJsonValueはProcess内の同一Subsystemで完結する。
 * @security snapshotJsonValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotJsonValueは共有非同期状態を持たない同期処理である。
 */
function snapshotJsonValue(
  value: unknown,
  state: SnapshotState,
  depth = 0,
): JsonValue | typeof INVALID {
  if (
    depth > PROVISIONING_SIGNATURE_INPUT_LIMITS.depth ||
    state.nodes >= PROVISIONING_SIGNATURE_INPUT_LIMITS.nodes
  )
    throw new InputBudgetExceeded();
  state.nodes += 1;
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : INVALID;
  if (typeof value === "string") {
    return !hasLoneSurrogate(value) &&
      Buffer.byteLength(value, "utf8") <=
        PROVISIONING_SIGNATURE_INPUT_LIMITS.stringBytes
      ? value
      : INVALID;
  }
  if (
    !value ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    state.ancestors.has(value)
  ) {
    return INVALID;
  }
  state.ancestors.add(value);
  try {
    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value)) {
      const length = Object.getOwnPropertyDescriptor(value, "length");
      if (
        prototype !== Array.prototype ||
        !dataDescriptor(length, false) ||
        !Number.isSafeInteger(length.value) ||
        length.value < 0
      )
        return INVALID;
      if (
        length.value >
        PROVISIONING_SIGNATURE_INPUT_LIMITS.nodes - state.nodes
      ) {
        throw new InputBudgetExceeded();
      }
      const keys = Reflect.ownKeys(value);
      if (keys.length !== length.value + 1) return INVALID;
      const snapshotItems: JsonValue[] = [];
      for (let index = 0; index < length.value; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(
          value,
          String(index),
        );
        if (!dataDescriptor(descriptor)) return INVALID;
        const child = snapshotJsonValue(descriptor.value, state, depth + 1);
        if (child === INVALID) return INVALID;
        snapshotItems.push(child);
      }
      return Object.freeze(snapshotItems);
    }
    if (prototype !== Object.prototype && prototype !== null) return INVALID;
    const keys = Reflect.ownKeys(value);
    if (keys.length > PROVISIONING_SIGNATURE_INPUT_LIMITS.nodes - state.nodes) {
      throw new InputBudgetExceeded();
    }
    if (
      keys.some(
        (key) =>
          typeof key !== "string" ||
          hasLoneSurrogate(key) ||
          Buffer.byteLength(key, "utf8") >
            PROVISIONING_SIGNATURE_INPUT_LIMITS.stringBytes,
      )
    )
      return INVALID;
    const result: Record<string, JsonValue> = Object.create(null);
    for (const key of keys) {
      if (typeof key !== "string") return INVALID;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!dataDescriptor(descriptor)) return INVALID;
      const child = snapshotJsonValue(descriptor.value, state, depth + 1);
      if (child === INVALID) return INVALID;
      result[key] = child;
    }
    return Object.freeze(result);
  } finally {
    state.ancestors.delete(value);
  }
}

/**
 * boundedJcsの処理を実行する。
 *
 * @responsibility boundedJcsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: JsonValue
 * @returns boundedJcsの計算結果を返す。
 * @precondition 「value: JsonValue」がboundedJcsの入力契約を満たす。
 * @postcondition boundedJcsの責務を完了した結果だけを返す。
 * @effect N/A: boundedJcsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure boundedJcsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant boundedJcsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: boundedJcsはProcess内の同一Subsystemで完結する。
 * @security boundedJcsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: boundedJcsは共有非同期状態を持たない同期処理である。
 */
function boundedJcs(value: JsonValue) {
  const chunks: Buffer[] = [];
  let byteLength = 0;
  const append = (chunk: string) => {
    const ownedChunk = Buffer.from(chunk, "utf8");
    if (
      byteLength + ownedChunk.length >
      PROVISIONING_SIGNATURE_INPUT_LIMITS.canonicalBytes
    ) {
      throw new InputBudgetExceeded();
    }
    chunks.push(ownedChunk);
    byteLength += ownedChunk.length;
  };
  const string = (text: string) => {
    append('"');
    let runStart = 0;
    const flush = (end: number) => {
      if (end > runStart) append(text.slice(runStart, end));
      runStart = end;
    };
    for (let index = 0; index < text.length; ) {
      const unit = text.charCodeAt(index);
      let escaped = null;
      if (unit === 0x22) escaped = '\\"';
      else if (unit === 0x5c) escaped = "\\\\";
      else if (unit === 0x08) escaped = "\\b";
      else if (unit === 0x09) escaped = "\\t";
      else if (unit === 0x0a) escaped = "\\n";
      else if (unit === 0x0c) escaped = "\\f";
      else if (unit === 0x0d) escaped = "\\r";
      else if (unit <= 0x1f)
        escaped = `\\u${unit.toString(16).padStart(4, "0")}`;
      const width = unit >= 0xd800 && unit <= 0xdbff ? 2 : 1;
      if (escaped !== null) {
        flush(index);
        append(escaped);
        index += width;
        runStart = index;
      } else {
        index += width;
        if (index - runStart >= 1_024) flush(index);
      }
    }
    flush(text.length);
    append('"');
  };
  const serialize = (item: JsonValue): void => {
    if (typeof item === "string") {
      string(item);
      return;
    }
    if (
      item === null ||
      typeof item === "boolean" ||
      typeof item === "number"
    ) {
      const serialized = JSON.stringify(item);
      if (serialized === undefined) throw new InputBudgetExceeded();
      append(serialized);
      return;
    }
    if (isJsonArray(item)) {
      append("[");
      item.forEach((child, index) => {
        if (index > 0) append(",");
        serialize(child);
      });
      append("]");
      return;
    }
    append("{");
    Object.keys(item)
      .sort()
      .forEach((key, index) => {
        if (index > 0) append(",");
        string(key);
        append(":");
        const child = item[key];
        if (child === undefined) throw new InputBudgetExceeded();
        serialize(child);
      });
    append("}");
  };
  serialize(value);
  return Buffer.concat(chunks, byteLength);
}

/**
 * canonicalizeProvisioningJsonValueCandidateの処理を実行する。
 *
 * @responsibility canonicalizeProvisioningJsonValueCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input rawValue: unknown
 * @returns canonicalizeProvisioningJsonValueCandidateの計算結果を返す。
 * @precondition 「rawValue: unknown」がcanonicalizeProvisioningJsonValueCandidateの入力契約を満たす。
 * @postcondition canonicalizeProvisioningJsonValueCandidateの責務を完了した結果だけを返す。
 * @effect N/A: canonicalizeProvisioningJsonValueCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure canonicalizeProvisioningJsonValueCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant canonicalizeProvisioningJsonValueCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalizeProvisioningJsonValueCandidateはProcess内の同一Subsystemで完結する。
 * @security canonicalizeProvisioningJsonValueCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalizeProvisioningJsonValueCandidateは共有非同期状態を持たない同期処理である。
 */
export function canonicalizeProvisioningJsonValueCandidate(rawValue: unknown) {
  try {
    const value = snapshotJsonValue(rawValue, {
      nodes: 0,
      ancestors: new WeakSet(),
    });
    if (value === INVALID) return blocked("provisioning_jcs_value_invalid");
    const canonicalBytes = boundedJcs(value);
    return Object.freeze({
      status: "candidate",
      reason: "provisioning_record_schema_and_domain_separation_required",
      canonicalBytes,
      canonicalHash: createHash("sha256").update(canonicalBytes).digest("hex"),
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch (error) {
    if (error instanceof InputBudgetExceeded)
      return blocked("provisioning_jcs_budget_exceeded");
    return blocked("provisioning_jcs_value_invalid");
  }
}

/**
 * inspectSpkiの処理を実行する。
 *
 * @responsibility inspectSpkiに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input input: unknown
 * @returns inspectSpkiの計算結果を返す。
 * @precondition 「input: unknown」がinspectSpkiの入力契約を満たす。
 * @postcondition inspectSpkiの責務を完了した結果だけを返す。
 * @effect N/A: inspectSpkiは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectSpkiは独自の失敗分岐を所有しない。
 * @invariant inspectSpkiは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectSpkiはProcess内の同一Subsystemで完結する。
 * @security inspectSpkiはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectSpkiは共有非同期状態を持たない同期処理である。
 */
function inspectSpki(input: unknown) {
  const spkiDer = ownedBuffer(
    input,
    PROVISIONING_SIGNATURE_INPUT_LIMITS.spkiDerBytes,
  );
  if (!spkiDer) return null;
  const key = createPublicKey({ key: spkiDer, format: "der", type: "spki" });
  if (key.asymmetricKeyType !== "ed25519") return null;
  const canonicalDer = key.export({ format: "der", type: "spki" });
  if (!Buffer.prototype.equals.call(spkiDer, canonicalDer)) return null;
  return Object.freeze({ key, spkiDer });
}

/**
 * inspectP256Spkiの処理を実行する。
 *
 * @responsibility inspectP256Spkiに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input input: unknown
 * @returns inspectP256Spkiの計算結果を返す。
 * @precondition 「input: unknown」がinspectP256Spkiの入力契約を満たす。
 * @postcondition inspectP256Spkiの責務を完了した結果だけを返す。
 * @effect N/A: inspectP256Spkiは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectP256Spkiは独自の失敗分岐を所有しない。
 * @invariant inspectP256Spkiは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectP256SpkiはProcess内の同一Subsystemで完結する。
 * @security inspectP256SpkiはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectP256Spkiは共有非同期状態を持たない同期処理である。
 */
function inspectP256Spki(input: unknown) {
  const spkiDer = ownedBuffer(
    input,
    PROVISIONING_SIGNATURE_INPUT_LIMITS.spkiDerBytes,
  );
  if (spkiDer?.length !== 91) return null;
  const key = createPublicKey({ key: spkiDer, format: "der", type: "spki" });
  if (
    key.asymmetricKeyType !== "ec" ||
    key.asymmetricKeyDetails?.namedCurve !== "prime256v1"
  ) {
    return null;
  }
  const canonicalDer = key.export({ format: "der", type: "spki" });
  if (!Buffer.prototype.equals.call(spkiDer, canonicalDer)) return null;
  return Object.freeze({ key, spkiDer });
}

/**
 * canonicalP256Signatureの処理を実行する。
 *
 * @responsibility canonicalP256Signatureに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input signature: Buffer
 * @returns canonicalP256Signatureの計算結果を返す。
 * @precondition 「signature: Buffer」がcanonicalP256Signatureの入力契約を満たす。
 * @postcondition canonicalP256Signatureの責務を完了した結果だけを返す。
 * @effect N/A: canonicalP256Signatureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalP256Signatureは独自の失敗分岐を所有しない。
 * @invariant canonicalP256Signatureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalP256SignatureはProcess内の同一Subsystemで完結する。
 * @security canonicalP256SignatureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalP256Signatureは共有非同期状態を持たない同期処理である。
 */
function canonicalP256Signature(signature: Buffer) {
  if (signature.length !== 64) return false;
  const r = BigInt(`0x${signature.subarray(0, 32).toString("hex")}`);
  const s = BigInt(`0x${signature.subarray(32).toString("hex")}`);
  return r > 0n && r < P256_ORDER && s > 0n && s <= P256_HALF_ORDER;
}

/**
 * inspectProvisioningEd25519SpkiCandidateの処理を実行する。
 *
 * @responsibility inspectProvisioningEd25519SpkiCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input input: unknown
 * @returns inspectProvisioningEd25519SpkiCandidateの計算結果を返す。
 * @precondition 「input: unknown」がinspectProvisioningEd25519SpkiCandidateの入力契約を満たす。
 * @postcondition inspectProvisioningEd25519SpkiCandidateの責務を完了した結果だけを返す。
 * @effect N/A: inspectProvisioningEd25519SpkiCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectProvisioningEd25519SpkiCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectProvisioningEd25519SpkiCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectProvisioningEd25519SpkiCandidateはProcess内の同一Subsystemで完結する。
 * @security inspectProvisioningEd25519SpkiCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectProvisioningEd25519SpkiCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectProvisioningEd25519SpkiCandidate(input: unknown) {
  try {
    const inspected = inspectSpki(input);
    if (!inspected) return blocked("provisioning_ed25519_spki_invalid");
    return Object.freeze({
      status: "candidate",
      reason: "provisioning_trust_anchor_set_and_key_id_encoding_required",
      spkiSha256Digest: createHash("sha256").update(inspected.spkiDer).digest(),
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("provisioning_ed25519_spki_invalid");
  }
}

/**
 * inspectProvisioningP256SpkiCandidateの処理を実行する。
 *
 * @responsibility inspectProvisioningP256SpkiCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input input: unknown
 * @returns inspectProvisioningP256SpkiCandidateの計算結果を返す。
 * @precondition 「input: unknown」がinspectProvisioningP256SpkiCandidateの入力契約を満たす。
 * @postcondition inspectProvisioningP256SpkiCandidateの責務を完了した結果だけを返す。
 * @effect N/A: inspectProvisioningP256SpkiCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectProvisioningP256SpkiCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectProvisioningP256SpkiCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectProvisioningP256SpkiCandidateはProcess内の同一Subsystemで完結する。
 * @security inspectProvisioningP256SpkiCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectProvisioningP256SpkiCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectProvisioningP256SpkiCandidate(input: unknown) {
  try {
    const inspected = inspectP256Spki(input);
    if (!inspected) return blocked("provisioning_p256_spki_invalid");
    return Object.freeze({
      status: "candidate",
      reason: "provisioning_hardware_key_binding_and_key_id_encoding_required",
      spkiSha256Digest: createHash("sha256").update(inspected.spkiDer).digest(),
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("provisioning_p256_spki_invalid");
  }
}

/**
 * snapshotExactInputの処理を実行する。
 *
 * @responsibility snapshotExactInputに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input value: unknown、expectedKeys: ReadonlySet<string>
 * @returns snapshotExactInputの計算結果を返す。
 * @precondition 「value: unknown、expectedKeys: ReadonlySet<string>」がsnapshotExactInputの入力契約を満たす。
 * @postcondition snapshotExactInputの責務を完了した結果だけを返す。
 * @effect N/A: snapshotExactInputは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: snapshotExactInputは独自の失敗分岐を所有しない。
 * @invariant snapshotExactInputは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotExactInputはProcess内の同一Subsystemで完結する。
 * @security snapshotExactInputはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotExactInputは共有非同期状態を持たない同期処理である。
 */
function snapshotExactInput(value: unknown, expectedKeys: ReadonlySet<string>) {
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
    keys.length !== expectedKeys.size ||
    keys.some(
      (key) =>
        typeof key !== "string" ||
        !expectedKeys.has(key) ||
        !dataDescriptor(descriptors[key]),
    )
  )
    return null;
  const result: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!dataDescriptor(descriptor)) return null;
    result[key] = descriptor.value;
  }
  return Object.freeze(result);
}

/**
 * verifyProvisioningEd25519PrimitiveCandidateの処理を実行する。
 *
 * @responsibility verifyProvisioningEd25519PrimitiveCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input rawInput: unknown
 * @returns verifyProvisioningEd25519PrimitiveCandidateの計算結果を返す。
 * @precondition 「rawInput: unknown」がverifyProvisioningEd25519PrimitiveCandidateの入力契約を満たす。
 * @postcondition verifyProvisioningEd25519PrimitiveCandidateの責務を完了した結果だけを返す。
 * @effect N/A: verifyProvisioningEd25519PrimitiveCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyProvisioningEd25519PrimitiveCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyProvisioningEd25519PrimitiveCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyProvisioningEd25519PrimitiveCandidateはProcess内の同一Subsystemで完結する。
 * @security verifyProvisioningEd25519PrimitiveCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyProvisioningEd25519PrimitiveCandidateは共有非同期状態を持たない同期処理である。
 */
export function verifyProvisioningEd25519PrimitiveCandidate(rawInput: unknown) {
  try {
    const input = snapshotExactInput(rawInput, VERIFY_KEYS);
    if (!input) return blocked("provisioning_ed25519_input_invalid");
    const inspected = inspectSpki(input.spkiDer);
    const message = ownedBuffer(
      input.message,
      PROVISIONING_SIGNATURE_INPUT_LIMITS.canonicalBytes,
    );
    const signature = ownedBuffer(
      input.signature,
      PROVISIONING_SIGNATURE_INPUT_LIMITS.signatureBytes,
    );
    if (
      !inspected ||
      !message ||
      !signature ||
      signature.length !== PROVISIONING_SIGNATURE_INPUT_LIMITS.signatureBytes
    ) {
      return blocked("provisioning_ed25519_input_invalid");
    }
    if (!verify(null, message, inspected.key, signature)) {
      return blocked("provisioning_ed25519_cryptographic_mismatch");
    }
    return Object.freeze({
      status: "candidate",
      reason:
        "provisioning_domain_trust_revocation_and_envelope_verification_required",
      cryptographicMatch: true,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("provisioning_ed25519_input_invalid");
  }
}

/**
 * verifyProvisioningEd25519Base64urlCandidateの処理を実行する。
 *
 * @responsibility verifyProvisioningEd25519Base64urlCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input rawInput: unknown
 * @returns verifyProvisioningEd25519Base64urlCandidateの計算結果を返す。
 * @precondition 「rawInput: unknown」がverifyProvisioningEd25519Base64urlCandidateの入力契約を満たす。
 * @postcondition verifyProvisioningEd25519Base64urlCandidateの責務を完了した結果だけを返す。
 * @effect N/A: verifyProvisioningEd25519Base64urlCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyProvisioningEd25519Base64urlCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyProvisioningEd25519Base64urlCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyProvisioningEd25519Base64urlCandidateはProcess内の同一Subsystemで完結する。
 * @security verifyProvisioningEd25519Base64urlCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyProvisioningEd25519Base64urlCandidateは共有非同期状態を持たない同期処理である。
 */
export function verifyProvisioningEd25519Base64urlCandidate(rawInput: unknown) {
  try {
    const input = snapshotExactInput(rawInput, BASE64URL_VERIFY_KEYS);
    if (
      !input ||
      typeof input.signatureBase64url !== "string" ||
      input.signatureBase64url.length !== 86 ||
      !UNPADDED_BASE64URL.test(input.signatureBase64url)
    ) {
      return blocked("provisioning_ed25519_base64url_input_invalid");
    }
    const signature = Buffer.from(input.signatureBase64url, "base64url");
    if (
      signature.length !== PROVISIONING_SIGNATURE_INPUT_LIMITS.signatureBytes ||
      signature.toString("base64url") !== input.signatureBase64url
    ) {
      return blocked("provisioning_ed25519_base64url_input_invalid");
    }
    return verifyProvisioningEd25519PrimitiveCandidate({
      spkiDer: input.spkiDer,
      message: input.message,
      signature,
    });
  } catch {
    return blocked("provisioning_ed25519_base64url_input_invalid");
  }
}

/**
 * verifyProvisioningP256Base64urlCandidateの処理を実行する。
 *
 * @responsibility verifyProvisioningP256Base64urlCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input rawInput: unknown
 * @returns verifyProvisioningP256Base64urlCandidateの計算結果を返す。
 * @precondition 「rawInput: unknown」がverifyProvisioningP256Base64urlCandidateの入力契約を満たす。
 * @postcondition verifyProvisioningP256Base64urlCandidateの責務を完了した結果だけを返す。
 * @effect N/A: verifyProvisioningP256Base64urlCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyProvisioningP256Base64urlCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyProvisioningP256Base64urlCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyProvisioningP256Base64urlCandidateはProcess内の同一Subsystemで完結する。
 * @security verifyProvisioningP256Base64urlCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyProvisioningP256Base64urlCandidateは共有非同期状態を持たない同期処理である。
 */
export function verifyProvisioningP256Base64urlCandidate(rawInput: unknown) {
  try {
    const input = snapshotExactInput(rawInput, BASE64URL_VERIFY_KEYS);
    if (
      !input ||
      typeof input.signatureBase64url !== "string" ||
      input.signatureBase64url.length !== 86 ||
      !UNPADDED_BASE64URL.test(input.signatureBase64url)
    ) {
      return blocked("provisioning_p256_base64url_input_invalid");
    }
    const signature = Buffer.from(input.signatureBase64url, "base64url");
    if (
      signature.length !== PROVISIONING_SIGNATURE_INPUT_LIMITS.signatureBytes ||
      signature.toString("base64url") !== input.signatureBase64url
    ) {
      return blocked("provisioning_p256_base64url_input_invalid");
    }
    if (!canonicalP256Signature(signature)) {
      return blocked("provisioning_p256_signature_noncanonical");
    }
    const inspected = inspectP256Spki(input.spkiDer);
    const message = ownedBuffer(
      input.message,
      PROVISIONING_SIGNATURE_INPUT_LIMITS.canonicalBytes,
    );
    if (
      !inspected ||
      !message ||
      !verify(
        "sha256",
        message,
        {
          key: inspected.key,
          dsaEncoding: "ieee-p1363",
        },
        signature,
      )
    ) {
      return blocked(
        inspected && message
          ? "provisioning_p256_cryptographic_mismatch"
          : "provisioning_p256_input_invalid",
      );
    }
    return Object.freeze({
      status: "candidate",
      reason:
        "provisioning_domain_trust_revocation_and_envelope_verification_required",
      cryptographicMatch: true,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
    });
  } catch {
    return blocked("provisioning_p256_input_invalid");
  }
}

/**
 * describeProvisioningSignaturePrimitivesContractの処理を実行する。
 *
 * @responsibility describeProvisioningSignaturePrimitivesContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000014
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProvisioningSignaturePrimitivesContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProvisioningSignaturePrimitivesContractの入力契約を満たす。
 * @postcondition describeProvisioningSignaturePrimitivesContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProvisioningSignaturePrimitivesContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProvisioningSignaturePrimitivesContractは独自の失敗分岐を所有しない。
 * @invariant describeProvisioningSignaturePrimitivesContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProvisioningSignaturePrimitivesContractはProcess内の同一Subsystemで完結する。
 * @security describeProvisioningSignaturePrimitivesContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProvisioningSignaturePrimitivesContractは共有非同期状態を持たない同期処理である。
 */
export function describeProvisioningSignaturePrimitivesContract() {
  return Object.freeze({
    contract: PROVISIONING_SIGNATURE_PRIMITIVES_CONTRACT,
    contractRevision: PROVISIONING_SIGNATURE_PRIMITIVES_CONTRACT_REVISION,
    jcsValueCanonicalization: "implemented_candidate_rfc_8785",
    rawJsonDuplicateKeyDecoder: "not_implemented",
    ed25519SpkiDerInspection: "implemented_candidate_rfc_8410",
    spkiSha256Digest: "implemented_candidate_not_key_id_encoding",
    ed25519PrimitiveVerification: "implemented_candidate_rfc_8032",
    ed25519SignatureBase64url: "implemented_candidate_rfc_4648_unpadded",
    p256SpkiDerInspection: "implemented_candidate_sec1_rfc_5480",
    p256PrimitiveVerification: "implemented_candidate_ecdsa_sha256_ieee_p1363",
    p256SignatureBase64url:
      "implemented_candidate_low_s_ieee_p1363_rfc_4648_unpadded",
    keyIdEncoding: "implemented_candidate_in_provisioning_record_pure_core",
    payloadSignatureEnvelopeTopology: PROVISIONING_SIGNATURE_ENVELOPE_TOPOLOGY,
    crddDomainSeparationFraming:
      "implemented_candidate_in_provisioning_record_pure_core",
    provisioningRecordPayloadSchema:
      "implemented_candidate_in_provisioning_record_pure_core",
    multiSignatureEnvelopeSchema:
      "implemented_candidate_in_provisioning_record_pure_core",
    multiSignatureAcceptanceRule:
      "implemented_candidate_in_provisioning_record_pure_core",
    multiSignatureAcceptancePolicy:
      "one_or_more_trusted_non_revoked_valid_and_no_unknown_revoked_duplicate_or_invalid_target",
    offlineBundledTrustEvaluation: "required_target_not_implemented",
    embeddedTrustAnchorSet:
      "candidate_codec_only_untrusted_input_in_provisioning_record_pure_core",
    revocationManifest:
      "candidate_codec_only_untrusted_input_in_provisioning_record_pure_core",
    aggregateRecordVerifier:
      "candidate_cryptographic_condition_only_in_provisioning_record_pure_core",
    existingCanonicalContractsMigratedToJcs: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
