/**
 * Workbench助言Runtime Packetの一回消費と非共有境界を検証する。
 *
 * @packageDocumentation
 * @responsibility 正常発行、再利用拒否、取消および不正Command拒否を決定論的に確認する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Unit TestとPacket Runtimeの公開APIの間。
 */
import { describeWorkbenchAiAdviceResultSchema } from "../../../src/workbench-ai/advice-result.ts";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkbenchAiAdviceProviderCommand } from "../../../../ai-adapter/src/index.ts";
import { planWorkbenchAiAdviceProviderCommand } from "../../../../ai-adapter/src/index.ts";
import {
  consumeRuntimeOwnedWorkbenchAiAdvicePacket,
  describeWorkbenchAiAdviceRuntimePacketContract,
  issueRuntimeOwnedWorkbenchAiAdvicePacket,
  revokeRuntimeOwnedWorkbenchAiAdvicePacket,
} from "../../../src/workbench-ai/advice-packet.ts";

const sha = "a".repeat(64);

/**
 * input用の試験入力または観測処理を提供する。
 *
 * @responsibility input用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus inputの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
function input() {
  return {
    operationId: "OP-000001",
    profileId: "PROFILE-000001",
    provider: "codex" as const,
    taskHash: sha,
    projectionHash: "b".repeat(64),
    providerPrompt: "Read the bounded projection and return structured advice.",
    providerCommand: planWorkbenchAiAdviceProviderCommand(
      {
        provider: "codex",
        exactModelId: "gpt-6-sol",
        reasoningEffort: "medium",
      },
      describeWorkbenchAiAdviceResultSchema(),
    ),
  };
}

describe("workbench ai advice runtime packet", () => {
  /**
   * issues and consumes an exact packet only onceを検証する。
   *
   * @responsibility issues and consumes an exact packet only onceを検証するの検証責務を所有する。
   * @trace ERB-UT-023
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus issues and consumes an exact packet only onceの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup N/A: Process外資源を生成しない局所検証である。
   * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
   */
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

  /**
   * does not consume a packet with a different owner capabilityを検証する。
   *
   * @responsibility does not consume a packet with a different owner capabilityを検証するの検証責務を所有する。
   * @trace ERB-UT-023
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus does not consume a packet with a different owner capabilityの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup N/A: Process外資源を生成しない局所検証である。
   * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
   */
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

  /**
   * revokes an unused packet without issuing an external effectを検証する。
   *
   * @responsibility revokes an unused packet without issuing an external effectを検証するの検証責務を所有する。
   * @trace ERB-UT-023
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus revokes an unused packet without issuing an external effectの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup N/A: Process外資源を生成しない局所検証である。
   * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
   */
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

  /**
   * rejects a command that requests a workspace mountを検証する。
   *
   * @responsibility rejects a command that requests a workspace mountを検証するの検証責務を所有する。
   * @trace ERB-UT-023
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus rejects a command that requests a workspace mountの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup N/A: Process外資源を生成しない局所検証である。
   * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
   */
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

  /**
   * snapshots mutable command input before returning the capabilityを検証する。
   *
   * @responsibility snapshots mutable command input before returning the capabilityを検証するの検証責務を所有する。
   * @trace ERB-UT-023
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus snapshots mutable command input before returning the capabilityの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup N/A: Process外資源を生成しない局所検証である。
   * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
   */
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

  /**
   * publishes a closed non-sharing contractを検証する。
   *
   * @responsibility publishes a closed non-sharing contractを検証するの検証責務を所有する。
   * @trace ERB-UT-023
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus publishes a closed non-sharing contractの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup N/A: Process外資源を生成しない局所検証である。
   * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
   */
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
