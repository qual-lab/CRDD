/**
 * Change文書モデル・ひな型・案内集合を完成受付から検証する。
 * @packageDocumentation
 * @responsibility 打切り、適用閾値、生本文と指定区画の既存条件を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope artifact、change
 * @boundary RCM-UT-002=N/A: 既読合成本文の同期モデル検査。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectChangeNavigation,
  inspectChangePlacement,
  parseChangeDocument,
  parseChangeIndex,
} from "../../../src/index.ts";

/**
 * Change配置を別取得Headerと照合する。
 * @responsibility 取得断面を統合せず集約名と宣言の不一致を保持する。
 * @trace RCM-UT-002
 * @precondition 独立の部分モデルを使用。
 * @stimulus ファイル名・Evidence・集約の各完成比較。
 * @observation Issue種別と件数。
 * @oracle 旧条件だけを拒否する。
 * @cleanup N/A: I/Oなし。
 */
test("Change配置はHeader別観測と集約Identityを区別する", () => {
  const base = parseChangeDocument(
    { path: "change.md", content: "" },
    { mode: "canonical" },
  ).result;
  const heading = { ...base, hasStandardHeading: true, changeId: null };
  const identity = {
    ...base,
    hasStandardHeading: false,
    changeId: "CHG-000001",
  };
  assert.equal(
    inspectChangePlacement({ kind: "evidence", heading, identity }).length,
    1,
  );
  assert.deepEqual(
    inspectChangePlacement({
      kind: "evidence",
      heading: identity,
      identity: heading,
    }),
    [],
  );
  for (const [aggregateName, changeId, invalid] of [
    ["CHG-000001", "CHG-000001", false],
    ["CHG-XXXXXX", "CHG-XXXXXX", false],
    ["CHG-000001", null, true],
    ["CHG-000001", "CHG-000002", true],
    ["wrong", "CHG-000001", true],
  ] as const)
    assert.equal(
      inspectChangePlacement({
        kind: "aggregate",
        aggregateName,
        document: { ...base, changeId },
      }).length,
      invalid ? 1 : 0,
    );
  for (const [path, invalid] of [
    ["CHG-000001.md", true],
    ["CHG-custom.md", true],
    ["CHG-000001.part.md", false],
    ["change.md", false],
  ] as const)
    assert.equal(
      inspectChangePlacement({ kind: "filename", path }).length,
      invalid ? 1 : 0,
    );
});

/**
 * 影響見出しとBlock不正の異なる短絡を確認する。
 * @responsibility 見出し不正だけの打切りと番号79／80の閾値を検証する。
 * @trace RCM-UT-002
 * @precondition 不正見出し、空Block、平坦な正常Blockを用意する。
 * @stimulus Canonical文書検査を呼ぶ。
 * @observation Issueの分類と順序を取得する。
 * @oracle 見出し不正は一件、Block不正は旧見出しとPhaseまで続行する。
 * @cleanup N/A: 局所文字列だけを使う。
 * @boundary RCM-UT-002=N/A: 同期モデル検査。
 */
