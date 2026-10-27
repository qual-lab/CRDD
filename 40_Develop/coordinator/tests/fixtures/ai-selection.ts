/**
 * 保存・実行契約試験が共有する合成AI選択値を構築する。
 * @responsibility 技術Catalog内の値だけから新形式の不変選定を作る。
 * @trace RCM-UT-001
 * @boundary 試験用の純粋値。設定保存・認証・AI・Dockerを呼ばない。
 */
import {
  resolveExecutionSelection,
  resolveTaskExecutionSelections,
} from "../../src/selection/resolve.ts";
import type {
  AiSelectionRole,
  AiSelectionChoice,
} from "../../../domain-model/src/index.ts";

/**
 * 五役割と分類の試験専用設定を返す。
 * @responsibility 既存Profile IDからの互換変換を作らない。
 * @trace RCM-UT-001
 * @precondition 本体設定へ保存しない。
 * @stimulus 新形式のcodec・保存・選定試験。
 * @observation 技術Catalogに対応した新しい値。
 * @oracle 役割別の希望と技術用途が一致する。
 * @cleanup N/A: 局所値だけ。
 * @boundary 合成設定。
 */
export function selectionConfig() {
  const advice = {
    provider: "codex",
    model: "gpt-5.6-sol",
    effort: "medium",
  } as const;
  const executor = {
    provider: "codex",
    model: "gpt-5.5",
    effort: "medium",
  } as const;
  const reviewer = {
    provider: "claude",
    model: "opus",
    effort: "high",
  } as const;
  return {
    contract: "crdd/ai-selection",
    revision: 1,
    roleDefaults: {
      coordinator: advice,
      executor,
      independent_reviewer: reviewer,
      result_integration: advice,
      advice,
    },
    workTypes: { coding: { label: "コード" } },
    overrides: {},
  };
}

/**
 * 指定した役割の合成選定を生成する。
 * @responsibility 保存fixtureへ完全な十項目を渡す。
 * @trace RCM-UT-001
 * @precondition choiceを指定する場合は既存技術Catalogの値。
 * @stimulus codec・Writer・実行相関試験。
 * @observation 不変の選定結果。
 * @oracle 不正fixtureは例外で試験を止める。
 * @cleanup N/A: 純粋な値。
 * @boundary 合成選定と試験入力。
 */
export function executionSelection(
  role: AiSelectionRole = "executor",
  choice?: AiSelectionChoice,
) {
  const result = resolveExecutionSelection(selectionConfig(), {
    role,
    workType: null,
    ...(choice ? { choice } : {}),
  });
  if (!result.value) throw Error("fixture_execution_selection_invalid");
  return result.value;
}

/**
 * 一つの設定に属する二役割を合成する。
 * @responsibility Project状態とOperation fixtureの選定相関を揃える。
 * @trace RCM-UT-001
 * @precondition 設定は同じ純粋生成器から作る。
 * @stimulus 二役割を必要とする保存・進行試験。
 * @observation 不変の選定組。
 * @oracle 片方の欠測や相関不正なら試験を停止する。
 * @cleanup N/A: 純粋な値。
 * @boundary 合成状態と実行fixture。
 */
export function taskExecutionSelections(
  executor: "codex" | "claude" = "codex",
) {
  const config = selectionConfig();
  const selectedConfig =
    executor === "codex"
      ? config
      : {
          ...config,
          roleDefaults: {
            ...config.roleDefaults,
            executor: { provider: "claude", model: "opus", effort: "high" },
            independent_reviewer: {
              provider: "codex",
              model: "gpt-5.5",
              effort: "medium",
            },
          },
        };
  const result = resolveTaskExecutionSelections(selectedConfig, {
    workType: null,
  });
  if (!result.value) throw Error("fixture_task_selections_invalid");
  return result.value;
}
