/**
 * Repository別AI選択の閉形式と優先順位を検証する。
 * @packageDocumentation
 * @responsibility 五役割・分類・技術対応と、保存選定の閉形式・現在Catalog非依存復元を反証する。
 * @trace RCM-UT-001
 * @trace ERB-UT-023
 * @level UT
 * @scope Coordinatorの新規選定と実行前照合、実行モデルの保存値検査、AI Adapterの技術選定。
 * @boundary 同一Process内。保存・認証・外部AI・Dockerを使用しない。
 */
import type { ExecutionSelection } from "../../../../execution-model/src/index.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { compileFunction } from "node:vm";
import {
  getModelCatalog,
  resolveModelSelection,
} from "../../../../ai-adapter/src/index.ts";
import { validateAiSelectionConfig } from "../../../../configuration-model/src/index.ts";
import { snapshotPlainRecord } from "../../../src/lifecycle/validation.ts";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";
import { resolveTaskExecutionSelections } from "../../../src/lifecycle/selection.ts";
import { resolveFixtureExecutionSelection } from "../../fixtures/ai-selection.ts";

const catalog = getModelCatalog().catalog;

/**
 * 実行前に現在操作と技術適合だけを照合する。
 * @responsibility 実際の製品宣言で完全一致とEffect非発行を確認する。
 * @trace ERB-UT-023
 * @precondition 有限の管理・Repository観測と実Catalogを使用する。
 * @stimulus 確定済み選定一件・二件、別操作、技術不一致と照合例外を与える。
 * @observation 読取り順、拒否理由と返却field。
 * @oracle 完全一致時だけ一致を返し、技術照合の拒否後に後続を照合しない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 現在操作とAI Adapterの値照合。外部AI・Docker・保存なし。
 */
test("実行前の選定照合は現在操作と技術適合だけを確認する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/selection.ts", import.meta.url),
    "utf8",
  );
  const operationSource = fs.readFileSync(
    new URL("../../../src/lifecycle/host.ts", import.meta.url),
    "utf8",
  );
  const body = [
    sourceDeclaration(source, "preflightDelegationSelections"),
    sourceDeclaration(operationSource, "currentBinding"),
    sourceDeclaration(operationSource, "verifyRepositoryOperation"),
  ].join("\n");
  const operationId = "OP-123456";
  const reference = Object.freeze({});
  const bound = Object.freeze({
    operationId,
    repositoryRoot: "fixture-root",
    repositoryKind: "ordinary",
    logicalRepositoryIdentity: "logical",
    repositoryInstanceIdentity: "physical",
    revision: "a".repeat(40),
  });
  let binding: Readonly<{ operationId: string }> | null = bound;
  let current = bound;
  let repositoryThrows = false;
  let managementRevoked = false;
  let catalogThrows = false;
  const calls: string[] = [];
  const { preflight: invoke, verify } = compileFunction(
    `${body}\nreturn {
    preflight: preflightDelegationSelections,
    verify: verifyRepositoryOperation,
  };`,
    [
      "verifyOwnedOperationManagementCapability",
      "bindings",
      "observe",
      "resolveModelSelection",
    ],
  )(
    (value: unknown) => {
      calls.push("management");
      if (value !== reference || managementRevoked)
        throw Error("unrecognized owner");
      return { operationId };
    },
    {
      get: (value: unknown) => {
        calls.push("binding");
        return value === reference ? binding : null;
      },
    },
    (root: string) => {
      calls.push("repository");
      assert.equal(root, bound.repositoryRoot);
      if (repositoryThrows) throw Error("repository error");
      return current;
    },
    (input: { provider: string }) => {
      calls.push(input.provider);
      if (catalogThrows) throw Error("catalog error");
      return resolveModelSelection(input);
    },
  ) as {
    preflight: (
      owner: unknown,
      request: Parameters<
        typeof import("../../../src/lifecycle/selection.ts").preflightDelegationSelections
      >[1],
    ) => { status: "matched" } | { status: "blocked"; reason: string };
    verify: typeof import("../../../src/lifecycle/host.ts").verifyRepositoryOperation;
  };
  const selected = resolveTaskExecutionSelections(config(), {
    workType: "coding",
  });
  assert.equal(selected.status, "resolved");
  if (selected.status !== "resolved") return;
  const { executor, reviewer } = selected.value;
  const request = (executionSelections: readonly ExecutionSelection[]) => ({
    operationId,
    executionSelections,
  });
  const observations = ["management", "binding", "repository"];
  for (const selections of [[executor], [executor, reviewer]]) {
    calls.length = 0;
    const result = invoke(reference, request(selections));
    assert.deepEqual(result, { status: "matched" });
    assert.ok(Object.isFrozen(result));
    assert.deepEqual(calls, [
      ...observations,
      ...selections.map((selection) => selection.provider),
    ]);
  }
  const invalid = "delegation_slate_selection_invalid";
  const failed = "delegation_slate_preflight_failed";
  const reject = (
    owner: unknown,
    input: Parameters<typeof invoke>[1],
    reason: string,
    expectedCalls: string[],
  ) => {
    calls.length = 0;
    assert.deepEqual(invoke(owner, input), { status: "blocked", reason });
    assert.deepEqual(calls, expectedCalls);
  };
  for (const input of [
    { ...request([executor]), operationId: "OP-654321" },
    request([]),
    request([executor, reviewer, executor]),
  ])
    reject(reference, input, invalid, observations);
  for (const other of [null, { ...bound, operationId: "OP-654321" }]) {
    binding = other;
    reject(reference, request([executor]), invalid, ["management", "binding"]);
  }
  binding = bound;
  current = { ...bound, revision: "b".repeat(40) };
  reject(reference, request([executor]), invalid, observations);
  current = bound;
  repositoryThrows = true;
  reject(reference, request([executor]), invalid, observations);
  repositoryThrows = false;
  reject({}, request([executor]), failed, ["management"]);
  calls.length = 0;
  assert.ok(verify(reference));
  assert.deepEqual(calls, ["binding", "management", "repository"]);
  managementRevoked = true;
  calls.length = 0;
  assert.equal(verify(reference), null);
  assert.deepEqual(calls, ["binding", "management"]);
  reject(reference, request([executor]), failed, ["management"]);
  managementRevoked = false;
  const firstOnly = [...observations, executor.provider];
  const unsupported: ExecutionSelection[] = [
    { ...executor, modelIdentifier: "retired-model" },
    {
      ...executor,
      identifierKind: executor.identifierKind === "exact" ? "alias" : "exact",
    },
  ];
  for (const rejected of unsupported)
    reject(
      reference,
      request([rejected, reviewer]),
      "delegation_selection_model_unsupported",
      firstOnly,
    );
  catalogThrows = true;
  reject(reference, request([executor, reviewer]), failed, firstOnly);
});

