export const EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX =
  "external-send-consent-active-v2-";
export const EXTERNAL_SEND_CONSENT_SCHEMA =
  "crdd-coordinator/external-send-consent/v2";
export const EXTERNAL_SEND_RUNTIME_SEMANTICS_ID =
  "bounded-reviewer-defect-claim-transfer-v1";
export const EXTERNAL_SEND_CONSENT_LIFETIME_MS = 180 * 24 * 60 * 60 * 1_000;

const HEX64 = /^[a-f0-9]{64}$/u;
const GENERATION = /^[a-f0-9]{16}$/u;
const ACTIVE_ENTRY =
  /^external-send-consent-active-v2-([a-f0-9]{64})-([a-f0-9]{16})\.json(\.crdd-commit\.json)?$/u;
const RECORD_KEYS = Object.freeze([
  "schema",
  "consentBoundaryHash",
  "policyId",
  "sourceFileHash",
  "runtimeExternalSendSemanticsId",
  "informationClassification",
  "providerBoundaries",
  "localUserBindingHash",
  "runtimeStateIdentityHash",
  "runtimeStateProtectionHash",
  "runtimeStateBindingHash",
  "apiKeyFallbackAllowed",
  "additionalPurchaseAllowed",
  "generation",
  "confirmedAtEpochMs",
  "expiresAtEpochMs",
]);

function exactKeys(value: unknown, keys: readonly string[]) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value as Record<string, unknown>)
      .sort()
      .join("\0") === [...keys].sort().join("\0")
  );
}

export function parseExternalSendConsentActiveEntryName(value: unknown) {
  if (typeof value !== "string") return null;
  const match = ACTIVE_ENTRY.exec(value);
  if (!match?.[1] || !match[2]) return null;
  const recordName = `${EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX}${match[1]}-${match[2]}.json`;
  return Object.freeze({
    recordName,
    boundaryHash: match[1],
    generation: match[2],
    entryKind: match[3] ? ("commit" as const) : ("record" as const),
  });
}

export function externalSendConsentActiveRecordName(
  boundaryHash: unknown,
  generation: unknown,
) {
  return typeof boundaryHash === "string" &&
    HEX64.test(boundaryHash) &&
    typeof generation === "string" &&
    GENERATION.test(generation)
    ? `${EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX}${boundaryHash}-${generation}.json`
    : null;
}

export function isExternalSendConsentRecordShape(value: unknown) {
  if (!exactKeys(value, RECORD_KEYS)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.schema === EXTERNAL_SEND_CONSENT_SCHEMA &&
    typeof record.consentBoundaryHash === "string" &&
    HEX64.test(record.consentBoundaryHash) &&
    typeof record.policyId === "string" &&
    record.policyId.length > 0 &&
    typeof record.sourceFileHash === "string" &&
    HEX64.test(record.sourceFileHash) &&
    record.runtimeExternalSendSemanticsId ===
      EXTERNAL_SEND_RUNTIME_SEMANTICS_ID &&
    typeof record.informationClassification === "string" &&
    Array.isArray(record.providerBoundaries) &&
    typeof record.localUserBindingHash === "string" &&
    HEX64.test(record.localUserBindingHash) &&
    typeof record.runtimeStateIdentityHash === "string" &&
    HEX64.test(record.runtimeStateIdentityHash) &&
    typeof record.runtimeStateProtectionHash === "string" &&
    HEX64.test(record.runtimeStateProtectionHash) &&
    typeof record.runtimeStateBindingHash === "string" &&
    HEX64.test(record.runtimeStateBindingHash) &&
    record.apiKeyFallbackAllowed === false &&
    record.additionalPurchaseAllowed === false &&
    typeof record.generation === "string" &&
    GENERATION.test(record.generation) &&
    typeof record.confirmedAtEpochMs === "number" &&
    Number.isSafeInteger(record.confirmedAtEpochMs) &&
    typeof record.expiresAtEpochMs === "number" &&
    Number.isSafeInteger(record.expiresAtEpochMs) &&
    record.expiresAtEpochMs ===
      record.confirmedAtEpochMs + EXTERNAL_SEND_CONSENT_LIFETIME_MS
  );
}
