/**
 * decision-capability-portに属する責務をまとめる。
 *
 * @responsibility CoordinatorDecisionCapabilityを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
/**
 * decision-capability-portで使用するCoordinator Decision Capabilityの値契約を定義する。
 *
 * @responsibility Coordinator Decision CapabilityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionCapabilityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionCapabilityで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionCapabilityの宣言は外部境界を開かない。
 * @security CoordinatorDecisionCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorDecisionCapabilityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionCapability = Readonly<{
  secret: string;
  hash: string;
}>;

/**
 * Host-owned cryptographic operations for one-time human decision capabilities.
 *
 * @responsibility Coordinator Decision Capability PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionCapabilityPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionCapabilityPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionCapabilityPortの宣言は外部境界を開かない。
 * @security CoordinatorDecisionCapabilityPortはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorDecisionCapabilityPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionCapabilityPort = Readonly<{
  issue: () => CoordinatorDecisionCapability;
  hash: (value: string) => string;
}>;
