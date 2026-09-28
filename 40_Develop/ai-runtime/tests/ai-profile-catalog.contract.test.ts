/**
 * AI Profile Catalogの閉じたSchema、解決、利用可能性を検証する。
 *
 * @packageDocumentation
 * @responsibility 外部設定が任意実行構成や曖昧Profileを持ち込まないことを反証する。
 * @trace RCM-UT-001
 * @trace RCM-UT-002
 * @level UT
 * @scope ai-profile、adapter、model、availability
 * @boundary N/A: Process内の純粋な設定検証境界。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AI_PROFILE_CATALOG,
  createAiProfileCatalogAdministration,
  createAiProfileCatalogRegistry,
  evaluateAiProfileAvailability,
  resolveAiProfile,
  resolveAiProfileById,
  validateAiProfileCatalog,
} from "../src/index.ts";

/**
 * 既定Profileを決定論的に解決する。
 *
 * @responsibility Coordinator互換ProfileとAdapter関係の正常経路を検証する。
 * @trace RCM-UT-001
 * @precondition 既定Catalogを使用する。
 * @stimulus Codex executorとClaude reviewerの要求を解決する。
 * @observation 解決したProfile IDを観測する。
 * @oracle 同じ要求は既存の安定Profile IDへ一意に解決される。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary RCM-UT-001=Direct Boundary: ai-runtime Test Source→対象契約
 */
test("既定Catalogは既存CodexとClaude Profileを同じ結果へ解決する", () => {
  assert.ok(validateAiProfileCatalog(DEFAULT_AI_PROFILE_CATALOG));
  assert.equal(
    resolveAiProfile(DEFAULT_AI_PROFILE_CATALOG, {
      provider: "codex",
      family: "sol",
      role: "executor",
      modelTier: "preferred",
      speedMode: "normal",
      billingMode: "subscription_oauth",
    })?.profileId,
    "PROFILE-100003",
  );
  assert.equal(
    resolveAiProfile(DEFAULT_AI_PROFILE_CATALOG, {
      provider: "claude",
      family: "opus",
      role: "independent_reviewer",
      modelTier: "upper_allowed",
      speedMode: "normal",
      billingMode: "subscription_oauth",
    })?.profileId,
    "PROFILE-200002",
  );
});

/**
 * 選択済みProfile IDを同一Catalog内のexact実行設定へ解決する。
 *
 * @responsibility Workbench等が選択したProfileを別の既定値へ読み替えず、Adapter設定と結合できることを検証する。
 * @trace RCM-UT-001
 * @precondition 既定Catalogを使用する。
 * @stimulus 登録済みProfile IDと未登録Profile IDを解決する。
 * @observation Model、Providerおよび未登録時の結果を観測する。
 * @oracle 登録済みIDだけ同じCatalogのexact設定へ解決され、未登録IDはnullになる。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary RCM-UT-001=Direct Boundary: ai-runtime Test Source→対象契約
 */
