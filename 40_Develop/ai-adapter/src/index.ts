/**
 * Provider実行計画・結果変換・認証・技術Catalogを提供する公開境界。
 *
 * @packageDocumentation
 * @responsibility Provider固有差を共通の計画・解析・認証・技術対応APIとして公開し、起動・送信許可・資源回収は利用側Ownerへ残す。
 * @trace ARCH-000010
 * @boundary AI Adapterと各Consumerの公開境界。
 * @effect Module読込みだけでは操作を開始しない。設定の保存は所有しない。
 * @security Secret、任意実行Path、任意CLI引数を技術Catalogへ含めない。
 */
export { PROVIDER_AUTHENTICATION_POLICIES } from "./authentication/policy.ts";
export { evaluateProviderAuthentication } from "./authentication/result.ts";
export type { ProviderAuthenticationResult } from "./authentication/result.ts";
export { convertProviderError } from "./provider/error.ts";
export type {
  ProviderError,
  ProviderErrorReason,
} from "./provider/error.ts";
export {
  evaluateProviderAvailability,
  prepareProviderEnvironment,
} from "./provider/validation.ts";
export type {
  ProviderAvailability,
  ProviderEnvironmentResult,
} from "./provider/validation.ts";
export { validateProviderModelId } from "./provider/validation.ts";

export type { ProviderModelIdValidationResult } from "./provider/validation.ts";

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
  parseProviderResult,
  type ProviderResultInput,
  type ProviderResultReason,
  type ProviderResultParseResult,
} from "./provider/result.ts";
export { PROVIDER_ADVICE_OUTPUT_REASONS } from "./provider/result.ts";
export {
  describeProviderBillingPolicy,
  PROVIDER_BILLING_POLICY_CONTRACT,
  PROVIDER_BILLING_POLICY_CONTRACT_REVISION,
} from "./billing/policy.ts";
export type { ProviderBillingPolicy } from "./billing/policy.ts";
export {
  getAiModelCatalog,
  resolveAiModelSelection,
} from "./catalog/resolve.ts";
export type {
  AiModelCatalogSnapshot,
  AiModelSelectionResult,
} from "./catalog/resolve.ts";
export type { AiModelCatalog, AiModelDefinition } from "./catalog/types.ts";
export type {
  AiProvider,
  AiReasoningEffort,
  AiModelSelection,
  ProviderTurnCountDiagnostic,
} from "./provider/types.ts";

export { inspectTaskResultContent } from "./provider/task-result.ts";
export type { TaskReviewFinding } from "./provider/task-result.ts";
export {
  parseAdviceResult,
  describeAdviceResultSchema,
} from "./provider/advice-result.ts";
export type {
  AdviceResult,
  AdviceResultItem,
} from "./provider/advice-result.ts";
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
  CLAUDE_TASK_MAXIMUM_TURNS,
} from "./claude/plan.ts";
export {
  CLAUDE_STRUCTURED_RESULT_CONTRACT,
  CLAUDE_STRUCTURED_RESULT_CONTRACT_REVISION,
  normalizeClaudeStructuredResult,
  describeClaudeStructuredResultContract,
} from "./claude/result.ts";

export type { ProviderExecutionLocations } from "./provider/types.ts";
