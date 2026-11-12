/**
 * 共通文書の表・Header・版・Identity意味を検証する。
 * @packageDocumentation
 * @responsibility 取得済み本文だけで、既存の受理条件・部分解析・順序を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope artifact、verification-tables、document-header、release、identity
 * @boundary RCM-UT-002=N/A: 外部I/Oを持たない同期的な文書意味処理。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectBranchCoverageTable,
  inspectRemediationTable,
  inspectRelatedOrder,
  inspectChangelogRelease,
  inspectCanonicalDocumentVersions,
  inspectDiscoveryIdentityLinks,
  inspectStableIdentityDefinitions,
  parseReadmeVersion,
  parseCandidateVersionHeader,
  inspectStableCanonicalDocuments,
  inspectStableReadme,
  inspectStableChangelog,
  inspectStableReleaseHeader,
  parseCanonicalReleaseHeader,
  parseChangeTraceHeader,
  parseStableIdentityOccurrences,
  inspectStableIdentityOwnership,
} from "../../../src/index.ts";

/**
 * Headerと安定IDは取得範囲・欠落・全出現と所有を区別する。
 * @responsibility 欠落はnull、全ID出現を保持し、複数所有だけを報告する。
 * @trace RCM-UT-002
 * @precondition 合成Header・欠落値・重複IDと複数所有者を使う。
 * @stimulus Header、ID出現、所有関係を解析・検査する。
 * @observation 解析値・Issue順・元の所有関係を取得する。
 * @oracle 欠落はnull、全ID出現を保持し、複数所有だけを報告する。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("Headerと安定IDは取得範囲・欠落・全出現と所有を区別する", () => {
  assert.deepEqual(
    parseCanonicalReleaseHeader(
      "Version: v0.22.0\nStatus: Candidate\nReleased Baseline: v0.21.0\n\n## 本文\nStatus: Stable",
    ),
    { version: "v0.22.0", status: "Candidate", releasedBaseline: "v0.21.0" },
  );
  assert.deepEqual(parseCanonicalReleaseHeader("# 文書"), {
    version: null,
    status: null,
    releasedBaseline: null,
  });
  assert.deepEqual(
    parseChangeTraceHeader("# Change Trace: Sample\nChange ID: `CHG-000082`"),
    { changeId: "CHG-000082", hasStandardHeading: true },
  );
  assert.deepEqual(parseChangeTraceHeader("# 調査\n変更ID: CHG-000082"), {
    changeId: "CHG-000082",
    hasStandardHeading: false,
  });
  assert.deepEqual(
    parseStableIdentityOccurrences(
      "REQ-000001 REQ-000001\n```\nUX-000001\n```",
    ),
    ["REQ-000001", "REQ-000001", "UX-000001"],
  );
  const owners = new Map([
    ["REQ-000001", ["a.md:1", "b.md:2"]],
    ["UX-000001", ["c.md:3"]],
  ]);
  const issues = inspectStableIdentityOwnership(owners);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.location.path, "a.md:1, b.md:2");
  assert.equal(issues[0]?.details.stableId, "REQ-000001");
  assert.equal(owners.get("REQ-000001")?.length, 2);
});

/**
 * 分岐網羅表は未測定・不正値・範囲・分母超過・丸め差を区別する。
 * @responsibility 測定対象だけを数え、値・範囲・件数・率を既存順で報告する。
 * @trace RCM-UT-002
 * @precondition 未測定、非数値、不正分母、分子超過、丸め差の表を使う。
 * @stimulus 分岐網羅表を検査する。
 * @observation 実測行数と理由列を取得する。
 * @oracle 測定対象だけを数え、値・範囲・件数・率を既存順で報告する。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("分岐網羅表は未測定・不正値・範囲・分母超過・丸め差を区別する", () => {
  const content =
    "| 到達分岐数（分子） | 対象分岐数（分母） | 実測率 |\n|---|---|---|\n| N/A | | 未測定 |\n| bad | 2 | 50% |\n| 1 | 0 | 0% |\n| 3 | 2 | 50% |\n| 1 | 3 | 33.33% |\n";
  const result = inspectBranchCoverageTable({ path: "coverage.md", content });
  assert.equal(result.numericRowsChecked, 3);
  assert.deepEqual(
    result.issues.map((issue) => issue.reason),
    [
      "branch-coverage-value",
      "branch-coverage-range",
      "branch-coverage-count",
      "branch-coverage-percentage",
    ],
  );
  assert.ok(
    result.issues.every((issue) => issue.location.path === "coverage.md"),
  );
});

/**
 * 是正表は一般表を誤認せず、解決・阻害の相関と必要値を検査する。
 * @responsibility 一般表は対象外とし、解決・阻害状態と必要値の不足を区別する。
 * @trace RCM-UT-002
 * @precondition 一般表と是正表の正常・不足・状態矛盾を使う。
 * @stimulus 表の列構成と各行を検査する。
 * @observation 是正行数と診断理由を取得する。
 * @oracle 一般表は対象外とし、解決・阻害状態と必要値の不足を区別する。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("是正表は一般表を誤認せず、解決・阻害の相関と必要値を検査する", () => {
  const resolved =
    "## 是正\n| 処置進捗 | 阻害状態 | 解消判定 |\n|---|---|---|\n| Applied | None | Resolved |";
  const result = inspectRemediationTable({
    path: "remediation.md",
    content: resolved,
  });
  assert.equal(result.remediationRowsChecked, 1);
  assert.deepEqual(
    result.issues.map((issue) => issue.reason),
    ["premature-remediation-resolution", "inconsistent-remediation-state"],
  );
  const blocked = inspectRemediationTable({
    path: "remediation.md",
    content: resolved.replace(
      "Applied | None | Resolved",
      "Identified | Blocked | Open",
    ),
  });
  assert.deepEqual(
    blocked.issues.map((issue) => issue.reason),
    ["incomplete-remediation-blocker"],
  );
  const ordinary = inspectRemediationTable({
    path: "ordinary.md",
    content: "| 状態 | 説明 |\n|---|---|\n| fixed | x |",
  });
  assert.equal(ordinary.remediationRowsChecked, 0);
  assert.equal(ordinary.issues.length, 0);
});

/**
 * Related順序とID所有は可視条件・先頭節・出現位置を維持する。
 * @responsibility 先頭節・可視条件・定義所有の既存範囲を維持する。
 * @trace RCM-UT-002
 * @precondition 可視・非可視のRelated節とID定義を用意する。
 * @stimulus Related順序と定義所有を検査する。
 * @observation 位置とIDを含むIssueを取得する。
 * @oracle 先頭節・可視条件・定義所有の既存範囲を維持する。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("Related順序とID所有は可視条件・先頭節・出現位置を維持する", () => {
  assert.equal(
    inspectRelatedOrder({ path: "a.md", content: "# A" }).hasRelated,
    false,
  );
  const order = inspectRelatedOrder({
    path: "a.md",
    content:
      "Related:\n- [B](02_B.md)\n- [A](01_A.md)\nnot a bullet\n- [Z](00_Z.md)",
  });
  assert.equal(order.hasRelated, true);
  assert.equal(order.issues.length, 1);
  const identity = inspectStableIdentityDefinitions(
    {
      path: "sample.md",
      content:
        "# REQ-000001\nid: REQ-000001\nREQ-000001@2\n```md\n# REQ-000002\n```",
    },
    false,
  );
  assert.deepEqual(identity.stableIdDefinitions.get("REQ-000001"), [
    "sample.md:1",
    "sample.md:2",
  ]);
  assert.equal(identity.stableIdDefinitions.has("REQ-000002"), false);
  assert.equal(identity.issues[0]?.reason, "stable-id-manual-revision");
  const links = inspectDiscoveryIdentityLinks({
    path: "input.md",
    content:
      "[REQ-000001](01_Discovery/Analysis/EXP-000001/exploration.md)\n```md\n[REQ-000002](01_Discovery/Analysis/EXP-000002/exploration.md)\n```",
  });
  assert.equal(links.issues.length, 1);
});

/**
 * READMEとCandidate Headerの限定文法を解析する。
 * @responsibility 採用済み文法だけから版を返し、不一致はnullとする。
 * @trace RCM-UT-002
 * @precondition READMEとCandidate Headerの正規・境界表記を使う。
 * @stimulus 各版Headerの解析を呼ぶ。
 * @observation 版文字列とnullを取得する。
 * @oracle 採用済み文法だけから版を返し、不一致はnullとする。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("READMEとCandidate Headerの限定文法を解析する", () => {
  assert.equal(
    parseReadmeVersion("# CRDD\n\nVersion: **v0.22.0 Candidate**"),
    "v0.22.0",
  );
  assert.equal(parseReadmeVersion("# CRDD\nintro\nVersion: v0.22.0"), null);
  assert.equal(
    parseReadmeVersion("```md\nVersion: v9.0.0\n```\n# CRDD\nVersion: v0.22.0"),
    "v0.22.0",
  );
  for (const content of [
    "Status: Candidate (v0.22.0, draft)",
    "状態: Candidate（v0.22.0、draft）",
    "Version: **v0.22.0 Candidate**",
  ])
    assert.equal(parseCandidateVersionHeader(content), "v0.22.0");
  assert.equal(parseCandidateVersionHeader("Status: Stable"), null);
});

/**
 * 正本文書の版・Candidate・Released Baselineの集合相関を照合する。
 * @responsibility 版と状態の相関違反だけを検出する。
 * @trace RCM-UT-002
 * @precondition 正本文書、CandidateとReleased Baselineの版集合を用意する。
 * @stimulus 版集合の相関を検査する。
 * @observation 一致・不一致のIssue列を取得する。
 * @oracle 版と状態の相関違反だけを検出する。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("正本文書の版・Candidate・Released Baselineの集合相関を照合する", () => {
  const candidateDocuments = [
    {
      file: "a.md",
      version: "v0.22.0",
      status: "Candidate",
      releasedBaseline: "v0.21.0",
    },
  ];
  const result = inspectCanonicalDocumentVersions(
    [["a.md", "v0.22.0"]],
    candidateDocuments,
  );
  assert.equal(result.candidateReleasedBaseline, "v0.21.0");
  assert.equal(result.issues.length, 0);
  const mismatch = inspectCanonicalDocumentVersions(
    [
      ["a.md", "v0.22.0"],
      ["b.md", "v0.21.0"],
    ],
    [
      ...candidateDocuments,
      {
        file: "b.md",
        version: "v0.21.0",
        status: "Stable",
        releasedBaseline: "v0.20.0",
      },
    ],
  );
  assert.deepEqual(
    mismatch.issues.map((issue) => issue.reason),
    [
      "version-mismatch",
      "version-mismatch",
      "released-baseline-outside-candidate",
      "candidate-status-mismatch",
      "candidate-status-mismatch",
      "candidate-version-equals-released-baseline",
    ],
  );
});

/**
 * CHANGELOGは二言語・閉じた宣言・移行条件を照合する。
 * @responsibility 閉じた宣言と現在版の条件を満たす本文だけを受理する。
 * @trace RCM-UT-002
 * @precondition 二言語版見出し、宣言、移行条件の合成CHANGELOGを使う。
 * @stimulus 現在版の公開条件を検査する。
 * @observation 版欠落・宣言・移行のIssueを取得する。
 * @oracle 閉じた宣言と現在版の条件を満たす本文だけを受理する。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("CHANGELOGは二言語・閉じた宣言・移行条件を照合する", () => {
  const content =
    "## English\n### v0.22.0 — 2026-10-20\n- `migration_required: false`\n## 日本語\n### v0.22.0 — 2026-10-20\n- `migration_required: false`\n";
  assert.equal(
    inspectChangelogRelease({ path: "CHANGELOG.md", content }, "v0.22.0").issues
      .length,
    0,
  );
  const migration = inspectChangelogRelease(
    {
      path: "CHANGELOG.md",
      content: content.replaceAll(
        "migration_required: false",
        "migration_required: true",
      ),
    },
    "v0.22.0",
  );
  assert.deepEqual(
    migration.issues.map((issue) => issue.reason),
    [
      "migration-status-undetermined",
      "migration-status-undetermined",
      "migration-note-incomplete",
      "migration-note-incomplete",
    ],
  );
  const missing = inspectChangelogRelease(
    { path: "CHANGELOG.md", content: "" },
    "v0.22.0",
  );
  assert.equal(missing.issues.length, 2);
  const yaml = content.replaceAll(
    "- `migration_required: false`",
    "```yaml\nmigration_required: false\n```",
  );
  assert.equal(
    inspectChangelogRelease({ path: "CHANGELOG.md", content: yaml }, "v0.22.0")
      .issues.length,
    0,
  );
});

/**
 * Stable公開条件は正本文書・README・二言語日付・変更記録の状態を別々に検査する。
 * @responsibility 状態・版・日付・変更記録の不足を混同せず検出する。
 * @trace RCM-UT-002
 * @precondition Stable文書・README・二言語日付・変更記録を用意する。
 * @stimulus 公開条件を用途別に検査する。
 * @observation 各用途のIssueを取得する。
 * @oracle 状態・版・日付・変更記録の不足を混同せず検出する。
 * @cleanup N/A: 合成値の同期検査で外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同一Process内の値検査・変換。
 */
