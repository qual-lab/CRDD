import { createHash, randomBytes } from "node:crypto";

export const PROVIDER_HOME_OBSERVATION_CONTRACT =
  "crdd-coordinator/provider-home-observation";
export const PROVIDER_HOME_OBSERVATION_CONTRACT_REVISION = 3;
export const PROVIDER_HOME_OBSERVATION_PROTOCOL_REVISION = 3;
export const PROVIDER_HOME_OBSERVATION_REQUEST_BYTES = 76;
export const PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES = 182;

const requestMagic = Buffer.from("CRDDPH02", "ascii");
const responseMagic = Buffer.from("CRDDHO02", "ascii");
const PROVIDERS = Object.freeze({ codex: 1, claude: 2 } as const);
const CANDIDATE_STORE_PROVIDER_VALUE = 3;
const RUNTIME_STATE_PROVIDER_VALUE = 4;
const RESPONSE_STATUS_CANDIDATE = 1;
const OBSERVATION_CANDIDATE_REASON = 100;
const mountSourceHashDomainBytes = Buffer.from(
  "CRDD\0PROVIDER-HOME-MOUNT-SOURCE\0V1\0",
  "ascii",
);
const PRINCIPAL_FLAGS = Object.freeze({
  primaryToken: 1 << 0,
  interactiveGroup: 1 << 1,
  serviceGroup: 1 << 2,
  batchGroup: 1 << 3,
  networkGroup: 1 << 4,
  restrictedToken: 1 << 5,
  appContainer: 1 << 6,
  nonzeroSession: 1 << 7,
});
const REQUIRED_PRINCIPAL_FLAGS =
  PRINCIPAL_FLAGS.primaryToken |
  PRINCIPAL_FLAGS.interactiveGroup |
  PRINCIPAL_FLAGS.nonzeroSession;
const FORBIDDEN_PRINCIPAL_FLAGS =
  PRINCIPAL_FLAGS.serviceGroup |
  PRINCIPAL_FLAGS.batchGroup |
  PRINCIPAL_FLAGS.networkGroup |
  PRINCIPAL_FLAGS.restrictedToken |
  PRINCIPAL_FLAGS.appContainer;
const KNOWN_PRINCIPAL_FLAGS = 0xff;
const HOME_FLAGS = Object.freeze({
  directory: 1 << 0,
  fixedVolume: 1 << 1,
  noReparseChain: 1 << 2,
  stableIdentity: 1 << 3,
  ownerSelectedUser: 1 << 4,
  daclProtected: 1 << 5,
  writersRestricted: 1 << 6,
  selectedUserFullControl: 1 << 7,
  systemFullControl: 1 << 8,
});
const REQUIRED_HOME_FLAGS = 0x1ff;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get;

/**
 * ProviderHomeObservationProviderが扱う値の構造を表す。
 *
 * @responsibility ProviderHomeObservationProviderに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape ProviderHomeObservationProviderが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProviderHomeObservationProviderで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProviderHomeObservationProviderの宣言は外部境界を開かない。
 * @security ProviderHomeObservationProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProviderHomeObservationProviderの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProviderHomeObservationProvider = keyof typeof PROVIDERS;

/**
 * blockedの処理を実行する。
 *
 * @responsibility blockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
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
    status: "blocked" as const,
    reason,
    provider: null,
    providerHomeIdentityHash: null,
    providerHomeProtectionHash: null,
    localUserBindingHash: null,
    stableLogicalHomeBindingHash: null,
    principalObservation: null,
    homeObservation: null,
    selectedUserBindingVerified: false,
    protectionVerified: false,
    stableIdentityObserved: false,
    pathReported: false,
    principalReported: false,
    aclReported: false,
    credentialContentRead: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    mountGrantIssued: false,
  });
}

/**
 * snapshotBufferの処理を実行する。
 *
 * @responsibility snapshotBufferに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input value: unknown、expectedLength: number
 * @returns Buffer | nullを返す。
 * @precondition 「value: unknown、expectedLength: number」がsnapshotBufferの入力契約を満たす。
 * @postcondition snapshotBufferの責務を完了した結果だけを返す。
 * @effect N/A: snapshotBufferは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotBufferは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotBufferは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotBufferはProcess内の同一Subsystemで完結する。
 * @security snapshotBufferはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotBufferは共有非同期状態を持たない同期処理である。
 */
