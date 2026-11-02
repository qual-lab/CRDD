/**
 * 移管前の認証Command反例だけが使用する検証専用入口。
 * @responsibility 旧経路を製品公開APIから外し、既存の有限反例を保持する。
 * @trace ARCH-000010
 * @level UT
 * @scope scripts/tests専用。importでは実Docker・認証・保持物を操作しない。
 */
export {
  planDockerAuthenticationCommands,
  planDockerAuthenticationResourceRecovery,
  type DockerAuthenticationCommand,
  type DockerAuthenticationInput,
  type DockerAuthenticationPlan,
} from "./authentication/plan.ts";
export {
  createDockerAuthenticationRuntimeFactory,
  type DockerAuthenticationExecution,
  type DockerAuthenticationRuntime,
} from "./authentication/execute.ts";
export { cleanupDockerAuthenticationResources } from "./authentication/cleanup.ts";
