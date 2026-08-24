import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
} from "../src/security/execution-environment.ts";
import {
  createIsolatedProviderTaskPacketRuntimeCandidate,
  describeProviderTaskPacketRuntimeContract,
} from "../src/security/provider-task-packet-runtime.ts";
import { compileExternalSendScopeHash } from "../src/security/external-send-grant-runtime.ts";
import { normalizeProviderTaskStructuredResult } from "../src/security/provider-task-structured-result.ts";

function operation() {
  const owned = createOwnedOperationDirectories();
  const contextCapability = createOwnedOperationContextCapability(owned);
  const mountCapability = createOwnedMountCapability(owned);
  const managementCapability = createOwnedOperationManagementCapability(
    contextCapability,
    mountCapability,
  );
  return Object.freeze({ owned, managementCapability });
}

function packet() {
  return {
    objective: "Update the isolated fixture and keep its behavior explicit.",
    acceptanceCriteria: [
      "The requested text is present.",
      "No other file changes.",
    ],
    allowedPaths: ["fixture.txt", "docs/"],
    readPaths: ["fixture.txt", "docs/", "README.md"],
  };
}

function packetRuntime() {
  const repositoryBindingCapability = Object.freeze({});
  const externalSendGrantCapability = Object.freeze({});
  const runtime = createIsolatedProviderTaskPacketRuntimeCandidate(
    (
      capability,
      _management,
      repositoryBinding,
      provider,
      taskRole,
      taskAttempt,
      scope,
    ) =>
      capability === externalSendGrantCapability &&
      repositoryBinding === repositoryBindingCapability &&
      (provider === "codex" || provider === "claude") &&
      (taskRole === "executor" || taskRole === "reviewer") &&
      (taskAttempt === 0 || taskAttempt === 1) &&
      compileExternalSendScopeHash(scope)
        ? Object.freeze({
            status: "consumed" as const,
            operationId: "OP-TEST",
            revision: "1".repeat(40),
            provider,
            taskRole,
            taskAttempt,
            scopeHash: compileExternalSendScopeHash(scope) as string,
            externalSendAuthorized: true as const,
          })
        : null,
  );
  return { runtime, repositoryBindingCapability, externalSendGrantCapability };
}

test("Task PacketをOperationへ結合しPromptを一回だけstdin候補へ渡す", () => {
  const current = operation();
  const isolated = packetRuntime();
  try {
    const issued = isolated.runtime.issue(
      current.managementCapability,
      isolated.repositoryBindingCapability,
      "claude",
      "executor",
      0,
      isolated.externalSendGrantCapability,
      null,
      packet(),
    );
    assert.equal(issued?.status, "issued");
    assert.match(issued?.taskPacketRef ?? "", /^TASKPKT-[A-F0-9]{32}$/u);
    assert.match(issued?.taskPacketHash ?? "", /^[a-f0-9]{64}$/u);
    assert.equal(issued?.rawPromptReported, false);
    const consumed = isolated.runtime.consume(
      issued?.useCapability,
      current.managementCapability,
    );
    assert.equal(consumed?.taskRole, "executor");
    assert.equal(consumed?.promptTransport, "provider_stdin_only");
    assert.match(consumed?.prompt ?? "", /Allowed paths:/u);
    assert.match(consumed?.prompt ?? "", /Readable paths:/u);
    assert.equal(
      isolated.runtime.consume(
        issued?.useCapability,
        current.managementCapability,
      ),
      null,
    );
  } finally {
    cleanupOwnedOperationDirectories(current.owned);
  }
});

