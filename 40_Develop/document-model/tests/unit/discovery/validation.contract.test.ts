/**
 * Discovery要求定義の本文条件を検証する。
 * @packageDocumentation
 * @responsibility 生本文・最初の探索参照・旧見出し・Checklistと診断順を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope artifact、discovery
 * @boundary RCM-UT-002=N/A: 合成本文の同期検査。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "../../../src/artifact/checklist.ts";
import type { ArtifactSource } from "../../../src/artifact/types.ts";
import { inspectDiscoveryChecklist } from "../../../src/discovery/validation.ts";
import {
  parseDiscoveryAnalysis,
  parseDiscoveryDefinition,
  parseDiscoveryIndex,
} from "../../../src/index.ts";

/**
 * 三文書の完成Parseが通常・ひな型の局所診断と内容を分離する。
 * @responsibility ひな型へ通常条件を追加せず、欠測でも原文と採用集合を保持する。
 * @trace RCM-UT-002
 * @precondition 合成本文と旧Checklist期待列を使う。
 * @stimulus 三つの公開入口を両方式で呼ぶ。
 * @observation 状態・診断順・原文・raw節と入力独立を確認する。
 * @oracle 通常文書は構造後Checklist、ひな型はChecklistだけである。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期Parse。
 */
test("Discovery完成Parseはひな型の範囲と通常文書の診断順を区別する", () => {
  for (const mode of ["unknown", null]) {
    const options = { mode } as never;
    const source = { path: "fixture.md", content: "" };
    assert.throws(
      () => parseDiscoveryIndex(source, options),
      /unknown_discovery_checklist_mode/u,
    );
    assert.throws(
      () => parseDiscoveryAnalysis(source, "EXP-000001", options),
      /unknown_discovery_checklist_mode/u,
    );
    assert.throws(
      () => parseDiscoveryDefinition(source, "REQ-000001", options),
      /unknown_discovery_checklist_mode/u,
    );
  }
  for (const kind of ["index", "analysis", "definition"] as const) {
    const expected = parseFixture(
      { path: "fixture.md", content: "" },
      { kind, mode: "template" },
    ).checklistContract.expectedItems;
    const content = `## Checklist\n[x] [ ] OPEN FAIL N/A 理由\n${expected.map((item) => `- [ ] ${item}`).join("\n")}`;
    const source = { path: "fixture.md", content };
    const parsed =
      kind === "index"
        ? parseDiscoveryIndex(source, { mode: "template" })
        : kind === "analysis"
          ? parseDiscoveryAnalysis(source, "EXP-XXXXXX", { mode: "template" })
          : parseDiscoveryDefinition(source, "REQ-XXXXXX", {
              mode: "template",
            });
    assert.equal(parsed.status, "complete");
    assert.deepEqual(parsed.issues, []);
    assert.equal(parsed.result.source.content, content);
    source.content = "changed";
    assert.equal(parsed.result.source.content, content);
    const invalid =
      kind === "index"
        ? parseDiscoveryIndex(source, { mode: "template" })
        : kind === "analysis"
          ? parseDiscoveryAnalysis(source, "EXP-XXXXXX", { mode: "template" })
          : parseDiscoveryDefinition(source, "REQ-XXXXXX", {
              mode: "template",
            });
    assert.equal(invalid.status, "partial");
    assert.deepEqual(
      invalid.issues.map((issue) => issue.reason),
      ["template-checklist-invalid"],
    );
  }
  const content =
    "<!--\n## Checklist\n-->\n| `REQ-000001` | 要求採用 |\n| `REQ-000001` | 要求採用 |";
  const index = parseDiscoveryIndex({ path: "index.md", content });
  assert.equal(index.status, "partial");
  assert.deepEqual(
    index.issues.map((issue) => issue.reason),
    ["index-checklist-invalid"],
  );
  assert.deepEqual([...index.result.adoptedRequirementIds], ["REQ-000001"]);
  assert.equal(index.result.entries.length, 2);
  assert.equal(index.result.entries[0]?.source.location.line, 4);
  const definition = parseDiscoveryDefinition(
    { path: "definition.md", content },
    "REQ-000001",
  );
  assert.equal(definition.result.checklist.length, 1);
  assert.equal(definition.result.checklist[0]?.heading.location.line, 2);
  assert.deepEqual(
    definition.issues.map((issue) => issue.reason),
    ["definition-contract-invalid", "definition-checklist-invalid"],
  );
});

