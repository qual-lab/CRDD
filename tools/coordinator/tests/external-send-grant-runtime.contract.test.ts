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
      scope,
      ["claude"],
    );
    assert.equal(issued?.status, "issued");
    if (scenario === "expired") current.advance(300_000);
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
        consumeScope,
      ),
      null,
    );
  }
});

test("公開契約はcaller文字列ではなく短命の対話Grantを固定する", () => {
  const contract = describeExternalSendGrantRuntimeContract();
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.maximumUses, 2);
  assert.equal(contract.lifetimeMs, 300_000);
  assert.equal(contract.callerPolicyStringAcceptedAsAuthority, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.additionalPurchaseAllowed, false);
});
