/**
 * 固定Host対象の確認要求とWindows応答を搬送する。
 *
 * @responsibility 専用Protocolの相関、資源終了と固定Native実体の確認を所有する。清掃は所有しない。
 * @trace ARCH-000008
 * @trace ARCH-000011
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";
import { createWindowsHostTerminalHelperEnvironment } from "./windows-child-environment.ts";
import { borrowRuntimeOwnedDevelopmentNativeObservation } from "../task/development-measurement-session.ts";
import {
  encodeHostTerminalIntent,
  encodeKnownFixtureHostTerminalIntent,
  type HostTerminalWindowsIdentity,
} from "./host-terminal-record.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../plain-data-snapshot.ts";
import {
  beginPlatformAccessArtifactSigningObservation,
  observePlatformAccessReleaseArtifactCandidate,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  verifyPlatformAccessArtifactSigningObservation,
} from "../diagnostics/platform-access-release.ts";
import { verifyBundledCoordinatorPackageFromFixedManifestCandidate } from "../platform-access/platform-provisioner-package-filesystem.ts";

const identityKeys = [
  "volumeSerial",
  "fileIndexHigh",
  "fileIndexLow",
  "creationTimeLow",
  "creationTimeHigh",
  "attributes",
] as const;
const MAX_RESPONSE_BYTES = 1024;
const MAX_SAVE_RESPONSE_BYTES = 2048;
const KNOWN_FIXTURE_SHA256 =
  "be9351741a8155d01fd028d158546f1005e73ceeb0bb2d093335feac4144e450";
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const frameLengthGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength",
)?.get;
const frameOffsetGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteOffset",
)?.get;
const frameBufferGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "buffer",
)?.get;
const bundledDistributionRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const requestContexts = new WeakMap<
  object,
  Readonly<{
    bytesBase64: string;
    nonceHex: string;
    rootName: string;
    markerName: string;
    selectedUser: string | null;
    namespace: readonly HostTerminalWindowsIdentity[] | null;
  }>
>();
const saveRequestContexts = new WeakMap<
  object,
  Readonly<{
    bytesBase64: string;
    reference: string;
    observationRequest: HostTerminalObservationRequest;
    identities: readonly HostTerminalWindowsIdentity[];
    selectedUserSha256: string;
    markerSha256: string;
  }>
>();
const knownFileRequestContexts = new WeakMap<
  object,
  NonNullable<ReturnType<typeof requestContexts.get>>
>();
const readRequestContexts = new WeakMap<
  object,
  NonNullable<ReturnType<typeof saveRequestContexts.get>>
>();
const knownFileSaveRequestContexts = new WeakMap<
  object,
  NonNullable<ReturnType<typeof saveRequestContexts.get>>
>();
const knownFileReadRequestContexts = new WeakMap<
  object,
  NonNullable<ReturnType<typeof saveRequestContexts.get>>
>();

/**
 * 同じcaller bytesへ結合した用途限定保存要求の私有参照を表す。
 *
 * @responsibility mutable bytesや自己申告のsaved結果をNative保存入口へ渡さない。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @shape nonceHexと既知参照。完全要求はModule内WeakMapだけが保持する。
 * @invariant 構築だけではcaller保存・Native保存・Authorityは成立しない。
 * @boundary caller保存Owner→固定Native保存Adapter。
 * @security 削除Capability、Path、SIDまたは本文を利用側へ公開しない。
 * @compatibility 旧CRDDHS01／CRDDHW01と専用CRDDKS03／CRDDKW03は私有登録を分離する。
 */
export type HostTerminalSaveRequest = Readonly<{
  nonceHex: string;
  reference: string;
}>;

/**
 * Native保存の観測・部分receiptと共同成立を表す。
 *
 * @responsibility 保存前拒否・部分保存・終端不明を同じ参照と全receiptへ保持する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @shape 状態、五元理由、対象観測、容量11/計数26/記録15bytesの不変配列と記録Effect。
 * @invariant receipt欠落と未試行を成功へ畳まず、保存成功を清掃成功にしない。
 * @boundary 固定Native専用frame→内部回復Owner。
 * @security 本文、Path、SID、元Tokenまたは清掃Authorityは含まない。
 * @compatibility 既定観測型は旧形式、専用観測型はrevision 3。receiptの0/1/2はfalse/true/未試行を区別する。
 */
export type HostTerminalNativeSave<
  Observation extends
    | HostTerminalNativeObservation
    | KnownFileHostTerminalNativeObservation = HostTerminalNativeObservation,
> = Readonly<{
  status: "saved" | "blocked";
  reference: string;
  reasons: readonly string[];
  observation: Observation;
  receipt: readonly number[] | null;
  recordEffectIssued: boolean | null;
}>;

/**
 * 同参照・独立bytesへ結合した読戻し専用参照を表す。
 *
 * @responsibility 保存要求との混用を私有登録で拒否する。
 * @trace ARCH-000008
 * @shape nonceHexとreference、完全frameは私有WeakMapのみ。
 * @invariant 構築や現在観測を清掃権限へ昇格しない。
 * @boundary caller→Native読戻しAdapter。
 * @security Path、本文、旧Tokenを公開しない。
 * @compatibility 旧CRDDHL01／CRDDHB01と専用CRDDKL03／CRDDKB03は私有登録を分離する。
 */
export type HostTerminalReadRequest = Readonly<{
  nonceHex: string;
  reference: string;
}>;

/**
 * 現在記録と今回reader終了を保持する。
 *
 * @responsibility 記録の現在事実と対象未試行・過去成功を分離する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @shape status、同参照、現在state/Identity、取得/close、元理由と外側結果。
 * @invariant observedでも対象の存在・非使用・削除権限は未成立。
 * @boundary Native読戻し応答→caller Owner。
 * @security 本文、Path、SID、Authorityなし。
 * @compatibility 既定観測型は旧形式、専用観測型はrevision 3。close null=未試行、false=未確認。stateは現在値だけ。
 */
export type HostTerminalNativeRead<
  Observation extends
    | HostTerminalNativeObservation
    | KnownFileHostTerminalNativeObservation = HostTerminalNativeObservation,
> = Readonly<{
  status: "observed" | "blocked";
  reference: string;
  state: "unknown" | "prepared" | "published";
  reason: string;
  operationReason: string | null;
  recordIdentity: HostTerminalWindowsIdentity | null;
  openIssued: boolean;
  opened: boolean;
  readerClose: boolean | null;
  generationAcquired: boolean;
  generationClose: boolean | null;
  observation: Observation;
}>;

/**
 * 完全intentから保存と分離した読戻し要求を固定する。
 *
 * @responsibility 同じ入力検査を再利用し、用途限定magicと私有参照を分離する。
 * @trace ARCH-000008
 * @input 同参照caller canonicalをfresh確認した完全intent。
 * @returns 私有読戻し要求、またはnull。
 * @precondition Schema・bindings・由来を上位Ownerが確認済み。
 * @postcondition Root/markerの存在を要求構築から推定しない。
 * @effect memory copy、nonce生成と私有登録のみ。
 * @failure 完全intent不正はnull。
 * @invariant 保存/清掃を発行しない。
 * @boundary caller→読戻しframe。
 * @security 任意Path、秘密、Authorityを持たない。
 * @concurrency 不変copyに固定する。
 */
export function createHostTerminalReadRequest(
  value: unknown,
): HostTerminalReadRequest | null {
  const savedRequest = createHostTerminalSaveRequest(value);
  if (!savedRequest) return null;
  const context = saveRequestContexts.get(savedRequest);
  if (!context) return null;
  const bytes = Buffer.from(context.bytesBase64, "base64");
  bytes.write("CRDDHL01", 0, "ascii");
  const request = Object.freeze({
    nonceHex: savedRequest.nonceHex,
    reference: savedRequest.reference,
  });
  readRequestContexts.set(
    request,
    Object.freeze({ ...context, bytesBase64: bytes.toString("base64") }),
  );
  return request;
}

/**
 * 完全intentとその正規bytesから保存要求を固定する。
 *
 * @responsibility 同参照・十一期待値・本文Hashを一つのprivate frameへ結合する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 未検証の完全intent。
 * @returns 私有保存要求参照、またはnull。
 * @precondition 本番callerは同参照のcanonicalを既存Readerでfresh再検証してから呼ぶ。
 * @postcondition 正規bytesと全期待値を保持し、任意Pathを作らない。
 * @effect Process内nonce生成、memory copyとWeakMap登録だけ。
 * @failure codec、名前、Hash、長さまたは内部要求の不正はnull。
 * @invariant factoryの成功を保存済みや処置許可と扱わない。
 * @boundary caller-known bytes→専用Native保存要求。
 * @security 記録本文は固定Workerにだけ渡し、生出力へ出さない。
 * @concurrency 不変copyに固定して後続入力変更を反映しない。
 */
export function createHostTerminalSaveRequest(
  value: unknown,
): HostTerminalSaveRequest | null {
  return createTerminalRecordSaveRequest(value, "eleven");
}

/**
 * 十二実体の完全正規文書を専用保存要求へ結合する。
 *
 * @responsibility file実体・固定内容を旧形式へ縮約せず同参照で保持する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input revision 3の完全intent候補。
 * @returns 専用私有保存要求、またはnull。
 * @precondition callerは独立期待値と完全正規bytesをfresh確認する。
 * @postcondition 十二Known値、file条件、本文Hashを471bytes headerへ保持する。
 * @effect nonce生成とmemory登録のみ。
 * @failure 旧Schema、不正条件または上限差はnull。
 * @invariant 構築は保存・非使用・清掃成立ではない。
 * @boundary caller→既知file専用保存Adapter。
 * @security 任意Path、本文公開、処置Authorityを生成しない。
 * @concurrency 入力を同期copyへ固定する。
 */
export function createKnownFileHostTerminalSaveRequest(
  value: unknown,
): HostTerminalSaveRequest | null {
  return createTerminalRecordSaveRequest(value, "known_file");
}

/**
 * 十二実体の同参照読戻しを保存と分離して固定する。
 *
 * @responsibility 正規bytesを保持し、対象Rootやfile再取得を前提にしない。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input revision 3の独立した完全intent。
 * @returns 専用私有読戻し要求、またはnull。
 * @precondition 現在caller記録を上位Ownerがfresh確認済み。
 * @postcondition CRDDKL03へ固定し保存登録と混用しない。
 * @effect memory copyと私有登録だけ。
 * @failure Schemaまたは私有Context不正はnull。
 * @invariant 保存・対象存在・清掃権限を推定しない。
 * @boundary caller→既知file専用読戻しAdapter。
 * @security Path、本文、秘密とAuthorityを公開しない。
 * @concurrency 不変copyで後続入力変更を反映しない。
 */
export function createKnownFileHostTerminalReadRequest(
  value: unknown,
): HostTerminalReadRequest | null {
  const saved = createKnownFileHostTerminalSaveRequest(value);
  if (!saved) return null;
  const context = knownFileSaveRequestContexts.get(saved);
  if (!context) return null;
  const bytes = Buffer.from(context.bytesBase64, "base64");
  bytes.write("CRDDKL03", 0, "ascii");
  const request = Object.freeze({
    nonceHex: saved.nonceHex,
    reference: saved.reference,
  });
  knownFileReadRequestContexts.set(
    request,
    Object.freeze({ ...context, bytesBase64: bytes.toString("base64") }),
  );
  return request;
}

/**
 * 閉じた二クラスの保存frameをそれぞれの専用登録へ構成する。
 *
 * @responsibility 共通の正規化・搬送順を維持し、file情報と改訂版を分離する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 完全候補と内部固定クラス。
 * @returns 私有要求、またはnull。
 * @precondition 公開の用途限定factoryだけがクラスを選ぶ。
 * @postcondition 旧407／新471bytesの全fieldと本文を保持する。
 * @effect memory copy、nonceとWeakMap登録のみ。
 * @failure codec、内部相関または上限不正はnull。
 * @invariant 新旧変換、保存・清掃・Authority発行を行わない。
 * @boundary private frame factory。
 * @security 外部指定magic、自由Path、秘密を受理しない。
 * @concurrency 同期の不変copyだけを使う。
 */
