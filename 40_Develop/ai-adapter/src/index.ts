/**
 * Provider差を解決した計画・結果・認証・技術Catalogの公開境界。
 *
 * @packageDocumentation
 * @responsibility 固定仕様と検査済み結果を返し、内部のParser・Schema・環境検査を公開しない。
 * @trace ARCH-000010
 * @boundary AI Adapterと利用側の技術契約。
 * @effect Module読込みで起動・送信・保存を行わない。
 * @security 実行許可・Process終了・Cleanup成立は利用側Ownerが確認する。
 */

export type {
  AiModelCatalogSnapshot as ModelCatalog,
  AiModelSelectionResult as ModelSelectionResult,
} from "./catalog/resolve.ts";

export type {
  AiProvider as Provider,
  AiReasoningEffort as ReasoningEffort,
  AiModelSelection as ModelSelection,
  ProviderTurnCountDiagnostic as TurnCountDiagnostic,
} from "./provider/types.ts";

export type {
  ProviderExecutionInput as ExecutionRequest,
  ProviderExecutionPlanResult as ExecutionPlan,
} from "./provider/plan.ts";

export type { ExecutionResult } from "./provider/result.ts";

export type { ProviderAuthenticationDefinition as AuthenticationDefinition } from "./authentication/plan.ts";

export type { ProviderBillingPolicy as BillingPolicy } from "./billing/policy.ts";

export {
  getModelCatalog,
  resolveModelSelection,
} from "./catalog/resolve.ts";

export { planExecution } from "./provider/plan.ts";

export { parseProviderResult } from "./provider/result.ts";

export { getAuthenticationDefinition } from "./authentication/plan.ts";

export { getBillingPolicy } from "./billing/policy.ts";
