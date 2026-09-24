/**
 * Runtime Trust判断とPackage Gateの直接境界を検証する。
 *
 * @packageDocumentation
 * @responsibility Deployment Owner Policyの判断が同一Artifactへ結合され、Authority Gateで安全に消費されることを検証する。
 * @trace AIT-IT-014
 * @level IT
 * @scope Artifact観測、Deployment Policy、Authority Gate
 * @boundary AIT-IT-014=Direct Boundary: Artifact観測→Deployment Policy→Authority Gate
 */
import assert from "node:assert/strict";
import test from "node:test";

import { consumeRuntimeTrustDecisionForPackageGate } from "../../src/security/platform-provisioner-package-gate.ts";
import { evaluateRuntimeTrust } from "../../src/security/runtime-trust-evaluator.ts";

const artifactIdentity = "a".repeat(64);

/**
 * Deployment Owner Policyがtrustedとした同一ArtifactだけをGateで受理する。
 *
 * @responsibility Trust評価とGate消費を同じArtifact Identity・Policy revisionへ結合する。
 * @trace AIT-IT-014
 * @precondition 全軸が既知で、PolicyがPublisherを明示的に許可している。
 * @stimulus Trust Evaluatorの結果をPackage Gateの消費境界へ渡す。
 * @observation accepted、Policy revisionおよびAuthority非発行を観測する。
 * @oracle 同一Artifactだけacceptedになり、Gate消費自体はAuthorityを発行しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary AIT-IT-014=Direct Boundary: Artifact観測→Deployment Policy→Authority Gate
 */
test("Deployment Owner Policyがtrustedとした同一ArtifactだけをGateで受理する", () => {
  const decision = evaluateRuntimeTrust({
    artifactIdentity,
    observedAt: "2026-09-21T00:00:00.000Z",
    usage: "fork",
    axes: {
      conformance: "pass",
      integrity: "verified",
      publisher: "identified",
      publisherIdentity: "approved-fork",
      quality: "assured",
    },
    policy: {
      revision: "deployment-policy-7",
      allowedPublishers: ["approved-fork"],
      allowUnsignedLocalDevelopment: false,
      requireConformance: true,
      requireQualityAssurance: true,
    },
  });
  const accepted = consumeRuntimeTrustDecisionForPackageGate(
    decision,
    artifactIdentity,
  );
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.policyRevision, "deployment-policy-7");
  assert.equal(accepted.runtimeAuthorityConferred, false);
  assert.equal(accepted.runtimeCapabilityIssued, false);
});

/**
 * Identity不一致、未知軸およびAuthority混入をGateで拒否する。
 *
 * @responsibility Trust判断を別Artifactへ流用せず、unknownや権限混入を安全側へ閉じる。
 * @trace AIT-IT-014
 * @precondition 評価結果は別Identity、unknown軸または不正Authority fieldを持つ。
 * @stimulus 各反例をPackage Gateの消費境界へ渡す。
 * @observation accepted、理由およびAuthority非発行を観測する。
 * @oracle 全反例を拒否し、Qual-Lab固定許可や署名Passによるfallbackを行わない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary AIT-IT-014=Direct Boundary: Artifact観測→Deployment Policy→Authority Gate
 */
test("Identity不一致、未知軸およびAuthority混入をGateで拒否する", () => {
  const unknown = evaluateRuntimeTrust({
    artifactIdentity,
    observedAt: "2026-09-21T00:00:00.000Z",
    usage: "official",
    axes: {
      conformance: "unknown",
      integrity: "verified",
      publisher: "identified",
      publisherIdentity: "qual-lab",
      quality: "assured",
    },
    policy: {
      revision: "deployment-policy-1",
      allowedPublishers: ["qual-lab"],
      allowUnsignedLocalDevelopment: false,
      requireConformance: true,
      requireQualityAssurance: true,
    },
  });
  assert.equal(
    consumeRuntimeTrustDecisionForPackageGate(unknown, artifactIdentity)
      .accepted,
    false,
  );

  const trusted = evaluateRuntimeTrust({
    artifactIdentity,
    observedAt: "2026-09-21T00:00:00.000Z",
    usage: "official",
    axes: {
      conformance: "pass",
      integrity: "verified",
      publisher: "identified",
      publisherIdentity: "qual-lab",
      quality: "assured",
    },
    policy: {
      revision: "deployment-policy-1",
      allowedPublishers: ["qual-lab"],
      allowUnsignedLocalDevelopment: false,
      requireConformance: true,
      requireQualityAssurance: true,
    },
  });
  assert.equal(
    consumeRuntimeTrustDecisionForPackageGate(trusted, "b".repeat(64)).accepted,
    false,
  );
  assert.equal(
    consumeRuntimeTrustDecisionForPackageGate(
      { ...trusted, runtimeAuthorityConferred: true },
      artifactIdentity,
    ).accepted,
    false,
  );
});
