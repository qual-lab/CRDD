/**
 * 保存正本と二つの投影の型契約を展開前の独立Oracleへ照合する。
 * @packageDocumentation
 * @responsibility 19fieldの対応、nullable・readonly・optionalと投影の差を保持する。
 * @trace PRL-UT-006
 * @level UT
 * @scope TypeScript型適合とメモリ値だけ。型負例の関数は実行しない。
 * @boundary 保存・子Process・AI・Dockerは使用しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { OperationRecord } from "../../../src/attempt/types.ts";
import type { Blocker, Decision } from "../../../src/decision/types.ts";
import type { HistoryRow } from "../../../src/history/types.ts";
import type {
  ExecutionOverview,
  ExecutionStateSnapshot,
  LeaseEvidenceEnvelope,
  LeaseKind,
  ManagedExecution,
  ProjectDefinition,
  ProjectExecutionState,
  Snapshot,
} from "../../../src/state/types.ts";
import type { ProjectQueueEntry } from "../../../src/task/types.ts";
import type {
  ResultRecord,
  WorkspaceRecord,
} from "../../../src/workspace/types.ts";

/** @trace PRL-UT-006 基準の展開形を保存移行や互換Readerに使わない型Oracleとして保持する。 */
type ExpectedOverview = Readonly<{
  schema: "crdd-execution-model/state/v4";
  revision: number;
  previous: Readonly<{ revision: number; payloadSha256: string }> | null;
  repositoryBinding: string;
  operations: readonly OperationRecord[];
  unresolvedRecoveries: readonly Readonly<{
    operationNonce: string;
    recoveryId: string;
    reason: string;
    obligations: readonly (
      | "docker_resources"
      | "host_cleanup"
      | "lease_release"
    )[];
  }>[];
}>;
type ExpectedProjection = Readonly<{
  workspaces: readonly WorkspaceRecord[];
  repositoryRootHash: string;
  repositoryBindingId: string;
  snapshotRevision: number;
  intakeEpoch: string;
  intakeBindings: readonly Readonly<{ queueId: string; epoch: string }>[];
  projects: readonly ProjectExecutionState[];
  queueEntries: readonly ProjectQueueEntry[];
  leaseEvidence: readonly LeaseEvidenceEnvelope[];
  leaseIntents: readonly Readonly<{
    projectId: string;
    queueId: string;
    kind: LeaseKind;
    ownerGeneration: string;
    ownerProcessId: number;
    recoveryId: string;
    phase:
      | "acquisition_pending"
      | "acquisition_reserved"
      | "lock_owned"
      | "release_pending"
      | "recovery_pending";
    physicalIdentity?: string | null;
  }>[];
  results: readonly ResultRecord[];
  historyPending: readonly HistoryRow[];
}> &
  Readonly<{
    schema: "crdd-execution-model/project-snapshot/v7";
    schemaRevision: 7;
    decisions: readonly Decision[];
    blockers: readonly Blocker[];
  }>;
type ExpectedStoredState = Omit<ExpectedOverview, "schema"> &
  Omit<
    ExpectedProjection,
    | "schema"
    | "schemaRevision"
    | "repositoryRootHash"
    | "snapshotRevision"
    | "repositoryBindingId"
    | "intakeEpoch"
    | "projects"
  > &
  Readonly<{
    schema: "crdd-execution-model/state/v4";
    repositoryBindingId: string | null;
    intakeEpoch: string | null;
    projects: readonly ProjectDefinition[];
    managedExecutions: readonly ManagedExecution[];
  }>;

/** @trace PRL-UT-006 optionalな余分fieldも双方向代入だけで見逃さない。 */
type SameKeys<A, B> = [
  Exclude<keyof A, keyof B>,
  Exclude<keyof B, keyof A>,
] extends [never, never]
  ? true
  : false;

const assignments: readonly [
  ExecutionStateSnapshot extends ExpectedStoredState ? true : false,
  ExpectedStoredState extends ExecutionStateSnapshot ? true : false,
  ExecutionOverview extends ExpectedOverview ? true : false,
  ExpectedOverview extends ExecutionOverview ? true : false,
  Snapshot extends ExpectedProjection ? true : false,
  ExpectedProjection extends Snapshot ? true : false,
  SameKeys<ExecutionStateSnapshot, ExpectedStoredState>,
  SameKeys<ExecutionOverview, ExpectedOverview>,
  SameKeys<Snapshot, ExpectedProjection>,
] = [true, true, true, true, true, true, true, true, true];

/**
 * 型検査でだけ実行する負例をまとめる。
 * @responsibility readonly・nullable・投影Schemaの差を型の強制変換で隠さない。
 * @trace PRL-UT-006
 * @precondition 型検査対象であり呼び出さない。
 * @stimulus 不正更新・保存値から投影への無条件代入を宣言する。
 * @observation tscの期待エラー。未発生なら型検査が失敗する。
 * @oracle 正本のnull許容と投影のnon-null、readonlyを区別する。
 * @cleanup 実行しないので共有状態・保存への変更なし。
 * @boundary コンパイラの型検査だけ。
 */
function rejectInvalidTypes(state: ExecutionStateSnapshot, view: Snapshot) {
  // @ts-expect-error 保存改訂はreadonly。
  state.revision = 1;
  // @ts-expect-error 正本の配列はreadonly。
  state.projects.push(state.projects[0]);
  if (state.previous) {
    // @ts-expect-error 元版の改訂もreadonly。
    state.previous.revision = 1;
  }
  // @ts-expect-error nullableの保存値をnon-null投影へ代入しない。
  const nonNullBinding: string = state.repositoryBindingId;
  // @ts-expect-error 投影Schemaを保存Schemaとして使わない。
  const storedSchema: ExecutionStateSnapshot["schema"] = view.schema;
  // @ts-expect-error 投影Projectは定義のみの保存Projectとは異なる。
  const managed: readonly ProjectExecutionState[] = state.projects;
  return [nonNullBinding, storedSchema, managed];
}

/** @trace PRL-UT-006 型検査の成立は前段のtscで確認し、runtimeは構成したOracleだけを照合する。 */
test("保存正本と二投影は基準の展開形へ双方向適合する", () => {
  assert.deepEqual(assignments, [
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
  ]);
  assert.equal(typeof rejectInvalidTypes, "function");
  const intent: ExecutionStateSnapshot["leaseIntents"][number] = {
    projectId: "P",
    queueId: "Q",
    kind: "project-operation",
    ownerGeneration: "G",
    ownerProcessId: 1,
    recoveryId: "R",
    phase: "acquisition_pending",
  };
  assert.equal(Object.hasOwn(intent, "physicalIdentity"), false);
  const withNull: typeof intent = { ...intent, physicalIdentity: null };
  assert.equal(withNull.physicalIdentity, null);
});
