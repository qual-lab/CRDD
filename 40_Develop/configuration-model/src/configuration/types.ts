/**
 * Repository宣言とTool設定の型契約。
 *
 * @responsibility Manifest、Trust宣言および期間設定の閉じた値を所有する。
 * @trace ARCH-000011
 */
import type {
  REPOSITORY_MANIFEST_SCHEMA,
  CROS_TRUST_POLICY_SCHEMA,
} from "./validate-declarations.ts";

/**
 * 一つのツール所有者の期間設定を固定する。
 * @responsibility 非秘密の期間だけを収集する。
 * @trace ARCH-000011
 * @shape schemaRevisionとhistoryRetentionDays。
 * @invariant 期間は正の安全な整数でミリ秒変換できる。
 * @boundary Repository設定。
 * @security AuthorityやPathを含めない。
 * @compatibility 設定File不存在だけ30日、存在するFileは全Property必須。
 */
export type ToolRuntimeConfig = Readonly<{
  schemaRevision: 1;
  historyRetentionDays: number;
}>;

/**
 * 設定の観測成功と停止を区別する。
 * @responsibility 不正設定を既定値へ畳まない。
 * @trace ARCH-000011
 * @shape readyはsourceとconfig、blockedはreason。
 * @invariant blockedは期間を返さない。
 * @boundary 設定読取りの公開結果。
 * @security 設定本文とPathを失敗理由へ複製しない。
 * @compatibility 不存在だけがdefaultとなる。
 */
export type ToolRuntimeConfigResult =
  | Readonly<{
      status: "ready";
      source: "default" | "file";
      config: ToolRuntimeConfig;
    }>
  | Readonly<{ status: "blocked"; reason: "tool_runtime_config_invalid" }>;

/**
 * runtime-data-contractで使用するRepository Manifestの値契約を定義する。
 *
 * @responsibility Repository ManifestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape RepositoryManifestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryManifestで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryManifestの宣言は外部境界を開かない。
 * @security N/A: RepositoryManifestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryManifestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryManifest = Readonly<{
  schema: typeof REPOSITORY_MANIFEST_SCHEMA;
  projectId: string;
  repositoryId: string;
  displayName: string;
  repositoryRole: string;
  capabilities: readonly string[];
  contextSurfaces: readonly string[];
  externalSendPolicy: "config/external-send-policy.json" | null;
}>;

/**
 * runtime-data-contractで使用するCros Trust Policyの値契約を定義する。
 *
 * @responsibility Cros Trust PolicyのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape CrosTrustPolicyが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CrosTrustPolicyで宣言した値と責務の対応を維持する。
 * @boundary N/A: CrosTrustPolicyの宣言は外部境界を開かない。
 * @security N/A: CrosTrustPolicyはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CrosTrustPolicyの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CrosTrustPolicy = Readonly<{
  schema: typeof CROS_TRUST_POLICY_SCHEMA;
  trustDomainId: string;
  trustedRuntimePublishers: readonly string[];
  repositoryAdmission: "explicit-binding-only";
  maximumCapabilities: readonly string[];
  transports: readonly ("stdio" | "local-http" | "remote-http")[];
  allowUnsignedLocalDevelopment: boolean;
}>;
