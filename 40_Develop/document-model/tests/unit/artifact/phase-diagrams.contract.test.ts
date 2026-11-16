/**
 * 工程ひな型の基本図処置契約を検証する。
 *
 * @packageDocumentation
 * @responsibility 七対象・不足項目の順序・既存の粗い解析境界と入力不変を固定する。
 * @trace RCM-UT-001
 * @level UT
 * @scope artifact、phase-diagrams
 * @boundary RCM-UT-001=N/A: 本文とPathの同期検査だけを扱う。
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  type ArtifactSource,
  parseArchitectureIndex,
  parseDiscoveryIndex,
  parseIaIndex,
  parseSpecIndex,
  parseUiIndex,
  parseUxIndex,
} from "../../../src/index.ts";
import { captureQualityDocument } from "../../../src/quality/readiness.ts";

const profiles = [
  [
    "template/01_Discovery/01_Product_Discovery.md",
    [
      "課題・根拠・機会の関係",
      "業務範囲／入出力（SIPOC）",
      "担い手別の仕事の流れ（Swimlane）",
      "価値が届くまでの流れ",
      "現状／変更後",
      "項目間全体像",
    ],
  ],
  [
    "template/02_UX/01_User_Experience.md",
    ["利用の流れ", "重要場面・失敗／回復体験図", "サービス提供の流れ"],
  ],
  [
    "template/03_IA/01_Information_Architecture.md",
    [
      "オブジェクト／関係図",
      "情報階層図",
      "Navigation図",
      "可視性／状態概念図",
    ],
  ],
  [
    "template/04_UI/01_User_Interface.md",
    [
      "論理画面／領域構成図",
      "画面／操作Flow",
      "表示状態／Variant図",
      "主要Component関係図",
      "UI／SPEC対応図",
    ],
  ],
  [
    "template/05_SPEC/01_Behavior_Specification.md",
    [
      "Use Case／振る舞いFlow",
      "状態遷移表／状態遷移図",
      "Actor／System間Sequence図",
      "Error／Effect分岐図",
      "UI／SPEC対応図",
    ],
  ],
  [
    "template/06_Architecture/01_Architecture.md",
    [
      "全体／内部ブロック図",
      "状態遷移表／状態遷移図",
      "ブロック間シーケンス図",
      "クラス／型関係図",
      "データフロー図（DFD）",
      "エンティティ関係図（ER図）",
      "スキーマ責務図（Schema Responsibility Map）",
    ],
  ],
  [
    "template/07_Quality/03_Verification_Design.md",
    [
      "検証義務・試験Level／Boundary対応図",
      "状態・分岐・Block別Coverage図",
      "検証結果・判断接続図",
    ],
  ],
] as const;

const diagramCaptures = new Map<
  string,
  (
    source: ArtifactSource,
  ) => ReturnType<typeof parseDiscoveryIndex>["result"]["diagramContract"]
>([
  [
    "template/01_Discovery/01_Product_Discovery.md",
    (source) =>
      parseDiscoveryIndex(source, { mode: "template" }).result.diagramContract,
  ],
  [
    "template/02_UX/01_User_Experience.md",
    (source) =>
      parseUxIndex(source, { mode: "template" }).result.diagramContract,
  ],
  [
    "template/03_IA/01_Information_Architecture.md",
    (source) =>
      parseIaIndex(source, { mode: "template" }).result.diagramContract,
  ],
  [
    "template/04_UI/01_User_Interface.md",
    (source) => parseUiIndex(source).result.diagramContract,
  ],
  [
    "template/05_SPEC/01_Behavior_Specification.md",
    (source) => parseSpecIndex(source).result.diagramContract,
  ],
  [
    "template/06_Architecture/01_Architecture.md",
    (source) => parseArchitectureIndex(source).result.diagramContract,
  ],
  [
    "template/07_Quality/03_Verification_Design.md",
    (source) =>
      captureQualityDocument(source, {
        kind: "verification_design",
        mode: "template",
      }).diagramContract,
  ],
]);

/**
 * 既存七対象の内容受付を試験用の同じ観測集合へ組み立てる。
 * @responsibility 対象外は選択せず、七OwnerのモデルとIssueを入力順に集める。
 * @trace RCM-UT-001
 * @precondition Pathと原文は試験が所有する。
 * @stimulus 対応する工程入口へ同じ原文を渡す。
 * @observation 基本図内容とIssueだけを取得する。
 * @oracle 各試験が旧図名・不足順・境界を固定比較する。
 * @cleanup N/A: 局所値のみ。
 * @boundary 工程Root内容受付と共通基本図構文。
 */
function captureDiagramFixture(sources: readonly ArtifactSource[]) {
  const contracts = sources.flatMap((source) => {
    const capture = diagramCaptures.get(source.path);
    if (!capture) return [];
    const contract = capture(source);
    assert.ok(contract);
    return [contract];
  });
  return {
    result: contracts.map((contract) => contract.result),
    issues: contracts.flatMap((contract) => contract.issues),
    status: contracts.some((contract) => contract.issues.length > 0)
      ? "partial"
      : "complete",
  };
}