function createTerminalRecordSaveRequest(
  value: unknown,
  recordClass: "eleven" | "known_file",
): HostTerminalSaveRequest | null {
  try {
    const encoded =
      recordClass === "eleven"
        ? encodeHostTerminalIntent(value)
        : encodeKnownFixtureHostTerminalIntent(value);
    const intent = encoded.intent;
    const observationRequest = createTerminalTargetObservationRequest(
      {
        rootName: intent.target.root.name,
        markerName: intent.target.marker.name,
        namespace: [
          intent.target.parentIdentity,
          intent.target.recoveryDirectoryIdentity,
          intent.target.terminalDirectoryIdentity,
        ],
        selectedUserSha256: intent.bindings.selectedUserSha256,
      },
      recordClass,
    );
    const context =
      observationRequest &&
      (recordClass === "eleven"
        ? requestContexts
        : knownFileRequestContexts
      ).get(observationRequest);
    if (!observationRequest || !context) return null;
    const identities = Object.freeze([
      intent.target.parentIdentity,
      intent.target.recoveryDirectoryIdentity,
      intent.target.terminalDirectoryIdentity,
      intent.target.root.identity,
      intent.target.marker.identity,
      ...[
        "workspace",
        "provider-home",
        "tmp",
        "events",
        "projection",
        "management",
      ].map(
        (name) =>
          intent.target.children[name as keyof typeof intent.target.children],
      ),
      ...("knownFile" in intent.target
        ? [intent.target.knownFile.identity]
        : []),
    ]);
    const reference = Buffer.from(intent.reference, "ascii");
    const root = Buffer.from(intent.target.root.name, "ascii");
    const marker = Buffer.from(intent.target.marker.name, "ascii");
    const body = Buffer.from(encoded.serialized, "utf8");
    const headerLength = recordClass === "eleven" ? 407 : 471;
    const userOffset = recordClass === "eleven" ? 311 : 335;
    const bytes = Buffer.alloc(
      headerLength +
        reference.length +
        root.length +
        marker.length +
        body.length,
    );
    if (
      bytes.length > (recordClass === "eleven" ? 8841 : 8847) ||
      body.length < 1 ||
      body.length > 8192
    )
      return null;
    bytes.write(recordClass === "eleven" ? "CRDDHS01" : "CRDDKS03", 0, "ascii");
    bytes.writeUInt16LE(recordClass === "eleven" ? 1 : 3, 8);
    Buffer.from(context.nonceHex, "hex").copy(bytes, 10);
    bytes[42] = reference.length;
    bytes[43] = root.length;
    bytes[44] = marker.length;
    bytes.writeUInt16LE(body.length, 45);
    identities.forEach((identity, index) => {
      identityKeys.forEach((key, field) => {
        bytes.writeUInt32LE(identity[key], 47 + index * 24 + field * 4);
      });
    });
    Buffer.from(intent.bindings.selectedUserSha256, "hex").copy(
      bytes,
      userOffset,
    );
    Buffer.from(intent.target.marker.sha256, "hex").copy(
      bytes,
      userOffset + 32,
    );
    if ("knownFile" in intent.target) {
      bytes.writeUInt32LE(intent.target.knownFile.byteLength, 399);
      bytes.writeUInt32LE(intent.target.knownFile.linkCount, 403);
      Buffer.from(intent.target.knownFile.sha256, "hex").copy(bytes, 407);
    }
    Buffer.from(encoded.sha256, "hex").copy(bytes, headerLength - 32);
    reference.copy(bytes, headerLength);
    root.copy(bytes, headerLength + reference.length);
    marker.copy(bytes, headerLength + reference.length + root.length);
    body.copy(
      bytes,
      headerLength + reference.length + root.length + marker.length,
    );
    const request = Object.freeze({
      nonceHex: context.nonceHex,
      reference: intent.reference,
    });
    (recordClass === "eleven"
      ? saveRequestContexts
      : knownFileSaveRequestContexts
    ).set(
      request,
      Object.freeze({
        bytesBase64: bytes.toString("base64"),
        reference: intent.reference,
        observationRequest,
        identities,
        selectedUserSha256: intent.bindings.selectedUserSha256,
        markerSha256: intent.target.marker.sha256,
      }),
    );
    return request;
  } catch {
    return null;
  }
}

/**
 * 保存応答を同参照・Known全体・部分receiptへ結合する。
 *
 * @responsibility exitや単一成功flagではなく、全観測と保存終端の共同条件を検査する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input Native stdout候補と私有保存要求。
 * @returns 不変の保存結果、または搬送不正のnull。
 * @precondition 実Process終了と配布実体の前後一致は呼出し側が確認する。
 * @postcondition 保存成功には対象一致・inventory完了・公開確認・全closeを要求する。
 * @effect N/A: 所有bytesの解析だけ。
 * @failure 未知形式、余剰、nonce/参照差、receipt相関崩れまたは不正成功はnull。
 * @invariant nullは記録Effect不明でありEffect 0ではない。
 * @boundary 専用Native frame→内部回復Owner。
 * @security 生出力、本文、Path、SIDや清掃許可を返さない。
 * @concurrency getterなしの同期copyだけを使い、共有memoryを拒否する。
 */
export function evaluateHostTerminalSaveResponse(
  value: unknown,
  request: HostTerminalSaveRequest,
): HostTerminalNativeSave | null {
  return evaluateTerminalRecordSaveResponse(
    value,
    request,
    saveRequestContexts.get(request),
    "CRDDHW01",
    1,
    evaluateHostTerminalObservationResponse,
  );
}

/**
 * 十二実体専用の保存結果を全Known値へ結合する。
 *
 * @responsibility file、同参照、部分receiptと全終了を落とさず解析する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 専用応答候補と専用私有要求。
 * @returns 十二実体保存結果、またはnull。
 * @precondition 実Process終端・実行物一致は搬送Ownerが別確認する。
 * @postcondition 全Known一致とreceipt共同成立だけsavedとする。
 * @effect N/A: 所有bytesの解析のみ。
 * @failure 旧frame、要求混用、file差、相関不正はnull。
 * @invariant 解析失敗を記録Effect 0としない。
 * @boundary CRDDKW03→内部回復Owner。
 * @security 生本文、Path、秘密と清掃Authorityを返さない。
 * @concurrency Proxy／共有memoryを拒否して同期copyする。
 */
export function evaluateKnownFileHostTerminalSaveResponse(
  value: unknown,
  request: HostTerminalSaveRequest,
): HostTerminalNativeSave<KnownFileHostTerminalNativeObservation> | null {
  return evaluateTerminalRecordSaveResponse(
    value,
    request,
    knownFileSaveRequestContexts.get(request),
    "CRDDKW03",
    3,
    evaluateKnownFileHostTerminalObservationResponse,
  );
}

/**
 * 専用クラスの保存相関・receipt共同条件を共通検査する。
 *
 * @responsibility 内包decoderの型と私有Contextを維持し、旧新変換をしない。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 所有応答候補、私有要求、内部固定Protocolとdecoder。
 * @returns 型を保持した保存結果、またはnull。
 * @precondition 専用wrapperだけが一致するContext／decoderを渡す。
 * @postcondition 全Identity、利用者、marker、receiptの相関を検査する。
 * @effect N/A: memory解析だけ。
 * @failure 不正field、終端差、Known差または未登録はnull。
 * @invariant 部分結果とEffect不明を保持する。
 * @boundary private record decoder。
 * @security 任意Protocolや処置Authorityを公開しない。
 * @concurrency 所有memoryだけを同期解析する。
 */
function evaluateTerminalRecordSaveResponse<
  Observation extends
    | HostTerminalNativeObservation
    | KnownFileHostTerminalNativeObservation,
>(
  value: unknown,
  request: HostTerminalSaveRequest,
  context: ReturnType<typeof saveRequestContexts.get>,
  magic: "CRDDHW01" | "CRDDKW03",
  revision: 1 | 3,
  decodeObservation: (
    value: unknown,
    request: HostTerminalObservationRequest,
  ) => Observation | null,
): HostTerminalNativeSave<Observation> | null {
  try {
    const bytes = copyTerminalFrame(value, MAX_SAVE_RESPONSE_BYTES);
    if (
      !context ||
      !bytes ||
      bytes.length < 52 ||
      bytes.subarray(0, 8).toString("ascii") !== magic ||
      bytes.readUInt16LE(8) !== revision ||
      bytes.subarray(10, 42).toString("hex") !== request.nonceHex
    )
      return null;
    const saved = bytes[42];
    const referenceLength = bytes[43];
    const present = bytes[51];
    if (
      saved === undefined ||
      saved > 1 ||
      referenceLength !== 50 ||
      present === undefined ||
      present > 1
    )
      return null;
    const lengths = Array.from(bytes.subarray(44, 49));
    if (lengths[0] === 0 || lengths.some((length) => length > 96)) return null;
    const observationLength = bytes.readUInt16LE(49);
    let offset = 52 + referenceLength;
    if (bytes.subarray(52, offset).toString("ascii") !== context.reference)
      return null;
    const reasons = lengths.map((length) => {
      const reason = bytes.subarray(offset, offset + length).toString("utf8");
      offset += length;
      return reason;
    });
    if (
      reasons.some(
        (reason) => reason !== "" && !/^terminal_[a-z0-9_]+$/u.test(reason),
      ) ||
      bytes.length !== offset + observationLength + (present === 1 ? 52 : 0)
    )
      return null;
    const observation = decodeObservation(
      bytes.subarray(offset, offset + observationLength),
      context.observationRequest,
    );
    if (!observation) return null;
    if (
      observation.snapshot &&
      (observation.snapshot.selectedUserSha256 !== context.selectedUserSha256 ||
        observation.snapshot.markerSha256 !== context.markerSha256 ||
        observation.snapshot.identities.some((identity, index) =>
          identityKeys.some(
            (key) => identity[key] !== context.identities[index]?.[key],
          ),
        ))
    )
      return null;
    const receipt =
      present === 1 ? bytes.subarray(offset + observationLength) : null;
    if (receipt) {
      const booleans = [
        0, 1, 2, 3, 4, 11, 24, 25, 26, 36, 37, 38, 39, 40, 41, 42, 43, 44,
      ];
      if (
        booleans.some((index) => (receipt[index] ?? 255) > 1) ||
        [9, 10, 27, 49, 50, 51].some((index) => (receipt[index] ?? 255) > 2) ||
        (receipt[4] === 0 && receipt.readUInt32LE(5) !== 0) ||
        (receipt[11] === 0 &&
          receipt.subarray(12, 37).some((byte) => byte !== 0)) ||
        (receipt[37] === 0 &&
          receipt.subarray(38).some((byte) => byte !== 0)) ||
        (receipt[44] === 0 && receipt.readInt32LE(45) !== 0)
      )
        return null;
    }
    if (
      saved === 1 &&
      (!receipt ||
        observation.status !== "observed" ||
        reasons[0] !== "terminal_record_saved" ||
        reasons.slice(1).some((reason) => reason !== "") ||
        receipt.subarray(0, 5).some((byte) => byte !== 1) ||
        receipt.readUInt32LE(5) !== 0 ||
        receipt[9] !== 1 ||
        receipt[10] !== 1 ||
        receipt[11] !== 1 ||
        receipt[24] !== 0 ||
        receipt[25] !== 1 ||
        receipt[27] !== (receipt[26] === 1 ? 1 : 2) ||
        receipt.readUInt32LE(28) !== receipt.readUInt32LE(32) ||
        receipt[36] !== 0 ||
        receipt[37] !== 1 ||
        receipt.subarray(38, 45).some((byte) => byte !== 1) ||
        receipt.readInt32LE(45) !== 0 ||
        receipt.subarray(49).some((byte) => byte !== 1))
    )
      return null;
    return Object.freeze({
      status: saved === 1 ? "saved" : "blocked",
      reference: context.reference,
      reasons: Object.freeze(reasons),
      observation,
      receipt: receipt ? Object.freeze(Array.from(receipt)) : null,
      recordEffectIssued:
        receipt?.[37] === 1 ? (receipt[38] === 1 ? true : null) : false,
    });
  } catch {
    return null;
  }
}

