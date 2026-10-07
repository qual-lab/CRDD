/**
 * codexの用途別公開入口。
 *
 * @packageDocumentation
 * @responsibility 宣言したcodex契約だけを公開し、Coordinatorの実行Authorityを所有しない。
 * @trace ARCH-000010
 * @boundary AI Adapter内の責務別公開境界。
 */
export {
  CODEX_FORBIDDEN_ENVIRONMENT_NAMES,
  CODEX_EXECUTION_PLAN_CONTRACT,
  CODEX_EXECUTION_PLAN_CONTRACT_REVISION,
  planCodexReadOnlyProbe,
  planCodexIsolatedTask,
  describeCodexExecutionPlanContract,
} from "./codex-execution-plan.ts";
export { describeCodexSubscriptionAuthenticationCli } from "./authentication.ts";
export {
  CODEX_STRUCTURED_RESULT_CONTRACT,
  CODEX_STRUCTURED_RESULT_CONTRACT_REVISION,
  normalizeCodexStructuredResult,
  describeCodexStructuredResultContract,
} from "./codex-structured-result.ts";
export {
  describeCodexAdviceDistributionIdentity,
  codexAdviceProviderInitRequired,
} from "./codex-advice-distribution.ts";
