/**
 * Profile操作と利用条件の担当断面を検証する。
 *
 * @packageDocumentation
 * @responsibility 既存Caseを実責務のSourceへ接続し、受理・拒否条件を維持する。
 * @trace RCM-UT-002
 * @level UT
 * @scope profile/crudの純粋契約。
 * @boundary N/A: Process内の値だけを扱い外部資源を作らない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { parseAiProfileCatalogMutation } from "../../../src/index.ts";
import { validateAiProfileMutationResult } from "../../../src/index.ts";

import { defaultAiProfileCatalog } from "../../../src/catalog/resolve.ts";
import { validateAiProfileCatalog } from "../../../src/catalog/validation.ts";

import { createAiProfileCatalogAdministration } from "../../../src/profile/crud.ts";

/**
 * 観測失敗と保存確定不能を管理利用側へそのまま搬送する。
 * @responsibility 読取り失敗後の採用と、保存不明後の自動再送を拒否する。
 * @trace RCM-UT-002
 * @precondition Process内のStore代役だけを使う。
 * @stimulus read失敗又はadopt確定不能を与える。
 * @observation adopt回数、状態、Snapshot欠測と結果相関を確認する。
 * @oracle read失敗ならadopt0、保存不明ならadopt1で旧Snapshotを返さない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary Profile CRUD→同期Store契約
 */
test("管理は読取り失敗と保存不明を成功又は古いSnapshotへ変換しない", () => {
  for (const failure of ["read", "save"] as const) {
    let adoptions = 0;
    const mutation = {
      operation: "delete" as const,
      expectedRevision: 0,
      profileId: "PROFILE-100001",
      confirmed: true,
    };
    const admin = createAiProfileCatalogAdministration({
      snapshot: () =>
        failure === "read"
          ? {
              status: "blocked",
              value: null,
              error: "ai_profile_catalog_read_failed",
            }
          : {
              status: "read",
              value: { revision: 0, catalog: defaultAiProfileCatalog },
              error: null,
            },
      adopt: () => {
        adoptions++;
        return {
          status: "unknown",
          reason: "ai_profile_catalog_save_unconfirmed",
          phase: "verify",
          revision: null,
          snapshot: null,
        };
      },
    });
    const result = admin.execute(mutation);
    assert.equal(result.status, "unknown");
    assert.equal(result.snapshot, null);
    assert.equal(adoptions, failure === "read" ? 0 : 1);
    const validated = validateAiProfileMutationResult(mutation, result);
    assert.equal(validated.status, "valid");
    assert.deepEqual(validated.value, result);
    assert.equal(
      validateAiProfileMutationResult(mutation, {
        ...result,
        snapshot: { revision: 0, catalog: defaultAiProfileCatalog },
      }).status,
      "blocked",
    );
  }
});
import type {
  AiProfileCatalogStore,
  AiProfileCatalogSnapshot,
} from "../../../src/index.ts";

/**
 * Profile限定Mutation入力はCatalog Ownerの公開入口で検査する。
 * @responsibility TransportやCROSにSchemaを複製せず閉じた所有値へ固定する。
 * @trace RCM-UT-002
 * @precondition 既定Profileと未信頼Mutation入力を用意する。
 * @stimulus 三操作、余分field、改訂不正、ID不正、Proxy/accessorを渡す。
 * @observation 所有済みMutation、拒否値、hook実行数。
 * @oracle 三操作の正常入力だけ受理し、不正はnull、hook0、元値の変更を受けない。
 * @cleanup N/A: I/O・Store・Providerを使用しない。
 * @boundary AI Adapterの純粋な公開入力契約。
 */
test("Profile Mutation Parserは三操作の閉じた入力だけを所有する", () => {
  const profile = structuredClone(defaultAiProfileCatalog.profiles[0]);
  assert.ok(profile);
  for (const operation of ["create", "update"] as const) {
    const input: unknown = { operation, expectedRevision: 0, profile };
    const parsed = parseAiProfileCatalogMutation(input).value;
    assert.deepEqual(parsed, input);
    assert.notEqual(parsed, input);
  }
  const deletion = {
    operation: "delete",
    expectedRevision: 1,
    profileId: profile.profileId,
    confirmed: true,
  };
  assert.deepEqual(parseAiProfileCatalogMutation(deletion).value, deletion);
  for (const raw of [
    { ...deletion, extra: true },
    { ...deletion, expectedRevision: -1 },
    { ...deletion, expectedRevision: 0.5 },
    { ...deletion, profileId: "invalid" },
    { ...deletion, confirmed: 1 },
    { operation: "create", expectedRevision: 0, profile: {} },
    { operation: "unknown", expectedRevision: 0, profile },
  ])
    assert.equal(parseAiProfileCatalogMutation(raw).value, null);
  let hooks = 0;
  const proxy = new Proxy(deletion, {
    ownKeys() {
      hooks++;
      return [];
    },
  });
  const accessor = Object.defineProperty({}, "operation", {
    get() {
      hooks++;
      return "delete";
    },
  });
  assert.equal(parseAiProfileCatalogMutation(proxy).value, null);
  assert.equal(parseAiProfileCatalogMutation(accessor).value, null);
  assert.equal(hooks, 0);
});

