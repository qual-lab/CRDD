import type { CoordinatorPortResult } from "../state/result.ts";

/**
 * 上位の結果保存に必要なRepository／Project／Milestone／Queue結合を定義する。
 *
 * @responsibility Integration 記録 BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000005
 * @shape IntegrationRecordBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant IntegrationRecordBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: IntegrationRecordBindingの宣言は外部境界を開かない。
 * @security IntegrationRecordBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility IntegrationRecordBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type IntegrationRecordBinding = Readonly<{
  workingDirectory: string;
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string | null;
  queueId: string;
}>;

/**
 * integration-record-portで使用するCoordinator Integration 記録の値契約を定義する。
 *
 * @responsibility Coordinator Integration 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorIntegrationRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorIntegrationRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorIntegrationRecordの宣言は外部境界を開かない。
 * @security N/A: CoordinatorIntegrationRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorIntegrationRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorIntegrationRecord = Readonly<{
  kind: "integration" | "adoption";
  identity: string;
  value: unknown;
}>;

/**
 * 候補公開・採用結果を一回保存する利用側契約を定義する。
 *
 * @responsibility Coordinator Integration 記録 PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorIntegrationRecordPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorIntegrationRecordPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorIntegrationRecordPortの宣言は外部境界を開かない。
 * @security N/A: CoordinatorIntegrationRecordPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorIntegrationRecordPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorIntegrationRecordPort = Readonly<{
  write: (
    record: CoordinatorIntegrationRecord,
  ) => CoordinatorPortResult<Readonly<{ written: true }>>;
}>;
