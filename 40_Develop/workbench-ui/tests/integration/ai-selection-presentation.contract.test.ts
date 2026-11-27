/**
 * Repository AI設定JSONのBrowser表示境界を検証する。
 * @packageDocumentation
 * @responsibility 閉形式・不在・拒否と保存内容相関を確認する。
 * @trace RCM-IT-005
 * @trace EST-IT-002
 * @level IT
 * @scope 設定Owner→JSON→Browser Inspector。
 * @boundary 実Browser・認可・保存の代替ではない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { AiSelectionConfig } from "@qual-lab/crdd-configuration-model";
import {
  validateAiSelectionSnapshot,
  validateAiSelectionResponse,
} from "../../src/api/response.ts";
import { inspectWorkbenchSelectionResult } from "../../src/api/ai-selection.ts";

/**
 * 表示境界へ渡す合成の通信データを用意する。
 * @trace EST-IT-002
 * @boundary 保存やCoordinatorの選定を利用しないBrowser入力。
 */
function selectionConfig() {
  const advice = {
    provider: "codex",
    model: "gpt-5.6-sol",
    effort: "medium",
  } as const;
  const task = {
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
      executor: task,
      independent_reviewer: reviewer,
      result_integration: advice,
      advice,
    },
    workTypes: { coding: { label: "コード" } },
    overrides: {},
  } satisfies AiSelectionConfig;
}

/**
 * 設定Snapshotと不正外形を分離する。
 * @responsibility 五役割・分類・Identityの描画対象を反証する。
 * @trace RCM-IT-005
 * @trace EST-IT-002
 * @precondition 純粋な合成設定。
 * @stimulus 余剰・欠測・旧形式を一項目ずつ渡す。
 * @observation 正常受理と例外。
 * @oracle 未設定や不明を補完しない。
 * @cleanup N/A: 局所JSON値だけ。
 * @boundary API JSONとBrowser表示。
 */
test("AI設定Snapshotは閉形式と未設定・拒否を区別する", () => {
  const valid = { config: selectionConfig(), identity: "a".repeat(64) };
  assert.equal(validateAiSelectionSnapshot(valid), valid);
  for (const value of [
    { ...valid, root: "/hidden" },
    { ...valid, identity: "" },
    { revision: 0, catalog: {} },
    { ...valid, config: { ...valid.config, roleDefaults: {} } },
    { ...valid, config: { ...valid.config, overrides: { unknown: {} } } },
  ])
    assert.throws(() => validateAiSelectionSnapshot(value));
  assert.equal(
    validateAiSelectionResponse({
      status: "missing",
      reason: "ai_selection_not_configured",
      snapshot: null,
    }).status,
    "missing",
  );
  assert.equal(
    validateAiSelectionResponse({
      status: "blocked",
      reason: "ai_selection_read_unconfirmed",
      snapshot: null,
    }).status,
    "blocked",
  );
  assert.throws(() =>
    validateAiSelectionResponse({
      status: "available",
      reason: null,
      snapshot: null,
    }),
  );
});

/**
 * 保存した設定と応答を対応付ける。
 * @responsibility 成功・競合・不明を別の結果として保持する。
 * @trace RCM-IT-005
 * @trace EST-IT-002
 * @precondition 一回だけ明示送信済みの合成Form。
 * @stimulus saved・conflict・unknownと別内容を渡す。
 * @observation 受理結果と固定拒否。
 * @oracle 別内容の成功を表示しない。
 * @cleanup N/A: 値検査のみ。
 * @boundary 設定PUTと表示。
 */
test("AI設定保存結果は送信内容へ相関し競合・不明を維持する", () => {
  const config = selectionConfig();
  const result = {
    status: "saved",
    reason: null,
    snapshot: { config, identity: "a".repeat(64) },
  };
  assert.equal(inspectWorkbenchSelectionResult(config, result).status, "saved");
  assert.throws(() => inspectWorkbenchSelectionResult(config, result, 409));
  const conflict = {
    status: "conflict",
    reason: "ai_selection_identity_conflict",
    snapshot: null,
  };
  assert.equal(
    inspectWorkbenchSelectionResult(config, conflict, 409).status,
    "conflict",
  );
  assert.throws(() => inspectWorkbenchSelectionResult(config, conflict, 200));
  assert.throws(() =>
    inspectWorkbenchSelectionResult(config, { ...result, reason: "unknown" }),
  );
  const different = structuredClone(config);
  different.workTypes.coding.label = "別";
  assert.throws(() =>
    inspectWorkbenchSelectionResult(config, {
      ...result,
      snapshot: { ...result.snapshot, config: different },
    }),
  );
  assert.equal(
    inspectWorkbenchSelectionResult(config, {
      status: "conflict",
      reason: "ai_selection_identity_conflict",
      snapshot: null,
    }).status,
    "conflict",
  );
  assert.equal(
    inspectWorkbenchSelectionResult(config, {
      status: "unknown",
      reason: "ai_selection_save_unconfirmed",
      snapshot: null,
      publication: "unconfirmed",
      cleanupConfirmed: false,
      recoveryId: null,
      temporary: null,
    }).status,
    "unknown",
  );
});
