/**
 * 外部AI Profile設定と利用可能性投影を提供する公開境界。
 *
 * @packageDocumentation
 * @responsibility 同じProfile契約をRepositoryローカル、CROS、Coordinator、Workbenchへ提供する。
 * @trace ARCH-000010
 * @boundary AI Runtimeと各Consumerの公開境界。
 * @effect N/A: 検証・解決関数と不変な既定Catalogだけを公開する。
 * @security Secret、任意実行Path、任意CLI引数をProfile契約へ含めない。
 */
export {
  DEFAULT_AI_PROFILE_CATALOG,
  evaluateAiProfileAvailability,
  resolveAiProfile,
  resolveAiProfileById,
  validateAiProfileCatalog,
} from "./catalog.ts";
export type {
  AiAdapterDefinition,
  AiModelTier,
  AiProfileAvailability,
  AiProfileAvailabilityObservation,
  AiProfileCatalog,
  AiProfileCatalogAdministration,
  AiProfileCatalogAdoptionRequest,
  AiProfileCatalogAdoptionResult,
  AiProfileCatalogRegistry,
  AiProfileCatalogStore,
  AiProfileCatalogStoreAdapterResult,
  AiProfileCatalogMutation,
  AiProfileCatalogMutationResult,
  AiProfileCatalogSnapshot,
  AiProfileDefinition,
  AiProfileResolutionRequest,
  AiProvider,
  AiReasoningEffort,
  AiSelectionRole,
  ResolvedAiProfile,
  ResolvedAiProfileIdentity,
} from "./types.ts";
