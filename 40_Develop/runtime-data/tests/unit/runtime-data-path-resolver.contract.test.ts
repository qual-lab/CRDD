/**
 * runtime-data:unit:path-resolverの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility runtime-data:unit:path-resolverが所有する検証責務を実行する。
 * @trace RDL-UT-005
 * @level UT
 * @scope runtime-data、windows、linux、path
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { resolveCrosRuntimeRoots } from "../../src/index.ts";

/**
 * Windows CROS Rootはpublisher/application/trust-domain順で解決するを検証する。
 *
 * @responsibility Windows CROS Rootはpublisher/application/trust-domain順で解決するの合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows CROS Rootはpublisher/application/trust-domain順で解決するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
test("Windows CROS Rootはpublisher/application/trust-domain順で解決する", () => {
  const roots = resolveCrosRuntimeRoots({
    platform: "win32",
    trustDomainId: "company-a",
    publisher: "qual-lab",
    application: "cros",
    localAppData: "C:\\Users\\example\\AppData\\Local",
  });
  assert.equal(
    roots?.state,
    "C:\\Users\\example\\AppData\\Local\\qual-lab\\cros\\company-a",
  );
});

/**
 * Linux CROS RootはXDGのconfig/state/runtimeを混在させないを検証する。
 *
 * @responsibility Linux CROS RootはXDGのconfig/state/runtimeを混在させないの合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Linux CROS RootはXDGのconfig/state/runtimeを混在させないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
test("Linux CROS RootはXDGのconfig/state/runtimeを混在させない", () => {
  const roots = resolveCrosRuntimeRoots({
    platform: "linux",
    trustDomainId: "company-a",
    publisher: "qual-lab",
    application: "cros",
    homeDirectory: "/home/example",
    xdgRuntimeDirectory: "/run/user/1000",
  });
  assert.equal(roots?.config, "/home/example/.config/qual-lab/cros/company-a");
  assert.equal(
    roots?.state,
    "/home/example/.local/state/qual-lab/cros/company-a",
  );
  assert.equal(roots?.temporary, "/run/user/1000/qual-lab/cros/company-a");
});

/**
 * 相対OS Rootと不正なTrust Domainは拒否するを検証する。
 *
 * @responsibility 相対OS Rootと不正なTrust Domainは拒否するの合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 相対OS Rootと不正なTrust Domainは拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
test("相対OS Rootと不正なTrust Domainは拒否する", () => {
  assert.equal(
    resolveCrosRuntimeRoots({
      platform: "linux",
      trustDomainId: "Company A",
      publisher: "qual-lab",
      application: "cros",
      homeDirectory: "relative",
    }),
    null,
  );
});

/**
 * Trust Policyで受理するDirectory IdentityはCROS Pathでも同じく受理するを検証する。
 *
 * @responsibility Trust Policyで受理するDirectory IdentityはCROS Pathでも同じく受理するの合否判定を所有する。
 * @trace RDL-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Trust Policyで受理するDirectory IdentityはCROS Pathでも同じく受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-UT-005=N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
 */
test("Trust Policyで受理するDirectory IdentityはCROS Pathでも同じく受理する", async () => {
  const { inspectCrosTrustPolicy } = await import("../../src/index.ts");
  for (const identity of ["company-a", "a", "a1-b2"]) {
    const policy = inspectCrosTrustPolicy({
      schema: "cros/trust-policy/v1",
      trustDomainId: identity,
      trustedRuntimePublishers: [identity],
      repositoryAdmission: "explicit-binding-only",
      maximumCapabilities: [],
      transports: [],
      allowUnsignedLocalDevelopment: false,
    });
    assert.ok(policy);
    assert.ok(
      resolveCrosRuntimeRoots({
        platform: "linux",
        trustDomainId: identity,
        publisher: identity,
        application: "cros",
        homeDirectory: "/home/example",
      }),
    );
  }
  for (const identity of [
    "org.example",
    "org_example",
    "Company-A",
    "default",
  ]) {
    assert.equal(
      inspectCrosTrustPolicy({
        schema: "cros/trust-policy/v1",
        trustDomainId: identity,
        trustedRuntimePublishers: ["qual-lab"],
        repositoryAdmission: "explicit-binding-only",
        maximumCapabilities: [],
        transports: [],
        allowUnsignedLocalDevelopment: false,
      }),
      null,
    );
  }
});
