/**
 * ProjectRuntimeDecisionCapabilityが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeDecisionCapabilityに必要な値と制約を一つの型契約として保持する。
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
 * @responsibility ProjectRuntimeDecisionCapabilityPortに必要な値と制約を一つの型契約として保持する。
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
