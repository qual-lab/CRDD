import assert from "node:assert/strict";
import test from "node:test";

import {
  compileExternalSendScopeHash,
  createIsolatedExternalSendGrantRuntimeCandidate,
  describeExternalSendGrantRuntimeContract,
} from "../src/security/external-send-grant-runtime.ts";

const scope = Object.freeze({
  objective: "Update only the bounded fixture.",
  acceptanceCriteria: Object.freeze(["The expected value is present."]),
  allowedPaths: Object.freeze(["fixture.txt"]),
  readPaths: Object.freeze(["fixture.txt", "README.md"]),
});

function fixture(confirm = true) {
  const managementCapability = Object.freeze({});
  const repositoryBindingCapability = Object.freeze({});
  const policyCapability = Object.freeze({});
  let wall = 1_000_000;
  let monotonic = 10_000;
  let revision = "1".repeat(40);
  const notices: string[] = [];
  const dependencies = {
    verifyOperation: (candidate: unknown) => {
      if (candidate !== managementCapability) throw new Error("bad operation");
      return Object.freeze({ operationId: "OP-EXTERNAL-SEND" });
    },
    verifyRepository: (candidate: unknown, management: unknown) =>
      candidate === repositoryBindingCapability &&
      management === managementCapability
        ? Object.freeze({
            operationId: "OP-EXTERNAL-SEND",
            revision,
          })
        : null,
    verifyPolicy: (candidate: unknown) =>
      candidate === policyCapability
        ? Object.freeze({
            policyId: "fixture/policy/v1",
            policyHash: "a".repeat(64),
            informationClassification: "public",
            decisionAuthority: "authenticated_local_user",
            candidatePersistenceAllowed: true,
            candidateRetentionHours: 24,
            candidatePhysicalDeletion:
              "next_safe_runtime_entry_after_expiry_or_explicit_discard",
            destinations: Object.freeze([
              Object.freeze({
                provider: "codex",
                accountTenantBoundary:
                  "selected_user_dedicated_provider_home_session",
                subscriptionOffering: "chatgpt_subscription_oauth",
                purposeOperations: Object.freeze([
                  "task_execution",
                  "independent_review",
                  "bounded_remediation",
                ]),
                retentionDeletion:
                  "provider_terms_and_settings_apply_runtime_not_verified",
                secondaryUseTraining:
                  "provider_terms_and_settings_apply_runtime_not_verified",
                onwardTransferSubprocessing:
                  "provider_terms_and_settings_apply_runtime_not_verified",
                termsPolicyIdentity:
                  "openai-consumer-terms-current-at-interactive-confirmation",
                boundaryResolution:
                  "interactive_local_user_confirmation_required",
              }),
              Object.freeze({
                provider: "claude",
                accountTenantBoundary:
                  "selected_user_dedicated_provider_home_session",
                subscriptionOffering: "claude_max",
                purposeOperations: Object.freeze([
                  "task_execution",
                  "independent_review",
                  "bounded_remediation",
                ]),
                retentionDeletion:
                  "provider_terms_and_settings_apply_runtime_not_verified",
                secondaryUseTraining:
                  "provider_terms_and_settings_apply_runtime_not_verified",
                onwardTransferSubprocessing:
                  "provider_terms_and_settings_apply_runtime_not_verified",
                termsPolicyIdentity:
                  "anthropic-consumer-terms-current-at-interactive-confirmation",
                boundaryResolution:
                  "interactive_local_user_confirmation_required",
              }),
            ]),
          })
        : null,
    confirm: (notice: string, challenge: string) => {
      notices.push(`${notice}\nchallenge=${challenge}`);
      return confirm;
    },
    wallNow: () => wall,
    monotonicNow: () => monotonic,
    randomChallenge: () => "123456",
  };
  const runtime = createIsolatedExternalSendGrantRuntimeCandidate(
    dependencies as unknown as Parameters<
      typeof createIsolatedExternalSendGrantRuntimeCandidate
    >[0],
  );
  return {
    runtime,
    managementCapability,
    repositoryBindingCapability,
    policyCapability,
    notices,
    advance: (milliseconds: number) => {
      wall += milliseconds;
      monotonic += milliseconds;
    },
    replaceRevision: () => {
      revision = "2".repeat(40);
    },
  };
}

