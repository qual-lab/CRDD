/**
 * Provider実行計画・結果変換とAI Profile管理を提供する公開境界。
 *
 * @packageDocumentation
 * @responsibility Provider固有差を共通の計画・解析・認証・設定APIとして公開し、起動・送信許可・資源回収は利用側Ownerへ残す。
 * @trace ARCH-000010
 * @boundary AI Adapterと各Consumerの公開境界。
 * @effect Module読込みだけでは操作を開始しない。公開Storeの操作は検証済みOwner設定Rootの読取り・採用時保存を行い得る。
 * @security Secret、任意実行Path、任意CLI引数をProfile契約へ含めない。
 */
export { PROVIDER_AUTHENTICATION_POLICIES } from "./authentication/policy.ts";
export { evaluateProviderAuthentication } from "./authentication/result.ts";
export type { ProviderAuthenticationResult } from "./authentication/result.ts";
export { convertProviderError } from "./provider/error.ts";
export type { ProviderError, ProviderErrorReason } from "./provider/error.ts";
export {
  evaluateProviderAvailability,
  prepareProviderEnvironment,
} from "./provider/validation.ts";
export type {
  ProviderAvailability,
  ProviderEnvironmentResult,
} from "./provider/validation.ts";
export {
  providerProfileMatchesExecutionIdentity,
  providerProfileSupportsExecution,
  validateProviderModelId,
} from "./profile/validation.ts";
export type { ProviderProfileExecutionIdentity } from "./profile/validation.ts";
export type { ProviderModelIdValidationResult } from "./profile/validation.ts";
export {
  PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT,
  PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT_REVISION,
  resolveRuntimeOwnedProviderModelProfile,
  resolveRuntimeOwnedProviderModelProfileFromCatalog,
  describeProviderModelProfileRuntimeContract,
  selectProviderFamilyPreference,
} from "./profile/resolve.ts";
export {
  PROVIDER_ADVICE_COMMAND_CONTRACT,
  PROVIDER_ADVICE_COMMAND_CONTRACT_REVISION,
  type ProviderModelSelection,
  type ProviderAdvicePlan,
  type ProviderExecutionInput,
  type ProviderExecutionPurpose,
  type ProviderExecutionPlan,
  type ProviderExecutionPlanResult,
  type ProviderPlanningReason,
  planProviderExecution,
  describeProviderExecution,
  type ProviderExecutionDefinition,
  evaluateProviderTaskScope,
  type ProviderTaskScopeResult,
} from "./provider/plan.ts";
export {
  PROVIDER_ADVICE_OUTPUT_CONTRACT,
  PROVIDER_ADVICE_OUTPUT_CONTRACT_REVISION,
  PROVIDER_ADVICE_OUTPUT_REASONS,
  parseProviderResult,
  type ProviderResultInput,
  type ProviderResultReason,
  type ProviderResultParseResult,
} from "./provider/result.ts";
export {
  describeProviderBillingPolicy,
  PROVIDER_BILLING_POLICY_CONTRACT,
  PROVIDER_BILLING_POLICY_CONTRACT_REVISION,
} from "./billing/policy.ts";
export type { ProviderBillingPolicy } from "./billing/policy.ts";
export {
  getAiModelCatalog,
  resolveAiModelSelection,
  defaultAiProfileCatalog,
  resolveAiProfile,
  resolveAiProfileById,
} from "./catalog/resolve.ts";
export type {
  AiModelCatalogSnapshot,
  AiModelSelectionResult,
} from "./catalog/resolve.ts";
export type {
  AiModelCatalog,
  AiModelDefinition,
  AiModelSelection,
} from "./catalog/types.ts";
export { evaluateAiProfileAvailability } from "./profile/validation.ts";
export type { RuntimeProviderModelProfile } from "./profile/resolve.ts";
export type { AiProfileResolutionResult } from "./catalog/resolve.ts";
export type {
  AiProfileCatalogValidationResult,
  AiProfileValidationResult,
} from "./catalog/validation.ts";
export type {
  AiProfileMutationParseResult,
  AiProfileMutationValidationResult,
} from "./profile/crud.ts";
export type { AiProfileCatalogReadResult } from "./storage/store.ts";
export {
  validateAiProfileCatalog,
  validateAiProfileDefinition,
} from "./catalog/validation.ts";
export type {
  AiAdapterDefinition,
  AiProvider,
  AiReasoningEffort,
} from "./provider/types.ts";
export type {
  AiModelTier,
  AiProfileAvailability,
  AiProfileAvailabilityObservation,
  AiProfileDefinition,
  AiProfileResolutionRequest,
  AiSelectionRole,
  ResolvedAiProfile,
  ResolvedAiProfileIdentity,
} from "./profile/types.ts";
export type { AiProfileCatalog } from "./catalog/types.ts";
export type {
  AiProfileCatalogAdministration,
  AiProfileCatalogMutation,
  AiProfileCatalogMutationResult,
} from "./profile/crud.ts";
export type {
  AiProfileCatalogAdoptionRequest,
  AiProfileCatalogAdoptionResult,
  AiProfileCatalogStore,
  AiProfileCatalogStoreResult,
  AiProfileCatalogSnapshot,
} from "./storage/store.ts";
export {
  createAiProfileCatalogAdministration,
  validateAiProfileMutationResult,
  parseAiProfileCatalogMutation,
} from "./profile/crud.ts";
export {
  createHostAiProfileCatalogStore,
  createRepositoryAiProfileCatalogStore,
} from "./storage/store.ts";
export { parseUnambiguousJsonDocument } from "./provider/json.ts";
export {
  CODEX_EXECUTION_PLAN_CONTRACT,
  CODEX_EXECUTION_PLAN_CONTRACT_REVISION,
  projectCodexExecutionBoundary,
} from "./codex/plan.ts";
export { describeProviderAuthentication } from "./authentication/plan.ts";
export type { ProviderAuthenticationDefinition } from "./authentication/plan.ts";
export {
  CODEX_STRUCTURED_RESULT_CONTRACT,
  CODEX_STRUCTURED_RESULT_CONTRACT_REVISION,
  normalizeCodexStructuredResult,
  describeCodexStructuredResultContract,
} from "./codex/result.ts";
export {
  CLAUDE_EXECUTION_PLAN_CONTRACT,
  CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION,
  CLAUDE_RESULT_ACCEPTANCE_MAXIMUM_TURNS,
} from "./claude/plan.ts";
export {
  CLAUDE_STRUCTURED_RESULT_CONTRACT,
  CLAUDE_STRUCTURED_RESULT_CONTRACT_REVISION,
  normalizeClaudeStructuredResult,
  describeClaudeStructuredResultContract,
} from "./claude/result.ts";

export type { ProviderExecutionLocations } from "./provider/types.ts";