/**
 * Profile限定管理がAdapter定義を変更せず作成・更新・削除を処理する。
 *
 * @responsibility Profile存在条件、Revision、削除確認およびCatalog再検証を反証する。
 * @trace RCM-UT-002
 * @precondition 既定CatalogをRevision 1で保持する保存代役をStoreとして使用する。
 * @stimulus Profile作成、古いRevision更新、更新、未確認削除、確認済み削除を順に実行する。
 * @observation 各結果理由、RevisionおよびProfile集合を観測する。
 * @oracle 成功操作だけRevisionを進め、Adapter集合を変えず、未確認削除と競合をEffect 0で拒否する。
 * @cleanup N/A: Process内の局所保存代役だけを使用する。
 * @boundary RCM-UT-002=Direct Boundary: AI Adapter Test Source→対象契約
 */
test("Profile限定管理は改訂競合と未確認削除をEffect 0で拒否する", () => {
  const registry = createTestCatalogStore(defaultAiProfileCatalog);
  const application = createAiProfileCatalogAdministration(registry);
  const profile = Object.freeze({
    profileId: "PROFILE-300001",
    adapterId: "codex-cli",
    family: "astra",
    exactModelId: "gpt-6-astra",
    selectionRoles: Object.freeze(["executor"] as const),
    modelTiers: Object.freeze(["preferred"] as const),
    speedMode: "normal" as const,
    billingMode: "subscription_oauth" as const,
    defaultReasoningEffort: "high" as const,
    compatibilityReason: null,
  });
  const created = application.execute({
    operation: "create",
    expectedRevision: 1,
    profile,
  });
  assert.equal(created.status, "completed");
  assert.equal(created.reason, "profile_created");
  assert.equal(created.snapshot.revision, 2);

  const conflict = application.execute({
    operation: "update",
    expectedRevision: 1,
    profile: { ...profile, defaultReasoningEffort: "max" },
  });
  assert.equal(conflict.reason, "revision_conflict");
  assert.equal(application.snapshot().value?.revision, 2);

  const updated = application.execute({
    operation: "update",
    expectedRevision: 2,
    profile: { ...profile, defaultReasoningEffort: "max" },
  });
  assert.equal(updated.reason, "profile_updated");
  assert.equal(updated.snapshot.revision, 3);
  assert.equal(
    updated.snapshot.catalog.profiles.at(-1)?.defaultReasoningEffort,
    "max",
  );

  const unconfirmed = application.execute({
    operation: "delete",
    expectedRevision: 3,
    profileId: profile.profileId,
    confirmed: false,
  });
  assert.equal(unconfirmed.reason, "profile_delete_confirmation_required");
  assert.equal(application.snapshot().value?.revision, 3);

  const deleted = application.execute({
    operation: "delete",
    expectedRevision: 3,
    profileId: profile.profileId,
    confirmed: true,
  });
  assert.equal(deleted.reason, "profile_deleted");
  assert.equal(deleted.snapshot.revision, 4);
  assert.equal(
    deleted.snapshot.catalog.profiles.some(
      (candidate) => candidate.profileId === profile.profileId,
    ),
    false,
  );
  assert.deepEqual(
    deleted.snapshot.catalog.adapters,
    defaultAiProfileCatalog.adapters,
  );
});

/**
 * 管理操作試験用の局所Catalog保存代役を作る。
 * @responsibility 本番保存を使わず改訂競合と採用後のSnapshotを試験へ提供する。
 * @trace RCM-UT-002
 * @precondition 初期候補は既存Catalog Validatorで検証できる。
 * @stimulus snapshotとadoptを管理操作へ渡す。
 * @observation 改訂、採用値、拒否理由を返す。
 * @oracle 不正・競合は不変、妥当な採用だけ改訂を一つ進める。
 * @cleanup N/A: 試験内のメモリだけで資源を持たない。
 * @boundary 試験の保存代役であり本番の耐久保存を保証しない。
 */
function createTestCatalogStore(
  initialCandidate: unknown,
): AiProfileCatalogStore {
  const initialCatalog = validateAiProfileCatalog(initialCandidate).value;
  if (!initialCatalog) throw new Error("ai_profile_catalog_initial_invalid");
  let current: AiProfileCatalogSnapshot = Object.freeze({
    revision: 1,
    catalog: initialCatalog,
  });
  return Object.freeze({
    snapshot: () =>
      Object.freeze({ status: "read" as const, value: current, error: null }),
    adopt: (request) => {
      if (request.expectedRevision !== current.revision)
        return Object.freeze({
          status: "rejected" as const,
          reason: "revision_conflict" as const,
          revision: current.revision,
          snapshot: current,
        });
      const validated = validateAiProfileCatalog(request.candidate).value;
      if (!validated)
        return Object.freeze({
          status: "rejected" as const,
          reason: "catalog_invalid" as const,
          revision: current.revision,
          snapshot: current,
        });
      current = Object.freeze({
        revision: current.revision + 1,
        catalog: validated,
      });
      return Object.freeze({
        status: "adopted" as const,
        revision: current.revision,
        snapshot: current,
      });
    },
  });
}
