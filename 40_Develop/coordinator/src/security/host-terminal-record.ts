/**
 * Host終端intentを固定された非Authorityのbytesへ変換する。
 *
 * @responsibility 完全snapshotの形状、producer関係と正規bytesを所有する。保存・清掃は所有しない。
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

const MAX_BYTES = 8_192;
const HASH = /^[a-f0-9]{64}$/u;
const REFERENCE =
  /^host-terminal\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const CHILD_NAMES = [
  "workspace",
  "provider-home",
  "tmp",
  "events",
  "projection",
  "management",
] as const;
const ORDER = Object.freeze([
  "root_absence",
  "marker_absence",
  "lease_terminal",
] as const);
const ID_KEYS = [
  "volumeSerial",
  "fileIndexHigh",
  "fileIndexLow",
  "creationTimeHigh",
  "creationTimeLow",
] as const;
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const byteLengthGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength",
)?.get;
const byteOffsetGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteOffset",
)?.get;
const bufferGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "buffer",
)?.get;

/**
 * Win32の実体識別値を表す。
 *
 * @responsibility file indexとcreation timeをvolumeへ結合する。
 * @trace ARCH-000008
 * @shape BY_HANDLE_FILE_INFORMATION由来の五つのu32。
 * @invariant Nodeのdev／ino／birthtimeNsや既存三field Native Identityと相互変換しない。
 * @boundary 将来の固定Windows観測Adapterと記録codecの境界。
 * @security 値の受理は実観測、所有、保護または非使用の証明ではない。
 * @compatibility revision 1はWindowsのこの形だけを受理する。
 */
export type HostTerminalWindowsIdentity = Readonly<
  Record<(typeof ID_KEYS)[number], number>
>;

/**
 * intentの結合元を区別する。
 *
 * @responsibility 通常清掃の元参照と限定保守の選択snapshotを混在させない。
 * @trace ARCH-000008
 * @shape owned_cleanupの元参照Hash、またはhuman_orphan_cleanupのsnapshot Hashと不明理由。
 * @invariant 各producerは自分のfieldだけを持つ。
 * @boundary 内部記録Ownerだけが利用する。
 * @security Hashから元Tokenや削除Authorityを復元しない。
 * @compatibility 未知producerと未知理由を拒否する。
 */
type HostTerminalProducer =
  | Readonly<{ kind: "owned_cleanup"; originalReferenceSha256: string }>
  | Readonly<{
      kind: "human_orphan_cleanup";
      selectionSnapshotSha256: string;
      originalReferenceUnknownReason: "original_reference_unconfirmed";
    }>;

/**
 * 完全snapshotに限定したHost終端intentを表す。
 *
 * @responsibility caller-known参照、選択主体、対象実体と処置順を保持する。
 * @trace ARCH-000008
 * @shape revision 1、固定bindings、親／管理Directory／Root／marker／六childのIdentity。
 * @invariant 成功、処置済み、非使用、Authorityの自己申告fieldを持たない。
 * @boundary 本番未接続の保存入力。初期化途中やIdentity不明は入力範囲外。
 * @security 任意Path、秘密値、元回復Tokenまたは削除Capabilityを含めない。
 * @compatibility 保存・Native protocol・公開結果とは別の内部codecである。
 */
export type HostTerminalIntent = Readonly<{
  contract: "crdd-coordinator/host-terminal-intent";
  contractRevision: 1;
  reference: string;
  producer: HostTerminalProducer;
  bindings: Readonly<{
    runtimeSha256: string;
    repositorySha256: string;
    selectedUserSha256: string;
  }>;
  target: Readonly<{
    parentIdentity: HostTerminalWindowsIdentity;
    recoveryDirectoryIdentity: HostTerminalWindowsIdentity;
    terminalDirectoryIdentity: HostTerminalWindowsIdentity;
    root: Readonly<{ name: string; identity: HostTerminalWindowsIdentity }>;
    marker: Readonly<{
      name: string;
      identity: HostTerminalWindowsIdentity;
      sha256: string;
    }>;
    children: Readonly<
      Record<(typeof CHILD_NAMES)[number], HostTerminalWindowsIdentity>
    >;
  }>;
  cleanupOrder: typeof ORDER;
}>;