function snapshotBuffer(value: unknown, expectedLength: number): Buffer | null {
  try {
    if (
      !Buffer.isBuffer(value) ||
      typeof TYPED_ARRAY_BYTE_LENGTH !== "function"
    ) {
      return null;
    }
    const length = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, value, []);
    if (length !== expectedLength) return null;
    const owned = Buffer.allocUnsafe(expectedLength);
    Uint8Array.prototype.set.call(owned, value);
    return owned;
  } catch {
    return null;
  }
}

/**
 * readByteの処理を実行する。
 *
 * @responsibility readByteに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input bytes: Buffer、offset: number
 * @returns numberを返す。
 * @precondition 「bytes: Buffer、offset: number」がreadByteの入力契約を満たす。
 * @postcondition readByteの責務を完了した結果だけを返す。
 * @effect N/A: readByteは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readByteは独自の失敗分岐を所有しない。
 * @invariant readByteは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readByteはProcess内の同一Subsystemで完結する。
 * @security readByteはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readByteは共有非同期状態を持たない同期処理である。
 */
function readByte(bytes: Buffer, offset: number): number {
  return bytes[offset] ?? 0xff;
}

/**
 * readUInt16LittleEndianの処理を実行する。
 *
 * @responsibility readUInt16LittleEndianに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input bytes: Buffer、offset: number
 * @returns numberを返す。
 * @precondition 「bytes: Buffer、offset: number」がreadUInt16LittleEndianの入力契約を満たす。
 * @postcondition readUInt16LittleEndianの責務を完了した結果だけを返す。
 * @effect N/A: readUInt16LittleEndianは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readUInt16LittleEndianは独自の失敗分岐を所有しない。
 * @invariant readUInt16LittleEndianは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readUInt16LittleEndianはProcess内の同一Subsystemで完結する。
 * @security readUInt16LittleEndianはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readUInt16LittleEndianは共有非同期状態を持たない同期処理である。
 */
function readUInt16LittleEndian(bytes: Buffer, offset: number): number {
  return readByte(bytes, offset) | (readByte(bytes, offset + 1) << 8);
}

/**
 * readUInt32LittleEndianの処理を実行する。
 *
 * @responsibility readUInt32LittleEndianに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input bytes: Buffer、offset: number
 * @returns numberを返す。
 * @precondition 「bytes: Buffer、offset: number」がreadUInt32LittleEndianの入力契約を満たす。
 * @postcondition readUInt32LittleEndianの責務を完了した結果だけを返す。
 * @effect N/A: readUInt32LittleEndianは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readUInt32LittleEndianは独自の失敗分岐を所有しない。
 * @invariant readUInt32LittleEndianは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readUInt32LittleEndianはProcess内の同一Subsystemで完結する。
 * @security readUInt32LittleEndianはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readUInt32LittleEndianは共有非同期状態を持たない同期処理である。
 */
function readUInt32LittleEndian(bytes: Buffer, offset: number): number {
  return (
    (readByte(bytes, offset) |
      (readByte(bytes, offset + 1) << 8) |
      (readByte(bytes, offset + 2) << 16) |
      (readByte(bytes, offset + 3) << 24)) >>>
    0
  );
}

/**
 * matchesBytesの処理を実行する。
 *
 * @responsibility matchesBytesに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input bytes: Buffer、offset: number、expected: Buffer
 * @returns booleanを返す。
 * @precondition 「bytes: Buffer、offset: number、expected: Buffer」がmatchesBytesの入力契約を満たす。
 * @postcondition matchesBytesの責務を完了した結果だけを返す。
 * @effect N/A: matchesBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: matchesBytesは独自の失敗分岐を所有しない。
 * @invariant matchesBytesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: matchesBytesはProcess内の同一Subsystemで完結する。
 * @security matchesBytesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: matchesBytesは共有非同期状態を持たない同期処理である。
 */
