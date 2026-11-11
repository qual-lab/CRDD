/**
 * 活動表示用の合成実行をEI公開操作で保存する。
 * @packageDocumentation
 * @responsibility Activity IDと明示Task診断を試験入力へ結合し、実AI観測や新しい認可を生成しない。
 * @trace PPR-IT-012
 * @level IT
 * @scope Coordinator／Workbench／MCPが所有する新品Repositoryの履歴。
 * @boundary 親試験が確定したRootへだけ保存し、その親の終了hookが資源を回収する。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createExecution,
  completeExecution,
  type Execution,
} from "../../../execution-intelligence/src/index.ts";
import type { Repository } from "../../../version-control/src/index.ts";
import { getExecutionIntelligenceStore } from "../../src/execution/intelligence.ts";
/** 外部Activity契約の固定IDを、EIの不透明IDから独立に算出する。
 * @trace PPR-IT-012
 */
export function activityId(executionId: string): string {
  return `execution-${createHash("sha256").update(executionId).digest("hex")}`;
}
/** 親の新品Repositoryに合成実行と最終Task診断を保存し、拒否をfixture失敗として返す。
 * @trace PPR-IT-012
 */
export function storeFixtureExecution(
  repository: Repository,
  value: Execution,
) {
  const resolved = getExecutionIntelligenceStore(repository, true);
  assert.ok(resolved);
  // 固定日時の表示fixtureを、実行日の保持期限に依存させない。
  const store = { ...resolved, retentionDays: 36500 };
  const { state: _state, completion, ...input } = value;
  const created = createExecution(store, input);
  assert.equal(created.status, "completed", JSON.stringify(created));
  if (!completion) return created;
  const saved = completeExecution(store, value.executionId, {
    ...completion,
    diagnostic: {
      taskStatus: completion.outcome.status,
      taskReason: completion.outcome.reason ?? "fixture_task_completed",
      ...completion.diagnostic,
    },
  });
  assert.equal(saved.status, "completed", JSON.stringify(saved));
  return saved;
}