/**
 * 検証済みintentと正規bytesの対応を表す。
 *
 * @responsibility Hashの対象を改行なしUTF-8文書へ限定する。
 * @trace ARCH-000008
 * @shape immutable intent、serialized、sha256。
 * @invariant byte検証から保存・公開・清掃の成功を発行しない。
 * @boundary codecの内部利用側へ返す値。
 * @security sha256はAuthorityでも回復Tokenでもない。
 * @compatibility serializedは固定key順で一意とする。
 */
export type EncodedHostTerminalIntent = Readonly<{
  intent: HostTerminalIntent;
  serialized: string;
  sha256: string;
}>;

/**
 * 閉じたown data fieldを取り出す。
 *
 * @responsibility 未知field、Proxy、Accessorとprototype差を拒否する。
 * @trace ARCH-000008
 * @input 未検証値と許可keyの閉集合。
 * @returns 所有されたdata field snapshot。
 * @precondition N/A: 任意の不正入力も拒否対象として受け取る。
 * @postcondition 入力のgetterやtoJSONを呼ばない。
 * @effect N/A: 局所値の検査のみで外部資源を扱わない。
 * @failure 閉集合と一致しなければ固定shapeエラー。
 * @invariant 記録候補の外部状態を変更しない。
 * @boundary 未検証値から内部の形状検査への境界。
 * @security 非列挙fieldも未知fieldとして拒否する。
 * @concurrency N/A: awaitを持たない局所snapshotである。
 */
function requireFields<const K extends string>(
  value: unknown,
  keys: readonly K[],
): Readonly<Record<K, unknown>> {
  const fields = snapshotPlainRecord(value, new Set(keys));
  if (!fields) throw new Error("host_terminal_shape_invalid");
  return fields;
}

/**
 * Hashを正規形へ限定する。
 *
 * @responsibility 小文字64桁以外の値を記録へ運ばない。
 * @trace ARCH-000008
 * @input 未検証Hash値。
 * @returns 小文字SHA-256文字列。
 * @precondition N/A: 不正値を検査して拒否する。
 * @postcondition 内容を取得・補完せず入力値だけを返す。
 * @effect N/A: 純粋な文字列検査である。
 * @failure 不正値は固定Hashエラー。
 * @invariant Hashだけで元情報の実在性を主張しない。
 * @boundary 内部codecのscalar境界。
 * @security 不正値を診断へ複製しない。情報分類は記録Ownerが別に確認する。
 * @concurrency N/A: 共有状態のない同期処理。
 */
function requireHash(value: unknown): string {
  if (typeof value !== "string" || !HASH.test(value))
    throw new Error("host_terminal_hash_invalid");
  return value;
}

/**
 * Windows識別値を型と正規範囲へ固定する。
 *
 * @responsibility 五u32の完全性と整数表現を確認する。
 * @trace ARCH-000008
 * @input 未検証Identity。
 * @returns 不変のWin32識別値。
 * @precondition N/A: 未知fieldや不正数値を拒否する。
 * @postcondition Node IdentityをWin32 Identityへ暗黙変換しない。
 * @effect N/A: 入力値の検査と複製だけを行う。
 * @failure 欠落、範囲外、非整数、負のゼロは固定Identityエラー。
 * @invariant 実観測の鮮度や対象の所有を証明しない。
 * @boundary 将来のNative観測値から記録形状への境界。
 * @security 未知値をゼロで補完しない。
 * @concurrency N/A: 同期的にown data fieldを取得する。
 */
