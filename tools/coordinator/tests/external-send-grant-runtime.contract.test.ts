import assert from "node:assert/strict";
import test from "node:test";

import {
  compileExternalSendScopeHash,
  confirmInteractiveConsoleChallengeUsingAdapter,
  createIsolatedExternalSendGrantRuntimeCandidate,
  describeExternalSendGrantRuntimeContract,
} from "../src/security/external-send-grant-runtime.ts";

const SCOPE = Object.freeze({
  objective: "Update only the bounded fixture.",
  acceptanceCriteria: Object.freeze(["The expected value is present."]),
  allowedPaths: Object.freeze(["fixture.txt"]),
  readPaths: Object.freeze(["fixture.txt", "README.md"]),
});

function resolveDeferredBoolean(resolver: unknown, isResolved: boolean) {
  assert.equal(typeof resolver, "function");
  (resolver as (isSuccessful: boolean) => void)(isResolved);
}

function fixture(shouldConfirm = true) {
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
    confirm: async (notice: string, challenge: string) => {
      notices.push(`${notice}\nchallenge=${challenge}`);
      return shouldConfirm;
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

test("承認表示完了後だけchallengeを読み最終表示完了後だけ成功する", async () => {
  const challenge = "123456";
  const inputBytes = [...Buffer.from(`${challenge}\n`, "utf8")];
  const readValues: number[] = [];
  const writtenValues: string[] = [];
  let completePrompt: ((isSuccessful: boolean) => void) | null = null;
  let completeNewline: ((isSuccessful: boolean) => void) | null = null;
  const confirmation = confirmInteractiveConsoleChallengeUsingAdapter(
    "確認対象",
    challenge,
    Object.freeze({ input: 11, output: 12 }),
    Object.freeze({
      writeText: (_descriptor: number, value: string) => {
        writtenValues.push(value);
        return new Promise<boolean>((resolve) => {
          if (writtenValues.length === 1) completePrompt = resolve;
          else completeNewline = resolve;
        });
      },
      readByte: async () => {
        const value = inputBytes.shift() ?? null;
        if (value !== null) readValues.push(value);
        return value;
      },
    }),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(readValues, []);
  resolveDeferredBoolean(completePrompt, true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(readValues, [...Buffer.from(`${challenge}\n`, "utf8")]);
  assert.equal(typeof completeNewline, "function");
  let isConfirmationCompleted = false;
  void confirmation.then(() => {
    isConfirmationCompleted = true;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(isConfirmationCompleted, false);
  resolveDeferredBoolean(completeNewline, true);
  assert.equal(await confirmation, true);
});

test("承認表示・入力・最終表示の各失敗をGrant候補へ進めない", async () => {
  const handles = Object.freeze({ input: 11, output: 12 });
  let readCount = 0;
  assert.equal(
    await confirmInteractiveConsoleChallengeUsingAdapter(
      "確認対象",
      "123456",
      handles,
      Object.freeze({
        writeText: async () => false,
        readByte: async () => {
          readCount += 1;
          return 0x0a;
        },
      }),
    ),
    false,
  );
  assert.equal(readCount, 0);

  for (const scenario of ["cancelled", "newline", "incorrect"] as const) {
    const inputBytes =
      scenario === "cancelled"
        ? []
        : [
            ...Buffer.from(
              `${scenario === "incorrect" ? "654321" : "123456"}\n`,
            ),
          ];
    let writeCount = 0;
    const isConfirmed = await confirmInteractiveConsoleChallengeUsingAdapter(
      "確認対象",
      "123456",
      handles,
      Object.freeze({
        writeText: async () => {
          writeCount += 1;
          return scenario !== "newline" || writeCount === 1;
        },
        readByte: async () => inputBytes.shift() ?? null,
      }),
    );
    assert.equal(isConfirmed, false, scenario);
    assert.equal(writeCount, scenario === "cancelled" ? 1 : 2, scenario);
  }
});

test("Local Userの対話確認をRevision・Scope・Provider・Roleへ結合する", async () => {
  const current = fixture();
  const issued = await current.runtime.request(
    current.managementCapability,
    current.repositoryBindingCapability,
    current.policyCapability,
    SCOPE,
    ["claude", "codex"],
  );
  assert.equal(issued?.status, "issued");
  assert.equal(issued?.scopeHash, compileExternalSendScopeHash(SCOPE));
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
    SCOPE,
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
      SCOPE,
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
      SCOPE,
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
      SCOPE,
    ),
    null,
  );
});

test("拒否・期限切れ・Revision差・Scope差を外部送信Authorityへ昇格しない", async () => {
  const denied = fixture(false);
  assert.equal(
    await denied.runtime.request(
      denied.managementCapability,
      denied.repositoryBindingCapability,
      denied.policyCapability,
      SCOPE,
      ["claude"],
    ),
    null,
  );

  for (const scenario of ["expired", "revision", "scope"] as const) {
    const current = fixture();
    const issued = await current.runtime.request(
      current.managementCapability,
      current.repositoryBindingCapability,
      current.policyCapability,
      SCOPE,
      ["claude"],
    );
    assert.equal(issued?.status, "issued");
    if (scenario === "expired") current.advance(1_500_000);
    if (scenario === "revision") current.replaceRevision();
    const consumeScope =
      scenario === "scope"
        ? { ...SCOPE, objective: "A different objective." }
        : SCOPE;
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
  assert.equal(contract.contractRevision, 4);
  assert.equal(
    contract.interactiveConfirmation,
    "async_prompt_completion_input_final_output_and_console_cleanup",
  );
  assert.equal(contract.maximumUses, 4);
  assert.equal(contract.lifetimeMs, 1_500_000);
  assert.equal(contract.callerPolicyStringAcceptedAsAuthority, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.additionalPurchaseAllowed, false);
  assert.equal(contract.reviewerMessageTextForwarded, false);
});

test("配列境界を含むScope Hashは一意で、承認表示に全送信fieldを安全に含める", async () => {
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
  const issued = await current.runtime.request(
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