function matchesBytes(
  bytes: Buffer,
  offset: number,
  expected: Buffer,
): boolean {
  for (let index = 0; index < expected.length; index += 1) {
    if (readByte(bytes, offset + index) !== readByte(expected, index)) {
      return false;
    }
  }
  return true;
}

/**
 * providerValueの処理を実行する。
 *
 * @responsibility providerValueに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input provider: unknown
 * @returns (typeof PROVIDERS)[ProviderHomeObservationProvider] | nullを返す。
 * @precondition 「provider: unknown」がproviderValueの入力契約を満たす。
 * @postcondition providerValueの責務を完了した結果だけを返す。
 * @effect N/A: providerValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: providerValueは独自の失敗分岐を所有しない。
 * @invariant providerValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: providerValueはProcess内の同一Subsystemで完結する。
 * @security providerValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: providerValueは共有非同期状態を持たない同期処理である。
 */
function providerValue(
  provider: unknown,
): (typeof PROVIDERS)[ProviderHomeObservationProvider] | null {
  return provider === "codex" || provider === "claude"
    ? PROVIDERS[provider]
    : null;
}

/**
 * providerNameの処理を実行する。
 *
 * @responsibility providerNameに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input value: number
 * @returns ProviderHomeObservationProvider | nullを返す。
 * @precondition 「value: number」がproviderNameの入力契約を満たす。
 * @postcondition providerNameの責務を完了した結果だけを返す。
 * @effect N/A: providerNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: providerNameは独自の失敗分岐を所有しない。
 * @invariant providerNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: providerNameはProcess内の同一Subsystemで完結する。
 * @security providerNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: providerNameは共有非同期状態を持たない同期処理である。
 */
function providerName(value: number): ProviderHomeObservationProvider | null {
  if (value === PROVIDERS.codex) return "codex";
  if (value === PROVIDERS.claude) return "claude";
  return null;
}

/**
 * nonzeroHashの処理を実行する。
 *
 * @responsibility nonzeroHashに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input bytes: Buffer、start: number
 * @returns string | nullを返す。
 * @precondition 「bytes: Buffer、start: number」がnonzeroHashの入力契約を満たす。
 * @postcondition nonzeroHashの責務を完了した結果だけを返す。
 * @effect N/A: nonzeroHashは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nonzeroHashは独自の失敗分岐を所有しない。
 * @invariant nonzeroHashは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nonzeroHashはProcess内の同一Subsystemで完結する。
 * @security nonzeroHashはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: nonzeroHashは共有非同期状態を持たない同期処理である。
 */
function nonzeroHash(bytes: Buffer, start: number): string | null {
  const value = bytes.subarray(start, start + 32).toString("hex");
  return /^0{64}$/u.test(value) ? null : value;
}

/**
 * createProviderHomeObservationRequestの処理を実行する。
 *
 * @responsibility createProviderHomeObservationRequestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input provider: unknown、mountSourcePath: unknown、nonceSource: () => Buffer
 * @returns createProviderHomeObservationRequestの計算結果を返す。
 * @precondition 「provider: unknown、mountSourcePath: unknown、nonceSource: () => Buffer」がcreateProviderHomeObservationRequestの入力契約を満たす。
 * @postcondition createProviderHomeObservationRequestの責務を完了した結果だけを返す。
 * @effect N/A: createProviderHomeObservationRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createProviderHomeObservationRequestは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createProviderHomeObservationRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createProviderHomeObservationRequestはProcess内の同一Subsystemで完結する。
 * @security createProviderHomeObservationRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProviderHomeObservationRequestは共有非同期状態を持たない同期処理である。
 */