test("変更文書は見出しだけで打ち切りBlock不正では続行する", () => {
  const missingIssues = parseChangeDocument(
    { path: "change.md", content: "### 主な反映ファイル" },
    { mode: "canonical", expectedIdentity: "CHG-000080" },
  ).issues;
  assert.deepEqual(
    missingIssues.map((issue) => issue.kind),
    ["artifact.change.impact-files-section-mismatch"],
  );
  const invalid =
    "### 影響ファイル\n\n<details>\n<summary>全ファイルを表示</summary>\n\n</details>\n### 主な反映ファイル";
  assert.deepEqual(
    parseChangeDocument(
      { path: "change.md", content: invalid },
      { mode: "canonical", expectedIdentity: "CHG-000080" },
    ).issues.map((issue) => issue.kind),
    [
      "artifact.change.impact-files-contract-invalid",
      "artifact.change.legacy-impact-heading",
      "artifact.change.phase-gate-contract-incomplete",
    ],
  );
  assert.equal(
    parseChangeDocument(
      { path: "change.md", content: invalid },
      { mode: "canonical", expectedIdentity: "CHG-000079" },
    ).issues.length,
    2,
  );
  const valid =
    "### 影響ファイル\n\n<details>\n<summary>全ファイルを表示</summary>\n\n- [source](./source.md)\n\n</details>";
  assert.deepEqual(
    parseChangeDocument(
      { path: "change.md", content: valid },
      { mode: "canonical", expectedIdentity: "CHG-000079" },
    ).issues,
    [],
  );
  assert.equal(
    parseChangeDocument(
      { path: "change.md", content: valid },
      { mode: "canonical", expectedIdentity: "CHG-000080" },
    ).issues.length,
    1,
  );
  const historical = valid.replace("- [source]", "- [旧参照][source]");
  assert.deepEqual(
    parseChangeDocument(
      { path: "99_Roadmap/Changes/CHG-000079/change.md", content: historical },
      { mode: "canonical", expectedIdentity: "CHG-000079" },
    ).issues,
    [],
  );
  for (const entry of [
    "- `old.md` → [source](./source.md)",
    "- `old.md` → [旧参照][source](./source.md)",
  ])
    assert.deepEqual(
      parseChangeDocument(
        {
          path: "99_Roadmap/Changes/CHG-000079/change.md",
          content: valid.replace("- [source](./source.md)", entry),
        },
        { mode: "canonical", expectedIdentity: "CHG-000079" },
      ).issues,
      [],
    );
  for (const entry of [
    "- [削除][source](./source.md)",
    "- [旧参照] [source](./source.md)",
    "  - [旧参照][source](./source.md)",
    "- [旧参照]`source.md`（削除）",
    "- [旧参照]`old.md` → [source](./source.md)",
    "- `old.md` → [旧参照] [source](./source.md)",
    "- [旧参照][旧参照][source](./source.md)",
    "- [旧参照][source](./source.md) extra",
  ])
    assert.ok(
      parseChangeDocument(
        {
          path: "99_Roadmap/Changes/CHG-000079/change.md",
          content: valid.replace("- [source](./source.md)", entry),
        },
        { mode: "canonical", expectedIdentity: "CHG-000079" },
      ).issues.some(
        (issue) =>
          issue.kind === "artifact.change.impact-files-contract-invalid",
      ),
      entry,
    );
  assert.equal(
    parseChangeDocument(
      { path: "change.md", content: `${valid}\n### 影響ファイル` },
      { mode: "canonical", expectedIdentity: "CHG-000080" },
    ).issues.length,
    1,
  );
  // Raw text remains the inspection source; moving to Domain does not hide comments.
  assert.deepEqual(
    parseChangeDocument(
      { path: "change.md", content: `<!--\n${valid}\n-->` },
      { mode: "canonical", expectedIdentity: "CHG-000079" },
    ).issues,
    [],
  );
});

/**
 * 変更案内の最初の指定区画と重複を確認する。
 * @responsibility 区画外・二つ目の区画を数えず、同じIDの重複を拒否する。
 * @trace RCM-UT-002
 * @precondition 区画内外と重複したリンクを合成する。
 * @stimulus 案内集合の検査を呼ぶ。
 * @observation 不正判定を取得する。
 * @oracle 最初の指定区画だけの重複なし完全一致を受理する。
 * @cleanup N/A: 局所文字列だけを使う。
 * @boundary RCM-UT-002=N/A: 同期モデル検査。
 */
