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
  inspectDocumentRelations,
  inspectReleaseConsistency,
  inspectReleaseDocuments,
  parseArtifact,
  parseCanonicalDocument,
  parseChangelog,
  parseDiscoveryReferences,
  parseQualityTables,
  parseReadme,
  parseUxIndex,
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
  const headerDocument = parseCanonicalDocument({
    path: "a.md",
    content:
      "Version: v0.22.0\nStatus: Candidate\nReleased Baseline: v0.21.0\n\n## 本文\nStatus: Stable",
  }).result;
  assert.deepEqual(
    [
      headerDocument.version,
      headerDocument.status,
      headerDocument.releasedBaseline,
    ],
    ["v0.22.0", "Candidate", "v0.21.0"],
  );
  const missingHeader = parseCanonicalDocument({
    path: "a.md",
    content: "# 文書",
  }).result;
  assert.deepEqual(
    [
      missingHeader.version,
      missingHeader.status,
      missingHeader.releasedBaseline,
    ],
    [null, null, null],
  );
  assert.deepEqual(
    parseArtifact({
      path: "fixture.md",
      content: "REQ-000001 REQ-000001\n```\nUX-000001\n```",
    }).result.identity.occurrences,
    ["REQ-000001", "REQ-000001", "UX-000001"],
  );
  const owners = new Map([
    ["REQ-000001", ["a.md:1", "b.md:2"]],
    ["UX-000001", ["c.md:3"]],
  ]);
  const issues = inspectDocumentRelations({
    kind: "identity_ownership",
    definitions: owners,
  });
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
  const result = parseQualityTables({ path: "coverage.md", content });
  assert.equal(result.result.numericRowsChecked, 3);
  assert.equal(result.status, "partial");
  assert.equal(result.result.artifact.source.content, content);
  assert.deepEqual(result.issues, [
    ...result.result.branchIssues,
    ...result.result.remediationIssues,
  ]);
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
  const result = parseQualityTables({
    path: "remediation.md",
    content: resolved,
  });
  assert.equal(result.result.remediationRowsChecked, 1);
  assert.deepEqual(
    result.issues.map((issue) => issue.reason),
    ["premature-remediation-resolution", "inconsistent-remediation-state"],
  );
  const blocked = parseQualityTables({
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
  const ordinary = parseQualityTables({
    path: "ordinary.md",
    content: "| 状態 | 説明 |\n|---|---|\n| fixed | x |",
  });
  assert.equal(ordinary.result.remediationRowsChecked, 0);
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
    parseArtifact({ path: "a.md", content: "# A" }).result.hasRelated,
    false,
  );
  const order = parseArtifact({
    path: "a.md",
    content:
      "Related:\n- [B](02_B.md)\n- [A](01_A.md)\nnot a bullet\n- [Z](00_Z.md)",
  });
  assert.equal(order.result.hasRelated, true);
  assert.equal(order.issues.length, 1);
  const identity = parseArtifact({
    path: "sample.md",
    content:
      "# REQ-000001\nid: REQ-000001\nREQ-000001@2\n```md\n# REQ-000002\n```",
  });
  assert.deepEqual(
    identity.result.identity.stableIdDefinitions.get("REQ-000001"),
    ["sample.md:1", "sample.md:2"],
  );
  assert.equal(
    identity.result.identity.stableIdDefinitions.has("REQ-000002"),
    false,
  );
  assert.equal(identity.issues[0]?.reason, "stable-id-manual-revision");
  const linkDocument = parseArtifact({
    path: "input.md",
    content:
      "[REQ-000001](01_Discovery/Analysis/EXP-000001/exploration.md)\n```md\n[REQ-000002](01_Discovery/Analysis/EXP-000002/exploration.md)\n```",
  });
  const links = parseDiscoveryReferences(linkDocument.result.source).issues;
  assert.equal(links.length, 1);
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
    parseReadme({
      path: "README.md",
      content: "# CRDD\n\nVersion: **v0.22.0 Candidate**",
    }).result.version,
    "v0.22.0",
  );
  assert.equal(
    parseReadme({
      path: "README.md",
      content: "# CRDD\nintro\nVersion: v0.22.0",
    }).result.version,
    null,
  );
  assert.equal(
    parseReadme({
      path: "README.md",
      content: "```md\nVersion: v9.0.0\n```\n# CRDD\nVersion: v0.22.0",
    }).result.version,
    "v0.22.0",
  );
  for (const content of [
    "Status: Candidate (v0.22.0, draft)",
    "状態: Candidate（v0.22.0、draft）",
    "Version: **v0.22.0 Candidate**",
  ])
    assert.equal(
      parseCanonicalDocument({ path: "fixture.md", content: content }).result
        .candidateVersion,
      "v0.22.0",
    );
  assert.equal(
    parseCanonicalDocument({ path: "fixture.md", content: "Status: Stable" })
      .result.candidateVersion,
    null,
  );
});