export function createProviderHomeObservationRequest(
  provider: unknown,
  mountSourcePath: unknown,
  nonceSource: () => Buffer = () => randomBytes(32),
) {
  try {
    const selectedProvider = providerValue(provider);
    if (
      !selectedProvider ||
      typeof mountSourcePath !== "string" ||
      mountSourcePath.length === 0 ||
      mountSourcePath.length > 32_767 ||
      mountSourcePath.includes("\0")
    ) {
      return null;
    }
    const nonce = snapshotBuffer(nonceSource(), 32);
    if (!nonce) return null;
    const mountSourceHash = createHash("sha256")
      .update(mountSourceHashDomainBytes)
      .update(Buffer.from([selectedProvider]))
      .update(Buffer.from(mountSourcePath, "utf16le"))
      .digest();
    const request = Buffer.alloc(PROVIDER_HOME_OBSERVATION_REQUEST_BYTES);
    requestMagic.copy(request, 0);
    request.writeUInt16LE(PROVIDER_HOME_OBSERVATION_PROTOCOL_REVISION, 8);
    request[10] = selectedProvider;
    nonce.copy(request, 12);
    mountSourceHash.copy(request, 44);
    return Object.freeze({
      provider: provider as ProviderHomeObservationProvider,
      nonce,
      request,
    });
  } catch {
    return null;
  }
}

/**
 * createCandidateStoreObservationRequestの処理を実行する。
 *
 * @responsibility createCandidateStoreObservationRequestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input mountSourcePath: unknown、initializeIfMissing: unknown、nonceSource: () => Buffer
 * @returns createCandidateStoreObservationRequestの計算結果を返す。
 * @precondition 「mountSourcePath: unknown、initializeIfMissing: unknown、nonceSource: () => Buffer」がcreateCandidateStoreObservationRequestの入力契約を満たす。
 * @postcondition createCandidateStoreObservationRequestの責務を完了した結果だけを返す。
 * @effect N/A: createCandidateStoreObservationRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createCandidateStoreObservationRequestは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createCandidateStoreObservationRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createCandidateStoreObservationRequestはProcess内の同一Subsystemで完結する。
 * @security createCandidateStoreObservationRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createCandidateStoreObservationRequestは共有非同期状態を持たない同期処理である。
 */
export function createCandidateStoreObservationRequest(
  mountSourcePath: unknown,
  initializeIfMissing: unknown,
  nonceSource: () => Buffer = () => randomBytes(32),
) {
  try {
    if (
      typeof mountSourcePath !== "string" ||
      mountSourcePath.length === 0 ||
      mountSourcePath.length > 32_767 ||
      mountSourcePath.includes("\0") ||
      typeof initializeIfMissing !== "boolean"
    ) {
      return null;
    }
    const nonce = snapshotBuffer(nonceSource(), 32);
    if (!nonce) return null;
    const mountSourceHash = createHash("sha256")
      .update(mountSourceHashDomainBytes)
      .update(Buffer.from([CANDIDATE_STORE_PROVIDER_VALUE]))
      .update(Buffer.from(mountSourcePath, "utf16le"))
      .digest();
    const request = Buffer.alloc(PROVIDER_HOME_OBSERVATION_REQUEST_BYTES);
    requestMagic.copy(request, 0);
    request.writeUInt16LE(PROVIDER_HOME_OBSERVATION_PROTOCOL_REVISION, 8);
    request[10] = CANDIDATE_STORE_PROVIDER_VALUE;
    request[11] = initializeIfMissing ? 1 : 0;
    nonce.copy(request, 12);
    mountSourceHash.copy(request, 44);
    return Object.freeze({ nonce, request });
  } catch {
    return null;
  }
}

/**
 * createRuntimeStateObservationRequestの処理を実行する。
 *
 * @responsibility createRuntimeStateObservationRequestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input mountSourcePath: unknown、initializeIfMissing: unknown、nonceSource: () => Buffer
 * @returns createRuntimeStateObservationRequestの計算結果を返す。
 * @precondition 「mountSourcePath: unknown、initializeIfMissing: unknown、nonceSource: () => Buffer」がcreateRuntimeStateObservationRequestの入力契約を満たす。
 * @postcondition createRuntimeStateObservationRequestの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeStateObservationRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createRuntimeStateObservationRequestは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createRuntimeStateObservationRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeStateObservationRequestはProcess内の同一Subsystemで完結する。
 * @security createRuntimeStateObservationRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createRuntimeStateObservationRequestは共有非同期状態を持たない同期処理である。
 */
