/**
 * Quality状態・分析・関係Issueの公開診断変換を検証する。
 * @packageDocumentation
 * @responsibility 全39kindの既存code・文言と、未知kind・必要値不足の拒否を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope report、quality-analysis、quality-relations
 * @boundary RCM-UT-002=N/A: 中立Issueから表示値への同期変換。
 */
import {
  mapQualityAnalysisIssueToFinding,
  mapQualityRelationsIssueToFinding,
} from "../../../src/report/quality.ts";

import assert from "node:assert/strict";
import test from "node:test";

/**
 * Qualityの全39種のIssueを既存診断へ変換し、契約外入力は拒否する。
 * @responsibility 全39kindのcode・文言・位置を維持し、契約外入力を拒否する。
 * @trace RCM-UT-002
 * @precondition Qualityの全39kindと契約外入力を用意する。
 * @stimulus 分析・関係の診断変換を呼ぶ。
 * @observation 既存診断と拒否例外を取得する。
 * @oracle 全39kindのcode・文言・位置を維持し、契約外入力を拒否する。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("Qualityの全39種のIssueを既存診断へ変換し、契約外入力は拒否する", () => {
  const cases: readonly {
    convert: typeof mapQualityAnalysisIssueToFinding;
    issue: Parameters<typeof mapQualityAnalysisIssueToFinding>[0];
    expected: ReturnType<typeof mapQualityAnalysisIssueToFinding>;
  }[] = [
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.state-invalid",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "state-invalid",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-state-invalid",
        path: "artifact.md",
        message:
          "Quality Center must declare exactly one canonical finite state: Quality Design Under Review — Reality Audit Blocked, Quality Design Ready — Reality Audit Pending, or Quality Ready.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.reality-audit-state-invalid",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "reality-audit-state-invalid",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-reality-audit-state-invalid",
        path: "artifact.md",
        message:
          "Reality Audit must declare exactly one canonical finite state: Blocked — Quality Design Review Pending, Pending — Not Started, In Progress, or Complete.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.state-reality-audit-state-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "state-reality-audit-state-mismatch",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-state-reality-audit-state-mismatch",
        path: "artifact.md",
        message:
          "Quality Center and Reality Audit must use an allowed state pair: Under Review/Blocked, Design Ready/Pending or In Progress, or Quality Ready/Complete.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.canonical-mapping-coverage-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "canonical-mapping-coverage-mismatch",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-canonical-mapping-coverage-mismatch",
        path: "artifact.md",
        message:
          "The Quality mapping must explicitly process every canonical REQ, UX, IA, UI, SPEC, and ARCH definition without adding an unknown ID.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.canonical-mapping-duplicate-row",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "canonical-mapping-duplicate-row",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-canonical-mapping-duplicate-row",
        path: "artifact.md",
        message:
          "The Quality mapping must not repeat an identical source-to-objective relation row.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.canonical-source-goal-duplicate",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "canonical-source-goal-duplicate",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-canonical-source-goal-duplicate",
        path: "artifact.md",
        message:
          "The summary mapping must not repeat the same Source ID to verification-goal relation through a different row description.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.source-local-relation-section-missing",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "source-local-relation-section-missing",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-source-local-relation-section-missing",
        path: "artifact.md",
        message:
          "Every phase Quality analysis must expose Source ID, QA-ID, preserved condition, test level, and Local Item relations in its canonical integration section.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.source-local-relation-incomplete",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "source-local-relation-incomplete",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-source-local-relation-incomplete",
        path: "artifact.md",
        message:
          "Every Source-to-goal relation must expose its deterministic Obligation Key, derivation source, source-specific condition, test level, external-boundary stage, and one or more Local Items.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.source-local-relation-section-missing-empty-relations",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "source-local-relation-section-missing-empty-relations",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-source-local-relation-section-missing",
        path: "artifact.md",
        message:
          "The Quality analysis must expose Source ID, verification goal, preserved condition, and Local Item relations in its canonical relation section.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.source-relation-duplicate",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "source-relation-duplicate",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-source-relation-duplicate",
        path: "artifact.md",
        message:
          "The canonical Source relation section must not repeat a Source-to-goal or Source-to-goal-to-Local-Item relation with alternate prose.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.source-goal-relation-closure-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "source-goal-relation-closure-mismatch",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-source-goal-relation-closure-mismatch",
        path: "artifact.md",
        message:
          "The summary mapping and canonical Source-specific relation table must expose the same duplicate-free Source ID to verification-goal relation set.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.cross-model-row-invalid",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "cross-model-row-invalid",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-cross-model-row-invalid",
        path: "artifact.md",
        message:
          "Every verification goal must have exactly one Architecture cross-model row with five dispositions.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.cross-model-goal-duplicate",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "cross-model-goal-duplicate",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "quality-cross-model-goal-duplicate",
        path: "artifact.md",
        message:
          "Architecture cross-model disposition is duplicated for value-0.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.cross-model-disposition-invalid",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "cross-model-disposition-invalid",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-cross-model-disposition-invalid",
        path: "artifact.md",
        message:
          "Each Architecture cross-model disposition must be Required or a reasoned N/A.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.cross-model-goal-coverage-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "cross-model-goal-coverage-mismatch",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-cross-model-goal-coverage-mismatch",
        path: "artifact.md",
        message:
          "The Architecture cross-model matrix must process every verification goal exactly once across all five models.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.architecture-detail-unit-row-invalid",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "architecture-detail-unit-row-invalid",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-architecture-detail-unit-row-invalid",
        path: "artifact.md",
        message:
          "Every Architecture detail verification-unit row must contain area, exact unit, objective, Local Item, disposition, and re-evaluation condition.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.architecture-detail-unit-duplicate",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "architecture-detail-unit-duplicate",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "quality-architecture-detail-unit-duplicate",
        path: "artifact.md",
        message:
          "Architecture detail verification unit is duplicated: value-0.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.architecture-detail-unit-disposition-invalid",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "architecture-detail-unit-disposition-invalid",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-architecture-detail-unit-disposition-invalid",
        path: "artifact.md",
        message:
          "Architecture detail verification-unit disposition must be Covered or OPEN.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.architecture-detail-unit-reevaluation-missing",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "architecture-detail-unit-reevaluation-missing",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-architecture-detail-unit-reevaluation-missing",
        path: "artifact.md",
        message:
          "Every Architecture detail verification unit must state no remaining condition or an explicit re-evaluation condition.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.architecture-detail-unit-goal-duplicate",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "architecture-detail-unit-goal-duplicate",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "quality-architecture-detail-unit-goal-duplicate",
        path: "artifact.md",
        message:
          "Architecture detail verification-unit objective is duplicated: value-0.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.architecture-detail-unit-local-item-missing",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "architecture-detail-unit-local-item-missing",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "quality-architecture-detail-unit-local-item-missing",
        path: "artifact.md",
        message:
          "Architecture detail verification unit must connect to one or more Local Items: value-0.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.architecture-detail-goal-relation-missing",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "architecture-detail-goal-relation-missing",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-architecture-detail-goal-relation-missing",
        path: "artifact.md",
        message:
          "Each Architecture detail area must connect to one or more canonical verification goals.",
      },
    },
    {
      convert: mapQualityAnalysisIssueToFinding,
      issue: {
        kind: "artifact.quality-analysis.architecture-detail-coverage-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "architecture-detail-coverage-mismatch",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-architecture-detail-coverage-mismatch",
        path: "artifact.md",
        message:
          "The Quality mapping must explicitly process every current Architecture detail area without adding an unknown area.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.definition-source-relation-duplicate",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "definition-source-relation-duplicate",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-definition-source-relation-duplicate",
        path: "artifact.md",
        message:
          "Verification definitions must not repeat the same Source ID, goal, and Local Item relation with different descriptions.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.definition-goal-local-relation-duplicate",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "definition-goal-local-relation-duplicate",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-definition-goal-local-relation-duplicate",
        path: "artifact.md",
        message:
          "Verification definitions must not repeat the same verification-goal to Local Item relation.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.definition-detail-goal-relation-duplicate",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "definition-detail-goal-relation-duplicate",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-definition-detail-goal-relation-duplicate",
        path: "artifact.md",
        message:
          "Verification definitions must not repeat the same Architecture detail to goal relation.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.detail-goal-relation-closure-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "detail-goal-relation-closure-mismatch",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-detail-goal-relation-closure-mismatch",
        path: "artifact.md",
        message:
          "The Quality analysis and verification definitions must expose the same duplicate-free Architecture-detail-to-goal relation set.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.source-local-relation-closure-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "source-local-relation-closure-mismatch",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-source-local-relation-closure-mismatch",
        path: "artifact.md",
        message:
          "The Quality analysis and verification definitions must expose the same duplicate-free Source ID, goal, and Local Item relation set.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.obligation-key-closure-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "obligation-key-closure-mismatch",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-obligation-key-closure-mismatch",
        path: "artifact.md",
        message:
          "Quality Analysis and Definitions must expose the same unique deterministic Obligation Key for every Source-to-goal relation.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.source-test-level-coverage-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "source-test-level-coverage-mismatch",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-source-test-level-coverage-mismatch",
        path: "artifact.md",
        message:
          "Every test level requested by a canonical Source-to-goal mapping must be represented by a related Local Item of that same level.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.source-test-level-decomposition-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "source-test-level-decomposition-mismatch",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "quality-source-test-level-decomposition-mismatch",
        path: "artifact.md",
        message:
          "Canonical Source value-0 summary level set must equal the union of its Source-to-goal level sets.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.definition-source-test-level-closure-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "definition-source-test-level-closure-mismatch",
        details: { value0: "value-0", value1: "value-1" },
      },
      expected: {
        severity: "error",
        code: "quality-definition-source-test-level-closure-mismatch",
        path: "artifact.md",
        message:
          "The Quality analysis and verification definitions must expose the same Source-to-goal test-level sets. Analysis=value-0; Definitions=value-1.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.source-condition-closure-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "source-condition-closure-mismatch",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-source-condition-closure-mismatch",
        path: "artifact.md",
        message:
          "The Quality mapping and verification definitions must preserve the same normalized source-specific condition for every Source ID to verification-goal relation.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.local-verification-item-closure-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "local-verification-item-closure-mismatch",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-local-verification-item-closure-mismatch",
        path: "artifact.md",
        message:
          "The canonical Quality mapping must list the exact Local Item set owned by all current verification definitions.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.architecture-detail-unit-local-item-unknown",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "architecture-detail-unit-local-item-unknown",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "quality-architecture-detail-unit-local-item-unknown",
        path: "artifact.md",
        message:
          "Architecture detail verification unit references an unknown Local Item: value-0.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.architecture-detail-unit-level-coverage-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "architecture-detail-unit-level-coverage-mismatch",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "quality-architecture-detail-unit-level-coverage-mismatch",
        path: "artifact.md",
        message:
          "Every test level required by an Architecture detail derivation key must have a related Local Item at that level: value-0.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.architecture-detail-unit-boundary-coverage-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "architecture-detail-unit-boundary-coverage-mismatch",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "quality-architecture-detail-unit-boundary-coverage-mismatch",
        path: "artifact.md",
        message:
          "Every Architecture detail derivation key must reach its declared external-boundary stage through a related Local Item: value-0.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.goal-local-relation-duplicate",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "goal-local-relation-duplicate",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-goal-local-relation-duplicate",
        path: "artifact.md",
        message:
          "The canonical Quality mapping must not repeat the same verification-goal to Local Item relation.",
      },
    },
    {
      convert: mapQualityRelationsIssueToFinding,
      issue: {
        kind: "artifact.quality-relations.goal-local-relation-closure-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "goal-local-relation-closure-mismatch",
        details: {},
      },
      expected: {
        severity: "error",
        code: "quality-goal-local-relation-closure-mismatch",
        path: "artifact.md",
        message:
          "The canonical Quality mapping must preserve the exact verification-goal to Local Item relation set owned by the verification definitions; a globally equal Local ID set is not sufficient.",
      },
    },
  ];
  for (const value of cases) {
    assert.deepEqual(value.convert(value.issue), value.expected);
    if (Object.keys(value.issue.details).length)
      assert.throws(
        () => value.convert({ ...value.issue, details: {} }),
        /invalid_quality_(?:analysis|relations)_issue_details/u,
      );
  }
  for (const convert of [
    mapQualityAnalysisIssueToFinding,
    mapQualityRelationsIssueToFinding,
  ])
    assert.throws(
      () =>
        convert({
          kind: "unknown",
          targetIdentity: "artifact.md",
          location: { path: "artifact.md" },
          reason: "unknown",
          details: {},
        }),
      /unknown_quality_(?:analysis|relations)_domain_issue/u,
    );
});