/**
 * 専用読戻し応答を同参照と今回終了へ結合する。
 *
 * @responsibility 原記録の履歴を捏造せず、現在候補・部分終了を保持する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 完全Buffer候補と私有読戻し要求。
 * @returns 現在記録の観測/停止、または搬送不正null。
 * @precondition 子終端と成果物前後一致は呼出しOwnerが別確認する。
 * @postcondition 同nonce・同参照・全field・close共同成立を確認する。
 * @effect N/A: 所有memoryの解析のみ。
 * @failure 不正magic/形状/相関、不正成功はnull。
 * @invariant 対象未試行は有効な未試行であり、対象不存在ではない。
 * @boundary Native frame→回復Owner。
 * @security 本文、Path、SID、Authorityを受理/発行しない。
 * @concurrency Proxy/共有memoryを拒否して同期copyする。
 */
export function evaluateHostTerminalReadResponse(
  value: unknown,
  request: HostTerminalReadRequest,
): HostTerminalNativeRead | null {
  return evaluateTerminalRecordReadResponse(
    value,
    request,
    readRequestContexts.get(request),
    "CRDDHB01",
    2,
    evaluateHostTerminalObservationResponse,
  );
}

/**
 * 十二実体の同参照記録を対象未取得のまま解析する。
 *
 * @responsibility 現在記録・reader終了と元対象未試行を区別する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input CRDDKB03候補と専用私有読戻し要求。
 * @returns 現在記録と専用観測、またはnull。
 * @precondition callerは独立完全bytesをfresh確認している。
 * @postcondition 対象取得0と同nonce／参照／全終了を検査する。
 * @effect N/A: 所有bytes解析のみ。
 * @failure 新旧混用、偽要求、不正成功はnull。
 * @invariant Root未試行を不存在または非使用へ昇格しない。
 * @boundary Native現在Reader→回復Owner。
 * @security 本文、Path、SID、Authorityを公開しない。
 * @concurrency Proxy／共有memoryを拒否する。
 */
export function evaluateKnownFileHostTerminalReadResponse(
  value: unknown,
  request: HostTerminalReadRequest,
): HostTerminalNativeRead<KnownFileHostTerminalNativeObservation> | null {
  return evaluateTerminalRecordReadResponse(
    value,
    request,
    knownFileReadRequestContexts.get(request),
    "CRDDKB03",
    3,
    evaluateKnownFileHostTerminalObservationResponse,
  );
}

/**
 * 専用Readerの相関・現在状態・終了共同条件を検査する。
 *
 * @responsibility クラス固有の私有Contextと内包観測型を保持する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 応答候補、内部固定Protocolとdecoder、私有要求。
 * @returns 現在記録結果、またはnull。
 * @precondition 専用wrapperからだけ呼ぶ。
 * @postcondition 対象未試行・部分reader終了を変換せず保持する。
 * @effect N/A: memory解析のみ。
 * @failure 不正形状、相関または共同条件はnull。
 * @invariant 現在stateと履歴・清掃Authorityを混同しない。
 * @boundary private Reader decoder。
 * @security 生本文と自由Protocolを公開しない。
 * @concurrency 不変copyだけを解析する。
 */
function evaluateTerminalRecordReadResponse<
  Observation extends
    | HostTerminalNativeObservation
    | KnownFileHostTerminalNativeObservation,
>(
  value: unknown,
  request: HostTerminalReadRequest,
  context: ReturnType<typeof saveRequestContexts.get>,
  magic: "CRDDHB01" | "CRDDKB03",
  revision: 2 | 3,
  decodeObservation: (
    value: unknown,
    request: HostTerminalObservationRequest,
  ) => Observation | null,
): HostTerminalNativeRead<Observation> | null {
  try {
    const bytes = copyTerminalFrame(value, MAX_SAVE_RESPONSE_BYTES);
    if (
      !context ||
      !bytes ||
      bytes.length < 55 ||
      bytes.subarray(0, 8).toString("ascii") !== magic ||
      bytes.readUInt16LE(8) !== revision ||
      bytes.subarray(10, 42).toString("hex") !== request.nonceHex
    )
      return null;
    const observed = bytes[42] ?? 255;
    const state = bytes[43] ?? 255;
    const referenceLength = bytes[44];
    const reasonLength = bytes[45] ?? 255;
    const operationLength = bytes[46] ?? 255;
    const observationLength = bytes.readUInt16LE(47);
    const identityPresent = bytes[49] ?? 255;
    const openIssued = bytes[50] ?? 255;
    const opened = bytes[51] ?? 255;
    const close = bytes[52] ?? 255;
    const generationAcquired = bytes[53] ?? 255;
    const generationClose = bytes[54] ?? 255;
    const observationOffset = 55 + 50 + reasonLength + operationLength;
    if (
      observed > 1 ||
      state > 2 ||
      referenceLength !== 50 ||
      reasonLength < 1 ||
      reasonLength > 96 ||
      operationLength > 96 ||
      identityPresent > 1 ||
      openIssued > 1 ||
      opened > openIssued ||
      close > 2 ||
      generationAcquired > 1 ||
      generationClose > 2 ||
      (generationAcquired === 0 && generationClose !== 2) ||
      (generationAcquired === 0 && openIssued === 1) ||
      (opened === 0 && close !== 2) ||
      (identityPresent === 1 && opened !== 1) ||
      bytes.length !==
        observationOffset +
          observationLength +
          (identityPresent === 1 ? 24 : 0) ||
      bytes.subarray(55, 105).toString("ascii") !== context.reference
    )
      return null;
    const reason = bytes.subarray(105, 105 + reasonLength).toString("utf8");
    const operationReason =
      operationLength === 0
        ? null
        : bytes
            .subarray(105 + reasonLength, observationOffset)
            .toString("utf8");
    if (
      !/^terminal_[a-z0-9_]+$/u.test(reason) ||
      (operationReason !== null &&
        !/^terminal_[a-z0-9_]+$/u.test(operationReason))
    )
      return null;
    const observation = decodeObservation(
      bytes.subarray(observationOffset, observationOffset + observationLength),
      context.observationRequest,
    );
    if (
      !observation ||
      observation.snapshot !== null ||
      observation.targetAcquired !== 0 ||
      observation.targetCloses.length !== 0
    )
      return null;
    const recordIdentity =
      identityPresent === 1
        ? (Object.freeze(
            Object.fromEntries(
              identityKeys.map((key, index) => [
                key,
                bytes.readUInt32LE(
                  observationOffset + observationLength + index * 4,
                ),
              ]),
            ),
          ) as HostTerminalWindowsIdentity)
        : null;
    if (
      recordIdentity &&
      ((recordIdentity.attributes & 0x410) !== 0 ||
        context.identities
          .slice(0, 3)
          .some(
            (identity) =>
              identity.volumeSerial === recordIdentity.volumeSerial &&
              identity.fileIndexHigh === recordIdentity.fileIndexHigh &&
              identity.fileIndexLow === recordIdentity.fileIndexLow,
          ))
    )
      return null;
    if (
      observed === 1 &&
      (state === 0 ||
        !recordIdentity ||
        opened !== 1 ||
        close !== 1 ||
        generationAcquired !== 1 ||
        generationClose !== 1 ||
        reason !== "terminal_record_observed" ||
        operationReason !== null ||
        observation.phase !== 2 ||
        observation.reason !== "terminal_target_not_attempted" ||
        observation.operationReason !== null ||
        observation.tokensAcquired !== 2 ||
        observation.directoriesAcquired < 4 ||
        observation.tokenCloses.some((closed) => !closed) ||
        observation.directoryCloses.some((closed) => !closed))
    )
      return null;
    return Object.freeze({
      status: observed === 1 ? "observed" : "blocked",
      reference: context.reference,
      state: state === 1 ? "prepared" : state === 2 ? "published" : "unknown",
      reason,
      operationReason,
      recordIdentity,
      openIssued: openIssued === 1,
      opened: opened === 1,
      readerClose: close === 2 ? null : close === 1,
      generationAcquired: generationAcquired === 1,
      generationClose: generationClose === 2 ? null : generationClose === 1,
      observation,
    });
  } catch {
    return null;
  }
}

/**
 * caller-known記録の保存/読戻しを固定Nativeへ一回だけ接続する。
 *
 * @responsibility 配布実体・私有要求・実child終了・応答相関を共同確認し、搬送不明を保持する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input modeに結合した私有要求、署名評価時点、取消Signalと固定開発観測Context。
 * @returns 同参照、Native部分結果、Process・記録Effectと終了確認。
 * @precondition 本番callerが同参照のcanonicalをfresh読取りして完全bytesを結合済み。
 * @postcondition 未確認時は別参照発行・再保存・stage清掃を行わない。
 * @effect 固定Workerの起動。saveは限定記録保存、readは記録・対象の変更なし。
 * @failure 搬送不明では停止する。saveの記録Effect不明とreadの変更なしを区別する。
 * @invariant 保存、取消後状態、非使用、清掃Authorityを混同しない。
 * @boundary caller記録Owner→固定Nativeの保存または読戻しmode→保護済み記録。
 * @security shell/PATH探索、自由Path、ACL修復、Root削除、Provider依頼は行わない。
 * @concurrency 一回の同期呼出し前後で取消を確認し、実行中の即時取消は保証しない。
 */
function executeHostTerminalRecordRequest<
  Observation extends
    | HostTerminalNativeObservation
    | KnownFileHostTerminalNativeObservation,
