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
} from "./ai-selection/crud.ts";
export { readNetworkPolicy } from "./network-policy/crud.ts";
export {
  readCoordinatorConfig,
  readExecutionIntelligenceConfig,
} from "./history/crud.ts";
export { readRepositoryManifest } from "./manifest/crud.ts";
export {
  EXTERNAL_SEND_POLICY_RELATIVE_PATH,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
} from "./manifest/crud.ts";
export type {
  AiSelectionCatalog,
  AiSelectionChoice,
  AiSelectionConfig,
  AiSelectionRole,
  AiSelectionSnapshot,
  AiSelectionConfigResult,
  AiSelectionReadResult,
  AiSelectionSaveResult,
} from "./ai-selection/types.ts";
export type {
  NetworkPolicy,
  NetworkPolicyReadResult,
} from "./network-policy/types.ts";
export type {
  RepositoryManifest,
  RepositoryManifestReadResult,
} from "./manifest/types.ts";
export type {
  ToolRuntimeConfig,
  ToolRuntimeConfigResult,
} from "./history/types.ts";