/**
 * 二役選定は検査済み設定を共有し、役割要求と技術適合は省略しない。
 * @responsibility 設定一回と各役割の検査を、製品の選定本体で観測する。
 * @trace RCM-UT-001
 * @precondition 既存の正常設定と実際の設定・AD検査を使う。
 * @stimulus 二役要求、未知field、不正設定と元設定の途中変更を与える。
 * @observation 設定・技術検査回数、凍結結果と拒否理由。
 * @oracle 設定一回・各役割の技術照合一回、元値変更の影響なし。拒否後に次の役割を照合しない。
 * @cleanup メモリ内だけ。外部実行・保存なし。
 * @boundary 未信頼設定受付と内部二役選定。
 */
test("二役選定は設定検査を一回にし役割別の技術検査を維持する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/selection.ts", import.meta.url),
    "utf8",
  );
  const body = [
    "resolveCheckedExecutionSelection",
    "resolveCheckedTaskExecutionSelections",
    "resolveTaskExecutionSelections",
  ]
    .map((name) => stripTypeScriptTypes(sourceDeclaration(source, name)))
    .join("\n");
  let settings = 0;
  let technical = 0;
  const original = config();
  const pair = compileFunction(
    `${body}\nreturn resolveTaskExecutionSelections;`,
    [
      "validateAiSelectionConfig",
      "getModelCatalog",
      "snapshotPlainRecord",
      "resolveModelSelection",
      "ROLES",
    ],
  )(
    (value: unknown, suppliedCatalog: typeof catalog) => {
      settings += 1;
      assert.equal(suppliedCatalog, catalog);
      const checked = validateAiSelectionConfig(value, suppliedCatalog);
      original.roleDefaults.independent_reviewer.model =
        "mutated-after-capture";
      return checked;
    },
    getModelCatalog,
    snapshotPlainRecord,
    (input: Parameters<typeof resolveModelSelection>[0]) => {
      technical += 1;
      return resolveModelSelection(input);
    },
    [
      "coordinator",
      "executor",
      "independent_reviewer",
      "result_integration",
      "advice",
    ],
  ) as typeof resolveTaskExecutionSelections;
  const expected = resolveTaskExecutionSelections(config(), {
    workType: "coding",
  });
  assert.deepEqual(pair(original, { workType: "coding" }), expected);
  assert.equal(settings, 1);
  assert.equal(technical, 2);
  assert.equal(
    pair(config(), { workType: "coding", unknown: true }).status,
    "blocked",
  );
  assert.equal(settings, 1);
  assert.equal(technical, 2);
  assert.equal(pair(null, { workType: null }).status, "blocked");
  assert.equal(settings, 2);
  assert.equal(technical, 2);
  assert.deepEqual(
    pair(config(), {
      workType: null,
      choice: { provider: "codex", model: "not-in-catalog", effort: "medium" },
    }),
    {
      status: "blocked",
      value: null,
      reason: "ai_selection_choice_unsupported",
    },
  );
  assert.equal(settings, 3);
  assert.equal(technical, 3);
});