>(
  request: HostTerminalSaveRequest | HostTerminalReadRequest,
  mode: "save" | "read",
  evaluationTime: unknown,
  signal: AbortSignal,
  developmentContext: unknown,
  contexts: typeof saveRequestContexts,
  decodeSave: (
    value: unknown,
    request: HostTerminalSaveRequest,
  ) => HostTerminalNativeSave<Observation> | null,
  decodeRead: (
    value: unknown,
    request: HostTerminalReadRequest,
  ) => HostTerminalNativeRead<Observation> | null,
  nativeMode:
    | "--host-terminal-save"
    | "--host-terminal-read"
    | "--host-terminal-known-file-save"
    | "--host-terminal-known-file-read",
) {
  let isLaunchRequested = false;
  let processEffectIssued: boolean | null = false;
  let helperExitConfirmed = false;
  let nativeSave: HostTerminalNativeSave<Observation> | null = null;
  let nativeRead: HostTerminalNativeRead<Observation> | null = null;
  let isNativeExitCorrelated = false;
  /**
   * 同参照と現在までの保存・搬送結果を停止へ保持する。
   *
   * @responsibility 部分保存を失わず、応答不明を未発行にしない。
   * @trace ARCH-000008
   * @trace ARCH-000011
   * @input 固定停止理由。
   * @returns immutable停止結果。
   * @precondition 同じ関数内の開始・Native結果を読む。
   * @postcondition 保存済みreceiptや既知参照を消さない。
   * @effect N/A: 結果構築だけ。
   * @failure N/A: 失敗の記録であり再処置はしない。
   * @invariant launch後の不明を記録Effect falseへ戻さない。
   * @boundary Native搬送Owner→回復Owner。
   * @security Path、生出力、本文またはAuthorityを返さない。
   * @concurrency 同期呼出し内の現在値だけを固定する。
   */
  const stopped = (reason: string) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      reference: contexts.get(request)?.reference ?? null,
      nativeSave,
      nativeRead,
      processEffectIssued,
      helperExitConfirmed,
      recordEffectIssued:
        mode === "read"
          ? false
          : nativeSave && !isNativeExitCorrelated
            ? null
            : (nativeSave?.recordEffectIssued ??
              (isLaunchRequested ? null : false)),
      runtimeAuthorityIssued: false,
      cleanupAuthorized: false,
    });
  try {
    const context = contexts.get(request);
    if (!context)
      return stopped(
        mode === "save"
          ? "host_terminal_save_request_invalid"
          : "host_terminal_read_request_invalid",
      );
    if (signal.aborted)
      return stopped(
        mode === "save"
          ? "host_terminal_save_cancelled"
          : "host_terminal_read_cancelled",
      );
    if (process.platform !== "win32")
      return stopped("host_terminal_platform_unsupported");
    const development =
      developmentContext === undefined
        ? null
        : borrowRuntimeOwnedDevelopmentNativeObservation(
            developmentContext as object,
            false,
          );
    if (developmentContext !== undefined && !development)
      return stopped("host_terminal_development_context_invalid");
    const distributionRoot =
      development?.distributionRoot ?? bundledDistributionRoot;
    const verification =
      development?.verification ??
      verifyBundledCoordinatorPackageFromFixedManifestCandidate({
        evaluationTime,
      });
    if (
      verification.status !== "candidate" ||
      (!development &&
        (!("runtimeOwnedReleaseTrustConfirmed" in verification) ||
          verification.runtimeOwnedReleaseTrustConfirmed !== true ||
          !("runtimeExecutionIdentityRuntimeOwned" in verification) ||
          verification.runtimeExecutionIdentityRuntimeOwned !== true ||
          !("crddDistributionConfirmed" in verification) ||
          verification.crddDistributionConfirmed !== true))
    )
      return stopped("host_terminal_release_not_verified");
    const before =
      observePlatformAccessReleaseArtifactCandidate(distributionRoot);
    const signing =
      beginPlatformAccessArtifactSigningObservation(distributionRoot);
    if (
      before.status !== "candidate" ||
      !signing ||
      JSON.stringify(before.artifact) !==
        JSON.stringify(verification.platformAccessArtifact) ||
      JSON.stringify(before.artifact) !== JSON.stringify(signing.artifact)
    )
      return stopped("host_terminal_artifact_not_verified");
    const environment = createWindowsHostTerminalHelperEnvironment();
    if (!environment) return stopped("host_terminal_environment_unavailable");
    if (signal.aborted)
      return stopped(
        mode === "save"
          ? "host_terminal_save_cancelled"
          : "host_terminal_read_cancelled",
      );
    isLaunchRequested = true;
    processEffectIssued = null;
    const execution = spawnSync(
      path.join(
        distributionRoot,
        ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
      ),
      [nativeMode],
      {
        input: Buffer.from(context.bytesBase64, "base64"),
        encoding: "buffer",
        env: environment,
        shell: false,
        windowsHide: true,
        timeout: 5000,
        maxBuffer: MAX_SAVE_RESPONSE_BYTES + 1,
      },
    );
    processEffectIssued = execution.pid !== undefined ? true : null;
    helperExitConfirmed =
      execution.error === undefined &&
      execution.signal === null &&
      execution.status !== null;
    if (
      !helperExitConfirmed ||
      !Buffer.isBuffer(execution.stderr) ||
      execution.stderr.length !== 0
    )
      return stopped("host_terminal_worker_transport_unconfirmed");
    if (!verifyPlatformAccessArtifactSigningObservation(signing.token))
      return stopped("host_terminal_artifact_changed");
    const after =
      observePlatformAccessReleaseArtifactCandidate(distributionRoot);
    if (
      after.status !== "candidate" ||
      JSON.stringify(before.artifact) !== JSON.stringify(after.artifact) ||
      (developmentContext !== undefined &&
        !borrowRuntimeOwnedDevelopmentNativeObservation(
          developmentContext as object,
          false,
        ))
    )
      return stopped("host_terminal_artifact_changed");
    if (mode === "read") nativeRead = decodeRead(execution.stdout, request);
    else nativeSave = decodeSave(execution.stdout, request);
    isNativeExitCorrelated =
      (mode === "save" ? nativeSave !== null : nativeRead !== null) &&
      execution.status ===
        (nativeSave?.status === "saved" || nativeRead?.status === "observed"
          ? 0
          : 2);
    if (!isNativeExitCorrelated) {
      return stopped(
        mode === "save"
          ? "host_terminal_save_response_invalid"
          : "host_terminal_read_response_invalid",
      );
    }
    if (signal.aborted)
      return stopped(
        mode === "save"
          ? "host_terminal_save_cancelled"
          : "host_terminal_read_cancelled",
      );
    if (mode === "read" && nativeRead?.status !== "observed")
      return stopped(
        nativeRead?.observation.phase === 4
          ? nativeRead.observation.reason
          : (nativeRead?.reason ?? "host_terminal_read_unconfirmed"),
      );
    if (mode === "save" && nativeSave?.status !== "saved")
      return stopped(
        nativeSave?.observation.phase === 4
          ? nativeSave.observation.reason
          : (nativeSave?.reasons[0] ?? "host_terminal_save_unconfirmed"),
      );
    return Object.freeze({
      ...stopped(
        mode === "save"
          ? "host_terminal_record_saved"
          : "host_terminal_record_observed",
      ),
      status: "completed" as const,
      artifactVerifiedBeforeAndAfter: true,
      executionSourceKind: development
        ? "fixed_development_candidate"
        : "signed_release",
    });
  } catch {
    return stopped(
      mode === "save"
        ? "host_terminal_save_unconfirmed"
        : "host_terminal_read_unconfirmed",
    );
  }
}

/**
 * caller-known記録を専用保存modeで一回だけ搬送する。
 *
 * @responsibility 保存以外のmodeへ要求を流用しない。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 私有保存要求、評価時点、取消と固定開発Context。
 * @returns savedまたは部分receipt付き停止。
 * @precondition caller canonicalをfresh検証済み。
 * @postcondition 子終端・成果物・保存receiptの共同確認後だけsaved。
 * @effect 固定Nativeを通じた限定保存のみ。
 * @failure 搬送不明は同参照を保持し再保存しない。
 * @invariant 保存を非使用・削除権限にしない。
 * @boundary caller→専用保存Adapter。
 * @security 初期化、ACL修復、Provider、削除なし。
 * @concurrency 一回の同期実行、前後取消確認。
 */
export function saveHostTerminalWindowsRecord(
  request: HostTerminalSaveRequest,
  evaluationTime: unknown,
  signal: AbortSignal,
  developmentContext?: unknown,
) {
  const result = executeHostTerminalRecordRequest(
    request,
    "save",
    evaluationTime,
    signal,
    developmentContext,
    saveRequestContexts,
    evaluateHostTerminalSaveResponse,
    evaluateHostTerminalReadResponse,
    "--host-terminal-save",
  );
  return Object.freeze({
    ...result,
    status:
      result.status === "completed" ? ("saved" as const) : ("blocked" as const),
  });
}

/**
 * 同参照の現在記録を専用読戻しmodeで一回だけ搬送する。
 *
 * @responsibility Root消失後も記録結果を同参照で保持する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 私有読戻し要求、評価時点、取消と固定開発Context。
 * @returns observedまたは部分receipt付き停止。
 * @precondition caller canonicalをfresh検証済み。
 * @postcondition 全終了と相関確認後だけ現在記録観測を成立させる。
 * @effect 固定Nativeの読取りProcessのみ。記録/対象変更0。
 * @failure 搬送不明は同参照で停止しretryしない。
 * @invariant 現在stateを履歴・非使用・削除権限にしない。
 * @boundary caller→専用読戻しAdapter。
 * @security 本文公開、自由Path、復元、再保存、削除なし。
 * @concurrency 一回の同期実行、前後取消確認。
 */
export function readHostTerminalWindowsRecord(
  request: HostTerminalReadRequest,
  evaluationTime: unknown,
  signal: AbortSignal,
  developmentContext?: unknown,
) {
  const result = executeHostTerminalRecordRequest(
    request,
    "read",
    evaluationTime,
    signal,
    developmentContext,
    readRequestContexts,
    evaluateHostTerminalSaveResponse,
    evaluateHostTerminalReadResponse,
    "--host-terminal-read",
  );
  return Object.freeze({
    ...result,
    status:
      result.status === "completed"
        ? ("observed" as const)
        : ("blocked" as const),
  });
}

/**
 * 十二実体の記録を専用Nativeへ一回だけ保存する。
 *
 * @responsibility fileを含む完全要求と部分保存を同参照で保持する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 専用私有要求、評価時点、取消Signalと固定開発Context。
 * @returns saved、または部分結果付き停止。
 * @precondition caller canonicalをfresh確認済み。
 * @postcondition 実行物前後一致、子終端と全receipt共同成立だけsaved。
 * @effect 固定Native Processと限定記録保存。
 * @failure 搬送不明では同参照を保持し再保存しない。
 * @invariant 保存から対象非使用や削除許可を発行しない。
 * @boundary caller→--host-terminal-known-file-save。
 * @security 旧mode、自由Path、ACL変更、Providerまたは削除へ接続しない。
 * @concurrency 同期実行の前後で取消を確認する。
 */
export function saveKnownFileHostTerminalWindowsRecord(
  request: HostTerminalSaveRequest,
  evaluationTime: unknown,
  signal: AbortSignal,
  developmentContext?: unknown,
) {
  const result = executeHostTerminalRecordRequest(
    request,
    "save",
    evaluationTime,
    signal,
    developmentContext,
    knownFileSaveRequestContexts,
    evaluateKnownFileHostTerminalSaveResponse,
    evaluateKnownFileHostTerminalReadResponse,
    "--host-terminal-known-file-save",
  );
  return Object.freeze({
    ...result,
    status:
      result.status === "completed" ? ("saved" as const) : ("blocked" as const),
  });
}

/**
 * 十二実体の同参照記録を対象未取得で読戻す。
 *
 * @responsibility Root消失後も独立完全bytesと現在記録を同参照で確認する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input 専用私有要求、評価時点、取消Signalと固定開発Context。
 * @returns observed、または部分結果付き停止。
 * @precondition caller canonicalをfresh確認済み。
 * @postcondition 実行物、現在Reader、子終端と全close共同成立を要求する。
 * @effect 固定Native読取りProcessのみ。対象・記録変更なし。
 * @failure 不明は同参照で停止し再発行・復元しない。
 * @invariant 対象未試行を不存在、非使用または清掃成立としない。
 * @boundary caller→--host-terminal-known-file-read。
 * @security 本文公開、自由Path、Authority、Provider依頼を生成しない。
 * @concurrency 同期実行の前後で取消を確認する。
 */
export function readKnownFileHostTerminalWindowsRecord(
  request: HostTerminalReadRequest,
  evaluationTime: unknown,
  signal: AbortSignal,
  developmentContext?: unknown,
) {
  const result = executeHostTerminalRecordRequest(
    request,
    "read",
    evaluationTime,
    signal,
    developmentContext,
    knownFileReadRequestContexts,
    evaluateKnownFileHostTerminalSaveResponse,
    evaluateKnownFileHostTerminalReadResponse,
    "--host-terminal-known-file-read",
  );
  return Object.freeze({
    ...result,
    status:
      result.status === "completed"
        ? ("observed" as const)
        : ("blocked" as const),
  });
}

/**
 * 相関する要求の非Authority参照を表す。
 *
 * @responsibility mutable bytesではなく固定要求の私有参照を搬送する。
 * @trace ARCH-000011
 * @shape 相関nonceだけを持つ私有要求参照。
 * @invariant 有効性はこのModuleのWeakMapへ結合した要求に限定する。
 * @boundary 内部回復Owner→用途限定Adapter。
 * @security 回復、清掃、Root生成のAuthorityではない。
 * @compatibility CRDDHT02/CRDDHR02 revision 2専用。
 */