test("変更案内は最初の指定区画だけを照合する", () => {
  const start = "<!-- crdd-change-aggregate-index:start -->",
    end = "<!-- crdd-change-aggregate-index:end -->";
  const link = "[change](./Changes/CHG-000065/change.md)";
  for (const [content, ids, invalid] of [
    [
      `${start}${link}${end}\n./Changes/CHG-000066/change.md`,
      ["CHG-000065"],
      false,
    ],
    [`${start}${link}${link}${end}`, ["CHG-000065"], true],
    [`${start}${end}\n${start}${link}${end}`, ["CHG-000065"], true],
    [`${start}${link}${end}`, ["CHG-000065", "CHG-000066"], true],
    [`${start}${link}${link}${end}`, ["CHG-000066"], true],
    ["", [], false],
  ] as const) {
    const parsed = parseChangeIndex({ path: "02_Changes.md", content });
    const issues = [
      ...parsed.issues,
      ...inspectChangeNavigation({
        index: parsed.result,
        observedChangeIds: ids,
      }),
    ];
    assert.equal(issues.length > 0, invalid);
    assert.equal(issues.length, invalid ? 1 : 0);
  }
});

/**
 * 変更ひな型の条件をCanonical本文と別に維持する。
 * @responsibility 必須固定語彙を持つひな型と旧任意表現を区別する。
 * @trace RCM-UT-002
 * @precondition 固定構造だけを持つ合成ひな型を使う。
 * @stimulus ひな型の不正判定を呼ぶ。
 * @observation 不正判定を取得する。
 * @oracle 合成固定構造は受理し、旧任意見出しは拒否する。
 * @cleanup N/A: 局所文字列だけを使う。
 * @boundary RCM-UT-002=N/A: 同期モデル検査。
 */
test("変更ひな型は独立した固定構造を照合する", () => {
  const template = [
    "### 影響ファイル",
    "<summary>全ファイルを表示</summary>",
    "| Phase／Gate適用判断 |",
    "## Phase／Gateと途中拡張",
    "### 適用判断",
    "### PhaseとGate",
    "### 途中拡張の記録",
    "### 途中見直しの記録",
    "## 固定前の収束確認",
    "## 変更経路の計画",
    "- 適用判定: `<Applicable／N/A: 理由／OPEN: 理由・確認先・再評価契機>`",
    "| 評価対象 | 判定 | 理由 |",
    "| 評価対象 | 判定 | 内容／理由 | 参照／再評価契機 |",
    "| Phase | 目的 | 変更範囲 | 検証 | Gate／通過条件 | 状態 |",
    "| Finding／契機 | 同じIntentと判断した理由 | 追加Phase／範囲 | Gate・完了条件への影響 | 追加確認／人間判断 | 処置 |",
    "| 契機 | 崩れた前提／旧判断 | 改訂後のPhase／Gate | 再実行する検証 | 不変範囲 | 処置 |",
  ].join("\n");
  assert.equal(
    parseChangeDocument(
      { path: "template/change.md", content: template },
      { mode: "template" },
    ).issues.length > 0,
    false,
  );
  assert.equal(
    parseChangeDocument(
      {
        path: "template/change.md",
        content: `${template}\n### 主な反映ファイル`,
      },
      { mode: "template" },
    ).issues.length > 0,
    true,
  );
  assert.equal(
    parseChangeDocument(
      {
        path: "template/change.md",
        content: template.replace(
          "## 変更経路の計画",
          "## 変更経路の計画（非自明な変更で該当する場合）",
        ),
      },
      { mode: "template" },
    ).issues.length > 0,
    true,
  );
});

/**
 * Headerの取得範囲と完全本文の内容を区別する。
 * @responsibility 旧Headerの二反証を移し、部分結果と独立捕捉を確認する。
 * @trace RCM-UT-002
 * @precondition 合成Headerと40行境界、影響区画を持つraw本文を使う。
 * @stimulus 完成Parseから宣言・出典・診断を取得する。
 * @observation Header値、影響行、取得原文と期待Identityを照合する。
 * @oracle Headerは先頭40行だけ、局所違反でも本文を保持し入力と共有しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期Parse。
 */
