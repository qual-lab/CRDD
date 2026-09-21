/**
 * coordinator:unit:root-protection-policyの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:root-protection-policyが所有する検証責務を実行する。
 * @trace RFD-UT-006
 * @level UT
 * @scope root、protection、policy
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  describeRootProtectionPolicyContract,
  evaluateRootProtectionPolicyCandidate,
} from "../../src/security/root-protection-policy.ts";
import { assertPresent } from "../support/test-support.ts";

/**
 * observationsのTest準備責務を実行する。
 *
 * @responsibility observationsがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus observationsを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
function observations(overrides = {}) {
  return {
    rootExists: true,
    stableIdentityObserved: true,
    linkOrReparseObserved: false,
    runtimeReadAllowed: true,
    runtimeWriteAllowed: true,
    writeAuthority: "runtime_principal_only",
    untrustedWriteAllowed: false,
    ...overrides,
  };
}

/**
 * inputのTest準備責務を実行する。
 *
 * @responsibility inputがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus inputを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
function input(overrides = {}) {
  return {
    rootRole: "runtime",
    platformFamily: "windows",
    filesystemClass: "local",
    observations: observations(),
    ...overrides,
  };
}

/**
 * WindowsとPOSIXのlocal／persistent volume claimを候補に限定するを検証する。
 *
 * @responsibility WindowsとPOSIXのlocal／persistent volume claimを候補に限定するの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus WindowsとPOSIXのlocal／persistent volume claimを候補に限定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("WindowsとPOSIXのlocal／persistent volume claimを候補に限定する", () => {
  for (const platformFamily of ["windows", "posix"]) {
    for (const filesystemClass of ["local", "persistent_volume"]) {
      const runtime = evaluateRootProtectionPolicyCandidate(
        input({ platformFamily, filesystemClass }),
      );
      assert.equal(runtime.status, "candidate");
      assertPresent(runtime.policy);
      assert.equal(
        runtime.reason,
        "root_protection_platform_adapter_verification_required",
      );
      assert.equal(runtime.policy.runtimeAccess, "read_write");
      assert.equal(
        runtime.policy.requiredWriteAuthority,
        "runtime_principal_only",
      );
      assert.equal(runtime.policy.absolutePathReported, false);
      assert.equal(runtime.filesystemEffectIssued, false);
      assert.equal(runtime.runtimeCapabilityIssued, false);

      const authority = evaluateRootProtectionPolicyCandidate(
        input({
          rootRole: "authority",
          platformFamily,
          filesystemClass,
          observations: observations({
            runtimeWriteAllowed: false,
            writeAuthority: "provisioner_principal_only",
          }),
        }),
      );
      assert.equal(authority.status, "candidate");
      assertPresent(authority.policy);
      assert.equal(authority.policy.runtimeAccess, "read_only");
      assert.equal(
        authority.policy.requiredWriteAuthority,
        "provisioner_principal_only",
      );
      assert.equal(authority.runtimeCapabilityIssued, false);
    }
  }
});

/**
 * unsupported platformとFilesystem classをfail closedにするを検証する。
 *
 * @responsibility unsupported platformとFilesystem classをfail closedにするの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus unsupported platformとFilesystem classをfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("unsupported platformとFilesystem classをfail closedにする", () => {
  assert.equal(
    evaluateRootProtectionPolicyCandidate(input({ platformFamily: "unknown" }))
      .reason,
    "root_protection_platform_unsupported",
  );
  for (const filesystemClass of [
    "network",
    "removable",
    "special",
    "unknown",
  ]) {
    assert.equal(
      evaluateRootProtectionPolicyCandidate(input({ filesystemClass })).reason,
      "root_protection_filesystem_unsupported",
    );
  }
});

/**
 * 欠落、Identity不明、linkおよび非承認書込みを拒否するを検証する。
 *
 * @responsibility 欠落、Identity不明、linkおよび非承認書込みを拒否するの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 欠落、Identity不明、linkおよび非承認書込みを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("欠落、Identity不明、linkおよび非承認書込みを拒否する", () => {
  const cases = [
    ["root_protection_root_missing", { rootExists: false }],
    [
      "root_protection_stable_identity_required",
      { stableIdentityObserved: false },
    ],
    [
      "root_protection_link_or_reparse_rejected",
      { linkOrReparseObserved: true },
    ],
    [
      "root_protection_untrusted_write_rejected",
      { untrustedWriteAllowed: true },
    ],
  ];
  for (const [reason, override] of cases) {
    assert.equal(
      evaluateRootProtectionPolicyCandidate(
        input({
          observations: observations(override),
        }),
      ).reason,
      reason,
    );
  }
});

/**
 * Runtime RootとAuthority Rootの主体別access policyを区別するを検証する。
 *
 * @responsibility Runtime RootとAuthority Rootの主体別access policyを区別するの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Runtime RootとAuthority Rootの主体別access policyを区別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("Runtime RootとAuthority Rootの主体別access policyを区別する", () => {
  for (const override of [
    { runtimeReadAllowed: false },
    { runtimeWriteAllowed: false },
    { writeAuthority: "provisioner_principal_only" },
  ]) {
    assert.equal(
      evaluateRootProtectionPolicyCandidate(
        input({
          observations: observations(override),
        }),
      ).reason,
      "runtime_root_access_policy_not_satisfied",
    );
  }
  for (const override of [
    {
      runtimeReadAllowed: false,
      runtimeWriteAllowed: false,
      writeAuthority: "provisioner_principal_only",
    },
    { runtimeWriteAllowed: true, writeAuthority: "provisioner_principal_only" },
    { runtimeWriteAllowed: false, writeAuthority: "runtime_principal_only" },
  ]) {
    assert.equal(
      evaluateRootProtectionPolicyCandidate(
        input({
          rootRole: "authority",
          observations: observations(override),
        }),
      ).reason,
      "authority_root_access_policy_not_satisfied",
    );
  }
});

/**
 * exact plain-data以外と欠落観測を処置前に拒否するを検証する。
 *
 * @responsibility exact plain-data以外と欠落観測を処置前に拒否するの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus exact plain-data以外と欠落観測を処置前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("exact plain-data以外と欠落観測を処置前に拒否する", () => {
  let getterCalls = 0;
  const accessor = input();
  Object.defineProperty(accessor, "observations", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return observations();
    },
  });
  assert.equal(
    evaluateRootProtectionPolicyCandidate(accessor).reason,
    "root_protection_input_invalid",
  );
  assert.equal(getterCalls, 0);

  const nested = observations();
  Object.defineProperty(nested, "runtimeWriteAllowed", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return true;
    },
  });
  assert.equal(
    evaluateRootProtectionPolicyCandidate(input({ observations: nested }))
      .reason,
    "root_protection_observations_invalid",
  );
  assert.equal(getterCalls, 0);
  const writerAccessor = observations();
  Object.defineProperty(writerAccessor, "writeAuthority", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "runtime_principal_only";
    },
  });
  assert.equal(
    evaluateRootProtectionPolicyCandidate(
      input({ observations: writerAccessor }),
    ).reason,
    "root_protection_observations_invalid",
  );
  assert.equal(getterCalls, 0);

  const extra = Object.assign(input(), { extra: true });
  assert.equal(
    evaluateRootProtectionPolicyCandidate(extra).reason,
    "root_protection_input_invalid",
  );
  const symbol = Object.assign(input(), { [Symbol("extra")]: true });
  assert.equal(
    evaluateRootProtectionPolicyCandidate(symbol).reason,
    "root_protection_input_invalid",
  );
  assert.equal(
    evaluateRootProtectionPolicyCandidate(
      Object.assign(Object.create({}), input()),
    ).reason,
    "root_protection_input_invalid",
  );
  const missing = observations();
  Reflect.deleteProperty(missing, "rootExists");
  assert.equal(
    evaluateRootProtectionPolicyCandidate(input({ observations: missing }))
      .reason,
    "root_protection_observations_invalid",
  );
  const missingWriter = observations();
  Reflect.deleteProperty(missingWriter, "writeAuthority");
  assert.equal(
    evaluateRootProtectionPolicyCandidate(
      input({ observations: missingWriter }),
    ).reason,
    "root_protection_observations_invalid",
  );
  assert.equal(
    evaluateRootProtectionPolicyCandidate(new Proxy(input(), {})).reason,
    "root_protection_input_invalid",
  );
  assert.equal(
    evaluateRootProtectionPolicyCandidate(
      input({
        observations: new Proxy(observations(), {}),
      }),
    ).reason,
    "root_protection_observations_invalid",
  );
  assert.equal(
    evaluateRootProtectionPolicyCandidate(
      input({
        observations: Object.assign(Object.create({}), observations()),
      }),
    ).reason,
    "root_protection_observations_invalid",
  );
  const nestedSymbol = Object.assign(observations(), {
    [Symbol("extra")]: true,
  });
  assert.equal(
    evaluateRootProtectionPolicyCandidate(input({ observations: nestedSymbol }))
      .reason,
    "root_protection_observations_invalid",
  );
  assert.equal(
    evaluateRootProtectionPolicyCandidate(
      input({ platformFamily: "x".repeat(33) }),
    ).reason,
    "root_protection_input_invalid",
  );
  assert.equal(
    evaluateRootProtectionPolicyCandidate(input({ rootRole: null })).reason,
    "root_protection_input_invalid",
  );
  assert.equal(
    evaluateRootProtectionPolicyCandidate(
      input({
        observations: observations({ writeAuthority: "unknown" }),
      }),
    ).reason,
    "root_protection_observations_invalid",
  );
});

/**
 * 通常、null-prototypeおよびfreeze済みinputを受理するを検証する。
 *
 * @responsibility 通常、null-prototypeおよびfreeze済みinputを受理するの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 通常、null-prototypeおよびfreeze済みinputを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("通常、null-prototypeおよびfreeze済みinputを受理する", () => {
  const nullObservations = Object.assign(Object.create(null), observations());
  const nullInput = Object.assign(
    Object.create(null),
    input({ observations: nullObservations }),
  );
  assert.equal(
    evaluateRootProtectionPolicyCandidate(nullInput).status,
    "candidate",
  );
  assert.equal(
    evaluateRootProtectionPolicyCandidate(
      Object.freeze(
        input({
          observations: Object.freeze(observations()),
        }),
      ),
    ).status,
    "candidate",
  );
});

/**
 * contractはclaim候補と未実装Adapter／Effect／Capabilityを分離するを検証する。
 *
 * @responsibility contractはclaim候補と未実装Adapter／Effect／Capabilityを分離するの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus contractはclaim候補と未実装Adapter／Effect／Capabilityを分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
test("contractはclaim候補と未実装Adapter／Effect／Capabilityを分離する", () => {
  const contract = describeRootProtectionPolicyContract();
  assert.deepEqual(contract.supportedPlatformFamilies, ["windows", "posix"]);
  assert.equal(contract.inputTokenLength, 32);
  assert.deepEqual(contract.supportedFilesystemClasses, [
    "local",
    "persistent_volume",
  ]);
  assert.deepEqual(contract.writeAuthorityValues, [
    "runtime_principal_only",
    "provisioner_principal_only",
  ]);
  assert.equal(
    contract.runtimeRootProtection,
    "runtime_principal_only_read_write_and_no_other_writer",
  );
  assert.equal(
    contract.authorityRootProtection,
    "provisioner_principal_only_write_runtime_read_only_and_no_other_writer",
  );
  assert.equal(
    contract.writerExclusivityScope,
    "ordinary_access_control_entries_excluding_trusted_platform_administrator_override",
  );
  assert.deepEqual(contract.trustedPlatformAdministratorBoundary, [
    "windows_system_and_machine_administrators",
    "posix_root",
  ]);
  assert.equal(
    Object.isFrozen(contract.trustedPlatformAdministratorBoundary),
    true,
  );
  assert.equal(
    contract.administratorOriginatedChangeDetection,
    "runtime_owned_revalidation_detects_observable_identity_protection_signature_trust_or_activation_change_and_fails_closed",
  );
  assert.equal(
    contract.administratorOriginatedObservableChangeResponse,
    "blocked_reverification_then_reprovision_only_after_trust_base_confirmed",
  );
  assert.equal(
    contract.confirmedOrSuspectedPlatformAdministratorCompromiseResponse,
    "blocked_platform_recovery_and_trust_base_reestablishment_required_before_reprovision",
  );
  assert.equal(
    contract.ambiguousAdministratorChangeClassification,
    "fail_closed_as_suspected_compromise",
  );
  assert.equal(contract.platformRecoveryImplementation, "not_implemented");
  assert.equal(
    ["administrator", "CompromiseResponse"].join("") in contract,
    false,
  );
  assert.equal(
    contract.completeOsOrVerifierCompromiseProtection,
    "not_guaranteed",
  );
  assert.equal(
    contract.protectionEffectOwner,
    "official_signed_platform_provisioner_only_target",
  );
  assert.equal(contract.runtimePermissionMutation, "prohibited");
  assert.deepEqual(contract.windowsProtectionTarget, {
    runtimeRoot: "runtime_sid_read_write_target",
    authorityRoot:
      "provisioner_or_approved_admin_write_runtime_sid_read_only_target",
    inheritance: "disabled_target",
    untrustedBroadWriteAces: "rejected_target",
  });
  assert.deepEqual(contract.posixProtectionTarget, {
    runtimeRoot: "runtime_uid_owner_mode_0700_target",
    authorityRoot:
      "provisioner_or_root_owner_runtime_read_traverse_explicit_acl_target",
    unapprovedGroupOrOtherWrite: "rejected_target",
  });
  assert.equal(
    contract.persistentVolumeEligibility,
    "local_equivalent_stable_identity_durable_atomic_replace_and_equivalent_acl_required_target",
  );
  assert.equal(
    contract.unsupportedVolumeBehavior,
    "network_removable_special_or_unknown_blocked_target",
  );
  assert.equal(Object.isFrozen(contract.windowsProtectionTarget), true);
  assert.equal(Object.isFrozen(contract.posixProtectionTarget), true);
  assert.equal(contract.callerObservationsAreAuthority, false);
  assert.equal(
    contract.protectionPolicyCore,
    "implemented_candidate_claim_only",
  );
  assert.equal(
    contract.posixRuntimeRootPrecheckEntry,
    "implemented_fail_closed",
  );
  assert.equal(contract.posixRuntimeRootModeObservation, "not_implemented");
  assert.equal(contract.posixOwnerModeAdapter, "not_implemented");
  assert.equal(contract.posixAclVerification, "not_implemented");
  assert.equal(
    contract.runtimePrincipalBinding,
    "not_implemented_effective_access_required",
  );
  assert.equal(
    contract.windowsDaclAdapter,
    "not_implemented_observation_mapping_required",
  );
  assert.equal(contract.posixOwnerModeAdapter, "not_implemented");
  assert.equal(contract.persistentVolumeAdapter, "not_implemented");
  assert.equal(contract.filesystemClassVerification, "not_implemented");
  assert.equal(
    contract.pathBinding,
    "not_implemented_root_observation_adapter_required",
  );
  assert.equal(contract.rootObservation.posixAdapter, "not_implemented");
  assert.equal(contract.rootCreationIssued, false);
  assert.equal(contract.permissionMutationIssued, false);
  assert.equal(contract.filesystemEffectIssued, false);
  assert.equal(contract.runtimeCapabilityIssued, false);
});