export type HostTerminalObservationRequest = Readonly<{ nonceHex: string }>;

/**
 * 既知file専用要求を私有登録へ結合する。
 *
 * @responsibility 同じ形の旧要求との混用を別WeakMapで拒否する。
 * @trace ARCH-000011
 * @shape nonceHexだけ。要求bytesと対象名は私有Contextに保持する。
 * @invariant 値のcopy、nonce一致または構築成功は有効要求やAuthorityではない。
 * @boundary 回復準備Owner→専用Native観測。
 * @security Path・本文・削除許可を公開しない。
 * @compatibility 候補CRDDKC03／CRDDKT03 revision 3専用。
 */
export type KnownFileHostTerminalObservationRequest = Readonly<{
  nonceHex: string;
}>;

/**
 * Nativeの現在観測と初回終了結果を表す。
 *
 * @responsibility Native拒否と観測成功を区別し、部分取得を保持する。
 * @trace ARCH-000011
 * @shape phase、reason、元理由、位置、三取得数、close列、成功時だけ十一実体とHash。
 * @invariant 失敗はSnapshotなし。成功でも非使用、保存、清掃は未成立。
 * @boundary 検証済みNative frame→内部回復Owner。
 * @security 生Path、SID、marker本文、削除Capabilityを返さない。
 * @compatibility 専用modeのrevision 2だけを解釈する。
 */
export type HostTerminalNativeObservation = Readonly<{
  expectationKind: "current" | "known";
  status: "observed" | "blocked";
  phase: number;
  reason: string;
  operationReason: string | null;
  position: number | null;
  targetAcquired: number;
  tokensAcquired: number;
  directoriesAcquired: number;
  tokenCloses: readonly boolean[];
  directoryCloses: readonly boolean[];
  targetCloses: readonly boolean[];
  snapshot: Readonly<{
    identities: readonly HostTerminalWindowsIdentity[];
    selectedUserSha256: string;
    markerSha256: string;
  }> | null;
}>;

/**
 * 既知fileを含む十二実体の現在観測と終了を保持する。
 *
 * @responsibility fileの長さ・リンク数・Hashを旧Snapshotへ縮約せず保持する。
 * @trace ARCH-000011
 * @shape 九対象close、十二Identity、利用者／marker HashとknownFile固定値。
 * @invariant namespace_knownは全十二対象のKnown、非使用、保存または清掃成立ではない。
 * @boundary 専用Native frame→内部回復準備Owner。
 * @security 本文・Path・SID・Authorityを返さない。
 * @compatibility CRDDKR03 revision 3だけ。専用保存／読戻しでも同じ観測型を保持する。
 */
export type KnownFileHostTerminalNativeObservation = Readonly<
  Omit<HostTerminalNativeObservation, "expectationKind" | "snapshot"> & {
    expectationKind: "current" | "namespace_known";
    snapshot: Readonly<{
      identities: readonly HostTerminalWindowsIdentity[];
      selectedUserSha256: string;
      markerSha256: string;
      knownFile: Readonly<{ byteLength: 7; linkCount: 1; sha256: string }>;
    }> | null;
  }
>;

/**
 * 完全intentから確認だけの固定要求を構成する。
 *
 * @responsibility 既存codecの独立期待値を専用bytesへ欠落なく変換する。
 * @trace ARCH-000011
 * @input 未検証のHost終端intent候補。
 * @returns 私有要求参照、またはnull。
 * @precondition 呼出し側が期待値の由来を別に確認する。現在値を推測補完しない。
 * @postcondition 任意Pathや処置Authorityを含む要求を作らない。
 * @effect Process内の相関nonce生成とWeakMap登録だけ。
 * @failure intent形状、Identity、名前、Hashまたは要求上限不正はnull。
 * @invariant nonceは相関用でありRoot nonceやRecovery IDではない。
 * @boundary 内部intent codec→Native専用要求。
 * @security 元Token、SID、marker本文と自由Pathを含めない。
 * @concurrency 不変値へ固定し、bytesを利用側へ直接公開しない。
 */
export function createHostTerminalObservationRequest(
  value: unknown,
): HostTerminalObservationRequest | null {
  try {
    const intent = encodeHostTerminalIntent(value).intent;
    return createHostTerminalTargetObservationRequest({
      rootName: intent.target.root.name,
      markerName: intent.target.marker.name,
      namespace: [
        intent.target.parentIdentity,
        intent.target.recoveryDirectoryIdentity,
        intent.target.terminalDirectoryIdentity,
      ],
      selectedUserSha256: intent.bindings.selectedUserSha256,
    });
  } catch {
    return null;
  }
}

/**
 * 完全intentを必要とせず、独立した保存境界から対象確認要求を構成する。
 *
 * @responsibility 初回対象確認と、確認後の終端intent作成の循環を分離する。
 * @trace ARCH-000011
 * @input rootName、markerName、三namespace Identity、selectedUserSha256の閉じた値。
 * @returns 不変の私有要求参照、またはnull。
 * @precondition namespaceと利用者は呼出し側が別に取得・保持した期待値。由来は上位Ownerが確認する。
 * @postcondition 六u32、型・相異、固定名、利用者を欠落なく専用frameへ結合する。
 * @effect Process内の相関nonce生成、所有copyとWeakMap登録だけ。
 * @failure 欠落・未知field、Accessor／Proxy、名前・Identity・利用者の不正はnull。
 * @invariant 対象Root／marker／childの未取得Identityを捏造せず、完全intentやAuthorityを生成しない。
 * @boundary 初回保存境界の期待値→Native対象確認要求。
 * @security 自由Path、元Token、SID、marker本文、削除許可を受け付けない。
 * @concurrency 同期snapshotへ固定し、呼出し側の後続変更を反映しない。
 */
export function createHostTerminalTargetObservationRequest(
  value: unknown,
): HostTerminalObservationRequest | null {
  return createTerminalTargetObservationRequest(value, "eleven");
}

/**
 * 十二実体のnamespace-Known要求を旧受付と分離して構成する。
 *
 * @responsibility 独立三namespaceと利用者だけを専用frameへ結合する。
 * @trace ARCH-000011
 * @input 固定Root／marker名、三namespace Identityと利用者Hash。
 * @returns 専用私有要求、またはnull。
 * @precondition 期待値の由来は上位Ownerが別に確認する。
 * @postcondition 全十二対象Knownを捏造せず旧要求登録へ渡さない。
 * @effect nonce生成、memory copyと専用WeakMap登録だけ。
 * @failure 形状、名前、実体、利用者不正はnull。
 * @invariant 要求構築から非使用やAuthorityを発行しない。
 * @boundary 回復準備Owner→専用Native要求。
 * @security 自由Path、本文、SID、削除許可を受理しない。
 * @concurrency 同期copyに固定する。
 */
export function createKnownFileHostTerminalTargetObservationRequest(
  value: unknown,
): KnownFileHostTerminalObservationRequest | null {
  return createTerminalTargetObservationRequest(value, "known_file");
}

/**
 * 閉じた二クラスのnamespace要求検査だけを共通化する。
 *
 * @responsibility 名前・三実体・利用者の同じ受付条件とクラス固有登録を維持する。
 * @trace ARCH-000011
 * @input 未検証値と内部二クラス。
 * @returns クラスへ私有登録した要求、またはnull。
 * @precondition 内部の旧／新factoryだけが呼ぶ。
 * @postcondition クラスごとのmagic・revision・WeakMapを固定する。
 * @effect nonce生成と所有memoryだけ。
 * @failure 検証不能、不正値または上限差はnull。
 * @invariant 新旧要求を暗黙に変換しない。
 * @boundary private factory共通処理。
 * @security 外部指定のmagic／revisionを受理しない。
 * @concurrency 不変copyへ固定する。
 */
function createTerminalTargetObservationRequest(
  value: unknown,
  observationClass: "eleven" | "known_file",
): HostTerminalObservationRequest | null {
  try {
    const input = snapshotPlainRecord(
      value,
      new Set([
        "rootName",
        "markerName",
        "namespace",
        "selectedUserSha256",
      ] as const),
    );
    if (
      !input ||
      typeof input.rootName !== "string" ||
      !/^crdd-coordinator-doctor-[A-Za-z0-9_-]{1,96}$/u.test(input.rootName) ||
      typeof input.markerName !== "string" ||
      !/^host-[a-f0-9]{64}\.json$/u.test(input.markerName) ||
      typeof input.selectedUserSha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(input.selectedUserSha256) ||
      /^0{64}$/u.test(input.selectedUserSha256)
    )
      return null;
    const array = snapshotPlainArray(input.namespace, 3);
    if (array.status !== "ok" || array.value.length !== 3) return null;
    const namespaceIdentities: HostTerminalWindowsIdentity[] = [];
    for (const candidate of array.value) {
      const fields = snapshotPlainRecord(candidate, new Set(identityKeys));
      if (!fields) return null;
      for (const key of identityKeys) {
        const number = fields[key];
        if (
          typeof number !== "number" ||
          !Number.isInteger(number) ||
          Object.is(number, -0) ||
          number < 0 ||
          number > 0xffff_ffff
        )
          return null;
      }
      const identity = Object.freeze({
        ...fields,
      }) as HostTerminalWindowsIdentity;
      if (
        (identity.attributes & 0x10) === 0 ||
        (identity.attributes & 0x400) !== 0 ||
        namespaceIdentities.some(
          (previous) =>
            previous.volumeSerial === identity.volumeSerial &&
            previous.fileIndexHigh === identity.fileIndexHigh &&
            previous.fileIndexLow === identity.fileIndexLow,
        )
      )
        return null;
      namespaceIdentities.push(identity);
    }
    const root = Buffer.from(input.rootName, "ascii");
    const marker = Buffer.from(input.markerName, "ascii");
    const nonce = randomBytes(32);
    const bytes = Buffer.alloc(148 + root.length + marker.length);
    if (bytes.length > 342 || nonce.equals(Buffer.alloc(32))) return null;
    bytes.write(
      observationClass === "eleven" ? "CRDDHT02" : "CRDDKT03",
      0,
      "ascii",
    );
    bytes.writeUInt16LE(observationClass === "eleven" ? 2 : 3, 8);
    nonce.copy(bytes, 10);
    bytes[42] = root.length;
    bytes[43] = marker.length;
    namespaceIdentities.forEach((identity, index) => {
      identityKeys.forEach((key, field) => {
        bytes.writeUInt32LE(identity[key], 44 + index * 24 + field * 4);
      });
    });
    Buffer.from(input.selectedUserSha256, "hex").copy(bytes, 116);
    root.copy(bytes, 148);
    marker.copy(bytes, 148 + root.length);
    const request = Object.freeze({ nonceHex: nonce.toString("hex") });
    (observationClass === "eleven"
      ? requestContexts
      : knownFileRequestContexts
    ).set(
      request,
      Object.freeze({
        bytesBase64: bytes.toString("base64"),
        nonceHex: nonce.toString("hex"),
        rootName: input.rootName,
        markerName: input.markerName,
        selectedUser: input.selectedUserSha256,
        namespace: Object.freeze(namespaceIdentities),
      }),
    );
    return request;
  } catch {
    return null;
  }
}

/**
 * 保存場所の期待値がまだ未知の初回確認要求を構成する。
 *
 * @responsibility 固定Nativeが保護付き現在値を取得する要求をKnown要求から区別する。
 * @trace ARCH-000011
 * @input rootNameとmarkerNameだけを持つ閉じた候補。
 * @returns 不変のCurrent要求参照、またはnull。
 * @precondition 呼出し側は取得結果を過去由来・非使用・処置許可へ昇格しない。
 * @postcondition 名前と相関nonceだけを搬送し、未知Identityや利用者を補完しない。
 * @effect Process内のnonce生成とWeakMap登録のみ。
 * @failure 欠落、未知field、Accessor／Proxy、不正固定名はnull。
 * @invariant 初回Nativeでも二ACLと現在利用者確認は省略しない。
 * @boundary 回復Owner→固定Nativeの初回観測要求。
 * @security 自由Path、作成、保護修復、削除またはAuthorityを指定できない。
 * @concurrency 入力は同期copyへ固定し、要求bytesは私有する。
 */