export function createRuntimeStateObservationRequest(
  mountSourcePath: unknown,
  initializeIfMissing: unknown,
  nonceSource: () => Buffer = () => randomBytes(32),
) {
  try {
    if (
      typeof mountSourcePath !== "string" ||
      mountSourcePath.length === 0 ||
      mountSourcePath.length > 32_767 ||
      mountSourcePath.includes("\0") ||
      typeof initializeIfMissing !== "boolean"
    ) {
      return null;
    }
    const nonce = snapshotBuffer(nonceSource(), 32);
    if (!nonce) return null;
    const mountSourceHash = createHash("sha256")
      .update(mountSourceHashDomainBytes)
      .update(Buffer.from([RUNTIME_STATE_PROVIDER_VALUE]))
      .update(Buffer.from(mountSourcePath, "utf16le"))
      .digest();
    const request = Buffer.alloc(PROVIDER_HOME_OBSERVATION_REQUEST_BYTES);
    requestMagic.copy(request, 0);
    request.writeUInt16LE(PROVIDER_HOME_OBSERVATION_PROTOCOL_REVISION, 8);
    request[10] = RUNTIME_STATE_PROVIDER_VALUE;
    request[11] = initializeIfMissing ? 1 : 0;
    nonce.copy(request, 12);
    mountSourceHash.copy(request, 44);
    return Object.freeze({ nonce, request });
  } catch {
    return null;
  }
}

/**
 * evaluateProviderHomeObservationResponseCandidateの処理を実行する。
 *
 * @responsibility evaluateProviderHomeObservationResponseCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input rawResponse: unknown、expectedNonce: unknown、expectedProvider: unknown
 * @returns evaluateProviderHomeObservationResponseCandidateの計算結果を返す。
 * @precondition 「rawResponse: unknown、expectedNonce: unknown、expectedProvider: unknown」がevaluateProviderHomeObservationResponseCandidateの入力契約を満たす。
 * @postcondition evaluateProviderHomeObservationResponseCandidateの責務を完了した結果だけを返す。
 * @effect N/A: evaluateProviderHomeObservationResponseCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure evaluateProviderHomeObservationResponseCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant evaluateProviderHomeObservationResponseCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateProviderHomeObservationResponseCandidateはProcess内の同一Subsystemで完結する。
 * @security evaluateProviderHomeObservationResponseCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateProviderHomeObservationResponseCandidateは共有非同期状態を持たない同期処理である。
 */
