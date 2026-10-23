/**
 * Catalog登録内容と候補解決の担当断面を検証する。
 *
 * @packageDocumentation
 * @responsibility 既存Caseを実責務のSourceへ接続し、受理・拒否条件を維持する。
 * @trace RCM-UT-002
 * @level UT
 * @scope catalog/validationの純粋契約。
 * @boundary N/A: Process内の値だけを扱い外部資源を作らない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { validateAiModelCatalog } from "../../../src/catalog/validation.ts";
import modelCatalogData from "../../../src/catalog/model-catalog.json" with {
  type: "json",
};

/**
 * 新しい技術カタログが旧Profileや実行可能Propertyを受け付けないことを確認する。
 * @responsibility 閉形式、一意性、深いSnapshotと入力分離を検証する。
 * @trace RCM-UT-002
 * @precondition 同梱JSONの独立複製を用意する。
 * @stimulus 旧形式・重複・未知field・空用途・Getter・Proxyを渡す。
 * @observation 検証結果、hook回数と元入力変更後の返却値。
 * @oracle 不正はblocked、hook0、正常値は不変かつ入力から独立する。
 * @cleanup N/A: 外部資源なし。
 * @boundary 未信頼JSON相当値と技術Catalog。
 */
test("技術カタログは新形式の一意な閉集合だけをSnapshotする", () => {
  const source = structuredClone(modelCatalogData);
  const result = validateAiModelCatalog(source);
  assert.equal(result.status, "valid");
  assert.deepEqual(result.value, source);
  const sourceModel = source.models[0];
  assert.ok(sourceModel);
  sourceModel.supportedEfforts.push("max");
  assert.deepEqual(result.value?.models[0]?.supportedEfforts, [
    "low",
    "medium",
    "high",
  ]);
  assert.equal(
    validateAiModelCatalog({
      contract: "crdd/ai-profile-catalog",
      contractRevision: 1,
      adapters: [],
      profiles: [],
    }).status,
    "blocked",
  );
  const first = modelCatalogData.models[0];
  assert.ok(first);
  for (const models of [
    [first, first],
    [{ ...first, selectionRoles: ["executor"] }],
    [{ ...first, supportedPurposes: [] }],
    [{ ...first, supportedPurposes: ["advice", "advice"] }],
    [{ ...first, supportedEfforts: ["medium", "medium"] }],
    [{ ...first, identifierKind: "auto" }],
    [{ ...first, compatibilityReason: "try_another_model" }],
  ]) {
    assert.equal(
      validateAiModelCatalog({ ...modelCatalogData, models }).status,
      "blocked",
    );
  }
  let hooks = 0;
  const getter = { ...first };
  Object.defineProperty(getter, "supportedEfforts", {
    enumerable: true,
    get() {
      hooks++;
      return first.supportedEfforts;
    },
  });
  const proxy = new Proxy(first, {
    ownKeys() {
      hooks++;
      return Reflect.ownKeys(first);
    },
  });
  for (const model of [getter, proxy])
    assert.equal(
      validateAiModelCatalog({ ...modelCatalogData, models: [model] }).status,
      "blocked",
    );
  assert.equal(hooks, 0);
});