/**
 * 編集と独立レビューを同じ受付時設定へ固定する。
 * @responsibility 後の設定編集・再選定が返却済みの組へ波及しないことを反証する。
 * @trace RCM-UT-001
 * @precondition 技術対応済みの合成設定だけを利用する。
 * @stimulus 分類・明示choiceと、返却後の設定変更を与える。
 * @observation 役割、選定元、内容Identityと旧値の独立性。
 * @oracle 明示choiceは編集担当だけ、レビューは同じ設定から導き、未設定・未知分類でfallbackしない。
 * @cleanup N/A: 値だけを生成する。
 * @boundary Task受付の同期選定。
 */
test("Task選定組は同じ設定から二役割を固定し明示指定を編集担当だけへ適用する", () => {
  const source = config();
  const result = resolveTaskExecutionSelections(source, {
    workType: "coding",
    choice: { provider: "codex", model: "gpt-5.5", effort: "high" },
  });
  assert.equal(result.status, "resolved");
  assert.ok(result.value);
  const { executor, reviewer } = result.value;
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(executor), true);
  assert.equal(Object.isFrozen(reviewer), true);
  assert.equal(executor.role, "executor");
  assert.equal(executor.source, "explicit");
  assert.equal(executor.reasoningEffort, "high");
  assert.equal(reviewer.role, "independent_reviewer");
  assert.equal(reviewer.source, "role_default");
  assert.equal(reviewer.reasoningEffort, "medium");
  assert.equal(executor.configIdentity, reviewer.configIdentity);
  assert.equal(executor.catalogIdentity, reviewer.catalogIdentity);
  source.roleDefaults.independent_reviewer.model = "changed";
  assert.equal(reviewer.modelIdentifier, "gpt-5.5");
  assert.equal(
    resolveTaskExecutionSelections(source, { workType: "coding" }).status,
    "blocked",
  );
  assert.equal(
    resolveTaskExecutionSelections(config(), { workType: "unknown" }).status,
    "blocked",
  );
  assert.equal(
    resolveTaskExecutionSelections(null, { workType: null }).status,
    "blocked",
  );
});

/**
 * 移管前に固定した内容Hashを維持する。
 * @responsibility 型Owner移管によるIdentity変更やAuthority追加を拒否する。
 * @trace RCM-UT-001
 * @precondition 既存試験の十項目と既知Hashを使う。
 * @stimulus 入力Property順と過剰fieldを変える。
 * @observation Hashと拒否結果。
 * @oracle 正規順序に依存せず既存Hash一致、過剰fieldはnull。
 * @cleanup N/A: 値だけ。
 * @boundary 選定内容と非Authority Identity。
 */
test("固定選定のHashは移管前のbyteと一致する", () => {
  const selection: ExecutionSelection = {
    provider: "codex",
    modelIdentifier: "historical-model",
    identifierKind: "exact",
    reasoningEffort: "medium",
    purpose: "task",
    catalogIdentity: "a".repeat(64),
    configIdentity: "b".repeat(64),
    role: "executor",
    workType: null,
    source: "explicit",
  };
  assert.equal(
    hashExecutionSelection(selection),
    "5fa860b97b4251d54285de02ae6b0a4c25ecdf967e1d4958cc3dd91c8b06a70e",
  );
  assert.equal(
    hashExecutionSelection(
      Object.fromEntries(
        Object.entries(selection).reverse(),
      ) as ExecutionSelection,
    ),
    hashExecutionSelection(selection),
  );
  assert.equal(hashExecutionSelection(null), null);
});

import { hashExecutionSelection } from "../../../src/lifecycle/selection.ts";

/**
 * 捕捉済み選定のHash生成は受付検査を再実行しない。
 * @responsibility 固定byteと内容差を維持し二重捕捉を防ぐ。
 * @trace RCM-UT-001
 * @precondition 実Hash宣言と既存の確定選定を使用する。
 * @stimulus 正常値・nullと入力元の後続変更を与える。
 * @observation 固定Hash、検査関数の未呼出し、元値からの独立。
 * @oracle 検査を呼べば失敗する接続でも同じHashを返す。
 * @cleanup メモリ値のみ。
 * @boundary 未信頼入力受付と検査済み値のHash計算。
 */
