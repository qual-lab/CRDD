export const RELEASE_IDENTITY_GRAMMAR_CONTRACT =
  "crdd-coordinator/release-identity-grammar";
export const RELEASE_IDENTITY_GRAMMAR_CONTRACT_REVISION = 1;

const CRDD_GIT_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const CRDD_RUNTIME_GIT_OBJECT_ID = /^[0-9a-f]{40}$/u;
const CRDD_VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]{1,64})?$/u;

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

export function describeReleaseIdentityGrammarContract() {
  return Object.freeze({
    contract: RELEASE_IDENTITY_GRAMMAR_CONTRACT,
    contractRevision: RELEASE_IDENTITY_GRAMMAR_CONTRACT_REVISION,
    gitObjectIdHexLengths: Object.freeze([40, 64]),
    runtimeSupportedGitObjectIdHexLengths: Object.freeze([40]),
    unsupportedRuntimeObjectFormatResult:
      "fail_closed_before_secret_input_or_effect",
    prereleaseVersionAllowed: true,
    callerExtensionAllowed: false,
  });
}