/**
 * READMEの原文と異なるHeader観測を区別する。
 * @responsibility BOM・可視行・先頭採用・本文と入力独立を確認する。
 * @trace RCM-UT-002
 * @precondition Anchor、太字説明、Fenceと二言語本文を含む原文を使う。
 * @stimulus 完成Parseへ一回渡し内容と出典を観測する。
 * @observation 版、採用行、Fence外行、二言語節と入力前後を比較する。
 * @oracle 原文と部分内容を保持し、初めの意味行で採用できなければ後続を探さない。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期Parse。
 */
test("READMEモデルは原文・可視Header・二言語本文を保持する", () => {
  const source = {
    path: "README.md",
    content:
      '\uFEFF<a id="root"></a>\r\n# Product\r\n**Description**\r\n```text\r\nVersion: v9.0.0\r\n```\r\nVersion: **v0.22.0**\r\n\r\n## English\r\nEnglish text\r\n## 日本語\r\n日本語本文\r\n',
  };
  const before = structuredClone(source);
  const parsed = parseReadme(source);
  assert.equal(parsed.status, "complete");
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.result.version, "v0.22.0");
  assert.deepEqual(parsed.result.selectedHeader, {
    text: "Version: **v0.22.0**",
    location: { path: "README.md", line: 7 },
  });
  assert.equal(
    parsed.result.outsideFenceLines.some(
      (line) => line.text === "Version: v9.0.0",
    ),
    false,
  );
  assert.equal(parsed.result.english[0]?.body.text.trim(), "English text");
  assert.equal(parsed.result.japanese[0]?.body.text.trim(), "日本語本文");
  assert.deepEqual(source, before);
  source.content = "changed";
  assert.deepEqual(parsed.result.source, before);
  for (const content of [
    "# Product\nIntroduction\nVersion: v0.22.0",
    "",
    "# Product\n# Another\nVersion: v0.22.0",
  ]) {
    const result = parseReadme({ path: "README.md", content });
    assert.equal(result.result.version, null);
    assert.deepEqual(result.issues, []);
  }
});

/**
 * Stable比較のraw全文と先頭20行をモデル経由で確認する。
 * @responsibility 採用Header版との混同と行ごとの比較による意味変更を拒否する。
 * @trace RCM-UT-002
 * @precondition Fence内表示、コメント内Candidate、20／21行境界と改行を含む期待値を使う。
 * @stimulus Parse後にSemanticのStable比較を呼ぶ。
 * @observation 問題種別・順序と原文不変を観測する。
 * @oracle 従来のliteral比較とraw先頭20行の残留だけを報告する。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期比較。
 */
