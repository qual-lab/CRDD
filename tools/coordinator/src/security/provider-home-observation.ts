import { createHash, randomBytes } from "node:crypto";

export const PROVIDER_HOME_OBSERVATION_CONTRACT =
  "crdd-coordinator/provider-home-observation";
export const PROVIDER_HOME_OBSERVATION_CONTRACT_REVISION = 2;
export const PROVIDER_HOME_OBSERVATION_PROTOCOL_REVISION = 2;
export const PROVIDER_HOME_OBSERVATION_REQUEST_BYTES = 76;
export const PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES = 150;

const requestMagic = Buffer.from("CRDDPH01", "ascii");
const responseMagic = Buffer.from("CRDDHO01", "ascii");
const PROVIDERS = Object.freeze({ codex: 1, claude: 2 } as const);
const RESPONSE_STATUS_CANDIDATE = 1;
const OBSERVATION_CANDIDATE_REASON = 100;
const MOUNT_SOURCE_HASH_DOMAIN = Buffer.from(
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

export type ProviderHomeObservationProvider = keyof typeof PROVIDERS;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    provider: null,
    providerHomeIdentityHash: null,
    providerHomeProtectionHash: null,
    localUserBindingHash: null,
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

function providerValue(
  provider: unknown,
): (typeof PROVIDERS)[ProviderHomeObservationProvider] | null {
  return provider === "codex" || provider === "claude"
    ? PROVIDERS[provider]
    : null;
}

function providerName(value: number): ProviderHomeObservationProvider | null {
  if (value === PROVIDERS.codex) return "codex";
  if (value === PROVIDERS.claude) return "claude";
  return null;
}

function nonzeroHash(bytes: Buffer, start: number): string | null {
  const value = bytes.subarray(start, start + 32).toString("hex");
  return /^0{64}$/u.test(value) ? null : value;
}

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
      .update(MOUNT_SOURCE_HASH_DOMAIN)
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
    if (
      !providerHomeIdentityHash ||
      !providerHomeProtectionHash ||
      !localUserBindingHash ||
      providerHomeIdentityHash === providerHomeProtectionHash ||
      providerHomeIdentityHash === localUserBindingHash ||
      providerHomeProtectionHash === localUserBindingHash
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
    selectedUserBinder:
      "native_current_primary_local_interactive_token_sid_authentication_luid_and_flags",
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
