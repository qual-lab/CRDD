/**
 * Repository別AI選択の閉形式と優先順位を検証する。
 * @packageDocumentation
 * @responsibility 五役割・任意分類・技術対応・不変Identityを純粋入力で反証する。
 * @trace RCM-UT-001
 * @level UT
 * @scope selection/resolveとAI Adapterの技術選定。
 * @boundary 同一Process内。保存・認証・外部AI・Dockerを使用しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  validateAiSelectionConfig,
  resolveExecutionSelection,
} from "../../../src/selection/resolve.ts";

/**
 * 実Model採用を行わず、現在技術カタログ内の組で合成設定を作る。
 * @responsibility 五役割の選択値と二つの分類を独立生成する。
 * @trace RCM-UT-001
 * @precondition 試験専用の値であり本体設定へ保存しない。
 * @stimulus 各Caseが必要な変更を加える。
 * @observation 検証・解決の値結果。
 * @oracle 既定値は検証済み技術用途と一致する。
 * @cleanup N/A: 局所値のみ。
 * @boundary 合成設定と選択処理。
 */
function config() {
  const advice = { provider: "codex", model: "gpt-5.6-sol", effort: "medium" };
  const task = { provider: "codex", model: "gpt-5.5", effort: "medium" };
  return {
    contract: "crdd/ai-selection",
    revision: 1,
    roleDefaults: {
      coordinator: { ...advice },
      executor: { ...task },
      independent_reviewer: { ...task },
      result_integration: { ...advice },
      advice: { ...advice },
    },
    workTypes: {
      coding: { label: "コード" },
      "3d_modeling": { label: "3Dモデル" },
      constructor: { label: "任意の分類" },
    },
    overrides: {
      executor: {
        coding: { provider: "claude", model: "opus", effort: "high" },
      },
    },
  };
}

/**
 * 選定優先順位と五役割の用途を固定する。
 * @responsibility 明示指定、分類上書き、役割既定値が混在しないことを検証する。
 * @trace RCM-UT-001
 * @precondition 有効な合成設定。
 * @stimulus 五役割と上書き・明示選択を渡す。
 * @observation Model、Effort、用途、alias、選定元、内容Identity。
 * @oracle 指定順を保持しAuthorityを生成しない。
 * @cleanup N/A: 値処理のみ。
 * @boundary Coordinator方針と技術Catalog。
 */
test("五役割は明示指定・分類上書き・既定値の順で固定する", () => {
  const source = config();
  for (const role of Object.keys(source.roleDefaults)) {
    const result = resolveExecutionSelection(source, {
      role,
      workType: "3d_modeling",
    });
    assert.equal(result.status, "resolved");
    if (result.status !== "resolved") assert.fail("selection required");
    assert.equal(result.value.source, "role_default");
    assert.equal(
      result.value.purpose,
      ["executor", "independent_reviewer"].includes(role) ? "task" : "advice",
    );
    assert.equal(result.value.reasoningEffort, "medium");
    assert.match(result.value.configIdentity, /^[a-f0-9]{64}$/u);
    assert.match(result.value.catalogIdentity, /^[a-f0-9]{64}$/u);
    assert.ok(Object.isFrozen(result.value));
    assert.equal("authority" in result.value, false);
  }
  const override = resolveExecutionSelection(source, {
    role: "executor",
    workType: "coding",
  });
  assert.equal(override.value?.source, "work_type_override");
  assert.equal(override.value?.modelIdentifier, "opus");
  assert.equal(override.value?.identifierKind, "alias");
  const explicit = resolveExecutionSelection(source, {
    role: "executor",
    workType: "coding",
    choice: { provider: "codex", model: "gpt-5.5", effort: "low" },
  });
  assert.equal(explicit.value?.source, "explicit");
  assert.equal(explicit.value?.modelIdentifier, "gpt-5.5");
  assert.equal(explicit.value?.reasoningEffort, "low");
  assert.equal(
    resolveExecutionSelection(source, {
      role: "executor",
      workType: "constructor",
    }).value?.source,
    "role_default",
  );
  assert.equal(
    resolveExecutionSelection(source, { role: "advice", workType: null }).value
      ?.workType,
    null,
  );
  source.roleDefaults.executor.model = "changed";
  assert.equal(explicit.value?.modelIdentifier, "gpt-5.5");
});