test("READMEのStable比較は全文表示と20行の残留断面を維持する", () => {
  for (const [content, version, reasons] of [
    [
      "```text\nVersion: **v0.22.0**\n```\n# Product\nVersion: v0.21.0",
      "v0.22.0",
      [],
    ],
    ["Version: **v1\nx**", "v1\nx", []],
    [
      "Version: **v0.22.0**\n<!-- Candidate -->",
      "v0.22.0",
      ["stable-release-readme-candidate-residue"],
    ],
    [
      `${"\n".repeat(19)}Candidate`,
      "v0.22.0",
      [
        "stable-release-readme-version-mismatch",
        "stable-release-readme-candidate-residue",
      ],
    ],
    [
      `${"\n".repeat(20)}Candidate`,
      "v0.22.0",
      ["stable-release-readme-version-mismatch"],
    ],
  ] as const) {
    const readme = parseReadme({ path: "README.md", content }).result;
    const before = structuredClone(readme);
    const issues = inspectReleaseConsistency({
      kind: "stable_readme",
      readme,
      stableVersion: version,
    });
    assert.deepEqual(
      issues.map((issue) => issue.reason),
      reasons,
    );
    assert.deepEqual(readme, before);
  }
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
  const candidate = parseCanonicalDocument({
    path: "a.md",
    content: "Version: v0.22.0\nStatus: Candidate\nReleased Baseline: v0.21.0",
  });
  const result = inspectReleaseDocuments([candidate]);
  assert.equal(result.candidateReleasedBaseline, "v0.21.0");
  assert.equal(result.issues.length, 0);
  assert.equal(result.versionedDocumentCount, 1);
  assert.equal(result.stableVersion, null);
  const stable = parseCanonicalDocument({
    path: "b.md",
    content: "Version: v0.21.0\nStatus: Stable\nReleased Baseline: v0.20.0",
  });
  assert.deepEqual(
    stable.issues.map((issue) => issue.reason),
    ["released-baseline-outside-candidate"],
  );
  const mismatch = inspectReleaseDocuments([candidate, stable]);
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
  assert.equal(mismatch.versionedDocumentCount, 2);
  assert.equal(mismatch.stableVersion, null);
  const missingBaseline = parseCanonicalDocument({
    path: "missing.md",
    content: "Version: v0.21.0\nStatus: Candidate",
  });
  const selfBaseline = parseCanonicalDocument({
    path: "self.md",
    content: "Version: v0.21.0\nStatus: Candidate\nReleased Baseline: v0.21.0",
  });
  assert.equal(missingBaseline.status, "partial");
  assert.equal(selfBaseline.status, "partial");
  assert.deepEqual(
    missingBaseline.issues.map((issue) => issue.reason),
    ["candidate-released-baseline-mismatch"],
  );
  assert.deepEqual(
    selfBaseline.issues.map((issue) => issue.reason),
    ["candidate-version-equals-released-baseline"],
  );
  assert.deepEqual(
    inspectReleaseDocuments([missingBaseline]).issues,
    missingBaseline.issues,
  );
  assert.deepEqual(
    inspectReleaseDocuments([selfBaseline]).issues,
    selfBaseline.issues,
  );
  for (const other of [
    missingBaseline,
    parseCanonicalDocument({
      path: "other.md",
      content:
        "Version: v0.21.0\nStatus: Candidate\nReleased Baseline: v0.20.0",
    }),
  ]) {
    const grouped = inspectReleaseDocuments([selfBaseline, other]);
    assert.deepEqual(
      grouped.issues.map((issue) => issue.reason),
      [
        "candidate-released-baseline-mismatch",
        "candidate-released-baseline-mismatch",
      ],
    );
    assert.equal(
      grouped.issues[0]?.details?.value1,
      other === missingBaseline ? '["v0.21.0"]' : '["v0.20.0","v0.21.0"]',
    );
    assert.equal(grouped.candidateReleasedBaseline, null);
  }
});

/**
 * 正本文書モデルの全文と限定Header断面を区別する。
 * @responsibility 宣言の文法・優先順・原文と入力独立を検証する。
 * @trace RCM-UT-002
 * @precondition 共通Header、本文、Candidate三形式と16行境界を使う。
 * @stimulus 完成Parseへ実際の取得断面を渡す。
 * @observation 内容・出典・局所Issue・版の優先順を確認する。
 * @oracle 未取得本文を補完せず、局所不備でも内容を保持する。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期Parse。
 */