test("ChangeモデルはHeader範囲・原文・出典・期待Identityを区別する", () => {
  const named = parseChangeDocument(
    {
      path: "change.md",
      content:
        "## 主な変更意図\n意図の本文\n## 想定する影響\n影響の本文\n## 対象外 / 変更してはならないこと\n保持条件\n",
    },
    { mode: "canonical" },
  ).result;
  assert.equal(named.intent[0]?.body.text.trim(), "意図の本文");
  assert.equal(named.intent[0]?.heading.location.line, 1);
  assert.equal(named.impacts[0]?.body.text.trim(), "影響の本文");
  assert.equal(named.exclusions[0]?.body.text.trim(), "保持条件");
  for (const [content, changeId, heading] of [
    ["# Change Trace: Sample\nChange ID: `CHG-000082`", "CHG-000082", true],
    ["# 調査\n変更ID: CHG-000082", "CHG-000082", false],
    [`${"\n".repeat(40)}Change ID: CHG-000082`, null, false],
  ] as const) {
    const parsed = parseChangeDocument(
      { path: "change.md", content },
      { mode: "canonical" },
    );
    assert.equal(parsed.result.changeId, changeId);
    assert.equal(parsed.result.hasStandardHeading, heading);
    assert.equal(parsed.status, "partial");
    assert.equal(parsed.result.source.content, content);
  }
  const impact =
    "### 影響ファイル\r\n\r\n<details>\r\n<summary>全ファイルを表示</summary>\r\n\r\n- [source](./source.md)\r\n\r\n</details>";
  const source = {
    path: "change.md",
    content: `Change ID: CHG-000080\r\n${impact}`,
  };
  const before = structuredClone(source);
  const parsed = parseChangeDocument(source, {
    mode: "canonical",
    expectedIdentity: "CHG-000079",
  });
  assert.equal(parsed.status, "complete");
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.result.changeId, "CHG-000080");
  assert.equal(parsed.result.expectedIdentity, "CHG-000079");
  assert.deepEqual(parsed.result.impactLines, [
    {
      text: "- [source](./source.md)",
      location: { path: "change.md", line: 7 },
    },
  ]);
  assert.deepEqual(source, before);
  source.content = "changed";
  assert.deepEqual(parsed.result.source, before);
  assert.equal(
    parseChangeDocument(before, {
      mode: "canonical",
      expectedIdentity: "CHG-unknown",
    }).issues.length,
    0,
  );
  assert.equal(
    parseChangeDocument(before, {
      mode: "canonical",
      expectedIdentity: "CHG-000080",
    }).issues[0]?.targetIdentity,
    "CHG-000080",
  );
  assert.throws(
    () => parseChangeDocument(before, { mode: "unknown" } as never),
    /unknown_change_document_mode/u,
  );
});

/**
 * 案内の複数区画と重複診断の出所を確認する。
 * @responsibility 先頭採用・全出現・局所と横断の診断数を保持する。
 * @trace RCM-UT-002
 * @precondition 異なる二つの区画と重複リンクを用意する。
 * @stimulus Parse後に実在一覧との関係評価を呼ぶ。
 * @observation 節・出典・局所Issueと横断Issueを分けて取得する。
 * @oracle 二番目の区画を比較へ混ぜず、重複と欠落の併存も一件だけ返す。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期モデル比較。
 */
test("Change案内は全区画を保持し局所重複を横断診断で二重化しない", () => {
  const start = "<!-- crdd-change-aggregate-index:start -->",
    end = "<!-- crdd-change-aggregate-index:end -->";
  const link = "[one](./Changes/CHG-000065/change.md)";
  const parsed = parseChangeIndex({
    path: "02_Changes.md",
    content: `${start}\n${link}\n${link}\n${end}\n${start}[two](./Changes/CHG-000066/change.md)${end}`,
  });
  assert.equal(parsed.status, "partial");
  assert.equal(parsed.result.sections.length, 2);
  assert.deepEqual(
    parsed.result.entries.map((entry) => entry.identity),
    ["CHG-000065", "CHG-000065"],
  );
  assert.deepEqual(
    parsed.result.entries.map((entry) => entry.source.location.line),
    [2, 3],
  );
  assert.equal(parsed.issues.length, 1);
  assert.deepEqual(
    inspectChangeNavigation({
      index: parsed.result,
      observedChangeIds: ["CHG-000099"],
    }),
    [],
  );
});