test("取消はuse aliasも失効し別Operationや動的入力を拒否する", () => {
  const current = operation();
  const other = operation();
  const isolated = packetRuntime();
  try {
    const issued = isolated.runtime.issue(
      current.managementCapability,
      isolated.repositoryBindingCapability,
      "codex",
      "reviewer",
      0,
      isolated.externalSendGrantCapability,
      null,
      packet(),
    );
    assert.equal(
      isolated.runtime.revoke(
        issued?.controlCapability,
        other.managementCapability,
      ).status,
      "blocked",
    );
    assert.equal(
      isolated.runtime.revoke(
        issued?.controlCapability,
        current.managementCapability,
      ).status,
      "revoked",
    );
    assert.equal(
      isolated.runtime.consume(
        issued?.useCapability,
        current.managementCapability,
      ),
      null,
    );
    let getterExecuted = false;
    const dynamic = packet();
    Object.defineProperty(dynamic, "objective", {
      enumerable: true,
      get() {
        getterExecuted = true;
        return "unsafe";
      },
    });
    assert.equal(
      isolated.runtime.issue(
        current.managementCapability,
        isolated.repositoryBindingCapability,
        "claude",
        "executor",
        0,
        isolated.externalSendGrantCapability,
        null,
        dynamic,
      ),
      null,
    );
    assert.equal(getterExecuted, false);
  } finally {
    cleanupOwnedOperationDirectories(current.owned);
    cleanupOwnedOperationDirectories(other.owned);
  }
});

test("Path、上限、重複、余分fieldとRole差をfail closedにする", () => {
  const current = operation();
  const isolated = packetRuntime();
  try {
    for (const invalid of [
      { ...packet(), allowedPaths: ["../secret"] },
      { ...packet(), allowedPaths: ["src/a.ts", "SRC/A.TS"] },
      { ...packet(), readPaths: ["../secret"] },
      { ...packet(), acceptanceCriteria: [] },
      { ...packet(), objective: "" },
      { ...packet(), extra: true },
    ]) {
      assert.equal(
        isolated.runtime.issue(
          current.managementCapability,
          isolated.repositoryBindingCapability,
          "claude",
          "executor",
          0,
          isolated.externalSendGrantCapability,
          null,
          invalid,
        ),
        null,
      );
    }
    assert.equal(
      isolated.runtime.issue(
        current.managementCapability,
        isolated.repositoryBindingCapability,
        "claude",
        "coordinator",
        0,
        isolated.externalSendGrantCapability,
        null,
        packet(),
      ),
      null,
    );
  } finally {
    cleanupOwnedOperationDirectories(current.owned);
  }
});

test("Reviewerの型付き指摘Capabilityを一回だけRemediation Packetへ変換する", () => {
  const current = operation();
  const isolated = packetRuntime();
  try {
    const reviewed = normalizeProviderTaskStructuredResult(
      "codex",
      "reviewer",
      "low",
      JSON.stringify({
        decision: "changes_requested",
        summary: "A bounded fix is required.",
        findings: [
          {
            severity: "high",
            path: "fixture.txt",
            message: "Restore the required invariant.",
          },
        ],
      }),
    );
    const normalized = reviewed.normalizedResult;
    assert.ok(normalized && "remediationCapability" in normalized);
    const issued = isolated.runtime.issue(
      current.managementCapability,
      isolated.repositoryBindingCapability,
      "claude",
      "executor",
      1,
      isolated.externalSendGrantCapability,
      normalized.remediationCapability,
      packet(),
    );
    const consumed = isolated.runtime.consume(
      issued?.useCapability,
      current.managementCapability,
    );
    assert.match(
      consumed?.prompt ?? "",
      /reviewer message text is not forwarded/u,
    );
    assert.match(consumed?.prompt ?? "", /fixture\.txt/u);
    assert.doesNotMatch(
      consumed?.prompt ?? "",
      /Restore the required invariant/u,
    );
    assert.match(
      consumed?.prompt ?? "",
      /reviewer-message-sha256=[0-9a-f]{64}/u,
    );
    assert.equal(
      isolated.runtime.issue(
        current.managementCapability,
        isolated.repositoryBindingCapability,
        "claude",
        "executor",
        1,
        isolated.externalSendGrantCapability,
        normalized.remediationCapability,
        packet(),
      ),
      null,
    );
  } finally {
    cleanupOwnedOperationDirectories(current.owned);
  }
});

test("公開契約はPrompt非argvとcanonical非変更を固定する", () => {
  const contract = describeProviderTaskPacketRuntimeContract();
  assert.equal(contract.contractRevision, 5);
  assert.equal(contract.promptTransport, "provider_stdin_only");
  assert.equal(contract.promptInDockerArgvAllowed, false);
  assert.equal(contract.canonicalRepositoryEffectAllowed, false);
  assert.equal(contract.rawPromptReported, false);
  assert.equal(
    contract.remediationProjection,
    "path_severity_and_domain_separated_message_hash_without_reviewer_text",
  );
});
