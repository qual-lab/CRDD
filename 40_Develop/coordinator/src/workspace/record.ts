/**
 * Workspaceの結果保存へ渡すRepository・Project・Queueの結合情報を定義する。
 * @responsibility 上位の保存要求に必要な値契約を所有し、保存やGit操作を発行しない。
 * @trace ARCH-000005
 */

import {
  inspectWorkspaceResult,
  type WorkspaceResult,
} from "../../../execution-model/src/index.ts";
import { snapshotPlainArray, snapshotPlainRecord } from "../input/snapshot.ts";
import type { PortResult } from "../state/result.ts";
import { validIdentity } from "../state/validation.ts";
/**
 * Taskに結合したWorkspace観測を公開用の閉じた値へ写す。
 * @responsibility 試行相関・対象一致・欠測と観測不能を維持する。
 * @trace ARCH-000004
 * @input raw: 観測配列、expectedWorkspaceId: 要求対象（省略時も配列内の対象一致を検査）。
 * @returns 凍結した観測配列。不正又は重複はnull。
 * @precondition N/A: 外部由来のunknownを受ける。
 * @postcondition 元値の後続変更を公開結果へ搬送しない。
 * @effect N/A: 値検査と複製だけ。
 * @failure getter・Proxy・別対象・不明を空配列へ変換しない。
 * @invariant 変更観測は採用・Commit・Mergeの完了ではない。
 * @boundary Coordinator結果とWorkbench／MCPの公開投影。
 * @security 本文・絶対Path・Authorityを追加しない。
 * @concurrency 同期処理で共有状態を持たない。
 */
export function inspectCoordinatorWorkspaceResults(
  raw: unknown,
  expectedWorkspaceId?: string | null,
):
  | readonly Readonly<{
      taskId: string;
      attemptId: string;
      operationId: string;
      result: WorkspaceResult;
    }>[]
  | null {
  const array = snapshotPlainArray(raw, Number.MAX_SAFE_INTEGER);
  if (array.status !== "ok" || array.value.length === 0) return null;
  const entries: Readonly<{
    taskId: string;
    attemptId: string;
    operationId: string;
    result: WorkspaceResult;
  }>[] = [];
  const attempts = new Set<string>();
  const operations = new Set<string>();
  let workspaceId = expectedWorkspaceId;
  for (const value of array.value) {
    const entry = snapshotPlainRecord(
      value,
      new Set(["taskId", "attemptId", "operationId", "result"] as const),
    );
    if (
      !entry ||
      !validIdentity(entry.taskId) ||
      !validIdentity(entry.attemptId) ||
      !validIdentity(entry.operationId) ||
      attempts.has(entry.attemptId) ||
      operations.has(entry.operationId)
    )
      return null;
    const result = inspectWorkspaceResult(entry.result);
    if (
      !result ||
      (workspaceId !== undefined && result.workspaceId !== workspaceId)
    )
      return null;
    workspaceId = result.workspaceId;
    attempts.add(entry.attemptId);
    operations.add(entry.operationId);
    entries.push(
      Object.freeze({
        taskId: entry.taskId,
        attemptId: entry.attemptId,
        operationId: entry.operationId,
        result,
      }),
    );
  }
  return Object.freeze(entries);
}

/**
 * 上位の結果保存に必要なRepository／Project／Milestone／Queue結合を定義する。
 *
 * @responsibility Integration 記録 BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000005
 * @shape IntegrationRecordBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant IntegrationRecordBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: IntegrationRecordBindingの宣言は外部境界を開かない。
 * @security IntegrationRecordBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility IntegrationRecordBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type IntegrationRecordBinding = Readonly<{
  workingDirectory: string;
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string | null;
  queueId: string;
}>;

/**
 * integration-record-portで使用するCoordinator Integration 記録の値契約を定義する。
 *
 * @responsibility Coordinator Integration 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorIntegrationRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorIntegrationRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorIntegrationRecordの宣言は外部境界を開かない。
 * @security N/A: CoordinatorIntegrationRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorIntegrationRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorIntegrationRecord = Readonly<{
  kind: "integration" | "adoption";
  identity: string;
  value: unknown;
}>;

/**
 * 候補公開・採用結果を一回保存する利用側契約を定義する。
 *
 * @responsibility Coordinator Integration 記録 PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorIntegrationRecordPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorIntegrationRecordPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorIntegrationRecordPortの宣言は外部境界を開かない。
 * @security N/A: CoordinatorIntegrationRecordPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorIntegrationRecordPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorIntegrationRecordPort = Readonly<{
  write: (
    record: CoordinatorIntegrationRecord,
  ) => PortResult<Readonly<{ written: true }>>;
}>;
