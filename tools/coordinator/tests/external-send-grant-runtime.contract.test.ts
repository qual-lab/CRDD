import assert from "node:assert/strict";
import test from "node:test";

import {
  compileExternalSendScopeHash,
  confirmInteractiveConsoleChallengeOutcomeUsingAdapter,
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

function resolveDeferredLine(resolver: unknown, line: string | null) {
  assert.equal(typeof resolver, "function");
  (resolver as (resolvedLine: string | null) => void)(line);
}

test("承認失敗は公開値を含まないbounded outcomeへ分類する", async () => {
  for (const status of [
    "cancelled",
    "timeout",
    "reader_failed",
    "cleanup_unknown",
  ] as const) {
    const outcome = await confirmInteractiveConsoleChallengeOutcomeUsingAdapter(
      "safe notice",
      "123456",
      { input: 1, output: 2 },
      new AbortController().signal,
      Object.freeze({
        writeText: async () => true,
        readLine: async () => Object.freeze({ status, line: null }),
      }),
    );
    assert.deepEqual(outcome, { status });
  }
  const declined = await confirmInteractiveConsoleChallengeOutcomeUsingAdapter(
    "safe notice",
    "123456",
    { input: 1, output: 2 },
    new AbortController().signal,
    Object.freeze({
      writeText: async () => true,
      readLine: async () =>
        Object.freeze({ status: "completed" as const, line: "654321" }),
    }),
  );
  assert.deepEqual(declined, { status: "declined_invalid" });

  let writeCount = 0;
  const readFailed =
    await confirmInteractiveConsoleChallengeOutcomeUsingAdapter(
      "safe notice",
      "123456",
      { input: 1, output: 2 },
      new AbortController().signal,
      Object.freeze({
        writeText: async () => {
          writeCount += 1;
          return true;
        },
        readLine: async () => {
          throw new Error("fixture_read_failed");
        },
      }),
    );
  assert.deepEqual(readFailed, { status: "reader_failed" });
  assert.equal(writeCount, 2);

  for (const [line, expected] of [
    ["123456", "unavailable"],
    ["654321", "declined_invalid"],
  ] as const) {
    let writes = 0;
    const newlineFailed =
      await confirmInteractiveConsoleChallengeOutcomeUsingAdapter(
        "safe notice",
        "123456",
        { input: 1, output: 2 },
        new AbortController().signal,
        Object.freeze({
          writeText: async () => {
            writes += 1;
            return writes === 1;
          },
          readLine: async () =>
            Object.freeze({ status: "completed" as const, line }),
        }),
      );
    assert.deepEqual(newlineFailed, { status: expected });
  }
});

function fixture(
  shouldConfirm:
    | boolean
    | Readonly<{
        status:
          | "confirmed"
          | "declined_invalid"
          | "cancelled"
          | "timeout"
          | "unavailable"
          | "reader_failed"
          | "cleanup_unknown";
      }> = true,
  consentStatus?: "confirmed" | "absent" | "cleanup_unknown",
) {
  const managementCapability = Object.freeze({});
  const repositoryBindingCapability = Object.freeze({});
  const policyCapability = Object.freeze({});
  let wall = 1_000_000;
  let monotonic = 10_000;
  let revision = "1".repeat(40);
  const notices: string[] = [];
  let persistedConsents = 0;
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
    ...(consentStatus
      ? {
          resolveConsent: () => Object.freeze({ status: consentStatus }),
          persistConsent: () => {
            persistedConsents += 1;
            return Object.freeze({ status: "confirmed" as const });
          },
        }
      : {}),
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
    persistedConsents: () => persistedConsents,
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
  const controller = new AbortController();
  let readCount = 0;
  const writtenValues: string[] = [];
  let completePrompt: ((isSuccessful: boolean) => void) | null = null;
  let completeNewline: ((isSuccessful: boolean) => void) | null = null;
  const confirmation = confirmInteractiveConsoleChallengeUsingAdapter(
    "確認対象",
    challenge,
    Object.freeze({ input: 11, output: 12 }),
    controller.signal,
    Object.freeze({
      writeText: (_descriptor: number, value: string) => {
        writtenValues.push(value);
        return new Promise<boolean>((resolve) => {
          if (writtenValues.length === 1) completePrompt = resolve;
          else completeNewline = resolve;
        });
      },
      readLine: async () => {
        readCount += 1;
        return challenge;
      },
    }),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(readCount, 0);
  resolveDeferredBoolean(completePrompt, true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(readCount, 1);
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

test("cleanup不明はProcess再起動要求だけをbounded結果へ返す", async () => {
  const current = fixture(Object.freeze({ status: "cleanup_unknown" }));
  const result = await current.runtime.request(
    current.managementCapability,
    current.repositoryBindingCapability,
    current.policyCapability,
    SCOPE,
    ["codex", "claude"],
  );
  assert.deepEqual(result, {
    status: "blocked",
    reason:
      "external_send_confirmation_cleanup_unknown_process_restart_required",
    manualRecoveryRequired: true,
    externalSendAuthorized: false,
    rawContentReported: false,
    hostPathReported: false,
  });
});

test("External Sendの7対話状態はGrant・手動回復・Recovery ID境界へ完全投影する", async () => {
  for (const status of [
    "confirmed",
    "declined_invalid",
    "cancelled",
    "timeout",
    "unavailable",
    "reader_failed",
    "cleanup_unknown",
  ] as const) {
    const current = fixture(Object.freeze({ status }));
    const result = await current.runtime.request(
      current.managementCapability,
      current.repositoryBindingCapability,
      current.policyCapability,
      SCOPE,
      ["codex", "claude"],
    );
    if (status === "confirmed") {
      assert.equal(result?.status, "issued");
      assert.equal(typeof result?.capability, "object");
      continue;
    }
    assert.deepEqual(result, {
      status: "blocked",
      reason:
        status === "cleanup_unknown"
          ? "external_send_confirmation_cleanup_unknown_process_restart_required"
          : `external_send_confirmation_${status}`,
      manualRecoveryRequired: status === "cleanup_unknown",
      externalSendAuthorized: false,
      rawContentReported: false,
      hostPathReported: false,
    });
    assert.equal(Object.hasOwn(result ?? {}, "hostRecoveryId"), false);
  }
});

test("承認表示・入力・最終表示の各失敗をGrant候補へ進めない", async () => {
  const handles = Object.freeze({ input: 11, output: 12 });
  const cancellationSignal = new AbortController().signal;
  let readCount = 0;
  assert.equal(
    await confirmInteractiveConsoleChallengeUsingAdapter(
      "確認対象",
      "123456",
      handles,
      cancellationSignal,
      Object.freeze({
        writeText: async () => false,
        readLine: async () => {
          readCount += 1;
          return "123456";
        },
      }),
    ),
    false,
  );
  assert.equal(readCount, 0);

  for (const scenario of ["cancelled", "newline", "incorrect"] as const) {
    const line =
      scenario === "cancelled"
        ? null
        : scenario === "incorrect"
          ? "654321"
          : "123456";
    let writeCount = 0;
    const isConfirmed = await confirmInteractiveConsoleChallengeUsingAdapter(
      "確認対象",
      "123456",
      handles,
      cancellationSignal,
      Object.freeze({
        writeText: async () => {
          writeCount += 1;
          return scenario !== "newline" || writeCount === 1;
        },
        readLine: async () => line,
      }),
    );
    assert.equal(isConfirmed, false, scenario);
    assert.equal(writeCount, scenario === "cancelled" ? 1 : 2, scenario);
  }
});

test("取消状態を承認表示開始から最終表示完了まで保持する", async () => {
  const handles = Object.freeze({ input: 11, output: 12 });

  {
    const controller = new AbortController();
    controller.abort();
    let writeCount = 0;
    assert.equal(
      await confirmInteractiveConsoleChallengeUsingAdapter(
        "確認対象",
        "123456",
        handles,
        controller.signal,
        Object.freeze({
          writeText: async () => {
            writeCount += 1;
            return true;
          },
          readLine: async () => "123456",
        }),
      ),
      false,
    );
    assert.equal(writeCount, 0);
  }

  {
    const controller = new AbortController();
    let completePrompt: ((isSuccessful: boolean) => void) | null = null;
    let readCount = 0;
    const confirmation = confirmInteractiveConsoleChallengeUsingAdapter(
      "確認対象",
      "123456",
      handles,
      controller.signal,
      Object.freeze({
        writeText: () =>
          new Promise<boolean>((resolve) => {
            completePrompt = resolve;
          }),
        readLine: async () => {
          readCount += 1;
          return "123456";
        },
      }),
    );
    controller.abort();
    resolveDeferredBoolean(completePrompt, true);
    assert.equal(await confirmation, false);
    assert.equal(readCount, 0);
  }

  {
    const controller = new AbortController();
    let completeRead: ((line: string | null) => void) | null = null;
    let writeCount = 0;
    const confirmation = confirmInteractiveConsoleChallengeUsingAdapter(
      "確認対象",
      "123456",
      handles,
      controller.signal,
      Object.freeze({
        writeText: async () => {
          writeCount += 1;
          return true;
        },
        readLine: () =>
          new Promise<string | null>((resolve) => {
            completeRead = resolve;
          }),
      }),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.abort();
    resolveDeferredLine(completeRead, "123456");
    assert.equal(await confirmation, false);
    assert.equal(writeCount, 1);
  }

  {
    const controller = new AbortController();
    let completeNewline: ((isSuccessful: boolean) => void) | null = null;
    let writeCount = 0;
    const confirmation = confirmInteractiveConsoleChallengeUsingAdapter(
      "確認対象",
      "123456",
      handles,
      controller.signal,
      Object.freeze({
        writeText: () => {
          writeCount += 1;
          return writeCount === 1
            ? Promise.resolve(true)
            : new Promise<boolean>((resolve) => {
                completeNewline = resolve;
              });
        },
        readLine: async () => "123456",
      }),
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.abort();
    resolveDeferredBoolean(completeNewline, true);
    assert.equal(await confirmation, false);
    assert.equal(writeCount, 2);
  }
});

test("開始前に取消済みの要求は表示とGrant発行を0にする", async () => {
  const current = fixture();
  const controller = new AbortController();
  controller.abort();
  assert.equal(
    await current.runtime.request(
      current.managementCapability,
      current.repositoryBindingCapability,
      current.policyCapability,
      SCOPE,
      ["codex", "claude"],
      controller.signal,
    ),
    null,
  );
  assert.deepEqual(current.notices, []);

  let wasAccessorExecuted = false;
  const forgedSignal = Object.defineProperty({}, "aborted", {
    get: () => {
      wasAccessorExecuted = true;
      return false;
    },
  });
  assert.equal(
    await current.runtime.request(
      current.managementCapability,
      current.repositoryBindingCapability,
      current.policyCapability,
      SCOPE,
      ["codex", "claude"],
      forgedSignal as AbortSignal,
    ),
    null,
  );
  assert.equal(wasAccessorExecuted, false);
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
  assert.deepEqual(
    await denied.runtime.request(
      denied.managementCapability,
      denied.repositoryBindingCapability,
      denied.policyCapability,
      SCOPE,
      ["claude"],
    ),
    {
      status: "blocked",
      reason: "external_send_confirmation_declined_invalid",
      manualRecoveryRequired: false,
      externalSendAuthorized: false,
      rawContentReported: false,
      hostPathReported: false,
    },
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
  assert.equal(contract.contractRevision, 13);
  assert.equal(
    contract.interactiveConfirmation,
    "first_boundary_only_async_prompt_completion_exact_console_descriptor_fixed_reader_final_output_child_exit_and_console_cleanup",
  );
  assert.equal(
    contract.normalOperationConfirmation,
    "not_required_for_exact_unchanged_runtime_owned_consent_boundary",
  );
  assert.equal(contract.taskStandardInputRole, "structured_transport_only");
  assert.equal(
    contract.readerProcessEffect,
    "operation_authorized_single_use_before_workspace_provider_and_network",
  );
  assert.equal(contract.concurrentReaderExclusion, "windows_kernel_lock");
  assert.equal(
    contract.cleanupUnknownHandling,
    "process_local_poison_restart_required_no_operation_recovery_id",
  );
  assert.equal(
    contract.processPoisonGate,
    "before_external_send_reentry_package_issue_task_consume_and_all_effects",
  );
  assert.equal(
    contract.cleanupUnknownPoisonTiming,
    "before_console_lock_release_await_when_operation_cleanup_is_unknown",
  );
  assert.equal(
    contract.processPoisonReentryResult,
    "bounded_cleanup_unknown_process_restart_required_no_input_or_authority_observation",
  );
  assert.equal(contract.runtimeOwnedConsoleConfirmationPackageExported, false);
  assert.equal(contract.maximumUses, 4);
  assert.equal(contract.lifetimeMs, 1_500_000);
  assert.equal(contract.callerPolicyStringAcceptedAsAuthority, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.additionalPurchaseAllowed, false);
  assert.equal(contract.reviewerMessageTextForwarded, false);
});

test("同じRuntime-owned初期同意境界では対話を繰り返さず短命Operation Grantだけを発行する", async () => {
  const reused = fixture(false, "confirmed");
  const issued = await reused.runtime.request(
    reused.managementCapability,
    reused.repositoryBindingCapability,
    reused.policyCapability,
    SCOPE,
    ["codex", "claude"],
  );
  assert.equal(issued?.status, "issued");
  assert.equal(issued?.authorizationMode, "reused_initial_consent");
  assert.equal(reused.notices.length, 0);
  assert.equal(reused.persistedConsents(), 0);

  const initial = fixture(true, "absent");
  const initiallyIssued = await initial.runtime.request(
    initial.managementCapability,
    initial.repositoryBindingCapability,
    initial.policyCapability,
    SCOPE,
    ["codex", "claude"],
  );
  assert.equal(initiallyIssued?.status, "issued");
  assert.equal(
    initiallyIssued?.authorizationMode,
    "interactive_initial_consent",
  );
  assert.equal(initial.notices.length, 1);
  assert.equal(initial.persistedConsents(), 1);

  const unknown = fixture(true, "cleanup_unknown");
  const blocked = await unknown.runtime.request(
    unknown.managementCapability,
    unknown.repositoryBindingCapability,
    unknown.policyCapability,
    SCOPE,
    ["claude"],
  );
  assert.equal(blocked?.status, "blocked");
  assert.equal(
    blocked?.reason,
    "external_send_consent_cleanup_unknown_process_restart_required",
  );
  assert.equal(blocked?.manualRecoveryRequired, true);
  assert.equal(unknown.notices.length, 0);
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

test("認識済みSecretをTask scopeへ含むGrantは発行しない", async () => {
  const current = fixture();
  const secretScope = {
    objective: `Use token sk-${"A".repeat(24)}.`,
    acceptanceCriteria: ["Keep the change bounded."],
    allowedPaths: ["fixture.txt"],
    readPaths: ["fixture.txt"],
  };
  assert.equal(compileExternalSendScopeHash(secretScope), null);
  assert.equal(
    await current.runtime.request(
      current.managementCapability,
      current.repositoryBindingCapability,
      current.policyCapability,
      secretScope,
      ["claude"],
    ),
    null,
  );
  assert.deepEqual(current.notices, []);
  assert.equal(
    compileExternalSendScopeHash({
      ...secretScope,
      objective: "Update fixture.",
      allowedPaths: [".env"],
    }),
    null,
  );
});