export function createHostTerminalCurrentObservationRequest(
  value: unknown,
): HostTerminalObservationRequest | null {
  return createTerminalCurrentObservationRequest(value, "eleven");
}

/**
 * 既知file専用のCurrent要求を構成する。
 *
 * @responsibility 期待値を捏造せず専用クラスの固定名だけを渡す。
 * @trace ARCH-000011
 * @input rootNameとmarkerNameだけ。
 * @returns 専用私有要求、またはnull。
 * @precondition 取得結果を過去由来や非使用へ昇格しない。
 * @postcondition 三namespaceと利用者の未知値を保持する。
 * @effect nonce生成と専用登録だけ。
 * @failure 不正名、未知field、getter／Proxyはnull。
 * @invariant Currentは全対象Knownまたは清掃許可ではない。
 * @boundary 回復準備Owner→専用Native要求。
 * @security 自由Path、本文、修復、削除を指定できない。
 * @concurrency 入力を同期copyへ固定する。
 */
export function createKnownFileHostTerminalCurrentObservationRequest(
  value: unknown,
): KnownFileHostTerminalObservationRequest | null {
  return createTerminalCurrentObservationRequest(value, "known_file");
}

/**
 * 二クラスのCurrent要求へ名前と相関値だけを登録する。
 *
 * @responsibility 旧／新magicと私有Contextを分離する。
 * @trace ARCH-000011
 * @input 固定名候補と内部二クラス。
 * @returns 私有要求、またはnull。
 * @precondition 内部専用factoryだけから呼ぶ。
 * @postcondition 期待値はnullのまま、クラスごとに登録する。
 * @effect 所有memoryとnonce生成のみ。
 * @failure 形状・名前不正またはゼロnonceはnull。
 * @invariant 現在値から独立期待値を生成しない。
 * @boundary private Current factory。
 * @security 自由PathやAuthorityを扱わない。
 * @concurrency 同期copyに固定する。
 */
function createTerminalCurrentObservationRequest(
  value: unknown,
  observationClass: "eleven" | "known_file",
): HostTerminalObservationRequest | null {
  const input = snapshotPlainRecord(
    value,
    new Set(["rootName", "markerName"] as const),
  );
  if (
    !input ||
    typeof input.rootName !== "string" ||
    !/^crdd-coordinator-doctor-[A-Za-z0-9_-]{1,96}$/u.test(input.rootName) ||
    typeof input.markerName !== "string" ||
    !/^host-[a-f0-9]{64}\.json$/u.test(input.markerName)
  )
    return null;
  const root = Buffer.from(input.rootName, "ascii");
  const marker = Buffer.from(input.markerName, "ascii");
  const nonce = randomBytes(32);
  if (nonce.equals(Buffer.alloc(32))) return null;
  const bytes = Buffer.alloc(44 + root.length + marker.length);
  bytes.write(
    observationClass === "eleven" ? "CRDDHC01" : "CRDDKC03",
    0,
    "ascii",
  );
  bytes.writeUInt16LE(observationClass === "eleven" ? 1 : 3, 8);
  nonce.copy(bytes, 10);
  bytes[42] = root.length;
  bytes[43] = marker.length;
  root.copy(bytes, 44);
  marker.copy(bytes, 44 + root.length);
  const request = Object.freeze({ nonceHex: nonce.toString("hex") });
  (observationClass === "eleven"
    ? requestContexts
    : knownFileRequestContexts
  ).set(
    request,
    Object.freeze({
      bytesBase64: bytes.toString("base64"),
      nonceHex: request.nonceHex,
      rootName: input.rootName,
      markerName: input.markerName,
      selectedUser: null,
      namespace: null,
    }),
  );
  return request;
}

/**
 * 未検証frameを入力getterなしで所有copyへ固定する。
 *
 * @responsibility byte受付でProxy、共有memory、detachと過大値を拒否する。
 * @trace ARCH-000011
 * @input 未検証のBuffer候補と用途別固定上限。
 * @returns 観測1024／保存2048を上限とする所有Buffer、またはnull。
 * @precondition N/A: 不正値も拒否対象として受け取る。
 * @postcondition 入力のbuffer/length getterやiteratorを実行しない。
 * @effect N/A: Process内memoryのcopyのみ。
 * @failure 型、intrinsic取得、memory状態または長さ不正はnull。
 * @invariant 共有memoryの一時値を固定frameとして採用しない。
 * @boundary Native byte候補→所有解析入力。
 * @security 生Path、marker本文や秘密値を解析・出力しない。
 * @concurrency SharedArrayBufferを拒否し、一回の同期copyを使う。
 */
function copyTerminalFrame(
  value: unknown,
  maximum = MAX_RESPONSE_BYTES,
): Buffer | null {
  try {
    if (
      !Buffer.isBuffer(value) ||
      utilTypes.isProxy(value) ||
      !frameLengthGetter ||
      !frameOffsetGetter ||
      !frameBufferGetter
    )
      return null;
    const length: number = frameLengthGetter.call(value);
    const offset: number = frameOffsetGetter.call(value);
    const buffer: unknown = frameBufferGetter.call(value);
    if (length < 53 || length > maximum || !utilTypes.isArrayBuffer(buffer))
      return null;
    return Buffer.from(new Uint8Array(buffer, offset, length));
  } catch {
    return null;
  }
}

/**
 * 専用応答を相関、全取得数と初回closeへ結合する。
 *
 * @responsibility 未知frameや不正成功を現在観測へ昇格させない。
 * @trace ARCH-000011
 * @input Native stdoutのBuffer候補とこのModuleが構成した要求参照。
 * @returns 閉形式の観測・Native拒否、または搬送不正のnull。
 * @precondition 実child終了と配布実体の前後一致は呼出し側が別に確認する。
 * @postcondition 成功は全close、独立namespace期待値、選択利用者と十一型・相異の一致を要求する。
 * @effect N/A: 所有bytesの解析だけ。
 * @failure 型、上限、余剰、nonce、revision、boolean、相関不変条件の不正はnull。
 * @invariant 観測Ok＋外側close不明では元観測失敗を捏造しない。
 * @boundary Native frame→Coordinator内部値。
 * @security 名前、labelまたは空close列から非使用・削除許可を発行しない。
 * @concurrency 同期copyへ固定し、共有memory・Proxyを拒否する。
 */
export function evaluateHostTerminalObservationResponse(
  value: unknown,
  request: HostTerminalObservationRequest,
): HostTerminalNativeObservation | null {
  return evaluateTerminalObservationResponse(
    value,
    request,
    "eleven",
  ) as HostTerminalNativeObservation | null;
}

/**
 * 専用十二実体応答を新要求・全終了・固定fileへ結合する。
 *
 * @responsibility 392bytesを損失なく解析し、旧応答や偽成功を拒否する。
 * @trace ARCH-000011
 * @input 未検証frameと専用私有要求。
 * @returns 十二実体観測またはNative拒否、不正搬送ならnull。
 * @precondition Process終了・成果物前後一致は実行Ownerが別に確認する。
 * @postcondition 九closeと外側終了、十二相異、file長7／リンク1／固定Hashを要求する。
 * @effect N/A: 所有bytesの純解析。
 * @failure 型、nonce、magic、revision、長さ、値、相関差を拒否する。
 * @invariant namespace_knownを全対象Known、保存、非使用へ昇格しない。
 * @boundary 専用Native frame→内部値。
 * @security 本文・Path・SIDを返さない。
 * @concurrency 非共有memoryの同期copyだけを解析する。
 */
export function evaluateKnownFileHostTerminalObservationResponse(
  value: unknown,
  request: KnownFileHostTerminalObservationRequest,
): KnownFileHostTerminalNativeObservation | null {
  return evaluateTerminalObservationResponse(
    value,
    request,
    "known_file",
  ) as KnownFileHostTerminalNativeObservation | null;
}

/**
 * 二クラスのframe相関と終了列を共通規則で検査する。
 *
 * @responsibility クラス固有の実体数・file位置・payloadを閉集合へ保持する。
 * @trace ARCH-000011
 * @input frame候補、私有要求、内部二クラス。
 * @returns クラス固有観測、またはnull。
 * @precondition 専用evaluatorだけがクラスを指定する。
 * @postcondition 他クラスの要求登録・magic・revisionを拒否する。
 * @effect N/A: memory解析のみ。
 * @failure 不正形状・全field差・close不明の偽成功を拒否する。
 * @invariant 成功で未知の期待値やAuthorityを作らない。
 * @boundary private frame共通解析。
 * @security Proxy、共有memory、余剰bytesを拒否する。
 * @concurrency 同期所有copyに固定する。
 */