test("Stable公開条件は正本文書・README・二言語日付・変更記録の状態を別々に検査する", () => {
  assert.equal(
    inspectStableCanonicalDocuments(
      [{ file: "a.md", version: "v0.22.0", status: "Stable" }],
      "v0.22.0",
    ).issues.length,
    0,
  );
  assert.equal(
    inspectStableCanonicalDocuments(
      [{ file: "a.md", version: "v0.21.0", status: "Candidate" }],
      "v0.22.0",
    ).issues.length,
    1,
  );
  assert.equal(
    inspectStableReadme(
      { path: "README.md", content: "Version: **v0.22.0**" },
      "v0.22.0",
    ).issues.length,
    0,
  );
  assert.equal(
    inspectStableReadme(
      { path: "README.md", content: "Version: **v0.21.0 Candidate**" },
      "v0.22.0",
    ).issues.length,
    2,
  );
  assert.equal(
    inspectStableChangelog(
      {
        path: "CHANGELOG.md",
        content: "### v0.22.0 — 2026-10-20\n### v0.22.0 — 2026-10-20",
      },
      "v0.22.0",
    ).issues.length,
    0,
  );
  assert.equal(
    inspectStableChangelog(
      {
        path: "CHANGELOG.md",
        content: "### v0.22.0 — 2026-10-20\n### v0.22.0 — 2026-10-21",
      },
      "v0.22.0",
    ).issues.length,
    1,
  );
  assert.equal(
    inspectStableReleaseHeader(
      "対象版: `v0.22.0`\n状態: `Released`",
      "99_Roadmap/Changes/CHG-000082/change.md",
      "v0.22.0",
      null,
    ).issues[0]?.reason,
    "stable-release-change-trace-premature-release",
  );
  assert.equal(
    inspectStableReleaseHeader(
      "状態: Candidate（v0.22.0）",
      "README.md",
      "v0.22.0",
      null,
    ).issues.length,
    1,
  );
});
