/**
 * coordinator:integration:external-send-consent-docker-recoveryの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:external-send-consent-docker-recoveryが所有する検証責務を実行する。
 * @trace EST-IT-004
 * @level IT
 * @scope external、send、consent、docker、recovery
 * @boundary Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  compileExternalSendConsentBoundaryHash,
  createIsolatedExternalSendConsentRuntimeCandidate,
  EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX,
} from "../../src/security/external-send-consent-runtime.ts";
import { inspectDockerRecoveryRootSnapshotWithLock } from "../../src/security/docker-recovery-runtime-internal.ts";
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
 * @boundary Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
function policy(): ExternalSendPolicy {
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
  }) as ExternalSendPolicy;
}

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-IT-004
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
function fixture() {
  const rootPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-consent-recovery-integration-"),
  );
  const root = Object.freeze({
    rootPath,
    runtimeStateIdentityHash: "1".repeat(64),
    runtimeStateProtectionHash: "2".repeat(64),
    localUserBindingHash: "3".repeat(64),
    stableLogicalHomeBindingHash: "4".repeat(64),
  });
  let nonce = 0;
  const runtime = createIsolatedExternalSendConsentRuntimeCandidate({
    observeRoot: () => root,
    acquireLock: () => Object.freeze({ release: () => true }),
    now: () => 1_000_000,
    nonce: () => (++nonce).toString(16).padStart(16, "0"),
  } as unknown as Parameters<
    typeof createIsolatedExternalSendConsentRuntimeCandidate
  >[0]);
  return Object.freeze({ rootPath, root, runtime });
}

/**
 * inspectRecoveryRootのTest準備責務を実行する。
 *
 * @responsibility inspectRecoveryRootがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-IT-004
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus inspectRecoveryRootを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
function inspectRecoveryRoot(root: ReturnType<typeof fixture>["root"]) {
  return inspectDockerRecoveryRootSnapshotWithLock(root, () =>
    Object.freeze({ release: () => true }),
  );
}

/**
 * 実Consent producerの現行recordをDocker Recovery inventoryが非Authority namespaceとして受理するを検証する。
 *
 * @responsibility 実Consent producerの現行recordをDocker Recovery inventoryが非Authority namespaceとして受理するの合否判定を所有する。
 * @trace EST-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実Consent producerの現行recordをDocker Recovery inventoryが非Authority namespaceとして受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
test("実Consent producerの現行recordをDocker Recovery inventoryが非Authority namespaceとして受理する", () => {
  const target = fixture();
  try {
    assert.equal(target.runtime.persist(policy()).status, "confirmed");
    const entries = fs.readdirSync(target.rootPath);
    assert.equal(
      entries.filter((entry) =>
        entry.startsWith(EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX),
      ).length,
      2,
    );
    assert.deepEqual(inspectRecoveryRoot(target.root), {
      status: "completed",
      reason: "docker_task_runtime_state_clean",
      manualRecoveryRequired: false,
      dockerRecoveryId: null,
      dockerRecoveryIds: [],
      activeStableLogicalHomeBindingHashes: [],
    });
  } finally {
    fs.rmSync(target.rootPath, { recursive: true, force: true });
  }
});

/**
 * 破損または部分Consent pairはRecovery Authorityへ昇格せずConsent ownerが失効して残存0にするを検証する。
 *
 * @responsibility 破損または部分Consent pairはRecovery Authorityへ昇格せずConsent ownerが失効して残存0にするの合否判定を所有する。
 * @trace EST-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 破損または部分Consent pairはRecovery Authorityへ昇格せずConsent ownerが失効して残存0にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
test("破損または部分Consent pairはRecovery Authorityへ昇格せずConsent ownerが失効して残存0にする", () => {
  for (const scenario of ["content_mismatch", "record_only"] as const) {
    const target = fixture();
    try {
      assert.equal(target.runtime.persist(policy()).status, "confirmed");
      const recordName = fs
        .readdirSync(target.rootPath)
        .find(
          (entry) =>
            entry.startsWith(EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX) &&
            !entry.endsWith(".crdd-commit.json"),
        );
      assert.ok(recordName);
      const recordPath = path.join(target.rootPath, recordName);
      const commitPath = `${recordPath}.crdd-commit.json`;
      if (scenario === "content_mismatch") fs.writeFileSync(recordPath, "{}\n");
      else fs.rmSync(commitPath);

      assert.equal(inspectRecoveryRoot(target.root).status, "completed");
      assert.equal(target.runtime.resolve(policy()).status, "absent");
      assert.deepEqual(fs.readdirSync(target.rootPath), []);
    } finally {
      fs.rmSync(target.rootPath, { recursive: true, force: true });
    }
  }
});

/**
 * 異なる二世代のConsent namespaceはRecovery inventoryで競合として停止するを検証する。
 *
 * @responsibility 異なる二世代のConsent namespaceはRecovery inventoryで競合として停止するの合否判定を所有する。
 * @trace EST-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 異なる二世代のConsent namespaceはRecovery inventoryで競合として停止するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
test("異なる二世代のConsent namespaceはRecovery inventoryで競合として停止する", () => {
  const target = fixture();
  try {
    assert.equal(target.runtime.persist(policy()).status, "confirmed");
    const secondBoundary = compileExternalSendConsentBoundaryHash(
      Object.freeze({ ...policy(), sourceFileHash: "c".repeat(64) }),
    );
    assert.ok(secondBoundary);
    const secondName = `${EXTERNAL_SEND_ACTIVE_CONSENT_PREFIX}${secondBoundary}-${"f".repeat(16)}.json`;
    fs.writeFileSync(path.join(target.rootPath, secondName), "{}\n");
    assert.equal(inspectRecoveryRoot(target.root).status, "blocked");
  } finally {
    fs.rmSync(target.rootPath, { recursive: true, force: true });
  }
});
