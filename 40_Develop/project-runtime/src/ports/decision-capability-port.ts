/**
 * decision-capability-portに属する責務をまとめる。
 *
 * @responsibility ProjectRuntimeDecisionCapabilityを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
/**
 * decision-capability-portで使用するProject Runtime Decision Capabilityの値契約を定義する。
 *
 * @responsibility Project Runtime Decision CapabilityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeDecisionCapabilityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeDecisionCapabilityで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeDecisionCapabilityの宣言は外部境界を開かない。
 * @security ProjectRuntimeDecisionCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectRuntimeDecisionCapabilityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeDecisionCapability = Readonly<{
  secret: string;
  hash: string;
}>;

/**
 * Host-owned cryptographic operations for one-time human decision capabilities.
 *
 * @responsibility Project Runtime Decision Capability PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeDecisionCapabilityPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeDecisionCapabilityPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeDecisionCapabilityPortの宣言は外部境界を開かない。
 * @security ProjectRuntimeDecisionCapabilityPortはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectRuntimeDecisionCapabilityPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeDecisionCapabilityPort = Readonly<{
  issue: () => ProjectRuntimeDecisionCapability;
  hash: (value: string) => string;
}>;