/**
 * 三つの完成Parseを同じ反証母集団へ接続する。
 * @responsibility 共通Checklist反証だけを共有し、状態は受付ごとに作る。
 * @trace RCM-UT-002
 * @precondition 合成原文と既知の文書種別・方式。
 * @stimulus 各公開Parserへ渡す。
 * @observation 各完成モデルを返す。
 * @oracle 本番の部分受付や共有可変状態を作らない。
 * @cleanup N/A: 同期値処理。
 * @boundary RCM-UT-002=N/A: 同一Process内のParse。
 */
function parseFixture(
  source: ArtifactSource,
  request: Readonly<{
    kind: "index" | "analysis" | "definition";
    mode: "template" | "evaluated";
  }>,
) {
  return request.kind === "index"
    ? parseDiscoveryIndex(source, { mode: request.mode }).result
    : request.kind === "analysis"
      ? parseDiscoveryAnalysis(source, "EXP-000001", { mode: request.mode })
          .result
      : parseDiscoveryDefinition(source, "REQ-000001", { mode: request.mode })
          .result;
}

/**
 * 有効なDiscovery要求定義の合成本文を作る。
 * @responsibility 必須節・最初の探索参照・評価済みChecklistを用意する。
 * @trace RCM-UT-002
 * @input N/A: 固定合成値を使う。
 * @stimulus 必須節・探索参照・Checklistを結合する。
 * @observation 呼出し元が生成本文を要求定義検査へ渡す。
 * @oracle 正常な要求定義として受理できる固定本文を返す。
 * @cleanup N/A: 局所文字列だけを生成する。
 * @returns 正常条件を満たす本文。
 * @precondition N/A: 外部入力なし。
 * @postcondition 本番文書・Filesystemを参照しない。
 * @effect N/A: 局所文字列だけを構築する。
 * @failure 通常の文字列構築例外を伝播する。
 * @invariant Checklistを末尾に置く。
 * @boundary RCM-UT-002=N/A: 同期的な合成値。
 * @security 実Repositoryや認証情報を使わない。
 * @concurrency N/A: 共有状態を持たない。
 */
function definitionFixture(): string {
  return [
    "要求ID: `REQ-000001`",
    "成果物種別: Discovery定義",
    "## 要求",
    "## 対象と利用状況",
    "## 解く問題と望ましい変化",
    "## 採用理由と比較",
    "## 成立条件",
    "## 制約",
    "## 検証意図",
    "## 工程引渡し",
    "## 関係",
    "- 元の探索記録: [EXP-000001](../../Analysis/EXP-000001/exploration.md)",
    "## Checklist",
    ...parseFixture(
      { path: "fixture.md", content: "## Checklist" },
      { kind: "definition", mode: "evaluated" },
    ).checklistContract.expectedItems.map((item) => `- [x] ${item}`),
  ].join("\n");
}

/**
 * Discovery文書の内容と三種類のChecklist受付を検証する。
 * @responsibility 種別・方式・出典・部分本文と旧構文の失敗理由を保持する。
 * @trace RCM-UT-002
 * @precondition 三種類・両方式と正常／異常の合成本文。
 * @stimulus 原文と明示した条件を文書受付へ渡す。
 * @observation 原文・表・Checklist節・期待列・失敗理由を取得する。
 * @oracle 旧構文検査と一致し、期待列と原文を別受付と共有しない。
 * @cleanup N/A: 同期的な局所値のみ。
 * @boundary 原文からDiscovery内容モデルとChecklist条件。
 */
