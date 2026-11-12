/**
 * runtime-data:unit:contractの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility runtime-data:unit:contractが所有する検証責務を実行する。
 * @trace RDL-UT-005
 * @level UT
 * @scope runtime-data、manifest
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { inspectRepositoryManifest } from "../../../src/manifest/validation.ts";

/**
 * Repository ManifestはIdentityと宣言だけを受理するを検証する。
 *
 * @responsibility Repository ManifestはIdentityと宣言だけを受理するの合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository ManifestはIdentityと宣言だけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=Direct Boundary: runtime-data Test Source→対象契約
 */
test("Repository ManifestはIdentityと宣言だけを受理する", () => {
  const manifest = inspectRepositoryManifest({
    schema: "crdd/repository-manifest/v2",
    projectId: "qual-lab.crdd",
    repositoryId: "qual-lab.crdd-standard",
    displayName: "CRDD",
    repositoryRole: "crdd-standard",
    capabilities: ["orchestrator", "coordinator"],
    contextSurfaces: ["crdd-context"],
    externalSendPolicy: "config/external-send-policy.json",
  });
  assert.equal(manifest?.projectId, "qual-lab.crdd");
  assert.equal(manifest?.repositoryId, "qual-lab.crdd-standard");
  const capabilities = Array.from(
    { length: 129 },
    (_, index) => `capability-${index}`,
  );
  const large = {
    ...manifest,
    displayName: "表示名".repeat(161),
    capabilities,
    contextSurfaces: capabilities,
  };
  assert.equal(inspectRepositoryManifest(large)?.capabilities.length, 129);
  assert.equal(
    inspectRepositoryManifest(large)?.displayName,
    large.displayName,
  );
  assert.equal(
    inspectRepositoryManifest({
      ...large,
      capabilities: [...capabilities, capabilities[0]],
    }),
    null,
  );
  assert.equal(
    inspectRepositoryManifest({
      ...large,
      capabilities: [...capabilities, "../bad"],
    }),
    null,
  );
  assert.equal(
    inspectRepositoryManifest({ ...manifest, repositoryRoot: "C:\\secret" }),
    null,
  );
});

/**
 * Repository ManifestはProject IDとRepository IDの混同を拒否することを検証する。
 *
 * @responsibility Manifest v2のIdentity分離とv1移行境界の合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition v1、Repository ID欠落および同値Identityの入力を使用する。
 * @stimulus 各入力をinspectRepositoryManifestへ渡す。
 * @observation Manifestの受理または拒否結果を観測する。
 * @oracle v1、欠落および同値Identityをすべて拒否する。
 * @cleanup N/A: 永続資源を作成しない。
 * @boundary RDL-UT-005=Direct Boundary: runtime-data Test Source→対象契約
 */
test("Repository ManifestはProject IDとRepository IDの混同を拒否する", () => {
  const base = {
    projectId: "qual-lab.crdd",
    repositoryId: "qual-lab.crdd-standard",
    displayName: "CRDD",
    repositoryRole: "crdd-standard",
    capabilities: [],
    contextSurfaces: ["crdd-context"],
    externalSendPolicy: null,
  };
  assert.equal(
    inspectRepositoryManifest({
      ...base,
      schema: "crdd/repository-manifest/v1",
    }),
    null,
  );
  assert.equal(
    inspectRepositoryManifest({
      schema: "crdd/repository-manifest/v2",
      projectId: base.projectId,
      displayName: base.displayName,
      repositoryRole: base.repositoryRole,
      capabilities: base.capabilities,
      contextSurfaces: base.contextSurfaces,
      externalSendPolicy: base.externalSendPolicy,
    }),
    null,
  );
  assert.equal(
    inspectRepositoryManifest({
      ...base,
      schema: "crdd/repository-manifest/v2",
      repositoryId: base.projectId,
    }),
    null,
  );
});
