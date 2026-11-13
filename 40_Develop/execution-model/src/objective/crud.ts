/**
 * Objectiveと実行計画の完成した保存・読取り操作を提供する。
 * @responsibility 共通保存処理へ接続し、既存の排他・改訂検査・通知順序を維持する。
 * @trace ARCH-000008
 */

import {
  readExecutionContent,
  saveExecutionDefinition,
} from "../state/crud.ts";
import type { ExecutionModelAccess, StateVersion } from "../state/types.ts";
import type { ObjectivePlan, ProjectObjectiveDefinition } from "./types.ts";

/**
 * 完全な計画定義を保存する。
 * @responsibility plan.saveだけを同じWriterへ接続する。
 * @trace ARCH-000008
 * @input access: Host認可、request: 対象・元版・定義。
 * @returns 保存、競合、拒否又は未確定。
 * @precondition 明示初期化済みで対象が管理実行から参照されていない。
 * @postcondition Task完了・受入・文書更新を捏造しない。
 * @effect 既存共通保存だけ。
 * @failure 不正値・CAS差・定義差・参照中・観測不能を拒否する。
 * @invariant 自動再適用・Cascade・新取引機構を追加しない。
 * @boundary 一般定義APIと共通Writer。
 * @security 現在の内容認可を再検査する。
 * @concurrency 同じ短期排他を一回使用する。
 */
export function savePlan(
  access: ExecutionModelAccess,
  request: Readonly<
    { projectId: string; milestoneId: string; expected: StateVersion } & {
      definition: ObjectivePlan;
      expectedDefinitionHash: string | null;
    }
  >,
) {
  return saveExecutionDefinition(access, "plan.save", request);
}

/**
 * Objectiveの固定CRUDを保存する。
 * @responsibility objective.createだけを同じWriterへ接続する。
 * @trace ARCH-000008
 * @input access: Host認可、request: 対象・元版・定義。
 * @returns 保存、競合、拒否又は未確定。
 * @precondition 明示初期化済みで対象が管理実行から参照されていない。
 * @postcondition Task完了・受入・文書更新を捏造しない。
 * @effect 既存共通保存だけ。
 * @failure 不正値・CAS差・定義差・参照中・観測不能を拒否する。
 * @invariant 自動再適用・Cascade・新取引機構を追加しない。
 * @boundary 一般定義APIと共通Writer。
 * @security 現在の内容認可を再検査する。
 * @concurrency 同じ短期排他を一回使用する。
 */
export function createObjective(
  access: ExecutionModelAccess,
  request: Readonly<
    { projectId: string; milestoneId: string; expected: StateVersion } & {
      definition: ProjectObjectiveDefinition;
    }
  >,
) {
  return saveExecutionDefinition(access, "objective.create", request);
}

/**
 * Objectiveの固定CRUDを保存する。
 * @responsibility objective.updateだけを同じWriterへ接続する。
 * @trace ARCH-000008
 * @input access: Host認可、request: 対象・元版・定義。
 * @returns 保存、競合、拒否又は未確定。
 * @precondition 明示初期化済みで対象が管理実行から参照されていない。
 * @postcondition Task完了・受入・文書更新を捏造しない。
 * @effect 既存共通保存だけ。
 * @failure 不正値・CAS差・定義差・参照中・観測不能を拒否する。
 * @invariant 自動再適用・Cascade・新取引機構を追加しない。
 * @boundary 一般定義APIと共通Writer。
 * @security 現在の内容認可を再検査する。
 * @concurrency 同じ短期排他を一回使用する。
 */
export function updateObjective(
  access: ExecutionModelAccess,
  request: Readonly<
    { projectId: string; milestoneId: string; expected: StateVersion } & {
      objectiveId: string;
      definition: ProjectObjectiveDefinition;
      expectedDefinitionHash: string;
    }
  >,
) {
  return saveExecutionDefinition(access, "objective.update", request);
}

/**
 * Objectiveの固定CRUDを保存する。
 * @responsibility objective.deleteだけを同じWriterへ接続する。
 * @trace ARCH-000008
 * @input access: Host認可、request: 対象・元版・定義。
 * @returns 保存、競合、拒否又は未確定。
 * @precondition 明示初期化済みで対象が管理実行から参照されていない。
 * @postcondition Task完了・受入・文書更新を捏造しない。
 * @effect 既存共通保存だけ。
 * @failure 不正値・CAS差・定義差・参照中・観測不能を拒否する。
 * @invariant 自動再適用・Cascade・新取引機構を追加しない。
 * @boundary 一般定義APIと共通Writer。
 * @security 現在の内容認可を再検査する。
 * @concurrency 同じ短期排他を一回使用する。
 */
export function deleteObjective(
  access: ExecutionModelAccess,
  request: Readonly<
    { projectId: string; milestoneId: string; expected: StateVersion } & {
      objectiveId: string;
      expectedDefinitionHash: string;
    }
  >,
) {
  return saveExecutionDefinition(access, "objective.delete", request);
}

/**
 * 計画定義を照会する。
 * @responsibility planの有限投影だけを返す。
 * @trace ARCH-000008
 * @input access、request: Host認可と対象ID。
 * @returns 値・不存在・拒否・観測不能。
 * @precondition 既存内容権限を使用する。
 * @postcondition 値を実行又は回復Authorityにしない。
 * @effect 共通Readerの有限照会だけ。
 * @failure 現在認可・保存・排他の不明を隠さない。
 * @invariant AI・Git・Docker・自動受付を起動しない。
 * @boundary 一般QueryとDomain保存。
 * @security Snapshot全体・Host Pathを返さない。
 * @concurrency 返却前に再認可する。
 */
export function queryPlan(
  access: ExecutionModelAccess,
  request: Readonly<{ projectId: string; milestoneId: string }>,
) {
  return readExecutionContent(access, "plan", request);
}

/**
 * Objective定義を照会する。
 * @responsibility objectivesの有限投影だけを返す。
 * @trace ARCH-000008
 * @input access、request: Host認可と対象ID。
 * @returns 値・不存在・拒否・観測不能。
 * @precondition 既存内容権限を使用する。
 * @postcondition 値を実行又は回復Authorityにしない。
 * @effect 共通Readerの有限照会だけ。
 * @failure 現在認可・保存・排他の不明を隠さない。
 * @invariant AI・Git・Docker・自動受付を起動しない。
 * @boundary 一般QueryとDomain保存。
 * @security Snapshot全体・Host Pathを返さない。
 * @concurrency 返却前に再認可する。
 */
export function queryObjectives(
  access: ExecutionModelAccess,
  request: Readonly<{ projectId: string; milestoneId: string }>,
) {
  return readExecutionContent(access, "objectives", request);
}