export function evaluateProviderHomeObservationResponseCandidate(
  rawResponse: unknown,
  expectedNonce: unknown,
  expectedProvider: unknown,
) {
  try {
    const response = snapshotBuffer(
      rawResponse,
      PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES,
    );
    const nonce = snapshotBuffer(expectedNonce, 32);
    const expectedProviderValue = providerValue(expectedProvider);
    if (
      !response ||
      !nonce ||
      !expectedProviderValue ||
      !matchesBytes(response, 0, responseMagic) ||
      readUInt16LittleEndian(response, 8) !==
        PROVIDER_HOME_OBSERVATION_PROTOCOL_REVISION ||
      readByte(response, 10) !== expectedProviderValue ||
      readByte(response, 11) !== RESPONSE_STATUS_CANDIDATE ||
      !matchesBytes(response, 12, nonce) ||
      readUInt16LittleEndian(response, 44) !== OBSERVATION_CANDIDATE_REASON
    ) {
      return blocked("provider_home_observation_response_invalid");
    }
    const principalFlags = readUInt32LittleEndian(response, 46);
    const homeFlags = readUInt32LittleEndian(response, 50);
    if (
      (principalFlags & ~KNOWN_PRINCIPAL_FLAGS) !== 0 ||
      (principalFlags & REQUIRED_PRINCIPAL_FLAGS) !==
        REQUIRED_PRINCIPAL_FLAGS ||
      (principalFlags & FORBIDDEN_PRINCIPAL_FLAGS) !== 0 ||
      homeFlags !== REQUIRED_HOME_FLAGS
    ) {
      return blocked("provider_home_observation_response_invalid");
    }
    const providerHomeIdentityHash = nonzeroHash(response, 54);
    const providerHomeProtectionHash = nonzeroHash(response, 86);
    const localUserBindingHash = nonzeroHash(response, 118);
    const stableLogicalHomeBindingHash = nonzeroHash(response, 150);
    if (
      !providerHomeIdentityHash ||
      !providerHomeProtectionHash ||
      !localUserBindingHash ||
      !stableLogicalHomeBindingHash ||
      providerHomeIdentityHash === providerHomeProtectionHash ||
      providerHomeIdentityHash === localUserBindingHash ||
      providerHomeProtectionHash === localUserBindingHash ||
      stableLogicalHomeBindingHash === providerHomeIdentityHash ||
      stableLogicalHomeBindingHash === providerHomeProtectionHash ||
      stableLogicalHomeBindingHash === localUserBindingHash
    ) {
      return blocked("provider_home_observation_response_invalid");
    }
    const observedProvider = providerName(readByte(response, 10));
    if (!observedProvider) {
      return blocked("provider_home_observation_response_invalid");
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "runtime_owned_provider_home_observed_candidate",
      provider: observedProvider,
      providerHomeIdentityHash,
      providerHomeProtectionHash,
      localUserBindingHash,
      stableLogicalHomeBindingHash,
      principalObservation: Object.freeze(
        Object.fromEntries(
          Object.entries(PRINCIPAL_FLAGS).map(([name, flag]) => [
            name,
            (principalFlags & flag) !== 0,
          ]),
        ),
      ),
      homeObservation: Object.freeze(
        Object.fromEntries(
          Object.entries(HOME_FLAGS).map(([name, flag]) => [
            name,
            (homeFlags & flag) !== 0,
          ]),
        ),
      ),
      selectedUserBindingVerified: true,
      protectionVerified: true,
      stableIdentityObserved: true,
      pathReported: false,
      principalReported: false,
      aclReported: false,
      credentialContentRead: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
      runtimeAuthorityIssued: false,
      operationCapabilityIssued: false,
      mountGrantIssued: false,
    });
  } catch {
    return blocked("provider_home_observation_response_invalid");
  }
}

/**
 * evaluateCandidateStoreObservationResponseCandidateの処理を実行する。
 *
 * @responsibility evaluateCandidateStoreObservationResponseCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input rawResponse: unknown、expectedNonce: unknown
 * @returns evaluateCandidateStoreObservationResponseCandidateの計算結果を返す。
 * @precondition 「rawResponse: unknown、expectedNonce: unknown」がevaluateCandidateStoreObservationResponseCandidateの入力契約を満たす。
 * @postcondition evaluateCandidateStoreObservationResponseCandidateの責務を完了した結果だけを返す。
 * @effect N/A: evaluateCandidateStoreObservationResponseCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure evaluateCandidateStoreObservationResponseCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant evaluateCandidateStoreObservationResponseCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateCandidateStoreObservationResponseCandidateはProcess内の同一Subsystemで完結する。
 * @security evaluateCandidateStoreObservationResponseCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateCandidateStoreObservationResponseCandidateは共有非同期状態を持たない同期処理である。
 */