function requireWindowsIdentity(value: unknown): HostTerminalWindowsIdentity {
  const fields = requireFields(value, ID_KEYS);
  for (const key of ID_KEYS) {
    const number = fields[key];
    if (
      typeof number !== "number" ||
      !Number.isInteger(number) ||
      Object.is(number, -0) ||
      number < 0 ||
      number > 0xffff_ffff
    )
      throw new Error("host_terminal_identity_invalid");
  }
  return Object.freeze({
    volumeSerial: fields.volumeSerial as number,
    fileIndexHigh: fields.fileIndexHigh as number,
    fileIndexLow: fields.fileIndexLow as number,
    creationTimeHigh: fields.creationTimeHigh as number,
    creationTimeLow: fields.creationTimeLow as number,
  });
}

/**
 * producerに固有の結合元を検証する。
 *
 * @responsibility 元参照Hashと限定保守snapshotの混在・欠落を拒否する。
 * @trace ARCH-000008
 * @input 未検証producer。
 * @returns 二種類のいずれかの不変producer。
 * @precondition N/A: 不正入力を拒否する。
 * @postcondition 旧Token、不明nonceまたはAuthorityを復元しない。
 * @effect N/A: 純粋な形状検査である。
 * @failure 未知producer、理由または相関不一致は固定エラー。
 * @invariant Hashの実対象との関係はpublication前Ownerが別に照合する。
 * @boundary 通常清掃と人間承認付き保守の記録境界。
 * @security snapshot Hashだけを承認や保守選択Identityにしない。
 * @concurrency N/A: 同期処理で共有資源を持たない。
 */
function requireProducer(value: unknown): HostTerminalProducer {
  const normal = snapshotPlainRecord(
    value,
    new Set(["kind", "originalReferenceSha256"] as const),
  );
  if (normal?.kind === "owned_cleanup")
    return Object.freeze({
      kind: "owned_cleanup",
      originalReferenceSha256: requireHash(normal.originalReferenceSha256),
    });
  const maintenance = snapshotPlainRecord(
    value,
    new Set([
      "kind",
      "selectionSnapshotSha256",
      "originalReferenceUnknownReason",
    ] as const),
  );
  if (
    maintenance?.kind !== "human_orphan_cleanup" ||
    maintenance.originalReferenceUnknownReason !==
      "original_reference_unconfirmed"
  )
    throw new Error("host_terminal_producer_invalid");
  return Object.freeze({
    kind: "human_orphan_cleanup",
    selectionSnapshotSha256: requireHash(maintenance.selectionSnapshotSha256),
    originalReferenceUnknownReason: "original_reference_unconfirmed",
  });
}

/**
 * 完全snapshotを正規intentへ変換する。
 *
 * @responsibility 対象集合、名前、bindingsと処置順の閉Schemaを所有する。
 * @trace ARCH-000008
 * @input 未検証intent。
 * @returns nested値も所有した不変intent。
 * @precondition N/A: 不正値と初期化途中の値を拒否する。
 * @postcondition 未検証objectをJSON.stringifyしない。
 * @effect N/A: Filesystem、Process、Lockを操作しない。
 * @failure 欠落、alias、自由Path、不正参照または順序差を固定エラーで拒否する。
 * @invariant snapshot受理は現在Identity・保護・非使用の証明ではない。
 * @boundary 将来のpublication入力と純粋codecの境界。
 * @security caller-known参照を生成せず、結果から回復権限を発行しない。
 * @concurrency N/A: 同期処理であり外部観測値を再利用する許可は出さない。
 */
