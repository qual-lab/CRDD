import type { ProjectRuntimePortResult } from "./port-result.ts";

/**
 * ProjectRuntimeIntegrationRecordが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeIntegrationRecordに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeIntegrationRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeIntegrationRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeIntegrationRecordの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeIntegrationRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeIntegrationRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeIntegrationRecord = Readonly<{
  kind: "integration" | "adoption";
  identity: string;
  value: unknown;
}>;

/**
 * Durable, immutable publication requested by the integration application.
 *
 * @responsibility ProjectRuntimeIntegrationRecordPortに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeIntegrationRecordPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeIntegrationRecordPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeIntegrationRecordPortの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeIntegrationRecordPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeIntegrationRecordPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeIntegrationRecordPort = Readonly<{
  write: (
    record: ProjectRuntimeIntegrationRecord,
  ) => ProjectRuntimePortResult<Readonly<{ written: true }>>;
}>;
