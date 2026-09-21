/**
 * coordinator:unit:platform-provisioner-package-gateの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:platform-provisioner-package-gateが所有する検証責務を実行する。
 * @trace AIT-UT-005
 * @level UT
 * @scope platform、provisioner、package、gate
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  type KeyObject,
  sign,
  verify,
} from "node:crypto";
import test from "node:test";

import {
  describePlatformProvisionerPackageGateContract,
  evaluatePlatformProvisionerPackageGateCandidate,
} from "../../src/security/platform-provisioner-package-gate.ts";
import {
  calculatePlatformProvisionerPackageContentRootCandidate,
  calculateRuntimeExecutionIdentityCandidate,
  PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
  PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_REVISION,
} from "../../src/security/platform-provisioner-trust-core.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../../src/security/provisioning-signature-primitives.ts";
import { assertCanonicalCandidate } from "../support/test-support.ts";

const fixturePrivateKeys = new WeakMap<object, KeyObject>();

/**
 * frameのTest準備責務を実行する。
 *
 * @responsibility frameがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus frameを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
function frame(payload: Record<string, unknown>) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(payload);
  assertCanonicalCandidate(canonical);
  const bytes = canonical.canonicalBytes;
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  return Buffer.concat([
    Buffer.from(PLATFORM_PROVISIONER_MANIFEST_DOMAIN, "ascii"),
    length,
    bytes,
  ]);
}

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-UT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
function fixture() {
  const release = generateKeyPairSync("ed25519");
  const spki = release.publicKey.export({ format: "der", type: "spki" });
  const keyId = createHash("sha256").update(spki).digest("hex");
  const observedPackageContent = {
    packageName: "@qual-lab/crdd-coordinator",
    packageVersion: "0.0.0-development",
    files: [
      { path: "bin/coordinator.ts", byteLength: 100, sha256: "1".repeat(64) },
    ],
  };
  const packageRoot = calculatePlatformProvisionerPackageContentRootCandidate(
    observedPackageContent,
  );
  if (packageRoot.status !== "candidate") {
    assert.fail(`fixture package content was invalid: ${packageRoot.reason}`);
  }
  const packageContentRootSha256 = packageRoot.packageContentRootSha256;
  const executionFields = {
    packageName: observedPackageContent.packageName,
    packageVersion: observedPackageContent.packageVersion,
    packageContentRootSha256,
    rootProtectionPolicySha256: "2".repeat(64),
    keyStoragePolicySha256: "3".repeat(64),
    platformAccessArtifact: {
      relativePath:
        "template/tools/coordinator/windows-x64/crdd-platform-access.exe",
      target: "x86_64-pc-windows-msvc",
      protocolRevision: 3,
      rustToolchain: "1.94.1",
      byteLength: 1024,
      sha256: "4".repeat(64),
    },
  };
  const runtimeIdentity =
    calculateRuntimeExecutionIdentityCandidate(executionFields);
  assert.equal(runtimeIdentity.status, "candidate");
  const payload = {
    contract: PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
    contractRevision: PLATFORM_PROVISIONER_MANIFEST_REVISION,
    crddVersion: "v0.18.0",
    releaseSequence: 18,
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    ...executionFields,
    runtimeExecutionIdentitySha256:
      runtimeIdentity.runtimeExecutionIdentitySha256,
    issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt: "2027-08-15T00:00:00.000Z",
  };
  const manifestEnvelope = {
    contract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
    contractRevision: PLATFORM_PROVISIONER_MANIFEST_REVISION,
    payload,
    signatures: [
      {
        keyId,
        algorithm: "Ed25519",
        signature: sign(null, frame(payload), release.privateKey).toString(
          "base64url",
        ),
      },
    ],
  };
  const value = {
    manifestVerificationInput: {
      manifestEnvelope,
      releaseSignerSpkiDer: spki,
      observedPackageContent,
      evaluationTime: "2026-08-15T12:00:00.000Z",
    },
    crddDistributionObservation: {
      packageName: observedPackageContent.packageName,
      packageVersion: observedPackageContent.packageVersion,
      packageContentRootSha256,
      runtimeExecutionIdentitySha256: payload.runtimeExecutionIdentitySha256,
      crddVersion: payload.crddVersion,
      crddCommit: payload.crddCommit,
      crddTree: payload.crddTree,
      distributionVerdict: "verified_crdd_bundle",
      bundledPackageIdentityStable: true,
      permissionPolicyMatch: true,
    },
    expectedCrddVersion: payload.crddVersion,
    expectedCrddCommit: payload.crddCommit,
    expectedCrddTree: payload.crddTree,
    runtimeTrustDecision: {
      contract: "crdd-coordinator/runtime-trust-decision",
      contractRevision: 1,
      artifactIdentity: payload.runtimeExecutionIdentitySha256,
      observedAt: "2026-08-15T12:00:00.000Z",
      policyRevision: "deployment-policy-1",
      axes: {
        conformance: "pass",
        integrity: "verified",
        publisher: "identified",
        publisherIdentity: "qual-lab",
        quality: "assured",
      },
      trust: "trusted",
      reason: "runtime_trust_policy_satisfied",
      effectAuthorizationIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    },
  };
  fixturePrivateKeys.set(value, release.privateKey);
  return value;
}

/**
 * 削除済み旧manifest revisionをGateへ昇格しないを検証する。
 *
 * @responsibility 削除済み旧manifest revisionをGateへ昇格しないの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 削除済み旧manifest revisionをGateへ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("削除済み旧manifest revisionをGateへ昇格しない", () => {
  const value = fixture();
  const payload = value.manifestVerificationInput.manifestEnvelope.payload;
  payload.contractRevision = 3;
  value.manifestVerificationInput.manifestEnvelope.contractRevision = 3;
  const privateKey = fixturePrivateKeys.get(value);
  assert.ok(privateKey);
  const signature = sign(null, frame(payload), privateKey).toString(
    "base64url",
  );
  const signatureEntry =
    value.manifestVerificationInput.manifestEnvelope.signatures[0];
  assert.ok(signatureEntry);
  signatureEntry.signature = signature;
  assert.equal(
    verify(
      null,
      frame(payload),
      {
        key: value.manifestVerificationInput.releaseSignerSpkiDer,
        format: "der",
        type: "spki",
      },
      Buffer.from(signature, "base64url"),
    ),
    true,
  );
  const result = evaluatePlatformProvisionerPackageGateCandidate(value);
  assert.equal(result.status, "blocked");
  assert.deepEqual(Object.keys(result).sort(), [
    "crddDistributionObservationRuntimeOwned",
    "effectAuthorizationIssued",
    "filesystemEffectIssued",
    "networkEffectIssued",
    "packageFilesystemRuntimeOwned",
    "reason",
    "releaseIdentityRuntimeOwned",
    "runtimeAuthorityConferred",
    "runtimeCapabilityIssued",
    "status",
  ]);
  for (const key of Object.keys(result).filter(
    (key) => key !== "status" && key !== "reason",
  ))
    assert.equal(result[key as keyof typeof result], false);
});

/**
 * CRDD bundle and manifest observations match but remain non-authoritativeを検証する。
 *
 * @responsibility CRDD bundle and manifest observations match but remain non-authoritativeの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CRDD bundle and manifest observations match but remain non-authoritativeの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("CRDD bundle and manifest observations match but remain non-authoritative", () => {
  const result = evaluatePlatformProvisionerPackageGateCandidate(fixture());
  assert.equal(result.status, "candidate");
  assert.equal(result.packageTrustObservationMatch, true);
  assert.equal(result.runtimeTrustPolicyMatch, true);
  assert.equal(result.trustPolicyRevision, "deployment-policy-1");
  assert.equal(result.crddDistributionObservationRuntimeOwned, false);
  assert.equal(result.effectAuthorizationIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  for (const key of [
    "files",
    "packageContentRootSha256",
    "signature",
    "spkiDer",
  ]) {
    assert.equal(key in result, false);
  }
});

/**
 * Runtime Execution Identity、content、配布観測とpermissionの不一致をfail closedにするを検証する。
 *
 * @responsibility Runtime Execution Identity、content、配布観測とpermissionの不一致をfail closedにするの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Runtime Execution Identity、content、配布観測とpermissionの不一致をfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("Runtime Execution Identity、content、配布観測とpermissionの不一致をfail closedにする", () => {
  const mutations: Array<(value: ReturnType<typeof fixture>) => void> = [
    (value) => {
      value.crddDistributionObservation.distributionVerdict = "missing";
    },
    (value) => {
      value.crddDistributionObservation.packageContentRootSha256 = "f".repeat(
        64,
      );
    },
    (value) => {
      value.crddDistributionObservation.runtimeExecutionIdentitySha256 =
        "e".repeat(64);
    },
    (value) => {
      value.crddDistributionObservation.bundledPackageIdentityStable = false;
    },
    (value) => {
      value.crddDistributionObservation.permissionPolicyMatch = false;
    },
  ];
  for (const mutate of mutations) {
    const value = fixture();
    mutate(value);
    assert.equal(
      evaluatePlatformProvisionerPackageGateCandidate(value).status,
      "blocked",
    );
  }
});

/**
 * package gate cannot treat caller CRDD observations as Effect authorizationを検証する。
 *
 * @responsibility package gate cannot treat caller CRDD observations as Effect authorizationの合否判定を所有する。
 * @trace AIT-UT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus package gate cannot treat caller CRDD observations as Effect authorizationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-UT-005=N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
 */
test("package gate cannot treat caller CRDD observations as Effect authorization", () => {
  const contract = describePlatformProvisionerPackageGateContract();
  assert.equal(
    contract.distributionModel,
    "crdd_bundled_private_typescript_package",
  );
  assert.equal(
    contract.observationContract,
    "implemented_candidate_non_authoritative",
  );
  assert.equal(contract.runtimeOwnedCrddDistributionAdapter, "not_implemented");
  assert.equal(
    contract.runtimeExecutionIdentityBinding,
    "implemented_candidate",
  );
  assert.equal(contract.callerObservationMayAuthorizeEffect, false);
  assert.equal(contract.standalonePackageMayAuthorizeEffect, false);
  assert.equal(contract.effectAuthorizationIssued, false);
  assert.equal(
    contract.effectController,
    "not_implemented_effective_access_required",
  );
});
