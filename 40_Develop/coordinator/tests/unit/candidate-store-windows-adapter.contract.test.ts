/**
 * coordinator:unit:candidate-store-windows-adapterの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:candidate-store-windows-adapterが所有する検証責務を実行する。
 * @trace PPR-UT-014
 * @level UT
 * @scope candidate、store、windows、adapter
 * @boundary N/A: 事実／評価候補分類規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeRuntimeOwnedCandidateStoreRootCapability,
  describeCandidateStoreWindowsAdapterContract,
  inspectRuntimeOwnedWindowsCandidateStore,
} from "../../src/security/candidate-store-windows-adapter.ts";
import { WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE } from "../../src/core/windows-child-environment.ts";

/**
 * source checkoutは署名済みRelease確認前にCandidate Store Effectを開始しないを検証する。
 *
 * @responsibility source checkoutは署名済みRelease確認前にCandidate Store Effectを開始しないの合否判定を所有する。
 * @trace PPR-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus source checkoutは署名済みRelease確認前にCandidate Store Effectを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 事実／評価候補分類規則は外部実行境界を持たない。
 */
test("source checkoutは署名済みRelease確認前にCandidate Store Effectを開始しない", () => {
  const result = inspectRuntimeOwnedWindowsCandidateStore(
    true,
    new Date().toISOString(),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal(result.processEffectIssued, false);
  assert.equal(result.pathReported, false);
  assert.equal(result.principalReported, false);
  assert.equal(result.aclReported, false);
  assert.equal(
    consumeRuntimeOwnedCandidateStoreRootCapability(result.rootCapability),
    null,
  );
});

/**
 * Candidate Store adapterは環境由来の相対Rootをnative照合前に拒否するを検証する。
 *
 * @responsibility Candidate Store adapterは環境由来の相対Rootをnative照合前に拒否するの合否判定を所有する。
 * @trace PPR-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Candidate Store adapterは環境由来の相対Rootをnative照合前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 事実／評価候補分類規則は外部実行境界を持たない。
 */
test("Candidate Store adapterは環境由来の相対Rootをnative照合前に拒否する", () => {
  const original = process.env.LOCALAPPDATA;
  try {
    process.env.LOCALAPPDATA = "relative-root";
    const result = inspectRuntimeOwnedWindowsCandidateStore(
      false,
      new Date().toISOString(),
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "candidate_store_windows_adapter_root_invalid");
    assert.equal(result.processEffectIssued, false);
    assert.equal(result.filesystemEffectIssued, false);
  } finally {
    if (original === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = original;
  }
});

/**
 * Candidate Store adapterは固定Known Folderとexact保護観測だけをAuthority候補にするを検証する。
 *
 * @responsibility Candidate Store adapterは固定Known Folderとexact保護観測だけをAuthority候補にするの合否判定を所有する。
 * @trace PPR-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Candidate Store adapterは固定Known Folderとexact保護観測だけをAuthority候補にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 事実／評価候補分類規則は外部実行境界を持たない。
 */
test("Candidate Store adapterは固定Known Folderとexact保護観測だけをAuthority候補にする", () => {
  const contract = describeCandidateStoreWindowsAdapterContract();
  assert.deepEqual(contract.fixedSegments, [
    "Qual-Lab",
    "CRDD",
    "CandidateStore",
  ]);
  assert.match(contract.initialization, /without_repair/u);
  assert.match(contract.observation, /fixed_volume_non_reparse/u);
  assert.equal(contract.callerSuppliedPathAccepted, false);
  assert.equal(contract.inheritedEnvironmentTrustedDirectly, false);
  assert.equal(
    contract.environment,
    WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
  );
  assert.deepEqual(contract.environmentUnavailable, {
    helperSpawnAttempts: 0,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    rootCapabilityIssued: false,
    runtimeAuthorityIssued: false,
  });
  assert.equal(contract.rawPathReported, false);
  assert.equal(contract.networkEffectIssued, false);
});