test("捕捉済み選定のHashは受付を繰り返さず固定byteを保つ", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/selection.ts", import.meta.url),
    "utf8",
  );
  const hash = compileFunction(
    `${["orderExecutionSelection", "hashExecutionSelection"].map((name) => stripTypeScriptTypes(sourceDeclaration(source, name))).join("\n")}\nreturn hashExecutionSelection;`,
    ["createHash"],
  )(createHash) as typeof hashExecutionSelection;
  const resolved = resolveFixtureExecutionSelection(config(), {
    role: "executor",
    workType: "coding",
  });
  assert.ok(resolved.value);
  const raw = { ...resolved.value };
  const captured = resolved.value;
  const expected = hashExecutionSelection(captured);
  raw.modelIdentifier = "changed-after-intake";
  assert.equal(hash(captured), expected);
  assert.equal(hash(null), null);
});

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
  // 移管前81d9647a4の同じ合成十項目から得た固定Hash。
  assert.equal(
    hashExecutionSelection({
      provider: "codex",
      modelIdentifier: "historical-model",
      identifierKind: "exact",
      reasoningEffort: "medium",
      purpose: "task",
      catalogIdentity: "a".repeat(64),
      configIdentity: "b".repeat(64),
      role: "executor",
      workType: null,
      source: "explicit",
    }),
    "5fa860b97b4251d54285de02ae6b0a4c25ecdf967e1d4958cc3dd91c8b06a70e",
  );
  const resolved = resolveFixtureExecutionSelection(config(), {
    role: "executor",
    workType: "coding",
  });
  assert.ok(resolved.value);
  const source = { ...resolved.value, source: "explicit" as const };
  const identity = hashExecutionSelection(source);
  assert.match(identity ?? "", /^[a-f0-9]{64}$/u);
  assert.equal(
    hashExecutionSelection(
      Object.fromEntries(
        Object.entries(source).reverse(),
      ) as ExecutionSelection,
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
    const changed = hashExecutionSelection({
      ...source,
      ...difference,
    } as ExecutionSelection);
    assert.ok(changed);
    assert.notEqual(changed, identity);
  }
  assert.equal(hashExecutionSelection(null), null);
});

/** @trace RCM-UT-001 保存できる過去モデルでも、現在の新規選定に補完しない。 */
test("現在の選定は廃止済みモデルを別モデルへ補完しない", () => {
  const fresh = resolveFixtureExecutionSelection(config(), {
    role: "executor",
    workType: "coding",
    choice: { provider: "claude", model: "retired-model", effort: "max" },
  });
  assert.equal(fresh.status, "blocked");
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
    const result = resolveFixtureExecutionSelection(source, {
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
  const override = resolveFixtureExecutionSelection(source, {
    role: "executor",
    workType: "coding",
  });
  assert.equal(override.value?.source, "work_type_override");
  assert.equal(override.value?.modelIdentifier, "opus");
  assert.equal(override.value?.identifierKind, "alias");
  const explicit = resolveFixtureExecutionSelection(source, {
    role: "executor",
    workType: "coding",
    choice: { provider: "codex", model: "gpt-5.5", effort: "low" },
  });
  assert.equal(explicit.value?.source, "explicit");
  assert.equal(explicit.value?.modelIdentifier, "gpt-5.5");
  assert.equal(explicit.value?.reasoningEffort, "low");
  assert.equal(
    resolveFixtureExecutionSelection(source, {
      role: "executor",
      workType: "constructor",
    }).value?.source,
    "role_default",
  );
  assert.equal(
    resolveFixtureExecutionSelection(source, { role: "advice", workType: null })
      .value?.workType,
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
    const result = resolveFixtureExecutionSelection(source, request);
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
    assert.equal(
      validateAiSelectionConfig(candidate, catalog).status,
      "blocked",
    );
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
  const first = validateAiSelectionConfig(source, catalog);
  const reordered = {
    ...source,
    workTypes: Object.fromEntries(Object.entries(source.workTypes).reverse()),
  };
  assert.equal(
    validateAiSelectionConfig(reordered, catalog).value?.identity,
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
  assert.equal(validateAiSelectionConfig(many, catalog).status, "valid");
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
  assert.equal(validateAiSelectionConfig(getter, catalog).status, "blocked");
  assert.equal(
    validateAiSelectionConfig({ ...config(), workTypes: proxy }, catalog)
      .status,
    "blocked",
  );
  assert.equal(hooks, 0);
});
