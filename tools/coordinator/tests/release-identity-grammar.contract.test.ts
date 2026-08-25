import assert from "node:assert/strict";
import test from "node:test";

import {
  describeReleaseIdentityGrammarContract,
  isCanonicalCrddGitObjectId,
  isCanonicalCrddVersion,
} from "../src/security/release-identity-grammar.ts";

test("Release IdentityはSHA-1／SHA-256 Git IDとprereleaseを同じ正本で受理する", () => {
  for (const objectId of ["a".repeat(40), "b".repeat(64)]) {
    assert.equal(isCanonicalCrddGitObjectId(objectId), true);
  }
  for (const version of ["v0.18.0", "v1.2.3-rc.1", "v10.20.30-alpha-2"]) {
    assert.equal(isCanonicalCrddVersion(version), true);
  }
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
  assert.deepEqual(describeReleaseIdentityGrammarContract(), {
    contract: "crdd-coordinator/release-identity-grammar",
    contractRevision: 1,
    gitObjectIdHexLengths: [40, 64],
    prereleaseVersionAllowed: true,
    callerExtensionAllowed: false,
  });
});