/**
 * 外部観測なしの合成ひな型本文を構築する。
 *
 * @responsibility 期待図ごとの九列行と既存案内を用意する。
 * @trace RCM-UT-001
 * @precondition 固定期待図名を受ける。
 * @stimulus 純粋な文字列連結を行う。
 * @observation 返却本文を試験へ渡す。
 * @oracle 実検査で七Profileの適合本文として使える。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: Process内の文字列構築である。
 */
function createTemplate(diagrams: readonly string[]): string {
  return [
    "## 人間理解の確認",
    "| 発火判定と理由 |",
    "| 人間の確認または修正 |",
    "`作成` `既存参照` `非該当` `作成不能`",
    "## 5. 基本図の処置",
    "| 基本図 | 対象 | 目的 | 処置 | 現行図／一意な参照／理由 | 投影元改訂版 | 現在状態 | 未確認範囲 | 次の処置・再評価契機 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...diagrams.map(
      (diagram) =>
        `| ${diagram} | 対象 | 目的 | 作成 | 参照 | 版 | 状態 | 範囲 | 次 |`,
    ),
  ].join("\n");
}

/**
 * 七Profileと公開対象集合の不変条件を検証する。
 *
 * @responsibility 各Profileの適合本文、期待列の独立性、対象外Pathと空集合を確認する。
 * @trace RCM-UT-001
 * @precondition 旧七対象と図名を固定する。
 * @stimulus 合成本文を公開検査へ渡す。
 * @observation Issue列と公開Path列を取得する。
 * @oracle 七対象の適合と対象外非発火、返却期待列の独立が成立する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: 同期計算である。
 */
test("基本図処置は七Profileを持ち未知Pathへ適用しない", () => {
  assert.deepEqual(
    [...diagramCaptures.keys()],
    profiles.map(([path]) => path),
  );
  for (const [path, diagrams] of profiles) {
    const first = captureDiagramFixture([
      { path, content: createTemplate(diagrams) },
    ]).result[0];
    assert.ok(first);
    assert.deepEqual(first.expectedDiagrams, diagrams);
    (first.expectedDiagrams as unknown as string[]).push("only-first");
    assert.deepEqual(
      captureDiagramFixture([{ path, content: "" }]).result[0]
        ?.expectedDiagrams,
      diagrams,
    );
  }
  for (const [path, diagrams] of profiles)
    assert.deepEqual(
      captureDiagramFixture([{ path, content: createTemplate(diagrams) }])
        .issues,
      [],
    );
  assert.deepEqual(captureDiagramFixture([]).issues, []);
  assert.deepEqual(
    captureDiagramFixture([
      { path: "TEMPLATE/02_UX/01_User_Experience.md", content: "" },
    ]).issues,
    [],
  );
});

/**
 * 内容捕捉と対象外・後勝ち・部分情報の区別を検証する。
 * @responsibility 評価で選ばれない行も原文と位置付きで保持する。
 * @trace RCM-UT-001
 * @precondition 重複名・空名・停止後の行・未知Pathを含む本文。
 * @stimulus 内容受付を呼び、元入力と返却期待列を変更する。
 * @observation 原文・全行・後勝ちMap・不足と対象外を取得する。
 * @oracle 出現と選択が分かれ、他の呼出しと固定定義を変更しない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 原文から工程基本図の内容モデル。
 */
test("基本図モデルは原文・全行・後勝ちと対象外を区別する", () => {
  const [path, diagrams] = profiles[1];
  const duplicate = "| 利用の流れ | 対象 | 目的 | 保留 |";
  const empty = "|  | 空名 |";
  const content = `前文\n${createTemplate(diagrams)}\n${empty}\n${duplicate}\n停止\n| 停止後 |\n## 次節\n本文`;
  const source = { path, content };
  const parsed = captureDiagramFixture([
    source,
    { path: "unknown.md", content: "| 不明 | 内容 |" },
  ]);
  const model = parsed.result[0];
  assert.ok(model);
  source.content = "changed";
  assert.equal(model.source.content, content);
  assert.equal(model.expectedDiagrams?.length, 3);
  assert.equal(model.section?.location.line, 6);
  assert.equal(model.section?.text.endsWith("本文"), true);
  assert.equal(model.header?.location.line, 7);
  assert.equal(model.entries.length, 5);
  assert.equal(model.entries[0]?.source.location.line, 9);
  assert.equal(model.entries[3]?.name, "");
  assert.equal(model.effectiveRows.has(""), false);
  assert.equal(model.effectiveRows.has("停止後"), false);
  assert.equal(
    model.entries.filter((entry) => entry.name === "利用の流れ").length,
    2,
  );
  assert.equal(model.effectiveRows.get("利用の流れ")?.source.text, duplicate);
  assert.equal(model.effectiveRows.get("利用の流れ")?.source.location.line, 13);
  assert.deepEqual(model.missingItems, [
    "利用の流れ:columns",
    "利用の流れ:disposition=保留",
  ]);
  assert.equal(
    model.tableRows.some((row) => row.cells[0] === "停止後"),
    true,
  );
  assert.equal(parsed.status, "partial");
  assert.equal(parsed.issues.length, 1);
  assert.equal(Object.hasOwn(model, "issues"), false);
  assert.equal(parsed.result.length, 1);
  assert.equal(
    captureDiagramFixture([{ path: "unknown.md", content: "" }]).result.length,
    0,
  );
  (model.expectedDiagrams as string[]).push("only-this-result");
  const next = captureDiagramFixture([{ path, content }]);
  assert.deepEqual(next.result[0]?.expectedDiagrams, diagrams);
  const missing = captureDiagramFixture([{ path, content: "" }]);
  assert.equal(missing.result[0]?.section, null);
  assert.equal(missing.result[0]?.header, null);
  assert.equal(missing.status, "partial");
  assert.equal(missing.result[0]?.source.content, "");
});

