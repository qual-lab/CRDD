/**
 * 外部AI Profile設定と利用可能性投影を提供する公開境界。
 *
 * @packageDocumentation
 * @responsibility 同じProfile契約をRepositoryローカル、CROS、Coordinator、Workbenchへ提供する。
 * @trace ARCH-000010
 * @boundary AI Runtimeと各Consumerの公開境界。
 * @effect Module読込みだけでは操作を開始しない。公開Storeの操作は検証済みOwner設定Rootの読取り・採用時保存を行い得る。
 * @security Secret、任意実行Path、任意CLI引数をProfile契約へ含めない。
 */
export { PROVIDER_AUTHENTICATION_POLICIES } from "./profile/authentication-policy.ts";
export { isProviderSubscriptionAuthenticationConfirmed } from "./profile/subscription-status.ts";
export { classifyProviderNonzeroExit } from "./output/provider-error.ts";
export { evaluateProviderEligibility } from "./profile/eligibility.ts";
export {
  providerProfileMatchesExecutionIdentity,
  providerProfileSupportsExecution,
  normalizeProviderExactModelId,
} from "./profile/execution-identity.ts";
export { prepareProviderFixedEnvironment } from "./profile/environment.ts";
export type { ProviderProfileExecutionIdentity } from "./profile/types.ts";
export {
  PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT,
  PROVIDER_MODEL_PROFILE_RUNTIME_CONTRACT_REVISION,
  resolveRuntimeOwnedProviderModelProfile,
  resolveRuntimeOwnedProviderModelProfileFromCatalog,
  describeProviderModelProfileRuntimeContract,
  selectProviderFamilyPreference,
} from "./profile/model.ts";
export {
  WORKBENCH_AI_ADVICE_PROVIDER_COMMAND_CONTRACT,
  WORKBENCH_AI_ADVICE_PROVIDER_COMMAND_CONTRACT_REVISION,
  planWorkbenchAiAdviceProviderCommand,
  type WorkbenchAiAdviceProviderCommandInput,
  type WorkbenchAiAdviceProviderCommand,
} from "./advice/provider-command.ts";
export {
  WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_CONTRACT,
  WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_CONTRACT_REVISION,
  WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_REASONS,
  extractWorkbenchAiAdviceProviderOutput,
} from "./advice/provider-output.ts";
export {
  describeProviderBillingPolicyContract,
  PROVIDER_BILLING_POLICY_CONTRACT,
  PROVIDER_BILLING_POLICY_CONTRACT_REVISION,
} from "./profile/billing-policy.ts";
export {
  DEFAULT_AI_PROFILE_CATALOG,
  evaluateAiProfileAvailability,
  resolveAiProfile,
  resolveAiProfileById,
  validateAiProfileCatalog,
} from "./catalog/resolve.ts";
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
export { createAiProfileCatalogRegistry } from "./profile/registry.ts";
export { createAiProfileCatalogAdministration } from "./profile/administration.ts";
export {
  createCrosAiProfileCatalogStore,
  createRepositoryAiProfileCatalogStore,
} from "./profile/store.ts";
export { parseUnambiguousJsonDocument } from "./output/unambiguous-json-document.ts";
export { extractProviderTaskEnvelope } from "./output/task-envelope.ts";
export {
  CODEX_FORBIDDEN_ENVIRONMENT_NAMES,
  CODEX_EXECUTION_PLAN_CONTRACT,
  CODEX_EXECUTION_PLAN_CONTRACT_REVISION,
  planCodexReadOnlyProbe,
  planCodexIsolatedTask,
  describeCodexExecutionPlanContract,
} from "./codex/execution-plan.ts";
export { describeCodexSubscriptionAuthenticationCli } from "./codex/authentication.ts";
export {
  CODEX_STRUCTURED_RESULT_CONTRACT,
  CODEX_STRUCTURED_RESULT_CONTRACT_REVISION,
  normalizeCodexStructuredResult,
  describeCodexStructuredResultContract,
} from "./codex/structured-result.ts";
export {
  describeCodexAdviceDistributionIdentity,
  codexAdviceProviderInitRequired,
} from "./codex/advice-distribution.ts";
export {
  describeClaudeSubscriptionAuthenticationCli,
  isClaudeSubscriptionAuthenticationConfirmed,
} from "./claude/authentication.ts";
export {
  CLAUDE_EXECUTION_PLAN_CONTRACT,
  CLAUDE_FORBIDDEN_ENVIRONMENT_NAMES,
  CLAUDE_EXECUTION_PLAN_CONTRACT_REVISION,
  CLAUDE_RESULT_ACCEPTANCE_MAXIMUM_TURNS,
  planClaudeTaskTurnBudget,
  buildClaudeExecutionArguments,
  planClaudeReadOnlyProbe,
  planClaudeIsolatedTask,
  describeClaudeExecutionPlanContract,
} from "./claude/execution-plan.ts";
export {
  CLAUDE_STRUCTURED_RESULT_CONTRACT,
  CLAUDE_STRUCTURED_RESULT_CONTRACT_REVISION,
  normalizeClaudeStructuredResult,
  describeClaudeStructuredResultContract,
} from "./claude/structured-result.ts";
