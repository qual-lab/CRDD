import assert from "node:assert/strict";
import test from "node:test";

import {
  compileExternalSendConsentBoundaryHash,
  describeExternalSendConsentRuntimeContract,
} from "../src/security/external-send-consent-runtime.ts";
import type { ExternalSendPolicy } from "../src/security/external-send-policy-runtime.ts";

function policy(overrides: Partial<ExternalSendPolicy> = {}) {
  return Object.freeze({
    schema: "crdd-coordinator/external-send-policy/v2" as const,
    enabled: true,
    policyId: "fixture/local-personal/v1",
    informationClassification: "public" as const,
    decisionAuthority: "authenticated_local_user" as const,
    candidatePersistenceAllowed: true,
    candidateRetentionHours: 24,
    candidatePhysicalDeletion:
      "next_safe_runtime_entry_after_expiry_or_explicit_discard" as const,
    destinations: Object.freeze([]),
    policyHash: "a".repeat(64),
    sourceRevision: "1".repeat(40),
    sourceFileHash: "b".repeat(64),
    ...overrides,
  }) as ExternalSendPolicy;
}

test("初期同意境界はRepository revisionでなくexact Policy byteとPolicy IDへ結合する", () => {
  const first = compileExternalSendConsentBoundaryHash(policy());
  assert.match(first ?? "", /^[a-f0-9]{64}$/u);
  assert.equal(
    compileExternalSendConsentBoundaryHash(
      policy({ sourceRevision: "2".repeat(40) }),
    ),
    first,
  );
  assert.notEqual(
    compileExternalSendConsentBoundaryHash(
      policy({ sourceFileHash: "c".repeat(64) }),
    ),
    first,
  );
  assert.notEqual(
    compileExternalSendConsentBoundaryHash(
      policy({ policyId: "fixture/another-policy/v1" }),
    ),
    first,
  );
  assert.equal(
    compileExternalSendConsentBoundaryHash(
      policy({ sourceFileHash: "not-a-hash" }),
    ),
    null,
  );
});

test("公開契約は選択User・保護Runtime State・Subscription境界と再承認条件を固定する", () => {
  const contract = describeExternalSendConsentRuntimeContract();
  assert.equal(contract.contractRevision, 1);
  assert.match(contract.lifecycle, /first_interactive_confirmation/u);
  assert.ok(contract.binding.includes("selected_local_user"));
  assert.ok(contract.binding.includes("subscription_offering"));
  assert.equal(contract.exactProviderAccountOrTenantIdentityVerified, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.additionalPurchaseAllowed, false);
  assert.equal(contract.callerSuppliedPathAccepted, false);
});