test("Discovery三種類のChecklistは内容・出典と検査結果を保持する", () => {
  for (const kind of ["index", "analysis", "definition"] as const) {
    for (const mode of ["template", "evaluated"] as const) {
      const request = { kind, mode };
      const first = parseFixture(
        { path: "discovery.md", content: "" },
        request,
      );
      const expected = first.checklistContract.expectedItems;
      const inspect =
        mode === "template"
          ? inspectTemplateChecklist
          : inspectEvaluatedChecklist;
      const body = `前文\n| A | B |\n## Checklist\n${mode === "template" ? "[x] [ ] OPEN FAIL N/A 理由\n" : ""}${expected.map((item) => `- [${mode === "template" ? " " : "x"}] ${item}`).join("\n")}`;
      for (const content of [
        "",
        body,
        `<!--\n${body}\n-->`,
        `\x60\x60\x60\n${body}\n\x60\x60\x60`,
        `${body}\n本文`,
        body.replace(expected[0] ?? "", "別項目"),
      ]) {
        const parsed = parseFixture({ path: "discovery.md", content }, request);
        assert.equal(
          parsed.checklistContract.failure,
          inspect(content, expected),
        );
        assert.deepEqual(parsed.checklistContract.expectedItems, expected);
        assert.equal(parsed.source.content, content);
        assert.equal(parsed.checklistContract.kind, kind);
        assert.equal(parsed.checklistContract.mode, mode);
        assert.equal(Object.hasOwn(parsed, "issues"), false);
      }
      const source = { path: "discovery.md", content: body };
      const valid = parseFixture(source, request);
      source.content = "changed";
      assert.equal(valid.source.content, body);
      assert.equal(valid.tableRows[0]?.location.line, 2);
      assert.equal(valid.checklist[0]?.heading.location.line, 3);
      assert.equal(valid.checklistContract.failure, null);
      (first.checklistContract.expectedItems as string[]).push("only-first");
      assert.notDeepEqual(
        first.checklistContract.expectedItems,
        valid.checklistContract.expectedItems,
      );
      assert.equal(
        parseFixture(
          { path: "discovery.md", content: body },
          request,
        ).checklistContract.expectedItems.includes("only-first"),
        false,
      );
    }
  }
  assert.throws(
    () =>
      inspectDiscoveryChecklist("", {
        kind: "unknown",
        mode: "template",
      } as never),
    /unknown_discovery_checklist_kind/u,
  );
  assert.throws(
    () =>
      parseFixture({ path: "discovery.md", content: "" }, {
        kind: "index",
        mode: "unknown",
      } as never),
    /unknown_discovery_checklist_mode/u,
  );
});

/**
 * 現行で許可する見出しと生本文条件を確認する。
 * @responsibility 見出し代替・コメント／Fence・未検査の状態と参照実在を強化しない。
 * @trace RCM-UT-002
 * @precondition 正常な合成本文を使う。
 * @stimulus 見出しや不可視の必須記載を変えて検査する。
 * @observation Issue列を取得する。
 * @oracle 各既存表現を受理し、新しい状態・実在検査を追加しない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期的な本文検査。
 */
test("Discovery定義は既存の見出しと生本文の受理条件を維持する", () => {
  const content = definitionFixture();
  const source = {
    path: "requirement.md",
    content: `${content}\n## 要求\n別の出現`,
  };
  const model = parseDiscoveryDefinition(source, "REQ-000001");
  assert.equal(model.result.checklistContract.kind, "definition");
  assert.equal(model.result.checklistContract.mode, "evaluated");
  source.content = "changed";
  assert.notEqual(model.result.source.content, source.content);
  assert.equal(model.result.requirement.length, 2);
  assert.equal(model.result.expectedIdentity, "REQ-000001");
  assert.equal(model.result.originReferences[0]?.identity, "EXP-000001");
  assert.equal(model.result.originReferences[0]?.pathIdentity, "EXP-000001");
  assert.equal(Object.hasOwn(model.result, "issues"), false);
  for (const body of [
    content,
    content
      .replace("## 制約", "## 失敗・リスク・制約")
      .replace("## 工程引渡し", "## UXへの引き渡し"),
    content.replace("## 対象と利用状況", "<!-- ## 対象と利用状況 -->"),
    content.replace("## 対象と利用状況", "```text\n## 対象と利用状況\n```"),
    content.replace("## 要求", "状態: arbitrary\n## 要求"),
    content.replaceAll("EXP-000001", "EXP-999999"),
  ]) {
    assert.deepEqual(
      parseDiscoveryDefinition(
        { path: "requirement.md", content: body },
        "REQ-000001",
      ).issues,
      [],
    );
  }
});

