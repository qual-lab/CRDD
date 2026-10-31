/**
 * 基本計画検査用の合成値を構築する。
 * @responsibility 実Path・Image・認証情報を使用しない固定計画を試験へ渡す。
 * @trace ERB-IT-004
 * @level UT
 * @scope 値だけのfixture。実Command成立は主張しない。
 * @boundary Executor局所試験。
 */
import type { AttemptPlan } from "../../src/attempt/types.ts";
import { PURPOSES } from "../../src/attempt/constants.ts";

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
export function attemptPlan(): AttemptPlan {
  const suffix = "0101010101010101";
  return {
    provider: "claude",
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
    networkPolicy: null,
    commands: PURPOSES.map((purpose) => ({ purpose, argv: [purpose] })),
  };
}
