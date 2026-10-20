/**
 * UX入口・投影・Journeyの解析を検証する。
 * @packageDocumentation
 * @responsibility 生本文と可視本文の違い、集合化とSection境界を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope artifact、ux
 * @boundary RCM-UT-002=N/A: 合成本文の同期解析。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  parseUxIndex,
  isUxProjectionIncomplete,
  parseUxJourneyRelations,
  inspectUxDefinition,
  inspectUxAnalysis,
  inspectUxFormalInput,
  inspectUxRelations,
  type UxFormalInputObservation,
  createPhaseChecklistItems,
} from "../../../src/index.ts";

/**
 * 生入口のIDとREQ関係を集合化する。
 * @responsibility コメントの非除去と同じ関係のSet化を確認する。
 * @trace RCM-UT-002
 * @precondition 重複するUX行をコメント内に置く。
 * @stimulus UX入口を解析する。
 * @observation ID集合と要求関係集合を取得する。
 * @oracle 生本文のIDを保持し、同じ関係は一件となる。
 * @cleanup N/A: 局所文字列だけを使う。
 * @boundary RCM-UT-002=N/A: 同期解析。
 */
test("UX入口は生本文の二集合を維持する", () => {
  const row =
    "| [UX-000001](Definitions/UX-000001/ux_definition.md) | REQ-000001 REQ-000002 |";
  const model = parseUxIndex(`<!--\n${row}\n${row}\n-->`);
  assert.deepEqual([...model.ids], ["UX-000001"]);
  assert.deepEqual(
    [...model.requirementRelations],
    ["REQ-000001|UX-000001", "REQ-000002|UX-000001"],
  );
});

/**
 * 正式入力の六観測事実と本文条件を個別に確認する。
 * @responsibility Header・期待リンク・生本文禁止と各観測拒否を維持する。
 * @trace RCM-UT-002
 * @precondition 正常Headerと六つの正常観測事実を用意する。
 * @stimulus 各事実または本文条件を一つずつ壊して検査する。
 * @observation 正式入力Issue列を取得する。
 * @oracle 正常だけを受理し、各単独不正と併存不正を同じ一Issueへする。
 * @cleanup N/A: 局所値だけを使う。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("UX正式入力は六観測事実と本文条件を維持する", () => {
  const content =
    "分析対象: [REQ-000001 要求](../../../01_Discovery/Definitions/REQ-000001/requirement.md)";
  const observation: UxFormalInputObservation = {
    definitionHasContent: true,
    matchingDefinitionOnly: true,
    hasSourceAnalysis: false,
    hasInvalidDiscoveryTarget: false,
    hasInvalidEntity: false,
    hasUnsafeTarget: false,
  };
  assert.deepEqual(
    inspectUxFormalInput(
      { path: "analysis.md", content },
      "REQ-000001",
      observation,
    ),
    [],
  );
  for (const key of Object.keys(
    observation,
  ) as (keyof UxFormalInputObservation)[]) {
    const issues = inspectUxFormalInput(
      { path: "analysis.md", content },
      "REQ-000001",
      { ...observation, [key]: !observation[key] },
    );
    assert.deepEqual(
      issues.map((issue) => issue.kind),
      ["artifact.ux.requirement-formal-input-invalid"],
    );
  }
  for (const body of [
    "",
    `${content}\n${content}`,
    content.replace("REQ-000001", "REQ-000002"),
    `<!--\n${content}\n-->`,
    `\u0060\u0060\u0060text\n${content}\n\u0060\u0060\u0060`,
    `${content}\n判断根拠: forbidden`,
    `${content}\n\u0060\u0060\u0060text\n探索元: forbidden\n\u0060\u0060\u0060`,
  ])
    assert.deepEqual(
      inspectUxFormalInput(
        { path: "analysis.md", content: body },
        "REQ-000001",
        observation,
      ).map((issue) => issue.kind),
      ["artifact.ux.requirement-formal-input-invalid"],
    );
});

/**
 * UXとJourneyで異なる非空条件を維持する。
 * @responsibility UXはID、Journeyは関係集合に対する非空判定と診断順を確認する。
 * @trace RCM-UT-002
 * @precondition 同一関係と空関係の入力を用意する。
 * @stimulus 関係閉包を検査する。
 * @observation Issue分類と位置を取得する。
 * @oracle 正常を受理し、二違反はUX→Journeyの順で元Pathへ返す。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期集合検査。
 */
