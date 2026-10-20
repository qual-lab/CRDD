/**
 * Quality Definitionの中立Issueを旧表示へ接続する契約を検証する。
 * @packageDocumentation
 * @responsibility 実本文Issueの順序・位置と動的文言の必要情報を固定する。
 * @trace RCM-UT-002
 * @level UT
 * @scope report、quality-definition
 * @boundary RCM-UT-002=N/A: 同期モデル検査と値変換。
 */
import { mapQualityDefinitionIssueToFinding } from "../../../src/report/quality.ts";

import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectQualityDefinition,
  inspectQualityLocalItemOwnership,
} from "../../../../domain-model/src/index.ts";

import type { DomainIssue } from "../../../../domain-model/src/index.ts";

/**
 * 実本文と所有重複のIssueを表示まで接続する。
 * @responsibility 空本文の九条件と最後の所有重複の順序・四fieldを固定する。
 * @trace RCM-UT-002
 * @precondition 空の本文と重複Local IDを用意する。
 * @stimulus 本文検査、所有検査、表示変換を実行する。
 * @observation code、path、severityと重複の文言を取得する。
 * @oracle 九つの本文診断に続いて既存Ownerを示す重複診断が届く。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期値処理。
 */
test("Quality Definitionの実Issueは旧表示の順序と位置を維持する", () => {
  const artifact = { path: "definition.md", content: "" };
  const issues = [
    ...inspectQualityDefinition(artifact, "QA-000001").issues,
    ...inspectQualityLocalItemOwnership(
      artifact.path,
      ["SAMPLE-UT-001"],
      new Map([["SAMPLE-UT-001", "previous.md"]]),
    ).issues,
  ];
  const findings = issues.map(mapQualityDefinitionIssueToFinding);
  assert.deepEqual(
    findings.map((f) => f.code),
    [
      "quality-definition-identity-mismatch",
      "quality-definition-source-coverage-missing",
      "quality-definition-detail-coverage-missing",
      "quality-verification-state-applicability-incomplete",
      "quality-verification-item-schema-invalid",
      "quality-test-level-applicability-incomplete",
      "quality-primary-test-level-summary-mismatch",
      "quality-additional-test-type-applicability-incomplete",
      "quality-definition-verification-items-missing",
      "quality-local-verification-id-duplicate",
    ],
  );
  assert.ok(
    findings.every((f) => f.path === "definition.md" && f.severity === "error"),
  );
  assert.equal(
    findings.at(-1)?.message,
    "Local verification ID SAMPLE-UT-001 is already owned by previous.md.",
  );
});

/**
 * 動的文言の必要情報と未知Issueの拒否を検証する。
 * @responsibility Local ID、条件区分、既存Ownerの不足を正常表示しない。
 * @trace RCM-UT-002
 * @precondition 固定kindと必要なdetailsを用意する。
 * @stimulus detailsの欠落・種類違い・未知kindを渡す。
 * @observation 文言と拒否例外を取得する。
 * @oracle 三つの動的表示が旧文言となり、不足値や未知kindを拒否する。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期表示変換。
 */
test("Quality Definitionの表示は動的な診断情報の不足を拒否する", () => {
  const base: DomainIssue = {
    kind: "artifact.quality.verification-item-id-level-mismatch",
    targetIdentity: "definition.md",
    location: { path: "definition.md" },
    reason: "verification-item-id-level-mismatch",
    details: { localId: "SAMPLE-UT-001" },
  };
  assert.equal(
    mapQualityDefinitionIssueToFinding(base).message,
    "Local Item SAMPLE-UT-001 must encode the same test level declared by its verification-item row.",
  );
  for (const [violation, message] of [
    ["rationale", "正常 applicability must include a rationale."],
    [
      "local-items",
      "正常 applicability must agree with the Local Items defined by the same Quality Definition.",
    ],
  ] as const) {
    assert.equal(
      mapQualityDefinitionIssueToFinding({
        ...base,
        kind: "artifact.quality.verification-state-applicability-invalid",
        details: { state: "正常", violation },
      }).message,
      message,
    );
  }
  for (const kind of [
    base.kind,
    "artifact.quality.verification-state-applicability-invalid",
    "artifact.quality.local-verification-id-duplicate",
  ]) {
    assert.throws(
      () => mapQualityDefinitionIssueToFinding({ ...base, kind, details: {} }),
      /invalid_quality_definition_issue_details/u,
    );
  }
  assert.throws(
    () => mapQualityDefinitionIssueToFinding({ ...base, kind: "unknown" }),
    /unknown_quality_definition_domain_issue/u,
  );
});
