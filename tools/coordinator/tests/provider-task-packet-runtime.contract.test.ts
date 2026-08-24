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
  consumeRuntimeOwnedProviderTaskPacket,
  describeProviderTaskPacketRuntimeContract,
  issueRuntimeOwnedProviderTaskPacket,
  revokeRuntimeOwnedProviderTaskPacket,
} from "../src/security/provider-task-packet-runtime.ts";

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
    contentPolicy: "authenticated_local_user_approved",
  };
}

test("Task PacketをOperationへ結合しPromptを一回だけstdin候補へ渡す", () => {
  const current = operation();
  try {
    const issued = issueRuntimeOwnedProviderTaskPacket(
      current.managementCapability,
      "executor",
      packet(),
    );
    assert.equal(issued?.status, "issued");
    assert.match(issued?.taskPacketRef ?? "", /^TASKPKT-[A-F0-9]{32}$/u);
    assert.match(issued?.taskPacketHash ?? "", /^[a-f0-9]{64}$/u);
    assert.equal(issued?.rawPromptReported, false);
    const consumed = consumeRuntimeOwnedProviderTaskPacket(
      issued?.useCapability,
      current.managementCapability,
    );
    assert.equal(consumed?.taskRole, "executor");
    assert.equal(consumed?.promptTransport, "provider_stdin_only");
    assert.match(consumed?.prompt ?? "", /Allowed paths:/u);
    assert.equal(
      consumeRuntimeOwnedProviderTaskPacket(
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
  try {
    const issued = issueRuntimeOwnedProviderTaskPacket(
      current.managementCapability,
      "reviewer",
      packet(),
    );
    assert.equal(
      revokeRuntimeOwnedProviderTaskPacket(
        issued?.controlCapability,
        other.managementCapability,
      ).status,
      "blocked",
    );
    assert.equal(
      revokeRuntimeOwnedProviderTaskPacket(
        issued?.controlCapability,
        current.managementCapability,
      ).status,
      "revoked",
    );
    assert.equal(
      consumeRuntimeOwnedProviderTaskPacket(
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
      issueRuntimeOwnedProviderTaskPacket(
        current.managementCapability,
        "executor",
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

test("Path、内容Policy、上限、重複とRole差をfail closedにする", () => {
  const current = operation();
  try {
    for (const invalid of [
      { ...packet(), allowedPaths: ["../secret"] },
      { ...packet(), allowedPaths: ["src/a.ts", "SRC/A.TS"] },
      { ...packet(), contentPolicy: "public" },
      { ...packet(), acceptanceCriteria: [] },
      { ...packet(), objective: "" },
      { ...packet(), extra: true },
    ]) {
      assert.equal(
        issueRuntimeOwnedProviderTaskPacket(
          current.managementCapability,
          "executor",
          invalid,
        ),
        null,
      );
    }
    assert.equal(
      issueRuntimeOwnedProviderTaskPacket(
        current.managementCapability,
        "coordinator",
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
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.promptTransport, "provider_stdin_only");
  assert.equal(contract.promptInDockerArgvAllowed, false);
  assert.equal(contract.canonicalRepositoryEffectAllowed, false);
  assert.equal(contract.rawPromptReported, false);
});