test("UX閉包は用途ごとの非空条件とIssue順を維持する", () => {
  const request = {
    uxIndexPath: "ux.md",
    experienceMapPath: "journey.md",
    index: {
      ids: new Set(["UX-000001"]),
      requirementRelations: new Set<string>(),
    },
    analysisRequirementRelations: new Set<string>(),
    canonicalJourneyRelations: new Set(["REQ-000001|Start"]),
    analysisJourneyRelations: new Set(["REQ-000001|Start"]),
  };
  assert.deepEqual(inspectUxRelations(request), []);
  const issues = inspectUxRelations({
    ...request,
    index: { ...request.index, ids: new Set<string>() },
    canonicalJourneyRelations: new Set<string>(),
    analysisJourneyRelations: new Set<string>(),
  });
  assert.deepEqual(
    issues.map((issue) => [issue.kind, issue.location.path]),
    [
      ["artifact.ux.outcome-relation-closure-mismatch", "ux.md"],
      ["artifact.ux.journey-relation-closure-mismatch", "journey.md"],
    ],
  );
  for (const relations of [
    new Set(["REQ-000001|UX-000001"]),
    new Set(["REQ-000002|UX-000001"]),
  ]) {
    assert.equal(
      inspectUxRelations({
        ...request,
        index: { ...request.index, requirementRelations: relations },
      })[0]?.kind,
      "artifact.ux.outcome-relation-closure-mismatch",
    );
    assert.equal(
      inspectUxRelations({
        ...request,
        analysisRequirementRelations: relations,
      })[0]?.kind,
      "artifact.ux.outcome-relation-closure-mismatch",
    );
  }
  assert.equal(
    inspectUxRelations({
      ...request,
      analysisJourneyRelations: new Set(["REQ-000002|Start"]),
    })[0]?.kind,
    "artifact.ux.journey-relation-closure-mismatch",
  );
});

/**
 * New関係を持つ正常なUX分析本文を合成する。
 * @responsibility 六段階の本文・責任表・引渡しと末尾Checklistを用意する。
 * @trace RCM-UT-002
 * @input N/A: 固定合成値を使う。
 * @stimulus 固定行列を結合して正常なUX分析本文を生成する。
 * @observation 呼出し元の検査試験が生成本文をDomainへ渡す。
 * @oracle 六段階・New関係・末尾Checklistを満たす本文となる。
 * @cleanup N/A: 局所文字列だけを生成する。
 * @returns 現行条件を満たす合成分析本文。
 * @precondition N/A: 外部入力を使わない。
 * @postcondition 本番文書やFilesystemを参照しない。
 * @effect N/A: 局所文字列を構築する。
 * @failure 通常の文字列構築例外を伝播する。
 * @invariant Checklistは末尾に置く。
 * @boundary RCM-UT-002=N/A: 合成値だけを使う同期処理。
 * @security 実Repository・認証情報を使わない。
 * @concurrency N/A: 共有状態を持たない。
 */
