import assert from "node:assert/strict";
import test from "node:test";

import {
  describeReleaseIdentityGrammarContract,
  isCanonicalCrddGitObjectId,
  isCanonicalCrddUtcTimestamp,
  isCanonicalCrddVersion,
  isSupportedCrddRuntimeGitObjectId,
} from "../../src/security/release-identity-grammar.ts";

test("Release IdentityはSHA-1／SHA-256 Git IDとprereleaseを同じ正本で受理する", () => {
  for (const objectId of ["a".repeat(40), "b".repeat(64)]) {
    assert.equal(isCanonicalCrddGitObjectId(objectId), true);
  }
  assert.equal(isSupportedCrddRuntimeGitObjectId("a".repeat(40)), true);
  assert.equal(isSupportedCrddRuntimeGitObjectId("b".repeat(64)), false);
  for (const version of ["v0.18.0", "v1.2.3-rc.1", "v10.20.30-alpha-2"]) {
    assert.equal(isCanonicalCrddVersion(version), true);
  }
  assert.equal(isCanonicalCrddUtcTimestamp("2026-08-26T02:39:49.000Z"), true);
});

test("Release Identityの長さ・大小文字・suffix境界をFail Closedにする", () => {
  for (const objectId of [
    "a".repeat(39),
    "a".repeat(41),
    "a".repeat(63),
    "a".repeat(65),
    "A".repeat(40),
  ]) {
    assert.equal(isCanonicalCrddGitObjectId(objectId), false);
  }
  for (const version of [
    "0.18.0",
    "v0.18",
    "v0.18.0-",
    `v0.18.0-${"a".repeat(65)}`,
  ]) {
    assert.equal(isCanonicalCrddVersion(version), false);
  }
  for (const timestamp of [
    "2026-08-26T02:39:49Z",
    "2026-08-26T02:39:49.00Z",
    "2026-08-26T02:39:49.000+00:00",
    "2026-02-30T00:00:00.000Z",
  ]) {
    assert.equal(isCanonicalCrddUtcTimestamp(timestamp), false);
  }
  assert.deepEqual(describeReleaseIdentityGrammarContract(), {
    contract: "crdd-coordinator/release-identity-grammar",
    contractRevision: 1,
    gitObjectIdHexLengths: [40, 64],
    runtimeSupportedGitObjectIdHexLengths: [40],
    unsupportedRuntimeObjectFormatResult:
      "fail_closed_before_secret_input_or_effect",
    prereleaseVersionAllowed: true,
    utcTimestampMillisecondsRequired: true,
    callerExtensionAllowed: false,
  });
});