test("選択済みProfile IDをexact実行設定へ解決する", () => {
  const resolved = resolveAiProfileById(
    DEFAULT_AI_PROFILE_CATALOG,
    "PROFILE-100001",
  );
  assert.equal(resolved?.provider, "codex");
  assert.equal(resolved?.adapterId, "codex-cli");
  assert.equal(resolved?.exactModelId, "gpt-5.6-sol");
  assert.equal(resolved?.defaultReasoningEffort, "medium");
  assert.equal(
    resolveAiProfileById(DEFAULT_AI_PROFILE_CATALOG, "PROFILE-999999"),
    null,
  );
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
 * @boundary RCM-UT-002=Direct Boundary: ai-runtime Test Source→対象契約
 */
test("登録Adapterの許可Modelなら追加Profileを受理し曖昧な重複を拒否する", () => {
  const added = structuredClone(DEFAULT_AI_PROFILE_CATALOG) as unknown as {
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
  assert.ok(validateAiProfileCatalog(added));
  added.profiles.push({
    ...added.profiles.at(-1),
    profileId: "PROFILE-300002",
  });
  assert.equal(validateAiProfileCatalog(added), null);
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
 * @boundary RCM-UT-002=Direct Boundary: ai-runtime Test Source→対象契約
 */
test("秘密値や任意実行Pathを未知Propertyとして拒否する", () => {
  const candidate = structuredClone(
    DEFAULT_AI_PROFILE_CATALOG,
  ) as unknown as Record<string, unknown>;
  candidate.apiKey = "secret";
  assert.equal(validateAiProfileCatalog(candidate), null);
  const adapterCandidate = structuredClone(DEFAULT_AI_PROFILE_CATALOG);
  (
    adapterCandidate.adapters[0] as unknown as Record<string, unknown>
  ).executablePath = "C:/arbitrary.exe";
  assert.equal(validateAiProfileCatalog(adapterCandidate), null);
});

/**
 * Profile利用可能性の未観測と利用不可を分ける。
 *
 * @responsibility Host、認証、Authorityの四軸を一つの真偽値へ畳まないことを検証する。
 * @trace RCM-UT-001
 * @precondition 未観測をnull、利用不可をfalseで与える。
 * @stimulus 利用可能性Projectionを生成する。
 * @observation statusとreason軸を観測する。
 * @oracle nullはunknown、falseが一つでもあればunavailableになる。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary RCM-UT-001=Direct Boundary: ai-runtime Test Source→対象契約
 */
test("利用可能性は未観測と利用不可を区別する", () => {
  assert.deepEqual(
    evaluateAiProfileAvailability({
      adapterRegistered: true,
      hostAvailable: null,
      authenticated: true,
      executionAuthorized: true,
    }),
    {
      adapterRegistered: true,
      hostAvailable: null,
      authenticated: true,
      executionAuthorized: true,
      status: "unknown",
      reasons: ["hostAvailable"],
    },
  );
  assert.equal(
    evaluateAiProfileAvailability({
      adapterRegistered: true,
      hostAvailable: true,
      authenticated: false,
      executionAuthorized: null,
    }).status,
    "unavailable",
  );
});

/**
 * Catalog採用は妥当なCandidateだけを改訂競合なしで現在値へ昇格する。
 *
 * @responsibility Candidate、採用済みSnapshot、Revisionを混同しないことを検証する。
 * @trace RCM-UT-002
 * @precondition 既定CatalogをRevision 1としてRegistryへ与える。
 * @stimulus 不正Candidate、妥当な追加Profile、古い期待Revisionを順に採用要求する。
 * @observation status、reason、revisionおよび現在Snapshotを観測する。
 * @oracle 不正と競合はEffect 0、妥当なCandidateだけがRevision 2になる。
 * @cleanup N/A: Process内の局所Registryだけを使用する。
 * @boundary RCM-UT-002=Direct Boundary: ai-runtime Test Source→対象契約
 */
test("Catalog採用は妥当なCandidateだけを改訂競合なしで現在値へ昇格する", () => {
  const registry = createAiProfileCatalogRegistry(DEFAULT_AI_PROFILE_CATALOG);
  const invalid = registry.adopt({
    expectedRevision: 1,
    candidate: { contract: "crdd/ai-profile-catalog" },
  });
  assert.equal(invalid.status, "rejected");
  assert.equal(invalid.revision, 1);

  const candidate = structuredClone(DEFAULT_AI_PROFILE_CATALOG) as unknown as {
    profiles: Record<string, unknown>[];
  } & Record<string, unknown>;
  candidate.profiles.push({
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
  const adopted = registry.adopt({ expectedRevision: 1, candidate });
  assert.equal(adopted.status, "adopted");
  assert.equal(adopted.revision, 2);
  assert.equal(
    registry.snapshot().catalog.profiles.at(-1)?.profileId,
    "PROFILE-300001",
  );

  const conflict = registry.adopt({
    expectedRevision: 1,
    candidate: DEFAULT_AI_PROFILE_CATALOG,
  });
  assert.equal(conflict.status, "rejected");
  assert.equal(conflict.reason, "revision_conflict");
  assert.equal(registry.snapshot().revision, 2);
});

/**
 * Profile限定管理がAdapter定義を変更せず作成・更新・削除を処理する。
 *
 * @responsibility Profile存在条件、Revision、削除確認およびCatalog再検証を反証する。
 * @trace RCM-UT-002
 * @precondition 既定CatalogをRevision 1で保持するRegistryをStoreとして使用する。
 * @stimulus Profile作成、古いRevision更新、更新、未確認削除、確認済み削除を順に実行する。
 * @observation 各結果理由、RevisionおよびProfile集合を観測する。
 * @oracle 成功操作だけRevisionを進め、Adapter集合を変えず、未確認削除と競合をEffect 0で拒否する。
 * @cleanup N/A: Process内の局所Registryだけを使用する。
 * @boundary RCM-UT-002=Direct Boundary: ai-runtime Test Source→対象契約
 */
test("Profile限定管理は改訂競合と未確認削除をEffect 0で拒否する", () => {
  const registry = createAiProfileCatalogRegistry(DEFAULT_AI_PROFILE_CATALOG);
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
  assert.equal(application.snapshot().revision, 2);

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
  assert.equal(application.snapshot().revision, 3);

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
    DEFAULT_AI_PROFILE_CATALOG.adapters,
  );
});
