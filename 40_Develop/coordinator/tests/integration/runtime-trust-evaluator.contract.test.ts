/**
 * Runtime Trust EvaluatorとDeployment Owner Policyの結合契約を検証する。
 *
 * @packageDocumentation
 * @responsibility 同一Artifactの軸別観測がPolicyで評価され、単一軸から信頼やAuthorityを推定しないことを検証する。
 * @trace AIT-IT-001
 * @trace AIT-IT-003
 * @level IT
 * @scope Runtime Artifact、Trust Evaluator、Deployment Owner Policy
 * @boundary AIT-IT-001=Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy / AIT-IT-003=Direct Boundary: 検証材料Reader→Trust Evaluator
 */
import assert from "node:assert/strict";
import test from "node:test";

import { evaluateRuntimeTrust } from "../../src/security/runtime-trust-evaluator.ts";

/**
 * Trust評価用の同一Artifact入力を構築する。
 *
 * @responsibility 各Test Caseが一軸またはPolicyだけを変更できる基準入力を返す。
 * @trace AIT-IT-001
 * @precondition 上書き値は評価契約のPropertyへ限定する。
 * @stimulus 基準入力へ指定された軸・Policy差分を適用する。
 * @observation 同一Artifact Identityを保持した入力を返す。
 * @oracle 呼出し側が軸別結果とPolicy判断を比較できる。
 * @cleanup N/A: Process内の値だけを生成する。
 * @boundary AIT-IT-001=Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
 */
function input(overrides: Record<string, unknown> = {}) {
  return {
    artifactIdentity: "a".repeat(64),
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
    ...overrides,
  };
}

/**
 * 公式、組織、Fork、Local開発を同じPolicy契約で評価する。
 *
 * @responsibility Publisher種別を固定許可へ畳まずDeployment Owner Policyだけが最終判断を決めることを検証する。
 * @trace AIT-IT-001
 * @precondition 各入力は同じArtifact Identityと既知の軸別観測を持つ。
 * @stimulus 許可PublisherとLocal unsigned許可を変えて評価する。
 * @observation 軸別結果、Policy revision、trust、理由およびAuthority非発行を観測する。
 * @oracle Policyが許可した公式・組織・Fork・Localだけtrustedになり、結果軸は保持される。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary AIT-IT-001=Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
 */
test("公式、組織、Fork、Local開発を同じPolicy契約で評価する", () => {
  const official = evaluateRuntimeTrust(input());
  assert.equal(official.trust, "trusted");
  assert.equal(official.policyRevision, "deployment-policy-1");
  assert.equal(official.axes?.integrity, "verified");
  assert.equal(official.runtimeAuthorityConferred, false);
  assert.equal(official.runtimeCapabilityIssued, false);

  const organization = evaluateRuntimeTrust(
    input({
      usage: "organization",
      axes: {
        conformance: "pass",
        integrity: "verified",
        publisher: "identified",
        publisherIdentity: "organization-a",
        quality: "assured",
      },
      policy: {
        revision: "organization-policy-2",
        allowedPublishers: ["organization-a"],
        allowUnsignedLocalDevelopment: false,
        requireConformance: true,
        requireQualityAssurance: true,
      },
    }),
  );
  assert.equal(organization.trust, "trusted");

  const fork = evaluateRuntimeTrust(
    input({
      usage: "fork",
      axes: {
        conformance: "pass",
        integrity: "verified",
        publisher: "identified",
        publisherIdentity: "fork-owner",
        quality: "assured",
      },
    }),
  );
  assert.equal(fork.trust, "not_trusted");

  const local = evaluateRuntimeTrust(
    input({
      usage: "local_development",
      axes: {
        conformance: "pass",
        integrity: "verified",
        publisher: "unidentified",
        publisherIdentity: null,
        quality: "assured",
      },
      policy: {
        revision: "local-policy-1",
        allowedPublishers: [],
        allowUnsignedLocalDevelopment: true,
        requireConformance: true,
        requireQualityAssurance: true,
      },
    }),
  );
  assert.equal(local.trust, "trusted");
});

/**
 * 不明軸と単一軸Passをtrustedへ昇格しない。
 *
 * @responsibility 観測不能と拒否を区別し、一つの成功軸が全体保証を作らないことを検証する。
 * @trace AIT-IT-003
 * @precondition Artifact IdentityとPolicyは有効だが軸の一部がunknownまたはfailである。
 * @stimulus unknownと準拠failの入力をそれぞれ評価する。
 * @observation trust、理由、軸別結果およびAuthority非発行を観測する。
 * @oracle unknownはunknown、準拠failはnot_trustedとなり、いずれもAuthorityを発行しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary AIT-IT-003=Direct Boundary: 検証材料Reader→Trust Evaluator
 */
test("不明軸と単一軸Passをtrustedへ昇格しない", () => {
  const unknown = evaluateRuntimeTrust(
    input({
      axes: {
        conformance: "unknown",
        integrity: "verified",
        publisher: "identified",
        publisherIdentity: "qual-lab",
        quality: "assured",
      },
    }),
  );
  assert.equal(unknown.trust, "unknown");
  assert.equal(unknown.reason, "runtime_trust_required_axis_unknown");

  const rejected = evaluateRuntimeTrust(
    input({
      axes: {
        conformance: "fail",
        integrity: "verified",
        publisher: "identified",
        publisherIdentity: "qual-lab",
        quality: "assured",
      },
    }),
  );
  assert.equal(rejected.trust, "not_trusted");
  assert.equal(rejected.runtimeAuthorityConferred, false);
});