function evaluateTerminalObservationResponse(
  value: unknown,
  request: HostTerminalObservationRequest,
  observationClass: "eleven" | "known_file",
):
  | HostTerminalNativeObservation
  | KnownFileHostTerminalNativeObservation
  | null {
  try {
    const context = (
      observationClass === "eleven" ? requestContexts : knownFileRequestContexts
    ).get(request);
    const bytes = copyTerminalFrame(value);
    if (!context || !bytes) return null;
    const expectedNamespaceIdentities = context.namespace;
    if (
      bytes.subarray(0, 8).toString("ascii") !==
        (observationClass === "eleven" ? "CRDDHR02" : "CRDDKR03") ||
      bytes.readUInt16LE(8) !== (observationClass === "eleven" ? 2 : 3) ||
      bytes.subarray(10, 42).toString("hex") !== context.nonceHex
    )
      return null;
    const present = bytes[42];
    const phase = bytes[43];
    const reasonLength = bytes[44];
    const operationLength = bytes[45];
    const rawPosition = bytes[46];
    const targetAcquired = bytes[47];
    const tokensAcquired = bytes[48];
    const directoriesAcquired = bytes[49];
    const tokenCount = bytes[50];
    const directoryCount = bytes[51];
    const targetCount = bytes[52];
    if (
      present === undefined ||
      phase === undefined ||
      reasonLength === undefined ||
      operationLength === undefined ||
      rawPosition === undefined ||
      targetAcquired === undefined ||
      tokensAcquired === undefined ||
      directoriesAcquired === undefined ||
      tokenCount === undefined ||
      directoryCount === undefined ||
      targetCount === undefined ||
      present > 1 ||
      phase > 5 ||
      reasonLength < 1 ||
      reasonLength > 96 ||
      operationLength > 96 ||
      (rawPosition !== 255 &&
        rawPosition > (observationClass === "eleven" ? 10 : 11)) ||
      targetAcquired > (observationClass === "eleven" ? 8 : 9) ||
      tokensAcquired > 2 ||
      directoriesAcquired > 64 ||
      tokenCount !== tokensAcquired ||
      directoryCount !== directoriesAcquired ||
      targetCount !== targetAcquired
    )
      return null;
    const closeOffset = 53 + reasonLength + operationLength;
    const snapshotOffset =
      closeOffset + tokenCount + directoryCount + targetCount;
    if (
      bytes.length !==
      snapshotOffset +
        (present === 1 ? (observationClass === "eleven" ? 328 : 392) : 0)
    )
      return null;
    const reason = bytes.subarray(53, 53 + reasonLength).toString("utf8");
    const operationReason =
      operationLength === 0
        ? null
        : bytes.subarray(53 + reasonLength, closeOffset).toString("utf8");
    if (
      !/^terminal_[a-z0-9_]+$/u.test(reason) ||
      (operationReason !== null &&
        !/^terminal_[a-z0-9_]+$/u.test(operationReason))
    )
      return null;
    const closeBytes = bytes.subarray(closeOffset, snapshotOffset);
    if (closeBytes.some((byte) => byte > 1)) return null;
    const tokenCloses = Object.freeze(
      Array.from(closeBytes.subarray(0, tokenCount), (byte) => byte === 1),
    );
    const directoryCloses = Object.freeze(
      Array.from(
        closeBytes.subarray(tokenCount, tokenCount + directoryCount),
        (byte) => byte === 1,
      ),
    );
    const targetCloses = Object.freeze(
      Array.from(
        closeBytes.subarray(tokenCount + directoryCount),
        (byte) => byte === 1,
      ),
    );
    const position = rawPosition === 255 ? null : rawPosition;
    let snapshot:
      | HostTerminalNativeObservation["snapshot"]
      | KnownFileHostTerminalNativeObservation["snapshot"] = null;
    if (present === 1) {
      if (
        phase !== 0 ||
        reason !== "terminal_target_observed" ||
        operationReason !== null ||
        position !== null ||
        tokensAcquired !== 2 ||
        directoriesAcquired < 4 ||
        targetAcquired !== (observationClass === "eleven" ? 8 : 9) ||
        closeBytes.some((byte) => byte !== 1)
      )
        return null;
      const identities = Object.freeze(
        Array.from(
          { length: observationClass === "eleven" ? 11 : 12 },
          (_entry, index) =>
            Object.freeze(
              Object.fromEntries(
                identityKeys.map((key, field) => [
                  key,
                  bytes.readUInt32LE(snapshotOffset + index * 24 + field * 4),
                ]),
              ),
            ) as HostTerminalWindowsIdentity,
        ),
      );
      if (
        identities.some(
          (identity, index) =>
            (identity.attributes & 0x400) !== 0 ||
            ((identity.attributes & 0x10) !== 0) !==
              (index !== 4 &&
                (observationClass === "eleven" || index !== 11)) ||
            identities
              .slice(0, index)
              .some(
                (other) =>
                  identity.volumeSerial === other.volumeSerial &&
                  identity.fileIndexHigh === other.fileIndexHigh &&
                  identity.fileIndexLow === other.fileIndexLow,
              ) ||
            (expectedNamespaceIdentities !== null &&
              index < 3 &&
              identityKeys.some(
                (key) =>
                  identity[key] !== expectedNamespaceIdentities[index]?.[key],
              )),
        )
      )
        return null;
      const identityBytes = observationClass === "eleven" ? 264 : 288;
      const selectedUserSha256 = bytes
        .subarray(
          snapshotOffset + identityBytes,
          snapshotOffset + identityBytes + 32,
        )
        .toString("hex");
      if (
        /^0{64}$/u.test(selectedUserSha256) ||
        (context.selectedUser !== null &&
          selectedUserSha256 !== context.selectedUser)
      )
        return null;
      const markerSha256 = bytes
        .subarray(
          snapshotOffset + identityBytes + 32,
          snapshotOffset + identityBytes + 64,
        )
        .toString("hex");
      if (
        observationClass === "known_file" &&
        (/^0{64}$/u.test(markerSha256) ||
          bytes.readUInt32LE(snapshotOffset + 352) !== 7 ||
          bytes.readUInt32LE(snapshotOffset + 356) !== 1 ||
          bytes.subarray(snapshotOffset + 360).toString("hex") !==
            KNOWN_FIXTURE_SHA256)
      )
        return null;
      snapshot = Object.freeze({
        identities,
        selectedUserSha256,
        markerSha256,
        ...(observationClass === "known_file"
          ? {
              knownFile: Object.freeze({
                byteLength: 7 as const,
                linkCount: 1 as const,
                sha256: KNOWN_FIXTURE_SHA256,
              }),
            }
          : {}),
      });
    } else if (phase === 0 || reason === "terminal_target_observed")
      return null;
    return Object.freeze({
      expectationKind:
        context.namespace === null
          ? "current"
          : observationClass === "eleven"
            ? "known"
            : "namespace_known",
      status: present === 1 ? "observed" : "blocked",
      phase,
      reason,
      operationReason,
      position,
      targetAcquired,
      tokensAcquired,
      directoriesAcquired,
      tokenCloses,
      directoryCloses,
      targetCloses,
      snapshot,
    }) as
      | HostTerminalNativeObservation
      | KnownFileHostTerminalNativeObservation;
  } catch {
    return null;
  }
}

/**
 * 検証した固定Nativeへ確認要求を一回だけ搬送する。
 *
 * @responsibility 署名／開発候補、実child終了、応答相関と前後実体を共同確認する。
 * @trace ARCH-000011
 * @input 私有の対象確認要求または完全intent、署名評価時点、任意の既存開発観測Context。
 * @returns 観測結果、または原因とProcess開始・終了観測を持つ停止結果。
 * @precondition 期待値の独立取得と由来の確認は回復Ownerが所有する。
 * @postcondition 確認だけを行い、保護変更・記録保存・清掃・Runtime Authorityは発行しない。
 * @effect 固定Workerを一回起動し、既存署名検証とread-only OS観測を実行する。
 * @failure 配布／環境／搬送／終了／実体の不明は停止し、timeoutを正常終了にしない。
 * @invariant Generic Platform Adapterのblockedを置換せず、用途限定consumerだけが使う。
 * @boundary Coordinator→固定Native child→Windows確認→内部回復Owner。
 * @security shell、PATH探索、任意実行物、自由Path、削除操作を受け付けない。
 * @concurrency 5秒で同期待機を打ち切る。終了不明では成功や自動再試行を返さない。
 */
export function observeHostTerminalWindowsTarget(
  intent: unknown,
  evaluationTime: unknown,
  developmentContext?: unknown,
) {
  const request =
    intent !== null && typeof intent === "object" && requestContexts.has(intent)
      ? (intent as HostTerminalObservationRequest)
      : createHostTerminalObservationRequest(intent);
  return executeTerminalObservationRequest(
    request,
    evaluationTime,
    developmentContext,
    "eleven",
    requestContexts,
    evaluateHostTerminalObservationResponse,
  );
}

/**
 * 既知file専用要求を検証済みNativeへ一回だけ搬送する。
 *
 * @responsibility 十二実体frame・実終了・前後成果物一致を共同確認する。
 * @trace ARCH-000011
 * @input 専用私有要求、署名評価時点、既存固定開発観測Context。
 * @returns 十二実体の現在観測、または元理由と実行観測を持つ停止。
 * @precondition 期待値の由来と非使用は回復Ownerが別に評価する。
 * @postcondition 旧入口・要求・応答へfileを落として搬送しない。
 * @effect 固定Nativeのread-only Process一回だけ。保存・削除0。
 * @failure 要求、配布、環境、搬送、終了、実体不明は停止しretryしない。
 * @invariant 観測成立から処置Authorityを発行しない。
 * @boundary 専用Coordinator Adapter→固定Native。
 * @security shell、PATH探索、自由Path、任意実行物を受け付けない。
 * @concurrency 固定5秒の同期実行。終了不明を成功にしない。
 */
export function observeKnownFileHostTerminalWindowsTarget(
  request: KnownFileHostTerminalObservationRequest,
  evaluationTime: unknown,
  developmentContext?: unknown,
) {
  return executeTerminalObservationRequest(
    request,
    evaluationTime,
    developmentContext,
    "known_file",
    knownFileRequestContexts,
    evaluateKnownFileHostTerminalObservationResponse,
  );
}

/**
 * 二つの専用観測クラスで同じ固定Worker検証を維持する。
 *
 * @responsibility 私有要求、成果物、実終了、専用decoderを共同確認する。
 * @trace ARCH-000011
 * @input 要求、評価時点、固定Context、内部クラス・登録・decoder。
 * @returns 型ごとの観測または停止。
 * @precondition 内部の旧／新専用入口だけが対応する組を指定する。
 * @postcondition 署名／開発候補と前後実体一致を両クラスで省略しない。
 * @effect 固定Native child一回の同期read-only実行。
 * @failure 実行／終了／相関不明は停止し、自動retryしない。
 * @invariant 観測結果を清掃可能性・Authorityへ変換しない。
 * @boundary private Native搬送Owner。
 * @security クラスは内部閉集合。実行Path・modeは外部指定不可。
 * @concurrency 5秒bounded待機と後続終了確認だけ。取消契約を捏造しない。
 */
function executeTerminalObservationRequest<
  O extends
    | HostTerminalNativeObservation
    | KnownFileHostTerminalNativeObservation,
>(
  request: HostTerminalObservationRequest | null,
  evaluationTime: unknown,
  developmentContext: unknown,
  observationClass: "eleven" | "known_file",
  contexts: typeof requestContexts,
  evaluate: (
    value: unknown,
    request: HostTerminalObservationRequest,
  ) => O | null,
) {
  let processStarted = false;
  let helperExitConfirmed = false;
  /**
   * 未成立の確認処理を停止結果へ固定する。
   *
   * @responsibility 初回Process観測とNative失敗を保持し、清掃許可を発行しない。
   * @trace ARCH-000011
   * @input 固定停止理由と解析済みNative拒否結果。
   * @returns 現在の開始・終了観測を持つ停止結果。
   * @precondition 理由はAdapter自身または閉Native frameの値。
   * @postcondition 不明終了や部分結果を成功へ畳まない。
   * @effect N/A: immutable値の構築のみ。
   * @failure N/A: 停止済み状態の表現であり新しい操作を発行しない。
   * @invariant Filesystem変更・Runtime Authority・清掃許可はfalse。
   * @boundary Native搬送失敗→内部回復Owner。
   * @security 生出力や対象Pathを返さない。
   * @concurrency 同期関数内の現在観測だけを読み取る。
   */
  const stopped = (reason: string, observation: O | null = null) =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      observation,
      processEffectIssued: processStarted,
      helperExitConfirmed,
      filesystemEffectIssued: false,
      runtimeAuthorityIssued: false,
      cleanupAuthorized: false,
    });
  try {
    if (process.platform !== "win32")
      return stopped("host_terminal_platform_unsupported");
    const context = request && contexts.get(request);
    if (!request || !context) return stopped("host_terminal_request_invalid");
    const development =
      developmentContext === undefined
        ? null
        : borrowRuntimeOwnedDevelopmentNativeObservation(
            developmentContext as object,
            false,
          );
    if (developmentContext !== undefined && !development)
      return stopped("host_terminal_development_context_invalid");
    const distributionRoot =
      development?.distributionRoot ?? bundledDistributionRoot;
    const verification =
      development?.verification ??
      verifyBundledCoordinatorPackageFromFixedManifestCandidate({
        evaluationTime,
      });
    if (
      verification.status !== "candidate" ||
      (!development &&
        (!("runtimeOwnedReleaseTrustConfirmed" in verification) ||
          verification.runtimeOwnedReleaseTrustConfirmed !== true ||
          !("runtimeExecutionIdentityRuntimeOwned" in verification) ||
          verification.runtimeExecutionIdentityRuntimeOwned !== true ||
          !("crddDistributionConfirmed" in verification) ||
          verification.crddDistributionConfirmed !== true))
    )
      return stopped("host_terminal_release_not_verified");
    const before =
      observePlatformAccessReleaseArtifactCandidate(distributionRoot);
    const signing =
      beginPlatformAccessArtifactSigningObservation(distributionRoot);
    if (
      before.status !== "candidate" ||
      !signing ||
      JSON.stringify(before.artifact) !==
        JSON.stringify(verification.platformAccessArtifact) ||
      JSON.stringify(before.artifact) !== JSON.stringify(signing.artifact)
    )
      return stopped("host_terminal_artifact_not_verified");
    const environment = createWindowsHostTerminalHelperEnvironment();
    if (!environment) return stopped("host_terminal_environment_unavailable");
    const execution = spawnSync(
      path.join(
        distributionRoot,
        ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
      ),
      [
        observationClass === "eleven"
          ? "--host-terminal-observe"
          : "--host-terminal-known-file-observe",
      ],
      {
        input: Buffer.from(context.bytesBase64, "base64"),
        encoding: "buffer",
        env: environment,
        shell: false,
        windowsHide: true,
        timeout: 5000,
        maxBuffer: MAX_RESPONSE_BYTES + 1,
      },
    );
    processStarted = execution.pid !== undefined;
    helperExitConfirmed =
      execution.error === undefined &&
      execution.signal === null &&
      execution.status !== null;
    if (
      !helperExitConfirmed ||
      !Buffer.isBuffer(execution.stderr) ||
      execution.stderr.length !== 0
    )
      return stopped("host_terminal_worker_transport_unconfirmed");
    if (!verifyPlatformAccessArtifactSigningObservation(signing.token))
      return stopped("host_terminal_artifact_changed");
    const after =
      observePlatformAccessReleaseArtifactCandidate(distributionRoot);
    if (
      after.status !== "candidate" ||
      JSON.stringify(before.artifact) !== JSON.stringify(after.artifact) ||
      (developmentContext !== undefined &&
        !borrowRuntimeOwnedDevelopmentNativeObservation(
          developmentContext as object,
          false,
        ))
    )
      return stopped("host_terminal_artifact_changed");
    const observation = evaluate(execution.stdout, request);
    if (
      !observation ||
      execution.status !== (observation.status === "observed" ? 0 : 2)
    )
      return stopped("host_terminal_response_invalid");
    if (observation.status === "blocked")
      return stopped(observation.reason, observation);
    return Object.freeze({
      status: "observed" as const,
      reason: "host_terminal_target_observed",
      observation,
      processEffectIssued: processStarted,
      helperExitConfirmed,
      artifactVerifiedBeforeAndAfter: true,
      executionSourceKind: development
        ? "fixed_development_candidate"
        : "signed_release",
      filesystemEffectIssued: false,
      runtimeAuthorityIssued: false,
      cleanupAuthorized: false,
    });
  } catch {
    return stopped("host_terminal_observation_failed");
  }
}

