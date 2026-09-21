/**
 * platform-access-adapterに属する責務をまとめる。
 *
 * @responsibility RootRoleを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
const responseMagic = Buffer.from("CRDDPR03", "ascii");
const RESPONSE_BYTES = 86;
const PROTOCOL_REVISION = 3;
const RESPONSE_STATUS_CANDIDATE = 1;
const OBSERVATION_CANDIDATE_REASON = 100;
const KNOWN_ACCESS_MASK = 0x1ff;
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
const KNOWN_PRINCIPAL_MASK = 0xff;
const REQUIRED_SELECTED_USER_PRINCIPAL_MASK =
  PRINCIPAL_FLAGS.primaryToken |
  PRINCIPAL_FLAGS.interactiveGroup |
  PRINCIPAL_FLAGS.nonzeroSession;
const FORBIDDEN_SELECTED_USER_PRINCIPAL_MASK =
  PRINCIPAL_FLAGS.serviceGroup |
  PRINCIPAL_FLAGS.batchGroup |
  PRINCIPAL_FLAGS.networkGroup |
  PRINCIPAL_FLAGS.restrictedToken |
  PRINCIPAL_FLAGS.appContainer;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)?.get;

const ACCESS_FLAGS = Object.freeze({
  readTraverse: 1 << 0,
  addFile: 1 << 1,
  addSubdirectory: 1 << 2,
  writeExtendedAttributes: 1 << 3,
  writeAttributes: 1 << 4,
  deleteChild: 1 << 5,
  deleteOnRootObject: 1 << 6,
  writeDacl: 1 << 7,
  writeOwner: 1 << 8,
});

/**
 * platform-access-adapterで使用するRoot Roleの値契約を定義する。
 *
 * @responsibility Root RoleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RootRoleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RootRoleで宣言した値と責務の対応を維持する。
 * @boundary N/A: RootRoleの宣言は外部境界を開かない。
 * @security RootRoleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RootRoleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RootRole = "runtime" | "authority";

/**
 * platform-access-adapterを停止結果として構築する。
 *
 * @responsibility platform-access-adapterの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000008
 * @input reason: string、isHelperProcessSpawned、isHelperResponseValidated
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string、isHelperProcessSpawned、isHelperResponseValidated」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(
  reason: string,
  isHelperProcessSpawned = false,
  isHelperResponseValidated = false,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    accessObservation: null,
    observedPrincipalSource: null,
    runtimePrincipalMode: null,
    runtimePrincipalIdentityHash: null,
    principalObservation: null,
    selectedUserBindingVerified: false,
    runtimePrincipalBound: false,
    workerSpawnAttempts: 0,
    processEffectIssued: false,
    helperProcessSpawned: isHelperProcessSpawned,
    helperProcessResumed: false,
    helperExchangeCompleted: false,
    processTreeTerminationConfirmed: false,
    manualRecoveryRequired: false,
    helperResponseValidated: isHelperResponseValidated,
    absolutePathReported: false,
    principalReported: false,
    principalIdentityHashReported: false,
    aclReported: false,
    rawErrorReported: false,
    permissionMutationIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}

/**
 * Bufferを所有Snapshotへ変換する。
 *
 * @responsibility Bufferの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedLength: number
 * @returns Buffer | nullを返す。
 * @precondition 「value: unknown、expectedLength: number」がsnapshotBufferの入力契約を満たす。
 * @postcondition snapshotBufferの責務を完了した結果だけを返す。
 * @effect N/A: snapshotBufferは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotBufferは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotBufferは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
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
 * matches Bytesを決定する。
 *
 * @responsibility matches Bytesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input bytes: Buffer、offset: number、expected: Buffer
 * @returns booleanを返す。
 * @precondition 「bytes: Buffer、offset: number、expected: Buffer」がmatchesBytesの入力契約を満たす。
 * @postcondition matchesBytesの責務を完了した結果だけを返す。
 * @effect N/A: matchesBytesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: matchesBytesは独自の失敗分岐を所有しない。
 * @invariant matchesBytesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
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
 * Byteを読み取る。
 *
 * @responsibility Byteの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input bytes: Buffer、offset: number
 * @returns numberを返す。
 * @precondition 「bytes: Buffer、offset: number」がreadByteの入力契約を満たす。
 * @postcondition readByteの責務を完了した結果だけを返す。
 * @effect N/A: readByteは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readByteは独自の失敗分岐を所有しない。
 * @invariant readByteは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security readByteはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readByteは共有非同期状態を持たない同期処理である。
 */
function readByte(bytes: Buffer, offset: number): number {
  return bytes[offset] ?? 0xff;
}

