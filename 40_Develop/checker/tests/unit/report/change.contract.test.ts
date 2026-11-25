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
import {
  inspectChangeNavigation,
  parseChangeDocument,
  parseChangeIndex,
} from "@qual-lab/crdd-document-model";
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
    ...parseChangeDocument(
      { path: "change.md", content: "" },
      { mode: "canonical", expectedIdentity: "CHG-000080" },
    ).issues,
    ...parseChangeDocument(
      { path: "change.md", content: "### 影響ファイル\n### 主な反映ファイル" },
      { mode: "canonical", expectedIdentity: "CHG-000080" },
    ).issues,
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

/**
 * ひな型と案内の実モデル診断を従来表示へ接続する。
 * @responsibility 新しい中立Issueでも従来のcode・文言・位置・一件表示を維持する。
 * @trace RCM-UT-002
 * @precondition 空ひな型、重複案内、実在一覧との不一致を使う。
 * @stimulus ParseとSemanticのIssueを表示へ変換する。
 * @observation 四field診断を比較する。
 * @oracle ひな型一件・案内一件を同じcodeと文言で返す。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期変換。
 */
test("Changeのひな型と案内は既存の一件表示へ接続する", () => {
  assert.deepEqual(
    parseChangeDocument(
      { path: "template/change.md", content: "" },
      { mode: "template" },
    ).issues.map(mapChangeDomainIssueToFinding),
    [
      {
        severity: "error",
        code: "change-impact-files-template-mismatch",
        path: "template/change.md",
        message:
          "The official Change template must expose the canonical exhaustive impact-file section and the Phase/Gate/scope-extension/plan-revision evaluation contract.",
      },
    ],
  );
  for (const content of [
    "",
    "<!-- crdd-change-aggregate-index:start -->[one](./Changes/CHG-000065/change.md)[two](./Changes/CHG-000065/change.md)<!-- crdd-change-aggregate-index:end -->",
  ]) {
    const index = parseChangeIndex({ path: "02_Changes.md", content });
    const issues = [
      ...index.issues,
      ...inspectChangeNavigation({
        index: index.result,
        observedChangeIds: ["CHG-000099"],
      }),
    ];
    assert.deepEqual(issues.map(mapChangeDomainIssueToFinding), [
      {
        severity: "error",
        code: "change-navigation-population-mismatch",
        path: "02_Changes.md",
        message:
          "The Change navigation must reference every ID-only Change aggregate exactly once and no unknown aggregate.",
      },
    ]);
  }
});