function normalizeIntent(value: unknown): HostTerminalIntent {
  const top = requireFields(value, [
    "contract",
    "contractRevision",
    "reference",
    "producer",
    "bindings",
    "target",
    "cleanupOrder",
  ]);
  if (
    top.contract !== "crdd-coordinator/host-terminal-intent" ||
    top.contractRevision !== 1
  )
    throw new Error("host_terminal_contract_invalid");
  if (typeof top.reference !== "string" || !REFERENCE.test(top.reference))
    throw new Error("host_terminal_reference_invalid");
  const order = snapshotPlainArray(top.cleanupOrder, ORDER.length);
  if (
    order.status !== "ok" ||
    order.value.length !== ORDER.length ||
    !ORDER.every((item, index) => item === order.value[index])
  )
    throw new Error("host_terminal_order_invalid");
  const bindings = requireFields(top.bindings, [
    "runtimeSha256",
    "repositorySha256",
    "selectedUserSha256",
  ]);
  const target = requireFields(top.target, [
    "parentIdentity",
    "recoveryDirectoryIdentity",
    "terminalDirectoryIdentity",
    "root",
    "marker",
    "children",
  ]);
  const root = requireFields(target.root, ["name", "identity"]);
  const marker = requireFields(target.marker, ["name", "identity", "sha256"]);
  if (
    typeof root.name !== "string" ||
    !/^crdd-coordinator-doctor-[A-Za-z0-9_-]{1,96}$/u.test(root.name) ||
    typeof marker.name !== "string" ||
    !/^host-[a-f0-9]{64}\.json$/u.test(marker.name)
  )
    throw new Error("host_terminal_name_invalid");
  const childInput = requireFields(target.children, CHILD_NAMES);
  const children = Object.freeze({
    workspace: requireWindowsIdentity(childInput.workspace),
    "provider-home": requireWindowsIdentity(childInput["provider-home"]),
    tmp: requireWindowsIdentity(childInput.tmp),
    events: requireWindowsIdentity(childInput.events),
    projection: requireWindowsIdentity(childInput.projection),
    management: requireWindowsIdentity(childInput.management),
  });
  const normalizedTarget = Object.freeze({
    parentIdentity: requireWindowsIdentity(target.parentIdentity),
    recoveryDirectoryIdentity: requireWindowsIdentity(
      target.recoveryDirectoryIdentity,
    ),
    terminalDirectoryIdentity: requireWindowsIdentity(
      target.terminalDirectoryIdentity,
    ),
    root: Object.freeze({
      name: root.name,
      identity: requireWindowsIdentity(root.identity),
    }),
    marker: Object.freeze({
      name: marker.name,
      identity: requireWindowsIdentity(marker.identity),
      sha256: requireHash(marker.sha256),
    }),
    children,
  });
  const identities = [
    normalizedTarget.parentIdentity,
    normalizedTarget.recoveryDirectoryIdentity,
    normalizedTarget.terminalDirectoryIdentity,
    normalizedTarget.root.identity,
    normalizedTarget.marker.identity,
    ...Object.values(children),
  ];
  const identitiesByBytes = identities.map((identity) =>
    JSON.stringify([
      identity.volumeSerial,
      identity.fileIndexHigh,
      identity.fileIndexLow,
    ]),
  );
  if (new Set(identitiesByBytes).size !== identities.length)
    throw new Error("host_terminal_identity_alias");
  return Object.freeze({
    contract: "crdd-coordinator/host-terminal-intent",
    contractRevision: 1,
    reference: top.reference,
    producer: requireProducer(top.producer),
    bindings: Object.freeze({
      runtimeSha256: requireHash(bindings.runtimeSha256),
      repositorySha256: requireHash(bindings.repositorySha256),
      selectedUserSha256: requireHash(bindings.selectedUserSha256),
    }),
    target: normalizedTarget,
    cleanupOrder: ORDER,
  });
}

/**
 * intentを改行なし正規UTF-8文書へ変換する。
 *
 * @responsibility 固定key順、文書上限とHashを一つの検証結果へ結合する。
 * @trace ARCH-000008
 * @input 未検証intent。
 * @returns 正規intent、serializedとそのUTF-8 bytesのSHA-256。
 * @precondition N/A: 不正値はEffect前に拒否する。
 * @postcondition 最大8192bytes、改行なし、全nested値が不変の文書だけを返す。
 * @effect N/A: 純粋codecであり保存・参照発行・清掃は行わない。
 * @failure Schema不一致または文書上限で固定エラー。
 * @invariant 同じ意味の値は同じkey順・整数表現になる。
 * @boundary 保存Ownerが後で使用する内部文書境界。本番未接続。
 * @security 受理からAuthority、非使用や保存成功を発行しない。
 * @concurrency N/A: 同期計算で外部状態を所有しない。
 */