export function evaluateCandidateStoreObservationResponseCandidate(
  rawResponse: unknown,
  expectedNonce: unknown,
) {
  try {
    const response = snapshotBuffer(
      rawResponse,
      PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES,
    );
    const nonce = snapshotBuffer(expectedNonce, 32);
    if (
      !response ||
      !nonce ||
      !matchesBytes(response, 0, responseMagic) ||
      readUInt16LittleEndian(response, 8) !==
        PROVIDER_HOME_OBSERVATION_PROTOCOL_REVISION ||
      readByte(response, 10) !== CANDIDATE_STORE_PROVIDER_VALUE ||
      readByte(response, 11) !== RESPONSE_STATUS_CANDIDATE ||
      !matchesBytes(response, 12, nonce) ||
      readUInt16LittleEndian(response, 44) !== OBSERVATION_CANDIDATE_REASON
    ) {
      return blocked("candidate_store_observation_response_invalid");
    }
    const principalFlags = readUInt32LittleEndian(response, 46);
    const homeFlags = readUInt32LittleEndian(response, 50);
    if (
      (principalFlags & ~KNOWN_PRINCIPAL_FLAGS) !== 0 ||
      (principalFlags & REQUIRED_PRINCIPAL_FLAGS) !==
        REQUIRED_PRINCIPAL_FLAGS ||
      (principalFlags & FORBIDDEN_PRINCIPAL_FLAGS) !== 0 ||
      homeFlags !== REQUIRED_HOME_FLAGS
    ) {
      return blocked("candidate_store_observation_response_invalid");
    }
    const candidateStoreIdentityHash = nonzeroHash(response, 54);
    const candidateStoreProtectionHash = nonzeroHash(response, 86);
    const localUserBindingHash = nonzeroHash(response, 118);
    const stableLogicalHomeBindingHash = nonzeroHash(response, 150);
    if (
      !candidateStoreIdentityHash ||
      !candidateStoreProtectionHash ||
      !localUserBindingHash ||
      !stableLogicalHomeBindingHash ||
      candidateStoreIdentityHash === candidateStoreProtectionHash ||
      candidateStoreIdentityHash === localUserBindingHash ||
      candidateStoreProtectionHash === localUserBindingHash
    ) {
      return blocked("candidate_store_observation_response_invalid");
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "runtime_owned_candidate_store_observed_candidate",
      candidateStoreIdentityHash,
      candidateStoreProtectionHash,
      localUserBindingHash,
      stableLogicalHomeBindingHash,
      selectedUserBindingVerified: true,
      protectionVerified: true,
      stableIdentityObserved: true,
      pathReported: false,
      principalReported: false,
      aclReported: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
      runtimeAuthorityIssued: false,
    });
  } catch {
    return blocked("candidate_store_observation_response_invalid");
  }
}

/**
 * evaluateRuntimeStateObservationResponseCandidateの処理を実行する。
 *
 * @responsibility evaluateRuntimeStateObservationResponseCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input rawResponse: unknown、expectedNonce: unknown
 * @returns evaluateRuntimeStateObservationResponseCandidateの計算結果を返す。
 * @precondition 「rawResponse: unknown、expectedNonce: unknown」がevaluateRuntimeStateObservationResponseCandidateの入力契約を満たす。
 * @postcondition evaluateRuntimeStateObservationResponseCandidateの責務を完了した結果だけを返す。
 * @effect N/A: evaluateRuntimeStateObservationResponseCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure evaluateRuntimeStateObservationResponseCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant evaluateRuntimeStateObservationResponseCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateRuntimeStateObservationResponseCandidateはProcess内の同一Subsystemで完結する。
 * @security evaluateRuntimeStateObservationResponseCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateRuntimeStateObservationResponseCandidateは共有非同期状態を持たない同期処理である。
 */
