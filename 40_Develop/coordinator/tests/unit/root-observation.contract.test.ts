/**
 * coordinator:unit:root-observationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:root-observationが所有する検証責務を実行する。
 * @trace RFD-UT-006
 * @level UT
 * @scope root、observation
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  compileWindowsRootObservationCandidate,
  describeRootObservationContract,
  inspectWindowsRootObservationCandidate,
} from "../../src/security/root-observation.ts";

/**
 * observationのTest準備責務を実行する。
 *
 * @responsibility observationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus observationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
function observation(rootRole: "runtime" | "authority" = "authority") {
  const entityCount = 3;
  return {
    allOwnersTrusted: true,
    entityCount,
    filesystemClass: "local",
    objectBirthtimeNanoseconds: "1700000000000000000",
    objectDeviceId: "1234",
    objectFileId: "5678",
    otherWriteAceCount: 0,
    reparsePointCount: 0,
    rootDaclProtected: true,
    rootRole,
    runtimeDenyAceCount: 0,
    runtimePrincipalIdentityHash: "a".repeat(64),
    runtimePrincipalBinding: "selected_local_user_binding_caller_claim",
    runtimeReadExecuteEntityCount: entityCount,
    runtimeRootInheritanceRuleCount: 1,
    runtimeWriteEntityCount: rootRole === "runtime" ? entityCount : 0,
  };
}

/**
 * Windows Root観測はIdentityと保護を別domain Hashへ固定するを検証する。
 *
 * @responsibility Windows Root観測はIdentityと保護を別domain Hashへ固定するの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows Root観測はIdentityと保護を別domain Hashへ固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("Windows Root観測はIdentityと保護を別domain Hashへ固定する", () => {
  const authority = compileWindowsRootObservationCandidate(observation());
  const runtime = compileWindowsRootObservationCandidate(
    observation("runtime"),
  );
  assert.equal(authority.status, "candidate");
  assert.equal(runtime.status, "candidate");
  assert.match(authority.rootIdentityHash ?? "", /^[0-9a-f]{64}$/u);
  assert.match(authority.rootProtectionHash ?? "", /^[0-9a-f]{64}$/u);
  assert.equal(authority.rootIdentityHash, runtime.rootIdentityHash);
  assert.notEqual(authority.rootProtectionHash, runtime.rootProtectionHash);
  assert.equal(authority.runtimeAuthorityConferred, false);
  assert.equal(authority.runtimeCapabilityIssued, false);
  assert.equal(authority.selectedUserBindingVerified, false);
  assert.equal(authority.runtimePrincipalBound, false);
  assert.equal(JSON.stringify(authority).includes("S-1-"), false);
});

/**
 * IdentityまたはRuntime主体の変更は対応するHashを変えるを検証する。
 *
 * @responsibility IdentityまたはRuntime主体の変更は対応するHashを変えるの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus IdentityまたはRuntime主体の変更は対応するHashを変えるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("IdentityまたはRuntime主体の変更は対応するHashを変える", () => {
  const baseline = compileWindowsRootObservationCandidate(observation());
  const changedIdentity = compileWindowsRootObservationCandidate({
    ...observation(),
    objectFileId: "5679",
  });
  const changedPrincipal = compileWindowsRootObservationCandidate({
    ...observation(),
    runtimePrincipalIdentityHash: "b".repeat(64),
  });
  assert.notEqual(baseline.rootIdentityHash, changedIdentity.rootIdentityHash);
  assert.equal(baseline.rootProtectionHash, changedIdentity.rootProtectionHash);
  assert.equal(baseline.rootIdentityHash, changedPrincipal.rootIdentityHash);
  assert.notEqual(
    baseline.rootProtectionHash,
    changedPrincipal.rootProtectionHash,
  );
});

/**
 * DACL、FilesystemまたはIdentity不成立をfail closedにするを検証する。
 *
 * @responsibility DACL、FilesystemまたはIdentity不成立をfail closedにするの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus DACL、FilesystemまたはIdentity不成立をfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("DACL、FilesystemまたはIdentity不成立をfail closedにする", () => {
  for (const invalid of [
    { ...observation(), rootDaclProtected: false },
    { ...observation(), allOwnersTrusted: false },
    { ...observation(), otherWriteAceCount: 1 },
    { ...observation(), runtimeWriteEntityCount: 1 },
    { ...observation(), runtimeDenyAceCount: 1 },
    { ...observation(), reparsePointCount: 1 },
    { ...observation(), filesystemClass: "network" },
    { ...observation(), objectDeviceId: "0" },
    { ...observation(), runtimePrincipalIdentityHash: "raw-sid" },
    {
      ...observation(),
      runtimePrincipalBinding: "selected_local_user_verified_candidate_input",
    },
  ]) {
    assert.equal(
      compileWindowsRootObservationCandidate(invalid).status,
      "blocked",
    );
  }
  assert.equal(
    compileWindowsRootObservationCandidate({
      ...observation("runtime"),
      runtimeWriteEntityCount: 0,
    }).status,
    "blocked",
  );
});

/**
 * process結果の観測写像未実装時は入力に依存せず安全にblockedとするを検証する。
 *
 * @responsibility process結果の観測写像未実装時は入力に依存せず安全にblockedとするの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus process結果の観測写像未実装時は入力に依存せず安全にblockedとするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("process結果の観測写像未実装時は入力に依存せず安全にblockedとする", () => {
  const result = inspectWindowsRootObservationCandidate(
    "relative-root",
    "authority",
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "windows_root_effective_access_adapter_not_implemented",
  );
  assert.deepEqual(Object.keys(result).sort(), [
    "absolutePathReported",
    "aclReported",
    "filesystemEffectIssued",
    "identityObserved",
    "principalReported",
    "protectionObserved",
    "reason",
    "rootIdentityHash",
    "rootProtectionHash",
    "runtimeAuthorityConferred",
    "runtimeCapabilityIssued",
    "runtimePrincipalBound",
    "selectedUserBindingVerified",
    "status",
  ]);
});

/**
 * Root観測契約はWindows候補とPOSIX未実装を分離するを検証する。
 *
 * @responsibility Root観測契約はWindows候補とPOSIX未実装を分離するの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Root観測契約はWindows候補とPOSIX未実装を分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("Root観測契約はWindows候補とPOSIX未実装を分離する", () => {
  assert.deepEqual(describeRootObservationContract(), {
    identityContract: "crdd-coordinator/root-identity-observation",
    protectionContract: "crdd-coordinator/root-protection-observation",
    contractRevision: 1,
    identityDomain: "CRDD\0ROOT-IDENTITY-OBSERVATION\0V1\0",
    protectionDomain: "CRDD\0ROOT-PROTECTION-OBSERVATION\0V1\0",
    domainFraming:
      "implemented_candidate_artifact_specific_prefix_uint64be_length_canonical_payload",
    identityInputs:
      "windows_device_file_and_birthtime_identity_without_path_disclosure",
    protectionInputs:
      "windows_fixed_drive_dacl_role_runtime_principal_and_writer_exclusivity",
    windowsObservationCore: "implemented_candidate_component_only",
    windowsBinaryReleaseIdentityBinding:
      "implemented_candidate_signed_manifest",
    windowsProcessInvocation:
      "signed_exact_artifact_spawn_with_minimal_environment_and_bounded_io",
    windowsAdapter: "not_implemented_observation_mapping_required",
    runtimePrincipalBindingInput:
      "selected_local_user_binding_caller_claim_non_authority",
    selectedUserBinding: "not_implemented_blocked",
    selectedUserBindingVerified: false,
    runtimePrincipalBound: false,
    posixAdapter: "not_implemented",
    rawIdentityReported: false,
    rawProtectionReported: false,
    absolutePathReported: false,
    permissionMutationIssued: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
});
