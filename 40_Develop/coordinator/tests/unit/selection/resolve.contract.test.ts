/**
 * Repository別AI選択の閉形式と優先順位を検証する。
 * @packageDocumentation
 * @responsibility 五役割・分類・技術対応と、保存選定の閉形式・現在Catalog非依存復元を反証する。
 * @trace RCM-UT-001
 * @level UT
 * @scope selection/resolveの新規選定、selection/modelの保存値codec、AI Adapterの技術選定。
 * @boundary 同一Process内。保存・認証・外部AI・Dockerを使用しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  validateAiSelectionConfig,
  resolveExecutionSelection,
} from "../../../src/selection/resolve.ts";
import {
  inspectExecutionSelection,
  hashExecutionSelection,
} from "../../../src/selection/model.ts";

/**
 * 選定全項目を同じ決定論的Identityへ結合する。
 * @responsibility モデル名だけが一致する別選定を同じGrantとして扱わない。
 * @trace RCM-UT-001
 * @precondition Catalogで解決した選定と局所の変更値。
 * @stimulus 十項目を個別変更し、キー順変更・不正形も渡す。
 * @observation Hashの一致・不一致とnull。
 * @oracle 意味が同じキー順だけは同Hash、各項目差は別Hash。
 * @cleanup N/A: 局所値だけ。
 * @boundary Packet・Grantへ渡す非Authorityな値Identity。
 */
test("選定Hashは十項目を固定しキー順によらず内容差を区別する", () => {
  const resolved = resolveExecutionSelection(config(), {
    role: "executor",
    workType: "coding",
  });
  assert.ok(resolved.value);
  const source = { ...resolved.value, source: "explicit" as const };
  const identity = hashExecutionSelection(source);
  assert.match(identity ?? "", /^[a-f0-9]{64}$/u);
  assert.equal(
    hashExecutionSelection(
      Object.fromEntries(Object.entries(source).reverse()),
    ),
    identity,
  );
  for (const difference of [
    { provider: "codex" },
    { modelIdentifier: "historical-model" },
    { identifierKind: "exact" },
    { reasoningEffort: "max" },
    { purpose: "advice", role: "advice" },
    { catalogIdentity: "a".repeat(64) },
    { configIdentity: "b".repeat(64) },
    { role: "independent_reviewer" },
    { workType: null },
    { source: "role_default" },
  ]) {
    const changed = hashExecutionSelection({ ...source, ...difference });
    assert.ok(changed);
    assert.notEqual(changed, identity);
  }
  assert.equal(hashExecutionSelection({ ...source, authority: true }), null);
});

/**
 * 保存選定の復元と新規技術選定を分離する。
 * @responsibility 現在Catalogから除かれたModelを別Modelへ再解釈しない。
 * @trace RCM-UT-001
 * @precondition 正常な選定結果と合成の当時Identity。
 * @stimulus alias、現在未登録の識別子、旧設定Hashを保存値として戻す。
 * @observation 全十fieldの独立Snapshotと新規解決の拒否。
 * @oracle 復元は当時の値を保持するだけで、実行可否を付与しない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 保存選定codecと現在CatalogによるResolver。
 */
test("保存選定は現在Catalogで再解釈せずaliasと当時の値を保持する", () => {
  const resolved = resolveExecutionSelection(config(), {
    role: "executor",
    workType: "coding",
  });
  assert.ok(resolved.value);
  const decoded = inspectExecutionSelection(
    JSON.parse(JSON.stringify(resolved.value)),
  );
  assert.deepEqual({ ...decoded }, { ...resolved.value });
  assert.equal(decoded?.identifierKind, "alias");
  assert.equal(decoded?.modelIdentifier, "opus");
  assert.ok(Object.isFrozen(decoded));
  const historical = {
    ...resolved.value,
    modelIdentifier: "retired-model",
    reasoningEffort: "max",
    catalogIdentity: "a".repeat(64),
    configIdentity: "b".repeat(64),
  };
  const snapshot = inspectExecutionSelection(historical);
  assert.ok(snapshot);
  assert.equal(snapshot.modelIdentifier, "retired-model");
  assert.equal(snapshot.reasoningEffort, "max");
  assert.equal(snapshot.catalogIdentity, "a".repeat(64));
  historical.modelIdentifier = "changed-later";
  assert.equal(snapshot.modelIdentifier, "retired-model");
  const fresh = resolveExecutionSelection(config(), {
    role: "executor",
    workType: "coding",
    choice: { provider: "claude", model: "retired-model", effort: "max" },
  });
  assert.equal(fresh.status, "blocked");
  const nullPrototype = Object.assign(Object.create(null), snapshot);
  assert.deepEqual(inspectExecutionSelection(nullPrototype), snapshot);
});

/**
 * 保存codecの閉形式と相関違反を反証する。
 * @responsibility Authority・旧Profile・暗黙変換を選定値へ混入させない。
 * @trace RCM-UT-001
 * @precondition 有効な選定値。
 * @stimulus 欠測・過剰・未知・Getter／Proxy・暗黙文字列変換・役割用途矛盾を渡す。
 * @observation nullとhook実行0。
 * @oracle 不正値は実行可能な代替へ補完されない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 未信頼保存値と純粋なcodec。
 */
test("保存選定の不足・過剰・相関不正はhookを実行せず拒否する", () => {
  const resolved = resolveExecutionSelection(config(), {
    role: "executor",
    workType: "coding",
  });
  assert.ok(resolved.value);
  const value = resolved.value;
  let hooks = 0;
  const omitted = { ...value } as Record<string, unknown>;
  delete omitted.catalogIdentity;
  const hidden = { ...value };
  Object.defineProperty(hidden, "modelIdentifier", {
    value: "opus",
    enumerable: false,
  });
  for (const invalid of [
    null,
    [],
    omitted,
    hidden,
    { ...value, profileId: "PROFILE-100001" },
    { ...value, authority: {} },
    { ...value, provider: "other" },
    { ...value, identifierKind: "resolved" },
    { ...value, modelIdentifier: "" },
    { ...value, modelIdentifier: "bad\nvalue" },
    { ...value, reasoningEffort: "extreme" },
    { ...value, catalogIdentity: "A".repeat(64) },
    { ...value, configIdentity: "" },
    { ...value, role: "unknown" },
    { ...value, purpose: "advice" },
    { ...value, source: "fallback" },
    { ...value, source: "work_type_override", workType: null },
    { ...value, workType: "bad type" },
    {
      ...value,
      source: {
        toString() {
          hooks++;
          return "explicit";
        },
      },
    },
    {
      ...value,
      get modelIdentifier() {
        hooks++;
        return "opus";
      },
    },
    Object.create(value),
    new Proxy(value, {
      ownKeys() {
        hooks++;
        return [];
      },
      getPrototypeOf() {
        hooks++;
        return null;
      },
    }),
    { ...value, [Symbol("extra")]: true },
  ])
    assert.equal(inspectExecutionSelection(invalid), null);
  assert.equal(hooks, 0);
  for (const role of ["coordinator", "advice", "result_integration"] as const) {
    const current = resolveExecutionSelection(config(), {
      role,
      workType: null,
    });
    assert.ok(current.value);
    assert.ok(inspectExecutionSelection(current.value));
    assert.equal(
      inspectExecutionSelection({ ...current.value, purpose: "task" }),
      null,
    );
  }
});

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
