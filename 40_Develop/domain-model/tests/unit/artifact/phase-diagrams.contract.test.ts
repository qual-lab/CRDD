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
  inspectPhaseDiagramTemplates,
  phaseDiagramTemplatePaths,
} from "../../../src/index.ts";

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
 * @responsibility 各Profileの適合本文、凍結、対象外Pathと空集合を確認する。
 * @trace RCM-UT-001
 * @precondition 旧七対象と図名を固定する。
 * @stimulus 合成本文を公開検査へ渡す。
 * @observation Issue列と公開Path列を取得する。
 * @oracle 七対象の適合と対象外非発火、配列変更拒否が成立する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: 同期計算である。
 */
test("基本図処置は七Profileを持ち未知Pathへ適用しない", () => {
  assert.deepEqual(
    phaseDiagramTemplatePaths,
    profiles.map(([path]) => path),
  );
  assert.equal(Object.isFrozen(phaseDiagramTemplatePaths), true);
  assert.throws(
    () => (phaseDiagramTemplatePaths as string[]).push("extra"),
    TypeError,
  );
  for (const [path, diagrams] of profiles)
    assert.deepEqual(
      inspectPhaseDiagramTemplates([
        { path, content: createTemplate(diagrams) },
      ]),
      [],
    );
  assert.deepEqual(inspectPhaseDiagramTemplates([]), []);
  assert.deepEqual(
    inspectPhaseDiagramTemplates([
      { path: "TEMPLATE/02_UX/01_User_Experience.md", content: "" },
    ]),
    [],
  );
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
  const issues = inspectPhaseDiagramTemplates(sources);
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
    const issues = inspectPhaseDiagramTemplates([{ path, content: text }]);
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
      const issues = inspectPhaseDiagramTemplates([
        { path, content: createTemplate(diagrams).replace(token, "") },
      ]);
      assert.deepEqual(
        issues.map((issue) => issue.details.missingItems),
        index === 0 ? ["human-understanding-confirmation"] : [],
      );
    }
});
