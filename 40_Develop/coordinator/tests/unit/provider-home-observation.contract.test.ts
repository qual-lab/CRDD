/**
 * coordinator:unit:provider-home-observationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:provider-home-observationが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope provider、home、observation
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  createCandidateStoreObservationRequest,
  createProviderHomeObservationRequest,
  createRuntimeStateObservationRequest,
  describeProviderHomeObservationContract,
  evaluateCandidateStoreObservationResponseCandidate,
  evaluateProviderHomeObservationResponseCandidate,
  evaluateRuntimeStateObservationResponseCandidate,
  PROVIDER_HOME_OBSERVATION_REQUEST_BYTES,
  PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES,
} from "../../src/security/provider-home-observation.ts";
import {
  consumeRuntimeOwnedProviderHomeObservationCapability,
  describeProviderHomeWindowsAdapterContract,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
} from "../../src/security/provider-home-windows-adapter.ts";
import { WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE } from "../../src/core/windows-child-environment.ts";

/**
 * responseのTest準備責務を実行する。
 *
 * @responsibility responseがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus responseを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
function response(provider: 1 | 2 | 3 | 4, nonce: Buffer) {
  const bytes = Buffer.alloc(PROVIDER_HOME_OBSERVATION_RESPONSE_BYTES);
  bytes.write("CRDDHO02", 0, "ascii");
  bytes.writeUInt16LE(3, 8);
  bytes[10] = provider;
  bytes[11] = 1;
  nonce.copy(bytes, 12);
  bytes.writeUInt16LE(100, 44);
  bytes.writeUInt32LE(0x83, 46);
  bytes.writeUInt32LE(0x1ff, 50);
  bytes.fill(1, 54, 86);
  bytes.fill(2, 86, 118);
  bytes.fill(3, 118, 150);
  bytes.fill(4, 150, 182);
  return bytes;
}

/**
 * Candidate Store requestは固定種別と初期化bitだけをnative Known Folder照合へ渡すを検証する。
 *
 * @responsibility Candidate Store requestは固定種別と初期化bitだけをnative Known Folder照合へ渡すの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Candidate Store requestは固定種別と初期化bitだけをnative Known Folder照合へ渡すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Candidate Store requestは固定種別と初期化bitだけをnative Known Folder照合へ渡す", () => {
  const nonce = Buffer.alloc(32, 8);
  const source =
    "C:\\Users\\selected\\AppData\\Local\\Qual-Lab\\CRDD\\CandidateStore";
  const created = createCandidateStoreObservationRequest(
    source,
    true,
    () => nonce,
  );
  assert.ok(created);
  assert.equal(created.request[10], 3);
  assert.equal(created.request[11], 1);
  assert.deepEqual(created.request.subarray(12, 44), nonce);
  assert.equal(created.request.includes(Buffer.from("C:\\", "ascii")), false);
  const observed = evaluateCandidateStoreObservationResponseCandidate(
    response(3, nonce),
    nonce,
  );
  assert.equal(observed.status, "candidate");
  assert.equal(observed.selectedUserBindingVerified, true);
  assert.equal(observed.protectionVerified, true);
  assert.equal(observed.pathReported, false);
  assert.equal(
    evaluateCandidateStoreObservationResponseCandidate(
      response(3, nonce),
      Buffer.alloc(32, 9),
    ).status,
    "blocked",
  );
  assert.equal(createCandidateStoreObservationRequest(source, "yes"), null);
});

/**
 * RuntimeState requestは固定Known Folder種別4と初期化bitへ閉じるを検証する。
 *
 * @responsibility RuntimeState requestは固定Known Folder種別4と初期化bitへ閉じるの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus RuntimeState requestは固定Known Folder種別4と初期化bitへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("RuntimeState requestは固定Known Folder種別4と初期化bitへ閉じる", () => {
  const nonce = Buffer.alloc(32, 6);
  const source =
    "C:\\Users\\selected\\AppData\\Local\\Qual-Lab\\CRDD\\RuntimeState";
  const created = createRuntimeStateObservationRequest(
    source,
    true,
    () => nonce,
  );
  assert.ok(created);
  assert.equal(created.request[10], 4);
  assert.equal(created.request[11], 1);
  assert.equal(created.request.includes(Buffer.from("C:\\", "ascii")), false);
  const observed = evaluateRuntimeStateObservationResponseCandidate(
    response(4, nonce),
    nonce,
  );
  assert.equal(observed.status, "candidate");
  assert.match(observed.stableLogicalHomeBindingHash ?? "", /^[a-f0-9]{64}$/u);
});

/**
 * Provider Home requestはRuntime nonce、Providerとraw Pathでないmount source Hashだけを含めるを検証する。
 *
 * @responsibility Provider Home requestはRuntime nonce、Providerとraw Pathでないmount source Hashだけを含めるの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider Home requestはRuntime nonce、Providerとraw Pathでないmount source Hashだけを含めるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Provider Home requestはRuntime nonce、Providerとraw Pathでないmount source Hashだけを含める", () => {
  const nonce = Buffer.alloc(32, 7);
  const source =
    "C:\\Users\\selected\\AppData\\Local\\Qual-Lab\\CRDD\\ProviderHomes\\claude";
  const created = createProviderHomeObservationRequest(
    "claude",
    source,
    () => nonce,
  );
  assert.ok(created);
  assert.equal(created.request.length, PROVIDER_HOME_OBSERVATION_REQUEST_BYTES);
  assert.equal(created.request.subarray(0, 8).toString("ascii"), "CRDDPH02");
  assert.equal(created.request.readUInt16LE(8), 3);
  assert.equal(created.request[10], 2);
  assert.equal(created.request[11], 0);
  assert.deepEqual(created.request.subarray(12, 44), nonce);
  assert.equal(
    created.request.subarray(44, 76).equals(Buffer.alloc(32)),
    false,
  );
  assert.equal(created.request.includes(Buffer.from("C:\\", "ascii")), false);
  assert.equal(createProviderHomeObservationRequest("other", source), null);
  assert.equal(createProviderHomeObservationRequest("codex", ""), null);
  assert.equal(
    createProviderHomeObservationRequest("codex", source, () =>
      Buffer.alloc(31),
    ),
    null,
  );
});

/**
 * Provider Home responseはnonce、Provider、全観測bitと四つのdomain hashを検証するを検証する。
 *
 * @responsibility Provider Home responseはnonce、Provider、全観測bitと四つのdomain hashを検証するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider Home responseはnonce、Provider、全観測bitと四つのdomain hashを検証するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Provider Home responseはnonce、Provider、全観測bitと四つのdomain hashを検証する", () => {
  const nonce = Buffer.alloc(32, 9);
  const result = evaluateProviderHomeObservationResponseCandidate(
    response(2, nonce),
    nonce,
    "claude",
  );
  assert.equal(result.status, "candidate");
  assert.equal(result.provider, "claude");
  assert.equal(result.selectedUserBindingVerified, true);
  assert.equal(result.protectionVerified, true);
  assert.equal(result.stableIdentityObserved, true);
  assert.equal(result.pathReported, false);
  assert.equal(result.principalReported, false);
  assert.equal(result.aclReported, false);
  assert.equal(result.credentialContentRead, false);
  assert.equal(result.runtimeAuthorityIssued, false);
  assert.equal(result.mountGrantIssued, false);
});

/**
 * Provider Home responseは旧版、余分byte、未知bit、zero／重複hashを拒否するを検証する。
 *
 * @responsibility Provider Home responseは旧版、余分byte、未知bit、zero／重複hashを拒否するの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider Home responseは旧版、余分byte、未知bit、zero／重複hashを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Provider Home responseは旧版、余分byte、未知bit、zero／重複hashを拒否する", () => {
  const nonce = Buffer.alloc(32, 4);
  const candidates: Buffer[] = [];
  const legacy = response(1, nonce);
  legacy.writeUInt16LE(0, 8);
  candidates.push(legacy);
  candidates.push(Buffer.concat([response(1, nonce), Buffer.from([0])]));
  const unknownPrincipal = response(1, nonce);
  unknownPrincipal.writeUInt32LE(0x183, 46);
  candidates.push(unknownPrincipal);
  const missingHomeFlag = response(1, nonce);
  missingHomeFlag.writeUInt32LE(0xff, 50);
  candidates.push(missingHomeFlag);
  const zeroHash = response(1, nonce);
  zeroHash.fill(0, 54, 86);
  candidates.push(zeroHash);
  const duplicateHash = response(1, nonce);
  duplicateHash.fill(1, 86, 118);
  candidates.push(duplicateHash);
  const duplicateStableHash = response(1, nonce);
  duplicateStableHash.copyWithin(150, 54, 86);
  candidates.push(duplicateStableHash);
  for (const candidate of candidates) {
    assert.equal(
      evaluateProviderHomeObservationResponseCandidate(
        candidate,
        nonce,
        "codex",
      ).status,
      "blocked",
    );
  }
  assert.equal(
    evaluateProviderHomeObservationResponseCandidate(
      response(1, nonce),
      Buffer.alloc(32, 5),
      "codex",
    ).status,
    "blocked",
  );
  assert.equal(
    evaluateProviderHomeObservationResponseCandidate(
      response(1, nonce),
      nonce,
      "claude",
    ).status,
    "blocked",
  );
});

/**
 * Provider Home observation contractはcaller PathとCredential readを持たないを検証する。
 *
 * @responsibility Provider Home observation contractはcaller PathとCredential readを持たないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider Home observation contractはcaller PathとCredential readを持たないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Provider Home observation contractはcaller PathとCredential readを持たない", () => {
  const contract = describeProviderHomeObservationContract();
  assert.equal(contract.callerSuppliedPathAccepted, false);
  assert.equal(contract.requestPathField, false);
  assert.equal(contract.requestMountSourceHashField, true);
  assert.equal(contract.requestMountSourceHashAuthority, false);
  assert.deepEqual(contract.candidateStoreFixedSegments, [
    "Qual-Lab",
    "CRDD",
    "CandidateStore",
  ]);
  assert.equal(contract.credentialContentRead, false);
  assert.equal(contract.rawPathReported, false);
  assert.equal(contract.runtimeAuthorityIssued, false);
  assert.equal(contract.mountGrantIssued, false);
  const adapter = describeProviderHomeWindowsAdapterContract();
  assert.equal(adapter.contractRevision, 5);
  assert.equal(adapter.shellInvocation, false);
  assert.equal(adapter.pathLookup, false);
  assert.equal(adapter.callerSuppliedPathAccepted, false);
  assert.equal(
    adapter.environment,
    WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
  );
  assert.deepEqual(adapter.environmentUnavailable, {
    helperSpawnAttempts: 0,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    observationCapabilityIssued: false,
    runtimeAuthorityIssued: false,
  });
  assert.equal(
    adapter.processTreeTerminationConfirmation.includes("step_4"),
    true,
  );
  const invalid = inspectRuntimeOwnedWindowsProviderHomeCandidate(
    "other",
    "2026-08-24T00:00:00.000Z",
  );
  assert.equal(invalid.status, "blocked");
  assert.equal(invalid.helperSpawnAttempts, 0);
  assert.equal(invalid.runtimeOwnedObservationCapabilityIssued, false);
  assert.equal(consumeRuntimeOwnedProviderHomeObservationCapability({}), null);
});
