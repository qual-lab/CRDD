/**
 * Runtime状態の正規JSON byte表現と内容Hashを所有する。
 * @packageDocumentation
 * @responsibility 深度・容量・UTF-8・通常データ制約と一意encodingを既存条件で検査する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary Schemaの意味・操作認可・状態遷移・実資源の観測を所有しない。
 */
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

/** 現在状態の既存byte上限。通常の設定JSONの上限とは区別する。 */
export const RUNTIME_STATE_MAXIMUM_BYTES = 16 * 1024 * 1024;

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
export function encodeRuntimeStateValue(value: unknown, depth = 0): string {
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
      items.push(encodeRuntimeStateValue(descriptor.value, depth + 1));
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
        `${JSON.stringify(key)}:${encodeRuntimeStateValue(descriptors[key]?.value, depth + 1)}`,
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
export function hashRuntimeStateContent(value: unknown): string {
  return createHash("sha256")
    .update(`${encodeRuntimeStateValue(value)}\n`, "utf8")
    .digest("hex");
}

/**
 * 保存Bufferを一意なJSON値として安全に復号する。
 * @responsibility intrinsic Buffer境界、UTF-8、深度・容量と正規encodingを検査する。
 * @trace ARCH-000008
 * @input input: 未信頼のBuffer候補。
 * @returns 不変JSON値と本文Hash、又はnull。意味Schemaは呼出し側が検査する。
 * @precondition N/A: 任意の入力を拒否可能な境界として扱う。
 * @postcondition Proxyや入力側のlength Getterを評価せず一意byte形式だけを受理する。
 * @effect N/A: メモリ内の復号だけ。
 * @failure 不正Buffer、UTF-8、JSON、容量・深度超過、非正規encodingはnull。
 * @invariant Propertyの重複や順序差を黙って正規化しない。
 * @boundary Buffer byte列と意味検証前のJSON値。
 * @security 本文を実資源不存在、所有権または処置許可へ昇格しない。
 * @concurrency N/A: 保存や共有状態更新を行わない。
 */
export function decodeRuntimeStateBytes(input: unknown) {
  try {
    if (utilTypes.isProxy(input) || !Buffer.isBuffer(input)) return null;
    const intrinsic = Object.getPrototypeOf(Uint8Array.prototype);
    const length = Object.getOwnPropertyDescriptor(
      intrinsic,
      "byteLength",
    )?.get?.call(input);
    if (
      !Number.isSafeInteger(length) ||
      length === 0 ||
      length > RUNTIME_STATE_MAXIMUM_BYTES
    )
      return null;
    const buffer = Object.getOwnPropertyDescriptor(
      intrinsic,
      "buffer",
    )?.get?.call(input);
    const offset = Object.getOwnPropertyDescriptor(
      intrinsic,
      "byteOffset",
    )?.get?.call(input);
    const bytes = Buffer.from(new Uint8Array(buffer, offset, length));
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    const parsed = JSON.parse(text, (_key, value) =>
      value && typeof value === "object" ? Object.freeze(value) : value,
    );
    if (`${encodeRuntimeStateValue(parsed)}\n` !== text) return null;
    return Object.freeze({
      value: parsed as unknown,
      payloadSha256: createHash("sha256").update(bytes).digest("hex"),
    });
  } catch {
    return null;
  }
}