export function evaluateRuntimeStateObservationResponseCandidate(
  rawResponse: unknown,
  expectedNonce: unknown,
) {
  try {
    const response = snapshotBuffer(
      rawResponse,
      PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES,
    );
    const nonce = snapshotBuffer(expectedNonce, 32);
    if (
      !response ||
      !nonce ||
      !matchesBytes(response, 0, responseMagic) ||
      readUInt16LittleEndian(response, 8) !==
        PROVIDER_HOME_OBSERVATION_PROTOCOL_REVISION ||
      readByte(response, 10) !== RUNTIME_STATE_PROVIDER_VALUE ||
      readByte(response, 11) !== RESPONSE_STATUS_CANDIDATE ||
      !matchesBytes(response, 12, nonce) ||
      readUInt16LittleEndian(response, 44) !== OBSERVATION_CANDIDATE_REASON
    ) {
      return blocked("runtime_state_observation_response_invalid");
    }
    const principalFlags = readUInt32LittleEndian(response, 46);
    const homeFlags = readUInt32LittleEndian(response, 50);
    if (
      (principalFlags & ~KNOWN_PRINCIPAL_FLAGS) !== 0 ||
      (principalFlags & REQUIRED_PRINCIPAL_FLAGS) !==
        REQUIRED_PRINCIPAL_FLAGS ||
      (principalFlags & FORBIDDEN_PRINCIPAL_FLAGS) !== 0 ||
      homeFlags !== REQUIRED_HOME_FLAGS
    ) {
      return blocked("runtime_state_observation_response_invalid");
    }
    const runtimeStateIdentityHash = nonzeroHash(response, 54);
    const runtimeStateProtectionHash = nonzeroHash(response, 86);
    const localUserBindingHash = nonzeroHash(response, 118);
    const stableLogicalHomeBindingHash = nonzeroHash(response, 150);
    if (
      !runtimeStateIdentityHash ||
      !runtimeStateProtectionHash ||
      !localUserBindingHash ||
      !stableLogicalHomeBindingHash
    ) {
      return blocked("runtime_state_observation_response_invalid");
    }
    return Object.freeze({
      status: "candidate" as const,
      reason: "runtime_owned_runtime_state_observed_candidate",
      runtimeStateIdentityHash,
      runtimeStateProtectionHash,
      localUserBindingHash,
      stableLogicalHomeBindingHash,
      selectedUserBindingVerified: true,
      protectionVerified: true,
      stableIdentityObserved: true,
      pathReported: false,
      principalReported: false,
      aclReported: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
      runtimeAuthorityIssued: false,
    });
  } catch {
    return blocked("runtime_state_observation_response_invalid");
  }
}

/**
 * describeProviderHomeObservationContractの処理を実行する。
 *
 * @responsibility describeProviderHomeObservationContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderHomeObservationContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderHomeObservationContractの入力契約を満たす。
 * @postcondition describeProviderHomeObservationContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderHomeObservationContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderHomeObservationContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderHomeObservationContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderHomeObservationContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderHomeObservationContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderHomeObservationContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderHomeObservationContract() {
  return Object.freeze({
    contract: PROVIDER_HOME_OBSERVATION_CONTRACT,
    contractRevision: PROVIDER_HOME_OBSERVATION_CONTRACT_REVISION,
    protocolRevision: PROVIDER_HOME_OBSERVATION_PROTOCOL_REVISION,
    providers: Object.freeze(Object.keys(PROVIDERS)),
    requestBytes: PROVIDER_HOME_OBSERVATION_REQUEST_BYTES,
    responseBytes: PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES,
    requestPathField: false,
    requestMountSourceHashField: true,
    requestMountSourceHashAuthority: false,
    requestPrincipalField: false,
    nativeRootSource: "windows_known_folder_local_app_data",
    fixedSegments: Object.freeze(["Qual-Lab", "CRDD", "ProviderHomes"]),
    candidateStoreFixedSegments: Object.freeze([
      "Qual-Lab",
      "CRDD",
      "CandidateStore",
    ]),
    runtimeStateFixedSegments: Object.freeze([
      "Qual-Lab",
      "CRDD",
      "RuntimeState",
    ]),
    selectedUserBinder:
      "native_current_primary_local_interactive_token_sid_authentication_luid_and_flags",
    stableLogicalHomeBinder:
      "native_selected_user_sid_provider_and_fixed_v1_logical_home_namespace_without_session_or_physical_generation",
    protectionObservation:
      "native_stable_fixed_volume_non_reparse_identity_owner_and_exact_protected_dacl",
    rawPathReported: false,
    rawPrincipalReported: false,
    rawAclReported: false,
    credentialContentRead: false,
    callerSuppliedPathAccepted: false,
    callerResponseConfersAuthority: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    mountGrantIssued: false,
  });
}
