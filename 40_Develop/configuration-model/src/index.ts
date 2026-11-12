/**
 * configuration-modelの完成操作と値契約を公開する。
 * @responsibility モデル固有の責務だけを公開し、他モデルを再exportしない。
 * @trace ARCH-000008
 * @boundary 他モデルへの直接依存を持たないPackage境界。
 */
export {
  inspectAiSelectionChoice,
  validateAiSelectionConfig,
} from "./ai-selection/validation.ts";
export {
  readRepositoryAiSelection,
  saveRepositoryAiSelection,
} from "./storage/ai-selection.ts";
export { readNetworkPolicy } from "./storage/network-policy.ts";
export {
  readCoordinatorConfig,
  readExecutionIntelligenceConfig,
} from "./configuration/read-tool-config.ts";
export {
  inspectCrosTrustPolicy,
  inspectRepositoryManifest,
} from "./configuration/validate-declarations.ts";
export {
  EXTERNAL_SEND_POLICY_RELATIVE_PATH,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
} from "./configuration/storage-paths.ts";
export type {
  AiSelectionCatalog,
  AiSelectionChoice,
  AiSelectionConfig,
  AiSelectionRole,
  AiSelectionSnapshot,
} from "./ai-selection/types.ts";
export type { AiSelectionConfigResult } from "./ai-selection/validation.ts";
export type {
  AiSelectionReadResult,
  AiSelectionSaveResult,
} from "./storage/ai-selection.ts";
export type { NetworkPolicy } from "./configuration/network-policy.ts";
export type { NetworkPolicyReadResult } from "./storage/network-policy.ts";
export type {
  CrosTrustPolicy,
  RepositoryManifest,
  ToolRuntimeConfig,
  ToolRuntimeConfigResult,
} from "./configuration/types.ts";
