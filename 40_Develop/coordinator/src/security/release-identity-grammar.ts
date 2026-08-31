export const RELEASE_IDENTITY_GRAMMAR_CONTRACT =
  "crdd-coordinator/release-identity-grammar";
export const RELEASE_IDENTITY_GRAMMAR_CONTRACT_REVISION = 1;

const CRDD_GIT_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const CRDD_RUNTIME_GIT_OBJECT_ID = /^[0-9a-f]{40}$/u;
const CRDD_VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]{1,64})?$/u;
const CRDD_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export function isCanonicalCrddGitObjectId(value: unknown): value is string {
  return typeof value === "string" && CRDD_GIT_OBJECT_ID.test(value);
}

export function isSupportedCrddRuntimeGitObjectId(
  value: unknown,
): value is string {
  return typeof value === "string" && CRDD_RUNTIME_GIT_OBJECT_ID.test(value);
}

export function isCanonicalCrddVersion(value: unknown): value is string {
  return typeof value === "string" && CRDD_VERSION.test(value);
}

export function isCanonicalCrddUtcTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    CRDD_UTC_TIMESTAMP.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value
  );
}

export function describeReleaseIdentityGrammarContract() {
  return Object.freeze({
    contract: RELEASE_IDENTITY_GRAMMAR_CONTRACT,
    contractRevision: RELEASE_IDENTITY_GRAMMAR_CONTRACT_REVISION,
    gitObjectIdHexLengths: Object.freeze([40, 64]),
    runtimeSupportedGitObjectIdHexLengths: Object.freeze([40]),
    unsupportedRuntimeObjectFormatResult:
      "fail_closed_before_secret_input_or_effect",
    prereleaseVersionAllowed: true,
    utcTimestampMillisecondsRequired: true,
    callerExtensionAllowed: false,
  });
}
