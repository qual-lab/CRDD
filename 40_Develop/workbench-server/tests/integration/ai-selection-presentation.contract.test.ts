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
import { selectionConfig } from "../../../coordinator/tests/fixtures/ai-selection.ts";
import {
  inspectWorkbenchSelectionSnapshot,
  inspectWorkbenchSelectionRead,
  inspectWorkbenchSelectionResult,
} from "../../src/shared/view/validation.ts";

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
  assert.equal(inspectWorkbenchSelectionSnapshot(valid), valid);
  for (const value of [
    { ...valid, root: "/hidden" },
    { ...valid, identity: "" },
    { revision: 0, catalog: {} },
    { ...valid, config: { ...valid.config, roleDefaults: {} } },
    { ...valid, config: { ...valid.config, overrides: { unknown: {} } } },
  ])
    assert.throws(() => inspectWorkbenchSelectionSnapshot(value));
  assert.equal(
    inspectWorkbenchSelectionRead({
      status: "missing",
      reason: "ai_selection_not_configured",
      snapshot: null,
    }).status,
    "missing",
  );
  assert.equal(
    inspectWorkbenchSelectionRead({
      status: "blocked",
      reason: "ai_selection_read_unconfirmed",
      snapshot: null,
    }).status,
    "blocked",
  );
  assert.throws(() =>
    inspectWorkbenchSelectionRead({
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
 * @boundary 設定POSTと表示。
 */
test("AI設定保存結果は送信内容へ相関し競合・不明を維持する", () => {
  const config = selectionConfig();
  const form = new URLSearchParams({
    expectedIdentity: "",
    config: JSON.stringify(config),
  });
  const result = {
    status: "saved",
    reason: null,
    snapshot: { config, identity: "a".repeat(64) },
  };
  assert.equal(inspectWorkbenchSelectionResult(form, result).status, "saved");
  assert.throws(() =>
    inspectWorkbenchSelectionResult(form, { ...result, reason: "unknown" }),
  );
  const different = structuredClone(config);
  different.workTypes.coding.label = "別";
  assert.throws(() =>
    inspectWorkbenchSelectionResult(form, {
      ...result,
      snapshot: { ...result.snapshot, config: different },
    }),
  );
  assert.equal(
    inspectWorkbenchSelectionResult(form, {
      status: "conflict",
      reason: "ai_selection_identity_conflict",
      snapshot: null,
    }).status,
    "conflict",
  );
  assert.equal(
    inspectWorkbenchSelectionResult(form, {
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
