/**
 * coordinator:unit:local-personal-authority-runtimeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:local-personal-authority-runtimeが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope local、personal、authority、runtime
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { reverifyAuthorityBeforeProviderLaunch } from "../../src/security/authority-prelaunch-verifier.ts";
import {
  createIsolatedLocalPersonalAuthorityRuntimeCandidate,
  describeLocalPersonalAuthorityRuntimeContract,
  loadRuntimeOwnedLocalPersonalAuthority,
} from "../../src/security/local-personal-authority-runtime.ts";

/**
 * confirmedReleaseのTest準備責務を実行する。
 *
 * @responsibility confirmedReleaseがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus confirmedReleaseを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
function confirmedRelease() {
  return Object.freeze({
    status: "candidate",
    runtimeOwnedReleaseTrustConfirmed: true,
    releaseIdentityRuntimeOwned: false,
    runtimeExecutionIdentityRuntimeOwned: true,
    crddDistributionConfirmed: true,
  });
}

/**
 * 開発版の許可は同じAuthority生成器へ接続し期限切れ時はcacheを再利用しないを検証する。
 *
 * @responsibility 開発版の許可は同じAuthority生成器へ接続し期限切れ時はcacheを再利用しないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 開発版の許可は同じAuthority生成器へ接続し期限切れ時はcacheを再利用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("開発版の許可は同じAuthority生成器へ接続し期限切れ時はcacheを再利用しない", () => {
  let isAuthorized = true;
  let releaseChecks = 0;
  const management = Object.freeze({});
  const binding = {
    operationId: "OP-123456",
    provider: "claude",
    profileId: "PROFILE-200001",
  };
  const runtime = createIsolatedLocalPersonalAuthorityRuntimeCandidate({
    wallNow: () => Date.now(),
    verifyRelease: () => {
      releaseChecks += 1;
      return { status: "blocked" };
    },
    verifyDevelopment: (candidate, capability) =>
      capability === management && candidate.operationId === binding.operationId
        ? isAuthorized
          ? "authorized"
          : "blocked"
        : "not_development",
  });
  assert.equal(runtime.load(binding, {}), null);
  const source = runtime.load(binding, management);
  assert.ok(source);
  assert.equal(
    (source.profile as Record<string, unknown>).authMethod,
    "subscription_oauth",
  );
  assert.equal(runtime.load(binding, management), source);
  isAuthorized = false;
  assert.equal(runtime.load(binding, management), null);
  assert.equal(releaseChecks, 1);
});

/**
 * 署名Release確認済みLocal Personal AuthorityをOperationへ固定するを検証する。
 *
 * @responsibility 署名Release確認済みLocal Personal AuthorityをOperationへ固定するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 署名Release確認済みLocal Personal AuthorityをOperationへ固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("署名Release確認済みLocal Personal AuthorityをOperationへ固定する", () => {
  let now = Date.now();
  let releaseChecks = 0;
  const runtime = createIsolatedLocalPersonalAuthorityRuntimeCandidate({
    wallNow: () => now,
    verifyRelease: () => {
      releaseChecks += 1;
      return confirmedRelease();
    },
  });
  const binding = Object.freeze({
    operationId: "OP-123456",
    provider: "claude",
    profileId: "PROFILE-200001",
  });
  const source = runtime.load(binding);
  assert.ok(source);
  const verified = reverifyAuthorityBeforeProviderLaunch(
    source.profile,
    source.bundle,
    Object.freeze({
      ...binding,
      scopeId: "SCOPE-200001",
      providerHomeMountGrantRef: "PHMGRANT-123456",
    }),
  );
  assert.equal(verified.status, "candidate");
  assert.equal(verified.verification.provider, "claude");
  assert.equal(verified.verification.profileId, "PROFILE-200001");
  assert.equal(verified.verification.operationId, "OP-123456");
  assert.equal(verified.verification.scopeId, "SCOPE-200001");

  now += 1_000;
  assert.equal(runtime.load(binding), source);
  assert.equal(releaseChecks, 2);
});

/**
 * Release未確認、未知Profile、Provider差と不正時計はsourceを返さないを検証する。
 *
 * @responsibility Release未確認、未知Profile、Provider差と不正時計はsourceを返さないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Release未確認、未知Profile、Provider差と不正時計はsourceを返さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Release未確認、未知Profile、Provider差と不正時計はsourceを返さない", () => {
  const blockedRelease = createIsolatedLocalPersonalAuthorityRuntimeCandidate({
    wallNow: () => Date.parse("2026-08-25T00:00:00.000Z"),
    verifyRelease: () => Object.freeze({ status: "blocked" }),
  });
  assert.equal(
    blockedRelease.load({
      operationId: "OP-123456",
      provider: "claude",
      profileId: "PROFILE-200001",
    }),
    null,
  );

  const runtime = createIsolatedLocalPersonalAuthorityRuntimeCandidate({
    wallNow: () => Date.parse("2026-08-25T00:00:00.000Z"),
    verifyRelease: confirmedRelease,
  });
  for (const binding of [
    {
      operationId: "OP-123456",
      provider: "codex",
      profileId: "PROFILE-200001",
    },
    {
      operationId: "OP-123456",
      provider: "claude",
      profileId: "PROFILE-999999",
    },
    {
      operationId: "invalid",
      provider: "claude",
      profileId: "PROFILE-200001",
    },
  ]) {
    assert.equal(runtime.load(binding), null);
  }
  assert.equal(
    createIsolatedLocalPersonalAuthorityRuntimeCandidate({
      wallNow: () => Number.NaN,
      verifyRelease: confirmedRelease,
    }).load({
      operationId: "OP-123456",
      provider: "claude",
      profileId: "PROFILE-200001",
    }),
    null,
  );
  assert.equal(
    createIsolatedLocalPersonalAuthorityRuntimeCandidate({
      wallNow: () => Date.parse("2026-08-25T00:00:00.000Z"),
      verifyRelease: () => {
        throw new Error("release_failure");
      },
    }).load({
      operationId: "OP-123456",
      provider: "claude",
      profileId: "PROFILE-200001",
    }),
    null,
  );
});

/**
 * sourceは30秒後に再生成しRelease確認を省略しないを検証する。
 *
 * @responsibility sourceは30秒後に再生成しRelease確認を省略しないの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus sourceは30秒後に再生成しRelease確認を省略しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("sourceは30秒後に再生成しRelease確認を省略しない", () => {
  let now = Date.parse("2026-08-25T00:00:00.000Z");
  const runtime = createIsolatedLocalPersonalAuthorityRuntimeCandidate({
    wallNow: () => now,
    verifyRelease: confirmedRelease,
  });
  const binding = {
    operationId: "OP-123456",
    provider: "codex",
    profileId: "PROFILE-100002",
  };
  const first = runtime.load(binding);
  assert.ok(first);
  now += 30_000;
  const second = runtime.load(binding);
  assert.ok(second);
  assert.notEqual(second, first);
});

/**
 * source checkoutのproduction loaderは署名Release不成立なら停止するを検証する。
 *
 * @responsibility source checkoutのproduction loaderは署名Release不成立なら停止するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus source checkoutのproduction loaderは署名Release不成立なら停止するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("source checkoutのproduction loaderは署名Release不成立なら停止する", () => {
  assert.equal(
    loadRuntimeOwnedLocalPersonalAuthority({
      operationId: "OP-123456",
      provider: "claude",
      profileId: "PROFILE-200001",
    }),
    null,
  );
});

/**
 * Local Personal Authority contractはT1-T2と外部Root非必須を固定するを検証する。
 *
 * @responsibility Local Personal Authority contractはT1-T2と外部Root非必須を固定するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Local Personal Authority contractはT1-T2と外部Root非必須を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Local Personal Authority contractはT1-T2と外部Root非必須を固定する", () => {
  const contract = describeLocalPersonalAuthorityRuntimeContract();
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.trustProfile, "local_personal_t1_t2");
  assert.equal(
    contract.releaseTrust,
    "official_signed_crdd_release_required_each_load",
  );
  assert.equal(contract.externalAuthorityRootRequired, false);
  assert.equal(contract.managedAuthorityProfileSupported, false);
  assert.equal(contract.providerEffectAllowed, false);
});