/**
 * 探索分析の構造とChecklistの四組を確認する。
 * @responsibility 生本文の種別／ID判定と可視Checklistを区別し違反順を維持する。
 * @trace RCM-UT-002
 * @precondition 正常な合成分析と構造／Checklist不足本文を用意する。
 * @stimulus 分析本文を検査する。
 * @observation Issue分類・順序・理由を取得する。
 * @oracle 正常・各単独違反・二違反の四組を区別し、不可視構造を一律除去しない。
 * @cleanup N/A: 局所文字列だけを使う。
 * @boundary RCM-UT-002=N/A: 同期的な本文検査。
 */
test("Discovery分析は構造とChecklistを独立に検査する", () => {
  const checklist = [
    "## Checklist",
    ...parseFixture(
      { path: "fixture.md", content: "## Checklist" },
      { kind: "analysis", mode: "evaluated" },
    ).checklistContract.expectedItems.map((item) => `- [x] ${item}`),
  ].join("\n");
  const structure = "成果物種別: Discovery分析\n探索ID: `EXP-000001`";
  for (const prefix of [
    structure,
    `<!--\n${structure}\n-->`,
    `\u0060\u0060\u0060text\n${structure}\n\u0060\u0060\u0060`,
  ])
    assert.deepEqual(
      parseDiscoveryAnalysis(
        { path: "exploration.md", content: `${prefix}\n${checklist}` },
        "EXP-000001",
      ).issues,
      [],
    );
  assert.deepEqual(
    parseDiscoveryAnalysis(
      { path: "exploration.md", content: checklist },
      "EXP-000001",
    ).issues.map((issue) => issue.kind),
    ["artifact.discovery.analysis-contract-invalid"],
  );
  assert.deepEqual(
    parseDiscoveryAnalysis(
      { path: "exploration.md", content: structure },
      "EXP-000001",
    ).issues.map((issue) => issue.kind),
    ["artifact.discovery.analysis-checklist-invalid"],
  );
  const issues = parseDiscoveryAnalysis(
    { path: "exploration.md", content: "" },
    "EXP-000001",
  ).issues;
  const partial = parseDiscoveryAnalysis(
    { path: "exploration.md", content: "## きっかけ\n観測\n## きっかけ\n追加" },
    "EXP-000001",
  );
  assert.equal(partial.status, "partial");
  assert.equal(partial.result.trigger.length, 2);
  assert.equal(partial.result.trigger[0]?.heading.location.line, 1);
  assert.equal(Object.hasOwn(partial.result, "issues"), false);
  assert.deepEqual(
    issues.map((issue) => issue.kind),
    [
      "artifact.discovery.analysis-contract-invalid",
      "artifact.discovery.analysis-checklist-invalid",
    ],
  );
  assert.equal(issues[1]?.details.checklistFailure, "missing_or_duplicate");
});

/**
 * 入口の採用要求行だけからID集合を得る。
 * @responsibility 生本文・厳密な行頭と処置文字列・最初のID・重複の初出順を維持する。
 * @trace RCM-UT-002
 * @precondition 正常行と字下げ・空白違い・別処置・非表示行を用意する。
 * @stimulus 採用要求のIDを解析する。
 * @observation ID集合と空集合を取得する。
 * @oracle 非表示行も現行どおり認識し、不正行は追加せず初出順にSet化する。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期解析。
 */
test("Discovery採用要求解析は生本文の行条件と初出順を維持する", () => {
  const row = "| `REQ-000002` | REQ-000099 | 要求採用 |";
  const content = [
    row,
    row,
    "<!--",
    "| [REQ-000001](./requirement.md) | 要求採用 |",
    "-->",
    "```text",
    "| `REQ-000003` | 要求採用 |",
    "```",
    " | `REQ-000004` | 要求採用 |",
    "| `REQ-000005` |要求採用|",
    "| `REQ-000006` | 保留 |",
    "REQ-000007 | 要求採用 |",
  ].join("\n");
  assert.deepEqual(
    [
      ...parseDiscoveryIndex({ path: "discovery.md", content }).result
        .adoptedRequirementIds,
    ],
    ["REQ-000002", "REQ-000001", "REQ-000003"],
  );
  const model = parseDiscoveryIndex({ path: "discovery.md", content }).result;
  assert.equal(model.entries[0]?.identity, "REQ-000002");
  assert.equal(model.entries[0]?.source.location.line, 1);
  assert.equal(model.source.content, content);
  assert.deepEqual(
    [
      ...parseDiscoveryIndex({
        path: "discovery.md",
        content: "no adopted rows",
      }).result.adoptedRequirementIds,
    ],
    [],
  );
});

