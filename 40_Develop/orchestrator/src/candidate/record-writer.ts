/**
 * integration-record-portに属する責務をまとめる。
 *
 * @responsibility OrchestratorIntegrationRecordを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import type { OrchestratorPortResult } from "../operation-result.ts";

/**
 * integration-record-portで使用するOrchestrator Integration 記録の値契約を定義する。
 *
 * @responsibility Orchestrator Integration 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorIntegrationRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorIntegrationRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorIntegrationRecordの宣言は外部境界を開かない。
 * @security N/A: OrchestratorIntegrationRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorIntegrationRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorIntegrationRecord = Readonly<{
  kind: "integration" | "adoption";
  identity: string;
  value: unknown;
}>;

/**
 * Durable, immutable publication requested by the integration application.
 *
 * @responsibility Orchestrator Integration 記録 PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorIntegrationRecordPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorIntegrationRecordPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorIntegrationRecordPortの宣言は外部境界を開かない。
 * @security N/A: OrchestratorIntegrationRecordPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorIntegrationRecordPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorIntegrationRecordPort = Readonly<{
  write: (
    record: OrchestratorIntegrationRecord,
  ) => OrchestratorPortResult<Readonly<{ written: true }>>;
}>;
