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

import defaultCatalogData from "../../../src/catalog/default-catalog.json" with {
  type: "json",
};

import { defaultAiProfileCatalog } from "../../../src/catalog/resolve.ts";
import {
  validateAiModelCatalog,
  validateAiProfileCatalog,
  validateAiProfileDefinition,
} from "../../../src/catalog/validation.ts";
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
  assert.equal(validateAiModelCatalog(defaultCatalogData).status, "blocked");
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

/**
 * Profile構造の取得で実行可能なPropertyを評価しない。
 *
 * @responsibility 共通Validatorが未信頼Profileを所有済み値へ固定することを確認する。
 * @trace RCM-UT-002
 * @precondition 既定Profileの独立複製とProxy／accessorを用意する。
 * @stimulus 正常、Proxy、accessor、未知fieldを検査し取得後に元配列を変更する。
 * @observation hook回数、検査結果と所有済み配列を観測する。
 * @oracle 不正値はnull、hook0、正常値は元入力の変更を受けない。
 * @cleanup N/A: 局所値だけを使用する。
 * @boundary 未信頼ProfileとAI Adapterの構造契約。
 */
test("Profile構造検査はProxyとaccessorを実行せず値を所有する", () => {
  const profile = structuredClone(defaultAiProfileCatalog.profiles[0]);
  assert.ok(profile);
  let hooks = 0;
  const proxy = new Proxy(profile, {
    ownKeys: () => {
      hooks += 1;
      return Reflect.ownKeys(profile);
    },
  });
  assert.equal(validateAiProfileDefinition(proxy).value, null);
  const accessor = { ...profile };
  Object.defineProperty(accessor, "family", {
    enumerable: true,
    get: () => {
      hooks += 1;
      return "executed";
    },
  });
  assert.equal(validateAiProfileDefinition(accessor).value, null);
  assert.equal(
    validateAiProfileDefinition({ ...profile, command: "forbidden" }).value,
    null,
  );
  assert.equal(hooks, 0);
  const owned = validateAiProfileDefinition(profile).value;
  assert.ok(owned);
  const roles = [...owned.selectionRoles];
  (profile.selectionRoles as string[]).push("later-change");
  assert.deepEqual(owned.selectionRoles, roles);
  assert.equal(Object.isFrozen(owned), true);
  assert.equal(Object.isFrozen(owned.selectionRoles), true);
});

/**
 * 同梱設定と同じSchemaで不正なProfile関係を拒否する。
 *
 * @responsibility 未登録Model、重複Identityおよび未知項目を初期設定でも許容しないことを検証する。
 * @trace RCM-UT-002
 * @precondition 同梱JSONを各反証用に独立複製する。
 * @stimulus Model参照、Profile IdentityおよびSchema項目を破損する。
 * @observation 各候補の検証結果を観測する。
 * @oracle 全候補がnullで拒否され、元の公開Catalogは変更されない。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary N/A: 同一Process内の設定検証である。
 */
test("初期設定の未登録Model・重複Profile・未知項目を拒否する", () => {
  const unknownModel = structuredClone(defaultCatalogData);
  const unknownModelProfile = unknownModel.profiles[0];
  assert.ok(unknownModelProfile);
  unknownModelProfile.exactModelId = "unregistered-model";
  assert.equal(validateAiProfileCatalog(unknownModel).value, null);
  const duplicate = structuredClone(defaultCatalogData);
  const duplicateProfile = duplicate.profiles[0];
  assert.ok(duplicateProfile);
  duplicate.profiles.push(structuredClone(duplicateProfile));
  assert.equal(validateAiProfileCatalog(duplicate).value, null);
  const unknownField = structuredClone(defaultCatalogData) as Record<
    string,
    unknown
  >;
  unknownField.executable = "unregistered-command";
  assert.equal(validateAiProfileCatalog(unknownField).value, null);
  assert.deepEqual(defaultAiProfileCatalog, defaultCatalogData);
});

/**
 * 許可Modelの追加と曖昧Profileの拒否を検証する。
 *
 * @responsibility コード改修なしのProfile追加と一意解決条件を同時に反証する。
 * @trace RCM-UT-002
 * @precondition Codex Adapterがgpt-6-astraを許可している。
 * @stimulus 新Familyを追加後、同じ解決Keyを持つ二件目を追加する。
 * @observation Catalogの受理または拒否を観測する。
 * @oracle 一意な追加は受理し、曖昧な追加はEffect 0で拒否する。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary RCM-UT-002=Direct Boundary: AI Adapter Test Source→対象契約
 */
test("登録Adapterの許可Modelなら追加Profileを受理し曖昧な重複を拒否する", () => {
  const added = structuredClone(defaultAiProfileCatalog) as unknown as {
    profiles: Record<string, unknown>[];
  } & Record<string, unknown>;
  added.profiles.push({
    profileId: "PROFILE-300001",
    adapterId: "codex-cli",
    family: "astra",
    exactModelId: "gpt-6-astra",
    selectionRoles: ["executor"],
    modelTiers: ["preferred"],
    speedMode: "normal",
    billingMode: "subscription_oauth",
    defaultReasoningEffort: "high",
    compatibilityReason: null,
  });
  assert.ok(validateAiProfileCatalog(added).value);
  added.profiles.push({
    ...added.profiles.at(-1),
    profileId: "PROFILE-300002",
  });
  assert.equal(validateAiProfileCatalog(added).value, null);
});

/**
 * Profile設定への秘密値と任意実行Path混入を拒否する。
 *
 * @responsibility 外部設定がCredentialまたは任意実行入口へ拡張されないことを検証する。
 * @trace RCM-UT-002
 * @precondition 正常な既定Catalogを複製する。
 * @stimulus API KeyまたはexecutablePathを未知Propertyとして追加する。
 * @observation Catalog検証結果を観測する。
 * @oracle 両候補を理由境界上で拒否し、未知Propertyを無視しない。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary RCM-UT-002=Direct Boundary: AI Adapter Test Source→対象契約
 */
test("秘密値や任意実行Pathを未知Propertyとして拒否する", () => {
  const candidate = structuredClone(
    defaultAiProfileCatalog,
  ) as unknown as Record<string, unknown>;
  candidate.apiKey = "secret";
  assert.equal(validateAiProfileCatalog(candidate).value, null);
  const adapterCandidate = structuredClone(defaultAiProfileCatalog);
  (
    adapterCandidate.adapters[0] as unknown as Record<string, unknown>
  ).executablePath = "C:/arbitrary.exe";
  assert.equal(validateAiProfileCatalog(adapterCandidate).value, null);
});