/**
 * 構造違反とChecklist違反の独立性・順序を確認する。
 * @responsibility 不足・Placeholder・ID不一致でも後続検査を継続する。
 * @trace RCM-UT-002
 * @precondition 空本文と不正化した合成本文を用意する。
 * @stimulus 定義を検査する。
 * @observation Issueの分類・順序・Checklist理由を取得する。
 * @oracle 空本文は構造→Checklistを返し、不正本文を定義不存在にしない。
 * @cleanup N/A: 局所値だけを使う。
 * @boundary RCM-UT-002=N/A: 同期的な本文検査。
 */
test("Discovery定義は構造とChecklistの違反を順に保持する", () => {
  const issues = parseDiscoveryDefinition(
    { path: "requirement.md", content: "" },
    "REQ-000001",
  ).issues;
  assert.deepEqual(
    issues.map((issue) => issue.kind),
    [
      "artifact.discovery.definition-contract-invalid",
      "artifact.discovery.definition-checklist-invalid",
    ],
  );
  assert.equal(issues[1]?.details.checklistFailure, "missing_or_duplicate");
  const content = definitionFixture();
  for (const body of [
    content.replace("## 対象と利用状況", "missing"),
    content.replace("REQ-000001", "REQ-000002"),
    content.replace("## 要求", "<!-- TODO -->\n## 要求"),
    content.replace("## 要求", "```text\nTBD\n```\n## 要求"),
  ]) {
    assert.deepEqual(
      parseDiscoveryDefinition(
        { path: "requirement.md", content: body },
        "REQ-000001",
      ).issues.map((issue) => issue.kind),
      ["artifact.discovery.definition-contract-invalid"],
    );
  }
  const hidden = content.replace("## Checklist", "<!--\n## Checklist");
  assert.deepEqual(
    parseDiscoveryDefinition(
      { path: "requirement.md", content: `${hidden}\n-->` },
      "REQ-000001",
    ).issues.map((issue) => issue.kind),
    ["artifact.discovery.definition-checklist-invalid"],
  );
});

/**
 * 探索参照の最初の一致だけを評価する。
 * @responsibility 二ID一致を確認し、重複参照の新しい拒否を追加しない。
 * @trace RCM-UT-002
 * @precondition ID一致と不一致の参照を用意する。
 * @stimulus 最初と二番目の参照を入れ替えて検査する。
 * @observation 構造Issueの有無を取得する。
 * @oracle 最初の正規一致に従い、後続参照で補完しない。
 * @cleanup N/A: 局所文字列だけを使う。
 * @boundary RCM-UT-002=N/A: 同期参照検査。
 */
test("Discovery定義は最初のEXP参照の二ID一致だけを検査する", () => {
  const content = definitionFixture();
  const valid =
    "元の探索記録: [EXP-000001](../../Analysis/EXP-000001/exploration.md)";
  const invalid =
    "元の探索記録: [EXP-000001](../../Analysis/EXP-000002/exploration.md)";
  assert.deepEqual(
    parseDiscoveryDefinition(
      {
        path: "requirement.md",
        content: content.replace(valid, `${valid}\n${invalid}`),
      },
      "REQ-000001",
    ).issues,
    [],
  );
  for (const body of [
    content.replace(valid, `${invalid}\n${valid}`),
    content.replace(valid, "missing"),
  ])
    assert.deepEqual(
      parseDiscoveryDefinition(
        { path: "requirement.md", content: body },
        "REQ-000001",
      ).issues.map((issue) => issue.kind),
      ["artifact.discovery.definition-contract-invalid"],
    );
});