function analysisFixture(): string {
  return [
    "成果物種別: UX分析",
    "分析対象: [REQ-000001 要求](./requirement.md)",
    "## 1. 要求の一次分析",
    "| 解決する問題 | value |",
    "| 利用者に必要なこと | value |",
    "## 2. 利用者・目標・成果",
    "| 主な想定利用者 | value |",
    "| 目的 | value |",
    "| 得られる結果 | value |",
    "## 3. 利用者に起きる変化",
    "```text",
    "変更前",
    "before",
    "変更後",
    "after",
    "```",
    "## 4. 利用者成果への統合",
    "└─ New → UX-000001",
    "| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |",
    "| 成果 | `New → UX-000001` | reason | addition |",
    "## 5. 重要な体験",
    "### この要求での利用の流れ",
    "### サービス提供の流れの処置",
    "処置: `非該当`",
    "再評価: condition",
    "### 製品全体の整理への接続",
    "- 利用の流れの統合先: [Start](03_Experience_Map.md#start)",
    "- サービス提供の流れの統合先: none",
    "### この要求での責任境界",
    "| 担い手 | この要求で担うこと | 越えてはならない境界 |",
    "| --- | --- | --- |",
    "| user | work | limit |",
    "### 補足する品質",
    "### 妥当性確認と未確認事項",
    "現在判定:",
    "確認事項:",
    "判断者:",
    "未確認時の影響:",
    "Discoveryへ戻す条件",
    "## 6. 下流への引き渡し",
    "| IA（直後工程への正式な引き渡し） | input |",
    "| Quality Analysis / UX（伴走） | input |",
    "| UI（後続Contract Relation） | input |",
    "| SPEC（後続Contract Relation） | input |",
    "## Checklist",
    ...createPhaseChecklistItems().uxAnalysisChecklistItemTexts.map(
      (item) => `- [x] ${item}`,
    ),
  ].join("\n");
}

/**
 * 分析の正常処置と入口リンク数を確認する。
 * @responsibility New／Same／Not Applicable、Blueprint二処置と台帳0／1／2件を確認する。
 * @trace RCM-UT-002
 * @precondition 正常な合成分析本文を用意する。
 * @stimulus 処置と台帳リンク数を変えて検査する。
 * @observation 関係集合とIssue列を取得する。
 * @oracle 各正常処置を受理しリンク数不一致だけを構造Issueとする。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同期的な本文検査。
 */
test("UX分析は処置と台帳リンクの受理条件を維持する", () => {
  const content = analysisFixture();
  const model = inspectUxAnalysis(
    { path: "analysis.md", content },
    "REQ-000001",
    1,
  );
  assert.deepEqual(model.issues, []);
  assert.deepEqual([...model.requirementRelations], ["REQ-000001|UX-000001"]);
  assert.deepEqual([...model.journeyRelations], ["REQ-000001|Start"]);
  for (const count of [0, 2])
    assert.deepEqual(
      inspectUxAnalysis(
        { path: "analysis.md", content },
        "REQ-000001",
        count,
      ).issues.map((issue) => issue.kind),
      ["artifact.ux.analysis-contract-invalid"],
    );
  const notApplicable = content
    .replace("└─ New → UX-000001\n", "")
    .replace("`New → UX-000001`", "`Not Applicable`");
  assert.deepEqual(
    inspectUxAnalysis(
      { path: "analysis.md", content: notApplicable },
      "REQ-000001",
      1,
    ).issues,
    [],
  );
  const comparison = [
    "#### 比較",
    "",
    "比較対象: `UX-000001`",
    "統合理由: same",
    ...["担い手", "利用のきっかけ", "得られる結果", "避ける失敗"].map(
      (axis) => `| ${axis} | a | b | c |`,
    ),
  ].join("\n");
  const same = content
    .replaceAll("New →", "Same →")
    .replace("## 5. 重要な体験", `${comparison}\n## 5. 重要な体験`);
  assert.deepEqual(
    inspectUxAnalysis({ path: "analysis.md", content: same }, "REQ-000001", 1)
      .issues,
    [],
  );
  const blueprint = [
    "処置: `作成`",
    "```text",
    "【利用者・責任者】 【利用者接点】 【提供側】 【回復・判断する人】 可視境界 時間差: 完了時: 失敗時: 次の行動:",
    "```",
  ].join("\n");
  assert.deepEqual(
    inspectUxAnalysis(
      {
        path: "analysis.md",
        content: content.replace(
          "処置: `非該当`\n再評価: condition",
          blueprint,
        ),
      },
      "REQ-000001",
      1,
    ).issues,
    [],
  );
});

