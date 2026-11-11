/**
 * AI実行と任意Groupの記録・検索・集計を公開する。
 * @packageDocumentation
 * @responsibility 完成した9操作と入力・観測・結果型だけを公開し、検査や保存内部を公開しない。
 * @trace ARCH-000007
 * @trace ARCH-000018
 * @boundary 明示Storeを渡す利用側とEI。AI実行命令・認可・品質評価は提供しない。
 */
export { createExecution, completeExecution } from "./record/execution.ts";
export { createGroup, completeGroup } from "./record/group.ts";
export {
  getExecution,
  listExecutions,
  getGroup,
  listGroups,
} from "./record/query.ts";
export { summarizeExecutions } from "./record/summary.ts";
export type {
  StoreOptions,
  Execution,
  ExecutionGroup,
  ExecutionCreateInput,
  ExecutionCompleteInput,
  GroupCreateInput,
  GroupCompleteInput,
  ExecutionQuery,
  GroupQuery,
  ExecutionSummary,
  Observation,
  ReadResult,
  WriteResult,
} from "./record/types.ts";
