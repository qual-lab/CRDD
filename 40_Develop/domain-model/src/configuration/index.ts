/**
 * Repository宣言とTool設定の公開境界。
 *
 * @packageDocumentation
 * @responsibility 既存Schemaの宣言検証、固定配置定数とTool別期間設定の読取りを公開する。
 * @trace ARCH-000011
 * @boundary Repository設定と利用側の境界。
 * @effect Tool設定を読取るだけで状態・履歴・保存領域を変更しない。
 * @security 不正・読取り不能を既定値へ畳まず、Trust FrameworkやAuthorityを生成しない。
 */
export {
  CROS_DIRECTORY_ID,
  CROS_TRUST_POLICY_SCHEMA,
  REPOSITORY_MANIFEST_SCHEMA,
  inspectCrosTrustPolicy,
  inspectRepositoryManifest,
} from "./runtime-data-contract.ts";
export {
  EXTERNAL_SEND_POLICY_RELATIVE_PATH,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
  TESTS_RELATIVE_PATH,
} from "./runtime-data-paths.ts";
export {
  readOrchestratorConfig,
  readExecutionIntelligenceConfig,
  readCoordinatorConfig,
} from "./tool-runtime-config.ts";
export type {
  RepositoryManifest,
  CrosTrustPolicy,
  ToolRuntimeConfig,
  ToolRuntimeConfigResult,
} from "./types.ts";
