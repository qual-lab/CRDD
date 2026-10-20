/**
 * 共通文書・Identity・版の中立Issueを公開診断へ変換する。
 * @responsibility 既存の診断shape・code・文言・必要値検査を所有する。
 * @trace ARCH-000001
 */
import type { DomainIssue } from "../../../domain-model/src/index.ts";
import type { DocumentFinding } from "./types.ts";
/**
 * 共通文書Issueを既存の公開診断へ変換する。
 * @responsibility 共通文書Issueを既存の公開診断へ変換する。
 * @trace ARCH-000001
 * @input issue: 対応するDomainが返した中立Issue。
 * @returns 既存のseverity・code・path・messageを持つDocumentFinding。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 未知kindと動的文言に必要な値の不足は例外として拒否する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function mapDocumentRuleIssueToFinding(
  issue: DomainIssue,
): DocumentFinding {
  let code: string;
  let message: string;
  let severity: string;
  switch (issue.kind) {
    case "artifact.document-rule.branch-coverage-value": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "branch-coverage-value";
      severity = "error";
      message = `line ${issue.details.value0}: numerator, denominator, and percentage must all be numeric when measurement values are present.`;
      break;
    }
    case "artifact.document-rule.branch-coverage-range": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "branch-coverage-range";
      severity = "error";
      message = `line ${issue.details.value0}: counts must be non-negative integers, denominator must be greater than zero, and percentage must be 0-100.`;
      break;
    }
    case "artifact.document-rule.branch-coverage-count": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value2 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "branch-coverage-count";
      severity = "error";
      message = `line ${issue.details.value0}: numerator ${issue.details.value1} exceeds denominator ${issue.details.value2}.`;
      break;
    }
    case "artifact.document-rule.branch-coverage-percentage": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value2 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value3 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value4 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "branch-coverage-percentage";
      severity = "error";
      message = `line ${issue.details.value0}: ${issue.details.value1}/${issue.details.value2} is ${issue.details.value3}%, not ${issue.details.value4}%.`;
      break;
    }
    case "artifact.document-rule.remediation-state-columns-missing": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "remediation-state-columns-missing";
      severity = "error";
      message = `line ${issue.details.value0}: missing ${issue.details.value1}.`;
      break;
    }
    case "artifact.document-rule.ambiguous-remediation-state": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "ambiguous-remediation-state";
      severity = "error";
      message = `${issue.details.value0}: fixed must not be used as a remediation progress or resolution value.`;
      break;
    }
    case "artifact.document-rule.remediation-progress-value": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "remediation-progress-value";
      severity = "error";
      message = `${issue.details.value0}: remediation progress must be Identified, Planned, Applied, or Self-checked.`;
      break;
    }
    case "artifact.document-rule.remediation-blocker-value": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "remediation-blocker-value";
      severity = "error";
      message = `${issue.details.value0}: blocker state must be None or Blocked.`;
      break;
    }
    case "artifact.document-rule.remediation-resolution-value": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "remediation-resolution-value";
      severity = "error";
      message = `${issue.details.value0}: resolution must be Open or Resolved.`;
      break;
    }
    case "artifact.document-rule.premature-remediation-resolution": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "premature-remediation-resolution";
      severity = "error";
      message = `${issue.details.value0}: missing ${issue.details.value1}.`;
      break;
    }
    case "artifact.document-rule.incomplete-remediation-blocker": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "incomplete-remediation-blocker";
      severity = "error";
      message = `${issue.details.value0}: missing ${issue.details.value1}.`;
      break;
    }
    case "artifact.document-rule.inconsistent-remediation-state": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "inconsistent-remediation-state";
      severity = "error";
      message = `${issue.details.value0}: Resolved requires Self-checked progress and a None blocker state.`;
      break;
    }
    case "artifact.document-rule.related-order": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "related-order";
      severity = "warning";
      message = `${issue.details.value0} is not ascending`;
      break;
    }
    case "artifact.document-rule.current-changelog-release-missing": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "current-changelog-release-missing";
      severity = "error";
      message = `${issue.details.value0}: expected exactly one language section; found ${issue.details.value1}.`;
      break;
    }
    case "artifact.document-rule.current-changelog-release-missing-1": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value2 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "current-changelog-release-missing";
      severity = "error";
      message = `${issue.details.value0}: expected exactly one ${issue.details.value1} release section; found ${issue.details.value2}.`;
      break;
    }
    case "artifact.document-rule.migration-status-undetermined": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value2 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "migration-status-undetermined";
      severity = "error";
      message = `${issue.details.value0}: ${issue.details.value1} migration_required is ${issue.details.value2}.`;
      break;
    }
    case "artifact.document-rule.migration-status-mismatch": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "migration-status-mismatch";
      severity = "error";
      message = `English=${issue.details.value0}, 日本語=${issue.details.value1}.`;
      break;
    }
    case "artifact.document-rule.migration-status-undetermined-1": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value2 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "migration-status-undetermined";
      severity = "error";
      message = `${issue.details.value0}: ${issue.details.value1} change_classification is ${issue.details.value2}.`;
      break;
    }
    case "artifact.document-rule.migration-status-mismatch-1": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "migration-status-mismatch";
      severity = "error";
      message = `English classification=${issue.details.value0}, 日本語 classification=${issue.details.value1}.`;
      break;
    }
    case "artifact.document-rule.migration-note-incomplete": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      if (typeof issue.details.value2 !== "string")
        throw new Error("invalid_document_rule_issue_details");
      code = "migration-note-incomplete";
      severity = "error";
      message = `${issue.details.value0}: ${issue.details.value1} migration note is missing ${issue.details.value2}.`;
      break;
    }
    default:
      throw new Error(`unknown_document_rule_issue:${issue.kind}`);
  }
  return { severity, code, path: issue.location.path, message };
}

/**
 * 文書Identityと版のIssueを既存公開診断へ変換する。
 * @responsibility 文書Identityと版のIssueを既存公開診断へ変換する。
 * @trace ARCH-000001
 * @input issue: 対応するDomainが返した中立Issue。
 * @returns 既存のseverity・code・path・messageを持つDocumentFinding。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 未知kindと動的文言に必要な値の不足は例外として拒否する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function mapDocumentIdentityIssueToFinding(
  issue: DomainIssue,
): DocumentFinding {
  let code: string;
  let message: string;
  switch (issue.kind) {
    case "artifact.document-identity.duplicate-stable-id-definition": {
      if (typeof issue.details.stableId !== "string")
        throw new Error("invalid_document_identity_issue_details");
      code = "duplicate-stable-id-definition";
      message = issue.details.stableId;
      break;
    }
    case "artifact.document-identity.version-mismatch": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_identity_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_document_identity_issue_details");
      code = "version-mismatch";
      message = `Version: ${issue.details.value0}; found ${issue.details.value1}`;
      break;
    }
    case "artifact.document-identity.released-baseline-outside-candidate": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_identity_issue_details");
      code = "released-baseline-outside-candidate";
      message = `Released Baseline is only valid for Status: Candidate; found Status: ${issue.details.value0}.`;
      break;
    }
    case "artifact.document-identity.candidate-status-mismatch": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_identity_issue_details");
      code = "candidate-status-mismatch";
      message = `Status: ${issue.details.value0}; all canonical documents must be Candidate together.`;
      break;
    }
    case "artifact.document-identity.candidate-released-baseline-mismatch": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_identity_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_document_identity_issue_details");
      code = "candidate-released-baseline-mismatch";
      message = `Released Baseline: ${issue.details.value0}; found ${issue.details.value1}`;
      break;
    }
    case "artifact.document-identity.candidate-version-equals-released-baseline": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_identity_issue_details");
      code = "candidate-version-equals-released-baseline";
      message = `Candidate Version and Released Baseline must differ: ${issue.details.value0}.`;
      break;
    }
    case "artifact.document-identity.discovery-identity-link-owner-mismatch": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_identity_issue_details");
      code = "discovery-identity-link-owner-mismatch";
      message = `${issue.details.value0} must link to its Discovery definition, not an EXP analysis.`;
      break;
    }
    case "artifact.document-identity.stable-id-manual-revision": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_document_identity_issue_details");
      code = "stable-id-manual-revision";
      message = `${issue.details.value0}: keep the stable ID unchanged and identify the content state with an artifact revision, Change Trace, or superseding ID.`;
      break;
    }
    default:
      throw new Error(`unknown_document_identity_issue:${issue.kind}`);
  }
  return { severity: "error", code, path: issue.location.path, message };
}

/**
 * Stable版文書Issueを既存公開診断へ変換する。
 * @responsibility Stable版文書Issueを既存公開診断へ変換する。
 * @trace ARCH-000001
 * @input issue: 対応するDomainが返した中立Issue。
 * @returns 既存のseverity・code・path・messageを持つDocumentFinding。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 未知kindと動的文言に必要な値の不足は例外として拒否する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function mapStableReleaseIssueToFinding(
  issue: DomainIssue,
): DocumentFinding {
  let code: string;
  let message: string;
  switch (issue.kind) {
    case "artifact.stable-release.stable-release-canonical-status-mismatch": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_stable_release_issue_details");
      code = "stable-release-canonical-status-mismatch";
      message = `Every canonical document must be Version: ${issue.details.value0} and Status: Stable for the final release candidate.`;
      break;
    }
    case "artifact.stable-release.stable-release-readme-version-mismatch": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_stable_release_issue_details");
      code = "stable-release-readme-version-mismatch";
      message = `README must expose Version: **${issue.details.value0}**.`;
      break;
    }
    case "artifact.stable-release.stable-release-readme-candidate-residue": {
      code = "stable-release-readme-candidate-residue";
      message =
        "Stable release README must not retain Candidate or Released Baseline display.";
      break;
    }
    case "artifact.stable-release.stable-release-changelog-bilingual-closure-mismatch": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_stable_release_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_stable_release_issue_details");
      if (typeof issue.details.value2 !== "string")
        throw new Error("invalid_stable_release_issue_details");
      code = "stable-release-changelog-bilingual-closure-mismatch";
      message = `Expected exactly two dated ${issue.details.value0} release headings with one shared date; found ${issue.details.value1} headings and ${issue.details.value2} dates.`;
      break;
    }
    case "artifact.stable-release.stable-release-candidate-residue": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_stable_release_issue_details");
      code = "stable-release-candidate-residue";
      message = `Current Markdown entry point still exposes ${issue.details.value0} as Candidate.`;
      break;
    }
    case "artifact.stable-release.stable-release-change-trace-not-ready": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_stable_release_issue_details");
      code = "stable-release-change-trace-not-ready";
      message = `Change trace for ${issue.details.value0} must be Ready for Release Handoff or Released before integration and tagging.`;
      break;
    }
    case "artifact.stable-release.stable-release-change-trace-premature-release": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_stable_release_issue_details");
      code = "stable-release-change-trace-premature-release";
      message = `Change trace for ${issue.details.value0} must not claim Released before the official tag exists.`;
      break;
    }
    default:
      throw new Error(`unknown_stable_release_issue:${issue.kind}`);
  }
  return { severity: "error", code, path: issue.location.path, message };
}
