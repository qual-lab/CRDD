/**
 * coordinator:unit:provider-homeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:provider-homeが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope provider、home
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  describeProviderHomeContract,
  evaluateWindowsProviderHomeLayoutCandidate,
  PROVIDER_HOME_CONTRACT,
  PROVIDER_HOME_CONTRACT_REVISION,
} from "../../src/security/provider-home.ts";

/**
 * 専用Provider Homeはlocal userとProvider単位の固定方針を持つを検証する。
 *
 * @responsibility 専用Provider Homeはlocal userとProvider単位の固定方針を持つの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 専用Provider Homeはlocal userとProvider単位の固定方針を持つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("専用Provider Homeはlocal userとProvider単位の固定方針を持つ", () => {
  const contract = describeProviderHomeContract();
  assert.equal(contract.contract, PROVIDER_HOME_CONTRACT);
  assert.equal(contract.contractRevision, PROVIDER_HOME_CONTRACT_REVISION);
  assert.equal(contract.scope, "local_os_user_and_provider");
  assert.deepEqual(contract.providers, ["codex", "claude"]);
  assert.equal(contract.persistentAcrossOperations, true);
  assert.equal(contract.sharedAcrossRepositoriesForSameOsUser, true);
  assert.equal(contract.hostDefaultHomeImportAllowed, false);
  assert.equal(contract.hostCredentialImportAllowed, false);
  assert.equal(contract.operationTemporaryHomeImportAllowed, false);
  assert.equal(contract.otherProviderHomeSharingAllowed, false);
  assert.equal(contract.operationCleanupOwned, false);
  assert.equal(contract.symlinkJunctionOrReparseAllowed, false);
  assert.equal(contract.stableRootIdentityRequired, true);
  assert.equal(contract.selectedLocalUserBindingRequired, true);
  assert.equal(contract.ownerAndDaclVerificationRequired, true);
  assert.equal(contract.untrustedWriterAllowed, false);
  assert.equal(
    contract.mountGrant.structuralCore,
    "implemented_candidate_non_authoritative",
  );
  assert.equal(contract.mountGrant.grantIssued, false);
  assert.equal(contract.mountGrant.mountAdapter, "not_implemented");
  assert.equal(
    contract.mountGrantRuntime.store,
    "process_local_atomic_map_plus_durable_runtime_state_lease",
  );
  assert.equal(contract.mountGrantRuntime.usageLimit, 1);
  assert.equal(contract.mountGrantRuntime.providerHomeMounted, false);
});

/**
 * Windows local app dataからProvider別layout候補を作るがPathやAuthorityを返さないを検証する。
 *
 * @responsibility Windows local app dataからProvider別layout候補を作るがPathやAuthorityを返さないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows local app dataからProvider別layout候補を作るがPathやAuthorityを返さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Windows local app dataからProvider別layout候補を作るがPathやAuthorityを返さない", () => {
  for (const provider of ["codex", "claude"]) {
    const result = evaluateWindowsProviderHomeLayoutCandidate({
      provider,
      localAppDataRoot: "C:\\Users\\selected\\AppData\\Local",
    });
    assert.equal(result.status, "candidate");
    assert.equal(result.provider, provider);
    assert.equal(result.homeLayoutCandidate, true);
    assert.equal(result.protectionVerified, false);
    assert.equal(result.authSessionVerified, false);
    assert.equal(result.providerHomeMountGrantIssued, false);
    assert.equal(result.filesystemEffectIssued, false);
    assert.equal(result.runtimeAuthorityIssued, false);
    assert.equal(result.operationCapabilityIssued, false);
    assert.equal(result.pathReported, false);
    assert.equal(JSON.stringify(result).includes("selected"), false);
  }
});

/**
 * 不正なWindows Root候補とunsupported Providerをlayout候補にしないを検証する。
 *
 * @responsibility 不正なWindows Root候補とunsupported Providerをlayout候補にしないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 不正なWindows Root候補とunsupported Providerをlayout候補にしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("不正なWindows Root候補とunsupported Providerをlayout候補にしない", () => {
  for (const localAppDataRoot of [
    "",
    ".",
    "provider-home",
    "C:\\Users\\selected\\.codex\\",
    "C:\\operation\\provider-home\\",
    "C:/Users/selected/AppData/Local",
  ]) {
    assert.equal(
      evaluateWindowsProviderHomeLayoutCandidate({
        provider: "codex",
        localAppDataRoot,
      }).status,
      "blocked",
    );
  }
  assert.equal(
    evaluateWindowsProviderHomeLayoutCandidate({
      provider: "other",
      localAppDataRoot: "C:\\Users\\selected\\AppData\\Local",
    }).reason,
    "provider_home_provider_not_supported",
  );
  assert.equal(
    evaluateWindowsProviderHomeLayoutCandidate({
      provider: "codex",
      localAppDataRoot: `C:\\${"a".repeat(4_060)}`,
    }).reason,
    "provider_home_layout_invalid",
  );
});

/**
 * 余分field、accessor、Proxyを処置前にfail closedとするを検証する。
 *
 * @responsibility 余分field、accessor、Proxyを処置前にfail closedとするの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 余分field、accessor、Proxyを処置前にfail closedとするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("余分field、accessor、Proxyを処置前にfail closedとする", () => {
  assert.equal(
    evaluateWindowsProviderHomeLayoutCandidate({
      provider: "codex",
      localAppDataRoot: "C:\\Users\\selected\\AppData\\Local",
      token: "must-not-be-accepted",
    }).reason,
    "provider_home_layout_input_invalid",
  );
  const accessor = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(accessor, "provider", {
    get: () => "codex",
    enumerable: true,
  });
  Object.defineProperty(accessor, "localAppDataRoot", {
    value: "C:\\Users\\selected\\AppData\\Local",
    enumerable: true,
  });
  assert.equal(
    evaluateWindowsProviderHomeLayoutCandidate(accessor).status,
    "blocked",
  );
  assert.equal(
    evaluateWindowsProviderHomeLayoutCandidate(
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("must_not_escape");
          },
        },
      ),
    ).status,
    "blocked",
  );
});

/**
 * layout候補は保護・認証・mount Grantの実装済み主張へ昇格しないを検証する。
 *
 * @responsibility layout候補は保護・認証・mount Grantの実装済み主張へ昇格しないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus layout候補は保護・認証・mount Grantの実装済み主張へ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("layout候補は保護・認証・mount Grantの実装済み主張へ昇格しない", () => {
  const contract = describeProviderHomeContract();
  assert.equal(
    contract.layoutCandidateInputSource,
    "caller_supplied_windows_absolute_path_candidate_non_authority",
  );
  assert.equal(
    contract.requiredEffectRootSource,
    "windows_known_folder_local_app_data_at_explicit_bootstrap_time",
  );
  assert.equal(contract.protectionEffect, "not_implemented");
  assert.equal(
    contract.protectionObservation,
    "implemented_runtime_owned_read_only_native_observation_candidate",
  );
  assert.equal(
    contract.selectedLocalUserBinder,
    "implemented_runtime_owned_current_local_interactive_token_candidate",
  );
  assert.equal(
    contract.runtimeOwnedObservation.callerSuppliedPathAccepted,
    false,
  );
  assert.equal(contract.windowsAdapter.shellInvocation, false);
  assert.equal(contract.authSessionProbe, "not_implemented");
  assert.equal(contract.callerPathConfersAuthority, false);
  assert.equal(contract.filesystemEffectIssued, false);
  assert.equal(contract.runtimeAuthorityIssued, false);
  assert.equal(contract.operationCapabilityIssued, false);
});
