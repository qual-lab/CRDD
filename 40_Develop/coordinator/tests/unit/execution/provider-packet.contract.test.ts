/**
 * Workbench助言Runtime Packetの一回消費と非共有境界を検証する。
 *
 * @packageDocumentation
 * @responsibility 改訂2 Commandの閉形式・識別種別とCatalog IdentityのHash相関、正常発行、一回消費、取消および旧形拒否を確認する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Unit TestとPacket Runtimeの公開APIの間。
 */
import { planProviderExecution } from "../../../../ai-adapter/src/index.ts";
import { describeAdviceResultSchema } from "../../../src/execution/result.ts";
import assert from "node:assert/strict";
import { executionSelection } from "../../fixtures/ai-selection.ts";
import { describe, it } from "node:test";
import type { ProviderAdviceCommand } from "../../../src/execution/preparation.ts";
import {
  consumeRuntimeOwnedProviderAdvicePacket,
  describeProviderAdvicePacketContract,
  issueRuntimeOwnedProviderAdvicePacket,
  revokeRuntimeOwnedProviderAdvicePacket,
  hashProviderAdviceCommand,
} from "../../../src/execution/preparation.ts";
import { describeDockerProviderExecutionLocations } from "../../../../docker-isolation/src/index.ts";
import { bindProviderAdviceCommand } from "../../../src/execution/preparation.ts";

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
    executionSelection: executionSelection("advice"),
    provider: "codex" as const,
    taskHash: sha,
    projectionHash: "b".repeat(64),
    providerPrompt: "Read the bounded projection and return structured advice.",
    providerCommand: bindProviderAdviceCommand(
      planProviderExecution(
        {
          provider: "codex",
          purpose: "advice",
          modelSelection: {
            provider: "codex",
            modelIdentifier: "gpt-5.6-sol",
            reasoningEffort: "medium",
            identifierKind: "exact",
          },
          resultSchema: describeAdviceResultSchema(),
        },
        describeDockerProviderExecutionLocations("codex", "advice"),
      ).plan ?? assert.fail("provider_execution_plan_not_ready"),
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
   * @stimulus 識別種別・Catalog Identityを個別変更してHash比較し、Packetを発行・消費する。
   * @observation Hash差、返却値、一回消費後の利用不能とEffect非発行を観測する。
   * @oracle 同じModel名でも種別・Catalog Identity差は別Hashになり、再消費できない。
   * @cleanup N/A: Process外資源を生成しない局所検証である。
   * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
   */
  it("issues and consumes an exact packet only once", () => {
    const command = input().providerCommand;
    assert.notEqual(
      hashProviderAdviceCommand(command),
      hashProviderAdviceCommand({ ...command, identifierKind: "alias" }),
    );
    assert.notEqual(
      hashProviderAdviceCommand(command),
      hashProviderAdviceCommand({
        ...command,
        catalogIdentity: "c".repeat(64),
      }),
    );
    const issued = issueRuntimeOwnedProviderAdvicePacket(input());
    assert.equal(issued.status, "issued");
    assert.match(issued.packetRef ?? "", /^ADVICEPKT-[A-F0-9]{32}$/u);
    assert.equal(issued.providerEffectIssued, false);

    const packet = consumeRuntimeOwnedProviderAdvicePacket(
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
      consumeRuntimeOwnedProviderAdvicePacket(
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
    const issued = issueRuntimeOwnedProviderAdvicePacket(input());
    assert.equal(issued.status, "issued");
    assert.equal(
      consumeRuntimeOwnedProviderAdvicePacket(
        issued.useCapability,
        Object.freeze({}),
      ),
      null,
    );
    assert.equal(
      revokeRuntimeOwnedProviderAdvicePacket(issued.ownerCapability),
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
    const issued = issueRuntimeOwnedProviderAdvicePacket(input());
    assert.equal(issued.status, "issued");
    assert.equal(
      revokeRuntimeOwnedProviderAdvicePacket(issued.ownerCapability),
      true,
    );
    assert.equal(
      revokeRuntimeOwnedProviderAdvicePacket(issued.ownerCapability),
      false,
    );
    assert.equal(
      consumeRuntimeOwnedProviderAdvicePacket(
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
    const result = issueRuntimeOwnedProviderAdvicePacket({
      ...current,
      providerCommand: {
        ...current.providerCommand,
        workspaceMountRequired: true,
      } as unknown as ProviderAdviceCommand,
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.providerEffectIssued, false);
    assert.equal(result.ownerCapability, null);
    assert.equal(result.useCapability, null);
    for (const difference of [
      { contractRevision: 1 },
      { catalogIdentity: "invalid" },
      { identifierKind: "unknown" },
    ]) {
      const invalid = issueRuntimeOwnedProviderAdvicePacket({
        ...current,
        providerCommand: {
          ...current.providerCommand,
          ...difference,
        } as unknown as ProviderAdviceCommand,
      });
      assert.equal(invalid.status, "blocked");
      assert.equal(invalid.ownerCapability, null);
      assert.equal(invalid.providerEffectIssued, false);
    }
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
    } as ProviderAdviceCommand;
    const issued = issueRuntimeOwnedProviderAdvicePacket({
      ...current,
      providerCommand: mutable,
    });
    assert.equal(issued.status, "issued");
    argv.push("--unexpected-after-issue");
    environment.UNEXPECTED_AFTER_ISSUE = "1";
    const packet = consumeRuntimeOwnedProviderAdvicePacket(
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
    assert.deepEqual(describeProviderAdvicePacketContract(), {
      contract: "crdd-coordinator/workbench-ai-advice-runtime-packet",
      contractRevision: 2,
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
