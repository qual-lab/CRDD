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
  createPhaseChecklistItems,
  inspectDiscoveryDefinition,
  inspectDiscoveryAnalysis,
  parseAdoptedDiscoveryRequirements,
} from "../../../src/index.ts";

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
    ...createPhaseChecklistItems().discoveryRequirementChecklistItemTexts.map(
      (item) => `- [x] ${item}`,
    ),
  ].join("\n");
}

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
      inspectDiscoveryDefinition(
        { path: "requirement.md", content: body },
        "REQ-000001",
      ),
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
    ...createPhaseChecklistItems().discoveryExplorationChecklistItemTexts.map(
      (item) => `- [x] ${item}`,
    ),
  ].join("\n");
  const structure = "成果物種別: Discovery分析\n探索ID: `EXP-000001`";
  for (const prefix of [
    structure,
    `<!--\n${structure}\n-->`,
    `\u0060\u0060\u0060text\n${structure}\n\u0060\u0060\u0060`,
  ])
    assert.deepEqual(
      inspectDiscoveryAnalysis(
        { path: "exploration.md", content: `${prefix}\n${checklist}` },
        "EXP-000001",
      ),
      [],
    );
  assert.deepEqual(
    inspectDiscoveryAnalysis(
      { path: "exploration.md", content: checklist },
      "EXP-000001",
    ).map((issue) => issue.kind),
    ["artifact.discovery.analysis-contract-invalid"],
  );
  assert.deepEqual(
    inspectDiscoveryAnalysis(
      { path: "exploration.md", content: structure },
      "EXP-000001",
    ).map((issue) => issue.kind),
    ["artifact.discovery.analysis-checklist-invalid"],
  );
  const issues = inspectDiscoveryAnalysis(
    { path: "exploration.md", content: "" },
    "EXP-000001",
  );
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
    [...parseAdoptedDiscoveryRequirements(content)],
    ["REQ-000002", "REQ-000001", "REQ-000003"],
  );
  assert.deepEqual(
    [...parseAdoptedDiscoveryRequirements("no adopted rows")],
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
  const issues = inspectDiscoveryDefinition(
    { path: "requirement.md", content: "" },
    "REQ-000001",
  );
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
      inspectDiscoveryDefinition(
        { path: "requirement.md", content: body },
        "REQ-000001",
      ).map((issue) => issue.kind),
      ["artifact.discovery.definition-contract-invalid"],
    );
  }
  const hidden = content.replace("## Checklist", "<!--\n## Checklist");
  assert.deepEqual(
    inspectDiscoveryDefinition(
      { path: "requirement.md", content: `${hidden}\n-->` },
      "REQ-000001",
    ).map((issue) => issue.kind),
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
    inspectDiscoveryDefinition(
      {
        path: "requirement.md",
        content: content.replace(valid, `${valid}\n${invalid}`),
      },
      "REQ-000001",
    ),
    [],
  );
  for (const body of [
    content.replace(valid, `${invalid}\n${valid}`),
    content.replace(valid, "missing"),
  ])
    assert.deepEqual(
      inspectDiscoveryDefinition(
        { path: "requirement.md", content: body },
        "REQ-000001",
      ).map((issue) => issue.kind),
      ["artifact.discovery.definition-contract-invalid"],
    );
});
