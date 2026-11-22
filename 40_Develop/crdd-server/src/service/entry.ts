/**
 * HTTPとMCPが同じ意味で提供するCRDD操作の入口。
 * @responsibility 既存の機能Ownerへ直接つなぎ、通信の受付や業務規則を持たない。
 * @trace ARCH-000012
 * @boundary 通信方式別の受付から専門Ownerへの接続。
 */
export {
  validateExecutionDefinitionCommand,
  executeDefinitionOperation,
  executeCoordinatorOperation,
  definitionReadFields,
  definitionWriteFields,
  type CoordinatorExecutionConfiguration,
  type CoordinatorExecutionDependencies,
  type CoordinatorExecutionOperation,
} from "./execution.ts";
export { prepareWorkspaceOperation } from "./workspace.ts";
export { readAuthorizedRuntimeActivity } from "./execution.ts";
export { readAuthorizedPortfolio } from "./project.ts";
export { resolveTopicMeetingAccess } from "./topic.ts";