test("正本文書モデルは全文と16行断面・宣言優先順を保持する", () => {
  for (const newline of ["\n", "\r\n"]) {
    const content = [
      '\uFEFF<a id="root"></a>',
      "",
      "# Version: v0.22.0",
      "",
      "Version: v0.22.0",
      "",
      "Status: Candidate",
      "Released Baseline: v0.21.0",
      "",
      "## 本文",
      "本文",
    ].join(newline);
    const result = parseCanonicalDocument({ path: "header.md", content });
    assert.deepEqual(result.result.header, {
      text: "Version: v0.22.0\nStatus: Candidate\nReleased Baseline: v0.21.0",
      location: { path: "header.md", line: 5 },
    });
    assert.deepEqual(result.issues, []);
  }
  assert.equal(
    parseCanonicalDocument({ path: "header.md", content: "# 文書\n\n本文" })
      .result.header,
    null,
  );
  const source = {
    path: "a.md",
    content:
      "Version: v0.22.0\r\nStatus: Stable\r\nReleased Baseline: v0.21.0\r\n\r\n## 本文\r\n本文を保持する\r\n",
  };
  const before = structuredClone(source);
  const parsed = parseCanonicalDocument(source);
  assert.equal(parsed.status, "partial");
  assert.deepEqual(parsed.issues, [
    {
      kind: "artifact.document-identity.released-baseline-outside-candidate",
      targetIdentity: "a.md",
      location: { path: "a.md" },
      reason: "released-baseline-outside-candidate",
      details: { value0: "Stable" },
    },
  ]);
  assert.equal(
    parsed.result.artifact.sections[0]?.body.includes("本文を保持する"),
    true,
  );
  assert.deepEqual(source, before);
  source.content = "changed";
  assert.deepEqual(parsed.result.source, before);
  assert.equal(
    parseCanonicalDocument({
      path: "a.md",
      content:
        "状態: Candidate（v0.23.0）\nStatus: Candidate (v0.22.0, draft)\nVersion: **v0.24.0 Candidate**",
    }).result.candidateVersion,
    "v0.22.0",
  );
  const full = `${"line\n".repeat(16)}状態: Candidate（v0.22.0）`;
  const header = full.split(/\r?\n/u).slice(0, 16).join("\n");
  const limited = parseCanonicalDocument({ path: "a.md", content: header });
  assert.equal(limited.result.candidateVersion, null);
  assert.equal(limited.result.source.content, header);
  assert.equal(limited.result.rawLines.length, 16);
  assert.equal(
    parseCanonicalDocument({ path: "a.md", content: full }).result
      .candidateVersion,
    "v0.22.0",
  );
});

/**
 * 集合評価の候補版と公開・品質の成立を分離する。
 * @responsibility 版欠測・空集合・単件・混在状態の旧条件を確認する。
 * @trace RCM-UT-002
 * @precondition 実Parserから空・単件・複数のモデル列を構築する。
 * @stimulus 集合評価とStable比較へ渡す。
 * @observation 版集合・件数・候補版・診断と入力不変を照合する。
 * @oracle 候補版があっても状態不整合を消さず、版欠測をSetへ混ぜない。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期モデル比較。
 */
test("正本文書集合はStable観測候補と状態不整合を区別する", () => {
  const stable = parseCanonicalDocument({
    path: "a.md",
    content: "Version: v0.22.0\nStatus: Stable",
  });
  const candidate = parseCanonicalDocument({
    path: "b.md",
    content: "Version: v0.22.0\nStatus: Candidate\nReleased Baseline: v0.21.0",
  });
  const missing = parseCanonicalDocument({
    path: "c.md",
    content: "Status: Stable",
  });
  assert.equal(inspectReleaseDocuments([]).stableVersion, null);
  assert.equal(inspectReleaseDocuments([stable]).stableVersion, null);
  const absent = inspectReleaseDocuments([stable, missing]);
  assert.deepEqual([...absent.versions], ["v0.22.0"]);
  assert.equal(absent.versionedDocumentCount, 1);
  assert.equal(absent.stableVersion, null);
  const documents = [stable, candidate];
  const before = structuredClone(documents);
  const mixed = inspectReleaseDocuments(documents);
  assert.equal(mixed.stableVersion, "v0.22.0");
  assert.equal(mixed.versionedDocumentCount, 2);
  assert.deepEqual(
    mixed.issues.map((issue) => issue.reason),
    ["candidate-status-mismatch", "candidate-status-mismatch"],
  );
  assert.deepEqual(
    inspectReleaseConsistency({
      kind: "stable_canonical_documents",
      documents: documents.map((document) => document.result),
      stableVersion: "v0.22.0",
    }).map((issue) => issue.reason),
    ["stable-release-canonical-status-mismatch"],
  );
  assert.deepEqual(documents, before);
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
    parseChangelog({ path: "CHANGELOG.md", content }, { version: "v0.22.0" })
      .issues.length,
    0,
  );
  const migration = parseChangelog(
    {
      path: "CHANGELOG.md",
      content: content.replaceAll(
        "migration_required: false",
        "migration_required: true",
      ),
    },
    { version: "v0.22.0" },
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
  const missing = parseChangelog(
    { path: "CHANGELOG.md", content: "" },
    { version: "v0.22.0" },
  );
  assert.equal(missing.issues.length, 2);
  const yaml = content.replaceAll(
    "- `migration_required: false`",
    "```yaml\nmigration_required: false\n```",
  );
  assert.equal(
    parseChangelog(
      { path: "CHANGELOG.md", content: yaml },
      { version: "v0.22.0" },
    ).issues.length,
    0,
  );
});

