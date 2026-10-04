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
const childNames = [
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
const FIXTURE_ORDER = Object.freeze([
  "file_absence",
  "root_absence",
  "marker_absence",
  "lease_terminal",
] as const);
const FIXTURE_SHA256 =
  "be9351741a8155d01fd028d158546f1005e73ceeb0bb2d093335feac4144e450";
const identityKeys = [
  "volumeSerial",
  "fileIndexHigh",
  "fileIndexLow",
  "creationTimeHigh",
  "creationTimeLow",
  "attributes",
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
 * @responsibility file indexとcreation timeをvolumeへ結合し、同じhandleの属性を欠落なく搬送する。
 * @trace ARCH-000008
 * @shape BY_HANDLE_FILE_INFORMATION由来の五つの識別値とattributesの六u32。
 * @invariant Nodeのdev／ino／birthtimeNsや既存三field Native Identityと相互変換しない。
 * @boundary 将来の固定Windows観測Adapterと記録codecの境界。
 * @security 値の受理は実観測、所有、保護または非使用の証明ではない。
 * @compatibility revision 2だけを受理し、属性のないrevision 1を推測補完しない。
 */
export type HostTerminalWindowsIdentity = Readonly<
  Record<(typeof identityKeys)[number], number>
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
 * @shape revision 2、固定bindings、親／管理Directory／Root／marker／六childの属性付きIdentity。
 * @invariant 成功、処置済み、非使用、Authorityの自己申告fieldを持たない。
 * @boundary 本番未接続の保存入力。初期化途中やIdentity不明は入力範囲外。
 * @security 任意Path、秘密値、元回復Tokenまたは削除Capabilityを含めない。
 * @compatibility 保存・Native protocol・公開結果とは別の内部codecである。
 */
export type HostTerminalIntent = Readonly<{
  contract: "crdd-coordinator/host-terminal-intent";
  contractRevision: 2;
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
      Record<(typeof childNames)[number], HostTerminalWindowsIdentity>
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
 * 既知試験fileを含む十二実体の限定intent候補を表す。
 *
 * @responsibility 空クラスと別の改訂版で固定fileの期待条件を欠落なく保持する。
 * @trace ARCH-000008
 * @shape revision 3候補、human producer、十一実体とworkspaceの固定file一実体。
 * @invariant fileの期待値を実観測、非使用、人間承認または処置結果としない。
 * @boundary 新クラス専用codec。Nativeの十二実体観測搬送は別入口で接続し、保存・公開処置は未接続。
 * @security 任意fileやPathを受け付けず、実対象の許可は上位Ownerが別に照合する。
 * @compatibility revision 2へfileを除外して搬送せず、旧bytesから自動移行しない。
 */
export type KnownFixtureHostTerminalIntent = Readonly<
  Omit<
    HostTerminalIntent,
    "contractRevision" | "producer" | "target" | "cleanupOrder"
  > & {
    contractRevision: 3;
    resourceClass: "known_fixture_host_only_v1";
    producer: Extract<HostTerminalProducer, { kind: "human_orphan_cleanup" }>;
    target: HostTerminalIntent["target"] &
      Readonly<{
        knownFile: Readonly<{
          parent: "workspace";
          name: "fixture.txt";
          identity: HostTerminalWindowsIdentity;
          byteLength: 7;
          sha256: typeof FIXTURE_SHA256;
          linkCount: 1;
        }>;
      }>;
    cleanupOrder: typeof FIXTURE_ORDER;
  }
>;

/**
 * 新クラスの正規文書とHashを別型で保持する。
 *
 * @responsibility 十二実体を十一実体の保存入力へ暗黙変換させない。
 * @trace ARCH-000008
 * @shape 新クラスintent、改行なしserialized、そのUTF-8 Hash。
 * @invariant 正規bytesの受理は保存・公開・処置の成立ではない。
 * @boundary 新クラスcodecの内部利用側だけに返す。
 * @security Hashや固定期待条件から回復Authorityを発行しない。
 * @compatibility 既存EncodedHostTerminalIntentと別の型・入口で扱う。
 */
export type EncodedKnownFixtureHostTerminalIntent = Readonly<{
  intent: KnownFixtureHostTerminalIntent;
  serialized: string;
  sha256: string;
}>;

/**
 * 旧Host領域の固定名から、既存の世代排他と同じ結合値を導く。
 *
 * @responsibility RootのUUIDとmarker名の対応を照合し、存在しない本文nonceを要求しない。
 * @trace ARCH-000008
 * @trace ARCH-000015
 * @input 未検証のRoot単純名とmarker単純名。
 * @returns 固定名、nonce、世代結合Hashの不変値、またはnull。
 * @precondition 名前以外の実体・本文Hash・非使用・人間承認は後続Ownerが別に確認する。
 * @postcondition 既存HostOperation排他と同じUTF-8、domain、順序でHashを導く。
 * @effect N/A: 純粋な文字列検査とHash計算だけ。
 * @failure UUIDv4、markerのSHA-256名または両者の対応が不正ならnull。
 * @invariant 名前の対応から元Task、旧Token、非使用または処置権限を復元しない。
 * @boundary 限定保守の対象選択→既存世代排他への結合。
 * @security 任意Path、自由nonceまたはcaller指定の排他名を受け付けない。
 * @concurrency N/A: 共有状態を持たない同期計算。Lock取得は行わない。
 */
export function resolveHostTerminalLegacyGeneration(
  rootName: unknown,
  markerName: unknown,
): Readonly<{
  rootName: string;
  markerName: string;
  nonce: string;
  bindingSha256: string;
}> | null {
  if (typeof rootName !== "string" || typeof markerName !== "string")
    return null;
  const matched =
    /^crdd-coordinator-doctor-([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/u.exec(
      rootName,
    );
  const nonce = matched?.[1];
  if (
    !nonce ||
    markerName !==
      `host-${createHash("sha256").update(nonce).digest("hex")}.json`
  )
    return null;
  return Object.freeze({
    rootName,
    markerName,
    nonce,
    bindingSha256: createHash("sha256")
      .update("crdd-host-operation-generation-v1\0", "utf8")
      .update(rootName, "utf8")
      .update("\0", "utf8")
      .update(nonce, "utf8")
      .digest("hex"),
  });
}

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
 * @responsibility 六u32の完全性と整数表現を確認し、属性をそのまま保持する。
 * @trace ARCH-000008
 * @input 未検証Identity。
 * @returns 不変のWin32識別値。
 * @precondition N/A: 未知fieldや不正数値を拒否する。
 * @postcondition Node IdentityをWin32 Identityへ暗黙変換せず、属性の既定値を生成しない。
 * @effect N/A: 入力値の検査と複製だけを行う。
 * @failure 欠落、範囲外、非整数、負のゼロは固定Identityエラー。
 * @invariant 実観測の鮮度や対象の所有を証明しない。
 * @boundary 将来のNative観測値から記録形状への境界。
 * @security 未知値をゼロで補完しない。
 * @concurrency N/A: 同期的にown data fieldを取得する。
 */
function requireWindowsIdentity(value: unknown): HostTerminalWindowsIdentity {
  const fields = requireFields(value, identityKeys);
  for (const key of identityKeys) {
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
    attributes: fields.attributes as number,
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
    top.contractRevision !== 2
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
  const normalizedTarget = normalizeTerminalTarget(top.target);
  return Object.freeze({
    contract: "crdd-coordinator/host-terminal-intent",
    contractRevision: 2,
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
 * 両クラスに共通する十一実体の対象構造を検査する。
 *
 * @responsibility 固定名・完全Identity・相異条件を同じ検査で保持する。
 * @trace ARCH-000008
 * @input 未検証の親、管理Directory、Root、markerと六child。
 * @returns 同じ固定順の不変target。
 * @precondition N/A: 不正形状も拒否対象として受け取る。
 * @postcondition 新クラスfileは別Ownerが保持し、文書改訂版の変換は行わない。
 * @effect N/A: own data fieldの検査と局所複製だけ。
 * @failure 欠落、Path、Identity不正またはaliasを固定エラーで拒否する。
 * @invariant 形状検査から実体観測・非使用・Authorityを発行しない。
 * @boundary 二つの専用codec内部の共通構造検査。
 * @security 未検証Getterを呼ばず、未知fieldを保存しない。
 * @concurrency N/A: 同期計算で外部資源を所有しない。
 */
function normalizeTerminalTarget(value: unknown): HostTerminalIntent["target"] {
  const target = requireFields(value, [
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
  const childInput = requireFields(target.children, childNames);
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
  return normalizedTarget;
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

/**
 * 既知fileを含む十二実体を専用の正規文書へ変換する。
 *
 * @responsibility 固定fileの期待条件と人間保守producerを別改訂版へ結合する。
 * @trace ARCH-000008
 * @input 新クラスの未検証intent候補。
 * @returns 十二実体を保持する不変intent、serializedとHash。
 * @precondition 上位Ownerが許可した単一Rootの選択と実観測を別途照合する。
 * @postcondition revision 2や通常owned producerを新クラスへ変換しない。
 * @effect N/A: memoryの検査・正規化だけ。保存、Native、処置を呼ばない。
 * @failure 未知field、改訂版差、file条件差、aliasまたは上限を固定エラーで拒否する。
 * @invariant 期待するsize・Hash・リンク数を実観測や非使用確認としない。
 * @boundary 新クラス専用codec。既存十一実体の保存入口とは未接続。
 * @security 元Token、任意Path、処置済みfieldと削除Authorityを発行しない。
 * @concurrency N/A: 同期計算で共有資源を所有しない。
 */
export function encodeKnownFixtureHostTerminalIntent(
  value: unknown,
): EncodedKnownFixtureHostTerminalIntent {
  const top = requireFields(value, [
    "contract",
    "contractRevision",
    "resourceClass",
    "reference",
    "producer",
    "bindings",
    "target",
    "cleanupOrder",
  ]);
  if (
    top.contract !== "crdd-coordinator/host-terminal-intent" ||
    top.contractRevision !== 3 ||
    top.resourceClass !== "known_fixture_host_only_v1"
  )
    throw new Error("host_terminal_fixture_contract_invalid");
  if (typeof top.reference !== "string" || !REFERENCE.test(top.reference))
    throw new Error("host_terminal_reference_invalid");
  const producer = requireProducer(top.producer);
  if (producer.kind !== "human_orphan_cleanup")
    throw new Error("host_terminal_fixture_producer_invalid");
  const order = snapshotPlainArray(top.cleanupOrder, FIXTURE_ORDER.length);
  if (
    order.status !== "ok" ||
    order.value.length !== FIXTURE_ORDER.length ||
    !FIXTURE_ORDER.every((item, index) => item === order.value[index])
  )
    throw new Error("host_terminal_order_invalid");
  const target = requireFields(top.target, [
    "parentIdentity",
    "recoveryDirectoryIdentity",
    "terminalDirectoryIdentity",
    "root",
    "marker",
    "children",
    "knownFile",
  ]);
  const baseTarget = normalizeTerminalTarget({
    parentIdentity: target.parentIdentity,
    recoveryDirectoryIdentity: target.recoveryDirectoryIdentity,
    terminalDirectoryIdentity: target.terminalDirectoryIdentity,
    root: target.root,
    marker: target.marker,
    children: target.children,
  });
  if (
    !resolveHostTerminalLegacyGeneration(
      baseTarget.root.name,
      baseTarget.marker.name,
    )
  )
    throw new Error("host_terminal_fixture_generation_invalid");
  const file = requireFields(target.knownFile, [
    "parent",
    "name",
    "identity",
    "byteLength",
    "sha256",
    "linkCount",
  ]);
  if (
    file.parent !== "workspace" ||
    file.name !== "fixture.txt" ||
    file.byteLength !== 7 ||
    file.sha256 !== FIXTURE_SHA256 ||
    file.linkCount !== 1
  )
    throw new Error("host_terminal_fixture_file_invalid");
  const fileIdentity = requireWindowsIdentity(file.identity);
  if ((fileIdentity.attributes & 0x410) !== 0)
    throw new Error("host_terminal_fixture_file_invalid");
  const existingIdentities = [
    baseTarget.parentIdentity,
    baseTarget.recoveryDirectoryIdentity,
    baseTarget.terminalDirectoryIdentity,
    baseTarget.root.identity,
    baseTarget.marker.identity,
    ...Object.values(baseTarget.children),
  ];
  if (
    existingIdentities.some(
      (identity) =>
        identity.volumeSerial === fileIdentity.volumeSerial &&
        identity.fileIndexHigh === fileIdentity.fileIndexHigh &&
        identity.fileIndexLow === fileIdentity.fileIndexLow,
    )
  )
    throw new Error("host_terminal_identity_alias");
  const bindings = requireFields(top.bindings, [
    "runtimeSha256",
    "repositorySha256",
    "selectedUserSha256",
  ]);
  const intent: KnownFixtureHostTerminalIntent = Object.freeze({
    contract: "crdd-coordinator/host-terminal-intent",
    contractRevision: 3,
    resourceClass: "known_fixture_host_only_v1",
    reference: top.reference,
    producer,
    bindings: Object.freeze({
      runtimeSha256: requireHash(bindings.runtimeSha256),
      repositorySha256: requireHash(bindings.repositorySha256),
      selectedUserSha256: requireHash(bindings.selectedUserSha256),
    }),
    target: Object.freeze({
      ...baseTarget,
      knownFile: Object.freeze({
        parent: "workspace",
        name: "fixture.txt",
        identity: fileIdentity,
        byteLength: 7,
        sha256: FIXTURE_SHA256,
        linkCount: 1,
      }),
    }),
    cleanupOrder: FIXTURE_ORDER,
  });
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
 * 新クラスの正規bytesを専用型へ再構成する。
 *
 * @responsibility 十二実体の文書を旧改訂版や非正規JSONと混同しない。
 * @trace ARCH-000008
 * @input 最大8192bytesの未検証Uint8Array候補。
 * @returns 新クラスの不変intent、serializedとHash。
 * @precondition N/A: 不正bytesや旧文書も拒否対象として受け取る。
 * @postcondition 元bytesと再encodeが完全一致した場合だけ返す。
 * @effect N/A: 所有copyの解析だけ。記録保存・処置を行わない。
 * @failure UTF-8、Schema、改訂版または正規bytes差を固定エラーで拒否する。
 * @invariant 文書受理は現在実体、リンク数、承認または清掃の証明ではない。
 * @boundary 新クラスの記録搬送。既存Nativeの保存／読戻しには未接続。
 * @security 共有memory、未知値や不正文書本文を結果へ運ばない。
 * @concurrency 所有copyを同期的に読み、SharedArrayBufferを拒否する。
 */
export function decodeKnownFixtureHostTerminalIntent(
  value: unknown,
): EncodedKnownFixtureHostTerminalIntent {
  const bytes = copyDocumentBytes(value);
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
    );
  } catch {
    throw new Error("host_terminal_document_invalid");
  }
  const encoded = encodeKnownFixtureHostTerminalIntent(parsed);
  if (!bytes.equals(Buffer.from(encoded.serialized, "utf8")))
    throw new Error("host_terminal_document_not_canonical");
  return encoded;
}