/**
 * 不足項目と複数Sourceの順序・Identityを検証する。
 *
 * @responsibility 一不正Source一Issueと中立field・全不足項目の順を固定する。
 * @trace RCM-UT-001
 * @precondition 順序を入れ替えた既知Sourceと未知Sourceを用意する。
 * @stimulus 空本文を検査する。
 * @observation Issue全fieldと入力Snapshotを取得する。
 * @oracle 元Path・順序・固定不足語彙に一致し入力が不変である。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: 同期計算である。
 */
test("基本図処置Issueは不足順・Source順・元Pathを保持する", () => {
  const sources = [
    { path: profiles[1][0], content: "" },
    { path: "unknown.md", content: "" },
    { path: profiles[0][0], content: "" },
  ];
  const before = JSON.stringify(sources);
  const issues = captureDiagramFixture(sources).issues;
  assert.equal(issues.length, 2);
  assert.deepEqual(issues[0], {
    kind: "artifact.phase-diagram.contract-invalid",
    targetIdentity: profiles[1][0],
    location: { path: profiles[1][0] },
    reason: "contract_incomplete",
    details: {
      missingItems:
        "section, `作成`, `既存参照`, `非該当`, `作成不能`, header, 利用の流れ, 重要場面・失敗／回復体験図, サービス提供の流れ",
    },
  });
  assert.equal(issues[1]?.targetIdentity, profiles[0][0]);
  assert.ok(
    String(issues[1]?.details.missingItems).startsWith(
      "human-understanding-confirmation, section",
    ),
  );
  assert.equal(JSON.stringify(sources), before);
});

/**
 * 表行の旧受理条件を検証する。
 *
 * @responsibility 列数・未知処置・空処置・重複後勝ち・非Pipe行停止を確認する。
 * @trace RCM-UT-001
 * @precondition 適合するUX本文を固定する。
 * @stimulus 行を変異させる。
 * @observation 不足語彙または空Issueを取得する。
 * @oracle 既存の粗い解析の受理・拒否境界と一致する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: 同期計算である。
 */
test("基本図処置表は列・処置・後勝ちと行停止を維持する", () => {
  const [path, diagrams] = profiles[1];
  const content = createTemplate(diagrams);
  const row =
    "| 利用の流れ | 対象 | 目的 | 作成 | 参照 | 版 | 状態 | 範囲 | 次 |";
  const cases = [
    [
      content.replace(row, "| 利用の流れ | 対象 | 目的 | 保留 |"),
      "利用の流れ:columns, 利用の流れ:disposition=保留",
    ],
    [content.replace(row, row.replace("| 作成 |", "|  |")), null],
    [
      `${content}\n${row.replace("| 作成 |", "| 保留 |")}`,
      "利用の流れ:disposition=保留",
    ],
    [content.replace(row, `停止\n${row}`), diagrams.join(", ")],
    [`${content}\n## 補足\n本文`, null],
    [`<!--\n${content}\n-->`, null],
    [`\`\`\`md\n${content}\n\`\`\``, null],
  ] as const;
  for (const [text, expected] of cases) {
    const issues = captureDiagramFixture([{ path, content: text }]).issues;
    assert.equal(issues[0]?.details.missingItems ?? null, expected);
  }
});

/**
 * Discovery固有の人間理解欄を検証する。
 *
 * @responsibility 三条件の欠落と他Profileへの非適用を確認する。
 * @trace RCM-UT-001
 * @precondition 適合本文を使う。
 * @stimulus 各固定語句を一つずつ取り除く。
 * @observation 不足項目を取得する。
 * @oracle Discoveryだけに同じ固定理由が一つ生じる。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: 同期計算である。
 */
test("Discovery人間理解の三条件を基本図契約内で維持する", () => {
  for (const token of [
    "## 人間理解の確認",
    "| 発火判定と理由 |",
    "| 人間の確認または修正 |",
  ])
    for (const [index, [path, diagrams]] of profiles.entries()) {
      const issues = captureDiagramFixture([
        { path, content: createTemplate(diagrams).replace(token, "") },
      ]).issues;
      assert.deepEqual(
        issues.map((issue) => issue.details.missingItems),
        index === 0 ? ["human-understanding-confirmation"] : [],
      );
    }
});
