/**
 * 用途限定の一時Operation保存が受け渡す型契約。
 *
 * @responsibility 一時OperationのCapability、根拠昇格受領と回復参照を定義する。
 * @trace ARCH-000011
 */
/**
 * temporary-operation-storeで使用するTemporary Operation Capabilityの値契約を定義する。
 *
 * @responsibility Temporary Operation CapabilityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape TemporaryOperationCapabilityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TemporaryOperationCapabilityで宣言した値と責務の対応を維持する。
 * @boundary N/A: TemporaryOperationCapabilityの宣言は外部境界を開かない。
 * @security N/A: TemporaryOperationCapabilityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TemporaryOperationCapabilityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TemporaryOperationCapability = Readonly<{
  contract: "crdd/runtime-data/temporary-operation-capability/v1";
}>;

/**
 * temporary-operation-storeで使用するTemporary Evidence Promotion Receiptの値契約を定義する。
 *
 * @responsibility Temporary Evidence Promotion ReceiptのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape TemporaryEvidencePromotionReceiptが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TemporaryEvidencePromotionReceiptで宣言した値と責務の対応を維持する。
 * @boundary N/A: TemporaryEvidencePromotionReceiptの宣言は外部境界を開かない。
 * @security N/A: TemporaryEvidencePromotionReceiptはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TemporaryEvidencePromotionReceiptの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TemporaryEvidencePromotionReceipt = Readonly<{
  contract: "crdd/runtime-data/temporary-evidence-promotion-receipt/v1";
}>;

/**
 * temporary-operation-storeで使用するTemporary Operation 回復 Referenceの値契約を定義する。
 *
 * @responsibility Temporary Operation 回復 ReferenceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape TemporaryOperationRecoveryReferenceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TemporaryOperationRecoveryReferenceで宣言した値と責務の対応を維持する。
 * @boundary N/A: TemporaryOperationRecoveryReferenceの宣言は外部境界を開かない。
 * @security N/A: TemporaryOperationRecoveryReferenceはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TemporaryOperationRecoveryReferenceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TemporaryOperationRecoveryReference = Readonly<{
  operationId: string;
  owner: string;
  storage?: "signature";
  identity: string;
  generation: number;
}>;