/**
 * CHANGELOGの全履歴と診断対象版を分離する。
 * @responsibility 版節・原文・宣言行と対象外の旧形式を保持する。
 * @trace RCM-UT-002
 * @precondition 現行版の正常宣言と旧版の宣言欠測を同居させる。
 * @stimulus それぞれの版を明示して完成Parseへ渡す。
 * @observation 全版節、採用節、宣言出典、原文とIssueを比較する。
 * @oracle 過去版の捕捉を現行版の不合格へ変換せず、入力と共有しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期Parse。
 */
test("CHANGELOGモデルは全履歴と対象版の診断を区別する", () => {
  const content = [
    "## English",
    "### v0.22.0 — 2026-11-15",
    "- `migration_required: false`",
    "### v0.21.0 — 2026-09-01",
    "Legacy prose",
    "## 日本語",
    "### v0.22.0 — 2026-11-15",
    "```yaml",
    "migration_required: false",
    "```",
    "### v0.21.0 — 2026-09-01",
    "過去の説明",
  ].join("\r\n");
  const source = { path: "CHANGELOG.md", content };
  const before = structuredClone(source);
  const parsed = parseChangelog(source, { version: "v0.22.0" });
  assert.equal(parsed.status, "complete");
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.result.selectedVersion, "v0.22.0");
  assert.deepEqual(
    parsed.result.languages.map(
      (language) => language.sections[0]?.releases.length,
    ),
    [2, 2],
  );
  assert.equal(
    parsed.result.languages[0]?.sections[0]?.releases[0]?.body.text,
    "- `migration_required: false`\r\n",
  );
  assert.deepEqual(
    parsed.result.languages[1]?.selectedReleases[0]?.migrationRequired,
    {
      valid: true,
      value: "false",
      attempts: [
        {
          text: "migration_required: false",
          location: { path: "CHANGELOG.md", line: 9 },
        },
      ],
    },
  );
  assert.deepEqual(source, before);
  source.content = "changed";
  assert.deepEqual(parsed.result.source, before);
  const previous = parseChangelog(before, { version: "v0.21.0" });
  assert.deepEqual(
    previous.issues.map((issue) => issue.reason),
    ["migration-status-undetermined", "migration-status-undetermined"],
  );
  assert.equal(previous.result.languages[0]?.sections[0]?.releases.length, 2);
});

/**
 * Stable見出しのraw全文比較を維持する。
 * @responsibility Fence外の現行注記検査とraw版指定比較の範囲を混同しない。
 * @trace RCM-UT-002
 * @precondition Fence内の見出し、異なる日付、改行を含む期待版を使う。
 * @stimulus Parse後のモデルをSemanticへ渡す。
 * @observation 局所IssueとStable比較のIssueを別々に観測する。
 * @oracle raw見出し二件・日付一意の旧条件を保持する。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期比較。
 */