/**
 * 六違反の併存と不正本文由来の関係保持を確認する。
 * @responsibility 診断順を保持し、Journeyの最初の行だけを使う。
 * @trace RCM-UT-002
 * @precondition 構造不足だが関係行を持つ本文を用意する。
 * @stimulus 分析を検査する。
 * @observation 六Issueと二関係集合を取得する。
 * @oracle 全違反を順に返し、不正な関係行も抽出結果から消さない。
 * @cleanup N/A: 局所値だけを使う。
 * @boundary RCM-UT-002=N/A: 同期解析。
 */
test("UX分析は六違反の順序と不正本文の関係を保持する", () => {
  const content =
    "| item | `New → UX-000001` |\n- 利用の流れの統合先: [First](03_Experience_Map.md#first)\n- 利用の流れの統合先: [Second](03_Experience_Map.md#second)";
  const model = inspectUxAnalysis(
    { path: "analysis.md", content },
    "REQ-000001",
    0,
  );
  assert.deepEqual(
    model.issues.map((issue) => issue.kind),
    [
      "artifact.ux.analysis-contract-invalid",
      "artifact.ux.analysis-handoff-invalid",
      "artifact.ux.analysis-checklist-invalid",
      "artifact.ux.analysis-relation-invalid",
      "artifact.ux.analysis-responsibility-header-invalid",
      "artifact.ux.analysis-blueprint-disposition-invalid",
    ],
  );
  assert.equal(
    model.issues[2]?.details.checklistFailure,
    "missing_or_duplicate",
  );
  assert.deepEqual([...model.requirementRelations], ["REQ-000001|UX-000001"]);
  assert.deepEqual([...model.journeyRelations], ["REQ-000001|First"]);
});

/**
 * 表・図の重複とSame比較・責任表・Blueprintの不足を確認する。
 * @responsibility 関係をSetだけで比較せず現行の列・Section条件を維持する。
 * @trace RCM-UT-002
 * @precondition 正常本文の各条件を一つずつ壊す。
 * @stimulus 各本文を検査する。
 * @observation Issue分類を取得する。
 * @oracle 対応する関係・責任表・Blueprint違反を検出する。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期的な本文検査。
 */
test("UX分析は重複と比較・責任・Blueprint不足を拒否する", () => {
  const content = analysisFixture();
  const row = "| 成果 | `New → UX-000001` | reason | addition |";
  const variants = [
    [content.replace(row, `${row}\n${row}`), "analysis-relation-invalid"],
    [content.replaceAll("New →", "Same →"), "analysis-relation-invalid"],
    [
      content.replace(
        "### この要求での責任境界",
        "### この要求での責任境界\n### この要求での責任境界",
      ),
      "analysis-responsibility-header-invalid",
    ],
    [
      content.replace("再評価: condition", "reason only"),
      "analysis-blueprint-disposition-invalid",
    ],
    [
      content.replace("処置: `非該当`", "処置: `作成`"),
      "analysis-blueprint-disposition-invalid",
    ],
  ];
  for (const [body, suffix] of variants)
    assert.ok(
      inspectUxAnalysis(
        { path: "analysis.md", content: body as string },
        "REQ-000001",
        1,
      ).issues.some((issue) => issue.kind === `artifact.ux.${suffix}`),
    );
});