/**
 * 初回確認の実観測を保持し、別のNative呼出しで同じ対象を再照合する。
 *
 * @responsibility CurrentとKnownの搬送を接続し、保存前に対象差・終了不明を拒否する。
 * @trace ARCH-000011
 * @input 私有Current要求、評価時点、既存の開発観測Contextと取消Signal。
 * @returns 両観測と共同結果。清掃や非使用の保証は含まない。
 * @precondition 要求はこのModuleが発行したCurrent参照。呼出し側は別に対象の非使用を確認する。
 * @postcondition 二回とも成果物検証と終了確認を満たし、十一実体・利用者・marker Hashが一致した場合だけobserved。
 * @effect 最大二回の固定Native読取り観測。Filesystem変更・記録保存・Authority発行は行わない。
 * @failure 初回拒否で二回目を発行せず、再照合拒否・対象差・終了不明を停止結果として保持する。
 * @invariant 二時点一致を連続保持、過去の所有、空状態、非使用または処置許可へ昇格しない。
 * @boundary 初回要求→既存Windows Adapter二呼出し→回復記録の準備Owner。
 * @security 任意Adapter、実行物、Pathまたは推測したIdentityを受け付けない。
 * @concurrency 各呼出しは既存5秒上限。取消を呼出し前後に確認する。同期Native実行の即時取消は保証しない。
 */
export function observeHostTerminalWindowsCandidate(
  request: HostTerminalObservationRequest,
  evaluationTime: unknown,
  developmentContext?: unknown,
  signal?: AbortSignal,
) {
  return observeTerminalWindowsCandidate(
    request,
    evaluationTime,
    developmentContext,
    signal,
    requestContexts,
    observeHostTerminalWindowsTarget,
    createHostTerminalTargetObservationRequest,
    false,
  );
}

/**
 * 既知fileの十二実体を二時点で照合する。
 *
 * @responsibility 旧観測へfileを落とさず、全実体と固定file条件の変化を拒否する。
 * @trace ARCH-000011
 * @input 専用Current要求、評価時点、固定開発Contextと取消Signal。
 * @returns 両観測、共同結果とProcess終了確認。
 * @precondition 専用WeakMapのCurrent要求だけ。非使用の根拠は別Ownerが保持する。
 * @postcondition 十二Identity、利用者、marker Hashとfile三値が一致した場合だけobserved。
 * @effect 固定Native読取り最大二回。保存・削除・Authority発行0。
 * @failure 偽要求、旧クラス、取消、対象差、下位拒否で停止し両観測を保持する。
 * @invariant 二時点一致を連続保持、非使用、人間承認や処置許可へ昇格しない。
 * @boundary 専用Current→namespace-Known→回復準備Owner。
 * @security 任意Path、実行物、外部callbackと旧新変換を受け付けない。
 * @concurrency 各同期観測前後で取消を確認する。即時取消は保証しない。
 */
export function observeKnownFileHostTerminalWindowsCandidate(
  request: KnownFileHostTerminalObservationRequest,
  evaluationTime: unknown,
  developmentContext?: unknown,
  signal?: AbortSignal,
) {
  return observeTerminalWindowsCandidate(
    request,
    evaluationTime,
    developmentContext,
    signal,
    knownFileRequestContexts,
    observeKnownFileHostTerminalWindowsTarget,
    createKnownFileHostTerminalTargetObservationRequest,
    true,
  );
}

/**
 * 旧新の二時点照合を同じ私有Ownerで評価する。
 *
 * @responsibility クラス別登録と観測を固定し、全field比較・取消・部分結果を共通処置する。
 * @trace ARCH-000011
 * @input 私有要求、評価時点、Context、Signal、固定登録・観測・再要求factory・fileクラス。
 * @returns 型ごとの二観測と共同結果。
 * @precondition 旧新wrapperだけが対応する依存を指定する。
 * @postcondition 初回拒否と初回後取消では再観測せず、差異を保存可能へ変換しない。
 * @effect 指定wrapperの固定Native読取り最大二回。
 * @failure 未登録・Known要求・取消・再要求不正・差異・下位拒否で停止する。
 * @invariant namespace一致だけから全対象一致を発行しない。
 * @boundary private観測Owner内。公開callback契約ではない。
 * @security 読取り結果は処置Authorityを持たない。
 * @concurrency 既存同期上限を保持し、両呼出し前後で取消を確認する。
 */
function observeTerminalWindowsCandidate<
  O extends
    | HostTerminalNativeObservation
    | KnownFileHostTerminalNativeObservation,
>(
  request: HostTerminalObservationRequest,
  evaluationTime: unknown,
  developmentContext: unknown,
  signal: AbortSignal | undefined,
  contexts: typeof requestContexts,
  observe: (
    request: HostTerminalObservationRequest,
    time: unknown,
    context?: unknown,
  ) => Readonly<{
    status: "observed" | "blocked";
    reason: string;
    observation: O | null;
    processEffectIssued: boolean;
    helperExitConfirmed: boolean;
    filesystemEffectIssued: false;
    runtimeAuthorityIssued: false;
    cleanupAuthorized: false;
  }>,
  createKnownRequest: (value: unknown) => HostTerminalObservationRequest | null,
  hasKnownFile: boolean,
) {
  const context = contexts.get(request);
  if (!context || context.namespace !== null || context.selectedUser !== null)
    return Object.freeze({
      status: "blocked" as const,
      reason: "host_terminal_current_request_required",
      currentObservation: null,
      knownObservation: null,
      processEffectIssued: false,
      helperExitConfirmed: false,
      filesystemEffectIssued: false,
      runtimeAuthorityIssued: false,
      cleanupAuthorized: false,
    });
  if (signal?.aborted)
    return Object.freeze({
      status: "blocked" as const,
      reason: "host_terminal_candidate_cancelled",
      currentObservation: null,
      knownObservation: null,
      processEffectIssued: false,
      helperExitConfirmed: true,
      filesystemEffectIssued: false,
      runtimeAuthorityIssued: false,
      cleanupAuthorized: false,
    });
  let current: ReturnType<typeof observe>;
  try {
    current = observe(request, evaluationTime, developmentContext);
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "host_terminal_candidate_observation_unconfirmed",
      currentObservation: null,
      knownObservation: null,
      processEffectIssued: null,
      helperExitConfirmed: false,
      filesystemEffectIssued: false,
      runtimeAuthorityIssued: false,
      cleanupAuthorized: false,
    });
  }
  const snapshot = current.observation?.snapshot;
  if (
    current.status !== "observed" ||
    !snapshot ||
    !current.helperExitConfirmed
  )
    return Object.freeze({
      ...current,
      status: "blocked" as const,
      reason:
        current.status === "observed" && !current.helperExitConfirmed
          ? "host_terminal_candidate_observation_unconfirmed"
          : current.reason,
      currentObservation: current.observation,
      knownObservation: null,
    });
  if (signal?.aborted)
    return Object.freeze({
      ...current,
      status: "blocked" as const,
      reason: "host_terminal_candidate_cancelled",
      currentObservation: current.observation,
      knownObservation: null,
    });
  const knownRequest = createKnownRequest({
    rootName: context.rootName,
    markerName: context.markerName,
    namespace: snapshot.identities.slice(0, 3),
    selectedUserSha256: snapshot.selectedUserSha256,
  });
  if (!knownRequest || signal?.aborted)
    return Object.freeze({
      ...current,
      status: "blocked" as const,
      reason: signal?.aborted
        ? "host_terminal_candidate_cancelled"
        : "host_terminal_reobservation_request_invalid",
      currentObservation: current.observation,
      knownObservation: null,
    });
  let known: ReturnType<typeof observe>;
  try {
    known = observe(knownRequest, evaluationTime, developmentContext);
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "host_terminal_candidate_observation_unconfirmed",
      currentObservation: current.observation,
      knownObservation: null,
      processEffectIssued: null,
      helperExitConfirmed: false,
      filesystemEffectIssued: false,
      runtimeAuthorityIssued: false,
      cleanupAuthorized: false,
    });
  }
  const reobserved = known.observation?.snapshot;
  const isMatched =
    !signal?.aborted &&
    current.helperExitConfirmed &&
    known.helperExitConfirmed &&
    known.status === "observed" &&
    reobserved !== null &&
    reobserved !== undefined &&
    snapshot.selectedUserSha256 === reobserved.selectedUserSha256 &&
    snapshot.markerSha256 === reobserved.markerSha256 &&
    snapshot.identities.length === reobserved.identities.length &&
    snapshot.identities.every((identity, index) =>
      identityKeys.every(
        (key) => identity[key] === reobserved.identities[index]?.[key],
      ),
    ) &&
    (!hasKnownFile ||
      ("knownFile" in snapshot &&
        "knownFile" in reobserved &&
        snapshot.knownFile.byteLength === reobserved.knownFile.byteLength &&
        snapshot.knownFile.linkCount === reobserved.knownFile.linkCount &&
        snapshot.knownFile.sha256 === reobserved.knownFile.sha256));
  return Object.freeze({
    status: isMatched ? ("observed" as const) : ("blocked" as const),
    reason: signal?.aborted
      ? "host_terminal_candidate_cancelled"
      : known.status !== "observed"
        ? known.reason
        : !known.helperExitConfirmed
          ? "host_terminal_candidate_observation_unconfirmed"
          : isMatched
            ? "host_terminal_candidate_reobserved"
            : "host_terminal_candidate_changed",
    currentObservation: current.observation,
    knownObservation: known.observation,
    processEffectIssued:
      current.processEffectIssued || known.processEffectIssued,
    helperExitConfirmed:
      current.helperExitConfirmed && known.helperExitConfirmed,
    filesystemEffectIssued: false,
    runtimeAuthorityIssued: false,
    cleanupAuthorized: false,
  });
}