test("CHANGELOGのStable比較はraw全文と任意の期待版を維持する", () => {
  for (const [content, version, expected] of [
    [
      "```text\n### v0.22.0 — 2026-11-15\n### v0.22.0 — 2026-11-15\n```",
      "v0.22.0",
      0,
    ],
    ["### v0.22.0 — 2026-11-15\n### v0.22.0 — 2026-11-16", "v0.22.0", 1],
    ["### v1\nx — 2026-11-15\n### v1\nx — 2026-11-15", "v1\nx", 0],
  ] as const) {
    const parsed = parseChangelog(
      { path: "CHANGELOG.md", content },
      { version },
    );
    assert.equal(parsed.status, "partial");
    assert.equal(parsed.issues.length, 2);
    const before = structuredClone(parsed.result);
    assert.equal(
      inspectReleaseConsistency({
        kind: "stable_changelog",
        changelog: parsed.result,
        stableVersion: version,
      }).length,
      expected,
    );
    assert.deepEqual(parsed.result, before);
  }
});

/**
 * 未閉鎖YAMLによる拒否と閉じた宣言の内容保持を分離する。
 * @responsibility 早期拒否を捕捉打切りへ流用しないことを確認する。
 * @trace RCM-UT-002
 * @precondition 閉じたYAMLの後に未閉鎖YAMLを置く。
 * @stimulus 完成Parseへ対象版を明示して渡す。
 * @observation 宣言出現・行位置・優先不正理由と全Issueを比較する。
 * @oracle 閉じた宣言だけを保持し、未閉鎖内を採用せず旧理由・診断順を維持する。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期Parse。
 */
test("未閉鎖YAMLの拒否でも別の閉じた宣言をモデルへ保持する", () => {
  const content = [
    "## English",
    "### v0.22.0 — 2026-11-15",
    "- `migration_required: false`",
    "## 日本語",
    "### v0.22.0 — 2026-11-15",
    "```yaml",
    "migration_required: true",
    "change_classification: normative",
    "```",
    "```yaml",
    "migration_required: false",
  ].join("\n");
  const parsed = parseChangelog(
    { path: "CHANGELOG.md", content },
    { version: "v0.22.0" },
  );
  const release = parsed.result.languages[1]?.selectedReleases[0];
  assert.deepEqual(release?.migrationRequired, {
    valid: false,
    reason: "unclosed-yaml-fence",
    attempts: [
      {
        text: "migration_required: true",
        location: { path: "CHANGELOG.md", line: 7 },
      },
    ],
  });
  assert.deepEqual(release?.changeClassification, {
    valid: false,
    reason: "unclosed-yaml-fence",
    attempts: [
      {
        text: "change_classification: normative",
        location: { path: "CHANGELOG.md", line: 8 },
      },
    ],
  });
  assert.equal(parsed.status, "partial");
  assert.deepEqual(parsed.issues, [
    {
      kind: "artifact.document-rule.migration-status-undetermined",
      targetIdentity: "CHANGELOG.md",
      location: { path: "CHANGELOG.md" },
      reason: "migration-status-undetermined",
      details: {
        value0: "日本語",
        value1: "v0.22.0",
        value2: "unclosed-yaml-fence",
      },
    },
  ]);
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
    inspectReleaseConsistency({
      kind: "stable_canonical_documents",
      documents: [{ file: "a.md", version: "v0.22.0", status: "Stable" }].map(
        (document) =>
          parseCanonicalDocument({
            path: document.file,
            content: `Version: ${document.version}\nStatus: ${document.status}`,
          }).result,
      ),
      stableVersion: "v0.22.0",
    }).length,
    0,
  );
  assert.equal(
    inspectReleaseConsistency({
      kind: "stable_canonical_documents",
      documents: [
        { file: "a.md", version: "v0.21.0", status: "Candidate" },
      ].map(
        (document) =>
          parseCanonicalDocument({
            path: document.file,
            content: `Version: ${document.version}\nStatus: ${document.status}`,
          }).result,
      ),
      stableVersion: "v0.22.0",
    }).length,
    1,
  );
  assert.equal(
    inspectReleaseConsistency({
      kind: "stable_readme",
      readme: parseReadme({
        path: "README.md",
        content: "Version: **v0.22.0**",
      }).result,
      stableVersion: "v0.22.0",
    }).length,
    0,
  );
  assert.equal(
    inspectReleaseConsistency({
      kind: "stable_readme",
      readme: parseReadme({
        path: "README.md",
        content: "Version: **v0.21.0 Candidate**",
      }).result,
      stableVersion: "v0.22.0",
    }).length,
    2,
  );
  assert.equal(
    inspectReleaseConsistency({
      kind: "stable_changelog",
      changelog: parseChangelog(
        {
          path: "CHANGELOG.md",
          content: "### v0.22.0 — 2026-10-20\n### v0.22.0 — 2026-10-20",
        },
        { version: "v0.22.0" },
      ).result,
      stableVersion: "v0.22.0",
    }).length,
    0,
  );
  assert.equal(
    inspectReleaseConsistency({
      kind: "stable_changelog",
      changelog: parseChangelog(
        {
          path: "CHANGELOG.md",
          content: "### v0.22.0 — 2026-10-20\n### v0.22.0 — 2026-10-21",
        },
        { version: "v0.22.0" },
      ).result,
      stableVersion: "v0.22.0",
    }).length,
    1,
  );
  assert.equal(
    inspectReleaseConsistency({
      kind: "stable_release_document",
      document: parseCanonicalDocument({
        path: "99_Roadmap/Changes/CHG-000082/change.md",
        content: "対象版: `v0.22.0`\n状態: `Released`",
      }).result,
      stableVersion: "v0.22.0",
      stableTagCommit: null,
    })[0]?.reason,
    "stable-release-change-trace-premature-release",
  );
  assert.throws(
    () =>
      inspectReleaseConsistency({ kind: "unknown" } as unknown as Parameters<
        typeof inspectReleaseConsistency
      >[0]),
    /release_consistency_kind_invalid/u,
  );
  assert.equal(
    inspectReleaseConsistency({
      kind: "stable_release_document",
      document: parseCanonicalDocument({
        path: "README.md",
        content: "状態: Candidate（v0.22.0）",
      }).result,
      stableVersion: "v0.22.0",
      stableTagCommit: null,
    }).length,
    1,
  );
});

