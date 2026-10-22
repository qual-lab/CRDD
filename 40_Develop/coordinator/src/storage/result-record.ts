/**
 * 上位結果保存の結合と現在値の型契約を定義する。
 *
 * @responsibility Repository・Queue結合と候補公開／採用結果の形を固定する。
 * @trace ARCH-000005
 */
import type { CoordinatorPortResult } from "../operation-result.ts";

export const COORDINATOR_INTEGRATION_CONTRACT =
  "crdd-coordinator/orchestrator-integration/v1" as const;

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
 * 候補公開・採用結果の完全な保存値を定義する。
 *
 * @responsibility 候補公開と採用Receiptの結合・内容を現在状態の結果区画として保持する。
 * @trace ARCH-000005
 * @shape contract、kind、四つの結合ID、identity、contentHash、value。
 * @invariant 保存成功を受領・既読へ読み替えない。
 * @boundary 候補結果Portと現在状態保存。
 * @security 保護DecisionやAuthorityを追加しない。
 * @compatibility valueは既存PortのJSON値をそのまま保持する。
 */
export type CoordinatorResultRecord = Readonly<{
  contract: typeof COORDINATOR_INTEGRATION_CONTRACT;
  kind: "integration" | "adoption";
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string | null;
  queueId: string;
  identity: string;
  contentHash: string;
  value: unknown;
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
 * Durable, immutable publication requested by the integration application.
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
