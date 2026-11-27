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
  objectiveCancellationSchema,
  type ObjectiveRuns,
  definitionReadFields,
  definitionWriteFields,
  type CoordinatorExecutionConfiguration,
  type CoordinatorExecutionDependencies,
  type CoordinatorExecutionOperation,
} from "./execution.ts";
/** Workspaceの実行基盤は、対象操作の受付時だけ読み込む。 @trace ARCH-000012 */
export async function prepareWorkspaceOperation(
  input: unknown,
  signal: AbortSignal,
) {
  if (signal.aborted) return null;
  const {
    executeWorkspace,
    inspectWorkspaceCommand,
    resolveLocalWorkspaceAccess,
  } = await import("./workspace.ts");
  if (signal.aborted) return null;
  const command = inspectWorkspaceCommand(input);
  return command
    ? { command, executeWorkspace, resolveLocalWorkspaceAccess }
    : null;
}
/** WorkspaceのOwnerを読み込む前に使う、通信横断の読み取り区分。 */
export function isWorkspaceRead(operation: string): boolean {
  return ["list", "get", "inspect", "candidate-diff"].includes(operation);
}
export { readAuthorizedExecutionActivity } from "./execution.ts";
export { readAuthorizedPortfolio } from "./project-context.ts";
export { resolveTopicMeetingAccess } from "./topic.ts";