test("Local Userの対話確認をRevision・Scope・Provider・Roleへ結合する", () => {
  const current = fixture();
  const issued = current.runtime.request(
    current.managementCapability,
    current.repositoryBindingCapability,
    current.policyCapability,
    scope,
    ["claude", "codex"],
  );
  assert.equal(issued?.status, "issued");
  assert.equal(issued?.scopeHash, compileExternalSendScopeHash(scope));
  assert.equal(issued?.apiKeyFallbackAllowed, false);
  assert.equal(issued?.additionalPurchaseAllowed, false);
  assert.match(current.notices[0] ?? "", /Subscription枠/u);
  assert.match(current.notices[0] ?? "", /API key fallback/u);

  const executor = current.runtime.consume(
    issued?.capability,
    current.managementCapability,
    current.repositoryBindingCapability,
    "claude",
    "executor",
    0,
    scope,
  );
  assert.equal(executor?.status, "consumed");
  assert.equal(executor?.provider, "claude");
  assert.equal(
    current.runtime.consume(
      issued?.capability,
      current.managementCapability,
      current.repositoryBindingCapability,
      "codex",
      "executor",
      0,
      scope,
    ),
    null,
  );
  assert.equal(
    current.runtime.consume(
      issued?.capability,
      current.managementCapability,
      current.repositoryBindingCapability,
      "codex",
      "reviewer",
      0,
      scope,
    )?.status,
    "consumed",
  );
  assert.equal(
    current.runtime.consume(
      issued?.capability,
      current.managementCapability,
      current.repositoryBindingCapability,
      "claude",
      "reviewer",
      0,
      scope,
    ),
    null,
  );
});

test("拒否・期限切れ・Revision差・Scope差を外部送信Authorityへ昇格しない", () => {
  const denied = fixture(false);
  assert.equal(
    denied.runtime.request(
      denied.managementCapability,
      denied.repositoryBindingCapability,
      denied.policyCapability,
      scope,
      ["claude"],
    ),
    null,
  );

  for (const scenario of ["expired", "revision", "scope"] as const) {
    const current = fixture();
    const issued = current.runtime.request(
      current.managementCapability,
      current.repositoryBindingCapability,
      current.policyCapability,
      scope,
      ["claude"],
    );
    assert.equal(issued?.status, "issued");
    if (scenario === "expired") current.advance(1_500_000);
    if (scenario === "revision") current.replaceRevision();
    const consumeScope =
      scenario === "scope"
        ? { ...scope, objective: "A different objective." }
        : scope;
    assert.equal(
      current.runtime.consume(
        issued?.capability,
        current.managementCapability,
        current.repositoryBindingCapability,
        "claude",
        "executor",
        0,
        consumeScope,
      ),
      null,
    );
  }
});

test("公開契約はcaller文字列ではなく短命の対話Grantを固定する", () => {
  const contract = describeExternalSendGrantRuntimeContract();
  assert.equal(contract.contractRevision, 3);
  assert.equal(contract.maximumUses, 4);
  assert.equal(contract.lifetimeMs, 1_500_000);
  assert.equal(contract.callerPolicyStringAcceptedAsAuthority, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.additionalPurchaseAllowed, false);
  assert.equal(contract.reviewerMessageTextForwarded, false);
});

test("配列境界を含むScope Hashは一意で、承認表示に全送信fieldを安全に含める", () => {
  const left = {
    objective: "Update fixture.\nDo not widen scope.\u202e",
    acceptanceCriteria: ["a"],
    allowedPaths: ["b", "c"],
    readPaths: ["d"],
  };
  const right = {
    objective: left.objective,
    acceptanceCriteria: ["a", "b"],
    allowedPaths: ["c"],
    readPaths: ["d"],
  };
  assert.notEqual(
    compileExternalSendScopeHash(left),
    compileExternalSendScopeHash(right),
  );
  const current = fixture();
  const issued = current.runtime.request(
    current.managementCapability,
    current.repositoryBindingCapability,
    current.policyCapability,
    left,
    ["codex", "claude"],
  );
  assert.equal(issued?.status, "issued");
  const notice = current.notices[0] ?? "";
  assert.match(notice, /acceptanceCriteria/u);
  assert.match(notice, /allowedPaths/u);
  assert.match(notice, /readPaths/u);
  assert.match(notice, /policyHash/u);
  assert.match(notice, /localCandidatePersistence/u);
  assert.match(notice, /chatgpt_subscription_oauth/u);
  assert.match(notice, /claude_max/u);
  assert.match(notice, /subscriptionOfferingPreflight/u);
  assert.match(notice, /messageSha256/u);
  assert.match(notice, /exactProviderAccountOrTenantIdentity/u);
  assert.match(notice, /\\u202e/u);
  assert.doesNotMatch(notice, /\u202e/u);
});
