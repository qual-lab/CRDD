const responseMagic = Buffer.from("CRDDPR02", "ascii");
const RESPONSE_BYTES = 82;
const PROTOCOL_REVISION = 2;
const RESPONSE_STATUS_CANDIDATE = 1;
const OBSERVATION_CANDIDATE_REASON = 100;
const KNOWN_ACCESS_MASK = 0x1ff;
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

type RootRole = "runtime" | "authority";

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
    helperProcessSpawned: isHelperProcessSpawned,
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

function readByte(bytes: Buffer, offset: number): number {
  return bytes[offset] ?? 0xff;
}

function readUInt16LittleEndian(bytes: Buffer, offset: number): number {
  return readByte(bytes, offset) | (readByte(bytes, offset + 1) << 8);
}

function readUInt32LittleEndian(bytes: Buffer, offset: number): number {
  return (
    (readByte(bytes, offset) |
      (readByte(bytes, offset + 1) << 8) |
      (readByte(bytes, offset + 2) << 16) |
      (readByte(bytes, offset + 3) << 24)) >>>
    0
  );
}

function roleValue(rootRole: RootRole): number {
  return rootRole === "runtime" ? 1 : 2;
}

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
    return Object.freeze({
      status: "candidate" as const,
      reason: "windows_current_process_access_observed_candidate",
      accessObservation,
      observedPrincipalSource: "current_process_token_user" as const,
      runtimePrincipalMode: null,
      runtimePrincipalIdentityHash,
      helperProcessSpawned: false,
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

export function inspectWindowsPlatformAccessCandidate(
  rootPath: unknown,
  rootRole: unknown,
): ReturnType<typeof blocked>;
export function inspectWindowsPlatformAccessCandidate(): ReturnType<
  typeof blocked
> {
  return blocked(
    "platform_access_protected_active_generation_binding_not_implemented",
  );
}

export function describePlatformAccessAdapterContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-access-adapter",
    contractRevision: 1,
    implementationLanguage: "rust",
    rustCrate: "crdd-platform-access",
    rustToolchain: "1.94.1",
    target: "x86_64-pc-windows-msvc",
    wireProtocol: "fixed_bounded_binary_revision_2",
    runtimePrincipalPolicy: "local_interactive_selected_user_only",
    observedPrincipalSource: "current_process_token_user",
    selectedUserBinding: "not_implemented_blocked",
    runtimePrincipalIdentity:
      "native_current_token_user_sid_domain_separated_sha256",
    serviceAccountMode: "not_implemented_blocked",
    windowsCurrentProcessAccessCore: "implemented_candidate_component_only",
    binaryReleaseIdentityBinding: "implemented_candidate_signed_manifest",
    productionInvocation:
      "blocked_until_protected_active_generation_and_verified_image_binding",
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