/**
 * U Int16 Little Endianを読み取る。
 *
 * @responsibility U Int16 Little Endianの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input bytes: Buffer、offset: number
 * @returns numberを返す。
 * @precondition 「bytes: Buffer、offset: number」がreadUInt16LittleEndianの入力契約を満たす。
 * @postcondition readUInt16LittleEndianの責務を完了した結果だけを返す。
 * @effect N/A: readUInt16LittleEndianは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readUInt16LittleEndianは独自の失敗分岐を所有しない。
 * @invariant readUInt16LittleEndianは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security readUInt16LittleEndianはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readUInt16LittleEndianは共有非同期状態を持たない同期処理である。
 */
function readUInt16LittleEndian(bytes: Buffer, offset: number): number {
  return readByte(bytes, offset) | (readByte(bytes, offset + 1) << 8);
}

/**
 * U Int32 Little Endianを読み取る。
 *
 * @responsibility U Int32 Little Endianの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input bytes: Buffer、offset: number
 * @returns numberを返す。
 * @precondition 「bytes: Buffer、offset: number」がreadUInt32LittleEndianの入力契約を満たす。
 * @postcondition readUInt32LittleEndianの責務を完了した結果だけを返す。
 * @effect N/A: readUInt32LittleEndianは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readUInt32LittleEndianは独自の失敗分岐を所有しない。
 * @invariant readUInt32LittleEndianは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
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
 * role Valueを決定する。
 *
 * @responsibility role Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input rootRole: RootRole
 * @returns numberを返す。
 * @precondition 「rootRole: RootRole」がroleValueの入力契約を満たす。
 * @postcondition roleValueの責務を完了した結果だけを返す。
 * @effect N/A: roleValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: roleValueは独自の失敗分岐を所有しない。
 * @invariant roleValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security roleValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: roleValueは共有非同期状態を持たない同期処理である。
 */
function roleValue(rootRole: RootRole): number {
  return rootRole === "runtime" ? 1 : 2;
}

/**
 * Platform Access Response 候補を評価する。
 *
 * @responsibility Platform Access Response 候補の評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input rawResponse: unknown、expectedNonce: unknown、rootRole: unknown
 * @returns evaluatePlatformAccessResponseCandidateの計算結果を返す。
 * @precondition 「rawResponse: unknown、expectedNonce: unknown、rootRole: unknown」がevaluatePlatformAccessResponseCandidateの入力契約を満たす。
 * @postcondition evaluatePlatformAccessResponseCandidateの責務を完了した結果だけを返す。
 * @effect N/A: evaluatePlatformAccessResponseCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure evaluatePlatformAccessResponseCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant evaluatePlatformAccessResponseCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security evaluatePlatformAccessResponseCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluatePlatformAccessResponseCandidateは共有非同期状態を持たない同期処理である。
 */
