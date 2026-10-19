/**
 * Profile専用JSONのBrowser表示境界を検証する。
 * @packageDocumentation
 * @responsibility Catalog完全検査と送信操作・結果相関を確認する。
 * @trace RCM-IT-005
 * @trace EST-IT-002
 * @level IT
 * @scope Owner固定Catalog→JSON→Browser Inspector。
 * @boundary 実Browser操作・認可・保存の代替ではない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { defaultAiProfileCatalog } from "../../../ai-adapter/src/index.ts";
import {
  inspectWorkbenchProfileSnapshot,
  inspectWorkbenchProfileResult,
} from "../../src/browser/client-model.ts";

/**
 * 正規Catalogと関係不整合を表示前に区別する。
 * @responsibility 余剰field、重複Identity、未登録参照と曖昧選択を反証する。
 * @trace RCM-IT-005
 * @trace EST-IT-002
 * @precondition 既存Ownerが検査済みの非秘密Catalog。
 * @stimulus 一項目ずつSchemaと参照関係を壊す。
 * @observation Inspectorの受理・固定拒否。
 * @oracle 正規値だけを受理し、欠測を補完しない。
 * @cleanup N/A: メモリ内のJSON値のみ。
 * @boundary Owner SchemaとBrowser表示検査。
 */
test("Profile Snapshotは完全Catalogと閉Envelopeを検査する", () => {
  const valid = {
    revision: 0,
    catalog: structuredClone(defaultAiProfileCatalog),
  };
  assert.equal(inspectWorkbenchProfileSnapshot(valid).revision, 0);
  assert.throws(() =>
    inspectWorkbenchProfileSnapshot({ ...valid, root: "/hidden" }),
  );
  assert.throws(() =>
    inspectWorkbenchProfileSnapshot({ ...valid, revision: 0.5 }),
  );
  for (const kind of [
    "field",
    "adapter-id",
    "profile-id",
    "model",
    "effort",
    "origin",
    "ambiguity",
  ] as const) {
    const catalog = structuredClone(defaultAiProfileCatalog);
    const adapter = catalog.adapters[0],
      profile = catalog.profiles[0];
    assert.ok(adapter);
    assert.ok(profile);
    if (kind === "field")
      Object.assign(profile, { token: "not-a-secret-fixture" });
    if (kind === "adapter-id")
      Object.assign(catalog, { adapters: [...catalog.adapters, adapter] });
    if (kind === "profile-id")
      Object.assign(catalog, { profiles: [...catalog.profiles, profile] });
    if (kind === "model")
      Object.assign(profile, { exactModelId: "unregistered-fixture" });
    if (kind === "effort")
      Object.assign(profile, { defaultReasoningEffort: "unregistered" });
    if (kind === "origin")
      Object.assign(adapter, {
        authorityOrigin: "https://example.invalid/path",
      });
    if (kind === "ambiguity")
      Object.assign(catalog, {
        profiles: [
          ...catalog.profiles,
          { ...profile, profileId: "PROFILE-654321" },
        ],
      });
    assert.throws(
      () => inspectWorkbenchProfileSnapshot({ revision: 0, catalog }),
      kind,
    );
  }
});

/**
 * 表示する保存結果を送信した操作へ結合する。
 * @responsibility 別対象・別改訂・矛盾した成功や拒否を反証する。
 * @trace RCM-IT-005
 * @trace EST-IT-002
 * @precondition 正規Catalogの既存Profileを更新するForm。
 * @stimulus 正規更新、拒否、未知reason、相関不一致を渡す。
 * @observation 受理結果と固定拒否。
 * @oracle 送信操作と改訂・対象に合う結果だけを表示する。
 * @cleanup N/A: メモリ内検査のみ。
 * @boundary JSON結果とBrowserの操作確認。
 */
test("Profile結果は操作と改訂・対象へ相関する", () => {
  const catalog = structuredClone(defaultAiProfileCatalog);
  const profile = catalog.profiles[0];
  assert.ok(profile);
  const form = new URLSearchParams({
    operation: "update",
    expectedRevision: "0",
    profileId: profile.profileId,
    adapterModel: `${profile.adapterId}|${profile.exactModelId}`,
    family: profile.family,
    defaultReasoningEffort: profile.defaultReasoningEffort,
    compatibilityReason: "",
  });
  for (const role of profile.selectionRoles) form.append("selectionRole", role);
  for (const tier of profile.modelTiers) form.append("modelTier", tier);
  Object.assign(profile, { compatibilityReason: null });
  const result = {
    status: "completed",
    reason: "profile_updated",
    snapshot: { revision: 1, catalog },
  };
  assert.equal(inspectWorkbenchProfileResult(form, result).status, "completed");
  assert.throws(() =>
    inspectWorkbenchProfileResult(form, {
      ...result,
      reason: "profile_created",
    }),
  );
  assert.throws(() =>
    inspectWorkbenchProfileResult(form, {
      ...result,
      snapshot: { revision: 0, catalog },
    }),
  );
  const wrong = structuredClone(result);
  const wrongProfile = wrong.snapshot.catalog.profiles[0];
  assert.ok(wrongProfile);
  Object.assign(wrongProfile, {
    compatibilityReason: "different",
  });
  assert.throws(() => inspectWorkbenchProfileResult(form, wrong));
  const conflict = {
    status: "rejected",
    reason: "revision_conflict",
    snapshot: { revision: 1, catalog },
  };
  assert.equal(
    inspectWorkbenchProfileResult(form, conflict).status,
    "rejected",
  );
  assert.throws(() =>
    inspectWorkbenchProfileResult(form, { ...conflict, reason: "unknown" }),
  );
});