export function encodeHostTerminalIntent(
  value: unknown,
): EncodedHostTerminalIntent {
  const intent = normalizeIntent(value);
  const serialized = JSON.stringify(intent);
  if (Buffer.byteLength(serialized, "utf8") > MAX_BYTES)
    throw new Error("host_terminal_bytes_exceeded");
  return Object.freeze({
    intent,
    serialized,
    sha256: createHash("sha256").update(serialized, "utf8").digest("hex"),
  });
}

/**
 * 受信bytesを境界内の所有copyへ固定する。
 *
 * @responsibility Proxy、共有memory、detachと上限を文書解析前に拒否する。
 * @trace ARCH-000008
 * @input 未検証Uint8Array候補。
 * @returns 入力のcustom getter／iteratorを使わないBuffer copy。
 * @precondition N/A: 未知入力を拒否する。
 * @postcondition 外部memoryを保持せず最大8192bytesへ限定する。
 * @effect N/A: Process内memory copyだけを行う。
 * @failure 型、intrinsic取得またはmemory状態不正は固定bytesエラー。
 * @invariant 共有memoryの瞬間値を不変文書としない。
 * @boundary 将来のbounded読取りからcodecへのbyte搬送境界。
 * @security 入力のown getterやiteratorを実行しない。
 * @concurrency SharedArrayBufferを拒否し同期的に所有copyを取る。
 */
function copyDocumentBytes(value: unknown): Buffer {
  try {
    if (
      !utilTypes.isUint8Array(value) ||
      utilTypes.isProxy(value) ||
      !byteLengthGetter ||
      !byteOffsetGetter ||
      !bufferGetter
    )
      throw new Error();
    const length: number = byteLengthGetter.call(value);
    const offset: number = byteOffsetGetter.call(value);
    const buffer: unknown = bufferGetter.call(value);
    if (
      !Number.isInteger(length) ||
      length < 1 ||
      length > MAX_BYTES ||
      !utilTypes.isArrayBuffer(buffer)
    )
      throw new Error();
    return Buffer.from(new Uint8Array(buffer as ArrayBuffer, offset, length));
  } catch {
    throw new Error("host_terminal_bytes_invalid");
  }
}

/**
 * 正規UTF-8 bytesからintentを再構成する。
 *
 * @responsibility 不正UTF-8、BOM、重複key、余分bytesと非正規JSONを拒否する。
 * @trace ARCH-000008
 * @input 未検証Uint8Array候補。
 * @returns encodeと同じ不変intent／serialized／Hash。
 * @precondition N/A: 未知値を拒否する。
 * @postcondition 元bytesと再encode bytesが完全一致した場合だけ返す。
 * @effect N/A: byte解析だけで保存・公開・Root操作を行わない。
 * @failure byte形状、UTF-8、JSON、Schemaまたは正規表現差で固定エラー。
 * @invariant bytesの受理をNative Identity、保護、由来または現在権限の証明にしない。
 * @boundary 将来の記録再読取りと内部codecの境界。本番未接続。
 * @security 不正文書本文をエラーへ複製しない。
 * @concurrency 同期の所有copyを解析し、共有memoryを拒否する。
 */
export function decodeHostTerminalIntent(
  value: unknown,
): EncodedHostTerminalIntent {
  const bytes = copyDocumentBytes(value);
  let parsed: unknown;
  try {
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    parsed = JSON.parse(text);
  } catch {
    throw new Error("host_terminal_document_invalid");
  }
  const encoded = encodeHostTerminalIntent(parsed);
  if (!bytes.equals(Buffer.from(encoded.serialized, "utf8")))
    throw new Error("host_terminal_document_not_canonical");
  return encoded;
}