/**
 * UX定義の正常な生本文を合成する。
 * @responsibility 必須構造・引渡し表・評価済みChecklistを試験内で組み立てる。
 * @trace RCM-UT-002
 * @input N/A: 固定された合成値を使う。
 * @stimulus 必須Section・引渡し表・Checklistを結合する。
 * @observation 呼出し元の検査試験が合成本文を取得する。
 * @oracle UX定義の正常条件を満たす固定本文を返す。
 * @cleanup N/A: 局所文字列だけを生成する。
 * @returns 正常条件を満たす合成本文。
 * @precondition N/A: 外部入力を使わない。
 * @postcondition 本番データを読まず本文を返す。
 * @effect N/A: 文字列だけを構築する。
 * @failure 通常の文字列構築例外を伝播する。
 * @invariant Checklistは最後のSectionに置く。
 * @boundary RCM-UT-002=N/A: 同期的な合成値。
 * @security 認証情報・実Repositoryを使わない。
 * @concurrency N/A: 共有状態を変更しない。
 */
function definitionFixture(): string {
  const sections = [
    "UX ID: `UX-000001`",
    "成果物種別: UX定義",
    "状態: Canonical",
    "## 利用者成果",
    "## 利用者に起きる変化",
    "## 成立条件",
    "## 重要な体験・失敗・品質期待",
    "### 重要な失敗",
    "### 体験品質への期待",
    "## 責任境界・制約・対象外",
    "## 未確認事項と戻り条件",
    "現在判定:",
    "確認事項:",
    "判断者:",
    "未確認時の影響:",
    "## 検証意図",
    "## 関係",
    "## 下流への引き渡し",
    "| IA（直後工程への正式な引き渡し） | input |",
    "| Quality Analysis / UX（伴走） | input |",
    "| UI（後続Contract Relation） | input |",
    "| SPEC（後続Contract Relation） | input |",
    "## Checklist",
    ...createPhaseChecklistItems().uxDefinitionChecklistItemTexts.map(
      (item) => `- [x] ${item}`,
    ),
  ];
  return sections.join("\n");
}

/**
 * UX定義の状態と生本文の受理条件を確認する。
 * @responsibility CanonicalとSuperseded、状態重複、期待IDと不可視構造の違いを確認する。
 * @trace RCM-UT-002
 * @precondition 正常な合成本文を用意する。
 * @stimulus 状態・ID・本文の可視性を変えて検査する。
 * @observation 順序付きIssue列を取得する。
 * @oracle 状態二値を受理し、重複・ID不一致を拒否する。構造記載は生本文で評価する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("UX定義は既存の状態・ID・生本文条件を維持する", () => {
  const content = definitionFixture();
  /**
   * 合成したUX定義を指定IDで検査する。
   * @responsibility 同じPathで本文と期待IDの差を検査する。
   * @trace RCM-UT-002
   * @precondition 合成本文と期待IDを与える。
   * @stimulus inspectUxDefinitionへ入力を渡す。
   * @observation 順序付きIssue列を返す。
   * @oracle 本番検査の結果を変更せず返す。
   * @cleanup N/A: 局所値だけを使う。
   * @boundary RCM-UT-002=N/A: 同期本文検査。
   */
  const inspect = (body: string, id = "UX-000001") =>
    inspectUxDefinition({ path: "ux.md", content: body }, id);
  assert.deepEqual(inspect(content), []);
  assert.deepEqual(inspect(content.replace("Canonical", "Superseded")), []);
  assert.deepEqual(
    inspect(`${content}\n状態: Canonical`).map((issue) => issue.kind),
    [
      "artifact.ux.definition-contract-invalid",
      "artifact.ux.definition-checklist-invalid",
    ],
  );
  assert.deepEqual(
    inspect(content, "UX-000002").map((issue) => issue.kind),
    ["artifact.ux.definition-contract-invalid"],
  );
  assert.deepEqual(
    inspect(content.replace("## 利用者成果", "<!-- ## 利用者成果 -->")),
    [],
  );
  assert.deepEqual(
    inspect(content.replace("## 利用者成果", "```text\n## 利用者成果\n```")),
    [],
  );
});