export function evaluatePlatformAccessResponseCandidate(
  rawResponse: unknown,
  expectedNonce: unknown,
  rootRole: unknown,
) {
  try {
    const responseBytes = snapshotBuffer(rawResponse, RESPONSE_BYTES);
    const nonceBytes = snapshotBuffer(expectedNonce, 32);
    if (
      !responseBytes ||
      !nonceBytes ||
      (rootRole !== "runtime" && rootRole !== "authority") ||
      !matchesBytes(responseBytes, 0, responseMagic) ||
      readUInt16LittleEndian(responseBytes, 8) !== PROTOCOL_REVISION ||
      readByte(responseBytes, 10) !== roleValue(rootRole) ||
      readByte(responseBytes, 11) !== RESPONSE_STATUS_CANDIDATE ||
      !matchesBytes(responseBytes, 12, nonceBytes) ||
      readUInt16LittleEndian(responseBytes, 44) !== OBSERVATION_CANDIDATE_REASON
    ) {
      return blocked("platform_access_helper_response_invalid");
    }
    const accessMask = readUInt32LittleEndian(responseBytes, 46);
    if ((accessMask & ~KNOWN_ACCESS_MASK) !== 0) {
      return blocked("platform_access_helper_response_invalid");
    }
    const accessObservation = Object.freeze(
      Object.fromEntries(
        Object.entries(ACCESS_FLAGS).map(([name, flag]) => [
          name,
          (accessMask & flag) !== 0,
        ]),
      ),
    );
    const runtimePrincipalIdentityHash = responseBytes
      .subarray(50, 82)
      .toString("hex");
    if (/^0{64}$/u.test(runtimePrincipalIdentityHash)) {
      return blocked("platform_access_helper_response_invalid");
    }
    const principalMask = readUInt32LittleEndian(responseBytes, 82);
    if (
      (principalMask & ~KNOWN_PRINCIPAL_MASK) !== 0 ||
      (principalMask & REQUIRED_SELECTED_USER_PRINCIPAL_MASK) !==
        REQUIRED_SELECTED_USER_PRINCIPAL_MASK ||
      (principalMask & FORBIDDEN_SELECTED_USER_PRINCIPAL_MASK) !== 0
    ) {
      return blocked("platform_access_helper_response_invalid");
    }
    const principalObservation = Object.freeze(
      Object.fromEntries(
        Object.entries(PRINCIPAL_FLAGS).map(([name, flag]) => [
          name,
          (principalMask & flag) !== 0,
        ]),
      ),
    );
    return Object.freeze({
      status: "candidate" as const,
      reason: "windows_selected_local_user_bound_access_observed_candidate",
      accessObservation,
      observedPrincipalSource:
        "native_supervisor_current_process_token_user" as const,
      runtimePrincipalMode: "local_interactive_selected_user" as const,
      runtimePrincipalIdentityHash,
      principalObservation,
      selectedUserBindingVerified: true,
      runtimePrincipalBound: true,
      workerSpawnAttempts: 0,
      processEffectIssued: false,
      helperProcessSpawned: false,
      helperProcessResumed: false,
      helperExchangeCompleted: false,
      processTreeTerminationConfirmed: false,
      manualRecoveryRequired: false,
      helperResponseValidated: true,
      absolutePathReported: false,
      principalReported: false,
      principalIdentityHashReported: true,
      aclReported: false,
      rawErrorReported: false,
      permissionMutationIssued: false,
      filesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } catch {
    return blocked("platform_access_helper_response_invalid");
  }
}

/**
 * Windows Platform Access 候補を観測する。
 *
 * @responsibility Windows Platform Access 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input rootPath: unknown、rootRole: unknown
 * @returns ReturnType<typeof blocked>を返す。
 * @precondition 「rootPath: unknown、rootRole: unknown」がinspectWindowsPlatformAccessCandidateの入力契約を満たす。
 * @postcondition inspectWindowsPlatformAccessCandidateの責務を完了した結果だけを返す。
 * @effect N/A: inspectWindowsPlatformAccessCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectWindowsPlatformAccessCandidateは独自の失敗分岐を所有しない。
 * @invariant inspectWindowsPlatformAccessCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security inspectWindowsPlatformAccessCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectWindowsPlatformAccessCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectWindowsPlatformAccessCandidate(
  rootPath: unknown,
  rootRole: unknown,
): ReturnType<typeof blocked>;
/**
 * Windows Platform Access 候補を観測する。
 *
 * @responsibility Windows Platform Access 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns ReturnType< typeof blocked >を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がinspectWindowsPlatformAccessCandidateの入力契約を満たす。
 * @postcondition inspectWindowsPlatformAccessCandidateの責務を完了した結果だけを返す。
 * @effect N/A: inspectWindowsPlatformAccessCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectWindowsPlatformAccessCandidateは独自の失敗分岐を所有しない。
 * @invariant inspectWindowsPlatformAccessCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security inspectWindowsPlatformAccessCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectWindowsPlatformAccessCandidateは共有非同期状態を持たない同期処理である。
 */
export function inspectWindowsPlatformAccessCandidate(): ReturnType<
  typeof blocked
> {
  return blocked(
    "platform_access_protected_active_generation_binding_not_implemented",
  );
}

/**
 * Platform Access Adapter 契約の公開契約を記述する。
 *
 * @responsibility Platform Access Adapter 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describePlatformAccessAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribePlatformAccessAdapterContractの入力契約を満たす。
 * @postcondition describePlatformAccessAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describePlatformAccessAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describePlatformAccessAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describePlatformAccessAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describePlatformAccessAdapterContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describePlatformAccessAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describePlatformAccessAdapterContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-access-adapter",
    contractRevision: 3,
    implementationLanguage: "rust",
    rustCrate: "crdd-platform-access",
    rustToolchain: "1.94.1",
    target: "x86_64-pc-windows-msvc",
    wireProtocol: "fixed_bounded_binary_revision_3",
    runtimePrincipalPolicy: "local_interactive_selected_user_only",
    observedPrincipalSource: "native_supervisor_current_process_token_user",
    principalObservation:
      "implemented_signed_supervisor_token_classification_fail_closed_candidate",
    selectedUserBinding:
      "implemented_native_current_process_primary_token_and_login_session_observation",
    runtimePrincipalIdentity:
      "native_current_token_user_sid_domain_separated_sha256",
    serviceAccountMode: "not_implemented_blocked",
    windowsCurrentProcessAccessCore: "implemented_candidate_component_only",
    binaryReleaseIdentityBinding: "implemented_candidate_signed_manifest",
    productionInvocation:
      "signed_exact_artifact_spawn_with_minimal_environment_and_bounded_io",
    maximumWorkerSpawnAttemptsPerInvocation: 1,
    atomicJobAssignment: "implemented_candidate",
    exactRequestResponseBinding: "implemented_candidate",
    shellInvocation: false,
    pathEnvironmentLookup: false,
    cargoRuntimeInvocation: false,
    windowsPermissionMutation: "not_implemented",
    posixAdapter: "not_implemented",
    absolutePathReported: false,
    principalReported: false,
    principalIdentityHashReported: false,
    aclReported: false,
    rawErrorReported: false,
    permissionMutationIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
}
