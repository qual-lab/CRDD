/**
 * 基本計画検査用の合成値を構築する。
 * @responsibility 実Path・Image・認証情報を使用しない固定計画を試験へ渡す。
 * @trace ERB-IT-004
 * @level UT
 * @scope 値だけのfixture。実Command成立は主張しない。
 * @boundary Executor局所試験。
 */
import type { TestAttemptPlan } from "../../scripts/executor-test.ts";
import { PURPOSES } from "../../src/lifecycle/attempt.ts";
import { planExecution } from "../../../ai-adapter/src/index.ts";

/**
 * 共通の拒否反例へ使う有効な基本計画を返す。
 * @responsibility 元Capabilityと各Identityを合成値へ固定する。
 * @trace ERB-IT-004
 * @precondition N/A: 外部入力なし。
 * @stimulus 新しい計画値を生成する。
 * @observation 呼出し側が正例・変異の返値を確認する。
 * @oracle 基本検査は通るが、実Commandの完全照合とは区別する。
 * @cleanup N/A: 外部資源なし。
 * @boundary Executorの型付き合成入力。
 */
export function attemptPlan(): TestAttemptPlan {
  const suffix = "0101010101010101";
  return {
    provider: "claude",
    providerPlan: planExecution({
      provider: "claude",
      purpose: "probe",
      input: { provider: "claude", mode: "read_only_probe" },
    }),
    operationId: "OP-123456",
    grantRef: "PHMGRANT-123456",
    executionSelection: {
      provider: "claude",
      modelIdentifier: "opus",
      identifierKind: "alias",
      reasoningEffort: "low",
      purpose: "task",
    },
    activeMountCapability: {},
    providerHomeSourcePath: "C:/synthetic-not-accessed/home",
    providerHomeIdentityHash: "a".repeat(64),
    providerHomeProtectionHash: "b".repeat(64),
    localUserBindingHash: "c".repeat(64),
    stableLogicalHomeBindingHash: "d".repeat(64),
    authContainerName: `crdd-auth-${suffix}`,
    providerContainerName: `crdd-claude-${suffix}`,
    proxyContainerName: `crdd-proxy-${suffix}`,
    internalNetworkName: `crdd-internal-${suffix}`,
    egressNetworkName: `crdd-egress-${suffix}`,
    ownershipLabel: `crdd.coordinator.runtime=${suffix}`,
    providerImageDigest: `sha256:${"1".repeat(64)}`,
    proxyImageDigest: `sha256:${"2".repeat(64)}`,
    subscriptionOffering: "claude_max",
    operationMode: "boolean_probe",
    taskRole: null,
    providerInput: null,
    workspaceSourcePath: null,
    workspaceMountMode: null,
    additionalHosts: null,
    isolationRequest: {
      managementDirectory: "C:/synthetic-not-accessed/management",
      resources: [
        "create_provider",
        "create_proxy",
        "create_subscription_auth_probe",
        "create_internal_network",
        "create_egress_network",
      ].map((key) => ({
        kind: "network" as const,
        key,
        name: "crdd-synthetic",
        ownershipLabel: "crdd.coordinator.runtime=0101010101010101",
        internal: true,
      })),
      steps: PURPOSES.map((key) => ({
        action: "create" as const,
        key,
        resource: "create_provider",
        timeoutMs: 10000,
      })),
      cleanupOrder: [],
      setupTimeoutMs: 10000,
      unreceiptedAbsence: "retain",
      verifyLabelAbsence: false,
    },
    commands: PURPOSES.map((purpose) => ({ purpose, argv: [purpose] })),
  };
}
/** 製品Requestが受け取る所在・Home相関だけを合成Planから明示投影する。 @trace ERB-IT-004 */
export function attemptTarget(
  plan: TestAttemptPlan,
  workspaceSourcePath: string,
  temporarySourcePath: string,
) {
  return {
    operationId: plan.operationId,
    grantRef: plan.grantRef,
    provider: plan.provider,
    workspaceSourcePath,
    temporarySourcePath,
    providerHomeSourcePath: plan.providerHomeSourcePath,
    providerHomeIdentityHash: plan.providerHomeIdentityHash,
    providerHomeProtectionHash: plan.providerHomeProtectionHash,
    localUserBindingHash: plan.localUserBindingHash,
    stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
    activeMountCapability: plan.activeMountCapability,
  };
}