/**
 * Identityの一般宣言とUX固有表宣言を同じ取得から区別する。
 * @responsibility BOM・コメント・Fence・CRLF・重複と行位置を保持する。
 * @trace RCM-UT-002
 * @precondition 一般宣言・UX表宣言・非表示リンクを含む合成文書。
 * @stimulus Identity内容受付とUX台帳受付から観測する。
 * @observation 原文・宣言・リンク・手動改訂と工程間Issueを取得する。
 * @oracle 汎用宣言にUX表を混ぜず、コードフェンス外コメント内リンクは旧通り検査する。
 * @cleanup N/A: 局所値のみ。
 * @boundary ArtifactのIdentity観測とUX所有宣言・Semantic比較。
 */
test("Identity内容は一般宣言とUX表宣言・rawリンクを分離する", () => {
  const source = {
    path: "ux.md",
    content:
      "\uFEFF# REQ-000001\r\nid: REQ-000001\r\n| `UX-000001` 説明 |\r\n| `UX-000001` 重複 |\r\n<!-- REQ-000001@2 [REQ-000001](../01_Discovery/Analysis/EXP-000001/exploration.md) -->\r\n```md\r\n| `UX-000002` 隠れた行 |\r\n[REQ-000002](../01_Discovery/Analysis/EXP-000002/exploration.md)\r\n```",
  };
  const parsed = parseArtifact(source);
  const ux = parseUxIndex(source).result;
  source.content = "changed";
  assert.notEqual(parsed.result.source.content, source.content);
  assert.deepEqual(
    parsed.result.identity.stableIdDefinitions.get("REQ-000001"),
    ["ux.md:2"],
  );
  assert.equal(
    parsed.result.identity.stableIdDefinitions.has("UX-000001"),
    false,
  );
  assert.deepEqual(ux.identityDefinitions.get("UX-000001"), [
    "ux.md:3",
    "ux.md:4",
  ]);
  assert.equal(ux.identityDefinitions.has("UX-000002"), false);
  assert.equal(parsed.result.identity.links.length, 1);
  assert.equal(parsed.result.identity.links[0]?.source.location.line, 5);
  assert.equal(parsed.result.identity.manualRevisions[0]?.location.line, 5);
  assert.equal(parsed.result.identity.occurrences.includes("REQ-000002"), true);
  const issues = parseDiscoveryReferences(parsed.result.source).issues;
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.details.value0, "REQ-000001");
  assert.equal(parsed.issues[0]?.reason, "stable-id-manual-revision");
});
