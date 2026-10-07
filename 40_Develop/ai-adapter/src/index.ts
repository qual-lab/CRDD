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
export { PROVIDER_AUTHENTICATION_POLICIES } from "./profile/authentication-policy.ts";
export { evaluateProviderEligibility } from "./profile/eligibility.ts";
export {
  providerProfileMatchesExecutionIdentity,
  providerProfileSupportsExecution,
  normalizeProviderExactModelId,
} from "./profile/profile-execution.ts";
export { prepareProviderFixedEnvironment } from "./profile/provider-environment.ts";
export type { ProviderProfileExecutionIdentity } from "./profile/types.ts";
export {
  PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT,
  PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT_REVISION,
  resolveRuntimeOwnedProviderModelProfile,
  resolveRuntimeOwnedProviderModelProfileFromCatalog,
  describeProviderModelProfileRuntimeContract,
  selectProviderFamilyPreference,
} from "./profile/provider-model-profile.ts";
export {
  WORKBENCH_AI_ADVICE_PROVIDER_COMMAND_CONTRACT,
  WORKBENCH_AI_ADVICE_PROVIDER_COMMAND_CONTRACT_REVISION,
  planWorkbenchAiAdviceProviderCommand,
} from "./advice/advice-provider-command.ts";
export type {
  WorkbenchAiAdviceProviderCommandInput,
  WorkbenchAiAdviceProviderCommand,
} from "./advice/advice-provider-command.ts";
export {
  WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_CONTRACT,
  WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_CONTRACT_REVISION,
  WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_REASONS,
  extractWorkbenchAiAdviceProviderOutput,
} from "./advice/advice-provider-output.ts";
export {
  describeProviderBillingPolicyContract,
  PROVIDER_BILLING_POLICY_CONTRACT,
  PROVIDER_BILLING_POLICY_CONTRACT_REVISION,
} from "./profile/provider-billing-policy.ts";
export {
  DEFAULT_AI_PROFILE_CATALOG,
  evaluateAiProfileAvailability,
  resolveAiProfile,
  resolveAiProfileById,
  validateAiProfileCatalog,
} from "./catalog/catalog.ts";
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
} from "./catalog/types.ts";