/**
 * 未知設定や不正な明示指定をfallbackせず拒否する。
 * @responsibility 設定全体・参照・役割・技術用途とEffortを検証する。
 * @trace RCM-UT-001
 * @precondition 合成設定と独立した負対照。
 * @stimulus 欠落、旧Profile、未知分類、非対応Model／Effort、明示undefinedを渡す。
 * @observation blockedと値なし。
 * @oracle 明示指定の不正を下位の既定値で隠さない。
 * @cleanup N/A: 外部資源なし。
 * @boundary 新設定と実行選定。
 */
test("未知・欠落・技術不対応と分類参照欠落を補完しない", () => {
  const source = config();
  for (const request of [
    { role: "unknown", workType: null },
    {
      role: "executor",
      workType: "unknown",
      choice: { provider: "codex", model: "gpt-5.5", effort: "medium" },
    },
    { role: "executor", workType: null, choice: undefined },
    {
      role: "executor",
      workType: null,
      choice: { provider: "codex", model: "gpt-5.6-sol", effort: "medium" },
    },
    {
      role: "executor",
      workType: null,
      choice: { provider: "codex", model: "gpt-5.5", effort: "xhigh" },
    },
    { role: "executor", workType: null, extra: true },
  ]) {
    const result = resolveExecutionSelection(source, request);
    assert.equal(result.status, "blocked");
    assert.equal(result.value, null);
  }
  for (const candidate of [
    null,
    { contract: "crdd/ai-profile-catalog" },
    { ...source, extra: true },
    {
      ...source,
      roleDefaults: {
        ...source.roleDefaults,
        developer: source.roleDefaults.advice,
      },
    },
    { ...source, overrides: { unknown: {} } },
    { ...source, workTypes: {} },
    {
      ...source,
      roleDefaults: {
        ...source.roleDefaults,
        executor: source.roleDefaults.advice,
      },
    },
  ])
    assert.equal(validateAiSelectionConfig(candidate).status, "blocked");
});

/**
 * 入力の実行可能Propertyと元入力変更を選定へ持ち込まない。
 * @responsibility 深い不変化、キー順正規化、任意分類を検証する。
 * @trace RCM-UT-001
 * @precondition 合成設定、Getter・Proxy、長い表示名と多数分類。
 * @stimulus キー順・元入力・不正Propertyを変更する。
 * @observation Identity、返却Snapshot、hook回数。
 * @oracle キー順だけでIdentityは変わらずhook0、独自件数・表示名長制限なし。
 * @cleanup N/A: 外部資源なし。
 * @boundary 未信頼Objectと不変設定。
 */
test("設定はキー順を正規化し入力から独立して固定する", () => {
  const source = config();
  const first = validateAiSelectionConfig(source);
  const reordered = {
    ...source,
    workTypes: Object.fromEntries(Object.entries(source.workTypes).reverse()),
  };
  assert.equal(
    validateAiSelectionConfig(reordered).value?.identity,
    first.value?.identity,
  );
  source.workTypes.coding.label = "変更";
  assert.equal(first.value?.config.workTypes.coding?.label, "コード");
  const many = {
    ...config(),
    workTypes: {
      ...config().workTypes,
      ...Object.fromEntries(
        Array.from({ length: 1001 }, (_, i) => [
          `custom_${i}`,
          { label: "日".repeat(1001) },
        ]),
      ),
    },
  };
  assert.equal(validateAiSelectionConfig(many).status, "valid");
  let hooks = 0;
  const getter = config();
  Object.defineProperty(getter.workTypes, "coding", {
    enumerable: true,
    get() {
      hooks++;
      return { label: "不正" };
    },
  });
  const proxy = new Proxy(config().workTypes, {
    ownKeys() {
      hooks++;
      return ["coding"];
    },
  });
  assert.equal(validateAiSelectionConfig(getter).status, "blocked");
  assert.equal(
    validateAiSelectionConfig({ ...config(), workTypes: proxy }).status,
    "blocked",
  );
  assert.equal(hooks, 0);
});
