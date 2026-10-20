/**
 * IAの中立Issueと現在の文書診断の対応を検証する。
 * @packageDocumentation
 * @responsibility 七種類のcode・四fieldと未知Issueの拒否を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope ia、diagnostic、conversion
 * @boundary RCM-UT-002=N/A: 同期的な表示変換だけを使う。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mapIaDomainIssueToFinding } from "../../../src/report/convert.ts";

/**
 * IA診断の既存codeと四fieldのshapeを維持する。
 * @responsibility Domainの七理由を既知の文書診断へ対応付ける。
 * @trace RCM-UT-002
 * @precondition 七種類の中立Issueを作る。
 * @stimulus 本番の診断変換へ順番に渡す。
 * @observation 重要度・code・Path・文言とfield集合を取得する。
 * @oracle 既存codeを維持し、Rule等のfieldを追加しない。
 * @cleanup N/A: 局所Objectだけを使う。
 * @boundary RCM-UT-002=N/A: 純粋な変換。
 */
test("IAの七Issueは既存の文書診断四fieldへ届く", () => {
  for (const reason of [
    "analysis-contract-invalid",
    "definition-contract-invalid",
    "analysis-coverage-mismatch",
    "definition-index-coverage-mismatch",
    "cross-projection-coverage-mismatch",
    "analysis-definition-closure-mismatch",
    "object-mapping-closure-mismatch",
  ]) {
    const finding = mapIaDomainIssueToFinding({
      kind: `artifact.ia.${reason}`,
      targetIdentity: "IA-000001",
      location: { path: "ia.md" },
      reason,
      details: { checklistFailure: null },
    });
    assert.deepEqual(Object.keys(finding).sort(), [
      "code",
      "message",
      "path",
      "severity",
    ]);
    assert.equal(finding.code, `ia-${reason}`);
    assert.equal(finding.path, "ia.md");
    assert.equal(finding.severity, "error");
    assert.ok(finding.message.length > 0);
  }
});

/**
 * 未知kindと不足したChecklist理由を成功へ丸めない。
 * @responsibility 不正な変換入力の明示拒否を確認する。
 * @trace RCM-UT-002
 * @precondition 未知kindと理由不足の中立Issueを使う。
 * @stimulus 本番の表示変換へ渡す。
 * @observation 固定例外を取得する。
 * @oracle どちらも診断を発行せず拒否する。
 * @cleanup N/A: 局所Objectだけを使う。
 * @boundary RCM-UT-002=N/A: 純粋な変換。
 */
test("IA診断は未知Issueと不正な理由を拒否する", () => {
  const issue = {
    kind: "unknown",
    targetIdentity: "IA-000001",
    location: { path: "ia.md" },
    reason: "unknown",
    details: {},
  };
  assert.throws(
    () => mapIaDomainIssueToFinding(issue),
    /unknown_ia_domain_issue:unknown/u,
  );
  assert.throws(
    () =>
      mapIaDomainIssueToFinding({
        ...issue,
        kind: "artifact.ia.analysis-contract-invalid",
      }),
    /invalid_ia_domain_issue_checklist_failure/u,
  );
});
