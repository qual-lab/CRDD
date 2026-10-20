/**
 * 共通文書・版・Identityの公開診断変換を検証する。
 * @packageDocumentation
 * @responsibility 全kindのcode・Severity・位置・文言と、契約外入力拒否を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope report、document-rule、document-identity、stable-release
 * @boundary RCM-UT-002=N/A: 同期的な値変換。
 */
import {
  mapDocumentRuleIssueToFinding,
  mapDocumentIdentityIssueToFinding,
  mapStableReleaseIssueToFinding,
} from "../../../src/report/document.ts";

import assert from "node:assert/strict";
import test from "node:test";

/**
 * 共通文書・版・Identityの全公開診断を変換し契約外入力を拒否する。
 * @responsibility 全kindの期待診断に完全一致し、未知kind・不足Detailを拒否する。
 * @trace RCM-UT-002
 * @precondition 全共通文書kindの入力・期待診断と契約外入力を用意する。
 * @stimulus 三つの用途別診断変換を呼ぶ。
 * @observation code、severity、位置、文言と拒否例外を取得する。
 * @oracle 全kindの期待診断に完全一致し、未知kind・不足Detailを拒否する。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("共通文書・版・Identityの全公開診断を変換し契約外入力を拒否する", () => {
  const cases: readonly {
    convert: typeof mapDocumentRuleIssueToFinding;
    issue: Parameters<typeof mapDocumentRuleIssueToFinding>[0];
    expected: ReturnType<typeof mapDocumentRuleIssueToFinding>;
  }[] = [
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.branch-coverage-value",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "branch-coverage-value",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "branch-coverage-value",
        path: "artifact.md",
        message:
          "line value-0: numerator, denominator, and percentage must all be numeric when measurement values are present.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.branch-coverage-range",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "branch-coverage-range",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "branch-coverage-range",
        path: "artifact.md",
        message:
          "line value-0: counts must be non-negative integers, denominator must be greater than zero, and percentage must be 0-100.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.branch-coverage-count",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "branch-coverage-count",
        details: { value0: "value-0", value1: "value-1", value2: "value-2" },
      },
      expected: {
        severity: "error",
        code: "branch-coverage-count",
        path: "artifact.md",
        message: "line value-0: numerator value-1 exceeds denominator value-2.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.branch-coverage-percentage",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "branch-coverage-percentage",
        details: {
          value0: "value-0",
          value1: "value-1",
          value2: "value-2",
          value3: "value-3",
          value4: "value-4",
        },
      },
      expected: {
        severity: "error",
        code: "branch-coverage-percentage",
        path: "artifact.md",
        message: "line value-0: value-1/value-2 is value-3%, not value-4%.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.remediation-state-columns-missing",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "remediation-state-columns-missing",
        details: { value0: "value-0", value1: "value-1" },
      },
      expected: {
        severity: "error",
        code: "remediation-state-columns-missing",
        path: "artifact.md",
        message: "line value-0: missing value-1.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.ambiguous-remediation-state",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "ambiguous-remediation-state",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "ambiguous-remediation-state",
        path: "artifact.md",
        message:
          "value-0: fixed must not be used as a remediation progress or resolution value.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.remediation-progress-value",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "remediation-progress-value",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "remediation-progress-value",
        path: "artifact.md",
        message:
          "value-0: remediation progress must be Identified, Planned, Applied, or Self-checked.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.remediation-blocker-value",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "remediation-blocker-value",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "remediation-blocker-value",
        path: "artifact.md",
        message: "value-0: blocker state must be None or Blocked.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.remediation-resolution-value",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "remediation-resolution-value",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "remediation-resolution-value",
        path: "artifact.md",
        message: "value-0: resolution must be Open or Resolved.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.premature-remediation-resolution",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "premature-remediation-resolution",
        details: { value0: "value-0", value1: "value-1" },
      },
      expected: {
        severity: "error",
        code: "premature-remediation-resolution",
        path: "artifact.md",
        message: "value-0: missing value-1.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.incomplete-remediation-blocker",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "incomplete-remediation-blocker",
        details: { value0: "value-0", value1: "value-1" },
      },
      expected: {
        severity: "error",
        code: "incomplete-remediation-blocker",
        path: "artifact.md",
        message: "value-0: missing value-1.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.inconsistent-remediation-state",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "inconsistent-remediation-state",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "inconsistent-remediation-state",
        path: "artifact.md",
        message:
          "value-0: Resolved requires Self-checked progress and a None blocker state.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.related-order",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "related-order",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "warning",
        code: "related-order",
        path: "artifact.md",
        message: "value-0 is not ascending",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.current-changelog-release-missing",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "current-changelog-release-missing",
        details: { value0: "value-0", value1: "value-1" },
      },
      expected: {
        severity: "error",
        code: "current-changelog-release-missing",
        path: "artifact.md",
        message:
          "value-0: expected exactly one language section; found value-1.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.current-changelog-release-missing-1",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "current-changelog-release-missing",
        details: { value0: "value-0", value1: "value-1", value2: "value-2" },
      },
      expected: {
        severity: "error",
        code: "current-changelog-release-missing",
        path: "artifact.md",
        message:
          "value-0: expected exactly one value-1 release section; found value-2.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.migration-status-undetermined",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "migration-status-undetermined",
        details: { value0: "value-0", value1: "value-1", value2: "value-2" },
      },
      expected: {
        severity: "error",
        code: "migration-status-undetermined",
        path: "artifact.md",
        message: "value-0: value-1 migration_required is value-2.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.migration-status-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "migration-status-mismatch",
        details: { value0: "value-0", value1: "value-1" },
      },
      expected: {
        severity: "error",
        code: "migration-status-mismatch",
        path: "artifact.md",
        message: "English=value-0, 日本語=value-1.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.migration-status-undetermined-1",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "migration-status-undetermined",
        details: { value0: "value-0", value1: "value-1", value2: "value-2" },
      },
      expected: {
        severity: "error",
        code: "migration-status-undetermined",
        path: "artifact.md",
        message: "value-0: value-1 change_classification is value-2.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.migration-status-mismatch-1",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "migration-status-mismatch",
        details: { value0: "value-0", value1: "value-1" },
      },
      expected: {
        severity: "error",
        code: "migration-status-mismatch",
        path: "artifact.md",
        message:
          "English classification=value-0, 日本語 classification=value-1.",
      },
    },
    {
      convert: mapDocumentRuleIssueToFinding,
      issue: {
        kind: "artifact.document-rule.migration-note-incomplete",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "migration-note-incomplete",
        details: { value0: "value-0", value1: "value-1", value2: "value-2" },
      },
      expected: {
        severity: "error",
        code: "migration-note-incomplete",
        path: "artifact.md",
        message: "value-0: value-1 migration note is missing value-2.",
      },
    },
    {
      convert: mapDocumentIdentityIssueToFinding,
      issue: {
        kind: "artifact.document-identity.version-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "version-mismatch",
        details: { value0: "value-0", value1: "value-1" },
      },
      expected: {
        severity: "error",
        code: "version-mismatch",
        path: "artifact.md",
        message: "Version: value-0; found value-1",
      },
    },
    {
      convert: mapDocumentIdentityIssueToFinding,
      issue: {
        kind: "artifact.document-identity.released-baseline-outside-candidate",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "released-baseline-outside-candidate",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "released-baseline-outside-candidate",
        path: "artifact.md",
        message:
          "Released Baseline is only valid for Status: Candidate; found Status: value-0.",
      },
    },
    {
      convert: mapDocumentIdentityIssueToFinding,
      issue: {
        kind: "artifact.document-identity.candidate-status-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "candidate-status-mismatch",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "candidate-status-mismatch",
        path: "artifact.md",
        message:
          "Status: value-0; all canonical documents must be Candidate together.",
      },
    },
    {
      convert: mapDocumentIdentityIssueToFinding,
      issue: {
        kind: "artifact.document-identity.candidate-released-baseline-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "candidate-released-baseline-mismatch",
        details: { value0: "value-0", value1: "value-1" },
      },
      expected: {
        severity: "error",
        code: "candidate-released-baseline-mismatch",
        path: "artifact.md",
        message: "Released Baseline: value-0; found value-1",
      },
    },
    {
      convert: mapDocumentIdentityIssueToFinding,
      issue: {
        kind: "artifact.document-identity.candidate-version-equals-released-baseline",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "candidate-version-equals-released-baseline",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "candidate-version-equals-released-baseline",
        path: "artifact.md",
        message:
          "Candidate Version and Released Baseline must differ: value-0.",
      },
    },
    {
      convert: mapDocumentIdentityIssueToFinding,
      issue: {
        kind: "artifact.document-identity.discovery-identity-link-owner-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "discovery-identity-link-owner-mismatch",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "discovery-identity-link-owner-mismatch",
        path: "artifact.md",
        message:
          "value-0 must link to its Discovery definition, not an EXP analysis.",
      },
    },
    {
      convert: mapDocumentIdentityIssueToFinding,
      issue: {
        kind: "artifact.document-identity.stable-id-manual-revision",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "stable-id-manual-revision",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "stable-id-manual-revision",
        path: "artifact.md",
        message:
          "value-0: keep the stable ID unchanged and identify the content state with an artifact revision, Change Trace, or superseding ID.",
      },
    },
    {
      convert: mapStableReleaseIssueToFinding,
      issue: {
        kind: "artifact.stable-release.stable-release-canonical-status-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "stable-release-canonical-status-mismatch",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "stable-release-canonical-status-mismatch",
        path: "artifact.md",
        message:
          "Every canonical document must be Version: value-0 and Status: Stable for the final release candidate.",
      },
    },
    {
      convert: mapStableReleaseIssueToFinding,
      issue: {
        kind: "artifact.stable-release.stable-release-readme-version-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "stable-release-readme-version-mismatch",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "stable-release-readme-version-mismatch",
        path: "artifact.md",
        message: "README must expose Version: **value-0**.",
      },
    },
    {
      convert: mapStableReleaseIssueToFinding,
      issue: {
        kind: "artifact.stable-release.stable-release-readme-candidate-residue",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "stable-release-readme-candidate-residue",
        details: {},
      },
      expected: {
        severity: "error",
        code: "stable-release-readme-candidate-residue",
        path: "artifact.md",
        message:
          "Stable release README must not retain Candidate or Released Baseline display.",
      },
    },
    {
      convert: mapStableReleaseIssueToFinding,
      issue: {
        kind: "artifact.stable-release.stable-release-changelog-bilingual-closure-mismatch",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "stable-release-changelog-bilingual-closure-mismatch",
        details: { value0: "value-0", value1: "value-1", value2: "value-2" },
      },
      expected: {
        severity: "error",
        code: "stable-release-changelog-bilingual-closure-mismatch",
        path: "artifact.md",
        message:
          "Expected exactly two dated value-0 release headings with one shared date; found value-1 headings and value-2 dates.",
      },
    },
    {
      convert: mapStableReleaseIssueToFinding,
      issue: {
        kind: "artifact.stable-release.stable-release-candidate-residue",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "stable-release-candidate-residue",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "stable-release-candidate-residue",
        path: "artifact.md",
        message:
          "Current Markdown entry point still exposes value-0 as Candidate.",
      },
    },
    {
      convert: mapStableReleaseIssueToFinding,
      issue: {
        kind: "artifact.stable-release.stable-release-change-trace-not-ready",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "stable-release-change-trace-not-ready",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "stable-release-change-trace-not-ready",
        path: "artifact.md",
        message:
          "Change trace for value-0 must be Ready for Release Handoff or Released before integration and tagging.",
      },
    },
    {
      convert: mapStableReleaseIssueToFinding,
      issue: {
        kind: "artifact.stable-release.stable-release-change-trace-premature-release",
        targetIdentity: "artifact.md",
        location: { path: "artifact.md" },
        reason: "stable-release-change-trace-premature-release",
        details: { value0: "value-0" },
      },
      expected: {
        severity: "error",
        code: "stable-release-change-trace-premature-release",
        path: "artifact.md",
        message:
          "Change trace for value-0 must not claim Released before the official tag exists.",
      },
    },
  ];
  for (const value of cases) {
    assert.deepEqual(value.convert(value.issue), value.expected);
    if (Object.keys(value.issue.details).length)
      assert.throws(
        () => value.convert({ ...value.issue, details: {} }),
        /invalid_(?:document_rule|document_identity|stable_release)_issue_details/u,
      );
  }
  const duplicate = {
    kind: "artifact.document-identity.duplicate-stable-id-definition",
    targetIdentity: "REQ-000001",
    location: { path: "a.md:1, b.md:2" },
    reason: "duplicate-stable-id-definition",
    details: { stableId: "REQ-000001" },
  };
  assert.deepEqual(mapDocumentIdentityIssueToFinding(duplicate), {
    severity: "error",
    code: "duplicate-stable-id-definition",
    path: "a.md:1, b.md:2",
    message: "REQ-000001",
  });
  assert.throws(
    () => mapDocumentIdentityIssueToFinding({ ...duplicate, details: {} }),
    /invalid_document_identity_issue_details/u,
  );
  for (const convert of [
    mapDocumentRuleIssueToFinding,
    mapDocumentIdentityIssueToFinding,
    mapStableReleaseIssueToFinding,
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
      /unknown_(?:document_rule|document_identity|stable_release)_issue/u,
    );
});