/**
 * 本文不正でも引渡しとChecklistの違反を順に保持する。
 * @responsibility 三違反の併存とChecklist理由の非補完を確認する。
 * @trace RCM-UT-002
 * @precondition 空本文と不可視Checklistを用意する。
 * @stimulus 定義検査を実行する。
 * @observation Issue順と理由を取得する。
 * @oracle 本文→引渡し→Checklistの順で三件を返し、非可視Checklistを欠落とする。
 * @cleanup N/A: 局所値だけを使う。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("UX定義は三違反の順序とChecklist理由を保持する", () => {
  const issues = inspectUxDefinition(
    { path: "ux.md", content: "" },
    "UX-000001",
  );
  assert.deepEqual(
    issues.map((issue) => issue.kind),
    [
      "artifact.ux.definition-contract-invalid",
      "artifact.ux.definition-handoff-invalid",
      "artifact.ux.definition-checklist-invalid",
    ],
  );
  assert.equal(issues[2]?.details.checklistFailure, "missing_or_duplicate");
  const content = `${definitionFixture().replace("## Checklist", "<!--\n## Checklist")}\n-->`;
  assert.deepEqual(
    inspectUxDefinition({ path: "ux.md", content }, "UX-000001").map(
      (issue) => issue.kind,
    ),
    ["artifact.ux.definition-checklist-invalid"],
  );
});

/**
 * 投影だけを可視本文化し、重複とSection境界を検査する。
 * @responsibility 非可視リンクを数えず、次の第二階層見出しで停止する。
 * @trace RCM-UT-002
 * @precondition 可視・非可視・重複リンクを含む本文を使う。
 * @stimulus 指定Sectionの投影不足を検査する。
 * @observation Boolean結果を取得する。
 * @oracle 一回の可視リンクだけを受理し、欠落・重複を拒否する。
 * @cleanup N/A: 局所文字列だけを使う。
 * @boundary RCM-UT-002=N/A: 同期検査。
 */
test("UX投影は可視SectionのIDを一回ずつ要求する", () => {
  const heading = "## 3. UX成果との対応",
    row = "| [UX-000001](./target.md) |";
  const ids = new Set(["UX-000001"]);
  assert.equal(
    isUxProjectionIncomplete(
      `${heading}\n${row}\n## Other\n${row}`,
      heading,
      ids,
    ),
    false,
  );
  assert.equal(
    isUxProjectionIncomplete(`${heading}\n${row}\n${row}`, heading, ids),
    true,
  );
  assert.equal(
    isUxProjectionIncomplete(`${heading}\n<!--\n${row}\n-->`, heading, ids),
    true,
  );
  assert.equal(isUxProjectionIncomplete(row, heading, ids), true);
});

/**
 * Journeyの単純列位置とSet化を維持する。
 * @responsibility Header／区切り／短行を除き、生本文の関係を取得する。
 * @trace RCM-UT-002
 * @precondition 同じJourney行をFence内に二回置く。
 * @stimulus Journey関係を解析する。
 * @observation 関係集合を取得する。
 * @oracle REQとJourneyの二関係を取得し、重複行は一回へ畳む。
 * @cleanup N/A: 局所文字列だけを使う。
 * @boundary RCM-UT-002=N/A: 同期解析。
 */
test("UX Journeyは生本文の列位置と集合化を維持する", () => {
  const row = "| Start | a | b | c | REQ-000001 REQ-000002 | d |";
  const pairs = parseUxJourneyRelations(
    `| Journey | a | b | c | REQ-999999 | d |\n| --- | a | b | c | REQ-999999 | d |\nshort\n\u0060\u0060\u0060text\n${row}\n${row}\n\u0060\u0060\u0060`,
  );
  assert.deepEqual([...pairs], ["REQ-000001|Start", "REQ-000002|Start"]);
});
