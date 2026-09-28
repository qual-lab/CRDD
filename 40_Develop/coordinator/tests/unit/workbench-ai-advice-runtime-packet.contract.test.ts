/**
 * Workbench助言Runtime Packetの一回消費と非共有境界を検証する。
 *
 * @responsibility 正常発行、再利用拒否、取消および不正Command拒否を決定論的に確認する。
 * @trace PRL-UT-001
 * @input テスト内で構築した固定Identity、PromptおよびProvider Command。
 * @returns Node Test RunnerへAssertion結果を返す。
 * @precondition Provider Process、NetworkおよびFilesystem Effectを使用しない。
 * @postcondition 同じuseCapabilityからPacketを二回取得できない。
 * @effect Process内のテスト対象WeakMapだけを変更する。
 * @failure 契約違反をAssertion Failureとして報告する。
 * @invariant 外部Providerへ送信しない。
 * @boundary Unit TestとPacket Runtimeの公開APIの間。
 * @security PromptまたはCapabilityをTest出力へ表示しない。
 * @concurrency 各Testは新しく発行したCapabilityだけを使用する。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkbenchAiAdviceProviderCommand } from "../../src/security/workbench-ai-advice-provider-command.ts";
import { planWorkbenchAiAdviceProviderCommand } from "../../src/security/workbench-ai-advice-provider-command.ts";
import {
  consumeRuntimeOwnedWorkbenchAiAdvicePacket,
  describeWorkbenchAiAdviceRuntimePacketContract,
  issueRuntimeOwnedWorkbenchAiAdvicePacket,
  revokeRuntimeOwnedWorkbenchAiAdvicePacket,
} from "../../src/security/workbench-ai-advice-runtime-packet.ts";

const SHA = "a".repeat(64);

function input() {
  return {
    operationId: "OP-000001",
    profileId: "PROFILE-000001",
    provider: "codex" as const,
    taskHash: SHA,
    projectionHash: "b".repeat(64),
    providerPrompt: "Read the bounded projection and return structured advice.",
    providerCommand: planWorkbenchAiAdviceProviderCommand({
      provider: "codex",
      exactModelId: "gpt-6-sol",
      reasoningEffort: "medium",
    }),
  };
}

describe("workbench ai advice runtime packet", () => {
  it("issues and consumes an exact packet only once", () => {
    const issued = issueRuntimeOwnedWorkbenchAiAdvicePacket(input());
    assert.equal(issued.status, "issued");
    assert.match(issued.packetRef ?? "", /^ADVICEPKT-[A-F0-9]{32}$/u);
    assert.equal(issued.providerEffectIssued, false);

    const packet = consumeRuntimeOwnedWorkbenchAiAdvicePacket(
      issued.useCapability,
      issued.ownerCapability,
    );
    assert.equal(packet?.operationId, "OP-000001");
    assert.equal(packet?.provider, "codex");
    assert.equal(packet?.providerPrompt, input().providerPrompt);
    assert.match(packet?.commandHash ?? "", /^[a-f0-9]{64}$/u);
    assert.match(packet?.packetHash ?? "", /^[a-f0-9]{64}$/u);
    assert.deepEqual(packet?.providerCommand, input().providerCommand);
    assert.equal(packet?.repositoryMounted, false);
    assert.equal(packet?.workspaceMounted, false);
    assert.equal(packet?.toolsAllowed, false);
    assert.equal(
      consumeRuntimeOwnedWorkbenchAiAdvicePacket(
        issued.useCapability,
        issued.ownerCapability,
      ),
      null,
    );
  });

  it("does not consume a packet with a different owner capability", () => {
    const issued = issueRuntimeOwnedWorkbenchAiAdvicePacket(input());
    assert.equal(issued.status, "issued");
    assert.equal(
      consumeRuntimeOwnedWorkbenchAiAdvicePacket(
        issued.useCapability,
        Object.freeze({}),
      ),
      null,
    );
    assert.equal(
      revokeRuntimeOwnedWorkbenchAiAdvicePacket(issued.ownerCapability),
      true,
    );
  });

  it("revokes an unused packet without issuing an external effect", () => {
    const issued = issueRuntimeOwnedWorkbenchAiAdvicePacket(input());
    assert.equal(issued.status, "issued");
    assert.equal(
      revokeRuntimeOwnedWorkbenchAiAdvicePacket(issued.ownerCapability),
      true,
    );
    assert.equal(
      revokeRuntimeOwnedWorkbenchAiAdvicePacket(issued.ownerCapability),
      false,
    );
    assert.equal(
      consumeRuntimeOwnedWorkbenchAiAdvicePacket(
        issued.useCapability,
        issued.ownerCapability,
      ),
      null,
    );
  });

  it("rejects a command that requests a workspace mount", () => {
    const current = input();
    const result = issueRuntimeOwnedWorkbenchAiAdvicePacket({
      ...current,
      providerCommand: {
        ...current.providerCommand,
        workspaceMountRequired: true,
      } as unknown as WorkbenchAiAdviceProviderCommand,
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.providerEffectIssued, false);
    assert.equal(result.ownerCapability, null);
    assert.equal(result.useCapability, null);
  });

  it("snapshots mutable command input before returning the capability", () => {
    const current = input();
    const argv = [...current.providerCommand.argv];
    const environment: Record<string, string> = {
      ...current.providerCommand.environment,
    };
    const mutable = {
      ...current.providerCommand,
      argv,
      environment,
    } as WorkbenchAiAdviceProviderCommand;
    const issued = issueRuntimeOwnedWorkbenchAiAdvicePacket({
      ...current,
      providerCommand: mutable,
    });
    assert.equal(issued.status, "issued");
    argv.push("--unexpected-after-issue");
    environment.UNEXPECTED_AFTER_ISSUE = "1";
    const packet = consumeRuntimeOwnedWorkbenchAiAdvicePacket(
      issued.useCapability,
      issued.ownerCapability,
    );
    assert.equal(
      packet?.providerCommand.argv.includes("--unexpected-after-issue"),
      false,
    );
    assert.equal(
      Object.hasOwn(
        packet?.providerCommand.environment ?? {},
        "UNEXPECTED_AFTER_ISSUE",
      ),
      false,
    );
  });

  it("publishes a closed non-sharing contract", () => {
    assert.deepEqual(describeWorkbenchAiAdviceRuntimePacketContract(), {
      contract: "crdd-coordinator/workbench-ai-advice-runtime-packet",
      contractRevision: 1,
      maximumPromptBytes: 524288,
      singleUse: true,
      repositoryMounted: false,
      workspaceMounted: false,
      toolsAllowed: false,
      sessionPersistenceAllowed: false,
      providerEffectIssuedByPacket: false,
    });
  });
});
