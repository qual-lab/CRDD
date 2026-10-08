/**
 * decision-capability-portに属する責務をまとめる。
 *
 * @responsibility OrchestratorDecisionCapabilityを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
/**
 * decision-capability-portで使用するOrchestrator Decision Capabilityの値契約を定義する。
 *
 * @responsibility Orchestrator Decision CapabilityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorDecisionCapabilityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorDecisionCapabilityで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorDecisionCapabilityの宣言は外部境界を開かない。
 * @security OrchestratorDecisionCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OrchestratorDecisionCapabilityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorDecisionCapability = Readonly<{
  secret: string;
  hash: string;
}>;

/**
 * Host-owned cryptographic operations for one-time human decision capabilities.
 *
 * @responsibility Orchestrator Decision Capability PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorDecisionCapabilityPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorDecisionCapabilityPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorDecisionCapabilityPortの宣言は外部境界を開かない。
 * @security OrchestratorDecisionCapabilityPortはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OrchestratorDecisionCapabilityPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorDecisionCapabilityPort = Readonly<{
  issue: () => OrchestratorDecisionCapability;
  hash: (value: string) => string;
}>;
