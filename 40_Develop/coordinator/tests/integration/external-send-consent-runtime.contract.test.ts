/**
 * coordinator:integration:external-send-consent-runtimeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:external-send-consent-runtimeが所有する検証責務を実行する。
 * @trace EST-IT-004
 * @level IT
 * @scope external、send、consent、runtime
 * @boundary EST-IT-004=Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  compileExternalSendConsentBoundaryHash,
  createIsolatedExternalSendConsentRuntimeCandidate,
  describeExternalSendConsentRuntimeContract,
  EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX,
} from "../../src/security/external-send-consent-runtime.ts";
import { dockerRecoveryCommitName } from "../../src/security/docker-recovery-journal.ts";
import type { ExternalSendPolicy } from "../../src/security/external-send-policy-runtime.ts";

/**
 * policyのTest準備責務を実行する。
 *
 * @responsibility policyがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-IT-004
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus policyを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-IT-004=Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
function policy(overrides: Partial<ExternalSendPolicy> = {}) {
  return Object.freeze({
    schema: "crdd-coordinator/external-send-policy/v2" as const,
    enabled: true,
    policyId: "fixture/local-personal/v1",
    informationClassification: "public" as const,
    decisionAuthority: "authenticated_local_user" as const,
    candidatePersistenceAllowed: true,
    candidateRetentionHours: 24,
    candidatePhysicalDeletion:
      "next_safe_runtime_entry_after_expiry_or_explicit_discard" as const,
    destinations: Object.freeze([]),
    policyHash: "a".repeat(64),
    sourceRevision: "1".repeat(40),
    sourceFileHash: "b".repeat(64),
    ...overrides,
  }) as ExternalSendPolicy;
}

/**
 * 初期同意境界はRepository revisionでなくexact Policy byteとPolicy IDへ結合するを検証する。
 *
 * @responsibility 初期同意境界はRepository revisionでなくexact Policy byteとPolicy IDへ結合するの合否判定を所有する。
 * @trace EST-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 初期同意境界はRepository revisionでなくexact Policy byteとPolicy IDへ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-IT-004=Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
test("初期同意境界はRepository revisionでなくexact Policy byteとPolicy IDへ結合する", () => {
  const first = compileExternalSendConsentBoundaryHash(policy());
  assert.match(first ?? "", /^[a-f0-9]{64}$/u);
  assert.equal(
    first,
    createHash("sha256")
      .update("crdd-external-send-consent-boundary-v2\0")
      .update(policy().policyId)
      .update("\0")
      .update(policy().sourceFileHash)
      .update("\0")
      .update("bounded-reviewer-defect-claim-transfer-v1")
      .digest("hex"),
  );
  assert.equal(
    compileExternalSendConsentBoundaryHash(
      policy({ sourceRevision: "2".repeat(40) }),
    ),
    first,
  );
  assert.notEqual(
    compileExternalSendConsentBoundaryHash(
      policy({ sourceFileHash: "c".repeat(64) }),
    ),
    first,
  );
  assert.notEqual(
    compileExternalSendConsentBoundaryHash(
      policy({ policyId: "fixture/another-policy/v1" }),
    ),
    first,
  );
  assert.equal(
    compileExternalSendConsentBoundaryHash(
      policy({ sourceFileHash: "not-a-hash" }),
    ),
    null,
  );
});

/**
 * 公開契約は選択User・保護Runtime State・Subscription境界と再承認条件を固定するを検証する。
 *
 * @responsibility 公開契約は選択User・保護Runtime State・Subscription境界と再承認条件を固定するの合否判定を所有する。
 * @trace EST-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約は選択User・保護Runtime State・Subscription境界と再承認条件を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-IT-004=Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
test("公開契約は選択User・保護Runtime State・Subscription境界と再承認条件を固定する", () => {
  const contract = describeExternalSendConsentRuntimeContract();
  assert.equal(contract.contractRevision, 3);
  assert.match(contract.lifecycle, /one_active_initial_consent/u);
  assert.ok(contract.binding.includes("selected_local_user"));
  assert.ok(contract.binding.includes("subscription_offering"));
  assert.ok(contract.binding.includes("runtime_external_send_semantics_id"));
  assert.equal(
    contract.runtimeExternalSendSemanticsId,
    "bounded-reviewer-defect-claim-transfer-v1",
  );
  assert.equal(contract.exactProviderAccountOrTenantIdentityVerified, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.additionalPurchaseAllowed, false);
  assert.equal(contract.callerSuppliedPathAccepted, false);
});

/**
 * isolatedのTest準備責務を実行する。
 *
 * @responsibility isolatedがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-IT-004
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus isolatedを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-IT-004=Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
function isolated() {
  const rootPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-external-send-consent-"),
  );
  let now = 1_000_000;
  let isReleaseWorks = true;
  let lockAvailable = true;
  let rootAvailable = true;
  let nonce = 0;
  let isLockHeld = false;
  let releaseCount = 0;
  let shouldThrowOnRelease = false;
  let reobservationFault:
    | "identity"
    | "protection"
    | "user"
    | "unavailable"
    | "throw"
    | null = null;
  const initialRoot = Object.freeze({
    rootPath,
    runtimeStateIdentityHash: "1".repeat(64),
    runtimeStateProtectionHash: "2".repeat(64),
    localUserBindingHash: "3".repeat(64),
    stableLogicalHomeBindingHash: "4".repeat(64),
  });
  let currentRoot = initialRoot;
  const runtime = createIsolatedExternalSendConsentRuntimeCandidate({
    observeRoot: () => {
      if (!rootAvailable) return null;
      if (!isLockHeld || reobservationFault === null) return currentRoot;
      if (reobservationFault === "throw")
        throw new Error("fixture_observation");
      if (reobservationFault === "unavailable") return null;
      return Object.freeze({
        ...currentRoot,
        ...(reobservationFault === "identity"
          ? { runtimeStateIdentityHash: "5".repeat(64) }
          : reobservationFault === "protection"
            ? { runtimeStateProtectionHash: "6".repeat(64) }
            : { localUserBindingHash: "7".repeat(64) }),
      });
    },
    acquireLock: () => {
      if (!lockAvailable) return null;
      isLockHeld = true;
      return Object.freeze({
        release: () => {
          releaseCount += 1;
          isLockHeld = false;
          if (shouldThrowOnRelease) throw new Error("fixture_release");
          return isReleaseWorks;
        },
      });
    },
    now: () => now,
    nonce: () => (++nonce).toString(16).padStart(16, "0"),
  } as unknown as Parameters<
    typeof createIsolatedExternalSendConsentRuntimeCandidate
  >[0]);
  return Object.freeze({
    rootPath,
    runtime,
    advance: (value: number) => {
      now += value;
    },
    replaceRoot: (field: "identity" | "protection" | "user") => {
      currentRoot = Object.freeze({
        ...currentRoot,
        ...(field === "identity"
          ? { runtimeStateIdentityHash: "5".repeat(64) }
          : field === "protection"
            ? { runtimeStateProtectionHash: "6".repeat(64) }
            : { localUserBindingHash: "7".repeat(64) }),
      });
    },
    restoreRoot: () => {
      currentRoot = initialRoot;
    },
    setNow: (value: number) => {
      now = value;
    },
    makeRootUnavailable: () => {
      rootAvailable = false;
    },
    blockLock: () => {
      lockAvailable = false;
    },
    failRelease: () => {
      isReleaseWorks = false;
    },
    failReobservation: (fault: NonNullable<typeof reobservationFault>) => {
      reobservationFault = fault;
    },
    throwOnRelease: () => {
      shouldThrowOnRelease = true;
    },
    readReleaseCount: () => releaseCount,
  });
}

/**
 * 単一Active境界はabsentから保存・再利用しA→B→Aで古い許可を復活させないを検証する。
 *
 * @responsibility 単一Active境界はabsentから保存・再利用しA→B→Aで古い許可を復活させないの合否判定を所有する。
 * @trace EST-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 単一Active境界はabsentから保存・再利用しA→B→Aで古い許可を復活させないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-IT-004=Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
test("単一Active境界はabsentから保存・再利用しA→B→Aで古い許可を復活させない", () => {
  const fixture = isolated();
  const first = policy();
  const second = policy({
    policyId: "fixture/second/v1",
    sourceFileHash: "c".repeat(64),
  });
  try {
    assert.equal(fixture.runtime.resolve(first).status, "absent");
    assert.equal(fixture.runtime.persist(first).status, "confirmed");
    assert.equal(fixture.runtime.resolve(first).status, "confirmed");
    assert.equal(fixture.runtime.resolve(second).status, "needs_confirmation");
    assert.equal(
      fixture.runtime.persist(second).status,
      "confirmed",
      JSON.stringify(fs.readdirSync(fixture.rootPath)),
    );
    assert.equal(fixture.runtime.resolve(second).status, "confirmed");
    assert.equal(fixture.runtime.resolve(first).status, "needs_confirmation");
    const activeEntries = fs
      .readdirSync(fixture.rootPath)
      .filter((name) => name.startsWith(EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX));
    assert.equal(activeEntries.length, 0);
    assert.equal(
      activeEntries.filter((name) => name.endsWith(".crdd-commit.json")).length,
      0,
    );
  } finally {
    fs.rmSync(fixture.rootPath, { recursive: true, force: true });
  }
});

/**
 * 期限切れ・選択User・Runtime identity/protection変更は再承認を要求するを検証する。
 *
 * @responsibility 期限切れ・選択User・Runtime identity/protection変更は再承認を要求するの合否判定を所有する。
 * @trace EST-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 期限切れ・選択User・Runtime identity/protection変更は再承認を要求するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-IT-004=Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
test("期限切れ・選択User・Runtime identity/protection変更は再承認を要求する", () => {
  for (const replacement of ["identity", "protection", "user"] as const) {
    const fixture = isolated();
    try {
      assert.equal(fixture.runtime.persist(policy()).status, "confirmed");
      fixture.replaceRoot(replacement);
      assert.equal(
        fixture.runtime.resolve(policy()).status,
        "needs_confirmation",
      );
      fixture.restoreRoot();
      assert.notEqual(fixture.runtime.resolve(policy()).status, "confirmed");
    } finally {
      fs.rmSync(fixture.rootPath, { recursive: true, force: true });
    }
  }
  const fixture = isolated();
  try {
    assert.equal(
      fixture.runtime.persist(policy()).status,
      "confirmed",
      JSON.stringify(fs.readdirSync(fixture.rootPath)),
    );
    fixture.advance(181 * 24 * 60 * 60 * 1_000);
    assert.equal(
      fixture.runtime.resolve(policy()).status,
      "needs_confirmation",
    );
    fixture.setNow(1_000_000);
    assert.notEqual(fixture.runtime.resolve(policy()).status, "confirmed");
  } finally {
    fs.rmSync(fixture.rootPath, { recursive: true, force: true });
  }
});

/**
 * 観測不能Rootとdangling reparse residueを取消成功へ流用しないを検証する。
 *
 * @responsibility 観測不能Rootとdangling reparse residueを取消成功へ流用しないの合否判定を所有する。
 * @trace EST-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 観測不能Rootとdangling reparse residueを取消成功へ流用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-IT-004=Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
test("観測不能Rootとdangling reparse residueを取消成功へ流用しない", () => {
  const unavailable = isolated();
  try {
    unavailable.makeRootUnavailable();
    assert.equal(unavailable.runtime.revoke().status, "recovery_required");
  } finally {
    fs.rmSync(unavailable.rootPath, { recursive: true, force: true });
  }

  const fixture = isolated();
  const boundary = compileExternalSendConsentBoundaryHash(policy());
  assert.ok(boundary);
  const name = `${EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX}${boundary}-eeeeeeeeeeeeeeee.json`;
  const link = path.join(fixture.rootPath, name);
  const target = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-consent-link-target-"),
  );
  try {
    fs.symlinkSync(target, link, "junction");
    fs.rmSync(target, { recursive: true, force: true });
    assert.equal(fixture.runtime.revoke().status, "recovery_required");
    assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
  } finally {
    fs.rmSync(link, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
    fs.rmSync(fixture.rootPath, { recursive: true, force: true });
  }
});

/**
 * 部分pairと破損pairは固定Authorityを安全に失効し、明示revokeも残存0にするを検証する。
 *
 * @responsibility 部分pairと破損pairは固定Authorityを安全に失効し、明示revokeも残存0にするの合否判定を所有する。
 * @trace EST-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 部分pairと破損pairは固定Authorityを安全に失効し、明示revokeも残存0にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-IT-004=Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
test("部分pairと破損pairは固定Authorityを安全に失効し、明示revokeも残存0にする", () => {
  const fixture = isolated();
  const name = `${EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX}${compileExternalSendConsentBoundaryHash(policy())}-ffffffffffffffff.json`;
  const file = path.join(fixture.rootPath, name);
  try {
    fs.writeFileSync(file, "{}\n", "utf8");
    assert.equal(fixture.runtime.resolve(policy()).status, "absent");
    assert.equal(fs.existsSync(file), false);
    assert.equal(fixture.runtime.persist(policy()).status, "confirmed");
    const active = fs
      .readdirSync(fixture.rootPath)
      .find(
        (entry) =>
          entry.startsWith(EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX) &&
          entry.endsWith(".json") &&
          !entry.endsWith(".crdd-commit.json"),
      );
    assert.ok(active);
    fs.writeFileSync(
      path.join(fixture.rootPath, dockerRecoveryCommitName(active)),
      "{}\n",
      "utf8",
    );
    assert.equal(fixture.runtime.resolve(policy()).status, "absent");
    assert.equal(fixture.runtime.persist(policy()).status, "confirmed");
    assert.equal(fixture.runtime.revoke().status, "revoked");
    assert.equal(
      fs
        .readdirSync(fixture.rootPath)
        .some((entry) => entry.startsWith(EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX)),
      false,
    );
  } finally {
    fs.rmSync(fixture.rootPath, { recursive: true, force: true });
  }
});

/**
 * lock競合とrelease失敗はAuthorityを発行せずrecovery requiredに閉じるを検証する。
 *
 * @responsibility lock競合とrelease失敗はAuthorityを発行せずrecovery requiredに閉じるの合否判定を所有する。
 * @trace EST-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus lock競合とrelease失敗はAuthorityを発行せずrecovery requiredに閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-IT-004=Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
test("lock競合とrelease失敗はAuthorityを発行せずrecovery requiredに閉じる", () => {
  const locked = isolated();
  try {
    locked.blockLock();
    assert.equal(locked.runtime.persist(policy()).status, "recovery_required");
  } finally {
    fs.rmSync(locked.rootPath, { recursive: true, force: true });
  }
  const release = isolated();
  try {
    release.failRelease();
    assert.equal(release.runtime.persist(policy()).status, "recovery_required");
  } finally {
    fs.rmSync(release.rootPath, { recursive: true, force: true });
  }
});

for (const operation of ["resolve", "persist", "revoke"] as const) {
  for (const fault of [
    "identity",
    "protection",
    "user",
    "unavailable",
    "throw",
  ] as const) {
    /**
     * ${operation}: lock取得後のRoot再観測${fault}は既存同意を変更せず回復要求へ閉じるを検証する。
     *
     * @responsibility ${operation}: lock取得後のRoot再観測${fault}は既存同意を変更せず回復要求へ閉じるの合否判定を所有する。
     * @trace EST-IT-004
     * @precondition Test Fileが構築するfixtureと入力を使用する。
     * @stimulus ${operation}: lock取得後のRoot再観測${fault}は既存同意を変更せず回復要求へ閉じるの対象操作を実行する。
     * @observation 結果、状態、Effectおよび終了後条件を観測する。
     * @oracle Test本文のassertionが期待条件を満たす。
     * @cleanup Test本文または登録済みhookが作成資源を清掃する。
     * @boundary EST-IT-004=Related 2 Blocks: Application要求→Policy→Provider Adapter
     */
    test(`${operation}: lock取得後のRoot再観測${fault}は既存同意を変更せず回復要求へ閉じる`, () => {
      const fixture = isolated();
      try {
        assert.equal(fixture.runtime.persist(policy()).status, "confirmed");
        const entries = fs.readdirSync(fixture.rootPath).sort();
        const contents = entries.map((entry) =>
          fs.readFileSync(path.join(fixture.rootPath, entry)),
        );
        const releasesBefore = fixture.readReleaseCount();
        fixture.failReobservation(fault);
        const result =
          operation === "revoke"
            ? fixture.runtime.revoke()
            : fixture.runtime[operation](policy());
        assert.equal(result.status, "recovery_required");
        assert.equal(fixture.readReleaseCount(), releasesBefore + 1);
        assert.deepEqual(fs.readdirSync(fixture.rootPath).sort(), entries);
        assert.deepEqual(
          entries.map((entry) =>
            fs.readFileSync(path.join(fixture.rootPath, entry)),
          ),
          contents,
        );
      } finally {
        fs.rmSync(fixture.rootPath, { recursive: true, force: true });
      }
    });
  }

  /**
   * ${operation}: release例外を同意確認または取消完了へ昇格しないを検証する。
   *
   * @responsibility ${operation}: release例外を同意確認または取消完了へ昇格しないの合否判定を所有する。
   * @trace EST-IT-004
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus ${operation}: release例外を同意確認または取消完了へ昇格しないの対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary EST-IT-004=Related 2 Blocks: Application要求→Policy→Provider Adapter
   */
  test(`${operation}: release例外を同意確認または取消完了へ昇格しない`, () => {
    const fixture = isolated();
    try {
      assert.equal(fixture.runtime.persist(policy()).status, "confirmed");
      const releasesBefore = fixture.readReleaseCount();
      fixture.throwOnRelease();
      const result =
        operation === "revoke"
          ? fixture.runtime.revoke()
          : fixture.runtime[operation](policy());
      assert.equal(result.status, "recovery_required");
      assert.equal(fixture.readReleaseCount(), releasesBefore + 1);
      // The operation may already have changed the pair; release failure is
      // not evidence that it never executed or that cleanup was confirmed.
      assert.equal(
        fs.readdirSync(fixture.rootPath).length,
        operation === "revoke" ? 0 : 2,
      );
    } finally {
      fs.rmSync(fixture.rootPath, { recursive: true, force: true });
    }
  });
}
