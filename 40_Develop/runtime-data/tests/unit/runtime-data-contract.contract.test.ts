/**
 * runtime-data:unit:contractの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility runtime-data:unit:contractが所有する検証責務を実行する。
 * @trace RDL-UT-005
 * @level UT
 * @scope runtime-data、manifest、trust-policy
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectCrosTrustPolicy,
  inspectRepositoryManifest,
} from "../../src/index.ts";

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
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
test("Repository ManifestはIdentityと宣言だけを受理する", () => {
  const manifest = inspectRepositoryManifest({
    schema: "crdd/repository-manifest/v1",
    projectId: "qual-lab.crdd",
    displayName: "CRDD",
    repositoryRole: "crdd-standard",
    capabilities: ["project-runtime", "coordinator"],
    contextSurfaces: ["crdd-context"],
    externalSendPolicy: "config/external-send-policy.json",
  });
  assert.equal(manifest?.projectId, "qual-lab.crdd");
  assert.equal(
    inspectRepositoryManifest({ ...manifest, repositoryRoot: "C:\\secret" }),
    null,
  );
});

/**
 * Trust PolicyはTrust Domainを明示し個別Authorityを所有しないを検証する。
 *
 * @responsibility Trust PolicyはTrust Domainを明示し個別Authorityを所有しないの合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Trust PolicyはTrust Domainを明示し個別Authorityを所有しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
test("Trust PolicyはTrust Domainを明示し個別Authorityを所有しない", () => {
  const policy = inspectCrosTrustPolicy({
    schema: "cros/trust-policy/v1",
    trustDomainId: "qual-lab-local",
    trustedRuntimePublishers: ["qual-lab"],
    repositoryAdmission: "explicit-binding-only",
    maximumCapabilities: ["project-runtime", "read-projection"],
    transports: ["stdio", "local-http"],
    allowUnsignedLocalDevelopment: true,
  });
  assert.equal(policy?.trustDomainId, "qual-lab-local");
  assert.equal(
    inspectCrosTrustPolicy({ ...policy, operationAuthority: "granted" }),
    null,
  );
});

/**
 * Schemaは重複配列と暗黙default Trust Domainを拒否するを検証する。
 *
 * @responsibility Schemaは重複配列と暗黙default Trust Domainを拒否するの合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Schemaは重複配列と暗黙default Trust Domainを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
test("Schemaは重複配列と暗黙default Trust Domainを拒否する", () => {
  assert.equal(
    inspectCrosTrustPolicy({
      schema: "cros/trust-policy/v1",
      trustDomainId: "default",
      trustedRuntimePublishers: ["qual-lab", "qual-lab"],
      repositoryAdmission: "explicit-binding-only",
      maximumCapabilities: [],
      transports: [],
      allowUnsignedLocalDevelopment: false,
    }),
    null,
  );
});
