/**
 * 変更文書の中立Issueと診断を接続する。
 * @packageDocumentation
 * @responsibility 四分類の既存code・文言・位置と未知分類拒否を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope report、change
 * @boundary RCM-UT-002=N/A: 純粋なモデル結果の診断変換。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { inspectChangeDocument } from "../../../../domain-model/src/index.ts";
import { mapChangeDomainIssueToFinding } from "../../../src/report/convert.ts";

/**
 * 実Domain結果から既存四分類の診断を確認する。
 * @responsibility 中立Issueの接続漏れと未知分類の正常化を拒否する。
 * @trace RCM-UT-002
 * @precondition 見出し不正とBlock／旧見出し／Phase不正の二本文を使う。
 * @stimulus Domain検査のIssueを変換する。
 * @observation 四field診断と例外を取得する。
 * @oracle 既存四code、位置、重要度を維持し未知分類は例外になる。
 * @cleanup N/A: 局所値だけを使う。
 * @boundary RCM-UT-002=N/A: 同期変換。
 */
test("変更文書の四分類を既存診断へ接続する", () => {
  const issues = [
    ...inspectChangeDocument({ path: "change.md", content: "" }, "CHG-000080"),
    ...inspectChangeDocument(
      { path: "change.md", content: "### 影響ファイル\n### 主な反映ファイル" },
      "CHG-000080",
    ),
  ];
  const findings = issues.map(mapChangeDomainIssueToFinding);
  assert.deepEqual(
    findings.map((f) => f.code),
    [
      "change-impact-files-section-mismatch",
      "change-impact-files-contract-invalid",
      "legacy-change-impact-heading",
      "change-phase-gate-contract-incomplete",
    ],
  );
  assert.ok(
    findings.every(
      (f) =>
        f.severity === "error" &&
        f.path === "change.md" &&
        Object.keys(f).length === 4,
    ),
  );
  assert.throws(
    () =>
      mapChangeDomainIssueToFinding({
        kind: "future.change",
        reason: "future",
        targetIdentity: "change",
        location: { path: "change.md" },
        details: {},
      }),
    /unknown_change_domain_issue/u,
  );
});
