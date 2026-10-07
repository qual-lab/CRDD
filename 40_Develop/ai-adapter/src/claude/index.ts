/**
 * claudeの用途別公開入口。
 *
 * @packageDocumentation
 * @responsibility 宣言したclaude契約だけを公開し、Coordinatorの実行Authorityを所有しない。
 * @trace ARCH-000010
 * @boundary AI Adapter内の責務別公開境界。
 */
export {
  describeClaudeSubscriptionAuthenticationCli,
  isClaudeSubscriptionAuthenticationConfirmed,
} from "./authentication.ts";
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
} from "./claude-execution-plan.ts";
export {
  CLAUDE_STRUCTURED_RESULT_CONTRACT,
  CLAUDE_STRUCTURED_RESULT_CONTRACT_REVISION,
  normalizeClaudeStructuredResult,
  describeClaudeStructuredResultContract,
} from "./claude-structured-result.ts";
